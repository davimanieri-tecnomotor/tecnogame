// lib/fim/perdeu/perdeu_widget.dart - the loss screen.

import { FimWidget } from './fim.js';

export function PerdeuWidget() {
  return FimWidget({
    sound: 'assets/audios/brawl-stars-defeat.mp3',
    heroImage: 'assets/images/Errouu_DAN.png',
    badgeImage: 'assets/images/Errou.png',
    badgeHeight: 296.66,
    headlineKey: '15q6lthy' /* Problema \nnão resolvido\nVocê perdeu! */,
    headlineAlignment: [-0.78, 0.38],
    buttonKey: 'cu3gopmv' /* REINICIAR */,
    rankingTitleKey: 'jxhibh8c' /* Maiores campeões */,
    rankingAlignment: [0.98, -0.7],
    rankingWidth: 723.27,
    rankingCrossAxis: 'start',
    listCrossAxis: 'end',
    rowAlignment: 'end',
    rowGap: 32.0,
    resultado: (nome) => `Não foi dessa vez ${nome} 😕`,
  });
}
