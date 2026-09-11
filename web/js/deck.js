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
// VERSÃO 2 — UM VEÍCULO, VÁRIAS PERGUNTAS
// Até a v1 um slot tinha exatamente uma pergunta grudada nele: caiu no VW
// Delivery, era sempre aquela. Numa feira, o segundo jogador da fila já sabia a
// resposta. Agora o slot tem um BANCO: `perguntas: [...]`, cada uma com o seu
// gabarito, os seus equipamentos e os seus três idiomas, e uma marca de `ativa`.
// Quando a roleta para num veículo, o jogo sorteia entre as ativas daquele
// veículo.
//
// O que subiu e o que desceu: `veiculo` fica no slot (é a fatia da roleta e a
// foto do carro); `gabarito`, `scanners` e os textos descem para a pergunta,
// porque duas perguntas do mesmo carro podem ter resposta certa diferente e
// pedir equipamentos diferentes.
//
// `normalizar()` converte v1 em v2 na leitura, então baralho publicado antes
// desta mudança continua abrindo.
//
// FIDELIDADE
// Enquanto ninguém publicar um baralho, `carregarBaralho()` devolve
// `SLOTS_ORIGINAIS` — derivado de questions.js e das tabelas do Dart — e o jogo
// se comporta exatamente como antes, com uma pergunta por veículo.
// scripts/verify/baralho.mjs falha se essa derivação divergir dos originais.

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

/**
 * Identificador de pergunta. Serve para a lista do admin não se perder ao
 * reordenar e para o sorteio poder ser conferido; não vai para a tela.
 */
