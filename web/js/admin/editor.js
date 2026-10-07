// O editor: o veículo em cima, e embaixo UMA pergunta do banco dele — o texto
// nos três idiomas, a alternativa correta, os equipamentos que a resolvem e o
// vídeo.
//
// Veículo e pergunta são objetos separados desde a v2 do baralho (ver deck.js):
// o mesmo carro pode ter várias perguntas, e quem escolhe qual está aberta é a
// lista do painel.
//
// A explicação de cada campo mora no (?) ao lado do rótulo (`ajuda`, em ui.js),
// e não numa linha cinza embaixo dele: com uma dica por campo, o editor virava
// um manual, e quem só queria trocar uma pergunta lia três parágrafos para
// achar a caixa. O que é técnico — caminho de arquivo, tamanho em pixels, os
// textos que o jogo guarda e não mostra — fica dobrado num "avançado".

import { el, campo, selecao, caixaDeMarcar, limpar, botao, entradaDeImagem, ajuda, interruptor, icone, aviso } from './ui.js';
import { baixarFoto, caminhoNoStorage, enviarFoto } from './imagens.js';
import { NOME_DO_IDIOMA } from './problemas.js';
import { CAMPOS_OBRIGATORIOS, IDIOMAS, SCANNERS, VEICULOS_ORIGINAIS } from '../deck.js';

/** As alternativas na ordem em que o gabarito as numera. */
const CAMPO_DA_ALTERNATIVA = ['respostaUm', 'respostaDois', 'respostaTres', 'respostaQuatro'];

/** As dicas das ajudas: o campo, o rótulo dentro do grupo e a explicação. */
const DICAS = [
  ['ajudaApoio', 'Apoio Técnico', null],
  ['ajudaTreinamentoEad', 'Cursos EAD', null],
  [
    'ajudaTecnomotorTv',
    'TecnomotorTV',
    'Aparece também na lição de quem erra, ao lado do QR code do vídeo (quando a pergunta tem um).',
  ],
  ['ajudaComunidade', 'Comunidade', null],
  ['ajudaRepresentanteComercial', 'Representante comercial', null],
];

/** O que o jogo original guardava e nunca exibia. Continua editável, dobrado. */
const GUARDADOS = [
  ['relatoPreliminar', 'Relato preliminar'],
  ['maisInformacoes', 'Mais informações'],
];

/**
 * O "Ajustes avançados da foto" lembra se estava aberto entre um veículo e
 * outro: quem está ajustando tamanhos ajusta vários seguidos.
 */
let avancadoAberto = false;

/**
 * @param {object}   props
 * @param {object}   props.slot      o veículo (a fatia da roleta), mutado no lugar
 * @param {object}   props.pergunta  a pergunta do banco que está sendo editada
 * @param {number}   props.indice    posição no baralho
 * @param {number}   [props.posicao] posição da pergunta no banco do veículo
 * @param {number}   [props.total]   quantas perguntas o veículo tem
 * @param {number}   [props.totalDeVeiculos] para desligar o que não cabe (subir
 *   o primeiro, excluir o único)
 * @param {string}   [props.idioma]  a aba de idioma que abre — o painel a
 *   guarda entre um veículo e outro, e o clique num problema a escolhe
 * @param {Function} [props.onIdioma] avisado quando a aba de idioma muda
 * @param {Function} props.onChange  chamado a cada edição, para revalidar
 * @param {Function} [props.aoTrocarFoto] chamado quando a foto do veículo muda —
 *   é a deixa para o painel apagar do Storage a foto que ficou sem uso
 * @param {Function} [props.nuvemDeImagens] diz, NA HORA do envio, se a foto
 *   vai para o Storage (há conta do Firebase nesta aba). Função, e não valor,
 *   porque o login pode chegar com o editor já aberto. Sem ela, ou devolvendo
 *   `false`, a foto fica dentro do baralho.
 * @param {object}   [props.acoes]   o que os botões do cabeçalho fazem:
 *   `subir`, `descer`, `duplicarVeiculo`, `excluirVeiculo`,
 *   `duplicarPergunta`, `excluirPergunta` e `alternarAtiva(ligada)`
 */
