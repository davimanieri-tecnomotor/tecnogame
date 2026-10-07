// Área administrativa do TecGame: ver, adicionar, editar e remover as rodadas
// (pergunta + veículo + equipamentos) que o totem sorteia.
//
// Vive DENTRO do index.html, numa camada própria por cima do jogo, e não numa
// rota do palco: o jogo é um palco de 1920x1080 escalado com medidas absolutas
// de totem, e o admin é HTML responsivo comum, usado num notebook. Por isso não
// é um widget — é uma raiz separada que `montarAdmin` preenche e
// `desmontarAdmin` esvazia. Quem abre e fecha essa camada é o `porta.js`.
//
// Até a v1 isto era um `admin.html` separado, e esse arquivo a mais era a
// proteção de verdade: para o admin não existir no totem, bastava não copiá-lo
// para lá. Uma página só, servida pelo GitHub Pages, abre mão disso — a senha
// da porta viaja no mesmo JavaScript que o jogador recebe, e quem abrir o
// código a lê. Ver a nota em `porta.js`: é tranca de gaveta, não cofre.
//
// Três abas: Veículos (o baralho), Respostas (as partidas) e Configurações (o
// que vale só neste navegador — ver admin/configuracoes.js).
//
// Editar aqui não mexe no totem até você clicar em Salvar. Salvar grava o
// baralho neste navegador e, se houver nuvem, no Firebase; o jogo o relê quando
// a próxima partida começa.
//
// Salvar na nuvem pede a conta do Firebase: a regra de `conteudo` exige
// `request.auth != null` (firebase/firestore.rules). Sem ela, Salvar grava só
// neste navegador e diz por quê. A mesma conta manda as fotos enviadas do
// computador para o Storage — ver admin/imagens.js.

import { el, botao, aviso, confirmar, limpar, mostrarNotas, pedirCredenciais, ajuda, icone } from './ui.js';
import { abrirPopover, fecharPopover } from './ui.js';
import { editorDeSlot } from './editor.js';
import { telaConfiguracoes } from './configuracoes.js';
import { agruparProblemas, explicarProblema } from './problemas.js';
import { FFAppState } from '../state.js';
import { goNamed } from '../router.js';
import { milhaoAutomatico } from '../pages/milhao.js';
import { rotuloDaPergunta } from '../deck.js';
import {
  BARALHO_ORIGINAL,
  SLOTS_ORIGINAIS,
  carregarBaralho,
  novoIdDePergunta,
  perguntaVazia,
  publicarBaralho,
  restaurarOriginal,
  slotVazio,
  temBaralhoPublicado,
  usaArteOriginal,
} from '../deck.js';
import { motivoDaFalha, removerChave } from '../storage.js';
import { podeUsarNuvem } from '../firebase.js';
import { publicarNaNuvem, sincronizarBaralho, ultimaPublicacao } from '../nuvem.js';
import {
  CARENCIA_DIAS,
  apagarRecemEnviadasSemUso,
  enviosEmAndamento,
  esquecerRecemEnviadas,
  fotosDoBaralho,
  fotosQueSumiram,
  haRecemEnviadas,
  limparFotosSemUso,
} from './imagens.js';
import { VERSAO_DO_JOGO, NOTAS_DE_ATUALIZACAO, temNovidade, marcarVersaoVista } from '../changelog.js';
import {
  COLUNAS,
  aoMudarOperador,
  baixarArquivo,
  buscarRespostas,
  descreverFalha,
  entrar,
  formatarCelula,
  paraCSV,
  sair,
} from './respostas.js';

/* -------------------------------------------------------------- o estado -- */

/** Uma cópia funda: nada do que se edita aqui vaza para o jogo sem publicar. */
const clonar = (x) => JSON.parse(JSON.stringify(x));

// `baralho` nasce vazio e só é lido em `montarAdmin`. Este módulo entra no
// bundle do jogo (uma página só), e ler o armazenamento na hora do import
// faria todo jogador pagar por uma tela que ele nunca vai abrir.
const estado = {
  baralho: null,
  /** O veículo aberto (índice do slot). */
  selecionado: 0,
  /** Qual pergunta do banco desse veículo está no editor. */
  pergunta: 0,
  /** A aba de idioma do editor — fica a mesma ao trocar de veículo. */
  idioma: 'pt',
  sujo: false,
  /** `{quando, quem}` da última gravação no Firebase, ou null. */
  ultimaNuvem: null,

  /** 'veiculos' | 'respostas' | 'config' — qual aba do painel está visível. */
  aba: 'veiculos',
  /** E-mail da conta do Firebase autenticada nesta aba, ou null. */
  operador: null,
  /** O que a aba Respostas mostra — ver `buscarRespostas` em respostas.js. */
  respostas: { linhas: [], fonte: null, comTelefone: false, carregado: false, carregando: false },
};

/** A raiz que `montarAdmin` recebe. Fora da camada aberta, é null. */
let app = null;

/** Um resumo curto da pergunta, para a lista. */
const resumoDaPergunta = (pergunta, j) => {
  const texto = (pergunta?.pt?.pergunta ?? '').trim();
  return texto ? texto.slice(0, 70) : `Pergunta ${j + 1} (sem enunciado)`;
};

const nomeDoVeiculo = (i) => estado.baralho.slots[i]?.veiculo?.nome?.trim() || `Veículo ${i + 1}`;

/* ------------------------------------------------------- fotos sem uso -- */

/**
 * Apaga do Storage a foto que esta aba enviou e que nada mais cita — trocada
 * por outra, veículo removido, alterações descartadas. Ver a nota grande em
 * admin/imagens.js sobre por que só essas saem na hora.
 *
 * "Nada mais cita" é o editor E o baralho publicado: depois de "Descartar", a
 * foto que voltou a valer é a publicada, e ela fica.
 */
async function soltarFotosSemUso() {
  if (!haRecemEnviadas()) return;
  const emUso = new Set([...fotosDoBaralho(estado.baralho), ...fotosDoBaralho(carregarBaralho())]);
  const { apagadas } = await apagarRecemEnviadasSemUso(emUso);
  if (apagadas) {
    aviso(apagadas === 1 ? 'A foto anterior foi apagada do Firebase Storage.' : `${apagadas} fotos sem uso foram apagadas do Firebase Storage.`);
  }
}

/* ------------------------------------------------------------------ ações -- */

