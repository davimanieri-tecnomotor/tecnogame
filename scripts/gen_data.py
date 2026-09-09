"""Generate web/js/data.js (questions) and web/js/i18n_map.js (translations)
straight from the Dart sources, so nothing is transcribed by hand."""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src_game', 'tec_game')
OUT = os.path.join(ROOT, 'web', 'js')
os.makedirs(OUT, exist_ok=True)

# src_game/ is the extracted tec_game.zip and is not committed (it is derived,
# and ~50 MB); unpack it on demand so a fresh clone can regenerate the data.
if not os.path.isdir(SRC):
    import zipfile

    archive = os.path.join(ROOT, 'tec_game.zip')
    if not os.path.isfile(archive):
        raise SystemExit('tec_game.zip not found in the repo root - nothing to generate from.')
    print('extracting tec_game.zip ...')
    with zipfile.ZipFile(archive) as zf:
        zf.extractall(os.path.join(ROOT, 'src_game'))

BS, Q1, Q2 = chr(92), chr(39), chr(34)
SIMPLE = {Q1: Q1, Q2: Q2, BS: BS, 'n': chr(10), 't': chr(9), 'r': chr(13), '$': '$'}


def dart_strings(block):
    """Yield the unescaped contents of every single-quoted Dart literal."""
    out, k, n = [], 0, len(block)
    while k < n:
        if block[k] == Q1:
            k += 1
            buf = []
            while k < n and block[k] != Q1:
                if block[k] == BS:
                    buf.append(SIMPLE.get(block[k + 1], block[k + 1]))
                    k += 2
                    continue
                buf.append(block[k])
                k += 1
            k += 1
            out.append(''.join(buf))
        else:
            k += 1
    return out


# ---------------- questions ----------------
app_state = open(os.path.join(SRC, 'lib', 'app_state.dart'), encoding='utf-8').read()


def bracket_block(src, marker):
    start = src.index(marker)
    i = src.index('[', start)
    depth = 0
    for j in range(i, len(src)):
        if src[j] == '[':
            depth += 1
        elif src[j] == ']':
            depth -= 1
            if depth == 0:
                return src[i:j + 1]
    raise ValueError(marker)


questions = {}
for dart_name, js_name in [('questoesBrasil', 'pt'),
                           ('questoesEnglish', 'en'),
                           ('questoesSpanish', 'es')]:
    block = bracket_block(app_state, 'List<QuestaoStruct> _%s = [' % dart_name)
    questions[js_name] = [json.loads(s) for s in dart_strings(block)]
    assert len(questions[js_name]) == 10, (dart_name, len(questions[js_name]))

# QuestaoStruct getters use camelCase keys that differ from the JSON keys;
# normalise to the getter names used by the widgets.
RENAME = {'Raster3S': 'raster3S', 'Rasher4': 'rasher4', 'Xtool': 'xtool'}
BOOLS = {'raster3S', 'rasher4', 'xtool'}
for lang, items in questions.items():
    for q in items:
        for old, new in RENAME.items():
            if old in q:
                q[new] = q.pop(old)
        for b in BOOLS:
            q[b] = str(q.get(b, '')).lower() == 'true'

# ---------------- translations ----------------
i18n = open(os.path.join(SRC, 'lib', 'flutter_flow', 'internationalization.dart'),
            encoding='utf-8').read()
tmap_src = i18n[i18n.index('final kTranslationsMap ='):]

# Each entry looks like:  'key': { 'pt': '...', 'en': '...', 'es': '...', },
entry_re = re.compile(
    r"'([0-9a-z]{8})'\s*:\s*\{(.*?)\}", re.S)
lang_re = re.compile(r"'(pt|en|es)'\s*:\s*((?:'(?:\\.|[^'\\])*'\s*)+)", re.S)

translations = {}
for key, body in entry_re.findall(tmap_src):
    entry = {}
    for lang, raw in lang_re.findall(body):
        # adjacent string literals are concatenated by Dart
        entry[lang] = ''.join(dart_strings(raw))
    translations[key] = entry

assert 'kn0wcjje' in translations and translations['kn0wcjje']['pt'] == 'CONFIRMAR'
assert len(translations) > 60, len(translations)

# ---------------- offensive words ----------------
funcs = open(os.path.join(SRC, 'lib', 'flutter_flow', 'custom_functions.dart'),
             encoding='utf-8').read()
start = funcs.index('final Set<String> palavrasOfensivas = {')
end = funcs.index('};', start)
words = sorted(set(dart_strings(funcs[start:end])))

HEADER = ('// Generated from the FlutterFlow Dart sources by scripts/gen_data.py.\n'
          '// Do not edit by hand.\n')


def dump(name, varname, value):
    path = os.path.join(OUT, name)
    # newline fixo em LF: o arquivo gerado e commitado, e sem isso o Python
    # no Windows grava CRLF -- o mesmo commit passa a ter bytes diferentes
    # dependendo de quem rodou o gerador, e a CI acusa dessincronia.
    with open(path, 'w', encoding='utf-8', newline=chr(10)) as f:
        f.write(HEADER)
        f.write('export const %s = ' % varname)
        f.write(json.dumps(value, ensure_ascii=False, indent=2))
        f.write(';\n')
    print('wrote', path, os.path.getsize(path))


dump('questions.js', 'QUESTIONS', questions)
dump('translations.js', 'TRANSLATIONS', translations)
dump('offensive_words.js', 'OFFENSIVE_WORDS', words)
print('translations:', len(translations), 'offensive words:', len(words))
