# Bunpou satu pola per tampilan

N5 dan N4 menampilkan satu kartu pola Bunpou beserta rangkaian soalnya pada
satu waktu. Indikator `Pola 1 dari N` dan tombol sebelumnya/berikutnya berlaku
pada halaman latihan maupun popup tugas yang memakai `gtCardsHtml`.

- Urutan, indeks pola/slot, ID grammar, ID item sesi, serta jumlah kalimat
  mengikuti data lama. Kartu lain disembunyikan tanpa dibuat ulang, sehingga
  draf ketikan, susunan kata, jawaban, feedback, dan langkah yang terbuka tetap
  tersedia saat siswa kembali.
- Semua pola boleh dibuka. Kunci langkah dalam pola dan syarat kelulusan tetap
  dikelola handler Bunpou yang sudah ada. Mengunjungi pola terakhir tidak
  meluluskan tugas; pager hanya menampilkan tombol penyelesaian di pola terakhir.
- Contoh audio dihentikan saat pindah pola. Rekaman atau transkripsi aktif
  harus selesai sebelum navigasi, agar suara tidak dibuang atau terus direkam
  pada kartu tersembunyi. Penilaian kalimat yang sudah dikirim boleh selesai
  di kartu asal tanpa memindahkan siswa ke sana.
- Navigasi memakai tombol biasa dan memindahkan fokus ke judul pola baru.
  Kartu tersembunyi keluar dari urutan Tab. Satu pola tidak membutuhkan tombol
  navigasi; materi kosong tetap memakai pesan lama.
- Sesi, endpoint penilaian/transkripsi, penyimpanan progres, XP, serta kebijakan
  fallback/error tidak diubah. Refresh tetap memulihkan jawaban lewat sesi yang
  ada dan membuka kartu pertama.

Verifikasi mencakup renderer asli N5/N4, mode ketik dan bicara, halaman/popup,
navigasi bolak-balik, batas dan jumlah pola, draft/feedback terlambat, gate
rekaman, serta `gtUpdateComplete` asli. Pratinjau browser memakai renderer dan
handler asli dengan data/API uji lokal; tidak menulis jawaban ke akun siswa.
