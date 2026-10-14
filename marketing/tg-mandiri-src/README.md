# Video "Tutorial TG mandiri: 7 langkah tanpa LPK" (9:16, ±38 detik)

Template dari `../kenapa-mahal-src` (render per frame dari `<canvas>`, caption per potongan
ucapan, kilatan putih, efek suara & musik sintetis). Bedanya: semua B-roll digambar sendiri
(bilah progres 7 langkah, kartu bernomor, ikon, sertifikat, COE, laptop SISKOP2MI, paspor+visa),
tanpa foto, supaya tidak kena label "AI-generated" TikTok seperti video LPK.

Naskah & dasar isi: `naskah.md`.

## Alur

1. Pemilik generate VO dari `naskah.md`, kirim MP3 → simpan sebagai `vo.mp3` (tidak di-commit).
2. `ffmpeg -i vo.mp3 -af silencedetect=n=-38dB:d=0.25 -f null -` → isi `SEGT` di `video.html`
   (satu [mulai, selesai] per potongan ucapan; potong paragraf VO/CAP dengan "|"), dan `DUR`.
3. Render & audio sama persis dengan `../kenapa-mahal-src/README.md` (render.mjs, cues.mjs,
   sfx.py). Mode footage (`OVERLAY=1` + `compose.py`) juga tersedia kalau nanti mau pakai foto/video
   asli sebagai latar.
