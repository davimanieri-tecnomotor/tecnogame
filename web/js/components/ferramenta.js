// Port of lib/pages/components/ferramenta/ferramenta_widget.dart
//
// One selectable scanner. The Dart repeats the same block six times, once per
// `ferramenta` value; the differences are only the image, which capability flag
// on the current question gates it, and what `scannerEscolhido` becomes:
//
//   ferramenta | image                     | flag      | scannerEscolhido
//   -----------+---------------------------+-----------+-----------------
//   '3s'       | Rasther_3s_Claro.png      | raster3S  | 'Rasther 3'
//   'td90'     | TD_90_Claro.png           | xtool     | 'Td90'
//   '4s'       | Rasther_3s_Claro.png      | rasher4   | 'Rasther 4'
//   'rb'       | Rasther_Box_Claro.png     | raster3S  | 'RB'
//   'td80'     | TD_90_Claro_(1).png       | xtool     | 'Td80'
//   'rts'      | Rasther_ST_Claro.png      | rasher4   | 'RST'
//
// A disabled scanner is drawn at 0.2 opacity.
//
// NA 3.0 o cartão ganhou corpo:
//
//   - ele INCLINA em 3D na direção do dedo (ou do mouse), como um cartão que
//     se pega na mão — o que diz "isto se escolhe" sem palavra nenhuma;
//   - o escolhido VOA para o centro da tela e "liga" — a tela do equipamento
//     acende — antes de o vídeo entrar;
//   - o incompatível leva o carimbo "INCOMPATÍVEL" e um zumbido, no lugar do
//     aviso em caixa vermelha de antes, que parava o jogo até alguém fechar.

import { ClipRRect, Column, Container, Img, InkWell, Opacity, Stack, StackAlign, color, el, fonte, SW, SH } from '../widgets.js';
import { FFAppState } from '../state.js';
import { Som } from '../som.js';
import { T } from '../textos.js';
import { goNamed } from '../router.js';
import { noPalco } from '../particulas.js';
import {
  AnimationInfo,
  AnimationTrigger,
  Curves,
  ScaleEffect,
  animateOnActionTrigger,
  menosMovimento,
} from '../anim.js';

/**
 * Com que equipamento o jogo segue quando o jogador PULA a escolha (ver
 * `pages/scanner.js`). A tela da pergunta mostra este equipamento na etiqueta
 * "VOCÊ ESTÁ USANDO"; sem um nome conhecido ela cairia no de reserva.
 */
export const EQUIPAMENTO_PADRAO = 'Rasther 3';

/** O que vai para o registro da partida quando ninguém escolheu nada. */
export const EQUIPAMENTO_PULADO = 'não escolhido';

const TOOLS = {
  '3s': { image: 'assets/images/Rasther_3s_Claro.png', flag: 'raster3S', escolhido: 'Rasther 3' },
  td90: { image: 'assets/images/TD_90_Claro.png', flag: 'xtool', escolhido: 'Td90' },
  '4s': { image: 'assets/images/Rasther_3s_Claro.png', flag: 'rasher4', escolhido: 'Rasther 4' },
  rb: { image: 'assets/images/Rasther_Box_Claro.png', flag: 'raster3S', escolhido: 'RB' },
  td80: { image: 'assets/images/TD_90_Claro_(1).png', flag: 'xtool', escolhido: 'Td80' },
  rts: { image: 'assets/images/Rasther_ST_Claro.png', flag: 'rasher4', escolhido: 'RST' },
};

/** Quanto o cartão inclina no máximo, em graus. Mais que isto e a arte distorce. */
const INCLINACAO_MAX = 12;

/**
 * Só uma escolha por tela: dois toques rápidos em dois equipamentos mandariam
 * o jogo navegar duas vezes, com o segundo gravando por cima do primeiro.
 */
let escolhendo = false;
export const liberarEscolha = () => {
  escolhendo = false;
};

/**
 * @param {object} props
 * @param {string} props.ferramenta one of the keys above
 * @param {boolean} props.util the `util` component parameter - declared and
 *   passed by scanner.dart but never read inside the Dart widget.
 */
