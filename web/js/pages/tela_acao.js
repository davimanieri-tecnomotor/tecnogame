// Port of lib/pages/acao/tela_acao/tela_acao_widget.dart
//
// The game screen: the fault brief on the left, the scanner panel with the
// answers on the right.
//
// A RETA FINAL. O Dart tinha uma tarefa de fundo que ligava `tempoAcabando`
// 15s DEPOIS DA TELA ABRIR e ninguém lia a bandeira — era um recurso desenhado
// e nunca ligado. Agora quem a liga é o relógio, aos 15s QUE FALTAM (ver
// perguntas_erespostas.js), e ela tem ouvintes: a moldura do defeito esquenta
// aqui, o relógio pulsa e o tique começa lá.

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

export function TelaAcaoWidget() {
  const index = FFAppState.indiceAtual;

  const perguntaText = FFLocalizations.getVariableText({
    ptText: valueOrDefault(FFAppState.questoesBrasil[index]?.pergunta, 'Pergunta um'),
    esText: FFAppState.questoesSpanish[index]?.pergunta,
    enText: FFAppState.questoesEnglish[index]?.pergunta,
  });

  // A moldura branca em volta do enunciado, presa mais abaixo na árvore: é ela
  // que esquenta quando o relógio entra na reta final.
  let molduraDoDefeito = null;

  /**
   * O veículo da rodada, dentro da moldura do defeito.
   *
   * O jogador via o carro por seis segundos, três telas antes, e chegava aqui
   * sem ele — e metade das perguntas do baralho dependem de QUAL veículo é
   * (caminhão, trator e carro de passeio não se diagnosticam igual). A metade
   * de baixo da moldura estava vazia desde o porte: é onde ele cabe sem tirar
   * espaço do enunciado.
   */
  const veiculo = FFAppState.slotAtual?.veiculo;
  const cartaoDoVeiculo = veiculo?.imagem
    ? Column({
        mainAxisSize: 'min',
        crossAxisAlignment: 'center',
        /**
         * O carro fica com TODO o espaço que o enunciado não usou, em vez de um
         * tamanho fixo: numa moldura que muda de altura ocupada a cada pergunta
         * do baralho, número cravado ou sobra buraco ou empurra o texto para
         * fora. Com pergunta curta o carro vem grande; com pergunta longa ele
         * cede — nessa ordem, que é a da importância.
         */
        style: { flex: '1 1 auto', minHeight: 0, width: '100%' },
        children: [
          // A foto é POSICIONADA dentro da sobra, e não medida em 100% dela:
          // altura em porcentagem dentro de um item flexível não resolve — o
          // navegador cai no tamanho natural do arquivo, e o caminhão saía por
          // baixo da moldura. Contra uma caixa posicionada a conta fecha.
          el(
            'div',
            { style: { flex: '1 1 auto', minHeight: 0, width: '100%', position: 'relative' } },
            // `contain` porque as fotos do baralho vêm em tamanhos e proporções
            // quaisquer, inclusive as que o operador envia do computador.
            Img(veiculo.imagem, {
              fit: 'contain',
              style: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
            })
          ),
          Padding({
            padding: [0.0, 14.0, 0.0, 0.0],
            child: Txt(
              veiculo.nome ?? '',
              style('bodyMedium', {
                fontFamily: 'Roboto',
                fontWeight: 700,
                color: '#FFFFFF',
                fontSize: 32.0,
                letterSpacing: 3.0,
                textAlign: 'center',
              })
            ),
          }),
        ],
      })
    : null;

  const panel = PerguntasErespostasWidget({
    aoEntrarNaRetaFinal: () => molduraDoDefeito?.classList.add('ff-moldura--reta-final'),
  });

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
                        child: molduraDoDefeito = Container({
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
                                  // `min`, e nao `max`: enquanto este bloco
                                  // pedia a moldura inteira, o que sobrava para
                                  // o carro era o que a divisao de encolhimento
                                  // deixasse — uma foto pequena no meio de um
                                  // vazio grande.
                                  mainAxisSize: 'min',
                                  crossAxisAlignment: 'center',
                                  style: { flexShrink: 0 },
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
                                cartaoDoVeiculo,
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

  // A partida começa com o relógio cheio; quem ligar `tempoAcabando` daqui em
  // diante é o próprio relógio.
  FFAppState.tempoAcabando = false;

  root.__dispose = () => {
    panel.__dispose?.();
  };

  return root;
}
