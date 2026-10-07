// As fotos de veículo no Cloud Storage do Firebase.
//
// O PROBLEMA QUE ISTO RESOLVE
// Foto enviada do computador vivia DENTRO do baralho, como `data:` URL (~88 KB
// cada, já reduzida). O baralho inteiro é um documento só no Firestore, com
// teto de 1 MiB (ver `TETO_KB` em nuvem.js): umas dez fotos e ele não subia
// mais. Agora, com login, a foto vai para o Storage e o baralho guarda só o
// endereço dela. Sem login (a senha local, o jogo aberto do disco) o caminho
// antigo continua valendo — a foto fica dentro do baralho.
//
// O NOME É O CONTEÚDO. Cada foto vira `veiculos/<sha-256>.<ext>`, e três
// coisas se apoiam nisso:
//   - a mesma foto enviada duas vezes é um arquivo só;
//   - um arquivo NUNCA é sobrescrito. Sobrescrever no Storage gera token novo,
//     e o endereço que o baralho publicado guarda deixaria de abrir em todo
//     totem. Se o arquivo já existe, é reaproveitado — e as regras
//     (firebase/storage.rules) recusam a sobrescrita mesmo que alguém tente;
//   - imutável, ele sai com cache de um ano: o totem que já viu a foto
//     continua mostrando quando a internet da feira cai.
//
// A LIMPEZA. Trocar a foto de um veículo, apagar um veículo, enviar e desistir
// sem salvar: tudo isso deixa arquivo que nenhum baralho usa. Ao salvar na
// nuvem, o painel lista `veiculos/` e apaga o que o baralho recém-publicado não
// cita E não foi tocado há mais de `CARENCIA_DIAS`. A carência existe porque o
// baralho publicado não é o único lugar que cita uma foto:
//   - outro notebook pode estar editando, com uma foto enviada e não salva;
//   - um totem pode estar no meio de uma partida com o baralho anterior.
// Ela conta do `updated` do arquivo, que o reaproveitamento renova — enviar de
// novo uma foto órfã antiga a tira da fila.
//
// Se mesmo assim uma foto citada sumir (um rascunho parado além da carência),
// `fotosQueSumiram` pega antes de salvar: o painel recusa publicar endereço
// que não abre e diz qual veículo precisa de foto nova.

import { CONFIG } from '../config.js';
import { comPrazo } from '../backend.js';
import { firebaseStorage, motivoSemFirebase } from '../firebase.js';

/** A única pasta que este módulo escreve — e a única que a limpeza apaga. */
export const PASTA = 'veiculos';

/**
 * Quanto tempo uma foto sem uso espera antes de ser apagada.
 *
 * Sete dias cobrem o rascunho aberto noutro notebook e o totem que ficou uns
 * dias sem internet. Custa pouco: sete dias de órfãs, a ~90 KB por foto, são
 * alguns MB.
 */
export const CARENCIA_DIAS = 7;
const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * O maior arquivo que vai para o Storage. Uma foto reduzida a 1280px em WebP
 * fica em centenas de KB; o teto folgado é para o navegador que só sabe gravar
 * PNG (ver `reduzirImagem` em ui.js). O mesmo número está em storage.rules.
 */
export const TETO_BYTES = 5 * 1024 * 1024;

/** Os tipos que storage.rules aceita, e a extensão de cada um. */
const EXTENSAO = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif' };

/** Imutável de verdade: o nome muda quando o conteúdo muda. */
const CACHE = 'public, max-age=31536000, immutable';

/* ------------------------------------------------------------ as puras -- */

/**
 * O caminho no Storage de uma foto deste projeto, a partir do endereço que o
 * baralho guarda — ou `null` para qualquer outra coisa (assets/images, `data:`,
 * foto de outro bucket).
 *
 * É o que decide o que a limpeza considera "em uso", então erra para o lado
 * estreito: só reconhece endereço de download do bucket de `config.js` dentro
 * de `veiculos/`, que é também o único lugar onde ela apaga.
 *
 * @param {string} endereco o `veiculo.imagem`
 * @param {string} [bucket] o bucket do projeto; o padrão é o de config.js
 */
