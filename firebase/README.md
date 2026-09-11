# Infra do Firebase

Regras e índices do Firestore usados pelo TecGame, em versão controlada junto do
código que os consome. O projeto é **`tecnogame-c7e46`** — o da Tecnomotor. O
`projeto-assis-3qcf6v`, que vinha do FlutterFlow original, está morto (o bucket
dele responde 402) e não é mais usado por nada.

```bash
cd firebase
firebase deploy --only firestore:rules,firestore:indexes
```

## Antes do primeiro uso — duas coisas só existem pelo console

Sem elas a publicação do baralho na nuvem não funciona, e o painel avisa.

1. **Criar o Firestore** em `tecnogame-c7e46` (Build → Firestore Database →
   Criar banco de dados). Pode escolher *produção*: as regras deste repositório
   substituem as do assistente no `deploy` acima.
2. **Habilitar o login por e-mail/senha** (Build → Authentication → Sign-in
   method) e **criar a conta do operador** em Users. É essa conta que o botão
   "Entrar" do painel pede, e é ela que a regra de `conteudo` exige para
   escrever.

A senha `2040` do painel não tem nada a ver com isso: aquela é a tranca de
gaveta que esconde a tela (`web/js/admin/porta.js`) e viaja no JavaScript de
todo mundo. Esta é a credencial de verdade, e mora na conta de vocês.

> **O totem precisa abrir por HTTP.** O SDK do Firebase é módulo ES vindo da
> CDN, e `file://` recusa módulo ES — o mesmo motivo de existir o `bundle.js`.
> Aberto do disco, o jogo continua jogando, mas só com o baralho guardado
> naquele navegador. Para receber o que o admin publica, o totem tem de abrir
> pelo endereço do GitHub Pages.

## Por que as regras mudaram

As regras que vinham no projeto FlutterFlow original eram estas:

```
match /usuarios/{document} {
  allow create: if true;
  allow read:   if true;
  allow write:  if false;
  allow delete: if false;
}
```

Leitura pública numa coleção que guarda **nome e telefone** de cada jogador
significa que qualquer pessoa com a chave web do app — que vai no bundle, visível
a qualquer visitante — conseguia baixar a base de contatos inteira. E `create`
sem validação permitia usar a coleção como depósito de dados arbitrários.

A política de privacidade que o próprio jogo exibe diz "os dados são armazenados
de forma segura no Firebase, garantindo proteção contra acessos não autorizados"
e "não serão compartilhados com terceiros". A regra aberta contradizia isso.

## O desenho novo

O ranking precisa ser lido pelo cliente, sem servidor. Então a saída não é
fechar a leitura, é **não colocar telefone no que é lido**:

| coleção | conteúdo | cliente lê | cliente escreve |
| --- | --- | --- | --- |
| `usuarios` | nome, atuação, venceu, tempo, equipamento | sim (é o ranking) | só `create`, com formato validado |
| `contatos` | nome, telefone | **não** | só `create`, com formato validado |
| `conteudo` | baralho de perguntas/veículos publicado pelo admin | sim | só autenticado |

Escrita cega em `contatos`: o cliente grava e nunca lê de volta. Quem precisa do
telefone (o disparo de WhatsApp) passa a ler de lá autenticado, no servidor.

## Ainda pendente do lado de vocês

1. **Rotacionar os tokens da z-api.** O `Client-Token` e o token da instância
   estavam no código Dart e portanto já foram entregues ao navegador de todo
   visitante do build web — trate-os como públicos desde o lançamento. Gere
   novos e mantenha os novos **fora** do cliente.
2. **Mover o disparo de WhatsApp para o servidor.** Uma Cloud Function que leia
   `contatos` e chame a z-api resolve: o cliente chama a function, sem
   credencial nenhuma. Enquanto isso não existir, `useWhatsApp` fica `false`.
3. **Retenção de 1 ano.** A política promete exclusão automática após um ano e
   nada no projeto implementa isso. Uma TTL policy no Firestore sobre o campo
   `data` cobre, sem código.
4. **Auth para o admin.** As regras de `conteudo` e a leitura de `contatos` já
   exigem `request.auth != null`; falta habilitar um provedor (e-mail/senha
   serve) e criar a conta do operador.

A `apiKey` do Firebase pode continuar no cliente — chave web é identificador
público por design, não credencial. A defesa real são estas regras.
