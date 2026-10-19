// Confere que os três arquivos GERADOS não foram editados à mão.
//
// A CI conferia isso rodando o gerador e comparando o resultado com o commitado.
// Só que o gerador extrai do `tec_game.zip`, e o zip saiu do repositório: o
// passo falhava sempre, com ou sem edição à mão, e a CI inteira ficava vermelha
// por um motivo que ninguém podia consertar mexendo no código. Aqui a conta é
// outra: o manifesto guarda o SHA-256 do que o gerador produziu, e a conferência
// só pede que nada tenha mudado desde então.
//
// O manifesto só deveria mudar por `npm run gen`, que o regrava ao terminar. Quem
// editar um dos três arquivos à mão tem de editar o manifesto junto, e isso
// aparece no diff do review — que é o que se queria: tornar a edição visível.
//
// Uso:
//   node scripts/check_dados.mjs            confere (CI e `npm run dados`)
//   node scripts/check_dados.mjs --gravar   regrava o manifesto (`npm run gen`)
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFESTO = path.join(RAIZ, 'scripts', 'dados_gerados.json');
const ARQUIVOS = ['web/js/questions.js', 'web/js/translations.js', 'web/js/offensive_words.js'];

// CRLF vira LF antes do hash, pelo mesmo motivo do bundle.mjs: um checkout com
// fim de linha do Windows não pode reprovar um arquivo que não mudou.
const hash = (arquivo) =>
  createHash('sha256')
    .update(fs.readFileSync(path.join(RAIZ, arquivo), 'utf8').replace(/\r\n/g, '\n'))
    .digest('hex');

const atual = Object.fromEntries(ARQUIVOS.map((a) => [a, hash(a)]));

if (process.argv.includes('--gravar')) {
  fs.writeFileSync(MANIFESTO, `${JSON.stringify(atual, null, 2)}\n`);
  console.log(`manifesto regravado: ${path.relative(RAIZ, MANIFESTO)}`);
  process.exit(0);
}

if (!fs.existsSync(MANIFESTO)) {
  console.error(`falta ${path.relative(RAIZ, MANIFESTO)} -- gere com: node scripts/check_dados.mjs --gravar`);
  process.exit(1);
}

const esperado = JSON.parse(fs.readFileSync(MANIFESTO, 'utf8'));
const diferentes = ARQUIVOS.filter((a) => esperado[a] !== atual[a]);

if (diferentes.length) {
  console.error('arquivos gerados diferentes do que o gerador produziu:');
  for (const a of diferentes) console.error(`  ${a}`);
  console.error(
    '\nEles não se editam à mão: texto de interface novo vai em web/js/textos.js.\n' +
      'Se a mudança é de propósito (regerou a partir do Dart), `npm run gen` regrava o manifesto.'
  );
  process.exit(1);
}

console.log(`OK - ${ARQUIVOS.length} arquivos gerados batem com o manifesto`);
