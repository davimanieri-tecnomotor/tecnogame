// Um `localStorage` de mentira, para a lógica de armazenamento poder ser
// afirmada fora do navegador.
//
// Isto só é possível por causa de um desenho que já existia: `storage.js` lê
// `window.localStorage` DENTRO de `store()`, e protege cada acesso com
// try/catch — é o que faz o jogo sobreviver a navegador em modo privado, onde o
// simples getter já lança. O mesmo cuidado é o que permite trocar o armazenamento
// por este aqui sem tocar no módulo.
//
// `tetoBytes` limita o TAMANHO do valor, e não a quantidade de chaves, de
// propósito: `store()` escreve uma sonda de 1 byte antes de devolver o
// armazenamento, e um teto por quantidade faria a sonda falhar primeiro — o
// módulo reportaria 'recusado' onde o caso real é 'cheio'.

/** Instala o armazenamento falso e devolve o mapa por trás dele. */
export function instalarArmazenamento({ tetoBytes = Infinity } = {}) {
  const dados = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (dados.has(k) ? dados.get(k) : null),
      setItem: (k, v) => {
        const texto = String(v);
        if (texto.length > tetoBytes) {
          const erro = new Error('cota estourada');
          erro.name = 'QuotaExceededError';
          throw erro;
        }
        dados.set(k, texto);
      },
      removeItem: (k) => void dados.delete(k),
    },
  };
  return dados;
}

/** Tira o armazenamento do ar — é como o navegador que recusa tudo se parece. */
export function removerArmazenamento() {
  delete globalThis.window;
}
