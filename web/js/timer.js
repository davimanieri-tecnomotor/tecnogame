// Port of lib/flutter_flow/flutter_flow_timer.dart, lib/flutter_flow/instant_timer.dart
// and the pieces of the stop_watch_timer package the project touches.

import { el, fonte } from './widgets.js';

/* ------------------------------------------------- StopWatchTimer helpers -- */

const pad2 = (n) => String(n).padStart(2, '0');

export const StopWatchMode = { countUp: 'countUp', countDown: 'countDown' };

export const StopWatchTimer = {
  /**
   * StopWatchTimer.getDisplayTime(value, {hours, minute, second, milliSecond}).
   * Builds `HH:MM:SS.mm`, dropping the parts that are switched off. With
   * hours:false the minute field is the *total* number of minutes.
   */
  getDisplayTime(
    value,
    { hours = true, minute = true, second = true, milliSecond = true, hoursRightBreak = ':', minuteRightBreak = ':', secondRightBreak = '.' } = {}
  ) {
    const hoursStr = pad2(Math.floor(value / (3600 * 1000)));
    const totalMinutes = Math.floor(value / (60 * 1000));
    const minuteStr = pad2(hours ? totalMinutes % 60 : totalMinutes);
    const secondStr = pad2(Math.floor(value / 1000) % 60);
    const msStr = pad2(Math.floor((value % 1000) / 10));

    let result = '';
    if (hours) result += `${hoursStr}${hoursRightBreak}`;
    if (minute) result += minuteStr;
    if (second) result += `${minuteRightBreak}${secondStr}`;
    if (milliSecond) result += `${secondRightBreak}${msStr}`;
    return result;
  },
};

/* ------------------------------------------- FlutterFlowTimerController --- */

/**
 * Drives one countdown/count-up value. `rawTime` ticks on every animation
 * frame (the Dart package ticks every millisecond and the widget rebuilds on
 * each tick, so the millisecond digits are visibly running).
 */
export class FlutterFlowTimerController {
  constructor({ mode = StopWatchMode.countDown } = {}) {
    this.mode = mode;
    this.presetMs = 0;
    this.rawTime = 0;
    this._running = false;
    this._startedAt = 0;
    this._startValue = 0;
    this._frame = null;
    this._tickListeners = new Set();
    this._resetListeners = new Set();
  }

  setPresetTime(ms) {
    this.presetMs = ms;
    this.rawTime = ms;
    this._startValue = ms;
    this._emit();
  }

  onStartTimer() {
    if (this._running) return;
    this._running = true;
    this._startedAt = performance.now();
    this._startValue = this.rawTime;
    const tick = () => {
      if (!this._running) return;
      const elapsed = performance.now() - this._startedAt;
      const next =
        this.mode === StopWatchMode.countDown ? this._startValue - elapsed : this._startValue + elapsed;
      this.rawTime = this.mode === StopWatchMode.countDown ? Math.max(0, Math.round(next)) : Math.round(next);
      this._emit();
      if (this.mode === StopWatchMode.countDown && this.rawTime <= 0) {
        this._running = false;
        return;
      }
      this._frame = requestAnimationFrame(tick);
    };
    this._frame = requestAnimationFrame(tick);
  }

  onStopTimer() {
    this._running = false;
    if (this._frame != null) cancelAnimationFrame(this._frame);
    this._frame = null;
  }

  onResetTimer() {
    this.onStopTimer();
    this.rawTime = this.presetMs;
    this._startValue = this.presetMs;
    this._emit();
    for (const fn of this._resetListeners) fn();
  }

  onTick(fn) {
    this._tickListeners.add(fn);
    return () => this._tickListeners.delete(fn);
  }

  /** The controller's own ChangeNotifier: fires on start/stop/reset. */
  addListener(fn) {
    this._resetListeners.add(fn);
    return () => this._resetListeners.delete(fn);
  }

  _emit() {
    for (const fn of this._tickListeners) fn(this.rawTime);
  }

  dispose() {
    this.onStopTimer();
    this._tickListeners.clear();
    this._resetListeners.clear();
  }
}

/* ------------------------------------------------------ FlutterFlowTimer -- */

/**
 * The visible timer. `onChanged(value, displayTime, shouldUpdate)` fires on
 * every tick, with `shouldUpdate` true only once per `updateStateInterval`,
 * matching the Dart widget so the page-level state updates at 1Hz while the
 * text keeps repainting.
 */
export function FlutterFlowTimer({
  initialTime,
  controller,
  getDisplayTime,
  onChanged,
  updateStateInterval = null,
  textAlign = 'start',
  style = {},
  className,
}) {
  controller.setPresetTime(initialTime);

  const node = el('div', {
    class: ['ff-text', className].filter(Boolean).join(' '),
    style: {
      fontFamily: style.fontFamily ? `'${style.fontFamily}', sans-serif` : null,
      fontSize: fonte(style.fontSize),
      fontWeight: style.fontWeight != null ? String(style.fontWeight) : null,
      color: style.color || null,
      letterSpacing: style.letterSpacing != null ? `${style.letterSpacing}px` : null,
      textAlign: textAlign === 'start' ? 'left' : textAlign === 'end' ? 'right' : textAlign,
    },
  });
  if (style.fontFamily) node.dataset.family = style.fontFamily;

  const isCountUp = controller.mode === StopWatchMode.countUp;
  let lastUpdateMs = controller.rawTime;

  const shouldUpdate = (value) => {
    if (updateStateInterval == null || updateStateInterval === 0) return true;
    const cutoff = lastUpdateMs + updateStateInterval * (isCountUp ? 1 : -1);
    const update = isCountUp ? value > cutoff : value < cutoff;
    if (update) lastUpdateMs = value;
    return update;
  };

  const render = (value) => {
    const display = getDisplayTime(value);
    node.textContent = display;
    onChanged?.(value, display, shouldUpdate(value));
  };

  // _initTimer(shouldUpdate: false) on mount.
  node.textContent = getDisplayTime(controller.rawTime);
  onChanged?.(controller.rawTime, node.textContent, false);

  controller.onTick(render);
  controller.addListener(() => {
    lastUpdateMs = controller.rawTime;
    node.textContent = getDisplayTime(controller.rawTime);
    onChanged?.(controller.rawTime, node.textContent, true);
  });

  return node;
}

/* ----------------------------------------------------------- InstantTimer -- */

/** InstantTimer.periodic({duration, callback, startImmediately}) */
export class InstantTimer {
  static periodic({ duration, callback, startImmediately = false }) {
    return new InstantTimer(duration, callback, startImmediately);
  }

  constructor(duration, callback, startImmediately) {
    this._callback = callback;
    this._cancelled = false;
    if (startImmediately) callback(this);
    this._handle = setInterval(() => {
      if (!this._cancelled) callback(this);
    }, duration);
  }

  cancel() {
    this._cancelled = true;
    clearInterval(this._handle);
  }
}
