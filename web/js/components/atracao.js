// O modo de atração: o que o cadastro mostra quando ninguém está jogando.
//
// Um totem de feira vive de atrair quem passa. Os fliperamas resolviam isso com
// um "attract mode": título, recordes, demonstração e INSERT COIN. Até a 2.x o
// cadastro mostrava, depois de 45s parado, uma lista de nomes rolando devagar
// (o RankingWidget do Dart). Agora é um laço de estúdio:
//
//   - o selo com as lâmpadas correndo, como letreiro de auditório;
//   - TOQUE PARA JOGAR, pulsando, com os refletores varrendo mais rápido;
//   - o hall da fama — os cinco mais rápidos, com o título de sempre ("Rank dos
//     melhores");
//   - os números do dia deste totem: quantos jogaram e quantos acertaram, e o
//     mais rápido de hoje;
//   - a roleta girando sozinha, devagar, mostrando os veículos em jogo.
//
// Continua sendo um diálogo por cima do cadastro, e não uma tela nova: o prazo
// de inatividade de quatro minutos segue valendo (ver inatividade.js), e
// qualquer toque devolve o cadastro — que é o convite.

import { el, fonte, FutureBuilder, InkWell, maybeHandleOverflow, valueOrDefault } from '../widgets.js';
import { L } from '../i18n.js';
import { T, Tf } from '../textos.js';
import { pop } from '../dialog.js';
import { queryUsuariosVencedores } from '../backend.js';
import { formatarTempoDeResposta } from '../functions.js';
import { maisRapidoDoDia, numerosDoDia } from '../estatisticas.js';
import { usaArteOriginal } from '../deck.js';
import { FFAppState } from '../state.js';
import { rodaGerada } from '../roda.js';
import { SeloComLampadas } from './selo.js';

const MEDALHAS = ['ouro', 'prata', 'bronze'];

export function AtracaoWidget() {
  const numeros = numerosDoDia();
  const campeao = maisRapidoDoDia();

  const hallDaFama = (vencedores) => {
    const linhas = vencedores.slice(0, 5).map((v, i) =>
      el('div', { class: ['atr-linha', MEDALHAS[i] ? `atr-linha--${MEDALHAS[i]}` : null] }, [
        el('span', { class: 'ff-text atr-pos', text: `${i + 1}º`, style: { fontSize: fonte(30) } }),
        el('span', { class: 'ff-text atr-nome', text: maybeHandleOverflow(v.nome, { maxChars: 14, replacement: '…' }).toUpperCase(), style: { fontSize: fonte(30) } }),
        el('span', { class: 'ff-text atr-tempo', text: valueOrDefault(formatarTempoDeResposta(v.tempo), '—'), style: { fontSize: fonte(28) } }),
      ])
    );
    linhas.forEach((l, i) => l.style.setProperty('--i', String(i)));
    return el('div', { class: 'atr-hall' }, [
      el('div', { class: 'ff-text atr-hall-titulo', text: L('mj19n2hr') /* Rank dos melhores */, style: { fontSize: fonte(42) } }),
      linhas.length ? el('div', { class: 'atr-linhas' }, linhas) : el('div', { class: 'ff-text atr-vazio', text: T('rankingVazio'), style: { fontSize: fonte(26) } }),
    ]);
  };

  const dia =
    numeros.jogadores > 0
      ? [
          el('div', { class: 'ff-text atr-dia-numeros' }, [
            el('b', { text: T('hoje') }),
            ` · ${Tf('jogadoresHoje', { n: numeros.jogadores })} · ${Tf('acertaram', { p: numeros.porcentagem })}`,
          ]),
          campeao
            ? el('div', {
                class: 'ff-text atr-dia-campeao',
                text: Tf('maisRapidoHoje', { nome: maybeHandleOverflow(campeao.nome, { maxChars: 14, replacement: '…' }), t: formatarTempoDeResposta(campeao.tempo) }),
              })
            : null,
        ]
      : [el('div', { class: 'ff-text atr-dia-numeros', text: T('primeiroDoDia') })];
  dia.filter(Boolean).forEach((n) => (n.style.fontSize = fonte(26)));

  // A roleta de verdade do baralho em vigor, pequena e girando devagar.
  const baralho = FFAppState.baralho;
  const roda = usaArteOriginal(baralho)
    ? el('img', { src: 'assets/images/Roleta.png', alt: '', draggable: 'false' })
    : rodaGerada(baralho?.slots ?? [], { largura: 560, altura: 560 });

  const conteudo = el('div', { class: 'atr-palco' }, [
    el('div', { class: 'atr-roda' }, roda),
    el('div', { class: 'atr-esquerda' }, [
      SeloComLampadas({ largura: 600 }),
      el('div', { class: 'ff-text atr-toque', text: T('toqueParaJogar'), style: { fontSize: fonte(48) } }),
      el('div', { class: 'atr-dia' }, dia),
    ]),
    el('div', { class: 'atr-direita' }, FutureBuilder({ future: queryUsuariosVencedores({ limit: 5 }), builder: hallDaFama })),
  ]);

  // O toque em qualquer lugar devolve o cadastro: é o "insert coin".
  return InkWell({
    onTap: () => pop(),
    feedback: false,
    label: T('toqueParaJogar'),
    style: { width: '1920px', height: '1080px' },
    child: conteudo,
  });
}
