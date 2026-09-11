// O baralho na nuvem: um documento no Firestore que a área administrativa
// escreve e todo totem lê.
//
// O PROBLEMA QUE ISTO RESOLVE
// Até aqui o baralho vivia no `localStorage` do navegador que o publicou.
// Editar no notebook não alcançava o totem: a travessia era exportar um JSON,
// levar num pendrive e importar do outro lado. Agora o admin publica num lugar
// só e qualquer totem com internet pega na partida seguinte.
//
// O DESENHO
//   conteudo/baralho   leitura pública (o jogo precisa, e não tem servidor)
//                      escrita só autenticada (senão qualquer visitante reescreve o jogo)
//
// O BARALHO INTEIRO VAI. Veículo, regras e perguntas — as dez de fábrica
// incluídas, mesmo intocadas. Houve uma versão que subia só o que diferia da
// fábrica e guardava o resto por referência: economizava 37 KB num teto de
// 1 MB, e em troca criava uma regra que ninguém adivinha — o texto de uma
// pergunta original passava a vir do `questions.js` do totem, não do que estava
// gravado. Quem abrisse o Firestore não veria o conteúdo do jogo. Não valia o
// que custava. O que está lá é o que o jogo joga, por extenso.
//
// O `localStorage` NÃO sai de cena: continua sendo o que o jogo lê, agora como
// cópia do que veio da nuvem. Isso é o que mantém o totem jogando quando a
// internet cai no meio da feira — e é o único modo possível quando ele abre do
// disco (ver firebase.js).
//
// A SENHA 2040 NÃO É ESTA. Aquela é a tranca da gaveta que esconde o painel
// (porta.js); esta é a credencial de verdade que o Firestore exige para
// escrever, e vive na conta de vocês, não no código.

import { firebase, podeUsarNuvem } from './firebase.js';
import { publicarBaralho, carregarBaralho } from './deck.js';

/** O documento único. Coleção e id fixos: é um baralho por instalação. */
const COLECAO = 'conteudo';
const DOCUMENTO = 'baralho';

/**
 * O Firestore recusa documento acima de 1 MiB, e a mensagem dele não diz o que
 * fazer. Este teto é menor de propósito — sobra para nomes de campo e para o
 * `serverTimestamp` — e quem o estoura, na prática, é foto enviada do
 * computador: cada uma vira um `data:` URL de ~88 KB dentro do baralho.
 */
const TETO_KB = 900;

const pesoEmKb = (obj) => Math.round(JSON.stringify(obj).length / 1024);

/**
 * O baralho inteiro cabe num documento? Separada de `publicarNaNuvem` porque
 * esta parte é pura — dá para afirmá-la em teste sem Firebase nenhum.
 */
export function cabeNaNuvem(deck) {
  const kb = pesoEmKb(deck);
  if (kb <= TETO_KB) return { ok: true, kb };
  return {
    ok: false,
    kb,
    motivo:
      `o baralho ficou com ${kb} KB e o Firestore aceita no máximo ${TETO_KB} por documento. ` +
      'Imagens enviadas do computador são o que mais ocupa — troque alguma por um caminho em assets/images.',
  };
}

/* ------------------------------------------------------------ sincronia -- */

/**
 * Puxa o baralho publicado e guarda como cópia local.
 *
 * Fire-and-forget de propósito: quem chama (o boot e a tela de cadastro) não
 * espera. Se a rede estiver fora, ou o jogo tiver aberto do disco, a função
 * devolve `false` e o jogo segue com o que já tinha.
 *
 * @returns {Promise<boolean>} se a cópia local mudou
 */
export async function sincronizarBaralho() {
  const fb = await firebase();
  if (!fb) return false;

  try {
    const { db, fs } = fb;
    const snap = await fs.getDoc(fs.doc(db, COLECAO, DOCUMENTO));
    if (!snap.exists()) return false;

    const remoto = snap.data()?.baralho;
    if (!remoto || !Array.isArray(remoto.slots) || remoto.slots.length === 0) return false;

    // Comparar o texto evita reescrever (e invalidar o cache da projeção de
    // estado) a cada partida quando nada mudou.
    if (JSON.stringify(remoto) === JSON.stringify(carregarBaralho())) return false;

    publicarBaralho(remoto);
    return true;
  } catch (erro) {
    console.warn('não deu para ler o baralho da nuvem; seguindo com o local.', erro);
    return false;
  }
}

/**
 * Publica o baralho para todos os totens. Exige estar logado.
 *
 * @returns {Promise<{ok: boolean, motivo?: string}>}
 */
export async function publicarNaNuvem(deck) {
  const fb = await firebase();
  if (!fb) {
    return {
      ok: false,
      motivo: podeUsarNuvem()
        ? 'não deu para falar com o Firebase.'
        : 'a nuvem está desligada ou o jogo foi aberto do disco.',
    };
  }
  if (!fb.auth.currentUser) return { ok: false, motivo: 'é preciso entrar para publicar.' };

  const cabe = cabeNaNuvem(deck);
  if (!cabe.ok) return { ok: false, motivo: cabe.motivo };

  try {
    const { db, fs } = fb;
    await fs.setDoc(fs.doc(db, COLECAO, DOCUMENTO), {
      baralho: deck,
      atualizadoEm: fs.serverTimestamp(),
      publicadoPor: fb.auth.currentUser.email ?? fb.auth.currentUser.uid,
    });
    return { ok: true, kb: cabe.kb };
  } catch (erro) {
    // A mensagem crua do Firestore ("Missing or insufficient permissions") não
    // diz ao operador o que fazer.
    const permissao = String(erro?.code ?? '').includes('permission');
    return {
      ok: false,
      motivo: permissao
        ? 'esta conta não tem permissão de escrita no baralho.'
        : `o Firestore recusou: ${erro?.message ?? erro}`,
    };
  }
}

/**
 * Quando e por quem o baralho foi salvo na nuvem pela última vez.
 *
 * É o que a barra do painel mostra no lugar de "publicado no totem": aquilo
 * dizia respeito só a este navegador, e o operador precisa saber se o que ele
 * salvou chegou ao Firebase — e se alguém em outra máquina salvou depois dele.
 *
 * @returns {Promise<{quando: Date|null, quem: string|null}|null>}
 */
export async function ultimaPublicacao() {
  const fb = await firebase();
  if (!fb) return null;
  try {
    const snap = await fb.fs.getDoc(fb.fs.doc(fb.db, COLECAO, DOCUMENTO));
    if (!snap.exists()) return null;
    const dados = snap.data();
    return {
      // `serverTimestamp` volta como Timestamp do Firestore; fica `null` no
      // instante entre gravar e o servidor responder.
      quando: dados.atualizadoEm?.toDate?.() ?? null,
      quem: dados.publicadoPor ?? null,
    };
  } catch (_) {
    return null;
  }
}

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
 * carregamento, então a barra do admin não pode desenhar "deslogado" e parar
 * por aí — ela se redesenha quando isto dispara.
 *
 * @returns {Promise<Function>} uma função que cancela a inscrição
 */
export async function aoMudarOperador(fn) {
  const fb = await firebase();
  if (!fb) return () => {};
  return fb.fa.onAuthStateChanged(fb.auth, (u) => fn(u?.email ?? null));
}
