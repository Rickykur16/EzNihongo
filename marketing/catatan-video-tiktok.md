# Catatan membuat video TikTok EzNihongo

> **Untuk AI (Claude):** baca seluruh file ini SEBELUM membuat naskah atau video TikTok/Reels
> untuk EzNihongo. Ikuti bagian 3–7 sebagai aturan default; keputusan pemilik di chat tetap
> menang. Setelah pemilik mengirim analitik video baru, TAMBAHKAN barisnya ke tabel bagian 9
> dan perbarui bagian 2–3 kalau polanya berubah. Jangan hapus data video lama.

Pegangan untuk video berikutnya, disusun dari video pertama yang masuk FYP:
**"Biaya Tokutei Ginou mandiri, dibedah satu per satu"** (diposting 10 Okt 2026, 65 detik).
Sumber video & cara render: `biaya-ssw-src/README.md`.

---

## 1. Hasil video pertama (data TikTok, 11 Okt 2026)

| Metrik | Angka | Artinya |
|---|---|---|
| Tayangan | 24,3 rb (97,1% dari FYP) | Hampir semua dari rekomendasi, bukan dari follower |
| Suka | 1.842 (±7,6%) | Tinggi untuk akun edukasi |
| Simpan | 973 (±4%) | **Sinyal terkuat**: orang menyimpan sebagai catatan |
| Dibagikan | 259 | Dikirim ke teman/keluarga yang mau berangkat |
| Komentar | 51 | |
| Pengikut baru | 210 | ±1 dari 115 penonton follow |
| Rata-rata ditonton | 20,3 dtk dari 65 dtk (31%) | |
| Ditonton sampai habis | 8,13% | Rendah, CTA di akhir jarang terlihat |
| Titik paling banyak berhenti | **detik 0:02** | Sekitar separuh penonton pergi sebelum detik 3 |

**Kesimpulan:** isinya berhasil (simpan & follow tinggi), pembukanya yang bocor.
Setelah detik 3, kurva retensi landai: orang yang lolos pembuka cenderung bertahan.

---

## 2. Yang terbukti jalan (pertahankan)

- **Topik uang + rincian angka resmi.** "Berapa biayanya" adalah pertanyaan nyata calon pekerja.
  Angka spesifik (Rp30.000, Rp1.650.000) lebih dipercaya daripada "murah kok".
- **Format "dibedah satu per satu".** Satu item = satu adegan pendek, ada nomor "BAGIAN 0X / 09"
  supaya penonton tahu masih ada lanjutannya.
- **Gaya visual referensi:** kanvas hitam, judul kotak merah di atas, panel 16:9 di tengah,
  kotak putih hook di bawah, teks kapital putih + label merah, ilustrasi sketsa garis,
  kartu kertas mesin ketik per bagian.
- **Struk di akhir** sebelum angka total: memberi rasa "semua sudah dihitung".
- **Kejujuran angka:** "mulai", "maksimal", "perkiraan", "belum bagasi". Tidak ada yang
  protes soal angka di komentar.
- **Caption dibuka dengan pertanyaan** ("Kalian tim TG mandiri atau lewat LPK? 👇") untuk memancing komentar.

---

## 3. Yang harus diperbaiki di video berikutnya

### a. Tiga detik pertama (paling penting)
- **Frame 0 harus sudah berisi angka/klaim utama**, besar dan terbaca, SEBELUM narasi
  menyebutnya. Di video pertama, "Rp8 JUTAAN" baru muncul di detik ±1,8 dan frame 0 berupa
  foto gelap kosong. Itu kemungkinan besar penyebab bocor di 0:02.
- **Judul merah & kotak putih tampil penuh sejak frame 0**, tanpa animasi masuk.
- **Latar frame pertama jangan gelap/redup.** Pakai panel merah atau foto yang lebih terang.
- Uji cepat: screenshot frame 0 dan lihat sekilas 1 detik di HP. Kalau tidak langsung
  tahu videonya tentang apa, ganti.

### b. Durasi
- Target **35–45 detik** (video pertama 65 detik, rata-rata ditonton 20 detik).
- Gabungkan item kecil dalam satu frame, contoh: "SKCK 30rb · e-KTKLN gratis · BPJS 370rb".
- Hapus kalimat yang tidak menambah angka/informasi.

### c. CTA
- Hanya 8% yang sampai akhir, jadi **jangan taruh CTA hanya di akhir**.
  Sisipkan sekali di tengah secara halus (mis. label kecil "simpan dulu biar nggak lupa").

### d. Cover
- Set cover ke frame yang ada angkanya, bukan frame pertama yang gelap.

---

## 4. Aturan naskah

- **Hook 1 kalimat, ada angka, ada siapa sasarannya.**
  Contoh yang dipakai: "Kerja di Jepang modal mulai delapan jutaan. Ini lewat jalur SSW, tanpa LPK."
