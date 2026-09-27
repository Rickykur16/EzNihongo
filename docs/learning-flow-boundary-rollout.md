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
   oleh owner melalui `GET/PUT /api/admin/courses/:id/curriculum-boundary-mode`
   dengan `expectedRevision` hasil GET terakhir. PUT hanya menerima mode
   `off`, `audit`, `warn`, atau `enforce` dengan schema tepat; update memegang
   lock kurikulum dan memakai CAS. Route saat ini **menolak semua promosi ke
   enforce dengan 422 `enforce_readiness_evidence_unavailable`**. Registry
   attestation pasif menyimpan klaim owner tetapi belum dapat memverifikasi
   artifact, observasi pilot, atau provenance release secara tepercaya. Artifact dari
   client tidak dapat meloloskan gate itu. Enforce N4 tetap `BLOCKED` walaupun
   checklist manual telah lengkap; perlu perubahan server terpisah. N5 tidak
   otomatis ikut enforce.
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

Untuk perubahan mode **staging yang disetujui owner** saja, baca token mode
terkini lalu kirim mode `audit` atau `warn` sesuai course yang diverifikasi;
contoh ini tidak mempromosikan enforce atau menyalakan flow komunikasi:

```powershell
$courseId = '<course-uuid-terverifikasi>'
$modeEndpoint = "$apiBase/api/admin/courses/$courseId/curriculum-boundary-mode"
$currentMode = Invoke-RestMethod -Uri $modeEndpoint `
  -Headers @{ Authorization = "Bearer $ownerAccessToken" }
$modeBody = @{
  mode = 'audit'                    # ganti menjadi warn hanya setelah review
  expectedRevision = $currentMode.modeRevision
} | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri $modeEndpoint `
  -Headers @{ Authorization = "Bearer $ownerAccessToken" } `
  -ContentType 'application/json' -Body $modeBody
