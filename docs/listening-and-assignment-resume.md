# Listening dan kelanjutan assignment

Editor soal listening dan draft AI memakai editor dialog yang sama dengan Bunpou. Admin memilih pemeran, nama tampilan, dan suara dari katalog ElevenLabs, mengetes satu giliran atau seluruh naskah, lalu menyimpan soal. Pilihan suara disimpan sebagai `audio_scene` bersama soal; snapshot assessment menyimpan pemetaan itu saat attempt dimulai. Preview dan audio siswa memakai renderer dan cache yang sama. Pertukaran suara antar pembicara menghasilkan kunci cache berbeda.

Migrasi 167 menambah kolom opsional. Migrasi 168 mengoreksi penanda suara lima naskah Bab 3, hanya bila naskah masih sama persis dengan bank yang ditinjau dan belum memiliki pilihan suara admin. Snapshot attempt yang sudah berjalan tetap utuh. Pemeriksaan kualitas pelafalan dengan audio ElevenLabs aktual tetap diperlukan; tes otomatis memakai respons provider pengganti.

Bank Bab 3 memiliki 48 soal dalam dua paket, masing-masing 24. Angka per attempt berasal dari paket yang benar-benar disimpan, termasuk sesi lama berisi 28 soal, bukan ukuran seluruh bank atau konfigurasi lesson saat ini.

Assignment yang sudah dimulai wajib dikirim lengkap sebelum berpindah materi. Membuka kembali halaman siswa mengarahkan ke assignment tertunda yang masih dapat diakses. Pemulihan hanya melanjutkan token yang sama; bila tab lain sudah mengirim hasil, sistem tidak membuat attempt baru. Kewajiban selesai berakhir setelah server mengonfirmasi submit, terpisah dari syarat lulus.

Jawaban pilihan dan teks pada sesi lama disimpan dengan revisi di server. Perubahan terakhir juga disimpan segera di perangkat, dengan kunci pengguna dan token attempt, untuk pemulihan saat refresh sebelum permintaan selesai. Draf lokal tidak menimpa revisi server yang lebih baru. Sesi tidak kedaluwarsa karena situs ditutup. Data legacy yang kehilangan soal tidak diperkecil diam-diam dan tidak menjadi target pengalihan otomatis.

Verifikasi mencakup CRUD dialog/suara, audio privat, pertukaran suara dan cache, migrasi berulang, jumlah soal, kepemilikan/enrollment, draf/revisi, tab bersamaan, dan pemulihan sesi. Pengujian browser lokal membuktikan refresh segera setelah memilih tetap mempertahankan jawaban, navigasi tertahan sebelum submit, serta navigasi terbuka kembali setelah 24 jawaban dikirim.
