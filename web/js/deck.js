// O baralho: a lista ordenada de rodadas que o jogo sorteia.
//
// No Dart, uma rodada estava espalhada por três lugares amarrados pelo mesmo
// índice: a questão em `questoesBrasil[i]` (mais as listas en/es), a foto do
// carro numa tabela fixa em `carro_foto.dart`, e o nome do carro em outra
// tabela fixa em `carro_sleecionado.dart`. E o número 10 estava cravado em três
// lugares: nas tabelas, na `numeroAleatorio()` (que gerava 1.0..1.9) e na arte
// da roleta, um PNG com dez fatias de 36°.
//
// Aqui as três coisas viram um `slot`, e o baralho tem N slots. Isso é o que
// permite a área administrativa adicionar e remover rodadas.
//
// FIDELIDADE
// Enquanto ninguém publicar um baralho, `carregarBaralho()` devolve
// `SLOTS_ORIGINAIS` — derivado de questions.js e das tabelas do Dart — e o jogo
// se comporta exatamente como antes. scripts/verify/baralho.mjs falha se essa
// derivação divergir dos valores originais.

import { QUESTIONS } from './questions.js';
import { readJson, writeJson } from './storage.js';

/** Chave do baralho publicado pela área administrativa. */
export const DECK_KEY = 'baralho';

/** Os campos de texto de uma questão, por idioma. */
export const CAMPOS_QUESTAO = [
  'pergunta',
  'respostaUm',
  'respostaDois',
  'respostaTres',
  'respostaQuatro',
  'relatoPreliminar',
  'maisInformacoes',
  'ajudaApoio',
  'ajudaTecnomotorTv',
  'ajudaComunidade',
  'ajudaRepresentanteComercial',
  'ajudaTreinamentoEad',
];

/** Os que não podem ficar vazios — o jogo os mostra na tela. */
export const CAMPOS_OBRIGATORIOS = [
  'pergunta',
  'respostaUm',
  'respostaDois',
  'respostaTres',
  'respostaQuatro',
  'ajudaApoio',
  'ajudaTecnomotorTv',
  'ajudaComunidade',
  'ajudaRepresentanteComercial',
  'ajudaTreinamentoEad',
];

export const IDIOMAS = ['pt', 'en', 'es'];

/** As três flags de capacidade, com o rótulo que o admin mostra. */
export const SCANNERS = [
  { chave: 'raster3S', rotulo: 'Rasther 3S / Box' },
  { chave: 'rasher4', rotulo: 'Rasther 4 / ST' },
  { chave: 'xtool', rotulo: 'Xtool TD90 / TD80' },
];

/**
 * Os veículos do baralho original, na ordem das fatias do PNG da roleta.
 * `nome` é o rótulo que a tela do carro sorteado mostra — vinha da tabela
 * `CARRO_NOMES` do Dart, e não do campo `nome` da questão, que o jogo nunca
 * exibia (e que até difere entre idiomas no primeiro slot).
 * `largura`/`altura`/`fit` vinham da tabela `CARRO_FOTOS`, uma entrada por
 * índice, cada uma com o seu tamanho.
 */
export const VEICULOS_ORIGINAIS = [
  { nome: 'FIAT TORO - 10GF', imagem: 'assets/images/FIAT_TORO.png', largura: 1235.0, altura: 674.0, fit: 'cover' },
  { nome: 'Volvo XC-60', imagem: 'assets/images/Volvo_XC_60.png', largura: 1235.0, altura: 674.0, fit: 'cover' },
  { nome: 'BMW 118i', imagem: 'assets/images/BMW.png', largura: 1235.0, altura: 674.0, fit: 'cover' },
  { nome: 'BYD', imagem: 'assets/images/BYD.png', largura: 1235.0, altura: 674.0, fit: 'contain' },
  { nome: 'Fiat Gran Sienna', imagem: 'assets/images/GRAN_SIENA_(1).png', largura: 1235.0, altura: 674.0, fit: 'cover' },
  { nome: 'VW 24-280', imagem: 'assets/images/VW_-_Constellation.png', largura: 1061.89, altura: 674.0, fit: 'cover' },
  { nome: 'VW Delivery', imagem: 'assets/images/VW_-_Delivery.png', largura: 1235.0, altura: 674.0, fit: 'cover' },
  { nome: 'Valtra', imagem: 'assets/images/VALTRA_Agrcola.png', largura: 1012.17, altura: 781.1, fit: 'cover' },
  { nome: 'Renaut Master', imagem: 'assets/images/RENAULT_MASTER.png', largura: 1235.0, altura: 674.0, fit: 'cover' },
  { nome: 'Mercedes Accelo 917', imagem: 'assets/images/ACCELO__1117.png', largura: 1012.17, altura: 781.1, fit: 'cover' },
];

/** Um slot vazio, para o admin criar uma rodada nova. */
export function slotVazio() {
  const textos = {};
  for (const lang of IDIOMAS) {
    textos[lang] = Object.fromEntries(CAMPOS_QUESTAO.map((c) => [c, '']));
  }
  return {
    veiculo: { nome: '', imagem: '', largura: 1235.0, altura: 674.0, fit: 'cover' },
    scanners: { raster3S: true, rasher4: true, xtool: true },
    gabarito: '1',
    ...textos,
  };
}

