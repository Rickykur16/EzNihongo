# Audit kualitas assignment N5 dan revisi v6

Audit 18 Oktober 2026 mencakup seluruh **684 soal aktif** pada assignment N5 Bab 3–20: dua paket A/B Bab 3 dan satu paket pada setiap Bab 4–20, sehingga ada 19 paket. Setiap pengerjaan tetap **36 soal: 11 aksara/kosakata, 9 tata bahasa, 3 membaca, dan 13 menyimak**. Jumlah tersebut mengikuti pembulatan proporsi perkiraan butir JLPT yang dijelaskan dalam [rilis v5](assessment-expanded-n5.md); bukan bobot nilai atau skala skor resmi JLPT.

Review mencakup stem, pilihan dan kunci, penjelasan, alasan pengecoh, teks bacaan, naskah audio, gambar, tujuan belajar, serta batas materi kumulatif. Perbaikan diterapkan melalui bank baru `n5-assessment-v6`. Bank v5, sumber penulisannya, dan snapshot pengerjaan sebelumnya tetap menjadi riwayat yang utuh.

## Dasar pemeriksaan

Sumber utama dalam repo:

- `backend/content/assessments/n5-b03.json`: bank fondasi Bab 3 beserta enam tujuan dan batas materi.
- `backend/content/assessments/support/n5-04-20.mjs` dan `backend/content/assessments/jlpt/`: bank Bab 4–20 dan perbaikan pendukung sebelumnya.
- `backend/content/assessments/expanded/index.mjs`, `b03.mjs`, `b04-09.mjs`, `b10-14.mjs`, `b15-20.mjs`, dan berkas `extra-*`: keseluruhan paket v5 yang menjadi sumber audit.
- `backend/content/bab3/vocabulary-examples.json`: kosakata dan contoh fondasi Bab 3.
- `backend/content/n5-support/vocabulary-examples.json`, `grammar-support.json`, `grammar-authored-04-11.mjs`, `grammar-authored-12-20.mjs`, serta berkas `dialogues-*`: penempatan kosakata, pola, dan contoh pendukung.
- [Metode penulisan dan tahapan bahasa](assessment-jlpt-n5-reference.md), [dukungan assignment](assessment-support-b04-20.md), dan [catatan pertukaran urutan bab](n5-chapter-order.md).

Identitas sumber mengikuti slug dan UUID yang stabil. **Source13 / `n5-b13` kini tampil sebagai Bab 14**, sedangkan **source14 / `n5-b14` tampil sebagai Bab 13** setelah migrasi 213. Review memeriksa isi terhadap materi asal dan urutan tampilan yang berlaku; nomor pada ID historis tidak ditulis ulang. Bentuk biasa, negatif, dan kewajiban pada Bab 13 tampilan tidak harus menguasai izin/larangan yang kini berada sesudahnya.

Sumber repo menunjukkan materi yang direncanakan dan disimpan. Itu tidak membuktikan bahwa setiap penjelasan tambahan dalam video atau pertemuan pengajar sudah ditinjau, dan bukan pemeriksaan perubahan admin yang belum tercatat pada sumber tersebut.

## Perbaikan konkret

Inventaris revisi berisi **47 soal berbeda**: 6 pada `review-early.mjs`, 17 pada `review-middle.mjs`, 22 pada `review-late.mjs`, dan 2 pada `review-visual.mjs`. Hitungan ini adalah jumlah soal yang mendapat patch editorial; penandaan bukti tujuan pada soal lain merupakan perubahan metadata terpisah. Implementasi kompilasinya berada dalam `backend/content/assessments/expanded/reviewed.mjs`.

