// Os números que o jogo mostra sobre o próprio jogo: o ranking que a faixa
// ACERTAR AGORA precisa desde o primeiro segundo, os votos das Placas e os
// números do dia do modo de atração.
//
// O RANKING É PEDIDO ANTES DA HORA. A faixa ERRAR / RECORDE / ACERTAR (ver
// components/aposta.js) diz em que lugar o jogador entra se acertar AGORA, e
// para isso precisa dos vencedores no instante em que o relógio começa. Uma
// consulta ao Firestore sem rede não falha — fica pendente —, então a tela da
// pergunta não pode ser a primeira a pedir: a roleta pede (`adiantarRanking`)
// enquanto a roda gira, e quando a pergunta abre o ranking já está em mãos.
// `queryUsuariosVencedores` já tem prazo e cai no ranking local.

import { queryRespostasDaPergunta, queryUsuariosVencedores } from './backend.js';
import { getRecords } from './storage.js';

/** Quantos vencedores a faixa e o fim olham: o pódio e mais dois. */
export const TOPO_DO_RANKING = 5;

/**
 * Por quanto tempo um ranking adiantado ainda vale. Dois minutos cobrem a
 * roleta, o carro, a escolha e o vídeo; mais que isso e outro totem já pode ter
 * gravado um vencedor novo.
 */
const VALIDADE_MS = 2 * 60 * 1000;

let adiantado = null;

/** Pede o ranking agora, para quando a pergunta abrir. */
export function adiantarRanking() {
  adiantado = { quando: Date.now(), promessa: queryUsuariosVencedores({ limit: TOPO_DO_RANKING }).catch(() => []) };
  return adiantado.promessa;
}

/** O ranking adiantado, se ainda valer; senão, um pedido novo. */
export function rankingAdiantado() {
  if (!adiantado || Date.now() - adiantado.quando > VALIDADE_MS) return adiantarRanking();
  return adiantado.promessa;
}

/* -------------------------------------------------------------- o dia ---- */

const mesmoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** As partidas deste totem que aconteceram no dia de `agora`. */
function partidasDoDia(agora) {
  const hoje = new Date(agora);
  return getRecords('usuarios').filter((r) => {
    const t = r?.data ? new Date(r.data) : null;
    return t && !Number.isNaN(t.getTime()) && mesmoDia(t, hoje);
  });
}

/**
 * "137 jogadores · 42% acertaram" — só deste totem, e só de hoje. É o que o
 * modo de atração mostra para quem passa: movimento chama movimento.
 *
 * @returns {{jogadores: number, acertos: number, porcentagem: number}}
 */
export function numerosDoDia(agora = Date.now()) {
  const partidas = partidasDoDia(agora);
  const acertos = partidas.filter((p) => p.venceu === true).length;
  return {
    jogadores: partidas.length,
    acertos,
    porcentagem: partidas.length ? Math.round((acertos / partidas.length) * 100) : 0,
  };
}

/** O vencedor mais rápido de hoje neste totem, ou null. `tempo` é o que sobrou no relógio. */
export function maisRapidoDoDia(agora = Date.now()) {
  const vencedores = partidasDoDia(agora).filter((p) => p.venceu === true && typeof p.tempo === 'number');
  if (!vencedores.length) return null;
  return vencedores.reduce((melhor, p) => (p.tempo > melhor.tempo ? p : melhor));
}

/* ---------------------------------------------------------- as placas ---- */

/**
 * Quantos jogadores escolheram cada resposta desta pergunta, pelo número
 * ORIGINAL da resposta no baralho (1 a 4). As partidas gravam `perguntaId` e
 * `alternativa` desde a 3.0; as de antes não entram, e é por isso que uma
 * pergunta pode começar sem voto nenhum.
 *
 * @returns {Promise<{contagem: number[], total: number}>}
 */
export async function votosDaPergunta(perguntaId) {
  const contagem = [0, 0, 0, 0];
  if (!perguntaId) return { contagem, total: 0 };
  const respostas = await queryRespostasDaPergunta(perguntaId).catch(() => []);
  for (const r of respostas) {
    const n = Number(r.alternativa);
    if (n >= 1 && n <= 4) contagem[n - 1] += 1;
  }
  return { contagem, total: contagem.reduce((s, v) => s + v, 0) };
}
