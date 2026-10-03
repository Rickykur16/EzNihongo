# Marketing — Calon Siswa

Menu **Ruang Kerja → Marketing → Calon Siswa** mencatat prospek sebelum menjadi siswa. Menu **Growth Review** menggabungkan bukti mingguan dari prospek, pesanan yang disetujui, biaya akuisisi, dan keputusan eksperimen. Penyimpanan memakai PostgreSQL backend existing, bukan localStorage. Status penjualan tidak memberi akses kursus atau mengesahkan pembayaran.

## Fitur

- Nama, WhatsApp/email, kursus diminati (boleh belum dipilih untuk akses global), sumber dan pemberi referral, latar belakang, kategori kursus, masalah utama, target waktu, tujuan, dan alternatif yang dipertimbangkan. Catatan kualifikasi, wawancara, bahasa pelanggan, sudut pesan Cost/Career/Convenience, reaksi dan kesediaan membayar, keberatan, alasan keputusan, aksi berikutnya, harga penawaran, PIC, dan tanggal follow-up.
- Tahap: Baru → Dihubungi → Terkualifikasi → Konsultasi → Ditawari program → Berhasil atau Batal. Catatan kualifikasi diperlukan untuk maju ke Terkualifikasi atau tahap sesudahnya. Tahap dapat dibuka kembali. Batal wajib beralasan; status penutup mengosongkan jadwal follow-up.
- Pencarian nama/kontak/referral, filter kursus, sumber dan tahap, antrean masih diproses / jatuh tempo / ditangani saya. Ringkasan mengikuti filter yang sama. Daftar dipaginasi 50 baris; riwayat menampilkan 100 perubahan terbaru.
- Catatan percakapan dan riwayat perubahan tersimpan pada server. Konflik versi menolak penimpaan; formulir tetap terbuka. ID tambah yang stabil mencegah pengiriman ulang membuat catatan ganda. Kontak dinormalisasi dan dideduplikasi per kursus.
- Owner dan staf dengan izin `work.marketing` dapat mengelola data sesuai cakupan kursus. Prospek tanpa kursus hanya untuk akses global. PIC wajib memiliki akses Marketing yang sesuai. Owner dapat menghapus permanen satu prospek beserta riwayatnya.
- Growth Review menampilkan funnel mingguan, konversi dan pendapatan dari pembayaran terverifikasi, kelompok sumber/pesan/segmen/masalah/reaksi harga/referral, keberatan dan kutipan, biaya per sumber, serta biaya per siswa berbayar. Satu review dan satu eksperimen utama tersedia per minggu dan cakupan kursus, dengan versi untuk mencegah penimpaan. Panduan validasi 30 hari dan pertanyaan wawancara tersedia di layar.

## Aktivasi

Implementasi ini tidak otomatis menjalankan perubahan pada produksi. Ikuti proses rilis proyek:

1. Rilis kode backend/frontend termasuk kompatibilitas penghapusan akun. Biarkan `MARKETING_CRM_ENABLED=false` sampai penyimpanan siap.
2. Jalankan workflow manual `Marketing CRM production preflight` setelah rilis kode untuk membaca SHA yang terpasang, status flag, tabel, ukuran database, dan arsip backup tanpa mengubah server. Database harus sudah memiliki tabel inti dan Company Workspace. Buat backup dan verifikasi target migrasi sebelum menerapkan perubahan.
3. Dari `backend`, set `CRM_DATABASE_URL` ke database target yang dipilih, lalu jalankan `node crm-migrations/run.js --apply`. Runner menerapkan `001_marketing_crm.sql` dan `002_marketing_strategy.sql` sesuai urutan. Runner tidak membaca `.env` dan tidak memakai fallback `DATABASE_URL`. Migrasi transaksional, memiliki advisory lock, checksum, dan dapat diulang tanpa menggandakan tabel.
4. Set `COMPANY_WORKSPACE_ENABLED=true` dan `MARKETING_CRM_ENABLED=true` pada backend, lalu restart. Untuk staf terbatas gunakan `COMPANY_STAFF_ENABLED=true` dan membership Marketing existing. Tidak ada pemberian izin otomatis.
5. Muat ulang Ruang Kerja. Uji tambah → refresh → ubah tahap → tambah catatan dengan data uji yang sah, lalu hapus data uji melalui owner.

