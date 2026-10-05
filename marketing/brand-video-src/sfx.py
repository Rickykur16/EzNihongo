"""Efek suara + musik latar video brand, disintesis dari nol (tanpa sampel berlisensi).

Membaca cues.json (diekspor dari window.CUES di video.html oleh cues.mjs), jadi tiap
suara jatuh tepat di detik animasinya. Keluaran: sfx.wav (48 kHz, stereo, 16-bit).
Pemakaian: python3 sfx.py [cues.json] [keluaran.wav]
"""
import json, sys, wave
import numpy as np

SR = 48000
DUR = float(__import__("os").environ.get("DUR", "30"))
N = int(SR * DUR)
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)


def add(t0, sig, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    lg = np.cos((pan + 1) * np.pi / 4); rg = np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * lg * 1.414
    R[i:i + len(sig)] += sig * rg * 1.414


def tt(d):
    return np.arange(int(d * SR)) / SR


def lp_var(x, fc):
    """Low-pass satu kutub dengan cutoff berubah per sampel."""
    a = (1 - np.exp(-2 * np.pi * np.broadcast_to(np.asarray(fc, float), np.shape(x)) / SR)).tolist()
    xs = np.asarray(x, float).tolist(); y = [0.0] * len(xs); acc = 0.0
    for n in range(len(xs)):
        acc += a[n] * (xs[n] - acc); y[n] = acc
    return np.array(y)


def bp_sweep(d, f_lo, f_hi):
    x = rng.standard_normal(int(d * SR))
    return lp_var(x, f_hi) - lp_var(x, f_lo)


def bell(f, d=1.2, decay=3.0, partials=((1, 1), (2.76, .35), (5.4, .12))):
    t = tt(d)
    s = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t * decay * (1 + m * .4)) for m, a in partials)
    atk = np.minimum(1, t / .004)
    return s * atk


def pluck(f, d=1.6, damp=.996):
    """Karplus–Strong — petikan ala koto."""
    n = int(d * SR); p = max(2, int(SR / f))
    buf = rng.uniform(-1, 1, p).tolist(); out = [0.0] * n; h = damp * .5
    for i in range(n):
        j = i % p; out[i] = buf[j]
        buf[j] = h * (buf[j] + buf[(i + 1) % p])
    return lp_var(np.array(out), 4500.0)


# ---- jenis suara -----------------------------------------------------------
def whoosh(t0, direction=1, d=.65, f0=400, f1=4200, gain=.75):
    t = tt(d); x = t / d
    peak = np.clip(1 - np.abs(x - .55) / .55, 0, 1)
    fc = f0 + (f1 - f0) * peak
    s = bp_sweep(d, fc * .35, fc) * np.sin(np.pi * np.clip(x / 1.0, 0, 1)) ** 2
    s = lp_var(s, 7000.0); s /= np.max(np.abs(s)) + 1e-9
    # geser stereo kiri→kanan (atau sebaliknya) dalam beberapa potong
    for k in range(8):
        a, b = int(len(s) * k / 8), int(len(s) * (k + 1) / 8)
        add(t0 + a / SR, s[a:b], gain, pan=direction * (-.8 + 1.6 * (k + .5) / 8))


def whoosh_up(t0):
    d = .6; t = tt(d); x = t / d
    fc = 300 + 5200 * x ** 1.5
    s = bp_sweep(d, fc * .3, fc) * np.sin(np.pi * x) ** 1.5
    add(t0, s / (np.max(np.abs(s)) + 1e-9), .45)


def zoom(t0):
    whoosh(t0, 1, d=.8, f0=300, f1=5000, gain=.5)
    t = tt(.8); f = 220 * 2 ** (2.2 * t / .8)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / .8) ** 2
    add(t0, s, .12)


def swell(t0):
    d = 1.0; t = tt(d); x = t / d
    env = x ** 2.2 * np.minimum(1, (1 - x) / .08)
    n = bp_sweep(d, 120, 400 + 2200 * x) * env
    n /= np.max(np.abs(n)) + 1e-9
    pad = (np.sin(2 * np.pi * 146.83 * t) + .7 * np.sin(2 * np.pi * 220 * t) + .4 * np.sin(2 * np.pi * 293.66 * t)) * env
    add(t0, n, .28); add(t0, pad, .1)


def boom(t0):
    t = tt(1.6)
    f = 38 + 60 * np.exp(-t * 6)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
    hit = lp_var(rng.standard_normal(len(t)), 900.0) * np.exp(-t * 30)
    add(t0, s, .5); add(t0, hit, .3)
    add(t0 + .02, bell(1174.66, 1.6, 2.2), .13, pan=-.2)
    add(t0 + .02, bell(1760.0, 1.6, 2.6), .07, pan=.3)


def typing(t0, d=.6):
    k = 0.0
    while k < d:
        c = rng.standard_normal(int(.004 * SR))
        c = np.diff(c, prepend=0) * np.exp(-np.arange(len(c)) / (SR * .0012))
        add(t0 + k, c, .06 * rng.uniform(.6, 1), pan=rng.uniform(-.3, .3))
        k += 1 / 26 * rng.uniform(.85, 1.15)


