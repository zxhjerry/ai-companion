"""Numpy instruments for the things General MIDI does badly: sub drones,
808s, supersaws, EDM drums, risers, vinyl, wobble pads, robotic arps.

Every function returns a mono float64 array at common.SR (or stereo where
noted) and takes an explicit `seed` when it uses noise.
"""
import numpy as np

from common import SR, nsamp, lpf, hpf, bpf, adsr, fade, midi_hz


def _t(n):
    return np.arange(n) / SR


def osc_phase(freq):
    """freq: scalar or per-sample array -> phase (radians)"""
    if np.isscalar(freq):
        return None
    return 2 * np.pi * np.cumsum(freq) / SR


def saw_blep(freq, n, phase0=0.0):
    """Band-limited-ish sawtooth via additive harmonics for scalar freq."""
    t = _t(n)
    out = np.zeros(n)
    k = 1
    while k * freq < SR * 0.45 and k < 60:
        out += ((-1) ** (k + 1)) * np.sin(2 * np.pi * k * freq * t + k * phase0) / k
        k += 1
    return out * (2 / np.pi)


def saw_var(freq_arr, phase0=0.0):
    """Sawtooth for a per-sample frequency array (naive + gentle LP)."""
    ph = (np.cumsum(freq_arr) / SR + phase0) % 1.0
    return 2 * ph - 1


def square_var(freq_arr, duty=0.5):
    ph = (np.cumsum(freq_arr) / SR) % 1.0
    return np.where(ph < duty, 1.0, -1.0)


def sine_var(freq_arr, phase0=0.0):
    return np.sin(2 * np.pi * np.cumsum(freq_arr) / SR + phase0)


# ------------------------------------------------------------ low end
def sub_drone(dur, freqs, amps=None, lfo_rate=0.07, lfo_depth=0.25, attack=2.0, release=2.0, seed=0, grit=0.0):
    """Slowly breathing low drone: sines + a little filtered saw."""
    rng = np.random.default_rng(seed)
    n = nsamp(dur)
    t = _t(n)
    amps = amps or [1.0] * len(freqs)
    out = np.zeros(n)
    for f, a in zip(freqs, amps):
        drift = 1 + 0.0015 * np.sin(2 * np.pi * rng.uniform(0.03, 0.08) * t + rng.uniform(0, 6))
        out += a * sine_var(f * drift * np.ones(n), rng.uniform(0, 6))
        if grit > 0:
            out += a * grit * lpf(saw_var(f * drift * np.ones(n)), f * 4, 2)
    lfo = 1 - lfo_depth * (0.5 + 0.5 * np.sin(2 * np.pi * lfo_rate * t + rng.uniform(0, 6)))
    env = np.minimum(1, np.minimum(t / max(attack, 1e-3), (dur - t) / max(release, 1e-3)))
    env = np.clip(env, 0, 1) ** 1.5
    return out * lfo * env / max(1e-9, sum(amps))


def sub_pulse(freq=55.0, dur=0.7, drop=0.25):
    """Single sub 'heart' pulse with slight pitch drop."""
    n = nsamp(dur)
    t = _t(n)
    f = freq * (1 + drop * np.exp(-t / 0.04))
    y = sine_var(f)
    env = (1 - np.exp(-t / 0.006)) * np.exp(-t / (dur * 0.35))
    return fade(y * env, 0.001, 0.05)


def bass808(dur, freq, glide_from=None, glide_t=0.08, drive=2.5, decay=None):
    n = nsamp(dur)
    t = _t(n)
    f = np.full(n, freq)
    if glide_from:
        f = freq + (glide_from - freq) * np.exp(-t / glide_t)
    f = f * (1 + 0.6 * np.exp(-t / 0.012))  # punchy pitch blip at the start
    y = sine_var(f)
    decay = decay or max(0.25, dur * 0.6)
    env = (1 - np.exp(-t / 0.002)) * np.exp(-t / decay)
    y = np.tanh(drive * y * env) / np.tanh(drive)
    y = lpf(y, 1800, 2)
    return fade(y, 0.001, 0.03)


