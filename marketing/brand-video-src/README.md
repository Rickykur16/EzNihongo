# Video brand awareness EzNihongo (30 detik)

Dua versi:
- **`../eznihongo-brand-30s-9x16.mp4`** (utama, TikTok/Reels/Shorts) — `video-9x16.html`,
  1080×1920. Gaya caption mengikuti referensi konten edukasi: tumpukan kata kecil /
  kata kunci besar (Montserrat 900) / sambungan serif miring (Playfair Display Italic),
  muncul per kata blur→tajam, kotak judul merah, flash putih antar-adegan, slide
  tipografi merah & belah abu/merah. Render: `VIDEO=video-9x16.html W=1080 H=1920
  node render.mjs <dir> full`; cue: `VIDEO=video-9x16.html OUT=cues-9x16.json node cues.mjs`.
  Adegan Bootcamp (6,3–10,3 dtk) memakai halaman Live Class asli dengan data contoh
  (`node shoot-live.mjs .` → `live-upcoming.png`, `live-recordings.png`). Klaim "2×
  seminggu" dan rekaman sesuai landing & halaman Live Class; "3 bulan" dari pemilik
  produk — BELUM tercantum di website.
- `../eznihongo-brand-30s.mp4` (16:9, versi sebelumnya) — `video.html`.

B-roll hook memakai foto berlisensi Pexels/Unsplash yang sudah ada di repo
(`assets/landing/*`, `assets/dashboard/*`). Situs stok video (Pexels video, Pixabay,
Mixkit, dll.) diblokir jaringan sandbox saat video ini dibuat.


Hasil: `../eznihongo-brand-30s.mp4` — 1920×1080, 30 fps, H.264 + AAC stereo (-16 LUFS).

Isi (UI aplikasi siswa saja, tanpa landing page): pembuka logo → Dashboard →
Belajar (kartu kosakata + drill) → Smart Review (jawab benar → dijadwal ulang)
→ Progres → tampilan HP → penutup `eznihongo.com`. Semua data di layar adalah
data contoh.

## Render ulang

1. Sajikan root repo: `npx http-server -p 8099 -s -c-1 .`
2. Unduh font Google ke `fonts/` (`fonts.css` + file woff2 berpath `/__fonts/<nama>`):
   Chromium sandbox menolak sertifikat proxy untuk fonts.googleapis.com, jadi
   font disajikan lokal lewat `fontroute.mjs`. Tanpa ini teks jatuh ke font cadangan.
3. (Opsional) tangkap ulang Dashboard dengan data contoh: `node shoot3.mjs .`
4. Render frame: `node render.mjs <dir-frame> full` (900 JPEG, fungsi `render(t)`
   di `video.html` deterministik per waktu, bukan rekaman real-time).
5. `ffmpeg -framerate 30 -i <dir>/f%04d.jpg -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart ../eznihongo-brand-30s.mp4`

## Audio

Semua suara disintesis `sfx.py` (numpy), tanpa sampel/musik berlisensi: whoosh
transisi, pop label, klik, denting jawaban benar, tick progress, dentum logo,
plus pad tipis dan petikan ala koto (tangga nada yo). Waktunya dari `window.CUES`
di `video.html` — ubah animasi, ubah cue-nya di tempat yang sama.

1. `node cues.mjs` → `cues.json`
2. `python3 sfx.py cues.json sfx.wav`
3. Normalisasi loudnorm dua tahap ke -16 LUFS / TP -1.5, naikkan 1,5 dB + `alimiter=limit=0.7:level=disabled` (hasil ±-16 LUFS, peak AAC ±-1,6 dBFS), lalu gabungkan:
   `ffmpeg -framerate 30 -i <dir>/f%04d.jpg -i sfx-norm.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart ../eznihongo-brand-30s.mp4`

Tangkapan Belajar/Review/Progres memakai `assets/landing/*.png` yang sudah ada.

---

> **MP4 konten edukasi TIDAK di-commit** (`marketing/.gitignore`): deploy menjalankan
> `git fetch` + `git reset` di VPS, jadi semua file di repo ikut tersimpan di server. Render
> ulang dari sumber HTML dengan perintah di bawah; simpan hasilnya di luar repo.

