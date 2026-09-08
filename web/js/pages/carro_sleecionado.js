// Port of lib/pages/carro_sleecionado/carro_sleecionado_widget.dart
//
// Reveals the car the wheel landed on, then fades out and moves to the scanner
// picker after 6s.

import { Align, Column, Container, Padding, Txt, decorationImage, el, color, unfocus } from '../widgets.js';
import { style } from '../theme.js';
import { FFAppState } from '../state.js';
import { transformaAleatorio } from '../functions.js';
import { CarroFotoWidget } from '../components/carro_foto.js';
import { goNamed, TransitionInfo, PageTransitionType } from '../router.js';
import {
  AnimationInfo,
  AnimationTrigger,
  Curves,
  FadeEffect,
  MoveEffect,
  ScaleEffect,
  animateOnActionTrigger,
  animateOnPageLoad,
  delayed,
} from '../anim.js';

/** index -> the name printed under the photo, exactly as spelled in the Dart. */
const CARRO_NOMES = {
  0: 'FIAT TORO - 10GF',
  1: 'Volvo XC-60',
  2: 'BMW 118i',
  3: 'BYD',
  4: 'Fiat Gran Sienna',
  5: 'VW 24-280',
  6: 'VW Delivery',
  7: 'Valtra',
  8: 'Renaut Master',
  9: 'Mercedes Accelo 917',
};

export function CarroSleecionadoWidget() {
  let left = false;

  const animationsMap = {
    columnOnPageLoadAnimation: new AnimationInfo({
      trigger: AnimationTrigger.onPageLoad,
      applyInitialState: true,
      effectsBuilder: () => [
        ScaleEffect({ curve: Curves.easeInOut, delay: 600.0, duration: 2000.0, begin: [-1.0, -1.0], end: [1.0, 1.0] }),
        FadeEffect({ curve: Curves.easeInOut, delay: 600.0, duration: 2000.0, begin: 0.0, end: 1.0 }),
        MoveEffect({ curve: Curves.easeInOut, delay: 600.0, duration: 2000.0, begin: [0.0, 100.0], end: [0.0, 0.0] }),
      ],
    }),
    columnOnActionTriggerAnimation: new AnimationInfo({
      trigger: AnimationTrigger.onActionTrigger,
      applyInitialState: true,
      effectsBuilder: () => [
        FadeEffect({ curve: Curves.easeOut, delay: 0.0, duration: 1220.0, begin: 1.0, end: 0.0 }),
      ],
    }),
  };

  const index = transformaAleatorio(FFAppState.escolha);

  const content = Column({
    mainAxisSize: 'max',
    children: [
      CarroFotoWidget(),
      Padding({
        padding: [0.0, 52.0, 0.0, 0.0],
        child: Txt(CARRO_NOMES[String(index)] ?? 'SEM CARRO SELECIONADO', {
          ...style('bodyMedium', {
            fontFamily: 'Roboto',
            fontWeight: 700,
            color: '#FFFFFF',
            fontSize: 70.0,
            letterSpacing: 5.0,
          }),
        }),
      }),
    ],
  });
  animateOnPageLoad(content, animationsMap.columnOnPageLoadAnimation);
  animateOnActionTrigger(content, animationsMap.columnOnActionTriggerAnimation);

  const root = el(
    'div',
    { class: 'ff-scaffold', style: { background: color(0xFF1D1D2B) } },
    Container({
      width: Infinity,
      height: Infinity,
      image: decorationImage('assets/images/BG_Seleo_Equipamento.png', 'cover'),
      child: Column({
        mainAxisSize: 'min',
        mainAxisAlignment: 'center',
        height: Infinity,
        children: [Align({ alignment: [0.0, 0.0], child: content })],
      }),
    })
  );
  root.addEventListener('click', unfocus);

  delayed(6000).then(async () => {
    if (left || !root.isConnected) return;
    await animationsMap.columnOnActionTriggerAnimation.controller.forward();
    if (left || !root.isConnected) return;
    goNamed('scanner', {
      extra: {
        __transition_info__: new TransitionInfo({
          hasTransition: true,
          transitionType: PageTransitionType.fade,
          duration: 0,
        }),
      },
    });
  });

  root.__dispose = () => {
    left = true;
  };

  return root;
}
