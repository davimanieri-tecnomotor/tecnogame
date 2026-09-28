// Port of lib/pages/escolha/roleta/roleta_widget.dart
//
// The prize wheel. Pressing GIRAR draws a new `escolha` (1.0 - 1.9, never one
// of the last five), spins the wheel by that many turns, remembers the draw and
// moves on to the selected car.
//
// O sorteio e a navegacao sao os do Dart. O que a roda FAZ enquanto gira nao e:
// a fisica do giro, a seta batendo nas divisas, o estalo de cada uma, o borrao
// e a luz que nao gira junto moram em giro.js, e esta tela so monta as pecas e
// as entrega a ele.
//
// NA 3.0, duas coisas:
//
//   - GIRAR COM O DEDO. Arrastar a roda e soltar gira; a força do gesto escolhe
//     quantas voltas inteiras a mais ela dá e quanto tempo dura (giroDoGesto).
//     Enquanto o dedo arrasta, a seta bate e estala em cada divisa. O botão
//     continua, e é o que o botão físico e o teclado apertam;
//   - A FESTA DO "PAROU!". A seta é fixa, então a fatia vencedora para sempre
//     no mesmo lugar, embaixo: o destaque é uma forma PARADA desenhada ali. Ela
//     acende, o aro pisca, toca um ding-ding-ding, saem faíscas, e o nome do
//     carro aparece — no segundo e meio antes de o jogo abrir a tela dele.
//
// E a roleta é quem pede o ranking que a pergunta vai precisar (ver
// estatisticas.js): daqui até lá passam o carro, a escolha e o vídeo.

import {
  Align,
  ClipRRect,
  Column,
  Container,
  Img,
  InkWell,
  Padding,
  Stack,
  StackAlign,
  Txt,
  color,
  el,
  linearGradient,
  px,
  unfocus,
} from '../widgets.js';
import { style } from '../theme.js';
import { L } from '../i18n.js';
import { T } from '../textos.js';
import { FFAppState } from '../state.js';
import { numeroAleatorio } from '../functions.js';
import { usaArteOriginal } from '../deck.js';
import { rodaGerada } from '../roda.js';
import { criarVida, efeitosDoGiro, giroDoGesto } from '../giro.js';
import { criarEstalos } from '../audio.js';
import { Som } from '../som.js';
import { adiantarRanking } from '../estatisticas.js';
import { faiscas, noPalco } from '../particulas.js';
import { registrarComandos } from '../comandos.js';
import { goNamed } from '../router.js';
import {
  AnimationInfo,
  AnimationTrigger,
  Curves,
  FadeEffect,
  ScaleEffect,
  animateOnActionTrigger,
  animateOnPageLoad,
  delayed,
  entrar,
  menosMovimento,
} from '../anim.js';

/**
 * Quanto a tela espera depois de a roda parar: 1,6s. Era 1s, e cabia só o
 * estalo de luz do aro; agora cabem o ding-ding-ding (0,55s) e o nome do carro
 * lido com calma.
 */
const DEPOIS_DE_PARAR_MS = 1600;

