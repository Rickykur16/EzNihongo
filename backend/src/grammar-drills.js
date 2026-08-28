// Penurunan soal Step 1 (Recognition) & Step 2 (Controlled Practice) untuk
// Tugas Bunpou — DETERMINISTIK, tanpa panggilan AI dan tanpa tabel baru.
//
// Kenapa diturunkan, bukan disimpan:
//   - Bahannya sudah ada: `module_grammar.meaning` (fungsi pola) dan
//     `grammar_examples.japanese` + `.highlight` (bagian kalimat yang memuat
//     polanya). Seluruh Bab 12-20 punya highlight terisi 138/138, dan Bab 3-11
//     ikut lewat backfill migration 031.
//   - Karena penurunannya murni fungsi dari data itu, server bisa MENURUNKAN
//     ULANG soal yang sama saat menilai jawaban. Jadi kunci jawaban tidak perlu
//     dikirim ke browser dan tidak perlu tabel penyimpanan soal sama sekali.
//   - Konsekuensinya: admin mengubah contoh kalimat → soalnya ikut berubah,
//     tanpa langkah regenerasi.
//
// Batasan yang disadari: pengecoh dibuat dengan aturan perubahan bentuk (lihat
// FORM_RULES). Untuk N5 ini menghasilkan pilihan yang salah secara meyakinkan,
// tapi TIDAK dijamin sempurna untuk tiap pola. Setiap soal membawa field
// `rule` supaya kalau ada soal aneh, ketahuan aturan mana penyebabnya.

// Pengacakan deterministik: urutan opsi harus SAMA saat soal dikirim dan saat
// jawaban dinilai, tanpa menyimpan apa pun. Hash string sederhana (FNV-1a).
function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// Permutasi stabil berdasarkan seed — bukan Math.random (harus reproducible).
function seededOrder(items, seed) {
  return items
    .map((v, i) => ({ v, k: hashString(`${seed}|${i}|${String(v)}`) }))
    .sort((a, b) => (a.k - b.k) || 0)
    .map((x) => x.v);
}

const PARTICLES = ['は', 'が', 'を', 'に', 'で', 'へ', 'と', 'の'];

// Kalimat pertama dari catatan arti pola, untuk dipakai sebagai opsi Step 1.
// Catatan di `module_grammar.meaning` ditulis untuk dibaca sebagai materi
// (sering 2-3 kalimat), bukan sebagai pilihan jawaban; dipakai mentah-mentah
// panjangnya jadi timpang antar opsi.
export function shortMeaning(raw) {
  const t = String(raw || '').trim();
  if (!t) return '';
  const m = t.match(/^[\s\S]*?[.。](\s|$)/);
  let out = m ? m[0].trim() : t;
  // Kalimat pertama yang terlalu pendek (mis. "Menyatakan 'juga'.") tidak
  // cukup membedakan — pakai teks utuhnya.
  if (out.length < 25 && t.length > out.length) out = t;
  return out.length > 140 ? out.slice(0, 137).trim() + '…' : out;
}

// Aturan perubahan bentuk untuk pengecoh Step 2, dicoba BERURUTAN.
// Tiap aturan: kalau `suffix` cocok di akhir jawaban benar, buang suffix itu
// lalu tempelkan tiap `alts` sebagai pengecoh.
//
// Urutan penting: `んで` (bentuk te dari 読む/飲む/遊ぶ) harus dicek SEBELUM
// partikel `で`, kalau tidak "読んで" akan diperlakukan sebagai "読ん + partikel で"
// dan menghasilkan pengecoh yang ngawur ("読んは", "読んを").
const FORM_RULES = [
  // Bentuk masu — keluarga yang paling sering tertukar di N5.
  { rule: 'masu', suffix: 'ませんでした', alts: ['ます', 'ました', 'ません'] },
  { rule: 'masu', suffix: 'ました', alts: ['ます', 'ません', 'ませんでした'] },
  { rule: 'masu', suffix: 'ません', alts: ['ます', 'ました', 'ませんでした'] },
  { rule: 'masu', suffix: 'ます', alts: ['ました', 'ません', 'ませんでした'] },
  // Kopula.
  { rule: 'desu', suffix: 'じゃありません', alts: ['です', 'でした', 'じゃありませんでした'] },
  { rule: 'desu', suffix: 'でした', alts: ['です', 'じゃありません', 'じゃありませんでした'] },
  { rule: 'desu', suffix: 'です', alts: ['でした', 'じゃありません', 'じゃありませんでした'] },
  // Bentuk nai (Bab 14) — nai / nakute / nakatta / naide.
  { rule: 'nai', suffix: 'ないで', alts: ['ない', 'なくて', 'なかった'] },
  { rule: 'nai', suffix: 'なかった', alts: ['ない', 'なくて', 'ないで'] },
  { rule: 'nai', suffix: 'なくて', alts: ['ない', 'なかった', 'ないで'] },
  { rule: 'nai', suffix: 'ない', alts: ['なくて', 'なかった', 'ないで'] },
  // Bentuk tai (Bab 19).
  { rule: 'tai', suffix: 'たくない', alts: ['たい', 'たかった', 'たくて'] },
  { rule: 'tai', suffix: 'たい', alts: ['たくない', 'たかった', 'たくて'] },
  // Bentuk te (Bab 12-13) — te vs ta adalah kekeliruan klasik.
  { rule: 'te', suffix: 'んで', alts: ['んだ', 'んでから', 'んでいる'] },
  { rule: 'te', suffix: 'いて', alts: ['いた', 'いてから', 'いている'] },
  { rule: 'te', suffix: 'って', alts: ['った', 'ってから', 'っている'] },
  { rule: 'te', suffix: 'て', alts: ['た', 'てから', 'ている'] },
];

