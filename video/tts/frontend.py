"""Chinese text -> Kokoro v1.1-zh token ids, with explicit, auditable pronunciation.

Kokoro v1.1-zh was trained on phonemes from misaki's ZHFrontend (jieba POS
segmentation + pypinyin + PaddleSpeech tone sandhi, words joined by "/").
sherpa-onnx's built-in front-end instead does context-free lexicon lookup, so
polyphones fall back to one default reading (调笛子 -> diao4). Here we run the
real misaki front-end (vendored in misaki_zh/) and layer a hand-checked
override table for this script on top. Every syllable is printed for review.
"""
import os
import re
import sys

_JIEBA_SRC = os.environ.get('JIEBA_SRC', '')
if _JIEBA_SRC:
    sys.path.insert(0, _JIEBA_SRC)
import jieba  # noqa: E402
from pypinyin import load_phrases_dict, load_single_dict  # noqa: E402

jieba.setLogLevel(60)
from misaki_zh.zh_frontend import ZHFrontend, ZH_MAP  # noqa: E402
from pypinyin.contrib.tone_convert import to_initials, to_finals_tone3, to_tone3  # noqa: E402

MODEL_DIR = os.environ.get('KOKORO_DIR', '')

# Hand-checked readings for words in this script (citation tones; 一/不/third
# tone sandhi is applied afterwards by ToneSandhi, as in training).
PHRASES = {
    '调笛子': 'tiáo dí zi', '调试': 'tiáo shì', '精调': 'jīng tiáo', '调音': 'tiáo yīn',
    '阴干': 'yīn gān', '风干': 'fēng gān', '相干': 'xiāng gān', '噱头': 'xué tóu',
    '民乐': 'mín yuè', '音乐': 'yīn yuè', '白发': 'bái fà', '一摞': 'yī luò',
    '模板': 'mú bǎn', '笔触': 'bǐ chù', '数年': 'shù nián', '数十年': 'shù shí nián',
    '身处': 'shēn chǔ', '尽是': 'jìn shì', '埋头': 'mái tóu', '熬夜': 'áo yè',
    '一锤一磨': 'yī chuí yī mó', '打磨': 'dǎ mó', '推敲': 'tuī qiāo', '落败': 'luò bài',
    '量产': 'liàng chǎn', '批量': 'pī liàng', '产能': 'chǎn néng', '朴素': 'pǔ sù',
    '沉淀': 'chén diàn', '积淀': 'jī diàn', '撑起': 'chēng qǐ', '看似': 'kàn sì',
    '行业': 'háng yè', '几分': 'jǐ fēn', '传承': 'chuán chéng', '传世': 'chuán shì',
    '代代相传': 'dài dài xiāng chuán', '教学': 'jiào xué', '为什么': 'wèi shén me',
    '肌理': 'jī lǐ', '割裂': 'gē liè', '经得起': 'jīng de qǐ', '音色': 'yīn sè',
    '格格不入': 'gé gé bù rù', '安身立命': 'ān shēn lì mìng', '一辈子': 'yī bèi zi',
    '一刀一刻': 'yī dāo yī kè', '一笔一画': 'yī bǐ yī huà', '一笔一笔': 'yī bǐ yī bǐ',
    '第一步': 'dì yī bù', '第一眼': 'dì yī yǎn', '独一无二': 'dú yī wú èr',
    '了解': 'liǎo jiě', '一个': 'yī gè', '笛子': 'dí zi', '竹笛': 'zhú dí',
    '内径': 'nèi jìng', '驻足': 'zhù zú', '虔诚': 'qián chéng', '笨拙': 'bèn zhuō',
    '沙哑': 'shā yǎ', '苍凉': 'cāng liáng', '氛围': 'fēn wéi', '奔赴': 'bēn fù',
    '劝退': 'quàn tuì', '死磕': 'sǐ kē', '速成': 'sù chéng', '一帧': 'yī zhēn',
    '一丝': 'yī sī', '处于': 'chǔ yú', '恰恰': 'qià qià', '喝了点酒': 'hē le diǎn jiǔ',
    '大家': 'dà jiā', '底气': 'dǐ qì', '底蕴': 'dǐ yùn', '根植': 'gēn zhí',
    '扎根': 'zhā gēn', '本源': 'běn yuán', '流水线': 'liú shuǐ xiàn',
    '虚标': 'xū biāo', '竹材': 'zhú cái', '老竹': 'lǎo zhú', '玩具笛': 'wán jù dí',
    '噱头笛': 'xué tóu dí', '手工笛': 'shǒu gōng dí', '慢打磨': 'màn dǎ mó',
    '一锤': 'yī chuí', '逐根': 'zhú gēn', '逐支': 'zhú zhī', '制笛': 'zhì dí',
    '一摞画册': 'yī luò huà cè', '开箱': 'kāi xiāng', '画册': 'huà cè',
    '外包': 'wài bāo', '美术': 'měi shù', '甲方': 'jiǎ fāng', '套图': 'tào tú',
    '赛道': 'sài dào', '更好': 'gèng hǎo', '还能': 'hái néng', '不讨巧': 'bù tǎo qiǎo',
}
# Absolute readings applied AFTER tone sandhi (keyed by the segmenter's word).
# Used where PaddleSpeech's rules over-apply: forced neutral tones, 一 in set
# phrases, and third-tone chains the word segmentation hides.
FINAL = {
    '独一无二': 'dú yī wú èr', '一辈子': 'yí bèi zi', '刺激': 'cì jī', '层层': 'céng céng',
    '提醒我': 'tí xíng wǒ', '肌理与': 'jī lí yǔ', '厚厚': 'hòu hòu',
}
# Characters whose reading is the same everywhere in this script.
SINGLE = {'着': 'zhe', '调': 'tiáo', '地': 'de,dì'}

