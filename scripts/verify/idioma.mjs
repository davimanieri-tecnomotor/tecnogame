// Regressao do item 1 da auditoria: no Flutter o TextEditingController vive no
// model e sobrevive ao rebuild que setLocale dispara. Aqui a troca de idioma
// reconstroi a pagina, entao o que o visitante digitou precisa ser preservado
// de proposito. Este teste falha se voltar a apagar.
import puppeteer from 'puppeteer';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
const pageUrl = (route) => (BASE.endsWith('.html') ? `${BASE}#${route}` : `${BASE}/#${route}`);

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const snapshot = () =>
  page.evaluate(() => ({
    inputs: [...document.querySelectorAll('#pages input.ff-input')].map((i) => i.value),
    oficina: document.querySelectorAll('#pages .ff-dropdown')[0].querySelector('.ff-text').textContent.trim(),
  }));

async function pickLanguage(nome) {
  await page.evaluate(() => document.querySelectorAll('#pages .ff-dropdown')[1].click());
  await wait(250);
  await page.evaluate((n) => {
    [...document.querySelectorAll('#pages .ff-dropdown-item')].find((x) => x.textContent.trim() === n).click();
  }, nome);
  await wait(1200);
}

await page.goto(pageUrl('/cadastro'), { waitUntil: 'networkidle2' });
await page.evaluate(() => localStorage.clear());
await page.goto(pageUrl('/cadastro'), { waitUntil: 'networkidle2' });
await wait(2600);

const inputs = await page.$$('#pages input.ff-input');
await inputs[0].click();
await inputs[0].type('Davi');
await inputs[1].click();
await inputs[1].type('16997037115');
await page.evaluate(() => document.querySelectorAll('#pages .ff-dropdown')[0].click());
await wait(250);
await page.evaluate(() =>
  document.querySelectorAll('#pages .ff-dropdown')[0].parentElement.querySelectorAll('.ff-dropdown-item')[2].click()
);
await wait(250);

const antes = await snapshot();
console.log('antes (pt)   ->', JSON.stringify(antes));

await pickLanguage('English');
const emEn = await snapshot();
console.log('depois (en)  ->', JSON.stringify(emEn));

await pickLanguage('Português');
const voltou = await snapshot();
console.log('de volta (pt)->', JSON.stringify(voltou));

const falhas = [];
if (emEn.inputs[0] !== 'Davi') falhas.push(`nome perdido na troca para EN: ${JSON.stringify(emEn.inputs[0])}`);
if (emEn.inputs[1] !== '(16) 99703-7115') falhas.push(`telefone perdido: ${JSON.stringify(emEn.inputs[1])}`);
// A oficina foi guardada pela chave, entao reaparece traduzida.
if (emEn.oficina !== '- Mechanical workshop') falhas.push(`oficina nao traduziu: ${JSON.stringify(emEn.oficina)}`);
if (voltou.oficina !== '- Oficina-mecânica') falhas.push(`oficina nao voltou ao pt: ${JSON.stringify(voltou.oficina)}`);
if (voltou.inputs[0] !== 'Davi') falhas.push('nome perdido no caminho de volta');

// E a partida seguinte tem de comecar limpa.
await page.evaluate(() => {
  const hit = [...document.querySelectorAll('#pages .ff-text')].find((n) => n.textContent.trim() === 'CONFIRMAR');
  hit.closest('.ff-inkwell').click();
});
await wait(1800);
const rota = await page.evaluate(() => document.querySelector('.ff-page')?.dataset.route);
if (rota !== 'instrucoes') falhas.push(`nao avancou apos CONFIRMAR (rota=${rota})`);
await page.goto(pageUrl('/cadastro'), { waitUntil: 'networkidle2' });
await wait(2600);
const limpo = await snapshot();
console.log('novo jogador ->', JSON.stringify(limpo));
if (limpo.inputs[0] !== '' || limpo.inputs[1] !== '') falhas.push('formulario nao limpou para o proximo jogador');

await browser.close();
if (errors.length) falhas.push('erros de console: ' + errors.join(' | '));
if (falhas.length) {
  console.log('\nFALHOU:\n- ' + falhas.join('\n- '));
  process.exit(1);
}
console.log('\ntroca de idioma preserva o formulario');
