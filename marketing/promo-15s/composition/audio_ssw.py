"""Original soundtrack + SFX for the 20 s "jalur mandiri SSW" promo (ssw.html).

Same sound palette as the 15 s promo (synth.py, all synthesised from scratch),
new arrangement: 132 BPM -> one bar = 1.818 s, eleven bars = exactly 20.000 s.

Bars: 1-2 hook (question, brush strike, "Nggak harus.") | 3 SSW | 4 syarat |
5 日本語 (breakdown) | 6-9 ajakan belajar di EzNihongo | 10-11 end card.
"""
import json
import numpy as np
from scipy.io import wavfile

import synth
from synth import (bar, place, note_hz, kick, clap, hat, snare_roll_hit, koto, pad, sub,  # noqa: F401
                   noise_riser, whoosh, tick, bell, taiko, crash, bloop, lift_pop, brush)

CHORDS = {  # bar -> (bass root, pad voicing)
    1: ('B2', ['B3', 'D4', 'F#4', 'A4']),
    2: ('G2', ['G3', 'B3', 'D4', 'F#4']),
    3: ('D2', ['D4', 'E4', 'F#4', 'A4']),
    4: ('A2', ['A3', 'B3', 'C#4', 'E4']),
    5: ('D2', ['D4', 'F#4', 'A4', 'B4']),   # breakdown under 日本語
    6: ('B2', ['B3', 'D4', 'F#4', 'A4']),
    7: ('G2', ['G3', 'B3', 'D4', 'F#4']),
    8: ('D2', ['D4', 'E4', 'F#4', 'A4']),
    9: ('A2', ['A3', 'D4', 'E4', 'A4']),    # Asus4 build into the end card
    10: ('D2', ['D4', 'F#4', 'A4', 'E5']),
}

KOTO_PAT = {
    3: [(0, 'F#5'), (2, 'E5'), (3, 'D5'), (6, 'A4'), (8, 'D5'), (10, 'E5'), (11, 'F#5'), (14, 'A5')],
    4: [(0, 'E5'), (2, 'C#5'), (3, 'B4'), (6, 'A4'), (8, 'B4'), (10, 'E5'), (12, 'A5'), (14, 'E5')],
    6: [(0, 'F#5'), (2, 'D5'), (3, 'B4'), (6, 'F#4'), (8, 'B4'), (10, 'D5'), (11, 'E5'), (14, 'F#5')],
    7: [(0, 'D5'), (2, 'B4'), (3, 'A4'), (6, 'G4'), (8, 'B4'), (10, 'D5'), (12, 'E5'), (14, 'D5')],
    8: [(0, 'F#5'), (2, 'E5'), (3, 'D5'), (6, 'A4'), (8, 'D5'), (10, 'E5'), (11, 'F#5'), (14, 'A5')],
    9: [(0, 'E5'), (2, 'D5'), (3, 'A4'), (6, 'E5'), (8, 'A5'), (10, 'A5'), (12, 'B5'), (13, 'D6')],
}


