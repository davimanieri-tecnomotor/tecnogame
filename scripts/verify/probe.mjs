// Ad-hoc DOM probe: prints the element tree with sizes for one route, or what
// sits at a given point.
import puppeteer from 'puppeteer';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
// BASE may be an origin (http://host:port) or a full page URL
// (file:///.../web/index.html), which is how the file:// build is checked.
const pageUrl = (route) => (BASE.endsWith('.html') ? `${BASE}#${route}` : `${BASE}/#${route}`);
// Pass the route WITHOUT a leading slash: Git Bash rewrites `/foo` into a
// Windows path before node ever sees it.
const raw = process.argv[2] ?? 'cadastro';
const route = raw.startsWith('/') ? raw : `/${raw}`;
const point = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
const depth = Number(process.env.DEPTH ?? 8);

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--window-size=1920,1080'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: process.env.THEME ?? 'dark' }]);
await page.goto(pageUrl(route), { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 2600));

if (point) {
  const info = await page.evaluate(([x, y]) => {
    const els = document.elementsFromPoint(x, y);
    return els.slice(0, 8).map((n) => {
      const r = n.getBoundingClientRect();
      const cs = getComputedStyle(n);
      return `${n.tagName.toLowerCase()}.${(n.className || '').toString().replace(/\s+/g, '.')} ` +
        `[${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}] ` +
        `font="${cs.fontFamily}" text=${JSON.stringify((n.textContent || '').slice(0, 40))}`;
    });
  }, point);
  console.log(info.join('\n'));
} else {
  const tree = await page.evaluate((maxDepth) => {
    const lines = [];
    const walk = (node, level) => {
      if (level > maxDepth) return;
      const r = node.getBoundingClientRect();
      const cls = (node.className || '').toString().split(' ')[0];
      lines.push(
        `${'  '.repeat(level)}${node.tagName.toLowerCase()}${cls ? '.' + cls : ''} ` +
          `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}` +
          (node.children.length === 0 ? ` "${(node.textContent || '').slice(0, 30)}"` : '')
      );
      for (const child of node.children) walk(child, level + 1);
    };
    walk(document.getElementById('pages'), 0);
    return lines.join('\n');
  }, depth);
  console.log(tree);
}

await browser.close();
