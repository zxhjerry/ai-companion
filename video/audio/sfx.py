"""Procedural sound effects for every SFX `type` in cues.json -> $BUILD/sfx.wav

Run:  BUILD=... python3 sfx.py

Each generator returns mono or stereo float audio whose first sample is the
event onset (except reverse_swell, which *ends* at t + dur).  Every sound is
peak-normalised to -6 dBFS (= gain_db 0, "a strong hit"), then a per-type
perceptual trim and the cue's gain_db are applied.  All noise is seeded from
(type, event index) so the build is deterministic.
"""
import os
import sys
import zlib

import numpy as np
from scipy import signal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (SR, BUILD, nsamp, db2a, load_cues, write, lpf, hpf, bpf, fade, pan, to_stereo,
                    make_ir, convolve, midi_hz, nm, ramp)

GEN = {}
TRIM = {}     # per-type perceptual trim in dB (applied after peak normalisation)
SEND = {}     # per-type room-reverb send


def sfx(name, trim=0.0, send=0.08):
    def deco(fn):
        GEN[name] = fn
        TRIM[name] = trim
        SEND[name] = send
        return fn
    return deco


# ------------------------------------------------------------------ toolkit
def tt(n):
    return np.arange(n) / SR


def white(n, rng):
    return rng.standard_normal(n)


def pink(n, rng):
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    X /= np.sqrt(np.maximum(f, 20.0))
    y = np.fft.irfft(X, n)
    return y / (np.std(y) + 1e-12)


def brown(n, rng):
    y = np.cumsum(rng.standard_normal(n))
    y = hpf(y, 20)
    return y / (np.std(y) + 1e-12)


def env_ad(n, a, tau):
    t = tt(n)
    e = np.exp(-np.maximum(t - a, 0) / tau)
    if a > 0:
        e = np.where(t < a, t / a, e)
    return e


def hump(n, peak=0.5, p=2.0):
    """smooth rise/fall envelope peaking at fraction `peak`"""
    x = np.linspace(0, 1, n)
    up = np.clip(x / peak, 0, 1)
    dn = np.clip((1 - x) / (1 - peak), 0, 1)
    return (np.sin(np.pi / 2 * np.minimum(up, dn))) ** p


def sine_f(freq):
    return np.sin(2 * np.pi * np.cumsum(freq) / SR)


def modal(n, freqs, taus, amps, rng, attack=0.0005, beat=0.0):
    t = tt(n)
    y = np.zeros(n)
    for f, ta, a in zip(freqs, taus, amps):
        if f >= SR * 0.45:
            continue
        ph = rng.uniform(0, 2 * np.pi)
        comp = np.sin(2 * np.pi * f * t + ph)
        if beat:
            comp = 0.5 * comp + 0.5 * np.sin(2 * np.pi * (f + beat * rng.uniform(0.5, 1.5)) * t + ph)
        y += a * comp * np.exp(-t / ta)
    k = max(1, nsamp(attack))
    y[:k] *= np.linspace(0, 1, k)
    return y


