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

SR = 48000
DUR = 15.0
N = int(SR * DUR)
BPM = 128
BEAT = 60 / BPM
BAR = 4 * BEAT
S16 = BEAT / 4
rng = np.random.default_rng(20260927)

L = np.zeros(N)
R = np.zeros(N)
REV_L = np.zeros(N)  # reverb send bus
REV_R = np.zeros(N)
PL = np.zeros(N)     # sidechain-pumped bus (pads + bass)
PR = np.zeros(N)
PUMP_TRIG = []       # kick times for sidechain


def bar(b, beat=0.0, s16=0):
    """Time of bar b (1-based), beat (0-based, may be fractional), 16th offset."""
    return (b - 1) * BAR + beat * BEAT + s16 * S16


def note_hz(name):
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    n, o = name[:-1], int(name[-1])
    midi = 12 * (o + 1) + names[n]
    return 440.0 * 2 ** ((midi - 69) / 12)


def place(sig, t, gain=1.0, pan=0.0, rev=0.0, st=None, pump=False):
    """Mix a mono (or stereo tuple) signal at time t with constant-power pan."""
    i = int(round(t * SR))
    if i >= N:
        return
    if st is None:
        a = (pan + 1) * np.pi / 4
        sl, sr_ = sig * np.cos(a), sig * np.sin(a)
    else:
        sl, sr_ = st
    if i < 0:
        sl, sr_ = sl[-i:], sr_[-i:]
        i = 0
    n = min(len(sl), N - i)
    (PL if pump else L)[i:i + n] += gain * sl[:n]
    (PR if pump else R)[i:i + n] += gain * sr_[:n]
    if rev:
        REV_L[i:i + n] += gain * rev * sl[:n]
        REV_R[i:i + n] += gain * rev * sr_[:n]


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def fade_in(sig, sec):
    k = min(len(sig), int(sec * SR))
    sig = sig.copy()
    sig[:k] *= np.linspace(0, 1, k)
    return sig


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype='band', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype='high', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype='low', fs=SR, output='sos'), x)


def sweep_filter(x, f0, f1, q=1.2, kind='band'):
    """Time-varying biquad (exp sweep f0->f1) processed in 5 ms blocks."""
    out = np.zeros_like(x)
    blk = int(0.005 * SR)
    nb = int(np.ceil(len(x) / blk))
    zi = np.zeros(2)
    for k in range(nb):
        f = f0 * (f1 / f0) ** (k / max(1, nb - 1))
        f = min(f, SR * 0.45)
        w0 = 2 * np.pi * f / SR
        alpha = np.sin(w0) / (2 * q)
        if kind == 'band':
            b = np.array([alpha, 0, -alpha])
        else:  # lowpass
            b = np.array([(1 - np.cos(w0)) / 2, 1 - np.cos(w0), (1 - np.cos(w0)) / 2])
        a = np.array([1 + alpha, -2 * np.cos(w0), 1 - alpha])
        seg = x[k * blk:(k + 1) * blk]
        y, zi = signal.lfilter(b / a[0], a / a[0], seg, zi=zi)
        out[k * blk:(k + 1) * blk] = y
    return out


# ---------------------------------------------------------------- instruments
def kick(gain=1.0):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 50 + 120 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * (np.exp(-t * 10) * 0.85 + 0.15 * np.exp(-t * 30))
    click = hp(rng.standard_normal(n), 2500) * np.exp(-t * 400) * 0.35
    return np.tanh(1.6 * (body + click)) * gain


def clap():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    noise = bp(rng.standard_normal(n), 900, 5200)
    e = np.zeros(n)
    for d in (0.0, 0.009, 0.018):
        k = t >= d
        e[k] += np.exp(-(t[k] - d) * 180)
    e += 0.45 * np.exp(-np.maximum(t - 0.02, 0) * 22) * (t >= 0.02)
    return noise * e * 0.9


