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

  slots.forEach((slot, i) => {
    for (const lang of deck.IDIOMAS) {
      const q = QUESTIONS[lang][i];
      for (const campo of deck.CAMPOS_QUESTAO) {
        const esperado = q[campo] ?? '';
        const obtido = slot[lang][campo];
        if (obtido !== esperado) {
          problemas.push(`slot ${i} ${lang}.${campo}: ${JSON.stringify(obtido)} != ${JSON.stringify(esperado)}`);
        }
      }
    }
    if (slot.gabarito !== String(QUESTIONS.pt[i].gabarito)) problemas.push(`slot ${i}: gabarito`);
    for (const flag of ['raster3S', 'rasher4', 'xtool']) {
      if (slot.scanners[flag] !== Boolean(QUESTIONS.pt[i][flag])) problemas.push(`slot ${i}: flag ${flag}`);
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
    versao: 1,
    slots: deck.SLOTS_ORIGINAIS.map((s, i) =>
      i === 0 ? { ...s, veiculo: { ...s.veiculo, imagem: 'assets/images/BMW.png' } } : s
    ),
  };
  if (deck.usaArteOriginal(trocado)) problemas.push('usaArteOriginal deveria ser false com veiculo trocado');

  // Só mexer no texto não invalida a arte: os veículos continuam os mesmos.
  const soTexto = {
    versao: 1,
    slots: deck.SLOTS_ORIGINAIS.map((s, i) =>
      i === 0 ? { ...s, pt: { ...s.pt, pergunta: 'outra pergunta' } } : s
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
    // Todos resolvem com qualquer equipamento, para o teste sempre conseguir avançar.
    s.scanners = { raster3S: true, rasher4: true, xtool: true };
    s.gabarito = '2';
    for (const lang of deck.IDIOMAS) s[lang].pergunta = `Pergunta de teste ${i + 1}`;
    return s;
  });
  deck.publicarBaralho({ versao: 1, slots });
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
  const cards = [...document.querySelectorAll('#pages .ff-text')]
    .filter((n) => /^[1-4]$/.test(n.textContent.trim()) && n.style.fontSize === '55px')
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

await browser.close();
if (falhas.length) {
  console.log('\nFALHOU:\n- ' + falhas.slice(0, 15).join('\n- '));
  process.exit(1);
}
console.log('\nbaralho: fidelidade do original preservada e tamanho livre funcionando');
