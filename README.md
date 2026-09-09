# TecGame — porte HTML/CSS/JS

Reescrita completa do jogo FlutterFlow `tec_game` (o `.zip` na raiz) em HTML,
CSS e JavaScript puros — sem framework, sem build, sem dependências de runtime.

```
tec_game.zip          o projeto Flutter original (intocado)
src_game/             o zip extraído, usado como fonte pelos scripts
web/                  o jogo portado (é isto que se publica)
  index.html            o jogo
  admin.html            a administração do baralho
  css/app.css           o jogo
  css/admin.css         a administração
  css/fonts.css         gerado: as cinco famílias auto-hospedadas
  js/                   os módulos ES — o código-fonte
  js/bundle.js          gerado: os módulos do jogo em um script clássico
  js/admin/bundle.js    gerado: idem, para a administração
  assets/               imagens, áudios, fontes e vídeos do original
firebase/             regras e índices do Firestore
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
(Uma exceção: veja **Administração** abaixo se o totem for público.)

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

O `admin.html` tem o mesmo par (`js/admin/main.js` → `js/admin/bundle.js`).

> **Ao editar qualquer coisa em `web/js/`, rode `npm run bundle`**, senão o
> modo `file://` continua rodando a versão antiga. O `npm run check` avisa
> quando o bundle está desatualizado, e o `npm run verify` regera antes de
> testar.

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

## O baralho

No Dart o conteúdo do jogo eram **três listas de questões** (pt/en/es) amarradas
por índice a duas tabelas fixas de dez veículos — a foto em `roleta.dart` e o
nome em `carro.dart`. Dez era um número cravado em quatro lugares diferentes:
no `numeroAleatorio()`, no desenho da roleta (um PNG pronto com dez fatias), na
tabela de fotos e na de nomes. Mudar uma pergunta era editar Dart; acrescentar
uma décima primeira era impossível.

`web/js/deck.js` junta tudo isso em **uma rodada** (`slot`):

```js
{
  veiculo: { nome, imagem, largura, altura, fit },
  gabarito: '3',                              // qual alternativa é a certa
  scanners: { raster3S: true, rasher4: true, xtool: false },
  pt: { pergunta, respostaUm..respostaQuatro, ajuda*, ... },
  en: { ... }, es: { ... }                    // os mesmos 12 campos por idioma
}
```

Um baralho é uma lista de rodadas, de qualquer tamanho. O que era `10` virou o
comprimento da lista:

- **o sorteio** — `numeroAleatorio(recentes, total)` continua evitando repetir
  as últimas jogadas, e cai para o baralho inteiro se a janela de recentes
  cobrir tudo (com 3 rodadas, por exemplo);
- **a volta da roleta** — o Dart guardava `escolha = 1 + k/10` (1.0, 1.1, …
  1.9) e reconstruía o índice na tela seguinte. Virou `escolha = 1 + k/N`, e
  `escolhaParaIndice()` faz a volta. Para N = 10 os números gerados são
  **idênticos** aos do Dart, uma decimal e tudo;
- **a roleta** — `web/js/roda.js` desenha a roda em SVG com N fatias, cada foto
  recortada pelo seu próprio setor. O PNG original de dez fatias continua sendo
  usado **enquanto os dez veículos forem os originais** (`usaArteOriginal()`),
  para não trocar a arte de quem não mexeu em nada.

O baralho embutido reproduz `questions.js` campo por campo — isso é testado, não
suposto (`npm run verify:baralho`).

## Administração

`web/admin.html` é a tela de operação do baralho — uma página separada, fora do
palco de 1920x1080, porque não é uma tela do jogo:

- **ver** as rodadas, com a foto, o gabarito e os 12 campos nos 3 idiomas;
- **editar** qualquer texto, com aba por idioma;
- **adicionar** e **remover** rodadas (cada uma é uma fatia da roleta);
- **veículos**: nome, caminho da imagem, largura, altura e encaixe, com atalho
  para as dez fotos que já vêm no projeto — ou **enviar uma imagem do
  computador**, que fica guardada dentro do baralho (então o totem mostra a
  foto nova sem receber arquivo nenhum);
