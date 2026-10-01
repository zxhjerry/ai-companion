"""Shared DSP helpers for the audio build (score, sfx, mix, qa).

Everything is numpy/scipy, 48 kHz, float32/float64 arrays shaped (n,) for mono
or (n, 2) for stereo.  All randomness goes through np.random.default_rng(seed)
so the build is bit-for-bit reproducible.
"""
import json
import os

import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.dirname(HERE)
BUILD = os.environ.get('BUILD', os.path.join(VIDEO, 'build'))
ASSETS = os.environ.get('ASSETS', os.path.join(VIDEO, '.models', 'assets'))
SF2 = os.environ.get('SF2', os.path.join(ASSETS, 'generaluser-gs', 'GeneralUser-GS.sf2'))


def load_cues():
    with open(os.path.join(BUILD, 'cues.json'), encoding='utf-8') as f:
        return json.load(f)


def nsamp(t):
    return int(round(t * SR))


def db2a(d):
    return 10.0 ** (d / 20.0)


def a2db(a):
    return 20.0 * np.log10(np.maximum(np.abs(a), 1e-12))


# ------------------------------------------------------------------ filters
def _sos(kind, f, order=2):
    if kind == 'band':
        lo, hi = f
        hi = min(hi, SR * 0.45)
        return signal.butter(order, [lo, hi], btype='band', fs=SR, output='sos')
    return signal.butter(order, min(f, SR * 0.45), btype=kind, fs=SR, output='sos')


def lpf(x, f, order=2):
    return signal.sosfilt(_sos('low', f, order), x, axis=0)


def hpf(x, f, order=2):
    return signal.sosfilt(_sos('high', f, order), x, axis=0)


def bpf(x, lo, hi, order=2):
    return signal.sosfilt(_sos('band', (lo, hi), order), x, axis=0)


def lpf0(x, f, order=2):
    """zero-phase low-pass (for envelopes)"""
    return signal.sosfiltfilt(_sos('low', f, order), x, axis=0)


def biquad(kind, f, gain_db=0.0, q=0.707):
    """RBJ cookbook biquad -> sos row."""
    A = 10 ** (gain_db / 40)
    w = 2 * np.pi * f / SR
    cw, sw = np.cos(w), np.sin(w)
    al = sw / (2 * q)
    if kind == 'peak':
        b = [1 + al * A, -2 * cw, 1 - al * A]
        a = [1 + al / A, -2 * cw, 1 - al / A]
    elif kind == 'lowshelf':
        sq = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) - (A - 1) * cw + sq), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sq)]
        a = [(A + 1) + (A - 1) * cw + sq, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sq]
    elif kind == 'highshelf':
        sq = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) + (A - 1) * cw + sq), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sq)]
        a = [(A + 1) - (A - 1) * cw + sq, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sq]
    else:
        raise ValueError(kind)
    b = np.array(b) / a[0]
    a = np.array(a) / a[0]
    return np.concatenate([b, a])[None, :]


def eq(x, kind, f, gain_db, q=0.707):
    return signal.sosfilt(biquad(kind, f, gain_db, q), x, axis=0)


# ------------------------------------------------------------- envelopes
def ramp(n, a=0.0, b=1.0, shape='lin'):
    t = np.linspace(0, 1, max(n, 1))
    if shape == 'cos':
        t = 0.5 - 0.5 * np.cos(np.pi * t)
    elif shape == 'exp':
        t = t ** 2
    elif shape == 'log':
        t = np.sqrt(t)
    return a + (b - a) * t


