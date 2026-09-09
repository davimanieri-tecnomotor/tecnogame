// A área administrativa, de ponta a ponta: ver, editar, adicionar, remover,
// validar, publicar — e o totem pegando o conteúdo novo na partida seguinte.
import puppeteer from 'puppeteer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_DISCO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
// BASE pode ser a origem (http://host:porta) ou o arquivo do jogo
// (file:///.../web/index.html); as duas paginas ficam lado a lado.
const raiz = BASE.endsWith('.html') ? BASE.replace(/[^/]+$/, '') : `${BASE}/`;
const urlAdmin = `${raiz}admin.html`;
const urlJogo = (rota) => `${raiz}index.html#${rota}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1500,1000', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 1000 });

const falhas = [];
page.on('pageerror', (e) => falhas.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !/ERR_FAILED|admin\/main\.js|js\/main\.js/.test(m.text())) {
    falhas.push('console: ' + m.text());
  }
});
// Os diálogos de confirmação são in-page, mas o beforeunload é do navegador.
page.on('dialog', (d) => d.accept());

const texto = () => page.evaluate(() => document.body.innerText);
const clicar = async (rotulo) => {
  const ok = await page.evaluate((r) => {
    // O botao pode ter um icone antes do rotulo ("+Adicionar"), entao compara
    // pelo texto do ultimo span, que e o rotulo em si.
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
const confirmarModal = async () => {
  const ok = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.modal-acoes button')].pop();
    if (!b) return false;
    b.click();
    return true;
  });
  if (!ok) throw new Error('o modal de confirmação não apareceu');
  await wait(500);
};

/* ------------------------------------------------------- 1. abre e lista -- */

await page.goto(urlAdmin, { waitUntil: 'networkidle2' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle2' });
await wait(1200);

const inicial = await page.evaluate(() => ({
  itens: document.querySelectorAll('.itens .item').length,
  rodada: document.querySelector('.editor-cabecalho h2')?.textContent,
  primeiroNome: document.querySelector('.veiculo-campos .campo-entrada')?.value,
  situacao: [...document.querySelectorAll('.situacao')].map((n) => n.textContent),
  abas: [...document.querySelectorAll('.aba-idioma')].map((n) => n.textContent),
  campos: document.querySelectorAll('.textos .campo').length,
}));
console.log('1. abriu ->', JSON.stringify(inicial));
if (inicial.itens !== 10) falhas.push(`listou ${inicial.itens} rodadas, esperava 10`);
if (inicial.primeiroNome !== 'FIAT TORO - 10GF') falhas.push(`primeiro veiculo: ${inicial.primeiroNome}`);
if (inicial.abas.length !== 3) falhas.push('faltam abas de idioma');
if (inicial.campos !== 12) falhas.push(`${inicial.campos} campos de texto, esperava 12`);
if (!inicial.situacao.some((s) => /pronto para publicar/.test(s))) falhas.push('o baralho de fabrica deveria estar valido');

/* ------------------------------------------- 2. troca de idioma nas abas -- */

await page.evaluate(() => [...document.querySelectorAll('.aba-idioma')].find((n) => n.textContent === 'English').click());
await wait(300);
const emIngles = await page.evaluate(() => document.querySelector('.textos .campo-entrada')?.value ?? '');
console.log('2. aba English ->', JSON.stringify(emIngles.slice(0, 50)));
if (!/scanner shows the fault code/i.test(emIngles)) falhas.push('a aba English nao mostrou o texto em ingles');
await page.evaluate(() => [...document.querySelectorAll('.aba-idioma')].find((n) => n.textContent === 'Português').click());
await wait(300);

/* ------------------------------------------------ 3. validação acusa erro -- */

// Esvazia o enunciado em pt: tem de virar problema e acender o campo.
await page.evaluate(() => {
  const c = document.querySelector('.textos .campo-entrada');
  c.value = '';
  c.dispatchEvent(new Event('input', { bubbles: true }));
});
await wait(400);
const comErro = await page.evaluate(() => ({
  problemas: [...document.querySelectorAll('.situacao')].map((n) => n.textContent).find((t) => /problema/.test(t)),
  campoAceso: document.querySelectorAll('.textos .campo.tem-erro').length,
  seloNaLista: document.querySelector('.itens .item.com-problema .item-selo')?.textContent,
}));
console.log('3. com enunciado vazio ->', JSON.stringify(comErro));
if (!comErro.problemas) falhas.push('a validacao nao acusou o enunciado vazio');
if (!comErro.campoAceso) falhas.push('o campo vazio nao foi marcado');
if (!comErro.seloNaLista) falhas.push('a rodada com problema nao foi selada na lista');

// Publicar tem de ser bloqueado.
await clicar('Publicar');
const bloqueou = await page.evaluate(() => ({
  aviso: document.querySelector('.aviso-erro')?.textContent ?? null,
  modal: Boolean(document.querySelector('.modal')),
  gravado: localStorage.getItem('tecgame:baralho'),
}));
console.log('   publicar bloqueado ->', JSON.stringify({ ...bloqueou, gravado: Boolean(bloqueou.gravado) }));
if (!bloqueou.aviso) falhas.push('publicar com erro deveria avisar');
if (bloqueou.modal) falhas.push('publicar com erro nao deveria abrir o modal');
if (bloqueou.gravado) falhas.push('publicou um baralho invalido');

// Devolve o texto.
await page.evaluate(() => {
  const c = document.querySelector('.textos .campo-entrada');
  c.value = 'Pergunta editada pelo admin';
  c.dispatchEvent(new Event('input', { bubbles: true }));
});
await wait(400);

/* ---------------------------------------------------- 4. adiciona rodada -- */

await clicar('Adicionar');
const apos = await page.evaluate(() => ({
  itens: document.querySelectorAll('.itens .item').length,
  rodada: document.querySelector('.editor-cabecalho h2')?.textContent,
  problemas: [...document.querySelectorAll('.situacao')].map((n) => n.textContent).find((t) => /problema/.test(t)),
}));
console.log('4. adicionou ->', JSON.stringify(apos));
if (apos.itens !== 11) falhas.push(`apos adicionar tem ${apos.itens} rodadas`);
if (!/11/.test(apos.rodada ?? '')) falhas.push('nao selecionou a rodada nova');
if (!apos.problemas) falhas.push('a rodada nova esta vazia e deveria acusar problema');

// Preenche a rodada nova: veículo pelo atalho + os três idiomas de uma vez.
await page.evaluate(() => {
  const sel = [...document.querySelectorAll('.veiculo-campos select')][0];
  sel.value = 'assets/images/BMW.png';
  sel.dispatchEvent(new Event('change', { bubbles: true }));
});
await wait(300);
for (const idioma of ['Português', 'English', 'Español']) {
  await page.evaluate((nome) => {
    [...document.querySelectorAll('.aba-idioma')].find((n) => n.textContent === nome).click();
  }, idioma);
  await wait(250);
  await page.evaluate((nome) => {
    // Preenche todo campo obrigatório (os marcados com *) deste idioma.
    for (const c of document.querySelectorAll('.textos .campo-obrigatorio .campo-entrada')) {
      c.value = `texto ${nome} de teste`;
      c.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, idioma);
  await wait(250);
}
await page.evaluate(() => {
  const nome = document.querySelector('.veiculo-campos .campo-entrada');
  nome.value = 'BMW de teste';
  nome.dispatchEvent(new Event('input', { bubbles: true }));
});
await wait(400);

const preenchida = await page.evaluate(() => ({
  problemas: [...document.querySelectorAll('.situacao')].map((n) => n.textContent).find((t) => /problema/.test(t)) ?? null,
  pronto: [...document.querySelectorAll('.situacao')].some((n) => /pronto para publicar/.test(n.textContent)),
  arte: [...document.querySelectorAll('.situacao')].some((n) => /roleta desenhada/.test(n.textContent)),
}));
console.log('   preenchida ->', JSON.stringify(preenchida));
if (preenchida.problemas) falhas.push('ainda ha problemas depois de preencher: ' + preenchida.problemas);
if (!preenchida.pronto) falhas.push('deveria estar pronto para publicar');
if (!preenchida.arte) falhas.push('com 11 veiculos a arte pronta nao serve, e a barra deveria avisar');

/* ---------------------------------------------------------- 5. publica --- */

await clicar('Publicar');
await confirmarModal();
const publicado = await page.evaluate(() => {
  const raw = localStorage.getItem('tecgame:baralho');
  const deck = raw ? JSON.parse(raw) : null;
  return {
    gravou: Boolean(deck),
    slots: deck?.slots?.length ?? 0,
    ultimo: deck?.slots?.[deck.slots.length - 1]?.veiculo?.nome ?? null,
    primeiraPergunta: deck?.slots?.[0]?.pt?.pergunta ?? null,
    situacao: [...document.querySelectorAll('.situacao')].map((n) => n.textContent),
  };
});
console.log('5. publicou ->', JSON.stringify(publicado));
if (publicado.slots !== 11) falhas.push(`publicou ${publicado.slots} rodadas`);
if (publicado.ultimo !== 'BMW de teste') falhas.push('a rodada nova nao foi publicada');
if (publicado.primeiraPergunta !== 'Pergunta editada pelo admin') falhas.push('a edicao do enunciado nao foi publicada');

/* -------------------------------------- 6. o jogo pega o conteudo novo --- */

// Medido pelo DOM, nao por import() dinamico: o file:// bloqueia import de
// modulo, e ler a tela renderizada e uma afirmacao melhor de qualquer forma.
await page.goto(urlJogo('/cadastro'), { waitUntil: 'networkidle2' });
await wait(1800);
await page.goto(urlJogo('/roleta'), { waitUntil: 'networkidle2' });
await wait(2400);
const naRoleta = await page.evaluate(() => {
  const svgEl = document.querySelector('#pages svg[role="img"]');
  return {
    rotulo: svgEl?.getAttribute('aria-label') ?? null,
    fatias: svgEl ? [...svgEl.querySelectorAll('path')].filter((n) => !n.closest('clipPath')).length : 0,
  };
});
await page.goto(urlJogo('/telaAcao'), { waitUntil: 'networkidle2' });
await wait(1600);
const naTela = await page.evaluate(() =>
  [...document.querySelectorAll('#pages .ff-text')].map((n) => n.textContent.trim())
);
console.log('6. no jogo ->', JSON.stringify({ ...naRoleta, temEnunciadoEditado: naTela.includes('Pergunta editada pelo admin') }));
if (naRoleta.fatias !== 11) falhas.push(`a roleta do jogo mostrou ${naRoleta.fatias} fatias, esperava 11`);
if (!/11 ve/.test(naRoleta.rotulo ?? '')) falhas.push(`rotulo da roleta: ${naRoleta.rotulo}`);
// escolha comeca em 1.5, que com 11 rodadas cai no indice 6 — nao no 0 —
// entao o enunciado editado da rodada 1 nao aparece aqui; o que se afirma e que
// o jogo carregou o baralho publicado, provado pelas 11 fatias.

/* ----------------------------------------- 7. remover e restaurar fabrica -- */

await page.goto(urlAdmin, { waitUntil: 'networkidle2' });
await wait(1200);
await page.evaluate(() => document.querySelectorAll('.itens .item')[10].querySelector('.item-acoes button:last-child').click());
await wait(300);
await confirmarModal();
const removido = await page.evaluate(() => document.querySelectorAll('.itens .item').length);
console.log('7. removeu ->', removido, 'rodadas');
if (removido !== 10) falhas.push(`apos remover tem ${removido} rodadas`);

await clicar('Restaurar fábrica');
await confirmarModal();
const restaurado = await page.evaluate(() => ({
  itens: document.querySelectorAll('.itens .item').length,
  primeiro: document.querySelector('.veiculo-campos .campo-entrada')?.value,
  arteOriginal: ![...document.querySelectorAll('.situacao')].some((n) => /roleta desenhada/.test(n.textContent)),
}));
console.log('   restaurou ->', JSON.stringify(restaurado));
if (restaurado.itens !== 10) falhas.push('restaurar nao voltou para 10 rodadas');
if (restaurado.primeiro !== 'FIAT TORO - 10GF') falhas.push('restaurar nao trouxe o veiculo original');
if (!restaurado.arteOriginal) falhas.push('com o baralho de fabrica a arte pronta da roleta deveria voltar');

/* --------------------------------- 8. enviar uma imagem do computador ----- */

// O caminho que faz o admin bastar por si: o operador escolhe um arquivo, ele
// vira data URL dentro do baralho, e o totem passa a mostrar a foto sem ter
// recebido arquivo nenhum. Reusa uma das fotos que ja vem no projeto como
// arquivo de entrada -- o que importa e o trajeto, nao a foto.
const fotoDeEntrada = path.join(RAIZ_DISCO, 'web', 'assets', 'images', 'BMW.png');
// Depois do "Restaurar fabrica" a tela e redesenhada inteira: sem esperar, o
// handle do input pertence ao editor antigo e a mutacao cai num slot que nao
// esta mais no estado -- a previa atualiza e o publicar sai sem a foto.
await wait(1200);
const entradaArquivo = await page.$('.campo-arquivo');
if (!entradaArquivo) {
  falhas.push('nao achei o seletor de imagem no editor de veiculo');
} else {
  await entradaArquivo.uploadFile(fotoDeEntrada);
  await wait(1500);

  const enviada = await page.evaluate(() => {
    const prev = document.querySelector('.previa-foto');
    const chip = document.querySelector('.embutida-texto');
    return {
      previaEmbutida: (prev?.getAttribute('src') ?? '').startsWith('data:image/'),
      formato: (prev?.getAttribute('src') ?? '').slice(5, 15),
      kb: Math.round((prev?.getAttribute('src') ?? '').length / 1024),
      resumo: chip?.textContent ?? null,
      chipVisivel: document.querySelector('.embutida')?.hidden === false,
      encaixe: document.querySelectorAll('.linha-tres select')[0]?.value ?? null,
    };
  });
  console.log('8. enviou imagem ->', JSON.stringify(enviada));
  if (!enviada.previaEmbutida) falhas.push('a previa nao virou data URL depois do envio');
  if (!/KB/.test(enviada.resumo ?? '')) falhas.push(`resumo da imagem enviada: ${enviada.resumo}`);
  if (enviada.kb > 900) falhas.push(`a imagem enviada ficou com ${enviada.kb} KB - a reducao nao rodou`);
  if (enviada.encaixe !== 'contain') falhas.push(`encaixe apos envio: ${enviada.encaixe}`);
  if (!enviada.chipVisivel) falhas.push('o campo de caminho deveria dar lugar ao resumo da imagem enviada');

  await clicar('Publicar');
  await wait(300);
  await confirmarModal();
  await wait(700);
  const gravadaComFoto = await page.evaluate(() => {
    const bruto = localStorage.getItem('tecgame:baralho');
    if (!bruto) return { gravou: false };
    const d = JSON.parse(bruto);
    return { gravou: true, embutidas: d.slots.filter((s) => String(s.veiculo.imagem).startsWith('data:')).length };
  });
  console.log('   publicou ->', JSON.stringify(gravadaComFoto));
  if (!gravadaComFoto.gravou) falhas.push('publicar com imagem enviada nao gravou');
  if (gravadaComFoto.embutidas !== 1) falhas.push(`slots com imagem embutida: ${gravadaComFoto.embutidas}`);

  await page.goto(urlJogo('/roleta'), { waitUntil: 'networkidle2' });
  await wait(2400);
  const noJogo = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('#pages svg image')];
    return {
      fotosNaRoda: imgs.length,
      comEmbutida: imgs.filter((i) => (i.getAttribute('href') ?? '').startsWith('data:')).length,
    };
  });
  console.log('   no jogo ->', JSON.stringify(noJogo));
  if (noJogo.comEmbutida !== 1) {
    falhas.push(`a roda do jogo deveria trazer 1 foto embutida, trouxe ${noJogo.comEmbutida}`);
  }

  await page.goto(urlAdmin, { waitUntil: 'networkidle2' });
  await wait(1200);
  await clicar('Restaurar fábrica');
  await confirmarModal();
}

await page.evaluate(() => localStorage.clear());
await browser.close();

if (falhas.length) {
  console.log('\nFALHOU:\n- ' + falhas.join('\n- '));
  process.exit(1);
}
console.log('\nadministracao: ver, editar, adicionar, validar, publicar, enviar imagem, remover e restaurar');
