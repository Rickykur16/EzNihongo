"""Original soundtrack + SFX for the EzNihongo 15s promo.

Everything here is synthesised from scratch (no samples, no loops), so the
result is an original work that can be used commercially.

128 BPM -> one bar = 1.875 s, eight bars = exactly 15.000 s.
Key: D major, koto-style plucks on the D "yo" pentatonic (D E F# A B).
"""
import json
import numpy as np
from scipy import signal
from scipy.io import wavfile

import synth
synth.setup(dur=15.0, bpm=128)
from synth import *  # noqa: E402,F401,F403  (constants reflect the setup above)
from synth import SR, BAR, BEAT, S16, PUMP_TRIG, bar, place  # noqa: E402

# ---------------------------------------------------------------- arrangement
CHORDS = {  # bar -> (bass root, pad voicing)
    1: ('B2', ['B3', 'D4', 'F#4', 'A4']),
    2: ('G2', ['G3', 'B3', 'D4', 'F#4']),
    3: ('D2', ['D4', 'E4', 'F#4', 'A4']),
    4: ('A2', ['A3', 'B3', 'C#4', 'E4']),
    5: ('B2', ['B3', 'D4', 'F#4', 'A4']),
    6: ('G2', ['G3', 'B3', 'D4', 'F#4']),
    7: ('A2', ['A3', 'D4', 'E4', 'A4']),   # Asus4 -> tension into the end card
    8: ('D2', ['D4', 'F#4', 'A4', 'E5']),
}

# Hook: the four plucks spell は・た・ら・く (one per eighth note)
HOOK = [(0.0, 'B4'), (0.5, 'D5'), (1.0, 'E5'), (1.5, 'F#5')]
for beat, nm in HOOK:
    place(koto(note_hz(nm), 1.8), bar(1, beat), 0.95, pan=-0.1 + 0.07 * beat, rev=0.35)
# "bekerja" answer: dyad on beat 3
place(koto(note_hz('A5'), 2.0), bar(1, 2.0), 0.8, 0.15, rev=0.4)
place(koto(note_hz('D5'), 2.0), bar(1, 2.0, 0.3), 0.55, -0.15, rev=0.4)
place(koto(note_hz('B4'), 1.6), bar(1, 3.0), 0.45, 0.1, rev=0.45)

# intro pads (filtered, soft)
place(pad(CHORDS[1][1], BAR + 0.05, cutoff=1300, attack=0.3), bar(1), 0.7, rev=0.4)
place(pad(CHORDS[2][1], BAR + 0.05, cutoff=1700, attack=0.05), bar(2), 0.8, rev=0.4)

# Bar 1 downbeat + bar 2 text hits
for t in (bar(1), bar(2), bar(2, 1)):
    place(kick(0.95), t, 1.0)
    PUMP_TRIG.append(t)
place(sub(note_hz('B2'), 0.9), bar(1), 0.7)
place(sub(note_hz('G2'), 0.4), bar(2), 0.8)
place(sub(note_hz('G2'), 0.4), bar(2, 1), 0.8)
place(clap(), bar(1, 2), 0.45, rev=0.3)

# Bar 2 build: koto tremolo on A4/D5 + snare roll accelerating + riser
for i in range(16):
    t = bar(2, 2) + i * (S16 / 2)
    g = 0.15 + 0.5 * (i / 15)
    place(koto(note_hz('A4' if i % 2 else 'D5'), 0.5, bend=False), t, g * 0.8, pan=0.3 * np.sin(i), rev=0.25)
for i in range(8):
    place(snare_roll_hit(), bar(2, 2) + i * S16, 0.18 + 0.55 * (i / 7), rev=0.2)
place(noise_riser(BAR * 0.98), bar(2), 0.33, rev=0.3)

# Groove bars 3..7
KICKS = [0, 6, 8, 11]          # 16th positions
CLAPS = [4, 12]
KOTO_PAT = {
    3: [(0, 'F#5'), (2, 'E5'), (3, 'D5'), (6, 'A4'), (8, 'D5'), (10, 'E5'), (11, 'F#5'), (14, 'A5')],
    4: [(0, 'E5'), (2, 'C#5'), (3, 'B4'), (6, 'A4'), (8, 'B4'), (10, 'E5'), (12, 'A5'), (14, 'E5')],
    5: [(0, 'F#5'), (2, 'D5'), (3, 'B4'), (6, 'F#4'), (8, 'B4'), (10, 'D5'), (11, 'E5'), (14, 'F#5')],
    6: [(0, 'D5'), (2, 'B4'), (3, 'A4'), (6, 'G4'), (8, 'B4'), (10, 'D5'), (12, 'E5'), (14, 'D5')],
    7: [(0, 'E5'), (2, 'D5'), (3, 'A4'), (6, 'E5'), (8, 'A5'), (10, 'A5'), (12, 'B5'), (13, 'D6')],
}
BASS_PAT = [0, 3, 6, 8, 11, 14]
for b in range(3, 8):
    root, voicing = CHORDS[b]
    for p in KICKS:
        if b == 7 and p > 8:
            continue
        place(kick(1.0), bar(b, 0, p), 1.0)
        PUMP_TRIG.append(bar(b, 0, p))
    for p in CLAPS:
        place(clap(), bar(b, 0, p), 0.75, pan=0.05, rev=0.22)
    for p in range(0, 16, 2):
        place(hat(open_=(p == 14)), bar(b, 0, p), 0.62 if p % 4 else 0.4, pan=0.35)
    for p in (5, 13):
        place(hat(), bar(b, 0, p), 0.2, pan=0.4)
    for p in BASS_PAT:
        place(sub(note_hz(root), S16 * 1.8), bar(b, 0, p), 0.95, pump=True)
    place(pad(voicing, BAR + 0.02, cutoff=2600 if b < 7 else 3200, attack=0.02), bar(b), 1.0, rev=0.35, pump=True)
    for p, nm in KOTO_PAT[b]:
        place(koto(note_hz(nm), 1.1), bar(b, 0, p), 0.72, pan=0.25 * np.sin(p + b), rev=0.3)

