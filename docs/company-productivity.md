# Productivity divisi non-Akademik

Paket lanjutan di atas unified admin PR #306. Tidak menambah backend endpoint, dependency, migration, database, role, atau sakelar aktivasi. Academic editor, materi, kuis, pembayaran, dan dashboard siswa tetap menggunakan implementasi existing.

## Fitur dan cara pakai

| Area | Penambahan | Alur |
| --- | --- | --- |
| Navigasi | Cari menu dengan alias Indonesia dan Ctrl/Cmd+K | Ketik fungsi/divisi, pilih hasil atau Enter. Hanya menu yang sudah diizinkan; bukan pencarian isi data siswa. |
| Technology | Template bug, fitur, dan rilis; riwayat; pesan konflik versi | Buat pekerjaan → pilih jenis → buka template SOP → lengkapi kriteria/PJ/target → Simpan. Status rilis tetap memerlukan bukti dari aturan existing. |
| Marketing | Template evaluasi, kampanye, konten; salin UTM | Simpan tujuan kampanye → buka detail → buat UTM → salin. Bila clipboard ditolak, salin manual. Tidak menerbitkan konten/iklan atau mengklaim atribusi penjualan. |
| Operasional | Template tindak lanjut layanan, pencarian dan filter penugasan/prioritas | Cari kasus/pekerjaan → tetapkan PJ/target → tindak lanjuti → review. Sinkronisasi kasus tetap manual lewat endpoint existing. |
| Finance | Template review dan pintasan dari kasus ke pesanan asal | Buka kasus → Buka pesanan terkait → tinjau di editor transaksi existing. Pintasan hanya bagi pemilik izin Pesanan, bukan staf course-scoped. Tidak menyetujui pembayaran otomatis. |
| Data & Insights | Ringkasan → draf tindak lanjut di divisi terpilih | Pilih divisi/kursus → Muat ringkasan → Buat tindak lanjut → lengkapi PJ/target → Simpan. Membuka atau membatalkan draf tidak membuat record. |

Semua board non-Akademik memiliki pencarian judul/catatan, filter pekerjaan saya/belum ditugaskan, prioritas, status, dan pagination server existing. Riwayat dimuat saat dibuka, maksimal 100 event terakhir; hanya jenis perubahan, versi, dan waktu yang memang disediakan API. Tidak mengarang identitas pelaku atau riwayat sebelum pencatatan.

Academic tidak mendapatkan template, filter tambahan, riwayat baru, atau tombol tindak lanjut Insights dalam paket ini. Pengamanan pengiriman formulir bersama tetap berlaku, tanpa mengubah materi atau aturan bisnis Akademik.

## Batas data dan keamanan operasional

- Insights tetap dihitung saat diminta dengan cache maksimal 5 menit, bukan pengambilan otomatis terjadwal. Definisi, minimum sampel dan sumber tetap pada `company-insights-guide.js` serta `insights-measurement-plan.md`.
- Draf hanya menyalin kursus, periode, snapshot dan persentase agregat yang sudah boleh ditampilkan. Angka tersupresi tidak diubah menjadi nol. Tidak menyalin identitas, jawaban, atau catatan pribadi siswa.
- Izin membaca Insights tidak otomatis menjadi izin menulis pekerjaan: cakupan work divisi/kursus diperiksa terpisah di UI, lalu server existing tetap mengotorisasi setiap save.
- Template hanya mengisi judul/catatan draf. Penggantian teks meminta konfirmasi. Draf tidak disimpan di localStorage atau server sebelum pengguna menekan Simpan.
- Menutup/berganti menu dari draf non-Akademik yang berubah meminta konfirmasi. Perubahan detail harus disimpan sebelum transisi status. Konflik versi mempertahankan isi formulir dan tidak mencoba overwrite otomatis.
- Draf belum memiliki autosave/pemulihan setelah refresh/logout. Jangan masukkan PII/rahasia pada catatan pekerjaan.
- Request penanggung jawab, riwayat, laporan, dan UTM yang kedaluwarsa tidak boleh mengisi editor/view berbeda. Penyimpanan dibatasi selama daftar penanggung jawab belum siap.

## Rollout dan rollback

1. Review draft PR dan pengujian, lalu minta persetujuan merge terpisah.
2. Pipeline existing menjalankan migrasi standar saat deploy; paket ini tidak menambahkan migration. Jangan menjalankan runner Company atau mengaktifkan sakelar produksi sebagai bagian dari paket ini.
3. Menu pencarian bekerja saat Company dimatikan. Board/SOP/riwayat/Insights memerlukan modul existing yang sudah diaktifkan dengan schema/izin yang sesuai. Deployment UI tidak mengaktifkannya.
4. Uji dengan akun owner dan staf terbatas: login, menu, kursus/materi/kuis, pesanan, pembatasan kursus, dan draft Insights.
5. Bila UI perlu rollback, redeploy commit release sebelumnya melalui proses normal. Tidak perlu menghapus tabel atau data pekerjaan; jangan menimpa database dengan snapshot lama.

## Pengujian

Suite mencakup browser Edge headless dan PostgreSQL lokal dengan schema sekali pakai: semua lima role, izin kursus, Company nonaktif, pencarian/keyboard/mobile, template tanpa save otomatis, batal draf, konflik versi, riwayat, filter, UTM, pintasan Finance dan akses course-scoped. Pengujian membandingkan baris sumber siswa/transaksi sebelum dan sesudah. Tidak membuka sesi produksi atau menggunakan database produksi.
