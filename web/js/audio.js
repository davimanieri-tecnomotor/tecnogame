// Stand-in for just_audio's AudioPlayer, with the same call shape the Dart uses:
//
//   _model.soundPlayer1 ??= AudioPlayer();
//   if (_model.soundPlayer1!.playing) { await _model.soundPlayer1!.stop(); }
//   _model.soundPlayer1!.setVolume(0.6);
//   _model.soundPlayer1!.setAsset(path).then((_) => _model.soundPlayer1!.play());
//
// Browsers refuse to start audio before the first user gesture, so plays that
// happen on page load are queued and released by the first interaction.

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

/** The one-liner the Dart repeats everywhere, as a single call. */
export function playSound(holder, key, asset, volume = 1.0, taxa = 1.0) {
  let player = holder[key];
  if (!player) {
    player = new AudioPlayer();
    holder[key] = player;
  }
  if (player.playing) player.stop();
  player.setVolume(volume);
  player.setAsset(asset).then(() => {
    // DEPOIS do setAsset, não antes: trocar `.src` reseta playbackRate para 1
    // (é o load algorithm do elemento, não bug daqui). `taxa` != 1 estica ou
    // encolhe a gravação sem trocar o arquivo — é o que a roleta usa para uma
    // faixa curta cobrir um giro mais longo (ver giro.js).
    player.el.playbackRate = taxa;
    player.play();
  });
  return player;
}
