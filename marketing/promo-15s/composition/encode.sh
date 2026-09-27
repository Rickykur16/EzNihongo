#!/bin/sh
# Final encode: concat lossless segments + master audio -> H.264/AAC MP4, 1080x1920, 30 fps, 15.000 s
set -e
cd "$(dirname "$0")"
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i seg/list.txt -i music_raw.wav \
  -map 0:v -map 1:a \
  -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -c:v libx264 -preset slow -crf 17 -profile:v high -level:v 4.2 -g 30 -bf 2 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -af "alimiter=limit=0.84:level=false:attack=1:release=40" -c:a aac -b:a 256k -ar 48000 \
  -t 15 -movflags +faststart -metadata title="EzNihongo — Promo 15 detik" "$1"
