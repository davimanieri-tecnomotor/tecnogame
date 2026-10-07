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
// sem salvar: tudo isso deixa arquivo que nenhum baralho usa. Três caminhos o
// tiram do Storage, do mais imediato ao mais cauteloso:
//
//   - a foto que ESTA aba acabou de enviar sai na hora em que deixa de ser
//     usada — trocada por outra, veículo removido, alterações descartadas
//     (`apagarRecemEnviadasSemUso`). Ninguém mais pode citá-la: ela nunca foi
//     publicada, e o nome é o conteúdo, então só existia por causa deste envio;
//   - a foto que o baralho publicado citava e o Salvar acabou de trocar sai
//     logo depois de a troca chegar à nuvem (`semCarencia` em
//     `limparFotosSemUso`). Antes disso não pode: o totem que ainda joga com o
//     baralho anterior a mostraria quebrada, e "Descartar" voltaria para ela;
//   - o resto sai pela carência: ao salvar na nuvem, o painel lista
//     `veiculos/` e apaga o que o baralho recém-publicado não cita E não foi
//     tocado há mais de `CARENCIA_DIAS`. Ela cobre o rascunho de outro
//     notebook e a aba fechada sem salvar, que nenhum dos dois de cima alcança.
//     Conta do `updated` do arquivo, que o reaproveitamento renova — enviar de
//     novo uma foto órfã antiga a tira da fila.
//
// Se mesmo assim uma foto citada sumir (um rascunho parado além da carência,
// ou a foto que outro notebook trocou e apagou), `fotosQueSumiram` pega antes
// de salvar: o painel recusa publicar endereço que não abre e diz qual veículo
// precisa de foto nova.

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
 * @param {object} [opcoes]
 * @param {Iterable<string>} [opcoes.semCarencia] fora de uso, estes saem já,
 *   sem esperar a carência: são as fotos que o Salvar acabou de trocar. Em uso,
 *   ficam do mesmo jeito — estar nesta lista nunca vence `emUso`.
 * @returns {string[]} os caminhos a apagar
 */
