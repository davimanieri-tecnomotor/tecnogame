// O editor: o veículo em cima, e embaixo UMA pergunta do banco dele — os
// equipamentos que a resolvem, o gabarito e os doze campos de texto em cada um
// dos três idiomas.
//
// Veículo e pergunta são objetos separados desde a v2 do baralho (ver deck.js):
// o mesmo carro pode ter várias perguntas, e quem escolhe qual está aberta é a
// lista do painel.

import { el, campo, selecao, caixaDeMarcar, limpar, botao, entradaDeImagem } from './ui.js';
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
 * @param {object}   props
 * @param {object}   props.slot      o veículo (a fatia da roleta), mutado no lugar
 * @param {object}   props.pergunta  a pergunta do banco que está sendo editada
 * @param {number}   props.indice    posição no baralho
 * @param {Function} props.onChange  chamado a cada edição, para revalidar
 */
export function editorDeSlot({ slot, pergunta, indice, posicao = 0, total = 1, onChange }) {
  const mudou = () => onChange?.();

  /* ------------------------------------------------------------- veículo -- */

  /** Uma imagem enviada do computador vive dentro do baralho, como data URL. */
  const embutida = (src) => typeof src === 'string' && src.startsWith('data:');

  const previaFoto = el('img', { class: 'previa-foto', alt: '' });
  const semFoto = el('div', { class: 'previa-vazia', text: 'sem imagem' });
  const resumoEmbutida = el('span', { class: 'embutida-texto' });
  const blocoEmbutida = el('div', { class: 'embutida' }, [
    resumoEmbutida,
    botao('Trocar por um caminho de arquivo', {
      onClick: () => {
        slot.veiculo.imagem = '';
        campoImagem.entrada.value = '';
        atualizarPrevia();
        mudou();
      },
    }),
  ]);

  const atualizarPrevia = () => {
    // admin.html fica em web/, ao lado de assets/ — o caminho e relativo direto.
    // Com `../` funcionava por acidente no HTTP (nao se sobe acima da raiz) e
    // quebrava por file://, onde `../` sai mesmo da pasta.
    const src = slot.veiculo.imagem;
    previaFoto.src = src || '';
    previaFoto.hidden = !src;
    semFoto.hidden = Boolean(src);

    // Um data URL tem centenas de milhares de caracteres: dentro de um campo de
    // texto ele e inutil e ainda dispara `input` a cada tecla. Some o campo e
    // mostra o tamanho, com a saida para voltar ao modo caminho.
    const dentro = embutida(src);
    campoImagem.hidden = dentro;
    blocoEmbutida.hidden = !dentro;
    if (dentro) {
      resumoEmbutida.textContent = `Imagem enviada do computador — cerca de ${Math.round(src.length / 1024)} KB, guardada dentro do baralho`;
    }
  };

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

  const envio = entradaDeImagem({
    rotulo: 'Ou enviar uma imagem do computador',
    dica: 'Fica guardada dentro do baralho, então funciona no totem sem copiar arquivo nenhum. Reduzida para no máximo 1280px.',
    onEscolha: (r, arquivo) => {
      if (!r) return;
      slot.veiculo.imagem = r.dataUrl;
      // O aspecto de uma foto qualquer não é o das fotos originais, então
      // `contain` para ela caber inteira em vez de sair recortada.
      slot.veiculo.fit = 'contain';
      campoFit.entrada.value = 'contain';
      if (!slot.veiculo.nome.trim()) {
        // Sem extensão e com os separadores virando espaço: "bmw_320i.png"
        // chega como "bmw 320i", que é um chute melhor que vazio.
        const chute = (arquivo?.name ?? '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
        if (chute) {
          slot.veiculo.nome = chute;
          campoNome.entrada.value = chute;
        }
      }
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
        blocoEmbutida,
        envio,
        el('div', { class: 'linha-tres' }, [campoLargura, campoAltura, campoFit]),
      ]),
    ]),
  ]);

  /* -------------------------------------------------- gabarito e scanners -- */

  const opcoesGabarito = () =>
    CAMPO_DA_ALTERNATIVA.map((c, i) => {
      const texto = (pergunta.pt?.[c] ?? '').trim();
      const resumo = texto ? `: ${texto.slice(0, 46)}${texto.length > 46 ? '…' : ''}` : ' (vazia)';
      return { valor: String(i + 1), rotulo: `Alternativa ${i + 1}${resumo}` };
    });

  const campoGabarito = selecao({
    rotulo: 'Resposta correta',
    valor: String(pergunta.gabarito),
    opcoes: opcoesGabarito(),
    onChange: (v) => {
      pergunta.gabarito = v;
      mudou();
    },
  });

  const blocoRegras = el('section', { class: 'bloco' }, [
    el('h3', { text: 'Regras desta pergunta' }),
    campoGabarito,
    el('div', { class: 'campo' }, [
      el('span', { class: 'campo-rotulo', text: 'Equipamentos que resolvem esta pergunta' }),
      el('span', {
        class: 'campo-dica',
        text: 'Os não marcados abrem "equipamento inválido" quando o jogador escolhe. Ao menos um precisa estar marcado. Vale só para esta pergunta — outra do mesmo veículo pode pedir equipamentos diferentes.',
      }),
      el(
        'div',
        { class: 'marcar-grupo' },
        SCANNERS.map((s) =>
          caixaDeMarcar({
            rotulo: s.rotulo,
            marcado: pergunta.scanners[s.chave],
            onChange: (v) => {
              pergunta.scanners[s.chave] = v;
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
        valor: pergunta[lang][nome],
        onInput: (v) => {
          pergunta[lang][nome] = v;
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
      el('h2', { text: slot.veiculo?.nome?.trim() || `Rodada ${indice + 1}` }),
      el('span', { class: 'selo-fatia', text: `fatia ${indice + 1} da roleta` }),
      total > 1 ? el('span', { class: 'selo-fatia', text: `pergunta ${posicao + 1} de ${total}` }) : null,
      pergunta.ativa === false ? el('span', { class: 'selo-fatia selo-desligado', text: 'desligada' }) : null,
    ]),
    blocoVeiculo,
    blocoRegras,
    blocoTextos,
  ]);
  raiz.marcarErros = marcarErros;
  return raiz;
}
