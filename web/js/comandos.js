// Os comandos que não são toque: o teclado, o controle e os atalhos do
// operador.
//
// POR QUE. Um totem de feira vive de toque, mas o WOW mais barato do estande é
// um botão de fliperama: um kit "encoder zero delay" com botões grandes é lido
// pelo computador como teclado ou como controle, e um botão vermelho no
// pedestal que GIRA a roleta e diz PODE! vale mais que qualquer animação.
//
//   1–4            escolhe a alternativa
//   Enter, Espaço  a ação principal da tela (PODE!, SIM, CONTINUAR, GIRAR...)
//   Esc            desiste (o NÃO do "Está certo disso?")
//   controle       botões 0–3 escolhem quando há o que escolher; senão o 0 é a
//                  ação principal e o 1 desiste; Start é a principal
//
// Quem decide o que cada comando faz é a TELA que está no palco: ela se
// registra (`registrarComandos`) e diz o que aceita em cada momento. Aqui só se
// traduz o gesto em intenção.
//
// OS ATALHOS DO OPERADOR são escondidos de propósito — Ctrl+Alt e uma tecla —,
// porque a feira barulhenta e o auditório silencioso pedem volumes diferentes e
// o volume era cravado no código:
//
//   Ctrl+Alt+M       liga e desliga o som
//   Ctrl+Alt+↑ / ↓   volume, de 10 em 10%
//   Ctrl+Alt+Home    volta ao cadastro, esquecendo a partida em curso

import { el } from './widgets.js';
import { alternarMudo, definirVolume, estaMudo, volumeAtual } from './audio.js';
import { goNamed } from './router.js';
import { FFAppState } from './state.js';

/** A tela que está ouvindo agora, ou null. */
let atual = null;

/**
 * A tela passa a receber os comandos. Devolve quem a desliga (chamar no
 * `__dispose`).
 *
 * @param {object} alvo
 * @param {Function} [alvo.aceita] `(tipo) => boolean` — 'escolher' agora faz sentido?
 * @param {Function} [alvo.escolher] recebe a posição (0 a 3)
 * @param {Function} [alvo.principal]
 * @param {Function} [alvo.cancelar]
 */
export function registrarComandos(alvo) {
  atual = alvo;
  return () => {
    if (atual === alvo) atual = null;
  };
}

const digitando = (alvo) =>
  alvo instanceof HTMLElement && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName));

/** Enter e Espaço em cima de um botão focado são do botão, e não da tela. */
const emBotao = (alvo) => alvo instanceof HTMLElement && Boolean(alvo.closest('[role="button"], button, a[href]'));

const noPainel = () => document.documentElement.dataset.modo === 'adm';

/* ------------------------------------------------ o aviso do operador ---- */

let aviso = null;
let avisoTimer = 0;

function avisar(texto) {
  const stage = document.getElementById('stage');
  if (!stage) return;
  if (!aviso || !aviso.isConnected) {
    aviso = el('div', { class: 'aud-aviso-operador', role: 'status', 'aria-live': 'polite' });
    stage.appendChild(aviso);
  }
  aviso.textContent = texto;
  aviso.classList.add('visivel');
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => aviso?.classList.remove('visivel'), 1400);
}

const falarVolume = () => (estaMudo() ? '🔇 som desligado' : `🔊 volume ${Math.round(volumeAtual() * 100)}%`);

function atalhoDoOperador(e) {
  if (!(e.ctrlKey && e.altKey)) return false;
  const k = e.key.toLowerCase();
  if (k === 'm') {
    alternarMudo();
    avisar(falarVolume());
  } else if (k === 'arrowup' || k === 'arrowdown') {
    definirVolume(Math.round((volumeAtual() + (k === 'arrowup' ? 0.1 : -0.1)) * 10) / 10);
    avisar(falarVolume());
  } else if (k === 'home') {
    FFAppState.encerrarPartida();
    goNamed('cadastro');
    avisar('↩ de volta ao cadastro');
  } else {
    return false;
  }
  e.preventDefault();
  return true;
}

/* -------------------------------------------------------------- teclado -- */

function aoTeclar(e) {
  if (noPainel()) return;
  if (atalhoDoOperador(e)) return;
  if (e.ctrlKey || e.altKey || e.metaKey || digitando(e.target) || !atual) return;
  if (e.repeat) return;
  const k = e.key;
  if (k >= '1' && k <= '4') {
    if (atual.aceita?.('escolher') === false) return;
    atual.escolher?.(Number(k) - 1);
    e.preventDefault();
  } else if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
    if (emBotao(e.target)) return;
    atual.principal?.();
    e.preventDefault();
  } else if (k === 'Escape') {
    atual.cancelar?.();
  }
}

/* ------------------------------------------------------------- controle -- */

let lendo = 0;
const apertados = new Map();

function lerControles() {
  lendo = 0;
  const lista = [...(navigator.getGamepads?.() ?? [])].filter(Boolean);
  if (!lista.length) return;
  for (const gp of lista) {
    const antes = apertados.get(gp.index) ?? [];
    const agora = gp.buttons.map((b) => b.pressed);
    agora.forEach((ok, i) => {
      if (!ok || antes[i] || !atual || noPainel()) return;
      // Um toque de botão físico conta como gesto para o prazo de inatividade
      // e para o áudio, como um toque na tela.
      window.dispatchEvent(new Event('pointerdown'));
      if (i <= 3 && atual.aceita?.('escolher')) atual.escolher?.(i);
      else if (i === 0 || i === 9) atual.principal?.();
      else if (i === 1 || i === 8) atual.cancelar?.();
    });
    apertados.set(gp.index, agora);
  }
  lendo = requestAnimationFrame(lerControles);
}

/** Liga tudo. Chamado uma vez, no boot (main.js). */
export function ligarComandos() {
  window.addEventListener('keydown', aoTeclar);
  // A Gamepad API só entrega o controle depois de um botão apertado; o laço de
  // leitura dorme até lá, e volta a dormir quando o último sai.
  window.addEventListener('gamepadconnected', () => {
    if (!lendo) lendo = requestAnimationFrame(lerControles);
  });
  window.addEventListener('gamepaddisconnected', (e) => apertados.delete(e.gamepad.index));
}
