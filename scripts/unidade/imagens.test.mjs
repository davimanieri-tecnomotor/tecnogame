// As fotos de veículo no Storage: o que conta como "em uso" e o que a limpeza
// apaga.
//
// É a parte do envio de fotos que APAGA coisa, então as bordas importam mais
// que em qualquer outro lugar: um endereço que `caminhoNoStorage` não
// reconhece deixa a foto desprotegida, e uma foto desprotegida some do totem
// depois da carência. O caminho no navegador — enviar, salvar, limpar, recusar
// foto sumida — está em verify/imagens.mjs, com um Storage de mentira.

import test from 'node:test';
import assert from 'node:assert/strict';
import { instalarArmazenamento } from './_armazenamento_falso.mjs';

instalarArmazenamento();

const { CARENCIA_DIAS, PASTA, bytesDeDataUrl, caminhoNoStorage, escolherOrfas, fotosDoBaralho, nomeDaFoto } =
  await import('../../web/js/admin/imagens.js');
const { CONFIG } = await import('../../web/js/config.js');

const BUCKET = CONFIG.firebaseOptions.storageBucket;
const HEX = 'a'.repeat(64);
const endereco = (caminho, bucket = BUCKET) =>
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(caminho)}?alt=media&token=abc-123`;
const DIA = 24 * 60 * 60 * 1000;

/* ---------------------------------------------------- caminhoNoStorage -- */

test('o endereço de download do bucket do projeto vira o caminho da foto', () => {
  assert.equal(caminhoNoStorage(endereco(`veiculos/${HEX}.webp`)), `veiculos/${HEX}.webp`);
  // Sem token também — a parte que identifica a foto é o caminho.
  assert.equal(
    caminhoNoStorage(`https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/veiculos%2F${HEX}.png?alt=media`),
    `veiculos/${HEX}.png`
  );
});

test('o que não é foto deste bucket, nesta pasta, não é reconhecido', () => {
  for (const outro of [
    'assets/images/BMW.png',
    'data:image/webp;base64,AAAA',
    '',
    null,
    undefined,
    42,
    'https://exemplo.com/v0/b/x/o/veiculos%2Fa.webp',
    // o projeto morto do FlutterFlow: nunca é nosso para apagar
    endereco(`veiculos/${HEX}.webp`, 'projeto-assis-3qcf6v.appspot.com'),
    // outra pasta do bucket, e subpasta de veiculos/
    endereco(`videos/${HEX}.mp4`),
    endereco(`veiculos/sub/${HEX}.webp`),
    // http, e endereço malformado
    `http://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/veiculos%2F${HEX}.webp`,
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/veiculos%2F%E0%A4%A.webp`,
  ]) {
    assert.equal(caminhoNoStorage(outro), null, `reconheceu ${JSON.stringify(outro)}`);
  }
});

test('o baralho cita cada foto uma vez, e ignora caminho de arquivo e data URL', () => {
  const deck = {
    slots: [
      { veiculo: { imagem: endereco(`veiculos/${HEX}.webp`) } },
      { veiculo: { imagem: endereco(`veiculos/${HEX}.webp`) } },
      { veiculo: { imagem: 'assets/images/BMW.png' } },
      { veiculo: { imagem: 'data:image/png;base64,AAAA' } },
      { veiculo: {} },
      {},
    ],
  };
  assert.deepEqual([...fotosDoBaralho(deck)], [`veiculos/${HEX}.webp`]);
  assert.equal(fotosDoBaralho(null).size, 0);
});

/* ------------------------------------------------------- escolherOrfas -- */

test('a limpeza apaga só o que está fora de uso E parado além da carência', () => {
  const agora = Date.parse('2026-10-06T12:00:00Z');
  const velho = new Date(agora - (CARENCIA_DIAS + 1) * DIA).toISOString();
  const novo = new Date(agora - (CARENCIA_DIAS - 1) * DIA).toISOString();
  const arquivos = [
    { caminho: 'veiculos/em-uso-velha.webp', atualizado: velho },
    { caminho: 'veiculos/orfa-velha.webp', atualizado: velho },
    { caminho: 'veiculos/orfa-nova.webp', atualizado: novo },
    { caminho: 'veiculos/orfa-sem-data.webp', atualizado: null },
    { caminho: 'veiculos/orfa-data-ruim.webp', atualizado: 'ontem' },
    { caminho: 'outra-pasta/orfa-velha.webp', atualizado: velho },
  ];
  const emUso = new Set(['veiculos/em-uso-velha.webp']);
  assert.deepEqual(escolherOrfas(arquivos, emUso, { agora }), ['veiculos/orfa-velha.webp']);
});

test('a carência é estrita: exatamente no limite, a foto fica', () => {
  const agora = 1_000_000_000_000;
  const carenciaMs = 5000;
  const arquivos = [
    { caminho: `${PASTA}/no-limite.webp`, atualizado: agora - carenciaMs },
    { caminho: `${PASTA}/passou.webp`, atualizado: agora - carenciaMs - 1 },
  ];
  assert.deepEqual(escolherOrfas(arquivos, new Set(), { agora, carenciaMs }), [`${PASTA}/passou.webp`]);
});

/* ----------------------------------------------------- nome e conteúdo -- */

test('o nome da foto é a impressão digital, com a extensão do tipo', () => {
  assert.equal(nomeDaFoto(HEX, 'image/webp'), `veiculos/${HEX}.webp`);
  assert.equal(nomeDaFoto(HEX, 'image/jpeg'), `veiculos/${HEX}.jpg`);
  // O que storage.rules recusaria não chega a ganhar nome.
  assert.equal(nomeDaFoto(HEX, 'image/svg+xml'), null);
  assert.equal(nomeDaFoto('curto', 'image/webp'), null);
  assert.equal(nomeDaFoto(HEX.toUpperCase(), 'image/webp'), null);
});

test('o data URL volta aos bytes que o originaram', () => {
  const original = Uint8Array.from([0, 1, 2, 250, 255, 128]);
  const dataUrl = `data:image/PNG;base64,${Buffer.from(original).toString('base64')}`;
  const { tipo, bytes } = bytesDeDataUrl(dataUrl);
  assert.equal(tipo, 'image/png');
  assert.deepEqual([...bytes], [...original]);
  assert.throws(() => bytesDeDataUrl('assets/images/BMW.png'), /formato/);
  assert.throws(() => bytesDeDataUrl('data:image/png,naoebase64'), /formato/);
});
