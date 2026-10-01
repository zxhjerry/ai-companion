"""Score engine: beat grids anchored to the edit, per-section event capture,
MIDI writing (mido), FluidSynth rendering and numpy assembly into stems.

Each music section is rendered in isolation (its own MIDI files, its own
reverb tails) so cuts, tape-stops and silences can be applied to the whole
section including tails, and then summed into per-family stems.
"""
import hashlib
import os
import subprocess
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

import mido
import numpy as np

from common import (SR, BUILD, SF2, nsamp, db2a, read, lpf, hpf, bpf, eq, lpf0,
                    convolve, make_ir, ramp, to_stereo, nm)
import synths as S

WORK = os.path.join(BUILD, 'score_work')
TPB = 1920                 # ticks per quarter at fixed 120 bpm -> 0.26 ms per tick
SPT = 0.5 / TPB
FAMILIES = ['dizi', 'guzheng', 'piano', 'strings', 'pads', 'bells', 'perc', 'synth']

# --------------------------------------------------------------------------
# instrument table.  prog/bank are GeneralUser GS presets.
TRACKS = {
    # dizi: GeneralUser 'Tin Whistle' (bank 24) is pitch-stable (no baked-in
    # vibrato), so vibrato / slides / grace notes are all ours via pitch bend;
    # a membrane-buzz + breath layer is added in numpy (proc='dizi').
    'dizi':    dict(prog=75, bank=24, fam='dizi', pan=0.05, gain=0, ir='hall', send=0.30, proc='dizi', chans=(0, 1, 2)),
    'koto':    dict(prog=107, bank=0, fam='guzheng', pan=-0.30, gain=0, ir='hall', send=0.22, chans=(0, 1, 2)),
    'harp':    dict(prog=46, bank=0, fam='guzheng', pan=0.30, gain=-1, ir='hall', send=0.30),
    'piano':   dict(prog=0, bank=0, fam='piano', pan=0.0, gain=0, ir='hall', send=0.22, proc='piano'),
    'felt':    dict(prog=0, bank=0, fam='piano', pan=0.0, gain=1, ir='room', send=0.30, proc='felt'),
    'strings': dict(prog=49, bank=0, fam='strings', pan=0.0, gain=0, ir='hall', send=0.32),
    'violins': dict(prog=48, bank=0, fam='strings', pan=-0.2, gain=-1, ir='hall', send=0.30),
    'spicc':   dict(prog=48, bank=0, fam='strings', pan=0.15, gain=0, ir='room', send=0.25),
    'trem':    dict(prog=44, bank=0, fam='strings', pan=0.1, gain=-2, ir='hall', send=0.30),
    'cello':   dict(prog=42, bank=0, fam='strings', pan=-0.18, gain=0, ir='hall', send=0.25),
    'cbass':   dict(prog=43, bank=0, fam='strings', pan=0.12, gain=0, ir='hall', send=0.18),
    'pizz':    dict(prog=45, bank=0, fam='strings', pan=0.22, gain=0, ir='room', send=0.30),
    'horns':   dict(prog=60, bank=0, fam='strings', pan=-0.1, gain=-2, ir='hall', send=0.35),
    'choir':   dict(prog=52, bank=0, fam='pads', pan=0.0, gain=-2, ir='hall', send=0.40),
    'oohs':    dict(prog=53, bank=0, fam='pads', pan=0.0, gain=-2, ir='hall', send=0.40),
    'pad':     dict(prog=89, bank=0, fam='pads', pan=0.0, gain=-3, ir='hall', send=0.30),
    'celesta': dict(prog=8, bank=0, fam='bells', pan=0.25, gain=0, ir='hall', send=0.35),
    'mbox':    dict(prog=10, bank=0, fam='bells', pan=-0.15, gain=0, ir='hall', send=0.40),
    'glock':   dict(prog=9, bank=0, fam='bells', pan=0.3, gain=-4, ir='hall', send=0.30),
    'taiko':   dict(prog=116, bank=0, fam='perc', pan=0.0, gain=0, ir='room', send=0.25),
    'timp':    dict(prog=47, bank=0, fam='perc', pan=0.0, gain=0, ir='hall', send=0.25),
    'okit':    dict(prog=48, bank=0, fam='perc', pan=0.0, gain=-2, ir='hall', send=0.25, drum=True),   # orchestral kit
    'stab':    dict(prog=55, bank=0, fam='synth', pan=0.0, gain=-4, ir='room', send=0.15),           # orchestra hit
}

