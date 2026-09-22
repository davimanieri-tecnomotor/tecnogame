// Port of lib/pages/components/ferramenta/ferramenta_widget.dart
//
// One selectable scanner. The Dart repeats the same block six times, once per
// `ferramenta` value; the differences are only the image, which capability flag
// on the current question gates it, and what `scannerEscolhido` becomes:
//
//   ferramenta | image                     | flag      | scannerEscolhido
//   -----------+---------------------------+-----------+-----------------
//   '3s'       | Rasther_3s_Claro.png      | raster3S  | 'Rasther 3'
//   'td90'     | TD_90_Claro.png           | xtool     | 'Td90'
//   '4s'       | Rasther_3s_Claro.png      | rasher4   | 'Rasther 4'
//   'rb'       | Rasther_Box_Claro.png     | raster3S  | 'RB'
//   'td80'     | TD_90_Claro_(1).png       | xtool     | 'Td80'
//   'rts'      | Rasther_ST_Claro.png      | rasher4   | 'RST'
//
// A disabled scanner is drawn at 0.2 opacity and opens the
// "equipamento inválido" dialog when tapped.

import { ClipRRect, Column, Container, Img, InkWell, Opacity, Stack, StackAlign, color, SW, SH } from '../widgets.js';
import { FFAppState } from '../state.js';
import { playSound } from '../audio.js';
import { showDialog } from '../dialog.js';
import { EquipamentoInvalidoWidget } from './equipamento_invalido.js';
import { goNamed } from '../router.js';
import {
  AnimationInfo,
  AnimationTrigger,
  Curves,
  ScaleEffect,
  animateOnActionTrigger,
} from '../anim.js';

/**
 * Com que equipamento o jogo segue quando o jogador PULA a escolha (ver
 * `pages/scanner.js`). O painel da pergunta troca de pele conforme este valor,
 * e não existe pele "nenhuma": sem um nome conhecido o painel cai no cinza de
 * reserva e fica sem a foto do cabeçalho, que é a cara de tela quebrada.
 */
export const EQUIPAMENTO_PADRAO = 'Rasther 3';

/** O que vai para o registro da partida quando ninguém escolheu nada. */
export const EQUIPAMENTO_PULADO = 'não escolhido';

const TOOLS = {
  '3s': { image: 'assets/images/Rasther_3s_Claro.png', flag: 'raster3S', escolhido: 'Rasther 3', sound: 'soundPlayer1' },
  td90: { image: 'assets/images/TD_90_Claro.png', flag: 'xtool', escolhido: 'Td90', sound: 'soundPlayer2' },
  '4s': { image: 'assets/images/Rasther_3s_Claro.png', flag: 'rasher4', escolhido: 'Rasther 4', sound: 'soundPlayer3' },
  rb: { image: 'assets/images/Rasther_Box_Claro.png', flag: 'raster3S', escolhido: 'RB', sound: 'soundPlayer4' },
  td80: { image: 'assets/images/TD_90_Claro_(1).png', flag: 'xtool', escolhido: 'Td80', sound: 'soundPlayer5' },
  rts: { image: 'assets/images/Rasther_ST_Claro.png', flag: 'rasher4', escolhido: 'RST', sound: 'soundPlayer6' },
};

/**
 * @param {object} props
 * @param {string} props.ferramenta one of the keys above
 * @param {boolean} props.util the `util` component parameter - declared and
 *   passed by scanner.dart but never read inside the Dart widget.
 */
export function FerramentaWidget({ ferramenta, util } = {}) {
  void util;

  const model = {};
  const animationsMap = {
    stackOnActionTriggerAnimation: new AnimationInfo({
      trigger: AnimationTrigger.onActionTrigger,
      applyInitialState: true,
      effectsBuilder: () => [
        ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 200.0, begin: [1.0, 1.0], end: [0.9, 0.9] }),
        ScaleEffect({ curve: Curves.easeInOut, delay: 200.0, duration: 200.0, begin: [0.9, 0.9], end: [1.0, 1.0] }),
      ],
    }),
  };

  const tool = TOOLS[ferramenta];
  const questao = FFAppState.questoesBrasil[FFAppState.indiceAtual];
  const enabled = Boolean(questao?.[tool.flag]);

  const onTap = async () => {
    playSound(model, tool.sound, 'assets/audios/undertale-select-sound.mp3', 0.6);
    animationsMap.stackOnActionTriggerAnimation.controller.forward();
    if (enabled) {
      // O equipamento é escolhido ANTES de navegar. O Dart gravava depois da
      // chamada e só funcionava por acidente: quem monta a próxima tela lê este
      // valor, e bastava a navegação deixar de ceder o passo para a tela do
      // vídeo abrir com o scanner da partida anterior.
      FFAppState.scannerEscolhido = tool.escolhido;
      FFAppState.equipamentoPulado = false;
      goNamed('telaVideoScanner');
    } else {
      await showDialog({ builder: () => EquipamentoInvalidoWidget() });
    }
  };

  const root = Stack({
    children: [
      StackAlign({
        alignment: [-1.0, -1.0],
        child: Container({
          width: 478.0,
          height: 434.0,
          color: color(0x00FFFFFF),
          child: Column({
            mainAxisSize: 'max',
            mainAxisAlignment: 'start',
            children: [
              Opacity({
                opacity: enabled ? 1.0 : 0.2,
                child: InkWell({
                  onTap,
                  child: ClipRRect({
                    borderRadius: 8.0,
                    child: Img(tool.image, { width: SW * 0.25, height: SH * 0.35, fit: 'cover' }),
                  }),
                }),
              }),
            ],
          }),
        }),
      }),
    ],
  });

  return animateOnActionTrigger(root, animationsMap.stackOnActionTriggerAnimation);
}
