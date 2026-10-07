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

export const VERSAO_DO_JOGO = '3.2.0';

/** Mais recente primeiro — é a ordem em que o painel lista. */
export const NOTAS_DE_ATUALIZACAO = [
  {
    versao: '3.2.0',
    data: '2026-10-06',
    itens: [
      'Foto de veículo enviada do computador, com a conta do Firebase conectada, agora vai para o Firebase Storage — o baralho guarda só o endereço dela. Enquanto sobe, a prévia mostra a foto escolhida com a porcentagem enviada. Antes ela ia dentro do baralho, e umas dez fotos já impediam salvar na nuvem. Sem login (senha local, jogo aberto do disco) a foto continua indo dentro do baralho, como antes.',
      'O Storage se limpa sozinho: ao salvar na nuvem, as fotos que nenhum veículo usa há mais de 7 dias são apagadas. A mesma foto enviada duas vezes vira um arquivo só.',
      'Se a foto de um veículo tiver sido apagada do Storage (um rascunho parado por mais de 7 dias), o Salvar avisa qual veículo precisa de foto nova em vez de publicar um carro sem imagem.',
    ],
  },
  {
    versao: '3.1.0',
    data: '2026-10-01',
    itens: [
      'O Rasther 4 entrou na escolha do equipamento: agora são seis, três em cima e três embaixo. Ele vale para as perguntas marcadas como "Rasther 4 / ST" no painel e, como não tem vídeo demonstrativo, vai direto para a pergunta.',
      'O relógio da pergunta virou um cronômetro: os segundos que faltam em número grande, num anel que esvazia. A faixa ERRAR / RECORDE / ACERTAR AGORA e o "vale o 1º lugar por mais…" saíram — eram lidos como o tempo para responder. Continua tudo o que avisava o fim: a luz vermelha nos últimos 15 segundos, o cronômetro tremendo nos últimos 5 e o estouro no zero.',
      'Nova tela "Como funciona o jogo", com a pergunta de agora: os passos aparecem um a um e acendem a parte da tela de que falam. Segue sozinha em 15 segundos, ou em "Pular instruções".',
      'No painel, em "Na feira": "Pular o vídeo demonstrativo do equipamento" tira os 14 segundos entre a escolha do equipamento e a pergunta.',
      'Na tela de fim, quem errou não vê mais a resposta certa de novo (ela já aparece na pergunta) — fica só o QR code do vídeo, quando a pergunta tem um. E o botão REINICIAR ficou bem maior.',
      'O cadastro ficou com outra cara: a ficha num cartão escuro, os campos com a dica mais apagada (o campo vazio parecia preenchido) e o CONFIRMAR maior, em amarelo-ouro. Ao confirmar, o nome que o jogador digitou sai do campo e voa até o centro do palco — "COM VOCÊS: ANA!" —, e o jogo segue mais rápido para as instruções.',
      'Corrigido: o jogo guardava na memória um pedaço de cada partida jogada (o cadastro, a tela do vídeo e a das instruções nunca eram liberados). Num dia inteiro de feira sem recarregar a página, isso só crescia; agora a memória fica estável partida após partida.',
    ],
  },
  {
    versao: '3.0.0',
    data: '2026-09-25',
    itens: [
      'O jogo ganhou cara de programa de auditório. A pergunta agora é um palco com luz de estúdio: o apresentador pergunta "Posso perguntar?" e o relógio só começa quando o jogador aperta PODE!. Tocar numa alternativa pergunta "Está certo disso?", e a resposta tem suspense antes do veredito — festa e o ranking abrindo espaço no acerto, a resposta certa e onde aprender no erro.',
      'Dois estilos para a tela da pergunta, escolhidos no painel em "Na feira": o Clássico (a coluna do Show do Milhão, padrão) e o Palco (os losangos do Milionário).',
      'O relógio virou um conta-giros, e uma faixa ERRAR / RECORDE / ACERTAR AGORA mostra em que lugar do ranking o jogador entra se acertar naquele instante — e por quanto tempo ainda segura esse lugar.',
      'Duas ajudas novas, dentro do limite de duas por partida: Cartas (o Rei não tira nada; o Ás, o 2 e o 3 tiram uma, duas ou três alternativas erradas) e Placas (o que os jogadores anteriores responderam naquela pergunta — aparece depois que três pessoas já responderam).',
      'Todo o som do jogo agora é gerado pelo próprio jogo; as músicas de terceiros saíram. O volume se ajusta no painel ("Na feira") ou, no totem, com Ctrl+Alt+↑/↓ — Ctrl+Alt+M liga e desliga o som, e Ctrl+Alt+Home volta ao cadastro.',
      'A Pergunta do Milhão do dia: no painel, em "Na feira", o operador chama o jogador mais rápido do dia de volta ao totem para uma pergunta extra, valendo brinde, sem ajudas. Ela não entra no ranking.',
      'Cada pergunta pode ter o link do vídeo do TecnomotorTV (nas Regras da pergunta). Quem erra leva um QR code para ele, na tela da pergunta e na tela de fim.',
      'A aba Respostas ganhou as colunas Pergunta e Alternativa escolhida: dá para saber qual resposta errada é a mais comum.',
      'Mais: a roleta gira arrastando a roda com o dedo, e a fatia que ganhou acende com o nome do carro; o carro chega com placa Mercosul; o equipamento incompatível leva um carimbo em vez de um aviso que parava o jogo; o cadastro anuncia o jogador ("COM VOCÊS: ANA!"); a tela de fim virou pódio; e parado no cadastro o jogo entra em modo de atração. Teclado e botão de fliperama (1–4, Enter, Esc) também jogam.',
      'Corrigido: não dava para digitar espaço no nome do cadastro — "Davi Manieri" ficava "DaviManieri".',
    ],
  },
  {
    versao: '2.7.0',
    data: '2026-09-25',
    itens: [
      'O login do painel tem a caixa "Manter conectado neste navegador": marcada, a próxima vez entra sem pedir a senha. Desmarcada, a conta sai quando a aba fecha. Não marque no totem da feira.',
      'Quando o login não entra, um aviso no canto da tela diz por quê e o que conferir no Firebase. Quando o painel pede a senha local em vez do login, o aviso diz o motivo: o jogo aberto do disco, ou em localhost sem ?comNuvem=1.',
    ],
  },
  {
    versao: '2.6.0',
    data: '2026-09-23',
    itens: [
      'Quatro minutos sem ninguém tocar na tela, e o jogo volta sozinho para o cadastro — em qualquer tela. Antes a roleta, a escolha do equipamento e o fim de jogo esperavam para sempre, e quem chegava depois de uma partida largada no meio jogava com o nome e o telefone de quem tinha ido embora.',
      'No cadastro, os quatro minutos apagam a ficha que alguém começou a preencher e abandonou. O painel de administração não tem esse prazo.',
    ],
  },
  {
    versao: '2.5.1',
    data: '2026-09-22',
    itens: [
      'O som da roleta agora bate com a roda: um estalo a cada fatia que passa pela seta, na hora em que ela passa, acelerando e freando junto com o giro. Antes tocava uma gravação com ritmo próprio, que não acompanhava a roda e seguia estalando depois de a última fatia passar.',
      'A roleta e a tela do veículo sorteado voltaram para o meio da tela. As duas estavam coladas no alto, com a sobra toda embaixo.',
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
