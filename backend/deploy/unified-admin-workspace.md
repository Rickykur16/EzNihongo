# Satu Ruang Kerja sebagai pengganti navigasi admin

## Penyebab dan perubahan

Paket sebelumnya membuat `company.html` sebagai panel terpisah di belakang `COMPANY_WORKSPACE_ENABLED`. Pada 12 September 2026, pemeriksaan HTTP tanpa login ke `https://eznihongo.com/api/company/access` mengembalikan 404 `company_workspace_disabled`, sesuai screenshot pemilik. Deploy PR #303 berhasil, tetapi merge tidak mengaktifkan flag atau menerapkan schema Company. Halaman sebelumnya menampilkan kesalahan fitur sebagai "belum tersedia untuk akun ini", yang menyerupai masalah login. Pengguna password-only juga diarahkan ke halaman Google, alih-alih formulir admin existing.

Perbaikan ini **menyatukan antarmuka**, bukan melakukan migrasi database:

- `admin.html` menjadi satu pintu masuk bernama Ruang Kerja. `company.html` menjadi alias yang mengarah ke `admin.html`, dengan tautan fallback tanpa JavaScript.
- Login email/password dan Google tetap memakai auth client serta endpoint existing. Tidak ada password/akun baru, perubahan token, atau auto-logout/clear progres.
- Navigasi datar 12 tab diganti lima kelompok divisi; formulir materi/kuis dan handler penyimpanan bisnis dipertahankan. Daftar kursus/modul mendapat pintasan baca menuju materi. Course ID, module ID, lesson ID, slug, konten, soal dan relasi tidak dipindah, disalin, diurutkan ulang atau dibuat ulang oleh pergantian panel.
- Sidebar ringkas: Ringkasan dan pintasan lintas divisi tetap terlihat; lima divisi memakai accordion dengan label pendek. Semua submenu tertutup pada Ringkasan dan hanya satu kelompok dapat dibuka sekaligus. Memilih pintasan atau tautan langsung membuka kelompok halaman aktif otomatis. Pengaturan staf terlipat dan tetap mengikuti izin. Keyboard dan drawer ponsel tetap didukung tanpa menyimpan preferensi ke data siswa.
- Ruang Kerja dapat dibuka admin existing meskipun Company nonaktif. Ringkasan hanya berisi divisi dan pintasan; tidak ada banner status fitur, disclaimer migrasi, atau penjelasan teknis. Menu operasional yang berizin tetap dapat dipakai. Gagal mengambil `/company/access` tidak mengunci editor lama, tetapi **tidak** memberikan akses ke modul Company. Pesan error tindakan, kegagalan verifikasi akses, dan konfirmasi penting tetap dipertahankan.
- Saat tersedia dan berizin, tugas, kalender, Insights dan pengelolaan staf dimuat di panel yang sama, bukan iframe, tab browser baru atau panel admin kedua. Staf course-scoped dengan hak work saja dapat membuka shell tanpa memperoleh hak editor global.
- Fragment/JavaScript Company dimuat saat dibutuhkan; CSS dibatasi ke container Company agar tidak mengubah editor materi/pembayaran. Asset yang sebelumnya pernah dipakai memiliki penanda versi untuk menghindari cache kode standalone lama.

## Pemetaan menu existing

| Divisi | Menu operasional |
|---|---|
| Product & Technology | TTS Cache, AI |
| Academic & Learning | Kursus, Modul, Pelajaran & Kuis, Live Class |
| Growth & Marketing | Sensei, Testimoni |
| Student Success & Operations | Pengguna, Diskusi, Beri Akses |
| Finance & Business Administration | Pesanan |

Nama divisi tidak memberi permission tambahan. Hak menu ditentukan `/staff/capabilities`; server tetap otoritatif untuk semua tindakan. Kelola Admin, password, grant enrollment, dan tindakan owner-only tetap dibatasi seperti sebelumnya. API bisnis/RBAC backend tidak diubah pada patch ini. Mengganti label shell tidak mengubah admin menjadi staf atau sebaliknya.

## Alur menu

