// lib/fim/perdeu/perdeu_widget.dart - the loss screen.
//
// A derrota do Brawl Stars que tocava aqui saiu na 3.0, com os outros mp3 de
// terceiros (ver audio.js). O som de quem erra é o da tela da pergunta, sem
// deboche: quem joga é cliente, e não motivo de piada.

import { FimWidget } from './fim.js';

export function PerdeuWidget() {
  return FimWidget({
    heroImage: 'assets/images/Errouu_DAN.png',
    badgeImage: 'assets/images/Errou.png',
    headlineKey: '15q6lthy' /* Problema \nnão resolvido\nVocê perdeu! */,
    buttonKey: 'cu3gopmv' /* REINICIAR */,
    rankingTitleKey: 'jxhibh8c' /* Maiores campeões */,
    resultado: (nome) => `Não foi dessa vez ${nome} 😕`,
  });
}
