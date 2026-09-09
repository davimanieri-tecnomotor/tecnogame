// Thin DOM builders that mirror the Flutter widgets used by the project, so the
// page code below reads like the Dart it was ported from.
//
// Layout notes that matter for fidelity:
//  * Column/Row default to MainAxisAlignment.start + CrossAxisAlignment.center.
//  * MainAxisSize.max fills the parent along the main axis.
//  * Stack sizes to its largest non-positioned child (one shared grid cell).
//  * Align(alignment: Alignment(x, y)) puts the child at
//      (x + 1) / 2 * (parentSize - childSize)
//    which in CSS is `left: f%` + `translateX(-f%)` with f = (x + 1) / 2.

export const SW = 1920;
export const SH = 1080;

/* --------------------------------------------------------------- helpers -- */

export function px(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (v === Infinity) return '100%';
  return `${v}px`;
}

/** Flutter's `Color(0xAARRGGBB)` -> css. */
export function color(argb) {
  if (typeof argb === 'string') return argb;
  const a = (argb >>> 24) & 0xff;
  const r = (argb >>> 16) & 0xff;
  const g = (argb >>> 8) & 0xff;
  const b = argb & 0xff;
  if (a === 0xff) return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(4)})`;
}

export const Colors = {
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
};

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  applyProps(node, props);
  append(node, children);
  return node;
}

function applyProps(node, props) {
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'style') {
      Object.assign(node.style, value);
    } else if (key === 'class' || key === 'className') {
      node.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
    } else if (key === 'text') {
      node.textContent = value;
    } else if (key === 'html') {
      node.innerHTML = value;
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key.startsWith('data') || key === 'aria-label' || key === 'role') {
      node.setAttribute(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
    } else {
      node.setAttribute(key, value);
    }
  }
}

export function append(node, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) {
      append(node, child);
    } else if (child instanceof Node) {
      node.appendChild(child);
    } else {
      node.appendChild(document.createTextNode(String(child)));
    }
  }
}

/** Flutter's `[...].divide(SizedBox(...))` - drops nulls first, like `if (...)`
 *  children that evaluate to nothing. */
export function divide(children, gap) {
  return { __divided: children.filter((c) => c != null && c !== false), gap };
}

function childrenOf(children) {
  if (children && children.__divided) return children.__divided;
  return (Array.isArray(children) ? children : [children]).filter((c) => c != null && c !== false);
}

function gapOf(children) {
  return children && children.__divided ? children.gap : null;
}

/**
 * Single-child wrappers (Padding, Align, Opacity, ClipRRect, ...) size to their
 * child in Flutter, so a child that asks for `double.infinity` makes the
 * wrapper fill too. CSS percentages can't resolve against a shrink-wrapped
 * parent, so the request is propagated up explicitly.
 */
function inheritFill(wrapper, child) {
  if (!(wrapper instanceof HTMLElement) || !(child instanceof HTMLElement)) return wrapper;
  if (child.style.width === '100%' || child.dataset.fillWidth) {
    wrapper.style.width = '100%';
    wrapper.dataset.fillWidth = '1';
  }
  if (child.style.height === '100%' || child.dataset.fillHeight) {
    wrapper.style.height = '100%';
    wrapper.dataset.fillHeight = '1';
  }
  return wrapper;
}

const MAIN = {
  start: 'flex-start',
  end: 'flex-end',
  center: 'center',
  spaceBetween: 'space-between',
  spaceAround: 'space-around',
  spaceEvenly: 'space-evenly',
};

const CROSS = {
  start: 'flex-start',
  end: 'flex-end',
  center: 'center',
  stretch: 'stretch',
  baseline: 'baseline',
};


/** A flex child (Expanded/Flexible) soaks up the free space, which makes the
 *  Row/Column fill its bounded main axis even with MainAxisSize.min. */
function hasFlexChild(kids) {
  return kids.some((kid) => kid instanceof HTMLElement && kid.classList.contains('ff-expanded'));
}

/* ----------------------------------------------------------- containers -- */

export function Column({
  mainAxisSize = 'min',
  mainAxisAlignment = 'start',
  crossAxisAlignment = 'center',
  width,
  height,
  style,
  children = [],
  ...rest
} = {}) {
  const gap = gapOf(children);
  const kids = childrenOf(children);
  const fillsMain = (mainAxisSize === 'max' || hasFlexChild(kids)) && height == null;
  const node = el(
    'div',
    {
      class: ['ff-col', fillsMain ? 'ff-main-max' : null],
      style: {
        justifyContent: MAIN[mainAxisAlignment],
        alignItems: CROSS[crossAxisAlignment],
        rowGap: gap != null ? px(gap) : null,
        width: px(width),
        height: px(height),
        ...style,
      },
      ...rest,
    },
    kids
  );
  if (fillsMain || height === Infinity) node.dataset.fillHeight = '1';
  // A Column's cross size is the widest child, so a child that wants to fill
  // the width makes the Column want to as well.
  if (width == null && kids.some((k) => k instanceof HTMLElement && k.dataset.fillWidth)) {
    node.style.width = '100%';
    node.dataset.fillWidth = '1';
  }
  if (width === Infinity) node.dataset.fillWidth = '1';
  return node;
}

export function Row({
  mainAxisSize = 'min',
  mainAxisAlignment = 'start',
  crossAxisAlignment = 'center',
  width,
  height,
  style,
  children = [],
  ...rest
} = {}) {
  const gap = gapOf(children);
  const kids = childrenOf(children);
  // Align encolhe até o filho quando está no eixo PRINCIPAL de um Row: no
  // Flutter ele recebe restrição solta ali. A classe .ff-align vale width:100%
  // porque o caso comum é Align dentro de Column (eixo cruzado), então aqui a
  // regra é desfeita — sem isto a fileira de scanners saía espalhada, com dois
  // cards cortados e um metade fora da tela.
  for (const kid of kids) {
    if (kid instanceof HTMLElement && kid.classList.contains('ff-align')) {
      kid.style.width = 'auto';
      delete kid.dataset.fillWidth;
    }
  }

  const fillsMain = (mainAxisSize === 'max' || hasFlexChild(kids)) && width == null;
  const node = el(
    'div',
    {
      class: ['ff-row', fillsMain ? 'ff-main-max' : null],
      style: {
        justifyContent: MAIN[mainAxisAlignment],
        alignItems: CROSS[crossAxisAlignment],
        columnGap: gap != null ? px(gap) : null,
        width: px(width),
        height: px(height),
        ...style,
      },
      ...rest,
    },
    kids
  );
  if (fillsMain || width === Infinity) node.dataset.fillWidth = '1';
  // Mirror image of the Column rule, on the Row's cross axis.
  if (height == null && kids.some((k) => k instanceof HTMLElement && k.dataset.fillHeight)) {
    node.style.height = '100%';
    node.dataset.fillHeight = '1';
  }
  if (height === Infinity) node.dataset.fillHeight = '1';
  return node;
}

/**
 * Stack. `alignment` applies to children that don't carry their own Align;
 * Flutter's default is AlignmentDirectional.topStart, not center.
 */
export function Stack({ alignment = [-1, -1], width, height, style, children = [] } = {}) {
  const kids = childrenOf(children);
  for (const kid of kids) {
    if (kid instanceof HTMLElement && !kid.dataset.aligned) placeInStack(kid, alignment);
  }
  const node = el('div', { class: 'ff-stack', style: { width: px(width), height: px(height), ...style } }, kids);
  // The Stack is as big as its biggest child, so a child that wants to fill
  // makes the Stack want to fill.
  for (const kid of kids) inheritFill(node, kid);
  return node;
}

const CARDINAL = { '-1': 'start', 0: 'center', 1: 'end' };

/** Position a stack child: place-self for cardinal alignments (keeps the child
 *  in the grid, so it still contributes to the Stack's size), absolute
 *  percentages for fractional ones. */
function placeInStack(node, [x, y]) {
  node.dataset.aligned = '1';
  const cx = CARDINAL[String(x)];
  const cy = CARDINAL[String(y)];
  if (cx && cy) {
    node.style.justifySelf = cx;
    node.style.alignSelf = cy;
    return;
  }
  const fx = (x + 1) / 2;
  const fy = (y + 1) / 2;
  node.classList.add('ff-abs');
  node.style.left = `${fx * 100}%`;
  node.style.top = `${fy * 100}%`;
  node.style.transform = `translate(${-fx * 100}%, ${-fy * 100}%)`;
  node.dataset.baseTransform = node.style.transform;
}

export function Align({ alignment = [0, 0], width, height, style, child } = {}) {
  const [x, y] = alignment;
  const node = el(
    'div',
    {
      class: 'ff-align',
      style: {
        justifyContent: x < 0 ? 'flex-start' : x > 0 ? 'flex-end' : 'center',
        alignItems: y < 0 ? 'flex-start' : y > 0 ? 'flex-end' : 'center',
        width: px(width),
        height: px(height),
        ...style,
      },
    },
    child
  );
  node.dataset.alignX = x;
  node.dataset.alignY = y;
  // .ff-align is width:100% by class, which inheritFill can't see inline.
  node.dataset.fillWidth = '1';
  return inheritFill(node, child);
}

/** An Align that is a direct Stack child: hand the alignment to the Stack. */
export function StackAlign({ alignment = [0, 0], child, style } = {}) {
  const node = el('div', { style: { display: 'flex', ...style } }, child);
  inheritFill(node, child);
  placeInStack(node, alignment);
  return node;
}

export function Padding({ padding = [0, 0, 0, 0], style, child } = {}) {
  const [l, t, r, b] = padding;
  const node = el(
    'div',
    {
      style: {
        padding: `${t}px ${r}px ${b}px ${l}px`,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        maxWidth: '100%',
        ...style,
      },
    },
    child
  );
  return inheritFill(node, child);
}

/**
 * Container. Supports the decoration features the project actually uses:
 * color, gradient, borderRadius, border, boxShadow, image and alignment.
 */
export function Container({
  width,
  height,
  color: bg,
  gradient,
  borderRadius,
  border,
  boxShadow,
  image,
  alignment,
  padding,
  constraints,
  style,
  child,
  children,
  ...rest
} = {}) {
  const css = {
    width: px(width),
    height: px(height),
    flex: 'none',
    minWidth: 0,
    minHeight: 0,
    // A Flutter child can never exceed its parent's constraints - a
    // `Container(width: 1920)` inside a 1102px-wide parent lays out at 1102.
    // O mesmo vale na vertical: a roleta declara 946px de altura dentro de uma
    // caixa de 839.8, e o Flutter a comprime; sem isto ela era recortada em
    // cima e embaixo em vez de encolher.
    maxWidth: '100%',
    maxHeight: '100%',
  };
  if (bg) css.background = bg;
  if (gradient) css.backgroundImage = gradient;
  if (image) {
    css.backgroundImage = [image.css, gradient].filter(Boolean).join(', ');
    css.backgroundSize = image.size;
    css.backgroundPosition = image.position || 'center';
    css.backgroundRepeat = image.repeat || 'no-repeat';
  }
  if (borderRadius != null) css.borderRadius = typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius;
  if (border) css.border = border;
  if (boxShadow) css.boxShadow = boxShadow;
  if (padding) {
    const [l, t, r, b] = padding;
    css.padding = `${t}px ${r}px ${b}px ${l}px`;
  }
  if (constraints) Object.assign(css, constraints);
  let tight = false;
  if (alignment) {
    css.display = 'flex';
    css.justifyContent = alignment[0] < 0 ? 'flex-start' : alignment[0] > 0 ? 'flex-end' : 'center';
    css.alignItems = alignment[1] < 0 ? 'flex-start' : alignment[1] > 0 ? 'flex-end' : 'center';
  } else {
    css.display = 'flex';
    css.flexDirection = 'column';
    css.alignItems = 'stretch';
    css.justifyContent = 'flex-start';
    // An explicitly sized Container hands its child tight constraints, so the
    // child fills the box rather than shrink-wrapping (see .ff-tight).
    tight = height != null;
  }
  const node = el(
    'div',
    { class: tight ? 'ff-tight' : null, style: { ...css, ...style }, ...rest },
    child ?? children ?? []
  );
  if (width === Infinity) node.dataset.fillWidth = '1';
  if (height === Infinity) node.dataset.fillHeight = '1';
  return node;
}

/** BoxDecoration.image -> a css background layer. */
export function decorationImage(path, fit = 'cover', alignment) {
  const size = fit === 'cover' ? 'cover' : fit === 'contain' ? 'contain' : fit === 'none' ? 'auto' : 'cover';
  let position = 'center';
  if (alignment) {
    position = `${((alignment[0] + 1) / 2) * 100}% ${((alignment[1] + 1) / 2) * 100}%`;
  }
  return { css: `url("${path}")`, size, position };
}

/** LinearGradient(colors, stops, begin, end) -> css linear-gradient.
 *  Flutter's begin/end are Alignment vectors; the css angle is derived from
 *  the vector so diagonal gradients keep their direction. */
export function linearGradient({ colors, stops, begin = [0, -1], end = [0, 1] }) {
  const dx = end[0] - begin[0];
  const dy = end[1] - begin[1];
  const angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const parts = colors.map((c, i) => (stops ? `${c} ${stops[i] * 100}%` : c));
  return `linear-gradient(${angle.toFixed(2)}deg, ${parts.join(', ')})`;
}

export function boxShadow({ blurRadius = 0, color: c = '#000', offset = [0, 0], spreadRadius = 0 }) {
  return `${offset[0]}px ${offset[1]}px ${blurRadius}px ${spreadRadius}px ${c}`;
}

export function Opacity({ opacity = 1, child, style } = {}) {
  const node = el(
    'div',
    { style: { opacity: String(opacity), display: 'flex', flexDirection: 'column', ...style } },
    child
  );
  return inheritFill(node, child);
}

export function ClipRRect({ borderRadius = 0, child, style } = {}) {
  const node = el(
    'div',
    {
      style: {
        borderRadius: `${borderRadius}px`,
        overflow: 'hidden',
        display: 'flex',
        flex: 'none',
        ...style,
      },
    },
    child
  );
  return inheritFill(node, child);
}

export function SizedBox({ width, height } = {}) {
  return el('div', { style: { width: px(width), height: px(height), flex: 'none' } });
}

/**
 * Expanded / Flexible.
 *
 * Flutter hands a flex child a loose cross-axis constraint (for the default
 * centre alignment), so a child asking for `double.infinity` fills the cross
 * axis while a short child stays centred. `align-self: stretch` plus
 * `justify-content: center` reproduces both halves of that.
 */
const flexChild = (flex, child, style) =>
  el(
    'div',
    {
      class: 'ff-expanded',
      style: {
        flex: `${flex} 1 0`,
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        alignSelf: 'stretch',
        justifyContent: 'center',
        ...style,
      },
    },
    child
  );

export function Expanded({ flex = 1, child, style } = {}) {
  return flexChild(flex, child, style);
}

export function Flexible({ flex = 1, child, style } = {}) {
  return flexChild(flex, child, style);
}

export function SingleChildScrollView({ child, controller, style, ...rest } = {}) {
  // The scroll axis is unbounded inside a scroll view, so a MainAxisSize.max
  // Column shrink-wraps there - drop the fill-the-parent class from the child.
  if (child instanceof HTMLElement) child.classList.remove('ff-main-max');
  const node = el('div', { class: 'ff-scroll', style: { width: '100%', ...style }, ...rest }, child);
  if (controller) controller.attach(node);
  return node;
}

/**
 * Transform(transform: Matrix4.skew(ax, ay)). Flutter's Matrix4.skew takes
 * radians and writes tan(ax) into the x-shear slot, tan(ay) into the y-shear.
 * The transform is recorded as `baseTransform` so animations compose with it
 * instead of replacing it.
 */
export function TransformSkew({ ax = 0, ay = 0, child, style } = {}) {
  const transform = `matrix(1, ${Math.tan(ay)}, ${Math.tan(ax)}, 1, 0, 0)`;
  const node = el('div', { style: { transform, display: 'flex', flex: 'none', ...style } }, child);
  node.dataset.baseTransform = transform;
  return node;
}

export function TransformRotate({ angle = 0, child, style } = {}) {
  const transform = `rotate(${angle}rad)`;
  const node = el('div', { style: { transform, display: 'flex', flex: 'none', ...style } }, child);
  node.dataset.baseTransform = transform;
  return node;
}

/* ---------------------------------------------------------------- leaves -- */

/**
 * Text. `style` mirrors the fields the Dart actually sets.
 * Passing `fontFamily` swaps the family and keeps everything else, like
 * FlutterFlow's `TextStyle.override(fontFamily: ...)`.
 */
export function Txt(text, style = {}) {
  const {
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle,
    color: c,
    letterSpacing,
    textAlign,
    lineHeight,
    decoration,
    width,
    style: extra,
  } = style;
  const node = el('div', {
    class: 'ff-text',
    style: {
      fontFamily: fontFamily ? `'${fontFamily}', sans-serif` : null,
      fontSize: fontSize != null ? `${fontSize}px` : null,
      fontWeight: fontWeight != null ? String(fontWeight) : null,
      fontStyle: fontStyle || null,
      color: c || null,
      letterSpacing: letterSpacing != null ? `${letterSpacing}px` : null,
      textAlign: textAlign || null,
      lineHeight: lineHeight != null ? String(lineHeight) : null,
      textDecoration: decoration || null,
      width: px(width),
      ...extra,
    },
    text: text == null ? '' : String(text),
  });
  if (fontFamily) node.dataset.family = fontFamily;
  return node;
}

/** Image.asset(path, width, height, fit, alignment). */
export function Img(src, { width, height, fit = 'cover', alignment, style } = {}) {
  const node = el('img', {
    class: 'ff-img',
    src,
    alt: '',
    draggable: 'false',
    style: {
      width: px(width),
      height: px(height),
      objectFit: fit,
      objectPosition: alignment
        ? `${((alignment[0] + 1) / 2) * 100}% ${((alignment[1] + 1) / 2) * 100}%`
        : 'center',
      ...style,
    },
  });
  return node;
}

/** InkWell with all the splash/focus/hover/highlight colours set to
 *  transparent, which is how every tap target in this project is written. */
export function InkWell({ onTap, child, style, disabled = false, label } = {}) {
  const interactive = Boolean(onTap) && !disabled;
  const node = inheritFill(
    el(
      'div',
      {
        class: 'ff-inkwell',
        role: 'button',
        // Um <div role="button"> nao entra na ordem de tabulacao por conta
        // propria, e sem isto o teclado nao alcanca nada no jogo.
        tabindex: interactive ? '0' : null,
        'aria-label': label ?? null,
        'aria-disabled': disabled ? 'true' : null,
        style: { display: 'flex', flexDirection: 'column', ...style },
      },
      child
    ),
    child
  );
  if (interactive) {
    node.addEventListener('click', (event) => {
      event.stopPropagation();
      onTap(event);
    });
    // Enter e Espaco, o contrato de um botao. Espaco tem de ter o rolar da
    // pagina cancelado no keydown, mas dispara no keyup, como um <button>.
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        onTap(event);
      } else if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
      }
    });
    node.addEventListener('keyup', (event) => {
      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        event.stopPropagation();
        onTap(event);
      }
    });
  }
  return node;
}

/** GestureDetector(onTap: unfocus) wrappers in the Dart just drop keyboard
 *  focus; the web equivalent is blurring the active element. */
export function unfocus() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

/* ----------------------------------------------------------------- icons -- */
// Material icons drawn inline so the app has no icon-font dependency.
const ICON_PATHS = {
  close:
    'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  keyboard_arrow_down_rounded:
    'M8.12 9.29L12 13.17l3.88-3.88a.996.996 0 111.41 1.41l-4.59 4.59a.996.996 0 01-1.41 0L6.7 10.7a.996.996 0 010-1.41c.39-.38 1.03-.39 1.42 0z',
  warning_amber_rounded:
    'M12 5.99L19.53 19H4.47L12 5.99M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z',
  // DropdownButton's default icon.
  arrow_drop_down: 'M7 10l5 5 5-5z',
};

export function Icon(name, { color: c = 'currentColor', size = 24 } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', c);
  svg.setAttribute('class', 'ff-icon');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICON_PATHS[name] || '');
  svg.appendChild(path);
  return svg;
}

/* ----------------------------------------------------------------- video -- */

export function VideoPlayer({
  path,
  width,
  height,
  autoPlay = true,
  looping = false,
  showControls = false,
  muted = false,
  style,
  onEnded,
} = {}) {
  const node = el('video', {
    class: 'ff-video',
    src: path,
    playsinline: '',
    preload: 'auto',
    style: { width: px(width ?? Infinity), height: px(height ?? Infinity), objectFit: 'contain', ...style },
  });
  if (looping) node.loop = true;
  if (showControls) node.controls = true;
  node.muted = muted;
  if (onEnded) node.addEventListener('ended', onEnded);
  if (autoPlay) {
    const start = () => {
      node.play().catch(() => {
        // Autoplay with sound is blocked until the first gesture; fall back to
        // a muted start so the video still runs, then unmute on interaction.
        node.muted = true;
        node.play().catch(() => {});
      });
    };
    if (node.readyState >= 2) start();
    else node.addEventListener('loadeddata', start, { once: true });
  }
  return node;
}

/**
 * FutureBuilder / StreamBuilder: renders `loading` until the promise settles,
 * then swaps in `builder(data)`. Every call site in this project shows an
 * invisible 50x50 CircularProgressIndicator while it waits, because the Dart
 * passes `Color(0x004B39EF)` - fully transparent.
 */
export function FutureBuilder({ future, builder, loading = null, fill = false }) {
  const host = el('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      flex: 'none',
      // `fill` is for the call sites whose builder returns a whole page.
      width: fill ? '100%' : null,
      height: fill ? '100%' : null,
    },
  });
  append(host, loading ?? CircularProgressIndicator());
  Promise.resolve(future).then(
    (data) => {
      host.textContent = '';
      append(host, builder(data));
    },
    (error) => {
      console.warn('FutureBuilder failed', error);
      host.textContent = '';
    }
  );
  return host;
}

/** Center(child: SizedBox(50x50, child: CircularProgressIndicator(...))) */
export function CircularProgressIndicator({ color: c = 'transparent', size = 50 } = {}) {
  return el('div', {
    style: {
      width: `${size}px`,
      height: `${size}px`,
      flex: 'none',
      alignSelf: 'center',
      margin: 'auto',
      border: `4px solid ${c}`,
      borderTopColor: 'transparent',
      borderRadius: '50%',
      animation: 'ff-spin 1.2s linear infinite',
    },
  });
}

/* --------------------------------------------------------- misc helpers --- */

/** `valueOrDefault<String>(value, fallback)` */
export function valueOrDefault(value, fallback) {
  return value == null || value === '' ? fallback : value;
}

/** `String.maybeHandleOverflow({maxChars, replacement})` */
export function maybeHandleOverflow(value, { maxChars, replacement = '' }) {
  const text = value ?? '';
  if (maxChars == null || text.length <= maxChars) return text;
  return text.substring(0, maxChars) + replacement;
}

export const degrees = (d) => (d * Math.PI) / 180;
