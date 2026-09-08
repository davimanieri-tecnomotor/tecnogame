import fs from 'node:fs';
import puppeteer from 'puppeteer';
fs.mkdirSync(process.env.OUT ?? 'shots', { recursive: true });
const b = await puppeteer.launch({headless:'new', args:['--no-sandbox']});
for (const [w,h,label] of [[1366,768,'1366x768'],[3840,2160,'4k'],[1280,1024,'5-4'],[900,1600,'portrait']]) {
  const p = await b.newPage();
  await p.setViewport({width:w,height:h});
  await p.emulateMediaFeatures([{name:'prefers-color-scheme', value:'dark'}]);
  await p.goto('http://127.0.0.1:8099/#/telaAcao', {waitUntil:'networkidle2'});
  await new Promise(r=>setTimeout(r,2200));
  const m = await p.evaluate(()=>{
    const s = document.getElementById('stage');
    const r = s.getBoundingClientRect();
    return {scale:+getComputedStyle(s).getPropertyValue('--stage-scale'), box:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
            overflowX: document.documentElement.scrollWidth > window.innerWidth};
  });
  console.log(label, JSON.stringify(m));
  await p.screenshot({path:`${process.env.OUT ?? 'shots'}/size-${label}.png`});
  await p.close();
}
await b.close();
