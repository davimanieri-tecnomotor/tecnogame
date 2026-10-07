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

/* ---------------------------------------------------------------- ícones -- */

// Traço, na cor do texto, e não emoji: o 🗑 e o 🔔 saem coloridos e cada
// sistema os desenha de um jeito, e no meio de botões azuis pareciam colados.
const TRACOS = {
  mais: '<path d="M12 5v14M5 12h14"/>',
  lixeira:
    '<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  copiar: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  cima: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  baixo: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  baixar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  enviar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
  engrenagem:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  atualizar: '<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  sino: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  carro:
    '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  grafico: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
  imagem: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  voltar: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  alerta: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  certo: '<path d="M20 6L9 17l-5-5"/>',
  nuvem: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
  tocar: '<path d="M6 4l14 8-14 8V4z"/>',
};

/**
 * Um ícone de traço, num `span` (é o que `botao` e as abas põem na frente do
 * rótulo). Nome desconhecido sai como texto: os glifos de sempre (↑, ⧉)
 * continuam valendo.
 */
export function icone(nome, { classe = 'botao-icone' } = {}) {
  const s = el('span', { class: classe, 'aria-hidden': 'true' });
  if (TRACOS[nome]) {
    s.innerHTML = `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TRACOS[nome]}</svg>`;
  } else {
    s.textContent = nome;
  }
  return s;
}

/* ------------------------------------------------------------------ ajuda -- */

// O (?) que guarda a explicação de um campo. O painel tinha uma linha cinza de
// dica embaixo de quase todo campo, e a tela virava um manual: quem só queria
// trocar uma pergunta lia três parágrafos para achar a caixa. A explicação
// continua lá, a um passar de mouse — e só para quem a procura.
//
// O balão é UM só, pendurado no `body` com `position: fixed`, e não um filho do
// ícone: as duas colunas do painel rolam (`overflow: auto`), e um balão dentro
// delas seria recortado na borda — justo no campo do canto, onde mais aparece.

let balao = null;
let ancoraDoBalao = null;
let vigiaDoBalao = 0;

function esconderBalao() {
  clearInterval(vigiaDoBalao);
  ancoraDoBalao = null;
  if (balao) balao.hidden = true;
}

function mostrarBalao(ancora) {
  if (!balao) {
    balao = el('div', { class: 'ajuda-balao', role: 'tooltip' });
    balao.hidden = true;
    document.body.appendChild(balao);
    // Rolar tira o ícone de baixo do balão, que é fixo na janela.
    window.addEventListener('scroll', esconderBalao, true);
    document.addEventListener('keydown', (e) => e.key === 'Escape' && esconderBalao());
    document.addEventListener('pointerdown', (e) => {
      if (ancoraDoBalao && !ancoraDoBalao.contains(e.target)) esconderBalao();
    });
  }
  ancoraDoBalao = ancora;
  balao.textContent = ancora.dataset.ajuda ?? '';
  balao.hidden = false;

  // Embaixo do ícone, centrado nele; em cima se não couber, e sempre dentro da
  // janela.
  const r = ancora.getBoundingClientRect();
  const b = balao.getBoundingClientRect();
  const margem = 8;
  const x = Math.min(Math.max(margem, r.left + r.width / 2 - b.width / 2), innerWidth - b.width - margem);
  const embaixo = r.bottom + 8;
  const y = embaixo + b.height > innerHeight - margem ? Math.max(margem, r.top - 8 - b.height) : embaixo;
  balao.style.left = `${Math.round(x)}px`;
  balao.style.top = `${Math.round(y)}px`;

  // A barra e a lista do painel são redesenhadas a cada tecla; o ícone pode sair
  // da página com o balão aberto, e sem isto o balão ficaria órfão na tela.
  clearInterval(vigiaDoBalao);
  vigiaDoBalao = setInterval(() => {
    if (!ancora.isConnected) esconderBalao();
  }, 300);
}

/**
 * O ícone (?) de ajuda: o balão abre ao passar o mouse, no foco do teclado e no
 * toque.
 *
 * `span`, e não `button`, de propósito: dentro de um `<label>`, o primeiro
 * elemento rotulável vira o controle do rótulo, e um botão antes da caixa de
 * texto roubaria dela o rótulo — clicar no nome do campo deixaria de levar o
 * cursor para a caixa, e o leitor de tela anunciaria a caixa sem nome.
 */
