// Port of lib/app_state.dart (FFAppState) and the CadastroStruct it holds.
//
// The three question lists are persisted under the same SharedPreferences keys
// the Dart used, so a browser that already has them keeps them; anything else
// falls back to the values compiled into the app.

import { carregarBaralho, perguntasAtivas, CAMPOS_QUESTAO } from './deck.js';
import { escolhaParaIndice } from './functions.js';

/** CadastroStruct */
export class CadastroStruct {
  constructor({ nome, telefone, atuacao, invalido } = {}) {
    this._nome = nome;
    this._telefone = telefone;
    this._atuacao = atuacao;
    this._invalido = invalido;
  }

  get nome() {
    return this._nome ?? '';
  }

  set nome(v) {
    this._nome = v;
  }

  get telefone() {
    return this._telefone ?? '';
  }

  set telefone(v) {
    this._telefone = v;
  }

  get atuacao() {
    return this._atuacao ?? '';
  }

  set atuacao(v) {
    this._atuacao = v;
  }

  get invalido() {
    return this._invalido ?? 0;
  }

  set invalido(v) {
    this._invalido = v;
  }
}


class FFAppStateClass {
  constructor() {
    /**
     * O baralho em vigor: a lista ordenada de rodadas. Sem nada publicado pela
     * área administrativa é o embutido, e aí o jogo roda idêntico ao original
     * (ver deck.js).
     */
    this.baralho = carregarBaralho();

    /**
     * Qual pergunta de cada veículo está valendo nesta partida — um índice por
     * slot, dentro de `slot.perguntas`. Ver `sortearPerguntas()`.
     */
    this.sorteio = [];

    this.scannerEscolhido = '';
    this.tempoAcabando = false;
    this.escolha = 1.5;

    /// Essa variável serve para controlar qual popUp estará aberto quando o
    /// user clicar.  0 = fechado, 1 = Apoio, Etc...
    this.ajuda = 0;

    this.cadastro = new CadastroStruct();
    this.ordemNumeros = [4, 2, 3, 1];
    this.listaEscolhas = [];
    this.linguagem = '';
    this.finalizou = false;

    /**
     * O que a partida terminou decidindo, para a tela de fim poder contar.
     *
     * O jogo julgava e ia embora sem nunca dizer qual era a resposta certa —
     * num jogo feito para ensinar técnico a usar scanner, era justamente o
     * pedaço que faltava. Fica `null` fora de uma partida.
     *
     * `{ acertou, numeroCerto, textoCerto, numeroEscolhido, textoEscolhido }`,
     * onde os números são os que o jogador vê na tela (1 a 4), e não os índices
     * embaralhados de `ordemNumeros`.
     */
    this.resultado = null;
  }

  /** initializePersistedState() */
  initializePersistedState() {
    this.baralho = carregarBaralho();
    this.sortearPerguntas();
  }

  /**
   * Relê o baralho publicado. Chamado quando a tela de cadastro abre, que é
   * quando um jogador novo começa: assim o operador publica na área
   * administrativa e a próxima partida já usa o conteúdo novo, sem precisar
   * reiniciar o navegador do totem.
   */
  recarregarBaralho() {
    this.baralho = carregarBaralho();
    this.sortearPerguntas();
  }

  /**
   * Sorteia, para CADA veículo, qual das suas perguntas ativas vale nesta
   * partida. Um veículo pode ter várias (ver deck.js); sem isto, o segundo
   * jogador da fila receberia a mesma pergunta do primeiro.
   *
   * É sorteado no começo da partida, e não na hora de mostrar, porque três
   * telas leem a mesma pergunta em momentos diferentes — a escolha do
   * equipamento usa os `scanners` dela, a tela da ação usa o enunciado, a de
   * fim usa o gabarito. Sortear a cada leitura daria respostas diferentes na
   * mesma partida.
   *
   * Todos os slots de uma vez, e não só o que a roleta vai tirar, porque a
   * roleta ainda não girou quando o cadastro monta.
   */
  sortearPerguntas() {
    this.sorteio = (this.baralho?.slots ?? []).map((slot) => {
      const ativas = perguntasAtivas(slot);
      if (ativas.length <= 1) return 0;
      const escolhida = ativas[Math.floor(Math.random() * ativas.length)];
      return Math.max(0, slot.perguntas.indexOf(escolhida));
    });
  }

