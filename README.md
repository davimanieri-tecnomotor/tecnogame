# TecGame — porte HTML/CSS/JS

Reescrita completa do jogo FlutterFlow `tec_game` em HTML, CSS e JavaScript
puros — sem framework, sem build, sem dependências de runtime.

```
web/                  o jogo portado (é isto que se publica)
  index.html            o jogo E a administração, num documento só
  css/app.css           o jogo
  css/admin.css         a administração (tudo preso em `.adm`)
  css/fonts.css         gerado: as cinco famílias auto-hospedadas
  js/                   os módulos ES — o código-fonte
  js/admin/             a administração: porta.js, painel.js, editor.js, ui.js
  js/admin/respostas.js a aba Respostas: dados de partida, telefone com login, CSV
  js/firebase.js        o SDK, carregado sob demanda (recusado por file://)
  js/nuvem.js           o baralho no Firestore, sem login
  js/bundle.js          gerado: tudo isso em um script clássico
  assets/               imagens, áudios, fontes e vídeos do original
firebase/             regras e índices do Firestore
scripts/              geradores e verificadores
  unidade/              testes de lógica pura, sem navegador (`npm test`)
  verify/               a suíte de navegador (puppeteer)
shots/                saída dos testes (ignorada pelo git)
CLAUDE.md             as regras e as armadilhas, para quem for mexer
```

## Como rodar

**Clicando duas vezes em `web/index.html`.** Funciona direto, sem servidor.

**Ou por HTTP**, que é o recomendado para o totem e obrigatório para publicar:

```bash
npm start                         # http://localhost:8099
# ou: cd web && python -m http.server 8080
```

Para publicar, sobe a pasta `web/` inteira — não há passo de build. É o que o
`.github/workflows/pages.yml` faz a cada push na `main`: manda `web/` para o
GitHub Pages tal como está. Antes do primeiro uso, em **Settings → Pages**,
escolha **Source: GitHub Actions**.

Como todo caminho é relativo, o mesmo `web/` serve na raiz de um domínio, em
`/<repo>/` (que é onde o Pages de projeto publica) e num pendrive.

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

Há um documento e um bundle só: a administração entra no mesmo grafo. Um
`import()` dinâmico separaria os pesos, mas `import()` é recusado por `file://`
como qualquer módulo ES, e o totem abre o jogo do disco.

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
| — | `#/adm` | administração (não vem do Dart; pede login) |

### Uma transição só, e um atalho no meio do caminho

**Toda troca de tela esmaece**: a que sai apaga, a que entra acende, 300 ms
cada. Quem decide é `js/router.js`, e só ele — `goNamed` é a troca de tela e
sempre esmaece; `go` continua instantâneo, porque quem o chama não está
viajando (a troca de idioma reconstrói a MESMA tela, e a porta do admin levanta
uma camada por fora do palco). O Dart escolhia página a página entre `fade` e
`scale`, e as telas misturavam as duas: quatro delas nasciam de um ponto do
rodapé e cresciam até encher o palco. Ao acrescentar uma tela, não há o que
escolher — e é de propósito.

**A pergunta pode dispensar a escolha do equipamento.** É uma marca do baralho,
por pergunta (`pularEquipamento`, ligada na administração): há pergunta que não
depende de scanner nenhum, e para essa a tela dos cinco é uma parada sem decisão
— em feira cheia, é a fila parada. Quando ela está ligada o jogo vai do veículo
**direto** para a pergunta, com a tela do equipamento padrão (o Rasther 3S, em
`EQUIPAMENTO_PADRAO`) e sem o vídeo demonstrativo de 14s — que é a apresentação
do equipamento *escolhido*, e ali não houve escolha (ainda mais com o bucket dos
vídeos fora do ar; ver *Coisas que já vinham quebradas*). A partida fica marcada
como **sem escolha**: a coluna `Equipamento` da aba Respostas recebe
`não escolhido`, e não o padrão — ela existe para o time saber o que a feira
escolhe, e uma etapa que não aconteceu não é preferência.

