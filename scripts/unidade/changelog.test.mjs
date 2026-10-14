// O sininho de novidades: a versão, as notas, e quantas aparecem.
//
// `VERSAO_DO_JOGO` é mantida à mão (o navegador nunca lê o package.json), e a
// regra do CLAUDE.md é que as duas subam juntas. Esquecer uma das duas deixa o
// painel dizendo uma versão e o repositório outra.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { instalarArmazenamento } from './_armazenamento_falso.mjs';

instalarArmazenamento();

const { NOTAS_DE_ATUALIZACAO, NOTAS_VISIVEIS, VERSAO_DO_JOGO, notasVisiveis } = await import('../../web/js/changelog.js');

test('o sininho mostra só a versão atual e a anterior', () => {
  const notas = notasVisiveis();
  assert.equal(notas.length, 2);
  assert.equal(NOTAS_VISIVEIS, 2);
  assert.deepEqual(
    notas.map((n) => n.versao),
    NOTAS_DE_ATUALIZACAO.slice(0, 2).map((n) => n.versao)
  );
});

test('a primeira nota é a da versão que o painel anuncia', () => {
  // Sem isto, o sininho abriria "Novidades — v3.4.0" listando as notas da 3.3.
  assert.equal(notasVisiveis()[0].versao, VERSAO_DO_JOGO);
});

test('a versão do jogo acompanha a do package.json', () => {
  const { version } = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(VERSAO_DO_JOGO, version);
});

test('toda nota tem versão, e itens que dizem alguma coisa', () => {
  for (const nota of NOTAS_DE_ATUALIZACAO) {
    assert.match(nota.versao, /^\d+\.\d+\.\d+$/);
    assert.ok(nota.itens.length > 0, `a ${nota.versao} não tem itens`);
    for (const item of nota.itens) assert.ok(item.trim().length > 20, `item curto demais em ${nota.versao}: "${item}"`);
  }
});
