# Rebuild assessment N5 Bab 3 — rilis contoh

## Tujuan

Rilis pertama hanya mengganti assessment Bab 3. Assessment menguji kemampuan menggunakan materi Bab 3 dalam konteks singkat dan memberi latihan yang relevan untuk JFT-Basic serta JLPT N5. Rilis ini bukan simulasi resmi dan tidak memakai skala nilai resmi kedua ujian.

Masalah dari bank lama yang harus hilang: kunci tampak di stem, opsi sah dianggap salah, informasi pembeda tidak tersedia, materi di luar urutan, dan nilai total tinggi menutupi kemampuan kosong pada satu bagian.

## Paket dan alur belajar

- Satu bank Bab 3 dengan dua paket A/B, masing-masing 24 soal; total 48 soal.
- Setiap paket berisi 6 soal aksara/kosakata, 10 tata bahasa dan ungkapan, 4 membaca dari dua teks, serta 4 listening dari empat stimulus audio berbeda.
- Semua soal memakai empat opsi dan satu jawaban terbaik. Tidak ada jawaban ketik.
- Paket A dan B mengukur tujuan yang sama dengan stimulus berbeda. Percobaan berikutnya memakai paket lain.
- Listening menguji detail, maksud pembicara, respons yang tepat, atau simpulan dari audio. Transkrip tidak tersedia sebelum submit.
- Tugas transfer setelah tes tetap tersedia sebagai latihan tambahan dan tidak masuk skor otomatis.

## Aturan penilaian

Nilai total minimal 70%, setiap kategori minimal 50%, dan setiap tujuan Bab 3 harus mempunyai sedikitnya satu jawaban benar. Aturan disimpan dalam snapshot attempt agar soal, kunci, dan ambang tidak berubah saat siswa sedang mengerjakan. Angka ini adalah kebijakan awal produk dan perlu dikalibrasi memakai data siswa.

## Integritas dan kompatibilitas

1. Bank JSON menyimpan tujuan, batas materi, kunci, penjelasan, dan alasan setiap pengecoh.
2. Migrasi dibuat secara deterministik dari bank yang sudah direview. Bank lama dan riwayat attempt tetap disimpan.
3. Kunci, penjelasan, alasan pengecoh, dan transkrip audio tidak dikirim pada sesi aktif.
4. Audio hanya dapat diminta oleh pemilik attempt untuk soal listening yang ada dalam paketnya.
5. Jawaban dapat disimpan dan dilanjutkan; hasil serta pembahasan baru tersedia sesudah submit.
6. Bab 4–20 tetap memakai assessment lama sampai contoh Bab 3 dinilai cukup baik untuk diperluas.

## Kriteria penerimaan

- Kedua paket tepat 24 soal dan mengikuti blueprint 6/10/4/4.
- Empat listening per paket memakai empat stimulus yang berbeda dan dapat dijawab dari audio saja.
- Setiap soal memiliki satu kunci yang dapat dipertanggungjawabkan; setiap pengecoh memiliki alasan konkret.
- Kedua paket mencakup seluruh tujuan Bab 3 dan tidak menuntut grammar bab berikutnya.
- Nilai total tinggi dengan salah satu kategori di bawah 50% tetap tidak lulus.
- Refresh/resume, paket alternatif, audio privat, umpan balik tertunda, migrasi berulang, dan attempt lama diuji.
- Uji coba siswa/pengajar serta pemeriksaan audio aktual tetap diperlukan untuk mengukur kesulitan, daya beda, dan keseimbangan paket.