export function ajuda(texto, { rotulo = 'Ajuda' } = {}) {
  const sinal = el('span', { class: 'ajuda', tabindex: '0', role: 'img', 'aria-label': `${rotulo}: ${texto}` });
  sinal.dataset.ajuda = texto;
  sinal.addEventListener('pointerenter', () => mostrarBalao(sinal));
  // No toque, o `pointerleave` chega logo depois do dedo sair da tela; ali o
  // balão fica até o próximo toque fora dele.
  sinal.addEventListener('pointerleave', (e) => e.pointerType !== 'touch' && esconderBalao());
  sinal.addEventListener('focus', () => mostrarBalao(sinal));
  sinal.addEventListener('blur', esconderBalao);
  sinal.addEventListener('click', (e) => {
    // Dentro de um rótulo, o clique iria para a caixa que ele rotula — numa
    // caixa de marcar, a marcaria; num `<summary>`, abriria o avançado.
    e.preventDefault();
    e.stopPropagation();
    if (ancoraDoBalao !== sinal) mostrarBalao(sinal);
  });
  return sinal;
}

/* ------------------------------------------------------------- controles -- */

/** O rótulo de um campo: o nome, o * de obrigatório e o (?), nessa ordem. */
function rotuloDeCampo(rotulo, { obrigatorio = false, textoDeAjuda = null, escondido = false } = {}) {
  return el('span', { class: ['campo-rotulo', escondido ? 'so-leitor' : null] }, [
    el('span', { class: 'campo-rotulo-texto', text: rotulo }),
    obrigatorio ? el('span', { class: 'campo-asterisco', 'aria-hidden': 'true', text: '*' }) : null,
    textoDeAjuda ? ajuda(textoDeAjuda, { rotulo }) : null,
  ]);
}

/**
 * @param {object} props
 * @param {string} [props.ajuda] a explicação que mora no (?) ao lado do rótulo
 * @param {string} [props.dica] uma linha fixa embaixo da caixa — só para o que
 *   muda com o dado (o mais rápido do dia), e não para explicar o campo
 * @param {number} [props.linhas] altura da caixa de várias linhas
 * @param {boolean} [props.semQuebra] caixa de várias linhas que não aceita
 *   Enter: o texto quebra na tela para ser lido inteiro, mas é uma linha só —
 *   a alternativa, que o jogo desenha numa caixa de uma linha
 */