async function publicar() {
  // A foto nova só entra no veículo quando o envio termina: salvar antes
  // publicaria a ANTIGA, e a nova ficaria pendente só neste navegador.
  if (enviosEmAndamento() > 0) {
    aviso('Espere a foto terminar de subir para o Firebase Storage e salve de novo.', 'erro');
    return;
  }

  const { total, itens, gerais } = agruparProblemas(estado.baralho);
  if (total > 0) {
    const primeiro = itens[0];
    const explicado = primeiro ? explicarProblema(primeiro.mensagem) : null;
    aviso(
      `${total === 1 ? 'Um problema impede' : `${total} problemas impedem`} salvar. ${
        primeiro ? `${nomeDoVeiculo(primeiro.i)}: ${explicado.texto}.` : gerais[0] ?? ''
      }`.trim(),
      'erro'
    );
    if (primeiro) irParaProblema(primeiro);
    return;
  }

  const partes = [
    !usaArteOriginal(estado.baralho)
      ? 'O baralho não usa mais os dez veículos originais, então a roleta será desenhada pelo jogo em vez de usar a arte pronta.'
      : null,
    // Dito AQUI, e não num selo permanente: é no momento de salvar que a
    // diferença entre "foi para todo mundo" e "ficou nesta máquina" importa.
    !podeUsarNuvem()
      ? 'Atenção: esta cópia não fala com o Firebase, então o baralho vai valer só neste navegador. Para salvar na nuvem daqui, abra o jogo com ?comNuvem=1 no endereço.'
      : !estado.operador
        ? 'Atenção: você entrou sem login, então o baralho vai valer só neste navegador. Clique em Entrar, no alto da tela, para salvar para os outros totens.'
        : 'Vai para o Firebase: todo totem com internet pega na próxima partida.',
    'A próxima partida aqui já usa este conteúdo.',
  ].filter(Boolean);

  if (!(await confirmar({ titulo: 'Salvar o baralho?', texto: partes.join(' '), confirmarTexto: 'Salvar' }))) return;

  // Antes de gravar em qualquer lugar: uma foto do Storage que a limpeza já
  // apagou (rascunho parado além da carência) viraria um veículo sem foto na
  // roleta de todo totem. Só com login — sem ele a regra nem deixa conferir —,
  // e sem rede segue em frente: não dá para saber, e recusar salvar por isso
  // seria pior.
  if (podeUsarNuvem() && estado.operador) {
    const { sumidas } = await fotosQueSumiram(estado.baralho);
    if (sumidas.length) {
      const nomes = sumidas.map((i) => nomeDoVeiculo(i));
      aviso(
        `A foto de ${nomes.join(', ')} não existe mais no Firebase Storage (foi apagada por outra máquina, ou pela limpeza das que passam de ${CARENCIA_DIAS} dias sem uso). Envie a imagem de novo e salve.`,
        'erro'
      );
      estado.selecionado = sumidas[0];
      estado.pergunta = 0;
      desenhar();
      return;
    }
  }

  // O que estava publicado ANTES deste Salvar: as fotos que ele citava e o novo
  // não cita mais foram trocadas agora, e saem do Storage sem esperar a
  // carência — depois de a troca chegar à nuvem, nunca antes.
  const antes = carregarBaralho();

  if (!publicarBaralho(estado.baralho)) {
    // "Cheio" e "recusado" pedem coisas opostas: um pede tirar imagem enviada,
    // o outro pede liberar o armazenamento do site. Dizer qual dos dois e.
    const motivo = motivoDaFalha();
    aviso(
      motivo === 'cheio'
        ? `Não caberia: o baralho está com cerca de ${pesoDoBaralho()} KB e o navegador não aceitou. Imagens enviadas do computador sem login são o que mais ocupa — entre com a conta do Firebase e envie de novo (vão para o Storage), ou troque por uma das fotos do jogo.`
        : 'Não foi possível gravar — o navegador está bloqueando o armazenamento deste site.',
      'erro'
    );
    return;
  }
  estado.sujo = false;
  aviso('Salvo neste navegador. A próxima partida aqui já usa este baralho.');
  desenhar();

  // E sobe para a nuvem, que é o que alcança os OUTROS totens. Depois do
  // gravado local de propósito: se a internet estiver fora, o que foi editado
  // não se perde, e o operador é avisado do que ficou faltando.
  if (!podeUsarNuvem()) {
    aviso('Esta cópia não fala com o Firebase — abra com ?comNuvem=1 no endereço para salvar na nuvem daqui.', 'erro');
    return;
  }
  // Sem conta autenticada não adianta tentar: a regra de `conteudo` exige
  // `request.auth != null` (firebase/firestore.rules), e o Firestore devolveria
  // um "insufficient permissions" que não diz ao operador o que fazer. Melhor
  // dizer aqui, com o caminho do conserto.
  if (!estado.operador) {
    aviso('Sem login, o baralho ficou só neste navegador. Clique em Entrar, no alto da tela, para salvar para os outros totens.', 'erro');
    return;
  }
  const r = await publicarNaNuvem(estado.baralho);
  if (!r.ok) {
    aviso(`A nuvem recusou: ${r.motivo}`, 'erro');
    return;
  }
  aviso(`Salvo na nuvem (${r.kb} KB). Todo totem com internet pega na próxima partida.`);
  await atualizarUltimaNuvem();

  // A faxina do Storage roda aqui, e não num servidor: é o único momento em
  // que se sabe, com certeza, qual baralho está publicado. Com o que acabou
  // de subir, e não com `estado.baralho` — o operador pode voltar a editar
  // enquanto a lista do Storage desce; o que ele voltar a citar entra por
  // `tambemEmUso`. Ver admin/imagens.js.
  const publicado = clonar(carregarBaralho());
  const fotosPublicadas = fotosDoBaralho(publicado);
  // Publicadas, as fotos desta aba passam a ser do baralho da nuvem.
  esquecerRecemEnviadas(fotosPublicadas);
  const trocadas = [...fotosDoBaralho(antes)].filter((c) => !fotosPublicadas.has(c));
  const limpeza = await limparFotosSemUso(publicado, {
    semCarencia: trocadas,
    tambemEmUso: () => (estado.baralho ? fotosDoBaralho(estado.baralho) : new Set()),
  });
  if (limpeza.apagadas > 0) {
    aviso(`${limpeza.apagadas} foto(s) que nenhum veículo usa mais saíram do Firebase Storage.`);
  } else if (!limpeza.ok) {
    console.warn('limpeza do Storage não rodou:', limpeza.motivo);
  }
}

