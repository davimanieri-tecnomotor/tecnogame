// Port of lib/pages/escolha/cadastro/cadastro_widget.dart
//
// "Tela destinada ao cadasrto do usuário" - name, WhatsApp, workshop type.
// A count-up timer runs in the background; after 45 idle seconds the ranking
// takes over the screen. Any tap, submit or dropdown change resets it.

import {
  Align,
  ClipRRect,
  Column,
  Container,
  FutureBuilder,
  Icon,
  Img,
  InkWell,
  Opacity,
  Padding,
  Stack,
  StackAlign,
  Txt,
  TransformSkew,
  color,
  decorationImage,
  divide,
  el,
  unfocus,
  SW,
  SH,
} from '../widgets.js';
import { TH, style } from '../theme.js';
import { L, FFLocalizations, LANGUAGES, setAppLanguage } from '../i18n.js';
import { CadastroStruct, FFAppState } from '../state.js';
import { embaralhaQuestoes, nomeOfensivo } from '../functions.js';
import { playSound } from '../audio.js';
import { showDialog } from '../dialog.js';
import { NomeOfensivoWidget } from '../components/nome_ofensivo.js';
import { PoliticaPrivacidadeWidget } from '../components/politica_privacidade.js';
import { RankingWidget } from '../components/ranking.js';
import { goNamed, TransitionInfo, PageTransitionType, Alignment } from '../router.js';
import { queryUsuariosRecordCount } from '../backend.js';
import {
  AnimationInfo,
  AnimationTrigger,
  Curves,
  FadeEffect,
  MoveEffect,
  ScaleEffect,
  animateOnActionTrigger,
  animateOnPageLoad,
} from '../anim.js';
import { FlutterFlowTimer, FlutterFlowTimerController, InstantTimer, StopWatchMode, StopWatchTimer } from '../timer.js';
import {
  FlutterFlowDropDown,
  FlutterFlowLanguageSelector,
  FormFieldController,
  FormState,
  MaskTextInputFormatter,
  TextEditingController,
  TextFormField,
} from '../forms.js';

/** The four staggered slide-ins; only the delay and duration differ. */
const slideIn = (delay, duration) =>
  new AnimationInfo({
    trigger: AnimationTrigger.onPageLoad,
    effectsBuilder: () => [
      MoveEffect({ curve: Curves.easeInOut, delay, duration, begin: [-100.0, 0.0], end: [0.0, 0.0] }),
      FadeEffect({ curve: Curves.easeInOut, delay, duration, begin: 0.0, end: 1.0 }),
    ],
  });

/** The dropdown options, in the order the Dart lists them. */
const OFICINA_KEYS = [
  'yr06bw5q', // - Oficina Diesel
  'u1togdyu', // - Centro-automotivo
  'zw8uhrit', // - Oficina-mecânica
  'n9va5c85', // - Auto-Elétrico
  'h3ss4zal', // - Transmissão automática
  '1xkz4x22', // - Ar-condicionado
  'uiyoqx6p', // - Borracharia
  '2i2l5ptm', // - Chaveiro
  'gnijwn15', // - Autonomo
  'o3hsgf10', // - Outros..
];

/**
 * O que o visitante já digitou, guardado fora da função de build.
 *
 * No Flutter isto sai de graça: `createModel(context, () => CadastroModel())`
 * devolve o mesmo model enquanto a página vive, então os TextEditingController
 * sobrevivem ao rebuild que o `setLocale` dispara no MaterialApp. Aqui a troca
 * de idioma reconstrói a página, e sem isto o nome e o telefone digitados eram
 * apagados — justo no gesto que um visitante estrangeiro faz primeiro.
 *
 * A oficina é guardada pela CHAVE de tradução, não pelo texto: assim a escolha
 * sobrevive à troca de idioma e reaparece já traduzida.
 */
const formState = {
  nome: new TextEditingController(),
  whats: new TextEditingController(),
  oficinaKey: null,
  invalido: 0,
};

