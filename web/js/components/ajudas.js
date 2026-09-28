// As ajudas, como fichas de auditório.
//
// São sete, e o jogador pode usar DUAS por partida (a regra do Dart continua):
//
//   as cinco de sempre   Apoio Técnico, Cursos EAD, TecnomotorTV, Comunidade e
//                        Representante — com as fotos e os textos do baralho;
//   Cartas               a ajuda mais conhecida do Show do Milhão: o jogador
//                        vira uma de quatro cartas; o Rei não tira nada, o Ás,
//                        o 2 e o 3 tiram uma, duas ou três alternativas erradas;
//   Placas               a porcentagem dos jogadores anteriores que escolheram
//                        cada alternativa DESTA pergunta — dado de verdade,
//                        gravado a cada partida desde a 3.0 (ver backend.js).
//
// Usar uma ficha vira a moeda e mostra um X no verso, e o cartão da ajuda
// nasce DE DENTRO dela: o olho acompanha de onde a ajuda veio. As cinco de
// sempre chegam como uma conversa — chamando, a foto, "digitando…", e a dica
// digitada a ~70 letras por segundo: rápido o bastante para não roubar o
// relógio, lento o bastante para parecer gente.
//
// O relógio NÃO para durante a ajuda. Nunca parou, e é o que dá peso à
// escolha de pedir.

import { el, fonte } from '../widgets.js';
import { entrar, menosMovimento } from '../anim.js';
import { Som } from '../som.js';
import { T, Tf } from '../textos.js';
import { noPalco } from '../particulas.js';
import { BotaoDeAuditorio } from './botao.js';
import { soInterrupcao } from '../roteiro.js';

/** Quantas ajudas uma partida pode usar. */
export const MAX_AJUDAS = 2;

/** Placas precisa de gente: com menos votos que isto, a porcentagem mente. */
export const MIN_VOTOS_PARA_PLACAS = 3;

const ICONE = {
  fone: '<path d="M14 36v-6a18 18 0 0 1 36 0v6"/><rect x="9" y="34" width="11" height="17" rx="4"/><rect x="44" y="34" width="11" height="17" rx="4"/><path d="M50 51c0 5-5 8-12 8h-5"/>',
  capelo: '<path d="M4 26 32 14l28 12-28 12z"/><path d="M16 32v11c0 4 7 8 16 8s16-4 16-8V32"/><path d="M60 26v15"/>',
  play: '<rect x="7" y="13" width="50" height="33" rx="6"/><path d="M28 22v15l12-7.5z"/><path d="M22 54h20"/>',
  grupo: '<circle cx="21" cy="23" r="7"/><circle cx="43" cy="23" r="7"/><path d="M7 50c0-8 6-13 14-13s14 5 14 13"/><path d="M33 41c2-3 6-4 10-4 8 0 14 5 14 13"/>',
  maleta: '<rect x="8" y="21" width="48" height="31" rx="5"/><path d="M24 21v-6h16v6"/><path d="M8 34h48"/><path d="M29 34v5h6v-5"/>',
  cartas: '<rect x="9" y="15" width="25" height="36" rx="4" transform="rotate(-12 21 33)"/><rect x="29" y="12" width="25" height="36" rx="4" transform="rotate(10 41 30)"/><path d="M41 24l3 5-3 5-3-5z"/>',
  placas: '<rect x="11" y="9" width="42" height="28" rx="4"/><path d="M32 37v19"/><path d="M20 19h24M20 27h14"/>',
  x: '<path d="M18 18 46 46M46 18 18 46"/>',
};

/**
 * As sete fichas. `campo` é o texto da dica no baralho; `foto` e `recorte` são
 * a foto do time e o quadro que corta as margens transparentes dela, medido no
 * arquivo (a caixa alfa da imagem).
 */
