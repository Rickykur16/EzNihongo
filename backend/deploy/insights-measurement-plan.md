# Data & Insights untuk keputusan pengembangan EzNihongo

12 September 2026. Referensi ditinjau dari penerbit/penulis primer. Pilihan metrik, prioritas dan ambang operasional di bawah merupakan adaptasi untuk EzNihongo, **bukan standar universal atau klaim bahwa sumber tersebut memvalidasi dashboard ini**.

## Prinsip pemilihan

Mulai dari tujuan siswa dan keputusan tim, baru memilih sinyal serta perhitungan. Pendekatan pemetaan tujuan ke metrik mengacu pada [Google Research, Rodden dkk., CHI 2010](https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/). Karena EzNihongo adalah produk pendidikan, aktivitas dan penyelesaian harus dibaca bersama bukti hasil belajar, bukan dijadikan penggantinya.

Untuk tim kecil, satu metrik hanya layak dimuat bila memiliki pemilik dan tindakan yang mungkin berubah karena angkanya. Tidak membuat divisi Data baru; Product & Technology memelihara definisi dan perhitungan, pemilik domain menafsirkan hasil.

## Enam kelompok informasi penting

### 1. Hasil belajar — Academic + Product

Pertanyaan: apakah siswa memahami dan dapat mengingat materi, bukan sekadar menyelesaikan layar?