export function FerramentaWidget({ ferramenta, util } = {}) {
  void util;

  const animationsMap = {
    stackOnActionTriggerAnimation: new AnimationInfo({
      trigger: AnimationTrigger.onActionTrigger,
      applyInitialState: true,
      effectsBuilder: () => [
        ScaleEffect({ curve: Curves.easeInOut, delay: 0.0, duration: 200.0, begin: [1.0, 1.0], end: [0.9, 0.9] }),
        ScaleEffect({ curve: Curves.easeInOut, delay: 200.0, duration: 200.0, begin: [0.9, 0.9], end: [1.0, 1.0] }),
      ],
    }),
  };

  const tool = TOOLS[ferramenta];
  const questao = FFAppState.questoesBrasil[FFAppState.indiceAtual];
  const enabled = Boolean(questao?.[tool.flag]);

  const imagem = Img(tool.image, { width: SW * 0.25, height: SH * 0.35, fit: 'cover' });
  // A inclinação mora num invólucro próprio (`rotate` 3D de CSS) para não
  // disputar `transform` com o aperto do toque, que é do Stack de fora.
  const cartao = el('div', { class: ['eq-cartao', enabled ? null : 'eq-cartao--incompativel'] }, [
    imagem,
    el('div', { class: 'eq-brilho', 'aria-hidden': 'true' }),
  ]);

  // O carimbo entra no Stack, por FORA do `Opacity(0.2)` que apaga o cartão
  // incompatível: dentro dele o carimbo nasceria apagado junto.
  const carimbar = () => {
    Som.carimbo(0);
    root.querySelector('.eq-carimbo')?.remove();
    const carimbo = el('div', { class: 'eq-carimbo', role: 'alert', dataCarimbo: '1' }, [
      el('b', { class: 'ff-text', text: T('incompativel'), style: { fontSize: fonte(40) } }),
      el('span', { class: 'ff-text', text: T('incompativelSub'), style: { fontSize: fonte(17) } }),
    ]);
    root.appendChild(carimbo);
    if (!menosMovimento()) {
      carimbo.animate(
        [
          { transform: 'translate(-50%, -50%) rotate(-14deg) scale(2.4)', opacity: 0 },
          { transform: 'translate(-50%, -50%) rotate(-14deg) scale(.92)', opacity: 1, offset: 0.55 },
          { transform: 'translate(-50%, -50%) rotate(-14deg) scale(1)', opacity: 1 },
        ],
        { duration: 360, easing: 'cubic-bezier(.3,.7,.3,1)' }
      );
      cartao.animate([{ translate: '0 0' }, { translate: '-10px 0' }, { translate: '8px 0' }, { translate: '-4px 0' }, { translate: '0 0' }], {
        duration: 380,
        delay: 180,
      });
    }
    setTimeout(() => {
      if (!carimbo.isConnected) return;
      carimbo.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).finished.then(
        () => carimbo.remove(),
        () => carimbo.remove()
      );
    }, 2200);
  };

  /**
   * O escolhido voa para o centro da tela e "liga" antes de o vídeo entrar.
   *
   * Quem voa é uma CÓPIA solta na página, e não o cartão: ele mora dentro de
   * três caixas que recortam (os Stacks do porte são `Clip.hardEdge`), e o voo
   * sairia cortado na primeira borda.
   */
  const voarELigar = () =>
    new Promise((pronto) => {
      const pagina = root.closest('.ff-page');
      if (menosMovimento() || !pagina) return pronto();
      const [x, y] = noPalco(cartao);
      const stage = document.getElementById('stage').getBoundingClientRect();
      const k = stage.width / 1920 || 1;
      const r = cartao.getBoundingClientRect();
      const w = r.width / k;
      const h = r.height / k;
      const voador = el('div', {
        class: 'eq-voador',
        'aria-hidden': 'true',
        style: { left: `${x - w / 2}px`, top: `${y - h / 2}px`, width: `${w}px`, height: `${h}px` },
      }, [Img(tool.image, { width: w, height: h, fit: 'cover' }), el('div', { class: 'eq-voador-tela' })]);
      pagina.appendChild(voador);
      cartao.style.visibility = 'hidden';
      Som.whoosh(0, 0.45, 0.2);
      voador
        .animate([{ transform: 'translate(0, 0) scale(1)' }, { transform: `translate(${960 - x}px, ${540 - y}px) scale(1.5)` }], {
          duration: 520,
          easing: 'cubic-bezier(.3,.8,.2,1)',
          fill: 'forwards',
        })
        .finished.then(() => {
          voador.classList.add('eq-voador--ligado');
          Som.ronco(0, 0.9);
          Som.brilho(0.2);
          setTimeout(pronto, 700);
        }, pronto);
    });

  const onTap = async () => {
    if (escolhendo) return;
    animationsMap.stackOnActionTriggerAnimation.controller.forward();
    if (!enabled) {
      carimbar();
      return;
    }
    escolhendo = true;
    Som.selecionar();
    // O equipamento é escolhido ANTES de navegar. O Dart gravava depois da
    // chamada e só funcionava por acidente: quem monta a próxima tela lê este
    // valor, e bastava a navegação deixar de ceder o passo para a tela do
    // vídeo abrir com o scanner da partida anterior.
    FFAppState.scannerEscolhido = tool.escolhido;
    FFAppState.equipamentoPulado = false;
    root.closest('.ff-page')?.classList.add('eq-escolhendo');
    await voarELigar();
    goNamed('telaVideoScanner');
  };

  // A inclinação: o ponteiro sobre o cartão vira um ângulo em cada eixo.
  if (!menosMovimento()) {
    cartao.addEventListener('pointermove', (e) => {
      const r = cartao.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      cartao.style.setProperty('--incl-x', `${(-ny * INCLINACAO_MAX * 2).toFixed(2)}deg`);
      cartao.style.setProperty('--incl-y', `${(nx * INCLINACAO_MAX * 2).toFixed(2)}deg`);
      cartao.style.setProperty('--luz-x', `${((nx + 0.5) * 100).toFixed(1)}%`);
      cartao.style.setProperty('--luz-y', `${((ny + 0.5) * 100).toFixed(1)}%`);
      cartao.classList.add('eq-cartao--inclinado');
    });
    cartao.addEventListener('pointerleave', () => cartao.classList.remove('eq-cartao--inclinado'));
  }

  const root = Stack({
    children: [
      StackAlign({
        alignment: [-1.0, -1.0],
        child: Container({
          width: 478.0,
          height: 434.0,
          color: color(0x00FFFFFF),
          child: Column({
            mainAxisSize: 'max',
            mainAxisAlignment: 'start',
            children: [
              Opacity({
                opacity: enabled ? 1.0 : 0.2,
                child: InkWell({
                  onTap,
                  label: tool.escolhido,
                  child: ClipRRect({ borderRadius: 8.0, child: cartao }),
                }),
              }),
            ],
          }),
        }),
      }),
    ],
  });
  root.classList.add('eq-stack');
  root.dataset.ferramenta = ferramenta;

  return animateOnActionTrigger(root, animationsMap.stackOnActionTriggerAnimation);
}
