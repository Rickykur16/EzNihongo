# Midtrans untuk Self Learning

Integrasi memakai akun merchant BARU, terpisah dari akun aplikasi Kanji.
Variabel `MIDTRANS_*` lama tidak dibaca atau diubah oleh pembayaran kursus.

Isi konfigurasi di `backend/.env` pada server (jangan commit atau kirim key ke chat):

```dotenv
COURSE_MIDTRANS_SERVER_KEY=<Server Key akun baru>
COURSE_MIDTRANS_BASE=https://app.sandbox.midtrans.com
COURSE_APP_URL=https://eznihongo.com
```

Untuk production, gunakan **Server Key production akun baru** dan ubah
`COURSE_MIDTRANS_BASE=https://app.midtrans.com`. Key yang kosong membuat
checkout tidak tersedia; aplikasi tidak pernah memakai key merchant Kanji
sebagai cadangan. Snap Redirect tidak membutuhkan Client Key di frontend.

Di dashboard akun Midtrans baru, atur Payment Notification URL:

`https://eznihongo.com/api/course-payments/webhook`

Request Snap juga mengirim `X-Override-Notification` ke URL tersebut.
Finish URL per transaksi mengarah kembali ke `courses/order.html?id=...`.
Return URL dan callback browser tidak memberikan akses. Backend memvalidasi
signature dengan key akun baru, kemudian memanggil GET Status API untuk
memastikan nomor pesanan, nominal, dan status pembayaran. Hanya settlement
atau capture yang diterima fraud detection yang memberi akses satu tahun.

Pesanan tetap menggunakan harga saat dibuat, bukan harga dari browser.
Checkout diserialkan per pesanan dan memakai ulang URL yang telah disimpan.
Jika request pembuatan Snap timeout, retry memakai nomor pesanan yang sama;
tidak membuat transaksi dengan nomor baru secara otomatis. Jika provider
menolak retry sebagai duplikat dan URL belum tersimpan, periksa pesanan pada
dashboard merchant sebelum membantu siswa. Jangan menandai lunas berdasarkan
pesan error atau status dari browser.

Duplikat notifikasi tidak memperpanjang masa akses. Notifikasi pending lama
tidak membatalkan akses yang sudah aktif. Settlement terlambat tetap
diproses walaupun batas pembayaran lokal telah lewat. Full refund/chargeback
mencabut enrollment yang masih terhubung ke pesanan tersebut; tidak mencabut
grant dari pesanan lain. Partial refund tidak otomatis mencabut akses.
Refund dilakukan pada dashboard Midtrans; aplikasi ini tidak mengirim refund.
Laporan keuangan lama memakai status order approved, sehingga pembukuan refund
tetap perlu penyesuaian oleh admin.

Migrasi 215 menambahkan metadata Midtrans dan batas unik satu catatan pembayaran
Midtrans per pesanan. Pesanan Self Learning manual yang belum mempunyai bukti
transfer dialihkan ke Midtrans. Pesanan dengan bukti transfer yang sudah masuk
dan histori pesanan lama mempertahankan alur manual.

Sebelum production, lakukan uji sandbox pada akun baru: bayar pesanan N5,
pastikan notifikasi diterima dan akses aktif setahun; kirim ulang notifikasi
untuk memeriksa masa akses tidak berubah; uji pending dan transaksi gagal.
Tes otomatis memakai respons Midtrans tiruan dan PostgreSQL lokal, bukan
transaksi berbayar atau kredensial merchant sungguhan.

Referensi resmi:

- https://docs.midtrans.com/docs/snap-snap-integration-guide
- https://docs.midtrans.com/reference/handle-notifications
- https://docs.midtrans.com/reference/get-transaction-status
