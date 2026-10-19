// O que o Dart centralizava fica no meio do palco.
//
// A roleta e a tela do carro sorteado sao, no Dart, uma Column `max` dentro de
// outra Column centralizada. No Flutter a de fora da altura ILIMITADA ao filho,
// a de dentro encolhe ate o conteudo, e o conteudo vai para o meio. No porte o
// `max` virava 100% da tela e colava tudo no topo: a roleta com 0px em cima e
// 108px embaixo, o carro com a foto encostada no alto e a tela sobrando por
// baixo. Este teste mede o GRUPO do que se ve — a caixa da coluna, cheia, sai
// centralizada de qualquer jeito e nao prova nada.
//
// Com "menos movimento" emulado, porque o carro respira devagar em laco, e um
// respiro no meio da medida seria confundido com o layout.
import fs from 'node:fs';
import puppeteer from 'puppeteer';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
const OUT = process.env.OUT ?? 'shots/centro';
fs.mkdirSync(OUT, { recursive: true });
const pageUrl = (route) => (BASE.endsWith('.html') ? `${BASE}#${route}` : `${BASE}/#${route}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Em px do palco. O layout e exato; sobra so arredondamento de subpixel. */
const FOLGA = 2;

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
const falhas = [];
page.on('pageerror', (e) => falhas.push('pageerror: ' + e.message));

/** A caixa que junta os elementos, em coordenadas do palco. */
const grupo = (seletores) =>
  page.evaluate((seletores) => {
    const palco = document.getElementById('stage').getBoundingClientRect();
    const caixas = seletores.map((s) => {
      const n = s.startsWith('texto:')
        ? [...document.querySelectorAll('#pages .ff-text')].find((t) => t.textContent.trim() === s.slice(6))
        : document.querySelector(s);
      return n?.getBoundingClientRect() ?? null;
    });
    if (caixas.some((c) => !c)) return null;
    return {
      topo: Math.min(...caixas.map((c) => c.top)) - palco.top,
      base: Math.max(...caixas.map((c) => c.bottom)) - palco.top,
      esquerda: Math.min(...caixas.map((c) => c.left)) - palco.left,
      direita: Math.max(...caixas.map((c) => c.right)) - palco.left,
    };
  }, seletores);

function conferir(rotulo, g) {
  if (!g) {
    falhas.push(`${rotulo}: nao achou o que medir`);
    return;
  }
  const acima = g.topo;
  const abaixo = 1080 - g.base;
  const meio = (g.esquerda + g.direita) / 2;
  console.log(
    `${rotulo}: ${acima.toFixed(1)}px acima, ${abaixo.toFixed(1)}px abaixo, meio em x=${meio.toFixed(1)}`
  );
  if (Math.abs(acima - abaixo) > FOLGA) {
    falhas.push(`${rotulo}: ${acima.toFixed(0)}px acima e ${abaixo.toFixed(0)}px abaixo — fora do meio`);
  }
  if (Math.abs(meio - 960) > FOLGA) falhas.push(`${rotulo}: o meio caiu em x=${meio.toFixed(0)}, e nao em 960`);
}

await page.goto(pageUrl('/cadastro'), { waitUntil: 'networkidle2' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle2' });
await wait(1500);

// A roleta: a roda e o botao de girar, como um bloco so.
await page.goto(pageUrl('/roleta'), { waitUntil: 'networkidle2' });
await wait(2200);
await page.screenshot({ path: `${OUT}/roleta.png` });
conferir(
  'roleta',
  await grupo([
    '.roleta-eixo',
    // O botao e o InkWell que contem o texto.
    '#pages .ff-inkwell:has(.ff-text)',
  ])
);

// O carro sorteado: a foto e o nome. Dois veiculos, porque ha dois tamanhos de
// foto no baralho de fabrica (674 e 781 de altura), e o que centraliza um tem
// de centralizar o outro.
for (const k of [0, 7]) {
  const nome = await page.evaluate(async (k) => {
    const carregar = async (m) => (window.__tecgameRequire ? window.__tecgameRequire(m) : await import(`./js/${m}`));
    const { FFAppState } = await carregar('state.js');
    const { voltaDoIndice } = await carregar('functions.js');
    FFAppState.escolha = voltaDoIndice(k, FFAppState.totalSlots);
    // `go` reconstroi a tela mesmo quando ela ja e a atual.
    await (await carregar('router.js')).go('/carro');
    return FFAppState.slotAtual?.veiculo?.nome;
  }, k);
  await wait(2200);
  await page.screenshot({ path: `${OUT}/carro-${k}.png` });
  // Desde a 3.0 o nome vem numa placa Mercosul: o grupo é a foto e a placa
  // INTEIRA (a faixa azul e a borda contam na altura), e a placa tem de dizer
  // o nome do veículo sorteado.
  const naPlaca = await page.evaluate(() => document.querySelector('#pages .aud-placa-texto')?.textContent ?? null);
  if (naPlaca !== nome) falhas.push(`a placa diz ${JSON.stringify(naPlaca)}, o veículo é ${JSON.stringify(nome)}`);
  conferir(`carro ${nome}`, await grupo(['#pages .ff-carro-respira', '#pages .aud-placa']));
}

// Nome comprido: o nome é texto livre do painel (já houve pergunta inteira no
// lugar do veículo). A placa tem de quebrar em linhas e ficar dentro do palco;
// antes ela crescia até os 1920px e o fim do nome era aparado em silêncio.
await page.evaluate(async () => {
  const carregar = async (m) => (window.__tecgameRequire ? window.__tecgameRequire(m) : await import(`./js/${m}`));
  const { FFAppState } = await carregar('state.js');
  FFAppState.baralho.slots.forEach((s) => (s.veiculo.nome = 'Qual é a função principal de uma transmissão automática?'));
  await (await carregar('router.js')).go('/carro');
});
await wait(2200);
const placaLonga = await page.evaluate(() => {
  const placa = document.querySelector('#pages .aud-placa');
  const texto = placa.querySelector('.aud-placa-texto');
  const r = placa.getBoundingClientRect();
  const palco = document.getElementById('stage').getBoundingClientRect();
  return { esquerda: r.left - palco.left, direita: r.right - palco.left, cortado: texto.scrollWidth > texto.clientWidth + 1 };
});
if (placaLonga.cortado) falhas.push('a placa de nome longo corta o fim do nome');
if (placaLonga.esquerda < 40 || placaLonga.direita > 1880) {
  falhas.push(`a placa de nome longo vai de ${placaLonga.esquerda.toFixed(0)} a ${placaLonga.direita.toFixed(0)}px — encosta nas bordas do palco`);
}

// A mesma placa na tela da pergunta, onde ela mora numa caixa de 560px logo
// acima da faixa de ajudas. "Mercedes Accelo 917" é nome de FÁBRICA e já passa
// dos 560 numa linha só: o teto de `100%` que a correção do nome longo pôs ali o
// quebrava em duas linhas, e a segunda caía em cima de "AJUDAS". Por isso o
// nome de fábrica entra na lista, e não só os compridos.
for (const nome of ['Mercedes Accelo 917', 'Trocar o óleo do câmbio', 'Qual é a função principal de uma transmissão automática?']) {
  await page.evaluate(async (nome) => {
    const carregar = async (m) => (window.__tecgameRequire ? window.__tecgameRequire(m) : await import(`./js/${m}`));
    const { FFAppState } = await carregar('state.js');
    FFAppState.baralho.slots.forEach((s) => (s.veiculo.nome = nome));
    FFAppState.escolha = 1.0;
    FFAppState.scannerEscolhido = 'Rasther 3';
    await (await carregar('router.js')).go('/telaAcao');
  }, nome);
  await wait(2200);
  const m = await page.evaluate(() => {
    const palco = document.getElementById('stage').getBoundingClientRect();
    const placa = document.querySelector('#pages .aud-placa');
    const texto = placa?.querySelector('.aud-placa-texto');
    const ajudas = document.querySelector('#pages .aud-aj-titulo');
    if (!placa || !ajudas) return null;
    const p = placa.getBoundingClientRect();
    return {
      base: p.bottom - palco.top,
      esquerda: p.left - palco.left,
      direita: p.right - palco.left,
      ajudasTopo: ajudas.getBoundingClientRect().top - palco.top,
      cortado: texto.scrollWidth > texto.clientWidth + 1,
    };
  });
  if (!m) {
    falhas.push(`pergunta com "${nome}": nao achou a placa ou a faixa de ajudas`);
    continue;
  }
  if (m.base > m.ajudasTopo) falhas.push(`pergunta com "${nome}": a placa desce até ${m.base.toFixed(0)}px e a faixa de ajudas começa em ${m.ajudasTopo.toFixed(0)}px`);
  if (m.cortado) falhas.push(`pergunta com "${nome}": a placa corta o fim do nome`);
  if (m.esquerda < 40 || m.direita > 1880) falhas.push(`pergunta com "${nome}": a placa vai de ${m.esquerda.toFixed(0)} a ${m.direita.toFixed(0)}px`);
}

await browser.close();
if (falhas.length) {
  console.log('\nFALHOU:\n- ' + falhas.join('\n- '));
  process.exit(1);
}
console.log('\ncentro: roleta e carro sorteado no meio do palco, como no Dart');
