// A roleta desenhada em SVG, para baralhos que não são o original.
//
// A arte que vem do FlutterFlow é um PNG único com dez fatias de 36°, cada uma
// com a foto de um veículo desenhada dentro. Enquanto a lista de veículos é
// aquela, o PNG é usado — é pixel-idêntico ao jogo original. Quando a área
// administrativa troca, adiciona ou remove um veículo, o PNG passaria a mostrar
// carro que não está mais em jogo, e aí esta roda entra no lugar.
//
// O desenho segue a arte original de perto: alternância azul/dourado, aro de
// lâmpadas, fatia 0 apontada para baixo (é onde fica a seta) e a foto de cada
// veículo dentro da sua fatia.

const NS = 'http://www.w3.org/2000/svg';

/** As cores das fatias, amostradas da arte original. */
const AZUL = '#0d8ce8';
const DOURADO = '#e5a83c';
/** A terceira cor, da fatia que sobra quando N é ímpar (ver `corDaFatia`). */
const DOURADO_ESCURO = '#b8801f';
/** O anel do miolo, mais aceso que as fatias — é assim na arte. */
const MIOLO = '#f2a931';
const LAMPADA = '#ffd97a';
const NUCLEO = '#fffdf2';

/**
 * As proporções da arte original (assets/images/Roleta.png), medidas no pixel e
 * escritas como fração do meio-lado do viewBox — que é exatamente meia caixa na
 * tela, porque o viewBox é quadrado e a caixa o recebe com `meet`.
 *
 * Elas existem para o desenho ter o mesmo tamanho que a arte pronta: a roda
 * troca de uma para a outra quando a área administrativa muda os veículos, e um
 * disco maior que o outro faria a roleta mudar de tamanho de uma partida para a
 * seguinte.
 *
 * Quem manda no limite é o brilho, não o disco: as lâmpadas ficam na borda da
 * fatia e o halo delas vai para fora. `R_LUZ + BRILHO * R_LAMPADA` dá 0,9997 —
 * o brilho encosta na borda da caixa e não passa. Com os números antigos passava
 * 13,6px, e o halo saía cortado reto no alto e nos dois lados. O único número
 * que não é o da arte é o BRILHO: na arte o halo se apaga em 2,5 raios da
 * lâmpada, e os últimos 0,4 ficariam para fora da caixa. É onde ele já está
 * transparente, então perder essa ponta não se vê; perder o disco, sim.
 */
const R_FATIA = 0.9165; //        onde a fatia acaba
const R_LUZ = 0.92; //            onde ficam as lâmpadas do aro, na borda da fatia
const R_LAMPADA = 0.0385; //      o raio de uma lâmpada do aro
const BRILHO = 2.07; //           o halo de uma lâmpada, em raios dela
const R_MIOLO = 0.195; //         o anel dourado do miolo
const R_MIOLO_LUZ = 0.158; //     onde ficam as lâmpadas do miolo
const R_MIOLO_LAMPADA = 0.016; // o raio de uma delas
const R_MIOLO_BRANCO = 0.125; //  o disco branco onde a roleta.js põe o logo

/**
 * Quantas lâmpadas o aro tem, no mínimo. A arte tem dez, uma por divisa, e
 * amarrar a conta a N deixava o aro com uma lâmpada só num baralho de uma
 * rodada. Quando as divisas não chegam a dez, o arco de cada fatia é repartido
 * até chegar — toda divisa continua com a sua lâmpada e o aro nunca fica ralo.
 */
const LUZES_MINIMAS = 10;

/** A proporção com que a caixa da foto nasce, antes de a foto ser medida. */
const FOTO_PROPORCAO = 1.5;
/** Folga da caixa da foto, para a borda serrilhada não encostar no arco. */
const FOTO_FOLGA = 0.94;

const svg = (tag, attrs = {}) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null) node.setAttribute(k, String(v));
  }
  return node;
};

/**
 * O id do gradiente do brilho é por roda, e não fixo, porque `url(#id)` casa
 * com o primeiro id igual do documento: duas rodas na mesma página (a tela e
 * uma pré-visualização, digamos) apagariam o brilho de uma delas.
 */
let sequencia = 0;

/**
 * Uma lâmpada: o brilho quente em volta, o corpo dourado e o núcleo aceso. Na
 * arte o núcleo claro ocupa pouco mais da metade do corpo.
 */
function lampada(pai, halo, x, y, r) {
  pai.appendChild(svg('circle', { cx: x, cy: y, r: r * BRILHO, fill: `url(#${halo})` }));
  pai.appendChild(svg('circle', { cx: x, cy: y, r, fill: LAMPADA }));
  pai.appendChild(svg('circle', { cx: x, cy: y, r: r * 0.54, fill: NUCLEO }));
}

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
 * A cor da fatia `i` de `n`.
 *
 * Alternar duas cores é o que a arte faz, e fecha o ciclo enquanto N é par. Com
 * N ímpar não fecha: a fatia 0 e a fatia N-1 caem as duas em dourado, se
 * encostam e viram um bloco único do dobro da largura — a roda passa a mostrar
 * uma rodada a menos do que tem, e a seta parando ali fica ambígua. Duas cores
 * não colorem um ciclo ímpar, então uma fatia recebe uma terceira cor, escolhida
 * no alto da roda para ficar longe da seta.
 *
 * A tentativa anterior foi um traço em cada divisa, na cor do aro: dourado sobre
 * dourado, que é justamente onde ele precisava aparecer.
 */
