// Helpers de DOM da área administrativa.
//
// Aqui NÃO se imita widget do Flutter. O jogo vive num palco de 1920x1080
// escalado, com medidas absolutas, porque é um totem; o admin é usado por um
// funcionário num notebook, então é HTML e CSS normais, responsivos.

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, String(v));
  }
  for (const c of [children].flat(4)) {
    if (c == null || c === false) continue;
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const limpar = (node) => {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
};

/* ------------------------------------------------------------- controles -- */

export function campo({ rotulo, valor = '', multilinha = false, onInput, dica, obrigatorio = false, id }) {
  const entrada = multilinha
    ? el('textarea', { rows: 3, id, class: 'campo-entrada' })
    : el('input', { type: 'text', id, class: 'campo-entrada' });
  entrada.value = valor ?? '';
  if (onInput) entrada.addEventListener('input', () => onInput(entrada.value, entrada));

  const erro = el('span', { class: 'campo-erro', role: 'alert' });
  erro.hidden = true;

  const raiz = el('label', { class: ['campo', obrigatorio ? 'campo-obrigatorio' : null] }, [
    el('span', { class: 'campo-rotulo', text: rotulo }),
    entrada,
    dica ? el('span', { class: 'campo-dica', text: dica }) : null,
    erro,
  ]);
  raiz.entrada = entrada;
  raiz.marcarErro = (msg) => {
    erro.textContent = msg ?? '';
    erro.hidden = !msg;
    raiz.classList.toggle('tem-erro', Boolean(msg));
  };
  return raiz;
}

export function botao(texto, { onClick, tipo = 'normal', titulo, icone } = {}) {
  return el(
    'button',
    { type: 'button', class: `botao botao-${tipo}`, onClick, title: titulo, 'aria-label': titulo },
    [icone ? el('span', { class: 'botao-icone', 'aria-hidden': 'true', text: icone }) : null, el('span', { text: texto })]
  );
}

export function selecao({ rotulo, opcoes, valor, onChange, id }) {
  const sel = el('select', { class: 'campo-entrada', id });
  for (const o of opcoes) {
    const opt = el('option', { value: o.valor, text: o.rotulo });
    if (String(o.valor) === String(valor)) opt.selected = true;
    sel.appendChild(opt);
  }
  if (onChange) sel.addEventListener('change', () => onChange(sel.value));
  const raiz = el('label', { class: 'campo' }, [el('span', { class: 'campo-rotulo', text: rotulo }), sel]);
  raiz.entrada = sel;
  return raiz;
}

export function caixaDeMarcar({ rotulo, marcado, onChange }) {
  const input = el('input', { type: 'checkbox' });
  input.checked = Boolean(marcado);
  if (onChange) input.addEventListener('change', () => onChange(input.checked));
  const raiz = el('label', { class: 'marcar' }, [input, el('span', { text: rotulo })]);
  raiz.entrada = input;
  return raiz;
}

/* ------------------------------------------------------------------ aviso -- */

let pilhaDeAvisos = null;

export function aviso(texto, tipo = 'ok') {
  if (!pilhaDeAvisos) {
    pilhaDeAvisos = el('div', { class: 'avisos', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(pilhaDeAvisos);
  }
  const node = el('div', { class: `aviso aviso-${tipo}`, text: texto });
  pilhaDeAvisos.appendChild(node);
  setTimeout(() => {
    node.classList.add('saindo');
    setTimeout(() => node.remove(), 300);
  }, tipo === 'erro' ? 6000 : 3000);
}

/* ---------------------------------------------------------------- diálogo -- */

/**
 * Diálogo modal. Resolve com `true` no confirmar e `false` no cancelar, então
 * quem chama faz `if (await confirmar(...))`.
 */
export function confirmar({ titulo, texto, confirmarTexto = 'Confirmar', perigoso = false }) {
  return new Promise((resolve) => {
    const fechar = (r) => {
      fundo.remove();
      document.removeEventListener('keydown', onTecla);
      resolve(r);
    };
    const onTecla = (e) => {
      if (e.key === 'Escape') fechar(false);
    };

    const botaoOk = botao(confirmarTexto, { tipo: perigoso ? 'perigo' : 'primario', onClick: () => fechar(true) });
    const caixa = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo }, [
      el('h2', { text: titulo }),
      el('p', { text: texto }),
      el('div', { class: 'modal-acoes' }, [
        botao('Cancelar', { onClick: () => fechar(false) }),
        botaoOk,
      ]),
    ]);
    const fundo = el('div', { class: 'modal-fundo', onClick: (e) => e.target === fundo && fechar(false) }, caixa);
    document.body.appendChild(fundo);
    document.addEventListener('keydown', onTecla);
    botaoOk.focus();
  });
}

/** Faz o navegador salvar um arquivo, sem servidor. */
export function baixarArquivo(nome, conteudo, tipo = 'application/json') {
  const blob = new Blob([conteudo], { type: `${tipo};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: nome });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lê um arquivo escolhido pelo usuário como texto. */
export function escolherArquivo({ accept = '.json' } = {}) {
  return new Promise((resolve) => {
    const input = el('input', { type: 'file', accept, style: { display: 'none' } });
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      const leitor = new FileReader();
      leitor.onload = () => resolve({ nome: f.name, texto: String(leitor.result) });
      leitor.onerror = () => resolve(null);
      leitor.readAsText(f, 'utf-8');
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });
}
