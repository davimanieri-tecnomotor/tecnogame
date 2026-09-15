// Ports of the FlutterFlow form widgets the project uses:
// TextFormField + InputDecoration, FlutterFlowDropDown (dropdown_button2),
// FlutterFlowLanguageSelector, FFButtonWidget and MaskTextInputFormatter.

import { el, px, fonte, Icon, Txt, Colors } from './widgets.js';
import { LANGUAGE_NAMES } from './i18n.js';

/* --------------------------------------------------- MaskTextInputFormatter */

/**
 * mask_text_input_formatter with the single mask this app uses,
 * '(##) #####-####': '#' takes one digit, everything else is a literal that is
 * inserted automatically.
 */
export class MaskTextInputFormatter {
  constructor({ mask }) {
    this.mask = mask;
  }

  format(raw) {
    const digits = (raw ?? '').replace(/\D/g, '');
    let out = '';
    let index = 0;
    for (const ch of this.mask) {
      if (index >= digits.length) break;
      if (ch === '#') {
        out += digits[index++];
      } else {
        out += ch;
      }
    }
    return out;
  }
}

/* -------------------------------------------------------- TextFormField --- */

const styleToCss = (style = {}) => ({
  fontFamily: style.fontFamily ? `'${style.fontFamily}', sans-serif` : null,
  fontSize: fonte(style.fontSize),
  fontWeight: style.fontWeight != null ? String(style.fontWeight) : null,
  fontStyle: style.fontStyle || null,
  color: style.color || null,
  letterSpacing: style.letterSpacing != null ? `${style.letterSpacing}px` : null,
});

/**
 * TextFormField wrapped in its InputDecoration.
 *
 * Flutter's non-dense outline InputDecoration uses
 * `EdgeInsets.symmetric(horizontal: 12, vertical: 20)` for content padding,
 * which is what sets the field's height here.
 *
 * @returns {HTMLElement} the decorated field, with `.controller` attached
 */
export function TextFormField({
  controller,
  hintText,
  hintStyle,
  errorStyle,
  style,
  fillColor,
  borderRadius = 8,
  borderColor = 'rgba(0,0,0,0)',
  errorColor,
  borderWidth = 1,
  maxLength,
  keyboardType,
  inputFormatter,
  cursorColor,
  validator,
  width,
  onSubmitted,
} = {}) {
  const input = el('input', {
    class: 'ff-input',
    type: keyboardType === 'number' ? 'tel' : 'text',
    inputmode: keyboardType === 'number' ? 'numeric' : null,
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    style: { ...styleToCss(style), caretColor: cursorColor || null },
  });
  if (maxLength != null) input.maxLength = maxLength;

  // hintText/hintStyle -> a ::placeholder that can be styled per field.
  input.placeholder = hintText ?? '';
  const hintCss = styleToCss(hintStyle ?? {});
  const uid = `ff-f${Math.random().toString(36).slice(2, 8)}`;
  input.classList.add(uid);
  const sheet = el('style', {
    text: `.${uid}::placeholder{${Object.entries(hintCss)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`)
      .join(';')};opacity:1}`,
  });

  const field = el('div', {
    class: 'ff-field',
    style: {
      background: fillColor || null,
      borderRadius: `${borderRadius}px`,
      borderColor,
      borderWidth: `${borderWidth}px`,
      // A altura acompanha o piso de legibilidade da fonte, senao o texto
      // crescido numa janela pequena encostaria na borda do campo.
      minHeight: `calc(${fonte(style?.fontSize ?? 14)} * 1.2109 + ${40 + borderWidth * 2}px)`,
    },
  }, input);

  const error = el('div', { class: 'ff-text ff-field-error', style: styleToCss(errorStyle ?? {}) });
  error.hidden = true;

  const wrapper = el(
    'div',
    { style: { width: px(width ?? Infinity), maxWidth: '100%', display: 'flex', flexDirection: 'column' } },
    [sheet, field, error]
  );

  if (inputFormatter) {
    input.addEventListener('input', () => {
      const caretAtEnd = input.selectionStart === input.value.length;
      const formatted = inputFormatter.format(input.value);
      if (formatted !== input.value) {
        input.value = formatted;
        if (caretAtEnd) input.setSelectionRange(formatted.length, formatted.length);
      }
      controller.text = input.value;
    });
  } else {
    input.addEventListener('input', () => {
      controller.text = input.value;
    });
  }

  if (onSubmitted) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onSubmitted(input.value);
      }
    });
  }

  controller.attach(input);

  const setBorder = (c) => {
    field.style.borderColor = c;
  };

  wrapper.validate = () => {
    const message = validator ? validator(input.value) : null;
    if (message) {
      error.textContent = message;
      error.hidden = false;
      setBorder(errorColor ?? borderColor);
      return false;
    }
    error.hidden = true;
    error.textContent = '';
    setBorder(borderColor);
    return true;
  };

  wrapper.input = input;
  return wrapper;
}

/** TextEditingController */
export class TextEditingController {
  constructor(text = '') {
    this._text = text;
    this._node = null;
  }

  attach(node) {
    this._node = node;
    node.value = this._text;
  }

  get text() {
    return this._node ? this._node.value : this._text;
  }

  set text(value) {
    this._text = value;
    if (this._node) this._node.value = value;
  }
}

/** GlobalKey<FormState> + Form: validate() runs every field's validator. */
export class FormState {
  constructor() {
    this.fields = [];
  }

  register(field) {
    this.fields.push(field);
  }

  validate() {
    // Validate all of them so every message shows at once, like Flutter does.
    return this.fields.map((f) => f.validate()).every(Boolean);
  }
}

/* ------------------------------------------------- FlutterFlowDropDown ---- */

/**
 * A camada dos menus: fica DENTRO do palco (para herdar a escala e as unidades
 * dele) e ANTES de `#overlays`, para um menu ficar acima das telas e abaixo dos
 * dialogos. Criada na primeira vez que alguem abre um menu.
 */
