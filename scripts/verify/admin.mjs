// A área administrativa, de ponta a ponta: ver, editar, adicionar, remover,
// validar, publicar — e o totem pegando o conteúdo novo na partida seguinte.
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_DISCO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
// BASE pode ser a origem (http://host:porta) ou o arquivo do jogo
// (file:///.../web/index.html). Desde a v2 ha um documento so: o admin e uma
// camada dentro do proprio index.html, atras da rota /adm e da senha.
const raiz = BASE.endsWith('.html') ? BASE.replace(/[^/]+$/, '') : `${BASE}/`;
const urlJogo = (rota) => `${raiz}index.html#${rota}`;
const SENHA = '2040';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--window-size=1500,1000', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 1000 });

const falhas = [];
page.on('pageerror', (e) => falhas.push('pageerror: ' + e.message));
page.on('console', (m) => {
  // Por file:// o boot por modulo ES falha de proposito e o index.html cai para
  // o js/bundle.js; esse par de mensagens nao e erro do app.
  if (m.type() === 'error' && !/ERR_FAILED|js\/main\.js/.test(m.text())) {
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

/**
 * Atravessa a porta: rota /adm e, na primeira vez da aba, a senha. Depois disso
 * a porta fica destrancada na sessao, entao as idas seguintes so navegam.
 */
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

/* ------------------------------------------------------------- 0. a porta -- */

// ATENCAO ao que este trecho cobre. Desde a v2.2 a porta pede LOGIN (a conta do
// Firebase) sempre que alcanca a nuvem; a senha so vale onde o Firebase e
// impossivel -- e e exatamente onde a suite roda, em localhost e em file://.
// Entao o que se exercita aqui e o caminho do MODO LOCAL, de proposito: o
// caminho do login nao passa por aqui porque a suite e hermetica ao Firebase (se
// nao fosse, cada rodada escreveria no projeto de verdade).
//
// O admin viaja no mesmo JavaScript que o jogador recebe, entao a senha local
// nao protege de ninguem que abra o console -- e esta escrito assim em porta.js.
// O que este trecho afirma e o que ela REALMENTE promete: o jogador que so toca
// na tela nao cai la dentro por acidente, e o painel que abre por ela se declara
// sem login.

await page.goto(urlJogo('/cadastro'), { waitUntil: 'networkidle2' });
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});
await page.reload({ waitUntil: 'networkidle2' });
await wait(2000);

// Quatro toques no selo nao abrem nada.
// Desde a 3.0 o selo é um <div> com a arte de fundo e as lâmpadas por cima
// (components/selo.js), e não mais o <img> do Selo_2.png.
const selo = '#pages .aud-selo';
await page.waitForSelector(selo, { timeout: 10000 });
for (let i = 0; i < 4; i++) await page.click(selo);
await wait(400);
const aos4 = await page.evaluate(() => ({
  porta: !!document.querySelector('.porta-campo'),
  rota: document.querySelector('.ff-page')?.dataset.route,
}));
console.log('0. quatro toques ->', JSON.stringify(aos4));
if (aos4.porta) falhas.push('quatro toques ja abriram a porta');

// O quinto abre a caixa de senha -- e a senha errada nao entra.
await page.click(selo);
await wait(500);
const pediuSenha = await page.$('.porta-campo');
if (!pediuSenha) {
  falhas.push('cinco toques no selo nao pediram a senha');
} else {
  await pediuSenha.type('1234');
  await page.evaluate(() => document.querySelector('.porta-botao--ok').click());
  await wait(400);
  const comSenhaErrada = await page.evaluate(() => ({
    aindaPede: !!document.querySelector('.porta-campo'),
    erro: document.querySelector('.porta-erro')?.textContent ?? '',
    admAberto: !document.getElementById('adm').hidden,
  }));
  console.log('   senha errada ->', JSON.stringify(comSenhaErrada));
  if (!comSenhaErrada.aindaPede) falhas.push('a senha errada fechou a porta');
  if (comSenhaErrada.admAberto) falhas.push('a senha errada abriu a administracao');
  if (!comSenhaErrada.erro) falhas.push('a senha errada nao avisou nada');

  // E a certa entra, com o palco do jogo escondido por baixo.
  await page.type('.porta-campo', SENHA);
  await page.evaluate(() => document.querySelector('.porta-botao--ok').click());
  await page.waitForSelector('#adm .barra', { timeout: 10000 });
  const dentro = await page.evaluate(() => ({
    jogoEscondido: document.getElementById('viewport').hidden,
    modo: document.documentElement.dataset.modo ?? null,
    rolagem: getComputedStyle(document.body).overflowY,
  }));
  console.log('   senha certa ->', JSON.stringify(dentro));
  if (!dentro.jogoEscondido) falhas.push('o palco do jogo continuou visivel sob o admin');
  if (dentro.modo !== 'adm') falhas.push(`data-modo ficou ${dentro.modo}`);
  if (dentro.rolagem === 'hidden') falhas.push('o admin abriu com a rolagem travada pelo jogo');
}

// Voltar ao jogo desfaz tudo o que a camada mexeu no documento.
await clicar('Voltar ao jogo');
await wait(700);
const devolta = await page.evaluate(() => ({
  rota: document.querySelector('.ff-page')?.dataset.route,
  admEscondido: document.getElementById('adm').hidden,
  jogoVisivel: !document.getElementById('viewport').hidden,
  modo: document.documentElement.dataset.modo ?? null,
  rolagem: getComputedStyle(document.body).overflowY,
}));
console.log('   voltou ->', JSON.stringify(devolta));
if (devolta.rota !== '_initialize' && devolta.rota !== 'cadastro') falhas.push(`voltou para ${devolta.rota}`);
if (!devolta.admEscondido) falhas.push('a camada do admin ficou no ar depois de sair');
if (!devolta.jogoVisivel) falhas.push('o jogo nao voltou a aparecer');
if (devolta.modo !== null) falhas.push('o data-modo do admin ficou grudado no documento');
if (devolta.rolagem !== 'hidden') falhas.push('a rolagem do totem nao voltou a ser travada');

/* ------------------------------------------------------- 1. abre e lista -- */

await abrirAdmin();
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle2' });
await page.waitForSelector('#adm .barra', { timeout: 10000 });
await wait(900);

/* -------------------------------------------- 1a. sininho de novidades --- */

// localStorage acabou de ser limpo: é exatamente a primeira abertura que a
// nota promete abrir sozinha.
const aoAbrir = await page.evaluate(() => ({
  modalAberto: !!document.querySelector('.modal-notas'),
  tituloModal: document.querySelector('.modal-notas h2')?.textContent ?? null,
  comPonto: !!document.querySelector('.sininho-ponto'),
  versaoNaBarra: document.querySelector('.marca span')?.textContent ?? '',
}));
console.log('1a. sininho na primeira abertura ->', JSON.stringify(aoAbrir));
if (!aoAbrir.modalAberto) falhas.push('as notas de atualizacao nao abriram sozinhas na primeira vez');
if (!aoAbrir.comPonto) falhas.push('o sininho deveria mostrar o ponto de novidade antes de fechar as notas');
if (!/v\d+\.\d+\.\d+/.test(aoAbrir.versaoNaBarra)) falhas.push(`a barra nao mostrou a versao: "${aoAbrir.versaoNaBarra}"`);

// E o modal precisa abrir NO COMECO DELE. Com notas suficientes para a caixa
// rolar, o `focus()` do botao "Entendi" rolava o conteudo ate o pe: o operador
// abria o sino e via os itens da versao nova sem titulo e sem cabecalho, sem
// saber de que versao eram. Ver `mostrarNotas` em admin/ui.js.
const noTopo = await page.evaluate(() => {
  const caixa = document.querySelector('.modal-notas');
  if (!caixa) return null;
  const topo = caixa.getBoundingClientRect().top;
  const visivel = (n) => !!n && n.getBoundingClientRect().top >= topo - 1;
  return {
    rolagem: caixa.scrollTop,
    tituloVisivel: visivel(caixa.querySelector('h2')),
    versaoVisivel: visivel(caixa.querySelector('.notas-versao h3')),
    primeiraVersao: caixa.querySelector('.notas-versao h3')?.textContent ?? null,
  };
});
console.log('   abre no topo ->', JSON.stringify(noTopo));
if (noTopo?.rolagem !== 0) falhas.push(`o modal de notas abriu rolado (scrollTop ${noTopo?.rolagem})`);
if (!noTopo?.tituloVisivel) falhas.push('o titulo do modal de notas nasceu fora da area visivel');
if (!noTopo?.versaoVisivel) falhas.push('o cabecalho da versao mais nova nasceu fora da area visivel');

// Fechar marca como vista: nao deve reaparecer sozinho de novo.
await page.evaluate(() => document.querySelector('.modal-notas .modal-acoes button').click());
await wait(300);
const aposFechar = await page.evaluate(() => ({
  modalAberto: !!document.querySelector('.modal-notas'),
  comPonto: !!document.querySelector('.sininho-ponto'),
}));
if (aposFechar.modalAberto) falhas.push('o modal de notas deveria fechar ao clicar em Entendi');
if (aposFechar.comPonto) falhas.push('o ponto de novidade deveria sumir depois de ler as notas');

await page.reload({ waitUntil: 'networkidle2' });
await page.waitForSelector('#adm .barra', { timeout: 10000 });
await wait(900);
if (await page.evaluate(() => !!document.querySelector('.modal-notas'))) {
  falhas.push('as notas reabriram sozinhas mesmo sem novidade');
}

// Mas o sino continua clicavel manualmente, a qualquer momento.
await page.evaluate(() => document.querySelector('.sininho').click());
await wait(300);
if (!(await page.evaluate(() => !!document.querySelector('.modal-notas')))) {
  falhas.push('clicar no sininho deveria reabrir as notas manualmente');
}
await page.evaluate(() => document.querySelector('.modal-notas .modal-acoes button').click());
await wait(300);

const inicial = await page.evaluate(() => ({
  itens: document.querySelectorAll('.itens .item.veiculo').length,
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
if (inicial.situacao.some((s) => /problema/.test(s))) falhas.push('o baralho de fabrica deveria estar valido');
// A suite roda em localhost e em file://, onde o Firebase nunca e alcancavel:
// a porta cai na senha local e o painel tem de abrir MARCADO. Sem este selo o
// operador nao teria como saber que o Salvar dali nao alcanca os outros totens.
if (!inicial.situacao.some((s) => /sem login/i.test(s))) {
  falhas.push('entrou pela senha local e o painel nao se marcou como sem login');
}

/* ------------------------------------------- 1b. a cara do painel (3.3) -- */

// O que a reforma da 3.3 prometeu, medido na tela: o painel ocupa 90% da
// largura; a barra tem um selo de situacao e o da conta, e nao os quatro de
// antes; o editor nao tem mais linha de descricao embaixo dos campos — a
// explicacao mora no (?), e abre ao passar o mouse; e o que e de feira saiu da
// lista de veiculos para a aba Configuracoes.
const cara = await page.evaluate(() => {
  const larguraDe = (seletor) => {
    const n = document.querySelector(seletor);
    if (!n) return 0;
    const s = getComputedStyle(n);
    return n.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
  };
  return {
    barra: larguraDe('.barra-interna') / innerWidth,
    corpo: larguraDe('.corpo') / innerWidth,
    selosNaBarra: document.querySelectorAll('.barra .situacao').length,
    dicasNoEditor: [...document.querySelectorAll('.painel .campo-dica, .painel .nota')].filter((n) => n.textContent.trim()).length,
    ajudas: document.querySelectorAll('.painel .ajuda').length,
    feiraNaLista: Boolean(document.querySelector('.lateral [data-campo="pular-video"], .lateral .volume-faixa')),
  };
});
console.log('1b. cara ->', JSON.stringify(cara));
if (Math.abs(cara.barra - 0.9) > 0.01 || Math.abs(cara.corpo - 0.9) > 0.01) {
  falhas.push(`o painel deveria ocupar 90% da largura (barra ${cara.barra.toFixed(3)}, corpo ${cara.corpo.toFixed(3)})`);
}
if (cara.selosNaBarra > 2) falhas.push(`a barra voltou a ter ${cara.selosNaBarra} selos`);
if (cara.dicasNoEditor > 0) falhas.push(`o editor voltou a ter ${cara.dicasNoEditor} linha(s) de descricao`);
if (cara.ajudas < 5) falhas.push(`o editor deveria explicar os campos pelo (?): achei ${cara.ajudas}`);
if (cara.feiraNaLista) falhas.push('as configuracoes de feira continuam na lista de veiculos');

// O balao: passar o mouse no (?) do nome do veiculo mostra a explicacao.
const iconeDoNome = await page.$('.veiculo-campos .campo .ajuda');
await iconeDoNome?.hover();
await wait(200);
const balao = await page.evaluate(() => {
  const b = document.querySelector('.ajuda-balao');
  return b && !b.hidden ? b.textContent : null;
});
await iconeDoNome?.dispose();
await page.mouse.move(2, 2);
await wait(150);
const balaoSumiu = await page.evaluate(() => document.querySelector('.ajuda-balao')?.hidden !== false);
console.log('   balao ->', JSON.stringify({ balao, balaoSumiu }));
if (!/carro sorteado/.test(balao ?? '')) falhas.push(`o (?) do nome nao abriu a explicacao: ${balao}`);
if (!balaoSumiu) falhas.push('o balao de ajuda ficou na tela depois de o mouse sair');

// A aba Configuracoes tem o que era "Na feira" e "Antes da feira".
await clicar('Configurações');
const config = await page.evaluate(() => ({
  pularVideo: Boolean(document.querySelector('[data-campo="pular-video"] input')),
  volume: Boolean(document.querySelector('.volume-faixa')),
  milhao: [...document.querySelectorAll('button')].some((b) => /Chamar ao palco/.test(b.textContent)),
  resetar: [...document.querySelectorAll('button')].some((b) => /Resetar todos os dados/.test(b.textContent)),
  semSalvar: !document.querySelector('.barra [data-acao="salvar"]'),
}));
console.log('   configuracoes ->', JSON.stringify(config));
if (!config.pularVideo || !config.volume || !config.milhao || !config.resetar) {
  falhas.push(`a aba Configuracoes nao tem tudo o que era de feira: ${JSON.stringify(config)}`);
}
if (!config.semSalvar) falhas.push('a aba Configuracoes nao precisa de Salvar, e o botao continuou na barra');
await clicar('Veículos');

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
  seloNaLista: document.querySelector('.itens .item.veiculo.com-problema .item-selo')?.textContent,
}));
console.log('3. com enunciado vazio ->', JSON.stringify(comErro));
if (!comErro.problemas) falhas.push('a validacao nao acusou o enunciado vazio');
if (!comErro.campoAceso) falhas.push('o campo vazio nao foi marcado');
if (!comErro.seloNaLista) falhas.push('a rodada com problema nao foi selada na lista');

// O selo de problemas abre a lista do que falta, na lingua da tela — e nao
// "pergunta vazio em PT" —, e a aba do idioma com campo em branco ganha o ponto.
await page.evaluate(() => document.querySelector('.barra .situacao-botao')?.click());
await wait(300);
const lista = await page.evaluate(() => ({
  itens: [...document.querySelectorAll('.popover .problema')].map((n) => n.textContent),
  ponto: (() => {
    const p = document.querySelector('.aba-idioma[data-idioma="pt"] .aba-ponto');
    return Boolean(p) && !p.hidden;
  })(),
}));
console.log('   lista de problemas ->', JSON.stringify(lista));
if (!lista.itens.some((t) => /FIAT TORO.*Enunciado em branco, em Português/.test(t))) {
  falhas.push(`a lista de problemas nao explicou o enunciado vazio: ${JSON.stringify(lista.itens)}`);
}
if (!lista.ponto) falhas.push('a aba Português deveria ganhar o ponto de campo em branco');
// Clicar no problema leva ao campo e fecha a lista.
await page.evaluate(() => document.querySelector('.popover .problema')?.click());
await wait(300);
if (await page.evaluate(() => Boolean(document.querySelector('.popover')))) falhas.push('a lista de problemas nao fechou ao escolher um');

// Salvar tem de ser bloqueado.
await clicar('Salvar');
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

/* --------------------------------- 3b. a pergunta que pula o equipamento -- */

// A marca do baralho que faz o jogo ir do carro direto para a pergunta. Duas
// coisas se afirmam aqui: que ela DESARMA a exigencia de um equipamento — quem
// pula nunca ve a tela dos cinco —, e que ela chega ao baralho publicado. O
// percurso no jogo e afirmado em verify/baralho.mjs.
const caixasDeEquipamento = async () =>
  page.evaluate(() => {
    const grupo = document.querySelector('.marcar-grupo');
    return {
      desligadas: grupo.classList.contains('sem-efeito'),
      bloqueadas: [...grupo.querySelectorAll('input')].every((i) => i.disabled),
    };
  });

// Sem equipamento nenhum e sem pular: e o erro que segura a partida sem saida.
await page.evaluate(() => {
  for (const caixa of document.querySelectorAll('.marcar-grupo input')) {
    if (caixa.checked) {
      caixa.checked = false;
      caixa.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
});
await wait(400);
const semEquipamento = await page.evaluate(
  () => [...document.querySelectorAll('.situacao')].map((n) => n.textContent).find((t) => /problema/.test(t)) ?? null
);
if (!semEquipamento) falhas.push('pergunta sem equipamento nenhum deveria acusar problema');

// Agora marcando o pulo: o problema some e as caixas de equipamento se apagam.
const marcarPulo = (ligado) =>
  page.evaluate((v) => {
    const caixa = [...document.querySelectorAll('.marcar input')].find((i) =>
      /Pular a escolha/.test(i.closest('.marcar')?.textContent ?? '')
    );
    if (!caixa) return false;
    if (caixa.checked !== v) {
      caixa.checked = v;
      caixa.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }, ligado);

if (!(await marcarPulo(true))) falhas.push('o editor nao tem a caixa "Pular a escolha do equipamento"');
await wait(400);
const pulando = {
  problema:
    (await page.evaluate(
      () => [...document.querySelectorAll('.situacao')].map((n) => n.textContent).find((t) => /problema/.test(t)) ?? null
    )) ?? null,
  ...(await caixasDeEquipamento()),
};
console.log('3b. pulando a escolha ->', JSON.stringify(pulando));
if (pulando.problema) falhas.push(`marcar o pulo deveria desarmar a exigencia; ainda diz "${pulando.problema}"`);
if (!pulando.desligadas) falhas.push('as caixas de equipamento deveriam aparecer sem efeito quando a pergunta pula');
if (!pulando.bloqueadas) falhas.push('as caixas de equipamento deveriam ficar bloqueadas quando a pergunta pula');

await clicar('Salvar');
await wait(300);
await confirmarModal();
await wait(500);
const publicadoComPulo = await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('tecgame:baralho') || 'null');
  return d?.slots?.[0]?.perguntas?.[0]?.pularEquipamento ?? null;
});
console.log('   no baralho publicado ->', JSON.stringify(publicadoComPulo));
if (publicadoComPulo !== true) falhas.push('a marca de pular a escolha nao foi para o baralho publicado');

// Desfaz: o resto do teste conta com a rodada 1 pedindo equipamento.
await marcarPulo(false);
await wait(300);
await page.evaluate(() => {
  for (const caixa of document.querySelectorAll('.marcar-grupo input')) {
    if (!caixa.checked) {
      caixa.checked = true;
      caixa.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
});
await wait(400);

/* ---------------------------------------------------- 4. adiciona rodada -- */

await clicar('Novo veículo');
const apos = await page.evaluate(() => ({
  itens: document.querySelectorAll('.itens .item.veiculo').length,
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

// A resposta correta e marcada na propria alternativa — e a marca vale para os
// tres idiomas, entao a aba aberta (Español) a mostra tambem.
await page.evaluate(() => document.querySelector('.alternativa[data-alternativa="3"] input[type=radio]').click());
await wait(300);
const correta = await page.evaluate(() => ({
  marcada: [...document.querySelectorAll('.alternativa.correta')].map((n) => n.dataset.alternativa),
}));
await page.evaluate(() => [...document.querySelectorAll('.aba-idioma')].find((n) => n.textContent === 'Português').click());
await wait(250);
correta.emPortugues = await page.evaluate(() => [...document.querySelectorAll('.alternativa.correta')].map((n) => n.dataset.alternativa));
console.log('   resposta correta ->', JSON.stringify(correta));
if (JSON.stringify(correta.marcada) !== '["3"]' || JSON.stringify(correta.emPortugues) !== '["3"]') {
  falhas.push(`a alternativa 3 deveria ser a unica correta, nos dois idiomas: ${JSON.stringify(correta)}`);
}

const preenchida = await page.evaluate(() => ({
  problemas: [...document.querySelectorAll('.situacao')].map((n) => n.textContent).find((t) => /problema/.test(t)) ?? null,
  naoSalvo: [...document.querySelectorAll('.situacao')].some((n) => /Alterações não salvas/.test(n.textContent)),
}));
console.log('   preenchida ->', JSON.stringify(preenchida));
if (preenchida.problemas) falhas.push('ainda ha problemas depois de preencher: ' + preenchida.problemas);
if (!preenchida.naoSalvo) falhas.push('a barra deveria dizer que ha alteracoes nao salvas');

/* ---------------------------------------------------------- 5. publica --- */

await clicar('Salvar');
await confirmarModal();
const publicado = await page.evaluate(() => {
  const raw = localStorage.getItem('tecgame:baralho');
  const deck = raw ? JSON.parse(raw) : null;
  return {
    gravou: Boolean(deck),
    slots: deck?.slots?.length ?? 0,
    ultimo: deck?.slots?.[deck.slots.length - 1]?.veiculo?.nome ?? null,
    // v2: a pergunta mora no banco do veiculo, e nao mais solta no slot.
    primeiraPergunta: deck?.slots?.[0]?.perguntas?.[0]?.pt?.pergunta ?? null,
    gabaritoDoNovo: deck?.slots?.[deck.slots.length - 1]?.perguntas?.[0]?.gabarito ?? null,
    situacao: [...document.querySelectorAll('.situacao')].map((n) => n.textContent),
  };
});
console.log('5. publicou ->', JSON.stringify(publicado));
if (publicado.slots !== 11) falhas.push(`publicou ${publicado.slots} rodadas`);
if (publicado.ultimo !== 'BMW de teste') falhas.push('a rodada nova nao foi publicada');
if (publicado.primeiraPergunta !== 'Pergunta editada pelo admin') falhas.push('a edicao do enunciado nao foi publicada');
if (publicado.gabaritoDoNovo !== '3') falhas.push(`a resposta correta marcada na alternativa nao foi publicada: ${publicado.gabaritoDoNovo}`);

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

await abrirAdmin();
// Os botoes do veiculo moram no cabecalho do editor, com nome: escolhe-se o
// veiculo na lista e exclui-se de la.
await page.evaluate(() => document.querySelectorAll('.itens .item.veiculo')[10].querySelector('.item-botao').click());
await wait(300);
await page.evaluate(() => document.querySelector('.editor-cabecalho [data-acao="excluir-veiculo"]').click());
await wait(300);
await confirmarModal();
const removido = await page.evaluate(() => document.querySelectorAll('.itens .item.veiculo').length);
console.log('7. removeu ->', removido, 'rodadas');
if (removido !== 10) falhas.push(`apos remover tem ${removido} rodadas`);

await clicar('Configurações');
await clicar('Resetar todos os dados');
await confirmarModal();
await clicar('Veículos');
const restaurado = await page.evaluate(() => ({
  itens: document.querySelectorAll('.itens .item.veiculo').length,
  primeiro: document.querySelector('.veiculo-campos .campo-entrada')?.value,
}));
console.log('   restaurou ->', JSON.stringify(restaurado));
if (restaurado.itens !== 10) falhas.push('restaurar nao voltou para 10 rodadas');
if (restaurado.primeiro !== 'FIAT TORO - 10GF') falhas.push('restaurar nao trouxe o veiculo original');

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
      estado: document.querySelector('.campo-arquivo-estado')?.textContent ?? '',
      encaixe: document.querySelectorAll('.linha-tres select')[0]?.value ?? null,
    };
  });
  console.log('8. enviou imagem ->', JSON.stringify(enviada));
  if (!enviada.previaEmbutida) falhas.push('a previa nao virou data URL depois do envio');
  if (!/KB/.test(enviada.resumo ?? '')) falhas.push(`resumo da imagem enviada: ${enviada.resumo}`);
  if (enviada.kb > 900) falhas.push(`a imagem enviada ficou com ${enviada.kb} KB - a reducao nao rodou`);
  if (enviada.encaixe !== 'contain') falhas.push(`encaixe apos envio: ${enviada.encaixe}`);
  if (!enviada.chipVisivel) falhas.push('o campo de caminho deveria dar lugar ao resumo da imagem enviada');
  // Sem conta do Firebase a foto não vai para o Storage — e quem esperava que
  // fosse precisa ler isso, e não deduzir de um "cerca de 84 KB".
  if (!/sem a conta do Firebase/.test(enviada.estado)) falhas.push(`o envio sem login nao diz por que ficou no baralho: ${enviada.estado}`);

  // "Baixar foto" devolve a foto enviada como arquivo, com o nome do veiculo.
  // Dentro do baralho os bytes estao ali mesmo: nao passa pela rede.
  const pastaDownload = fs.mkdtempSync(path.join(os.tmpdir(), 'tecgame-foto-'));
  const cdp = await page.target().createCDPSession();
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: pastaDownload });
  await page.evaluate(() => document.querySelector('[data-acao="baixar-foto"]').click());
  let baixados = [];
  for (let t = 0; t < 20 && !baixados.some((n) => !n.endsWith('.crdownload')); t++) {
    await wait(150);
    baixados = fs.readdirSync(pastaDownload);
  }
  const arquivoBaixado = baixados.find((n) => !n.endsWith('.crdownload'));
  const cabecaDoArquivo = arquivoBaixado ? fs.readFileSync(path.join(pastaDownload, arquivoBaixado)).subarray(0, 12) : null;
  console.log('   baixou a foto ->', JSON.stringify({ arquivoBaixado, bytes: cabecaDoArquivo?.length ?? 0 }));
  if (!arquivoBaixado) {
    falhas.push('"Baixar foto" nao baixou nada');
  } else {
    if (!/^FIAT TORO - 10GF\.(webp|png)$/.test(arquivoBaixado)) falhas.push(`a foto baixada saiu com o nome ${arquivoBaixado}`);
    // WebP começa com RIFF....WEBP; PNG, com \x89PNG.
    const assinatura = cabecaDoArquivo.toString('latin1');
    if (!/^RIFF.{4}WEBP/s.test(assinatura) && !assinatura.startsWith('\x89PNG')) falhas.push('o arquivo baixado nao e uma imagem');
  }
  await cdp.detach();
  fs.rmSync(pastaDownload, { recursive: true, force: true });

  await clicar('Salvar');
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

  // Pelo caminho de verdade: sair da administracao e comecar uma partida. O
  // jogo rele o baralho quando o cadastro monta -- e nao a cada tela --, porque
  // publicar no meio de uma partida nao pode trocar o carro debaixo do jogador.
  // Ate a v2 isto vinha de graca, ja que o admin era outro documento e voltar
  // ao jogo recarregava a pagina; agora e uma camada, e o cadastro e quem
  // recarrega.
  await clicar('Voltar ao jogo');
  await page.waitForSelector('.ff-page[data-route="cadastro"]', { timeout: 10000 });
  await wait(1600);
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

  await abrirAdmin();
  await clicar('Configurações');
  await clicar('Resetar todos os dados');
  await confirmarModal();
}

await page.evaluate(() => localStorage.clear());
await browser.close();

if (falhas.length) {
  console.log('\nFALHOU:\n- ' + falhas.join('\n- '));
  process.exit(1);
}
console.log('\nadministracao: ver, editar, adicionar, validar, publicar, enviar imagem, remover e restaurar');
