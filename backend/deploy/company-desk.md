# Pusat Kerja Harian dan Kalender Marketing

Tambahan pada Company Workspace yang sudah ada, bukan aplikasi, database, atau layanan baru. Membantu satu orang memegang beberapa peran tanpa harus memeriksa lima board satu per satu. Tetap di belakang `COMPANY_WORKSPACE_ENABLED` dan akses staf existing; tidak mengaktifkan flag, membuat membership, mengirim pesan, atau menjalankan migration.

## Fitur dan definisi

- **Pusat Kerja Harian:** antrean gabungan hanya untuk pasangan divisi/kursus yang diizinkan. `work.academic` untuk kursus A dan `work.marketing` untuk kursus B tidak membuka Academic B atau Marketing A.
- **Pekerjaan saya:** pekerjaan terbuka yang `assigned_to`-nya sama dengan akun login. Bukan semua pekerjaan yang dibuat akun tersebut.
- **Belum ditugaskan:** pekerjaan terbuka dengan assignment kosong; bukan penilaian kinerja pegawai.
- **Review / pengujian:** status `review` atau `testing`, mengikuti alur jenis pekerjaan existing.
- **Lewat target:** jadwal tercatat sebelum waktu server dan status belum selesai. Tanpa jadwal tidak dianggap terlambat. Tujuh hari ke depan berarti 168 jam dari waktu server, bukan tujuh hari kalender lokal.
- Status selesai untuk antrean: `done`, `resolved`, `completed`, `published`, `measured`, `verified`, `archived`. Status rilis `merged` / `deployed` masih terbuka sampai terverifikasi. Filter "Semua termasuk selesai" menyediakan riwayat.
- Empat angka ringkasan selalu mencakup **seluruh pekerjaan berizin**, bukan hasil filter/baris yang sedang terlihat. Satu pekerjaan dapat masuk beberapa angka; jangan menjumlahkannya. Angka/baris dibaca sebagai statement terpisah dan dapat berubah selama orang lain bekerja.
- Filter divisi, kursus, jenis, status, prioritas, assignment dan pencarian judul/catatan dijalankan di server. Pencarian adalah substring literal, case-insensitive; `%` dan `_` bukan wildcard. Maksimal 120 karakter. Form dikirim saat tombol diterapkan, bukan setiap ketikan.
- **Kalender Marketing** berupa agenda bulanan berurutan, memakai `scheduled_at` existing; termasuk draf jika memiliki jadwal. Batas bulan mengikuti zona perangkat yang ditampilkan, lalu dikirim sebagai UTC `[from,to)`. Ini **bukan** bukti publikasi, pelacakan performa konten atau auto-publish. Tanggal yang belum diisi tidak dibuat otomatis.
- Klik judul membuka editor dan board existing. Penyimpanan tetap memerlukan versi terbaru, assignment berizin, serta transisi status/evidence existing. Membuka daftar/editor tidak menyimpan apa pun.

## API dan pagination

`GET /api/company/desk` mengembalikan daftar, ringkasan dan cursor. `GET /api/company/calendar` dibatasi Marketing dan rentang UTC maksimal 32 hari. `GET /api/company/work?division=...` mempertahankan route/fields lama, menambah filter server serta `nextCursor`. Keduanya memakai permission `work.<division>`, bukan permission Insights atau legacy.

Default 50, maksimal 100 item per halaman. Pagination UI menggunakan cursor, tidak berhenti di offset 10.000. Board/desk diurutkan menurut prioritas, waktu update turun, UUID naik; kalender menurut jadwal, prioritas, UUID. Cursor mempertahankan presisi mikrodetik PostgreSQL. Offset lama 0–10.000 masih diterima pada `/work`, tetapi tidak bisa digabung dengan cursor non-kosong. Nilai/filter tidak valid ditolak 400, bukan dibetulkan diam-diam.

Cursor mengikat filter, akun dan scope untuk menolak penggunaan tak sengaja pada antrean lain. Cursor tidak ditandatangani dan **bukan** token otorisasi: setiap query tetap menerapkan scope dari akses yang diperiksa langsung. Mengubah atau memalsukan posisi cursor tidak memberi hak baru. Daftar ini dinamis, bukan snapshot/export: item yang berubah prioritas/tanggal selama pagination dapat berpindah halaman. Muat ulang dari halaman pertama untuk kondisi terbaru.

## Data dan beban

Membaca `company_work_items`, identitas/hak staf dan status sumber `orders` existing. Tidak menambahkan tabel, kolom, index, dependency atau salinan data belajar. Ringkasan hanya menghitung pekerjaan internal, bukan aktivitas siswa. Tidak mengubah dashboard siswa, auth siswa, progres, transaksi, enrollment, event audit atau outbox. Tidak ada auto-assignment, penjadwalan baru, scheduler laporan, integrasi sosial atau adapter GitHub.

Pembacaan memakai transaksi `READ ONLY` pada pool API existing (bukan pool baru), statement timeout 3 detik dan lock timeout 500 ms. Izin diperiksa ulang sebelum mengembalikan hasil. Respons privat `no-store`; kegagalan query mengembalikan 503 generik, bukan daftar kosong. Desk dan kalender berbagi limit 60 permintaan per menit per akun per proses. Rate limit ini tidak terdistribusi dan berjalan setelah autentikasi; bukan pengganti kontrol kapasitas/infrastruktur.

Ringkasan, pencarian substring dan sorting masih dapat memindai banyak baris berizin. Tes pagination lebih dari 10.000 item **bukan** pembuktian kapasitas produksi. Sebelum aktivasi: uji latensi, pool contention, query plan dan concurrency pada staging berskala realistis. Bila perlu index tambahan, usulkan migration additive terpisah; jangan mengubah checksum kontrak v1 atau memberi janji skala tak terbatas.

## Verifikasi dan rollout

`company-desk.test.js` hanya menerima PostgreSQL lokal dengan nama database test. Membuat schema unik, menggunakan route Express nyata, dan membersihkan fixture setelah pengujian. Cakupan: matriks divisi, kombinasi scope, definisi bucket, filter lintas halaman, cursor mikrodetik/tie dan >10.000 item, batas bulan, principal/expiry, pemeriksaan izin setelah pembacaan, lock failure, serta kesamaan seluruh baris sumber sebelum/sesudah pembacaan.

Browser opsional mengikuti variabel QA pada `company-workspace.md`, memakai login fixture dan memblokir provider eksternal. Menguji pencarian, ringkasan, kalender zona Asia/Jayapura, editor existing, respons terlambat, desktop/mobile, non-mutation dan sentinel progres localStorage. Screenshot hanya berisi fixture sintetis.

Kode tetap memerlukan review draft PR, CI, staging, restore drill dan smoke siswa/pembayaran sebelum produksi. Tidak merge atau deploy otomatis dari paket ini. Jika foundation belum aktif, ikuti gate `company-workspace.md`; paket Desk sendiri tidak memerlukan DDL tambahan. Pembatalan kode tambahan tidak memerlukan restore data: tidak ada transformasi/backfill dari fitur ini. Jangan rollback foundation cleanup setelah schema Company diterapkan.
