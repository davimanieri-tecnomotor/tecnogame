// "Como funciona o jogo" — reescrita na 3.1.
//
// O Dart tocava aqui um vídeo (Instrucao.mp4): a tela da pergunta da época num
// monitor, com quatro chamadas coloridas — o defeito, as 4 alternativas, as 2
// ajudas e o relógio 00:60:00. A 3.0 virou programa de auditório e aquela tela
// deixou de existir; o vídeo passou a ensinar uma interface que o jogador não
// ia encontrar. E vídeo não acompanha mudança: teria de ser refeito a cada uma.
//
// Agora a explicação é a própria tela nova. Uma captura da pergunta
// (`Como_Funciona_Pergunta.jpg`) entra num monitor — o mesmo enquadramento do
// vídeo, que o público já conhecia — e os passos chegam um a um. Cada passo
// acende, na captura, a peça de que fala, na cor dele, e escurece o resto: o
// olho vai do texto à peça sem precisar procurar.
//
// SE A TELA DA PERGUNTA MUDAR DE CARA, refaça a captura (estilo clássico,
// 1280x720, com o relógio correndo) e meça de novo as `REGIOES`, que estão em
// px do palco de 1920x1080 — o retângulo de cada peça na tela de verdade.
//
// Segue sozinha em 15s — o tempo de os cinco passos chegarem e ainda sobrar
// leitura —, ou antes, por "Pular instruções" (ou Enter).

import { el, fonte, unfocus } from '../widgets.js';
import { entrar, menosMovimento } from '../anim.js';
import { L } from '../i18n.js';
import { T } from '../textos.js';
import { Som } from '../som.js';
import { goNamed, serializeParam } from '../router.js';
import { registrarComandos } from '../comandos.js';
import { BotaoDeAuditorio } from '../components/botao.js';

const NEXT = () => goNamed('telaVideoTransisao', { queryParameters: { tipo: serializeParam(1) } });

/** Quanto a tela espera antes de seguir sozinha. */
const SEGUE_SOZINHA_MS = 15000;
/** Quando entra o primeiro passo, e de quanto em quanto entram os outros. */
const PRIMEIRO_PASSO_MS = 900;
const ENTRE_PASSOS_MS = 2300;

/** A captura, e a caixa da tela do monitor em px do palco (16:9, como ela). */
const CAPTURA = 'assets/images/Como_Funciona_Pergunta.jpg';
const TELA = { x: 820, y: 236, w: 1040, h: 585 };

/**
 * Onde cada peça está na tela da pergunta, em px do palco: `[x0, y0, x1, y1]`,
 * medidos no DOM no momento da captura.
 */
const REGIOES = {
  defeito: [60, 196, 1020, 462],
  alternativas: [60, 486, 1020, 980],
  ajudas: [1104, 846, 1904, 1016],
  cronometro: [1584, 4, 1874, 323],
};

/** Os passos, na ordem em que o jogador vive a pergunta. `regiao` null: não há peça a apontar. */
const PASSOS = [
  { cor: '#FF4D4D', regiao: 'defeito', titulo: 'comoPassoDefeito', sub: 'comoPassoDefeitoSub' },
  { cor: '#FFC21A', regiao: 'alternativas', titulo: 'comoPassoResposta', sub: 'comoPassoRespostaSub' },
  { cor: '#2BD96B', regiao: 'ajudas', titulo: 'comoPassoAjudas', sub: 'comoPassoAjudasSub' },
  { cor: '#E040FB', regiao: 'cronometro', titulo: 'comoPassoTempo', sub: 'comoPassoTempoSub' },
  { cor: '#22D3EE', regiao: null, titulo: 'comoPassoRanking', sub: 'comoPassoRankingSub' },
];

/** O caminho até a pergunta — o que vem antes dela, numa linha. */
const CAMINHO = ['comoCaminhoRoleta', 'comoCaminhoEquipamento', 'comoCaminhoDefeito'];

/** A cor do passo vai numa variável de CSS: o `style` de `el()` não escreve `--x`. */
const comCor = (no, cor) => {
  no.style.setProperty('--cor', cor);
  return no;
};

/** Uma região do palco, na escala da captura, com uma folga em volta. */
function naCaptura([x0, y0, x1, y1], folga = 8) {
  const k = TELA.w / 1920;
  return {
    left: `${Math.max(0, (x0 - folga) * k).toFixed(1)}px`,
    top: `${Math.max(0, (y0 - folga) * k).toFixed(1)}px`,
    width: `${(Math.min(1920, x1 + folga) - Math.max(0, x0 - folga)) * k}px`,
    height: `${(Math.min(1080, y1 + folga) - Math.max(0, y0 - folga)) * k}px`,
  };
}

