(async () => {
  const status = document.getElementById('status');
  const slug = new URL(location.href).searchParams.get('course') || 'n5';
  try {
    const user = await window.ezGetMe();
    if (!user?.isAdmin) throw new Error('Laporan ini tersedia di akun admin. Masuk melalui Ruang Kerja terlebih dahulu.');
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) throw new Error('Kursus tidak valid.');
    status.textContent = 'Memuat materi kursus…';
    // Reuse the existing authenticated course response, with its entitlement
    // checks and student-safe field selection. No new export API or credentials.
    const response = await window.ezApi(`/courses/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Materi belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.');
    const { course } = await response.json();
    if (!Array.isArray(course?.modules)) throw new Error('Data kursus tidak lengkap.');
    const snapshot = { schemaVersion: 1, capturedAt: new Date().toISOString(), course };
    const serialized = JSON.stringify(snapshot, null, 2);
    const table = document.createElement('table');
    const header = table.createTHead().insertRow();
    for (const label of ['Bab', 'Kosakata', 'Contoh kosakata', 'Kanji', 'Bunpou']) {
      const th = document.createElement('th'); th.textContent = label; header.append(th);
    }
    const body = table.createTBody();
    for (const module of course.modules) {
      const deck = module.lessons.flatMap(lesson => lesson.deck || []);
      const kanji = module.lessons.flatMap(lesson => lesson.kanji || []);
      const teaching = module.lessons.filter(lesson => ['text', 'video'].includes(lesson.type)).flatMap(lesson => lesson.grammar || []);
      const row = body.insertRow();
      for (const value of [module.title, deck.length, deck.reduce((n, word) => n + (word.examples?.length || 0), 0), kanji.length, teaching.length]) row.insertCell().textContent = value;
    }
    document.getElementById('summary').append(table);
    status.textContent = `${course.title} · ${course.modules.length} bab · salinan ${new Date(snapshot.capturedAt).toLocaleString('id-ID')}`;
    document.getElementById('actions').hidden = false;
    document.getElementById('show').addEventListener('click', event => {
      const report = document.getElementById('report');
      report.hidden = !report.hidden;
      // Keep the browser responsive for a complete course; the download retains
      // the full report. A multi-megabyte text node can stall accessibility tools.
      const preview = serialized.length > 60000
        ? `${serialized.slice(0, 60000)}\n\nPratinjau dibatasi. Gunakan Unduh salinan JSON untuk data lengkap.`
        : serialized;
      report.textContent = report.hidden ? '' : preview;
      event.currentTarget.setAttribute('aria-expanded', String(!report.hidden));
      event.currentTarget.textContent = report.hidden ? 'Tampilkan data materi' : 'Sembunyikan data materi';
    });
    document.getElementById('download').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `${slug}-materi-${snapshot.capturedAt.slice(0, 10)}.json`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  } catch (error) { status.textContent = error.message || 'Laporan belum dapat dimuat.'; }
})();
