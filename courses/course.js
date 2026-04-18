const COURSE_DATA = {
  n5: {
    name: "Kelas N5",
    tagline: "Dari nol — hiragana & dasar",
    price: 349000,
    priceLabel: "Rp 349.000",
    period: "/ bulan",
    features: [
      "Akses modul N5 self-paced",
      "2 sesi live class / minggu",
      "Latihan kuis tak terbatas",
      "Komunitas Discord siswa",
    ],
    modules: [
      { n: "01", title: "Hiragana & Katakana", sub: "Baca & tulis aksara dasar (minggu 1–2)" },
      { n: "02", title: "Salam & Perkenalan Diri", sub: "はじめまして、こんにちは、pola dasar" },
      { n: "03", title: "Kosakata Harian", sub: "Angka, waktu, keluarga, tempat" },
      { n: "04", title: "Pola Kalimat Dasar", sub: "です / ます form, partikel は・を・に" },
      { n: "05", title: "Persiapan JLPT N5", sub: "Try-out & review menyeluruh" },
    ],
  },
  n4: {
    name: "Kelas N4",
    tagline: "Lanjut dari dasar",
    price: 449000,
    priceLabel: "Rp 449.000",
    period: "/ bulan",
    features: [
      "Akses modul N4 self-paced",
      "2 sesi live class / minggu",
      "Latihan kuis & try-out N4",
      "Akses rekaman live class",
    ],
    modules: [
      { n: "01", title: "Kanji N4 (~300 karakter)", sub: "Baca, tulis, dan contoh penggunaan" },
      { n: "02", title: "Tata Bahasa Menengah", sub: "Te-form, potential, volitional" },
      { n: "03", title: "Percakapan Sehari-hari", sub: "Bertanya arah, belanja, janji" },
      { n: "04", title: "Menulis Email & Pesan Singkat", sub: "Ragam formal & casual" },
      { n: "05", title: "Persiapan JLPT N4", sub: "Try-out & strategi soal" },
    ],
  },
  n3: {
    name: "Kelas N3",
    tagline: "Menengah — kerja siap",
    price: 549000,
    priceLabel: "Rp 549.000",
    period: "/ bulan",
    features: [
      "Akses modul N3 self-paced",
      "2 sesi live class / minggu",
      "Sesi kaiwa mingguan",
      "Try-out JLPT N3",
    ],
    modules: [
      { n: "01", title: "Kanji N3 (~650 karakter)", sub: "Fokus pada bacaan On & Kun" },
      { n: "02", title: "Tata Bahasa Kerja", sub: "Ekspresi di tempat kerja & formal" },
      { n: "03", title: "Kaiwa Profesional", sub: "Berbicara dengan atasan & rekan kerja" },
      { n: "04", title: "Membaca Artikel & Berita", sub: "Pemahaman teks panjang" },
      { n: "05", title: "Persiapan JLPT N3", sub: "Try-out lengkap 3 sesi" },
    ],
  },
  n2: {
    name: "Kelas N2",
    tagline: "Mahir — bisnis-ready",
    price: 649000,
    priceLabel: "Rp 649.000",
    period: "/ bulan",
    features: [
      "Akses modul N2 self-paced",
      "2 sesi live class / minggu",
      "Modul keigo & business Japanese",
      "Try-out JLPT N2",
    ],
    modules: [
      { n: "01", title: "Kanji & Kosakata N2", sub: "~1000 kanji & ekspresi lanjut" },
      { n: "02", title: "Keigo (敬語)", sub: "Sonkeigo, kenjougo, teineigo" },
      { n: "03", title: "Business Japanese", sub: "Email, meeting, presentasi" },
      { n: "04", title: "Membaca & Mendengarkan Lanjutan", sub: "Podcast, artikel bisnis" },
      { n: "05", title: "Persiapan JLPT N2", sub: "Try-out intensif" },
    ],
  },
  ssw: {
    name: "Kelas SSW",
    tagline: "Tokutei Ginou — jalur kerja Jepang",
    price: 699000,
    priceLabel: "Rp 699.000",
    period: "/ bulan",
    featured: true,
    features: [
      "Modul khusus SSW / Tokutei Ginou",
      "Simulasi ujian SSW lengkap",
      "Mock interview 1-on-1",
      "Bahasa industri (kaigo, manufaktur, F&B)",
      "Jaringan agensi penyalur mitra",
    ],
    modules: [
      { n: "01", title: "Pengenalan SSW / Tokutei Ginou", sub: "14 sektor industri & persyaratan" },
      { n: "02", title: "Japanese Foundation Test (JFT)", sub: "Persiapan ujian bahasa dasar kerja" },
      { n: "03", title: "Bahasa Industri Pilihan", sub: "Kaigo, gaishoku, manufaktur, konstruksi" },
      { n: "04", title: "Mock Interview & Budaya Kerja", sub: "1-on-1 dengan alumni Jepang" },
      { n: "05", title: "Penempatan & Agensi Mitra", sub: "Pendampingan apply ke perusahaan Jepang" },
    ],
  },
};

function formatRupiah(n) {
  return "Rp " + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function requireLogin() {
  const user = localStorage.getItem("ez_user");
  if (!user) {
    const level = document.body.dataset.level;
    const next = encodeURIComponent(`courses/${level}.html`);
    window.location.replace(`../register.html?next=${next}`);
    return false;
  }
  return true;
}

function renderCourse() {
  if (!requireLogin()) return;

  const level = document.body.dataset.level;
  const data = COURSE_DATA[level];
  if (!data) {
    document.body.innerHTML = "<p style='padding:40px;text-align:center;'>Kelas tidak ditemukan.</p>";
    return;
  }

  const enrolled = JSON.parse(localStorage.getItem("ez_courses") || "[]");
  if (enrolled.includes(level)) {
    window.location.replace(`../welcome.html?course=${level}`);
    return;
  }

  document.title = `${data.name} - EzNihongo`;
  document.getElementById("c-name").textContent = data.name;
  document.getElementById("c-tagline").textContent = data.tagline;
  document.getElementById("c-price").innerHTML = `${data.priceLabel} <span class="period">${data.period}</span>`;
  document.getElementById("c-summary-price").textContent = data.priceLabel;
  document.getElementById("c-summary-total").textContent = data.priceLabel;

  document.getElementById("c-features").innerHTML = data.features
    .map(f => `<li><span class="c-check">✓</span><span>${f}</span></li>`)
    .join("");

  document.getElementById("c-modules").innerHTML = data.modules
    .map(m => `
      <div class="c-module">
        <div class="c-module-num">${m.n}</div>
        <div class="c-module-body">
          <p><strong>${m.title}</strong></p>
          <p class="sub">${m.sub}</p>
        </div>
      </div>
    `)
    .join("");

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
      window.location.href = `../welcome.html?new=${level}`;
    }, 900);
  });
}

document.addEventListener("DOMContentLoaded", renderCourse);
