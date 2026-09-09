import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--window-size=1920,1080'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.goto('http://127.0.0.1:8123/index.html#/roleta', { waitUntil: 'networkidle2' });
await new Promise(r=>setTimeout(r,2800));
const info = await page.evaluate(() => {
  const out = [];
  const stack = document.querySelector('#pages .ff-stack');
  const img = [...document.querySelectorAll('#pages img')].find(i => /Roleta\.png/.test(i.src));
  const desc = (n, label) => {
    if (!n) return out.push(label + ': NOT FOUND');
    const r = n.getBoundingClientRect();
    const cs = getComputedStyle(n);
    out.push(`${label}: rect ${r.left.toFixed(1)},${r.top.toFixed(1)} ${r.width.toFixed(1)}x${r.height.toFixed(1)} | client ${n.clientWidth}x${n.clientHeight} scroll ${n.scrollWidth}x${n.scrollHeight} | overflow=${cs.overflow} maxH=${cs.maxHeight} maxW=${cs.maxWidth} objectFit=${cs.objectFit} h=${cs.height} w=${cs.width}`);
  };
  desc(stack, 'stack');
  const wheel = img && img.closest('div[style*="946"]') || (stack && [...stack.querySelectorAll('div')].find(d => Math.round(d.getBoundingClientRect().height) === 946));
  desc(wheel, 'wheelContainer');
  desc(img && img.parentElement, 'clipRRect');
  desc(img, 'img');
  if (img && stack) {
    const ri = img.getBoundingClientRect(), rs = stack.getBoundingClientRect();
    out.push(`img relative to stack: top ${(ri.top-rs.top).toFixed(1)} bottom ${(ri.bottom-rs.bottom).toFixed(1)} left ${(ri.left-rs.left).toFixed(1)} right ${(ri.right-rs.right).toFixed(1)}`);
    out.push(`natural ${img.naturalWidth}x${img.naturalHeight}`);
  }
  const st = document.querySelector('#stage') || document.querySelector('.ff-stage');
  if (st) out.push('stage transform: ' + getComputedStyle(st).transform);
  return out.join('\n');
});
console.log(info);
await page.screenshot({ path: process.env.SHOT || 'shot_roleta.png' });
await browser.close();
