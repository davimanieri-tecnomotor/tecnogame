// End-to-end playthrough: registration -> instructions -> wheel -> car ->
// scanner -> demo video -> question -> confirm -> end screen -> restart.
// Screenshots each step and fails loudly on console errors.
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import { continuar, passarDaAbertura } from './_jogo.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
// BASE may be an origin (http://host:port) or a full page URL
// (file:///.../web/index.html), which is how the file:// build is checked.
const pageUrl = (route) => (BASE.endsWith('.html') ? `${BASE}#${route}` : `${BASE}/#${route}`);
const LOCAL_FILE = BASE.startsWith('file:');
// On file:// the module boot is expected to fail and index.html falls back to
// js/bundle.js; that pair of messages is not an app error.
const isBootNoise = (t) => LOCAL_FILE && /js\/main\.js|net::ERR_FAILED/.test(t);
const OUT = process.env.OUT ?? 'shots/playthrough';
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--window-size=1920,1080', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: process.env.THEME ?? 'dark' }]);

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !isBootNoise(m.text())) {
    errors.push(`[console] ${m.text()}`);
    console.log(`  ! [console] ${m.text()}`);
  }
});
page.on('pageerror', (e) => {
  errors.push(`[pageerror] ${e.message}`);
  console.log('  ! [pageerror] ' + e.message);
  console.log((e.stack || '').split(String.fromCharCode(10)).slice(1, 4).join(String.fromCharCode(10)));
});

const route = () => page.evaluate(() => document.querySelector('.ff-page')?.dataset.route ?? null);
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForRoute(name, timeout = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if ((await route()) === name) return true;
    await wait(200);
  }
  throw new Error(`timed out waiting for route "${name}" (current: ${await route()})`);
}

/** Click the element whose visible text matches, inside the current page. */
async function clickText(text) {
  const clicked = await page.evaluate((needle) => {
    const nodes = [...document.querySelectorAll('#pages .ff-text, #pages .ff-btn, #overlays .ff-text')];
    const hit = nodes.find((n) => (n.textContent || '').trim().toLowerCase() === needle.toLowerCase());
    if (!hit) return false;
    const target = hit.closest('.ff-inkwell, .ff-btn') ?? hit;
    target.click();
    return true;
  }, text);
  if (!clicked) throw new Error(`no clickable element with text "${text}"`);
}

const log = (msg) => console.log(msg);

await page.goto(pageUrl('/'), { waitUntil: 'networkidle2' });
await page.evaluate(() => localStorage.clear());
await page.goto(pageUrl('/'), { waitUntil: 'networkidle2' });
await waitForRoute('_initialize');
log('1. cadastro loaded');

// ---- registration -------------------------------------------------------
await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('#pages input.ff-input')];
  return inputs.length;
});
const inputs = await page.$$('#pages input.ff-input');
if (inputs.length !== 2) throw new Error(`expected 2 inputs, found ${inputs.length}`);
await inputs[0].click();
// Com sobrenome, de propósito: o cadastro inteiro mora dentro de um InkWell (o
// que capta o toque no fundo), e o `preventDefault` do Espaço dele engolia o
// espaço digitado — "Davi Manieri" virava "DaviManieri". O anúncio "COM VOCÊS"
// da 3.0 é que mostrou.
await inputs[0].type('Davi Manieri');
await inputs[1].click();
await inputs[1].type('16997037115');
await shot('01-typed');
const nomeDigitado = await page.evaluate(() => document.querySelectorAll('#pages input.ff-input')[0].value);
log(`   nome digitado -> "${nomeDigitado}"`);
if (nomeDigitado !== 'Davi Manieri') throw new Error(`o espaço do nome foi engolido: ${JSON.stringify(nomeDigitado)}`);

const masked = await page.evaluate(() => document.querySelectorAll('#pages input.ff-input')[1].value);
log(`2. phone mask -> "${masked}"`);
if (masked !== '(16) 99703-7115') throw new Error(`mask wrong: ${masked}`);

