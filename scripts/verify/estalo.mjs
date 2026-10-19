// O estalo da roleta cai na divisa.
//
// A roda estala uma vez por divisa que cruza a seta. Antes disto tocava junto
// uma gravação com ritmo próprio — 82 estalos numa curva que não era a da roda
// —, e esticá-la para durar o giro só trocou um compasso errado por outro. Este
// teste gira a roda de verdade e confere, contra a própria tela, que:
//
//  1. a gravação não toca mais;
//  2. o som é o estalo gravado (estalo.js), e não silêncio nem ruído;
//  3. há um estalo por divisa que a tela mostra passando, tantos quantos o
//     sorteio manda;
//  4. o ritmo é o da tela: o intervalo entre dois estalos seguidos é o
//     intervalo entre as duas divisas passando, estalo por estalo;
//  5. e cada estalo cai no instante da sua divisa, e não um quadro depois.
//
// A tela é lida a cada quadro, do `transform` que o disco está pintando, e o
// instante em que cada divisa passa é interpolado entre dois quadros. O som é
// lido de onde o jogo o marca: o `start()` de cada estalo, no relógio do áudio.
import fs from 'node:fs';
import puppeteer from 'puppeteer';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
const OUT = process.env.OUT ?? 'shots/estalo';
fs.mkdirSync(OUT, { recursive: true });
const pageUrl = (route) => (BASE.endsWith('.html') ? `${BASE}#${route}` : `${BASE}/#${route}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Folgas, em ms. Medido em cinco giros, pelos dois transportes, o jogo erra por
 * até 1ms no ritmo e 2ms no instante — o pior cai nos primeiros estalos,
 * marcados com a ponte entre os relógios ainda pouco medida. O estalo disparado
 * no quadro seguinte à divisa, como numa versão anterior, errou aqui 12,7ms e
 * 15,3ms.
 */
const FOLGA_RITMO = 4;
const FOLGA_INSTANTE = 6;

const browser = await puppeteer.launch({
  headless: true,
  // O toque deste teste é um `click()` de script, que não conta como gesto, e
  // sem gesto o Chrome segura o áudio suspenso. O totem tem dedo; aqui a
  // política sai do caminho.
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
const falhas = [];
page.on('pageerror', (e) => falhas.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !/ERR_FAILED|js\/main\.js|firebasestorage/.test(m.text())) {
    falhas.push('console: ' + m.text());
  }
});

await page.goto(pageUrl('/cadastro'), { waitUntil: 'networkidle2' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle2' });
await wait(1500);
await page.goto(pageUrl('/roleta'), { waitUntil: 'networkidle2' });
await wait(2200);

// Os espiões e o leitor da tela entram antes do toque.
await page.evaluate(() => {
  const som = { estalos: [], midias: [], quadros: [], pontes: [], ctx: null };
  window.__som = som;

  const iniciar = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (quando = 0, ...resto) {
    let pico = 0;
    for (const v of this.buffer?.getChannelData(0) ?? []) pico = Math.max(pico, Math.abs(v));
    som.ctx = this.context;
    som.estalos.push({ quando, duracao: this.buffer?.duration ?? 0, pico });
    return iniciar.call(this, quando, ...resto);
  };
  const tocar = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    som.midias.push(this.currentSrc || this.src || '');
    return tocar.call(this);
  };

  const disco = document.querySelector('.roleta-eixo').firstElementChild;
  const angulo = () => {
    const t = getComputedStyle(disco).transform;
    if (!t || t === 'none') return 0;
    const n = t.slice(t.indexOf('(') + 1, t.lastIndexOf(')')).split(',').map(Number);
    return (Math.atan2(n[1], n[0]) * 180) / Math.PI;
  };
  // Por tempo, e não por quadros: sem monitor o Chrome não prende o quadro em
  // 60 por segundo, e um teto de 540 quadros acabava antes da roda parar.
  const ate = performance.now() + 9000;
  const amostrar = (agora) => {
    if (!disco.isConnected) return;
    som.quadros.push([agora, angulo()]);
    // A ponte entre o relógio do áudio e o da tela, medida por fora do jogo e
    // do mesmo jeito que ele: a leitura mais fresca é a maior.
    if (som.ctx?.currentTime > 0) som.pontes.push(som.ctx.currentTime - performance.now() / 1000);
    if (agora < ate) requestAnimationFrame(amostrar);
  };
  requestAnimationFrame(amostrar);
});

await page.evaluate(() => {
  const hit = [...document.querySelectorAll('#pages .ff-text')].find((n) => /GIRAR/i.test(n.textContent));
  hit.closest('.ff-inkwell').click();
});
await wait(2500);
await page.screenshot({ path: `${OUT}/girando.png` });
// O giro leva 7,11s e o jogo sai da tela um segundo depois de a roda parar.
await wait(5000);

const dados = await page.evaluate(async () => {
  const carregar = async (nome) =>
    window.__tecgameRequire ? window.__tecgameRequire(nome) : await import(`./js/${nome}`);
  const { FFAppState } = await carregar('state.js');
  const { estalos, midias, quadros, pontes } = window.__som;
  return { escolha: FFAppState.escolha, fatias: FFAppState.totalSlots, estalos, midias, quadros, pontes };
});
await browser.close();

/* --- a tela: o instante em que cada divisa cruza a seta -------------------- */

// O ângulo acumulado, sem voltar a zero a cada volta, como a lingueta lê.
const passoDaFatia = 360 / dados.fatias;
const serie = [];
let acumulado = 0;
let lido = dados.quadros[0][1];
for (const [t, a] of dados.quadros) {
  let avanco = a - lido;
  if (avanco > 180) avanco -= 360;
  if (avanco <= -180) avanco += 360;
  lido = a;
  acumulado += avanco;
  serie.push([t, acumulado]);
}
// A divisa j fica a (j + 1/2) fatia do repouso: a roda para com a seta no meio.
const naTela = [];
for (let i = 1; i < serie.length; i++) {
  const [t0, a0] = serie[i - 1];
  const [t1, a1] = serie[i];
  while (a1 > a0 && (naTela.length + 0.5) * passoDaFatia <= a1) {
    const divisa = (naTela.length + 0.5) * passoDaFatia;
    naTela.push(t0 + ((divisa - a0) / (a1 - a0)) * (t1 - t0));
  }
}

/* --- as cinco afirmações --------------------------------------------------- */

const esperado = Math.round((dados.escolha + 3) * dados.fatias);
console.log(`sorteio ${dados.escolha} com ${dados.fatias} fatias: ${esperado} divisas passam pela seta`);
console.log(
  `   ${dados.quadros.length} quadros lidos, ${naTela.length} divisas vistas passando, ` +
    `${dados.estalos.length} estalos marcados`
);

// 1
const gravacao = dados.midias.filter((src) => /roleta-normal/.test(src));
console.log(`1. gravacao antiga tocando: ${gravacao.length ? 'SIM' : 'nao'}`);
if (gravacao.length) falhas.push('a gravacao roleta-normal voltou a tocar junto com a roda');

// 2
const fora = dados.estalos.filter((e) => Math.abs(e.duracao - 0.0885) > 0.001 || e.pico < 0.45 || e.pico > 0.56);
console.log(`2. estalos que nao sao o gravado (88,5ms, pico 0,512): ${fora.length}`);
if (!dados.estalos.length) falhas.push('a roda girou muda: nenhum estalo marcado');
if (fora.length) falhas.push(`${fora.length} estalos com som errado, ex.: ${JSON.stringify(fora[0])}`);

// 3
console.log(`3. estalos ${dados.estalos.length}, divisas na tela ${naTela.length}, pela conta ${esperado}`);
if (naTela.length !== esperado) {
  falhas.push(`a tela mostrou ${naTela.length} divisas passando, a conta manda ${esperado}`);
}
if (dados.estalos.length !== esperado) falhas.push(`${dados.estalos.length} estalos para ${esperado} divisas`);

const pares = Math.min(dados.estalos.length, naTela.length);
if (!dados.pontes.length) {
  // Com o relógio do áudio parado o jogo marca tudo num tempo que não anda, e
  // o ritmo e o instante reprovariam por um motivo que não é o do jogo.
  falhas.push('o relogio do audio nao andou neste Chrome (contexto suspenso?): sem ele nao ha ritmo para medir');
} else if (pares > 1) {
  // 4
  const quando = dados.estalos.map((e) => e.quando * 1000);
  let piorRitmo = 0;
  let ondeRitmo = 0;
  for (let i = 1; i < pares; i++) {
    const erro = Math.abs(quando[i] - quando[i - 1] - (naTela[i] - naTela[i - 1]));
    if (erro > piorRitmo) [piorRitmo, ondeRitmo] = [erro, i];
  }
  console.log(
    `4. maior diferenca entre o intervalo do som e o da tela: ${piorRitmo.toFixed(2)}ms (estalo ${ondeRitmo})`
  );
  if (piorRitmo > FOLGA_RITMO) {
    falhas.push(`o ritmo do som saiu do da tela em ${piorRitmo.toFixed(1)}ms no estalo ${ondeRitmo}`);
  }

  // 5
  const ponte = Math.max(...dados.pontes);
  let piorInstante = 0;
  let ondeInstante = 0;
  for (let i = 0; i < pares; i++) {
    const erro = Math.abs(quando[i] - ponte * 1000 - naTela[i]);
    if (erro > piorInstante) [piorInstante, ondeInstante] = [erro, i];
  }
  console.log(
    `5. maior distancia entre um estalo e a sua divisa: ${piorInstante.toFixed(2)}ms (estalo ${ondeInstante})`
  );
  if (piorInstante > FOLGA_INSTANTE) {
    falhas.push(`o estalo ${ondeInstante} caiu a ${piorInstante.toFixed(1)}ms da divisa dele`);
  }

  const intervalos = naTela.slice(1).map((t, i) => t - naTela[i]);
  console.log(
    `   o compasso: de ${intervalos[0].toFixed(0)}ms a ${Math.min(...intervalos).toFixed(0)}ms no pico, ` +
      `terminando em ${intervalos[intervalos.length - 1].toFixed(0)}ms`
  );
}

if (falhas.length) {
  console.log('\nFALHOU:\n- ' + falhas.slice(0, 15).join('\n- '));
  process.exit(1);
}
console.log('\nestalo: um por divisa, no instante e no ritmo em que a tela mostra a roda');
