# Learning Flow & Curriculum Boundary: rollout dan rollback

Runbook ini adalah **prosedur dan template bukti**, bukan catatan bahwa suatu
course sudah siap atau sudah diaktifkan. Jangan memakai database production
untuk latihan perintah di bawah. Mode boundary dan flag komunikasi adalah dua
kontrol terpisah: audit/warn/enforce tidak otomatis memindahkan learner ke
inline, dan inline tidak otomatis mengubah mode boundary. Config komunikasi
yang hilang atau `enabled: false` tidak memilih v2 untuk sesi baru (jalur
legacy atau pilot v1 tetap mengikuti gate-nya sendiri);
active v2 yang sudah diterbitkan tetap dapat dilanjutkan setelah flag OFF.

## Urutan dan kewenangan

1. Siapkan target **staging disposable** dan catat URL secara lokal. Tentukan
   jenis target sebelum menjalankan apa pun:
   - Untuk database fixture baru yang benar-benar kosong, bootstrap satu kali
     dengan `backend/schema.sql`, muat fixture legacy yang dikontrol, lalu
     jalankan runner. Runner hanya membuat ledger `schema_migrations`; ia tidak
     membuat tabel baseline seperti `courses`, dan migration 001 sudah
     menjalankan `ALTER TABLE courses`.
   - Untuk restore/snapshot staging existing, restore schema, data, dan ledger
     migration-nya secara utuh. Jangan menjalankan `schema.sql`, seed, atau
     bootstrap fixture di atas snapshot existing.
   Pastikan `DATABASE_URL` menunjuk ke target tersebut. `TEST_DATABASE_URL`
   untuk suite integrasi harus menunjuk ke database test yang berbeda; jangan
   mengarahkan test ke production.
2. **Sebelum migration pertama**, simpan sentinel baseline untuk ID dan urutan
   course/module/lesson,
   teks dan terjemahan, media/scene/furigana, bank/deck/kanji, published
   companion, progress, attempts, serta snapshot session. Selisih N5 existing
   yang tidak diotorisasi harus **0**. Repo belum memiliki satu perintah
   otomatis yang menghasilkan seluruh sentinel ini; lampirkan query/export
   beserta checksum dan review manual, atau tandai gate `BLOCKED`. Setelah itu,
   jalankan migration 165 dan migration berikutnya lewat runner repo
   (`npm --prefix backend run migrate`), jalankan lagi untuk membuktikan
   ledger/idempotency, lalu ambil sentinel sesudah dan verifikasi catalog serta
   smoke test. Catat nama migration yang terpasang; jangan menyimpulkan
   keamanan migration dari suite yang skip.
3. Audit course terpilih, perbaiki mapping/owner/order secara editorial dengan
   diff terpisah, lalu ulangi audit. Audit N5 dan warn N4 hanya boleh diubah
   oleh owner melalui prosedur change yang disetujui. Saat dokumen ini dibuat,
   **tidak ada route khusus** `PUT /courses/:id/curriculum-boundary-mode`;
   jangan mengarang perintah API atau melakukan SQL mode langsung dari runbook.
   Promote N4 ke enforce tetap `BLOCKED` sampai kontrol owner dan semua gate
   di bawah terbukti. N5 tidak otomatis ikut enforce.
4. Dry-run backfill untuk scope eksplisit. Apply pada staging hanya setelah
   review source dan konflik; rerun identik harus `already_present` tanpa
   perubahan pertanyaan. Backfill tidak mengarang evidence/explanation,
   tidak menimpa row manual/generated/edited, dan status
   `needs_editor_review`, `source_changed`, `edited_conflict`,
   `skipped_conflict`, atau mapping ambigu menahan aktivasi scope terkait.
5. Owner memeriksa `GET /api/admin/settings/learning-flow-communication`.
   Hanya setelah semua gate lulus, owner dapat mengirim `PUT` dengan
   `expectedConfigRevision` terkini dan `config` berupa allowlist ID eksplisit
   (`enabled`, `courseIds`, `moduleIds`, `lessonIds`). Server memeriksa scope,
   revision, dan readiness lagi di transaksi; 409/422 berarti **jangan
   lanjutkan aktivasi**. Pilih satu module kecil dahulu. Jangan menyimpulkan
   aman dari status HTTP 200 saja: cocokkan manifest dengan fingerprint
   source/boundary dan hasil smoke setelah save.

