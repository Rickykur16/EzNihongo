# Ruang kerja perusahaan — paket MVP opt-in

Status: implementasi lokal untuk review. Tidak sama dengan seluruh roadmap selesai atau izin deploy produksi. Gunakan dokumen ini untuk versi terbaru; dokumen staff-foundation dan staff-data-contract mencatat tahap persiapan sebelumnya.

## Yang tersedia

`company.html` menyediakan lima board berizin menggunakan login, Express, PostgreSQL dan desain existing. Tidak ada framework/dependency/provider baru. Satu akun dapat memiliki beberapa membership. Pengelola memakai daftar admin environment/database existing; membership tidak mengubah allowlist tersebut.

| Divisi | Board | Akses legacy global yang dibuka |
|---|---|---|
| Product & Technology | Backlog, prioritas, bukti/link issue/PR dan rilis | Pembacaan sebagian metadata TTS; bukan secret atau pengelolaan admin |
| Academic & Learning | Tugas dan review materi | Editor kurikulum/live non-destruktif yang terdaftar; course picker |
| Growth & Marketing | Kampanye, draft/review konten, jadwal, URL publikasi, UTM | Sensei/testimoni non-delete |
| Student Success & Operations | Tugas serta kasus diskusi 14 hari terakhir | Daftar pengguna, daftar/restore diskusi; tidak grant/revoke enrollment |
| Finance & Business Administration | Kasus bukti pembayaran dan penanggung jawab | Orders, approve/reject dengan payment ID, pembacaan bukti, baca rekening; tidak mengubah rekening |

`company-route-policy.js` mencatat 134 route admin secara eksplisit. Route baru atau yang tidak cocok default owner-only. Seluruh DELETE legacy, hapus profil/akun, pengelolaan admin/password, grant/revoke enrollment, dan perubahan rekening tetap owner-only. Bulk replace dibatasi owner. Pergantian tipe pelajaran diperiksa di transaksi edit dengan row lock sebelum cleanup konten/attempts. Handler bisnis existing tidak dipindah atau ditulis ulang.

Grant course hanya mengizinkan board pada course tersebut; **tidak** memberi akses ke handler legacy agregat. Owner memilih cakupan global secara eksplisit bila pegawai memang perlu editor legacy. Empty scope tidak menghasilkan hak apa pun. Tidak ada permission wildcard. Membership expired/revoked diperiksa pada permintaan baru tanpa cache baru; permintaan yang sudah berjalan bukan otomatis dibatalkan.

Realm utama divalidasi terhadap akun saat ini pada batas staf; Kanji, refresh JWT, atau identitas email/ID yang tidak cocok ditolak. Shared auth siswa tidak diubah menjadi auth staf. Endpoint lama di luar allowlist tetap memakai guard existing; bukan klaim seluruh kelemahan auth legacy sudah diaudit/diperbaiki.

Tambahan opt-in: menu **Data & Insights** untuk aktivasi belajar, completion pelajaran aktif, retensi antarminggu dan review materi. Permission Insights yang sesuai juga mengikuti scope course, tanpa membuka handler legacy agregat. Lihat [definisi, akses, privasi dan batas beban](company-insights.md). Sumber tetap read-only; tanpa migration/data mart baru, atribusi revenue atau scheduler laporan.

## Cara kerja board