def kick(f_hi=160, f_lo=48, dur=0.45, click=0.5, drive=1.6):
    n = nsamp(dur)
    t = _t(n)
    f = f_lo + (f_hi - f_lo) * np.exp(-t / 0.035)
    y = sine_var(f) * np.exp(-t / (dur * 0.38))
    rng = np.random.default_rng(11)
    cl = hpf(rng.standard_normal(n), 2500) * np.exp(-t / 0.004) * click * 0.5
    y = np.tanh(drive * (y + cl)) / np.tanh(drive)
    return fade(y, 0.0005, 0.02)


def soft_kick(dur=0.35):
    """felt / acoustic-ish soft kick for the hopeful march"""
    n = nsamp(dur)
    t = _t(n)
    f = 52 + 70 * np.exp(-t / 0.03)
    y = sine_var(f) * np.exp(-t / 0.11)
    rng = np.random.default_rng(12)
    y += 0.15 * lpf(rng.standard_normal(n), 900) * np.exp(-t / 0.012)
    return fade(y, 0.0008, 0.02)


def clap(seed=0, dur=0.35, tone=1400):
    rng = np.random.default_rng(seed)
    n = nsamp(dur)
    t = _t(n)
    nz = bpf(rng.standard_normal(n), tone * 0.6, tone * 3.2, 2)
    env = np.zeros(n)
    for k, d in enumerate([0.0, 0.011, 0.022, 0.031]):
        i = nsamp(d)
        env[i:] += (0.8 if k < 3 else 1.0) * np.exp(-(t[: n - i]) / (0.008 if k < 3 else 0.09))
    return fade(nz * env, 0.0005, 0.03)


def hat(seed=0, open_=False, dur=None):
    rng = np.random.default_rng(seed)
    dur = dur or (0.32 if open_ else 0.06)
    n = nsamp(dur)
    t = _t(n)
    nz = rng.standard_normal(n)
    # metallic: a few detuned squares + noise
    met = np.zeros(n)
    for f in [317, 421, 553, 709, 868, 1003]:
        met += np.sign(np.sin(2 * np.pi * f * 4.1 * t + rng.uniform(0, 6)))
    y = hpf(0.6 * nz + 0.25 * met, 7000, 2)
    y *= np.exp(-t / (0.09 if open_ else 0.014))
    return fade(y, 0.0003, 0.01)


def snare(seed=0, dur=0.25, tone=190):
    rng = np.random.default_rng(seed)
    n = nsamp(dur)
    t = _t(n)
    body = np.sin(2 * np.pi * tone * t * (1 + 0.2 * np.exp(-t / 0.01))) * np.exp(-t / 0.04)
    nz = bpf(rng.standard_normal(n), 1500, 9000) * np.exp(-t / 0.07)
    return fade(0.6 * body + 0.8 * nz, 0.0005, 0.02)


def shaker(seed=0, dur=0.09, accent=1.0):
    rng = np.random.default_rng(seed)
    n = nsamp(dur)
    t = _t(n)
    y = bpf(rng.standard_normal(n), 4500, 12000, 2)
    env = (t / 0.012) * np.exp(1 - t / 0.012)  # rounded swish
    return fade(y * env * accent, 0.0005, 0.01)


def tick(seed=0, freq=2400, dur=0.03, wood=True):
    rng = np.random.default_rng(seed)
    n = nsamp(dur)
    t = _t(n)
    y = np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.004)
    if wood:
        y += 0.5 * np.sin(2 * np.pi * freq * 0.53 * t) * np.exp(-t / 0.007)
    y += 0.3 * hpf(rng.standard_normal(n), 3000) * np.exp(-t / 0.0015)
    return fade(y, 0.0002, 0.005)


def crash(seed=0, dur=3.0, bright=1.0):
    rng = np.random.default_rng(seed)
    n = nsamp(dur)
    t = _t(n)
    y = hpf(rng.standard_normal(n), 3500, 2) * np.exp(-t / (dur * 0.33))
    y += 0.4 * bpf(rng.standard_normal(n), 400, 3500) * np.exp(-t / 0.18)
    return fade(y * bright, 0.0005, 0.2)


