// A aba "Respostas" do painel: mostra os dados locais com telefone (sem
// precisar de conta nenhuma — é deste navegador mesmo), baixa um CSV de
// verdade, e recusa entrar quando a nuvem está desligada. O caminho
// autenticado da nuvem não entra aqui: pediria uma conta de teste de verdade
// no Firebase do projeto, e a suíte tem de continuar hermética (ver
// config.js).
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
const raiz = BASE.endsWith('.html') ? BASE.replace(/[^/]+$/, '') : `${BASE}/`;
const urlJogo = (rota) => `${raiz}index.html#${rota}`;
const SENHA = '2040';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1400,950'] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 950 });

const falhas = [];
page.on('pageerror', (e) => falhas.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !/ERR_FAILED|js\/main\.js/.test(m.text())) falhas.push('console: ' + m.text());
});
page.on('dialog', (d) => d.accept());

const clicar = async (rotulo) => {
  const ok = await page.evaluate((r) => {
    const b = [...document.querySelectorAll('button, a.botao')].find((n) => {
      const spans = n.querySelectorAll('span');
      const alvo = spans.length ? spans[spans.length - 1].textContent : n.textContent;
      return alvo.trim() === r;
    });
    if (!b) return false;
    b.click();
    return true;
  }, rotulo);
  if (!ok) throw new Error(`não achei o botão "${rotulo}"`);
  await wait(400);
};

const abrirAdmin = async () => {
  await page.goto(urlJogo('/adm'), { waitUntil: 'networkidle2' });
  await wait(700);
  const campo = await page.$('.porta-campo');
  if (campo) {
    await campo.type(SENHA);
    await page.evaluate(() => document.querySelector('.porta-botao--ok').click());
  }
  await page.waitForSelector('#adm .barra', { timeout: 10000 });
  await wait(500);
};

/* ------------------------------------------------------ 0. dados locais -- */

// Semeia usuarios/contatos direto no localStorage: determinístico e rápido,
// e o que se afirma aqui é a aba, não o playthrough (esse já tem o dele).
await page.goto(urlJogo('/cadastro'), { waitUntil: 'networkidle2' });
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
  const agora = Date.now();
  const usuarios = [
    {
      nome: 'Fulano',
      atuacao: 'Oficina',
      venceu: true,
      tempo: 12000,
      equipamento: 'RST',
      invalido: 0,
      data: new Date(agora - 2000).toISOString(),
    },
    {
      nome: 'Ciclana',
      atuacao: 'Concessionária',
      venceu: false,
      tempo: 3000,
      equipamento: 'Rasther 3',
      invalido: 2,
      data: new Date(agora - 1000).toISOString(),
    },
  ];
  const contatos = [{ nome: 'Fulano', telefone: '(11) 91234-5678', data: new Date(agora - 2000).toISOString() }];
  localStorage.setItem('tecgame:usuarios', JSON.stringify(usuarios));
  localStorage.setItem('tecgame:contatos', JSON.stringify(contatos));
});

/* --------------------------------------------------------- 1. abre a aba -- */

await abrirAdmin();
await clicar('Respostas');
await wait(600);

const tela = await page.evaluate(() => ({
  abaAtiva: document.querySelector('.aba-painel.ativa')?.textContent,
  fonte: document.querySelector('.barra-info .situacao')?.textContent,
  linhas: document.querySelectorAll('.tabela tbody tr').length,
  colunas: [...document.querySelectorAll('.tabela thead th')].map((n) => n.textContent),
  primeiraLinha: [...(document.querySelectorAll('.tabela tbody tr')[0]?.children ?? [])].map((n) => n.textContent),
}));
console.log('1. aba respostas ->', JSON.stringify(tela));
if (tela.abaAtiva !== 'Respostas') falhas.push('a aba Respostas não ficou marcada como ativa');
if (!/este navegador/.test(tela.fonte ?? '')) falhas.push(`fonte inesperada: "${tela.fonte}"`);
if (tela.linhas !== 2) falhas.push(`tabela com ${tela.linhas} linha(s), esperava 2`);
if (!tela.colunas.includes('Telefone')) falhas.push('sem login, o telefone LOCAL deveria aparecer do mesmo jeito');
if (!tela.primeiraLinha.includes('(11) 91234-5678')) falhas.push('o telefone do Fulano não apareceu na linha dele');
if (!tela.primeiraLinha.includes('Sim')) falhas.push('"venceu" deveria mostrar "Sim" para o Fulano');

/* ----------------------------------------- 2. troca de aba não perde nada -- */

await clicar('Veículos');
await wait(300);
const voltouVeiculos = await page.evaluate(() => ({
  abaAtiva: document.querySelector('.aba-painel.ativa')?.textContent,
  temLista: !!document.querySelector('.lateral'),
}));
console.log('2. volta a Veículos ->', JSON.stringify(voltouVeiculos));
if (voltouVeiculos.abaAtiva !== 'Veículos') falhas.push('não voltou para a aba Veículos');
if (!voltouVeiculos.temLista) falhas.push('a lista de veículos sumiu ao voltar de aba');

await clicar('Respostas');
await wait(300);

/* --------------------------------------------------------- 3. baixa CSV -- */

const pastaDownload = fs.mkdtempSync(path.join(os.tmpdir(), 'tecgame-download-'));
const cdp = await page.target().createCDPSession();
await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: pastaDownload });
await clicar('Baixar dados');
await wait(900);
const arquivos = fs.readdirSync(pastaDownload);
console.log('3. baixou ->', JSON.stringify(arquivos));
if (arquivos.length !== 1) {
  falhas.push(`"Baixar dados" gerou ${arquivos.length} arquivo(s), esperava 1`);
} else {
  const conteudo = fs.readFileSync(path.join(pastaDownload, arquivos[0]), 'utf8');
  if (!conteudo.includes('Nome;Telefone')) falhas.push('o CSV não começa com o cabeçalho esperado');
  if (!conteudo.includes('Fulano')) falhas.push('o CSV não trouxe a linha do Fulano');
  if (!conteudo.includes('91234-5678')) falhas.push('o CSV não trouxe o telefone');
}
fs.rmSync(pastaDownload, { recursive: true, force: true });

/* ------------------------------------------------- 4. sem nuvem, sem entrar -- */

// Sem ?comNuvem=1 a suíte continua hermética: nem tenta a rede. Por isso o
// botão Entrar nem aparece — não há nuvem nenhuma para entrar (ver
// podeUsarNuvem em firebase.js). Não afirma `entrar()` direto por
// `import()`: dinâmico falha em file:// (origem nula), e é exatamente por
// isso que o jogo aberto do disco nunca alcança o Firebase (ver CLAUDE.md).
const botoesDaAba = await page.evaluate(() =>
  [...document.querySelectorAll('.barra-acoes button')].map((n) => n.textContent.trim())
);
console.log('4. botões da aba respostas ->', JSON.stringify(botoesDaAba));
if (botoesDaAba.some((t) => /Entrar/.test(t))) {
  falhas.push('o botão Entrar não deveria aparecer com a nuvem desligada');
}

await page.evaluate(() => localStorage.clear());
await browser.close();

if (falhas.length) {
  console.log('\nFALHOU:\n- ' + falhas.join('\n- '));
  process.exit(1);
}
console.log('\nrespostas: aba mostra os dados locais com telefone, baixa CSV de verdade, e recusa entrar sem nuvem');