export function caminhoNoStorage(endereco, bucket = CONFIG.firebaseOptions.storageBucket) {
  if (typeof endereco !== 'string' || !endereco.startsWith('https://')) return null;
  let u;
  try {
    u = new URL(endereco);
  } catch (_) {
    return null;
  }
  if (u.hostname !== 'firebasestorage.googleapis.com') return null;
  // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<caminho codificado>?alt=media&token=...
  const m = u.pathname.match(/^\/v0\/b\/([^/]+)\/o\/([^/]+)$/);
  if (!m) return null;
  let caminho;
  try {
    if (decodeURIComponent(m[1]) !== bucket) return null;
    caminho = decodeURIComponent(m[2]);
  } catch (_) {
    return null;
  }
  return caminho.startsWith(`${PASTA}/`) && !caminho.slice(PASTA.length + 1).includes('/') ? caminho : null;
}

/** Os caminhos do Storage que o baralho cita. */
export function fotosDoBaralho(deck) {
  const caminhos = new Set();
  for (const slot of deck?.slots ?? []) {
    const c = caminhoNoStorage(slot?.veiculo?.imagem);
    if (c) caminhos.add(c);
  }
  return caminhos;
}

/**
 * Quais arquivos a limpeza apaga: fora de uso e parados há mais que a
 * carência. Pura, para dar para afirmar sem Firebase.
 *
 * @param {Array<{caminho: string, atualizado: string|number|Date|null}>} arquivos
 * @param {Set<string>} emUso os caminhos que o baralho cita (`fotosDoBaralho`)
 * @returns {string[]} os caminhos a apagar
 */
export function escolherOrfas(arquivos, emUso, { agora = Date.now(), carenciaMs = CARENCIA_DIAS * DIA_MS } = {}) {
  return arquivos
    .filter(({ caminho, atualizado }) => {
      if (typeof caminho !== 'string' || !caminho.startsWith(`${PASTA}/`)) return false;
      if (emUso.has(caminho)) return false;
      // Sem data não há como saber a idade, e o arquivo fica. Errar para o
      // lado de guardar custa uns KB; errar para o outro custa a foto de um
      // veículo sumindo do totem.
      const t = atualizado == null ? NaN : new Date(atualizado).getTime();
      return Number.isFinite(t) && agora - t > carenciaMs;
    })
    .map((a) => a.caminho);
}

/**
 * Os bytes e o tipo de um `data:` URL em base64 — o formato que `reduzirImagem`
 * (ui.js) devolve, venha de canvas ou de FileReader.
 *
 * @returns {{tipo: string, bytes: Uint8Array}}
 */
export function bytesDeDataUrl(dataUrl) {
  const m = /^data:([^;,]+)(?:;[^;,]+)*;base64,(.*)$/s.exec(typeof dataUrl === 'string' ? dataUrl : '');
  if (!m) throw new Error('a imagem não veio num formato que dê para enviar.');
  const binario = atob(m[2]);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return { tipo: m[1].toLowerCase(), bytes };
}

/**
 * `veiculos/<64 hex>.<ext>`, ou `null` para tipo que o Storage não aceita.
 * O formato é o que storage.rules confere no nome do arquivo.
 */
export function nomeDaFoto(hex, tipo) {
  const ext = EXTENSAO[tipo];
  return ext && /^[0-9a-f]{64}$/.test(hex) ? `${PASTA}/${hex}.${ext}` : null;
}

const paraHex = (buffer) => Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * O SHA-256 dos bytes. `crypto.subtle` só existe em contexto seguro (https,
 * localhost): o GitHub Pages é https, mas um painel aberto por IP da rede
 * local em http não é — e aí o nome é sorteado no mesmo formato. Perde-se só
 * a deduplicação; nada sobrescreve nada do mesmo jeito.
 */
async function impressaoDigital(bytes) {
  if (globalThis.crypto?.subtle) return paraHex(await crypto.subtle.digest('SHA-256', bytes));
  return paraHex(crypto.getRandomValues(new Uint8Array(32)));
}

/* ------------------------------------------------------- o Storage, de fato -- */

/** Quantos envios estão no ar agora — o Salvar espera por eles. */
let emAndamento = 0;

/**
 * Há foto subindo? Salvar no meio do envio publicaria o veículo com a foto
 * ANTIGA, e a nova chegaria depois só neste navegador.
 */
export const enviosEmAndamento = () => emAndamento;

const naoExiste = (erro) => String(erro?.code ?? '').includes('object-not-found');

