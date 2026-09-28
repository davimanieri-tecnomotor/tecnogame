// A mesa de luz do palco.
//
// O jogo vive num palco fixo de 1920x1080, e até a 2.x cada tela pintava por
// conta própria a mesma arte de fundo. Agora o fundo é UM só, em `#fundo`, e
// ganhou o que faz um cenário parecer estúdio de TV e não papel de parede:
//
//   - quatro refletores que varrem devagar, somados à arte por `screen` (luz
//     ACENDE o que está embaixo, não cobre);
//   - um "humor" — a cor e a força da luz — que muda de tela para tela e, na
//     pergunta, de momento para momento: azul na folga, vermelho na reta final,
//     quase apagado no suspense, ouro no acerto;
//   - no estilo clássico da pergunta, os raios roxos do Show do Milhão de 2000
//     girando atrás de tudo.
//
// Por isso as telas deixaram de desenhar a própria arte de fundo: a luz mora
// embaixo delas, e uma tela com fundo opaco a apagaria.
//
// Por cima das telas, em `#frente`, ficam o flash dos vereditos, as partículas
// (particulas.js) e a LÂMINA — a faixa de luz inclinada que é a troca de tela
// do jogo inteiro (ver router.js).
//
// Com "menos movimento" no sistema a luz fica parada e a lâmina vira o
// esmaecer de antes; a cor continua mudando, porque é ela que conta o momento.

import { el } from './widgets.js';
import { menosMovimento } from './anim.js';
import { readRaw, writeRaw } from './storage.js';

/**
 * Os humores. `feixes` é a opacidade dos refletores, `vel` a velocidade da
 * varredura (1 = a da pergunta), `sombra` o quanto a arte de fundo escurece.
 *
 * `repouso` é o das telas que não são a pergunta: a arte quase inteira, como
 * era, e refletores fracos — o cadastro e a roleta ganham o estúdio sem mudar
 * de cara. A pergunta escurece a arte para a luz aparecer, que é o que um
 * estúdio faz: o cenário apaga e o palco acende.
 */
const HUMORES = {
  repouso: { cor: 'rgb(140, 190, 255)', feixes: 0.42, vel: 0.55, sombra: 0.08 },
  atracao: { cor: 'rgb(160, 205, 255)', feixes: 0.8, vel: 1.35, sombra: 0.25 },
  normal: { cor: 'rgb(150, 200, 255)', feixes: 0.9, vel: 1, sombra: 0.4 },
  reta: { cor: 'rgb(255, 72, 56)', feixes: 0.95, vel: 1.9, sombra: 0.5 },
  suspense: { cor: 'rgb(255, 200, 120)', feixes: 0, vel: 0.3, sombra: 0.8 },
  acerto: { cor: 'rgb(255, 214, 90)', feixes: 1, vel: 2.6, sombra: 0.22 },
  erro: { cor: 'rgb(255, 50, 40)', feixes: 0.45, vel: 0.5, sombra: 0.66 },
  milhao: { cor: 'rgb(255, 196, 70)', feixes: 1, vel: 1.2, sombra: 0.5 },
};

/**
 * Onde cada refletor fica pendurado (x, px do palco), para onde aponta em
 * repouso (graus) e quanto balança. As velocidades são primas entre si de
 * propósito: com números redondos os quatro se alinhavam a cada poucos
 * segundos e a varredura virava coreografia de quartel.
 */
const REFLETORES = [
  { x: 250, base: 16, amp: 9, vel: 0.33, fase: 0 },
  { x: 690, base: 7, amp: 12, vel: 0.47, fase: 1.7 },
  { x: 1230, base: -7, amp: 12, vel: 0.41, fase: 3.4 },
  { x: 1670, base: -16, amp: 9, vel: 0.29, fase: 5.1 },
];

let stage = null;
let feixes = [];
let vel = HUMORES.repouso.vel;
let fase = 0;
let ultimo = 0;
let quadro = 0;

