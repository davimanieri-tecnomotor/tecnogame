// A vida da roleta.
//
// O giro que veio do FlutterFlow era uma curva `easeInOut` de 5s sobre 1 a 1,9
// volta: acelera e freia do mesmo jeito, como uma transição de CSS, e para
// exatamente onde o sorteio mandou sem nunca ter parecido pesada. Roda de
// verdade não se move assim — leva um empurrão curto, corre solta e vai
// perdendo velocidade com o atrito até quase parar, e no fim a seta ainda a
// segura e a puxa um pouco para trás.
//
// Este módulo troca a curva por essa física e pendura nela o resto do que faz
// a roda parecer coisa do mundo, e não desenho girando:
//
//   - a seta vira lingueta: cada divisa que passa a empurra e ela volta
//     batendo, por uma mola amortecida de verdade, integrada a cada quadro;
//   - o disco borra quando corre, com cópias dele atrasadas alguns graus —
//     é borrão ANGULAR, que é o que a câmera vê, e não desfoque;
//   - o eixo não é perfeito, então o disco bambeia um par de pixels;
//   - a luz fica PARADA enquanto o disco passa por baixo. É o que mais separa
//     um objeto de uma imagem girando: brilho que gira junto vira adesivo;
//   - e ela ESTALA: a gravação que toca junto é esticada, com `playbackRate`,
//     para durar o giro inteiro (ver TAXA_DA_GRAVACAO) em vez de acabar em
//     4,87s de um giro de 7,11s e deixar a roda girando muda no fim.
//
// O sorteio não muda em nada. As voltas que este módulo acrescenta são
// INTEIRAS, então a fatia que sobra debaixo da seta continua sendo a mesma que
// `escolhaParaIndice` calcula — o jogo abre o carro que a seta mostra.
//
// Tudo aqui sai quando o sistema pede menos movimento.

import { Curves, RotateEffect, menosMovimento } from './anim.js';
import { el } from './widgets.js';

/* ----------------------------------------------------------- o giro ------ */

/**
 * O RITMO DO GIRO.
 *
 * A primeira versão picava em 3,4 voltas/s. Com dez fatias isso são 34 fatias
 * por segundo: ninguém lê nada, a roda vira um borrão cinza e o suspense só
 * começa no último segundo. Medido, não achado.
 *
 * Agora o pico é ~1,9 volta/s — rápido o bastante para borrar e ainda deixar
 * ver que são carros passando — e a cauda lenta, o trecho em que dá para contar
 * fatia por fatia, quase dobrou: de 1,2s para 2,1s. É lá que está o jogo.
 */

/** Empurrão inicial: do repouso à velocidade máxima. */
const T_ARRANQUE = 650;
/** O trecho solto, em que só o atrito age. */
const T_FREIO = 5900;
/** A seta prendendo a última divisa e puxando a roda de volta. */
const T_RECUO = 560;

/**
 * Como a velocidade cai no trecho solto: `v = v0 * (1 - u)^EXPOENTE`.
 *
 * 1 seria atrito seco puro — desaceleração constante, que é o que uma roda bem
 * lubrificada faz e na tela parece mecânico demais, um freio de motor. Acima de
 * 1 a cauda estica: a roda passa a maior parte do tempo devagar, contando as
 * últimas fatias uma a uma, que é o que prende quem olha. 1,9 é onde ela ainda
 * anda no meio do giro e mesmo assim chega arrastando no fim.
 */
const EXPOENTE = 1.9;

/**
 * Voltas INTEIRAS somadas ao que o sorteio pede.
 *
 * `escolha` vale de 1 a 1,9 volta: menos de duas voltas é pouco para a roda
 * ganhar velocidade, e o giro inteiro cabia no campo de visão sem nunca borrar.
 * Sendo inteiras, não mexem em qual fatia para na seta (ver o cabeçalho).
 *
 * Eram 5, e é daí que vinha a maior parte da pressa: 6,5 voltas espremidas em
 * 5,8s. Com 3 dá 4,5 voltas, que continua sendo giro de roda de prêmio e cabe
 * no tempo sem precisar correr.
 */
