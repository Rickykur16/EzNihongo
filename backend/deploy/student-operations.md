# Pusat Operasional Siswa

Menambahkan menu **Operasional Siswa → Pusat Operasional Siswa** pada `admin.html`. Menggunakan akun, autentikasi, cakupan staf, kursus, kepesertaan, progres, dan Live Class yang sudah ada.

## Yang tersedia

- **Siswa & progres:** pencarian nama/email, status onboarding, PIC per siswa per kursus, tujuan belajar, tanggal follow-up, masa akses, dan progres per pelajaran.
- **Antrean:** onboarding belum selesai; tindak lanjut jatuh tempo; tidak aktif setidaknya tujuh hari; masa akses berakhir dalam tujuh hari.
- **Layanan & keluhan:** siswa dan kursus terkait, kategori, prioritas, PIC, tenggat, status penanganan, divisi eskalasi, hasil penyelesaian, serta catatan dan riwayat perubahan.
- **Jadwal & absensi:** jadwal Live Class existing dan pencatatan kehadiran per siswa per sesi. Belum dicatat berbeda dari tidak hadir.
- **Kontrol:** otorisasi di server untuk setiap permintaan; versi catatan mencegah perubahan bersamaan menimpa data; draf formulir dipertahankan ketika penyimpanan gagal.

## Batas tanggung jawab

Operasional Siswa menerima dan menindaklanjuti kebutuhan siswa sampai mendapat jawaban. Akademik/Sensei mengurus pengajaran, asesmen, dan jadwal Live Class. Finance tetap mengurus tagihan, verifikasi pembayaran, tunggakan, dan refund.

Kategori pembayaran dan pilihan eskalasi Finance adalah catatan koordinasi. Keduanya tidak mengubah pesanan, memberikan akses berbayar, mengirim pesan, atau membuat transaksi. Akses keluhan tetap mengikuti izin Operasional Siswa; memilih divisi eskalasi tidak memberikan izin tambahan kepada divisi tersebut.

## Aktivasi

1. Rilis backend dan frontend yang memuat perubahan ini dengan `STUDENT_OPERATIONS_ENABLED=false` terlebih dahulu. Gunakan prosedur rilis perusahaan yang sudah ada.
2. Pastikan database telah memiliki schema inti terbaru (termasuk kepesertaan, bukti aktivitas belajar, dan Live Class), serta migrasi Company Workspace. Siapkan backup sesuai prosedur rilis existing.
3. Arahkan `OPERATIONS_DATABASE_URL` secara eksplisit ke target. Jalankan dari folder `backend`:

   ```text
   node operations-migrations/run.js --apply
   ```

   Migrasi membuat empat tabel operasional, indeks, dan pencatat checksum migrasi. Tidak mengisi siswa contoh, mengubah tabel transaksi, atau memberikan izin staf. Dapat dijalankan ulang; perubahan checksum ditolak.
4. Aktifkan `COMPANY_WORKSPACE_ENABLED=true` dan `STUDENT_OPERATIONS_ENABLED=true`. Untuk staf terbatas, gunakan `COMPANY_STAFF_ENABLED=true` dan keanggotaan `operations` dengan cakupan kursus/global melalui pengaturan staf yang sudah ada. Tidak ada keanggotaan yang dibuat otomatis.
5. Restart backend dengan konfigurasi baru; buka ulang admin panel agar discovery akses terbaru dimuat.
6. Periksa menu, pilih kursus, pastikan ringkasan sesuai data, lalu uji satu onboarding, satu layanan, dan absensi sesi yang sudah berlangsung menggunakan akun uji yang sah.

Rollback antarmuka: set `STUDENT_OPERATIONS_ENABLED=false`, restart backend, dan muat ulang panel. Data operasional tetap tersimpan. Jangan kembali ke versi backend yang belum mengenali tabel operasional saat menjalankan penghapusan akun; kode pembersihan yang kompatibel harus tetap tersedia.

## SOP singkat

