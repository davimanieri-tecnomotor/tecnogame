// Port of lib/flutter_flow/nav/nav.dart - the go_router setup. As transições
// que o Dart escolhia página a página viraram uma só, aqui dentro.
//
// Routes keep the paths from the Dart, moved behind the hash so the app runs
// from any static host (and from file://) without server rewrites:
//   /cadastro -> #/cadastro

import { popAllDialogs } from './dialog.js';
import { unfocus } from './widgets.js';

const routes = new Map();
/** name -> path, so goNamed can resolve like go_router does. */
const namedPaths = new Map();

let current = null;
let navigating = false;
/** O pedido de navegacao que chegou durante outra (ver render). */
let pendente = null;

export function defineRoute({ name, path, builder }) {
  routes.set(path, { name, path, builder });
  namedPaths.set(name, path);
}

function resolve(path) {
  const [bare] = path.split('?');
  return routes.get(bare) ?? null;
}

function parseQuery(path) {
  const index = path.indexOf('?');
  if (index < 0) return {};
  return Object.fromEntries(new URLSearchParams(path.slice(index + 1)).entries());
}

export const serializeParam = (value) => (value == null ? null : String(value));

/* --------------------------------------------------------- a transição ---- */

/**
 * TODA troca de tela é a mesma coisa: a que sai apaga, a que entra acende.
 *
 * O porte trouxe do Dart duas gramáticas — `fade` e `scale` — e as telas as
 * misturavam. A escolha do equipamento, os dois vídeos e a tela da pergunta
 * NASCIAM DE UM PONTO no rodapé e cresciam até encher o palco, enquanto as
 * outras esmaeciam. Num totem em que o jogador atravessa sete telas em dois
 * minutos, mudar de gramática a cada passo se lê como defeito, e não como
 * variedade — e a escala ainda espremia a arte no caminho.
 *
 * Quem decide agora é este arquivo, e só ele. `goNamed` é como o jogo troca de
 * tela: esmaece sempre. `go` continua instantâneo, porque quem o chama não está
 * viajando — é a troca de idioma, que reconstrói a MESMA tela, e a porta da
 * administração, que levanta uma camada por fora do palco.
 *
 * Os dois trechos são sequenciais de propósito (`render` espera o primeiro):
 * a tela que sai some inteira antes de a outra aparecer, e o que se vê no meio
 * é o fundo do palco. Cruzar as duas deixaria dois desenhos sobrepostos.
 */
const ESMAECER_MS = 300;

const esmaecer = (node, de, para) =>
  node
    .animate([{ opacity: de }, { opacity: para }], { duration: ESMAECER_MS, easing: 'linear', fill: 'both' })
    .finished.catch(() => {});

/* -------------------------------------------------------------- navigate -- */

async function render(path, { comFade }) {
  if (navigating) {
    // Um toque durante a transicao de ENTRADA da tela anterior era engolido em
    // silencio: este `return` descartava a navegacao e o jogador ficava olhando
    // um botao que nao fez nada. Enquanto toda acao esperava 400ms de animacao
    // de aperto, a janela era pequena e o defeito passava; sem essa espera ele
    // aparece. Agora o pedido espera a vez em vez de morrer.
    pendente = { path, comFade };
    return;
  }
  navigating = true;
  try {
    const route = resolve(path) ?? resolve('/cadastro');
    const params = { ...parseQuery(path) };

    popAllDialogs();
    unfocus();

    const container = document.getElementById('pages');
    const previous = current;

    if (previous) {
      // dispose() on the outgoing page's state.
      previous.dispose?.();
      if (comFade) await esmaecer(previous.node, 1, 0);
    }

    const node = document.createElement('div');
    node.className = 'ff-page';
    node.dataset.route = route.name;

    const page = route.builder({ params, node });
    if (page && page !== node) node.appendChild(page);

    if (previous) previous.node.remove();
    container.appendChild(node);

    current = { route, node, dispose: page?.__dispose ?? node.__dispose ?? null, path };

    if (location.hash.slice(1) !== path) {
      history.replaceState({ path }, '', `#${path}`);
    }

    if (comFade) await esmaecer(node, 0, 1);
  } finally {
    navigating = false;
    // So o ultimo pedido interessa: quem apertou duas telas atras nao quer
    // atravessar as duas.
    const proximo = pendente;
    pendente = null;
    if (proximo) await render(proximo.path, { comFade: proximo.comFade });
  }
}

/**
 * `context.goNamed(name, queryParameters: ...)` — a troca de tela do jogo, e a
 * única porta que esmaece. O `extra: {__transition_info__}` que o Dart passava
 * aqui sumiu junto com a escolha de transição (ver acima).
 */
export function goNamed(name, { queryParameters = null } = {}) {
  const path = buildPath(name, queryParameters);
  return render(path, { comFade: true });
}

/** `context.go(path)` — ir sem viagem: reconstruir a tela atual, abrir o admin. */
export function go(path) {
  return render(path, { comFade: false });
}

function buildPath(name, queryParameters) {
  const path = namedPaths.get(name);
  if (!path) throw new Error(`unknown route: ${name}`);
  const entries = Object.entries(queryParameters ?? {}).filter(([, v]) => v != null);
  if (entries.length === 0) return path;
  return `${path}?${new URLSearchParams(entries).toString()}`;
}

/** initialLocation: '/' */
export function startRouter() {
  const initial = location.hash.slice(1) || '/';
  render(initial, { comFade: false });

  window.addEventListener('hashchange', () => {
    const path = location.hash.slice(1) || '/';
    if (current && current.path === path) return;
    render(path, { comFade: false });
  });
}
