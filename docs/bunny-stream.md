# Video pelajaran dengan Bunny Stream

Di Ruang Kerja, buka Pelajaran, lalu pilih pelajaran bertipe Video atau Kana.
Pada Sumber video pilih **Tambah video Bunny Stream**, tempel tautan **Embed**
atau **Play** dari dashboard Bunny dan beri nama agar mudah dipilih kembali.
Isi Mulai dengan `mm:ss` atau `hh:mm:ss`; Selesai boleh kosong untuk memutar
sampai akhir video. Sumber yang tersimpan bisa dipakai pada pelajaran lain.
Video kosakata (Deck) memakai kolom URL video langsung. URL Play otomatis
diubah menjadi URL Embed, dengan autoplay dimatikan.

Migrasi 205 menambah provider Bunny. Migrasi 206 memasang video yang diberikan
pemilik untuk Bab 1 N5 dengan slug lama `hiragana-katakana`. Migrasi 207
menghubungkan pelajaran Video/Kana pada slug saat ini, `n5-b1`.
Migrasi 208 memasang video Katakana untuk Bab 2 N5, modul `n5-b2`.
Migrasi 209 memasang video Bab 3–9 pada pelajaran Video/Kana di modul
`n5-b3` sampai `n5-b9`; tautan lama dicadangkan di
`bunny_bab3_9_video_backup_209`.
ID pelajaran, progres, kuis, dan rentang waktu yang tersimpan tetap dipakai.
Sumber YouTube lama tidak diubah, sehingga bab lain tetap bisa menggunakannya.
Pilihan sumber/URL semula disimpan di `bunny_bab1_video_backup_206` dan
`bunny_bab2_video_backup_208` untuk pemulihan.
Rentang lama perlu cocok dengan timeline file yang diunggah ke Bunny; sesuaikan
Mulai/Selesai di editor jika videonya sudah dipotong atau diedit.

Library: `770041`. Video Bab 1: `0495cf1c-2e6b-4306-b94e-fa08ce239e2a`.
Video Bab 2: `69a9a519-d9c2-4430-a9b8-f887cbb4bd88`.

| Bab N5 | ID video Bunny |
| --- | --- |
| 3 | `20d7ff66-f606-4de0-8225-3c26fcf909b8` |
| 4 | `3f389515-d086-4467-9238-43bace8a6d8c` |
| 5 | `5a849ce6-ea38-4b4f-bcd9-087a668dafbd` |
| 6 | `57d00353-1f07-4b5c-b142-c19584b2eb1f` |
| 7 | `194c12a4-8d66-495f-be92-d7baf50566d5` |
| 8 | `78a336c3-8150-43cd-8890-6871434ebe1b` |
| 9 | `2b746361-5ba3-4c08-9281-d6c503d74449` |

Izinkan domain website di pengaturan keamanan library Bunny. Pemutar mengirim
origin melalui `strict-origin-when-cross-origin`. Jika server memakai CSP,
izinkan `https://player.mediadelivery.net` di `frame-src` dan
`https://assets.mediadelivery.net` di `script-src`.

Integrasi ini memakai URL embed tanpa token sementara. Untuk library dengan
Embed Token Authentication, diperlukan penandatanganan URL di backend;
jangan menyimpan tautan bertoken yang akan kedaluwarsa sebagai sumber video.
Tidak perlu API key untuk integrasi embed ini.

Rujukan: [Embedding](https://bunny.net/docs/stream/embedding) dan
[Playback control API](https://bunny.net/docs/stream/playback-api).