def hat(open_=False):
    n = int((0.25 if open_ else 0.07) * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 7500, 4)
    return x * np.exp(-t * (14 if open_ else 70)) * 0.5


def snare_roll_hit():
    n = int(0.18 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 40) * 0.5
    nz = bp(rng.standard_normal(n), 1200, 7000) * np.exp(-t * 28)
    return (tone + nz) * 0.6


def koto(freq, dur=1.6, bright=1.0, pluck_pos=0.19, bend=True):
    """Additive plucked-string model: brighter partials die faster, small
    inharmonicity, attack bend, bridge 'buzz' transient -> koto-like twang."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    # pitch settles from ~12 cents sharp (string press/release feel)
    detune = 1 + (0.007 * np.exp(-t * 18) if bend else 0)
    phase_base = 2 * np.pi * np.cumsum(freq * detune) / SR
    B = 0.00012
    for k in range(1, 24):
        fk = k * np.sqrt(1 + B * k * k)
        if fk * freq > SR * 0.45:
            break
        amp = abs(np.sin(np.pi * k * pluck_pos)) / k ** 0.85
        amp *= bright ** (k - 1) if bright < 1 else 1
        decay = 1.1 + 0.55 * (k - 1) ** 1.25
        out += amp * np.sin(fk * phase_base + rng.uniform(0, 0.3)) * np.exp(-t * decay)
    # pluck transient
    tr = bp(rng.standard_normal(n), 1800, 9000) * np.exp(-t * 260) * 0.35
    out = out + tr
    out *= 1 - np.exp(-t * 2500)  # 0.4 ms attack de-click
    # simple body resonances
    body = bp(out, 180, 420, 1) * 0.25 + bp(out, 900, 2400, 1) * 0.18
    return (out + body) * 0.32


def polyblep_saw(freq, n, phase0=0.0):
    dt = freq / SR
    ph = (phase0 + dt * np.arange(n)) % 1.0
    y = 2 * ph - 1
    # polyBLEP correction
    m1 = ph < dt
    x = ph[m1] / dt
    y[m1] -= x + x - x * x - 1
    m2 = ph > 1 - dt
    x = (ph[m2] - 1) / dt
    y[m2] -= x * x + x + x + 1
    return y


def pad(notes, dur, cutoff=2400, attack=0.08, release=0.25):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for nm in notes:
        f = note_hz(nm)
        for d in (-0.11, -0.05, 0.0, 0.05, 0.11):
            out += polyblep_saw(f * 2 ** (d / 12), n, rng.uniform()) / 5
    out = lp(out, cutoff, 2)
    e = np.minimum(1, t / attack) * np.minimum(1, np.maximum(0, (dur - t) / release))
    return out * e * 0.11


def sub(freq, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * t) + 0.18 * np.sin(4 * np.pi * freq * t)
    e = np.minimum(1, t / 0.006) * np.minimum(1, np.maximum(0, (dur - t) / 0.03))
    return np.tanh(1.3 * x) * e * 0.42


def noise_riser(dur, f0=250, f1=9000):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    y = sweep_filter(x, f0, f1, q=2.2)
    t = np.arange(n) / SR
    return y * (t / dur) ** 2.2 * 0.9


def whoosh(dur=0.42, f0=500, f1=5000, peak=0.62):
    """Air whoosh; returns stereo tuple panning L->R."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    up = sweep_filter(x, f0, f1, q=1.4)
    u = t / dur
    e = np.where(u < peak, (u / peak) ** 2.5, np.exp(-(u - peak) / (1 - peak) * 4))
    y = up * e * 0.8
    pan = np.clip(-0.8 + 1.6 * u, -1, 1)
    a = (pan + 1) * np.pi / 4
    return y * np.cos(a), y * np.sin(a)


def tap():
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    f = 2100 - 900 * (t / 0.06)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 90)
    c = hp(rng.standard_normal(n), 4000) * np.exp(-t * 900) * 0.4
    return (s * 0.5 + c) * 0.55


