// A porta da administração: o gesto que a chama, a senha que a abre, e a
// camada que ela levanta por cima do jogo.
//
// ATÉ ONDE ISTO PROTEGE — leia antes de confiar. O jogo e o admin agora moram
// no mesmo index.html, para o GitHub Pages servir um endereço só. Isso quer
// dizer que o código da administração viaja para todo navegador que abre o
// jogo, a senha abaixo inclusive: quem apertar F12 a lê em dez segundos. É
// tranca de gaveta — impede o curioso e o toque errado do visitante numa feira,
// e não impede mais que isso. Proteção de verdade mora no servidor, e este jogo
// não tem servidor: o baralho vive no armazenamento do próprio navegador.
//
// Enquanto era `admin.html`, a proteção era outra e era real: bastava não
// copiar aquele arquivo para o totem. Trocamos isso por um endereço único, de
// propósito e com o custo sabido.
//
// O caminho: cinco toques no selo do cadastro (ou `#/adm` na barra do
// navegador) -> a caixa de senha -> a camada do admin. Sair volta ao cadastro.

import { el } from '../widgets.js';
import { go } from '../router.js';
import { montarAdmin, desmontarAdmin } from './painel.js';

const SENHA = '2040';

/** Quantos toques no selo chamam a porta, e em quanto tempo. */
const TOQUES = 5;
const JANELA_MS = 3000;

/**
 * Uma vez aberta, a porta fica destrancada até a aba fechar. Sem isso o
 * operador redigita 2040 a cada ida e volta entre o admin e o jogo, e os
 * testes teriam de reencenar a senha em toda navegação.
 */
const CHAVE_LIBERADA = 'tecgame:adm-liberado';

const liberado = () => {
  try {
    return sessionStorage.getItem(CHAVE_LIBERADA) === '1';
  } catch (_) {
    return false;
  }
};

const liberar = () => {
  try {
    sessionStorage.setItem(CHAVE_LIBERADA, '1');
  } catch (_) {
    /* navegador sem armazenamento: a senha volta a ser pedida, e tudo bem */
  }
};

/* ------------------------------------------------------------ o gesto ----- */

/**
 * Cinco toques no mesmo elemento, dentro de 3s, levam a `#/adm`.
 *
 * A janela existe para o contador não ser cumulativo: num totem de feira o selo
 * leva toque o dia inteiro, e sem ela a porta abriria sozinha em algum momento
 * da tarde. Toques espaçados reiniciam a contagem.
 */
export function registrarToqueSecreto(node) {
  if (!node) return node;
  let contados = 0;
  let primeiro = 0;

  node.addEventListener('click', async () => {
    const agora = Date.now();
    if (agora - primeiro > JANELA_MS) {
      contados = 0;
      primeiro = agora;
    }
    contados += 1;
    if (contados < TOQUES) return;
    contados = 0;
    // Pergunta ANTES de navegar. Navegar primeiro desmontava a tela do
    // cadastro, e a caixa de senha aparecia sobre um palco vazio — quem tocou
    // cinco vezes sem querer via o jogo sumir.
    if (await pedirEntrada()) go('/adm');
  });

  return node;
}

/* ------------------------------------------------------ a caixa de senha -- */

/** Resolve com true quando a senha confere, false quando o operador desiste. */
function pedirSenha() {
  return new Promise((resolve) => {
    const campo = el('input', {
      class: 'porta-campo',
      type: 'password',
      // `inputmode: numeric` faz o teclado do totem abrir no teclado numérico.
      inputmode: 'numeric',
      autocomplete: 'off',
      'aria-label': 'Senha da administração',
      maxlength: '8',
    });
    const erro = el('p', { class: 'porta-erro', role: 'alert' });

    const fechar = (ok) => {
      document.removeEventListener('keydown', onTecla);
      fundo.remove();
      resolve(ok);
    };

    const tentar = () => {
      if (campo.value === SENHA) return fechar(true);
      erro.textContent = 'Senha incorreta.';
      campo.value = '';
      campo.focus();
    };

    const onTecla = (e) => {
      if (e.key === 'Escape') fechar(false);
      if (e.key === 'Enter') {
        e.preventDefault();
        tentar();
      }
    };

    const caixa = el('div', { class: 'porta-caixa', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Administração' }, [
      el('h2', { class: 'porta-titulo', text: 'Administração' }),
      el('p', { class: 'porta-texto', text: 'Digite a senha para abrir o painel de rodadas.' }),
      campo,
      erro,
      el('div', { class: 'porta-acoes' }, [
        el('button', { type: 'button', class: 'porta-botao', text: 'Cancelar', onClick: () => fechar(false) }),
        el('button', { type: 'button', class: 'porta-botao porta-botao--ok', text: 'Entrar', onClick: tentar }),
      ]),
    ]);

    const fundo = el('div', {
      class: 'porta-fundo',
      onClick: (e) => e.target === fundo && fechar(false),
    }, caixa);

    document.body.appendChild(fundo);
    document.addEventListener('keydown', onTecla);
    campo.focus();
  });
}

/**
 * Destranca a porta, pedindo a senha se ainda não foi pedida nesta aba.
 * Resolve com `true` quando pode entrar.
 */
async function pedirEntrada() {
  if (liberado()) return true;
  if (!(await pedirSenha())) return false;
  liberar();
  return true;
}

/* ------------------------------------------------------------- a camada --- */

const raizDoAdmin = () => document.getElementById('adm');
const molduraDoJogo = () => document.getElementById('viewport');

let aberta = false;

function abrirCamada() {
  if (aberta) return;
  aberta = true;

  // `data-modo` solta o documento: o jogo tranca a rolagem e a seleção de texto
  // para o totem não rolar sob o dedo, e o admin precisa das duas.
  document.documentElement.dataset.modo = 'adm';
  molduraDoJogo().hidden = true;

  const raiz = raizDoAdmin();
  raiz.hidden = false;
  montarAdmin(raiz, { aoSair: () => go('/cadastro') });
}

function fecharCamada() {
  if (!aberta) return;
  aberta = false;

  desmontarAdmin();
  raizDoAdmin().hidden = true;
  molduraDoJogo().hidden = false;
  delete document.documentElement.dataset.modo;
}

/* --------------------------------------------------------------- a rota --- */

/**
 * Builder da rota `/adm`. Devolve um nó vazio de propósito: o admin não desenha
 * no palco de 1920x1080, ele levanta a própria camada por fora. O que fica no
 * `#pages` é só a casca que o roteador precisa para ter o que descartar.
 */
export function PortaDoAdmWidget() {
  const casca = el('div');

  // Chegar por aqui sem ter passado pelo gesto quer dizer `#/adm` digitado na
  // barra do navegador: a senha é pedida agora, sobre o palco já vazio. Pelo
  // gesto do selo ela já foi pedida antes de navegar, e `pedirEntrada` volta
  // na hora.
  (async () => {
    if (!(await pedirEntrada())) return go('/cadastro');
    // Entre o pedido de senha e agora o operador pode ter navegado; só abre se
    // a rota do admin ainda é a rota atual.
    if (location.hash.slice(1).split('?')[0] !== '/adm') return;
    abrirCamada();
  })();

  // Fechar por aqui é síncrono — o roteador não espera promessa no dispose —,
  // então não dá para perguntar nada a quem apertou o "voltar" do navegador. Em
  // vez de perder o trabalho em silêncio, a edição pendente fica guardada e
  // reaparece na próxima abertura (ver `montarAdmin`). O botão "Voltar ao jogo"
  // continua perguntando, porque ali dá tempo.
  casca.__dispose = fecharCamada;

  return casca;
}
