// O áudio do jogo: um contexto, um barramento e o estalo da roleta.
//
// ATÉ A 2.x o jogo tocava arquivos: o `AudioPlayer` daqui imitava o
// `just_audio` do Dart e tocava mp3 de terceiros — o "select" do Undertale, a
// fanfarra de vitória do Final Fantasy, a derrota do Brawl Stars, o tema do
// Jaspion e uma faixa 8-bit. Saíram todos na 3.0: licença de música de terceiros
// num estande é risco, o jogo é servido publicamente pelo GitHub Pages (quem
// abre a página baixa os mp3), e por `file://` a Web Audio nem busca arquivo.
// Toda a sonoplastia passou a ser SINTETIZADA na hora — ver som.js.
//
// Aqui fica o que é de todos:
//
//   - o `AudioContext` único (o navegador limita quantos uma página abre);
//   - o BARRAMENTO: um ganho de volume, um limitador e uma "sala" de
//     reverberação. Tudo que o jogo toca passa por ele, para o operador ter um
//     volume e um mudo só (ver `definirVolume`) e para fanfarra, aplauso e grave
//     somados não estourarem a caixa de som do estande;
//   - o estalo da roleta, que continua sendo o recorte gravado de estalo.js.

import { ESTALO } from './estalo.js';
import { readRaw, writeRaw } from './storage.js';

/* ---------------------------------------------------------- o contexto --- */

let contexto = null;

/**
 * O contexto de áudio, criado no primeiro uso.
 *
 * Nasce suspenso até o primeiro gesto (política de autoplay dos navegadores);
 * `desbloquear`, abaixo, o acorda no primeiro toque ou tecla.
 */
export function contextoDeAudio() {
  if (contexto) return contexto;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    contexto = new Ctor();
  } catch (_) {
    return null;
  }
  return contexto;
}

function desbloquear() {
  contexto?.resume?.().catch(() => {});
}

// Fora do navegador (os testes de unidade importam o roteador, que importa o
// som) não há janela para ouvir.
if (typeof window !== 'undefined') {
  for (const tipo of ['pointerdown', 'keydown', 'touchstart']) {
    window.addEventListener(tipo, desbloquear, { capture: true });
  }
}

/* ------------------------------------------------------ o barramento ----- */

/**
 * O volume do operador, de 0 a 1, guardado neste navegador.
 *
 * 0,9 e não 1: o limitador trabalha menos com folga, e é o volume em que os
 * sons desta versão foram equilibrados entre si.
 */
const VOLUME_PADRAO = 0.9;
const CHAVE_VOLUME = 'som.volume';
const CHAVE_MUDO = 'som.mudo';

let volume = lerVolume();
let mudo = readRaw(CHAVE_MUDO) === '1';

function lerVolume() {
  const v = Number.parseFloat(readRaw(CHAVE_VOLUME) ?? '');
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : VOLUME_PADRAO;
}

let barra = null;

/**
 * O barramento de saída: `{ ctx, saida, sala }`, ou null sem Web Audio.
 *
 * `saida` é onde todo som se liga; `sala` é o envio para a reverberação, que
 * volta misturada na saída. O impulso da sala é ruído com queda exponencial,
 * gerado aqui mesmo — é o que faz um sino soar num estúdio, e não dentro da
 * caixa, sem arquivo nenhum.
 */
export function barramento() {
  const ctx = contextoDeAudio();
  if (!ctx) return null;
  if (barra) return barra;

  const limitador = ctx.createDynamicsCompressor();
  limitador.threshold.value = -16;
  limitador.knee.value = 12;
  limitador.ratio.value = 5;
  limitador.attack.value = 0.002;
  limitador.release.value = 0.2;

  const saida = ctx.createGain();
  saida.gain.value = mudo ? 0 : volume;
  saida.connect(limitador).connect(ctx.destination);

  const sala = ctx.createConvolver();
  sala.buffer = impulsoDaSala(ctx, 2.4, 3.2);
  const retorno = ctx.createGain();
  retorno.gain.value = 0.25;
  sala.connect(retorno).connect(saida);

  barra = { ctx, saida, sala };
  return barra;
}