const VOLTAS_EXTRAS = 3;

/**
 * O giro é uma curva contínua, e o motor de animação só sabe interpolar
 * pedaços. Então a curva é AMOSTRADA: cada pedaço entra como um trecho linear,
 * e é a quantidade deles que faz a emenda sumir. Com poucos, a aceleração
 * aparece em degraus no arranque, que é onde a velocidade muda mais rápido.
 */
const PASSOS_GIRO = 140;
const PASSOS_RECUO = 26;

/** Quanto tempo o giro inteiro leva, do toque à roda parada. */
export const DURACAO_DO_GIRO = T_ARRANQUE + T_FREIO + T_RECUO;

/**
 * A gravação `roleta-normal-1` tem 4,87s de áudio (medido decodificando o
 * arquivo — 233760 amostras a 48kHz). Tocada normal ela acaba bem antes da
 * roda parar; esta taxa a estica em `playbackRate` para os dois terminarem
 * juntos, sem tocar no arquivo nem na física do giro.
 */
const DURACAO_DA_GRAVACAO = 4.87;
export const TAXA_DA_GRAVACAO = DURACAO_DA_GRAVACAO / (DURACAO_DO_GIRO / 1000);

const entre = (v, min, max) => Math.max(min, Math.min(max, v));
/** Módulo que devolve sempre positivo — `%` do JS guarda o sinal. */
const sobra = (v, m) => ((v % m) + m) % m;

/**
 * Quanto a roda passa do alvo antes de a seta puxá-la de volta, em voltas.
 *
 * O limite é a meia fatia: passar disso é a seta apontando o vizinho, e o jogo
 * abriria um carro que a roda não mostrou. Um quarto de meia fatia se vê bem e
 * fica longe da divisa mesmo num baralho comprido.
 */
const recuoDaSeta = (fatias) => Math.min(0.022, 0.25 / Math.max(fatias || 1, 1));

/** Quanto a roda já girou no instante `t`, em unidades de velocidade x ms. */
function anguloCru(t) {
  if (t <= 0) return 0;
  if (t < T_ARRANQUE) {
    // A velocidade sobe por um smoothstep, que começa e termina sem solavanco;
    // a integral dele em [0, u] é u³ - u⁴/2, e vale 1/2 na volta inteira.
    const u = t / T_ARRANQUE;
    return T_ARRANQUE * (u ** 3 - u ** 4 / 2);
  }
  const u = Math.min((t - T_ARRANQUE) / T_FREIO, 1);
  return T_ARRANQUE / 2 + (T_FREIO / (EXPOENTE + 1)) * (1 - (1 - u) ** (EXPOENTE + 1));
}

/**
 * A lista de efeitos do giro, para o `effectsBuilder` da tela.
 *
 * @param {number} voltas quantas voltas o sorteio pediu (`FFAppState.escolha`)
 * @param {number} fatias quantas rodadas o baralho tem
 */
