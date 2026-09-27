"""Estetik soundtrack for the 20 s SSW promo (ssw.html): lo-fi + Japanese colour.
132 BPM picture grid (11 bars = exactly 20.000 s), half-time drums, breakdown on 日本語 (bar 5)."""
import numpy as np
import synth
synth.setup(dur=20.0, bpm=132)
from synth import place, bar, note_hz, tick, bell, bloop, lift_pop, whoosh, brush, lofi_kick, lp, BEAT  # noqa: E402
import lofi_bed  # noqa: E402

lofi_bed.build(
    changes=[(1, 0, 'Gmaj9'), (2, 0, 'A7sus4'), (2, 1, 'Dmaj9'), (3, 0, 'Gmaj7'), (4, 0, 'A7'), (5, 0, 'Bm9'),
             (6, 0, 'Gmaj7'), (7, 0, 'A7'), (8, 0, 'F#m7'), (8, 2, 'Bm7'), (9, 0, 'Em9'), (9, 2, 'A13'), (10, 0, 'Dmaj9')],
    groove_bars=(3, 4, 6, 7, 8, 9), quiet_bars=(1,), breakdown_bars=(5,), end_bar=10, hook_kicks=(0.0, bar(2, 1)),
    swells=((3, 'Gmaj7'), (6, 'Gmaj7'), (10, 'Dmaj9')),
    koto_phrases={3: [(4, 'A4'), (6, 'B4'), (10, 'D5')], 4: [(2, 'E5'), (6, 'A4'), (10, 'B4'), (12, 'E5')],
                  6: [(4, 'A4'), (6, 'B4'), (10, 'D5'), (14, 'E5')], 7: [(2, 'E5'), (6, 'D5'), (10, 'B4')],
                  8: [(2, 'F#5'), (6, 'E5'), (10, 'A4'), (12, 'B4')], 9: [(2, 'B4'), (4, 'D5'), (8, 'E5'), (12, 'F#5')]},
    plucks=[(bar(1, 0), 'B4', 0.7), (bar(1, 1), 'D5', 0.7), (bar(1, 2), 'F#5', 0.7), (bar(2, 1) + 0.02, 'A5', 0.5)]
          + [(bar(5) + i * BEAT / 2, nm, 0.75) for i, nm in enumerate(['D5', 'F#5', 'A5'])]      # 日・本・語
          + [(bar(10, 1), 'A5', 0.4)] + [(bar(11) + i * BEAT / 2, nm, 0.26) for i, nm in enumerate(['B4', 'D5', 'E5', 'F#5'])],
    # shakuhachi over Tokyo Tower (SSW) and a long breath in the 日本語 breakdown
    shaku=[(bar(3) + 0.1, 'A4', 1.1, 0.75), (bar(3, 3) - 0.05, 'D5', 0.8, 0.65), (bar(5, 2), 'B4', 1.4, 0.7)],
    chimes=(bar(2, 1) + 0.1, bar(5) + 0.05, bar(10, 2)), bowls=(0.0,),
)

SFX = {'hook_ticks': [bar(1, 0), bar(1, 1), bar(1, 2)], 'strike': bar(2) - 0.04, 'nggak': bar(2, 1),
       'whoosh': [bar(3) - 0.3, bar(4) - 0.26, bar(6) - 0.26], 'cards': [bar(4) + 0.08, bar(4, 1) + 0.08],
       'focus': bar(4, 2) + 0.06, 'zoom': bar(5) - 0.36, 'points': [bar(7), bar(8), bar(9)],
       'chips': [bar(7, 2), bar(8, 2)], 'brush': bar(10) - 0.3, 'dot': bar(10, 1)}
for t in SFX['hook_ticks']:
    place(tick(), t, 0.3, pan=0.2, rev=0.3)
place(lp(brush(0.26), 5000), SFX['strike'], 0.6, pan=-0.2, rev=0.3)
for t in SFX['whoosh']:
    place(None, t, 0.3, st=lofi_bed.soft(whoosh(0.42, 400, 3500)), rev=0.35)
for i, t in enumerate(SFX['cards']):
    place(lp(lift_pop(), 4000), t, 0.4, pan=(0.3 if i % 2 else -0.2), rev=0.3)
for i, nm in enumerate(['A5', 'D6']):
    place(bell(note_hz(nm), 1.2), SFX['focus'] + i * 0.09, 0.28, pan=-0.15, rev=0.5)
place(None, SFX['zoom'], 0.3, st=lofi_bed.soft(whoosh(0.4, 300, 3000, 0.85)), rev=0.4)
for i, t in enumerate(SFX['points']):
    place(None, t - 0.12, 0.18, st=lofi_bed.soft(whoosh(0.2, 700, 4000, 0.7)), rev=0.2)
    place(lp(lift_pop(), 4000), t + 0.05, 0.35, pan=(-0.25 if i % 2 else 0.25), rev=0.3)
for t in SFX['chips']:
    place(lp(lift_pop(), 4000), t, 0.35, pan=0.3, rev=0.3)
place(lp(brush(0.34), 4500), SFX['brush'], 0.4, rev=0.3)
place(bloop(), SFX['dot'], 0.45, rev=0.4)
lofi_bed.finish('music_ssw_estetik.wav')
