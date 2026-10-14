# Video "Jangan buru-buru masuk LPK" (9:16, ±45 detik)

Folder ini dulu bernama video "kenapa magang mahal"; arah isinya diubah pemilik (13 Okt 2026)
jadi himbauan cek LPK sebelum bayar. Nama folder dibiarkan.

Gaya mengikuti video referensi pemilik (13 Okt 2026): B-roll sinematik gelap, teks kecil per
potongan kata di tengah bawah (kotak gelap), kilatan putih tiap ganti paragraf, kamera dorong
pelan + hentakan di awal adegan, butiran film & vinyet. **Tanpa wajah** (keputusan pemilik):
semua B-roll digambar sendiri di `<canvas>` (uang jatuh, tumpukan screenshot komentar, grafik
batang, kolom pencarian izin, kertas rincian biaya, cicilan 24 bulan, siluet + sertifikat, kata
kunci, logo). Tidak ada foto stok (egress sandbox memblokir Pexels/Unsplash/Canva).

Naskah, sumber, dan batasan klaim: `naskah.md`. Komentar di hook = pengakuan warganet dari
screenshot pemilik, identitas dipikselkan.

## Alur

1. Pemilik generate VO di ElevenLabs v4 dari `naskah.md`, kirim `vo.mp3`.
2. Cari jeda antar-paragraf: `ffmpeg -i vo.mp3 -af silencedetect=n=-38dB:d=0.25 -f null -`,
   petakan ke 7 paragraf, isi `PARA` (detik mulai tiap paragraf) dan `DUR` di `video.html`.
   Caption dibagi otomatis per paragraf menurut jumlah huruf; adegan "cta" dipicu kata "Simpan".
3. Render: sajikan root repo `python3 -m http.server 8099 --bind 127.0.0.1`, lalu
   `FONT_DIR=<folder fonts.css+woff2> node render.mjs <dir> full` (lihat `../biaya-ssw-src/README.md`
   untuk folder font). Pratinjau frame: `node render.mjs <dir> 0,10,20`.
4. Audio: `node cues.mjs && DUR=<durasi> python3 sfx.py cues.json sfx.wav` (efek kilatan/whoosh +
   musik latar gelap sintetis), lalu gabung dengan VO:
   `ffmpeg -framerate 30 -i <dir>/f%04d.jpg -i vo.mp3 -i sfx.wav -filter_complex "[1:a]aresample=48000,apad[vo];[2:a]volume=0.25[bg];[vo][bg]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-14:TP=-1.5[a]" -map 0:v -map "[a]" -c:v libx264 -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -t <durasi> -movflags +faststart ../jangan-buru-buru-lpk-9x16.mp4`

## Versi footage sinematik (permintaan pemilik, 13 Okt 2026)

Latar kanvas bisa diganti B-roll video sungguhan. Daftar klip + kata kunci Pexels: `footage.md`
(egress sandbox memblokir Pexels/Pixabay, jadi pemilik yang mengunduh, lewat Google Drive).

1. Render grafik transparan: `OVERLAY=1 FONT_DIR=<fonts> node render.mjs <dir> full`
   (PNG transparan + `scenes.json`; ±1,1 GB untuk 44 dtk, hapus setelah dipakai).
2. Audio sama seperti di atas (`cues.mjs` + `sfx.py`).
3. Gabung: `python3 compose.py <dir> <folder-footage> ../jangan-buru-buru-lpk-9x16.mp4 vo.mp3 sfx.wav`.
   Footage `b1..b7` (.mp4/.mov/.jpg/.png) di-crop 9:16, di-grade gelap teal-oranye, didorong pelan;
   vinyet + butiran film ditambahkan di sini. Diuji dengan klip sintetis (beda ukuran, klip lebih
   pendek dari adegan, foto diam): 1320 frame, 44,0 dtk, ±4,5 menit.
