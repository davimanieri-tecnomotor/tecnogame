// O selo do TecnoGame com as lâmpadas acesas, correndo como letreiro de
// auditório.
//
// A arte (`Selo_2.png`, 1080x1350) já desenha doze lâmpadas brancas no aro. As
// posições abaixo foram MEDIDAS no arquivo, por varredura de pixel — manchas
// quase brancas no aro —, em ordem horária. Por cima de cada uma entra um
// brilho que acende e apaga em sequência; como a arte já as pinta brancas, o
// brilho só precisa somar luz (`screen`), e nunca desenhar a lâmpada.
//
// Dois enquadramentos, porque o selo aparece em dois papéis:
//
//   cover  a caixa de sempre, com `object-fit: cover` — o cadastro continua
//          com o selo exatamente onde e do tamanho que era;
//   justo  recortado rente ao logotipo (x 140..940, y 330..960 da arte), para
//          a tela da pergunta, onde cada pixel do alto é disputado.

import { el } from '../widgets.js';

const ARTE = { w: 1080, h: 1350 };
const JUSTO = { x0: 140, y0: 330, w: 800, h: 630 };

/** As doze lâmpadas, em px da arte, em ordem horária. */
export const LAMPADAS = [
  [403, 453], [468, 422], [542, 413], [621, 431], [685, 465], [733, 784],
  [676, 833], [611, 868], [539, 880], [462, 868], [398, 829], [346, 782],
];

/** O diâmetro do brilho de cada lâmpada, em px da arte. */
const DIAMETRO = 46;

/**
 * @param {object} medidas
 * @param {number} medidas.largura
 * @param {number} [medidas.altura] só no enquadramento `cover`
 * @param {'cover'|'justo'} [medidas.enquadramento]
 */
export function SeloComLampadas({ largura, altura = null, enquadramento = 'justo' }) {
  let k;
  let ox;
  let oy;
  let caixaAltura;
  if (enquadramento === 'cover') {
    caixaAltura = altura ?? largura;
    // A conta do `object-fit: cover` centralizado: a escala que cobre os dois
    // lados, e a sobra dividida por igual.
    k = Math.max(largura / ARTE.w, caixaAltura / ARTE.h);
    ox = (largura - ARTE.w * k) / 2;
    oy = (caixaAltura - ARTE.h * k) / 2;
  } else {
    k = largura / JUSTO.w;
    caixaAltura = JUSTO.h * k;
    ox = -JUSTO.x0 * k;
    oy = -JUSTO.y0 * k;
  }

  const px = (v) => `${v.toFixed(1)}px`;
  // A arte entra como FUNDO da caixa, dimensionada e deslocada, e não como um
  // <img> maior que ela: uma imagem posicionada para fora de uma caixa que
  // recorta conta como conteúdo cortado (ver verify/corte.mjs), e é mesmo —
  // só que de propósito. Como fundo, não há o que cortar.
  const lampadas = LAMPADAS.map(([lx, ly], i) => {
    const no = el('i', {
      class: 'aud-lampada',
      style: { left: px(lx * k + ox), top: px(ly * k + oy) },
    });
    no.style.setProperty('--i', String(i));
    no.style.setProperty('--d', px(DIAMETRO * k));
    return no;
  });

  return el(
    'div',
    {
      class: 'aud-selo',
      role: 'img',
      'aria-label': 'TecnoGame',
      style: {
        width: px(largura),
        height: px(caixaAltura),
        backgroundSize: `${px(ARTE.w * k)} ${px(ARTE.h * k)}`,
        backgroundPosition: `${px(ox)} ${px(oy)}`,
      },
    },
    lampadas
  );
}
