# Video "Biaya Tokutei Ginou mandiri" (9:16, ±95 detik)

Hasil: `../biaya-tg-mandiri-9x16.mp4`, 1080×1920, 30 fps, H.264 + AAC. Belum ada suara narator,
hanya efek suara + musik latar sintetis (`sfx.py`, tanpa sampel berlisensi). Voice-over
direkam terpisah lalu ditaruh per adegan sesuai timestamp di bawah (mis. di CapCut);
kecilkan musik latar ±-12 dB di bawah suara.

Gaya mengikuti `../brand-video-src` (caption per kata blur→tajam, kotak judul merah, flash
antar-adegan). Motif utama: "struk" yang terisi satu baris tiap item biaya, lalu TOTAL
berputar dan berhenti di "???" + stempel "BEDA TIAP ORANG" (tanpa angka total keberangkatan,
sesuai larangan brief landing). Teks tanpa em dash.

## Naskah voice-over per adegan

| Waktu | Adegan | Dibacakan |
|---|---|---|
| 0–6 | Hook | Mau berangkat Tokutei Ginou tanpa LPK, sebenarnya butuh biaya berapa? Tonton sampai habis, kita bedah satu per satu. |
| 6–12 | Konteks | Mandiri artinya kamu urus sendiri: belajar, ujian, sampai dokumen. Ini daftar biaya yang tarif resminya bisa dicek. |
| 12–21 | 01 Ujian bahasa | Pertama, ujian bahasa. Cukup lulus salah satu. JFT-Basic lima ratus lima puluh ribu, atau JLPT N4 dua ratus lima puluh ribu. JLPT lebih murah, tapi cuma ada dua kali setahun. |
| 21–27 | 02 Ujian keterampilan | Kedua, ujian keterampilan sesuai bidang kerjanya. Biayanya dua ratus dua puluh ribu sampai tujuh ratus empat puluh ribu, tergantung bidang. |
| 27–32,5 | Peringatan | Yang sering dilupakan: kalau tidak lulus, kamu bayar ujian lagi. Persiapan yang matang itu cara paling hemat. |
| 32,5–37,5 | 03 Paspor | Ketiga, paspor. Enam ratus lima puluh ribu, atau sembilan ratus lima puluh ribu kalau pilih e-paspor sepuluh tahun. |
| 37,5–41 | 04 SKCK | Keempat, SKCK. Tarif resminya cuma tiga puluh ribu. |
| 41–49,5 | 05 Psikotes | Kelima, psikotes. Ini wajib untuk pekerja migran. Untuk SSW Jepang, BP2MI menetapkan biayanya maksimal lima ratus lima puluh ribu. Pastikan psikolognya terdaftar di HIMPSI. |
| 49,5–56,5 | 06 e-KTKLN | Keenam, e-KTKLN. Ini gratis dari pemerintah, dan daftarnya online sendiri. Kalau ada yang minta bayar untuk ini, hati-hati. |
| 56,5–61,5 | 07 BPJS | Ketujuh, BPJS Ketenagakerjaan untuk pekerja migran. Untuk kontrak dua tahun, tiga ratus tujuh puluh ribu. |
| 61,5–65,5 | 08 Visa | Kedelapan, visa Jepang. Sejak Juli 2026 tarifnya satu juta enam ratus lima puluh ribu. |
| 65,5–72,5 | Tanpa tarif resmi | Medical check-up, terjemahan dokumen, dan tiket pesawat tidak punya tarif resmi. Harganya beda-beda, jadi tanya langsung ke klinik dan maskapai. |
| 72,5–84,5 | Penting | Satu lagi. Biaya dukungan untuk pekerja SSW wajib ditanggung perusahaan penerima, bukan kamu. Kalau perusahaan sudah menanggung sebagian biaya, kamu tidak boleh ditagih lagi untuk itu. Cek isi penawaran kerjanya sebelum tanda tangan. |
| 84,5–89,5 | Total | Total akhirnya beda untuk tiap orang, tergantung bidang, ujian yang kamu pilih, dan kota asal. |
| 89,5–95 | Penutup | Mau tahu langkah yang pas buatmu? Konsultasi lewat link di bio. |

## Sumber angka (per Oktober 2026)

- JLPT, JFT-Basic, ujian SSW, paspor, visa: bagian `.cost-section` di `index.html` (sumber di `.cost-sources`).
- SKCK Rp30.000: PNBP PP 76/2020.
- Psikotes maks Rp550.000: KEPKA BP2MI No. 48/2023 (biaya penempatan PMI Jepang visa SSW): batas atas, bukan tarif pasti; konfirmasi tarif terkini sebelum tayang.
- e-KTKLN/E-ID PMI gratis: Standar Pelayanan BP3MI Sumbar ("tidak dikenakan biaya").
- BPJS Ketenagakerjaan PMI Rp370.000 untuk kontrak 24 bulan: Permenaker 4/2023.
- Biaya dukungan SSW ditanggung perusahaan: sama dengan landing (`.cost-section`, "Siapa menanggung").

Angka HARDCODED di `video.html`. Kalau tarif berubah, ubah kartu (`data-n`), `ROWS`, dan naskah di atas.

## Render ulang

1. Sajikan root repo: `python3 -m http.server 8099 --bind 127.0.0.1`
2. Font Google (Montserrat, Playfair Display, Inter; subset latin) diunduh ke satu folder berisi
   `fonts.css` (URL ditulis ulang ke `/__fonts/<file>`) + file woff2, lalu `FONT_DIR=<folder>`.
   Chromium sandbox menolak sertifikat proxy untuk fonts.googleapis.com (lihat `../brand-video-src`).
3. Pratinjau frame: `FONT_DIR=… node render.mjs <dir> 10,24,52` → `<dir>/p_<t>.jpg`
4. Frame penuh: `FONT_DIR=… node render.mjs <dir> full` (2.850 JPEG)
5. Audio: `node cues.mjs && DUR=95 python3 sfx.py cues.json sfx.wav`
6. `ffmpeg -framerate 30 -i <dir>/f%04d.jpg -i sfx.wav -af loudnorm=I=-16:TP=-1.5 -c:v libx264 -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart ../biaya-tg-mandiri-9x16.mp4`
