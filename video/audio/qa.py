"""Objective QA for the audio build (we cannot listen, so we measure).

Prints: integrated LUFS + true peak of the final mix, per-section loudness of
the (ducked) music bus vs the voice bus, silence-window checks on music.wav,
peak per stem, hit-accent checks; writes spectrogram PNGs to $BUILD/qa/.

Run:  BUILD=... python3 qa.py [--music-only]
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import SR, BUILD, load_cues, read, a2db, true_peak_db, to_stereo, hpf

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402

QA = os.path.join(BUILD, 'qa')
ASCII = {'最难': 'zuinan', '被看见': 'beikanjian', '耗时间': 'haoshijian', '耐寂寞': 'naijimo', '慢打磨': 'mandamo',
         '不讨巧': 'butaoqiao', '浪潮': 'langchao', '命题': 'mingti', '生命力': 'shengmingli', '相通': 'xiangtong'}


def lufs(x):
    import pyloudnorm as pyln
    m = pyln.Meter(SR)
    x = to_stereo(x)
    if len(x) < SR * 0.5:
        return -np.inf
    with np.errstate(divide='ignore'):
        return m.integrated_loudness(x)


def seg(x, a, b):
    return x[max(0, int(a * SR)):max(0, int(b * SR))]


def win_rms_db(x, win=0.05):
    m = np.abs(to_stereo(x)).max(axis=1) if x.ndim == 2 else np.abs(x)
    L = int(win * SR)
    k = len(m) // L
    if k == 0:
        return np.array([-200.0])
    r = np.sqrt(np.mean(m[:k * L].reshape(k, L) ** 2, axis=1))
    return a2db(r)


def spectrogram_png(x, path, title, cues, t0=0.0, t1=None, rows=6, fmax=8000):
    x = to_stereo(x).mean(axis=1)
    t1 = t1 or len(x) / SR
    span = (t1 - t0) / rows
    fig, axes = plt.subplots(rows, 1, figsize=(22, 3.0 * rows))
    axes = np.atleast_1d(axes)
    nfft = 2048
    hop = 512
    for r, ax in enumerate(axes):
        a, b = t0 + r * span, t0 + (r + 1) * span
        y = seg(x, a, b)
        if len(y) < nfft:
            continue
        from scipy import signal
        f, tt, Z = signal.stft(y, SR, nperseg=nfft, noverlap=nfft - hop)
        S = 20 * np.log10(np.abs(Z) + 1e-9)
        k = f <= fmax
        ax.imshow(S[k], origin='lower', aspect='auto', extent=[a, b, 0, fmax], vmin=-110, vmax=-20, cmap='magma')
        for s in cues['sections']:
            if a <= s['t0'] <= b:
                ax.axvline(s['t0'], color='cyan', lw=1.2)
                ax.text(s['t0'] + 0.2, fmax * 0.92, s['key'], color='cyan', fontsize=9)
            for hi_, (hk, ht) in enumerate(s['hits'].items()):
                if a <= ht <= b:
                    ax.axvline(ht, color='lime', lw=0.7, ls='--')
                    lab = hk if hk.isascii() else ASCII.get(hk, f'hit{hi_}')
                    ax.text(ht + 0.1, fmax * 0.80, lab, color='lime', fontsize=7)
        for sa, sb in cues['speech']:
            if sb > a and sa < b:
                ax.plot([max(a, sa), min(b, sb)], [fmax * 0.02] * 2, color='white', lw=3)
        ax.set_xlim(a, b)
        ax.set_ylabel('Hz')
    axes[0].set_title(title)
    axes[-1].set_xlabel('seconds')
    plt.tight_layout()
    plt.savefig(path, dpi=70)
    plt.close(fig)


def envelope_png(tracks, path, cues, title):
    fig, ax = plt.subplots(1, 1, figsize=(22, 5))
    for name, x, col in tracks:
        e = win_rms_db(x, 0.1)
        ax.plot(np.arange(len(e)) * 0.1, e, lw=0.8, label=name, color=col)
    for s in cues['sections']:
        ax.axvline(s['t0'], color='k', lw=0.6)
        ax.text(s['t0'] + 0.5, -8, s['key'], fontsize=7, rotation=90)
    ax.set_ylim(-90, 0)
    ax.legend(loc='lower right')
    ax.set_title(title)
    ax.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(path, dpi=70)
    plt.close(fig)


def accent(x, t):
    """(jump_dB, onset_ms): level jump at a hit, comparing 70 ms after vs
    the 90 ms before it, and the steepest 2.5 ms rise within +/-40 ms."""
    y = np.abs(to_stereo(seg(x, t - 0.1, t + 0.07)).mean(axis=1))
    i = int(0.1 * SR)
    pre = np.sqrt(np.mean(y[:i - int(0.01 * SR)] ** 2) + 1e-12)
    post = np.sqrt(np.mean(y[i:] ** 2) + 1e-12)
    z = np.abs(to_stereo(seg(x, t - 0.04, t + 0.04)).mean(axis=1))
    L = int(0.0025 * SR)
    k = len(z) // L
    e = 20 * np.log10(np.sqrt(np.mean(z[:k * L].reshape(k, L) ** 2, axis=1)) + 1e-9)
    j = int(np.argmax(np.diff(e)))
    return 20 * np.log10(post / pre), ((j + 1) * L / SR - 0.04) * 1000


def main():
    music_only = '--music-only' in sys.argv
    os.makedirs(QA, exist_ok=True)
    cues = load_cues()
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from score import silence_windows
    music = read(os.path.join(BUILD, 'music.wav'))
    print('=' * 72)
    print('MUSIC  peak %.2f dBFS  true-peak %.2f dBTP  integrated %.1f LUFS' % (
        a2db(np.max(np.abs(music))), true_peak_db(music), lufs(music)))
    print('-- stems (peak dBFS / integrated LUFS)')
    sd = os.path.join(BUILD, 'stems')
    for f in sorted(os.listdir(sd)):
        if f.endswith('.wav'):
            x = read(os.path.join(sd, f))
            print(f'   {f:14s} peak {a2db(np.max(np.abs(x))):7.2f}   {lufs(x):7.1f} LUFS')
    print('-- required silence windows in music.wav (must be < -50 dBFS)')
    ok_all = True
    for a, b, label in silence_windows(cues):
        y = seg(music, a, b)
        pk = a2db(np.max(np.abs(y))) if len(y) else -200
        ok = pk < -50
        ok_all &= ok
        print(f'   {a:8.3f}-{b:8.3f}  peak {pk:7.1f} dBFS  {"OK " if ok else "FAIL"}  {label}')
    # near-silence (open: 太安静了)
    s0 = cues['sections'][0]['hits']
    y = seg(music, s0['quiet_start'] + 0.3, s0['quiet_end'] - 0.2)
    print(f'   near-silence 太安静了 {s0["quiet_start"]:.2f}-{s0["quiet_end"]:.2f}: rms '
          f'{a2db(np.sqrt(np.mean(y ** 2))):.1f} dBFS, peak {a2db(np.max(np.abs(y))):.1f} dBFS (target: quiet)')
    print('   ALL SILENCES OK' if ok_all else '   SILENCE CHECK FAILED')
    print('-- hit accents in music.wav: level jump at the hit (dB) and steepest-rise offset (ms)')
    nacc = 0
    tot = 0
    for s in cues['sections']:
        for hk, ht in s['hits'].items():
            if hk in ('silence', 'fade_out_end', 'cut', 'stop', 'quiet_end', 'riser_end'):
                continue
            jd, off = accent(music, ht)
            tot += 1
            nacc += jd >= 3
            print(f'   {s["key"]:8s} {hk:12s} {ht:8.3f}  jump {jd:+6.1f} dB  onset {off:+5.1f} ms'
                  f'{"" if jd >= 3 else "   (soft entry / swell)"}')
    print(f'   {nacc}/{tot} hits show a >= 3 dB attack exactly at the hit')
    spectrogram_png(music, os.path.join(QA, 'music_spectrogram.png'), 'music.wav', cues)
    if music_only:
        envelope_png([('music', music, 'tab:blue')], os.path.join(QA, 'music_envelope.png'), cues, 'music RMS (100 ms)')
        return
    final = read(os.path.join(BUILD, 'final_audio.wav'))
    import soundfile as sf
    info = sf.info(os.path.join(BUILD, 'final_audio.wav'))
    print('=' * 72)
    print(f'FINAL  {info.samplerate} Hz  {info.channels} ch  {info.subtype}  {info.duration:.3f} s')
    print('FINAL  integrated %.2f LUFS   true peak %.2f dBTP   sample peak %.2f dBFS' % (
        lufs(final), true_peak_db(final), a2db(np.max(np.abs(final)))))
    bd = os.path.join(BUILD, 'mix_buses')
    voice = read(os.path.join(bd, 'voice.wav'))
    mbus = read(os.path.join(bd, 'music.wav'))
    sbus = read(os.path.join(bd, 'sfx.wav'))
    print('-- per section loudness in the final balance (LUFS; speech-only parts for voice/music-under-voice)')
    print(f'   {"section":8s} {"voice":>7s} {"music":>7s} {"m-under-v":>9s} {"v-m":>6s} {"m-gaps":>7s} {"sfx":>7s}')
    import pyloudnorm as pyln
    meter = pyln.Meter(SR, block_size=0.4)
    for s in cues['sections']:
        a, b = s['t0'], s['t1']
        v = seg(voice, a, b)
        m = seg(mbus, a, b)
        x = seg(sbus, a, b)
        mask = np.zeros(len(v), bool)
        for sa, sb in cues['speech']:
            i, j = int((sa - a) * SR), int((sb - a) * SR)
            mask[max(0, i):max(0, min(len(v), j))] = True
        vs = to_stereo(v)[mask]
        ms = to_stereo(m)[mask]
        mg = to_stereo(m)[~mask]

        def L(z):
            if len(z) < SR * 0.45:
                return float('nan')
            with np.errstate(divide='ignore'):
                return meter.integrated_loudness(z)

        lv, lm, lmu, lmg, lx = L(vs), L(m), L(ms), L(mg), L(x)
        print(f'   {s["key"]:8s} {lv:7.1f} {lm:7.1f} {lmu:9.1f} {lv - lmu:6.1f} {lmg:7.1f} {lx:7.1f}')
    spectrogram_png(final, os.path.join(QA, 'final_spectrogram.png'), 'final_audio.wav', cues)
    envelope_png([('final', final, 'k'), ('voice', voice, 'tab:orange'), ('music bus', mbus, 'tab:blue'),
                  ('sfx bus', sbus, 'tab:green')], os.path.join(QA, 'envelopes.png'), cues, 'RMS (100 ms)')
    print('PNGs in', QA)


if __name__ == '__main__':
    main()
