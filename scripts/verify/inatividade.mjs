// O prazo de inatividade (web/js/inatividade.js): quatro minutos sem toque, e
// qualquer tela do jogo volta ao cadastro, sem a partida de quem foi embora.
//
// Ninguém espera quatro minutos de verdade. O relógio da página corre 80 vezes
// mais rápido — o mesmo truque do ranking do ocioso em dialogs.mjs: o prazo lê
// a hora do `performance.now`, e é só ele que o teste acelera. As animações
// correm na `document.timeline` e as esperas das telas em `setTimeout`, que
// ficam no ritmo de sempre. Quatro minutos de página passam em 3s de parede.
//
// O relógio acelerado adianta também os 45s do ranking do ocioso, que abriria
// por cima dos campos no meio da digitação. Por isso o teste volta o relógio ao
// ritmo normal enquanto alguém digita, e só acelera para esperar o prazo.
//
// Toque, aqui, é toque de verdade (`page.mouse`, `ElementHandle.click`,
// `page.keyboard`): um `el.click()` dentro da página não dispara `pointerdown`,
// e o vigia não o veria. Os cliques sintéticos ficam para o que é navegação.
import puppeteer from 'puppeteer';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
// BASE may be an origin (http://host:port) or a full page URL
// (file:///.../web/index.html), which is how the file:// build is checked.
const pageUrl = (route) => (BASE.endsWith('.html') ? `${BASE}#${route}` : `${BASE}/#${route}`);
const LOCAL_FILE = BASE.startsWith('file:');
// On file:// the module boot is expected to fail and index.html falls back to
// js/bundle.js; that pair of messages is not an app error.
const isBootNoise = (t) => LOCAL_FILE && /js\/main\.js|net::ERR_FAILED/.test(t);
const OUT = process.env.OUT ?? 'shots/inatividade';
fs.mkdirSync(OUT, { recursive: true });

/** Quatro minutos de página em 3s de parede. */
const FATOR_DO_RELOGIO = 80;
const PRAZO_NA_PAREDE_MS = (4 * 60 * 1000) / FATOR_DO_RELOGIO;
/**
 * Para provar que o toque recomeça a contagem, metade da pressa: a batida do
 * vigia é de 1s real, e com o prazo em 3s ela sozinha já embaralharia "contou
 * do toque" com "contou da entrada na tela". Em 6s as duas ficam separadas.
 */
const FATOR_DO_TOQUE = 40;
const PRAZO_DO_TOQUE_MS = (4 * 60 * 1000) / FATOR_DO_TOQUE;
/** O vigia bate a cada 1s real: é a folga para a volta chegar depois do prazo. */
const FOLGA_MS = 2500;

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--window-size=1920,1080', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !isBootNoise(m.text())) {
    errors.push(m.text());
    console.log('  ! ' + m.text());
  }
});
page.on('pageerror', (e) => {
  errors.push(e.message);
  console.log('  ! ' + e.message);
});

// Acumulativo, como em dialogs.mjs: trocar o fator no meio do caminho nunca faz
// a hora andar para trás.
await page.evaluateOnNewDocument((fator) => {
  const real = performance.now.bind(performance);
  let ultimo = real();
  let virtual = ultimo;
  window.__fatorDoRelogio = fator;
  performance.now = () => {
    const agora = real();
    virtual += (agora - ultimo) * window.__fatorDoRelogio;
    ultimo = agora;
    return virtual;
  };
}, FATOR_DO_RELOGIO);

const relogio = (fator) =>
  page.evaluate((f) => {
    window.__fatorDoRelogio = f;
  }, fator);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const route = () => page.evaluate(() => document.querySelector('.ff-page')?.dataset.route ?? null);
const avisos = () => page.evaluate(() => document.getElementById('overlays').innerText);
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const log = console.log;
const falhas = [];
const conferir = (ok, msg) => {
  log(`  ${ok ? 'ok' : 'FALHOU'} - ${msg}`);
  if (!ok) falhas.push(msg);
};

async function waitForRoute(name, timeout = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if ((await route()) === name) return true;
    await wait(100);
  }
  return false;
}

/** Tira o ranking do ocioso da frente, como o próximo visitante: tocando na tela. */
async function fecharORanking() {
  await page.waitForSelector('#overlays .ff-barrier', { timeout: 8000 });
  await page.mouse.click(960, 540);
  await page.waitForFunction(() => !document.querySelector('#overlays .ff-barrier'), { timeout: 5000 });
}

/** O que sobrou da partida no estado do jogo. */
const partida = () =>
  page.evaluate(async () => {
    // Por HTTP roda o modulo ES e import() funciona; por file:// roda o bundle
    // classico e o import() dinamico e recusado, entao vem pelo __tecgameRequire.
    const carregar = async (m) => (window.__tecgameRequire ? window.__tecgameRequire(m) : await import(`./js/${m}`));
    const { FFAppState } = await carregar('state.js');
    return {
      nome: FFAppState.cadastro.nome,
      telefone: FFAppState.cadastro.telefone,
      invalido: FFAppState.cadastro.invalido,
      scanner: FFAppState.scannerEscolhido,
      resultado: FFAppState.resultado,
    };
  });