function corDaFatia(i, n) {
  if (n % 2 === 0) return i % 2 === 0 ? DOURADO : AZUL;
  const terceira = Math.round(n / 2);
  if (i === terceira) return DOURADO_ESCURO;
  // Fora da terceira, a alternância corre pelo caminho que sobra do ciclo.
  return (i < terceira ? i : i + 1) % 2 === 0 ? DOURADO : AZUL;
}

/**
 * A caixa da foto na fatia, na proporção da própria foto. `alt` é radial e
 * `larg` é tangencial, porque o carro fica deitado no sentido da fatia, como na
 * arte, e `dist` é o raio em que ela fica centrada.
 *
 * A regra é a da arte: a foto é tão larga quanto a fatia é no raio dela. As
 * quinas de dentro sobram da fatia — a fatia estreita indo para o centro — e é
 * para elas que existe o recorte; nas fotos do jogo essas quinas são margem
 * transparente. O que faltava era o limite de FORA: nada segurava a quina
 * externa contra o arco, e a foto encostada na borda saía cortada.
 */
function caixaDaFoto(passo, rFatia, rMiolo, proporcao) {
  const meia = (Math.min(passo, 360) / 2) * (Math.PI / 180);
  // De meia-volta para cima as divisas não apertam nada — elas abrem 180° ou
  // mais — e quem limita passa a ser só o arco. Aí a foto encosta no miolo.
  const abertura = meia >= Math.PI / 2 ? Infinity : Math.tan(meia);
  const raio = (alt) => Math.max((alt * proporcao) / 2 / abertura, rMiolo + alt / 2);
  const cabe = (alt) => Math.hypot(raio(alt) + alt / 2, (alt * proporcao) / 2) <= rFatia;

  // `cabe` é monotônica em `alt`, então a maior altura sai por bissecção.
  let cabendo = 0;
  let estourando = rFatia * 2;
  for (let i = 0; i < 40; i++) {
    const meio = (cabendo + estourando) / 2;
    if (cabe(meio)) cabendo = meio;
    else estourando = meio;
  }

  const alt = cabendo * FOTO_FOLGA;
  return { dist: raio(alt), larg: alt * proporcao, alt };
}

/**
 * @param {Array} slots as rodadas do baralho, na ordem das fatias
 * @param {{largura: number, altura: number}} caixa a mesma que o PNG ocupa
 * @returns {SVGElement} uma roda do tamanho da caixa, sempre circular
 */
