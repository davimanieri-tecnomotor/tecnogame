// Port of lib/pages/instrucoes/instrucoes_widget.dart
//
// Plays the instruction video; after 13s (or when "Pular instruções" is
// pressed) it goes to the transition video with tipo = 1.

import {
  Align,
  Column,
  Container,
  InkWell,
  Padding,
  Stack,
  StackAlign,
  Txt,
  VideoPlayer,
  boxShadow,
  color,
  decorationImage,
  el,
  linearGradient,
  unfocus,
  SW,
  SH,
} from '../widgets.js';
import { TH, style } from '../theme.js';
import { L } from '../i18n.js';
import { playSound } from '../audio.js';
import { goNamed, serializeParam } from '../router.js';
import {
  AnimationInfo,
  AnimationTrigger,
  Curves,
  ScaleEffect,
  animateOnActionTrigger,
  animateOnPageLoad,
  delayed,
} from '../anim.js';

const NEXT = () => goNamed('telaVideoTransisao', { queryParameters: { tipo: serializeParam(1) } });

export function InstrucoesWidget() {
  const model = {};
  let left = false;

  const animationsMap = {
    containerOnPageLoadAnimation: new AnimationInfo({
      loop: true,
      reverse: true,
      trigger: AnimationTrigger.onPageLoad,
      applyInitialState: true,
      effectsBuilder: () => [
        ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 600.0, begin: [1.0, 1.0], end: [1.05, 1.05] }),
      ],
    }),
    containerOnActionTriggerAnimation: new AnimationInfo({
      trigger: AnimationTrigger.onActionTrigger,
      applyInitialState: true,
      effectsBuilder: () => [
        ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 200.0, begin: [1.0, 1.0], end: [0.9, 0.9] }),
        ScaleEffect({ curve: Curves.easeInOut, delay: 200.0, duration: 200.0, begin: [0.9, 0.9], end: [1.0, 1.0] }),
      ],
    }),
  };

  const skipButton = InkWell({
    onTap: async () => {
      playSound(model, 'soundPlayer', 'assets/audios/adriantnt_u_click.mp3', 1.0);
      animationsMap.containerOnActionTriggerAnimation.controller.forward();
      left = true;
      NEXT();
    },
    child: Container({
      width: 450.0,
      height: 100.0,
      boxShadow: boxShadow({ blurRadius: 4.0, color: color(0x33000000), offset: [0.0, 2.0] }),
      gradient: linearGradient({
        colors: [color(0xFF0051FF), color(0xFF3471F4)],
        stops: [0.0, 1.0],
        begin: [1.0, 0.17],
        end: [-1.0, -0.17],
      }),
      borderRadius: 8.0,
      alignment: [0.0, 0.0],
      child: Align({
        alignment: [0.0, 0.0],
        child: Txt(L('ii6e477y') /* Pular instruções */, style('bodyMedium', { fontFamily: 'pirulen', fontSize: 28.0 })),
      }),
    }),
  });
  animateOnPageLoad(skipButton, animationsMap.containerOnPageLoadAnimation);
  animateOnActionTrigger(skipButton, animationsMap.containerOnActionTriggerAnimation);

  const root = el(
    'div',
    { class: 'ff-scaffold', style: { background: TH.primaryBackground } },
    Stack({
      children: [
        Column({
          mainAxisSize: 'max',
          children: [
            Container({
              width: SW * 1.0,
              height: SH * 1.0,
              color: TH.secondaryBackground,
              image: decorationImage('assets/images/BG_Seleo_Equipamento.png', 'cover'),
              child: VideoPlayer({
                path: 'assets/videos/Instrucao.mp4',
                autoPlay: true,
                looping: true,
                showControls: false,
              }),
            }),
          ],
        }),
        StackAlign({
          alignment: [1.0, 1.0],
          child: Padding({ padding: [0.0, 0.0, 32.0, 32.0], child: skipButton }),
        }),
      ],
    })
  );
  root.addEventListener('click', unfocus);

  delayed(13000).then(() => {
    if (!left && root.isConnected) NEXT();
  });

  root.__dispose = () => {
    left = true;
  };

  return root;
}