```

Verifikasi `course.id`, `slug`, `mode`, dan `modeRevision` dari respons; 409
berarti revision berubah dan operator harus berhenti, membaca ulang serta
meninjau diff. GET/PUT ini owner-only dan `private, no-store`. Untuk rollback
authoring dari mode non-enforce, gunakan endpoint yang sama dengan revision
terkini dan `mode='warn'`, `audit`, atau `off`; jangan mengubah kolom langsung
via SQL. GET/downgrade tidak bergantung pada readiness flow komunikasi.

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

Untuk canary produksi N5 Bab 3, gunakan dua workflow owner yang saling berbagi
lock `deploy-vps`. Jalankan **Prepare Bab 3 Learning Flow** dengan `apply=false`
lebih dahulu. Dry-run itu mensimulasikan refresh fingerprint companion,
backfill 12 pertanyaan, dan readiness akhir dalam satu transaksi lalu selalu
rollback. Lanjutkan `apply=true` hanya jika hasilnya tepat dua companion,
`would_insert: 12` (atau `already_present: 12` pada rerun), dan
`readiness.ready: true`. Setelah apply, jalankan **Learning Flow Canary**
dengan `apply=false`, lalu `apply=true` memakai UUID course/module yang sama.
Workflow canary hanya mempromosikan course ke `audit` dan hanya mengizinkan
module itu; workflow ini tidak pernah memilih `warn` atau `enforce`.
Perubahan mode mengubah boundary fingerprint. Karena itu apply canary, di bawah
course lock dan transaksi yang sama, memvalidasi ulang setiap pertanyaan
`legacy_bunpou` yang sudah ada lalu memperbarui hanya `boundary_fingerprint`
dan `validator_version` melalui compare-and-set. ID, `question_version`, teks,
opsi, jawaban, evidence, dan provenance tidak berubah. Row hilang, source
berubah, edit manual, hasil validasi gagal, atau readiness akhir gagal akan
membatalkan seluruh transaksi termasuk perubahan mode dan config.

Readiness menganggap integrity issue ber-`severity: warning` sebagai
diagnostik nonblokir, sesuai status boundary `resolved`. Status
`context_invalid`, severity `error`, atau severity yang hilang/tidak dikenal
tetap memblokir preparation, backfill, dan aktivasi. Karena itu peringatan
legacy vocabulary tetap terlihat dalam audit tanpa menyamarkannya sebagai
kerusakan ownership graph.

Enam grammar legacy Bab 3 yang dipin oleh `preparationReview` migration 174
mempertahankan pelanggaran boundary sumber lama sebagai `diagnostics` dengan
disposition `reviewed_legacy_source`. Pengecualian ini hanya berlaku bila
marker migration tepat, companion masih current terhadap source fingerprint,
serta snapshot sumber dan digest payload draft/published sama persis dengan
nilai yang ditinjau migration. Perubahan source sekecil apa pun membatalkan
pengecualian ini. Companion yang ditampilkan flow baru serta seluruh normalized
question tetap harus valid; marker ini bukan pengecualian umum untuk course,
module, atau konten baru.

## Manifest readiness yang gagal tertutup

Migration 166 menyediakan registry **pasif** untuk mencatat klaim review:
`GET /api/admin/courses/:id/readiness-attestations?moduleId=<uuid>` dan
`POST /api/admin/courses/:id/readiness-attestations`. Keduanya owner-only dan
`private, no-store`. POST menerima tepat `moduleId`, `environment: staging`,
`commitSha` (40 hex),
`sourceFingerprints` (`[{id, fingerprint}]`), dan `gates` dengan **semua** kode
gate di bawah. Setiap gate berbentuk `{status, artifacts}`; status hanya
`PASS|FAIL|SKIP|UNKNOWN|BLOCKED`, artifact berbentuk
`{url: "https://…", sha256: "sha256:<64 hex>"}`, dan `PASS` wajib memiliki
artifact. Jangan taruh token di URL. Actor diambil dari sesi owner di server,
bukan body; DB hanya menyimpan digest actor yang dibersihkan lewat erasure.
GET menunjukkan digest actor dan snapshot mode/config/boundary/commit yang
dilihat server pada tiap catatan, snapshot server saat ini, serta
`observedSnapshotChanged` bila observasi sekarang berubah.

**Semua record masih `verificationStatus: unverified` dan
`activationEligible: false`, termasuk yang semua gate-nya diklaim `PASS`.**
SHA artifact, source fingerprint, commit SHA dalam body, hasil CI/browser,
sentinel, traffic, dan persetujuan reviewer belum dapat diverifikasi dari
server. `observedCommitSha` juga dapat null bila deployment tidak memasok
`RELEASE_SHA` terpercaya; `claimedCommitMatchesObserved` hanya true bila
keduanya tersedia dan sama. Digest klaim dan append-only row membuktikan isi catatan
tidak diubah setelah capture, bukan kebenaran artifact. Tidak ada signature
release atau verifier eksternal saat ini. Karena itu endpoint mode tetap
menolak `enforce`; attestation bukan token promosi. Penurunan mode dan flag
flow tetap memakai prosedur rollback masing-masing.

Workflow deploy mengikat proses API ke SHA penuh yang diuji CI melalui
`/etc/systemd/system/eznihongo-api.service.d/10-release-sha.conf` berisi
`Environment=RELEASE_SHA=<DEPLOY_SHA>`. File dipasang secara atomik hanya
setelah migrasi berhasil; lalu `systemctl daemon-reload`, restart, dan
healthcheck. `backend/.env` tidak boleh mendefinisikan `RELEASE_SHA`:
`EnvironmentFile=` pada unit systemd mengalahkan `Environment=` di drop-in,
sehingga workflow menolak konflik sebelum mengganti metadata aktif. Kegagalan
healthcheck tidak mencetak `Deploy ok`; metadata release perlu dibandingkan
dengan proses yang benar-benar sehat sebelum dipakai sebagai bukti. Ikatan
SHA runtime ini tidak memverifikasi artifact, browser evidence, atau seluruh
gate readiness, sehingga `enforce` tetap diblokir.

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

`learning_flow_request` kini mencatat `queryCount` per request dengan
`AsyncLocalStorage`, terpisah untuk request paralel. Hitungan mencakup
`query()` yang diekspor oleh `db.js` dan `client.query()` melalui
`withTransaction`/`withAdvisoryLock`, termasuk BEGIN/COMMIT/ROLLBACK dan
advisory-lock SQL. Hitungan tidak memuat SQL atau parameternya. Nilai dibatasi
pada 10000; `queryCountCapped: true` berarti sampel tidak layak untuk
baseline. Pemanggilan pool mentah di luar wrapper belum diinstrumentasi.

Untuk merangkum log NDJSON terpercaya secara **read-only**:

```powershell
node backend/scripts/summarize-learning-flow-baseline.mjs `
  --input <path-to-learning-flow-events.ndjson> `
  --environment staging --commit <40-hex-deployment-commit>
