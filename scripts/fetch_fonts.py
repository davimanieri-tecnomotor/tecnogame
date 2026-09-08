"""Baixa as fontes do Google e gera web/css/fonts.css para auto-hospedagem.

Por que: as cinco famílias que o jogo usa (Inter, Inter Tight, Roboto,
Roboto Mono, Open Sans) vinham do CDN do Google. Num totem sem internet — e o
totem fica em estande de feira — nenhuma carregava e o jogo caía para a fonte
padrão do sistema. O app Flutter tinha o mesmo defeito, porque o pacote
`google_fonts` também baixa em tempo de execução.

Só os subsets `latin` e `latin-ext` são baixados: cobrem pt/en/es, os três
idiomas do jogo, sem trazer cirílico, grego, hebraico e vietnamita.

    python scripts/fetch_fonts.py

Reexecutar é idempotente: mesma requisição, mesmos arquivos.
"""
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'web', 'assets', 'fonts', 'google')
OUT_CSS = os.path.join(ROOT, 'web', 'css', 'fonts.css')

# Exatamente as famílias e os pesos que web/index.html pedia ao CDN.
QUERY = (
    'https://fonts.googleapis.com/css2'
    '?family=Inter:wght@100..900'
    '&family=Inter+Tight:wght@100..900'
    '&family=Open+Sans:wght@300..800'
    '&family=Roboto:wght@100..900'
    '&family=Roboto+Mono:wght@100..700'
    '&display=block'
)

# Sem um UA de navegador moderno o Google devolve ttf em vez de woff2.
UA = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
)

SUBSETS = ('latin', 'latin-ext')


def fetch(url, binary=False):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    return data if binary else data.decode('utf-8')


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    css = fetch(QUERY)

    # Cada @font-face vem precedido de um comentário com o nome do subset.
    blocks = re.findall(r'/\*\s*([a-z0-9-]+)\s*\*/\s*@font-face\s*\{(.*?)\}', css, re.S)
    if not blocks:
        sys.exit('nao consegui interpretar o CSS do Google Fonts')

    out = [
        '/* GERADO por scripts/fetch_fonts.py — nao edite a mao.',
        ' *',
        ' * As cinco familias que o jogo usa, auto-hospedadas, para o totem',
        ' * funcionar sem internet. Subsets latin + latin-ext (pt/en/es).',
        ' * font-display: block casa com as fontes locais (pirulen, Paralucent):',
        ' * o texto espera a fonte certa em vez de piscar na fonte do sistema.',
        ' */',
        '',
    ]
    escritos = 0
    total = 0

    for subset, body in blocks:
        if subset not in SUBSETS:
            continue
        fam = re.search(r"font-family:\s*'([^']+)'", body).group(1)
        url = re.search(r'url\((https://[^)]+)\)', body).group(1)
        weight = re.search(r'font-weight:\s*([^;]+);', body)
        style = re.search(r'font-style:\s*([^;]+);', body)
        urange = re.search(r'unicode-range:\s*([^;]+);', body)

        slug = fam.lower().replace(' ', '-')
        name = f'{slug}-{subset}.woff2'
        path = os.path.join(OUT_DIR, name)
        blob = fetch(url, binary=True)
        with open(path, 'wb') as f:
            f.write(blob)
        escritos += 1
        total += len(blob)

        out.append('@font-face {')
        out.append(f"  font-family: '{fam}';")
        out.append(f"  font-style: {style.group(1).strip() if style else 'normal'};")
        out.append(f"  font-weight: {weight.group(1).strip() if weight else '400'};")
        out.append('  font-display: block;')
        out.append(f"  src: url('../assets/fonts/google/{name}') format('woff2');")
        if urange:
            out.append(f'  unicode-range: {urange.group(1).strip()};')
        out.append('}')
        out.append('')

    with open(OUT_CSS, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(out))

    print(f'{escritos} arquivos, {total / 1024:.0f} KB -> {os.path.relpath(OUT_DIR, ROOT)}')
    print(f'gerado {os.path.relpath(OUT_CSS, ROOT)}')


if __name__ == '__main__':
    main()
