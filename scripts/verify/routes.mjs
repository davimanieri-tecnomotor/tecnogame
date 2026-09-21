// Headless walk-through of the port: visits each route, captures console
// errors / failed requests, and screenshots the page.
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
// BASE may be an origin (http://host:port) or a full page URL
// (file:///.../web/index.html), which is how the file:// build is checked.
const pageUrl = (route) => (BASE.endsWith('.html') ? `${BASE}#${route}` : `${BASE}/#${route}`);
const LOCAL_FILE = BASE.startsWith('file:');
const OUT = process.env.OUT ?? 'shots/routes';
const THEME = process.env.THEME ?? 'dark';
fs.mkdirSync(OUT, { recursive: true });

const routes = process.argv.slice(2);
const targets = routes.length
  ? routes
  : [
      'cadastro:/cadastro',
      'roleta:/roleta',
      'carro:/carro',
      'scanner:/scanner',
      'telaAcao:/telaAcao',
      'ganhou:/ganhou',
      'perdeu:/perdeu',
      'instrucoes:/instrucoes',
      'telaVideoTransisao:/telaVideoTransisao?tipo=1',
      'telaVideoScanner:/telaVideoScanner',
    ];

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--window-size=1920,1080', '--autoplay-policy=no-user-gesture-required', '--font-render-hinting=none'],
});

let problems = 0;

for (const target of targets) {
  const [name, route] = target.split(':');
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: THEME }]);

  const logs = [];
  page.on('console', (msg) => {
    const text = msg.text();
    // Same story as the requestfailed handler: the blocked module boot on
    // file:// is expected and handled by the bundle fallback.
    if (LOCAL_FILE && /js\/main\.js|net::ERR_FAILED/.test(text)) return;
    if (msg.type() === 'error' || msg.type() === 'warning') logs.push(`[${msg.type()}] ${text}`);
  });
  page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));
  page.on('requestfailed', (req) => {
    // A video the page is still streaming when the test closes reports
    // ERR_ABORTED; that is the harness, not the app.
    const aborted = req.failure()?.errorText === 'net::ERR_ABORTED';
    if (aborted && /\.mp4(\?|$)/.test(req.url()) && !req.url().includes('firebasestorage')) return;
    // On file:// the module boot is *expected* to fail; index.html then loads
    // js/bundle.js instead. Only the fallback failing would be a problem.
    if (LOCAL_FILE && req.url().endsWith('/js/main.js')) return;
    logs.push(`[requestfailed] ${req.url()} ${req.failure()?.errorText}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) logs.push(`[http ${res.status()}] ${res.url()}`);
  });

  try {
    await page.goto(pageUrl(route), { waitUntil: 'networkidle2', timeout: 20000 });
  } catch (error) {
    logs.push(`[goto] ${error.message}`);
  }

  // Let the on-page-load animations settle without waiting out the auto-advance.
  await new Promise((r) => setTimeout(r, 2600));

  // Report anything laid out off the 1920x1080 stage or with a zero size.
  const layout = await page.evaluate(() => {
    const stage = document.getElementById('stage');
    const out = { overflow: [], zero: [], stageScale: getComputedStyle(stage).getPropertyValue('--stage-scale') };
    const pages = document.getElementById('pages');
    for (const node of pages.querySelectorAll('*')) {
      const r = node.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const tag = `${node.tagName.toLowerCase()}.${(node.className || '').toString().split(' ')[0]}`;
      const outside = r.right > 1921 || r.bottom > 1081 || r.left < -1 || r.top < -1;
      if (!outside) continue;
      // A Stack clips with Clip.hardEdge, so a child whose box pokes out of a
      // clipping ancestor is drawn correctly - only report unclipped ones.
      let clipped = false;
      for (let a = node.parentElement; a && a.id !== 'pages'; a = a.parentElement) {
        if (getComputedStyle(a).overflow !== 'visible') {
          clipped = true;
          break;
        }
      }
      if (!clipped) {
        out.overflow.push(`${tag} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    for (const img of pages.querySelectorAll('img')) {
      if (!img.complete || img.naturalWidth === 0) out.zero.push(img.getAttribute('src'));
    }
    return out;
  });

  await page.screenshot({ path: path.join(OUT, `${name}.png`) });

  // The scanner demo clips live in a Firebase Storage bucket that now answers
  // 402 Payment Required - broken upstream, and broken in the Flutter build too.
  const known = logs.filter((l) => l.includes('firebasestorage.googleapis.com'));
  const real = logs.filter((l) => !known.includes(l));

  const hasProblem = real.length || layout.zero.length;
  if (hasProblem) problems++;
  console.log(`\n=== ${name} (${route}) scale=${Number(layout.stageScale).toFixed(3)}`);
  if (known.length) console.log(`known-broken upstream: videoScanners bucket (${known.length} request/s)`);
  if (real.length) console.log(real.slice(0, 12).join('\n'));
  if (layout.zero.length) console.log('broken images:', [...new Set(layout.zero)].join(', '));
  if (layout.overflow.length) console.log('outside stage (first 8):\n' + layout.overflow.slice(0, 8).join('\n'));
  if (!hasProblem && !layout.overflow.length && !known.length) console.log('clean');
  else if (!hasProblem && !layout.overflow.length) console.log('otherwise clean');

  await page.close();
}

await browser.close();
console.log(`\n${problems} route(s) with console/asset problems`);
