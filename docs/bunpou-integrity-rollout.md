# Pendamping Bunpou: publikasi dan integritas sesi

Dokumen ini dulu menjelaskan **pilot v1 satu pelajaran** (saklar + pemilih
pelajaran di tab AI). Sejak 27 September 2026 saklar itu **dihapus**: pendamping
yang dipublikasikan langsung tampil ke siswa. Untuk flow komunikasi v2, lihat
[learning-flow-boundary-rollout.md](learning-flow-boundary-rollout.md). Keduanya
tetap independen. Dokumen ini tidak mencatat aktivasi produksi apa pun.

## Publikasi = tayang

1. Buka pelajaran grammar di admin lalu klik 🧭 Pendamping Bunpou (atau pilih
   pelajarannya di kartu **Pendamping Bunpou — status tayang** di tab AI, lalu
   Edit Pendamping Bunpou). Tinjau dialog dan soal turunannya, isi tujuan,
   arahan, petunjuk, dan pembahasan, lalu publikasikan secara eksplisit.
2. Publikasi langsung tampil ke siswa **selama pelajaran lolos cek kesiapan**
   (`backend/src/bunpou-companion-status.js`, satu aturan yang dipakai bersama
   oleh payload pelajaran, sesi Tugas Bunpou, Smart Review, dan kartu admin):
   kursus N5 yang aktif, video terhubung, tepat satu pasangan Tugas Bunpou,
   materi belum berubah sejak publikasi, contoh dan dialog lengkap, serta soal
   Step 1/2 tersedia untuk semua pola. Respons publish menyebut `live` dan
   `liveReason`, dan admin diberi tahu kalau publikasinya belum tampil.
3. Tidak ada batas satu pelajaran: dua pelajaran grammar dalam satu bab (mis.
   Bab 3) bisa tampil bersamaan.
4. **Materi satu bab saling terkait.** Sidik jari sumber menghitung seluruh pola
   grammar di bab itu, karena pola-pola itu menjadi sumber pengecoh soal. Mengedit
   pola, arti, contoh, atau pengecoh di pelajaran MANA PUN dalam bab yang sama
   membuat pendamping semua pelajaran di bab itu berhenti tampil sampai ditinjau
   dan dipublikasikan ulang. Lakukan semua perubahan materi dulu, baru publikasikan.
   Menerbitkan satu pelajaran tidak mengubah materi, jadi tidak pernah mematikan
   pelajaran lain. Admin kini diberi tahu saat itu juga: menyimpan atau
   menghapus pola, contoh, pengecoh, atau dialog membalas peringatan yang
   menyebut pendamping mana yang berhenti tampil.
5. Buka pelajaran sumber dan Tugas Bunpou-nya sebagai siswa uji yang terdaftar.
   Periksa petunjuk, pembahasan, pembukaan jawaban setelah dua kali salah,
   refresh, pembukaan ulang popup, dan revisi produksi.

Shadow comparison tetap punya pemilihnya sendiri, tetap read-only, dan tidak
mengaktifkan kebijakan penguasaan usulan.

## Soal pemeriksaan dialog dibuat di 🎭 Dialog

Soal di akhir Tugas Bunpou (langkah 4 pemahaman, langkah 5 pembanding) dan
soal pemeriksaan di Smart Review sekarang dibuat dan diedit di editor
**🎭 Dialog** pada tabel grammar pelajaran sumber, di bawah dialog berprofilnya
(tabel `grammar_dialog_questions`, set yang sama dengan flow v2). Comprehension
pertama menjadi soal pemahaman, transfer menjadi soal pembanding. Modal 🧭
Pendamping Bunpou tidak lagi punya kolom soal; ia menampilkan soal yang benar-
benar dipakai siswa beserta sumbernya, tombol **🎭 Edit dialog & soal**, dan
tombol **✏️ Ubah arti, contoh, pengecoh** (sumber soal Step 1/2).

Aturan pemilihan (`backend/src/bunpou-dialog-checks.js`), per pola:

- Set pertanyaan punya minimal 1 comprehension dan 1 transfer yang cocok dengan
  dialog sekarang → dipakai (`dialog`).
- Pola punya baris aktif di set tapi belum lengkap, atau dialognya diedit
  sehingga soalnya perlu ditinjau ulang → **tidak ada soal pemeriksaan**
  (`dialog_incomplete`). Sengaja TIDAK jatuh balik ke soal lama, karena soal lama
  bisa tidak cocok lagi dengan dialog yang sekarang.
- Belum ada set sama sekali → soal lama di envelope pendamping (`dialogChecks`)
  tetap dipakai (`legacy`), supaya Bab 3 tidak kehilangan soal selama dipindah.