IRS = {}


def irs():
    if not IRS:
        IRS['hall'] = make_ir(rt60=2.6, predelay=0.024, damp=0.45, seed=101)
        IRS['room'] = make_ir(rt60=1.0, predelay=0.010, damp=0.55, seed=102, length=1.4)
        IRS['big'] = make_ir(rt60=5.5, predelay=0.040, damp=0.35, seed=103, bright=1.1)
        IRS['dark'] = make_ir(rt60=4.0, predelay=0.030, damp=0.85, seed=104, bright=0.5)
    return IRS


# --------------------------------------------------------------------------
class Grid:
    """Beat grid through anchor times.  Between consecutive anchors the tempo
    is fitted so an integer number of beats lands exactly on the next anchor
    (hits are always on a beat).  beat(b) -> seconds."""

    def __init__(self, anchors, bpm, nbeats=None):
        self.tt = [anchors[0]]
        self.bb = [0.0]
        for i, (a, b) in enumerate(zip(anchors, anchors[1:])):
            n = nbeats[i] if nbeats else max(1, int(round((b - a) * bpm / 60)))
            self.bb.append(self.bb[-1] + n)
            self.tt.append(b)
        self.spb0 = (self.tt[1] - self.tt[0]) / (self.bb[1] - self.bb[0]) if len(self.tt) > 1 else 60 / bpm
        self.spb1 = (self.tt[-1] - self.tt[-2]) / (self.bb[-1] - self.bb[-2]) if len(self.tt) > 1 else 60 / bpm

    def __call__(self, b):
        if b <= self.bb[0]:
            return self.tt[0] + (b - self.bb[0]) * self.spb0
        if b >= self.bb[-1]:
            return self.tt[-1] + (b - self.bb[-1]) * self.spb1
        return float(np.interp(b, self.bb, self.tt))

    def d(self, b, nb):
        """duration in seconds of nb beats starting at beat b"""
        return self(b + nb) - self(b)

    def spb(self, b):
        return self.d(b, 1.0)

    def info(self):
        return [(round(t, 3), b) for t, b in zip(self.tt, self.bb)]


# --------------------------------------------------------------------------
PCS = {'C': 0, 'C#': 1, 'D': 2, 'E': 4, 'F#': 6, 'G': 7, 'A': 9, 'B': 11}
CHORDS = {   # pentatonic-friendly colours (no leading tone, no G against F#)
    'D':   ['D', 'F#', 'A', 'E'],          # D add9
    'D6':  ['D', 'F#', 'A', 'B', 'E'],     # D 6/9
    'Bm':  ['B', 'D', 'F#', 'A'],          # Bm7
    'Bm11': ['B', 'D', 'F#', 'A', 'E'],
    'G':   ['G', 'B', 'D', 'A'],           # G add9
    'G69': ['G', 'B', 'D', 'E', 'A'],
    'A':   ['A', 'D', 'E', 'B'],           # A sus4 add9 (A11, no 3rd)
    'Asus2': ['A', 'B', 'E'],
    'Em':  ['E', 'A', 'B', 'D'],           # Em7sus4 (no G)
    'F#m': ['F#', 'A', 'E', 'B'],          # F#m11 (no 5)
}
ROOTS = {'D': 'D', 'D6': 'D', 'Bm': 'B', 'Bm11': 'B', 'G': 'G', 'G69': 'G', 'A': 'A', 'Asus2': 'A', 'Em': 'E', 'F#m': 'F#'}


def tones(ch, lo, hi):
    pcs = {PCS[p] for p in CHORDS[ch]}
    return [m for m in range(lo, hi + 1) if m % 12 in pcs]


def root(ch, octave=2):
    return PCS[ROOTS[ch]] + 12 * (octave + 1)


