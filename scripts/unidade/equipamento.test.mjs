// O cronômetro e o caminho depois do equipamento (3.1): o que se afirma sem tela.
//
// A suíte de navegador (verify/pergunta.mjs, verify/equipamento.mjs) confere o
// desenho e o percurso de uma partida; aqui ficam as bordas, que custam
// microssegundos: o segundo exato em que o mostrador troca de número, e cada
// combinação de equipamento × marca do painel.

import test from 'node:test';
import assert from 'node:assert/strict';

import { instalarArmazenamento } from './_armazenamento_falso.mjs';
import { segundosNoMostrador } from '../../web/js/components/cronometro.js';
import { definirPularVideoDoEquipamento, pulaVideoDoEquipamento, telaDepoisDoEquipamento } from '../../web/js/pages/tela_video_scanner.js';

test('o mostrador diz o teto dos segundos: 60 na largada, 0 só quando acabou', () => {
  assert.equal(segundosNoMostrador(60000), 60);
  // Com 59,3 s sobrando ainda se lê 60: é o primeiro segundo correndo.
  assert.equal(segundosNoMostrador(59300), 60);
  assert.equal(segundosNoMostrador(59000), 59);
  assert.equal(segundosNoMostrador(10000), 10);
  assert.equal(segundosNoMostrador(9999), 10);
  // O último segundo diz 1 até o fim; o 0 coincide com o estouro.
  assert.equal(segundosNoMostrador(1), 1);
  assert.equal(segundosNoMostrador(0), 0);
  assert.equal(segundosNoMostrador(-500), 0);
});

test('depois do equipamento: o vídeo, a não ser que o painel o pule ou o equipamento não tenha um', () => {
  instalarArmazenamento();
  assert.equal(pulaVideoDoEquipamento(), false, 'a marca nasce desligada');
  for (const comVideo of ['Rasther 3', 'RB', 'RST', 'Td90', 'Td80']) {
    assert.equal(telaDepoisDoEquipamento(comVideo), 'telaVideoScanner', comVideo);
  }
  // O Rasther 4 entrou na 3.1 sem vídeo: cair no padrão mostraria o 3S.
  assert.equal(telaDepoisDoEquipamento('Rasther 4'), 'telaAcao');

  definirPularVideoDoEquipamento(true);
  assert.equal(pulaVideoDoEquipamento(), true);
  for (const qualquer of ['Rasther 3', 'RB', 'RST', 'Td90', 'Td80', 'Rasther 4']) {
    assert.equal(telaDepoisDoEquipamento(qualquer), 'telaAcao', qualquer);
  }

  definirPularVideoDoEquipamento(false);
  assert.equal(telaDepoisDoEquipamento('RST'), 'telaVideoScanner', 'desmarcar devolve o vídeo');
});
