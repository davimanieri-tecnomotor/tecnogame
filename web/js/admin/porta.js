// A porta da administração: o gesto que a chama, o LOGIN que a abre, e a camada
// que ela levanta por cima do jogo.
//
// DUAS ENTRADAS, E A DIFERENÇA IMPORTA:
//
//   login    a conta do Firebase — a mesma que a aba Respostas usa para ler
//            telefone. É autenticação de verdade: a conta vive no projeto de
//            vocês, não no JavaScript que o jogador recebe, e é ela que o
//            Firestore exige para gravar o baralho (firebase/firestore.rules).
//   senha    a `SENHA` abaixo, que só vale ONDE O LOGIN É IMPOSSÍVEL.
//
// POR QUE A SENHA AINDA EXISTE. O SDK do Firebase é módulo ES vindo da CDN, e
// `file://` recusa módulo ES — o totem aberto do disco nunca alcança o
// Firebase. Some com isso em localhost (a nuvem nasce desligada) e na feira com
// a internet fora. Exigir login nesses casos trancaria o painel exatamente
// quando o operador mais precisa dele: para arrumar o baralho com a rede caída.
//
// O QUE A SENHA NÃO É. Ela viaja no mesmo JavaScript que o jogador recebe —
// quem apertar F12 a lê em dez segundos. É tranca de gaveta: impede o curioso e
// o toque errado numa feira, e nada além. Por isso, quem entra por ela entra em
// MODO LOCAL: o painel abre marcado e salvar na nuvem fica bloqueado (ver
// `painel.js`). O que se edita ali vale só naquele navegador.
//
// Enquanto era `admin.html`, a proteção era outra e era real: bastava não
// copiar aquele arquivo para o totem. Trocamos isso por um endereço único, de
// propósito e com o custo sabido — e o login é o que devolve a proteção onde
// ela pode existir.
//
// O caminho: cinco toques no selo do cadastro (ou `#/adm` na barra do
// navegador) -> login (ou a senha, sem nuvem) -> a camada do admin. Sair volta
// ao cadastro.

import { el } from '../widgets.js';
import { go } from '../router.js';
import { firebase, podeUsarNuvem } from '../firebase.js';
import { montarAdmin, desmontarAdmin } from './painel.js';
import { pedirCredenciais } from './ui.js';
import { entrar, operadorRestaurado } from './respostas.js';

/** A senha do modo local. Só é pedida onde o Firebase não é alcançável. */
const SENHA = '2040';

/** Quantos toques no selo chamam a porta, e em quanto tempo. */
const TOQUES = 5;
const JANELA_MS = 3000;

/**
 * Uma vez aberta, a porta fica destrancada até a aba fechar. Sem isso o
 * operador refaz a entrada a cada ida e volta entre o admin e o jogo, e os
 * testes teriam de reencená-la em toda navegação.
 *
 * Guarda POR ONDE se entrou (`login` ou `local`) e não só que se entrou. O
 * painel, porém, não lê isto para decidir o que liberar: ele olha o estado real
 * da autenticação (`aoMudarOperador`), que é o que o Firestore vai cobrar. Ler
 * daqui deixaria o painel confiar num valor que o próprio navegador escreveu.
 */
const CHAVE_LIBERADA = 'tecgame:adm-liberado';

/** @returns {'login'|'local'|null} */
const liberado = () => {
  try {
    const v = sessionStorage.getItem(CHAVE_LIBERADA);
    // '1' é o formato antigo, de quando só havia a senha.
    return v === '1' ? 'local' : v === 'login' || v === 'local' ? v : null;
  } catch (_) {
    return null;
  }
};

const liberar = (via) => {
  try {
    sessionStorage.setItem(CHAVE_LIBERADA, via);
  } catch (_) {
    /* navegador sem armazenamento: a entrada volta a ser pedida, e tudo bem */
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

/**
 * A caixa da senha local. Resolve com true quando confere, false quando o
 * operador desiste.
 *
 * @param {string} [texto] o que explicar acima do campo. O padrão serve ao caso
 *   comum (sem nuvem); quem passa outro é o caminho em que o login existiria
 *   mas não pode funcionar — ver `pedirLogin`.
 */
function pedirSenha({
  // "Sem conexão" estaria errado em localhost, onde a nuvem nasce desligada por
  // decisão e não por falta de rede. O que o operador precisa saber é a
  // consequência, que é a mesma nos três casos.
  texto = 'Este navegador não alcança o Firebase. Esta senha abre o painel só aqui — nada sobe para os outros totens.',
} = {}) {
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
      el('p', { class: 'porta-texto', text: texto }),
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

/* ---------------------------------------------------------------- login -- */

/**
 * O Firebase está de fato ao alcance agora?
 *
 * Não basta `podeUsarNuvem()`, que só olha a configuração e o protocolo: na
 * feira com a internet fora o import do SDK falha e `firebase()` devolve null.
 * Os dois casos têm de cair no mesmo lugar — senão o painel fica inacessível
 * justamente quando o operador precisa arrumar o baralho sem rede.
 */
const nuvemAlcancavel = async () => podeUsarNuvem() && (await firebase()) !== null;

/**
 * Entrar com a conta do Firebase — a mesma da aba Respostas.
 *
 * Repete enquanto a senha não confere, para o operador não ter de refazer os
 * cinco toques a cada erro de digitação.
 *
 * @returns {Promise<'login'|'local'|null>} por onde entrou, ou null se desistiu
 */
async function pedirLogin() {
  // Sessão que o SDK restaurou: já entrou nesta máquina, não pergunta de novo.
  if (await operadorRestaurado()) return 'login';

  let texto = 'A conta do Firebase do projeto. Ela é criada pelo Console — não há cadastro por aqui.';
  for (;;) {
    const dados = await pedirCredenciais({ titulo: 'Entrar na administração', texto });
    if (!dados) return null;

    const r = await entrar(dados.email, dados.senha);
    if (r.ok) return 'login';

    // "Login não habilitado no projeto" não é erro de quem digitou: não existe
    // conta que possa funcionar, e insistir trancaria todo mundo do lado de
    // fora de um painel que ninguém consegue abrir. Só NESTE caso a senha local
    // volta a valer; senha errada continua sendo senha errada.
    if (String(r.codigo ?? '').includes('operation-not-allowed')) {
      const ok = await pedirSenha({
        texto:
          'O login por e-mail/senha não está habilitado no projeto do Firebase. ' +
          'Enquanto isso, esta senha abre o painel só para este navegador.',
      });
      return ok ? 'local' : null;
    }

    texto = `Não entrou: ${r.motivo}`;
  }
}

/**
 * Destranca a porta. Login de verdade onde o Firebase alcança; a senha local
 * onde ele não alcança. Resolve com `true` quando pode entrar.
 */
async function pedirEntrada() {
  if (liberado()) return true;

  const via = (await nuvemAlcancavel()) ? await pedirLogin() : (await pedirSenha()) ? 'local' : null;
  if (!via) return false;

  liberar(via);
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