def voicing(ch, lo, hi, n=4, skip=1):
    """open-ish voicing: every `skip`+1-th chord tone from lo upward"""
    t = tones(ch, lo, hi)
    out = t[::skip + 1] if skip else t
    return out[:n]


# --------------------------------------------------------------------------
class Sec:
    def __init__(self, cue, speech, pre=2.5, post=7.0, gain_db=0.0, xfade=1.0):
        self.key = cue['key']
        self.cue = cue
        self.t0, self.t1 = cue['t0'], cue['t1']
        self.hits = cue['hits']
        self.bpm = cue['bpm']
        self.a = max(0.0, self.t0 - pre)
        self.b = self.t1 + post
        self.n = nsamp(self.b - self.a)
        self.ev = defaultdict(list)          # track -> [(t, prio, kind, data)]
        self.fx = defaultdict(dict)          # per-track overrides (gain/ir/send/pan)
        self.fam = {}                        # family -> stereo dry (numpy synths)
        self.snd = {}                        # (family, ir) -> stereo send
        self.ops = []                        # section envelope operations
        self.gain_db = gain_db
        self.xfade = xfade
        self.speech = [(a, b) for a, b in speech if b > self.a and a < self.b]
        self._rr = defaultdict(int)
        self.g = None

    # ---------------- helpers
    def speaking(self, t, pad=0.0):
        return any(a - pad <= t < b + pad for a, b in self.speech)

    def gaps(self, t_from=None, t_to=None, min_len=0.3):
        t_from = self.t0 if t_from is None else t_from
        t_to = self.t1 if t_to is None else t_to
        out = []
        cur = t_from
        for a, b in sorted(self.speech):
            if a > cur and a - cur >= min_len and a <= t_to:
                out.append((cur, a))
            cur = max(cur, b)
        if t_to - cur >= min_len:
            out.append((cur, t_to))
        return [(a, b) for a, b in out if a >= t_from]

    def chan(self, trk):
        chans = TRACKS[trk].get('chans', (0,))
        c = chans[self._rr[trk] % len(chans)]
        self._rr[trk] += 1
        return c

    # ---------------- midi events
    def note(self, trk, t, dur, p, vel, ch=None, human=0.0, seed=None):
        if isinstance(p, str):
            p = nm(p)
        if ch is None:
            if TRACKS[trk].get('drum'):
                ch = 9
            elif 'chans' in TRACKS[trk]:
                # bendable track: take the next round-robin channel, reset its bend
                ch = self.chan(trk)
                self.bend(trk, t - 0.004, 0.0, ch)
            else:
                ch = 0
        if human:
            rng = np.random.default_rng(seed if seed is not None else int(t * 1000) + p)
            t += rng.uniform(-human, human)
        vel = int(np.clip(round(vel), 1, 127))
        dur = max(dur, 0.02)
        self.ev[trk].append((t, 2, 'on', (ch, p, vel)))
        self.ev[trk].append((t + dur, 1, 'off', (ch, p)))

    def nb(self, trk, b, nbeats, p, vel, legato=0.98, **kw):
        g = self.g
        self.note(trk, g(b), g.d(b, nbeats) * legato, p, vel, **kw)

    def chord(self, trk, t, dur, ps, vel, roll=0.0, ch=None, vel_tilt=0.0):
        ps = [nm(p) if isinstance(p, str) else p for p in ps]
        for i, p in enumerate(sorted(ps)):
            self.note(trk, t + roll * i, dur - roll * i, p, vel + vel_tilt * i, ch=ch)

    def cc(self, trk, t, num, val, ch=None):
        chans = [ch] if ch is not None else ([9] if TRACKS[trk].get('drum') else TRACKS[trk].get('chans', (0,)))
        for c in chans:
            self.ev[trk].append((t, 0, 'cc', (c, num, int(np.clip(round(val), 0, 127)))))

    def cc_ramp(self, trk, t0, t1, num, v0, v1, step=0.04, ch=None, shape='lin'):
        n = max(2, int((t1 - t0) / step) + 1)
        for i, v in enumerate(ramp(n, v0, v1, shape)):
            self.cc(trk, t0 + (t1 - t0) * i / (n - 1), num, v, ch=ch)

    def expr(self, trk, pts, ch=None, step=0.04):
        """CC11 automation through [(t, value)] points"""
        for (ta, va), (tb, vb) in zip(pts, pts[1:]):
            self.cc_ramp(trk, ta, tb, 11, va, vb, step=step, ch=ch)

    def bend(self, trk, t, semis, ch, rng_semis=4.0):
        v = int(np.clip(round(semis / rng_semis * 8192), -8192, 8191))
        self.ev[trk].append((t, 0, 'pb', (ch, v)))

    def pedal(self, trk, t_down, t_up):
        self.cc(trk, t_down, 64, 127)
        self.cc(trk, t_up, 64, 0)

    # ---------------- expressive dizi
    def dizi(self, t, dur, p, vel=80, slide=0.0, slide_t=0.16, grace=None, grace_t=0.075,
             vib=0.22, vib_rate=5.6, vib_delay=0.28, fall=0.0, fall_t=0.2, swell=0.15,
             attack=0.10, trk='dizi', seed=0, end_level=0.75):
        """One dizi note with 倚音 (grace), 滑音 (slide, semitones from below
        (-) or above (+)), vibrato and breath-swell expression."""
        if isinstance(p, str):
            p = nm(p)
        rng = np.random.default_rng(seed + p + int(t * 100))
        if grace is not None:
            gp = nm(grace) if isinstance(grace, str) else grace
            gc = self.chan(trk)
            self.bend(trk, t - grace_t - 0.004, 0.0, gc)
            self.cc(trk, t - grace_t - 0.004, 11, 105, ch=gc)
            self.note(trk, t - grace_t, grace_t + 0.015, gp, vel * 0.9, ch=gc)
        ch = self.chan(trk)
        step = 0.011
        expressive = bool(slide) or bool(fall) or (vib and dur > vib_delay + 0.12)
        tail = 0.12 if expressive else 0.0
        tt = np.arange(t - 0.006, t + dur + tail, step) if expressive else np.array([t - 0.006])
        bend = np.zeros(len(tt))
        x = tt - t
        if slide:
            k = np.clip(x / slide_t, 0, 1)
            bend += slide * (1 - (1 - (1 - k) ** 2)) * (x < slide_t)
            bend[x < 0] = slide
        if vib and dur > vib_delay + 0.12:
            rate = vib_rate * (1 + 0.04 * np.sin(2 * np.pi * 0.7 * x + rng.uniform(0, 6)))
            ph = 2 * np.pi * np.cumsum(rate) * step
            depth = vib * np.clip((x - vib_delay) / 0.45, 0, 1)
            depth *= 1 + 0.15 * np.sin(2 * np.pi * 0.9 * x + rng.uniform(0, 6))
            bend += depth * np.sin(ph)
        if fall:
            k = np.clip((x - (dur - fall_t)) / fall_t, 0, 1)
            bend += fall * k ** 1.6
        for a, b in zip(tt, bend):
            self.bend(trk, a, b, ch)
        # expression: breathy attack, gentle swell, taper
        e0 = 70
        pts = [(t - 0.006, e0), (t + min(attack, dur * 0.4), 112)]
        if dur > 0.6:
            pts.append((t + dur * 0.55, min(127, 112 * (1 + swell))))
        pts.append((t + dur, 112 * end_level))
        self.expr(trk, pts, ch=ch, step=0.03)
        self.note(trk, t, dur, p, vel, ch=ch)

    def dizi_line(self, g, b0, notes, vel=80, legato=1.0, **kw):
        """notes: [(beat_offset, nbeats, pitch, {opts})] on grid g from beat b0"""
        for n in notes:
            bo, nbt, p = n[:3]
            opt = dict(kw)
            if len(n) > 3:
                opt.update(n[3])
            v = opt.pop('vel', vel)
            t = g(b0 + bo)
            d = g.d(b0 + bo, nbt) * opt.pop('legato', legato)
            self.dizi(t, d, p, v, **opt)

    # ---------------- guzheng / koto
    def koto(self, t, p, vel=70, dur=1.5, bend_to=None, bend_at=0.18, bend_t=0.14, vib=0.0, trk='koto'):
        """pluck; optional 按滑音 (press-bend to another pitch) and 揉弦 vibrato"""
        if isinstance(p, str):
            p = nm(p)
        ch = self.chan(trk)
        self.bend(trk, t - 0.003, 0.0, ch)
        if bend_to is not None or vib:
            step = 0.012
            tt = np.arange(t, t + dur, step)
            b = np.zeros(len(tt))
            if bend_to is not None:
                bt = (nm(bend_to) if isinstance(bend_to, str) else bend_to) - p
                k = np.clip((tt - t - bend_at) / bend_t, 0, 1)
                b += bt * (0.5 - 0.5 * np.cos(np.pi * k))
            if vib:
                x = tt - t
                b += vib * np.clip((x - 0.25) / 0.3, 0, 1) * np.sin(2 * np.pi * 5.0 * x)
            for a, v in zip(tt, b):
                self.bend(trk, a, v, ch)
        self.note(trk, t, dur, p, vel, ch=ch)

    def gliss(self, trk, t_start, t_end, ps, vel=60, vel_end=None, dur=1.2, accel=1.0):
        """glissando through pitch list; last note lands exactly at t_end"""
        ps = [nm(p) if isinstance(p, str) else p for p in ps]
        n = len(ps)
        vel_end = vel if vel_end is None else vel_end
        for i, p in enumerate(ps):
            x = i / max(1, n - 1)
            t = t_start + (t_end - t_start) * (x ** accel)
            v = vel + (vel_end - vel) * x
            ch = self.chan(trk) if 'chans' in TRACKS[trk] else None
            if ch is not None:
                self.bend(trk, t - 0.003, 0, ch)
            self.note(trk, t, dur, p, v, ch=ch)

    # ---------------- numpy audio
    def add(self, fam, t, x, pan=0.0, gain_db=0.0, ir=None, send=0.0):
        from common import pan as panf
        if x.ndim == 1:
            x = panf(x, pan)
        x = x * db2a(gain_db)
        buf = self.fam.setdefault(fam, np.zeros((self.n, 2), np.float32))
        i = nsamp(t - self.a)
        j0, j1 = max(0, i), min(self.n, i + len(x))
        if j1 <= j0:
            return
        buf[j0:j1] += x[j0 - i:j1 - i]
        if ir and send > 0:
            sb = self.snd.setdefault((fam, ir), np.zeros((self.n, 2), np.float32))
            sb[j0:j1] += send * x[j0 - i:j1 - i]

    # ---------------- envelope ops
    def op(self, *args):
        self.ops.append(args)