Cara memindahkan soal lama: buka 🎭 Dialog pola itu → **↺ Salin dari soal
lama** → lengkapi penjelasan dan bukti kutipan dari dialog → **Simpan set
pertanyaan**. Tombol salin tidak menyimpan apa pun sendiri. Menyimpan set
langsung mengganti soal yang dilihat siswa (sesi v1 baru dimulai karena
revisinya berubah; sesi yang sedang berjalan memakai snapshot-nya). Pendamping
tidak perlu dipublikasikan ulang. Soal lama tetap tersimpan di envelope sebagai
arsip dan dibawa apa adanya saat pendamping disimpan lagi.

Selama belum ada pola yang dipindah, revisi sesi v1 identik dengan sebelumnya,
jadi deploy perubahan ini tidak memulai ulang sesi yang sedang berjalan.

Bukti kutipan (`evidence`) soal lama dari migrasi 174 dulu dibuang diam-diam
setiap kali pendamping disimpan lewat editor. Itu sudah diperbaiki, tapi bukti
yang sudah terbuang tidak bisa dipulihkan dari kode: isi ulang saat menyalin.

## Deployment prerequisites

- Apply additive migration 152 on isolated staging using the existing migration runner before deploying the new server. It adds a request ledger and production-slot snapshots, without rewriting attempts, curriculum, XP, completion, enrollment, or settings.
- Existing publications without the expanded source fingerprint must be reviewed and republished. The admin status card explains this state. No migration fabricates editorial approval.
- **Deploy effect of removing the pilot switch:** every lesson that already has a published, still-current companion and passes readiness becomes visible to students as soon as the new server runs. Check the status card after deploy. The old `bunpou_flow_pilot_enabled`/`bunpou_flow_pilot_lesson_id` rows in `app_settings` are no longer read by any code and can be left alone.
- Verify the chosen N5 lesson has linked video, examples, dialogue, and exactly one task mapping. The server checks readiness even if a client bypasses the selector.
- No production deployment, production migration, or flag activation is part of this code change.

## Data and behavior

- Answers, attempt evidence and immutable request responses commit together. A repeated request returns its stored response; changing its item/payload returns a conflict before mutation.
- Hint/reveal exposure is read across saved sessions, including expired ones. Previously disclosed answers cannot become independent by starting a new session.
- Production uses the existing evaluator. A short reservation precedes AI work; finalization records evidence and the slot exactly once. Database transactions are not held during AI calls. Leases allow retries after interruption.
- A completed production slot never reports a different sentence as graded. Requests competing for the same slot wait/retry instead of overwriting newer work.
- Published companion content is checked against the actual task sources, including dialogues, instructions, examples and distractors. Stale content is withheld from new sessions and Smart Review. Existing authorized snapshots remain unchanged.
- Publishing requires the exact draft revision returned by the reviewed save. Replacing a draft during review or publication cannot silently publish another editor's changes.
- Session reads and writes recheck account, enrollment, expiry and course scope after acquiring the user lock. V1 additionally rechecks that its source lesson's companion is still published (a new v1 session also needs the lesson to pass readiness; a running one keeps its stored snapshot when the source changes); an issued v2 session uses its persisted version and immutable snapshot, so disabling the v2 allowlist does not revoke it. Account erasure takes the same lock; production checks access before reservation and again after evaluation.
- Student UI restores completed/revealed states, wrong counts and production results. Hints and explanations are escaped before display. Revising a sentence preserves the original text in the input; earlier attempts stay in history.
- The shadow policy tracks independent, assisted and limited production separately. Assisted or unknown production cannot satisfy the proposed independent-production requirement. Active mastery remains unchanged.
- Account erasure deletes request records and sessions; session deletion cascades to production snapshots and item state.

## Verification commands

Run the existing backend test command: `npm --prefix backend test`.

The new session API and safety regression suites run on the same local `TEST_DATABASE_URL` used by CI, inside unique disposable schemas. They never read `DATABASE_URL`. For local environments without a PostgreSQL server, an explicitly supplied `PGLITE_TEST_MODULE` file URL can run them against in-memory PostgreSQL/WASM. If neither is available, those integration suites report a skip rather than a pass. PGlite verifies sequential SQL scenarios, not native PostgreSQL multi-connection concurrency.

Focused tests cover source invalidation, public/private state, request replays and conflicts, rollback on storage failure, exposure across sessions, production reservations, revoked access, named selectors, editor fingerprints, IME composition, feedback and resume.

## Rollback

For a companion issue on one lesson, select it in the status card on the AI tab and click **Tarik publikasi** (`POST /api/admin/lessons/:lessonId/bunpou-flow/unpublish` with `{ "confirm": true }`). It stops showing to students immediately, running v1 sessions for that lesson stop, and the draft is kept for republishing.

For a **v2 communication-flow** issue, the owner disables new v2 creation through `PUT /api/admin/settings/learning-flow-communication`, using the latest `expectedConfigRevision` and preserving the explicit ID lists. Already-active v2 sessions still resume and use their frozen internal step 5; account, enrollment, scope and expiry checks remain. Do not withdraw a companion expecting it to stop or rewrite v2 sessions. Keep migrations and accumulated records; do not delete attempts, sessions or reverse additive schema merely to disable a flow.
