import { renderInsightsGuide } from './company-insights-guide.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const metricCopy = {
  activation: ['Aktivasi ≤7 hari', 'Enrollment pada minggu sebelumnya dengan bukti latihan/kuis dalam 7 hari sejak enrollment. Bukan rasio pendaftar atau pembeli.'],
  completion: ['Pelajaran aktif yang kini selesai', 'Pasangan siswa–pelajaran yang aktif pada minggu laporan, dan sekarang bertanda selesai di progres server. Bukan completion seluruh kurikulum atau dropout.'],
  retention: ['Kembali belajar minggu berikutnya', 'Siswa dengan bukti belajar pada minggu sebelumnya yang juga aktif pada minggu laporan. Bukan retensi langganan atau D7 sejak pendaftaran.'],
  dataQuality: ['Latihan terhubung ke pelajaran', 'Record latihan bertag kursus ini pada minggu laporan yang memiliki rujukan pelajaran valid di kursus yang sama. Bukan persentase seluruh aktivitas yang berhasil direkam.'],
};
const messages = {
  insights_busy_retry_later: 'Perhitungan lain sedang berjalan. Coba lagi sebentar; pembelajaran tetap tersedia.',
  insights_unavailable: 'Ringkasan belum tersedia. Pengelola perlu memeriksa schema dan kapasitas; data tidak dianggap nol.',
  insights_scope_required: 'Akses laporan berubah atau kursus di luar izin Anda.',
  company_insights_disabled: 'Insights belum diaktifkan oleh pengelola.',
  insights_rate_limit: 'Tunggu satu menit sebelum mencoba lagi.',
};

export function createInsightsView({ root=document, api, access, courses, onOpen }) {
  const panel = root.querySelector('#insights-panel'), button = root.querySelector('#insights-button');
  let generation = 0;
  const scopes = access.insights?.enabled ? access.insights.scopes : {};
  const divisions = access.divisions.filter(d => Object.hasOwn(scopes, d.id));
  button.hidden = !divisions.length;
  if (!divisions.length) return { close() {} };
  panel.innerHTML = `<form id="insights-filters" class="fields"><label>Sudut pandang divisi<select name="division"></select></label><label>Kursus<select name="courseId"></select></label><button type="submit">Muat ringkasan</button></form>
    <p class="hint">Hanya ringkasan course utama, tanpa identitas atau jawaban siswa. Angka kecil disembunyikan; belum tersedia bukan berarti nol. Tidak menggabungkan akun Kanji PWA.</p>
    <p id="insights-status" role="status" aria-live="polite"></p><div id="insights-report"></div>${renderInsightsGuide()}`;
  const form = panel.querySelector('form'), status = panel.querySelector('#insights-status'), report = panel.querySelector('#insights-report');
  form.elements.division.innerHTML = divisions.map(d => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('');
  const submit = form.querySelector('button');
  function clear() { generation++; report.innerHTML = ''; status.textContent = ''; submit.disabled = !form.elements.courseId.value; }
  function chooseCourses() {
    const scope = scopes[form.elements.division.value];
    const allowed = courses.filter(c => scope === 'global' || scope.includes(c.id));
    form.elements.courseId.innerHTML = allowed.map(c => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('');
    clear(); if (!allowed.length) status.textContent = 'Belum ada kursus dalam izin Insights Anda.';
  }
  form.elements.division.onchange = chooseCourses; form.elements.courseId.onchange = clear; chooseCourses();
  form.onsubmit = async event => {
    event.preventDefault(); const ticket = ++generation;
    submit.disabled = true; report.innerHTML = ''; status.textContent = 'Menghitung ringkasan…';
    try {
      const data = await api('/insights?' + new URLSearchParams({ division: form.elements.division.value, courseId: form.elements.courseId.value }));
      if (ticket !== generation || panel.hidden) return;
      const day = value => new Date(value).toLocaleDateString('id-ID', { timeZone: 'UTC', dateStyle: 'medium' });
      status.textContent = `Minggu UTC ${day(data.window.start)} sampai sebelum ${day(data.window.end)}. Snapshot ${new Date(data.generatedAt).toLocaleString('id-ID')}${data.cached ? ' · ringkasan tersimpan sementara' : ''}.`;
      report.innerHTML = `<div class="insight-cards">${Object.entries(metricCopy).map(([key, [title, definition]]) => {
        const m = data[key], available = m.status === 'available';
        return `<article class="insight-card" data-metric="${key}"><h2>${title}</h2><p class="insight-value">${available ? esc(m.percent) + '%' : '—'}</p><p>${available ? `${esc(m.numerator)} / ${esc(m.denominator)} ${key === 'completion' ? 'pasangan siswa–pelajaran' : key === 'dataQuality' ? 'record latihan' : 'siswa'}` : 'Bukti belum cukup untuk ditampilkan dengan aman.'}</p><p class="hint">${definition}</p></article>`;
      }).join('')}</div><section class="insight-notes"><h2>Batas pembacaan data</h2><p>Minimal ${esc(data.minLearners)} siswa per kelompok; kelompok hasil kecil juga disembunyikan. Ini mengurangi paparan, bukan jaminan anonimisasi. Bukti berasal dari kuis yang disubmit, latihan, dan grammar dengan rujukan pelajaran yang valid.</p><p>Login, page view, XP, state FSRS, dan waktu sinkronisasi progres bukan bukti aktivitas di laporan ini. Aktivitas offline yang belum tersinkron, latihan tanpa rujukan pelajaran, serta histori sebelum pencatatan belum tercakup. Completion adalah status saat snapshot, bukan status historis di akhir minggu.</p><p>Belum ada atribusi kampanye, pendapatan, daftar siswa berisiko, notifikasi otomatis, atau klaim sebab-akibat. Ringkasan dihitung saat diminta dan dipakai ulang maksimal 5 menit; bukan job terjadwal.</p></section>`;
      if (data.detailAccess) report.insertAdjacentHTML('beforeend', `<section class="insight-notes"><h2>Materi untuk ditinjau</h2><p>Hingga 20 pelajaran berdasarkan persentase salah. Jawaban pertama per siswa–soal dalam minggu laporan, lalu rata-rata per siswa agar pengulangan tidak mendominasi. Sering salah tidak otomatis berarti materi buruk.</p>${data.difficulties.length ? `<div class="table-wrap"><table><thead><tr><th>Pelajaran</th><th>Siswa</th><th>Rata-rata salah</th></tr></thead><tbody>${data.difficulties.map(d => `<tr><td>${esc(d.title)}</td><td>${esc(d.learners)}</td><td>${esc(d.incorrectPercent)}%</td></tr>`).join('')}</tbody></table></div>` : '<p>Belum ada kelompok pelajaran dengan sampel yang cukup untuk ditampilkan.</p>'}<p class="hint">Tindak lanjut: Academic memeriksa soal/penjelasan; Product memeriksa hambatan teknis. Buat pekerjaan review di board setelah memeriksa konteks. Tidak ada tugas atau perubahan materi otomatis.</p></section>`);
    } catch (error) {
      if (ticket === generation) { report.innerHTML = ''; status.textContent = messages[error.message] || 'Ringkasan gagal dimuat. Coba lagi atau hubungi pengelola.'; }
    } finally { if (ticket === generation) submit.disabled = false; }
  };
  button.onclick = () => { onOpen(); panel.hidden = false; button.setAttribute('aria-current', 'true'); };
  return { close() { clear(); panel.hidden = true; button.removeAttribute('aria-current'); } };
}