// dropdown
// The oficina dropdown is the first one; the language selector is the second.
const DD = '#pages .ff-dropdown';
await page.evaluate((sel) => document.querySelectorAll(sel)[0].click(), DD);
await wait(200);
await shot('02-dropdown');
const optionCount = await page.evaluate(
  () => document.querySelectorAll('.ff-dropdown-item').length,
  DD
);
log(`3. oficina dropdown options: ${optionCount}`);
if (optionCount !== 10) throw new Error(`expected 10 options, got ${optionCount}`);
await page.evaluate(
  () => document.querySelectorAll('.ff-dropdown-item')[2].click(),
  DD
);
await wait(200);

// A ROLETA E PEDIDA ANTES DA HORA. A tela mais pesada do jogo (a arte pronta da
// roda, ou uma foto por fatia quando o baralho nao e o de fabrica) mostrava as
// fatias se preenchendo com a roda ja na tela. Ninguem cai na roleta de
// surpresa: daqui ate la passam o video de instrucoes e a vinheta. Este teste
// afirma que o pedido sai AINDA NO CADASTRO — e o que a tela vai precisar ja
// esta no cache quando ela abre. Ver web/js/precarga.js.
// So por HTTP: `file://` nao publica Resource Timing — nao ha entrada nenhuma
// para ler, e nao e que o pedido nao saiu. Do disco, alias, o problema nem
// existe; ele e da feira com o jogo servido pela rede.
if (!LOCAL_FILE) {
  const adiantado = await page.evaluate(() =>
    performance.getEntriesByType('resource').some((r) => /Roleta\.png$/.test(r.name) && r.responseEnd > 0)
  );
  log(`   arte da roleta pedida ainda no cadastro: ${adiantado}`);
  if (!adiantado) throw new Error('a roleta so comeca a carregar quando a tela dela abre');
}

// validation: submit with a good name should advance
await clickText('CONFIRMAR');
await waitForRoute('instrucoes');
log('4. instrucoes reached (validation passed, cadastro stored)');
const cadastro = await page.evaluate(() => {
  // eslint-disable-next-line no-undef
  return window.__ff_state ? null : null;
});
void cadastro;
await shot('03-instrucoes');

// ---- skip instructions --------------------------------------------------
// A TRANSICAO. Toda troca de tela e a mesma — e quem decide e o router, nao a
// tela (ver web/js/router.js). Desde a 3.0 ela e a LAMINA: a tela nova entra
// POR BAIXO da que sai, e o recorte da que sai encolhe atras de uma faixa de
// luz. Como `render` dispara a lamina na mesma batida do clique, a animacao da
// pagina que sai ja esta correndo agora, e da para ler de que ela e feita: so
// `clipPath`. Se aparecer `transform` ou `opacity`, alguem devolveu ao jogo uma
// segunda gramatica de transicao.
//
// A que sai e a ULTIMA `.ff-page`: a nova foi inserida antes dela.
//
// A afirmacao mudou de lugar: no CONFIRMAR do cadastro a tela tem uma saida
// PROPRIA antes de navegar (transicoes.js), entao ali a animacao do momento do
// clique e das pecas, e nao da pagina. Aqui a navegacao e limpa.
await clickText('Pular instruções');
const saindo = await page.evaluate(() => {
  const paginas = document.querySelectorAll('#pages .ff-page');
  const pagina = paginas[paginas.length - 1];
  const props = new Set();
  for (const anim of pagina?.getAnimations() ?? []) {
    for (const quadro of anim.effect.getKeyframes()) {
      for (const chave of Object.keys(quadro)) {
        if (!['offset', 'computedOffset', 'easing', 'composite'].includes(chave)) props.add(chave);
      }
    }
  }
  const faixa = document.querySelector('#frente .palco-lamina');
  return { props: [...props], paginas: paginas.length, faixa: faixa?.getAnimations().length ?? 0 };
});
log(`   transicao de saida anima: ${JSON.stringify(saindo)}`);
if (saindo.paginas !== 2) throw new Error(`durante a lamina deveria haver duas telas, a nova por baixo (ha ${saindo.paginas})`);
if (!saindo.props.includes('clipPath')) throw new Error(`a tela que sai deveria ser recortada pela lamina; anima ${saindo.props}`);
if (saindo.props.some((p) => p !== 'clipPath')) throw new Error(`a transicao voltou a mexer em ${saindo.props}`);
if (!saindo.faixa) throw new Error('a faixa de luz da lamina nao atravessou o palco');
await waitForRoute('telaVideoTransisao');
log('5. transition video');
await shot('04-transisao');

