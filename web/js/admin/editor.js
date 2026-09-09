// O editor de uma rodada: o veículo, os equipamentos que a resolvem, o gabarito
// e os doze campos de texto em cada um dos três idiomas.

import { el, campo, selecao, caixaDeMarcar, limpar } from './ui.js';
import { CAMPOS_QUESTAO, CAMPOS_OBRIGATORIOS, IDIOMAS, SCANNERS, VEICULOS_ORIGINAIS } from '../deck.js';

const NOME_IDIOMA = { pt: 'Português', en: 'English', es: 'Español' };

/** Rótulo e ajuda de cada campo, para o operador não precisar adivinhar. */
const ROTULOS = {
  pergunta: ['Enunciado', 'O defeito que aparece na tela grande, à esquerda'],
  respostaUm: ['Alternativa 1', null],
  respostaDois: ['Alternativa 2', null],
  respostaTres: ['Alternativa 3', null],
  respostaQuatro: ['Alternativa 4', null],
  ajudaApoio: ['Dica — Apoio Técnico', null],
  ajudaTreinamentoEad: ['Dica — Cursos EAD', null],
  ajudaTecnomotorTv: ['Dica — TecnomotorTV', null],
  ajudaComunidade: ['Dica — Comunidade', null],
  ajudaRepresentanteComercial: ['Dica — Representante comercial', null],
  relatoPreliminar: ['Relato preliminar', 'Não aparece no jogo — o original guardava e nunca exibia'],
  maisInformacoes: ['Mais informações', 'Não aparece no jogo — o original guardava e nunca exibia'],
};

/** As alternativas na ordem em que o gabarito as numera. */
const CAMPO_DA_ALTERNATIVA = ['respostaUm', 'respostaDois', 'respostaTres', 'respostaQuatro'];

/**
 * @param {object} props
 * @param {object} props.slot a rodada, mutada no lugar
 * @param {number} props.indice posição no baralho (é a fatia da roleta)
 * @param {Function} props.onChange chamado a cada edição, para revalidar
 */