def pop(t0, idx=0):
    f0 = [620, 700, 780, 660, 740, 820, 880][int(idx) % 7]
    t = tt(.16)
    f = f0 * (1 + .9 * np.exp(-t / .018))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .045) * np.minimum(1, t / .002)
    add(t0, s, .38, pan=rng.uniform(-.25, .25))


def click(t0):
    for k, g in ((0, .4), (.075, .25)):
        n = int(.012 * SR); tq = np.arange(n) / SR
        s = np.diff(rng.standard_normal(n), prepend=0) * np.exp(-tq / .0015)
        s += .5 * np.sin(2 * np.pi * 2300 * tq) * np.exp(-tq / .003)
        add(t0 + k, s, g, pan=.15)


def tap(t0):
    t = tt(.12); f = 120 + 120 * np.exp(-t / .02)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .03)
    add(t0, s, .55); click(t0)


def blip(t0):
    add(t0, bell(880, .5, 9, ((1, 1), (4, .3))), .3, pan=-.1)
    add(t0 + .11, bell(1318.5, .6, 8, ((1, 1), (4, .3))), .3, pan=.1)


def correct(t0):
    add(t0, bell(1046.5, 1.0, 4), .34, pan=-.15)
    add(t0 + .1, bell(1568.0, 1.2, 3.5), .34, pan=.15)
    add(t0 + .1, bell(2093.0, .8, 6), .1, pan=.3)


def tick(t0, idx=0):
    f = 1400 * 2 ** (idx * 2 / 12)
    add(t0, bell(f, .25, 18, ((1, 1), (3, .2))), .2, pan=-.4 + idx * .2)


def shimmer(t0):
    for k, f in enumerate([587.33, 659.25, 783.99, 880.0, 987.77, 1174.66, 1318.51]):
        add(t0 + k * .09, bell(f * 2, 1.4, 2.8), .07, pan=-.6 + k * .2)


def sparkle(t0):
    d = .7; t = tt(d)
    n = bp_sweep(d, 6000, 9500) * np.sin(np.pi * t / d) ** 2 * (1 + .5 * np.sin(2 * np.pi * 18 * t))
    add(t0, n / (np.max(np.abs(n)) + 1e-9), .07, pan=.2)
    add(t0 + .25, bell(2349.3, 1.0, 4), .08, pan=.4)


def impact(t0, idx=0):
    """Hentakan hook: sub-bass + snap; makin keras tiap kata."""
    g = [.55, .8, .75][int(idx)]
    t = tt(1.0)
    f = 45 + 110 * np.exp(-t * 18)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.5)
    snap = lp_var(rng.standard_normal(len(t)), 5000.0) * np.exp(-t * 45)
    body = lp_var(rng.standard_normal(len(t)), 600.0) * np.exp(-t * 9)
    add(t0, sub, g); add(t0, snap, g * .35); add(t0, body, g * .5)
    if idx == 2:  # layar merah: tambah gema lonceng rendah
        add(t0, bell(293.66, 1.5, 2.0), .18); add(t0, bell(440.0, 1.5, 2.4), .1)


def riser(t0):
    d = .95; t = tt(d); x = t / d
    n = bp_sweep(d, 200, 600 + 6000 * x ** 2) * x ** 2.5
    add(t0, n / (np.max(np.abs(n)) + 1e-9), .22)


def cutfx(t0):
    d = .14; t = tt(d)
    n = bp_sweep(d, 1500, 7000) * np.exp(-t / .03)
    add(t0, n / (np.max(np.abs(n)) + 1e-9), .18, pan=rng.uniform(-.5, .5))


def strike(t0):
    """Coretan spidol: gesekan pendek + hentakan kecil."""
    d = .22; t = tt(d)
    n = bp_sweep(d, 900, 3500) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** .7
    add(t0, n / (np.max(np.abs(n)) + 1e-9), .3, pan=-.3)
    impact(t0 + .18, 0)


def lift(t0):
    whoosh(t0, 1, d=.35, f0=500, f1=2600, gain=.22)
    add(t0 + .2, bell(660, .4, 10, ((1, 1), (2, .2))), .08)


def card_wave(t0):
    for k in range(6):
        add(t0 + k * .07, bell(880 * 2 ** ([0, 2, 4, 7, 9, 12][k] / 12), .5, 7), .09, pan=-.6 + k * .24)


def flip(t0):
    whoosh(t0, -1, d=.4, f0=700, f1=4200, gain=.25)


def punch(t0):
    t = tt(.3); f = 90 + 80 * np.exp(-t * 25)
    add(t0, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 12), .45)
    whoosh(t0 - .05, 1, d=.25, f0=600, f1=5000, gain=.25)


def count(t0):
    for k in range(14):
        add(t0 + k * .065 * (1 + k * .04), bell(1200 + k * 40, .12, 30, ((1, 1),)), .08)