def build_bed(chords, koto_pat, before=(3, 4), k=5, after=(6, 7, 8)):
    """Music bed for an 11-bar / 132 BPM promo: hook (bars 1-2), groove, one
    breakdown bar k, groove, build in bar 9, end hit in bar 10 and tail in 11.
    Call synth.setup() first. Bars are parameters so other pieces can move the breakdown."""
    from synth import SR, BAR, BEAT, S16, PUMP_TRIG
    # ---- bars 1-2: hook. One pluck per hook word, answer dyad on "LPK?"
    for beat, nm in [(0.0, 'B4'), (1.0, 'E5')]:
        place(koto(note_hz(nm), 1.8), bar(1, beat), 0.95, pan=-0.1 + 0.07 * beat, rev=0.35)
    place(koto(note_hz('A5'), 2.0), bar(1, 2.0), 0.8, 0.15, rev=0.4)
    place(koto(note_hz('D5'), 2.0), bar(1, 2.0, 0.3), 0.55, -0.15, rev=0.4)
    place(koto(note_hz('B4'), 1.6), bar(1, 3.0), 0.45, 0.1, rev=0.45)
    place(pad(chords[1][1], BAR + 0.05, cutoff=1300, attack=0.3), bar(1), 0.7, rev=0.4)
    place(pad(chords[2][1], BAR + 0.05, cutoff=1700, attack=0.05), bar(2), 0.8, rev=0.4)
    for t in (bar(1), bar(2), bar(2, 1)):
        place(kick(0.95), t, 1.0)
        PUMP_TRIG.append(t)
    place(sub(note_hz('B2'), 0.9), bar(1), 0.7)
    place(sub(note_hz('G2'), 0.4), bar(2), 0.8)
    place(sub(note_hz('G2'), 0.4), bar(2, 1), 0.8)
    place(clap(), bar(1, 2), 0.45, rev=0.3)
    for i in range(16):  # koto tremolo build
        t = bar(2, 2) + i * (S16 / 2)
        place(koto(note_hz('A4' if i % 2 else 'D5'), 0.5, bend=False), t, (0.15 + 0.5 * (i / 15)) * 0.8, pan=0.3 * np.sin(i), rev=0.25)
    for i in range(8):
        place(snare_roll_hit(), bar(2, 2) + i * S16, 0.18 + 0.55 * (i / 7), rev=0.2)
    place(noise_riser(BAR * 0.98), bar(2), 0.33, rev=0.3)

    # ---- groove helper
    KICKS = [0, 6, 8, 11]
    CLAPS = [4, 12]
    BASS_PAT = [0, 3, 6, 8, 11, 14]

    def groove(b, full_bar=True):
        root, voicing = chords[b]
        for p_ in KICKS:
            if not full_bar and p_ > 8:
                continue
            place(kick(1.0), bar(b, 0, p_), 1.0)
            PUMP_TRIG.append(bar(b, 0, p_))
        for p_ in CLAPS:
            place(clap(), bar(b, 0, p_), 0.75, pan=0.05, rev=0.22)
        for p_ in range(0, 16, 2):
            place(hat(open_=(p_ == 14)), bar(b, 0, p_), 0.62 if p_ % 4 else 0.4, pan=0.35)
        for p_ in (5, 13):
            place(hat(), bar(b, 0, p_), 0.2, pan=0.4)
        for p_ in BASS_PAT:
            place(sub(note_hz(root), S16 * 1.8), bar(b, 0, p_), 0.95, pump=True)
        place(pad(voicing, BAR + 0.02, cutoff=2600 if b != 9 else 3200, attack=0.02), bar(b), 1.0, rev=0.35, pump=True)
        for p_, nm in koto_pat[b]:
            place(koto(note_hz(nm), 1.1), bar(b, 0, p_), 0.72, pan=0.25 * np.sin(p_ + b), rev=0.3)


    for b in before:
        groove(b)

    # ---- breakdown bar k. Drums drop out; three plucks spell 日・本・語, soft kick pulse
    place(pad(chords[k][1], BAR + 0.05, cutoff=1500, attack=0.04), bar(k), 1.0, rev=0.5)
    place(sub(note_hz('D2'), BAR * 0.9) * np.exp(-np.arange(int(BAR * 0.9 * SR)) / SR * 1.5), bar(k), 0.8)
    for i, nm in enumerate(['D5', 'F#5', 'A5']):
        place(koto(note_hz(nm), 1.8), bar(k) + i * BEAT / 2, 0.95, pan=-0.2 + 0.2 * i, rev=0.45)
    place(koto(note_hz('B5'), 1.6), bar(k, 2), 0.5, pan=0.1, rev=0.5)
    place(koto(note_hz('A5'), 1.6), bar(k, 2.5), 0.4, pan=-0.1, rev=0.5)
    for bt in (0, 2):
        place(kick(0.7), bar(k, bt), 0.7)
    for i in range(8):  # fill back into the groove
        place(snare_roll_hit(), bar(k, 2) + i * S16, 0.12 + 0.45 * (i / 7), rev=0.2)
    place(noise_riser(BAR / 2, 500, 9000), bar(k, 2), 0.3, rev=0.3)

    # ---- groove after the breakdown, bar 9 builds into the end card
    for b in after:
        groove(b)
    groove(9, full_bar=False)
    for i in range(8):
        place(snare_roll_hit(), bar(9, 2) + i * S16, 0.2 + 0.5 * (i / 7), rev=0.2)
    place(noise_riser(BAR / 2, 600, 10000), bar(9, 2), 0.35, rev=0.3)
    rc = crash(0.9)[::-1]
    place(rc, bar(10) - len(rc) / SR, 0.9, rev=0.2)

    # ---- bars 10-11: end card. Hit, koto strum, sustained chord, sign-off motif
    place(taiko(), bar(10), 0.95, rev=0.35)
    place(kick(1.0), bar(10), 0.8)
    place(crash(), bar(10), 0.75, pan=0.1, rev=0.3)
    place(sub(note_hz('D2'), 1.5) * np.exp(-np.arange(int(1.5 * SR)) / SR * 1.2), bar(10), 1.0)
    for i, nm in enumerate(['D4', 'F#4', 'A4', 'D5', 'E5', 'F#5', 'A5']):
        place(koto(note_hz(nm), 2.2), bar(10) + i * 0.018, 0.5, pan=-0.4 + i * 0.13, rev=0.45)
    place(pad(chords[10][1], synth.DUR - bar(10), cutoff=2200, attack=0.02, release=1.8), bar(10), 1.0, rev=0.5)
    # the hook motif returns quietly as a sign-off (B D E F#)
    for i, nm in enumerate(['B4', 'D5', 'E5', 'F#5']):
        place(koto(note_hz(nm), 1.8), bar(11) + i * BEAT / 2, 0.36, pan=-0.2 + 0.13 * i, rev=0.55)
    place(koto(note_hz('A5'), 2.0), bar(11, 2), 0.3, pan=0.1, rev=0.6)