def tv_filter(x, centers, widths, gains=None):
    """time-varying band-pass via STFT: centers/widths arrays (Hz) sampled per
    STFT frame (interpolated from any length)."""
    nper = 1024
    f, t, Z = signal.stft(x, SR, nperseg=nper, noverlap=nper * 3 // 4, boundary='even', padded=True)
    m = Z.shape[1]
    c = np.interp(np.linspace(0, 1, m), np.linspace(0, 1, len(centers)), centers)
    w = np.interp(np.linspace(0, 1, m), np.linspace(0, 1, len(widths)), widths)
    lf = np.log(np.maximum(f, 1.0))[:, None]
    M = np.exp(-0.5 * ((lf - np.log(c)[None, :]) / np.log1p(w / c)[None, :]) ** 2)
    if gains is not None:
        M *= np.interp(np.linspace(0, 1, m), np.linspace(0, 1, len(gains)), gains)[None, :]
    _, y = signal.istft(Z * M, SR, nperseg=nper, noverlap=nper * 3 // 4, boundary=True)
    y = y[:len(x)]
    if len(y) < len(x):
        y = np.concatenate([y, np.zeros(len(x) - len(y))])
    return y


def spectral_tilt(x, f_pivot, db_per_oct):
    nper = 2048
    f, t, Z = signal.stft(x, SR, nperseg=nper)
    g = 10 ** (db_per_oct * np.log2(np.maximum(f, 20) / f_pivot) / 20)
    _, y = signal.istft(Z * g[:, None], SR, nperseg=nper)
    return y[:len(x)]


def thud(n, f0=110, f1=55, tau=0.08, glide=0.03):
    t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t / glide)
    return sine_f(f) * np.exp(-t / tau)


def click(n, rng, tau=0.0015, hp=2000):
    return hpf(white(n, rng), hp) * np.exp(-tt(n) / tau)


def crush(x, bits=6, down=4):
    q = 2 ** (bits - 1)
    y = np.round(x * q) / q
    idx = (np.arange(len(y)) // down) * down
    return y[idx]


def mono_sum(x):
    return x if x.ndim == 1 else x.mean(axis=1)


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-12
    return x * (peak / m)


def bell_partials(n, f0, rng, decay=2.0, bright=1.0, ratios=(1.0, 2.0, 2.76, 3.9, 5.4), amps=(1, .5, .35, .2, .12)):
    taus = [decay / (1 + 0.8 * i) for i in range(len(ratios))]
    return modal(n, [f0 * r for r in ratios], taus, [a * (bright ** i) for i, a in enumerate(amps)], rng,
                 attack=0.0008)


def stereo_spread(x, rng, amount=0.3, delay_ms=7.0):
    """mono -> wide stereo via short decorrelating delay"""
    d = nsamp(delay_ms / 1000)
    y = np.zeros(len(x) + d)
    y[d:] = x
    L = x + amount * y[:len(x)]
    R = x - amount * y[:len(x)]
    return np.stack([L, R], axis=1)


# ------------------------------------------------------------------ sounds
@sfx('breath', trim=-2, send=0.15)
def _breath(rng, dur, i):
    n = nsamp(1.0)
    x = pink(n, rng)
    # vocal-tract-ish resonances of an open-mouth inhale
    y = 0.6 * bpf(x, 500, 900) + 1.0 * bpf(x, 1100, 1700) + 0.7 * bpf(x, 2200, 3200) + 0.3 * bpf(x, 4000, 7000)
    e = hump(n, peak=0.72, p=1.6)
    return fade(y * e, 0.01, 0.06)


@sfx('anvil', trim=-2, send=0.22)
def _anvil(rng, dur, i):
    n = nsamp(2.4)
    f0 = midi_hz(81) * rng.uniform(0.985, 1.015)       # rings around A5, in key
    ratios = [1.0, 2.43, 2.98, 4.12, 5.37, 6.81, 8.2, 10.9]
    taus = [0.9, 0.5, 0.6, 0.3, 0.25, 0.15, 0.1, 0.06]     # short ring: the words follow
    amps = [1.0, 0.5, 0.35, 0.35, 0.22, 0.16, 0.1, 0.06]
    ring = modal(n, [f0 * r for r in ratios], taus, amps, rng, beat=1.2)
    hit = click(n, rng, tau=0.0018, hp=1500) * 2.2
    body = thud(n, 260, 160, tau=0.03) * 0.8
    y = 0.75 * ring + hit + body
    return fade(y, 0.0003, 0.2)


@sfx('boom', trim=-1, send=0.12)
def _boom(rng, dur, i):
    n = nsamp(2.2)
    t = tt(n)
    f = 30 + 32 * np.exp(-t / 0.35)
    sub = sine_f(f) * (1 - np.exp(-t / 0.004)) * np.exp(-t / 0.75)
    thump = lpf(white(n, rng), 220, 2) * np.exp(-t / 0.07) * 1.4
    y = np.tanh(2.0 * (sub + thump)) + 0.06 * bpf(white(n, rng), 300, 1500) * np.exp(-t / 0.05)
    return fade(y, 0.0005, 0.3)


@sfx('reverse_swell', trim=-1, send=0.0)
def _reverse_swell(rng, dur, i):
    dur = dur or 1.2
    n = nsamp(dur + 0.6)
    src = np.zeros(n)
    k = nsamp(0.08)
    src[:k] = white(k, rng) * np.exp(-tt(k) / 0.02)
    src += 0.6 * modal(n, [midi_hz(nm(p)) for p in ('D5', 'A5', 'F#6', 'E6')], [0.2] * 4, [1, .8, .6, .4], rng)
    ir = make_ir(rt60=dur * 1.4 + 0.5, predelay=0.0, damp=0.3, seed=500 + i, er=False, length=dur + 0.6)
    wet = convolve(src, ir)
    y = wet[::-1][-nsamp(dur):]
    y = y * ramp(len(y), 0, 1, 'exp')[:, None]
    return fade(y, 0.02, 0.004)


@sfx('bloom', trim=-4, send=0.25)
def _bloom(rng, dur, i):
    n = nsamp(3.0)
    t = tt(n)
    out = np.zeros((n, 2))
    for k, p in enumerate(['D5', 'F#5', 'A5', 'E6', 'D6', 'A6']):
        f = midi_hz(nm(p))
        for ch, det in ((0, -2.5), (1, 2.5)):
            ff = f * 2 ** (det / 1200)
            out[:, ch] += (0.9 ** k) * np.sin(2 * np.pi * ff * t + rng.uniform(0, 6))
    env = (1 - np.exp(-t / 0.07)) * np.exp(-t / 1.1)
    trem = 1 + 0.08 * np.sin(2 * np.pi * 5.5 * t)
    air = bpf(white(n, rng), 3000, 9000) * np.exp(-t / 0.5) * 0.3
    out = out * (env * trem)[:, None] + to_stereo(air)
    return fade(out, 0.003, 0.3)


@sfx('paper', trim=-2, send=0.1)
def _paper(rng, dur, i):
    n = nsamp(0.55)
    x = bpf(white(n, rng), 1200, 7500)
    crinkle = np.abs(lpf(white(n, rng), 60)) * 3 + 0.4
    spikes = np.zeros(n)
    for p in rng.integers(0, n - 300, 40):
        L = rng.integers(40, 250)
        spikes[p:p + L] += rng.uniform(0.3, 1.0) * np.exp(-np.arange(L) / (L / 3))
    y = x * (crinkle + 2 * spikes) * hump(n, 0.25, 1.2)
    return fade(y, 0.005, 0.05)


def _scratch(rng, dur, rate=7.0, band=(1800, 7000), grain=0.7):
    n = nsamp(dur)
    t = tt(n)
    x = bpf(white(n, rng), *band)
    gr = np.abs(bpf(white(n, rng), 80, 600))
    gr = gr / (gr.max() + 1e-9)
    ph = np.cumsum(rate * (1 + 0.25 * np.sin(2 * np.pi * 0.9 * t + rng.uniform(0, 6)))) / SR
    stroke = np.sin(np.pi * (ph % 1.0)) ** 2
    y = x * stroke * ((1 - grain) + grain * gr)
    return fade(y * hump(n, 0.15, 0.6), 0.01, 0.05)


@sfx('pencil', trim=-4, send=0.06)
def _pencil(rng, dur, i):
    return _scratch(rng, dur or 0.8, rate=8.5, band=(2000, 8000), grain=0.8)


@sfx('glitch', trim=-10, send=0.0)
def _glitch(rng, dur, i):
    dur = dur or 0.5
    n = nsamp(dur)
    out = np.zeros((n, 2))
    pos = 0
    prev = None
    while pos < n:
        L = int(rng.integers(nsamp(0.012), nsamp(0.06)))
        L = min(L, n - pos)
        kind = rng.choice(['sq', 'nz', 'rep', 'sil', 'sq'])
        t = tt(L)
        if kind == 'sq':
            f = rng.choice([180, 320, 640, 960, 1500, 2400])
            seg_ = np.sign(np.sin(2 * np.pi * f * t)) * 0.7
        elif kind == 'nz':
            seg_ = crush(white(L, rng) * 0.6, bits=3, down=int(rng.integers(4, 16)))
        elif kind == 'rep' and prev is not None:
            seg_ = np.resize(prev, L)
        else:
            seg_ = np.zeros(L)
        e = np.ones(L)
        k = min(nsamp(0.001), L // 2)
        if k:
            e[:k] = np.linspace(0, 1, k)
            e[-k:] = np.linspace(1, 0, k)
        p_ = rng.uniform(-0.7, 0.7)
        out[pos:pos + L] += pan(seg_ * e, p_)
        prev = seg_[:max(1, L // 2)]
        pos += L
    out = lpf(out, 9000)
    return fade(out, 0.001, 0.01)


@sfx('glitch_hit', trim=-10, send=0.0)
def _glitch_hit(rng, dur, i):
    n = nsamp(0.18)
    t = tt(n)
    f = 300 + 1200 * np.exp(-t / 0.03)
    sq = np.sign(sine_f(f)) * np.exp(-t / 0.06)
    nz = crush(white(n, rng), 3, 8) * np.exp(-t / 0.025)
    y = 0.6 * sq + 0.7 * nz + click(n, rng) * 1.5
    return fade(lpf(y, 10000), 0.0003, 0.01)


@sfx('impact', trim=0, send=0.15)
def _impact(rng, dur, i):
    n = nsamp(1.6)
    t = tt(n)
    sub = thud(n, 70, 34, tau=0.45, glide=0.06)
    punch = lpf(white(n, rng), 900) * np.exp(-t / 0.05) * 1.2
    crack = hpf(white(n, rng), 3500) * np.exp(-t / 0.012) * 0.8
    tail = bpf(white(n, rng), 200, 3000) * np.exp(-t / 0.35) * 0.25
    y = np.tanh(1.6 * (sub + punch)) + crack + tail
    return fade(y, 0.0003, 0.2)


@sfx('tape_stop', trim=-3, send=0.0)
def _tape_stop(rng, dur, i):
    dur = dur or 0.6
    n = nsamp(dur + 0.12)
    t = tt(n)
    sp = np.clip(1 - t / dur, 0, 1) ** 1.6
    f = 15 + 140 * sp
    w = np.zeros(n)
    for k, a in [(1, 1.0), (2, 0.5), (3, 0.35), (5, 0.15)]:
        w += a * sine_f(f * k)
    w = lpf(w, 1500) * (0.25 + 0.75 * sp)
    clunk = np.zeros(n)
    i0 = nsamp(dur - 0.01)
    clunk[i0:] = thud(n - i0, 140, 70, tau=0.04) + 0.3 * click(n - i0, rng, hp=1200)
    return fade(w + clunk, 0.003, 0.03)


def _whoosh(rng, dur, i, soft=False):
    dur = dur or (0.8 if soft else 1.05)
    n = nsamp(dur)
    x = pink(n, rng)
    k = np.linspace(0, 1, 64)
    peak = 0.62
    c = np.where(k < peak, 350 + 2600 * (k / peak) ** 1.5, 2950 - 2100 * np.clip((k - peak) / (1 - peak), 0, 1) ** 0.8)
    if soft:
        c = c * 0.7
    w = c * 0.55
    y = tv_filter(x, c, w)
    y2 = tv_filter(pink(n, rng), c * 1.6, w * 0.8) * 0.5
    e = hump(n, peak, 1.6)
    m = (y + y2) * e
    # pan sweep L->R (doppler-ish pass-by)
    p = np.linspace(-0.6, 0.6, n) * (0.6 if soft else 1.0) * (1 if i % 2 == 0 else -1)
    th = (p + 1) * np.pi / 4
    out = np.stack([m * np.cos(th), m * np.sin(th)], axis=1) * np.sqrt(2)
    return fade(out, 0.02, 0.05)


@sfx('whoosh', trim=-2, send=0.1)
def _whoosh_hard(rng, dur, i):
    return _whoosh(rng, dur, i)


@sfx('whoosh_soft', trim=-3, send=0.1)
def _whoosh_soft(rng, dur, i):
    return _whoosh(rng, dur, i, soft=True)


@sfx('clock_tick', trim=-2, send=0.12)
def _clock_tick(rng, dur, i):
    n = nsamp(0.08)
    f = 3400 if i % 2 == 0 else 2700
    y = modal(n, [f, f * 1.47, f * 2.3], [0.012, 0.008, 0.005], [1, 0.5, 0.3], rng)
    y += 0.5 * modal(n, [900 if i % 2 == 0 else 760], [0.015], [1], rng)
    y += click(n, rng, tau=0.0008, hp=3000)
    return fade(y, 0.0002, 0.02)


@sfx('phone_on', trim=-2, send=0.1)
def _phone_on(rng, dur, i):
    n = nsamp(0.6)
    y = click(n, rng, tau=0.002, hp=1500) * 1.2 + modal(n, [2100], [0.02], [0.5], rng)
    i0 = nsamp(0.09)
    ch = np.zeros(n)
    m = n - i0
    tm = tt(m)
    ch[i0:] = (np.sin(2 * np.pi * midi_hz(nm('B6')) * tm) + 0.4 * np.sin(2 * np.pi * midi_hz(nm('E7')) * tm)) * \
        (1 - np.exp(-tm / 0.006)) * np.exp(-tm / 0.18)
    return fade(y + 0.35 * ch, 0.0003, 0.05)


@sfx('swipe', trim=-2, send=0.05)
def _swipe(rng, dur, i):
    n = nsamp(0.2)
    x = white(n, rng)
    y = tv_filter(x, np.linspace(3000, 6500, 16), np.full(16, 3000.0)) * hump(n, 0.4, 1.5)
    p = np.linspace(-0.4, 0.4, n) * (1 if i % 2 else -1)
    th = (p + 1) * np.pi / 4
    return fade(np.stack([y * np.cos(th), y * np.sin(th)], axis=1), 0.005, 0.02)


@sfx('tap', trim=-2, send=0.05)
def _tap(rng, dur, i):
    n = nsamp(0.08)
    t = tt(n)
    y = lpf(white(n, rng), 4000) * np.exp(-t / 0.003) + 0.7 * thud(n, 220, 140, tau=0.015)
    return fade(y, 0.0002, 0.01)


@sfx('scrape', trim=-3, send=0.08)
def _scrape(rng, dur, i):
    n = nsamp(0.55)
    t = tt(n)
    x = bpf(white(n, rng), 900, 5500)
    rasp = 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * rng.uniform(38, 55) * t)) * np.abs(lpf(white(n, rng), 300) * 3)
    y = x * rasp + 0.6 * bpf(x, 800, 1100)
    return fade(y * hump(n, 0.35, 1.0), 0.01, 0.04)


@sfx('knife', trim=0, send=0.12)
def _knife(rng, dur, i):
    n = nsamp(0.35)
    t = tt(n)
    hit = click(n, rng, tau=0.0012, hp=1800) * 2
    wood = modal(n, [620, 1430, 2350, 3900], [0.07, 0.045, 0.03, 0.02], [1, .7, .5, .35], rng)
    shave = bpf(white(n, rng), 3000, 7000) * np.exp(-np.maximum(t - 0.01, 0) / 0.05) * (t > 0.008) * 0.5
    return fade(hit + wood + shave, 0.0002, 0.05)


@sfx('pop', trim=-2, send=0.05)
def _pop(rng, dur, i):
    n = nsamp(0.12)
    t = tt(n)
    f = 350 + 800 * (1 - np.exp(-t / 0.02))
    y = sine_f(f) * np.exp(-t / 0.03) + 0.4 * click(n, rng, tau=0.0008)
    return fade(y, 0.0005, 0.02)


@sfx('marker', trim=-4, send=0.05)
def _marker(rng, dur, i):
    dur = dur or 0.5
    n = nsamp(dur)
    t = tt(n)
    x = bpf(white(n, rng), 1200, 4200)
    sq = np.sin(2 * np.pi * (2200 + 150 * np.sin(2 * np.pi * 7 * t)) * t) * 0.15
    y = (x * (0.7 + 0.3 * np.abs(lpf(white(n, rng), 40)) * 3) + sq) * hump(n, 0.2, 0.7)
    return fade(y, 0.01, 0.04)


@sfx('card', trim=-2, send=0.08)
def _card(rng, dur, i):
    n = nsamp(0.22)
    t = tt(n)
    flap = bpf(white(n, rng), 1500, 7000)
    e = np.exp(-t / 0.006) + 0.8 * np.exp(-np.maximum(t - 0.018, 0) / 0.008) * (t > 0.018)
    sw = tv_filter(white(n, rng), np.linspace(1500, 4500, 8), np.full(8, 2500.0)) * hump(n, 0.5, 2) * 0.4
    return fade(flap * e + sw, 0.0003, 0.02)


@sfx('stamp', trim=0, send=0.12)
def _stamp(rng, dur, i):
    n = nsamp(0.45)
    t = tt(n)
    low = thud(n, 120, 62, tau=0.07, glide=0.02) * 1.3
    slap = bpf(white(n, rng), 800, 4500) * np.exp(-t / 0.012) * 0.9
    knock = modal(n, [320, 780], [0.05, 0.03], [0.5, 0.25], rng)
    y = np.tanh(1.5 * (low + slap + knock))
    return fade(y, 0.0002, 0.05)


@sfx('pen_strike', trim=-3, send=0.05)
def _pen_strike(rng, dur, i):
    n = nsamp(0.26)
    x = white(n, rng)
    y = tv_filter(x, np.linspace(1800, 6000, 12), np.full(12, 2500.0))
    gr = 0.6 + 0.4 * np.abs(bpf(white(n, rng), 100, 400)) * 4
    return fade(y * gr * hump(n, 0.25, 1.0), 0.004, 0.03)


@sfx('chime', trim=-6, send=0.3)
def _chime(rng, dur, i):
    n = nsamp(2.2)
    out = np.zeros((n, 2))
    for k, (p, d) in enumerate([('D6', 0.0), ('A6', 0.06), ('F#6', 0.13), ('E7', 0.21)]):
        i0 = nsamp(d)
        b = bell_partials(n - i0, midi_hz(nm(p)), rng, decay=1.3, ratios=(1, 2.76, 5.4), amps=(1, .3, .1))
        out[i0:] += pan(b * (0.85 ** k), rng.uniform(-0.6, 0.6))
    return fade(out, 0.0005, 0.3)


@sfx('digit', trim=-3, send=0.0)
def _digit(rng, dur, i):
    n = nsamp(0.04)
    t = tt(n)
    y = np.sign(np.sin(2 * np.pi * 1600 * t)) * np.exp(-t / 0.012) * 0.6 + click(n, rng, tau=0.0005)
    return fade(lpf(y, 7000), 0.0003, 0.005)


DING_NOTES = ['A6', 'B6', 'D7', 'E7', 'F#7']


@sfx('ding', trim=-8, send=0.1)
def _ding(rng, dur, i):
    n = nsamp(0.7)
    t = tt(n)
    f = midi_hz(nm(DING_NOTES[i % len(DING_NOTES)]))
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.22) + 0.18 * np.sin(2 * np.pi * 3.0 * f * t) * np.exp(-t / 0.05)
    y *= 1 - np.exp(-t / 0.0008)
    return pan(fade(y, 0.0002, 0.1), [-0.4, 0.3, -0.2, 0.45, 0.0][i % 5])


@sfx('cash', trim=-3, send=0.15)
def _cash(rng, dur, i):
    n = nsamp(1.1)
    t = tt(n)
    drawer = thud(n, 160, 90, tau=0.05) + 0.5 * bpf(white(n, rng), 1500, 6000) * np.exp(-t / 0.03)
    i0 = nsamp(0.08)
    m = n - i0
    bells = np.zeros(n)
    bells[i0:] = modal(m, [2490, 3170, 4620, 6900], [0.5, 0.4, 0.25, 0.12], [1, .8, .4, .2], rng, beat=3.0)
    rat = np.zeros(n)
    for p in rng.integers(nsamp(0.05), nsamp(0.4), 12):
        L = nsamp(0.03)
        rat[p:p + L] += modal(L, [rng.uniform(4000, 8000)], [0.006], [0.3], rng)[:len(rat[p:p + L])]
    return fade(drawer + 0.7 * bells + rat, 0.0003, 0.2)


@sfx('freeze', trim=-3, send=0.25)
def _freeze(rng, dur, i):
    n = nsamp(1.4)
    t = tt(n)
    k = nsamp(0.14)
    sw = hpf(white(k, rng), 2500) * np.linspace(0, 1, k) ** 2
    y = np.zeros(n)
    y[:k] += sw * 0.8
    ice = np.zeros(n)
    for f in rng.uniform(3000, 9000, 14):
        ice += np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * rng.uniform(0.3, 1.0)
    env = np.where(t < 0.14, 0, np.exp(-np.maximum(t - 0.14, 0) / 0.45))
    y += 0.06 * ice * env
    y += 0.6 * thud(n, 90, 45, tau=0.25) * (t >= 0.14)
    return stereo_spread(fade(y, 0.003, 0.2), rng, 0.4)


@sfx('dislocate', trim=0, send=0.15)
def _dislocate(rng, dur, i):
    n = nsamp(0.7)
    t = tt(n)
    a = thud(n, 150, 70, tau=0.08) + 0.6 * click(n, rng, tau=0.002)
    b = np.zeros(n)
    i0 = nsamp(0.07)
    b[i0:] = (thud(n - i0, 141, 66, tau=0.08) + 0.5 * click(n - i0, rng, tau=0.002))
    slip = sine_f(900 - 300 * np.clip(t / 0.25, 0, 1)) * np.exp(-t / 0.12) * 0.25
    return np.stack([a + slip, 0.8 * b + slip], axis=1)


@sfx('bell', trim=-5, send=0.3)
def _bell(rng, dur, i):
    n = nsamp(3.0)
    f0 = midi_hz(nm('D6') if i % 2 == 0 else nm('A5'))
    y = bell_partials(n, f0, rng, decay=2.2, ratios=(0.5, 1.0, 1.19, 1.5, 2.0, 2.74), amps=(.35, 1, .4, .3, .35, .2))
    y += 0.4 * click(n, rng, tau=0.0008, hp=3000)
    return fade(y, 0.0002, 0.3)


@sfx('counter', trim=-4, send=0.0)
def _counter(rng, dur, i):
    dur = dur or 1.4
    n = nsamp(dur)
    y = np.zeros(n)
    x = np.linspace(0, 1, 28)
    times = dur * (x - 0.35 * np.sin(np.pi * x) / np.pi)   # fast in the middle
    for k, tk in enumerate(np.sort(times)):
        i0 = nsamp(tk)
        L = nsamp(0.025)
        if i0 + L > n:
            break
        f = 1400 * 2 ** (k / 40)
        y[i0:i0 + L] += np.sign(np.sin(2 * np.pi * f * tt(L))) * np.exp(-tt(L) / 0.008) * 0.5
    return fade(lpf(y, 8000), 0.001, 0.02)


@sfx('focus', trim=-3, send=0.05)
def _focus(rng, dur, i):
    n = nsamp(0.35)
    t = tt(n)
    whir = sine_f(900 + 500 * np.clip(t / 0.18, 0, 1)) * (1 + 0.5 * np.sign(np.sin(2 * np.pi * 120 * t)))
    k = nsamp(0.2)
    env = np.zeros(n)
    env[:k] = hump(k, 0.5, 1)
    y = 0.15 * lpf(whir * env, 3000)
    i0 = nsamp(0.21)
    y[i0:] += click(n - i0, rng, tau=0.001, hp=2500) * 1.2
    i1 = nsamp(0.245)
    y[i1:] += click(n - i1, rng, tau=0.0008, hp=3000) * 0.7
    return fade(y, 0.002, 0.03)


@sfx('stamp_x', trim=0, send=0.1)
def _stamp_x(rng, dur, i):
    n = nsamp(0.6)
    st = _stamp(rng, None, i)
    y = np.zeros(n)
    y[:len(st)] += st[:n]
    for k, (p, d) in enumerate([('B2', 0.05), ('F#2', 0.2)]):
        i0 = nsamp(d)
        L = nsamp(0.13)
        tl = tt(L)
        y[i0:i0 + L] += 0.35 * lpf(np.sign(np.sin(2 * np.pi * midi_hz(nm(p)) * tl)), 1800) * np.exp(-tl / 0.09)
    return fade(y, 0.0002, 0.05)


@sfx('dust', trim=-3, send=0.15)
def _dust(rng, dur, i):
    n = nsamp(1.0)
    t = tt(n)
    puff = lpf(white(n, rng), 1800) * (1 - np.exp(-t / 0.03)) * np.exp(-t / 0.3)
    grit = np.zeros(n)
    for p in rng.integers(0, nsamp(0.6), 30):
        L = 30
        grit[p:p + L] += rng.uniform(0.1, 0.4) * white(L, rng) * np.exp(-np.arange(L) / 6)
    return fade(puff + hpf(grit, 3000), 0.003, 0.1)


@sfx('copier', trim=-6, send=0.1)
def _copier(rng, dur, i):
    dur = dur or 4.6
    n = nsamp(dur)
    t = tt(n)
    hum = sum(a * np.sin(2 * np.pi * f * t) for f, a in [(100, 1), (200, .5), (300, .3), (400, .2), (600, .1)])
    hum = 0.25 * lpf(hum * (1 + 0.1 * np.sin(2 * np.pi * 3 * t)), 900)
    y = hum.copy()
    per = 1.15
    k = 0
    while k * per < dur - 0.3:
        i0 = nsamp(k * per)
        m = min(nsamp(0.95), n - i0)
        sw = tv_filter(white(m, rng), np.concatenate([np.linspace(800, 3000, 10), np.linspace(3000, 900, 10)]),
                       np.full(20, 1500.0)) * hump(m, 0.5, 1.2) * 0.6
        y[i0:i0 + m] += sw
        L = min(nsamp(0.15), n - i0)
        y[i0:i0 + L] += (thud(L, 150, 90, tau=0.03) + 0.5 * click(L, rng, hp=2000))
        k += 1
    e = np.clip(np.minimum(t / 0.1, (dur - t) / 0.3), 0, 1)
    return fade(y * e, 0.005, 0.05)


@sfx('coins', trim=-2, send=0.12)
def _coins(rng, dur, i):
    n = nsamp(1.2)
    out = np.zeros((n, 2))
    times = np.sort(rng.exponential(0.18, 16)) * 1.0
    for k, tk in enumerate(times):
        i0 = nsamp(min(tk, 0.9))
        L = n - i0
        f = rng.uniform(3200, 6200)
        c = modal(L, [f, f * 1.51, f * 2.27], [rng.uniform(0.05, 0.15), 0.05, 0.03], [1, .6, .4], rng)
        c += 0.3 * click(L, rng, tau=0.0006, hp=4000)
        out[i0:] += pan(c * rng.uniform(0.4, 1.0) * (0.92 ** k), rng.uniform(-0.6, 0.6))
    return fade(out, 0.0003, 0.1)


@sfx('low_tone', trim=0, send=0.2)
def _low_tone(rng, dur, i):
    n = nsamp(2.8)
    t = tt(n)
    y = np.sin(2 * np.pi * midi_hz(nm('D2')) * t) + 0.5 * np.sin(2 * np.pi * midi_hz(nm('A2')) * t)
    y += 0.25 * lpf(2 * ((midi_hz(nm('D2')) * t) % 1) - 1, 400)
    y += 0.3 * np.sin(2 * np.pi * midi_hz(nm('D3')) * t)
    e = (1 - np.exp(-t / 0.15)) * np.exp(-t / 1.1)
    return fade(y * e, 0.005, 0.3)


@sfx('book', trim=0, send=0.12)
def _book(rng, dur, i):
    n = nsamp(0.4)
    t = tt(n)
    f0 = rng.uniform(110, 150)
    y = thud(n, f0 * 1.6, f0, tau=0.05) + 0.6 * bpf(white(n, rng), 600, 4000) * np.exp(-t / 0.015)
    y += 0.25 * modal(n, [rng.uniform(380, 520)], [0.04], [1], rng)
    return fade(np.tanh(1.3 * y), 0.0002, 0.05)


@sfx('erase', trim=-4, send=0.05)
def _erase(rng, dur, i):
    n = nsamp(0.6)
    t = tt(n)
    x = bpf(white(n, rng), 600, 3500)
    rub = np.abs(np.sin(2 * np.pi * 9 * t)) ** 1.5
    return fade(x * rub * hump(n, 0.3, 0.8), 0.01, 0.05)


@sfx('slam', trim=0, send=0.15)
def _slam(rng, dur, i):
    n = nsamp(0.9)
    t = tt(n)
    low = thud(n, 90, 45, tau=0.12)
    clang = modal(n, [310, 467, 733, 1180, 1690, 2440], [0.3, 0.25, 0.18, 0.12, 0.08, 0.05],
                  [1, .8, .6, .5, .35, .25], rng)
    crack = hpf(white(n, rng), 2500) * np.exp(-t / 0.01)
    return fade(np.tanh(1.4 * (low + 0.6 * clang + crack)), 0.0002, 0.1)


@sfx('rush', trim=-6, send=0.1)
def _rush(rng, dur, i):
    dur = dur or 4.0
    n = nsamp(dur)
    x = np.linspace(0, 1, n)
    nz = np.stack([pink(n, rng), pink(n, rng)], axis=1)
    k = np.linspace(0, 1, 48)
    c = 400 * (6000 / 400) ** (k ** 1.2)
    y = np.stack([tv_filter(nz[:, 0], c, c * 1.5), tv_filter(nz[:, 1], c * 1.05, c * 1.5)], axis=1)
    flutter = 1 + 0.25 * np.sin(2 * np.pi * (3 + 6 * x) * x * dur)
    e = (x ** 1.8) * flutter
    e *= np.clip((1 - x) / 0.08, 0, 1)
    return fade(y * e[:, None], 0.05, 0.05)


@sfx('clack', trim=0, send=0.12)
def _clack(rng, dur, i):
    n = nsamp(0.35)
    y = np.zeros(n)
    for d, s in [(0.0, 1.0), (0.09, 0.8)]:
        i0 = nsamp(d)
        m = n - i0
        y[i0:] += s * (modal(m, [1250, 2900, 4300], [0.03, 0.02, 0.012], [1, .6, .3], rng) +
                       0.8 * click(m, rng, tau=0.001) + 0.5 * thud(m, 200, 120, tau=0.03))
    return fade(y, 0.0002, 0.04)


@sfx('sparkle', trim=-7, send=0.3)
def _sparkle(rng, dur, i):
    n = nsamp(1.2)
    out = np.zeros((n, 2))
    notes = ['D7', 'E7', 'F#7', 'A7', 'B7', 'D8']
    times = np.sort(rng.uniform(0, 0.55, 9) ** 1.3)
    for k, tk in enumerate(times):
        i0 = nsamp(tk)
        L = n - i0
        f = midi_hz(nm(rng.choice(notes)))
        p = np.sin(2 * np.pi * f * tt(L)) * np.exp(-tt(L) / rng.uniform(0.12, 0.3)) * (1 - np.exp(-tt(L) / 0.001))
        out[i0:] += pan(p * rng.uniform(0.5, 1.0) * (0.93 ** k), rng.uniform(-0.8, 0.8))
    air = hpf(white(n, rng), 6000) * hump(n, 0.15, 1) * 0.04
    return fade(out + to_stereo(air), 0.0005, 0.15)


@sfx('heartbeat', trim=3, send=0.05)
def _heartbeat(rng, dur, i):
    n = nsamp(0.5)

    def beat(m, f, a):
        tm = tt(m)
        return a * (sine_f(f + 30 * np.exp(-tm / 0.02)) * (1 - np.exp(-tm / 0.004)) * np.exp(-tm / 0.07) +
                    0.3 * lpf(white(m, rng), 180) * np.exp(-tm / 0.03))
    y = beat(n, 52, 1.0)
    i0 = nsamp(0.14)
    y[i0:] += beat(n - i0, 62, 0.7)
    y = np.tanh(2.2 * y)       # harmonics so it reads on small speakers
    return fade(y, 0.0005, 0.05)


@sfx('page_flip', trim=-2, send=0.1)
def _page_flip(rng, dur, i):
    n = nsamp(0.4)
    sw = tv_filter(white(n, rng), np.concatenate([np.linspace(900, 4500, 12), np.linspace(4500, 2500, 4)]),
                   np.full(16, 2500.0)) * hump(n, 0.6, 1.2)
    i0 = nsamp(0.28)
    snap = np.zeros(n)
    snap[i0:] = bpf(white(n - i0, rng), 1500, 7000) * np.exp(-tt(n - i0) / 0.01)
    y = sw + 0.9 * snap
    p = np.linspace(0.4, -0.4, n) * (1 if i % 2 else -1)
    th = (p + 1) * np.pi / 4
    return fade(np.stack([y * np.cos(th), y * np.sin(th)], axis=1), 0.005, 0.03)


@sfx('typing', trim=-4, send=0.06)
def _typing(rng, dur, i):
    dur = dur or 1.4
    n = nsamp(dur + 0.1)
    y = np.zeros(n)
    tk = 0.0
    while tk < dur:
        i0 = nsamp(tk)
        L = nsamp(0.05)
        if i0 + L > n:
            break
        m = bpf(white(L, rng), 1500, 5500) * np.exp(-tt(L) / 0.004) + 0.5 * thud(L, rng.uniform(350, 520), 300, tau=0.01)
        y[i0:i0 + L] += m * rng.uniform(0.5, 1.0)
        tk += rng.uniform(0.06, 0.14)
    return fade(y, 0.001, 0.03)


@sfx('pop_big', trim=-1, send=0.12)
def _pop_big(rng, dur, i):
    n = nsamp(0.6)
    t = tt(n)
    f = 200 + 600 * (1 - np.exp(-t / 0.04))
    y = (sine_f(f) + 0.3 * sine_f(2 * f)) * np.exp(-t / 0.07) + 0.4 * click(n, rng, tau=0.001)
    for d, p in [(0.07, 'A6'), (0.12, 'D7')]:
        i0 = nsamp(d)
        y[i0:] += 0.25 * np.sin(2 * np.pi * midi_hz(nm(p)) * tt(n - i0)) * np.exp(-tt(n - i0) / 0.12)
    return fade(y, 0.0003, 0.05)


@sfx('sticky', trim=-1, send=0.08)
def _sticky(rng, dur, i):
    n = nsamp(0.25)
    t = tt(n)
    slap = bpf(white(n, rng), 700, 5000) * np.exp(-t / 0.01)
    th = thud(n, rng.uniform(200, 260), 150, tau=0.025) * 0.6
    return pan(fade(slap + th, 0.0002, 0.03), [-0.3, 0.2, -0.1, 0.35, -0.35, 0.1][i % 6])


@sfx('wave', trim=-5, send=0.15)
def _wave(rng, dur, i):
    dur = dur or 2.2
    n = nsamp(dur)
    nz = np.stack([pink(n, rng), pink(n, rng)], axis=1)
    k = np.linspace(0, 1, 64)
    c = np.where(k < 0.6, 300 + 3200 * (k / 0.6) ** 1.4, 3500 - 2700 * ((k - 0.6) / 0.4))
    y = np.stack([tv_filter(nz[:, 0], c, c * 2), tv_filter(nz[:, 1], c * 0.95, c * 2)], axis=1)
    foam = hpf(white(n, rng), 4000) * np.abs(lpf(white(n, rng), 30)) * 6 * hump(n, 0.62, 3)
    e = hump(n, 0.6, 1.3)
    return fade(y * e[:, None] + 0.3 * to_stereo(foam), 0.05, 0.1)


@sfx('connect', trim=-3, send=0.2)
def _connect(rng, dur, i):
    dur = dur or 1.0
    n = nsamp(dur + 0.6)
    y = np.zeros(n)
    for k, p in enumerate(['D6', 'E6', 'F#6', 'A6', 'B6']):
        i0 = nsamp(k * dur * 0.13)
        L = n - i0
        y[i0:] += 0.6 * np.sin(2 * np.pi * midi_hz(nm(p)) * tt(L)) * np.exp(-tt(L) / 0.15) * (1 - np.exp(-tt(L) / 0.002))
    i0 = nsamp(dur * 0.7)
    y[i0:] += click(n - i0, rng, tau=0.001, hp=3000) + 0.4 * bell_partials(n - i0, midi_hz(nm('D7')), rng, decay=0.5)
    return stereo_spread(fade(y, 0.001, 0.1), rng, 0.3)


@sfx('tape_rip', trim=-3, send=0.08)
def _tape_rip(rng, dur, i):
    n = nsamp(0.5)
    t = tt(n)
    imp = (rng.random(n) < 0.06).astype(float) * rng.uniform(-1, 1, n)
    y = bpf(imp, 800, 8000) * 3 + 0.4 * bpf(white(n, rng), 1500, 6000)
    am = 0.6 + 0.4 * np.sin(2 * np.pi * 23 * t) ** 2
    e = np.clip(t / 0.01, 0, 1) * np.clip((0.5 - t) / 0.08, 0, 1)
    return fade(y * am * e, 0.0005, 0.02)


@sfx('gong', trim=-5, send=0.15)
def _gong(rng, dur, i):
    n = nsamp(8.0)
    t = tt(n)
    y = np.zeros(n)
    f0 = midi_hz(nm('D2'))
    freqs = np.sort(np.concatenate([[f0, f0 * 1.52, f0 * 2.01, f0 * 2.7], f0 * np.exp(rng.uniform(np.log(3), np.log(40), 46))]))
    for f in freqs:
        lf = np.log(f / f0)
        att = 0.004 + 0.12 * lf          # higher partials bloom later
        dec = 6.0 / (1 + 0.6 * lf)
        a = 1.0 / (1 + 1.3 * lf)
        env = (1 - np.exp(-t / att)) * np.exp(-t / dec)
        y += a * env * np.sin(2 * np.pi * f * (1 - 0.004 * np.exp(-t / 1.5)) * t + rng.uniform(0, 6))
    y += 2.0 * thud(n, 110, 60, tau=0.12) + 0.5 * lpf(white(n, rng), 500) * np.exp(-t / 0.05)
    y = lpf(y, 1500, 2)           # keep the bloom out of the consonant band
    out = stereo_spread(y, rng, 0.35, 11)
    return fade(out, 0.0005, 1.5)


@sfx('grow', trim=-10, send=0.25)
def _grow(rng, dur, i):
    dur = dur or 3.0
    n = nsamp(dur)
    x = np.linspace(0, 1, n)
    f = midi_hz(nm('D4')) * (midi_hz(nm('A5')) / midi_hz(nm('D4'))) ** (x ** 1.3)
    tone = sine_f(f) + 0.3 * sine_f(2 * f) + 0.15 * sine_f(3 * f)
    nz = tv_filter(pink(n, rng), np.linspace(400, 3000, 32), np.linspace(300, 2000, 32)) * 0.6
    e = hump(n, 0.8, 1.0)
    return stereo_spread(fade((0.5 * tone + nz) * e, 0.05, 0.15), rng, 0.3)


@sfx('copier_hit', trim=-1, send=0.1)
def _copier_hit(rng, dur, i):
    n = nsamp(0.5)
    y = thud(n, 160, 90, tau=0.04) + 0.6 * click(n, rng, tau=0.002, hp=1500)
    y += modal(n, [1800, 2700], [0.04, 0.03], [0.3, 0.2], rng)
    m = nsamp(0.4)
    i0 = nsamp(0.06)
    y[i0:i0 + m] += 0.5 * tv_filter(white(m, rng), np.linspace(1000, 4000, 8), np.full(8, 1500.0)) * hump(m, 0.5, 1)
    return fade(y, 0.0002, 0.04)


@sfx('scan', trim=-8, send=0.05)
def _scan(rng, dur, i):
    dur = dur or 0.9
    n = nsamp(dur)
    t = tt(n)
    f = 1800 + 600 * t / dur
    whine = sine_f(f) * (0.7 + 0.3 * np.sign(np.sin(2 * np.pi * 100 * t)))
    sw = bpf(white(n, rng), 2000, 6000) * 0.4
    y = (0.3 * lpf(whine, 5000) + sw) * hump(n, 0.5, 0.5)
    p = np.linspace(-0.6, 0.6, n)
    th = (p + 1) * np.pi / 4
    return fade(np.stack([y * np.cos(th), y * np.sin(th)], axis=1), 0.01, 0.03)


@sfx('error_hit', trim=0, send=0.08)
def _error_hit(rng, dur, i):
    n = nsamp(0.45)
    y = np.zeros(n)
    for d, f in [(0.0, midi_hz(nm('B2'))), (0.13, midi_hz(nm('F3')))]:
        i0 = nsamp(d)
        L = nsamp(0.12)
        tl = tt(L)
        sq = np.sign(np.sin(2 * np.pi * f * tl)) + np.sign(np.sin(2 * np.pi * f * 1.01 * tl))
        y[i0:i0 + L] += 0.4 * lpf(sq, 2500) * np.exp(-tl / 0.1)
    y += crush(white(n, rng), 3, 10) * np.exp(-tt(n) / 0.03) * 0.5
    y += thud(n, 120, 60, tau=0.05) * 0.6
    return fade(y, 0.0002, 0.04)


@sfx('brush', trim=-3, send=0.08)
def _brush(rng, dur, i):
    n = nsamp(0.5)
    x = white(n, rng)
    c = np.linspace(1500, 3500, 10) * rng.uniform(0.8, 1.2)
    y = tv_filter(x, c, c * 1.2)
    bristle = 0.6 + 0.4 * np.abs(bpf(white(n, rng), 150, 900)) * 3
    return pan(fade(y * bristle * hump(n, 0.3, 1.0), 0.02, 0.05), rng.uniform(-0.3, 0.3))


WOOD_NOTES = ['A5', 'D6', 'E6', 'B5', 'F#6']


@sfx('wood', trim=-1, send=0.15)
def _wood(rng, dur, i):
    n = nsamp(0.3)
    f0 = midi_hz(nm(WOOD_NOTES[i % len(WOOD_NOTES)])) * 0.5
    y = modal(n, [f0, f0 * 2.62, f0 * 4.1, f0 * 5.9], [0.06, 0.035, 0.02, 0.012], [1, .5, .3, .15], rng)
    y += 0.6 * click(n, rng, tau=0.0008, hp=2000)
    return pan(fade(y, 0.0002, 0.03), rng.uniform(-0.35, 0.35))


@sfx('merge_hit', trim=0, send=0.25)
def _merge_hit(rng, dur, i):
    n = nsamp(3.0)
    t = tt(n)
    boom = np.tanh(1.8 * thud(n, 80, 38, tau=0.6, glide=0.08))
    chord = np.zeros(n)
    for p in ['D5', 'A5', 'D6', 'F#6']:
        chord += bell_partials(n, midi_hz(nm(p)), rng, decay=1.8, ratios=(1, 2.0, 3.0), amps=(1, .3, .1))
    sh = hpf(white(n, rng), 6000) * np.exp(-t / 0.6) * 0.08
    y = boom + 0.2 * chord + sh + 0.5 * click(n, rng, tau=0.002, hp=1500)
    return stereo_spread(fade(y, 0.0003, 0.4), rng, 0.3)


@sfx('lens', trim=-3, send=0.05)
def _lens(rng, dur, i):
    n = nsamp(0.45)
    t = tt(n)
    f = 600 + 500 * np.clip(t / 0.35, 0, 1)
    whir = sine_f(f) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 60 * t))) + 0.4 * sine_f(2 * f)
    y = 0.25 * lpf(whir, 4000) * hump(n, 0.5, 1)
    i0 = nsamp(0.36)
    y[i0:] += click(n - i0, rng, tau=0.001, hp=2500)
    return fade(y, 0.003, 0.02)