export function RoletaWidget() {
  const model = { apertaButton: true };
  // O giro leva 5s e só então navega. Se a tela sair nesse meio-tempo (o botão
  // Voltar do navegador, ou o endereço trocado à mão), a navegação de dentro do
  // `onTap` chegaria depois e arrancaria o jogador de onde ele estivesse. É o
  // mesmo guarda que as outras telas de espera usam.
  let left = false;

  const animationsMap = {
    columnOnPageLoadAnimation: new AnimationInfo({
      trigger: AnimationTrigger.onPageLoad,
      effectsBuilder: () => [
        ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 600.0, begin: [5.0, 5.0], end: [1.0, 1.0] }),
        FadeEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 600.0, begin: 0.0, end: 1.0 }),
      ],
    }),
    // effectsBuilder is null in the Dart: the spin's effects are supplied at
    // the animateOnActionTrigger call site so they can read FFAppState().escolha.
    containerOnActionTriggerAnimation1: new AnimationInfo({
      trigger: AnimationTrigger.onActionTrigger,
      applyInitialState: true,
      effectsBuilder: null,
    }),
    containerOnActionTriggerAnimation2: new AnimationInfo({
      trigger: AnimationTrigger.onActionTrigger,
      applyInitialState: true,
      effectsBuilder: () => [
        ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 200.0, begin: [1.0, 1.0], end: [0.9, 0.9] }),
        ScaleEffect({ curve: Curves.easeInOut, delay: 200.0, duration: 200.0, begin: [0.9, 0.9], end: [1.0, 1.0] }),
      ],
    }),
  };

  // A arte da roleta e um PNG com as dez fatias ja desenhadas, uma por veiculo.
  // Ela continua valendo enquanto a lista de veiculos for a original — mexer so
  // no texto das perguntas nao invalida o desenho. Fora disso a roda e gerada,
  // porque o PNG mostraria carros que nao estao mais em jogo.
  // O Dart declara a roda com 836.1x946 e a arte com 864.3x893.2, mas o Stack
  // que a contem tem 839.8 de altura, e no Flutter um filho nunca passa da
  // restricao que recebe: a caixa que aparece na tela e 836.1x839.8. Declarar
  // os numeros crus aqui fazia a roda estourar o Stack, que recorta com
  // Clip.hardEdge — sumiam ~50px do fundo do disco e, junto, a seta inteira,
  // que se alinha pelo fundo do Stack. Entao a caixa ja entra resolvida.
  const RODA_LARGURA = 836.1;
  const RODA_ALTURA = 839.8;

  const arteOriginal = usaArteOriginal(FFAppState.baralho);
  const arte = arteOriginal
    ? ClipRRect({
        borderRadius: 20.0,
        child: Img('assets/images/Roleta.png', { width: RODA_LARGURA, height: RODA_ALTURA, fit: 'cover' }),
      })
    : rodaGerada(FFAppState.baralho?.slots ?? [], { largura: RODA_LARGURA, altura: RODA_ALTURA });

  /**
   * Onde o disco acaba dentro da caixa, em pixels de RAIO.
   *
   * A luz e a unica coisa desta tela que precisa saber disso: ela e um desenho
   * parado por cima do disco, e uma vinheta de aro fora de lugar aparece como
   * um anel escuro solto em cima da arte.
   *
   * Sao dois numeros porque sao duas rodas. A arte pronta e um PNG de 766x730
   * encaixado com `cover` numa caixa de 836,1x839,8: ele sobe para 1,1504 e
   * sobra pelos lados, e sai levemente OVAL — os valores vem de medir o disco
   * no proprio arquivo. A roda desenhada e redonda e sai da geometria de
   * roda.js (R_FATIA e R_LUZ sobre o viewBox, encaixados com `meet`).
   */
  const DISCO = arteOriginal
    ? { raioX: 380.6, raioY: 368.0, aroX: 398.0, aroY: 384.8 }
    : { raioX: 383.2, raioY: 383.2, aroX: 400.7, aroY: 400.7 };

  /** Uma camada de luz: do tamanho da caixa da roda e sabendo onde o aro esta. */
  const camadaDeLuz = (classe) => {
    const no = el('div', {
      class: `roleta-camada ${classe}`,
      'aria-hidden': 'true',
      style: { width: px(RODA_LARGURA), height: px(RODA_ALTURA) },
    });
    no.style.setProperty('--disco-x', `${DISCO.raioX}px`);
    no.style.setProperty('--disco-y', `${DISCO.raioY}px`);
    no.style.setProperty('--aro-x', `${DISCO.aroX}px`);
    no.style.setProperty('--aro-y', `${DISCO.aroY}px`);
    return no;
  };

  // Atras do disco: a sombra que ele joga na caixa e o halo morno das lampadas,
  // que respira sozinho para a roda parada nao parecer desligada.
  const fundo = camadaDeLuz('roleta-fundo');
  // Na frente: o brilho especular, a sombra de forma e a vinheta do aro. Elas
  // NAO giram — e por elas que o disco vira objeto em vez de figura girando.
  const luz = camadaDeLuz('roleta-luz');
  // O arco de luz que ronda o aro, como roleta de parque. Ele so existe se o
  // navegador souber recortar por mascara: e a mascara que o prende ao aro, e
  // sem ela o cone de luz lavaria o disco inteiro.
  const temMascara =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    (CSS.supports('mask-image', 'radial-gradient(#000, transparent)') ||
      CSS.supports('-webkit-mask-image', 'radial-gradient(#000, transparent)'));
  const ronda = temMascara ? camadaDeLuz('roleta-ronda') : null;
  // O acender do giro, que o giro.js controla pela velocidade.
  const faisca = camadaDeLuz('roleta-faisca');

  /**
   * A fatia vencedora, acesa. É uma forma PARADA: a seta é fixa embaixo, então
   * a fatia que ganhou para sempre no mesmo lugar — um gomo de 360/N graus
   * centrado no fundo da roda. Ela só aparece no "parou!".
   */
  const vencedora = (() => {
    const n = Math.max(FFAppState.totalSlots || 1, 1);
    const cx = RODA_LARGURA / 2;
    const cy = RODA_ALTURA / 2;
    const meia = Math.PI / n;
    const rx = DISCO.raioX;
    const ry = DISCO.raioY;
    // 90° na conta = o fundo da roda (y cresce para baixo).
    const ponto = (a) => `${(cx + rx * Math.cos(a)).toFixed(1)} ${(cy + ry * Math.sin(a)).toFixed(1)}`;
    const a0 = Math.PI / 2 - meia;
    const a1 = Math.PI / 2 + meia;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'roleta-camada roleta-vencedora');
    svg.setAttribute('width', String(RODA_LARGURA));
    svg.setAttribute('height', String(RODA_ALTURA));
    svg.setAttribute('viewBox', `0 0 ${RODA_LARGURA} ${RODA_ALTURA}`);
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML =
      `<path d="M${cx} ${cy}L${ponto(a0)}A${rx} ${ry} 0 0 1 ${ponto(a1)}Z" fill="rgba(255, 240, 180, .55)" ` +
      'stroke="#fff6cc" stroke-width="6" stroke-linejoin="round"/>';
    return svg;
  })();

  // A pista guarda a arte e, so enquanto a roda corre, as copias do borrao.
  const pista = el('div', { class: 'roleta-pista' }, arte);

  const wheel = Container({
    width: RODA_LARGURA,
    height: RODA_ALTURA,
    color: color(0x00FFFFFF),
    borderRadius: 22.0,
    alignment: [0.0, 0.0],
    child: pista,
  });
  // O eixo fica FORA do disco porque o `transform` do disco e do motor de
  // animacao: o bamboleio precisa de uma caixa so dele para nao brigar com ele.
  const eixo = el('div', { class: 'roleta-eixo' }, wheel);

  /** As opções do giro em curso: o que o gesto pediu e de onde a roda parte. */
  let opcoesDoGiro = {};
  // `effects:` is read when forward() runs, so the rotation always uses the
  // value drawn a moment earlier.
  animateOnActionTrigger(wheel, animationsMap.containerOnActionTriggerAnimation1, null);
  animationsMap.containerOnActionTriggerAnimation1.effectsBuilder = () =>
    // Seis segundos de tela inteira girando é exatamente o que quem pediu menos
    // movimento no sistema não quer ver. Sem efeito nenhum o `forward()`
    // resolve na hora, e o jogo segue para o carro sorteado: o resultado do
    // sorteio é o mesmo, a roda só não gira.
    menosMovimento() ? [] : efeitosDoGiro(FFAppState.escolha, FFAppState.totalSlots, opcoesDoGiro);

  /**
   * O nome do carro que ganhou, sobre a parte de baixo da roda, logo acima da
   * seta — onde o olho já está quando a roda para.
   */
  const faixaDoNome = el('div', { class: 'roleta-parou aud-oculta', 'aria-live': 'polite' });

  /** Gira a roda — pelo botão (as opções de sempre) ou pelo dedo (as do gesto). */
  async function girar(opcoes = {}) {
    if (!model.apertaButton || left) return;
    model.apertaButton = false;
    opcoesDoGiro = { ...opcoes, inicio: vida.posicao };
    FFAppState.escolha = numeroAleatorio([...FFAppState.listaEscolhas], FFAppState.totalSlots);
    // Este `await` E sequencia: e o giro inteiro, e o jogo so segue depois.
    // O `girar()` vem logo atras porque ele LE a animacao que o `forward()`
    // acabou de criar: a seta bate na divisa que a tela esta mostrando, e o
    // estalo segue o relogio dessa mesma animacao, e nao o do toque.
    const giro = animationsMap.containerOnActionTriggerAnimation1.controller.forward();
    vida.girar(FFAppState.escolha, opcoesDoGiro);
    await giro;
    if (left || !root.isConnected) return;
    comemorar();
    // Sem movimento não há festa para caber: a espera volta ao segundo de antes.
    await delayed(menosMovimento() ? 1000 : DEPOIS_DE_PARAR_MS);
    if (left || !root.isConnected) return;

    // Keep a rolling window of the last five draws so the same car can't come
    // up again too soon.
    if (FFAppState.listaEscolhas.length >= 5) {
      FFAppState.removeFromListaEscolhas(FFAppState.listaEscolhas[0]);
    }
    FFAppState.addToListaEscolhas(FFAppState.escolha);

    model.apertaButton = true;
    goNamed('carroSleecionado');
  }

  /**
   * "Parou!": a fatia acende, o aro pisca junto, ding-ding-ding, faíscas na
   * seta e o nome do carro. Todo som daqui é de oscilador: a tela da roleta é
   * onde o verify/estalo.mjs conta os estalos da roda, e um ruído gravado aqui
   * seria contado como estalo (ver o cabeçalho de som.js).
   */
  function comemorar() {
    Som.dingDingDing(0.05);
    faisca.classList.add('roleta-faisca--festa');
    entrar(vencedora, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0.55, offset: 0.45 }, { opacity: 1 }], { duration: 700 });
    vencedora.classList.add('acesa');
    faixaDoNome.textContent = FFAppState.slotAtual?.veiculo?.nome ?? '';
    entrar(faixaDoNome, [{ opacity: 0, transform: 'translate(-50%, -50%) scale(.6)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }], {
      duration: 420,
      delay: 180,
      easing: 'cubic-bezier(.2,1.3,.4,1)',
    });
    const [x, y] = noPalco(seta);
    faiscas({ x, y: y - 30, n: 42 });
  }

  const spinButton = InkWell({
    onTap: async () => {
      animationsMap.containerOnActionTriggerAnimation2.controller.forward();
      Som.clique();
      girar();
    },
    child: Container({
      width: 428.0,
      height: 68.07,
      gradient: linearGradient({
        colors: [color(0xFFEF3939), color(0xFF700505)],
        stops: [0.0, 1.0],
        begin: [0.0, -1.0],
        end: [0, 1.0],
      }),
      borderRadius: 16.0,
      child: Align({
        alignment: [0.0, 0.0],
        child: Txt(L('x6urz5cq') /* GIRAR A ROLETA */, style('bodyMedium', { fontWeight: 700, fontSize: 32.0 })),
      }),
    }),
  });
  animateOnActionTrigger(spinButton, animationsMap.containerOnActionTriggerAnimation2);

  // A seta gira pela BASE, que é onde uma lingueta de roleta é presa: o pino
  // empurra a ponta e ela volta batendo. O `transform` fica no recorte, e não
  // na imagem, porque a imagem está dentro de um `overflow: hidden` — girada lá
  // dentro, a ponta sairia cortada.
  const seta = ClipRRect({
    borderRadius: 8.0,
    style: { transformOrigin: '50% 100%' },
    child: Img('assets/images/Seta_.png', { width: 101.4, height: 85.0, fit: 'cover' }),
  });

  const vida = criarVida({
    disco: wheel,
    eixo,
    pista,
    arte,
    seta,
    faisca,
    fatias: FFAppState.totalSlots,
    // Nasce com a tela, e nao no toque: o relogio do audio tem de ja estar
    // andando quando a roda girar (ver audio.js).
    estalos: criarEstalos(),
  });

  // A dica do gesto fica SOLTA embaixo do botão (posição absoluta): se ela
  // entrasse na coluna, empurraria roda e botão para cima e a roleta sairia do
  // meio da tela (ver verify/centro.mjs).
  const dica = Txt(T('arrasteParaGirar'), {
    fontFamily: 'Open Sans',
    color: '#CFE0FF',
    fontSize: 20.0,
    fontWeight: 600,
    letterSpacing: 1.0,
  });
  dica.classList.add('roleta-dica');
  const botaoComDica = el('div', { class: 'roleta-botao' }, [spinButton, dica]);

  /** A caixa da roda inteira: é nela que o dedo pega a roda (ver abaixo). */
  let areaDaRoda = null;

  const content = Column({
    // `min`, e nao o `max` do Dart. La esta coluna mora dentro de outra Column,
    // que da altura ILIMITADA a filho nao flexivel, e uma Column `max` sem teto
    // encolhe ate os filhos — e isso que deixa a coluna de fora centraliza-la.
    // No CSS nao ha altura ilimitada: `max` virava 100% da tela, e a roda
    // colava no topo, com 0px em cima e 108px embaixo. `min` e o tamanho que o
    // Flutter chegava a dar de fato, e a roda volta aos 54px de cada lado.
    mainAxisSize: 'min',
    crossAxisAlignment: 'center',
    children: [
      Padding({
        padding: [0.0, 0.0, 0.0, 64.0],
        child: (areaDaRoda = Container({
          width: 1821.8,
          height: 839.8,
          child: Stack({
            children: [
              // A ordem aqui é a ordem em que o Stack pinta, e ela é a pilha
              // física: sombra e halo por baixo do disco, disco, luz por cima
              // dele, e só então a seta e o logo, que ficam na frente de tudo.
              StackAlign({ alignment: [0.0, 0.0], child: fundo }),
              StackAlign({ alignment: [0.0, 0.0], child: eixo }),
              StackAlign({ alignment: [0.0, 0.0], child: vencedora }),
              StackAlign({ alignment: [0.0, 0.0], child: luz }),
              ronda ? StackAlign({ alignment: [0.0, 0.0], child: ronda }) : null,
              StackAlign({ alignment: [0.0, 0.0], child: faisca }),
              StackAlign({
                alignment: [0.0, 1.0],
                child: Padding({ padding: [0.0, 0.0, 0.0, 30.0], child: seta }),
              }),
              StackAlign({
                alignment: [0.0, 0.0],
                child: ClipRRect({
                  borderRadius: 24.0,
                  child: Img('assets/images/Logo_Tecnomotor_sem_fundo.png', {
                    width: 100.0,
                    height: 100.0,
                    fit: 'contain',
                    alignment: [0.0, 0.0],
                  }),
                }),
              }),
              faixaDoNome,
            ],
          }),
        })),
      }),
      botaoComDica,
    ],
  });
  animateOnPageLoad(content, animationsMap.columnOnPageLoadAnimation);
  areaDaRoda.classList.add('roleta-area');

  /* --------------------------------------------------- o giro com o dedo -- */

  /**
   * O dedo gira a roda pelo ângulo em volta do centro dela: arrastar em arco
   * leva a roda junto, como numa roda de verdade. A velocidade que conta é a
   * dos últimos 90ms antes de soltar — o empurrão final, e não o arrasto todo.
   *
   * O toque é ouvido na ÁREA da roda, e não no disco: por cima dele o Stack
   * empilha as camadas de luz, e o invólucro de cada uma (o StackAlign) pega o
   * toque antes. Quem decide se o dedo caiu na roda é a distância ao centro.
   */
  (() => {
    let pegou = null;
    let amostras = [];
    const centro = () => {
      const r = eixo.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, raio: Math.min(r.width, r.height) / 2 };
    };
    const anguloDoDedo = (e, c = centro()) => (Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180) / Math.PI;
    areaDaRoda.addEventListener('pointerdown', (e) => {
      if (!model.apertaButton || left || menosMovimento()) return;
      const c = centro();
      if (Math.hypot(e.clientX - c.x, e.clientY - c.y) > c.raio) return;
      e.preventDefault();
      areaDaRoda.setPointerCapture?.(e.pointerId);
      const a = anguloDoDedo(e, c);
      pegou = { ultimo: a, roda: vida.posicao * 360 };
      amostras = [{ t: performance.now(), a: pegou.roda }];
      vida.arrastar();
    });
    areaDaRoda.addEventListener('pointermove', (e) => {
      if (!pegou) return;
      const a = anguloDoDedo(e);
      let d = a - pegou.ultimo;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      pegou.ultimo = a;
      pegou.roda += d;
      vida.seguir(pegou.roda);
      const agora = performance.now();
      amostras.push({ t: agora, a: pegou.roda });
      while (amostras.length > 2 && agora - amostras[0].t > 90) amostras.shift();
    });
    const soltar = () => {
      if (!pegou) return;
      pegou = null;
      const primeira = amostras[0];
      const ultima = amostras[amostras.length - 1];
      const dt = (ultima.t - primeira.t) / 1000;
      // Voltas por segundo, no sentido do relógio — o sentido em que a roda gira.
      const velocidade = dt > 0.008 ? (ultima.a - primeira.a) / 360 / dt : 0;
      vida.soltar();
      const gesto = giroDoGesto(velocidade > 0 ? velocidade : 0);
      if (gesto) girar(gesto);
    };
    areaDaRoda.addEventListener('pointerup', soltar);
    areaDaRoda.addEventListener('pointercancel', soltar);
    areaDaRoda.addEventListener('lostpointercapture', soltar);
  })();


  // Sem arte de fundo: ela mora no palco (#fundo, ver palco.js), com a luz.
  const root = el(
    'div',
    { class: 'ff-scaffold' },
    Container({
      width: Infinity,
      height: Infinity,
      child: Column({
        mainAxisSize: 'min',
        mainAxisAlignment: 'center',
        height: Infinity,
        children: [Align({ alignment: [0.0, 0.0], child: content })],
      }),
    })
  );
  root.addEventListener('click', unfocus);

  // O ranking que a pergunta vai precisar, pedido agora (ver estatisticas.js).
  adiantarRanking();

  // O botão físico e o teclado giram a roda como o botão da tela.
  const desligarComandos = registrarComandos({
    aceita: () => false,
    principal: () => {
      Som.clique();
      girar();
    },
  });

  root.__dispose = () => {
    left = true;
    desligarComandos();
    vida.parar();
  };

  return root;
}
