# Video brand awareness EzNihongo (30 detik)

Dua versi:
- **`../eznihongo-brand-30s-9x16.mp4`** (utama, TikTok/Reels/Shorts) — `video-9x16.html`,
  1080×1920. Gaya caption mengikuti referensi konten edukasi: tumpukan kata kecil /
  kata kunci besar (Montserrat 900) / sambungan serif miring (Playfair Display Italic),
  muncul per kata blur→tajam, kotak judul merah, flash putih antar-adegan, slide
  tipografi merah & belah abu/merah. Render: `VIDEO=video-9x16.html W=1080 H=1920
  node render.mjs <dir> full`; cue: `VIDEO=video-9x16.html OUT=cues-9x16.json node cues.mjs`.
  Adegan Bootcamp (6,3–10,3 dtk) memakai halaman Live Class asli dengan data contoh
  (`node shoot-live.mjs .` → `live-upcoming.png`, `live-recordings.png`). Klaim "2×
  seminggu" dan rekaman sesuai landing & halaman Live Class; "3 bulan" dari pemilik
  produk — BELUM tercantum di website.
- `../eznihongo-brand-30s.mp4` (16:9, versi sebelumnya) — `video.html`.

B-roll hook memakai foto berlisensi Pexels/Unsplash yang sudah ada di repo
(`assets/landing/*`, `assets/dashboard/*`). Situs stok video (Pexels video, Pixabay,
Mixkit, dll.) diblokir jaringan sandbox saat video ini dibuat.


Hasil: `../eznihongo-brand-30s.mp4` — 1920×1080, 30 fps, H.264 + AAC stereo (-16 LUFS).

Isi (UI aplikasi siswa saja, tanpa landing page): pembuka logo → Dashboard →
Belajar (kartu kosakata + drill) → Smart Review (jawab benar → dijadwal ulang)
→ Progres → tampilan HP → penutup `eznihongo.com`. Semua data di layar adalah
data contoh.

## Render ulang

1. Sajikan root repo: `npx http-server -p 8099 -s -c-1 .`
2. Unduh font Google ke `fonts/` (`fonts.css` + file woff2 berpath `/__fonts/<nama>`):
   Chromium sandbox menolak sertifikat proxy untuk fonts.googleapis.com, jadi
   font disajikan lokal lewat `fontroute.mjs`. Tanpa ini teks jatuh ke font cadangan.
3. (Opsional) tangkap ulang Dashboard dengan data contoh: `node shoot3.mjs .`
4. Render frame: `node render.mjs <dir-frame> full` (900 JPEG, fungsi `render(t)`
   di `video.html` deterministik per waktu, bukan rekaman real-time).
5. `ffmpeg -framerate 30 -i <dir>/f%04d.jpg -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart ../eznihongo-brand-30s.mp4`

## Audio

Semua suara disintesis `sfx.py` (numpy), tanpa sampel/musik berlisensi: whoosh
transisi, pop label, klik, denting jawaban benar, tick progress, dentum logo,
plus pad tipis dan petikan ala koto (tangga nada yo). Waktunya dari `window.CUES`
di `video.html` — ubah animasi, ubah cue-nya di tempat yang sama.

1. `node cues.mjs` → `cues.json`
2. `python3 sfx.py cues.json sfx.wav`
3. Normalisasi loudnorm dua tahap ke -16 LUFS / TP -1.5, naikkan 1,5 dB + `alimiter=limit=0.7:level=disabled` (hasil ±-16 LUFS, peak AAC ±-1,6 dBFS), lalu gabungkan:
   `ffmpeg -framerate 30 -i <dir>/f%04d.jpg -i sfx-norm.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart ../eznihongo-brand-30s.mp4`

Tangkapan Belajar/Review/Progres memakai `assets/landing/*.png` yang sudah ada.
