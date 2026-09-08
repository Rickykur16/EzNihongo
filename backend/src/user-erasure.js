// Menjalankan hak "hapus data" yang dijanjikan privacy.html bagian 5.
//
// Alurnya admin-only dan disengaja: privacy.html menyuruh siswa menghubungi
// lewat WhatsApp dengan menyebutkan email akunnya, bukan menekan tombol
// sendiri — jadi tidak ada endpoint self-service di sini.
//
// KENAPA ANONIMISASI, BUKAN `DELETE FROM users` — diukur di Postgres asli,
// bukan dibaca dari skema:
//   1. `order_payments.submitted_by` dan `.reviewed_by` TIDAK punya klausa
//      ON DELETE (default NO ACTION), jadi DELETE-nya gagal total dengan
//      foreign key violation untuk siswa mana pun yang pernah mengunggah
//      bukti transfer — dan juga untuk admin yang pernah me-review.
//   2. `orders.user_id` justru ON DELETE CASCADE, jadi kalaupun pagar (1)
//      dilepas, hard delete akan MENGHANCURKAN catatan pembayaran — padahal
//      privacy.html bagian 4 secara eksplisit mencadangkan hak menyimpannya
//      ("kecuali ada kewajiban hukum ... misalnya catatan transaksi
//      pembayaran").
// Jadi hard delete bukan cuma sulit, tapi memang bertentangan dengan
// kebijakan kita sendiri. Yang benar: baris `users` DIPERTAHANKAN sebagai
// batu nisan yang sudah dianonimkan, seluruh data pribadinya dibersihkan.
//
// KONSEKUENSI YANG MUDAH TERLEWAT: karena baris `users` tidak dihapus,
// ke-15 ON DELETE CASCADE yang menempel ke users TIDAK ADA YANG JALAN.
// Tiap tabel satelit wajib dibersihkan eksplisit di bawah — melewatkan satu
// tabel berarti data pribadi tertinggal diam-diam. Itulah sebabnya ada
// assertUserTablesCovered() di bawah.

// Tabel yang isinya milik siswa dan dihapus seluruhnya saat akun dihapus.
const WIPE_TABLES = [
  'sessions',
  'user_marketing_profile',
  'user_enrollments',
  'user_progress',
  'user_learning_state',
  'user_stats',
  'user_practice_state',
  'user_practice_legacy_imports',
  'practice_attempts',
  'quiz_question_results',
  'quiz_attempts',
  'grammar_attempts',
  'smart_review_sessions',
];

// Tabel ber-FK ke users yang SENGAJA tidak masuk WIPE_TABLES, masing-masing
// dengan alasannya. Dipakai assertUserTablesCovered() supaya tabel baru yang
// ditambahkan migrasi berikutnya tidak diam-diam lolos dari penghapusan.
const HANDLED_SEPARATELY = {
  // Catatan keuangan — dipertahankan sesuai carve-out privacy.html bagian 4,
  // kolom PII-nya di-scrub, bukan barisnya dihapus.
  orders: 'catatan keuangan, dipertahankan',
  order_payments: 'catatan keuangan, kolom PII di-scrub',
  // parent_id CASCADE ke dirinya sendiri: menghapus komentar induk milik
  // siswa ini akan ikut menghapus BALASAN ORANG LAIN. Tabelnya sudah punya
  // is_deleted yang dihormati pembacanya (routes/discussions.js), jadi
  // konten di-scrub dan baris dipertahankan supaya utas tetap utuh.
  discussions: 'konten di-scrub, baris dipertahankan agar balasan orang lain tidak ikut terhapus',
};