/** Relê quando o baralho foi salvo na nuvem, e redesenha o selo da barra. */
async function atualizarUltimaNuvem() {
  const info = await ultimaPublicacao();
  if (!app) return;
  estado.ultimaNuvem = info;
  atualizarChrome();
}

/* ---------------------------------------------------------- respostas ---- */

function trocarAba(aba) {
  if (estado.aba === aba) return;
  estado.aba = aba;
  if (aba === 'respostas' && !estado.respostas.carregado && !estado.respostas.carregando) atualizarRespostas();
  desenhar();
}

async function atualizarRespostas() {
  estado.respostas.carregando = true;
  if (estado.aba === 'respostas') desenhar();
  try {
    const r = await buscarRespostas();
    if (!app) return;
    // A partida grava o id da pergunta; a tabela e o CSV mostram o nome dela.
    const baralho = carregarBaralho();
    r.linhas = r.linhas.map((l) => ({ ...l, pergunta: rotuloDaPergunta(l.perguntaId, baralho) }));
    estado.respostas = { ...r, carregado: true, carregando: false };
  } catch (erro) {
    estado.respostas.carregando = false;
    aviso(`Não deu para carregar as respostas: ${erro?.message ?? erro}`, 'erro');
  }
  if (app && estado.aba === 'respostas') desenhar();
}

/**
 * A conta do Firebase — não a senha 2040 da porta. É a mesma que a porta
 * pede onde a nuvem alcança; daqui ela serve a quem entrou pela senha local
 * e ganhou rede depois. Ver a nota grande em `admin/respostas.js` sobre por
 * que o telefone exige uma conta de verdade.
 */
async function entrarComFirebase() {
  const dados = await pedirCredenciais({
    titulo: 'Entrar com a conta do Firebase',
    texto: 'Com a conta, o Salvar vale para todos os totens, as fotos vão para o Firebase Storage e a aba Respostas mostra o telefone.',
  });
  if (!dados) return;
  const r = await entrar(dados.email, dados.senha, { manter: dados.manter });
  if (!r.ok) {
    // O mesmo texto e o mesmo prazo do diagnóstico da porta: traz o código e
    // o que conferir, e não se lê em 6s.
    aviso(`Não entrou: ${descreverFalha(r)}`, 'erro', { ms: 12000 });
    return;
  }
  aviso(`Conectado como ${dados.email} — ${dados.manter ? 'mantido neste navegador' : 'até fechar esta aba'}.`);
  // A barra e a tabela são atualizadas pelo aoMudarOperador (montarAdmin), que
  // dispara sozinho quando o login muda.
}

async function sairComFirebase() {
  const ok = await confirmar({
    titulo: 'Sair da conta?',
    texto: `Você está conectado como ${estado.operador}. Sem a conta, o Salvar vale só neste navegador e a aba Respostas deixa de mostrar o telefone de quem jogou em outros totens.`,
    confirmarTexto: 'Sair da conta',
  });
  if (!ok) return;
  await sair();
  aviso('Você saiu da conta do Firebase.');
}

function baixarRespostas() {
  const { linhas, comTelefone } = estado.respostas;
  if (!linhas.length) {
    aviso('Não há dados para baixar.', 'erro');
    return;
  }
  const colunas = comTelefone ? COLUNAS : COLUNAS.filter((c) => c.chave !== 'telefone');
  const hoje = new Date().toISOString().slice(0, 10);
  baixarArquivo(`tecgame-respostas-${hoje}.csv`, paraCSV(linhas, colunas));
}

/* ---------------------------------------------------------- o baralho ---- */

async function descartar() {
  if (!(await confirmar({ titulo: 'Descartar alterações?', texto: 'Tudo volta a ser como estava no último Salvar.', perigoso: true, confirmarTexto: 'Descartar' }))) return;
  estado.baralho = clonar(carregarBaralho());
  estado.selecionado = Math.min(estado.selecionado, estado.baralho.slots.length - 1);
  estado.sujo = false;
  desenhar();
  aviso('Alterações descartadas.');
  soltarFotosSemUso();
}

/**
 * Zera a instalação: volta ao baralho de fábrica E apaga o que as partidas
 * deixaram gravado neste navegador (ranking e contatos).
 *
 * É o botão de antes da feira — inclusive para varrer as partidas de teste. O
 * que ele NÃO alcança está dito no próprio diálogo: o que já foi para o
 * Firebase só sai pelo console, porque as regras não dão apagar ao cliente.
 */
async function resetarTudo() {
  const ok = await confirmar({
    titulo: 'Resetar todos os dados?',
    texto:
      'Volta às perguntas de fábrica (dez veículos, uma pergunta cada) e apaga deste navegador o ranking e os telefones das partidas já jogadas. O que já foi salvo no Firebase continua lá — isso só se apaga pelo console do Firebase.',
    perigoso: true,
    confirmarTexto: 'Resetar tudo',
  });
  if (!ok) return;

  restaurarOriginal();
  removerChave('usuarios');
  removerChave('contatos');
  estado.baralho = clonar(BARALHO_ORIGINAL);
  estado.selecionado = 0;
  estado.pergunta = 0;
  estado.sujo = false;
  desenhar();
  aviso('Perguntas de fábrica de volta, e o ranking deste navegador apagado.');
  soltarFotosSemUso();
}

function adicionarRodada() {
  estado.baralho.slots.push(slotVazio());
  estado.selecionado = estado.baralho.slots.length - 1;
  estado.pergunta = 0;
  estado.sujo = true;
  desenhar();
  // O veículo novo está no fim da lista, e é o nome dele que se digita
  // primeiro.
  app.querySelector('.veiculo-campos .campo-entrada')?.focus();
  aviso('Veículo adicionado no fim da roleta. Dê um nome, escolha a foto e escreva a primeira pergunta.');
}

function adicionarPergunta(i) {
  const slot = estado.baralho.slots[i];
  slot.perguntas.push(perguntaVazia());
  estado.selecionado = i;
  estado.pergunta = slot.perguntas.length - 1;
  estado.sujo = true;
  desenhar();
  aviso('Pergunta nova no banco deste veículo. Preencha os três idiomas.');
}