@sfx('gather', trim=-4, send=0.25)
def _gather(rng, dur, i):
    dur = dur or 1.6
    n = nsamp(dur + 0.3)
    out = np.zeros((n, 2))
    notes = ['A6', 'B6', 'D7', 'E7', 'F#7', 'A7']
    x = np.sort(rng.uniform(0, 1, 40) ** 0.6) * dur
    for k, tk in enumerate(x):
        i0 = nsamp(tk)
        L = min(nsamp(0.3), n - i0)
        f = midi_hz(nm(rng.choice(notes)))
        p = np.sin(2 * np.pi * f * tt(L)) * np.exp(-tt(L) / 0.07) * (1 - np.exp(-tt(L) / 0.001))
        spread = 0.9 * (1 - tk / dur)
        out[i0:i0 + L] += pan(p * (0.3 + 0.7 * tk / dur), rng.uniform(-spread, spread))
    rise = tv_filter(pink(n, rng), np.linspace(800, 5000, 16), np.full(16, 2000.0)) * np.linspace(0, 1, n) ** 2 * 0.15
    i0 = nsamp(dur)
    whomp = np.zeros(n)
    whomp[i0:] = thud(n - i0, 160, 80, tau=0.08) * 0.5
    return fade(out + to_stereo(rise + whomp), 0.01, 0.1)