if __name__ == '__main__':
    synth.setup(dur=20.0, bpm=132)
    from synth import SR, BAR, BEAT, S16  # noqa: E402
    build_bed(CHORDS, KOTO_PAT)

    # ---- SFX synced to ssw.html
    SFX = {
        'hook_ticks': [bar(1, 0), bar(1, 1), bar(1, 2)],
        'strike': bar(2) - 0.04,              # red brush crosses out "harus"
        'nggak': bar(2, 1),                   # "Nggak harus." lands
        'whoosh': [bar(3) - 0.3, bar(4) - 0.26, bar(6) - 0.26],
        'cards': [bar(4) + 0.08, bar(4, 1) + 0.08],
        'focus': bar(4, 2) + 0.06,            # requirement 1: "Mulai dari sini"
        'zoom': bar(5) - 0.36,                # card zooms into the 日本語 scene
        'points': [bar(7), bar(8), bar(9)],   # 01 / 02 / 03 reasons to study with EzNihongo
        'chips': [bar(7, 2)],
        'brush': bar(10) - 0.3,               # red iris into the end card
        'dot': bar(10, 1),                    # red dot lands on the logo "i"
    }
    for t in SFX['hook_ticks']:
        place(tick(), t, 0.5, pan=0.2, rev=0.2)
    place(brush(0.26), SFX['strike'], 0.75, pan=-0.2, rev=0.25)
    thump = taiko()[:int(0.5 * SR)] * np.exp(-np.arange(int(0.5 * SR)) / SR * 6)
    place(thump, SFX['nggak'], 0.55, rev=0.3)
    for t in SFX['whoosh']:
        place(None, t, 0.42, st=whoosh(), rev=0.25)
    for i, t in enumerate(SFX['cards']):
        place(lift_pop(), t, 0.55, pan=(0.3 if i % 2 else -0.2), rev=0.2)
        place(tick(), t + 0.02, 0.4, pan=0.1)
    for i, nm in enumerate(['A5', 'D6']):
        place(bell(note_hz(nm), 1.0), SFX['focus'] + i * 0.09, 0.38, pan=-0.15, rev=0.35)
    place(None, SFX['zoom'], 0.4, st=whoosh(0.4, 300, 3000, 0.85), rev=0.3)
    for i, t in enumerate(SFX['points']):
        place(None, t - 0.12, 0.25, st=whoosh(0.2, 900, 6000, 0.7), rev=0.1)
        place(lift_pop(), t + 0.05, 0.45, pan=(-0.25 if i % 2 else 0.25), rev=0.2)
    for t in SFX['chips']:
        place(lift_pop(), t, 0.45, pan=0.3, rev=0.2)
    place(brush(0.34), SFX['brush'], 0.55, pan=0.0, rev=0.2)
    place(bloop(), SFX['dot'], 0.7, rev=0.3)
    place(koto(note_hz('A5'), 1.4), SFX['dot'], 0.4, pan=0.1, rev=0.5)

    st, peak = synth.master()
    wavfile.write('music_ssw.wav', SR, st)
    json.dump({'bpm': 132, 'bar': BAR, 'beat': BEAT, 'sfx': SFX}, open('music_ssw.json', 'w'), indent=1)
    print('peak before norm', peak, 'samples', len(st), 'dur', len(st) / SR)
