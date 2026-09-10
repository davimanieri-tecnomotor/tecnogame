// Backend switches.
//
// The Dart app wrote every game result into the live Firestore collection
// `usuarios` and sent a WhatsApp message through a production z-api instance.
// Both are wired up in backend.js with the original credentials, but they start
// switched OFF so that opening this port does not touch production data.
//
// Turn `useFirestore` on to get the real shared ranking back (the same project,
// collection and query as the Dart). With it off, results are kept in this
// browser's localStorage and the ranking screens work exactly the same way.

export const CONFIG = {
  /** Read/write the `usuarios` collection in Firestore. */
  useFirestore: false,

  /** POST the "you finished TECNOGAME" WhatsApp message on the end screens. */
  useWhatsApp: false,

  // lib/backend/firebase/firebase_config.dart
  firebaseOptions: {
    apiKey: 'AIzaSyAZTmRXL83WY-KjmtAhsE-ERAdWRkEEKMY',
    authDomain: 'projeto-assis-3qcf6v.firebaseapp.com',
    projectId: 'projeto-assis-3qcf6v',
    storageBucket: 'projeto-assis-3qcf6v.appspot.com',
    messagingSenderId: '269670706726',
    appId: '1:269670706726:web:5bcb2a2dd730efcb91c0e7',
  },

  /**
   * The scanner demo clips still point at the Firebase Storage URLs from the
   * Dart, but that bucket now answers 402 Payment Required, so the clips do not
   * play (they did not in the Flutter build either). Drop the five mp4s into
   * web/assets/videos/scanners/ and set this to true to serve them locally.
   */
  useLocalScannerVideos: false,

  /**
   * A credencial do z-api (lib/backend/api_requests/api_calls.dart no Dart).
   *
   * Ela vinha CRAVADA aqui, com a instancia e o token no caminho da URL. O
   * problema nao e o repositorio: e que este arquivo entra no `bundle.js`
   * servido ao navegador, ou seja, qualquer pessoa que abrisse o jogo lia uma
   * credencial capaz de disparar WhatsApp pela conta da Tecnomotor.
   *
   * Agora nasce vazia e o envio se recusa a rodar sem ela (ver backend.js).
   * Para ligar o disparo: preencha as duas linhas na copia que vai para o
   * totem, com `useWhatsApp: true` — e NAO comite os valores.
   *
   * O token que estava aqui tem de ser considerado exposto e ROTACIONADO no
   * painel do z-api, porque ja foi servido e esta no historico do git.
   */
  zapApiUrl: '',
  zapClientToken: '',
};
