// O equipamento escolhido e o vídeo demonstrativo (3.1).
//
//  1. a escolha mostra os SEIS equipamentos, e o Rasther 4 com o cartão dele —
//     ele existia no Dart, mas nenhuma tela o mostrava, e a imagem era a do 3S;
//  2. o Rasther 4 não tem vídeo demonstrativo: vai direto para a pergunta, com
//     RASTHER 4 na etiqueta "Você está usando" (cair no vídeo padrão mostraria o
//     3S como se fosse ele);
//  3. sem a marca do painel, um equipamento com vídeo passa pelo vídeo;
//  4. a marca "Pular o vídeo demonstrativo do equipamento", na aba
//     Configurações do painel, fica guardada no navegador e tira o vídeo do
//     caminho de todos.
import fs from 'node:fs';
import puppeteer from 'puppeteer';

const OUT = process.env.OUT ?? 'shots/equipamento';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
const LOCAL_FILE = BASE.startsWith('file:');
const raiz = BASE.endsWith('.html') ? BASE.replace(/[^/]+$/, '') : `${BASE}/`;
const urlJogo = (rota) => `${raiz}index.html#${rota}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
const falhas = [];
page.on('pageerror', (e) => falhas.push('pageerror: ' + e.message));
page.on('console', (m) => {
  // Por file:// o boot por módulo falha de propósito e cai no bundle; o vídeo
  // demonstrativo aponta para um bucket que responde 402 (ver config.js).
  if (m.type() === 'error' && !(LOCAL_FILE && /js\/main\.js|net::ERR_FAILED/.test(m.text())) && !/402|videoScanners/.test(m.text())) {
    falhas.push('console: ' + m.text());
  }
});
const log = console.log;
const conferir = (ok, msg) => {
  log(`  ${ok ? 'ok' : 'FALHOU'} - ${msg}`);
  if (!ok) falhas.push(msg);
};

const rota = () => page.evaluate(() => document.querySelector('.ff-page')?.dataset.route ?? null);
async function esperarRota(nome, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if ((await rota()) === nome) return true;
    await wait(150);
  }
  return false;
}

/**
 * Leva o jogo à escolha do equipamento, com a pergunta em vigor resolvível
 * pelo Rasther 4 / ST (a marca `rasher4`), e passa a anotar toda tela que
 * entrar — é como se prova que o vídeo NÃO apareceu no meio.
 */
async function irParaAEscolha() {
  await page.evaluate(async () => {
    const carregar = async (m) => (window.__tecgameRequire ? window.__tecgameRequire(m) : await import(`./js/${m}`));
    const { FFAppState } = await carregar('state.js');
    const { goNamed } = await carregar('router.js');
    FFAppState.questoesBrasil[FFAppState.indiceAtual].rasher4 = true;
    window.__rotas = [];
    window.__vigia?.disconnect();
    window.__vigia = new MutationObserver((mudancas) => {
      for (const m of mudancas) for (const n of m.addedNodes) if (n.dataset?.route) window.__rotas.push(n.dataset.route);
    });
    window.__vigia.observe(document.getElementById('pages'), { childList: true });
    goNamed('scanner');
  });
  await esperarRota('scanner');
  // Os seis pousam um a um; o último assenta em ~1,4 s.
  await wait(1600);
}

async function escolher(ferramenta) {
  await page.evaluate((f) => document.querySelector(`#pages .eq-stack[data-ferramenta="${f}"] .ff-inkwell`).click(), ferramenta);
}

await page.goto(urlJogo('/cadastro'), { waitUntil: 'networkidle2' });
await page.evaluate(() => localStorage.removeItem('tecgame:scanner.pularVideo'));
await page.reload({ waitUntil: 'networkidle2' });

/* ------------------------------------------------------ 1. os seis ------ */
log('--- 1. a escolha mostra os seis, com o Rasther 4');
await irParaAEscolha();
const naTela = await page.evaluate(() =>
  [...document.querySelectorAll('#pages .eq-stack')].map((n) => ({
    f: n.dataset.ferramenta,
    img: n.querySelector('img')?.getAttribute('src') ?? '',
    carregou: (n.querySelector('img')?.naturalWidth ?? 0) > 0,
  }))
);
log(`  ${JSON.stringify(naTela.map((c) => c.f))}`);
conferir(naTela.length === 6, `seis equipamentos na tela (${naTela.length})`);
const r4 = naTela.find((c) => c.f === '4s');
conferir(r4 && /Rasther_4_Claro\.png$/.test(r4.img) && r4.carregou, `o Rasther 4 tem o cartão dele, e ele carregou (${r4?.img})`);
conferir(new Set(naTela.map((c) => c.img)).size === 6, 'nenhum cartão repete a imagem de outro');
await page.screenshot({ path: `${OUT}/01-escolha.png` });

