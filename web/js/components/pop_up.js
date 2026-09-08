// Port of lib/pages/components/pop_up/pop_up_widget.dart
//
// The support hint popup. `tipo` selects the logo + photo pair, `texto` is the
// hint text for the current question in the current language.

import {
  Align,
  ClipRRect,
  Column,
  Container,
  Img,
  InkWell,
  Padding,
  Row,
  Stack,
  StackAlign,
  Txt,
  decorationImage,
  divide,
  valueOrDefault,
} from '../widgets.js';
import { style } from '../theme.js';
import { pop } from '../dialog.js';
import {
  AnimationInfo,
  AnimationTrigger,
  Curves,
  FadeEffect,
  MoveEffect,
  ScaleEffect,
  animateOnActionTrigger,
  animateOnPageLoad,
} from '../anim.js';

/** tipo -> the logo image on the left of the header. */
const LOGOS = {
  'Apoio Tecnico': 'assets/images/Apoio_1.png',
  'Cursos EAD': 'assets/images/Cursos_EAD_1.png',
  Comunidade: 'assets/images/Comunidade_3.png',
  Representante: 'assets/images/Representanbtes.png',
  TecnomotorTV: 'assets/images/TecnomotorTV_(1).png',
};

/** tipo -> the photo on the right, with its own size in the Dart. */
const PHOTOS = {
  Representante: { src: 'assets/images/Representantes_(1).png', width: 357.2, height: 188.1 },
  TecnomotorTV: { src: 'assets/images/TecnmotorTV.png', width: 293.7, height: 206.1 },
  Comunidade: { src: 'assets/images/Comunidade.png', width: 293.7, height: 206.1 },
  'Cursos EAD': { src: 'assets/images/Instrutores_(1)_(1).png', width: 293.7, height: 206.1 },
  'Apoio Tecnico': { src: 'assets/images/Apoio_(1).png', width: 293.7, height: 206.1 },
};

export function PopUpWidget({ texto, tipo } = {}) {
  const animationsMap = {
    stackOnPageLoadAnimation: new AnimationInfo({
      trigger: AnimationTrigger.onPageLoad,
      effectsBuilder: () => [
        FadeEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 1200.0, begin: 0.0, end: 1.0 }),
        MoveEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 1200.0, begin: [0.0, 100.0], end: [0.0, 0.0] }),
      ],
    }),
    imageOnActionTriggerAnimation: new AnimationInfo({
      trigger: AnimationTrigger.onActionTrigger,
      applyInitialState: true,
      effectsBuilder: () => [
        ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 200.0, begin: [1.0, 1.0], end: [0.9, 0.9] }),
        ScaleEffect({ curve: Curves.easeInOut, delay: 200.0, duration: 200.0, begin: [0.9, 0.9], end: [1.0, 1.0] }),
      ],
    }),
  };

  const logo = LOGOS[tipo];
  const photo = PHOTOS[tipo];

  const closeButton = InkWell({
    onTap: async () => {
      await animationsMap.imageOnActionTriggerAnimation.controller.forward();
      pop();
    },
    child: ClipRRect({
      borderRadius: 8.0,
      child: Img('assets/images/Icones_Suporte_(1).png', { width: 200.0, height: 200.0, fit: 'cover' }),
    }),
  });
  animateOnActionTrigger(closeButton, animationsMap.imageOnActionTriggerAnimation);

  const root = Stack({
    children: [
      StackAlign({
        alignment: [0.0, 0.0],
        child: Container({
          width: 1304.5,
          height: 689.6,
          constraints: { minWidth: '200px' },
          image: decorationImage('assets/images/Pop_Up.png', 'cover'),
          child: Column({
            mainAxisSize: 'max',
            mainAxisAlignment: 'start',
            children: [
              Row({
                mainAxisSize: 'max',
                mainAxisAlignment: 'center',
                crossAxisAlignment: 'center',
                children: divide(
                  [
                    Column({
                      mainAxisSize: 'max',
                      children: [
                        logo &&
                          ClipRRect({
                            borderRadius: 8.0,
                            child: Img(logo, { width: 400.0, height: 100.0, fit: 'contain' }),
                          }),
                      ],
                    }),
                    Column({
                      mainAxisSize: 'max',
                      children: [
                        photo &&
                          ClipRRect({
                            borderRadius: 8.0,
                            child: Img(photo.src, { width: photo.width, height: photo.height, fit: 'cover' }),
                          }),
                      ],
                    }),
                  ],
                  32.0
                ),
              }),
              Align({
                alignment: [0.0, 0.0],
                child: Padding({
                  padding: [0.0, 62.0, 0.0, 0.0],
                  child: Container({
                    width: 902.36,
                    alignment: [0.0, 0.0],
                    child: Txt(valueOrDefault(texto, 'Texto'), style('bodyMedium', { color: '#000000', fontSize: 32.0 })),
                  }),
                }),
              }),
            ],
          }),
        }),
      }),
      StackAlign({ alignment: [0.52, 0.72], child: closeButton }),
    ],
  });

  return animateOnPageLoad(root, animationsMap.stackOnPageLoadAnimation);
}
