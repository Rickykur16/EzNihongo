# Assignment N5: 36 soal dengan proporsi JLPT

Bank `n5-assessment-v5` mencakup assignment Bab 3–20. Setiap pengerjaan berisi 36 soal: **11 aksara/kosakata, 9 tata bahasa, 3 membaca, dan 13 listening**. Bab 3 mempertahankan paket A/B bergantian, masing-masing 36; Bab 4–20 menampilkan seluruh 36 soal paket aktif. N4, placement kana, dan final exam tidak berubah.

## Acuan dan pembulatan

[Pengumuman resmi JLPT untuk tes mulai Desember 2020](https://www.jlpt.jp/e/topics/202009091599642827.html), khususnya [tabel N5](https://www.jlpt.jp/userdata/image/N5eng.jpg), memberi jumlah perkiraan 21 kosakata, 17 tata bahasa, 5 membaca, dan 24 listening (67 keseluruhan). Jumlah aktual dapat sedikit berbeda antarpenyelenggaraan. Ini acuan jumlah butir, bukan bobot nilai.

Pembagian 36 × (21,17,5,24) / 67 menghasilkan (11,28; 9,13; 2,69; 12,90). Pembulatan sisa terbesar memberi **11/9/3/13**. Jenis tugas mengikuti [tujuan butir N5](https://www.jlpt.jp/e/guideline/pdf/n5_e_revised.pdf), dengan penyesuaian batas materi bab sesuai [metode penulisan sebelumnya](assessment-jlpt-n5-reference.md). Format tugas bertahap; bab awal tetap dibantu Indonesia dan belum menguji tindakan kompleks sebelum kata kerja dipelajari.

## Isi dan pelestarian

Setiap paket menggabungkan 22 soal dari bank aktif sebelumnya dengan 14 soal orisinal baru (5 kosakata, 9 listening). Total 266 soal baru pada 19 paket, dengan 684 baris aktif. Satu soal tata bahasa dan satu membaca dari setiap paket lama tetap tersimpan pada versi sebelumnya, sehingga proporsi baru dapat tercapai tanpa menghapus bank lama.

Identitas sumber mengikuti slug modul yang stabil. Setelah [pertukaran urutan bab pada migrasi 213](n5-chapter-order.md), sumber `n5-b14` tampil sebagai Bab 13 dan sumber `n5-b13` sebagai Bab 14. Tambahan soal tetap menempel pada materi asalnya; soal baru bentuk biasa/negatif tidak mengharuskan izin/larangan dari bab yang sekarang sesudahnya.

Migrasi 216 menyalin soal yang dipertahankan dari database, termasuk redaksi, opsi, kunci, gambar, tautan grammar, serta pemetaan suara admin (termasuk null). Sumber historis tidak ditulis ulang. Kebijakan tujuan, tugas transfer, kelulusan 70%, minimum kategori 50%, dan minimum satu benar per tujuan tetap mengikuti metode assessment kelas. Proporsi jumlah mengikuti JLPT; sistem ini tetap assessment bab, bukan skor resmi JLPT.

Sesi, draft, jawaban, hasil, dan snapshot lama tidak dimutasi. Runtime tetap menerima versi lama dengan 24 soal. Sesi baru memakai versi baru dan 36 soal; perpindahan eksplisit versi memakai mekanisme yang sudah ada. Migrasi mengunci target, memeriksa identitas dan versi seluruh 18 assignment sebelum perubahan, membuat backup, dan menjaga edit admin pada rerun. Preview jumlah diperbarui tanpa mereset catatan pemilik.

Listening memakai endpoint privat dan renderer/cache ElevenLabs yang sudah ada. Urutan pilihan audio dikompilasi bersama kunci dan alasan; pilihan bernomor tetap tidak diacak. Naskah, isi pilihan lisan, kunci, dan pembahasan hanya tersedia setelah submit. Pemeriksaan otomatis naskah/transport tidak menggantikan review pelafalan seluruh audio atau kalibrasi dengan hasil siswa.

## Verifikasi

`node backend/scripts/build-expanded-n5-assessments.mjs --check` menjaga kesesuaian generator dan migrasi. Pengujian memeriksa blueprint 36, paket A/B, penilaian per kategori/tujuan, privasi, draft/resume, audio privat, penilaian sesi lama, pelestarian edit/suara/riwayat, isolasi N4, rollback atomik, dan rerun. Materi ditulis baru; tidak menyalin soal atau rekaman JLPT resmi.
