// O diagnóstico do login: o que cada recusa do Firebase quer dizer, e por que
// a nuvem está desligada onde está.
//
// Existe porque "não consigo entrar" tinha causas diferentes com a mesma cara
// na tela — e a mais provável (conta criada noutro projeto) volta do Firebase
// com o mesmo código da senha errada. O que se afirma aqui é que cada caso
// chega ao operador com o que conferir, e não só com "não conferem".
//
// O caminho no navegador — o aviso aparecendo, a caixa "Manter conectado"
// chegando ao SDK — está em verify/login.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { instalarArmazenamento } from './_armazenamento_falso.mjs';

instalarArmazenamento();

const { traduzirFalhaDeLogin, descreverFalha } = await import('../../web/js/admin/respostas.js');
const { motivoDaNuvemDesligada } = await import('../../web/js/config.js');

/* ---------------------------------------------------------- as recusas -- */

test('credencial recusada aponta o projeto certo no Console', () => {
  const { motivo, dica } = traduzirFalhaDeLogin('auth/invalid-credential');
  assert.match(motivo, /não conferem/);
  // É a dica, e não o motivo, que resolve o caso da conta no projeto errado.
  assert.match(dica, /tecnogame-c7e46/);
  assert.match(dica, /outro projeto/);
});

test('os códigos antigos da senha errada caem no mesmo caso', () => {
  for (const codigo of ['auth/wrong-password', 'auth/user-not-found', 'auth/invalid-login-credentials']) {
    assert.match(traduzirFalhaDeLogin(codigo).motivo, /não conferem/, codigo);
  }
});

test('login desabilitado diz onde habilitar', () => {
  const { dica } = traduzirFalhaDeLogin('auth/operation-not-allowed');
  assert.match(dica, /Sign-in method/);
});

test('chave restrita por endereço não vira "chave recusada"', () => {
  // As duas são problema da chave, mas só a restrição tem conserto sem trocar
  // de chave: liberar o endereço. Por isso cada uma tem o seu motivo.
  const { motivo } = traduzirFalhaDeLogin('auth/requests-from-referer-http://127.0.0.1:8099-are-blocked.');
  assert.match(motivo, /restrita por endereço/);
});

test('cada recusa conhecida tem motivo próprio', () => {
  const codigos = [
    'auth/invalid-email',
    'auth/user-disabled',
    'auth/too-many-requests',
    'auth/network-request-failed',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.',
  ];
  const motivos = codigos.map((c) => traduzirFalhaDeLogin(c).motivo);
  assert.equal(new Set(motivos).size, codigos.length);
  for (const m of motivos) assert.doesNotMatch(m, /^auth\//);
});

test('código desconhecido mostra a mensagem do SDK, sem inventar dica', () => {
  const r = traduzirFalhaDeLogin('auth/qualquer-coisa-nova', 'Firebase: Error (auth/qualquer-coisa-nova).');
  assert.equal(r.motivo, 'Firebase: Error (auth/qualquer-coisa-nova).');
  assert.equal(r.dica, null);
});

test('a linha do aviso leva o código entre colchetes', () => {
  const linha = descreverFalha({ codigo: 'auth/invalid-credential', ...traduzirFalhaDeLogin('auth/invalid-credential') });
  assert.match(linha, /\[auth\/invalid-credential\]/);
  assert.match(linha, /Authentication → Users/);
});

/* ------------------------------------------------- a nuvem desligada -- */

/** Troca o `location` global pelo endereço dado, e devolve o motivo. */
function motivoEm(endereco) {
  const u = new URL(endereco);
  globalThis.location = { protocol: u.protocol, hostname: u.hostname, search: u.search, hash: u.hash };
  try {
    return motivoDaNuvemDesligada();
  } finally {
    delete globalThis.location;
  }
}

test('aberto do disco, o motivo é o disco', () => {
  assert.match(motivoEm('file:///C:/tecgame/web/index.html#/adm'), /file:\/\//);
});

test('localhost sem chave manda pôr o ?comNuvem=1', () => {
  assert.match(motivoEm('http://localhost:8099/#/adm'), /\?comNuvem=1#\/adm/);
});

test('o ?comNuvem=1 depois do # é apontado como o erro', () => {
  assert.match(motivoEm('http://localhost:8099/#/adm?comNuvem=1'), /depois do #/);
});

test('com a chave no lugar certo, nada impede', () => {
  assert.equal(motivoEm('http://localhost:8099/?comNuvem=1#/adm'), null);
  assert.equal(motivoEm('https://davimanieri-tecnomotor.github.io/tecnogame/#/adm'), null);
});

test('?semNuvem=1 desliga até no endereço de produção', () => {
  assert.match(motivoEm('https://davimanieri-tecnomotor.github.io/tecnogame/?semNuvem=1#/adm'), /semNuvem/);
});
