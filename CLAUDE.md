# TecGame — o que é preciso saber antes de mexer

Jogo de quiz de totem da Tecnomotor, para feira. O jogador se cadastra, gira uma
roleta, recebe um veículo com defeito, escolhe um scanner — a pergunta pode
dispensar essa escolha, pelo baralho — e tem 60 segundos para apontar a
alternativa certa. Inspirado no Jogo do Milhão.

O código é um **porte** de um projeto FlutterFlow (`tec_game`) para HTML, CSS e
JavaScript puros: **sem framework, sem build, sem dependência de runtime**.
Abre com dois cliques ou por HTTP.

```bash
npm start          # http://localhost:8099
npm run bundle     # DEPOIS de qualquer mudança em web/js/ — ver abaixo
npm run check      # imports resolvem, nada morto, bundle em dia (0,1s)
npm test           # lógica pura, sem navegador (0,3s) — a volta mais curta
npm run dados      # os 3 arquivos gerados não foram editados à mão (0,1s)
npm run verify     # a suíte inteira, 38 execuções, ~5min
npm run verify:rapido   # só HTTP, ~110s — a volta do dia a dia
```

## As quatro regras que quebram tudo se esquecidas

**1. `npm run bundle` depois de tocar em `web/js/`.** O `bundle.js` é um artefato
**commitado**: é ele que roda quando o jogo abre do disco (`file://` recusa
módulo ES por origem nula). Esquecer significa o totem rodando código antigo. O
`npm run check` avisa, a CI falha, e o `npm run verify` regera antes de testar.

**2. Nunca editar `questions.js`, `translations.js` nem `offensive_words.js`.**
São gerados por `npm run gen` a partir do Dart original, e a CI falha se o
SHA-256 de algum deles mudar em relação a `scripts/dados_gerados.json`
(`npm run dados`). **Texto de interface novo vai em
`web/js/textos.js`**, que é lido pelo mesmo `FFLocalizations` — e **frase errada
do Dart se corrige lá também**: escreve-se a certa em `textos.js` e o ponto de
uso troca `L('chave')` por `T('nome')`, com a chave antiga anotada no cabeçalho
daquele arquivo. Corrigir na origem depende do zip que saiu do repositório.

> `tec_game.zip` — a fonte de onde `npm run gen` extrai esses três arquivos —
> saiu do repositório (tinha 48 MB). Sem ele, `scripts/gen_data.py` recusa
> rodar. A CI **não** depende dele: confere os três pelo manifesto, e só se o zip
> voltar à raiz ela também regera e compara. Regerar continua bloqueado até
> alguém decidir onde a fonte passa a morar; quando regerar, `npm run gen` já
> regrava o manifesto — commite os quatro arquivos juntos.

**3. Os dois transportes são reais.** `npm run verify` roda tudo por HTTP **e**
por `file://`, porque o totem abre do disco. Já passou bug por essa fresta (um
`../assets/…` que funcionava no HTTP e quebrava no disco). `file://` também
recusa `import()` dinâmico, então **o jogo aberto do disco nunca alcança o
Firebase**.

**4. As voltas extras da roleta são INTEIRAS.** `giro.js` soma voltas ao que o
sorteio pediu para a roda ganhar velocidade. Sendo inteiras, a fatia que para sob
a seta continua sendo a que `escolhaParaIndice()` calcula. Quebrar isso faz a
seta mostrar um carro e o jogo abrir outro — `verify/baralho.mjs` afirma as duas
pontas para todo N e todo k.

## O terreno

```
web/index.html     o jogo E a administração, num documento só
web/js/            os módulos ES — a fonte
  main.js            rotas e boot
  widgets.js         o porte dos widgets do Flutter (Container, Stack, Txt…)
  anim.js            o porte do flutter_animate sobre Web Animations API
  deck.js            o baralho: veículos, regras e perguntas
  giro.js            a física da roleta, a lingueta, o borrão, os estalos
  nuvem.js           o baralho no Firestore, sem login
  precarga.js        pede as imagens da roleta enquanto o jogador se cadastra
  inatividade.js     quatro minutos sem toque, e qualquer tela volta ao cadastro
  changelog.js       versão do jogo e as notas do sininho de novidades
  pages/ components/ admin/
    admin/respostas.js  dados de partida, telefone com login, export CSV, apagar a tabela
    admin/imagens.js    foto de veículo no Storage: envio, download, limpeza
    admin/configuracoes.js  a aba Configurações: estilo, vídeo, som, Milhão, reset
    admin/problemas.js  o que impede salvar, agrupado e na língua da tela
web/js/bundle.js   GERADO. Não editar.
scripts/unidade/   testes de lógica pura (node --test), um arquivo por assunto
scripts/verify/    a suíte (puppeteer), um arquivo por afirmação
scripts/desempenho/ muitas partidas seguidas e o armazenamento envelhecido — fora da suíte
firebase/          regras do Firestore e do Storage, os índices e o CORS do bucket
```

