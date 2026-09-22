// O estalo da roleta: quantos, e quando.
//
// A suíte de navegador (verify/estalo.mjs) ouve um giro de verdade e confere
// que cada estalo cai onde a tela mostra a divisa passando. Cada giro ali
// custa sete segundos e sai de um sorteio só; aqui a conta vale para todo
// tamanho de baralho e toda fatia que o sorteio pode dar.

import test from 'node:test';
import assert from 'node:assert/strict';

import { efeitosDoGiro, estalosDoGiro } from '../../web/js/giro.js';
import { voltaDoIndice } from '../../web/js/functions.js';

const BARALHOS = [1, 2, 3, 7, 10, 12, 20, 40];

/** Cada volta que o sorteio pode pedir num baralho de `n` fatias. */
const sorteios = (n) => Array.from({ length: n }, (_, k) => voltaDoIndice(k, n));

/** O ângulo (em voltas) que a animação desenha no instante `t`. */
function anguloDesenhado(efeitos, t) {
  const trecho = efeitos.find((e) => t <= e.delay + e.duration) ?? efeitos[efeitos.length - 1];
  return trecho.begin + ((t - trecho.delay) / trecho.duration) * (trecho.end - trecho.begin);
}

test('um estalo por divisa que cruza a seta, para todo baralho e toda fatia', () => {
  for (const n of BARALHOS) {
    for (const voltas of sorteios(n)) {
      // A roda para no meio da fatia sorteada depois de `voltas` + 3 voltas
      // inteiras: são (voltas + 3) * N fatias, e cada fatia é uma divisa.
      assert.equal(estalosDoGiro(voltas, n).length, Math.round((voltas + 3) * n), `N=${n} voltas=${voltas}`);
    }
  }
});

test('cada estalo cai no instante em que a animação põe a divisa sob a seta', () => {
  // É a mesma meia fatia do `u` da lingueta: a divisa j fica em (j - 1/2)/N
  // voltas. Um estalo calculado por fora da trajetória desenhada — da curva
  // contínua, digamos, em vez dos trechos que a animação interpola — erra por
  // milésimos de volta e reprova aqui.
  for (const n of BARALHOS) {
    for (const voltas of sorteios(n)) {
      const efeitos = efeitosDoGiro(voltas, n);
      estalosDoGiro(voltas, n).forEach((t, i) => {
        const divisa = (i + 0.5) / n;
        const erro = Math.abs(anguloDesenhado(efeitos, t) - divisa);
        assert.ok(erro < 1e-9, `N=${n} voltas=${voltas}: o estalo ${i} cai a ${erro} volta da divisa`);
      });
    }
  }
});

test('o compasso acelera com a roda e depois só freia, sem tropeço', () => {
  // Estalo marcado no quadro que mostra a divisa passada, e não no instante
  // dela, arredondava cada um para a grade de 16ms: o intervalo ia e voltava
  // em vez de encolher e depois crescer.
  for (const n of BARALHOS) {
    for (const voltas of sorteios(n)) {
      const t = estalosDoGiro(voltas, n);
      const intervalos = t.slice(1).map((x, i) => x - t[i]);
      const pico = intervalos.indexOf(Math.min(...intervalos));
      for (let i = 1; i < intervalos.length; i++) {
        const [antes, agora] = [intervalos[i - 1], intervalos[i]];
        const ok = i <= pico ? agora <= antes + 1e-6 : agora >= antes - 1e-6;
        assert.ok(ok, `N=${n} voltas=${voltas}: intervalo ${i} foi de ${antes}ms para ${agora}ms`);
      }
    }
  }
});
