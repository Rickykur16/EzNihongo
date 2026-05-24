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
- **Tipe pelajaran `deck`** (kosakata interaktif, migration 009): lesson
  bertipe `deck` punya kartu kosakata yang dipilih dari bank
  (`module_vocabulary`, bisa `lesson_id` NULL untuk item bank murni) lewat join
  `lesson_deck_items`; tiap kata punya `vocabulary_examples` (contoh kalimat,
  disimpan polos + kolom `highlight`). Admin kelola via tombol "Kelola Deck" di
  daftar pelajaran (`admin.html` → `manageDeck`). `welcome.html` me-render via
  `renderDeckLesson` (grid kartu + modal contoh kalimat, desain dari handoff
  "Kosakata"). API: `/api/admin/vocab-bank`, `/api/admin/vocabulary-examples`,
  `/api/admin/lessons/:id/deck-items`; `content.js` ngirim `lesson.deck`.
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
  bukan `REQUIRED_ENV`); kalau kosong endpoint balas 503. Di main site
  (`welcome.html`) frontend fallback ke Web Speech browser; di Kanji PWA
  (`app/kanji.html`) **tidak ada** fallback Web Speech (sengaja — suara robotik
  bawaan browser dihilangkan, cuma ElevenLabs). Endpoint cuma mau generate text
  yang ada di `module_vocabulary` / `vocabulary_examples` / `quiz_questions.audio_script`
  / `module_grammar.example_dialog` (DB, anti abuse kuota) **atau** di allowlist
  Kanji PWA + rate-limit.
  - **Allowlist Kanji PWA**: vocab + contoh kalimat kanji ada di array `KD`
    yang di-embed di `app/kanji.html` (bukan di DB), jadi DB-whitelist gak
    keliatan. Di-generate ke `backend/data/kanji-tts-allowlist.json` lewat
    `npm run gen:kanji-tts` (`scripts/gen-kanji-tts-allowlist.mjs`) — **regenerate
    tiap KD berubah**. `tts.js` load file itu ke `Set` in-memory saat boot
    (file hilang → set kosong → kanji TTS balas 403, bukan crash).

## Struktur repo (high-level)

- `backend/` — Node.js API, Postgres-backed. Entry: `src/server.js`.
- `backend/migrations/` — SQL migrasi yang di-track via `schema_migrations`.
- `backend/deploy/` — file ops (systemd unit, nginx conf, backup script + cron).
- `app/` — Kanji PWA (app.eznihongo.com), separate auth realm dari main site.
- `welcome.html`, landing pages — main site (eznihongo.com).
- `supabase/` — legacy, ported ke backend Node. Jangan dipakai untuk fitur baru.
