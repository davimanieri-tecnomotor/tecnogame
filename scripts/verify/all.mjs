// Roda a suite inteira nos dois transportes que o jogo realmente usa.
//
// Por que os dois: o totem abre o index.html direto do disco (file://) e o
// desenvolvimento usa HTTP. Sao ambientes diferentes de verdade -- o file://
// recusa modulo ES por origem nula, e caminho relativo com `../` se comporta
// de outra forma. Um bug ja passou por aqui exatamente assim: a previa de foto
// do admin usava `../assets/...`, invisivel no HTTP e quebrada no disco.
//
// Os testes rodam EM PARALELO. Cada um sobe o proprio Chrome e so le do
// servidor, entao nao disputam nada entre si; o que os separava era o laco
// sequencial que havia aqui. Cada par (teste, transporte) escreve suas imagens
// em `shots/<transporte>/<teste>`, para dois transportes do mesmo teste nao
// sobrescreverem um ao outro.
//
// A saida de cada teste fica guardada e sai inteira quando ele termina, senao
// quatro processos escrevendo ao mesmo tempo viram uma sopa ilegivel. Com
// `-j 1` a saida volta a ser ao vivo, que e o que se quer ao investigar um.
//
// Uso:
//   node scripts/verify/all.mjs            tudo, HTTP + file://
//   node scripts/verify/all.mjs corte      so os testes cujo nome casa
//   node scripts/verify/all.mjs --http     so HTTP
//   node scripts/verify/all.mjs --file     so file://
//   node scripts/verify/all.mjs -j 1       um de cada vez, saida ao vivo
import { spawn } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const WEB = path.join(RAIZ, 'web');

const PORTA = Number(process.env.PORTA ?? 8099);
const HTTP_BASE = `http://127.0.0.1:${PORTA}`;
const FILE_BASE = pathToFileURL(path.join(WEB, 'index.html')).href;

/**
 * Ordem: do mais demorado para o mais rapido (tempos medidos em 11/09/2026).
 * Numa fila paralela quem entra por ultimo define o fim, entao o gigante tem de
 * entrar primeiro -- com o `sizes` (150s, 32 carregamentos de pagina) no meio
 * da fila, ele sozinho esticava a suite em 70s.
 */
const TESTES = ['sizes', 'dialogs', 'playthrough', 'baralho', 'admin', 'respostas', 'routes', 'corte', 'teclado', 'estalo', 'idioma'];

const argv = process.argv.slice(2);
const soHttp = argv.includes('--http');
const soFile = argv.includes('--file');
const iJobs = argv.findIndex((a) => a === '-j' || a === '--jobs');
// Cada trabalhador e um Chrome inteiro (~400 MB). Um terco dos nucleos, no
// maximo 6: acima disso a suite ja esta presa no teste mais longo e so se ganha
// risco de timeout por maquina afogada.
const PADRAO_JOBS = Math.max(2, Math.min(6, Math.floor(os.cpus().length / 3)));
const JOBS = Math.max(1, Number(iJobs >= 0 ? argv[iJobs + 1] : (process.env.JOBS ?? PADRAO_JOBS)) || 1);
const filtros = argv.filter((a, i) => !a.startsWith('-') && i !== iJobs + 1);
const escolhidos = filtros.length ? TESTES.filter((t) => filtros.some((f) => t.includes(f))) : TESTES;

if (!escolhidos.length) {
  console.error(`nenhum teste casa com ${filtros.join(', ')}`);
  console.error(`disponiveis: ${TESTES.join(', ')}`);
  process.exit(2);
}

const TRANSPORTES = [
  !soFile && { nome: 'http', base: HTTP_BASE },
  !soHttp && { nome: 'file', base: FILE_BASE },
].filter(Boolean);

/**
 * Roda um comando e resolve com {codigo, saida}. A saida vem capturada, e nao
 * herdada, porque varios correm ao mesmo tempo -- salvo com `-j 1`.
 *
 * Sem `shell`: o caminho do node no Windows tem espaco ("C:\Program Files\...")
 * e o cmd.exe corta no primeiro deles. Somente o npx precisa de shell, porque
 * e um .cmd -- e esse chamador passa `shell: true` de proposito.
 */
function rodar(cmd, args, env = {}, { shell = false, herdar = false } = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, {
      cwd: RAIZ,
      stdio: herdar ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      shell,
      env: { ...process.env, ...env },
    });
    let saida = '';
    p.stdout?.on('data', (d) => (saida += d));
    p.stderr?.on('data', (d) => (saida += d));
    p.on('close', (codigo) => resolve({ codigo: codigo ?? 1, saida }));
    p.on('error', (e) => resolve({ codigo: 1, saida: saida + e.message }));
  });
}

