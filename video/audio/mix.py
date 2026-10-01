"""Final mix: voice chain, sidechain-ducked music, SFX bus, loudness + true-peak.

Run:  BUILD=... python3 mix.py   ->  $BUILD/final_audio.wav (48 kHz, stereo, 24-bit)
                                     $BUILD/mix_buses/{voice,music,sfx}.wav (QA)

Voice : HPF 70 Hz -> split-band de-esser (6-9 kHz detector) -> 3:1 RMS
        compressor -> +2 dB presence @ 3.5 kHz -> ~9 % plate -> centre.
Music : gain-staged to the voice, ducked by the voice envelope (-8 dB,
        80 ms attack, 400 ms release, 250 ms hold) plus a -3 dB 1.2-5 kHz
        "spectral duck" under words so consonants stay clear.
SFX   : level-balanced against the voice, not ducked.
Master: sum -> -14 LUFS integrated (pyloudnorm) -> 4x-oversampled
        look-ahead peak limiter, true peak <= -1 dBTP.
"""
import json
import os
import sys

import numpy as np
import pyloudnorm as pyln
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (SR, BUILD, read, write, db2a, a2db, hpf, bpf, eq, make_ir, convolve, to_stereo,
                    load_cues)

TARGET_LUFS = -14.0
TP_CEIL = -1.0
DUCK_DB = -8.0
SPECTRAL_DUCK_DB = -6.0
MEDIAN_VM = 13.0         # median over sections of voice minus ducked music under speech (LU)
SFX_REL_DB = -5.0        # strong SFX moments vs voice momentary loudness


def frames_rms(x, hop):
    m = x if x.ndim == 1 else x.mean(axis=1)
    k = len(m) // hop
    r = np.sqrt(np.mean(m[:k * hop].reshape(k, hop) ** 2, axis=1) + 1e-20)
    return r


def smooth_gain_db(target_db, frame_s, attack, release, hold=0.0):
    """one-pole smoothing in dB, separate attack (gain going down) / release
    (gain coming back up) with optional hold before release."""
    out = np.empty_like(target_db)
    a_att = np.exp(-frame_s / attack)
    a_rel = np.exp(-frame_s / release)
    hold_n = int(round(hold / frame_s))
    g = 0.0
    h = 0
    for i, tg in enumerate(target_db):
        if tg < g:
            g = a_att * g + (1 - a_att) * tg
            h = hold_n
        elif h > 0:
            h -= 1
        else:
            g = a_rel * g + (1 - a_rel) * tg
        out[i] = g
    return out


def frame_to_samples(v, hop, n):
    centers = (np.arange(len(v)) + 0.5) * hop
    return np.interp(np.arange(n), centers, v)