# --------------------------------------------------------------------------
def _setup_msgs(spec, chans):
    msgs = []
    for c in chans:
        if spec.get('drum'):
            msgs.append(mido.Message('program_change', channel=c, program=spec['prog']))
        else:
            msgs.append(mido.Message('control_change', channel=c, control=0, value=spec['bank']))
            msgs.append(mido.Message('control_change', channel=c, control=32, value=0))
            msgs.append(mido.Message('program_change', channel=c, program=spec['prog']))
        msgs.append(mido.Message('control_change', channel=c, control=7, value=100))
        msgs.append(mido.Message('control_change', channel=c, control=10, value=int(np.clip(64 + spec['pan'] * 63, 0, 127))))
        msgs.append(mido.Message('control_change', channel=c, control=11, value=110))
        msgs.append(mido.Message('control_change', channel=c, control=64, value=0))
        msgs.append(mido.Message('control_change', channel=c, control=1, value=0))
        # pitch bend range +/- 4 semitones (RPN 0)
        for cc_, v in [(101, 0), (100, 0), (6, 4), (38, 0), (101, 127), (100, 127)]:
            msgs.append(mido.Message('control_change', channel=c, control=cc_, value=v))
        msgs.append(mido.Message('pitchwheel', channel=c, pitch=0))
    return msgs


