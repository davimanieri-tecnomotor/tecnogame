// A retenção de um ano e os dois jeitos de a escrita falhar.
//
// Por que isto mora aqui e não na suíte de navegador: a suíte joga partidas, e
// partida jogada nasce com data de hoje — para ver o corte de um ano ela teria
// de mexer no relógio do Chrome. `getRecords` recebe `agora` por parâmetro
// exatamente para isso ser desnecessário.
//
// E o que está em jogo não é detalhe: a política de privacidade que o próprio
// jogo exibe promete apagar os dados depois de um ano, e do lado do Firestore
// ainda não há nada que cumpra isso (ver o pendente nº 3 de
// firebase/README.md). Enquanto não houver, este corte local é a única parte da
// promessa que o projeto de fato executa.

import test from 'node:test';
import assert from 'node:assert/strict';
import { instalarArmazenamento, removerArmazenamento } from './_armazenamento_falso.mjs';

instalarArmazenamento();

const { RETENCAO_MS, getRecords, putRecord, readJson, writeRaw, motivoDaFalha } = await import(
  '../../web/js/storage.js'
);

const AGORA = Date.parse('2026-09-21T12:00:00.000Z');
const emDias = (d) => new Date(AGORA - d * 24 * 60 * 60 * 1000).toISOString();

test('um ano é o prazo, e o que passou dele sai na próxima leitura', () => {
  const chave = 'retencao.corte';
  putRecord(chave, { nome: 'recente', data: emDias(300) }, AGORA);
  putRecord(chave, { nome: 'antigo', data: emDias(400) }, AGORA);

  const vivos = getRecords(chave, AGORA);
  assert.deepEqual(
    vivos.map((r) => r.nome),
    ['recente'],
    'o registro de 400 dias deveria ter expirado'
  );

  // Não basta filtrar na leitura: o que expirou tem de sumir do armazenamento,
  // senão o dado continua lá e a promessa não foi cumprida.
  assert.deepEqual(
    readJson(chave, []).map((r) => r.nome),
    ['recente'],
    'o expirado continuou gravado'
  );
});

test('o corte é em RETENCAO_MS, não em algum número aproximado', () => {
  const chave = 'retencao.limite';
  putRecord(chave, { nome: 'na borda', data: new Date(AGORA - RETENCAO_MS).toISOString() }, AGORA);
  putRecord(chave, { nome: 'um passo além', data: new Date(AGORA - RETENCAO_MS - 1000).toISOString() }, AGORA);

  assert.deepEqual(
    getRecords(chave, AGORA).map((r) => r.nome),
    ['na borda'],
    'o corte é `>= agora - RETENCAO_MS`: a borda fica, o passo além sai'
  );
});

test('registro sem data legível NÃO expira — e isso tem custo', () => {
  // Isto documenta o contrato de hoje, não o desejo: `getRecords` mantém o que
  // não consegue datar, para um dado estranho não sumir em silêncio. O custo é
  // que um registro gravado SEM `data` fica guardado para sempre, fora da
  // retenção — e há um caminho que grava assim: a partida perdida por tempo
  // chama `addUsuario` sem `serverTimestamp`. Se aquele caminho for corrigido,
  // este teste continua valendo; o que muda é deixar de haver quem caia nele.
  const chave = 'retencao.semData';
  putRecord(chave, { nome: 'sem data nenhuma' }, AGORA);
  putRecord(chave, { nome: 'data ilegível', data: 'anteontem' }, AGORA);

  assert.equal(getRecords(chave, AGORA).length, 2);
});

test('cota estourada e armazenamento recusado são falhas diferentes', () => {
  // O painel precisa distinguir as duas: "não cabe mais" pede apagar foto, "o
  // navegador recusou" pede trocar de navegador ou sair do modo privado. Um
  // `false` seco mandaria o operador para o conserto errado.
  instalarArmazenamento({ tetoBytes: 10 });
  assert.equal(writeRaw('grande', 'x'.repeat(50)), false);
  assert.equal(motivoDaFalha(), 'cheio');

  assert.equal(writeRaw('pequeno', 'ok'), true);
  assert.equal(motivoDaFalha(), null, 'escrita boa tem de limpar a falha anterior');

  removerArmazenamento();
  assert.equal(writeRaw('qualquer', 'coisa'), false);
  assert.equal(motivoDaFalha(), 'recusado');
});

test('sem armazenamento o jogo lê vazio em vez de morrer', () => {
  // É o navegador em modo privado. A tela tem de abrir; o que se perde é só a
  // persistência.
  removerArmazenamento();
  assert.deepEqual(getRecords('qualquer'), []);
  assert.deepEqual(readJson('qualquer', { padrao: true }), { padrao: true });
});
