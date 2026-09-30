# Perbaikan pendukung assignment Bab 4–20

## Batas perubahan

Audit membaca seluruh 408 soal aktif `n5-assessment-v4`: enam aksara/kosakata, sepuluh tata bahasa, empat membaca, dan empat menyimak per bab. Sumber v3 beserta 24 revisi v4 diperiksa bersama. Kanji, kosakata, pola inti, tujuan, jumlah soal, kunci, opsi, ID, aturan nilai, dan audio tidak berubah. Sumber historis serta migrasi 171, 172, dan 175 tetap utuh.

Empat koreksi khusus:

| Bab / nomor | Masalah | Perbaikan |
| --- | --- | --- |
| 6 / 4 | Buku putih juga dapat menyenangkan; dua sifat tidak saling meniadakan. | Pertanyaan secara eksplisit meminta penilaian apakah buku menyenangkan, agar `おもしろい` menjawab maksud yang diminta. |
| 10 / 18 | Bacaan menyebut belajar di sekolah setiap hari lalu menyebut hari Minggu belajar di rumah. | Hapus klaim setiap hari; jadwal Minggu dan jawaban tetap sama. |
| 13 / 17 | Larangan telepon memakai `てもいけません`, sementara target bab adalah `てはいけません`. | Gunakan pola larangan yang sama dengan materi inti. |
| 19 / 5 | Tidak ada pekerjaan belum cukup untuk memastikan seseorang luang. | Tambahkan pernyataan eksplisit tidak sibuk. |

Tidak ditemukan pengulangan masalah stimulus profesi/kewarganegaraan yang hilang seperti Bab 3. Empat koreksi di atas bukan penggantian seluruh bank.

## Tugas penerapan

Tujuh belas instruksi generik diganti tugas menulis sesuai bab: kartu dengan fakta, contoh tulisan 4–5 kalimat, tahapan kerja, variasi yang diterima, serta rubrik informasi, tata bahasa, kelengkapan, dan keterpahaman. Tugas memakai materi kumulatif sampai bab terkait dan tidak mengubah nilai pilihan ganda. Instruksi percakapan baru ditunda bersama model percakapannya.

Model percakapan baru ditahan untuk fase percakapan sesuai arahan pengguna. Migrasi 185 tidak menambahkan atau mengganti `exampleDialogue`; bila admin memiliki contoh percakapan lama, nilainya tetap dipertahankan. Draft awal terpisah di `draftDialogueExamples`, bukan bagian payload yang diterapkan.

## Pelestarian dan pemeriksaan

Migrasi 185 hanya menargetkan assignment kursus `n5`, modul `n5-b4` sampai `n5-b20`, dan bank v4 dengan 24 soal. Backup menyimpan baris lesson lengkap serta empat soal yang disentuh, termasuk opsi. Field sumber yang berbeda dari hasil audit atau tugas admin yang berbeda memblokir penerapan agar dapat ditinjau. Rerun setelah berhasil tidak menimpa edit admin berikutnya.

Seluruh snapshot attempt, jawaban, hasil, riwayat, suara, dan opsi tetap tersimpan. Percobaan baru mengambil dukungan yang direvisi; percobaan lama tetap memakai snapshot lama.

Perintah pemeriksaan:

```text
node backend/scripts/build-assessment-support-04-20.mjs --check
node --test backend/src/assessment-support-04-20.test.js
```

Uji SQL dapat memakai `TEST_DATABASE_URL` lokal dengan nama database mengandung `test`, atau `TEST_PGLITE_URL`. Fixture memeriksa 17 kebijakan, 408 soal aktif dan satu baris historis, pelestarian ID/opsi/media/kunci, 34 snapshot attempt, isolasi Bab 3/Bab 21/N4, percakapan lama, rerun, serta rollback atomik saat sumber Bab 19 berubah.

Catatan sumber: snapshot course API tanggal 30 September 2026 memastikan modul dan lesson aktif, tetapi API tersebut tidak menyertakan soal atau assessment policy. Karena itu guard SQL memverifikasi isi target saat penerapan. Audit ini bersifat editorial, bukan evaluasi psikometrik atau audit seluruh hasil TTS.
