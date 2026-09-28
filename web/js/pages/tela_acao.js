// A tela da pergunta — reescrita na 3.0 com cara de programa de auditório.
//
// O porte do FlutterFlow (lib/pages/acao/tela_acao) dividia a tela em duas
// metades: o defeito numa moldura à esquerda e, à direita, uma janela que
// imitava o software do scanner, com barra de título, cartões cinza e um
// cronômetro digital `00:58.27`. Funcionava, e parecia aplicativo. Agora a
// tela é um palco, e a pergunta é um roteiro, na ordem em que o jogador vive:
//
//   1. o painel liga — o cenário entra, o conta-giros varre a escala e volta,
//      e se ouve um motor dando a partida;
//   2. "POSSO PERGUNTAR?" — o relógio só começa quando o jogador diz PODE!;
//      antes ele começava enquanto as alternativas ainda entravam;
//   3. a pergunta entra sozinha, e as alternativas chegam uma a uma;
//   4. "VALENDO!" — e só então o relógio corre;
//   5. tocar numa alternativa a TRAVA no lugar: "ESTÁ CERTO DISSO?", com o
//      relógio ainda correndo (é o aperto);
//   6. SIM, É ESSA! — o relógio para, o estúdio apaga, um canhão de luz cai na
//      alternativa, e 2,6s de batimento antes do veredito;
//   7. o veredito: acerto (festa, e o ranking abrindo espaço para o jogador),
//      erro (a lição: a certa e onde aprender) ou tempo esgotado.
//
// Dois estilos, escolhidos pelo operador no painel (ver palco.js):
//
//   classico  a coluna do Show do Milhão de 2000 — logo, pergunta e as quatro
//             alternativas empilhadas à esquerda; à direita o "palco", onde na
//             TV ficava o participante e aqui fica o veículo. É o padrão: é o
//             que o público da feira reconhece de longe;
//   palco     o terço inferior com losangos, a gramática do Milionário.
//
// Os dois têm as mesmas peças; muda o arranjo (ESTILOS, abaixo) e a paleta
// (auditorio.css, `[data-estilo]`).
//
// MUDANÇA DELIBERADA sobre o porte: o Dart lia `respostaQuatro` da lista em
// inglês quando o embaralhamento punha a resposta 3 na primeira posição — a
// primeira alternativa mostrava, em inglês, o texto da quarta. O porte
// reproduzia o defeito por fidelidade; numa tela reescrita não havia por que
// mantê-lo, e ele saiu.

import { el, fonte, valueOrDefault } from '../widgets.js';
import { entrar, menosMovimento } from '../anim.js';
import { FFLocalizations } from '../i18n.js';
import { T, Tf } from '../textos.js';
import { FFAppState } from '../state.js';
import { goNamed } from '../router.js';
import { addUsuario, createUsuariosRecordData } from '../backend.js';
import { formatarSegundos, formatarTempoDeResposta } from '../functions.js';
import { tique } from '../audio.js';
import { Som, Trilha, audioEm } from '../som.js';
import { aproximar, estiloDaPergunta, estiloEmCena, flash, humor, soco, tremer } from '../palco.js';
import { confete, faiscas, fumaca, noPalco } from '../particulas.js';
import { criarRoteiro, soInterrupcao } from '../roteiro.js';
import { grito, painel, raios } from '../locutor.js';
import { quandoNaTela } from '../ajuste.js';
import { registrarComandos } from '../comandos.js';
import { rankingAdiantado, votosDaPergunta } from '../estatisticas.js';
import { putRecord } from '../storage.js';
import { QrSvg } from '../qr.js';
import { SeloComLampadas } from '../components/selo.js';
import { OrdemDeServico } from '../components/ordem_de_servico.js';
import { Tacometro } from '../components/tacometro.js';
import { Aposta, posicaoAgora } from '../components/aposta.js';
import { Alternativas, QuadroDaPergunta } from '../components/alternativas.js';
import { Ajudas } from '../components/ajudas.js';
import { BotaoDeAuditorio } from '../components/botao.js';
import { EQUIPAMENTO_PADRAO, EQUIPAMENTO_PULADO } from '../components/ferramenta.js';

/** O relógio da pergunta: 60s, como sempre foi. */
const TOTAL_MS = 60000;
/** A reta final começa nos 15s que faltam — onde a luz fica vermelha. */
const RETA_MS = 15000;
/** Os tiques de segundo começam nos 10s que faltam. */
const TIQUE_MS = 10000;
/**
 * O suspense antes do veredito: 2,6s, longo o bastante para o batimento
 * acelerar cinco vezes; mais que isso, e a fila da feira sente. E depois 150ms
 * de silêncio — o "sleep" do Nijman: é ele que faz a pancada seguinte parecer
 * alta.
 */
const SUSPENSE_MS = 2600;
const FOLEGO_MS = 150;
/** Quanto o painel do resultado espera antes de seguir sozinho para o fim. */
const SEGUE_SOZINHO_MS = { acerto: 12000, licao: 16000 };

