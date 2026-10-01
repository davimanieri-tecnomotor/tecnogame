// O armazenamento local envelhecendo: o que custa uma partida quando o totem já
// guardou mil, cinco mil, vinte mil.
//
// Toda partida grava DUAS linhas no localStorage — `usuarios` (o ranking) e
// `contatos` (nome e telefone) —, e elas ficam um ano (ver RETENCAO_MS em
// storage.js). E cada gravação relê a lista inteira, acrescenta uma linha e a
// reescreve inteira (`putRecord`). Um teste de uma partida só nunca vê isso:
// o custo cresce com o tempo de uso, e o teto é a cota do navegador.
//
// Este script semeia a base com N partidas sintéticas, no formato que o jogo
// grava, e mede com os próprios módulos do jogo:
//
//   gravar     o que o veredito faz: as duas `putRecord` (é síncrono, e cai
//              no instante em que a tela da pergunta começa o suspense)
//   ranking    `queryUsuariosVencedores` local (o fim e a pergunta)
//   placas     `queryRespostasDaPergunta` local (a ajuda Placas)
//   dia        `numerosDoDia` (o modo de atração)
//
// E a cota: quantos caracteres cabem no localStorage desta origem, e em
// quantas partidas a base chega lá.
//
// Uso (com `npm start` rodando):  node scripts/desempenho/armazenamento.mjs
import puppeteer from 'puppeteer';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
const TAMANHOS = (process.env.TAMANHOS ?? '0,1000,5000,10000,20000').split(',').map(Number);

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto(`${BASE}/#/cadastro`, { waitUntil: 'networkidle2' });

/** Quantos caracteres a cota aceita, achada por busca binária numa chave só. */
const cota = await page.evaluate(() => {
  localStorage.clear();
  let lo = 0;
  let hi = 64 * 1024 * 1024;
  while (hi - lo > 1024) {
    const mid = Math.floor((lo + hi) / 2);
    try {
      localStorage.setItem('__cota__', 'x'.repeat(mid));
      lo = mid;
    } catch (_) {
      hi = mid;
    }
  }
  localStorage.removeItem('__cota__');
  return lo;
});

const resultados = [];
for (const n of TAMANHOS) {
  const r = await page.evaluate(async (total) => {
    localStorage.clear();
    const agora = Date.now();
    // Uma partida como o jogo grava (ver createUsuariosRecordData e addUsuario).
    const usuarios = [];
    const contatos = [];
    for (let i = 0; i < total; i++) {
      const data = new Date(agora - i * 60000).toISOString();
      usuarios.push({
        nome: `Jogador ${i}`,
        atuacao: 'Oficina mecânica',
        venceu: i % 3 === 0,
        tempo: i % 3 === 0 ? 20000 + (i % 40000) : undefined,
        equipamento: 'Rasther 3',
        data,
        perguntaId: `orig-${i % 10}`,
        alternativa: (i % 4) + 1,
      });
      contatos.push({ nome: `Jogador ${i}`, telefone: '(16) 99703-7115', data });
    }
    localStorage.setItem('tecgame:usuarios', JSON.stringify(usuarios));
    localStorage.setItem('tecgame:contatos', JSON.stringify(contatos));

    const carregar = async (m) => (window.__tecgameRequire ? window.__tecgameRequire(m) : await import(`./js/${m}`));
    const { putRecord } = await carregar('storage.js');
    const { queryUsuariosVencedores, queryRespostasDaPergunta } = await carregar('backend.js');
    const { numerosDoDia } = await carregar('estatisticas.js');

    const cronometrar = async (fn, vezes = 5) => {
      const ts = [];
      for (let k = 0; k < vezes; k++) {
        const t0 = performance.now();
        await fn();
        ts.push(performance.now() - t0);
      }
      ts.sort((a, b) => a - b);
      return +ts[Math.floor(ts.length / 2)].toFixed(1);
    };
    const linha = { nome: 'Novo', venceu: true, tempo: 41000, equipamento: 'RST', data: new Date().toISOString(), perguntaId: 'orig-1', alternativa: 2 };
    const gravar = await cronometrar(() => {
      const a = putRecord('usuarios', linha);
      const b = putRecord('contatos', { nome: 'Novo', telefone: '(16) 99703-7115', data: linha.data });
      if (!a || !b) throw new Error('a gravação falhou');
    });
    const ranking = await cronometrar(() => queryUsuariosVencedores({ limit: 5 }));
    const placas = await cronometrar(() => queryRespostasDaPergunta('orig-1'));
    const dia = await cronometrar(() => numerosDoDia());
    const chars = Object.keys(localStorage).reduce((s, k) => s + k.length + localStorage.getItem(k).length, 0);
    return { partidas: total, gravar, ranking, placas, dia, kchars: Math.round(chars / 1024) };
  }, n);
  resultados.push(r);
  console.log(
    `${String(r.partidas).padStart(6)} partidas  ${String(r.kchars).padStart(6)} K caracteres   gravar ${r.gravar} ms   ` +
      `ranking ${r.ranking} ms   placas ${r.placas} ms   dia ${r.dia} ms`
  );
}
await page.evaluate(() => localStorage.clear());
await browser.close();

// Caracteres por partida, tirado das duas maiores bases medidas.
const [a, b] = resultados.slice(-2);
const porPartida = ((b.kchars - a.kchars) * 1024) / (b.partidas - a.partidas);
console.log(`\ncota do localStorage nesta origem: ~${(cota / 1048576).toFixed(1)} M caracteres`);
console.log(`cada partida ocupa ~${Math.round(porPartida)} caracteres: a base enche em ~${Math.round(cota / porPartida).toLocaleString('pt-BR')} partidas`);