// Pengecoh untuk satu jawaban benar. Mengembalikan { rule, distractors[] }.
export function formDistractors(answer) {
  const a = String(answer || '');
  if (!a) return { rule: 'none', distractors: [] };

  for (const r of FORM_RULES) {
    if (a.length > r.suffix.length && a.endsWith(r.suffix)) {
      const stem = a.slice(0, a.length - r.suffix.length);
      return { rule: r.rule, distractors: r.alts.map((s) => stem + s) };
    }
  }

  // Partikel di akhir → tukar dengan partikel lain (uji pemilihan partikel).
  const last = a.slice(-1);
  if (a.length > 1 && PARTICLES.includes(last)) {
    const stem = a.slice(0, -1);
    return { rule: 'particle-swap', distractors: PARTICLES.filter((p) => p !== last).map((p) => stem + p) };
  }

  // Sisanya diperlakukan sebagai kata benda: tempelkan partikel — ini persis
  // pola "がくせい / がくせいの / がくせいを" yang diminta.
  return { rule: 'particle-append', distractors: ['の', 'を', 'に', 'が'].map((p) => a + p) };
}

// Ambil `n` pengecoh unik yang tidak sama dengan jawaban benar.
function pickDistractors(pool, answer, n, seed) {
  const seen = new Set([answer]);
  const out = [];
  for (const c of seededOrder(pool, seed)) {
    const v = String(c || '').trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= n) break;
  }
  return out;
}

function buildOptions(answer, distractors, seed) {
  const opts = seededOrder([answer, ...distractors], `${seed}|opts`);
  return { options: opts, correctIndex: opts.indexOf(answer) };
}

// ── STEP 1 — Recognition: apakah siswa paham FUNGSI polanya? ──────────────
// Contoh kalimat ditampilkan sebagai konteks, pertanyaannya "Apa fungsi X?",
// pengecohnya = arti pola LAIN di bab yang sama (bukan arti karangan), jadi
// siswa harus benar-benar membedakan fungsi antar pola yang baru dipelajari.
export function buildRecognitionDrill(item, siblings) {
  const meaning = shortMeaning(item.meaning);
  if (!meaning) return null;

  // Dipendekkan ke kalimat pertama supaya keempat opsi sebanding panjangnya.
  // `meaning` di bank ditulis sebagai catatan ajar (bisa 2-3 kalimat), dan
  // opsi yang jauh lebih panjang dari yang lain langsung menjadi petunjuk
  // mana yang benar tanpa siswa perlu memahami apa pun.
  const pool = (siblings || [])
    .filter((s) => s.id !== item.id)
    .map((s) => shortMeaning(s.meaning))
    .filter((m) => m && m !== meaning);

  // Di bawah 2 pengecoh soalnya jadi tebakan 50:50 — lebih baik tidak ada.
  const distractors = pickDistractors(pool, meaning, 3, `${item.id}|recog`);
  if (distractors.length < 2) return null;

  const ex = (item.examples || [])[0];
  const { options, correctIndex } = buildOptions(meaning, distractors, `${item.id}|recog`);
  return {
    step: 1,
    grammarId: item.id,
    prompt: `Apa fungsi ${item.pattern}?`,
    example: ex ? { japanese: ex.japanese, indonesian: ex.indonesian || null } : null,
    options,
    correctIndex, // dibuang sebelum dikirim ke siswa — lihat publicDrill()
    rule: 'sibling-meaning',
  };
}

