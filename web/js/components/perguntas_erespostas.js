// Port of lib/pages/components/perguntas_erespostas/perguntas_erespostas_widget.dart
//
// The right half of the action screen: the scanner skin, the four shuffled
// answers, the five support hints (two allowed per game) and the 60s countdown.
//
// The Dart writes the same block out four times for the answers and five times
// for the hints; the only differences are which slot of `ordemNumeros` an
// answer maps to and which help field a hint reads, so those are tables here.

import {
  Align,
  ClipRRect,
  Column,
  Container,
  Img,
  InkWell,
  Opacity,
  Padding,
  Row,
  Stack,
  StackAlign,
  Txt,
  boxShadow,
  color,
  decorationImage,
  linearGradient,
  valueOrDefault,
  SW,
} from '../widgets.js';
import { TH, style } from '../theme.js';
import { FFLocalizations, L } from '../i18n.js';
import { FFAppState } from '../state.js';
import { playSound, tique } from '../audio.js';
import { showDialog } from '../dialog.js';
import { ConfirmacaoWidget } from './confirmacao.js';
import { PopUpWidget } from './pop_up.js';
import { EQUIPAMENTO_PULADO } from './ferramenta.js';
import { goNamed } from '../router.js';
import { addUsuario, createUsuariosRecordData } from '../backend.js';
import {
  AnimationInfo,
  AnimationTrigger,
  Curves,
  FadeEffect,
  MoveEffect,
  ScaleEffect,
  animateOnActionTrigger,
  animateOnPageLoad,
  delayed,
  menosMovimento,
} from '../anim.js';
import { FlutterFlowTimer, FlutterFlowTimerController, InstantTimer, StopWatchMode, StopWatchTimer } from '../timer.js';

/* ------------------------------------------------------- scanner skinning -- */
// Every colour in this panel is chosen by `scannerEscolhido`; the Dart spells
// each switch out inline. Same values, one table per switch.

const skin = (map, fallback) => (key) => (key in map ? map[key] : fallback);

const bodyColor = skin(
  {
    'Rasther 3': color(0xFFE7E7E2),
    RB: color(0xFFE7E7E2),
    Td90: color(0xFF5A9BF9),
    Td80: color(0xFF5A9BF9),
    'Rasther 4': color(0xFFB7C9E5),
    RST: color(0xFFB7C9E5),
  },
  color(0xFFBCBEC0)
);

const headerTop = skin(
  {
    'Rasther 3': color(0xFFE3E3E3),
    RB: color(0xFFE3E3E3),
    Td90: color(0xFFD4D9DF),
    Td80: color(0xFFD4D9DF),
    'Rasther 4': color(0xFFB7C9E5),
    RST: color(0xFFB7C9E5),
  },
  color(0xFFF6F6F6)
);

const headerBottom = skin(
  {
    'Rasther 3': color(0xFF686868),
    RB: color(0xFF686868),
    Td90: color(0xFFD4D9DF),
    Td80: color(0xFFD4D9DF),
    'Rasther 4': color(0xFFB7C9E5),
    RST: color(0xFFB7C9E5),
  },
  TH.secondaryText
);

const cardColor = skin(
  {
    'Rasther 3': color(0xFFBCBEC0),
    RB: color(0xFFBCBEC0),
    Td90: color(0xFFA9CCFF),
    Td80: color(0xFFA9CCFF),
    'Rasther 4': color(0xFFD4D9DF),
    RST: color(0xFFD4D9DF),
  },
  color(0xFFBCBEC0)
);

// Note: the Dart tests 'Xtool' here, a value `scannerEscolhido` is never set
// to, so that branch is dead - the numbers are black for the Rasther 3 / RB
// skins and 0xFF001C43 for everything else.
const numberColor = skin(
  {
    'Rasther 3': '#000000',
    RB: '#000000',
    Xtool: color(0xFF001C43),
    Td80: color(0xFF001C43),
    'Rasther 4': color(0xFF001C43),
    RST: color(0xFF001C43),
  },
  color(0xFF001C43)
);

/** The scanner photo shown in the header, with the size from the Dart. */
const HEADER_PHOTOS = {
  RST: { src: 'assets/images/Rasther_ST_+_VCI.png', width: 313.39, height: 171.8 },
  'Rasther 3': { src: 'assets/images/Rasther_CANFD_(1).png', width: 162.67, height: 157.9 },
  RB: { src: 'assets/images/Rasther---box,-3s---mensal-box---android.png', width: 325.9, height: 176.0 },
  Td80: { src: 'assets/images/TD_80__Final_(1).png', width: 200.0, height: 200.0 },
  Td90: { src: 'assets/images/TD_90_(2).png', width: 200.0, height: 200.0 },
};

