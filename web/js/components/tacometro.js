// O relógio da pergunta, que virou conta-giros.
//
// Vai de 60 a 0 segundos; a faixa vermelha começa nos 15, que é onde a reta
// final começa. O arco muda de azul para âmbar na metade e para vermelho no
// último quarto. E o ponteiro tem MASSA: uma mola levemente subamortecida
// persegue o alvo, e no vermelho ele treme, como ponteiro de motor no limite.
// No zero o motor estoura — o ponteiro bate no fim da escala e volta.
//
// Os números grandes do meio são HTML, e não `<text>` do SVG, por dois
// motivos medidos no protótipo:
//
//   - o Chrome pintava `<text>` de SVG com `scale` animado na escala do
//     primeiro quadro (1,25x maior e deslocado), embora o layout estivesse
//     certo — por isso também a entrada do mostrador é só opacidade;
//   - texto de SVG não passa pelo piso de legibilidade (`fonte()`), e o rótulo
//     SEGUNDOS chegava a 6px de tela num notebook.
//
// Os números da escala continuam no SVG, com tamanho que já passa do piso na
// menor tela atendida (26 unidades num mostrador de 296px: 19px de palco,
// 12,8px de tela a 0,667).

import { el, fonte } from '../widgets.js';
import { menosMovimento } from '../anim.js';
import { garantirGradientes } from './losango.js';
import { T } from '../textos.js';

const C = 200;
const A0 = -135;
const A1 = 135;
const TOTAL = 60000;
const RETA = 15000;

