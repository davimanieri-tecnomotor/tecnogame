// O relógio da pergunta: um cronômetro.
//
// Na 3.0 o relógio virou conta-giros, e na feira ele não se leu como relógio.
// A escala ia de 60 a 0 da esquerda para a direita, os segundos ficavam
// pequenos no pé do mostrador — e o único tempo GRANDE na tela era o "vale o 1º
// lugar por mais 6,4 s" da faixa ERRAR / RECORDE / ACERTAR AGORA. Todo mundo
// achou que ESSE era o tempo para responder. Na 3.1 a faixa saiu e o mostrador
// virou o que qualquer um reconhece como tempo sem legenda: um cronômetro, com
// a coroa em cima, os segundos que faltam em número grande no meio e um anel
// que esvazia no sentido do relógio, com uma faísca na ponta.
//
// Do conta-giros ficou o que funcionava: a cor que muda (azul; âmbar na
// metade; vermelho no último quarto, onde começa a reta final), o calor da reta
// final e o estouro no zero — agora o vidro trinca e a coroa salta. E nos
// últimos cinco segundos ele treme, cada vez mais: é a bomba avisando.
//
// Os segundos do meio são HTML, e não `<text>` do SVG, pelos motivos que o
// conta-giros mediu: o Chrome pintava `<text>` de SVG com `scale` animado na
// escala do primeiro quadro, e texto de SVG não passa pelo piso de
// legibilidade (`fonte()`).
//
// O número é o teto dos segundos: com 59,3 s sobrando ele diz 60, e só diz 0
// quando o tempo acabou de fato — é a convenção de toda contagem regressiva, e
// é o que faz o "0" coincidir com o estouro.

import { el, fonte } from '../widgets.js';
import { menosMovimento } from '../anim.js';
import { garantirGradientes } from './losango.js';
import { T } from '../textos.js';

const TOTAL = 60000;
const RETA = 15000;
/** Nos últimos 5 s o cronômetro treme; a amplitude cresce até o zero. */
const TREME = 5000;
/** O "painel ligando": quanto o anel leva para encher na abertura. */
const VARREDURA_MS = 620;

/** O desenho mora num viewBox de 400x440: o mostrador e, acima dele, a coroa. */
const LARG = 400;
const ALT = 440;
const CX = 200;
const CY = 240;
const R_ANEL = 132;

const polar = (r, a) => {
  const rad = (a * Math.PI) / 180;
  return [CX + r * Math.sin(rad), CY - r * Math.cos(rad)];
};

