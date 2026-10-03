"""Rapatkan jeda voice-over + hitung waktu tiap kata → vo/vo-tight.wav + vo-timeline.js.

VO direkam satu file utuh (ElevenLabs). Potongan bicara dideteksi lewat jeda
(silencedetect ffmpeg), lalu dicocokkan dengan 18 potongan naskah (CHUNKS).
Jeda antar-potongan dipendekkan (tanpa mengubah tempo suara), dan waktu tiap
kata diperkirakan proporsional jumlah suku katanya di dalam potongannya.
Pemakaian: python3 vo-align.py <vo.wav> <keluaran-dir>
"""
import json, re, subprocess, sys, wave
import numpy as np

SR = 48000
CHUNKS = [  # [baris naskah, teks lisan potongan]
    (1, 'Ga ada yang bakal ngasih tau kalian hal ini…'),
    (2, 'Kerja ke Jepang…'), (2, 'ga perlu menghabiskan puluhan juta.'),
    (3, 'Yang paling nentuin itu bahasanya.'), (3, 'Dan itu bisa dikejar.'),
    (4, 'Bootcamp live bareng sensei, dua kali seminggu, selama tiga bulan.'),
    (5, 'Kelewat kelas?'), (5, 'Tenang, ada rekamannya.'),
    (6, 'Buka dashboard, langsung tau hari ini belajar apa.'),
    (7, 'Lihat kanjinya, terus dengar cara bacanya.'),
    (8, 'Yang udah hafal jarang muncul.'), (8, 'Yang sering salah,'), (8, 'muncul lagi sebelum kamu lupa.'),
    (9, 'Progresnya kelihatan,'), (9, 'di laptop maupun HP.'),
    (10, 'Kerja ke Jepang?'), (10, 'Mulai dari bahasanya.'), (10, 'Izi Nihongo.'),
]
GAP_SAME_LINE, GAP_NEW_LINE, LEAD = 0.16, 0.24, 0.12
EXTRA_AFTER = {4: 0.85}   # setelah potongan ke-5 ("dikejar."): ruang untuk logo
TAIL = 1.6

src, outdir = sys.argv[1], sys.argv[2]
log = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', src, '-af', 'silencedetect=noise=-38dB:d=0.18', '-f', 'null', '-'],
                     capture_output=True, text=True).stderr
starts = [float(x) for x in re.findall(r'silence_start: ([0-9.]+)', log)]
ends = [float(x) for x in re.findall(r'silence_end: ([0-9.]+)', log)]
with wave.open(src) as w:
    x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float64) / 32768
dur = len(x) / SR
# potongan bicara = di antara jeda; awal bicara pertama dicari dari energi
env = np.abs(x)
first = np.argmax(env > 0.02) / SR
speech = []
prev_end = first
for s, e in zip(starts, ends):
    if s - prev_end > 0.05: speech.append((prev_end, s))
    prev_end = e
if dur - prev_end > 0.1: speech.append((prev_end, dur))
assert len(speech) == len(CHUNKS), f'terdeteksi {len(speech)} potongan, naskah {len(CHUNKS)}'

def syl(word):
    w = word.lower()
    if w == 'hp': return 2
    return max(1, len(re.findall(r'[aiueo]+', w)))

out = [np.zeros(int(LEAD * SR))]
t = LEAD
timeline = []
for i, ((line, text), (a, b)) in enumerate(zip(CHUNKS, speech)):
    a0, b0 = max(0, a - 0.04), min(dur, b + 0.07)
    seg = x[int(a0 * SR):int(b0 * SR)].copy()
    f = int(0.012 * SR); seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
    start = t + (a - a0)
    speak = b - a
    words = text.split()
    w8 = [syl(w) for w in words]; tot = sum(w8); acc = 0; wt = []
    for w, s in zip(words, w8):
        wt.append(round(start + speak * acc / tot, 3)); acc += s
    timeline.append({'line': line, 'text': text, 'start': round(start, 3), 'end': round(start + speak, 3), 'words': wt})
    out.append(seg); t += len(seg) / SR
    if i < len(CHUNKS) - 1:
        gap = (GAP_SAME_LINE if CHUNKS[i + 1][0] == line else GAP_NEW_LINE) + EXTRA_AFTER.get(i, 0)
        out.append(np.zeros(int(gap * SR))); t += gap
out.append(np.zeros(int(TAIL * SR)))
y = np.concatenate(out)
with wave.open(f'{outdir}/vo-tight.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(y, -1, 1) * 32767).astype('<i2').tobytes())
total = len(y) / SR
open(f'{outdir}/vo-timeline.js', 'w').write('// dihasilkan vo-align.py — jangan diedit manual\nwindow.VO=' + json.dumps({'duration': round(total, 3), 'chunks': timeline}, ensure_ascii=False) + ';\n')
print(f'asli {dur:.2f}s → rapat {total:.2f}s; potongan:')
for c in timeline: print(f"  {c['start']:6.2f}–{c['end']:6.2f}  {c['text']}")
