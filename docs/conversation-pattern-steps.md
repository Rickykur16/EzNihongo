# Percakapan per pola tata bahasa

Pelajaran Percakapan N5 dan N4 menampilkan satu kartu pola tata bahasa pada
satu waktu. Seluruh ucapan, panggung, tujuan komunikasi, arahan menyimak,
terjemahan, furigana, dan cek pemahaman milik pola itu tetap berada bersama.
Ucapan dalam dialog tidak disembunyikan satu per satu.

- Urutan mengikuti `lessonDialogues(source)` yang sudah dipakai pelajaran.
- Indikator `Percakapan 1 dari N` dan tombol sebelumnya/berikutnya memindahkan
  kartu aktif. Judul pola mendapat fokus dan digulir ke bawah header siswa.
- Perpindahan kartu menghentikan audio kartu lama, termasuk request audio yang
  sedang dimuat. Memilih kartu baru tidak otomatis memutar audio.
- Kartu dipertahankan di DOM agar jawaban, feedback, arti yang dibuka, dan cache
  audio tidak hilang saat kembali. Kartu tersembunyi tidak masuk urutan Tab.
- Tombol penyelesaian pelajaran tampil pada kartu terakhir. Pelajaran dengan
  satu dialog langsung menampilkan tombol penyelesaian dan tanpa navigasi pola.
  Pelajaran kosong tetap menggunakan pesan dan navigasi yang sudah ada.
- Refresh membuka kartu pertama. Pergantian pola tidak menulis progres atau XP;
  penyelesaian tetap menggunakan ID pelajaran Percakapan yang sama.
- Modul langkah hanya dipasang pada N5/N4. Pemutar audio, endpoint ElevenLabs,
  isi dan identitas materi, soal, serta penilaian tidak berubah.

Verifikasi: pengujian renderer asli N5/N4, navigasi batas/bolak-balik, satu dan
nol dialog, penghentian pemutar lama, fokus keyboard, serta state kartu yang
tetap tersimpan. Pratinjau browser memakai contoh terbit dari N5 Bab 9 dan N4
Bab 1, renderer/pemutar asli, dan layanan audio yang sudah ada.
