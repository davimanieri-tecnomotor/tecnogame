// Port of lib/fim/ganhou/ganhou_widget.dart and lib/fim/perdeu/perdeu_widget.dart
//
// The two end screens are the same layout with different art, copy, sound,
// alignments and gaps, so the shared build lives here and the differences are
// the `spec` passed in by ganhou.js / perdeu.js.
//
// Both read the top 5 winners and show the first 3, then REINICIAR sends the
// WhatsApp message, clears the run state and restarts at the transition video.
//
// E as duas passaram a CONTAR QUAL ERA A RESPOSTA CERTA. O jogo julgava e ia
// embora sem dizer — num jogo feito para ensinar técnico a usar scanner, quem
// errava saía sem ter aprendido nada, que é o contrário do ponto. Quem acertou
// também ganha a confirmação, que é metade do prazer. O que mostrar vem de
// `FFAppState.resultado`, escrito na hora do veredito.

import {
  Align,
  ClipRRect,
  Column,
  Container,
  Expanded,
  FutureBuilder,
  Img,
  Padding,
  Row,
  Stack,
  StackAlign,
  Txt,
  color,
  decorationImage,
  divide,
  el,
  maybeHandleOverflow,
  unfocus,
  valueOrDefault,
} from '../widgets.js';
import { TH, style } from '../theme.js';
import { L } from '../i18n.js';
import { T } from '../textos.js';
import { CadastroStruct, FFAppState } from '../state.js';
import { formatMillisecondsToTime, transformaNumero } from '../functions.js';
import { playSound } from '../audio.js';
import { enviarMensagemZap, queryUsuariosVencedores } from '../backend.js';
import { goNamed, serializeParam, TransitionInfo, PageTransitionType } from '../router.js';
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
import { FFButtonWidget } from '../forms.js';

const slideIn = (delay, duration) =>
  new AnimationInfo({
    trigger: AnimationTrigger.onPageLoad,
    effectsBuilder: () => [
      MoveEffect({ curve: Curves.easeInOut, delay, duration, begin: [-100.0, 0.0], end: [0.0, 0.0] }),
      FadeEffect({ curve: Curves.easeInOut, delay, duration, begin: 0.0, end: 1.0 }),
    ],
  });