/** Chamado quando a partida realmente começa: o próximo jogador entra limpo. */
function resetFormState() {
  formState.nome = new TextEditingController();
  formState.whats = new TextEditingController();
  formState.oficinaKey = null;
  formState.invalido = 0;
}

export function CadastroWidget() {
  const model = {
    // `invalido` conta as tentativas com nome ofensivo e também precisa
    // sobreviver ao rebuild, senão a contagem zera na troca de idioma.
    get invalido() {
      return formState.invalido;
    },
    set invalido(v) {
      formState.invalido = v;
    },
    formKey: new FormState(),
    textFieldNomeTextController: formState.nome,
    textFieldWhatsTextController: formState.whats,
    textFieldWhatsMask: new MaskTextInputFormatter({ mask: '(##) #####-####' }),
    dropDownOficinaValue: formState.oficinaKey ? L(formState.oficinaKey) : null,
    dropDownOficinaValueController: new FormFieldController(
      formState.oficinaKey ? L(formState.oficinaKey) : null
    ),
    timerController: new FlutterFlowTimerController({ mode: StopWatchMode.countUp }),
    timerMilliseconds: 0,
    timerValue: StopWatchTimer.getDisplayTime(0, { hours: false, milliSecond: false }),
    instantTimer: null,
  };

  const animationsMap = {
    imageOnPageLoadAnimation: new AnimationInfo({
      loop: true,
      reverse: true,
      trigger: AnimationTrigger.onPageLoad,
      effectsBuilder: () => [
        ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 600.0, begin: [0.98, 0.98], end: [1.0, 1.0] }),
      ],
    }),
    columnOnPageLoadAnimation1: slideIn(500.0, 1200.0),
    columnOnPageLoadAnimation2: slideIn(1000.0, 1200.0),
    columnOnPageLoadAnimation3: slideIn(1500.0, 1200.0),
    columnOnPageLoadAnimation4: slideIn(2000.0, 600.0),
    transformOnActionTriggerAnimation: new AnimationInfo({
      trigger: AnimationTrigger.onActionTrigger,
      applyInitialState: true,
      effectsBuilder: () => [
        ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 200.0, begin: [1.0, 1.0], end: [0.9, 0.9] }),
        ScaleEffect({ curve: Curves.easeInOut, delay: 200.0, duration: 200.0, begin: [0.9, 0.9], end: [1.0, 1.0] }),
      ],
    }),
    transformOnPageLoadAnimation: new AnimationInfo({
      loop: true,
      reverse: true,
      trigger: AnimationTrigger.onPageLoad,
      applyInitialState: true,
      effectsBuilder: () => [
        ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 600.0, begin: [1.0, 1.0], end: [1.01, 1.01] }),
      ],
    }),
    textOnPageLoadAnimation: slideIn(2000.0, 600.0),
  };

  /** Every interaction on this page restarts the idle countdown. */
  const restartIdleTimer = () => {
    model.timerController.onResetTimer();
    model.timerController.onStartTimer();
  };

  /* --------------------------------------------------------------- fields -- */

  const fieldLabel = (key) =>
    Padding({
      padding: [0.0, 0.0, 0.0, 16.0],
      child: Txt(
        L(key),
        style('bodyMedium', {
          fontFamily: 'pirulen',
          color: '#FFFFFF',
          fontSize: 24.0,
          letterSpacing: 3.0,
          fontWeight: 400,
        })
      ),
    });

  const nomeField = TextFormField({
    controller: model.textFieldNomeTextController,
    hintText: L('b4pv213k') /* Digite aqui seu nome */,
    hintStyle: style('labelMedium', { color: '#FFFFFF', fontSize: 23.0 }),
    errorStyle: style('bodyMedium', { color: TH.error, fontSize: 23.0 }),
    style: style('bodyMedium', { color: '#FFFFFF', fontSize: 32.0 }),
    fillColor: color(0xFF0053B6),
    borderRadius: 8.0,
    borderColor: color(0x00000000),
    errorColor: TH.error,
    maxLength: 30,
    cursorColor: TH.primaryText,
    validator: (value) => (value == null || value.length === 0 ? L('ra9dcpxq') /* Digite seu nome */ : null),
    onSubmitted: () => {
      playSound(model, 'soundPlayer3', 'assets/audios/adriantnt_u_click.mp3', 1.0);
      restartIdleTimer();
    },
  });

  const whatsField = TextFormField({
    controller: model.textFieldWhatsTextController,
    hintText: L('559rlm5s') /* Digite o seu número */,
    hintStyle: style('labelMedium', { color: '#FFFFFF', fontSize: 23.0 }),
    errorStyle: style('bodyMedium', { color: TH.error, fontSize: 23.0 }),
    style: style('bodyMedium', { color: '#FFFFFF', fontSize: 32.0 }),
    fillColor: color(0xFF0053B6),
    borderRadius: 8.0,
    borderColor: color(0x00000000),
    errorColor: TH.error,
    maxLength: 20,
    keyboardType: 'number',
    inputFormatter: model.textFieldWhatsMask,
    cursorColor: TH.primaryText,
    validator: (value) => {
      if (value == null || value.length === 0) return L('xz37mrbb') /* Digite seu telefone */;
      if (value.length < 11) return 'Requires at least 11 characters.';
      return null;
    },
    onSubmitted: () => {
      playSound(model, 'soundPlayer4', 'assets/audios/adriantnt_u_click.mp3', 1.0);
      restartIdleTimer();
    },
  });

  model.formKey.register(nomeField);
  model.formKey.register(whatsField);

  const oficinaDropdown = FlutterFlowDropDown({
    controller: model.dropDownOficinaValueController,
    options: OFICINA_KEYS.map((key) => L(key)),
    onChanged: (value, index) => {
      model.dropDownOficinaValue = value;
      // Guarda a chave, não o rótulo traduzido, para a escolha atravessar a
      // troca de idioma (ver formState no topo).
      formState.oficinaKey = OFICINA_KEYS[index] ?? null;
      playSound(model, 'soundPlayer5', 'assets/audios/adriantnt_u_click.mp3', 1.0);
      restartIdleTimer();
    },
    height: 70.0,
    textStyle: style('bodyMedium', { fontSize: 23.0 }),
    hintText: L('6rvdt37x') /* Escolha o seu seguimento */,
    icon: Icon('keyboard_arrow_down_rounded', { color: TH.secondaryText, size: 62.0 }),
    fillColor: color(0xFF0053B6),
    borderColor: 'transparent',
    borderWidth: 0.0,
    borderRadius: 8.0,
    margin: [12.0, 0.0, 12.0, 0.0],
  });

  /* ------------------------------------------------------ confirm button -- */

  const confirmar = TransformSkew({
    ax: -0.5,
    child: Container({
      width: SW * 0.25,
      height: SH * 0.07,
      color: color(0xFF0053B6),
      borderRadius: 16.0,
      alignment: [0.0, 0.0],
      child: InkWell({
        onTap: async () => {
          playSound(model, 'soundPlayer6', 'assets/audios/undertale-select-sound.mp3', 0.6);
          await animationsMap.transformOnActionTriggerAnimation.controller.forward();

          FFAppState.ordemNumeros = embaralhaQuestoes();
          FFAppState.update();

          if (nomeOfensivo(model.textFieldNomeTextController.text)) {
            await showDialog({ builder: () => NomeOfensivoWidget() });
            model.invalido = model.invalido + 1;
            return;
          }

          if (!model.formKey.validate()) return;

          FFAppState.cadastro = new CadastroStruct({
            nome: model.textFieldNomeTextController.text,
            telefone: model.textFieldWhatsTextController.text,
            atuacao: model.dropDownOficinaValue,
            invalido: model.invalido,
          });
          model.invalido = 0;
          // A partida começou: o formulário guardado já foi consumido, então o
          // próximo jogador encontra a tela em branco.
          resetFormState();

          goNamed('instrucoes', {
            extra: {
              __transition_info__: new TransitionInfo({
                hasTransition: true,
                transitionType: PageTransitionType.scale,
                alignment: Alignment.bottomCenter,
              }),
            },
          });
        },
        child: TransformSkew({
          ax: 0.5,
          child: Align({
            alignment: [0.0, 0.0],
            child: Padding({
              padding: [0.0, 0.0, 16.0, 0.0],
              child: Txt(
                L('kn0wcjje') /* CONFIRMAR */,
                style('bodyMedium', {
                  fontFamily: 'pirulen',
                  color: '#FFFFFF',
                  fontSize: 24.0,
                  letterSpacing: 5.0,
                  fontWeight: 400,
                })
              ),
            }),
          }),
        }),
      }),
    }),
  });
  animateOnPageLoad(confirmar, animationsMap.transformOnPageLoadAnimation);
  animateOnActionTrigger(confirmar, animationsMap.transformOnActionTriggerAnimation);

  /* -------------------------------------------------------------- privacy -- */

  const privacyText = InkWell({
    onTap: async () => {
      await showDialog({
        barrierColor: color(0x8C000000),
        builder: () => PoliticaPrivacidadeWidget(),
      });
    },
    child: Txt(
      L('hjove9jy') /* Ao clicar em continuar você concorda... */,
      style('bodyMedium', { fontStyle: 'italic', color: TH.secondaryText })
    ),
  });
  animateOnPageLoad(privacyText, animationsMap.textOnPageLoadAnimation);

  /* ---------------------------------------------------------- hidden bits -- */
  // The Dart keeps the timer inside an Opacity(0) and prints the total number
  // of `usuarios` rows plus a stray "Hello World" - all invisible or leftover,
  // reproduced so the layout matches.

  const timer = FlutterFlowTimer({
    initialTime: 0,
    controller: model.timerController,
    getDisplayTime: (value) => StopWatchTimer.getDisplayTime(value, { hours: false, milliSecond: false }),
    updateStateInterval: 1000,
    onChanged: (value, displayTime) => {
      model.timerMilliseconds = value;
      model.timerValue = displayTime;
    },
    textAlign: 'start',
    style: style('headlineSmall'),
  });

  /* ------------------------------------------------------------- the tree -- */

  // Each group is a Column(crossAxisAlignment.start) holding a label and a
  // field. Flutter's TextField and dropdown take all the width their parent
  // offers, which makes those Columns as wide as the 1101.8px container; CSS
  // would otherwise shrink-wrap them to the label, hence `width: Infinity`.
  const groups = [
    Padding({
      padding: [0.0, 16.0, 0.0, 0.0],
      style: { alignSelf: 'stretch' },
      child: animateOnPageLoad(
        Column({
          mainAxisSize: 'min',
          crossAxisAlignment: 'start',
          width: Infinity,
          children: [
            fieldLabel('05h1096o' /* Primeiro Nome ( Teclado ) */),
            Container({ width: SW * 1.0, child: nomeField }),
          ],
        }),
        animationsMap.columnOnPageLoadAnimation1
      ),
    }),
    Padding({
      padding: [0.0, 16.0, 0.0, 0.0],
      style: { alignSelf: 'stretch' },
      child: animateOnPageLoad(
        Column({
          mainAxisSize: 'min',
          crossAxisAlignment: 'start',
          width: Infinity,
          children: [fieldLabel('6vx2q4r4' /* Whatsapp ( teclado ) */), whatsField],
        }),
        animationsMap.columnOnPageLoadAnimation2
      ),
    }),
    Padding({
      padding: [0.0, 16.0, 0.0, 32.0],
      style: { alignSelf: 'stretch' },
      child: animateOnPageLoad(
        Column({
          mainAxisSize: 'min',
          crossAxisAlignment: 'start',
          width: Infinity,
          children: [fieldLabel('sfh76esp' /* Tipo da oficina ( Tela ) */), oficinaDropdown],
        }),
        animationsMap.columnOnPageLoadAnimation3
      ),
    }),
    animateOnPageLoad(
      Column({ mainAxisSize: 'max', children: [confirmar] }),
      animationsMap.columnOnPageLoadAnimation4
    ),
    privacyText,
  ];

  const body = Stack({
    children: [
      InkWell({
        onTap: () => {
          playSound(model, 'soundPlayer2', 'assets/audios/adriantnt_u_click.mp3', 1.0);
          restartIdleTimer();
        },
        style: { width: '100%', height: '100%' },
        child: Container({
          width: Infinity,
          height: Infinity,
          image: decorationImage('assets/images/BG_Seleo_Equipamento.png', 'cover'),
          child: el(
            'form',
            {
              style: { display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 },
              onsubmit: (event) => event.preventDefault(),
            },
            Column({
              mainAxisSize: 'max',
              mainAxisAlignment: 'center',
              children: [
                Txt(L('sk6w3j28') /* Hello World */, style('bodyMedium')),
                animateOnPageLoad(
                  ClipRRect({
                    borderRadius: 8.0,
                    child: Img('assets/images/Selo_2.png', { width: SW * 0.23, height: SH * 0.25, fit: 'cover' }),
                  }),
                  animationsMap.imageOnPageLoadAnimation
                ),
                Container({
                  width: SW * 0.574,
                  child: Column({
                    mainAxisSize: 'max',
                    mainAxisAlignment: 'spaceBetween',
                    children: divide(groups, 16.0),
                  }),
                }),
                Opacity({ opacity: 0.0, child: timer }),
                FutureBuilder({
                  future: queryUsuariosRecordCount(),
                  builder: (count) => Txt(String(count), style('bodyMedium')),
                }),
              ],
            })
          ),
        }),
      }),
      StackAlign({
        alignment: [1.0, -1.0],
        child: Padding({
          padding: [0.0, 32.0, 32.0, 0.0],
          child: FlutterFlowLanguageSelector({
            width: 358.57,
            height: 61.2,
            backgroundColor: color(0xFF0053B6),
            borderColor: 'transparent',
            dropdownColor: color(0xFF171212),
            dropdownIconColor: TH.secondaryText,
            borderRadius: 23.0,
            textStyle: style('bodyMedium', { fontSize: 23.0 }),
            currentLanguage: FFLocalizations.languageCode,
            languages: LANGUAGES,
            onChanged: (lang) => setAppLanguage(lang),
          }),
        }),
      }),
    ],
  });

  const root = el('div', { class: 'ff-scaffold', style: { background: color(0xFF000B18) } }, body);
  root.addEventListener('click', unfocus);

  /* --------------------------------------------------------- on page load -- */
  FFAppState.finalizou = false;
  playSound(model, 'soundPlayer1', 'assets/audios/adriantnt_u_click.mp3', 1.0);
  model.timerController.onStartTimer();

  let showingRanking = false;
  model.instantTimer = InstantTimer.periodic({
    duration: 1000,
    startImmediately: true,
    callback: async () => {
      if (model.timerMilliseconds <= 45000 || showingRanking) return;
      model.timerController.onResetTimer();
      model.timerController.onStopTimer();
      showingRanking = true;
      await showDialog({
        builder: () =>
          RankingWidget({
            acao: async () => {
              model.timerController.onResetTimer();
              model.timerController.onStartTimer();
            },
          }),
      });
      showingRanking = false;
    },
  });

  root.__dispose = () => {
    model.instantTimer?.cancel();
    model.timerController.dispose();
  };

  return root;
}