let sequenciaDeMenus = 0;

function camadaDeMenus() {
  let camada = document.getElementById('popups');
  if (camada) return camada;
  const palco = document.getElementById('stage');
  camada = el('div', { id: 'popups' });
  palco.insertBefore(camada, document.getElementById('overlays'));
  return camada;
}

/**
 * A caixa de `node` em coordenadas DO PALCO. O palco e escalado por transform,
 * entao `getBoundingClientRect` devolve px de tela; a escala sai da razao entre
 * a largura desenhada e a de layout, sem depender de ler a variavel CSS.
 */
function paraOPalco(node) {
  const palco = document.getElementById('stage');
  if (!palco) return null;
  const p = palco.getBoundingClientRect();
  const escala = p.width / palco.offsetWidth || 1;
  const r = node.getBoundingClientRect();
  return {
    x: (r.left - p.left) / escala,
    y: (r.top - p.top) / escala,
    largura: r.width / escala,
    altura: r.height / escala,
    alturaDoPalco: palco.offsetHeight,
  };
}

/** FormFieldController<T> */
export class FormFieldController {
  constructor(value = null) {
    this.value = value;
  }
}

/**
 * FlutterFlowDropDown. Renders the dropdown_button2 shape the Dart configures:
 * a rounded, filled button with the value or hint on the left and the icon on
 * the right, and a menu the same width as the button (radius 4, fillColor).
 */
