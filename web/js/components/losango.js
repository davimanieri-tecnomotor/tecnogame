// A caixa da pergunta, das alternativas e dos painéis do apresentador.
//
// Dois desenhos, uma peça só:
//
//   - com `ponta`, o losango do Milionário — um hexágono alongado, de pontas
//     laterais (estilo "palco");
//   - com `ponta` 0, a caixa de cantos redondos do Show do Milhão de 2000, de
//     raio `raio` (estilo "clássico").
//
// Em SVG, e em CAMADAS, porque cada estado mora numa camada só dele:
//
//   l-base     a cor de sempre
//   l-estado   a cor de travada (ouro no palco, laranja no clássico) ou a da errada
//   l-verde    o verde da certa, POR CIMA da de travada
//   l-reflexo  o brilho de vidro na metade de cima
//   l-borda    o contorno
//   l-risco    a luz que corre pela borda
//
// O verde numa camada própria é o que deixa a revelação ALTERNAR travada ↔
// verde, como no programa, animando só a opacidade dela — `fill` não se anima,
// e trocar a cor por classe a cada 200ms seria piscar por JavaScript.
//
// Os gradientes vivem num `<svg>` escondido, criado uma vez (`url(#lz-...)`
// casa com o primeiro do documento).

import { menosMovimento } from '../anim.js';

const NS = 'http://www.w3.org/2000/svg';

/** [id, topo, meio, base] — tons de cima para baixo. */
const GRADIENTES = [
  ['lz-base', '#15408f', '#0a2463', '#050f33'],
  ['lz-ouro', '#FFEFB0', '#FFC21A', '#E07B00'],
  ['lz-verde', '#8DFFC4', '#1FD37A', '#0B7F45'],
  ['lz-vermelho', '#FFA59F', '#FF3B30', '#9E0F0A'],
  // Estilo clássico: tons amostrados do Show do Milhão de 30/03/2000 (pergunta
  // #BA1C01, alternativa #912100), com margem de ±10% por serem de vídeo
  // comprimido.
  ['lz-perg-cl', '#e2380f', '#BA1C01', '#7a1100'],
  ['lz-opcao-cl', '#b83208', '#912100', '#591300'],
  ['lz-trava-cl', '#ff6a2b', '#e03a06', '#a51f00'],
  // A Pergunta do Milhão: ouro escuro, para o palco inteiro dizer "especial".
  ['lz-milhao', '#8a6400', '#5c3f00', '#2e1f00'],
];

/** Cria, uma vez, as definições que as caixas referenciam por `url(#...)`. */
export function garantirGradientes() {
  if (document.getElementById('lz-defs')) return;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('id', 'lz-defs');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  const lineares = GRADIENTES.map(
    ([id, a, b, c]) =>
      `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`
  ).join('');
  svg.innerHTML =
    `<defs>${lineares}` +
    '<linearGradient id="lz-reflexo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".26"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="lz-cromo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f7fb"/><stop offset=".48" stop-color="#8f9bb0"/><stop offset=".53" stop-color="#e9eef6"/><stop offset="1" stop-color="#5b667a"/></linearGradient>' +
    '<radialGradient id="lz-face" cx=".5" cy=".42" r=".62"><stop offset="0" stop-color="#11275a"/><stop offset=".7" stop-color="#050c22"/><stop offset="1" stop-color="#02060f"/></radialGradient>' +
    '</defs>';
  document.body.appendChild(svg);
}

const hexagono = (w, h, d, o = 0) =>
  `M${o + d} ${o}L${o + w - d} ${o}L${o + w} ${o + h / 2}L${o + w - d} ${o + h}L${o + d} ${o + h}L${o} ${o + h / 2}Z`;

const caixa = (w, h, r, o = 0) =>
  `M${o + r} ${o}H${o + w - r}A${r} ${r} 0 0 1 ${o + w} ${o + r}V${o + h - r}A${r} ${r} 0 0 1 ${o + w - r} ${o + h}` +
  `H${o + r}A${r} ${r} 0 0 1 ${o} ${o + h - r}V${o + r}A${r} ${r} 0 0 1 ${o + r} ${o}Z`;

/**
 * Uma caixa em SVG, do tamanho pedido.
 *
 * @param {object} medidas
 * @param {number} medidas.largura
 * @param {number} medidas.altura
 * @param {number} [medidas.ponta] o recuo das pontas laterais; 0 = caixa redonda
 * @param {number} [medidas.raio] o raio dos cantos, quando `ponta` é 0
 * @param {string} [medidas.classe]
 */
export function Losango({ largura: w, altura: h, ponta: d = 0, raio = 0, classe = '' }) {
  garantirGradientes();
  const redonda = d === 0;
  const base = redonda ? caixa(w, h, raio) : hexagono(w, h, d);
  const borda = redonda ? caixa(w - 4, h - 4, Math.max(0, raio - 2), 2) : hexagono(w - 4, h - 4, d - 1.2, 2);
  const reflexo = redonda
    ? `M${raio} 0H${w - raio}A${raio} ${raio} 0 0 1 ${w} ${raio}V${h / 2}H0V${raio}A${raio} ${raio} 0 0 1 ${raio} 0Z`
    : `M${d} 0L${w - d} 0L${w} ${h / 2}L0 ${h / 2}Z`;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', `lz ${classe}`.trim());
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('aria-hidden', 'true');
  // Os caminhos são números calculados aqui, nunca texto do baralho: o
  // innerHTML não carrega nada que alguém de fora escreva.
  svg.innerHTML =
    `<path class="l-base" d="${base}"/><path class="l-estado" d="${base}"/><path class="l-verde" d="${base}"/>` +
    `<path class="l-reflexo" d="${reflexo}"/><path class="l-borda" d="${borda}"/>` +
    `<path class="l-risco" d="${borda}" pathLength="100"/>`;
  return svg;
}

/**
 * A luz que corre pela borda, uma volta: é o "ding" visual de cada peça que
 * entra, e o brilho ocioso que lembra o jogador de que a tela está viva.
 */
export function correrBorda(svg, { ms = 700, delay = 0 } = {}) {
  const risco = svg?.querySelector?.('.l-risco');
  if (!risco || menosMovimento()) return;
  risco.animate(
    [
      { strokeDashoffset: 0, opacity: 0 },
      { opacity: 1, offset: 0.1 },
      { opacity: 1, offset: 0.8 },
      { strokeDashoffset: -100, opacity: 0 },
    ],
    { duration: ms, delay, easing: 'cubic-bezier(.4,0,.2,1)' }
  );
}
