# Video promosi EzNihongo (vertikal)

Dua video di folder ini:

1. `EzNihongo_Promo_JalurMandiri_20s_1080x1920.mp4` — **ajakan belajar**: kerja ke Jepang jalur mandiri (SSW) tanpa lewat LPK, 20 detik, murni promosi tanpa tampilan aplikasi. Lihat bagian *Video 2*.
2. `EzNihongo_Promo_15s_1080x1920.mp4` — tur fitur aplikasi, 15 detik (bagian di bawah ini).

## Video 1 — tur fitur (15 detik)

**File:** `EzNihongo_Promo_15s_1080x1920.mp4`
1080 × 1920 · 30 fps · 450 frame · H.264 High (BT.709) · AAC 256 kbps 48 kHz stereo ·
durasi kontainer **tepat 15,000 s** (edit list video & audio masing-masing 15,000 s) ·
audio −15 LUFS terintegrasi, peak −1,3 dBFS.

### Konsep

Satu kata Jepang sebagai pintu masuk: 「はたらく」 = *bekerja*. Lingkaran merah (matahari,
juga titik merah pada logo) menjadi motif penghubung: ia membuka jendela ke Tokyo, lalu di
akhir jatuh tepat di huruf "i" logo. Musik 128 BPM, jadi 8 bar = pas 15 detik; setiap
pergantian adegan jatuh di awal bar.

| Waktu | Bar | Layar | Teks |
|---|---|---|---|
| 0,00–1,88 | 1 | 「はたらく」 muncul satu huruf per petikan koto | ARTINYA · **bekerja** |
| 1,88–3,75 | 2 | Matahari membuka jendela ke Tokyo Tower | 日本で働きたい？ · **Mau kerja di Jepang?** |
| 3,75–5,63 | 3 | Swipe-up ke aplikasi · Dashboard, ketuk *Lanjut Belajar* | **Mulai dari bahasanya dulu.** |
| 5,63–7,50 | 4 | Kosakata Bab 15 (店員, お客様 + ikon suara) | **Hafal kosakatanya,** |
| 7,50–9,38 | 5 | Adegan Dialog contoh (Anna & Aoi di kafe) + terjemahan | **dengar percakapannya,** |
| 9,38–11,25 | 6 | Smart Review 「お客様」の意味は？ → jawaban benar | **ulangi yang mulai lupa,** |
| 11,25–13,13 | 7 | Live Class, jadwal kelas mendatang | **belajar bareng sensei.** · Kelas online bersama sensei · 2x seminggu |
| 13,13–15,00 | 8 | Logo tersusun, titik merah mendarat di "i" | Bootcamp Bahasa Jepang · Daftar di eznihongo.com |

Klaim produk hanya yang sudah ada di repo/landing page: kelas online bersama sensei
2 kali seminggu, dashboard (Belajar per bab, Smart Review, Live Class), konten Bab 15
dari migrasi 073 (kosakata) dan 084 (tata bahasa). Tidak ada janji kerja, keberangkatan,
atau kelulusan. Harga tidak disebut karena di landing page masih "belum ditentukan".

### Tampilan aplikasi & data contoh

Semua layar HP adalah **render asli frontend EzNihongo** (Playwright, 390 × 844 @3x) dari
backend + Postgres lokal, login sebagai pelajar fiktif **Rina Pratiwi**
(`rina.contoh@example.test`). Angka progres, jumlah item review, soal review, dan jadwal
live class adalah data contoh (sebagian di-patch pada respons JSON di `capture/capture.cjs`,
sisanya di `capture/fixture.sql`). Keterangan "Tampilan aplikasi EzNihongo · data contoh"
tampil di layar selama adegan aplikasi.

## Video 2 — jalur mandiri tanpa LPK (20 detik)

**File:** `EzNihongo_Promo_JalurMandiri_20s_1080x1920.mp4` · 1080 × 1920 · 30 fps · 600 frame ·
durasi kontainer **tepat 20,000 s** · audio −15,5 LUFS, peak −1,0 dBFS. Musik 132 BPM,
11 bar = 20 detik; palet suara sama dengan video 1 (identitas audio), aransemen baru.

