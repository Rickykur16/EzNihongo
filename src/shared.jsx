// Shared data, copy, and utility components for all 3 variations

const SHARED_CONTENT = {
  nav: [
    { label: "Kurikulum", href: "#features" },
    { label: "Untuk Siapa", href: "#audience" },
    { label: "Sensei", href: "#sensei" },
    { label: "Harga", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ],

  hero: {
    eyebrow: "Platform Belajar Bahasa Jepang",
    headline: "Bahasa Jepang. Jalan Karier ke Negeri Sakura.",
    subhead: "Belajar online dari rumah, dengan pace-mu sendiri — sambil kerja, sambil kuliah. Biaya jauh lebih terjangkau daripada LPK konvensional, dengan kurikulum yang mempersiapkanmu untuk bekerja, kuliah, atau pindah hidup ke Jepang.",
    ctaPrimary: "Mulai Kelas Sekarang",
    ctaSecondary: "Lihat Kurikulum",
    stats: [
      { value: "2.400+", label: "Siswa aktif" },
      { value: "N5 — N2", label: "Level kurikulum" },
      { value: "60%", label: "Lebih hemat dari LPK" },
    ],
  },

  marquee: [
    "特定技能", "N5・N4・N3・N2", "LIVE CLASS", "自分のペース", "働きながら学ぶ",
    "JLPT", "SSW", "KAIWA", "東京・大阪・福岡", "ONLINE KELAS",
  ],

  features: {
    eyebrow: "Kurikulum",
    title: "Empat pilar belajar yang membuat progressmu nyata",
    subtitle: "Dirancang untuk pelajar Indonesia yang ingin serius menembus Jepang — bukan sekadar tahu sapaan.",
    items: [
      {
        num: "01",
        kanji: "生",
        title: "Live Class bersama Sensei",
        body: "Kelas interaktif dua kali seminggu dengan sensei bersertifikat. Bertanya langsung, koreksi pengucapan, dan diskusi budaya kerja Jepang yang tidak ada di buku.",
        tag: "LIVE · 90 menit",
      },
      {
        num: "02",
        kanji: "自",
        title: "Modul Self-Paced 24/7",
        body: "Video materi, bacaan, dan latihan kanji yang bisa diakses kapan saja. Cocok untuk kamu yang belajar di sela-sela kerja atau kuliah.",
        tag: "ON-DEMAND",
      },
      {
        num: "03",
        kanji: "問",
        title: "Kuis & Try-Out JLPT",
        body: "Ribuan soal latihan setara JLPT resmi. Analisa kelemahanmu per bagian — bunpou, moji-goi, choukai, dokkai — dan fokus perbaiki.",
        tag: "ADAPTIVE",
      },
      {
        num: "04",
        kanji: "話",
        title: "Speaking Practice",
        body: "Sesi kaiwa mingguan dalam grup kecil. Simulasi wawancara kerja Jepang, role-play situasi kantor, dan ujian lisan SSW/Tokutei.",
        tag: "GROUP · 45 menit",
      },
    ],
  },

  audience: {
    eyebrow: "Untuk Siapa",
    title: "Membantu mewujudkan mimpimu di negeri sakura.",
    subtitle: "Apapun tujuanmu ke Jepang, kami punya kurikulum yang mengantarkannya.",
    cards: [
      {
        tag: "SMA / Fresh Graduate",
        title: "Baru lulus SMA, ingin kerja di Jepang",
        body: "Mulai dari nol. Kami antarkan kamu ke level N4—N3 plus pelatihan interview SSW dalam 6–9 bulan.",
        // image placeholder caption
        photoCaption: "photo: fresh graduate w/ Japan guidebook",
      },
      {
        tag: "Pencari Kerja",
        title: "Pencari kerja yang ingin coba peruntungan di Jepang",
        body: "Fokus pada Tokutei Ginou (SSW), conversational Japanese, dan bahasa industri (keperawatan, manufaktur, konstruksi, F&B).",
        photoCaption: "photo: Japanese office / interview scene",
      },
      {
        tag: "Karyawan Aktif",
        title: "Sedang bekerja, ingin pindah karier ke Jepang",
        body: "Jadwal fleksibel untuk yang sibuk. Belajar setelah pulang kerja atau weekend, tanpa mengganggu pekerjaan sekarang.",
        photoCaption: "photo: Indonesian worker studying at night",
      },
    ],
  },

  sensei: {
    eyebrow: "Sensei",
    title: "Diajar oleh mereka yang sudah melewatinya.",
    subtitle: "Native Japanese sensei dan alumni Jepang yang paham konteks pelajar Indonesia.",
    people: [
      {
        name: "Hiroshi Tanaka",
        title: "Lead Sensei · Native",
        bio: "15 tahun mengajar bahasa Jepang untuk pelajar asing. Mantan instruktur di Naganuma School, Tokyo.",
        tags: ["JLPT", "SSW", "Business"],
        location: "Tokyo, Jepang",
      },
      {
        name: "Sari Kusuma",
        title: "Senior Sensei · N1",
        bio: "Alumni Waseda University. 8 tahun tinggal dan bekerja di Jepang. Spesialisasi persiapan wawancara kerja.",
        tags: ["Kaiwa", "Interview", "Academic"],
        location: "Jakarta / Osaka",
      },
      {
        name: "Aiko Yamamoto",
        title: "Sensei Kaiwa · Native",
        bio: "Mantan staff HR di perusahaan manufaktur besar Jepang. Fokus pada business etiquette dan keigo.",
        tags: ["Keigo", "Business", "Culture"],
        location: "Fukuoka, Jepang",
      },
      {
        name: "Budi Hartono",
        title: "Sensei · N1, ex-SSW",
        bio: "Sukses melalui jalur SSW ke bidang keperawatan. Sekarang mentor bagi ratusan pekerja Indonesia di Jepang.",
        tags: ["SSW", "Kaigo", "Mentoring"],
        location: "Nagoya, Jepang",
      },
    ],
  },

  pricing: {
    eyebrow: "Harga",
    title: "Biaya sepersekian dari LPK, hasil yang serius.",
    subtitle: "Tidak ada biaya pendaftaran tersembunyi. Tidak ada kontrak panjang. Bayar per level, naik kalau kamu siap.",
    plans: [
      {
        name: "Kelas N5",
        level: "N5",
        price: "Rp 349rb",
        period: "/ bulan",
        tagline: "Dari nol — hiragana & dasar",
        features: [
          "Akses modul N5 self-paced",
          "2 sesi live class / minggu",
          "Latihan kuis tak terbatas",
          "Komunitas Discord siswa",
        ],
        cta: "Pilih Kelas N5",
      },
      {
        name: "Kelas N4",
        level: "N4",
        price: "Rp 449rb",
        period: "/ bulan",
        tagline: "Lanjut dari dasar",
        features: [
          "Akses modul N4 self-paced",
          "2 sesi live class / minggu",
          "Latihan kuis & try-out N4",
          "Akses rekaman live class",
        ],
        cta: "Pilih Kelas N4",
      },
      {
        name: "Kelas N3",
        level: "N3",
        price: "Rp 549rb",
        period: "/ bulan",
        tagline: "Menengah — kerja siap",
        features: [
          "Akses modul N3 self-paced",
          "2 sesi live class / minggu",
          "Sesi kaiwa mingguan",
          "Try-out JLPT N3",
        ],
        cta: "Pilih Kelas N3",
      },
      {
        name: "Kelas N2",
        level: "N2",
        price: "Rp 649rb",
        period: "/ bulan",
        tagline: "Mahir — bisnis-ready",
        features: [
          "Akses modul N2 self-paced",
          "2 sesi live class / minggu",
          "Modul keigo & business Japanese",
          "Try-out JLPT N2",
        ],
        cta: "Pilih Kelas N2",
      },
      {
        name: "Kelas SSW",
        level: "Tokutei Ginou",
        price: "Rp 699rb",
        period: "/ bulan",
        tagline: "Paling populer — jalur kerja Jepang",
        features: [
          "Modul khusus SSW / Tokutei Ginou",
          "Simulasi ujian SSW lengkap",
          "Mock interview 1-on-1",
          "Bahasa industri (kaigo, manufaktur, F&B)",
          "Jaringan agensi penyalur mitra",
        ],
        cta: "Pilih Kelas SSW",
        featured: true,
      },
    ],
    note: "*LPK konvensional biasanya mematok Rp 15—25 juta untuk program 6 bulan. EzNihongo membuka jalur yang sama, online, bayar per level dan kamu bisa berhenti atau naik kapan saja.",
  },

  faq: {
    eyebrow: "FAQ",
    title: "Pertanyaan yang sering ditanyakan.",
    items: [
      {
        q: "Apakah saya bisa benar-benar kerja di Jepang setelah belajar di sini?",
        a: "Ya. Kelas SSW kami dirancang khusus untuk mempersiapkanmu lulus ujian Tokutei Ginou dan bekerja di Jepang. Kami juga memiliki jaringan agensi penyalur kerja mitra yang siap membantu alumni setelah lulus ujian.",
      },
      {
        q: "Bedanya dengan LPK konvensional apa?",
        a: "LPK biasanya mematok Rp 15—25 juta untuk program 6 bulan offline, dengan jadwal tetap. EzNihongo 100% online, pace mengikuti kamu, dan biaya total di bawah Rp 5 juta. Cocok untuk yang tetap ingin bekerja sambil belajar.",
      },
      {
        q: "Saya benar-benar pemula, tidak tahu hiragana. Bisa ikut?",
        a: "Sangat bisa. Kelas N5 dimulai dari cara membaca hiragana-katakana, pelafalan dasar, hingga percakapan sederhana. Tidak ada prasyarat apapun.",
      },
      {
        q: "Berapa lama sampai saya bisa lulus JLPT N4 / SSW?",
        a: "Rata-rata siswa kami menembus N4 dalam 6–9 bulan dengan komitmen 5–7 jam belajar per minggu. Untuk SSW (Tokutei Ginou), persiapannya bisa selesai bersamaan dengan N4.",
      },
      {
        q: "Apakah sensei-nya native Jepang?",
        a: "Ya, sebagian besar sensei kami native speaker yang tinggal di Jepang. Beberapa adalah alumni Indonesia yang sudah bertahun-tahun bekerja/kuliah di Jepang — mereka paham betul konteks pelajar Indonesia.",
      },
      {
        q: "Bagaimana kalau saya tidak sempat ikut live class?",
        a: "Semua live class direkam dan bisa kamu tonton ulang kapan saja. Modul self-paced dan latihan kuis juga buka 24/7.",
      },
    ],
  },

  finalCTA: {
    kanji: "始",
    title: "Saatnya mulai, sebelum impian itu menunggu terlalu lama.",
    subtitle: "Gratis konsultasi 15 menit dengan sensei kami untuk menentukan jalur belajarmu.",
    cta: "Daftar Sekarang",
    note: "Konsultasi gratis dengan sensei sebelum mendaftar.",
  },

  footer: {
    tagline: "Platform belajar bahasa Jepang untuk generasi yang ingin membawa kariernya ke Jepang.",
    columns: [
      {
        title: "Produk",
        links: ["Kurikulum", "Live Class", "SSW / Tokutei", "JLPT Prep", "Kaiwa Session"],
      },
      {
        title: "Perusahaan",
        links: ["Tentang", "Sensei", "Karier", "Blog", "Partner"],
      },
      {
        title: "Dukungan",
        links: ["Pusat Bantuan", "Kontak", "Kebijakan Privasi", "Syarat & Ketentuan"],
      },
    ],
    copyright: "© 2026 EzNihongo. Dibangun dengan ♥ untuk calon-calon pejuang Jepang.",
  },
};

// ============ REUSABLE UTILITY COMPONENTS ============

// Intersection observer hook for scroll reveals
function useReveal() {
  React.useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  });
}

