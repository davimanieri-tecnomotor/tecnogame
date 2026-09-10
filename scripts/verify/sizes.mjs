// O envelope de telas atendidas.
//
// O jogo desenha num palco fixo de 1920x1080 e o escala para caber na janela,
// entao TUDO encolhe junto: num notebook de 1280x800 a escala e 0,667 e o texto
// de 14px do cadastro chegava a 9,3px na tela, com o link da politica em 11px
// de alvo. Nao da para "deixar responsivo" sem dizer para que telas, e e isto
// que este teste fixa: a classe desktop, de 1280x800 (escala 0,667) a 4K
// (escala 2), tem de entregar 12px de texto e 24px de area de toque.
//
// Os dois pisos vivem em css/app.css (`--piso-fonte` e `--piso-alvo`), escritos
// em px de tela e convertidos para px do palco pela escala. Em 1x eles nao
// alcancam nada, entao o totem continua identico ao Dart; este teste e o que
// garante que continuem alcancando o resto da faixa.
import fs from 'node:fs';
import puppeteer from 'puppeteer';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
// BASE e uma origem (http://host:porta) ou a pagina inteira
// (file:///.../web/index.html), que e como a build de disco e conferida.
const pageUrl = (route) => (BASE.endsWith('.html') ? `${BASE}#${route}` : `${BASE}/#${route}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT ?? 'shots';

/** O minimo que a faixa atendida entrega, em px DE TELA. */
const PISO_TEXTO = 12;
const PISO_ALVO = 24;

/** As telas atendidas. A ultima esta fora do envelope: rende foto, nao cobranca. */
const TELAS = [
  { rotulo: 'totem', w: 1920, h: 1080, cobra: true },
  { rotulo: '4k', w: 3840, h: 2160, cobra: true },
  { rotulo: 'ultrawide', w: 2560, h: 1080, cobra: true },
  { rotulo: '1366x768', w: 1366, h: 768, cobra: true },
  { rotulo: '1280x800', w: 1280, h: 800, cobra: true },
  { rotulo: '5-4', w: 1280, h: 1024, cobra: true },
  { rotulo: 'portrait', w: 900, h: 1600, cobra: false },
];

/** As rotas onde o jogador le e toca. */
const ROTAS = ['/cadastro', '/roleta', '/carro', '/scanner', '/telaAcao', '/ganhou', '/perdeu', '/instrucoes'];

fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const falhas = [];

for (const tela of TELAS) {
  const page = await browser.newPage();
  await page.setViewport({ width: tela.w, height: tela.h });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);

  let escala = 0;
  let piorTexto = { px: Infinity };
  let piorAlvo = { px: Infinity };

  for (const rota of ROTAS) {
    await page.goto(pageUrl(rota), { waitUntil: 'networkidle2' });
    await wait(2200);
    const m = await page.evaluate(() => {
      const stage = document.getElementById('stage');
      const escala = +getComputedStyle(stage).getPropertyValue('--stage-scale');
      const visivel = (n) => {
        const r = n.getBoundingClientRect();
        return r.width > 1 && r.height > 1;
      };
      // So elementos que desenham texto DIRETO: o font-size de um involucro e o
      // herdado, que nao passa pelo piso, e daria um numero falso.
      const proprio = (n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());

      let texto = null;
      for (const n of document.querySelectorAll('#pages .ff-text, #pages .ff-input, #pages .ff-dropdown, #pages .ff-dropdown-item')) {
        if (!visivel(n) || !proprio(n)) continue;
        // fontSize computado esta em px do palco; na tela vale isso * escala.
        const naTela = parseFloat(getComputedStyle(n).fontSize) * escala;
        if (!texto || naTela < texto.px) texto = { px: +naTela.toFixed(1), txt: n.textContent.trim().slice(0, 30) };
      }

      // Rota sem alvo nenhum (a do carro sorteado, que so espera) devolve null:
      // Infinity atravessaria o evaluate virando null e seria lido como zero.
      let alvo = null;
      for (const n of document.querySelectorAll('#pages .ff-inkwell')) {
        if (!visivel(n)) continue;
        const r = n.getBoundingClientRect();
        const lado = Math.min(r.width, r.height);
        if (!alvo || lado < alvo.px) alvo = { px: Math.round(lado), txt: (n.textContent || '').trim().slice(0, 30) };
      }

      // Subir a fonte num piso pode estourar a caixa que a contem; se isso
      // acontecer, o texto sai cortado, e e isso que se ve aqui.
      const cortados = [];
      for (const n of document.querySelectorAll('#pages .ff-text')) {
        if (!visivel(n)) continue;
        if (n.scrollHeight > n.clientHeight + 2 || n.scrollWidth > n.clientWidth + 2) {
          cortados.push(n.textContent.trim().slice(0, 30));
        }
      }

      const r = stage.getBoundingClientRect();
      return {
        escala,
        texto,
        alvo,
        cortados,
        caixa: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
      };
    });

    escala = m.escala;
    if (m.texto && m.texto.px < piorTexto.px) piorTexto = { ...m.texto, rota };
    if (m.alvo && m.alvo.px < piorAlvo.px) piorAlvo = { ...m.alvo, rota };
    if (m.cortados.length) {
      falhas.push(`${tela.rotulo} ${rota}: texto cortado ${JSON.stringify(m.cortados.slice(0, 3))}`);
    }
    if (m.overflowX) falhas.push(`${tela.rotulo} ${rota}: a pagina rola na horizontal`);
    if (rota === '/telaAcao') {
      console.log(`${tela.rotulo.padEnd(10)} ${JSON.stringify({ escala: m.escala, box: m.caixa, overflowX: m.overflowX })}`);
      await page.screenshot({ path: `${OUT}/size-${tela.rotulo}.png` });
    }
  }

  const nota = tela.cobra ? '' : '   (fora do envelope: so foto)';
  const mostra = (m) => (Number.isFinite(m.px) ? `${m.px}px` : '-');
  console.log(
    `${''.padEnd(10)} escala ${escala.toFixed(3)}  menor texto ${mostra(piorTexto).padEnd(8)}` +
      `menor alvo ${mostra(piorAlvo).padEnd(7)}${nota}`
  );

  if (tela.cobra) {
    if (!Number.isFinite(piorTexto.px) || !Number.isFinite(piorAlvo.px)) {
      falhas.push(`${tela.rotulo}: nao mediu texto ou alvo em nenhuma rota — o seletor deve ter quebrado`);
    }
    if (piorTexto.px < PISO_TEXTO) {
      falhas.push(
        `${tela.rotulo}: texto de ${piorTexto.px}px na tela em ${piorTexto.rota} ` +
          `(${JSON.stringify(piorTexto.txt)}), piso e ${PISO_TEXTO}px`
      );
    }
    if (piorAlvo.px < PISO_ALVO) {
      falhas.push(
        `${tela.rotulo}: alvo de ${piorAlvo.px}px na tela em ${piorAlvo.rota} ` +
          `(${JSON.stringify(piorAlvo.txt)}), piso e ${PISO_ALVO}px`
      );
    }
  }

  await page.close();
}

/* ------------------------ nitidez da arte no alto do envelope ------------- *
 * Texto e a roleta em SVG sao rasterizados na escala final e saem nitidos em
 * 4K; PNG e ampliado. Isto nao e uma cobranca porque nao se conserta em codigo
 * — depende de reexportar a arte maior, e o `Img` ja desenha em px do palco,
 * entao um arquivo maior e so baixado de escala e fica nitido de graca. O que
 * o teste faz e manter a lista visivel, com o tamanho que cada um precisa. */

const ESCALA_MAX = Math.max(...TELAS.filter((t) => t.cobra).map((t) => Math.min(t.w / 1920, t.h / 1080)));

const pagina = await browser.newPage();
await pagina.setViewport({ width: 1920, height: 1080 });
const artes = new Map();
for (const rota of ROTAS) {
  await pagina.goto(pageUrl(rota), { waitUntil: 'networkidle2' });
  await wait(2000);
  const lista = await pagina.evaluate(() => {
    const out = [];
    for (const n of document.querySelectorAll('#pages img, #overlays img')) {
      const r = n.getBoundingClientRect();
      if (r.width < 2 || !n.naturalWidth) continue;
      out.push({ src: n.getAttribute('src').split('/').pop(), nativo: n.naturalWidth, desenhado: Math.round(r.width) });
    }
    return out;
  });
  for (const a of lista) {
    const antes = artes.get(a.src);
    if (!antes || a.desenhado > antes.desenhado) artes.set(a.src, a);
  }
}
await pagina.close();

const curtas = [...artes.values()]
  .map((a) => ({ ...a, precisa: Math.ceil(a.desenhado * ESCALA_MAX), amp: +((a.desenhado * ESCALA_MAX) / a.nativo).toFixed(2) }))
  .filter((a) => a.amp > 1.05)
  .sort((a, b) => b.amp - a.amp);

console.log(`\nnitidez em escala ${ESCALA_MAX} (o alto do envelope): ${curtas.length} de ${artes.size} artes sao ampliadas`);
for (const a of curtas) {
  console.log(`  ${String(a.amp + 'x').padEnd(7)} ${String(a.nativo + 'px').padEnd(8)} -> precisa ${String(a.precisa + 'px').padEnd(8)} ${a.src}`);
}
if (curtas.length) {
  console.log('  (reexportar estas com a largura pedida; o desenho nao muda, so a nitidez)');
}

await browser.close();
if (falhas.length) {
  console.log('\nFALHOU:\n- ' + falhas.slice(0, 15).join('\n- '));
  process.exit(1);
}
console.log(`\nenvelope ok: de 1280x800 a 4K, nada abaixo de ${PISO_TEXTO}px de texto nem de ${PISO_ALVO}px de alvo`);