let contadorDeId = 0;
export const novoIdDePergunta = () =>
  `p${Date.now().toString(36)}${(contadorDeId++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Uma pergunta vazia, para o admin acrescentar ao banco de um veículo. */
export function perguntaVazia() {
  const textos = {};
  for (const lang of IDIOMAS) {
    textos[lang] = Object.fromEntries(CAMPOS_QUESTAO.map((c) => [c, '']));
  }
  return {
    id: novoIdDePergunta(),
    ativa: true,
    scanners: { raster3S: true, rasher4: true, xtool: true },
    gabarito: '1',
    ...textos,
  };
}

/** Um slot vazio, para o admin criar uma rodada nova. */
export function slotVazio() {
  return {
    veiculo: { nome: '', imagem: '', largura: 1235.0, altura: 674.0, fit: 'cover' },
    perguntas: [perguntaVazia()],
  };
}

/** As perguntas que podem cair numa partida. */
export const perguntasAtivas = (slot) => (slot?.perguntas ?? []).filter((p) => p.ativa !== false);

/**
 * O baralho embutido, derivado das mesmas fontes que o jogo usava.
 * `gabarito` e as flags de scanner sobem para o slot porque são iguais nos três
 * idiomas nas trinta questões (conferido; scripts/verify/baralho.mjs reafirma).
 */
export const SLOTS_ORIGINAIS = VEICULOS_ORIGINAIS.map((veiculo, i) => {
  const base = QUESTIONS.pt[i];
  const pergunta = {
    // Id fixo, e não sorteado: o baralho embutido é comparado byte a byte com
    // questions.js pelo verify/baralho.mjs, e um id aleatório o tornaria
    // diferente a cada carga.
    id: `orig-${i}`,
    ativa: true,
    scanners: {
      raster3S: Boolean(base.raster3S),
      rasher4: Boolean(base.rasher4),
      xtool: Boolean(base.xtool),
    },
    gabarito: String(base.gabarito),
  };
  for (const lang of IDIOMAS) {
    const q = QUESTIONS[lang][i] ?? {};
    pergunta[lang] = Object.fromEntries(CAMPOS_QUESTAO.map((c) => [c, q[c] ?? '']));
  }
  return { veiculo: { ...veiculo }, perguntas: [pergunta] };
});

export const BARALHO_ORIGINAL = { versao: 2, slots: SLOTS_ORIGINAIS };

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

    const perguntas = slot.perguntas ?? [];
    if (perguntas.length === 0) {
      erros.push(`${onde}: o veículo não tem nenhuma pergunta`);
    } else if (perguntasAtivas(slot).length === 0) {
      erros.push(`${onde}: todas as perguntas estão desligadas — a roleta cairia num veículo sem jogo`);
    }

    perguntas.forEach((pergunta, j) => {
      // A pergunta desligada não entra em jogo, então um campo vazio nela não
      // trava ninguém: ela fica no banco como rascunho até ser ligada.
      if (pergunta.ativa === false) return;
      // Com uma pergunta só, dizer "pergunta 1" é ruído; com banco, é o que
      // localiza o problema.
      const ondeP = perguntas.length > 1 ? `${onde}, pergunta ${j + 1}` : onde;

      if (!['1', '2', '3', '4'].includes(String(pergunta.gabarito))) {
        erros.push(`${ondeP}: gabarito precisa ser 1, 2, 3 ou 4 (está "${pergunta.gabarito}")`);
      }
      const flags = SCANNERS.map((s) => Boolean(pergunta.scanners?.[s.chave]));
      if (!flags.some(Boolean)) {
        erros.push(`${ondeP}: nenhum equipamento resolve esta pergunta — o jogador ficaria travado`);
      }
      for (const lang of IDIOMAS) {
        for (const campo of CAMPOS_OBRIGATORIOS) {
          if (!String(pergunta[lang]?.[campo] ?? '').trim()) {
            erros.push(`${ondeP}: ${campo} vazio em ${lang.toUpperCase()}`);
          }
        }
      }
    });
  });

  return erros;
}

/* ---------------------------------------------------------- persistência -- */

/**
 * Normaliza o que veio do armazenamento, para o jogo não quebrar com dado velho
 * — e é aqui que o baralho v1 vira v2.
 *
 * Na v1 a pergunta era o próprio slot: `gabarito`, `scanners` e os três idiomas
 * ficavam soltos nele. Um slot assim vira um slot com UMA pergunta no banco,
 * feita desses mesmos campos. Quem publicou antes desta mudança não perde nada
 * e não precisa fazer nada.
 */
function normalizarPergunta(bruta, molde) {
  const pergunta = {
    id: typeof bruta?.id === 'string' && bruta.id ? bruta.id : novoIdDePergunta(),
    ativa: bruta?.ativa !== false,
    scanners: { ...molde.scanners, ...(bruta?.scanners ?? {}) },
    gabarito: String(bruta?.gabarito ?? '1'),
  };
  for (const lang of IDIOMAS) {
    pergunta[lang] = { ...molde[lang], ...(bruta?.[lang] ?? {}) };
  }
  return pergunta;
}

function normalizar(deck) {
  if (!deck || !Array.isArray(deck.slots) || deck.slots.length === 0) return null;
  const molde = perguntaVazia();
  const veiculoVazio = slotVazio().veiculo;

  return {
    versao: 2,
    slots: deck.slots.map((s) => {
      // v2 traz o banco; v1 traz a pergunta espalhada pelo próprio slot.
      const brutas = Array.isArray(s?.perguntas) && s.perguntas.length ? s.perguntas : [s];
      return {
        veiculo: { ...veiculoVazio, ...(s?.veiculo ?? {}) },
        perguntas: brutas.map((b) => normalizarPergunta(b, molde)),
      };
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

/* ------------------------------------------------- o que vai para a nuvem -- */

/**
 * O QUE SOBE E O QUE FICA DE FÁBRICA.
 *
 * O baralho publicado carrega as dez perguntas originais junto, palavra por
 * palavra, mesmo quando ninguém encostou nelas. Elas já estão no código de todo
 * totem — subir de novo é repetir 38 KB à toa.
 *
 * Então o que vai para o Firestore é só o que DIFERE da fábrica: pergunta ou
 * veículo intocado viram uma referência (`{deFabrica: 'orig-3'}`), e o resto vai
 * inteiro. Pergunta nova sobe inteira; pergunta de fábrica que alguém editou,
 * desligou ou reordenou deixa de ser idêntica e também sobe inteira. Não há
 * "meio referência": ou bate exatamente, ou vai por extenso.
 *
 * Dois ganhos além do tamanho:
 *  - o conteúdo de fábrica continua com uma fonte de verdade só, o
 *    `questions.js`. Corrigir um acento lá chega aos totens sem republicar.
 *  - o documento fica pequeno, e o teto de 1 MB por documento do Firestore
 *    passa a ser um problema só de quem enviar muitas fotos do computador.
 *
 * O preço, dito: se o `questions.js` mudar, o texto que o totem mostra para uma
 * pergunta referenciada muda junto. É o comportamento que se quer para conserto
 * de digitação, e é o que se precisa saber antes de reescrever uma original.
 */
const ORIGINAIS_POR_ID = new Map(SLOTS_ORIGINAIS.map((s) => [s.perguntas[0].id, s.perguntas[0]]));

const mesmo = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const indiceDoVeiculoDeFabrica = (veiculo) => VEICULOS_ORIGINAIS.findIndex((v) => mesmo(v, veiculo));

/** Troca por referência tudo que for idêntico ao de fábrica. */
export function comprimirParaNuvem(deck) {
  return {
    versao: 2,
    slots: (deck?.slots ?? []).map((slot) => {
      const iVeiculo = indiceDoVeiculoDeFabrica(slot.veiculo);
      return {
        veiculo: iVeiculo >= 0 ? { deFabrica: iVeiculo } : slot.veiculo,
        perguntas: (slot.perguntas ?? []).map((p) =>
          ORIGINAIS_POR_ID.has(p.id) && mesmo(ORIGINAIS_POR_ID.get(p.id), p) ? { deFabrica: p.id } : p
        ),
      };
    }),
  };
}

/** O inverso: devolve as referências ao conteúdo de fábrica. */
export function expandirDaNuvem(deck) {
  if (!deck || !Array.isArray(deck.slots)) return deck;
  const perdidas = [];

  const slots = deck.slots.map((slot) => {
    const ref = slot.veiculo?.deFabrica;
    const veiculo = Number.isInteger(ref) ? VEICULOS_ORIGINAIS[ref] : slot.veiculo;
    const perguntas = (slot.perguntas ?? [])
      .map((p) => {
        if (!p?.deFabrica) return p;
        const original = ORIGINAIS_POR_ID.get(p.deFabrica);
        // Só acontece se alguém tirar uma rodada do questions.js depois de um
        // baralho já ter apontado para ela. Some a pergunta, não o veículo.
        if (!original) perdidas.push(p.deFabrica);
        return original ?? null;
      })
      .filter(Boolean);
    return { veiculo: veiculo ?? slot.veiculo, perguntas };
  });

  if (perdidas.length) {
    console.warn(`baralho da nuvem aponta para perguntas de fábrica que não existem mais: ${perdidas.join(', ')}`);
  }
  // Veículo que ficou sem nenhuma pergunta sai: a roleta cairia nele sem jogo.
  return { versao: 2, slots: slots.filter((s) => s.perguntas.length > 0) };
}

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
