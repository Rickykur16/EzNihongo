// Ruang Kerja → Marketing → Kunjungan Website. Membaca GET /api/admin/site-analytics
// (hitungan agregat saja, lihat backend/src/routes/site-events.js).
(function (global) {
  'use strict';
  const RANGES = [7, 30, 90];
  const PAGE_LABELS = { home: 'Beranda', course: 'Detail kelas', login: 'Masuk', privacy: 'Kebijakan Privasi', terms: 'Syarat & Ketentuan' };
  const DEVICE_LABELS = { mobile: 'HP', tablet: 'Tablet', desktop: 'Desktop' };
  const PATH_LABELS = { '': 'Tanpa jalur', 'belum-tahu': 'Belum tahu', ssw: 'Tokutei Ginou / SSW', gijinkoku: 'Gijinkoku', ginou: 'Ginou', ryugaku: 'Ryugaku', bahasa: 'Kelas bahasa' };
  const SOURCE_LABELS = { langsung: 'Langsung / tidak diketahui', google: 'Google', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', x: 'X / Twitter', bing: 'Bing' };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Number(n || 0).toLocaleString('id-ID');
  const pct = (a, b) => b > 0 ? (Math.round((a / b) * 1000) / 10).toLocaleString('id-ID') + '%' : '–';
  const shortDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }); };

  const STYLE = `
  .sv{max-width:980px}.sv h2{margin:0 0 4px}.sv-sub{color:var(--ink-500);font-size:13px;margin:0 0 14px}
  .sv-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px}
  .sv-range button[aria-pressed="true"]{background:var(--brand-red);color:#fff;border-color:var(--brand-red)}
  .sv-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px}
  .sv-tile{border:1px solid var(--paper-300);border-radius:8px;padding:12px;background:#fff}
  .sv-tile b{display:block;font-size:24px;line-height:1.2;color:var(--ink-900,#111)}.sv-tile span{font-size:12px;color:var(--ink-500)}
  .sv-card{border:1px solid var(--paper-300);border-radius:8px;padding:14px;background:#fff;margin-bottom:14px;min-width:0}
  .sv-card h3{margin:0 0 10px;font-size:15px}.sv-note{font-size:12px;color:var(--ink-500);margin:8px 0 0}
  .sv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-bottom:14px}.sv-grid .sv-card{margin-bottom:0}
  .sv-funnel{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .sv-step{background:#f9fafb;border-radius:8px;padding:10px}.sv-step b{font-size:20px;display:block}.sv-step span{font-size:12px;color:var(--ink-500)}
  .sv-chart{position:relative;display:flex;align-items:flex-end;gap:2px;height:140px;border-bottom:1px solid var(--paper-300);padding-top:8px}
  .sv-col{flex:1;min-width:0;height:100%;display:flex;align-items:flex-end;cursor:default;outline:none}
  .sv-col i{display:block;width:100%;background:var(--brand-red);border-radius:4px 4px 0 0;min-height:0}
  .sv-col:hover i,.sv-col:focus i{opacity:.75}.sv-col:focus-visible{box-shadow:var(--focus-ring)}
  .sv-axis{display:flex;justify-content:space-between;font-size:11px;color:var(--ink-500);margin-top:4px}
  .sv-tip{position:absolute;pointer-events:none;background:#111;color:#fff;font-size:12px;padding:6px 8px;border-radius:6px;white-space:nowrap;transform:translate(-50%,-100%);top:0}
  .sv-table{width:100%;border-collapse:collapse;font-size:13px}.sv-table th,.sv-table td{padding:6px 4px;border-bottom:1px solid var(--paper-300);text-align:left}
  .sv-table td.n,.sv-table th.n{text-align:right;font-variant-numeric:tabular-nums}
  .sv-meter{height:6px;background:#f1f1f1;border-radius:3px;margin-top:3px}.sv-meter i{display:block;height:100%;background:var(--ink-500);border-radius:3px}
  .sv code{font-size:12px;background:#f3f4f6;padding:2px 4px;border-radius:4px;word-break:break-all}
  @media (max-width:560px){.sv-funnel{grid-template-columns:1fr}}`;

  function table(rows, cols) {
    if (!rows.length) return '<p class="sv-note">Belum ada data di rentang ini.</p>';
    const max = Math.max(...rows.map(r => r[cols[1].key] || 0), 1);
    return `<table class="sv-table"><thead><tr>${cols.map((c, i) => `<th${i ? ' class="n"' : ''}>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map((c, i) => i
      ? `<td class="n">${num(r[c.key])}</td>`
      : `<td>${esc(c.format ? c.format(r[c.key]) : r[c.key])}${i === 0 ? `<div class="sv-meter" aria-hidden="true"><i style="width:${Math.round(((r[cols[1].key] || 0) / max) * 100)}%"></i></div>` : ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function chart(daily) {
    const max = Math.max(...daily.map(d => d.visitors), 1);
    const cols = daily.map((d, i) => `<div class="sv-col" tabindex="0" data-i="${i}" aria-label="${esc(shortDate(d.date))}: ${num(d.visitors)} pengunjung, ${num(d.waClicks)} klik WhatsApp"><i style="height:${(d.visitors / max) * 100}%"></i></div>`).join('');
    return `<div class="sv-chart" role="img" aria-label="Pengunjung per hari">${cols}</div>
      <div class="sv-axis"><span>${esc(shortDate(daily[0].date))}</span><span>Puncak ${num(max)} / hari</span><span>${esc(shortDate(daily[daily.length - 1].date))}</span></div>
      <details class="sv-note"><summary>Lihat sebagai tabel</summary>${table([...daily].reverse(), [
        { key: 'date', label: 'Tanggal', format: shortDate }, { key: 'visitors', label: 'Pengunjung' },
        { key: 'pageviews', label: 'Tampilan' }, { key: 'waClicks', label: 'Klik WA' }])}</details>`;
  }

  function wireTooltip(root, daily) {
    const box = root.querySelector('.sv-chart');
    if (!box) return;
    const tip = document.createElement('div'); tip.className = 'sv-tip'; tip.hidden = true; box.appendChild(tip);
    const show = col => {
      const d = daily[Number(col.dataset.i)];
      tip.textContent = `${shortDate(d.date)} · ${num(d.visitors)} pengunjung · ${num(d.waClicks)} klik WA`;
      tip.hidden = false;
      const left = col.offsetLeft + col.offsetWidth / 2;
      tip.style.left = Math.min(Math.max(left, 90), box.clientWidth - 90) + 'px';
    };
    box.querySelectorAll('.sv-col').forEach(col => {
      col.addEventListener('mouseenter', () => show(col)); col.addEventListener('focus', () => show(col));
      col.addEventListener('mouseleave', () => { tip.hidden = true; }); col.addEventListener('blur', () => { tip.hidden = true; });
    });
  }

  function render(data) {
    const t = data.totals, f = data.funnel;
    if (!t.pageviews) {
      return `<div class="sv-card"><h3>Belum ada kunjungan tercatat</h3><p class="sv-note">Pencatatan dimulai sejak fitur ini aktif, jadi kunjungan sebelumnya tidak ada. Kunjungan dari browser ini juga tidak dihitung karena dipakai membuka Ruang Kerja.</p></div>`;
    }
    return `
      <div class="sv-tiles">
        <div class="sv-tile"><b>${num(t.visitors)}</b><span>Pengunjung</span></div>
        <div class="sv-tile"><b>${num(t.pageviews)}</b><span>Tampilan halaman</span></div>
        <div class="sv-tile"><b>${num(t.waClicks)}</b><span>Klik WhatsApp</span></div>
        <div class="sv-tile"><b>${num(t.signups)}</b><span>Akun baru</span></div>
        <div class="sv-tile"><b>${num(t.paidOrders)}</b><span>Pesanan lunas</span></div>
      </div>
      <section class="sv-card"><h3>Dari beranda ke WhatsApp</h3>
        <div class="sv-funnel">
          <div class="sv-step"><b>${num(f.homeVisitors)}</b><span>Membuka beranda</span></div>
          <div class="sv-step"><b>${num(f.consultVisitors)}</b><span>Membuka pilihan konsultasi · ${pct(f.consultVisitors, f.homeVisitors)}</span></div>
          <div class="sv-step"><b>${num(f.waVisitors)}</b><span>Lanjut ke WhatsApp · ${pct(f.waVisitors, f.homeVisitors)}</span></div>
        </div>
        <p class="sv-note">Persentase dihitung dari pengunjung beranda. Akun baru dan pesanan lunas di atas hanya jumlah pada periode yang sama, tidak tertaut ke pengunjung tertentu.</p>
      </section>
      <section class="sv-card"><h3>Pengunjung per hari</h3>${chart(data.daily)}</section>
      <div class="sv-grid">
        <section class="sv-card"><h3>Sumber kunjungan</h3>${table(data.sources, [{ key: 'source', label: 'Sumber', format: s => SOURCE_LABELS[s] || s }, { key: 'pageviews', label: 'Tampilan' }])}</section>
        <section class="sv-card"><h3>Halaman</h3>${table(data.pages, [{ key: 'page', label: 'Halaman', format: p => PAGE_LABELS[p] || p }, { key: 'pageviews', label: 'Tampilan' }])}</section>
        <section class="sv-card"><h3>Jalur konsultasi</h3>${table(data.consultPaths, [{ key: 'path', label: 'Jalur', format: p => PATH_LABELS[p] || p }, { key: 'waClicks', label: 'Klik WA' }, { key: 'opens', label: 'Dibuka' }])}</section>
        <section class="sv-card"><h3>Perangkat</h3>${table(data.devices, [{ key: 'device', label: 'Perangkat', format: d => DEVICE_LABELS[d] || d }, { key: 'pageviews', label: 'Tampilan' }])}</section>
        <section class="sv-card"><h3>Kelas yang dilihat</h3>${table(data.courses, [{ key: 'slug', label: 'Kelas (slug)' }, { key: 'pageviews', label: 'Tampilan' }])}</section>
        <section class="sv-card"><h3>Kampanye (UTM)</h3>${table(data.campaigns, [{ key: 'campaign', label: 'Kampanye' }, { key: 'pageviews', label: 'Tampilan' }])}</section>
      </div>`;
  }

  async function mount(pane, api, days = 30) {
    if (!pane) return;
    if (!document.getElementById('sv-style')) { const s = document.createElement('style'); s.id = 'sv-style'; s.textContent = STYLE; document.head.appendChild(s); }
    pane.innerHTML = `<div class="sv">
      <h2>Kunjungan Website</h2>
      <p class="sv-sub">Halaman publik eznihongo.com, zona waktu WIB. Dicatat tanpa cookie.</p>
      <div class="sv-bar"><div class="sv-range" role="group" aria-label="Rentang waktu">${RANGES.map(d => `<button type="button" class="btn btn-ghost" data-days="${d}" aria-pressed="${d === days}">${d} hari</button>`).join(' ')}</div>
        <button type="button" class="btn btn-ghost" data-refresh>↻ Muat ulang</button></div>
      <div data-body><p role="status">Memuat…</p></div>
      <details class="sv-card"><summary><strong>Cara membaca & memakai</strong></summary>
        <p class="sv-note"><b>Pengunjung</b> dihitung unik per hari lalu dijumlahkan: orang yang sama di dua hari terhitung dua. Bot, browser yang meminta tidak dilacak, dan browser yang pernah membuka Ruang Kerja (termasuk browser ini) tidak dihitung.</p>
        <p class="sv-note"><b>Sumber</b> diambil dari tag UTM kalau ada, kalau tidak dari situs perujuk. Banyak aplikasi (WhatsApp, Instagram) tidak mengirim perujuk sehingga terbaca "Langsung". Supaya kampanye terbaca, pakai tautan bertag, misalnya<br><code>https://eznihongo.com/?utm_source=instagram&amp;utm_medium=bio&amp;utm_campaign=ssw-oktober</code></p>
        <p class="sv-note">Data mentah disimpan 400 hari.</p>
      </details></div>`;
    const body = pane.querySelector('[data-body]');
    pane.querySelectorAll('[data-days]').forEach(b => { b.onclick = () => mount(pane, api, Number(b.dataset.days)); });
    pane.querySelector('[data-refresh]').onclick = () => mount(pane, api, days);
    try {
      const data = await api('/admin/site-analytics?days=' + days);
      if (!pane.isConnected) return;
      body.innerHTML = render(data);
      wireTooltip(body, data.daily);
    } catch (err) {
      body.innerHTML = `<p role="alert">Data kunjungan belum dapat dimuat (${esc(err?.message || 'galat')}).</p>`;
    }
  }

  global.EzSiteVisits = Object.freeze({ mount, render });
})(globalThis);
