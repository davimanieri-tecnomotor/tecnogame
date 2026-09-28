// A sonoplastia do jogo, sintetizada na hora pela Web Audio.
//
// POR QUE SINTETIZAR. Até a 2.x o jogo tocava mp3 de terceiros (ver o
// cabeçalho de audio.js). Som gerado não precisa de licença, não pesa no
// download, toca por `file://` — onde a Web Audio não busca arquivo — e pode
// acompanhar o jogo: a trilha da pergunta sobe de andamento com o relógio, o
// tique sobe de nota a cada segundo, o aplauso nasce com a duração que a
// festa pede.
//
// DUAS FAMÍLIAS DE VOZ, e a diferença importa:
//
//   - de OSCILADOR (sino, bumbo, blip, metais, varredura...): não criam
//     `AudioBufferSourceNode`;
//   - de RUÍDO (whoosh, prato, aplauso, digitar, estouro...): tocam um buffer
//     de ruído branco filtrado.
//
// Na tela da roleta só entra voz de oscilador. O verify/estalo.mjs escuta todo
// `AudioBufferSourceNode.start` durante o giro para contar os estalos da roda,
// um por divisa — um whoosh de ruído ali seria contado como estalo, e com razão:
// é um som que não é o da roda. Cada voz abaixo diz de qual família é.
//
// Tudo passa pelo barramento de audio.js: o volume e o mudo do operador valem
// para todo som do jogo. E todo instante é marcado no relógio do áudio — nunca
// no quadro da tela, que arredonda para a grade de 16ms (a lição da roleta, ver
// o CLAUDE.md).

import { barramento, contextoDeAudio } from './audio.js';

let ruido = null;

/** Dois segundos de ruído branco, gerados uma vez; cada voz lê de um ponto sorteado. */
function bufferDeRuido(ctx) {
  if (ruido) return ruido;
  ruido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = ruido.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ruido;
}

/** O barramento acordado, ou null sem Web Audio. */
function pronto() {
  const b = barramento();
  if (!b) return null;
  if (b.ctx.state === 'suspended') b.ctx.resume().catch(() => {});
  return b;
}

const agora = () => contextoDeAudio()?.currentTime ?? 0;

/** Ataque rápido e queda exponencial: o que separa "instrumento" de "bipe". */
function envelope(g, t, ataque, pico, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(pico, 0.0002), t + Math.max(0.001, ataque));
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(ataque + 0.01, dur));
}

function ligar(b, no, o) {
  no.connect(o.bus || b.saida);
  if (o.molhado > 0) {
    const envio = b.ctx.createGain();
    envio.gain.value = o.molhado;
    no.connect(envio);
    envio.connect(b.sala);
  }
}

/** Uma nota de oscilador. `t` no relógio do áudio. */
function osc(tipo, f, t, dur, vol, o = {}) {
  const b = pronto();
  if (!b) return null;
  const { ctx } = b;
  const n = ctx.createOscillator();
  n.type = tipo;
  n.frequency.setValueAtTime(f, t);
  if (o.glide) n.frequency.exponentialRampToValueAtTime(o.glide, t + (o.glideEm ?? dur));
  if (o.detune) n.detune.value = o.detune;
  const g = ctx.createGain();
  envelope(g, t, o.ataque ?? 0.005, vol, dur);
  let fim = n;
  if (o.filtro) {
    const fi = ctx.createBiquadFilter();
    fi.type = o.filtro.tipo || 'lowpass';
    fi.Q.value = o.filtro.q ?? 0.7;
    fi.frequency.setValueAtTime(o.filtro.f, t);
    if (o.filtro.ate) fi.frequency.exponentialRampToValueAtTime(o.filtro.ate, t + (o.filtro.em ?? dur));
    n.connect(fi);
    fim = fi;
  }
  fim.connect(g);
  ligar(b, g, o);
  n.start(t);
  n.stop(t + dur + 0.1);
  return n;
}

/** Ruído branco filtrado — voz de RUÍDO: cria um AudioBufferSourceNode. */
function chiado(t, dur, vol, o = {}) {
  const b = pronto();
  if (!b) return;
  const { ctx } = b;
  const s = ctx.createBufferSource();
  s.buffer = bufferDeRuido(ctx);
  s.loop = true;
  const fi = ctx.createBiquadFilter();
  fi.type = o.tipo || 'bandpass';
  fi.Q.value = o.q ?? 1;
  fi.frequency.setValueAtTime(o.f ?? 1000, t);
  if (o.ate) fi.frequency.exponentialRampToValueAtTime(o.ate, t + (o.em ?? dur));
  const g = ctx.createGain();
  envelope(g, t, o.ataque ?? 0.005, vol, dur);
  s.connect(fi);
  fi.connect(g);
  ligar(b, g, o);
  s.start(t, Math.random() * 1.8);
  s.stop(t + dur + 0.1);
}

