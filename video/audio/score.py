"""Original score for 《千锤百炼之后，最难，是被看见》.

Run:  BUILD=... python3 score.py  ->  $BUILD/music.wav + $BUILD/stems/*.wav

Two sonic worlds, one pitch set (D major / B minor pentatonic, D E F# A B):
  slow world  : dizi (tin-whistle samples + membrane/breath processing,
                pitch-bend vibrato, 倚音 grace notes, 滑音 slides), guzheng
                (koto with 按滑 press-bends), felt/grand piano, strings, choir.
  fast world  : deliberately cheap EDM/trap built in numpy (808, supersaw,
                sidechain pump, stutters, robotic arps).

Main theme (dizi, 1 = D):  | 5. 6 3' - | 2' 1'2' 6 - | 5 6 1' 2' 3'2' | 1'6 5 - - |
                           | 5. 6 3'. 5' | 3' 2'1' 2' - | 6 5 3 5 6 1' | 2' 1' - - |
seeded in `open`, fragments in `craft`, B-minor reharmonised on cello+piano in
`painter` (cut by the AI glitch), full statements in `merge` and `timbre`,
softened in `climax`, and its head is the last thing heard in `finale`.

Every section is laid on a beat grid (score_engine.Grid) whose tempo is fitted
so cue hits fall exactly on beats.
"""
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (SR, BUILD, nsamp, db2a, load_cues, write, midi_hz, nm, env_points, fade, ramp)
import synths as S
from score_engine import (Sec, Grid, tones, root, voicing, render_sections, assemble, FAMILIES)

N = nm
CUES = load_cues()
SPEECH = CUES['speech']
DUR = CUES['duration']
SFX_T = {}
for e in CUES['sfx']:
    SFX_T.setdefault(e['type'], []).append(e['t'])


def hz(p):
    return midi_hz(N(p) if isinstance(p, str) else p)


# ------------------------------------------------------------------ theme
THEME = [
    (0.0, 1.5, 'A4', dict(slide=-2, slide_t=0.2)),
    (1.5, 0.5, 'B4', {}),
    (2.0, 2.0, 'F#5', dict(grace='E5', vib=0.25)),
    (4.0, 1.0, 'E5', {}),
    (5.0, 0.5, 'D5', {}),
    (5.5, 0.5, 'E5', {}),
    (6.0, 2.0, 'B4', dict(fall=-0.5, fall_t=0.25)),
    (8.0, 1.0, 'A4', {}),
    (9.0, 0.5, 'B4', {}),
    (9.5, 0.5, 'D5', {}),
    (10.0, 1.0, 'E5', dict(grace='F#5', grace_t=0.06)),
    (11.0, 0.5, 'F#5', {}),
    (11.5, 0.5, 'E5', {}),
    (12.0, 0.5, 'D5', {}),
    (12.5, 0.5, 'B4', {}),
    (13.0, 3.0, 'A4', dict(vib=0.26, swell=0.2, end_level=0.5)),
    (16.0, 1.5, 'A4', dict(slide=-2, slide_t=0.18)),
    (17.5, 0.5, 'B4', {}),
    (18.0, 1.5, 'F#5', dict(grace='E5')),
    (19.5, 0.5, 'A5', dict(grace='B5', grace_t=0.06)),
    (20.0, 1.0, 'F#5', {}),
    (21.0, 0.5, 'E5', {}),
    (21.5, 0.5, 'D5', {}),
    (22.0, 2.0, 'E5', dict(slide=-2, slide_t=0.25, vib=0.24)),
    (24.0, 1.0, 'B4', {}),
    (25.0, 0.5, 'A4', {}),
    (25.5, 0.5, 'F#4', {}),
    (26.0, 1.0, 'A4', {}),
    (27.0, 0.5, 'B4', {}),
    (27.5, 0.5, 'D5', {}),
    (28.0, 1.0, 'E5', dict(grace='F#5', grace_t=0.06)),
    (29.0, 3.0, 'D5', dict(vib=0.24, end_level=0.45)),
]
THEME_HARM = [(0, 'D'), (4, 'Bm'), (8, 'G'), (12, 'A'), (16, 'D'), (20, 'Bm'), (24, 'G'), (26, 'Em'), (28, 'A'), (29, 'D')]


def theme(b_from, b_to, transpose=0):
    out = []
    for b, d, p, o in THEME:
        if b_from <= b < b_to:
            out.append((b - b_from, d, N(p) + transpose, dict(o)))
    return out


def harm_at(plan, b):
    c = plan[0][1]
    for bb, ch in plan:
        if bb <= b:
            c = ch
    return c


# --------------------------------------------------------- accompaniment
def piano_flow(s, g, b0, b1, ch, vel=48, trk='piano', top=None, oct_=2, pat=(0, 2, 4, 5, 6, 5, 4, 2), step=0.5,
               pedal=True, rh_vel=None, human=0.008):
    """broken-chord 8ths: bass root then chord tones over ~1.5 octaves"""
    r = root(ch, oct_)
    t = [r] + tones(ch, r + 7, r + 26)
    k = 0
    b = b0
    while b < b1 - 1e-6:
        p = t[pat[k % len(pat)] % len(t)]
        v = vel + (6 if k % len(pat) == 0 else 0) - 3 * (k % 2)
        s.note(trk, g(b), g.d(b, min(step * 2.5, b1 - b + 0.05)), p, v, human=human if b > b0 else 0)
        k += 1
        b += step
    if top is not None:
        s.note(trk, g(b0), g.d(b0, b1 - b0), N(top), rh_vel or vel + 4)
    if pedal:
        s.pedal(trk, g(b0) + 0.03, g(b1) - 0.03)


def pad(s, trk, g, b0, b1, ps, vel=60, legato=1.02, expr=None):
    ps = [N(p) if isinstance(p, str) else p for p in ps]
    for p in ps:
        s.note(trk, g(b0), g.d(b0, b1 - b0) * legato, p, vel)
    if expr:
        s.expr(trk, [(g(bb), v) for bb, v in expr])


def koto_ost(s, g, b0, b1, ch, vel=60, lo=57, hi=78, pat=(0, 2, 4, 2, 3, 2, 4, 2), step=0.5, accent=8, dur=0.9,
             vel_to=None):
    t = tones(ch, lo, hi)
    k = 0
    b = b0
    tot = max(1, int(round((b1 - b0) / step)))
    while b < b1 - 1e-6:
        p = t[pat[k % len(pat)] % len(t)]
        v = vel if vel_to is None else vel + (vel_to - vel) * k / tot
        v += 8 if k % accent == 0 else 0
        s.koto(g(b), p, v, dur=dur)
        k += 1
        b += step


def tutti(s, t, bass, chord, vel=110, cymbal=True, dur=0.6, taiko=True, crash_db=None):
    """fast-attack orchestral hit exactly at t: timpani, taiko, string stab
    (with its own low octave) and concert cymbal.  Piano / sustained bass are
    left to the calling section so no two notes of one pitch collide."""
    b = N(bass) if isinstance(bass, str) else bass
    s.note('timp', t, 1.8, b + 12 if b < N('F#1') + 12 else b, vel)
    if taiko:
        s.note('taiko', t, 1.5, 'D2', min(127, vel + 6))
    s.chord('sstab', t, dur, [b + 12 if b < N('E1') + 12 else b] + list(chord), min(127, vel))
    s.cc('sstab', t - 0.01, 11, 127)
    if cymbal:
        s.note('okit', t, 3.0, 59, min(127, vel))
    if crash_db is not None:
        s.add('perc', t, S.crash(seed=int(t * 10), dur=3.0), gain_db=crash_db)


# ============================================================== sections
def c_open(s):
    h = s.hits
    # low D drone (D1/D2/A2), breathing; recedes before the quiet line
    dr = S.sub_drone(14.8, [hz('D1'), hz('D2'), hz('A2')], [1.0, 0.6, 0.15], attack=3.0, release=2.2, grit=0.06, seed=1)
    dr = dr * db2a(env_points(len(dr), [(0, 0), (s.hits['被看见'] - 0.4, 0), (s.hits['被看见'] + 0.3, -7), (14.8, -7)]))
    s.add('synth', 0.0, dr, gain_db=-17, ir='big', send=0.12)
    # breath -> solo dizi long note: scoop from F#4 into A4, vibrato, soft fall
    s.dizi(0.62, 2.45, 'A4', vel=74, slide=-3, slide_t=0.42, vib=0.2, vib_delay=0.7, fall=-1.0, fall_t=0.4,
           attack=0.5, end_level=0.35)
    # 最难: dark low hit
    t = h['最难']
    s.chord('piano', t, 3.2, ['D1', 'D2', 'A2'], 84)
    s.pedal('piano', t + 0.02, t + 1.6)
    s.note('cbass', t, 1.6, 'D2', 100)
    s.expr('cbass', [(t, 127), (t + 1.5, 30)])
    s.note('timp', t, 1.5, 'D2', 72)
    # 被看见: warm D-major bloom
    t = h['被看见']
    pad(s, 'strings', Grid([t - 0.2, t + 4], 60), 0, 3.2, ['D3', 'A3', 'E4', 'F#4', 'A4'], 72)
    s.expr('strings', [(t - 0.2, 35), (t + 0.5, 118), (t + 2.2, 92), (t + 3.2, 55)])
    s.gliss('harp', t, t + 0.42, ['D3', 'A3', 'D4', 'E4', 'F#4', 'A4', 'D5'], vel=80, vel_end=74, dur=2.5)
    s.chord('piano', t, 3.0, ['D2', 'A2', 'F#4', 'A4', 'E5'], 66, roll=0.012)
    s.note('celesta', t, 2.0, 'F#6', 50)
    s.pedal('piano', t + 0.02, t + 3.0)
    s.chord('oohs', t + 0.05, 2.6, ['D4', 'F#4', 'A4'], 55)
    s.expr('oohs', [(t, 30), (t + 0.8, 100), (t + 2.6, 40)])
    # dizi seeds the theme head in the gap after 是被看见 (5 6 | 3')
    s.dizi(9.32, 0.40, 'A4', vel=66, slide=-2, slide_t=0.15)
    s.dizi(9.73, 0.22, 'B4', vel=64)
    s.dizi(9.96, 1.55, 'F#5', vel=70, grace='E5', vib=0.24, vib_delay=0.3, end_level=0.25)
    # 遗憾: shade to B minor, low and soft
    t = 10.7
    pad(s, 'strings', Grid([t, t + 4], 60), 0, 3.4, ['B2', 'F#3', 'A3', 'D4'], 52)
    s.expr('strings', [(t, 30), (t + 1.0, 70), (t + 3.4, 25)])
    s.chord('piano', 10.8, 2.6, ['B1', 'B2'], 40)
    # 太安静了: near silence - only a faint, high, still tone
    x = S.warm_pad(3.6, [N('A5'), N('E6')], attack=1.3, release=1.6, cutoff=3000, detune_c=3, seed=2)
    s.add('pads', h['quiet_start'] - 0.2, x, gain_db=-34, ir='big', send=0.3)
    # inhale into the drop: reverse cymbal ending exactly at 18.275
    rc = S.reverse_cymbal(0.62, seed=3)
    s.add('perc', s.t1 - 0.62, rc, gain_db=-24)
    s.op('cut', s.t1)


