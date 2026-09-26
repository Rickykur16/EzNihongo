# Learning Flow & Curriculum Boundary — PR0 Baseline

Tanggal discovery: 2026-09-26. Dokumen ini mencatat source checkout, bukan
keadaan database production atau staging.

## Checkout dan schema

- Branch kerja: `codex/learning-flow-boundary-pr0`.
- HEAD: `5d540090a049650aac59a0deed4264c18e1582a9`, sama dengan snapshot audit
  pada implementation plan.
- Migration tertinggi: `164_maneko_learning_assistance.sql`; nomor berikutnya
  yang tersedia pada saat discovery adalah 165.
- Tidak ada `AGENTS.md`. Instruksi repository yang berlaku ada di `CLAUDE.md`
  dan `DESIGN.md`.
- `backend/schema.sql` adalah baseline yang tertinggal dari beberapa migration.
  Schema hasil migration PostgreSQL tetap menjadi otoritas saat database test
  tersedia.
- `TEST_DATABASE_URL` tidak tersedia. Catalog, jumlah row, duplikasi, orphan,
  dan readiness data production belum diperiksa.

## Sumber kurikulum dan urutan

| Dimensi | Sumber authoritative existing | Catatan |
|---|---|---|
| Course/module | `courses`, `modules` | Urutan Bab memakai `modules.sort_order`; jangan parsing judul/slug. |
| Vocabulary | `module_vocabulary.module_id` | `lesson_id` membantu placement; bank module tetap sumber boundary V1. |
| Deck | `lesson_deck_items` | Placement kartu, bukan bank atau bukti earliest introduction baru. |
| Grammar | `module_grammar.module_id` | `lesson_id` membantu placement. `example_dialog_id` berisi terjemahan Indonesia. |
| Kanji | `kanji_items.lesson_id -> lessons.module_id` | `jlpt_level`/`bab_kode` hanya diagnostic/fallback yang perlu diverifikasi. |
| Bunpou companion | `lessons.bunpou_flow_draft/published` | Ditambah migration 147 dan tidak lengkap di baseline schema. |
| Bunpou session | `grammar_task_sessions` dan item | Internal step comprehension tetap 4; comparison/transfer tetap 5. |

Migration 160 mengecualikan vocabulary yang tertaut ke deck N5 ketika membentuk
deck N4. Itu bukan bukti bahwa seluruh bank sudah mempunyai placement yang benar,
dan bukan alasan menyalin deck N5 ke N4 untuk inheritance boundary.

## Jalur konten, generator, writer, dan guard existing

Semua baris di bawah memakai `backend/src/routes/admin.js`, kecuali dinyatakan
lain. Router admin memasang `requireAuth` dan `requireCompanyAdmin`; izin method
dan path dirinci oleh `backend/src/company-route-policy.js`.

| Konten | Source/placement | Generator | Durable writer/import | Guard saat ini | Test relevan |
|---|---|---|---|---|---|
| Vocabulary bank/deck | `module_vocabulary`, `lesson_deck_items` | contoh `POST /generate-vocab-examples` (3022); gambar (3160) | CRUD/bulk (560–758); Notion deck (1120) | warning contoh dipanggil setelah write (675, 696); belum pre-write enforcement | `learning-scope-warnings.test.js`, `n4-curriculum-cleanup.test.js` |
| Grammar/examples | `module_grammar`, `grammar_examples`, task links | distractor (1536, 1567); examples (3226, 3312) | grammar CRUD/bulk (3397–3520); example CRUD (3467–3504) | warning grammar/example setelah write (3408, 3453, 3476, 3494) | `learning-scope-warnings.test.js`, `bunpou-production.test.js` |
| Dialog/translation | `module_grammar.example_dialog`, `example_dialog_id`, scene/furigana | translation (3276); dialog (3346) | grammar CRUD di atas | warning grammar setelah write; scene/furigana memakai helper existing | `dialogue-scene-api.test.js`, `dialogue-scene-migration.test.js` |
| Quiz/options/passage | lesson quiz tables | quiz (2068); options (2232); listening (2467); JLPT (2868) | quiz CRUD (3743–3886); passage update (3915) | warning quiz/passage setelah write (3799, 3881, 3923) | `quiz-integrity.test.js`, `kanji-compounds.test.js` |
| Bunpou companion/session | published/draft JSON dan snapshots | generation/edit melalui editor existing | publish (1819); session routes di `grammar-task-sessions.js` | source fingerprint, entitlement, ownership, request ledger; belum boundary baru | `bunpou-flow-checks.test.js`, `bunpou-session-api.test.js`, `bunpou-production.test.js` |
| Importer lain | Notion lesson/kanji dan scripts | n/a | Notion lesson (1320), kanji (4820), scripts import | auth/RBAC dan validasi lokal; belum satu boundary guard | route tests terkait; inventory guard harus ditambah pada PR4 |

`safeLearningWarnings` di `admin.js:70` sengaja menangkap error dan mengubahnya
menjadi warning. Karena pemanggilan penting terjadi setelah penyimpanan, jalur
ini hanya cocok untuk audit dan harus menjadi adapter ke resolver baru, bukan
validator kedua atau dasar enforce.

