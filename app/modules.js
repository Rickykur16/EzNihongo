// ============================================================
//  MODULES.JS — Data semua modul pelajaran (versi lokal)
//  Cara edit:
//    - Tambah pelajaran : tambah objek baru di dalam array "lessons"
//    - Hapus pelajaran  : hapus baris objek yang tidak diinginkan
//    - Edit video       : isi "video_id" dengan ID YouTube (bagian ?v=xxxx)
//    - Edit harga/judul : ubah nilai "price" / "title" di masing-masing level
// ============================================================

const MODULES = {

  "n5": {
    "level": "N5",
    "title": "Pemula — Fondasi Bahasa Jepang",
    "description": "Mulai dari nol. Kuasai Hiragana dan Katakana, pelajari kosakata dan kanji dasar, dan mulai berkomunikasi dalam situasi sehari-hari. Cocok untuk yang belum pernah belajar Jepang sama sekali.",
    "price": "Rp 99.000",
    "next_level": "n4",
    "stats": { "lessons": 56, "hours": "~20", "kanji": 80, "vocab": "800+" },
    "learn": [
      "Membaca dan menulis Hiragana (46 karakter) & Katakana (46 karakter)",
      "80 Kanji dasar level N5",
      "800+ kosakata sehari-hari",
      "Pola kalimat dasar: です、ます、じゃない",
      "Percakapan: perkenalan, belanja, transportasi, cuaca",
      "Partikel dasar: は、が、を、に、で、と、も"
    ],
    "includes": [
      "56 video lesson HD",
      "Latihan soal interaktif",
      "Vocab flashcard N5",
      "Grammar tracker",
      "Simulasi ujian JLPT N5",
      "Sertifikat penyelesaian",
      "Akses komunitas"
    ],
    "units": [
      { "number": 1, "title": "Sistem Penulisan",    "range": [0, 2]   },
      { "number": 2, "title": "Tata Bahasa Dasar",   "range": [3, 6]   },
      { "number": 3, "title": "Kosakata Esensial",   "range": [7, 10]  },
      { "number": 4, "title": "Percakapan Praktis",  "range": [11, 14] },
      { "number": 5, "title": "Persiapan JLPT N5",   "range": [15, 17] }
    ],
    "chapters": [
      {
        "title": "Bab 1 — Hiragana",
        "lessons": [
          { "id": "n5-1-1", "title": "Pengenalan Hiragana: あ行 (a, i, u, e, o)",   "duration": "12 mnt", "free": true,  "video_id": "" },
          { "id": "n5-1-2", "title": "Hiragana: か行、さ行、た行",                    "duration": "14 mnt", "free": true,  "video_id": "" },
          { "id": "n5-1-3", "title": "Hiragana: な行、は行、ま行",                    "duration": "13 mnt", "free": false, "video_id": "" },
          { "id": "n5-1-4", "title": "Hiragana: や行、ら行、わ行 + ん",               "duration": "12 mnt", "free": false, "video_id": "" },
          { "id": "n5-1-5", "title": "Dakuten, Handakuten & kombinasi Hiragana",     "duration": "16 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 2 — Katakana",
        "lessons": [
          { "id": "n5-2-1", "title": "Katakana dasar: ア行 s/d タ行",      "duration": "14 mnt", "free": false, "video_id": "" },
          { "id": "n5-2-2", "title": "Katakana: ナ行 s/d ワ行 + ン",       "duration": "13 mnt", "free": false, "video_id": "" },
          { "id": "n5-2-3", "title": "Kata serapan & latihan Katakana",     "duration": "18 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 3 — Kanji N5 Bagian 1",
        "lessons": [
          { "id": "n5-3-1", "title": "Kanji angka & waktu: 一二三四五六七八九十百千万", "duration": "20 mnt", "free": false, "video_id": "" },
          { "id": "n5-3-2", "title": "Kanji alam & arah: 日月火水木金土 + 上下左右",   "duration": "18 mnt", "free": false, "video_id": "" },
          { "id": "n5-3-3", "title": "Kanji orang & keluarga: 人口女男子父母",          "duration": "17 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 4 — Pola Kalimat Dasar",
        "lessons": [
          { "id": "n5-4-1", "title": "Pola です & ます — kalimat dasar sopan", "duration": "15 mnt", "free": false, "video_id": "" },
          { "id": "n5-4-2", "title": "Bentuk negatif: じゃない & ません",      "duration": "14 mnt", "free": false, "video_id": "" },
          { "id": "n5-4-3", "title": "Bentuk tanya: か & の",                  "duration": "13 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 5 — Partikel は、が、を",
        "lessons": [
          { "id": "n5-5-1", "title": "Partikel は — topik kalimat",    "duration": "14 mnt", "free": false, "video_id": "" },
          { "id": "n5-5-2", "title": "Partikel が — subjek penekanan", "duration": "15 mnt", "free": false, "video_id": "" },
          { "id": "n5-5-3", "title": "Partikel を — objek langsung",   "duration": "13 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 6 — Partikel に、で、と、も、へ",
        "lessons": [
          { "id": "n5-6-1", "title": "Partikel に — tujuan & waktu",          "duration": "16 mnt", "free": false, "video_id": "" },
          { "id": "n5-6-2", "title": "Partikel で — tempat & cara",           "duration": "15 mnt", "free": false, "video_id": "" },
          { "id": "n5-6-3", "title": "Partikel と、も、へ — bersama & juga",  "duration": "14 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 7 — Kata Sifat",
        "lessons": [
          { "id": "n5-7-1", "title": "い-adjective: penggunaan dasar",                "duration": "15 mnt", "free": false, "video_id": "" },
          { "id": "n5-7-2", "title": "な-adjective: penggunaan dasar",                "duration": "14 mnt", "free": false, "video_id": "" },
          { "id": "n5-7-3", "title": "Perbandingan kata sifat: lebih & paling",       "duration": "16 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 8 — Angka & Waktu",
        "lessons": [
          { "id": "n5-8-1", "title": "Angka 1–100 & cara membaca",        "duration": "14 mnt", "free": false, "video_id": "" },
          { "id": "n5-8-2", "title": "Jam & menit: 何時ですか",            "duration": "16 mnt", "free": false, "video_id": "" },
          { "id": "n5-8-3", "title": "Hari, bulan & tahun: 何日ですか",    "duration": "15 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 9 — Keluarga & Orang",
        "lessons": [
          { "id": "n5-9-1", "title": "Anggota keluarga dalam bahasa Jepang",          "duration": "14 mnt", "free": false, "video_id": "" },
          { "id": "n5-9-2", "title": "Kata ganti orang: わたし、あなた、かれ",        "duration": "13 mnt", "free": false, "video_id": "" },
          { "id": "n5-9-3", "title": "Profesi & pekerjaan umum",                      "duration": "15 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 10 — Tempat & Benda Sehari-hari",
        "lessons": [
          { "id": "n5-10-1", "title": "Tempat umum: eki, depato, byouin",    "duration": "14 mnt", "free": false, "video_id": "" },
          { "id": "n5-10-2", "title": "Benda di rumah & sekolah",            "duration": "15 mnt", "free": false, "video_id": "" },
          { "id": "n5-10-3", "title": "Kata tempat: ここ、そこ、あそこ",     "duration": "12 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 11 — Kata Kerja Umum",
        "lessons": [
          { "id": "n5-11-1", "title": "Kata kerja Grup 1 & konjugasi dasar", "duration": "18 mnt", "free": false, "video_id": "" },
          { "id": "n5-11-2", "title": "Kata kerja Grup 2 & konjugasi dasar", "duration": "16 mnt", "free": false, "video_id": "" },
          { "id": "n5-11-3", "title": "Kata kerja Grup 3: する & くる",       "duration": "14 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 12 — Perkenalan Diri",
        "lessons": [
          { "id": "n5-12-1", "title": "はじめまして & memperkenalkan diri",  "duration": "16 mnt", "free": false, "video_id": "" },
          { "id": "n5-12-2", "title": "Menanyakan asal & pekerjaan",         "duration": "14 mnt", "free": false, "video_id": "" },
          { "id": "n5-12-3", "title": "Dialog perkenalan lengkap",           "duration": "20 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 13 — Di Toko & Restoran",
        "lessons": [
          { "id": "n5-13-1", "title": "Memesan makanan di restoran",               "duration": "18 mnt", "free": false, "video_id": "" },
          { "id": "n5-13-2", "title": "Berbelanja: harga & transaksi",             "duration": "16 mnt", "free": false, "video_id": "" },
          { "id": "n5-13-3", "title": "Ekspresi di toko: ください、いくら",        "duration": "14 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 14 — Transportasi & Arah",
        "lessons": [
          { "id": "n5-14-1", "title": "Naik kereta: tiket & platform",         "duration": "18 mnt", "free": false, "video_id": "" },
          { "id": "n5-14-2", "title": "Menanyakan & memberikan arah",           "duration": "20 mnt", "free": false, "video_id": "" },
          { "id": "n5-14-3", "title": "Moda transportasi: bus, taksi, sepeda",  "duration": "15 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 15 — Cuaca & Waktu Luang",
        "lessons": [
          { "id": "n5-15-1", "title": "Cuaca: はれ、くもり、あめ、ゆき",  "duration": "14 mnt", "free": false, "video_id": "" },
          { "id": "n5-15-2", "title": "Hobi & kegiatan waktu luang",      "duration": "16 mnt", "free": false, "video_id": "" },
          { "id": "n5-15-3", "title": "Rencana & undangan: 〜ましょう",   "duration": "15 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 16 — Kanji N5 Bagian 2",
        "lessons": [
          { "id": "n5-16-1", "title": "Kanji benda & tempat: 山川田畑",           "duration": "18 mnt", "free": false, "video_id": "" },
          { "id": "n5-16-2", "title": "Kanji sifat & keadaan: 大小高安新",        "duration": "17 mnt", "free": false, "video_id": "" },
          { "id": "n5-16-3", "title": "Kanji aktivitas: 食飲見聞書読",            "duration": "19 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 17 — Membaca & Mendengar",
        "lessons": [
          { "id": "n5-17-1", "title": "Membaca teks pendek bahasa Jepang",    "duration": "22 mnt", "free": false, "video_id": "" },
          { "id": "n5-17-2", "title": "Latihan mendengar percakapan N5",      "duration": "25 mnt", "free": false, "video_id": "" },
          { "id": "n5-17-3", "title": "Strategi mengerjakan soal JLPT N5",    "duration": "20 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 18 — Simulasi Ujian JLPT N5",
        "lessons": [
          { "id": "n5-18-1", "title": "Simulasi Bagian Kosakata & Kanji",           "duration": "30 mnt", "free": false, "video_id": "" },
          { "id": "n5-18-2", "title": "Simulasi Bagian Tata Bahasa",                "duration": "30 mnt", "free": false, "video_id": "" },
          { "id": "n5-18-3", "title": "Simulasi Bagian Mendengar + Pembahasan",     "duration": "45 mnt", "free": false, "video_id": "" }
        ]
      }
    ]
  },

  "n4": {
    "level": "N4",
    "title": "Dasar — Bahasa Jepang Sehari-hari",
    "description": "Perluas kosakata dan kanji, pelajari tata bahasa menengah, dan mulai percakapan dalam situasi formal sehari-hari.",
    "price": "Rp 119.000",
    "next_level": "n3",
    "stats": { "lessons": 36, "hours": "12", "kanji": 300, "vocab": "1500+" },
    "learn": [
      "300 Kanji level N4",
      "1500+ kosakata menengah",
      "Bentuk て-form, た-form, dan ない-form",
      "Pola perbandingan, alasan, dan kondisi",
      "Percakapan: tempat kerja, perjalanan, dan kesehatan",
      "Membaca teks pendek bahasa Jepang"
    ],
    "includes": [
      "36 video lesson HD",
      "Latihan soal interaktif",
      "Vocab flashcard N4",
      "Grammar tracker",
      "Simulasi ujian JLPT N4",
      "Sertifikat penyelesaian",
      "Akses komunitas"
    ],
    "chapters": [
      {
        "title": "Bab 1 — Kanji N4 Bagian 1",
        "lessons": [
          { "id": "n4-1-1", "title": "Kanji 001–050: benda & aktivitas sehari-hari", "duration": "22 mnt", "free": true,  "video_id": "" },
          { "id": "n4-1-2", "title": "Kanji 051–100: waktu, tempat & arah",          "duration": "20 mnt", "free": true,  "video_id": "" },
          { "id": "n4-1-3", "title": "Kanji 101–150: pekerjaan & kehidupan sosial",  "duration": "21 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 2 — Te-form & perubahan kata kerja",
        "lessons": [
          { "id": "n4-2-1", "title": "て-form: Group 1, 2, dan 3",           "duration": "18 mnt", "free": false, "video_id": "" },
          { "id": "n4-2-2", "title": "た-form dan bentuk lampau",             "duration": "16 mnt", "free": false, "video_id": "" },
          { "id": "n4-2-3", "title": "ない-form: bentuk negatif kata kerja", "duration": "15 mnt", "free": false, "video_id": "" },
          { "id": "n4-2-4", "title": "Potential form: できる & られる",        "duration": "17 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 3 — Pola Grammar N4",
        "lessons": [
          { "id": "n4-3-1", "title": "〜ている — aksi berkelanjutan",        "duration": "14 mnt", "free": false, "video_id": "" },
          { "id": "n4-3-2", "title": "〜てから & 〜たあとで — urutan waktu", "duration": "16 mnt", "free": false, "video_id": "" },
          { "id": "n4-3-3", "title": "〜ので & 〜のに — alasan & kontras",   "duration": "18 mnt", "free": false, "video_id": "" },
          { "id": "n4-3-4", "title": "〜たら & 〜ば — kondisi dan syarat",   "duration": "20 mnt", "free": false, "video_id": "" }
        ]
      }
    ]
  },

  "n3": {
    "level": "N3",
    "title": "Menengah — Membaca Teks Asli",
    "description": "Kuasai 650 kanji, baca artikel pendek, dan mulai menonton konten berbahasa Jepang tanpa subtitle.",
    "price": "Rp 139.000",
    "next_level": "n2",
    "stats": { "lessons": 40, "hours": "~18", "kanji": 650, "vocab": "3000+" },
    "learn": [
      "650 Kanji level N3",
      "3000+ kosakata",
      "Pola grammar kompleks: passive, causative, conditional",
      "Membaca artikel berita pendek",
      "Menonton drama/anime tanpa subtitle dasar",
      "Keigo dasar (bahasa sopan formal)"
    ],
    "includes": [
      "40 video lesson HD",
      "Latihan soal interaktif",
      "Vocab flashcard N3",
      "Grammar tracker",
      "Simulasi ujian JLPT N3",
      "Sertifikat penyelesaian",
      "Akses komunitas"
    ],
    "chapters": [
      {
        "title": "Bab 1 — Kanji N3",
        "lessons": [
          { "id": "n3-1-1", "title": "Kanji 001–100: topik umum",   "duration": "25 mnt", "free": true,  "video_id": "" },
          { "id": "n3-1-2", "title": "Kanji 101–200: alam & sains", "duration": "24 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 2 — Grammar N3",
        "lessons": [
          { "id": "n3-2-1", "title": "Passive form: 〜られる",                      "duration": "20 mnt", "free": false, "video_id": "" },
          { "id": "n3-2-2", "title": "Causative form: 〜させる",                    "duration": "20 mnt", "free": false, "video_id": "" },
          { "id": "n3-2-3", "title": "Giving & receiving: あげる、もらう、くれる", "duration": "22 mnt", "free": false, "video_id": "" }
        ]
      }
    ]
  },

  "n2": {
    "level": "N2",
    "title": "Lanjutan — Komunikasi Profesional",
    "description": "Kuasai 1000 kanji, baca dokumen bisnis, dan berkomunikasi secara profesional dalam bahasa Jepang.",
    "price": "Rp 159.000",
    "next_level": "n1",
    "stats": { "lessons": 46, "hours": "~24", "kanji": 1000, "vocab": "6000+" },
    "learn": [
      "1000 Kanji level N2",
      "6000+ kosakata termasuk istilah bisnis",
      "Keigo lengkap: sonkeigo & kenjogo",
      "Membaca dokumen resmi & email bisnis",
      "Menonton berita TV berbahasa Jepang",
      "Wawancara kerja dalam bahasa Jepang"
    ],
    "includes": [
      "46 video lesson HD",
      "Latihan soal interaktif",
      "Vocab flashcard N2",
      "Grammar tracker",
      "Simulasi ujian JLPT N2",
      "Sertifikat penyelesaian",
      "Akses komunitas"
    ],
    "chapters": [
      {
        "title": "Bab 1 — Kanji N2",
        "lessons": [
          { "id": "n2-1-1", "title": "Kanji bisnis & ekonomi 001–100",  "duration": "28 mnt", "free": true,  "video_id": "" },
          { "id": "n2-1-2", "title": "Kanji sains & teknologi 001–100", "duration": "26 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 2 — Keigo",
        "lessons": [
          { "id": "n2-2-1", "title": "Sonkeigo: menghormati lawan bicara", "duration": "24 mnt", "free": false, "video_id": "" },
          { "id": "n2-2-2", "title": "Kenjogo: merendahkan diri sendiri",  "duration": "22 mnt", "free": false, "video_id": "" },
          { "id": "n2-2-3", "title": "Teineigo dalam situasi formal",      "duration": "20 mnt", "free": false, "video_id": "" }
        ]
      }
    ]
  },

  "n1": {
    "level": "N1",
    "title": "Mahir — Level Native Speaker",
    "description": "Kuasai 2000 kanji, baca sastra dan berita, dan komunikasi setara native speaker Jepang.",
    "price": "Rp 179.000",
    "next_level": null,
    "stats": { "lessons": 52, "hours": "~32", "kanji": 2000, "vocab": "10000+" },
    "learn": [
      "2000 Kanji level N1",
      "10.000+ kosakata termasuk sastra & berita",
      "Membaca novel dan esai berbahasa Jepang",
      "Pola grammar tingkat lanjut & idiom",
      "Mendengar dan memahami percakapan native",
      "Menulis esai formal dalam bahasa Jepang"
    ],
    "includes": [
      "52 video lesson HD",
      "Latihan soal interaktif",
      "Vocab flashcard N1",
      "Grammar tracker",
      "Simulasi ujian JLPT N1",
      "Sertifikat penyelesaian",
      "Akses komunitas"
    ],
    "chapters": [
      {
        "title": "Bab 1 — Kanji N1",
        "lessons": [
          { "id": "n1-1-1", "title": "Kanji sastra & budaya 001–100",   "duration": "30 mnt", "free": true,  "video_id": "" },
          { "id": "n1-1-2", "title": "Kanji akademik & ilmiah 001–100", "duration": "28 mnt", "free": false, "video_id": "" }
        ]
      },
      {
        "title": "Bab 2 — Grammar N1",
        "lessons": [
          { "id": "n1-2-1", "title": "Pola formal & klasik: 〜にあたり、〜をもって",      "duration": "26 mnt", "free": false, "video_id": "" },
          { "id": "n1-2-2", "title": "Nuansa & register bahasa Jepang tingkat lanjut", "duration": "28 mnt", "free": false, "video_id": "" }
        ]
      }
    ]
  }

};