```

Input harus terdiri dari event schema 1 yang valid, termasuk queryCount;
field pribadi/tidak dikenal, sampel capped, metadata kosong, dan input rusak
ditolak. Output menampilkan jumlah sampel serta p50/p95 durasi dan jumlah
query per operation dengan metode nearest-rank. Environment/commit berasal
dari operator dan belum diverifikasi otomatis terhadap deployment; ringkasan
bertanda `operator_supplied_unverified` dan `not_evaluated`, **bukan PASS**.
Bandingkan baseline dan pilot pada fixture, beban, dan DB staging yang sama;
perubahan jumlah query menurut banyaknya dialog harus diperiksa tersendiri.
Gate performa §15 tetap `BLOCKED` sampai pengukuran representatif direview.

## Telemetry dan batas bukti

Backend menghasilkan structured log `learning_flow_request` versi schema 1
untuk batch inline, answer/latest dialogue, session create/get, production,
answer/hint/reveal. Field tetap: `timestamp`, `operation`, `status`,
`outcome`, `durationMs`; bila tersedia `flowVersion` 1/2, `placement`,
`transferAvailable`, `grade`, `errorCode` dari allowlist, dan `queryCount`. Log tidak
memuat ID learner/session/question, URL, prompt, option, jawaban, request ID,
atau key privat. Agregasi berdasarkan operation/status/versi untuk
memeriksa error, konflik, distribusi v1/v2, transfer dan fetch inline; cocokkan
dengan report DB per mode/content type/course/module/code/severity.

Replay idempoten jawaban dialogue dan item session diberi outcome
`idempotent_replay` dari penanda internal sesudah transaksi. Response/snapshot
publik tidak ditambahi field telemetry. `already_completed` tetap outcome
tersendiri untuk request baru terhadap item yang sudah selesai; conflict
request ID tetap `conflict`. Logger yang gagal tidak mengubah respons learner.

Grounded draft melalui `groundedDraft` juga mencatat satu structured event
`grounded_generation` setelah hasil terminal: allowlist `contentType`,
`operation=generate`, mode, outcome `ready|rejected|stale|unavailable`, jumlah
provider call/attempt (maksimal 3), `retried`, `sourceStale`, dan durasi
terbatas. Tidak ada ID, prompt, teks kandidat, fingerprint, atau exception.
`ready` satu attempt menunjukkan valid-first-pass; `rejected` setelah retry
menunjukkan hasil tetap gagal. Logger yang gagal tidak mengubah hasil draft.
Event ini mengukur **tahap generation** saja: bulk distractor/deck reading
dapat menolak save kemudian dengan `source_changed_since_generation` setelah
event `ready`. Penolakan transactional itu tetap aman, tetapi belum memiliki
label telemetry terminal-save tersendiri. Jangan menghitung event `ready`
sebagai jumlah row yang berhasil disimpan.

Telemetry ini **belum** menyediakan ringkasan agregat generation atau
readiness dashboard. Untuk gate observasi §15, lampirkan bukti tambahan
yang benar-benar menangkap kasus itu; jika tidak ada, biarkan `BLOCKED`.
Jangan menafsirkan comprehension accuracy sebagai mastery baru.

## Menahan atau membatalkan rollout

- Masalah authoring boundary: owner turunkan affected course dari enforce
  ke warn/audit lewat PUT mode owner-only dengan CAS revision terkini, sambil
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
