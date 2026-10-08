# Audio listening dashboard utama

Soal listening kuis bab dan final assignment memakai profil ElevenLabs tersendiri.
`ELEVENLABS_LISTENING_MODEL` bernilai default `eleven_v4`, termasuk untuk narator.
`ELEVENLABS_MODEL` tetap mengatur audio umum/kosakata dan dialog grammar.
Tidak ada perubahan pada aplikasi `app/`.

## Pergantian pembicara dan tempo

- Backend meminta audio PCM 24 kHz, mono, signed 16-bit little-endian per giliran,
  lalu menyusunnya menjadi satu WAV yang bisa diputar browser.
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

V4 tidak mendukung SSML break. Profil listening tidak mengirim tag `<break>`
atau parameter `style`/`speed` model lama. Gunakan tanda baca dan teks ucapan
yang wajar; pergantian pembicara ditentukan oleh label naskah (`N:`, `A:`, `B:`
atau nama pemeran). Preview satu giliran hanya menguji suara; gunakan **Tes audio**
untuk naskah lengkap ketika menilai pergantian pembicara.

## Konfigurasi dan cache

1. Pastikan server memiliki `ELEVENLABS_API_KEY` serta voice ID yang valid untuk
   narator dan pemeran. Voice ID/pemeran tetap memakai konfigurasi yang ada.
2. Gunakan `ELEVENLABS_LISTENING_MODEL=eleven_v4` (juga default saat tidak diisi).
   Setting global `ELEVENLABS_MODEL` tidak menimpa profil listening.
3. Deploy backend dan `welcome.html`/`admin.html` bersama. Tidak ada migrasi SQL.
4. Panel admin **cache audio** menampilkan model listening yang dikonfigurasi.
   Ini membuktikan konfigurasi, bukan keberhasilan panggilan model oleh akun.
5. Tes satu naskah lengkap melalui editor soal. Preview menggunakan profil,
   cache WAV, dan tempo awal yang sama dengan siswa. Periksa pengucapan Jepang,
   pergantian suara, dan kecepatan sebelum menilai seluruh bank soal.

Cache listening memiliki namespace baru yang mencakup model, format, suara dan
peran berurutan, parameter, naskah, dan jeda. Audio v2/v3 lama tidak dipakai untuk
profil baru. Cache baru dibuat saat soal pertama kali diputar, sehingga panggilan
ElevenLabs tersebut memakai kuota akun. Tidak ada regenerasi massal atau
penghapusan audio lama saat deploy. Pembersihan orphan melindungi kedua versi
cache aktif (umum dan listening).

PCM/WAV memakai sekitar 48 KB per detik pada konfigurasi ini, lebih besar dari
MP3 lama. Respons soal tetap `private, no-store` dan harus berasal dari attempt
milik siswa yang berhak mengakses pelajaran. Jika upstream menolak model/voice
atau audio tidak valid, endpoint mengembalikan error; tidak beralih diam-diam ke
model lama atau suara browser.

## Verifikasi

Tes otomatis memakai provider palsu dan memeriksa request v4, format WAV, byte
keheningan, cache, otorisasi attempt, preview admin, dan perilaku pemutar.
Tes PostgreSQL memerlukan `TEST_DATABASE_URL` ke database lokal sementara.
Tes tersebut tidak membuktikan kualitas pengucapan atau hak akses v4 pada akun
ElevenLabs produksi; itu memerlukan preview asli dengan konfigurasi server.

Referensi resmi, diperiksa 8 Oktober 2026:

- [Model dan pengaturan Eleven v4](https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech)
- [Jeda dan dukungan SSML](https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-can-i-add-pauses)
- [API Create speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)
