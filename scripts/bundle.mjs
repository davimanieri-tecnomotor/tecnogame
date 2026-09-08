// Builds web/js/bundle.js: every ES module in web/js concatenated into a single
// *classic* script, so the game also runs when index.html is opened straight
// from disk (file:// blocks module scripts with a CORS error).
//
// Each module keeps its own scope inside a factory function, so module-private
// helpers with the same name in different files (slideIn, tapFeedback,
// styleToCss, ...) can't collide. Imports become calls into a tiny registry.
//
//   node scripts/bundle.mjs
//
// Run it after editing anything under web/js.

import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = path.join(HERE, '..', 'web', 'js');
const ENTRY = 'main.js';
const OUT = path.join(ROOT, 'bundle.js');

/* ------------------------------------------------------------- discovery -- */

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.js') && entry.name !== 'bundle.js' ? [full] : [];
  });
}

const id = (file) => path.relative(ROOT, file).split(path.sep).join('/');

const files = walk(ROOT);
const sources = new Map(files.map((f) => [id(f), fs.readFileSync(f, 'utf8')]));

/* ------------------------------------------------------------ transforms -- */

const IMPORT_RE = /^[ \t]*import\s+(?:([\w$]+)\s*,\s*)?(?:\{([\s\S]*?)\}|([\w$*]+(?:\s+as\s+[\w$]+)?))\s+from\s+['"]([^'"]+)['"];?[ \t]*\r?\n/gm;
const BARE_IMPORT_RE = /^[ \t]*import\s+['"]([^'"]+)['"];?[ \t]*\r?\n/gm;

/** Resolve './x.js' / '../y/z.js' relative to the importing module. */
function resolveSpec(fromId, spec) {
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(fromId), spec));
  if (!sources.has(resolved)) throw new Error(`${fromId}: cannot resolve ${spec} (-> ${resolved})`);
  return resolved;
}

/** Collect a module's dependencies without rewriting anything. */
function depsOf(moduleId) {
  const src = sources.get(moduleId);
  const deps = new Set();
  for (const m of src.matchAll(IMPORT_RE)) deps.add(resolveSpec(moduleId, m[4]));
  for (const m of src.matchAll(BARE_IMPORT_RE)) deps.add(resolveSpec(moduleId, m[1]));
  return [...deps];
}

/** Rewrite one module body into a factory-function body. */
function transform(moduleId) {
  let src = sources.get(moduleId);
  const exported = new Set();

  src = src.replace(BARE_IMPORT_RE, (_all, spec) => `__require(${JSON.stringify(resolveSpec(moduleId, spec))});\n`);

  src = src.replace(IMPORT_RE, (all, defaultName, named, star, spec) => {
    const dep = JSON.stringify(resolveSpec(moduleId, spec));
    if (star) {
      const alias = star.includes(' as ') ? star.split(/\s+as\s+/)[1].trim() : star.trim();
      if (star.trim() === '*') throw new Error(`${moduleId}: bare "import *" needs an alias`);
      return `const ${alias} = __require(${dep});\n`;
    }
    if (defaultName || !named) throw new Error(`${moduleId}: default imports are not used in this project (${all.trim()})`);
    // `{ a, b as c }` -> `{ a, b: c }`
    const bindings = named
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.includes(' as ') ? s.split(/\s+as\s+/).map((x) => x.trim()).join(': ') : s))
      .join(', ');
    return `const { ${bindings} } = __require(${dep});\n`;
  });

  // `export const/let/var/function/class NAME`
  src = src.replace(
    /^([ \t]*)export\s+(async\s+)?(const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm,
    (_all, indent, asyncKw, kind, name) => {
      exported.add(name);
      return `${indent}${asyncKw ?? ''}${kind} ${name}`;
    }
  );

  // `export { a, b as c }`
  src = src.replace(/^[ \t]*export\s*\{([^}]*)\};?[ \t]*$/gm, (_all, list) => {
    const pairs = list
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [local, alias] = s.includes(' as ') ? s.split(/\s+as\s+/).map((x) => x.trim()) : [s, s];
        exported.add(alias);
        return `__exports[${JSON.stringify(alias)}] = ${local};`;
      });
    return pairs.join(' ');
  });

  if (/^\s*export\s+default/m.test(src)) throw new Error(`${moduleId}: default exports are not used in this project`);
  if (/^\s*export\s/m.test(src)) throw new Error(`${moduleId}: unhandled export form remains`);

  // Bind the exports as live getters so hoisted function declarations and
  // later-initialised consts both read correctly.
  const bindings = [...exported]
    .map((name) => `  Object.defineProperty(__exports, ${JSON.stringify(name)}, { get: () => ${name}, enumerable: true });`)
    .join('\n');

  return { body: src, bindings, exported };
}

/* ---------------------------------------------------------------- order --- */

const order = [];
const state = new Map();

function visit(moduleId, stack = []) {
  if (state.get(moduleId) === 'done') return;
  if (state.get(moduleId) === 'visiting') {
    throw new Error(`circular import: ${[...stack, moduleId].join(' -> ')}`);
  }
  state.set(moduleId, 'visiting');
  for (const dep of depsOf(moduleId)) visit(dep, [...stack, moduleId]);
  state.set(moduleId, 'done');
  order.push(moduleId);
}

visit(ENTRY);
// Anything not reachable from the entry would be dead code; report it.
const unreachable = [...sources.keys()].filter((m) => !order.includes(m));
if (unreachable.length) console.log('note: not reachable from main.js ->', unreachable.join(', '));

/* ----------------------------------------------------------------- emit --- */

const parts = [
  '// GENERATED by scripts/bundle.mjs - do not edit. Run `node scripts/bundle.mjs`.',
  '//',
  '// Single classic script holding every module in web/js, so index.html works',
  '// from file:// as well as over HTTP. The readable ES modules are still the',
  '// source of truth; this is only a concatenation of them.',
  '(function () {',
  '  "use strict";',
  '  var __registry = {};',
  '  function __define(id, factory) { __registry[id] = { factory: factory, exports: null }; }',
  '  function __require(id) {',
  '    var mod = __registry[id];',
  '    if (!mod) throw new Error("module not bundled: " + id);',
  '    if (!mod.exports) { mod.exports = {}; mod.factory(mod.exports, __require); }',
  '    return mod.exports;',
  '  }',
  '',
];

for (const moduleId of order) {
  const { body, bindings } = transform(moduleId);
  parts.push(`  /* ===== ${moduleId} ===== */`);
  parts.push(`  __define(${JSON.stringify(moduleId)}, function (__exports, __require) {`);
  parts.push(body.replace(/^/gm, '  ').trimEnd());
  if (bindings) parts.push(bindings);
  parts.push('  });');
  parts.push('');
}

parts.push(`  __require(${JSON.stringify(ENTRY)});`);
parts.push('})();');

fs.writeFileSync(OUT, parts.join('\n') + '\n', 'utf8');
console.log(`wrote ${path.relative(process.cwd(), OUT)} (${order.length} modules, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