**As imagens da roleta são pedidas no cadastro.** A roleta é a tela mais pesada
do jogo — a arte pronta, ou uma foto por fatia quando o baralho não é o de
fábrica — e ela mostrava as fatias se preenchendo já na tela. Como ninguém cai
nela de surpresa (entre o CONFIRMAR e a roleta passam o vídeo de instruções e a
vinheta, ~17s), `js/precarga.js` pede tudo assim que o cadastro abre. Medido num
link de 4 Mbps: **4,7s → 9ms** com a arte pronta, **2,7s → 5ms** com dez fotos
na roda desenhada.

**Quatro minutos parado, e o jogo volta ao começo.** Qualquer tela que passe
quatro minutos sem um toque ou uma tecla volta sozinha ao cadastro, e a partida
de quem saiu é esquecida (`js/inatividade.js`). Antes só o cadastro tinha
prazo: a roleta, a escolha do equipamento e o fim de jogo esperavam para
sempre, e quem chegava depois de uma partida largada jogava com o nome e o
telefone de quem tinha ido embora. O prazo é de cada tela — trocar de tela
recomeça a contagem — e duas fogem do padrão. No **cadastro**, que já é o
começo, o prazo só apaga a ficha preenchida pela metade; sem nada digitado, o
ranking do ocioso segue na tela. A **administração** não tem prazo: é
ferramenta de notebook, e quem confere a aba Respostas passa minutos sem tocar
em nada.

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
  perguntas: [                                // o banco deste veículo
    {
      id, ativa: true,
      gabarito: '3',                          // qual alternativa é a certa
      scanners: { raster3S: true, rasher4: true, xtool: false },
      pt: { pergunta, respostaUm..respostaQuatro, ajuda*, ... },
      en: { ... }, es: { ... }                // os mesmos 12 campos por idioma
    },
  ],
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

A administração é a tela de operação do baralho. Mora no mesmo `index.html`,
mas **fora** do palco de 1920x1080 — numa camada por cima dele —, porque não é
uma tela do jogo: é uma ferramenta de notebook, com layout fluido e rolagem.

**Como entrar:** cinco toques no selo do cadastro, dentro de 3 segundos, ou
`#/adm` na barra do navegador. Os dois caminhos levam ao **login** — a conta do
Firebase do projeto, a mesma que libera o telefone na aba Respostas. Uma vez
aberta, a porta fica destrancada até a aba fechar.

Onde o Firebase **não é alcançável** — jogo aberto do disco, `localhost`, ou
feira com a internet fora — não há login possível, e aí a senha **2040** abre o
painel em **modo local**: a barra mostra `sem login — só este navegador` e
salvar para os outros totens fica bloqueado. É o que impede o painel de ficar
inacessível justamente quando o operador precisa arrumar o baralho sem rede.
Ver *Até onde cada entrada protege*, mais abaixo nesta seção.

O que dá para fazer:

- **ver** as rodadas, com a foto, o gabarito e os 12 campos nos 3 idiomas;
- **editar** qualquer texto, com aba por idioma;
- **adicionar** e **remover** veículos (cada um é uma fatia da roleta) e as
  perguntas do banco de cada um;
- **veículos**: nome, caminho da imagem, largura, altura e encaixe, com atalho
  para as dez fotos que já vêm no projeto — ou **enviar uma imagem do
  computador**, que fica guardada dentro do baralho (então o totem mostra a
  foto nova sem receber arquivo nenhum);
- **regras**: qual alternativa é a correta e quais equipamentos resolvem a
  rodada (os não marcados abrem *"equipamento inválido"*) — ou **pular a escolha
  do equipamento** nesta pergunta, e aí o jogo vai do veículo direto para ela;
- **validação ao vivo** — cada problema aparece na lista e acende o campo
  correspondente; **salvar fica bloqueado** enquanto houver problema;
