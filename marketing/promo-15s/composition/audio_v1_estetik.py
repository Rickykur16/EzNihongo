"""Estetik soundtrack for the 15 s feature promo (index.html): lo-fi + Japanese colour.
128 BPM picture grid (8 bars = exactly 15.000 s), half-time drums. See lofi_bed.py."""
import synth
synth.setup(dur=15.0, bpm=128)
from synth import place, bar, note_hz, tick, bell, bloop, lift_pop, whoosh, brush, tap, lp, BEAT  # noqa: E402
import lofi_bed  # noqa: E402

lofi_bed.build(
    changes=[(1, 0, 'Bm9'), (2, 0, 'Gmaj9'), (2, 2, 'A7sus4'), (3, 0, 'Dmaj9'), (4, 0, 'Gmaj7'), (5, 0, 'A7'),
             (6, 0, 'F#m7'), (6, 2, 'Bm7'), (7, 0, 'Em9'), (7, 2, 'A13'), (8, 0, 'Dmaj9')],
    groove_bars=(3, 4, 5, 6, 7), quiet_bars=(1,), end_bar=8, hook_kicks=(0.0,),
    swells=((3, 'Dmaj9'), (8, 'Dmaj9')),
    koto_phrases={3: [(4, 'A4'), (6, 'B4'), (10, 'D5')], 4: [(2, 'E5'), (6, 'D5'), (10, 'B4')],
                  5: [(0, 'E5'), (4, 'A4'), (10, 'B4'), (12, 'E5')], 6: [(0, 'F#5'), (4, 'E5'), (8, 'D5'), (12, 'B4')],
                  7: [(2, 'B4'), (4, 'D5'), (8, 'E5'), (12, 'F#5')]},
    # は・た・ら・く: one koto pluck per kana, "bekerja" answered on beat 3
    plucks=[(i * BEAT / 2, nm, 0.72) for i, nm in enumerate(['B4', 'D5', 'E5', 'F#5'])] + [(bar(1, 2), 'A5', 0.55),
            (bar(8, 1), 'A5', 0.4)] + [(bar(8, 2) + i * BEAT / 2, nm, 0.26) for i, nm in enumerate(['B4', 'D5', 'E5', 'F#5'])],
    # shakuhachi over the Tokyo Tower photo ("Mau kerja di Jepang?")
    shaku=[(bar(2) + 0.04, 'A4', 0.85, 0.85), (bar(2, 2), 'B4', 0.42, 0.75), (bar(2, 3), 'D5', 1.0, 0.8)],
    chimes=(bar(1, 2) + 0.05, bar(5, 2) + 0.2, bar(8, 2)), bowls=(0.0,),
)

SFX = {'hook_ticks': [i * BEAT / 2 for i in range(4)],
       'whoosh': [bar(2) - 0.2] + [bar(b) - 0.26 for b in (3, 4, 5, 6, 7)],
       'tap_dash': bar(3, 3), 'speaker': bar(4, 2) + 0.02, 'caption': bar(5, 2), 'tap_answer': bar(6, 2),
       'lift': [bar(3, 1) + 0.25, bar(4) + 0.66, bar(4, 2), bar(5) + 0.16, bar(6) + 0.2, bar(6, 2) + 0.08, bar(7) + 0.3],
       'brush': bar(8) - 0.3, 'dot': bar(8, 1)}
for t in SFX['hook_ticks']:
    place(tick(), t, 0.25, pan=0.2, rev=0.3)
for t in SFX['whoosh']:
    place(None, t, 0.3, st=lofi_bed.soft(whoosh(0.42, 400, 3500)), rev=0.35)
for t in (SFX['tap_dash'], SFX['tap_answer']):
    place(lp(tap(), 5000), t, 0.6, pan=0.1)
for k, g in ((0.0, 0.26), (0.47, 0.16)):
    for i, nm in enumerate(['A5', 'D6']):
        place(bell(note_hz(nm), 1.0), SFX['speaker'] + k + i * 0.09, g, pan=0.25, rev=0.45)
for i, t in enumerate(SFX['lift']):
    place(lp(lift_pop(), 4000), t, 0.38, pan=(-0.3 if i % 2 else 0.3), rev=0.3)
place(tick(), SFX['caption'], 0.35, pan=-0.1)
for i, nm in enumerate(['D6', 'A6']):
    place(bell(note_hz(nm), 1.3), SFX['tap_answer'] + 0.06 + i * 0.1, 0.3, pan=0.15, rev=0.5)
place(lp(brush(0.34), 4500), SFX['brush'], 0.4, rev=0.3)
place(bloop(), SFX['dot'], 0.45, rev=0.4)
lofi_bed.finish('music_v1_estetik.wav')