// Torii SVG icon
function ToriiIcon({ size = 24, color = "currentColor", stroke = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 10 Q20 5 36 10 L34 13 Q20 9 6 13 Z" fill={color} />
      <rect x="7" y="14" width="26" height="3" fill={color} />
      <rect x="10" y="18" width="3" height="18" fill={color} />
      <rect x="27" y="18" width="3" height="18" fill={color} />
      <rect x="13" y="22" width="14" height="2" fill={color} />
    </svg>
  );
}

// Brush stroke underline SVG (like logo)
function BrushStroke({ color = "#C8102E", width = "100%", height = 20, className = "" }) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 400 20" preserveAspectRatio="none" style={{ display: 'block' }}>
      <path
        d="M5,12 Q100,3 200,8 T395,10 Q300,15 150,13 T5,12 Z"
        fill={color}
        opacity="0.95"
      />
    </svg>
  );
}

// Hanko (Japanese stamp) decoration
function Hanko({ size = 80, text = "日本語", color = "#C8102E" }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      border: `3px solid ${color}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: color,
      fontFamily: "'Noto Serif JP', serif",
      fontWeight: 700,
      fontSize: size * 0.22,
      letterSpacing: '0.05em',
      transform: 'rotate(-6deg)',
      position: 'relative',
      writingMode: 'vertical-rl',
      padding: size * 0.1,
    }}>
      {text}
    </div>
  );
}

// Striped photo placeholder (with caption)
function PhotoPlaceholder({ caption, aspectRatio = "4/3", tone = "warm", style = {} }) {
  const palettes = {
    warm: { a: "#e8dfd0", b: "#d9cdb8", text: "#5a4a35" },
    cool: { a: "#e0e6ed", b: "#c7d0dc", text: "#3a4656" },
    red: { a: "#f5d5d5", b: "#e8b5b5", text: "#6b1a1a" },
    dark: { a: "#2a2a2a", b: "#1a1a1a", text: "#999" },
  };
  const p = palettes[tone] || palettes.warm;
  return (
    <div style={{
      aspectRatio,
      background: `repeating-linear-gradient(135deg, ${p.a} 0, ${p.a} 8px, ${p.b} 8px, ${p.b} 16px)`,
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: p.text,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 11,
      letterSpacing: '0.05em',
      padding: 16,
      textAlign: 'center',
      ...style,
    }}>
      [ {caption} ]
    </div>
  );
}

// Sakura petals falling (decorative)
function SakuraPetals({ count = 12 }) {
  if (!window.__TWEAKS__?.showSakura) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      pointerEvents: 'none', overflow: 'hidden', zIndex: 1,
    }}>
      {Array.from({ length: count }).map((_, i) => {
        const left = (i * 8.33 + (i % 3) * 5) % 100;
        const delay = (i * 1.3) % 18;
        const duration = 18 + (i % 6) * 3;
        const size = 10 + (i % 4) * 3;
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 20 20" style={{
            position: 'absolute',
            top: '-20px',
            left: `${left}%`,
            animation: `sakuraFall ${duration}s linear ${delay}s infinite`,
            opacity: 0,
          }}>
            <path d="M10 2 Q12 6 10 10 Q8 6 10 2 M18 10 Q14 12 10 10 Q14 8 18 10 M10 18 Q8 14 10 10 Q12 14 10 18 M2 10 Q6 8 10 10 Q6 12 2 10" fill="#f4c1c9" opacity="0.6" />
            <circle cx="10" cy="10" r="1.2" fill="#e89cab" />
          </svg>
        );
      })}
    </div>
  );
}

// Expose globally
Object.assign(window, {
  SHARED_CONTENT, useReveal, ToriiIcon, BrushStroke, Hanko, PhotoPlaceholder, SakuraPetals,
});