IES/What Works Clearinghouse merekomendasikan pembelajaran bersela dan penggunaan kuis untuk mengulang pengambilan pengetahuan; tingkat bukti berbeda antar rekomendasi. Dasar ini mendukung evaluasi hasil belajar setelah jeda, tetapi tidak menetapkan rumus analytics EzNihongo. [Panduan IES/WWC, 2007](https://ies.ed.gov/ncee/wwc/PracticeGuide/1).

- Tersedia di MVP: kesalahan kuis per pelajaran berbobot sama per siswa, serta completion pasangan siswa–pelajaran aktif sebagai konteks.
- Berikutnya: delayed recall per kompetensi, pola kesalahan, perubahan hasil asesmen yang sebanding, dan kebutuhan pengulangan.
- Data minimum tambahan: concept/skill ID stabil, versi materi/soal, assessment form, konteks latihan dan jeda sejak belajar sebelumnya. Jangan menyamakan FSRS predicted mastery dengan tes retensi yang benar-benar diamati.
- Keputusan: revisi penjelasan/soal, urutan kurikulum, atau dukungan pengajar. Nilai rendah adalah sinyal pemeriksaan; belum membuktikan materi buruk.

### 2. Pengalaman dan perjalanan siswa — Product + Operations

Penerapan pendekatan user-centered Google untuk EzNihongo: ukur apakah tujuan belajar berhasil, bukan hanya traffic.

- Tersedia: aktivasi enrollment ≤168 jam, kembali belajar antarminggu, completion terbatas pada pelajaran yang aktif.
- Berikutnya: start→submit success rate, adopsi fitur dengan denominator pengguna yang benar-benar mendapat akses/exposure, hambatan per langkah, feedback kemudahan dan kepuasan.
- Data minimum tambahan: event start/success/failure, flow/session correlation yang dibatasi retensinya, versi aplikasi, feature exposure; survei sukarela dengan alasan pengambilan sampel.
- Keputusan: perbaikan onboarding/navigasi/bantuan. Waktu lama bisa berarti kesulitan; jumlah klik atau lama belajar tidak dipakai sendirian sebagai bukti keberhasilan.

### 3. Kualitas pengukuran — Product & Technology

Microsoft membedakan kualitas data, hasil utama, diagnosis fitur dan guardrail dalam evaluasi perubahan. Angka yang membaik tidak cukup bila pencatatannya berubah atau aspek lain memburuk. [Microsoft Research, 2021](https://www.microsoft.com/en-us/research/articles/patterns-of-trustworthy-experimentation-during-experiment-stage/).

- Tersedia: definisi, denominator, periode UTC, snapshot, status sampel dan rasio record latihan bertag course yang terhubung ke lesson valid.
- Berikutnya: kehilangan/duplikasi event, keterlambatan, cakupan setiap sumber, perbedaan versi instrumentation dan validitas kelompok eksperimen.
- Data minimum tambahan: event ID idempoten, occurred_at/received_at yang jelas, schema version dan pemeriksaan join. Rasio keterhubungan yang tersedia **bukan** estimasi seluruh aktivitas yang tidak pernah tercatat.
- Keputusan: perbaiki data dahulu bila coverage berubah; tampilkan unknown/suppressed, jangan mengisi nol atau menyimpulkan tren historis tanpa cakupan sebanding.

### 4. Keandalan produk — Product & Technology

Google SRE menyarankan pemantauan latency, traffic, errors, dan saturation, termasuk latensi ekor agar rata-rata tidak menyembunyikan pengalaman buruk. [Google SRE, Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/).

- Belum terhubung ke Insights. Health check setelah deploy bukan histori availability.
- Prioritas: keberhasilan login/memuat materi/submit/simpan progres, p95/p99 latency, error rate, beban koneksi DB dan kapasitas VPS.
- Data minimum: agregat route/status/latency, deployment version, periode, request count dan synthetic checks yang diberi label terpisah dari siswa nyata. Jangan merekam Authorization, jawaban, email atau URL query pribadi.
- Keputusan: dahulukan regresi yang memblokir belajar; target layanan ditetapkan dari baseline dan kebutuhan bisnis, bukan menyalin SLA perusahaan besar.

### 5. Kinerja pengiriman perubahan — Product & Technology

DORA saat ditinjau menggunakan lima ukuran: change lead time, deployment frequency, failed deployment recovery time, change fail rate, deployment rework rate. Ukur satu layanan dalam konteksnya. [DORA, software delivery performance metrics](https://dora.dev/guides/dora-metrics/).

- Belum terukur otomatis. Board rilis manual tidak diperlakukan sebagai event deploy terverifikasi.
- Data minimum: commit SHA, deploy ID, lingkungan, waktu/status deployment, incident ID, rollback/hotfix dan relasinya; preview/CI run bukan deploy produksi.
- Keputusan: hilangkan bottleneck review/rilis dan kegagalan berulang. Bukan penilaian individu dari commit, story point atau baris kode.

### 6. Dampak keputusan dan keberlanjutan bisnis — Pemilik + Product + Growth + Finance

Adaptasi klasifikasi metrik Microsoft: setiap perubahan menyebut hasil yang diharapkan, diagnosis, validitas data dan batas yang tidak boleh memburuk; bukan sekadar membandingkan satu angka sebelum/sesudah.

- Belum tersedia: eksperimen terkontrol, atribusi kampanye, pendapatan/biaya layanan pada Insights.
- Kebutuhan berikutnya: hipotesis, cohort/exposure, metrik hasil utama dan guardrail, tanggal/versi rilis, evaluasi terjadwal dan keputusan lanjut/revisi/hentikan. Sampel, durasi dan metode evaluasi ditentukan sebelum eksperimen.
- Bila menilai dampak bisnis, gunakan order/payment/refund terverifikasi, biaya layanan tercatat dan atribusi berizin; jangan menebak revenue dari UTM atau mengirim jawaban siswa ke Marketing.
- Keputusan: prioritas investasi fitur dan pengurangan kerja manual. Learning outcomes dan keselamatan/progres tetap batas penting, bukan dikalahkan oleh naiknya engagement.

## Kontrak wajib setiap angka

Sertakan tujuan/pertanyaan, pemilik, satuan, pembilang, penyebut, population/cohort, rentang waktu/timezone, sumber, versi definisi, waktu snapshot, coverage yang diketahui, batas sampel, dan tindakan yang mungkin diambil. Perubahan definisi tidak boleh disamarkan sebagai pertumbuhan.

Ambang 10 siswa, cache 5 menit, fixed UTC weeks dan limit 20 materi adalah keputusan MVP untuk mengurangi risiko/biaya, bukan ambang ilmiah dari sumber di atas. Sampel kecil dan overlap tetap memerlukan review privasi; tidak ada klaim anonymization atau signifikansi statistik otomatis.

## Urutan implementasi dengan infra existing

1. Paket saat ini: empat ringkasan terhitung (aktivasi, completion, kembali belajar, keterhubungan latihan), daftar review materi untuk Academic/Technology, serta panduan enam kelompok dengan sumber dan status kesiapan data.
2. Validasi coverage dan performa pada staging schema lengkap; audit pemetaan course, pencatatan historis, grants dan budget koneksi. Tidak perlu database per divisi atau vendor analytics baru.
3. Tambahkan instrumentasi minimum untuk task success/feedback/observability melalui perubahan terpisah berflag. Review consent/retensi/erasure dan sampling sebelum data personal baru disimpan. Kegagalan telemetry tidak boleh menggagalkan submit atau payment.
4. Setelah event dapat dipercaya, sambungkan histori rilis/insiden, evaluasi delayed recall yang sah, dan kaitan hasil bisnis. Jangan membuka semua kategori lewat akses DB mentah untuk semua divisi.

Ritme tim yang diusulkan: review mingguan singkat, pilih sedikit masalah berdampak besar, buat satu pemilik per tugas, catat bukti/keterbatasan/hipotesis/hasil yang diharapkan/guardrail, lalu evaluasi setelah perubahan. Tidak ada auto-publish, auto-eksperimen, penilaian pegawai, atau perombakan dashboard siswa dalam paket ini.
