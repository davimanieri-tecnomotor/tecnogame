// EXPERIMENTO — a saída do cadastro, para o vídeo de instruções.
//
// A troca de tela do jogo é uma só e mora no router: a que sai apaga, a que
// entra acende. Isto aqui não a substitui — acontece ANTES dela, e é da tela do
// cadastro, não do roteador. O CONFIRMAR é o único momento do jogo em que o
// jogador acabou de FAZER alguma coisa (preencher uma ficha) e a tela seguinte
// é um vídeo: é o lugar onde uma passagem com personalidade cabe.
//
// A IDEIA: A FICHA É LIDA E DESMONTADA.
// Uma linha de leitura sobe pela tela, como a de um scanner passando sobre o
// formulário. Cada bloco que ela alcança é arrancado para um lado — alternando,
// com um giro curto e acelerando para fora, como papel puxado —, de baixo para
// cima, na ordem em que a linha chega neles. O selo é o último e não sai de
// lado: vem para a frente e estoura em luz, que é a deixa do vídeo.
//
// O som acompanha sem asset novo: cada peça que sai emite um tique meio tom
// acima do anterior (o mesmo sintetizador do relógio da pergunta), então a
// leitura também se ouve subindo.
//
// Com `prefers-reduced-motion` nada disso roda: a tela sai pela transição
// comum do roteador.

import { el } from './widgets.js';
import { menosMovimento } from './anim.js';
import { tique } from './audio.js';

/** Quanto cada peça leva para sair, e o intervalo entre uma e a seguinte. */
const SAIDA_MS = 340;
const PASSO_MS = 55;
/** A linha de leitura atravessa o palco inteiro um pouco antes das peças. */
const LEITURA_MS = 460;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** A banda de luz que sobe pelo palco. */
function linhaDeLeitura(raiz) {
  const linha = el('div', {
    style: {
      position: 'absolute',
      left: '0',
      right: '0',
      top: '0',
      height: '220px',
      pointerEvents: 'none',
      // `screen` para a banda ACENDER o que está embaixo em vez de cobrir.
      mixBlendMode: 'screen',
      background:
        'linear-gradient(to bottom,' +
        'rgba(0,170,255,0) 0%,' +
        'rgba(0,170,255,0.08) 40%,' +
        'rgba(130,230,255,0.75) 49%,' +
        'rgba(255,255,255,0.95) 50%,' +
        'rgba(130,230,255,0.75) 51%,' +
        'rgba(0,170,255,0.08) 60%,' +
        'rgba(0,170,255,0) 100%)',
      willChange: 'transform',
    },
  });
  raiz.appendChild(linha);
  linha.animate(
    [{ transform: 'translateY(1180px)' }, { transform: 'translateY(-260px)' }],
    { duration: LEITURA_MS, easing: 'cubic-bezier(.2,.6,.2,1)', fill: 'both' }
  );
  return linha;
}

/** O estouro de luz no fim, que é onde o vídeo entra. */
function estouro(raiz) {
  const luz = el('div', {
    style: {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      background: 'radial-gradient(circle at 50% 42%, #eaf7ff 0%, #9fdcff 45%, rgba(0,60,120,0) 72%)',
      opacity: '0',
      mixBlendMode: 'screen',
    },
  });
  raiz.appendChild(luz);
  return luz.animate(
    [
      { opacity: 0, transform: 'scale(0.6)', offset: 0, easing: 'cubic-bezier(.2,.8,.3,1)' },
      { opacity: 0.95, transform: 'scale(1.05)', offset: 0.45, easing: 'ease-out' },
      { opacity: 0, transform: 'scale(1.2)', offset: 1 },
    ],
    { duration: 420, fill: 'both' }
  ).finished;
}

/**
 * Arranca uma peça para fora.
 *
 * `lado` é -1 (esquerda) ou 1 (direita), e a alternância é o que faz a coisa
 * parecer DESMONTADA e não empurrada. A saída acelera (a curva sai devagar e
 * termina rápido): puxão, não deslize.
 */
function arrancar(no, { atraso, lado, giro }) {
  return no.animate(
    [
      { transform: 'translate(0px, 0px) rotate(0deg) scale(1)', opacity: 1 },
      {
        transform: `translate(${lado * 1500}px, -60px) rotate(${giro}deg) scale(0.9)`,
        opacity: 0,
      },
    ],
    { duration: SAIDA_MS, delay: atraso, easing: 'cubic-bezier(.45,0,.9,.35)', fill: 'both' }
  ).finished;
}

/** O selo não sai de lado: vem para a frente e some na luz. */
function aproximar(no, { atraso }) {
  return no.animate(
    [
      { transform: 'scale(1)', opacity: 1, filter: 'brightness(1)' },
      { transform: 'scale(1.45)', opacity: 0, filter: 'brightness(2.2)' },
    ],
    { duration: SAIDA_MS + 80, delay: atraso, easing: 'cubic-bezier(.5,0,.85,.4)', fill: 'both' }
  ).finished;
}

/**
 * Desmonta a tela do cadastro e resolve quando não há mais o que ver.
 *
 * @param {HTMLElement} raiz o `.ff-scaffold` da página — é onde a linha de
 *   leitura e o estouro entram, porque ele é o palco inteiro.
 * @param {Array<HTMLElement|null>} pecas os blocos, DE BAIXO PARA CIMA: é a
 *   ordem em que a linha de leitura chega neles.
 * @param {HTMLElement|null} selo o logo, que sai por último e por outro caminho.
 */
export async function desmontarOCadastro({ raiz, pecas, selo }) {
  if (menosMovimento() || !raiz) return;

  // A tela sai de campo no primeiro quadro: peça a caminho da borda continua
  // clicável enquanto não desaparece de verdade (`opacity: 0` não tira o toque),
  // e um segundo dedo no CONFIRMAR mandaria o jogo navegar duas vezes.
  raiz.style.pointerEvents = 'none';

  linhaDeLeitura(raiz);

  const vivas = pecas.filter(Boolean);
  const saidas = vivas.map((no, i) => {
    const atraso = i * PASSO_MS;
    // O tique sobe meio tom por peça: a leitura também se ouve subindo.
    setTimeout(() => tique({ frequencia: 520 + i * 90, duracao: 0.06, volume: 0.12 }), atraso);
    return arrancar(no, { atraso, lado: i % 2 === 0 ? 1 : -1, giro: (i % 2 === 0 ? 1 : -1) * (4 + i) });
  });

  const atrasoDoSelo = vivas.length * PASSO_MS;
  if (selo) {
    setTimeout(() => tique({ frequencia: 520 + vivas.length * 90, duracao: 0.12, volume: 0.14 }), atrasoDoSelo);
    saidas.push(aproximar(selo, { atraso: atrasoDoSelo }));
  }

  await espera(atrasoDoSelo + 120);
  await Promise.all([estouro(raiz), ...saidas]).catch(() => {});
}
