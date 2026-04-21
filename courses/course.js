// course.js — CMS-driven course detail / checkout page.
// Source of truth is the admin CMS (/api/courses/:slug). Admin membuat course → course ada.
// Handles: login guard, not-found, unavailable (preview mode), enrolled redirect, checkout submit.

function formatRupiah(n) {
  return "Rp " + Number(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function getSlugFromPage() {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get("slug");
  return fromQuery ? fromQuery.trim() : null;
}

function renderError(title, message, backHref) {
  const wrap = document.getElementById("c-wrap") || document.body;
  wrap.innerHTML = `
    <div style="max-width:520px;margin:80px auto;padding:40px 24px;text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">${backHref ? '🔒' : '❓'}</div>
      <h1 style="font-size:26px;margin:0 0 12px;color:#0a0a0a;">${title}</h1>
      <p style="color:#525252;line-height:1.6;margin:0 0 24px;">${message}</p>
      <a href="${backHref || '../index.html#pricing'}"
         style="display:inline-block;background:#C8102E;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;">
        ← Lihat kelas yang tersedia
      </a>
    </div>
  `;
}

async function ensureAuth(slug) {
  // If api-client is loaded, use cookie-based auth. Otherwise fall back to localStorage mirror.
  if (typeof window.ezGetMe === "function") {
    const user = await window.ezGetMe();
    if (user) return true;
  } else {
    const mirrored = localStorage.getItem("ez_user");
    if (mirrored) return true;
  }
  const here = `courses/detail.html?slug=${encodeURIComponent(slug)}`;
  window.location.replace(`../login.html?next=${encodeURIComponent(here)}`);
  return false;
}

async function fetchCourseBySlug(slug) {
  try {
    const res = await fetch(`/api/courses`, { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    const list = Array.isArray(data.courses) ? data.courses : [];
    return list.find(c => c.slug === slug) || null;
  } catch { return null; }
}

function renderUnavailable(course) {
  const wrap = document.getElementById("c-wrap") || document.body;
  const title = course.title || course.slug;
  const priceLabel = course.price_label
    || (course.price_idr ? formatRupiah(course.price_idr) : "Belum ditentukan");
  wrap.innerHTML = `
    <div style="max-width:560px;margin:64px auto;padding:40px 28px;text-align:center;background:#fff;border:1px solid #e8e0d2;border-radius:16px;box-shadow:0 1px 3px rgba(15,27,60,0.04);">
      <div style="display:inline-block;padding:6px 14px;background:#fff4e5;color:#b45309;border:1px solid #fde68a;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:20px;">
        Segera Hadir
      </div>
      <h1 style="font-size:28px;margin:0 0 10px;color:#0a0a0a;letter-spacing:-0.02em;">${title}</h1>
      <p style="color:#525252;line-height:1.6;margin:0 0 8px;">${course.tagline || ""}</p>
      <p style="color:#8a7d66;font-size:14px;margin:0 0 24px;">${priceLabel}${course.period_label ? ' ' + course.period_label : ''}</p>
      <p style="color:#525252;line-height:1.7;margin:0 0 28px;">
        Kelas ini belum tersedia untuk pembelian. Pantau terus halaman harga — kami akan buka pendaftaran segera.
      </p>
      <a href="../index.html#pricing"
         style="display:inline-block;background:#C8102E;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;">
        ← Lihat kelas yang tersedia
      </a>
    </div>
  `;
}

function renderCourseUI(course) {
  const title = course.title || course.slug;
  const tagline = course.tagline || course.description || "";
  const priceLabel = course.price_label
    || (course.price_idr ? formatRupiah(course.price_idr) : "");
  const period = course.period_label || "";
  const features = Array.isArray(course.features) ? course.features : [];

  document.title = `${title} - EzNihongo`;
  document.getElementById("c-name").textContent = title;
  document.getElementById("c-tagline").textContent = tagline;
  document.getElementById("c-price").innerHTML = `${priceLabel} <span class="period">${period}</span>`;
  document.getElementById("c-summary-price").textContent = priceLabel;
  document.getElementById("c-summary-total").textContent = priceLabel;

  document.getElementById("c-features").innerHTML = features
    .map(f => `<li><span class="c-check">✓</span><span>${f}</span></li>`)
    .join("");

  // Modules list is out of scope for the course summary endpoint — hide that section
  // on the checkout page. (Module preview lives on the dashboard after purchase.)
  const modulesEl = document.getElementById("c-modules");
  if (modulesEl) modulesEl.closest("section").querySelector('h2:nth-of-type(2)')?.remove();
  if (modulesEl) modulesEl.remove();

  const payOptions = document.querySelectorAll(".c-pay-option");
  payOptions.forEach(opt => {
    opt.addEventListener("click", () => {
      payOptions.forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
    });
  });

  document.getElementById("c-checkout-form").addEventListener("submit", e => {
    e.preventDefault();
    const btn = document.getElementById("c-submit");
    btn.textContent = "Memproses pembayaran...";
    btn.disabled = true;
    setTimeout(() => {
      window.location.href = `../welcome.html?new=${encodeURIComponent(course.slug)}`;
    }, 900);
  });
}

async function init() {
  const slug = getSlugFromPage();
  if (!slug) {
    renderError("Kelas tidak ditemukan", "Alamat halaman tidak menyertakan kelas apapun.");
    return;
  }

  if (!(await ensureAuth(slug))) return;

  // Already enrolled? Go straight to dashboard.
  const enrolled = JSON.parse(localStorage.getItem("ez_courses") || "[]");
  if (enrolled.includes(slug)) {
    window.location.replace(`../welcome.html?course=${encodeURIComponent(slug)}`);
    return;
  }

  const course = await fetchCourseBySlug(slug);
  if (!course) {
    renderError(
      "Kelas tidak ditemukan",
      "Kelas yang kamu tuju tidak ada di sistem kami. Mungkin sudah dihapus atau belum pernah dibuat."
    );
    return;
  }

  if (course.is_available === false) {
    renderUnavailable(course);
    return;
  }

  renderCourseUI(course);
}

document.addEventListener("DOMContentLoaded", init);
