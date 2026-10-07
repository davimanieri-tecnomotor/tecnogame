// O Firebase, carregado sob demanda.
//
// Um lugar só para subir o SDK, porque quatro assuntos diferentes o usam: o
// ranking (`backend.js`, coleção `usuarios`), o conteúdo do jogo (`nuvem.js`,
// coleção `conteudo`), as respostas com telefone (`admin/respostas.js`,
// coleção `contatos`) e as fotos de veículo no Storage (`admin/imagens.js`).
// Os três últimos escrevem ou leem só com login de verdade.
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

import { CONFIG, motivoDaNuvemDesligada } from './config.js';

const VERSAO_SDK = '10.12.2';
const CDN = `https://www.gstatic.com/firebasejs/${VERSAO_SDK}`;

let promessa = null;

/** O erro da última vez que o SDK não subiu — só para `motivoSemFirebase`. */
let falhaDoSdk = null;

/** `true` quando vale a pena tentar: ligado na config e fora do disco. */
export const podeUsarNuvem = () =>
  Boolean(CONFIG.useFirestore) && typeof location !== 'undefined' && location.protocol !== 'file:';

/**
 * Por que `firebase()` devolve (ou devolveu) null, numa frase para o
 * operador — ou `null` se nada impediu. Separa os dois jeitos de ficar sem
 * Firebase, que para quem está na frente da tela parecem o mesmo: a nuvem
 * desligada por configuração, e o SDK que não desceu da CDN (a feira sem
 * internet, ou uma rede que bloqueia o gstatic).
 */
export function motivoSemFirebase() {
  const desligada = motivoDaNuvemDesligada();
  if (desligada) return desligada;
  if (!falhaDoSdk) return null;
  return `o SDK do Firebase não carregou da CDN (${falhaDoSdk?.message ?? falhaDoSdk}). Sem internet, ou a rede bloqueia www.gstatic.com.`;
}

/**
 * Sobe o SDK e devolve `{ app, db, fs, auth, fa }`, ou `null` se não der.
 *
 * `fs` e `fa` são os módulos inteiros (firestore e auth): o SDK v10 é modular,
 * então quem chama usa `fs.collection(db, ...)`, `fa.signInWithEmailAndPassword(auth, ...)`.
 *
 * O módulo de autenticação voltou a carregar: a aba de respostas do painel
 * lê `contatos`, e a regra desta coleção exige `request.auth != null` (ver
 * firebase/firestore.rules — nome e telefone de jogador de verdade não é
 * conteúdo de jogo, e por isso não segue a decisão de escrita aberta do
 * baralho). Ver `admin/respostas.js`.
 */
export function firebase() {
  if (!podeUsarNuvem()) return Promise.resolve(null);
  if (promessa) return promessa;

  promessa = (async () => {
    const [{ initializeApp }, fs, fa] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-firestore.js`),
      import(`${CDN}/firebase-auth.js`),
    ]);
    const app = initializeApp(CONFIG.firebaseOptions);
    falhaDoSdk = null;
    return { app, db: fs.getFirestore(app), fs, auth: fa.getAuth(app), fa };
  })().catch((erro) => {
    console.warn('Firebase indisponível; seguindo só com o armazenamento local.', erro);
    falhaDoSdk = erro;
    // Zera para uma próxima tentativa poder acontecer (rede que voltou).
    promessa = null;
    return null;
  });

  return promessa;
}

let promessaDoStorage = null;

/**
 * Sobe o módulo do Cloud Storage e devolve `{ storage, st }`, ou `null` se não
 * der. `st` é o módulo inteiro, do mesmo jeito que `fs` e `fa` em `firebase()`.
 *
 * Separado de `firebase()` porque só o painel o usa — para enviar e apagar
 * foto de veículo (ver admin/imagens.js). O jogo só MOSTRA a foto, e para isso
 * o endereço basta: nenhum totem precisa baixar este módulo.
 */
export function firebaseStorage() {
  if (promessaDoStorage) return promessaDoStorage;

  promessaDoStorage = (async () => {
    const fb = await firebase();
    if (!fb) {
      promessaDoStorage = null;
      return null;
    }
    const st = await import(`${CDN}/firebase-storage.js`);
    const storage = st.getStorage(fb.app);
    // O SDK insiste por 2 min numa operação e 10 min num envio antes de
    // desistir. Sem rede, isso é o painel parado com "enviando…" na tela —
    // e o Salvar, que confere as fotos antes de gravar, esperando junto.
    storage.maxOperationRetryTime = 15000;
    storage.maxUploadRetryTime = 30000;
    return { storage, st };
  })().catch((erro) => {
    console.warn('Storage do Firebase indisponível; foto enviada fica dentro do baralho.', erro);
    promessaDoStorage = null;
    return null;
  });

  return promessaDoStorage;
}