| Contoh sumber v5 | Sebelum | Sesudah / alasan |
| --- | --- | --- |
| `b07-a-jlpt-r2-4-expanded` | Kota disebut tidak tenang; pilihan murah atau putih masih merupakan sifat lain yang mungkin benar. | Dialog secara eksplisit meminta tanggapan tentang suasana tenang/ramai, sehingga `にぎやか` menjadi satu jawaban terbaik. |
| `b07-a-expanded-listening-3` | `となりの へや` muncul sebelum kosakata posisi pada Bab 8. | Gunakan `あの へや`, yang sudah diajarkan. Fakta dan kunci tetap sama. |
| `b08-a-jlpt-r2-5-expanded` | Memakai `いません` sebelum rangkaian negatif verba sopan pada Bab 10. | Gunakan negatif nominal yang sudah dipelajari: `はこの（　）じゃありません`. |
| `b09-a-jlpt-r2-18-expanded` | Bacaan menyisipkan `あるいて いきます` sebelum pembentukan て pada Bab 12. | Gunakan `でんしゃで いきます`. Pertanyaan tetap menanyakan teman perjalanan. |
| `b09-a-jlpt-r2-7-expanded`, `b09-a-expanded-listening-7` | Verba datang/pergi dapat terlewati dengan memilih tujuan yang berbeda. | Posisi pembicara dan kunjungan pertama disebutkan; alternatif mempertahankan pelaku, waktu, dan tujuan yang sama, lalu membedakan `きます／いきます／かえります`. |
| `b11-a-jlpt-r2-13-expanded` | Susunan ★ memerlukan pemeriksaan urutan alternatif. | Dua objek dan jumlah diberi struktur yang membatasi urutan; kunci diperiksa terhadap posisi ★ yang sebenarnya. |
| `b10-a-jlpt-r2-18-expanded`, `b12-a-jlpt-r2-18-expanded` | Bacaan panjang masih cukup dijawab dari satu fakta. | Gabungkan tempat dan kegiatan Minggu, atau dua kegiatan penulis di kota dengan membedakannya dari kegiatan teman dan kegiatan setelah pulang. |
| `b12-a-jlpt-r2-9-expanded`, `b12-a-jlpt-r2-10-expanded` | Contoh konjugasi tidak sepenuhnya menguji dua verba tidak beraturan yang relevan. | Gunakan `べんきょうする→して` dan `くる→きて`, dengan pengecoh perubahan bentuk yang konkret. |
| Source14, kini Bab 13 | Beberapa naskah dan pilihan mencampur tidak wajib, wajib, larangan, atau materi izin dari bab sesudahnya. | Bedakan tidak wajib membawa dari permintaan tidak memakai; tindakan yang dipilih pembicara dinyatakan eksplisit. |
| `b15-a-jlpt-r2-18-expanded` | Jawaban membaca dapat diambil sebagai satu fakta. | Gabungkan pilihan minuman teman dan jumlah harga dua minuman; uang yang diserahkan bukan otomatis total harga. |
| `b16-a-expanded-listening-1` | Jadwal rutin berpotensi tercampur dengan satu kejadian tertentu. | Sabtu minggu ini dan Sabtu minggu depan dibedakan eksplisit dari jadwal Rabu/Jumat setiap minggu. |
| `b18-a-expanded-listening-4`, `b18-a-expanded-listening-5` | Hasil perbandingan disebut langsung oleh penutur. | Berikan durasi atau berat, lalu siswa menentukan rute lebih singkat atau kotak paling berat. |
| `b19-a-expanded-vocabulary-3` | Dua ungkapan rencana berisiko bersaing sebagai jawaban yang sama-sama sah. | Uji kosakata `ならう` melalui konteks berlatih piano dengan guru, sambil mempertahankan pola niat. |
| `b20-a-jlpt-r2-19-expanded` | Pencarian informasi dapat dijawab tanpa memproses penghubung urutan. | Siswa menghubungkan dua kegiatan dengan dua tempat menurut `それから`, bukan sekadar menyalin satu lokasi. |

Butir baru tetap orisinal. Contoh resmi JLPT menjadi acuan bentuk tugas dan kemampuan, bukan sumber kalimat atau rekaman yang disalin.

## Bukti tujuan dan penilaian

Kategori dan tujuan menjawab pertanyaan yang berbeda. Soal membaca kanji tetap sah untuk skor aksara/kosakata, tetapi membaca `本` saja tidak membuktikan kemampuan memilih `これ／それ／あれ` berdasarkan posisi pembicara. Demikian pula, fakta lokasi pada sebuah tabel tidak otomatis membuktikan pembedaan `あります／います`.

