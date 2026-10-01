// A saída do cadastro: o jogador é chamado ao palco.
//
// A troca de tela do jogo é uma só e mora no router (a lâmina). Isto acontece
// ANTES dela, e é do cadastro: o CONFIRMAR é o único momento do jogo em que o
// jogador acabou de FAZER alguma coisa — escrever o próprio nome —, e é ali
// que uma passagem com personalidade cabe.
//
// A IDEIA: O NOME QUE ELE DIGITOU É O NOME QUE O APRESENTADOR CHAMA.
// A ficha se desfaz em volta do campo do nome; o nome sai do campo, cresce e
// voa até o centro do palco, onde pousa com pancada, aplauso e os raios
// dourados — "COM VOCÊS: DAVI!". Não há corte entre o formulário e o anúncio:
// o jogador vê a própria palavra virar a manchete.
//
// A versão anterior (a 3.0) desmontava a ficha peça por peça para os lados,
// com uma linha de leitura subindo e um clarão no fim. Filmada quadro a quadro,
// ela tinha três defeitos que se viam na feira: as peças rodopiando para os
// dois lados pareciam a tela quebrando, o clarão era uma mancha azul-clara do
// tamanho do palco, e entre ele e o anúncio sobravam ~450ms de palco vazio. E o
// anúncio, quando vinha, nascia do nada — nada ligava o "DAVI!" à ficha.
//
// A saída termina com o anúncio NA TELA: quem chama navega em seguida, e a
// lâmina do router leva o anúncio junto com o cadastro. Sem palco vazio no
// meio.
//
// Com `prefers-reduced-motion` nada voa: a ficha esmaece e o anúncio aparece
// parado, pelo tempo de ser lido.

import { el, fonte } from './widgets.js';
import { menosMovimento } from './anim.js';
import { T } from './textos.js';
import { Som } from './som.js';
import { humor } from './palco.js';
import { grito, raios } from './locutor.js';
import { faiscas } from './particulas.js';
import { soInterrupcao } from './roteiro.js';

/**
 * Os tempos, em ms a partir do toque já validado. Medidos na tela, filmando a
 * saída quadro a quadro (30 por segundo):
 *
 * - a ficha leva ~420ms para se desfazer — 300 por peça, 30 entre uma e a
 *   seguinte. Mais rápido que isso ela "pisca" e some; mais devagar, o nome já
 *   chegou e o formulário ainda está lá;
 * - o voo do nome dura 640ms: abaixo de ~500 o olho perde a ligação entre o
 *   campo e a manchete, acima de ~800 vira espera;
 * - o "COM VOCÊS" entra aos 320ms, com a ficha já quase apagada: aos 220 ele
 *   caía por cima dos rótulos ainda legíveis, e a tela embolava;
 * - o anúncio fica 1050ms parado depois do pouso — o "COM VOCÊS" e o nome
 *   leem-se com folga, e a lâmina ainda os mostra saindo.
 */
const PECA_MS = 300;
const ENTRE_PECAS_MS = 30;
const DECOLA_MS = 160;
const VOO_MS = 640;
const COM_VOCES_MS = 320;
const SEGURA_MS = 1050;

/** A altura (topo da linha) e o tamanho do nome anunciado, em px do palco. */
const NOME_Y = 450;
const NOME_TAM = 150;
/** O nome mais largo que cabe, com folga dos refletores nas bordas. */
const NOME_LARGURA_MAX = 1640;

const W = 1920;

/** Um retângulo de `no` em px do palco, qualquer que seja a escala da janela. */
function retangulo(no) {
  const palco = document.getElementById('stage')?.getBoundingClientRect();
  const b = no.getBoundingClientRect();
  const k = palco ? palco.width / W || 1 : 1;
  return {
    x: (b.left - (palco?.left ?? 0)) / k,
    y: (b.top - (palco?.top ?? 0)) / k,
    w: b.width / k,
    h: b.height / k,
  };
}