Inti pesannya: **ajakan belajar di EzNihongo**. Tanpa harga, tanpa tampilan website/aplikasi.

| Waktu | Bar | Visual | Teks |
|---|---|---|---|
| 0,00–3,64 | 1–2 | Tipografi di atas biru tua + matahari merah; kuas merah mencoret kata *harus* | Kerja di Jepang harus lewat **LPK?** → **Nggak harus.** Ada jalur mandiri. |
| 3,64–5,45 | 3 | Titik merah membuka jendela ke Tokyo Tower | JALUR MANDIRI · **SSW** · Tokutei Ginou 特定技能 · Status visa kerja resmi di Jepang |
| 5,45–7,27 | 4 | Kartu syarat, kartu 1 disorot "Mulai dari sini" | Syarat utamanya: 1) Lulus tes bahasa Jepang (JFT-Basic A2 atau JLPT N4) 2) Lulus tes keterampilan |
| 7,27–9,09 | 5 | Kartu 1 membesar jadi adegan Fuji, 日本語 muncul per ketukan (musik breakdown) | LANGKAH PERTAMA · **Siapkan dulu bahasa Jepangnya.** |
| 9,09–16,36 | 6–9 | Foto berganti per poin (belajar online, kereta & sakura, torii) | **Yuk, belajar bahasa Jepang di EzNihongo.** · 01 Belajar bareng sensei (2x seminggu) · 02 Ulangi materi kapan saja (lewat dashboard belajar) · 03 Mulai dari nol juga bisa. |
| 16,36–20,00 | 10–11 | Logo tersusun, titik merah mendarat di "i" | Kerja ke Jepang jalur mandiri, mulai dari bahasanya. · **Mulai belajar di eznihongo.com** |

### Akurasi klaim

- **"Nggak harus lewat LPK"** — benar untuk jalur **SSW / Tokutei Ginou**: calon pekerja baru
  cukup lulus tes bahasa Jepang (JFT-Basic A2 atau JLPT N4) dan tes keterampilan bidangnya.
  Jalur mandiri tetap melalui prosedur resmi Kementerian P2MI (mis. pendaftaran IPKOL/SISKOP2MI).
  Program **magang (TITP)** memang lewat lembaga pengirim, jadi video sengaja menyebut SSW,
  dan yang dicoret adalah kata *harus*, bukan "LPK" (tidak menjelekkan LPK).
  Sumber (dirangkum dari hasil pencarian web, 27 Sep 2026): FAQ SSW Jepang dan artikel JFT-Basic dari
  KP2MI (kp2mi.go.id), artikel tirto.id "Kerja di Jepang Tanpa LPK, Bisa Lewat Jalur Mandiri &
  Pemerintah", dan situs SSW Immigration Services Agency of Japan (ssw.go.jp). Halaman kp2mi.go.id dan
  ssw.go.jp tidak bisa dibuka langsung dari lingkungan pembuatan video (diblokir jaringan), jadi
  **cek ulang ke sumber resmi sebelum iklan berbayar** dijalankan.
- Catatan kecil di layar: "Gambaran umum jalur SSW… syarat tiap bidang bisa berbeda" dan di akhir
  "Penerimaan kerja mengikuti seleksi perusahaan dan prosedur resmi." Tidak ada janji kerja,
  keberangkatan, atau kelulusan tes.
- **Level materi EzNihongo tidak diklaim.** Kelas N4 di repo masih `is_published = false`;
  "JLPT N4" hanya muncul sebagai syarat jalur SSW. Setelah Kelas N4 rilis, baris seperti
  "Materi N5–N4" bisa ditambahkan di `ssw.html`.
- "Kelas online bareng sensei 2x seminggu" dan "ulangi materi kapan saja lewat dashboard"
  mengikuti klaim yang sudah ada di landing page. "Mulai dari nol juga bisa" mengikuti FAQ landing
  ("Saya belum bisa bahasa Jepang. Bisa mulai?").

### Foto tambahan (video 2)