- **resetar todos os dados**: volta ao baralho de fábrica e apaga deste
  navegador o ranking e os telefones das partidas já jogadas. O que já foi para
  o Firebase só sai pelo console. Fica no **pé da lista de veículos**, sob
  *Antes da feira*, e não na barra — apagar tudo não é vizinho de salvar.

### Um veículo, várias perguntas

Até a v1 do baralho, um veículo tinha exatamente uma pergunta grudada nele:
caiu no VW Delivery, era sempre aquela — e numa feira o segundo da fila já sabia
a resposta. Agora cada veículo tem um **banco**, e quando a roleta para nele o
jogo **sorteia uma das ligadas**.

A seta ao lado de cada veículo abre e fecha o banco dele; fechado, ele mostra
só a contagem. A marca ao lado de cada pergunta liga e desliga. Desligada, ela fica no
banco como rascunho: não cai em partida, e campo vazio nela **não** impede
publicar. O que impede é um veículo ficar sem nenhuma ligada — aí a roleta
cairia num carro sem jogo.

Gabarito e equipamentos pertencem à **pergunta**, não ao veículo: duas perguntas
do mesmo carro podem ter resposta certa diferente e pedir scanners diferentes.

O baralho publicado antes desta mudança continua abrindo — `carregarBaralho()`
converte v1 em v2 na leitura, transformando a pergunta solta num banco de uma.

### Onde o baralho mora

Em dois lugares, e a ordem importa:

| | |
| --- | --- |
| `localStorage`, chave `tecgame:baralho` | o que o jogo **lê**, inteiro. Publicar grava aqui primeiro. |
| Firestore, `conteudo/baralho` | o que **atravessa máquinas**: o baralho inteiro. |

Para a nuvem vai **tudo** — veículo, regras e perguntas, as dez de fábrica
incluídas, mesmo intocadas. O que está gravado lá é o que o jogo joga, por
extenso, e é isso que o painel mostra quando abre.

> Houve uma versão que subia só o que diferia da fábrica e guardava o resto por
> referência. Economizava 37 KB num teto de 1 MB e, em troca, fazia o texto de
> uma pergunta original vir do `questions.js` do totem em vez do que estava
> gravado — e quem abrisse o Firestore não via o conteúdo do jogo. Não valia o
> que custava.

Salvar grava local primeiro e sobe depois, de propósito: se a internet da feira
estiver fora, o que foi editado não se perde e o painel diz o que faltou. O
totem puxa da nuvem quando a tela de cadastro monta — sem esperar, para a
partida não ficar refém da conexão — e, se vier conteúdo novo, ele vale já na
partida seguinte. Isso é o que mantém o totem jogando com a internet caída: ele
fica com a última cópia que baixou.

> **Mexendo pelo `npm start`?** Em `localhost` o jogo não fala com o Firebase —
> é o que impede a suíte de verificação, que joga quatro partidas por rodada, de
> encher o ranking da feira com dados de teste. Para trabalhar no baralho e ver
> chegar na nuvem, abra com **`?comNuvem=1`**:
>
> ```
> http://localhost:8099/index.html?comNuvem=1#/adm
> ```
>
> O ranking continua local mesmo assim, de propósito: `comNuvem` serve para
> mexer no conteúdo, não para semear `usuarios` e `contatos` com partidas de
> teste. E `?semNuvem=1` desliga tudo em qualquer lugar.

