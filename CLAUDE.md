# EzNihongo — Catatan untuk Claude

## Pending ops / infra (jadwal: minggu ini)

- [x] **Insiden: deploy PR #189 macet lalu gagal, PR #190 tidak ke-trigger
  sama sekali** (2026-08-26). Run CI job `ci` untuk merge PR #189
  (migration 100/101, commit `84be81f`) hang 15 menit (normalnya <60s)
  lalu `cancelled`, job `deploy` ikutan `skipped` → migration 100/101
  TIDAK ter-apply ke production meski sudah di GitHub `main`. Push
  berikutnya (merge PR #190, migration 102, commit `fbc1d7b`) bahkan
  sama sekali tidak memicu run "Deploy to VPS" baru (workflow run untuk
  sha itu tidak pernah muncul di `list_workflow_runs`) — kemungkinan
  besar terkait `concurrency: group: deploy-vps, cancel-in-progress: false`
  di `deploy.yml` yang antre di belakang run yang macet, lalu entah
  kenapa tidak pernah dijalankan setelah run itu selesai. Re-run manual
  via API (`rerun_workflow_run` / `rerun_failed_jobs`) ditolak 403
  ("Resource not accessible by integration") — token yang dipakai sesi
  ini tidak punya scope `actions:write`. Root cause CI hang belum
  diketahui (kemungkinan npm registry / GitHub-hosted runner transient
  issue, bukan bug di kode kita). **Kalau kejadian lagi**: cek
  `list_workflow_runs` untuk `deploy.yml` setelah tiap merge — jangan
  asumsikan merge = ter-deploy. Fix yang dipakai: push commit baru
  (bukan commit kosong) ke `main` supaya trigger run bersih.

- [ ] **Offsite backup ke Cloudflare R2** — `RCLONE_REMOTE` di
  `/var/www/eznihongo/backend/.env` masih kosong, jadi `backup.sh` cuma
  nge-dump lokal di `/var/backups/eznihongo/`. Risiko: kalau VPS hilang
  (disk corrupt / akun suspended / hacker `rm -rf`), backup ikut hilang.
  Setup: rclone config (s3, provider Cloudflare) → `RCLONE_REMOTE=r2:eznihongo-backups`
  di `.env` → test `sudo /var/www/eznihongo/backend/deploy/backup.sh` dan
  `sudo rclone ls r2:eznihongo-backups`. Lihat session sebelumnya untuk
  step lengkapnya.

- [ ] **GPG encryption pada dump** sebelum di-upload offsite. Dump berisi
  email user + raw webhook Midtrans (PII + payment data). Tambahkan
  `gpg --symmetric --cipher-algo AES256` di `backup.sh` sebelum
  `rclone copy`. Passphrase simpan di password manager, bukan di repo.
  Hanya relevan setelah offsite hidup.

- [ ] **`pg_dumpall --globals-only`** terpisah untuk role / grant. Saat ini
  `backup.sh` cuma dump database `eznihongo` — kalau VPS rebuild dari nol,
  role `eznihongo_app` + grant-nya harus dibikin manual dulu.

- [ ] **Test restore ke staging** — tulisan ini ga akan jadi backup beneran
  sampai pernah dicoba di-restore. Minimal sekali per bulan ke Postgres
  staging / container.

- [ ] **Ownership tabel kanji** di production. Migration 008 di-bypass
  via existence-gating (`pg_indexes` / `pg_trigger`), tapi root cause
  ownership masih ada — `kanji_users`, `kanji_sessions`, `subscriptions`,
  `kanji_progress` owned oleh role lain dari `eznihongo_app`.
  Sekali waktu, sebagai superuser:
  ```sql
  ALTER TABLE kanji_users      OWNER TO eznihongo_app;
  ALTER TABLE kanji_sessions   OWNER TO eznihongo_app;
  ALTER TABLE subscriptions    OWNER TO eznihongo_app;
  ALTER TABLE kanji_progress   OWNER TO eznihongo_app;
  ```
  Tanpa ini, migrasi masa depan yang butuh `ALTER TABLE` beneran (bukan
  no-op) bakal kena "must be owner of table" lagi.

- [ ] **SSH masih sebagai `root`** di pipeline deploy
  (`.github/workflows/deploy.yml`). User `deploy` + sudoers terbatas =
  hardening berikutnya, butuh perubahan di sisi VPS.

## Konvensi penting

- **Admin authz**: env `ADMIN_EMAILS` (bootstrap, anti-lockout, read-only dari
  UI) ∪ tabel `admin_emails` (migration 035, dikelola via tombol "Kelola Admin"
  di header `admin.html` — tambah/hapus tanpa edit `.env`/restart). Cek lewat
  `isAdminEmail()` (`backend/src/auth.js`) yang sekarang **async** (DB + cache
  TTL 15s, throw-safe: DB error → fallback env-only) — call site baru WAJIB
  `await` (Promise truthy = semua orang lolos cek). Endpoint:
  `GET/POST /api/admin/admins`, `DELETE /api/admin/admins/:email` (env admin &
  diri sendiri tidak bisa dihapus). Provisioning password co-admin tetap via
  `set-password` (email harus sudah admin).
- **Env**: produksi pakai `backend/.env`, semua var lewat `DATABASE_URL`
  (bukan `DB_PASSWORD` terpisah). systemd service + migration runner +
  backup script semua source dari file yang sama.
- **Migrasi**: tambah file SQL baru di `backend/migrations/`, runner
  (`run.js`) jalan dalam transaction per file, skip kalau sudah
  ke-record di `schema_migrations`. Untuk objek yang mungkin sudah
  ada dari `schema.sql` bootstrap, gate setiap `CREATE INDEX` /
  `CREATE TRIGGER` via `pg_indexes` / `pg_trigger` untuk hindari
  ownership check (lihat 008 sebagai contoh).
- **Pipeline deploy**: push ke `main` → CI parse-check → SSH ke VPS →
  `git reset --hard` + `npm ci --omit=dev` + `npm run migrate` +
  `systemctl restart eznihongo-api` + healthcheck loop ke `/api/health`.
- **Branch konvensi**: `claude/<topic>-<short-id>` untuk fitur Claude.
  PR ke `main`, tidak push langsung.
- **Sync progres lintas device (main site)** — progres "lesson selesai"
  (`ez_progress`) + skor kuis (`ez_quiz_scores`) di `welcome.html` disimpan di
  localStorage **dan** di-mirror ke server sebagai blob JSONB per user (tabel
  `user_learning_state`, migration 026), pola sama seperti `kanji_progress`.
  Endpoint `GET/PUT /api/learning-state` (`backend/src/routes/learning-state.js`,
  `requireAuth`). Frontend: `setProgress` + tulis skor kuis memicu
  `_scheduleCloudPush()` (debounce 1.2s → `PUT`); boot memanggil
  `syncLearningStateFromServer()` yang union-merge cloud↔local (completion
  monoton) sebelum render. XP/streak TIDAK ikut blob — tetap server-authoritative
  via `/api/stats/me`. Tabel relational `user_progress` (lesson UUID) sengaja
  tidak dipakai karena progres frontend di-key slug `"<moduleId>:<lessonId>"`.
- **Tipe pelajaran `deck`** (kosakata interaktif, migration 009): lesson
  bertipe `deck` punya kartu kosakata yang dipilih dari bank
  (`module_vocabulary`, bisa `lesson_id` NULL untuk item bank murni) lewat join
  `lesson_deck_items`; tiap kata punya `vocabulary_examples` (contoh kalimat,
  disimpan polos + kolom `highlight` + `reading` kana penuh per kalimat
  [migration 036, nullable tanpa backfill — frontend sembunyikan baris kana
  kalau kosong; generate-vocab-examples ikut mengisi `reading`; backfill contoh
  lama via tombol "✨ Generate kana (AI)" di Kelola Deck →
  `POST /api/admin/lessons/:id/generate-deck-readings` (Claude `ANTHROPIC_GEN_MODEL`
  per-deck, auto-save, idempoten/cuma isi yang kosong kecuali `force`; kalimat
  tanpa kanji di-set reading=japanese tanpa panggil AI)]). Admin kelola
  via tombol "Kelola Deck" di
  daftar pelajaran (`admin.html` → `manageDeck`). `welcome.html` me-render via
  `renderDeckLesson` (grid kartu + modal contoh kalimat, desain dari handoff
  "Kosakata"). API: `/api/admin/vocab-bank`, `/api/admin/vocabulary-examples`,
  `/api/admin/lessons/:id/deck-items`; `content.js` ngirim `lesson.deck`.
  **Video opsional per-deck**: lesson `deck` boleh mengisi `lessons.video_url`
  (kolom sudah ada, dipakai juga oleh tipe `video`/`kana` — tanpa migrasi). Field
  "Video URL (Bunny Stream)" di form admin kini tampil juga untuk tipe `deck`
  (`wireLessonTypeVisibility`). `renderDeckLesson` me-render iframe video di atas
  grid kartu kalau `videoUrl` terisi (pola sama dgn kana), kalau kosong **tidak**
  menampilkan placeholder. Admin tempel URL embed (Bunny Stream
  `iframe.mediadelivery.net/embed/...` atau YouTube `youtube.com/embed/...`).
- **Import kosakata dari Notion (per Bab)** — narik vocab **satu Bab** dari
  database Notion "📚 Vocabulary 語彙" (`Japanese 日本語` / `Reading 読み` /
  `Indonesian` / `Category` / `Note`, plus relasi `Lesson` → "📗 Bab") langsung ke
  deck satu pelajaran. Endpoint:
  - `POST /api/admin/lessons/:lessonId/import-notion-deck` ({ babPageId }) —
    filter `relation contains babPageId` di kolom `Lesson`, `upsertNotionVocab()`
    ke bank modul (upsert by `japanese` per modul: kata baru di-insert, kata yang
    sudah ada di-update `reading`/`indonesian`/`category`/`note`-nya dari Notion;
    `lesson_id` + wiring deck dibiarkan), terus append ke `lesson_deck_items`
    pelajaran itu (yang udah di deck di-skip). Tombol "↻ Import Bab dari Notion"
    di toolbar Kelola Deck → dropdown Bab dari `GET /api/admin/notion-bab`.
  - `GET /api/admin/notion-bab` — list Bab dari "📗 Bab" DB (`Bab` title /
    `Kode Bab` / `Nomor Bab`), sorted by `Nomor Bab`.
  (Dulu ada `POST /api/admin/import-notion-vocab` yang narik **semua** vocab ke
  bank modul — dihapus, ga praktis buat ribuan item.) Catatan: kolom `Reading 読み`
  di Notion deskripsinya "Hiragana/katakana reading or romaji" — kalau mau kana
  konsisten, rapihin di Notion lalu re-import. Butuh env `NOTION_TOKEN` (Internal
  Integration Secret, share **kedua** DB ke integration) + `NOTION_VOCAB_DB_ID`
  (default `bd1f0d912aa24b139b5e68f3610b7c51`); `NOTION_BAB_DB_ID` opsional
  (default `472c7178a513459caf536c30c1008b66`). Token kosong → 503. Pakai REST
  `api.notion.com/v1/databases/:id/query`, `Notion-Version: 2022-06-28`, paginate
  `start_cursor` (`notionQueryAll()` — helper di `backend/src/notion.js`,
  dipakai admin import + endpoint public di bawah).
- **Daftar Kosakata (public, per level, admin-synced)** — `welcome.html`
  "📒 Daftar Kosakata" baca dari `GET /api/notion-vocab?slug=n5`
  (file `backend/src/routes/notion-public.js`). Notion = **referensi**: read
  endpoint **tidak pernah** narik dari Notion, cuma serve cache. Refresh
  manual lewat admin button (`POST /api/admin/notion-vocab/refresh[/:slug]`,
  admin-only). Detail:
  - Filter Bab di Notion via `Kode Bab starts_with "N5-"` (slug di-upper),
    sequential per-Bab fetch vocab, sort by `Nomor Bab`.
  - **Section structure** dari curator page (env `NOTION_<SLUG>_PAGE_ID`,
    default N5 hardcoded). Pattern: paragraph bold = nama section,
    bulleted_list_item dengan link page = anggota Bab; synced_block tembus
    transparan. Hasil response shape:
    `{ sections: [{ name, bab: [{ kode, name, vocab: [...] }] }] }`
    atau fallback `{ bab: [...] }` kalau page-nya ga ada / gagal parse.
    Bab yg ga ke-reference di page masuk grup "Lainnya".
  - **Dua layer cache**: in-memory `Map` (hilang saat restart) + tabel
    `notion_vocab_cache` (`slug` PK + `payload` JSONB; migration 010). Tiap
    refresh sukses UPSERT — 1 row per slug, **tidak numpuk**. Refresh gagal
    → in-memory + DB row lama dipertahankan + `error` di-annotate.
  - Boot (`startNotionCacheRefresh()` di `server.js`): cuma `primeFromDb()`
    yg load DB → memory. **Tidak ada setInterval, tidak ada boot-time fetch
    ke Notion** (sengaja — biar admin kontrol kapan sync).
  - Frontend 2-level accordion (section → Bab → tabel) dgn mutex: cuma 1
    section bisa kebuka sekaligus, cuma 1 Bab dlm section aktif yg kebuka.
    Section pertama auto-open pas first render. Search auto-expand match.
  - Frontend fallback: kalau endpoint balas 502 (cache kosong) / fetch
    gagal, `openVocabList` jatuh ke aggregasi DB (vocab grouped by
    deck-lesson) terus ke `FLASHCARD_DATA`.
- **TTS ElevenLabs** (`backend/src/routes/tts.js`, `GET /api/tts?text=`):
  audio pelafalan untuk deck. Hasil di-cache di tabel `tts_cache` (bytea, ikut
  `pg_dump`, tahan `git reset --hard`) → API cuma dipanggil 1x per string unik.
  Env `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` / `ELEVENLABS_MODEL` (opsional,
  bukan `REQUIRED_ENV`); kalau kosong endpoint balas 503 & frontend fallback ke
  Web Speech browser. Endpoint cuma mau generate text yang ada di
  `module_vocabulary` (`japanese`/`reading`) / `vocabulary_examples`
  (`japanese`/`reading`) / `module_grammar` (`example`/`example_dialog`) (anti
  abuse kuota) + rate-limit. **Frontend kirim teks Jepang utama (kanji), bukan
  kana**: kartu kata (`playDeckAudio`) & contoh kalimat (`playDeckExample`)
  prefer `japanese` lalu fallback `reading` — pakai kalimat utama biar prosodi
  natural (dulu prefer `reading`/kana karena ElevenLabs kadang salah baca kanji
  ambigu; di-balik atas permintaan user). Ganti input reading↔japanese otomatis
  bikin cache entry baru (text beda = hash beda), tidak perlu bump
  `SETTINGS_VERSION`.
- **Tipe pelajaran `text` (Tata Bahasa / bunpou)** — materi teori grammar yang
  dibaca siswa sebelum Tugas Bunpou. Isi ajarnya BUKAN di `lessons.content`
  (welcome.html membungkusnya jadi `<p>${lesson.body}</p>`, jadi content diisi
  satu paragraf teks polos tanpa tag blok — `<p>`/`<ul>` akan pecah) melainkan
  di baris `module_grammar` yang `lesson_id`-nya menunjuk pelajaran itu;
  `content.js` mengelompokkannya jadi `lesson.grammar[]`, `welcome.html`
  `renderLessonGrammar()` merendernya sebagai kartu pola (pattern / meaning /
  blok "📝 Contoh" collapsible / notes). Tiap contoh kalimat = baris
  `grammar_examples` (migration 031; `japanese` sudah di-whitelist di
  `/api/tts` jadi tombol 🔊 per contoh langsung jalan). Baris `module_grammar`
  yang sama boleh dipakai dua-duanya: tampil di pelajaran Tata Bahasa (lewat
  `lesson_id`) DAN jadi soal Tugas Bunpou (lewat `lesson_grammar_task_items`).
  Seed Bab 12-20 ada di migrasi **081-089** (`0NN_bunpou_babNN.sql`): satu file
  per bab, dua pelajaran di **sort_order 4 dan 6** dengan slot 5 & 7 disisakan
  untuk dua Tugas Bunpou; judulnya `Tata Bahasa Bab N: Topik (pola1・pola2・…)`
  — daftar pola di dalam kurung dipisah ・, mengikuti gaya lesson buatan admin
  (mis. Bab 3 "Kalimat Identitas (です・じゃありません・ですか)"); pola yang
  bentuknya bukan formula bersih (mis. `Nai-form (konjugasi)`,
  `〜を[counter]お願いします`) memakai label pendek lewat key `short` di
  `v_pola`; pola di-find-or-create by `(module_id, pattern)`
  supaya bank yang sudah dibuat migrasi Tugas Bunpou (mis. 065 untuk Bab 12)
  dipakai ulang, bukan diduplikasi. Beda gaya dari 043-065: seluruh konten
  ditaruh di satu literal JSONB `v_pola` lalu di-upsert dalam satu loop.
  Tiap file punya assertion jumlah pola, minimal 2 contoh + terjemahan per
  pola, `sort_order` final 4/6 tanpa kembar, dan **pagar kanji** — contoh
  kalimat cuma boleh memakai kanji yang sudah diajarkan sampai bab itu
  (daftar kumulatif: 62 kanji Bab 3-11 dari migrasi 061 + kanji baru tiap bab
  dari header 070-078).
- **Tipe pelajaran `grammar_task`** (buat kalimat + ucapkan, dinilai AI;
  migration 023): lesson bertipe `grammar_task` memilih pola grammar dari bank
  modul (`module_grammar`) lewat join `lesson_grammar_task_items` (reusable —
  pola sama bisa dipakai di banyak tugas). Siswa membuat kalimat memakai pola
  itu lalu **mengucapkannya**: rekam di browser (`MediaRecorder`) →
  `POST /api/grammar-task/transcribe` (multipart) → **ElevenLabs STT (Scribe)**
  (`ELEVENLABS_API_KEY` yang sama; opsional `ELEVENLABS_STT_MODEL`, default
  `scribe_v1`). Kalau mic ditolak / STT 503 → fallback input ketik. Kalimat
  dinilai AI lewat `POST /api/grammar-task/evaluate` ({ grammarId, sentence }) →
  **Anthropic Claude** via raw `fetch` (`ANTHROPIC_API_KEY` opsional, bukan
  `REQUIRED_ENV`, kosong → 503; `ANTHROPIC_MODEL` default `claude-haiku-4-5`).
  Hasil di-cache di `grammar_eval_cache` (kalimat identik per grammar+instruksi
  ga panggil AI lagi). **Model tugas (admin-defined)**: tiap pola di
  `lesson_grammar_task_items` punya kolom `instruction` (perintah tugas, mis.
  "buat kalimat tentang kegiatan harianmu") + `required_count` (berapa kalimat
  yang harus dibuat siswa per pola; migration 024). Siswa harus menyelesaikan
  SEMUA kalimat (AI menilai `correct && usesPattern`) sebelum tombol "Tandai
  Selesai" aktif (gating di `gtUpdateComplete`; kalau AI 503 / tanpa pola →
  un-gate). Instruksi dikirim ke AI saat menilai (placeholder `{{instruction}}`,
  di-lookup server-side dari `lesson_grammar_task_items` via `lessonId`).
  **Prompt koreksi editable admin**: tabel `app_settings`
  (key `grammar_eval_prompt`), `GET/PUT /api/admin/settings/grammar-eval-prompt`,
  placeholder `{{pattern}}`/`{{meaning}}`/`{{example}}`/`{{instruction}}`/`{{sentence}}`
  (satu template global dipakai semua tugas; system prompt statis pakai
  `cache_control: ephemeral`). Admin kelola via tombol "Kelola Tugas Grammar"
  (`admin.html` → `manageGrammarTask`, picker dari `GET /api/admin/module-grammar`,
  edit instruksi + jumlah kalimat per pola). `welcome.html` me-render via
  `renderGrammarTaskLesson`; `content.js` ngirim `lesson.grammarTask` (termasuk
  `instruction`/`requiredCount`). API admin CRUD: `/api/admin/lessons/:id/grammar-task-items`.
  **Popup otomatis (opsional)**: lesson grammar_task bisa di-set kolom
  `lessons.popup_after_lesson_id` (migration 025; dropdown "Tampilkan otomatis
  setelah pelajaran" di form admin). Kalau di-set, tugas muncul sebagai **modal
  popup** begitu pelajaran pemicu di-`markCompleteAndNext`, dan **disembunyikan**
  dari daftar/sidebar + navigasi + hitungan progres (helper `gtIsPopupTask` /
  `visibleLessons` di `welcome.html`). Boleh ditunda: tutup popup tetap lanjut;
  pelajaran pemicu menampilkan banner "Kerjakan Tugas" (`gtPendingTaskFor` →
  `gtOpenTaskPopup` → `openGrammarTaskPopup`) sampai task selesai. Render kartu
  di-share via `gtCardsHtml`; complete popup (`gtPopupComplete`) menandai lesson
  task selesai + XP lalu lanjut.
- **Tutor Maneko-chan pakai Sonnet** — `backend/src/routes/tutor.js`
  (`POST /api/tutor/chat`) pakai `ANTHROPIC_TUTOR_MODEL` (default
  `claude-sonnet-4-6`, opsional di `.env`) — haiku terbukti halusinasi di
  penjelasan linguistik (contoh youon/sokuon ngaco, arti kata dikarang; lihat
  screenshot user Jul 2026). Ide routing haiku→sonnet via classifier ditolak
  user; keputusan: selalu sonnet, tanpa routing. Fitur siswa lain (grammar
  eval, coaching) tetap `ANTHROPIC_MODEL` (haiku). tutor.js sudah migrasi ke
  `callClaude()`. `TUTOR_SYSTEM` melarang markdown (bubble chat render teks
  polos via `S.esc`, tidak ada parser markdown), mewajibkan contoh Jepang
  akurat sesuai konsep, dan membatasi panjang jawaban (±6 kalimat / 5 poin,
  `max_tokens` 500). **Balasan gaya WhatsApp** (multi-bubble, permintaan user
  — BUKAN typewriter per-huruf, itu ditolak): jawaban dipecah per paragraf
  (pembatas baris kosong; prompt menyuruh model memecah jadi 1-3 pesan
  pendek), tiap paragraf muncul sebagai bubble terpisah dengan jeda "lagi
  ngetik" proporsional panjang (350ms+8ms/char, cap 1.2s). Transport tetap
  streaming: frontend kirim `stream: true` → backend `callClaudeStream()`
  (helper SSE di `anthropic.js`) meneruskan potongan sebagai chunked
  `text/plain` (header `X-Accel-Buffering: no` WAJIB — tanpa itu nginx
  mem-buffer respons proxy sampai selesai); paragraf yang belum utuh TIDAK
  ditampilkan (cuma titik typing), begitu utuh masuk antrian bubble
  (`AISenpai._enqueueBubbles`/`_drainSay` di welcome.html). Error sebelum
  byte pertama tetap JSON 502/503. Fallback otomatis ke JSON utuh kalau
  backend balas `application/json` (kompatibel dua arah saat deploy tidak
  serentak). PENTING: bubble AI beruntun di `S.chat` di-merge jadi satu
  pesan assistant saat membangun riwayat API (`send()`) — API Anthropic
  menolak role yang tidak berselang-seling.
- **Maneko-chan disembunyikan saat penilaian** — widget tutor (`#ai-senpai`,
  `window.AISenpai` di welcome.html) di-hide via `display:none` kontainer saat
  lesson aktif bertipe `quiz`/`grammar_task` dan saat popup tugas grammar
  terbuka (anti dipakai bantu jawab soal). Helper `setTutorHidden` /
  `updateTutorVisibility`; dipanggil dari `renderLesson` (router pusat semua
  navigasi lesson), `openGrammarTaskPopup`/`closeGrammarTaskPopup`, dan
  `AISenpai.init` (hormati flag kalau init jalan setelah render pertama).
  State chat & mode panel tidak disentuh — cuma visibilitas.
- **Analisis Belajar Bunpou (mastery per POLA grammar)** — migration **122**.
  Sebelum ini verdict AI di Tugas Bunpou DIBUANG setelah dirender: satu-satunya
  yang tersimpan adalah `grammar_eval_cache` yang global + anonim (hemat biaya
  AI, bukan sinyal belajar). Akibatnya server tidak pernah tahu tugas grammar
  sudah dikerjakan (klaim "selesai" cuma di localStorage), dan deteksi kelemahan
  cuma bisa bilang kategori "Tata Bahasa" lemah — tidak pernah pola YANG MANA.
  - **Identitas konsep tidak dibuat baru**: `module_grammar.id` sudah stabil dan
    dipakai bersama pelajaran Tata Bahasa (lewat `lesson_id`) DAN Tugas Bunpou
    (lewat `lesson_grammar_task_items`).
  - **Tabel baru `grammar_attempts`** — satu baris per kalimat yang dinilai
    (user/grammar/lesson, `source` production|controlled|recognition,
    `input_mode` speech|text, kalimat, correct/uses_pattern/passed, plus output
    terstruktur: `grammar_score`, `primary_error`, `error_types[]`, `severity`,
    `concept_signal`, `eval_source` ai|cache). SATU tabel, bukan pasangan
    attempts+results: satu submit = satu kalimat = satu verdict.
    **Pencatatan ada DI LUAR cabang cache** — kalau tidak, kalimat yang kebetulan
    sama dengan kalimat siswa lain hilang total dari analisis.
  - **Kolom `grammar_id`** ditambahkan ke `quiz_questions` (tautan opsional yang
    di-set admin lewat dropdown "Pola grammar yang diuji" di form soal kategori
    grammar) dan di-snapshot ke `quiz_question_results` (pola sama dgn
    `question_category` di migration 027). Nullable, TANPA backfill: seluruh
    soal Assignment Bab 1-20 tetap valid dengan NULL dan tetap dihitung di
    kategori grammar seperti biasa. Ini yang bikin soal pengenalan/latihan
    terkontrol ikut mengisi mastery **tanpa biaya AI** — penilaian opsi sudah
    deterministik di `progress.js`.
  - **Kontrak output AI** (`OUTPUT_CONTRACT` di `grammar-task.js`) sengaja
    ditaruh DI LUAR template yang bisa di-edit admin (`app_settings.
    grammar_eval_prompt`). Kalau bentuk JSON ikut di template, admin yang
    menyimpan prompt versi lama akan diam-diam mematikan seluruh klasifikasi
    error — persis "jebakan prompt membeku" migration 033. Pedagogi & nada milik
    admin, bentuk data milik server. Respons endpoint = **superset** kontrak lama
    `{correct, usesPattern, feedback, correction}`, jadi frontend lama tetap
    jalan. Cache di-namespace `grammar-eval-v2|` supaya entri lama (4 field)
    tidak disajikan setengah jadi; entri lama jadi dorman, bukan salah.
    `grammar-task.js` sekalian migrasi dari raw `fetch` ke `callClaude()`.
  - **Normalisasi server-side**: tipe error di luar whitelist → `other`,
    `grammarScore` di-clamp 0-100, severity/conceptSignal tak dikenal → null.
    Klasifikasi bersifat PENJELAS — model mastery digerakkan `passed`, jadi
    taksonomi yang berisik tidak merusak analisisnya. `transcription_issue`
    diturunkan ke `other` untuk kalimat yang DIKETIK (`applyInputMode`), dan
    percobaan yang gagal karena salah dengar STT dibuang dari agregasi — salah
    dengar mesin bukan kegagalan grammar. Kesalahan grammar TIDAK PERNAH jadi
    kelemahan kosakata: percobaan grammar hanya mengisi konsep grammar.
  - **Model mastery** (`backend/src/grammar-mastery.js`, sadar-keyakinan): 12
    percobaan terbaru dalam 180 hari, bobot half-life 45 hari. **Persentase baru
    keluar setelah 3 percobaan** (`score: null` di bawah itu → UI tidak punya
    angka untuk mengklaim "86% dikuasai" dari satu-dua percobaan). State:
    UNSEEN / LEARNING (<3) / NEEDS_PRACTICE (wa<0.55 atau **dua percobaan
    terakhir gagal**) / PROGRESSING / MASTERED (≥4 percobaan, wa≥0.85,
    effectiveN≥2.5, percobaan terakhir lulus). Aturan **recovery**: dua
    percobaan terakhir lulus DAN lulus ≥ separuh percobaan → tidak lagi
    NEEDS_PRACTICE (peluruhan 45 hari terlalu lambat untuk mengakui retry yang
    berhasil beberapa hari lalu; syarat separuh menahannya dari memaafkan 2
    keberhasilan di antara 6 kegagalan). `dueReview` (retensi Level D) sengaja
    TIDAK disyaratkan `state === 'MASTERED'` — syarat effectiveN pada MASTERED
    sendiri meluruh, jadi konsep basi turun ke PROGRESSING lebih dulu dan
    bendera itu tidak akan pernah menyala; syaratnya "pernah kuat (wa≥0.85),
    sekarang >21 hari tak disentuh".
  - **Endpoint** (`backend/src/routes/grammar-analysis.js`, sisi BACA):
    `GET /api/grammar/mastery/lesson/:lessonId` (ringkasan + per-pola + satu
    `focus` + deep-link Tugas Bunpou) dan `GET /api/grammar/mastery/me`.
    Pola satu pelajaran diambil lewat LEFT JOIN + OR, **bukan cabang
    `lessons.type`** — migration 099 sudah mengubah 18 pelajaran Tata Bahasa
    Bab 12-20 dari `text` ke `video` tanpa menyentuh relasi grammar-nya.
    `/api/recommendations/me` dapat field baru `weakGrammar[]` (+ placeholder
    `{{weakPatterns}}` di prompt coaching; agregasinya dibungkus try/catch
    supaya panel lama tidak mati kalau 122 belum ter-apply).
  - **UI** (`welcome.html`): strip "Pemahaman Bunpou" tampil di DUA tempat —
    halaman Tata Bahasa (sebelum belajar: di mana posisiku) dan halaman Tugas
    Bunpou (di sinilah percobaan dibuat, jadi strip di-refresh otomatis
    ~1.5 detik setelah tiap kalimat dinilai lewat `scheduleBunpouAnalysisRefresh`,
    dan state panel yang sedang terbuka dipertahankan). Tombol "Latihan
    sekarang" disembunyikan kalau targetnya justru halaman yang sedang dibuka.
    Popup tugas TIDAK memuat strip (interstitial singkat), jadi titik status
    per pola dibuat opt-in lewat argumen ketiga `gtCardsHtml(items, sttOn,
    showDots)` supaya tidak jadi titik abu-abu tanpa makna di sana. Strip:
    (persen + bar + "N pola dikuasai · N perlu latihan" + tombol "Lihat
    analisis" yang membuka panel per-pola + satu kalimat fokus + tombol
    "Latihan sekarang"), plus titik status halus per kartu
    (🟢 Dikuasai / 🟡 Perlu latihan / 🔵 Sedang dipelajari / ⚪ Belum
    dianalisis). Dimuat SETELAH render dan gagal dalam diam. Istilah teknis AI
    (`wrong_particle` dst) TIDAK PERNAH ditampilkan ke siswa — dipetakan ke
    kalimat biasa lewat `ERROR_HINT`/`focusSentence`.
  - **Uji**: `node backend/scripts/test-grammar-analysis.mjs` (butuh
    `DATABASE_URL` ke database sekali-pakai; skrip men-TRUNCATE dan menolak
    jalan kalau nama DB tidak mengandung test/tmp/local/dev). 3 mode, 62
    assertion, mencakup 12 kasus: kalimat benar, salah pola target, salah
    partikel, salah konjugasi, elemen hilang, retry berhasil, gagal berulang,
    data belum cukup, AI mati, STT mati, Tugas Bunpou Bab 3-20 tetap jalan,
    kalimat identik dari cache.
  - **Tugas Bunpou 3 tahap** (permintaan user, menyusul rilis pertama):
    tiap pola kini punya Step 1 **Recognition** ("Apa fungsi 〜は〜です?",
    pilihan ganda dari ARTI pola lain di bab yang sama) → Step 2 **Controlled
    Practice** (kalimat contoh dengan bagian berpolanya dikosongkan, pilihan
    ganda bentuk) → Step 3 **Production** (buat kalimat sendiri + ucapkan,
    sistem lama yang tidak diubah). Step 4 = kartu umpan balik dirinci per
    aspek (Grammar benar / Pola digunakan / Makna sesuai + Masalah / Kalimatmu
    / Seharusnya + tombol "Coba lagi"); Step 5 = retry & re-test, sudah
    dilayani model mastery (aturan recovery + `dueReview` + weakness →
    rekomendasi).
    - **Tanpa tabel baru dan tanpa AI**: soal Step 1 & 2 DITURUNKAN
      deterministik dari materi yang sudah ada (`module_grammar.meaning` +
      `grammar_examples.japanese/.highlight`) di `backend/src/grammar-drills.js`.
      Karena penurunannya fungsi murni, server **menurunkan ulang** soalnya saat
      menilai → kunci jawaban tidak pernah dikirim ke browser (`publicDrill()`
      membuang `correctIndex`) dan tidak ada tabel soal yang perlu disinkronkan.
      Urutan opsi diacak dengan hash berseed (FNV-1a), bukan `Math.random`,
      supaya soal yang dinilai persis soal yang dikirim.
    - **Pengecoh sadar-bentuk** (`FORM_RULES`): keluarga masu / desu / nai /
      tai / te, lalu tukar-partikel, lalu tempel-partikel. Urutan penting —
      `んで` (bentuk te 読んで) dicek SEBELUM partikel `で`, kalau tidak
      pengecohnya jadi "読んは". Untuk kata benda hasilnya persis pola yang
      diminta user: がくせい / がくせいの / がくせいを.
    - **Klasifikasi error gratis**: aturan yang membangun pengecoh sudah tahu
      jenis kekeliruannya, jadi jawaban salah langsung tercatat sebagai
      `wrong_particle` / `wrong_conjugation` / `meaning_mismatch` tanpa AI —
      ikut mengisi "fokus berikutnya" di panel analisis.
    - **Endpoint**: `GET /api/grammar-task/lesson/:lessonId/drills` dan
      `POST /api/grammar-task/drill-answer`. Percobaan masuk `grammar_attempts`
      dengan `source='recognition'|'controlled'` (kolomnya memang sudah
      disiapkan di migration 122) — **tidak ada migrasi baru**.
    - **Penguncian ada di UI, bukan server**: Step 2 terbuka setelah Step 1
      lulus, Step 3 setelah Step 2. Server sengaja tetap permisif supaya alur
      produksi Bab 3-20 yang sudah live tidak bisa terkunci oleh bug frontend.
      Setelah `GT_MAX_WRONG` (2) kali salah, jawaban dibuka dan tahap
      berikutnya dilepas — siswa tidak boleh mentok permanen di pilihan ganda.
    - **Pengecoh Step 1 yang dikurasi** (migration **124**, kolom
      `module_grammar.recognition_distractors`, TEXT satu per baris). Pengecoh
      turunan (arti pola LAIN di bab yang sama) terbukti terlalu mudah: untuk
      〜の〜 pengecohnya bicara soal も dan ね/よ, jadi bisa dieliminasi tanpa
      memahami の sama sekali. Kolom ini menampung fungsi yang SALAH untuk pola
      ITU SENDIRI (mis. "menandai objek kalimat"). Di-generate SEKALI per pola
      lewat tombol "🎯 Pengecoh" di editor grammar admin
      (`POST /api/admin/module-grammar/:id/generate-distractors`,
      `ANTHROPIC_GEN_MODEL`), di-review admin, lalu disimpan
      (`PUT .../distractors`; `GET .../distractors` untuk memuatnya kembali).
      **Siswa tidak pernah memicu AI untuk soal pilihan ganda.** Prompt-nya
      mengirim fungsi pola lain di bab itu sebagai daftar-HINDARI (kalau
      pengecoh kebetulan mendeskripsikan pola lain, soalnya jadi ambigu) dan
      melarang menyebut pola targetnya sendiri (itu membocorkan jawaban);
      server juga membuang baris yang memuat pola target atau menyalin arti
      yang benar. Kosong = kembali ke penurunan lama, jadi pola yang belum
      di-generate tetap jalan.
    - **Arti pola DISEMBUNYIKAN sampai Step 1 dijawab** (`gtSetMeaningHidden`).
      Jawaban Step 1 = `module_grammar.meaning`, dan teks itu juga tercetak di
      kepala kartu tugas — rilis pertama menampilkan keduanya sekaligus,
      sehingga soalnya cuma mencocokkan teks yang ada tepat di atasnya. Kalau
      endpoint drills gagal (`gtUnlockAllSteps`), arti tetap tampil seperti
      semula. Opsi juga dipendekkan ke kalimat pertama (`shortMeaning`) supaya
      panjang keempatnya sebanding — opsi yang jauh lebih panjang jadi petunjuk
      jawaban tanpa siswa perlu paham apa pun.
    - **Pengecoh Step 1 diambil se-BAB, bukan se-tugas** (`deriveDrills(items,
      pool)` + `loadModulePool()`). Tiap bab dipecah jadi dua Tugas Bunpou dan
      yang kedua sering cuma berisi 2 pola (mis. Bab 13 tugas 2 =
      〜てもいいですか + 〜てはいけません, lihat 090). Dengan pool sebatas tugas
      itu cuma menyisakan 1 pengecoh — di bawah ambang minimum — sehingga Step 1
      HILANG diam-diam di sekitar separuh Tugas Bunpou. Rilis pertama kena ini;
      diperbaiki dengan memperluas pool ke seluruh `module_grammar` bab itu
      (juga lebih tepat pedagogis: yang perlu dibedakan adalah pola-pola yang
      baru dipelajari di bab itu). Endpoint daftar soal DAN endpoint penilaian
      memuat pool dengan cara identik supaya penurunannya tetap deterministik.
    - **Degradasi**: pola tanpa `meaning` (atau tanpa pola pembanding di bab
      yang sama) tidak dapat Step 1; contoh tanpa kalimat tidak dapat Step 2 —
      tahapnya disembunyikan dan tahap berikutnya langsung terbuka. Endpoint
      drills gagal total → `gtUnlockAllSteps()` membuka Step 3 apa adanya.
    - **Cakupan Bab 3-11**: backfill migration 031 menyalin
      `module_grammar.example` ke `grammar_examples` TANPA `highlight`, jadi bab
      lama akan kehilangan Step 2. Ditutup oleh `deriveHighlight()` yang
      mengambil potongan literal terpanjang dari polanya sendiri (mis.
      `〜てください` → `てください`, `〜は〜です` → `です`) selama potongan itu
      benar-benar muncul di kalimatnya. Bab 12-20 tidak terpengaruh — 138/138
      contohnya sudah punya highlight.

  - **Belum dikerjakan (sengaja)**: latihan terkontrol (Level B) sebagai tipe
    soal tersendiri. Yang ada sekarang tulang punggung datanya (`grammar_id` di
    soal kuis + `source='controlled'` di `grammar_attempts`); UI drill-nya
    follow-up terpisah, bukan ditebak sekarang.

- **`quiz_attempts.completed_at` sempat salah dideklarasikan** `NOT NULL
  DEFAULT NOW()` di `schema.sql` — diperbaiki migration **123**. Seluruh kode
  attempt memperlakukan kolom itu sebagai penanda "sudah disubmit"
  (`/quiz/start` INSERT tanpa mengisinya; `/quiz-attempt` menutup attempt lewat
  `WHERE completed_at IS NULL`; `lessonAttemptStatus` ORDER BY ... NULLS LAST),
  jadi di database hasil bootstrap `schema.sql` bersih SETIAP submit kuis
  ditolak 409 `already_submitted` — Assignment Bab 1-20 mustahil diselesaikan.
  Produksi tidak terpengaruh (skemanya sudah nullable, submit jalan normal);
  123 no-op di sana dan cuma menyamakan environment baru, termasuk uji restore
  ke staging yang masih terbuka di daftar di atas. Ditemukan saat menguji 122.

- **Belajar adaptif (deteksi kelemahan + rekomendasi)** — panel "Fokus
  belajarmu" di dashboard siswa (`welcome.html`): akurasi per kategori
  (`vocabulary`/`grammar`/`listening`) + pelajaran untuk diulang + catatan
  coaching AI dari Maneko-chan. Fondasi: handler submit kuis
  (`POST /api/progress/lesson/:id/quiz-attempt`) sekarang **mem-persist hasil
  per-soal** (benar/salah + `question_category` di-snapshot) ke tabel
  `quiz_question_results` (migration 027) — sebelumnya `correctByQuestion`
  cuma dihitung lalu dibuang, jadi tidak ada granularitas kategori. Best-effort
  insert (error tidak menggagalkan submit). **Tanpa backfill**: histori baru
  terkumpul untuk attempt setelah deploy. Endpoint
  `GET /api/recommendations/me` (`backend/src/routes/recommendations.js`,
  `requireAuth`): agregasi akurasi per kategori (lookback 90 hari, weak =
  akurasi < 70% DAN ≥ 8 soal — di bawah itu `insufficientData`), pilih kategori
  terlemah, lalu pelajaran kandidat (ter-`user_enrollments`, memuat soal
  kategori itu, skor terbaik < passing atau belum pernah; LIMIT 3). **Catatan
  coaching AI**: prompt editable admin (`app_settings.coaching_note_prompt`,
  placeholder `{{studentName}}`/`{{weakCategory}}`/`{{accuracyPct}}`/`{{lessonTitles}}`;
  tab "AI" di `admin.html`), persona Maneko-chan, di-cache di
  `coaching_note_cache` per "weakness signature" (akurasi di-bucket 5%) seperti
  `grammar_eval_cache`. `ANTHROPIC_API_KEY` kosong / gagal → fallback catatan
  berbasis-aturan (`noteSource:'rule'`), endpoint **tidak pernah 503**. Helper
  Claude bersama baru `backend/src/anthropic.js` (`callClaude()`); dua call-site
  lama (grammar-task/admin generate) belum dimigrasi (follow-up; tutor sudah). Frontend:
  `loadRecommendations()` dipanggil dari `renderLearning`, render via
  `recoPanelHtml`; lesson rekomendasi (UUID dari API) dicocokkan via `l.apiId`
  lalu `selectLesson(moduleSlug, lessonSlug)`. Panel disembunyikan kalau belum
  ada data kuis.
- **Kategori soal kuis** (`quiz_questions.question_category`): 4 nilai —
  `vocabulary` (Moji-Goi), `grammar` (Tata Bahasa), `reading` (Dokkai),
  `listening` (Menyimak). Kategori `reading` + kolom `passage` ditambah di
  migration 028, dibatalkan di 029, lalu **direstorasi di migration 034**
  (user minta dokkai untuk generator JLPT). Label dikelola di 3 tempat
  sejajar: `QUIZ_CATEGORY_LABELS` (admin.html), `QUIZ_CATEGORY_META`
  (welcome.html), `CATEGORY_LABEL` (recommendations.js); plus array kategori
  hardcoded di welcome.html (tabs/finder/stats `byCategory`/`RECO_CAT_ORDER`)
  & admin.js (`QUIZ_CATEGORIES`, ORDER BY CASE) — kalau nambah kategori lagi,
  grep semua. CHECK constraint `quiz_questions_category_check`.
  **Passage (dokkai)**: kolom `quiz_questions.passage` per-soal (denormalized
  — semua soal satu bacaan menyimpan string IDENTIK); welcome.html me-render
  blok `.quiz-passage` sekali di atas grup soal ber-passage sama (per-grup
  dalam section, bukan per-section — satu mondai bisa berisi beberapa bacaan).
  Admin: passage di-set section-level via form Edit Section (kategori
  reading), section PUT meng-update passage semua soal section.
- **Generator soal JLPT per-mondai (vocab/grammar/dokkai)** — tombol
  "✨ Generate JLPT" di header Kelola Kuis (`admin.html` → `openJlptGen`),
  saudara dari generator listening. Satu run = satu tipe mondai
  (`JLPT_GEN_TASKS` di `backend/src/routes/admin.js`, 11 tipe): Moji-Goi
  漢字読み/表記/文脈規定/言い換え類義/用法(N4), Bunpou 文の文法1/文の組み立て(★)/
  文章の文法(cloze wacana), Dokkai 短文/中文/情報検索. Endpoint
  `POST /api/admin/lessons/:lessonId/generate-jlpt`
  ({ taskType, level, count, topic }); `count` = jumlah soal, KECUALI tugas
  ber-passage: dokkai = jumlah bacaan (短文 1 soal, 中文 2-3, 情報検索 2 per
  bacaan), 文章の文法 = 1 wacana dgn `count` blank. Tugas ber-passage: AI
  balas `{"passages":[{passage,questions:[...]}]}`, di-flatten server-side
  (passage identik per grup). Validasi struktural per tipe
  (`_validateJlptQuestion`/`_normalizeJlptOptions`): 漢字読み wajib `<u>…</u>` +
  opsi hiragana-only, 組み立て wajib ★ + ≥3 `＿＿`, 文章の文法 wajib `（①）`,
  用法 question = kata saja + semua opsi memuatnya, dst — draft melanggar
  dibuang. Grounding vocab+grammar modul + anti-duplikat per kategori. Prompt
  wrapper editable (`app_settings.jlpt_gen_prompt`,
  `GET/PUT /admin/settings/jlpt-gen-prompt`, placeholder sama dgn listening;
  modal hanya memuat nilai custom). Simpan → section kategori-nya, nomor =
  nomor mondai (label+instruksi mondai auto; section existing dipertahankan).
  **Generator bulk lama ("✨ Generate AI" per pelajaran) DIHAPUS dari UI** —
  endpoint `generate-quiz` + settings `quiz-gen-prompt` masih ada di backend
  (deprecated, tanpa pemanggil; hapus di cleanup berikutnya). Konsekuensi:
  generate fill_blank via AI tidak ada lagi (buat manual).
- **Generate opsi pilihan ganda (AI)** — tombol "✨ Generate opsi (AI)" di editor
  soal admin (`openQuestionForm` → `quizGenOptions`): kirim pertanyaan +
  (listening: audio script) ke `POST /api/admin/generate-question-options`
  (`callClaude` di `backend/src/anthropic.js`) → 4 opsi (1 benar) + penjelasan
  diisi ke form. `ANTHROPIC_API_KEY` kosong → 503 (manual tetap jalan). Penjelasan
  prompt-nya WAJIB Bahasa Indonesia (bukan Jepang). **Tombol per-draft juga ada di
  modal review generator JLPT & Listening** (`admin.html` → `jlptGenRenderPreview`/
  `listenGenRenderPreview` → `window.jlptGenOptions`/`listenGenOptions` →
  core `genDraftOptions`): regenerate opsi+penjelasan agar match pertanyaan yang
  SUDAH diedit (baca dari DOM: pertanyaan `${prefix}_q_${i}`, listening pakai audio
  script `lg_audio_${i}` terbaru, JLPT reading pakai `_jlptGenDrafts[i].passage`),
  re-use endpoint yang sama. Baris opsi dirender via helper bersama `genOptionRows`
  (dipakai render awal + regenerate, jaga id `${prefix}_opt_${i}_${j}` konsisten
  dgn `jlptGenSave`/`listenGenSave`). Beda dari `quizGenOptions`: penjelasan
  SELALU ditimpa (bukan cuma kalau kosong).
- **Generate soal listening gaya JLPT (AI)** — tombol "🎧 Generate Listening
  JLPT" di header modal Kelola Kuis (`admin.html` → `openListeningGen`). Satu
  run = satu tipe mondai JLPT N5/N4: 課題理解 / ポイント理解 / 発話表現 /
  即時応答 (struktur per tipe di-hardcode di `JLPT_LISTENING_TASKS`,
  `backend/src/routes/admin.js`). Endpoint
  `POST /api/admin/lessons/:lessonId/generate-listening`
  ({ taskType, level, count, topic }) → draft soal LENGKAP: `audioScript`
  dialog 3-voice format `N:/A:/B:` (kerangka JLPT: narator bacakan
  situasi+pertanyaan → dialog → pertanyaan diulang; untuk 発話表現/即時応答
  script HANYA 1 baris situasi/ucapan — opsi TIDAK dibacakan karena tampil
  di layar; `parseDialog` di tts.js terima dialog 1-turn, SETTINGS_VERSION
  v7) + pertanyaan + opsi (4 utk mondai 1/2, 3 utk mondai 3/4) + penjelasan.
  Grounding vocab/grammar modul + anti-duplikat
  (baris situasi soal listening existing dikirim sbg avoid). Validasi server:
  `parseDialog()` harus kenal script-nya, max 1400 char (< MAX_TEXT_LEN tts
  1500), `question` dipangkas ke 1 baris tanpa prefix speaker, dialog mondai
  1/2 wajib ≥3 turn dgn pembicara A DAN B (anti semua-narator), mondai 3/4
  max 2 turn. Frontend siswa (`welcome.html renderQuizPaperItem`): teks
  pertanyaan listening yg persis ada di `audioScript` (= dibacakan narator)
  disembunyikan sampai dijawab (hint 🎧), reveal bareng transkrip di
  `pickQuizAnswer`. Draft di-review admin (bisa 🔊 test audio per draft via
  `/admin/tts/preview` sebelum save) → simpan via POST /admin/quiz-questions ke
  section listening nomor = nomor mondai (label+instruksi mondai auto-set;
  kalau section sudah ada, label/instruksi existing dipertahankan dan
  sort_order di-append). Prompt wrapper editable admin
  (`app_settings.listening_gen_prompt`,
  `GET/PUT /api/admin/settings/listening-gen-prompt`, placeholder
  `{{count}}/{{level}}/{{taskName}}/{{taskRules}}/{{levelRules}}/{{topic}}/{{vocab}}/{{grammar}}/{{avoid}}`);
  aturan per-mondai & per-level tetap di kode. **Model generator soal**:
  generate-jlpt + generate-listening pakai `ANTHROPIC_GEN_MODEL` (default
  `claude-sonnet-4-6`) — haiku terbukti gagal terus di 組み立て (semua draft
  ditolak validasi permutasi); fitur siswa (tutor/grammar eval/coaching)
  tetap `ANTHROPIC_MODEL` (default haiku). Generator kuis bulk lama
  (`generate-quiz`) juga di-update: prompt default format dialog + contoh JSON
  menyertakan 1 soal listening lengkap (model suka meniru contoh — dulu contoh
  `audioScript:""` bikin script kosong), draft listening tanpa script yang
  lolos `parseDialog` dibuang server-side, preview admin pakai `<textarea>`
  (dulu `<input>` — newline dialog di-collapse browser → single voice),
  draft listening bulk wajib struktur JLPT penuh (≥3 turn + ada N + A + B,
  menolak output "N sebagai tokoh"). **Jebakan prompt membeku** (textarea
  prompt dulu prefilled default → sekali "Simpan Prompt", default lama beku
  di `app_settings` dan perbaikan default berikutnya ga kepakai) sudah
  ditutup: migration 033 menghapus `quiz_gen_prompt`/`listening_gen_prompt`
  tersimpan (one-time reset), dan kedua modal kini hanya memuat nilai
  custom (kosong = default server terbaru).
- **Generate contoh kalimat (AI) untuk kosakata deck** — tombol "✨ Generate
  contoh (AI)" di modal Kelola Deck → Contoh (`deckManageExamples` →
  `deckGenExamples`): `POST /api/admin/generate-vocab-examples` ({ vocabularyId,
  count }) di-grounding ke kata di `module_vocabulary` → daftar
  `{ japanese, highlight, indonesian }` ditambahkan sebagai baris BELUM tersimpan
  (admin review lalu Simpan per baris ke `vocabulary_examples`). `callClaude`;
  `ANTHROPIC_API_KEY` kosong → 503.