/**
 * Onde, dentro do campo, está escrita a primeira palavra do que foi digitado —
 * é dali que o nome decola. Mede com a fonte do próprio campo, num canvas: o
 * `<input>` não tem nó de texto para medir.
 */
function ondeEstaONome(input) {
  const caixa = retangulo(input);
  const cs = getComputedStyle(input);
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return caixa;
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const valor = input.value;
  const antes = valor.length - valor.trimStart().length;
  const palavra = valor.trim().split(/\s+/)[0] ?? '';
  const x = caixa.x + ctx.measureText(valor.slice(0, antes)).width;
  const w = Math.max(1, ctx.measureText(palavra).width);
  const h = parseFloat(cs.fontSize) * 1.2;
  return { x, y: caixa.y + (caixa.h - h) / 2, w, h };
}

/** O tamanho da letra para o nome caber no palco (a Pirulen tem ~0,8em por letra). */
const tamanhoDoNome = (texto) => Math.min(NOME_TAM, Math.floor(NOME_LARGURA_MAX / (texto.length * 0.8)));

/** Uma peça da ficha se desfaz: afunda um pouco, desfoca e apaga. */
function desfazer(no, atraso) {
  return no.animate(
    [
      { opacity: 1, translate: '0 0', filter: 'blur(0px)' },
      { opacity: 0, translate: '0 22px', filter: 'blur(8px)' },
    ],
    { duration: PECA_MS, delay: atraso, easing: 'cubic-bezier(.4,0,.7,.4)', fill: 'forwards' }
  );
}

/**
 * O botão apertado responde antes de tudo: acende, cresce e some, e uma onda
 * de ouro sai dele. É o "foi" visual do toque.
 */
function dispararBotao(camada, botao) {
  if (!botao) return;
  const r = retangulo(botao);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  // A onda tem a forma do botão: o tamanho dele sem a inclinação (o retângulo
  // medido já é a caixa do paralelogramo, mais larga) e a mesma inclinação.
  const w = botao.offsetWidth || r.w;
  const h = botao.offsetHeight || r.h;
  const onda = el('div', {
    class: 'cad-onda',
    style: {
      left: `${cx - w / 2}px`,
      top: `${cy - h / 2}px`,
      width: `${w}px`,
      height: `${h}px`,
      transform: botao.dataset.baseTransform || null,
    },
  });
  camada.appendChild(onda);
  onda
    .animate(
      [
        { opacity: 0.95, scale: '1' },
        { opacity: 0, scale: '1.55 2.2' },
      ],
      { duration: 520, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }
    )
    .finished.then(() => onda.remove(), () => {});
  faiscas({ x: cx, y: cy, n: 26, forca: 760 });
  botao.animate(
    [
      { scale: '1', opacity: 1, filter: 'brightness(1)' },
      { scale: '1.06', opacity: 1, filter: 'brightness(1.7)', offset: 0.3 },
      { scale: '0.92', opacity: 0, filter: 'brightness(1.2)' },
    ],
    { duration: 420, easing: 'ease-out', fill: 'forwards' }
  );
}

/**
 * O clarão do pouso, atrás do nome e só nele. O `flash` dos vereditos
 * (palco.js) cobre o palco inteiro, e em ouro por cima do azul-escuro ele
 * deixava a tela cor de oliva por um instante — filmado, parecia defeito.
 */
function clarao(camada, holofote) {
  const luz = el('div', { class: 'cad-clarao', style: { top: `${NOME_Y + 85}px` } });
  camada.insertBefore(luz, holofote.nextSibling);
  luz
    .animate(
      [
        { opacity: 0, scale: '0.35' },
        { opacity: 1, scale: '1', offset: 0.25 },
        { opacity: 0, scale: '1.35' },
      ],
      { duration: 700, easing: 'ease-out', fill: 'forwards' }
    )
    .finished.then(() => luz.remove(), () => {});
}

