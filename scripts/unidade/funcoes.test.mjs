// As funções puras que vieram do Dart (custom_functions.dart).
//
// O que a suíte de navegador alcança delas é o caminho feliz, pela tela. O que
// está aqui são as bordas — e, em dois casos, um comportamento conhecido e
// incômodo, escrito para não ser redescoberto como novidade.

import test from 'node:test';
import assert from 'node:assert/strict';

import { OFFENSIVE_WORDS } from '../../web/js/offensive_words.js';
import {
  embaralhaQuestoes,
  formatMillisecondsToTime,
  nomeOfensivo,
  transformaNumero,
} from '../../web/js/functions.js';

/** Uma palavra da lista, escolhida em tempo de execução para não a transcrever. */
const PALAVRA = OFFENSIVE_WORDS.find((p) => /^[a-zà-ÿ]{4,}$/.test(p));

test('a lista de palavras bloqueadas chegou inteira', () => {
  assert.ok(OFFENSIVE_WORDS.length > 100);
  assert.ok(PALAVRA, 'nenhuma palavra simples na lista — o resto do arquivo não faz sentido');
});

test('o nome ofensivo é pego em qualquer separador e em qualquer caixa', () => {
  assert.equal(nomeOfensivo(PALAVRA), true);
  assert.equal(nomeOfensivo(PALAVRA.toUpperCase()), true);
  for (const sep of [' ', '  ', '-', '_']) {
    assert.equal(nomeOfensivo(`João${sep}${PALAVRA}`), true, `separador ${JSON.stringify(sep)} passou`);
  }
});

test('nome limpo passa, e vazio não é ofensivo', () => {
  assert.equal(nomeOfensivo('João da Silva'), false);
  assert.equal(nomeOfensivo(''), false);
  assert.equal(nomeOfensivo('   '), false);
  assert.equal(nomeOfensivo(null), false);
  assert.equal(nomeOfensivo(undefined), false);
});

test('a comparação é por palavra inteira — e isso deixa passar o grudado', () => {
  // Contorno conhecido, herdado do Dart: a lista é consultada token a token,
  // então a palavra colada em outra escapa. Fechar isso por substring traria
  // falso positivo em nome legítimo, que numa feira é pior. Fica afirmado para
  // ninguém "descobrir o bug" de novo.
  assert.equal(nomeOfensivo(`x${PALAVRA}`), false);
  assert.equal(nomeOfensivo(`${PALAVRA}x`), false);
});

test('o telefone vira o formato que a z-api espera', () => {
  assert.equal(transformaNumero('(16) 99703-7115'), '5516997037115');
  assert.equal(transformaNumero('16 99703 7115'), '5516997037115');
  assert.equal(transformaNumero(null), null);
});

test('o prefixo 55 é posto sem perguntar — número já internacional dobra', () => {
  // Outro contorno herdado: não há checagem de prefixo. Hoje é inofensivo,
  // porque `useWhatsApp` está desligado; se um dia o disparo voltar (pelo
  // servidor, como manda firebase/README.md), é aqui que o número sai errado.
  assert.equal(transformaNumero('+55 16 99703-7115'), '555516997037115');
});

test('o relógio da tela de fim conta o tempo GASTO, não o que sobrou', () => {
  assert.equal(formatMillisecondsToTime(60000), '00:00:00 S', 'sobrou tudo => gastou nada');
  assert.equal(formatMillisecondsToTime(59000), '00:00:01 S');
  assert.equal(formatMillisecondsToTime(0), '00:01:00 S', 'sobrou nada => gastou o minuto');
  assert.equal(formatMillisecondsToTime(70000), '00:00:00 S', 'tempo acima do relógio não vira negativo');
  assert.equal(formatMillisecondsToTime(null), null);
});

test('o embaralhamento das alternativas é uniforme, não "quase"', () => {
  // Um Fisher-Yates escrito errado continua devolvendo quatro números
  // diferentes — só deixa de alcançar parte das ordens. Por isso não basta
  // afirmar que é permutação: afirma-se que as 24 aparecem.
  const vistas = new Set();
  for (let i = 0; i < 4000; i++) {
    const n = embaralhaQuestoes();
    assert.deepEqual([...n].sort(), [1, 2, 3, 4], 'devolveu algo que não é permutação de 1..4');
    vistas.add(n.join(''));
  }
  assert.equal(vistas.size, 24, `só ${vistas.size} das 24 ordens saíram em 4000 sorteios`);
});
