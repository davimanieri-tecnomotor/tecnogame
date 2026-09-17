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

**Criar o Firestore** em `tecnogame-c7e46` (Build → Firestore Database → Criar
banco de dados). Pode escolher *produção*: as regras deste repositório
substituem as do assistente no `deploy` acima.

**Login por e-mail/senha, para a aba Respostas do painel ver telefone.** A
escrita do baralho continua sem exigir login (ver abaixo) — isto é só para
quem administra enxergar o telefone de quem jogou. Dois passos, os dois pelo
Console, nenhum pela tela do jogo:

1. Authentication → Sign-in method → habilitar "E-mail/senha".
2. Authentication → Users → Add user, com o e-mail e a senha de quem for
   operar. **Não existe cadastro pela própria tela, de propósito**: se
   qualquer um pudesse criar a própria conta, `request.auth != null` não
   protegeria nada — é a regra que `contatos` usa (ver abaixo).

Sem esses dois passos o painel funciona normalmente; só a coluna de telefone
na aba Respostas fica de fora.

## A escrita do baralho é aberta, por decisão do projeto

`conteudo/baralho` aceita escrita de qualquer um, com a justificativa de que o
endereço do jogo não será divulgado. Fica registrado o que isso custa:

- **quem descobrir a URL reescreve o jogo.** Não há segredo possível no cliente
  — a chave web vai no bundle —, então a única proteção passa a ser ninguém
  saber o endereço, e endereço de GitHub Pages é indexável;
- a senha `2040` do painel não muda nada disso: ela é a tranca de gaveta que
  esconde a tela (`web/js/admin/porta.js`) e viaja no mesmo JavaScript que o
  jogador recebe.

O que as regras ainda defendem: o **formato**. Sem `isBaralhoValido`, a coleção
viraria depósito de dados arbitrários de quem passasse.

E o que **não** foi afrouxado junto: `contatos`, que guarda nome e telefone de
jogador de verdade. A regra continua `allow read: if request.auth != null` —
só quem tem uma conta de verdade do Firebase lê, e essa conta só existe se
alguém do time a criar pelo Console (ver "Antes do primeiro uso", acima). É o
que a aba Respostas do painel (`web/js/admin/respostas.js`) usa para mostrar
telefone; sem entrar, a aba mostra os dados da partida sem ele. A política de
privacidade que o próprio jogo exibe promete que isso não fica público.

O conserto, se um dia o conteúdo do baralho passar a valer alguma coisa: voltar
`allow write: if request.auth != null` em `conteudo` — o login de e-mail/senha
já está de volta (ver acima), é só reaproveitar.

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
| `usuarios` | nome, atuação, venceu, tempo, equipamento | sim (é o ranking, e a aba Respostas do painel) | só `create`, com formato validado |
| `contatos` | nome, telefone | **só autenticado** (aba Respostas do painel, ver acima) | só `create`, com formato validado |
| `conteudo` | baralho de veículos, regras e perguntas salvo pelo admin | sim | **qualquer um**, com formato validado (ver acima) |

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
4. **Auth para o admin — de volta, mas só para ler `contatos`.** A escrita do
   baralho continua aberta (ver acima); o que passou a exigir login de
   e-mail/senha foi ler telefone na aba Respostas do painel. Sem os dois
   passos do Console em "Antes do primeiro uso", o painel funciona igual — só
   a coluna de telefone some.

A `apiKey` do Firebase pode continuar no cliente — chave web é identificador
público por design, não credencial. A defesa real são estas regras.
