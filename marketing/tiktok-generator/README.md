# Generator TikTok EzNihongo

Claude **meriset sendiri** ide konten, kamu **memilih**, baru dia mengerjakan.
Ada dua gerbang persetujuan manusia; generator tidak pernah memposting sendiri.

```
npm run ideas                 Claude riset berita → usulkan 5 ide (hook, alasan, sumber)
        ✋ kamu pilih satu
npm run plan -- --idea 2      riset ulang ide no. 2 → naskah + review.md (fakta & sumber)
        ✋ kamu cek naskah (edit script.json bila perlu)
npm run build                 suara (ElevenLabs) + foto (Pexels) + render → video.mp4
```

Lewat Telegram (`npm run bot`) alurnya sama: `/ide` → `/buat 2` → `/render`,
dan ide bisa dikirim otomatis tiap minggu (lihat **Otomatis mingguan**).

## Pemasangan

Butuh Node 20+, `ffmpeg`/`ffprobe`, dan Chromium untuk Playwright.

```bash
cd marketing/tiktok-generator
npm install
npx playwright install chromium   # sekali saja (lewati bila Chromium sudah ada; isi CHROMIUM_PATH)
cp .env.example .env              # isi API key + CONTENT_MODEL
```

Jaringan yang harus bisa diakses: `api.anthropic.com`, `api.elevenlabs.io`,
`api.pexels.com`, `images.pexels.com`, `fonts.googleapis.com`, `fonts.gstatic.com`.

## Otomatis mingguan (Telegram)

1. Isi `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_ADMIN_CHAT_ID` di `.env`. Bot yang sama dengan notifikasi
   admin backend boleh dipakai, asal bot itu tidak memakai webhook (getUpdates akan bentrok).
   Hanya chat admin itu yang dilayani bot; pesan dari orang lain diabaikan.
2. Jalankan bot terus-menerus, misalnya dengan systemd atau `pm2`:
   ```bash
   npm run bot
   ```
3. Kirim ide tiap Senin pagi (crontab, waktu server):
   ```
   0 8 * * 1  cd /path/ke/marketing/tiktok-generator && npm run ideas -- --notify >> out/cron.log 2>&1
   ```
4. Di Telegram: balas `/buat <nomor>` → bot mengirim ringkasan naskah + `review.md`.
   Kalau oke, balas `/render` → bot mengirim video + cover. Cek dulu, baru posting.

Ide yang sudah dibuat dicatat di `out/history.json` supaya riset berikutnya tidak mengulang.

## Isi folder hasil (`out/<tanggal-slug>/`)

| File | Isi |
|---|---|
| `review.md` | Naskah per adegan, tabel fakta + sumber, caption, komentar sematan, daftar masalah |
| `research.md` | Catatan riset mentah dari web search |
| `script.json` | Data naskah yang dipakai `build` — boleh diedit |
| `photos/` | Taruh `1.jpg`, `2.jpg`, … untuk mengganti foto Pexels adegan itu (`6-2.jpg` = thumbnail item ke-2 adegan 6) |
| `video.mp4`, `cover.png` | Video final + frame pertama (pakai sebagai cover TikTok) |
| `caption.txt`, `credits.md` | Caption + komentar sematan, daftar fotografer Pexels |

## Aturan konten yang ditanam di prompt

Diambil dari analitik video pertama (penonton paling banyak pergi di 3–4 detik pertama):

- Adegan pertama selalu **hook**: inti berita di kalimat pertama, teks layar sudah penuh di frame pertama.
- 25–35 detik, kalimat pendek, nada ngobrol.
- **Soft selling**: kelas N5 hanya di adegan terakhir lewat "komen 'N5'". Tanpa harga, tanpa janji.
- **Jujur**: semua klaim masuk tabel fakta + sumber. Tidak ada janji gaji/lolos/berangkat, dan tidak menyiratkan EzNihongo sebagai agen penyalur.
- Teks suara ditulis sesuai cara baca ("en lima", "es es we") supaya TTS tidak salah ucap.

`build` menolak jalan bila naskah masih punya masalah struktural (cue yang tidak ada di teks suara,
singkatan di teks suara, adegan pertama bukan hook). Klaim berstatus "perlu dicek" tidak
memblokir. Itu tanggung jawab reviewer. `--force` untuk melewati pemeriksaan.

## Suara

Model dan suara dicari lewat API ElevenLabs: model yang memuat `v4` dan suara bernama `Jessica`.
Kalau akunmu memakai nama lain, isi `ELEVENLABS_MODEL` / `ELEVENLABS_VOICE_ID` di `.env`.
Generator meminta timestamp per karakter supaya teks muncul tepat saat katanya diucapkan.
Kalau model tidak mendukung timestamp, suara dibuat per adegan lalu disambung.

## Jenis adegan (template)

`hook`, `statement`, `photo`, `compare`, `list`, `timeline`, `level`, `cta`.
Lihat `src/schema.mjs` untuk field tiap adegan dan `template/index.html` untuk tampilannya.

## Tes

```bash
npm test
```