export function FlutterFlowDropDown({
  controller,
  options,
  optionLabels = null,
  onChanged,
  width,
  height,
  textStyle,
  hintText,
  icon,
  fillColor,
  borderColor = Colors.transparent,
  borderWidth = 0,
  borderRadius = 8,
  margin = [0, 0, 0, 0],
  maxHeight = null,
  /** dropdownStyleData's colour; the FF dropdown reuses fillColor, the
   *  language selector passes its own `dropdownColor`. */
  menuColor = null,
} = {}) {
  const labelFor = (option, index) =>
    optionLabels && optionLabels.length > index ? optionLabels[index] : String(option);

  const label = el('div', {
    class: 'ff-text',
    style: {
      ...styleToCss(textStyle),
      flex: '1 1 0',
      minWidth: 0,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      textAlign: 'left',
    },
    text: controller.value != null ? labelFor(controller.value, options.indexOf(controller.value)) : hintText ?? '',
  });
  if (textStyle?.fontFamily) label.dataset.family = textStyle.fontFamily;

  const [ml, , mr] = margin;

  // O menu vive fora do botao (ver abre/fecha), entao a ligacao entre os dois e
  // declarada: `aria-controls` aponta para ele. Isso serve ao leitor de tela e
  // da a quem testa um jeito estavel de achar o menu de um dropdown especifico,
  // em vez de andar pela arvore.
  const menuId = `ff-menu-${(sequenciaDeMenus += 1)}`;
  const menu = el('div', {
    id: menuId,
    class: 'ff-dropdown-menu',
    role: 'listbox',
    style: {
      background: menuColor || fillColor || null,
      borderRadius: '4px',
    },
  });

  options.forEach((option, index) => {
    const item = el('div', {
      class: 'ff-dropdown-item ff-text',
      role: 'option',
      style: { ...styleToCss(textStyle), padding: `${(height ?? 48) / 4}px ${mr}px ${(height ?? 48) / 4}px ${ml}px` },
      text: labelFor(option, index),
    });
    if (textStyle?.fontFamily) item.dataset.family = textStyle.fontFamily;
    item.addEventListener('click', (event) => {
      event.stopPropagation();
      controller.value = option;
      label.textContent = labelFor(option, index);
      close();
      // O índice vai junto porque quem chama às vezes precisa saber QUAL opção
      // foi escolhida, e não só o rótulo já traduzido (ver cadastro.js).
      onChanged?.(option, index);
    });
    menu.appendChild(item);
  });

  const button = el(
    'div',
    {
      class: 'ff-dropdown',
      style: {
        height: '100%',
        padding: `0 ${mr}px 0 ${ml}px`,
        gap: '4px',
      },
    },
    [label, icon]
  );

  const root = el(
    'div',
    {
      style: {
        position: 'relative',
        width: px(width ?? Infinity),
        height: px(height),
        flex: 'none',
        background: fillColor || null,
        borderRadius: `${borderRadius}px`,
        border: `${borderWidth}px solid ${borderColor}`,
      },
    },
    [button]
  );

  /* ------------------------------------------------------------ abre/fecha -- */
  /*
   * O menu e desenhado numa CAMADA propria do palco, e nao como filho absoluto
   * do botao. Dois defeitos vinham dali:
   *
   *   1. o `z-index: 40` do menu ficava preso no contexto de empilhamento do
   *      pedaco de tela onde o dropdown vive, entao o botao CONFIRMAR e a linha
   *      de termos, que vem depois na arvore, eram pintados POR CIMA do menu
   *      aberto;
   *   2. o menu abria sempre para baixo. No cadastro ele comeca em y=802 e tem
   *      420px, ou seja, vazava 142px abaixo do palco — e o palco recorta, o que
   *      deixava as ultimas opcoes inalcancaveis.
   *
   * Na camada, o menu escapa de qualquer contexto de empilhamento e da para
   * posicionar em coordenadas do palco: abre para baixo se cabe, para cima se
   * nao cabe, e no pior caso encolhe e rola por dentro.
   */
  let aberto = false;

  const fechar = () => {
    if (!aberto) return;
    aberto = false;
    menu.remove();
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', aoClicarFora, true);
    document.removeEventListener('keydown', aoTeclar, true);
    window.removeEventListener('resize', fechar);
  };

  const aoClicarFora = (event) => {
    if (!root.contains(event.target) && !menu.contains(event.target)) fechar();
  };

  const aoTeclar = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      fechar();
    }
  };

  const abrir = () => {
    if (aberto) return;
    aberto = true;
    camadaDeMenus().appendChild(menu);
    button.setAttribute('aria-expanded', 'true');
    posicionar();
    document.addEventListener('click', aoClicarFora, true);
    document.addEventListener('keydown', aoTeclar, true);
    window.addEventListener('resize', fechar);
  };

  /** Poe o menu embaixo do botao, ou em cima se nao couber. */
  function posicionar() {
    const alvo = paraOPalco(button);
    if (!alvo) return;
    const { x, y, largura, altura, alturaDoPalco } = alvo;

    const FOLGA = 4;
    const BORDA = 8;
    const abaixo = alturaDoPalco - (y + altura) - FOLGA - BORDA;
    const acima = y - FOLGA - BORDA;
    const tetoPedido = maxHeight != null ? maxHeight : 420;

    menu.style.left = `${x}px`;
    menu.style.width = `${largura}px`;
    menu.style.maxHeight = `${Math.max(80, Math.min(tetoPedido, Math.max(abaixo, acima)))}px`;

    // Mede com o teto ja aplicado, para decidir com a altura real.
    const alto = menu.offsetHeight;
    if (alto <= abaixo || abaixo >= acima) {
      menu.style.top = `${Math.min(y + altura + FOLGA, alturaDoPalco - BORDA - alto)}px`;
    } else {
      menu.style.top = `${Math.max(BORDA, y - FOLGA - alto)}px`;
    }
  }

  button.setAttribute('role', 'button');
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-controls', menuId);
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (aberto) fechar();
    else abrir();
  });

  const close = fechar;
  return root;
}

