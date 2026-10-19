// A porta com login: o diagnóstico que ela mostra em cada caminho, e a caixa
// "Manter conectado" chegando até o SDK.
//
// O Firebase daqui é FALSO. As três URLs do SDK na CDN são interceptadas e
// respondidas com módulos de mentira (abaixo): testar contra o projeto de
// verdade pediria uma conta de teste lá, e a suíte tem de continuar hermética
// (ver config.js). O que se afirma é o encanamento do jogo — que a caixa vira
// o `setPersistence` certo, que a recusa vira um aviso com o código, que a
// sessão guardada abre a porta sem perguntar. Que o SDK de verdade guarda a
// sessão onde `setPersistence` mandou é contrato dele, não nosso.
//
// Por file:// só o primeiro trecho vale: o jogo aberto do disco nunca alcança
// o Firebase, e o que se afirma ali é que o aviso diz isso.
import puppeteer from 'puppeteer';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
const OUT = process.env.OUT ?? 'shots/login';
fs.mkdirSync(OUT, { recursive: true });
const emDisco = BASE.endsWith('.html');
const raiz = emDisco ? BASE.replace(/[^/]+$/, '') : `${BASE}/`;
const url = (busca, rota) => `${raiz}index.html${busca}#${rota}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const CDN = 'https://www.gstatic.com/firebasejs/';
const CHAVE_USUARIO = 'authFalso:usuario';

/* ------------------------------------------------------- o SDK de mentira -- */

const SDK_FALSO = {
  'firebase-app.js': `export const initializeApp = (opcoes) => ({ opcoes });`,

  // O painel com nuvem lê o baralho e a última publicação ao abrir: um banco
  // vazio basta, e o jogo cai no baralho local como faria sem nada publicado.
  'firebase-firestore.js': `
    const vazio = { exists: () => false, data: () => undefined };
    const nada = (...a) => a;
    export const getFirestore = () => ({});
    export const doc = nada, collection = nada, query = nada, orderBy = nada, limit = nada, where = nada;
    export const serverTimestamp = () => null;
    export const getDoc = async () => vazio;
    export const getDocs = async () => ({ docs: [], empty: true, size: 0, forEach() {} });
    export const setDoc = async () => {};
    export const addDoc = async () => ({ id: 'falso' });
  `,

  // Imita o que importa do SDK de verdade: a sessão vai para o sessionStorage
  // ou para o localStorage conforme o \`setPersistence\`, e é restaurada de lá
  // ao carregar. Senha certa é "certa"; qualquer outra, a recusa que o projeto
  // real devolve (com a proteção contra enumeração de e-mail ligada).
  'firebase-auth.js': `
    const K = '${CHAVE_USUARIO}';
    const guardado = sessionStorage.getItem(K) ?? localStorage.getItem(K);
    const estado = (window.__authFalso = {
      persistencias: [],
      usuario: guardado ? JSON.parse(guardado) : null,
      ouvintes: [],
    });
    let onde = 'LOCAL';
    const avisar = () => estado.ouvintes.forEach((f) => f(estado.usuario));
    export const browserSessionPersistence = { tipo: 'SESSION' };
    export const indexedDBLocalPersistence = { tipo: 'LOCAL' };
    export const getAuth = () => ({});
    export const setPersistence = async (_a, p) => { onde = p.tipo; estado.persistencias.push(p.tipo); };
    export const signInWithEmailAndPassword = async (_a, email, senha) => {
      if (senha !== 'certa') {
        const e = new Error('Firebase: Error (auth/invalid-credential).');
        e.code = 'auth/invalid-credential';
        throw e;
      }
      estado.usuario = { email };
      sessionStorage.removeItem(K);
      localStorage.removeItem(K);
      (onde === 'SESSION' ? sessionStorage : localStorage).setItem(K, JSON.stringify(estado.usuario));
      avisar();
      return { user: estado.usuario };
    };
    export const onAuthStateChanged = (_a, fn) => {
      estado.ouvintes.push(fn);
      queueMicrotask(() => fn(estado.usuario));
      return () => { estado.ouvintes = estado.ouvintes.filter((f) => f !== fn); };
    };
    export const signOut = async () => {
      estado.usuario = null;
      sessionStorage.removeItem(K);
      localStorage.removeItem(K);
      avisar();
    };
  `,
};

/* ------------------------------------------------------------ o navegador -- */

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1400,950'] });
const falhas = [];

/** Uma aba nova: sessionStorage vazio, localStorage compartilhado com as outras. */
async function abaNova() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 950 });
  page.on('pageerror', (e) => falhas.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_FAILED|js\/main\.js|firebasestorage/.test(m.text())) {
      falhas.push('console: ' + m.text());
    }
  });
  page.on('dialog', (d) => d.accept());
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (!u.startsWith(CDN)) return req.continue();
    const corpo = SDK_FALSO[u.split('/').pop()];
    if (!corpo) return req.respond({ status: 404, body: '' });
    // Módulo de outra origem só roda com CORS — como o da CDN de verdade.
    req.respond({
      status: 200,
      contentType: 'text/javascript',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: corpo,
    });
  });
  return page;
}

const avisos = (page) => page.evaluate(() => document.querySelector('.avisos')?.innerText ?? '');
const conferir = (ok, rotulo) => {
  console.log(`${ok ? 'ok  ' : 'FALHOU'} ${rotulo}`);
  if (!ok) falhas.push(rotulo);
};

/* -------------------------------------------- 1. sem nuvem: o aviso diz por quê -- */

{
  const page = await abaNova();
  await page.goto(url('', '/adm'), { waitUntil: 'networkidle2' });
  await page.waitForSelector('.porta-campo', { timeout: 8000 });
  await wait(300);
  const texto = await avisos(page);
  console.log('1. aviso sem nuvem ->', JSON.stringify(texto));
  conferir(/Sem Firebase aqui/.test(texto), 'a caixa da senha local vem com o aviso de por que não há login');
  conferir(
    emDisco ? /file:\/\//.test(texto) : /\?comNuvem=1#\/adm/.test(texto),
    emDisco ? 'o aviso diz que o jogo foi aberto do disco' : 'o aviso ensina o ?comNuvem=1 no lugar certo'
  );
  // O aviso tem de ficar POR CIMA do véu da porta, senão ninguém o lê.
  const porCima = await page.evaluate(() => {
    const a = document.querySelector('.aviso');
    if (!a) return false;
    const r = a.getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.aviso') === a;
  });
  conferir(porCima, 'o aviso fica por cima da caixa da porta');
  await page.screenshot({ path: `${OUT}/1-sem-nuvem.png` });

  // A mesma aba entra pela senha e depois ganha a nuvem: a porta não pergunta
  // de novo, e o aviso tem de dizer isso em vez de deixar o login "sumir".
  await page.type('.porta-campo', '2040');
  await page.evaluate(() => document.querySelector('.porta-botao--ok').click());
  await page.waitForSelector('#adm .barra', { timeout: 10000 });

  if (!emDisco) {
    await page.goto(url('?comNuvem=1', '/cadastro'), { waitUntil: 'networkidle2' });
    await page.goto(url('?comNuvem=1', '/adm'), { waitUntil: 'networkidle2' });
    await page.waitForSelector('#adm .barra', { timeout: 10000 });
    await wait(300);
    const depois = await avisos(page);
    console.log('1b. aviso com a porta já aberta ->', JSON.stringify(depois));
    conferir(/já foi aberta nesta aba pela senha local/.test(depois), 'a porta aberta pela senha avisa que não vai pedir login');
  }
  await page.close();
}

/* -------------------------------------- 2. com nuvem: recusa, sessão, manter -- */

if (!emDisco) {
  const pedeLogin = (page) => page.waitForSelector('.modal input[type=email]', { timeout: 8000 });
  const preencher = async (page, senha, { manter = false } = {}) => {
    await page.evaluate(() => {
      for (const i of document.querySelectorAll('.modal input')) if (i.type !== 'checkbox') i.value = '';
    });
    await page.type('.modal input[type=email]', 'operador@tecnomotor.com.br');
    await page.type('.modal input[type=password]', senha);
    if (manter) await page.click('.manter-conectado input');
    await page.keyboard.press('Enter');
  };

  // 2a. Senha errada: o aviso traz o código e o que conferir.
  const a = await abaNova();
  await a.goto(url('?comNuvem=1', '/adm'), { waitUntil: 'networkidle2' });
  await pedeLogin(a);
  conferir(
    await a.evaluate(() => document.querySelector('.manter-conectado input')?.checked === false),
    '"Manter conectado" existe e nasce desmarcada'
  );
  await preencher(a, 'errada');
  await pedeLogin(a);
  await wait(300);
  const recusa = await avisos(a);
  console.log('2a. aviso da recusa ->', JSON.stringify(recusa));
  // Só o código: o que cada código diz, e a dica que o acompanha, é afirmado
  // em unidade/login.test.mjs. Aqui importa que o erro do SDK chegue à tela.
  conferir(/\[auth\/invalid-credential\]/.test(recusa), 'a recusa mostra o código do Firebase');
  await a.screenshot({ path: `${OUT}/2a-recusa.png` });

  // 2b. Senha certa, caixa desmarcada: a sessão é só desta aba.
  await preencher(a, 'certa');
  await a.waitForSelector('#adm .barra', { timeout: 10000 });
  const pers = await a.evaluate(() => window.__authFalso.persistencias.at(-1));
  conferir(pers === 'SESSION', `desmarcada, a sessão vai para a aba (setPersistence ${pers})`);
  conferir(/até fechar esta aba/.test(await avisos(a)), 'o aviso de entrada diz até quando dura');

  // Outra aba não herda a sessão da aba: a porta pede login de novo.
  const b = await abaNova();
  await b.goto(url('?comNuvem=1', '/adm'), { waitUntil: 'networkidle2' });
  const pediuDeNovo = await pedeLogin(b).then(() => true, () => false);
  conferir(pediuDeNovo, 'desmarcada, uma aba nova pede login de novo');

  // 2c. Marcada: vale para a próxima aba também, sem perguntar.
  await preencher(b, 'certa', { manter: true });
  await b.waitForSelector('#adm .barra', { timeout: 10000 });
  const pers2 = await b.evaluate(() => window.__authFalso.persistencias.at(-1));
  conferir(pers2 === 'LOCAL', `marcada, a sessão fica no navegador (setPersistence ${pers2})`);

  const c = await abaNova();
  await c.goto(url('?comNuvem=1', '/adm'), { waitUntil: 'networkidle2' });
  const abriuDireto = await c.waitForSelector('#adm .barra', { timeout: 10000 }).then(() => true, () => false);
  const semPergunta = await c.evaluate(() => !document.querySelector('.modal input[type=email]'));
  conferir(abriuDireto && semPergunta, 'marcada, a aba nova entra sem perguntar');
  conferir(/pela sessão guardada/.test(await avisos(c)), 'o aviso diz que entrou pela sessão guardada');
  await c.screenshot({ path: `${OUT}/2c-sessao-guardada.png` });

  await c.evaluate((k) => localStorage.removeItem(k), CHAVE_USUARIO);
}

await browser.close();

if (falhas.length) {
  console.log('\nFALHOU:\n- ' + falhas.join('\n- '));
  process.exit(1);
}
console.log(
  emDisco
    ? '\nlogin: pelo disco, a porta diz por que não há login'
    : '\nlogin: a porta diz por que pede o que pede, a recusa vem com código, e "Manter conectado" decide onde a sessão fica'
);