export function efeitosDoGiro(voltas, fatias) {
  const alvo = (voltas ?? 1) + VOLTAS_EXTRAS;
  const recuo = recuoDaSeta(fatias);
  const fimDoFreio = T_ARRANQUE + T_FREIO;
  // O trecho solto acaba PASSADO do alvo; o recuo é que fecha a conta em cima
  // dele. `anguloCru` está em unidades cruas, então a escala traz para voltas.
  const escala = (alvo + recuo) / anguloCru(fimDoFreio);

  const efeitos = [];
  let anterior = 0;
  const trecho = (t0, t1, de, ate) => {
    efeitos.push(RotateEffect({ curve: Curves.linear, delay: t0, duration: t1 - t0, begin: de, end: ate }));
    anterior = ate;
  };

  for (let i = 1; i <= PASSOS_GIRO; i++) {
    const t = (i / PASSOS_GIRO) * fimDoFreio;
    trecho(((i - 1) / PASSOS_GIRO) * fimDoFreio, t, anterior, anguloCru(t) * escala);
  }

  // O recuo: uma oscilação amortecida que sai do ponto passado, cruza o alvo,
  // afunda um pouco do outro lado e morre nele. A janela (1 - u) garante que o
  // ÚLTIMO valor é o alvo exato — a roda tem de parar onde o sorteio mandou, e
  // um resto de milésimo de volta aqui é uma fatia errada num baralho grande.
  for (let i = 1; i <= PASSOS_RECUO; i++) {
    const u = i / PASSOS_RECUO;
    const t = fimDoFreio + u * T_RECUO;
    const a = alvo + recuo * (1 - u) * Math.exp(-2.5 * u) * Math.cos(2 * Math.PI * u);
    trecho(fimDoFreio + ((i - 1) / PASSOS_RECUO) * T_RECUO, t, anterior, a);
  }

  return efeitos;
}

/* -------------------------------------------------------- a lingueta ----- */

/** O quanto a seta é empurrada de lado por um pino, em graus. */
const SETA_ABERTURA = 11;
/**
 * Que fração do vão entre duas divisas o pino passa encostado na seta. Fora
 * dela a seta está solta e só a mola manda.
 */
const SETA_CONTATO = 0.34;
/** Rigidez e amortecimento da mola: ~8,7 Hz, subamortecida, como lâmina fina. */
const SETA_MOLA = 3000;
const SETA_ATRITO = 21;
/** Passo fixo da integração; um quadro de 60 Hz é grosso demais para a mola. */
const SETA_SUBPASSO = 0.002;

/* ----------------------------------------------------------- o borrão ---- */

/**
 * Quantas cópias atrasadas o disco arrasta quando corre.
 *
 * Com a base, são quatro amostras dentro de um quadro. Três é onde o rastro
 * para de mostrar degrau entre uma cópia e a seguinte na velocidade de pico,
 * e cada uma custa só uma camada a mais para o compositor — `transform` e
 * `opacity`, que é o que a placa de vídeo faz de graça.
 */
const ECOS = 3;
/** Velocidade (graus/s) em que o borrão começa e em que satura. */
const BORRAO_DE = 130;
const BORRAO_ATE = 620;
/** Bamboleio do eixo, em pixels, na velocidade cheia. */
const EIXO_FOLGA = 2.2;

/** O ângulo que o disco está mostrando agora, em graus, lido da própria tela. */
function anguloNaTela(no) {
  const t = getComputedStyle(no).transform;
  if (!t || t === 'none') return 0;
  const numeros = t.slice(t.indexOf('(') + 1, t.lastIndexOf(')')).split(',').map(Number);
  if (numeros.length < 6 || numeros.some(Number.isNaN)) return 0;
  // matrix(a, b, ...) — a = cos, b = sen. matrix3d não aparece aqui: o giro é
  // um `rotate()` 2D, e o navegador devolve a forma curta.
  return (Math.atan2(numeros[1], numeros[0]) * 180) / Math.PI;
}

/**
 * Liga a roda ao mundo físico.
 *
 * @param {object} pecas
 * @param {HTMLElement} pecas.disco o que o motor de animação gira
 * @param {HTMLElement} pecas.eixo  a caixa em volta do disco, que bambeia
 * @param {HTMLElement} pecas.pista onde as cópias do borrão entram
 * @param {Element}     pecas.arte  o desenho da roda, que vai ser copiado
 * @param {HTMLElement} pecas.seta  a lingueta
 * @param {HTMLElement} pecas.faisca a luz que responde ao giro
 * @param {number}      pecas.fatias quantas rodadas o baralho tem
 */
