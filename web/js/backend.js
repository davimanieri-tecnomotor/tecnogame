// Port of the Firestore layer (lib/backend/backend.dart, usuarios_record.dart)
// and the two HTTP calls in lib/backend/api_requests/api_calls.dart.
//
// The Dart app talks to the Firebase project `projeto-assis-3qcf6v` and to
// z-api.io for the WhatsApp message. Both are kept here with their original
// configuration but are OFF by default, so running this port does not write
// into the live collection or send messages from the production WhatsApp
// instance. Flip the flags in config.js to switch them on; with Firestore off,
// the ranking is stored in this browser instead and every query keeps the same
// semantics (`where venceu == true`, `orderBy tempo desc`, `limit n`).

import { CONFIG } from './config.js';
import { getRecords, putRecord } from './storage.js';

const LOCAL_KEY = 'usuarios';

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

let firestore = null;

async function ensureFirestore() {
  if (!CONFIG.useFirestore) return null;
  if (firestore) return firestore;
  const [{ initializeApp }, fs] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
  ]);
  const app = initializeApp(CONFIG.firebaseOptions);
  firestore = { db: fs.getFirestore(app), fs };
  return firestore;
}

/* ------------------------------------------------------------------ API --- */

/**
 * `await UsuariosRecord.collection.doc().set(createUsuariosRecordData(...))`
 * The `data` field is a server timestamp in the Dart; here it is the client
 * clock, which is only ever used for ordering the ranking.
 */
export async function addUsuario(record, { serverTimestamp = false } = {}) {
  const row = { ...record };
  if (serverTimestamp) row.data = new Date().toISOString();

  if (CONFIG.useFirestore) {
    try {
      const { db, fs } = await ensureFirestore();
      const payload = { ...row };
      if (serverTimestamp) payload.data = fs.serverTimestamp();
      await fs.addDoc(fs.collection(db, 'usuarios'), payload);
      return;
    } catch (error) {
      console.warn('Firestore write failed, falling back to local storage.', error);
    }
  }

  putRecord(LOCAL_KEY, row);
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
      const { db, fs } = await ensureFirestore();
      const snapshot = await fs.getDocs(
        fs.query(
          fs.collection(db, 'usuarios'),
          fs.where('venceu', '==', true),
          fs.orderBy('tempo', 'desc'),
          fs.limit(limit)
        )
      );
      return snapshot.docs.map((doc) => normalize(doc.data()));
    } catch (error) {
      console.warn('Firestore read failed, falling back to local storage.', error);
    }
  }

  return readLocal()
    .filter((row) => row.venceu === true)
    .sort((a, b) => (b.tempo ?? 0) - (a.tempo ?? 0))
    .slice(0, limit)
    .map(normalize);
}

/** `queryUsuariosRecordCount()` */
export async function queryUsuariosRecordCount() {
  if (CONFIG.useFirestore) {
    try {
      const { db, fs } = await ensureFirestore();
      const snapshot = await fs.getCountFromServer(fs.collection(db, 'usuarios'));
      return snapshot.data().count;
    } catch (error) {
      console.warn('Firestore count failed, falling back to local storage.', error);
    }
  }
  return readLocal().length;
}

/** UsuariosRecord's getters all default a missing field. */
function normalize(row) {
  return {
    nome: row.nome ?? '',
    telefone: row.telefone ?? '',
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
    console.info('[enviarMensagemZap] disabled in config.js', { numero, resultado, body });
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

/** EnviarMensagemAgenteCall.call({nome, telefone, venceu}) - defined in the
 *  Dart but never called from a widget; kept for parity. */
export async function enviarMensagemAgente({ nome = '', telefone = '', venceu = null } = {}) {
  if (!CONFIG.useAgentWebhook) {
    console.info('[enviarMensagemAgente] disabled in config.js', { nome, telefone, venceu });
    return { succeeded: false, skipped: true };
  }
  try {
    const response = await fetch(CONFIG.agentWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, telefone, venceu }),
    });
    return { succeeded: response.ok, statusCode: response.status };
  } catch (error) {
    console.warn('enviarMensagemAgente failed', error);
    return { succeeded: false };
  }
}
