"""Lo-fi "estetik" bed with Japanese colour, shared by the estetik versions of the
15 s feature promo (audio_v1_estetik.py) and the 20 s SSW promo (audio_ssw_estetik.py).

Electric piano (FM, tape wow) on J-pop/city-pop changes, half-time drums with swung
hats, round bass, vinyl crackle, sparse koto, shakuhachi phrases, fūrin chimes and a
rin bowl, reverse-piano swells into the big moments. All synthesised (synth.py).
Call synth.setup() first, then build(), then place picture-synced SFX, then finish().
"""
import re
import subprocess
import numpy as np
from scipy.io import wavfile

import synth
from synth import (place, bar, note_hz, koto, ep_chord, wow, lofi_kick, lofi_snare, soft_hat,
                   upright, crackle, air_pad, shakuhachi, furin, rin, lp)

VOICING = {
    'Gmaj9': ('G2', ['B3', 'D4', 'F#4', 'A4']),
    'Gmaj7': ('G2', ['B3', 'D4', 'F#4', 'G4']),
    'A7sus4': ('A2', ['G3', 'D4', 'E4', 'A4']),
    'A7': ('A2', ['G3', 'C#4', 'E4', 'A4']),
    'A13': ('A2', ['G3', 'C#4', 'F#4', 'B4']),
    'Dmaj9': ('D2', ['C#4', 'E4', 'F#4', 'A4']),
    'F#m7': ('F#2', ['E3', 'A3', 'C#4', 'F#4']),
    'Bm7': ('B2', ['A3', 'D4', 'F#4', 'B4']),
    'Bm9': ('B2', ['A3', 'C#4', 'D4', 'F#4']),
    'Em9': ('E2', ['D4', 'F#4', 'G4', 'B4']),
}


def build(changes, groove_bars, swells=(), koto_phrases=None, plucks=(), shaku=(), chimes=(), bowls=(),
          quiet_bars=(1,), breakdown_bars=(), end_bar=None, hook_kicks=()):
    """changes: [(bar, beat, chord)]; plucks/shaku: [(time, note, gain)]; chimes/bowls: [time]."""
    from synth import SR, N, BAR, BEAT, PUMP_TRIG
    epl, epr = np.zeros(N), np.zeros(N)

    def ep_at(t, name, dur, vel):
        l, r = ep_chord(VOICING[name][1], dur, vel)
        i = int(t * SR)
        n = min(len(l), N - i)
        epl[i:i + n] += l[:n]
        epr[i:i + n] += r[:n]

    for k, (b, bt, name) in enumerate(changes):
        t0 = bar(b, bt)
        t1 = bar(*changes[k + 1][:2]) if k + 1 < len(changes) else synth.DUR
        dur = t1 - t0
        vel = 0.62 if b in quiet_bars else 0.5 if b in breakdown_bars else 0.9 if b == end_bar else 0.78
        ep_at(t0, name, dur + 0.25, vel)
        if dur > BAR * 0.9 and b not in breakdown_bars and b != end_bar:
            ep_at(t0 + 1.5 * BEAT, name, 0.55, vel * 0.45)
        if b not in quiet_bars and b not in breakdown_bars:
            place(upright(note_hz(VOICING[name][0]), min(dur, 1.6)), t0, 0.72 if b != end_bar else 0.85, pump=True)
        if b not in quiet_bars:
            place(air_pad(VOICING[name][1], dur + 0.4, attack=0.6 if b in breakdown_bars else 0.25), t0,
                  1.3 if b in breakdown_bars else 1.0, rev=0.4)
    for target, name in swells:          # reverse-piano swell into a downbeat
        l, r = ep_chord(VOICING[name][1], 1.0, 0.8, strum=0.0)
        ln = int(0.9 * SR)
        fade = np.linspace(0, 1, ln) ** 1.5
        place(None, bar(target) - 0.9, 0.9, st=(l[:ln][::-1] * fade, r[:ln][::-1] * fade), rev=0.5)
    place(None, 0.0, 1.0, st=(wow(epl), wow(epr)), rev=0.3)

    for b in groove_bars:                # half-time drums, swung hats
        kicks = [0, 10] if b % 2 else [0, 7, 10]
        for p_ in kicks:
            place(lofi_kick(), bar(b, 0, p_), 0.9)
            PUMP_TRIG.append(bar(b, 0, p_))
        place(lofi_snare(), bar(b, 0, 8), 0.75, pan=0.05, rev=0.3)
        for p_ in range(0, 16, 2):
            place(soft_hat(), bar(b, 0, p_) + (0.035 if p_ % 4 == 2 else 0.0), 0.55 if p_ % 4 else 0.8, pan=0.3)
        if b % 2 == 0:
            place(soft_hat(), bar(b, 0, 13), 0.35, pan=0.35)
    for t in hook_kicks:
        place(lofi_kick(), t, 0.75)

    for b, notes in (koto_phrases or {}).items():
        for p_, nm in notes:
            place(koto(note_hz(nm), 1.3), bar(b, 0, p_), 0.42, pan=0.3 * np.sin(p_ + b), rev=0.55)
    for t, nm, g in plucks:
        place(koto(note_hz(nm), 1.8), t, g, pan=0.15 * np.sin(t * 7), rev=0.55)
    for t, nm, dur, g in shaku:
        place(shakuhachi(note_hz(nm), dur, g), t, 1.0, pan=-0.15, rev=0.6)
    for t in chimes:
        for i, f in enumerate((2650.0, 3120.0)):
            place(furin(f, 2.4), t + i * 0.11, 0.9, pan=0.35 - 0.2 * i, rev=0.5)
    for t in bowls:
        place(rin(523.25, 4.0), t, 0.8, pan=0.0, rev=0.6)
    if end_bar:
        for i, nm in enumerate(['D4', 'F#4', 'A4', 'D5', 'E5', 'F#5', 'A5']):
            place(koto(note_hz(nm), 2.4), bar(end_bar) + i * 0.032, 0.4, pan=-0.35 + i * 0.11, rev=0.55)
        place(lofi_kick(), bar(end_bar), 0.8)

    cl, cr = crackle(synth.DUR), crackle(synth.DUR)
    env = np.minimum(1, np.arange(N) / (0.3 * SR))
    place(None, 0.0, 1.0, st=(cl * env * 1.6, cr * env * 1.6))


def soft(st, f=3800):
    return lp(st[0], f), lp(st[1], f)


def finish(path, target_lufs=-14.0):
    """Warm tape-style master, then trim to the target loudness (EBU R128 via ffmpeg)."""
    from synth import SR
    st, _ = synth.master(pump_depth=0.12, rev_decay=0.6, rev_level=0.42, warmth=11000, drive=1.0, thr=0.4)
    wavfile.write(path, SR, st)
    meter = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'ebur128', '-f', 'null', '-'],
                           capture_output=True, text=True).stderr
    lufs = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', meter)[-1])
    st = (st * min(10 ** ((target_lufs - lufs) / 20), 0.89 / np.abs(st).max())).astype(np.float32)
    wavfile.write(path, SR, st)
    print(path, 'measured', lufs, 'LUFS -> trimmed to', target_lufs)