def write_midi(path, events, spec, t_off):
    mf = mido.MidiFile(ticks_per_beat=TPB)
    tr = mido.MidiTrack()
    mf.tracks.append(tr)
    chans = sorted({e[3][0] for e in events} | set(spec.get('chans', (0,)) if not spec.get('drum') else {9}))
    setup = _setup_msgs(spec, chans)
    for m in setup:
        tr.append(m.copy(time=0))
    evs = sorted(events, key=lambda e: (e[0], e[1]))
    last = 0
    first_tick = 4    # setup at tick 0, music from tick >= 4
    tmax = 0
    for t, prio, kind, d in evs:
        tk = max(first_tick, int(round((t - t_off) / SPT)))
        tmax = max(tmax, tk)
        if kind == 'on':
            m = mido.Message('note_on', channel=d[0], note=d[1], velocity=d[2])
        elif kind == 'off':
            m = mido.Message('note_off', channel=d[0], note=d[1], velocity=0)
        elif kind == 'cc':
            m = mido.Message('control_change', channel=d[0], control=d[1], value=d[2])
        elif kind == 'pb':
            m = mido.Message('pitchwheel', channel=d[0], pitch=d[1])
        tr.append(m.copy(time=tk - last))
        last = tk
    # pad so the renderer keeps going
    tr.append(mido.Message('control_change', channel=chans[0], control=7, value=100, time=int(0.5 / SPT)))
    mf.save(path)


