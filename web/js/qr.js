// QR code em JavaScript puro, sem dependência — para o link do vídeo de cada
// pergunta aparecer na lição e na tela de fim.
//
// O jogo não tem build nem dependência de runtime (ver o CLAUDE.md), e por
// `file://` não busca nada de fora: um gerador de QR tinha de morar aqui.
// Este cobre o que o jogo precisa e nada mais:
//
//   - modo byte (UTF-8), que serve para qualquer URL;
//   - correção de erro nível M (15% do código pode sumir — dedo na tela,
//     reflexo da luz do estande);
//   - versões 1 a 10, até 213 bytes: um link do YouTube tem uns 43.
//
// O desenho segue a especificação ISO/IEC 18004 na mesma ordem das
// implementações de referência (a de Project Nayuki é a mais lida): padrões
// fixos, bits de dados em zigue-zague, máscara de menor penalidade, formato e
// versão em BCH. Os números das tabelas estão conferidos contra a capacidade
// publicada de cada versão (16, 28, 44, 64... palavras de dados no nível M) em
// scripts/unidade/qr.test.mjs, junto do vetor de Reed-Solomon do exemplo
// clássico "HELLO WORLD" 1-M.

/** Palavras de correção por bloco, nível M, versões 1 a 10. */
const ECC_POR_BLOCO_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
/** Quantos blocos de correção, nível M, versões 1 a 10. */
const BLOCOS_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
/** O nível M nos bits de formato. */
const FORMATO_M = 0;

export const VERSAO_MAXIMA = 10;

/* ------------------------------------------------------- Reed-Solomon ---- */

/** Multiplicação no corpo GF(256) do QR (polinômio primitivo 0x11D). */
export function rsMultiplicar(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

/** O polinômio gerador de grau `grau`. */
export function rsDivisor(grau) {
  const resultado = new Array(grau).fill(0);
  resultado[grau - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grau; i++) {
    for (let j = 0; j < resultado.length; j++) {
      resultado[j] = rsMultiplicar(resultado[j], raiz);
      if (j + 1 < resultado.length) resultado[j] ^= resultado[j + 1];
    }
    raiz = rsMultiplicar(raiz, 0x02);
  }
  return resultado;
}

/** As palavras de correção de `dados` para o divisor dado. */
export function rsResto(dados, divisor) {
  const resultado = divisor.map(() => 0);
  for (const b of dados) {
    const fator = b ^ resultado.shift();
    resultado.push(0);
    divisor.forEach((coef, i) => {
      resultado[i] ^= rsMultiplicar(coef, fator);
    });
  }
  return resultado;
}

/* ------------------------------------------------------------ medidas ---- */

/** Quantos módulos de dados (dados + correção, em bits) cabem na versão. */
export function modulosDeDados(versao) {
  let r = (16 * versao + 128) * versao + 64;
  if (versao >= 2) {
    const alinhamentos = Math.floor(versao / 7) + 2;
    r -= (25 * alinhamentos - 10) * alinhamentos - 55;
    if (versao >= 7) r -= 36;
  }
  return r;
}

/** Quantas palavras de DADOS a versão comporta no nível M. */
export function palavrasDeDados(versao) {
  return Math.floor(modulosDeDados(versao) / 8) - ECC_POR_BLOCO_M[versao] * BLOCOS_M[versao];
}

/** Onde ficam os padrões de alinhamento (linhas e colunas). */
export function posicoesDeAlinhamento(versao) {
  if (versao === 1) return [];
  const n = Math.floor(versao / 7) + 2;
  const passo = Math.ceil((versao * 4 + 4) / (n * 2 - 2)) * 2;
  const r = [6];
  for (let i = n - 2, pos = versao * 4 + 10; i >= 0; i--, pos -= passo) r.splice(1, 0, pos);
  return r;
}

/* --------------------------------------------------------- a matriz ------ */

function utf8(texto) {
  return Array.from(new TextEncoder().encode(texto));
}

/** Os bits de dados: modo byte, contagem, os bytes, terminador e enchimento. */
function codificar(bytes, versao) {
  const bits = [];
  const por = (valor, n) => {
    for (let i = n - 1; i >= 0; i--) bits.push((valor >>> i) & 1);
  };
  por(0b0100, 4);
  por(bytes.length, versao <= 9 ? 8 : 16);
  for (const b of bytes) por(b, 8);
  const capacidade = palavrasDeDados(versao) * 8;
  por(0, Math.min(4, capacidade - bits.length));
  por(0, (8 - (bits.length % 8)) % 8);
  const palavras = [];
  for (let i = 0; i < bits.length; i += 8) palavras.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let enche = 0xec; palavras.length < palavrasDeDados(versao); enche ^= 0xec ^ 0x11) palavras.push(enche);
  return palavras;
}

