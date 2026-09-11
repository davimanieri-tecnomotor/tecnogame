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
// Editar aqui não mexe no totem até você clicar em Publicar. Publicar grava o
// baralho, e o jogo o relê quando a próxima partida começa.

import { el, botao, aviso, confirmar, limpar, baixarArquivo, escolherArquivo } from './ui.js';
import { editorDeSlot } from './editor.js';
import {
  BARALHO_ORIGINAL,
  SLOTS_ORIGINAIS,
  carregarBaralho,
  publicarBaralho,
  restaurarOriginal,
  slotVazio,
  temBaralhoPublicado,
  usaArteOriginal,
  validarBaralho,
} from '../deck.js';
import { motivoDaFalha } from '../storage.js';

/* -------------------------------------------------------------- o estado -- */

/** Uma cópia funda: nada do que se edita aqui vaza para o jogo sem publicar. */
const clonar = (x) => JSON.parse(JSON.stringify(x));

// `baralho` nasce vazio e só é lido em `montarAdmin`. Este módulo entra no
// bundle do jogo (uma página só), e ler o armazenamento na hora do import
// faria todo jogador pagar por uma tela que ele nunca vai abrir.
const estado = {
  baralho: null,
  selecionado: 0,
  sujo: false,
};

/** A raiz que `montarAdmin` recebe. Fora da camada aberta, é null. */
let app = null;

/* -------------------------------------------------------------- validação -- */

/** Agrupa as mensagens de validarBaralho por rodada, que é como a UI mostra. */
function errosPorRodada(deck) {
  const todos = validarBaralho(deck);
  const porRodada = new Map();
  const gerais = [];
  for (const m of todos) {
    const n = m.match(/^rodada (\d+): (.*)$/);
    if (n) {
      const i = Number(n[1]) - 1;
      if (!porRodada.has(i)) porRodada.set(i, []);
      porRodada.get(i).push(n[2]);
    } else {
      gerais.push(m);
    }
  }
  return { total: todos.length, porRodada, gerais };
}

/* ------------------------------------------------------------------ ações -- */

async function publicar() {
  const { total, gerais, porRodada } = errosPorRodada(estado.baralho);
  if (total > 0) {
    const primeira = [...porRodada.keys()].sort((a, b) => a - b)[0];
    aviso(`${total} problema(s) impedem publicar. ${gerais[0] ?? ''}`.trim(), 'erro');
    if (primeira != null) {
      estado.selecionado = primeira;
      desenhar();
    }
    return;
  }

  const mudouArte = !usaArteOriginal(estado.baralho);
  const texto = mudouArte
    ? 'O baralho não usa mais os dez veículos originais, então a roleta será desenhada pelo jogo em vez de usar a arte pronta. A próxima partida no totem já usa este conteúdo.'
    : 'A próxima partida no totem já usa este conteúdo.';
  if (!(await confirmar({ titulo: 'Publicar para o totem?', texto, confirmarTexto: 'Publicar' }))) return;

  if (!publicarBaralho(estado.baralho)) {
    // "Cheio" e "recusado" pedem coisas opostas: um pede tirar imagem enviada,
    // o outro pede liberar o armazenamento do site. Dizer qual dos dois e.
    const motivo = motivoDaFalha();
    aviso(
      motivo === 'cheio'
        ? `Não caberia: o baralho está com cerca de ${pesoDoBaralho()} KB e o navegador não aceitou. Imagens enviadas do computador são o que mais ocupa — troque alguma por um caminho de arquivo em assets/images.`
        : 'Não foi possível gravar — o navegador está bloqueando o armazenamento deste site.',
      'erro'
    );
    return;
  }
  estado.sujo = false;
  aviso('Publicado. A próxima partida já usa este baralho.');
  desenhar();
}

async function descartar() {
  if (!(await confirmar({ titulo: 'Descartar alterações?', texto: 'Volta ao que está publicado no totem agora.', perigoso: true, confirmarTexto: 'Descartar' }))) return;
  estado.baralho = clonar(carregarBaralho());
  estado.selecionado = Math.min(estado.selecionado, estado.baralho.slots.length - 1);
  estado.sujo = false;
  desenhar();
  aviso('Alterações descartadas.');
}

async function voltarAoOriginal() {
  if (
    !(await confirmar({
      titulo: 'Restaurar o baralho de fábrica?',
      texto: 'Traz de volta as dez rodadas e os dez veículos originais, com a arte pronta da roleta. O que você publicou é perdido.',
      perigoso: true,
      confirmarTexto: 'Restaurar',
    }))
  ) {
    return;
  }
  restaurarOriginal();
  estado.baralho = clonar(BARALHO_ORIGINAL);
  estado.selecionado = 0;
  estado.sujo = false;
  desenhar();
  aviso('Baralho de fábrica restaurado.');
}

function adicionarRodada() {
  estado.baralho.slots.push(slotVazio());
  estado.selecionado = estado.baralho.slots.length - 1;
  estado.sujo = true;
  desenhar();
  aviso('Rodada adicionada. Preencha o veículo e os três idiomas.');
}