> **Salvar na nuvem exige login.** A regra de `conteudo` pede
> `request.auth != null` ([`firebase/firestore.rules`](firebase/firestore.rules)),
> e quem resolve isso é a porta do painel: ela entra com a conta do Firebase
> sempre que alcança a nuvem. Sem conta, `publicar()` para antes de tentar e diz
> o porquê — em vez de deixar o Firestore devolver um "insufficient permissions"
> que não ensina nada.
>
> Entre 11/09/2026 e 21/09/2026 essa escrita foi **aberta**, com a justificativa
> de que o endereço não seria divulgado. Fica registrado o que aquilo custava,
> para a troca não voltar sem querer: **quem descobrisse a URL reescrevia o
> jogo**, e endereço de GitHub Pages é indexável.
>
> `contatos`, com nome e telefone dos jogadores, sempre foi a mais fechada —
> `allow read: if request.auth != null`, lida só pela aba **Respostas**. A conta
> não nasce sozinha: alguém do time a cria pelo Console, e é isso que faz
> `request.auth != null` significar alguma coisa.
>
> O que só existe pelo console do Firebase — criar o Firestore e a conta de quem
> vai operar — está em [`firebase/README.md`](firebase/README.md).

E há um teto: **o Firestore recusa documento acima de 1 MB**. O baralho de
fábrica inteiro dá 38 KB, então texto não chega perto; quem estoura é foto
enviada do computador, que vira um `data:` URL de ~88 KB dentro do baralho. O
painel confere antes de enviar e diz o tamanho e o motivo, em vez de deixar o
Firestore recusar com uma mensagem críptica.

O jogo relê o baralho quando o **cadastro** monta, e não a cada tela — publicar
no meio de uma partida não pode trocar o carro debaixo do jogador. Sair pelo
"Voltar ao jogo" cai no cadastro, então a partida seguinte já usa o que você
acabou de publicar.

Uma imagem enviada do computador vira um `data:` URL dentro do baralho, e por
isso é reduzida para no máximo 1280px de maior lado e regravada em **WebP** —
que, diferente de JPEG, tem canal alfa: as fotos do jogo são recortes com fundo
transparente, e um fundo branco apareceria como uma caixa em cima da fatia da
roleta. Uma foto de veículo fica em torno de 80 KB. Como o `localStorage` tem
só alguns megabytes, a barra do admin acende `KB — perto do limite` a partir de
3 MB, e se a gravação não couber a mensagem diz que foi **cota**, não permissão
— são problemas com soluções opostas. Para muitas fotos, o caminho barato
continua sendo copiá-las para `web/assets/images/` e referenciar pelo caminho.

> **Até onde cada entrada protege.** Até a v1 a administração era um
> `admin.html` separado, e a proteção era real: bastava não copiar aquele
> arquivo para o totem. Um endereço único no GitHub Pages custou isso — o código
> do admin passou a viajar para todo navegador que abre o jogo.
>
> O **login** devolve a proteção onde ela pode existir: a conta vive no projeto
> de vocês, não no JavaScript que o jogador recebe, e é o Firestore que a cobra.
> Quem não tem conta não grava baralho nem lê telefone, por mais que abra o
> console do navegador.
>
> A senha **2040** continua sendo **tranca de gaveta**: viaja no mesmo
> JavaScript do jogador, e quem apertar F12 a lê em dez segundos. Ela impede o
> curioso e o toque errado numa feira, e nada além. Por isso só existe onde o
> login é impossível, e por isso quem entra por ela entra em modo local — o que
> se edita ali vale só naquele navegador, e nunca sobe para os outros totens.

### Respostas

A segunda aba do painel (ao lado de Veículos) mostra os dados de cada partida
— nome, atuação, equipamento, se venceu, tempo restante, respostas inválidas
— e baixa tudo num CSV, com **Baixar dados**.

Nuvem quando dá, local quando não dá, a mesma regra do baralho: com o
Firestore alcançável, a tabela junta as partidas de **todos os totens**; sem
rede (ou `file://`), mostra só o que este navegador jogou. Os dois badges no
topo da aba dizem qual dos dois está valendo, e se o **telefone** está na
mistura.

Telefone é caso à parte: `contatos` (nome + telefone) é a única coleção do
projeto que continua exigindo login de verdade — não a senha 2040 da porta,
uma conta do Firebase mesmo (**Entrar**, no topo da aba). Sem entrar, a tabela
mostra os dados da partida sem telefone; é o que a política de privacidade do
jogo promete. Local não pede login — é deste navegador mesmo, sem segredo
possível para proteger dele.

