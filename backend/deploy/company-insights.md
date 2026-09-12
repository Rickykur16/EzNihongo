# Data & Insights — read-only MVP

Owner teknis: Product & Technology. Academic memiliki interpretasi mutu belajar; divisi lain memakai ringkasan untuk keputusan masing-masing. Tidak perlu divisi Data terpisah. Menu di `company.html`; endpoint `GET /api/company/insights?division=academic&courseId=<uuid>`.

## Definisi metrik v1

Pemilihan informasi dan pengembangan berikutnya memakai [rencana pengukuran berbasis sumber primer](insights-measurement-plan.md). UI menampilkan panduan enam kelompok beserta sumber dan kebutuhan data; kebutuhan tersebut bukan metrik yang sudah terukur.

E = Senin terbaru 00:00 UTC. Minggu laporan W = [E−7 hari, E); minggu sebelumnya P = [E−14 hari, E−7 hari). Waktu ditetapkan server, tanpa tanggal/filter identitas bebas atau total lintas kursus. UI menyertakan batas eksklusif akhir minggu dan waktu snapshot.

| Keluaran | Pembilang / hasil | Penyebut / batas |
|---|---|---|
| Aktivasi ≤7 hari | Enrollment di P dengan bukti belajar dalam [enrolled_at, enrolled_at+168 jam) | Semua enrollment course tercatat di P; bukan signup atau pembeli berbayar |
| Kembali belajar minggu berikutnya | Siswa aktif di P yang juga aktif di W | Siswa aktif di P, distinct user; bukan D7 signup atau retensi langganan |
| Pelajaran aktif yang kini selesai | Pasangan siswa–pelajaran aktif di W dengan user_progress.completed=true saat snapshot | Semua pasangan siswa–pelajaran aktif di W; bukan seluruh kurikulum atau dropout |
| Materi untuk ditinjau | Persentase salah rata-rata per siswa, maksimal 20 pelajaran | Jawaban pertama per siswa–soal dalam W (bukan first-ever), setiap siswa berbobot sama |
| Latihan terhubung ke pelajaran | Record practice bertag course ini dengan lesson yang valid pada course sama | Semua record practice bertag course ini di W; bukan seluruh aktivitas yang semestinya tercatat |

Aktivitas = quiz_attempts.completed_at, practice_attempts.created_at, grammar_attempts.created_at dengan lesson yang dapat dipetakan ke course. DISTINCT/EXISTS mencegah double-count sumber dan latihan berulang. Practice dengan course_id berbeda dari pemetaan lesson diabaikan; practice/grammar tanpa lesson tidak dianggap aktivitas course. Akun tombstone @dihapus.invalid dikecualikan. Satu akun dihitung satu siswa, bukan deduplikasi manusia lintas akun.

Kesulitan memakai quiz_question_results yang cocok dengan user/lesson pada attempt tersubmit; waktu attempt dan hasil harus di W. Ini bukan analisis semua latihan/grammar atau bukti materi pasti buruk. Belum ada pemisahan versi konten, penyesuaian karakteristik cohort, atau analisis sebab-akibat.

Completion adalah kondisi saat snapshot, bukan histori di E. Revokasi enrollment sekarang tidak menghapus cohort historis. Perubahan enrolled_at/pemetaan lesson dapat mengubah laporan karena histori struktur belum di-versioning. Login, page view, XP, FSRS, waktu sync, dan blob legacy tidak dipakai sebagai bukti waktu belajar. Histori sebelum instrumentation, offline belum sync, konten hilang dan bukti tanpa lesson mengurangi cakupan; jangan menganggap cakupan lengkap/konsisten. Tidak tersedia/suppressed bukan nol.

## Akses dan privasi