def fade(x, fin=0.005, fout=0.005):
    """Fade edges in place (seconds) so nothing ever clicks."""
    x = np.array(x, dtype=np.float64, copy=True)
    n = len(x)
    a = min(nsamp(fin), n // 2)
    b = min(nsamp(fout), n // 2)
    if a > 0:
        e = ramp(a, 0, 1, 'cos')
        x[:a] *= e if x.ndim == 1 else e[:, None]
    if b > 0:
        e = ramp(b, 1, 0, 'cos')
        x[n - b:] *= e if x.ndim == 1 else e[:, None]
    return x


def adsr(n, a, d, s, r, sustain_level=None):
    """Simple linear-attack / exponential decay envelope of length n samples.
    a, d, r in seconds; s = sustain level."""
    env = np.zeros(n)
    na, nd, nr = nsamp(a), nsamp(d), nsamp(r)
    na = min(na, n)
    env[:na] = np.linspace(0, 1, na, endpoint=False) if na else 0
    i = na
    nd2 = min(nd, n - i)
    if nd2 > 0:
        env[i:i + nd2] = s + (1 - s) * np.exp(-5 * np.arange(nd2) / max(nd, 1))
    i += nd2
    if i < n:
        env[i:] = s
    if nr > 0:
        k = min(nr, n)
        env[n - k:] *= np.linspace(1, 0, k) ** 1.5
    return env


def expdecay(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def env_points(n, pts, t0=0.0):
    """Piecewise-linear envelope from [(t, value), ...] (seconds relative to t0)."""
    t = t0 + np.arange(n) / SR
    ts = [p[0] for p in pts]
    vs = [p[1] for p in pts]
    return np.interp(t, ts, vs)


# ------------------------------------------------------------- stereo
def pan(x, p=0.0):
    """mono -> stereo, constant-power pan p in [-1, 1]."""
    th = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(th), x * np.sin(th)], axis=1) * np.sqrt(2)


def to_stereo(x):
    return x if x.ndim == 2 else np.stack([x, x], axis=1)


def balance(x, p):
    """stereo balance in [-1, 1] keeping centre at unity."""
    if p == 0:
        return x
    g = np.array([min(1.0, 1 - p), min(1.0, 1 + p)])
    return x * g[None, :]


def width(x, w):
    m = 0.5 * (x[:, 0] + x[:, 1])
    s = 0.5 * (x[:, 0] - x[:, 1]) * w
    return np.stack([m + s, m - s], axis=1)


def place(buf, x, t, t_buf0=0.0, gain=1.0):
    """Add x into buf at absolute time t (buf starts at t_buf0)."""
    i = nsamp(t - t_buf0)
    if x.ndim == 1 and buf.ndim == 2:
        x = to_stereo(x)
    j0 = max(0, i)
    j1 = min(len(buf), i + len(x))
    if j1 <= j0:
        return
    buf[j0:j1] += gain * x[j0 - i:j1 - i]


# ------------------------------------------------------------- reverb
def make_ir(rt60=2.5, predelay=0.02, length=None, damp=0.5, seed=1, er=True, bright=1.0, width_=1.0):
    """Synthetic stereo reverb impulse response: band-split exponentially
    decaying noise (high bands decay faster), sparse early reflections."""
    rng = np.random.default_rng(seed)
    length = length or rt60 * 1.3
    n = nsamp(length)
    out = np.zeros((n, 2))
    bands = [(20, 250), (250, 800), (800, 2500), (2500, 6000), (6000, 16000)]
    # rt multiplier per band: lows a bit longer, highs shorter (damping)
    mult = [1.15, 1.0, 0.85 - 0.2 * damp, 0.65 - 0.3 * damp, 0.45 - 0.25 * damp]
    gains = [1.0, 1.0, 0.9, 0.7 * bright, 0.45 * bright]
    t = np.arange(n) / SR
    for ch in range(2):
        nz = rng.standard_normal(n)
        acc = np.zeros(n)
        for (lo, hi), m, g in zip(bands, mult, gains):
            rt = max(rt60 * m, 0.05)
            b = bpf(nz, lo, hi, 2)
            acc += g * b * np.exp(-6.9078 * t / rt)
        out[:, ch] = acc
    # smooth onset of the diffuse tail
    att = nsamp(0.012)
    out[:att] *= ramp(att, 0, 1)[:, None]
    if er:
        for k in range(14):
            d = predelay + rng.uniform(0.003, 0.07)
            i = nsamp(d)
            if i < n:
                out[i, 0] += rng.uniform(-1, 1) * 2.5 * np.exp(-d * 18)
                i2 = nsamp(d + rng.uniform(0.0005, 0.004))
                out[min(i2, n - 1), 1] += rng.uniform(-1, 1) * 2.5 * np.exp(-d * 18)
    pd = nsamp(predelay)
    out = np.concatenate([np.zeros((pd, 2)), out])[:n]
    out = width(out, width_)
    out /= np.sqrt(np.sum(out ** 2) / 2)
    return out


def convolve(x, ir):
    """stereo (or mono) x convolved with stereo ir -> stereo, same length as x"""
    x = to_stereo(x)
    y = np.zeros_like(x)
    for ch in range(2):
        y[:, ch] = signal.oaconvolve(x[:, ch], ir[:, ch])[:len(x)]
    return y


# ------------------------------------------------------------- io
def write(path, x, subtype='FLOAT'):
    """FLOAT goes through scipy (libsndfile adds a timestamped PEAK chunk to
    float WAVs, which would make reproducible builds differ byte-wise)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if subtype == 'FLOAT':
        from scipy.io import wavfile
        wavfile.write(path, SR, np.asarray(x, dtype=np.float32))
    else:
        sf.write(path, np.asarray(x, dtype=np.float64), SR, subtype=subtype)


def read(path):
    x, sr = sf.read(path, dtype='float64', always_2d=False)
    assert sr == SR, (path, sr)
    return x


# ------------------------------------------------------------- misc
def rms_db(x):
    return a2db(np.sqrt(np.mean(np.square(x)) + 1e-20))


def peak_db(x):
    return a2db(np.max(np.abs(x)) + 1e-20)


def true_peak_db(x, os_factor=4, chunk_s=20.0):
    """oversampled (inter-sample) peak, processed in overlapping chunks"""
    x = to_stereo(x)
    n = len(x)
    C = int(chunk_s * SR)
    pad = 512
    pk = 0.0
    for i in range(0, n, C):
        a, b = max(0, i - pad), min(n, i + C + pad)
        up = signal.resample_poly(x[a:b], os_factor, 1, axis=0)
        lo = (i - a) * os_factor
        hi = lo + min(C, n - i) * os_factor
        pk = max(pk, float(np.max(np.abs(up[lo:hi]))))
    return a2db(pk + 1e-20)


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def nm(s):
    """'F#4' -> 66"""
    s = s.strip()
    pc = NOTE[s[0].upper()]
    i = 1
    while i < len(s) and s[i] in '#b':
        pc += 1 if s[i] == '#' else -1
        i += 1
    return pc + 12 * (int(s[i:]) + 1)