V6 menggunakan `assessment_meta.objectiveEvidence: true` pada butir yang memberi bukti langsung untuk tujuan yang dipetakan. Daftar sumbernya diekspor sebagai `objectiveEvidenceKeys` dari tiga berkas review rentang bab. Penandaan diperiksa per tujuan dan per paket, termasuk keenam tujuan dalam kedua paket Bab 3. Setiap tujuan memiliki sedikitnya dua soal bukti. Migrasi juga memeriksa kecukupan terhadap ambang pengajar agar tidak menghasilkan syarat kelulusan yang mustahil. Ini bukan penandaan otomatis seluruh kategori grammar, reading, atau listening.

**Seluruh 36 soal tetap dihitung dalam skor total dan kategori.** Penanda tersebut hanya membatasi soal yang menjadi bukti kelulusan setiap tujuan. Ambang bawaan tetap total 70%, masing-masing kategori 50%, dan **minimal satu jawaban benar pada bukti setiap tujuan**. Kecukupan jumlah butir bukti tidak sama dengan menaikkan ambang benar menjadi dua. Pengaturan pemilik yang tersimpan tetap dipertahankan dalam kebijakan dan snapshot sesi; aturan baru tidak digunakan untuk menilai ulang sesi lama.

Hasil tujuan masih merupakan bukti terbatas dari pilihan ganda. Itu tidak membuktikan kemahiran bicara spontan atau penguasaan penuh suatu pola di semua situasi.

## Tahapan materi dan tuntutan

| Bab tampilan | Fokus | Perkembangan tuntutan yang dituju |
| --- | --- | --- |
| 3 | Identitas, profesi, keluarga, penyangkalan, pertanyaan, `も／の／ね／よ` | Mengenali informasi dan menanggapi perkenalan; sebagian tugas menggabungkan dua fakta. |
| 4–5 | Benda/kata tunjuk, kepemilikan, harga, jam, umur | Menggunakan posisi penutur dan membedakan benda, satuan, waktu mulai, serta waktu akhir. |
| 6–7 | Kata sifat い dan な, waktu/polaritas, penggabungan sifat, suka dan mahir | Membaca deskripsi Jepang yang lebih utuh; mempertahankan dua penilaian atau membedakan kesukaan dari kemampuan. |
| 8–9 | Keberadaan, posisi relatif, perjalanan | Menentukan referen lokasi; menggabungkan rute, kendaraan, waktu, teman perjalanan, dan sudut pandang datang/pergi. |
| 10–11 | Aktivitas, frekuensi, jumlah/penghitung | Menggunakan fakta kegiatan serta jumlah yang sesuai benda/orang, dengan stimulus utama berbahasa Jepang. |
| 12 | Bentuk て dan urutan kegiatan | Memproses perubahan bentuk dan hubungan antaraktivitas. |
| 13 (`n5-b14`) | Bentuk biasa/negatif, permintaan negatif, wajib/tidak wajib | Membedakan bentuk dan keharusan berdasarkan konteks eksplisit; tidak bergantung pada izin/larangan Bab 14. |
| 14 (`n5-b13`) | Permintaan て, kegiatan berlangsung, izin/larangan | Memilih respons dan tindakan berdasarkan keadaan atau aturan tempat. |
| 15–16 | Pelayanan, pesanan/pembayaran, perubahan, tanggal/jadwal | Menggabungkan orang, pilihan, jumlah, perubahan, dan perbedaan jadwal rutin dengan kejadian tertentu. |
| 17–18 | Kemampuan/hobi dan perbandingan | Membedakan jenis kemampuan serta menghitung atau menyimpulkan hasil perbandingan dari data. |
| 19–20 | Keinginan/rencana/ajakan, pengalaman, alasan/penghubung | Mempertahankan informasi antarorang dan waktu, memahami respons yang tepat, serta menggabungkan alasan atau urutan dari beberapa fakta. |

