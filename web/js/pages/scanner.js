// Port of lib/pages/escolha/scanner/scanner_widget.dart
//
// "ESCOLHA O EQUIPAMENTO IDEAL" - three scanners on the first row, two on the
// second. Which of them are valid depends on the current question.

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

export function ScannerWidget() {
  const animationsMap = {
    columnOnPageLoadAnimation: new AnimationInfo({
      trigger: AnimationTrigger.onPageLoad,
      effectsBuilder: () => [
        ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 2000.0, begin: [-1.0, -1.0], end: [1.0, 1.0] }),
        FadeEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 2000.0, begin: 0.0, end: 1.0 }),
        MoveEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 2000.0, begin: [0.0, 100.0], end: [0.0, 0.0] }),
      ],
    }),
  };

  const content = Column({
    mainAxisSize: 'max',
    children: [
      Align({
        alignment: [0.0, 0.0],
        child: Padding({
          padding: [0.0, 32.0, 0.0, 40.0],
          child: Txt(
            L('q55g6kdp') /* ESCOLHA O EQUIPAMENTO IDEAL */,
            style('bodyMedium', {
              fontFamily: 'pirulen',
              color: '#FFFFFF',
              fontSize: 46.0,
              letterSpacing: 5.0,
              fontWeight: 400,
            })
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
              child: FerramentaWidget({ ferramenta: '3s', util: true }),
            }),
          }),
          FerramentaWidget({ ferramenta: 'rts', util: true }),
          FerramentaWidget({ ferramenta: 'td90', util: false }),
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
                child: FerramentaWidget({ ferramenta: 'rb', util: true }),
              }),
            }),
            FerramentaWidget({ ferramenta: 'td80', util: true }),
          ],
        }),
      }),
    ],
  });
  animateOnPageLoad(content, animationsMap.columnOnPageLoadAnimation);

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
