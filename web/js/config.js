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

/**
 * Cópia de desenvolvimento? Então a nuvem fica fora.
 *
 * Isto não é preciosismo: com o Firestore ligado, CADA partida escreve em
 * `usuarios` e `contatos`. Uma rodada do `npm run verify` joga o jogo inteiro
 * quatro vezes, e essas partidas de mentira foram parar no ranking de verdade —
 * com nome e telefone de teste dentro da coleção de contatos. Aconteceu.
 *
 * A regra é a origem: `file://` e localhost são, sem ambiguidade, alguém
 * mexendo no jogo. Um IP de rede local (o totem servido de outra máquina do
 * estande) continua valendo como produção.
 *
 * Para desligar em qualquer outro lugar — uma cópia de demonstração no ar, um
 * totem que não deve mandar nada —, basta abrir com `?semNuvem=1` na URL.
 */
function origemDeDesenvolvimento() {
  if (typeof location === 'undefined') return true;
  if (location.protocol === 'file:') return true;
  if (new URLSearchParams(location.search).has('semNuvem')) return true;
  return ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(location.hostname);
}

export const CONFIG = {
  /**
   * Liga o Firebase: o ranking compartilhado (`usuarios`) e o baralho na nuvem
   * (`conteudo`, ver nuvem.js).
   *
   * Aponta para `tecnogame-c7e46`, o projeto da Tecnomotor — e não mais para o
   * `projeto-assis-3qcf6v` do FlutterFlow original, que está morto (o bucket
   * dele responde 402).
   *
   * Vale saber: `file://` recusa o SDK de qualquer forma, então o jogo aberto do
   * disco continua jogando só com o que tem guardado no próprio navegador.
   */
  useFirestore: !origemDeDesenvolvimento(),

  /** POST the "you finished TECNOGAME" WhatsApp message on the end screens. */
  useWhatsApp: false,

  /**
   * A chave web do Firebase pode ficar aqui: ela é identificador público por
   * design, não credencial. Quem defende os dados são as regras em
   * firebase/firestore.rules — leitura do ranking sem telefone, escrita do
   * conteúdo só autenticada.
   */
  firebaseOptions: {
    apiKey: 'AIzaSyB46OQK72wBKDBCy538oiCd0sC_08KWd6E',
    authDomain: 'tecnogame-c7e46.firebaseapp.com',
    projectId: 'tecnogame-c7e46',
    storageBucket: 'tecnogame-c7e46.firebasestorage.app',
    messagingSenderId: '373113273748',
    appId: '1:373113273748:web:c78fb6538edd0da32ae381',
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
