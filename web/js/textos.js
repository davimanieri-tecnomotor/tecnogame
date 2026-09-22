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
//
// E TAMBÉM AS CORREÇÕES. Uma frase errada do FlutterFlow não tem como ser
// consertada onde ela mora: `translations.js` é gerado, a CI compara com o
// gerador, e a fonte (`tec_game.zip`) saiu do repositório — regerar está
// bloqueado. Então a frase certa passa a morar aqui e o ponto de uso troca
// `L('chave')` por `T('nome')`. As três primeiras correções assim:
//
//   8lqt2gtq  "Você deseja confirma sua resposta? Isso irá finalizar o game."
//             — erro de concordância, e "game" em inglês no meio do português.
//   05h1096o  "Primeiro Nome ( Teclado )"      ] o "( Teclado )" e o "( Tela )"
//   6vx2q4r4  "Whatsapp ( teclado )"           ] eram anotação do projeto Dart
//   sfh76esp  "Tipo da oficina ( Tela )"       ] sobre COMO preencher o campo;
//             vazaram para o rótulo que o jogador lê.
//   hjove9jy  "Ao clicar em continuar…" — o botão se chama CONFIRMAR desde
//             sempre; o aviso mandava procurar um "continuar" que não existe.

import { FFLocalizations } from './i18n.js';

const TEXTOS = {
  alternativa: { pt: 'Alternativa', en: 'Answer', es: 'Alternativa' },
  respostaCerta: { pt: 'A resposta certa', en: 'The right answer', es: 'La respuesta correcta' },
  voceRespondeu: { pt: 'Você respondeu', en: 'You answered', es: 'Respondiste' },

  /* ------------------------------------------- correções de translations.js -- */

  rotuloNome: { pt: 'Primeiro nome', en: 'First name', es: 'Nombre' },
  rotuloWhatsapp: { pt: 'WhatsApp', en: 'WhatsApp', es: 'WhatsApp' },
  rotuloOficina: { pt: 'Tipo da oficina', en: 'Workshop type', es: 'Tipo de taller' },
  confirmarResposta: {
    pt: 'Quer confirmar esta resposta? A partida termina aqui.',
    en: 'Confirm this answer? The game ends here.',
    es: '¿Confirmar esta respuesta? La partida termina aquí.',
  },
  avisoPrivacidade: {
    pt: 'Ao confirmar, você concorda com os termos de acesso aos dados. Toque para ler a política de privacidade.',
    en: 'By confirming, you agree to the data access terms. Tap to read the privacy policy.',
    es: 'Al confirmar, acepta los términos de acceso a los datos. Toque para leer la política de privacidad.',
  },

  /* ------------------------------------------------------ ranking e resultado -- */

  rankingVazio: {
    pt: 'Ninguém venceu ainda. Seja o primeiro.',
    en: 'No winners yet. Be the first.',
    es: 'Aún no hay ganadores. Sé el primero.',
  },
  voce: { pt: 'VOCÊ', en: 'YOU', es: 'TÚ' },
};

/** `T('alternativa')` — o mesmo formato de `L()`, para as strings daqui. */
export function T(chave) {
  const linha = TEXTOS[chave];
  if (!linha) return '';
  return FFLocalizations.getVariableText({ ptText: linha.pt, enText: linha.en, esText: linha.es });
}
