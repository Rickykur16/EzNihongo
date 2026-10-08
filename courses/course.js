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
    <div role="alert" style="max-width:520px;margin:80px auto;padding:40px 24px;text-align:center;">
      <div aria-hidden="true" style="font-size:48px;margin-bottom:16px;">${backHref ? '🔒' : '❓'}</div>
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
    if (user) return user;
  } else {
    const mirrored = localStorage.getItem("ez_user");
    if (mirrored) {
      try { return JSON.parse(mirrored); } catch { /* fall through to login */ }
    }
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

function renderCourseUI(course, needsProfile, profile = {}) {
  const title = course.title || course.slug;
  const tagline = course.tagline || course.description || "";
  const priceLabel = course.is_free === true ? 'Gratis' : course.price_label
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

  // Free courses (is_free === true) self-enroll instantly, same as before.
  // Everything else (paid, or not yet classified by an admin — see
  // migration 121) goes through the order/manual-transfer flow — the only
  // method actually wired up server-side (POST /api/orders).
  const submitBtn = document.getElementById("c-submit");
  submitBtn.textContent = course.is_free === true ? "Daftar Kelas Gratis →" : "Buat Pesanan →";
  if (course.is_free === true) document.querySelector('#c-checkout-form .c-payment-method').textContent = 'Gratis — tidak ada pembayaran.';
  const defaultLabel = submitBtn.textContent;

  const showProfileFields = () => {
    if (document.getElementById('c-profile-fields')) return;
    document.getElementById('c-wrap').classList.add('c-wrap--profile');
    submitBtn.insertAdjacentHTML("beforebegin", profileFieldsHtml());
    setupProfileFields(profile);
    if (profile.hasProfile) document.querySelector('.c-profile-intro p').textContent = 'Data yang pernah kamu isi sudah terisi kembali. Lengkapi pertanyaan tambahan agar informasi kelas dan pendampingan lebih sesuai dengan kebutuhanmu.';
  };
  if (needsProfile) showProfileFields();

  document.getElementById("c-checkout-form").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = document.getElementById("c-submit");
    const status = document.getElementById("c-checkout-status");
    const error = document.getElementById("c-checkout-error");
    status.textContent = "";
    error.textContent = "";
    error.hidden = true;
    if (needsProfile && !validateProfileFields()) {
      error.textContent = 'Periksa isian yang ditandai sebelum melanjutkan.';
      error.hidden = false;
      return;
    }
    btn.disabled = true;

    try {
      const steps = {
        profile: ['Menyimpan data...', 'Menyimpan data profil...'],
        enroll: ['Memproses...', 'Memproses pendaftaran kelas...'],
        order: ['Membuat pesanan...', 'Membuat pesanan...'],
      };
      const result = await submitCourseRegistration(course, {
        needsProfile,
        onStep: (step) => { [btn.textContent, status.textContent] = steps[step]; },
      });
      window.location.href = result.kind === 'enrolled'
        ? `../dashboard.html?v=20260902-1&course=${encodeURIComponent(course.slug)}&new=1`
        : `order.html?id=${encodeURIComponent(result.orderId)}`;
    } catch (err) {
      btn.textContent = defaultLabel;
      btn.disabled = false;
      status.textContent = "";
      const fieldError = PROFILE_ERRORS[err.message];
      if (fieldError) {
        setProfileFieldError(...fieldError);
        document.getElementById(fieldError[0])?.focus();
        error.textContent = 'Periksa isian yang ditandai sebelum melanjutkan.';
      } else if (err.message === 'registration_profile_required') {
        needsProfile = true;
        showProfileFields();
        document.getElementById('c-birth-date')?.focus();
        error.textContent = 'Lengkapi data pendaftaran di bawah ini agar kami bisa melanjutkan pendaftaran kelasmu.';
      } else {
        error.textContent = registrationErrorMessage(err.message);
      }
      error.hidden = false;
    }
  });
}

async function init() {
  const slug = getSlugFromPage();
  if (!slug) {
    renderError("Kelas tidak ditemukan", "Alamat halaman tidak menyertakan kelas apapun.");
    return;
  }

  const account = await ensureAuth(slug);
  if (!account) return;
  const owner = window.ezCaptureAuth();
  if (!owner.userId || owner.userId !== account.id) return;

  // Already enrolled? Check server (source of truth) before sending them to
  // dashboard — localStorage can lie, especially right after login on a new
  // device. Fall back to localStorage only if the API is unreachable.
  let enrolled = [];
  if (typeof window.ezApi === "function") {
    try {
      const res = await window.ezApi("/enrollments/me", { expectedUserId: owner.userId });
      if (res.ok) {
        const data = await res.json();
        if (!window.ezIsAuthCurrent(owner)) return;
        enrolled = (data.enrollments || []).map(e => e.slug).filter(Boolean);
        window.ezLearningStorage.setItem("ez_courses", JSON.stringify(enrolled));
      }
    } catch {
      if (!window.ezIsAuthCurrent(owner)) return;
      enrolled = JSON.parse(window.ezLearningStorage.getItem("ez_courses") || "[]");
    }
  } else {
    enrolled = JSON.parse(window.ezLearningStorage.getItem("ez_courses") || "[]");
  }
  if (enrolled.includes(slug)) {
    window.location.replace(`../dashboard.html?v=20260902-1&course=${encodeURIComponent(slug)}`);
    return;
  }

  const course = await fetchCourseBySlug(slug);
  if (!window.ezIsAuthCurrent(owner)) return;
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

  // Complete profiles skip the questions on later signups. Older profiles
  // are prefilled and prompted for the missing strategy questions.
  let needsProfile = true;
  let profile = { fullName: account.fullName || account.full_name || '', email: account.email || '' };
  try {
    const res = await window.ezApi("/profile/marketing", { expectedUserId: owner.userId });
    if (res.ok) {
      profile = { ...profile, ...await res.json() };
      needsProfile = !profile.hasProfile || profile.needsUpdate === true;
    }
  } catch { /* keep needsProfile = true — see comment above */ }

  if (!window.ezIsAuthCurrent(owner)) return;
  renderCourseUI(course, needsProfile, profile);
}

document.addEventListener("DOMContentLoaded", init);