const semPartida = (p) => p.nome === '' && p.telefone === '' && p.scanner === '' && p.resultado == null;

/** Uma partida em andamento, largada por alguém, e o jogo levado para `tela`. */
const largarPartidaEm = (tela) =>
  page.evaluate(async (destino) => {
    const carregar = async (m) => (window.__tecgameRequire ? window.__tecgameRequire(m) : await import(`./js/${m}`));
    const { FFAppState, CadastroStruct } = await carregar('state.js');
    const { goNamed } = await carregar('router.js');
    FFAppState.cadastro = new CadastroStruct({ nome: 'Largou', telefone: '(16) 99999-0000', atuacao: 'x' });
    FFAppState.scannerEscolhido = 'RB';
    FFAppState.resultado = {
      acertou: false,
      tempo: 0,
      numeroCerto: 1,
      textoCerto: 'a certa',
      numeroEscolhido: 2,
      textoEscolhido: 'a escolhida',
    };
    goNamed(destino);
  }, tela);

await page.goto(pageUrl('/cadastro'), { waitUntil: 'networkidle2' });
// Os avisos são conferidos pelo texto, então o idioma é fixado.
await page.evaluate(async () => {
  const carregar = async (m) => (window.__tecgameRequire ? window.__tecgameRequire(m) : await import(`./js/${m}`));
  const { setAppLanguage } = await carregar('i18n.js');
  setAppLanguage('pt');
});
await waitForRoute('cadastro');

/* -------------------------------------------- a roleta, largada no meio -- */
log('--- roleta: um toque recomeça a contagem, e quatro minutos parado voltam ao cadastro');
await relogio(FATOR_DO_TOQUE);
await largarPartidaEm('roleta');
conferir(await waitForRoute('roleta'), 'a partida chegou na roleta');
const naRoleta = Date.now();
// Antes de qualquer prazo possível (o mais cedo é 6s depois de a tela entrar),
// um toque no fundo, longe do GIRAR.
await wait(PRAZO_DO_TOQUE_MS * 0.8);
conferir((await route()) === 'roleta', 'antes do prazo a roleta continua');
await page.mouse.click(60, 60);
const tocou = Date.now();
const voltou = await waitForRoute('cadastro', PRAZO_DO_TOQUE_MS + FOLGA_MS + 2000);
const depoisDoToque = Date.now() - tocou;
conferir(voltou, `quatro minutos parado, e a roleta voltou ao cadastro (${Date.now() - naRoleta} ms de parede)`);
// Contando da entrada na tela, a volta viria no máximo ~3,2s depois do toque;
// contando do toque, vem no mínimo 6s depois dele. Só vale se a volta veio: sem
// ela, `depoisDoToque` é só o tamanho da espera, e passaria sem provar nada.
conferir(
  voltou && depoisDoToque >= PRAZO_DO_TOQUE_MS - 100,
  voltou
    ? `a contagem recomeçou no toque: a volta veio ${depoisDoToque} ms depois dele`
    : 'a contagem recomeçou no toque (não dá para saber: a roleta não voltou)'
);
await relogio(FATOR_DO_RELOGIO);
const depoisDaRoleta = await partida();
conferir(semPartida(depoisDaRoleta), `a partida de quem largou foi esquecida (${JSON.stringify(depoisDaRoleta)})`);
await shot('01-roleta-voltou');

/* --------------------------------------------------- o fim de jogo largado */
log('--- fim de jogo: ninguém apertou REINICIAR');
await largarPartidaEm('Perdeu');
conferir(await waitForRoute('Perdeu'), 'a partida chegou na tela de derrota');
conferir(await waitForRoute('cadastro', PRAZO_NA_PAREDE_MS + FOLGA_MS + 2000), 'o fim de jogo voltou sozinho ao cadastro');
const depoisDoFim = await partida();
conferir(semPartida(depoisDoFim), `o resultado e o cadastro foram esquecidos (${JSON.stringify(depoisDoFim)})`);

/* ------------------------- a escolha do equipamento, com um aviso aberto -- */
log('--- escolha do equipamento com o aviso de equipamento inválido aberto');
await largarPartidaEm('scanner');
conferir(await waitForRoute('scanner'), 'a partida chegou na escolha do equipamento');
// Os cinco pousam um a um; espera o último assentar antes de mirar.
await wait(1400);
const invalido = await page.$('#pages .ff-ferramenta-entra [style*="opacity: 0.2"] .ff-inkwell');
conferir(Boolean(invalido), 'há um equipamento que não resolve a pergunta desta rodada');
if (invalido) await invalido.click();
await wait(600);
conferir((await avisos()).includes('EQUIPAMENTO INVÁLIDO'), 'o aviso de equipamento inválido está aberto');
conferir(await waitForRoute('cadastro', PRAZO_NA_PAREDE_MS + FOLGA_MS + 2000), 'o aviso aberto não segurou a volta');
await wait(300);
conferir(!(await avisos()).includes('EQUIPAMENTO INVÁLIDO'), 'o aviso foi fechado junto');