export function escolherOrfas(
  arquivos,
  emUso,
  { agora = Date.now(), carenciaMs = CARENCIA_DIAS * DIA_MS, semCarencia = [] } = {}
) {
  const jaPodem = new Set(semCarencia);
  return arquivos
    .filter(({ caminho, atualizado }) => {
      if (typeof caminho !== 'string' || !caminho.startsWith(`${PASTA}/`)) return false;
      if (emUso.has(caminho)) return false;
      if (jaPodem.has(caminho)) return true;
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

/**
 * As fotos que esta aba CRIOU no Storage e que a nuvem ainda não publicou.
 *
 * São as únicas que dá para apagar na hora em que saem de uso: nenhum baralho
 * publicado as cita, e nenhum outro notebook as enviou (se tivesse, o arquivo
 * já existiria e o envio seria reaproveitamento, que não entra aqui).
 */
const recemEnviadas = new Set();

/**
 * Os bytes de cada foto enviada nesta aba, como `data:` URL, pelo caminho no
 * Storage. É o que deixa "Baixar foto" baixar a foto recém-enviada sem buscá-la
 * de volta no Storage — que, sem CORS no bucket, o navegador nem deixa ler.
 */
const bytesDaSessao = new Map();

/** Há foto desta aba esperando para ser apagada quando sair de uso? */
export const haRecemEnviadas = () => recemEnviadas.size > 0;

/**
 * O Salvar levou estas fotos para a nuvem: daqui em diante elas pertencem ao
 * baralho publicado, e só a limpeza do Salvar as apaga.
 */
export function esquecerRecemEnviadas(caminhos) {
  for (const c of caminhos) recemEnviadas.delete(c);
}

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
    const r = await subir(s, bytes, tipo, aoProgredir);
    if (r.ok) {
      bytesDaSessao.set(r.caminho, dataUrl);
      if (!r.reaproveitada) recemEnviadas.add(r.caminho);
    }
    return r;
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
 * @param {object} [opcoes]
 * @param {Iterable<string>} [opcoes.semCarencia] as fotos que este Salvar
 *   trocou: saem já, sem esperar a carência — ver `escolherOrfas`
 * @param {Function} [opcoes.tambemEmUso] devolve, NA HORA de escolher, mais
 *   caminhos a poupar: o painel passa o que está aberto no editor, que pode ter
 *   voltado a citar uma foto enquanto a lista do Storage descia
 * @returns {Promise<{ok: boolean, apagadas: number, restantes?: number, motivo?: string}>}
 */
export async function limparFotosSemUso(deck, { agora = Date.now(), semCarencia = [], tambemEmUso = null } = {}) {
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
    const emUso = new Set([...fotosDoBaralho(deck), ...(tambemEmUso?.() ?? [])]);
    const alvo = escolherOrfas(arquivos, emUso, { agora, semCarencia });
    const feitos = await Promise.allSettled(alvo.map((c) => st.deleteObject(st.ref(storage, c))));
    const apagadas = feitos.filter((f) => f.status === 'fulfilled').length;
    return { ok: true, apagadas, restantes: arquivos.length - apagadas };
  } catch (erro) {
    return { ok: false, apagadas: 0, motivo: traduzir(erro) };
  }
}

/** Apagar uma foto não pode segurar a tela: sem rede, desiste e a carência cuida. */
const PRAZO_PARA_APAGAR_MS = 8000;

/**
 * Apaga do Storage as fotos que esta aba enviou e que nada mais cita — a foto
 * trocada por outra antes de salvar, a do veículo removido, a das alterações
 * descartadas.
 *
 * Só as recém-enviadas (ver `recemEnviadas`): uma foto que o baralho publicado
 * cita, ou que outro notebook enviou, espera o Salvar ou a carência.
 *
 * Melhor esforço, como a limpeza: a que não sair agora (sem rede, sem login)
 * fica para a carência, e não é tentada de novo a cada tecla.
 *
 * @param {Set<string>} emUso o que o editor e o baralho publicado citam
 * @returns {Promise<{apagadas: number}>}
 */
export async function apagarRecemEnviadasSemUso(emUso) {
  const alvo = [...recemEnviadas].filter((c) => !emUso.has(c));
  if (!alvo.length) return { apagadas: 0 };
  // Sai do conjunto ANTES de esperar a rede: duas edições seguidas não mandam
  // apagar o mesmo arquivo duas vezes.
  for (const c of alvo) recemEnviadas.delete(c);

  try {
    const s = await comPrazo(firebaseStorage(), PRAZO_PARA_APAGAR_MS);
    if (!s) return { apagadas: 0 };
    const { storage, st } = s;
    const feitos = await Promise.allSettled(
      alvo.map((c) =>
        comPrazo(st.deleteObject(st.ref(storage, c)), PRAZO_PARA_APAGAR_MS).catch((erro) => {
          // Já não estava lá: o que se queria aconteceu.
          if (!naoExiste(erro)) throw erro;
        })
      )
    );
    for (const [k, f] of feitos.entries()) {
      if (f.status === 'fulfilled') bytesDaSessao.delete(alvo[k]);
      else console.warn(`a foto ${alvo[k]} ficou no Storage (a carência apaga depois):`, f.reason);
    }
    return { apagadas: feitos.filter((f) => f.status === 'fulfilled').length };
  } catch (erro) {
    console.warn('as fotos recém-enviadas sem uso ficaram no Storage (a carência apaga depois):', erro);
    return { apagadas: 0 };
  }
}

/* ------------------------------------------------------------ baixar -- */

/** Para o fallback de abrir a foto numa aba: o navegador só deixa abrir janela logo depois do clique. */
const PRAZO_PARA_BAIXAR_MS = 4000;

const EXTENSAO_DO_CAMINHO = /\.(webp|png|jpg|gif)$/;

/** "FIAT TORO / 10GF" -> "FIAT TORO 10GF": sem o que o Windows recusa em nome de arquivo. */
const nomeDeArquivo = (nome) => String(nome ?? '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'foto';

function salvarComo(endereco, nome) {
  const link = document.createElement('a');
  link.href = endereco;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Baixa os bytes de um `data:` URL como arquivo, com a extensão do tipo dele. */
function salvarDataUrl(dataUrl, nome) {
  const { tipo, bytes } = bytesDeDataUrl(dataUrl);
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
  salvarComo(url, `${nome}.${EXTENSAO[tipo] ?? 'png'}`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Baixa para o computador a foto de um veículo — a enviada, que só existe no
 * Storage ou dentro do baralho.
 *
 * Três caminhos, do melhor ao pior:
 *   - a foto está dentro do baralho, ou foi enviada nesta aba: os bytes estão
 *     aqui, e o arquivo sai na hora;
 *   - senão, busca no Storage. Isso só funciona com CORS liberado no bucket
 *     (firebase/cors.json): o `<img>` mostra a foto sem CORS, mas ler os bytes
 *     de outra origem pelo JavaScript precisa dele;
 *   - sem CORS, abre a foto numa aba nova, de onde o "Salvar imagem como…" do
 *     navegador a baixa. O `download` de um link de outra origem é ignorado
 *     pelo navegador, então não há como forçar o arquivo daqui.
 *
 * @param {string} src o `veiculo.imagem`
 * @param {string} nome o nome do veículo, que vira o nome do arquivo
 * @returns {Promise<'baixou'|'abriu'|'falhou'>}
 */
export async function baixarFoto(src, nome) {
  if (typeof src !== 'string' || !src) return 'falhou';
  const arquivo = nomeDeArquivo(nome);
  const caminho = caminhoNoStorage(src);
  try {
    const local = src.startsWith('data:') ? src : caminho ? bytesDaSessao.get(caminho) : null;
    if (local) {
      salvarDataUrl(local, arquivo);
      return 'baixou';
    }
  } catch (_) {
    /* data URL que não é base64: tenta pelo endereço, como qualquer outro */
  }

  try {
    const resposta = await comPrazo(fetch(src, { mode: 'cors' }), PRAZO_PARA_BAIXAR_MS);
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const blob = await resposta.blob();
    const ext = EXTENSAO[blob.type] ?? caminho?.match(EXTENSAO_DO_CAMINHO)?.[1] ?? 'png';
    const url = URL.createObjectURL(blob);
    salvarComo(url, `${arquivo}.${ext}`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'baixou';
  } catch (erro) {
    console.info('a foto não veio por fetch (sem CORS no bucket?) — abrindo numa aba nova:', erro?.message ?? erro);
    window.open(src, '_blank', 'noopener');
    return 'abriu';
  }
}