# Konten edukasi: 「すみません」 1 kata, 3 arti (±25 detik, 9:16)

Hasil: **`../eznihongo-edu-sumimasen-9x16.mp4`** — 1080×1920, 30 fps, 24,6 detik, H.264 + AAC
(±-16 LUFS), tanpa voice-over (teks di layar + efek suara/musik sintesis `sfx.py`).
Sumber: `edu-sumimasen-9x16.html`.

Isi: **hook adegan tokoh** (aset fitur Percakapan, `assets/dialogue/*`: Aoi menjatuhkan
tiket di stasiun, Hadi mengambilkan, Aoi bilang 「あ、すみません！」, Hadi bingung "kok minta
maaf?", stempel SALAH PAHAM?) → "di sini すみません bukan 'maaf', artinya terima kasih" →
arti 2 permisi → arti 3 maaf → bonus tingkat sopan (ごめんなさい / すみません /
申し訳ありません) → penutup eznihongo.com.

Riwayat hook: v1 kartu teks merah, v2 kuis A/B/C di atas foto — keduanya dinilai pemilik
produk tidak menghentikan scroll (kartu teks di atas foto stok terlihat seperti template).

Render ulang (font di `fonts/`, lihat langkah 2 di atas; `render.mjs` & `sfx.py` menerima
env `DUR`):

    DUR=24.6 VIDEO=edu-sumimasen-9x16.html W=1080 H=1920 node render.mjs <dir> full
    VIDEO=edu-sumimasen-9x16.html OUT=cues-sumimasen.json node cues.mjs
    DUR=24.6 python3 sfx.py cues-sumimasen.json sfx.wav   # lalu loudnorm + mux seperti di atas

---

# Konten edukasi: tata cara interview kerja di Jepang (面接, 27 detik, 9:16)

Hasil: **`../eznihongo-edu-mensetsu-9x16.mp4`** — sumber `edu-mensetsu-9x16.html`, cue
`cues-mensetsu.json` (efek baru di `sfx.py`: `knock`, `buzz`).

Konsep "nilai kesan tersembunyi": meteran *Kesan Pewawancara* (alat cerita, BUKAN skor
resmi) turun di tiap versi ❌ NG dan pulih di versi ✅ OK. Tokoh: Anna (pelamar) & Ren
(pewawancara) dari `assets/dialogue`; pintu & meja digambar SVG di halaman.

| Detik | Isi |
| --- | --- |
| 0–3,4 | Hook: "kamu bisa gagal interview Jepang sebelum ngomong satu kata pun" → ketuk 2x → 「…トイレ？」 → NG |
| 3,4–6,4 | 01 ketuk 3x, tunggu 「どうぞ」 → OK |
| 6,4–11,4 | 02 masuk tanpa salam (NG) → 「失礼します」 + membungkuk (OK) |
| 11,4–17,2 | 03 langsung duduk (NG) → tunggu 「どうぞおかけください」 → 「失礼します」 → duduk (OK) |
| 17,2–23 | 04 「貴社で働きたいです」 (NG) → 「御社で…」 (OK) + kartu 御社 diucapkan / 貴社 ditulis |
| 23–27 | Recap 4 poin + teaser PART 2 (pertanyaan yang pasti ditanya) |

Sumber fakta (dicek 5 Okt 2026): ketuk 3x / 2x = トイレノック, tunggu どうぞ, 失礼します,
tunggu どうぞおかけください — hataractive.jp/useful/1068, gakumado.mynavi.jp/gmd/articles/74728;
御社 lisan / 貴社 tulisan — job.rikunabi.com/contents/howto/word/6586.

Render: `DUR=27 VIDEO=edu-mensetsu-9x16.html W=1080 H=1920 node render.mjs <dir> full`,
`VIDEO=edu-mensetsu-9x16.html OUT=cues-mensetsu.json node cues.mjs`,
`DUR=27 python3 sfx.py cues-mensetsu.json sfx.wav`, lalu loudnorm + mux seperti di atas.

---

# Konten: Smart Review — "aplikasi ini tahu kapan kamu mau lupa" (25 detik, 9:16)

Sumber `edu-smartreview-9x16.html`, cue `cues-smartreview.json`. MP4 tidak di-commit.

Isi: kosakata yang menghilang (hook) → kurva lupa (ilustrasi, tanpa angka) → "ulang tepat
sebelum lupa" → **UI Smart Review asli** (beranda, jawaban benar, jawaban salah + kunci
jawaban) → jarak ulangan → penutup + "komen N5".

