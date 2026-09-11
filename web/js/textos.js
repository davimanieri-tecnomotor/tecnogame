// Os textos que não vieram do FlutterFlow.
//
// As traduções do Dart vivem em `translations.js`, que é GERADO por
// `scripts/gen_data.py` a partir do projeto original — a CI roda o gerador e
// falha se o arquivo tiver sido editado à mão. Então tudo que este porte
// acrescenta de texto novo mora aqui, na mesma forma (pt/en/es) e lido pelo
// mesmo `FFLocalizations`, para a troca de idioma continuar valendo para o
// jogo inteiro.
//
// Se um dia isto crescer, o lugar certo é o baralho (área administrativa), não
// este arquivo — aqui ficam só as palavras de interface.

import { FFLocalizations } from './i18n.js';

const TEXTOS = {
  alternativa: { pt: 'Alternativa', en: 'Answer', es: 'Alternativa' },
  respostaCerta: { pt: 'A resposta certa', en: 'The right answer', es: 'La respuesta correcta' },
  voceRespondeu: { pt: 'Você respondeu', en: 'You answered', es: 'Respondiste' },
};

/** `T('alternativa')` — o mesmo formato de `L()`, para as strings daqui. */
export function T(chave) {
  const linha = TEXTOS[chave];
  if (!linha) return '';
  return FFLocalizations.getVariableText({ ptText: linha.pt, enText: linha.en, esText: linha.es });
}
