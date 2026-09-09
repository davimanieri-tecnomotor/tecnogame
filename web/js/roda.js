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
  // Baralho de uma rodada so: a "fatia" e a volta inteira, e um arco de 360
  // graus comeca e termina no mesmo ponto — o SVG nao desenha nada. Vira um
  // circulo cheio, montado com dois semiarcos.
  if (ate - de >= 360) {
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
  }
  const x1 = cx + r * Math.cos(rad(de));
  const y1 = cy + r * Math.sin(rad(de));
  const x2 = cx + r * Math.cos(rad(ate));
  const y2 = cy + r * Math.sin(rad(ate));
  const arcoGrande = ate - de > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${arcoGrande} 1 ${x2} ${y2} Z`;
}

/**
 * @param {Array} slots as rodadas do baralho, na ordem das fatias
 * @param {{largura: number, altura: number}} caixa a mesma que o PNG ocupa
 * @returns {SVGElement} uma roda do tamanho da caixa, sempre circular
 */
export function rodaGerada(slots, { largura = 836.1, altura = 839.8 } = {}) {
  const n = Math.max(slots.length, 1);
  // O viewBox e quadrado para o disco sair circular; o preserveAspectRatio
  // padrao encaixa esse quadrado na caixa que a roleta.js passa, que e a mesma
  // que o PNG original ocupa — assim a roda nao muda de tamanho quando a area
  // administrativa troca o baralho e o desenho entra no lugar da arte.
  const LADO = 893.2;
  const c = LADO / 2;
  const rFatia = c * 0.94;
  const rAro = c * 0.985;

  const root = svg('svg', {
    viewBox: `0 0 ${LADO} ${LADO}`,
    width: largura,
    height: altura,
    role: 'img',
    'aria-label': `Roleta com ${n} veículo${n === 1 ? '' : 's'}`,
  });
  root.style.display = 'block';
  root.style.flex = 'none';

  // Aro externo com as lâmpadas, como na arte original.
  root.appendChild(svg('circle', { cx: c, cy: c, r: rAro, fill: ARO }));

  const passo = 360 / n;
  // A fatia 0 fica centrada para BAIXO, onde a seta aponta, e as demais correm
  // no sentido ANTI-HORÁRIO — que é como o PNG original as dispõe. A rotação de
  // `escolha` = 1 + k/N voltas é horária, então quem sobra sob a seta é a
  // fatia k. Desenhar no sentido horário espelhava a roda e a fazia parar na
  // fatia -k: a seta mostrava um carro e o jogo abria outro.
  const base = 90 - passo / 2;

  const grupo = svg('g');
  root.appendChild(grupo);

  slots.forEach((slot, i) => {
    const de = base - i * passo;
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

    const de = base - i * passo;
    const meio = de + passo / 2;
    const rad = (meio * Math.PI) / 180;

    const clipId = `fatia-${i}`;
    const clip = svg('clipPath', { id: clipId });
    clip.appendChild(svg('path', { d: fatia(c, c, rFatia, de, de + passo) }));
    defs.appendChild(clip);

    // Distância do centro em que a foto fica, e o maior quadrado que cabe ali:
    // a corda da fatia nesse raio, com folga, limitada pelo próprio raio.
    const dist = rFatia * 0.6;
    // A corda so limita enquanto a fatia e estreita: de meia-volta para cima
    // ela volta a encolher, e em 360 graus zera — o que dava um carro de 24px
    // num baralho de uma rodada so. Dai para cima quem limita e o raio.
    const corda = passo >= 180 ? 2 * dist : 2 * dist * Math.sin((passo * Math.PI) / 360);
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

  // Divisas. Com N par a alternância já separa as fatias sozinha, mas com N
  // ímpar a fatia 0 e a fatia N-1 caem as duas em dourado e se encostam: viram
  // um bloco único do dobro da largura, e a roda passa a mostrar uma rodada a
  // menos do que tem. Duas cores não fecham um ciclo ímpar, então quem separa é
  // um traço em cada divisa — que vale para qualquer N. Vai por cima das fotos
  // porque elas são recortadas pela própria fatia e encostam na divisa.
  if (n > 1) {
    for (let i = 0; i < n; i++) {
      const rad = ((base - i * passo) * Math.PI) / 180;
      grupo.appendChild(
        svg('line', {
          x1: c,
          y1: c,
          x2: c + rFatia * Math.cos(rad),
          y2: c + rFatia * Math.sin(rad),
          stroke: ARO,
          'stroke-width': Math.max(2, LADO / 300),
        })
      );
    }
  }

  // Lâmpadas do aro: uma em cada divisa de fatia.
  for (let i = 0; i < n; i++) {
    const rad = ((base + i * passo) * Math.PI) / 180;
    grupo.appendChild(
      svg('circle', {
        cx: c + rAro * 0.97 * Math.cos(rad),
        cy: c + rAro * 0.97 * Math.sin(rad),
        // O raio nao pode crescer como 1/n: com uma fatia so virava uma bolha
        // de 220px. Fica limitado pelo proprio aro e pelo espaco entre duas
        // lampadas vizinhas, o que impede tanto a bolha quanto a sobreposicao.
        r: Math.max(4, Math.min(rAro * 0.05, (Math.PI * rAro) / (n * 1.8))),
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
