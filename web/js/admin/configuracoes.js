// A aba Configurações do painel: o que o operador ajusta no estande, e não no
// baralho — vale só para ESTE navegador, na hora, sem Salvar.
//
//   - o estilo da tela da pergunta (clássico ou palco — ver palco.js);
//   - pular o vídeo demonstrativo do equipamento (ver tela_video_scanner.js);
//   - o volume do som, porque a feira barulhenta e o auditório silencioso
//     pedem volumes diferentes, e ele era cravado no código;
//   - a Pergunta do Milhão do dia: chamar o mais rápido de volta ao totem para
//     uma pergunta extra, valendo brinde (ver pages/milhao.js);
//   - zerar os dados deste navegador, o botão de antes da feira.
//
// Até a 3.2 isto morava no pé da lista de veículos, como "Na feira" e "Antes da
// feira": quem procurava o volume rolava a lista inteira de carros, e quem
// editava carros tinha o volume no caminho. Ganhou aba própria.

import { el, botao, aviso, campo, caixaDeMarcar, selecao, ajuda, icone } from './ui.js';
import { definirEstiloDaPergunta, estiloDaPergunta } from '../palco.js';
import { alternarMudo, definirVolume, estaMudo, volumeAtual } from '../audio.js';
import { Som } from '../som.js';
import { maisRapidoDoDia } from '../estatisticas.js';
import { formatarTempoDeResposta } from '../functions.js';
import { getRecords } from '../storage.js';
import { carregarBaralho } from '../deck.js';
import { definirPularVideoDoEquipamento, pulaVideoDoEquipamento } from '../pages/tela_video_scanner.js';

/** Um cartão da aba: título, (?) opcional e o conteúdo. */
function cartao(titulo, { ajuda: textoDeAjuda = null, classe = null } = {}, conteudo = []) {
  return el('section', { class: ['bloco', 'cartao-config', classe] }, [
    el('h3', { class: 'bloco-titulo' }, [titulo, textoDeAjuda ? ajuda(textoDeAjuda, { rotulo: titulo }) : null]),
    ...conteudo,
  ]);
}

function cartaoDoJogo() {
  const campoEstilo = selecao({
    rotulo: 'Estilo da tela da pergunta',
    valor: estiloDaPergunta(),
    opcoes: [
      { valor: 'classico', rotulo: 'Clássico — a coluna do Show do Milhão (padrão)' },
      { valor: 'palco', rotulo: 'Palco — os losangos do Milionário' },
    ],
    onChange: (v) => {
      definirEstiloDaPergunta(v);
      aviso(`A próxima pergunta já sai no estilo ${v === 'palco' ? 'Palco' : 'Clássico'}.`);
    },
  });

  const campoPularVideo = el('div', { class: 'campo', 'data-campo': 'pular-video' }, [
    caixaDeMarcar({
      rotulo: 'Pular o vídeo demonstrativo do equipamento',
      marcado: pulaVideoDoEquipamento(),
      ajuda: 'Tira os 14 segundos de vídeo entre a escolha do equipamento e a pergunta. O Rasther 4 não tem vídeo e sempre vai direto.',
      onChange: (v) => {
        definirPularVideoDoEquipamento(v);
        aviso(
          v
            ? 'A partir da próxima partida, o jogo vai do equipamento direto para a pergunta.'
            : 'O vídeo do equipamento volta a passar antes da pergunta.'
        );
      },
    }),
  ]);

  return cartao('Jogo', {}, [campoEstilo, campoPularVideo]);
}

function cartaoDoSom() {
  const faixa = el('input', {
    type: 'range',
    min: '0',
    max: '100',
    step: '5',
    class: 'volume-faixa',
    'aria-label': 'Volume do som do jogo',
  });
  faixa.value = String(Math.round(volumeAtual() * 100));
  const valor = el('span', { class: 'volume-valor', text: `${faixa.value}%` });
  const mudo = caixaDeMarcar({
    rotulo: 'Sem som',
    marcado: estaMudo(),
    onChange: (v) => {
      if (v !== estaMudo()) alternarMudo();
    },
  });
  faixa.addEventListener('input', () => {
    definirVolume(Number(faixa.value) / 100);
    valor.textContent = `${faixa.value}%`;
    mudo.entrada.checked = estaMudo();
  });

  return cartao(
    'Som',
    {
      ajuda:
        'No totem, sem abrir o painel: Ctrl+Alt+M liga e desliga o som, Ctrl+Alt+↑/↓ muda o volume e Ctrl+Alt+Home volta ao cadastro.',
    },
    [
      el('div', { class: 'campo' }, [
        el('span', { class: 'campo-rotulo' }, [el('span', { class: 'campo-rotulo-texto', text: 'Volume' })]),
        el('div', { class: 'volume-linha' }, [
          faixa,
          valor,
          botao('Testar', { icone: 'tocar', onClick: () => Som.fanfarra(0), titulo: 'Toca a fanfarra do acerto no volume escolhido' }),
        ]),
      ]),
      mudo,
    ]
  );
}