/** answer slot -> the question field the shuffled number points at. */
const RESPOSTA_FIELD = { 1: 'respostaUm', 2: 'respostaDois', 3: 'respostaTres', 4: 'respostaQuatro' };

/** The five support hints, in the order the Dart lays them out. */
const HINTS = [
  {
    key: 'apoio',
    field: 'ajudaApoio',
    tipo: 'Apoio Tecnico',
    image: 'assets/images/Apoio_.png',
    width: 170.0,
    height: 90.0,
    fit: 'cover',
    padding: [0.0, 16.0, 0.0, 16.0],
    sound: 'soundPlayer6',
  },
  {
    key: 'treinamento',
    field: 'ajudaTreinamentoEad',
    tipo: 'Cursos EAD',
    image: 'assets/images/Cursos.png',
    width: 170.0,
    height: 95.0,
    fit: 'contain',
    padding: [0.0, 0.0, 0.0, 16.0],
    sound: 'soundPlayer7',
  },
  {
    key: 'youtube',
    field: 'ajudaTecnomotorTv',
    tipo: 'TecnomotorTV',
    image: 'assets/images/Youtube.png',
    width: 170.0,
    height: 95.0,
    fit: 'contain',
    padding: [0.0, 0.0, 0.0, 16.0],
    sound: 'soundPlayer8',
  },
  {
    key: 'comunidade',
    field: 'ajudaComunidade',
    tipo: 'Comunidade',
    image: 'assets/images/Comunidade_1.png',
    width: 170.0,
    height: 95.0,
    fit: 'contain',
    padding: [0.0, 0.0, 0.0, 16.0],
    sound: 'soundPlayer9',
  },
  {
    key: 'representante',
    field: 'ajudaRepresentanteComercial',
    tipo: 'Representante',
    image: 'assets/images/Representante.png',
    width: 170.0,
    height: 95.0,
    fit: 'contain',
    padding: [0.0, 0.0, 0.0, 16.0],
    sound: 'soundPlayer10',
  },
];

/**
 * O equipamento que vai para o registro da partida.
 *
 * Quem pulou a escolha joga com o padrao na tela (ver `pages/scanner.js`), mas
 * nao escolheu nada — e esta coluna existe para o time saber o que a feira
 * escolhe. Gravar o padrao como escolha inventaria interesse que nao houve.
 */
const equipamentoDaPartida = () =>
  FFAppState.equipamentoPulado ? EQUIPAMENTO_PULADO : FFAppState.scannerEscolhido;

const tapFeedback = () =>
  new AnimationInfo({
    trigger: AnimationTrigger.onActionTrigger,
    applyInitialState: true,
    effectsBuilder: () => [
      ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 200.0, begin: [1.0, 1.0], end: [0.9, 0.9] }),
      ScaleEffect({ curve: Curves.easeInOut, delay: 200.0, duration: 200.0, begin: [0.9, 0.9], end: [1.0, 1.0] }),
    ],
  });

/**
 * Relevo: um realce no alto e uma sombra embaixo, sobre a cor lisa do cartão.
 *
 * Vai pelo `gradient` do Container, e não por CSS: `color` vira a abreviação
 * `background` no estilo inline, que zera `background-image` — uma regra de
 * folha não alcançaria. O `Container` escreve `backgroundImage` depois de
 * `background`, então o gradiente pousa por cima da cor.
 *
 * Em rgba porque o painel troca de pele conforme o scanner escolhido: branco e
 * preto translúcidos funcionam sobre qualquer uma das cores.
 */
const relevo = () =>
  linearGradient({
    colors: ['rgba(255, 255, 255, 0.30)', 'rgba(255, 255, 255, 0.04)', 'rgba(0, 0, 0, 0.07)'],
    stops: [0.0, 0.46, 1.0],
    begin: [0.0, -1.0],
    end: [0.0, 1.0],
  });