await waitForRoute('roleta', 12000);
log('6. roleta');
await shot('05-roleta');

// ---- spin ---------------------------------------------------------------
await clickText('GIRAR A ROLETA');
await waitForRoute('carroSleecionado', 20000);
log('7. carro selecionado');
await wait(2500);
await shot('06-carro');

await waitForRoute('scanner', 20000);
log('8. scanner picker');
await wait(2200);
await shot('07-scanner');

// ---- pick the first enabled scanner ------------------------------------
const picked = await page.evaluate(() => {
  const tools = [...document.querySelectorAll('#pages .ff-stack')].filter((n) =>
    n.querySelector('img[src*="Rasther"], img[src*="TD_"]')
  );
  for (const tool of tools) {
    const opacity = tool.querySelector('[style*="opacity"]');
    if (opacity && Number(opacity.style.opacity) === 1) {
      tool.querySelector('.ff-inkwell').click();
      return tool.querySelector('img').getAttribute('src');
    }
  }
  return null;
});
log(`9. picked scanner image: ${picked}`);
if (!picked) throw new Error('no enabled scanner found');

await waitForRoute('telaVideoScanner', 15000);
const chosen = await page.evaluate(() => document.title && null);
void chosen;
await wait(1200);
await shot('08-videoScanner');
log('10. scanner demo screen');

await waitForRoute('telaAcao', 25000);
await wait(1500);
await shot('09-telaAcao');
log('11. telaAcao');

// ---- inspect the question panel -----------------------------------------
// A pergunta abre com o apresentador: o relogio so corre depois do PODE!.
await passarDaAbertura(page);
await shot('09b-jogando');
const panel = await page.evaluate(() => ({
  answers: document.querySelectorAll('#pages [data-alternativa]').length,
  numbers: [...document.querySelectorAll('#pages [data-alternativa] .aud-opcao-num')].map((n) => n.textContent.trim()),
  relogio: document.querySelector('#pages .aud-taco-leitura')?.textContent ?? null,
  hints: document.querySelectorAll('#pages [data-ajuda]').length,
  ajudas: document.querySelector('#pages .aud-aj-titulo')?.textContent ?? null,
  aposta: document.querySelector('#pages .aud-ap-barra span')?.textContent ?? null,
}));
log(`12. panel: ${JSON.stringify(panel)}`);
if (panel.answers !== 4) throw new Error(`a pergunta mostrou ${panel.answers} alternativas`);
if (JSON.stringify(panel.numbers) !== '["1","2","3","4"]') throw new Error(`numeracao das alternativas: ${panel.numbers}`);
if (panel.hints !== 7) throw new Error(`esperava as 7 fichas de ajuda, vieram ${panel.hints}`);

// ---- use a support hint -------------------------------------------------
await page.evaluate(() => document.querySelector('#pages [data-ajuda="apoio"]').click());
// A dica chega como conversa: chamando, a foto, "digitando..." e o texto
// digitado. Espera o TEXTO, e nao o botao: o ENTENDI ja existe (invisivel)
// enquanto a dica esta sendo digitada.
await page.waitForFunction(
  () => (document.querySelector('[data-cartao-ajuda="apoio"] .aud-balao')?.textContent ?? '').length > 20,
  { timeout: 15000 }
);
await wait(300);
await shot('10-ajuda');
const popupText = await page.evaluate(
  () => document.querySelector('[data-cartao-ajuda="apoio"] .aud-balao')?.textContent?.slice(0, 60) ?? null
);
log(`13. hint card: ${JSON.stringify(popupText)}`);
if (!popupText) throw new Error('o cartao da ajuda nao trouxe a dica');
await page.evaluate(() => document.querySelector('[data-cartao-ajuda="apoio"] [data-acao="entendi"]').click());
await wait(600);
const dicasAfter = await page.evaluate(() => ({
  titulo: document.querySelector('#pages .aud-aj-titulo')?.textContent ?? null,
  usada: document.querySelector('#pages [data-ajuda="apoio"]')?.classList.contains('usada'),
}));
log(`14. hints left after using one: ${JSON.stringify(dicasAfter)}`);
if (!dicasAfter.usada) throw new Error('a ficha usada nao virou');
if (!/1 DISPON/.test(dicasAfter.titulo ?? '')) throw new Error(`a contagem de ajudas nao desceu: ${dicasAfter.titulo}`);