O jogo vive num **palco fixo de 1920x1080** escalado para caber na janela, então
toda medida no código é absoluta e cai no mesmo pixel do Dart. A administração
mora **fora** desse palco, numa camada por cima (`#adm`), porque é ferramenta de
notebook e precisa de rolagem.

No painel, a explicação de um campo vai no **(?)** ao lado do rótulo (`ajuda`,
em `admin/ui.js`), e não numa linha de dica embaixo dele: com uma dica por
campo o editor virava manual, e quem opera é leigo. `verify:admin` falha se o
editor voltar a ter descrição fixa.

## O sininho de novidades

O painel de administração mostra, num sino na barra, as últimas atualizações
do jogo — para quem opera o totem em feiras diferentes perceber o que mudou
sem ler commit. O conteúdo mora em `web/js/changelog.js`: `VERSAO_DO_JOGO`
(acompanha o `version` do `package.json` e a tag git) e
`NOTAS_DE_ATUALIZACAO` (mais recente primeiro). O sino lista só as duas
últimas versões (`NOTAS_VISIVEIS`, ver `notasVisiveis()`): a atual e a
anterior. O sino abre sozinho na primeira tela depois que a versão muda e some
ao fechar, só reaparecendo sozinho na próxima mudança de versão — ver
`temNovidade()`.

**Toda atualização grande — funcionalidade nova, mudança de comportamento que
o operador perceberia — sobe as três juntas**: `VERSAO_DO_JOGO` em
`changelog.js`, `version` em `package.json`, e um item novo em
`NOTAS_DE_ATUALIZACAO` contando em uma frase o que mudou, em linguagem de
quem opera o totem — não de commit. Fix interno sem efeito perceptível
(refatoração, ajuste de teste, documentação) não entra.

## Armadilhas que já custaram caro

Cada uma destas gerou um bug de verdade. Estão aqui para não gerarem de novo.

**`applyInitialState` escreve o quadro 0 inline e nunca apaga.** Enquanto a
animação corre ela mascara isso. Se você **cancelar** a animação, o quadro 0
volta a valer — e para uma entrada com fade isso é `opacity: 0`. Foi assim que a
resposta certa sumiu da tela na revelação. Cancelou? Limpe `style.opacity` e
`style.transform` na mão.

**Animação ganha de CSS *e* de inline.** Uma animação com `fill: both` está acima
de regra de folha e de estilo inline no cascade. Se precisa mandar numa
propriedade de um elemento animado, ou cancele a animação, ou use **outra
propriedade**: o esmaecimento dos cartões descartados virou `filter` por isso, e
o afundar do toque usa `scale` (propriedade separada) em vez de `transform`.

**`.ff-stack` recorta.** É o `Clip.hardEdge` do Flutter. Anel, sombra e tremida
que saem da caixa são aparados sem aviso — foi o que comeu o contorno verde da
resposta certa.

**`Container({color})` escreve a abreviação `background` inline**, que zera
`background-image`. Uma regra de folha com `background-image` não alcança. Para
pôr gradiente num Container, use o parâmetro `gradient`.

**`hidden` perde para `display` de folha.** `.campo` é `grid` e `.embutida` é
`flex`: desde que o envio de imagem existe, `campoImagem.hidden = true` não
escondia nada — o campo de caminho e o quadro do resumo apareciam juntos, e o
teste só lia o atributo. Elemento com `display` próprio que se esconde por
`hidden` precisa de `[hidden] { display: none }` na regra dele — e o teste
confere `getComputedStyle`, não `.hidden`.

**Escala negativa é espelhamento.** `ScaleEffect({begin: [-1,-1]})` faz a coisa
nascer invertida, encolher até um ponto e voltar desvirada. Estava na tela do
carro e na dos scanners; nas duas o sintoma relatado foi "vem ao contrário".

**Chamada do Firestore não rejeita sem rede — ela fica PENDENTE.** Um `addDoc`
offline nunca falha, espera. Por isso: **grave local primeiro, sempre**, e ponha
prazo em toda chamada (`comPrazo` em `backend.js`). Sem isso a partida do jogador
sumia e a tela de fim ficava em branco esperando um ranking que não vinha.

**Em `localhost` e `file://` o jogo não fala com o Firebase.** É proposital: a
suíte joga quatro partidas por rodada e encheu o ranking de produção com dados de
teste. Para trabalhar na nuvem daqui, abra com **`?comNuvem=1`**: o ranking e a
aba Respostas passam a LER a nuvem, mas a partida jogada aqui continua sem ser
GRAVADA nela (`rankingNaNuvem`) — ler não suja nada, gravar sujou.
`?semNuvem=1` desliga tudo.

