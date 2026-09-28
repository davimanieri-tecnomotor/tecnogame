// Texto que cabe na caixa.
//
// O baralho é editado no painel, e uma pergunta pode ter 40 caracteres ou 400.
// Caixa de tamanho fixo com fonte fixa ou sobra buraco ou corta palavra. Aqui a
// fonte começa no tamanho pedido e desce de 1 em 1px até caber — mas nunca
// abaixo do piso de legibilidade (`--piso-fonte` em css/app.css: 12px DE TELA,
// convertidos pela escala do palco). Se nem no piso couber, fica no piso: texto
// legível transbordando é defeito que se vê; texto de 7px é defeito que se
// esconde.

/** O piso de legibilidade, em px do palco, na janela de agora. */
export function pisoDeFonte() {
  const stage = document.getElementById('stage');
  const escala = stage ? Number.parseFloat(getComputedStyle(stage).getPropertyValue('--stage-scale')) : 1;
  return 12 / Math.min(Number.isFinite(escala) && escala > 0 ? escala : 1, 1);
}

/**
 * Ajusta `texto` (um elemento dentro de `caixa`) para caber nela.
 *
 * Mede em pixel, então precisa do elemento no documento e da fonte carregada —
 * ver `quandoNaTela`.
 *
 * @returns {number} o tamanho que ficou, em px
 */
export function caber(caixa, texto, max, min) {
  if (!caixa || !texto) return max;
  const chao = Math.max(min, Math.ceil(pisoDeFonte()));
  let t = Math.max(max, chao);
  texto.style.fontSize = `${t}px`;
  while (t > chao && (texto.offsetHeight > caixa.clientHeight || texto.scrollWidth > caixa.clientWidth + 1)) {
    t -= 1;
    texto.style.fontSize = `${t}px`;
  }
  return t;
}

/**
 * Roda `fn` quando o elemento já está na tela e as fontes carregaram.
 *
 * As telas são montadas FORA do documento — o roteador as insere depois do
 * build —, e medir texto antes disso dá zero. As fontes do jogo são
 * `font-display: block`: medir antes de elas chegarem mede a fonte do sistema.
 */
export function quandoNaTela(no, fn) {
  const tentar = (vezes) => {
    if (!no.isConnected) {
      if (vezes > 0) requestAnimationFrame(() => tentar(vezes - 1));
      return;
    }
    const pronto = document.fonts?.ready ?? Promise.resolve();
    pronto.then(() => {
      if (no.isConnected) fn();
    });
  };
  requestAnimationFrame(() => tentar(30));
}