def knock(t0):
    """Ketukan pintu kayu: dentum rendah + klik permukaan."""
    t = tt(.25)
    body = np.sin(2 * np.pi * 180 * t) * np.exp(-t * 38) + .6 * np.sin(2 * np.pi * 410 * t) * np.exp(-t * 55)
    hit = lp_var(rng.standard_normal(len(t)), 2500.0) * np.exp(-t * 90)
    add(t0, body, .55, pan=.25); add(t0, hit, .35, pan=.25)


def buzz(t0):
    """Bunyi salah: dua nada rendah kasar."""
    for k, f in ((0, 196.0), (.16, 164.8)):
        t = tt(.2)
        s = np.sign(np.sin(2 * np.pi * f * t)) * .5 + np.sin(2 * np.pi * f * 2 * t) * .3
        s = lp_var(s * np.minimum(1, t / .005) * np.exp(-t * 6), 1800.0)
        add(t0 + k, s, .32)


KIND = {
    'knock': lambda t, a: knock(t), 'buzz': lambda t, a: buzz(t),
    'lift': lambda t, a: lift(t), 'wave': lambda t, a: card_wave(t), 'flip': lambda t, a: flip(t),
    'punch': lambda t, a: punch(t), 'count': lambda t, a: count(t),
    'strike': lambda t, a: strike(t),
    'cutfx': lambda t, a: cutfx(t),
    'impact': lambda t, a: impact(t, a or 0), 'riser': lambda t, a: riser(t),
    'whoosh_morph': lambda t, a: whoosh(t, -1, d=.7, f0=250, f1=3200, gain=.55),
    'whoosh': lambda t, a: whoosh(t, a or 1), 'whoosh_soft': lambda t, a: whoosh(t, a or 1, d=.5, f0=300, f1=2400, gain=.45),
    'whoosh_up': lambda t, a: whoosh_up(t), 'zoom': lambda t, a: zoom(t), 'swell': lambda t, a: swell(t),
    'boom': lambda t, a: boom(t), 'type': lambda t, a: typing(t, a or .6), 'pop': lambda t, a: pop(t, a or 0),
    'click': lambda t, a: click(t), 'tap': lambda t, a: tap(t), 'blip': lambda t, a: blip(t),
    'correct': lambda t, a: correct(t), 'tick': lambda t, a: tick(t, a or 0), 'shimmer': lambda t, a: shimmer(t),
    'sparkle': lambda t, a: sparkle(t),
}

cues = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'cues.json'))
for c in cues:
    KIND[c[1]](c[0], c[2] if len(c) > 2 else None)

# Jangkar musik = dentum logo pembuka & penutup (dari cue), jadi ikut timeline.
booms = sorted(c[0] for c in cues if c[1] == 'boom')
B0, B1 = booms[0], booms[-1]

# ---- musik latar tipis: pad + petikan ala koto (tangga nada yo: D E G A B) ----
sfxL, sfxR = L.copy(), R.copy()
L[:] = 0; R[:] = 0
t = np.arange(N) / SR
env = np.clip((t - (B0 - .3)) / 1.5, 0, 1) * np.clip((DUR - t) / 1.5, 0, 1)
pad = np.zeros(N)
for f, a in ((73.42, .5), (146.83, .45), (220.0, .35), (329.63, .22), (369.99, .14)):
    for det in (-.6, .6):
        pad += a * np.sin(2 * np.pi * (f + det) * t + rng.uniform(0, 6.28)) * (1 + .25 * np.sin(2 * np.pi * .13 * t + f))
spec = np.fft.rfft(pad); spec[np.fft.rfftfreq(N, 1 / SR) > 900] = 0
pad = np.fft.irfft(spec, N) * env
L += pad * .05; R += pad * .05

beat = 60 / 100  # 100 BPM
pattern = [293.66, 440.0, 493.88, 440.0, 392.0, 293.66, 329.63, 293.66]
k = 0
tb = B0 + 2.4
while tb < B1 - .7:
    if k % 8 not in (3, 7):
        f = pattern[k % 8] * (2 if (k // 16) % 2 else 1)
        add(tb, pluck(f, 1.2, .995), .085, pan=-.35 if k % 2 else .35)
    tb += beat / 2 if k % 4 == 1 else beat
    k += 1
# frasa penutup (logo akhir)
for dt, f in ((B1, 146.83), (B1, 293.66), (B1 + .15, 440.0), (B1 + .3, 587.33), (B1 + .55, 659.25), (B1 + .8, 587.33)):
    add(dt, pluck(f, 2.5, .998), .13, pan=rng.uniform(-.3, .3))
for dt, f in ((B0, 146.83), (B0, 293.66), (B0 + .15, 440.0), (B0 + .3, 587.33)):
    add(dt, pluck(f, 2.0, .998), .12, pan=rng.uniform(-.3, .3))

L += sfxL; R += sfxR
fade = np.clip((DUR - t) / .8, 0, 1)
L *= fade; R *= fade
peak = max(np.max(np.abs(L)), np.max(np.abs(R)))
L *= .89 / peak; R *= .89 / peak
out = sys.argv[2] if len(sys.argv) > 2 else 'sfx.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.stack([L, R], 1) * 32767).astype('<i2').tobytes())
print('ok', out, f'peak-normalized from {peak:.2f}')
