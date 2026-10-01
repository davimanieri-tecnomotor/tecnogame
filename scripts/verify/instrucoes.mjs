// "Como funciona o jogo" (3.1): a captura da pergunta num monitor, e os passos.
//
//  1. a captura carrega — nos dois transportes: um caminho que funciona no
//     HTTP e quebra no disco já passou por aqui uma vez (ver o CLAUDE.md);
//  2. os cinco passos chegam um a um, e cada um acende na captura a peça de que
//     fala, na mesma cor — o passo do ranking não tem peça a acender;
//  3. cada destaque cai DENTRO da captura (as regiões são medidas à mão; uma
//     mudança na tela da pergunta as deixaria apontando para o nada);
//  4. a tela segue sozinha para a vinheta em 15 s.
//
// O "Pular instruções" é do verify:play, que o clica no caminho de toda partida.
import fs from 'node:fs';
import puppeteer from 'puppeteer';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
const OUT = process.env.OUT ?? 'shots/instrucoes';
fs.mkdirSync(OUT, { recursive: true });
const LOCAL_FILE = BASE.startsWith('file:');
const pageUrl = (rota) => (BASE.endsWith('.html') ? `${BASE}#${rota}` : `${BASE}/#${rota}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
const falhas = [];
page.on('pageerror', (e) => falhas.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !(LOCAL_FILE && /js\/main\.js|net::ERR_FAILED/.test(m.text()))) falhas.push('console: ' + m.text());
});
const log = console.log;
const conferir = (ok, msg) => {
  log(`  ${ok ? 'ok' : 'FALHOU'} - ${msg}`);
  if (!ok) falhas.push(msg);
};

await page.goto(pageUrl('/cadastro'), { waitUntil: 'networkidle2' });
await page.goto(pageUrl('/instrucoes'), { waitUntil: 'networkidle2' });

/* ------------------------------------------------------- 1. a captura --- */
await page.waitForFunction(() => document.querySelector('#pages .ins-tela img')?.complete, { timeout: 8000 }).catch(() => {});
const captura = await page.evaluate(() => {
  const img = document.querySelector('#pages .ins-tela img');
  return { src: img?.getAttribute('src'), largura: img?.naturalWidth ?? 0 };
});
conferir(captura.largura > 0, `a captura da pergunta carregou (${captura.src}, ${captura.largura}px)`);

/* ------------------------------------------------ 2 e 3. os passos ------ */
/** O estado de cada passo e de cada destaque, e se o destaque cabe na captura. */
const estado = () =>
  page.evaluate(() => {
    const tela = document.querySelector('#pages .ins-tela').getBoundingClientRect();
    const passos = [...document.querySelectorAll('#pages [data-passo]')].map((n) => ({
      n: n.dataset.passo,
      visivel: !n.classList.contains('aud-oculta'),
      ativo: n.classList.contains('ins-ativo'),
      cor: n.style.getPropertyValue('--cor'),
    }));
    const destaques = [...document.querySelectorAll('#pages [data-destaque]')].map((n) => {
      const r = n.getBoundingClientRect();
      return {
        n: n.dataset.destaque,
        ativo: n.classList.contains('ins-ativo'),
        cor: n.style.getPropertyValue('--cor'),
        dentro: r.left >= tela.left - 1 && r.top >= tela.top - 1 && r.right <= tela.right + 1 && r.bottom <= tela.bottom + 1 && r.width > 20 && r.height > 20,
      };
    });
    return { passos, destaques };
  });

// Espera cada passo acender, em vez de olhar num instante fixo: com a suíte em
// paralelo a tela pode montar meio segundo depois do `goto`, e o teste lia
// sempre um passo atrás. O que se afirma é a ordem e o que cada um acende.
let t0 = null;
for (let i = 1; i <= 5; i++) {
  const acendeu = await page
    .waitForFunction((k) => document.querySelector(`#pages [data-passo="${k}"]`)?.classList.contains('ins-ativo'), { timeout: 6000 }, i)
    .then((h) => (h.dispose(), true), () => false);
  if (i === 1) t0 = Date.now();
  conferir(acendeu, `o passo ${i} acendeu`);
  await wait(300);
  const e = await estado();
  const ativos = e.passos.filter((p) => p.ativo).map((p) => p.n);
  const destaque = e.destaques.find((d) => d.n === String(i));
  conferir(JSON.stringify(ativos) === JSON.stringify([String(i)]), `com o passo ${i} aceso, só ele está aceso (${JSON.stringify(ativos)})`);
  if (i < 5) {
    conferir(Boolean(destaque?.ativo) && destaque.cor === e.passos[i - 1].cor, `o passo ${i} acende a peça dele na captura, na mesma cor`);
    conferir(Boolean(destaque?.dentro), `o destaque ${i} cai dentro da captura`);
  } else {
    conferir(!e.destaques.some((d) => d.ativo), 'o passo do ranking não acende peça nenhuma');
  }
  if (i === 2) await page.screenshot({ path: `${OUT}/01-passo-2.png` });
}
const fim = await estado();
conferir(fim.passos.every((p) => p.visivel), 'no fim, os cinco passos estão na tela');
await page.screenshot({ path: `${OUT}/02-todos.png` });

/* --------------------------------------------- 4. segue sozinha -------- */
const route = () => page.evaluate(() => document.querySelector('.ff-page')?.dataset.route ?? null);
let rota = await route();
while (rota === 'instrucoes' && Date.now() - t0 < 19000) {
  await wait(200);
  rota = await route();
}
// O passo 1 acende 0,9 s depois de a tela montar, e ela segue aos 15 s: contado
// do passo 1, ~14,1 s.
const quando = (Date.now() - t0) / 1000;
conferir(rota === 'telaVideoTransisao' && quando >= 13.5, `seguiu sozinha para a vinheta ${quando.toFixed(1)} s depois do passo 1 (rota ${rota})`);

await browser.close();
if (falhas.length) {
  console.log('\nFALHOU:\n- ' + falhas.join('\n- '));
  process.exit(1);
}
console.log('\ninstrucoes: a captura carrega, os passos acendem as peças certas e a tela segue sozinha');