/** Um instante do relógio da tela (performance.now, ms) no relógio do áudio. */
export function audioEm(perfMs) {
  const ctx = contextoDeAudio();
  return ctx ? ctx.currentTime + (perfMs - performance.now()) / 1000 : 0;
}

/* ================================================================ vozes */

/**
 * As vozes. `em` é quanto depois de agora, em segundos.
 *
 * Os volumes foram acertados uns contra os outros com o barramento em 0,9: a
 * fanfarra e o impacto são o teto, os sinais de interface ficam bem abaixo,
 * para um toque na tela nunca soar mais alto que a festa de um acerto.
 */
export const Som = {
  /** O toque de interface — OSCILADOR. No lugar do clique gravado de antes. */
  clique(em = 0) {
    osc('triangle', 1250, agora() + em, 0.05, 0.07, { glide: 900, glideEm: 0.04, ataque: 0.001 });
  },

  /** Escolha e confirmação — OSCILADOR. Duas notas que sobem: "foi". */
  selecionar(em = 0) {
    const t = agora() + em;
    osc('square', 660, t, 0.07, 0.05, { ataque: 0.002, filtro: { f: 2600 } });
    osc('square', 990, t + 0.06, 0.1, 0.05, { ataque: 0.002, filtro: { f: 3200 }, molhado: 0.2 });
  },

  /** Sino de estúdio, com parciais inarmônicas — OSCILADOR. */
  sino(f, em = 0, vol = 0.16) {
    const t = agora() + em;
    osc('sine', f, t, 1.6, vol, { molhado: 0.55, ataque: 0.002 });
    osc('sine', f * 2.01, t, 0.7, vol * 0.3, { molhado: 0.4, ataque: 0.002 });
    osc('sine', f * 3.03, t, 0.3, vol * 0.14, { ataque: 0.002 });
    osc('triangle', f * 4.1, t, 0.12, vol * 0.08, { ataque: 0.001 });
  },

  /** O grave de pancada: seno que despenca de nota — OSCILADOR. */
  bumbo(em = 0, vol = 0.6, de = 150, ate = 42, dur = 0.5) {
    osc('sine', de, agora() + em, dur, vol, { glide: ate, glideEm: dur * 0.6, ataque: 0.002 });
  },

  /** Prato — RUÍDO. */
  prato(em = 0, vol = 0.1, dur = 1.4) {
    chiado(agora() + em, dur, vol, { tipo: 'highpass', f: 6500, q: 0.4, ataque: 0.002, molhado: 0.35 });
  },

  /** O vento de passagem — RUÍDO. Fora da roleta; lá, use `varrer`. */
  whoosh(em = 0, dur = 0.5, vol = 0.22, sobe = true) {
    chiado(agora() + em, dur, vol, {
      f: sobe ? 280 : 2800,
      ate: sobe ? 3400 : 240,
      q: 1.6,
      ataque: dur * 0.65,
      molhado: 0.25,
    });
  },

  /**
   * A passagem sem ruído — OSCILADOR. Uma serra filtrada que varre para cima:
   * soa como o whoosh e pode tocar na roleta (ver o cabeçalho).
   */
  varrer(em = 0, dur = 0.45, vol = 0.07, sobe = true) {
    osc('sawtooth', sobe ? 90 : 420, agora() + em, dur, vol, {
      glide: sobe ? 420 : 90,
      ataque: dur * 0.5,
      filtro: { f: sobe ? 300 : 2400, ate: sobe ? 2400 : 300, q: 3 },
      molhado: 0.3,
    });
  },

  /** A pancada do apresentador: bumbo + ruído grave + prato — RUÍDO. */
  impacto(em = 0, vol = 1) {
    Som.bumbo(em, 0.75 * vol, 130, 38, 0.7);
    chiado(agora() + em, 0.35, 0.28 * vol, { tipo: 'lowpass', f: 2600, ate: 200, q: 0.8, ataque: 0.002 });
    Som.prato(em, 0.09 * vol, 1.6);
  },

  /** Um batimento, "tum-tum" — OSCILADOR. */
  batimento(em = 0, vol = 0.55) {
    Som.bumbo(em, vol, 95, 36, 0.24);
    Som.bumbo(em + 0.17, vol * 0.72, 85, 34, 0.26);
  },

  /** O relógio parando — RUÍDO. */
  clunk(em = 0) {
    const t = agora() + em;
    osc('square', 190, t, 0.1, 0.22, { glide: 70, ataque: 0.001, filtro: { f: 1400 } });
    chiado(t, 0.06, 0.25, { f: 900, q: 3, ataque: 0.001 });
    Som.bumbo(em, 0.4, 110, 45, 0.3);
  },

  /** A alternativa travando — OSCILADOR. Grave, um filtro que abre e um brilho. */
  travar(em = 0) {
    const t = agora() + em;
    Som.bumbo(em, 0.55, 140, 48, 0.45);
    osc('sawtooth', 110, t, 0.55, 0.07, { filtro: { f: 400, ate: 2600, em: 0.35, q: 4 } });
    osc('sine', 1760, t + 0.02, 0.35, 0.05, { molhado: 0.5 });
  },

  /** Um estouro de bolha — OSCILADOR. */
  pop(em = 0, f = 620) {
    osc('sine', f, agora() + em, 0.14, 0.16, { glide: f * 1.7, glideEm: 0.08, ataque: 0.002, molhado: 0.2 });
  },

  /** Um "blip" de marcador que desce (ou sobe) — OSCILADOR. */
  blip(em = 0, sobe = false) {
    osc('triangle', sobe ? 520 : 900, agora() + em, 0.18, 0.12, { glide: sobe ? 900 : 430, ataque: 0.003 });
  },

  /** Arpejo rápido que brilha — OSCILADOR. */
  brilho(em = 0) {
    [1318.5, 1568, 2093, 2637, 3136].forEach((f, i) =>
      osc('sine', f, agora() + em + i * 0.045, 0.35, 0.07, { molhado: 0.6, ataque: 0.002 })
    );
  },

  /** Mensagem chegando — OSCILADOR. */
  mensagem(em = 0) {
    osc('sine', 880, agora() + em, 0.09, 0.12, { ataque: 0.002 });
    osc('sine', 1320, agora() + em + 0.09, 0.14, 0.12, { ataque: 0.002, molhado: 0.3 });
  },

  /** Uma tecla sendo digitada — RUÍDO. */
  digitar(em = 0) {
    chiado(agora() + em, 0.018, 0.05, { tipo: 'highpass', f: 2600, q: 0.7, ataque: 0.001 });
  },

  /** Chamando: 425 Hz é o tom de chamada da telefonia brasileira — OSCILADOR. */
  chamar(em = 0) {
    for (let k = 0; k < 2; k++) osc('sine', 425, agora() + em + k * 0.45, 0.3, 0.08, { ataque: 0.01 });
  },

  /** "Metais": duas serras desafinadas e um filtro que abre como sopro — OSCILADOR. */
  metal(f, t, dur, vol) {
    for (const d of [-8, 8]) {
      osc('sawtooth', f, t, dur, vol, { detune: d, ataque: 0.02, filtro: { f: 700, ate: 3200, em: 0.08, q: 1.2 }, molhado: 0.35 });
    }
  },

  /** A fanfarra do acerto — RUÍDO (tem prato). */
  fanfarra(em = 0) {
    const t = agora() + em;
    [392, 523.25, 659.25, 783.99].forEach((f, i) => Som.metal(f, t + i * 0.11, 0.2, 0.05));
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => Som.metal(f, t + 0.47, 1.7, 0.042));
    Som.bumbo(em + 0.47, 0.7, 120, 40, 0.8);
    Som.prato(em + 0.47, 0.11, 2.2);
    [2093, 2637, 3136, 2637, 3520].forEach((f, i) =>
      osc('sine', f, t + 0.55 + i * 0.13 + Math.random() * 0.05, 0.5, 0.045, { molhado: 0.7, ataque: 0.002 })
    );
  },

  /**
   * Aplauso granular — RUÍDO: centenas de palmas de ruído, cada uma num filtro
   * e num instante sorteados, mais um fundo de plateia. Sem gravação nenhuma.
   */
  aplauso(em = 0, dur = 3.4, forca = 1) {
    const t = agora() + em;
    chiado(t, dur + 0.6, 0.05 * forca, { f: 1500, q: 0.35, ataque: 0.35, molhado: 0.3 });
    const palmas = Math.round(110 * dur * forca);
    for (let i = 0; i < palmas; i++) {
      const ti = t + 0.04 + dur * Math.pow(Math.random(), 1.25);
      const k = 1 - (ti - t) / (dur + 0.2);
      chiado(ti, 0.012 + Math.random() * 0.02, 0.1 * forca * Math.pow(Math.max(k, 0.05), 0.8) * (0.4 + Math.random() * 0.6), {
        f: 800 + Math.random() * 2400,
        q: 1.1,
        ataque: 0.001,
        molhado: 0.25,
      });
    }
  },

  /**
   * O erro sem deboche — OSCILADOR: três notas que descem e um baque. Quem
   * joga é cliente em potencial, e não motivo de piada.
   */
  derrota(em = 0) {
    const t = agora() + em;
    Som.bumbo(em, 0.6, 90, 32, 0.9);
    [[329.63, 0, 0.3], [261.63, 0.24, 0.3], [220, 0.48, 1.1]].forEach(([f, d, dur]) => {
      for (const dt of [-10, 10]) {
        osc('sawtooth', f, t + d, dur, 0.045, {
          detune: dt,
          ataque: 0.02,
          glide: d > 0.4 ? f * 0.94 : null,
          glideEm: dur,
          filtro: { f: 1300, q: 0.9 },
          molhado: 0.4,
        });
      }
    });
  },

  /** Alarme de dois tons — OSCILADOR. */
  alarme(em = 0) {
    for (let k = 0; k < 6; k++) osc('square', k % 2 ? 740 : 988, agora() + em + k * 0.15, 0.14, 0.075, { ataque: 0.002, filtro: { f: 3200 } });
  },

  /** O motor estourando no fim do tempo — RUÍDO. */
  estouro(em = 0) {
    const t = agora() + em;
    chiado(t, 1.1, 0.55, { tipo: 'lowpass', f: 3000, ate: 160, q: 0.7, ataque: 0.003 });
    Som.bumbo(em, 0.9, 80, 28, 1.0);
    for (let i = 0; i < 16; i++) chiado(t + 0.05 + Math.random() * 0.9, 0.01, 0.3 * Math.random(), { tipo: 'highpass', f: 2500, ataque: 0.001 });
  },

  /**
   * O ronco da partida — OSCILADOR: o conta-giros varre a escala como painel de
   * carro ligando, e o motor acompanha subindo e voltando.
   */
  ronco(em = 0, dur = 1.3) {
    const b = pronto();
    if (!b) return;
    const { ctx } = b;
    const t = ctx.currentTime + em;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.12);
    g.gain.setValueAtTime(0.14, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const fi = ctx.createBiquadFilter();
    fi.type = 'lowpass';
    fi.frequency.setValueAtTime(500, t);
    fi.frequency.exponentialRampToValueAtTime(2400, t + dur * 0.45);
    fi.frequency.exponentialRampToValueAtTime(600, t + dur);
    fi.connect(g);
    g.connect(b.saida);
    for (const [tipo, k] of [['sawtooth', 1], ['square', 0.5]]) {
      const o = ctx.createOscillator();
      o.type = tipo;
      o.frequency.setValueAtTime(84 * k, t);
      o.frequency.exponentialRampToValueAtTime(300 * k, t + dur * 0.45);
      o.frequency.exponentialRampToValueAtTime(96 * k, t + dur);
      o.connect(fi);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  },

  /** O odômetro rolando — OSCILADOR: tiques que sobem de nota. */
  rolagem(em = 0, n = 18, dur = 0.9) {
    for (let i = 0; i < n; i++) osc('square', 700 + i * 40, agora() + em + (i / n) * dur, 0.06, 0.05, { ataque: 0.002, filtro: { f: 3800 } });
  },

  /**
   * A lâmina da troca de tela — RUÍDO: um sopro que sobe e um brilho no fim.
   * Toca a cada troca, sete vezes por partida, e por isso é baixa: é a
   * assinatura do jogo, não um efeito para ser notado.
   */
  lamina(em = 0) {
    Som.whoosh(em, 0.62, 0.14);
    osc('sine', 1568, agora() + em + 0.34, 0.4, 0.028, { molhado: 0.6, ataque: 0.004 });
  },

  /** O "parou!" da roleta — OSCILADOR: três sinos e um brilho. */
  dingDingDing(em = 0) {
    [1318.5, 1567.98, 2093].forEach((f, i) => Som.sino(f, em + i * 0.13, 0.12));
    Som.brilho(em + 0.42);
  },

  /** O carimbo de "incompatível" — OSCILADOR: um baque seco e um zumbido curto. */
  carimbo(em = 0) {
    const t = agora() + em;
    Som.bumbo(em, 0.5, 170, 60, 0.18);
    osc('square', 118, t + 0.03, 0.32, 0.06, { ataque: 0.004, filtro: { f: 900 } });
    osc('square', 124, t + 0.03, 0.32, 0.05, { ataque: 0.004, filtro: { f: 900 } });
  },

  /**
   * A vinheta de transição — RUÍDO. No lugar do tema do Jaspion que tocava junto
   * do vídeo de abertura: uma subida, três pancadas de metais e o acorde maior
   * que fica, com brilho por cima. Cabe nos quatro segundos do vídeo.
   */
  vinheta(em = 0) {
    const t = agora() + em;
    Som.whoosh(em, 0.7, 0.2);
    [[392, 0.62], [523.25, 0.86], [659.25, 1.1]].forEach(([f, d]) => {
      Som.metal(f, t + d, 0.18, 0.05);
      Som.bumbo(em + d, 0.45, 120, 45, 0.3);
    });
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => Som.metal(f, t + 1.36, 2.1, 0.04));
    Som.bumbo(em + 1.36, 0.75, 130, 38, 0.9);
    Som.prato(em + 1.36, 0.12, 2.4);
    [2093, 2637, 3136, 3520, 4186].forEach((f, i) =>
      osc('sine', f, t + 1.45 + i * 0.12, 0.6, 0.04, { molhado: 0.7, ataque: 0.002 })
    );
  },

  /**
   * O suspense antes do veredito — RUÍDO. Um zumbido grave, um filtro que abre,
   * um ruído que sobe e um batimento que acelera. Devolve quem o corta e os
   * instantes das batidas, para a tela pulsar junto.
   */
  suspense(dur = 2.6) {
    const batidas = [0.12, 0.8, 1.36, 1.82, 2.2, 2.48].filter((x) => x < dur);
    const b = pronto();
    if (!b) return { batidas, cortar() {} };
    const { ctx } = b;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.4);
    g.connect(b.saida);
    const a = ctx.createOscillator();
    a.type = 'sine';
    a.frequency.value = 55;
    const ga = ctx.createGain();
    ga.gain.value = 0.22;
    a.connect(ga).connect(g);
    a.start(t);
    const c = ctx.createOscillator();
    c.type = 'sawtooth';
    c.frequency.value = 110;
    const fc = ctx.createBiquadFilter();
    fc.type = 'lowpass';
    fc.frequency.setValueAtTime(180, t);
    fc.frequency.exponentialRampToValueAtTime(700, t + dur);
    const gc = ctx.createGain();
    gc.gain.value = 0.07;
    c.connect(fc).connect(gc).connect(g);
    c.start(t);
    chiado(t, dur, 0.13, { f: 260, ate: 2800, q: 2.2, ataque: dur * 0.92, bus: g });
    batidas.forEach((x) => {
      osc('sine', 95, t + x, 0.24, 0.5, { glide: 36, glideEm: 0.15, ataque: 0.002, bus: g });
      osc('sine', 85, t + x + 0.17, 0.26, 0.36, { glide: 34, glideEm: 0.15, ataque: 0.002, bus: g });
    });
    let cortado = false;
    return {
      batidas,
      cortar(fade = 0.04) {
        if (cortado) return;
        cortado = true;
        const n = ctx.currentTime;
        g.gain.cancelScheduledValues(n);
        g.gain.setValueAtTime(Math.max(g.gain.value, 0.0002), n);
        g.gain.exponentialRampToValueAtTime(0.0001, n + fade);
        setTimeout(() => {
          for (const o of [a, c]) {
            try {
              o.stop();
            } catch (_) {
              /* já parou */
            }
          }
          g.disconnect();
        }, (fade + 0.2) * 1000);
      },
    };
  },
};

