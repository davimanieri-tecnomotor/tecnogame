// As duas telas de fim (lib/fim/ganhou e lib/fim/perdeu no Dart), que na 3.0
// viraram pódio.
//
// A festa mudou de lugar. O veredito agora é comemorado (ou lamentado) na
// própria tela da pergunta — o canhão de luz, a fanfarra, o ranking abrindo
// espaço para o jogador, a lição de quem errou. Repetir tudo aqui seria contar
// duas vezes a mesma coisa. Esta tela fica com o que vem DEPOIS do jogo:
//
//   - o anfitrião da Tecnomotor, com o balão de sempre (ACERTOU! / ERROUU!);
//   - o pódio dos maiores campeões, com o lugar do jogador marcado;
//   - para quem errou, se a pergunta tiver o link, o QR code do vídeo do
//     TecnomotorTV que ensina aquilo (a resposta certa já foi dita na
//     pergunta, e desde a 3.1 não se repete aqui);
//   - REINICIAR, que manda a mensagem de WhatsApp (desligada, ver config.js),
//     esquece a partida e recomeça pela vinheta.
//
// O que mostrar vem de `FFAppState.resultado`, escrito no veredito.

import { el, fonte, FutureBuilder, maybeHandleOverflow, unfocus, valueOrDefault } from '../widgets.js';
import { entrar, menosMovimento } from '../anim.js';
import { L } from '../i18n.js';
import { T } from '../textos.js';
import { FFAppState } from '../state.js';
import { formatarTempoDeResposta, posicaoNoRanking, transformaNumero } from '../functions.js';
import { Som } from '../som.js';
import { confete } from '../particulas.js';
import { enviarMensagemZap, queryUsuariosVencedores } from '../backend.js';
import { goNamed, serializeParam } from '../router.js';
import { registrarComandos } from '../comandos.js';
import { QrSvg } from '../qr.js';
import { caber, quandoNaTela } from '../ajuste.js';
import { BotaoDeAuditorio } from '../components/botao.js';

/** Os três degraus do pódio: a altura de cada um e a ordem em que sobem (do 3º ao 1º). */
const DEGRAUS = { 1: { altura: 250, ordem: 2 }, 2: { altura: 190, ordem: 1 }, 3: { altura: 140, ordem: 0 } };