# ------------------------------------------------------------ synth voices
def supersaw(dur, midis, voices=7, detune=0.22, cutoff=5000, attack=0.005, release=0.15, seed=0, cutoff_env=None):
    """Classic trance/EDM supersaw chord (deliberately glossy-cheap)."""
    rng = np.random.default_rng(seed)
    n = nsamp(dur + release)
    out = np.zeros(n)
    for m in midis:
        f0 = midi_hz(m)
        for v in range(voices):
            dt = (v - (voices - 1) / 2) / ((voices - 1) / 2) * detune  # semitones
            f = f0 * 2 ** (dt / 12)
            out += saw_var(np.full(n, f), rng.uniform(0, 1)) * (1.0 if v == voices // 2 else 0.7)
    out /= (len(midis) * voices * 0.75)
    if cutoff_env is not None:
        # crude time-varying LP: crossfade between two filtered versions
        lo = lpf(out, cutoff * 0.25, 2)
        hi = lpf(out, cutoff, 2)
        e = np.interp(np.arange(n), np.linspace(0, n, len(cutoff_env)), cutoff_env)
        out = lo * (1 - e) + hi * e
    else:
        out = lpf(out, cutoff, 2)
    env = adsr(n, attack, 0.2, 0.85, release)
    return out * env


def pluck_synth(dur, midi, bright=4000, decay=0.18, wave='saw', seed=0):
    n = nsamp(dur)
    t = _t(n)
    f = midi_hz(midi)
    if wave == 'square':
        y = square_var(np.full(n, f), 0.5)
        y = lpf(y, 6000, 1)
    else:
        rng = np.random.default_rng(seed)
        y = 0.5 * saw_var(np.full(n, f), rng.uniform(0, 1)) + 0.5 * saw_var(np.full(n, f * 1.004), rng.uniform(0, 1))
    hi = lpf(y, bright, 2)
    lo = lpf(y, bright * 0.2, 2)
    e = np.exp(-t / (decay * 0.5))
    y = lo * (1 - e) + hi * e
    return fade(y * np.exp(-t / decay), 0.001, 0.02)


def robot_arp(dur, midi, seed=0):
    """cold, square-ish blip for the AI arpeggiator"""
    n = nsamp(dur)
    t = _t(n)
    f = midi_hz(midi)
    y = square_var(np.full(n, f), 0.25) * 0.6 + np.sin(2 * np.pi * 2 * f * t) * 0.3
    y = lpf(y, 3500, 2) * np.exp(-t / max(0.02, dur * 0.5))
    return fade(y, 0.0008, 0.006)


def warm_pad(dur, midis, attack=1.5, release=2.0, cutoff=1400, detune_c=7, seed=0, wobble=None, breath=0.0):
    """Analog-ish warm pad: 2 detuned saws + sine per note, low-passed.
    wobble: optional per-sample array of extra detune in cents (+/-)."""
    rng = np.random.default_rng(seed)
    n = nsamp(dur)
    t = _t(n)
    out = np.zeros(n)
    lfo = np.sin(2 * np.pi * 0.21 * t + rng.uniform(0, 6))
    for m in midis:
        f0 = midi_hz(m)
        for sgn in (-1, 1):
            c = sgn * detune_c + 2.5 * lfo * sgn
            if wobble is not None:
                c = c + sgn * wobble
            f = f0 * 2 ** (c / 1200)
            out += 0.5 * saw_var(f * np.ones(n), rng.uniform(0, 1))
        out += 0.6 * sine_var(np.full(n, f0), rng.uniform(0, 6))
    out = lpf(out, cutoff, 2)
    if breath > 0:
        out += breath * bpf(rng.standard_normal(n), 300, 3000) * 0.3
    env = np.clip(np.minimum(t / attack, (dur - t) / release), 0, 1)
    env = 0.5 - 0.5 * np.cos(np.pi * env)
    return out * env / max(1, len(midis))


def riser(dur, f0=200, f1=3000, noise=0.7, tone=0.35, seed=0, curve=2.5):
    """noise sweep + rising sine; ends at full level (cut by caller)"""
    rng = np.random.default_rng(seed)
    n = nsamp(dur)
    x = np.linspace(0, 1, n)
    env = x ** curve
    # noise: blend of band-limited layers whose mix rises with time
    nz = rng.standard_normal(n)
    lo = bpf(nz, 200, 1200)
    mid = bpf(nz, 900, 4000)
    hi = bpf(nz, 3500, 14000)
    nzm = lo * (1 - x) + mid * np.minimum(1, 2 * x) * (1 - x * 0.5) + hi * x ** 2
    f = f0 * (f1 / f0) ** (x ** 1.5)
    tn = sine_var(f) + 0.3 * sine_var(f * 1.5)
    y = noise * nzm + tone * tn
    return fade(y * env, 0.01, 0.004)


def reverse_cymbal(dur, seed=0):
    rng = np.random.default_rng(seed)
    n = nsamp(dur)
    t = _t(n)
    y = hpf(rng.standard_normal(n), 2500) * np.exp(-t / (dur * 0.35))
    y += 0.3 * bpf(rng.standard_normal(n), 500, 3000) * np.exp(-t / (dur * 0.2))
    y = y[::-1]
    return fade(y, 0.01, 0.003)


def vinyl(dur, seed=0, crackle_rate=9.0):
    rng = np.random.default_rng(seed)
    n = nsamp(dur)
    hiss = bpf(rng.standard_normal(n), 1500, 9000) * 0.05
    rumble = lpf(rng.standard_normal(n), 60, 2) * 0.15
    cr = np.zeros(n)
    k = rng.poisson(crackle_rate * dur)
    pos = rng.integers(0, n - 200, k)
    amp = rng.pareto(2.5, k) * 0.25 + 0.05
    for p, a in zip(pos, amp):
        L = rng.integers(8, 60)
        cr[p:p + L] += a * rng.standard_normal(L) * np.exp(-np.arange(L) / (L / 4))
    cr = bpf(cr, 900, 9000)
    # slow wow on hiss level
    y = hiss + rumble + cr
    return y


def shimmer(dur, midis, density=14, seed=0, decay=0.35):
    """sparkling high sine grains drawn from `midis` (stereo)"""
    rng = np.random.default_rng(seed)
    n = nsamp(dur)
    out = np.zeros((n, 2))
    k = int(density * dur)
    for _ in range(k):
        st = rng.uniform(0, dur)
        i = nsamp(st)
        L = nsamp(decay * 2.5)
        tt = np.arange(L) / SR
        f = midi_hz(rng.choice(midis))
        g = np.sin(2 * np.pi * f * tt) * np.exp(-tt / decay) * (1 - np.exp(-tt / 0.004))
        g *= rng.uniform(0.4, 1.0) * (0.3 + 0.7 * st / dur)
        p = rng.uniform(-0.8, 0.8)
        th = (p + 1) * np.pi / 4
        j1 = min(n, i + L)
        out[i:j1, 0] += g[: j1 - i] * np.cos(th)
        out[i:j1, 1] += g[: j1 - i] * np.sin(th)
    return out


def bitcrush(x, bits=6, down=6):
    q = 2 ** (bits - 1)
    y = np.round(x * q) / q
    if down > 1:
        idx = (np.arange(len(y)) // down) * down
        y = y[idx]
    return y


def stutter(x, slice_s, repeats, decay=0.85):
    L = nsamp(slice_s)
    sl = fade(x[:L], 0.001, 0.003)
    out = np.zeros(L * repeats + len(x))
    for r in range(repeats):
        out[r * L:(r + 1) * L] += sl * decay ** r
    return out[: L * repeats]


def tape_stop_warp(x, t_start_idx, dur_s):
    """Time-warp x (mono or stereo) so playback decelerates to 0 over dur_s
    from sample t_start_idx; returns array of same length, silent afterwards."""
    n = len(x)
    D = nsamp(dur_s)
    out = np.array(x, copy=True)
    i0 = t_start_idx
    if i0 >= n:
        return out
    k = np.arange(D)
    # speed 1 -> 0 (quadratic-ish), position = integral
    speed = (1 - k / D) ** 1.6
    pos = i0 + np.cumsum(speed)
    pos = np.clip(pos, 0, n - 2)
    seg_len = min(D, n - i0)
    src = np.arange(n)
    if x.ndim == 1:
        out[i0:i0 + seg_len] = np.interp(pos[:seg_len], src, x)
    else:
        for c in range(x.shape[1]):
            out[i0:i0 + seg_len, c] = np.interp(pos[:seg_len], src, x[:, c])
    # level falls with speed, as on a real deck
    g = np.ones(seg_len) * (0.3 + 0.7 * speed[:seg_len])
    g[-nsamp(0.02):] *= np.linspace(1, 0, nsamp(0.02))
    out[i0:i0 + seg_len] *= g if x.ndim == 1 else g[:, None]
    out[i0 + seg_len:] = 0
    return out


def breath_noise(n, seed=0):
    rng = np.random.default_rng(seed)
    return bpf(rng.standard_normal(n), 1200, 7000, 2)
