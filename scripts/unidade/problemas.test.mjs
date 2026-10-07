// O selo "N problemas" da barra do painel: as mensagens de `validarBaralho`
// agrupadas por veículo e por pergunta, e traduzidas para o nome que a tela usa.
//
// O tradutor lê o TEXTO das mensagens. Se o validador mudar uma frase, o painel
// continua funcionando — mostra a mensagem crua —, mas perde a tradução sem
// aviso. Este arquivo é o aviso: cada regra do validador tem a sua frase aqui.

import test from 'node:test';
import assert from 'node:assert/strict';
import { instalarArmazenamento } from './_armazenamento_falso.mjs';

instalarArmazenamento();

const { BARALHO_ORIGINAL, perguntaVazia } = await import('../../web/js/deck.js');
const { agruparProblemas, explicarProblema } = await import('../../web/js/admin/problemas.js');

const valido = () => structuredClone(BARALHO_ORIGINAL);

test('o baralho de fábrica não tem problema nenhum', () => {
  const r = agruparProblemas(valido());
  assert.equal(r.total, 0);
  assert.deepEqual(r.itens, []);
});

test('cada problema fica no veículo e na pergunta onde mora', () => {
  const deck = valido();
  deck.slots[2].veiculo.nome = '';
  deck.slots[4].perguntas.push(perguntaVazia());
  deck.slots[4].perguntas[1].pt.pergunta = 'só o enunciado em português';

  const r = agruparProblemas(deck);
  assert.equal(r.porRodada.get(2).length, 1);
  assert.match(r.porPergunta.get('2:0')[0], /sem nome/);
  // A pergunta 2 do veículo 5: os outros nove campos em pt e os dez em en e es.
  assert.equal(r.porPergunta.get('4:1').length, 29);
  assert.equal(r.porPergunta.has('4:0'), false);
  assert.deepEqual(r.itens[0], { i: 2, j: 0, mensagem: 'o veículo está sem nome' });
  assert.equal(r.total, r.itens.length);
});

test('o problema que não é de veículo nenhum fica nos gerais', () => {
  const r = agruparProblemas({ versao: 2, slots: [] });
  assert.equal(r.gerais.length, 1);
  assert.equal(r.itens.length, 0);
});

test('cada regra do validador vira uma frase da tela', () => {
  const deck = valido();
  const p = deck.slots[0].perguntas[0];
  deck.slots[0].veiculo.nome = '';
  deck.slots[0].veiculo.imagem = '';
  p.gabarito = '7';
  p.scanners = { raster3S: false, rasher4: false, xtool: false };
  p.en.respostaDois = '';
  p.video = 'youtube.com/x';
  deck.slots[1].perguntas[0].ativa = false;
  deck.slots[2].perguntas = [];

  const textos = agruparProblemas(deck).itens.map((it) => explicarProblema(it.mensagem).texto);
  assert.deepEqual(textos.sort(), [
    'Alternativa 2 em branco, em English',
    'a resposta correta não está marcada',
    'falta a foto do veículo',
    'falta o nome do veículo',
    'nenhum equipamento marcado',
    'o link do vídeo precisa começar com https://',
    'o veículo está sem pergunta',
    'todas as perguntas do veículo estão desligadas',
  ]);
});

test('o campo em branco diz o idioma, para o clique abrir a aba certa', () => {
  assert.deepEqual(explicarProblema('pergunta vazio em ES'), { texto: 'Enunciado em branco, em Español', idioma: 'es' });
  assert.deepEqual(explicarProblema('ajudaApoio vazio em PT'), {
    texto: 'Dica do Apoio Técnico em branco, em Português',
    idioma: 'pt',
  });
  // O que o mapa não conhece passa como veio — esconder seria pior.
  assert.deepEqual(explicarProblema('algo novo do validador'), { texto: 'algo novo do validador', idioma: null });
});