# ------------------------------------------------------------------ voice
def voice_chain(v):
    n = len(v)
    x = hpf(v, 70, 4)
    # --- split-band de-esser
    hi = hpf(x, 5500, 4)
    lo = x - hi
    hop = int(0.005 * SR)
    det = frames_rms(bpf(x, 6000, 9000, 2), hop)
    full = frames_rms(x, hop)
    sd = a2db(det)
    active = a2db(full) > a2db(np.max(full)) - 45
    ds_thr = np.percentile(sd[active], 88)
    red = -np.clip((sd - ds_thr) * 0.7, 0, 8.0)                 # up to -8 dB on the sibilant band
    red = smooth_gain_db(red, 0.005, 0.001, 0.04)
    g = db2a(frame_to_samples(red, hop, n))
    x = lo + hi * g
    # --- 3:1 compressor (RMS 10 ms detector, 10 ms attack, 120 ms release, soft knee)
    hop = int(0.002 * SR)
    lvl = a2db(np.sqrt(np.maximum(uniform_filter1d(x ** 2, int(0.01 * SR)), 1e-20)))[::hop][: n // hop]
    act = lvl > np.max(lvl) - 45
    thr = np.percentile(lvl[act], 40)
    knee = 6.0
    over = lvl - thr
    gr = np.where(over <= -knee / 2, 0.0,
                  np.where(over >= knee / 2, over * (1 / 3 - 1), (1 / 3 - 1) * (over + knee / 2) ** 2 / (2 * knee)))
    gr = smooth_gain_db(gr, 0.002, 0.010, 0.120)
    x = x * db2a(frame_to_samples(gr, hop, n))
    # --- presence
    x = eq(x, 'peak', 3500, 2.0, 1.0)
    # --- subtle plate
    plate = make_ir(rt60=1.25, predelay=0.015, damp=0.25, seed=211, er=False, bright=1.3, length=1.6)
    wet = convolve(hpf(x, 200), plate)
    out = to_stereo(x) + 0.09 * wet
    sp = act.repeat(1)[:len(gr)]
    return out, dict(deess_thr_db=float(ds_thr), deess_max_red_db=float(red.min()),
                     deess_frames_active_pct=float(100 * np.mean(red < -1.0)),
                     comp_thr_db=float(thr), comp_mean_gr_speech_db=float(np.mean(gr[sp])),
                     comp_max_gr_db=float(gr.min()))


# ------------------------------------------------------------------ ducking
def voice_activity(vproc, cues):
    """0..1 activity from the processed voice envelope (10 ms frames)"""
    hop = int(0.010 * SR)
    e = a2db(frames_rms(vproc, hop))
    ref = np.percentile(e[e > np.max(e) - 50], 50)
    a = np.clip((e - (ref - 24)) / 10.0, 0, 1)
    return a, hop


def duck_music(m, act, hop):
    """broadband duck (-8 dB) + STFT 'spectral duck' (-6 dB, 1.2-4.5 kHz)
    both driven by the same voice-activity envelope."""
    n = len(m)
    tgt = DUCK_DB * act
    g = smooth_gain_db(tgt, hop / SR, 0.080, 0.400, hold=0.25)
    gs = db2a(frame_to_samples(g, hop, n))
    gm = smooth_gain_db(SPECTRAL_DUCK_DB * act, hop / SR, 0.060, 0.300, hold=0.25)   # dB, <= 0
    nper, step = 2048, 512
    f = np.fft.rfftfreq(nper, 1 / SR)
    w = np.interp(f, [0, 700, 1200, 4500, 8000, SR / 2], [0, 0, 1, 1, 0.3, 0.3])
    out = np.zeros_like(m)
    for c in range(m.shape[1]):
        _, tt, Z = signal.stft(m[:, c], SR, nperseg=nper, noverlap=nper - step, boundary='even', padded=True)
        fr = np.clip(tt * SR / hop, 0, len(gm) - 1)
        gdb = np.interp(fr, np.arange(len(gm)), gm)
        G = 10 ** (w[:, None] * gdb[None, :] / 20)
        _, y = signal.istft(Z * G, SR, nperseg=nper, noverlap=nper - step, boundary=True)
        y = y[:n]
        if len(y) < n:
            y = np.concatenate([y, np.zeros(n - len(y))])
        out[:, c] = y
    return out * gs[:, None], g


# ------------------------------------------------------------------ limiter
def oversampled_peak_env(x, os_=4, chunk_s=20.0):
    """per-sample max |x| over 4x-oversampled reconstruction (both channels)"""
    n = len(x)
    out = np.empty(n)
    C = int(chunk_s * SR)
    pad = 256
    for i in range(0, n, C):
        a, b = max(0, i - pad), min(n, i + C + pad)
        up = signal.resample_poly(x[a:b], os_, 1, axis=0)
        pk = np.abs(up).max(axis=1).reshape(-1, os_).max(axis=1)
        out[i:min(n, i + C)] = pk[i - a:i - a + min(C, n - i)]
    return out


def true_peak_limit(x, ceil_db, look_ms=1.5, release_ms=60.0):
    ceil = db2a(ceil_db)
    pk = oversampled_peak_env(x)
    req = np.minimum(1.0, ceil / np.maximum(pk, 1e-12))
    if req.min() >= 1.0:
        return x, 0.0
    L = int(look_ms / 1000 * SR)
    g1 = minimum_filter1d(req, size=2 * L + 1)
    g2 = uniform_filter1d(g1, size=L + 1)
    # slow release on 1 ms blocks (instant attack), never above g2
    B = int(0.001 * SR)
    k = len(g2) // B
    gb = g2[:k * B].reshape(k, B).min(axis=1)
    r = np.empty(k)
    a = np.exp(-1.0 / release_ms)
    cur = 1.0
    for i in range(k):
        cur = min(gb[i], 1 - (1 - cur) * a)
        r[i] = cur
    rs = np.interp(np.arange(len(g2)), (np.arange(k) + 0.5) * B, r)
    g = np.minimum(g2, rs)
    return x * g[:, None], float(a2db(g.min()))


def main():
    cues = load_cues()
    meter = pyln.Meter(SR)
    n = int(round(cues['duration'] * SR))

    def fit(x):
        x = to_stereo(x) if x.ndim == 2 else x
        if len(x) < n:
            pad = np.zeros((n - len(x),) + x.shape[1:])
            x = np.concatenate([x, pad])
        return x[:n]

    voice_raw = fit(read(os.path.join(BUILD, 'narration.wav')))
    music = hpf(fit(to_stereo(read(os.path.join(BUILD, 'music.wav')))), 28, 2)
    sfx = fit(to_stereo(read(os.path.join(BUILD, 'sfx.wav'))))

    voice, vinfo = voice_chain(voice_raw)
    # speech-gated voice loudness
    mask = np.zeros(n, bool)
    for a, b in cues['speech']:
        mask[int(a * SR):int(b * SR)] = True
    Lv = meter.integrated_loudness(voice[mask])

    # music gain-staging: the median over sections of (voice - ducked music
    # under speech) is set to MEDIAN_VM; per-section deviations are the
    # score's own dynamics (score.SECTION_TRIM), so this is a single fader.
    Lm = meter.integrated_loudness(music)
    act, hop = voice_activity(voice, cues)
    music_d, gduck = duck_music(music, act, hop)
    diffs = []
    for s in cues['sections']:
        a, b = int(s['t0'] * SR), int(s['t1'] * SR)
        msk = mask[a:b]
        if msk.sum() < SR:
            continue
        lv_ = meter.integrated_loudness(voice[a:b][msk])
        lm_ = meter.integrated_loudness(music_d[a:b][msk])
        diffs.append(lv_ - lm_)
    mg = db2a(float(np.median(diffs)) - MEDIAN_VM)
    music_d = music_d * mg

    # sfx gain-staging: 90th percentile of momentary loudness at strong events
    sfx_m = []
    for e in cues['sfx']:
        if e['gain_db'] >= -8:
            seg = sfx[int(e['t'] * SR):int((e['t'] + 0.45) * SR)]
            if len(seg) == int(0.45 * SR):
                sfx_m.append(meter.integrated_loudness(seg) if np.max(np.abs(seg)) > 0 else -70)
    vm = []
    for a, b in cues['speech']:
        for t in np.arange(a, b - 0.45, 0.4):
            seg = voice[int(t * SR):int((t + 0.45) * SR)]
            vm.append(meter.integrated_loudness(seg))
    vm = np.array(vm)
    vmed = float(np.median(vm[np.isfinite(vm)]))
    s90 = float(np.percentile([v for v in sfx_m if np.isfinite(v)], 90))
    sg = db2a(vmed + SFX_REL_DB - s90)
    sfx_b = sfx * sg

    mix = voice + music_d + sfx_b
    L0 = meter.integrated_loudness(mix)
    gain = db2a(TARGET_LUFS - L0)
    out = mix * gain
    gr_db = 0.0
    for it in range(3):
        lim, gr_db = true_peak_limit(out, TP_CEIL - 0.25)
        L1 = meter.integrated_loudness(lim)
        corr = TARGET_LUFS - L1
        if abs(corr) < 0.05:
            break
        gain *= db2a(corr)
        out = mix * gain
    final = lim
    tp = a2db(oversampled_peak_env(final).max())
    if tp > TP_CEIL:
        final = final * db2a(TP_CEIL - tp - 0.02)
    Lf = meter.integrated_loudness(final)
    os.makedirs(os.path.join(BUILD, 'mix_buses'), exist_ok=True)
    write(os.path.join(BUILD, 'final_audio.wav'), final, subtype='PCM_24')
    write(os.path.join(BUILD, 'mix_buses', 'voice.wav'), voice * gain)
    write(os.path.join(BUILD, 'mix_buses', 'music.wav'), music_d * gain)
    write(os.path.join(BUILD, 'mix_buses', 'sfx.wav'), sfx_b * gain)
    rep = dict(voice_speech_lufs=Lv, music_bus_lufs_raw=Lm, music_gain_db=float(a2db(mg)),
               sfx_gain_db=float(a2db(sg)), voice_momentary_median=vmed, sfx_strong_p90=s90,
               master_gain_db=float(a2db(gain)), limiter_max_gr_db=gr_db, final_lufs=Lf,
               final_true_peak_dbtp=float(a2db(oversampled_peak_env(final).max())), **vinfo)
    with open(os.path.join(BUILD, 'mix_buses', 'mix_report.json'), 'w') as fh:
        json.dump(rep, fh, indent=1)
    for k, v in rep.items():
        print(f'  {k:24s} {v:8.2f}')


if __name__ == '__main__':
    main()