1. **Awal hari:** periksa keluhan lewat tenggat dan prioritas mendesak, lalu follow-up jatuh tempo serta onboarding.
2. **Onboarding:** buka siswa; tetapkan PIC; isi tujuan belajar; ubah status menjadi Sudah dihubungi, kemudian Siap belajar setelah panduan dan akses diperiksa bersama siswa. Status ini tidak mengaktifkan akses kursus.
3. **Keluhan:** dari detail siswa pilih Catat layanan / keluhan. Satu kasus untuk satu kebutuhan; periksa antrean agar tidak membuat duplikat. Isi kategori, PIC, prioritas, dan tenggat tindak lanjut.
4. **Eskalasi:** pilih Akademik, Finance, atau Teknologi bila bantuan diperlukan. Koordinasikan lewat saluran internal yang sudah dipakai; ubah status menjadi Menunggu divisi dan catat hasil koordinasi. Tidak ada pesan otomatis.
5. **Penutupan:** masukkan hasil penyelesaian dan pastikan jawaban sudah disampaikan kepada siswa sebelum memilih Selesai. Kasus dapat dibuka kembali dengan status Ditangani; riwayat tetap tersedia.
6. **Progres:** tinjau siswa tidak aktif, periksa aktivitas dan progresnya, kemudian buat layanan kategori Siswa tidak aktif bila diperlukan. Catat hasil follow-up dan tanggal tindak lanjut berikutnya.
7. **Absensi:** pilih sesi yang sudah dimulai; catat Hadir, Terlambat, Izin, atau Tidak hadir satu per siswa. Sistem menolak sesi masa depan, sesi dibatalkan, dan masa kepesertaan yang tidak mencakup waktu sesi.
8. **Perpanjangan:** gunakan antrean Masa akses ≤7 hari untuk membahas kelanjutan belajar. Tagihan dan pembayaran ditangani Finance melalui alur existing.

## Definisi dan keterbatasan data

- Siswa tampil dari `user_enrollments`, termasuk akses berakhir/dicabut pada antrean Semua siswa. Akun yang belum memiliki kepesertaan belum muncul di pusat ini.
- Masa akses dibaca dari record kepesertaan existing. Modul ini tidak merekonstruksi periode lama yang pernah ditimpa oleh proses perpanjangan existing. Verifikasi manual diperlukan untuk koreksi absensi historis pada kasus tersebut.
- Aktivitas terakhir merupakan maksimum waktu progres, kuis selesai, latihan, atau tugas grammar pada kursus yang dipilih. Ini indikator aktivitas tercatat, bukan durasi belajar atau bukti kehadiran. Praktik tanpa pemetaan kursus/lesson tidak diklaim sebagai aktivitas kursus tersebut.
- Progres adalah jumlah pelajaran selesai dari `user_progress` dibanding materi kursus saat ini. Tidak mengubah asesmen atau progres siswa.
- Batas tidak aktif dan akan berakhir memakai tujuh hari; dihitung saat data diminta, tanpa cron atau status salinan.
- Ringkasan dihitung untuk seluruh kursus terpilih; pencarian dan antrean hanya memfilter daftar di bawahnya. Daftar siswa, kasus, sesi, dan absensi dipaginasi 50 baris.
- Riwayat kasus menampilkan 100 catatan terbaru. Tidak tersedia notifikasi WhatsApp/email otomatis maupun formulir keluhan mandiri untuk siswa pada rilis ini.
- Waktu input/tampilan mengikuti zona waktu browser; database menyimpan timestamp dengan zona waktu.

## Model tambahan dan penghapusan akun

`student_operation_profiles` menggunakan kunci siswa + kursus. `student_operation_cases` menunjuk siswa + kursus; `student_operation_events` menunjuk kasus. `student_operation_attendance` menggunakan sesi Live Class + siswa.

Keempat tabel terdaftar pada pemeriksaan kontrak penghapusan akun. Menghapus data siswa membersihkan profil, kasus, catatan kasus, dan absensinya dalam transaksi penghapusan yang sama. Referensi PIC/aktor yang dihapus dibersihkan tanpa menghapus kepesertaan milik siswa lain. Kontrak Company Workspace lama tidak diubah.

## Validasi

Jalankan dengan Node sesuai persyaratan backend. Untuk pengujian PostgreSQL, siapkan database lokal disposable yang namanya memuat `test` dan set `TEST_DATABASE_URL`.

```text
node --test backend/src/student-operations.test.js backend/src/company.test.js backend/src/company-desk.test.js
node --test backend/src/admin-boot.test.js backend/src/company-productivity.test.js backend/src/staff-access.test.js
```

Untuk browser, set `PLAYWRIGHT_MODULE` ke `index.mjs` instalasi Playwright. `PLAYWRIGHT_CHANNEL` opsional, misalnya `msedge`. `OPERATIONS_SCREENSHOT_DIR` opsional untuk menyimpan pratinjau dengan data contoh sintetis.

```text
node --test backend/src/student-operations-browser.test.js
```

Pengujian mencakup cakupan izin, antrean berdasarkan data, konflik versi, eskalasi dan resolusi, histori, absensi, kompatibilitas penghapusan, batas Finance, draf gagal simpan, retry, serta tampilan desktop dan mobile. Pengujian tidak menjalankan migrasi pada produksi.
