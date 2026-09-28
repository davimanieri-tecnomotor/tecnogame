// As quatro alternativas, no formato do gênero.
//
//   palco    losangos 2x2 ligados por uma linha que atravessa a fileira — a
//            assinatura do Milionário;
//   clássico quatro barras empilhadas, cantos redondos, e o NÚMERO num círculo
//            azul de aro branco — a coluna do Show do Milhão de 2000.
//
// Os estados usam só propriedades que nenhuma animação disputa (ver as
// armadilhas no CLAUDE.md): a cor mora nas camadas do losango, o esfriar é
// `filter`, o afundar do toque é `scale`. Nenhum estado mexe em `opacity` ou
// `transform` do próprio cartão, que são de quem o anima.
//
// O gancho dos testes e do teclado é `data-alternativa` (0 a 3, a posição na
// tela) — e o número que o jogador vê é sempre essa posição + 1.

import { el, fonte } from '../widgets.js';
import { entrar, menosMovimento } from '../anim.js';
import { Losango, correrBorda } from './losango.js';
import { caber } from '../ajuste.js';
import { Som } from '../som.js';
import { T } from '../textos.js';

/**
 * @param {object} opcoes
 * @param {Array<string>} opcoes.textos as quatro, na ordem da tela
 * @param {object} opcoes.medidas `{ w, h, ponta, raio, pos, trilhos, texto, lados }` do estilo
 * @param {string} opcoes.estilo 'classico' | 'palco'
 * @param {Function} opcoes.aoTocar recebe a posição (0 a 3)
 */
