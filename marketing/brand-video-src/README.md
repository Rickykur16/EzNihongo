# Video brand awareness EzNihongo (30 detik)

Hasil: `../eznihongo-brand-30s.mp4` — 1920×1080, 30 fps, H.264, tanpa audio.

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

Tangkapan Belajar/Review/Progres memakai `assets/landing/*.png` yang sudah ada.
