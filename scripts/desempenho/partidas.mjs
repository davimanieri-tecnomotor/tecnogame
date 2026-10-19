// Resistência: muitas partidas seguidas, no mesmo navegador, sem recarregar.
//
// É a pergunta de quem leva o totem para a feira: depois de cem pessoas
// jogarem, o jogo ainda está igual ao da primeira? Um vazamento não aparece em
// nenhum teste de uma partida só — aparece na partida 80, como animação
// engasgando ou a aba morrendo sem memória.
//
// Cada rodada é uma partida inteira pelo caminho real (cadastro, instruções,
// roleta, carro, equipamento, pergunta, fim, REINICIAR), alternando o desfecho:
// acerto, erro, tempo esgotado (o relógio é adiantado) — e uma ajuda usada a
// cada três. De volta ao cadastro, força a coleta de lixo e mede:
//
//   heap       memória JS viva, depois da coleta
//   nos        nós do DOM, CONTANDO os destacados (é onde vaza tela velha)
//   ouvintes   ouvintes de evento vivos
//   anim       animações vivas no documento
//   timers     setInterval sem clearInterval (contados por um invólucro)
//   quadro     na pergunta, o intervalo médio e o pior entre quadros (2 s)
//   armaz.     o tamanho do localStorage do jogo
//
// Não entra no `npm run verify`: leva ~1 min por partida. Uso:
//
//   npm start                                  (num terminal)
//   node scripts/desempenho/partidas.mjs       30 partidas
//   PARTIDAS=60 node scripts/desempenho/partidas.mjs
//
// Sai com erro se o heap, os nós ou os ouvintes crescerem de forma sustentada
// (ver `tendencia`) — vazamento de verdade cresce a cada partida, e não só
// oscila com o que o coletor deixou para depois.
import fs from 'node:fs';
import puppeteer from 'puppeteer';
import { continuar, passarDaAbertura, posicaoDaCerta, responder } from '../verify/_jogo.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
const PARTIDAS = Number(process.env.PARTIDAS ?? 30);
const OUT = process.env.OUT ?? 'shots/desempenho';
fs.mkdirSync(OUT, { recursive: true });
const pageUrl = (rota) => (BASE.endsWith('.html') ? `${BASE}#${rota}` : `${BASE}/#${rota}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--window-size=1920,1080', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
const cdp = await page.target().createCDPSession();
await cdp.send('Performance.enable');

const erros = [];
page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !/js\/main\.js|net::ERR_FAILED|402/.test(m.text())) erros.push(`console: ${m.text()}`);
});

// Antes de qualquer script da página: o relógio que dá para adiantar (o tempo
// esgotado sem esperar 60 s) e a contagem de intervalos vivos.
await page.evaluateOnNewDocument(() => {
  const real = performance.now.bind(performance);
  let extra = 0;
  performance.now = () => real() + extra;
  window.__adiantar = (ms) => {
    extra += ms;
  };
  const vivos = new Set();
  const si = window.setInterval.bind(window);
  const ci = window.clearInterval.bind(window);
  window.setInterval = (...a) => {
    const id = si(...a);
    vivos.add(id);
    return id;
  };
  window.clearInterval = (id) => {
    vivos.delete(id);
    return ci(id);
  };
  window.__intervalosVivos = () => vivos.size;
});

// Durante a lâmina há duas telas, e a nova é a PRIMEIRA (entra por baixo).
const rota = () => page.evaluate(() => document.querySelector('.ff-page')?.dataset.route ?? null);
async function esperarRota(nomes, timeout = 30000) {
  const lista = [].concat(nomes);
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const r = await rota();
    if (lista.includes(r)) return r;
    await wait(150);
  }
  throw new Error(`não chegou a ${lista.join('/')} (está em ${await rota()})`);
}
async function clicarTexto(texto) {
  const ok = await page.evaluate((t) => {
    const n = [...document.querySelectorAll('#pages .ff-text, #overlays .ff-text')].find(
      (x) => (x.textContent || '').trim().toLowerCase() === t.toLowerCase()
    );
    if (!n) return false;
    (n.closest('.ff-inkwell, .ff-btn') ?? n).click();
    return true;
  }, texto);
  if (!ok) throw new Error(`nada clicável com o texto "${texto}"`);
}

async function medir() {
  await cdp.send('HeapProfiler.collectGarbage');
  await wait(300);
  await cdp.send('HeapProfiler.collectGarbage');
  const { metrics } = await cdp.send('Performance.getMetrics');
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  const daPagina = await page.evaluate(() => ({
    anim: document.getAnimations().length,
    timers: window.__intervalosVivos(),
    armaz: Object.keys(localStorage)
      .filter((k) => k.startsWith('tecgame:'))
      .reduce((s, k) => s + k.length + (localStorage.getItem(k) ?? '').length, 0),
    noDom: document.getElementsByTagName('*').length,
  }));
  return {
    heap: +(m.JSHeapUsedSize / 1048576).toFixed(2),
    nos: m.Nodes,
    ouvintes: m.JSEventListeners,
    ...daPagina,
  };
}

/**
 * Intervalo entre quadros durante 2 s: a média e o pior, em ms.
 *
 * A referência é o carimbo do PRIMEIRO quadro, e não `performance.now()`: este
 * teste adianta o `performance.now` para esgotar o tempo, e o carimbo do
 * `requestAnimationFrame` continua no relógio de verdade. Misturar os dois fez
 * a medida de "2 s" durar 63 s na partida seguinte a um tempo esgotado — e a
 * pergunta esgotar de verdade enquanto isso, o que pareceu defeito do jogo.
 */
const quadros = () =>
  page.evaluate(
    () =>
      new Promise((ok) => {
        const ts = [];
        let t0 = null;
        const passo = (t) => {
          if (t0 == null) t0 = t;
          ts.push(t);
          if (t - t0 < 2000) requestAnimationFrame(passo);
          else {
            const d = ts.slice(1).map((t, i) => t - ts[i]);
            ok({ media: +(d.reduce((s, v) => s + v, 0) / d.length).toFixed(1), pior: +Math.max(...d).toFixed(1) });
          }
        };
        requestAnimationFrame(passo);
      })
  );

await page.goto(pageUrl('/cadastro'), { waitUntil: 'networkidle2' });
await page.evaluate(() => localStorage.clear());
await page.goto(pageUrl('/cadastro'), { waitUntil: 'networkidle2' });
await esperarRota(['_initialize', 'cadastro']);
await wait(800);

const linhas = [];
const base = await medir();
console.log(`início      ${JSON.stringify(base)}`);
linhas.push({ partida: 0, ...base });

for (let n = 1; n <= PARTIDAS; n++) {
  const t0 = Date.now();
  const desfechos = (process.env.DESFECHOS ?? 'acerto,erro,esgotado').split(',');
  const desfecho = desfechos[(n - 1) % desfechos.length];

  // Cadastro: nome, WhatsApp, oficina, CONFIRMAR.
  // Todo handle do Puppeteer é descartado: um handle vivo segura o elemento no
  // navegador — e a tela inteira com ele —, e o teste mediria o próprio rastro.
  const entradas = await page.$$('#pages input.ff-input');
  await entradas[0].click({ clickCount: 3 });
  await entradas[0].type(`Jogador ${n}`);
  await entradas[1].click({ clickCount: 3 });
  await entradas[1].type('16997037115');
  await Promise.all(entradas.map((h) => h.dispose()));
  await page.evaluate(() => document.querySelectorAll('#pages .ff-dropdown')[0].click());
  await wait(200);
  await page.evaluate(() => document.querySelectorAll('.ff-dropdown-item')[2].click());
  await wait(200);
  await clicarTexto('CONFIRMAR');

  // Instruções: uma a cada cinco vai até o fim sozinha; as outras são puladas.
  await esperarRota('instrucoes');
  if (n % 5 !== 0) {
    await wait(1200);
    await clicarTexto('Pular instruções');
  }
  await esperarRota('roleta', 30000);
  await wait(600);
  await clicarTexto('GIRAR A ROLETA');

  const depoisDoCarro = await esperarRota(['scanner', 'telaAcao'], 30000);
  if (depoisDoCarro === 'scanner') {
    await wait(1800);
    // Um equipamento compatível diferente a cada partida.
    await page.evaluate((k) => {
      const validos = [...document.querySelectorAll('#pages .eq-stack')].filter((s) => s.querySelector('[style*="opacity: 1"]'));
      validos[k % validos.length]?.querySelector('.ff-inkwell')?.click();
    }, n);
    await esperarRota(['telaAcao', 'telaVideoScanner'], 20000);
    await esperarRota('telaAcao', 30000);
  }

  await passarDaAbertura(page);
  const q = await quadros();
  await page.screenshot({ path: `${OUT}/partida-${String(n).padStart(2, '0')}.png` });

  if (n % 3 === 0) {
    await page.evaluate(() => document.querySelector('#pages [data-ajuda="apoio"]')?.click());
    await page
      .waitForSelector('[data-cartao-ajuda="apoio"] [data-acao="entendi"]', { visible: true, timeout: 15000 })
      .then((h) => h?.dispose(), () => {});
    await wait(2500);
    await page.evaluate(() => document.querySelector('[data-cartao-ajuda="apoio"] [data-acao="entendi"]')?.click());
    await wait(600);
  }

  if (desfecho === 'esgotado') {
    await page.evaluate(() => window.__adiantar(61000));
  } else {
    const certa = await posicaoDaCerta(page);
    await responder(page, desfecho === 'acerto' ? certa : (certa + 1) % 4);
  }
  await continuar(page, 30000);
  await esperarRota(['Ganhou', 'Perdeu'], 20000);
  await wait(2600);
  await clicarTexto('REINICIAR');
  await esperarRota(['_initialize', 'cadastro'], 30000);
  await wait(1200);

  const m = await medir();
  const seg = ((Date.now() - t0) / 1000).toFixed(0);
  linhas.push({ partida: n, desfecho, segundos: +seg, quadroMedio: q.media, quadroPior: q.pior, ...m });
  console.log(
    `partida ${String(n).padStart(2)} ${desfecho.padEnd(8)} ${seg.padStart(3)}s  heap ${m.heap} MB  nós ${m.nos}  ouvintes ${m.ouvintes}  ` +
      `anim ${m.anim}  timers ${m.timers}  quadro ${q.media}/${q.pior} ms  armaz ${(m.armaz / 1024).toFixed(1)} KB`
  );
}

/**
 * O que está preso: todo elemento fora do documento que ainda tem dono, agrupado
 * pela raiz da árvore solta a que pertence (a tela inteira, quase sempre). É o
 * que diz QUAL tela vazou, e não só que algo vazou.
 */
async function soltosPorRaiz() {
  await cdp.send('HeapProfiler.collectGarbage');
  const { result: proto } = await cdp.send('Runtime.evaluate', { expression: 'Element.prototype' });
  const { objects } = await cdp.send('Runtime.queryObjects', { prototypeObjectId: proto.objectId });
  const { result } = await cdp.send('Runtime.callFunctionOn', {
    objectId: objects.objectId,
    returnByValue: true,
    // A lista traz também os PROTÓTIPOS (HTMLDivElement.prototype descende de
    // Element.prototype), e ler `isConnected` de um protótipo lança.
    functionDeclaration: `function () {
      const grupos = {};
      for (const n of this) {
        try {
          if (!(n instanceof Element) || n.isConnected) continue;
          let raiz = n;
          while (raiz.parentElement) raiz = raiz.parentElement;
          const nome = (raiz.dataset?.route ? 'rota:' + raiz.dataset.route + ' ' : '') + (typeof raiz.className === 'string' ? raiz.className : raiz.tagName).slice(0, 70);
          grupos[nome] = (grupos[nome] ?? 0) + 1;
        } catch (_) {}
      }
      return Object.entries(grupos).sort((a, b) => b[1] - a[1]).slice(0, 25);
    }`,
  });
  return result?.value ?? [];
}
if (process.env.DIAGNOSTICO) {
  console.log('');
  console.log('elementos soltos ainda presos, por raiz:');
  try {
    for (const [raiz, qtd] of await soltosPorRaiz()) console.log(`  ${String(qtd).padStart(5)}  ${raiz}`);
  } catch (e) {
    console.log(`  (não deu para listar: ${e.message})`);
  }
}

await browser.close();
fs.writeFileSync(`${OUT}/partidas.json`, JSON.stringify(linhas, null, 2));

/**
 * Crescimento sustentado: a reta dos mínimos-quadrados pela segunda metade das
 * partidas (a primeira aquece caches, fontes e o JIT). Devolve quanto a medida
 * sobe por partida.
 */
function tendencia(campo) {
  const pts = linhas.filter((l) => l.partida >= Math.ceil(PARTIDAS / 2)).map((l) => [l.partida, l[campo]]);
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n;
  const my = pts.reduce((s, p) => s + p[1], 0) / n;
  const num = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0);
  const den = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
  return den ? num / den : 0;
}

const falhas = [...erros];
const porPartida = { heap: tendencia('heap'), nos: tendencia('nos'), ouvintes: tendencia('ouvintes'), anim: tendencia('anim') };
console.log(`\ncrescimento por partida (2ª metade): ${JSON.stringify(Object.fromEntries(Object.entries(porPartida).map(([k, v]) => [k, +v.toFixed(3)])))}`);
// Limites: o que se espera de jogo sem vazamento é ~0. Um vazamento de tela
// inteira deixa centenas de nós e dezenas de KB por partida.
if (porPartida.heap > 0.15) falhas.push(`o heap cresce ${porPartida.heap.toFixed(2)} MB por partida`);
if (porPartida.nos > 20) falhas.push(`os nós do DOM crescem ${porPartida.nos.toFixed(0)} por partida`);
if (porPartida.ouvintes > 5) falhas.push(`os ouvintes crescem ${porPartida.ouvintes.toFixed(1)} por partida`);
if (porPartida.anim > 1) falhas.push(`as animações vivas crescem ${porPartida.anim.toFixed(1)} por partida`);
const ultima = linhas[linhas.length - 1];
if (ultima.timers > base.timers + 2) falhas.push(`intervalos vivos: ${base.timers} no início, ${ultima.timers} no fim`);
const lentas = linhas.filter((l) => l.quadroMedio > 25);
if (lentas.length) falhas.push(`quadro médio acima de 25 ms nas partidas ${lentas.map((l) => l.partida).join(', ')}`);

if (falhas.length) {
  console.log('\nFALHOU:\n- ' + falhas.join('\n- '));
  process.exit(1);
}
console.log(`\n${PARTIDAS} partidas seguidas sem vazamento — ver ${OUT}/partidas.json`);