| Foto | Sumber | Lisensi |
|---|---|---|
| Orang belajar online | `assets/landing/bootcamp-study-zen-chung.jpg`, Zen Chung / Pexels (diberi label "Foto ilustrasi") | Pexels |
| Gunung Fuji saat fajar | `assets/dashboard/progress-fuji-dawn.webp`, Turquo Cabbit / Unsplash | Unsplash |
| Kereta & sakura | `assets/dashboard/continue-sakura-train.webp`, Spenser Sembrat / Unsplash | Unsplash |
| Torii Hakone | `assets/dashboard/continue-hakone-torii.webp`, Regina Bartha / Unsplash | Unsplash |

Semua sudah tercatat di `photo-credits.html` / `assets/dashboard/README.md`.

### Render ulang video 2

```sh
cd marketing/promo-15s/composition
python3 audio_ssw.py                                    # -> music_ssw.wav (20,000 s)
PAGE=ssw.html node render.cjs stills 1.2,6.3,15         # cek frame -> ./stills
PAGE=ssw.html SEG=seg_ssw node render_par.cjs 4 30 4    # durasi dibaca dari window.DURATION
SEG=seg_ssw AUDIO=music_ssw.wav DUR=20 ./encode.sh ../EzNihongo_Promo_JalurMandiri_20s_1080x1920.mp4
```

Instrumen & mastering dipakai bersama lewat `synth.py`; `audio.py` (video 1) tetap
menghasilkan file yang identik bit-per-bit dengan versi sebelumnya.

## Lisensi aset (kedua video)

| Aset | Sumber | Status |
|---|---|---|
| Musik & semua efek suara | Disintesis dari nol oleh `composition/audio.py` (tanpa sampel/loop pihak ketiga) | Karya orisinal, aman untuk komersial |
| Foto Tokyo Tower | `assets/landing/tokyo.jpg`, Pexels (lance he), sudah dicantumkan di `photo-credits.html` | Lisensi Pexels, komersial diizinkan |
| Tekstur kertas | `assets/dashboard/activity-paper-texture.webp`, Unsplash | Lisensi Unsplash, komersial diizinkan |
| Font | Inter, Shippori Mincho, Noto Sans JP, JetBrains Mono (Google Fonts) | SIL Open Font License |
| Logo, karakter dialog, latar kafe, layar aplikasi | Aset EzNihongo di repo ini | Milik EzNihongo |

Logo dipakai apa adanya (warna asli), hanya latar putihnya dilepas dengan *alpha unmixing*
dari `logo.png` sehingga tidak ada halo putih. Karena tulisan "Nihongo" berwarna hitam,
logo ditempatkan di atas latar kertas terang, bukan di biru tua.

## Membuat ulang / mengedit

Kebutuhan: Node 20+, Python 3 (`numpy scipy pillow`), ffmpeg, Playwright + Chromium.

```sh
cd marketing/promo-15s/composition
python3 fetch-fonts.py          # unduh font ke ./fonts (tidak di-commit)
python3 audio.py                # -> music_raw.wav (deterministik)
node render.cjs stills 2,8.2,14 # cek beberapa frame -> ./stills
node render_par.cjs 4 30 4      # 4 worker, 30 fps, 4 sub-frame/ frame (motion blur 180°)
./encode.sh ../EzNihongo_Promo_15s_1080x1920.mp4
python3 mp4info.py ../EzNihongo_Promo_15s_1080x1920.mp4   # cek durasi presisi
```

Semua animasi adalah fungsi murni waktu `render(t)` di `composition/index.html`, jadi teks,
warna, dan timing bisa diubah lalu di-render ulang (± 4 menit di 4 core). Timing SFX ada di
dict `SFX` pada `audio.py` dan mengikuti grid bar yang sama.

Mengambil ulang layar aplikasi (opsional, hanya database **lokal**):

```sh
DATABASE_URL=postgres://.../db_lokal_kosong ./capture/setup-fixture.sh
# jalankan backend (COOKIE_SECURE=false) di :3001 dan node capture/serve.mjs di :8080
NODE_USE_ENV_PROXY=1 node capture/capture.cjs && node capture/capture_scroll.cjs && python3 capture/postprocess.py
```
