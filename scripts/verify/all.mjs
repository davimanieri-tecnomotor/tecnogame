// Roda a suite inteira nos dois transportes que o jogo realmente usa.
//
// Por que os dois: o totem abre o index.html direto do disco (file://) e o
// desenvolvimento usa HTTP. Sao ambientes diferentes de verdade -- o file://
// recusa modulo ES por origem nula, e caminho relativo com `../` se comporta
// de outra forma. Um bug ja passou por aqui exatamente assim: a previa de foto
// do admin usava `../assets/...`, invisivel no HTTP e quebrada no disco.
//
// Uso:
//   node scripts/verify/all.mjs            tudo, HTTP + file://
//   node scripts/verify/all.mjs corte      so os testes cujo nome casa
//   node scripts/verify/all.mjs --http     so HTTP
//   node scripts/verify/all.mjs --file     so file://
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const WEB = path.join(RAIZ, 'web');

const PORTA = Number(process.env.PORTA ?? 8099);
const HTTP_BASE = `http://127.0.0.1:${PORTA}`;
const FILE_BASE = pathToFileURL(path.join(WEB, 'index.html')).href;

/** Ordem: do mais estrutural para o mais especifico, para falhar cedo. */
const TESTES = [
  'routes',
  'corte',
  'playthrough',
  'dialogs',
  'idioma',
  'teclado',
  'baralho',
  'admin',
  'sizes',
];

const argv = process.argv.slice(2);
const soHttp = argv.includes('--http');
const soFile = argv.includes('--file');
const filtros = argv.filter((a) => !a.startsWith('--'));
const escolhidos = filtros.length
  ? TESTES.filter((t) => filtros.some((f) => t.includes(f)))
  : TESTES;

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
 * Roda um comando herdando a saida, e resolve com o codigo de saida.
 * Sem `shell`: o caminho do node no Windows tem espaco ("C:\Program Files\...")
 * e o cmd.exe corta no primeiro deles. Somente o npx precisa de shell, porque
 * e um .cmd -- e esse chamador passa `shell: true` de proposito.
 */
function rodar(cmd, args, env = {}, shell = false) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, {
      cwd: RAIZ,
      stdio: 'inherit',
      shell,
      env: { ...process.env, ...env },
    });
    p.on('close', (code) => resolve(code ?? 1));
    p.on('error', () => resolve(1));
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

const falhas = [];
let servidor = null;

console.log('--- preparo ---');
for (const [rotulo, args] of [
  ['imports', ['scripts/check_imports.mjs']],
  ['bundle', ['scripts/bundle.mjs']],
]) {
  const code = await rodar(process.execPath, args);
  if (code !== 0) falhas.push(`preparo/${rotulo}`);
}

if (falhas.length) {
  console.error(`\npreparo falhou: ${falhas.join(', ')} -- nao vale testar em cima disso`);
  process.exit(1);
}

try {
  if (TRANSPORTES.some((t) => t.nome === 'http')) servidor = await garantirServidor();

  for (const t of TRANSPORTES) {
    for (const nome of escolhidos) {
      console.log(`\n=== ${nome} @ ${t.nome} ===`);
      const code = await rodar(process.execPath, [`scripts/verify/${nome}.mjs`], { BASE: t.base });
      if (code !== 0) falhas.push(`${nome}@${t.nome}`);
    }
  }
} finally {
  if (servidor) servidor.kill();
}

const total = escolhidos.length * TRANSPORTES.length;
console.log(`\n${'-'.repeat(48)}`);
if (falhas.length) {
  console.error(`${falhas.length} de ${total} falharam: ${falhas.join(', ')}`);
  process.exit(1);
}
console.log(`${total} de ${total} passaram (${escolhidos.join(', ')} x ${TRANSPORTES.map((t) => t.nome).join(', ')})`);