/** Espera a porta responder, para nao correr o teste antes do servidor subir. */
function esperarPorta(porta, tentativas = 40) {
  return new Promise((resolve) => {
    const tentar = (n) => {
      const req = http.get({ host: '127.0.0.1', port: porta, path: '/' }, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => {
        if (n <= 0) return resolve(false);
        setTimeout(() => tentar(n - 1), 250);
      });
    };
    tentar(tentativas);
  });
}

/** Sobe o http-server so se ninguem estiver na porta ainda. */
async function garantirServidor() {
  if (await esperarPorta(PORTA, 0)) {
    console.log(`servidor ja de pe em ${HTTP_BASE}`);
    return null;
  }
  const p = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['http-server', 'web', '-p', String(PORTA), '-c-1', '--silent'],
    { cwd: RAIZ, stdio: 'ignore', shell: process.platform === 'win32' }
  );
  if (!(await esperarPorta(PORTA))) {
    p.kill();
    throw new Error(`http-server nao subiu na porta ${PORTA}`);
  }
  console.log(`servidor subiu em ${HTTP_BASE}`);
  return p;
}

const segundos = (ms) => `${(ms / 1000).toFixed(1)}s`;

const falhas = [];
const tempos = [];
let servidor = null;
const comecou = Date.now();

// O preparo e o que nao vale a pena testar por cima de: import quebrado,
// logica pura quebrada ou bundle velho invalidam a suite inteira. Os testes de
// unidade entram aqui, e nao na fila, porque custam 0,3s e nao precisam de
// navegador nem de servidor -- falha neles aparece antes de acender o primeiro
// Chrome.
console.log('--- preparo ---');
for (const [rotulo, args] of [
  ['imports', ['scripts/check_imports.mjs']],
  // `--test-reporter=dot`: a saida daqui e capturada e reimpressa, e o TAP
  // cru sao 200 linhas antes de a suite comecar. `npm test` avulso continua
  // no relatorio legivel padrao.
  ['unidade', ['--test', '--test-reporter=dot', 'scripts/unidade/*.test.mjs']],
  ['bundle', ['scripts/bundle.mjs']],
]) {
  const { codigo, saida } = await rodar(process.execPath, args);
  process.stdout.write(saida);
  if (codigo !== 0) falhas.push(`preparo/${rotulo}`);
}

if (falhas.length) {
  console.error(`\npreparo falhou: ${falhas.join(', ')} -- nao vale testar em cima disso`);
  process.exit(1);
}

/** Um item de trabalho por par (teste, transporte). */
const fila = [];
for (const t of TRANSPORTES) {
  for (const nome of escolhidos) {
    fila.push({ nome, transporte: t.nome, base: t.base, out: path.join('shots', t.nome, nome) });
  }
}

try {
  if (TRANSPORTES.some((t) => t.nome === 'http')) servidor = await garantirServidor();

  const umDeCada = JOBS === 1;
  console.log(`\n--- ${fila.length} execucoes, ${umDeCada ? 'uma de cada vez' : `${JOBS} em paralelo`} ---`);

  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < fila.length) {
      const job = fila[proximo++];
      const rotulo = `${job.nome}@${job.transporte}`;
      const t0 = Date.now();
      console.log(umDeCada ? `\n=== ${rotulo} ===` : `  -> ${rotulo}`);
      const { codigo, saida } = await rodar(
        process.execPath,
        [`scripts/verify/${job.nome}.mjs`],
        { BASE: job.base, OUT: job.out },
        { herdar: umDeCada }
      );
      const ms = Date.now() - t0;
      tempos.push({ rotulo, ms, codigo });
      if (!umDeCada) {
        const marca = codigo === 0 ? 'passou' : 'FALHOU';
        const rabo = saida.endsWith('\n') ? '' : '\n';
        process.stdout.write(`\n=== ${rotulo} ${marca} em ${segundos(ms)} ===\n${saida}${rabo}`);
      }
      if (codigo !== 0) falhas.push(rotulo);
    }
  };
  await Promise.all(Array.from({ length: Math.min(JOBS, fila.length) }, trabalhador));
} finally {
  if (servidor) servidor.kill();
}

const risca = '-'.repeat(52);
console.log(`\n${risca}`);
tempos.sort((a, b) => b.ms - a.ms);
for (const t of tempos) {
  console.log(`${segundos(t.ms).padStart(7)}  ${t.codigo === 0 ? ' ' : '!'} ${t.rotulo}`);
}
console.log(risca);
const somado = tempos.reduce((s, t) => s + t.ms, 0);
console.log(`parede ${segundos(Date.now() - comecou)}  (soma dos testes ${segundos(somado)})`);

if (falhas.length) {
  console.error(`${falhas.length} de ${fila.length} falharam: ${falhas.join(', ')}`);
  process.exit(1);
}
console.log(
  `${fila.length} de ${fila.length} passaram (${escolhidos.join(', ')} x ${TRANSPORTES.map((t) => t.nome).join(', ')})`
);
