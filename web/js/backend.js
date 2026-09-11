// Port of the Firestore layer (lib/backend/backend.dart, usuarios_record.dart)
// and the two HTTP calls in lib/backend/api_requests/api_calls.dart.
//
// O ranking vai para o Firestore de `tecnogame-c7e46` (o projeto do Dart,
// `projeto-assis-3qcf6v`, está morto) E para o armazenamento deste navegador.
// Os dois, e não um ou outro: ver `addUsuario`.
//
// O disparo de WhatsApp pela z-api continua DESLIGADO (`useWhatsApp` em
// config.js), porque a credencial dele não pode viajar no cliente.
//
// Com o Firestore desligado, ou sem rede, a consulta cai no local e mantém a
// mesma semântica do Dart (`where venceu == true`, `orderBy tempo desc`,
// `limit n`).

import { CONFIG } from './config.js';
import { firebase } from './firebase.js';
import { getRecords, putRecord } from './storage.js';

const LOCAL_KEY = 'usuarios';
/** Telefone fica separado do ranking; ver addUsuario e firebase/firestore.rules. */
const CONTACT_KEY = 'contatos';

/* -------------------------------------------------------- UsuariosRecord -- */

/** createUsuariosRecordData(...) - fields with a null value are omitted, which
 *  is what FlutterFlow's `createUsuariosRecordData` does. */
export function createUsuariosRecordData({
  nome = null,
  telefone = null,
  atuacao = null,
  venceu = null,
  tempo = null,
  equipamento = null,
  data = null,
  invalido = null,
} = {}) {
  const record = { nome, telefone, atuacao, venceu, tempo, equipamento, data, invalido };
  for (const key of Object.keys(record)) {
    if (record[key] == null) delete record[key];
  }
  return record;
}

/** Ranking local, já com a retenção de um ano aplicada (ver storage.js). */
const readLocal = () => getRecords(LOCAL_KEY);

/* ------------------------------------------------------------- Firestore -- */

/**
 * PACIÊNCIA COM A REDE. Um `getDocs`/`addDoc` do Firestore não falha quando não
 * há conexão (ou quando o banco nem foi criado no console): ele fica
 * PENDENTE, esperando o servidor, e o SDK guarda a escrita para reenviar.
 *
 * Isso é bom para um app comum e péssimo para um totem de feira: a tela de fim
 * ficaria em branco esperando um ranking que nunca chega, e o resultado da
 * partida nunca seria gravado em lugar nenhum. Por isso toda chamada daqui tem
 * prazo, e o local é o chão que sempre existe.
 */
const PRAZO_MS = 2500;

const comPrazo = (promessa, ms = PRAZO_MS) =>
  Promise.race([promessa, new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error('prazo')), ms))]);

let firestore = null;

async function ensureFirestore() {
  const fb = await firebase();
  if (!fb) return null;
  firestore = { db: fb.db, fs: fb.fs };
  return firestore;
}

/* ------------------------------------------------------------------ API --- */

/**
 * `await UsuariosRecord.collection.doc().set(createUsuariosRecordData(...))`
 *
 * O Dart gravava tudo — inclusive o TELEFONE — numa unica colecao `usuarios`,
 * cujas regras liberavam leitura para qualquer um. Como o ranking do jogo le
 * essa colecao no cliente, sem servidor, a leitura tem de continuar publica; o
 * que muda e o que vai la dentro. O registro e partido em dois:
 *
 *   usuarios  o resultado da partida, SEM telefone  -> e o que o ranking le
 *   contatos  nome + telefone                       -> escrita cega, leitura autenticada
 *
 * Ver firebase/firestore.rules. O `data` e server timestamp no Dart; aqui, com
 * Firestore desligado, e o relogio do cliente, usado so para ordenar e para a
 * retencao de um ano.
 */