Como não há uma chave em comum entre `usuarios` e `contatos` (são dois
`addDoc` separados), o telefone é casado pelo nome e pelo horário mais
próximo (`combinar`, em `web/js/admin/respostas.js`) — palpite informado, não
garantia. Duas pessoas do mesmo nome jogando quase junto em totens diferentes
podem casar errado; para a escala de uma feira, é raro.

> **Antes de usar telefone pela primeira vez**, habilite "E-mail/senha" em
> Authentication → Sign-in method e crie a conta de quem for operar em
> Authentication → Users, os dois pelo Console do Firebase — não existe
> cadastro pela própria tela, de propósito (ver
> [`firebase/README.md`](firebase/README.md)).

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

> `tec_game.zip` (o projeto Flutter original, de onde este script extrai) saiu
> do repositório. Sem ele no lugar esperado, o comando acima recusa rodar — e
> o mesmo vale para `npm run gen` e o passo correspondente da CI (ver
> CLAUDE.md).

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

O palco é escalado uniformemente, então a proporção nunca distorce — mas tudo
encolhe junto, e é aí que mora a responsividade. As telas atendidas vão de
**1280x800** (escala 0,667) a **4K** (escala 2), passando por 1366x768,
1920x1080 e ultrawide. Nessa faixa o jogo garante **12px de texto** e **24px de
área de toque**, no mínimo, medidos na tela.

Isso não sai da escala sozinho: em 0,667 o texto de 14px do cadastro chegava a
9,3px e o link da política de privacidade a 11px de alvo. Quem sustenta o piso
são duas variáveis em `css/app.css`:

```css
#stage {
  --piso-fonte: calc(12px / min(var(--stage-scale, 1), 1));
  --piso-alvo:  calc(24px / min(var(--stage-scale, 1), 1));
}
```

Elas são escritas em px **de tela** e convertidas para px do palco pela própria
escala, então **em 1x não alcançam nada** — o totem continua pixel a pixel como
o Dart — e crescem sozinhas conforme a janela encolhe. `fonte()` em
`js/widgets.js` aplica o piso da fonte em todo texto (`max(declarado, piso)`), e
o `min-height` do `.ff-inkwell` aplica o do alvo, crescendo só a área clicável:
o desenho dentro dela não muda de tamanho. A única mudança visível em 1x é o
link da política, que ganhou 7px de altura clicável — ele tinha 17px, abaixo do
mínimo até no próprio totem.

`npm run verify:sizes` é o teste do envelope: percorre as 8 rotas em cada tela
atendida e falha se algum texto ficar abaixo de 12px, algum alvo abaixo de 24px,
algum texto for cortado ou a página rolar na horizontal. Ele também **lista as
artes que o 4K amplia** — 11 PNGs, com a largura que cada um precisaria. Isso
não se conserta em código: o `Img` desenha em px do palco, então basta
reexportar o arquivo maior e o navegador passa a reduzi-lo em vez de ampliá-lo.

O resto do que mudou em relação a simplesmente sobrar preto em volta:

- as tarjas viraram **moldura**: a arte do jogo desfocada e escurecida atrás do
  palco (`#viewport::before`), com uma vinheta suave (`::after`) — em vez de
  duas faixas pretas duras;
- em **retrato com toque** (celular na vertical) aparece um aviso para virar o
  aparelho, porque um jogo de 16:9 em 9:16 fica com 20% da altura útil;
- `prefers-reduced-motion` desliga os laços infinitos (o fundo que pulsa, a seta
  do aviso de virar o aparelho) e o giro de 7s da roleta — o resultado do
  sorteio é o mesmo, a roda só não gira, e por isso também não estala. As
  animações curtas de um disparo ficam, porque comunicam estado: o botão
  afundando ao toque, a tela entrando;
