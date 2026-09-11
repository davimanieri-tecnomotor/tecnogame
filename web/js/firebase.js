// O Firebase, carregado sob demanda.
//
// Um lugar só para subir o SDK, porque dois assuntos diferentes o usam: o
// ranking (`backend.js`, coleção `usuarios`) e o conteúdo do jogo (`nuvem.js`,
// coleção `conteudo` + login do operador).
//
// POR QUE `import()` DINÂMICO E NÃO UM ARQUIVO NO REPOSITÓRIO
// O SDK do Firebase vem da CDN do Google como módulo ES. Isso tem uma
// consequência que vale saber antes de contar com ela: `file://` recusa módulo
// ES (origem nula), então **o jogo aberto direto do disco nunca alcança o
// Firestore**. É o mesmo motivo de existir o `bundle.js`.
//
// Na prática: o totem precisa abrir pelo HTTP (o GitHub Pages) para receber o
// baralho publicado de outra máquina. Aberto do disco ele continua jogando —
// com o último baralho que tiver guardado no próprio navegador. Todas as
// funções daqui falham em silêncio nesse caso, e quem chama cai no local.

import { CONFIG } from './config.js';

const VERSAO_SDK = '10.12.2';
const CDN = `https://www.gstatic.com/firebasejs/${VERSAO_SDK}`;

let promessa = null;

/** `true` quando vale a pena tentar: ligado na config e fora do disco. */
export const podeUsarNuvem = () =>
  Boolean(CONFIG.useFirestore) && typeof location !== 'undefined' && location.protocol !== 'file:';

/**
 * Sobe o SDK e devolve `{ app, db, fs }`, ou `null` se não der.
 *
 * `fs` é o módulo inteiro do Firestore: o SDK v10 é modular, então quem chama
 * usa `fs.collection(db, ...)`, `fs.getDoc(...)`.
 *
 * O módulo de autenticação não é carregado: desde que a escrita do baralho
 * deixou de exigir login, ninguém o usa (ver nuvem.js).
 */
export function firebase() {
  if (!podeUsarNuvem()) return Promise.resolve(null);
  if (promessa) return promessa;

  promessa = (async () => {
    const [{ initializeApp }, fs] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-firestore.js`),
    ]);
    const app = initializeApp(CONFIG.firebaseOptions);
    return { app, db: fs.getFirestore(app), fs };
  })().catch((erro) => {
    console.warn('Firebase indisponível; seguindo só com o armazenamento local.', erro);
    // Zera para uma próxima tentativa poder acontecer (rede que voltou).
    promessa = null;
    return null;
  });

  return promessa;
}