export function campo({
  rotulo,
  valor = '',
  multilinha = false,
  linhas = 3,
  semQuebra = false,
  onInput,
  dica,
  ajuda: textoDeAjuda = null,
  obrigatorio = false,
  placeholder,
  id,
}) {
  const entrada = multilinha
    ? el('textarea', { rows: linhas, id, class: 'campo-entrada', placeholder })
    : el('input', { type: 'text', id, class: 'campo-entrada', placeholder });
  entrada.value = valor ?? '';
  if (multilinha && semQuebra) {
    entrada.addEventListener('keydown', (e) => e.key === 'Enter' && e.preventDefault());
    // O que chega colado com quebra vira espaço.
    entrada.addEventListener('input', () => {
      if (entrada.value.includes('\n')) entrada.value = entrada.value.replace(/\s*\n+\s*/g, ' ');
    });
  }
  if (onInput) entrada.addEventListener('input', () => onInput(entrada.value, entrada));

  const erro = el('span', { class: 'campo-erro', role: 'alert' });
  erro.hidden = true;

  const raiz = el('label', { class: ['campo', obrigatorio ? 'campo-obrigatorio' : null] }, [
    rotuloDeCampo(rotulo, { obrigatorio, textoDeAjuda }),
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

/**
 * @param {string} texto o rótulo; vazio num botão só de ícone, e aí `titulo`
 *   é o que o leitor de tela e o mouse por cima dizem
 * @param {object} [opcoes]
 * @param {'normal'|'primario'|'perigo'|'discreto'} [opcoes.tipo]
 * @param {string} [opcoes.acao] vira `data-acao`, o nome estável por que os
 *   testes acham o botão sem depender do texto
 */
export function botao(texto, { onClick, tipo = 'normal', titulo, icone: nomeDoIcone, disabled = false, acao = null } = {}) {
  return el(
    'button',
    {
      type: 'button',
      class: ['botao', `botao-${tipo}`, texto ? null : 'botao-so-icone'],
      onClick,
      title: titulo,
      'aria-label': texto ? null : titulo,
      'data-acao': acao,
      disabled,
    },
    [nomeDoIcone ? icone(nomeDoIcone) : null, el('span', { text: texto })]
  );
}

/**
 * @param {object} props
 * @param {boolean} [props.rotuloEscondido] o rótulo só para o leitor de tela,
 *   quando o que está em volta já diz o que a caixa é
 */
export function selecao({ rotulo, opcoes, valor, onChange, id, ajuda: textoDeAjuda = null, rotuloEscondido = false }) {
  const sel = el('select', { class: 'campo-entrada', id });
  for (const o of opcoes) {
    const opt = el('option', { value: o.valor, text: o.rotulo });
    if (String(o.valor) === String(valor)) opt.selected = true;
    sel.appendChild(opt);
  }
  if (onChange) sel.addEventListener('change', () => onChange(sel.value));
  const raiz = el('label', { class: 'campo' }, [rotuloDeCampo(rotulo, { textoDeAjuda, escondido: rotuloEscondido }), sel]);
  raiz.entrada = sel;
  return raiz;
}

export function caixaDeMarcar({ rotulo, marcado, onChange, ajuda: textoDeAjuda = null }) {
  const input = el('input', { type: 'checkbox' });
  input.checked = Boolean(marcado);
  if (onChange) input.addEventListener('change', () => onChange(input.checked));
  const raiz = el('label', { class: 'marcar' }, [
    input,
    el('span', { text: rotulo }),
    textoDeAjuda ? ajuda(textoDeAjuda, { rotulo }) : null,
  ]);
  raiz.entrada = input;
  return raiz;
}

/**
 * Uma chave de liga/desliga — uma caixa de marcar com cara de interruptor,
 * para o que é estado ("ativa no jogo") e não escolha numa lista.
 */
export function interruptor({ rotulo, ligado, onChange, ajuda: textoDeAjuda = null }) {
  const input = el('input', { type: 'checkbox', role: 'switch', class: 'interruptor-entrada' });
  input.checked = Boolean(ligado);
  if (onChange) input.addEventListener('change', () => onChange(input.checked));
  const raiz = el('label', { class: 'interruptor' }, [
    input,
    el('span', { class: 'interruptor-trilho', 'aria-hidden': 'true' }),
    el('span', { class: 'interruptor-rotulo', text: rotulo }),
    textoDeAjuda ? ajuda(textoDeAjuda, { rotulo }) : null,
  ]);
  raiz.entrada = input;
  return raiz;
}

/* --------------------------------------------------------------- popover -- */

let fecharPopoverAberto = null;
let ancoraDoPopover = null;

/** Fecha o popover aberto, se houver. */
export function fecharPopover() {
  fecharPopoverAberto?.();
}

/**
 * Uma caixa que abre embaixo de um botão — a lista de problemas da barra.
 *
 * Fecha no clique fora, no Esc, quando a janela muda de tamanho e num segundo
 * clique no mesmo botão. Como os avisos, mora no `body` e repete a tipografia
 * do painel (ver admin.css).
 */
export function abrirPopover(ancora, conteudo, { rotulo } = {}) {
  const jaAberto = fecharPopoverAberto && ancoraDoPopover === ancora;
  fecharPopover();
  if (jaAberto) return null;
  ancoraDoPopover = ancora;
  const caixa = el('div', { class: 'popover', role: 'dialog', 'aria-label': rotulo }, conteudo);
  document.body.appendChild(caixa);

  const r = ancora.getBoundingClientRect();
  const b = caixa.getBoundingClientRect();
  caixa.style.top = `${Math.round(r.bottom + 6)}px`;
  caixa.style.left = `${Math.round(Math.min(Math.max(8, r.right - b.width), innerWidth - b.width - 8))}px`;

  const fora = (e) => {
    if (!caixa.contains(e.target) && !ancora.contains(e.target)) fechar();
  };
  const tecla = (e) => e.key === 'Escape' && fechar();
  function fechar() {
    caixa.remove();
    document.removeEventListener('pointerdown', fora, true);
    document.removeEventListener('keydown', tecla);
    window.removeEventListener('resize', fechar);
    if (fecharPopoverAberto === fechar) {
      fecharPopoverAberto = null;
      ancoraDoPopover = null;
    }
  }
  document.addEventListener('pointerdown', fora, true);
  document.addEventListener('keydown', tecla);
  window.addEventListener('resize', fechar);
  fecharPopoverAberto = fechar;
  return fechar;
}

/* ------------------------------------------------------------------ aviso -- */

let pilhaDeAvisos = null;

/**
 * Um aviso no canto da tela, que some sozinho — ou com um clique.
 *
 * @param {'ok'|'erro'|'info'} [tipo] `info` é o diagnóstico: explica por que
 *   a porta tomou um caminho, sem ser erro de ninguém.
 * @param {object} [opcoes]
 * @param {number} [opcoes.ms] quanto tempo fica. O padrão serve a frase curta;
 *   o diagnóstico da porta traz o que conferir e onde, e precisa de mais.
 */
export function aviso(texto, tipo = 'ok', { ms = tipo === 'erro' ? 6000 : 3000 } = {}) {
  if (!pilhaDeAvisos) {
    pilhaDeAvisos = el('div', { class: 'avisos', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(pilhaDeAvisos);
  }
  let foi = false;
  const tirar = () => {
    if (foi) return;
    foi = true;
    node.classList.add('saindo');
    setTimeout(() => node.remove(), 300);
  };
  const node = el('div', { class: `aviso aviso-${tipo}`, text: texto, title: 'Clique para fechar', onClick: tirar });
  pilhaDeAvisos.appendChild(node);
  setTimeout(tirar, ms);
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

/**
 * Pede e-mail e senha — a conta de verdade do Firebase, não a senha 2040 da
 * porta. Resolve com `{email, senha, manter}`, ou `null` se desistir;
 * `manter` é a caixa "Manter conectado", que `entrar` recebe como está.
 */
export function pedirCredenciais({ titulo = 'Entrar', texto } = {}) {
  return new Promise((resolve) => {
    const email = entradaSimples({ tipo: 'email', rotulo: 'E-mail', auto: 'username' });
    const senha = entradaSimples({ tipo: 'password', rotulo: 'Senha', auto: 'current-password' });
    // Nasce desmarcada, e não lembra a escolha anterior: a porta também abre
    // no totem, onde sessão guardada vira painel aberto para quem der os cinco
    // toques (ver `guardarSessao` em respostas.js).
    const manter = caixaDeMarcar({ rotulo: 'Manter conectado neste navegador' });
    manter.classList.add('manter-conectado');

    const fechar = (r) => {
      fundo.remove();
      document.removeEventListener('keydown', onTecla);
      resolve(r);
    };
    const enviar = () => {
      const e = email.entrada.value.trim();
      const s = senha.entrada.value;
      if (!e || !s) return;
      fechar({ email: e, senha: s, manter: manter.entrada.checked });
    };
    const onTecla = (ev) => {
      if (ev.key === 'Escape') fechar(null);
      if (ev.key === 'Enter') {
        ev.preventDefault();
        enviar();
      }
    };

    const caixa = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo }, [
      el('h2', { text: titulo }),
      texto ? el('p', { text: texto }) : null,
      email,
      senha,
      el('div', { class: 'campo' }, [
        manter,
        el('span', {
          class: 'campo-dica',
          text: 'Desmarcado, a sessão acaba ao fechar a aba. Não marque no totem: quem abrir o painel ali entraria com a sua conta.',
        }),
      ]),
      el('div', { class: 'modal-acoes' }, [
        botao('Cancelar', { onClick: () => fechar(null) }),
        botao('Entrar', { tipo: 'primario', onClick: enviar }),
      ]),
    ]);
    const fundo = el('div', { class: 'modal-fundo', onClick: (ev) => ev.target === fundo && fechar(null) }, caixa);
    document.body.appendChild(fundo);
    document.addEventListener('keydown', onTecla);
    email.entrada.focus();
  });
}

/** Um campo de texto simples para os modais — sem a validação do editor. */
function entradaSimples({ tipo, rotulo, auto }) {
  const entrada = el('input', { class: 'campo-entrada', type: tipo, autocomplete: auto });
  const raiz = el('label', { class: 'campo' }, [el('span', { class: 'campo-rotulo', text: rotulo }), entrada]);
  raiz.entrada = entrada;
  return raiz;
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
    // `focus()` sem mais nada ROLA o contêiner até o elemento focado. Com notas
    // suficientes para a caixa rolar, o "Entendi" lá embaixo levava junto o
    // título e o cabeçalho da versão mais nova — o operador abria o sino e via
    // os itens soltos, sem saber de que versão eram. Foco sem rolagem, e a
    // caixa começa onde ela deve: no topo.
    botaoOk.focus({ preventScroll: true });
    caixa.scrollTop = 0;
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
 * O botão de enviar imagem do computador.
 *
 * O `<input type=file>` continua de verdade dentro do botão — transparente, mas
 * presente e focável —, e não escondido atrás de um clique sintético: assim o
 * teclado o alcança (Tab, e Enter abre a janela de arquivos) e os testes
 * conseguem entregar um arquivo a ele. O que saiu foi a cara nativa, o
 * "Escolher arquivo / Nenhum arquivo escolhido", que o operador lia como um
 * campo a preencher.
 *
 * A linha de estado (`raiz.estado`) vai onde quem chama quiser: o editor a põe
 * embaixo da fileira de botões da foto.
 *
 * @param {object} props
 * @param {Function} props.onEscolha recebe (resultado, arquivo); resultado e
 *   null quando a leitura falhou, e o terceiro argumento traz o erro. Pode ser
 *   assincrona (o envio ao Storage): o seletor fica desligado ate ela acabar,
 *   e o que ela tiver a dizer vai por `raiz.mostrarEstado`.
 */
export function entradaDeImagem({ rotulo, onEscolha }) {
  const entrada = el('input', { type: 'file', accept: 'image/*', class: 'campo-arquivo' });
  const estado = el('span', { class: 'campo-dica campo-arquivo-estado', role: 'status' });

  entrada.addEventListener('change', async () => {
    const arquivo = entrada.files?.[0];
    if (!arquivo) return;
    estado.textContent = 'processando…';
    // Desligado durante o envio: uma segunda escolha no meio da primeira
    // terminaria na ordem em que a rede respondesse, e nao na do clique.
    entrada.disabled = true;
    raiz.classList.add('ocupado');
    try {
      const r = await reduzirImagem(arquivo);
      estado.textContent = r.reduziu
        ? `${arquivo.name} — reduzida para ${r.largura}x${r.altura}, cerca de ${r.kb} KB`
        : `${arquivo.name} — cerca de ${r.kb} KB`;
      await onEscolha(r, arquivo);
    } catch (e) {
      estado.textContent = e?.message ?? 'não foi possível usar este arquivo';
      onEscolha(null, arquivo, e);
    } finally {
      // Zerar deixa escolher o MESMO arquivo de novo depois de um erro.
      entrada.value = '';
      entrada.disabled = false;
      raiz.classList.remove('ocupado');
    }
  });

  const raiz = el('label', { class: 'botao botao-arquivo campo-arquivo-campo' }, [icone('enviar'), el('span', { text: rotulo }), entrada]);
  raiz.entrada = entrada;
  raiz.estado = estado;
  /**
   * @param {string} texto
   * @param {'andamento'|'ok'|'atencao'|'erro'|null} [tipo] a cor da linha; em
   *   andamento ela ganha um giro na frente, para não parecer parada
   */
  raiz.mostrarEstado = (texto, tipo = null) => {
    estado.textContent = texto;
    for (const t of ['andamento', 'ok', 'atencao', 'erro']) {
      estado.classList.toggle(`campo-arquivo-estado--${t}`, t === tipo);
    }
  };
  return raiz;
}