def tick():
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 2500, 6000) * np.exp(-t * 250) * 0.35


def bell(freq, dur=1.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * freq * 1.4 * t) * 2.2 * np.exp(-t * 6)
    return np.sin(2 * np.pi * freq * t + mod) * np.exp(-t * 3.2) * 0.3


def taiko():
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    f = 52 + 60 * np.exp(-t * 16)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.8)
    skin = lp(rng.standard_normal(n), 900) * np.exp(-t * 22) * 0.9
    return np.tanh(1.4 * (body + skin)) * 0.95


def crash(dur=2.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 3500, 2)
    x = x + 0.4 * bp(rng.standard_normal(n), 600, 3000)
    return x * np.exp(-t * 2.2) * 0.22


def bloop():
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    f = 380 + 620 * (1 - np.exp(-t * 45))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 26) * 0.55


def lift_pop():
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = 520 + 380 * (1 - np.exp(-t * 60))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 38)
    air = bp(rng.standard_normal(n), 1500, 6000) * np.exp(-t * 90) * 0.25
    return (s * 0.45 + air) * 0.8


def brush(dur=0.32):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = sweep_filter(rng.standard_normal(n), 1200, 6000, q=0.9)
    grain = 0.6 + 0.4 * lp(rng.standard_normal(n), 60) / 0.2
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    return x * np.clip(grain, 0, 2) * e * 0.9


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

# ---------------------------------------------------------------- sidechain + reverb + master
pump = np.ones(N)
for t in PUMP_TRIG:
    i = int(t * SR)
    k = np.arange(N - i) / SR
    pump[i:] = np.minimum(pump[i:], 1 - 0.45 * np.exp(-k / 0.11))
# Apply pump to the bus minus drums is not tracked separately; instead duck the
# whole reverb bus and apply a gentle overall pump (drums punch through anyway).
n_ir = int(2.2 * SR)
ti = np.arange(n_ir) / SR
irL = lp(rng.standard_normal(n_ir), 6000) * np.exp(-ti / 0.42)
irR = lp(rng.standard_normal(n_ir), 6000) * np.exp(-ti / 0.42)
pre = int(0.018 * SR)
irL = np.concatenate([np.zeros(pre), irL]) / np.sqrt(np.sum(irL ** 2))
irR = np.concatenate([np.zeros(pre), irR]) / np.sqrt(np.sum(irR ** 2))
wetL = signal.fftconvolve(hp(REV_L, 250), irL)[:N] * 0.35 * pump
wetR = signal.fftconvolve(hp(REV_R, 250), irR)[:N] * 0.35 * pump
mixL = hp(L + PL * pump + wetL, 36, 4)
mixR = hp(R + PR * pump + wetR, 36, 4)

# end fade (last 0.35 s) so the file ends in silence exactly at 15.000 s
fade = int(0.35 * SR)
w = np.ones(N)
w[-fade:] = np.cos(np.linspace(0, np.pi / 2, fade)) ** 2
mixL *= w
mixR *= w

# gentle glue compression (RMS, stereo linked)
lvl = np.sqrt(lp((mixL ** 2 + mixR ** 2) / 2, 12, 1).clip(1e-12))
thr = 0.25
gain = np.where(lvl > thr, (thr / lvl) ** (1 - 1 / 2.0), 1.0)
mixL *= gain
mixR *= gain
peak = max(np.abs(mixL).max(), np.abs(mixR).max())
mixL /= peak / 0.89
mixR /= peak / 0.89
st = np.stack([mixL, mixR], axis=1).astype(np.float32)
wavfile.write('music_raw.wav', SR, st)
json.dump({'bpm': BPM, 'bar': BAR, 'beat': BEAT, 'sfx': SFX}, open('timeline_audio.json', 'w'), indent=1)
print('peak before norm', peak, 'samples', len(st), 'dur', len(st) / SR)