/** A entrada das quatro alternativas, uma atrás da outra. */
const entradaDaResposta = (ordem) =>
  new AnimationInfo({
    trigger: AnimationTrigger.onPageLoad,
    applyInitialState: true,
    effectsBuilder: () => [
      FadeEffect({ curve: Curves.easeOut, delay: 260.0 + ordem * 90.0, duration: 320.0, begin: 0.0, end: 1.0 }),
      MoveEffect({
        curve: Curves.easeOut,
        delay: 260.0 + ordem * 90.0,
        duration: 420.0,
        begin: [64.0, 0.0],
        end: [0.0, 0.0],
      }),
    ],
  });

const hintPulse = () =>
  new AnimationInfo({
    loop: true,
    reverse: true,
    trigger: AnimationTrigger.onPageLoad,
    applyInitialState: true,
    effectsBuilder: () => [
      ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 600.0, begin: [1.0, 1.0], end: [1.05, 1.05] }),
    ],
  });

/** The question in the active language, with the pt list as the fallback. */
function pergunta(field, { enField = field } = {}) {
  const index = FFAppState.indiceAtual;
  return FFLocalizations.getVariableText({
    ptText: valueOrDefault(FFAppState.questoesBrasil[index]?.[field], 'Pergunta um'),
    esText: FFAppState.questoesSpanish[index]?.[field],
    enText: FFAppState.questoesEnglish[index]?.[enField],
  });
}

/**
 * The answer text for one slot.
 *
 * NOTE - faithful bug: in the first answer's builder the Dart reads
 * `respostaQuatro` from the English list when the shuffled number is 3
 * (pt and es correctly read `respostaTres`), so answer 1 shows answer 4's text
 * in English whenever the shuffle puts option 3 first. The other three slots
 * are written correctly. Reproduced here so the port behaves like the original;
 * drop the `enField` override to fix it.
 */
function respostaText(slot, numero) {
  const field = RESPOSTA_FIELD[numero];
  if (!field) return `Pergunta ${slot + 1}`;
  const enField = slot === 0 && numero === 3 ? 'respostaQuatro' : field;
  return pergunta(field, { enField });
}

/**
 * @param {object}   [opcoes]
 * @param {Function} [opcoes.aoEntrarNaRetaFinal]  chamado uma vez quando o
 *   relógio cruza os 15s. Quem desenha a moldura do defeito é a tela (o painel
 *   só tem a metade direita), então a tela pede para ser avisada.
 */