/** Um arco no sentido do relógio, de `a0` a `a1` graus (0 = meio-dia). */
const arcoD = (r, a0, a1) => {
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

/** Os segundos que o mostrador escreve: o teto, de 60 a 0. */
export const segundosNoMostrador = (restante) => Math.max(0, Math.ceil(Math.max(0, restante) / 1000));

/** A cor do anel pela fração que sobra — as mesmas faixas do conta-giros. */
const corDoAnel = (frac) => (frac > 0.5 ? '#3E8BFF' : frac > 0.25 ? '#FFB400' : '#FF3B30');

/**
 * @param {object} [opcoes]
 * @param {number} [opcoes.tamanho] a largura do cronômetro, em px do palco (a
 *   altura é 1,1 vez isso, por causa da coroa)
 */
export function Cronometro({ tamanho = 370 } = {}) {
  garantirGradientes();
  const k = tamanho / LARG;

  // A coroa e os dois botões laterais são o que diz "cronômetro" de longe.
  let s = `<svg viewBox="0 0 ${LARG} ${ALT}" width="${tamanho}" height="${Math.round(tamanho * (ALT / LARG))}" aria-hidden="true">`;
  for (const lado of [-40, 40]) {
    s += `<g transform="rotate(${lado} ${CX} ${CY})"><rect x="187" y="34" width="26" height="24" rx="5" fill="url(#lz-cromo)"/></g>`;
  }
  s +=
    '<g class="aud-crono-coroa">' +
    '<rect x="186" y="24" width="28" height="32" rx="4" fill="url(#lz-cromo)"/>' +
    '<rect x="158" y="4" width="84" height="26" rx="9" fill="url(#lz-cromo)"/>' +
    '<rect x="164" y="8" width="72" height="6" rx="3" fill="#fff" opacity=".5"/></g>';
  s += `<circle cx="${CX}" cy="${CY}" r="190" fill="url(#lz-cromo)"/><circle cx="${CX}" cy="${CY}" r="178" fill="#050b1c"/>`;
  s += `<circle class="aud-crono-face" cx="${CX}" cy="${CY}" r="174" fill="url(#lz-face)"/>`;
  for (let seg = 0; seg < 60; seg++) {
    const maior = seg % 5 === 0;
    const [x0, y0] = polar(maior ? 150 : 156, seg * 6);
    const [x1, y1] = polar(166, seg * 6);
    s += `<line class="aud-crono-risco${maior ? ' maior' : ''}" data-seg="${seg}" x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"/>`;
  }
  s += `<circle class="aud-crono-trilho" cx="${CX}" cy="${CY}" r="${R_ANEL}"/>`;
  s += `<path class="aud-crono-anel" d=""/>`;
  s += `<circle class="aud-crono-ponta" r="13" cx="${CX}" cy="${CY - R_ANEL}"/>`;
  // O vidro trincado do estouro: nasce invisível, e só o `estourar` o mostra.
  s +=
    '<g class="aud-crono-trinca">' +
    '<path d="M252 184L286 140L312 130M286 140L292 104M252 184L306 206L346 200M306 206L318 246M252 184L240 246L252 300L246 338' +
    'M240 246L206 270M252 184L204 160L166 174L140 160M204 160L198 118M252 184L268 112"/>' +
    '<circle cx="252" cy="184" r="12"/></g>';
  s += `<ellipse cx="${CX}" cy="${CY - 92}" rx="140" ry="58" fill="#fff" opacity=".05"/></svg>`;

  const inteiro = el('span', { class: 'aud-crono-int', text: '60', style: { fontSize: fonte(Math.round(108 * k)) } });
  const rotulo = el('span', { class: 'aud-crono-rotulo', text: T('segundos'), style: { fontSize: fonte(Math.round(17 * k)) } });
  const miolo = el(
    'div',
    {
      class: 'ff-text aud-crono-miolo',
      style: {
        left: `${Math.round((CX - 118) * k)}px`,
        top: `${Math.round((CY - 118) * k)}px`,
        width: `${Math.round(236 * k)}px`,
        height: `${Math.round(236 * k)}px`,
      },
    },
    [inteiro, rotulo]
  );

  const raiz = el('div', {
    class: 'aud-cronometro aud-oculta',
    role: 'timer',
    'aria-label': T('segundos'),
    style: { width: `${tamanho}px`, height: `${Math.round(tamanho * (ALT / LARG))}px` },
  });
  raiz.innerHTML = s; // só números calculados aqui; nenhum texto de fora
  raiz.append(miolo);

  const anel = raiz.querySelector('.aud-crono-anel');
  const ponta = raiz.querySelector('.aud-crono-ponta');
  const coroa = raiz.querySelector('.aud-crono-coroa');
  const riscos = [...raiz.querySelectorAll('.aud-crono-risco')];

  let restanteAtual = TOTAL;
  let fracReal = 1;
  // O anel nasce vazio e a varredura o enche; sem movimento, já nasce cheio.
  let fracMostrada = menosMovimento() ? 1 : 0;
  let varredura = null;
  let desenhada = -1;
  let ultimoSegundo = 60;
  let t = 0;

  function desenhar(frac) {
    if (Math.abs(frac - desenhada) < 0.0004) return;
    desenhada = frac;
    // O que falta vai da ponta até o meio-dia, no sentido do relógio: a ponta
    // anda como o ponteiro de um relógio e vai "comendo" o anel.
    const a = 360 * (1 - frac);
    anel.setAttribute('d', frac <= 0.0005 ? '' : arcoD(R_ANEL, a, Math.min(359.99, 360)));
    anel.style.stroke = corDoAnel(frac);
    const [px, py] = polar(R_ANEL, a);
    ponta.setAttribute('cx', px.toFixed(2));
    ponta.setAttribute('cy', py.toFixed(2));
    ponta.style.opacity = frac <= 0.0005 ? '0' : '';
  }

  function definir(restante) {
    restanteAtual = restante;
    fracReal = Math.max(0, Math.min(1, restante / TOTAL));
    // Quem define o tempo de verdade encerra a varredura que ainda estiver no
    // meio: o relógio correndo manda no anel.
    if (!varredura) fracMostrada = fracReal;
    const seg = segundosNoMostrador(restante);
    if (seg !== ultimoSegundo) {
      inteiro.textContent = String(seg);
      // Os riscos dos segundos que já passaram apagam: o mostrador inteiro diz
      // quanto sobrou, e não só o anel.
      const gastos = 60 - seg;
      riscos.forEach((r, i) => r.classList.toggle('gasto', i < gastos));
      // Nos últimos dez, o número dá um salto a cada segundo, junto com o tique.
      if (seg > 0 && seg <= 10 && seg < ultimoSegundo && !menosMovimento()) {
        inteiro.animate([{ scale: '1.28' }, { scale: '1' }], { duration: 320, easing: 'cubic-bezier(.2,.9,.3,1)' });
      }
      ultimoSegundo = seg;
    }
    raiz.classList.toggle('aud-crono--reta', restante <= RETA && restante > 0);
    if (!varredura) desenhar(fracMostrada);
  }

  /**
   * Um passo por quadro: a varredura da abertura e a tremida dos últimos
   * segundos. A tremida é `translate` — propriedade separada de `transform` e
   * de `scale` —, para não disputar com a entrada nem com o tranco do estouro.
   */
  function animar(dt) {
    t += dt;
    if (varredura) {
      const u = Math.min(1, (performance.now() - varredura.t0) / VARREDURA_MS);
      fracMostrada = fracReal * (1 - Math.pow(1 - u, 3));
      desenhar(fracMostrada);
      if (u >= 1) {
        varredura.pronto();
        varredura = null;
      }
    }
    if (!menosMovimento() && restanteAtual > 0 && restanteAtual <= TREME) {
      // 1 px no começo dos cinco segundos, 6 px no fim. Dois senos de
      // frequências que não se casam (53 e 71 rad/s): a tremida não vira um
      // balanço regular, que o olho leria como enfeite.
      const amp = 1 + 5 * (1 - restanteAtual / TREME);
      raiz.style.translate = `${(Math.sin(t * 53) * amp).toFixed(2)}px ${(Math.cos(t * 71) * amp * 0.6).toFixed(2)}px`;
    } else if (raiz.style.translate) {
      raiz.style.translate = '';
    }
  }

  definir(TOTAL);

  return {
    no: raiz,
    /** O mostrador: é dali que saem a fumaça e as faíscas do estouro. */
    face: raiz.querySelector('.aud-crono-face'),
    definir,
    animar,
    get restante() {
      return restanteAtual;
    },
    /** O "painel ligando": o anel enche no sentido do relógio, de vazio a cheio. */
    async varredura(roteiro) {
      if (menosMovimento()) {
        fracMostrada = fracReal;
        desenhar(fracMostrada);
        return;
      }
      await roteiro.aguardar(
        new Promise((pronto) => {
          varredura = { t0: performance.now(), pronto };
        })
      );
    },
    /** O tempo acabou: o vidro trinca, a coroa salta, e o cronômetro dá um tranco. */
    estourar() {
      varredura?.pronto();
      varredura = null;
      definir(0);
      raiz.style.translate = '';
      raiz.classList.remove('aud-crono--reta');
      raiz.classList.add('aud-crono--estourou');
      if (menosMovimento()) return;
      raiz.animate([{ scale: '1' }, { scale: '1.14', offset: 0.25 }, { scale: '.95', offset: 0.6 }, { scale: '1' }], {
        duration: 520,
        easing: 'ease-out',
      });
      coroa.animate(
        [
          { transform: 'none', opacity: 1 },
          { transform: 'translate(46px, -70px) rotate(38deg)', opacity: 1, offset: 0.35 },
          { transform: 'translate(96px, 160px) rotate(150deg)', opacity: 0 },
        ],
        { duration: 1100, easing: 'cubic-bezier(.3,.6,.6,1)', fill: 'forwards' }
      );
    },
    /** O relógio parou: os segundos piscam três vezes. */
    parar() {
      raiz.classList.remove('aud-crono--parado');
      void raiz.offsetWidth;
      raiz.classList.add('aud-crono--parado');
    },
  };
}
