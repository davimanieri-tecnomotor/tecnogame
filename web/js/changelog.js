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

export const VERSAO_DO_JOGO = '2.5.1';

/** Mais recente primeiro — é a ordem em que o painel lista. */
export const NOTAS_DE_ATUALIZACAO = [
  {
    versao: '2.5.1',
    data: '2026-09-22',
    itens: [
      'O som da roleta agora bate com a roda: um estalo a cada fatia que passa pela seta, na hora em que ela passa, acelerando e freando junto com o giro. Antes tocava uma gravação com ritmo próprio, que não acompanhava a roda e seguia estalando depois de a última fatia passar.',
    ],
  },
  {
    versao: '2.5.0',
    data: '2026-09-22',
    itens: [
      'Cada pergunta pode agora dispensar a escolha do equipamento: marque "Pular a escolha do equipamento nesta pergunta" nas Regras, e o jogo vai do veículo direto para ela, com a tela do Rasther 3S e sem o vídeo de 14 segundos. Serve para pergunta que não depende de scanner — e para a fila andar em feira cheia.',
      'Nessas partidas a aba Respostas mostra "não escolhido" na coluna Equipamento: a coluna continua contando só escolha de verdade.',
      'A roleta abre com os carros já na tela. As imagens dela passaram a ser baixadas enquanto o jogador se cadastra, em vez de na hora em que a roda aparece.',
    ],
  },
  {
    versao: '2.4.0',
    data: '2026-09-22',
    itens: [
      'A foto do veículo na tela da pergunta ficou bem maior: ela ocupa todo o espaço que o enunciado deixa livre.',
      'Todas as trocas de tela ficaram iguais: a tela que sai apaga e a seguinte acende. Antes quatro delas cresciam a partir do rodapé.',
    ],
  },
  {
    versao: '2.3.0',
    data: '2026-09-22',
    itens: [
      'A tela da pergunta agora mostra o veículo sorteado, com a foto e o nome, embaixo do enunciado — o jogador não precisa mais lembrar qual carro a roleta deu.',
      'O ranking diz o tempo em segundos ("6,4 s", e não "00:00:06 S") e marca a linha de quem acabou de jogar, mesmo que ela não esteja entre as três primeiras.',
      'Sem nenhum vencedor ainda, o quadro dos campeões diz isso em vez de ficar vazio.',
      'Frases corrigidas na tela do jogador: os rótulos do cadastro perderam o "( Teclado )" e o "( Tela )", o aviso de privacidade virou um link visível, e a caixa de confirmar a resposta deixou de chamar a partida de "game".',
      'No painel, o sino de novidades abre no começo da lista — antes nascia rolado e escondia o título e a versão mais nova.',
      'Ainda no painel, "Resetar todos os dados" saiu de perto do "Salvar": agora fica no pé da lista de veículos, em "Antes da feira".',
    ],
  },
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
