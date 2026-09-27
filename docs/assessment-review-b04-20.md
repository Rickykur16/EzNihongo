# Assessment Bab 4–20

## Cakupan rilis

17 bank baru, masing-masing **24 soal pilihan ganda dan semuanya ditampilkan**.
Total 408 soal: 102 aksara/kosakata, 170 tata bahasa, 68 membaca, dan 68 listening.
Tidak ada jawaban ketik atau pemilihan paket acak. Bab 3 tidak diubah.

Setiap bab memiliki dua bacaan (masing-masing dua soal) dan empat stimulus audio
mandiri: detail, maksud pembicara, respons, serta penggabungan informasi. Fakta
penentu jawaban listening berada di audio. Soal respons tidak menyampaikan
jawaban melalui petunjuk tertulis.

## Batas materi dan review

- Bab 4: kata tunjuk dengan posisi eksplisit; jenis/hubungan benda; konfirmasi.
  `だれの〜ですか` yang sengaja dihapus pemilik tidak diujikan.
- Bab 5: harga, jam, rentang waktu, umur. Tidak menolak varian bacaan sah
  seperti にじゅっさい untuk 二十歳; target ambigu tersebut tidak digunakan.
- Bab 6–7: waktu dan polaritas disebutkan jelas; kata sifat い dan な,
  penggabungan sifat, serta kesukaan/kemahiran sesuai subbab.
- Bab 8–9: posisi relatif dinyatakan lewat teks/urutan; arah gerak selalu
  menyebut posisi pembicara. Tidak meminta menebak denah atau lokasi.
- Bab 10–11: fakta kegiatan positif/negatif dan jumlah diberikan; tidak
  menolak varian 七人 yang sah. Jumlah, penghitung, dan keberadaan dibedakan.
- Bab 12: konjugasi Te, penggabungan, urutan; belum menguji izin/larangan.
- Bab 13: permintaan, keadaan/kegiatan, izin dan larangan.
- Bab 14: bentuk biasa, permintaan negatif, wajib dan tidak wajib.
- Bab 15: pelayanan, pilihan, perubahan. Target membaca beropsi kana,
  bukan mencocokkan kanji yang identik dengan pertanyaan.
- Bab 16: tanggal/hari, jadwal tertentu, serta frekuensi kegiatan.
- Bab 17: ulasan kesukaan/kemahiran dibatasi; fokus kemampuan dan jenis hobi.
- Bab 18: tabel harga, durasi, ukuran/berat dengan kriteria yang jelas;
  tidak menolak kalimat sah hanya karena tidak memakai bentuk yang diharapkan.
- Bab 19: keinginan, niat, rencana, ajakan. つもり dan 予定 tidak dijadikan
  dua opsi bersaing ketika keduanya secara bahasa bisa benar.
- Bab 20: pernah/belum pernah, alasan, tambahan, urutan, pertentangan.

Kalimat memakai kana; target kanji mengambil materi yang sudah diperkenalkan.
Instruksi/konteks berbahasa Indonesia mengurangi beban di luar kemampuan utama.
Pengecoh membedakan makna, bentuk, waktu, jumlah, lokasi atau informasi stimulus.
Skor total minimal 70%, kategori minimal 50%, dan setiap tujuan sedikitnya satu
jawaban benar. Ini assessment pembelajaran, bukan simulasi atau skala resmi JFT/JLPT.

## Integrasi dan perlindungan data

Mode `selection: all` memvalidasi dan mengambil seluruh 24 soal. Sesi lama dan
Bab 3 tetap memakai aturan snapshot masing-masing. Sesi lama yang sedang berjalan
tetap bisa diselesaikan; bank baru berlaku saat memulai percobaan baru.

Migrasi 171 mempertahankan soal lama, riwayat, ID pelajaran, judul yang disetujui,
dan media. Hanya assessment policy, petunjuk dan jumlah per attempt diperbarui.
Tidak menambah penguncian navigasi atau redirect wajib ke assignment. Cooldown
yang diatur admin tetap berlaku. Backup menyimpan metadata sebelumnya dan replay
tidak menimpa perubahan admin berikutnya.

Listening menggunakan route privat dan TTS ElevenLabs yang sudah tersedia.
Pemeran A/B mengambil profil Anna/Hadi yang sudah memiliki suara; jika profil
belum diatur, label A/B menggunakan default suara perempuan/laki-laki aplikasi.
Editor pemeran listening yang sudah ada tetap dapat mengganti suara per karakter.
Transkrip, kunci, dan pembahasan tetap tersembunyi sampai submit.

## Verifikasi

Validasi seluruh bank memeriksa blueprint, ID unik, opsi, kebocoran kunci literal,
dua bacaan, empat stimulus audio, cakupan tujuan, serta sinkronisasi migrasi.
Pengujian PostgreSQL memeriksa rollback saat target hilang, jumlah 408 soal baru,
1.632 opsi, 68 scene audio, pelestarian soal/attempt lama dan media, serta replay.
Pengujian runtime memeriksa seluruh soal tampil tanpa sampling, payload bebas
kunci/transkrip, dan kategori kosong tidak dapat ditutup oleh skor bagian lain.

Review naskah bukan pengukuran daya beda empiris. Kesulitan dan efektivitas
pengecoh perlu dipantau dari jawaban siswa. Pelafalan audio juga bergantung pada
suara ElevenLabs yang dipilih admin; tidak diklaim seluruh hasil TTS sudah didengar.