function impulsoDaSala(ctx, segundos, queda) {
  const n = Math.floor(ctx.sampleRate * segundos);
  const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, queda);
  }
  return b;
}

function aplicarVolume() {
  if (!barra) return;
  barra.saida.gain.setTargetAtTime(mudo ? 0 : volume, barra.ctx.currentTime, 0.03);
}

/** O volume do operador (0 a 1). */
export const volumeAtual = () => volume;

/** Muda e guarda o volume. Ligar o volume desliga o mudo — é o que se espera. */
export function definirVolume(v) {
  volume = Math.min(1, Math.max(0, Number(v) || 0));
  writeRaw(CHAVE_VOLUME, String(volume));
  if (mudo && volume > 0) {
    mudo = false;
    writeRaw(CHAVE_MUDO, '0');
  }
  aplicarVolume();
  return volume;
}

export const estaMudo = () => mudo;

/** Liga ou desliga o som de tudo. Devolve se ficou mudo. */
export function alternarMudo() {
  mudo = !mudo;
  writeRaw(CHAVE_MUDO, mudo ? '1' : '0');
  aplicarVolume();
  return mudo;
}

/* -------------------------------------------------- sons sintetizados ----- */

/**
 * Um estalo curto. `frequencia` em Hz, `duracao` em segundos.
 *
 * O envelope é o que separa "relógio" de "bipe de forno": ataque quase
 * instantâneo (5ms) e queda exponencial. Uma nota de volume constante soa como
 * alarme; esta soa como ponteiro.
 *
 * `quando` é um instante no relógio do áudio, para quem marca com antecedência
 * (os tiques da reta final); sem ele, toca agora.
 */
export function tique({ frequencia = 1040, duracao = 0.07, volume: vol = 0.16, quando = null } = {}) {
  const b = barramento();
  if (!b) return;
  const { ctx } = b;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const agora = Math.max(quando ?? ctx.currentTime, ctx.currentTime);
  const osc = ctx.createOscillator();
  const ganho = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(frequencia, agora);
  // exponentialRampToValueAtTime não aceita zero, daí o 0.0001 nas pontas.
  ganho.gain.setValueAtTime(0.0001, agora);
  ganho.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), agora + 0.005);
  ganho.gain.exponentialRampToValueAtTime(0.0001, agora + duracao);

  osc.connect(ganho).connect(b.saida);
  osc.start(agora);
  osc.stop(agora + duracao + 0.02);
}

/* ------------------------------------------------- o estalo da roleta ----- */

/**
 * O volume em que a gravação inteira tocava no giro. O recorte guarda a
 * amplitude original dela (ver estalo.js), então o estalo sai tão alto quanto
 * saía lá.
 */
const VOLUME_DO_ESTALO = 0.45;

/**
 * Estalos apinhados perdem volume, como na gravação de onde este veio.
 *
 * Medido nela: o estalo sai cheio até 18 por segundo, cai à metade (0,48) a 25
 * e a um quarto (0,26) a 33 — `(18 / ritmo) ^ 2,2` passa pelos três. Com dez
 * fatias a roda pica em 17 a 21 estalos/s, e quase não se nota; num baralho de
 * 30 fatias ela passa de 55/s, e sem isto o pico seria um zumbido por cima de
 * tudo.
 */
const RITMO_CHEIO = 18;
const QUEDA_COM_O_RITMO = 2.2;

/**
 * Em quanto tempo (constante de tempo, s) o estalo anterior some quando o
 * seguinte chega: é a lingueta batendo no pino seguinte e abafando a própria
 * vibração. Na gravação cada estalo termina onde o seguinte começa; somados, a
 * 20/s o rabo de um cairia em cima do golpe do outro e o ritmo embolaria.
 */
const ABAFO = 0.003;

let bufferDoEstalo = null;

