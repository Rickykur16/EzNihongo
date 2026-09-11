# Kontrak data staf dan kompatibilitas hapus akun — tahap 1A

Status: persiapan lokal, bukan migrasi atau aktivasi staf. Melengkapi bagian cleanup yang masih pending pada `staff-foundation.md`. Tidak mengubah mode discovery `legacy-admin-only`.

## Tujuan dan batas

Penambahan FK ke `users` dapat membuat guard hapus akun existing menolak penghapusan. Kode kompatibilitas harus tersedia sebelum tabel baru diperkenalkan. Patch ini menyediakan kontrak yang dapat diuji serta cleanup di transaksi existing, tanpa menjalankan migrasi otomatis atau memberikan role kepada siapa pun.

`backend/contracts/staff-schema-v1.sql` sengaja berada di luar `backend/migrations/`. Hanya fixture disposable yang menjalankannya pada tahap ini. File itu tidak berisi seed, grant, perubahan tabel existing, atau backfill. Jangan menjalankannya pada produksi sebagai langkah instalasi patch ini.

## Kontrak enam tabel

| Tabel | Tanggung jawab | Saat akun dihapus melalui handler existing |
|---|---|---|
| `staff_roles` | Katalog role dan divisi; bukan profil karyawan | Tetap tersedia |
| `staff_permissions` | Katalog izin aksi | Tetap tersedia |
| `staff_role_permissions` | Pemetaan role–izin | Tetap tersedia |
| `staff_memberships` | Akun, role, status, masa berlaku, pemberi/pencabut | Membership akun target dihapus; referensi pemberi/pencabut ke target pada membership orang lain dikosongkan |
| `staff_membership_scopes` | Batas global eksplisit atau course tertentu | Scope milik membership target ikut terhapus; scope orang lain dipertahankan |
| `staff_audit_events` | Jenis kejadian terkontrol, hasil, waktu, aktor/subjek | ID aktor/subjek target dikosongkan dan waktu cleanup dicatat; event tetap disimpan |

Kode divisi: `technology`, `academic`, `marketing`, `operations`, `finance`. Metadata ini tidak menciptakan lima departemen dengan akun atau deployment terpisah. Satu pengguna boleh memiliki beberapa role, tetapi pemberian akses belum diimplementasikan.

Scope kosong harus berarti **tidak ada akses** pada authorizer mendatang. Akses global memerlukan baris `global` eksplisit. Penghapusan course menghapus scope course terkait, bukan mengubahnya menjadi global. Membership aktif saja tidak cukup: policy mendatang juga wajib memeriksa expiry, izin aksi, scope, dan identitas akun saat ini. Constraint database bukan pengganti otorisasi API.