const angDe = (restante) => A0 + (1 - restante / TOTAL) * (A1 - A0);
const polar = (r, a) => {
  const rad = (a * Math.PI) / 180;
  return [C + r * Math.sin(rad), C - r * Math.cos(rad)];
};
const arcoD = (r, a0, a1) => {
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

/** O tempo como o mostrador escreve: inteiro e décimo, separados. */
function partes(restante) {
  const d = Math.round(Math.max(0, restante) / 100);
  return [String(Math.floor(d / 10)), `,${d % 10}`];
}

/**
 * @param {object} [opcoes]
 * @param {number} [opcoes.tamanho] a largura do mostrador, em px do palco
 */
export function Tacometro({ tamanho = 370 } = {}) {
  garantirGradientes();

  let s = `<svg viewBox="0 0 400 400" width="${tamanho}" height="${tamanho}" aria-hidden="true">`;
  s += '<circle cx="200" cy="200" r="197" fill="url(#lz-cromo)"/><circle cx="200" cy="200" r="186" fill="#050b1c"/>';
  s += '<circle class="aud-taco-face" cx="200" cy="200" r="182" fill="url(#lz-face)"/>';
  s += `<path class="aud-taco-zona" d="${arcoD(176, angDe(RETA), A1)}"/>`;
  for (let seg = 0; seg <= 60; seg++) {
    const a = angDe(seg * 1000);
    const maior = seg % 10 === 0;
    const medio = seg % 5 === 0;
    const [x0, y0] = polar(maior ? 144 : medio ? 152 : 158, a);
    const [x1, y1] = polar(168, a);
    const classe = `aud-taco-risco${maior ? ' maior' : medio ? ' medio' : ''}${seg * 1000 <= RETA ? ' quente' : ''}`;
    s += `<line class="${classe}" x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"/>`;
    if (maior) {
      const [lx, ly] = polar(121, a);
      s += `<text class="aud-taco-num${seg * 1000 <= RETA ? ' quente' : ''}" x="${lx.toFixed(1)}" y="${(ly + 9).toFixed(1)}">${seg}</text>`;
    }
  }
  s += `<path class="aud-taco-trilho" d="${arcoD(92, A0, A1)}"/><path class="aud-taco-arco" d="${arcoD(92, A0, A0 + 0.01)}"/>`;
  s +=
    `<g class="aud-taco-agulha" transform="rotate(${A0} 200 200)">` +
    '<polygon points="194.5,214 205.5,214 201.6,38 198.4,38" fill="url(#lz-agulha)"/>' +
    '<circle cx="200" cy="200" r="22" fill="url(#lz-cromo)"/><circle cx="200" cy="200" r="10" fill="#0b0f18"/></g>';
  s += '<ellipse cx="200" cy="112" rx="150" ry="66" fill="#fff" opacity=".05"/></svg>';

  const k = tamanho / 400;
  const inteiro = el('span', { class: 'aud-taco-int', text: '60', style: { fontSize: fonte(Math.round(52 * k * 1.05)) } });
  const decimo = el('span', { class: 'aud-taco-dec', text: ',0', style: { fontSize: fonte(Math.round(26 * k * 1.05)) } });
  const leitura = el('div', { class: 'ff-text aud-taco-leitura', style: { top: `${Math.round(300 * k)}px` } }, [inteiro, decimo]);
  const rotulo = el('div', {
    class: 'ff-text aud-taco-rotulo',
    text: T('segundos'),
    style: { top: `${Math.round(362 * k)}px`, fontSize: fonte(Math.round(14 * k * 1.1)) },
  });

  const raiz = el('div', { class: 'aud-tacometro aud-oculta', style: { width: `${tamanho}px`, height: `${tamanho}px` } });
  raiz.innerHTML = s; // só números calculados aqui; nenhum texto de fora
  raiz.append(leitura, rotulo);

  const agulha = raiz.querySelector('.aud-taco-agulha');
  const arco = raiz.querySelector('.aud-taco-arco');

  let alvo = A0;
  let ang = A0;
  let vAng = 0;
  let t = 0;
  let restanteAtual = TOTAL;

  function definir(restante) {
    restanteAtual = restante;
    alvo = angDe(Math.max(0, restante));
    const [i, d] = partes(restante);
    if (inteiro.textContent !== i) inteiro.textContent = i;
    if (decimo.textContent !== d) decimo.textContent = d;
    arco.setAttribute('d', arcoD(92, A0, Math.max(A0 + 0.01, alvo)));
    const frac = restante / TOTAL;
    arco.style.stroke = frac > 0.5 ? '#3E8BFF' : frac > 0.25 ? '#FFB400' : '#FF3B30';
    raiz.classList.toggle('aud-taco--reta', restante <= RETA && restante > 0);
  }

  /**
   * Um passo da mola do ponteiro. Rigidez 170 e atrito 17: ~2 Hz, com um
   * pouquinho de passagem do ponto — o bastante para o ponteiro parecer peça, e
   * pouco para ele não ficar balançando na leitura. No vermelho, dois senos
   * rápidos (47 e 83 rad/s) somados ao alvo fazem a tremida de motor no limite.
   */
  function animar(dt) {
    t += dt;
    let alvoVivo = alvo;
    if (!menosMovimento() && raiz.classList.contains('aud-taco--reta')) {
      alvoVivo += Math.sin(t * 47) * 0.9 + Math.sin(t * 83) * 0.5;
    }
    vAng += (170 * (alvoVivo - ang) - 17 * vAng) * dt;
    ang += vAng * dt;
    if (menosMovimento()) ang = alvoVivo;
    agulha.setAttribute('transform', `rotate(${ang.toFixed(2)} 200 200)`);
  }

  definir(TOTAL);

  return {
    no: raiz,
    definir,
    animar,
    get restante() {
      return restanteAtual;
    },
    /** O "painel ligando": o ponteiro varre a escala inteira e volta. */
    async varredura(roteiro) {
      if (menosMovimento()) return;
      const guardado = alvo;
      alvo = A1;
      await roteiro.pausa(620);
      alvo = guardado;
    },
    /** O motor estourou: o ponteiro bate além do fim e volta ao fim. */
    estourar() {
      alvo = A1 + 7;
      vAng = 900;
      raiz.classList.remove('aud-taco--reta');
      raiz.classList.add('aud-taco--estourou');
      setTimeout(() => {
        alvo = A1;
      }, 280);
    },
    /** O relógio parou: a leitura pisca três vezes. */
    parar() {
      raiz.classList.remove('aud-taco--parado');
      void raiz.offsetWidth;
      raiz.classList.add('aud-taco--parado');
    },
  };
}
