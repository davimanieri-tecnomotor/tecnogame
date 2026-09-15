// O popup de dica de suporte. `tipo` escolhe o logo e a foto, `texto` e a dica
// da questao no idioma atual.
//
// POR QUE ESTE ARQUIVO NAO E UM PORTE DIRETO DO DART
// O widget original (pop_up_widget.dart) empilhava um Column com um Row
// centralizado e um Padding de 62px por cima de um PNG de fundo com `cover`.
// Na pratica nada caia no lugar: a foto do notebook subia acima da faixa azul,
// o texto encostava na borda de baixo do cartao e vazava, e o X de fechar
// flutuava no meio do cartao (alignment 0.52/0.72). Estava fiel ao Dart e
// quebrado na tela.
//
// Aqui o layout sai da PROPRIA ARTE, medida no pixel (assets/images/Pop_Up.png,
// 1480x767):
//
//   - o cartao e um paralelogramo de largura constante 1234 que desliza 0,3px
//     para a esquerda por pixel de altura;
//   - a faixa azul do cabecalho vai de y 45 a y 172;
//   - o corpo claro vai de y 175 ao fim.
//
// Como os lados sao inclinados, o conteudo vive em duas caixas seguras — o
// retangulo que cabe dentro do paralelogramo na altura de cada uma. Os numeros
// abaixo sao a medicao em px de arte multiplicada pela escala do cartao.

import { el, Img, valueOrDefault } from '../widgets.js';
import { pop } from '../dialog.js';
import {
  AnimationInfo,
  AnimationTrigger,
  Curves,
  FadeEffect,
  MoveEffect,
  animateOnPageLoad,
} from '../anim.js';

/** tipo -> o logo da faixa do cabecalho. */
const LOGOS = {
  'Apoio Tecnico': 'assets/images/Apoio_1.png',
  'Cursos EAD': 'assets/images/Cursos_EAD_1.png',
  Comunidade: 'assets/images/Comunidade_3.png',
  Representante: 'assets/images/Representanbtes.png',
  TecnomotorTV: 'assets/images/TecnomotorTV_(1).png',
};

/** tipo -> a foto do corpo. */
const FOTOS = {
  Representante: 'assets/images/Representantes_(1).png',
  TecnomotorTV: 'assets/images/TecnmotorTV.png',
  Comunidade: 'assets/images/Comunidade.png',
  'Cursos EAD': 'assets/images/Instrutores_(1)_(1).png',
  'Apoio Tecnico': 'assets/images/Apoio_(1).png',
};

/** A arte tem 1480x767; o cartao entra com a MESMA proporcao, para nao cortar. */
const CARTAO = { largura: 1340, altura: 694 };
/** A faixa azul do cabecalho (arte y 45..172). */
const FAIXA = { topo: 41, altura: 115 };
/** O retangulo que cabe na faixa (arte x 250..1345 nas linhas dela). */
const CABECALHO = { esquerda: 226, largura: 991 };
/** O retangulo que cabe no corpo (arte x 215..1230, y 195..720). */
const CORPO = { esquerda: 195, topo: 177, largura: 919, altura: 475 };
/** A foto ocupa a direita do corpo; o texto fica com o que sobra. */
const FOTO = { largura: 300, altura: 212 };
const FOLGA = 48;

const px = (n) => `${n}px`;

export function PopUpWidget({ texto, tipo } = {}) {
  const entrada = new AnimationInfo({
    trigger: AnimationTrigger.onPageLoad,
    effectsBuilder: () => [
      FadeEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 420.0, begin: 0.0, end: 1.0 }),
      MoveEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 420.0, begin: [0.0, 60.0], end: [0.0, 0.0] }),
    ],
  });

  const logo = LOGOS[tipo];
  const foto = FOTOS[tipo];

  /* ------------------------------------------------------------- cabecalho -- */

  const marca = logo
    ? el('div', { class: 'pop-logo', style: { left: px(CABECALHO.esquerda), top: px(FAIXA.topo + 16) } },
        Img(logo, { width: 300, height: FAIXA.altura - 32, fit: 'contain', alignment: [-1.0, 0.0] }))
    : null;

  // O X fica no canto do cabecalho, que e onde se procura por ele — e nao no
  // meio do cartao, como o Dart o punha. 56px de lado da area de toque folgada.
  const fechar = el(
    'div',
    {
      class: 'ff-inkwell pop-fechar',
      role: 'button',
      tabindex: '0',
      'aria-label': 'Fechar',
      style: {
        left: px(CABECALHO.esquerda + CABECALHO.largura - 56),
        top: px(FAIXA.topo + (FAIXA.altura - 56) / 2),
      },
    },
    Img('assets/images/Icones_Suporte_(1).png', { width: 56, height: 56, fit: 'contain' })
  );
  // Fecha na hora. O Dart esperava 400ms de animacao antes de fazer qualquer
  // coisa, o que faz o toque parecer que nao pegou.
  const aoFechar = () => pop();
  fechar.addEventListener('click', (event) => {
    event.stopPropagation();
    aoFechar();
  });
  fechar.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      event.stopPropagation();
      aoFechar();
    }
  });

  /* ----------------------------------------------------------------- corpo -- */

  const dica = el('div', {
    class: 'ff-text pop-texto',
    style: {
      left: px(CORPO.esquerda),
      top: px(CORPO.topo),
      width: px(CORPO.largura - (foto ? FOTO.largura + FOLGA : 0)),
      height: px(CORPO.altura),
    },
    text: valueOrDefault(texto, ''),
  });

  const imagem = foto
    ? el('div', {
        class: 'pop-foto',
        style: {
          left: px(CORPO.esquerda + CORPO.largura - FOTO.largura),
          top: px(CORPO.topo),
          width: px(FOTO.largura),
          height: px(CORPO.altura),
        },
      },
      Img(foto, { width: FOTO.largura, height: FOTO.altura, fit: 'contain' }))
    : null;

  const cartao = el(
    'div',
    {
      class: 'pop-cartao',
      role: 'dialog',
      'aria-modal': 'true',
      style: { width: px(CARTAO.largura), height: px(CARTAO.altura) },
    },
    [marca, fechar, dica, imagem].filter(Boolean)
  );

  return animateOnPageLoad(cartao, entrada);
}