export function editorDeSlot({
  slot,
  pergunta,
  indice,
  posicao = 0,
  total = 1,
  totalDeVeiculos = 1,
  idioma = 'pt',
  onIdioma = null,
  onChange,
  aoTrocarFoto = null,
  nuvemDeImagens = null,
  acoes = {},
}) {
  const mudou = () => onChange?.();
  const fotoMudou = () => {
    mudou();
    aoTrocarFoto?.();
  };

  /* ------------------------------------------------------------ cabeçalho -- */

  const nomeNaTela = () => slot.veiculo?.nome?.trim() || `Veículo ${indice + 1}`;
  const titulo = el('h2', { class: 'editor-nome', text: nomeNaTela() });

  const cabecalho = el('div', { class: 'editor-cabecalho' }, [
    el('div', { class: 'editor-titulo' }, [
      titulo,
      el('span', { class: 'editor-subtitulo' }, [
        `Fatia ${indice + 1} da roleta`,
        ajuda('A ordem da lista de veículos é a ordem das fatias na roleta. As setas mudam o lugar deste veículo.', {
          rotulo: 'Fatia da roleta',
        }),
      ]),
    ]),
    el('div', { class: 'editor-acoes' }, [
      botao('', {
        icone: 'cima',
        titulo: 'Subir na lista (uma fatia antes na roleta)',
        onClick: acoes.subir,
        disabled: indice === 0,
        acao: 'subir-veiculo',
      }),
      botao('', {
        icone: 'baixo',
        titulo: 'Descer na lista (uma fatia depois na roleta)',
        onClick: acoes.descer,
        disabled: indice >= totalDeVeiculos - 1,
        acao: 'descer-veiculo',
      }),
      botao('Duplicar veículo', { icone: 'copiar', onClick: acoes.duplicarVeiculo, acao: 'duplicar-veiculo' }),
      botao('Excluir veículo', {
        icone: 'lixeira',
        tipo: 'perigo',
        onClick: acoes.excluirVeiculo,
        disabled: totalDeVeiculos <= 1,
        titulo: totalDeVeiculos <= 1 ? 'A roleta precisa de pelo menos um veículo' : null,
        acao: 'excluir-veiculo',
      }),
    ]),
  ]);

  /* ------------------------------------------------------------- veículo -- */

  /** Uma imagem enviada do computador sem login vive dentro do baralho, como data URL. */
  const embutida = (src) => typeof src === 'string' && src.startsWith('data:');
  /** Com login, ela vai para o Storage e o baralho guarda só o endereço. */
  const noStorage = (src) => caminhoNoStorage(src) != null;

  const previaFoto = el('img', { class: 'previa-foto', alt: '' });
  const semFoto = el('div', { class: 'previa-vazia' }, [icone('imagem', { classe: 'previa-vazia-icone' }), 'sem foto']);

  // O véu do envio ao Storage, por cima da prévia. Existe porque a única pista
  // era uma linha cinza embaixo do seletor, e a prévia seguia com a foto
  // ANTIGA até o fim do envio: parecia que nada estava acontecendo.
  const preenchidoEnvio = el('div', { class: 'previa-envio-preenchido' });
  const barraEnvio = el('div', { class: 'previa-envio-barra' }, preenchidoEnvio);
  const textoEnvio = el('span', { class: 'previa-envio-texto' });
  const veuEnvio = el('div', { class: 'previa-envio', role: 'status' }, [
    el('span', { class: 'previa-envio-giro', 'aria-hidden': 'true' }),
    textoEnvio,
    barraEnvio,
  ]);
  veuEnvio.hidden = true;

  /** `fracao` null é "começando": a barra corre sem medida até o 1º pedaço subir. */
  const mostrarEnvio = (fracao) => {
    veuEnvio.hidden = false;
    const medida = typeof fracao === 'number';
    barraEnvio.classList.toggle('indeterminada', !medida);
    preenchidoEnvio.style.width = medida ? `${Math.round(fracao * 100)}%` : '';
    textoEnvio.textContent = medida ? `Enviando… ${Math.round(fracao * 100)}%` : 'Enviando…';
  };

  const previa = el('div', { class: 'previa' }, [previaFoto, semFoto, veuEnvio]);

  // Onde a foto enviada mora, e o botão de baixá-la de volta. Toma o lugar do
  // campo de caminho: um data URL tem centenas de milhares de caracteres, e o
  // endereço do Storage carrega um token que ninguém deve editar à mão.
  const resumoEmbutida = el('span', { class: 'embutida-texto' });
  const iconeEmbutida = el('span', { class: 'embutida-icone' });
  const blocoEmbutida = el('div', { class: 'embutida' }, [
    iconeEmbutida,
    resumoEmbutida,
    botao('Baixar foto', {
      icone: 'baixar',
      acao: 'baixar-foto',
      onClick: async () => {
        const r = await baixarFoto(slot.veiculo.imagem, slot.veiculo.nome);
        if (r === 'abriu') {
          aviso(
            'A foto abriu numa aba nova: clique nela com o botão direito e escolha "Salvar imagem como…". ' +
              'Para baixar direto, o Storage precisa liberar CORS (ver firebase/README.md).',
            'info',
            { ms: 9000 }
          );
        } else if (r === 'falhou') {
          aviso('Não há foto enviada para baixar.', 'erro');
        }
      },
    }),
  ]);

  const campoNome = campo({
    rotulo: 'Nome do veículo',
    valor: slot.veiculo.nome,
    obrigatorio: true,
    ajuda: 'Aparece em letras grandes na tela do carro sorteado e na fatia da roleta.',
    onInput: (v) => {
      slot.veiculo.nome = v;
      titulo.textContent = nomeNaTela();
      mudou();
    },
  });

  const campoImagem = campo({
    rotulo: 'Caminho do arquivo',
    valor: slot.veiculo.imagem,
    ajuda: 'Uma imagem que já está na pasta web/ do jogo, por exemplo assets/images/BMW.png. As fotos que vêm com o jogo e as enviadas do computador preenchem isto sozinhas.',
    onInput: (v) => {
      slot.veiculo.imagem = v.trim();
      atualizarPrevia();
      fotoMudou();
    },
  });

  // As dez fotos que já vêm no projeto, para o caso comum de reaproveitar um
  // veículo existente sem digitar caminho. Mostra a atual quando ela é uma
  // delas: é a resposta para "de onde veio esta foto?".
  const atalhoImagem = selecao({
    rotulo: 'Escolher uma das fotos do jogo',
    rotuloEscondido: true,
    valor: VEICULOS_ORIGINAIS.some((v) => v.imagem === slot.veiculo.imagem) ? slot.veiculo.imagem : '',
    opcoes: [
      { valor: '', rotulo: 'Escolher uma das fotos do jogo…' },
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
        campoLargura.entrada.value = String(original.largura);
        campoAltura.entrada.value = String(original.altura);
        campoFit.entrada.value = original.fit;
        if (!slot.veiculo.nome.trim()) {
          slot.veiculo.nome = original.nome;
          campoNome.entrada.value = original.nome;
          titulo.textContent = nomeNaTela();
        }
      }
      campoImagem.entrada.value = v;
      envio.mostrarEstado('');
      atualizarPrevia();
      fotoMudou();
    },
  });

  const envio = entradaDeImagem({
    rotulo: 'Enviar do computador',
    onEscolha: async (r, arquivo) => {
      if (!r) return;
      const nome = arquivo?.name ?? 'imagem';
      let src = r.dataUrl;
      if (nuvemDeImagens?.()) {
        // A foto escolhida já aparece, sob o véu: o operador vê O QUE está
        // subindo, e não a foto de antes.
        previaFoto.src = r.dataUrl;
        previaFoto.hidden = false;
        semFoto.hidden = true;
        mostrarEnvio(null);
        envio.mostrarEstado(`Enviando ${nome} para o Firebase Storage…`, 'andamento');
        const enviada = await enviarFoto(r.dataUrl, {
          aoProgredir: (f) => {
            mostrarEnvio(f);
            envio.mostrarEstado(`Enviando ${nome} para o Firebase Storage… ${Math.round(f * 100)}%`, 'andamento');
          },
        });
        veuEnvio.hidden = true;
        if (enviada.ok) {
          src = enviada.url;
          envio.mostrarEstado(
            `${nome} enviada — cerca de ${r.kb} KB${enviada.reaproveitada ? ' (já estava lá, foi reaproveitada)' : ''}.`,
            'ok'
          );
        } else {
          // Não perde a foto por causa da rede: ela fica dentro do baralho,
          // como sem login, e o operador sabe por quê.
          envio.mostrarEstado(`Não foi para o Storage — ${enviada.motivo} A foto ficou guardada dentro do baralho.`, 'erro');
        }
      } else {
        // Sem esta linha, quem esperava o Storage via a foto "enviada" e não
        // tinha como saber que ela não saiu deste navegador.
        envio.mostrarEstado(
          `${nome} guardada dentro do baralho (cerca de ${r.kb} KB): sem a conta do Firebase conectada, a foto não vai para o Storage.`,
          'atencao'
        );
      }
      slot.veiculo.imagem = src;
      // O aspecto de uma foto qualquer não é o das fotos originais, então
      // `contain` para ela caber inteira em vez de sair recortada.
      slot.veiculo.fit = 'contain';
      campoFit.entrada.value = 'contain';
      atalhoImagem.entrada.value = '';
      if (!slot.veiculo.nome.trim()) {
        // Sem extensão e com os separadores virando espaço: "bmw_320i.png"
        // chega como "bmw 320i", que é um chute melhor que vazio.
        const chute = (arquivo?.name ?? '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
        if (chute) {
          slot.veiculo.nome = chute;
          campoNome.entrada.value = chute;
          titulo.textContent = nomeNaTela();
        }
      }
      atualizarPrevia();
      fotoMudou();
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
      { valor: 'cover', rotulo: 'Preencher (pode cortar as bordas)' },
      { valor: 'contain', rotulo: 'Caber inteira' },
    ],
    onChange: (v) => {
      slot.veiculo.fit = v;
      mudou();
    },
  });

  // O erro de "sem foto" mora no grupo da foto, e não no campo de caminho: o
  // caminho está dobrado no avançado, e um aviso ali ninguém veria.
  const erroDaFoto = el('span', { class: 'campo-erro', role: 'alert' });
  erroDaFoto.hidden = true;

  const grupoFoto = el('div', { class: 'campo foto-campo' }, [
    el('span', { class: 'campo-rotulo' }, [
      el('span', { class: 'campo-rotulo-texto', text: 'Foto' }),
      el('span', { class: 'campo-asterisco', 'aria-hidden': 'true', text: '*' }),
      ajuda(
        'Escolha uma das fotos que vêm com o jogo ou envie uma do computador. A enviada é reduzida para no máximo 1280 px; com a conta do Firebase conectada ela vai para o Firebase Storage, e sem ela fica guardada dentro do baralho.',
        { rotulo: 'Foto' }
      ),
    ]),
    el('div', { class: 'foto-acoes' }, [atalhoImagem, envio]),
    envio.estado,
    blocoEmbutida,
    erroDaFoto,
  ]);

  const avancado = el('details', { class: 'avancado' }, [
    el('summary', {}, [
      'Ajustes avançados da foto',
      ajuda(
        'Tamanho e encaixe da foto na tela do carro sorteado, em pixels do palco de 1920×1080. Só mexa se a foto aparecer cortada ou pequena demais.',
        { rotulo: 'Ajustes avançados da foto' }
      ),
    ]),
    el('div', { class: 'avancado-corpo' }, [campoImagem, el('div', { class: 'linha-tres' }, [campoLargura, campoAltura, campoFit])]),
  ]);
  avancado.open = avancadoAberto;
  avancado.addEventListener('toggle', () => {
    avancadoAberto = avancado.open;
  });

  const atualizarPrevia = () => {
    // O painel mora em web/index.html, ao lado de assets/ — o caminho é
    // relativo direto. Com `../` funcionava por acidente no HTTP (não se sobe
    // acima da raiz) e quebrava por file://, onde `../` sai mesmo da pasta.
    const src = slot.veiculo.imagem;
    previaFoto.src = src || '';
    previaFoto.hidden = !src;
    semFoto.hidden = Boolean(src);

    const dentro = embutida(src);
    const naNuvem = noStorage(src);
    campoImagem.hidden = dentro || naNuvem;
    blocoEmbutida.hidden = !(dentro || naNuvem);
    iconeEmbutida.replaceChildren(icone(naNuvem ? 'nuvem' : 'imagem', { classe: 'embutida-icone-traco' }));
    if (dentro) {
      resumoEmbutida.textContent = `Foto enviada do computador, guardada dentro do baralho — cerca de ${Math.round(src.length / 1024)} KB`;
    } else if (naNuvem) {
      resumoEmbutida.textContent = 'Foto enviada do computador, guardada no Firebase Storage';
    }
  };

  atualizarPrevia();

  const blocoVeiculo = el('section', { class: 'bloco bloco-veiculo' }, [
    el('h3', { class: 'bloco-titulo', text: 'Veículo' }),
    el('div', { class: 'veiculo-grade' }, [
      previa,
      el('div', { class: 'veiculo-campos' }, [campoNome, grupoFoto, avancado]),
    ]),
  ]);

  /* ------------------------------------------------------------- pergunta -- */

  const sufixo = total > 1 ? ` ${posicao + 1} de ${total}` : '';
  const chaveAtiva = interruptor({
    rotulo: 'Ativa no jogo',
    ligado: pergunta.ativa !== false,
    ajuda: 'Desligada, a pergunta fica guardada como rascunho e nunca cai numa partida — e campo em branco nela não impede salvar.',
    onChange: (v) => {
      blocoPergunta.classList.toggle('desligada', !v);
      acoes.alternarAtiva?.(v);
    },
  });

  const cabecalhoPergunta = el('div', { class: 'bloco-cabecalho' }, [
    el('h3', { class: 'bloco-titulo', text: `Pergunta${sufixo}` }),
    chaveAtiva,
    el('div', { class: 'bloco-acoes' }, [
      botao('Duplicar pergunta', { icone: 'copiar', onClick: acoes.duplicarPergunta, acao: 'duplicar-pergunta' }),
      botao('Excluir pergunta', {
        icone: 'lixeira',
        tipo: 'perigo',
        onClick: acoes.excluirPergunta,
        disabled: total <= 1,
        titulo: total <= 1 ? 'Cada veículo precisa de pelo menos uma pergunta' : null,
        acao: 'excluir-pergunta',
      }),
    ]),
  ]);

  /* ---------------------------------------------------- textos e gabarito -- */

  let idiomaAtivo = IDIOMAS.includes(idioma) ? idioma : 'pt';
  const painelTextos = el('div', { class: 'textos' });
  const camposPorIdioma = {};
  const nomeDoGabarito = `gabarito-${pergunta.id ?? indice}-${posicao}`;

  /**
   * A resposta correta é marcada na própria alternativa. Era uma lista à
   * parte, longe do texto, com o começo de cada alternativa repetido nela — e
   * o operador conferia o gabarito lendo a lista, não a alternativa.
   *
   * Vale para os três idiomas: a marca é uma só, e cada aba a mostra.
   */
  function alternativa(nome, k, lang) {
    const c = campo({
      rotulo: `Alternativa ${k + 1}`,
      obrigatorio: true,
      multilinha: true,
      linhas: 1,
      semQuebra: true,
      valor: pergunta[lang][nome],
      onInput: (v) => {
        pergunta[lang][nome] = v;
        mudou();
      },
    });
    const marca = el('input', { type: 'radio', name: nomeDoGabarito, value: String(k + 1) });
    marca.checked = String(pergunta.gabarito) === String(k + 1);
    marca.addEventListener('change', () => {
      if (!marca.checked) return;
      pergunta.gabarito = String(k + 1);
      for (const a of painelTextos.querySelectorAll('.alternativa')) {
        a.classList.toggle('correta', a.dataset.alternativa === String(k + 1));
      }
      mudou();
    });
    const raiz = el('div', { class: ['alternativa', marca.checked ? 'correta' : null], 'data-alternativa': String(k + 1) }, [
      c,
      el('label', { class: 'alternativa-certa', title: 'Marcar como a resposta correta' }, [
        marca,
        el('span', { text: 'Correta' }),
      ]),
    ]);
    return { raiz, campo: c };
  }

  const desenharTextos = () => {
    limpar(painelTextos);
    const lang = idiomaAtivo;
    camposPorIdioma[lang] = {};
    const guardar = (nome, c) => {
      camposPorIdioma[lang][nome] = c;
      return c;
    };
    const texto = (nome, rotulo, { linhas = 2, ajuda: textoDeAjuda = null, obrigatorio = CAMPOS_OBRIGATORIOS.includes(nome) } = {}) =>
      guardar(
        nome,
        campo({
          rotulo,
          obrigatorio,
          multilinha: true,
          linhas,
          ajuda: textoDeAjuda,
          valor: pergunta[lang][nome],
          onInput: (v) => {
            pergunta[lang][nome] = v;
            mudou();
          },
        })
      );

    const alternativas = CAMPO_DA_ALTERNATIVA.map((nome, k) => {
      const a = alternativa(nome, k, lang);
      guardar(nome, a.campo);
      return a.raiz;
    });

    painelTextos.append(
      texto('pergunta', 'Enunciado', { linhas: 3, ajuda: 'O defeito que aparece na caixa da pergunta.' }),
      el('div', { class: 'grupo' }, [
        el('div', { class: 'grupo-titulo' }, [
          'Alternativas',
          ajuda('Marque em "Correta" a alternativa certa. A marca vale para os três idiomas.', { rotulo: 'Alternativas' }),
        ]),
        el('div', { class: 'grade-2' }, alternativas),
      ]),
      el('div', { class: 'grupo' }, [
        el('div', { class: 'grupo-titulo' }, [
          'Dicas das ajudas',
          ajuda('O que cada ajuda diz ao jogador quando ele a usa nesta pergunta.', { rotulo: 'Dicas das ajudas' }),
        ]),
        el('div', { class: 'grade-2' }, DICAS.map(([nome, rotulo, explicacao]) => texto(nome, rotulo, { ajuda: explicacao }))),
      ]),
      el('details', { class: 'avancado' }, [
        el('summary', { text: 'Textos guardados que não aparecem no jogo' }),
        el('div', { class: 'avancado-corpo grade-2' }, GUARDADOS.map(([nome, rotulo]) => texto(nome, rotulo))),
      ])
    );
  };

  const pontos = {};
  const abas = el(
    'div',
    { class: 'abas-idioma', role: 'tablist', 'aria-label': 'Idioma do texto' },
    IDIOMAS.map((lang) => {
      pontos[lang] = el('span', { class: 'aba-ponto', 'aria-hidden': 'true' });
      pontos[lang].hidden = true;
      return el(
        'button',
        {
          type: 'button',
          role: 'tab',
          class: ['aba-idioma', lang === idiomaAtivo ? 'ativa' : null],
          'aria-selected': lang === idiomaAtivo ? 'true' : 'false',
          'data-idioma': lang,
          onClick: (e) => {
            idiomaAtivo = lang;
            for (const b of abas.querySelectorAll('.aba-idioma')) {
              const ativa = b === e.currentTarget;
              b.classList.toggle('ativa', ativa);
              b.setAttribute('aria-selected', ativa ? 'true' : 'false');
            }
            onIdioma?.(lang);
            desenharTextos();
            marcarErros(ultimosErros);
          },
        },
        [NOME_DO_IDIOMA[lang], pontos[lang]]
      );
    })
  );

  desenharTextos();

  /* ------------------------------------------------- equipamentos e vídeo -- */

  const grupoDeScanners = el(
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
  );
  const erroDosScanners = el('span', { class: 'campo-erro', role: 'alert' });
  erroDosScanners.hidden = true;

  /**
   * Quem pula não vê a tela dos equipamentos, então as marcas acima não valem
   * nada nesta pergunta — e uma caixa marcada que não faz nada é pior do que
   * uma caixa desligada, porque continua parecendo uma regra.
   */
  const refletirPulo = () => {
    const pulando = pergunta.pularEquipamento === true;
    grupoDeScanners.classList.toggle('sem-efeito', pulando);
    for (const caixa of grupoDeScanners.querySelectorAll('input')) caixa.disabled = pulando;
  };

  const campoPular = caixaDeMarcar({
    rotulo: 'Pular a escolha do equipamento',
    marcado: pergunta.pularEquipamento === true,
    ajuda:
      'Para pergunta que não depende de scanner: o jogo vai do veículo direto para ela, sem a tela dos equipamentos e sem o vídeo demonstrativo. Na aba Respostas, a partida aparece com o equipamento "não escolhido".',
    onChange: (v) => {
      pergunta.pularEquipamento = v;
      refletirPulo();
      mudou();
    },
  });

  // O vídeo do TecnomotorTV que ensina o assunto desta pergunta (3.0). Quem erra
  // leva o link num QR code, na lição e na tela de fim. Um para os três
  // idiomas: o canal é em português.
  const campoVideo = campo({
    rotulo: 'Vídeo do TecnomotorTV',
    valor: pergunta.video ?? '',
    placeholder: 'https://… (opcional)',
    ajuda: 'Opcional. Quem errar esta pergunta leva um QR code para este vídeo, na lição e na tela de fim. Cole o endereço completo, começando com https://.',
    onInput: (v) => {
      pergunta.video = v.trim();
      mudou();
    },
  });

  const grupoEquipamentos = el('div', { class: 'grupo grupo-equipamentos' }, [
    el('div', { class: 'grupo-titulo' }, [
      'Equipamentos que resolvem',
      ajuda(
        'Os equipamentos sem marca recebem o carimbo INCOMPATÍVEL quando o jogador os escolhe. Marque pelo menos um. Vale só para esta pergunta: outra do mesmo veículo pode pedir equipamentos diferentes.',
        { rotulo: 'Equipamentos que resolvem' }
      ),
    ]),
    grupoDeScanners,
    erroDosScanners,
    campoPular,
  ]);

  refletirPulo();

  const blocoPergunta = el('section', { class: ['bloco', 'bloco-pergunta', pergunta.ativa === false ? 'desligada' : null] }, [
    cabecalhoPergunta,
    el('div', { class: 'pergunta-corpo' }, [
      el('div', { class: 'pergunta-textos' }, [
        el('div', { class: 'abas-linha' }, [
          abas,
          ajuda(
            'Preencha os três idiomas: se um campo ficar em branco, o jogo mostra a tela vazia naquele idioma — ele não usa o português no lugar.',
            { rotulo: 'Idiomas' }
          ),
        ]),
        painelTextos,
      ]),
      el('div', { class: 'pergunta-regras' }, [grupoEquipamentos, el('div', { class: 'grupo' }, [campoVideo])]),
    ]),
  ]);

  /* ---------------------------------------------------------- marcar erros -- */

  let ultimosErros = [];

  /**
   * Recebe as mensagens de validarBaralho() desta pergunta e acende o campo
   * correspondente, para o operador não ter de caçar na lista — e um ponto na
   * aba do idioma que tem campo em branco, que de outro jeito só se descobria
   * abrindo as três.
   */
  function marcarErros(mensagens) {
    ultimosErros = mensagens ?? [];
    for (const c of Object.values(camposPorIdioma[idiomaAtivo] ?? {})) c.marcarErro(null);
    campoNome.marcarErro(null);
    campoVideo.marcarErro(null);
    erroDaFoto.hidden = true;
    previa.classList.remove('tem-erro');
    erroDosScanners.hidden = true;
    grupoEquipamentos.classList.remove('tem-erro');
    for (const lang of IDIOMAS) pontos[lang].hidden = true;

    for (const m of ultimosErros) {
      if (/sem nome/.test(m)) campoNome.marcarErro('Obrigatório');
      if (/sem imagem/.test(m)) {
        erroDaFoto.textContent = 'Escolha uma foto do jogo ou envie uma do computador.';
        erroDaFoto.hidden = false;
        previa.classList.add('tem-erro');
      }
      if (/nenhum equipamento/.test(m)) {
        erroDosScanners.textContent = 'Marque pelo menos um equipamento — ou pule a escolha.';
        erroDosScanners.hidden = false;
        grupoEquipamentos.classList.add('tem-erro');
      }
      if (/link do vídeo/.test(m)) campoVideo.marcarErro('Precisa ser um endereço que começa com https://');
      const vazio = m.match(/(\w+) vazio em (PT|EN|ES)/);
      if (vazio) {
        const [, nome, sigla] = vazio;
        const lang = sigla.toLowerCase();
        if (pontos[lang]) pontos[lang].hidden = false;
        if (lang === idiomaAtivo) camposPorIdioma[idiomaAtivo]?.[nome]?.marcarErro('Obrigatório neste idioma');
      }
    }
  }

  const raiz = el('div', { class: 'editor' }, [cabecalho, blocoVeiculo, blocoPergunta]);
  raiz.marcarErros = marcarErros;
  return raiz;
}