/** Monta as camadas do palco. Chamado uma vez, no boot (main.js). */
export function montarPalco() {
  stage = document.getElementById('stage');
  const fundo = document.getElementById('fundo');
  const frente = document.getElementById('frente');
  if (!stage || !fundo || !frente || fundo.dataset.montado) return;
  fundo.dataset.montado = '1';

  feixes = REFLETORES.map((r) => ({
    ...r,
    no: el('div', { class: 'palco-feixe', style: { left: `${r.x}px` } }, [
      el('div', { class: 'palco-feixe-cone' }),
      el('div', { class: 'palco-feixe-fonte' }),
    ]),
  }));

  fundo.append(
    el('div', { class: 'palco-sombra' }),
    el('div', { class: 'palco-raios' }),
    el('div', { class: 'palco-feixes' }, feixes.map((f) => f.no)),
    el('div', { class: 'palco-nevoa' })
  );
  frente.append(
    el('canvas', { id: 'particulas', width: '1920', height: '1080', 'aria-hidden': 'true' }),
    el('div', { class: 'palco-flash' }),
    el('div', { class: 'palco-lamina' })
  );

  humor('repouso');
  ultimo = performance.now();
  quadro = requestAnimationFrame(varrer);
  // Aba escondida não precisa de luz — e o totem fica ligado o dia inteiro.
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(quadro);
    if (!document.hidden) {
      ultimo = performance.now();
      quadro = requestAnimationFrame(varrer);
    }
  });
}

/**
 * A varredura dos refletores, a cada quadro. São quatro `transform` num
 * elemento já composto: o compositor gira a textura pronta, e o desfoque não é
 * refeito.
 */
function varrer() {
  // `performance.now` dos dois lados: o carimbo do quadro pode vir antes do
  // `ultimo` medido na montagem, e o passo sairia negativo.
  const agora = performance.now();
  const dt = Math.min(0.05, Math.max(0, (agora - ultimo) / 1000));
  ultimo = agora;
  if (!menosMovimento()) {
    fase += dt * vel;
    for (const f of feixes) {
      f.no.style.transform = `rotate(${(f.base + f.amp * Math.sin(fase * f.vel * 2 + f.fase)).toFixed(2)}deg)`;
    }
  }
  quadro = requestAnimationFrame(varrer);
}

/** Muda o humor da luz. A cor transita (ver `--feixe-cor` em auditorio.css). */
export function humor(nome) {
  const h = HUMORES[nome] ?? HUMORES.repouso;
  if (!stage) return;
  stage.dataset.humor = nome;
  stage.style.setProperty('--feixe-cor', h.cor);
  stage.style.setProperty('--feixes-op', String(h.feixes));
  stage.style.setProperty('--palco-sombra', String(h.sombra));
  vel = h.vel;
}

/** O estilo da pergunta em cena (`classico`, `palco`) ou `null` fora dela. */
export function estiloEmCena(nome) {
  if (!stage) return;
  if (nome) stage.dataset.estilo = nome;
  else delete stage.dataset.estilo;
}

/** O palco volta ao repouso: é o que toda troca de tela faz antes da seguinte. */
export function repousar() {
  humor('repouso');
  estiloEmCena(null);
}

/**
 * O flash de um veredito: pancada, e não luz acesa.
 *
 * Pico a 12% do tempo e queda até 380ms — medido no programa e ajustado aqui:
 * mais longo que isso, o branco vira lâmpada acesa e apaga o que o jogador
 * precisa ler. Com menos movimento cai para 35% da força.
 */
export function flash(cor = '#fff', pico = 0.85, ms = 320) {
  const n = document.querySelector('.palco-flash');
  if (!n) return;
  n.style.background = cor;
  n.animate([{ opacity: 0 }, { opacity: menosMovimento() ? pico * 0.35 : pico, offset: 0.12 }, { opacity: 0 }], {
    duration: ms,
    easing: 'ease-out',
  });
}

/* ------------------------------------------------------------ a lâmina --- */

/**
 * A troca de tela: uma faixa de luz inclinada atravessa o palco e o que fica
 * para trás dela já é a tela nova.
 *
 * `saindo` é a página que sai, por CIMA da nova: o recorte dela encolhe junto
 * com a faixa, pela mesma reta. A faixa inclina 10° (gradiente a 100deg): em
 * cima ela está 95px à frente do centro, embaixo 95px atrás — 540 x tg 10° —,
 * e o polígono do recorte segue essa reta de ponta a ponta. Mesma curva e
 * mesma duração nas duas animações, e elas andam juntas até o fim.
 *
 * 760ms: o esmaecer de antes gastava 600 (300 para apagar, 300 para acender) e
 * deixava o palco vazio no meio; aqui as duas telas dividem o tempo inteiro, e
 * abaixo de ~700 a faixa passa rápido demais para ser lida como luz.
 */
export const DURACAO_DA_LAMINA = 760;
const CURVA_DA_LAMINA = 'cubic-bezier(.65,.05,.3,1)';

