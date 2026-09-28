// O botão de auditório: losango de ouro, com o brilho passando.
//
// É o botão das decisões do jogador — PODE!, SIM, É ESSA!, CONTINUAR. O prata
// é o da recusa (NÃO), para as duas opções nunca parecerem iguais.
//
// Duas caixas, e por um motivo: o botão é recortado em losango (`clip-path`),
// e recorte corta também a sombra de fora. Quem leva o brilho em volta é o
// envelope; o botão de dentro leva a forma, a cor e o toque.
//
// O alvo é o botão inteiro, o que se vê: `.ff-inkwell` com `tabindex`, para o
// teclado alcançá-lo e o `verify:teclado` medir que o alvo cobre a caixa
// pintada. O afundar do toque é `scale`, propriedade separada de `transform`,
// para nunca disputar com uma animação que esteja no elemento.

import { el, fonte } from '../widgets.js';

/**
 * @param {string} texto
 * @param {object} [opcoes]
 * @param {Function} [opcoes.aoTocar]
 * @param {string}  [opcoes.tipo] 'ouro' (padrão) ou 'prata'
 * @param {boolean} [opcoes.pulsa] respira em loop — o botão que o jogo espera
 * @param {boolean} [opcoes.menor] a versão baixa, para painéis cheios
 * @param {string}  [opcoes.acao] vai para `data-acao`, o gancho dos testes e do teclado
 * @returns {HTMLElement} o envelope; o botão é `envelope.botao`
 */
export function BotaoDeAuditorio(texto, { aoTocar = null, tipo = 'ouro', pulsa = false, menor = false, acao = null } = {}) {
  const rotulo = el('span', { class: 'ff-text aud-botao-texto', text: texto, style: { fontSize: fonte(menor ? 25 : 29) } });
  const botao = el(
    'div',
    {
      class: ['ff-inkwell', 'aud-botao', `aud-botao--${tipo}`, menor ? 'aud-botao--menor' : null],
      role: 'button',
      tabindex: '0',
      'aria-label': texto,
      dataAcao: acao,
    },
    rotulo
  );
  const envelope = el(
    'div',
    { class: ['aud-botao-env', `aud-botao-env--${tipo}`, pulsa ? 'aud-botao-env--pulsa' : null] },
    botao
  );

  const disparar = (evento) => {
    evento?.stopPropagation?.();
    if (botao.getAttribute('aria-disabled') === 'true') return;
    aoTocar?.(evento);
  };
  botao.addEventListener('click', disparar);
  botao.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter' || evento.key === ' ' || evento.key === 'Spacebar') {
      evento.preventDefault();
      disparar(evento);
    }
  });
  botao.addEventListener('pointerdown', () => botao.classList.add('aud-apertado'));
  for (const tipoDeEvento of ['pointerup', 'pointerleave', 'pointercancel']) {
    botao.addEventListener(tipoDeEvento, () => botao.classList.remove('aud-apertado'));
  }

  envelope.botao = botao;
  envelope.tocar = () => disparar(null);
  return envelope;
}
