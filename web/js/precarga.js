// A carga adiantada das imagens pesadas do percurso.
//
// A roleta só mostra o que já baixou, e ela é a tela mais pesada do jogo: ou a
// arte pronta (`Roleta.png`, a maior imagem do projeto) ou, quando o baralho
// não é o de fábrica, UMA FOTO POR FATIA — e cada foto é pedida duas vezes, no
// `<image>` do SVG e num `Image()` só para medir a proporção da caixa (ver
// roda.js). Quem chegava na roleta via as fatias se preenchendo uma a uma, com
// a roda já na tela.
//
// Só que ninguém cai na roleta de surpresa: entre o CONFIRMAR do cadastro e ela
// há o vídeo de instruções (13s) e a vinheta (4s). Dezessete segundos de sobra
// para pedir as imagens antes — e é isso que este arquivo faz.
//
// Pedir é tudo o que é preciso: o navegador guarda no cache, e o `<image>` do
// SVG e o `Image()` da medição acham a foto pronta. Vale para foto de arquivo e
// para a que o operador enviou do computador (um `data:` dentro do baralho),
// porque nos dois casos o custo que sobra é a decodificação, e `decode()` a
// resolve fora do quadro.

import { usaArteOriginal } from './deck.js';

/** O que já foi pedido nesta sessão — pedir de novo seria só ruído. */
const jaPedidas = new Set();

/**
 * As imagens em voo ficam presas aqui até carregarem.
 *
 * Um `Image()` sem nenhuma referência viva pode ser coletado antes de terminar,
 * e aí o pedido morre pela metade — que é justamente o caso aqui, porque
 * ninguém guarda o objeto: o que se quer dele é o efeito colateral no cache.
 */
const emVoo = new Set();

/** Pede as imagens, sem bloquear nada e sem falar de erro: é adiantamento. */
export function precarregar(urls) {
  for (const url of urls) {
    if (!url || jaPedidas.has(url)) continue;
    jaPedidas.add(url);

    const img = new Image();
    img.decoding = 'async';
    emVoo.add(img);
    const soltar = () => emVoo.delete(img);
    img.addEventListener('load', () => {
      // Decodificar agora tira do caminho o outro custo: uma foto de 4000px já
      // baixada ainda trava o quadro em que aparece pela primeira vez.
      img.decode?.().catch(() => {}).finally(soltar);
    });
    img.addEventListener('error', soltar);
    img.src = url;
  }
}

/** As imagens que a tela da roleta vai precisar com o baralho em vigor. */
export function imagensDaRoleta(baralho) {
  const fixas = ['assets/images/Seta_.png', 'assets/images/Logo_Tecnomotor_sem_fundo.png'];
  // Com os veículos originais a roda é o PNG pronto; fora disso ela é desenhada
  // e são as fotos do baralho que aparecem nas fatias (ver deck.js e roda.js).
  if (usaArteOriginal(baralho)) return [...fixas, 'assets/images/Roleta.png'];
  return [...fixas, ...(baralho?.slots ?? []).map((s) => s.veiculo?.imagem)];
}

/**
 * Adianta a roleta e a tela do carro sorteado.
 *
 * Chamado da tela de cadastro, que é onde o jogador passa mais tempo parado e
 * onde o baralho publicado acaba de ser relido. Em espera ociosa: a primeira
 * tela ainda está se desenhando, e ela é que não pode esperar por foto de carro.
 */
export function adiantarOPercurso(baralho) {
  const pedir = () => {
    precarregar(imagensDaRoleta(baralho));
    // A tela do carro sorteado mostra a foto do veículo em tamanho grande, e a
    // da pergunta repete a mesma foto — as duas vêm de graça junto com a roda
    // quando a roda é desenhada, mas não quando ela é o PNG pronto.
    precarregar((baralho?.slots ?? []).map((s) => s.veiculo?.imagem));
  };

  if (typeof requestIdleCallback === 'function') requestIdleCallback(pedir, { timeout: 2000 });
  else setTimeout(pedir, 800);
}