export function Alternativas({ textos, medidas: m, estilo, aoTocar }) {
  const trilhos = [];
  const nos = [];

  // A linha que atravessa cada fileira do 2x2 — assinatura do Milionário, e
  // por isso só no estilo palco.
  if (m.trilhos) {
    for (const y of [m.pos[0][1] + m.h / 2 - 1, m.pos[2][1] + m.h / 2 - 1]) {
      for (const [x, w] of [
        [0, m.pos[0][0]],
        [m.pos[0][0] + m.w, m.pos[1][0] - (m.pos[0][0] + m.w)],
        [m.pos[1][0] + m.w, 1920 - (m.pos[1][0] + m.w)],
      ]) {
        trilhos.push(el('div', { class: 'aud-trilho-linha aud-oculta', style: { top: `${y}px`, left: `${x}px`, width: `${w}px` } }));
      }
    }
  }

  textos.forEach((texto, i) => {
    const textoNo = el('span', { class: 'ff-text aud-opcao-texto', text: texto });
    const caixa = el('div', { class: 'aud-opcao-caixa' }, textoNo);
    const numero = el('b', { class: 'aud-opcao-num', text: String(i + 1), style: { fontSize: fonte(estilo === 'classico' ? 30 : 42) } });
    const no = el(
      'div',
      {
        class: 'aud-opcao aud-oculta',
        role: 'button',
        tabindex: '0',
        dataAlternativa: String(i),
        'aria-label': `${T('alternativa')} ${i + 1}: ${texto}`,
        style: { left: `${m.pos[i][0]}px`, top: `${m.pos[i][1]}px`, width: `${m.w}px`, height: `${m.h}px` },
      },
      [Losango({ largura: m.w, altura: m.h, ponta: m.ponta, raio: m.raio }), el('div', { class: 'aud-opcao-conteudo' }, [numero, caixa])]
    );
    no.addEventListener('pointerdown', () => no.classList.add('apertada'));
    for (const tipo of ['pointerup', 'pointerleave', 'pointercancel']) {
      no.addEventListener(tipo, () => no.classList.remove('apertada'));
    }
    no.addEventListener('click', (e) => {
      e.stopPropagation();
      aoTocar(i);
    });
    no.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        e.stopPropagation();
        aoTocar(i);
      }
    });
    no._caixa = caixa;
    no._texto = textoNo;
    nos.push(no);
  });

  const lz = (i) => nos[i].querySelector('.lz');

  return {
    nos,
    trilhos,

    /** O texto no maior tamanho que couber na barra. */
    ajustar() {
      for (const no of nos) caber(no._caixa, no._texto, m.texto[0], m.texto[1]);
    },

    /**
     * Uma a uma, a cada 230ms, cada uma com um sino que sobe de nota (Mi, Sol,
     * Si, Ré — um acorde subindo). 230ms: o olho lê na ordem em que vai
     * precisar; mais rápido que isso elas chegam "juntas".
     */
    async entrar(roteiro) {
      const notas = [659.25, 783.99, 987.77, 1174.66];
      for (let i = 0; i < nos.length; i++) {
        const deEsquerda = !m.lados || i % 2 === 0;
        entrar(
          nos[i],
          [
            { transform: `translateX(${deEsquerda ? -70 : 70}px) scaleY(.05)`, opacity: 0 },
            { transform: 'translateX(0) scaleY(.05)', opacity: 1, offset: 0.35 },
            { transform: 'none', opacity: 1 },
          ],
          { duration: 400, easing: 'cubic-bezier(.2,.9,.25,1)' }
        );
        correrBorda(lz(i), { ms: 650, delay: 140 });
        Som.sino(notas[i], 0, 0.1);
        if (m.trilhos && i % 2 === 1) {
          trilhos.slice(((i - 1) / 2) * 3, ((i - 1) / 2) * 3 + 3).forEach((t) =>
            entrar(t, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 })
          );
        }
        await roteiro.pausa(230);
      }
      await roteiro.pausa(220);
    },

    /** O centro de uma alternativa, em px do palco. */
    centro(i) {
      return [m.pos[i][0] + m.w / 2, m.pos[i][1] + m.h / 2];
    },

    /** Ainda dá para escolher esta? (as que as Cartas tiraram, não) */
    disponivel(i) {
      return Boolean(nos[i]) && !nos[i].classList.contains('eliminada');
    },

    /** A escolhida trava — ouro no palco, o número vermelho no clássico —, e as outras recuam um pouco. */
    travar(i) {
      nos.forEach((n, k) => {
        n.classList.toggle('travada', k === i);
        n.classList.toggle('meio-fria', k !== i);
      });
    },

    destravar() {
      nos.forEach((n) => n.classList.remove('travada', 'meio-fria'));
    },

    /**
     * Apaga as descartadas. As exceções ficam como estão: a certa ainda precisa
     * da cor de travada para piscar travada ↔ verde.
     */
    esfriar(excecoes = []) {
      nos.forEach((n, k) => {
        if (excecoes.includes(k)) return;
        n.classList.remove('meio-fria', 'travada');
        n.classList.add('fria');
      });
    },

    /** Um pulso a cada batida do suspense. `scale`, para não disputar `transform`. */
    pulsar(i) {
      if (menosMovimento()) return;
      nos[i].animate([{ scale: '1' }, { scale: '1.018', offset: 0.3 }, { scale: '1' }], { duration: 420, easing: 'ease-out' });
    },

    /**
     * Acende a certa, como no programa: a barra ALTERNA entre a cor de antes e
     * o verde, três vezes, e assenta no verde. Quem travou nela vê travada ↔
     * verde; quem errou vê a certa piscar do escuro para o verde.
     *
     * Período de 0,4s, medido no Show do Milhão de 2000 e no Milionário: 2,5
     * piscadas por segundo, abaixo das três que o WCAG põe como limite de
     * fotossensibilidade.
     *
     * O `steps` vai em CADA quadro-chave, e não nas opções da animação: lá ele
     * vale para a iteração inteira, e a barra ficava parada 1,2s e trocava de
     * cor uma vez só — foi o defeito da primeira versão do protótipo.
     */
    certa(i) {
      const n = nos[i];
      const estavaTravada = n.classList.contains('travada');
      n.classList.remove('meio-fria', 'fria', 'errada', 'eliminada');
      n.classList.add('certa');
      const assentar = () => n.classList.remove('travada');
      if (menosMovimento()) {
        assentar();
        return;
      }
      const q = (o) => ({ opacity: o, easing: 'steps(1, end)' });
      const piscar = n.querySelector('.l-verde').animate([q(1), q(0), q(1), q(0), q(1), q(0), { opacity: 1 }], { duration: 1200 });
      if (estavaTravada) piscar.finished.then(assentar, assentar);
      else assentar();
      correrBorda(lz(i), { ms: 800 });
    },

    /** A escolhida estava errada: vermelho, e um "glitch" de sinal, como erro de diagnóstico. */
    errada(i) {
      const n = nos[i];
      n.classList.remove('travada', 'meio-fria');
      n.classList.add('errada');
      if (!menosMovimento()) {
        n.classList.add('glitch');
        setTimeout(() => n.classList.remove('glitch'), 520);
      }
    },

    /** As Cartas tiraram estas de cena. */
    eliminar(indices) {
      indices.forEach((k, ordem) => {
        const n = nos[k];
        n.classList.add('eliminada');
        n.setAttribute('aria-disabled', 'true');
        n.tabIndex = -1;
        if (!menosMovimento()) {
          n.animate(
            [
              { filter: 'none', scale: '1' },
              { filter: 'brightness(2.4) blur(2px)', scale: '1.03', offset: 0.25 },
              { filter: 'brightness(.25) saturate(.1) blur(1px)', scale: '.96' },
            ],
            { duration: 520, delay: ordem * 180, easing: 'ease-out', fill: 'backwards' }
          );
        }
        Som.pop(ordem * 0.18, 420 - ordem * 60);
      });
    },

    /** Uma luz corre a borda de uma alternativa qualquer: a tela está viva, e esperando. */
    brilhoOcioso() {
      const livres = nos.map((_, k) => k).filter((k) => !nos[k].classList.contains('eliminada'));
      if (!livres.length) return;
      correrBorda(lz(livres[(Math.random() * livres.length) | 0]), { ms: 1100 });
    },
  };
}

