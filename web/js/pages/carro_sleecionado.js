// Port of lib/pages/carro_sleecionado/carro_sleecionado_widget.dart
//
// Reveals the car the wheel landed on, then fades out and moves to the scanner
// picker after 6s.
//
// A ENTRADA. O Dart escalava de [-1, -1] até [1, 1]: escala negativa é
// ESPELHAMENTO, então o carro nascia invertido, encolhia até sumir num ponto e
// voltava desvirado — era isso o "o carro vem ao contrário". Trocamos por uma
// entrada que tem a ver com o que acabou de acontecer na tela anterior: a roda
// parou, e o prêmio chega.
//
//   - o carro entra pela direita com velocidade e freia, passando um pouco do
//     ponto e voltando (o mesmo excesso amortecido do recuo da roleta);
//   - a placa com o nome bate depois, como carimbo;
//   - pousado, o carro respira devagar, para os segundos que sobram até a
//     próxima tela não serem uma foto parada.

import { Align, Column, Container, Padding, Txt, decorationImage, el, color, unfocus } from '../widgets.js';
import { style } from '../theme.js';
import { FFAppState } from '../state.js';
import { EQUIPAMENTO_PADRAO } from '../components/ferramenta.js';
import { CarroFotoWidget } from '../components/carro_foto.js';
import { goNamed } from '../router.js';
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
} from '../anim.js';


export function CarroSleecionadoWidget() {
  let left = false;

  const animationsMap = {
    // A chegada: entra pela direita, freia passando do ponto e volta.
    //
    // O excesso é o que faz parecer massa em movimento e não uma imagem sendo
    // posicionada — o mesmo motivo do recuo da roleta. São três trechos porque
    // o motor de efeitos interpola por pedaço: corrida, passagem do ponto,
    // acomodação.
    carroOnPageLoadAnimation: new AnimationInfo({
      trigger: AnimationTrigger.onPageLoad,
      applyInitialState: true,
      effectsBuilder: () => [
        FadeEffect({ curve: Curves.easeOut, delay: 120.0, duration: 260.0, begin: 0.0, end: 1.0 }),
        MoveEffect({ curve: Curves.easeOut, delay: 120.0, duration: 620.0, begin: [620.0, 0.0], end: [-26.0, 0.0] }),
        MoveEffect({ curve: Curves.easeInOut, delay: 740.0, duration: 260.0, begin: [-26.0, 0.0], end: [9.0, 0.0] }),
        MoveEffect({ curve: Curves.easeInOut, delay: 1000.0, duration: 220.0, begin: [9.0, 0.0], end: [0.0, 0.0] }),
        // Um respiro de 1,02 enquanto o carro corre: dá peso à frenagem.
        ScaleEffect({ curve: Curves.easeOut, delay: 120.0, duration: 620.0, begin: [1.05, 1.05], end: [1.02, 1.02] }),
        ScaleEffect({ curve: Curves.easeInOut, delay: 740.0, duration: 480.0, begin: [1.02, 1.02], end: [1.0, 1.0] }),
      ],
    }),
    // A placa do nome, batendo depois que o carro para.
    nomeOnPageLoadAnimation: new AnimationInfo({
      trigger: AnimationTrigger.onPageLoad,
      applyInitialState: true,
      effectsBuilder: () => [
        FadeEffect({ curve: Curves.easeOut, delay: 900.0, duration: 180.0, begin: 0.0, end: 1.0 }),
        ScaleEffect({ curve: Curves.easeOut, delay: 900.0, duration: 300.0, begin: [1.32, 1.32], end: [0.98, 0.98] }),
        ScaleEffect({ curve: Curves.easeInOut, delay: 1200.0, duration: 180.0, begin: [0.98, 0.98], end: [1.0, 1.0] }),
      ],
    }),
    columnOnActionTriggerAnimation: new AnimationInfo({
      trigger: AnimationTrigger.onActionTrigger,
      applyInitialState: true,
      effectsBuilder: () => [
        FadeEffect({ curve: Curves.easeOut, delay: 0.0, duration: 1220.0, begin: 1.0, end: 0.0 }),
      ],
    }),
  };

  const foto = CarroFotoWidget();
  animateOnPageLoad(foto, animationsMap.carroOnPageLoadAnimation);

  // O respiro parado fica NO INVÓLUCRO, e não na foto: a entrada escreve
  // `transform` na foto pela Web Animations API, e uma animação CSS de
  // transform no mesmo elemento seria simplesmente ignorada. Em pai e filho as
  // duas se compõem.
  const carro = el('div', { class: 'ff-carro-respira' }, foto);

  // O nome vinha de uma tabela fixa por indice no Dart (que, aliás, nao era o
  // campo `nome` da questao — esse o jogo nunca exibia). Agora e o nome do
  // veiculo da rodada.
  const nome = Txt(FFAppState.slotAtual?.veiculo?.nome || 'SEM CARRO SELECIONADO', {
    ...style('bodyMedium', {
      fontFamily: 'Roboto',
      fontWeight: 700,
      color: '#FFFFFF',
      fontSize: 70.0,
      letterSpacing: 5.0,
    }),
  });
  animateOnPageLoad(nome, animationsMap.nomeOnPageLoadAnimation);

  const content = Column({
    mainAxisSize: 'max',
    children: [carro, Padding({ padding: [0.0, 52.0, 0.0, 0.0], child: nome })],
  });
  animateOnActionTrigger(content, animationsMap.columnOnActionTriggerAnimation);

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

  delayed(6000).then(async () => {
    if (left || !root.isConnected) return;
    // Sequencia de verdade: e a animacao de SAIDA da tela, antes de navegar.
    // Quando o roteador esmaece a pagina, o conteudo daqui ja apagou sozinho —
    // o que sobra para o jogador ver e a entrada da proxima.
    await animationsMap.columnOnActionTriggerAnimation.controller.forward();
    if (left || !root.isConnected) return;

    // A PERGUNTA PODE DISPENSAR A ESCOLHA DO EQUIPAMENTO.
    //
    // É uma marca do baralho, por pergunta (`pularEquipamento`, ver deck.js):
    // há pergunta que não depende de scanner nenhum, e para essa a tela dos
    // cinco equipamentos é uma parada sem decisão — em feira cheia, é a fila
    // parada. Quem pula joga com o equipamento padrão, que é o que dá ao painel
    // da pergunta uma pele inteira em vez do cinza de reserva, e não vê o vídeo
    // demonstrativo: ele é a apresentação do equipamento ESCOLHIDO, e aqui não
    // houve escolha. O registro da partida diz isso com todas as letras (ver
    // `equipamentoDaPartida`, em perguntas_erespostas.js).
    if (FFAppState.questoesBrasil[FFAppState.indiceAtual]?.pularEquipamento) {
      FFAppState.scannerEscolhido = EQUIPAMENTO_PADRAO;
      FFAppState.equipamentoPulado = true;
      goNamed('telaAcao');
      return;
    }
    goNamed('scanner');
  });

  root.__dispose = () => {
    left = true;
  };

  return root;
}
