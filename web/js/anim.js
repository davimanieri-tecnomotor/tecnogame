// Port of the flutter_animate effects the project uses (Scale, Fade, Move,
// Rotate) plus flutter_flow_animations' AnimationInfo / animateOnPageLoad /
// animateOnActionTrigger.
//
// Each AnimationInfo turns into one Web Animations API animation. Effects are
// grouped per animated property and laid out on a shared timeline that runs
// from 0 to the longest (delay + duration), which is how flutter_animate
// composes an effect list: a value holds at `begin` through its delay, tweens
// over its duration, then holds at `end`.

/**
 * Quem pede menos movimento no sistema nao deve receber os loops infinitos —
 * o jogo pulsa varios elementos para sempre. As animacoes de um disparo ficam:
 * sao curtas e comunicam estado (o toque afundando um botao, a tela entrando).
 */
const semLoops = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) {
    return false;
  }
};

/** Curves -> cubic-bezier, from Flutter's Curves definitions. */
export const Curves = {
  linear: 'linear',
  ease: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  easeIn: 'cubic-bezier(0.42, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.58, 1)',
  easeInOut: 'cubic-bezier(0.42, 0, 0.58, 1)',
};

/* --------------------------------------------------------------- effects -- */

const effect = (kind, neutral) => ({ curve = Curves.easeInOut, delay = 0, duration = 0, begin, end } = {}) => ({
  kind,
  neutral,
  curve,
  delay,
  duration,
  begin: begin ?? neutral,
  end: end ?? neutral,
});

export const ScaleEffect = effect('scale', [1, 1]);
export const FadeEffect = effect('fade', 1);
export const MoveEffect = effect('move', [0, 0]);
export const RotateEffect = effect('rotate', 0);

/* ---------------------------------------------------------- AnimationInfo -- */

export const AnimationTrigger = {
  onPageLoad: 'onPageLoad',
  onActionTrigger: 'onActionTrigger',
};

export class AnimationInfo {
  constructor({ trigger, effectsBuilder = null, loop = false, reverse = false, applyInitialState = false } = {}) {
    this.trigger = trigger;
    this.effectsBuilder = effectsBuilder;
    this.loop = loop;
    this.reverse = reverse;
    this.applyInitialState = applyInitialState;
    this._targets = [];
    // `animationsMap['x']!.controller.forward(from: 0.0)` in the Dart.
    this.controller = { forward: () => this._forward() };
  }

  _forward() {
    const runs = this._targets
      .map(({ node, effects }) => run(node, effects ?? this.effectsBuilder?.(), this))
      .filter(Boolean);
    return runs.length ? Promise.all(runs) : Promise.resolve();
  }
}

/* ------------------------------------------------------------- timelines -- */

const lerp = (a, b, t) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * t) : a + (b - a) * t);

/** Value of one property's timeline at time `t` (raw, no easing applied - the
 *  easing lives on the emitted keyframe). */
function sampleTrack(segments, neutral, t) {
  if (segments.length === 0) return neutral;
  if (t <= segments[0].t0) return segments[0].from;
  let value = segments[0].from;
  for (const segment of segments) {
    if (t >= segment.t1) {
      value = segment.to;
    } else if (t > segment.t0) {
      return lerp(segment.from, segment.to, (t - segment.t0) / (segment.t1 - segment.t0));
    } else {
      return value;
    }
  }
  return value;
}

/** The easing that governs the output segment starting at `t`. */
function easingAt(segments, t) {
  for (const segment of segments) {
    if (t >= segment.t0 && t < segment.t1) return segment.curve;
  }
  return 'linear';
}

/**
 * Run an effect list on a node. Returns a promise that settles when the
 * animation finishes (never, for looping ones - those resolve immediately so
 * awaiting an `onPageLoad` loop can't deadlock a caller).
 */
