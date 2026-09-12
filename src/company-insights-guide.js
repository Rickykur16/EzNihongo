// Research-backed decision guide, not synthetic dashboard measurements.
export const INSIGHT_SOURCES = Object.freeze({
  heart: { label: 'Google Research · HEART', url: 'https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/' },
  learning: { label: 'IES / What Works Clearinghouse', url: 'https://ies.ed.gov/ncee/wwc/PracticeGuide/1' },
  quality: { label: 'Microsoft Research · trustworthy metrics', url: 'https://www.microsoft.com/en-us/research/articles/patterns-of-trustworthy-experimentation-during-experiment-stage/' },
  reliability: { label: 'Google SRE · monitoring', url: 'https://sre.google/sre-book/monitoring-distributed-systems/' },
  delivery: { label: 'DORA · software delivery metrics', url: 'https://dora.dev/guides/dora-metrics/' },
});

export const INSIGHT_REQUIREMENTS = Object.freeze([
  { key:'learning', title:'Apakah siswa benar-benar belajar?', owner:'Academic + Product', source:'learning',
    available:'Kesulitan kuis per pelajaran dan completion pelajaran aktif tersedia dengan batas sampel.',
    needed:'Retensi pengetahuan setelah jeda, kesalahan per kompetensi, pre/post assessment sebanding. Perlu concept ID, versi materi/soal dan konteks review yang konsisten.',
    decision:'Tentukan materi atau latihan yang perlu diperbaiki. XP dan nilai sekali mencoba bukan bukti penguasaan jangka panjang.' },
  { key:'journey', title:'Di mana perjalanan belajar terhambat?', owner:'Product + Operations', source:'heart',
    available:'Aktivasi berbasis enrollment dan kembali belajar antarminggu tersedia; bukan funnel lengkap.',
    needed:'Keberhasilan mulai/submit belajar, penggunaan fitur, titik keluar, feedback kemudahan dan kepuasan. Perlu event start/success/failure, exposure fitur dan survei sukarela.',
    decision:'Prioritaskan onboarding, navigasi atau bantuan. Klik tinggi dan waktu lama bisa berarti kebingungan, bukan keberhasilan.' },
  { key:'quality', title:'Seberapa dapat dipercaya angkanya?', owner:'Product & Technology', source:'quality',
    available:'Periode, snapshot, definisi, sampel dan rasio keterhubungan latihan bertag course tersedia. Ini bukan total cakupan tracking.',
    needed:'Cakupan sumber lain, event hilang/duplikat, keterlambatan, versi metrik dan kualitas assignment eksperimen. Perlu event ID, waktu kejadian/diterima dan validasi schema.',
    decision:'Perbaiki pencatatan sebelum menafsirkan tren. Tidak tersedia dan sampel kecil tidak dilaporkan sebagai nol.' },
  { key:'reliability', title:'Apakah produk tetap andal setelah perubahan?', owner:'Product & Technology', source:'reliability',
    available:'Belum terhubung ke Insights; health check rilis bukan histori keandalan.',
    needed:'Latensi p95/p99, request gagal, traffic, kapasitas DB/VPS dan keberhasilan alur belajar/simpan progres. Perlu agregat monitoring yang tidak membawa token, jawaban atau identitas siswa.',
    decision:'Utamakan regresi yang menghambat siswa. Tetapkan batas layanan setelah baseline, bukan menebak target universal.' },
  { key:'delivery', title:'Apakah pengembangan cepat sekaligus aman?', owner:'Product & Technology', source:'delivery',
    available:'Board rilis ada, tetapi status manual belum cukup untuk metrik delivery yang terverifikasi.',
    needed:'Lead time perubahan, frekuensi deploy, waktu pemulihan deploy gagal, change fail rate dan deployment rework rate. Perlu commit/deploy/incident ID dan waktu terverifikasi.',
    decision:'Cari hambatan delivery pada tingkat layanan/tim; bukan ranking pegawai dari jumlah commit.' },
  { key:'impact', title:'Apakah perbaikan menghasilkan dampak yang benar?', owner:'Pemilik + Product + Growth + Finance', source:'quality',
    available:'Belum ada eksperimen terkontrol, atribusi kampanye atau pendapatan terukur di Insights.',
    needed:'Hipotesis, metrik hasil utama, guardrail, cakupan/sampel, bukti rilis; untuk dampak bisnis tambahkan pembayaran terverifikasi, biaya layanan dan atribusi yang sah.',
    decision:'Catat keputusan lanjut/revisi/hentikan. Perubahan sebelum–sesudah bukan bukti sebab-akibat; jangan meluncurkan A/B test tanpa rencana sampel dan pemeriksaan data.' },
]);

export function renderInsightsGuide() {
  // All strings are code-owned; no user-generated HTML or remote fetch here.
  return `<section class="insight-notes" id="insights-guide"><h2>Informasi untuk keputusan pengembangan</h2><p>Prioritas EzNihongo diadaptasi dari sumber primer berikut, bukan daftar KPI universal. Bagian “perlu data” adalah kebutuhan pengembangan, bukan angka yang sudah diukur.</p>${INSIGHT_REQUIREMENTS.map(r => `<details><summary>${r.title}</summary><p><strong>Pemilik:</strong> ${r.owner}</p><p><strong>Saat ini:</strong> ${r.available}</p><p><strong>Perlu data:</strong> ${r.needed}</p><p><strong>Keputusan:</strong> ${r.decision}</p><p><a href="${INSIGHT_SOURCES[r.source].url}" target="_blank" rel="noopener noreferrer">${INSIGHT_SOURCES[r.source].label}</a></p></details>`).join('')}<p class="hint">Setiap usulan: masalah → bukti + keterbatasan → hipotesis → pemilik tugas → metrik hasil + batas yang tidak boleh memburuk → evaluasi. Tidak membuat perubahan atau eksperimen otomatis.</p></section>`;
}