/** A posição → o campo da resposta no baralho. */
const RESPOSTA_FIELD = { 1: 'respostaUm', 2: 'respostaDois', 3: 'respostaTres', 4: 'respostaQuatro' };

/**
 * As medidas de cada estilo, em px do palco. O CSS resolve cores e o que não
 * muda; aqui fica o que o JS usa para desenhar e para mirar luz e câmera.
 */
export const ESTILOS = {
  classico: {
    selo: { x: 425, y: 10, largura: 230 },
    pergunta: { x: 60, y: 226, w: 960, h: 214, ponta: 0, raio: 22, trilhos: false, texto: [30, 22] },
    opcoes: { w: 960, h: 94, ponta: 0, raio: 16, pos: [[60, 462], [60, 566], [60, 670], [60, 774]], trilhos: false, texto: [26, 18], lados: false },
    aposta: { x: 60, y: 894, largura: 960 },
    os: { x: 1100, y: 236, escala: 1.22 },
    tacometro: { x: 1566, y: 14, tamanho: 296 },
    ajudas: { x: 1104, y: 846, largura: 800 },
    spot: [760, 200],
    painel: { x: 1440, ponta: 0, raio: 30 },
    posso: { largura: 760, altura: 330, y: 360 },
    certo: { largura: 760, altura: 340, y: 350 },
    resultado: { largura: 760, altura: 420, y: 320 },
    licao: { largura: 780, altura: 470, y: 300 },
    cartao: { x: 1052, y: 300, w: 820, h: 450 },
    gritoY: 250,
    gritoFinal: 'translate(-420px, -220px) scale(.42)',
  },
  palco: {
    selo: { x: 842, y: 18, largura: 236 },
    pergunta: { x: 150, y: 568, w: 1620, h: 184, ponta: 44, raio: 0, trilhos: true, texto: [34, 24] },
    opcoes: { w: 795, h: 110, ponta: 38, raio: 0, pos: [[150, 782], [975, 782], [150, 914], [975, 914]], trilhos: true, texto: [27, 19], lados: true },
    aposta: { x: 1402, y: 404, largura: 400 },
    os: { x: 64, y: 58, escala: 1 },
    tacometro: { x: 1416, y: 28, tamanho: 370 },
    ajudas: { x: 632, y: 236, largura: 772 },
    spot: [560, 250],
    painel: { x: 960, ponta: 60, raio: 0 },
    posso: { largura: 920, altura: 330, y: 212 },
    certo: { largura: 890, altura: 326, y: 206 },
    resultado: { largura: 900, altura: 400, y: 140 },
    licao: { largura: 900, altura: 450, y: 100 },
    cartao: { x: 500, y: 96, w: 920, h: 450 },
    gritoY: 250,
    gritoFinal: 'translateY(-226px) scale(.45)',
  },
};

/**
 * O equipamento que vai para o registro da partida.
 *
 * Quem pulou a escolha joga com o padrão na tela (ver `pages/scanner.js`), mas
 * não escolheu nada — e esta coluna existe para o time saber o que a feira
 * escolhe. Gravar o padrão como escolha inventaria interesse que não houve.
 */
const equipamentoDaPartida = () => (FFAppState.equipamentoPulado ? EQUIPAMENTO_PULADO : FFAppState.scannerEscolhido);

/**
 * A rodada desta partida, pronta para a tela: a pergunta no idioma em vigor, as
 * respostas na ordem embaralhada, e o que precisa ser gravado depois.
 */
export function rodadaDaPartida() {
  const i = FFAppState.indiceAtual;
  const pt = FFAppState.questoesBrasil[i];
  const en = FFAppState.questoesEnglish[i];
  const es = FFAppState.questoesSpanish[i];
  const texto = (campo) =>
    FFLocalizations.getVariableText({ ptText: valueOrDefault(pt?.[campo], ''), esText: es?.[campo], enText: en?.[campo] });
  const ordem = [...FFAppState.ordemNumeros];
  const gabarito = String(pt?.gabarito ?? '');
  return {
    modo: 'normal',
    perguntaId: pt?.id ?? '',
    gabarito,
    video: pt?.video ?? '',
    enunciado: valueOrDefault(texto('pergunta'), 'Pergunta'),
    respostas: ordem.map((n, k) => valueOrDefault(texto(RESPOSTA_FIELD[n]), `${T('alternativa')} ${k + 1}`)),
    ordem,
    slotCerto: ordem.findIndex((n) => String(n) === gabarito),
    ajudas: Object.fromEntries(
      ['ajudaApoio', 'ajudaTreinamentoEad', 'ajudaTecnomotorTv', 'ajudaComunidade', 'ajudaRepresentanteComercial'].map((c) => [c, texto(c)])
    ),
    veiculo: FFAppState.slotAtual?.veiculo ?? { nome: pt?.nome ?? '', imagem: '' },
    equipamento: FFAppState.scannerEscolhido || EQUIPAMENTO_PADRAO,
  };
}

export function TelaAcaoWidget() {
  return montarPergunta(rodadaDaPartida());
}

