"""Shared synthesis toolkit for the EzNihongo promo soundtracks.

All instruments and effects are generated from scratch with numpy/scipy (no
samples, no loops), so every piece built with this module is an original work.
Call setup() first; a piece then places sounds with place() and renders with
master(). The random generator is seeded, so output is bit-for-bit repeatable.
"""
import numpy as np
from scipy import signal

SR = 48000


def setup(dur, bpm, seed=20260927):
    """(Re)initialise the timeline, mix buses and the seeded noise source."""
    global DUR, N, BPM, BEAT, BAR, S16, rng, L, R, REV_L, REV_R, PL, PR, PUMP_TRIG
    DUR = dur
    N = int(SR * DUR)
    BPM = bpm
    BEAT = 60 / BPM
    BAR = 4 * BEAT
    S16 = BEAT / 4
    rng = np.random.default_rng(seed)
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



def master(pump_depth=0.45, rev_decay=0.42, rev_level=0.35, warmth=None, drive=None, thr=0.25):
    """Sidechain pump, convolution reverb, end fade, glue compression, peak normalise.
    The defaults are the original 15 s / 20 s promo master; the lo-fi teaser passes a
    lighter pump, a longer softer room, a treble roll-off (warmth, Hz) and tape drive.
    Returns (stereo float32 array, peak before normalisation)."""
    pump = np.ones(N)
    for t in PUMP_TRIG:
        i = int(t * SR)
        k = np.arange(N - i) / SR
        pump[i:] = np.minimum(pump[i:], 1 - pump_depth * np.exp(-k / 0.11))
    # Apply pump to the bus minus drums is not tracked separately; instead duck the
    # whole reverb bus and apply a gentle overall pump (drums punch through anyway).
    n_ir = int(2.2 * SR)
    ti = np.arange(n_ir) / SR
    irL = lp(rng.standard_normal(n_ir), 6000) * np.exp(-ti / rev_decay)
    irR = lp(rng.standard_normal(n_ir), 6000) * np.exp(-ti / rev_decay)
    pre = int(0.018 * SR)
    irL = np.concatenate([np.zeros(pre), irL]) / np.sqrt(np.sum(irL ** 2))
    irR = np.concatenate([np.zeros(pre), irR]) / np.sqrt(np.sum(irR ** 2))
    wetL = signal.fftconvolve(hp(REV_L, 250), irL)[:N] * rev_level * pump
    wetR = signal.fftconvolve(hp(REV_R, 250), irR)[:N] * rev_level * pump
    mixL = hp(L + PL * pump + wetL, 36, 4)
    mixR = hp(R + PR * pump + wetR, 36, 4)
    if warmth:
        mixL, mixR = lp(mixL, warmth, 1), lp(mixR, warmth, 1)
    if drive:
        ref = max(np.abs(mixL).max(), np.abs(mixR).max())
        mixL = np.tanh(drive * mixL / ref) * ref
        mixR = np.tanh(drive * mixR / ref) * ref

    # end fade (last 0.35 s) so the file ends in silence exactly at DUR
    fade = int(0.35 * SR)
    w = np.ones(N)
    w[-fade:] = np.cos(np.linspace(0, np.pi / 2, fade)) ** 2
    mixL *= w
    mixR *= w

    # gentle glue compression (RMS, stereo linked)
    lvl = np.sqrt(lp((mixL ** 2 + mixR ** 2) / 2, 12, 1).clip(1e-12))
    gain = np.where(lvl > thr, (thr / lvl) ** (1 - 1 / 2.0), 1.0)
    mixL *= gain
    mixR *= gain
    peak = max(np.abs(mixL).max(), np.abs(mixR).max())
    mixL /= peak / 0.89
    mixR /= peak / 0.89
    st = np.stack([mixL, mixR], axis=1).astype(np.float32)
    return st, peak