- **Angka harus cocok antara hook dan akhir video.** Keputusan video pertama: pakai
  "mulai 8 jutaan", bukan "cuma 8 juta", karena totalnya Rp8,1–9,2 juta. Angka yang
  bertabrakan mengundang komentar "katanya cuma".
- **Jelaskan jalurnya di frame kedua** (SSW / Tokutei Ginou, tanpa LPK). "Kerja di Jepang"
  saja terlalu luas: magang, Ryugaku, Gijinkoku biayanya beda.
- **Selalu sebut syarat angka total:** lulus ujian sekali, belum bagasi, belum biaya belajar bahasa.
- **Kalimat pendek**, satu informasi per kalimat. Angka ditulis huruf ("tiga puluh ribu").
- **Tanpa nada AI:** hindari em dash, titik koma, kalimat slogan berirama.

### Larangan yang masih berlaku (dari brief pemilik)
- Jangan janji kerja, lulus ujian, visa, atau tanggal berangkat.
- Jangan sebut biaya penempatan.
- Jangan pakai testimoni/alumni/logo mitra karangan.
- Angka total & menyinggung LPK di konten: **keputusan pemilik per video** (video pertama:
  total dipakai, ajakan "tim mandiri atau LPK" dipakai di caption).

---

## 5. Suara (ElevenLabs)

- Model: **Eleven v4**. v4 TIDAK membaca `<break>`; jeda pakai `[pause]` atau cukup baris
  kosong antar-paragraf (video pertama: tanpa tag, jeda alami sudah cukup untuk sinkron).
- Singkatan ditulis biasa (LPK, SKCK, BPJS, SSW). Cek pengucapan SKCK & e-KTKLN setelah generate.
- Generate **seluruh naskah sekaligus**, jangan sambung potongan (jeda jadi tidak konsisten).
- Kirim MP3 ke Claude: adegan dicocokkan otomatis dengan jeda audio (silencedetect).
- Kecepatan: kalau kepanjangan, naikkan Speed ke 1,1 sebelum memotong naskah.

---

## 6. Produksi (ringkas)

1. Riset angka dari sumber resmi, catat tanggal & sumbernya.
2. Tulis naskah (target 35–45 detik), cek aturan di bagian 4.
3. Generate suara ElevenLabs v4.
4. Buat/ubah adegan di HTML (template `biaya-ssw-src/video.html`, waktu adegan di `SEG`).
5. Render per frame → MP4 dengan suara (perintah lengkap di `biaya-ssw-src/README.md`).
6. Tonton sekali di HP dengan suara: cek sinkron angka & pengucapan.
7. Posting: set cover ke frame berangka, caption dibuka pertanyaan, tulis syarat angka.

---

## 7. Checklist sebelum posting

- [ ] Frame 0 sudah menunjukkan klaim/angka utama, terbaca dalam 1 detik
- [ ] Durasi ≤ 45 detik
- [ ] Angka di hook = angka di akhir (tidak bertabrakan)
- [ ] Jalur (SSW/Gijinkoku/dll.) disebut dalam 5 detik pertama
- [ ] Syarat angka tertulis (ujian lulus sekali, belum bagasi, dst.)
- [ ] Sumber & tanggal tarif dicek ulang (tarif berubah)
- [ ] Tidak ada janji kerja/visa/lulus
- [ ] Cover = frame berangka
- [ ] Caption: baris pertama pertanyaan, ada catatan "tarif bisa berubah"

---

## 8. Ide video berikutnya (dari celah video pertama)

1. **Berapa lama belajar sampai lulus JFT-Basic / JLPT N4?** Menjawab "belum termasuk biaya
   belajar bahasa" di caption video pertama, dan jembatan alami ke kelas EzNihongo.
2. **JFT-Basic vs JLPT N4, pilih yang mana?** (harga, jadwal, tingkat kesulitan)
3. **Bidang SSW yang buka & yang ditutup sementara 2026** (data sudah ada di landing:
   外食業 ditutup sementara, 3 bidang baru).
4. **Balas komentar dengan video** untuk pertanyaan yang paling sering muncul di video pertama.

---

## 9. Yang perlu diukur di video berikutnya

Bandingkan dengan video pertama, terutama:
- **Penonton yang tersisa di detik 3** (target naik dari ±50%).
- Rata-rata ditonton (%), bukan detik, karena durasinya beda.
- Rasio simpan (target tetap ±4%).

Tambahkan hasil tiap video ke tabel di bawah supaya polanya kelihatan.

| Tanggal | Judul | Durasi | Tayangan | % ditonton | Tersisa di dtk 3 | Simpan | Follow | Catatan |
|---|---|---|---|---|---|---|---|---|
| 10 Okt 2026 | Biaya TG mandiri dibedah | 65 dtk | 24,3 rb | 31% | ±50% | 973 | 210 | Pembuka gelap, angka di dtk 1,8 |