/**
 * O nome voando do campo ao centro do palco.
 *
 * O nó já nasce onde o anúncio fica (a mesma caixa do `grito`), e é o TEXTO
 * dentro dele que viaja, por `transform`, a partir da caixa do campo: assim o
 * pouso cai exatamente no pixel do anúncio, sem medir duas vezes. O caminho
 * desce um pouco no meio — passa por baixo do "COM VOCÊS", que já está na
 * tela —, e o fim passa de 1 e volta: o pouso tem peso.
 *
 * A palavra na Pirulen é mais larga que a digitada; ela decola com a largura
 * da digitada e por isso nasce mais baixa. Os primeiros 14% do voo a acendem
 * por cima do campo, que apaga ao mesmo tempo — não se vê a troca de letra.
 */
function voarONome(camada, texto, origem, roteiro) {
  const tam = tamanhoDoNome(texto);
  const palavra = el('span', { text: texto, 'data-t': texto });
  const no = el('div', {
    class: 'aud-grito cad-nome-voo',
    dataGrito: 'nome',
    style: { top: `${NOME_Y}px`, fontSize: fonte(tam) },
  }, palavra);
  camada.appendChild(no);

  const fim = retangulo(palavra);
  const s0 = Math.min(origem.w / fim.w, origem.h / fim.h);
  const dx = origem.x + origem.w / 2 - (fim.x + fim.w / 2);
  const dy = origem.y + origem.h / 2 - (fim.y + fim.h / 2);
  // O `skewX` é o da folha (.aud-grito span): animar `transform` o apagaria.
  const t = (x, y, s) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)}) skewX(-7deg)`;

  Som.whoosh(0, VOO_MS / 1000, 0.2, true);
  const voo = palavra.animate(
    [
      { transform: t(dx, dy, s0), opacity: 0, easing: 'ease-out' },
      { transform: t(dx, dy - 8, s0 * 1.12), opacity: 1, offset: 0.14, easing: 'cubic-bezier(.55,0,.35,1)' },
      { transform: t(dx * 0.32, 70, 0.66), opacity: 1, offset: 0.62, easing: 'cubic-bezier(.3,0,.25,1)' },
      { transform: t(0, 0, 1.13), opacity: 1, offset: 0.86, easing: 'cubic-bezier(.3,0,.3,1)' },
      { transform: t(0, 0, 1), opacity: 1 },
    ],
    { duration: VOO_MS, fill: 'forwards' }
  );
  // O borrão de quem passa depressa, no meio do caminho e só nele.
  no.animate(
    [{ filter: 'blur(0px)' }, { filter: 'blur(2.5px)', offset: 0.45 }, { filter: 'blur(0px)', offset: 0.8 }, { filter: 'blur(0px)' }],
    { duration: VOO_MS }
  );

  // Cancelado (a tela saiu no meio do voo), o `finished` rejeita: quem decide
  // se o resto acontece é o roteiro, não a animação.
  return roteiro.aguardar(voo.finished.catch(() => {})).then(() => no);
}

/**
 * Chama o jogador ao palco e resolve com o anúncio ainda na tela — quem chama
 * navega em seguida, e a lâmina leva o anúncio embora junto com o cadastro.
 *
 * @param {object} cena
 * @param {HTMLElement} cena.raiz o `.ff-scaffold` do cadastro: é o palco inteiro
 * @param {HTMLInputElement|null} cena.campoDoNome de onde o nome decola
 * @param {string} cena.nome o primeiro nome, como será anunciado; vazio, a ficha
 *   só se desfaz
 * @param {Array<HTMLElement|null>} cena.pecas o que se desfaz, DE BAIXO PARA
 *   CIMA — a ordem em que somem
 * @param {HTMLElement|null} cena.ficha o cartão atrás do formulário
 * @param {HTMLElement|null} cena.selo o logo, que sobe e sai
 * @param {HTMLElement|null} cena.botao o CONFIRMAR, que responde ao toque
 * @param {object} cena.roteiro o roteiro do cadastro (roteiro.js): se a tela
 *   sair no meio, o resto não acontece
 */
export async function chamarAoPalco({ raiz, campoDoNome, nome, pecas, ficha, selo, botao, roteiro }) {
  if (!raiz) return;
  // A tela sai de campo no primeiro quadro: peça a caminho de sumir continua
  // clicável enquanto não desaparece de verdade (`opacity: 0` não tira o
  // toque), e um segundo dedo no CONFIRMAR mandaria o jogo navegar duas vezes.
  raiz.style.pointerEvents = 'none';

  const camada = el('div', { class: 'pg-locutor' });
  raiz.appendChild(camada);
  const texto = nome ? `${nome.toUpperCase()}!` : '';

  try {
    if (menosMovimento()) {
      for (const no of [...pecas, ficha, selo, botao].filter(Boolean)) {
        no.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
      }
      await roteiro.pausa(200);
      if (!texto) return;
      humor('atracao');
      Som.aplauso(0, 1.6, 0.6);
      grito(camada, T('comVoces'), { cor: 'branco', tam: 64, y: 360, fica: true, chave: 'comVoces' }, roteiro).catch(soInterrupcao);
      await grito(camada, texto, { tam: tamanhoDoNome(texto), y: NOME_Y, fica: true, chave: 'nome' }, roteiro);
      await roteiro.pausa(SEGURA_MS);
      return;
    }

    humor('atracao');
    dispararBotao(camada, botao);

    // O holofote: o palco escurece em volta do centro, onde o nome vai pousar.
    const holofote = el('div', { class: 'cad-holofote' });
    camada.prepend(holofote);
    holofote.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 520, delay: 80, easing: 'ease-out', fill: 'both' });

    // O cartão afunda por último, debaixo das peças que estão nele.
    const vivas = pecas.filter(Boolean);
    vivas.forEach((no, i) => desfazer(no, 40 + i * ENTRE_PECAS_MS));
    ficha?.animate(
      [
        { opacity: 1, scale: '1', filter: 'blur(0px)' },
        { opacity: 0, scale: '0.96', filter: 'blur(6px)' },
      ],
      { duration: 380, delay: 120, easing: 'cubic-bezier(.4,0,.7,.4)', fill: 'forwards' }
    );
    // O logo sobe e sai do quadro: é o "pano" abrindo para o anúncio.
    selo?.animate(
      [
        { opacity: 1, translate: '0 0', scale: '1' },
        { opacity: 0, translate: '0 -150px', scale: '0.8' },
      ],
      { duration: 420, delay: 60, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }
    );

    if (!texto) {
      await roteiro.pausa(40 + vivas.length * ENTRE_PECAS_MS + PECA_MS);
      return;
    }

    const origem = campoDoNome ? ondeEstaONome(campoDoNome) : { x: W / 2 - 40, y: 520, w: 80, h: 40 };
    roteiro.depois(COM_VOCES_MS, () => {
      grito(camada, T('comVoces'), { cor: 'branco', tam: 64, y: 360, fica: true, chave: 'comVoces' }, roteiro).catch(soInterrupcao);
    });

    await roteiro.pausa(DECOLA_MS);
    // O texto digitado apaga enquanto a cópia acende por cima dele.
    campoDoNome?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 90, fill: 'forwards' });
    const anunciado = await voarONome(camada, texto, origem, roteiro);

    // O pouso: pancada, raios, faíscas, a faixa escura abrindo atrás do nome.
    anunciado.classList.add('pousou');
    // Os raios vão logo acima do holofote, e não por cima das frases.
    camada.insertBefore(raios(camada, { y: NOME_Y + 90 }), holofote.nextSibling);
    Som.impacto(0, 0.6);
    Som.fanfarra(0);
    Som.aplauso(0.1, 1.8, 0.7);
    clarao(camada, holofote);
    faiscas({ x: W / 2, y: NOME_Y + 85, n: 70, forca: 1100 });

    await roteiro.pausa(SEGURA_MS);
  } catch (erro) {
    soInterrupcao(erro);
  }
}