_fe = None


def _frontend():
    global _fe
    if _fe is None:
        _fe = ZHFrontend()
        load_phrases_dict({w: [[s] for s in p.split()] for w, p in PHRASES.items()})
        load_single_dict({ord(k): v for k, v in SINGLE.items()})
        for w in PHRASES:
            jieba.add_word(w, freq=2000000)
    return _fe


def _load_tokens():
    tok = {}
    with open(os.path.join(MODEL_DIR, 'tokens.txt'), encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n')
            if not line:
                continue
            i = line.rfind(' ')
            tok[line[:i] if i > 0 else ' '] = int(line[i + 1:])
    return tok


TOKENS = _load_tokens() if MODEL_DIR else {}

# English acronyms, spelled the way a Mandarin speaker says the letters. English
# phonemes ('ˌAˈI') blurred at fast line ends in ASR checks; these did not.
ACRONYMS = {'AI': 'zh:èi ài', 'OA': 'zh:ōu ēi'}


def map_punctuation(text):
    for a, b in [('、', ', '), ('，', ', '), ('。', '. '), ('！', '! '), ('：', ': '),
                 ('；', '; '), ('？', '? '), ('“', ' “'), ('”', '” '), ('…', '…'), ('——', '—')]:
        text = text.replace(a, b)
    return text


def std_to_misaki(pinyin_text):
    """'yí bèi zi' -> (['i2','bei4','zii5'] review form, phoneme string)."""
    review, ph = [], ''
    for syl in pinyin_text.split():
        t3 = to_tone3(syl, neutral_tone_with_five=True)
        ini = to_initials(t3, strict=True)
        fin = to_finals_tone3(t3, strict=True, neutral_tone_with_five=True)
        if re.match(r'i\d', fin):
            fin = fin.replace('i', 'ii' if ini in ('z', 'c', 's') else 'iii' if ini in ('zh', 'ch', 'sh', 'r') else 'i', 1)
        review.append(ini + fin)
        ph += (ZH_MAP[ini] if ini else '') + ZH_MAP[fin[:-1]] + fin[-1]
    return review, ph


def _post_fix(toks):
    """Absolute overrides + 不 sandhi across a word boundary (从来不|是)."""
    for tk in toks:
        if tk.pinyin and tk.text in FINAL:
            tk.pinyin, tk.phonemes = std_to_misaki(FINAL[tk.text])
    words = [tk for tk in toks if tk.pinyin]
    for a, b in zip(words, words[1:]):
        if a.text.endswith('不') and a.pinyin[-1] == 'bu4' and b.pinyin[0][-1] == '4' \
                and toks.index(b) == toks.index(a) + 1:
            a.pinyin[-1] = 'bu2'
            a.phonemes = a.phonemes[:-1] + '2'
    return toks


def g2p(text):
    """Return (phoneme string, units, review).

    units: ordered (text, phonemes) pairs, one per character / punctuation /
    separator, so token durations can be mapped back to on-screen characters.
    review: (word, [pinyin]) pairs for human checking.
    """
    fe = _frontend()
    text = map_punctuation(text)
    units, review = [], []
    for en, zh in re.findall(r'([A-Za-z]+)|([^A-Za-z]+)', text):
        if units and units[-1][1] != ' ':
            units.append(('', ' '))
        if en:
            spec = ACRONYMS[en]
            if spec.startswith('zh:'):  # spelled with Mandarin syllables, e.g. AI -> ēi ài
                rv, ph = std_to_misaki(spec[3:])
            else:
                rv, ph = [spec], spec
            units.append((en, ph))
            review.append((en, rv))
            continue
        if not zh.strip():
            continue
        _, toks = fe(zh.strip())
        for tk in _post_fix(toks):
            if tk.phonemes is None:
                continue
            if tk.pinyin:  # a Chinese word: split phonemes per syllable
                sylls = re.findall(r'[^\d]*\d', tk.phonemes)
                assert len(sylls) == len(tk.text), (tk.text, tk.phonemes)
                units += list(zip(tk.text, sylls))
                review.append((tk.text, tk.pinyin))
            else:
                units.append((tk.text, tk.phonemes))
                review.append((tk.text, []))
            if tk.whitespace:
                units.append(('', tk.whitespace))
    while units and units[-1][1] == ' ':
        units.pop()
    phonemes = ''.join(p for _, p in units)
    return phonemes, units, review


def to_ids(phonemes):
    ids = [0]
    for c in phonemes:
        if c not in TOKENS:
            raise KeyError(f'unknown phoneme {c!r} in {phonemes!r}')
        ids.append(TOKENS[c])
    return ids + [0]


def describe(review):
    return ' '.join(w + '[' + ' '.join(p) + ']' if p else w for w, p in review)
