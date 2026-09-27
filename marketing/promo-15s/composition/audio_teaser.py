"""Soundtrack for the pre-launch teaser (teaser.html) — the "estetik" lo-fi version.

Warm electric piano (FM, Rhodes-style, tape wow) on the J-pop "royal road"
progression (王道進行: IV–V–iii–vi), sparse koto, half-time lo-fi drums with
swung hats, round bass, vinyl crackle, reverse-piano swells instead of noise
risers, and a soft tape-style master. All synthesised from scratch (synth.py).

The picture grid is 132 BPM (bar = 1.818 s, 11 bars = exactly 20.000 s); the
drums play half-time on that grid, so it feels like a relaxed ~66 BPM beat
while every scene change still lands on a downbeat.

Bars: 1-2 hook | 3-5 Gijinkoku / Tokutei Ginou / Ginou | 6 日本語 (breakdown) |
7-9 route map with EzNihongo | 10-11 SEGERA HADIR.
"""
import json
import re
import subprocess
import numpy as np
from scipy.io import wavfile

import synth
from synth import (place, bar, note_hz, koto, tick, bell, bloop, lift_pop, whoosh, brush, lp,
                   ep_chord, wow, lofi_kick, lofi_snare, soft_hat, upright, crackle, air_pad)

synth.setup(dur=20.0, bpm=132)
from synth import SR, N, BAR, BEAT, S16, PUMP_TRIG  # noqa: E402

VOICING = {
    'Gmaj9': ('G2', ['B3', 'D4', 'F#4', 'A4']),
    'A7sus4': ('A2', ['G3', 'D4', 'E4', 'A4']),
    'Dmaj9': ('D2', ['C#4', 'E4', 'F#4', 'A4']),
    'Gmaj7': ('G2', ['B3', 'D4', 'F#4', 'G4']),
    'A7': ('A2', ['G3', 'C#4', 'E4', 'A4']),
    'F#m7': ('F#2', ['E3', 'A3', 'C#4', 'F#4']),
    'Bm7': ('B2', ['A3', 'D4', 'F#4', 'B4']),
    'Bm9': ('B2', ['A3', 'C#4', 'D4', 'F#4']),
    'Em9': ('E2', ['D4', 'F#4', 'G4', 'B4']),
    'A13': ('A2', ['G3', 'C#4', 'F#4', 'B4']),
}
# (bar, beat, chord): hook asks on IV, tenses on V, answers "Nggak harus." on I,
# then the royal road under the three routes and the route map, ii–V–I into the end card.
CHANGES = [
    (1, 0, 'Gmaj9'), (2, 0, 'A7sus4'), (2, 1, 'Dmaj9'),
    (3, 0, 'Gmaj7'), (4, 0, 'A7'), (5, 0, 'F#m7'), (5, 2, 'Bm7'),
    (6, 0, 'Bm9'),
    (7, 0, 'Gmaj7'), (8, 0, 'A7'), (8, 2, 'F#m7'), (9, 0, 'Em9'), (9, 2, 'A13'),
    (10, 0, 'Dmaj9'),
]
GROOVE_BARS = (3, 4, 5, 7, 8, 9)

# ---- electric piano bus (gets tape wow as a whole)
EPL = np.zeros(N)
EPR = np.zeros(N)


def ep_at(t, name, dur, vel):
    l, r = ep_chord(VOICING[name][1], dur, vel)
    i = int(t * SR)
    n = min(len(l), N - i)
    EPL[i:i + n] += l[:n]
    EPR[i:i + n] += r[:n]


for k, (b, bt, name) in enumerate(CHANGES):
    t0 = bar(b, bt)
    t1 = bar(*CHANGES[k + 1][:2]) if k + 1 < len(CHANGES) else synth.DUR
    dur = t1 - t0
    vel = {1: 0.62, 2: 0.7, 6: 0.5, 10: 0.9}.get(b, 0.78)
    ep_at(t0, name, dur + 0.25, vel)
    if dur > BAR * 0.9 and b not in (6, 10):          # soft syncopated re-hit on the "and" of 2
        ep_at(t0 + 1.5 * BEAT, name, 0.55, vel * 0.45)
    root = VOICING[name][0]
    if b >= 2 and b != 6 or (b, bt) == (2, 1):
        place(upright(note_hz(root), min(dur, 1.6)), t0, 0.72 if b != 10 else 0.85, pump=True)
    # soft pad glue under everything except the hook question
    if b >= 2:
        place(air_pad(VOICING[name][1], dur + 0.4, attack=0.25 if b != 6 else 0.6), t0, 1.0 if b != 6 else 1.3, rev=0.4)

