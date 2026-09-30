// A tela da pergunta com cara de auditório (3.0), afirmada contra a tela.
//
//  1. "Posso perguntar?": o relógio NÃO corre antes do PODE! — antes ele
//     começava com as alternativas ainda entrando;
//  2. a faixa ACERTAR AGORA diz a posição e a folga que o ranking dá;
//  3. o teclado joga: 1–4 trava, Esc desiste, Enter confirma;
//  4. a certa ALTERNA travada ↔ verde, amostrada no tempo — período de ~0,4s,
//     três vezes, e assenta no verde (medido no programa; abaixo das 3
//     piscadas/s do WCAG);
//  5. a partida grava `perguntaId` e `alternativa` (o número ORIGINAL da
//     resposta, e não a posição na tela);
//  6. Cartas: o 3 tira três erradas e nunca a certa;
//  7. Placas: a porcentagem na tela é a dos votos gravados, na ordem da tela;
//  8. os dois estilos se desenham (e a foto de cada um fica em OUT);
//  9. a Pergunta do Milhão: sem ajudas, e não entra no ranking.
import fs from 'node:fs';
import puppeteer from 'puppeteer';
import { alternativasNaTela, esperarEstado, estadoDaPergunta, passarDaAbertura, posicaoDaCerta, responder } from './_jogo.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
const OUT = process.env.OUT ?? 'shots/pergunta';
fs.mkdirSync(OUT, { recursive: true });
const LOCAL_FILE = BASE.startsWith('file:');
const pageUrl = (route, busca = '') => (BASE.endsWith('.html') ? `${BASE}${busca}#${route}` : `${BASE}/${busca}#${route}`);
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

/** Um ranking conhecido: 52s, 41s e 30s sobrando no relógio. */
const RANKING = [
  { nome: 'Ana', venceu: true, tempo: 52000 },
  { nome: 'Bruno', venceu: true, tempo: 41000 },
  { nome: 'Carla', venceu: true, tempo: 30000 },
];

async function abrirPergunta({ busca = '', semear = null } = {}) {
  await page.goto(pageUrl('/cadastro', busca), { waitUntil: 'networkidle2' });
  await page.evaluate(
    (ranking, extra) => {
      localStorage.clear();
      localStorage.setItem('tecgame:usuarios', JSON.stringify([...ranking, ...(extra ?? [])]));
    },
    RANKING,
    semear
  );
  await page.goto(pageUrl('/telaAcao', busca), { waitUntil: 'networkidle2' });
}

const relogio = () => page.evaluate(() => document.querySelector('#pages .aud-taco-leitura')?.textContent ?? null);

/* ------------------------------------------------ 1. posso perguntar? ---- */
log('--- 1. o relógio espera o PODE!');
await abrirPergunta();
await esperarEstado(page, 'posso', 25000);
const antes = await relogio();
await wait(2000);
const depois = await relogio();
conferir(antes === '60,0' && depois === '60,0', `parado no "Posso perguntar?": ${antes} e, 2s depois, ${depois}`);
await page.screenshot({ path: `${OUT}/01-posso-classico.png` });
await passarDaAbertura(page);
await wait(1200);
const correndo = await relogio();
conferir(correndo !== '60,0', `depois do PODE! o relógio corre (${correndo})`);
await page.screenshot({ path: `${OUT}/02-jogando-classico.png` });