@sfx('blip_down', trim=-2, send=0.05)
def _blip_down(rng, dur, i):
    n = nsamp(0.15)
    t = tt(n)
    top = 1150 * 2 ** (-i / 14)
    f = top - (top * 0.6) * np.clip(t / 0.11, 0, 1)
    y = sine_f(f) * np.exp(-t / 0.05) * (1 - np.exp(-t / 0.001))
    return pan(fade(y, 0.0003, 0.02), 0.25 * np.sin(i))


@sfx('bad_flute', trim=-2, send=0.12)
def _bad_flute(rng, dur, i):
    dur = dur or 1.2
    n = nsamp(dur)
    t = tt(n)
    f0 = midi_hz(nm('E5')) * 2 ** (38 / 1200)       # ~40 cents sharp: out of tune
    drift = lpf(rng.standard_normal(n), 6)
    wob = 40 * drift / (np.std(drift) + 1e-9) + 30 * np.sin(2 * np.pi * 4.3 * t)
    sq = np.zeros(n)
    a0, a1 = nsamp(dur * 0.42), nsamp(dur * 0.42 + 0.11)
    sq[a0:a1] = 1210                                  # overblown squeak (octave + ~10 cents)
    sq = lpf(sq, 60)
    fall = -260 * np.clip((t - dur * 0.75) / (dur * 0.25), 0, 1) ** 1.5
    f = f0 * 2 ** ((wob + sq + fall) / 1200)
    tone = sine_f(f) + 0.55 * sine_f(2 * f) + 0.12 * sine_f(3 * f)
    fl = lpf(rng.standard_normal(n), 9)
    amp = 0.65 + 0.35 * np.clip(np.abs(fl) / (np.std(fl) + 1e-9) / 2, 0, 1)
    breath = bpf(white(n, rng), 1200, 6000) * 0.5
    e = np.clip(np.minimum(t / 0.06, (dur - t) / 0.15), 0, 1)
    y = (0.6 * tone * amp + breath * (0.6 + 0.4 * amp)) * e
    return fade(y, 0.01, 0.05)