/**
 * A caixa da pergunta: abre a partir de uma linha de luz, uma luz corre a
 * borda, e o texto entra depois, sozinho — a pergunta chega antes das
 * alternativas, como no programa.
 *
 * @param {object} opcoes
 * @param {string} opcoes.texto
 * @param {object} opcoes.medidas `{ x, y, w, h, ponta, raio, trilhos, texto }`
 * @param {string} [opcoes.aba] o rótulo da aba em cima da caixa
 * @param {string} [opcoes.sub] o complemento da aba
 */
export function QuadroDaPergunta({ texto, medidas: m, aba = T('defeito'), sub = T('problemaDoCliente') }) {
  const textoNo = el('span', { class: 'ff-text aud-pergunta-texto', text: texto });
  const caixa = el('div', { class: 'aud-pergunta-caixa' }, textoNo);
  const abaNo = el('div', { class: 'aud-pergunta-aba', style: { fontSize: fonte(16) } }, [
    el('i'),
    el('span', { class: 'aud-pergunta-aba-titulo', text: aba }),
    sub ? el('span', { class: 'aud-pergunta-aba-sub', text: `· ${sub}`, style: { fontSize: fonte(13) } }) : null,
  ]);
  const trilhos = m.trilhos ? [el('div', { class: 'aud-trilho esq' }), el('div', { class: 'aud-trilho dir' })] : [];
  const raiz = el(
    'div',
    {
      class: 'aud-pergunta aud-oculta',
      style: { left: `${m.x}px`, top: `${m.y}px`, width: `${m.w}px`, height: `${m.h}px` },
    },
    [...trilhos, Losango({ largura: m.w, altura: m.h, ponta: m.ponta, raio: m.raio, classe: 'lz-pergunta' }), abaNo, caixa]
  );
  // A aba e o texto nascem escondidos: a caixa abre primeiro, vazia.
  abaNo.classList.add('aud-oculta');
  caixa.classList.add('aud-oculta');

  return {
    no: raiz,
    ajustar() {
      caber(caixa, textoNo, m.texto[0], m.texto[1]);
    },
    async abrir(roteiro) {
      raiz.classList.remove('aud-oculta');
      Som.whoosh(0, 0.36, 0.2);
      trilhos.forEach((t) =>
        entrar(t, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' })
      );
      const lz = raiz.querySelector('.lz-pergunta');
      entrar(
        lz,
        [
          { transform: 'scaleY(.03)', opacity: 0 },
          { transform: 'scaleY(.03)', opacity: 1, offset: 0.3 },
          { transform: 'scaleY(1)', opacity: 1 },
        ],
        { duration: 440, easing: 'cubic-bezier(.2,.9,.2,1)' }
      );
      correrBorda(lz, { ms: 900, delay: 240 });
      Som.sino(523.25, 0.24, 0.1);
      await roteiro.pausa(300);
      entrar(
        caixa,
        [
          { opacity: 0, transform: 'translateY(10px)', filter: 'blur(6px)' },
          { opacity: 1, transform: 'none', filter: 'blur(0)' },
        ],
        { duration: 420, easing: 'ease-out' }
      );
      entrar(abaNo, [{ transform: 'translateY(26px)', opacity: 0 }, { transform: 'none', opacity: 1 }], {
        duration: 360,
        delay: 120,
        easing: 'cubic-bezier(.2,1.3,.4,1)',
      });
      await roteiro.pausa(420);
    },
  };
}