/* ------------------------------------------- 2. o Rasther 4 vai direto -- */
log('--- 2. o Rasther 4 não tem vídeo: vai direto para a pergunta');
await escolher('4s');
conferir(await esperarRota('telaAcao', 15000), 'chegou na pergunta');
const etiqueta = await page.evaluate(() => {
  const chip = document.querySelector('#pages .aud-os-chip');
  return { equipamento: chip?.dataset.equipamento, texto: chip?.textContent ?? '', foto: chip?.querySelector('img')?.getAttribute('src') ?? '' };
});
const passou = await page.evaluate(() => window.__rotas);
log(`  telas: ${JSON.stringify(passou)}; etiqueta: ${JSON.stringify(etiqueta)}`);
conferir(!passou.includes('telaVideoScanner'), 'sem passar pelo vídeo demonstrativo');
conferir(etiqueta.equipamento === 'Rasther 4' && /RASTHER 4/.test(etiqueta.texto) && /Rasther_4/.test(etiqueta.foto), 'a etiqueta diz RASTHER 4, com a foto dele');

/* -------------------------------------- 3. com vídeo, passa pelo vídeo --- */
log('--- 3. sem a marca do painel, o Rasther ST passa pelo vídeo');
await irParaAEscolha();
await escolher('rts');
conferir(await esperarRota('telaVideoScanner', 15000), 'o Rasther ST abriu o vídeo demonstrativo');

/* ------------------------------------------ 4. a marca do painel -------- */
log('--- 4. "Pular o vídeo demonstrativo" no painel');
// A porta é aberta de um cadastro recém-carregado, como o operador faz: vindo
// direto da tela do vídeo, com a suíte em paralelo, o painel às vezes passava
// dos 10 s para se montar por file://.
await page.goto(urlJogo('/cadastro'), { waitUntil: 'networkidle2' });
await page.reload({ waitUntil: 'networkidle2' });
await page.goto(urlJogo('/adm'), { waitUntil: 'networkidle2' });
await wait(700);
const porta = await page.$('.porta-campo');
if (porta) {
  await porta.type('2040');
  await page.evaluate(() => document.querySelector('.porta-botao--ok').click());
}
// A marca mora na aba Configurações desde a 3.3 (era o "Na feira", no pé da
// lista de veículos).
await page.waitForSelector('#adm .aba-painel[data-aba="config"]', { timeout: 20000 }).then((h) => h.dispose());
await page.evaluate(() => document.querySelector('#adm .aba-painel[data-aba="config"]').click());
await page.waitForSelector('#adm [data-campo="pular-video"] input', { timeout: 20000 }).then(
  (h) => h.dispose(),
  async (erro) => {
    await page.screenshot({ path: `${OUT}/falhou-painel.png` });
    log(`  painel: ${JSON.stringify(await page.evaluate(() => ({ rota: location.hash, adm: document.querySelector('#adm')?.innerText.slice(0, 200) ?? null, porta: Boolean(document.querySelector('.porta-campo')) })))}`);
    throw erro;
  }
);
const antes = await page.evaluate(() => document.querySelector('#adm [data-campo="pular-video"] input').checked);
await page.evaluate(() => document.querySelector('#adm [data-campo="pular-video"] input').click());
const guardado = await page.evaluate(() => localStorage.getItem('tecgame:scanner.pularVideo'));
conferir(antes === false && guardado === '1', `a marca nasce desmarcada e, marcada, fica guardada (${antes} -> ${guardado})`);

// Recarregar prova que vale da memória do navegador, e não do painel aberto.
await page.goto(urlJogo('/cadastro'), { waitUntil: 'networkidle2' });
await page.reload({ waitUntil: 'networkidle2' });
await irParaAEscolha();
await escolher('rts');
conferir(await esperarRota('telaAcao', 15000), 'com a marca, o Rasther ST foi direto para a pergunta');
conferir(!(await page.evaluate(() => window.__rotas)).includes('telaVideoScanner'), 'sem o vídeo no meio');

await browser.close();
if (falhas.length) {
  console.log('\nFALHOU:\n- ' + falhas.join('\n- '));
  process.exit(1);
}
console.log('\nequipamento: seis na escolha, o Rasther 4 sem vídeo, e o vídeo opcional pelo painel');
