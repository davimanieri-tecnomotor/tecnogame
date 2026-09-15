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

/* ---------------------------------------------------------------- notas -- */

/**
 * O painel de novidades que o sininho abre. Ao contrário de `confirmar`, não
 * há duas saídas — só "Entendi" —, porque não é uma pergunta, é um aviso.
 */
export function mostrarNotas({ titulo, notas, fecharTexto = 'Entendi' }) {
  return new Promise((resolve) => {
    const fechar = () => {
      fundo.remove();
      document.removeEventListener('keydown', onTecla);
      resolve();
    };
    const onTecla = (e) => {
      if (e.key === 'Escape') fechar();
    };

    const botaoOk = botao(fecharTexto, { tipo: 'primario', onClick: fechar });
    const blocos = notas.map((nota) =>
      el('div', { class: 'notas-versao' }, [
        el('h3', { text: `v${nota.versao}${nota.data ? ` — ${nota.data}` : ''}` }),
        el(
          'ul',
          { class: 'notas-itens' },
          nota.itens.map((item) => el('li', { text: item }))
        ),
      ])
    );

    const caixa = el('div', { class: 'modal modal-notas', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo }, [
      el('h2', { text: titulo }),
      ...blocos,
      el('div', { class: 'modal-acoes' }, [botaoOk]),
    ]);
    const fundo = el('div', { class: 'modal-fundo', onClick: (e) => e.target === fundo && fechar() }, caixa);
    document.body.appendChild(fundo);
    document.addEventListener('keydown', onTecla);
    botaoOk.focus();
  });
}

/* ------------------------------------------------------- imagem embutida -- */

/** O maior lado que uma imagem enviada do computador pode ter, em px. */
const MAX_LADO = 1280;

/**
 * Le uma imagem escolhida pelo operador e devolve uma versao pronta para
 * caber no baralho.
 *
 * Por que reduzir: o baralho vive no localStorage, que tem alguns megabytes no
 * total. Uma foto de celular de 4000px passa de 4 MB e sozinha estoura a cota,
 * levando embora tambem as perguntas. Reduzida para 1280px de maior lado, uma
 * foto de veiculo fica na casa das centenas de KB.
 *
 * Prefere WebP porque as fotos originais do jogo sao recortes com fundo
 * transparente, e JPEG nao tem canal alfa -- sairia uma caixa branca em cima
 * da fatia da roleta. Se o navegador nao souber gravar WebP, cai para PNG.
 *
 * Guarda o original quando ele ja e menor que o reprocessado, para nao inflar
 * um PNG pequeno de proposito.
 *
 * @param {File} arquivo
 * @returns {Promise<{dataUrl: string, largura: number, altura: number, kb: number, reduziu: boolean}>}
 */
export async function reduzirImagem(arquivo, { maxLado = MAX_LADO, qualidade = 0.85 } = {}) {
  const original = await new Promise((ok, falhou) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => falhou(new Error('não foi possível ler o arquivo'));
    r.readAsDataURL(arquivo);
  });

  const img = await new Promise((ok, falhou) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => falhou(new Error('o arquivo não é uma imagem que o navegador saiba abrir'));
    i.src = original;
  });

  const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
  const largura = Math.max(1, Math.round(img.naturalWidth * escala));
  const altura = Math.max(1, Math.round(img.naturalHeight * escala));

  const tela = el('canvas', { width: largura, height: altura });
  const ctx = tela.getContext('2d');
  ctx.drawImage(img, 0, 0, largura, altura);

  let reprocessada = tela.toDataURL('image/webp', qualidade);
  if (!reprocessada.startsWith('data:image/webp')) reprocessada = tela.toDataURL('image/png');

  const usarOriginal = original.length <= reprocessada.length;
  const dataUrl = usarOriginal ? original : reprocessada;

  return {
    dataUrl,
    largura: usarOriginal ? img.naturalWidth : largura,
    altura: usarOriginal ? img.naturalHeight : altura,
    kb: Math.round(dataUrl.length / 1024),
    reduziu: !usarOriginal && escala < 1,
  };
}

/**
 * Um seletor de imagem visivel de verdade (nao um input escondido atras de um
 * clique sintetico), para dar para alcancar por teclado e para os testes
 * conseguirem entregar um arquivo a ele.
 *
 * @param {object} props
 * @param {Function} props.onEscolha recebe (resultado, arquivo); resultado e
 *   null quando a leitura falhou, e o terceiro argumento traz o erro
 */
export function entradaDeImagem({ rotulo, dica, onEscolha }) {
  const entrada = el('input', { type: 'file', accept: 'image/*', class: 'campo-arquivo' });
  const estado = el('span', { class: 'campo-dica campo-arquivo-estado', role: 'status' });

  entrada.addEventListener('change', async () => {
    const arquivo = entrada.files?.[0];
    if (!arquivo) return;
    estado.textContent = 'processando…';
    try {
      const r = await reduzirImagem(arquivo);
      estado.textContent = r.reduziu
        ? `${arquivo.name} — reduzida para ${r.largura}x${r.altura}, cerca de ${r.kb} KB`
        : `${arquivo.name} — cerca de ${r.kb} KB`;
      onEscolha(r, arquivo);
    } catch (e) {
      estado.textContent = e?.message ?? 'não foi possível usar este arquivo';
      onEscolha(null, arquivo, e);
    } finally {
      // Zerar deixa escolher o MESMO arquivo de novo depois de um erro.
      entrada.value = '';
    }
  });

  const raiz = el('label', { class: 'campo campo-arquivo-campo' }, [
    el('span', { class: 'campo-rotulo', text: rotulo }),
    entrada,
    dica ? el('span', { class: 'campo-dica', text: dica }) : null,
    estado,
  ]);
  raiz.entrada = entrada;
  return raiz;
}
