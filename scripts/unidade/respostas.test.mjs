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
//
// E o "Apagar tabela": o caminho da nuvem exige conta do Firebase, e a suíte de
// navegador é hermética a ele (ver config.js) — então ele é afirmado aqui, contra
// uma nuvem de mentira com o mesmo formato do SDK.

import test from 'node:test';
import assert from 'node:assert/strict';
import { instalarArmazenamento } from './_armazenamento_falso.mjs';

const guardado = instalarArmazenamento();

const { COLUNAS, apagarColecao, apagarPartidas, combinar, formatarCelula, paraCSV, traduzirFalhaDeExclusao } = await import(
  '../../web/js/admin/respostas.js'
);
const { queryUsuariosVencedores } = await import('../../web/js/backend.js');
const { adiantarRanking, rankingAdiantado } = await import('../../web/js/estatisticas.js');

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

/* ------------------------------------------------------- apagar a tabela -- */

/**
 * Uma nuvem de mentira com a forma que `apagarColecao` usa do SDK: `getDocs`
 * devolve no máximo `limit` documentos, e o `writeBatch` os tira da coleção no
 * `commit`. Guarda o tamanho de cada lote, porque o teto do Firestore é de 500
 * operações e é isso que o código tem de respeitar.
 */
function nuvemFalsa({ colecoes, autenticado = true, recusarEm = null }) {
  const lotes = [];
  const fs = {
    collection: (_db, nome) => ({ nome }),
    limit: (n) => ({ n }),
    query: (colecao, lim) => ({ ...colecao, ...lim }),
    getDocs: async ({ nome, n }) => {
      const docs = colecoes[nome].slice(0, n).map((id) => ({ ref: { nome, id } }));
      return { empty: docs.length === 0, size: docs.length, docs };
    },
    writeBatch: () => {
      const refs = [];
      return {
        delete: (ref) => refs.push(ref),
        commit: async () => {
          if (refs.some((r) => r.nome === recusarEm)) throw Object.assign(new Error('recusado'), { code: 'permission-denied' });
          lotes.push(refs.length);
          for (const r of refs) colecoes[r.nome].splice(colecoes[r.nome].indexOf(r.id), 1);
        },
      };
    },
  };
  return { db: {}, fs, auth: { currentUser: autenticado ? { email: 'operador@tecnomotor.com.br' } : null }, lotes };
}

const ids = (n) => Array.from({ length: n }, (_, i) => `doc${i}`);

const semear = (venceu = true) => {
  const agora = Date.now();
  guardado.set('tecgame:usuarios', JSON.stringify([{ nome: 'Ana', venceu, tempo: 30_000, data: new Date(agora).toISOString() }]));
  guardado.set('tecgame:contatos', JSON.stringify([{ nome: 'Ana', telefone: '16997037115', data: new Date(agora).toISOString() }]));
};

test('apagar uma coleção grande vai em lotes que cabem no teto do Firestore', async () => {
  const nuvem = nuvemFalsa({ colecoes: { usuarios: ids(1000) } });
  const apagados = await apagarColecao(nuvem, 'usuarios');
  assert.equal(apagados, 1000);
  assert.ok(nuvem.lotes.length >= 3, `mil documentos em ${nuvem.lotes.length} lote(s)`);
  assert.ok(Math.max(...nuvem.lotes) <= 500, 'um lote passou das 500 operações que o Firestore aceita');
});

test('apagar a tabela local leva o ranking junto — ele é lido da mesma tabela', async () => {
  semear(true);
  assert.equal((await queryUsuariosVencedores({ limit: 5 })).length, 1, 'antes: a Ana está no ranking');

  const r = await apagarPartidas({ fonte: 'local' });

  assert.equal(r.ok, true);
  assert.equal(guardado.has('tecgame:usuarios'), false, 'as partidas continuaram guardadas');
  assert.equal(guardado.has('tecgame:contatos'), false, 'os telefones continuaram guardados');
  assert.deepEqual(await queryUsuariosVencedores({ limit: 5 }), [], 'o ranking sobreviveu à tabela');
});

test('o ranking adiantado não sobrevive à tabela que o gerou', async () => {
  // Sem esquecer, a pergunta abriria com um pódio de 2 minutos de validade
  // mostrando gente que acabou de ser apagada.
  semear(true);
  assert.equal((await adiantarRanking()).length, 1);
  assert.equal((await rankingAdiantado()).length, 1, 'adiantado vale');

  await apagarPartidas({ fonte: 'local' });

  assert.deepEqual(await rankingAdiantado(), [], 'o ranking guardado de antes continuou valendo');
});

test('na nuvem, apaga os contatos e as partidas e só então limpa o navegador', async () => {
  semear(true);
  const nuvem = nuvemFalsa({ colecoes: { contatos: ids(3), usuarios: ids(5) } });
  const r = await apagarPartidas({ fonte: 'nuvem', nuvem });
  assert.deepEqual(r, { ok: true, partidas: 5, contatos: 3 });
  assert.equal(guardado.has('tecgame:usuarios'), false, 'o navegador deveria ter sido limpo também');
});

test('na nuvem, sem conta, não apaga nada — nem o que está neste navegador', async () => {
  semear(true);
  const nuvem = nuvemFalsa({ colecoes: { contatos: ids(3), usuarios: ids(5) }, autenticado: false });
  const r = await apagarPartidas({ fonte: 'nuvem', nuvem });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /conta do Firebase/);
  assert.equal(nuvem.lotes.length, 0, 'tocou na nuvem sem conta');
  assert.equal(guardado.has('tecgame:usuarios'), true, 'apagou o local mesmo recusando a nuvem');
});

test('regra recusada: a mensagem manda publicar as regras, e nada some do navegador', async () => {
  semear(true);
  const nuvem = nuvemFalsa({ colecoes: { contatos: ids(3), usuarios: ids(5) }, recusarEm: 'contatos' });
  const r = await apagarPartidas({ fonte: 'nuvem', nuvem });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /regras de exclusão/);
  assert.match(r.dica, /firebase deploy --only firestore:rules/);
  assert.deepEqual(r.apagados, []);
  assert.equal(guardado.has('tecgame:usuarios'), true, 'a tela passaria a mentir: nuvem cheia, navegador vazio');
});

test('falha no meio diz o que já tinha saído: os contatos vão primeiro', async () => {
  semear(true);
  const nuvem = nuvemFalsa({ colecoes: { contatos: ids(3), usuarios: ids(5) }, recusarEm: 'usuarios' });
  const r = await apagarPartidas({ fonte: 'nuvem', nuvem });
  assert.equal(r.ok, false);
  assert.deepEqual(r.apagados, ['contatos'], 'o dado mais sensível sai primeiro, e a falha diz isso');
  assert.equal(nuvem.lotes.length, 1);
});

test('o prazo estourado e o erro desconhecido têm mensagem', () => {
  assert.match(traduzirFalhaDeExclusao(new Error('prazo')).motivo, /não respondeu a tempo/);
  assert.equal(traduzirFalhaDeExclusao(new Error('algo estranho')).motivo, 'algo estranho');
});
