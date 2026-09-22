// Stand-in for just_audio's AudioPlayer, with the same call shape the Dart uses:
//
//   _model.soundPlayer1 ??= AudioPlayer();
//   if (_model.soundPlayer1!.playing) { await _model.soundPlayer1!.stop(); }
//   _model.soundPlayer1!.setVolume(0.6);
//   _model.soundPlayer1!.setAsset(path).then((_) => _model.soundPlayer1!.play());
//
// Browsers refuse to start audio before the first user gesture, so plays that
// happen on page load are queued and released by the first interaction.

import { ESTALO } from './estalo.js';

const pending = new Set();
let unlocked = false;

function unlock() {
  unlocked = true;
  for (const player of pending) player.play();
  pending.clear();
  contexto?.resume?.().catch(() => {});
}

for (const type of ['pointerdown', 'keydown', 'touchstart']) {
  window.addEventListener(type, unlock, { once: true, capture: true });
}

export class AudioPlayer {
  constructor() {
    this.el = new Audio();
    this.el.preload = 'auto';
    this._volume = 1;
  }

  get playing() {
    return !this.el.paused && !this.el.ended && this.el.currentTime > 0;
  }

  setVolume(volume) {
    this._volume = volume;
    this.el.volume = Math.max(0, Math.min(1, volume));
    return Promise.resolve();
  }

  setAsset(path) {
    if (this.el.src !== new URL(path, location.href).href) this.el.src = path;
    this.el.currentTime = 0;
    return Promise.resolve();
  }

  play() {
    this.el.volume = Math.max(0, Math.min(1, this._volume));
    const attempt = this.el.play();
    if (attempt && attempt.catch) {
      attempt.catch(() => {
        if (!unlocked) pending.add(this);
      });
    }
    return Promise.resolve();
  }

  async stop() {
    this.el.pause();
    this.el.currentTime = 0;
    pending.delete(this);
  }

  dispose() {
    this.stop();
    this.el.src = '';
  }
}

/* -------------------------------------------------- sons sintetizados ----- */

/**
 * O tique dos últimos segundos não é arquivo: é uma nota curta gerada na hora
 * pela Web Audio API.
 *
 * Por que sintetizar em vez de gravar: não precisa de asset novo, não pesa no
 * bundle, e toca por `file://` — o que o navegador recusa na origem nula é
 * *buscar* arquivo, não gerar som. E o tom pode acompanhar a urgência sem
 * precisar de uma faixa por segundo.
 */
let contexto = null;

function contextoDeAudio() {
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

/**
 * Um estalo curto. `frequencia` em Hz, `duracao` em segundos.
 *
 * O envelope é o que separa "relógio" de "bipe de forno": ataque quase
 * instantâneo (5ms) e queda exponencial. Uma nota de volume constante soa como
 * alarme; esta soa como ponteiro.
 */
export function tique({ frequencia = 1040, duracao = 0.07, volume = 0.16 } = {}) {
  const ctx = contextoDeAudio();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const agora = ctx.currentTime;
  const osc = ctx.createOscillator();
  const ganho = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(frequencia, agora);
  // exponentialRampToValueAtTime não aceita zero, daí o 0.0001 nas pontas.
  ganho.gain.setValueAtTime(0.0001, agora);
  ganho.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), agora + 0.005);
  ganho.gain.exponentialRampToValueAtTime(0.0001, agora + duracao);

  osc.connect(ganho).connect(ctx.destination);
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
 */
export function criarEstalos() {
  contextoDeAudio();
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
      const ctx = contextoDeAudio();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      saida?.disconnect();
      saida = ctx.createGain();
      saida.connect(ctx.destination);
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
      const volume = VOLUME_DO_ESTALO * Math.min(1, (RITMO_CHEIO / ritmo) ** QUEDA_COM_O_RITMO);

      const fonte = ctx.createBufferSource();
      fonte.buffer = estaloEm(ctx);
      const ganho = ctx.createGain();
      ganho.gain.setValueAtTime(volume, quando);
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

/** The one-liner the Dart repeats everywhere, as a single call. */
export function playSound(holder, key, asset, volume = 1.0) {
  let player = holder[key];
  if (!player) {
    player = new AudioPlayer();
    holder[key] = player;
  }
  if (player.playing) player.stop();
  player.setVolume(volume);
  player.setAsset(asset).then(() => player.play());
  return player;
}
