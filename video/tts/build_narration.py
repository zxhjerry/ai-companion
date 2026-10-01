"""Synthesise every script line, place it on the timeline and verify it.

Outputs (in $BUILD):
  narration.wav   48 kHz mono voice track
  timeline.json   per-line and per-character timings + scene/music cues
  pinyin.txt      every word with the pinyin actually spoken (for review)
"""
import json
import os
import re
import sys

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import script  # noqa: E402
import frontend  # noqa: E402
import synth  # noqa: E402

BUILD = os.environ['BUILD']
LEAD_IN = 3.2        # seconds of picture before the first word
SR_OUT = 48000
HOP = 600 / 24000    # one Kokoro duration unit, seconds
PRE = 0.12           # pre-roll kept before the predicted onset (protects initials)


def char_timings(units, dur, offset):
    """Map token durations onto display characters. w=1 marks a word start
    (used to break caption rows between words, never inside one)."""
    t = dur[0] * HOP  # leading pad token
    k = 1
    out = []
    boundary = True
    for text, ph in units:
        n = len(ph)
        d = float(dur[k:k + n].sum()) * HOP
        if text:
            out.append(dict(c=text, t0=round(offset + t, 3), t1=round(offset + t + d, 3), w=int(boundary)))
            boundary = not text.strip() or not ph[-1].isdigit()  # punctuation ends a word
        else:
            boundary = True  # '/' or ' ' separator
        t += d
        k += n
    return out


def annotate_word_starts(path):
    """Add word-start flags to an existing timeline without re-synthesising."""
    tl = json.load(open(path, encoding='utf-8'))
    for ln in tl['lines']:
        _, units, _ = frontend.g2p(ln['say'])
        flags, boundary = [], True
        for text, ph in units:
            if text:
                flags.append(int(boundary))
                boundary = not ph[-1].isdigit()
            else:
                boundary = True
        assert len(flags) == len(ln['chars']), ln['text']
        for c, f in zip(ln['chars'], flags):
            c['w'] = f
    tmp = path + '.tmp'
    json.dump(tl, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def main():
    os.makedirs(BUILD, exist_ok=True)
    voice = []
    lines = []
    review_lines = []
    t = LEAD_IN
    for i, ln in enumerate(script.LINES):
        say = ln.get('say', ln['text'])
        audio, dur, units, review = synth.synth(say, script.VOICE_SID, ln['speed'] * script.SPEED_SCALE)
        dur = dur.astype(np.float64)
        on = dur[0] * HOP
        off = float(dur[:-1].sum()) * HOP
        a0 = max(0, int((on - PRE) * 24000))
        a1 = min(len(audio), int((off + 0.12) * 24000))
        seg = audio[a0:a1].copy()
        f = int(0.01 * 24000)
        seg[:f] *= np.linspace(0, 1, f)
        f = int(0.04 * 24000)
        seg[-f:] *= np.linspace(1, 0, f)
        start = t - PRE
        chars = char_timings(units, dur, t - on)
        speech_end = t + (off - on)
        voice.append((start, seg))
        lines.append(dict(i=i, scene=ln['scene'], text=ln['text'], say=say, music=ln.get('music'),
                          start=round(t, 3), end=round(speech_end, 3), chars=chars))
        review_lines.append(f'{i:03d} [{t:7.2f}s] ' + frontend.describe(review))
        t = speech_end + ln['pause']
        print(f'{i:3d} {t:7.2f}s {ln["text"]}', flush=True)
    total = t
    n = int(total * 24000) + 24000
    track = np.zeros(n, dtype=np.float32)
    for start, seg in voice:
        s = int(round(start * 24000))
        track[s:s + len(seg)] += seg
    track = resample_poly(track, 2, 1).astype(np.float32)
    sf.write(os.path.join(BUILD, 'narration.wav'), track, SR_OUT, subtype='FLOAT')
    with open(os.path.join(BUILD, 'timeline.json'), 'w', encoding='utf-8') as f:
        json.dump(dict(duration=round(total, 3), lead_in=LEAD_IN, lines=lines), f, ensure_ascii=False, indent=1)
    with open(os.path.join(BUILD, 'pinyin.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(review_lines) + '\n')
    print('total', round(total, 2), 's')


if __name__ == '__main__':
    if sys.argv[1:] == ['--word-flags']:
        annotate_word_starts(os.path.join(BUILD, 'timeline.json'))
    else:
        main()
