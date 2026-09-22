// Port of lib/flutter_flow/custom_functions.dart.

import { OFFENSIVE_WORDS } from './offensive_words.js';

/**
 * `escolha` é quantas VOLTAS a roleta gira. A seta fica embaixo, então a parte
 * fracionária da volta é a fatia que para na frente dela — e é assim que o Dart
 * codificava o índice sorteado dentro de um único número.
 *
 * O Dart cravava dez fatias: `numeroAleatorio` gerava 1.0, 1.1 ... 1.9 e
 * `transformaAleatorio` fazia `(n * 10).toInt() % 10`. Generalizando para N
 * rodadas, `escolha = 1 + k/N` e `k = round((escolha - 1) * N)`. Com N = 10 os
 * dez valores saem idênticos aos do Dart, então o baralho original se comporta
 * exatamente como antes (scripts/verify/baralho.mjs reafirma isso).
 */
export function escolhaParaIndice(escolha, total) {
  if (escolha == null || !total) return null;
  const k = Math.round((escolha - 1) * total);
  // Módulo positivo, para um `escolha` fora de faixa não devolver índice negativo.
  return ((k % total) + total) % total;
}

/**
 * numeroAleatorio(recentes, total)
 * Sorteia uma volta cujo índice não esteja entre os `recentes`, para o mesmo
 * veículo não repetir logo em seguida. O Dart comparava os próprios números
 * arredondados a uma decimal; aqui a comparação é por índice, o que dá no mesmo
 * para N = 10 e passa a funcionar para qualquer N.
 */
export function numeroAleatorio(recentes, total = 10) {
  if (!total) return null;
  const opcoes = Array.from({ length: total }, (_, i) => voltaDoIndice(i, total));
  const excluidos = new Set(
    (recentes ?? []).map((v) => escolhaParaIndice(v, total)).filter((i) => i != null)
  );
  const disponiveis = opcoes.filter((v) => !excluidos.has(escolhaParaIndice(v, total)));
  // Se a janela de repetição engoliu tudo (baralho pequeno), sorteia de todas.
  const pool = disponiveis.length > 0 ? disponiveis : opcoes;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** A volta que faz a fatia `i` parar na seta. Com N = 10 dá 1.0 ... 1.9. */
export function voltaDoIndice(i, total) {
  if (!total) return 1;
  // Uma decimal quando N = 10, para bater byte a byte com o Dart.
  return total === 10 ? Number((1 + i / total).toFixed(1)) : 1 + i / total;
}

/**
 * transformaAleatorio(double numeroSorteado) — assinatura do Dart, mantida para
 * os call sites continuarem legíveis ao lado dele. Assume as dez fatias do
 * baralho original; quem trabalha com baralho de tamanho livre chama
 * `escolhaParaIndice(escolha, total)`.
 */
export function transformaAleatorio(numeroSorteado, total = 10) {
  if (numeroSorteado == null) return null;
  return escolhaParaIndice(numeroSorteado, total);
}

/**
 * formatMillisecondsToTime(double temp)
 * Turns a remaining-time value into `HH:MM:SS S`, counting down from 60000ms.
 *
 * NENHUMA TELA USA MAIS ESTA FUNÇÃO: os dois rankings passaram a
 * `formatarTempoDeResposta`, abaixo. Ela fica porque é o porte fiel do Dart, e
 * o teste dela guarda a conta — mas não é por onde se mostra tempo ao jogador.
 */
export function formatMillisecondsToTime(temp) {
  if (temp == null) return null;
  const totalMilliseconds = 60000 - Math.trunc(temp);
  if (totalMilliseconds < 0) return '00:00:00 S';

  let seconds = Math.floor(totalMilliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} S`;
}

/**
 * O tempo de uma partida como o jogador o lê: `12,4 s`.
 *
 * O formato do Dart (`formatMillisecondsToTime`, acima) trazia hora e minuto
 * que nunca saem de zero num jogo de um minuto — `00:00:08 S` gastava três
 * campos para dizer "oito segundos", e o ranking inteiro parecia relógio de
 * parede. O décimo fica porque é ele que separa duas partidas rápidas.
 *
 * @param {number|null} tempoRestante o que sobrou no relógio de 60s, em ms —
 *   é assim que a partida é gravada; o que se mostra é o gasto.
 * @param {string} [separador] a vírgula decimal do idioma.
 */
export function formatarTempoDeResposta(tempoRestante, separador = ',') {
  if (tempoRestante == null) return null;
  const gasto = Math.min(60000, Math.max(0, 60000 - Math.trunc(tempoRestante)));
  // Em décimos inteiros, e não em fração: `8.4` não existe em binário, e a
  // diferença aparece na hora de partir o número em duas metades.
  const decimos = Math.round(gasto / 100);
  return `${Math.floor(decimos / 10)}${separador}${decimos % 10} s`;
}

/**
 * Em que lugar o jogador ficou, na lista de vencedores que a tela de fim leu.
 *
 * A partida é GRAVADA depois da navegação (ver perguntas_erespostas.js), então
 * a linha do próprio jogador pode ainda não estar na lista quando a tela
 * pergunta. Quando está, vale a posição dela; quando não está, conta-se quantos
 * foram mais rápidos — o que dá a mesma resposta.
 *
 * @param {Array<{nome?: string, tempo?: number}>} vencedores em ordem, o mais
 *   rápido primeiro.
 * @param {{nome?: string, tempo?: number}} jogador `tempo` é o que sobrou no
 *   relógio: quanto MAIOR, mais rápido foi.
 * @returns {number|null} a posição a partir de 1, ou null sem tempo para
 *   comparar (quem perdeu não entra no ranking).
 */
export function posicaoNoRanking(vencedores, { nome, tempo } = {}) {
  if (!Array.isArray(vencedores) || tempo == null) return null;
  const minha = vencedores.findIndex((v) => v && v.nome === nome && v.tempo === tempo);
  if (minha >= 0) return minha + 1;
  return vencedores.filter((v) => (v?.tempo ?? -Infinity) > tempo).length + 1;
}

const OFFENSIVE_SET = new Set(OFFENSIVE_WORDS);

/**
 * nomeOfensivo(String nome)
 * Splits on whitespace, '-' and '_' and looks each token up in the block list.
 */
export function nomeOfensivo(nome) {
  if (nome == null || nome.trim().length === 0) return false;
  const texto = nome.toLowerCase();
  const palavras = texto.split(/\s+|[-_]/);
  for (const palavra of palavras) {
    if (OFFENSIVE_SET.has(palavra)) return true;
  }
  return false;
}

/** embaralhaQuestoes() - [1,2,3,4] shuffled. */
export function embaralhaQuestoes() {
  const numeros = [1, 2, 3, 4];
  // Fisher-Yates, matching List.shuffle()'s uniform result.
  for (let i = numeros.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numeros[i], numeros[j]] = [numeros[j], numeros[i]];
  }
  return numeros;
}

/** transformaNumero('(16) 99703-7115') -> '5516997037115' (digits only, +55). */
export function transformaNumero(numero) {
  if (numero == null) return null;
  const digits = numero.replace(/\D/g, '');
  return `55${digits}`;
}
