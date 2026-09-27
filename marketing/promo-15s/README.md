# Video promosi EzNihongo — 15 detik (vertikal)

**File:** `EzNihongo_Promo_15s_1080x1920.mp4`
1080 × 1920 · 30 fps · 450 frame · H.264 High (BT.709) · AAC 256 kbps 48 kHz stereo ·
durasi kontainer **tepat 15,000 s** (edit list video & audio masing-masing 15,000 s) ·
audio −15 LUFS terintegrasi, peak −1,3 dBFS.

## Konsep

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

## Tampilan aplikasi & data contoh

Semua layar HP adalah **render asli frontend EzNihongo** (Playwright, 390 × 844 @3x) dari
backend + Postgres lokal, login sebagai pelajar fiktif **Rina Pratiwi**
(`rina.contoh@example.test`). Angka progres, jumlah item review, soal review, dan jadwal
live class adalah data contoh (sebagian di-patch pada respons JSON di `capture/capture.cjs`,
sisanya di `capture/fixture.sql`). Keterangan "Tampilan aplikasi EzNihongo · data contoh"
tampil di layar selama adegan aplikasi.

## Lisensi aset

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
