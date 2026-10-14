// De onde o ranking lê as partidas: da mesma fonte que a aba Respostas.
//
// O defeito que isto cobre: o ranking decidia pela chave de GRAVAR
// (`rankingNaNuvem`, sempre falsa numa máquina de trabalho) e a tabela pela de
// LER (`useFirestore`, ligada por `?comNuvem=1`). Com a chave na URL, a tabela
// mostrava a nuvem e o ranking, o que estava guardado no navegador — dois
// números para a mesma coisa.
//
// `config.js` fixa as chaves quando o módulo carrega, então o endereço é
// montado ANTES do import — e o `node --test` roda cada arquivo num processo
// próprio, o que deixa um cenário por arquivo.

import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.location = { protocol: 'http:', hostname: 'localhost', search: '?comNuvem=1', hash: '' };

const { CONFIG } = await import('../../web/js/config.js');
const { fonteDasPartidas } = await import('../../web/js/backend.js');

test('em localhost com ?comNuvem=1 o ranking lê a nuvem, como a tabela', () => {
  assert.equal(fonteDasPartidas(), 'nuvem');
});

test('mas gravar partida de teste na nuvem continua barrado', () => {
  // É a razão de existirem duas chaves: ler não suja nada, gravar sujou o ranking
  // de verdade com "Davi" e "Vencedor".
  assert.equal(CONFIG.useFirestore, true);
  assert.equal(CONFIG.rankingNaNuvem, false);
});