Seluruh 22 menu operasional/Company memiliki breadcrumb kembali ke Ringkasan dan 2–3 langkah singkat. Ini penunjuk alur, bukan status selesai buatan atau eksekusi otomatis. Hanya langkah Akademik yang menjadi tombol pindah menu, dan tautannya tetap disaring berdasarkan izin.

- **Kurikulum:** Kursus → Kelola Modul → Materi & Kuis membawa konteks kursus/modul; retry mempertahankan tujuan, respons lama tidak dapat mengganti pilihan baru. Mengganti kursus menghapus pilihan modul lama hanya di memori tampilan.
- **Siswa:** pencarian utama langsung terlihat; filter profil tambahan terlipat, tetapi otomatis terbuka bila filter aktif. Pengelolaan akses tetap lewat formulir existing.
- **Finance:** antrean Menunggu Verifikasi tampil dahulu. Pengaturan rekening berada di bagian terlipat setelah daftar; formulir dan endpoint simpan rekening/pembayaran tidak berubah.
- **TTS:** statistik dan review cache lama menjadi alur utama. Penghapusan seluruh cache ditempatkan dalam Pemeliharaan lanjutan; konfirmasi existing tetap berlaku.
- **Pekerjaan tim:** kolom SHA hanya tampil untuk rilis, URL publikasi untuk konten/kampanye. Nilai existing yang sudah terisi tetap ditampilkan dan tidak dibuang saat jenis berubah. Tidak ada perubahan payload/handler simpan.

Tidak menambah autosave, auto-approve, auto-publish atau penghapusan otomatis. Ringkasan tetap tanpa disclaimer.

## Bukti pengujian dan batas

- Unit boot: mode Company off/503, admin existing, role terbatas, work-only course-scoped, fallback backend lama hanya untuk admin terverifikasi, deny untuk siswa, lazy loading, respons lama, retry dan pemetaan tepat satu kali untuk seluruh 12 menu.
- Browser shell memakai API fixture sintetis, mencakup login password benar/salah, redirect alias, pengelompokan divisi, editor kursus/modul/materi/kuis, ID/konten fixture, Finance, mobile, retry, serta tidak adanya request tulis bisnis saat navigasi/buka editor. Fixture ini bukan pembuktian state akun atau isi database produksi.
- Browser Company/Insights/Desk memakai backend Express dan database lokal sintetis, termasuk perpindahan work → editor operasional → work, matriks izin, kalender, transisi/revisi, serta snapshot sumber read-only.
- Jalankan suite backend penuh, tes kontrak learning-state siswa dan syntax. Tidak memakai data atau akun produksi dalam pengujian.

## Rilis yang aman

1. Review diff: tidak ada perubahan pada migration, kontrak schema, backend route bisnis/auth, frontend siswa atau package lock. Formulir materi/kuis dan handler tulis existing tetap dipertahankan; perubahan daftar, pintasan dan pengelompokan kontrol hanya di lapisan UI.
2. CI harus lulus pada head PR baru. Lakukan smoke staging untuk login, navigasi lima divisi, buka materi/kuis, pesanan dan dashboard siswa. Jangan mengubah materi nyata untuk smoke.
3. Merge/deploy antarmuka hanya setelah persetujuan. Patch ini tidak mengubah workflow existing; push main masih menjalankan pipeline deploy yang sudah ada. Tidak ada pemanggilan tambahan runner Company, backfill atau seed role.
4. Biarkan flag Company/Insights/staf/worker tetap pada konfigurasi saat ini. **Jangan** mengubah default menjadi true untuk menghilangkan pesan 404. Aktivasi pekerjaan/staf nanti memerlukan pemeriksaan schema, backup dan uji restore serta gate `company-workspace.md`; harus menjadi tindakan terpisah yang disetujui.
5. Jika rollback antarmuka diperlukan, kembalikan hanya file antarmuka terkait melalui commit baru yang ditinjau. Jangan drop tabel, mengganti ID, reset progres, atau restore database untuk membatalkan perubahan navigasi.

Tidak ada jaminan nol risiko hanya dari tes lokal/CI. Patch ini menghindari migrasi materi sama sekali; tetap lakukan smoke setelah rilis dan jangan menganggap modul tugas aktif hanya karena shell baru sudah tampil.
