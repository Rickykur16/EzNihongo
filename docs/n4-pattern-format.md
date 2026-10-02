# Format pola N4 mengikuti N5

125 kartu tata bahasa dalam 24 bab N4 memakai pembagian yang sama dengan kartu
N5: **Pola** berisi rumus singkat, **Arti** berisi fungsi ringkas, dan **Catatan
sensei** menampung penjelasan penggunaan. Acuan tampilan diperiksa langsung pada
editor N5 Bab 3 dan N4 Bab 1 pada 3 Oktober 2026.

Contoh perubahan:

| Sebelum | Sesudah | Arti ringkas |
|---|---|---|
| V bentuk biasa＋N 母が作った料理・使わない物 | V bentuk biasa＋N | menerangkan benda dengan klausa — “benda yang …” |
| Vて＋しまう てしまう→ちゃう；でしまう→じゃう | 〜てしまう／〜ちゃう／〜じゃう | menyelesaikan seluruh tindakan atau menyatakan sesuatu yang terlanjur terjadi |
| Vます-stem＋そうだ Aい hapus い／Aな-stem＋そうだ | 〜そうだ（penampakan） | menyatakan kesan yang tampak — “kelihatannya … / akan segera …” |
| 普通形＋そうだ／そうです N・Aな非過去肯定：だそうだ | 〜そうだ（kabar） | melaporkan informasi — “katanya/saya dengar …” |

Label penampakan/kabar, hormat/pasif, serta bentuk konjugasi dipertahankan agar
pola yang tampak serupa tidak tercampur. Varian lengkap, aturan konjugasi,
pengecualian, dan contoh pemakaian tetap tersedia pada catatan serta contoh yang
sudah ditulis dalam materi pendukung N4. Judul kartu merangkum keluarga pola;
bukan daftar lengkap seluruh variasinya.

Sumber editorial baru adalah
`backend/content/n4-support/pattern-format.tsv`. Urutan per bab mengacu pada
`support-plan.json`; generator mengubahnya menjadi 125 pemetaan ID yang eksplisit.
Snapshot dan migrasi lama tidak diubah karena diperlukan untuk instalasi baru
dan riwayat migrasi.

```sh
node backend/scripts/build-n4-pattern-format.mjs
node --test backend/src/n4-pattern-format.test.js
```

Dengan `TEST_DATABASE_URL` menunjuk database PostgreSQL lokal bernama test,
pengujian juga menjalankan migrasi dan memeriksa pelestarian data, pembatalan
saat kartu berubah/hilang/pindah pelajaran, kartu yang sudah diformat lewat
editor, serta replay setelah edit guru.

Migrasi 193 hanya memperbarui `module_grammar.pattern` dan `meaning` beserta
`updated_at`. Catatan, contoh, dialog, suara, soal, konfigurasi latihan, ID,
urutan, keanggotaan pelajaran/tugas, dan riwayat siswa tetap. Cadangan dua kolom
sebelum/sesudah disimpan pada `n4_pattern_format_backup_193`. Semua identitas dan
nilai sumber diperiksa sebelum perubahan pertama. Edit sumber yang tidak
sesuai menghentikan seluruh migrasi dalam transaksi runner; tidak ditimpa.
Replay yang sudah lengkap tidak menimpa edit guru berikutnya.

Untuk pemulihan, bandingkan nilai sekarang dengan `after_fields` dahulu, lalu
pulihkan `before_fields` hanya pada kartu yang masih cocok. Jangan menimpa edit
guru yang lebih baru. Perubahan format akan diterapkan pada situs saat branch
ini digabungkan dan proses deployment menjalankan migrasi 193.
