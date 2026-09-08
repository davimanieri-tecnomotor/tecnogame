# TecGame — porte HTML/CSS/JS

Reescrita completa do jogo FlutterFlow `tec_game` (o `.zip` na raiz) em HTML,
CSS e JavaScript puros — sem framework, sem build, sem dependências de runtime.

```
tec_game.zip          o projeto Flutter original (intocado)
src_game/             o zip extraído, usado como fonte pelos scripts
web/                  o jogo portado (é isto que se publica)
  index.html
  css/app.css
  js/                 os módulos ES — o código-fonte
  js/bundle.js        gerado: os mesmos módulos em um script clássico
  assets/             imagens, áudios, fontes e vídeos do original
scripts/              geradores e verificadores
```

## Como rodar

**Clicando duas vezes em `web/index.html`.** Funciona direto, sem servidor.

**Ou por HTTP**, que é o recomendado para o totem e obrigatório para publicar:

```bash
npm start                         # http://localhost:8099
# ou: cd web && python -m http.server 8080
```

Para publicar, sobe a pasta `web/` inteira — não há passo de build.

### Por que existem dois modos de boot

O código-fonte são módulos ES (`web/js/*.js`), e navegador nenhum aceita módulo
via `file://` — a origem é `null` e o fetch morre com *"blocked by CORS
policy"*, deixando a tela preta e travada. Então o `index.html` tenta os
módulos primeiro e, se falharem, carrega `web/js/bundle.js`: exatamente o mesmo
código concatenado em **um script clássico**, que o `file://` permite.

- Por HTTP → só `main.js` é baixado; o bundle nunca é buscado.
- Por `file://` → `main.js` falha, o bundle assume, o jogo roda igual.
- Se os dois falharem, aparece uma mensagem explicando o que fazer, em vez de
  tela preta.

> **Ao editar qualquer coisa em `web/js/`, rode `npm run bundle`**, senão o
> modo `file://` continua rodando a versão antiga. O `npm run check` avisa
> quando o bundle está desatualizado.

As rotas são as mesmas do `go_router`, atrás do hash para funcionar em qualquer
host estático:

| Rota original | Aqui | Tela |
| --- | --- | --- |
| `/` | `#/` | cadastro |
| `/cadastro` | `#/cadastro` | cadastro |
| `/instrucoes` | `#/instrucoes` | vídeo de instruções |
| `/telaVideoTransisao?tipo=0\|1` | `#/telaVideoTransisao?tipo=1` | vinheta de transição |
| `/roleta` | `#/roleta` | roleta |
| `/carro` | `#/carro` | carro sorteado |
| `/scanner` | `#/scanner` | escolha do equipamento |
| `/telaVideoScanner` | `#/telaVideoScanner` | vídeo do scanner |
| `/telaAcao` | `#/telaAcao` | pergunta e respostas |
| `/ganhou` | `#/ganhou` | vitória |
| `/perdeu` | `#/perdeu` | derrota |

## Como o porte foi feito

**Palco fixo de 1920x1080.** O Dart é cheio de medidas absolutas
(`Container(width: 1821.8)`, texto de 70px, `MediaQuery.sizeOf(context).width *
0.574`). Esses números só fazem sentido na resolução em que o app foi
desenhado, então `#stage` tem 1920x1080 fixos e é escalado uniformemente para
caber na janela (com tarjas preta em volta). É o mesmo resultado que o Flutter
produzia no totem, e permite copiar cada literal sem recalcular nada.
`SW`/`SH` no JS são, portanto, 1920/1080.

**Widgets viram builders de DOM.** `js/widgets.js` traz `Column`, `Row`,
`Stack`, `Align`, `Padding`, `Container`, `Txt`, `Img`, `InkWell`, `Opacity`,
`ClipRRect`, `Expanded`/`Flexible`, `Transform` etc., com a mesma semântica do
Flutter (inclusive os detalhes que costumam escapar: `Stack` alinha em
`topStart` e recorta com `Clip.hardEdge`; `MainAxisSize.max` preenche o eixo
principal; um `Container` com tamanho explícito passa restrições *tight* ao
filho; nenhum filho passa das restrições do pai). Assim cada arquivo de página
fica lado a lado com o `.dart` de origem.

**Dados gerados, não digitados.** As 30 questões (10 x pt/en/es), os 90 textos
de tradução e as 288 palavras do filtro de nomes são extraídos do Dart por
`scripts/gen_data.py` para `web/js/questions.js`, `translations.js` e
`offensive_words.js`. Nada foi transcrito à mão. Para regerar:

```bash
python scripts/gen_data.py
```

**Restante da camada FlutterFlow**, arquivo por arquivo:

| Dart | Aqui |
| --- | --- |
| `flutter_flow_theme.dart` | `js/theme.js` + tokens em `css/app.css` |
| `internationalization.dart` | `js/i18n.js` |
| `app_state.dart` | `js/state.js` |
| `custom_functions.dart` | `js/functions.js` |
| `flutter_flow_animations.dart` + `flutter_animate` | `js/anim.js` |
| `flutter_flow_timer.dart`, `instant_timer.dart`, `stop_watch_timer` | `js/timer.js` |
| `nav/nav.dart` + `page_transition` | `js/router.js` |
| `flutter_flow_drop_down.dart`, `flutter_flow_language_selector.dart`, `flutter_flow_widgets.dart`, `mask_text_input_formatter` | `js/forms.js` |
| `backend/` + `api_requests/` | `js/backend.js` |
| `just_audio` | `js/audio.js` |
| `showDialog` / `Navigator.pop` | `js/dialog.js` |

## Backend: desligado por padrão

O app Dart gravava cada partida no Firestore do projeto `projeto-assis-3qcf6v`
e mandava uma mensagem de WhatsApp por uma instância de produção da z-api.
As duas coisas estão em `js/backend.js` com a configuração original, mas
**começam desligadas** em `js/config.js`, para que abrir este porte não escreva
em dados de produção nem dispare mensagens:

```js
useFirestore: false,   // ranking compartilhado no Firestore
useWhatsApp: false,    // mensagem "você finalizou o TECNOGAME"
useAgentWebhook: false // webhook n8n (declarado no Dart, nunca chamado pela UI)
```

Com `useFirestore: false` o ranking vive no `localStorage` deste navegador, com
exatamente a mesma consulta (`where venceu == true`, `orderBy tempo desc`,
`limit n`) — as telas de ranking funcionam igual. Ligue `useFirestore` para ter
o ranking compartilhado de volta.

## Coisas que já vinham quebradas no original

- **Vídeos dos scanners.** As cinco URLs do Firebase Storage foram mantidas
  como estavam, mas o bucket hoje responde `402 Payment Required` — ou seja,
  não tocam no app Flutter também. A tela continua avançando depois dos 14s.
  Para exibi-los, coloque os `.mp4` em `web/assets/videos/scanners/` e ligue
  `useLocalScannerVideos` em `config.js`.
- **`Text('Hello World')` e a contagem de documentos** no cadastro são restos
  do scaffold do FlutterFlow. Estão reproduzidos porque ocupam altura no
  layout.
- **Resposta 1 em inglês.** No builder da primeira alternativa o Dart lê
  `respostaQuatro` da lista inglesa quando o número sorteado é 3 (pt e es leem
  `respostaTres` corretamente). O bug foi reproduzido e está marcado em
  `js/components/perguntas_erespostas.js` — basta remover o `enField` para
  corrigir.
- **`RankingWidget(acao: ...)`** recebe um callback que o Dart nunca chama, e
  `tempoAcabando` / `ajuda` são estados só de escrita. Mantidos como no
  original.
- **`scannerEscolhido == 'Xtool'`** é testado na cor dos números das respostas,
  mas esse valor nunca é atribuído — ramo morto, mantido.

## Verificação

Checagem estática, sem dependências:

```bash
node scripts/check_imports.mjs   # todo import resolve e é usado
```

Os testes de navegador usam Chromium headless (`npm i` instala o puppeteer).
Suba o servidor com `npm start` e rode:

```bash
npm run verify:routes     # as 11 rotas: erros de console, imagens, layout
npm run verify:play       # uma partida completa, ponta a ponta
npm run verify:dialogs    # diálogos, i18n, ranking de inatividade, vitória
npm run verify:sizes      # escala do palco em várias resoluções
node scripts/verify/probe.mjs telaAcao   # despeja a árvore de layout de uma rota
```

`BASE` escolhe o alvo, então os mesmos testes rodam contra o build `file://`:

```bash
BASE="file:///C:/Users/TECNOMOTOR/Desktop/Tecnogame/web/index.html" npm run verify:play
```

O que já foi conferido com eles:

- as 11 rotas renderizam sem erro de console, com todas as imagens carregando e
  nada fora do palco;
- uma partida completa roda de ponta a ponta — cadastro, máscara de telefone,
  validação dos dois campos, instruções, transição, roleta, carro, escolha do
  scanner, vídeo, pergunta, dica de suporte, confirmação, vitória/derrota e
  reiniciar;
- os diálogos de política de privacidade, nome ofensivo, equipamento inválido,
  confirmação e o ranking de inatividade dos 45s;
- a troca de idioma pt/en/es em todos os textos;
- o ramo de vitória (comparando `gabarito` com `ordemNumeros[slot]`) e o
  registro gravado, com o mesmo schema de `createUsuariosRecordData`;
- a escala do palco em 1366x768, 1280x1024, 3840x2160 e retrato, sempre
  centrada e sem rolagem;
- tudo isso duas vezes: servido por HTTP (módulos ES) e aberto por `file://`
  (bundle clássico), com resultado idêntico.
