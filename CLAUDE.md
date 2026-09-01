# EzNihongo — Catatan untuk Claude

## Pending ops / infra (jadwal: minggu ini)

- [x] **Insiden: deploy PR #189 macet lalu gagal, PR #190 tidak ke-trigger
  sama sekali** (2026-08-26). Run CI job `ci` untuk merge PR #189
  (migration 100/101, commit `84be81f`) hang 15 menit (normalnya <60s)
  lalu `cancelled`, job `deploy` ikutan `skipped` → migration 100/101
  TIDAK ter-apply ke production meski sudah di GitHub `main`. Push
  berikutnya (merge PR #190, migration 102, commit `fbc1d7b`) bahkan
  sama sekali tidak memicu run "Deploy to VPS" baru (workflow run untuk
  sha itu tidak pernah muncul di `list_workflow_runs`) — kemungkinan
  besar terkait `concurrency: group: deploy-vps, cancel-in-progress: false`
  di `deploy.yml` yang antre di belakang run yang macet, lalu entah
  kenapa tidak pernah dijalankan setelah run itu selesai. Re-run manual
  via API (`rerun_workflow_run` / `rerun_failed_jobs`) ditolak 403
  ("Resource not accessible by integration") — token yang dipakai sesi
  ini tidak punya scope `actions:write`. Root cause CI hang belum
  diketahui (kemungkinan npm registry / GitHub-hosted runner transient
  issue, bukan bug di kode kita). **Kalau kejadian lagi**: cek
  `list_workflow_runs` untuk `deploy.yml` setelah tiap merge — jangan
  asumsikan merge = ter-deploy. Fix yang dipakai: push commit baru
  (bukan commit kosong) ke `main` supaya trigger run bersih.

- [ ] **Offsite backup ke Cloudflare R2** — `RCLONE_REMOTE` di
  `/var/www/eznihongo/backend/.env` masih kosong, jadi `backup.sh` cuma
  nge-dump lokal di `/var/backups/eznihongo/`. Risiko: kalau VPS hilang
  (disk corrupt / akun suspended / hacker `rm -rf`), backup ikut hilang.
  Setup: rclone config (s3, provider Cloudflare) → `RCLONE_REMOTE=r2:eznihongo-backups`
  di `.env` → test `sudo /var/www/eznihongo/backend/deploy/backup.sh` dan
  `sudo rclone ls r2:eznihongo-backups`. Lihat session sebelumnya untuk
  step lengkapnya.

- [ ] **GPG encryption pada dump** sebelum di-upload offsite. Dump berisi
  email user + raw webhook Midtrans (PII + payment data). Tambahkan
  `gpg --symmetric --cipher-algo AES256` di `backup.sh` sebelum
  `rclone copy`. Passphrase simpan di password manager, bukan di repo.
  Hanya relevan setelah offsite hidup.

- [ ] **`pg_dumpall --globals-only`** terpisah untuk role / grant. Saat ini
  `backup.sh` cuma dump database `eznihongo` — kalau VPS rebuild dari nol,
  role `eznihongo_app` + grant-nya harus dibikin manual dulu.

- [ ] **Test restore ke staging** — tulisan ini ga akan jadi backup beneran
  sampai pernah dicoba di-restore. Minimal sekali per bulan ke Postgres
  staging / container.

- [ ] **Ownership tabel kanji** di production. Migration 008 di-bypass
  via existence-gating (`pg_indexes` / `pg_trigger`), tapi root cause
  ownership masih ada — `kanji_users`, `kanji_sessions`, `subscriptions`,
  `kanji_progress` owned oleh role lain dari `eznihongo_app`.
  Sekali waktu, sebagai superuser:
  ```sql
  ALTER TABLE kanji_users      OWNER TO eznihongo_app;
  ALTER TABLE kanji_sessions   OWNER TO eznihongo_app;
  ALTER TABLE subscriptions    OWNER TO eznihongo_app;
  ALTER TABLE kanji_progress   OWNER TO eznihongo_app;
  ```
  Tanpa ini, migrasi masa depan yang butuh `ALTER TABLE` beneran (bukan
  no-op) bakal kena "must be owner of table" lagi.

- [ ] **SSH masih sebagai `root`** di pipeline deploy
  (`.github/workflows/deploy.yml`). User `deploy` + sudoers terbatas =
  hardening berikutnya, butuh perubahan di sisi VPS.

## Konvensi penting

      **migration 129: dua contoh per pola dulu cuma tukar nama di template
      yang sama** — user: "dalam satu pembahasan pola, kamu membuat yang 1
      dan kedua dengan kalimat yg sama, harusnya jangan sama". Root cause:
      migration 126/127/128 menulis 4 pola Bab 3 (〜は〜です／
      〜は〜じゃありません／〜は〜ですか／〜も) dengan kerangka PERSIS SAMA —
      [orang]は/も [negara]の [profesi]です — cuma nama orang/negara/profesi
      yang ditukar; 2 pola Bab 4 (この／その／あの／どの + 名詞,
      だれの〜ですか) juga menukar demonstratif+kata-benda di kerangka
      identik. Tidak ketahuan di pengecekan duplikat literal (teksnya
      beda), tapi strukturnya berulang — siswa cuma berlatih SATU bentuk
      kalimat berkali-kali dengan kata diganti, bukan variasi pemakaian
      pola sesungguhnya. **Perbaikan Bab 3**: satu contoh KELUARGA (pendek,
      ditaruh pertama untuk materi Step 1) + satu contoh たなかさん dengan
      negara/institusi (≥3 bunsetsu, dipakai Step 2 susun-kalimat); profesi
      & anggota keluarga TIDAK diulang antar pola (dokter/ayah,
      perawat/ibu, karyawan/kakak laki-laki, guru/kakak perempuan) —
      kosakatanya ikut variatif, bukan cuma strukturnya. **Perbaikan
      Bab 4**: contoh kedua diganti STRUKTUR kalimatnya, bukan cuma kata
      bendanya (この／その／あの／どの + 名詞: satu predikat kepemilikan
      「わたしのです」 + satu predikat identitas 「たなかさんです」;
      だれの〜ですか: satu bentuk 「Xは だれのNですか」 + satu bentuk
      「Xは だれのですか」ᅟ— N-nya di subjek, bukan di frasa tanya).
      `129_grammar_examples_bab3_4_variety.sql` — replay DELETE+INSERT sama
      seperti 127/128, dipersempit ke Bab 3+4 (bab lain kontennya tidak
      berubah). Divalidasi: cakupan arrange TETAP 34/44 (cuma struktur yang
      diganti, jumlah bunsetsu dijaga), 0 opsi timpang/kembar; end-to-end
      lewat endpoint asli mengonfirmasi Step 1 & Step 2 keempat pola Bab 3
      sekarang genuinely beda subjek+predikat, bukan template yang diulang.
      **Belum diaudit**: pola serupa mungkin masih ada di Bab 5-11 (mis.
      おいくつですか／何歳ですか pakai umur 23 yang sama di kedua contoh,
      〜は[い-adj]くないです pakai kata sifat たかい yang sama) — belum
      diperbaiki karena belum dilaporkan, prioritas lebih rendah dari
      Bab 3/4 yang templatenya paling mencolok.

      **migration 128: kalimat pendek 2-bunsetsu selalu jatuh ke pilihan
      ganda, walau siblingnya (di Tugas Bunpou lain) sudah susun kalimat** —
      user: "Kenapa bab 3 yang bagian tugas bunpou pertama masih pilihan
      ganda sedangkan yg bagian kedua sudah susun kalimat". Root cause BUKAN
      bug aturan: 4 dari 6 pola Bab 3 (〜は〜です／〜は〜じゃありません／
      〜は〜ですか／〜も, dari 126/127) kalimat contohnya cuma 2 bunsetsu
      (topik + predikat polos, mis. "わたしは がくせいです。") — di bawah
      `MIN_ARRANGE_TOKENS` (3), SELALU jatuh ke pilihan ganda. Cuma 〜の
      (3 bunsetsu) yang jadi susun-kalimat. Karena Tugas Bunpou Bab 3
      terbagi 2 (konvensi sama semua Bab 3-11) dan ke-4 pola pendek
      kebetulan di tugas pertama sementara 〜の di tugas kedua, user melihat
      "tugas 1 semua pilihan ganda, tugas 2 sudah susun kalimat" — bukan
      inkonsistensi acak, murni akibat panjang kalimat per pola. Perbaikan:
      ke-4 kalimat pendek DIPERPANJANG jadi 3 bunsetsu dengan modifier
      asal-negara (にほんの／アメリカの／かんこくの, mis. "たなかさんは
      にほんの せんせいです。") — natural, level N5, cocok tema Bab 3
      (perkenalan: nama/kewarganegaraan/profesi), dan aman dari jebakan
      rantai-の (cuma SATU の per kalimat). **migration 128**
      (`128_grammar_examples_bab3_arrange.sql`) — replay DELETE+INSERT sama
      seperti 127, dipersempit ke Bab 3 saja (Bab 4-11 tidak perlu ditimpa
      ulang, kontennya tidak berubah). Divalidasi: offline (deriveDrills
      murni) → 6/6 pola Bab 3 jadi arrange (naik dari 2/6), 0 opsi
      timpang/kembar; end-to-end lewat endpoint asli dengan 2 lesson dummy
      meniru split Tugas Bunpou 1 (3 pola pendek) + 2 (〜も + 〜の) persis
      kondisi produksi → KEDUANYA sekarang tampil `variant: "arrange"` di
      semua pola yang match. **Cakupan Bab 3-11 total naik 30→34 dari 44
      pola**; 10 sisanya (Bab 4-7) masih pilihan ganda karena alasan sama
      (kalimat cuma 1-2 bunsetsu) — belum diperpanjang karena belum
      dilaporkan sebagai masalah oleh user, tapi pola perbaikannya identik
      kalau suatu saat diminta.

      **migration 127 MENIMPA (bukan cuma mengisi) contoh Bab 3-11** —
      user melaporkan setelah 126: "Step 2 balik seperti semula tapi tidak
      sesuai dengan susun kata yang saya harapkan". Diagnosis: 126 sengaja
      pakai `NOT EXISTS` supaya tidak menimpa kurasi admin yang sudah ada —
      pagar yang wajar sebagai default. Tapi log deploy 126 (run #308)
      menunjukkan **34 dari 44 pola Bab 3-11 SUDAH punya `grammar_examples`
      sebelum 126 sempat jalan** (126 cuma mengisi 9 yang kosong). Klaim awal
      sesi ini ("kemungkinan dari tombol AI PR #225 yang sempat diklik")
      TERNYATA KELIRU dan tidak pernah diverifikasi — endpoint
      `prepare-examples-bulk` hanya bisa UPDATE baris yang SUDAH ADA, tidak
      pernah INSERT baris baru, jadi mustahil jadi sumber untuk bab yang
      sebelumnya nol baris. Sumber yang jauh lebih masuk akal: tombol
      **"📝 Contoh"** admin (fitur manual lama, di luar migrasi apa pun) —
      dan kalimat yang diketik lewat situ TIDAK memakai konvensi spasi
      antar-bunsetsu (konvensi itu baru mulai dipakai 081-089/126), jadi
      `buildArrangeDrill` (butuh 3-8 token berspasi) gagal terpicu dan
      otomatis jatuh ke pilihan ganda — persis yang dikeluhkan user.
      **migration 127** (`127_grammar_examples_bab3_11_replace.sql`) DELETE
      lalu INSERT ulang untuk SEMUA 44 pola yang match (bukan cuma yang
      kosong), pakai `v_pola` JSON BYTE-IDENTIK dengan 126 — tidak menulis
      kalimat baru, cuma mengganti cara penerapan dari "isi yang kosong"
      jadi "timpa semua". Alasan tidak coba "deteksi & spasi ulang kalimat
      admin yang ada": mustahil aman tanpa tahu isi persisnya, dan berisiko
      mengarang ulang kalimat orang lain — pola replay DELETE+INSERT ini
      sudah dipakai berulang di repo (065/098/101/104) untuk kondisi
      serupa (konten sudah live, perlu diganti total). Divalidasi ulang
      di Postgres sungguhan: simulasi kalimat admin tanpa spasi
      (`UPDATE grammar_examples SET japanese=... tanpa spasi`) → jalankan
      127 → kalimat balik berspasi+terjemahan; re-run 127 kedua kali →
      idempoten (hasil identik); lewat endpoint `GET drills` asli → pola itu
      sekarang benar tampil `variant: "arrange"`, bukan `"choice"`. Pattern
      Bab 3 `〜ね・〜よ` tetap tidak ketemu di 127 sama seperti 126 (nama
      polanya di production kemungkinan beda dari tebakan) — belum
      terselesaikan, perlu user cek nama persisnya di admin.

      **Tombol AI "Lengkapi contoh" DIBANGUN LALU DIHAPUS LAGI, diganti
      migration 126 hand-authored** — respons user atas pendekatan tombol
      🚀 dua-fase: "tombol ai jya gaperlu hapus aja, kamu bua manual". Root
      cause aslinya BUKAN cuma "belum ada spasi": migrasi 043/046/048/052/
      054/056/058/060 (Tugas Bunpou Bab 4-11) HANYA mengisi
      `module_grammar.example` (kolom lama satu-kalimat), TIDAK PERNAH
      mengisi `grammar_examples` (tabel multi-contoh, migration 031) —
      backfill 031 sendiri sudah jalan SEBELUM 043-060 (nomor migrasi lebih
      kecil), jadi tidak pernah menjangkau baris yang baru dibuat 043-060.
      Bab 4-11 punya NOL baris `grammar_examples`: `controlledSlot` butuh
      `item.examples`, jadi Step 2 (pilihan ganda MAUPUN susun-kalimat)
      benar-benar tidak ada bahan, persis gejala yang dilaporkan (Step 1 →
      langsung Step 3). **migration 126** (`126_grammar_examples_bab3_11.sql`)
      menulis 2 contoh per pola secara manual (gaya sama dengan 081-089:
      JSONB `v_pola` per bab + loop) — kalimat PERTAMA byte-identik dengan
      `module_grammar.example` yang sudah live (cuma ditambah spasi
      antar-bunsetsu + terjemahan), kalimat KEDUA baru, gaya & level sama,
      semua kana (konsisten dengan gaya legacy Bab 4-11, tanpa perlu
      whitelist kanji). **Bab 3 tidak punya `module_grammar` sama sekali di
      repo** (bank pola Bab 3 diisi manual lewat admin UI di produksi) — pola
      Bab 3 di 126 memakai FIND (bukan CREATE): kalau teks pattern tebakan
      tidak cocok persis dengan produksi, baris itu di-skip dengan NOTICE,
      TIDAK membuat duplikat (diuji: kondisi "ditemukan" DAN "tidak
      ditemukan" dua-duanya aman). Divalidasi OFFLINE dulu (deriveDrills
      fungsi murni, tanpa DB) sebelum ditulis ke migrasi: 44/44 pola dapat
      Step 1 DAN Step 2 (30 jadi susun-kalimat, 14 pilihan ganda), 0 opsi
      timpang/kembar/bawa-tanda-baca, 0 highlight yang bukan substring
      kalimatnya, 0 kalimat dipakai dua kali — lalu divalidasi ULANG lewat
      Postgres sungguhan (course + 12 modul dummy, replay 000→126, idempoten
      di-run dua kali, dan end-to-end lewat endpoint asli:
      `GET drills`/`POST drill-answer` dites brute-force 3! permutasi susun
      kalimat, cuma satu urutan yang lulus, kunci tidak bocor sebelum jatah
      salah habis). Endpoint `POST /admin/module-grammar/prepare-
      examples-bulk` yang sempat dibangun (spasi+terjemahan via AI runtime,
      dengan pengaman `spacingOnly` supaya AI tidak bisa menulis ulang
      kalimat) DIHAPUS TOTAL bersama tombolnya — bukan karena tidak aman,
      tapi karena user memilih konten sensitif begini ditulis & direview
      sebagai diff migrasi, konsisten dengan cara SEMUA konten lain di repo
      ini dibuat (bukan dieksekusi live tanpa pratinjau). Tombol 🚀 kembali
      ke satu fase (isi pengecoh saja), seperti sebelum PR sebelumnya.

      **Pengecoh Step 2 juga bisa dikurasi admin** (migration **125**, kolom
      `module_grammar.controlled_distractors`) — permintaan user setelah melihat
      hasil aturan. Yang tidak bisa diselesaikan aturan: pengecoh yang KEBETULAN
      juga benar di kalimatnya (mis. "あした 学校へ ＿＿＿" jawaban
      行かなくてもいいです, pengecoh 行かない — dua-duanya gramatikal); menilai
      itu butuh pemahaman makna. Disimpan per-POLA, bukan per-contoh, karena
      satu pola menghasilkan tepat satu soal Step 2 (contoh pertama yang punya
      highlight); konsekuensinya kalau contoh kalimatnya diganti, pengecoh lama
      bisa tidak cocok — modal admin menampilkan kalimat + jawabannya supaya
      ketidakcocokan itu langsung terlihat. Satu modal 🎯 Pengecoh sekarang
      mengurus KEDUA tahap (satu tombol "✨ Generate keduanya"), dan tombol isi
      massal menganggap sebuah pola "belum lengkap" kalau salah satu dari dua
      kolomnya kosong — kolom yang sudah terisi tidak pernah ditimpa.

      **Step 2 sekarang SUSUN KALIMAT (ala Duolingo), bukan pilihan ganda** —
      permintaan user setelah pagar di bawah membuat sebagian Step 2 hilang.
      Kepingan kalimat contoh diacak, siswa menyusunnya kembali dengan
      mengetuk (bukan drag — target sentuh lebih besar, tanpa pustaka DnD).
      Keunggulannya struktural: TIDAK ADA PENGECOH sama sekali, jadi seluruh
      kelas masalah "pengecohnya tidak masuk akal" / "pengecohnya kebetulan
      juga benar" hilang dengan sendirinya, dan bahannya cuma kalimat contoh
      yang memang sudah dikurasi penyusun materi. Cakupan Bab 12-20 naik jadi
      45/46 pola (dari 44, dan tanpa satu pun pengecoh yang perlu dijaga).
      Tokenisasi (`tokenizeSentence`) mengandalkan konvensi materi N5: contoh
      ditulis dengan SPASI antar-bunsetsu — diukur 137/138 contoh di 081-089
      berspasi; 、 ikut jadi batas walau tidak diikuti spasi, dan tanda baca
      DIBUANG dari kepingan karena 「読んで、」 yang membawa koma langsung
      memberi tahu bahwa ia bukan potongan terakhir. Syarat 3-8 potongan
      (2 potongan = tebakan 50:50). Kalimat yang tidak memenuhi syarat —
      terutama contoh lama Bab 3-11 yang mungkin tanpa spasi — JATUH KE
      PILIHAN GANDA lama, dan di situlah pengecoh kurasi admin (124/125) tetap
      bekerja; keduanya hidup berdampingan, `variant: 'arrange' | 'choice'`.
      **Penilaian tetap di server** (`arrangeIsCorrect`): browser cuma
      menerima `tokens` yang sudah teracak, mengirim balik `order` berisi
      INDEKS, dan `publicDrill` menahan `answer` + `japanese`. Perbandingan
      atas NILAI potongan, jadi dua keping yang tulisannya sama boleh
      bertukar tempat. **Kunci jawaban tidak ikut di respons jawaban yang
      salah** — kalau ikut, siswa cukup mengirim satu urutan asal lalu
      membacanya dari network tab; kuncinya baru dibuka setelah server sendiri
      mencatat `DRILL_MAX_WRONG` (2, harus sama dengan `GT_MAX_WRONG` di
      welcome.html) kegagalan SEJAK kelulusan terakhir DAN dalam 30 menit
      terakhir (tanpa batas waktu itu, dua kegagalan lama yang tak pernah
      disusul kelulusan membuat jawaban langsung terbuka besoknya).
      **Batasan yang disadari**: hanya urutan PERSIS contohnya yang diterima,
      padahal urutan bunsetsu bahasa Jepang lumayan lentur — susunan lain yang
      sebenarnya sah tetap dinilai salah. Ditahan dengan syarat maksimal 8
      potongan dan dengan menampilkan kalimat benarnya saat jatah habis. Kalau
      ini terbukti mengganggu, jalan keluarnya kolom "urutan alternatif" yang
      dikurasi admin, pola yang sama dengan 124/125.

      **Bab 3-11 sempat kehilangan Step 2 sama sekali** (user: "cuma 1 dan
      langsung 3") — akar masalahnya DATA, bukan aturan: contoh Bab 3-11 lahir
      dari backfill migration 031 (disalin dari `module_grammar.example`)
      sehingga TANPA spasi antar-bunsetsu DAN tanpa terjemahan. Tanpa spasi
      kalimatnya tidak bisa dipotong (susun-kalimat mati), tanpa terjemahan
      pilihan ganda kopula ditahan pagar `hasTranslation`. Perlu diingat:
      **memecah kalimat Jepang tanpa spasi TIDAK bisa diheuristikkan** —
      partikel muncul di dalam kata (にほん、はな、がっこう), jadi pemecah
      berbasis partikel/transisi aksara justru melahirkan kepingan sampah,
      yaitu masalah "ga masuk akal" yang sama dalam bentuk baru. Jalan
      keluarnya melengkapi MATERINYA, bukan melonggarkan aturan: tombol
      **🚀 di modal 🎯 Pengecoh kini dua fase** — [1/2] melengkapi contoh
      (`POST /admin/module-grammar/prepare-examples-bulk`, batch 10) lalu [2/2]
      mengisi pengecoh; keduanya bisa diulang dan kolom terisi tidak pernah
      ditimpa. Urutannya penting: terjemahan yang baru terisi ikut dipakai saat
      mengarang pengecoh. Sengaja SATU tombol — admin tidak perlu tahu bahwa
      ada dua jenis kekurangan data. **Jaminan keamanannya**:
      hasil spasi diterima hanya kalau identik dengan aslinya setelah semua
      spasi dibuang (`spacingOnly`) — model secara struktural tidak bisa
      menulis ulang kalimat materi, cuma menyisipkan spasi; kalau ia
      menyelundupkan perubahan kata, spasinya dibuang dan terjemahannya tetap
      dipakai.

      **Opsi Step 1 kembar & timpang panjangnya** — dilaporkan user lewat
      screenshot soal 「〜は〜です」 yang opsinya "juga" (4 huruf) DAN
      "Menyatakan 「juga」. Partikel も menggantikan posisi は ketika subjek lain
      memiliki hal yang sama." (130 huruf): arti yang sama ditulis dua versi,
      dan yang satu menonjol panjangnya. Penyebabnya aturan di `shortMeaning`
      yang komentarnya justru menyebut contoh itu — kalimat pertama <25 huruf
      dieskalasi ke TEKS UTUH. Sekarang: eskalasinya cuma menambah SATU kalimat
      berikutnya, dibatasi `MEANING_MAX` 90 huruf; plus dua saringan baru di
      `buildRecognitionDrill` yang berlaku untuk pengecoh kurasi MAUPUN
      cadangan — `sameMeaning` (buang opsi yang saling memuat; dua opsi
      bermakna sama tidak mungkin dua-duanya benar, jadi bisa dicoret tanpa
      paham polanya) dan `balancedMeaning` (panjang sebanding jawaban).
      Kalau saringan menyisakan <2 pengecoh, soalnya disembunyikan seperti
      biasa. Diaudit terhadap 46 pola Bab 12-20: 0 soal timpang/kembar sebelum
      maupun sesudah (arti di 081-089 memang seragam), cakupan Step 1 tetap
      46/46 — perbaikannya menyasar data bab lama.

      **Lantai pada pagar panjang pengecoh** — `slotShaped` semula memakai
      rasio murni (≤2×+2), yang menghukum jawaban PENDEK: untuk jawaban
      「です」 (2 huruf) rasio itu membuang 「じゃありません」 (7), justru lawan
      paling wajar, sehingga pola berjawaban kopula tetap tidak dapat Step 2
      walau tombol 🚀 sudah ditekan. Batasnya kini `max(2×+2, 12)`. Pilihan
      sepanjang kalimat tetap tertahan oleh dua pagar LAIN (tumpang tindih
      dengan jawaban + highlight-sekalimat), bukan oleh panjang — dibuktikan
      ulang lewat audit 46 pola: 0 anomali, dan cakupan Step 2 naik 45→46/46.

      **`drillLimiter` dipisah dari `evalLimiter`** (90/menit vs 20/menit) —
      ditemukan saat menulis tes ini. Soal Step 1/2 dinilai murni DB+CPU tanpa
      AI, tapi dulu ikut memakai jatah endpoint `evaluate`; satu Tugas Bunpou
      7 pola sudah 14 panggilan sebelum ada percobaan ulang, jadi siswa yang
      mengerjakan cepat kena 429 di tengah tugas.

      **Pagar kelayakan pengecoh Step 2** (`slotShaped` / `plausibleSlotFiller`
      di `grammar-drills.js`) — dipasang setelah user melaporkan soal
      「私は学生＿＿＿。」 yang pilihannya 「ペンは赤いです」 dan
      「田中さんは医者です」. Sumbernya: pengecoh CADANGAN diambil dari
      `grammar_examples.highlight` pola lain, dan banyak baris highlight
      (backfill 031 / isian admin / hasil AI) isinya KALIMAT UTUH, bukan
      potongan pola. Pilihan sepanjang kalimat bukan cuma salah — mustahil
      dimasukkan ke ＿＿＿, jadi soalnya bisa dijawab tanpa tahu tata bahasanya.
      Tiga pagar sekarang: (a) contoh yang highlight-nya ≥80% panjang
      kalimatnya TIDAK dipakai sebagai sumber pengecoh (`isWholeSentenceHighlight`
      — contohnya sendiri tetap tampil normal sebagai materi); (b) kandidat
      cadangan wajib `slotShaped` (tanpa tanda baca kalimat, panjang sebanding
      ≤2×+2 dan ≥ setengahnya) DAN tidak tumpang tindih dengan jawaban
      (「ペンは赤いです」 memuat 「です」 utuh = petunjuk); (c) keluaran AI di
      `generateControlledFor` disaring `slotShaped` juga — model kadang membalas
      kalimat utuh walau diminta potongan. Pagar (b) TIDAK dikenakan pada
      pengecoh hasil aturan bentuk, yang memang sengaja seakar dengan jawaban
      (て → ている). Diukur offline terhadap 46 pola Bab 12-20 (parse `v_pola`
      dari 081-089, `deriveDrills` fungsi murni jadi tidak butuh DB): 13
      pengecoh anomali → 0, cakupan Step 2 TETAP 44/46. Percobaan pertama
      memakai pagar "ada は/が padahal jawaban tidak" ternyata terlalu tumpul —
      ikut membunuh pengecoh lintas-pola yang justru bagus (「より」 vs
      「のほうが」), jadi diganti pagar panjang + deteksi highlight-sekalimat.

      **Dua bug bentuk yang ikut ketahuan** saat mengukur itu: (1) aturan
      kopula pada akar berakhiran い melahirkan kata yang TIDAK ADA
      (「ほしいじゃありませんでした」, 「行きたいでした」) — sekarang 〜たいです
      punya aturan sendiri (kata sifat-i: 〜たくないです/〜たかったです) yang
      dicek SEBELUM kopula, dan aturan kopula dilewati kalau akarnya berakhiran
      い karena ejaan tidak membedakan kata sifat-i (ほしい) dari kata benda
      (よてい — 「よていじゃありません」 justru benar); (2) jawaban yang isinya
      PERSIS satu akhiran predikat (pola 〜は〜です yang highlight-nya cuma
      「です」) dulu tidak dapat pengecoh sama sekali lalu jatuh ke cadangan
      sampah. Sekarang kopula/masu boleh dilawankan kala & kepositifan, TAPI
      hanya kalau contohnya punya terjemahan — tanpa terjemahan di layar
      「私は学生でした。」 sama benarnya dengan kuncinya, jadi soalnya
      disembunyikan (Step 3 tetap terbuka, lihat `gtAdvance`). Ini kelas
      masalah yang sama dengan pengecoh-yang-kebetulan-benar di atas, dan
      jalan keluarnya sama: kurasi admin.

  - **Belum dikerjakan (sengaja)**: latihan terkontrol (Level B) sebagai tipe
    soal tersendiri. Yang ada sekarang tulang punggung datanya (`grammar_id` di
    soal kuis + `source='controlled'` di `grammar_attempts`); UI drill-nya
    follow-up terpisah, bukan ditebak sekarang.

- **`quiz_attempts.completed_at` sempat salah dideklarasikan** `NOT NULL
  DEFAULT NOW()` di `schema.sql` — diperbaiki migration **123**. Seluruh kode
  attempt memperlakukan kolom itu sebagai penanda "sudah disubmit"
  (`/quiz/start` INSERT tanpa mengisinya; `/quiz-attempt` menutup attempt lewat
  `WHERE completed_at IS NULL`; `lessonAttemptStatus` ORDER BY ... NULLS LAST),
  jadi di database hasil bootstrap `schema.sql` bersih SETIAP submit kuis
  ditolak 409 `already_submitted` — Assignment Bab 1-20 mustahil diselesaikan.
  Produksi tidak terpengaruh (skemanya sudah nullable, submit jalan normal);
  123 no-op di sana dan cuma menyamakan environment baru, termasuk uji restore
  ke staging yang masih terbuka di daftar di atas. Ditemukan saat menguji 122.

- **Belajar adaptif (deteksi kelemahan + rekomendasi)** — panel "Fokus
  belajarmu" di dashboard siswa (`welcome.html`): akurasi per kategori
  (`vocabulary`/`grammar`/`listening`) + pelajaran untuk diulang + catatan
  coaching AI dari Maneko-chan. Fondasi: handler submit kuis
  (`POST /api/progress/lesson/:id/quiz-attempt`) sekarang **mem-persist hasil
  per-soal** (benar/salah + `question_category` di-snapshot) ke tabel
  `quiz_question_results` (migration 027) — sebelumnya `correctByQuestion`
  cuma dihitung lalu dibuang, jadi tidak ada granularitas kategori. Best-effort
  insert (error tidak menggagalkan submit). **Tanpa backfill**: histori baru
  terkumpul untuk attempt setelah deploy. Endpoint
  `GET /api/recommendations/me` (`backend/src/routes/recommendations.js`,
  `requireAuth`): agregasi akurasi per kategori (lookback 90 hari, weak =
  akurasi < 70% DAN ≥ 8 soal — di bawah itu `insufficientData`), pilih kategori
  terlemah, lalu pelajaran kandidat (ter-`user_enrollments`, memuat soal
  kategori itu, skor terbaik < passing atau belum pernah; LIMIT 3). **Catatan
  coaching AI**: prompt editable admin (`app_settings.coaching_note_prompt`,
  placeholder `{{studentName}}`/`{{weakCategory}}`/`{{accuracyPct}}`/`{{lessonTitles}}`;
  tab "AI" di `admin.html`), persona Maneko-chan, di-cache di
  `coaching_note_cache` per "weakness signature" (akurasi di-bucket 5%) seperti
  `grammar_eval_cache`. `ANTHROPIC_API_KEY` kosong / gagal → fallback catatan
  berbasis-aturan (`noteSource:'rule'`), endpoint **tidak pernah 503**. Helper
  Claude bersama baru `backend/src/anthropic.js` (`callClaude()`); dua call-site
  lama (grammar-task/admin generate) belum dimigrasi (follow-up; tutor sudah). Frontend:
  `loadRecommendations()` dipanggil dari `renderLearning`, render via
  `recoPanelHtml`; lesson rekomendasi (UUID dari API) dicocokkan via `l.apiId`
  lalu `selectLesson(moduleSlug, lessonSlug)`. Panel disembunyikan kalau belum
  ada data kuis.
- **Kategori soal kuis** (`quiz_questions.question_category`): 4 nilai —
  `vocabulary` (Moji-Goi), `grammar` (Tata Bahasa), `reading` (Dokkai),
  `listening` (Menyimak). Kategori `reading` + kolom `passage` ditambah di
  migration 028, dibatalkan di 029, lalu **direstorasi di migration 034**
  (user minta dokkai untuk generator JLPT). Label dikelola di 3 tempat
  sejajar: `QUIZ_CATEGORY_LABELS` (admin.html), `QUIZ_CATEGORY_META`
  (welcome.html), `CATEGORY_LABEL` (recommendations.js); plus array kategori
  hardcoded di welcome.html (tabs/finder/stats `byCategory`/`RECO_CAT_ORDER`)
  & admin.js (`QUIZ_CATEGORIES`, ORDER BY CASE) — kalau nambah kategori lagi,
  grep semua. CHECK constraint `quiz_questions_category_check`.
  **Passage (dokkai)**: kolom `quiz_questions.passage` per-soal (denormalized
  — semua soal satu bacaan menyimpan string IDENTIK); welcome.html me-render
  blok `.quiz-passage` sekali di atas grup soal ber-passage sama (per-grup
  dalam section, bukan per-section — satu mondai bisa berisi beberapa bacaan).
  Admin: passage di-set section-level via form Edit Section (kategori
  reading), section PUT meng-update passage semua soal section.
- **Generator soal JLPT per-mondai (vocab/grammar/dokkai)** — tombol
  "✨ Generate JLPT" di header Kelola Kuis (`admin.html` → `openJlptGen`),
  saudara dari generator listening. Satu run = satu tipe mondai
  (`JLPT_GEN_TASKS` di `backend/src/routes/admin.js`, 11 tipe): Moji-Goi
  漢字読み/表記/文脈規定/言い換え類義/用法(N4), Bunpou 文の文法1/文の組み立て(★)/
  文章の文法(cloze wacana), Dokkai 短文/中文/情報検索. Endpoint
  `POST /api/admin/lessons/:lessonId/generate-jlpt`
  ({ taskType, level, count, topic }); `count` = jumlah soal, KECUALI tugas
  ber-passage: dokkai = jumlah bacaan (短文 1 soal, 中文 2-3, 情報検索 2 per
  bacaan), 文章の文法 = 1 wacana dgn `count` blank. Tugas ber-passage: AI
  balas `{"passages":[{passage,questions:[...]}]}`, di-flatten server-side
  (passage identik per grup). Validasi struktural per tipe
  (`_validateJlptQuestion`/`_normalizeJlptOptions`): 漢字読み wajib `<u>…</u>` +
  opsi hiragana-only, 組み立て wajib ★ + ≥3 `＿＿`, 文章の文法 wajib `（①）`,
  用法 question = kata saja + semua opsi memuatnya, dst — draft melanggar
  dibuang. Grounding vocab+grammar modul + anti-duplikat per kategori. Prompt
  wrapper editable (`app_settings.jlpt_gen_prompt`,
  `GET/PUT /admin/settings/jlpt-gen-prompt`, placeholder sama dgn listening;
  modal hanya memuat nilai custom). Simpan → section kategori-nya, nomor =
  nomor mondai (label+instruksi mondai auto; section existing dipertahankan).
  **Generator bulk lama ("✨ Generate AI" per pelajaran) DIHAPUS dari UI** —
  endpoint `generate-quiz` + settings `quiz-gen-prompt` masih ada di backend
  (deprecated, tanpa pemanggil; hapus di cleanup berikutnya). Konsekuensi:
  generate fill_blank via AI tidak ada lagi (buat manual).
- **Generate opsi pilihan ganda (AI)** — tombol "✨ Generate opsi (AI)" di editor
  soal admin (`openQuestionForm` → `quizGenOptions`): kirim pertanyaan +
  (listening: audio script) ke `POST /api/admin/generate-question-options`
  (`callClaude` di `backend/src/anthropic.js`) → 4 opsi (1 benar) + penjelasan
  diisi ke form. `ANTHROPIC_API_KEY` kosong → 503 (manual tetap jalan). Penjelasan
  prompt-nya WAJIB Bahasa Indonesia (bukan Jepang). **Tombol per-draft juga ada di
  modal review generator JLPT & Listening** (`admin.html` → `jlptGenRenderPreview`/
  `listenGenRenderPreview` → `window.jlptGenOptions`/`listenGenOptions` →
  core `genDraftOptions`): regenerate opsi+penjelasan agar match pertanyaan yang
  SUDAH diedit (baca dari DOM: pertanyaan `${prefix}_q_${i}`, listening pakai audio
  script `lg_audio_${i}` terbaru, JLPT reading pakai `_jlptGenDrafts[i].passage`),
  re-use endpoint yang sama. Baris opsi dirender via helper bersama `genOptionRows`
  (dipakai render awal + regenerate, jaga id `${prefix}_opt_${i}_${j}` konsisten
  dgn `jlptGenSave`/`listenGenSave`). Beda dari `quizGenOptions`: penjelasan
  SELALU ditimpa (bukan cuma kalau kosong).
- **Generate soal listening gaya JLPT (AI)** — tombol "🎧 Generate Listening
  JLPT" di header modal Kelola Kuis (`admin.html` → `openListeningGen`). Satu
  run = satu tipe mondai JLPT N5/N4: 課題理解 / ポイント理解 / 発話表現 /
  即時応答 (struktur per tipe di-hardcode di `JLPT_LISTENING_TASKS`,
  `backend/src/routes/admin.js`). Endpoint
  `POST /api/admin/lessons/:lessonId/generate-listening`
  ({ taskType, level, count, topic }) → draft soal LENGKAP: `audioScript`
  dialog 3-voice format `N:/A:/B:` (kerangka JLPT: narator bacakan
  situasi+pertanyaan → dialog → pertanyaan diulang; untuk 発話表現/即時応答
  script HANYA 1 baris situasi/ucapan — opsi TIDAK dibacakan karena tampil
  di layar; `parseDialog` di tts.js terima dialog 1-turn, SETTINGS_VERSION
  v7) + pertanyaan + opsi (4 utk mondai 1/2, 3 utk mondai 3/4) + penjelasan.
  Grounding vocab/grammar modul + anti-duplikat
  (baris situasi soal listening existing dikirim sbg avoid). Validasi server:
  `parseDialog()` harus kenal script-nya, max 1400 char (< MAX_TEXT_LEN tts
  1500), `question` dipangkas ke 1 baris tanpa prefix speaker, dialog mondai
  1/2 wajib ≥3 turn dgn pembicara A DAN B (anti semua-narator), mondai 3/4
  max 2 turn. Frontend siswa (`welcome.html renderQuizPaperItem`): teks
  pertanyaan listening yg persis ada di `audioScript` (= dibacakan narator)
  disembunyikan sampai dijawab (hint 🎧), reveal bareng transkrip di
  `pickQuizAnswer`. Draft di-review admin (bisa 🔊 test audio per draft via
  `/admin/tts/preview` sebelum save) → simpan via POST /admin/quiz-questions ke
  section listening nomor = nomor mondai (label+instruksi mondai auto-set;
  kalau section sudah ada, label/instruksi existing dipertahankan dan
  sort_order di-append). Prompt wrapper editable admin
  (`app_settings.listening_gen_prompt`,
  `GET/PUT /api/admin/settings/listening-gen-prompt`, placeholder
  `{{count}}/{{level}}/{{taskName}}/{{taskRules}}/{{levelRules}}/{{topic}}/{{vocab}}/{{grammar}}/{{avoid}}`);
  aturan per-mondai & per-level tetap di kode. **Model generator soal**:
  generate-jlpt + generate-listening pakai `ANTHROPIC_GEN_MODEL` (default
  `claude-sonnet-4-6`) — haiku terbukti gagal terus di 組み立て (semua draft
  ditolak validasi permutasi); fitur siswa (tutor/grammar eval/coaching)
  tetap `ANTHROPIC_MODEL` (default haiku). Generator kuis bulk lama
  (`generate-quiz`) juga di-update: prompt default format dialog + contoh JSON
  menyertakan 1 soal listening lengkap (model suka meniru contoh — dulu contoh
  `audioScript:""` bikin script kosong), draft listening tanpa script yang
  lolos `parseDialog` dibuang server-side, preview admin pakai `<textarea>`
  (dulu `<input>` — newline dialog di-collapse browser → single voice),
  draft listening bulk wajib struktur JLPT penuh (≥3 turn + ada N + A + B,
  menolak output "N sebagai tokoh"). **Jebakan prompt membeku** (textarea
  prompt dulu prefilled default → sekali "Simpan Prompt", default lama beku
  di `app_settings` dan perbaikan default berikutnya ga kepakai) sudah
  ditutup: migration 033 menghapus `quiz_gen_prompt`/`listening_gen_prompt`
  tersimpan (one-time reset), dan kedua modal kini hanya memuat nilai
  custom (kosong = default server terbaru).
- **Generate contoh kalimat (AI) untuk kosakata deck** — tombol "✨ Generate
  contoh (AI)" di modal Kelola Deck → Contoh (`deckManageExamples` →
  `deckGenExamples`): `POST /api/admin/generate-vocab-examples` ({ vocabularyId,
  count }) di-grounding ke kata di `module_vocabulary` → daftar
  `{ japanese, highlight, indonesian }` ditambahkan sebagai baris BELUM tersimpan
  (admin review lalu Simpan per baris ke `vocabulary_examples`). `callClaude`;
  `ANTHROPIC_API_KEY` kosong → 503.
- **Multi contoh + terjemahan untuk pola grammar** (migration 031) — tabel
  baru `grammar_examples` (mirror `vocabulary_examples`: japanese / highlight /
  indonesian / sort_order, FK ke `module_grammar`). Backfill dari kolom legacy
  `module_grammar.example` (dipertahankan untuk fallback). Admin kelola via
  tombol "📝 Contoh" per baris grammar (`grammarManageExamples`) — pola sama
  persis dgn deck kosakata. Generator AI multi: `POST /admin/generate-grammar-examples`
  (pattern + meaning + avoid[], pola sama dgn `generate-vocab-examples`).
  Endpoint CRUD: `/admin/grammar-examples`. content.js (`GET /api/courses/:slug`)
  meng-attach `g.examples[]` per grammar; `welcome.html renderLessonGrammar`
  prefer examples[] dgn fallback ke `g.example`.
- **Terjemahan dialog grammar (parallel per-baris)** — kolom baru
  `module_grammar.example_dialog_id` (TEXT, struktur paralel N:/A:/B: persis
  dialog Jepang). Admin field di GRAMMAR_FIELDS + tombol "✨ Translate"
  (`grmrTranslateDialog`) memanggil `POST /admin/generate-dialog-translation`
  → Claude bikin terjemahan dgn prefix sama jumlah baris. Frontend
  `parseDialogIdMap` cocokkan per-line index dgn dialog Jepang; render di bawah
  tiap turn (`.gk-line-id` / `.gk-narrator-id`, italic kecil gray). Kerja
  paralel — kalau ID baris kurang/lebih dari JP, baris yg nggak match cuma
  tidak menampilkan terjemahan (no crash).
- **Generate gambar ilustrasi (AI) untuk kosakata** — tombol "✨ Gambar" di
  Kelola Deck (per baris): `POST /api/admin/generate-vocab-image`
  ({ vocabularyId, force? }) → **OpenAI gpt-image-1** (quality=low,
  ~$0.011/gambar) via raw fetch → bytes disimpan di `vocab_image_cache`
  (BYTEA, 1 row per kosakata, ikut `pg_dump`; migration 030). Preview modal di
  admin (`deckShowImagePreview`); regenerate dgn `force=true`. Public serve di
  `GET /api/vocab-image?vocabularyId=...` (`backend/src/routes/vocab-image.js`,
  cache-control 24h, 404 kalau belum generate). Env baru `OPENAI_API_KEY`
  (opsional; kosong → 503). Frontend siswa belum render gambar (follow-up):
  butuh `has_image` flag di `content.js` lesson payload + `<img>` di deck card.
  Kalau volume bytes besar (>500 MB) migrate ke object storage (R2).
- **Seeding struktur Bab (kurikulum tidak ada di repo)** — modules / lessons /
  module_vocabulary / kanji_items hidup di DB produksi, jadi tiap bab dibangun
  lewat migrasi SQL berisi konten hasil tarik dari Notion. Patokan struktur =
  Bab 3-10: Pengantar (`video`) → Kosakata 語彙 (`deck`) → Kanji 漢字 (`kanji`)
  → Tata Bahasa (`text`) → 2 Tugas Bunpou (`grammar_task`) → Assignment
  (`quiz`, 50 soal). Migrasi 039-060 mengisi tugas bunpou + assignment Bab
  1-11; **070-078 mengisi tiga pelajaran pertama Bab 12-20** (generator dipakai
  sekali di sesi itu; file SQL-nya yang jadi source of truth). Pola resolusi
  modul di 070-078: ordinal `OFFSET (bab-1)` — judul yang tidak cocok cuma
  memicu NOTICE (judul produksi bergaya "BAB 12: Bentuk Te : Konjugasi &
  Permintaan", beda dari judul Notion), ordinal tetap dipercaya seperti
  039-065; modul baru **hanya** dibuat kalau ordinalnya memang tidak ada,
  sekalian isi metadata kurikulum (title_en / CEFR / JF topic / scenario /
  cando_statements) yang masih kosong. Tiga pelajaran itu selalu di
  sort_order 1/2/3, pelajaran lain digeser ke 4..n. Kanji di-insert
  per-pelajaran (character + jlpt_level + lesson_id, sesuai migration 064) —
  jangan pakai `ON CONFLICT (character, jlpt_level)`, index itu sudah tidak
  ada.
  Migrasi **081-089 mengisi materi Tata Bahasa Bab 12-20** — dua pelajaran
  bertipe `text` per bab (sort_order 4 dan 6), pola dari dokumen kurikulum
  "EzNihongo — Daftar Grammar 文法 (JLPT N5 + N4)" bagian N5-B12…B20 (46 pola,
  138 contoh kalimat). Detail pola ini di bagian **Tipe pelajaran `text`
  (Tata Bahasa)** di bawah.
  **Sisa pekerjaan Bab 12-20**: (a) ~~deck kosakata Bab 17-20 masih
  kosong~~ — dikoreksi user (2026-08-27): sudah terisi, klaim lama di
  sini keliru/basi (kemungkinan sudah diisi manual lewat Kelola Deck →
  "↻ Import Bab dari Notion" setelah catatan ini ditulis, sesi ini tidak
  verifikasi ulang mana yang persis terisi — cek langsung di admin kalau
  perlu detail per-bab); (b) Bab 13 belum punya kanji di
  Notion (kolom "Kanji First Introduced" kosong). Assignment Bab 12-20
  SUDAH LENGKAP (migration 100/104/103/105/106/107/108/109/110; 102
  digantikan 104 untuk data production, lihat catatan Assignment Bab 13
  di bawah) — seri Assignment ini selesai per Bab 20 (2026-08-27).
  **Tugas Bunpou Bab 13-20** diisi migrasi **090-097** (satu file per bab,
  `0NN_grammar_task_babNN.sql`) — mengisi slot sort_order 5 & 7 yang sengaja
  disisakan kosong oleh 082-089 (Bab 12 sendiri sudah ditangani lebih dulu
  oleh 062/065, sebelum seri 081-089 ada). Pola split pertama/kedua tugas
  SAMA PERSIS dengan split pelajaran Tata Bahasa terkait (mis. Bab 14 = 4+3
  pola), dan bank `module_grammar` di-FIND-OR-CREATE dengan pattern string
  persis sama dengan 081-089 supaya reuse baris yang sudah ada (bukan
  duplikat) — INSERT fallback-nya hanya kepakai kalau baris itu ternyata
  terhapus. Penomoran ulang ke sort_order 5 & 7 pakai ROW_NUMBER atas urutan
  relatif (pola yang sama dengan 048-065), bukan nilai sort_order literal,
  jadi aman dijalankan berapa pun gap yang sudah ada. Divalidasi end-to-end
  dengan menjalankan seluruh rantai migrasi (000-097) di Postgres lokal
  sekali pakai (course + 20 modul dummy) sebelum commit — semua 8 file
  applied bersih, tanpa duplikat pola, posisi final 5/7 persis seperti yang
  diklaim tiap `RAISE NOTICE`.

- [ ] **Tugas Bunpou Bab 12 kehapus DUA KALI** dari production (setelah
  062, lalu setelah restore 065) — di-restore lagi via migration **098**
  (`098_grammar_task_bab12_restore2.sql`, logika identik 062/065, sudah
  divalidasi lewat simulasi hapus+restore di Postgres lokal). File itu
  sendiri sudah menutup insiden ini, tapi ROOT CAUSE penghapusan berulang
  belum diketahui — cek dulu sebelum bikin restore ketiga: apakah ada
  admin/proses yang menghapus lesson `grammar_task` Bab 12 secara rutin
  (mis. tombol hapus di "Kelola Deck"/lesson list ke-pencet tidak sengaja,
  atau ada script/cron yang keliru). Kalau terhapus lagi untuk ketiga
  kalinya, jangan cuma re-run pola restore — investigasi dulu.

- [ ] **18 lesson Tata Bahasa Bab 12-20 di-set `type='video'`** via migration
  **099** (`099_bunpou_text_to_video.sql`), permintaan user — murni ubah
  kolom, TANPA perubahan kode. Efeknya saat ini: masih tampil placeholder
  statis "Video akan segera tersedia" di `welcome.html` (lesson type
  `video` biasa TIDAK baca `video_url`, beda dari `deck`/`kana` yang sudah
  ada wiring iframe-nya) dan form admin belum expose field Video URL untuk
  hasil ubahan ini kecuali `wireLessonTypeVisibility` sudah otomatis
  menampilkannya karena type-nya memang `video`. Kartu pola grammar
  (module_grammar + grammar_examples) TETAP tampil seperti biasa karena
  render-nya independen dari `lessons.type`. `video_url` belum diisi
  (belum ada link saat migrasi ini ditulis) — kalau video-nya sudah siap,
  perlu tambahan kerjaan: (a) admin isi `video_url` per lesson lewat form
  (field-nya sudah otomatis muncul untuk type video), TAPI (b) `welcome.html`
  masih perlu diubah supaya lesson type `video` non-deck/kana benar-benar
  merender iframe dari `video_url` alih-alih placeholder — belum dikerjakan.
  **Konvensi judul lesson** (dirapikan di migration 079 — sebelumnya
  Assignment/Tugas Bunpou Bab 1-12 pakai em dash, tidak konsisten dengan
  Pelajaran intro/deck/kanji yang pakai titik dua): `Tipe Bab N: Topik`
  (titik dua, BUKAN em dash) — mis. `Assignment Bab 13: Topik`,
  `Tugas Bunpou Bab 13: Topik`. Tiga pelajaran pertama **polos tanpa prefix
  `Pelajaran N:`** (dirapikan di migration 080 — sidebar `welcome.html` sudah
  merender nomor urutnya sendiri, jadi "87. Pelajaran 1: Pengantar" itu dua
  angka yang artinya beda): `Pengantar` (video) / `Kosakata 語彙` (deck) /
  `Kanji 漢字` (kanji). Import Notion mengkanonikalisasi sendiri lewat
  `canonicalPelajaranTitle()` (`backend/src/routes/admin.js`, dipakai di
  `import-notion-pelajaran`), jadi penamaan "Pelajaran N:" di Notion tidak
  perlu diubah. Cek drift kapan saja lewat section 5 di
  `backend/scripts/audit-bab-structure.sql`.
  **Jangan rename `lessons.slug`** saat merapikan judul — progres siswa di
  localStorage di-key slug (`"<moduleId>:<lessonId>"`), rename = progres tereset.
  Audit cepat kondisi produksi: `backend/scripts/audit-bab-structure.sql`
  (read-only, 4 laporan: jenis pelajaran per bab, bab yang menyimpang,
  pelajaran kosong, bank vocab/grammar).

- [ ] **Regresi judul em dash di 090-097 (Tugas Bunpou Bab 13-20)** — ditulis
  belakangan setelah migration 079 menetapkan konvensi titik dua, tanpa
  sengaja balik pakai em dash lagi (mis. `'Tugas Bunpou Bab 13 —
  Progresif & Permintaan'`). Sumber file 090-097 sudah diperbaiki ke titik
  dua langsung, dan migration **101**
  (`101_normalize_tugas_bunpou_title_separator.sql`) menjalankan ulang
  regex generik 079 (`^(Assignment|Tugas Bunpou) Bab [0-9]+ — `) untuk
  merapikan baris yang sudah kadung ter-apply di production dengan title
  em dash (termasuk Bab 12 dari 062, yang juga sempat kena regresi ini).
  Kalau menulis migrasi Assignment/Tugas Bunpou baru lagi, JUDUL WAJIB
  titik dua dari awal — jangan andalkan normalizer lagi.

- **Assignment Bab 12: Bentuk Te** diisi migration **100**
  (`100_assignment_bab12_te_form.sql`), pola sama persis dengan
  039-061 (50 soal: 漢字読み 9 + 表記 9 + 文脈規定 12 + 文の文法1 20,
  ditampilkan semua tiap attempt, lulus 70%, cooldown 12 jam, di
  sort_order 100 tanpa penomoran ulang). Dua catatan desain khusus Bab 12
  dibanding 039-061:
  - **Pagar kata kerja DIHAPUS** (bukan diperluas seperti biasa) — Bab 12
    adalah bab konjugasi kata kerja itu sendiri (bentuk te), jadi regex
    lama yang melarang token `ます|ました|...|いて` justru melarang materi
    inti bab ini (`いて` adalah hasil sah く→いて, `ます`/`ました` wajib
    muncul sebagai kata kerja terakhir di pola 〜て、〜). Pagar kanji tetap
    berlaku penuh dan itu yang menahan kosakata di luar level.
  - **Jebakan pagar "rantai の"** (assertion 4, regex `の[^。]*の` terhadap
    kolom `question` mentah termasuk isi `<u>…</u>`, bukan cuma badan
    kalimat): kata majemuk yang secara kebetulan punya dua の di dalam satu
    kata (`のみもの` = の-み-も-の) FALSE POSITIVE ke-flag sebagai "chain
    の" walau bukan partikel berantai. 039-061 diam-diam menghindari ini
    dengan taruh kata seperti itu HANYA di options/penjelasan, tidak pernah
    di teks `question`. Migrasi 100 awalnya kena ini di draft pertama
    (soal もんだい2 表記 target `のみもの`) — diganti ke `のみました`
    (hanya satu の) sebelum lolos. Kalau menulis soal baru dengan kosakata
    ber-の ganda dalam satu kata, taruh di options saja, jangan di
    `question`.
  Divalidasi end-to-end: simulasi penuh di Postgres lokal (course + 12
  modul dummy, replay 081→062→100→101 di atas modul Bab 12) — 50 soal
  applied bersih, semua opsi tepat 4 dengan 1 kunci benar, pagar kanji +
  dedup 159 target lolos, dan 101 berhasil menormalkan 2 judul em dash
  dari 062.

- **Assignment Bab 13: Progresif, Permintaan & Izin** diisi migration
  **102** (`102_assignment_bab13_progresif_izin.sql`), pola sama persis
  dengan 100 (50 soal, sort_order 100, pagar kata kerja tetap dihapus —
  Bab 13 masih keluarga te-form). Karena Bab 13 TIDAK memperkenalkan kanji
  baru (dikonfirmasi header 082), whitelist kanji-nya SAMA PERSIS dengan
  100. Draf awal もんだい1/2 sempat REVIEW kanji lama (読/書/見/食/飲 dari
  Bab 10-12, sama seperti pola 061) tapi user menandai ini bikin Assignment
  Bab 12 dan 13 terasa "kanji-nya sama" — **direvisi** (lihat migration 104
  di bawah) supaya もんだい1/2 memakai kanji LEBIH LAMA (車・花・電車・道・駅,
  sebelum Bab 12) untuk variasi, digabung dengan 4 pola grammar Bab 13
  (ています/てください/てもいいですか/てはいけません; てくれませんか tetap
  hanya di もんだい1 文の文法1). DEDUP array diperluas jadi 177 target (159
  dari 042-061 + 18 dari 100). Divalidasi end-to-end: replay penuh
  081→062→100→082→090→102→104→083→091→103 di atas modul Bab 12+13+14
  dummy — semua assignment applied bersih berdampingan, semua opsi 4/1
  kunci, pagar level + dedup lolos, tidak ada tabrakan target antar bab.

- **Revisi kanji Assignment Bab 13** — migration **104**
  (`104_assignment_bab13_kanji_variety_fix.sql`) memperbaiki DATA
  PRODUCTION yang sudah menjalankan 102 versi lama (ter-deploy lewat PR
  #191, jadi tidak akan re-run otomatis). Sumber 102 SUDAH diedit langsung
  di repo (fresh install lewat 000-104 benar sejak awal); 104 me-replay
  DELETE+INSERT 50 soal yang IDENTIK dengan 102 versi baru ke lesson slug
  yang sama, pola sama dengan 101 (perbaikan judul 090-097 yang sudah
  live) dan 065 (restore konten yang sudah live). もんだい1/2 baru:
  車をもっています／花がさいています／電車にのっています／道をあるいています／
  駅でまっています (ています, 5) + 電車にのってください／道をあるいてください
  (てください, 2) + 車をつかってもいいですか (てもいいですか, 1) +
  花をとってはいけません (てはいけません, 1), verba dieja kana (持/咲/乗/歩/
  待/使/取 tidak ada di whitelist taught kanji, pola sama dengan 行 di 100).
  **Jebakan pagar "rantai の" varian baru**: draft pertama memakai konteks
  "つぎの 電車にのってください" — "つぎの" (の pertama) + "のって" (verba
  乗る bentuk te, の kedua) = dua の dalam satu kalimat, ke-flag assertion 4
  padahal bukan partikel の berantai yang sebenarnya (mirip jebakan
  "のみもの" di migration 100, tapi kali ini dari KOMBINASI kata konteks +
  verba, bukan satu kata majemuk). Diganti ke "えきで 電車にのってください"
  (tanpa の di konteks). Kalau menulis soal baru dengan verba yang KANA-nya
  kebetulan diawali の (のる/のみます/dst), hindari taruh kata ber-の lain
  (つぎの/あの/この kalau ada の, dst) di konteks kalimat yang sama.

- **Assignment Bab 14: Bentuk Nai & Bentuk Plain** diisi migration **103**
  (`103_assignment_bab14_nai_plain.sql`), pola sama persis dengan 100/102
  (50 soal, sort_order 100, pagar kata kerja tetap dihapus). Bab 14
  memperkenalkan 4 kanji BARU — 立(たつ)・休(やすむ)・入(はいる)・出(でる)
  — kanji baru pertama sejak Bab 12, jadi もんだい1/2 untuk PERTAMA KALINYA
  sejak itu diisi 100% kanji baru bab itu sendiri (bukan review kanji lama),
  digabung dengan 3 bentuk konjugasi juga baru di Bab 14 (nai-form, bentuk
  kamus, bentuk ta plain) — sengaja TIDAK memakai 3 pola lain
  (ないでください／なければなりません／なくてもいいです) di もんだい1/2
  karena itu bentuk fungsi-kalimat, bukan penentu bacaan kanji; ketiganya
  tetap diuji di もんだい1 文の文法1. Whitelist kanji = whitelist 100/102
  UNION 立休入出. DEDUP array diperluas jadi 195 target (177 dari 042-100 +
  18 dari 102). Divalidasi end-to-end: replay penuh
  081→062→100→082→090→102→083→091→103 di atas modul Bab 12+13+14 dummy —
  ketiga assignment applied bersih berdampingan, semua opsi 4/1 kunci,
  pagar level + dedup lolos.

- **Assignment Bab 15: Bahasa Pelayanan & Perubahan** diisi migration
  **105** (`105_assignment_bab15_pelayanan_perubahan.sql`), pola sama
  persis dengan 100/104/103 (50 soal, sort_order 100). Bab 15
  memperkenalkan 7 kanji BARU — 言(いう)・話(はなす)・聞(きく)・買(かう)・
  店(みせ)・会(あう)・社(かいしゃ, cuma dipakai dalam 会社) — tapi BEDA
  dari Bab 14: keenam pola grammar Bab 15 adalah FRASA TETAP (〜を…お願い
  します／〜はいかがですか／〜になります／お〜ください／〜にします／
  〜くなります・〜になります), bukan keluarga konjugasi kata kerja satu
  akar seperti nai/kamus/ta Bab 14, jadi memaksakan もんだい1/2 mengikuti
  salah satu pola grammar tidak alami. もんだい1/2 diisi KOSAKATA POLOS
  (言います／話します／聞きます／買います／会います／お店／電話／会社／
  店の人) gaya 039-061, kembali ke pendekatan sebelum Bab 12-14 yang
  memang bertema konjugasi. Ke-6 pola grammar tetap diuji penuh di もんだい1
  文の文法1 (split 4/3/3/4/3/3) — 4 pola berbentuk frasa tetap
  (お願いします／いかがですか／になります／にします) memakai opsi
  CROSS-PATTERN (opsi salah = 3 frasa tetap lain, gaya JLPT 文法 asli
  menguji pemilihan pola yang tepat untuk konteks, bukan konjugasi), 2 pola
  lain (お〜ください, 〜くなります/〜になります) tetap self-contained
  seperti 100/102/103. もんだい3 pakai 12 kosakata fungsional dari bank
  Bab 15 (073), SEMUA ditulis kana/katakana polos (bukan kanji) karena
  section itu tidak pakai `<u>` — seluruh kolom question kena pagar
  whitelist dan kanji seperti 現/計/約/屋/物 belum diajarkan. Whitelist
  kanji = whitelist 100/104/103 UNION 言話聞買店会社 (sama persis dengan
  `v_kanji_ok` di 084). **DEDUP diperbaiki metodenya** di migrasi ini:
  daripada menyusun array secara incremental dari catatan migrasi
  sebelumnya (pendekatan yang di sesi sebelumnya sempat salah hitung
  karena pola glob shell keliru melewatkan file 039 dan 055), array
  sekarang di-grep ULANG PENUH dari seluruh file migrasi assignment
  039-104 yang benar-benar ada di repo (215 target unik). Divalidasi
  end-to-end: replay penuh
  081→062→100→082→090→102→104→083→091→103→084→092→105 di atas modul Bab
  12+13+14+15 dummy — keempat assignment (Bab 12/13/14/15) applied bersih
  berdampingan, semua opsi 4/1 kunci, pagar level + dedup lolos. Sempat
  kena jebakan pagar "rantai の" varian ketiga saat menulis もんだい3: kata
  kerja pasif "たのまれたら" (mengandung の di suku kedua) dan もの (juga
  mengandung の) masing-masing digabung dengan "店の人" dalam satu kalimat
  → dua の. Diganti ke "おねがいされたら" dan "メニューを" (keduanya tanpa
  の) untuk soal 20 dan 26.

- **Assignment Bab 16: Waktu & Tanggal** diisi migration **106**
  (`106_assignment_bab16_waktu_tanggal.sql`), pola sama persis dengan
  100/104/103/105 (50 soal, sort_order 100). Bab 16 memperkenalkan 6 kanji
  BARU — 日・火・水・木・金・土 (nama hari; 曜 belum diajarkan, jadi
  "ようび" selalu kana). もんだい1/2 diisi KOSAKATA POLOS gaya 105: 7 nama
  hari (日ようび～土ようび, 月 sendiri sudah taught lama tapi disertakan
  supaya siklus 7 hari lengkap) + 2 frasa tanggal (何月何日／六月三日,
  menguji bacaan khusus tanggal 3 = みっか). もんだい1 文の文法1 (split
  5/5/5/5) menguji 4 pola: 〜に (partikel waktu) diuji DUA ARAH — waktu
  berangka (jam/hari/bulan) WAJIB に (soal 31-33) vs waktu relatif
  (あした／まいにち) JUSTRU TIDAK memakai に (soal 34-35), opsi salah
  +を/+で/+ni yang salah; 〜月〜日 (36-40) opsi salah tanggal lain yang
  mirip (angka digeser), termasuk bacaan khusus tanggal 20 = はつか;
  毎週／毎月／毎年 (41-45) opsi cross-pattern +毎日 (kata sungguhan tapi di
  luar 3 pola resmi bab ini); 何曜日／何月何日／いつ (46-50) opsi
  cross-pattern +何時. もんだい3 pakai 12 kosakata waktu relatif dari bank
  Bab 16 (074) — あした／きのう／あさって／せんげつ／らいげつ／こんげつ／
  きょねん／らいねん／しゅうまつ／せんしゅう／らいしゅう／こんしゅう,
  SEMUA kana polos (bank 074 punya banyak kata lain seperti 明日／今日／
  来月 yang memakai kanji 明／今／来 yang belum diajarkan). Whitelist kanji
  = whitelist 100/104/103/105 UNION 日火水木金土 (sama persis dengan
  `v_kanji_ok` di 085). **Metode dedup lanjut disempurnakan**: array
  di-grep ulang penuh dari 039-105 seperti 105, TAPI proses grep sempat
  ke-tangkap 2 baris PALSU dari komentar migration 105 sendiri (placeholder
  literal `<u>...</u>`/`<u>…</u>` di teks penjelasan, bukan target soal
  sungguhan) — sudah difilter manual sebelum dipakai (233 target bersih).
  **Pelajaran untuk migrasi berikutnya**: comment placeholder yang
  menyerupai pola tag target ikut ter-grep dan HARUS di-cross-check/filter
  manual, jangan asumsikan hasil grep otomatis bersih. Divalidasi
  end-to-end: replay penuh
  081→062→100→082→090→102→104→083→091→103→084→092→105→085→093→106 di atas
  modul Bab 12+13+14+15+16 dummy — kelima assignment (Bab 12-16) applied
  bersih berdampingan, semua opsi 4/1 kunci, pagar level + dedup lolos,
  kanji tested antar bab semuanya berbeda (Bab12: 読書見食飲行; Bab13:
  車花電車道駅; Bab14: 立休入出; Bab15: 言話聞買店会社; Bab16: 日火水木金土).

- **Assignment Bab 17: Suka & Mahir** diisi migration **107**
  (`107_assignment_bab17_suka_mahir.sql`), pola sama persis dengan
  100/104/103/105/106 (50 soal, sort_order 100). Bab 17 memperkenalkan 9
  kanji BARU — 子・父・母・友・手・足・口・目・耳 (keluarga & bagian tubuh)
  — tapi 好・嫌 (suki/kirai) BELUM diajarkan, jadi すき／きらい selalu
  kana. もんだい1/2 diisi KOSAKATA POLOS 9 kanji baru (父／母／友だち／手／
  足／口／目／耳／子ども), gaya 105/106 — 4 pola grammar Bab 17
  (〜が好きです・〜が上手です・〜ができます・どんな〜) sama sekali tidak
  butuh kanji baru untuk diuji (partikel が + kata tanya どんな), jadi
  tidak dipaksakan ke もんだい1/2. **Jebakan whitelist baru ditemukan**:
  soal draf awal memakai "大きいです" (mata besar) sebagai konteks di
  luar tag, tapi 大 TERNYATA TIDAK ADA di whitelist meski "大学"/"大学生"
  sudah lama jadi target dedup historis — kanji di DALAM tag `<u>` tidak
  pernah dicek terhadap whitelist (assertion 1 cuma cek badan kalimat DI
  LUAR tag), jadi 大学/大学生 lolos dulu sebagai TARGET tapi 大 tidak
  pernah benar-benar ditambahkan ke whitelist "bebas dipakai di luar tag".
  Pelajaran: jangan asumsikan kanji yang muncul di ARRAY DEDUP otomatis
  aman dipakai bebas di badan kalimat — selalu cross-check terhadap
  whitelist string yang sebenarnya. Diganti ke "わるいです" (kana, tidak
  butuh kanji). もんだい1 文の文法1 (split 5/5/5/5) menguji partikel が di
  3 pola pertama (〜が好きです／嫌いです・〜が上手です／下手です・
  〜ができます — semua opsi salah seragam を/に/で supaya siswa fokus pada
  SATU nuansa partikel), dan どんな vs kata tanya lain (どう/なに/だれ) di
  pola ke-4. もんだい3 pakai 12 kosakata umum bertema suka/mahir/hobi
  (すき／きらい／だいすき／だいきらい／じょうず／へた／とくい／どんな／
  りょうり／うた／え／おんがく) — Bab 17 BELUM punya bank kosakata resmi
  (075 cuma seed kanji_items, bukan module_vocabulary), jadi dipilih
  kosakata umum N5 yang tematik, bukan dari bank existing. Whitelist kanji
  = whitelist 100/104/103/105/106 UNION 子父母友手足口目耳 (sama persis
  dengan `v_kanji_ok` di 086). Divalidasi end-to-end: replay penuh
  081→062→100→082→090→102→104→083→091→103→084→092→105→085→093→106→086→094→107
  di atas modul Bab 12+13+14+15+16+17 dummy — keenam assignment (Bab
  12-17) applied bersih berdampingan, semua opsi 4/1 kunci, pagar level +
  dedup lolos.

- **Assignment Bab 18: Perbandingan** diisi migration **108**
  (`108_assignment_bab18_perbandingan.sql`), pola sama persis dengan
  100/104/103/105/106/107 (50 soal, sort_order 100). Bab 18 memperkenalkan
  4 kanji BARU — 大(おお)・小(ちい)・多(おお)・少(すく), semuanya kata
  sifat い ukuran/jumlah (番 dari いちばん belum diajarkan, selalu kana).
  Beda dari 105/106/107 (Bab 15-17, kanji baru = kata benda → kosakata
  polos): kanji baru Bab 18 adalah kata SIFAT い yang alami dikonjugasi,
  jadi もんだい1/2 kembali ke pola KONJUGASI (bentuk kini + bentuk lampau
  かった) seperti 100/103 (Bab 12/14). **CATATAN PENTING**: 大 di bab ini
  BARU RESMI masuk whitelist badan-kalimat — di 107 (Bab 17) 大 sengaja
  dihindari di luar tag karena waktu itu belum taught (lihat jebakan
  whitelist di 107); sekarang boleh dipakai bebas. もんだい1 文の文法1
  (split 5/5/5/5) menguji 4 pola: AはBより〜です／AよりBのほうが〜 (opsi
  salah partikel lain と/の/が), AとBとどちらが〜 (opsi salah どれ/なに/だれ
  — menegaskan nuansa "どれ untuk ≥3 pilihan" dari catatan grammar 087),
  dan 〜の中で〜が一番〜 (opsi salah なか/より/のほうが). もんだい3 pakai
  12 kosakata umum (4 musim dari bank Bab 16 yang belum pernah dites + 4
  transportasi + 4 makanan) karena Bab 18 belum punya bank kosakata resmi.
  **Jebakan pagar "rantai の" varian keempat — PALING LUAS ditemukan di
  migrasi ini**: draft awal ke-flag di 8 dari 30 soal もんだい1-3, semuanya
  dari kombinasi kata umum yang SENDIRI-SENDIRI wajar tapi kalau digabung
  jadi dua の: (1) この + あの dalam satu kalimat perbandingan ("この 本は
  あの 本より..." — pola PERSIS dari contoh di 087_bunpou_bab18.sql
  sendiri!) → diganti nama kota/benda konkret tanpa この/あの; (2) くだもの
  (berakhiran の) + の posesif → "くだものの中で" = 2 の → diganti やさい
  (tidak berakhiran の); (3) のりもの (mengandung DUA の SEKALIGUS di
  dalam satu kata: の-ri-mo-no) — bahkan SENDIRIAN tanpa kata lain pun
  sudah melanggar assertion, mirip のみもの (100) tapi ini kasus kata
  benda umum, bukan kuliner → dihapus total dari kolom question, diganti
  "それは" generik; (4) にほんの/インドの + たべもの (berakhiran の) → 2-3 の
  → salah satu の-nya dihapus dari kalimat. **Pelajaran kumulatif**: kata
  APAPUN yang berakhiran の (たべもの／のみもの／くだもの／のりもの／
  たてもの dst — pola umum kata benda bahasa Jepang "X-mono") otomatis
  jadi separuh dari rantai の begitu digabung dengan の lain di kalimat
  yang sama (posesif, この/あの/そのkalau ada, atau kata ber-の lain);
  cek MANUAL setiap kalimat baru yang memakai kata berakhiran の, jangan
  cuma andalkan pola yang "terlihat aman". Divalidasi end-to-end: replay
  penuh
  081→062→100→082→090→102→104→083→091→103→084→092→105→085→093→106→086→094→107→087→095→108
  di atas modul Bab 12-18 dummy — ketujuh assignment (Bab 12-18) applied
  bersih berdampingan, semua opsi 4/1 kunci, pagar level + dedup lolos.

- **Assignment Bab 19: Keinginan & Rencana** diisi migration **109**
  (`109_assignment_bab19_keinginan_rencana.sql`), pola sama persis dengan
  100/104/103/105/106/107/108 (50 soal, sort_order 100). Bab 19
  memperkenalkan 5 kanji BARU — 雨(あめ)・天(dalam 天気)・空(そら)・
  山(やま)・川(かわ), kata benda alam/cuaca (欲・予定 belum diajarkan,
  jadi ほしい／よてい selalu kana). もんだい1/2 diisi KOSAKATA POLOS gaya
  105/106/107 (bukan konjugasi, karena 6 pola grammar Bab 19 tidak butuh
  kanji baru untuk diuji): 雨／天気／空／山／川 + 3 kombinasi berakhiran
  satu の (雨の日／山の上／川の水, masing-masing HANYA satu の jadi aman
  dari jebakan rantai の) + あおい空 (reuse 空 dalam frasa berbeda).
  もんだい1 文の文法1 (split 4/3/3/3/3/4) menguji 6 pola: 〜たいです／
  〜たくないです (opsi salah bentuk ます/ません/ました dari verba yang
  sama), [noun]が欲しいです (opsi salah partikel を/に/で, konsisten
  dengan nuansa partikel が dari Bab 17), 〜つもりです vs 〜予定です
  (cross-pattern, menegaskan niat pribadi vs jadwal ditetapkan dari
  catatan grammar 088), dan 〜ましょう／ませんか (mengajak vs menyetujui
  ajakan). もんだい3 pakai 12 kosakata umum bertema keinginan/rencana/hobi
  (りょこう／かいもの／さんぽ／しごと／べんきょう／かいぎ／しゅみ／
  けいかく／よてい／つもり／きぼう／ゆめ) karena Bab 19 belum punya bank
  kosakata resmi. Whitelist kanji = whitelist 100/104/103/105/106/107/108
  UNION 雨天空山川 (sama persis dengan `v_kanji_ok` di 088). Draft PERTAMA
  KALI sejak migration 106 lolos tanpa revisi jebakan の-chain atau
  whitelist — kata-kata alam bab ini (雨/天気/空/山/川) kebetulan tidak
  berakhiran の dan tidak pernah perlu digabung dengan この/あの/kata
  ber-の lain dalam desain yang dipilih. Divalidasi end-to-end: replay
  penuh
  081→062→100→082→090→102→104→083→091→103→084→092→105→085→093→106→086→094→107→087→095→108→088→096→109
  di atas modul Bab 12-19 dummy — kedelapan assignment (Bab 12-19)
  applied bersih berdampingan, semua opsi 4/1 kunci, pagar level + dedup
  lolos.

- **Assignment Bab 20: Pengalaman & Penghubung Kalimat** diisi migration
  **110** (`110_assignment_bab20_pengalaman_penghubung.sql`) — BAB
  PENUTUP seri Assignment Bab 12-20, pola sama persis dengan
  100/104/103/105/106/107/108/109 (50 soal, sort_order 100). Bab 20
  memperkenalkan 2 kanji BARU — 来 dan 令. 来 ISTIMEWA karena punya DUA
  cara baca: らい (on-yomi, kata majemuk waktu 来年／来月／来週 — kata ini
  SEBELUMNYA selalu kana di 106/109 karena 来 belum taught, sekarang boleh
  kanji) dan き／く／こ (kun-yomi, verba tidak beraturan 来る "datang":
  来ます／来ました／来ません／来て／来ない). もんだい1/2 SENGAJA memakai
  7 dari 9 target untuk menguji KEDUA cara baca sekaligus (jebakan klasik
  JLPT — kanji yang sama, bacaan beda tergantung konteks), plus 令和
  (nama era, satu-satunya kata yang memakai 令 di level N5). もんだい1
  文の文法1 (split 4/4/4/4/4) menguji 5 pola penutup N5: 〜たことが
  あります／ありません (opsi salah bentuk ます/ました/ています dari verba
  sama), 〜から sebagai penanda SEBAB (opsi salah penghubung lain di
  posisi salah gramatikal: が/でも/そして), 〜が、〜 pertentangan di AKHIR
  kalimat pertama (opsi salah から/ので/と), dan そして／それから／でも
  (satu-satunya pola yang testable murni dari konteks makna — memilih
  penghubung antar-kalimat yang tepat berdasarkan hubungan logis kedua
  kalimat, bukan posisi gramatikal). もんだい3 pakai 12 kata keterangan
  umum N5/N4 yang menyertai kalimat pengalaman/pendapat
  (いちども／はじめて／もう／まだ／やっと／ぜんぜん／たぶん／もちろん／
  ぜひ／きっと／やっぱり／とても) karena Bab 20 belum punya bank kosakata
  resmi. Whitelist kanji = whitelist 100/104/103/105/106/107/108/109
  UNION 来令 (sama persis dengan `v_kanji_ok` di 089). Draft ini JUGA
  lolos tanpa revisi jebakan の-chain atau whitelist (kata-kata 来-based
  tidak berakhiran の). Divalidasi end-to-end: replay penuh
  081→062→100→082→090→102→104→083→091→103→084→092→105→085→093→106→086→094→107→087→095→108→088→096→109→089→097→110
  di atas modul Bab 12-20 dummy — SEMBILAN assignment (Bab 12-20, seri
  LENGKAP) applied bersih berdampingan, semua opsi 4/1 kunci, pagar level
  + dedup lolos, kanji tested antar bab semuanya berbeda (Bab12:
  読書見食飲行; Bab13: 車花電車道駅; Bab14: 立休入出; Bab15: 言話聞買店会社;
  Bab16: 日火水木金土; Bab17: 子父母友手足口目耳; Bab18: 大小多少; Bab19:
  雨天空山川; Bab20: 来令). **Seri Assignment Bab 12-20 selesai
  (2026-08-27)** — 450 soal total tersebar di 9 lesson, satu per bab,
  masing-masing menguji kanji baru bab itu sendiri tanpa tumpang tindih
  dengan bab lain.

- [x] **Assignment Bab 12-20 belum ada dokkai (読解) / listening (聴解)**
  — SELESAI (2026-08-27, migrasi 111-119, lihat catatan lengkap di bawah)
  — user (2026-08-27) menyadari Assignment 100/104/103/105-110 cuma
  menguji vocabulary+grammar (漢字読み/表記/文脈規定/文の文法1), padahal
  kolom `question_category IN ('reading','listening')` + `passage` +
  `audio_script` sudah lama ada (migration 012/013/034) dan dipakai fitur
  lain (generator JLPT dokkai/listening terpisah). Keputusan user: EXTEND
  lesson Assignment yang sudah ada (bukan lesson baru terpisah) — satu
  migrasi tambahan per bab, **111-119** (`111_assignment_bab12_dokkai_
  listening.sql` dst, satu file per bab, DELETE hanya menyasar
  `question_category IN ('reading','listening')` milik lesson itu supaya
  50 soal vocabulary/grammar dari 100/104/103/105-110 tidak ikut kehapus
  saat re-run). Tiap bab dapat tambahan tetap: もんだい4 読解 (1 passage
  pendek + 3 soal pemahaman) + もんだい5 聴解 (4 dialog INDEPENDEN,
  masing-masing audio_script sendiri, 1 soal per dialog) = 7 soal baru,
  total per Assignment naik 50→57; `questions_per_attempt` di-update ke
  jumlah baru supaya kebijakan "semua soal tampil tiap attempt" (established
  Bab 8/055) tetap berlaku.
  **Draft konten pakai subagent Opus** (permintaan user: "Put opus as sub
  agent as you need it") — Sonnet menulis SQL/migration/validasi seperti
  biasa, tapi teks Jepang passage+dialog di-draft Opus dulu untuk hasil
  lebih natural, lalu di-cross-check ulang lewat assertion SQL yang sama
  ketatnya dengan mondai vocabulary/grammar.
  **Assertion baru** (di luar 6 assertion existing 100/104/dst yang tetap
  berlaku utuh karena `WHERE lesson_id = v_lesson_id` mencakup semua soal):
  pagar kanji + rantai-の kini JUGA dicek pada kolom `passage` dan
  `audio_script` (bukan cuma `question` seperti soal vocabulary/grammar —
  makna kalimat sesungguhnya ada di dua kolom itu, `question` di mondai
  4/5 cuma kalimat tanya pendek), plus format tiap baris `audio_script`
  wajib `SPEAKER: teks` dengan SPEAKER cuma N/A/B (subset `SPEAKER_RE` di
  `backend/src/routes/tts.js` `parseDialog()`). Dedup `<u>` TIDAK berlaku
  di mondai 4/5 (tidak ada tag `<u>` sama sekali di sana).
  **Jebakan の-chain baru ditemukan saat drafting Bab 12 (111)**: kalimat
  narator standar gaya JLPT asli "男の人と女の人が話しています" itu SENDIRI
  adalah rantai の (男**の**人 + 女**の**人 = 2 の dalam satu kalimat) — jadi
  listening di semua bab 111-119 pakai NAMA (mis. ミナさん／たなかさん)
  untuk kedua pembicara di baris narator, BUKAN "男の人／女の人" generik.
  Bab 12 (111) selesai duluan sebagai percontohan: passage cerita rutinitas
  harian (te-form chaining 〜て、〜／〜てから) + 4 dialog listening,
  semuanya dalam whitelist kanji 100/081 (68 karakter) dan sengaja
  menghindari 〜てください／〜ています (baru diajarkan Bab 13) supaya tidak
  bocor materi bab depan. Divalidasi bersih tanpa revisi kanji/rantai-の
  pada draft pertama (Postgres lokal, replay 081→100→111 di atas modul
  Bab 12 dummy, re-run kedua dikonfirmasi idempoten — masih 57 soal, tidak
  dobel). Bab 13-20 (112-119) menyusul dengan pola identik.
  **Bab 13 (112) selesai** — grammar scope ています／てください／
  てくれませんか／てもいいですか／てはいけません (082_bunpou_bab13.sql),
  whitelist kanji SAMA PERSIS dengan Bab 12 (Bab 13 tidak memperkenalkan
  kanji baru). Passage: aturan perpustakaan (boleh/tidak boleh, tolong
  kembalikan buku). Listening: 4 dialog ミナさん／たなかさん／おかださん
  (nama yang sama dengan 111 untuk kontinuitas). Sengaja TIDAK memakai
  nai-form/bentuk plain/たことがあります/ましょう・ませんか/penghubung
  そして・それから・でも・〜が、 (semua itu Bab 14+) supaya tidak bocor
  materi depan. **Klarifikasi user setelah Bab 12/13**: level soal harus
  tetap N5 (jangan terlalu susah), dan BOLEH pakai grammar/kosakata/kanji
  dari bab-bab SEBELUMNYA sebagai kalimat pengantar/konteks soal (tidak
  perlu memaksakan tiap kalimat 100% dari bab itu sendiri) — sudah otomatis
  konsisten karena whitelist kanji memang kumulatif (bukan cuma kanji bab
  ini), tapi ini eksplisit meng-encourage makin sering pakai kosakata umum
  bab lama (学校／駅／花／先生 dst) sebagai konteks alih-alih memaksa tema
  sempit tiap bab. **Jebakan の tambahan dicatat**: この／あの／その／どの
  masing-masing SENDIRI mengandung satu karakter の (こ-の dieja hiragana)
  — aman dipakai sekali per kalimat, tapi kalau digabung dengan の lain
  (posesif, atau この+あの sekaligus) kena regex rantai-の yang sama;
  semua kalimat Bab 13 dicek manual max 1 の per kalimat. Divalidasi bersih
  tanpa revisi pada draft pertama (Postgres lokal, replay 081→104→112,
  idempoten). Bab 14-20 (113-119) menyusul dengan pola identik, level N5
  santai dan bebas pakai kosakata bab lama sebagai pengantar.
  **Bab 14 (113) selesai** — grammar scope V-ない／〜ないでください／
  〜なければなりません／〜なくてもいいです／V-kamus／〜た／〜なかった
  (083_bunpou_bab14.sql). 4 kanji baru Bab 14 (立休入出) ditambahkan ke
  whitelist (72 karakter total). Passage: aturan darmawisata sekolah
  (barang wajib vs opsional dibawa). Listening: 4 dialog ミナさん／
  たなかさん／おかださん. **Draft pertama (Opus) menyelipkan「でも、」
  sebagai penghubung kalimat di salah satu dialog** — dihapus manual
  sebelum commit karena そして／それから／でも (dan 〜が、〜 pertentangan)
  sengaja direservasi untuk Bab 20 (089_bunpou_bab20.sql); dua kalimat
  berdiri sendiri tanpa penghubung tetap gramatikal. **Jebakan の baru**:
  きのう (kemarin) mengandung karakter の di suku tengahnya (き-の-う) —
  sama seperti pola kata "X-mono", otomatis memakai jatah の kalimat itu;
  jangan digabung dengan この／あの／の posesif lain di kalimat yang sama.
  Divalidasi bersih setelah fix でも (Postgres lokal, replay 081→103→113,
  idempoten). Bab 15-20 (114-119) menyusul dengan pola identik — untuk
  draft berikutnya, tambahkan larangan eksplisit でも/そして/それから/
  〜が、〜 di prompt subagent (bukan cuma nama pola-nya, tapi juga kata
  penghubung netral "tapi/namun" apa pun) supaya jebakan yang sama tidak
  terulang.
  **Bab 15 (114) selesai** — grammar scope 〜を[counter]お願いします／
  〜はいかがですか／〜になります／お〜ください／〜にします／
  〜くなります・〜になります (084_bunpou_bab15.sql), konteks toko/resto.
  7 kanji baru Bab 15 (言話聞買店会社) ditambahkan ke whitelist (78/79
  karakter — subagent mengoreksi hitungan label prompt sebelumnya yang
  keliru bilang 79, string-nya sendiri identik dengan 105, cuma labelnya
  yang salah hitung). Catatan penting: 願 (dalam お願いします) TIDAK ada
  di whitelist, jadi selalu ditulis kana おねがいします — konsisten dengan
  105. Passage: transaksi kafe (pesan, ditawari, memutuskan, total harga).
  Listening: 4 dialog toko dengan nama ミナさん／たなかさん／おかださん／
  やまださん. **Larangan でも/そして/それから/〜が、〜 dieksplisitkan di
  prompt kali ini (pelajaran dari 113) dan berhasil — draft pertama bersih
  tanpa perlu revisi manual.** Divalidasi bersih pada draft pertama
  (Postgres lokal, replay 081→105→114, idempoten). Bab 16-20 (115-119)
  menyusul dengan pola identik, larangan grammar bab depan tetap
  dieksplisitkan tiap prompt.
  **Bab 16 (115) selesai** — grammar scope 〜に (partikel waktu titik
  spesifik)／〜月〜日／毎週・毎月・毎年／何曜日・何月何日・いつ
  (085_bunpou_bab16.sql). 6 kanji baru Bab 16 (日火水木金土) ditambahkan
  ke whitelist (84 karakter). 曜 (dalam ようび) tetap TIDAK diajarkan,
  selalu kana. **Jebakan baru ditemukan**: 京 (dalam 東京) JUGA tidak
  diajarkan (cuma 東 yang taught) — draft pertama sempat pakai 東京 kanji,
  diperbaiki ke とうきょう kana penuh sebelum commit. Passage: jadwal
  mingguan + tanggal ujian + rutinitas bulanan. Listening: 4 dialog
  bertema jebakan klasik JLPT choukai — beberapa hari/tanggal disebut
  dalam satu audio, siswa harus menyimak SAMPAI AKHIR untuk tahu yang
  benar-benar berlaku (dialog 2: rapat pindah dari 六月八日 ke 六月九日;
  dialog 4: kebiasaan 十二月 tapi tahun ini 一月十五日). Larangan
  でも/そして/それから/〜が、〜 tetap bersih tanpa revisi (kedua kalinya
  berturut-turut sejak larangan dieksplisitkan). Divalidasi bersih pada
  draft final (Postgres lokal, replay 081→106→115, idempoten). Bab 17-20
  (116-119) menyusul dengan pola identik.
  **Bab 17 (116) selesai** — grammar scope 〜が好きです／嫌いです (selalu
  kana すき／きらい — 好/嫌 TIDAK diajarkan meski jadi inti pola bab ini),
  〜が上手です／下手です, 〜ができます, どんな〜 (086_bunpou_bab17.sql).
  9 kanji baru Bab 17 (子父母友手足口目耳) ditambahkan ke whitelist (93
  karakter) — hanya 父・母・友・手 yang kepakai secara alami di konten
  suka/mahir ini (子/足/口/目/耳 dibiarkan untuk もんだい1/2 yang memang
  menguji vocab tersebut). Passage: perkenalan diri (suka musik, mahir
  piano, tidak mahir menyanyi). Listening: 4 dialog dengan jebakan khas
  JLPT — dialog 1 menguji beda 〜が すきです vs 〜が 上手です (kata paling
  sering disebut justru yang TIDAK mahir); dialog 2 melacak kemampuan 3
  orang berbeda (siswa harus mengaitkan subjek dengan levelnya
  masing-masing, bukan cuma menangkap kata kunci). Larangan
  でも/そして/それから/〜が、〜 tetap bersih tanpa revisi (ketiga kalinya
  berturut-turut). Divalidasi bersih pada draft final (Postgres lokal,
  replay 081→107→116, idempoten). Bab 18-20 (117-119) menyusul dengan
  pola identik.
  **Bab 18 (117) selesai** — grammar scope AはBより／AよりBのほうが／
  AとBとどちらが／〜の中で〜がいちばん (087_bunpou_bab18.sql). 4 kanji
  baru Bab 18 (大小多少) ditambahkan ke whitelist (97 karakter). 番 (dalam
  いちばん) tetap TIDAK diajarkan, selalu kana. **Jebakan の-chain
  TERBESAR ada di bab ini** (lihat catatan panjang di migration 108:
  この+あの digabung, kata "X-mono" seperti くだもの/のりもの) — kali ini
  larangan totalnya dieksplisitkan di prompt (hindari この/あの/その sama
  sekali, pakai nama toko/benda konkret untuk perbandingan) dan berhasil:
  draft pertama bersih tanpa SATU PUN revisi rantai-の, padahal bab paling
  rawan sejauh ini. Passage: perbandingan 3 toko roti (ukuran, harga,
  keramaian — sengaja toko terkecil yang paling ramai supaya jawaban
  tidak bisa ditebak dari satu fakta saja). Listening: 4 dialog dengan
  pola serupa (barang/transportasi/buah dipilih berdasarkan perbandingan,
  jawaban akhir sering tidak menyebut nama pilihannya secara eksplisit —
  siswa harus menyimpulkan dari "yang lebih murah/cepat" ke barangnya).
  Larangan でも/そして/それから/〜が、〜 tetap bersih (keempat kalinya
  berturut-turut). Divalidasi bersih pada draft pertama (Postgres lokal,
  replay 081→108→117, idempoten). Bab 19-20 (118-119) menyusul dengan
  pola identik.
  **Bab 19 (118) selesai** — grammar scope 〜たいです／〜たくないです／
  [noun]が欲しいです (selalu kana ほしいです — 欲 tidak diajarkan)／
  〜つもりです vs 〜予定です (selalu kana よていです — 予定 tidak diajarkan)
  ／〜ましょう・〜ませんか (088_bunpou_bab19.sql). 5 kanji baru Bab 19
  (雨天空山川) ditambahkan ke whitelist (102 karakter). Passage: keinginan
  &amp; rencana pendakian gunung (たいです／ほしいです／つもりです vs
  よていです semua dipakai natural dalam satu cerita). Listening: dialog 1
  jebakan "harus disimak sampai akhir" (jadwal digeser dua kali sebelum
  disepakati); dialog 2 keinginan yang BERUBAH di tengah percakapan;
  dialog 3 barang yang disebut PERTAMA justru DITOLAK (kamera kemahalan,
  niat sebenarnya beli sepeda) — pola sama dengan jebakan suka-vs-mahir
  Bab 17 dan perbandingan Bab 18. Larangan でも/そして/それから/〜が、〜
  tetap bersih (kelima kalinya berturut-turut). Divalidasi bersih pada
  draft pertama (Postgres lokal, replay 081→109→118, idempoten). Bab 20
  (119) — BAB PENUTUP seri dokkai/listening — menyusul dengan pola
  identik.
  **Bab 20 (119) selesai — SERI DOKKAI/LISTENING BAB 12-20 LENGKAP
  (2026-08-27)**. Grammar scope 〜たことがあります／〜たことがありません／
  〜から (sebab)／〜が、〜 (pertentangan)／そして・それから・でも
  (089_bunpou_bab20.sql) — BEDA dari migrasi 111-118: keempat pola ini
  direservasi untuk bab ini di semua bab sebelumnya, sekarang dipakai
  bebas karena inilah bab yang mengajarkannya. 2 kanji baru Bab 20
  (来令) ditambahkan ke whitelist (104 karakter) — 来 sengaja diuji KEDUA
  bacaannya sekaligus (らい di 来年／来週／来月, き di kata kerja 来る:
  来ます／来ません) sebagai poin ajar inti; 令 TIDAK dipakai sama sekali
  karena satu-satunya pemakaian N5 (令和) butuh kanji 和 yang tidak ada
  di whitelist — menambah 和 adalah keputusan kurikulum terpisah, di luar
  scope migrasi ini. Passage: pengalaman ke Jepang + mendaki gunung,
  merangkai たことがあります／それから／〜が、〜／でも／〜から dalam satu
  cerita. Listening: dialog 1 jawaban "mendaki bersama tahun depan" tidak
  diucapkan kata per kata (harus digabung dari ajakan てくれませんか-style
  + persetujuan); dialog 3 total harga bukan penjumlahan kedua barang
  yang disebut, tapi harga barang yang akhirnya DIPILIH setelah でも
  membalik keputusan awal. Divalidasi bersih pada draft pertama (Postgres
  lokal, replay 081→110→119, idempoten, DAN verifikasi akhir: kesembilan
  lesson assignment-bab-12 s/d -20 semuanya persis 57 soal). **Seri
  111-119 selesai (2026-08-27)** — 7 soal baru × 9 bab = 63 soal baru
  total (27 reading + 36 listening), ditambah 450 soal vocab/grammar dari
  seri 100-110, sehingga tiap Assignment Bab 12-20 sekarang 57 soal
  (9 × 57 = 513 soal total di seluruh Bab 12-20). Assignment sekarang
  benar-benar menguji keempat kategori JLPT (vocabulary/grammar/reading/
  listening), bukan cuma vocab+grammar seperti sebelumnya.

## Struktur repo (high-level)

- `backend/` — Node.js API, Postgres-backed. Entry: `src/server.js`.
- `backend/migrations/` — SQL migrasi yang di-track via `schema_migrations`.
- `backend/deploy/` — file ops (systemd unit, nginx conf, backup script + cron).
- `app/` — Kanji PWA (app.eznihongo.com), separate auth realm dari main site.
- `welcome.html`, landing pages — main site (eznihongo.com).
- `supabase/` — legacy, ported ke backend Node. Jangan dipakai untuk fitur baru.