# ---------------------------------------------------------------- lo-fi palette (teaser)
def ep_note(freq, dur, vel=1.0):
    """FM electric piano (Rhodes-like): 1:1 modulator for the body, 14:1 for the tine."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    idx = 0.15 + 1.05 * vel * np.exp(-t * 3.0)
    tine = 0.35 * vel * np.exp(-t * 45) * np.sin(2 * np.pi * freq * 14 * t)
    body = np.sin(2 * np.pi * freq * t + idx * np.sin(2 * np.pi * freq * t) + tine)
    env = np.minimum(1, t / 0.003) * np.exp(-t * (1.1 + freq / 900)) * np.minimum(1, np.maximum(0, (dur - t) / 0.08))
    return np.tanh(1.2 * body * env) * 0.22 * vel


def ep_chord(notes, dur, vel=1.0, strum=0.012):
    """Returns (L, R) with Rhodes-style stereo tremolo; notes are slightly strummed."""
    n = int(dur * SR)
    out = np.zeros(n)
    for i, nm in enumerate(notes):
        d = int(i * strum * SR)
        x = ep_note(note_hz(nm), dur - i * strum, vel * (0.9 + 0.1 * rng.random()))
        out[d:d + len(x)] += x[:n - d]
    t = np.arange(n) / SR
    trem = 0.12 * np.sin(2 * np.pi * 4.2 * t)
    return out * (1 + trem), out * (1 - trem)


def wow(sig, depth_ms=0.9, rate=0.55, flutter=0.12):
    """Tape wow/flutter: slowly modulated fractional delay."""
    n = len(sig)
    t = np.arange(n) / SR
    d = (depth_ms / 1000) * SR * (1 + np.sin(2 * np.pi * rate * t) + flutter * np.sin(2 * np.pi * 7.3 * t))
    return np.interp(np.arange(n) - d, np.arange(n), sig, left=0.0)


def lofi_kick():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 46 + 70 * np.exp(-t * 26)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11)
    click = lp(rng.standard_normal(n), 1800) * np.exp(-t * 320) * 0.25
    return np.tanh(1.3 * (body + click)) * 0.85


def lofi_snare():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 32) * 0.45
    nz = bp(rng.standard_normal(n), 900, 5200) * np.exp(-t * 24)
    return lp(np.tanh(1.4 * (tone + nz)), 4800) * 0.5


def soft_hat():
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    return lp(hp(rng.standard_normal(n), 6500, 2), 11000) * np.exp(-t * 85) * 0.3


def upright(freq, dur):
    """Warm round bass: sine + a touch of 2nd/3rd harmonic, plucked envelope."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq * (1 + 0.012 * np.exp(-t * 30))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.25 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph)
    env = np.minimum(1, t / 0.004) * np.exp(-t * 1.6) * np.minimum(1, np.maximum(0, (dur - t) / 0.05))
    return lp(np.tanh(1.1 * x) * env, 900) * 0.5


def crackle(dur, rate=9.0):
    """Vinyl bed: sparse clicks plus a little band-limited hiss (mono)."""
    n = int(dur * SR)
    out = bp(rng.standard_normal(n), 1500, 7000) * 0.0045
    k = rng.poisson(rate * dur)
    for pos, amp, ln in zip(rng.integers(0, n - 200, k), rng.uniform(0.02, 0.09, k), rng.integers(12, 60, k)):
        out[pos:pos + ln] += amp * rng.standard_normal(ln) * np.exp(-np.arange(ln) / (ln / 3))
    return bp(out, 700, 9000)


def air_pad(notes, dur, attack=0.6, release=0.8):
    """Soft sine/triangle pad with breathy filtered noise, no bright saw edge."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for nm in notes:
        f = note_hz(nm)
        for d in (-0.06, 0.06):
            ph = 2 * np.pi * f * 2 ** (d / 12) * t + rng.uniform(0, 6)
            out += np.sin(ph) + 0.12 * np.sin(3 * ph)
    breath = bp(rng.standard_normal(n), 800, 3000) * 0.05
    e = np.minimum(1, t / attack) * np.minimum(1, np.maximum(0, (dur - t) / release))
    return lp(out / (2 * len(notes)) + breath, 2500) * e * 0.12
