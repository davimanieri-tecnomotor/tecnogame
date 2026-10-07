// O que impede salvar o baralho, do jeito que o painel mostra.
//
// `validarBaralho` (deck.js) fala a língua do dado — "rodada 3, pergunta 2:
// respostaDois vazio em EN" —, e era isso que o operador lia num aviso. Aqui
// as mensagens são agrupadas pelo lugar onde cada problema mora (para o selo na
// lista e o campo aceso no editor) e traduzidas para o nome que a tela usa
// ("Alternativa 2 em branco, em English").
//
// Puro, sem DOM: os testes de unidade o afirmam fora do navegador.

import { validarBaralho } from '../deck.js';

/** O nome de cada idioma, como as abas do editor o escrevem. */
export const NOME_DO_IDIOMA = { pt: 'Português', en: 'English', es: 'Español' };

/** O nome de cada campo de texto numa frase de problema. */
export const NOME_DO_CAMPO = {
  pergunta: 'Enunciado',
  respostaUm: 'Alternativa 1',
  respostaDois: 'Alternativa 2',
  respostaTres: 'Alternativa 3',
  respostaQuatro: 'Alternativa 4',
  ajudaApoio: 'Dica do Apoio Técnico',
  ajudaTreinamentoEad: 'Dica dos Cursos EAD',
  ajudaTecnomotorTv: 'Dica do TecnomotorTV',
  ajudaComunidade: 'Dica da Comunidade',
  ajudaRepresentanteComercial: 'Dica do Representante comercial',
  relatoPreliminar: 'Relato preliminar',
  maisInformacoes: 'Mais informações',
};

/**
 * As mensagens de `validarBaralho`, agrupadas por onde cada uma mora.
 *
 * Desde o banco de perguntas a mensagem pode vir com duas coordenadas —
 * "rodada 3, pergunta 2: ..." —, então o erro é guardado nas duas: por veículo
 * (o selo na lista) e por pergunta (o campo aceso). `itens` é a lista plana, na
 * ordem do baralho, que o selo de problemas da barra mostra.
 *
 * @returns {{
 *   total: number,
 *   porRodada: Map<number, string[]>,
 *   porPergunta: Map<string, string[]>,
 *   gerais: string[],
 *   itens: Array<{i: number, j: number, mensagem: string}>,
 * }}
 */
export function agruparProblemas(deck) {
  const todos = validarBaralho(deck);
  const porRodada = new Map();
  const porPergunta = new Map();
  const gerais = [];
  const itens = [];
  for (const m of todos) {
    const n = m.match(/^rodada (\d+)(?:, pergunta (\d+))?: (.*)$/);
    if (!n) {
      gerais.push(m);
      continue;
    }
    const i = Number(n[1]) - 1;
    const j = n[2] ? Number(n[2]) - 1 : 0;
    if (!porRodada.has(i)) porRodada.set(i, []);
    porRodada.get(i).push(n[3]);
    const chave = `${i}:${j}`;
    if (!porPergunta.has(chave)) porPergunta.set(chave, []);
    porPergunta.get(chave).push(n[3]);
    itens.push({ i, j, mensagem: n[3] });
  }
  return { total: todos.length, porRodada, porPergunta, gerais, itens };
}

/**
 * Uma mensagem de `validarBaralho` (já sem o "rodada N:") na língua da tela.
 *
 * `idioma` vem preenchido quando o problema mora numa das abas de idioma do
 * editor: é para lá que o clique no problema leva.
 *
 * Mensagem que este mapa não conhece passa como veio: melhor o texto técnico
 * do que esconder um problema que impede salvar.
 *
 * @returns {{texto: string, idioma: string|null}}
 */
export function explicarProblema(mensagem) {
  const m = String(mensagem ?? '');
  const vazio = m.match(/^(\w+) vazio em (PT|EN|ES)$/);
  if (vazio) {
    const idioma = vazio[2].toLowerCase();
    return { texto: `${NOME_DO_CAMPO[vazio[1]] ?? vazio[1]} em branco, em ${NOME_DO_IDIOMA[idioma]}`, idioma };
  }
  const conhecidos = [
    [/sem nome/, 'falta o nome do veículo'],
    [/sem imagem/, 'falta a foto do veículo'],
    [/não tem nenhuma pergunta/, 'o veículo está sem pergunta'],
    [/todas as perguntas estão desligadas/, 'todas as perguntas do veículo estão desligadas'],
    [/gabarito/, 'a resposta correta não está marcada'],
    [/nenhum equipamento/, 'nenhum equipamento marcado'],
    [/link do vídeo/, 'o link do vídeo precisa começar com https://'],
  ];
  for (const [padrao, texto] of conhecidos) if (padrao.test(m)) return { texto, idioma: null };
  return { texto: m, idioma: null };
}