/** Divide em blocos, calcula a correção de cada um e intercala. */
function intercalar(dados, versao) {
  const blocos = BLOCOS_M[versao];
  const eccLen = ECC_POR_BLOCO_M[versao];
  const brutas = Math.floor(modulosDeDados(versao) / 8);
  const curtos = blocos - (brutas % blocos);
  const tamCurto = Math.floor(brutas / blocos);
  const divisor = rsDivisor(eccLen);
  const lista = [];
  for (let i = 0, k = 0; i < blocos; i++) {
    const dat = dados.slice(k, k + tamCurto - eccLen + (i < curtos ? 0 : 1));
    k += dat.length;
    const ecc = rsResto(dat, divisor);
    if (i < curtos) dat.push(0);
    lista.push(dat.concat(ecc));
  }
  const r = [];
  for (let i = 0; i < lista[0].length; i++) {
    lista.forEach((bloco, j) => {
      if (i !== tamCurto - eccLen || j >= curtos) r.push(bloco[i]);
    });
  }
  return r;
}

/** Os bits de formato (nível e máscara), com BCH e a máscara fixa 0x5412. */
export function bitsDeFormato(mascara, nivel = FORMATO_M) {
  const dado = (nivel << 3) | mascara;
  let resto = dado;
  for (let i = 0; i < 10; i++) resto = (resto << 1) ^ ((resto >>> 9) * 0x537);
  return ((dado << 10) | resto) ^ 0x5412;
}

/** Os 18 bits de versão (a partir da 7), com BCH. */
export function bitsDeVersao(versao) {
  let resto = versao;
  for (let i = 0; i < 12; i++) resto = (resto << 1) ^ ((resto >>> 11) * 0x1f25);
  return (versao << 12) | resto;
}

