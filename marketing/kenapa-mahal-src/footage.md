# Daftar footage sinematik (B-roll asli, gaya video referensi)

Pemilik ingin B-roll video sungguhan yang sinematik & dramatis, bukan hanya grafik kanvas.
Footage diambil dari Pexels (gratis, boleh dipakai komersial tanpa atribusi). Grafik yang
sudah ada (screenshot komentar, angka, chip, caption) tetap di atas footage; latar kanvas
diganti footage yang di-grade gelap (kontras tinggi, sedikit teal/oranye, vinyet, butiran film).

Ambil versi vertikal (Portrait) kalau ada, resolusi HD/Full HD, durasi minimal 6 detik.
Hindari klip yang memperlihatkan wajah jelas + logo/nama perusahaan (supaya tidak terkesan
menuduh orang/lembaga nyata).

| # | Detik (perkiraan) | Adegan | Kata kunci pencarian Pexels | Mood |
|---|---|---|---|---|
| 1 | 0–7 | Hook: tumpukan komentar | `counting money hands dark`, `rupiah` | uang, tegang |
| 2 | 7–15 | "Biasanya ulah oknum" | `handshake money under table`, `signing contract dark office` | gelap, curiga |
| 3 | 15–24 | Dana talangan, cicilan 2 tahun | `worried man bills night`, `calculator debt` | berat, lelah |
| 4 | 24–28 | Jaminan sertifikat rumah | `house keys hand over`, `documents hand dark` | bahaya |
| 5 | 28–33 | Cek sebelum bayar | `typing laptop night close up`, `reading contract` | fokus |
| 6 | 33–40 | Jalur lain: SSW mandiri | `studying notebook desk lamp`, `airplane window sunrise` | harapan, terang |
| 7 | 40–44 | Penutup: link di bio | `tokyo street night`, `shibuya crossing slow motion` | Jepang, megah |

Simpan dengan nama `b1.mp4` … `b7.mp4` sesuai nomor baris.

## Dipakai di draf pertama (13 Okt 2026): 8 foto dari pemilik

Pemilik mengirim screenshot hasil pencarian gambar. Foto dipotong 9:16 dari screenshot itu,
diperbesar ke 1080×1920, lalu di-zoom pelan oleh `compose.py`. Foto TIDAK di-commit (hak cipta
sumbernya belum jelas); simpan lokal sebagai `b1.jpg` dst.

| File | Isi | Sumber di screenshot |
|---|---|---|
| b1 | tangan menghitung uang dolar, latar hitam | tanpa nama situs (stok) |
| b2 | serah terima uang malam hari | musavat.com |
| b3 | pria pusing memegang tagihan "PAST DUE" | consumeraffairs.com |
| b4 | serah terima kunci rumah | tanpa nama situs ("Real estate agent handing over house k…") |
| b5 | tangan mengetik laptop, cahaya biru | tanpa nama situs ("Close Up Of Woman Using Laptop At H…") |
| b6 | pemuda belajar dengan lampu meja malam | mentalidades.mx |
| b6b | jendela pesawat, matahari terbit di atas awan | hospitalityonline.com |
| b7 | jalanan Shinjuku/Kabukicho malam | getaroundjapan.jp |

Catatan: (1) foto dari situs berita/blog belum tentu boleh dipakai ulang untuk iklan; untuk
versi yang diposting, lebih aman ganti dengan foto Pexels yang mirip (kata kunci di tabel atas).
(2) Uang di b1/b2 dolar, bukan rupiah. (3) Resolusi asli ±780 px tinggi → diperbesar ±2,5×,
jadi agak lembut; butiran film + grade gelap menyamarkannya.

## Versi 2 (13 Okt 2026): 4 foto diganti karena TikTok memberi label "AI-generated"

Diduga dari foto b1/b2/b3/b6 versi pertama yang berciri gambar AI (video kita tanpa metadata
C2PA, jadi label kemungkinan dari model deteksi TikTok). Diganti foto dari pemilik:

| File | Isi baru | Catatan |
|---|---|---|
| b1 | tangan memegang uang Rp100.000 | judul "INDONESIA-ECONOMY-FOREX" = foto berita (gaya AFP/Getty), lisensi editorial, BUKAN untuk promosi; ganti foto Pexels kalau ada klaim |
| b2 | serah terima uang dolar di bawah meja | stok ("Bribery, Hands passing money under ta…") |
| b3 | pria Asia pusing memegang tagihan + kalkulator | stok ("Stressed Man Reviewing Bills and Calc…") |
| b6 | pria menulis di meja malam, lampu & monitor | foto asli resolusi penuh (1200×1442); dicerahkan (gamma 0,6) & hijaunya dikurangi |

Kalau label AI tetap muncul setelah ini, tersangka berikutnya suara ElevenLabs.