/** O recorte de estalo.js, decodificado uma vez só. */
function estaloEm(ctx) {
  if (bufferDoEstalo) return bufferDoEstalo;
  const bytes = atob(ESTALO.pcm);
  const n = bytes.length >> 1;
  const buffer = ctx.createBuffer(1, n, ESTALO.taxa);
  const canal = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const v = bytes.charCodeAt(2 * i) | (bytes.charCodeAt(2 * i + 1) << 8);
    // `<< 16 >> 16` estende o sinal dos 16 bits.
    canal[i] = ((v << 16) >> 16) / 32768;
  }
  bufferDoEstalo = buffer;
  return buffer;
}

/**
 * Quem toca os estalos da roleta, um por divisa que cruza a seta. QUANDO é com
 * giro.js (`estalosDoGiro`); aqui é COMO: o relógio, o volume e o abafo.
 *
 * O instante chega no relógio da tela — o de `performance.now()`, que é o da
 * linha do tempo das animações — e é marcado no do áudio, que toca no
 * milissegundo. A ponte entre os dois é medida, e não suposta: `currentTime`
 * anda aos saltos, subindo de uma vez a cada bloco que a placa de som pede
 * (10,67ms, medido no Chrome do Windows) e parado entre um e outro, então uma
 * leitura sozinha erra por até um bloco. A maior leitura é a mais fresca, e é
 * ela que vale: por isso `acertar()` a cada quadro, e uma ponte só por giro —
 * uma que mudasse a cada estalo sacudiria o ritmo.
 *
 * O contexto nasce com a tela da roleta, e não no primeiro estalo: o relógio de
 * um contexto recém-criado fica parado enquanto a placa acorda, e estalo
 * marcado nesse relógio sai atrasado exatamente essa espera.
 *
 * Os estalos passam pelo barramento como todo o resto: o volume e o mudo do
 * operador valem para a roleta também.
 */
export function criarEstalos() {
  barramento();
  /** O volume do giro inteiro: desligá-lo cala o que já está marcado. */
  let saida = null;
  /** Quanto o relógio do áudio está à frente do da tela, em segundos. */
  let ponte = null;
  /** O último estalo marcado, para o volume pelo ritmo e para o abafo. */
  let anterior = null;

  const medir = (ctx) => {
    // Relógio parado não serve: é contexto acordando ou suspenso, e a ponte
    // medida nele empurraria todos os estalos para depois.
    if (ctx.state !== 'running' || ctx.currentTime <= 0) return;
    const leitura = ctx.currentTime - performance.now() / 1000;
    if (ponte == null || leitura > ponte) ponte = leitura;
  };

  return {
    /** Um giro começa. Chamar no toque: é ele que libera o áudio. */
    preparar() {
      const b = barramento();
      if (!b) return;
      const { ctx } = b;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      saida?.disconnect();
      saida = ctx.createGain();
      saida.connect(b.saida);
      ponte = null;
      anterior = null;
      medir(ctx);
    },

    /** Mede a ponte entre os relógios. Chamar a cada quadro do giro. */
    acertar() {
      if (contexto) medir(contexto);
    },

    /** Um estalo em `instante`, em ms no relógio de `performance.now()`. */
    estalar(instante) {
      const ctx = contextoDeAudio();
      if (!ctx || !saida) return;
      medir(ctx);
      const alvo =
        ponte == null ? ctx.currentTime + (instante - performance.now()) / 1000 : instante / 1000 + ponte;
      // Atrasado — a thread principal travou mais que a antecedência: toca já.
      const quando = Math.max(alvo, ctx.currentTime);

      const ritmo = anterior ? 1000 / (instante - anterior.instante) : 0;
      const vol = VOLUME_DO_ESTALO * Math.min(1, (RITMO_CHEIO / ritmo) ** QUEDA_COM_O_RITMO);

      const fonte = ctx.createBufferSource();
      fonte.buffer = estaloEm(ctx);
      const ganho = ctx.createGain();
      ganho.gain.setValueAtTime(vol, quando);
      fonte.connect(ganho).connect(saida);
      fonte.start(quando);

      if (anterior && quando < anterior.quando + fonte.buffer.duration) {
        anterior.ganho.gain.setTargetAtTime(0, quando, ABAFO);
      }
      anterior = { instante, quando, ganho };
    },

    /** A tela saiu no meio do giro. */
    calar() {
      saida?.disconnect();
      saida = null;
      anterior = null;
    },
  };
}