export function run(node, effects, info = {}) {
  if (!node || !effects || effects.length === 0) return null;

  const total = effects.reduce((max, e) => Math.max(max, e.delay + e.duration), 0);
  if (total === 0) return null;

  // Loop infinito com "menos movimento" ligado: fixa o estado final e sai.
  if (info.loop && semLoops()) {
    const fade = effects.find((e) => e.kind === 'fade');
    if (fade) node.style.opacity = String(fade.end);
    return Promise.resolve();
  }

  const byKind = new Map();
  for (const e of effects) {
    if (!byKind.has(e.kind)) byKind.set(e.kind, { neutral: e.neutral, segments: [] });
    byKind.get(e.kind).segments.push({ t0: e.delay, t1: e.delay + e.duration, from: e.begin, to: e.end, curve: e.curve });
  }
  for (const track of byKind.values()) track.segments.sort((a, b) => a.t0 - b.t0);

  // Union of every segment boundary, so each emitted keyframe interval sits
  // inside a single input effect and can carry that effect's curve.
  const offsets = new Set([0, total]);
  for (const track of byKind.values()) {
    for (const segment of track.segments) {
      offsets.add(segment.t0);
      offsets.add(segment.t1);
    }
  }
  const times = [...offsets].sort((a, b) => a - b);

  // A transform written by a fractional Stack alignment must survive.
  const base = node.dataset.baseTransform || '';
  const move = byKind.get('move');
  const scale = byKind.get('scale');
  const rotate = byKind.get('rotate');
  const fade = byKind.get('fade');

  const frameAt = (t) => {
    const frame = { offset: total === 0 ? 0 : t / total };
    const parts = base ? [base] : [];
    if (move) {
      const [x, y] = sampleTrack(move.segments, move.neutral, t);
      parts.push(`translate(${x}px, ${y}px)`);
    }
    if (rotate) parts.push(`rotate(${sampleTrack(rotate.segments, rotate.neutral, t)}turn)`);
    if (scale) {
      const [x, y] = sampleTrack(scale.segments, scale.neutral, t);
      parts.push(`scale(${x}, ${y})`);
    }
    if (parts.length) frame.transform = parts.join(' ');
    if (fade) frame.opacity = String(sampleTrack(fade.segments, fade.neutral, t));
    return frame;
  };

  const keyframes = times.map((t, index) => {
    const frame = frameAt(t);
    if (index < times.length - 1) {
      // Prefer the curve of whichever track is tweening across this interval.
      frame.easing =
        [move, scale, rotate, fade]
          .filter(Boolean)
          .map((track) => easingAt(track.segments, t))
          .find((curve) => curve !== 'linear') ?? 'linear';
    }
    return frame;
  });

  // applyInitialState: pin frame 0 inline so nothing flashes at its end value
  // in the frame before the animation starts.
  const first = keyframes[0];
  if (first.transform) node.style.transform = first.transform;
  if (first.opacity != null) node.style.opacity = first.opacity;

  const animation = node.animate(keyframes, {
    duration: total,
    iterations: info.loop ? Infinity : 1,
    direction: info.loop && info.reverse ? 'alternate' : 'normal',
    fill: 'both',
  });

  if (info.loop) return Promise.resolve();
  return animation.finished.then(
    () => {},
    () => {}
  );
}

/* ------------------------------------------------- widget-level wrappers -- */

/** `.animateOnPageLoad(animationsMap['x']!)` */
export function animateOnPageLoad(node, info) {
  if (!node || !info) return node;
  const effects = info.effectsBuilder?.();
  if (!effects || effects.length === 0) return node;
  // Hold the initial state right away, then start on the next frame (the page
  // is still being assembled when the builder runs).
  const total = effects.reduce((max, e) => Math.max(max, e.delay + e.duration), 0);
  if (total > 0) {
    if (effects.some((e) => e.kind === 'fade')) {
      const fade = effects.find((e) => e.kind === 'fade');
      node.style.opacity = String(fade.begin);
    }
    requestAnimationFrame(() => run(node, effects, info));
  }
  return node;
}

/** `.animateOnActionTrigger(animationsMap['x']!, effects: [...])` - registers
 *  the node so `info.controller.forward(from: 0.0)` animates it. */
export function animateOnActionTrigger(node, info, effects = null) {
  if (!node || !info) return node;
  info._targets.push({ node, effects });
  return node;
}

/** setupAnimations(...) - nothing to pre-register in this port. */
export function setupAnimations() {}

/** `await Future.delayed(Duration(milliseconds: n))` */
export const delayed = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