# reverse-piano swells lead into bars 3, 7 and 10 (instead of noise risers)
for target, name in ((3, 'Gmaj7'), (7, 'Gmaj7'), (10, 'Dmaj9')):
    l, r = ep_chord(VOICING[name][1], 1.0, 0.8, strum=0.0)
    ln = int(0.9 * SR)
    fade = np.linspace(0, 1, ln) ** 1.5
    place(None, bar(target) - 0.9, 0.9, st=(l[:ln][::-1] * fade, r[:ln][::-1] * fade), rev=0.5)

ep_l, ep_r = wow(EPL), wow(EPR)
place(None, 0.0, 1.0, st=(ep_l, ep_r), rev=0.3)

# ---- half-time lo-fi drums, swung hats
for b in GROOVE_BARS:
    kicks = [0, 10] if b % 2 else [0, 7, 10]
    if b == 9:
        kicks = [0, 7]
    for p_ in kicks:
        place(lofi_kick(), bar(b, 0, p_), 0.9)
        PUMP_TRIG.append(bar(b, 0, p_))
    place(lofi_snare(), bar(b, 0, 8), 0.75, pan=0.05, rev=0.3)
    for p_ in range(0, 16, 2):
        swing = 0.035 if p_ % 4 == 2 else 0.0
        place(soft_hat(), bar(b, 0, p_) + swing, 0.55 if p_ % 4 else 0.8, pan=0.3)
    if b in (4, 8):
        place(soft_hat(), bar(b, 0, 13), 0.35, pan=0.35)
place(lofi_snare(), bar(9, 0, 14), 0.35, rev=0.4)       # ghost snare pickup into the end card
# hook: a single soft kick under the question and under the answer
for t in (bar(1), bar(2, 1)):
    place(lofi_kick(), t, 0.75)

# ---- koto: sparse, airy, pentatonic
place_k = lambda t, nm, g=0.5, pan=0.0, d=1.6: place(koto(note_hz(nm), d), t, g, pan=pan, rev=0.55)  # noqa: E731
for beat, nm in [(0, 'B4'), (1, 'D5'), (2, 'F#5')]:      # one pluck per hook word
    place_k(bar(1, beat), nm, 0.7, -0.15 + 0.12 * beat)
place_k(bar(2, 1) + 0.02, 'A5', 0.5, 0.2)
KOTO = {
    3: [(4, 'A4'), (6, 'B4'), (10, 'D5')],
    4: [(2, 'E5'), (6, 'A4'), (10, 'B4'), (12, 'E5')],
    5: [(0, 'F#5'), (4, 'E5'), (8, 'D5'), (12, 'B4')],
    7: [(4, 'A4'), (6, 'B4'), (10, 'D5'), (14, 'E5')],
    8: [(2, 'F#5'), (6, 'E5'), (10, 'A4'), (12, 'B4')],
    9: [(2, 'B4'), (4, 'D5'), (8, 'E5'), (12, 'F#5')],
}
for b, notes in KOTO.items():
    for p_, nm in notes:
        place_k(bar(b, 0, p_), nm, 0.42, 0.3 * np.sin(p_ + b), 1.3)
for i, nm in enumerate(['D5', 'F#5', 'A5']):             # 日・本・語 in the breakdown
    place_k(bar(6) + i * BEAT / 2, nm, 0.75, -0.2 + 0.2 * i, 2.0)
place_k(bar(6, 2), 'B5', 0.35, 0.1, 1.8)
for i, nm in enumerate(['D4', 'F#4', 'A4', 'D5', 'E5', 'F#5', 'A5']):   # slow strum on the resolve
    place_k(bar(10) + i * 0.032, nm, 0.4, -0.35 + i * 0.11, 2.4)
for i, nm in enumerate(['B4', 'D5', 'E5', 'F#5']):       # sign-off motif, quiet
    place_k(bar(11) + i * BEAT / 2, nm, 0.28, -0.2 + 0.13 * i, 1.8)