# Bar 7 second half: build into the end card
for i in range(8):
    place(snare_roll_hit(), bar(7, 2) + i * S16, 0.2 + 0.5 * (i / 7), rev=0.2)
place(noise_riser(BAR / 2, 600, 10000), bar(7, 2), 0.35, rev=0.3)
rc = crash(0.9)[::-1]
place(rc, bar(8) - len(rc) / SR, 0.9, rev=0.2)

# Bar 8: end card. Big hit, koto strum, sustained chord, dot "pop", last pluck.
place(taiko(), bar(8), 0.95, rev=0.35)
place(kick(1.0), bar(8), 0.8)
place(crash(), bar(8), 0.75, pan=0.1, rev=0.3)
place(sub(note_hz('D2'), 1.5) * np.exp(-np.arange(int(1.5 * SR)) / SR * 1.2), bar(8), 1.0)
for i, nm in enumerate(['D4', 'F#4', 'A4', 'D5', 'E5', 'F#5', 'A5']):
    place(koto(note_hz(nm), 2.2), bar(8) + i * 0.018, 0.5, pan=-0.4 + i * 0.13, rev=0.45)
pd = pad(CHORDS[8][1], DUR - bar(8), cutoff=2200, attack=0.02, release=1.2)
place(pd, bar(8), 1.0, rev=0.5)  # not pumped: sustained resolve

# ---------------------------------------------------------------- SFX (synced to picture)
SFX = {
    'hook_ticks': [bar(1, b) for b, _ in HOOK],
    'whoosh': [bar(2) - 0.2, bar(3) - 0.26, bar(4) - 0.26, bar(5) - 0.26, bar(6) - 0.26, bar(7) - 0.26],
    'tap_dash': bar(3, 3),            # tap "Lanjut Belajar"
    'speaker': bar(4, 2) + 0.02,      # speaker rings on the lifted お客様 card
    'caption': bar(5, 2),             # dialog caption switches to the reply
    'tap_answer': bar(6, 2),          # tap the correct answer
    'brush': bar(8) - 0.3,            # red brush wipe into the end card
    'dot': bar(8, 1),                 # red dot lands on the logo "i"
}
for t in SFX['hook_ticks']:
    place(tick(), t, 0.5, pan=0.2, rev=0.2)
for t in SFX['whoosh']:
    place(None, t, 0.42, st=whoosh(), rev=0.25)
place(tap(), SFX['tap_dash'], 0.9, pan=0.1)
place(tap(), SFX['tap_answer'], 0.9, pan=0.1)
# vocab speaker: soft three-note "audio" ping
for k, g in ((0.0, 0.35), (0.47, 0.2)):
    for i, nm in enumerate(['A5', 'D6']):
        place(bell(note_hz(nm), 0.9), SFX['speaker'] + k + i * 0.09, g, pan=0.25, rev=0.3)
# soft "lift" pops whenever a UI element rises out of the phone
SFX['lift'] = [bar(3, 1) + 0.25, bar(4) + 0.66, bar(4, 2), bar(5) + 0.16, bar(6) + 0.2, bar(6, 2) + 0.08, bar(7) + 0.3]
for i, t in enumerate(SFX['lift']):
    place(lift_pop(), t, 0.5, pan=(-0.3 if i % 2 else 0.3), rev=0.2)
place(tick(), SFX['caption'], 0.55, pan=-0.1)
# correct-answer chime
for i, nm in enumerate(['D6', 'A6']):
    place(bell(note_hz(nm), 1.2), SFX['tap_answer'] + 0.06 + i * 0.1, 0.42, pan=0.15, rev=0.35)
place(brush(0.34), SFX['brush'], 0.55, pan=0.0, rev=0.2)
place(bloop(), SFX['dot'], 0.7, rev=0.3)
place(koto(note_hz('A5'), 1.4), SFX['dot'], 0.4, pan=0.1, rev=0.5)
place(koto(note_hz('D6'), 1.2), bar(8, 2), 0.32, pan=-0.1, rev=0.55)
st, peak = synth.master()
wavfile.write('music_raw.wav', SR, st)
json.dump({'bpm': BPM, 'bar': BAR, 'beat': BEAT, 'sfx': SFX}, open('music_raw.json', 'w'), indent=1)
print('peak before norm', peak, 'samples', len(st), 'dur', len(st) / SR)
