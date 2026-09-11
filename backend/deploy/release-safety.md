# Release safety: commit yang diuji = commit yang dipasang

Workflow tetap menggunakan GitHub Actions, SSH, VPS, Nginx, npm, PostgreSQL,
dan systemd existing. Tidak ada perubahan schema, migrasi, API, atau UI siswa.

## Kontrak deployment

1. Pull request menjalankan CI saja. Deployment hanya berjalan untuk push ke
   `main` setelah job `ci` berhasil; concurrency existing tetap dipertahankan.
2. `github.sha` dikirim sebagai `DEPLOY_SHA` melalui `env` dan `envs` milik SSH
   action. SHA harus berupa 40 karakter hex lowercase, bukan branch atau tag.
3. Fetch memperbarui `origin/main`. Commit target wajib ada dan masih merupakan
   bagian dari riwayat `main`; ujung branch bukan target pemasangan.
4. HEAD yang terpasang harus sama dengan atau merupakan ancestor dari target.
   Rerun lama dan riwayat yang menyimpang ditolak sebelum checkout, instalasi,
   migrasi, atau restart. Tidak ada rollback otomatis ke commit lama.
5. Sesudah checkout, HEAD diverifikasi lagi sebelum langkah existing dilanjutkan.
   Log mencatat SHA sebelumnya dan target; sukses health check mencatat SHA rilis.

Jika main bergerak dari A ke B ketika run A masih berjalan, run A memasang A.
Run B harus melewati CI-nya sendiri sebelum memasang B. Jangan menganggap merge,
checkout, atau status `systemctl restart` saja berarti aplikasi sudah sehat.

## Pengujian

`npm test` di `backend/` otomatis mencakup `src/deploy-release.test.js`.
CI juga menjalankan tiga tes kontrak siswa melalui `node --test learning-state.test.js`
di root repo; semua tes harus lulus sebelum job deploy dapat dimulai.
Tes memerlukan Git dan Bash (keduanya ada di runner Ubuntu existing).
Di Windows, arahkan `DEPLOY_TEST_BASH` ke executable Git Bash bila tidak ada
`bash` pada PATH. Tidak ada dependency npm tambahan.

Harness membaca dan menjalankan skrip SSH langsung dari workflow. Fetch,
commit graph, checkout, dan verifikasi memakai dua repository Git sementara.
Perintah VPS lainnya disimulasikan: tidak ada SSH, migrasi SQL, restart service,
atau koneksi database. Kasus yang dicakup: branch bergerak maju, retry identik,
SHA kosong/tidak valid/tidak ada, fetch gagal, force-push, rerun lama, server
divergen, checkout salah, kegagalan migrasi, dan health check gagal.

Ini bukan pengganti pengujian PostgreSQL maupun smoke test aplikasi. CI tetap
menjalankan tes transaksi dengan PostgreSQL 16 dan Node 20. Hasil lokal pada
runtime lain dan tes yang skipped harus dilaporkan terpisah.

## Penanganan kegagalan dan batas keselamatan

- `DEPLOY_SHA` invalid/missing: periksa wiring `env`/`envs`; jangan memakai
  `origin/main` sebagai fallback.
- Commit tidak lagi di main: periksa force-push dan buat run untuk commit yang
  memang hendak dirilis; jangan melewati pemeriksaan ancestry.
- Bukan fast-forward: periksa SHA terpasang dan riwayat Git. Bisa merupakan
  rerun lama atau hotfix yang belum masuk main. Rekonsiliasi kode melalui review.
- Migrasi gagal: runner existing dapat sudah meng-commit file migrasi sebelumnya.
  Jangan mengasumsikan seluruh batch rollback. Periksa `schema_migrations` dan
  log sebelum retry; jangan menurunkan kode melewati batas kompatibilitas schema.
- Health check gagal: log service/journal tetap ditampilkan. Tidak ada klaim
  sukses atau rollback schema otomatis. Prioritaskan perbaikan maju yang diuji.

Pengecekan HEAD hanya membuktikan checkout Git, bukan versi proses yang sedang
melayani request. Health endpoint existing belum membuktikan versi proses.
Deployment tetap in-place dan melakukan restart; ini bukan zero-downtime atau
release atomik. Nginx/static files sudah dapat berubah sebelum migrasi selesai.

Sebelum merge/deploy, pastikan CI hijau, backup/restore sudah diverifikasi, dan
VPS tidak menyimpan perubahan tracked yang belum di-commit. `git reset --hard`
existing tetap mengganti file tracked; tes sentinel `.env`/uploads hanya
membuktikan fixture normal, bukan inventaris file pada VPS. Patch ini tidak
mengubah retensi backup, offsite, hak akses database, atau prosedur rollback.

Referensi: [GitHub SHA context](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#github-context)
dan [SSH action v1.0.3 envs](https://github.com/appleboy/ssh-action/tree/v1.0.3#pass-environment-variables-to-shell-script).