/**
 * Monta a tela da pergunta para uma rodada. A Pergunta do Milhão (pages/milhao.js)
 * usa a mesma tela com `rodada.modo === 'milhao'`: sem ajudas, valendo brinde,
 * e sem entrar no ranking.
 *
 * @param {object} rodada ver `rodadaDaPartida`
 * @param {object} [opcoes]
 * @param {Function} [opcoes.aoTerminar] o que fazer no fim (Milhão); por padrão, a tela de fim
 */
export function montarPergunta(rodada, { aoTerminar = null } = {}) {
  const estilo = estiloDaPergunta();
  const E = ESTILOS[estilo];
  const milhao = rodada.modo === 'milhao';
  const roteiro = criarRoteiro();

  estiloEmCena(estilo);
  humor(milhao ? 'milhao' : 'normal');
  // A bandeira do Dart que ninguém lia; a reta final a liga de novo.
  FFAppState.tempoAcabando = false;

  /* ------------------------------------------------------------- estado -- */

  let estado = 'cenario';
  let ranking = [];
  let restante = TOTAL_MS;
  let t0 = 0;
  let correndo = false;
  let retaFinal = false;
  let ultimoTique = null;
  let ocioso = 0;
  let travada = null;
  let fecharPergunta = null;
  let aoPrincipal = null;

  /* ------------------------------------------------------------- a cena --- */

  const cena = el('div', { class: 'pg-cena' });
  const spot = el('div', { class: 'pg-spot' });
  const tremorNo = el('div', { class: 'pg-tremor' }, [cena, spot]);
  const cameraNo = el('div', { class: 'pg-camera' }, tremorNo);
  const vinheta = el('div', { class: 'pg-vinheta' });
  const pulso = el('div', { class: 'pg-pulso' });
  const locutor = el('div', { class: 'pg-locutor' });

  const root = el(
    'div',
    { class: ['ff-scaffold', 'pg-auditorio', milhao ? 'pg-milhao' : null], dataEstiloPergunta: estilo },
    [cameraNo, vinheta, pulso, locutor]
  );
  const mudar = (novo) => {
    estado = novo;
    root.dataset.estadoPergunta = novo;
  };
  mudar('cenario');

  const selo = SeloComLampadas({ largura: E.selo.largura });
  selo.classList.add('aud-oculta', 'pg-selo');
  Object.assign(selo.style, { left: `${E.selo.x}px`, top: `${E.selo.y}px` });

  const os = OrdemDeServico({ veiculo: rodada.veiculo, equipamento: rodada.equipamento, medidas: E.os, semEquipamento: milhao });
  const tac = Tacometro({ tamanho: E.tacometro.tamanho });
  Object.assign(tac.no.style, { left: `${E.tacometro.x}px`, top: `${E.tacometro.y}px` });

  let aposta = null;
  const montarAposta = () => {
    aposta = Aposta({ ranking, milhao, aoTrocarPosicao: () => Som.blip(0, false) });
    Object.assign(aposta.no.style, { left: `${E.aposta.x}px`, top: `${E.aposta.y}px`, width: `${E.aposta.largura}px` });
    return aposta.no;
  };

  const quadro = QuadroDaPergunta({ texto: rodada.enunciado, medidas: E.pergunta });
  const alt = Alternativas({ textos: rodada.respostas, medidas: E.opcoes, estilo, aoTocar: (i) => tocarOpcao(i) });

  const aj = milhao
    ? null
    : Ajudas({
        textos: rodada.ajudas,
        medidas: E.ajudas,
        cartao: E.cartao,
        camada: locutor,
        roteiro,
        ordem: rodada.ordem,
        votos: votosDaPergunta(rodada.perguntaId),
        podeUsar: () => estado === 'jogando',
        aoAbrir: () => mudar('ajuda'),
        aoFechar: () => {
          if (estado === 'ajuda') mudar('jogando');
        },
        erradasEmCena: () => [0, 1, 2, 3].filter((k) => k !== rodada.slotCerto && alt.disponivel(k)),
        eliminar: (indices) => alt.eliminar(indices),
      });

  cena.append(selo, os.no, tac.no, quadro.no, ...alt.trilhos, ...alt.nos);
  if (aj) cena.append(aj.no);

  quandoNaTela(root, () => {
    quadro.ajustar();
    alt.ajustar();
  });

  /* ----------------------------------------------------------- o roteiro -- */

  async function entrarCenario() {
    entrar(selo, [{ opacity: 0, transform: 'translateY(-30px) scale(.8)' }, { opacity: 1, transform: 'none' }], {
      duration: 520,
      easing: 'cubic-bezier(.2,1.2,.4,1)',
    });
    os.entrar();
    // Só opacidade no mostrador: ver o cabeçalho de tacometro.js.
    entrar(tac.no, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 200, easing: 'ease-out' });
    if (aposta) {
      entrar(aposta.no, [{ opacity: 0, transform: 'translateX(60px)' }, { opacity: 1, transform: 'none' }], {
        duration: 460,
        delay: 520,
        easing: 'ease-out',
      });
    }
    Som.ronco(0.32, 1.3);
    await roteiro.pausa(360);
    tac.varredura(roteiro).catch(soInterrupcao);
    if (aj) await aj.entrar(roteiro);
    await roteiro.pausa(milhao ? 400 : 700);
  }

  function possoPerguntar() {
    return new Promise((ok) => {
      let feito = false;
      const pode = () => {
        if (feito) return;
        feito = true;
        aoPrincipal = null;
        p.fechar();
        Som.impacto(0, 0.55);
        Som.whoosh(0, 0.3, 0.2);
        ok();
      };
      const conteudo = [
        el('div', { class: 'ff-text aud-painel-titulo', text: milhao ? T('perguntaDoMilhao') : T('possoPerguntar') }),
        el('div', { class: 'ff-text aud-painel-sub', text: milhao ? T('semAjudasNoMilhao') : T('possoPerguntarSub'), style: { fontSize: fonte(21) } }),
        el('div', { class: 'aud-painel-botoes' }, BotaoDeAuditorio(T('pode'), { pulsa: true, acao: 'pode', aoTocar: pode })),
      ];
      // Abaixo do selo, e não por cima dele: o logo cortado pela metade atrás
      // do painel parecia defeito.
      const p = painel(locutor, { x: E.painel.x, ...E.posso, ponta: E.painel.ponta, raio: E.painel.raio, conteudo, chave: 'posso' });
      aoPrincipal = pode;
      Som.whoosh(0, 0.35, 0.16);
      Som.sino(392, 0.12, 0.09);
      Som.sino(523.25, 0.24, 0.09);
    });
  }

  async function roteiroDeAbertura() {
    try {
      // O ranking chega antes: a roleta o pediu (ver estatisticas.js). Sem ele
      // em 600ms, a faixa nasce com o que houver — e se ele chegar depois, ela
      // se corrige.
      if (!milhao) {
        const pedido = rankingAdiantado();
        let chegou = false;
        ranking = await roteiro.aguardar(
          Promise.race([pedido.then((r) => ((chegou = true), r)), new Promise((ok) => setTimeout(() => ok([]), 600))])
        );
        if (!chegou) {
          pedido.then((r) => {
            if (!roteiro.vivo || !Array.isArray(r) || !r.length) return;
            // Depois do veredito a faixa já recuou, e o resultado usa o que havia.
            if (['suspense', 'revelado', 'esgotado', 'saindo'].includes(estado)) return;
            ranking = r;
            aposta?.trocarRanking(r);
          });
        }
      }
      cena.appendChild(montarAposta());
      await entrarCenario();
      if (milhao && rodada.jogador) {
        // A Pergunta do Milhão chama o jogador de volta ao palco pelo nome.
        Som.aplauso(0, 1.6, 0.6);
        grito(locutor, T('comVoces'), { cor: 'branco', tam: 60, y: E.gritoY - 30, segura: 900, chave: 'comVoces' }, roteiro).catch(soInterrupcao);
        await roteiro.pausa(160);
        await grito(locutor, `${rodada.jogador.toUpperCase()}!`, { tam: 140, y: E.gritoY + 60, segura: 700, chave: 'nome' }, roteiro);
      }
      mudar('posso');
      await possoPerguntar();
      mudar('apresentando');
      await quadro.abrir(roteiro);
      await alt.entrar(roteiro);
      Som.impacto(0.02, 0.9);
      await grito(locutor, T('valendo'), { tam: 170, y: E.gritoY, segura: 360, chave: 'valendo' }, roteiro);
      t0 = performance.now();
      correndo = true;
      Trilha.iniciar();
      mudar('jogando');
    } catch (erro) {
      soInterrupcao(erro);
    }
  }

  /* ------------------------------------------------------- as escolhas ---- */

  /** Cada trava é uma vez; a resposta de uma trava velha não mexe na nova. */
  let vez = 0;

  function destravar() {
    travada = null;
    alt.destravar();
    Trilha.abafar(false);
    mudar('jogando');
  }

  async function tocarOpcao(i) {
    if (estado === 'travando' && travada != null && i !== travada && alt.disponivel(i)) {
      // Outro botão com o painel aberto: troca de ideia sem o NÃO no meio — é o
      // que o botão físico de quatro cores pede. Destrava AGORA, e não quando a
      // resposta do painel velho chegar: essa chega depois, e a trava nova já
      // tem de valer.
      const fechar = fecharPergunta;
      destravar();
      fechar?.(false);
    }
    if (estado !== 'jogando' || !alt.disponivel(i)) return;
    const minhaVez = ++vez;
    mudar('travando');
    travada = i;
    alt.travar(i);
    Som.travar();
    Trilha.abafar(true);
    const sim = await estaCertoDisso(i);
    if (minhaVez !== vez || estado !== 'travando' || !roteiro.vivo) return;
    if (!sim) {
      destravar();
      return;
    }
    confirmar(i).catch(soInterrupcao);
  }

  function estaCertoDisso(i) {
    return new Promise((ok) => {
      let feito = false;
      const responder = (sim) => {
        if (feito) return;
        feito = true;
        fecharPergunta = null;
        aoPrincipal = null;
        p.fechar();
        if (!sim) Som.whoosh(0, 0.25, 0.12, false);
        ok(sim);
      };
      const conteudo = [
        el('div', { class: 'ff-text aud-painel-titulo aud-painel-titulo--ouro', text: T('estaCertoDisso') }),
        el('div', { class: 'aud-escolhida' }, [
          el('b', { text: String(i + 1) }),
          el('span', { class: 'ff-text', text: rodada.respostas[i], style: { fontSize: fonte(22) } }),
        ]),
        el('div', { class: 'aud-painel-botoes' }, [
          BotaoDeAuditorio(T('simEEssa'), { acao: 'sim', aoTocar: () => responder(true) }),
          BotaoDeAuditorio(T('nao'), { tipo: 'prata', acao: 'nao', aoTocar: () => responder(false) }),
        ]),
      ];
      // No palco, 890 de largura: mais que isso a ponta direita cobre o
      // "ACERTAR AGORA", que é justamente o que o jogador deve olhar agora.
      const p = painel(locutor, { x: E.painel.x, ...E.certo, ponta: E.painel.ponta, raio: E.painel.raio, conteudo, chave: 'certo' });
      fecharPergunta = responder;
      aoPrincipal = () => responder(true);
    });
  }

  /* ---------------------------------------------------------- o veredito -- */

  function pararRelogio() {
    if (correndo) restante = restanteEm(performance.now());
    correndo = false;
    tac.definir(restante);
  }

  async function confirmar(i) {
    mudar('suspense');
    pararRelogio();
    const acertou = i === rodada.slotCerto;
    const gasto = TOTAL_MS - restante;
    // O resultado está decidido: grava JÁ, antes do suspense. Se a tela sair no
    // meio da festa (o prazo de inatividade, o operador), a partida fica.
    registrar({ acertou, escolhida: i });
    tac.parar();
    Som.clunk();
    Trilha.parar(0.25);
    root.style.setProperty('--tensao', '0');
    humor('suspense');
    const [cx, cy] = alt.centro(i);
    spot.style.setProperty('--spot-x', `${cx}px`);
    spot.style.setProperty('--spot-y', `${cy}px`);
    spot.style.setProperty('--spot-rx', `${E.spot[0]}px`);
    spot.style.setProperty('--spot-ry', `${E.spot[1]}px`);
    spot.classList.add('ligado');
    const camera = aproximar(cameraNo, cx, cy, 1.06, SUSPENSE_MS);
    const sus = Som.suspense(SUSPENSE_MS / 1000);
    sus.batidas.forEach((b) => roteiro.depois(b * 1000, () => alt.pulsar(i)));
    try {
      await roteiro.pausa(SUSPENSE_MS);
    } finally {
      sus.cortar(0.03);
    }
    await roteiro.pausa(FOLEGO_MS);
    spot.classList.remove('ligado');
    if (acertou) await acerto(i, gasto, camera);
    else await erro(i, camera);
  }

  async function acerto(i, gasto, camera) {
    mudar('revelado');
    camera.soltar(520);
    soco(tremorNo, 1.022, 460);
    flash('#fff', 0.8, 380);
    humor('acerto');
    alt.certa(i);
    alt.esfriar([i]);
    Som.impacto(0, 0.9);
    Som.fanfarra(0.02);
    Som.aplauso(0.3, 3.6);
    confete({ x: 40, y: 1080, angulo: -62 });
    confete({ x: 1880, y: 1080, angulo: -118 });
    const [cx, cy] = alt.centro(i);
    faiscas({ x: cx, y: cy, n: 46 });
    const r = raios(locutor, { y: E.gritoY + 50 });
    const g = await grito(locutor, milhao ? T('ganhouOBrinde') : T('certaResposta'), { tam: 124, y: E.gritoY, segura: 1300, fica: true, chave: 'certa' }, roteiro);
    if (!menosMovimento()) {
      g.animate([{ transform: 'none' }, { transform: E.gritoFinal }], { duration: 560, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' });
    } else {
      g.style.opacity = '0';
    }
    recuarCenario();
    r.animate([{ opacity: 1 }, { opacity: 0.35 }], { duration: 560, fill: 'forwards' });
    await roteiro.pausa(380);
    await resultado(gasto);
  }

  async function erro(i, camera) {
    mudar('revelado');
    camera.soltar(300);
    flash('#ff1a1a', 0.5, 420);
    tremer(tremorNo, 18, 520);
    alt.errada(i);
    Som.derrota(0);
    humor('erro');
    await roteiro.pausa(950);
    alt.esfriar([i, rodada.slotCerto]);
    alt.certa(rodada.slotCerto);
    Som.sino(783.99, 0, 0.13);
    Som.sino(1046.5, 0.12, 0.12);
    await grito(locutor, T('quePena'), { cor: 'vermelho', tam: 124, y: E.gritoY, segura: 900, chave: 'quePena' }, roteiro);
    licao();
  }

  async function esgotar() {
    if (!['jogando', 'travando', 'ajuda'].includes(estado)) return;
    mudar('esgotado');
    correndo = false;
    restante = 0;
    tac.definir(0);
    fecharPergunta?.(false);
    aj?.fechar();
    aj?.travar();
    alt.destravar();
    Trilha.parar(0.08);
    root.style.setProperty('--tensao', '0.35');
    tac.estourar();
    const [gx, gy] = noPalco(tac.no.querySelector('.aud-taco-face') ?? tac.no);
    fumaca({ x: gx, y: gy - 20 });
    faiscas({ x: gx, y: gy, n: 30, cores: ['#FFB35C', '#FF5A1F', '#FFFFFF'] });
    Som.alarme(0);
    Som.estouro(0.04);
    flash('#ff2a1a', 0.45, 440);
    tremer(tremorNo, 12, 520);
    humor('erro');
    registrar({ acertou: false, escolhida: null });
    try {
      await grito(locutor, T('tempoEsgotado'), { cor: 'vermelho', tam: 112, y: E.gritoY, segura: 1000, chave: 'esgotado' }, roteiro);
      alt.esfriar([rodada.slotCerto]);
      alt.certa(rodada.slotCerto);
      Som.sino(783.99, 0, 0.13);
      await roteiro.pausa(500);
      licao();
    } catch (e) {
      soInterrupcao(e);
    }
  }

  /** O selo e a faixa saem de cena: o painel do resultado e o grito ocupam o alto. */
  function recuarCenario() {
    selo.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
    aposta?.recuar();
  }

  /* --------------------------------------------------- gravar a partida --- */

  /**
   * Grava a partida NO VEREDITO, antes de qualquer animação: local primeiro,
   * sempre (ver `addUsuario`), para a partida não sumir se a tela sair no meio
   * da festa. E escreve `FFAppState.resultado`, que a tela de fim lê.
   */
  function registrar({ acertou, escolhida }) {
    const certo = rodada.slotCerto;
    FFAppState.resultado = {
      acertou,
      tempo: restante,
      esgotou: escolhida == null,
      numeroCerto: certo >= 0 ? certo + 1 : null,
      textoCerto: certo >= 0 ? rodada.respostas[certo] : null,
      numeroEscolhido: escolhida != null ? escolhida + 1 : null,
      textoEscolhido: escolhida != null ? rodada.respostas[escolhida] : null,
      perguntaId: rodada.perguntaId,
      video: rodada.video,
      dica: rodada.ajudas.ajudaTecnomotorTv ?? '',
      milhao,
    };
    if (milhao) {
      // A Pergunta do Milhão não entra no ranking nem nas Placas: é uma rodada
      // extra, com outra regra. Fica no próprio navegador, para o operador
      // saber quem levou o brinde.
      putRecord('milhao', {
        nome: rodada.jogador ?? '',
        perguntaId: rodada.perguntaId,
        venceu: acertou,
        tempo: restante,
        data: new Date().toISOString(),
      });
      return;
    }
    addUsuario(
      createUsuariosRecordData({
        nome: FFAppState.cadastro.nome,
        telefone: FFAppState.cadastro.telefone,
        atuacao: FFAppState.cadastro.atuacao,
        venceu: acertou,
        // Tempo esgotado não tem tempo: é como o Dart gravava, e o ranking só
        // lê o de quem venceu.
        tempo: escolhida == null ? null : restante,
        equipamento: equipamentoDaPartida(),
        invalido: FFAppState.cadastro.invalido,
        perguntaId: rodada.perguntaId || null,
        alternativa: escolhida != null ? rodada.ordem[escolhida] : null,
      }),
      { serverTimestamp: true }
    ).catch((e) => console.warn('não deu para gravar a partida', e));
  }

  /* ------------------------------------------- o resultado e a lição ------ */

  function botaoContinuar(tipo) {
    const texto = milhao ? T('voltarAoJogo') : T('continuar');
    const seguir = () => {
      if (estado === 'saindo') return;
      mudar('saindo');
      aoPrincipal = null;
      if (aoTerminar) aoTerminar(FFAppState.resultado);
      else goNamed(FFAppState.resultado?.acertou ? 'Ganhou' : 'Perdeu');
    };
    const b = BotaoDeAuditorio(texto, { menor: true, acao: 'continuar', aoTocar: seguir });
    // A barra que enche no botão: o jogador vê que a tela vai seguir sozinha.
    const espera = SEGUE_SOZINHO_MS[tipo];
    b.botao.style.setProperty('--espera', `${espera}ms`);
    b.botao.classList.add('aud-botao--contando');
    roteiro.depois(espera, seguir);
    aoPrincipal = seguir;
    return b;
  }

  async function resultado(gasto) {
    const minha = milhao ? null : posicaoAgora(ranking, TOTAL_MS - gasto);
    const tempoNo = el('b', { class: 'ff-text', text: '0,0 s', style: { fontSize: fonte(56) } });
    const lista = el('div', { class: 'aud-lista' });
    const ALT = 40;
    const linhas = ranking.slice(0, 5).map((v, k) => {
      const n = el('div', { class: 'aud-linha', style: { top: `${k * ALT}px` } }, [
        el('span', { class: 'ff-text aud-linha-p', text: `${k + 1}º` }),
        el('span', { class: 'ff-text aud-linha-n', text: (v.nome ?? '').toUpperCase().slice(0, 14) }),
        el('span', { class: 'ff-text aud-linha-t', text: formatarTempoDeResposta(v.tempo) }),
      ]);
      lista.appendChild(n);
      return n;
    });
    const conteudo = [
      el('div', { class: 'aud-tempo-final' }, [el('small', { class: 'ff-text', text: T('resolvidoEm'), style: { fontSize: fonte(16) } }), tempoNo]),
      milhao ? null : lista,
      el('div', { class: 'aud-painel-botoes' }, botaoContinuar('acerto')),
    ];
    painel(locutor, { x: E.painel.x, ...E.resultado, ponta: E.painel.ponta, raio: E.painel.raio, conteudo, chave: 'resultado', classe: 'aud-painel--resultado' });
    linhas.forEach((n, k) =>
      entrar(n, [{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 200 + k * 60, easing: 'ease-out' })
    );

    // O odômetro: o tempo sobe até o valor final, estalando como marcador.
    Som.rolagem(0.15, 18, 0.9);
    const inicio = performance.now() + 150;
    await roteiro.aguardar(
      new Promise((ok) => {
        const passo = (agora) => {
          if (!roteiro.vivo) return ok();
          const u = Math.max(0, Math.min(1, (agora - inicio) / 900));
          tempoNo.textContent = formatarSegundos(gasto * (1 - Math.pow(1 - u, 3)));
          if (u < 1) requestAnimationFrame(passo);
          else ok();
        };
        requestAnimationFrame(passo);
      })
    );
    Som.sino(1046.5, 0, 0.1);
    await roteiro.pausa(350);
    if (milhao || minha > 5) return;

    // O ranking abre espaço: quem está atrás desce uma linha e troca de número,
    // o último cai fora, e o jogador entra voando na vaga.
    linhas.forEach((n, k) => {
      if (k < minha - 1) return;
      const sai = k === linhas.length - 1 && linhas.length >= 5;
      const atraso = (k - minha + 1) * 50;
      n.animate([{ transform: 'none', opacity: 1 }, { transform: `translateY(${ALT}px)`, opacity: sai ? 0 : 1 }], {
        duration: 380,
        delay: atraso,
        easing: 'cubic-bezier(.3,.9,.3,1)',
        fill: 'forwards',
      });
      const p = n.querySelector('.aud-linha-p');
      roteiro.depois(atraso + 160, () => {
        p.textContent = `${k + 2}º`;
        if (!menosMovimento()) p.animate([{ transform: 'rotateX(90deg)' }, { transform: 'none' }], { duration: 240, easing: 'ease-out' });
      });
    });
    Som.whoosh(0, 0.35, 0.14);
    await roteiro.pausa(300);
    const eu = el('div', { class: 'aud-linha aud-linha--eu', dataEu: '1', style: { top: `${(minha - 1) * ALT}px` } }, [
      el('span', { class: 'ff-text aud-linha-p', text: `${minha}º` }),
      el('span', { class: 'ff-text aud-linha-n', text: T('voce') }),
      el('span', { class: 'ff-text aud-linha-t', text: formatarSegundos(gasto) }),
    ]);
    lista.appendChild(eu);
    entrar(
      eu,
      [
        { transform: 'translateX(620px) scale(1.15)', opacity: 0 },
        { transform: 'translateX(-14px) scale(1.04)', opacity: 1, offset: 0.7 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 520, easing: 'cubic-bezier(.2,.9,.3,1)' }
    );
    Som.whoosh(0, 0.3, 0.16);
    Som.sino(783.99, 0.35, 0.12);
    Som.sino(1046.5, 0.47, 0.12);
    Som.sino(1318.5, 0.59, 0.12);
    await roteiro.pausa(520);
    const [ex, ey] = noPalco(eu);
    faiscas({ x: ex, y: ey, n: 36 });
  }

  /** Quem errou leva embora a resposta — e onde aprender. É o ponto do jogo. */
  function licao() {
    recuarCenario();
    const certo = rodada.slotCerto;
    const qr = rodada.video ? QrSvg(rodada.video, { tamanho: 150 }) : null;
    const conteudo = [
      el('div', { class: 'ff-text aud-painel-titulo aud-painel-titulo--menor', text: Tf('aCertaEra', { n: certo + 1 }) }),
      el('div', { class: 'aud-escolhida aud-escolhida--verde' }, [
        el('b', { text: String(certo + 1) }),
        el('span', { class: 'ff-text', text: rodada.respostas[certo] ?? '', style: { fontSize: fonte(22) } }),
      ]),
      el('div', { class: 'aud-licao-tv' }, [
        qr ? el('div', { class: 'aud-licao-qr', dataQr: '1' }, qr) : el('img', { src: 'assets/images/TecnmotorTV.png', alt: 'TecnomotorTV', draggable: 'false' }),
        el('div', {}, [
          el('small', { class: 'ff-text', text: T('aprendaNaTv'), style: { fontSize: fonte(14) } }),
          el('p', { class: 'ff-text', text: rodada.ajudas.ajudaTecnomotorTv ?? '', style: { fontSize: fonte(20) } }),
          qr ? el('p', { class: 'ff-text aud-licao-aponte', text: T('aprendaAponte'), style: { fontSize: fonte(15) } }) : null,
        ]),
      ]),
      el('div', { class: 'aud-painel-botoes' }, botaoContinuar('licao')),
    ];
    painel(locutor, { x: E.painel.x, ...E.licao, ponta: E.painel.ponta, raio: E.painel.raio, conteudo, chave: 'licao', classe: 'aud-painel--licao' });
  }

  /* ----------------------------------------------------------- o quadro --- */

  let quadroId = 0;
  let ultimoQuadro = performance.now();

  /** O que sobra no relógio, entre 0 e 60s. */
  const restanteEm = (agora) => Math.min(TOTAL_MS, Math.max(0, TOTAL_MS - (agora - t0)));

  function aCadaQuadro() {
    // A hora vem do `performance.now`, e não do carimbo que o
    // requestAnimationFrame entrega: `t0` saiu dele, e os dois relógios só
    // concordam enquanto ninguém mexe no primeiro — a suíte o acelera (ver
    // verify/dialogs.mjs), e aí o relógio da pergunta passaria de 60s.
    const agora = performance.now();
    const dt = Math.min(0.05, Math.max(0, (agora - ultimoQuadro) / 1000));
    ultimoQuadro = agora;
    tac.animar(dt);
    if (correndo) {
      restante = restanteEm(agora);
      tac.definir(restante);
      aposta?.atualizar(restante);
      tensao(restante);
      marcarTique(restante);
      if (estado === 'jogando') {
        ocioso += dt;
        if (ocioso > 2.8) {
          ocioso = 0;
          alt.brilhoOcioso();
        }
      }
      if (restante <= 0) esgotar();
    }
    quadroId = requestAnimationFrame(aCadaQuadro);
  }

  /**
   * A reta final: a luz fica vermelha, a vinheta fecha e a trilha sobe de
   * andamento — 96, 112, 132 bpm. É o que o ouvido percebe como "está
   * acabando" sem ninguém olhar o relógio.
   */
  function tensao(r) {
    Trilha.definirNivel(r > 30000 ? 0 : r > RETA_MS ? 1 : 2);
    if (r <= RETA_MS && !retaFinal) {
      retaFinal = true;
      FFAppState.tempoAcabando = true;
      humor('reta');
      Som.impacto(0, 0.5);
      flash('#ff2a1a', 0.25, 500);
    }
    root.style.setProperty('--tensao', (r > RETA_MS ? 0 : (1 - r / RETA_MS) * 0.85).toFixed(3));
  }

  /**
   * Os tiques dos últimos dez segundos, marcados no relógio do áudio na divisa
   * exata do segundo, e não no quadro que a mostra — o quadro arredonda para a
   * grade de 16ms, e o ritmo manca (a lição da roleta, ver o CLAUDE.md). O
   * tique sobe meio tom a cada segundo; nos três últimos entra um grave.
   */
  function marcarTique(r) {
    const divisa = Math.floor((r - 1) / 1000) * 1000;
    if (divisa <= 0 || divisa > TIQUE_MS || divisa === ultimoTique) return;
    const falta = r - divisa;
    if (falta > 120) return;
    ultimoTique = divisa;
    const seg = divisa / 1000;
    tique({ frequencia: 880 + (10 - seg) * 30, duracao: 0.06, volume: seg <= 3 ? 0.16 : 0.11, quando: audioEm(performance.now() + falta) });
    if (seg <= 3) Som.bumbo(falta / 1000, 0.35, 120, 50, 0.25);
    roteiro.depois(falta, () => {
      if (!menosMovimento()) pulso.animate([{ opacity: 0 }, { opacity: seg <= 3 ? 1 : 0.7, offset: 0.15 }, { opacity: 0 }], { duration: 620, easing: 'ease-out' });
    });
  }

  quadroId = requestAnimationFrame(aCadaQuadro);

  /* ----------------------------------------------- teclado e controle ----- */

  const desligarComandos = registrarComandos({
    aceita: (tipo) => tipo !== 'escolher' || estado === 'jogando' || estado === 'travando',
    escolher: (i) => tocarOpcao(i),
    principal: () => aoPrincipal?.(),
    cancelar: () => {
      if (estado === 'travando') fecharPergunta?.(false);
      else if (estado === 'ajuda') aj?.fechar();
    },
  });

  roteiroDeAbertura();

  root.__dispose = () => {
    roteiro.encerrar();
    cancelAnimationFrame(quadroId);
    desligarComandos();
    Trilha.parar(0.2);
    correndo = false;
  };

  return root;
}
