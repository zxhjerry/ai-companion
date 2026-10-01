"""ASR check: transcribe each placed line from narration.wav and diff vs script."""
import difflib
import json
import os
import re
import sys

import numpy as np
import soundfile as sf
import sherpa_onnx

BUILD = os.environ['BUILD']
ASR = os.environ['ASR_DIR']
rec = sherpa_onnx.OfflineRecognizer.from_sense_voice(model=ASR + '/model.int8.onnx', tokens=ASR + '/tokens.txt',
                                                     use_itn=True, num_threads=4, language='zh')
audio, sr = sf.read(os.path.join(BUILD, 'narration.wav'), dtype='float32')
tl = json.load(open(os.path.join(BUILD, 'timeline.json'), encoding='utf-8'))
hz = lambda s: re.sub(r'[^一-鿿A-Za-z]', '', s).upper()
tot = err = 0
for ln in tl['lines']:
    a = audio[int((ln['start'] - 0.1) * sr):int((ln['end'] + 0.15) * sr)]
    st = rec.create_stream()
    st.accept_waveform(sr, a)
    rec.decode_stream(st)
    ref, hyp = hz(ln['text']), hz(st.result.text)
    sm = difflib.SequenceMatcher(None, ref, hyp)
    diffs = [(ref[i1:i2], hyp[j1:j2]) for op, i1, i2, j1, j2 in sm.get_opcodes() if op != 'equal']
    e = sum(max(len(x), len(y)) for x, y in diffs)
    tot += len(ref)
    err += e
    if diffs:
        print(f"{ln['i']:3d} {diffs}  | {ln['text']}")
print(f'CER {err / tot:.4f} over {tot} chars')
