// Port of lib/pages/components/carro_foto/carro_foto_widget.dart
//
// A foto do carro que a roleta sorteou. O Dart escrevia um `if` por indice,
// cada um com o seu tamanho de imagem; os tamanhos agora vivem no veiculo.

import { ClipRRect, Column, Img, SingleChildScrollView, el } from '../widgets.js';
import { FFAppState } from '../state.js';

/**
 * @param {object} [opcoes]
 * @param {boolean} [opcoes.comReflexo] a tela do carro sorteado quer o reflexo
 *   de showroom (3.0): uma CÓPIA da foto, clareada, por cima da original, que
 *   só aparece numa faixa que atravessa o carro. Cópia, e não máscara CSS com a
 *   imagem: `mask-image` busca a imagem com CORS, e por `file://` o totem a
 *   recusaria — a luz sumiria e o console acusaria erro.
 *   O nó devolvido carrega o reflexo em `__reflexo`.
 */
export function CarroFotoWidget({ comReflexo = false } = {}) {
  // A foto e o tamanho vinham de uma tabela fixa por indice no Dart; agora
  // saem do veiculo da rodada sorteada (ver deck.js), o que e o que permite a
  // area administrativa trocar de carro.
  const veiculo = FFAppState.slotAtual?.veiculo;
  const photo = veiculo?.imagem
    ? { src: veiculo.imagem, width: veiculo.largura, height: veiculo.altura, fit: veiculo.fit ?? 'cover' }
    : null;

  const reflexo =
    photo && comReflexo
      ? Img(photo.src, { width: photo.width, height: photo.height, fit: photo.fit, style: { position: 'absolute', inset: '0' } })
      : null;
  reflexo?.classList.add('carro-reflexo');
  reflexo?.setAttribute('aria-hidden', 'true');

  const node = SingleChildScrollView({
    child: Column({
      mainAxisSize: 'max',
      children: [
        photo &&
          ClipRRect({
            borderRadius: 8.0,
            child: el('div', { class: 'carro-moldura' }, [
              Img(photo.src, { width: photo.width, height: photo.height, fit: photo.fit }),
              reflexo,
            ]),
          }),
      ],
    }),
  });
  node.__reflexo = reflexo;
  return node;
}