export function editorDeSlot({ slot, indice, onChange }) {
  const mudou = () => onChange?.();

  /* ------------------------------------------------------------- veículo -- */

  const previaFoto = el('img', { class: 'previa-foto', alt: '' });
  const atualizarPrevia = () => {
    // admin.html fica em web/, ao lado de assets/ — o caminho e relativo direto.
    // Com `../` funcionava por acidente no HTTP (nao se sobe acima da raiz) e
    // quebrava por file://, onde `../` sai mesmo da pasta.
    const src = slot.veiculo.imagem;
    previaFoto.src = src || '';
    previaFoto.hidden = !src;
    semFoto.hidden = Boolean(src);
  };
  const semFoto = el('div', { class: 'previa-vazia', text: 'sem imagem' });

  const campoNome = campo({
    rotulo: 'Nome do veículo',
    valor: slot.veiculo.nome,
    obrigatorio: true,
    dica: 'É o texto grande da tela "carro sorteado"',
    onInput: (v) => {
      slot.veiculo.nome = v;
      mudou();
    },
  });

  const campoImagem = campo({
    rotulo: 'Imagem',
    valor: slot.veiculo.imagem,
    obrigatorio: true,
    dica: 'Caminho dentro de web/, por exemplo assets/images/BMW.png',
    onInput: (v) => {
      slot.veiculo.imagem = v.trim();
      atualizarPrevia();
      mudou();
    },
  });

  // Atalho para as dez fotos que já vêm no projeto, para o caso comum de
  // reaproveitar um veículo existente sem digitar caminho.
  const atalhoImagem = selecao({
    rotulo: 'Usar uma imagem que já existe',
    valor: '',
    opcoes: [
      { valor: '', rotulo: '— escolher —' },
      ...VEICULOS_ORIGINAIS.map((v) => ({ valor: v.imagem, rotulo: v.nome })),
    ],
    onChange: (v) => {
      if (!v) return;
      const original = VEICULOS_ORIGINAIS.find((x) => x.imagem === v);
      slot.veiculo.imagem = v;
      if (original) {
        slot.veiculo.largura = original.largura;
        slot.veiculo.altura = original.altura;
        slot.veiculo.fit = original.fit;
        if (!slot.veiculo.nome.trim()) {
          slot.veiculo.nome = original.nome;
          campoNome.entrada.value = original.nome;
        }
      }
      campoImagem.entrada.value = v;
      atualizarPrevia();
      mudou();
    },
  });

  const campoLargura = campo({
    rotulo: 'Largura (px)',
    valor: String(slot.veiculo.largura ?? 1235),
    onInput: (v) => {
      slot.veiculo.largura = Number(v) || 0;
      mudou();
    },
  });
  const campoAltura = campo({
    rotulo: 'Altura (px)',
    valor: String(slot.veiculo.altura ?? 674),
    onInput: (v) => {
      slot.veiculo.altura = Number(v) || 0;
      mudou();
    },
  });
  const campoFit = selecao({
    rotulo: 'Encaixe',
    valor: slot.veiculo.fit ?? 'cover',
    opcoes: [
      { valor: 'cover', rotulo: 'cover — preenche e recorta' },
      { valor: 'contain', rotulo: 'contain — cabe inteira' },
    ],
    onChange: (v) => {
      slot.veiculo.fit = v;
      mudou();
    },
  });

  atualizarPrevia();

  const blocoVeiculo = el('section', { class: 'bloco' }, [
    el('h3', { text: 'Veículo' }),
    el('div', { class: 'veiculo-grade' }, [
      el('div', { class: 'previa' }, [previaFoto, semFoto]),
      el('div', { class: 'veiculo-campos' }, [
        campoNome,
        atalhoImagem,
        campoImagem,
        el('div', { class: 'linha-tres' }, [campoLargura, campoAltura, campoFit]),
      ]),
    ]),
  ]);

  /* -------------------------------------------------- gabarito e scanners -- */

  const opcoesGabarito = () =>
    CAMPO_DA_ALTERNATIVA.map((c, i) => {
      const texto = (slot.pt?.[c] ?? '').trim();
      const resumo = texto ? `: ${texto.slice(0, 46)}${texto.length > 46 ? '…' : ''}` : ' (vazia)';
      return { valor: String(i + 1), rotulo: `Alternativa ${i + 1}${resumo}` };
    });

  const campoGabarito = selecao({
    rotulo: 'Resposta correta',
    valor: String(slot.gabarito),
    opcoes: opcoesGabarito(),
    onChange: (v) => {
      slot.gabarito = v;
      mudou();
    },
  });

  const blocoRegras = el('section', { class: 'bloco' }, [
    el('h3', { text: 'Regras da rodada' }),
    campoGabarito,
    el('div', { class: 'campo' }, [
      el('span', { class: 'campo-rotulo', text: 'Equipamentos que resolvem esta rodada' }),
      el('span', {
        class: 'campo-dica',
        text: 'Os não marcados abrem "equipamento inválido" quando o jogador escolhe. Ao menos um precisa estar marcado.',
      }),
      el(
        'div',
        { class: 'marcar-grupo' },
        SCANNERS.map((s) =>
          caixaDeMarcar({
            rotulo: s.rotulo,
            marcado: slot.scanners[s.chave],
            onChange: (v) => {
              slot.scanners[s.chave] = v;
              mudou();
            },
          })
        )
      ),
    ]),
  ]);

  /* --------------------------------------------------------------- textos -- */

  let idiomaAtivo = 'pt';
  const painelTextos = el('div', { class: 'textos' });
  const camposPorIdioma = {};

  const desenharTextos = () => {
    limpar(painelTextos);
    const lang = idiomaAtivo;
    camposPorIdioma[lang] = {};
    for (const nome of CAMPOS_QUESTAO) {
      const [rotulo, dica] = ROTULOS[nome] ?? [nome, null];
      const obrigatorio = CAMPOS_OBRIGATORIOS.includes(nome);
      const c = campo({
        rotulo,
        dica,
        obrigatorio,
        multilinha: nome === 'pergunta' || nome.startsWith('ajuda') || nome === 'maisInformacoes',
        valor: slot[lang][nome],
        onInput: (v) => {
          slot[lang][nome] = v;
          // O rótulo do gabarito mostra o começo de cada alternativa em pt.
          if (lang === 'pt' && CAMPO_DA_ALTERNATIVA.includes(nome)) {
            const atual = campoGabarito.entrada.value;
            limpar(campoGabarito.entrada);
            for (const o of opcoesGabarito()) {
              const opt = el('option', { value: o.valor, text: o.rotulo });
              if (o.valor === atual) opt.selected = true;
              campoGabarito.entrada.appendChild(opt);
            }
          }
          mudou();
        },
      });
      camposPorIdioma[lang][nome] = c;
      painelTextos.appendChild(c);
    }
  };

  const abas = el(
    'div',
    { class: 'abas-idioma', role: 'tablist' },
    IDIOMAS.map((lang) =>
      el('button', {
        type: 'button',
        role: 'tab',
        class: ['aba-idioma', lang === idiomaAtivo ? 'ativa' : null],
        text: NOME_IDIOMA[lang],
        'aria-selected': lang === idiomaAtivo ? 'true' : 'false',
        onClick: (e) => {
          idiomaAtivo = lang;
          for (const b of abas.children) {
            const ativa = b === e.currentTarget;
            b.classList.toggle('ativa', ativa);
            b.setAttribute('aria-selected', ativa ? 'true' : 'false');
          }
          desenharTextos();
          marcarErros(ultimosErros);
        },
      })
    )
  );

  desenharTextos();

  const blocoTextos = el('section', { class: 'bloco' }, [
    el('h3', { text: 'Textos' }),
    el('p', { class: 'nota', text: 'Os três idiomas são independentes: o jogo não tem retorno para o português se um campo ficar vazio — a tela aparece em branco.' }),
    abas,
    painelTextos,
  ]);

  /* ---------------------------------------------------------- marcar erros -- */

  let ultimosErros = [];

  /**
   * Recebe as mensagens de validarBaralho() desta rodada e acende o campo
   * correspondente, para o operador não ter de caçar na lista.
   */
  function marcarErros(mensagens) {
    ultimosErros = mensagens ?? [];
    for (const c of Object.values(camposPorIdioma[idiomaAtivo] ?? {})) c.marcarErro(null);
    campoNome.marcarErro(null);
    campoImagem.marcarErro(null);

    for (const m of ultimosErros) {
      if (/sem nome/.test(m)) campoNome.marcarErro('Obrigatório');
      if (/sem imagem/.test(m)) campoImagem.marcarErro('Obrigatório');
      const vazio = m.match(/(\w+) vazio em (PT|EN|ES)/);
      if (vazio) {
        const [, nome, lang] = vazio;
        if (lang.toLowerCase() === idiomaAtivo) {
          camposPorIdioma[idiomaAtivo]?.[nome]?.marcarErro('Obrigatório neste idioma');
        }
      }
    }
  }

  const raiz = el('div', { class: 'editor' }, [
    el('div', { class: 'editor-cabecalho' }, [
      el('h2', { text: `Rodada ${indice + 1}` }),
      el('span', { class: 'selo-fatia', text: `fatia ${indice + 1} da roleta` }),
    ]),
    blocoVeiculo,
    blocoRegras,
    blocoTextos,
  ]);
  raiz.marcarErros = marcarErros;
  return raiz;
}