Contoh **staging saja** dari root repo, dengan placeholder yang harus diganti
berdasarkan identitas scope yang telah diverifikasi:

```powershell
# Tetapkan DATABASE_URL ke database staging disposable melalui mekanisme
# rahasia setempat; jangan menulis credential ke dokumen atau log.
# HANYA untuk fixture baru yang kosong, dengan psql sudah diarahkan secara
# aman ke target disposable; lewati dua langkah ini untuk restore existing.
psql -v ON_ERROR_STOP=1 -f backend/schema.sql
# Muat fixture legacy terkontrol sesuai test plan.

# BERHENTI: ambil sentinel baseline dan checksum sebelum runner pertama.
npm --prefix backend run migrate
npm --prefix backend run migrate  # harus melaporkan up to date

node backend/scripts/audit-curriculum-boundary.mjs `
  --course '<course-uuid-atau-slug-terverifikasi>' --dry-run --format jsonl `
  > '<folder-bukti>/audit-before.jsonl'

node backend/scripts/backfill-dialogue-questions.mjs `
  --course-id '<course-uuid>' --module-id '<module-uuid>' `
  --run-id '<run-uuid>' --dry-run `
  > '<folder-bukti>/backfill-dry.jsonl'
```

Owner dapat membaca revision/readiness di staging dengan access token dari
alur autentikasi resmi (jangan simpan token di artifact):

```powershell
# $apiBase dan $ownerAccessToken disediakan oleh operator secara aman.
$settings = Invoke-RestMethod `
  -Uri "$apiBase/api/admin/settings/learning-flow-communication" `
  -Headers @{ Authorization = "Bearer $ownerAccessToken" }
$settings | ConvertTo-Json -Depth 20
```

GET bersifat read-only; tidak ada contoh PUT untuk mengaktifkan allowlist
di runbook ini. Error 401/403 bukan bukti readiness.

`audit-curriculum-boundary.mjs` memakai transaksi repeatable-read **READ ONLY**
untuk dry-run. `--course` menerima UUID atau slug yang resolve unik;
`--module-id`, `--lesson-id`, dan `--content-type` dapat mempersempit scan.
Periksa record `type=summary`: `course.mode`, `scanned`, `evaluated`,
`unavailable`, `violations`, `warnings`, `coverage.complete`, dan
`coverage.mappingGaps`. Periksa setiap record `type=content` termasuk
`contentFingerprint`, `boundaryFingerprint`, kode/severity/unknown, bukan
hanya total summary. `--persist-reports --run-id <UUID>` **menulis** report;
pakai hanya pada target staging yang disetujui dan catat run ID. Jangan
mencampur `--dry-run` dengan `--persist-reports`.

`backfill-dialogue-questions.mjs` mewajibkan `--course-id` dan `--run-id`
UUID; course/module/lesson ID harus huruf kecil. Module/lesson ID opsional
untuk mempersempit, dan parent ID yang tidak
cocok ditolak. Default-nya dry-run read-only. Jika review staging mengizinkan
apply, ulangi perintah yang sama dengan `--apply` menggantikan `--dry-run`,
kemudian ulangi `--apply` sekali lagi memakai run ID baru. Simpan setiap
summary `lessonCount`, `counts`, `sourceChecksum`, dan `checksum`; cocokkan
`sourceChecksum` untuk source yang sama serta pastikan rerun tidak menambah
`inserted`. `checksum` keseluruhan dapat berubah karena status
`would_insert → inserted → already_present`; jangan menuntut ketiganya
identik. Apply memakai unit transaksi kecil dengan course lock. Dry-run
tidak menulis pertanyaan atau report DB.

## Manifest readiness yang gagal tertutup

Simpan satu manifest per scope dan per review. Template awal di bawah sengaja
`BLOCKED`; kosong, `SKIP`, `UNKNOWN`, fingerprint berbeda, atau evidence
tanpa lokasi/hasil yang dapat diaudit **bukan** `PASS`. Reviewer harus
menyimpan artifact dengan commit SHA dan waktu UTC; ulangi audit scope dan
descendant setelah kurikulum/prerequisite/auxiliary/source berubah.

```yaml
decision: BLOCKED                 # PASS hanya jika seluruh gate PASS
environment: staging
commitSha: REQUIRED
recordedAtUtc: REQUIRED
reviewer: REQUIRED
scope:
  courseIds: []                   # ID eksplisit, tidak berdasar level
  moduleIds: []
  lessonIds: []
