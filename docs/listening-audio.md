# Audio listening dan Percakapan dashboard utama

Soal listening kuis bab dan final assignment memakai profil ElevenLabs tersendiri.
`ELEVENLABS_LISTENING_MODEL` bernilai default `eleven_v4`, termasuk untuk narator.
Bagian **Percakapan** grammar juga memakai v4 per giliran, termasuk narator,
melalui `ELEVENLABS_DIALOGUE_MODEL` (default `eleven_v4`). `ELEVENLABS_MODEL`
tetap mengatur audio umum/kosakata.
Tidak ada perubahan pada aplikasi `app/`.

## Pergantian pembicara dan tempo

- Backend meminta audio PCM 24 kHz, mono, signed 16-bit little-endian per giliran,
  menyimpan setiap take, lalu menyusunnya menjadi satu WAV yang bisa diputar browser.
- Admin bisa **Tes giliran ini** dan **Buat ulang suara** per baris listening.
  Preview menggunakan take yang sama dengan audio lengkap siswa. Siswa tetap
  mendapat satu audio utuh per soal dengan kontrol tempo/seek yang sudah ada.
- Saat label pembicara berubah, backend menyisipkan 1.200 ms keheningan setelah
  tokoh dialog, atau 1.800 ms setelah narator. Tidak ada tambahan di ujung klip
  atau di antara dua baris dari pembicara yang sama.
- Angka tersebut adalah **keheningan tambahan pada 1×**, bukan pengukuran seluruh
  jeda suara. Model dapat menghasilkan keheningan sendiri. Pada tempo 0,9×,
  keheningan tambahan menjadi sekitar 1,33 dan 2 detik.
- Pemutar siswa mulai pada 0,9×, dengan pilihan 0,75× dan 1×. Pitch dipertahankan.
  Ini mengatur kecepatan pemutaran, bukan parameter `speed` ElevenLabs.
- Final assignment tetap berhenti setelah satu soal. Kuis bab mempertahankan
  jeda antarsoalnya; memutar ulang, menjeda, atau mencari posisi audio membatalkan
  perpindahan otomatis yang masih tertunda.

V4 tidak mendukung SSML break. Profil listening/Percakapan tidak mengirim tag `<break>`
atau parameter `style`/`speed` model lama. Gunakan tanda baca dan teks ucapan
yang wajar; pergantian pembicara ditentukan oleh label naskah (`N:`, `A:`, `B:`
atau nama pemeran). Preview satu giliran hanya menguji suara; gunakan **Tes audio**
untuk naskah lengkap ketika menilai pergantian pembicara.

## Konfigurasi dan cache

1. Pastikan server memiliki `ELEVENLABS_API_KEY` serta voice ID yang valid untuk
   narator dan pemeran. Voice ID/pemeran tetap memakai konfigurasi yang ada.
2. Gunakan `ELEVENLABS_LISTENING_MODEL=eleven_v4` dan
   `ELEVENLABS_DIALOGUE_MODEL=eleven_v4` (juga default saat tidak diisi).
   Setting global `ELEVENLABS_MODEL` tidak menimpa kedua profil ini.
3. Deploy backend dan `admin.html` bersama. Pemutar siswa tetap kompatibel;
   perubahan ini tidak memerlukan migrasi SQL.
4. Panel admin **cache audio** menampilkan model listening dan Percakapan.
   Ini membuktikan konfigurasi, bukan keberhasilan panggilan model oleh akun.
5. Tes satu giliran melalui editor dialog listening, lalu tes naskah lengkap
   melalui editor soal. Preview memakai take dan tempo awal yang sama dengan siswa.
   Periksa pengucapan Jepang,
   pergantian suara, dan kecepatan sebelum menilai seluruh bank soal.

Setiap take dikunci oleh model, format, pengaturan, voice ID, peran, dan teks yang
benar-benar diucapkan. Percakapan menyimpan MP3 dalam `dialogue-v4-mp3-turn-v1`;
listening menyimpan PCM dalam `listening-v4-pcm-turn-v1`. Mengedit satu baris hanya
membuat take untuk baris yang berubah. Furigana Percakapan tetap dipakai untuk
pelafalan dan kunci cache. Audio v2/v3 lama tidak diadopsi ke kedua profil v4.

Listening lengkap selalu dirangkai dari take terkini. Tidak ada cache WAV
gabungan yang dapat mempertahankan take lama setelah satu giliran dibuat ulang.
**Hapus cache audio** untuk listening menghapus take naskah dengan pemeran yang
sedang dipilih; take identik yang dipakai soal lain juga akan dibuat lagi saat
dibutuhkan. **Buat ulang suara** mengganti satu take, bukan seluruh naskah.

WAV gabungan dari profil `listening-v4-pcm-v1` tidak dapat dipisahkan dengan aman
karena tidak menyimpan batas setiap take; profil baru tidak memakainya. Cache
baru dibuat saat pertama kali diputar, sehingga memakai kuota ElevenLabs. Tidak
ada regenerasi massal atau penghapusan audio lama saat deploy. Pembersihan orphan
melindungi tiga versi aktif: umum `v6`, listening PCM per giliran, dan Percakapan
MP3 per giliran. Versi gabungan lama termasuk orphan.

Percakapan mempertahankan pemutar per giliran, pilihan tempo, dan jeda transisinya.
V4 menggunakan `stability` dan `similarity_boost`; tidak mengirim pengaturan model
lama seperti `speed`, `style`, atau `use_speaker_boost`.

PCM/WAV memakai sekitar 48 KB per detik pada konfigurasi ini, lebih besar dari
MP3 lama. Respons soal tetap `private, no-store` dan harus berasal dari attempt
milik siswa yang berhak mengakses pelajaran. Jika upstream menolak model/voice
atau audio tidak valid, endpoint mengembalikan error; tidak beralih diam-diam ke
model lama atau suara browser.

## Verifikasi

Tes otomatis memakai provider palsu dan memeriksa request v4, format WAV, byte
keheningan, cache, otorisasi attempt, preview admin, dan perilaku pemutar.
Regresi khusus membandingkan byte take admin dengan take siswa, memastikan
regenerasi satu baris mengganti audio lengkap, dan menolak adopsi cache lama.
Tes PostgreSQL memerlukan `TEST_DATABASE_URL` ke database lokal sementara.
Tes tersebut tidak membuktikan kualitas pengucapan atau hak akses v4 pada akun
ElevenLabs produksi; itu memerlukan preview asli dengan konfigurasi server.

Referensi resmi, diperiksa 8 Oktober 2026:

- [Model dan pengaturan Eleven v4](https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech)
- [Jeda dan dukungan SSML](https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-can-i-add-pauses)
- [API Create speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)
