// lib/fim/ganhou/ganhou_widget.dart - the win screen.
//
// A fanfarra de vitória do Final Fantasy que tocava aqui saiu na 3.0, com os
// outros mp3 de terceiros (ver audio.js); a comemoração é sintetizada e
// acontece na própria tela da pergunta.

import { FimWidget } from './fim.js';

export function GanhouWidget() {
  return FimWidget({
    heroImage: 'assets/images/Acertou_DAN.png',
    badgeImage: 'assets/images/Acertou.png',
    headlineKey: 'a6zzenfh' /* Problema \nResolvido\nVocê Ganhou!! */,
    buttonKey: '7gm0teyw' /* REINICIAR */,
    rankingTitleKey: '61r6v2nk' /* Maiores campeões */,
    resultado: (nome) => `Parabéns ${nome} você venceu!`,
  });
}
