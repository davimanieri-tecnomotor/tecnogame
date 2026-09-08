// lib/fim/ganhou/ganhou_widget.dart - the win screen.

import { FimWidget } from './fim.js';

export function GanhouWidget() {
  return FimWidget({
    sound: 'assets/audios/victoryff.swf.mp3',
    heroImage: 'assets/images/Acertou_DAN.png',
    badgeImage: 'assets/images/Acertou.png',
    badgeHeight: 296.7,
    headlineKey: 'a6zzenfh' /* Problema \nResolvido\nVocê Ganhou!! */,
    headlineAlignment: [-0.88, 0.38],
    buttonKey: '7gm0teyw' /* REINICIAR */,
    rankingTitleKey: '61r6v2nk' /* Maiores campeões */,
    rankingAlignment: [0.9, -0.7],
    rankingWidth: 720.37,
    rankingCrossAxis: 'center',
    listCrossAxis: 'center',
    rowAlignment: 'start',
    rowGap: 16.0,
    resultado: (nome) => `Parabéns ${nome} você venceu!`,
  });
}