@sfx('thermo_down', trim=-5, send=0.15)
def _thermo_down(rng, dur, i):
    dur = dur or 1.0
    n = nsamp(dur)
    t = tt(n)
    f = 1400 * (300 / 1400) ** (t / dur)
    y = (sine_f(f * (1 + 0.004 * np.sin(2 * np.pi * 6 * t))) + 0.3 * sine_f(2 * f)) * hump(n, 0.15, 0.8) * 0.6
    y += hpf(white(n, rng), 3000) * 0.12 * np.exp(-t / 0.5)
    return fade(y, 0.005, 0.08)


@sfx('machine_stop', trim=-1, send=0.12)
def _machine_stop(rng, dur, i):
    n = nsamp(1.3)
    t = tt(n)
    sp = np.clip(1 - t / 0.85, 0, 1) ** 1.4
    f = 18 + 92 * sp
    mot = sum(a * sine_f(f * k) for k, a in [(1, 1), (2, .6), (3, .4), (4, .25), (6, .15)])
    mot = lpf(mot, 1200) * (0.2 + 0.8 * sp) * 0.5
    i0 = nsamp(0.85)
    cl = np.zeros(n)
    cl[i0:] = modal(n - i0, [420, 980, 1650], [0.15, 0.1, 0.06], [1, .6, .4], rng) + thud(n - i0, 130, 70, tau=0.06)
    hiss = bpf(white(n, rng), 2000, 8000) * np.clip((t - 0.9) / 0.05, 0, 1) * np.exp(-np.maximum(t - 0.9, 0) / 0.2) * 0.3
    return fade(mot + cl + hiss, 0.005, 0.1)


