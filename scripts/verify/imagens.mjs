// Foto de veículo no Firebase Storage: o totem mostrando a foto pelo
// endereço, e o painel enviando, reaproveitando, limpando o que sobrou e
// recusando publicar foto que sumiu.
//
// O Firebase daqui é FALSO, como em verify/login.mjs: as URLs do SDK na CDN são
// respondidas com módulos de mentira, e o Storage é um objeto na página
// (`window.__storageFalso`). Os pedidos de foto a firebasestorage.googleapis.com
// também são interceptados e respondidos com uma foto do projeto — a suíte não
// sai para a rede. O que se afirma é o encanamento do jogo; que o Storage de
// verdade cumpre o que o SDK promete é contrato dele.
//
// Por file:// só o primeiro trecho vale, e é o que mais importa ali: o totem
// abre do disco, e a foto do Storage tem de aparecer na roleta assim mesmo
// (SVG `<image>` de outra origem, sem CORS). Enviar exige login, e o jogo
// aberto do disco nunca alcança o Firebase.
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_DISCO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
const OUT = process.env.OUT ?? 'shots/imagens';
fs.mkdirSync(OUT, { recursive: true });
const emDisco = BASE.endsWith('.html');
const raiz = emDisco ? BASE.replace(/[^/]+$/, '') : `${BASE}/`;
const url = (busca, rota) => `${raiz}index.html${busca}#${rota}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const CDN = 'https://www.gstatic.com/firebasejs/';
const HOST_STORAGE = 'https://firebasestorage.googleapis.com/';
const BUCKET = 'tecnogame-c7e46.firebasestorage.app';
const DIA = 24 * 60 * 60 * 1000;

// O que a foto servida pelo "Storage" é, de fato: qualquer PNG do projeto.
const FOTO_SERVIDA = fs.readFileSync(path.join(RAIZ_DISCO, 'web', 'assets', 'images', 'BMW.png'));
const FOTO_ENVIADA = path.join(RAIZ_DISCO, 'web', 'assets', 'images', 'BMW.png');
const OUTRA_FOTO = path.join(RAIZ_DISCO, 'web', 'assets', 'images', 'Volvo_XC_60.png');

/** Três fotos que já estão no Storage quando o teste começa. */
const hex = (c) => c.repeat(64);
const EM_USO_VELHA = `veiculos/${hex('c')}.webp`; // citada pelo baralho, parada há 30 dias: fica
const ORFA_VELHA = `veiculos/${hex('a')}.webp`; //   ninguém cita, parada há 30 dias: sai
const ORFA_NOVA = `veiculos/${hex('b')}.webp`; //    ninguém cita, enviada ontem: fica (carência)
const enderecoDe = (caminho, token) =>
  `${HOST_STORAGE}v0/b/${BUCKET}/o/${encodeURIComponent(caminho)}?alt=media&token=${token}`;

// O baralho de fábrica com a foto do segundo veículo no Storage.
const { BARALHO_ORIGINAL } = await import('../../web/js/deck.js');
const BARALHO_SEMEADO = JSON.parse(JSON.stringify(BARALHO_ORIGINAL));
BARALHO_SEMEADO.slots[1].veiculo.imagem = enderecoDe(EM_USO_VELHA, 'token-c');

/* ------------------------------------------------------- o SDK de mentira -- */

const SDK_FALSO = {
  'firebase-app.js': `export const initializeApp = (opcoes) => ({ opcoes });`,

  // Nada publicado na nuvem: o painel fica com o baralho semeado. O que o
  // Salvar grava fica em `__firestoreFalso.gravados`.
  'firebase-firestore.js': `
    const F = (window.__firestoreFalso = { gravados: [] });
    const vazio = { exists: () => false, data: () => undefined };
    const nada = (...a) => a;
    export const getFirestore = () => ({});
    export const doc = nada, collection = nada, query = nada, orderBy = nada, limit = nada, where = nada;
    export const serverTimestamp = () => null;
    export const getDoc = async () => vazio;
    export const getDocs = async () => ({ docs: [], empty: true, size: 0, forEach() {} });
    export const setDoc = async (_ref, dados) => { F.gravados.push(JSON.parse(JSON.stringify(dados))); };
    export const addDoc = async () => ({ id: 'falso' });
  `,

  'firebase-auth.js': `
    const estado = { usuario: null, ouvintes: [] };
    export const browserSessionPersistence = {}, indexedDBLocalPersistence = {};
    export const getAuth = () => ({});
    export const setPersistence = async () => {};
    export const signInWithEmailAndPassword = async (_a, email) => {
      estado.usuario = { email };
      estado.ouvintes.forEach((f) => f(estado.usuario));
      return { user: estado.usuario };
    };
    export const onAuthStateChanged = (_a, fn) => {
      estado.ouvintes.push(fn);
      queueMicrotask(() => fn(estado.usuario));
      return () => {};
    };
    export const signOut = async () => {};
  `,

  // As regras de storage.rules no que importa aqui: sobrescrever é recusado.
  // \`recusar\` liga a recusa de tudo, para o caminho de quem fica sem Storage.
  // O envio sobe em três pedaços ao longo de \`atrasoMs\`, para a tela de
  // "enviando" durar o bastante para ser vista — e para tentar salvar no meio.
  'firebase-storage.js': `
    const S = window.__storageFalso;
    const falha = (code) => Object.assign(new Error(code), { code });
    export const getStorage = () => ({});
    export const ref = (_s, caminho) => ({ fullPath: caminho });
    export const getMetadata = async (r) => {
      const a = S.arquivos[r.fullPath];
      if (!a) throw falha('storage/object-not-found');
      return { updated: a.atualizado, timeCreated: a.atualizado, contentType: a.tipo };
    };
    export const updateMetadata = async (r) => {
      const a = S.arquivos[r.fullPath];
      if (!a) throw falha('storage/object-not-found');
      a.atualizado = new Date().toISOString();
      S.toques.push(r.fullPath);
      return {};
    };
    export const uploadBytesResumable = (r, bytes, meta) => {
      const ouvintes = [];
      const promessa = (async () => {
        // Bucket que não existe: o SDK de verdade só traduz 401/402/403, e o 404
        // do envio chega como \`storage/unknown\` com o corpo cru do servidor.
        if (S.recusar === 'bucket') {
          const e = falha('storage/unknown');
          e.message = 'Firebase Storage: An unknown error occurred, please check the error payload for server response. (storage/unknown)';
          e.serverResponse = '{"error":{"code":404,"message":"Not Found."}}';
          throw e;
        }
        if (S.recusar || S.arquivos[r.fullPath]) throw falha('storage/unauthorized');
        for (const f of [0.3, 0.7, 1]) {
          await new Promise((ok) => setTimeout(ok, S.atrasoMs / 3));
          ouvintes.forEach((fn) => fn({ bytesTransferred: Math.round(bytes.length * f), totalBytes: bytes.length }));
        }
        S.arquivos[r.fullPath] = {
          tipo: meta.contentType, cache: meta.cacheControl, tamanho: bytes.length,
          atualizado: new Date().toISOString(), token: 'token-' + S.envios.length,
        };
        S.envios.push(r.fullPath);
        return { ref: r };
      })();
      return { on: (_evento, fn) => void ouvintes.push(fn), then: (a, b) => promessa.then(a, b) };
    };
    export const getDownloadURL = async (r) => {
      const a = S.arquivos[r.fullPath];
      if (!a) throw falha('storage/object-not-found');
      return '${HOST_STORAGE}v0/b/${BUCKET}/o/' + encodeURIComponent(r.fullPath) + '?alt=media&token=' + a.token;
    };
    export const listAll = async (r) => ({
      items: Object.keys(S.arquivos).filter((c) => c.startsWith(r.fullPath + '/')).map((c) => ({ fullPath: c })),
      prefixes: [],
    });
    export const deleteObject = async (r) => {
      delete S.arquivos[r.fullPath];
      S.apagados.push(r.fullPath);
    };
  `,
};

/* ------------------------------------------------------------ o navegador -- */

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1500,1000'] });
const falhas = [];
const conferir = (ok, rotulo) => {
  console.log(`${ok ? 'ok  ' : 'FALHOU'} ${rotulo}`);
  if (!ok) falhas.push(rotulo);
};

/** Fotos pedidas ao "Storage", na ordem em que o navegador pediu. */
const pedidosDeFoto = [];

async function abaNova() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1000 });
  page.on('pageerror', (e) => falhas.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_FAILED|js\/main\.js/.test(m.text())) falhas.push('console: ' + m.text());
  });
  page.on('dialog', (d) => d.accept());

  // Antes de qualquer script da página: o baralho semeado (uma vez só, para
  // a navegação seguinte ver o que o painel gravou) e o Storage com as três
  // fotos de partida.
  await page.evaluateOnNewDocument(
    (baralho, semente) => {
      if (!sessionStorage.getItem('semeado')) {
        localStorage.setItem('tecgame:baralho', JSON.stringify(baralho));
        sessionStorage.setItem('semeado', '1');
      }
      window.__storageFalso = { arquivos: semente, envios: [], toques: [], apagados: [], recusar: false, atrasoMs: 0 };
    },
    BARALHO_SEMEADO,
    {
      [EM_USO_VELHA]: { tipo: 'image/webp', atualizado: new Date(Date.now() - 30 * DIA).toISOString(), token: 'token-c' },
      [ORFA_VELHA]: { tipo: 'image/webp', atualizado: new Date(Date.now() - 30 * DIA).toISOString(), token: 'token-a' },
      [ORFA_NOVA]: { tipo: 'image/webp', atualizado: new Date(Date.now() - 1 * DIA).toISOString(), token: 'token-b' },
    }
  );

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (u.startsWith(HOST_STORAGE)) {
      pedidosDeFoto.push(u);
      return req.respond({ status: 200, contentType: 'image/png', body: FOTO_SERVIDA });
    }
    if (!u.startsWith(CDN)) return req.continue();
    const corpo = SDK_FALSO[u.split('/').pop()];
    if (!corpo) return req.respond({ status: 404, body: '' });
    req.respond({ status: 200, contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: corpo });
  });
  return page;
}

const avisos = (page) => page.evaluate(() => document.querySelector('.avisos')?.innerText ?? '');
const storage = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__storageFalso)));

/* ------------------------------- 1. o totem mostra a foto pelo endereço -- */

{
  const page = await abaNova();
  await page.goto(url('', '/roleta'), { waitUntil: 'networkidle2' });
  await wait(2400);
  const naRoda = await page.evaluate(() =>
    [...document.querySelectorAll('#pages svg image')].map((i) => i.getAttribute('href') ?? '')
  );
  const doStorage = naRoda.filter((h) => h.startsWith('https://firebasestorage.googleapis.com/'));
  console.log('1. fotos na roda ->', naRoda.length, 'do Storage:', doStorage.length);
  conferir(doStorage.length === 1 && doStorage[0].includes('token-c'), 'a roda desenha a foto do Storage pelo endereço do baralho');
  conferir(
    pedidosDeFoto.some((u) => u.includes(encodeURIComponent(EM_USO_VELHA))),
    `${emDisco ? 'aberto do disco, ' : ''}o navegador busca a foto no Storage`
  );
  await page.screenshot({ path: `${OUT}/1-roda-com-foto-do-storage.png` });
  await page.close();
}

/* ------------------------- 2. o painel com login: enviar, salvar, limpar -- */

if (!emDisco) {
  const page = await abaNova();
  await page.goto(url('?comNuvem=1', '/adm'), { waitUntil: 'networkidle2' });
  await page.waitForSelector('.modal input[type=email]', { timeout: 8000 });
  await page.type('.modal input[type=email]', 'operador@tecnomotor.com.br');
  await page.type('.modal input[type=password]', 'certa');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#adm .barra', { timeout: 10000 });
  await wait(800);
  // A versão nova abre o sininho sozinho; fechado, ele não volta.
  await page.evaluate(() => document.querySelector('.modal-notas .modal-acoes button')?.click());
  await wait(300);

  // O que está NA TELA, e não o atributo: `hidden` perde para o `display` da
  // folha, e o editor teve o campo de caminho e o quadro do resumo
  // visíveis ao mesmo tempo sem nenhum teste notar.
  const visiveis = () =>
    page.evaluate(() => {
      const naTela = (n) => Boolean(n) && getComputedStyle(n).display !== 'none' && n.getClientRects().length > 0;
      const campoCaminho = [...document.querySelectorAll('.veiculo-campos .campo')].find(
        (c) => c.querySelector('.campo-rotulo')?.textContent.trim() === 'Imagem'
      );
      return { campoCaminho: naTela(campoCaminho), resumo: naTela(document.querySelector('.embutida')) };
    });

  // Foto de arquivo: o campo de caminho, e nada de quadro de resumo vazio.
  const deArquivo = await visiveis();
  conferir(deArquivo.campoCaminho && !deArquivo.resumo, 'com foto de arquivo, aparece o campo de caminho e não o quadro do resumo');

  const escolherVeiculo = async (i) => {
    await page.evaluate((n) => document.querySelectorAll('.itens .item.veiculo')[n].querySelector('.item-botao').click(), i);
    await wait(400);
  };
  const enviar = async (arquivo) => {
    const entrada = await page.waitForSelector('.campo-arquivo');
    await entrada.uploadFile(arquivo);
    await entrada.dispose();
    await page.waitForFunction(
      () => {
        const e = document.querySelector('.campo-arquivo');
        const t = document.querySelector('.campo-arquivo-estado')?.textContent ?? '';
        return e && !e.disabled && t && !/processando|enviando/.test(t);
      },
      { timeout: 15000 }
    );
    return page.evaluate(() => ({
      estado: document.querySelector('.campo-arquivo-estado')?.textContent ?? '',
      previa: document.querySelector('.previa-foto')?.getAttribute('src') ?? '',
      resumo: document.querySelector('.embutida-texto')?.textContent ?? null,
    }));
  };
  const salvar = async () => {
    await page.evaluate(() =>
      [...document.querySelectorAll('.barra-acoes button')].find((b) => b.textContent.trim().endsWith('Salvar')).click()
    );
    await page.waitForSelector('.modal-acoes button', { timeout: 5000 });
    await page.evaluate(() => [...document.querySelectorAll('.modal-acoes button')].pop().click());
  };

  // 2a. Enviar com login: enquanto sobe, a tela diz que está subindo — a
  //     foto escolhida já na prévia, sob um véu com a porcentagem —, e Salvar
  //     no meio é recusado. Sem isso o operador achava que nada acontecia.
  await page.evaluate(() => {
    window.__storageFalso.atrasoMs = 2400;
  });
  const seletor = await page.waitForSelector('.campo-arquivo');
  await seletor.uploadFile(FOTO_ENVIADA);
  await seletor.dispose();
  const subindo = await page
    .waitForFunction(
      () => {
        const veu = document.querySelector('.previa-envio');
        return veu && getComputedStyle(veu).display !== 'none' && /%/.test(veu.textContent);
      },
      { timeout: 5000 }
    )
    .then(() => true, () => false);
  const naTelaSubindo = await page.evaluate(() => ({
    veu: document.querySelector('.previa-envio')?.textContent ?? '',
    barra: document.querySelector('.previa-envio-preenchido')?.style.width ?? '',
    previa: (document.querySelector('.previa-foto')?.getAttribute('src') ?? '').slice(0, 11),
    estado: document.querySelector('.campo-arquivo-estado')?.textContent ?? '',
    corDoEstado: document.querySelector('.campo-arquivo-estado')?.className ?? '',
  }));
  console.log('2a. subindo ->', JSON.stringify(naTelaSubindo));
  conferir(subindo, 'enquanto sobe, um véu com a porcentagem cobre a prévia');
  conferir(naTelaSubindo.previa === 'data:image/', 'a prévia já mostra a foto escolhida, e não a antiga');
  conferir(/^\d+%$/.test(naTelaSubindo.barra) && naTelaSubindo.barra !== '0%', 'a barra anda com o que já subiu');
  conferir(/Enviando BMW\.png/.test(naTelaSubindo.estado) && /andamento/.test(naTelaSubindo.corDoEstado), 'a linha de estado diz que está enviando, em destaque');
  await page.screenshot({ path: `${OUT}/2a-enviando.png` });

  const gravadosAntes = await page.evaluate(() => window.__firestoreFalso.gravados.length);
  await page.evaluate(() =>
    [...document.querySelectorAll('.barra-acoes button')].find((b) => b.textContent.trim().endsWith('Salvar')).click()
  );
  await wait(300);
  const noMeio = await page.evaluate(() => ({
    modal: Boolean(document.querySelector('.modal-acoes')),
    gravados: window.__firestoreFalso.gravados.length,
  }));
  conferir(
    /Espere a foto terminar de subir/.test(await avisos(page)) && !noMeio.modal && noMeio.gravados === gravadosAntes,
    'Salvar no meio do envio é recusado, e diz por quê'
  );

  await page.waitForFunction(
    () => {
      const e = document.querySelector('.campo-arquivo');
      return e && !e.disabled && !/Enviando/.test(document.querySelector('.campo-arquivo-estado')?.textContent ?? '');
    },
    { timeout: 15000 }
  );
  await page.evaluate(() => {
    window.__storageFalso.atrasoMs = 0;
  });
  const enviada = await page.evaluate(() => ({
    estado: document.querySelector('.campo-arquivo-estado')?.textContent ?? '',
    corDoEstado: document.querySelector('.campo-arquivo-estado')?.className ?? '',
    previa: document.querySelector('.previa-foto')?.getAttribute('src') ?? '',
    resumo: document.querySelector('.embutida-texto')?.textContent ?? null,
    veu: getComputedStyle(document.querySelector('.previa-envio')).display,
  }));
  conferir(enviada.veu === 'none' && /--ok/.test(enviada.corDoEstado), 'terminado, o véu sai e a linha fica verde');
  const s1 = await storage(page);
  console.log('2a. enviou ->', JSON.stringify({ estado: enviada.estado, envios: s1.envios }));
  const caminho = s1.envios[0] ?? '';
  conferir(s1.envios.length === 1 && /^veiculos\/[0-9a-f]{64}\.webp$/.test(caminho), 'a foto subiu com o nome do conteúdo');
  conferir(s1.arquivos[caminho]?.tipo === 'image/webp', 'subiu como WebP');
  conferir(/immutable/.test(s1.arquivos[caminho]?.cache ?? ''), 'subiu com cache de arquivo imutável');
  conferir(enviada.previa.startsWith(HOST_STORAGE), 'a prévia mostra a foto pelo endereço do Storage');
  conferir(/Firebase Storage/.test(enviada.resumo ?? ''), 'o editor diz que a foto está no Storage');
  const noStorage = await visiveis();
  conferir(noStorage.resumo && !noStorage.campoCaminho, 'com a foto no Storage, o quadro do resumo toma o lugar do campo de caminho');
  await page.screenshot({ path: `${OUT}/2a-enviada.png` });

  // 2b. Salvar: o baralho sobe com o endereço, e a limpeza tira só a órfã velha.
  await salvar();
  await page.waitForFunction(() => window.__storageFalso.apagados.length > 0 || /recusou/.test(document.querySelector('.avisos')?.innerText ?? ''), {
    timeout: 10000,
  }).catch(() => {});
  await wait(300);
  const s2 = await storage(page);
  const gravado = await page.evaluate(() => window.__firestoreFalso.gravados.at(-1)?.baralho ?? null);
  console.log('2b. salvou ->', JSON.stringify({ apagados: s2.apagados, restam: Object.keys(s2.arquivos).length }));
  conferir(gravado?.slots?.[0]?.veiculo?.imagem?.includes(encodeURIComponent(caminho)), 'o baralho na nuvem guarda o endereço, e não a foto');
  conferir(!JSON.stringify(gravado ?? {}).includes('data:image'), 'nenhuma foto embutida subiu para o Firestore');
  conferir(JSON.stringify(s2.apagados) === JSON.stringify([ORFA_VELHA]), 'a limpeza apagou só a órfã parada além da carência');
  conferir(EM_USO_VELHA in s2.arquivos, 'a foto velha que o baralho cita ficou');
  conferir(ORFA_NOVA in s2.arquivos, 'a órfã dentro da carência ficou');
  conferir(caminho in s2.arquivos, 'a foto recém-enviada ficou');
  conferir(/1 foto\(s\)/.test(await avisos(page)), 'o painel diz quantas fotos a limpeza tirou');
  await page.screenshot({ path: `${OUT}/2b-salvo-e-limpo.png` });

  // 2c. A mesma foto noutro veículo: não sobe de novo (sobrescrever trocaria o
  //     token do endereço publicado), só renova a carência.
  await escolherVeiculo(2);
  const deNovo = await enviar(FOTO_ENVIADA);
  const s3 = await storage(page);
  console.log('2c. reenviou ->', JSON.stringify({ estado: deNovo.estado, envios: s3.envios, toques: s3.toques }));
  conferir(s3.envios.length === 1, 'a mesma foto não sobe duas vezes');
  conferir(s3.toques.includes(caminho), 'reaproveitar renova a data de onde a carência conta');
  conferir(/já estava lá/.test(deNovo.estado), 'o editor diz que reaproveitou');
  conferir(deNovo.previa.includes(encodeURIComponent(caminho)), 'o segundo veículo aponta para o mesmo arquivo');

  // 2d. O Storage recusa — aqui, do jeito que recusa enquanto não foi ativado
  //     no Console: a foto não se perde, fica dentro do baralho, e o motivo
  //     diz o que fazer em vez de "An unknown error occurred".
  await page.evaluate(() => {
    window.__storageFalso.recusar = 'bucket';
  });
  await escolherVeiculo(3);
  const recusada = await enviar(OUTRA_FOTO);
  console.log('2d. recusada ->', JSON.stringify(recusada.estado));
  conferir(recusada.previa.startsWith('data:image/'), 'recusada pelo Storage, a foto fica dentro do baralho');
  conferir(/Não foi para o Storage/.test(recusada.estado), 'o editor diz que a foto não foi para o Storage');
  conferir(/bucket do Storage não existe \(404\): ative o Storage no Console/.test(recusada.estado), 'Storage não ativado: o motivo diz o que fazer no Console');
  conferir(
    await page.evaluate(() => /--erro/.test(document.querySelector('.campo-arquivo-estado')?.className ?? '')),
    'a recusa sai em vermelho'
  );
  await page.evaluate(() => {
    window.__storageFalso.recusar = false;
  });

  // 2e. A foto citada some do Storage (a limpeza de outra máquina): salvar é
  //     recusado antes de gravar, e o editor abre no veículo afetado.
  const antes = await page.evaluate(() => window.__firestoreFalso.gravados.length);
  await page.evaluate((c) => {
    delete window.__storageFalso.arquivos[c];
  }, caminho);
  await salvar();
  await page.waitForFunction(() => /não existe mais/.test(document.querySelector('.avisos')?.innerText ?? ''), { timeout: 10000 }).catch(() => {});
  const sumiu = await page.evaluate(() => ({
    gravados: window.__firestoreFalso.gravados.length,
    selecionado: [...document.querySelectorAll('.itens .item.veiculo')].findIndex((n) => n.classList.contains('selecionado')),
    local: JSON.parse(localStorage.getItem('tecgame:baralho')).slots[3].veiculo.imagem.slice(0, 11),
  }));
  const textoSumiu = await avisos(page);
  console.log('2e. foto sumida ->', JSON.stringify({ ...sumiu, aviso: textoSumiu.split('\n').pop() }));
  conferir(/não existe mais no Firebase Storage/.test(textoSumiu), 'salvar com foto sumida é recusado, com o motivo');
  conferir(sumiu.gravados === antes, 'nada subiu para o Firestore');
  conferir(sumiu.local !== 'data:image/', 'nem para este navegador: a recusa vem antes de gravar');
  conferir(sumiu.selecionado === 0, 'o editor abre no primeiro veículo afetado');
  await page.screenshot({ path: `${OUT}/2e-foto-sumida.png` });
  await page.close();
}

await browser.close();

if (falhas.length) {
  console.log('\nFALHOU:\n- ' + falhas.join('\n- '));
  process.exit(1);
}
console.log(
  emDisco
    ? '\nimagens: aberto do disco, a roleta mostra a foto que está no Storage'
    : '\nimagens: a foto vai para o Storage com login, não sobe duas vezes, a limpeza respeita uso e carência, e foto sumida não é publicada'
);
