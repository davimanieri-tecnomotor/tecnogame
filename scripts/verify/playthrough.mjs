// End-to-end playthrough: registration -> instructions -> wheel -> car ->
// scanner -> demo video -> question -> confirm -> end screen -> restart.
// Screenshots each step and fails loudly on console errors.
import puppeteer from 'puppeteer';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
// BASE may be an origin (http://host:port) or a full page URL
// (file:///.../web/index.html), which is how the file:// build is checked.
const pageUrl = (route) => (BASE.endsWith('.html') ? `${BASE}#${route}` : `${BASE}/#${route}`);
const LOCAL_FILE = BASE.startsWith('file:');
// On file:// the module boot is expected to fail and index.html falls back to
// js/bundle.js; that pair of messages is not an app error.
const isBootNoise = (t) => LOCAL_FILE && /js\/main\.js|net::ERR_FAILED/.test(t);
const OUT = process.env.OUT ?? 'shots/playthrough';
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--window-size=1920,1080', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: process.env.THEME ?? 'dark' }]);

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !isBootNoise(m.text())) {
    errors.push(`[console] ${m.text()}`);
    console.log(`  ! [console] ${m.text()}`);
  }
});
page.on('pageerror', (e) => {
  errors.push(`[pageerror] ${e.message}`);
  console.log('  ! [pageerror] ' + e.message);
  console.log((e.stack || '').split(String.fromCharCode(10)).slice(1, 4).join(String.fromCharCode(10)));
});

const route = () => page.evaluate(() => document.querySelector('.ff-page')?.dataset.route ?? null);
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForRoute(name, timeout = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if ((await route()) === name) return true;
    await wait(200);
  }
  throw new Error(`timed out waiting for route "${name}" (current: ${await route()})`);
}

/** Click the element whose visible text matches, inside the current page. */
async function clickText(text) {
  const clicked = await page.evaluate((needle) => {
    const nodes = [...document.querySelectorAll('#pages .ff-text, #pages .ff-btn, #overlays .ff-text')];
    const hit = nodes.find((n) => (n.textContent || '').trim().toLowerCase() === needle.toLowerCase());
    if (!hit) return false;
    const target = hit.closest('.ff-inkwell, .ff-btn') ?? hit;
    target.click();
    return true;
  }, text);
  if (!clicked) throw new Error(`no clickable element with text "${text}"`);
}

const log = (msg) => console.log(msg);

await page.goto(pageUrl('/'), { waitUntil: 'networkidle2' });
await page.evaluate(() => localStorage.clear());
await page.goto(pageUrl('/'), { waitUntil: 'networkidle2' });
await waitForRoute('_initialize');
log('1. cadastro loaded');

// ---- registration -------------------------------------------------------
await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('#pages input.ff-input')];
  return inputs.length;
});
const inputs = await page.$$('#pages input.ff-input');
if (inputs.length !== 2) throw new Error(`expected 2 inputs, found ${inputs.length}`);
await inputs[0].click();
await inputs[0].type('Davi');
await inputs[1].click();
await inputs[1].type('16997037115');
await shot('01-typed');

const masked = await page.evaluate(() => document.querySelectorAll('#pages input.ff-input')[1].value);
log(`2. phone mask -> "${masked}"`);
if (masked !== '(16) 99703-7115') throw new Error(`mask wrong: ${masked}`);

// dropdown
// The oficina dropdown is the first one; the language selector is the second.
const DD = '#pages .ff-dropdown';
await page.evaluate((sel) => document.querySelectorAll(sel)[0].click(), DD);
await wait(200);
await shot('02-dropdown');
const optionCount = await page.evaluate(
  () => document.querySelectorAll('.ff-dropdown-item').length,
  DD
);
log(`3. oficina dropdown options: ${optionCount}`);
if (optionCount !== 10) throw new Error(`expected 10 options, got ${optionCount}`);
await page.evaluate(
  () => document.querySelectorAll('.ff-dropdown-item')[2].click(),
  DD
);
await wait(200);

// validation: submit with a good name should advance
await clickText('CONFIRMAR');
await waitForRoute('instrucoes');
log('4. instrucoes reached (validation passed, cadastro stored)');
const cadastro = await page.evaluate(() => {
  // eslint-disable-next-line no-undef
  return window.__ff_state ? null : null;
});
void cadastro;
await shot('03-instrucoes');

// ---- skip instructions --------------------------------------------------
await clickText('Pular instruções');
await waitForRoute('telaVideoTransisao');
log('5. transition video');
await shot('04-transisao');

await waitForRoute('roleta', 12000);
log('6. roleta');
await shot('05-roleta');

// ---- spin ---------------------------------------------------------------
await clickText('GIRAR A ROLETA');
await waitForRoute('carroSleecionado', 20000);
log('7. carro selecionado');
await wait(2500);
await shot('06-carro');

await waitForRoute('scanner', 20000);
log('8. scanner picker');
await wait(2200);
await shot('07-scanner');

// ---- pick the first enabled scanner ------------------------------------
const picked = await page.evaluate(() => {
  const tools = [...document.querySelectorAll('#pages .ff-stack')].filter((n) =>
    n.querySelector('img[src*="Rasther"], img[src*="TD_"]')
  );
  for (const tool of tools) {
    const opacity = tool.querySelector('[style*="opacity"]');
    if (opacity && Number(opacity.style.opacity) === 1) {
      tool.querySelector('.ff-inkwell').click();
      return tool.querySelector('img').getAttribute('src');
    }
  }
  return null;
});
log(`9. picked scanner image: ${picked}`);
if (!picked) throw new Error('no enabled scanner found');