Pada VPS resmi, workflow manual **Activate Marketing CRM on VPS** menjalankan langkah 2–4 berurutan setelah kode rilis sehat: memeriksa SHA, membuat dump PostgreSQL baru, memulihkannya ke database sementara, menerapkan migrasi Company dan CRM, menyalakan `COMPANY_WORKSPACE_ENABLED` serta `MARKETING_CRM_ENABLED`, dan memeriksa health API. Workflow memakai grup concurrency yang sama dengan deployment sehingga tidak beradu restart. `COMPANY_STAFF_ENABLED` tidak diubah. Dump dan salinan `.env` sebelum aktivasi disimpan di `/var/backups/eznihongo` untuk pemulihan; data sementara dihapus. Jika health gagal setelah restart, flag lama dipulihkan. Jika migrasi gagal, flag tidak disentuh dan ledger perlu diperiksa sebelum mencoba lagi.

Rollback UI: matikan `MARKETING_CRM_ENABLED`; data tetap tersimpan. Pertahankan kode penghapusan akun yang mengenali tabel CRM. Jangan menurunkan versi cleanup ketika tabel baru masih ada.

## Penyimpanan dan batas

`marketing_leads` menyimpan kondisi terkini; `marketing_lead_events` menyimpan catatan dan jenis perubahan, tahap, versi, serta waktu. `marketing_growth_reviews` menyimpan keputusan mingguan dan eksperimen; `marketing_channel_spend` menyimpan biaya per sumber. Transaksi memakai pemeriksaan izin server, query parameter, row lock dan versi. Tabel CRM memakai database utama sehingga harus termasuk prosedur backup/restore PostgreSQL yang sudah ada.

Nomor berawalan 0 dinormalisasi ke +62; nomor luar Indonesia harus memakai kode negara. Duplikasi email atau nomor ditolak dalam kursus yang sama, termasuk kelompok belum memilih kursus. Orang yang tertarik pada dua kursus dapat memiliki dua record. Pencarian kontak mencocokkan format nomor yang disimpan. UI menampilkan waktu sesuai zona browser; database menyimpan TIMESTAMPTZ.

Penghapusan akun membersihkan prospek dengan email yang sama persis (tanpa membedakan huruf besar/kecil), referensi PIC/aktor, dan catatan yang ditulis aktor tersebut. Prospek yang hanya punya nomor telepon atau memakai email berbeda dihapus secara eksplisit oleh owner melalui CRM. Nama/referral bebas tidak dipakai untuk menebak identitas orang. Penghapusan prospek tidak menghapus akun, transaksi, atau kepesertaan.

Berhasil merupakan laporan hasil sales, bukan bukti pembayaran. Angka bayar dan pendapatan hanya berasal dari satu pesanan pada kursus yang sama, milik akun dengan email yang sama persis, dibuat sesudah lead, dengan status pesanan dan bukti pembayaran yang disetujui. Lead tanpa email yang cocok, transaksi sebelum lead, atau pembayaran di luar sistem tidak teratribusi. Karena itu metrik bisa lebih rendah daripada seluruh penjualan nyata. Biaya dicatat manual dan CAC hanya muncul jika ada biaya dan pembelian terverifikasi pada minggu itu. Hindari memasukkan biaya yang sama dalam review semua kursus dan review kursus tertentu. Enrollment, verifikasi pembayaran, onboarding, pesan WhatsApp/email, dan publikasi konten tidak dijalankan otomatis oleh modul ini.

## Verifikasi

Gunakan PostgreSQL lokal disposable dengan nama database mengandung `test`; set `TEST_DATABASE_URL`. Tes membuat dan membersihkan schema terisolasi. Set `PLAYWRIGHT_MODULE` ke `index.mjs` Playwright dan opsional `PLAYWRIGHT_CHANNEL=msedge`; browser memakai API dan database uji sungguhan.

```text
node --test backend/src/marketing-crm.test.js backend/src/company.test.js backend/src/company-desk.test.js backend/src/company-productivity.test.js backend/src/admin-boot.test.js backend/src/staff-access.test.js backend/src/student-operations.test.js
```

`CRM_SCREENSHOT_DIR` opsional untuk tangkapan desktop/mobile dengan data sintetis. Tanpa `TEST_DATABASE_URL`, suite integrasi ditandai skipped; tanpa `PLAYWRIGHT_MODULE`, pemeriksaan browser ditandai skipped.