// Contoh hasil backfill migration 031 (Bab 3-11) disalin dari
// `module_grammar.example` TANPA highlight, jadi tanpa ini seluruh bab lama
// kehilangan Step 2. Polanya sendiri sudah memuat bagian literalnya: ambil
// potongan terpanjang di luar penanda 〜 yang benar-benar muncul di kalimat.
// Mis. pola 「〜てください」 → 「てください」; 「〜は〜です」 → 「です」.
export function deriveHighlight(pattern, japanese) {
  const jp = String(japanese || '');
  if (!jp) return null;
  const chunks = String(pattern || '')
    .replace(/[（(][^）)]*[）)]/g, '')   // buang keterangan dalam kurung
    .split(/[〜～…\s・/]+/)
    .map((c) => c.trim())
    .filter((c) => c.length >= 2 && jp.includes(c))
    .sort((a, b) => b.length - a.length);
  return chunks[0] || null;
}

// ── STEP 2 — Controlled Practice: apakah BENTUKNYA benar? ─────────────────
// Bagian kalimat yang memuat pola (kolom `highlight`) dikosongkan; siswa
// memilih bentuk yang tepat di antara perubahan bentuk yang masuk akal.
export function buildControlledDrill(item, siblings) {
  // Prefer highlight yang memang ditulis penyusun materi; kalau kosong,
  // turunkan dari polanya (lihat deriveHighlight).
  let ex = null;
  let answer = null;
  for (const e of (item.examples || [])) {
    const jp = String(e.japanese || '');
    if (!jp) continue;
    const hl = String(e.highlight || '').trim();
    const useHl = (hl && jp.includes(hl)) ? hl : deriveHighlight(item.pattern, jp);
    if (useHl) { ex = e; answer = useHl; break; }
  }
  if (!ex || !answer) return null;

  const blanked = String(ex.japanese).replace(answer, '＿＿＿');

  const { rule, distractors: formPool } = formDistractors(answer);
  let distractors = pickDistractors(formPool, answer, 3, `${item.id}|ctrl`);

  // Aturan bentuk tidak menghasilkan cukup pilihan → pakai potongan berpola
  // dari contoh pola LAIN di bab yang sama sebagai cadangan.
  if (distractors.length < 3) {
    const sibPool = (siblings || [])
      .filter((s) => s.id !== item.id)
      .flatMap((s) => (s.examples || []).map((e) => String(e.highlight || '').trim()))
      .filter(Boolean);
    distractors = distractors.concat(
      pickDistractors(sibPool, answer, 3 - distractors.length, `${item.id}|ctrl-sib`)
        .filter((d) => !distractors.includes(d))
    );
  }
  if (distractors.length < 2) return null;

  const { options, correctIndex } = buildOptions(answer, distractors, `${item.id}|ctrl`);
  return {
    step: 2,
    grammarId: item.id,
    prompt: `Lengkapi kalimat berikut dengan bentuk yang tepat.`,
    sentence: blanked,
    indonesian: ex.indonesian || null,
    options,
    correctIndex,
    rule,
  };
}

// Semua drill untuk satu daftar pola.
//
// `pool` = sumber pengecoh, DEFAULTNYA seluruh pola satu bab — bukan cuma pola
// di tugas ini. Alasannya konkret: tiap bab dipecah jadi dua Tugas Bunpou, dan
// yang kedua sering hanya berisi 2 pola (mis. Bab 13 tugas 2 = 〜てもいいですか
// + 〜てはいけません). Dengan pool sebatas tugas, itu cuma menyisakan 1 pengecoh
// — di bawah ambang minimum — sehingga Step 1 hilang diam-diam di separuh tugas.
// Pool se-bab juga lebih tepat secara pedagogis: yang perlu dibedakan siswa
// adalah pola-pola yang baru dipelajari di bab itu.
export function deriveDrills(items, pool) {
  const siblings = (Array.isArray(pool) && pool.length) ? pool : items;
  const out = new Map();
  for (const item of items) {
    out.set(item.id, {
      step1: buildRecognitionDrill(item, siblings),
      step2: buildControlledDrill(item, siblings),
    });
  }
  return out;
}

// Bentuk yang boleh dikirim ke browser: TANPA correctIndex. Penilaian dilakukan
// server dengan menurunkan ulang soalnya, jadi kunci jawaban tidak pernah
// meninggalkan server dan tidak bisa dibaca dari DOM.
export function publicDrill(drill) {
  if (!drill) return null;
  const { correctIndex, ...rest } = drill;
  return rest;
}
