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