- Create/edit/assignment memakai transaksi dan optimistic version. Penyimpanan dari revisi lama mendapat 409, bukan menimpa perubahan orang lain.
- Alur status berbeda untuk task, case, campaign, content dan release. Perubahan copy campaign/content setelah review mengembalikan draft. UI menampilkan langkah status yang tersedia.
- Jadwal konten hanya membuat pengingat internal. Konten tidak dipublikasikan otomatis. Status published membutuhkan URL hasil; release merged/deployed/verified membutuhkan SHA penuh serta URL bukti. URL/label tersebut **dicatat manusia**, bukan bukti GitHub/host telah diverifikasi otomatis.
- Link UTM memakai parameter tervalidasi. Belum ada instrumentasi checkout, attributed revenue, ad spend, prospect CRM, atau auto-publish sosial. Unknown tidak dilaporkan sebagai nol penjualan.
- Case sync hanya menambahkan referensi pekerjaan dari sumber actionable, tidak mengubah order/payment/enrollment. Unique source mencegah kasus ganda. Status kerja case berbeda dari status pembayaran yang selalu dihitung dari sumber existing. Resolusi/reopening kasus pada MVP masih keputusan operator; sync bukan reconciler lifecycle penuh.
- Pagination per 50 item sekarang memakai cursor tanpa batas offset 10.000 di UI; filter status berlaku di database, bukan hanya halaman aktif. Tambahan **Pusat Kerja Harian** menyediakan antrean lintas divisi berizin, filter/pencarian server dan ringkasan. **Kalender Marketing** menampilkan agenda bulanan dari jadwal existing. Lihat [definisi, pagination, akses dan batas kapasitas](company-desk.md). Offset lama yang terbatas tetap didukung untuk kompatibilitas API.
- Link ke panel existing tersedia. Board kasus belum menyediakan detail/reply/approval inline; pekerjaan bisnis diselesaikan di panel existing sesuai haknya. Beberapa kontrol legacy owner-only masih dapat terlihat tetapi API menolak staf yang tidak berhak. Upload umum dan beberapa tooling lanjutan belum didelegasikan.

## Penyimpanan dan penghapusan

Enam tabel staf memakai kontrak v1. Tiga tabel perusahaan: `company_work_items`, `company_work_events`, `company_outbox`. Ledger `company_schema_migrations` mencatat checksum normalisasi LF. Tidak ada ALTER tabel legacy, backfill pengguna, seed membership massal, perubahan ID/progres/pembayaran, atau perubahan file dashboard siswa.

Inspector cleanup memvalidasi bentuk kolom/FK dan dependent yang dikenal pada tabel personal. Tabel/kolom/FK tak dikenal menolak erasure, bukan dilewatkan. Semua cleanup memakai transaksi existing. Membership target dihapus; hak orang lain dipertahankan. Work milik pembuat target atau kasus yang bersumber dari pengguna target diarsip dan narasinya dibersihkan. Assignment target di work lain dikosongkan; work orang lain tidak otomatis dihapus. Actor audit dikosongkan dan pengingat terkait dibatalkan.

Tidak ada salinan narasi di event log. Namun kolom teks masih memerlukan kebijakan dan review: pengguna dapat mengetik data personal orang lain tanpa relasi eksplisit, yang tidak dapat ditemukan sempurna oleh cleanup berbasis FK. UI melarang penulisan PII/secret, bukan menjamin deteksi otomatis. Identitas langsung yang dihapus bukan anonimisasi permanen atau log tahan-manipulasi. Retensi/purge, korelasi eksternal, hak akses backup, dan restore tetap membutuhkan keputusan pemilik sebelum pemakaian nyata.

## Aktivasi bertahap — bukan bagian otomatis deployment

Default semua flag pada `company.env.example` adalah false, termasuk tambahan `COMPANY_INSIGHTS_ENABLED`. Tidak ada startup hook yang membuat tabel, memberi role, menjalankan worker, atau mengirim pesan. Insights memerlukan canary dan gate tersendiri sesuai panduannya.