export function PerguntasErespostasWidget({ aoEntrarNaRetaFinal = null } = {}) {
  const model = {
    apoio: false,
    youtube: false,
    comunidade: false,
    treinamento: false,
    representante: false,
    numeroDicas: 0,
    apertou: false,
    revelando: false,
    timerMilliseconds: 60000,
    timerValue: StopWatchTimer.getDisplayTime(60000, { hours: false }),
    timerController: new FlutterFlowTimerController({ mode: StopWatchMode.countDown }),
    instantTimer: null,
    soundPlayer1: null,
  };

  const animationsMap = {
    stackOnActionTriggerAnimation1: tapFeedback(),
    stackOnActionTriggerAnimation2: tapFeedback(),
    stackOnActionTriggerAnimation3: tapFeedback(),
    stackOnActionTriggerAnimation4: tapFeedback(),
    imageOnActionTriggerAnimation1: tapFeedback(),
    imageOnPageLoadAnimation1: hintPulse(),
    imageOnActionTriggerAnimation2: tapFeedback(),
    imageOnPageLoadAnimation2: hintPulse(),
    imageOnActionTriggerAnimation3: tapFeedback(),
    imageOnPageLoadAnimation3: hintPulse(),
    imageOnActionTriggerAnimation4: tapFeedback(),
    imageOnPageLoadAnimation4: hintPulse(),
    imageOnActionTriggerAnimation5: tapFeedback(),
    imageOnPageLoadAnimation5: hintPulse(),
  };

  const scanner = () => FFAppState.scannerEscolhido;

  /* -------------------------------------------------------- answer cards -- */

  /**
   * One answer. `slot` is the index into ordemNumeros; the visible number is
   * always slot + 1, and the answer text comes from the question field that
   * ordemNumeros[slot] points at.
   */
  function answer(slot, { numberKey, animation, sound }) {
    const numero = FFAppState.ordemNumeros[slot];
    const text = respostaText(slot, numero);

    const card = InkWell({
      onTap: async () => {
        // Durante a revelação a tela está congelada de propósito.
        if (model.revelando) return;
        // Slots 0, 1 and 3 guard on `_model.apertou`; slot 2 guards on
        // FFAppState().finalizou instead - kept exactly as written.
        if (slot === 2 ? FFAppState.finalizou : model.apertou) return;

        model.apertou = true;
        playSound(model, sound, 'assets/audios/undertale-select-sound.mp3', 0.53);
        animation.controller.forward();
        marcarEscolha(slot);
        await showDialog({ builder: () => ConfirmacaoWidget({ numero: slot + 1, texto: text }) });

        if (FFAppState.finalizou) {
          model.revelando = true;
          model.soundPlayer1?.stop();
          model.timerController.onStopTimer();
          // O relógio não pode mandar para "Perdeu" no meio da revelação. No
          // Dart só o slot 0 cancelava este timer — com a tela trocando na
          // mesma batida da confirmação isso nunca aparecia; agora que existe
          // uma pausa entre uma coisa e outra, aparece.
          model.instantTimer?.cancel();

          const gabarito = valueOrDefault(
            FFAppState.questoesBrasil[FFAppState.indiceAtual]?.gabarito,
            'Pergunta um'
          );
          const acertou = gabarito === String(FFAppState.ordemNumeros[slot]);

          const record = createUsuariosRecordData({
            nome: FFAppState.cadastro.nome,
            telefone: FFAppState.cadastro.telefone,
            atuacao: FFAppState.cadastro.atuacao,
            venceu: acertou,
            tempo: model.timerMilliseconds,
            equipamento: equipamentoDaPartida(),
            invalido: FFAppState.cadastro.invalido,
          });

          // A tela de fim precisa saber o que era certo para poder contar.
          const slotCerto = FFAppState.ordemNumeros.findIndex((n) => String(n) === String(gabarito));
          FFAppState.resultado = {
            acertou,
            // O que sobrou no relógio, que é como a partida é gravada. A tela
            // de fim precisa dele para dizer em que lugar o jogador ficou sem
            // depender da gravação — que sai depois da navegação.
            tempo: model.timerMilliseconds,
            numeroCerto: slotCerto >= 0 ? slotCerto + 1 : null,
            textoCerto: slotCerto >= 0 ? respostaText(slotCerto, FFAppState.ordemNumeros[slotCerto]) : null,
            numeroEscolhido: slot + 1,
            textoEscolhido: text,
          };

          // A pausa antes do veredito. É o pedaço do Jogo do Milhão que faltava
          // aqui: sem ela o jogo julga e troca de tela na mesma batida, e
          // ninguém chega a ver o que era certo.
          await revelar({ slotEscolhido: slot, slotCerto });

          goNamed(acertou ? 'Ganhou' : 'Perdeu');
          await addUsuario(record, { serverTimestamp: true });

          model.apoio = false;
          model.youtube = false;
          model.comunidade = false;
          model.treinamento = false;
          model.representante = false;
          model.timerController.onResetTimer();
          FFAppState.finalizou = false;
        } else {
          // Cancelou: o cartão volta a ser um cartão como os outros.
          marcarEscolha(null);
        }
        model.apertou = false;
      },
      child: Container({
        width: 550.0,
        height: 125.0,
        color: cardColor(scanner()),
        gradient: relevo(),
        boxShadow: boxShadow({ blurRadius: 10.0, color: color(0x5D000000), offset: [-10.0, 10.0], spreadRadius: 1.0 }),
        borderRadius: 12.0,
        child: Padding({
          padding: [72.0, 16.0, 32.0, 16.0],
          child: Column({
            mainAxisSize: 'max',
            mainAxisAlignment: 'center',
            crossAxisAlignment: 'start',
            children: [
              Padding({
                padding: [10.0, 0.0, 0.0, 0.0],
                child: Txt(
                  valueOrDefault(text, 'yr'),
                  style('bodyMedium', { fontWeight: 400, color: color(0xFF001C43), fontSize: 24.0 })
                ),
              }),
            ],
          }),
        }),
      }),
    });

    card.classList.add('ff-resposta-cartao');

    const stack = Stack({
      alignment: [-1.0, 0.0],
      children: [
        // Slot 0 wraps the card in an Align(0, 0); the others don't.
        slot === 0 ? StackAlign({ alignment: [0.0, 0.0], child: card }) : card,
        StackAlign({
          alignment: [-1.0, 0.0],
          child: Padding({
            padding: [24.0, 0.0, 0.0, 0.0],
            child: Txt(
              L(numberKey),
              style('bodyMedium', { fontWeight: 900, color: numberColor(scanner()), fontSize: 55.0 })
            ),
          }),
        }),
      ],
    });

    stack.dataset.resposta = String(slot);
    // As quatro chegavam de uma vez, prontas. Entrando uma atrás da outra, o
    // olho as lê na ordem em que vai precisar delas — e é a batida do gênero.
    animateOnPageLoad(stack, entradaDaResposta(slot));
    return animateOnActionTrigger(stack, animation);
  }

  /* ------------------------------------------------------------ revelação -- */

  /** Quanto o veredito fica na tela antes de trocar de página. */
  const PAUSA_DA_REVELACAO = 1500;

  const cartoes = () => [...root.querySelectorAll('[data-resposta]')];

  /** Acende o cartão que o jogador tocou; `null` apaga todos. */
  function marcarEscolha(slot) {
    for (const no of cartoes()) {
      no.classList.toggle('ff-resposta--escolhida', Number(no.dataset.resposta) === slot);
    }
  }

  /**
   * Congela a tela, apaga as alternativas descartadas, acende a certa em verde
   * e — se foi o caso — a errada em vermelho. Devolve quando a pausa acabou.
   */
  function revelar({ slotEscolhido, slotCerto }) {
    root.classList.add('ff-revelando');
    for (const no of cartoes()) {
      const slot = Number(no.dataset.resposta);
      // Solta as animações que ainda seguram este cartão — a entrada e o aperto
      // do toque. As duas têm `fill: both`, e animação preenchida ganha de
      // regra de folha: sem soltar, o `opacity` que apaga as descartadas
      // simplesmente não valeria.
      //
      // Mas cancelar não basta, e foi assim que a resposta certa sumia da tela:
      // `applyInitialState` escreve o QUADRO 0 no estilo inline — para a
      // entrada, `opacity: 0` e `translate(64px)` — e nunca o apaga. Enquanto a
      // animação corria ela mascarava isso; cancelada, o quadro 0 voltava a
      // valer e o cartão desaparecia 64px fora do lugar. Limpar as duas
      // propriedades é o que devolve o elemento ao CSS.
      for (const animacao of no.getAnimations()) animacao.cancel();
      no.style.transform = no.dataset.baseTransform ?? '';
      no.classList.remove('ff-resposta--escolhida');

      // Opacidade cheia, escrita INLINE. Não é enfeite: sem isto o cartão fica
      // com o `opacity: 0` que o `applyInitialState` deixou, e some — era esse
      // o defeito. Quem recua é o filtro da classe `--fria`, que ninguém mais
      // disputa. Aqui não há espaço para "quase": ou o jogador vê qual era a
      // certa, ou o veredito não serviu para nada.
      no.style.opacity = '1';
      if (slot === slotCerto) no.classList.add('ff-resposta--certa');
      else if (slot === slotEscolhido) no.classList.add('ff-resposta--errada');
      else no.classList.add('ff-resposta--fria');
    }
    // Sem movimento ligado, o veredito ainda precisa ser lido: as cores ficam,
    // só a espera encurta.
    return delayed(menosMovimento() ? 700 : PAUSA_DA_REVELACAO);
  }

  /* -------------------------------------------------------- support hints -- */

  function hint(spec, { actionAnimation, pageLoadAnimation }) {
    const image = InkWell({
      onTap: async () => {
        playSound(model, spec.sound, 'assets/audios/adriantnt_u_click.mp3', 0.5);
        if (model[spec.key]) return;

        actionAnimation.controller.forward();
        model[spec.key] = true;
        refreshHints();

        await showDialog({
          builder: () => PopUpWidget({ texto: pergunta(spec.field), tipo: spec.tipo }),
        });

        model.numeroDicas += 1;
        refreshDicas();
        if (model.numeroDicas >= 2) {
          // Two hints used: every button is spent.
          for (const other of HINTS) model[other.key] = true;
          refreshHints();
        }
      },
      child: ClipRRect({
        borderRadius: 8.0,
        child: Img(spec.image, { width: spec.width, height: spec.height, fit: spec.fit }),
      }),
    });
    animateOnPageLoad(image, pageLoadAnimation);
    animateOnActionTrigger(image, actionAnimation);

    const opacity = Opacity({
      opacity: model[spec.key] ? 0.3 : 1.0,
      child: Padding({ padding: spec.padding, child: image }),
    });
    opacity.dataset.hint = spec.key;

    // The Dart wraps the first hint in an extra Align(0, 0).
    const inner = spec.key === 'apoio' ? Align({ alignment: [0.0, 0.0], child: opacity }) : opacity;
    return Stack({ alignment: [0.0, 0.0], children: [inner] });
  }

  const hintNodes = HINTS.map((spec, index) =>
    hint(spec, {
      actionAnimation: animationsMap[`imageOnActionTriggerAnimation${index + 1}`],
      pageLoadAnimation: animationsMap[`imageOnPageLoadAnimation${index + 1}`],
    })
  );

  function refreshHints() {
    for (const spec of HINTS) {
      const node = root.querySelector(`[data-hint="${spec.key}"]`);
      if (node) node.style.opacity = model[spec.key] ? '0.3' : '1';
    }
  }

  const dicasLabel = Txt(`${2 - model.numeroDicas}X`, {
    ...style('bodyMedium', {
      fontFamily: 'pirulen',
      color: color(0xFF001B54),
      fontSize: 23.0,
      fontWeight: 400,
      textAlign: 'right',
    }),
  });

  function refreshDicas() {
    dicasLabel.textContent = `${2 - model.numeroDicas}X`;
  }

  /* --------------------------------------------------------------- header -- */

  const headerBand = (() => {
    const current = scanner();
    if (current === 'Rasther 3' || current === 'RB') {
      return Container({
        width: Infinity,
        height: 65.31,
        color: color(0xFFDAD2D2),
        image: decorationImage('assets/images/Prancheta_64_cpia_2.png', 'none'),
      });
    }
    if (current === 'Td90' || current === 'Td80') {
      return Container({
        width: Infinity,
        height: 65.3,
        color: color(0xFFE3E3E3),
        image: decorationImage('assets/images/Prancheta_64_cpia.png', 'none'),
      });
    }
    if (current === 'Rasther 4' || current === 'RST') {
      return Container({
        width: Infinity,
        height: 90.6,
        image: decorationImage('assets/images/Prancheta_64.png', 'none'),
        gradient: linearGradient({
          colors: [color(0xFFD47008), '#000000'],
          stops: [0.0, 1.0],
          begin: [-0.64, 1.0],
          end: [0.64, -1.0],
        }),
      });
    }
    return null;
  })();

  const headerPhoto = HEADER_PHOTOS[scanner()];

  /* ----------------------------------------------------------- the timer -- */

  /**
   * A reta final.
   *
   * `FFAppState.tempoAcabando` existia desde o Dart e ninguém a lia: a tela da
   * pergunta a ligava aos 15s DE TELA e a tela de fim a zerava. Agora ela é
   * ligada pelos 15s QUE FALTAM, que é onde a tensão mora, e tem dois ouvintes:
   * o CSS (relógio vermelho pulsando, moldura do defeito quente) e o tique.
   */
  const RETA_FINAL_MS = 15000;
  const TIQUE_MS = 10000;

  // A caixa branca do relógio, presa mais abaixo na árvore. Fica `null` até lá;
  // o relógio só cruza os 15s muito depois da árvore existir.
  let caixaDoRelogio = null;

  function olharORelogio(value, deveAtualizar) {
    if (model.revelando) return;

    if (!FFAppState.tempoAcabando && value <= RETA_FINAL_MS) {
      FFAppState.tempoAcabando = true;
      caixaDoRelogio?.classList.add('ff-cronometro--reta-final');
      aoEntrarNaRetaFinal?.();
    }

    // `deveAtualizar` vem do próprio FlutterFlowTimer e é verdadeiro uma vez por
    // segundo — é o batimento que o tique quer, e não o quadro.
    if (!deveAtualizar || value > TIQUE_MS || value <= 0) return;
    // Sobe meio tom por segundo nos últimos dez: o ouvido percebe a subida sem
    // precisar contar.
    const restantes = Math.max(0, Math.ceil(value / 1000));
    tique({ frequencia: 880 + (10 - restantes) * 26, duracao: 0.07, volume: 0.16 });
  }

  const timer = FlutterFlowTimer({
    initialTime: 60000,
    controller: model.timerController,
    getDisplayTime: (value) => StopWatchTimer.getDisplayTime(value, { hours: false }),
    updateStateInterval: 1000,
    onChanged: (value, displayTime, deveAtualizar) => {
      model.timerMilliseconds = value;
      model.timerValue = displayTime;
      olharORelogio(value, deveAtualizar);
    },
    textAlign: 'justify',
    style: style('headlineSmall', {
      fontFamily: 'pirulen',
      color: color(0xFFFF0000),
      fontSize: 62.0,
      fontWeight: 400,
    }),
  });

  /* ------------------------------------------------------------- the tree -- */

  // The panel's Stack is sized by its `double.infinity` container in Flutter;
  // stating it here gives the CSS grid a definite box to lay the rest against.
  const root = Stack({
    width: Infinity,
    height: Infinity,
    children: [
      StackAlign({
        alignment: [1.0, 1.0],
        child: Container({
          width: SW * 0.5,
          height: Infinity,
          color: bodyColor(scanner()),
          boxShadow: boxShadow({ blurRadius: 40.0, color: '#000000', offset: [-10.0, 5.0], spreadRadius: 3.0 }),
          child: Column({
            mainAxisSize: 'max',
            mainAxisAlignment: 'start',
            children: [
              Container({
                width: Infinity,
                height: 258.35,
                gradient: linearGradient({
                  colors: [headerTop(scanner()), headerBottom(scanner())],
                  stops: [0.0, 1.0],
                  begin: [0.0, -1.0],
                  end: [0, 1.0],
                }),
                child: Column({
                  mainAxisSize: 'max',
                  crossAxisAlignment: 'start',
                  children: [
                    headerBand,
                    Padding({
                      padding: [0.0, 24.0, 0.0, 10.0],
                      child: Row({
                        mainAxisSize: 'max',
                        mainAxisAlignment: 'spaceEvenly',
                        children: [
                          Txt(
                            L('navhbcsm') /* Você está \nUsando */,
                            style('bodyMedium', {
                              fontFamily: 'pirulen',
                              color: color(0xFF222222),
                              fontSize: 40.0,
                              fontWeight: 400,
                            })
                          ),
                          Column({
                            mainAxisSize: 'max',
                            children: [
                              headerPhoto &&
                                ClipRRect({
                                  borderRadius: 8.0,
                                  child: Img(headerPhoto.src, {
                                    width: headerPhoto.width,
                                    height: headerPhoto.height,
                                    fit: 'cover',
                                  }),
                                }),
                            ],
                          }),
                        ],
                      }),
                    }),
                  ],
                }),
              }),
              // The red divider only belongs to the Rasther 3 / RB skins.
              Opacity({
                opacity: scanner() === 'Rasther 3' || scanner() === 'RB' ? 1.0 : 0.0,
                child: Container({ width: Infinity, height: 8.0, color: color(0xFFC10816) }),
              }),
              Padding({
                padding: [32.0, 10.0, 32.0, 0.0],
                child: Row({
                  mainAxisSize: 'max',
                  mainAxisAlignment: 'spaceBetween',
                  crossAxisAlignment: 'start',
                  children: [
                    Column({
                      mainAxisSize: 'max',
                      crossAxisAlignment: 'start',
                      children: [
                        Padding({
                          padding: [56.0, 16.0, 0.0, 16.0],
                          child: Txt(
                            L('x5fvgf80') /* O problema do veículo */,
                            style('bodyMedium', {
                              fontFamily: 'pirulen',
                              color: color(0xFF222222),
                              fontSize: 25.0,
                              fontWeight: 400,
                            })
                          ),
                        }),
                        Padding({
                          padding: [32.0, 16.0, 32.0, 32.0],
                          child: Column({
                            mainAxisSize: 'max',
                            mainAxisAlignment: 'center',
                            crossAxisAlignment: 'end',
                            children: [
                              answer(0, {
                                numberKey: 'bvcy0hg2',
                                animation: animationsMap.stackOnActionTriggerAnimation1,
                                sound: 'soundPlayer2',
                              }),
                              Padding({
                                padding: [0.0, 24.0, 0.0, 0.0],
                                child: answer(1, {
                                  numberKey: 'fvk3pjqg',
                                  animation: animationsMap.stackOnActionTriggerAnimation2,
                                  sound: 'soundPlayer3',
                                }),
                              }),
                              Padding({
                                padding: [0.0, 24.0, 0.0, 0.0],
                                child: answer(2, {
                                  numberKey: 'u3qmdqw7',
                                  animation: animationsMap.stackOnActionTriggerAnimation3,
                                  sound: 'soundPlayer4',
                                }),
                              }),
                              Padding({
                                padding: [0.0, 24.0, 0.0, 0.0],
                                child: answer(3, {
                                  numberKey: 'ai7wwgfu',
                                  animation: animationsMap.stackOnActionTriggerAnimation4,
                                  sound: 'soundPlayer5',
                                }),
                              }),
                            ],
                          }),
                        }),
                      ],
                    }),
                    Column({
                      mainAxisSize: 'max',
                      children: [
                        Padding({
                          padding: [16.0, 0.0, 16.0, 0.0],
                          child: Column({
                            mainAxisSize: 'max',
                            children: [
                              Row({
                                mainAxisSize: 'max',
                                mainAxisAlignment: 'start',
                                children: [
                                  Padding({ padding: [0.0, 16.0, 4.0, 4.0], child: dicasLabel }),
                                  Padding({
                                    padding: [0.0, 16.0, 0.0, 4.0],
                                    child: Txt(
                                      L('k0xz8bjz') /* Suporte\nDisponível! */,
                                      style('bodyMedium', {
                                        fontFamily: 'pirulen',
                                        color: '#000000',
                                        fontSize: 18.0,
                                        fontWeight: 400,
                                        textAlign: 'left',
                                      })
                                    ),
                                  }),
                                ],
                              }),
                              Padding({
                                padding: [0.0, 0.0, 0.0, 12.0],
                                child: Container({ width: 190.0, height: 2.0, color: TH.secondaryBackground }),
                              }),
                              Container({
                                color: cardColor(scanner()),
                                gradient: relevo(),
                                boxShadow: boxShadow({
                                  blurRadius: 10.0,
                                  color: color(0x5D000000),
                                  offset: [-5.0, 5.0],
                                  spreadRadius: 1.0,
                                }),
                                borderRadius: 24.0,
                                child: Padding({
                                  padding: [16.0, 16.0, 16.0, 16.0],
                                  child: Column({ mainAxisSize: 'max', children: hintNodes }),
                                }),
                              }),
                            ],
                          }),
                        }),
                      ],
                    }),
                  ],
                }),
              }),
            ],
          }),
        }),
      }),
      StackAlign({
        alignment: [1.0, 1.0],
        child: Padding({
          padding: [0.0, 0.0, 52.0, 32.0],
          child: (caixaDoRelogio = Container({
            width: 385.0,
            height: 90.0,
            color: '#FFFFFF',
            gradient: relevo(),
            boxShadow: boxShadow({ blurRadius: 10.0, color: color(0x5D000000), offset: [-5.0, 5.0], spreadRadius: 1.0 }),
            borderRadius: 8.0,
            child: Padding({ padding: [8.0, 8.0, 8.0, 8.0], child: timer }),
          })),
        }),
      }),
    ],
  });
  caixaDoRelogio.classList.add('ff-cronometro');

  /* --------------------------------------------------------- on page load -- */
  // Background music, then a 1Hz tick that sends the player to Perdeu when the
  // clock runs out.
  // Sem loop: o Dart chama setAsset().then(play()) e nunca setLoopMode, e a
  // faixa (~2min48) cobre a rodada de 60s de sobra.
  playSound(
    model,
    'soundPlayer1',
    'assets/audios/Eric_Skiff_-_A_Night_Of_Dizzy_Spells_NO_COPYRIGHT_8-bit_Music_Background.mp3',
    0.2
  );
  model.timerController.onStartTimer();
  model.instantTimer = InstantTimer.periodic({
    duration: 1000,
    startImmediately: true,
    callback: async () => {
      if (model.timerMilliseconds > 0) return;
      model.timerController.onStopTimer();
      model.timerController.onResetTimer();
      model.soundPlayer1?.stop();
      model.instantTimer?.cancel();
      goNamed('Perdeu');
      await addUsuario(
        createUsuariosRecordData({
          nome: FFAppState.cadastro.nome,
          telefone: FFAppState.cadastro.telefone,
          atuacao: FFAppState.cadastro.atuacao,
          venceu: false,
          equipamento: equipamentoDaPartida(),
        })
      );
    },
  });

  root.__dispose = () => {
    model.instantTimer?.cancel();
    model.timerController.dispose();
    model.soundPlayer1?.stop();
  };

  return root;
}
