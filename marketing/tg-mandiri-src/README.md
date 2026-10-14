# Video "Tutorial TG mandiri: 10 langkah tanpa LPK" (9:16, ±70 detik)

Gaya = video "Biaya TG mandiri" (`../biaya-ssw-src`, video pertama yang FYP), atas permintaan
pemilik (14 Okt 2026, "Pake gaya yang ini"): kanvas hitam, judul kotak merah atas ("TUTORIAL TG
MANDIRI / 7 LANGKAH TANPA LPK"), panel 16:9 tengah, kotak putih bawah ("SAVE DULU, INI
LANGKAHNYA !!"), kartu kertas mesin ketik "LANGKAH 0n / 10", ilustrasi sketsa garis, label merah.
Tanpa foto (video LPK kena label AI karena foto).

Bedanya dengan video pertama, sesuai `../catatan-video-tiktok.md`:
- bar atas/bawah dan klaim "10 LANGKAH" sudah tampil penuh di frame 0 (tanpa animasi masuk);
- durasi ±70 detik (bukan 65);
- elemen ditaruh pada kata yang diucapkan lewat `at(paragraf, 'kata')`.

Naskah & dasar isi: `naskah.md`.

## Alur

1. Pemilik generate VO dari `naskah.md`, kirim MP3 → simpan sebagai `vo.mp3` (tidak di-commit).
2. `ffmpeg -i vo.mp3 -af silencedetect=n=-38dB:d=0.25 -f null -` → isi `SEG` (detik mulai tiap
   paragraf) dan `DUR` di `video.html`. Kalau teks VO berubah, samakan juga array `VO`.
3. Render sama dengan `../biaya-ssw-src/README.md`: sajikan root repo
   (`python3 -m http.server 8099 --bind 127.0.0.1`), `FONT_DIR=<fonts> node render.mjs <dir> full`,
   `node cues.mjs && python3 sfx.py cues.json sfx.wav`, lalu gabung VO + sfx (volume 0,22,
   loudnorm -14 LUFS) dengan ffmpeg.
