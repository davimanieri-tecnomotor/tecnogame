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

  /* ------------------------------------------------ o apresentador (3.0) -- */
  // Os bordões do gênero. São linguagem de programa de auditório, e não a voz
  // de ninguém: nada aqui imita o apresentador do Show do Milhão.

  possoPerguntar: { pt: 'POSSO PERGUNTAR?', en: 'READY FOR THE QUESTION?', es: '¿PUEDO PREGUNTAR?' },
  possoPerguntarSub: {
    pt: 'O relógio só começa quando você disser que pode.',
    en: 'The clock only starts when you say so.',
    es: 'El reloj solo empieza cuando digas que puedes.',
  },
  pode: { pt: 'PODE!', en: 'GO!', es: '¡ADELANTE!' },
  valendo: { pt: 'VALENDO!', en: "IT'S ON!", es: '¡VALE!' },
  estaCertoDisso: { pt: 'ESTÁ CERTO DISSO?', en: 'ARE YOU SURE?', es: '¿ESTÁS SEGURO?' },
  simEEssa: { pt: 'SIM, É ESSA!', en: "YES, THAT'S IT!", es: '¡SÍ, ES ESA!' },
  nao: { pt: 'NÃO', en: 'NO', es: 'NO' },
  certaResposta: { pt: 'CERTA RESPOSTA!', en: 'CORRECT ANSWER!', es: '¡RESPUESTA CORRECTA!' },
  quePena: { pt: 'QUE PENA!', en: 'TOO BAD!', es: '¡QUÉ PENA!' },
  tempoEsgotado: { pt: 'TEMPO ESGOTADO!', en: "TIME'S UP!", es: '¡TIEMPO AGOTADO!' },
  resolvidoEm: { pt: 'RESOLVIDO EM', en: 'SOLVED IN', es: 'RESUELTO EN' },
  aCertaEra: { pt: 'A CERTA ERA A {n}', en: 'THE ANSWER WAS {n}', es: 'LA CORRECTA ERA LA {n}' },
  aprendaNaTv: { pt: 'APRENDA NO TECNOMOTOR TV', en: 'LEARN IT ON TECNOMOTOR TV', es: 'APRENDE EN TECNOMOTOR TV' },
  continuar: { pt: 'CONTINUAR', en: 'CONTINUE', es: 'CONTINUAR' },
  comVoces: { pt: 'COM VOCÊS:', en: 'PLEASE WELCOME:', es: 'CON USTEDES:' },

  /* ------------------------------------------------------- a cena (3.0) -- */

  defeito: { pt: 'DEFEITO', en: 'FAULT', es: 'FALLA' },
  problemaDoCliente: { pt: 'problema do cliente', en: "customer's complaint", es: 'problema del cliente' },
  voceEstaUsando: { pt: 'VOCÊ ESTÁ USANDO', en: 'YOU ARE USING', es: 'ESTÁS USANDO' },
  segundos: { pt: 'SEGUNDOS', en: 'SECONDS', es: 'SEGUNDOS' },

  /* ---------------------------------------------------------- as ajudas -- */

  ajudas: { pt: 'AJUDAS', en: 'LIFELINES', es: 'AYUDAS' },
  ajudasDisponiveis: { pt: '{n} DISPONÍVEIS', en: '{n} LEFT', es: '{n} DISPONIBLES' },
  ajudaDisponivel: { pt: '1 DISPONÍVEL', en: '1 LEFT', es: '1 DISPONIBLE' },
  ajudasEsgotadas: { pt: 'ESGOTADAS', en: 'ALL USED', es: 'AGOTADAS' },
  onlineAgora: { pt: 'ONLINE AGORA', en: 'ONLINE NOW', es: 'EN LÍNEA' },
  entendi: { pt: 'ENTENDI', en: 'GOT IT', es: 'ENTENDÍ' },
  ajudaApoio: { pt: 'APOIO TÉCNICO', en: 'TECH SUPPORT', es: 'SOPORTE TÉCNICO' },
  ajudaApoioRotulo: { pt: 'APOIO\nTÉCNICO', en: 'TECH\nSUPPORT', es: 'SOPORTE\nTÉCNICO' },
  ajudaApoioVerbo: { pt: 'Chamando o Apoio Técnico…', en: 'Calling Tech Support…', es: 'Llamando a Soporte Técnico…' },
  ajudaApoioQuem: { pt: 'Apoio Técnico Tecnomotor', en: 'Tecnomotor Tech Support', es: 'Soporte Técnico Tecnomotor' },
  ajudaEad: { pt: 'CURSOS EAD', en: 'ONLINE COURSES', es: 'CURSOS EAD' },
  ajudaEadRotulo: { pt: 'CURSOS\nEAD', en: 'ONLINE\nCOURSES', es: 'CURSOS\nEAD' },
  ajudaEadVerbo: { pt: 'Abrindo a aula…', en: 'Opening the class…', es: 'Abriendo la clase…' },
  ajudaEadQuem: { pt: 'Instrutores Tecnomotor', en: 'Tecnomotor instructors', es: 'Instructores Tecnomotor' },
  ajudaTv: { pt: 'TECNOMOTOR TV', en: 'TECNOMOTOR TV', es: 'TECNOMOTOR TV' },
  ajudaTvRotulo: { pt: 'TECNOMOTOR\nTV', en: 'TECNOMOTOR\nTV', es: 'TECNOMOTOR\nTV' },
  ajudaTvVerbo: { pt: 'Abrindo o vídeo…', en: 'Opening the video…', es: 'Abriendo el video…' },
  ajudaTvQuem: { pt: 'Canal TecnomotorTV', en: 'TecnomotorTV channel', es: 'Canal TecnomotorTV' },
  ajudaComunidade: { pt: 'COMUNIDADE', en: 'COMMUNITY', es: 'COMUNIDAD' },
  ajudaComunidadeRotulo: { pt: 'COMUNI-\nDADE', en: 'COMMU-\nNITY', es: 'COMUNI-\nDAD' },
  ajudaComunidadeVerbo: { pt: 'Perguntando no grupo…', en: 'Asking the group…', es: 'Preguntando en el grupo…' },
  ajudaComunidadeQuem: { pt: 'Comunidade Rasther', en: 'Rasther community', es: 'Comunidad Rasther' },
  ajudaRep: { pt: 'REPRESENTANTE', en: 'SALES REP', es: 'REPRESENTANTE' },
  ajudaRepRotulo: { pt: 'REPRESEN-\nTANTE', en: 'SALES\nREP', es: 'REPRESEN-\nTANTE' },
  ajudaRepVerbo: { pt: 'Ligando para o representante…', en: 'Calling the sales rep…', es: 'Llamando al representante…' },
  ajudaRepQuem: { pt: 'Representante comercial', en: 'Sales representative', es: 'Representante comercial' },
  ajudaCartas: { pt: 'CARTAS', en: 'CARDS', es: 'CARTAS' },
  ajudaCartasTitulo: { pt: 'ESCOLHA UMA CARTA', en: 'PICK A CARD', es: 'ELIGE UNA CARTA' },
  ajudaCartasSub: {
    pt: 'O Rei não tira nada. O Ás, o 2 e o 3 tiram uma, duas ou três erradas.',
    en: 'The King removes nothing. The Ace, 2 and 3 remove one, two or three wrong answers.',
    es: 'El Rey no quita nada. El As, el 2 y el 3 quitan una, dos o tres incorrectas.',
  },
  cartaRei: { pt: 'Rei! Nenhuma sai.', en: 'King! None removed.', es: '¡Rey! No sale ninguna.' },
  cartaTiraUma: { pt: 'Uma errada sai de cena.', en: 'One wrong answer removed.', es: 'Sale una incorrecta.' },
  cartaTira: { pt: '{n} erradas saem de cena.', en: '{n} wrong answers removed.', es: 'Salen {n} incorrectas.' },
  ajudaPlacas: { pt: 'PLACAS', en: 'AUDIENCE', es: 'CARTELES' },
  ajudaPlacasTitulo: { pt: 'O QUE A PLATEIA RESPONDEU', en: 'WHAT THE AUDIENCE ANSWERED', es: 'LO QUE RESPONDIÓ EL PÚBLICO' },
  ajudaPlacasSub: {
    pt: '{n} jogadores já responderam esta pergunta.',
    en: '{n} players have answered this question.',
    es: '{n} jugadores ya respondieron esta pregunta.',
  },
  semVotos: { pt: 'sem votos ainda', en: 'no votes yet', es: 'sin votos aún' },

  /* ------------------------------------------------------ o fim e a lição -- */

  aprendaAponte: {
    pt: 'Aponte a câmera do celular e veja o vídeo desta pergunta.',
    en: 'Point your phone camera to watch the video for this question.',
    es: 'Apunta la cámara del celular y mira el video de esta pregunta.',
  },
  suaPosicao: { pt: 'SUA POSIÇÃO', en: 'YOUR RANK', es: 'TU POSICIÓN' },

  /* ------------------------------------------------ a atração e o cadastro -- */

  toqueParaJogar: { pt: 'TOQUE PARA JOGAR', en: 'TOUCH TO PLAY', es: 'TOCA PARA JUGAR' },
  hoje: { pt: 'HOJE', en: 'TODAY', es: 'HOY' },
  jogadoresHoje: { pt: '{n} jogadores', en: '{n} players', es: '{n} jugadores' },
  acertaram: { pt: '{p}% acertaram', en: '{p}% got it right', es: '{p}% acertaron' },
  maisRapidoHoje: { pt: 'O mais rápido de hoje: {nome}, {t}', en: "Today's fastest: {nome}, {t}", es: 'El más rápido de hoy: {nome}, {t}' },
  primeiroDoDia: { pt: 'Seja o primeiro do dia!', en: 'Be the first today!', es: '¡Sé el primero del día!' },

  /* ----------------------------------------------- roleta, carro, scanner -- */

  arrasteParaGirar: { pt: 'ou arraste a roda', en: 'or swipe the wheel', es: 'o arrastra la rueda' },
  incompativel: { pt: 'INCOMPATÍVEL', en: 'INCOMPATIBLE', es: 'INCOMPATIBLE' },
  incompativelSub: {
    pt: 'Este equipamento não faz esta função. Escolha outro.',
    en: 'This tool does not do this job. Pick another.',
    es: 'Este equipo no hace esta función. Elige otro.',
  },

  /* ---------------------------------------------- como funciona (3.1) -- */

  comoFunciona: { pt: 'COMO FUNCIONA O JOGO', en: 'HOW THE GAME WORKS', es: 'CÓMO FUNCIONA EL JUEGO' },
  comoCaminhoRoleta: { pt: 'GIRE A ROLETA', en: 'SPIN THE WHEEL', es: 'GIRA LA RULETA' },
  comoCaminhoEquipamento: { pt: 'ESCOLHA O EQUIPAMENTO', en: 'PICK THE SCAN TOOL', es: 'ELIGE EL EQUIPO' },
  comoCaminhoDefeito: { pt: 'RESOLVA O DEFEITO', en: 'FIX THE FAULT', es: 'RESUELVE LA FALLA' },
  comoPassoDefeito: { pt: 'LEIA O DEFEITO', en: 'READ THE FAULT', es: 'LEE LA FALLA' },
  comoPassoDefeitoSub: {
    pt: 'Um veículo chegou com um problema para você resolver.',
    en: 'A vehicle came in with a problem for you to solve.',
    es: 'Llegó un vehículo con un problema para que lo resuelvas.',
  },
  comoPassoResposta: { pt: 'TOQUE NA CERTA', en: 'TAP THE RIGHT ONE', es: 'TOCA LA CORRECTA' },
  comoPassoRespostaSub: {
    pt: 'São 4 alternativas, e só uma resolve. Toque e confirme.',
    en: 'Four answers, and only one fixes it. Tap it and confirm.',
    es: 'Son 4 alternativas, y solo una lo resuelve. Toca y confirma.',
  },
  comoPassoAjudas: { pt: 'ATÉ 2 AJUDAS', en: 'UP TO 2 LIFELINES', es: 'HASTA 2 AYUDAS' },
  comoPassoAjudasSub: {
    pt: 'Apoio técnico, cursos, TecnomotorTV, comunidade e mais.',
    en: 'Tech support, courses, TecnomotorTV, community and more.',
    es: 'Soporte técnico, cursos, TecnomotorTV, comunidad y más.',
  },
  comoPassoTempo: { pt: '60 SEGUNDOS', en: '60 SECONDS', es: '60 SEGUNDOS' },
  comoPassoTempoSub: {
    pt: 'O cronômetro só começa quando você diz PODE! Se zerar, estoura.',
    en: 'The clock only starts when you say GO! If it hits zero, it blows.',
    es: 'El cronómetro empieza cuando dices ¡ADELANTE! Si llega a cero, explota.',
  },
  comoPassoRanking: { pt: 'QUANTO MAIS RÁPIDO, MELHOR', en: 'THE FASTER, THE BETTER', es: 'CUANTO MÁS RÁPIDO, MEJOR' },
  comoPassoRankingSub: {
    pt: 'Acertou? Seu tempo disputa o pódio dos maiores campeões.',
    en: 'Got it right? Your time goes for the champions podium.',
    es: '¿Acertaste? Tu tiempo compite por el podio de campeones.',
  },

  /* ------------------------------------------------- a pergunta do milhão -- */

  perguntaDoMilhao: { pt: 'PERGUNTA DO MILHÃO', en: 'THE MILLION QUESTION', es: 'LA PREGUNTA DEL MILLÓN' },
  ganhouOBrinde: { pt: 'GANHOU O BRINDE!', en: 'YOU WON THE PRIZE!', es: '¡GANASTE EL PREMIO!' },
  voltarAoJogo: { pt: 'VOLTAR AO JOGO', en: 'BACK TO THE GAME', es: 'VOLVER AL JUEGO' },
  semAjudasNoMilhao: {
    pt: 'Sem ajudas: é você e o relógio.',
    en: 'No lifelines: just you and the clock.',
    es: 'Sin ayudas: tú y el reloj.',
  },
};

/** `T('alternativa')` — o mesmo formato de `L()`, para as strings daqui. */
export function T(chave) {
  const linha = TEXTOS[chave];
  if (!linha) return '';
  return FFLocalizations.getVariableText({ ptText: linha.pt, enText: linha.en, esText: linha.es });
}

/**
 * `Tf('aCertaEra', { n: 3 })` — o texto com as lacunas `{x}`
 * preenchidas. As lacunas ficam no texto, e não em concatenação no ponto de
 * uso, porque cada idioma põe o número num lugar diferente da frase.
 */
export function Tf(chave, valores = {}) {
  return T(chave).replace(/\{(\w+)\}/g, (inteiro, nome) => (nome in valores ? String(valores[nome]) : inteiro));
}