- **Multi contoh + terjemahan untuk pola grammar** (migration 031) — tabel
  baru `grammar_examples` (mirror `vocabulary_examples`: japanese / highlight /
  indonesian / sort_order, FK ke `module_grammar`). Backfill dari kolom legacy
  `module_grammar.example` (dipertahankan untuk fallback). Admin kelola via
  tombol "📝 Contoh" per baris grammar (`grammarManageExamples`) — pola sama
  persis dgn deck kosakata. Generator AI multi: `POST /admin/generate-grammar-examples`
  (pattern + meaning + avoid[], pola sama dgn `generate-vocab-examples`).
  Endpoint CRUD: `/admin/grammar-examples`. content.js (`GET /api/courses/:slug`)
  meng-attach `g.examples[]` per grammar; `welcome.html renderLessonGrammar`
  prefer examples[] dgn fallback ke `g.example`.
- **Terjemahan dialog grammar (parallel per-baris)** — kolom baru
  `module_grammar.example_dialog_id` (TEXT, struktur paralel N:/A:/B: persis
  dialog Jepang). Admin field di GRAMMAR_FIELDS + tombol "✨ Translate"
  (`grmrTranslateDialog`) memanggil `POST /admin/generate-dialog-translation`
  → Claude bikin terjemahan dgn prefix sama jumlah baris. Frontend
  `parseDialogIdMap` cocokkan per-line index dgn dialog Jepang; render di bawah
  tiap turn (`.gk-line-id` / `.gk-narrator-id`, italic kecil gray). Kerja
  paralel — kalau ID baris kurang/lebih dari JP, baris yg nggak match cuma
  tidak menampilkan terjemahan (no crash).
