// A ordem de serviço: o veículo que chegou para o diagnóstico e o equipamento
// com que o jogador vai atendê-lo.
//
// Até a 2.x o lado direito da pergunta imitava a janela do software do scanner
// — barra de título, minimizar, fechar. Era vitrine de produto, mas lia-se
// como aplicativo, e não como jogo. Aqui o equipamento vira uma etiqueta,
// "VOCÊ ESTÁ USANDO", e o veículo ganha o lugar que na TV era do participante:
// num pedestal, debaixo de um canhão de luz, com a placa Mercosul com o nome.
//
// As fotos de fábrica têm margens transparentes grandes (o carro ocupa metade
// do arquivo). O recorte de cada uma foi medido no próprio arquivo — a caixa
// dos pixels com alfa acima de 40 —, e é ele que deixa o carro grande no
// pedestal. Foto enviada pelo painel não tem recorte conhecido e entra inteira.

import { el, fonte } from '../widgets.js';
import { entrar } from '../anim.js';
import { PlacaMercosul } from './placa.js';
import { Som } from '../som.js';
import { T } from '../textos.js';

const RECORTES_DE_VEICULO = {
  'assets/images/FIAT_TORO.png': 'inset(26.1% 6.3% 20.9% 6.4%)',
  'assets/images/Volvo_XC_60.png': 'inset(23.4% 6.8% 25.2% 6.7%)',
  'assets/images/BMW.png': 'inset(29.4% 6.8% 30.7% 3.6%)',
  'assets/images/BYD.png': 'inset(7.4% 2.9% 5.2% 3.4%)',
  'assets/images/GRAN_SIENA_(1).png': 'inset(27.1% 4.5% 25.4% 4.6%)',
  'assets/images/VW_-_Constellation.png': 'inset(16.3% 9.6% 17.3% 5%)',
  'assets/images/VW_-_Delivery.png': 'inset(17% 6.5% 24.2% 4.4%)',
  'assets/images/VALTRA_Agrcola.png': 'inset(10.4% 10% 10.3% 5.3%)',
  'assets/images/RENAULT_MASTER.png': 'inset(21% 8.1% 20.7% 9%)',
  'assets/images/ACCELO__1117.png': 'inset(7.3% 8.6% 7.3% 8.7%)',
};

/** O recorte medido de uma foto de fábrica, ou `null` para foto do painel. */
export const recorteDoVeiculo = (imagem) => RECORTES_DE_VEICULO[imagem] ?? null;

/**
 * Cada equipamento: a foto da etiqueta, o recorte dela e o nome.
 * `scannerEscolhido` guarda as chaves do Dart ('Rasther 3', 'Td90'...).
 */
export const EQUIPAMENTOS = {
  'Rasther 3': { foto: 'assets/images/Rasther_CANFD_(1).png', recorte: 'inset(4.6% 22.4% 4.6% 22.4%)', nome: 'RASTHER 3S' },
  RB: { foto: 'assets/images/Rasther---box,-3s---mensal-box---android.png', recorte: 'inset(31.7% 17.8% 24.2% 27.5%)', nome: 'RASTHER BOX' },
  RST: { foto: 'assets/images/Rasther_ST_+_VCI.png', recorte: 'inset(19.6% 8.3% 24.1% 12%)', nome: 'RASTHER ST' },
  'Rasther 4': { foto: 'assets/images/Rasther_ST_+_VCI.png', recorte: 'inset(19.6% 8.3% 24.1% 12%)', nome: 'RASTHER 4' },
  Td90: { foto: 'assets/images/TD_90_(2).png', recorte: 'inset(15.2% 3.3% 19.4% 2.1%)', nome: 'TD90' },
  Td80: { foto: 'assets/images/TD_80__Final_(1).png', recorte: 'inset(20.3% 4.5% 20.3% 4%)', nome: 'TD80' },
};

/**
 * @param {object} opcoes
 * @param {object} opcoes.veiculo `{ nome, imagem }`
 * @param {string} opcoes.equipamento a chave de `scannerEscolhido`
 * @param {object} opcoes.medidas `{ x, y, escala }`
 */
export function OrdemDeServico({ veiculo, equipamento, medidas, semEquipamento = false }) {
  const eq = EQUIPAMENTOS[equipamento] ?? EQUIPAMENTOS['Rasther 3'];
  const chip = el('div', { class: 'aud-os-chip aud-oculta', dataEquipamento: equipamento || 'Rasther 3' }, [
    el('img', { src: eq.foto, alt: '', draggable: 'false', style: { objectViewBox: eq.recorte } }),
    el('div', {}, [
      el('small', { class: 'ff-text', text: T('voceEstaUsando'), style: { fontSize: fonte(12) } }),
      el('strong', { class: 'ff-text', text: eq.nome, style: { fontSize: fonte(21) } }),
    ]),
  ]);
  const recorte = recorteDoVeiculo(veiculo?.imagem);
  const carro = veiculo?.imagem
    ? el('img', {
        class: 'aud-os-carro aud-oculta',
        src: veiculo.imagem,
        alt: veiculo.nome ?? '',
        draggable: 'false',
        style: recorte ? { objectViewBox: recorte } : {},
      })
    : null;
  const luz = el('div', { class: 'aud-os-luz aud-oculta' });
  const piso = el('div', { class: 'aud-os-piso aud-oculta' });
  const placa = PlacaMercosul(veiculo?.nome ?? '');
  placa.classList.add('aud-oculta');

  // A Pergunta do Milhão não passou pela escolha do equipamento: a etiqueta
  // não diria nada de verdade ali.
  if (semEquipamento) chip.style.display = 'none';

  const raiz = el(
    'div',
    {
      class: 'aud-os',
      style: {
        left: `${medidas.x}px`,
        top: `${medidas.y}px`,
        scale: medidas.escala && medidas.escala !== 1 ? String(medidas.escala) : null,
      },
    },
    [chip, el('div', { class: 'aud-os-palco' }, [luz, piso, carro]), el('div', { class: 'aud-os-placa' }, placa)]
  );

  return {
    no: raiz,
    /**
     * A chegada do veículo ao palco: a luz acende, o piso aparece, o carro sobe
     * passando um pouco do ponto, a etiqueta desliza e a placa bate como
     * carimbo — com um *clunk* no instante em que bate.
     */
    entrar() {
      entrar(luz, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 100 });
      entrar(piso, [{ opacity: 0, transform: 'scaleX(.3)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 120, easing: 'ease-out' });
      entrar(
        carro,
        [
          { opacity: 0, transform: 'translateY(46px) scale(.92)' },
          { opacity: 1, transform: 'translateY(-6px) scale(1.01)', offset: 0.7 },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 700, delay: 180, easing: 'cubic-bezier(.2,.8,.3,1)' }
      );
      entrar(chip, [{ opacity: 0, transform: 'translateX(-40px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 420, easing: 'ease-out' });
      entrar(placa, [{ opacity: 0, transform: 'scale(1.35)' }, { opacity: 1, transform: 'scale(.97)', offset: 0.6 }, { opacity: 1, transform: 'none' }], {
        duration: 340,
        delay: 640,
        easing: 'ease-out',
      });
      Som.clunk(0.66);
    },
  };
}