**O ranking não tem tabela própria.** É uma consulta sobre `usuarios`, a mesma
tabela da aba Respostas, e os dois decidem de onde ler por `fonteDasPartidas`
(`backend.js`). Uma regra por lado já deu errado: com `?comNuvem=1` a tabela
mostrava a nuvem e o ranking, uma cópia no navegador. Quem apaga partidas
(`apagarPartidas`, em `admin/respostas.js`) leva o ranking junto, e tem de
chamar `esquecerRankingAdiantado()` — o ranking pedido antes da hora vale 2
minutos e sobreviveria à tabela.

**O jogo troca de tela com `replaceState`; só `/adm` empilha.** A sessão inteira
é UMA entrada do histórico, e o "voltar" do navegador no painel saía do site. A
rota `/adm` tem `empilhar` (`router.js`): o "voltar" a desempilha e cai na tela
do jogo. Duas consequências a manter: o "Voltar ao jogo" **desempilha**
(`sairDaRotaEmpilhada`) em vez de navegar, senão cada ida e volta soma uma
entrada igual; e os diálogos do painel moram no `body`, fora da camada, então
`desmontarAdmin` os fecha (`fecharDialogos`); sem isso, fechado o painel pelo
"voltar", o das novidades fica de pé em cima do jogo.

**Som que acompanha movimento sai da trajetória, no relógio do áudio.** A roleta
já errou o compasso dos dois jeitos: tocando uma gravação de ritmo próprio (que
nenhum `playbackRate` faz bater com a roda) e disparando o estalo no quadro que
mostra a divisa passada (arredonda para a grade de 16ms, e o ritmo manca). O que
funciona é o de `estalosDoGiro`: o instante vem dos mesmos trechos que a animação
desenha e é marcado com antecedência no `AudioContext`. E por `file://` a Web
Audio não busca arquivo — som gravado entra embutido em texto, como `estalo.js`.

**Column `max` dentro de Column encolhe no Flutter, e aqui enche.** A Column de
fora dá altura ILIMITADA ao filho não flexível, e sem teto o `max` do Dart vira o
tamanho dos filhos. O CSS não tem altura ilimitada: `.ff-main-max` é `height:
100%`, e a coluna que a de fora devia centralizar gruda no topo — foi o que tirou
do meio a roleta e o carro sorteado (`verify:centro`). Onde o Flutter encolheria,
escreva `min`; o `SingleChildScrollView` já faz isso sozinho.

**Animação Web em laço prende a tela inteira na memória.** `element.animate()`
não morre quando o elemento sai da página: a linha do tempo do documento a
segura enquanto ela toca, e uma com `iterations: Infinity` (o `loop: true` de
`anim.js`) toca para sempre — segurando o elemento, a tela e os ouvintes dela.
O cadastro pulsando vazava ~115 nós e 31 ouvintes por partida. O roteador e o
`pop` dos diálogos chamam `encerrarAnimacoes` antes de tirar o nó; quem remover
na mão um nó com laço de WAAPI faz o mesmo. Animação de CSS não tem o problema.
E ao medir isso: **handle do Puppeteer também segura** (`waitForSelector`,
`page.$`) — descarte com `dispose()`, senão o teste mede o próprio rastro
(`scripts/desempenho/partidas.mjs`).

## Antes de dizer que está pronto

- `npm run verify` — **38 de 38**, nos dois transportes. Teste que falha na fila
  paralela e passa sozinho é reexecutado em série e aparece com `~` na tabela: o
  resultado é verde, mas **não é limpo** — se for sempre o mesmo, investigue.
- **Olhe a tela.** Um probe que devolve números pode passar com a tela quebrada:
  o bug da resposta que sumia passou por um probe verde porque eu li o JSON e
  não abri a captura. Ponha um `page.screenshot` e leia a imagem.
- Teste que não sabe falhar não vale nada. Ao consertar um bug, confira que o
  teste novo **falha** com o código antigo (`git stash` no arquivo, rode, volte).

## A CI

`.github/workflows/ci.yml`: **estático** (imports, unidade, dados gerados, bundle
em sincronia — sem navegador, ~30s), **suíte** (uma perna por transporte, HTTP e
`file://`, em paralelo) e **resultado** (verde só se os dois forem; é o nome a
exigir numa regra de branch). O deploy do Pages (`pages.yml`) é à parte e só
roda `npm run check` — **não espera a CI**.

- **Bundle em sincronia** é o `npm run bundle` seguido de `git diff`: o `check`
  compara datas de arquivo, e num checkout novo todas são iguais.
