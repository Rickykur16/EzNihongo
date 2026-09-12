# Aktivasi Operasional Siswa — PR #311

Branch operasional ini menjalankan aktivasi yang diminta pemilik setelah merge #311. Tidak memasang kode aplikasi dari branch ini atau mengubah main. Mengikuti jalur GitHub Actions dan SSH VPS yang digunakan aktivasi Finance.

Workflow berbagi concurrency `deploy-vps`, memvalidasi skrip dan pengujian Operations pada PostgreSQL 16, kemudian mengirim skrip terverifikasi checksum ke VPS. Skrip menolak jika rilis terpasang bukan `c6c8c9f7151da4667bef26e0e3819a4302a0e2fa` atau tracked checkout berubah.

Urutan: backup database dengan izin 0600; restore penuh ke database sementara terisolasi; migrasi prasyarat Company dan Operations menggunakan role aplikasi; uji query siswa dan kontrak cleanup; hapus database sementara; terapkan migrasi additive ke produksi; simpan konfigurasi lama; aktifkan Company workspace dan Operations melalui systemd drop-in khusus; restart dan verifikasi kesehatan, autentikasi, runtime flags, query dan frontend. Konfigurasi Finance dan flag staf dipertahankan. Tidak membuat anggota staf, akun contoh, kasus, absensi atau transaksi.

Jika enable/verifikasi gagal, konfigurasi sebelumnya dikembalikan dan API direstart. Tabel additive tetap ada agar data tidak hilang. Backup tetap di `/var/backups/eznihongo/operations-activation-*`, tidak dikirim ke GitHub. Log hanya melaporkan status dan lokasi backup, tanpa data siswa atau kredensial.

Publikasi branch `codex/student-operations-activation-20260912` sengaja memicu workflow aktivasi. Jalankan hanya untuk rilis dan persetujuan tersebut.
