import {rotationBanks} from './rotation.mjs';
import {JLPT_SCORING_VERSION,finalExamRules} from '../../src/final-exam-policy.js';
// Do not change the v1/v2 historical migration payloads or existing snapshots.
export const scoredBanks=rotationBanks.map(bank=>{
 const policy={...bank.policy,scoringVersion:JLPT_SCORING_VERSION};
 Object.assign(policy,finalExamRules(policy));
 return {...bank,policy,content:`Final Exam ${bank.level.toUpperCase()}: ${policy.questionsPerForm} soal orisinal, dua paket A/B bergantian. Penilaian mengikuti batas lulus JLPT: total minimal ${policy.passingScore}/180, gabungan kosakata/tata bahasa/membaca minimal 38/120, dan menyimak minimal 19/60. Semua batas harus terpenuhi. Skor adalah estimasi EzNihongo: proporsi jawaban benar pada masing-masing bagian dikalikan 120 atau 60, lalu dibulatkan ke bilangan bulat terdekat sebelum dijumlahkan. Ini bukan skor resmi JLPT yang menggunakan IRT. Tidak ada syarat 50% per kategori atau minimum tujuan terpisah. Tanpa timer otomatis; audio dapat diulang. Draft dan riwayat menggunakan aturan pada saat ujian dimulai.`};
});