## DTO dan redaction boundary

- `backend/src/routes/content.js:49` menyusun payload course/module/lesson dan
  memuat vocabulary/grammar, termasuk dialog, scene, dan furigana. Perubahan
  berikutnya harus menambah projection eksplisit dan test deep leak.
- Endpoint lesson di `content.js:353` melakukan query `l.*` secara internal,
  lalu membangun DTO response eksplisit. Published Bunpou companion hanya
  disertakan untuk pilot yang eligible; draft tidak dikirim.
- Quiz learner dinilai server-side (`content.js` sekitar 548); answer key tidak
  dikirim pada payload awal.
- Session Bunpou memakai snapshot private. Request ledger pada
  `grammar-task-sessions.js` sekitar 239–269 menangani replay dan konflik.
- Normalized dialogue question harus meniru batas ini: public question version
  opaque, prompt/options saja; correct index, explanation, evidence pointer,
  dan private fingerprint tetap server-side sampai attempt berhasil disimpan.

## Fixture dan sentinel yang wajib tersedia sebelum claim readiness

Database disposable perlu fixture untuk:

- N5 Bab awal, Bab 3, dan Bab 7;
- N4 Bab 1 dan Bab 4 dengan prerequisite N4 -> N5;
- vocabulary berulang lintas Bab, vocabulary bank tanpa lesson/deck, dan
  deck-owner mismatch;
- karakter kanji berulang, kanji orphan, dan kanji dengan metadata level yang
  tidak cukup untuk menentukan owner;
- published/draft companion, attempt/progress/history N5, serta session v1 aktif
  dengan item internal 4 dan 5.

Sentinel membandingkan kolom existing sebelum/sesudah migration: course/module/
lesson identity dan urutan, teks Jepang/terjemahan, media/scene/furigana, bank,
deck membership, kanji links, companion, progress, attempts, dan session
snapshots. Kolom/tabel additive dan salinan normalized question adalah satu-satunya
perubahan yang boleh muncul.

Belum dapat dipastikan dari source saja: ID dan jumlah row scope di atas,
inventaris bank/deck/orphan aktual, mapping grammar legacy yang `lesson_id`-nya
null, status companion current, readiness N4->N5, serta baseline latency/query.

## PR1 deployment compatibility

Deploy workflow menjalankan migration sebelum me-restart backend. Migration
attempt menambah FK baru ke `users`; backend lama mempunyai guard erasure yang
menolak setiap FK user yang belum dikenal. Karena itu PR1 perlu dikirim sebagai
dua child PR/deploy: pertama perubahan erasure yang mengenali tabel attempt
sebagai optional, lalu schema migration setelah backend compatibility tersebut
sudah aktif. Menggabungkan keduanya masih fail-closed dan tidak mengubah data,
tetapi membuat account erasure sementara tidak tersedia antara migration dan
restart sehingga belum memenuhi gate old-backend compatibility.

FK `RESTRICT` pada question/attempt juga membuat delete grammar, lesson, dan
course prerequisite dapat ditolak. Route deletion perlu memetakan konflik
referensi menjadi HTTP 409 yang jelas sebelum authoring flow diaktifkan; handler
global saat discovery masih memetakan seluruh error `23503` menjadi 400.

## Baseline test

Command yang dijalankan:

```text
node --test learning-state.test.js landing-cms.test.js
```

Hasil: 5 pass, 0 fail, 0 skip.

`npm --prefix backend test` tidak dapat dijalankan pada saat baseline karena
`npm` tidak tersedia di PATH. Runtime Node workspace kemudian ditemukan dan
dependency backend dipasang melalui pnpm untuk verifikasi perubahan berikutnya;
hasil tersebut dicatat sebagai validasi PR1, bukan diklaim sebagai baseline
bersih. Test PostgreSQL, migration runner, dan audit data tidak dijalankan karena
`TEST_DATABASE_URL` tidak tersedia. Sesuai plan, `DATABASE_URL` dan `.env` tidak
dibaca dan migration runner tidak dijalankan tanpa target test yang tervalidasi.

## Bukti validasi PR1 setelah baseline

PostgreSQL 16.13 portable kemudian dijalankan hanya pada workspace lokal dengan
database disposable. Tidak ada service sistem, database production, atau `.env`
repository yang digunakan.

- Test migration/constraint/erasure terfokus: 20 pass, 0 fail, 0 skip.
- Full backend suite dengan PostgreSQL: 523 test, 522 pass, 0 fail, 1 skip
  (`operations browser`, memerlukan browser terpisah).
- Root learning-state/landing suite: 5 pass, 0 fail.
- Full migration runner dari `backend/schema.sql`: 162 migration applied pada
  run pertama; run kedua melaporkan database up to date dan menerapkan 0 file.
- Ledger berisi tepat satu `165_learning_flow_boundary_foundation.sql`.
- Catalog memverifikasi default boundary `'off'`, session flow version `1`, dan
  `learning_flow_communication_v1.enabled=false`.

Database disposable dihentikan dan dihapus setelah setiap run.