- as cinco famílias de fonte são **auto-hospedadas** em
  `web/assets/fonts/`, com o `css/fonts.css` gerado por `npm run fonts`, então
  o totem não depende de internet para o texto sair certo.

**Acessibilidade**: todo alvo de toque é alcançável por `Tab`, tem `role` e
responde a `Enter` e `Espaço`; o foco tem anel visível (`:focus-visible`); a
roleta em SVG tem `role="img"` e `aria-label` com a contagem de veículos.
Testado em `npm run verify:teclado`.

## Backend: ligado em produção, desligado na máquina de trabalho

O app Dart gravava cada partida no Firestore do projeto `projeto-assis-3qcf6v`
e mandava uma mensagem de WhatsApp por uma instância de produção da z-api. As
duas coisas continuam em `js/backend.js`; o que mudou foi **quando** valem.

Nenhuma delas é uma chave fixa: `js/config.js` decide pela **origem**, para que
mexer no jogo nunca escreva em dado de feira. São duas, e a segunda é mais
rígida que a primeira:

```js
useFirestore:   !origemDeDesenvolvimento()   // falar com o Firebase (baralho em `conteudo`)
rankingNaNuvem: !maquinaDeTrabalho() && ...  // gravar PARTIDA em `usuarios`/`contatos`
useWhatsApp:    false                        // a credencial não pode viajar no cliente
```

