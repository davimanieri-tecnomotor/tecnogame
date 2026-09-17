# TecGame — o que é preciso saber antes de mexer

Jogo de quiz de totem da Tecnomotor, para feira. O jogador se cadastra, gira uma
roleta, recebe um veículo com defeito, escolhe um scanner e tem 60 segundos para
apontar a alternativa certa. Inspirado no Jogo do Milhão.

O código é um **porte** de um projeto FlutterFlow (`tec_game`) para HTML, CSS e
JavaScript puros: **sem framework, sem build, sem dependência de runtime**.
Abre com dois cliques ou por HTTP.

```bash
npm start          # http://localhost:8099
npm run bundle     # DEPOIS de qualquer mudança em web/js/ — ver abaixo
npm run check      # imports resolvem, nada morto, bundle em dia (0,1s)
npm run verify     # a suíte inteira, 20 execuções, ~3min30
npm run verify:rapido   # só HTTP, ~110s — a volta do dia a dia
```

## As quatro regras que quebram tudo se esquecidas

**1. `npm run bundle` depois de tocar em `web/js/`.** O `bundle.js` é um artefato
**commitado**: é ele que roda quando o jogo abre do disco (`file://` recusa
módulo ES por origem nula). Esquecer significa o totem rodando código antigo. O
`npm run check` avisa, a CI falha, e o `npm run verify` regera antes de testar.

**2. Nunca editar `questions.js`, `translations.js` nem `offensive_words.js`.**
São gerados por `npm run gen` a partir do Dart original, e a CI roda o gerador e
falha se o resultado diferir do commitado. **Texto de interface novo vai em
`web/js/textos.js`**, que é lido pelo mesmo `FFLocalizations`.

> `tec_game.zip` — a fonte de onde `npm run gen` extrai esses três arquivos —
> saiu do repositório (tinha 48 MB). Sem ele, `scripts/gen_data.py` recusa
> rodar, e o passo "Dados gerados estão em sincronia" da CI falha sempre, não
> só quando alguém edita à mão. Rodar `npm run gen`/regenerar esses arquivos
> continua bloqueado até alguém decidir onde a fonte passa a morar.

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
  changelog.js       versão do jogo e as notas do sininho de novidades
  pages/ components/ admin/
    admin/respostas.js  dados de partida, telefone com login, export CSV
web/js/bundle.js   GERADO. Não editar.
scripts/verify/    a suíte (puppeteer), um arquivo por afirmação
firebase/          regras e índices do Firestore
```

O jogo vive num **palco fixo de 1920x1080** escalado para caber na janela, então
toda medida no código é absoluta e cai no mesmo pixel do Dart. A administração
mora **fora** desse palco, numa camada por cima (`#adm`), porque é ferramenta de
notebook e precisa de rolagem.

## O sininho de novidades

O painel de administração mostra, num sino na barra, as últimas atualizações
do jogo — para quem opera o totem em feiras diferentes perceber o que mudou
sem ler commit. O conteúdo mora em `web/js/changelog.js`: `VERSAO_DO_JOGO`
(acompanha o `version` do `package.json` e a tag git) e
`NOTAS_DE_ATUALIZACAO` (mais recente primeiro). O sino abre sozinho na
primeira tela depois que a versão muda e some ao fechar, só reaparecendo
sozinho na próxima mudança de versão — ver `temNovidade()`.

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

**Escala negativa é espelhamento.** `ScaleEffect({begin: [-1,-1]})` faz a coisa
nascer invertida, encolher até um ponto e voltar desvirada. Estava na tela do
carro e na dos scanners; nas duas o sintoma relatado foi "vem ao contrário".

**Chamada do Firestore não rejeita sem rede — ela fica PENDENTE.** Um `addDoc`
offline nunca falha, espera. Por isso: **grave local primeiro, sempre**, e ponha
prazo em toda chamada (`comPrazo` em `backend.js`). Sem isso a partida do jogador
sumia e a tela de fim ficava em branco esperando um ranking que não vinha.

**Em `localhost` e `file://` o jogo não fala com o Firebase.** É proposital: a
suíte joga quatro partidas por rodada e encheu o ranking de produção com dados de
teste. Para trabalhar na nuvem daqui, abra com **`?comNuvem=1`**. O ranking
continua local mesmo assim; `?semNuvem=1` desliga tudo.

## Antes de dizer que está pronto

- `npm run verify` — **20 de 20**, nos dois transportes.
- **Olhe a tela.** Um probe que devolve números pode passar com a tela quebrada:
  o bug da resposta que sumia passou por um probe verde porque eu li o JSON e
  não abri a captura. Ponha um `page.screenshot` e leia a imagem.
- Teste que não sabe falhar não vale nada. Ao consertar um bug, confira que o
  teste novo **falha** com o código antigo (`git stash` no arquivo, rode, volte).

## Postura de segurança, e o que ela não é

O jogo é servido publicamente (GitHub Pages), então **tudo que a página carrega,
todo visitante carrega** — a chave web do Firebase inclusive.

- a senha **2040** do painel é tranca de gaveta: esconde a tela de quem toca por
  acidente numa feira, e nada mais. Viaja no mesmo JavaScript do jogador;
- a escrita do baralho no Firestore é **aberta por decisão do projeto**, com a
  justificativa de que o endereço não será divulgado. O custo está escrito em
  `firebase/firestore.rules`: quem descobrir a URL reescreve o jogo;
- **`contatos` (nome + telefone) continua exigindo login de verdade** —
  `request.auth != null` no Firestore, não a senha 2040. É o que a aba
  Respostas do painel usa para mostrar telefone (`web/js/admin/respostas.js`),
  e é a ÚNICA porta: a conta de quem entra só existe se alguém do time a criar
  pelo Console do Firebase (ver `firebase/README.md`) — não há cadastro pela
  tela. Qualquer mudança que dependa só da senha 2040 ou de login anônimo para
  liberar esta coleção **não protege nada** e não deve entrar de carona numa
  tarefa que não seja essa decisão, deliberadamente. A política de privacidade
  que o próprio jogo exibe promete isso.

## Como escrever aqui

Comentário explica **por quê**, não o quê — o código já diz o quê. Quase todo
comentário deste repositório existe porque alguma coisa deu errado antes; ao
consertar algo, deixe escrito o que te enganou. Português nos comentários novos;
o que veio do porte está em inglês e pode ficar.

Números que governam sensação (tempo de giro, rigidez de mola, limiar de borrão)
vêm com o motivo e, quando dá, com a medida que os justificou.