/** O erro do SDK numa frase que diz ao operador o que fazer. */
function traduzir(erro) {
  const c = String(erro?.code ?? '');
  if (c.includes('unauthorized') || c.includes('unauthenticated')) {
    return 'o Storage recusou: entre com a conta do Firebase — e, se já estiver conectado, confira se o deploy das regras do Storage foi feito (firebase/README.md).';
  }
  if (c.includes('bucket-not-found') || c.includes('project-not-found')) {
    return 'o Storage não está ativado no projeto do Firebase (firebase/README.md).';
  }
  if (c.includes('retry-limit-exceeded') || erro?.message === 'prazo') {
    return 'o Storage não respondeu a tempo — sem internet?';
  }
  if (c.includes('quota-exceeded')) return 'o Storage recusou por cota — confira o plano do projeto no Console.';
  // Bucket que não existe (o Storage nunca ativado no Console) chega no envio
  // como `storage/unknown` e "An unknown error occurred": o SDK só traduz
  // 401, 402 e 403, e o 404 fica na resposta crua do servidor.
  const resposta = String(erro?.serverResponse ?? erro?.message ?? '');
  if (erro?.status === 404 || /"code":\s*404/.test(resposta)) {
    return 'o bucket do Storage não existe (404): ative o Storage no Console do Firebase (firebase/README.md).';
  }
  if (c.includes('unknown')) {
    return `o Storage respondeu com um erro sem explicação${erro?.status ? ` (HTTP ${erro.status})` : ''} — confira se ele está ativado no Console e se as regras foram publicadas (firebase/README.md).`;
  }
  return erro?.message ?? String(erro);
}

/**
 * Manda a foto para o Storage e devolve o endereço que o baralho vai guardar.
 *
 * Se o arquivo já existe (a mesma foto, enviada antes), não envia de novo:
 * sobrescrever trocaria o token e quebraria o endereço já publicado. Só
 * renova o `updated`, que é de onde a carência da limpeza conta.
 *
 * Exige a conta do Firebase: quem chama confere antes (`nuvemDeImagens` no
 * editor), e a regra do Storage confere de novo.
 *
 * @param {string} dataUrl o que `reduzirImagem` devolveu
 * @param {object} [opcoes]
 * @param {Function} [opcoes.aoProgredir] recebe a fração enviada, de 0 a 1, a
 *   cada pedaço que sobe — é o que a barra do editor desenha
 * @returns {Promise<{ok: true, url: string, caminho: string, reaproveitada: boolean} | {ok: false, motivo: string}>}
 */
export async function enviarFoto(dataUrl, { aoProgredir = null } = {}) {
  let tipo;
  let bytes;
  try {
    ({ tipo, bytes } = bytesDeDataUrl(dataUrl));
  } catch (erro) {
    return { ok: false, motivo: erro.message };
  }
  if (!EXTENSAO[tipo]) return { ok: false, motivo: `o Storage só recebe WebP, PNG, JPEG ou GIF, e esta veio como ${tipo}.` };
  if (bytes.length > TETO_BYTES) {
    return { ok: false, motivo: `a foto ficou com ${Math.round(bytes.length / 1024)} KB, e o Storage aceita até ${TETO_BYTES / 1024 / 1024} MB.` };
  }

  emAndamento++;
  try {
    const s = await firebaseStorage();
    if (!s) return { ok: false, motivo: motivoSemFirebase() ?? 'não deu para falar com o Firebase.' };
    return await subir(s, bytes, tipo, aoProgredir);
  } finally {
    emAndamento--;
  }
}

async function subir({ storage, st }, bytes, tipo, aoProgredir) {
  const caminho = nomeDaFoto(await impressaoDigital(bytes), tipo);
  const alvo = st.ref(storage, caminho);

  try {
    let reaproveitada = true;
    try {
      await st.getMetadata(alvo);
    } catch (erro) {
      if (!naoExiste(erro)) throw erro;
      reaproveitada = false;
    }
    if (reaproveitada) {
      await st.updateMetadata(alvo, { customMetadata: { tocadaEm: new Date().toISOString() } });
    } else {
      // O envio retomável, e não o `uploadBytes` simples, porque só ele conta
      // os bytes enquanto sobem: sem progresso na tela, o operador olhava a
      // foto antiga parada e achava que nada estava acontecendo.
      const tarefa = st.uploadBytesResumable(alvo, bytes, { contentType: tipo, cacheControl: CACHE });
      tarefa.on('state_changed', (p) => aoProgredir?.(p.totalBytes ? p.bytesTransferred / p.totalBytes : 0));
      await tarefa;
    }
    aoProgredir?.(1);
    return { ok: true, url: await st.getDownloadURL(alvo), caminho, reaproveitada };
  } catch (erro) {
    return { ok: false, motivo: traduzir(erro) };
  }
}