export function rodaGerada(slots, { largura = 836.1, altura = 839.8 } = {}) {
  // Baralho vazio não chega aqui em jogo (deck.js recusa publicar um), mas esta
  // função é pública: uma fatia em branco é melhor que um disco sem nada.
  const fatias = slots?.length ? slots : [null];
  const n = fatias.length;
  // O viewBox e quadrado para o disco sair circular; o preserveAspectRatio
  // padrao encaixa esse quadrado na caixa que a roleta.js passa, que e a mesma
  // que o PNG original ocupa — assim a roda nao muda de tamanho quando a area
  // administrativa troca o baralho e o desenho entra no lugar da arte.
  const LADO = 893.2;
  const c = LADO / 2;
  const rFatia = c * R_FATIA;
  const rMiolo = c * R_MIOLO;

  const halo = `roda-halo-${(sequencia += 1)}`;

  const root = svg('svg', {
    viewBox: `0 0 ${LADO} ${LADO}`,
    width: largura,
    height: altura,
    role: 'img',
    'aria-label': `Roleta com ${n} veículo${n === 1 ? '' : 's'}`,
  });
  root.style.display = 'block';
  root.style.flex = 'none';

  // O brilho das lâmpadas, uma vez só para todas.
  const defs = svg('defs');
  root.appendChild(defs);
  const gradiente = svg('radialGradient', { id: halo });
  for (const [parada, opacidade] of [[0, 0.75], [0.5, 0.3], [1, 0]]) {
    gradiente.appendChild(
      svg('stop', { offset: `${parada * 100}%`, 'stop-color': LAMPADA, 'stop-opacity': opacidade })
    );
  }
  defs.appendChild(gradiente);

  const passo = 360 / n;
  // A fatia 0 fica centrada para BAIXO, onde a seta aponta, e as demais correm
  // no sentido ANTI-HORÁRIO — que é como o PNG original as dispõe. A rotação de
  // `escolha` = 1 + k/N voltas é horária, então quem sobra sob a seta é a
  // fatia k. Desenhar no sentido horário espelhava a roda e a fazia parar na
  // fatia -k: a seta mostrava um carro e o jogo abria outro.
  const base = 90 - passo / 2;

  const grupo = svg('g');
  root.appendChild(grupo);

  // As fatias. Na arte não há anel dourado em volta delas: elas vão até a borda
  // e as lâmpadas ficam por cima. O anel que havia aqui aparecia como uma faixa
  // dourada por baixo das fatias azuis, que a arte não tem.
  fatias.forEach((_, i) => {
    const de = base - i * passo;
    grupo.appendChild(svg('path', { d: fatia(c, c, rFatia, de, de + passo), fill: corDaFatia(i, n) }));
  });

  // As fotos, uma por fatia. Cada uma é recortada pela própria fatia: a caixa
  // encosta nas divisas no raio da foto, e mais para dentro as quinas dela
  // sobram da fatia (ver `caixaDaFoto`) — sem o recorte invadiriam a vizinha.
  fatias.forEach((slot, i) => {
    const veiculo = slot?.veiculo;
    if (!veiculo?.imagem) return;

    const de = base - i * passo;
    const meio = de + passo / 2;
    const rad = (meio * Math.PI) / 180;

    const clipId = `${halo}-fatia-${i}`;
    const clip = svg('clipPath', { id: clipId });
    clip.appendChild(svg('path', { d: fatia(c, c, rFatia, de, de + passo) }));
    defs.appendChild(clip);

    const g = svg('g', { 'clip-path': `url(#${clipId})` });
    const img = svg('image', { href: veiculo.imagem, preserveAspectRatio: 'xMidYMid meet' });
    g.appendChild(img);
    grupo.appendChild(g);

    const posicionar = (proporcao) => {
      const { dist, larg, alt } = caixaDaFoto(passo, rFatia, rMiolo, proporcao);
      const px = c + dist * Math.cos(rad);
      const py = c + dist * Math.sin(rad);
      img.setAttribute('x', px - larg / 2);
      img.setAttribute('y', py - alt / 2);
      img.setAttribute('width', larg);
      img.setAttribute('height', alt);
      // Como na arte original, o carro aponta para fora do centro.
      img.setAttribute('transform', `rotate(${meio - 90} ${px} ${py})`);
    };

    // A caixa tem de sair na proporção da foto: o `meet` encaixa a foto dentro
    // dela sem distorcer, então caixa de proporção diferente vira sobra vazia e
    // carro pequeno. E a proporção é medida na imagem, não lida do baralho: as
    // fotos do jogo têm margem transparente larga e são quase quadradas (1,08),
    // enquanto a `largura`/`altura` do veículo é a caixa da tela do carro
    // sorteado (1,83). Usar a declarada devolvia um carro 40% menor.
    posicionar(FOTO_PROPORCAO);
    const medida = new Image();
    medida.addEventListener('load', () => {
      if (medida.naturalWidth > 0 && medida.naturalHeight > 0) {
        posicionar(medida.naturalWidth / medida.naturalHeight);
      }
    });
    medida.src = veiculo.imagem;
  });

  // As lâmpadas do aro: uma em cada divisa, e o arco de cada fatia dividido em
  // partes iguais quando o baralho é curto, para o aro não ficar ralo (ver
  // LUZES_MINIMAS). A divisão é ÍMPAR de propósito: com um número par de partes
  // uma lâmpada cai no MEIO da fatia, e o meio da fatia é onde a seta para —
  // a lâmpada acendia por dentro do vão da seta, atrás da ponta dela.
  // O raio é o da arte, limitado pelo espaço entre duas lâmpadas vizinhas, o
  // que impede que elas se encostem num baralho longo.
  let partes = Math.ceil(LUZES_MINIMAS / n);
  if (partes % 2 === 0) partes += 1;
  const luzes = n * partes;
  const rLuz = c * R_LUZ;
  const rLampada = Math.max(4, Math.min(c * R_LAMPADA, (Math.PI * rLuz) / (luzes * 1.25)));
  for (let i = 0; i < luzes; i++) {
    const rad = ((base + (i * 360) / luzes) * Math.PI) / 180;
    lampada(grupo, halo, c + rLuz * Math.cos(rad), c + rLuz * Math.sin(rad), rLampada);
  }

  // Miolo, onde o logo da Tecnomotor é sobreposto pela roleta.js. Como na arte
  // original, é um anel dourado com lâmpadas em volta do disco branco. O anel
  // tem doze luzes fixas: amarrá-las a N deixava o miolo ralo num baralho curto.
  root.appendChild(svg('circle', { cx: c, cy: c, r: rMiolo, fill: MIOLO }));
  for (let i = 0; i < 12; i++) {
    const rad = (i * 30 * Math.PI) / 180;
    lampada(root, halo, c + c * R_MIOLO_LUZ * Math.cos(rad), c + c * R_MIOLO_LUZ * Math.sin(rad), c * R_MIOLO_LAMPADA);
  }
  root.appendChild(svg('circle', { cx: c, cy: c, r: c * R_MIOLO_BRANCO, fill: '#ffffff' }));

  return root;
}