/* ------------------------------------------------- 2. a faixa ----------- */
log('--- 2. ACERTAR AGORA');
// O relógio é lido JUNTO com a faixa, no mesmo evaluate. Comparar com o
// `correndo` lá de cima errava pelo tempo da captura de tela no meio (~1,7s
// com a suíte em paralelo), e a folga certa parecia errada.
const faixa = await page.evaluate(() => ({
  posicao: document.querySelector('#pages .aud-ap-caixa--acertar .aud-ap-rolo')?.textContent ?? null,
  recorde: document.querySelector('#pages .aud-ap-caixa--recorde')?.textContent ?? null,
  folga: document.querySelector('#pages .aud-ap-barra span')?.textContent ?? null,
  relogio: document.querySelector('#pages .aud-taco-leitura')?.textContent ?? null,
}));
log(`  faixa: ${JSON.stringify(faixa)}`);
conferir(faixa.posicao === '1º', 'com ~58s sobrando, o jogador entraria em 1º (a Ana tem 52s)');
conferir(/8,0 s/.test(faixa.recorde ?? '') && /ANA/.test(faixa.recorde ?? ''), 'o recorde é o da Ana, 8,0 s');
// A folga do 1º lugar é o que falta para o relógio descer aos 52s da Ana.
const folga = Number.parseFloat((faixa.folga ?? '').match(/(\d+,\d) s/)?.[1]?.replace(',', '.') ?? 'NaN');
const sobra = Number.parseFloat((faixa.relogio ?? '').replace(',', '.'));
conferir(Math.abs(folga - (sobra - 52)) < 0.6, `a folga (${folga}s) é o que sobra acima dos 52s da Ana (~${(sobra - 52).toFixed(1)}s)`);

/* ------------------------------------------------- 3. o teclado --------- */
log('--- 3. teclado');
await page.keyboard.press('2');
await wait(400);
conferir((await estadoDaPergunta(page)) === 'travando', 'a tecla 2 trava a segunda alternativa');
conferir(
  await page.evaluate(() => document.querySelector('#pages [data-alternativa="1"]').classList.contains('travada')),
  'a segunda alternativa está travada'
);
await page.keyboard.press('Escape');
await wait(400);
conferir((await estadoDaPergunta(page)) === 'jogando', 'Esc desiste do "Está certo disso?"');

/* --------------------------------- 4 e 5. a certa pisca, a partida grava -- */
log('--- 4. a revelação da certa, amostrada');
const certa = await posicaoDaCerta(page);
await page.keyboard.press(String(certa + 1));
await wait(400);
await page.keyboard.press('Enter');
// O suspense (2,6s) e o fôlego; a amostragem começa antes do veredito.
//
// Cada amostra guarda a opacidade do verde E o instante da própria piscada
// (`currentTime` da animação de 1,2s) em que ela foi lida. Medir o intervalo
// entre trocas pelo relógio da página não aguentava a suíte em paralelo: a
// thread principal trava ~600ms no veredito (confete, ranking, som), o
// `setInterval` perde trocas e depois conta duas em 51ms. Pelo tempo da
// animação, um travamento só tira amostras — cada uma que fica continua
// dizendo se a tela mostrava a cor que aquele instante manda.
const amostras = await page.evaluate(
  (k) =>
    new Promise((ok) => {
      const verde = document.querySelector(`#pages [data-alternativa="${k}"] .l-verde`);
      const lista = [];
      const t0 = performance.now();
      const id = setInterval(() => {
        const piscada = verde.getAnimations().find((a) => a.effect?.getTiming().duration === 1200);
        lista.push({ o: Number(getComputedStyle(verde).opacity), a: piscada ? Number(piscada.currentTime) : null });
        if (performance.now() - t0 > 5200) {
          clearInterval(id);
          ok(lista);
        }
      }, 25);
    }),
  certa
);
const MEIA_VOLTA = 200;
// Colado numa divisa, arredondamento de 1ms decide a cor; essas não contam.
const naPiscada = amostras.filter((s) => s.a != null && s.a < 1200 && Math.min(s.a % MEIA_VOLTA, MEIA_VOLTA - (s.a % MEIA_VOLTA)) > 3);
const fora = naPiscada.filter((s) => s.o !== (Math.floor(s.a / MEIA_VOLTA) % 2 === 0 ? 1 : 0));
log(`  ${naPiscada.length} amostras dentro da piscada, ${fora.length} fora do compasso de ${MEIA_VOLTA}ms`);
conferir(naPiscada.some((s) => s.o === 0) && naPiscada.some((s) => s.o === 1), 'a certa alterna travada ↔ verde');
conferir(
  naPiscada.length >= 6 && fora.length === 0,
  'cada meia volta dura 0,2s (período de 0,4s, abaixo das 3 piscadas/s do WCAG)' + (fora.length ? `: ${JSON.stringify(fora.slice(0, 3))}` : '')
);
conferir(amostras[amostras.length - 1].o === 1, 'e assenta no verde');
await page.screenshot({ path: `${OUT}/03-certa-resposta.png` });

