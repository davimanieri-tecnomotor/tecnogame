// A faixa ERRAR / RECORDE / ACERTAR AGORA.
//
// É a faixa de três caixas do Show do Milhão (ERRAR / PARAR / ACERTAR), com o
// PARAR trocado pelo RECORDE: aqui não se para, e o que está em jogo não é
// dinheiro, é a posição no ranking — que CAI enquanto o relógio anda. É o que
// dá sentido ao relógio: sem ela, 30 segundos e 50 segundos eram a mesma
// vitória para quem joga.
//
//   ERRAR          sai sem posição
//   RECORDE        o tempo mais rápido de todos, e de quem
//   ACERTAR AGORA  o lugar que o jogador pegaria se confirmasse neste instante
//
// E embaixo, a folga: quanto tempo falta para o jogador de trás passar à
// frente. "vale o 2º lugar por mais 3,2 s" é o aperto que o relógio sozinho
// não diz.
//
// O ranking chega PRONTO: a tela da pergunta o pede enquanto a roleta gira
// (estatisticas.js), porque o Firestore sem rede não falha — fica pendente — e
// esta faixa tem de valer desde o primeiro segundo.

import { el, fonte, maybeHandleOverflow } from '../widgets.js';
import { menosMovimento } from '../anim.js';
import { formatarSegundos, formatarTempoDeResposta } from '../functions.js';
import { T, Tf } from '../textos.js';

const entre = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * A posição que o jogador pegaria com `restante` no relógio — a mesma conta de
 * `posicaoNoRanking`: um a mais que o número de vencedores mais rápidos.
 */
export const posicaoAgora = (ranking, restante) => 1 + ranking.filter((v) => (v?.tempo ?? -Infinity) > restante).length;

/**
 * Quanto tempo o jogador ainda segura a posição `p`: até o relógio descer ao
 * tempo de quem está logo atrás. Devolve `{folga, janela}` em ms, ou null
 * quando não há ninguém atrás — a posição não cai mais.
 *
 * `janela` é o tamanho do degrau inteiro, para a barra saber quanto dele sobra.
 */
export function folgaDaPosicao(ranking, restante, p = posicaoAgora(ranking, restante)) {
  const atras = ranking[p - 1];
  if (!atras) return null;
  const teto = p === 1 ? 60000 : ranking[p - 2].tempo;
  return { folga: Math.max(0, restante - atras.tempo), janela: Math.max(1, teto - atras.tempo) };
}

/**
 * @param {object} opcoes
 * @param {Array<{nome: string, tempo: number}>} opcoes.ranking o mais rápido primeiro
 * @param {boolean} [opcoes.milhao] a Pergunta do Milhão: vale brinde, não posição
 * @param {Function} [opcoes.aoTrocarPosicao] toca quando a posição cai
 */
export function Aposta({ ranking: rankingInicial = [], milhao = false, aoTrocarPosicao = null } = {}) {
  let ranking = rankingInicial;

  const caixa = (classe, valor, rotulo) => {
    const rotuloNo = el('small', { class: 'ff-text', text: rotulo, style: { fontSize: fonte(13) } });
    const no = el('div', { class: `aud-ap-caixa aud-ap-caixa--${classe}` }, [el('b', { class: 'ff-text' }, valor), rotuloNo]);
    no._rotulo = rotuloNo;
    return no;
  };

  const rolo = el('span', { class: 'aud-ap-rolo' }, el('i', { text: '1º' }));
  const barra = el('i');
  const barraTexto = el('span', { class: 'ff-text', style: { fontSize: fonte(14) } });
  const valorDoRecorde = el('span');

  const escreverRecorde = (caixaRecorde) => {
    const recorde = ranking[0];
    valorDoRecorde.textContent = recorde ? formatarTempoDeResposta(recorde.tempo) : '—';
    caixaRecorde._rotulo.textContent = recorde
      ? `${T('recorde')} · ${maybeHandleOverflow((recorde.nome ?? '').toUpperCase(), { maxChars: 10, replacement: '…' })}`
      : T('recorde');
  };

  const caixaRecorde = milhao
    ? caixa('recorde', el('span', { text: T('brinde'), style: { fontSize: fonte(22) } }), T('valendoBrinde'))
    : caixa('recorde', valorDoRecorde, '');
  if (!milhao) escreverRecorde(caixaRecorde);

  const caixas = milhao
    ? [caixa('erro', el('span', { text: '—' }), T('errar')), caixaRecorde, caixa('acertar', el('span', { text: '★' }), T('acertarAgora'))]
    : [caixa('erro', el('span', { text: T('fora') }), T('errar')), caixaRecorde, caixa('acertar', rolo, T('acertarAgora'))];

  const raiz = el('div', { class: 'aud-aposta aud-oculta', dataAposta: milhao ? 'milhao' : 'ranking' }, [
    el('div', { class: 'aud-ap-caixas' }, caixas),
    el('div', { class: 'aud-ap-barra' }, [barra, barraTexto]),
  ]);

  let pos = null;
  let ultimoRestante = 60000;

  function trocar(p, animar) {
    const novo = el('i', { text: `${p}º` });
    if (!animar || menosMovimento()) {
      rolo.replaceChildren(novo);
      return;
    }
    const velho = rolo.firstElementChild;
    rolo.append(novo);
    velho
      ?.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-100%)', opacity: 0 }], {
        duration: 260,
        easing: 'cubic-bezier(.5,0,.75,0)',
        fill: 'forwards',
      })
      .finished.then(
        () => velho.remove(),
        () => velho.remove()
      );
    novo.animate([{ transform: 'translateY(100%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], {
      duration: 380,
      delay: 110,
      easing: 'cubic-bezier(.2,1.4,.4,1)',
      fill: 'backwards',
    });
    raiz.querySelector('.aud-ap-caixa--acertar > b')?.animate([{ filter: 'brightness(1.9)' }, { filter: 'brightness(1)' }], {
      duration: 520,
    });
    aoTrocarPosicao?.(p);
  }

  function atualizar(restante, { som = true } = {}) {
    ultimoRestante = restante;
    if (milhao) {
      // Na Pergunta do Milhão não há posição a perder: a barra é só o tempo
      // escorrendo, e fala por si.
      barra.style.transform = `scaleX(${entre(restante / 60000, 0, 1).toFixed(3)})`;
      barraTexto.textContent = '';
      return;
    }
    const p = posicaoAgora(ranking, restante);
    if (p !== pos) {
      trocar(p, pos != null && som);
      pos = p;
    }
    const folga = folgaDaPosicao(ranking, restante, p);
    if (folga) {
      barra.style.transform = `scaleX(${entre(folga.folga / folga.janela, 0, 1).toFixed(3)})`;
      barraTexto.textContent = Tf('valeLugar', { p, s: formatarSegundos(folga.folga) });
    } else {
      barra.style.transform = 'scaleX(0)';
      barraTexto.textContent = ranking.length ? T('aindaEntra') : T('sejaOPrimeiro');
    }
  }

  atualizar(60000, { som: false });

  return {
    no: raiz,
    atualizar,
    /** O ranking chegou atrasado: a faixa se corrige sem piscar. */
    trocarRanking(novo) {
      if (milhao) return;
      ranking = novo;
      escreverRecorde(caixaRecorde);
      atualizar(ultimoRestante, { som: false });
    },
    /** Depois do veredito a faixa já não vale nada: recua. */
    recuar() {
      raiz.animate([{ opacity: 1 }, { opacity: 0.3 }], { duration: 400, fill: 'forwards' });
    },
  };
}