/**
 * @param {Function} aoChamar recebe `(nome, qual)` — `qual` é `"sorteio"` ou
 *   `"i:j"` (veículo e pergunta). Quem chama é o painel, que sabe fechar a
 *   camada e o que fazer com a edição pendente.
 */
function cartaoDoMilhao(aoChamar) {
  // A lista vem do baralho PUBLICADO — é com ele que o jogo joga, e não com a
  // cópia em edição na outra aba.
  const publicado = carregarBaralho();
  const opcoes = [{ valor: 'sorteio', rotulo: 'Sortear uma das perguntas ativas' }];
  publicado.slots.forEach((slot, i) =>
    (slot.perguntas ?? []).forEach((p, j) => {
      if (p.ativa === false) return;
      const texto = (p.pt?.pergunta ?? '').trim();
      opcoes.push({
        valor: `${i}:${j}`,
        rotulo: `${slot.veiculo?.nome?.trim() || `Veículo ${i + 1}`} — ${texto.slice(0, 48)}${texto.length > 48 ? '…' : ''}`,
      });
    })
  );

  const campeao = maisRapidoDoDia();
  const campoNome = campo({
    rotulo: 'Quem vai jogar',
    valor: campeao?.nome ?? '',
    placeholder: 'Nome do jogador',
    dica: campeao ? `O mais rápido de hoje neste totem: ${campeao.nome}, ${formatarTempoDeResposta(campeao.tempo)}.` : null,
  });
  const campoPergunta = selecao({ rotulo: 'Pergunta', valor: 'sorteio', opcoes });

  const ultimas = getRecords('milhao').slice(-3).reverse();

  return cartao(
    'Pergunta do Milhão',
    {
      classe: 'cartao-milhao',
      ajuda: 'Sem ajudas, e não entra no ranking. O painel fecha e o totem vai direto para a pergunta, com o nome de quem vai jogar.',
    },
    [
      el('p', { class: 'nota', text: 'Uma pergunta extra, valendo brinde, para chamar o mais rápido do dia de volta ao totem.' }),
      el('div', { class: 'milhao-linha' }, [
        campoNome,
        campoPergunta,
        botao('Chamar ao palco', {
          tipo: 'primario',
          onClick: () => aoChamar(campoNome.entrada.value, campoPergunta.entrada.value),
        }),
      ]),
      ultimas.length
        ? el('div', { class: 'milhao-ultimas' }, [
            el('span', { class: 'campo-rotulo', text: 'Últimas chamadas neste totem' }),
            el(
              'ul',
              {},
              ultimas.map((r) =>
                el('li', {
                  text: `${r.nome || '(sem nome)'} — ${r.venceu ? `levou o brinde (${formatarTempoDeResposta(r.tempo)})` : 'não levou'} · ${new Date(r.data).toLocaleString('pt-BR')}`,
                })
              )
            ),
          ])
        : null,
    ]
  );
}

/** O fim da aba é o lugar de quem só se procura de propósito. */
function cartaoDeZerar(aoResetar) {
  return cartao(
    'Zerar os dados deste navegador',
    {
      classe: 'zona-de-risco',
      ajuda: 'O que já foi salvo no Firebase continua lá — isso só se apaga pelo console do Firebase.',
    },
    [
      el('div', { class: 'zerar-linha' }, [
        el('p', {
          class: 'nota',
          text: 'Para antes da feira: volta às perguntas de fábrica e apaga deste navegador o ranking e os telefones das partidas já jogadas.',
        }),
        botao('Resetar todos os dados', { onClick: aoResetar, tipo: 'perigo', icone: 'lixeira' }),
      ]),
    ]
  );
}

/**
 * A aba inteira.
 *
 * @param {object} props
 * @param {Function} props.aoChamarMilhao ver `cartaoDoMilhao`
 * @param {Function} props.aoResetar o "Resetar todos os dados", que mexe no
 *   baralho em edição — por isso é o painel que o faz
 */
export function telaConfiguracoes({ aoChamarMilhao, aoResetar }) {
  return el('main', { class: 'corpo corpo-config' }, [
    el('div', { class: 'pagina-topo' }, [
      el('h2', { text: 'Configurações' }),
      el('p', { class: 'nota' }, [
        icone('alerta', { classe: 'nota-icone' }),
        'Valem só para este navegador e já começam a valer — não precisa salvar.',
      ]),
    ]),
    el('div', { class: 'grade-config' }, [
      cartaoDoJogo(),
      cartaoDoSom(),
      cartaoDoMilhao(aoChamarMilhao),
      cartaoDeZerar(aoResetar),
    ]),
  ]);
}