Angka jarak ulangan diambil dari `backend/src/fsrs.js` (dijalankan langsung, 5 Okt 2026):
benar berturut-turut 3 → 11 → 35 → 101 → 269 hari; salah → diulang segera lalu jarak mulai
pendek lagi (5 → 14 → 36 hari). Kalau parameter FSRS berubah, angka di video ikut basi.

Tangkapan UI: `node shoot-review.mjs .` (http-server di :8099, API dicegat dengan data contoh,
viewport HP 390×844 @3x) → `rv-*.png` (tidak di-commit; dibuat ulang dengan perintah itu).
Render: `DUR=25 VIDEO=edu-smartreview-9x16.html W=1080 H=1920 node render.mjs <dir> full`,
`VIDEO=edu-smartreview-9x16.html OUT=cues-smartreview.json node cues.mjs`,
`DUR=25 python3 sfx.py cues-smartreview.json sfx.wav`, lalu loudnorm + mux.

---

# Konten: "Jangan masuk LPK kalau belum tahu ini" (SSW mandiri) — video 34 dtk (tanpa suara) + carousel 8 slide

Sumber `edu-ssw-mandiri-9x16.html` (satu file untuk video DAN carousel; frame carousel =
`window.SLIDE_TIMES`), cue `cues-ssw.json`. Naskah dari pemilik produk, dua koreksi akurasi:
"syaratnya cuma 2" → **"syarat ujiannya cuma 2"** + catatan kaki (bidang kaigo + ujian bahasa
kaigo; tetap perlu kontrak kerja), dan sumber Kedubes ditulis sebagai rangkuman, bukan kutipan.
Revisi "missing link": + slide peta jalan 3 langkah (ujian → perusahaan → visa), jembatan
"buku nggak bisa ngoreksi ngomongmu" di slide gratis, "interview-nya pakai bahasa Jepang" di
slide perusahaan, dan catatan "kelas bahasa Jepang, bukan agen penyalur kerja" di CTA. Tanpa tokoh
dan tanpa audio (VO + sound TikTok ditambahkan saat posting). Isi penting sengaja di pita y 285–1635 supaya versi Instagram 4:5 (crop 1080×1350 dari y 285)
tetap utuh.

Fakta (dicek 6 Okt 2026):
- SSW boleh daftar sendiri tanpa LPK: Q&A Tokutei Ginou, id.emb-japan.go.jp/QnA_tokuteiginou.html
  (situs diblokir dari sandbox; isi dibaca lewat ringkasan hasil pencarian — cek ulang manual).
- JFT-Basic Rp550.000 per Agustus 2026 (Prometric; dikutip ulang treeglobalpartners.com).
- **Ujian skill Rp110–780rb BELUM terverifikasi**; contoh yang ditemukan: restoran Rp450.000
  (itc-indonesia.com). Cek di prometric-jp.com sebelum posting.

Hasil (tidak di-commit): `../eznihongo-edu-ssw-mandiri-9x16.mp4`,
`../eznihongo-edu-ssw-mandiri-carousel/slide-N.png` (9:16) dan `ig-4x5-slide-N.png` (4:5).
Render: `DUR=34 VIDEO=edu-ssw-mandiri-9x16.html W=1080 H=1920 node render.mjs <dir> full` lalu
ffmpeg TANPA audio (`-an`); slide: `node render.mjs <dir> 3.05,7.05,11.55,15.55,20.35,24.65,29.25,33.75`.
