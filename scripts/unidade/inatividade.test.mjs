// A contagem do prazo de inatividade: quando ela vence e o que a faz recomeçar.
//
// Aqui só a conta, com um relógio de mentira. Que um toque de verdade recomeça
// a contagem, que cada tela volta ao cadastro e que o painel fica de fora é o
// verify/inatividade.mjs, com o jogo rodando.

import test from 'node:test';
import assert from 'node:assert/strict';

const { PRAZO_DE_INATIVIDADE_MS: PRAZO, criarVigia } = await import('../../web/js/inatividade.js');

const ROLETA = { nome: 'roleta' };
const FIM = { nome: 'Perdeu' };

test('o prazo é de quatro minutos', () => {
  assert.equal(PRAZO, 4 * 60 * 1000);
});

test('vence no prazo, e não um milissegundo antes', () => {
  const vigia = criarVigia();
  assert.equal(vigia.venceu(0, ROLETA), false, 'a primeira batida só começa a contar');
  assert.equal(vigia.venceu(PRAZO - 1, ROLETA), false);
  assert.equal(vigia.venceu(PRAZO, ROLETA), true);
});

test('vence uma vez por período, e a contagem recomeça dali', () => {
  // É o que impede uma tela que decide não fazer nada (o painel) de ser chamada
  // a cada batida depois do primeiro prazo.
  const vigia = criarVigia();
  vigia.venceu(0, ROLETA);
  assert.equal(vigia.venceu(PRAZO, ROLETA), true);
  assert.equal(vigia.venceu(PRAZO + 1000, ROLETA), false);
  assert.equal(vigia.venceu(2 * PRAZO - 1, ROLETA), false);
  assert.equal(vigia.venceu(2 * PRAZO, ROLETA), true);
});

test('um toque recomeça a contagem', () => {
  const vigia = criarVigia();
  vigia.venceu(0, ROLETA);
  vigia.atividade(PRAZO - 1000);
  assert.equal(vigia.venceu(PRAZO, ROLETA), false, 'quem tocou há um segundo não está ausente');
  assert.equal(vigia.venceu(2 * PRAZO - 1001, ROLETA), false);
  assert.equal(vigia.venceu(2 * PRAZO - 1000, ROLETA), true);
});

test('trocar de tela recomeça a contagem', () => {
  // O prazo é de cada tela: quem gastou três minutos e meio na roleta não pode
  // chegar ao fim de jogo com trinta segundos de sobra.
  const vigia = criarVigia();
  vigia.venceu(0, ROLETA);
  assert.equal(vigia.venceu(PRAZO - 1000, FIM), false, 'a tela nova começa do zero');
  assert.equal(vigia.venceu(PRAZO, FIM), false);
  assert.equal(vigia.venceu(2 * PRAZO - 1001, FIM), false);
  assert.equal(vigia.venceu(2 * PRAZO - 1000, FIM), true);
});

test('um toque antes da primeira batida não adianta a contagem', () => {
  // No boot o toque pode chegar antes de o vigia ter visto tela nenhuma; a
  // primeira tela ainda começa a contar da batida em que aparece.
  const vigia = criarVigia();
  vigia.atividade(0);
  assert.equal(vigia.venceu(PRAZO, ROLETA), false);
  assert.equal(vigia.venceu(2 * PRAZO - 1, ROLETA), false);
  assert.equal(vigia.venceu(2 * PRAZO, ROLETA), true);
});
