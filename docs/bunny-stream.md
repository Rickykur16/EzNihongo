# Video pelajaran dengan Bunny Stream

Di Ruang Kerja, buka Pelajaran, lalu pilih pelajaran bertipe Video atau Kana.
Pada Sumber video pilih **Tambah video Bunny Stream**, tempel tautan **Embed**
atau **Play** dari dashboard Bunny dan beri nama agar mudah dipilih kembali.
Isi Mulai dengan `mm:ss` atau `hh:mm:ss`; Selesai boleh kosong untuk memutar
sampai akhir video. Sumber yang tersimpan bisa dipakai pada pelajaran lain.
Video kosakata (Deck) memakai kolom URL video langsung. URL Play otomatis
diubah menjadi URL Embed, dengan autoplay dimatikan.

Migrasi 205 menambah provider Bunny. Migrasi 206 memasang video yang diberikan
pemilik untuk Bab 1 N5, modul `hiragana-katakana`, pada pelajaran Video/Kana.
ID pelajaran, progres, kuis, dan rentang waktu yang tersimpan tetap dipakai.
Sumber YouTube lama tidak diubah, sehingga bab lain tetap bisa menggunakannya.
Pilihan sumber/URL semula disimpan di `bunny_bab1_video_backup_206` untuk pemulihan.
Rentang lama perlu cocok dengan timeline file yang diunggah ke Bunny; sesuaikan
Mulai/Selesai di editor jika videonya sudah dipotong atau diedit.

Library: `770041`. Video Bab 1: `0495cf1c-2e6b-4306-b94e-fa08ce239e2a`.

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