- **Generate gambar ilustrasi (AI) untuk kosakata** — tombol "✨ Gambar" di
  Kelola Deck (per baris): `POST /api/admin/generate-vocab-image`
  ({ vocabularyId, force? }) → **OpenAI gpt-image-1** (quality=low,
  ~$0.011/gambar) via raw fetch → bytes disimpan di `vocab_image_cache`
  (BYTEA, 1 row per kosakata, ikut `pg_dump`; migration 030). Preview modal di
  admin (`deckShowImagePreview`); regenerate dgn `force=true`. Public serve di
  `GET /api/vocab-image?vocabularyId=...` (`backend/src/routes/vocab-image.js`,
  cache-control 24h, 404 kalau belum generate). Env baru `OPENAI_API_KEY`
  (opsional; kosong → 503). Frontend siswa belum render gambar (follow-up):
  butuh `has_image` flag di `content.js` lesson payload + `<img>` di deck card.
  Kalau volume bytes besar (>500 MB) migrate ke object storage (R2).
- **Seeding struktur Bab (kurikulum tidak ada di repo)** — modules / lessons /
  module_vocabulary / kanji_items hidup di DB produksi, jadi tiap bab dibangun
  lewat migrasi SQL berisi konten hasil tarik dari Notion. Patokan struktur =
  Bab 3-10: Pengantar (`video`) → Kosakata 語彙 (`deck`) → Kanji 漢字 (`kanji`)
  → Tata Bahasa (`text`) → 2 Tugas Bunpou (`grammar_task`) → Assignment
  (`quiz`, 50 soal). Migrasi 039-060 mengisi tugas bunpou + assignment Bab
  1-11; **070-078 mengisi tiga pelajaran pertama Bab 12-20** (generator dipakai
  sekali di sesi itu; file SQL-nya yang jadi source of truth). Pola resolusi
  modul di 070-078: ordinal `OFFSET (bab-1)` — judul yang tidak cocok cuma
  memicu NOTICE (judul produksi bergaya "BAB 12: Bentuk Te : Konjugasi &
  Permintaan", beda dari judul Notion), ordinal tetap dipercaya seperti
  039-065; modul baru **hanya** dibuat kalau ordinalnya memang tidak ada,
  sekalian isi metadata kurikulum (title_en / CEFR / JF topic / scenario /
  cando_statements) yang masih kosong. Tiga pelajaran itu selalu di
  sort_order 1/2/3, pelajaran lain digeser ke 4..n. Kanji di-insert
  per-pelajaran (character + jlpt_level + lesson_id, sesuai migration 064) —
  jangan pakai `ON CONFLICT (character, jlpt_level)`, index itu sudah tidak
  ada.
  Migrasi **081-089 mengisi materi Tata Bahasa Bab 12-20** — dua pelajaran
  bertipe `text` per bab (sort_order 4 dan 6), pola dari dokumen kurikulum
  "EzNihongo — Daftar Grammar 文法 (JLPT N5 + N4)" bagian N5-B12…B20 (46 pola,
  138 contoh kalimat). Detail pola ini di bagian **Tipe pelajaran `text`
  (Tata Bahasa)** di bawah.
  **Sisa pekerjaan Bab 12-20**: (a) ~~deck kosakata Bab 17-20 masih
  kosong~~ — dikoreksi user (2026-08-27): sudah terisi, klaim lama di
  sini keliru/basi (kemungkinan sudah diisi manual lewat Kelola Deck →
  "↻ Import Bab dari Notion" setelah catatan ini ditulis, sesi ini tidak
  verifikasi ulang mana yang persis terisi — cek langsung di admin kalau
  perlu detail per-bab); (b) Bab 13 belum punya kanji di
  Notion (kolom "Kanji First Introduced" kosong). Assignment Bab 12-20
  SUDAH LENGKAP (migration 100/104/103/105/106/107/108/109/110; 102
  digantikan 104 untuk data production, lihat catatan Assignment Bab 13
  di bawah) — seri Assignment ini selesai per Bab 20 (2026-08-27).
  **Tugas Bunpou Bab 13-20** diisi migrasi **090-097** (satu file per bab,
  `0NN_grammar_task_babNN.sql`) — mengisi slot sort_order 5 & 7 yang sengaja
  disisakan kosong oleh 082-089 (Bab 12 sendiri sudah ditangani lebih dulu
  oleh 062/065, sebelum seri 081-089 ada). Pola split pertama/kedua tugas
  SAMA PERSIS dengan split pelajaran Tata Bahasa terkait (mis. Bab 14 = 4+3
  pola), dan bank `module_grammar` di-FIND-OR-CREATE dengan pattern string
  persis sama dengan 081-089 supaya reuse baris yang sudah ada (bukan
  duplikat) — INSERT fallback-nya hanya kepakai kalau baris itu ternyata
  terhapus. Penomoran ulang ke sort_order 5 & 7 pakai ROW_NUMBER atas urutan
  relatif (pola yang sama dengan 048-065), bukan nilai sort_order literal,
  jadi aman dijalankan berapa pun gap yang sudah ada. Divalidasi end-to-end
  dengan menjalankan seluruh rantai migrasi (000-097) di Postgres lokal
  sekali pakai (course + 20 modul dummy) sebelum commit — semua 8 file
  applied bersih, tanpa duplikat pola, posisi final 5/7 persis seperti yang
  diklaim tiap `RAISE NOTICE`.

- [ ] **Tugas Bunpou Bab 12 kehapus DUA KALI** dari production (setelah
  062, lalu setelah restore 065) — di-restore lagi via migration **098**
  (`098_grammar_task_bab12_restore2.sql`, logika identik 062/065, sudah
  divalidasi lewat simulasi hapus+restore di Postgres lokal). File itu
  sendiri sudah menutup insiden ini, tapi ROOT CAUSE penghapusan berulang
  belum diketahui — cek dulu sebelum bikin restore ketiga: apakah ada
  admin/proses yang menghapus lesson `grammar_task` Bab 12 secara rutin
  (mis. tombol hapus di "Kelola Deck"/lesson list ke-pencet tidak sengaja,
  atau ada script/cron yang keliru). Kalau terhapus lagi untuk ketiga
  kalinya, jangan cuma re-run pola restore — investigasi dulu.

- [ ] **18 lesson Tata Bahasa Bab 12-20 di-set `type='video'`** via migration
  **099** (`099_bunpou_text_to_video.sql`), permintaan user — murni ubah
  kolom, TANPA perubahan kode. Efeknya saat ini: masih tampil placeholder
  statis "Video akan segera tersedia" di `welcome.html` (lesson type
  `video` biasa TIDAK baca `video_url`, beda dari `deck`/`kana` yang sudah
  ada wiring iframe-nya) dan form admin belum expose field Video URL untuk
  hasil ubahan ini kecuali `wireLessonTypeVisibility` sudah otomatis
  menampilkannya karena type-nya memang `video`. Kartu pola grammar
  (module_grammar + grammar_examples) TETAP tampil seperti biasa karena
  render-nya independen dari `lessons.type`. `video_url` belum diisi
  (belum ada link saat migrasi ini ditulis) — kalau video-nya sudah siap,
  perlu tambahan kerjaan: (a) admin isi `video_url` per lesson lewat form
  (field-nya sudah otomatis muncul untuk type video), TAPI (b) `welcome.html`
  masih perlu diubah supaya lesson type `video` non-deck/kana benar-benar
  merender iframe dari `video_url` alih-alih placeholder — belum dikerjakan.
  **Konvensi judul lesson** (dirapikan di migration 079 — sebelumnya
  Assignment/Tugas Bunpou Bab 1-12 pakai em dash, tidak konsisten dengan
  Pelajaran intro/deck/kanji yang pakai titik dua): `Tipe Bab N: Topik`
  (titik dua, BUKAN em dash) — mis. `Assignment Bab 13: Topik`,
  `Tugas Bunpou Bab 13: Topik`. Tiga pelajaran pertama **polos tanpa prefix
  `Pelajaran N:`** (dirapikan di migration 080 — sidebar `welcome.html` sudah
  merender nomor urutnya sendiri, jadi "87. Pelajaran 1: Pengantar" itu dua
  angka yang artinya beda): `Pengantar` (video) / `Kosakata 語彙` (deck) /
  `Kanji 漢字` (kanji). Import Notion mengkanonikalisasi sendiri lewat
  `canonicalPelajaranTitle()` (`backend/src/routes/admin.js`, dipakai di
  `import-notion-pelajaran`), jadi penamaan "Pelajaran N:" di Notion tidak
  perlu diubah. Cek drift kapan saja lewat section 5 di
  `backend/scripts/audit-bab-structure.sql`.
  **Jangan rename `lessons.slug`** saat merapikan judul — progres siswa di
  localStorage di-key slug (`"<moduleId>:<lessonId>"`), rename = progres tereset.
  Audit cepat kondisi produksi: `backend/scripts/audit-bab-structure.sql`
  (read-only, 4 laporan: jenis pelajaran per bab, bab yang menyimpang,
  pelajaran kosong, bank vocab/grammar).

- [ ] **Regresi judul em dash di 090-097 (Tugas Bunpou Bab 13-20)** — ditulis
  belakangan setelah migration 079 menetapkan konvensi titik dua, tanpa
  sengaja balik pakai em dash lagi (mis. `'Tugas Bunpou Bab 13 —
  Progresif & Permintaan'`). Sumber file 090-097 sudah diperbaiki ke titik
  dua langsung, dan migration **101**
  (`101_normalize_tugas_bunpou_title_separator.sql`) menjalankan ulang
  regex generik 079 (`^(Assignment|Tugas Bunpou) Bab [0-9]+ — `) untuk
  merapikan baris yang sudah kadung ter-apply di production dengan title
  em dash (termasuk Bab 12 dari 062, yang juga sempat kena regresi ini).
  Kalau menulis migrasi Assignment/Tugas Bunpou baru lagi, JUDUL WAJIB
  titik dua dari awal — jangan andalkan normalizer lagi.

- **Assignment Bab 12: Bentuk Te** diisi migration **100**
  (`100_assignment_bab12_te_form.sql`), pola sama persis dengan
  039-061 (50 soal: 漢字読み 9 + 表記 9 + 文脈規定 12 + 文の文法1 20,
  ditampilkan semua tiap attempt, lulus 70%, cooldown 12 jam, di
  sort_order 100 tanpa penomoran ulang). Dua catatan desain khusus Bab 12
  dibanding 039-061:
  - **Pagar kata kerja DIHAPUS** (bukan diperluas seperti biasa) — Bab 12
    adalah bab konjugasi kata kerja itu sendiri (bentuk te), jadi regex
    lama yang melarang token `ます|ました|...|いて` justru melarang materi
    inti bab ini (`いて` adalah hasil sah く→いて, `ます`/`ました` wajib
    muncul sebagai kata kerja terakhir di pola 〜て、〜). Pagar kanji tetap
    berlaku penuh dan itu yang menahan kosakata di luar level.
  - **Jebakan pagar "rantai の"** (assertion 4, regex `の[^。]*の` terhadap
    kolom `question` mentah termasuk isi `<u>…</u>`, bukan cuma badan
    kalimat): kata majemuk yang secara kebetulan punya dua の di dalam satu
    kata (`のみもの` = の-み-も-の) FALSE POSITIVE ke-flag sebagai "chain
    の" walau bukan partikel berantai. 039-061 diam-diam menghindari ini
    dengan taruh kata seperti itu HANYA di options/penjelasan, tidak pernah
    di teks `question`. Migrasi 100 awalnya kena ini di draft pertama
    (soal もんだい2 表記 target `のみもの`) — diganti ke `のみました`
    (hanya satu の) sebelum lolos. Kalau menulis soal baru dengan kosakata
    ber-の ganda dalam satu kata, taruh di options saja, jangan di
    `question`.
  Divalidasi end-to-end: simulasi penuh di Postgres lokal (course + 12
  modul dummy, replay 081→062→100→101 di atas modul Bab 12) — 50 soal
  applied bersih, semua opsi tepat 4 dengan 1 kunci benar, pagar kanji +
  dedup 159 target lolos, dan 101 berhasil menormalkan 2 judul em dash
  dari 062.

- **Assignment Bab 13: Progresif, Permintaan & Izin** diisi migration
  **102** (`102_assignment_bab13_progresif_izin.sql`), pola sama persis
  dengan 100 (50 soal, sort_order 100, pagar kata kerja tetap dihapus —
  Bab 13 masih keluarga te-form). Karena Bab 13 TIDAK memperkenalkan kanji
  baru (dikonfirmasi header 082), whitelist kanji-nya SAMA PERSIS dengan
  100. Draf awal もんだい1/2 sempat REVIEW kanji lama (読/書/見/食/飲 dari
  Bab 10-12, sama seperti pola 061) tapi user menandai ini bikin Assignment
  Bab 12 dan 13 terasa "kanji-nya sama" — **direvisi** (lihat migration 104
  di bawah) supaya もんだい1/2 memakai kanji LEBIH LAMA (車・花・電車・道・駅,
  sebelum Bab 12) untuk variasi, digabung dengan 4 pola grammar Bab 13
  (ています/てください/てもいいですか/てはいけません; てくれませんか tetap
  hanya di もんだい1 文の文法1). DEDUP array diperluas jadi 177 target (159
  dari 042-061 + 18 dari 100). Divalidasi end-to-end: replay penuh
  081→062→100→082→090→102→104→083→091→103 di atas modul Bab 12+13+14
  dummy — semua assignment applied bersih berdampingan, semua opsi 4/1
  kunci, pagar level + dedup lolos, tidak ada tabrakan target antar bab.

- **Revisi kanji Assignment Bab 13** — migration **104**
  (`104_assignment_bab13_kanji_variety_fix.sql`) memperbaiki DATA
  PRODUCTION yang sudah menjalankan 102 versi lama (ter-deploy lewat PR
  #191, jadi tidak akan re-run otomatis). Sumber 102 SUDAH diedit langsung
  di repo (fresh install lewat 000-104 benar sejak awal); 104 me-replay
  DELETE+INSERT 50 soal yang IDENTIK dengan 102 versi baru ke lesson slug
  yang sama, pola sama dengan 101 (perbaikan judul 090-097 yang sudah
  live) dan 065 (restore konten yang sudah live). もんだい1/2 baru:
  車をもっています／花がさいています／電車にのっています／道をあるいています／
  駅でまっています (ています, 5) + 電車にのってください／道をあるいてください
  (てください, 2) + 車をつかってもいいですか (てもいいですか, 1) +
  花をとってはいけません (てはいけません, 1), verba dieja kana (持/咲/乗/歩/
  待/使/取 tidak ada di whitelist taught kanji, pola sama dengan 行 di 100).
  **Jebakan pagar "rantai の" varian baru**: draft pertama memakai konteks
  "つぎの 電車にのってください" — "つぎの" (の pertama) + "のって" (verba
  乗る bentuk te, の kedua) = dua の dalam satu kalimat, ke-flag assertion 4
  padahal bukan partikel の berantai yang sebenarnya (mirip jebakan
  "のみもの" di migration 100, tapi kali ini dari KOMBINASI kata konteks +
  verba, bukan satu kata majemuk). Diganti ke "えきで 電車にのってください"
  (tanpa の di konteks). Kalau menulis soal baru dengan verba yang KANA-nya
  kebetulan diawali の (のる/のみます/dst), hindari taruh kata ber-の lain
  (つぎの/あの/この kalau ada の, dst) di konteks kalimat yang sama.

- **Assignment Bab 14: Bentuk Nai & Bentuk Plain** diisi migration **103**
  (`103_assignment_bab14_nai_plain.sql`), pola sama persis dengan 100/102
  (50 soal, sort_order 100, pagar kata kerja tetap dihapus). Bab 14
  memperkenalkan 4 kanji BARU — 立(たつ)・休(やすむ)・入(はいる)・出(でる)
  — kanji baru pertama sejak Bab 12, jadi もんだい1/2 untuk PERTAMA KALINYA
  sejak itu diisi 100% kanji baru bab itu sendiri (bukan review kanji lama),
  digabung dengan 3 bentuk konjugasi juga baru di Bab 14 (nai-form, bentuk
  kamus, bentuk ta plain) — sengaja TIDAK memakai 3 pola lain
  (ないでください／なければなりません／なくてもいいです) di もんだい1/2
  karena itu bentuk fungsi-kalimat, bukan penentu bacaan kanji; ketiganya
  tetap diuji di もんだい1 文の文法1. Whitelist kanji = whitelist 100/102
  UNION 立休入出. DEDUP array diperluas jadi 195 target (177 dari 042-100 +
  18 dari 102). Divalidasi end-to-end: replay penuh
  081→062→100→082→090→102→083→091→103 di atas modul Bab 12+13+14 dummy —
  ketiga assignment applied bersih berdampingan, semua opsi 4/1 kunci,
  pagar level + dedup lolos.

- **Assignment Bab 15: Bahasa Pelayanan & Perubahan** diisi migration
  **105** (`105_assignment_bab15_pelayanan_perubahan.sql`), pola sama
  persis dengan 100/104/103 (50 soal, sort_order 100). Bab 15
  memperkenalkan 7 kanji BARU — 言(いう)・話(はなす)・聞(きく)・買(かう)・
  店(みせ)・会(あう)・社(かいしゃ, cuma dipakai dalam 会社) — tapi BEDA
  dari Bab 14: keenam pola grammar Bab 15 adalah FRASA TETAP (〜を…お願い
  します／〜はいかがですか／〜になります／お〜ください／〜にします／
  〜くなります・〜になります), bukan keluarga konjugasi kata kerja satu
  akar seperti nai/kamus/ta Bab 14, jadi memaksakan もんだい1/2 mengikuti
  salah satu pola grammar tidak alami. もんだい1/2 diisi KOSAKATA POLOS
  (言います／話します／聞きます／買います／会います／お店／電話／会社／
  店の人) gaya 039-061, kembali ke pendekatan sebelum Bab 12-14 yang
  memang bertema konjugasi. Ke-6 pola grammar tetap diuji penuh di もんだい1
  文の文法1 (split 4/3/3/4/3/3) — 4 pola berbentuk frasa tetap
  (お願いします／いかがですか／になります／にします) memakai opsi
  CROSS-PATTERN (opsi salah = 3 frasa tetap lain, gaya JLPT 文法 asli
  menguji pemilihan pola yang tepat untuk konteks, bukan konjugasi), 2 pola
  lain (お〜ください, 〜くなります/〜になります) tetap self-contained
  seperti 100/102/103. もんだい3 pakai 12 kosakata fungsional dari bank
  Bab 15 (073), SEMUA ditulis kana/katakana polos (bukan kanji) karena
  section itu tidak pakai `<u>` — seluruh kolom question kena pagar
  whitelist dan kanji seperti 現/計/約/屋/物 belum diajarkan. Whitelist
  kanji = whitelist 100/104/103 UNION 言話聞買店会社 (sama persis dengan
  `v_kanji_ok` di 084). **DEDUP diperbaiki metodenya** di migrasi ini:
  daripada menyusun array secara incremental dari catatan migrasi
  sebelumnya (pendekatan yang di sesi sebelumnya sempat salah hitung
  karena pola glob shell keliru melewatkan file 039 dan 055), array
  sekarang di-grep ULANG PENUH dari seluruh file migrasi assignment
  039-104 yang benar-benar ada di repo (215 target unik). Divalidasi
  end-to-end: replay penuh
  081→062→100→082→090→102→104→083→091→103→084→092→105 di atas modul Bab
  12+13+14+15 dummy — keempat assignment (Bab 12/13/14/15) applied bersih
  berdampingan, semua opsi 4/1 kunci, pagar level + dedup lolos. Sempat
  kena jebakan pagar "rantai の" varian ketiga saat menulis もんだい3: kata
  kerja pasif "たのまれたら" (mengandung の di suku kedua) dan もの (juga
  mengandung の) masing-masing digabung dengan "店の人" dalam satu kalimat
  → dua の. Diganti ke "おねがいされたら" dan "メニューを" (keduanya tanpa
  の) untuk soal 20 dan 26.

- **Assignment Bab 16: Waktu & Tanggal** diisi migration **106**
  (`106_assignment_bab16_waktu_tanggal.sql`), pola sama persis dengan
  100/104/103/105 (50 soal, sort_order 100). Bab 16 memperkenalkan 6 kanji
  BARU — 日・火・水・木・金・土 (nama hari; 曜 belum diajarkan, jadi
  "ようび" selalu kana). もんだい1/2 diisi KOSAKATA POLOS gaya 105: 7 nama
  hari (日ようび～土ようび, 月 sendiri sudah taught lama tapi disertakan
  supaya siklus 7 hari lengkap) + 2 frasa tanggal (何月何日／六月三日,
  menguji bacaan khusus tanggal 3 = みっか). もんだい1 文の文法1 (split
  5/5/5/5) menguji 4 pola: 〜に (partikel waktu) diuji DUA ARAH — waktu
  berangka (jam/hari/bulan) WAJIB に (soal 31-33) vs waktu relatif
  (あした／まいにち) JUSTRU TIDAK memakai に (soal 34-35), opsi salah
  +を/+で/+ni yang salah; 〜月〜日 (36-40) opsi salah tanggal lain yang
  mirip (angka digeser), termasuk bacaan khusus tanggal 20 = はつか;
  毎週／毎月／毎年 (41-45) opsi cross-pattern +毎日 (kata sungguhan tapi di
  luar 3 pola resmi bab ini); 何曜日／何月何日／いつ (46-50) opsi
  cross-pattern +何時. もんだい3 pakai 12 kosakata waktu relatif dari bank
  Bab 16 (074) — あした／きのう／あさって／せんげつ／らいげつ／こんげつ／
  きょねん／らいねん／しゅうまつ／せんしゅう／らいしゅう／こんしゅう,
  SEMUA kana polos (bank 074 punya banyak kata lain seperti 明日／今日／
  来月 yang memakai kanji 明／今／来 yang belum diajarkan). Whitelist kanji
  = whitelist 100/104/103/105 UNION 日火水木金土 (sama persis dengan
  `v_kanji_ok` di 085). **Metode dedup lanjut disempurnakan**: array
  di-grep ulang penuh dari 039-105 seperti 105, TAPI proses grep sempat
  ke-tangkap 2 baris PALSU dari komentar migration 105 sendiri (placeholder
  literal `<u>...</u>`/`<u>…</u>` di teks penjelasan, bukan target soal
  sungguhan) — sudah difilter manual sebelum dipakai (233 target bersih).
  **Pelajaran untuk migrasi berikutnya**: comment placeholder yang
  menyerupai pola tag target ikut ter-grep dan HARUS di-cross-check/filter
  manual, jangan asumsikan hasil grep otomatis bersih. Divalidasi
  end-to-end: replay penuh
  081→062→100→082→090→102→104→083→091→103→084→092→105→085→093→106 di atas
  modul Bab 12+13+14+15+16 dummy — kelima assignment (Bab 12-16) applied
  bersih berdampingan, semua opsi 4/1 kunci, pagar level + dedup lolos,
  kanji tested antar bab semuanya berbeda (Bab12: 読書見食飲行; Bab13:
  車花電車道駅; Bab14: 立休入出; Bab15: 言話聞買店会社; Bab16: 日火水木金土).

- **Assignment Bab 17: Suka & Mahir** diisi migration **107**
  (`107_assignment_bab17_suka_mahir.sql`), pola sama persis dengan
  100/104/103/105/106 (50 soal, sort_order 100). Bab 17 memperkenalkan 9
  kanji BARU — 子・父・母・友・手・足・口・目・耳 (keluarga & bagian tubuh)
  — tapi 好・嫌 (suki/kirai) BELUM diajarkan, jadi すき／きらい selalu
  kana. もんだい1/2 diisi KOSAKATA POLOS 9 kanji baru (父／母／友だち／手／
  足／口／目／耳／子ども), gaya 105/106 — 4 pola grammar Bab 17
  (〜が好きです・〜が上手です・〜ができます・どんな〜) sama sekali tidak
  butuh kanji baru untuk diuji (partikel が + kata tanya どんな), jadi
  tidak dipaksakan ke もんだい1/2. **Jebakan whitelist baru ditemukan**:
  soal draf awal memakai "大きいです" (mata besar) sebagai konteks di
  luar tag, tapi 大 TERNYATA TIDAK ADA di whitelist meski "大学"/"大学生"
  sudah lama jadi target dedup historis — kanji di DALAM tag `<u>` tidak
  pernah dicek terhadap whitelist (assertion 1 cuma cek badan kalimat DI
  LUAR tag), jadi 大学/大学生 lolos dulu sebagai TARGET tapi 大 tidak
  pernah benar-benar ditambahkan ke whitelist "bebas dipakai di luar tag".
  Pelajaran: jangan asumsikan kanji yang muncul di ARRAY DEDUP otomatis
  aman dipakai bebas di badan kalimat — selalu cross-check terhadap
  whitelist string yang sebenarnya. Diganti ke "わるいです" (kana, tidak
  butuh kanji). もんだい1 文の文法1 (split 5/5/5/5) menguji partikel が di
  3 pola pertama (〜が好きです／嫌いです・〜が上手です／下手です・
  〜ができます — semua opsi salah seragam を/に/で supaya siswa fokus pada
  SATU nuansa partikel), dan どんな vs kata tanya lain (どう/なに/だれ) di
  pola ke-4. もんだい3 pakai 12 kosakata umum bertema suka/mahir/hobi
  (すき／きらい／だいすき／だいきらい／じょうず／へた／とくい／どんな／
  りょうり／うた／え／おんがく) — Bab 17 BELUM punya bank kosakata resmi
  (075 cuma seed kanji_items, bukan module_vocabulary), jadi dipilih
  kosakata umum N5 yang tematik, bukan dari bank existing. Whitelist kanji
  = whitelist 100/104/103/105/106 UNION 子父母友手足口目耳 (sama persis
  dengan `v_kanji_ok` di 086). Divalidasi end-to-end: replay penuh
  081→062→100→082→090→102→104→083→091→103→084→092→105→085→093→106→086→094→107
  di atas modul Bab 12+13+14+15+16+17 dummy — keenam assignment (Bab
  12-17) applied bersih berdampingan, semua opsi 4/1 kunci, pagar level +
  dedup lolos.

- **Assignment Bab 18: Perbandingan** diisi migration **108**
  (`108_assignment_bab18_perbandingan.sql`), pola sama persis dengan
  100/104/103/105/106/107 (50 soal, sort_order 100). Bab 18 memperkenalkan
  4 kanji BARU — 大(おお)・小(ちい)・多(おお)・少(すく), semuanya kata
  sifat い ukuran/jumlah (番 dari いちばん belum diajarkan, selalu kana).
  Beda dari 105/106/107 (Bab 15-17, kanji baru = kata benda → kosakata
  polos): kanji baru Bab 18 adalah kata SIFAT い yang alami dikonjugasi,
  jadi もんだい1/2 kembali ke pola KONJUGASI (bentuk kini + bentuk lampau
  かった) seperti 100/103 (Bab 12/14). **CATATAN PENTING**: 大 di bab ini
  BARU RESMI masuk whitelist badan-kalimat — di 107 (Bab 17) 大 sengaja
  dihindari di luar tag karena waktu itu belum taught (lihat jebakan
  whitelist di 107); sekarang boleh dipakai bebas. もんだい1 文の文法1
  (split 5/5/5/5) menguji 4 pola: AはBより〜です／AよりBのほうが〜 (opsi
  salah partikel lain と/の/が), AとBとどちらが〜 (opsi salah どれ/なに/だれ
  — menegaskan nuansa "どれ untuk ≥3 pilihan" dari catatan grammar 087),
  dan 〜の中で〜が一番〜 (opsi salah なか/より/のほうが). もんだい3 pakai
  12 kosakata umum (4 musim dari bank Bab 16 yang belum pernah dites + 4
  transportasi + 4 makanan) karena Bab 18 belum punya bank kosakata resmi.
  **Jebakan pagar "rantai の" varian keempat — PALING LUAS ditemukan di
  migrasi ini**: draft awal ke-flag di 8 dari 30 soal もんだい1-3, semuanya
  dari kombinasi kata umum yang SENDIRI-SENDIRI wajar tapi kalau digabung
  jadi dua の: (1) この + あの dalam satu kalimat perbandingan ("この 本は
  あの 本より..." — pola PERSIS dari contoh di 087_bunpou_bab18.sql
  sendiri!) → diganti nama kota/benda konkret tanpa この/あの; (2) くだもの
  (berakhiran の) + の posesif → "くだものの中で" = 2 の → diganti やさい
  (tidak berakhiran の); (3) のりもの (mengandung DUA の SEKALIGUS di
  dalam satu kata: の-ri-mo-no) — bahkan SENDIRIAN tanpa kata lain pun
  sudah melanggar assertion, mirip のみもの (100) tapi ini kasus kata
  benda umum, bukan kuliner → dihapus total dari kolom question, diganti
  "それは" generik; (4) にほんの/インドの + たべもの (berakhiran の) → 2-3 の
  → salah satu の-nya dihapus dari kalimat. **Pelajaran kumulatif**: kata
  APAPUN yang berakhiran の (たべもの／のみもの／くだもの／のりもの／
  たてもの dst — pola umum kata benda bahasa Jepang "X-mono") otomatis
  jadi separuh dari rantai の begitu digabung dengan の lain di kalimat
  yang sama (posesif, この/あの/そのkalau ada, atau kata ber-の lain);
  cek MANUAL setiap kalimat baru yang memakai kata berakhiran の, jangan
  cuma andalkan pola yang "terlihat aman". Divalidasi end-to-end: replay
  penuh
  081→062→100→082→090→102→104→083→091→103→084→092→105→085→093→106→086→094→107→087→095→108
  di atas modul Bab 12-18 dummy — ketujuh assignment (Bab 12-18) applied
  bersih berdampingan, semua opsi 4/1 kunci, pagar level + dedup lolos.

- **Assignment Bab 19: Keinginan & Rencana** diisi migration **109**
  (`109_assignment_bab19_keinginan_rencana.sql`), pola sama persis dengan
  100/104/103/105/106/107/108 (50 soal, sort_order 100). Bab 19
  memperkenalkan 5 kanji BARU — 雨(あめ)・天(dalam 天気)・空(そら)・
  山(やま)・川(かわ), kata benda alam/cuaca (欲・予定 belum diajarkan,
  jadi ほしい／よてい selalu kana). もんだい1/2 diisi KOSAKATA POLOS gaya
  105/106/107 (bukan konjugasi, karena 6 pola grammar Bab 19 tidak butuh
  kanji baru untuk diuji): 雨／天気／空／山／川 + 3 kombinasi berakhiran
  satu の (雨の日／山の上／川の水, masing-masing HANYA satu の jadi aman
  dari jebakan rantai の) + あおい空 (reuse 空 dalam frasa berbeda).
  もんだい1 文の文法1 (split 4/3/3/3/3/4) menguji 6 pola: 〜たいです／
  〜たくないです (opsi salah bentuk ます/ません/ました dari verba yang
  sama), [noun]が欲しいです (opsi salah partikel を/に/で, konsisten
  dengan nuansa partikel が dari Bab 17), 〜つもりです vs 〜予定です
  (cross-pattern, menegaskan niat pribadi vs jadwal ditetapkan dari
  catatan grammar 088), dan 〜ましょう／ませんか (mengajak vs menyetujui
  ajakan). もんだい3 pakai 12 kosakata umum bertema keinginan/rencana/hobi
  (りょこう／かいもの／さんぽ／しごと／べんきょう／かいぎ／しゅみ／
  けいかく／よてい／つもり／きぼう／ゆめ) karena Bab 19 belum punya bank
  kosakata resmi. Whitelist kanji = whitelist 100/104/103/105/106/107/108
  UNION 雨天空山川 (sama persis dengan `v_kanji_ok` di 088). Draft PERTAMA
  KALI sejak migration 106 lolos tanpa revisi jebakan の-chain atau
  whitelist — kata-kata alam bab ini (雨/天気/空/山/川) kebetulan tidak
  berakhiran の dan tidak pernah perlu digabung dengan この/あの/kata
  ber-の lain dalam desain yang dipilih. Divalidasi end-to-end: replay
  penuh
  081→062→100→082→090→102→104→083→091→103→084→092→105→085→093→106→086→094→107→087→095→108→088→096→109
  di atas modul Bab 12-19 dummy — kedelapan assignment (Bab 12-19)
  applied bersih berdampingan, semua opsi 4/1 kunci, pagar level + dedup
  lolos.

- **Assignment Bab 20: Pengalaman & Penghubung Kalimat** diisi migration
  **110** (`110_assignment_bab20_pengalaman_penghubung.sql`) — BAB
  PENUTUP seri Assignment Bab 12-20, pola sama persis dengan
  100/104/103/105/106/107/108/109 (50 soal, sort_order 100). Bab 20
  memperkenalkan 2 kanji BARU — 来 dan 令. 来 ISTIMEWA karena punya DUA
  cara baca: らい (on-yomi, kata majemuk waktu 来年／来月／来週 — kata ini
  SEBELUMNYA selalu kana di 106/109 karena 来 belum taught, sekarang boleh
  kanji) dan き／く／こ (kun-yomi, verba tidak beraturan 来る "datang":
  来ます／来ました／来ません／来て／来ない). もんだい1/2 SENGAJA memakai
  7 dari 9 target untuk menguji KEDUA cara baca sekaligus (jebakan klasik
  JLPT — kanji yang sama, bacaan beda tergantung konteks), plus 令和
  (nama era, satu-satunya kata yang memakai 令 di level N5). もんだい1
  文の文法1 (split 4/4/4/4/4) menguji 5 pola penutup N5: 〜たことが
  あります／ありません (opsi salah bentuk ます/ました/ています dari verba
  sama), 〜から sebagai penanda SEBAB (opsi salah penghubung lain di
  posisi salah gramatikal: が/でも/そして), 〜が、〜 pertentangan di AKHIR
  kalimat pertama (opsi salah から/ので/と), dan そして／それから／でも
  (satu-satunya pola yang testable murni dari konteks makna — memilih
  penghubung antar-kalimat yang tepat berdasarkan hubungan logis kedua
  kalimat, bukan posisi gramatikal). もんだい3 pakai 12 kata keterangan
  umum N5/N4 yang menyertai kalimat pengalaman/pendapat
  (いちども／はじめて／もう／まだ／やっと／ぜんぜん／たぶん／もちろん／
  ぜひ／きっと／やっぱり／とても) karena Bab 20 belum punya bank kosakata
  resmi. Whitelist kanji = whitelist 100/104/103/105/106/107/108/109
  UNION 来令 (sama persis dengan `v_kanji_ok` di 089). Draft ini JUGA
  lolos tanpa revisi jebakan の-chain atau whitelist (kata-kata 来-based
  tidak berakhiran の). Divalidasi end-to-end: replay penuh
  081→062→100→082→090→102→104→083→091→103→084→092→105→085→093→106→086→094→107→087→095→108→088→096→109→089→097→110
  di atas modul Bab 12-20 dummy — SEMBILAN assignment (Bab 12-20, seri
  LENGKAP) applied bersih berdampingan, semua opsi 4/1 kunci, pagar level
  + dedup lolos, kanji tested antar bab semuanya berbeda (Bab12:
  読書見食飲行; Bab13: 車花電車道駅; Bab14: 立休入出; Bab15: 言話聞買店会社;
  Bab16: 日火水木金土; Bab17: 子父母友手足口目耳; Bab18: 大小多少; Bab19:
  雨天空山川; Bab20: 来令). **Seri Assignment Bab 12-20 selesai
  (2026-08-27)** — 450 soal total tersebar di 9 lesson, satu per bab,
  masing-masing menguji kanji baru bab itu sendiri tanpa tumpang tindih
  dengan bab lain.

- [x] **Assignment Bab 12-20 belum ada dokkai (読解) / listening (聴解)**
  — SELESAI (2026-08-27, migrasi 111-119, lihat catatan lengkap di bawah)
  — user (2026-08-27) menyadari Assignment 100/104/103/105-110 cuma
  menguji vocabulary+grammar (漢字読み/表記/文脈規定/文の文法1), padahal
  kolom `question_category IN ('reading','listening')` + `passage` +
  `audio_script` sudah lama ada (migration 012/013/034) dan dipakai fitur
  lain (generator JLPT dokkai/listening terpisah). Keputusan user: EXTEND
  lesson Assignment yang sudah ada (bukan lesson baru terpisah) — satu
  migrasi tambahan per bab, **111-119** (`111_assignment_bab12_dokkai_
  listening.sql` dst, satu file per bab, DELETE hanya menyasar
  `question_category IN ('reading','listening')` milik lesson itu supaya
  50 soal vocabulary/grammar dari 100/104/103/105-110 tidak ikut kehapus
  saat re-run). Tiap bab dapat tambahan tetap: もんだい4 読解 (1 passage
  pendek + 3 soal pemahaman) + もんだい5 聴解 (4 dialog INDEPENDEN,
  masing-masing audio_script sendiri, 1 soal per dialog) = 7 soal baru,
  total per Assignment naik 50→57; `questions_per_attempt` di-update ke
  jumlah baru supaya kebijakan "semua soal tampil tiap attempt" (established
  Bab 8/055) tetap berlaku.
  **Draft konten pakai subagent Opus** (permintaan user: "Put opus as sub
  agent as you need it") — Sonnet menulis SQL/migration/validasi seperti
  biasa, tapi teks Jepang passage+dialog di-draft Opus dulu untuk hasil
  lebih natural, lalu di-cross-check ulang lewat assertion SQL yang sama
  ketatnya dengan mondai vocabulary/grammar.
  **Assertion baru** (di luar 6 assertion existing 100/104/dst yang tetap
  berlaku utuh karena `WHERE lesson_id = v_lesson_id` mencakup semua soal):
  pagar kanji + rantai-の kini JUGA dicek pada kolom `passage` dan
  `audio_script` (bukan cuma `question` seperti soal vocabulary/grammar —
  makna kalimat sesungguhnya ada di dua kolom itu, `question` di mondai
  4/5 cuma kalimat tanya pendek), plus format tiap baris `audio_script`
  wajib `SPEAKER: teks` dengan SPEAKER cuma N/A/B (subset `SPEAKER_RE` di
  `backend/src/routes/tts.js` `parseDialog()`). Dedup `<u>` TIDAK berlaku
  di mondai 4/5 (tidak ada tag `<u>` sama sekali di sana).
  **Jebakan の-chain baru ditemukan saat drafting Bab 12 (111)**: kalimat
  narator standar gaya JLPT asli "男の人と女の人が話しています" itu SENDIRI
  adalah rantai の (男**の**人 + 女**の**人 = 2 の dalam satu kalimat) — jadi
  listening di semua bab 111-119 pakai NAMA (mis. ミナさん／たなかさん)
  untuk kedua pembicara di baris narator, BUKAN "男の人／女の人" generik.
  Bab 12 (111) selesai duluan sebagai percontohan: passage cerita rutinitas
  harian (te-form chaining 〜て、〜／〜てから) + 4 dialog listening,
  semuanya dalam whitelist kanji 100/081 (68 karakter) dan sengaja
  menghindari 〜てください／〜ています (baru diajarkan Bab 13) supaya tidak
  bocor materi bab depan. Divalidasi bersih tanpa revisi kanji/rantai-の
  pada draft pertama (Postgres lokal, replay 081→100→111 di atas modul
  Bab 12 dummy, re-run kedua dikonfirmasi idempoten — masih 57 soal, tidak
  dobel). Bab 13-20 (112-119) menyusul dengan pola identik.
  **Bab 13 (112) selesai** — grammar scope ています／てください／
  てくれませんか／てもいいですか／てはいけません (082_bunpou_bab13.sql),
  whitelist kanji SAMA PERSIS dengan Bab 12 (Bab 13 tidak memperkenalkan
  kanji baru). Passage: aturan perpustakaan (boleh/tidak boleh, tolong
  kembalikan buku). Listening: 4 dialog ミナさん／たなかさん／おかださん
  (nama yang sama dengan 111 untuk kontinuitas). Sengaja TIDAK memakai
  nai-form/bentuk plain/たことがあります/ましょう・ませんか/penghubung
  そして・それから・でも・〜が、 (semua itu Bab 14+) supaya tidak bocor
  materi depan. **Klarifikasi user setelah Bab 12/13**: level soal harus
  tetap N5 (jangan terlalu susah), dan BOLEH pakai grammar/kosakata/kanji
  dari bab-bab SEBELUMNYA sebagai kalimat pengantar/konteks soal (tidak
  perlu memaksakan tiap kalimat 100% dari bab itu sendiri) — sudah otomatis
  konsisten karena whitelist kanji memang kumulatif (bukan cuma kanji bab
  ini), tapi ini eksplisit meng-encourage makin sering pakai kosakata umum
  bab lama (学校／駅／花／先生 dst) sebagai konteks alih-alih memaksa tema
  sempit tiap bab. **Jebakan の tambahan dicatat**: この／あの／その／どの
  masing-masing SENDIRI mengandung satu karakter の (こ-の dieja hiragana)
  — aman dipakai sekali per kalimat, tapi kalau digabung dengan の lain
  (posesif, atau この+あの sekaligus) kena regex rantai-の yang sama;
  semua kalimat Bab 13 dicek manual max 1 の per kalimat. Divalidasi bersih
  tanpa revisi pada draft pertama (Postgres lokal, replay 081→104→112,
  idempoten). Bab 14-20 (113-119) menyusul dengan pola identik, level N5
  santai dan bebas pakai kosakata bab lama sebagai pengantar.
  **Bab 14 (113) selesai** — grammar scope V-ない／〜ないでください／
  〜なければなりません／〜なくてもいいです／V-kamus／〜た／〜なかった
  (083_bunpou_bab14.sql). 4 kanji baru Bab 14 (立休入出) ditambahkan ke
  whitelist (72 karakter total). Passage: aturan darmawisata sekolah
  (barang wajib vs opsional dibawa). Listening: 4 dialog ミナさん／
  たなかさん／おかださん. **Draft pertama (Opus) menyelipkan「でも、」
  sebagai penghubung kalimat di salah satu dialog** — dihapus manual
  sebelum commit karena そして／それから／でも (dan 〜が、〜 pertentangan)
  sengaja direservasi untuk Bab 20 (089_bunpou_bab20.sql); dua kalimat
  berdiri sendiri tanpa penghubung tetap gramatikal. **Jebakan の baru**:
  きのう (kemarin) mengandung karakter の di suku tengahnya (き-の-う) —
  sama seperti pola kata "X-mono", otomatis memakai jatah の kalimat itu;
  jangan digabung dengan この／あの／の posesif lain di kalimat yang sama.
  Divalidasi bersih setelah fix でも (Postgres lokal, replay 081→103→113,
  idempoten). Bab 15-20 (114-119) menyusul dengan pola identik — untuk
  draft berikutnya, tambahkan larangan eksplisit でも/そして/それから/
  〜が、〜 di prompt subagent (bukan cuma nama pola-nya, tapi juga kata
  penghubung netral "tapi/namun" apa pun) supaya jebakan yang sama tidak
  terulang.
  **Bab 15 (114) selesai** — grammar scope 〜を[counter]お願いします／
  〜はいかがですか／〜になります／お〜ください／〜にします／
  〜くなります・〜になります (084_bunpou_bab15.sql), konteks toko/resto.
  7 kanji baru Bab 15 (言話聞買店会社) ditambahkan ke whitelist (78/79
  karakter — subagent mengoreksi hitungan label prompt sebelumnya yang
  keliru bilang 79, string-nya sendiri identik dengan 105, cuma labelnya
  yang salah hitung). Catatan penting: 願 (dalam お願いします) TIDAK ada
  di whitelist, jadi selalu ditulis kana おねがいします — konsisten dengan
  105. Passage: transaksi kafe (pesan, ditawari, memutuskan, total harga).
  Listening: 4 dialog toko dengan nama ミナさん／たなかさん／おかださん／
  やまださん. **Larangan でも/そして/それから/〜が、〜 dieksplisitkan di
  prompt kali ini (pelajaran dari 113) dan berhasil — draft pertama bersih
  tanpa perlu revisi manual.** Divalidasi bersih pada draft pertama
  (Postgres lokal, replay 081→105→114, idempoten). Bab 16-20 (115-119)
  menyusul dengan pola identik, larangan grammar bab depan tetap
  dieksplisitkan tiap prompt.
  **Bab 16 (115) selesai** — grammar scope 〜に (partikel waktu titik
  spesifik)／〜月〜日／毎週・毎月・毎年／何曜日・何月何日・いつ
  (085_bunpou_bab16.sql). 6 kanji baru Bab 16 (日火水木金土) ditambahkan
  ke whitelist (84 karakter). 曜 (dalam ようび) tetap TIDAK diajarkan,
  selalu kana. **Jebakan baru ditemukan**: 京 (dalam 東京) JUGA tidak
  diajarkan (cuma 東 yang taught) — draft pertama sempat pakai 東京 kanji,
  diperbaiki ke とうきょう kana penuh sebelum commit. Passage: jadwal
  mingguan + tanggal ujian + rutinitas bulanan. Listening: 4 dialog
  bertema jebakan klasik JLPT choukai — beberapa hari/tanggal disebut
  dalam satu audio, siswa harus menyimak SAMPAI AKHIR untuk tahu yang
  benar-benar berlaku (dialog 2: rapat pindah dari 六月八日 ke 六月九日;
  dialog 4: kebiasaan 十二月 tapi tahun ini 一月十五日). Larangan
  でも/そして/それから/〜が、〜 tetap bersih tanpa revisi (kedua kalinya
  berturut-turut sejak larangan dieksplisitkan). Divalidasi bersih pada
  draft final (Postgres lokal, replay 081→106→115, idempoten). Bab 17-20
  (116-119) menyusul dengan pola identik.
  **Bab 17 (116) selesai** — grammar scope 〜が好きです／嫌いです (selalu
  kana すき／きらい — 好/嫌 TIDAK diajarkan meski jadi inti pola bab ini),
  〜が上手です／下手です, 〜ができます, どんな〜 (086_bunpou_bab17.sql).
  9 kanji baru Bab 17 (子父母友手足口目耳) ditambahkan ke whitelist (93
  karakter) — hanya 父・母・友・手 yang kepakai secara alami di konten
  suka/mahir ini (子/足/口/目/耳 dibiarkan untuk もんだい1/2 yang memang
  menguji vocab tersebut). Passage: perkenalan diri (suka musik, mahir
  piano, tidak mahir menyanyi). Listening: 4 dialog dengan jebakan khas
  JLPT — dialog 1 menguji beda 〜が すきです vs 〜が 上手です (kata paling
  sering disebut justru yang TIDAK mahir); dialog 2 melacak kemampuan 3
  orang berbeda (siswa harus mengaitkan subjek dengan levelnya
  masing-masing, bukan cuma menangkap kata kunci). Larangan
  でも/そして/それから/〜が、〜 tetap bersih tanpa revisi (ketiga kalinya
  berturut-turut). Divalidasi bersih pada draft final (Postgres lokal,
  replay 081→107→116, idempoten). Bab 18-20 (117-119) menyusul dengan
  pola identik.
  **Bab 18 (117) selesai** — grammar scope AはBより／AよりBのほうが／
  AとBとどちらが／〜の中で〜がいちばん (087_bunpou_bab18.sql). 4 kanji
  baru Bab 18 (大小多少) ditambahkan ke whitelist (97 karakter). 番 (dalam
  いちばん) tetap TIDAK diajarkan, selalu kana. **Jebakan の-chain
  TERBESAR ada di bab ini** (lihat catatan panjang di migration 108:
  この+あの digabung, kata "X-mono" seperti くだもの/のりもの) — kali ini
  larangan totalnya dieksplisitkan di prompt (hindari この/あの/その sama
  sekali, pakai nama toko/benda konkret untuk perbandingan) dan berhasil:
  draft pertama bersih tanpa SATU PUN revisi rantai-の, padahal bab paling
  rawan sejauh ini. Passage: perbandingan 3 toko roti (ukuran, harga,
  keramaian — sengaja toko terkecil yang paling ramai supaya jawaban
  tidak bisa ditebak dari satu fakta saja). Listening: 4 dialog dengan
  pola serupa (barang/transportasi/buah dipilih berdasarkan perbandingan,
  jawaban akhir sering tidak menyebut nama pilihannya secara eksplisit —
  siswa harus menyimpulkan dari "yang lebih murah/cepat" ke barangnya).
  Larangan でも/そして/それから/〜が、〜 tetap bersih (keempat kalinya
  berturut-turut). Divalidasi bersih pada draft pertama (Postgres lokal,
  replay 081→108→117, idempoten). Bab 19-20 (118-119) menyusul dengan
  pola identik.
  **Bab 19 (118) selesai** — grammar scope 〜たいです／〜たくないです／
  [noun]が欲しいです (selalu kana ほしいです — 欲 tidak diajarkan)／
  〜つもりです vs 〜予定です (selalu kana よていです — 予定 tidak diajarkan)
  ／〜ましょう・〜ませんか (088_bunpou_bab19.sql). 5 kanji baru Bab 19
  (雨天空山川) ditambahkan ke whitelist (102 karakter). Passage: keinginan
  &amp; rencana pendakian gunung (たいです／ほしいです／つもりです vs
  よていです semua dipakai natural dalam satu cerita). Listening: dialog 1
  jebakan "harus disimak sampai akhir" (jadwal digeser dua kali sebelum
  disepakati); dialog 2 keinginan yang BERUBAH di tengah percakapan;
  dialog 3 barang yang disebut PERTAMA justru DITOLAK (kamera kemahalan,
  niat sebenarnya beli sepeda) — pola sama dengan jebakan suka-vs-mahir
  Bab 17 dan perbandingan Bab 18. Larangan でも/そして/それから/〜が、〜
  tetap bersih (kelima kalinya berturut-turut). Divalidasi bersih pada
  draft pertama (Postgres lokal, replay 081→109→118, idempoten). Bab 20
  (119) — BAB PENUTUP seri dokkai/listening — menyusul dengan pola
  identik.
  **Bab 20 (119) selesai — SERI DOKKAI/LISTENING BAB 12-20 LENGKAP
  (2026-08-27)**. Grammar scope 〜たことがあります／〜たことがありません／
  〜から (sebab)／〜が、〜 (pertentangan)／そして・それから・でも
  (089_bunpou_bab20.sql) — BEDA dari migrasi 111-118: keempat pola ini
  direservasi untuk bab ini di semua bab sebelumnya, sekarang dipakai
  bebas karena inilah bab yang mengajarkannya. 2 kanji baru Bab 20
  (来令) ditambahkan ke whitelist (104 karakter) — 来 sengaja diuji KEDUA
  bacaannya sekaligus (らい di 来年／来週／来月, き di kata kerja 来る:
  来ます／来ません) sebagai poin ajar inti; 令 TIDAK dipakai sama sekali
  karena satu-satunya pemakaian N5 (令和) butuh kanji 和 yang tidak ada
  di whitelist — menambah 和 adalah keputusan kurikulum terpisah, di luar
  scope migrasi ini. Passage: pengalaman ke Jepang + mendaki gunung,
  merangkai たことがあります／それから／〜が、〜／でも／〜から dalam satu
  cerita. Listening: dialog 1 jawaban "mendaki bersama tahun depan" tidak
  diucapkan kata per kata (harus digabung dari ajakan てくれませんか-style
  + persetujuan); dialog 3 total harga bukan penjumlahan kedua barang
  yang disebut, tapi harga barang yang akhirnya DIPILIH setelah でも
  membalik keputusan awal. Divalidasi bersih pada draft pertama (Postgres
  lokal, replay 081→110→119, idempoten, DAN verifikasi akhir: kesembilan
  lesson assignment-bab-12 s/d -20 semuanya persis 57 soal). **Seri
  111-119 selesai (2026-08-27)** — 7 soal baru × 9 bab = 63 soal baru
  total (27 reading + 36 listening), ditambah 450 soal vocab/grammar dari
  seri 100-110, sehingga tiap Assignment Bab 12-20 sekarang 57 soal
  (9 × 57 = 513 soal total di seluruh Bab 12-20). Assignment sekarang
  benar-benar menguji keempat kategori JLPT (vocabulary/grammar/reading/
  listening), bukan cuma vocab+grammar seperti sebelumnya.

## Struktur repo (high-level)

- `backend/` — Node.js API, Postgres-backed. Entry: `src/server.js`.
- `backend/migrations/` — SQL migrasi yang di-track via `schema_migrations`.
- `backend/deploy/` — file ops (systemd unit, nginx conf, backup script + cron).
- `app/` — Kanji PWA (app.eznihongo.com), separate auth realm dari main site.
- `welcome.html`, landing pages — main site (eznihongo.com).
- `supabase/` — legacy, ported ke backend Node. Jangan dipakai untuk fitur baru.
