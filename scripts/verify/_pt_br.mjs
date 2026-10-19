// Pré-carga dos testes de navegador: toda página nasce com o navegador em pt-BR.
//
// O jogo escolhe o idioma por `navigator.language` (web/js/i18n.js), e os testes
// procuram os textos em português ("CONFIRMAR", "GIRAR A ROLETA"). No Windows de
// quem escreveu os testes o Chrome é pt-BR; o runner da CI é Linux em en-US, e lá
// o jogo abria em inglês e cinco testes não achavam nada. `--lang=pt-BR` nos
// argumentos do Chrome NÃO resolveu: no Linux o idioma de `navigator.language`
// sai da resolução de locale do sistema, e a flag não o alcança.
//
// O que vale em qualquer sistema é o CDP: `Emulation.setUserAgentOverride` com
// `acceptLanguage` troca `navigator.language(s)` e o `Accept-Language` da página,
// e vale a partir da navegação seguinte — antes de o jogo ler o idioma, desde que
// seja aplicado antes do primeiro `goto`. Por isso a troca é embutida no
// `newPage()`, e não pedida pelo teste depois de criar a página.
//
// Entra pelo `all.mjs` (`NODE_OPTIONS=--import`), sem mexer nos vinte testes. Um
// teste rodado direto (`node scripts/verify/x.mjs`) herda o idioma da máquina.
import puppeteer from 'puppeteer';

const IDIOMA = 'pt-BR';

async function emPortugues(pagina) {
  // A sessão fica aberta de propósito: o override do CDP morre com ela.
  const sessao = await pagina.createCDPSession();
  await sessao.send('Emulation.setUserAgentOverride', {
    userAgent: await pagina.browser().userAgent(),
    acceptLanguage: IDIOMA,
  });
  return pagina;
}

const abrir = puppeteer.launch.bind(puppeteer);
puppeteer.launch = async (...args) => {
  const navegador = await abrir(...args);
  const novaPagina = navegador.newPage.bind(navegador);
  navegador.newPage = async (...a) => emPortugues(await novaPagina(...a));
  return navegador;
};
