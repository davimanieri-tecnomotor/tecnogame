// O baralho (web/js/deck.js) trocou o modelo de dados do jogo: onde havia três
// listas de questões amarradas a duas tabelas fixas por índice, agora há N
// rodadas. Este teste é a garantia de que a troca não mudou o jogo:
//
//  1. o baralho embutido reproduz questions.js campo por campo;
//  2. as dez voltas da roleta são os mesmos números do Dart;
//  3. a arte original é usada enquanto os veículos são os originais;
//  4. um baralho de tamanho diferente sorteia, gera a roda e joga até o fim;
//  5. a fatia que para sob a seta é a mesma rodada que o jogo abre em seguida.
import puppeteer from 'puppeteer';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
const pageUrl = (route) => (BASE.endsWith('.html') ? `${BASE}#${route}` : `${BASE}/#${route}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
const falhas = [];
page.on('pageerror', (e) => falhas.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !/ERR_FAILED|js\/main\.js|firebasestorage/.test(m.text())) {
    falhas.push('console: ' + m.text());
  }
});

await page.goto(pageUrl('/cadastro'), { waitUntil: 'networkidle2' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle2' });
await wait(2000);

/* --- 1 e 2: o embutido reproduz questions.js, e as voltas batem com o Dart -- */

const paridade = await page.evaluate(async () => {
  // Por HTTP roda o modulo ES e import() funciona; por file:// roda o bundle
  // classico e o import() dinamico e recusado, entao vem pelo __tecgameRequire
  // que o bundle expoe. Nos dois casos e a mesma instancia que a pagina usa.
  const carregar = async (nome) =>
    window.__tecgameRequire ? window.__tecgameRequire(nome) : await import(`./js/${nome}`);
  const deck = await carregar('deck.js');
  const fns = await carregar('functions.js');
  const { QUESTIONS } = await carregar('questions.js');

  const problemas = [];
  const slots = deck.SLOTS_ORIGINAIS;

  if (slots.length !== 10) problemas.push(`baralho embutido tem ${slots.length} slots, esperava 10`);

  // Desde a v2 do baralho um veiculo tem um BANCO de perguntas; o embutido nasce
  // com uma por veiculo, que e a do Dart.
  slots.forEach((slot, i) => {
    if ((slot.perguntas ?? []).length !== 1) {
      problemas.push(`slot ${i}: o embutido deveria ter 1 pergunta, tem ${(slot.perguntas ?? []).length}`);
      return;
    }
    const pergunta = slot.perguntas[0];
    if (pergunta.ativa !== true) problemas.push(`slot ${i}: a pergunta do embutido deveria nascer ativa`);
    for (const lang of deck.IDIOMAS) {
      const q = QUESTIONS[lang][i];
      for (const campo of deck.CAMPOS_QUESTAO) {
        const esperado = q[campo] ?? '';
        const obtido = pergunta[lang][campo];
        if (obtido !== esperado) {
          problemas.push(`slot ${i} ${lang}.${campo}: ${JSON.stringify(obtido)} != ${JSON.stringify(esperado)}`);
        }
      }
    }
    if (pergunta.gabarito !== String(QUESTIONS.pt[i].gabarito)) problemas.push(`slot ${i}: gabarito`);
    for (const flag of ['raster3S', 'rasher4', 'xtool']) {
      if (pergunta.scanners[flag] !== Boolean(QUESTIONS.pt[i][flag])) problemas.push(`slot ${i}: flag ${flag}`);
    }
  });

  // As voltas que o Dart gerava, uma decimal, na ordem das fatias.
  const dart = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9];
  const nossas = Array.from({ length: 10 }, (_, i) => fns.voltaDoIndice(i, 10));
  if (JSON.stringify(nossas) !== JSON.stringify(dart)) {
    problemas.push(`voltas divergem do Dart: ${JSON.stringify(nossas)}`);
  }
  const indices = nossas.map((v) => fns.transformaAleatorio(v));
  if (JSON.stringify(indices) !== JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    problemas.push(`indices divergem: ${JSON.stringify(indices)}`);
  }

  // Ida e volta para qualquer N: nenhuma rodada fica inalcançável.
  for (let n = 1; n <= 40; n++) {
    const ok = Array.from({ length: n }, (_, i) => fns.escolhaParaIndice(fns.voltaDoIndice(i, n), n)).every(
      (v, i) => v === i
    );
    if (!ok) problemas.push(`ida e volta falhou para N=${n}`);
  }

  // 3: a arte original vale para o baralho embutido, e não para um alterado.
  if (!deck.usaArteOriginal(deck.BARALHO_ORIGINAL)) problemas.push('usaArteOriginal deveria ser true no embutido');
  const trocado = {
    versao: 2,
    slots: deck.SLOTS_ORIGINAIS.map((s, i) =>
      i === 0 ? { ...s, veiculo: { ...s.veiculo, imagem: 'assets/images/BMW.png' } } : s
    ),
  };
  if (deck.usaArteOriginal(trocado)) problemas.push('usaArteOriginal deveria ser false com veiculo trocado');

  // Só mexer no texto não invalida a arte: os veículos continuam os mesmos.
  const soTexto = {
    versao: 2,
    slots: deck.SLOTS_ORIGINAIS.map((s, i) =>
      i === 0
        ? { ...s, perguntas: [{ ...s.perguntas[0], pt: { ...s.perguntas[0].pt, pergunta: 'outra pergunta' } }] }
        : s
    ),
  };
  if (!deck.usaArteOriginal(soTexto)) problemas.push('editar so o texto nao deveria invalidar a arte');

  // A validação aceita o embutido.
  const erros = deck.validarBaralho(deck.BARALHO_ORIGINAL);
  if (erros.length) problemas.push('validarBaralho reprovou o embutido: ' + erros.join('; '));

  return problemas;
});

console.log(paridade.length ? 'PARIDADE FALHOU:' : '1-3. baralho embutido reproduz questions.js, voltas identicas ao Dart, arte ok');
paridade.slice(0, 10).forEach((p) => console.log('   - ' + p));
falhas.push(...paridade);

/* ------------- 4: baralho de tamanho diferente joga do inicio ao fim ------- */

const N_CUSTOM = 12;
await page.evaluate(async (n) => {
  const carregar = async (nome) =>
    window.__tecgameRequire ? window.__tecgameRequire(nome) : await import(`./js/${nome}`);

  const deck = await carregar('deck.js');
  const base = deck.SLOTS_ORIGINAIS;
  const slots = Array.from({ length: n }, (_, i) => {
    const s = JSON.parse(JSON.stringify(base[i % base.length]));
    s.veiculo.nome = `Veiculo de teste ${i + 1}`;
    const p = s.perguntas[0];
    // Todos resolvem com qualquer equipamento, para o teste sempre conseguir avançar.
    p.scanners = { raster3S: true, rasher4: true, xtool: true };
    p.gabarito = '2';
    for (const lang of deck.IDIOMAS) p[lang].pergunta = `Pergunta de teste ${i + 1}`;
    return s;
  });
  deck.publicarBaralho({ versao: 2, slots });
}, N_CUSTOM);

// Caminho 1: o totem reinicia. Um reload sempre le o baralho publicado.
await page.reload({ waitUntil: 'networkidle2' });
await wait(1500);
const aposReload = await page.evaluate(async () => {
  // Por HTTP roda o modulo ES e import() funciona; por file:// roda o bundle
  // classico e o import() dinamico e recusado, entao vem pelo __tecgameRequire
  // que o bundle expoe. Nos dois casos e a mesma instancia que a pagina usa.
  const carregar = async (nome) =>
    window.__tecgameRequire ? window.__tecgameRequire(nome) : await import(`./js/${nome}`);
  const st = await carregar('state.js');
  return { total: st.FFAppState.totalSlots, primeiro: st.FFAppState.baralho.slots[0].veiculo.nome };
});
console.log('   apos reload ->', JSON.stringify(aposReload));
if (aposReload.total !== N_CUSTOM) falhas.push(`apos reload o baralho tem ${aposReload.total} slots`);

// Caminho 2: sem reiniciar o navegador. O jogo rele quando a tela de cadastro
// abre — um jogador novo comecando —, entao sair da rota e voltar basta.
await page.evaluate(async () => {
  // Por HTTP roda o modulo ES e import() funciona; por file:// roda o bundle
  // classico e o import() dinamico e recusado, entao vem pelo __tecgameRequire
  // que o bundle expoe. Nos dois casos e a mesma instancia que a pagina usa.
  const carregar = async (nome) =>
    window.__tecgameRequire ? window.__tecgameRequire(nome) : await import(`./js/${nome}`);
  const deck = await carregar('deck.js');
  const st = await carregar('state.js');
  // Volta o estado em memoria ao original, para provar que a releitura acontece.
  st.FFAppState.baralho = deck.BARALHO_ORIGINAL;
});
await page.goto(pageUrl('/roleta'), { waitUntil: 'networkidle2' });
await wait(500);
await page.goto(pageUrl('/cadastro'), { waitUntil: 'networkidle2' });
await wait(1200);
const aposCadastro = await page.evaluate(async () => {
  // Por HTTP roda o modulo ES e import() funciona; por file:// roda o bundle
  // classico e o import() dinamico e recusado, entao vem pelo __tecgameRequire
  // que o bundle expoe. Nos dois casos e a mesma instancia que a pagina usa.
  const carregar = async (nome) =>
    window.__tecgameRequire ? window.__tecgameRequire(nome) : await import(`./js/${nome}`);
  const st = await carregar('state.js');
  return st.FFAppState.totalSlots;
});
console.log('   apos passar pelo cadastro ->', aposCadastro, 'slots');
if (aposCadastro !== N_CUSTOM) falhas.push('o cadastro nao releu o baralho publicado');

await page.goto(pageUrl('/roleta'), { waitUntil: 'networkidle2' });
await wait(2200);

const roda = await page.evaluate(() => {
  const svgEl = document.querySelector('#pages svg[role="img"]');
  const png = [...document.images].some((i) => i.src.includes('Roleta.png'));
  return {
    gerada: Boolean(svgEl),
    rotulo: svgEl?.getAttribute('aria-label') ?? null,
    // Só as fatias visíveis: cada uma tem um path gêmeo dentro de um clipPath.
    fatias: svgEl ? [...svgEl.querySelectorAll('path')].filter((n) => !n.closest('clipPath')).length : 0,
    fotos: svgEl ? svgEl.querySelectorAll('image').length : 0,
    aindaUsaPng: png,
  };
});
console.log('4. roda com baralho de', N_CUSTOM, '->', JSON.stringify(roda));
if (!roda.gerada) falhas.push('a roda nao foi gerada para baralho != original');
if (roda.aindaUsaPng) falhas.push('ainda usando o PNG de 10 fatias com baralho alterado');
if (roda.fatias !== N_CUSTOM) falhas.push(`a roda gerou ${roda.fatias} fatias, esperava ${N_CUSTOM}`);

// Gira e confere que caiu num dos veículos novos, coerente com o índice.
await page.evaluate(() => {
  const hit = [...document.querySelectorAll('#pages .ff-text')].find((n) => /GIRAR/i.test(n.textContent));
  hit.closest('.ff-inkwell').click();
});
for (let i = 0; i < 60; i++) {
  const r = await page.evaluate(() => document.querySelector('.ff-page')?.dataset.route);
  if (r === 'carroSleecionado') break;
  await wait(400);
}
await wait(2500);

const sorteio = await page.evaluate(() => {
  const nome = [...document.querySelectorAll('#pages .ff-text')].map((n) => n.textContent.trim()).find((t) => t.startsWith('Veiculo de teste'));
  return { nome, hash: location.hash };
});
console.log('   sorteou ->', JSON.stringify(sorteio.nome));
if (!sorteio.nome) falhas.push('o carro sorteado nao veio do baralho publicado');

// Segue até a tela de jogo e responde, para provar que o ciclo fecha com N != 10.
for (let i = 0; i < 80; i++) {
  const r = await page.evaluate(() => document.querySelector('.ff-page')?.dataset.route);
  if (r === 'scanner') break;
  await wait(400);
}
await wait(2200);
await page.evaluate(() => {
  const tools = [...document.querySelectorAll('#pages .ff-stack')].filter((n) => n.querySelector('img'));
  for (const t of tools) {
    const op = t.querySelector('[style*="opacity"]');
    if (op && Number(op.style.opacity) === 1) return t.querySelector('.ff-inkwell').click();
  }
});
for (let i = 0; i < 90; i++) {
  const r = await page.evaluate(() => document.querySelector('.ff-page')?.dataset.route);
  if (r === 'telaAcao') break;
  await wait(400);
}
await wait(1500);

const jogo = await page.evaluate(() => {
  // O valor COMPUTADO, e nao `n.style.fontSize`: o piso de legibilidade emite
  // `max(55px, var(--piso-fonte))`, entao a string do estilo inline nao e mais
  // "55px". Em 1x o computado continua 55.
  const fontePx = (n) => Math.round(parseFloat(getComputedStyle(n).fontSize));
  const cards = [...document.querySelectorAll('#pages .ff-text')]
    .filter((n) => /^[1-4]$/.test(n.textContent.trim()) && fontePx(n) === 55)
    .map((n) => n.closest('.ff-stack'));
  const enunciado = [...document.querySelectorAll('#pages .ff-text')]
    .map((n) => n.textContent.trim())
    .find((t) => t.startsWith('Pergunta de teste'));
  return { alternativas: cards.length, enunciado };
});
console.log('   tela de jogo ->', JSON.stringify(jogo));
if (jogo.alternativas !== 4) falhas.push(`a tela de jogo mostrou ${jogo.alternativas} alternativas`);
if (!jogo.enunciado) falhas.push('o enunciado nao veio do baralho publicado');

/* ---- 5: a fatia que para sob a seta e a rodada que o jogo abre em seguida --
 * A roda gerada desenha as fatias e o `escolha` sorteado gira a roda; se os
 * dois discordarem, a seta mostra um carro e o jogo abre outro. Ja aconteceu:
 * as fatias corriam no sentido horario, o giro tambem, e a roda parava na
 * fatia -k. Isto confere as duas pontas para todo N e todo k. */

const alinhamento = await page.evaluate(async () => {
  const carregar = async (nome) =>
    window.__tecgameRequire ? window.__tecgameRequire(nome) : await import(`./js/${nome}`);
  const { rodaGerada } = await carregar('roda.js');
  const fns = await carregar('functions.js');

  // O angulo do meio de cada fatia, lido do proprio `d` que a roda gerou:
  // "M cx cy L x1 y1 A r r 0 f 1 x2 y2 Z".
  const anguloDoMeio = (d, c) => {
    // "M cx cy L x1 y1 A r r 0 f 1 x2 y2 Z" -> so os numeros, na ordem.
    const n = d.split(' ').map(Number).filter((v) => !Number.isNaN(v));
    const grau = (x, y) => ((Math.atan2(y - c, x - c) * 180) / Math.PI + 360) % 360;
    const a = grau(n[2], n[3]);
    let b = grau(n[9], n[10]);
    if (b <= a) b += 360; // a fatia sempre varre no sentido horario
    return ((a + b) / 2) % 360;
  };

  const problemas = [];
  for (const N of [3, 7, 9, 10, 12, 20]) {
    const svgEl = rodaGerada(Array.from({ length: N }, () => ({ veiculo: { imagem: '' } })));
    const c = Number(svgEl.getAttribute('viewBox').split(' ')[2]) / 2;
    const fatias = [...svgEl.querySelectorAll('path')]
      .filter((p) => !p.closest('clipPath'))
      .map((p) => anguloDoMeio(p.getAttribute('d'), c));
    if (fatias.length !== N) {
      problemas.push(`N=${N}: a roda tem ${fatias.length} fatias`);
      continue;
    }
    for (let k = 0; k < N; k++) {
      const escolha = fns.voltaDoIndice(k, N);
      const giro = escolha * 360; // rotate() e horario
      // 90 graus e para BAIXO no SVG, que e onde a seta aponta.
      const perto = fatias.map((ang) => {
        const d = ((((ang + giro - 90) % 360) + 360) % 360);
        return Math.min(d, 360 - d);
      });
      const naSeta = perto.indexOf(Math.min(...perto));
      const abre = fns.escolhaParaIndice(escolha, N);
      if (naSeta !== abre) {
        problemas.push(`N=${N} k=${k}: a seta para na fatia ${naSeta}, mas o jogo abre a ${abre}`);
      }
    }
  }
  return problemas;
});
console.log(
  alinhamento.length
    ? '5. ALINHAMENTO FALHOU:'
    : '5. a fatia sob a seta e a rodada que o jogo abre, para todo N e todo k'
);
alinhamento.slice(0, 10).forEach((p) => console.log('   - ' + p));
falhas.push(...alinhamento);

/* ------- 6: a roda gerada cabe na caixa, se le, e nao corta as fotos -------
 * Quatro bugs de desenho, um teste. (a) O brilho das lampadas passava 13,6px da
 * caixa e saia cortado reto no alto e nos dois lados. (b) Com N impar a
 * primeira e a ultima fatia caiam na mesma cor, se encostavam e viravam um
 * bloco do dobro da largura — a roda mostrava uma rodada a menos do que tem.
 * (c) Nada segurava a quina de fora da foto contra o arco, e o carro encostado
 * na borda saia cortado. (d) O aro tinha uma lampada por fatia, o que deixava
 * uma lampada so num baralho de uma rodada, e a divisao que consertava isso
 * punha uma lampada no meio da fatia — acesa por dentro do vao da seta. */

const desenho = await page.evaluate(async () => {
  const carregar = async (nome) =>
    window.__tecgameRequire ? window.__tecgameRequire(nome) : await import(`./js/${nome}`);
  const { rodaGerada } = await carregar('roda.js');

  // A roda mede a foto para acertar a proporcao da caixa dela, e isso chega por
  // evento. Deixa a foto no cache antes, para o que este teste le ser a
  // geometria final e nao a provisoria.
  const FOTO = 'assets/images/FIAT_TORO.png';
  await new Promise((ok) => {
    const i = new Image();
    i.onload = ok;
    i.onerror = ok;
    i.src = FOTO;
  });

  const problemas = [];
  for (const N of [1, 2, 3, 5, 7, 9, 10, 12, 16, 30]) {
    const slots = Array.from({ length: N }, () => ({
      veiculo: { imagem: FOTO, largura: 1235, altura: 674 },
    }));
    const el = rodaGerada(slots);
    await new Promise((ok) => setTimeout(ok, 40));
    const lado = Number(el.getAttribute('viewBox').split(' ')[2]);
    const c = lado / 2;

    // (a) nada desenhado passa da caixa: o viewBox quadrado E a caixa.
    let alcance = 0;
    for (const n of el.querySelectorAll('circle')) {
      const d = Math.hypot(+n.getAttribute('cx') - c, +n.getAttribute('cy') - c) + +n.getAttribute('r');
      if (d > alcance) alcance = d;
    }
    if (alcance > c + 0.5) problemas.push(`N=${N}: a roda passa ${(alcance - c).toFixed(1)} do viewBox`);
    // e ela tambem nao pode ser pequena demais, senao a troca da arte pronta
    // para o desenho faria a roleta mudar de tamanho no meio do jogo.
    if (alcance < c * 0.9) problemas.push(`N=${N}: a roda so ocupa ${((alcance / c) * 100).toFixed(0)}% da caixa`);

    // (b) nenhuma fatia tem a cor da vizinha.
    const cores = [...el.querySelectorAll('path')]
      .filter((p) => !p.closest('clipPath'))
      .map((p) => p.getAttribute('fill'));
    if (cores.length !== N) problemas.push(`N=${N}: a roda tem ${cores.length} fatias`);
    if (N > 1) {
      for (let i = 0; i < cores.length; i++) {
        const j = (i + 1) % cores.length;
        if (cores[i] === cores[j]) problemas.push(`N=${N}: fatias ${i} e ${j} estao as duas em ${cores[i]}`);
      }
    }

    // (c) a quina de fora de cada foto fica dentro do arco da fatia.
    const rFatia = Math.max(
      ...[...el.querySelectorAll('path')]
        .filter((p) => !p.closest('clipPath'))
        .map((p) => {
          const v = p.getAttribute('d').split(' ').map(Number).filter((x) => !Number.isNaN(x));
          return Math.max(Math.hypot(v[2] - c, v[3] - c), Math.hypot(v[0] - c, v[1] - c));
        })
    );
    for (const img of el.querySelectorAll('image')) {
      const x = +img.getAttribute('x');
      const y = +img.getAttribute('y');
      const larg = +img.getAttribute('width');
      const alt = +img.getAttribute('height');
      // A rotacao e em volta do centro da foto, entao a quina mais longe do
      // centro da roda nao muda de distancia com ela.
      const dist = Math.hypot(x + larg / 2 - c, y + alt / 2 - c);
      const quina = Math.hypot(dist + alt / 2, larg / 2);
      if (quina > rFatia + 0.5) problemas.push(`N=${N}: a foto passa ${(quina - rFatia).toFixed(1)} do arco`);
    }

    // (d) o aro nunca fica ralo, toda divisa tem a sua lampada, e nenhuma cai
    // no meio de uma fatia — o meio da fatia e onde a seta para, e a lampada
    // ali acendia por dentro do vao da seta.
    const halos = [...el.querySelectorAll('circle')].filter((n) =>
      (n.getAttribute('fill') || '').startsWith('url')
    );
    const doAro = halos.filter((n) => Math.hypot(+n.getAttribute('cx') - c, +n.getAttribute('cy') - c) > c * 0.5);
    if (doAro.length < 10) problemas.push(`N=${N}: o aro ficou com ${doAro.length} lampadas`);
    if (doAro.length % N !== 0) problemas.push(`N=${N}: ${doAro.length} lampadas nao caem uma em cada divisa`);
    const passo = 360 / N;
    for (const luz of doAro) {
      const ang = (Math.atan2(+luz.getAttribute('cy') - c, +luz.getAttribute('cx') - c) * 180) / Math.PI;
      // 90 graus e para baixo no SVG: o meio da fatia 0, onde a seta aponta.
      const doMeio = (((ang - 90) % passo) + passo) % passo;
      if (Math.min(doMeio, passo - doMeio) < 0.5) {
        problemas.push(`N=${N}: uma lampada caiu no meio de uma fatia (${ang.toFixed(1)}deg)`);
      }
    }
  }
  return problemas;
});
console.log(
  desenho.length ? '6. DESENHO FALHOU:' : '6. a roda gerada cabe na caixa, se le fatia a fatia, e nao corta as fotos'
);
desenho.slice(0, 10).forEach((p) => console.log('   - ' + p));
falhas.push(...desenho);

/* ------------- 7: banco de perguntas por veiculo, e o sorteio -------------- */

// Desde a v2 um veiculo pode ter varias perguntas e o jogo sorteia entre as
// LIGADAS. Duas coisas tem de valer: nunca cair numa desligada (senao o
// operador nao consegue guardar rascunho) e nao cair sempre na mesma (senao o
// segundo da fila recebe a pergunta do primeiro, que e o defeito que o banco
// existe para resolver).

const banco = await page.evaluate(async () => {
  const carregar = async (nome) =>
    window.__tecgameRequire ? window.__tecgameRequire(nome) : await import(`./js/${nome}`);

  const deck = await carregar('deck.js');
  const st = await carregar('state.js');
  const problemas = [];
  const clonar = (x) => JSON.parse(JSON.stringify(x));

  const molde = clonar(deck.SLOTS_ORIGINAIS[0]);
  const perguntaDe = (rotulo, ativa) => {
    const p = clonar(molde.perguntas[0]);
    p.id = `t-${rotulo}`;
    p.ativa = ativa;
    for (const lang of deck.IDIOMAS) p[lang].pergunta = rotulo;
    return p;
  };

  // Tres veiculos; o do meio com quatro perguntas, das quais duas ligadas.
  const slots = [0, 1, 2].map((i) => {
    const s = clonar(molde);
    s.veiculo.nome = `Veiculo ${i}`;
    s.perguntas =
      i === 1
        ? [
            perguntaDe('A-ligada', true),
            perguntaDe('B-desligada', false),
            perguntaDe('C-ligada', true),
            perguntaDe('D-desligada', false),
          ]
        : [perguntaDe(`unica-${i}`, true)];
    return s;
  });
  const comBanco = { versao: 2, slots };

  // Rascunho desligado com campo vazio nao pode impedir publicar.
  const rascunhoVazio = clonar(comBanco);
  for (const lang of deck.IDIOMAS) rascunhoVazio.slots[1].perguntas[1][lang].pergunta = '';
  const erros = deck.validarBaralho(rascunhoVazio);
  if (erros.length) problemas.push('validar reprovou por causa de rascunho desligado: ' + erros.join('; '));

  // Mas um veiculo SEM nenhuma ligada tem de reprovar: a roleta cairia nele sem jogo.
  const todasDesligadas = clonar(comBanco);
  todasDesligadas.slots[1].perguntas.forEach((p) => {
    p.ativa = false;
  });
  if (!deck.validarBaralho(todasDesligadas).some((m) => /desligadas/.test(m))) {
    problemas.push('validar deixou passar um veiculo com todas as perguntas desligadas');
  }

  // O sorteio, muitas vezes: sempre entre as ligadas, e cobrindo as duas.
  deck.publicarBaralho(comBanco);
  st.FFAppState.recarregarBaralho();
  const vistas = new Set();
  for (let n = 0; n < 200; n++) {
    st.FFAppState.sortearPerguntas();
    vistas.add(st.FFAppState.questoesBrasil[1].pergunta);
  }
  if (![...vistas].every((t) => t.endsWith('-ligada'))) {
    problemas.push('o sorteio caiu numa pergunta desligada: ' + [...vistas].join(', '));
  }
  if (vistas.size !== 2) {
    problemas.push(`o sorteio cobriu ${vistas.size} perguntas em 200 partidas, esperava as 2 ligadas`);
  }
  // Veiculo de uma pergunta so continua deterministico.
  if (st.FFAppState.questoesBrasil[0].pergunta !== 'unica-0') {
    problemas.push('veiculo de uma pergunta nao devolveu a dele');
  }

  // E um baralho v1 (a pergunta solta no slot) tem de continuar abrindo.
  const antigo = clonar(molde.perguntas[0]);
  deck.publicarBaralho({
    versao: 1,
    slots: [
      {
        veiculo: clonar(molde.veiculo),
        gabarito: '3',
        scanners: { raster3S: true, rasher4: false, xtool: false },
        pt: { ...antigo.pt, pergunta: 'veio da v1' },
        en: antigo.en,
        es: antigo.es,
      },
    ],
  });
  const migrado = deck.carregarBaralho();
  const p0 = migrado.slots[0].perguntas?.[0];
  if (migrado.versao !== 2) problemas.push(`migracao nao marcou versao 2 (${migrado.versao})`);
  if (migrado.slots[0].perguntas?.length !== 1) problemas.push('migracao nao criou o banco de uma pergunta');
  if (p0?.pt?.pergunta !== 'veio da v1') problemas.push('migracao perdeu o enunciado');
  if (p0?.gabarito !== '3') problemas.push('migracao perdeu o gabarito');
  if (p0?.scanners?.rasher4 !== false) problemas.push('migracao perdeu as flags de equipamento');
  if (p0?.ativa !== true) problemas.push('migracao nao deixou a pergunta ativa');

  deck.restaurarOriginal();
  return problemas;
});

console.log(
  banco.length
    ? '7. BANCO DE PERGUNTAS FALHOU:'
    : '7. o sorteio so cai em pergunta ligada, cobre todas elas, e baralho v1 migra sozinho'
);
banco.slice(0, 10).forEach((p) => console.log('   - ' + p));
falhas.push(...banco);

/* ------------- 8: o que sobe para a nuvem e so o que nao e de fabrica ------ */

// O que vai para o Firestore troca por referencia tudo que for identico ao de
// fabrica. E compressao, nao edicao: a ida e volta tem de devolver exatamente o
// mesmo baralho, senao o totem joga com conteudo diferente do que o operador
// publicou.

const nuvem = await page.evaluate(async () => {
  const carregar = async (nome) =>
    window.__tecgameRequire ? window.__tecgameRequire(nome) : await import(`./js/${nome}`);

  const deck = await carregar('deck.js');
  const problemas = [];
  const clonar = (x) => JSON.parse(JSON.stringify(x));
  const kb = (x) => JSON.stringify(x).length / 1024;
  const refs = (d) => d.slots.flatMap((s) => s.perguntas).filter((p) => p.deFabrica).length;

  // (a) so o de fabrica: tudo vira referencia, e sobra quase nada.
  const original = deck.BARALHO_ORIGINAL;
  const soFabrica = deck.comprimirParaNuvem(original);
  if (refs(soFabrica) !== 10) problemas.push(`o de fabrica deveria virar 10 referencias, virou ${refs(soFabrica)}`);
  if (soFabrica.slots.some((s) => !Number.isInteger(s.veiculo?.deFabrica))) {
    problemas.push('veiculo de fabrica nao virou referencia');
  }
  if (kb(soFabrica) > 3) problemas.push(`o de fabrica comprimido ficou com ${kb(soFabrica).toFixed(1)} KB`);

  // (b) pergunta nova sobe inteira; de fabrica editada, desligada ou com id
  //     trocado deixa de bater e tambem sobe inteira.
  const mexido = clonar(original);
  const nova = clonar(original.slots[0].perguntas[0]);
  nova.id = 'nova-1';
  nova.pt.pergunta = 'Pergunta criada pelo operador';
  mexido.slots[0].perguntas.push(nova);
  mexido.slots[3].perguntas[0].pt.pergunta = 'editei a de fabrica';
  mexido.slots[5].perguntas[0].ativa = false;
  mexido.slots[7].veiculo.nome = 'Veiculo renomeado';

  const comprimido = deck.comprimirParaNuvem(mexido);
  const porExtenso = comprimido.slots.flatMap((s) => s.perguntas).filter((p) => !p.deFabrica);
  if (porExtenso.length !== 3) {
    problemas.push(`esperava 3 perguntas por extenso (nova, editada, desligada), vieram ${porExtenso.length}`);
  }
  if (Number.isInteger(comprimido.slots[7].veiculo?.deFabrica)) {
    problemas.push('veiculo renomeado nao deveria ter virado referencia');
  }
  if (!Number.isInteger(comprimido.slots[1].veiculo?.deFabrica)) {
    problemas.push('veiculo intocado deveria ter virado referencia');
  }

  // (c) ida e volta exata.
  const volta = deck.expandirDaNuvem(comprimido);
  if (JSON.stringify(volta) !== JSON.stringify({ versao: 2, slots: mexido.slots })) {
    problemas.push('a ida e volta pela nuvem nao devolveu o mesmo baralho');
  }

  // (d) referencia que nao existe mais some sem derrubar o resto.
  const quebrado = clonar(soFabrica);
  quebrado.slots[2].perguntas = [{ deFabrica: 'orig-nao-existe' }];
  const salvo = deck.expandirDaNuvem(quebrado);
  if (salvo.slots.length !== 9) {
    problemas.push(`veiculo sem pergunta valida deveria sair; sobraram ${salvo.slots.length} de 10`);
  }

  return problemas;
});

console.log(
  nuvem.length
    ? '8. COMPRESSAO PARA A NUVEM FALHOU:'
    : '8. para a nuvem vai so o que nao e de fabrica, e a ida e volta e exata'
);
nuvem.slice(0, 10).forEach((p) => console.log('   - ' + p));
falhas.push(...nuvem);

await browser.close();
if (falhas.length) {
  console.log('\nFALHOU:\n- ' + falhas.slice(0, 15).join('\n- '));
  process.exit(1);
}
console.log('\nbaralho: fidelidade do original, tamanho livre e banco de perguntas funcionando');