/* --------------------------------------------- FlutterFlowLanguageSelector */

/** The Dart passes hideFlags: true, so only the language names show. */
export function FlutterFlowLanguageSelector({
  width,
  height,
  backgroundColor,
  borderColor = Colors.transparent,
  dropdownColor,
  dropdownIconColor,
  borderRadius = 8,
  textStyle,
  currentLanguage,
  languages,
  onChanged,
} = {}) {
  const available = LANGUAGE_NAMES.filter((entry) => languages.includes(entry.isoCode));
  const controller = new FormFieldController(currentLanguage);

  return FlutterFlowDropDown({
    controller,
    options: available.map((entry) => entry.isoCode),
    optionLabels: available.map((entry) => entry.name),
    onChanged,
    width,
    height,
    textStyle,
    hintText: available.find((entry) => entry.isoCode === currentLanguage)?.name ?? '',
    // DropdownButton's default icon at its default 24px, tinted by
    // dropdownIconColor, and the picker's own 15px horizontal padding.
    icon: Icon('arrow_drop_down', { color: dropdownIconColor, size: 24 }),
    fillColor: backgroundColor,
    borderColor,
    borderWidth: 1,
    borderRadius,
    margin: [15, 0, 15, 0],
    menuColor: dropdownColor,
  });
}

/* ------------------------------------------------------- FFButtonWidget --- */

/** FFButtonWidget + FFButtonOptions. */
export function FFButtonWidget({ text, onPressed, options = {} } = {}) {
  const {
    width,
    height,
    padding = [0, 0, 0, 0],
    color,
    textStyle,
    elevation = 0,
    borderSide = null,
    borderRadius = 8,
  } = options;
  const [l, t, r, b] = padding;

  const label = Txt(text, textStyle ?? {});
  label.style.whiteSpace = 'nowrap';

  const node = el(
    'button',
    {
      class: 'ff-btn',
      type: 'button',
      style: {
        width: px(width),
        height: px(height),
        flex: 'none',
        background: color || null,
        borderRadius: `${borderRadius}px`,
        border: borderSide ? `${borderSide.width ?? 1}px solid ${borderSide.color}` : 'none',
        padding: `${t}px ${r}px ${b}px ${l}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: elevation ? `0 ${elevation}px ${elevation * 2}px rgba(0,0,0,0.24)` : null,
      },
    },
    label
  );

  if (onPressed) {
    node.addEventListener('click', (event) => {
      event.stopPropagation();
      onPressed(event);
    });
  }
  return node;
}

/**
 * Curves.ease = cubic-bezier(0.25, 0.1, 0.25, 1), avaliada por bisseccao em x.
 * Antes aqui havia uma curva inventada que so acertava os extremos.
 */
function curveEase(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const bez = (a, b, u) => {
    const v = 1 - u;
    return 3 * v * v * u * a + 3 * v * u * u * b + u * u * u;
  };
  let lo = 0;
  let hi = 1;
  let u = t;
  for (let i = 0; i < 20; i++) {
    u = (lo + hi) / 2;
    if (bez(0.25, 0.25, u) < t) lo = u;
    else hi = u;
  }
  return bez(0.1, 1, u);
}

/** ScrollController, used by the ranking dialog's auto-scroll. */
export class ScrollController {
  constructor() {
    this.node = null;
    this._animation = null;
  }

  attach(node) {
    this.node = node;
  }

  get maxScrollExtent() {
    if (!this.node) return 0;
    return Math.max(0, this.node.scrollHeight - this.node.clientHeight);
  }

  /** animateTo(offset, duration, curve) */
  animateTo(offset, { duration = 0 } = {}) {
    const node = this.node;
    if (!node) return Promise.resolve();
    const from = node.scrollTop;
    const to = typeof offset === 'number' ? offset : this.maxScrollExtent;
    const start = performance.now();
    this._animation?.cancel?.();

    return new Promise((resolve) => {
      let cancelled = false;
      this._animation = { cancel: () => (cancelled = true) };
      const step = (now) => {
        if (cancelled || !node.isConnected) return resolve();
        const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
        node.scrollTop = from + (to - from) * curveEase(t);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }
}