export function FimWidget(spec) {
  const resultado = FFAppState.resultado;
  let saindo = false;

  const restart = async () => {
    if (saindo) return;
    saindo = true;
    Som.selecionar();
    await enviarMensagemZap({
      numero: transformaNumero(FFAppState.cadastro.telefone),
      resultado: spec.resultado(FFAppState.cadastro.nome),
    });
    FFAppState.encerrarPartida();
    goNamed('telaVideoTransisao', { queryParameters: { tipo: serializeParam(0) } });
  };

  /* ------------------------------------------------------- o anfitrião ---- */

  const balao = el('img', { class: 'fim-balao', src: spec.badgeImage, alt: '', draggable: 'false' });
  const anfitriao = el('img', { class: 'fim-anfitriao', src: spec.heroImage, alt: '', draggable: 'false' });
  const manchete = el('div', { class: 'ff-text fim-manchete', text: L(spec.headlineKey), style: { fontSize: fonte(34) } });

  /* ----------------------------------------------------------- o pódio ---- */

  const podio = (winners) => {
    const top = winners.slice(0, 3);
    const minha = resultado?.acertou
      ? posicaoNoRanking(winners, { nome: FFAppState.cadastro.nome, tempo: resultado.tempo })
      : null;

    const bloco = el('div', { class: 'fim-podio' });
    if (!top.length) {
      bloco.appendChild(el('div', { class: 'ff-text fim-vazio', text: T('rankingVazio'), style: { fontSize: fonte(24) } }));
    }
    // 2º, 1º, 3º: a ordem do pódio de verdade, com o campeão no meio.
    for (const pos of [2, 1, 3]) {
      const v = top[pos - 1];
      if (!v) {
        bloco.appendChild(el('div', { class: 'fim-degrau fim-degrau--vazio' }));
        continue;
      }
      const souEu = minha === pos;
      // O "VOCÊ" ia colado no nome ("DAVI MANI… · VOCÊ"), e com nome de gente
      // de verdade a linha passava da largura do degrau e entrava por baixo do
      // pedestal do lado. Agora ele é um selo dentro do próprio pedestal, e o
      // nome desce de fonte até caber no degrau (ver `caber`).
      const nomeNo = el('div', {
        class: 'ff-text fim-degrau-nome',
        text: maybeHandleOverflow(v.nome, { maxChars: 14, replacement: '…' }).toUpperCase(),
        style: { fontSize: fonte(24) },
      });
      const tempoNo = el('div', { class: 'ff-text fim-degrau-tempo', text: valueOrDefault(formatarTempoDeResposta(v.tempo), '—'), style: { fontSize: fonte(22) } });
      const pedestal = el('div', { class: 'fim-pedestal', style: { height: `${DEGRAUS[pos].altura}px` } }, [
        el('b', { class: 'ff-text', text: `${pos}º`, style: { fontSize: fonte(pos === 1 ? 64 : 48) } }),
        souEu ? el('span', { class: 'ff-text fim-voce', text: T('voce'), style: { fontSize: fonte(18) } }) : null,
      ]);
      const degrau = el('div', { class: ['fim-degrau', `fim-degrau--${pos}`, souEu ? 'fim-degrau--eu' : null], dataPosicao: String(pos) }, [
        nomeNo,
        tempoNo,
        pedestal,
      ]);
      bloco.appendChild(degrau);
      quandoNaTela(nomeNo, () => caber(degrau, nomeNo, 24, 14));
      const atraso = 500 + DEGRAUS[pos].ordem * 260;
      entrar(pedestal, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1.04)', offset: 0.8 }, { transform: 'none' }], {
        duration: 520,
        delay: atraso,
        easing: 'cubic-bezier(.2,.9,.3,1)',
      });
      entrar(nomeNo, [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: atraso + 380 });
      entrar(tempoNo, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: atraso + 440 });
      Som.pop(atraso / 1000 + 0.3, 480 + (3 - pos) * 140);
    }

    // Fora do pódio o jogador não sumia só do pódio: sumia do próprio ranking,
    // via nomes desconhecidos e ia embora sem saber onde tinha ficado.
    const fora =
      minha && minha > 3
        ? el('div', { class: 'fim-minha', dataEu: '1' }, [
            el('span', { class: 'ff-text', text: T('suaPosicao'), style: { fontSize: fonte(16) } }),
            el('b', { class: 'ff-text', text: `${minha}º`, style: { fontSize: fonte(34) } }),
            el('span', { class: 'ff-text', text: `${maybeHandleOverflow(FFAppState.cadastro.nome, { maxChars: 12, replacement: '…' })} · ${formatarTempoDeResposta(resultado.tempo)}`.toUpperCase(), style: { fontSize: fonte(22) } }),
          ])
        : null;
    if (fora) entrar(fora, [{ opacity: 0, transform: 'translateX(60px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 1500, easing: 'ease-out' });
    return el('div', { class: 'fim-coluna-podio' }, [
      el('div', { class: 'ff-text fim-titulo', text: L(spec.rankingTitleKey), style: { fontSize: fonte(42) } }),
      bloco,
      fora,
    ]);
  };

  /* ------------------------------------------------------------ o QR ---- */

  // A RESPOSTA CERTA NÃO VOLTA AQUI. Até a 3.0 quem errou relia o gabarito
  // nesta tela; mas ele já tinha sido dito na própria pergunta, na lição — a
  // certa acesa em verde e "A CERTA ERA A 3" —, e repetido aqui virava a tela
  // inteira de quem perdeu. Fica só o QR do vídeo do TecnomotorTV, quando a
  // pergunta tem o link: é o que o jogador leva no celular.
  const qr = !resultado?.acertou && resultado?.video ? QrSvg(resultado.video, { tamanho: 170 }) : null;
  const licao = qr
    ? (() => {
        const no = el('div', { class: 'fim-licao', dataLicao: '1' }, [
          el('div', { class: 'fim-licao-texto' }, [
            el('div', { class: 'ff-text fim-licao-titulo', text: T('aprendaNaTv'), style: { fontSize: fonte(20) } }),
            el('div', { class: 'ff-text fim-licao-aponte', text: T('aprendaAponte'), style: { fontSize: fonte(18) } }),
          ]),
          el('div', { class: 'fim-qr', dataQr: '1' }, qr),
        ]);
        entrar(no, [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 1300, easing: 'ease-out' });
        return no;
      })()
    : null;

  // O botão que encerra a partida é o maior da tela: é a única coisa a fazer
  // aqui, e quem joga de pé, a um passo do totem, tem de achá-lo sem procurar.
  const reiniciar = BotaoDeAuditorio(L(spec.buttonKey), { pulsa: true, grande: true, acao: 'reiniciar', aoTocar: restart });
  reiniciar.classList.add('fim-reiniciar');
  entrar(reiniciar, [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 2200, easing: 'ease-out' });

  /* ----------------------------------------------------------- a tela ----- */

  const direita = el('div', { class: 'fim-direita' }, [
    FutureBuilder({ future: queryUsuariosVencedores({ limit: 5 }), builder: podio }),
    licao,
  ]);

  const root = el('div', { class: ['ff-scaffold', 'pg-fim', resultado?.acertou ? 'pg-fim--ganhou' : 'pg-fim--perdeu'] }, [
    el('div', { class: 'fim-esquerda' }, [anfitriao, balao, manchete]),
    direita,
    reiniciar,
  ]);
  root.addEventListener('click', unfocus);

  entrar(anfitriao, [{ opacity: 0, transform: 'translateX(-100px)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: 'cubic-bezier(.2,.8,.3,1)' });
  entrar(balao, [{ opacity: 0, transform: 'scale(.3) rotate(-12deg)' }, { opacity: 1, transform: 'scale(1.06) rotate(2deg)', offset: 0.7 }, { opacity: 1, transform: 'none' }], {
    duration: 520,
    delay: 350,
    easing: 'cubic-bezier(.2,1.3,.4,1)',
  });
  entrar(manchete, [{ opacity: 0, transform: 'translateX(-60px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 700, easing: 'ease-out' });

  // A comemoração maior já aconteceu na pergunta; aqui é o eco dela.
  if (resultado?.acertou) {
    Som.aplauso(0.25, 2.2, 0.6);
    Som.sino(1046.5, 0.3, 0.1);
    if (!menosMovimento()) setTimeout(() => root.isConnected && confete({ x: 960, y: -20, angulo: 90, espalha: 120, forca: 500, n: 90 }), 400);
  } else {
    Som.sino(523.25, 0.2, 0.08);
  }

  const desligarComandos = registrarComandos({ principal: restart });
  root.__dispose = () => {
    desligarComandos();
  };

  return root;
}