export const AJUDAS = [
  { chave: 'apoio', tipo: 'conversa', campo: 'ajudaApoio', icone: ICONE.fone, cor: '#0B5BD3', foto: 'assets/images/Apoio_(1).png', recorte: 'inset(20.3% 4.6% 25.1% 4.9%)', nome: 'ajudaApoio' },
  { chave: 'ead', tipo: 'conversa', campo: 'ajudaTreinamentoEad', icone: ICONE.capelo, cor: '#6A3BD9', foto: 'assets/images/Instrutores_(1)_(1).png', recorte: 'inset(22% 2.1% 21.9% 1.7%)', nome: 'ajudaEad' },
  { chave: 'tv', tipo: 'conversa', campo: 'ajudaTecnomotorTv', icone: ICONE.play, cor: '#D3202A', foto: 'assets/images/TecnmotorTV.png', recorte: 'inset(18.9% 5.3% 10.2% 6.7%)', nome: 'ajudaTv' },
  { chave: 'comunidade', tipo: 'conversa', campo: 'ajudaComunidade', icone: ICONE.grupo, cor: '#1C9B55', foto: 'assets/images/Comunidade.png', recorte: 'inset(5.3% 6.9% 9.5% 6%)', nome: 'ajudaComunidade' },
  { chave: 'rep', tipo: 'conversa', campo: 'ajudaRepresentanteComercial', icone: ICONE.maleta, cor: '#C97A00', foto: 'assets/images/Representantes_(1).png', recorte: 'inset(27% 4.6% 25.1% 4.9%)', nome: 'ajudaRep' },
  { chave: 'cartas', tipo: 'cartas', icone: ICONE.cartas, cor: '#8B1E3F', nome: 'ajudaCartas' },
  { chave: 'placas', tipo: 'placas', icone: ICONE.placas, cor: '#0E7490', nome: 'ajudaPlacas' },
];

const rotuloDe = (a) => (a.tipo === 'conversa' ? T(`${a.nome}Rotulo`) : T(a.nome));

/**
 * Quantas erradas cada carta tira. O baralho das Cartas é sempre este: Rei,
 * Ás, 2 e 3, embaralhados a cada partida.
 */
export const CARTAS = [
  { rotulo: 'K', naipe: '♠', tira: 0, vermelha: false },
  { rotulo: 'A', naipe: '♥', tira: 1, vermelha: true },
  { rotulo: '2', naipe: '♦', tira: 2, vermelha: true },
  { rotulo: '3', naipe: '♣', tira: 3, vermelha: false },
];

/** Embaralha (Fisher-Yates). `sorte` entra por parâmetro para o teste. */
export function embaralhar(lista, sorte = Math.random) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(sorte() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Quais alternativas uma carta tira: `quantas` erradas, sorteadas entre as que
 * ainda estão em cena. Nunca a certa — e nunca mais do que as erradas que
 * sobram.
 */
export function sortearEliminadas(erradasEmCena, quantas, sorte = Math.random) {
  return embaralhar(erradasEmCena, sorte).slice(0, Math.max(0, Math.min(quantas, erradasEmCena.length)));
}

/**
 * As porcentagens das Placas, na ordem da TELA. Os votos são gravados pelo
 * número ORIGINAL da resposta (1 a 4 no baralho) — é o que continua valendo de
 * uma partida para outra, embaralhadas cada uma de um jeito —, e `ordem[i]` diz
 * qual número original está na posição `i` desta tela.
 *
 * As porcentagens são arredondadas e o resto vai para a maior: a soma dá 100
 * na tela, que é o que o olho confere.
 */
export function porcentagensNaTela(contagemOriginal, ordem) {
  const naTela = ordem.map((n) => contagemOriginal[n - 1] ?? 0);
  const total = naTela.reduce((s, v) => s + v, 0);
  if (!total) return { total: 0, porcentagens: [0, 0, 0, 0] };
  const brutas = naTela.map((v) => (v / total) * 100);
  const porcentagens = brutas.map((v) => Math.floor(v));
  let sobra = 100 - porcentagens.reduce((s, v) => s + v, 0);
  const ordemDasSobras = brutas.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; sobra > 0 && k < ordemDasSobras.length; k++, sobra--) porcentagens[ordemDasSobras[k][1]] += 1;
  return { total, porcentagens };
}

