# Fondasi akses staf — tahap 1A, belum RBAC aktif

Tahap ini hanya menambah discovery akses dan menyiapkan bootstrap panel admin.
Tidak ada tabel, migrasi, akun/role baru, pengubahan data bisnis, atau perubahan
dashboard siswa. API admin existing masih memakai `requireAuth` + `requireAdmin`.
Jangan menambahkan pegawai terbatas ke `ADMIN_EMAILS` atau `admin_emails`: kedua
sumber itu masih berarti admin penuh.

## Endpoint read-only

`GET /api/staff/capabilities` memerlukan bearer access token dari aplikasi utama.
Token Kanji/refresh, subject invalid, atau subject/email yang tidak cocok dengan
akun `users` saat ini ditolak. Kegagalan lookup tidak memberi hak fallback.
Validasi ini khusus endpoint baru; bukan perubahan keamanan menyeluruh pada
verifier atau route lama. Cache allowlist admin existing, termasuk TTL/fallback
di `auth.js`, tidak diubah.

Response versi 1 memuat `authorizationMode: "legacy-admin-only"`, `isAdmin`,
`isStaff`, `capabilities`, `tabs`, dan metadata lima `divisions`. Admin environment
dan admin DB memperoleh menu legacy lengkap. Siswa biasa memperoleh false dan
array kosong. Tidak ada role Finance/Marketing yang benar-benar diberikan.
Response memakai `Cache-Control: private, no-store` dan `Vary: Authorization`.

Capability pada tahap ini adalah kontrak discovery/navigasi, bukan middleware
otorisasi granular. Contoh `orders.review` belum memisahkan izin lihat bukti,
approve, reject, atau ubah rekening. Izin tersebut harus dirancang dan ditegakkan
secara rinci sebelum mengaktifkan staf terbatas pada tahap 1C.

## Kompatibilitas panel

- `ezGetMe()` dan `isAdmin` existing tetap menjadi syarat pembukaan panel.
  `api-client.js`, login, cookie, session, dan localStorage siswa tidak diubah.
- Admin legacy tetap melihat 12 menu dengan urutan/label existing, tombol kelola
  admin, password, dan logout. Tidak ada penggantian desain atau framework.
- Tab awal dipilih dari menu yang diizinkan. Membuka tab yang tidak terdaftar
  atau tidak diizinkan tidak menjalankan loader.
- Kursus dimuat saat membuka Kursus/Modul/Pelajaran/Testimoni/Live Class.
  Sumber video dimuat saat membuka Pelajaran, bukan setiap boot. Prasyarat
  dibagi antartab dan permintaan bersamaan dideduplikasi.
- Load kursus gagal menampilkan retry, bukan daftar kosong yang terlihat sukses.
  Load video gagal tetap mengizinkan editor legacy; percobaan berikutnya boleh
  mengulang. Hasil lambat dari tab/boot sebelumnya tidak memilih ulang tab lama.
- Capability tidak disimpan di localStorage. Refresh halaman/boot memeriksa ulang.
  Pencabutan izin tiap aksi tetap tanggung jawab API, bukan menu yang sudah tampil.

### HTML baru dengan backend lama

Deployment in-place dapat menyajikan HTML baru sebelum API restart. Hanya status
404 dari endpoint discovery, dengan `user.isAdmin === true` dari pemeriksaan
akun existing, memakai menu legacy. 401/403/5xx, network error, response invalid,
atau versi/mode yang tidak didukung **tidak** memperoleh fallback: panel tertutup
dan menawarkan retry. Versi UI lama tetap dapat memakai API lama karena tidak
ada kontrak lama yang dihapus.

Fallback ini bukan mode observasi untuk semua staf. Sebelum aktivasi RBAC,
rancang ulang kontrak versi/mode beserta strategi rollout dan rollback-nya.

## Verifikasi

Jalankan `npm test` di `backend/`; tes baru otomatis ditemukan oleh script
existing. `staff-access.test.js` memakai HTTP/Express/JWT sungguhan dengan DB
stub yang menolak query selain SELECT. `admin-boot.test.js` mengeksekusi potongan
kode panel sebenarnya dan memeriksa lazy loading, penolakan, retry, serta race.
Ini bukan pengganti pengujian PostgreSQL, browser, atau smoke produksi.

## Gate berikutnya

1. Review patch dan jalankan CI Node 20/PostgreSQL 16 tanpa melewati tes DB.
2. Selesaikan preflight VPS dan verifikasi restore sebelum rilis; patch lokal
   bukan bukti bahwa produksi atau backup sehat.
3. Tetapkan nama/kolom tabel staff dan audit secara spesifik, termasuk semua FK
   ke `users`. Siapkan handler erase/anonymize kompatibel **sebelum** migrasi
   tabel baru. `user-erasure.js` belum diubah di tahap ini dan guard unknown-table
   tetap utuh. Jangan membuat tabel dahulu lalu menonaktifkan guard tersebut.
4. Baru tambahkan skema additive 1B dan enforcement seluruh jalur alternatif 1C:
   admin routes, orders/proof, upload, discussion, preview/entitlement, dan lain-lain.
5. Aktifkan role terbatas hanya setelah allowed/denied tests lengkap. Kelompok
   menu lima divisi dan fitur Development/Marketing mengikuti tahap selanjutnya.

Rollback patch ini hanya mungkin diperlakukan sebagai rollback kode selama belum
ada schema staf/audit atau akun terbatas aktif. Sesudah tahap tersebut, minimum
versi rollback harus mempertahankan enforcement dan cleanup data yang baru.
