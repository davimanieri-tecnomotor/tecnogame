// O prazo de inatividade: quatro minutos sem ninguém tocar, e o jogo volta ao
// cadastro.
//
// POR QUE. Só o cadastro tinha prazo — os 45s que chamam o ranking. As outras
// telas que dependem de um toque esperavam para sempre: a roleta pelo GIRAR, a
// escolha do equipamento, o fim de jogo pelo REINICIAR. E a partida ficava
// junto: quem chegava depois de um jogo largado na roleta jogava com o cadastro
// de quem tinha ido embora, e o resultado saía gravado com o nome e o telefone
// da outra pessoa.
//
// QUATRO MINUTOS é folga de sobra para quem está jogando. No caminho normal a
// espera mais longa sem toque é a da pergunta, e o relógio de 60s dela manda
// para o fim sozinho; as telas de vídeo andam por conta própria.
//
// O PRAZO É DE CADA TELA: um toque ou uma tecla recomeçam a contagem, e a troca
// de tela também.
//
// O que acontece quando ele vence é decisão da tela que está no palco, e não
// daqui: ela pode deixar um `__aoExpirar` no nó que devolve, do mesmo jeito que
// deixa o `__dispose` (ver router.js). O cadastro usa isso para só apagar a
// ficha — ele já é o começo —, e a administração para ficar de fora. As demais
// caem em `voltarAoComeco`.
//
// O relógio é o `performance.now`, o mesmo do contador de ociosidade do
// cadastro. É o que deixa o verify/inatividade.mjs acelerar a hora da página em
// vez de esperar quatro minutos de verdade: trocar por `Date.now` quebra o teste
// sem quebrar o jogo.

import { goNamed, telaAtual } from './router.js';
import { FFAppState } from './state.js';

/** Quanto uma tela espera sem ninguém tocar. */
export const PRAZO_DE_INATIVIDADE_MS = 4 * 60 * 1000;

/**
 * A contagem, sem DOM e sem relógio: quem chama avisa quando houve atividade e
 * pergunta, a cada batida, se a tela atual passou do prazo parada.
 *
 * Vence uma vez por período e recomeça dali, para uma tela que decide não fazer
 * nada (o painel) não ser chamada a cada batida.
 */
export function criarVigia() {
  let desde = null;
  let tela = null;
  return {
    /** Um toque ou uma tecla, em `agora`: a contagem recomeça. */
    atividade(agora) {
      desde = agora;
    },
    /** A tela `atual` venceu o prazo em `agora`? Tela nova conta como atividade. */
    venceu(agora, atual) {
      if (atual !== tela || desde == null) {
        tela = atual;
        desde = agora;
        return false;
      }
      if (agora - desde < PRAZO_DE_INATIVIDADE_MS) return false;
      desde = agora;
      return true;
    },
  };
}

/**
 * O que faz uma tela sem instrução própria: esquece a partida e volta ao
 * cadastro. Direto, sem a vinheta do REINICIAR — não há ninguém ali para ver.
 */
function voltarAoComeco() {
  FFAppState.encerrarPartida();
  goNamed('cadastro');
}

/** Liga o prazo. Chamado uma vez, no boot (main.js). */
export function vigiarInatividade() {
  const vigia = criarVigia();
  const agora = () => performance.now();

  // A mesma lista que libera o áudio (audio.js): é o que o jogo entende por
  // "alguém tocou".
  for (const tipo of ['pointerdown', 'keydown', 'touchstart']) {
    window.addEventListener(tipo, () => vigia.atividade(agora()), { capture: true, passive: true });
  }

  // Uma batida por segundo: quatro minutos não pedem precisão de quadro.
  setInterval(() => {
    const tela = telaAtual();
    if (!tela || !vigia.venceu(agora(), tela)) return;
    (tela.aoExpirar ?? voltarAoComeco)();
  }, 1000);
}
