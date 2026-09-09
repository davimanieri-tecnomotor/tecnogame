// Port of lib/pages/acao/tela_acao/tela_acao_widget.dart
//
// The game screen: the fault brief on the left, the scanner panel with the
// answers on the right. A background task flips `tempoAcabando` after 15s
// (write-only state in the original) and then waits another 15s.

import {
  Align,
  ClipRRect,
  Column,
  Container,
  Flexible,
  Img,
  Padding,
  Row,
  Stack,
  Txt,
  TransformRotate,
  color,
  decorationImage,
  degrees,
  el,
  valueOrDefault,
} from '../widgets.js';
import { style } from '../theme.js';
import { FFLocalizations, L } from '../i18n.js';
import { FFAppState } from '../state.js';
import { PerguntasErespostasWidget } from '../components/perguntas_erespostas.js';
import { delayed } from '../anim.js';

export function TelaAcaoWidget() {
  const index = FFAppState.indiceAtual;

  const perguntaText = FFLocalizations.getVariableText({
    ptText: valueOrDefault(FFAppState.questoesBrasil[index]?.pergunta, 'Pergunta um'),
    esText: FFAppState.questoesSpanish[index]?.pergunta,
    enText: FFAppState.questoesEnglish[index]?.pergunta,
  });

  const panel = PerguntasErespostasWidget();

  const root = el(
    'div',
    { class: 'ff-scaffold', style: { background: color(0xFF001B56) } },
    Container({
      width: Infinity,
      height: Infinity,
      child: Stack({
        children: [
          Row({
            mainAxisSize: 'max',
            mainAxisAlignment: 'spaceBetween',
            height: Infinity,
            children: [
              Flexible({
                flex: 1,
                child: Container({
                  width: Infinity,
                  height: Infinity,
                  color: color(0xFF001B56),
                  image: decorationImage('assets/images/BG_Seleo_Equipamento.png', 'cover'),
                  child: Stack({
                    children: [
                      Padding({
                        padding: [86.0, 86.0, 68.0, 68.0],
                        style: { width: '100%', height: '100%' },
                        child: Container({
                          width: Infinity,
                          height: Infinity,
                          color: color(0x10FFFFFF),
                          borderRadius: 24.0,
                          border: '2px solid #FFFFFF',
                          child: Padding({
                            padding: [56.0, 46.0, 56.0, 46.0],
                            style: { width: '100%', height: '100%' },
                            child: Column({
                              mainAxisSize: 'max',
                              mainAxisAlignment: 'spaceEvenly',
                              children: [
                                Column({
                                  mainAxisSize: 'max',
                                  crossAxisAlignment: 'center',
                                  children: [
                                    Align({
                                      alignment: [0.0, 0.0],
                                      child: Txt(
                                        L('yeby7x4r') /* DEFEITO */,
                                        style('bodyMedium', {
                                          fontFamily: 'Roboto Mono',
                                          fontWeight: 600,
                                          color: color(0xFFFF000D),
                                          fontSize: 70.0,
                                          letterSpacing: 10.0,
                                        })
                                      ),
                                    }),
                                    Padding({
                                      padding: [0.0, 36.0, 0.0, 0.0],
                                      child: Txt(
                                        L('iuseamae') /* Problema do cliente: */,
                                        style('bodyMedium', {
                                          fontFamily: 'Paralucent',
                                          color: '#FFFFFF',
                                          fontSize: 18.0,
                                          letterSpacing: 2.0,
                                          fontWeight: 300,
                                          fontStyle: 'italic',
                                          textAlign: 'left',
                                        })
                                      ),
                                    }),
                                    Align({
                                      alignment: [0.0, 0.0],
                                      child: Txt(
                                        perguntaText,
                                        style('bodyMedium', {
                                          fontFamily: 'Paralucent',
                                          color: '#FFFFFF',
                                          fontSize: 30.0,
                                          letterSpacing: 2.0,
                                          fontWeight: 500,
                                          textAlign: 'center',
                                        })
                                      ),
                                    }),
                                  ],
                                }),
                              ],
                            }),
                          }),
                        }),
                      }),
                      TransformRotate({
                        angle: degrees(338.0),
                        child: ClipRRect({
                          borderRadius: 8.0,
                          child: Img('assets/images/Selo_2.png', { width: 376.4, height: 321.0, fit: 'cover' }),
                        }),
                      }),
                    ],
                  }),
                }),
              }),
              Flexible({ flex: 1, child: panel }),
            ],
          }),
        ],
      }),
    })
  );

  // Future.wait([...]) on page load: flip tempoAcabando at 15s, then idle.
  let left = false;
  (async () => {
    await delayed(15000);
    if (left) return;
    FFAppState.tempoAcabando = true;
    await delayed(15000);
  })();

  root.__dispose = () => {
    left = true;
    panel.__dispose?.();
  };

  return root;
}
