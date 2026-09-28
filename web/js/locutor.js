// O apresentador: as frases que entram grandes na tela e os painéis em que ele
// pergunta alguma coisa ao jogador.
//
// Programa de auditório é ritmo — "Posso perguntar?", "Valendo!", "Está certo
// disso?", "Certa resposta!". Cada frase é uma batida do roteiro, e é por elas
// que o jogador sabe em que ponto está sem precisar ler instrução nenhuma.
// São bordões do gênero; nada aqui imita a voz ou o jeito de ninguém.
//
// Tudo entra numa camada que a tela dá (`camada`), e morre com ela.

import { el, fonte } from './widgets.js';
import { entrar, menosMovimento } from './anim.js';
import { Losango, correrBorda } from './components/losango.js';

/**
 * A frase do apresentador, grande, entrando como pancada: vem de 1,9x com
 * desfoque, passa um pouco do tamanho e assenta — 420ms. Um brilho atravessa a
 * palavra depois de ela assentar.
 *
 * Por trás, uma faixa escura: por cima do palco cheio (carro, fichas, relógio)
 * o ouro sozinho se perdia.
 *
 * @param {HTMLElement} camada
 * @param {string} texto
 * @param {object} [opcoes]
 * @param {string} [opcoes.cor] '' (ouro), 'vermelho' ou 'branco'
 * @param {number} [opcoes.y] a altura da linha, em px do palco
 * @param {number} [opcoes.tam] o tamanho da letra
 * @param {number} [opcoes.segura] quanto tempo fica depois de assentar
 * @param {boolean} [opcoes.fica] não sai sozinha: devolve o nó para quem chamou
 * @param {string} [opcoes.chave] vai para `data-grito`, o gancho dos testes
 * @param {object} roteiro o roteiro da tela (roteiro.js): sai dela, a frase para
 * @returns {Promise<HTMLElement|null>}
 */
export async function grito(camada, texto, opcoes = {}, roteiro) {
  const { cor = '', y = 262, tam = 150, segura = 520, fica = false, chave = null } = opcoes;
  const palavra = el('span', { text: texto, 'data-t': texto });
  const no = el(
    'div',
    { class: ['aud-grito', cor ? `aud-grito--${cor}` : null], dataGrito: chave, style: { top: `${y}px`, fontSize: fonte(tam) } },
    palavra
  );
  camada.appendChild(no);
  entrar(
    no,
    [
      { transform: 'scale(1.9)', opacity: 0, filter: 'blur(14px)' },
      { transform: 'scale(.96)', opacity: 1, filter: 'blur(0)', offset: 0.6 },
      { transform: 'none', opacity: 1, filter: 'blur(0)' },
    ],
    { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1)' }
  );
  await roteiro.pausa(420 + segura);
  if (fica) return no;
  await no
    .animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.86) translateY(-24px)' }], {
      duration: 260,
      easing: 'ease-in',
      fill: 'forwards',
    })
    .finished.catch(() => {});
  no.remove();
  return null;
}

/** Os raios dourados girando atrás do grito do acerto. */
export function raios(camada, { x = 960, y = 300 } = {}) {
  const no = el('div', { class: 'aud-raios', style: { left: `${x}px`, top: `${y}px` } });
  camada.appendChild(no);
  entrar(no, [{ opacity: 0, scale: '.6' }, { opacity: 1, scale: '1' }], { duration: 700, easing: 'ease-out' });
  return no;
}

/**
 * Um painel do apresentador: a caixa do estilo em vigor, com o conteúdo no meio.
 * Entra abrindo na horizontal a partir de uma faixa, e uma luz corre a borda.
 *
 * @param {HTMLElement} camada
 * @param {object} medidas
 * @param {number} medidas.x o centro do painel, em px do palco
 * @param {number} medidas.y o topo
 * @param {number} medidas.largura
 * @param {number} medidas.altura
 * @param {number} [medidas.ponta] 0 = caixa redonda (clássico)
 * @param {number} [medidas.raio]
 * @param {Array<Node>} medidas.conteudo
 * @param {string} [medidas.classe]
 * @param {string} [medidas.chave] vai para `data-painel`
 * @returns {{no: HTMLElement, fechar: Function}}
 */
export function painel(camada, { x, y, largura, altura, ponta = 0, raio = 30, conteudo, classe = '', chave = null }) {
  const no = el(
    'div',
    {
      class: ['aud-painel', classe || null],
      dataPainel: chave,
      role: 'dialog',
      style: { left: `${x - largura / 2}px`, top: `${y}px`, width: `${largura}px`, height: `${altura}px` },
    },
    [Losango({ largura, altura, ponta, raio }), el('div', { class: 'aud-painel-conteudo' }, conteudo)]
  );
  camada.appendChild(no);
  entrar(
    no,
    [
      { transform: 'scaleX(.15) scaleY(.6)', opacity: 0 },
      { transform: 'scaleX(1.02) scaleY(1)', opacity: 1, offset: 0.7 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: 440, easing: 'cubic-bezier(.2,.9,.25,1)' }
  );
  correrBorda(no.querySelector('.lz'), { ms: 1000, delay: 250 });

  let fechado = false;
  return {
    no,
    fechar() {
      if (fechado) return;
      fechado = true;
      // Sai do caminho do toque na hora: um segundo toque no botão de um
      // painel que está sumindo não pode valer.
      no.style.pointerEvents = 'none';
      const sair = menosMovimento()
        ? no.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' })
        : no.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.06)' }], {
            duration: 200,
            easing: 'ease-in',
            fill: 'forwards',
          });
      sair.finished.then(
        () => no.remove(),
        () => no.remove()
      );
    },
  };
}
