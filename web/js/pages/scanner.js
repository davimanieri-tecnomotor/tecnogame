// Port of lib/pages/escolha/scanner/scanner_widget.dart
//
// "ESCOLHA O EQUIPAMENTO IDEAL" - three scanners on the first row, two on the
// second. Which of them are valid depends on the current question.
//
// A ENTRADA. O Dart escalava o bloco inteiro de [-1, -1] ate [1, 1] — escala
// negativa e ESPELHAMENTO, entao os cinco equipamentos nasciam invertidos,
// encolhiam ate sumir num ponto e voltavam desvirados, os cinco de uma vez. Era
// o mesmo defeito da tela do carro.
//
// Agora eles pousam um a um, na ordem de leitura. Numa tela cuja unica pergunta
// e "qual destes?", as opcoes chegando em sequencia sao o convite a escolher;
// chegando juntas, sao uma imagem que apareceu.

import { Align, Column, Container, Padding, Row, Txt, color, decorationImage, el, unfocus } from '../widgets.js';
import { style } from '../theme.js';
import { L } from '../i18n.js';
import { FerramentaWidget } from '../components/ferramenta.js';
import {
  AnimationInfo,
  AnimationTrigger,
  Curves,
  FadeEffect,
  MoveEffect,
  ScaleEffect,
  animateOnPageLoad,
} from '../anim.js';

/** O titulo chega primeiro, e sozinho: e ele que faz a pergunta. */
const entradaDoTitulo = () =>
  new AnimationInfo({
    trigger: AnimationTrigger.onPageLoad,
    applyInitialState: true,
    effectsBuilder: () => [
      FadeEffect({ curve: Curves.easeOut, delay: 60.0, duration: 340.0, begin: 0.0, end: 1.0 }),
      MoveEffect({ curve: Curves.easeOut, delay: 60.0, duration: 420.0, begin: [0.0, -26.0], end: [0.0, 0.0] }),
    ],
  });

/**
 * Um equipamento pousando. `ordem` e a posicao na leitura (0 a 4).
 *
 * A escala passa de 1.04 antes de assentar: sem esse exagero curto a peca
 * parece colada na tela, e nao pousada nela.
 */
const entradaDaFerramenta = (ordem) => {
  const atraso = 300.0 + ordem * 90.0;
  return new AnimationInfo({
    trigger: AnimationTrigger.onPageLoad,
    applyInitialState: true,
    effectsBuilder: () => [
      FadeEffect({ curve: Curves.easeOut, delay: atraso, duration: 240.0, begin: 0.0, end: 1.0 }),
      MoveEffect({ curve: Curves.easeOut, delay: atraso, duration: 400.0, begin: [0.0, 52.0], end: [0.0, 0.0] }),
      ScaleEffect({ curve: Curves.easeOut, delay: atraso, duration: 400.0, begin: [0.88, 0.88], end: [1.04, 1.04] }),
      ScaleEffect({
        curve: Curves.easeInOut,
        delay: atraso + 400.0,
        duration: 200.0,
        begin: [1.04, 1.04],
        end: [1.0, 1.0],
      }),
    ],
  });
};

export function ScannerWidget() {
  /**
   * Cada equipamento entra dentro de um involucro, e nao no proprio no.
   *
   * O `FerramentaWidget` ja carrega a animacao de aperto do toque, e
   * `applyInitialState` escreve o quadro 0 no estilo inline — um `opacity: 0`
   * que so fica escondido enquanto a animacao corre. Empilhar as duas no mesmo
   * elemento e como a resposta certa sumiu da tela da pergunta. Em pai e filho,
   * uma nao alcanca a outra.
   */
  let ordem = 0;
  const pousando = (ferramenta) => {
    const caixa = el('div', { class: 'ff-ferramenta-entra' }, ferramenta);
    animateOnPageLoad(caixa, entradaDaFerramenta(ordem++));
    return caixa;
  };

  const content = Column({
    mainAxisSize: 'max',
    children: [
      Align({
        alignment: [0.0, 0.0],
        child: Padding({
          padding: [0.0, 32.0, 0.0, 40.0],
          child: animateOnPageLoad(
            Txt(
              L('q55g6kdp') /* ESCOLHA O EQUIPAMENTO IDEAL */,
              style('bodyMedium', {
                fontFamily: 'pirulen',
                color: '#FFFFFF',
                fontSize: 46.0,
                letterSpacing: 5.0,
                fontWeight: 400,
              })
            ),
            entradaDoTitulo()
          ),
        }),
      }),
      Row({
        mainAxisSize: 'min',
        mainAxisAlignment: 'center',
        crossAxisAlignment: 'start',
        children: [
          Align({
            alignment: [0.0, 0.0],
            child: Padding({
              padding: [1.0, 0.0, 0.0, 0.0],
              child: pousando(FerramentaWidget({ ferramenta: '3s', util: true })),
            }),
          }),
          pousando(FerramentaWidget({ ferramenta: 'rts', util: true })),
          pousando(FerramentaWidget({ ferramenta: 'td90', util: false })),
        ],
      }),
      Padding({
        padding: [0.0, 0.0, 0.0, 30.0],
        child: Row({
          mainAxisSize: 'min',
          mainAxisAlignment: 'center',
          crossAxisAlignment: 'start',
          children: [
            Align({
              alignment: [0.0, 0.0],
              child: Padding({
                padding: [1.0, 0.0, 0.0, 0.0],
                child: pousando(FerramentaWidget({ ferramenta: 'rb', util: true })),
              }),
            }),
            pousando(FerramentaWidget({ ferramenta: 'td80', util: true })),
          ],
        }),
      }),
    ],
  });

  const root = el(
    'div',
    { class: 'ff-scaffold', style: { background: color(0xFF1D1D2B) } },
    Container({
      width: Infinity,
      height: Infinity,
      image: decorationImage('assets/images/BG_Seleo_Equipamento.png', 'cover'),
      child: Padding({
        padding: [0.0, 36.0, 0.0, 0.0],
        style: { flex: '1 1 auto', minHeight: 0 },
        child: Column({ mainAxisSize: 'max', mainAxisAlignment: 'center', children: [content] }),
      }),
    })
  );
  root.addEventListener('click', unfocus);
  return root;
}
