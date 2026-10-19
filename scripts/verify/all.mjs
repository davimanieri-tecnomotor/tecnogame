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
//
// O que falha na fila paralela e passa sozinho e REEXECUTADO em serie, uma vez, e
// conta como instavel -- aviso, nao reprovacao (ver "reexecucao" abaixo). Com
// `-j 1` nao ha reexecucao: la os testes ja correm sozinhos.
//
// `TOLERAR=estalo@file,...` (so a CI usa) tira da reprovacao os testes nomeados:
// eles rodam, a falha vira aviso e entra no resumo. Local a suite e estrita.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
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

// Todo teste abre o navegador em pt-BR: o jogo escolhe o idioma por
// navigator.language, e o runner da CI e en-US (ver _pt_br.mjs).
const PT_BR = { NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${pathToFileURL(path.join(AQUI, '_pt_br.mjs')).href}`.trim() };

/**
 * Ordem: do mais demorado para o mais rapido (tempos medidos em 11/09/2026).
 * Numa fila paralela quem entra por ultimo define o fim, entao o gigante tem de
 * entrar primeiro -- com o `sizes` (150s, 32 carregamentos de pagina) no meio
 * da fila, ele sozinho esticava a suite em 70s.
 */
const TESTES = ['sizes', 'dialogs', 'playthrough', 'baralho', 'pergunta', 'inatividade', 'admin', 'equipamento', 'instrucoes', 'respostas', 'login', 'imagens', 'routes', 'corte', 'teclado', 'estalo', 'centro', 'idioma', 'voltar'];

const argv = process.argv.slice(2);
const soHttp = argv.includes('--http');
const soFile = argv.includes('--file');
const iJobs = argv.findIndex((a) => a === '-j' || a === '--jobs');
// Cada trabalhador e um Chrome inteiro (~400 MB). Um terco dos nucleos, no
// maximo 6: acima disso a suite ja esta presa no teste mais longo e so se ganha
// risco de timeout por maquina afogada.
const PADRAO_JOBS = Math.max(2, Math.min(6, Math.floor(os.cpus().length / 3)));
const JOBS = Math.max(1, Number(iJobs >= 0 ? argv[iJobs + 1] : (process.env.JOBS ?? PADRAO_JOBS)) || 1);
// Sem `-j`, `iJobs + 1` é 0: a exclusão do número de trabalhadores comia o
// PRIMEIRO filtro, e `npm run verify -- corte` rodava a suíte inteira.
const filtros = argv.filter((a, i) => !a.startsWith('-') && (iJobs < 0 || i !== iJobs + 1));
const escolhidos = filtros.length ? TESTES.filter((t) => filtros.some((f) => t.includes(f))) : TESTES;
const TOLERAR = new Set((process.env.TOLERAR ?? '').split(',').map((s) => s.trim()).filter(Boolean));

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
 * e o cmd.exe corta no primeiro deles.
 */
function rodar(cmd, args, env = {}, { herdar = false } = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, {
      cwd: RAIZ,
      stdio: herdar ? 'inherit' : ['ignore', 'pipe', 'pipe'],
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
  // O node direto no binario, e nao `npx`: no Windows o npx e um .cmd que pede
  // shell, e o `p.kill()` mata so o invólucro — o servidor de verdade ficava
  // orfao na porta. O npx tambem levou mais de 10s para subir numa maquina
  // ocupada, e o runner desistia com a suite por rodar.
  const p = spawn(
    process.execPath,
    [path.join(RAIZ, 'node_modules', 'http-server', 'bin', 'http-server'), 'web', '-p', String(PORTA), '-c-1', '--silent'],
    { cwd: RAIZ, stdio: 'ignore' }
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
/** Falharam na fila paralela e passaram sozinhos na reexecucao em serie. */
const instaveis = [];
/** A saida do ultimo resultado de cada teste que falhou, para anotar na CI. */
const saidas = new Map();
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
        { BASE: job.base, OUT: job.out, ...PT_BR },
        { herdar: umDeCada }
      );
      const ms = Date.now() - t0;
      tempos.push({ rotulo, ms, codigo });
      if (!umDeCada) {
        const marca = codigo === 0 ? 'passou' : 'FALHOU';
        const rabo = saida.endsWith('\n') ? '' : '\n';
        process.stdout.write(`\n=== ${rotulo} ${marca} em ${segundos(ms)} ===\n${saida}${rabo}`);
      }
      if (codigo !== 0) {
        falhas.push(rotulo);
        saidas.set(rotulo, saida);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(JOBS, fila.length) }, trabalhador));

  // REEXECUCAO EM SERIE, uma vez. Cada trabalhador e um Chrome; com varios ao
  // mesmo tempo a maquina atrasa, e os testes que medem tempo (o compasso do
  // estalo, o teto do cadastro no playthrough, os relogios acelerados) falham sem
  // que nada tenha mudado -- e passam quando rodam sozinhos. Quem passa na
  // segunda vez NAO e dado como limpo: vira `instavel`, com aviso. Quem falha de
  // novo falhou de verdade. Com `-j 1` repetir nao diria nada: ja foi sozinho.
  if (falhas.length && !umDeCada) {
    console.log(`\n--- reexecucao em serie de ${falhas.length}: ${falhas.join(', ')} ---`);
    for (const rotulo of [...falhas]) {
      const job = fila.find((j) => `${j.nome}@${j.transporte}` === rotulo);
      const t0 = Date.now();
      const { codigo, saida } = await rodar(process.execPath, [`scripts/verify/${job.nome}.mjs`], {
        BASE: job.base,
        OUT: job.out,
        ...PT_BR,
      });
      if (codigo === 0) {
        falhas.splice(falhas.indexOf(rotulo), 1);
        instaveis.push(rotulo);
        console.log(`  ${rotulo} passou sozinho em ${segundos(Date.now() - t0)}`);
      } else {
        console.log(`  ${rotulo} falhou de novo:\n${saida}`);
        saidas.set(rotulo, saida);
      }
    }
  }
} finally {
  if (servidor) servidor.kill();
}

const risca = '-'.repeat(52);
console.log(`\n${risca}`);
tempos.sort((a, b) => b.ms - a.ms);
// `!` falhou, `~` so passou na reexecucao em serie.
const marca = (rotulo) => (falhas.includes(rotulo) ? '!' : instaveis.includes(rotulo) ? '~' : ' ');
for (const t of tempos) {
  console.log(`${segundos(t.ms).padStart(7)}  ${marca(t.rotulo)} ${t.rotulo}`);
}
console.log(risca);
const somado = tempos.reduce((s, t) => s + t.ms, 0);
const parede = segundos(Date.now() - comecou);
console.log(`parede ${parede}  (soma dos testes ${segundos(somado)})`);

const reprovados = falhas.filter((r) => !TOLERAR.has(r));
const tolerados = falhas.filter((r) => TOLERAR.has(r));

// O fim da saida de um teste: onde ele diz o que falhou. 40 linhas, no maximo
// 3500 letras — anotacao de CI e para ler de relance, nao para guardar o log.
const rabo = (r) => (saidas.get(r) ?? '').trim().split('\n').slice(-40).join('\n').slice(-3500);

// Na CI, o que nao reprova mas merece olho vira anotacao na pagina da rodada, e
// a tabela vai para o resumo: ninguem precisa abrir o log de 400 linhas para
// saber qual teste e lento ou instavel. O que REPROVA leva junto o rabo da
// saida: o log bruto de uma rodada so abre com login, e sem isso uma perna
// vermelha diz apenas "exit code 1".
if (process.env.GITHUB_ACTIONS === 'true') {
  // Comandos de workflow nao aceitam quebra de linha: % \r \n viram escapes.
  const escapar = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  for (const r of reprovados) console.log(`::error title=Teste falhou::${escapar(`${r}\n${rabo(r)}`)}`);
  for (const r of tolerados) console.log(`::warning title=Teste tolerado falhou::${r} falhou, mas esta em TOLERAR (ver ci.yml)`);
  for (const r of instaveis) console.log(`::warning title=Teste instavel::${r} falhou na fila paralela e passou sozinho`);
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const situacao = (r) =>
    reprovados.includes(r) ? '❌ falhou' : tolerados.includes(r) ? '⚠️ falhou (tolerado)' : instaveis.includes(r) ? '⚠️ só passou sozinho' : '✅';
  const linhas = tempos.map((t) => `| ${t.rotulo} | ${situacao(t.rotulo)} | ${segundos(t.ms)} |`);
  const detalhes = reprovados.flatMap((r) => ['', `<details><summary>❌ ${r}</summary>`, '', '```', rabo(r), '```', '</details>']);
  const texto = ['### Suíte de verificação', '', '| teste | resultado | tempo |', '|---|---|---|', ...linhas, '', `parede ${parede}`, ...detalhes, ''];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, texto.join('\n'));
}

// `exitCode`, e nao `process.exit`: num pipe do Windows o exit corta a saida que
// ainda esta na fila, e o resumo de uma rodada que falhou e justamente o que se quer ler.
if (reprovados.length) {
  console.error(`${reprovados.length} de ${fila.length} falharam: ${reprovados.join(', ')}`);
  process.exitCode = 1;
} else {
  const notas = [];
  if (instaveis.length) notas.push(`${instaveis.length} so passaram na reexecucao em serie: ${instaveis.join(', ')}`);
  if (tolerados.length) notas.push(`${tolerados.length} toleradas: ${tolerados.join(', ')}`);
  console.log(
    `${fila.length - tolerados.length} de ${fila.length} passaram (${escolhidos.join(', ')} x ${TRANSPORTES.map((t) => t.nome).join(', ')})` +
      (notas.length ? ` -- ${notas.join('; ')}` : '')
  );
}