// Pagar anti-lupa. Repo ini rutin menambah tabel per-user (yang terbaru
// user_marketing_profile di migration 138), jadi daftar statis di atas pasti
// akan ketinggalan suatu saat. Ini menanyakan langsung ke katalog Postgres
// tabel apa saja yang menunjuk users(id), lalu MENOLAK menjalankan
// penghapusan kalau ada yang belum dipertimbangkan — gagal terang-terangan
// jauh lebih baik daripada diam-diam meninggalkan data pribadi.
export async function assertUserTablesCovered(client) {
  const { rows } = await client.query(
    `SELECT DISTINCT c.conrelid::regclass::text AS tabel
       FROM pg_constraint c
      WHERE c.contype = 'f' AND c.confrelid = 'users'::regclass`
  );
  const known = new Set([...WIPE_TABLES, ...Object.keys(HANDLED_SEPARATELY)]);
  const unknown = rows.map((r) => r.tabel).filter((t) => !known.has(t));
  if (unknown.length) {
    throw new Error(
      `user_erasure_incomplete: tabel ber-FK ke users belum ditangani: ${unknown.join(', ')}. ` +
      `Tambahkan ke WIPE_TABLES atau HANDLED_SEPARATELY di backend/src/user-erasure.js.`
    );
  }
}

// Hak "menarik persetujuan" (privacy.html bagian 5) tanpa menghapus akun:
// data profil marketing hilang, akun + akses kursus + progres belajar tetap.
// Karena baris user_marketing_profile yang ADA berarti "sudah pernah mengisi"
// (lihat migration 138), menghapusnya juga berarti siswa akan diminta mengisi
// lagi saat enroll kursus berikutnya — itu memang perilaku yang diinginkan:
// persetujuan ditarik, jadi harus diminta ulang, bukan diasumsikan.
export async function deleteMarketingProfile(client, userId) {
  const res = await client.query(
    `DELETE FROM user_marketing_profile WHERE user_id = $1`,
    [userId]
  );
  return { deleted: res.rowCount > 0 };
}

// Penghapusan akun penuh. Idempoten: menjalankannya dua kali aman, yang kedua
// tidak menemukan apa-apa lagi untuk dibersihkan.
export async function eraseUserAccount(client, userId) {
  await assertUserTablesCovered(client);

  const wiped = {};
  for (const table of WIPE_TABLES) {
    // Nama tabel berasal dari konstanta di file ini saja, tidak pernah dari
    // input request — jadi interpolasi di sini bukan jalur injeksi.
    const res = await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
    wiped[table] = res.rowCount;
  }

  // Konten diskusi: di-scrub, barisnya dipertahankan (lihat HANDLED_SEPARATELY).
  const disc = await client.query(
    `UPDATE discussions
        SET content = '[dihapus atas permintaan pengguna]', is_deleted = TRUE, updated_at = NOW()
      WHERE user_id = $1 AND is_deleted = FALSE`,
    [userId]
  );
  wiped.discussions_scrubbed = disc.rowCount;

  // Bukti transfer adalah foto slip bank berisi nama + nomor rekening — item
  // paling padat data pribadi di seluruh sistem. Catatan transaksinya sendiri
  // (nominal, tanggal, nomor pesanan di `orders`) sudah cukup untuk keperluan
  // penyimpanan yang dicadangkan kebijakan; fotonya tidak. Jadi barisnya
  // dipertahankan, gambar + nama pengirimnya dibuang.
  const pay = await client.query(
    `UPDATE order_payments
        SET proof_image = NULL, proof_mime = NULL, proof_filename = NULL,
            claimed_sender_name = NULL, raw_payload = NULL
      WHERE submitted_by = $1
        AND (proof_image IS NOT NULL OR claimed_sender_name IS NOT NULL OR raw_payload IS NOT NULL)`,
    [userId]
  );
  wiped.order_payments_scrubbed = pay.rowCount;

  // Batu nisan. Email/google_id memakai UUID user itu sendiri supaya dijamin
  // unik (dua kolom itu UNIQUE NOT NULL), dan supaya orang yang sama bisa
  // mendaftar ulang dengan akun Google-nya nanti sebagai user yang benar-benar
  // baru — google_id lamanya sudah tidak menghalangi.
  const anonymized = await client.query(
    `UPDATE users
        SET email = 'dihapus-' || id || '@dihapus.invalid',
            google_id = 'dihapus-' || id,
            full_name = 'Pengguna dihapus',
            google_name = NULL,
            avatar_url = NULL,
            updated_at = NOW()
      WHERE id = $1 AND email NOT LIKE 'dihapus-%@dihapus.invalid'
      RETURNING id`,
    [userId]
  );
  wiped.user_anonymized = anonymized.rowCount;

  return wiped;
}
