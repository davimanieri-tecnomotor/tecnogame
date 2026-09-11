// Port of lib/pages/escolha/roleta/roleta_widget.dart
//
// The prize wheel. Pressing GIRAR draws a new `escolha` (1.0 - 1.9, never one
// of the last five), spins the wheel by that many turns, remembers the draw and
// moves on to the selected car.
//
// O sorteio e a navegacao sao os do Dart. O que a roda FAZ enquanto gira nao e:
// a fisica do giro, a seta batendo nas divisas, o borrao e a luz que nao gira
// junto moram em giro.js, e esta tela so monta as pecas e as entrega a ele.

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
  decorationImage,
  el,
  linearGradient,
  px,
  unfocus,
} from '../widgets.js';
import { style } from '../theme.js';
import { L } from '../i18n.js';
import { FFAppState } from '../state.js';
import { numeroAleatorio } from '../functions.js';
import { usaArteOriginal } from '../deck.js';
import { rodaGerada } from '../roda.js';
import { criarVida, efeitosDoGiro } from '../giro.js';
import { playSound } from '../audio.js';
import { goNamed, TransitionInfo, PageTransitionType } from '../router.js';
import {
  AnimationInfo,
  AnimationTrigger,
  Curves,
  FadeEffect,
  ScaleEffect,
  animateOnActionTrigger,
  animateOnPageLoad,
  delayed,
  menosMovimento,
} from '../anim.js';

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
  // `effects:` is read when forward() runs, so the rotation always uses the
  // value drawn a moment earlier.
  animateOnActionTrigger(wheel, animationsMap.containerOnActionTriggerAnimation1, null);
  animationsMap.containerOnActionTriggerAnimation1.effectsBuilder = () =>
    // Seis segundos de tela inteira girando é exatamente o que quem pediu menos
    // movimento no sistema não quer ver. Sem efeito nenhum o `forward()`
    // resolve na hora, e o jogo segue para o carro sorteado: o resultado do
    // sorteio é o mesmo, a roda só não gira.
    menosMovimento() ? [] : efeitosDoGiro(FFAppState.escolha, FFAppState.totalSlots);

  const spinButton = InkWell({
    onTap: async () => {
      animationsMap.containerOnActionTriggerAnimation2.controller.forward();
      if (!model.apertaButton || left) return;

      model.apertaButton = false;
      FFAppState.escolha = numeroAleatorio([...FFAppState.listaEscolhas], FFAppState.totalSlots);
      playSound(model, 'soundPlayer', 'assets/audios/roleta-normal-1_2GXmNRPk.mp3', 0.6);
      // Este `await` E sequencia: e o giro inteiro, e o jogo so segue depois.
      // O `girar()` vem logo atras porque ele LE o angulo que a animacao ja
      // escreveu na tela — e assim a seta bate na divisa que esta mostrando,
      // e nao na que um relogio paralelo teria calculado.
      const giro = animationsMap.containerOnActionTriggerAnimation1.controller.forward();
      vida.girar();
      await giro;
      await delayed(1000);
      if (left || !root.isConnected) return;

      // Keep a rolling window of the last five draws so the same car can't come
      // up again too soon.
      if (FFAppState.listaEscolhas.length >= 5) {
        FFAppState.removeFromListaEscolhas(FFAppState.listaEscolhas[0]);
      }
      FFAppState.addToListaEscolhas(FFAppState.escolha);

      model.apertaButton = true;
      goNamed('carroSleecionado', {
        extra: {
          __transition_info__: new TransitionInfo({
            hasTransition: true,
            transitionType: PageTransitionType.fade,
            // Era 0, que o roteador trata como SEM transição: a roda parava e a
            // tela trocava de estalo, no momento mais dramático do jogo. Este é
            // o mais longo dos quatro de propósito — é o único em que a troca
            // vale como pausa.
            duration: 420,
          }),
        },
      });
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

  const vida = criarVida({ disco: wheel, eixo, pista, arte, seta, faisca, fatias: FFAppState.totalSlots });

  const content = Column({
    mainAxisSize: 'max',
    crossAxisAlignment: 'center',
    children: [
      Padding({
        padding: [0.0, 0.0, 0.0, 64.0],
        child: Container({
          width: 1821.8,
          height: 839.8,
          child: Stack({
            children: [
              // A ordem aqui é a ordem em que o Stack pinta, e ela é a pilha
              // física: sombra e halo por baixo do disco, disco, luz por cima
              // dele, e só então a seta e o logo, que ficam na frente de tudo.
              StackAlign({ alignment: [0.0, 0.0], child: fundo }),
              StackAlign({ alignment: [0.0, 0.0], child: eixo }),
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
            ],
          }),
        }),
      }),
      spinButton,
    ],
  });
  animateOnPageLoad(content, animationsMap.columnOnPageLoadAnimation);

  const root = el(
    'div',
    { class: 'ff-scaffold', style: { background: color(0xFF1D1D2B) } },
    Container({
      width: Infinity,
      height: Infinity,
      image: decorationImage('assets/images/BG_Seleo_Equipamento.png', 'cover'),
      child: Column({
        mainAxisSize: 'min',
        mainAxisAlignment: 'center',
        height: Infinity,
        children: [Align({ alignment: [0.0, 0.0], child: content })],
      }),
    })
  );
  root.addEventListener('click', unfocus);

  root.__dispose = () => {
    left = true;
    vida.parar();
    model.soundPlayer?.stop();
  };

  return root;
}