/* ============================================================= a trilha */

/**
 * A trilha da pergunta, gerada na hora e marcada adiante no relógio do áudio
 * (um agendador que olha 150ms à frente a cada 25ms: o som toca no
 * milissegundo mesmo que a tela soluce).
 *
 * Três níveis. O tempo apertando sobe o andamento, abre o filtro e soma
 * camadas — é o que o ouvido percebe como "está acabando" sem ninguém olhar o
 * relógio, e é o mesmo recurso da trilha do Milionário, que sobe de camada a
 * cada patamar. O nível 2 traz o semitom que vai e volta: o motivo de suspense
 * mais velho do cinema.
 */
const BPM = [96, 112, 132];
const CORTE = [520, 900, 1500];

export const Trilha = (() => {
  let bus = null;
  let pad = null;
  let timer = null;
  let prox = 0;
  let passo = 0;
  let nivel = 0;
  let abafada = false;

  function tocar(i, t) {
    const k = abafada ? 0.3 : 1;
    if (i % 4 === 0) osc('sine', 110, t, 0.34, 0.3 * k, { glide: 40, glideEm: 0.2, ataque: 0.002, bus });
    if (i % 8 === 6) osc('sine', 100, t, 0.26, 0.18 * k, { glide: 40, glideEm: 0.18, ataque: 0.002, bus });
    if (nivel >= 1) chiado(t, 0.035, (i % 2 ? 0.035 : 0.018) * k, { tipo: 'highpass', f: 7800, q: 0.6, ataque: 0.001, bus });
    if (nivel >= 2) {
      const f = Math.floor(i / 2) % 2 ? 233.08 : 220;
      osc('sawtooth', f, t, 0.15, 0.045 * k, { ataque: 0.004, filtro: { f: 1900, q: 1 }, bus });
    }
  }

  function agendar() {
    const ctx = contextoDeAudio();
    if (!ctx || !bus) return;
    while (prox < ctx.currentTime + 0.15) {
      tocar(passo, prox);
      prox += 60 / BPM[nivel] / 2;
      passo++;
    }
  }

  return {
    iniciar() {
      const b = pronto();
      if (!b) return;
      this.parar(0.01);
      const { ctx } = b;
      const t = ctx.currentTime;
      bus = ctx.createGain();
      bus.gain.setValueAtTime(0.0001, t);
      bus.gain.exponentialRampToValueAtTime(0.85, t + 1.2);
      bus.connect(b.saida);
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.frequency.value = CORTE[0];
      filtro.Q.value = 0.9;
      const gPad = ctx.createGain();
      gPad.gain.value = 0.035;
      filtro.connect(gPad);
      gPad.connect(bus);
      const envio = ctx.createGain();
      envio.gain.value = 0.35;
      gPad.connect(envio);
      envio.connect(b.sala);
      // Lá menor aberto — A2, E3, A3, C4 —, cada nota em duas serras desafinadas.
      const oscs = [];
      for (const f of [110, 164.81, 220, 261.63]) {
        for (const d of [-7, 7]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = f;
          o.detune.value = d;
          o.connect(filtro);
          o.start(t);
          oscs.push(o);
        }
      }
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.13;
      const lg = ctx.createGain();
      lg.gain.value = 160;
      lfo.connect(lg);
      lg.connect(filtro.frequency);
      lfo.start(t);
      pad = { oscs, lfo, filtro };
      nivel = 0;
      abafada = false;
      prox = t + 0.08;
      passo = 0;
      timer = setInterval(agendar, 25);
    },

    /** 0 (folga), 1 (metade do tempo) ou 2 (reta final). */
    definirNivel(n) {
      if (n === nivel) return;
      nivel = n;
      const ctx = contextoDeAudio();
      if (pad && ctx) pad.filtro.frequency.setTargetAtTime(abafada ? 300 : CORTE[n], ctx.currentTime, 0.6);
    },

    /** Abafa enquanto o jogador decide no "Está certo disso?". */
    abafar(sim) {
      abafada = sim;
      const ctx = contextoDeAudio();
      if (!ctx || !bus) return;
      bus.gain.setTargetAtTime(sim ? 0.4 : 0.85, ctx.currentTime, 0.12);
      pad?.filtro.frequency.setTargetAtTime(sim ? 300 : CORTE[nivel], ctx.currentTime, 0.2);
    },

    parar(fade = 0.3) {
      clearInterval(timer);
      timer = null;
      const ctx = contextoDeAudio();
      if (!ctx || !bus) return;
      const b = bus;
      const p = pad;
      bus = null;
      pad = null;
      const t = ctx.currentTime;
      b.gain.cancelScheduledValues(t);
      b.gain.setValueAtTime(Math.max(b.gain.value, 0.0002), t);
      b.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.01, fade));
      setTimeout(() => {
        p?.oscs.forEach((o) => o.stop());
        p?.lfo.stop();
        b.disconnect();
      }, (fade + 0.25) * 1000);
    },
  };
})();