function duplicarRodada(i) {
  const copia = clonar(estado.baralho.slots[i]);
  copia.veiculo.nome = `${copia.veiculo.nome} (cópia)`;
  estado.baralho.slots.splice(i + 1, 0, copia);
  estado.selecionado = i + 1;
  estado.sujo = true;
  desenhar();
}

async function removerRodada(i) {
  if (estado.baralho.slots.length <= 1) {
    aviso('O baralho precisa de pelo menos uma rodada.', 'erro');
    return;
  }
  const nome = estado.baralho.slots[i].veiculo.nome || `rodada ${i + 1}`;
  if (!(await confirmar({ titulo: 'Remover rodada?', texto: `"${nome}" sai do baralho.`, perigoso: true, confirmarTexto: 'Remover' }))) return;
  estado.baralho.slots.splice(i, 1);
  estado.selecionado = Math.max(0, Math.min(i, estado.baralho.slots.length - 1));
  estado.sujo = true;
  desenhar();
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

function exportar() {
  const nome = `tecgame-baralho-${estado.baralho.slots.length}-rodadas.json`;
  baixarArquivo(nome, JSON.stringify(estado.baralho, null, 2));
  aviso(`Arquivo ${nome} salvo.`);
}

async function importar() {
  const arquivo = await escolherArquivo({ accept: '.json,application/json' });
  if (!arquivo) return;
  let deck;
  try {
    deck = JSON.parse(arquivo.texto);
  } catch (e) {
    aviso('O arquivo não é um JSON válido.', 'erro');
    return;
  }
  if (!deck || !Array.isArray(deck.slots) || deck.slots.length === 0) {
    aviso('O arquivo não parece um baralho do TecGame (falta a lista de rodadas).', 'erro');
    return;
  }
  estado.baralho = deck;
  estado.selecionado = 0;
  estado.sujo = true;
  desenhar();
  const { total } = errosPorRodada(deck);
  aviso(
    total ? `Importado com ${total} problema(s) a corrigir antes de publicar.` : 'Importado. Revise e publique.',
    total ? 'erro' : 'ok'
  );
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

function barra() {
  const publicado = temBaralhoPublicado();
  const { total } = errosPorRodada(estado.baralho);
  const peso = pesoDoBaralho();

  const situacao = estado.sujo
    ? { texto: 'alterações não publicadas', tipo: 'suja' }
    : publicado
      ? { texto: 'publicado no totem', tipo: 'ok' }
      : { texto: 'usando o baralho de fábrica', tipo: 'neutra' };

  return el('header', { class: 'barra' }, [
    el('div', { class: 'marca' }, [
      el('strong', { text: 'TecGame' }),
      el('span', { text: 'administração' }),
    ]),
    el('div', { class: 'barra-info' }, [
      el('span', { class: `situacao situacao-${situacao.tipo}`, text: situacao.texto }),
      el('span', { class: 'contador', text: `${estado.baralho.slots.length} rodadas` }),
      total > 0
        ? el('span', { class: 'situacao situacao-erro', text: `${total} problema(s)` })
        : el('span', { class: 'situacao situacao-ok', text: 'pronto para publicar' }),
      peso >= PESO_DE_ATENCAO_KB
        ? el('span', {
            class: 'situacao situacao-atencao',
            title: 'O baralho vive no armazenamento do navegador, que tem poucos megabytes. Imagens enviadas do computador são o que mais ocupa.',
            text: `${peso} KB — perto do limite`,
          })
        : null,
      !usaArteOriginal(estado.baralho)
        ? el('span', {
            class: 'situacao situacao-atencao',
            title: 'A arte pronta da roleta mostra os dez veículos originais; com outra lista o jogo desenha a roda.',
            text: 'roleta desenhada pelo jogo',
          })
        : null,
    ]),
    el('div', { class: 'barra-acoes' }, [
      botao('Importar', { onClick: importar, titulo: 'Carregar um baralho de um arquivo JSON' }),
      botao('Exportar', { onClick: exportar, titulo: 'Salvar este baralho num arquivo JSON' }),
      botao('Restaurar fábrica', { onClick: voltarAoOriginal, tipo: 'perigo' }),
      estado.sujo ? botao('Descartar', { onClick: descartar }) : null,
      botao('Publicar', { onClick: publicar, tipo: 'primario' }),
      botao('Voltar ao jogo', { onClick: voltarAoJogo, titulo: 'Fecha a administração e volta para a tela do jogador' }),
    ]),
  ]);
}

function lista() {
  const { porRodada } = errosPorRodada(estado.baralho);

  const itens = estado.baralho.slots.map((slot, i) => {
    const problemas = porRodada.get(i)?.length ?? 0;
    const nome = slot.veiculo.nome?.trim() || '(sem nome)';
    const pergunta = (slot.pt?.pergunta ?? '').trim();

    return el(
      'li',
      { class: ['item', i === estado.selecionado ? 'selecionado' : null, problemas ? 'com-problema' : null] },
      [
        el('button', {
          type: 'button',
          class: 'item-botao',
          onClick: () => {
            estado.selecionado = i;
            desenhar();
          },
        }, [
          el('span', { class: 'item-indice', text: String(i + 1) }),
          el('span', { class: 'item-texto' }, [
            el('strong', { text: nome }),
            el('span', { class: 'item-pergunta', text: pergunta ? pergunta.slice(0, 70) : 'sem enunciado' }),
          ]),
          problemas ? el('span', { class: 'item-selo', text: String(problemas) }) : null,
        ]),
        el('span', { class: 'item-acoes' }, [
          botao('', { icone: '↑', titulo: 'Subir', onClick: () => mover(i, -1) }),
          botao('', { icone: '↓', titulo: 'Descer', onClick: () => mover(i, 1) }),
          botao('', { icone: '⧉', titulo: 'Duplicar', onClick: () => duplicarRodada(i) }),
          botao('', { icone: '✕', titulo: 'Remover', tipo: 'perigo', onClick: () => removerRodada(i) }),
        ]),
      ]
    );
  });

  return el('aside', { class: 'lateral' }, [
    el('div', { class: 'lateral-topo' }, [
      el('h2', { text: 'Rodadas' }),
      botao('Adicionar', { onClick: adicionarRodada, tipo: 'primario', icone: '+' }),
    ]),
    el('p', { class: 'nota', text: 'A ordem é a ordem das fatias da roleta.' }),
    el('ul', { class: 'itens' }, itens),
  ]);
}

function desenhar() {
  limpar(app);
  app.appendChild(barra());

  const slot = estado.baralho.slots[estado.selecionado];
  const editor = slot
    ? editorDeSlot({
        slot,
        indice: estado.selecionado,
        onChange: () => {
          estado.sujo = true;
          // Só a barra e a lista precisam reagir a cada tecla; redesenhar o
          // editor inteiro tiraria o foco do campo que está sendo digitado.
          atualizarChrome();
        },
      })
    : el('p', { text: 'Nenhuma rodada.' });

  const { porRodada } = errosPorRodada(estado.baralho);
  editor.marcarErros?.(porRodada.get(estado.selecionado) ?? []);

  app.appendChild(el('main', { class: 'corpo' }, [lista(), el('div', { class: 'painel' }, editor)]));
  app.__editor = editor;
}

/** Redesenha só a barra e a lista, preservando o foco no editor. */
function atualizarChrome() {
  const barraAntiga = app.querySelector('.barra');
  const listaAntiga = app.querySelector('.lateral');
  if (barraAntiga) barraAntiga.replaceWith(barra());
  if (listaAntiga) listaAntiga.replaceWith(lista());
  const { porRodada } = errosPorRodada(estado.baralho);
  app.__editor?.marcarErros?.(porRodada.get(estado.selecionado) ?? []);
}

/* --------------------------------------------------------- montar e sair -- */

/** O que `porta.js` quer que aconteça quando o operador pede para sair. */
let fecharCamada = null;

/** Avisa o navegador antes de recarregar/fechar com edição por publicar. */
function aoDescarregar(e) {
  if (!estado.sujo) return;
  e.preventDefault();
  e.returnValue = '';
}

async function voltarAoJogo() {
  if (estado.sujo) {
    const segue = await confirmar({
      titulo: 'Sair sem publicar?',
      texto: 'Há alterações que o totem ainda não recebeu. Sair agora as descarta.',
      confirmarTexto: 'Sair e descartar',
      perigoso: true,
    });
    if (!segue) return;
    estado.baralho = clonar(carregarBaralho());
    estado.sujo = false;
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
  // publicado, importado ou restaurado, e abrir com a cópia velha faria o
  // operador republicar por cima sem perceber.
  //
  // Salvo com edição pendente. Fechar a camada pelo "voltar" do navegador é
  // síncrono e não dá para perguntar nada (ver porta.js); recarregar ali
  // apagaria o trabalho em silêncio. Então ele espera, e a barra continua
  // dizendo "alterações não publicadas".
  if (!estado.baralho || !estado.sujo) {
    estado.baralho = clonar(carregarBaralho());
    estado.selecionado = 0;
  }

  // Aviso honesto: o baralho vive no armazenamento DESTE navegador. Publicar
  // aqui não alcança outro computador enquanto o Firestore estiver desligado.
  if (!temBaralhoPublicado() && estado.baralho.slots.length === SLOTS_ORIGINAIS.length) {
    setTimeout(() => aviso('Você está vendo o baralho de fábrica. Edite e clique em Publicar.'), 400);
  }

  window.addEventListener('beforeunload', aoDescarregar);
  desenhar();
}

/** Esvazia a camada e solta o que ela tinha preso no documento. */
export function desmontarAdmin() {
  window.removeEventListener('beforeunload', aoDescarregar);
  if (app) limpar(app);
  app = null;
  fecharCamada = null;
}
