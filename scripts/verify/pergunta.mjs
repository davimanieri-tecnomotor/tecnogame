// A tela da pergunta com cara de auditório (3.0), afirmada contra a tela.
//
//  1. "Posso perguntar?": o relógio NÃO corre antes do PODE! — antes ele
//     começava com as alternativas ainda entrando;
//  2. o tempo na tela é um só, o do cronômetro: a faixa ERRAR / RECORDE /
//     ACERTAR AGORA saiu na 3.1 (o "vale o 1º lugar por mais 6,4 s" dela era
//     lido como o tempo para responder), e os segundos do cronômetro batem com
//     o relógio da pergunta;
//  3. o teclado joga: 1–4 trava, Esc desiste, Enter confirma;
//  4. a certa ALTERNA travada ↔ verde, amostrada no tempo — período de ~0,4s,
//     três vezes, e assenta no verde (medido no programa; abaixo das 3
//     piscadas/s do WCAG);
//  5. a partida grava `perguntaId` e `alternativa` (o número ORIGINAL da
//     resposta, e não a posição na tela);
//  6. Cartas: o 3 tira três erradas e nunca a certa;
//  7. Placas: a porcentagem na tela é a dos votos gravados, na ordem da tela;
//  8. os dois estilos se desenham (e a foto de cada um fica em OUT); quem
//     erra recebe a lição — e a tela de fim não repete a resposta certa;
//  9. a Pergunta do Milhão: sem ajudas, sem faixa, e não entra no ranking.
import fs from 'node:fs';
import puppeteer from 'puppeteer';
import { alternativasNaTela, continuar, esperarEstado, estadoDaPergunta, passarDaAbertura, posicaoDaCerta, responder } from './_jogo.mjs';

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

const relogio = () => page.evaluate(() => document.querySelector('#pages .aud-crono-int')?.textContent ?? null);

/* ------------------------------------------------ 1. posso perguntar? ---- */
log('--- 1. o relógio espera o PODE!');
await abrirPergunta();
await esperarEstado(page, 'posso', 25000);
const antes = await relogio();
await wait(2000);
const depois = await relogio();
conferir(antes === '60' && depois === '60', `parado no "Posso perguntar?": ${antes} e, 2s depois, ${depois}`);
await page.screenshot({ path: `${OUT}/01-posso-classico.png` });
await passarDaAbertura(page);
await wait(1200);
const correndo = await relogio();
conferir(correndo !== '60', `depois do PODE! o relógio corre (${correndo})`);
await page.screenshot({ path: `${OUT}/02-jogando-classico.png` });

/* ------------------------------------------------- 2. um tempo só ------ */
log('--- 2. o cronômetro é o único tempo na tela');
// Os segundos do cronômetro são lidos JUNTO com o relógio de verdade da
// pergunta, no mesmo evaluate: comparar com o `correndo` lá de cima errava pelo
// tempo da captura de tela no meio (~1,7s com a suíte em paralelo).
const tempo = await page.evaluate(async () => {
  const textoDaCena = document.querySelector('#pages .pg-cena')?.textContent ?? '';
  return {
    segundos: Number(document.querySelector('#pages .aud-crono-int')?.textContent),
    anel: document.querySelector('#pages .aud-crono-anel')?.getAttribute('d') ?? '',
    faixa: Boolean(document.querySelector('#pages [data-aposta], #pages .aud-aposta')),
    // Qualquer "s" de segundos fora do cronômetro seria um segundo relógio.
    outrosTempos: textoDaCena.match(/\d+,\d\s?s\b/g) ?? [],
    falaDeLugar: /ACERTAR AGORA|RECORDE|vale o \d/i.test(textoDaCena),
  };
});
log(`  ${JSON.stringify(tempo)}`);
conferir(!tempo.faixa && !tempo.falaDeLugar, 'a faixa ERRAR / RECORDE / ACERTAR AGORA não está mais na tela');
conferir(tempo.outrosTempos.length === 0, `nenhum outro tempo na cena (${JSON.stringify(tempo.outrosTempos)})`);
conferir(tempo.segundos >= 50 && tempo.segundos <= 59, `o cronômetro conta os segundos que faltam (${tempo.segundos})`);
conferir(/^M[\d.]+ [\d.]+A/.test(tempo.anel), 'o anel do cronômetro está desenhado');

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

// A certa é dita na lição; a tela de fim não a repete desde a 3.1, e o
// REINICIAR, que é a única coisa a fazer ali, ficou grande.
const certaNaLicao = await page.evaluate(() => document.querySelector('[data-painel="licao"] .aud-escolhida span')?.textContent ?? '');
await continuar(page, 20000);
const naTelaDeFim = async () => (await page.evaluate(() => document.querySelector('.ff-page')?.dataset.route)) === 'Perdeu';
for (let t = 0; t < 60 && !(await naTelaDeFim()); t++) await wait(200);
await wait(2800);
const fim = await page.evaluate(() => {
  const botao = document.querySelector('#pages [data-acao="reiniciar"]')?.getBoundingClientRect();
  return {
    texto: document.querySelector('#pages .pg-fim')?.innerText ?? '',
    licao: Boolean(document.querySelector('#pages [data-licao]')),
    botao: botao ? [Math.round(botao.width), Math.round(botao.height)] : null,
  };
});
log(`  fim: botão ${JSON.stringify(fim.botao)}, bloco do vídeo ${fim.licao}`);
conferir(certaNaLicao.length > 10 && !fim.texto.includes(certaNaLicao), 'a tela de fim não repete a resposta certa');
conferir(!/RESPOSTA CERTA|VOCÊ RESPONDEU/i.test(fim.texto), 'nem o "A resposta certa" / "Você respondeu"');
conferir(!fim.licao, 'sem link de vídeo na pergunta, não há bloco de QR');
conferir(fim.botao && fim.botao[1] >= 120 && fim.botao[0] >= 520, `o REINICIAR é o botão grande (${JSON.stringify(fim.botao)})`);
await page.screenshot({ path: `${OUT}/08b-fim-perdeu.png` });

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
  faixa: Boolean(document.querySelector('#pages [data-aposta], #pages .aud-aposta')),
  cronometro: Boolean(document.querySelector('#pages .aud-cronometro')),
  humor: document.getElementById('stage').dataset.humor,
}));
log(`  ${JSON.stringify(milhao)}`);
conferir(milhao.fichas === 0, 'sem ajudas');
conferir(!milhao.faixa && milhao.cronometro, 'sem faixa: o tempo é o do cronômetro, como na pergunta normal');
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
