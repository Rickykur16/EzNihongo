# Pengelompokan pelajaran Kosakata N5

Kartu dan daftar dipisahkan menjadi bagian per jenis kata, dengan judul Indonesia,
label Jepang, dan jumlah kata. Bagian yang tidak memiliki kata tidak ditampilkan.
Kata kerja berada lebih dulu, diikuti kata sifat い/な, kata benda, kata ganti/tunjuk,
kata tanya, kata keterangan, bilangan, partikel, kata sambung, imbuhan, dan ungkapan.
Kartu pendek tidak mengikuti tinggi kartu kata kerja dari jenis lain.

`backend/src/n5-vocabulary-type.js` menambahkan `wordType` pada kedua endpoint
konten deck N5. Jenis kata mengambil kategori sumber dengan koreksi eksplisit
untuk label lama yang keliru atau kosong. Katalog bentuk kata kerja menangani
kata kerja yang salah diberi kategori 名詞. Contoh koreksi lain: レストラン/生活
menjadi kata benda, minuman Bab 11 tidak dianggap kata bantu bilangan, dan
毎朝/毎晩/よく berada di bagian kata keterangan. 〜人 dibedakan antara imbuhan
kebangsaan Bab 3 dan kata bantu bilangan Bab 11.

`src/vocabulary-groups.js` mengelompokkan tanpa mengubah array, ID, atau indeks
sumber. Detail dan audio tetap memakai indeks kata aslinya. Urutan tombol detail
mengikuti kelompok yang terlihat, termasuk hasil pencarian. Pencarian menyembunyikan
kelompok kosong, memperbarui jumlah setiap kelompok, dan dipertahankan ketika
berpindah antara kartu dan daftar.

Cakupan tes: 770 entri sumber N5 (46 Bab 3 dan 724 Bab 4–20), koreksi kategori,
kata duplikat, urutan detail, pencarian kedua bentuk kata kerja, pergantian tampilan,
dan tata letak N4 yang tetap berupa daftar/kartu tanpa pengelompokan baru.

Tidak ada migrasi, perubahan bahan ajar, keanggotaan deck, jawaban latihan, atau
progres siswa. Untuk kosakata baru di CMS, gunakan kategori jenis kata yang tepat.
Kategori yang belum dikenal tetap terlihat di bagian Lainnya.
