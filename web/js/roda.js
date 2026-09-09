// A roleta desenhada em SVG, para baralhos que não são o original.
//
// A arte que vem do FlutterFlow é um PNG único com dez fatias de 36°, cada uma
// com a foto de um veículo desenhada dentro. Enquanto a lista de veículos é
// aquela, o PNG é usado — é pixel-idêntico ao jogo original. Quando a área
// administrativa troca, adiciona ou remove um veículo, o PNG passaria a mostrar
// carro que não está mais em jogo, e aí esta roda entra no lugar.
//
// O desenho segue a arte original de perto: alternância azul/dourado, aro com
// lâmpadas, fatia 0 apontada para baixo (é onde fica a seta) e a foto de cada
// veículo dentro da sua fatia.

const NS = 'http://www.w3.org/2000/svg';

/** As duas cores das fatias, amostradas da arte original. */
const AZUL = '#0d8ce8';
const DOURADO = '#e5a83c';
const ARO = '#c8892c';
const LAMPADA = '#ffd97a';

const svg = (tag, attrs = {}) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null) node.setAttribute(k, String(v));
  }
  return node;
};

/**
 * O caminho de uma fatia: do centro até a borda, arco, e volta.
 * Os ângulos estão em graus, medidos do eixo x, como no SVG.
 */
function fatia(cx, cy, r, de, ate) {
  const rad = (g) => (g * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(de));
  const y1 = cy + r * Math.sin(rad(de));
  const x2 = cx + r * Math.cos(rad(ate));
  const y2 = cy + r * Math.sin(rad(ate));
  const arcoGrande = ate - de > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${arcoGrande} 1 ${x2} ${y2} Z`;
}

/**
 * @param {Array} slots as rodadas do baralho, na ordem das fatias
 * @returns {SVGElement} uma roda do mesmo tamanho que o PNG original
 */
export function rodaGerada(slots) {
  const n = Math.max(slots.length, 1);
  const LADO = 893.2; // o mesmo tamanho do PNG original
  const c = LADO / 2;
  const rFatia = c * 0.94;
  const rAro = c * 0.985;

  const root = svg('svg', {
    viewBox: `0 0 ${LADO} ${LADO}`,
    width: 864.3,
    height: LADO,
    role: 'img',
    'aria-label': `Roleta com ${n} veículo${n === 1 ? '' : 's'}`,
  });
  root.style.display = 'block';
  root.style.flex = 'none';

  // Aro externo com as lâmpadas, como na arte original.
  root.appendChild(svg('circle', { cx: c, cy: c, r: rAro, fill: ARO }));

  const passo = 360 / n;
  // A fatia 0 tem de ficar centrada para BAIXO, onde a seta aponta: a rotação
  // de `escolha` voltas termina num múltiplo inteiro de volta mais k/N, então a
  // fatia k para onde a fatia 0 começou.
  const base = 90 - passo / 2;

  const grupo = svg('g');
  root.appendChild(grupo);

  slots.forEach((slot, i) => {
    const de = base + i * passo;
    const ate = de + passo;
    grupo.appendChild(
      svg('path', {
        d: fatia(c, c, rFatia, de, ate),
        fill: i % 2 === 0 ? DOURADO : AZUL,
      })
    );
  });

  // As fotos, uma por fatia. Cada uma é recortada pela própria fatia, para
  // nunca invadir a vizinha nem passar do aro — e o tamanho é limitado pela
  // corda da fatia naquele raio, que é o que aperta quando N cresce.
  const defs = svg('defs');
  root.appendChild(defs);

  slots.forEach((slot, i) => {
    const imagem = slot?.veiculo?.imagem;
    if (!imagem) return;

    const de = base + i * passo;
    const meio = de + passo / 2;
    const rad = (meio * Math.PI) / 180;

    const clipId = `fatia-${i}`;
    const clip = svg('clipPath', { id: clipId });
    clip.appendChild(svg('path', { d: fatia(c, c, rFatia, de, de + passo) }));
    defs.appendChild(clip);

    // Distância do centro em que a foto fica, e o maior quadrado que cabe ali:
    // a corda da fatia nesse raio, com folga, limitada pelo próprio raio.
    const dist = rFatia * 0.6;
    const corda = 2 * dist * Math.sin((passo * Math.PI) / 360);
    const lado = Math.max(24, Math.min(corda * 0.92, rFatia * 0.42));
    const px = c + dist * Math.cos(rad);
    const py = c + dist * Math.sin(rad);

    const g = svg('g', { 'clip-path': `url(#${clipId})` });
    const img = svg('image', {
      href: imagem,
      x: px - lado / 2,
      y: py - lado / 2,
      width: lado,
      height: lado,
      preserveAspectRatio: 'xMidYMid meet',
    });
    // Como na arte original, o carro aponta para fora do centro.
    img.setAttribute('transform', `rotate(${meio - 90} ${px} ${py})`);
    g.appendChild(img);
    grupo.appendChild(g);
  });

  // Lâmpadas do aro: uma em cada divisa de fatia.
  for (let i = 0; i < n; i++) {
    const rad = ((base + i * passo) * Math.PI) / 180;
    grupo.appendChild(
      svg('circle', {
        cx: c + rAro * 0.97 * Math.cos(rad),
        cy: c + rAro * 0.97 * Math.sin(rad),
        r: Math.max(6, (rAro * 0.5) / n),
        fill: LAMPADA,
        stroke: ARO,
        'stroke-width': 2,
      })
    );
  }

  // Miolo, onde o logo da Tecnomotor é sobreposto pela roleta.js.
  root.appendChild(svg('circle', { cx: c, cy: c, r: c * 0.16, fill: ARO }));
  root.appendChild(svg('circle', { cx: c, cy: c, r: c * 0.125, fill: '#ffffff' }));

  return root;
}