def fluid_render(mid, wav):
    subprocess.run(['fluidsynth', '-ni', '-q', '-R', '0', '-C', '0', '-g', '0.8', '-r', str(SR),
                    '-O', 'float', '-T', 'wav', '-o', 'synth.polyphony=1024',
                    '-F', wav, SF2, mid], check=True, capture_output=True)
    return wav


def render_sections(secs, workers=4):
    """write all MIDI, render (cached by content hash), return {(sec,trk): wav}"""
    os.makedirs(WORK, exist_ok=True)
    jobs = {}
    for s in secs:
        for trk, evs in s.ev.items():
            if not any(e[2] == 'on' for e in evs):
                continue
            tmp = os.path.join(WORK, f'{s.key}__{trk}.mid')
            write_midi(tmp, evs, TRACKS[trk], s.a)
            h = hashlib.sha1(open(tmp, 'rb').read() + open(SF2, 'rb').read(4096)).hexdigest()[:12]
            wav = os.path.join(WORK, f'{s.key}__{trk}__{h}.wav')
            jobs[(s.key, trk)] = (tmp, wav)
    todo = [(m, w) for m, w in jobs.values() if not os.path.exists(w)]
    with ThreadPoolExecutor(workers) as ex:
        list(ex.map(lambda mw: fluid_render(*mw), todo))
    return {k: w for k, (m, w) in jobs.items()}, len(todo)


# --------------------------------------------------------------------------
def proc_track(x, kind, seed=0):
    if kind == 'felt':
        x = lpf(x, 1900, 2)
        x = eq(x, 'lowshelf', 220, 2.5)
        x = hpf(x, 45)
    elif kind == 'piano':
        x = hpf(x, 35)
        x = eq(x, 'highshelf', 6000, -2.0)
    elif kind == 'dizi':
        # membrane buzz (笛膜): saturated high band, follows the tone exactly
        pk = np.max(np.abs(x)) + 1e-9
        sat = np.tanh(3.2 * x / pk) * pk / 3.2
        buzz = bpf(sat - x * 0.95, 1800, 9000, 2)
        x = x + 0.55 * buzz
        # breath noise following the envelope
        env = lpf0(np.abs(x).mean(axis=1), 18)
        rng = np.random.default_rng(seed)
        br = bpf(rng.standard_normal(len(x)), 1400, 6500, 2) * env * 0.55
        x = x + np.stack([br, br * 0.9], axis=1)
        x = eq(x, 'peak', 2600, 1.5, 1.0)
        x = hpf(x, 180)
    else:
        x = hpf(x, 28)
    return x