place_k(bar(11, 2), 'A5', 0.24, 0.1, 2.0)
place(lofi_kick(), bar(10), 0.8)

# ---- vinyl crackle bed (independent L/R)
cl, cr = crackle(synth.DUR), crackle(synth.DUR)
env = np.minimum(1, np.arange(N) / (0.3 * SR))
place(None, 0.0, 1.0, st=(cl * env * 1.6, cr * env * 1.6))

# ---- SFX synced to teaser.html (softened to sit inside the lo-fi mix)
SFX = {
    'hook_ticks': [bar(1, 0), bar(1, 1), bar(1, 2)],
    'strike': bar(2) - 0.04,                        # red brush crosses out "harus"
    'nggak': bar(2, 1),                             # "Nggak harus."
    'whoosh': [bar(3) - 0.3, bar(6) - 0.26, bar(7) - 0.26],
    'route_cuts': [bar(4), bar(5)],                 # Gijinkoku -> Tokutei Ginou -> Ginou
    'no_lpk': [bar(3, 1) + 0.05, bar(4, 1) + 0.05, bar(5, 1) + 0.05],  # "Tanpa lewat LPK" chip per route
    'stations': [bar(7) + 0.1, bar(8) + 0.1, bar(9) + 0.1],
    'brush': bar(10) - 0.3,                         # red iris into the end card
    'dot': bar(10, 1),                              # red dot lands on the logo "i"
    'segera': bar(10, 2),                           # SEGERA HADIR
}


def soft(st, f=3800):
    return lp(st[0], f), lp(st[1], f)


for t in SFX['hook_ticks']:
    place(tick(), t, 0.3, pan=0.2, rev=0.3)
place(lp(brush(0.26), 5000), SFX['strike'], 0.6, pan=-0.2, rev=0.3)
for t in SFX['whoosh']:
    place(None, t, 0.3, st=soft(whoosh(0.42, 400, 3500)), rev=0.35)
for t in SFX['route_cuts']:
    place(None, t - 0.12, 0.2, st=soft(whoosh(0.2, 700, 4000, 0.7)), rev=0.2)
for i, t in enumerate(SFX['no_lpk']):
    place(lp(lift_pop(), 4000), t, 0.4, pan=(0.3 if i % 2 else -0.25), rev=0.3)
for i, t in enumerate(SFX['stations']):
    place(lp(lift_pop(), 4000), t, 0.45, pan=-0.2 + 0.2 * i, rev=0.3)
for i, nm in enumerate(['A5', 'D6']):                   # job-matching station chime
    place(bell(note_hz(nm), 1.2), SFX['stations'][2] + 0.06 + i * 0.1, 0.26, pan=0.15, rev=0.5)
place(lp(brush(0.34), 4500), SFX['brush'], 0.4, pan=0.0, rev=0.3)
place(bloop(), SFX['dot'], 0.45, rev=0.4)
for i, nm in enumerate(['D6', 'A6']):
    place(bell(note_hz(nm), 1.6), SFX['segera'] + i * 0.12, 0.28, pan=-0.1 + 0.2 * i, rev=0.55)

st, peak = synth.master(pump_depth=0.12, rev_decay=0.6, rev_level=0.42, warmth=11000, drive=1.0, thr=0.4)
# Lo-fi keeps its dynamics: instead of squashing to the peak ceiling, trim to -14 LUFS
# (what Reels/TikTok normalise to anyway), measured with ffmpeg's EBU R128 meter.
wavfile.write('music_teaser.wav', SR, st)
meter = subprocess.run(['ffmpeg', '-hide_banner', '-i', 'music_teaser.wav', '-af', 'ebur128', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
lufs = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', meter)[-1])
st = (st * min(10 ** ((-14.0 - lufs) / 20), 0.89 / np.abs(st).max())).astype(np.float32)
wavfile.write('music_teaser.wav', SR, st)
print('measured', lufs, 'LUFS -> trimmed to -14 target')
json.dump({'bpm': 132, 'bar': BAR, 'beat': BEAT, 'sfx': SFX}, open('music_teaser.json', 'w'), indent=1)
print('peak before norm', peak, 'samples', len(st), 'dur', len(st) / SR)