export function FimWidget(spec) {
  const model = {};

  const animationsMap = {
    imageOnPageLoadAnimation1: slideIn(0.0, 600.0),
    imageOnPageLoadAnimation2: slideIn(0.0, 600.0),
    textOnPageLoadAnimation: slideIn(0.0, 600.0),
    buttonOnPageLoadAnimation: new AnimationInfo({
      trigger: AnimationTrigger.onPageLoad,
      applyInitialState: true,
      effectsBuilder: () => [
        MoveEffect({ curve: Curves.easeInOut, delay: 2400.0, duration: 2000.0, begin: [-100.0, 0.0], end: [0.0, 0.0] }),
        FadeEffect({ curve: Curves.easeInOut, delay: 2400.0, duration: 2000.0, begin: 0.0, end: 1.0 }),
      ],
    }),
    buttonOnActionTriggerAnimation: new AnimationInfo({
      trigger: AnimationTrigger.onActionTrigger,
      applyInitialState: true,
      effectsBuilder: () => [
        ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 200.0, begin: [1.0, 1.0], end: [0.9, 0.9] }),
        ScaleEffect({ curve: Curves.easeInOut, delay: 200.0, duration: 200.0, begin: [0.9, 0.9], end: [1.0, 1.0] }),
      ],
    }),
    containerOnPageLoadAnimation: new AnimationInfo({
      trigger: AnimationTrigger.onPageLoad,
      effectsBuilder: () => [
        FadeEffect({ curve: Curves.easeInOut, delay: 600.0, duration: 2000.0, begin: 0.0, end: 1.0 }),
        MoveEffect({ curve: Curves.easeIn, delay: 600.0, duration: 2000.0, begin: [100.0, 0.0], end: [0.0, 0.0] }),
      ],
    }),
  };

  const restart = async () => {
    playSound(model, 'soundPlayer2', 'assets/audios/undertale-select-sound.mp3', 0.6);
    animationsMap.buttonOnActionTriggerAnimation.controller.forward();

    await enviarMensagemZap({
      numero: transformaNumero(FFAppState.cadastro.telefone),
      resultado: spec.resultado(FFAppState.cadastro.nome),
    });

    FFAppState.scannerEscolhido = '';
    FFAppState.tempoAcabando = false;
    FFAppState.cadastro = new CadastroStruct();
    FFAppState.ajuda = 0;
    FFAppState.resultado = null;

    goNamed('telaVideoTransisao', {
      queryParameters: { tipo: serializeParam(0) },
      extra: {
        __transition_info__: new TransitionInfo({
          hasTransition: true,
          transitionType: PageTransitionType.fade,
          duration: 300,
        }),
      },
    });
  };

  const build = (winners) => {
    const listaVencedores = winners.slice(0, 3);

    const rows = listaVencedores.map((item, index) =>
      Row({
        mainAxisSize: 'max',
        mainAxisAlignment: spec.rowAlignment,
        children: divide(
          [
            Txt(`${index + 1} - `, style('bodyMedium', { fontFamily: 'pirulen', fontSize: 32.0, fontWeight: 400 })),
            Expanded({
              child: Txt(
                maybeHandleOverflow(item.nome, { maxChars: 13, replacement: '…' }),
                style('bodyMedium', { fontFamily: 'pirulen', fontSize: 32.0, fontWeight: 400 })
              ),
            }),
            Txt(
              valueOrDefault(formatMillisecondsToTime(item.tempo), '000000'),
              style('bodyMedium', { fontFamily: 'pirulen', fontSize: 32.0, fontWeight: 400 })
            ),
          ],
          spec.rowGap
        ),
      })
    );

    const button = FFButtonWidget({
      onPressed: restart,
      text: L(spec.buttonKey),
      options: {
        width: 560.0,
        height: 85.0,
        padding: [16.0, 0.0, 16.0, 0.0],
        color: color(0xFF0051FF),
        textStyle: style('titleSmall', {
          fontFamily: 'pirulen',
          color: '#FFFFFF',
          fontSize: 32.0,
          letterSpacing: 10.0,
          fontWeight: 400,
        }),
        elevation: 0.0,
        borderSide: { color: '#FFFFFF', width: 1 },
        borderRadius: 8.0,
      },
    });
    animateOnPageLoad(button, animationsMap.buttonOnPageLoadAnimation);
    animateOnActionTrigger(button, animationsMap.buttonOnActionTriggerAnimation);

    const hero = animateOnPageLoad(
      ClipRRect({
        borderRadius: 8.0,
        child: Img(spec.heroImage, { width: 1058.8, height: 869.9, fit: 'contain' }),
      }),
      animationsMap.imageOnPageLoadAnimation1
    );

    const badge = animateOnPageLoad(
      ClipRRect({
        borderRadius: 8.0,
        child: Img(spec.badgeImage, { width: 565.5, height: spec.badgeHeight, fit: 'cover' }),
      }),
      animationsMap.imageOnPageLoadAnimation2
    );

    const headline = animateOnPageLoad(
      Txt(
        L(spec.headlineKey),
        style('bodyMedium', {
          fontFamily: 'pirulen',
          color: '#FFFFFF',
          fontSize: 46.0,
          letterSpacing: 5.0,
          fontWeight: 400,
          textAlign: 'left',
        })
      ),
      animationsMap.textOnPageLoadAnimation
    );

    // O gabarito, contado ao jogador. Entra atrasado de propósito (1,1s): a
    // manchete chega primeiro, a explicação depois — na ordem em que a pessoa
    // quer as duas coisas.
    const resultado = FFAppState.resultado;
    const gabarito =
      resultado?.numeroCerto && resultado?.textoCerto
        ? animateOnPageLoad(
            Container({
              // 520 e não mais: o botão REINICIAR começa em x≈615 do palco, e
              // o canto de baixo à esquerda é o único vazio das duas telas.
              width: 520.0,
              color: color(0xB3000E24),
              borderRadius: 12.0,
              border: `2px solid ${resultado.acertou ? '#2FBF71' : '#FF5963'}`,
              child: Padding({
                padding: [28.0, 20.0, 28.0, 20.0],
                child: Column({
                  mainAxisSize: 'max',
                  crossAxisAlignment: 'start',
                  children: [
                    Txt(
                      `${T('respostaCerta')}: ${T('alternativa')} ${resultado.numeroCerto}`,
                      style('bodyMedium', {
                        fontFamily: 'pirulen',
                        color: resultado.acertou ? '#2FBF71' : '#FF9A94',
                        fontSize: 22.0,
                        letterSpacing: 2.0,
                        fontWeight: 400,
                        textAlign: 'left',
                      })
                    ),
                    Padding({
                      padding: [0.0, 10.0, 0.0, 0.0],
                      child: Txt(
                        resultado.textoCerto,
                        style('bodyMedium', {
                          fontFamily: 'Open Sans',
                          color: '#FFFFFF',
                          fontSize: 22.0,
                          fontWeight: 400,
                          textAlign: 'left',
                        })
                      ),
                    }),
                    // Só para quem errou: sem isto a pessoa não liga o que
                    // escolheu ao que era certo.
                    !resultado.acertou && resultado.textoEscolhido
                      ? Padding({
                          padding: [0.0, 14.0, 0.0, 0.0],
                          child: Txt(
                            `${T('voceRespondeu')}: ${T('alternativa')} ${resultado.numeroEscolhido}`,
                            style('bodyMedium', {
                              fontFamily: 'Open Sans',
                              color: '#B9C6DA',
                              fontSize: 18.0,
                              fontWeight: 400,
                              textAlign: 'left',
                            })
                          ),
                        })
                      : null,
                  ],
                }),
              }),
            }),
            slideIn(1100.0, 700.0)
          )
        : null;

    const ranking = animateOnPageLoad(
      Container({
        width: spec.rankingWidth,
        height: 224.0,
        child: Column({
          mainAxisSize: 'max',
          crossAxisAlignment: spec.rankingCrossAxis,
          children: [
            Padding({
              padding: [0.0, 0.0, 0.0, 16.0],
              child: Txt(L(spec.rankingTitleKey), style('bodyMedium', { fontFamily: 'pirulen', fontSize: 42.0 })),
            }),
            Column({ mainAxisSize: 'max', crossAxisAlignment: spec.listCrossAxis, children: rows }),
          ],
        }),
      }),
      animationsMap.containerOnPageLoadAnimation
    );

    return Stack({
      children: [
        Container({
          width: Infinity,
          height: Infinity,
          image: decorationImage('assets/images/BG_Seleo_Equipamento.png', 'cover'),
          child: Column({
            mainAxisSize: 'max',
            mainAxisAlignment: 'center',
            children: [
              Align({
                alignment: [0.0, 0.0],
                child: Column({
                  mainAxisSize: 'min',
                  children: [Align({ alignment: [0.0, 1.0], child: hero })],
                }),
              }),
              Padding({ padding: [0.0, 32.0, 0.0, 0.0], child: button }),
            ],
          }),
        }),
        StackAlign({ alignment: [-0.83, -0.8], child: badge }),
        StackAlign({
          alignment: spec.headlineAlignment,
          child: Padding({ padding: [0.0, 32.0, 0.0, 40.0], child: headline }),
        }),
        StackAlign({ alignment: spec.rankingAlignment, child: ranking }),
        // Ancorado por baixo (y perto de 1): o cartão cresce com o tamanho da
        // resposta e a borda de baixo fica onde está, em vez de descer para
        // fora do palco.
        gabarito ? StackAlign({ alignment: [-0.897, 0.93], child: gabarito }) : null,
      ],
    });
  };

  const root = el(
    'div',
    { class: 'ff-scaffold', style: { background: TH.primaryBackground } },
    FutureBuilder({ future: queryUsuariosVencedores({ limit: 5 }), builder: build, fill: true })
  );
  root.addEventListener('click', unfocus);

  playSound(model, 'soundPlayer1', spec.sound, 1.0);

  root.__dispose = () => {
    model.soundPlayer1?.stop();
  };

  return root;
}