log('--- 5. o que a partida grava');
const gravado = await page.evaluate(async () => {
  const carregar = async (nome) => (window.__tecgameRequire ? window.__tecgameRequire(nome) : await import(`./js/${nome}`));
  const { FFAppState } = await carregar('state.js');
  const pt = FFAppState.questoesBrasil[FFAppState.indiceAtual];
  return { linha: JSON.parse(localStorage.getItem('tecgame:usuarios')).slice(-1)[0], id: pt.id, gabarito: pt.gabarito };
});
log(`  ${JSON.stringify(gravado)}`);
conferir(gravado.linha.perguntaId === gravado.id, 'grava o id da pergunta que caiu');
conferir(String(gravado.linha.alternativa) === String(gravado.gabarito), 'grava o número ORIGINAL da resposta escolhida (a certa = o gabarito)');
conferir(gravado.linha.venceu === true && gravado.linha.tempo > 0 && gravado.linha.tempo <= 60000, 'venceu, com o tempo dentro do relógio');

// O ranking abriu espaço para o jogador: a linha dele entra marcada.
await page.waitForSelector('#pages [data-eu]', { timeout: 12000 }).catch(() => {});
conferir(Boolean(await page.$('#pages [data-eu]')), 'o jogador entra no ranking do resultado');
await page.screenshot({ path: `${OUT}/04-resultado.png` });

/* ------------------------------------------------------------ 6. cartas --- */
log('--- 6. Cartas: o 3 tira três erradas, e nunca a certa');
await abrirPergunta();
await passarDaAbertura(page);
await page.evaluate(() => document.querySelector('#pages [data-ajuda="cartas"]').click());
await page.waitForSelector('[data-carta="3"]', { timeout: 5000 });
await wait(700);
await page.evaluate(() => document.querySelector('[data-carta="3"]').click());
await wait(1600);
const aposCartas = await alternativasNaTela(page);
const certaDasCartas = await posicaoDaCerta(page);
const sobraram = aposCartas.filter((a) => !a.eliminada).map((a) => a.i);
log(`  sobraram ${JSON.stringify(sobraram)}; a certa é ${certaDasCartas}`);
conferir(sobraram.length === 1 && sobraram[0] === certaDasCartas, 'sobrou só a certa');
await page.screenshot({ path: `${OUT}/05-cartas.png` });
// O cartão das Cartas fecha sozinho; depois, a tecla de uma que saiu de cena
// não pode travar nada.
await esperarEstado(page, 'jogando', 6000);
const tirada = aposCartas.find((a) => a.eliminada)?.i ?? 0;
await page.keyboard.press(String(tirada + 1));
await wait(300);
conferir((await estadoDaPergunta(page)) === 'jogando', 'a tecla de uma alternativa que as Cartas tiraram não trava nada');

