// Port of lib/app_state.dart (FFAppState) and the CadastroStruct it holds.
//
// The three question lists are persisted under the same SharedPreferences keys
// the Dart used, so a browser that already has them keeps them; anything else
// falls back to the values compiled into the app.

import { carregarBaralho, CAMPOS_QUESTAO } from './deck.js';
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
  }

  /** initializePersistedState() */
  initializePersistedState() {
    this.baralho = carregarBaralho();
  }

  /**
   * Relê o baralho publicado. Chamado quando a tela de cadastro abre, que é
   * quando um jogador novo começa: assim o operador publica na área
   * administrativa e a próxima partida já usa o conteúdo novo, sem precisar
   * reiniciar o navegador do totem.
   */
  recarregarBaralho() {
    this.baralho = carregarBaralho();
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
    return vistaPorIdioma(this.baralho, 'pt');
  }

  get questoesEnglish() {
    return vistaPorIdioma(this.baralho, 'en');
  }

  get questoesSpanish() {
    return vistaPorIdioma(this.baralho, 'es');
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

function vistaPorIdioma(deck, lang) {
  if (!deck) return [];
  let porIdioma = vistaCache.get(deck);
  if (!porIdioma) {
    porIdioma = {};
    vistaCache.set(deck, porIdioma);
  }
  if (!porIdioma[lang]) {
    porIdioma[lang] = (deck.slots ?? []).map((slot) => {
      const q = {};
      for (const campo of CAMPOS_QUESTAO) q[campo] = slot[lang]?.[campo] ?? '';
      q.gabarito = String(slot.gabarito ?? '');
      q.raster3S = Boolean(slot.scanners?.raster3S);
      q.rasher4 = Boolean(slot.scanners?.rasher4);
      q.xtool = Boolean(slot.scanners?.xtool);
      q.nome = slot.veiculo?.nome ?? '';
      return q;
    });
  }
  return porIdioma[lang];
}

export const FFAppState = new FFAppStateClass();