/** Sem rede, o SDK tentaria por `maxOperationRetryTime`; o Salvar não espera tanto. */
const PRAZO_DA_CONFERENCIA_MS = 6000;

/**
 * Os veículos cuja foto no Storage não existe mais — índices de `deck.slots`.
 *
 * `conferiu: false` quer dizer "não deu para saber" (sem rede, sem Storage):
 * quem chama segue em frente, porque recusar salvar por falta de internet
 * seria pior que o risco que isto cobre.
 *
 * @returns {Promise<{conferiu: boolean, sumidas: number[], motivo?: string}>}
 */
export async function fotosQueSumiram(deck) {
  const porCaminho = new Map();
  (deck?.slots ?? []).forEach((slot, i) => {
    const c = caminhoNoStorage(slot?.veiculo?.imagem);
    if (c) porCaminho.set(c, [...(porCaminho.get(c) ?? []), i]);
  });
  if (!porCaminho.size) return { conferiu: true, sumidas: [] };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { conferiu: false, sumidas: [] };

  try {
    const s = await comPrazo(firebaseStorage(), PRAZO_DA_CONFERENCIA_MS);
    if (!s) return { conferiu: false, sumidas: [] };
    const { storage, st } = s;
    const resultado = await comPrazo(
      Promise.all(
        [...porCaminho].map(([caminho, indices]) =>
          st.getMetadata(st.ref(storage, caminho)).then(
            () => [],
            (erro) => {
              if (naoExiste(erro)) return indices;
              throw erro;
            }
          )
        )
      ),
      PRAZO_DA_CONFERENCIA_MS
    );
    return { conferiu: true, sumidas: resultado.flat().sort((a, b) => a - b) };
  } catch (erro) {
    return { conferiu: false, sumidas: [], motivo: traduzir(erro) };
  }
}

/**
 * Apaga de `veiculos/` as fotos que o baralho não cita e que ninguém tocou há
 * mais de `CARENCIA_DIAS`. O painel chama depois de salvar na nuvem, com o
 * baralho que acabou de subir.
 *
 * Melhor esforço: falhar aqui não desfaz nada do que foi salvo, e a próxima
 * gravação tenta de novo.
 *
 * @returns {Promise<{ok: boolean, apagadas: number, restantes?: number, motivo?: string}>}
 */
export async function limparFotosSemUso(deck, { agora = Date.now() } = {}) {
  // Um baralho vazio citaria nada, e tudo viraria órfão. O validador não deixa
  // salvar baralho vazio, mas esta função apaga coisa: confere de novo.
  if (!deck?.slots?.length) return { ok: false, apagadas: 0, motivo: 'baralho vazio — limpeza não roda.' };

  const s = await firebaseStorage();
  if (!s) return { ok: false, apagadas: 0, motivo: motivoSemFirebase() ?? 'não deu para falar com o Firebase.' };
  const { storage, st } = s;

  try {
    const { items } = await st.listAll(st.ref(storage, PASTA));
    const arquivos = await Promise.all(
      items.map((ref) =>
        st.getMetadata(ref).then(
          (m) => ({ caminho: ref.fullPath, atualizado: m.updated ?? m.timeCreated ?? null }),
          () => ({ caminho: ref.fullPath, atualizado: null })
        )
      )
    );
    const alvo = escolherOrfas(arquivos, fotosDoBaralho(deck), { agora });
    const feitos = await Promise.allSettled(alvo.map((c) => st.deleteObject(st.ref(storage, c))));
    const apagadas = feitos.filter((f) => f.status === 'fulfilled').length;
    return { ok: true, apagadas, restantes: arquivos.length - apagadas };
  } catch (erro) {
    return { ok: false, apagadas: 0, motivo: traduzir(erro) };
  }
}