export function InstrucoesWidget() {
  let saiu = false;
  const timers = [];
  const depois = (ms, fn) => timers.push(setTimeout(() => !saiu && fn(), ms));

  const pular = () => {
    if (saiu) return;
    saiu = true;
    Som.clique();
    NEXT();
  };

  /* ------------------------------------------------------------ o alto ---- */

  const titulo = el('div', { class: 'ff-text ins-titulo aud-oculta', text: T('comoFunciona'), style: { fontSize: fonte(52) } });
  const caminho = el(
    'div',
    { class: 'ins-caminho aud-oculta' },
    CAMINHO.flatMap((chave, i) => [
      i ? el('span', { class: 'ins-caminho-seta', 'aria-hidden': 'true', text: '›' }) : null,
      el('span', { class: ['ff-text', 'ins-caminho-item', i === CAMINHO.length - 1 ? 'ins-caminho-item--aqui' : null], text: T(chave), style: { fontSize: fonte(20) } }),
    ])
  );

  /* ---------------------------------------------------------- os passos --- */

  const passos = PASSOS.map((p, i) =>
    comCor(el('div', { class: 'ins-passo aud-oculta', dataPasso: String(i + 1) }, [
      el('b', { class: 'ff-text ins-passo-num', text: String(i + 1), style: { fontSize: fonte(34) } }),
      el('div', { class: 'ins-passo-texto' }, [
        el('div', { class: 'ff-text ins-passo-titulo', text: T(p.titulo), style: { fontSize: fonte(25) } }),
        el('div', { class: 'ff-text ins-passo-sub', text: T(p.sub), style: { fontSize: fonte(21) } }),
      ]),
    ]), p.cor)
  );

  /* -------------------------------------------------------- o monitor ----- */

  const destaques = PASSOS.map((p, i) =>
    p.regiao
      ? comCor(
          el('div', { class: 'ins-destaque aud-oculta', dataDestaque: String(i + 1), style: naCaptura(REGIOES[p.regiao]) }, [
            el('b', { class: 'ff-text ins-destaque-num', text: String(i + 1), style: { fontSize: fonte(24) } }),
          ]),
          p.cor
        )
      : null
  );
  const tela = el('div', { class: 'ins-tela', style: { width: `${TELA.w}px`, height: `${TELA.h}px` } }, [
    el('img', { src: CAPTURA, alt: '', draggable: 'false', width: String(TELA.w), height: String(TELA.h) }),
    ...destaques.filter(Boolean),
  ]);
  const monitor = el('div', { class: 'ins-monitor aud-oculta', style: { left: `${TELA.x - 14}px`, top: `${TELA.y - 14}px` } }, [
    tela,
    el('div', { class: 'ins-monitor-pe', 'aria-hidden': 'true' }),
    el('div', { class: 'ins-monitor-base', 'aria-hidden': 'true' }),
  ]);

  /* --------------------------------------------------------- o botão ------ */

  const botao = BotaoDeAuditorio(L('ii6e477y') /* Pular instruções */, { acao: 'pular', aoTocar: pular });
  botao.classList.add('ins-pular');
  // A barra que enche no botão diz que a tela segue sozinha, e quando.
  botao.botao.style.setProperty('--espera', `${SEGUE_SOZINHA_MS}ms`);
  botao.botao.classList.add('aud-botao--contando');

  const root = el('div', { class: 'ff-scaffold pg-instrucoes' }, [
    titulo,
    caminho,
    el('div', { class: 'ins-passos' }, passos),
    monitor,
    botao,
  ]);
  root.addEventListener('click', unfocus);

  /* ------------------------------------------------------- o roteiro ------ */

  entrar(titulo, [{ opacity: 0, transform: 'translateY(-24px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'ease-out' });
  entrar(caminho, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 200 });
  entrar(monitor, [{ opacity: 0, transform: 'translateY(40px) scale(.96)' }, { opacity: 1, transform: 'none' }], {
    duration: 600,
    delay: 150,
    easing: 'cubic-bezier(.2,.8,.3,1)',
  });
  entrar(botao, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 400 });
  Som.whoosh(0, 0.35, 0.14);

  // Mi, Sol, Si, Ré, Mi: o acorde que sobe a cada passo, como as alternativas
  // entrando na pergunta.
  const notas = [659.25, 783.99, 987.77, 1174.66, 1318.51];
  PASSOS.forEach((_, i) => {
    depois(PRIMEIRO_PASSO_MS + i * ENTRE_PASSOS_MS, () => {
      passos.forEach((n, k) => {
        n.classList.toggle('ins-ativo', k === i);
        n.classList.toggle('ins-visto', k < i);
      });
      destaques.forEach((d, k) => {
        if (!d) return;
        d.classList.toggle('ins-ativo', k === i);
        d.classList.toggle('ins-visto', k < i);
      });
      entrar(passos[i], [{ opacity: 0, transform: 'translateX(-50px)' }, { opacity: 1, transform: 'none' }], {
        duration: 420,
        easing: 'cubic-bezier(.2,.9,.3,1)',
      });
      if (destaques[i]) {
        entrar(destaques[i], [{ opacity: 0, transform: menosMovimento() ? 'none' : 'scale(1.08)' }, { opacity: 1, transform: 'none' }], {
          duration: 380,
          easing: 'ease-out',
        });
      }
      Som.sino(notas[i], 0, 0.09);
    });
  });

  depois(SEGUE_SOZINHA_MS, () => {
    saiu = true;
    NEXT();
  });

  const desligarComandos = registrarComandos({ principal: pular });

  root.__dispose = () => {
    saiu = true;
    timers.forEach(clearTimeout);
    desligarComandos();
  };

  return root;
}