export function criarVida({ disco, eixo, pista, arte, seta, faisca, fatias }) {
  const passoDaFatia = 360 / Math.max(fatias || 1, 1);
  const ecos = [];

  let quadro = 0;
  let inicio = 0;
  let ultimo = 0;
  let lido = 0;
  /** A roda já parou? A seta ainda treme um pouco depois disso. */
  let pousou = false;
  /** Ângulo acumulado desde o toque, sem voltar a zero a cada volta. */
  let angulo = 0;
  let velocidade = 0;

  /** Estado da mola da seta: desvio em graus e a velocidade dele. */
  let setaAngulo = 0;
  let setaVelocidade = 0;

  function criarEcos() {
    if (ecos.length || !arte) return;
    for (let i = 0; i < ECOS; i++) {
      // A cópia carrega os mesmos `id` dos gradientes e recortes da roda
      // desenhada. Não é problema: `url(#id)` casa com o primeiro do documento,
      // que é o da roda de verdade, e o desenho é idêntico — a cópia empresta
      // as definições dela. O que não pode é a cópia ser anunciada de novo.
      const copia = arte.cloneNode(true);
      copia.removeAttribute?.('role');
      copia.removeAttribute?.('aria-label');
      copia.setAttribute?.('aria-hidden', 'true');
      const caixa = el('div', { class: 'roleta-eco', 'aria-hidden': 'true' }, copia);
      pista.appendChild(caixa);
      ecos.push(caixa);
    }
  }

  function tirarEcos() {
    for (const eco of ecos) eco.remove();
    ecos.length = 0;
  }

  /**
   * Um passo da mola da seta. `limite` é até onde o pino a empurra: enquanto
   * ele encosta, a seta não pode voltar além dali; quando ele passa, o limite
   * some e a mola a traz de volta batendo, que é o estalo.
   */
  function moverSeta(dt, limite) {
    const vezes = Math.max(1, Math.ceil(dt / SETA_SUBPASSO));
    const h = dt / vezes;
    for (let i = 0; i < vezes; i++) {
      setaVelocidade += (-SETA_MOLA * setaAngulo - SETA_ATRITO * setaVelocidade) * h;
      setaAngulo += setaVelocidade * h;
      if (setaAngulo > limite) {
        setaAngulo = limite;
        if (setaVelocidade > 0) setaVelocidade = 0;
      }
    }
  }

  function passo(agora) {
    const dt = Math.min((agora - ultimo) / 1000, 0.05);
    ultimo = agora;

    // O ângulo vem da tela, e não do relógio: assim a seta bate junto com a
    // divisa que ela está mostrando, mesmo que a animação tenha começado um
    // quadro depois do toque.
    const atual = anguloNaTela(disco);
    let avanco = atual - lido;
    // A leitura volta a zero a cada volta; o salto de mais de meia volta num
    // quadro é a virada, não movimento. No pico o disco anda menos de 20° por
    // quadro a 60 Hz — longe dos 180 que confundiriam a conta.
    if (avanco > 180) avanco -= 360;
    if (avanco <= -180) avanco += 360;
    lido = atual;
    angulo += avanco;

    const bruta = dt > 0 ? avanco / dt : 0;
    // Um pouco de suavização: quadro perdido vira pico de velocidade, e o pico
    // apareceria como um tranco no borrão.
    velocidade += (bruta - velocidade) * 0.45;

    // --- a lingueta ------------------------------------------------------
    // `u` é onde a seta está dentro do vão entre duas divisas: 0 logo depois de
    // uma passar, 1 quando a seguinte chega. A meia fatia de deslocamento é
    // porque a roda para com a seta no MEIO da fatia, e não sobre a divisa.
    const u = sobra(angulo / passoDaFatia + 0.5, 1);

    const encosta = u - (1 - SETA_CONTATO);
    // O disco gira no sentido horário, então lá embaixo os pinos correm para a
    // esquerda e empurram a ponta da seta para esse lado — giro negativo.
    const limite = encosta <= 0 ? Infinity : -SETA_ABERTURA * (encosta / SETA_CONTATO) ** 1.3;
    moverSeta(dt, limite);
    seta.style.transform = `rotate(${setaAngulo.toFixed(2)}deg)`;

    // --- o borrão --------------------------------------------------------
    const corrida = entre((Math.abs(velocidade) - BORRAO_DE) / (BORRAO_ATE - BORRAO_DE), 0, 1);
    if (ecos.length) {
      // O rastro cobre o que o disco varre em um quadro, repartido entre as
      // cópias: é o que uma câmera registraria com o obturador aberto.
      const varrido = velocidade / 60;
      for (let i = 0; i < ecos.length; i++) {
        const atraso = (-varrido * (i + 1)) / (ecos.length + 1);
        ecos[i].style.transform = `rotate(${atraso.toFixed(2)}deg)`;
        // As opacidades NÃO são iguais. Empilhadas uma sobre a outra, cópias de
        // mesma opacidade dão peso maior à de cima e o rastro pende para trás;
        // 1/(i+2) é o que faz as quatro amostras pesarem um quarto cada, que é
        // a média que o obturador tira.
        ecos[i].style.opacity = (corrida / (i + 2)).toFixed(3);
      }
    }
    // Aqui houve um fio de `blur()` por cima do rastro, para apagar o degrau
    // entre uma cópia e a seguinte. Saiu: mudar o raio do desfoque a cada
    // quadro obriga o navegador a redesenhar a roda inteira fora da placa de
    // vídeo, e isso travava o giro por 250ms de cada vez, quatro vezes. Uma
    // cópia a mais custa uma camada e resolve o mesmo degrau de graça.

    // --- o eixo torto ----------------------------------------------------
    const folga = EIXO_FOLGA * corrida;
    const rad = (angulo * Math.PI) / 180;
    eixo.style.transform = folga
      ? `translate(${(Math.cos(rad) * folga).toFixed(2)}px, ${(Math.sin(rad) * folga).toFixed(2)}px)`
      : '';

    // --- a luz -----------------------------------------------------------
    if (faisca && !pousou) faisca.style.opacity = (corrida * 0.85).toFixed(3);

    const decorrido = agora - inicio;
    if (!pousou && decorrido >= DURACAO_DO_GIRO) {
      pousou = true;
      pousar();
    }
    // A seta ainda está batendo quando a roda já parou: a última divisa a
    // segurou e a mola leva um tempinho para devolvê-la ao prumo. Sair do laço
    // junto com a roda travava a seta torta na tela.
    if (decorrido < DURACAO_DO_GIRO + 420) {
      quadro = requestAnimationFrame(passo);
      return;
    }
    quadro = 0;
    desmontar();
  }

  /**
   * A roda parou. Sai tudo que só existia enquanto ela corria, e o aro dá o
   * estalo de luz — que precisa acontecer AQUI, e não quando o laço acaba: o
   * jogo abre o carro um segundo depois, e o piscar não caberia na sobra.
   */
  function pousar() {
    tirarEcos();
    if (faisca) {
      // A opacidade fica com a animação; o valor em linha a engessaria no fim.
      faisca.style.opacity = '';
      faisca.classList.remove('roleta-faisca--parou');
      void faisca.offsetWidth;
      faisca.classList.add('roleta-faisca--parou');
    }
  }

  /** A seta assentou: nada mais se mexe até o próximo toque. */
  function desmontar() {
    seta.style.transform = '';
    eixo.style.transform = '';
    setaAngulo = 0;
    setaVelocidade = 0;
  }

  return {
    /** Começa a acompanhar o giro. Chamar junto do `forward()` da animação. */
    girar() {
      if (menosMovimento()) return;
      criarEcos();
      pousou = false;
      angulo = 0;
      velocidade = 0;
      lido = anguloNaTela(disco);
      inicio = performance.now();
      ultimo = inicio;
      faisca?.classList.remove('roleta-faisca--parou');
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(passo);
    },
    /** A tela saiu no meio do giro. */
    parar() {
      cancelAnimationFrame(quadro);
      quadro = 0;
      tirarEcos();
      desmontar();
    },
  };
}