def c_loud(s):
    h = s.hits
    g = Grid([s.t0, h['stop']], 140, nbeats=[8])
    s.g = g
    L = s.t1 - s.t0 + 1.0
    n = nsamp(L)
    bus = np.zeros(n)
    hats = np.zeros(n)

    def put(buf, t, x, gdb=0.0):
        i = nsamp(t - s.t0)
        j = min(n, i + len(x))
        if j > i:
            buf[i:j] += db2a(gdb) * x[:j - i]

    # distorted 808 (beat, beats, pitch, glide-from)
    pat = [(0, 1.5, 'D1', None), (1.5, 0.5, 'D1', None), (2.0, 0.75, 'D2', 'D1'), (3.0, 0.5, 'A1', None),
           (3.5, 0.5, 'B1', 'A1'), (4, 1.0, 'D1', None), (5.0, .25, 'D1', None), (5.25, .25, 'D1', None),
           (5.5, .25, 'D2', None), (5.75, .25, 'D1', None), (6.0, 0.5, 'F#1', None), (6.5, 0.5, 'A1', 'F#1'),
           (7.0, 1.0, 'B1', 'D2')]
    for b, d, p, gl in pat:
        x = S.bass808(g.d(b, d) + 0.05, hz(p), glide_from=hz(gl) if gl else None, drive=3.5, decay=0.5)
        put(bus, g(b), x, -3)
    for b in (0, 4):
        put(bus, g(b), S.kick(f_hi=180, f_lo=50, dur=0.35, click=0.9), -4)
    for b in (2, 6):
        put(bus, g(b), S.clap(seed=int(b)), -6)
        put(bus, g(b), S.snare(seed=int(b) + 9), -9)
    # trap hats: 8ths with 32nd / triplet rolls
    hb = []
    b = 0.0
    while b < 8 - 1e-6:
        if 3.5 <= b < 4.0:
            hb += [b + k * 0.125 for k in range(4)]
        elif 6.5 <= b < 7.0:
            hb += [b + k / 6 for k in range(3)]
        elif 7.0 <= b < 8.0:
            hb += [b + k * 0.0625 for k in range(16)]
        else:
            hb.append(b)
        b += 0.5
    for i, bb in enumerate(hb):
        put(hats, g(bb), S.hat(seed=i), -12 + (2 if bb % 1 == 0 else 0))
    # glossy supersaw stabs: Bm then G, stuttered gate at the end
    st = np.zeros(n)
    for b, ch in [(0, ['B3', 'D4', 'F#4', 'B4']), (4, ['G3', 'B3', 'D4', 'G4'])]:
        x = S.supersaw(g.d(b, 0.4), [N(p) for p in ch], cutoff=6500, release=0.08, seed=int(b))
        put(st, g(b), x, -6)
    for k in range(8):   # 16th stutter of the Bm stab, beat 6.0 -> 8.0
        bb = 6.0 + k * 0.25
        x = S.supersaw(g.d(bb, 0.14), [N('B3'), N('D4'), N('F#4'), N('B4')], cutoff=5000 + 400 * k, release=0.01,
                       seed=40 + k)
        put(st, g(bb), x, -9 + k * 0.5)
    st = S.bitcrush(st, bits=8, down=2) * 0.8 + st * 0.2
    mix = np.tanh(1.3 * (bus + st)) * 0.8 + hats
    s.add('synth', s.t0, mix, gain_db=-2, ir='room', send=0.08)
    s.op('tapestop', h['stop'], 0.6)
    s.op('cut', h['stop'] + 0.6)


NIGHT_V = {   # felt piano: (left hand, right hand)
    'G': (['G1', 'D2'], ['A3', 'B3', 'E4']),
    'F#m': (['F#1', 'E2'], ['A3', 'B3', 'E4']),
    'Bm': (['B1', 'F#2'], ['A3', 'D4', 'F#4']),
    'A': (['A1', 'E2'], ['B3', 'D4', 'E4']),
    'D': (['D2', 'A2'], ['F#3', 'A3', 'E4']),
}
NIGHT_TOP = {'G': 'B4', 'F#m': 'A4', 'Bm': 'F#4', 'A': 'E4', 'D': 'F#4'}


def felt_bar(s, g, b, ch, vel=40, top=True):
    lh, rh = NIGHT_V[ch]
    s.chord('felt', g(b), g.d(b, 3.9), lh, vel + 6, roll=0.02)
    s.chord('felt', g(b + 0.5) + 0.025, g.d(b + 0.5, 3.4), rh, vel, roll=0.035)
    if top:
        s.note('felt', g(b + 2.5) + 0.02, g.d(b + 2.5, 1.4), N(NIGHT_TOP[ch]) + 12, vel - 6)
    s.note('felt', g(b + 3.5) + 0.02, g.d(b + 3.5, 0.6), N(rh[1]), vel - 10)
    s.pedal('felt', g(b) + 0.03, g(b + 4) - 0.04)


def c_night(s):
    h = s.hits
    s.fx['felt'] = dict(gain=5)
    g1 = Grid([s.t0, h['quote_in']], 70, nbeats=[16])
    for i, ch in enumerate(['G', 'F#m', 'Bm', 'A']):
        felt_bar(s, g1, i * 4, ch, vel=40 + 2 * i)
    # rare koto plucks in the gaps (按滑音: press-bend up a tone)
    s.koto(30.05, 'A4', 58, dur=1.6, bend_to='B4', bend_at=0.22, bend_t=0.18)
    s.koto(36.56, 'D5', 54, dur=1.8, vib=0.15)
    # the quote: thin to a held pad (Bm11 -> G add9 at the breath)
    t = h['quote_in']
    s.chord('felt', t, 3.0, ['B1', 'B2'], 34)
    s.pedal('felt', t + 0.02, t + 3.0)
    x = S.warm_pad(6.4, [N(p) for p in ['B2', 'F#3', 'A3', 'D4', 'E4']], attack=1.6, release=1.4, cutoff=1100, seed=5)
    s.add('pads', t, x, gain_db=-19, ir='hall', send=0.35)
    x = S.warm_pad(6.6, [N(p) for p in ['G2', 'D3', 'A3', 'B3', 'E4']], attack=1.2, release=1.6, cutoff=1000, seed=6)
    s.add('pads', 42.7, x, gain_db=-20, ir='hall', send=0.35)
    # after the quote: koto answers, piano returns warmer
    s.koto(47.85, 'D5', 60, dur=1.0)
    s.koto(48.12, 'B4', 56, dur=1.0)
    s.koto(48.40, 'A4', 58, dur=2.0, vib=0.18)
    g3 = Grid([h['quote_out'], s.t1], 70, nbeats=[12])
    for i, ch in enumerate(['D', 'Bm', 'G']):
        felt_bar(s, g3, i * 4, ch, vel=42 + 2 * i, top=(i != 1))
    # vinyl bed through the whole scene
    v = S.vinyl(s.t1 - s.t0 + 1.2, seed=7)
    v = fade(v, 1.5, 1.2)
    s.add('synth', s.t0, v, gain_db=-28)
    s.op('wow', 2.4, 0.55)
    s.op('fadeout', s.t1, s.t1 + 1.0)


def c_craft(s):
    h = s.hits
    g = Grid([s.t0, h['triptych'], h['list'], h['calm'], s.t1], 76, nbeats=[8, 16, 12, 5])
    s.g = g
    # seg1: D add9 | Bm7, flowing piano, strings pad blooms in
    piano_flow(s, g, 0, 4, 'D', vel=44)
    piano_flow(s, g, 4, 8, 'Bm', vel=44)
    pad(s, 'strings', g, 0, 4, ['D3', 'A3', 'E4', 'F#4'], 60)
    pad(s, 'strings', g, 4, 8, ['B2', 'F#3', 'D4', 'F#4'], 60)
    s.expr('strings', [(g(0), 25), (g(3), 72), (g(8) - 0.05, 78)])
    # dizi: the theme head as a first, soft fragment, F#5 hangs in the gap
    s.dizi(g(4), g.d(4, 1.5), 'A4', vel=66, slide=-2, slide_t=0.2)
    s.dizi(g(5.5), g.d(5.5, 0.5), 'B4', vel=64)
    s.dizi(g(6), g.d(6, 2.55), 'F#5', vel=72, grace='E5', vib=0.25, end_level=0.3)
    # seg2 triptych: harp gliss lands on G6/9; IV - iii - vi - V
    s.gliss('harp', h['triptych'] - 0.42, h['triptych'] - 0.06, ['D4', 'E4', 'A4', 'B4', 'D5'], vel=40,
            vel_end=52, dur=1.6)
    s.chord('harp', h['triptych'], 2.5, ['G3', 'D4', 'B4', 'E5'], 72)
    s.note('cbass', h['triptych'], 3.0, 'G2', 70)
    s.note('timp', h['triptych'], 1.2, 'G2', 52)
    plan = [(8, 'G'), (12, 'F#m'), (16, 'Bm'), (20, 'A')]
    vo = {'G': ['G2', 'D3', 'B3', 'E4'], 'F#m': ['F#2', 'E3', 'A3', 'B3'], 'Bm': ['B2', 'F#3', 'A3', 'D4'],
          'A': ['A2', 'E3', 'B3', 'D4']}
    for b, ch in plan:
        piano_flow(s, g, b, b + 4, ch, vel=46)
        pad(s, 'strings', g, b, b + 4, vo[ch], 64)
    s.expr('strings', [(g(8), 70), (g(16), 88), (g(23.5), 80)])
    # dizi answers (theme bar 2) at the end of the line
    s.dizi(g(21), g.d(21, 1), 'E5', vel=62)
    s.dizi(g(22), g.d(22, 0.5), 'D5', vel=60)
    s.dizi(g(22.5), g.d(22.5, 0.5), 'E5', vel=60)
    s.dizi(g(23), g.d(23, 1.8), 'B4', vel=64, fall=-0.6, fall_t=0.3, end_level=0.3)
    # seg3 list: light koto quarter notes over held chords
    kp = {'D': ['D5', 'A4', 'E5', 'A4'], 'Bm': ['B4', 'F#4', 'D5', 'F#4'], 'G': ['B4', 'D5', 'A4', 'D5']}
    for i, ch in enumerate(['D', 'Bm', 'G']):
        b = 24 + 4 * i
        for k, p in enumerate(kp[ch]):
            s.koto(g(b + k), p, 52 + (6 if k == 0 else 0), dur=0.9, vib=0.12 if k == 3 else 0)
        lh = {'D': ['D2', 'A2'], 'Bm': ['B1', 'F#2'], 'G': ['G1', 'D2']}[ch]
        s.chord('piano', g(b), g.d(b, 3.9), lh + {'D': ['F#3', 'E4'], 'Bm': ['D3', 'A3'], 'G': ['B2', 'A3']}[ch], 42)
        s.pedal('piano', g(b) + 0.03, g(b + 4) - 0.04)
        pad(s, 'strings', g, b, b + 4, {'D': ['D3', 'A3', 'F#4'], 'Bm': ['B2', 'F#3', 'D4'],
                                        'G': ['G2', 'D3', 'B3']}[ch], 58)
    s.expr('strings', [(g(24), 70), (g(35.5), 60)])
    # seg4 calm: one still chord, then the dizi in the last breath
    t = h['calm']
    s.chord('piano', t, 3.6, ['D2', 'A2', 'F#3', 'E4', 'A4'], 40, roll=0.04)
    s.pedal('piano', t + 0.03, t + 3.5)
    pad(s, 'strings', g, 36, 41, ['D3', 'A3', 'E4', 'F#4'], 50)
    s.expr('strings', [(t, 55), (t + 2.0, 42), (s.t1, 30)])
    s.dizi(89.0, 0.27, 'D5', vel=62, grace='E5', grace_t=0.06)
    s.dizi(89.29, 0.2, 'B4', vel=58)
    s.dizi(89.5, 0.42, 'A4', vel=60, end_level=0.3)
    s.op('fadeout', s.t1, s.t1 + 0.5)


