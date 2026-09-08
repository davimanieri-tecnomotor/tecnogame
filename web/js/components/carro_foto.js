// Port of lib/pages/components/carro_foto/carro_foto_widget.dart
//
// Shows the photo of the car the wheel landed on. The Dart lists one `if`
// per index with its own image size, so the sizes are kept per entry.

import { ClipRRect, Column, Img, SingleChildScrollView } from '../widgets.js';
import { FFAppState } from '../state.js';
import { transformaAleatorio } from '../functions.js';

/** index (transformaAleatorio) -> image + the exact size from the Dart. */
export const CARRO_FOTOS = {
  0: { src: 'assets/images/FIAT_TORO.png', width: 1235.0, height: 674.0, fit: 'cover' },
  1: { src: 'assets/images/Volvo_XC_60.png', width: 1235.0, height: 674.0, fit: 'cover' },
  2: { src: 'assets/images/BMW.png', width: 1235.0, height: 674.0, fit: 'cover' },
  3: { src: 'assets/images/BYD.png', width: 1235.0, height: 674.0, fit: 'contain' },
  4: { src: 'assets/images/GRAN_SIENA_(1).png', width: 1235.0, height: 674.0, fit: 'cover' },
  5: { src: 'assets/images/VW_-_Constellation.png', width: 1061.89, height: 674.0, fit: 'cover' },
  6: { src: 'assets/images/VW_-_Delivery.png', width: 1235.0, height: 674.0, fit: 'cover' },
  7: { src: 'assets/images/VALTRA_Agrcola.png', width: 1012.17, height: 781.1, fit: 'cover' },
  8: { src: 'assets/images/RENAULT_MASTER.png', width: 1235.0, height: 674.0, fit: 'cover' },
  9: { src: 'assets/images/ACCELO__1117.png', width: 1012.17, height: 781.1, fit: 'cover' },
};

export function CarroFotoWidget() {
  const index = transformaAleatorio(FFAppState.escolha);
  const photo = CARRO_FOTOS[index];

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
