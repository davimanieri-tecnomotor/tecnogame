// A Pergunta do Milhão do dia.
//
// Uma rodada extra que o OPERADOR dispara, pelo painel (aba Configurações), para o
// jogador mais rápido do dia voltar ao totem e responder uma pergunta valendo
// brinde. É a mesma tela da pergunta, com outra regra:
//
//   - sem ajudas — é você e o relógio, como a pergunta final do programa;
//   - a faixa diz VALENDO BRINDE no lugar da posição no ranking;
//   - o palco em ouro;
//   - não entra no ranking nem nas Placas: é uma rodada à parte, e somá-la
//     distorceria as duas coisas. Fica guardada neste navegador, para o
//     operador saber quem levou o brinde (ver `registrar` em tela_acao.js).
//
// O painel escolhe a pergunta e o nome (FFAppState.milhao). Chegar aqui sem
// isso — `#/milhao` digitado — sorteia uma pergunta e chama o mais rápido de
// hoje, se houver.

import { FFLocalizations } from '../i18n.js';
import { FFAppState } from '../state.js';
import { embaralhaQuestoes } from '../functions.js';
import { perguntasAtivas, videoDaPergunta, IDIOMAS } from '../deck.js';
import { maisRapidoDoDia } from '../estatisticas.js';
import { goNamed } from '../router.js';
import { T } from '../textos.js';
import { EQUIPAMENTO_PADRAO } from '../components/ferramenta.js';
import { montarPergunta } from './tela_acao.js';

const RESPOSTA_FIELD = { 1: 'respostaUm', 2: 'respostaDois', 3: 'respostaTres', 4: 'respostaQuatro' };

/** Sem nada escolhido no painel: uma pergunta ativa qualquer, e o mais rápido de hoje. */
export function milhaoAutomatico(baralho = FFAppState.baralho, sorte = Math.random) {
  const opcoes = [];
  (baralho?.slots ?? []).forEach((slot, i) =>
    (slot.perguntas ?? []).forEach((p, j) => {
      if (perguntasAtivas(slot).includes(p)) opcoes.push({ slot: i, pergunta: j });
    })
  );
  const escolhida = opcoes[Math.floor(sorte() * opcoes.length)] ?? { slot: 0, pergunta: 0 };
  return { ...escolhida, jogador: maisRapidoDoDia()?.nome ?? '' };
}

/** A rodada da Pergunta do Milhão, no formato que a tela da pergunta lê. */
export function rodadaDoMilhao({ slot: i, pergunta: j, jogador }, baralho = FFAppState.baralho) {
  const slot = baralho?.slots?.[i] ?? baralho?.slots?.[0];
  const pergunta = slot?.perguntas?.[j] ?? slot?.perguntas?.[0] ?? {};
  const texto = (campo) => {
    const porIdioma = Object.fromEntries(IDIOMAS.map((l) => [l, pergunta[l]?.[campo] ?? '']));
    return FFLocalizations.getVariableText({ ptText: porIdioma.pt, esText: porIdioma.es, enText: porIdioma.en });
  };
  const ordem = embaralhaQuestoes();
  const gabarito = String(pergunta.gabarito ?? '');
  return {
    modo: 'milhao',
    jogador: jogador ?? '',
    perguntaId: pergunta.id ?? '',
    gabarito,
    video: videoDaPergunta(pergunta),
    enunciado: texto('pergunta') || T('perguntaDoMilhao'),
    respostas: ordem.map((n, k) => texto(RESPOSTA_FIELD[n]) || `${T('alternativa')} ${k + 1}`),
    ordem,
    slotCerto: ordem.findIndex((n) => String(n) === gabarito),
    ajudas: { ajudaTecnomotorTv: texto('ajudaTecnomotorTv') },
    veiculo: slot?.veiculo ?? { nome: '', imagem: '' },
    equipamento: EQUIPAMENTO_PADRAO,
  };
}

export function PerguntaDoMilhaoWidget() {
  const escolha = FFAppState.milhao ?? milhaoAutomatico();
  return montarPergunta(rodadaDoMilhao(escolha), {
    aoTerminar: () => {
      FFAppState.milhao = null;
      goNamed('cadastro');
    },
  });
}