// ---- answer -------------------------------------------------------------
const answered = await page.evaluate(() => document.querySelector('#pages [data-alternativa="0"] .aud-opcao-texto')?.textContent ?? null);
if (!answered) throw new Error('no answer cards found');
log(`15. answer 1: ${JSON.stringify(answered.slice(0, 60))}`);
await page.evaluate(() => document.querySelector('#pages [data-alternativa="0"]').click());
await page.waitForSelector('[data-painel="certo"]', { visible: true, timeout: 8000 });
await wait(500);
await shot('11-esta-certo-disso');
const dialogText = await page.evaluate(() => document.querySelector('[data-painel="certo"]')?.textContent?.slice(0, 60) ?? null);
log(`16. esta certo disso: ${JSON.stringify(dialogText)}`);
if (!/CERTO DISSO/.test(dialogText ?? '')) throw new Error('o "Esta certo disso?" nao abriu');
await page.evaluate(() => document.querySelector('[data-painel="certo"] [data-acao="sim"]').click());

// O suspense (2,6s) e o veredito; depois o painel do resultado ou da licao.
await continuar(page, 25000);
const end = await Promise.race([
  waitForRoute('Ganhou', 15000).then(() => 'Ganhou'),
  waitForRoute('Perdeu', 15000).then(() => 'Perdeu'),
]);
await wait(4800);
await shot('12-fim');
log(`17. end screen: ${end}`);

const stored = await page.evaluate(() => ({
  usuarios: JSON.parse(localStorage.getItem('tecgame:usuarios') || '[]'),
  contatos: JSON.parse(localStorage.getItem('tecgame:contatos') || '[]'),
}));
log(`18. usuarios: ${stored.usuarios.length} -> ${JSON.stringify(stored.usuarios[0] ?? null)}`);
log(`    contatos: ${stored.contatos.length} -> ${JSON.stringify(stored.contatos[0] ?? null)}`);
// O ranking e lido publicamente, entao telefone nao pode estar nele.
if (!stored.usuarios.length) throw new Error('nenhum resultado gravado');
if ('telefone' in stored.usuarios[0]) throw new Error('telefone vazou para a colecao do ranking');
if (stored.contatos[0]?.telefone !== '(16) 99703-7115') throw new Error('telefone nao foi para contatos');
if (stored.usuarios[0].nome !== 'Davi Manieri') throw new Error(`o nome gravado perdeu o espaco: ${stored.usuarios[0].nome}`);
// Desde a 3.0 a partida diz QUAL pergunta caiu e QUAL resposta foi escolhida
// (o numero original dela, 1 a 4) — e o que alimenta a ajuda Placas.
if (!stored.usuarios[0].perguntaId) throw new Error('a partida nao gravou qual pergunta caiu');
if (![1, 2, 3, 4].includes(stored.usuarios[0].alternativa)) throw new Error(`alternativa gravada: ${stored.usuarios[0].alternativa}`);

// ---- restart ------------------------------------------------------------
await clickText('REINICIAR');
await waitForRoute('telaVideoTransisao', 15000);
log('19. restart -> transition video');
await waitForRoute('cadastro', 15000);
log('20. back at cadastro');
await shot('13-restart');

await browser.close();

if (errors.length) {
  console.log('\nCONSOLE ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('\nplaythrough clean');
