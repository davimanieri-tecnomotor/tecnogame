// Port of lib/flutter_flow/custom_functions.dart.

import { OFFENSIVE_WORDS } from './offensive_words.js';

/**
 * numeroAleatorio(List<double> ultimoNumero)
 * Picks one of 1.0, 1.1, ... 1.9 that is not in `ultimoNumero`.
 * Values are rounded to one decimal exactly like `toStringAsFixed(1)` does in
 * the Dart, so the `contains` check compares the same numbers.
 */
export function numeroAleatorio(ultimoNumero) {
  const opcoes = Array.from({ length: 10 }, (_, i) => Number((1.0 + i * 0.1).toFixed(1)));
  const opcoesFiltradas = ultimoNumero != null ? opcoes.filter((n) => !ultimoNumero.includes(n)) : opcoes;
  if (opcoesFiltradas.length === 0) return null;
  const index = Math.floor(Math.random() * opcoesFiltradas.length);
  return opcoesFiltradas[index];
}

/**
 * transformaAleatorio(double numeroSorteado)
 * 1.0 -> 0, 1.1 -> 1, ... 1.9 -> 9.  `(n * 10).toInt() % 10` in Dart truncates,
 * so Math.trunc is the right JS counterpart (1.7 * 10 === 16.999... -> 16).
 */
export function transformaAleatorio(numeroSorteado) {
  if (numeroSorteado == null) return null;
  return Math.trunc(numeroSorteado * 10) % 10;
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