function duplicarPergunta(i, j) {
  const slot = estado.baralho.slots[i];
  const copia = clonar(slot.perguntas[j]);
  copia.id = novoIdDePergunta();
  slot.perguntas.splice(j + 1, 0, copia);
  estado.selecionado = i;
  estado.pergunta = j + 1;
  estado.sujo = true;
  desenhar();
  aviso('Pergunta duplicada. A cópia está aberta.');
}

async function removerPergunta(i, j) {
  const slot = estado.baralho.slots[i];
  if (slot.perguntas.length <= 1) {
    aviso('Cada veículo precisa de pelo menos uma pergunta.', 'erro');
    return;
  }
  const resumo = resumoDaPergunta(slot.perguntas[j], j);
  if (
    !(await confirmar({
      titulo: 'Excluir pergunta?',
      texto: `"${resumo}" sai do banco de ${nomeDoVeiculo(i)}.`,
      perigoso: true,
      confirmarTexto: 'Excluir',
    }))
  ) {
    return;
  }
  slot.perguntas.splice(j, 1);
  estado.pergunta = Math.max(0, Math.min(j, slot.perguntas.length - 1));
  estado.sujo = true;
  desenhar();
}

/**
 * Liga/desliga uma pergunta. Desligada, ela fica no banco mas nunca cai em
 * partida — é como se guarda rascunho sem travar a publicação.
 */
function alternarPergunta(i, j, ativa) {
  const slot = estado.baralho.slots[i];
  slot.perguntas[j].ativa = ativa;
  estado.sujo = true;
  atualizarChrome();
}

function duplicarRodada(i) {
  const copia = clonar(estado.baralho.slots[i]);
  copia.veiculo.nome = `${copia.veiculo.nome} (cópia)`;
  estado.baralho.slots.splice(i + 1, 0, copia);
  estado.selecionado = i + 1;
  estado.pergunta = 0;
  estado.sujo = true;
  desenhar();
  aviso('Veículo duplicado logo abaixo do original.');
}

async function removerRodada(i) {
  if (estado.baralho.slots.length <= 1) {
    aviso('A roleta precisa de pelo menos um veículo.', 'erro');
    return;
  }
  if (!(await confirmar({ titulo: 'Excluir veículo?', texto: `"${nomeDoVeiculo(i)}" e as perguntas dele saem da roleta.`, perigoso: true, confirmarTexto: 'Excluir' }))) return;
  estado.baralho.slots.splice(i, 1);
  estado.selecionado = Math.max(0, Math.min(i, estado.baralho.slots.length - 1));
  estado.pergunta = 0;
  estado.sujo = true;
  desenhar();
  soltarFotosSemUso();
}

function mover(i, delta) {
  const j = i + delta;
  if (j < 0 || j >= estado.baralho.slots.length) return;
  const s = estado.baralho.slots;
  [s[i], s[j]] = [s[j], s[i]];
  estado.selecionado = j;
  estado.sujo = true;
  desenhar();
}

/** Abre o veículo e a pergunta onde um problema mora, na aba de idioma dele. */
function irParaProblema({ i, j, mensagem }) {
  fecharPopover();
  estado.aba = 'veiculos';
  estado.selecionado = i;
  estado.pergunta = j;
  const { idioma } = explicarProblema(mensagem);
  if (idioma) estado.idioma = idioma;
  desenhar();
  app.querySelector('.painel .tem-erro')?.scrollIntoView({ block: 'center' });
}

/* ------------------------------------------------------------------ telas -- */

/**
 * Tamanho do baralho em KB, como ele vai para o localStorage.
 *
 * Serve de aviso antecipado: sem isso o operador so descobre que passou da
 * cota na hora de publicar, depois de ter enviado dez fotos.
 */
function pesoDoBaralho() {
  try {
    return Math.round(JSON.stringify(estado.baralho).length / 1024);
  } catch (_) {
    return 0;
  }
}

/** Acima disso vale avisar: a cota tipica de localStorage fica em poucos MB. */
const PESO_DE_ATENCAO_KB = 3000;

