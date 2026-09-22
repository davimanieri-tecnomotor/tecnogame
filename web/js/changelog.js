// A versão do jogo e as notas que o sininho do painel mostra.
//
// Sem build, esta constante não nasce do package.json — o navegador nunca lê
// aquele arquivo. É mantida à mão, do mesmo jeito que VERSAO_SDK em
// firebase.js, e é exatamente o que a regra do CLAUDE.md cobra: toda
// atualização grande sobe as duas juntas (aqui e no package.json/tag git).
//
// O texto das notas é para quem opera o totem, não para quem lê commit — fala
// do que o jogador ou o operador percebem.

import { readRaw, writeRaw } from './storage.js';

export const VERSAO_DO_JOGO = '2.2.0';

/** Mais recente primeiro — é a ordem em que o painel lista. */
export const NOTAS_DE_ATUALIZACAO = [
  {
    versao: '2.2.0',
    data: '2026-09-22',
    itens: [
      'Para abrir a administração agora se entra com a conta do Firebase, e não mais com a senha de quatro dígitos. É a mesma conta que já liberava o telefone dos jogadores na aba Respostas.',
      'Com o jogo aberto do disco, ou sem internet, a senha antiga continua abrindo o painel — mas a barra avisa "sem login" e salvar para os outros totens fica bloqueado. O que você editar ali vale só naquele computador.',
    ],
  },
  {
    versao: '2.1.0',
    data: '2026-09-17',
    itens: [
      'Nova aba Respostas no painel: mostra os dados de cada partida — de todos os totens, quando há internet — e baixa tudo em CSV.',
      'Telefone do jogador só aparece para quem entrar com uma conta de verdade do Firebase; a senha da porta continua sem acesso a isso.',
    ],
  },
  {
    versao: '2.0.0',
    data: '2026-09-15',
    itens: [
      'Salvar o baralho na nuvem não pede mais login — qualquer notebook do time publica direto.',
      'A roleta gira mais devagar e estala a cada fatia, para o giro parecer de verdade.',
      'Quem acerta a resposta não vê mais o gabarito repetido na tela de fim.',
    ],
  },
];

const CHAVE = 'admin.versaoVista';

/** Última versão que o operador já viu no sininho, ou null se nunca abriu. */
export const versaoVista = () => readRaw(CHAVE);

export const marcarVersaoVista = (versao) => writeRaw(CHAVE, versao);

/** Há nota de atualização que o operador ainda não viu? */
export const temNovidade = () => versaoVista() !== VERSAO_DO_JOGO;
