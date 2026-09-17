// Os dados de partida (aba "Respostas" do painel): buscar, juntar telefone
// quando der, e exportar em CSV.
//
// DUAS COLEÇÕES, DUAS REGRAS (ver firebase/firestore.rules e backend.js):
//
//   usuarios   resultado da partida, SEM telefone   -> leitura pública
//   contatos   nome + telefone                      -> leitura só autenticada
//
// `contatos` ficou fechada de propósito quando o login saiu da escrita do
// baralho (ver nuvem.js): é nome e telefone de jogador de verdade, e a
// política de privacidade que o próprio jogo exibe promete que não vaza para
// qualquer visitante. Por isso esta aba pede uma conta do Firebase — e é
// autenticação de verdade, não a senha 2040 da porta (essa viaja no mesmo
// JavaScript que o jogador recebe; a de aqui vive na conta de vocês).
//
// ANTES DE USAR: no Console do Firebase do projeto,
//   1. Authentication > Sign-in method > habilitar "E-mail/senha";
//   2. Authentication > Users > Add user, com o e-mail e senha de quem for
//      operar — NÃO existe cadastro pela própria tela, de propósito: se
//      qualquer um pudesse criar a própria conta, `auth != null` deixaria de
//      significar alguma coisa e a regra do Firestore não protegeria nada.
//
// SEM JUNÇÃO GARANTIDA POR ID. `addUsuario` grava os dois documentos em
// escritas separadas (dois `addDoc`), sem chave em comum — só nome e um
// horário próximo. `combinar`, abaixo, casa pelo nome e pelo horário mais
// perto dentro de uma janela; é palpite informado, não certeza, e por isso
// existe `janelaMs` para poder ser ajustada se um dia casar errado.

import { firebase, podeUsarNuvem } from '../firebase.js';
import { getRecords } from '../storage.js';

/* ---------------------------------------------------------------- login -- */

export async function entrar(email, senha) {
  const fb = await firebase();
  if (!fb) return { ok: false, motivo: 'a nuvem está desligada ou o jogo foi aberto do disco.' };
  try {
    await fb.fa.signInWithEmailAndPassword(fb.auth, email, senha);
    return { ok: true };
  } catch (erro) {
    const codigo = String(erro?.code ?? '');
    if (codigo.includes('invalid-credential') || codigo.includes('wrong-password') || codigo.includes('user-not-found')) {
      return { ok: false, motivo: 'e-mail ou senha não conferem.' };
    }
    if (codigo.includes('operation-not-allowed')) {
      return { ok: false, motivo: 'o login por e-mail/senha não está habilitado no projeto do Firebase.' };
    }
    if (codigo.includes('network')) return { ok: false, motivo: 'sem conexão com o Firebase.' };
    return { ok: false, motivo: erro?.message ?? String(erro) };
  }
}

export async function sair() {
  const fb = await firebase();
  if (fb) await fb.fa.signOut(fb.auth).catch(() => {});
}

/**
 * Avisa quando o login muda. O SDK restaura a sessão de forma assíncrona no
 * carregamento, então quem chama não pode desenhar "deslogado" e parar por
 * aí — o painel se redesenha quando isto dispara.
 *
 * @returns {Promise<Function>} uma função que cancela a inscrição
 */
export async function aoMudarOperador(fn) {
  const fb = await firebase();
  if (!fb) return () => {};
  return fb.fa.onAuthStateChanged(fb.auth, (u) => fn(u?.email ?? null));
}

/* ------------------------------------------------------------- os dados -- */

/** Não busca a coleção inteira sem fim: teto generoso para uma feira. */
const TETO_DE_LINHAS = 3000;

async function buscarColecao(nome, { limit }) {
  const fb = await firebase();
  if (!fb) return [];
  const { db, fs } = fb;
  const snap = await fs.getDocs(fs.query(fs.collection(db, nome), fs.orderBy('data', 'desc'), fs.limit(limit)));
  return snap.docs.map((d) => {
    const dados = d.data();
    // `data` pode ser Timestamp do Firestore (serverTimestamp) ou string ISO
    // (gravações antigas, ou sem `serverTimestamp: true`) — normaliza para um
    // jeito só antes de sair daqui.
    const data = dados.data?.toDate ? dados.data.toDate().toISOString() : dados.data ?? null;
    return { ...dados, data };
  });
}

/**
 * Junta `usuarios` com `contatos` pelo nome e pelo horário mais próximo.
 *
 * Guloso e sem reposição: o `contato` mais próximo de um `usuario` é
 * consumido, então dois jogadores do mesmo nome em horários parecidos não
 * ficam ambos com o telefone do primeiro.
 *
 * @param {number} janelaMs quão longe em ms ainda vale como "o mesmo".
 */