const MASCARAS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function montar(versao, palavras, mascara) {
  const n = versao * 4 + 17;
  const mod = Array.from({ length: n }, () => new Array(n).fill(false));
  const fixo = Array.from({ length: n }, () => new Array(n).fill(false));
  const pintar = (x, y, escuro) => {
    mod[y][x] = escuro;
    fixo[y][x] = true;
  };

  for (let i = 0; i < n; i++) {
    pintar(6, i, i % 2 === 0);
    pintar(i, 6, i % 2 === 0);
  }
  const localizador = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < n && y >= 0 && y < n) pintar(x, y, d !== 2 && d !== 4);
      }
    }
  };
  localizador(3, 3);
  localizador(n - 4, 3);
  localizador(3, n - 4);

  const al = posicoesDeAlinhamento(versao);
  for (let i = 0; i < al.length; i++) {
    for (let j = 0; j < al.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) pintar(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  const formato = (bits) => {
    const b = (i) => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) pintar(8, i, b(i));
    pintar(8, 7, b(6));
    pintar(8, 8, b(7));
    pintar(7, 8, b(8));
    for (let i = 9; i < 15; i++) pintar(14 - i, 8, b(i));
    for (let i = 0; i < 8; i++) pintar(n - 1 - i, 8, b(i));
    for (let i = 8; i < 15; i++) pintar(8, n - 15 + i, b(i));
    pintar(8, n - 8, true);
  };
  formato(0); // reserva o lugar; o de verdade entra depois da máscara

  if (versao >= 7) {
    const bits = bitsDeVersao(versao);
    for (let i = 0; i < 18; i++) {
      const escuro = ((bits >>> i) & 1) !== 0;
      const a = n - 11 + (i % 3);
      const b = Math.floor(i / 3);
      pintar(a, b, escuro);
      pintar(b, a, escuro);
    }
  }

  // Os dados, em zigue-zague: pares de colunas da direita para a esquerda,
  // subindo e descendo alternadamente, pulando a coluna 6 (o relógio).
  let i = 0;
  for (let direita = n - 1; direita >= 1; direita -= 2) {
    if (direita === 6) direita = 5;
    for (let vert = 0; vert < n; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = direita - j;
        const subindo = ((direita + 1) & 2) === 0;
        const y = subindo ? n - 1 - vert : vert;
        if (!fixo[y][x] && i < palavras.length * 8) {
          mod[y][x] = ((palavras[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!fixo[y][x] && MASCARAS[mascara](x, y)) mod[y][x] = !mod[y][x];
    }
  }
  formato(bitsDeFormato(mascara));
  return mod;
}

/** A penalidade da especificação: linhas longas, blocos 2x2, falsos localizadores, desequilíbrio. */
export function penalidade(mod) {
  const n = mod.length;
  let p = 0;
  const linhas = (get) => {
    for (let a = 0; a < n; a++) {
      let corrida = 1;
      for (let b = 1; b < n; b++) {
        if (get(a, b) === get(a, b - 1)) {
          corrida++;
          if (corrida === 5) p += 3;
          else if (corrida > 5) p += 1;
        } else {
          corrida = 1;
        }
      }
      for (let b = 0; b + 10 < n; b++) {
        const s = Array.from({ length: 11 }, (_, k) => (get(a, b + k) ? 1 : 0)).join('');
        if (s === '10111010000' || s === '00001011101') p += 40;
      }
    }
  };
  linhas((a, b) => mod[a][b]);
  linhas((a, b) => mod[b][a]);
  let escuros = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (mod[y][x]) escuros++;
      if (x < n - 1 && y < n - 1) {
        const c = mod[y][x];
        if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3;
      }
    }
  }
  const total = n * n;
  p += (Math.ceil(Math.abs(escuros * 20 - total * 10) / total) - 1) * 10;
  return p;
}

/**
 * A matriz do QR de `texto` (true = escuro), ou `null` se não couber na
 * versão 10 — link comprido demais para caber legível num canto de tela.
 */
export function gerarQr(texto) {
  const bytes = utf8(String(texto ?? ''));
  let versao = 1;
  // Cabe? modo (4) + contagem (8 ou 16) + os bytes, dentro da capacidade.
  while (versao <= VERSAO_MAXIMA && 4 + (versao <= 9 ? 8 : 16) + bytes.length * 8 > palavrasDeDados(versao) * 8) versao++;
  if (versao > VERSAO_MAXIMA) return null;
  const palavras = intercalar(codificar(bytes, versao), versao);
  let melhor = null;
  let menor = Infinity;
  for (let m = 0; m < 8; m++) {
    const mod = montar(versao, palavras, m);
    const p = penalidade(mod);
    if (p < menor) {
      menor = p;
      melhor = mod;
    }
  }
  return melhor;
}

/**
 * O QR como SVG, com a margem de 4 módulos que a especificação pede (sem ela o
 * leitor do celular não acha a borda). Um caminho só, de retângulos: nítido em
 * qualquer escala do palco.
 *
 * @returns {SVGSVGElement|null}
 */
export function QrSvg(texto, { tamanho = 220, escuro = '#0a1a3a', claro = '#ffffff' } = {}) {
  const mod = gerarQr(texto);
  if (!mod) return null;
  const n = mod.length;
  const margem = 4;
  const lado = n + margem * 2;
  let d = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) if (mod[y][x]) d += `M${x + margem} ${y + margem}h1v1h-1z`;
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${lado} ${lado}`);
  svg.setAttribute('width', String(tamanho));
  svg.setAttribute('height', String(tamanho));
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('class', 'aud-qr');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'QR code');
  const fundo = document.createElementNS(svg.namespaceURI, 'rect');
  fundo.setAttribute('width', String(lado));
  fundo.setAttribute('height', String(lado));
  fundo.setAttribute('fill', claro);
  const caminho = document.createElementNS(svg.namespaceURI, 'path');
  caminho.setAttribute('d', d);
  caminho.setAttribute('fill', escuro);
  svg.append(fundo, caminho);
  return svg;
}
