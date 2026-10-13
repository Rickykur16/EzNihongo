"""Gabungkan footage b1..b7 (footage.md) + grafik transparan (render OVERLAY=1) + audio.

python3 compose.py <dir-overlay> <dir-footage> <keluaran.mp4> [vo.mp3 sfx.wav]

- <dir-overlay>: hasil `OVERLAY=1 node render.mjs <dir> full` (f0000.png.. + scenes.json).
- <dir-footage>: b1..b7 dengan ekstensi .mp4/.mov/.jpg/.jpeg/.png (foto boleh, digerakkan pelan).
  Footage yang lebih pendek dari adegannya diulang.
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


def src(i):
    for ext in ('mp4', 'mov', 'jpg', 'jpeg', 'png'):
        f = os.path.join(fdir, f'b{i}.{ext}')
        if os.path.exists(f):
            return f, ext in ('jpg', 'jpeg', 'png')
    sys.exit(f'footage b{i} tidak ada di {fdir}')


args, chains = ['ffmpeg', '-y', '-loglevel', 'error'], []
frames = [round(s['a'] * FPS) for s in scenes] + [round(meta['dur'] * FPS)]
for i, s in enumerate(scenes):
    f, still = src(i + 1)
    n = frames[i + 1] - frames[i]
    d = n / FPS
    args += (['-loop', '1', '-framerate', str(FPS)] if still else ['-stream_loop', '-1']) + ['-t', f'{d + .5:.3f}', '-i', f]
    chains.append(
        f"[{i}:v]fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
        f"scale=w='trunc({W}*(1.06+0.04*t/{d:.3f})/2)*2':h=-2:eval=frame,crop={W}:{H},setsar=1,"
        f"eq=contrast=1.18:brightness=-0.09:saturation=0.78,"
        f"colorbalance=rs=-0.05:bs=0.07:rh=0.07:bh=-0.05,"
        f"trim=end_frame={n},setpts=PTS-STARTPTS,format=yuv420p[s{i}]")
k = len(scenes)
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
