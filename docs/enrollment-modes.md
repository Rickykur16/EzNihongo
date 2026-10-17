# Self Learning dan Bootcamp

Kedua program memakai course dan kurikulum yang sama. Jenis program disimpan
di `orders.learning_mode` dan `user_enrollments.learning_mode`:

- `self_learning`: materi dan latihan mandiri.
- `bootcamp`: materi dan latihan, ditambah live class dan rekamannya.

Enrollment berbayar aktif setelah bukti pembayaran disetujui admin, dengan
`expires_at = NOW() + INTERVAL '1 year'`. Enrollment gratis juga berlaku satu
tahun sejak aktif. Status expired tetap dihitung dari waktu kedaluwarsa.

Migrasi 214 membuka Self Learning N5 seharga Rp249.000. Kursus lain belum
dibuka untuk Self Learning. Harga Bootcamp mengikuti konfigurasi lama.
Enrollment yang sudah ada mempertahankan masa aksesnya dan dipetakan sebagai
Bootcamp agar hak akses lama tidak berkurang.

Di Ruang Kerja > Kursus, admin dapat membuka/menutup masing-masing program
dan mengubah harga Self Learning per kursus. Isian harga, fitur, jadwal, dan
gratis/berbayar yang lama berlaku untuk Bootcamp. Status terbit/tersedia
kursus tetap berlaku untuk kedua program.

Checkout dan formulir dashboard mengirim `learningMode`. Klien lama yang
tidak mengirimnya tetap memilih Bootcamp. Harga selalu diambil dari database.
Self Learning selalu berbayar, termasuk jika Bootcamp ditandai gratis.
Pesanan menyimpan harga dan jenis program saat dibuat; perubahan CMS tidak
mengubah pesanan yang sedang berjalan. Batalkan pesanan terbuka sebelum
mengganti jenis program pada kursus yang sama. Satu akun mempunyai satu
enrollment per kursus, sesuai model akses yang sudah ada.

Pengujian:

- `node --test src/enrollment-modes*.test.js` dari `backend/` untuk harga,
  validasi, request checkout, dan pembatasan live class.
- `payment-consistency.test.js` dengan `TEST_DATABASE_URL` lokal untuk
  transaksi persetujuan dan masa akses satu tahun kedua program.
- `registration-crm.test.js` dengan database lokal untuk enrollment gratis,
  profil pendaftaran, dan transaksi checkout.

Migrasi berjalan lewat runner deploy yang sudah ada. Jangan menjalankan
migrasi langsung ke database produksi untuk mencoba fitur ini.
