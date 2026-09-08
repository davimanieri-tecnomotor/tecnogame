// Item 9 da auditoria: os alvos de toque sao <div role="button">, que nao entram
// na ordem de tabulacao sozinhos. Confere que o teclado alcanca e aciona.
import puppeteer from 'puppeteer';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
const pageUrl = (route) => (BASE.endsWith('.html') ? `${BASE}#${route}` : `${BASE}/#${route}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
const falhas = [];
page.on('pageerror', (e) => falhas.push('pageerror: ' + e.message));

await page.goto(pageUrl('/cadastro'), { waitUntil: 'networkidle2' });
await wait(2600);

const alcancaveis = await page.evaluate(() => {
  const alvos = [...document.querySelectorAll('#pages .ff-inkwell')];
  return {
    total: alvos.length,
    comTabindex: alvos.filter((n) => n.getAttribute('tabindex') === '0').length,
    comRole: alvos.filter((n) => n.getAttribute('role') === 'button').length,
  };
});
console.log('alvos no cadastro:', JSON.stringify(alcancaveis));
if (alcancaveis.total === 0) falhas.push('nenhum alvo encontrado');
if (alcancaveis.comTabindex !== alcancaveis.total) {
  falhas.push(`${alcancaveis.total - alcancaveis.comTabindex} alvo(s) fora da ordem de tabulacao`);
}

// Tab chega em algum alvo e o anel de foco aparece.
const foco = await page.evaluate(async () => {
  const alvo = document.querySelector('#pages .ff-inkwell');
  alvo.focus();
  const cs = getComputedStyle(alvo);
  return { focado: document.activeElement === alvo, outline: cs.outlineWidth, outlineStyle: cs.outlineStyle };
});
console.log('foco:', JSON.stringify(foco));
if (!foco.focado) falhas.push('nao foi possivel focar um alvo');

// Enter e Espaco acionam. O botao de politica de privacidade abre um dialogo.
for (const tecla of ['Enter', ' ']) {
  await page.evaluate(() => {
    const alvos = [...document.querySelectorAll('#pages .ff-inkwell')];
    // o ultimo e o texto da politica de privacidade
    alvos[alvos.length - 1].focus();
  });
  await page.keyboard.press(tecla === ' ' ? 'Space' : tecla);
  await wait(700);
  const abriu = await page.evaluate(() => Boolean(document.querySelector('#overlays .ff-barrier')));
  console.log(`tecla ${JSON.stringify(tecla)} abriu o dialogo:`, abriu);
  if (!abriu) falhas.push(`tecla ${JSON.stringify(tecla)} nao acionou o alvo`);
  await page.evaluate(() => document.querySelector('#overlays .ff-inkwell')?.click());
  await wait(500);
}

await browser.close();
if (falhas.length) {
  console.log('\nFALHOU:\n- ' + falhas.join('\n- '));
  process.exit(1);
}
console.log('\nalvos alcancaveis e acionaveis por teclado');
