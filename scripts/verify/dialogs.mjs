// Second pass: the dialogs (offensive name, privacy policy, invalid equipment,
// idle ranking), the winning answer branch, and language switching.
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
// BASE may be an origin (http://host:port) or a full page URL
// (file:///.../web/index.html), which is how the file:// build is checked.
const pageUrl = (route) => (BASE.endsWith('.html') ? `${BASE}#${route}` : `${BASE}/#${route}`);
const LOCAL_FILE = BASE.startsWith('file:');
// On file:// the module boot is expected to fail and index.html falls back to
// js/bundle.js; that pair of messages is not an app error.
const isBootNoise = (t) => LOCAL_FILE && /js\/main\.js|net::ERR_FAILED/.test(t);
const OUT = process.env.OUT ?? 'shots/dialogs';
fs.mkdirSync(OUT, { recursive: true });

// Load the generated question bank so the test can work out the right answer.
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const qsrc = fs.readFileSync(process.env.QSRC ?? path.join(HERE, '../../web/js/questions.js'), 'utf8');
const QUESTIONS = JSON.parse(qsrc.slice(qsrc.indexOf('{'), qsrc.lastIndexOf(';')));

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
    errors.push(m.text());
    console.log('  ! ' + m.text());
  }
});
page.on('pageerror', (e) => {
  errors.push(e.message);
  console.log('  ! ' + e.message);
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const route = () => page.evaluate(() => document.querySelector('.ff-page')?.dataset.route ?? null);
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const log = console.log;

async function waitForRoute(name, timeout = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if ((await route()) === name) return;
    await wait(150);
  }
  throw new Error(`timeout waiting for ${name} (at ${await route()})`);
}

async function clickText(text, scope = '#pages, #overlays') {
  const ok = await page.evaluate(
    ([needle, sel]) => {
      const roots = sel.split(',').map((s) => document.querySelector(s.trim()));
      for (const root of roots) {
        if (!root) continue;
        const hit = [...root.querySelectorAll('.ff-text, .ff-btn')].find(
          (n) => n.textContent.trim().toLowerCase() === needle.toLowerCase()
        );
        if (hit) {
          (hit.closest('.ff-inkwell, .ff-btn') ?? hit).click();
          return true;
        }
      }
      return false;
    },
    [text, scope]
  );
  if (!ok) throw new Error(`no clickable "${text}"`);
}

/** Clica a linha de consentimento do cadastro, seja qual for a frase dela. */
async function clickAviso() {
  const ok = await page.evaluate(() => {
    const alvo = [...document.querySelectorAll('#pages .ff-inkwell .ff-text')].find(
      (n) => getComputedStyle(n).textDecorationLine === 'underline'
    );
    if (!alvo) return false;
    alvo.closest('.ff-inkwell').click();
    return true;
  });
  if (!ok) throw new Error('nao achei a linha sublinhada do aviso de privacidade no cadastro');
}

const dialogText = () => page.evaluate(() => document.querySelector('#overlays .ff-dialog')?.textContent ?? null);
const dialogOpen = () => page.evaluate(() => Boolean(document.querySelector('#overlays .ff-barrier')));

await page.goto(pageUrl('/'), { waitUntil: 'networkidle2' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle2' });
await waitForRoute('_initialize');

/* ---------------------------------------------------------------- dialog 1 */
log('--- privacy policy dialog');
// A linha de consentimento e a UNICA porta para a politica, entao o teste bate
// nela pelo que ela e — o texto sublinhado embaixo do CONFIRMAR — e nao pela
// frase inteira: a frase ja mudou uma vez (ver textos.js) e derrubou este
// teste sem que nada do jogo tivesse quebrado.
await clickAviso();
await wait(500);
await shot('01-privacy');
const privacy = await dialogText();
log(`  opened: ${privacy?.slice(0, 45)}...  length=${privacy?.length}`);
if (!privacy?.includes('Política de Privacidade')) throw new Error('privacy dialog missing');
await page.evaluate(() => document.querySelector('#overlays .ff-inkwell').click());
await wait(400);
log(`  closed: ${!(await dialogOpen())}`);

/* ---------------------------------------------------------------- dialog 2 */
log('--- offensive name dialog');
const inputs = await page.$$('#pages input.ff-input');
await inputs[0].click();
await inputs[0].type('boceta');
await inputs[1].click();
await inputs[1].type('16997037115');
await clickText('CONFIRMAR');
await wait(900);
await shot('02-offensive');
const offensive = await dialogText();
log(`  opened: ${JSON.stringify(offensive?.slice(0, 60))}`);
if (!offensive?.includes('Nome inválido')) throw new Error('offensive dialog missing');
if ((await route()) !== '_initialize') throw new Error('should not navigate on offensive name');
await page.evaluate(() => document.querySelector('#overlays .ff-inkwell').click());
await wait(400);

/* ---------------------------------------------------------- form validation */
log('--- validation');
await page.evaluate(() => {
  for (const i of document.querySelectorAll('#pages input.ff-input')) {
    i.value = '';
    i.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
await clickText('CONFIRMAR');
await wait(700);
const errs = await page.evaluate(() =>
  [...document.querySelectorAll('#pages .ff-field-error')].filter((n) => !n.hidden).map((n) => n.textContent)
);
log(`  messages: ${JSON.stringify(errs)}`);
if (errs.length !== 2) throw new Error('expected both validators to fire');
await shot('03-validation');
if ((await route()) !== '_initialize') throw new Error('should not navigate when invalid');

/* ------------------------------------------------------------------- i18n  */
log('--- language switch to English');
await page.evaluate(() => document.querySelectorAll('#pages .ff-dropdown')[1].click());
await wait(200);
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.ff-dropdown-item')];
  items.find((n) => n.textContent.trim() === 'English').click();
});
await wait(800);
await shot('04-english');
const labels = await page.evaluate(() =>
  [...document.querySelectorAll('#pages .ff-text')].map((n) => n.textContent.trim()).filter(Boolean).slice(0, 6)
);
log(`  labels: ${JSON.stringify(labels)}`);
// "Workshop type" e nao "First name": o rotulo do nome e a unica palavra que
// existe igual nos tres idiomas em alguma variacao, e o teste tem de separar
// ingles de espanhol.
if (!labels.some((l) => l.includes('Workshop type'))) throw new Error('did not switch to English');

log('--- language switch to Español');
await page.evaluate(() => document.querySelectorAll('#pages .ff-dropdown')[1].click());
await wait(200);
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.ff-dropdown-item')];
  items.find((n) => n.textContent.trim() === 'Español').click();
});
await wait(800);
const esLabels = await page.evaluate(() =>
  [...document.querySelectorAll('#pages .ff-text')].map((n) => n.textContent.trim()).filter(Boolean).slice(0, 6)
);
log(`  labels: ${JSON.stringify(esLabels)}`);
await shot('05-spanish');
if (!esLabels.some((l) => l.includes('Nombre'))) throw new Error('did not switch to Spanish');

// back to Portuguese for the rest of the run
await page.evaluate(() => document.querySelectorAll('#pages .ff-dropdown')[1].click());
await wait(200);
await page.evaluate(() => {
  [...document.querySelectorAll('.ff-dropdown-item')].find((n) => n.textContent.trim() === 'Português').click();
});
await wait(700);

/* --------------------------------------------------------- idle ranking pop */
// O ranking do ocioso abre depois de 45s parado no cadastro. Este teste
// esperava 48s de relogio de parede -- em dois transportes, um quarto da suite
// inteira gasto provando uma regra que nada tem a ver com tempo real.
//
// Agora o relogio da pagina corre acelerado. O contador de ociosidade
// (FlutterFlowTimerController, em web/js/timer.js) le a hora de um lugar so,
// `performance.now`, e na tela de cadastro mais ninguem le esse relogio; as
// animacoes correm na `document.timeline`, que fica intacta e continua no ritmo
// certo. Entao os 45s da regra passam em ~1,2s reais, sem mexer no jogo: quem
// acelera e o teste, do lado de fora.
// O relogio acelerado e acumulativo de proposito: `virtual` so cresce, entao
// baixar o fator de volta para 1 no meio do caminho nao faz a hora andar para
// tras -- um timer ja em curso veria tempo negativo e se perderia.
const FATOR_DO_RELOGIO = 40;
await page.evaluateOnNewDocument(() => {
  const real = performance.now.bind(performance);
  let ultimo = real();
  let virtual = ultimo;
  window.__fatorDoRelogio = Number(sessionStorage.getItem('__relogio_do_teste') || 1);
  performance.now = () => {
    const agora = real();
    virtual += (agora - ultimo) * window.__fatorDoRelogio;
    ultimo = agora;
    return virtual;
  };
});

log(`--- idle ranking (relogio da pagina a ${FATOR_DO_RELOGIO}x)`);
// Seed a couple of winners so the ranking has rows.
await page.evaluate((fator) => {
  sessionStorage.setItem('__relogio_do_teste', String(fator));
  localStorage.setItem(
    'tecgame:usuarios',
    JSON.stringify([
      { nome: 'Ana', telefone: '1', atuacao: 'x', venceu: true, tempo: 52000, equipamento: 'Rasther 3' },
      { nome: 'Bruno', telefone: '2', atuacao: 'x', venceu: true, tempo: 41000, equipamento: 'Td90' },
      { nome: 'Carla', telefone: '3', atuacao: 'x', venceu: true, tempo: 30000, equipamento: 'RB' },
      { nome: 'Perdedor', telefone: '4', atuacao: 'x', venceu: false, tempo: 10, equipamento: 'RB' },
    ])
  );
}, FATOR_DO_RELOGIO);
await page.reload({ waitUntil: 'networkidle2' });
await waitForRoute('_initialize');
// 45s/40 da ~1,1s, mas quem dispara e um setInterval de 1s real: 3s e folga de
// duas batidas.
await wait(3000);
await shot('06-ranking');
const ranking = await dialogText();
log(`  ranking dialog: ${JSON.stringify(ranking?.slice(0, 80))}`);
if (!ranking?.includes('Rank dos melhores')) throw new Error('ranking dialog did not open');
if (!ranking.includes('Ana') || !ranking.includes('Carla')) throw new Error('ranking rows missing');
if (ranking.includes('Perdedor')) throw new Error('ranking must only list winners');
await page.evaluate(() => document.querySelector('#overlays .ff-barrier .ff-inkwell').click());
await wait(500);
log(`  closed: ${!(await dialogOpen())}`);

// Relogio de volta ao normal: daqui para a frente vem uma partida de verdade, e
// o cronometro da pergunta e o giro da roleta precisam do tempo real.
await page.evaluate(() => {
  sessionStorage.removeItem('__relogio_do_teste');
  window.__fatorDoRelogio = 1;
});

/* ------------------------------------------------------- straight to a win  */
log('--- playthrough with the correct answer');
const inputs2 = await page.$$('#pages input.ff-input');
await inputs2[0].click();
await inputs2[0].type('Vencedor');
await inputs2[1].click();
await inputs2[1].type('16999998888');
await page.evaluate(() => document.querySelectorAll('#pages .ff-dropdown')[0].click());
await wait(200);
await page.evaluate(() =>
  document.querySelectorAll('.ff-dropdown-item')[0].click()
);
await wait(200);
await clickText('CONFIRMAR');
await waitForRoute('instrucoes');
await clickText('Pular instruções');
await waitForRoute('roleta', 15000);
await clickText('GIRAR A ROLETA');
await waitForRoute('scanner', 30000);
await wait(2200);

/* ------------------------------------------------ invalid equipment dialog */
log('--- invalid equipment dialog');
const dimmed = await page.evaluate(() => {
  const tools = [...document.querySelectorAll('#pages [style*="opacity: 0.2"]')];
  if (!tools.length) return null;
  tools[0].querySelector('.ff-inkwell').click();
  return tools[0].querySelector('img').getAttribute('src');
});
if (dimmed) {
  await wait(1200);
  await shot('07-invalid');
  const invalid = await dialogText();
  log(`  clicked ${dimmed} -> ${JSON.stringify(invalid?.slice(0, 40))}`);
  if (!invalid?.includes('EQUIPAMENTO INVÁLIDO')) throw new Error('invalid-equipment dialog missing');
  await clickText('Voltar', '#overlays');
  await wait(500);
  if (await dialogOpen()) throw new Error('invalid dialog did not close');
  if ((await route()) !== 'scanner') throw new Error('should stay on scanner');
} else {
  log('  (every scanner was valid for this question - skipped)');
}

// now a valid one
await page.evaluate(() => {
  const tools = [...document.querySelectorAll('#pages .ff-stack')].filter((n) => n.querySelector('img'));
  for (const tool of tools) {
    const op = tool.querySelector('[style*="opacity"]');
    if (op && Number(op.style.opacity) === 1) {
      tool.querySelector('.ff-inkwell').click();
      return;
    }
  }
});
await waitForRoute('telaAcao', 30000);
await wait(1200);

/* ------------------------------------------------- pick the correct answer */
const cards = await page.evaluate(() =>
  [...document.querySelectorAll('#pages .ff-text')]
    .filter((n) => /^[1-4]$/.test(n.textContent.trim()) && Math.round(parseFloat(getComputedStyle(n).fontSize)) === 55)
    .map((n) => {
      const stack = n.closest('.ff-stack');
      const body = [...stack.querySelectorAll('.ff-text')].find(
        (t) => Math.round(parseFloat(getComputedStyle(t).fontSize)) === 24
      );
      return { number: n.textContent.trim(), text: body?.textContent ?? '' };
    })
);
log(`  cards: ${JSON.stringify(cards.map((c) => c.number + ':' + c.text.slice(0, 24)))}`);

const FIELDS = { 1: 'respostaUm', 2: 'respostaDois', 3: 'respostaTres', 4: 'respostaQuatro' };
const question = QUESTIONS.pt.find((q) => cards.every((c) => Object.values(FIELDS).some((f) => q[f] === c.text)));
if (!question) throw new Error('could not identify the question from the rendered answers');
const correctText = question[FIELDS[question.gabarito]];
log(`  question "${question.nome}" gabarito=${question.gabarito} -> ${JSON.stringify(correctText.slice(0, 40))}`);

const target = cards.find((c) => c.text === correctText);
if (!target) throw new Error('correct answer is not on screen');
log(`  clicking card ${target.number}`);
await page.evaluate((wanted) => {
  const hit = [...document.querySelectorAll('#pages .ff-text')].find(
    (n) => Math.round(parseFloat(getComputedStyle(n).fontSize)) === 24 && n.textContent === wanted
  );
  hit.closest('.ff-stack').querySelector('.ff-inkwell').click();
}, correctText);
await wait(1000);
await clickText('Confirmar', '#overlays');
await waitForRoute('Ganhou', 20000);
await wait(4800);
await shot('08-ganhou');
log('  reached Ganhou');

const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('tecgame:usuarios') || '[]'));
const winner = rows.find((r) => r.nome === 'Vencedor');
log(`  stored: ${JSON.stringify(winner)}`);
if (!winner?.venceu) throw new Error('win was not recorded');

const podium = await page.evaluate(() =>
  [...document.querySelectorAll('#pages .ff-text')].map((n) => n.textContent.trim()).filter((t) => /^\d - $|Ana|Carla|Vencedor/.test(t))
);
log(`  podium text nodes: ${JSON.stringify(podium)}`);

await browser.close();
if (errors.length) {
  console.log('\nERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('\npass 2 clean');