1. Cocokkan baseline, runtime/grants, backup dan uji restore. Jalankan suite pada Node 20/PostgreSQL 16 CI serta staging berschema lengkap. Gunakan data sintetis, integrasi outbound dimatikan, bukan akun nyata untuk tes erase.
2. Release kode kompatibilitas terbaru dengan semua flag false. Kode cleanup harus sudah terpasang dan semua proses lama berhenti sebelum tabel perusahaan ditambahkan. Versi cleanup tahap 1A lama hanya memahami tabel staf, **belum cukup untuk tabel company**.
3. Jalankan migration opt-in pada staging terlebih dahulu: `node company-migrations/run.js --apply --ack-compatible-cleanup`. Command memerlukan `COMPANY_DATABASE_URL` yang sengaja diarahkan ke target review; tidak memuat `.env` atau fallback `DATABASE_URL`. Ini melakukan DDL, sehingga jangan menjalankan command pada produksi hanya karena patch berhasil dipasang.
4. Runner menerapkan dua kontrak dalam satu transaksi, mengambil advisory lock, membatasi lock wait/statement, memeriksa checksum/cleanup, lalu commit. Bila tabel senama sudah ada tanpa ledger, berhenti dan rekonsiliasi; jangan drop/reset tabel. `npm run migrate` dan workflow deploy existing tidak memanggil runner ini.
5. Setelah gate, aktifkan `COMPANY_WORKSPACE_ENABLED=true` untuk canary admin. Buat membership hanya untuk akun existing yang terverifikasi. Review hak global/course, expiry dan batas fitur. `COMPANY_STAFF_ENABLED=true` baru mengaktifkan staf terbatas.
6. Jalankan smoke ulang pada login, belajar, quiz, payment-proof, approval, dan progres. Jangan menghapus localStorage atau memaksa login ulang untuk menyembunyikan regresi.
7. Worker opsional dipasang paling akhir setelah kapasitas DB/VPS, tujuan Telegram dan retensi disetujui. Memerlukan `COMPANY_WORKER_ENABLED=true` serta credential Telegram existing. Template systemd disediakan, **tidak diinstal atau di-enable oleh patch**.

Merge ke main masih memicu deployment existing. Draft PR bukan persetujuan merge. Penonaktifan flag tidak membatalkan perubahan bisnis yang sudah dibuat atau menghapus tabel; kompatibilitas cleanup harus dipertahankan setelah schema ditambahkan. Setelah staf aktif, jangan rollback ke versi yang membolehkan staf menjadi admin penuh. Restore seluruh database bukan rollback kode rutin.

## Worker

Satu proses opsional, pool maksimal dua koneksi, tanpa import server/API startup. Klaim memakai lease + `SKIP LOCKED`; network call di luar transaksi, timeout 10 detik, retry terbatas, error hanya kode generik. Pesan Telegram hanya mengingatkan membuka workspace, tanpa isi siswa/payment/konten. Worker tidak mengubah status konten menjadi published.

Saat timeout provider, pesan dapat sudah terkirim; delivery **at-least-once**, bukan exactly-once. Perubahan/cancel sesaat sebelum network send dapat tetap menghasilkan pengingat generik yang sudah kedaluwarsa. UI dan revisi DB tetap otoritatif. Daftar pengingat menampilkan failed; replay manual/adapter publikasi belum tersedia. Tidak ada cutover notifikasi pembayaran existing ke worker pada paket ini.

## Pengujian dan batas produksi

`company.test.js` membuat schema unik pada localhost `TEST_DATABASE_URL`, tidak memakai produksi. Cakupan: migration additive/idempoten, matriks lima divisi, owner-only, principal lintas realm, scope, expiry/revoke, revisi/status, outbox, case dedupe, Finance proof/approval, dan rollback cleanup. Seluruh route admin dicocokkan dengan inventaris policy agar penambahan route membutuhkan keputusan eksplisit.

Browser QA opsional memakai `COMPANY_BROWSER_QA=true`, `COMPANY_PLAYWRIGHT_MODULE` dan `COMPANY_BROWSER_EXECUTABLE`. Browser memakai backend/DB fixture nyata; hanya login yang disimulasikan. Provider eksternal diblokir. Tanpa variabel ini CI menjalankan suite backend tanpa menambahkan tes browser. Tidak ada dependency Playwright baru di aplikasi.

Bukti lokal belum menggantikan CI PostgreSQL 16, restore produksi, uji load, audit keamanan menyeluruh, review manusia dan smoke di VPS. Pemecahan router legacy seluruh divisi, atribusi order, worker pembayaran dan otomasi roadmap lanjutan **belum selesai**; jangan menjual paket ini sebagai penyelesaian seluruh roadmap.
