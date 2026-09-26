import { independentEvidenceSql } from './maneko-assistance.js';
// Paket 3 — pemuat MODE SHADOW. Sengaja TERPISAH dari grammar-mastery.js.
//
// grammar-mastery.js adalah pembaca AKTIF: dipakai dashboard siswa,
// halaman progres, Smart Review (penjadwalan!), rekomendasi coaching, dan
// analisis grammar siswa — lima jalur yang semuanya terlihat siswa. File ini
// tidak menyentuh satu pun dari itu. Ia menjalankan query-nya SENDIRI dengan
// kolom metadata tambahan, lalu menghitung kebijakan usulan di sampingnya.
//
// Kenapa bukan sekadar memperluas SELECT di loadMastery: menambah kolom ke
// query yang dipakai lima jalur siswa demi satu layar admin adalah risiko
// yang tidak perlu diambil untuk pekerjaan yang, menurut rencananya sendiri,
// tidak boleh mengubah apa pun yang dilihat siswa.
import { query } from './db.js';
import {
  computeConceptMastery, WINDOW_DAYS, MAX_ATTEMPTS,
} from './grammar-mastery.js';
import {
  computeConceptMasteryV2, compareMastery, hasEvidenceMetadata, V2_CONFIG,
} from './grammar-mastery-policy.js';

// Query ini MENCERMINKAN loadMastery (window, limit, UNION dengan
// quiz_question_results, urutan terbaru-dulu) supaya v1 yang dihitung di sini
// identik dengan v1 yang dilihat siswa — kalau berbeda, seluruh perbandingan
// shadow-nya tidak ada artinya. Yang ditambahkan cuma kolom metadata, dan
// sisi quiz_question_results mengisinya NULL karena tabel itu memang tidak
// punya (percobaan kuis tidak pernah melewati sesi pilot).
async function loadAttemptRows(userId, ids) {
  const r = await query(
    `WITH unioned AS (
       SELECT grammar_id, passed, created_at, source, primary_error, eval_source,
              assistance_state, independent_eligible, question_fingerprint,
              evaluation_kind, check_family_id
         FROM grammar_attempts ga
        WHERE ${independentEvidenceSql({ item: 'ga.grammar_id' }, 'ga')} AND user_id = $1 AND grammar_id = ANY($2::uuid[])
          AND created_at > NOW() - make_interval(days => $3::int)
       UNION ALL
       SELECT grammar_id, is_correct AS passed, created_at,
              'recognition'::text AS source, NULL::text AS primary_error,
              NULL::text AS eval_source,
              NULL::text AS assistance_state, NULL::boolean AS independent_eligible,
              NULL::text AS question_fingerprint, NULL::text AS evaluation_kind,
              NULL::text AS check_family_id
         FROM quiz_question_results qr
        WHERE ${independentEvidenceSql({ item: 'qr.grammar_id' }, 'qr')} AND user_id = $1 AND grammar_id = ANY($2::uuid[])
          AND created_at > NOW() - make_interval(days => $3::int)
     ), ranked AS (
       SELECT *, ROW_NUMBER() OVER (PARTITION BY grammar_id ORDER BY created_at DESC) AS rn
         FROM unioned
     )
     SELECT * FROM ranked WHERE rn <= $4 ORDER BY grammar_id, created_at DESC`,
    [userId, ids, WINDOW_DAYS, MAX_ATTEMPTS]
  );
  const byGrammar = new Map();
  for (const row of r.rows) {
    if (!byGrammar.has(row.grammar_id)) byGrammar.set(row.grammar_id, []);
    byGrammar.get(row.grammar_id).push(row);
  }
  return byGrammar;
}

// Perbandingan v1 vs v2 untuk satu siswa atas sekumpulan konsep.
// TIDAK menulis apa pun. TIDAK dipanggil jalur siswa mana pun.
export async function loadMasteryShadow(userId, grammarIds, config = V2_CONFIG) {
  const ids = [...new Set((grammarIds || []).filter(Boolean))];
  const out = { concepts: [], coverage: { attempts: 0, withMetadata: 0 } };
  if (ids.length === 0) return out;

  const byGrammar = await loadAttemptRows(userId, ids);
  const now = Date.now();

  for (const id of ids) {
    const rows = byGrammar.get(id) || [];
    if (rows.length === 0) continue;

    out.coverage.attempts += rows.length;
    out.coverage.withMetadata += rows.filter(hasEvidenceMetadata).length;

    const v1 = computeConceptMastery(rows, now);
    const v2 = computeConceptMasteryV2(rows, now, config);
    out.concepts.push({
      grammarId: id,
      v1: { state: v1.state, score: v1.score, attempts: v1.attempts, passedCount: v1.passedCount },
      v2: { state: v2.state, evidenceQuality: v2.evidenceQuality, evidence: v2.evidence },
      diff: compareMastery(v1, v2),
    });
  }
  return out;
}

// Ringkasan untuk layar tinjauan: berapa yang berubah, kenapa, dan — yang
// paling menentukan cara membaca angka ini — berapa persen percobaan yang
// benar-benar punya metadata bukti.
//
// Tanpa angka cakupan itu, "80% konsep turun dari MASTERED" terbaca seolah
// siswa memburuk, padahal yang sebenarnya terjadi adalah riwayat lama tidak
// pernah mencatat apakah jawabannya dibantu atau soalnya diulang. Rencana
// menyebut data seperti itu "evidence terbatas" — bukan kegagalan.
export function summarizeShadow(shadow) {
  const concepts = shadow?.concepts || [];
  const changed = concepts.filter((c) => c.diff.changed);
  const byFlag = {};
  for (const c of concepts) for (const f of c.diff.flags) byFlag[f] = (byFlag[f] || 0) + 1;

  const cov = shadow?.coverage || { attempts: 0, withMetadata: 0 };
  return {
    concepts: concepts.length,
    changed: changed.length,
    unchanged: concepts.length - changed.length,
    byFlag,
    metadataCoverage: {
      attempts: cov.attempts,
      withMetadata: cov.withMetadata,
      pct: cov.attempts ? Math.round((cov.withMetadata / cov.attempts) * 100) : null,
    },
    limitedHistoryConcepts: concepts.filter((c) => c.v2.evidenceQuality === 'limited').length,
  };
}
