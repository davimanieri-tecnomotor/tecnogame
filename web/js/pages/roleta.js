// Port of lib/pages/escolha/roleta/roleta_widget.dart
//
// The prize wheel. Pressing GIRAR draws a new `escolha` (1.0 - 1.9, never one
// of the last five), spins the wheel by that many turns over 5s, remembers the
// draw and moves on to the selected car.

import {
  Align,
  ClipRRect,
  Column,
  Container,
  Img,
  InkWell,
  Padding,
  Stack,
  StackAlign,
  Txt,
  color,
  decorationImage,
  el,
  linearGradient,
  unfocus,
} from '../widgets.js';
import { style } from '../theme.js';
import { L } from '../i18n.js';
import { FFAppState } from '../state.js';
import { numeroAleatorio } from '../functions.js';
import { usaArteOriginal } from '../deck.js';
import { rodaGerada } from '../roda.js';
import { playSound } from '../audio.js';
import { goNamed, TransitionInfo, PageTransitionType } from '../router.js';
import {
  AnimationInfo,
  AnimationTrigger,
  Curves,
  FadeEffect,
  RotateEffect,
  ScaleEffect,
  animateOnActionTrigger,
  animateOnPageLoad,
  delayed,
  menosMovimento,
} from '../anim.js';

export function RoletaWidget() {
  const model = { apertaButton: true };
  // O giro leva 5s e só então navega. Se a tela sair nesse meio-tempo (o botão
  // Voltar do navegador, ou o endereço trocado à mão), a navegação de dentro do
  // `onTap` chegaria depois e arrancaria o jogador de onde ele estivesse. É o
  // mesmo guarda que as outras telas de espera usam.
  let left = false;

  const animationsMap = {
    columnOnPageLoadAnimation: new AnimationInfo({
      trigger: AnimationTrigger.onPageLoad,
      effectsBuilder: () => [
        ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 600.0, begin: [5.0, 5.0], end: [1.0, 1.0] }),
        FadeEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 600.0, begin: 0.0, end: 1.0 }),
      ],
    }),
    // effectsBuilder is null in the Dart: the spin's effects are supplied at
    // the animateOnActionTrigger call site so they can read FFAppState().escolha.
    containerOnActionTriggerAnimation1: new AnimationInfo({
      trigger: AnimationTrigger.onActionTrigger,
      applyInitialState: true,
      effectsBuilder: null,
    }),
    containerOnActionTriggerAnimation2: new AnimationInfo({
      trigger: AnimationTrigger.onActionTrigger,
      applyInitialState: true,
      effectsBuilder: () => [
        ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 200.0, begin: [1.0, 1.0], end: [0.9, 0.9] }),
        ScaleEffect({ curve: Curves.easeInOut, delay: 200.0, duration: 200.0, begin: [0.9, 0.9], end: [1.0, 1.0] }),
      ],
    }),
  };

  // A arte da roleta e um PNG com as dez fatias ja desenhadas, uma por veiculo.
  // Ela continua valendo enquanto a lista de veiculos for a original — mexer so
  // no texto das perguntas nao invalida o desenho. Fora disso a roda e gerada,
  // porque o PNG mostraria carros que nao estao mais em jogo.
  // O Dart declara a roda com 836.1x946 e a arte com 864.3x893.2, mas o Stack
  // que a contem tem 839.8 de altura, e no Flutter um filho nunca passa da
  // restricao que recebe: a caixa que aparece na tela e 836.1x839.8. Declarar
  // os numeros crus aqui fazia a roda estourar o Stack, que recorta com
  // Clip.hardEdge — sumiam ~50px do fundo do disco e, junto, a seta inteira,
  // que se alinha pelo fundo do Stack. Entao a caixa ja entra resolvida.
  const RODA_LARGURA = 836.1;
  const RODA_ALTURA = 839.8;

  const arte = usaArteOriginal(FFAppState.baralho)
    ? ClipRRect({
        borderRadius: 20.0,
        child: Img('assets/images/Roleta.png', { width: RODA_LARGURA, height: RODA_ALTURA, fit: 'cover' }),
      })
    : rodaGerada(FFAppState.baralho?.slots ?? [], { largura: RODA_LARGURA, altura: RODA_ALTURA });

  const wheel = Container({
    width: RODA_LARGURA,
    height: RODA_ALTURA,
    color: color(0x00FFFFFF),
    borderRadius: 22.0,
    alignment: [0.0, 0.0],
    child: arte,
  });
  // `effects:` is read when forward() runs, so the rotation always uses the
  // value drawn a moment earlier.
  animateOnActionTrigger(wheel, animationsMap.containerOnActionTriggerAnimation1, null);
  animationsMap.containerOnActionTriggerAnimation1.effectsBuilder = () =>
    // Cinco segundos de tela inteira girando é exatamente o que quem pediu
    // menos movimento no sistema não quer ver. Sem efeito nenhum o `forward()`
    // resolve na hora, e o jogo segue para o carro sorteado: o resultado do
    // sorteio é o mesmo, a roda só não gira.
    menosMovimento()
      ? []
      : [RotateEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 5000.0, begin: 0.0, end: FFAppState.escolha })];

  const spinButton = InkWell({
    onTap: async () => {
      animationsMap.containerOnActionTriggerAnimation2.controller.forward();
      if (!model.apertaButton || left) return;

      model.apertaButton = false;
      FFAppState.escolha = numeroAleatorio([...FFAppState.listaEscolhas], FFAppState.totalSlots);
      playSound(model, 'soundPlayer', 'assets/audios/roleta-normal-1_2GXmNRPk.mp3', 0.6);
      // Este `await` E sequencia: sao os 5s de giro, e o jogo so segue depois.
      await animationsMap.containerOnActionTriggerAnimation1.controller.forward();
      await delayed(1000);
      if (left || !root.isConnected) return;

      // Keep a rolling window of the last five draws so the same car can't come
      // up again too soon.
      if (FFAppState.listaEscolhas.length >= 5) {
        FFAppState.removeFromListaEscolhas(FFAppState.listaEscolhas[0]);
      }
      FFAppState.addToListaEscolhas(FFAppState.escolha);

      model.apertaButton = true;
      goNamed('carroSleecionado', {
        extra: {
          __transition_info__: new TransitionInfo({
            hasTransition: true,
            transitionType: PageTransitionType.fade,
            duration: 0,
          }),
        },
      });
    },
    child: Container({
      width: 428.0,
      height: 68.07,
      gradient: linearGradient({
        colors: [color(0xFFEF3939), color(0xFF700505)],
        stops: [0.0, 1.0],
        begin: [0.0, -1.0],
        end: [0, 1.0],
      }),
      borderRadius: 16.0,
      child: Align({
        alignment: [0.0, 0.0],
        child: Txt(L('x6urz5cq') /* GIRAR A ROLETA */, style('bodyMedium', { fontWeight: 700, fontSize: 32.0 })),
      }),
    }),
  });
  animateOnActionTrigger(spinButton, animationsMap.containerOnActionTriggerAnimation2);

  const content = Column({
    mainAxisSize: 'max',
    crossAxisAlignment: 'center',
    children: [
      Padding({
        padding: [0.0, 0.0, 0.0, 64.0],
        child: Container({
          width: 1821.8,
          height: 839.8,
          child: Stack({
            children: [
              StackAlign({ alignment: [0.0, 0.0], child: wheel }),
              StackAlign({
                alignment: [0.0, 1.0],
                child: Padding({
                  padding: [0.0, 0.0, 0.0, 30.0],
                  child: ClipRRect({
                    borderRadius: 8.0,
                    child: Img('assets/images/Seta_.png', { width: 101.4, height: 85.0, fit: 'cover' }),
                  }),
                }),
              }),
              StackAlign({
                alignment: [0.0, 0.0],
                child: ClipRRect({
                  borderRadius: 24.0,
                  child: Img('assets/images/Logo_Tecnomotor_sem_fundo.png', {
                    width: 100.0,
                    height: 100.0,
                    fit: 'contain',
                    alignment: [0.0, 0.0],
                  }),
                }),
              }),
            ],
          }),
        }),
      }),
      spinButton,
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
      child: Column({
        mainAxisSize: 'min',
        mainAxisAlignment: 'center',
        height: Infinity,
        children: [Align({ alignment: [0.0, 0.0], child: content })],
      }),
    })
  );
  root.addEventListener('click', unfocus);

  root.__dispose = () => {
    left = true;
    model.soundPlayer?.stop();
  };

  return root;
}
