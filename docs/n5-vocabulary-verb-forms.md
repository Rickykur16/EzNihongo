# Pasangan bentuk kata kerja di pelajaran Kosakata N5

Setiap kata kerja menampilkan bentuk biasa afirmatif nonlampau (bentuk kamus),
lalu bentuk sopan ます, beserta bacaan masing-masing. Berlaku di kartu, daftar,
dan detail kosakata. Speaker hanya membacakan bentuk biasa/kamus. Pencarian
mengenali tulisan dan bacaan kedua bentuk.

`backend/src/n5-verb-forms.js` memuat golongan dan bacaan yang diperiksa untuk
110 kata kerja berbeda / 143 entri pada snapshot kosakata N5. Kata kerja awal
yang sudah ditulis dalam bentuk ます, termasuk yang bacaannya kosong, mendapat
bentuk kamus dari daftar ini. Data asli, ID, keanggotaan deck, jawaban drill,
dan progres belajar tidak diubah; tidak ada migrasi database.

Jangan menentukan golongan hanya dari akhiran る atau kategori CMS. Contohnya
着る dan 切る berbeda golongan, sementara data lama menandai 毎朝, 毎晩, よく,
生活, dan レストラン sebagai kata kerja. Sebaliknya beberapa kata kerja Bab 9
ditandai 名詞. Ungkapan utuh seperti よろしくお願いします tetap berupa ungkapan.

Ketika menambah kata kerja atau mengubah bacaannya di CMS, perbarui katalog dan
tes cakupan. Bacaan yang berbeda dari katalog sengaja tidak dipasangkan agar
perubahan makna seperti 開く「あく」→「ひらく」tidak mendapat pasangan yang salah.

Aturan konjugasi mengikuti [penjelasan tiga golongan kata kerja TUFS](https://www.coelang.tufs.ac.jp/mt/ja/gmod/contents/explanation/039.html),
termasuk pengecualian golongan 1 yang berakhir -iru/-eru dan bacaan 来ます「きます」.

Verifikasi: seluruh 724 entri snapshot diperiksa; 143 kata kerja mendapat dua
bentuk, 581 entri lainnya tidak. Tes mencakup sembilan akhiran godan, ichidan,
する, 来る, kata kerja yang bentuk sumbernya ます, keamanan teks, urutan tampilan,
pencarian kedua bentuk, audio, dan pergantian detail kata kerja ke kata benda.

Audio mengirim teks Jepang bentuk kamus yang sudah ada di kosakata sumber.
Gabungan bacaan seperti `よむ。よみます` bukan teks sumber dan ditolak oleh
allowlist `/api/tts`; jangan mengirim gabungan tersebut atau melonggarkan
allowlist. Tes memeriksa teks audio seluruh 143 entri terhadap kosakata sumber.