export function combinar(usuarios, contatos, { janelaMs = 60_000 } = {}) {
  const sobrando = contatos.map((c, i) => ({ ...c, __i: i }));
  return usuarios.map((u) => {
    const tUsuario = Date.parse(u.data ?? '');
    let melhor = -1;
    let melhorDelta = Infinity;
    for (let i = 0; i < sobrando.length; i++) {
      const c = sobrando[i];
      if (!c || c.nome !== u.nome) continue;
      const delta = Math.abs(Date.parse(c.data ?? '') - tUsuario);
      if (Number.isFinite(delta) && delta < melhorDelta) {
        melhor = i;
        melhorDelta = delta;
      }
    }
    if (melhor >= 0 && melhorDelta <= janelaMs) {
      const [c] = sobrando.splice(melhor, 1);
      return { ...u, telefone: c.telefone };
    }
    return { ...u, telefone: null };
  });
}

/**
 * As linhas da aba, prontas para desenhar e exportar.
 *
 * NUVEM QUANDO DÁ, LOCAL QUANDO NÃO DÁ — mesma regra do baralho (nuvem.js).
 * Não mistura as duas fontes: as partidas deste navegador já estão na nuvem
 * (é o mesmo `addUsuario` que grava as duas), então somar as duas contaria
 * cada partida bem-sucedida duas vezes.
 *
 * `comTelefone` é falso só quando a fonte é a nuvem e ninguém está
 * autenticado — localmente o telefone é deste navegador mesmo, sem segredo
 * nenhum para proteger dele.
 *
 * @returns {Promise<{linhas: object[], fonte: 'nuvem'|'local', comTelefone: boolean, autenticado: boolean}>}
 */
export async function buscarRespostas() {
  if (podeUsarNuvem()) {
    try {
      const fb = await firebase();
      const autenticado = Boolean(fb?.auth?.currentUser);
      const usuarios = await buscarColecao('usuarios', { limit: TETO_DE_LINHAS });
      const contatos = autenticado ? await buscarColecao('contatos', { limit: TETO_DE_LINHAS }) : [];
      return { linhas: combinar(usuarios, contatos), fonte: 'nuvem', comTelefone: autenticado, autenticado };
    } catch (erro) {
      console.warn('não deu para ler as respostas da nuvem; caindo para o local.', erro);
    }
  }
  const usuarios = getRecords('usuarios');
  const contatos = getRecords('contatos');
  return { linhas: combinar(usuarios, contatos), fonte: 'local', comTelefone: true, autenticado: false };
}

/* --------------------------------------------------------------- export -- */

/** As colunas, na ordem em que a tabela e o CSV mostram. */
export const COLUNAS = [
  { chave: 'nome', rotulo: 'Nome' },
  { chave: 'telefone', rotulo: 'Telefone' },
  { chave: 'atuacao', rotulo: 'Atuação' },
  { chave: 'equipamento', rotulo: 'Equipamento' },
  { chave: 'venceu', rotulo: 'Venceu' },
  { chave: 'tempo', rotulo: 'Tempo restante (s)' },
  { chave: 'invalido', rotulo: 'Respostas inválidas' },
  { chave: 'data', rotulo: 'Quando' },
];

/** Um valor de linha, formatado como o humano lê — não como o banco grava. */
export function formatarCelula(chave, valor) {
  if (valor == null) return '';
  if (chave === 'venceu') return valor ? 'Sim' : 'Não';
  if (chave === 'tempo') return (Number(valor) / 1000).toFixed(1);
  if (chave === 'data') {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR');
  }
  return String(valor);
}

/** Escapa um campo para CSV: aspas duplicadas, e entre aspas só quando precisa. */
function celulaCsv(texto) {
  if (/[",\n;]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

export function paraCSV(linhas, colunas = COLUNAS) {
  const cabecalho = colunas.map((c) => celulaCsv(c.rotulo)).join(';');
  const corpo = linhas.map((linha) => colunas.map((c) => celulaCsv(formatarCelula(c.chave, linha[c.chave]))).join(';'));
  // ";" e não "," — é o separador que o Excel em pt-BR assume sem perguntar.
  // BOM na frente para acentos não virarem "Ã§" ao abrir no Excel do Windows.
  return '﻿' + [cabecalho, ...corpo].join('\n');
}

/** Dispara o download de um texto como arquivo, sem precisar de servidor. */
export function baixarArquivo(nome, texto, tipo = 'text/csv;charset=utf-8') {
  const blob = new Blob([texto], { type: tipo });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
