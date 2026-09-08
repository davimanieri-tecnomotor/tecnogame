// Port of lib/flutter_flow/internationalization.dart.

import { TRANSLATIONS } from './translations.js';

const LOCALE_KEY = '__locale_key__';

/** FFLocalizations.languages() */
export const LANGUAGES = ['pt', 'es', 'en'];

/** Display names come from _defaultLanguagesList, in that list's order:
 *  English, Português, Español. */
export const LANGUAGE_NAMES = [
  { isoCode: 'en', name: 'English' },
  { isoCode: 'pt', name: 'Português' },
  { isoCode: 'es', name: 'Español' },
];

const listeners = new Set();

let locale = readStoredLocale() ?? defaultLocale();

function readStoredLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    return stored && stored.length ? stored : null;
  } catch (_) {
    return null;
  }
}

function defaultLocale() {
  // MaterialApp with a null locale falls back to the platform locale when it is
  // in supportedLocales, otherwise to the first supported one ('pt').
  const nav = (navigator.language || 'pt').toLowerCase().split('-')[0];
  return LANGUAGES.includes(nav) ? nav : 'pt';
}

export const FFLocalizations = {
  get languageCode() {
    return locale;
  },

  get languageIndex() {
    return LANGUAGES.includes(locale) ? LANGUAGES.indexOf(locale) : 0;
  },

  /** getText(key) - falls back to '' just like the Dart. */
  getText(key) {
    return (TRANSLATIONS[key] ?? {})[locale] ?? '';
  },

  /** getVariableText({ptText, esText, enText}) indexes by languageIndex. */
  getVariableText({ ptText = '', esText = '', enText = '' } = {}) {
    return [ptText, esText, enText][this.languageIndex] ?? '';
  },
};

/** `setAppLanguage(context, lang)` */
export function setAppLanguage(lang) {
  locale = lang;
  try {
    localStorage.setItem(LOCALE_KEY, lang);
  } catch (_) {
    /* private mode */
  }
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
  for (const fn of listeners) fn(lang);
}

export function onLanguageChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Convenience alias used all over the pages, mirroring `L('key' /* text *​/)`. */
export const L = (key) => FFLocalizations.getText(key);