  /** Quantas rodadas o baralho tem — o número de fatias da roleta. */
  get totalSlots() {
    return this.baralho?.slots?.length ?? 0;
  }

  /**
   * A rodada que a roleta sorteou. `escolha` guarda quantas voltas girar, e a
   * fração da volta é a fatia que parou na seta (ver functions.js).
   */
  get indiceAtual() {
    return escolhaParaIndice(this.escolha, this.totalSlots) ?? 0;
  }

  get slotAtual() {
    return this.baralho?.slots?.[this.indiceAtual] ?? null;
  }

  /**
   * As três listas de questões na forma que o Dart usava
   * (`{pergunta, respostaUm, ..., gabarito, raster3S, rasher4, xtool}`), agora
   * derivadas do baralho. Manter esta forma foi deliberado: as telas de jogo
   * continuam lendo os campos exatamente como liam, então a troca do modelo de
   * dados não tocou em nenhuma delas.
   */
  get questoesBrasil() {
    return vistaPorIdioma(this.baralho, 'pt', this.sorteio);
  }

  get questoesEnglish() {
    return vistaPorIdioma(this.baralho, 'en', this.sorteio);
  }

  get questoesSpanish() {
    return vistaPorIdioma(this.baralho, 'es', this.sorteio);
  }

  addToListaEscolhas(value) {
    this.listaEscolhas.push(value);
  }

  removeFromListaEscolhas(value) {
    const index = this.listaEscolhas.indexOf(value);
    if (index >= 0) this.listaEscolhas.splice(index, 1);
  }
}

/** Cache da projeção: as telas leem estes getters muitas vezes por quadro. */
const vistaCache = new WeakMap();

/**
 * O baralho na forma que as telas de jogo leem: uma lista por idioma, indexada
 * por slot, cada entrada com os campos que o Dart tinha
 * (`{pergunta, respostaUm, ..., gabarito, raster3S, rasher4, xtool}`).
 *
 * Manter esta forma foi deliberado desde a v1, e é o que segurou a mudança para
 * banco de perguntas: a projeção passou a resolver QUAL pergunta do veículo
 * está valendo (`sorteio[i]`), e nenhuma tela de jogo precisou mudar.
 *
 * A chave do cache inclui o sorteio: sortear de novo tem de produzir uma vista
 * nova, senão a partida seguinte joga com a pergunta da anterior.
 */
function vistaPorIdioma(deck, lang, sorteio) {
  if (!deck) return [];
  let porChave = vistaCache.get(deck);
  if (!porChave) {
    porChave = {};
    vistaCache.set(deck, porChave);
  }
  const chave = `${lang}|${(sorteio ?? []).join(',')}`;
  if (!porChave[chave]) {
    porChave[chave] = (deck.slots ?? []).map((slot, i) => {
      const perguntas = slot.perguntas ?? [];
      const escolhida = perguntas[sorteio?.[i] ?? 0] ?? perguntas[0] ?? {};
      const q = {};
      for (const campo of CAMPOS_QUESTAO) q[campo] = escolhida[lang]?.[campo] ?? '';
      q.gabarito = String(escolhida.gabarito ?? '');
      q.raster3S = Boolean(escolhida.scanners?.raster3S);
      q.rasher4 = Boolean(escolhida.scanners?.rasher4);
      q.xtool = Boolean(escolhida.scanners?.xtool);
      q.nome = slot.veiculo?.nome ?? '';
      return q;
    });
  }
  return porChave[chave];
}

export const FFAppState = new FFAppStateClass();

