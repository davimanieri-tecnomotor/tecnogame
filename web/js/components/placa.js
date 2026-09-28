// A placa Mercosul com o nome do veículo no lugar dos caracteres.
//
// É um detalhe que o mecânico reconhece de longe: a faixa azul com "BRASIL", o
// selo do Mercosul à esquerda e a bandeira à direita. A placa de verdade tem
// largura fixa; esta cresce com o nome, porque o baralho tem "BYD" e tem
// "Mercedes Accelo 917", e um nome encolhido até sumir não serve a ninguém.

import { el, fonte } from '../widgets.js';

/**
 * @param {string} texto o nome do veículo
 * @param {object} [opcoes]
 * @param {number} [opcoes.tamanho] a altura dos caracteres, em px do palco
 */
export function PlacaMercosul(texto, { tamanho = 42 } = {}) {
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
