// O relógio de um roteiro: as esperas de uma tela que conta uma história.
//
// A tela da pergunta é uma sequência — o painel liga, "Posso perguntar?", a
// pergunta entra, as alternativas uma a uma, "Valendo!" — e qualquer ponto
// dela pode ser interrompido: o prazo de inatividade, o botão Voltar do
// navegador, o operador mandando de volta ao cadastro. Uma espera que acorda
// depois de a tela sair jogaria um "CERTA RESPOSTA!" em cima da tela seguinte.
//
// Cada tela cria o seu roteiro e o encerra no `__dispose`. Encerrado, toda
// espera pendente acorda num `Interrompido`, que o topo do roteiro engole — e
// é assim que o resto da sequência simplesmente não acontece.

/** O erro com que acorda a espera de um roteiro encerrado. Ninguém o trata como falha. */
export class Interrompido extends Error {
  constructor() {
    super('roteiro encerrado');
    this.name = 'Interrompido';
  }
}

export function criarRoteiro() {
  let vivo = true;
  /** Esperas pendentes: o temporizador e como acordá-las com erro. */
  const pendentes = new Set();

  return {
    get vivo() {
      return vivo;
    },

    /** Espera `ms`; num roteiro encerrado, rejeita com `Interrompido`. */
    pausa(ms) {
      if (!vivo) return Promise.reject(new Interrompido());
      return new Promise((ok, falha) => {
        const item = { falha };
        item.t = setTimeout(() => {
          pendentes.delete(item);
          if (vivo) ok();
          else falha(new Interrompido());
        }, ms);
        pendentes.add(item);
      });
    },

    /** Roda `fn` daqui a `ms`, se o roteiro ainda estiver vivo. */
    depois(ms, fn) {
      if (!vivo) return;
      const item = { falha: () => {} };
      item.t = setTimeout(() => {
        pendentes.delete(item);
        if (vivo) fn();
      }, ms);
      pendentes.add(item);
    },

    /** Espera uma promessa qualquer, mas acorda interrompido se o roteiro acabar antes. */
    aguardar(promessa) {
      if (!vivo) return Promise.reject(new Interrompido());
      return new Promise((ok, falha) => {
        const item = { falha, t: null };
        pendentes.add(item);
        Promise.resolve(promessa).then(
          (v) => {
            pendentes.delete(item);
            if (vivo) ok(v);
            else falha(new Interrompido());
          },
          (e) => {
            pendentes.delete(item);
            falha(vivo ? e : new Interrompido());
          }
        );
      });
    },

    encerrar() {
      if (!vivo) return;
      vivo = false;
      for (const item of pendentes) {
        clearTimeout(item.t);
        item.falha(new Interrompido());
      }
      pendentes.clear();
    },
  };
}

/** Engole a interrupção e deixa passar o resto: `promessa.catch(soInterrupcao)`. */
export function soInterrupcao(erro) {
  if (erro instanceof Interrompido) return;
  throw erro;
}