- **regras**: qual alternativa é a correta e quais equipamentos resolvem a
  rodada (os não marcados abrem *"equipamento inválido"*);
- **validação ao vivo** — cada problema aparece na lista e acende o campo
  correspondente; **publicar fica bloqueado** enquanto houver problema;
- **restaurar o original** a qualquer momento.

O baralho publicado vai para o `localStorage` do navegador, na chave
`tecgame:baralho`. Ou seja: **o admin e o jogo precisam ser abertos na mesma
origem** (o mesmo `http://host:porta`, ou os dois pelo mesmo caminho de disco)
para que um veja o que o outro gravou. Não há servidor no meio.

Uma imagem enviada do computador vira um `data:` URL dentro do baralho, e por
isso é reduzida para no máximo 1280px de maior lado e regravada em **WebP** —
que, diferente de JPEG, tem canal alfa: as fotos do jogo são recortes com fundo
transparente, e um fundo branco apareceria como uma caixa em cima da fatia da
roleta. Uma foto de veículo fica em torno de 80 KB. Como o `localStorage` tem
só alguns megabytes, a barra do admin acende `KB — perto do limite` a partir de
3 MB, e se a gravação não couber a mensagem diz que foi **cota**, não permissão
— são problemas com soluções opostas. Para muitas fotos, o caminho barato
continua sendo copiá-las para `web/assets/images/` e referenciar pelo caminho.

> **Se o totem ficar acessível a estranhos, não copie o `admin.html` nem a
> pasta `js/admin/` para ele.** Não há senha — a proteção é a página não estar
> lá. Edite o baralho na sua máquina e leve o `localStorage`, ou sirva o admin
> em outra porta atrás da sua própria autenticação.

Os três idiomas são independentes, e o jogo **não** tem retorno para o
português quando um campo fica vazio — a tela aparece em branco. É por isso que
a validação exige os 10 campos obrigatórios em cada idioma antes de publicar.

## Como o porte foi feito

**Palco fixo de 1920x1080.** O Dart é cheio de medidas absolutas
(`Container(width: 1821.8)`, texto de 70px, `MediaQuery.sizeOf(context).width *
0.574`). Esses números só fazem sentido na resolução em que o app foi
desenhado, então `#stage` tem 1920x1080 fixos e é escalado uniformemente para
caber na janela. É o mesmo resultado que o Flutter produzia no totem, e permite
copiar cada literal sem recalcular nada. `SW`/`SH` no JS são, portanto,
1920/1080.

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
| — (novo, sem original) | `js/deck.js`, `js/roda.js`, `js/storage.js` |

## Como fica em telas que não são 1920x1080

O palco é escalado uniformemente, então a proporção nunca distorce. O que
mudou em relação a simplesmente sobrar preto em volta:

- as tarjas viraram **moldura**: a arte do jogo desfocada e escurecida atrás do
  palco (`#viewport::before`), com uma vinheta suave (`::after`) — em vez de
  duas faixas pretas duras;
- em **retrato com toque** (celular na vertical) aparece um aviso para virar o
  aparelho, porque um jogo de 16:9 em 9:16 fica com 20% da altura útil;
- `prefers-reduced-motion` desliga as animações de entrada e a rotação da
  roleta (o resultado do sorteio é o mesmo, só não gira);
- as cinco famílias de fonte são **auto-hospedadas** em
  `web/assets/fonts/`, com o `css/fonts.css` gerado por `npm run fonts`, então
  o totem não depende de internet para o texto sair certo.

**Acessibilidade**: todo alvo de toque é alcançável por `Tab`, tem `role` e
responde a `Enter` e `Espaço`; o foco tem anel visível (`:focus-visible`); a
roleta em SVG tem `role="img"` e `aria-label` com a contagem de veículos.
Testado em `npm run verify:teclado`.

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