`file://` e `localhost` são, sem ambiguidade, alguém mexendo no jogo: ali as
duas nascem desligadas. Um IP de rede local (o totem servido de outra máquina
do estande) continua valendo como produção. `?comNuvem=1` liga a primeira, para
trabalhar no baralho pelo `npm start`; **não** liga a segunda, de propósito — é
o que impede a suíte, que joga quatro partidas por rodada, de semear o ranking
da feira. `?semNuvem=1` desliga tudo em qualquer lugar. O porquê de cada uma
está no cabeçalho de `js/config.js`, e o uso em
[Onde o baralho mora](#onde-o-baralho-mora).

Com a nuvem desligada o ranking vive no `localStorage` deste navegador, com
exatamente a mesma consulta (`where venceu == true`, `orderBy tempo desc`,
`limit n`) — as telas de ranking funcionam igual.

Todo `localStorage` do projeto fica sob o prefixo `tecgame:`
(`web/js/storage.js`), com as chaves antigas ainda lidas como retorno, e as
partidas locais são podadas depois de um ano.

### As regras do Firestore, e o que mudou do original

`firebase/firestore.rules` e `firebase/firestore.indexes.json` estão em versão
controlada, com o `firebase/README.md` de como fazer o deploy. Duas coisas que
**não** eram assim no original e é importante saber:

- o ranking é uma consulta **pública** em `usuarios`, então o **telefone saiu
  dessa coleção** — vai para `contatos`, que é gravável às cegas e legível só
  com autenticação. No original o telefone de todo mundo estava a uma consulta
  de distância de qualquer visitante;
- as regras validam o formato de cada gravação e **negam tudo** o que não seja
  as três coleções que o jogo usa.

A `apiKey` do Firebase continua em `js/config.js`, e pode: chave web é
identificador público por design, não credencial — quem defende os dados são as
regras. O **token da z-api não está mais lá**: `zapApiUrl` e `zapClientToken`
nascem vazios, e o envio se recusa a rodar sem eles. O token que vinha cravado
ali já foi servido ao navegador de todo visitante e está no histórico do git —
trate-o como exposto e **rotacione-o** no painel da z-api (é o pendente nº 1 de
[`firebase/README.md`](firebase/README.md)).

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
npm test              # só a lógica pura, sem navegador — 0,3s
npm run verify        # tudo: HTTP e file://, subindo o servidor sozinho
npm run verify:rapido # só HTTP, 6 em paralelo — a volta rápida do dia a dia
```

São dois níveis, e o de cima existe para não se pagar o de baixo a cada
mudança. `npm test` roda os testes de **unidade** (`scripts/unidade/`) com o
`node --test`: lógica que não precisa de tela — a matriz do `validarBaralho`, o
corte de um ano da retenção, a junção de `usuarios` com `contatos`, o escape do
CSV, quantos estalos a roleta dá e quando, quando o prazo de inatividade vence,
as funções que vieram do Dart. Sem navegador, sem servidor, sem `bundle`.

`npm run verify` roda a checagem estática, **os testes de unidade**, regera o
bundle e passa os treze testes de navegador nos **dois transportes** — 26
execuções. Sobe o `http-server` se a porta 8099 estiver livre e reaproveita o
que já estiver de pé.

O que vai para cada nível: se a afirmação só é verdade com o jogo desenhado na
tela, ela é de navegador. Se é sobre o que uma função devolve, é de unidade — e
aí vale a pena cobrir as bordas, porque custam microssegundos. O que já está
afirmado num nível **não se repete no outro**: a conversão de baralho v1 para
v2, por exemplo, mora no `verify:baralho`, com o jogo rodando, e não tem cópia
em `scripts/unidade/`.

As 26 execuções correm **em paralelo** (4 de cada vez por padrão). Cada teste
sobe o próprio Chrome e só lê do servidor, então não disputam nada entre si; o
que os prendia era o laço sequencial do `all.mjs`. A saída de cada um sai
inteira quando ele termina, e no fim vem o tempo de cada execução — é assim que
se descobre qual teste está segurando a fila. Para recortar:

```bash
npm run verify -- corte       # só os testes cujo nome casa
npm run verify -- --http      # só HTTP
npm run verify -- --file      # só file://
npm run verify -- -j 8        # quantos em paralelo (cada um é um Chrome)
npm run verify -- -j 1 corte  # um de cada vez, com a saída ao vivo
```

Cada par (teste, transporte) escreve suas imagens em
`shots/<transporte>/<teste>`, para o `file://` não sobrescrever o do HTTP. Um
teste rodado sozinho escreve em `shots/<teste>`. Tudo dentro de `shots/`, que o
git ignora.

Os testes individuais, se quiser rodar um de cada vez (precisam do `npm start`
em outro terminal, ou de `BASE=` apontando para o `file://`):

| Comando | O que afirma |
| --- | --- |
| `npm run check` | todo import resolve, é usado, e o bundle está atualizado |
| `npm test` | lógica pura, sem navegador: validação do baralho, retenção, junção de respostas, CSV, estalos da roleta, prazo de inatividade, funções do Dart |
| `npm run verify:routes` | as 11 rotas: erro de console, imagem faltando, algo fora do palco |
| `npm run verify:corte` | nada **recortado** dentro do palco (texto que não cabe no próprio container) |
| `npm run verify:play` | uma partida completa, ponta a ponta |
| `npm run verify:dialogs` | diálogos, i18n, ranking de inatividade, vitória |
| `npm run verify:idioma` | trocar de idioma não apaga o formulário |
| `npm run verify:teclado` | os alvos são alcançáveis e acionáveis por teclado |
| `npm run verify:baralho` | o embutido reproduz `questions.js`; baralho de outro tamanho joga |
| `npm run verify:estalo` | a roleta estala uma vez por divisa, no instante e no ritmo em que a tela mostra a roda |
| `npm run verify:centro` | a roleta e o carro sorteado ficam no meio do palco, como no Dart |
| `npm run verify:admin` | ver, editar, adicionar, validar, publicar, enviar imagem, remover e restaurar |
| `npm run verify:respostas` | aba Respostas: dados locais com telefone, baixa CSV de verdade, sem nuvem não mostra Entrar |
| `npm run verify:inatividade` | quatro minutos sem toque devolvem qualquer tela ao cadastro, sem a partida de quem saiu; no cadastro só a ficha começada sai, e o painel fica de fora |
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
