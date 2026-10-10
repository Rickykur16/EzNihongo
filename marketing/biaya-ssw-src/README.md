# Video "Biaya Tokutei Ginou mandiri" (9:16, ±63 detik)

Hasil: `../biaya-tg-mandiri-9x16.mp4`, 1080×1920, 30 fps, H.264 + AAC. Belum ada suara narator,
hanya efek suara + musik latar sintetis (`sfx.py`, tanpa sampel berlisensi). Voice-over
direkam terpisah lalu ditaruh per adegan sesuai timestamp di bawah (mis. di CapCut);
kecilkan musik latar ±-12 dB di bawah suara.

Gaya editing mengikuti video referensi dari pemilik produk (konten edukasi TikTok): kanvas hitam,
judul di kotak merah atas ("BIAYA TOKUTEI GINOU MANDIRI / DIBEDAH SATU PER SATU"), panel 16:9 di
tengah, kotak putih hook di bawah ("MODAL MULAI 8 JUTAAN, / INI RINCIANNYA !!"). Isi panel: latar gelap /
foto hitam-putih, ilustrasi sketsa garis (SVG, digambar saat muncul), kartu kertas mesin ketik
"BAGIAN 0X / 09" sebelum tiap item, teks kapital putih + label merah, angka geser (JFT → JLPT),
dan struk mesin ketik sebelum TOTAL "± Rp8,1–9,2 jt". Angka total dipakai atas keputusan pemilik
produk untuk video ini (brief landing melarangnya; landing TIDAK diubah). Teks tanpa em dash.

Referensi memakai presenter yang bicara di panel. Video ini tanpa presenter; kalau nanti ada
rekaman wajah, panelnya bisa diisi rekaman itu. Subtitle kecil gaya referensi sebaiknya dibuat
auto-caption CapCut SETELAH voice-over direkam (supaya pas dengan suaranya).

## Naskah voice-over (ElevenLabs, model Eleven Multilingual v2)

Tempel apa adanya. Jeda `<break>` dipakai untuk mencocokkan audio dengan adegan: setelah MP3
jadi, deteksi jedanya (`ffmpeg -i vo.mp3 -af silencedetect=n=-35dB:d=0.4 -f null -`) lalu
isi `SEG` di `video.html` dengan detik mulai tiap paragraf, dan `DUR` = panjang audio + ±1,5 dtk.

```
Kerja di Jepang modal mulai delapan jutaan. Ini lewat jalur SSW, tanpa LPK. Sini aku bedah satu per satu. <break time="0.6s" />

Ujian bahasa, pilih salah satu. JFT-Basic lima ratus lima puluh ribu, atau JLPT N4 dua ratus lima puluh ribu. <break time="0.6s" />

Ujian keterampilan, dua ratus dua puluh sampai tujuh ratus empat puluh ribu. <break time="0.6s" />

Gagal ujian? Bayar lagi. <break time="0.6s" />

Paspor, mulai enam ratus lima puluh ribu. <break time="0.6s" />

SKCK, tiga puluh ribu. <break time="0.6s" />

Psikotes, maksimal lima ratus lima puluh ribu. <break time="0.6s" />

e-KTKLN, gratis. <break time="0.6s" />

BPJS pekerja migran, tiga ratus tujuh puluh ribu. <break time="0.6s" />

Visa Jepang, satu juta enam ratus lima puluh ribu. <break time="0.6s" />

Medical check-up sekitar satu koma satu juta. Tiket pesawat mulai tiga koma tiga juta, belum bagasi. <break time="0.6s" />

Jadi totalnya delapan sampai sembilan jutaan, itu kalau semua ujian lulus sekali dan belum termasuk bagasi. <break time="0.6s" />

Mau tahu langkah yang pas buatmu? Cek link di bio.
```

## Sumber angka (per Oktober 2026)

- JLPT, JFT-Basic, ujian SSW, paspor, visa: bagian `.cost-section` di `index.html` (sumber di `.cost-sources`).
- SKCK Rp30.000: PNBP PP 76/2020.
- Psikotes maks Rp550.000: KEPKA BP2MI No. 48/2023 (biaya penempatan PMI Jepang visa SSW): batas atas, bukan tarif pasti; konfirmasi tarif terkini sebelum tayang.
- e-KTKLN/E-ID PMI gratis: Standar Pelayanan BP3MI Sumbar ("tidak dikenakan biaya").
- BPJS Ketenagakerjaan PMI Rp370.000 untuk kontrak 24 bulan: Permenaker 4/2023.
- Medical check-up ± Rp1,1 juta: perkiraan dari pemilik produk, beda tiap klinik (bukan tarif resmi).
- Tiket mulai ± Rp3,3 juta: harga Trip.com termurah Jakarta (CGK) → Osaka (KIX), Rabu 28 Okt 2026, sekali jalan, Scoot transit 1x, ¥29.350 (cek 10 Okt 2026), kurs ± Rp113/¥ (8 Okt 2026). Hanya bagasi kabin. Harga tiket berubah tiap hari.
- TOTAL ± Rp8,1–9,2 juta = jumlah semua baris struk: rentang ujian bahasa/SSW/paspor, psikotes dihitung di batas atas Rp550rb, e-KTKLN Rp0, medical & tiket perkiraan. Asumsi: semua ujian lulus sekali, belum bagasi.
- Terjemahan dokumen SENGAJA tidak dicantumkan (menurut pemilik produk tidak ada biaya itu di jalur ini).
- Biaya dukungan SSW ditanggung perusahaan: sama dengan landing (`.cost-section`, "Siapa menanggung").

Angka HARDCODED di `video.html`. Kalau tarif berubah, ubah kartu (`data-n`), `ROWS`, dan naskah di atas.

## Render ulang

1. Sajikan root repo: `python3 -m http.server 8099 --bind 127.0.0.1`
2. Font Google (Inter 500–900, Courier Prime 400/700; subset latin) diunduh ke satu folder berisi
   `fonts.css` (URL ditulis ulang ke `/__fonts/<file>`) + file woff2, lalu `FONT_DIR=<folder>`.
   Chromium sandbox menolak sertifikat proxy untuk fonts.googleapis.com (lihat `../brand-video-src`).
3. Pratinjau frame: `FONT_DIR=… node render.mjs <dir> 10,24,52` → `<dir>/p_<t>.jpg`
4. Frame penuh: `FONT_DIR=… node render.mjs <dir> full` (±1.850 JPEG)
5. Audio: `node cues.mjs && DUR=63.3 python3 sfx.py cues.json sfx.wav`
6. `ffmpeg -framerate 30 -i <dir>/f%04d.jpg -i sfx.wav -af loudnorm=I=-16:TP=-1.5 -c:v libx264 -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart ../biaya-tg-mandiri-9x16.mp4`