- **Todo `puppeteer.launch` leva `--lang=pt-BR`.** O jogo escolhe o idioma por
  `navigator.language` (`i18n.js`), e o runner da CI é `en-US`: sem a flag o jogo
  abria em inglês e cinco testes não achavam "CONFIRMAR" nem "GIRAR A ROLETA".
  Teste novo: copie a flag. Para reproduzir a falha da CI aqui, troque por
  `--lang=en-US`.
- **Teste que mede geometria não mede durante animação.** A entrada de um
  elemento (`entrar`, escala 1,08 → 1) deixa a caixa maior por alguns frames, e
  numa máquina mais lenta o teste pega essa janela: foi assim que as peças coladas
  na borda (ajudas, cronômetro) "saíam da captura" no `instrucoes`. Finalize as
  animações finitas antes de medir (`getAnimations().…finish()`).
- **`TOLERAR` (em `ci.yml`) é quarentena, não esquecimento.** Hoje só
  `estalo@file`, instável: já falhou sozinho e já falhava na 3.3.0. O teste roda,
  a falha vira aviso na página da rodada e linha no resumo; localmente a suíte
  continua estrita. Conserte o teste e tire a linha — a perna `file` volta a ser
  estrita.
- **Reexecução em série (`scripts/verify/all.mjs`).** O que falha na fila
  paralela e passa sozinho vira aviso `~`, não vermelho: os testes que medem
  tempo (`playthrough`, `instrucoes`, `inatividade`, `estalo`) falham sob carga
  sem que nada tenha mudado. Quem falha de novo, sozinho, reprova. Com `-j 1`
  não há reexecução — é o modo para investigar.
- A tabela de tempos e o resumo de cada perna vão para a página da rodada
  (`GITHUB_STEP_SUMMARY`); as capturas de tela, só se falhar (`capturas-<transporte>`).
- **Teste que reprova leva o nome e o rabo da saída numa anotação** (`::error`),
  e o mesmo no resumo: o log bruto de uma rodada só abre com login, e sem isso uma
  perna vermelha diz só "exit code 1". As anotações são públicas
  (`GET /repos/<repo>/check-runs/<job>/annotations`).

## Postura de segurança, e o que ela não é

O jogo é servido publicamente (GitHub Pages), então **tudo que a página carrega,
todo visitante carrega** — a chave web do Firebase inclusive.

- **a porta do painel pede login de verdade** — a conta do Firebase, a mesma
  que já liberava telefone. É ela que o Firestore cobra para gravar o baralho
  (`conteudo`, `request.auth != null`) e para ler `contatos`;
- a senha **2040** sobrou só para onde o login é impossível: `file://`,
  localhost e feira com a internet fora — o SDK é módulo ES vindo da CDN.
  Continua sendo tranca de gaveta, porque viaja no mesmo JavaScript do jogador;
  por isso quem entra por ela entra em **modo local**, com o painel marcado na
  barra e salvar na nuvem bloqueado. Ver `web/js/admin/porta.js`;
- **"Manter conectado" nasce desmarcada e não lembra a escolha.** Sessão
  guardada no totem é painel aberto para quem der os cinco toques — com o
  telefone de todo mundo na aba Respostas. Ver `guardarSessao` em
  `web/js/admin/respostas.js`;
- o painel decide o que liberar pelo estado **real** da autenticação
  (`aoMudarOperador`), nunca pela chave de sessão que a porta grava — essa quem
  escreve é o próprio navegador, e confiar nela seria teatro;
- **`contatos` (nome + telefone) é a coleção mais fechada**, e sempre foi: a
  conta de quem entra só existe se alguém do time a criar pelo Console do
  Firebase (ver `firebase/README.md`) — não há cadastro pela tela, de propósito.
  Apagar `usuarios` e `contatos` (o "Apagar tabela" da aba Respostas) exige a
  mesma conta, e só vale depois de as regras serem publicadas
  (`firebase deploy --only firestore:rules`): até lá o Firestore devolve
  `permission-denied` e o painel diz isso.
  Qualquer mudança que dependa da senha 2040 ou de login anônimo para liberar
  esta coleção **não protege nada** e não deve entrar de carona numa tarefa que
  não seja essa decisão, deliberadamente. A política de privacidade que o
  próprio jogo exibe promete isso.

## Como escrever aqui

Comentário explica **por quê**, não o quê — o código já diz o quê. Quase todo
comentário deste repositório existe porque alguma coisa deu errado antes; ao
consertar algo, deixe escrito o que te enganou. Português nos comentários novos;
o que veio do porte está em inglês e pode ficar.

Números que governam sensação (tempo de giro, rigidez de mola, limiar de borrão)
vêm com o motivo e, quando dá, com a medida que os justificou.