/** "há 3 min", "há 2 h", "ontem" — quando foi a última gravação na nuvem. */
function faz(quando) {
  const s = Math.max(0, Math.round((Date.now() - quando.getTime()) / 1000));
  if (s < 60) return 'agora há pouco';
  const min = Math.round(s / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

/**
 * A situação do baralho, num selo só.
 *
 * Eram três, lado a lado — a gravação, "pronto para salvar" e a origem do
 * baralho —, e o operador não sabia qual ler. A pergunta que ele faz é uma só:
 * "preciso clicar em Salvar?". Problema vence alteração, que vence o "salvo";
 * o detalhe de quando e onde foi salvo mora no (?).
 */
function seloDaSituacao(total) {
  if (total > 0) return { tipo: 'erro', texto: total === 1 ? '1 problema' : `${total} problemas` };
  if (estado.sujo) return { tipo: 'suja', texto: 'Alterações não salvas' };

  const nuvem = estado.ultimaNuvem;
  if (nuvem?.quando) {
    return {
      tipo: 'ok',
      texto: `Salvo ${faz(nuvem.quando)}`,
      ajuda: `Gravado no Firebase em ${nuvem.quando.toLocaleString('pt-BR')}${nuvem.quem ? `, por ${nuvem.quem}` : ''}. Todo totem com internet já joga com este conteúdo.`,
    };
  }
  if (temBaralhoPublicado()) {
    return {
      tipo: 'neutra',
      texto: 'Salvo neste navegador',
      ajuda: 'Nada foi gravado no Firebase ainda: os outros totens não têm este conteúdo.',
    };
  }
  return {
    tipo: 'neutra',
    texto: 'Perguntas de fábrica',
    ajuda: 'Ninguém salvou nada ainda: o jogo usa as perguntas que vêm com ele.',
  };
}

/**
 * O selo de problemas é um botão: abre a lista do que falta, e cada linha leva
 * ao campo. Antes o operador lia "3 problema(s)" e caçava veículo por veículo.
 */
function seloDeProblemas(selo, itens, gerais) {
  const MAXIMO = 12;
  const abrir = (e) => {
    const linhas = itens.slice(0, MAXIMO).map((item) =>
      el(
        'button',
        { type: 'button', class: 'problema', onClick: () => irParaProblema(item) },
        [
          el('strong', {
            text: `${nomeDoVeiculo(item.i)}${(estado.baralho.slots[item.i]?.perguntas?.length ?? 0) > 1 ? ` · pergunta ${item.j + 1}` : ''}`,
          }),
          el('span', { text: explicarProblema(item.mensagem).texto }),
        ]
      )
    );
    abrirPopover(
      e.currentTarget,
      [
        el('div', { class: 'popover-titulo', text: 'O que falta para salvar' }),
        ...gerais.map((g) => el('p', { class: 'problema-geral', text: g })),
        el('div', { class: 'problemas' }, linhas),
        itens.length > MAXIMO ? el('p', { class: 'nota', text: `e mais ${itens.length - MAXIMO}…` }) : null,
      ],
      { rotulo: 'O que falta para salvar' }
    );
  };
  return el(
    'button',
    { type: 'button', class: 'situacao situacao-erro situacao-botao', 'aria-haspopup': 'dialog', onClick: abrir },
    [icone('alerta', { classe: 'situacao-icone' }), el('span', { text: selo.texto })]
  );
}

/**
 * Abre as notas de atualização e marca a versão atual como vista, para o
 * ponto do sininho sumir e ele não reabrir sozinho até a próxima versão.
 */
async function abrirNotas() {
  await mostrarNotas({ titulo: `Novidades do TecGame — v${VERSAO_DO_JOGO}`, notas: NOTAS_DE_ATUALIZACAO });
  marcarVersaoVista(VERSAO_DO_JOGO);
  atualizarChrome();
}

/** O sino da barra: sempre clicável, com um ponto quando há nota não vista. */
function sininho() {
  const novidade = temNovidade();
  return el(
    'button',
    {
      type: 'button',
      class: ['sininho', novidade ? 'com-novidade' : null],
      title: 'Novidades desta versão',
      'aria-label': novidade ? 'Novidades desta versão — ainda não vistas' : 'Novidades desta versão',
      onClick: abrirNotas,
    },
    [icone('sino'), novidade ? el('span', { class: 'sininho-ponto', 'aria-hidden': 'true' }) : null]
  );
}

/** As três abas do painel. Trocar de aba não perde o que a outra tinha. */
function abas() {
  const item = (aba, rotulo, nomeDoIcone) =>
    el(
      'button',
      {
        type: 'button',
        class: ['aba-painel', estado.aba === aba ? 'ativa' : null],
        role: 'tab',
        'aria-selected': estado.aba === aba ? 'true' : 'false',
        'data-aba': aba,
        onClick: () => trocarAba(aba),
      },
      [icone(nomeDoIcone), el('span', { text: rotulo })]
    );
  return el('nav', { class: 'abas-painel', role: 'tablist', 'aria-label': 'Seção do painel' }, [
    item('veiculos', 'Veículos', 'carro'),
    item('respostas', 'Respostas', 'grafico'),
    item('config', 'Configurações', 'engrenagem'),
  ]);
}

/**
 * Quem está conectado — ou o aviso de que ninguém está.
 *
 * Mora na barra, à vista de todas as abas, porque muda o que o Salvar faz: sem
 * login, ele grava só neste navegador. Antes o "Entrar" ficava escondido na
 * aba Respostas, e quem queria publicar para os outros totens não o achava.
 *
 * Quem entrou pela senha local vê o painel MARCADO aqui, e não pode deixar de
 * ver: é a promessa do modo local (ver porta.js).
 */
function conta() {
  if (estado.operador) {
    return el('div', { class: 'conta' }, [
      el(
        'button',
        {
          type: 'button',
          class: 'conta-botao',
          title: `Conectado ao Firebase como ${estado.operador}. Clique para sair da conta.`,
          onClick: sairComFirebase,
        },
        [
          el('span', { class: 'conta-avatar', 'aria-hidden': 'true', text: estado.operador.slice(0, 1).toUpperCase() }),
          el('span', { class: 'conta-email', text: estado.operador }),
        ]
      ),
    ]);
  }
  return el('div', { class: 'conta' }, [
    el('span', { class: 'situacao situacao-atencao' }, [
      'Sem login',
      ajuda(
        podeUsarNuvem()
          ? 'Você entrou pela senha local: o que salvar vale só neste navegador, e a foto enviada fica dentro do baralho. Clique em Entrar para usar a conta do Firebase.'
          : 'Este navegador não alcança o Firebase (jogo aberto do disco, localhost ou sem internet). O que salvar vale só aqui.',
        { rotulo: 'Sem login' }
      ),
    ]),
    podeUsarNuvem() ? botao('Entrar', { onClick: entrarComFirebase, acao: 'entrar' }) : null,
  ]);
}

/** O selo e os botões da aba Veículos. */
function acoesDeVeiculos() {
  const { total, itens, gerais } = agruparProblemas(estado.baralho);
  const peso = pesoDoBaralho();
  const selo = seloDaSituacao(total);

  return [
    // Só aparece quando há o que avisar.
    peso >= PESO_DE_ATENCAO_KB
      ? el('span', { class: 'situacao situacao-atencao' }, [
          `${peso} KB — perto do limite`,
          ajuda('O baralho vive no armazenamento do navegador, que tem poucos megabytes. Fotos enviadas do computador sem login são o que mais ocupa.', {
            rotulo: 'Perto do limite',
          }),
        ])
      : null,
    total > 0
      ? seloDeProblemas(selo, itens, gerais)
      : el('span', { class: `situacao situacao-${selo.tipo}` }, [selo.texto, selo.ajuda ? ajuda(selo.ajuda, { rotulo: selo.texto }) : null]),
    estado.sujo ? botao('Descartar', { onClick: descartar, titulo: 'Volta a como estava no último Salvar' }) : null,
    botao('Salvar', { onClick: publicar, tipo: 'primario', acao: 'salvar' }),
  ];
}

function acoesDeRespostas() {
  const { carregando, linhas } = estado.respostas;
  return [
    botao('Atualizar', { icone: 'atualizar', onClick: atualizarRespostas, titulo: 'Buscar as partidas de novo' }),
    botao('Baixar planilha', {
      icone: 'baixar',
      onClick: baixarRespostas,
      tipo: 'primario',
      disabled: carregando || !linhas.length,
      titulo: 'Um arquivo CSV, que abre no Excel',
    }),
  ];
}

function barra() {
  const acoes = estado.aba === 'veiculos' ? acoesDeVeiculos() : estado.aba === 'respostas' ? acoesDeRespostas() : [];
  return el('header', { class: 'barra' }, [
    el('div', { class: 'barra-interna' }, [
      el('div', { class: 'marca' }, [el('strong', { text: 'TecGame' }), el('span', { text: `administração · v${VERSAO_DO_JOGO}` })]),
      abas(),
      el('div', { class: 'barra-acoes' }, acoes),
      el('div', { class: 'barra-global' }, [
        sininho(),
        conta(),
        botao('Voltar ao jogo', { icone: 'voltar', onClick: voltarAoJogo, titulo: 'Fecha a administração e volta para a tela do jogador' }),
      ]),
    ]),
  ]);
}

/** Fecha o painel e leva o jogo direto para a Pergunta do Milhão. */
async function chamarMilhao(nome, qual) {
  if (estado.sujo) {
    const segue = await confirmar({
      titulo: 'Sair sem salvar?',
      texto: 'Há alterações no baralho que o totem ainda não recebeu. Chamar a Pergunta do Milhão agora as descarta.',
      confirmarTexto: 'Descartar e chamar',
      perigoso: true,
    });
    if (!segue) return;
    estado.baralho = clonar(carregarBaralho());
    estado.sujo = false;
    soltarFotosSemUso();
  }
  FFAppState.recarregarBaralho();
  const [i, j] = String(qual).split(':').map(Number);
  const escolha = qual === 'sorteio' || !Number.isInteger(i) ? milhaoAutomatico(FFAppState.baralho) : { slot: i, pergunta: j };
  FFAppState.milhao = { slot: escolha.slot, pergunta: escolha.pergunta, jogador: String(nome ?? '').trim().slice(0, 30) };
  fecharCamada?.();
  goNamed('milhao');
}

/* ------------------------------------------------------- a lista lateral -- */

/**
 * As miniaturas da lista, guardadas entre um redesenho e outro.
 *
 * A lista é refeita a cada tecla no editor (o selo de problema muda), e uma
 * `<img>` nova a cada vez piscava em branco antes de decodificar — com dez
 * fotos, a coluna inteira tremia enquanto se digitava. O mesmo nó, movido
 * para a lista nova, não pisca.
 */
const miniaturas = new Map();

function miniatura(i, src) {
  if (!src) return el('span', { class: 'item-miniatura item-miniatura-vazia', 'aria-hidden': 'true' }, icone('imagem'));
  const chave = `${i}|${src}`;
  let img = miniaturas.get(chave);
  if (!img) {
    img = el('img', { class: 'item-miniatura', src, alt: '', decoding: 'async' });
    miniaturas.set(chave, img);
  }
  return img;
}

/** "1 pergunta", "3 perguntas · 1 desligada". */
function contagem(perguntas) {
  const desligadas = perguntas.filter((p) => p.ativa === false).length;
  const n = perguntas.length;
  const base = n === 1 ? '1 pergunta' : `${n} perguntas`;
  if (!desligadas) return base;
  if (n === 1) return '1 pergunta, desligada';
  return `${base} · ${desligadas} desligada${desligadas > 1 ? 's' : ''}`;
}

/**
 * Os itens da lista: todos os veículos e, debaixo do aberto, o banco de
 * perguntas dele.
 *
 * Só o aberto mostra as perguntas. Com dez veículos e os bancos todos abertos
 * a lista virava um rolo, e cada linha de veículo carregava quatro botões
 * empilhados (subir, descer, duplicar, remover) — que agora moram, com nome,
 * no cabeçalho do editor.
 */
function itensDaLista() {
  const { porRodada, porPergunta } = agruparProblemas(estado.baralho);
  const usadas = new Set();

  const itens = estado.baralho.slots.flatMap((slot, i) => {
    const problemas = porRodada.get(i)?.length ?? 0;
    const perguntas = slot.perguntas ?? [];
    const aberto = i === estado.selecionado;
    usadas.add(`${i}|${slot.veiculo?.imagem}`);

    const cabeca = el(
      'li',
      { class: ['item', 'veiculo', aberto ? 'selecionado' : null, problemas ? 'com-problema' : null] },
      el(
        'button',
        {
          type: 'button',
          class: 'item-botao',
          'aria-current': aberto ? 'true' : null,
          onClick: () => {
            estado.selecionado = i;
            estado.pergunta = 0;
            desenhar();
          },
        },
        [
          miniatura(i, slot.veiculo?.imagem),
          el('span', { class: 'item-texto' }, [
            el('strong', {}, [
              el('span', { class: 'item-indice', text: `${i + 1}` }),
              el('span', { class: 'item-nome', text: slot.veiculo.nome?.trim() || '(sem nome)' }),
            ]),
            el('span', { class: 'item-pergunta', text: contagem(perguntas) }),
          ]),
          problemas
            ? el('span', { class: 'item-selo', title: `${problemas} problema(s) neste veículo`, text: String(problemas) })
            : null,
        ]
      )
    );

    if (!aberto) return [cabeca];

    const banco = perguntas.map((pergunta, j) => {
      const comProblema = porPergunta.get(`${i}:${j}`)?.length ?? 0;
      return el(
        'li',
        {
          class: [
            'item',
            'pergunta',
            j === estado.pergunta ? 'selecionado' : null,
            comProblema ? 'com-problema' : null,
            pergunta.ativa === false ? 'desligada' : null,
          ],
        },
        el(
          'button',
          {
            type: 'button',
            class: 'item-botao pq-botao',
            'aria-current': j === estado.pergunta ? 'true' : null,
            onClick: () => {
              estado.pergunta = j;
              desenhar();
            },
          },
          [
            el('span', { class: 'pq-numero', text: String(j + 1) }),
            el('span', { class: 'item-pergunta', text: resumoDaPergunta(pergunta, j) }),
            pergunta.ativa === false ? el('span', { class: 'pq-desligada', text: 'desligada' }) : null,
            comProblema ? el('span', { class: 'item-selo', text: String(comProblema) }) : null,
          ]
        )
      );
    });

    const acrescentar = el(
      'li',
      { class: 'item pergunta acrescentar' },
      botao('Nova pergunta', { icone: 'mais', tipo: 'discreto', titulo: `Mais uma pergunta para ${nomeDoVeiculo(i)}`, onClick: () => adicionarPergunta(i) })
    );

    return [cabeca, el('li', { class: 'banco' }, el('ul', {}, [...banco, acrescentar]))];
  });

  for (const chave of miniaturas.keys()) if (!usadas.has(chave)) miniaturas.delete(chave);
  return el('ul', { class: 'itens' }, itens);
}

function lista() {
  return el('aside', { class: 'lateral' }, [
    el('div', { class: 'lateral-topo' }, [
      el('h2', {}, [
        'Veículos',
        ajuda(
          'A ordem da lista é a ordem das fatias na roleta. Cada veículo pode ter várias perguntas: quando a roleta para nele, o jogo sorteia uma das ativas.',
          { rotulo: 'Veículos' }
        ),
      ]),
      botao('Novo veículo', { onClick: adicionarRodada, tipo: 'primario', icone: 'mais', acao: 'novo-veiculo' }),
    ]),
    el('div', { class: 'lateral-rolo' }, itensDaLista()),
  ]);
}

/** Troca só os itens da lista, mantendo onde ela estava rolada. */
function atualizarLista() {
  const ul = app.querySelector('.lateral-rolo > .itens');
  if (ul) ul.replaceWith(itensDaLista());
}

/* ---------------------------------------------------------- respostas ---- */

/**
 * A tabela de partidas. As colunas seguem `COLUNAS` de respostas.js; sem
 * telefone autenticado, a coluna nem aparece — em vez de vir vazia, que
 * insinuaria um dado perdido em vez de um dado que a conta atual não vê.
 */
function telaRespostas() {
  const { linhas, carregado, carregando, fonte, comTelefone } = estado.respostas;
  const colunas = comTelefone ? COLUNAS : COLUNAS.filter((c) => c.chave !== 'telefone');

  // O que eram três selos na barra virou uma linha em cima da tabela: diz de
  // onde vêm as partidas e se o telefone está na mistura.
  const resumo = el('p', { class: 'respostas-resumo' }, [
    linhas.length ? el('strong', { text: linhas.length === 1 ? '1 partida' : `${linhas.length} partidas` }) : null,
    fonte
      ? el('span', { class: 'respostas-fonte' }, [
          fonte === 'nuvem' ? 'de todos os totens' : 'só deste navegador',
          ajuda(
            fonte === 'nuvem'
              ? 'Lidas do Firebase: as partidas de qualquer totem com internet.'
              : 'A nuvem está desligada ou fora do alcance: só o que este navegador jogou aparece aqui.',
            { rotulo: 'De onde vêm as partidas' }
          ),
        ])
      : null,
    el('span', { class: 'respostas-telefone' }, [
      comTelefone ? 'com telefone' : 'sem telefone',
      comTelefone ? null : ajuda('Entre com a conta do Firebase (botão Entrar, no alto) para ver o telefone de quem jogou nos outros totens.', { rotulo: 'Sem telefone' }),
    ]),
  ]);

  const topo = el('div', { class: 'pagina-topo' }, [el('h2', { text: 'Respostas dos jogadores' }), resumo]);

  if (carregando && !carregado) {
    return el('main', { class: 'corpo corpo-respostas' }, [topo, el('p', { class: 'vazio', text: 'Carregando as partidas…' })]);
  }

  if (!linhas.length) {
    return el('main', { class: 'corpo corpo-respostas' }, [
      topo,
      el('div', { class: 'vazio' }, [
        icone('grafico', { classe: 'vazio-icone' }),
        el('strong', { text: 'Nenhuma partida ainda' }),
        el('span', { text: 'As respostas aparecem aqui assim que alguém jogar.' }),
      ]),
    ]);
  }

  return el('main', { class: 'corpo corpo-respostas' }, [
    topo,
    el('div', { class: 'tabela-rolo' }, [
      el('table', { class: 'tabela' }, [
        el('thead', {}, [el('tr', {}, colunas.map((c) => el('th', { text: c.rotulo })))]),
        el(
          'tbody',
          {},
          linhas.map((linha) => el('tr', {}, colunas.map((c) => el('td', { text: formatarCelula(c.chave, linha[c.chave]) }))))
        ),
      ]),
    ]),
  ]);
}

/* ------------------------------------------------------------ desenhar --- */

/**
 * Rola a lista (só ela) até o veículo aberto aparecer. `scrollIntoView` não
 * serve: na tela estreita a página inteira rola, e um clique em "Duplicar
 * pergunta", no editor, levaria a tela de volta para a lista.
 */
function mostrarSelecionadoNaLista() {
  const rolo = app.querySelector('.lateral-rolo');
  const item = rolo?.querySelector('.item.veiculo.selecionado');
  if (!rolo || !item) return;
  const r = rolo.getBoundingClientRect();
  const it = item.getBoundingClientRect();
  if (it.top < r.top) rolo.scrollTop -= r.top - it.top + 8;
  else if (it.bottom > r.bottom) rolo.scrollTop += it.bottom - r.bottom + 8;
}

function desenhar() {
  fecharPopover();
  // A lista é refeita junto com o resto, e nasceria rolada para o topo: quem
  // clicou no décimo veículo o perderia de vista.
  const rolagemDaLista = app.querySelector('.lateral-rolo')?.scrollTop ?? 0;
  limpar(app);
  app.appendChild(barra());

  if (estado.aba === 'respostas') {
    app.appendChild(telaRespostas());
    return;
  }
  if (estado.aba === 'config') {
    app.appendChild(telaConfiguracoes({ aoChamarMilhao: chamarMilhao, aoResetar: resetarTudo }));
    return;
  }

  const slot = estado.baralho.slots[estado.selecionado];
  // A pergunta aberta pode ter sumido (removida, ou veículo trocado); volta
  // para a primeira em vez de abrir vazio.
  if (slot && !slot.perguntas[estado.pergunta]) estado.pergunta = 0;
  const pergunta = slot?.perguntas?.[estado.pergunta];
  const i = estado.selecionado;
  const j = estado.pergunta;

  const editor =
    slot && pergunta
      ? editorDeSlot({
          slot,
          pergunta,
          indice: i,
          posicao: j,
          total: slot.perguntas.length,
          totalDeVeiculos: estado.baralho.slots.length,
          idioma: estado.idioma,
          onIdioma: (lang) => {
            estado.idioma = lang;
          },
          // O mesmo critério do Salvar: a conta real do Firebase, e não a
          // senha local — o Storage cobra `request.auth != null`.
          nuvemDeImagens: () => podeUsarNuvem() && Boolean(estado.operador),
          onChange: () => {
            estado.sujo = true;
            // Só a barra e a lista precisam reagir a cada tecla; redesenhar o
            // editor inteiro tiraria o foco do campo que está sendo digitado.
            atualizarChrome();
          },
          aoTrocarFoto: soltarFotosSemUso,
          acoes: {
            subir: () => mover(i, -1),
            descer: () => mover(i, 1),
            duplicarVeiculo: () => duplicarRodada(i),
            excluirVeiculo: () => removerRodada(i),
            duplicarPergunta: () => duplicarPergunta(i, j),
            excluirPergunta: () => removerPergunta(i, j),
            alternarAtiva: (ligada) => alternarPergunta(i, j, ligada),
          },
        })
      : el('p', { class: 'vazio', text: 'Nenhum veículo.' });

  const { porPergunta } = agruparProblemas(estado.baralho);
  editor.marcarErros?.(porPergunta.get(`${i}:${j}`) ?? []);

  app.appendChild(el('main', { class: 'corpo corpo-veiculos' }, [lista(), el('div', { class: 'painel' }, editor)]));
  app.__editor = editor;
  const rolo = app.querySelector('.lateral-rolo');
  if (rolo) rolo.scrollTop = rolagemDaLista;
  mostrarSelecionadoNaLista();
}

/**
 * Redesenha a barra e, na aba Veículos, a lista — preservando o foco no editor
 * e a rolagem da lista: redesenhar tudo tiraria o foco do campo em que se
 * digita, e a lista refeita voltava para o topo a cada tecla.
 *
 * Nas outras abas só a barra muda: a aba Configurações tem caixa de texto (o
 * nome da Pergunta do Milhão), e o selo de "salvo há…" chegando da nuvem não
 * pode apagar o que se digita ali. A tabela de Respostas se redesenha quando os
 * dados chegam (`atualizarRespostas`).
 */
function atualizarChrome() {
  fecharPopover();
  const barraAntiga = app.querySelector('.barra');
  if (barraAntiga) barraAntiga.replaceWith(barra());
  if (estado.aba !== 'veiculos') return;
  atualizarLista();
  const { porPergunta } = agruparProblemas(estado.baralho);
  app.__editor?.marcarErros?.(porPergunta.get(`${estado.selecionado}:${estado.pergunta}`) ?? []);
}

/* --------------------------------------------------------- montar e sair -- */

/** O que `porta.js` quer que aconteça quando o operador pede para sair. */
let fecharCamada = null;

/** Cancela a inscrição no login do Firebase, ao fechar a camada. */
let pararDeOuvirLogin = null;

/** Avisa o navegador antes de recarregar/fechar com edição por publicar. */
function aoDescarregar(e) {
  if (!estado.sujo) return;
  e.preventDefault();
  e.returnValue = '';
}

async function voltarAoJogo() {
  if (estado.sujo) {
    const segue = await confirmar({
      titulo: 'Sair sem salvar?',
      texto: 'Há alterações que o totem ainda não recebeu. Sair agora as descarta.',
      confirmarTexto: 'Sair e descartar',
      perigoso: true,
    });
    if (!segue) return;
    estado.baralho = clonar(carregarBaralho());
    estado.sujo = false;
    soltarFotosSemUso();
  }
  fecharCamada?.();
}

/**
 * Preenche `raiz` com a administração. `aoSair` é chamado quando o operador
 * clica em "Voltar ao jogo" — quem fecha a camada é o chamador, porque é ele
 * que sabe para onde o jogo volta.
 */
export function montarAdmin(raiz, { aoSair = null } = {}) {
  app = raiz;
  fecharCamada = aoSair;

  // O baralho é relido a cada abertura: entre uma e outra o jogo pode ter
  // salvo ou resetado, e abrir com a cópia velha faria o
  // operador salvar por cima sem perceber.
  //
  // Salvo com edição pendente. Fechar a camada pelo "voltar" do navegador é
  // síncrono e não dá para perguntar nada (ver porta.js); recarregar ali
  // apagaria o trabalho em silêncio. Então ele espera, e a barra continua
  // dizendo "alterações não salvas".
  if (!estado.baralho || !estado.sujo) {
    estado.baralho = clonar(carregarBaralho());
    estado.selecionado = 0;
    estado.pergunta = 0;
  }

  // Puxa o que está salvo na nuvem antes de deixar editar: sem isto o operador
  // editaria por cima de uma cópia velha e salvaria desfazendo o que outra
  // máquina salvou. Sem rede, segue com a cópia local.
  if (!estado.sujo) {
    sincronizarBaralho().then((mudou) => {
      if (mudou && app && !estado.sujo) {
        estado.baralho = clonar(carregarBaralho());
        if (estado.aba === 'veiculos') desenhar();
        aviso('Baralho atualizado com o que está salvo na nuvem.');
      }
    });
  }

  // Quando e de onde o baralho foi salvo na nuvem pela última vez. Sem
  // esperar: a barra nasce sem o selo e o ganha quando a resposta chega.
  atualizarUltimaNuvem();

  // Aviso honesto na primeira abertura: nada foi salvo ainda, e o que está na
  // tela é o conteúdo que veio com o jogo.
  if (!temBaralhoPublicado() && estado.baralho.slots.length === SLOTS_ORIGINAIS.length) {
    setTimeout(() => aviso('Você está vendo as perguntas de fábrica. Edite e clique em Salvar.'), 400);
  }

  // Novidade não vista: abre sozinho na primeira tela depois da versão mudar.
  // Fechar marca como visto (ver abrirNotas), então isto não repete a cada
  // abertura do painel — só quando a versão andar de novo.
  if (temNovidade()) {
    setTimeout(() => abrirNotas(), 350);
  }

  // O SDK restaura a sessão do Firebase de forma assíncrona, então a barra
  // nasce "sem login" e se corrige quando isto dispara. Se a aba Respostas já
  // tinha sido aberta (troca de conta em sessão longa), busca de novo — é o
  // login que decide se `contatos` entra na mistura.
  aoMudarOperador((email) => {
    estado.operador = email;
    if (!app) return;
    atualizarChrome();
    if (estado.respostas.carregado) atualizarRespostas();
  }).then((cancelar) => {
    pararDeOuvirLogin = cancelar;
  });

  window.addEventListener('beforeunload', aoDescarregar);
  desenhar();
}

/** Esvazia a camada e solta o que ela tinha preso no documento. */
export function desmontarAdmin() {
  window.removeEventListener('beforeunload', aoDescarregar);
  pararDeOuvirLogin?.();
  pararDeOuvirLogin = null;
  fecharPopover();
  miniaturas.clear();
  if (app) limpar(app);
  app = null;
  fecharCamada = null;
}
