// O "voltar" do navegador dentro da administração (3.4).
//
// O jogo troca de tela com `replaceState`, então a sessão toda é UMA entrada no
// histórico — e quem apertava "voltar" na administração saía do jogo. O que se
// afirma aqui é o histórico de verdade (`page.goBack`), nos três jeitos de
// chegar ao painel:
//
//  1. o gesto: cinco toques no selo do cadastro;
//  2. o endereço `#/adm` digitado numa aba nova — a única entrada do histórico,
//     que o roteador põe sobre a tela do jogo no primeiro gesto;
//  3. o botão "Voltar ao jogo", que desempilha a entrada em vez de somar uma
//     igual a cada ida e volta.
//
// Cada trecho começa de `about:blank`: é o que o "voltar" alcançaria se saísse
// do jogo, e é isso que o teste não pode ver.
import puppeteer from 'puppeteer';
import fs from 'node:fs';

const OUT = process.env.OUT ?? 'shots/voltar';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
const raiz = BASE.endsWith('.html') ? BASE.replace(/[^/]+$/, '') : `${BASE}/`;
const urlJogo = (rota) => `${raiz}index.html#${rota}`;
const SENHA = '2040';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1500,1000'] });
const falhas = [];
const conferir = (ok, msg) => {
  console.log(`  ${ok ? 'ok' : 'FALHOU'} - ${msg}`);
  if (!ok) falhas.push(msg);
};

/** Uma aba nova, que parte de `about:blank` — o fundo do histórico. */
async function novaAba() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1000 });
  page.on('pageerror', (e) => falhas.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_FAILED|js\/main\.js/.test(m.text())) falhas.push('console: ' + m.text());
  });
  page.on('dialog', (d) => d.accept());
  await page.goto('about:blank');
  return page;
}

/** Onde o navegador está: a tela do jogo, a camada do painel e o endereço. */
const situacao = (page) =>
  page.evaluate(() => ({
    url: location.href,
    rota: document.querySelector('.ff-page')?.dataset.route ?? null,
    painelAberto: document.getElementById('adm') ? !document.getElementById('adm').hidden : false,
    jogoVisivel: document.getElementById('viewport') ? !document.getElementById('viewport').hidden : false,
    // As novidades abrem sozinhas na primeira vez; o "voltar" não pode deixar o
    // diálogo de pé em cima do jogo.
    dialogos: document.querySelectorAll('.modal-fundo').length,
  }));

const noJogo = (s) => /index\.html/.test(s.url) && s.rota === 'cadastro' && !s.painelAberto && s.jogoVisivel && s.dialogos === 0;

/** Digita a senha local — é o caminho da suíte (sem nuvem, não há login). */
async function digitarSenha(page) {
  await page.waitForSelector('.porta-campo', { timeout: 15000 }).then((h) => h.dispose());
  await page.type('.porta-campo', SENHA);
  await page.evaluate(() => document.querySelector('.porta-botao--ok').click());
  await page.waitForSelector('#adm .barra', { timeout: 15000 }).then((h) => h.dispose());
  await wait(500);
}

const voltar = async (page) => {
  await page.goBack({ timeout: 8000 }).catch(() => {});
  await wait(900);
};

/* ----------------------------------------------- 1. o gesto: cinco toques -- */

console.log('--- 1. cinco toques no selo, e o "voltar" do navegador');
{
  const page = await novaAba();
  await page.goto(urlJogo('/cadastro'), { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await wait(2000);
  const selo = '#pages .aud-selo';
  await page.waitForSelector(selo, { timeout: 15000 }).then((h) => h.dispose());
  for (let i = 0; i < 5; i++) await page.click(selo);
  await digitarSenha(page);

  const dentro = await situacao(page);
  conferir(dentro.painelAberto && /#\/adm/.test(dentro.url), `o painel abriu (${dentro.url})`);
  conferir(await page.evaluate(() => history.state?.sobreOJogo === true), 'a entrada do painel é própria, marcada como "sobre o jogo"');

  await voltar(page);
  const aposVoltar = await situacao(page);
  console.log('  depois do voltar:', JSON.stringify(aposVoltar));
  conferir(noJogo(aposVoltar), 'o "voltar" fechou o painel e ficou no jogo, no cadastro');
  await page.screenshot({ path: `${OUT}/01-voltou-ao-jogo.png` });

  // E "avançar" reabre o painel, sem pedir a senha de novo (a porta fica
  // destrancada na sessão).
  await page.goForward({ timeout: 8000 }).catch(() => {});
  await wait(1200);
  const aposAvancar = await situacao(page);
  conferir(aposAvancar.painelAberto, 'o "avançar" reabriu o painel');

  /* ------------- 3. o botão desempilha em vez de somar uma entrada igual -- */
  console.log('--- 3. "Voltar ao jogo" desempilha');
  await page.evaluate(() =>
    [...document.querySelectorAll('button')].find((b) => /Voltar ao jogo/.test(b.textContent)).click()
  );
  await wait(1200);
  const aposBotao = await situacao(page);
  conferir(noJogo(aposBotao), `o botão levou ao cadastro (${aposBotao.url})`);
  // Se o botão apenas trocasse a entrada do painel pela do cadastro, sobrariam
  // DUAS entradas iguais, e este "voltar" ainda estaria no jogo.
  await voltar(page);
  const fora = await situacao(page);
  conferir(fora.url === 'about:blank', `um "voltar" depois do botão sai do jogo — não sobrou entrada duplicada (${fora.url})`);
  await page.close();
}

/* --------------------------------- 2. o endereço digitado numa aba nova ---- */

console.log('--- 2. #/adm digitado numa aba nova');
{
  const page = await novaAba();
  await page.goto(urlJogo('/adm'), { waitUntil: 'networkidle2' });
  // O primeiro gesto é o que empilha a tela do jogo por baixo (ver
  // `empilharNoPrimeiroGesto`, router.js); aqui é a digitação da senha.
  await digitarSenha(page);
  conferir(await page.evaluate(() => history.state?.sobreOJogo === true), 'depois do primeiro gesto o painel tem entrada própria');

  await voltar(page);
  const aposVoltar = await situacao(page);
  console.log('  depois do voltar:', JSON.stringify(aposVoltar));
  conferir(noJogo(aposVoltar), 'o "voltar" da aba nova levou ao jogo, e não para fora dele');
  await page.screenshot({ path: `${OUT}/02-aba-nova.png` });
  await page.close();
}

await browser.close();
if (falhas.length) {
  console.log('\nFALHOU:\n- ' + falhas.join('\n- '));
  process.exit(1);
}
console.log('\nvoltar: o "voltar" do navegador fecha o painel e fica no jogo, nos três jeitos de entrar');
