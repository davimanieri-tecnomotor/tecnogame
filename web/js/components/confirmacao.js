// Port of lib/pages/components/confirmacao/confirmacao_widget.dart
//
// "Confirmar resposta?" - Cancelar just pops, Confirmar sets
// FFAppState().finalizou = true and pops, which is what tells the caller in
// perguntas_erespostas to score the answer.

import {
  Align,
  Column,
  Container,
  Icon,
  InkWell,
  Padding,
  Row,
  Stack,
  StackAlign,
  Txt,
  color,
  linearGradient,
} from '../widgets.js';
import { style } from '../theme.js';
import { L } from '../i18n.js';
import { pop } from '../dialog.js';
import { FFAppState } from '../state.js';
import { playSound } from '../audio.js';
import {
  AnimationInfo,
  AnimationTrigger,
  Curves,
  ScaleEffect,
  animateOnActionTrigger,
  animateOnPageLoad,
} from '../anim.js';

const pulse = () =>
  new AnimationInfo({
    loop: true,
    reverse: true,
    trigger: AnimationTrigger.onPageLoad,
    applyInitialState: true,
    effectsBuilder: () => [
      ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 600.0, begin: [1.0, 1.0], end: [1.02, 1.02] }),
    ],
  });

const tapFeedback = () =>
  new AnimationInfo({
    trigger: AnimationTrigger.onActionTrigger,
    applyInitialState: true,
    effectsBuilder: () => [
      ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 200.0, begin: [1.0, 1.0], end: [0.9, 0.9] }),
      ScaleEffect({ curve: Curves.easeInOut, delay: 200.0, duration: 200.0, begin: [0.9, 0.9], end: [1.0, 1.0] }),
    ],
  });

const BUTTON_GRADIENT = linearGradient({
  colors: [color(0xFF0051FF), color(0xFF3471F4)],
  stops: [0.0, 1.0],
  begin: [1.0, 0.17],
  end: [-1.0, -0.17],
});

export function ConfirmacaoWidget() {
  const model = {};
  const animationsMap = {
    containerOnPageLoadAnimation1: pulse(),
    containerOnActionTriggerAnimation1: tapFeedback(),
    containerOnPageLoadAnimation2: pulse(),
    containerOnActionTriggerAnimation2: tapFeedback(),
  };

  const button = (label, { onTap, pageLoadAnimation, actionAnimation }) => {
    const node = InkWell({
      onTap,
      child: Container({
        width: 280.0,
        height: 65.0,
        gradient: BUTTON_GRADIENT,
        borderRadius: 8.0,
        border: '1px solid #FFFFFF',
        alignment: [0.0, 0.0],
        child: Align({
          alignment: [0.0, 0.0],
          child: Txt(label, style('bodyMedium', { fontFamily: 'pirulen', fontSize: 22.0 })),
        }),
      }),
    });
    animateOnPageLoad(node, pageLoadAnimation);
    animateOnActionTrigger(node, actionAnimation);
    return node;
  };

  return Align({
    alignment: [0.0, 0.0],
    child: Column({
      mainAxisSize: 'max',
      mainAxisAlignment: 'center',
      children: [
        Container({
          width: 749.9,
          height: 232.6,
          color: color(0xFF0051FF),
          borderRadius: 8.0,
          child: Stack({
            children: [
              StackAlign({
                alignment: [0.0, 0.0],
                child: Padding({
                  padding: [0.0, 32.0, 0.0, 32.0],
                  child: Column({
                    mainAxisSize: 'max',
                    children: [
                      Txt(
                        L('ut066twm') /* Confirmar resposta? */,
                        style('bodyMedium', { fontFamily: 'pirulen', fontSize: 32.0 })
                      ),
                      Padding({
                        padding: [0.0, 8.0, 0.0, 0.0],
                        child: Txt(
                          L('8lqt2gtq') /* Você deseja confirma sua resposta? ... */,
                          style('bodyMedium', { fontFamily: 'Open Sans', fontWeight: 200, fontSize: 18.0 })
                        ),
                      }),
                      Padding({
                        padding: [0.0, 32.0, 0.0, 0.0],
                        child: Row({
                          mainAxisSize: 'max',
                          mainAxisAlignment: 'spaceEvenly',
                          children: [
                            button(L('v7q2sddk') /* Cancelar */, {
                              pageLoadAnimation: animationsMap.containerOnPageLoadAnimation1,
                              actionAnimation: animationsMap.containerOnActionTriggerAnimation1,
                              onTap: async () => {
                                playSound(model, 'soundPlayer1', 'assets/audios/adriantnt_u_click.mp3', 1.0);
                                await animationsMap.containerOnActionTriggerAnimation1.controller.forward();
                                pop();
                              },
                            }),
                            button(L('2w7ipz7g') /* Confirmar */, {
                              pageLoadAnimation: animationsMap.containerOnPageLoadAnimation2,
                              actionAnimation: animationsMap.containerOnActionTriggerAnimation2,
                              onTap: async () => {
                                playSound(model, 'soundPlayer2', 'assets/audios/undertale-select-sound.mp3', 1.0);
                                await animationsMap.containerOnActionTriggerAnimation2.controller.forward();
                                FFAppState.finalizou = true;
                                pop();
                              },
                            }),
                          ],
                        }),
                      }),
                    ],
                  }),
                }),
              }),
              StackAlign({
                alignment: [1.0, -1.0],
                child: Padding({
                  padding: [0.0, 16.0, 16.0, 0.0],
                  child: InkWell({
                    onTap: () => pop(),
                    child: Icon('close', { color: '#FFFFFF', size: 32.0 }),
                  }),
                }),
              }),
            ],
          }),
        }),
      ],
    }),
  });
}
