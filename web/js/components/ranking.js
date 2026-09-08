// Port of lib/pages/components/ranking/ranking_widget.dart
//
// The idle-attract ranking that pops over the cadastro screen after 45s.
// It reads `usuarios where venceu == true orderBy tempo desc limit 15` and
// slow-scrolls the list up and down forever (60s cycle, 30s each way).
// Tapping anywhere pops it.

import {
  Align,
  ClipRRect,
  Column,
  Container,
  Expanded,
  FutureBuilder,
  Img,
  InkWell,
  Padding,
  Row,
  SingleChildScrollView,
  Txt,
  decorationImage,
  valueOrDefault,
} from '../widgets.js';
import { TH, style } from '../theme.js';
import { L } from '../i18n.js';
import { pop } from '../dialog.js';
import { queryUsuariosVencedores } from '../backend.js';
import { formatMillisecondsToTime } from '../functions.js';
import { AnimationInfo, AnimationTrigger, Curves, ScaleEffect, animateOnPageLoad, delayed } from '../anim.js';
import { InstantTimer } from '../timer.js';
import { ScrollController } from '../forms.js';

/**
 * @param {object} props
 * @param {Function} [props.acao] The `acao` component parameter. It is declared
 *   in the Dart and passed in from cadastro, but never invoked there - kept
 *   for parity so the call site reads the same.
 */
export function RankingWidget({ acao } = {}) {
  void acao;

  const animationsMap = {
    imageOnPageLoadAnimation: new AnimationInfo({
      loop: true,
      reverse: true,
      trigger: AnimationTrigger.onPageLoad,
      effectsBuilder: () => [
        ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 600.0, begin: [0.9, 0.9], end: [1.0, 1.0] }),
      ],
    }),
  };

  const scrollController = new ScrollController();
  let instantTimer = null;

  const close = () => {
    instantTimer?.cancel();
    pop();
  };

  const build = (listausers) => {
    const rows = listausers.map((item, index) =>
      Padding({
        padding: [0.0, 0.0, 0.0, 32.0],
        child: Row({
          mainAxisSize: 'min',
          mainAxisAlignment: 'center',
          children: [
            Txt(String(index + 1), style('bodyMedium', { fontFamily: 'pirulen', fontSize: 32.0 })),
            Txt(L('ucnq60p8') /* - */, style('bodyMedium', { fontFamily: 'pirulen', fontSize: 32.0 })),
            Expanded({ child: Txt(item.nome, style('bodyMedium', { fontFamily: 'pirulen', fontSize: 32.0 })) }),
            Txt(
              valueOrDefault(formatMillisecondsToTime(item.tempo), '000000'),
              style('bodyMedium', { fontFamily: 'pirulen', fontSize: 32.0 })
            ),
          ],
        }),
      })
    );

    const scroller = SingleChildScrollView({
      controller: scrollController,
      child: Column({
        mainAxisSize: 'max',
        children: [
          Padding({
            padding: [0.0, 0.0, 0.0, 32.0],
            child: Txt(L('mj19n2hr') /* Rank dos melhores */, style('bodyMedium', { fontFamily: 'pirulen', fontSize: 42.0 })),
          }),
          InkWell({
            onTap: close,
            child: Column({ mainAxisSize: 'max', mainAxisAlignment: 'start', children: rows }),
          }),
        ],
      }),
    });

    // The 60s cycle starts 2s after the widget appears.
    delayed(2000).then(() => {
      if (!scroller.isConnected) return;
      instantTimer = InstantTimer.periodic({
        duration: 60000,
        startImmediately: true,
        callback: async () => {
          await scrollController.animateTo(scrollController.maxScrollExtent, { duration: 30000 });
          await scrollController.animateTo(0, { duration: 30000 });
        },
      });
    });

    return InkWell({
      onTap: close,
      child: Container({
        width: Infinity,
        height: Infinity,
        color: TH.secondaryBackground,
        image: decorationImage('assets/images/BG_Seleo_Equipamento.png', 'cover'),
        child: Column({
          mainAxisSize: 'max',
          mainAxisAlignment: 'center',
          children: [
            Align({
              alignment: [0.0, 0.0],
              child: Container({
                width: 1765.99,
                alignment: [0.0, 0.0],
                child: Align({
                  alignment: [0.0, 0.0],
                  child: Column({
                    mainAxisSize: 'max',
                    mainAxisAlignment: 'center',
                    children: [
                      Row({
                        mainAxisSize: 'max',
                        mainAxisAlignment: 'spaceBetween',
                        children: [
                          Column({
                            mainAxisSize: 'max',
                            children: [
                              animateOnPageLoad(
                                ClipRRect({
                                  borderRadius: 8.0,
                                  child: Img('assets/images/Selo_2.png', { width: 611.2, height: 399.2, fit: 'cover' }),
                                }),
                                animationsMap.imageOnPageLoadAnimation
                              ),
                            ],
                          }),
                          Container({
                            width: 975.4,
                            height: 962.9,
                            child: InkWell({ onTap: close, child: scroller }),
                          }),
                        ],
                      }),
                    ],
                  }),
                }),
              }),
            }),
          ],
        }),
      }),
    });
  };

  return Container({
    width: 1920,
    height: 1080,
    child: FutureBuilder({ future: queryUsuariosVencedores({ limit: 15 }), builder: build, fill: true }),
  });
}