configRevision: REQUIRED          # GET owner settings saat review
boundaryFingerprints: {}         # per scope + source/content revision
evidence:
  migrationRerunAndLedger: { status: BLOCKED, artifact: REQUIRED }
  n5ExistingSentinelZero: { status: BLOCKED, artifact: REQUIRED }
  graphOwnerOrderBankDeckKanji: { status: BLOCKED, artifact: REQUIRED }
  writerInventoryNoBypass: { status: BLOCKED, artifact: REQUIRED }
  auditHardZeroUnavailableZero: { status: BLOCKED, artifact: REQUIRED }
  unknownWarningsEditorialReview: { status: BLOCKED, artifact: REQUIRED }
  questionCurrentEvidenceNoKeyLeak: { status: BLOCKED, artifact: REQUIRED }
  backfillDryApplyRerun: { status: BLOCKED, artifact: REQUIRED }
  v1V2ResumeReplayRollback: { status: BLOCKED, artifact: REQUIRED }
  fullSuitesRealDbNoCriticalSkip: { status: BLOCKED, artifact: REQUIRED }
  browserChecklist: { status: BLOCKED, artifact: REQUIRED }
  latencyAndQueryBaseline: { status: BLOCKED, artifact: REQUIRED }
  pilotTrafficAndEditorialCycle: { status: BLOCKED, artifact: REQUIRED }
  ownerApproval: { status: BLOCKED, artifact: REQUIRED }
```

Untuk `decision: PASS`, setiap gate harus berstatus `PASS`, artifact harus
menyatakan hasil dan target environment yang sama, seluruh fingerprint dan
`configRevision` harus tetap current, dan reviewer/owner harus nyata.
`coverage.complete=false`, mapping gap, validation unavailable, known hard
violation, unresolved unknown, source stale, critical test skip, atau browser
evidence yang belum ada mempertahankan `BLOCKED`. Lulusnya satu module tidak
memberi izin untuk course atau module lain. Jangan mengklaim observasi pilot
hanya dari waktu berlalu tanpa create/edit/publish/answer/resume yang sungguh
terjadi.

Verifikasi yang harus dicatat (PASS/FAIL/SKIP dengan target DB/fixture):

```powershell
npm --prefix backend test
node --test backend/src/dialogue-question-backfill.test.js `
  backend/src/dialogue-question-learner.test.js `
  backend/src/learning-flow-config.test.js `
  backend/src/learning-flow-telemetry.test.js
```

Catat suite PostgreSQL yang membutuhkan `TEST_DATABASE_URL` atau PGlite.
PGlite dapat memeriksa SQL berurutan, tetapi bukan bukti race dua koneksi
PostgreSQL nyata. Browser evidence harus mencakup 360/390/768/1280,
keyboard/focus, reduced motion, loading/error, legacy, active v1, v2 baru,
v2 resume setelah flag OFF, answer replay/conflict, no initial answer leak,
dan completion/XP/mastery tetap. Simpan screenshot/hasil yang benar-benar
diuji; jangan menandatangani checklist dari source inspection saja.

Harness fixture dapat dijalankan tanpa provider/model atau data learner:

```powershell
# Isi dua override ini hanya bila Playwright/browser tidak tersedia dari
# instalasi default. EZ_QA_NODE_PACKAGE harus menunjuk package.json absolut.
$env:EZ_QA_NODE_PACKAGE = '<node_modules/package.json>'
$env:EZ_QA_BROWSER = '<browser-executable>'
$env:EZ_QA_OUTPUT = '<folder-artifact>'
node backend/scripts/learning-flow-browser-qa.mjs
node backend/scripts/dialogue-scene-browser-qa.mjs
```

Fixture learning-flow memeriksa placement, initial-payload redaction,
wrong/correct grading, stale recovery, legacy session, kegagalan batch, dan
overflow 1280/360. Harness dialogue memeriksa audio, furigana, scene,
fallback, reduced motion, dan 360/390/768/1280. Contoh screenshot fixture
yang dihasilkan ada di [1280 px](qa/learning-flow/inline-1280.png) dan
[360 px](qa/learning-flow/inline-360.png). Fixture/screenshot ini bukti
regresi source lokal; keduanya tidak menggantikan browser E2E staging,
active-v1/v2 rollback, replay concurrency, atau sign-off reviewer pada
manifest.