await waitForRoute('telaVideoScanner', 15000);
const chosen = await page.evaluate(() => document.title && null);
void chosen;
await wait(1200);
await shot('08-videoScanner');
log('10. scanner demo screen');

await waitForRoute('telaAcao', 25000);
await wait(1500);
await shot('09-telaAcao');
log('11. telaAcao');

// ---- inspect the question panel -----------------------------------------
const ANSWER_FINDER = `
  [...document.querySelectorAll('#pages .ff-text')]
    .filter((n) => /^[1-4]$/.test(n.textContent.trim()) && Math.round(parseFloat(getComputedStyle(n).fontSize)) === 55)
    .map((n) => n.closest('.ff-stack'))
`;
const panel = await page.evaluate((finder) => {
  // eslint-disable-next-line no-eval
  const cards = eval(finder);
  return {
    answers: cards.length,
    numbers: cards.map((c) => [...c.querySelectorAll('.ff-text')].pop().textContent.trim()),
    timer: document.querySelector('#pages [data-family="pirulen"][style*="62px"]')?.textContent ?? null,
    hints: document.querySelectorAll('#pages [data-hint]').length,
    dicas: [...document.querySelectorAll('#pages .ff-text')].find((n) => /^\dX$/.test(n.textContent.trim()))
      ?.textContent,
  };
}, ANSWER_FINDER);
log(`12. panel: ${JSON.stringify(panel)}`);

// ---- use a support hint -------------------------------------------------
await page.evaluate(() => document.querySelector('#pages [data-hint="apoio"] .ff-inkwell').click());
await wait(1600);
await shot('10-popup');
const popupText = await page.evaluate(
  () => document.querySelector('#overlays .ff-dialog .ff-text')?.textContent?.slice(0, 60) ?? null
);
log(`13. hint popup: ${JSON.stringify(popupText)}`);
// Fecha pelo ROTULO, e nao pela posicao na arvore: o `:last-of-type` que
// estava aqui casava a antiga forma do popup e parou de achar o X quando ele
// foi para o canto do cabecalho.
await page.evaluate(() => document.querySelector('#overlays [aria-label="Fechar"]').click());
await wait(800);
const dicasAfter = await page.evaluate(
  () => [...document.querySelectorAll('#pages .ff-text')].find((n) => /^\dX$/.test(n.textContent.trim()))?.textContent
);
log(`14. hints left after using one: ${dicasAfter}`);

// ---- answer -------------------------------------------------------------
const expected = await page.evaluate(() => {
  const slot = 0;
  return { slot };
});
void expected;
const answered = await page.evaluate((finder) => {
  // eslint-disable-next-line no-eval
  const cards = eval(finder);
  if (!cards.length) return null;
  const card = cards[0];
  // Computado, nao inline: ver a nota em baralho.mjs sobre o piso de legibilidade.
  const text = [...card.querySelectorAll('.ff-text')].find(
    (n) => Math.round(parseFloat(getComputedStyle(n).fontSize)) === 24
  )?.textContent;
  card.querySelector('.ff-inkwell').click();
  return text;
}, ANSWER_FINDER);
if (!answered) throw new Error('no answer cards found');
log(`15. clicked answer 1: ${JSON.stringify(answered.slice(0, 60))}`);
await wait(1200);
await shot('11-confirmacao');
const dialogText = await page.evaluate(
  () => document.querySelector('#overlays .ff-dialog')?.textContent?.slice(0, 50) ?? null
);
log(`16. confirm dialog: ${JSON.stringify(dialogText)}`);

await page.evaluate(() => {
  const nodes = [...document.querySelectorAll('#overlays .ff-text')];
  const hit = nodes.find((n) => n.textContent.trim() === 'Confirmar');
  hit.closest('.ff-inkwell').click();
});

const end = await Promise.race([
  waitForRoute('Ganhou', 15000).then(() => 'Ganhou'),
  waitForRoute('Perdeu', 15000).then(() => 'Perdeu'),
]);
await wait(4800);
await shot('12-fim');
log(`17. end screen: ${end}`);

const stored = await page.evaluate(() => ({
  usuarios: JSON.parse(localStorage.getItem('tecgame:usuarios') || '[]'),
  contatos: JSON.parse(localStorage.getItem('tecgame:contatos') || '[]'),
}));
log(`18. usuarios: ${stored.usuarios.length} -> ${JSON.stringify(stored.usuarios[0] ?? null)}`);
log(`    contatos: ${stored.contatos.length} -> ${JSON.stringify(stored.contatos[0] ?? null)}`);
// O ranking e lido publicamente, entao telefone nao pode estar nele.
if (!stored.usuarios.length) throw new Error('nenhum resultado gravado');
if ('telefone' in stored.usuarios[0]) throw new Error('telefone vazou para a colecao do ranking');
if (stored.contatos[0]?.telefone !== '(16) 99703-7115') throw new Error('telefone nao foi para contatos');

// ---- restart ------------------------------------------------------------
await clickText('REINICIAR');
await waitForRoute('telaVideoTransisao', 15000);
log('19. restart -> transition video');
await waitForRoute('cadastro', 15000);
log('20. back at cadastro');
await shot('13-restart');

await browser.close();

if (errors.length) {
  console.log('\nCONSOLE ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('\nplaythrough clean');