export function lamina(saindo) {
  const faixa = document.querySelector('.palco-lamina');
  const opcoes = { duration: DURACAO_DA_LAMINA, easing: CURVA_DA_LAMINA, fill: 'forwards' };
  if (faixa) {
    faixa.style.opacity = '1';
    faixa.animate([{ transform: 'translateX(-1300px)' }, { transform: 'translateX(1300px)' }], opcoes).finished.then(
      () => (faixa.style.opacity = '0'),
      () => (faixa.style.opacity = '0')
    );
  }
  return saindo
    .animate(
      [
        { clipPath: 'polygon(-245px 0, 2400px 0, 2400px 1080px, -435px 1080px)' },
        { clipPath: 'polygon(2355px 0, 2400px 0, 2400px 1080px, 2165px 1080px)' },
      ],
      opcoes
    )
    .finished.catch(() => {});
}

/* ------------------------------------------------------------ a câmera --- */

/**
 * A câmera se aproxima do ponto (x, y) de `no` — 6% em 2,6s no suspense:
 * percebe-se sem se notar. Devolve quem a solta.
 */
export function aproximar(no, x, y, escala = 1.06, ms = 2600) {
  if (!no || menosMovimento()) return { soltar() {} };
  no.style.transformOrigin = `${x}px ${y}px`;
  const zoom = no.animate([{ transform: 'scale(1)' }, { transform: `scale(${escala})` }], {
    duration: ms,
    easing: 'cubic-bezier(.4,0,.2,1)',
    fill: 'forwards',
  });
  return {
    /** Volta com um leve recuo abaixo de 1: é o "respiro" depois do veredito. */
    soltar(duracao = 560) {
      const atual = getComputedStyle(no).transform;
      zoom.cancel();
      no.animate([{ transform: atual }, { transform: 'scale(0.992)', offset: 0.6 }, { transform: 'scale(1)' }], {
        duration: duracao,
        easing: 'cubic-bezier(.2,.9,.25,1)',
      });
    },
  };
}

/**
 * Tremor que morre: cada quadro sorteado, a amplitude caindo em curva. 480ms e
 * ±18px no erro — um "não" do corpo inteiro que acaba sozinho; mais longo vira
 * castigo.
 */
export function tremer(no, forca = 16, ms = 480) {
  if (!no || menosMovimento()) return;
  const n = 12;
  const quadros = [];
  for (let i = 0; i <= n; i++) {
    const k = Math.pow(1 - i / n, 1.6);
    const dx = ((Math.random() * 2 - 1) * forca * k).toFixed(1);
    const dy = ((Math.random() * 2 - 1) * forca * 0.6 * k).toFixed(1);
    quadros.push({ transform: `translate(${dx}px, ${dy}px)` });
  }
  quadros[n] = { transform: 'translate(0px, 0px)' };
  no.animate(quadros, { duration: ms, easing: 'linear' });
}

/** O soco do acerto: a cena cresce 2% e volta. */
export function soco(no, escala = 1.022, ms = 440) {
  if (!no || menosMovimento()) return;
  no.animate([{ transform: 'scale(1)' }, { transform: `scale(${escala})`, offset: 0.22 }, { transform: 'scale(1)' }], {
    duration: ms,
    easing: 'cubic-bezier(.2,.8,.3,1)',
  });
}

/* ------------------------------------------------ o estilo da pergunta --- */

/**
 * O estilo da tela da pergunta: `classico` (a coluna do Show do Milhão de 2000,
 * o padrão) ou `palco` (o terço inferior com losangos, a gramática do
 * Milionário). Escolhido pelo operador no painel, em "Na feira", e guardado
 * neste navegador — cada totem pode ter o seu.
 *
 * `?estilo=palco` no endereço vence o guardado: é como se mostra o outro sem
 * mexer no painel (e como a suíte fotografa os dois).
 */
export const ESTILOS = ['classico', 'palco'];
const CHAVE_ESTILO = 'pergunta.estilo';

export function estiloDaPergunta() {
  try {
    const pedido = new URLSearchParams(location.search).get('estilo');
    if (ESTILOS.includes(pedido)) return pedido;
  } catch (_) {
    /* sem location: fora do navegador */
  }
  const guardado = readRaw(CHAVE_ESTILO);
  return ESTILOS.includes(guardado) ? guardado : 'classico';
}

export function definirEstiloDaPergunta(nome) {
  if (!ESTILOS.includes(nome)) return false;
  return writeRaw(CHAVE_ESTILO, nome);
}