@sfx('impact_big', trim=0, send=0.2)
def _impact_big(rng, dur, i):
    n = nsamp(3.5)
    t = tt(n)
    sub = thud(n, 60, 28, tau=1.0, glide=0.1)
    metal = modal(n, [210, 347, 529, 811, 1240, 1890, 2770], [0.9, 0.7, 0.55, 0.4, 0.3, 0.2, 0.12],
                  [1, .8, .7, .55, .4, .3, .2], rng, beat=1.5)
    crack = hpf(white(n, rng), 3000) * np.exp(-t / 0.015)
    tail = lpf(white(n, rng), 2500) * np.exp(-t / 0.9) * 0.2
    y = np.tanh(1.5 * (sub + 0.35 * metal)) + crack + tail
    return stereo_spread(fade(y, 0.0003, 0.5), rng, 0.3)


@sfx('message', trim=-4, send=0.1)
def _message(rng, dur, i):
    n = nsamp(0.45)
    y = np.zeros(n)
    for d, p in [(0.0, 'B6'), (0.07, 'E7')]:
        i0 = nsamp(d)
        L = n - i0
        tl = tt(L)
        f = midi_hz(nm(p))
        y[i0:] += (np.sin(2 * np.pi * f * tl) + 0.2 * np.sin(4 * np.pi * f * tl)) * np.exp(-tl / 0.12) * (1 - np.exp(-tl / 0.001))
    return pan(fade(y, 0.0003, 0.05), 0.2 if i % 2 else -0.2)