- Wajib workspace + Insights flag, main-realm identity yang masih cocok, dan owner atau permission insights.<division> dengan scope sesuai. Flag staf juga wajib bagi staf terbatas.
- Catalog permission disimpan **per-role, bukan per-member**. Grant/menyimpan ulang suatu role mengisi permission terbarunya untuk seluruh membership role tersebut; scope/expiry tiap membership tetap berlaku. Review dampak ke semua pemegang role sebelum aktivasi. Jangan menganggap re-grant hanya mengubah hak satu orang.
- Technology/Academic menerima empat ringkasan + daftar materi. Marketing/Operations/Finance hanya empat ringkasan; array materi tidak dikirim dalam API. Panduan pengembangan berisi informasi statis publik, bukan data siswa/rahasia. Owner memilih sudut pandang dan tidak melewati ambang sampel.
- Minimal 10 siswa. Seluruh rasio dan hitungannya disembunyikan jika kelompok kecil/kosong, atau kelompok hasil nonzero berisi <10 siswa. Daftar materi juga menyaring kelompok hasil kecil; jumlah kelompok tersembunyi tidak dikirim.
- Ini pengurangan risiko, **bukan anonimisasi terjamin**: knowledge tambahan, overlap course/periode, dan perbedaan snapshot dapat memungkinkan inferensi. Tidak ada export, filter siswa, atau differential privacy. Review privasi tetap gate.
- private/no-store + Vary Authorization; tidak menyimpan ke localStorage. Identitas dan izin dicek lagi setelah kalkulasi/cache hit. Laporan yang sudah dilihat tidak otomatis ditarik dari layar.

## Infrastruktur dan penyimpanan

Reuse PostgreSQL existing; tanpa provider/dependency/framework, DDL, backfill atau tabel baru. Tidak menyalin data belajar ke Marketing/board. Pool terpisah maksimal **1 koneksi tambahan per proses API**, satu kalkulasi aktif/proses; refresh lain menerima 503, tidak ditumpuk di antrean SQL. Rate limit 20 request/menit/user/proses.

Cache memory maksimal 32 course-week, TTL 5 menit, hanya agregat yang sudah disaring; tidak berisi ID siswa, email, jawaban atau catatan. Tidak ada scheduler/timer; dihitung saat diminta. Penambahan instance API mengalikan budget query/koneksi karena cache/limiter tidak terdistribusi.

Transaksi REPEATABLE READ READ ONLY; statement timeout 3 detik, lock timeout 500 ms, connection timeout 2 detik. Schema salah/timeout/DB gagal -> 503 generik, bukan angka nol atau detail SQL/credential. Jalur siswa tidak memanggil laporan. Read-only tidak menghapus risiko CPU/IO/lock; EXPLAIN/load test staging representatif tetap wajib. Jangan menambah index legacy otomatis untuk meloloskan timeout.

Cache dibuang saat proses berhenti. Angka agregat bisa tertinggal hingga 5 menit setelah koreksi/erasure; tidak ada kontrak cleanup/tabel personal baru. Tidak ada job terjadwal, tracking baru, daftar siswa individual, atribusi kampanye/revenue, eksperimen atau notifikasi otomatis.

## Aktivasi dan rollback

1. Gate MVP existing tetap berlaku: review, Node20/PG16 CI, staging schema lengkap, backup/restore dan smoke siswa/admin.
2. Review coverage, definisi metrik, privasi, permission per-role, SELECT grants runtime dan tambahan koneksi. Uji data sintetis tanpa PII dan volume representatif.
3. COMPANY_INSIGHTS_ENABLED=false adalah default. Canary owner setelah gate dengan workspace true; tidak memerlukan DDL baru. Jangan menjalankan migration legacy hanya untuk membuka laporan.
4. Staf memerlukan katalog permission role yang direview/diperbarui dan flag staf aktif. Uji scope ditolak, expired/revoked, Kanji/refresh JWT dan cache hit.
5. Pantau latency/503/CPU/IO/koneksi. Rollback: flag Insights false dan restart API sesuai prosedur existing, bukan drop tabel/reset progres/restore DB.

## Pengujian

company-insights.test.js mencakup minggu UTC, sampel/komplemen, SQL pada PostgreSQL fixture, repeat/source overlap, scope/realm/flags/expiry, permission hilang pada cache hit, tidak ada PII mentah, snapshot sumber tidak berubah, schema failure, lock timeout dan concurrency. Browser QA opsional memakai API/DB fixture asli, login dimock, outbound diblokir: role views, HTML escaping, suppressed state, stale response, mobile dan sentinel localStorage siswa.

Fixture tidak membuktikan kapasitas/kelengkapan produksi. Hasil digunakan membuat tugas review manual di board; tidak mengubah materi, memasarkan siswa individual, atau mengambil keputusan keuangan otomatis. Modul ini mengisi insight pembelajaran MVP, bukan seluruh roadmap analytics.
