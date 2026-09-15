// Todo acesso a localStorage do jogo passa por aqui.
//
// Três motivos:
//
// 1. Namespace. As chaves vinham do FlutterFlow (`ff_questoesBrasil`,
//    `__locale_key__`) e num mesmo domínio colidiriam com um build Flutter do
//    mesmo jogo — que gravava naquelas chaves um formato diferente (lista de
//    strings serializadas, não JSON de objetos). Agora tudo vive sob `tecgame:`.
//
// 2. Tolerância a falha. Em modo privado, com cookies de site bloqueados, e em
//    alguns navegadores por `file://`, o simples `window.localStorage` já
//    *lança*. Cada acesso aqui é protegido, então o jogo roda sem persistir em
//    vez de morrer na primeira tela.
//
// 3. Retenção. A política de privacidade do jogo promete apagar os dados depois
//    de um ano. `putRecord` estampa a data e `getRecords` descarta o que passou
//    do prazo, então a promessa vale também no armazenamento local — não só no
//    Firestore.

const PREFIX = 'tecgame:';

/** Chaves antigas, lidas uma vez para ninguém perder o que já tinha. */
const LEGACY = {
  'usuarios': 'tecgame_usuarios',
  'locale': '__locale_key__',
  'questoes.pt': 'ff_questoesBrasil',
  'questoes.en': 'ff_questoesEnglish',
  'questoes.es': 'ff_questoesSpanish',
};

/** Um ano, o prazo que a política de privacidade promete. */
export const RETENCAO_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * `localStorage` quando dá, `null` quando o navegador recusa. Não faz cache do
 * resultado porque a permissão pode mudar durante a sessão.
 */
function store() {
  try {
    const s = window.localStorage;
    // Alguns navegadores só falham no primeiro uso de verdade, não no getter.
    const probe = `${PREFIX}__probe__`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch (_) {
    return null;
  }
}

/** Texto cru de uma chave, caindo para a chave legada do FlutterFlow. */
export function readRaw(name) {
  const s = store();
  if (!s) return null;
  try {
    const atual = s.getItem(PREFIX + name);
    if (atual != null) return atual;
    const antiga = LEGACY[name];
    return antiga ? s.getItem(antiga) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Por que a ultima falha fica guardada: quem grava um baralho com imagens
 * enviadas do computador precisa saber a diferenca entre "o navegador recusou
 * o armazenamento" e "nao cabe mais" -- sao dois problemas com solucoes
 * opostas, e um `false` seco nao distingue.
 *
 * @type {null | 'recusado' | 'cheio' | 'erro'}
 */
let ultimaFalha = null;

/** Motivo da ultima escrita que falhou, ou null se a ultima deu certo. */
export const motivoDaFalha = () => ultimaFalha;

export function writeRaw(name, value) {
  const s = store();
  if (!s) {
    ultimaFalha = 'recusado';
    return false;
  }
  try {
    s.setItem(PREFIX + name, value);
    ultimaFalha = null;
    return true;
  } catch (e) {
    // Cota estourada ou escrita negada: seguir sem persistir.
    const cheio =
      e?.name === 'QuotaExceededError' ||
      e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e?.code === 22;
    ultimaFalha = cheio ? 'cheio' : 'erro';
    return false;
  }
}

/**
 * Apaga uma chave — a nossa e a antiga do FlutterFlow, se houver.
 *
 * Existe para o "resetar todos os dados" da área administrativa: sobrescrever
 * com `null` deixaria a string "null" guardada, e `temBaralhoPublicado()`
 * continuaria dizendo que há baralho publicado.
 */
export function removerChave(name) {
  const s = store();
  if (!s) return false;
  try {
    s.removeItem(PREFIX + name);
    if (LEGACY[name]) s.removeItem(LEGACY[name]);
    return true;
  } catch (_) {
    return false;
  }
}

export function readJson(name, fallback) {
  const raw = readRaw(name);
  if (raw == null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch (error) {
    console.warn(`[storage] ${name} ilegível, usando o padrão.`, error);
    return fallback;
  }
}

export function writeJson(name, value) {
  try {
    return writeRaw(name, JSON.stringify(value));
  } catch (_) {
    return false;
  }
}

/**
 * Registros com prazo de validade. `agora` entra por parâmetro para o teste
 * poder envelhecer a base sem mexer no relógio.
 */
export function getRecords(name, agora = Date.now()) {
  const list = readJson(name, []);
  if (!Array.isArray(list)) return [];
  const corte = agora - RETENCAO_MS;
  const vivos = list.filter((r) => {
    const t = r && r.data ? Date.parse(r.data) : NaN;
    return Number.isNaN(t) ? true : t >= corte;
  });
  // Só reescreve quando algo realmente expirou, para não gravar a cada leitura.
  if (vivos.length !== list.length) writeJson(name, vivos);
  return vivos;
}

export function putRecord(name, record, agora = Date.now()) {
  const list = getRecords(name, agora);
  list.push(record);
  return writeJson(name, list);
}