/* ---------------------------------------------------- o cadastro vazio ---- */
log('--- cadastro vazio: não há o que apagar, e o ranking do ocioso segue');
await page.evaluate(() => {
  document.querySelector('.ff-page').dataset.marca = 'vazio';
});
await wait(PRAZO_NA_PAREDE_MS + FOLGA_MS);
conferir(Boolean(await page.$('.ff-page[data-marca="vazio"]')), 'passado o prazo, o cadastro vazio é o mesmo — não foi refeito');
conferir((await avisos()).includes('Rank dos melhores'), 'o ranking do ocioso continua na tela');
await shot('02-cadastro-vazio-com-ranking');

/* ------------------------------------------- a ficha largada pela metade -- */
log('--- cadastro com a ficha começada e o aviso de nome ofensivo aberto');
await relogio(1);
await fecharORanking();
const inputs = await page.$$('#pages input.ff-input');
await inputs[0].click();
await inputs[0].type('boceta');
await inputs[1].click();
await inputs[1].type('16997037115');
await (await page.$('#pages .ff-inkwell[aria-label="CONFIRMAR"]')).click();
await wait(500);
conferir((await avisos()).includes('Nome inválido'), 'o aviso de nome inválido abriu');
await page.evaluate(() => {
  document.querySelector('.ff-page').dataset.marca = 'preenchido';
});
// Quem digitou foi embora com o aviso aberto.
await relogio(FATOR_DO_RELOGIO);
const refez = await page
  .waitForFunction(() => !document.querySelector('.ff-page[data-marca="preenchido"]'), {
    timeout: PRAZO_NA_PAREDE_MS + FOLGA_MS + 2000,
  })
  .then(() => true)
  .catch(() => false);
await relogio(1);
await wait(400);
const campos = await page.evaluate(() => [...document.querySelectorAll('#pages input.ff-input')].map((i) => i.value));
conferir(refez && campos.length === 2 && campos.every((v) => v === ''), `a ficha largada foi apagada (campos: ${JSON.stringify(campos)})`);
conferir(!(await avisos()).includes('Nome inválido'), 'o aviso de nome inválido foi fechado junto');
// Os campos entram deslizando em até 2,6s; a captura espera, para mostrá-los vazios.
await wait(2400);
await shot('03-ficha-apagada');

// O próximo visitante se cadastra. A tentativa de nome ofensivo de quem saiu
// não pode vir junto — é o que a conta antes do `await` do aviso garante.
const novos = await page.$$('#pages input.ff-input');
await novos[0].click();
await novos[0].type('Visitante');
await novos[1].click();
await novos[1].type('16999990000');
await (await page.$('#pages .ff-inkwell[aria-label="CONFIRMAR"]')).click();
await wait(300);
const proximo = await partida();
conferir(proximo.nome === 'Visitante', `o próximo visitante se cadastrou (${JSON.stringify(proximo.nome)})`);
conferir(proximo.invalido === 0, `sem herdar a tentativa de nome ofensivo de quem saiu (invalido = ${proximo.invalido})`);
conferir(await waitForRoute('instrucoes', 8000), 'e a partida dele começou');

/* ----------------------------------------------------------- o painel ----- */
log('--- o painel não tem prazo');
await page.evaluate(() => {
  location.hash = '#/adm';
});
await page.waitForSelector('.porta-campo', { timeout: 8000 });
await page.type('.porta-campo', '2040');
await page.keyboard.press('Enter');
await page.waitForSelector('#adm:not([hidden])', { timeout: 8000 });
await relogio(FATOR_DO_RELOGIO);
await wait(PRAZO_NA_PAREDE_MS * 2 + FOLGA_MS);
const painel = await page.evaluate(() => ({
  aberto: !document.getElementById('adm').hidden,
  rota: document.querySelector('.ff-page')?.dataset.route ?? null,
}));
conferir(
  painel.aberto && painel.rota === 'adm',
  `passado o dobro do prazo, o painel continua aberto (${JSON.stringify(painel)})`
);
await shot('04-painel-continua');

await browser.close();

if (errors.length) falhas.push(`${errors.length} erro(s) de console`);
if (falhas.length) {
  console.error(`\n${falhas.length} falha(s):\n  ${falhas.join('\n  ')}`);
  process.exit(1);
}
log('\nOK - quatro minutos parado devolvem o jogo ao cadastro, limpo; o painel fica de fora');