/**
 * @param {object} opcoes
 * @param {object} opcoes.textos a dica de cada ajuda de conversa, no idioma em vigor (`{ ajudaApoio: '...' }`)
 * @param {object} opcoes.medidas `{ x, y, largura }` — onde a fileira de fichas fica
 * @param {object} opcoes.cartao `{ x, y, w, h }` — onde o cartão da ajuda abre
 * @param {HTMLElement} opcoes.camada onde o cartão entra (a camada do locutor)
 * @param {object} opcoes.roteiro o roteiro da tela
 * @param {Function} opcoes.podeUsar a tela diz se é hora (o relógio correndo, nada aberto)
 * @param {Function} opcoes.aoAbrir
 * @param {Function} opcoes.aoFechar
 * @param {Function} opcoes.erradasEmCena as posições erradas que ainda dá para tirar
 * @param {Function} opcoes.eliminar tira de cena as posições pedidas
 * @param {Promise<{contagem: number[], total: number}>} opcoes.votos os votos desta pergunta
 * @param {number[]} opcoes.ordem o número original de cada posição da tela
 */
export function Ajudas(opcoes) {
  const { textos, medidas, cartao: M, camada, roteiro, podeUsar, aoAbrir, aoFechar, erradasEmCena, eliminar, votos, ordem } = opcoes;

  let usadas = 0;
  let aberto = null;
  /** Os votos, quando chegarem: `null` enquanto a consulta anda. */
  let placas = null;

  const pinos = el('span', { class: 'aud-aj-pinos' }, Array.from({ length: MAX_AJUDAS }, () => el('i')));
  const contagem = el('b', { text: `· ${Tf('ajudasDisponiveis', { n: MAX_AJUDAS })}` });
  const titulo = el('div', { class: 'ff-text aud-aj-titulo aud-oculta', style: { fontSize: fonte(17) } }, [
    el('span', {}, [T('ajudas'), ' ', contagem]),
    pinos,
  ]);

  const fichas = AJUDAS.map((a, i) => {
    const moeda = el('div', { class: 'aud-ficha-moeda' }, [
      el('div', { class: 'aud-ficha-face' }),
      el('div', { class: 'aud-ficha-verso' }),
    ]);
    // Os ícones são desenho nosso, constante — nada do baralho passa por aqui.
    moeda.firstChild.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">${a.icone}</svg>`;
    moeda.lastChild.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">${ICONE.x}</svg>`;
    const rotulo = el('div', { class: 'ff-text aud-ficha-rotulo', text: rotuloDe(a), style: { fontSize: fonte(13) } });
    const nota = el('div', { class: 'ff-text aud-ficha-nota', style: { fontSize: fonte(12) } });
    const f = el(
      'div',
      {
        class: 'aud-ficha aud-oculta',
        role: 'button',
        tabindex: '0',
        dataAjuda: a.chave,
        'aria-label': `${T('ajudas')}: ${rotuloDe(a).replace(/-?\n/g, '')}`,
      },
      [moeda, rotulo, nota]
    );
    f.style.setProperty('--i', String(i));
    f.style.setProperty('--cor', a.cor);
    const tocar = (e) => {
      e?.stopPropagation?.();
      usar(a, f);
    };
    f.addEventListener('click', tocar);
    f.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        tocar(e);
      }
    });
    f._nota = nota;
    return f;
  });

  const raiz = el(
    'div',
    { class: 'aud-ajudas', style: { left: `${medidas.x}px`, top: `${medidas.y}px`, width: `${medidas.largura}px` } },
    [titulo, el('div', { class: 'aud-aj-fichas' }, fichas)]
  );

  const fichaPlacas = fichas.find((f) => f.dataset.ajuda === 'placas');
  Promise.resolve(votos)
    .then((v) => {
      placas = v ?? { contagem: [0, 0, 0, 0], total: 0 };
      if (placas.total < MIN_VOTOS_PARA_PLACAS) {
        fichaPlacas.classList.add('sem-votos');
        fichaPlacas._nota.textContent = T('semVotos');
      }
    })
    .catch(() => {
      placas = { contagem: [0, 0, 0, 0], total: 0 };
      fichaPlacas.classList.add('sem-votos');
      fichaPlacas._nota.textContent = T('semVotos');
    });

  const disponivel = (f) =>
    usadas < MAX_AJUDAS && !f.classList.contains('usada') && !f.classList.contains('sem-votos') && !(f.dataset.ajuda === 'cartas' && erradasEmCena().length === 0);

  /** A ficha que não pode agora dá um "não" curto, e só. */
  function recusar(f) {
    Som.blip(0, false);
    if (menosMovimento()) return;
    f.animate([{ translate: '0 0' }, { translate: '-8px 0' }, { translate: '7px 0' }, { translate: '-4px 0' }, { translate: '0 0' }], {
      duration: 320,
      easing: 'ease-out',
    });
  }

  function gastar(f) {
    usadas += 1;
    pinos.querySelectorAll('i').forEach((p, k) => p.classList.toggle('gasto', k < usadas));
    const resta = MAX_AJUDAS - usadas;
    contagem.textContent = `· ${resta === 0 ? T('ajudasEsgotadas') : resta === 1 ? T('ajudaDisponivel') : Tf('ajudasDisponiveis', { n: resta })}`;
    f.classList.add('usada');
    f.setAttribute('aria-disabled', 'true');
    if (usadas >= MAX_AJUDAS) raiz.classList.add('esgotadas');
    Som.brilho();
  }

  function usar(a, f) {
    if (!podeUsar() || aberto) return;
    if (!disponivel(f)) {
      recusar(f);
      return;
    }
    gastar(f);
    aoAbrir();
    if (a.tipo === 'cartas') abrirCartas(a, f);
    else if (a.tipo === 'placas') abrirPlacas(a, f);
    else abrirConversa(a, f);
  }

  /** O esqueleto do cartão, nascendo da ficha. */
  function cartao(a, f, corpo, { chave, largura = M.w, altura = M.h } = {}) {
    const topo = el('div', { class: 'aud-cartao-topo' }, [
      el('span', { class: 'aud-cartao-icone' }),
      el('strong', { class: 'ff-text', text: T(a.nome), style: { fontSize: fonte(22) } }),
      a.tipo === 'conversa' ? el('small', { class: 'ff-text', text: T('onlineAgora'), style: { fontSize: fonte(14) } }) : null,
    ]);
    topo.firstChild.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">${a.icone}</svg>`;
    const pe = el('div', { class: 'aud-cartao-pe aud-oculta' });
    const no = el(
      'div',
      {
        class: `aud-cartao aud-cartao--${a.tipo}`,
        dataCartaoAjuda: a.chave,
        role: 'dialog',
        style: { left: `${M.x}px`, top: `${M.y}px`, width: `${largura}px`, height: `${altura}px` },
      },
      [topo, corpo, pe]
    );
    no.style.setProperty('--cor', a.cor);
    camada.appendChild(no);

    const [fx, fy] = noPalco(f.querySelector('.aud-ficha-moeda'));
    const cx = M.x + largura / 2;
    const cy = M.y + altura / 2;
    entrar(
      no,
      [
        { transform: `translate(${fx - cx}px, ${fy - cy}px) scale(.12)`, opacity: 0, borderRadius: '50%' },
        { transform: 'none', opacity: 1, borderRadius: '26px' },
      ],
      { duration: 480, easing: 'cubic-bezier(.2,.9,.25,1)' }
    );
    Som.whoosh(0, 0.4, 0.18);

    let fechado = false;
    const fechar = () => {
      if (fechado) return;
      fechado = true;
      aberto = null;
      no.style.pointerEvents = 'none';
      Som.whoosh(0, 0.3, 0.14, false);
      no.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.9) translateY(20px)' }], {
        duration: 220,
        easing: 'ease-in',
        fill: 'forwards',
      }).finished.then(
        () => no.remove(),
        () => no.remove()
      );
      aoFechar();
    };
    const entendi = BotaoDeAuditorio(T('entendi'), { menor: true, acao: 'entendi', aoTocar: fechar });
    pe.appendChild(entendi);
    aberto = { chave, fechar, get fechado() { return fechado; } };
    return { no, pe, fechar, mostrarPe: () => entrar(pe, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 260 }) };
  }

  /* ------------------------------------------------ as cinco de conversa -- */

  async function abrirConversa(a, f) {
    const chamando = el('div', { class: 'ff-text aud-chamando', text: T(`${a.nome}Verbo`), style: { fontSize: fonte(18) } });
    const foto = el('img', { src: a.foto, alt: '', draggable: 'false', style: { objectViewBox: a.recorte } });
    const balao = el('div', { class: 'ff-text aud-balao', style: { fontSize: fonte(24) } }, el('span', { class: 'aud-digitando' }, [el('i'), el('i'), el('i')]));
    const corpo = el('div', { class: 'aud-cartao-corpo' }, [
      el('div', { class: 'aud-cartao-foto' }, [foto, chamando]),
      el('div', { class: 'aud-cartao-conversa' }, [
        el('div', { class: 'ff-text aud-cartao-quem', text: T(`${a.nome}Quem`), style: { fontSize: fonte(15) } }),
        balao,
      ]),
    ]);
    const c = cartao(a, f, corpo, { chave: a.chave });
    try {
      Som.chamar(0.05);
      await roteiro.pausa(menosMovimento() ? 150 : 950);
      if (!aberto) return;
      chamando.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' });
      await roteiro.pausa(650);
      if (!aberto) return;
      Som.mensagem();
      const alvo = el('span');
      balao.replaceChildren(alvo);
      const texto = textos[a.campo] ?? '';
      for (let k = 1; k <= texto.length; k += 2) {
        if (!aberto) return;
        alvo.textContent = texto.slice(0, k);
        if (k % 6 === 1) Som.digitar();
        await roteiro.pausa(menosMovimento() ? 0 : 28);
      }
      alvo.textContent = texto;
      c.mostrarPe();
    } catch (erro) {
      soInterrupcao(erro);
    }
  }

  /* ------------------------------------------------------------ cartas ---- */

  function abrirCartas(a, f) {
    const baralho = embaralhar(CARTAS);
    const mesa = el('div', { class: 'aud-mesa-cartas' });
    const resultado = el('div', { class: 'ff-text aud-cartas-resultado', style: { fontSize: fonte(24) } });
    const corpo = el('div', { class: 'aud-cartao-corpo aud-cartao-corpo--cartas' }, [
      el('div', { class: 'ff-text aud-cartas-titulo', text: T('ajudaCartasTitulo'), style: { fontSize: fonte(26) } }),
      el('div', { class: 'ff-text aud-cartas-sub', text: T('ajudaCartasSub'), style: { fontSize: fonte(17) } }),
      mesa,
      resultado,
    ]);
    // Mais alto que o das conversas: a mesa das cartas e o resultado pedem espaço.
    const c = cartao(a, f, corpo, { chave: 'cartas', altura: M.h + 70 });
    let virada = false;

    const cartasNos = baralho.map((carta, i) => {
      const frente = el('div', { class: `aud-carta-frente${carta.vermelha ? ' vermelha' : ''}` }, [
        el('b', { text: carta.rotulo }),
        el('span', { text: carta.naipe }),
      ]);
      const verso = el('div', { class: 'aud-carta-verso' });
      const no = el('div', { class: 'aud-carta', role: 'button', tabindex: '0', dataCarta: carta.rotulo, 'aria-label': `carta ${i + 1}` }, [
        el('div', { class: 'aud-carta-miolo' }, [verso, frente]),
      ]);
      no.style.setProperty('--i', String(i));
      const escolher = (e) => {
        e?.stopPropagation?.();
        if (virada) return;
        virada = true;
        revelar(i);
      };
      no.addEventListener('click', escolher);
      no.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          escolher(e);
        }
      });
      mesa.appendChild(no);
      entrar(no, [{ transform: 'translateY(60px) rotate(-8deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], {
        duration: 380,
        delay: 160 + i * 90,
        easing: 'cubic-bezier(.2,1.2,.4,1)',
      });
      return no;
    });

    async function revelar(i) {
      try {
        const carta = baralho[i];
        cartasNos[i].classList.add('virada', 'escolhida');
        Som.travar();
        await roteiro.pausa(520);
        const tirar = sortearEliminadas(erradasEmCena(), carta.tira);
        resultado.textContent =
          carta.tira === 0 ? T('cartaRei') : tirar.length === 1 ? T('cartaTiraUma') : Tf('cartaTira', { n: tirar.length });
        if (tirar.length) {
          Som.brilho();
          eliminar(tirar);
        } else {
          // O Rei não tira nada: um baque seco, e não o som da derrota — a
          // partida continua.
          Som.clunk();
        }
        // As outras viram também, como no programa: o jogador vê o que perdeu.
        cartasNos.forEach((n, k) => {
          if (k !== i) setTimeout(() => n.classList.add('virada'), 180 + k * 90);
        });
        c.mostrarPe();
        await roteiro.pausa(2600);
        if (aberto?.chave === 'cartas') c.fechar();
      } catch (erro) {
        soInterrupcao(erro);
      }
    }
  }

  /* ------------------------------------------------------------ placas ---- */

  async function abrirPlacas(a, f) {
    const barras = el('div', { class: 'aud-placas' });
    const sub = el('div', { class: 'ff-text aud-placas-sub', style: { fontSize: fonte(17) } });
    const corpo = el('div', { class: 'aud-cartao-corpo aud-cartao-corpo--placas' }, [
      el('div', { class: 'ff-text aud-cartas-titulo', text: T('ajudaPlacasTitulo'), style: { fontSize: fonte(24) } }),
      barras,
      sub,
    ]);
    const c = cartao(a, f, corpo, { chave: 'placas', altura: M.h + 60 });
    try {
      const v = await roteiro.aguardar(Promise.resolve(votos));
      const { total, porcentagens } = porcentagensNaTela(v?.contagem ?? [0, 0, 0, 0], ordem);
      sub.textContent = Tf('ajudaPlacasSub', { n: total });
      porcentagens.forEach((p, i) => {
        const valor = el('b', { class: 'ff-text', text: `${p}%`, style: { fontSize: fonte(24) } });
        const coluna = el('i');
        coluna.style.setProperty('--p', String(p / 100));
        const placa = el('div', { class: 'aud-placa-voto', dataPlaca: String(i) }, [
          valor,
          el('div', { class: 'aud-placa-trilho' }, coluna),
          el('span', { class: 'aud-placa-num', text: String(i + 1) }),
        ]);
        barras.appendChild(placa);
        if (!menosMovimento()) {
          coluna.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], {
            duration: 700,
            delay: 150 + i * 120,
            easing: 'cubic-bezier(.2,.9,.3,1)',
            fill: 'backwards',
          });
        }
        Som.pop(0.15 + i * 0.12, 520 + i * 90);
      });
      c.mostrarPe();
    } catch (erro) {
      soInterrupcao(erro);
    }
  }

  return {
    no: raiz,
    /** As fichas entram girando, uma a uma, com um "pop" que sobe de nota. */
    async entrar(rot) {
      entrar(titulo, [{ opacity: 0, transform: 'translateY(-12px)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: 'ease-out' });
      fichas.forEach((f, i) => {
        entrar(
          f,
          [
            { transform: 'scale(0) rotate(-40deg)', opacity: 0 },
            { transform: 'scale(1.12) rotate(4deg)', opacity: 1, offset: 0.7 },
            { transform: 'none', opacity: 1 },
          ],
          { duration: 460, delay: i * 80, easing: 'cubic-bezier(.2,.9,.3,1)' }
        );
        Som.pop(i * 0.08, 520 + i * 60);
      });
      await rot.pausa(300);
    },
    /** Fecha o cartão aberto, se houver — o tempo acabou, ou a tela saiu. */
    fechar() {
      aberto?.fechar();
    },
    get aberta() {
      return Boolean(aberto);
    },
    get usadas() {
      return usadas;
    },
    /** A partida acabou: nenhuma ficha responde mais. */
    travar() {
      raiz.classList.add('esgotadas');
      usadas = MAX_AJUDAS;
    },
  };
}
