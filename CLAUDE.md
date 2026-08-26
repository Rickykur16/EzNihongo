# EzNihongo — Catatan untuk Claude

## Pending ops / infra (jadwal: minggu ini)

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
  **Sisa pekerjaan Bab 12-20**: (a) deck kosakata Bab 17-20 masih kosong —
  isi lewat Kelola Deck → "↻ Import Bab dari Notion" (endpoint pakai
  `NOTION_TOKEN` backend, bukan kuota MCP); (b) Bab 13 belum punya kanji di
  Notion (kolom "Kanji First Introduced" kosong); (c) Assignment Bab 12-20
  belum dibuat.
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

## Struktur repo (high-level)

- `backend/` — Node.js API, Postgres-backed. Entry: `src/server.js`.
- `backend/migrations/` — SQL migrasi yang di-track via `schema_migrations`.
- `backend/deploy/` — file ops (systemd unit, nginx conf, backup script + cron).
- `app/` — Kanji PWA (app.eznihongo.com), separate auth realm dari main site.
- `welcome.html`, landing pages — main site (eznihongo.com).
- `supabase/` — legacy, ported ke backend Node. Jangan dipakai untuk fitur baru.
