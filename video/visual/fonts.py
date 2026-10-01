"""Download exact-glyph font subsets from Google Fonts for every character the
video draws (narration + strings in the scene code) into $BUILD/fonts/."""
import glob
import hashlib
import json
import os
import re
import urllib.parse
import urllib.request

BUILD = os.environ['BUILD']
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BUILD, 'fonts')
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
FAMILIES = ['Noto+Serif+SC:wght@400;600;900', 'Noto+Sans+SC:wght@400;700;900', 'Ma+Shan+Zheng',
            'Cormorant+Garamond:ital,wght@0,500;1,500', 'JetBrains+Mono:wght@400;700', 'Caveat:wght@500']


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main():
    os.makedirs(OUT, exist_ok=True)
    tl = json.load(open(os.path.join(BUILD, 'timeline.json'), encoding='utf-8'))
    text = ''.join(l['text'] + l['say'] for l in tl['lines'])
    for f in glob.glob(os.path.join(HERE, '*.js')):
        for s in re.findall(r"'([^'\n]*)'", open(f, encoding='utf-8').read()):
            text += s
    chars = sorted(set(c for c in text if ord(c) > 0x2000))
    ascii_ = ''.join(chr(c) for c in range(32, 127))
    cjk = ''.join(chars)
    print(len(chars), 'non-ASCII glyphs')
    css_all = []
    for fam in FAMILIES:
        cjk_font = 'SC' in fam or 'Shan' in fam
        pool = cjk + ascii_ if cjk_font else ascii_ + '·—°∞¥▍●♡⚠✓×→←'
        for k in range(0, len(pool), 350):
            q = urllib.parse.quote(pool[k:k + 350], safe='')
            css = get(f'https://fonts.googleapis.com/css2?family={fam}&text={q}&display=block').decode()
            for url in set(re.findall(r'url\((https://[^)]+)\)', css)):
                name = hashlib.md5(url.encode()).hexdigest()[:16] + '.woff2'
                path = os.path.join(OUT, name)
                if not os.path.exists(path):
                    open(path, 'wb').write(get(url))
                css = css.replace(url, name)
            css_all.append(css)
    open(os.path.join(OUT, 'fonts.css'), 'w', encoding='utf-8').write('\n'.join(css_all))
    open(os.path.join(OUT, 'chars.js'), 'w', encoding='utf-8').write('const SCENE_TEXT = ' + json.dumps(cjk, ensure_ascii=False) + ';\n')
    print('fonts:', len(os.listdir(OUT)) - 2, 'files')


if __name__ == '__main__':
    main()
