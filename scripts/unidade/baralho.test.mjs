// A matriz do `validarBaralho` — o que impede publicar, e o que não impede.
//
// A suíte de navegador (verify/admin.mjs) atravessa a validação pela tela, e
// por isso cobre um caso: o enunciado apagado em pt. Cada regra a mais custaria
// ali um ciclo de Chrome; aqui custa microssegundos, e é o conjunto das regras
// que decide se um baralho quebrado chega ao totem.
//
// A conversão v1 -> v2 NÃO está aqui de propósito: verify/baralho.mjs já a
// afirma com o jogo rodando, que é a forma mais forte. O que este arquivo
// acrescenta é o que aquele não alcança.

import test from 'node:test';
import assert from 'node:assert/strict';
import { instalarArmazenamento } from './_armazenamento_falso.mjs';

instalarArmazenamento();

const { BARALHO_ORIGINAL, IDIOMAS, validarBaralho, perguntaVazia, perguntasAtivas } = await import(
  '../../web/js/deck.js'
);

/** Um baralho válido, novo a cada uso — os testes mexem nele. */
const valido = () => structuredClone(BARALHO_ORIGINAL);
const casa = (erros, padrao) => erros.some((e) => padrao.test(e));

test('o baralho de fábrica é publicável — é o chão de tudo', () => {
  // Se este quebrar, o totem sem nada publicado está com um baralho inválido.
  assert.deepEqual(validarBaralho(BARALHO_ORIGINAL), []);
});

test('o que impede publicar', async (t) => {
  await t.test('gabarito fora de 1..4', () => {
    const d = valido();
    d.slots[2].perguntas[0].gabarito = '5';
    assert.ok(casa(validarBaralho(d), /rodada 3: gabarito precisa ser 1, 2, 3 ou 4/));
  });

  await t.test('nenhum equipamento resolve a pergunta', () => {
    const d = valido();
    d.slots[0].perguntas[0].scanners = { raster3S: false, rasher4: false, xtool: false };
    // Sem isto o jogador escolhe qualquer scanner e todos respondem "equipamento
    // inválido": partida sem saída.
    assert.ok(casa(validarBaralho(d), /nenhum equipamento resolve/));
  });

  await t.test('todas as perguntas do veículo desligadas', () => {
    const d = valido();
    d.slots[1].perguntas.forEach((p) => (p.ativa = false));
    assert.ok(casa(validarBaralho(d), /rodada 2: todas as perguntas estão desligadas/));
  });

  await t.test('veículo sem nome ou sem imagem', () => {
    const d = valido();
    d.slots[0].veiculo.nome = '   ';
    d.slots[1].veiculo.imagem = '';
    const erros = validarBaralho(d);
    assert.ok(casa(erros, /rodada 1: o veículo está sem nome/));
    assert.ok(casa(erros, /rodada 2: o veículo está sem imagem/));
  });

  await t.test('campo obrigatório vazio em UM idioma só', () => {
    // Os três idiomas são independentes e não há retorno para o português: um
    // campo vazio em EN vira tela em branco para quem jogar em inglês.
    const d = valido();
    d.slots[4].perguntas[0].en.respostaDois = '';
    assert.ok(casa(validarBaralho(d), /rodada 5: respostaDois vazio em EN/));
  });

  await t.test('baralho vazio, ou sem a lista de slots', () => {
    assert.ok(casa(validarBaralho({ versao: 2, slots: [] }), /o baralho está vazio/));
    assert.deepEqual(validarBaralho(null), ['baralho sem a lista de slots']);
    assert.deepEqual(validarBaralho({}), ['baralho sem a lista de slots']);
  });
});

test('pergunta desligada é rascunho: fica vazia sem travar ninguém', () => {
  const d = valido();
  const rascunho = perguntaVazia();
  rascunho.ativa = false;
  d.slots[0].perguntas.push(rascunho);

  assert.deepEqual(validarBaralho(d), [], 'rascunho não pode impedir publicar');
  assert.equal(perguntasAtivas(d.slots[0]).length, 1, 'e não pode cair em partida');

  // Mas basta ligá-lo para os campos vazios passarem a valer.
  rascunho.ativa = true;
  assert.ok(validarBaralho(d).length > 0);
});

test('a mensagem de erro é contrato com o painel, não texto solto', () => {
  // `errosPorRodada`, em admin/painel.js, lê cada mensagem com a regex abaixo
  // para acender a rodada e a pergunta certas na lateral. Mudar o formato da
  // frase aqui apaga o realce lá sem quebrar nada visível — por isso o formato
  // é afirmado, e não só o conteúdo.
  const FORMATO = /^rodada (\d+)(?:, pergunta (\d+))?: (.+)$/;

  const d = valido();
  d.slots[6].perguntas.push(perguntaVazia());
  d.slots[6].perguntas[1].gabarito = '9';

  const erros = validarBaralho(d).filter((e) => e.startsWith('rodada'));
  assert.ok(erros.length > 0);
  for (const e of erros) assert.match(e, FORMATO, `o painel não saberia onde acender: ${e}`);

  // Com banco de mais de uma pergunta, a coordenada da pergunta tem de vir
  // junto — senão o painel manda o operador para a pergunta 1, que está certa.
  assert.ok(casa(erros, /^rodada 7, pergunta 2: gabarito/));
});

test('os três idiomas são cobrados, um por um', () => {
  for (const lang of IDIOMAS) {
    const d = valido();
    d.slots[0].perguntas[0][lang].pergunta = '';
    assert.ok(
      casa(validarBaralho(d), new RegExp(`pergunta vazio em ${lang.toUpperCase()}`)),
      `${lang} não foi cobrado`
    );
  }
});
