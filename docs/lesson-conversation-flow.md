# Alur grammar, percakapan, dan Tugas Bunpou

Keputusan produk, 27 September 2026: tahap percakapan mengikuti setiap lesson
grammar, kemudian Tugas Bunpou terkait. Keputusan ini menggantikan placement
V1 yang menyembunyikan percakapan di dalam kartu grammar serta usulan untuk
mengumpulkan seluruh percakapan di akhir bab.

```text
Intro Bab → Kosakata → Kanji
  → Grammar 1 → Percakapan 1 + cek pemahaman → Tugas Bunpou 1
  → Grammar 2 → Percakapan 2 + cek pemahaman → Tugas Bunpou 2
  → Kuis Bab
```

Jumlah pengulangan mengikuti lesson yang tersedia. Materi tanpa dialog tidak
memerlukan tahap percakapan kosong. Urutan bab kana tetap mengikuti materinya.

## Kontrak pengalaman belajar

- Sidebar dan ringkasan modul menampilkan percakapan tepat setelah grammar
  sumbernya. Setiap percakapan dapat dibuka langsung.
- Grammar menampilkan penjelasan, pola, dan contoh kalimat. Percakapan
  menampilkan tujuan komunikasi, dialog, dan cek pemahaman yang tersedia.
- Tombol Lanjut dari grammar menuju percakapan, lalu menuju tugas terkait.
  Tombol Sebelumnya dari tugas kembali ke percakapan. Popup otomatis tidak
  boleh melompati percakapan.
- Percakapan menggunakan dialog, terjemahan, suara, furigana, soal, dan
  identitas sumber yang sudah ada. Tidak membuat salinan materi atau soal.
- Percakapan merupakan tahap tampilan untuk lesson sumber, bukan lesson DB
  baru. Membuka atau melewatinya tidak menambah completion, XP, atau mastery.
  Jumlah materi selesai tetap menghitung lesson asli.
- URL percakapan menyimpan course, module, lesson sumber, dan jenis tampilan
  sehingga refresh tetap membuka percakapan yang sama.
- Dashboard, ringkasan modul, dan resume memakai urutan yang sama. Jika tugas
  berikutnya belum selesai, resume membuka percakapan pendahulunya. Progres
  Dashboard dan halaman Progres menghitung tugas terkait sebagai materi asli.
- Soal mengikuti kesiapan dan compatibility sesi yang ditetapkan server.
  Dialog dan navigasi tetap tersedia bila soal tidak tersedia atau API gagal.

## Verifikasi

Periksa bab dengan dua grammar: urutan sidebar, grammar→percakapan→tugas
untuk keduanya, tombol Sebelumnya, refresh/deep link, dan kuis akhir. Pastikan
render grammar tidak menggandakan dialog, percakapan tidak menandai sumber
atau tugas selesai, sumber soal tetap lesson asli, dan bab tanpa dialog tidak
berubah menjadi tahap kosong.

Verifikasi lokal memakai dua grammar dan dua tugas sintetis dengan renderer
asli. Grammar → percakapan → tugas, kembali dari tugas, pemeriksaan jawaban,
refresh percakapan, ringkasan modul, dan tampilan lebar 390 px sudah diperiksa.
Percakapan tidak mengirim write progres. Pengujian otomatis juga mencakup
source ID soal, tautan Dashboard, fallback sesi lama, serta respons completion
yang terlambat setelah berpindah halaman.