export async function addUsuario(record, { serverTimestamp = false } = {}) {
  const { telefone, ...partida } = record;
  const row = { ...partida };
  if (serverTimestamp) row.data = new Date().toISOString();

  const contato = telefone ? { nome: partida.nome ?? '', telefone, ...(row.data ? { data: row.data } : {}) } : null;

  // O LOCAL PRIMEIRO, SEMPRE. Antes isto era o "senão" do Firestore, e o
  // resultado era que uma escrita pendente (rede ruim, banco ainda não criado)
  // não gravava em lugar nenhum: o `addDoc` não rejeita, fica pendurado, e o
  // caminho local nunca chegava a rodar. A partida do jogador sumia.
  putRecord(LOCAL_KEY, row);
  if (contato) putRecord(CONTACT_KEY, contato);

  if (!CONFIG.useFirestore) return;
  try {
    const alvo = await ensureFirestore();
    if (!alvo) return;
    const { db, fs } = alvo;
    const payload = { ...row };
    if (serverTimestamp) payload.data = fs.serverTimestamp();
    await comPrazo(fs.addDoc(fs.collection(db, 'usuarios'), payload));
    if (contato) {
      const c = { ...contato };
      if (serverTimestamp) c.data = fs.serverTimestamp();
      await comPrazo(fs.addDoc(fs.collection(db, 'contatos'), c));
    }
  } catch (error) {
    // O SDK guarda a escrita e reenvia quando a rede voltar; e a cópia local já
    // está gravada de qualquer forma. Nada a fazer além de registrar.
    console.warn('Firestore demorou ou recusou; o resultado ficou gravado localmente.', error);
  }
}

/**
 * `queryUsuariosRecord(queryBuilder: ...where('venceu', isEqualTo: true)
 *   .orderBy('tempo', descending: true), limit: n)`
 *
 * `tempo` holds the milliseconds *left on the clock*, so descending order puts
 * the fastest players first - the ranking is sorted exactly as in the Dart.
 */
export async function queryUsuariosVencedores({ limit = 15 } = {}) {
  if (CONFIG.useFirestore) {
    try {
      const alvo = await comPrazo(ensureFirestore());
      if (alvo) {
        const { db, fs } = alvo;
        const snapshot = await comPrazo(
          fs.getDocs(
            fs.query(
              fs.collection(db, 'usuarios'),
              fs.where('venceu', '==', true),
              fs.orderBy('tempo', 'desc'),
              fs.limit(limit)
            )
          )
        );
        return snapshot.docs.map((doc) => normalize(doc.data()));
      }
    } catch (error) {
      // Com prazo estourado a tela de fim mostra o ranking local em vez de
      // ficar em branco esperando.
      console.warn('Firestore não respondeu a tempo; mostrando o ranking local.', error);
    }
  }

  return readLocal()
    .filter((row) => row.venceu === true)
    .sort((a, b) => (b.tempo ?? 0) - (a.tempo ?? 0))
    .slice(0, limit)
    .map(normalize);
}

/**
 * UsuariosRecord's getters all default a missing field. `telefone` saiu de
 * proposito: o ranking nao o le mais (ver addUsuario).
 */
function normalize(row) {
  return {
    nome: row.nome ?? '',
    atuacao: row.atuacao ?? '',
    venceu: row.venceu ?? false,
    tempo: row.tempo ?? 0.0,
    equipamento: row.equipamento ?? '',
    data: row.data ?? null,
    invalido: row.invalido ?? 0,
  };
}

/* ------------------------------------------------------------ API calls --- */

/** EnviarMensagemZapCall.call({numero, resultado}) */
export async function enviarMensagemZap({ numero = '', resultado = '' } = {}) {
  const body = {
    phone: numero,
    message:
      '🏁 Você finalizou o *TECNOGAME* 🎮🚀\n\nObrigado por visitar nosso estande!\n\n👉 Fale com um representante ou acesse nosso site:\nhttps://tecnomotor.com.br',
    image: 'https://cambioautomaticodobrasil.com.br/app/uploads/2023/01/tecnomotor.jpg',
    linkUrl: 'https://tecnomotor.com.br',
    title: 'Clique aqui',
    linkDescription: 'Site da Tecnomotor',
  };

  if (!CONFIG.useWhatsApp) {
    // Sem despejar numero nem corpo: o console do totem fica visivel a quem
    // abrir o inspetor, e isto e dado pessoal.
    console.info('[enviarMensagemZap] desligado em config.js (useWhatsApp)');
    return { succeeded: false, skipped: true };
  }

  if (!CONFIG.zapApiUrl || !CONFIG.zapClientToken) {
    console.warn('[enviarMensagemZap] sem credencial em config.js — nada enviado');
    return { succeeded: false, skipped: true };
  }

  try {
    const response = await fetch(CONFIG.zapApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': CONFIG.zapClientToken },
      body: JSON.stringify(body),
    });
    return { succeeded: response.ok, statusCode: response.status, jsonBody: await response.json().catch(() => null) };
  } catch (error) {
    console.warn('enviarMensagemZap failed', error);
    return { succeeded: false };
  }
}

