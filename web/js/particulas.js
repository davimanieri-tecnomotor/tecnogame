// Confete, faísca e fumaça, num `<canvas>` por cima das telas.
//
// Um canvas só, em `#frente` (ver palco.js), e que DORME: o laço de quadros só
// roda enquanto houver partícula viva, e para sozinho quando a última some. Um
// totem fica ligado o dia inteiro, e um laço de desenho acordado à toa é
// ventoinha girando à toa.
//
// Com "menos movimento" no sistema nada disto nasce: o veredito continua dito
// pela cor e pelo texto.

import { menosMovimento } from './anim.js';

const W = 1920;
const H = 1080;
const CORES = ['#FFD84D', '#FFB400', '#0051FF', '#3E8BFF', '#FFFFFF', '#FF3B30'];

const lista = [];
let rodando = false;
let ultimo = 0;
let ctx2d = null;

const aleatorio = (a, b) => a + Math.random() * (b - a);

function contexto() {
  if (ctx2d?.canvas.isConnected) return ctx2d;
  const cv = document.getElementById('particulas');
  ctx2d = cv?.getContext?.('2d') ?? null;
  return ctx2d;
}

function acordar() {
  if (rodando || !contexto()) return;
  rodando = true;
  ultimo = performance.now();
  requestAnimationFrame(laco);
}

function laco() {
  const g = contexto();
  if (!g) {
    rodando = false;
    lista.length = 0;
    return;
  }
  // `performance.now`, e não o carimbo do requestAnimationFrame: `ultimo` saiu
  // dele, e o carimbo do quadro pode vir um pouco ANTES — um passo negativo
  // encolhia a fumaça a um raio menor que zero, e o canvas lança erro.
  const agora = performance.now();
  const dt = Math.min(0.033, Math.max(0, (agora - ultimo) / 1000));
  ultimo = agora;
  g.clearRect(0, 0, W, H);
  for (let i = lista.length - 1; i >= 0; i--) {
    const p = lista[i];
    p.vida -= dt;
    p.idade += dt;
    if (p.vida <= 0 || p.y > H + 80) {
      lista.splice(i, 1);
      continue;
    }
    const ar = Math.exp(-p.arrasto * dt);
    p.vx *= ar;
    p.vy *= ar;
    p.vy += p.gravidade * dt;
    p.x += p.vx * dt + (p.balanco ? Math.sin(p.idade * p.balanco) * 40 * dt : 0);
    p.y += p.vy * dt;
    p.giro += p.vgiro * dt;
    p.fase += p.vfase * dt;
    desenhar(g, p);
  }
  g.globalAlpha = 1;
  if (lista.length) requestAnimationFrame(laco);
  else {
    rodando = false;
    g.clearRect(0, 0, W, H);
  }
}

function desenhar(g, p) {
  g.globalAlpha = Math.min(1, p.vida / p.someEm) * p.alfa;
  if (p.tipo === 'confete') {
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.giro);
    // O cosseno da fase é o papel virando no ar: a largura aparente vai a zero
    // e volta, e é isso que separa confete de retângulo caindo.
    g.scale(1, Math.cos(p.fase));
    g.fillStyle = p.cor;
    if (p.redondo) {
      g.beginPath();
      g.arc(0, 0, p.w / 2.4, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    g.restore();
  } else if (p.tipo === 'faisca') {
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = p.cor;
    g.lineWidth = p.w;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(p.x, p.y);
    g.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
    g.stroke();
    g.globalCompositeOperation = 'source-over';
  } else if (p.tipo === 'fumaca') {
    const r = Math.max(1, p.r0 + p.idade * p.cresce);
    const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    grad.addColorStop(0, `rgba(${p.tom}, ${p.tom}, ${p.tom + 8}, .55)`);
    grad.addColorStop(1, `rgba(${p.tom}, ${p.tom}, ${p.tom + 8}, 0)`);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(p.x, p.y, r, 0, Math.PI * 2);
    g.fill();
  }
}

/**
 * Um canhão de confete. `angulo` em graus, 0 = direita, -90 = para cima.
 * Coordenadas em px do palco (1920x1080), qualquer que seja a janela.
 */
export function confete({ x, y, angulo, espalha = 28, forca = 1900, n = 150 }) {
  if (menosMovimento()) return;
  for (let i = 0; i < n; i++) {
    const a = ((angulo + (Math.random() - 0.5) * espalha) * Math.PI) / 180;
    const v = forca * aleatorio(0.5, 1.15);
    lista.push({
      tipo: 'confete',
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      gravidade: aleatorio(850, 1150),
      arrasto: aleatorio(1.4, 2.6),
      balanco: aleatorio(2, 5),
      giro: Math.random() * 6.28,
      vgiro: aleatorio(-9, 9),
      fase: Math.random() * 6.28,
      vfase: aleatorio(6, 16),
      w: aleatorio(10, 20),
      h: aleatorio(6, 12),
      redondo: Math.random() < 0.18,
      cor: CORES[(Math.random() * CORES.length) | 0],
      vida: aleatorio(3.2, 4.8),
      idade: 0,
      someEm: 0.9,
      alfa: 1,
    });
  }
  acordar();
}

/** Uma rajada de faíscas a partir de (x, y). */
export function faiscas({ x, y, n = 40, cores = ['#FFF3B0', '#FFD84D', '#FFFFFF'], forca = 900 }) {
  if (menosMovimento()) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = forca * aleatorio(0.35, 1.1);
    lista.push({
      tipo: 'faisca',
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 200,
      gravidade: 900,
      arrasto: 2.8,
      giro: 0,
      vgiro: 0,
      fase: 0,
      vfase: 0,
      w: aleatorio(2, 4),
      cor: cores[(Math.random() * cores.length) | 0],
      vida: aleatorio(0.45, 0.9),
      idade: 0,
      someEm: 0.35,
      alfa: 1,
    });
  }
  acordar();
}

/** Fumaça subindo de (x, y) — o motor que estourou no fim do tempo. */
export function fumaca({ x, y, n = 26 }) {
  if (menosMovimento()) return;
  for (let i = 0; i < n; i++) {
    lista.push({
      tipo: 'fumaca',
      x: x + aleatorio(-40, 40),
      y: y + aleatorio(-20, 30),
      vx: aleatorio(-80, 80),
      vy: aleatorio(-170, -60),
      gravidade: -30,
      arrasto: 0.6,
      giro: 0,
      vgiro: 0,
      fase: 0,
      vfase: 0,
      r0: aleatorio(20, 44),
      cresce: aleatorio(60, 110),
      tom: aleatorio(120, 175) | 0,
      vida: aleatorio(1.6, 2.6),
      idade: 0,
      someEm: 1.2,
      alfa: 1,
    });
  }
  acordar();
}

/** Tudo some de uma vez — recomeço de partida, volta ao cadastro. */
export function limparParticulas() {
  lista.length = 0;
  contexto()?.clearRect(0, 0, W, H);
}

/** O centro de um elemento em px do palco, qualquer que seja a escala da janela. */
export function noPalco(no) {
  const stage = document.getElementById('stage');
  if (!stage || !no) return [W / 2, H / 2];
  const st = stage.getBoundingClientRect();
  const b = no.getBoundingClientRect();
  const k = st.width / W || 1;
  return [(b.left - st.left + b.width / 2) / k, (b.top - st.top + b.height / 2) / k];
}