Tetapkan budget latency pilot dari baseline staging representatif sebelum
aktivasi. Contoh target engineering dalam plan adalah p95 GET tambahan
≤100 ms dan submission ≤500 ms di staging yang sama; **angka ini belum
diukur atau dibuktikan oleh repo**. Catat query count dan p95 sebelum/sesudah;
learner read/grade tidak boleh memanggil model atau melakukan N+1 per dialog.

## Telemetry dan batas bukti

Backend menghasilkan structured log `learning_flow_request` versi schema 1
untuk batch inline, answer/latest dialogue, session create/get, production,
answer/hint/reveal. Field tetap: `timestamp`, `operation`, `status`,
`outcome`, `durationMs`; bila tersedia `flowVersion` 1/2, `placement`,
`transferAvailable`, `grade`, dan `errorCode` dari allowlist. Log tidak
memuat ID learner/session/question, URL, prompt, option, jawaban, request ID,
atau key privat. Agregasi berdasarkan operation/status/versi untuk
memeriksa error, konflik, distribusi v1/v2, transfer dan fetch inline; cocokkan
dengan report DB per mode/content type/course/module/code/severity.

Telemetry ini **belum** menandai replay idempotent secara terpisah dari
success, belum menyediakan agregat generation retry/source-stale atau
readiness dashboard. Untuk gate observasi §15, lampirkan bukti tambahan
yang benar-benar menangkap kasus itu; jika tidak ada, biarkan `BLOCKED`.
Jangan menafsirkan comprehension accuracy sebagai mastery baru.

## Menahan atau membatalkan rollout

- Masalah authoring boundary: owner turunkan affected course dari enforce
  ke warn/audit lewat prosedur perubahan mode yang disetujui, sambil
  mempertahankan report. Auth, schema, dan relational integrity tetap aktif.
- Masalah inline/session baru: owner set config komunikasi `enabled: false`
  menggunakan `PUT /api/admin/settings/learning-flow-communication` dan
  `expectedConfigRevision` dari GET terkini, dengan daftar ID yang sama.
  Ini menghentikan **pembuatan v2 baru**, bukan mengubah active v2 ke v1.
  Active v2 tetap memakai snapshot, internal step 5, dan access/expiry
  checks. Legacy pilot v1 punya flag terpisah; mematikannya dapat menolak
  resume v1 sesuai perilaku lama. Jangan memakai flag v1 sebagai rollback v2.
- Soal bermasalah: archive/review normalized question atau hentikan scope
  baru. Attempt snapshot dan legacy JSON tetap tersimpan; replay yang sudah
  tersimpan tetap memerlukan access check.
- Jangan DROP tabel/kolom, reseed legacy, reset progress/attempt/session,
  atau ubah nomor internal step. Gunakan forward fix/revert yang tetap
  memahami schema dan snapshot v2. Setelah rollback, uji ulang auth,
  course/lesson/dialog, TTS, Bunpou, answer replay, completion, dan health;
  cocokkan audit serta sentinel dengan baseline.

Untuk rollback flag v2 oleh owner, baca revision **lagi** tepat sebelum PUT;
gunakan token dan `$apiBase` operator yang sama seperti contoh GET di atas:

```powershell
$settings = Invoke-RestMethod `
  -Uri "$apiBase/api/admin/settings/learning-flow-communication" `
  -Headers @{ Authorization = "Bearer $ownerAccessToken" }
$body = @{
  expectedConfigRevision = $settings.configRevision
  config = @{
    enabled = $false
    courseIds = @($settings.config.courseIds)
    moduleIds = @($settings.config.moduleIds)
    lessonIds = @($settings.config.lessonIds)
  }
} | ConvertTo-Json -Depth 10
Invoke-RestMethod -Method Put `
  -Uri "$apiBase/api/admin/settings/learning-flow-communication" `
  -Headers @{ Authorization = "Bearer $ownerAccessToken" } `
  -ContentType 'application/json' -Body $body
```

Jika PUT mengembalikan 409, hentikan dan baca ulang revision/scope; jangan
memaksa overwrite. Verifikasi GET setelah rollback dan uji active v2 resume.