/* ------------------------------------------------------------ 7. placas --- */
log('--- 7. Placas: a porcentagem dos votos gravados, na ordem da tela');
// A pergunta que vai cair (a do veículo do `escolha` inicial) e 6 votos nela:
// 3 na resposta 1, 2 na 2, 1 na 4.
await page.goto(pageUrl('/cadastro'), { waitUntil: 'networkidle2' });
const idDaPergunta = await page.evaluate(async () => {
  const carregar = async (nome) => (window.__tecgameRequire ? window.__tecgameRequire(nome) : await import(`./js/${nome}`));
  const { FFAppState } = await carregar('state.js');
  return FFAppState.questoesBrasil[FFAppState.indiceAtual].id;
});
const votos = [1, 1, 1, 2, 2, 4].map((alternativa) => ({ nome: 'X', venceu: false, perguntaId: idDaPergunta, alternativa }));
await abrirPergunta({ semear: votos });
await passarDaAbertura(page);
await page.evaluate(() => document.querySelector('#pages [data-ajuda="placas"]').click());
await page.waitForSelector('[data-placa="3"]', { timeout: 6000 });
await wait(1200);
const placas = await page.evaluate(async () => {
  const carregar = async (nome) => (window.__tecgameRequire ? window.__tecgameRequire(nome) : await import(`./js/${nome}`));
  const { FFAppState } = await carregar('state.js');
  return {
    ordem: [...FFAppState.ordemNumeros],
    naTela: [0, 1, 2, 3].map((i) => document.querySelector(`[data-placa="${i}"] b`)?.textContent ?? null),
  };
});
const esperado = placas.ordem.map((n) => `${{ 1: 50, 2: 33, 3: 0, 4: 17 }[n]}%`);
log(`  ordem ${JSON.stringify(placas.ordem)} -> na tela ${JSON.stringify(placas.naTela)}, esperado ${JSON.stringify(esperado)}`);
conferir(JSON.stringify(placas.naTela) === JSON.stringify(esperado), 'cada placa mostra os votos da resposta que está naquela posição');
await page.screenshot({ path: `${OUT}/06-placas.png` });

/* ------------------------------------------------------- 8. os dois estilos */
log('--- 8. estilo Palco');
await abrirPergunta({ busca: '?estilo=palco' });
await passarDaAbertura(page);
const palco = await page.evaluate(() => ({
  estilo: document.querySelector('.pg-auditorio')?.dataset.estiloPergunta,
  palcoDoStage: document.getElementById('stage').dataset.estilo,
  alternativas: document.querySelectorAll('#pages [data-alternativa]').length,
}));
log(`  ${JSON.stringify(palco)}`);
conferir(palco.estilo === 'palco' && palco.palcoDoStage === 'palco' && palco.alternativas === 4, 'o estilo Palco se desenha inteiro');
await page.screenshot({ path: `${OUT}/07-jogando-palco.png` });
await responder(page, (await posicaoDaCerta(page)) === 0 ? 1 : 0);
await wait(5200);
await page.screenshot({ path: `${OUT}/08-licao-palco.png` });
conferir(Boolean(await page.$('[data-painel="licao"]')), 'quem erra recebe a lição');

/* ------------------------------------------------ 9. a pergunta do milhão -- */
log('--- 9. a Pergunta do Milhão');
await page.goto(pageUrl('/cadastro'), { waitUntil: 'networkidle2' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('tecgame:usuarios', JSON.stringify([{ nome: 'Ana', venceu: true, tempo: 52000, data: new Date().toISOString() }]));
});
await page.goto(pageUrl('/milhao'), { waitUntil: 'networkidle2' });
await passarDaAbertura(page);
const milhao = await page.evaluate(() => ({
  fichas: document.querySelectorAll('#pages [data-ajuda]').length,
  aposta: document.querySelector('#pages [data-aposta]')?.dataset.aposta,
  humor: document.getElementById('stage').dataset.humor,
}));
log(`  ${JSON.stringify(milhao)}`);
conferir(milhao.fichas === 0, 'sem ajudas');
conferir(milhao.aposta === 'milhao', 'a faixa vale brinde, e não posição');
await page.screenshot({ path: `${OUT}/09-milhao.png` });
await responder(page, 0);
await wait(4000);
const depoisDoMilhao = await page.evaluate(() => ({
  usuarios: JSON.parse(localStorage.getItem('tecgame:usuarios') || '[]').length,
  milhao: JSON.parse(localStorage.getItem('tecgame:milhao') || '[]'),
}));
log(`  ${JSON.stringify(depoisDoMilhao)}`);
conferir(depoisDoMilhao.usuarios === 1, 'não entrou no ranking');
conferir(depoisDoMilhao.milhao.length === 1 && depoisDoMilhao.milhao[0].nome === 'Ana', 'ficou guardada à parte, com o nome do mais rápido do dia');

await browser.close();
if (falhas.length) {
  console.log('\nFALHOU:\n- ' + falhas.join('\n- '));
  process.exit(1);
}
console.log('\npergunta: o roteiro do auditório, a revelação, as ajudas novas e a Pergunta do Milhão');
