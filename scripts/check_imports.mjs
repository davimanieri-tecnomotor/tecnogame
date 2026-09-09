// Static sanity check over web/js: every import path resolves, every named
// import exists in the target module, and nothing imported is unused.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('web/js');

// bundle.js is generated (a classic script, no imports) - skip it here; its
// freshness is checked separately at the bottom.
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return full.endsWith('.js') && entry.name !== 'bundle.js' ? [full] : [];
  });
}

const files = walk(ROOT);
const sources = new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));

/** Exported names of a module (export const/function/class + export { ... }). */
function exportsOf(src) {
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(m[1]);
  }
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  return names;
}

const problems = [];

for (const [file, src] of sources) {
  const rel = path.relative(process.cwd(), file);
  const body = src;

  for (const m of body.matchAll(/import\s+(?:([\w$]+)|\{([^}]*)\})\s+from\s+['"]([^'"]+)['"]/g)) {
    const [, defaultName, namedList, spec] = m;
    if (!spec.startsWith('.')) continue;
    const target = path.resolve(path.dirname(file), spec);
    if (!sources.has(target)) {
      problems.push(`${rel}: import path does not exist -> ${spec}`);
      continue;
    }
    const available = exportsOf(sources.get(target));
    const names = (namedList ?? '')
      .split(',')
      .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean);
    for (const name of names) {
      if (!available.has(name)) {
        problems.push(`${rel}: '${name}' is not exported by ${spec}`);
      }
    }
    // Unused imports are dead weight; flag them.
    const localNames = (namedList ?? '')
      .split(',')
      .map((s) => s.trim().split(/\s+as\s+/).pop().trim())
      .filter(Boolean);
    const afterImports = body.replace(/import[^;]+;/g, '');
    for (const name of localNames) {
      if (!new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`).test(afterImports)) {
        problems.push(`${rel}: unused import '${name}' from ${spec}`);
      }
    }
    if (defaultName) problems.push(`${rel}: default import used (${defaultName}) - this project uses named exports`);
  }
}

// Os bundle.js sao a versao em script classico usada pelo fallback de file://;
// se um modulo estiver mais novo que eles, o build clicavel roda codigo antigo.
for (const rel of ['bundle.js', 'admin/bundle.js']) {
  const bundlePath = path.join(ROOT, ...rel.split('/'));
  // O bundle do admin so passa a existir depois que a pagina existe.
  if (!fs.existsSync(bundlePath)) {
    if (rel === 'bundle.js') problems.push('web/js/bundle.js nao existe - rode `node scripts/bundle.mjs`');
    continue;
  }
  const bundleTime = fs.statSync(bundlePath).mtimeMs;
  const newer = files.filter((f) => fs.statSync(f).mtimeMs > bundleTime + 1000);
  if (newer.length) {
    problems.push(
      `web/js/${rel} esta mais velho que ${newer.length} modulo(s) - rode \`node scripts/bundle.mjs\`:\n  ` +
        newer.map((f) => path.relative(process.cwd(), f)).join('\n  ')
    );
  }
}

if (problems.length) {
  console.log(problems.join('\n'));
  console.log(`\n${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`OK - ${files.length} modules, imports all resolve, bundle.js up to date`);