def c_cruel(s):
    g = Grid([s.t0, s.t1], 60, nbeats=[12])
    s.g = g
    T = s.t1 - s.t0
    s.chord('piano', s.t0, 3.0, ['B0', 'B1'], 66)
    s.pedal('piano', s.t0 + 0.02, s.t0 + 2.5)
    s.note('cbass', s.t0, T + 0.4, 'B1', 80)
    s.note('cello', s.t0 + 0.1, T + 0.3, 'F#2', 70)
    s.expr('cbass', [(s.t0, 60), (s.t0 + 4, 100), (s.t0 + 8, 85), (s.t1, 110)])
    s.expr('cello', [(s.t0, 40), (s.t0 + 5, 90), (s.t0 + 9, 70), (s.t1, 100)])
    # minor-second tension (F#3 + G3), then B3 + C4 above it
    s.note('trem', 93.1, s.t1 - 93.1 + 0.3, 'F#3', 60)
    s.note('trem', 93.1, s.t1 - 93.1 + 0.3, 'G3', 56)
    s.note('strings', 97.95, s.t1 - 97.95 + 0.3, 'B3', 58)
    s.note('strings', 97.95, s.t1 - 97.95 + 0.3, 'C4', 54)
    s.expr('trem', [(93.1, 15), (97.9, 75), (s.t1, 95)])
    s.expr('strings', [(97.95, 10), (101.6, 85), (s.t1, 95)])
    # sub pulse on every beat, doubling into a heartbeat in the second half
    for b in range(12):
        s.add('synth', g(b), S.sub_pulse(hz('B1'), 0.7), gain_db=-14 + (2 if b >= 6 else 0))
        if b >= 6:
            s.add('synth', g(b + 0.28), S.sub_pulse(hz('B1'), 0.5), gain_db=-19)
    s.op('fadeout', s.t1 - 0.35, s.t1 + 0.25)


def c_traffic(s):
    h = s.hits
    cut = h['cut']
    g = Grid([s.t0, cut], 128, nbeats=[24])
    s.g = g
    L = cut - s.t0 + 0.5
    n = nsamp(L)

    def put(buf, t, x, gdb=0.0):
        i = nsamp(t - s.t0)
        j = min(n, i + len(x))
        if j > i:
            buf[i:j] += db2a(gdb) * x[:j - i]

    drums = np.zeros(n)
    for b in range(24):
        put(drums, g(b), S.kick(), -3)
        if b % 2 == 1 and b < 21:
            put(drums, g(b), S.clap(seed=b), -7)
        put(drums, g(b + 0.5), S.hat(seed=b, open_=True), -14)
        put(drums, g(b + 0.25), S.hat(seed=100 + b), -19)
        put(drums, g(b + 0.75), S.hat(seed=200 + b), -19)
    # snare roll build in the last bar
    k = 0
    b = 20.0
    while b < 24 - 1e-6:
        stp = 0.25 if b < 22 else 0.125
        put(drums, g(b), S.snare(seed=300 + k), -16 + 10 * (b - 20) / 4)
        b += stp
        k += 1
    # sidechain pump for the tonal parts
    pump = np.ones(n)
    for b in range(24):
        i = nsamp(g(b) - s.t0)
        j = min(n, nsamp(g(b + 1) - s.t0))
        x = (np.arange(j - i)) / SR
        pump[i:j] = 1 - 0.78 * np.exp(-x / 0.085)
    ton = np.zeros(n)
    prog = [('Bm', ['B3', 'D4', 'F#4', 'B4'], 'B1'), ('G', ['G3', 'B3', 'D4', 'G4'], 'G1'),
            ('D', ['A3', 'D4', 'F#4', 'A4'], 'D2'), ('A', ['A3', 'B3', 'E4', 'A4'], 'A1'),
            ('Bm', ['B3', 'D4', 'F#4', 'B4'], 'B1'), ('G', ['G3', 'B3', 'D4', 'G4'], 'G1')]
    for i, (nm_, ch, bass) in enumerate(prog):
        x = S.supersaw(g.d(4 * i, 4), [N(p) for p in ch], cutoff=4200 + 300 * i, seed=10 + i, release=0.05)
        put(ton, g(4 * i), x, -7)
        for q in range(4):
            put(ton, g(4 * i + q + 0.5), S.pluck_synth(g.d(0, 0.45), N(bass) + 12, bright=1500, decay=0.12), -6)
            put(ton, g(4 * i + q + 0.5), S.sine_var(np.full(nsamp(0.2), hz(bass))) * np.exp(-np.arange(nsamp(0.2)) / (0.08 * SR)), -5)
    # cheap toy-lead hook (bars 3-6), pentatonic, square pluck
    hook = [(0, 'F#5'), (0.5, 'F#5'), (1, 'E5'), (1.5, 'D5'), (2, 'B4'), (2.75, 'D5'), (3.25, 'E5')]
    for bar in (2, 3, 4, 5):
        for bo, p in hook:
            if bar == 5 and bo > 2:
                continue
            put(ton, g(4 * bar + bo), S.pluck_synth(g.d(0, 0.4), N(p) + 12, bright=5000, decay=0.09, wave='square'), -15)
    ton = ton * pump
    rs = S.riser(g.d(18, 6), f0=300, f1=4000, seed=12)
    put(ton, g(18), rs, -12)
    mix = np.tanh(1.2 * (drums + ton)) * 0.85
    s.add('synth', s.t0, mix, gain_db=-2, ir='room', send=0.06)
    s.op('cut', cut)


def c_realize(s):
    h = s.hits
    g = Grid([s.t0, h['dislocate'], h['question'], h['riser_end']], 66, nbeats=[9, 5, 6])
    s.g = g
    s.fx['piano'] = dict(ir='big', send=0.6, gain=-1)
    # single piano notes after the cut, long reverb
    for b, p, v in [(0, 'B4', 50), (2, 'F#5', 42), (4, 'D5', 44), (6.6, 'A4', 40), (7.6, 'B4', 38)]:
        s.note('piano', g(b), 3.5, p, v)
    s.pedal('piano', g(0) + 0.01, g(9) - 0.05)
    # 错位: the pad slips out of tune, a low displaced octave answers
    t = h['dislocate']
    s.chord('piano', t, 3.5, ['B0', 'B1'], 76)
    s.note('piano', t + 0.11, 3.0, 'C2', 34)   # deliberate smear: the dislocation
    s.pedal('piano', t + 0.02, t + 3.0)
    s.note('piano', 122.45, 3.0, 'E5', 38)
    s.note('piano', 123.0, 3.0, 'D5', 34)
    # detuned wobble pad: Bm11, slipping at 错位
    dur = 13.2
    tt = np.arange(nsamp(dur)) / SR
    wob = 5 * np.sin(2 * np.pi * 0.23 * tt)
    k = np.clip((tt - (t - 113.6)) / 0.8, 0, 1) * np.clip(1 - (tt - (t - 113.6) - 1.8) / 1.5, 0, 1)
    wob = wob + 38 * k * np.sin(2 * np.pi * 0.6 * tt)
    x = S.warm_pad(dur, [N(p) for p in ['B2', 'F#3', 'A3', 'D4', 'E4']], attack=2.5, release=2.5, cutoff=1150,
                   detune_c=6, wobble=wob, seed=8)
    s.add('pads', 113.6, x, gain_db=-14, ir='big', send=0.35)
    # question: G add9 colour, celesta motif rising to an unresolved 2' (E6)
    x = S.warm_pad(6.4, [N(p) for p in ['G2', 'D3', 'A3', 'B3', 'E4']], attack=1.6, release=1.8, cutoff=1050,
                   detune_c=8, wobble=6 * np.sin(2 * np.pi * 0.3 * np.arange(nsamp(6.4)) / SR), seed=9)
    s.add('pads', h['question'] - 0.4, x, gain_db=-15, ir='big', send=0.35)
    qb = 14
    for bo, d, p, v in [(0, 0.5, 'A5', 58), (0.5, 0.5, 'B5', 56), (1.0, 0.5, 'D6', 58), (1.5, 2.5, 'E6', 62)]:
        s.nb('celesta', qb + bo, d, p, v, legato=1.6)
    for bo, d, p, v in [(5.0, 0.4, 'B5', 52), (5.4, 0.4, 'D6', 50), (5.8, 1.6, 'E6', 56)]:
        s.nb('celesta', qb + bo, d, p, v, legato=1.6)
    s.fx['celesta'] = dict(ir='big', send=0.5)
    # riser into chapter 02, ending exactly on riser_end
    r = S.riser(2.0, f0=250, f1=3200, seed=13)
    s.add('synth', h['riser_end'] - 2.0, r, gain_db=-17, ir='hall', send=0.2)
    s.op('fadeout', h['riser_end'], s.t1 + 0.3)