Semantik FK memakai `CASCADE`, `SET NULL`, dan `RESTRICT` sesuai tujuan relasi; inspector memeriksa metadata FK termasuk status validated. Rujukan teknis: [constraint PostgreSQL 16](https://www.postgresql.org/docs/16/ddl-constraints.html) dan [katalog pg_constraint](https://www.postgresql.org/docs/16/catalog-pg-constraint.html).

## Jalur penghapusan dan transaksi

`eraseUserAccount()` tetap dipanggil melalui `withTransaction()` di route admin existing. Konfirmasi penghapusan, larangan menghapus akun sendiri, pengakuan riwayat pembayaran, serta batas admin tidak diubah.

Urutan baru di dalam transaksi yang sama:

1. Kunci baris pengguna dengan `FOR UPDATE`.
2. Temukan tabel staf opsional pada schema milik `users`, lalu periksa kontrak sebelum mutasi.
3. Bersihkan membership/scope milik target dan referensi personal pada audit/provenance staf.
4. Jalankan seluruh cleanup existing, termasuk anonimisasi pengguna, tanpa mengubah daftar tabel legacy atau SQL bisnisnya.
5. Commit hanya jika semuanya berhasil; error tetap diteruskan agar transaksi dibatalkan.

Jika seluruh tabel staf belum ada, handler tidak melakukan query DML terhadap tabel yang tidak ada dan tidak menambahkan field staf pada ringkasan legacy. Pengulangan penghapusan bersifat idempoten. Orders dan baris pembayaran tetap disimpan sesuai perilaku existing; bukti pembayaran milik target dibersihkan sesuai aturan existing, bukan disalin ke audit.

`staff-erasure.js` memeriksa kolom/type/nullability dan seluruh FK pada tiga tabel yang memuat referensi personal. Penamaan tabel saja tidak membuatnya otomatis dipercaya. Tabel baru yang langsung mereferensikan pengguna tetap ditolak oleh guard legacy; dependent baru pada membership/scope/audit juga membutuhkan review cleanup. Perubahan kontrak yang tidak dikenali menghasilkan error `user_erasure_staff_contract_mismatch` sebelum DML. Identifier schema dikutip dan query staf memakai nama berkualifikasi agar tidak menulis ke tabel senama pada search path lain.

Inspector memegang lock tabel untuk membatasi perubahan DDL saat inspeksi/cleanup. Ini bukan pemeriksaan lengkap seluruh constraint, trigger, RLS, grants, atau data tanpa FK. Jangan menjalankan DDL staf bersamaan dengan penghapusan; review schema/migration tetap diperlukan. Field katalog role/permission tidak boleh dipakai untuk menyimpan data personal.

Writer membership, perubahan scope, dan audit mendatang harus mengikuti aturan lock yang konsisten: kunci pengguna terkait dalam urutan deterministik, periksa kembali identitas/tombstone, lalu menulis dalam transaksi. Tes saat ini membuktikan lock target ditahan sampai commit; belum membuktikan writer yang belum dibuat aman dari seluruh race atau deadlock. Referensi ke akun yang sudah dianonimkan tidak boleh dimasukkan kembali.

## Audit: minimisasi dan keputusan yang masih diperlukan

Kontrak sengaja tidak menyediakan payload JSON bebas, snapshot email/nama, alamat IP, catatan teks, atau arbitrary target ID. Event awal hanya `membership.granted`, `membership.revoked`, `scope.changed`, dan `access.denied`. Kebutuhan event tambahan harus disertai review kontrak, izin akses, retensi, dan pengujian cleanup; jangan memasukkan data ke kolom label/event untuk menghindari pembatasan.

Mengosongkan referensi langsung bukan jaminan anonimisasi permanen: waktu, jenis kejadian, serta informasi eksternal masih dapat memungkinkan korelasi. Audit ini juga belum merupakan log tahan-manipulasi. Sebelum writer aktif, pemilik bisnis harus menyetujui tujuan penyimpanan, jangka retensi/purge, siapa yang boleh membaca, serta kebijakan backup dan pemulihannya. Patch ini tidak menetapkan durasi retensi secara sepihak atau menyatakan kepatuhan hukum.

## Pengujian

`src/user-erasure.test.js` memakai `TEST_DATABASE_URL`, bukan `DATABASE_URL`. Host harus loopback dan nama database mengandung `test`. Gunakan cluster/database disposable milik pengujian; validasi nama tidak membuktikan database aman untuk dipakai. Setiap fixture memiliki schema acak tersendiri, tidak memakai fallback `public`, dan dibersihkan sesudah tes.

Cakupan: schema lama; schema baru tanpa backfill; penghapusan hanya milik target; idempotensi; kolom/FK/dependent tak dikenal; audit opsional tidak ada; search-path decoy; scope global/course; lock pengguna; serta rollback seluruh perubahan ketika langkah anonimisasi terakhir dipaksa gagal. Assertions juga menjaga akun lain, riwayat pembayaran, bukti milik orang lain, dan balasan diskusi.

Hasil lokal 12 September 2026 pada Node 20.20.2 + PostgreSQL 18.4: **161 tes backend lulus, 0 gagal, 0 skip**, ditambah **3 tes learning-state**. Sebelum patch cleanup, baseline yang sama lulus 144 tes backend. Syntax check seluruh 79 file `.js`/`.mjs` pada src/migrations/scripts lulus. Tujuh skenario browser admin dengan API fixture juga lulus; bukan smoke produksi.

CI repo memakai PostgreSQL 16: hasil lokal versi 18.4 tidak menggantikannya. Di CI, `TEST_DATABASE_URL` harus diisi dan kelompok database harus benar-benar berjalan. Tidak ada uji restore backup produksi atau pengukuran performa pada ukuran data produksi dalam hasil ini.

## Urutan penerapan dan rollback minimum

1. Review patch persiapan, jalankan CI Node 20/PostgreSQL 16, verifikasi grant runtime yang diperlukan, backup/restore dan baseline admin/siswa. Jangan merge sebelum gate deploy terpenuhi karena merge main memicu workflow produksi.
2. Rilis kode kompatibilitas **tanpa migrasi staf**. Verifikasi hapus akun di lingkungan staging disposable serta fungsi admin/siswa existing. Jangan menghapus akun nyata sebagai smoke test.
3. Baru siapkan tahap 1B: migrasi additive bernomor baru berdasarkan kontrak yang disetujui, dalam transaksi, beserta preflight/lock timeout dan verifikasi read-only. Ubah tes penjaga lokasi kontrak secara sengaja saat promosi tersebut direview. Tidak melakukan seed membership massal atau mengubah allowlist existing.
4. Setelah tabel ditambahkan, kode kompatibilitas ini menjadi **rollback minimum untuk cleanup**, bukan izin kembali ke versi sebelum patch. Jika RBAC wajib sudah aktif kemudian, rollback minimum juga harus mendukung policy tersebut. Pemulihan tidak boleh memakai drop tabel berisi data staf atau restore seluruh DB yang menimpa transaksi terbaru tanpa prosedur terpisah.
5. Tahap 1C mengimplementasikan izin granular pada seluruh route alternatif sebelum role terbatas diaktifkan. Discovery/menu bukan mekanisme keamanan. Sesudah itu baru lanjut workspace divisi dan fitur Development/Marketing.

Tidak ada migrasi, push, PR, merge, atau deploy yang dilakukan sebagai bagian persiapan lokal ini.
