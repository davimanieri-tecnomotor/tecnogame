// A junção `usuarios` + `contatos` e o CSV que a aba Respostas baixa.
//
// `combinar` é a única parte do projeto que resolve por palpite: não há chave
// em comum entre as duas coleções (são dois `addDoc` separados), então o
// telefone é casado por nome e pelo horário mais próximo. Palpite tem de ser
// afirmado caso a caso — é o que decide se o CSV que a equipe usa diz a verdade.
//
// O CSV está aqui pelo mesmo motivo: verify/respostas.mjs baixa o arquivo e
// confere que ele existe e tem linhas; o que ninguém conferia era o escape, e
// escape errado só aparece no dia em que alguém digitar ponto e vírgula no nome.

import test from 'node:test';
import assert from 'node:assert/strict';
import { instalarArmazenamento } from './_armazenamento_falso.mjs';

instalarArmazenamento();

const { COLUNAS, combinar, formatarCelula, paraCSV } = await import('../../web/js/admin/respostas.js');

const T0 = Date.parse('2026-09-21T12:00:00.000Z');
const quando = (ms) => new Date(T0 + ms).toISOString();

test('o telefone vai para a partida certa quando há uma só', () => {
  const linhas = combinar(
    [{ nome: 'Ana', data: quando(0) }],
    [{ nome: 'Ana', telefone: '16997037115', data: quando(1500) }]
  );
  assert.equal(linhas[0].telefone, '16997037115');
});

test('fora da janela não casa — melhor sem telefone do que com o errado', () => {
  const linhas = combinar(
    [{ nome: 'Ana', data: quando(0) }],
    [{ nome: 'Ana', telefone: '16997037115', data: quando(90_000) }]
  );
  assert.equal(linhas[0].telefone, null);
});

test('guloso e SEM reposição: dois de mesmo nome não herdam o mesmo telefone', () => {
  // É o caso que o desenho existe para evitar. Sem consumir o contato casado, a
  // segunda Ana receberia o telefone da primeira, e a equipe ligaria para a
  // pessoa errada.
  //
  // Os horários abaixo não são arbitrários: PRIMEIRA é o contato mais próximo
  // das DUAS partidas. Com contatos que já ficam mais perto de uma partida cada,
  // o resultado sai certo mesmo sem consumir — e o teste passaria sem afirmar
  // nada. É preciso disputar o mesmo contato para a regra aparecer.
  const linhas = combinar(
    [
      { nome: 'Ana', data: quando(0) },
      { nome: 'Ana', data: quando(2000) },
    ],
    [
      { nome: 'Ana', telefone: 'PRIMEIRA', data: quando(1000) },
      { nome: 'Ana', telefone: 'SEGUNDA', data: quando(30_000) },
    ]
  );
  assert.deepEqual(
    linhas.map((l) => l.telefone),
    ['PRIMEIRA', 'SEGUNDA']
  );
});

test('nome diferente nunca casa, por mais perto que esteja no relógio', () => {
  const linhas = combinar(
    [{ nome: 'Ana', data: quando(0) }],
    [{ nome: 'Bruno', telefone: '16997037115', data: quando(10) }]
  );
  assert.equal(linhas[0].telefone, null);
});

test('partida sem `data` fica sem telefone — e isso é sintoma, não regra', () => {
  // A junção precisa de um horário dos dois lados. Uma partida gravada sem
  // `data` nunca casa, e há um caminho que grava assim: a derrota por tempo
  // chama `addUsuario` sem `serverTimestamp`. O conserto é lá, na gravação;
  // aqui fica registrado o que acontece enquanto não for consertado.
  const linhas = combinar(
    [{ nome: 'Ana' }],
    [{ nome: 'Ana', telefone: '16997037115', data: quando(0) }]
  );
  assert.equal(linhas[0].telefone, null);
});

test('o CSV abre no Excel em pt-BR: ponto e vírgula e BOM', () => {
  const csv = paraCSV([{ nome: 'Ana', venceu: true }], [
    { chave: 'nome', rotulo: 'Nome' },
    { chave: 'venceu', rotulo: 'Venceu' },
  ]);
  assert.equal(csv.charCodeAt(0), 0xfeff, 'sem BOM o Excel do Windows come os acentos');
  assert.equal(csv.slice(1), 'Nome;Venceu\nAna;Sim');
});

test('o escape do CSV aguenta o que um jogador digita', () => {
  const colunas = [{ chave: 'nome', rotulo: 'Nome' }];
  // Sem `split('\n')`: um campo com quebra de linha legítima (entre aspas) faz
  // dividir por linha devolver meia célula. Tira-se o BOM e o cabeçalho, e o
  // que sobra é a linha inteira, quebra incluída.
  const corpo = (nome) => paraCSV([{ nome }], colunas).slice(1).replace(/^Nome\n/, '');

  assert.equal(corpo('Silva; Ana'), '"Silva; Ana"', 'ponto e vírgula parte a linha em duas colunas');
  assert.equal(corpo('Ana "A" Silva'), '"Ana ""A"" Silva"', 'aspas têm de ser dobradas');
  assert.equal(corpo('Ana,Silva'), '"Ana,Silva"');
  assert.equal(corpo('Ana\nSilva'), '"Ana\nSilva"', 'quebra de linha viraria registro novo');
  assert.equal(corpo('Ana Silva'), 'Ana Silva', 'e o caso comum não ganha aspas à toa');
});

test('a célula é formatada como o humano lê', () => {
  assert.equal(formatarCelula('venceu', true), 'Sim');
  assert.equal(formatarCelula('venceu', false), 'Não');
  assert.equal(formatarCelula('tempo', 12_345), '12.3', 'o banco guarda ms; a planilha mostra segundos');
  assert.equal(formatarCelula('nome', null), '');
  assert.equal(formatarCelula('data', 'anteontem'), '', 'data ilegível vira vazio, não "Invalid Date"');
  // Só a forma, não o valor: o fuso é o da máquina que exporta.
  assert.match(formatarCelula('data', '2026-09-21T12:00:00.000Z'), /^\d{2}\/\d{2}\/\d{4}/);
});

test('as colunas do CSV são as mesmas da tabela, na mesma ordem', () => {
  // A aba desenha por COLUNAS e exporta por COLUNAS: se um dia forem duas
  // listas, o CSV passa a mentir sobre o que está na tela.
  const cabecalho = paraCSV([]).slice(1);
  assert.equal(cabecalho, COLUNAS.map((c) => c.rotulo).join(';'));
});