@sfx('sub_drop', trim=2, send=0.1)
def _sub_drop(rng, dur, i):
    n = nsamp(1.8)
    t = tt(n)
    f = 28 + 62 * np.exp(-t / 0.45)
    y = sine_f(f) * (1 - np.exp(-t / 0.005)) * np.exp(-t / 0.9)
    return fade(np.tanh(2.0 * y), 0.0005, 0.2)


# ------------------------------------------------------------------ build
TONAL = {'ding', 'bell', 'chime', 'message', 'cash', 'sparkle', 'blip_down', 'thermo_down', 'connect', 'pop',
         'pop_big', 'phone_on', 'digit', 'counter', 'gather', 'bloom', 'merge_hit', 'scan', 'freeze', 'focus', 'lens'}
SPEECH_PAD_DB = 4.0
_SPEECH = []


def speech_overlap(t, d):
    tot = 0.0
    for a, b in _SPEECH:
        tot += max(0.0, min(b, t + d) - max(a, t))
    return min(1.0, tot / max(d, 1e-6))


def build():
    cues = load_cues()
    _SPEECH[:] = [tuple(x) for x in cues['speech']]
    dur = cues['duration']
    n = int(round(dur * SR))
    dry = np.zeros((n, 2))
    send = np.zeros((n, 2))
    types = sorted({e['type'] for e in cues['sfx']})
    missing = [t for t in types if t not in GEN]
    assert not missing, f'no generator for {missing}'
    count = {}
    last_t = {}
    log = []
    for e in cues['sfx']:
        typ = e['type']
        k = count.get(typ, 0)
        count[typ] = k + 1
        rng = np.random.default_rng(zlib.crc32(f'{typ}:{k}'.encode()))
        x = GEN[typ](rng, e.get('dur'), k)
        x = to_stereo(np.asarray(x, dtype=np.float64))
        dens = 0.0
        # tonal 'pings' that land on running speech sit a little lower
        if typ in TONAL:
            dens -= SPEECH_PAD_DB * speech_overlap(e['t'], min(0.8, len(x) / SR))
        # density compensation: a rapid flurry of one type (the ding flood)
        # should not sum up louder than a single event: -3 dB per halving
        # of the inter-onset interval below 0.3 s
        if typ in last_t and e['t'] - last_t[typ] < 0.3:
            dens += 10 * np.log10(max(e['t'] - last_t[typ], 0.03) / 0.3)
        last_t[typ] = e['t']
        x = norm(x, db2a(-6.0)) * db2a(e['gain_db'] + TRIM[typ] + dens)
        t = e['t']
        if typ == 'reverse_swell':
            t = e['t'] + (e.get('dur') or 1.2) - len(x) / SR      # ends exactly at t + dur
        i = int(round(t * SR))
        j0, j1 = max(0, i), min(n, i + len(x))
        dry[j0:j1] += x[j0 - i:j1 - i]
        send[j0:j1] += SEND[typ] * x[j0 - i:j1 - i]
        log.append((t, typ, e['gain_db']))
    room = make_ir(rt60=1.1, predelay=0.012, damp=0.5, seed=77, length=1.5)
    wet = convolve(send, room) * 0.5
    out = dry + wet
    out = hpf(out, 25)
    write(os.path.join(BUILD, 'sfx.wav'), out)
    print(f'sfx.wav: {len(cues["sfx"])} events, {len(types)} types, peak {20 * np.log10(np.max(np.abs(out))):.1f} dBFS')
    return out


if __name__ == '__main__':
    build()
