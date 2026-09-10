// Port of lib/flutter_flow/nav/nav.dart - the go_router setup plus the
// page_transition animations it hands to CustomTransitionPage.
//
// Routes keep the paths from the Dart, moved behind the hash so the app runs
// from any static host (and from file://) without server rewrites:
//   /cadastro -> #/cadastro

import { popAllDialogs } from './dialog.js';
import { unfocus } from './widgets.js';

export const PageTransitionType = { fade: 'fade', scale: 'scale' };

export const Alignment = {
  bottomCenter: [0, 1],
  center: [0, 0],
  topCenter: [0, -1],
};

/** TransitionInfo from nav.dart. */
export class TransitionInfo {
  constructor({ hasTransition, transitionType = PageTransitionType.fade, duration = 300, alignment = null } = {}) {
    this.hasTransition = hasTransition;
    this.transitionType = transitionType;
    this.duration = duration;
    this.alignment = alignment;
  }

  static appDefault() {
    return new TransitionInfo({ hasTransition: false });
  }
}

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

/* --------------------------------------------------------- transitions ---- */

function transitionIn(node, info) {
  if (!info || !info.hasTransition || info.duration === 0) return Promise.resolve();
  const duration = info.duration;
  if (info.transitionType === PageTransitionType.scale) {
    const [ax, ay] = info.alignment ?? Alignment.center;
    node.style.transformOrigin = `${((ax + 1) / 2) * 100}% ${((ay + 1) / 2) * 100}%`;
    return node
      .animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], {
        duration,
        easing: 'linear',
        fill: 'both',
      })
      .finished.catch(() => {});
  }
  return node
    .animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: 'linear', fill: 'both' })
    .finished.catch(() => {});
}

function transitionOut(node, info) {
  if (!info || !info.hasTransition || info.duration === 0) return Promise.resolve();
  const duration = info.duration;
  if (info.transitionType === PageTransitionType.scale) {
    return node
      .animate([{ transform: 'scale(1)' }, { transform: 'scale(0)' }], { duration, easing: 'linear', fill: 'both' })
      .finished.catch(() => {});
  }
  return node
    .animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing: 'linear', fill: 'both' })
    .finished.catch(() => {});
}

/* -------------------------------------------------------------- navigate -- */

async function render(path, { info }) {
  if (navigating) {
    // Um toque durante a transicao de ENTRADA da tela anterior era engolido em
    // silencio: este `return` descartava a navegacao e o jogador ficava olhando
    // um botao que nao fez nada. Enquanto toda acao esperava 400ms de animacao
    // de aperto, a janela era pequena e o defeito passava; sem essa espera ele
    // aparece. Agora o pedido espera a vez em vez de morrer.
    pendente = { path, info };
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
      await transitionOut(previous.node, info);
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

    await transitionIn(node, info);
  } finally {
    navigating = false;
    // So o ultimo pedido interessa: quem apertou duas telas atras nao quer
    // atravessar as duas.
    const proximo = pendente;
    pendente = null;
    if (proximo) await render(proximo.path, { info: proximo.info });
  }
}

/** `context.goNamed(name, queryParameters: ..., extra: {__transition_info__})` */
export function goNamed(name, { queryParameters = null, extra = null } = {}) {
  const path = buildPath(name, queryParameters);
  return render(path, { info: extra?.__transition_info__ });
}

/** `context.go(path)` */
export function go(path) {
  return render(path, { info: null });
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
  render(initial, { info: null });

  window.addEventListener('hashchange', () => {
    const path = location.hash.slice(1) || '/';
    if (current && current.path === path) return;
    render(path, { info: null });
  });
}
