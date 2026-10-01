// Port of lib/pages/escolha/cadastro/cadastro_widget.dart
//
// "Tela destinada ao cadasrto do usuário" - name, WhatsApp, workshop type.
// A count-up timer runs in the background; after 45 idle seconds the attract
// mode takes over the screen. Any tap, submit or dropdown change resets it.
//
// E o prazo de inatividade do jogo inteiro (quatro minutos, inatividade.js)
// passa por aqui também: uma ficha começada e largada é apagada.
//
// NA 3.0: o selo ganhou as lâmpadas acesas correndo (components/selo.js), e
// os 45s parados abrem o modo de atração (components/atracao.js) no lugar da
// lista de nomes rolando.
//
// NA 3.1: a ficha virou um cartão de vidro escuro no palco, com o CONFIRMAR em
// ouro — a cor dos botões de decisão do jogo inteiro (components/botao.js). O
// azul de antes era o mesmo dos campos, e o botão se perdia entre eles. As
// peças entram subindo em ~1,2s (eram 2,6s vindo da esquerda). E confirmar
// chama o jogador ao palco: o nome digitado voa do campo e vira o "COM VOCÊS:
// DAVI!" (ver transicoes.js).

import {
  Align,
  Column,
  Container,
  Icon,
  InkWell,
  Opacity,
  Padding,
  Stack,
  StackAlign,
  Txt,
  TransformSkew,
  color,
  divide,
  el,
  unfocus,
  SW,
  SH,
} from '../widgets.js';
import { TH, style } from '../theme.js';
import { L, FFLocalizations, LANGUAGES, setAppLanguage } from '../i18n.js';
import { T } from '../textos.js';
import { CadastroStruct, FFAppState } from '../state.js';
import { embaralhaQuestoes, nomeOfensivo, primeiroNome } from '../functions.js';
import { Som } from '../som.js';
import { humor } from '../palco.js';
import { criarRoteiro } from '../roteiro.js';
import { showDialog } from '../dialog.js';
import { NomeOfensivoWidget } from '../components/nome_ofensivo.js';
import { PoliticaPrivacidadeWidget } from '../components/politica_privacidade.js';
import { AtracaoWidget } from '../components/atracao.js';
import { SeloComLampadas } from '../components/selo.js';
import { registrarToqueSecreto } from '../admin/porta.js';
import { sincronizarBaralho } from '../nuvem.js';
import { adiantarOPercurso } from '../precarga.js';
import { chamarAoPalco } from '../transicoes.js';
import { go, goNamed } from '../router.js';
import {
  AnimationInfo,
  AnimationTrigger,
  Curves,
  ScaleEffect,
  animateOnActionTrigger,
  animateOnPageLoad,
  entrar,
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

/**
 * A entrada das peças: sobem 36px e acendem, uma depois da outra.
 *
 * No Dart elas vinham da esquerda com atrasos de 500 a 2000ms e 1200ms cada —
 * o CONFIRMAR só aparecia 2,6s depois de a tela abrir. Agora a ficha inteira
 * está de pé em ~1,2s. `translate` e `scale` (e não `transform`): o selo e o CONFIRMAR têm
 * animação própria em `transform`, e propriedades separadas não disputam com ela.
 */
const subir = (no, delay) =>
  entrar(
    no,
    [
      { opacity: 0, translate: '0 36px', filter: 'blur(6px)' },
      { opacity: 1, translate: '0 0', filter: 'blur(0px)' },
    ],
    { duration: 520, delay, easing: 'cubic-bezier(.2,.8,.25,1)' }
  );

/** A cor do texto de dica: clara o bastante para ler, apagada o bastante para não parecer resposta. */
const COR_DA_DICA = '#94AEDA';

/** O fundo e a borda dos campos — os mesmos para os quatro, idioma incluso. */
const CAMPO_FUNDO = 'rgba(0, 26, 80, 0.78)';
const CAMPO_BORDA = 'rgba(120, 175, 255, 0.42)';

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

/** Alguém começou a preencher? Decide se o prazo de inatividade tem o que apagar. */
const fichaComecada = () =>
  Boolean(formState.nome.text || formState.whats.text || formState.oficinaKey || formState.invalido);


export function CadastroWidget() {
  const roteiro = criarRoteiro();
  let left = false;
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
    transformOnActionTriggerAnimation: new AnimationInfo({
      trigger: AnimationTrigger.onActionTrigger,
      applyInitialState: true,
      effectsBuilder: () => [
        ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 200.0, begin: [1.0, 1.0], end: [0.9, 0.9] }),
        ScaleEffect({ curve: Curves.easeInOut, delay: 200.0, duration: 200.0, begin: [0.9, 0.9], end: [1.0, 1.0] }),
      ],
    }),
  };

  /** Every interaction on this page restarts the idle countdown. */
  const restartIdleTimer = () => {
    model.timerController.onResetTimer();
    model.timerController.onStartTimer();
  };

  /* --------------------------------------------------------------- fields -- */

  // Recebe o TEXTO, e nao a chave: os rotulos deste formulario deixaram de sair
  // de `translations.js`, que os trazia com a anotacao "( Teclado )"/"( Tela )"
  // do projeto Dart colada no fim. Ver o cabecalho de textos.js.
  const fieldLabel = (texto) => {
    const rotulo = Txt(
      texto,
      style('bodyMedium', {
        fontFamily: 'pirulen',
        color: '#DCE8FF',
        fontSize: 24.0,
        letterSpacing: 3.0,
        fontWeight: 400,
      })
    );
    // O losango de ouro antes do rótulo (auditorio.css) é o mesmo dos botões.
    rotulo.classList.add('cad-rotulo');
    return Padding({ padding: [0.0, 0.0, 0.0, 14.0], child: rotulo });
  };

  const nomeField = TextFormField({
    controller: model.textFieldNomeTextController,
    hintText: L('b4pv213k') /* Digite aqui seu nome */,
    // A dica era branca como o texto digitado: o campo vazio parecia preenchido.
    hintStyle: style('labelMedium', { color: COR_DA_DICA, fontSize: 23.0 }),
    errorStyle: style('bodyMedium', { color: TH.error, fontSize: 23.0 }),
    style: style('bodyMedium', { color: '#FFFFFF', fontSize: 32.0 }),
    fillColor: CAMPO_FUNDO,
    borderRadius: 12.0,
    borderColor: CAMPO_BORDA,
    borderWidth: 2,
    errorColor: TH.error,
    maxLength: 30,
    cursorColor: TH.primaryText,
    validator: (value) => (value == null || value.length === 0 ? L('ra9dcpxq') /* Digite seu nome */ : null),
    onSubmitted: () => {
      Som.clique();
      restartIdleTimer();
    },
  });

  const whatsField = TextFormField({
    controller: model.textFieldWhatsTextController,
    hintText: L('559rlm5s') /* Digite o seu número */,
    hintStyle: style('labelMedium', { color: COR_DA_DICA, fontSize: 23.0 }),
    errorStyle: style('bodyMedium', { color: TH.error, fontSize: 23.0 }),
    style: style('bodyMedium', { color: '#FFFFFF', fontSize: 32.0 }),
    fillColor: CAMPO_FUNDO,
    borderRadius: 12.0,
    borderColor: CAMPO_BORDA,
    borderWidth: 2,
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
      Som.clique();
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
      pintarOficina();
      Som.clique();
      restartIdleTimer();
    },
    height: 70.0,
    textStyle: style('bodyMedium', { fontSize: 23.0 }),
    hintText: L('6rvdt37x') /* Escolha o seu seguimento */,
    icon: Icon('keyboard_arrow_down_rounded', { color: '#FFC21A', size: 62.0 }),
    fillColor: CAMPO_FUNDO,
    // A lista aberta passa por cima dos outros campos: com o fundo translúcido
    // do campo, os rótulos de trás apareciam através das opções.
    menuColor: '#06205E',
    borderColor: CAMPO_BORDA,
    borderWidth: 2.0,
    borderRadius: 12.0,
    margin: [12.0, 0.0, 12.0, 0.0],
  });
  // A dica do dropdown sai no mesmo estilo da escolha (é o mesmo rótulo), e
  // por isso é pintada à mão: apagada enquanto nada foi escolhido.
  const rotuloDaOficina = oficinaDropdown.querySelector('.ff-dropdown > .ff-text');
  function pintarOficina() {
    if (rotuloDaOficina) rotuloDaOficina.style.color = formState.oficinaKey ? '#FFFFFF' : COR_DA_DICA;
  }
  pintarOficina();

  /* ------------------------------------------------------ confirm button -- */

  // O InkWell embrulha o BOTÃO, e não o texto dentro dele.
  //
  // No Dart ele estava por dentro do Container, e o Container centraliza o
  // filho: o alvo era o tamanho da palavra "CONFIRMAR", e todo o azul em volta
  // não respondia a nada. Numa tela de toque isso é um botão que parece
  // quebrado — o dedo acerta o retângulo e não acontece nada.
  //
  // Por fora, o alvo passa a ser exatamente a forma azul que se vê (o
  // `TransformSkew` é o pai, então a inclinação vale para o acerto também), e o
  // afundar do `.ff-press` passa a ser do botão inteiro em vez de só da palavra.
  //
  // Em ouro desde a 3.1, e maior (88px de altura; era 76): é a cor de decisão
  // do jogo inteiro, e o azul de antes era o dos campos — o botão se perdia.
  let caixaDoConfirmar = null;
  const confirmar = TransformSkew({
    ax: -0.5,
    child: InkWell({
      label: 'CONFIRMAR',
      onTap: async () => {
          Som.selecionar();
          animationsMap.transformOnActionTriggerAnimation.controller.forward();

          FFAppState.ordemNumeros = embaralhaQuestoes();
      
          if (nomeOfensivo(model.textFieldNomeTextController.text)) {
            // Conta ANTES de abrir o aviso, e não depois de ele fechar, como no
            // Dart. Quem digita um nome ofensivo e vai embora deixa o aviso
            // aberto; quando o prazo de inatividade apaga a ficha, o aviso
            // fecha junto — e a conta que viesse depois do `await` cairia na
            // ficha limpa, marcando o próximo jogador.
            model.invalido = model.invalido + 1;
            await showDialog({ builder: () => NomeOfensivoWidget() });
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

          // O nome digitado voa do campo e vira o "COM VOCÊS: DAVI!" — ver
          // transicoes.js. Resolve com o anúncio na tela, e a lâmina o leva.
          await chamarAoPalco({
            raiz: root,
            campoDoNome: grupoNome.querySelector('input'),
            nome: primeiroNome(FFAppState.cadastro.nome),
            pecas: [privacyText, blocoConfirmar, grupoOficina, grupoWhats, grupoNome, seletorDeIdioma],
            ficha,
            selo,
            botao: confirmar,
            roteiro,
          });
          if (left) return;
          goNamed('instrucoes');
        },
      child: caixaDoConfirmar = Container({
        width: SW * 0.29,
        height: 88.0,
        // `gradient`, e não `color`: a abreviação `background` que `color`
        // escreve inline zeraria o degradê (ver o CLAUDE.md).
        gradient: 'linear-gradient(180deg, #fff1b8 0%, #ffc21a 50%, #e88a00 100%)',
        borderRadius: 16.0,
        alignment: [0.0, 0.0],
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
                  color: '#231500',
                  fontSize: 28.0,
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
  animateOnActionTrigger(confirmar, animationsMap.transformOnActionTriggerAnimation);
  // O brilho que passa pelo botão, como nos botões do apresentador: diz "é
  // aqui" sem piscar. Mora num ::after (auditorio.css). E o halo que respira
  // em volta é de CSS (`.cad-confirmar`), e não o laço de escala do Dart: laço
  // de WAAPI segura a tela na memória (ver `encerrarAnimacoes`).
  caixaDoConfirmar.classList.add('aud-brilho', 'cad-confirmar');

  /* -------------------------------------------------------------- privacy -- */

  // Esta linha é a ÚNICA porta para a política de privacidade, e não parecia
  // uma: itálico cinza, sem sublinhado, do tamanho de um rodapé. Numa tela que
  // pede nome e telefone, o caminho para ler o que se está aceitando tem de se
  // anunciar — daí o sublinhado e o texto claro. E a frase dizia "ao clicar em
  // continuar" para um botão que se chama CONFIRMAR (ver textos.js).
  const privacyText = InkWell({
    onTap: async () => {
      await showDialog({
        barrierColor: color(0x8C000000),
        builder: () => PoliticaPrivacidadeWidget(),
      });
    },
    child: Txt(
      T('avisoPrivacidade'),
      style('bodyMedium', { color: '#CFE3FF', fontSize: 17.0, decoration: 'underline' })
    ),
  });

  /* ---------------------------------------------------------- hidden bits -- */
  // O cronometro conta a inatividade e nao e para ser visto: fica num
  // Opacity(0), como no Dart.
  //
  // O Dart tambem imprimia aqui um "Hello World" solto e a CONTAGEM de linhas
  // de `usuarios` — 14px, visiveis, na primeira tela que o jogador ve, e a
  // contagem disparava uma consulta a cada abertura do cadastro. Os dois eram
  // lixo do FlutterFlow reproduzido por fidelidade, e sairam.

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
  const grupoNome = Padding({
    padding: [0.0, 16.0, 0.0, 0.0],
    style: { alignSelf: 'stretch' },
    child: Column({
      mainAxisSize: 'min',
      crossAxisAlignment: 'start',
      width: Infinity,
      children: [
        fieldLabel(T('rotuloNome')),
        Container({ width: SW * 1.0, child: nomeField }),
      ],
    }),
  });

  const grupoWhats = Padding({
    padding: [0.0, 16.0, 0.0, 0.0],
    style: { alignSelf: 'stretch' },
    child: Column({
      mainAxisSize: 'min',
      crossAxisAlignment: 'start',
      width: Infinity,
      children: [fieldLabel(T('rotuloWhatsapp')), whatsField],
    }),
  });

  const grupoOficina = Padding({
    padding: [0.0, 16.0, 0.0, 24.0],
    style: { alignSelf: 'stretch' },
    child: Column({
      mainAxisSize: 'min',
      crossAxisAlignment: 'start',
      width: Infinity,
      children: [fieldLabel(T('rotuloOficina')), oficinaDropdown],
    }),
  });

  const blocoConfirmar = Column({ mainAxisSize: 'max', children: [confirmar] });

  const groups = [grupoNome, grupoWhats, grupoOficina, blocoConfirmar, privacyText];

  // O selo é também a porta da administração: cinco toques nele, dentro de 3s,
  // pedem a senha. Não tem marca nenhuma de propósito — é para o operador, não
  // para o jogador.
  //
  // As lâmpadas acesas correndo em volta do logo são as da própria arte,
  // medidas no PNG (ver components/selo.js). A caixa e o enquadramento são os
  // de sempre — 23% x 25% do palco, `cover` —, então o cadastro não mexe um
  // pixel de lugar.
  const selo = registrarToqueSecreto(
    animateOnPageLoad(
      SeloComLampadas({ largura: SW * 0.23, altura: SH * 0.25, enquadramento: 'cover' }),
      animationsMap.imageOnPageLoadAnimation
    )
  );

  const seletorDeIdioma = FlutterFlowLanguageSelector({
    width: 358.57,
    height: 61.2,
    backgroundColor: CAMPO_FUNDO,
    borderColor: CAMPO_BORDA,
    dropdownColor: color(0xFF171212),
    dropdownIconColor: '#FFC21A',
    borderRadius: 23.0,
    textStyle: style('bodyMedium', { fontSize: 23.0 }),
    currentLanguage: FFLocalizations.languageCode,
    languages: LANGUAGES,
    onChanged: (lang) => setAppLanguage(lang),
  });

  // O cartão atrás da ficha. É irmão das peças, e não pai: uma caixa pintada
  // por fora dos campos contaria como "botão" no verify:teclado, que mede se o
  // alvo de toque cobre a caixa pintada em volta dele.
  const ficha = el('div', { class: 'cad-ficha', 'aria-hidden': 'true' });
  const formulario = Container({
    width: SW * 0.574,
    child: Column({
      mainAxisSize: 'max',
      mainAxisAlignment: 'spaceBetween',
      children: divide(groups, 16.0),
    }),
  });
  formulario.classList.add('cad-formulario');
  formulario.prepend(ficha);

  // A entrada: o selo desce, o cartão abre, as peças sobem uma a uma, e o
  // CONFIRMAR chega por último, saltando — é o que o jogador tem de achar.
  entrar(
    selo,
    [
      { opacity: 0, translate: '0 -70px', scale: '0.86' },
      { opacity: 1, translate: '0 6px', scale: '1.02', offset: 0.7 },
      { opacity: 1, translate: '0 0', scale: '1' },
    ],
    { duration: 700, easing: 'cubic-bezier(.2,.8,.25,1)' }
  );
  entrar(ficha, [{ opacity: 0, scale: '0.95' }, { opacity: 1, scale: '1' }], {
    duration: 560,
    delay: 120,
    easing: 'cubic-bezier(.2,.8,.25,1)',
  });
  subir(grupoNome, 260);
  subir(grupoWhats, 360);
  subir(grupoOficina, 460);
  entrar(
    blocoConfirmar,
    [
      { opacity: 0, scale: '0.7' },
      { opacity: 1, scale: '1.06', offset: 0.65 },
      { opacity: 1, scale: '1' },
    ],
    { duration: 520, delay: 600, easing: 'cubic-bezier(.2,.8,.25,1)' }
  );
  entrar(privacyText, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 780 });
  entrar(seletorDeIdioma, [{ opacity: 0, translate: '40px 0' }, { opacity: 1, translate: '0 0' }], {
    duration: 520,
    delay: 300,
    easing: 'cubic-bezier(.2,.8,.25,1)',
  });

  const body = Stack({
    children: [
      InkWell({
        onTap: () => {
          Som.clique();
          restartIdleTimer();
        },
        // Cobre a tela inteira so para captar o toque no fundo e reiniciar a
        // contagem de inatividade: nao e um botao, e nao deve afundar.
        feedback: false,
        style: { width: '100%', height: '100%' },
        // Sem a arte de fundo: desde a 3.0 ela mora no palco (#fundo, ver
        // palco.js), com os refletores por cima. Pintá-la aqui apagaria a luz.
        child: Container({
          width: Infinity,
          height: Infinity,
          child: el(
            'form',
            {
              style: { display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 },
              onsubmit: (event) => event.preventDefault(),
            },
            Column({
              mainAxisSize: 'max',
              mainAxisAlignment: 'center',
              children: [selo, formulario, Opacity({ opacity: 0.0, child: timer })],
            })
          ),
        }),
      }),
      StackAlign({
        alignment: [1.0, -1.0],
        child: Padding({
          padding: [0.0, 32.0, 32.0, 0.0],
          child: seletorDeIdioma,
        }),
      }),
    ],
  });

  const root = el('div', { class: 'ff-scaffold pg-cadastro' }, body);
  root.addEventListener('click', unfocus);

  /* --------------------------------------------------------- on page load -- */
  // Um jogador novo comecando e o momento de pegar o que a area administrativa
  // publicou desde a ultima partida.
  FFAppState.recarregarBaralho();
  // Com o baralho desta partida em mãos, pede já as imagens da roleta: daqui
  // até ela o jogador atravessa a tela de instruções e a vinheta, e é tempo de
  // sobra para nenhuma fatia nascer vazia (ver precarga.js).
  adiantarOPercurso(FFAppState.baralho);
  // E puxa da nuvem em paralelo. Sem esperar: a tela não pode ficar refém da
  // internet da feira. Se vier conteúdo novo enquanto o jogador ainda está se
  // cadastrando, ele já vale para esta partida; senão, para a próxima.
  sincronizarBaralho().then((mudou) => {
    if (mudou && root.isConnected) {
      FFAppState.recarregarBaralho();
      // Baralho novo, fotos novas: quem chegou agora ainda não foi pedido.
      adiantarOPercurso(FFAppState.baralho);
    }
  });
  FFAppState.finalizou = false;
  model.timerController.onStartTimer();

  // 45s parado, e o modo de atração toma a tela. Fechado por um toque, a
  // contagem recomeça: é o laço de fliperama — atração, convite, espera,
  // atração de novo. No Dart a contagem ficava parada depois de fechar, e a
  // atração só voltava se alguém tocasse no fundo do cadastro.
  let mostrandoAtracao = false;
  model.instantTimer = InstantTimer.periodic({
    duration: 1000,
    startImmediately: true,
    callback: async () => {
      if (model.timerMilliseconds <= 45000 || mostrandoAtracao) return;
      model.timerController.onResetTimer();
      model.timerController.onStopTimer();
      mostrandoAtracao = true;
      humor('atracao');
      // A ficha sai de cena por baixo da atração (e a barreira quase não
      // escurece): assim o que aparece atrás do letreiro é o estúdio com os
      // refletores varrendo, e não um formulário apagado.
      root.classList.add('atr-escondido');
      await showDialog({ builder: () => AtracaoWidget(), barrierColor: 'rgba(0, 6, 17, 0.25)' });
      root.classList.remove('atr-escondido');
      mostrandoAtracao = false;
      // `left` e não `isConnected`: numa troca de tela a lâmina ainda mostra
      // esta página por um instante, e o humor da tela seguinte não pode ser
      // desfeito por quem já saiu.
      if (left) return;
      humor('repouso');
      restartIdleTimer();
    },
  });

  root.__dispose = () => {
    left = true;
    roteiro.encerrar();
    model.instantTimer?.cancel();
    model.timerController.dispose();
  };

  // O prazo de inatividade vale para toda tela (inatividade.js), mas aqui ele
  // faz outra coisa: o cadastro já é o começo, e não há para onde voltar. Sai
  // só a ficha de quem desistiu no meio, para o próximo visitante não achar o
  // nome e o telefone dessa pessoa. Sem nada digitado não há o que apagar, e o
  // modo de atração continua na tela.
  root.__aoExpirar = () => {
    if (!fichaComecada()) return;
    resetFormState();
    // `go`, e não `goNamed`: é a MESMA tela refeita, como na troca de idioma.
    go(location.hash.slice(1) || '/');
  };

  return root;
}
