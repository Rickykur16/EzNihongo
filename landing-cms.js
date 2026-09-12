(() => {
  'use strict';
  function courseView(course) {
    const pricePublished = course.landing_price_published === true;
    let price = '';
    if (pricePublished) {
      if (course.is_free === true) price = 'Gratis';
      else if (typeof course.price_label === 'string' && course.price_label.trim()) price = course.price_label.trim();
      else if (Number.isFinite(Number(course.price_idr)) && Number(course.price_idr) > 0) price = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(course.price_idr));
    }
    return {
      price, period: price && course.is_free !== true ? String(course.period_label || '') : '',
      available: course.is_available !== false,
      canOpenDetails: Boolean(price && course.is_available !== false && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(course.slug || '')),
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { courseView };
  if (typeof document === 'undefined') return;
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = String(text); return node; };
  function plain(value) {
    const doc = new DOMParser().parseFromString(String(value || ''), 'text/html');
    doc.querySelectorAll('script,style,iframe,object').forEach(node => node.remove());
    return doc.body.textContent || '';
  }
  function safeImage(value) {
    if (!value || typeof value !== 'string') return '';
    try { const url = new URL(value, location.origin); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
  }
  function photo(value, name, position) {
    const src = safeImage(value); if (!src) return null;
    const img = el('img', 'cms-photo'); img.src = src; img.alt = name; img.loading = 'lazy'; img.width = 480; img.height = 360;
    if (/^\d+(?:\.\d+)?% \d+(?:\.\d+)?%$/.test(position || '')) img.style.objectPosition = position;
    img.addEventListener('error', () => img.remove(), { once: true });
    return img;
  }
  function ordered(items) {
    return items.filter(item => item && typeof item === 'object' && item.is_published !== false).sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
  }
  function consultButton(label) {
    const button = el('button', 'button small', label || 'Tanya tentang kelas'); button.type = 'button';
    button.addEventListener('click', () => document.dispatchEvent(new CustomEvent('landing:consult', { detail: { opener: button } })));
    return button;
  }
  function renderCourses(items) {
    const list = document.querySelector('#course-list'), status = document.querySelector('#course-status');
    list.replaceChildren(); let hasPublishedPrice = false;
    const courses = ordered(items);
    courses.forEach(course => {
      const view = courseView(course), card = el('article', 'cms-card cms-course');
      card.dataset.courseSlug = String(course.slug || '');
      const image = photo(course.thumbnail_url, String(course.title || 'Kelas bootcamp')); if (image) card.append(image);
      const content = el('div', 'cms-card-content'), badges = el('div', 'cms-badges');
      if (course.level) badges.append(el('span', 'tag', course.level));
      if (course.is_featured === true) badges.append(el('span', 'cms-featured', 'Pilihan utama'));
      if (!view.available) badges.append(el('span', 'cms-availability', 'Segera hadir'));
      content.append(badges, el('h4', '', course.title || 'Kelas bootcamp'));
      if (course.tagline || course.description) content.append(el('p', '', plain(course.tagline || course.description)));
      if (Array.isArray(course.features) && course.features.length) { const ul = el('ul'); course.features.filter(f => typeof f === 'string').forEach(f => ul.append(el('li', '', plain(f)))); content.append(ul); }
      const schedule = typeof course.landing_schedule === 'string' ? course.landing_schedule.trim() : '';
      content.append(el('p', 'cms-schedule', schedule || 'Hari dan jam kelas akan diumumkan.'));
      content.append(el('p', 'cms-price', view.price ? [view.price, view.period].filter(Boolean).join(' ') : 'Harga belum ditentukan'));
      if (view.price) hasPublishedPrice = true;
      if (view.canOpenDetails) { const a = el('a', 'button small', course.cta_label || 'Lihat rincian kelas'); a.href = 'login.html?next=' + encodeURIComponent('courses/detail.html?slug=' + encodeURIComponent(course.slug)); content.append(a); }
      else if (view.available) content.append(consultButton(course.cta_label || 'Tanya tentang kelas'));
      else content.append(el('p', 'fine', 'Pendaftaran kelas ini belum dibuka.'));
      card.append(content); list.append(card);
    });
    status.textContent = courses.length ? 'Pilih kelas sesuai titik awal dan tujuan belajarmu.' : 'Informasi kelas sedang disiapkan. Hubungi tim untuk membahas rencanamu.';
    document.querySelector('#price-summary').textContent = hasPublishedPrice ? 'Lihat rincian harga pada kelas yang tersedia.' : 'Harga bootcamp belum ditentukan.';
    document.querySelector('#price-faq').textContent = hasPublishedPrice ? 'Harga mengikuti kelas yang dipilih.' : 'Harga bootcamp belum ditentukan.';
  }
  function renderPeople(items, kind) {
    const isSensei = kind === 'sensei', section = document.querySelector(isSensei ? '#sensei' : '#testimoni'), list = document.querySelector(isSensei ? '#sensei-list' : '#testimonial-list');
    const entries = ordered(items).filter(item => item.name && (isSensei || item.quote)); list.replaceChildren();
    entries.forEach(item => {
      const card = el('article', 'cms-card'), image = photo(item.photo_url, String(item.name), item.photo_position); if (image) card.append(image);
      const content = el('div', 'cms-card-content');
      if (!isSensei) content.append(el('blockquote', '', plain(item.quote)));
      content.append(el('h3', '', item.name));
      if (isSensei) { if (item.title) content.append(el('p', 'cms-role', item.title)); if (item.bio) content.append(el('p', '', plain(item.bio))); if (Array.isArray(item.tags)) { const tags = el('div', 'cms-badges'); item.tags.forEach(t => tags.append(el('span', 'tag', t))); content.append(tags); } }
      else content.append(el('p', 'cms-role', [item.occupation, item.location].filter(Boolean).join(' · ')));
      card.append(content); list.append(card);
    });
    section.hidden = entries.length === 0;
  }
  async function load(path, key, render) {
    try { const response = await fetch(path, { cache: 'no-store', signal: AbortSignal.timeout(8000) }); if (!response.ok) throw Error('unavailable'); const data = await response.json(); if (!Array.isArray(data[key])) throw Error('invalid'); render(data[key]); }
    catch { if (key === 'courses') document.querySelector('#course-status').textContent = 'Informasi kelas belum dapat dimuat. Silakan muat ulang atau hubungi tim EzNihongo.'; }
  }
  Promise.allSettled([
    load('/api/courses', 'courses', renderCourses),
    load('/api/sensei', 'sensei', rows => renderPeople(rows, 'sensei')),
    load('/api/testimonials', 'testimonials', rows => renderPeople(rows, 'testimonials')),
  ]);
  // Preserve the existing landing-to-dashboard flow using server-confirmed access.
  (async () => {
    try { if (typeof ezGetMe !== 'function' || typeof ezApi !== 'function') return; const user = await ezGetMe(); if (!user) return; const response = await ezApi('/enrollments/me'); if (!response.ok) return; const data = await response.json(); const slugs = (data.enrollments || []).map(e => e.slug).filter(Boolean); if (slugs.length) { localStorage.setItem('ez_courses', JSON.stringify(slugs)); location.replace('dashboard.html?v=20260912-1'); } } catch { /* Guests remain on the public landing page. */ }
  })();
})();