def c_tracks(s):
    h = s.hits
    g = Grid([s.t0, h['twin'], h['耗时间']], 92, nbeats=[19, 35])
    s.g = g
    # pickup glissando into the downbeat
    s.gliss('koto', s.t0 - 0.45, s.t0 - 0.06, ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5'], vel=44, vel_end=60, dur=0.6)
    bars = [(0, 4, 'Bm'), (4, 4, 'G'), (8, 4, 'D'), (12, 4, 'A'), (16, 3, 'A'),
            (19, 4, 'Bm'), (23, 4, 'G'), (27, 4, 'D'), (31, 4, 'A'), (35, 4, 'Bm'), (39, 4, 'G'), (43, 4, 'Em'),
            (47, 4, 'A'), (51, 3, 'A')]
    for b, nbt, ch in bars:
        v0 = 50 + (b / 54) * 22
        koto_ost(s, g, b, b + nbt, ch, vel=v0, lo=57, hi=76, dur=0.7)
        # low taiko on 1 and 3
        s.nb('taiko', b, 1, 'D2', 66 + b * 0.5)
        if nbt >= 3:
            s.nb('taiko', b + 2, 1, 'A1', 58 + b * 0.5)
        if b >= 35:
            s.nb('taiko', b + 3.5, 0.5, 'D2', 50 + b * 0.4)
        # strings from 'twin', sustained voicings, building
        if b >= 19:
            vo = {'Bm': ['B2', 'F#3', 'D4', 'F#4'], 'G': ['G2', 'D3', 'B3', 'D4'], 'D': ['D3', 'A3', 'F#4', 'A4'],
                  'A': ['A2', 'E3', 'B3', 'D4'], 'Em': ['E3', 'B3', 'D4', 'A4']}[ch]
            pad(s, 'strings', g, b, b + nbt, vo, 62)
            s.nb('cbass', b, nbt, root(ch, 1) + 12, 70)
        if b >= 35:
            for k in range(int(nbt * 2)):
                s.nb('cello', b + k * 0.5, 0.45, root(ch, 2), 62 + (8 if k % 2 == 0 else 0))
    s.expr('strings', [(g(19), 40), (g(35), 75), (g(53.5), 112)])
    s.expr('cbass', [(g(19), 50), (g(54), 100)])
    # call & response: dizi pickup into 'twin' (竹笛手艺人), koto answers later
    s.dizi(h['twin'] - 0.42, 0.18, 'E5', vel=60)
    s.dizi(h['twin'] - 0.22, 0.2, 'F#5', vel=62)
    s.dizi(h['twin'], 1.6, 'A5', vel=70, vib=0.22, end_level=0.3)
    s.koto(162.6, 'E5', 60, dur=1.0)
    s.koto(162.82, 'D5', 58, dur=1.4, bend_to='E5', bend_at=0.15, bend_t=0.12)
    # stop-time: four exact hits on 耗时间 / 耐寂寞 / 慢打磨 / 不讨巧
    hits = [('耗时间', 'Bm', ['B1', 'B2', 'F#3', 'B3', 'D4', 'F#4'], 100),
            ('耐寂寞', 'G', ['G1', 'G2', 'D3', 'B3', 'D4', 'G4'], 104),
            ('慢打磨', 'Em', ['E2', 'B2', 'E3', 'A3', 'B3', 'E4'], 108),
            ('不讨巧', 'D', ['D2', 'A2', 'D3', 'F#3', 'A3', 'E4'], 112)]
    for i, (w, ch, vo, v) in enumerate(hits):
        t = h[w]
        last = i == 3
        s.note('taiko', t, 1.0, 'D2', min(127, v + 10))
        s.note('timp', t, 1.2, root(ch, 2) if ch != 'Em' else N('E2'), v - 20)
        s.chord('violins', t, 2.6 if last else 0.32, vo[2:], v - 10)
        s.chord('cbass', t, 2.6 if last else 0.4, vo[:1], v - 10)
        s.chord('piano', t, 2.0 if last else 0.6, vo[:2] + vo[3:5], v - 30)
        nxt = h[hits[i + 1][0]] if i < 3 else t + 2.0
        s.chord('koto', t, min(1.2, nxt - t - 0.05), [N(p) for p in vo[3:]], v - 35)
    s.expr('violins', [(h['不讨巧'], 120), (h['不讨巧'] + 2.2, 55)])
    s.op('fadeout', s.t1 - 0.2, s.t1 + 0.8)


def c_market(s):
    h = s.hits
    g = Grid([s.t0, h['aigrid'], h['stop']], 100, nbeats=[44, 8])
    s.g = g
    plan = ['Bm', 'Bm', 'G', 'G', 'Em', 'Em', 'Bm', 'Bm', 'G', 'A', 'A', 'Bm', 'Bm']
    for bar in range(13):
        ch = plan[bar]
        t_ = tones(ch, 54, 71)
        pat = [0, 2, 0, 1, 0, 2, 3, 2]
        for k in range(8):
            b = bar * 4 + k * 0.5
            if b >= 52:
                break
            p = t_[pat[k] % len(t_)]
            v = 64 + (14 if k % 2 == 0 else 0) + bar * 1.2
            s.nb('spicc', b, 0.22, p, v, legato=1.0)
            if bar >= 6:     # violas a third/fourth above join in, tightening
                s.nb('spicc', b, 0.22, t_[(pat[k] + 2) % len(t_)] + (12 if pat[k] + 2 >= len(t_) else 0), v - 12,
                     legato=1.0)
        # bass pulses on the beat
        for q in range(4):
            b = bar * 4 + q
            if b >= 52:
                break
            s.nb('cbass', b, 0.4, root(ch, 1), 82 if q == 0 else 66, legato=1.0)
        if bar * 4 < 44:
            s.add('synth', g(bar * 4), S.sub_pulse(hz(root(ch, 1)), 0.6), gain_db=-12)
    # ticking (8ths) through the scene
    b = 0.0
    k = 0
    while b < 44:
        s.add('perc', g(b), S.tick(seed=k, freq=3000 if k % 2 == 0 else 2400), gain_db=-24 + (3 if k % 2 == 0 else 0),
              pan=0.35)
        b += 0.5
        k += 1
    # AI grid: robotic arpeggiator accelerating from 16ths to a blur
    t = h['aigrid']
    s.note('taiko', t, 1.0, 'D2', 100)
    s.chord('piano', t, 1.5, ['B0', 'B1'], 80)
    arp = [N(p) for p in ['B4', 'D5', 'F#5', 'A5', 'E5', 'F#5', 'B5', 'A5']]
    i0, i1 = g.d(44, 0.25), 0.028
    tt = t
    k = 0
    T = h['stop'] - t
    while tt < h['stop'] - 0.02:
        x = (tt - t) / T
        iv = i0 * (i1 / i0) ** (x ** 1.3)
        s.add('synth', tt, S.robot_arp(min(0.11, iv * 1.1), arp[k % len(arp)] + (12 if x > 0.75 and k % 2 else 0)),
              gain_db=-15 + 4 * x, pan=0.3 * np.sin(k * 0.9))
        if k % 2 == 0:
            s.add('perc', tt, S.tick(seed=500 + k, freq=4200), gain_db=-24, pan=-0.3)
        tt += iv
        k += 1
    s.op('cut', h['stop'])


def c_irony(s):
    h = s.hits
    # near silence: only a breath of low B
    x = S.sub_drone(4.6, [hz('B1'), hz('F#2')], [1, 0.4], attack=1.5, release=1.5, seed=14)
    s.add('synth', s.t0, x, gain_db=-30)
    # 速成品: cheap, bright, crushed stab with a tacky echo
    t = h['cheap']
    st = S.supersaw(0.16, [N(p) for p in ['D5', 'F#5', 'A5', 'D6']], cutoff=9000, release=0.05, seed=15)
    st = S.bitcrush(st, bits=6, down=3)
    for k in range(4):
        s.add('synth', t + k * 0.19, st, gain_db=-8 - 7 * k, pan=(-0.5, 0.5)[k % 2] if k else 0.0)
    s.note('stab', t, 0.4, 'D5', 100)
    s.note('glock', t, 0.6, 'A6', 90)
    # 用心作: soft low cello + felt piano, a sad G maj7 colour
    t = h['heart']
    s.note('cello', t, 5.6, 'G2', 72)
    s.expr('cello', [(t, 40), (t + 1.6, 92), (t + 5.0, 55)])
    s.chord('felt', t + 0.05, 5.0, ['G1', 'D2', 'F#3', 'B3', 'D4'], 44, roll=0.06)
    s.pedal('felt', t + 0.06, t + 5.1)
    pad(s, 'strings', Grid([t, t + 5], 60), 0.3, 5.2, ['D3', 'B3'], 46)
    s.expr('strings', [(t, 20), (t + 2.0, 55), (s.t1, 40)])
    s.op('fadeout', s.t1, s.t1 + 1.0)


def c_painter(s):
    h = s.hits
    g = Grid([s.t0, h['glitch']], 72, nbeats=[16])
    s.g = g
    # theme (bars 1-4) framed around the voice: cello two octaves down,
    # piano one octave up; harmony re-coloured to B minor (Bm | A11 | G | Em)
    for bo, d, p, o in theme(0, 16):
        s.nb('cello', bo, d, p - 24, 74, legato=1.03)
        s.nb('piano', bo, d, p + 12, 44 if d < 1 else 50, legato=0.95)
    s.expr('cello', [(g(0), 70), (g(2), 100), (g(6), 85), (g(10), 105), (g(13), 95), (g(16), 80)])
    for b, ch, bass in [(0, 'Bm', 'B1'), (4, 'A', 'A1'), (8, 'G', 'G1'), (12, 'Em', 'E1')]:
        s.nb('piano', b, 4, bass, 48)
        s.nb('cbass', b, 4, N(bass) + 12, 58, legato=1.02)
        s.pedal('piano', g(b) + 0.03, g(b + 4) - 0.04)
    pad(s, 'strings', g, 0, 4, ['F#3', 'D4'], 50)
    pad(s, 'strings', g, 4, 8, ['E3', 'D4'], 50)
    pad(s, 'strings', g, 8, 12, ['D3', 'B3'], 50)
    pad(s, 'strings', g, 12, 16, ['B2', 'D4'], 50)
    s.expr('strings', [(g(0), 30), (g(8), 60), (g(16), 55)])
    # AI arrives: glitch break (stutter + crush) then a hole for the sub drop
    for k in range(7):
        bl = S.robot_arp(0.06, N('B5') - 5 * k)
        s.add('synth', h['glitch'] + 0.1 * k, S.bitcrush(bl, 4, 6), gain_db=-14, pan=(-0.6, 0.6)[k % 2])
    s.op('stutter', h['glitch'], 0.11, 6, h['swap'] - 0.3)
    # swap: cold robotic pulse over a low B, cold open fifths
    g2 = Grid([h['swap'], h['misfit']], 72, nbeats=[12])
    for k in range(24):
        b = k * 0.5
        s.add('synth', g2(b), S.robot_arp(0.09, N('B4') if k % 2 == 0 else N('F#4')), gain_db=-16, pan=0.25)
    for b in (0, 4, 8):
        s.chord('piano', g2(b), g2.d(b, 3.8), ['B2', 'F#3'], 40)
    s.note('cbass', h['swap'], h['misfit'] - h['swap'] + 0.2, 'B1', 64)
    s.expr('cbass', [(h['swap'], 50), (h['misfit'], 85)])
    x = S.sub_drone(h['misfit'] - h['swap'] + 0.5, [hz('B1')], attack=1.0, release=0.5, seed=16)
    s.add('synth', h['swap'], x, gain_db=-18)
    # misfit: rushing texture - tremolo cluster swelling, pizz 16ths climbing
    g3 = Grid([h['misfit'], h['rules']], 72, nbeats=[8])
    for p in ['B3', 'D4', 'F#4', 'A4']:
        s.note('trem', h['misfit'], h['rules'] - h['misfit'] + 0.1, p, 66)
    s.note('trem', g3(4), g3.d(4, 4) + 0.1, 'E5', 60)
    s.expr('trem', [(h['misfit'], 25), (h['rules'] - 0.15, 118), (h['rules'], 60)])
    run = [N(p) for p in ['B3', 'D4', 'F#4', 'A4', 'D4', 'F#4', 'A4', 'B4', 'F#4', 'A4', 'B4', 'D5', 'A4', 'B4', 'D5', 'E5']]
    for k in range(32):
        b = k * 0.25
        s.note('pizz', g3(b), 0.2, run[k % 16] + (12 if k >= 16 else 0), 56 + k)
    for k in range(16):
        s.add('synth', g3(k * 0.5), S.robot_arp(0.07, N('B4')), gain_db=-17 + k * 0.4, pan=0.25)
    # the rules changed: a music-box line (theme head in the minor colour)
    g4 = Grid([h['rules'], s.t1], 72, nbeats=[8])
    for bo, d, p, o in theme(0, 8):
        s.note('mbox', g4(bo), g4.d(bo, d) * 1.4, p + 12, 70)
    x = S.warm_pad(s.t1 - h['rules'] + 1.5, [N(p) for p in ['B2', 'F#3', 'D4']], attack=2.0, release=2.0, cutoff=900,
                   seed=17)
    s.add('pads', h['rules'], x, gain_db=-17, ir='hall', send=0.3)
    s.note('cello', h['rules'] + 0.05, s.t1 - h['rules'], 'B2', 54)
    s.expr('cello', [(h['rules'], 30), (h['rules'] + 3, 70), (s.t1, 40)])
    s.op('fadeout', s.t1, s.t1 + 1.0)


def c_me(s):
    h = s.hits
    s.fx['felt'] = dict(ir='big', send=0.65, gain=3)
    T = h['silence'] - s.t0
    # introspective drone, with the dark swell to 迷茫 built into its envelope
    dr = S.sub_drone(T, [hz('B1'), hz('F#2'), hz('B2')], [1, 0.5, 0.25], attack=3.0, release=2.5, grit=0.08, seed=18)
    e = env_points(len(dr), [(0, -6), (h['anxiety'] - s.t0, -6), (h['peak'] - s.t0, 3), (T, -4)])
    s.add('synth', s.t0, dr * db2a(e), gain_db=-13, ir='big', send=0.15)
    # distant piano: sparse notes in the narration's breaths
    for t, p, v in [(260.2, 'D5', 40), (261.6, 'B4', 34), (263.35, 'F#4', 38), (265.4, 'A4', 32), (267.6, 'E5', 32),
                    (269.35, 'D5', 34), (274.45, 'F#4', 38), (274.62, 'B4', 34), (277.15, 'A4', 32),
                    (281.32, 'D5', 32), (283.6, 'E4', 30), (286.8, 'F#4', 34)]:
        s.note('felt', t, 3.0, p, v + 6)
    s.cc('felt', 260.0, 64, 127)
    s.cc('felt', h['peak'] + 2.5, 64, 0)
    # ticking ostinato: 8ths, then locked to the accelerating heartbeat SFX
    g = Grid([s.t0, h['run']], 64, nbeats=[10])
    ticks = [g(b * 0.5) for b in range(20)]
    hb = sorted(t for t in SFX_T.get('heartbeat', []) if h['run'] - 0.05 <= t <= h['anxiety'])
    for a, b in zip(hb, hb[1:]):
        ticks += [a, (a + b) / 2]
    if hb:
        last_iv = (hb[-1] - hb[-2]) / 2 if len(hb) > 1 else 0.15
        t = hb[-1]
        while t < h['peak'] - 3.0:
            ticks.append(t)
            t += last_iv * 2 if t > h['anxiety'] else last_iv
    for k, t in enumerate(sorted(ticks)):
        lvl = -20 if t < h['run'] else (-18 if t < h['anxiety'] else -22 - 10 * (t - h['anxiety']) / (h['peak'] - h['anxiety']))
        s.add('perc', t, S.tick(seed=k, freq=2700 if k % 2 == 0 else 2150), gain_db=lvl, pan=-0.3)
    # dark ambient swell: low cluster pad opening up into 迷茫
    d = h['peak'] - h['anxiety'] + 3.2
    x = S.warm_pad(d, [N(p) for p in ['B1', 'F#2', 'C#3', 'D3', 'E3']], attack=d * 0.8, release=3.0, cutoff=700,
                   detune_c=12, seed=19, breath=0.5)
    xb = S.warm_pad(d, [N(p) for p in ['F#3', 'A3', 'B3', 'E4']], attack=d * 0.85, release=2.8, cutoff=1600,
                    detune_c=14, seed=20)
    s.add('pads', h['anxiety'], x + 0.6 * xb, gain_db=-12, ir='big', send=0.4)
    # the peak itself: low piano + bass, then everything decays to silence
    t = h['peak']
    s.chord('piano', t, 3.0, ['B0', 'B1', 'F#2'], 70)
    s.pedal('piano', t + 0.02, t + 2.8)
    s.note('timp', t, 2.0, 'B1', 66)
    s.op('fadeout', h['silence'] - 1.3, h['silence'])


MARCH_V = {'D': ['D3', 'A3', 'E4', 'F#4'], 'Bm': ['B2', 'F#3', 'D4', 'A4'], 'G': ['G2', 'D3', 'B3', 'E4'],
           'A': ['A2', 'E3', 'B3', 'D4'], 'F#m': ['F#2', 'E3', 'A3', 'B3'], 'Em': ['E3', 'B3', 'D4', 'A4']}


def c_march(s):
    h = s.hits
    g = Grid([s.t0, h['break_out'], h['boss'], h['浪潮'], h['path'], h['命题']], 100, nbeats=[3, 24, 26, 6, 56])
    s.g = g
    # pickup: harp rises out of the silence
    for k, p in enumerate(['D4', 'F#4', 'A4', 'B4', 'D5', 'E5']):
        s.nb('harp', k * 0.5, 2.0, p, 40 + 5 * k)
    rc = S.reverse_cymbal(1.2, seed=21)
    s.add('perc', h['break_out'] - 1.2, rc, gain_db=-20)
    seg1 = [(3 + 4 * i, ch) for i, ch in enumerate(['D', 'Bm', 'G', 'A', 'D', 'Bm'])]
    seg2 = [(27 + 4 * i, ch) for i, ch in enumerate(['G', 'A', 'F#m', 'Bm', 'G', 'A'])] + [(51, 'A')]
    seg4 = [(59 + 4 * i, ch) for i, ch in enumerate(['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'A', 'G', 'A', 'F#m',
                                                     'Bm', 'G', 'A'])]
    # ---- groove (soft kick / shaker / claps), koto 8ths, pizz bass
    for b0, ch in seg1 + seg2:
        nbt = 2 if b0 == 51 else 4
        boss = b0 >= 27
        koto_ost(s, g, b0, b0 + nbt, ch, vel=58 if not boss else 64, lo=60, hi=81,
                 pat=(0, 2, 4, 3, 1, 3, 4, 2), dur=0.6)
        for q in range(nbt):
            s.nb('pizz', b0 + q, 0.6, root(ch, 2), 70 if q == 0 else 58)
        pad(s, 'strings', g, b0, b0 + nbt, MARCH_V[ch], 56)
    for b in np.arange(3, 53, 0.25):
        acc = 1.0 if (b * 2) % 1 == 0 else 0.6
        s.add('perc', g(b), S.shaker(seed=int(b * 8), accent=acc), gain_db=-28 + (2 if b >= 27 else 0), pan=0.35)
    for b in range(3, 53):
        q = (b - 3) % 4
        if q in (0, 2):
            s.add('perc', g(b), S.soft_kick(), gain_db=-14)
        if b >= 27 and q in (1, 3):
            s.add('perc', g(b), S.clap(seed=b, tone=1200), gain_db=-22, pan=-0.1)
    # break_out: bright dizi call over the first downbeat
    s.dizi(g(3), g.d(3, 2.2), 'A5', vel=70, slide=-3, slide_t=0.22, vib=0.22, end_level=0.4)
    # ---- swell into 浪潮
    s.expr('strings', [(g(3), 45), (g(27), 60), (g(45), 70), (g(53) - 0.05, 104)])
    for k in range(int((53 - 47) * 6)):
        b = 47 + k / 6
        s.nb('timp', b, 0.3, 'A1', 34 + 50 * k / 36, legato=1.0)
    rc = S.reverse_cymbal(2.6, seed=22)
    s.add('perc', h['浪潮'] - 2.6, rc, gain_db=-20)
    s.gliss('harp', g(51), h['浪潮'], ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5', 'A5', 'B5', 'D6'],
            vel=50, vel_end=80, dur=2.0)
    # ---- 浪潮: tutti D add9 bloom
    t = h['浪潮']
    tutti(s, t, 'D1', ['D4', 'A4', 'D5', 'F#5'], vel=112, crash_db=-18)
    s.add('perc', t, S.soft_kick(0.5), gain_db=-4)
    s.chord('piano', t, 3.8, ['D1', 'D2', 'A3', 'D4', 'F#4', 'E5'], 78, roll=0.02)
    s.pedal('piano', t + 0.02, t + 3.8)
    pad(s, 'strings', g, 53, 59, ['D3', 'A3', 'D4', 'E4', 'F#4', 'A4'], 80)
    s.expr('strings', [(t, 122), (t + 1.0, 100), (g(59) - 0.1, 62)])
    s.chord('choir', t, g(59) - t, ['D4', 'F#4', 'A4', 'E5'], 74)
    s.expr('choir', [(t, 110), (g(59), 50)])
    s.nb('cbass', 53, 6, 'D2', 90)
    s.gliss('harp', t + 0.9, t + 2.3, ['D6', 'B5', 'A5', 'F#5', 'E5', 'D5', 'B4', 'A4'], vel=55, vel_end=40, dur=1.5)
    # ---- path: reflective walk, warm strings to a soft peak at 命题
    s.chord('piano', h['path'], 2.4, ['B1', 'B2', 'F#3', 'D4'], 60, roll=0.02)
    s.note('cbass', h['path'], 2.4, 'B1', 64)
    for i, (b0, ch) in enumerate(seg4):
        piano_flow(s, g, b0, b0 + 4, ch, vel=42 + i * 0.6, pat=(0, 2, 3, 4, 5, 4, 3, 2))
        if i >= 2:
            for k in range(8):
                tt_ = tones(ch, 69, 86)
                s.nb('harp', b0 + k * 0.5, 0.6, tt_[(k * 2 + i) % len(tt_)], 34 + i)
        if i >= 4:
            pad(s, 'strings', g, b0, b0 + 4, MARCH_V[ch], 60)
            s.nb('cbass', b0, 4, root(ch, 1) + 12, 60)
        if i >= 3:
            s.add('perc', g(b0), S.soft_kick(), gain_db=-13)
            if i >= 7:
                s.add('perc', g(b0 + 2), S.soft_kick(), gain_db=-15)
        if i >= 5:
            for b in np.arange(b0, b0 + 4, 0.5):
                s.add('perc', g(b), S.shaker(seed=int(b * 4) + 900, accent=0.7), gain_db=-30, pan=0.35)
    s.expr('strings', [(g(75), 35), (g(99), 80), (g(115) - 0.05, 108)])
    # theme b-phrase on dizi landing on 1' exactly at 命题
    tb = theme(16, 28)
    for bo, d, p, o in tb:
        s.dizi(g(99 + bo), g.d(99 + bo, d), p, vel=70 + bo * 0.4, **o)
    for bo, d, p, o in [(12, 2, 'E5', dict(slide=-2)), (14, 1, 'F#5', {}), (15, 1, 'E5', dict(grace='F#5'))]:
        s.dizi(g(99 + bo), g.d(99 + bo, d), p, vel=76, **o)
    # dizi answers in the narration's gaps
    fills = [(306.66, [('E5', 0.13, dict(grace='F#5')), ('D5', 0.13, {}), ('B4', 0.5, dict(fall=-0.5))]),
             (315.96, [('A5', 0.14, dict(grace='B5')), ('F#5', 0.45, {})]),
             (326.3, [('D5', 0.1, {}), ('E5', 0.1, {}), ('F#5', 0.1, {}), ('A5', 0.6, dict(vib=0.2))]),
             (330.04, [('B4', 0.14, {}), ('D5', 0.4, {})]),
             (339.27, [('D5', 0.12, dict(grace='E5')), ('E5', 0.12, {}), ('B4', 0.55, {})]),
             (344.92, [('E5', 0.13, {}), ('D5', 0.35, {})])]
    for t0, notes in fills:
        t = t0
        for p, d, o in notes:
            s.dizi(t, d, p, vel=64, **o)
            t += d
    # 命题: soft peak
    t = h['命题']
    pad(s, 'strings', g, 115, 119, ['D3', 'A3', 'E4', 'F#4', 'A4'], 70)
    s.expr('strings', [(t, 108), (t + 2.2, 60)])
    s.chord('piano', t, 2.6, ['D2', 'A2', 'F#4', 'A4', 'E5'], 68, roll=0.012)
    s.pedal('piano', t + 0.02, t + 2.5)
    s.gliss('harp', t - 0.5, t - 0.06, ['A4', 'B4', 'D5', 'E5', 'F#5', 'A5'], vel=40, vel_end=54, dur=2.0)
    s.chord('harp', t, 2.5, ['D4', 'A4', 'D5', 'F#5'], 70)
    s.note('timp', t, 1.5, 'D2', 60)
    s.note('okit', t, 2.5, 59, 58)
    s.chord('oohs', t, 2.4, ['D4', 'F#4', 'A4'], 60)
    s.op('fadeout', s.t1 - 0.1, s.t1 + 0.9)


def c_books(s):
    h = s.hits
    g = Grid([s.t0, h['silence']], 96, nbeats=[24])
    s.g = g
    walk = [('D3', 1), ('F#3', 1), ('A3', 1), ('F#3', 1),
            ('B2', 1), ('D3', 1), ('F#3', 0.5), ('E3', 0.5), ('D3', 1),
            ('G2', 1), ('B2', 1), ('D3', 1), ('B2', 1),
            ('A2', 1), ('E3', 1), ('A3', 0.5), ('B3', 0.5), ('A3', 1),
            ('D3', 1), ('A3', 1), ('F#3', 1), ('D3', 1),
            ('E3', 1), ('F#3', 0.5), ('A3', 0.5), ('B3', 1), ('D4', 0.5)]
    b = 0.0
    for p, d in walk:
        if b >= 23.6:
            break
        s.nb('pizz', b, 0.5, p, 70 if b % 1 == 0 else 58)
        b += d
    # celesta: curious rising 4ths, sparse under the voice, answers in gaps
    for b, p, v in [(1.5, 'A5', 44), (5.5, 'B5', 42), (9.5, 'D6', 42), (13.5, 'E6', 42), (17.5, 'A5', 42),
                    (21.5, 'B5', 40)]:
        s.nb('celesta', b, 0.5, p, v, legato=2.0)
    for t, p, v in [(367.5, 'A5', 50), (367.66, 'D6', 54), (374.28, 'B5', 50), (374.44, 'E6', 52), (374.6, 'F#6', 56)]:
        s.note('celesta', t, 0.8, p, v)
    for t, p in [(370.1, 'F#6'), (371.0, 'A6')]:
        s.note('glock', t, 0.5, p, 40)
    s.op('cut', h['silence'])


def c_roots(s):
    h = s.hits
    t = h['gong']
    T = s.t1 - t + 1.5
    s.fx['choir'] = dict(ir='big', send=0.5)
    s.fx['strings'] = dict(ir='big', send=0.45)
    s.note('timp', t, 3.0, 'D2', 92)
    s.note('taiko', t, 2.0, 'D2', 84)
    s.chord('piano', t, 4.0, ['D1', 'D2'], 70)
    s.pedal('piano', t + 0.02, t + 4.0)
    x = S.sub_drone(T, [hz('D1'), hz('D2')], [1, 0.5], attack=0.4, release=1.5, seed=23)
    s.add('synth', t, x, gain_db=-12)
    s.note('cbass', t, T, 'D2', 84)
    s.note('cello', t, T, 'A2', 74)
    s.expr('cbass', [(t, 110), (t + 2, 85), (s.t1, 80)])
    s.expr('cello', [(t, 90), (t + 2, 75), (s.t1, 80)])
    pad(s, 'strings', Grid([t, s.t1], 50), 0, 1, ['D3', 'A3'], 60, legato=1.2)
    for p in ['D3', 'A3', 'D4', 'E4', 'F#4']:
        s.note('choir', t + 0.15, T - 0.2, p, 72)
    s.expr('choir', [(t + 0.1, 20), (h['生命力'], 118), (s.t1, 95)])
    t2 = h['生命力']
    s.chord('choir', t2, s.t1 - t2 + 1.0, ['A4', 'F#5'], 64)
    s.gliss('harp', t2 - 0.55, t2, ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5', 'A5'], vel=48, vel_end=72, dur=2.5)
    for k, p in enumerate(['D6', 'A6', 'F#6', 'E6', 'A6']):
        s.note('celesta', t2 + 0.05 + 0.32 * k, 1.2, p, 50 - 3 * k)
    s.op('fadeout', s.t1 - 0.2, s.t1 + 0.9)


def c_copy(s):
    h = s.hits
    g = Grid([s.t0, h['c1'], h['c2'], h['c3'], h['warm']], 110, nbeats=[12, 7, 7, 7])
    s.g = g
    # mechanical pulse: 16th plucks (B), brighter as layers pile up
    for k in range(33 * 4):
        b = k * 0.25
        stage = 0 if b < 12 else 1 if b < 19 else 2 if b < 26 else 3
        p = [N('B2'), N('B2'), N('B3'), N('B2')][k % 4]
        if stage >= 2 and k % 8 == 6:
            p = N('F#3')
        x = S.pluck_synth(g.d(b, 0.22), p, bright=900 + 700 * stage, decay=0.06 + 0.01 * stage, wave='square')
        s.add('synth', g(b), x, gain_db=-20 + 1.2 * stage + (2 if k % 4 == 0 else 0), pan=-0.15)
        if k % 2 == 0:
            s.add('perc', g(b), S.tick(seed=700 + k, freq=4800, wood=False), gain_db=-27 + stage, pan=0.4)
    # c1 / c2 / c3: each 复制不了 adds a layer; the third is the biggest
    lay = [('c1', 'Bm', ['B2', 'F#3', 'B3', 'D4', 'F#4'], 92, 12, 19),
           ('c2', 'G', ['G2', 'D3', 'B3', 'D4', 'G4', 'B4'], 102, 19, 26),
           ('c3', 'A', ['A1', 'A2', 'E3', 'A3', 'D4', 'E4', 'B4'], 116, 26, 33)]
    for i, (k, ch, vo, v, b0, b1) in enumerate(lay):
        t = h[k]
        s.note('taiko', t, 1.5, 'D2', min(127, v + 8))
        s.chord('piano', t, 1.2, [root(ch, 1), root(ch, 2)], v - 20)
        s.note('cbass', t, g(b1) - t, root(ch, 1) + 12, v - 20)
        s.note('timp', t, 1.2, root(ch, 2) if ch != 'G' else N('G2'), v - 15)
        pad(s, 'strings', g, b0, b1, vo, v - 25)
        if i >= 1:
            pad(s, 'violins', g, b0, b1, [p + 12 for p in [N(x) for x in vo[-3:]]], v - 35)
            for q in range(b1 - b0):
                s.nb('taiko', b0 + q, 0.5, 'A1', 60 + 10 * i + (10 if q % 2 == 0 else 0))
                if i == 2:
                    s.nb('taiko', b0 + q + 0.5, 0.5, 'D2', 55 + 3 * q)
        if i == 2:
            s.note('okit', t, 2.0, 59, 105)
            pad(s, 'horns', g, b0, b1, ['A2', 'E3', 'A3', 'D4'], 92)
            pad(s, 'choir', g, b0, b1, ['A3', 'D4', 'E4', 'B4'], 80)
            s.expr('choir', [(t, 70), (g(b1) - 0.05, 120)])
            s.expr('horns', [(t, 80), (g(b1) - 0.05, 120)])
    s.expr('strings', [(h['c1'], 60), (h['c2'] - 0.1, 100), (h['c2'], 85), (h['c3'] - 0.1, 115), (h['c3'], 105),
                       (h['warm'] - 0.05, 127)])
    s.expr('violins', [(h['c2'], 70), (h['warm'] - 0.05, 120)])
    # warm: resolution to D add9, the machine stops
    t = h['warm']
    T = s.t1 - t + 1.0
    s.gliss('harp', t - 0.5, t, ['A3', 'D4', 'E4', 'F#4', 'A4', 'D5', 'E5', 'F#5'], vel=50, vel_end=74, dur=3.0)
    for trk, ps, v in [('strings', ['D2', 'A2', 'D3', 'F#3', 'A3', 'E4', 'F#4'], 82), ('horns', ['D3', 'A3', 'F#4'], 70),
                       ('oohs', ['D4', 'F#4', 'A4'], 62)]:
        s.chord(trk, t, T, ps, v)
    s.expr('strings', [(t, 115), (t + 1.2, 90), (s.t1 + 0.5, 70)])
    s.expr('horns', [(t, 100), (s.t1, 60)])
    s.chord('piano', t, T, ['D1', 'D2', 'A3', 'F#4', 'E5'], 62, roll=0.03)
    s.pedal('piano', t + 0.02, t + T)
    s.note('timp', t, 2.0, 'D2', 70)
    s.op('fadeout', s.t1 - 0.2, s.t1 + 1.0)


def c_merge(s):
    h = s.hits
    g = Grid([s.t0, h['相通'], h['rare'], h['peak']], 84, nbeats=[12, 48, 8])
    s.g = g
    # intro: piano + strings + soft taiko building to 相通
    for b0, ch in [(0, 'D'), (4, 'Bm'), (8, 'G'), (10, 'A')]:
        nbt = 4 if b0 < 8 else 2
        piano_flow(s, g, b0, b0 + nbt, ch, vel=44 + b0)
        pad(s, 'strings', g, b0, b0 + nbt, MARCH_V[ch], 60)
    s.expr('strings', [(g(0), 35), (g(12) - 0.05, 95)])
    for k in range(12):
        b = 8 + k / 3
        s.nb('taiko', b, 0.3, 'A1', 36 + 5 * k, legato=1.0)
    s.gliss('harp', h['相通'] - 0.5, h['相通'] - 0.06, ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5'],
            vel=40, vel_end=58, dur=2.5)
    # MAIN THEME, full (bars 12-44), dizi over piano + strings + taiko
    b0 = 12
    for bo, d, p, o in theme(0, 32):
        s.dizi(g(b0 + bo), g.d(b0 + bo, d) * (1.0 if d < 1.5 else 0.97), p, vel=82 + (6 if 16 <= bo < 24 else 0), **o)
    cello_line = [(0, 4, 'F#3'), (4, 2, 'D3'), (6, 2, 'E3'), (8, 4, 'B2'), (12, 4, 'E3'), (16, 2, 'F#3'), (18, 2, 'A3'),
                  (20, 4, 'D3'), (24, 2, 'B2'), (26, 2, 'E3'), (28, 1, 'E3'), (29, 3, 'F#3')]
    for bo, d, p in cello_line:
        s.nb('cello', b0 + bo, d, p, 66, legato=1.02)
    for i, (hb, ch) in enumerate(THEME_HARM):
        nxt = THEME_HARM[i + 1][0] if i + 1 < len(THEME_HARM) else 32
        nbt = nxt - hb
        piano_flow(s, g, b0 + hb, b0 + nxt, ch, vel=50, pedal=True)
        pad(s, 'strings', g, b0 + hb, b0 + nxt, MARCH_V[ch], 66)
        s.nb('cbass', b0 + hb, nbt, root(ch, 1) + 12, 70)
    s.expr('strings', [(g(12), 95), (g(28), 85), (g(36), 100), (g(42), 90), (g(44), 70)])
    for bar in range(8):
        b = b0 + 4 * bar
        s.nb('taiko', b, 1, 'D2', 70 + (8 if bar % 4 == 0 else 0))
        s.nb('taiko', b + 2, 1, 'A1', 60)
        if bar in (3, 7):
            for k in range(4):
                s.nb('taiko', b + 2 + k * 0.5, 0.5, 'D2', 58 + 6 * k)
    tutti(s, h['相通'], 'D1', ['D4', 'A4', 'D5'], vel=86, dur=0.5, taiko=False)
    # lighter under unique_*: koto + piano, strings soft (Bm | G | Em | A)
    for i, ch in enumerate(['Bm', 'G', 'Em', 'A']):
        b = 44 + 4 * i
        koto_ost(s, g, b, b + 4, ch, vel=50, lo=62, hi=81, pat=(0, 2, 1, 3, 2, 4, 3, 1), dur=0.8)
        s.nb('piano', b, 4, root(ch, 2), 46)
        s.chord('piano', g(b + 0.5), g.d(b, 3.4), voicing(ch, 57, 72, 3, skip=0), 40)
        s.pedal('piano', g(b) + 0.03, g(b + 4) - 0.04)
        pad(s, 'strings', g, b, b + 4, MARCH_V[ch][:3], 54)
    s.dizi(g(44.0), g.d(44, 1.0), 'F#5', vel=60, grace='E5')
    s.dizi(g(45.0), g.d(45, 3.0), 'D5', vel=58, end_level=0.3)
    # shimmer build to 越珍贵
    s.expr('strings', [(g(44), 62), (g(56), 55), (g(60), 65), (g(68) - 0.05, 100)])
    for b0_, ch in [(60, 'G'), (64, 'A')]:
        pad(s, 'strings', g, b0_, b0_ + 4, MARCH_V[ch] + [N('A4') if ch == 'A' else N('B4')], 72)
        s.nb('cbass', b0_, 4, root(ch, 1) + 12, 76)
        pad(s, 'choir', g, b0_, b0_ + 4, voicing(ch, 62, 76, 3, skip=0), 64)
        for k in range(16):
            tt_ = tones('D6', 81, 93) if ch == 'G' else tones(ch, 79, 93)   # never G against the dizi's F#
            s.nb('celesta', b0_ + k * 0.25, 0.3, tt_[k % len(tt_)], 28 + (k + (b0_ - 60) * 4) * 0.7)
    s.expr('choir', [(g(60), 30), (g(68) - 0.05, 100)])
    sh = S.shimmer(g(68) - g(60), [N(p) for p in ['A6', 'B6', 'D7', 'E7', 'F#7', 'A7']], density=22, seed=24)
    s.add('bells', g(60), sh * ramp(len(sh), 0.2, 1.0, 'exp')[:, None], gain_db=-21, ir='hall', send=0.4)
    for k in range(24):
        s.nb('taiko', 62 + k / 4, 0.25, 'A1', 36 + 1.8 * k, legato=1.0)
    s.dizi(g(60), g.d(60, 1.5), 'A4', vel=76, slide=-2)
    s.dizi(g(61.5), g.d(61.5, 0.5), 'B4', vel=76)
    s.dizi(g(62), g.d(62, 1.5), 'F#5', vel=80, grace='E5')
    s.dizi(g(63.5), g.d(63.5, 0.5), 'A5', vel=82)
    s.dizi(g(64), g.d(64, 1), 'F#5', vel=82)
    s.dizi(g(65), g.d(65, 0.5), 'E5', vel=80)
    s.dizi(g(65.5), g.d(65.5, 0.5), 'F#5', vel=82)
    s.dizi(g(66), g.d(66, 1), 'A5', vel=86)
    s.dizi(g(67), g.d(67, 1), 'B5', vel=88)
    # peak: D6/9 tutti, dizi holds 5' (A5)
    t = h['peak']
    s.dizi(t, 2.2, 'A5', vel=92, grace='B5', vib=0.26, end_level=0.4)
    s.chord('strings', t, 2.6, ['D2', 'A2', 'D3', 'F#3', 'A3', 'E4', 'F#4', 'B4'], 84)
    s.expr('strings', [(t, 122), (t + 2.2, 70)])
    s.chord('choir', t, 2.4, ['D4', 'F#4', 'A4', 'E5'], 80)
    s.chord('piano', t, 2.8, ['D1', 'D2', 'A3', 'F#4', 'B4', 'E5'], 80, roll=0.02)
    s.pedal('piano', t + 0.02, t + 2.6)
    tutti(s, t, 'D1', ['D4', 'A4', 'D5', 'F#5'], vel=110, crash_db=-20)
    s.gliss('harp', t, t + 0.8, ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6'], vel=60, vel_end=44, dur=1.5)
    s.op('fadeout', s.t1 - 0.2, s.t1 + 1.1)


def c_youth(s):
    h = s.hits
    g = Grid([s.t0, h['masters']], 72, nbeats=[32])
    s.g = g
    bf = SFX_T.get('bad_flute', [0])[0]
    tops = ['F#5', 'D5', 'B4', 'A4', 'A4', 'D5', 'B4', 'A4']
    for i, ch in enumerate(['D', 'Bm', 'G', 'A', 'F#m', 'Bm', 'Em', 'A']):
        b = 4 * i
        quiet = g(b) <= bf + 1.4 and g(b + 4) >= bf - 0.2
        piano_flow(s, g, b, b + 4, ch, vel=(34 if quiet else 42), pat=(0, 3, 4, 5, 4, 3, 2, 3), oct_=2)
        if not quiet:
            s.nb('piano', b, 2.5, tops[i], 46)
        pad(s, 'strings', g, b, b + 4, MARCH_V[ch][:3], 52)
    s.expr('strings', [(g(0), 30), (g(8), 52), (g(20), 45), (g(32), 58)])
    # call & response: a falling koto sigh after 劝退
    s.koto(468.15, 'A4', 54, dur=1.5, bend_to='F#4', bend_at=0.12, bend_t=0.22)
    # masters: the warm craft motif returns (theme head) on piano + koto
    g2 = Grid([h['masters'], s.t1], 72, nbeats=[12])
    for b, ch, ps in [(0, 'D', ['D2', 'A2', 'F#3']), (4, 'Bm', ['B1', 'F#2', 'D3']), (8, 'G', ['G1', 'D2', 'B2']),
                      (10, 'A', ['A1', 'E2', 'D3'])]:
        nbt = 4 if b < 8 else 2
        s.chord('piano', g2(b), g2.d(b, nbt), ps, 42, roll=0.03)
        s.pedal('piano', g2(b) + 0.03, g2(b + nbt) - 0.04)
        pad(s, 'strings', g2, b, b + nbt, MARCH_V[ch][:3], 56)
    for bo, d, p, o in theme(0, 8):
        s.note('piano', g2(bo), g2.d(bo, d) * 0.98, p, 50 if d >= 1 else 46)
    for t, p in [(488.43, 'E5'), (488.52, 'F#5')]:
        s.koto(t, p, 52, dur=1.2)
    s.note('piano', g2(8), g2.d(8, 4), 'A4', 44)
    s.expr('strings', [(g2(0), 55), (g2(12), 66)])
    s.op('fadeout', s.t1 - 0.2, s.t1 + 0.9)


def c_timbre(s):
    h = s.hits
    s.fx['taiko'] = dict(gain=-5)
    s.fx['timp'] = dict(gain=-3)
    g = Grid([s.t0, h['swell'], h['stamp']], 72, nbeats=[9, 16])
    s.g = g
    # pickup: guzheng sweep
    s.gliss('koto', g(0), g(1) - 0.08, ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5', 'A5', 'B5'], vel=46,
            vel_end=66, dur=1.6)
    harm = [(1, 'Bm'), (5, 'G'), (9, 'D'), (13, 'Bm'), (17, 'G'), (19, 'Em'), (21, 'A'), (22, 'D')]
    # featured dizi solo: theme bars 1-2 (苍凉, minor colour) + bars 5-8 (温柔)
    for bo, d, p, o in theme(0, 8):
        o = dict(o)
        o.setdefault('vib', 0.27)
        s.dizi(g(1 + bo), g.d(1 + bo, d), p, vel=80, **o)
    for bo, d, p, o in theme(16, 32):
        s.dizi(g(9 + bo), g.d(9 + bo, d) * (0.97 if d >= 1.5 else 1.0), p, vel=84, **o)
    # guzheng arpeggios + 按滑 ornaments; soft strings, swelling at 'swell'
    for i, (b, ch) in enumerate(harm):
        nxt = harm[i + 1][0] if i + 1 < len(harm) else 25
        koto_ost(s, g, b, nxt, ch, vel=50, lo=50, hi=74, pat=(0, 2, 4, 3, 5, 3, 4, 2), dur=1.0)
        vo = {'Bm': ['B2', 'F#3', 'D4'], 'G': ['G2', 'D3', 'B3'], 'D': ['D3', 'A3', 'F#4'], 'Em': ['E3', 'B3', 'D4'],
              'A': ['A2', 'E3', 'D4']}[ch]
        pad(s, 'strings', g, b, nxt, vo, 60)
        s.nb('cbass', b, nxt - b, root(ch, 1) + 12, 60)
    s.expr('strings', [(g(1), 40), (h['swell'] - 0.05, 48), (h['swell'] + 0.4, 70), (g(17), 106), (g(25) - 0.05, 118)])
    s.koto(g(4.5), 'A4', 54, dur=1.2, bend_to='B4', bend_at=0.12)
    s.koto(g(8.5), 'E5', 54, dur=1.2, bend_to='F#5', bend_at=0.12)
    # taiko build into the stamp at 无法速成
    for b in np.arange(17, 21, 1.0):
        s.nb('taiko', b, 0.5, 'D2', 58 + (b - 17) * 3)
    for b in np.arange(21, 23, 0.5):
        s.nb('taiko', b, 0.5, 'D2', 72 + (b - 21) * 6)
    for b in np.arange(23, 25, 0.25):
        s.nb('taiko', b, 0.25, 'A1' if (b * 4) % 2 else 'D2', 86 + (b - 23) * 12)
    for b in np.arange(23, 25, 1 / 6):
        s.nb('timp', b, 0.2, 'A1', 50 + (b - 23) * 30, legato=1.0)
    t = h['stamp']
    tutti(s, t, 'D1', ['D4', 'A4', 'D5', 'F#5'], vel=118, dur=0.8)
    s.chord('violins', t, 2.2, ['D4', 'A4', 'D5', 'F#5'], 104)
    s.chord('cbass', t, 2.2, ['D2'], 104)
    s.chord('piano', t, 2.0, ['D1', 'D2', 'A2'], 96)
    s.note('okit', t, 2.0, 59, 96)
    s.expr('violins', [(t, 120), (t + 2.0, 45)])
    rc = S.reverse_cymbal(1.35, seed=25)
    s.add('perc', s.t1 - 1.35, rc, gain_db=-22)
    s.op('fadeout', s.t1 - 0.2, s.t1 + 0.3)


def c_climax(s):
    h = s.hits
    s.fx['taiko'] = dict(gain=-3)
    s.fx['timp'] = dict(gain=-2)
    g = Grid([s.t0, h['apex'], h['fade_out_end']], 76, nbeats=[10, 16])
    s.g = g
    t = h['start']
    # big hit: the commodity chord (Bm), then sustained, receding
    tutti(s, t, 'B0', ['B3', 'D4', 'F#4', 'B4'], vel=122, dur=0.9, crash_db=-16)
    s.chord('piano', t, 3.0, ['B0', 'B1', 'F#2'], 112)
    s.pedal('piano', t + 0.02, t + 2.8)
    s.chord('cbass', t, g.d(0, 6), ['B1'], 110)
    s.chord('cello', t, g.d(0, 6), ['B2', 'F#3'], 104)
    s.chord('strings', t, g.d(0, 6), ['B3', 'D4', 'F#4', 'B4'], 98)
    s.chord('horns', t, g.d(0, 6), ['B3', 'F#4'], 100)
    s.chord('choir', t, g.d(0, 6), ['B3', 'D4', 'F#4'], 86)
    for trk in ['cbass', 'cello', 'strings', 'horns', 'choir']:
        s.expr(trk, [(t, 125), (t + 1.6, 72), (g(6) - 0.05, 66)])
    # crescendo to the apex: G -> A sus, timp roll, rising violins
    for b, ch, vo in [(6, 'G', ['G1', 'G2', 'D3', 'B3', 'D4', 'G4']), (8, 'A', ['A1', 'A2', 'E3', 'A3', 'D4', 'E4'])]:
        s.chord('strings', g(b), g.d(b, 2), vo[2:], 96)
        s.chord('cbass', g(b), g.d(b, 2), vo[:1], 100)
        s.chord('cello', g(b), g.d(b, 2), vo[1:3], 96)
        s.chord('horns', g(b), g.d(b, 2), vo[3:5], 92)
        s.chord('choir', g(b), g.d(b, 2), vo[3:], 84)
    for trk in ['cbass', 'cello', 'strings', 'horns', 'choir']:
        s.expr(trk, [(g(6), 60), (g(10) - 0.05, 104)])
    for k, p in enumerate(['D5', 'E5', 'F#5', 'A5']):
        s.nb('violins', 6 + k, 1, p, 80 + 8 * k)
    s.expr('violins', [(g(6), 64), (g(10) - 0.05, 104)])
    for k in range(4 * 8):
        b = 6 + k / 8
        s.nb('timp', b, 0.15, 'A1', 40 + 1.6 * k, legato=1.0)
    rc = S.reverse_cymbal(2.4, seed=27)
    s.add('perc', h['apex'] - 2.4, rc, gain_db=-21)
    # apex 作品: D add9 tutti, cymbal + choir
    t = h['apex']
    tutti(s, t, 'D1', ['D4', 'F#4', 'A4', 'D5', 'E5'], vel=127, dur=1.0, crash_db=-13)
    s.note('okit', t, 4.0, 57, 100)
    s.chord('piano', t, 4.0, ['D1', 'D2', 'A2', 'D4', 'F#4', 'A4', 'E5'], 110, roll=0.015)
    s.pedal('piano', t + 0.02, t + 4.0)
    D_ = g.d(10, 16) + 0.3
    s.chord('cbass', t, D_, ['D2'], 112)
    s.chord('cello', t, D_, ['D3', 'A3'], 104)
    s.chord('horns', t, g.d(10, 8), ['D4', 'A4'], 104)
    s.chord('choir', t, g.d(10, 8), ['D4', 'F#4', 'A4', 'E5'], 100)
    # sustained theme, softening: strings + dizi carry theme bars 5-8
    for bo, d, p, o in theme(16, 32):
        s.nb('violins', 10 + bo, d, p + 12, 92, legato=1.02)
        s.dizi(g(10 + bo), g.d(10 + bo, d), p, vel=86 - bo * 0.6, **o)
    for b, ch in [(10, 'D'), (14, 'Bm'), (18, 'G'), (20, 'Em'), (22, 'A'), (23, 'D')]:
        nxt = {10: 14, 14: 18, 18: 20, 20: 22, 22: 23, 23: 26}[b]
        pad(s, 'strings', g, b, nxt, MARCH_V[ch], 82)
    s.expr('strings', [(t, 127), (g(14), 110), (g(20), 82), (g(26) - 0.3, 30)])
    s.expr('violins', [(t, 120), (g(14), 105), (g(20), 80), (g(26) - 0.3, 28)])
    s.expr('cbass', [(t, 127), (g(14), 100), (g(26) - 0.3, 25)])
    s.expr('cello', [(t, 127), (g(14), 100), (g(26) - 0.3, 25)])
    s.expr('horns', [(t, 127), (g(14), 80), (g(18), 40)])
    s.expr('choir', [(t, 127), (g(14), 90), (g(18), 45)])
    s.op('fadeout', h['fade_out_end'] - 1.6, h['fade_out_end'])


def c_finale(s):
    h = s.hits
    # sparse piano after 只是
    t = h['piano_in']
    s.chord('piano', t, 3.0, ['D2', 'A2', 'F#4'], 44, roll=0.03)
    for tt, p, v in [(540.95, 'E5', 36), (541.85, 'D5', 34), (542.8, 'A4', 34), (543.7, 'B4', 36)]:
        s.note('piano', tt, 2.0, p, v)
    s.pedal('piano', t + 0.02, h['dizi_in'] - 0.05)
    # dizi enters and climbs to 3' (F#5) exactly on 被看见
    s.dizi(h['dizi_in'], 1.55, 'A4', vel=72, slide=-2, slide_t=0.25, vib=0.22)
    s.dizi(546.05, 0.6, 'B4', vel=74)
    s.dizi(546.68, 0.82, 'D5', vel=78)
    s.dizi(547.52, 1.82, 'E5', vel=82, vib=0.24, swell=0.25)
    tb = h['被看见']
    s.dizi(tb, 1.2, 'F#5', vel=94, grace='E5', vib=0.27, end_level=0.9)
    s.dizi(tb + 1.22, h['end_card'] - tb - 1.22, 'E5', vel=82, vib=0.0)
    s.dizi(h['end_card'], 1.9, 'D5', vel=80, vib=0.24, end_level=0.25, grace='E5', grace_t=0.06)
    # strings build from A sus to the warm D add9 swell
    s.chord('strings', 546.0, tb - 546.0 + 0.05, ['A2', 'E3', 'B3', 'D4'], 70)
    s.expr('strings', [(546.0, 25), (tb - 0.05, 112)])
    s.chord('cbass', 546.0, tb - 546.0 + 0.05, ['A1'], 70)
    s.expr('cbass', [(546.0, 30), (tb - 0.05, 100)])
    s.gliss('harp', tb - 0.55, tb - 0.06, ['A3', 'D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5'], vel=42, vel_end=60, dur=3.0)
    s.chord('harp', tb, 3.0, ['D3', 'A3', 'F#4', 'D5', 'F#5'], 76)
    T = h['end_card'] - tb
    s.chord('strings', tb, T + 0.05, ['D3', 'A3', 'E4', 'F#4', 'A4'], 84)
    s.chord('cbass', tb, T + 0.05, ['D2'], 90)
    s.chord('cello', tb, T + 0.05, ['D3', 'A3'], 84)
    s.chord('horns', tb, T + 0.05, ['A3', 'F#4'], 70)
    s.chord('choir', tb, T + 0.05, ['D4', 'F#4', 'A4', 'E5'], 80)
    s.chord('piano', tb, T, ['D1', 'D2', 'A3', 'F#4', 'E5'], 84, roll=0.012)
    s.note('timp', tb, 2.0, 'D2', 66)
    s.note('okit', tb, 3.0, 59, 64)
    s.pedal('piano', tb + 0.02, h['end_card'] - 0.04)
    for trk in ['strings', 'cello', 'horns', 'choir']:
        s.expr(trk, [(tb, 112), (tb + 0.6, 122), (h['end_card'] - 0.05, 100)])
    # end card: 9th resolves to the root, final quote of the theme head, decay
    t = h['end_card']
    T2 = DUR - t
    s.chord('strings', t, T2, ['D3', 'A3', 'D4', 'F#4', 'A4'], 74)
    s.chord('cbass', t, T2, ['D2'], 76)
    s.chord('choir', t, 2.6, ['D4', 'F#4', 'A4'], 70)
    s.chord('piano', t, T2, ['D1', 'D2', 'A2', 'D4', 'F#4', 'A4', 'D5'], 62, roll=0.03)
    s.pedal('piano', t + 0.02, DUR)
    s.gliss('harp', t, t + 0.9, ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'], vel=56, vel_end=46, dur=3.0)
    for trk in ['strings', 'cbass', 'choir']:
        s.expr(trk, [(t, 100), (DUR - 0.2, 25)])
    for tt, d, p, v in [(552.05, 0.42, 'A5', 52), (552.47, 0.24, 'B5', 50), (552.72, 2.0, 'F#6', 56)]:
        s.note('celesta', tt, d * 1.6, p, v)
    s.fx['celesta'] = dict(ir='big', send=0.45)
    s.op('fadeout', DUR - 1.6, DUR - 0.01)


COMPOSERS = {
    'open': (c_open, dict(pre=0.0, post=2.0, gain_db=0)),
    'loud': (c_loud, dict(pre=0.0, post=2.0, gain_db=0)),
    'night': (c_night, dict(pre=0.0, post=4.0, gain_db=-1)),
    'craft': (c_craft, dict(pre=1.0, post=4.0, gain_db=0)),
    'cruel': (c_cruel, dict(pre=0.0, post=3.0, gain_db=0)),
    'traffic': (c_traffic, dict(pre=0.0, post=1.0, gain_db=-1)),
    'realize': (c_realize, dict(pre=0.0, post=4.0, gain_db=0)),
    'tracks': (c_tracks, dict(pre=1.0, post=4.0, gain_db=0)),
    'market': (c_market, dict(pre=0.0, post=1.0, gain_db=0)),
    'irony': (c_irony, dict(pre=0.0, post=3.0, gain_db=0)),
    'painter': (c_painter, dict(pre=0.0, post=4.0, gain_db=0)),
    'me': (c_me, dict(pre=0.0, post=1.0, gain_db=0)),
    'march': (c_march, dict(pre=0.0, post=4.0, gain_db=0)),
    'books': (c_books, dict(pre=0.0, post=1.0, gain_db=0)),
    'roots': (c_roots, dict(pre=0.0, post=4.0, gain_db=0)),
    'copy': (c_copy, dict(pre=0.0, post=4.0, gain_db=0)),
    'merge': (c_merge, dict(pre=0.0, post=4.0, gain_db=0)),
    'youth': (c_youth, dict(pre=0.0, post=4.0, gain_db=0)),
    'timbre': (c_timbre, dict(pre=0.0, post=3.0, gain_db=0)),
    'climax': (c_climax, dict(pre=0.0, post=2.0, gain_db=0)),
    'finale': (c_finale, dict(pre=0.0, post=0.5, gain_db=0)),
}

# section gain trims (dB) after listening-by-numbers in qa.py
SECTION_TRIM = {'open': -0.4, 'loud': -10.0, 'night': 4.5, 'craft': 4.5, 'cruel': 0.0, 'traffic': -6.5,
                'realize': -1.2, 'tracks': 1.9, 'market': 0.0, 'irony': 4.2, 'painter': 0.2, 'me': -2.0,
                'march': -0.2, 'books': 8.5, 'roots': -1.0, 'copy': -2.2, 'merge': -3.2, 'youth': 10.4,
                'timbre': -2.9, 'climax': -5.7, 'finale': -2.4}


def silence_windows(cues):
    """music must be (near) silent here: (t0, t1, label)"""
    sec = {s['key']: s for s in cues['sections']}
    w = []
    w.append((sec['loud']['hits']['stop'] + 0.62, sec['night']['t0'], 'loud tape-stop -> night'))
    w.append((sec['traffic']['hits']['cut'] + 0.005, sec['realize']['t0'], 'traffic hard cut'))
    w.append((sec['market']['hits']['stop'] + 0.005, sec['irony']['t0'], 'market abrupt stop'))
    w.append((sec['me']['hits']['silence'], sec['march']['t0'], 'me silence before march'))
    w.append((sec['books']['hits']['silence'] + 0.005, sec['roots']['hits']['gong'], 'books cut at 他说 -> gong'))
    w.append((sec['climax']['hits']['fade_out_end'], sec['finale']['hits']['piano_in'], 'climax fade -> 只是 -> piano_in'))
    return w


def main():
    t_start = time.time()
    cues = CUES
    secs = []
    for cue in cues['sections']:
        fn, kw = COMPOSERS[cue['key']]
        kw = dict(kw)
        kw['gain_db'] = kw.get('gain_db', 0) + SECTION_TRIM.get(cue['key'], 0)
        s = Sec(cue, SPEECH, **kw)
        fn(s)
        if not any(o[0] in ('fadeout', 'cut') for o in s.ops):
            s.op('fadeout', s.t1, s.t1 + s.xfade)
        secs.append(s)
    # note list for QA (pitch checks)
    import json
    notes = []
    for s in secs:
        for trk, evs in s.ev.items():
            on = {}
            for t, pr, kind, d in sorted(evs, key=lambda e: (e[0], e[1])):
                if kind == 'on':
                    on[(d[0], d[1])] = (t, d[2])
                elif kind == 'off' and (d[0], d[1]) in on:
                    t0_, v = on.pop((d[0], d[1]))
                    notes.append(dict(sec=s.key, trk=trk, t=round(t0_, 4), dur=round(t - t0_, 4), p=d[1], v=v))
    os.makedirs(os.path.join(BUILD, 'score_work'), exist_ok=True)
    with open(os.path.join(BUILD, 'score_work', 'notes.json'), 'w') as fh:
        json.dump(notes, fh)
    print(f'composed {len(secs)} sections, {sum(len(v) for s in secs for v in s.ev.values())} midi events '
          f'({time.time() - t_start:.1f}s)')
    wavs, nr = render_sections(secs)
    print(f'rendered {nr} new midi stems ({len(wavs)} total) ({time.time() - t_start:.1f}s)')
    n = int(round(DUR * SR))
    stems = {f: np.zeros((n, 2), np.float32) for f in FAMILIES}
    for s in secs:
        fam = assemble(s, wavs)
        i0 = int(round(s.a * SR))
        for f, x in fam.items():
            j1 = min(n, i0 + len(x))
            stems[f][i0:j1] += x[:j1 - i0].astype(np.float32)
    print(f'assembled ({time.time() - t_start:.1f}s)')
    # hard silence windows (kill any residue: tails, denormals)
    for a, b, _ in silence_windows(cues):
        i, j = int(round(a * SR)), int(round(b * SR))
        for f in stems:
            stems[f][i:j] = 0
    # final fade at the very end
    k = int(0.05 * SR)
    for f in stems:
        stems[f][-k:] *= np.linspace(1, 0, k, dtype=np.float32)[:, None]
    music = sum(stems.values())
    pk = float(np.max(np.abs(music)))
    scale = db2a(-1.0) / pk
    os.makedirs(os.path.join(BUILD, 'stems'), exist_ok=True)
    for f, x in stems.items():
        write(os.path.join(BUILD, 'stems', f'{f}.wav'), x * scale)
    write(os.path.join(BUILD, 'music.wav'), music * scale)
    with open(os.path.join(BUILD, 'stems', 'scale.txt'), 'w') as fh:
        fh.write(f'{scale:.6f}\n')
    print(f'music.wav written, peak normalised -1 dBFS (scale {20 * np.log10(scale):+.1f} dB) '
          f'({time.time() - t_start:.1f}s)')


if __name__ == '__main__':
    main()
