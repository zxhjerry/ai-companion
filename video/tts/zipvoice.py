"""ZipVoice (zero-shot, flow matching) driven directly through onnxruntime.

Why: Kokoro reads like a newsreader; ZipVoice was trained on ~100k hours of
real conversational speech (Emilia) and continues the delivery of a short
reference clip, so the narration gets human rhythm and breath.

Pronunciation stays auditable: text is tokenised exactly like ZipVoice's own
training tokenizer (jieba -> pypinyin TONE3 with tone_sandhi -> initial+"0" /
final tokens), but with this script's hand-checked readings
(frontend.PHRASES / frontend.FINAL) applied before tokens are built.
"""
import os
import re
import sys

import numpy as np
import onnxruntime as ort
import librosa
from pypinyin import lazy_pinyin, Style, load_phrases_dict
from pypinyin.contrib.tone_convert import to_initials, to_finals_tone3, to_tone3

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import frontend  # noqa: E402  (PHRASES / FINAL / jieba setup)
import jieba  # noqa: E402

ZV_DIR = os.environ.get('ZIPVOICE_DIR', '')
SR, N_FFT, HOP, N_MELS = 24000, 1024, 256, 100
FEAT_SCALE, TARGET_RMS = 0.1, 0.1
PUNCT_MAP = {'，': ',', '。': '.', '！': '!', '？': '?', '；': ';', '：': ':', '、': ',', '“': '"', '”': '"',
             '‘': "'", '’': "'", '…': '…', '——': '-'}
ACRONYMS = {'AI': 'èi ài', 'OA': 'ōu ēi'}

_init = False


def _setup():
    global _init
    if _init:
        return
    load_phrases_dict({w: [[s] for s in p.split()] for w, p in frontend.PHRASES.items()})
    for w in list(frontend.PHRASES) + list(frontend.FINAL):
        jieba.add_word(w, freq=2000000)
    _init = True


def _split_syllable(t3):
    ini = to_initials(t3, strict=False)
    fin = to_finals_tone3(t3, strict=False, neutral_tone_with_five=True)
    return ([ini + '0'] if ini else []) + ([fin] if fin else [])


def tokenize(text):
    """-> (tokens, units). units: [(char, [syllable_tone3])] for review/timing."""
    _setup()
    for a, b in PUNCT_MAP.items():
        text = text.replace(a, b)
    units, fixed_idx = [], set()
    for en, zh in re.findall(r'([A-Za-z]+)|([^A-Za-z]+)', text):
        if en:
            units.append((en, [to_tone3(s, neutral_tone_with_five=True) for s in ACRONYMS[en].split()]))
            continue
        segs = list(jieba.cut(zh))
        for seg in segs:
            if all(not ('一' <= c <= '龥') for c in seg):
                for c in seg:
                    if c.strip():
                        units.append((c, []))
                continue
            if seg in frontend.FINAL:
                py = [to_tone3(s, neutral_tone_with_five=True) for s in frontend.FINAL[seg].split()]
            else:
                py = lazy_pinyin([seg], style=Style.TONE3, tone_sandhi=True, neutral_tone_with_five=True)
            assert len(py) == len(seg), (seg, py)
            fixed = seg in frontend.FINAL
            for c, s in zip(seg, py):
                if c == '着':
                    s = 'zhe5'
                units.append((c, [s]))
                if fixed:
                    fixed_idx.add(len(units) - 1)
    _bu_yi_sandhi(units, fixed_idx)
    tokens = []
    for c, syl in units:
        if syl:
            for s in syl:
                tokens += _split_syllable(s)
        else:
            tokens.append(c)
    return tokens, units


_YI_KEEP = set('第唯统独万一二三四五六七八九十百千')


def _bu_yi_sandhi(units, fixed_idx):
    """不 / 一 sandhi across jieba word boundaries (pypinyin only does it
    inside a word): 从来不|是 -> bú shì, 一|刀 -> yì dāo. FINAL words are kept."""
    flat = [(k, c, s[0]) for k, (c, s) in enumerate(units) if s and len(c) == 1]
    fixed = fixed_idx
    for n, (k, c, s) in enumerate(flat):
        nxt = flat[n + 1] if n + 1 < len(flat) and flat[n + 1][0] == k + 1 else None
        if not nxt or k in fixed:
            continue
        if c == '不' and s == 'bu4' and nxt[2][-1] == '4':
            units[k] = (c, ['bu2'])
        if c == '一' and s == 'yi1':
            prv = units[k - 1][0] if k > 0 else ''
            if prv in _YI_KEEP or nxt[1] in _YI_KEEP:
                continue
            units[k] = (c, ['yi2' if nxt[2][-1] == '4' or nxt[1] == '个' else 'yi4'])


