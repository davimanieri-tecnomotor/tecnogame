// Os passos da tela da pergunta que vários testes precisam dar.
//
// Desde a 3.0 a pergunta é um roteiro — "Posso perguntar?", PODE!, as
// alternativas entrando, "Valendo!", "Está certo disso?", o suspense, o
// resultado com CONTINUAR — e cada teste que joga uma partida inteira passaria
// por ele do mesmo jeito. Os ganchos são atributos estáveis (`data-acao`,
// `data-alternativa`, `data-estado-pergunta`), e não o texto nem o tamanho da
// letra: o texto muda com o idioma, e o tamanho da letra muda com o piso de
// legibilidade (foi o que quebrou os testes da tela antiga, que achavam as
// alternativas pelo número de 55px).
//
// Não é teste: o nome começa com `_` e ele não está na lista de all.mjs.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** O momento do roteiro em que a pergunta está (`posso`, `jogando`, `travando`...). */
export const estadoDaPergunta = (page) =>
  page.evaluate(() => document.querySelector('.pg-auditorio')?.dataset.estadoPergunta ?? null);

/** Espera a pergunta chegar a um dos estados pedidos. */
export async function esperarEstado(page, estados, timeout = 20000) {
  const lista = [].concat(estados);
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (lista.includes(await estadoDaPergunta(page))) return true;
    await wait(100);
  }
  throw new Error(`a pergunta não chegou a ${lista.join('/')} (está em ${await estadoDaPergunta(page)})`);
}

/** Espera um seletor aparecer e clica nele — com o clique do próprio elemento. */
export async function clicarQuandoAparecer(page, seletor, timeout = 20000) {
  await page.waitForSelector(seletor, { timeout, visible: true });
  await page.evaluate((s) => document.querySelector(s).click(), seletor);
}

/** Do painel ligando até "Valendo!": responde PODE! e espera o relógio correr. */
export async function passarDaAbertura(page) {
  await esperarEstado(page, 'posso', 25000);
  await clicarQuandoAparecer(page, '[data-acao="pode"]');
  await esperarEstado(page, 'jogando', 20000);
}

/** As quatro alternativas como a tela as mostra: posição (0 a 3) e texto. */
export const alternativasNaTela = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('#pages [data-alternativa]')].map((n) => ({
      i: Number(n.dataset.alternativa),
      texto: n.querySelector('.aud-opcao-texto')?.textContent ?? '',
      eliminada: n.classList.contains('eliminada'),
    }))
  );

/** Trava a alternativa `i` e confirma no "Está certo disso?". */
export async function responder(page, i) {
  await page.evaluate((k) => document.querySelector(`#pages [data-alternativa="${k}"]`).click(), i);
  await clicarQuandoAparecer(page, '[data-painel="certo"] [data-acao="sim"]', 8000);
}

/** Espera o painel do resultado (ou da lição) e aperta CONTINUAR. */
export async function continuar(page, timeout = 20000) {
  await clicarQuandoAparecer(page, '[data-acao="continuar"]', timeout);
}

/**
 * A posição da alternativa certa nesta partida, lida do estado do jogo (por
 * HTTP o módulo ES, por file:// o bundle — o mesmo grafo que a página usa).
 */
export const posicaoDaCerta = (page) =>
  page.evaluate(async () => {
    const carregar = async (nome) => (window.__tecgameRequire ? window.__tecgameRequire(nome) : await import(`./js/${nome}`));
    const { FFAppState } = await carregar('state.js');
    const pt = FFAppState.questoesBrasil[FFAppState.indiceAtual];
    return FFAppState.ordemNumeros.findIndex((n) => String(n) === String(pt?.gabarito));
  });