def apply_ops(buf, sec):
    """apply envelope ops of a section to one stereo buffer (in place)."""
    a = sec.a
    n = len(buf)
    tvec = None

    def idx(t):
        return int(np.clip(nsamp(t - a), 0, n))

    for op in sec.ops:
        kind = op[0]
        if kind == 'fadeout':                      # ('fadeout', t_start, t_end)
            i0, i1 = idx(op[1]), idx(op[2])
            if i1 > i0:
                buf[i0:i1] *= ramp(i1 - i0, 1, 0, 'cos')[:, None]
            buf[i1:] = 0
        elif kind == 'fadein':
            i0, i1 = idx(op[1]), idx(op[2])
            buf[:i0] = 0
            if i1 > i0:
                buf[i0:i1] *= ramp(i1 - i0, 0, 1, 'cos')[:, None]
        elif kind == 'cut':                        # ('cut', t)
            i = idx(op[1])
            k = nsamp(0.004)
            j = max(0, i - k)
            buf[j:i] *= ramp(i - j, 1, 0, 'cos')[:, None]
            buf[i:] = 0
        elif kind == 'mute':                       # ('mute', t0, t1)
            i0, i1 = idx(op[1]), idx(op[2])
            k = nsamp(0.004)
            j = max(0, i0 - k)
            buf[j:i0] *= ramp(i0 - j, 1, 0, 'cos')[:, None]
            buf[i0:i1] = 0
            j1 = min(n, i1 + k)
            buf[i1:j1] *= ramp(j1 - i1, 0, 1, 'cos')[:, None]
        elif kind == 'tapestop':                   # ('tapestop', t, dur)
            buf[:] = S.tape_stop_warp(buf, idx(op[1]), op[2])
        elif kind == 'stutter':                    # ('stutter', t, slice, repeats, mute_until)
            t, sl, rep, until = op[1:]
            i = idx(t)
            L = nsamp(sl)
            src = buf[i - L:i].copy()
            seg = np.zeros((L * rep, 2))
            for r in range(rep):
                piece = src.copy()
                if r % 2:
                    piece = S.bitcrush(piece, bits=5, down=4 + r)
                e = np.ones(L)
                e[:nsamp(0.002)] = np.linspace(0, 1, nsamp(0.002))
                e[-nsamp(0.004):] = np.linspace(1, 0, nsamp(0.004))
                seg[r * L:(r + 1) * L] = piece * e[:, None] * (0.92 ** r)
            j1 = min(n, i + len(seg))
            buf[i:j1] = seg[:j1 - i]
            buf[j1:idx(until)] = 0
        elif kind == 'gain':                       # ('gain', [(t, dB), ...])
            if tvec is None:
                tvec = a + np.arange(n) / SR
            pts = op[1]
            g = np.interp(tvec, [p[0] for p in pts], [p[1] for p in pts])
            buf *= (10 ** (g / 20))[:, None]
    return buf


def assemble(sec, wavs):
    """-> {family: stereo float32 buffer of length sec.n starting at sec.a}"""
    IR = irs()
    fam = {k: v.astype(np.float64) for k, v in sec.fam.items()}
    snd = {k: v.astype(np.float64) for k, v in sec.snd.items()}
    for trk in sec.ev:
        key = (sec.key, trk)
        if key not in wavs:
            continue
        x = to_stereo(read(wavs[key]))
        if len(x) < sec.n:
            x = np.concatenate([x, np.zeros((sec.n - len(x), 2))])
        x = x[:sec.n]
        spec = dict(TRACKS[trk])
        spec.update(sec.fx.get(trk, {}))
        x = proc_track(x, spec.get('proc'), seed=sum(map(ord, trk)))
        x = x * db2a(spec['gain'])
        f = spec['fam']
        fam.setdefault(f, np.zeros((sec.n, 2)))
        fam[f] += x
        if spec.get('send', 0) > 0:
            k = (f, spec['ir'])
            snd.setdefault(k, np.zeros((sec.n, 2)))
            snd[k] += x * spec['send']
    for (f, ir), x in snd.items():
        fam.setdefault(f, np.zeros((sec.n, 2)))
        fam[f] += convolve(x, IR[ir])
    g = db2a(sec.gain_db)
    for f in fam:
        fam[f] *= g
        apply_ops(fam[f], sec)
    return fam
