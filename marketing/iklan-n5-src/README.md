# Iklan "Akses platform EzNihongo N5 Rp249.000" (9:16, ±37 detik)

Pembuka TG mandiri, lalu penawaran platform N5. Gaya & alat sama dengan `../tg-mandiri-src`
(kanvas hitam, kotak merah atas, panel 16:9, kotak putih bawah). Tangkapan layar aplikasi
(`app-kosakata.jpg`, `app-review.jpg`) dipotong dari `assets/landing/` (data contoh).

Alur: VO dari `naskah.md` → `vo.mp3` (tidak di-commit) → isi `SEG`/`DUR` di `video.html` dari
`ffmpeg -i vo.mp3 -af silencedetect=n=-38dB:d=0.25 -f null -` → render seperti
`../biaya-ssw-src/README.md` (`FONT_DIR=<fonts> node render.mjs <dir> full`, `node cues.mjs`,
`python3 sfx.py cues.json sfx.wav`, gabung VO + sfx, loudnorm -14 LUFS).
