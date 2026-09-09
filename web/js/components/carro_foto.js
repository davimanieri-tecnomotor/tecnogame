// Port of lib/pages/components/carro_foto/carro_foto_widget.dart
//
// A foto do carro que a roleta sorteou. O Dart escrevia um `if` por indice,
// cada um com o seu tamanho de imagem; os tamanhos agora vivem no veiculo.

import { ClipRRect, Column, Img, SingleChildScrollView } from '../widgets.js';
import { FFAppState } from '../state.js';


export function CarroFotoWidget() {
  // A foto e o tamanho vinham de uma tabela fixa por indice no Dart; agora
  // saem do veiculo da rodada sorteada (ver deck.js), o que e o que permite a
  // area administrativa trocar de carro.
  const veiculo = FFAppState.slotAtual?.veiculo;
  const photo = veiculo?.imagem
    ? { src: veiculo.imagem, width: veiculo.largura, height: veiculo.altura, fit: veiculo.fit ?? 'cover' }
    : null;

  return SingleChildScrollView({
    child: Column({
      mainAxisSize: 'max',
      children: [
        photo &&
          ClipRRect({
            borderRadius: 8.0,
            child: Img(photo.src, { width: photo.width, height: photo.height, fit: photo.fit }),
          }),
      ],
    }),
  });
}
