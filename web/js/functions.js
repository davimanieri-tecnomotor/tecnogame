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
