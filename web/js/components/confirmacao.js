// Port of lib/pages/components/confirmacao/confirmacao_widget.dart
//
// "Confirmar resposta?" - Cancelar just pops, Confirmar sets
// FFAppState().finalizou = true and pops, which is what tells the caller in
// perguntas_erespostas to score the answer.
//
// MUDANÇA DELIBERADA sobre o Dart: o diálogo agora recebe e mostra a
// alternativa escolhida. No original ele não recebia nada — e ainda por cima
// abre bem em cima da lista de respostas, então quem se distraiu confirmava sem
// ver o que tinha tocado. A caixa cresceu para caber o texto, e por isso a
// altura fixa de 232,6 saiu: com resposta longa ela cortaria.

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
import { T } from '../textos.js';
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

/**
 * @param {object} escolha
 * @param {number} [escolha.numero]  o número que o jogador vê no cartão (1 a 4)
 * @param {string} [escolha.texto]   o enunciado da alternativa escolhida
 */
export function ConfirmacaoWidget({ numero = null, texto = null } = {}) {
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

  // O que o jogador tocou, repetido aqui porque a caixa cobre a lista.
  const escolhida =
    numero != null && texto
      ? Padding({
          padding: [48.0, 20.0, 48.0, 4.0],
          child: Container({
            width: Infinity,
            color: color(0x26FFFFFF),
            borderRadius: 8.0,
            border: '1px solid rgba(255, 255, 255, 0.45)',
            child: Padding({
              padding: [20.0, 14.0, 20.0, 14.0],
              child: Column({
                mainAxisSize: 'max',
                crossAxisAlignment: 'center',
                children: [
                  Txt(
                    `${T('alternativa')} ${numero}`,
                    style('bodyMedium', {
                      fontFamily: 'pirulen',
                      fontSize: 16.0,
                      letterSpacing: 3.0,
                      fontWeight: 400,
                    })
                  ),
                  Padding({
                    padding: [0.0, 8.0, 0.0, 0.0],
                    child: Txt(
                      texto,
                      style('bodyMedium', {
                        fontFamily: 'Open Sans',
                        fontWeight: 400,
                        fontSize: 20.0,
                        textAlign: 'center',
                      })
                    ),
                  }),
                ],
              }),
            }),
          }),
        })
      : null;

  return Align({
    alignment: [0.0, 0.0],
    child: Column({
      mainAxisSize: 'max',
      mainAxisAlignment: 'center',
      children: [
        Container({
          width: 749.9,
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
                      escolhida,
                      Padding({
                        padding: [0.0, 12.0, 0.0, 0.0],
                        child: Txt(
                          // Não é `L('8lqt2gtq')`: aquela frase vem com erro de
                          // concordância do Dart e chama a partida de "game".
                          // Ver o cabeçalho de textos.js.
                          T('confirmarResposta'),
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
                                animationsMap.containerOnActionTriggerAnimation1.controller.forward();
                                pop();
                              },
                            }),
                            button(L('2w7ipz7g') /* Confirmar */, {
                              pageLoadAnimation: animationsMap.containerOnPageLoadAnimation2,
                              actionAnimation: animationsMap.containerOnActionTriggerAnimation2,
                              onTap: async () => {
                                playSound(model, 'soundPlayer2', 'assets/audios/undertale-select-sound.mp3', 1.0);
                                animationsMap.containerOnActionTriggerAnimation2.controller.forward();
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
