// Procura conteúdo RECORTADO dentro do palco.
//
// Por que este teste existe: o scripts/verify/routes.mjs só reclama de elemento
// que sai dos 1920x1080, e ignora de propósito o que está recortado por um
// ancestral — porque `Stack` no Flutter recorta com Clip.hardEdge e isso é
// legítimo. Só que essa regra escondeu dois bugs graves: as alternativas da
// tela de jogo colapsavam para 300px e apareciam cortadas no meio da palavra, e
// a fileira de scanners saía espalhada com dois cards cortados.
//
// A diferença entre recorte legítimo e bug: um `Stack` recorta a *moldura* de um
// filho maior que ele de propósito (o selo girado na tela de jogo); o que não é
// aceitável é um container de tamanho FIXO ficar menor que o próprio conteúdo,
// porque aí sobrou texto que ninguém consegue ler.
import puppeteer from 'puppeteer';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
const pageUrl = (route) => (BASE.endsWith('.html') ? `${BASE}#${route}` : `${BASE}/#${route}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Quanto de recorte é ruído de arredondamento de sombra/borda. */
const TOLERANCIA = 8;

const ROTAS = [
  ['cadastro', '/cadastro'],
  ['roleta', '/roleta'],
  ['carro', '/carro'],
  ['scanner', '/scanner'],
  ['telaAcao', '/telaAcao'],
  ['ganhou', '/ganhou'],
  ['perdeu', '/perdeu'],
  ['instrucoes', '/instrucoes'],
  ['telaVideoScanner', '/telaVideoScanner'],
];

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1920,1080', '--autoplay-policy=no-user-gesture-required'],
});

let problemas = 0;

for (const [nome, rota] of ROTAS) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: process.env.THEME ?? 'dark' }]);
  await page.goto(pageUrl(rota), { waitUntil: 'networkidle2' });
  await wait(2600);

  const cortes = await page.evaluate((tol) => {
    const out = [];
    for (const node of document.querySelectorAll('#pages *')) {
      const estilo = getComputedStyle(node);
      if (estilo.overflow === 'visible') continue;
      const dx = node.scrollWidth - node.clientWidth;
      const dy = node.scrollHeight - node.clientHeight;
      if (dx <= tol && dy <= tol) continue;

      const r = node.getBoundingClientRect();
      if (r.width < 20 || r.height < 20) continue;

      // Aceito: recorte só na vertical de uma caixa que contém apenas imagem.
      // É o caso da roleta, cuja arte declara 946px de altura numa caixa de
      // 839.8 — o Flutter comprime, aqui recorta a moldura, e o círculo aparece
      // igual (conferido por screenshot). Recorte horizontal, ou vertical com
      // texto dentro, continua sendo falha: era ali que estavam os dois bugs
      // que este teste passou a pegar.
      const soImagem = node.querySelectorAll('.ff-text').length === 0 && node.querySelector('img, svg');
      if (dx <= tol && soImagem) continue;

      // O texto que sobrou é o que importa: um filho de tamanho fixo maior que
      // a caixa que o contém significa palavra cortada na tela.
      const textos = [...node.querySelectorAll('.ff-text')]
        .map((t) => t.textContent.trim())
        .filter(Boolean)
        .slice(0, 2);

      out.push({
        classe: (node.className || node.tagName).toString().split(' ')[0],
        caixa: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        cortadoX: dx,
        cortadoY: dy,
        textos,
      });
    }
    return out;
  }, TOLERANCIA);

  await page.close();

  if (cortes.length === 0) {
    console.log(`${nome.padEnd(18)} sem recorte`);
    continue;
  }
  problemas += cortes.length;
  console.log(`${nome.padEnd(18)} ${cortes.length} elemento(s) com conteúdo cortado:`);
  for (const c of cortes.slice(0, 6)) {
    const t = c.textos.length ? ` :: ${JSON.stringify(c.textos.join(' | ').slice(0, 60))}` : '';
    console.log(`  ${c.classe} [${c.caixa.join(',')}] cortou ${c.cortadoX}x${c.cortadoY}${t}`);
  }
}

await browser.close();

if (problemas) {
  console.log(`\n${problemas} elemento(s) com conteúdo cortado dentro do palco`);
  process.exit(1);
}
console.log('\nnenhum conteúdo cortado');
