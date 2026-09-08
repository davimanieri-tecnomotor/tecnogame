// Port of lib/app_state.dart (FFAppState) and the CadastroStruct it holds.
//
// The three question lists are persisted under the same SharedPreferences keys
// the Dart used, so a browser that already has them keeps them; anything else
// falls back to the values compiled into the app.

import { QUESTIONS } from './questions.js';

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

function loadQuestions(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return fallback;
    return list;
  } catch (error) {
    console.warn(`Can't decode persisted data type. Error: ${error}.`);
    return fallback;
  }
}

function saveQuestions(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (_) {
    /* storage unavailable */
  }
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
    this.questoesBrasil = loadQuestions('ff_questoesBrasil', QUESTIONS.pt);
    this.questoesEnglish = loadQuestions('ff_questoesEnglish', QUESTIONS.en);
    this.questoesSpanish = loadQuestions('ff_questoesSpanish', QUESTIONS.es);
  }

  persistQuestions() {
    saveQuestions('ff_questoesBrasil', this.questoesBrasil);
    saveQuestions('ff_questoesEnglish', this.questoesEnglish);
    saveQuestions('ff_questoesSpanish', this.questoesSpanish);
  }

  /** update(callback) - runs the mutation then notifies listeners. */
  update(callback) {
    if (callback) callback();
    this.notifyListeners();
  }

  updateCadastroStruct(updateFn) {
    updateFn(this.cadastro);
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

export function onAppStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The question for the currently selected wheel value, in a given language. */
export function questaoAtual(lang = 'pt') {
  const list =
    lang === 'en' ? FFAppState.questoesEnglish : lang === 'es' ? FFAppState.questoesSpanish : FFAppState.questoesBrasil;
  const index = Math.trunc(FFAppState.escolha * 10) % 10;
  return list[index] ?? null;
}