class ZipVoice:
    def __init__(self, model_dir=None, distill=True, threads=4):
        d = model_dir or ZV_DIR
        so = ort.SessionOptions()
        so.intra_op_num_threads = threads
        prov = ['CPUExecutionProvider']
        self.enc = ort.InferenceSession(os.path.join(d, 'text_encoder.onnx'), so, providers=prov)
        self.dec = ort.InferenceSession(os.path.join(d, 'fm_decoder.onnx'), so, providers=prov)
        self.voc = ort.InferenceSession(os.path.join(d, 'vocos_24khz.onnx'), so, providers=prov)
        self.tok = {}
        for line in open(os.path.join(d, 'tokens.txt'), encoding='utf-8'):
            p = line.rstrip('\n').split('\t')
            if len(p) == 2:
                self.tok[p[0]] = int(p[1])
        self.distill = distill
        self.mel_fb = librosa.filters.mel(sr=SR, n_fft=N_FFT, n_mels=N_MELS, fmin=0, fmax=SR / 2, htk=True, norm=None)

    def ids(self, tokens):
        missing = [t for t in tokens if t not in self.tok]
        if missing:
            raise KeyError(f'tokens not in vocabulary: {missing}')
        return [self.tok[t] for t in tokens]

    def features(self, audio):
        rms = np.sqrt(np.mean(audio ** 2))
        if 0 < rms < TARGET_RMS:
            audio = audio * (TARGET_RMS / rms)
        spec = np.abs(librosa.stft(audio, n_fft=N_FFT, hop_length=HOP, win_length=N_FFT, window='hann', center=True, pad_mode='reflect'))
        mel = self.mel_fb @ spec
        return (np.log(mel + 1e-10) * FEAT_SCALE).T.astype(np.float32)  # (T, 100)

    def set_prompt(self, audio, sr, text):
        if sr != SR:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=SR)
        self.prompt_feat = self.features(audio.astype(np.float32))
        toks, _ = tokenize(text)
        self.prompt_ids = self.ids(toks)

    def synth(self, text, speed=1.0, steps=None, guidance=None, t_shift=0.5, seed=0):
        steps = steps or (8 if self.distill else 16)
        guidance = guidance if guidance is not None else (3.0 if self.distill else 1.0)
        toks, units = tokenize(text)
        ids = self.ids(toks)
        P = self.prompt_feat.shape[0]
        cond = self.enc.run(None, {'tokens': np.array([ids], np.int64), 'prompt_tokens': np.array([self.prompt_ids], np.int64),
                                   'prompt_features_len': np.array(P, np.int64), 'speed': np.array(speed, np.float32)})[0]
        T = cond.shape[1]
        rng = np.random.default_rng(seed)
        x = rng.standard_normal((1, T, N_MELS)).astype(np.float32)
        sc = np.zeros((1, T, N_MELS), np.float32)
        sc[0, :P] = self.prompt_feat
        u = np.linspace(0, 1, steps + 1)
        ts = t_shift * u / (1 + (t_shift - 1) * u)
        g = np.array(guidance, np.float32)
        for k in range(steps):
            v = self.dec.run(None, {'t': np.array(ts[k], np.float32), 'x': x, 'text_condition': cond, 'speech_condition': sc, 'guidance_scale': g})[0]
            x = (x + v * np.float32(ts[k + 1] - ts[k])).astype(np.float32)
        mel = (x[0, P:] / FEAT_SCALE).T[None].astype(np.float32)  # (1, 100, T)
        mag, cx, sy = self.voc.run(None, {'mels': mel})
        S = mag[0] * (cx[0] + 1j * sy[0])
        audio = librosa.istft(S, hop_length=HOP, win_length=N_FFT, n_fft=N_FFT, window='hann', center=True)
        return audio.astype(np.float32), toks, units
