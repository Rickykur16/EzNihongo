# Assessment N5: revisi ambiguitas Bab 4–20

Bank `n5-assessment-v4` menutup 24 temuan audit editorial: 18 butir perlu revisi, lima perbaikan redaksi, dan satu risiko susunan alternatif. ID/nomor sumber tercatat dalam `backend/content/assessments/jlpt/revised.mjs`. Seluruh 408 soal tetap tampil 24 per bab dengan distribusi 6/10/4/4. Bab 3 tidak berubah.

- Bab 5 nomor 13: jadwal 09.00–12.00 membatasi urutan dua waktu pada ★. Bab 7 nomor 14 dan Bab 18 nomor 14 menggabungkan potongan yang sebelumnya memungkinkan fungsi/posisi alternatif.
- Parafrasa mempertahankan asal/tujuan, frekuensi, waktu, dan fungsi ujaran. Bab 14 nomor 6 diganti menjadi padanan bentuk biasa–sopan negatif lampau (goal1), bukan menyamakan kewajiban dengan kebiasaan. Goal3 tetap diuji butir kewajiban, bacaan, dan listening lainnya.
- Bab 12 nomor 4–5 memakai pertanyaan waktu bangun/tidur yang eksplisit. Ini sengaja isian kosakata dasar; urutan kegiatan tetap diuji pada grammar, bacaan, dan listening. Tidak mengandalkan asumsi jam tidur semua orang sama.
- Bab 16 menyebut frekuensi yang terukur dan mempertahankan nama Anna saat subjek berganti dari Hadi. Bab 20 mempertahankan parafrasa pengalaman; tidak menggandakannya dengan soal grammar.
- Empat naskah listening berubah: Bab 4 nomor 22, Bab 6 nomor 23, Bab 14 nomor 21, Bab 18 nomor 23. Pemilihan suara per karakter tetap disalin dari soal sebelumnya, termasuk konfigurasi null. Hash cache TTS mencakup naskah dan suara; naskah baru dirender ElevenLabs melalui jalur yang sama saat diputar. Tidak menghapus cache lama.
- Gambar Bab 6 dan 18 memakai URL revisi baru. Label A/B khusus orang; tas Bab 18 dibedakan warna. Gambar lama tetap tersedia untuk snapshot lama.

Migrasi 175 menyalin bank v3 ke ID baru. Hanya 24 butir audit diganti dari sumber penulisan; redaksi/opsi/gambar/kunci admin pada 384 butir lainnya disalin dari database, bukan direset dari source. Semua audio_scene disalin, tautan grammar tetap dipertahankan, dan judul, konten preview, aturan, serta jumlah soal tidak direset. Bank lama, jawaban, draft, dan snapshot tetap tersedia. Preview siswa hanya menampilkan satu tindakan biasa: Mulai assessment memilih bank aktif secara internal, sedangkan Lanjutkan jawaban melanjutkan sesi yang masih memakai bank aktif. Sesi usang diarsipkan atomik ketika siswa menekan Mulai assessment; membaca preview tidak membuat atau mengganti sesi. Jawaban sesi yang diarsipkan tetap tersimpan, tidak disalin ke soal yang berubah. Tidak ada redirect wajib atau start otomatis.

## Pemeriksaan

Uji migrasi memeriksa kegagalan atomik, 408 baris aktif, aturan opsi/kategori, pelestarian edit admin dan suara termasuk null, riwayat, serta keamanan rerun. Uji HTTP memeriksa resume v3, perpindahan eksplisit v4, 24 soal, privasi payload, audio baru, dan penilaian. Uji generator menjaga migrasi 172 dan sumber historisnya tetap sama; migrasi 175 diperiksa terhadap generator baru.

Review editorial tidak membuktikan validitas psikometrik. Semua naskah direvisi secara tekstual; seluruh hasil suara belum diaudit satu per satu. Kosakata/pola revisi mengikuti materi kumulatif; petunjuk memilih jawaban pada audio Bab 4 merupakan petunjuk tugas, bukan bunpou yang dinilai.

Acuan: [tujuan resmi butir N5](https://www.jlpt.jp/e/guideline/pdf/n5_e_revised.pdf) dan [contoh resmi tata bahasa N5](https://www.jlpt.jp/samples/sample2018/pdf/N5G.pdf). Gabungan partikel へは／には／では tetap diperbolehkan bila konteks membutuhkannya; tidak ada penghapusan massal partikel yang benar.