/**
 * O baralho embutido, derivado das mesmas fontes que o jogo usava.
 * `gabarito` e as flags de scanner sobem para o slot porque são iguais nos três
 * idiomas nas trinta questões (conferido; scripts/verify/baralho.mjs reafirma).
 */
export const SLOTS_ORIGINAIS = VEICULOS_ORIGINAIS.map((veiculo, i) => {
  const base = QUESTIONS.pt[i];
  const slot = {
    veiculo: { ...veiculo },
    scanners: {
      raster3S: Boolean(base.raster3S),
      rasher4: Boolean(base.rasher4),
      xtool: Boolean(base.xtool),
    },
    gabarito: String(base.gabarito),
  };
  for (const lang of IDIOMAS) {
    const q = QUESTIONS[lang][i] ?? {};
    slot[lang] = Object.fromEntries(CAMPOS_QUESTAO.map((c) => [c, q[c] ?? '']));
  }
  return slot;
});

export const BARALHO_ORIGINAL = { versao: 1, slots: SLOTS_ORIGINAIS };

/* ------------------------------------------------------------- validação -- */

/**
 * Erros que impediriam o jogo de funcionar. Devolve uma lista de mensagens
 * legíveis; vazia significa que pode publicar.
 */
export function validarBaralho(deck) {
  const erros = [];
  if (!deck || !Array.isArray(deck.slots)) return ['baralho sem a lista de slots'];
  if (deck.slots.length === 0) erros.push('o baralho está vazio — o jogo não teria o que sortear');

  deck.slots.forEach((slot, i) => {
    const onde = `rodada ${i + 1}`;
    if (!slot.veiculo?.nome?.trim()) erros.push(`${onde}: o veículo está sem nome`);
    if (!slot.veiculo?.imagem?.trim()) erros.push(`${onde}: o veículo está sem imagem`);
    if (!['1', '2', '3', '4'].includes(String(slot.gabarito))) {
      erros.push(`${onde}: gabarito precisa ser 1, 2, 3 ou 4 (está "${slot.gabarito}")`);
    }
    const flags = SCANNERS.map((s) => Boolean(slot.scanners?.[s.chave]));
    if (!flags.some(Boolean)) {
      erros.push(`${onde}: nenhum equipamento resolve esta rodada — o jogador ficaria travado`);
    }
    for (const lang of IDIOMAS) {
      for (const campo of CAMPOS_OBRIGATORIOS) {
        if (!String(slot[lang]?.[campo] ?? '').trim()) {
          erros.push(`${onde}: ${campo} vazio em ${lang.toUpperCase()}`);
        }
      }
    }
  });

  return erros;
}

/* ---------------------------------------------------------- persistência -- */

/** Normaliza o que veio do armazenamento, para o jogo não quebrar com dado velho. */
function normalizar(deck) {
  if (!deck || !Array.isArray(deck.slots) || deck.slots.length === 0) return null;
  const vazio = slotVazio();
  return {
    versao: deck.versao ?? 1,
    slots: deck.slots.map((s) => {
      const slot = {
        veiculo: { ...vazio.veiculo, ...(s.veiculo ?? {}) },
        scanners: { ...vazio.scanners, ...(s.scanners ?? {}) },
        gabarito: String(s.gabarito ?? '1'),
      };
      for (const lang of IDIOMAS) {
        slot[lang] = { ...vazio[lang], ...(s[lang] ?? {}) };
      }
      return slot;
    }),
  };
}

/**
 * O baralho em vigor. Sem nada publicado, é o original — e aí o jogo roda
 * idêntico ao de antes desta refatoração.
 */
export function carregarBaralho() {
  return normalizar(readJson(DECK_KEY, null)) ?? BARALHO_ORIGINAL;
}

export function publicarBaralho(deck) {
  return writeJson(DECK_KEY, deck);
}

/** Volta ao baralho embutido, descartando o publicado. */
export function restaurarOriginal() {
  return writeJson(DECK_KEY, BARALHO_ORIGINAL);
}

export const temBaralhoPublicado = () => readJson(DECK_KEY, null) != null;

/* ----------------------------------------------------------------- arte --- */

/**
 * A arte da roleta é um PNG com as dez fatias já desenhadas, uma por veículo na
 * ordem do baralho original. Ela continua válida enquanto a lista de veículos
 * for exatamente aquela — mexer só no texto das perguntas não invalida o
 * desenho. Fora disso a roda é gerada (ver roleta.js), porque o PNG mostraria
 * carros que não estão mais em jogo.
 */
export function usaArteOriginal(deck) {
  const slots = deck?.slots ?? [];
  if (slots.length !== VEICULOS_ORIGINAIS.length) return false;
  return slots.every((s, i) => s.veiculo?.imagem === VEICULOS_ORIGINAIS[i].imagem);
}