Bantuan bahasa mengikuti metode sebelumnya: Bab 3 memakai konteks Indonesia; Bab 4–5 memakai target Jepang dengan bantuan Indonesia; Bab 6–9 memakai stimulus dan pilihan terutama Jepang, dengan petunjuk Indonesia bila narasi tugas memerlukan materi yang belum diajarkan. Bab 10–14 memakai isi soal Jepang dan bantuan cara menjawab, bukan terjemahan stimulus. Bab 15–20 memakai petunjuk serta stimulus Jepang. Pembahasan setelah submit tetap Indonesia.

Gambar A/B netral hanya menandai tokoh; situasi dan pilihan diberikan melalui audio. V6 menjelaskan fungsi itu pada label/petunjuk, bukan mengklaim bahwa semua butir tersebut menuntut inferensi dari ilustrasi situasional. Dua gambar lama Bab 4 dan 8 diganti ilustrasi konteks yang tidak mencetak kalimat jawaban. Judul, deskripsi aksesibel, dan label gambar juga diperiksa agar tidak menggantikan tugas memahami informasi.

## Pelestarian versi dan editor

V6 merupakan revisi aditif: sumber v5 tidak diedit dan baris historis tidak dihapus. Soal yang tidak mendapat patch editorial disalin dari bank aktif di database, sehingga redaksi, opsi, kunci, gambar opsi, tautan grammar, serta pemetaan suara admin tetap terbawa, termasuk nilai null yang disengaja. Field yang sengaja direvisi mempunyai pemeriksaan terhadap sumber yang direview; perubahan admin yang bertabrakan harus ditinjau, bukan ditimpa diam-diam.

Snapshot attempt, jawaban, draft/revisi draft, hasil, dan riwayat lama tetap utuh. Pengerjaan lama dinilai dengan soal, kunci, kebijakan, dan penanda bukti milik snapshotnya sendiri. Percobaan baru menggunakan bank aktif baru melalui mekanisme versi yang sudah tersedia. Tidak ada pembuatan sesi otomatis atau penilaian ulang massal atas hasil lama.

Listening tetap memakai endpoint privat serta renderer/cache ElevenLabs yang sama. Kunci, penjelasan, alasan pengecoh, urutan ★, transkrip, dan isi pilihan lisan tidak masuk payload sesi aktif. Pilihan lisan bernomor menjaga urutannya. Naskah baru menghasilkan identitas cache yang sesuai isi dan suara; aset serta cache lama tetap dapat melayani snapshot lama.

Verifikasi rilis mencakup jumlah/kategori setiap paket, bukti setiap tujuan, konsistensi opsi dan kunci ★, urutan pilihan audio, privasi sebelum submit, penilaian snapshot lama, pelestarian edit/suara, pemeriksaan sumber yang berubah, rollback, dan rerun migrasi. Hasil tes serta keberhasilan deployment harus diperiksa pada rilisnya; dokumen audit ini sendiri bukan bukti bahwa deployment telah selesai.

## Batas kesimpulan dan kalibrasi berikutnya

Materi bertambah secara bertahap, tetapi **belum ada dasar untuk menjamin setiap bab secara empiris lebih sulit daripada bab sebelumnya**. Lebih banyak karakter, penggunaan bahasa Jepang, atau jumlah fakta merupakan indikator struktur tugas, bukan ukuran kesulitan yang terkalibrasi. Soal pengulangan yang mudah masih hadir bersama soal integrasi, dan panjang bacaan tidak selalu memaksa siswa menggabungkan seluruh isinya.

Data siswa diperlukan untuk menilai persentase benar tiap butir, waktu pengerjaan/respons, pilihan pengecoh yang benar-benar dipilih, jawaban kosong, pengulangan attempt, dan perbedaan antarversi/paket. Analisis perlu membedakan percobaan pertama dari latihan ulang serta mempertimbangkan paparan materi dan penggunaan replay. Pengecoh yang hampir tidak pernah dipilih dan soal yang dapat dijawab melalui petunjuk sampingan perlu direview kembali.

Audit naskah dan pengujian transport audio tidak menggantikan pemeriksaan manusia terhadap pelafalan, pergantian tokoh, penomoran, jeda, atau keterpahaman semua rekaman. Kelulusan assignment juga bukan prediksi pasti kelulusan JLPT maupun skor resmi ujian tersebut.