Todo `localStorage` do projeto fica sob o prefixo `tecgame:`
(`web/js/storage.js`), com as chaves antigas ainda lidas como retorno, e as
partidas locais são podadas depois de um ano.

### Se for ligar o Firestore

`firebase/firestore.rules` e `firebase/firestore.indexes.json` estão em versão
controlada, com o `firebase/README.md` de como fazer o deploy. Duas coisas que
**não** eram assim no original e é importante saber:

- o ranking é uma consulta **pública** em `usuarios`, então o **telefone saiu
  dessa coleção** — vai para `contatos`, que é gravável às cegas e legível só
  com autenticação. No original o telefone de todo mundo estava a uma consulta
  de distância de qualquer visitante;
- as regras validam o formato de cada gravação e **negam tudo** o que não seja
  as três coleções que o jogo usa.

O token da z-api e a `apiKey` do Firebase estão em `js/config.js` como estavam
no Dart. Chave de API de Firebase web não é segredo (a proteção são as regras),
mas **o token da z-api é** — se este repositório virar público, gire o token.

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

```bash
npm run verify        # tudo: HTTP e file://, subindo o servidor sozinho
```

Isso roda a checagem estática, regera os bundles e passa os oito testes de
navegador nos **dois transportes** — 16 execuções. Sobe o `http-server` se a
porta 8099 estiver livre e reaproveita o que já estiver de pé. Para recortar:

```bash
npm run verify -- corte       # só os testes cujo nome casa
npm run verify -- --http      # só HTTP
npm run verify -- --file      # só file://
```

Os testes individuais, se quiser rodar um de cada vez (precisam do `npm start`
em outro terminal, ou de `BASE=` apontando para o `file://`):

| Comando | O que afirma |
| --- | --- |
| `npm run check` | todo import resolve, é usado, e o bundle está atualizado |
| `npm run verify:routes` | as 11 rotas: erro de console, imagem faltando, algo fora do palco |
| `npm run verify:corte` | nada **recortado** dentro do palco (texto que não cabe no próprio container) |
| `npm run verify:play` | uma partida completa, ponta a ponta |
| `npm run verify:dialogs` | diálogos, i18n, ranking de inatividade, vitória |
| `npm run verify:idioma` | trocar de idioma não apaga o formulário |
| `npm run verify:teclado` | os alvos são alcançáveis e acionáveis por teclado |
| `npm run verify:baralho` | o embutido reproduz `questions.js`; baralho de outro tamanho joga |
| `npm run verify:admin` | ver, editar, adicionar, validar, publicar, enviar imagem, remover e restaurar |
| `npm run verify:sizes` | escala do palco em 1366x768, 1280x1024, 3840x2160 e retrato |
| `node scripts/verify/probe.mjs telaAcao` | despeja a árvore de layout de uma rota |

`BASE` escolhe o alvo:

```bash
BASE="file:///C:/Users/TECNOMOTOR/Desktop/Tecnogame/web/index.html" npm run verify:play
```

### Por que os dois transportes, sempre

`file://` e HTTP são ambientes diferentes de verdade, e um bug já passou
exatamente por essa fresta: a prévia de foto do admin usava `../assets/…`, que
por HTTP funciona por acidente (não se sobe acima da raiz do servidor) e por
`file://` sai da pasta e some. Por isso o `scripts/verify/all.mjs` roda tudo
duas vezes, e o bundle expõe `window.__tecgameRequire` — é assim que os testes
alcançam os módulos por `file://`, onde `import()` dinâmico é recusado.

O `verify:corte` existe pela mesma razão de fundo. O `verify:routes` ignorava
de propósito o que estava recortado por um ancestral (porque `Stack` recorta
com `Clip.hardEdge`, e isso é legítimo), e essa regra escondeu dois bugs que
deixavam o jogo **injogável**: as alternativas colapsavam para 300px e
apareciam cortadas no meio da palavra, e a fileira de scanners saía espalhada
com dois cards cortados.
