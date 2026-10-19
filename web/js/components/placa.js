// A placa Mercosul com o nome do veículo no lugar dos caracteres.
//
// É um detalhe que o mecânico reconhece de longe: a faixa azul com "BRASIL", o
// selo do Mercosul à esquerda e a bandeira à direita. A placa de verdade tem
// largura fixa; esta cresce com o nome, porque o baralho tem "BYD" e tem
// "Mercedes Accelo 917", e um nome encolhido até sumir não serve a ninguém.
//
// Mas o nome é texto livre do painel (já houve pergunta inteira no lugar do
// veículo), e uma placa que só cresce passa da caixa que a contém e é aparada:
// sem quebra de linha o nome saía cortado. Acima de LETRAS_SEM_ENCOLHER a letra
// diminui, até ESCALA_MINIMA, e o resto quebra em linhas — o nome de fábrica
// mais comprido (19 letras) continua exatamente como era.

import { el, fonte } from '../widgets.js';

const LETRAS_SEM_ENCOLHER = 22;
const ESCALA_MINIMA = 0.5;

/**
 * @param {string} texto o nome do veículo
 * @param {object} [opcoes]
 * @param {number} [opcoes.tamanho] a altura dos caracteres, em px do palco
 */
export function PlacaMercosul(texto, { tamanho = 42 } = {}) {
  const escala = Math.max(ESCALA_MINIMA, Math.min(1, LETRAS_SEM_ENCOLHER / (texto?.length || 1)));
  tamanho = Math.round(tamanho * escala);
  return el('div', { class: 'aud-placa', role: 'img', 'aria-label': texto }, [
    el('div', { class: 'aud-placa-faixa' }, [
      el('i', { class: 'aud-placa-mercosul' }),
      el('span', { text: 'BRASIL', style: { fontSize: fonte(12) } }),
      el('i', { class: 'aud-placa-bandeira' }),
    ]),
    // Maiúsculas pelo CSS (`text-transform`), e não no texto: o nome continua o
    // do baralho para quem o lê por programa — leitor de tela, os testes.
    el('div', { class: 'ff-text aud-placa-texto', text: texto ?? '', style: { fontSize: fonte(tamanho) } }),
  ]);
}
