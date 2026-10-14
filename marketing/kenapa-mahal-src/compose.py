"""Gabungkan footage b1..b7 (footage.md) + grafik transparan (render OVERLAY=1) + audio.

python3 compose.py <dir-overlay> <dir-footage> <keluaran.mp4> [vo.mp3 sfx.wav]

- <dir-overlay>: hasil `OVERLAY=1 node render.mjs <dir> full` (f0000.png.. + scenes.json).
- <dir-footage>: b1..b7 dengan ekstensi .mp4/.mov/.jpg/.jpeg/.png (foto boleh, digerakkan pelan).
  Footage yang lebih pendek dari adegannya diulang. Kalau ada b6b (dst), adegan itu dibagi dua:
  paruh pertama b6, paruh kedua b6b.
Footage di-grade gelap (kontras naik, saturasi turun, bayangan teal, sorotan oranye), didorong
pelan (zoom 6% -> 10%), lalu grafik ditaruh di atasnya, ditambah vinyet & butiran film.
"""
import json, os, subprocess, sys

ov, fdir, out = sys.argv[1:4]
vo, sfx = (sys.argv[4], sys.argv[5]) if len(sys.argv) > 5 else (None, None)
meta = json.load(open(os.path.join(ov, 'scenes.json')))
FPS, W, H = 30, 1080, 1920
scenes = meta['scenes']
scenes[-1]['b'] = meta['dur']


def src(name, required=True):
    for ext in ('mp4', 'mov', 'jpg', 'jpeg', 'png'):
        f = os.path.join(fdir, f'{name}.{ext}')
        if os.path.exists(f):
            return f, ext in ('jpg', 'jpeg', 'png')
    if required:
        sys.exit(f'footage {name} tidak ada di {fdir}')
    return None


args, chains, parts = ['ffmpeg', '-y', '-loglevel', 'error'], [], []
frames = [round(s['a'] * FPS) for s in scenes] + [round(meta['dur'] * FPS)]
for i in range(len(scenes)):
    n = frames[i + 1] - frames[i]
    second = src(f'b{i + 1}b', required=False)
    pieces = [(src(f'b{i + 1}'), n // 2 if second else n)] + ([(second, n - n // 2)] if second else [])
    for (f, still), m in pieces:
        d, idx = m / FPS, len(parts)
        args += (['-loop', '1', '-framerate', str(FPS)] if still else ['-stream_loop', '-1']) + ['-t', f'{d + .5:.3f}', '-i', f]
        # foto: zoom lebih terasa (Ken Burns), video: dorong pelan saja
        z0, dz = (1.02, .12) if still else (1.06, .04)
        chains.append(
            f"[{idx}:v]fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
            f"scale=w='trunc({W}*({z0}+{dz}*t/{d:.3f})/2)*2':h=-2:eval=frame,crop={W}:{H},setsar=1,"
            f"eq=contrast=1.18:brightness=-0.09:saturation=0.78,"
            f"colorbalance=rs=-0.05:bs=0.07:rh=0.07:bh=-0.05,"
            f"trim=end_frame={m},setpts=PTS-STARTPTS,format=yuv420p[s{idx}]")
        parts.append(idx)
k = len(parts)
args += ['-framerate', str(FPS), '-i', os.path.join(ov, 'f%04d.png')]
chains.append(''.join(f'[s{i}]' for i in range(k)) + f'concat=n={k}:v=1:a=0[bg]')
chains.append(f'[bg][{k}:v]overlay=format=auto,vignette=angle=PI/4.2,noise=alls=7:allf=t,format=yuv420p[v]')
if vo:
    args += ['-i', vo, '-i', sfx]
    chains.append(f'[{k + 1}:a]aresample=48000,apad[vo];[{k + 2}:a]volume=0.25[bg_a];'
                  f'[vo][bg_a]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-14:TP=-1.5[a]')
args += ['-filter_complex', ';'.join(chains), '-map', '[v]']
if vo:
    args += ['-map', '[a]', '-c:a', 'aac', '-b:a', '192k']
args += ['-c:v', 'libx264', '-crf', '19', '-preset', 'medium', '-pix_fmt', 'yuv420p',
         '-t', f"{meta['dur']:.3f}", '-movflags', '+faststart', out]
subprocess.run(args, check=True)
print('selesai:', out)
