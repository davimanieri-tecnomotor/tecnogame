// Port of lib/app_state.dart (FFAppState) and the CadastroStruct it holds.
//
// The three question lists are persisted under the same SharedPreferences keys
// the Dart used, so a browser that already has them keeps them; anything else
// falls back to the values compiled into the app.

import { QUESTIONS } from './questions.js';
import { readJson } from './storage.js';

const listeners = new Set();

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

/**
 * As três listas de questões vinham persistidas pelo Dart. Nada no jogo grava
 * essas chaves — só o admin publica baralho — mas a leitura fica para não
 * descartar o que um totem já tenha guardado.
 */
function loadQuestions(name, fallback) {
  const list = readJson(name, null);
  return Array.isArray(list) && list.length > 0 ? list : fallback;
}

class FFAppStateClass {
  constructor() {
    this.questoesBrasil = QUESTIONS.pt;
    this.questoesEnglish = QUESTIONS.en;
    this.questoesSpanish = QUESTIONS.es;

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
    this.questoesBrasil = loadQuestions('questoes.pt', QUESTIONS.pt);
    this.questoesEnglish = loadQuestions('questoes.en', QUESTIONS.en);
    this.questoesSpanish = loadQuestions('questoes.es', QUESTIONS.es);
  }

  /** update(callback) - runs the mutation then notifies listeners. */
  update(callback) {
    if (callback) callback();
    this.notifyListeners();
  }

  addToListaEscolhas(value) {
    this.listaEscolhas.push(value);
  }

  removeFromListaEscolhas(value) {
    const index = this.listaEscolhas.indexOf(value);
    if (index >= 0) this.listaEscolhas.splice(index, 1);
  }

  notifyListeners() {
    for (const fn of listeners) fn(this);
  }
}

export const FFAppState = new FFAppStateClass();

/**
 * Contraparte de `notifyListeners()`. Hoje nenhuma tela assina — o porte
 * re-renderiza por navegação, não por observação — mas é o seam que dá sentido
 * ao `update()` espalhado pelo código, que existe por paridade com o
 * ChangeNotifier do Dart.
 */
export function onAppStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

