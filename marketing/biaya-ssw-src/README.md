# Video "Biaya Tokutei Ginou mandiri" (9:16, ±65 detik)

Hasil: `../biaya-tg-mandiri-9x16.mp4`, 1080×1920, 30 fps, H.264 + AAC, ±65 detik. Audio = VO
ElevenLabs (`vo.mp3`) + efek suara & musik latar sintetis (`sfx.py`, tanpa sampel berlisensi) di
volume 0,22, dinormalisasi ke -14 LUFS.

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

## Naskah voice-over (ElevenLabs Eleven v4, tanpa tag jeda)

VO final: `vo.mp3` (64,1 dtk). Waktu adegan (`SEG` di `video.html`) dicocokkan dengan jeda alami
antar-paragraf: `ffmpeg -i vo.mp3 -af silencedetect=n=-38dB:d=0.18 -f null -`, lalu tiap jeda
dipetakan ke kalimat naskah (v4 tidak membaca `<break>`; `[pause]` sengaja tidak dipakai).
Kalau VO dibuat ulang, ulangi pemetaan ini dan sesuaikan juga detik kemunculan angka di tiap shot.

```
Kerja di Jepang modal mulai delapan jutaan. Ini lewat jalur SSW, tanpa LPK. Sini aku bedah satu per satu.

Ujian bahasa, pilih salah satu. JFT-Basic lima ratus lima puluh ribu, atau JLPT N4 dua ratus lima puluh ribu.

Ujian keterampilan, dua ratus dua puluh sampai tujuh ratus empat puluh ribu.

Gagal ujian? Bayar lagi.

Paspor, mulai enam ratus lima puluh ribu.

SKCK, tiga puluh ribu.

Psikotes, maksimal lima ratus lima puluh ribu.

e-KTKLN, gratis.

BPJS pekerja migran, tiga ratus tujuh puluh ribu.

Visa Jepang, satu juta enam ratus lima puluh ribu.

Medical check-up sekitar satu koma satu juta. Tiket pesawat mulai tiga koma tiga juta, belum bagasi.

Jadi totalnya delapan sampai sembilan jutaan, itu kalau semua ujian lulus sekali dan belum termasuk bagasi.

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
5. Audio: `node cues.mjs && DUR=65.3 python3 sfx.py cues.json sfx.wav`
6. `ffmpeg -framerate 30 -i <dir>/f%04d.jpg -i vo.mp3 -i sfx.wav -filter_complex "[1:a]aresample=48000,apad=whole_dur=65.3[vo];[2:a]volume=0.22[bg];[vo][bg]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-14:TP=-1.5[a]" -map 0:v -map "[a]" -c:v libx264 -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -t 65.3 -movflags +faststart ../biaya-tg-mandiri-9x16.mp4`
