-- Verified against Canva EZNihongo / BAB 3–20 / Bunpou, 2026-09-27.
-- Atomic in migrations/run.js. No lesson/grammar deletion, no slug/ID/video
-- changes, and no student-progress writes. Preserve the owner's titles in
-- Bab 3, 4, 5 and 7. Backup before changing titles, membership or ordering.
CREATE TABLE IF NOT EXISTS n5_bunpou_canva_backup_169 (
  entity TEXT NOT NULL,
  key TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  PRIMARY KEY (entity, key)
);

DO $alignment$
#variable_conflict use_variable
DECLARE
  plan JSONB := $plan$[
  {
    "bab": 3,
    "design": "DAHH23AFj1s",
    "parts": [
      {
        "slug": "bunpou-n5-b3",
        "title": null,
        "slides": "2–4",
        "patterns": [
          "〜は〜です",
          "〜は〜じゃ／ではありません",
          "〜ですか"
        ]
      },
      {
        "slug": "bunpou2-n5-b3",
        "title": null,
        "slides": "5–7",
        "patterns": [
          "〜の〜",
          "〜も〜です",
          "〜文 + ね／よ"
        ]
      }
    ]
  },
  {
    "bab": 4,
    "design": "DAHIOMNvS6A",
    "parts": [
      {
        "slug": "bunpou1-n5-b4",
        "title": null,
        "slides": "2–3",
        "patterns": [
          "これ／それ／あれは〜です",
          "この／その／あの／どの + [Kata Benda]"
        ]
      },
      {
        "slug": "bunpou2-n5-b4",
        "title": null,
        "slides": "4–6",
        "patterns": [
          "〜の〜",
          "そうです／ちがいます"
        ]
      }
    ]
  },
  {
    "bab": 5,
    "design": "DAHIUGwP1vU",
    "parts": [
      {
        "slug": "bunpou1-n5-b5",
        "title": null,
        "slides": "2–3",
        "patterns": [
          "いくら",
          "今〜時〜分です"
        ],
        "task": "tugas-bunpou-bab-5-waktu",
        "taskTitle": "Tugas Bunpou Bab 5: Harga & Jam",
        "taskPatterns": [
          "これはいくらですか",
          "今〜時〜分です"
        ]
      },
      {
        "slug": "bunpou2-n5-b5",
        "title": null,
        "slides": "4–5",
        "patterns": [
          "~から ~ まで",
          "おいくつ/ 何さい"
        ],
        "task": "tugas-bunpou-bab-5-uang-umur",
        "taskTitle": "Tugas Bunpou Bab 5: Rentang Waktu & Umur",
        "taskPatterns": [
          "〜時から〜時まで",
          "おいくつですか／何歳ですか"
        ]
      }
    ]
  },
  {
    "bab": 6,
    "design": "DAHIUcchMuk",
    "parts": [
      {
        "slug": "bunpou1-n5-b6",
        "title": "Bentuk Kata Sifat い (〜い・〜くない・〜かった・〜くなかった)",
        "slides": "2–4",
        "patterns": [
          "〜は[い-adj]です",
          "〜は[い-adj]くないです",
          "〜かったです",
          "〜くなかったです"
        ],
        "task": "tugas-bunpou-bab-6-bentuk-dasar",
        "taskTitle": "Tugas Bunpou Bab 6: Bentuk Kata Sifat い",
        "taskPatterns": [
          "〜は[い-adj]です",
          "〜は[い-adj]くないです",
          "〜かったです／〜くなかったです"
        ]
      },
      {
        "slug": "bunpou2-n5-b6",
        "title": "Penggunaan Kata Sifat い (い＋Kata Benda・とても／あまり・どうですか)",
        "slides": "5–7",
        "patterns": [
          "[い-adj]+ noun",
          "とても",
          "あまり〜",
          "〜はどうですか"
        ],
        "task": "tugas-bunpou-bab-6-lanjutan",
        "taskTitle": "Tugas Bunpou Bab 6: Penggunaan Kata Sifat い",
        "taskPatterns": [
          "[い-adj]+ 名詞",
          "とても／あまり",
          "〜はどうですか"
        ]
      }
    ]
  },
  {
    "bab": 7,
    "design": "DAHIUTPqAoI",
    "parts": [
      {
        "slug": "bunpou1-n5-b7",
        "title": null,
        "slides": "2–4",
        "patterns": [
          "〜は[Kata Sifat な]です",
          "Kata Sifat な＋Kata Benda",
          "〜は[Kata Sifat な]じゃありません。"
        ],
        "task": "tugas-bunpou-bab-7-bentuk-dasar",
        "taskTitle": null,
        "taskPatterns": [
          "〜は[Kata Sifat な]です",
          "Kata Sifat な＋Kata Benda",
          "[な-adj]じゃありません"
        ]
      },
      {
        "slug": "bunpou2-n5-b7",
        "title": null,
        "slides": "5–7",
        "patterns": [
          "Hal +が　好き/嫌い/上手/下手",
          "〜で〜くて",
          "Kata Sifat な＋でした/じゃありませんでした"
        ],
        "task": "tugas-bunpou-bab-7-lanjutan",
        "taskTitle": null,
        "taskPatterns": [
          "〜が好き／嫌い／上手／下手",
          "〜くて／〜で",
          "〜でした／〜じゃありませんでした"
        ]
      }
    ]
  },
  {
    "bab": 8,
    "design": "DAHIUjljrYk",
    "parts": [
      {
        "slug": "bunpou1-n5-b8",
        "title": "Keberadaan & Lokasi (〜に〜が・〜は〜にあります／います)",
        "slides": "2–3",
        "patterns": [
          "〜に〜があります／います",
          "〜は〜にあります／います",
          "ここ/そこ/あそこ",
          "こちら/そちら/あちら",
          "Kata Benda はTempat です"
        ],
        "task": "tugas-bunpou-bab-8-ada-di-mana",
        "taskTitle": "Tugas Bunpou Bab 8: Keberadaan & Lokasi",
        "taskPatterns": [
          "〜に〜があります／います",
          "〜は〜にあります／います"
        ]
      },
      {
        "slug": "bunpou2-n5-b8",
        "title": "Tanya Lokasi & Posisi (どこ・どちら・の上／下／前／後ろ／隣)",
        "slides": "4–5",
        "patterns": [
          "どこに〜がありますか",
          "どこ/どちら",
          "Kata benda 1( benda/orang tempat) の Kata benda 2 (posisi)"
        ],
        "task": "tugas-bunpou-bab-8-posisi-relatif",
        "taskTitle": "Tugas Bunpou Bab 8: Tanya Lokasi & Posisi",
        "taskPatterns": [
          "どこに〜がありますか",
          "[noun]の[position]"
        ]
      }
    ]
  },
  {
    "bab": 9,
    "design": "DAHIUou3MDw",
    "parts": [
      {
        "slug": "bunpou1-n5-b9",
        "title": "Arah & Transportasi (へ行きます／来ます／帰ります・で)",
        "slides": "2–3",
        "patterns": [
          "〜へ行きます／来ます／帰ります",
          "Kendaraan で　へ行きます／来ます／帰ります",
          "〜で行きます"
        ],
        "task": "tugas-bunpou-bab-9-pergi-datang-pulang",
        "taskTitle": "Tugas Bunpou Bab 9: Arah & Transportasi",
        "taskPatterns": [
          "〜へ行きます／来ます／帰ります",
          "〜で行きます"
        ]
      },
      {
        "slug": "bunpou2-n5-b9",
        "title": "Rute & Detail Perjalanan (から〜まで・いつ／どこへ／だれと)",
        "slides": "4–5",
        "patterns": [
          "〜から〜まで",
          "いつ／どこへ／だれと"
        ],
        "task": "tugas-bunpou-bab-9-rencana-perjalanan",
        "taskTitle": "Tugas Bunpou Bab 9: Rute & Detail Perjalanan",
        "taskPatterns": [
          "〜から〜まで",
          "いつ／どこへ／だれと"
        ]
      }
    ]
  },
  {
    "bab": 10,
    "design": "DAHIaKiXdGo",
    "parts": [
      {
        "slug": "bunpou1-n5-b10",
        "title": "Objek & Bentuk Kata Kerja Sopan (を・ます／ません／ました／ませんでした)",
        "slides": "2–5",
        "patterns": [
          "〜を[verb]ます",
          "[verb]ません",
          "[verb]ました",
          "[verb]ませんでした"
        ],
        "task": "tugas-bunpou-bab-10-bentuk-kini",
        "taskTitle": "Tugas Bunpou Bab 10: Objek & Bentuk Kata Kerja Sopan",
        "taskPatterns": [
          "〜を[verb]ます",
          "[verb]ません",
          "[verb]ました",
          "[verb]ませんでした"
        ]
      },
      {
        "slug": "bunpou2-n5-b10",
        "title": "Frekuensi Kegiatan (毎日・いつも・時々・よく・ぜんぜん)",
        "slides": "6–7",
        "patterns": [
          "毎日／いつも／時々",
          "よく／ぜんぜん"
        ],
        "task": "tugas-bunpou-bab-10-bentuk-lampau-frekuensi",
        "taskTitle": "Tugas Bunpou Bab 10: Frekuensi Kegiatan",
        "taskPatterns": [
          "毎日／いつも／時々",
          "よく／ぜんぜん"
        ]
      }
    ],
    "add": [
      {
        "pattern": "よく／ぜんぜん",
        "meaning": "よく = sering; ぜんぜん + bentuk negatif = sama sekali tidak.",
        "notes": "よく menjelaskan seberapa sering kegiatan dilakukan. Untuk makna sama sekali tidak, pasangkan ぜんぜん dengan bentuk negatif seperti ません. Bandingkan あまり + negatif (tidak terlalu sering).",
        "examples": [
          [
            "よく本を読みます。",
            "よく",
            "Saya sering membaca buku."
          ],
          [
            "ぜんぜんテレビを見ません。",
            "ぜんぜん",
            "Saya sama sekali tidak menonton televisi."
          ]
        ],
        "instruction": "Buat satu kalimat tentang kebiasaanmu memakai よく, atau ぜんぜん dengan bentuk negatif.",
        "requiredCount": 1
      }
    ]
  },
  {
    "bab": 11,
    "design": "DAHIaI54lOw",
    "parts": [
      {
        "slug": "bunpou1-n5-b11",
        "title": "Jumlah dalam Kalimat (を＋Jumlah＋Kata Kerja・が＋Jumlah＋あります／います)",
        "slides": "2–3",
        "patterns": [
          "〜を[counter]+[verb]",
          "[counter]+ あります／います"
        ],
        "task": "tugas-bunpou-bab-11-counter-kudasai",
        "taskTitle": "Tugas Bunpou Bab 11: Jumlah dalam Kalimat",
        "taskPatterns": [
          "〜を[counter]+[verb]",
          "[counter]+ あります／います"
        ]
      },
      {
        "slug": "bunpou2-n5-b11",
        "title": "Tanya Jumlah & Hitungan Umum (いくつ／何人／何枚・ひとつ〜とお)",
        "slides": "4–5",
        "patterns": [
          "いくつ／何人／何枚",
          "Native counters"
        ],
        "task": "tugas-bunpou-bab-11-tanya-jumlah-hitung-asli",
        "taskTitle": "Tugas Bunpou Bab 11: Tanya Jumlah & Hitungan Umum",
        "taskPatterns": [
          "いくつ／何人／何枚",
          "Native counters"
        ]
      }
    ]
  },
  {
    "bab": 12,
    "design": "DAHIaNCdSZ8",
    "parts": [
      {
        "slug": "tata-bahasa-bab-12-konjugasi-te-form",
        "title": "Konjugasi Bentuk Te (Golongan 1・Golongan 2・する／来る)",
        "slides": "2–4",
        "patterns": [
          "Te-form Golongan 1 (u-verbs)",
          "Te-form Golongan 2 (ru-verbs)",
          "Te-form Tidak Beraturan"
        ]
      },
      {
        "slug": "tata-bahasa-bab-12-menghubungkan-kalimat-te-form",
        "title": "Menghubungkan & Mengurutkan Tindakan (〜て、〜・〜てから)",
        "slides": "5–6",
        "patterns": [
          "〜て、〜",
          "〜てから"
        ]
      }
    ]
  },
  {
    "bab": 13,
    "design": "DAHIaY00L-c",
    "parts": [
      {
        "slug": "tata-bahasa-bab-13-progresif-permintaan",
        "title": "Permintaan & Tindakan atau Keadaan (てください・てくれませんか・ています)",
        "slides": "2–4",
        "patterns": [
          "〜てください",
          "〜てくれませんか",
          "〜ています"
        ],
        "task": "tugas-bunpou-bab-13-progresif-permintaan",
        "taskTitle": "Tugas Bunpou Bab 13: Permintaan & Tindakan atau Keadaan",
        "taskPatterns": [
          "〜てください",
          "〜てくれませんか",
          "〜ています"
        ]
      },
      {
        "slug": "tata-bahasa-bab-13-izin-larangan",
        "title": "Izin & Larangan (〜てもいいですか・〜てはいけません)",
        "slides": "5–6",
        "patterns": [
          "〜てもいいですか",
          "〜てはいけません"
        ],
        "task": "tugas-bunpou-bab-13-izin-larangan",
        "taskTitle": null,
        "taskPatterns": [
          "〜てもいいですか",
          "〜てはいけません"
        ]
      }
    ]
  },
  {
    "bab": 14,
    "design": "DAHIaraizng",
    "parts": [
      {
        "slug": "tata-bahasa-bab-14-bentuk-nai-kewajiban",
        "title": "Bentuk Biasa Kata Kerja (Kamus・ない・た・なかった)",
        "slides": "2–5",
        "patterns": [
          "[V-jisho] (Bentuk Kamus)",
          "Nai-form (konjugasi)",
          "[V-ta] (Lampau Plain)",
          "[V-nakatta]"
        ],
        "task": "tugas-bunpou-bab-14-bentuk-nai-kewajiban",
        "taskTitle": "Tugas Bunpou Bab 14: Bentuk Biasa Kata Kerja",
        "taskPatterns": [
          "[V-jisho] (Bentuk Kamus)",
          "Nai-form (konjugasi)",
          "[V-ta] (Lampau Plain)",
          "[V-nakatta]"
        ]
      },
      {
        "slug": "tata-bahasa-bab-14-bentuk-plain",
        "title": "Permintaan Negatif & Kewajiban (ないでください・なければなりません・なくてもいいです)",
        "slides": "6–8",
        "patterns": [
          "〜ないでください",
          "〜なければなりません",
          "〜なくてもいいです"
        ],
        "task": "tugas-bunpou-bab-14-bentuk-plain",
        "taskTitle": "Tugas Bunpou Bab 14: Permintaan Negatif & Kewajiban",
        "taskPatterns": [
          "〜ないでください",
          "〜なければなりません",
          "〜なくてもいいです"
        ]
      }
    ]
  },
  {
    "bab": 15,
    "design": "DAHIarcze4k",
    "parts": [
      {
        "slug": "tata-bahasa-bab-15-bahasa-pelayanan",
        "title": "Ungkapan Pelayanan (お願いします・いかがですか・になります・お〜ください)",
        "slides": "2–5",
        "patterns": [
          "〜を[counter]お願いします",
          "〜はいかがですか",
          "〜になります (keigo)",
          "お〜ください"
        ]
      },
      {
        "slug": "tata-bahasa-bab-15-memutuskan-perubahan",
        "title": "Pilihan & Perubahan (〜にします・〜くなります／〜になります)",
        "slides": "6–7",
        "patterns": [
          "〜にします",
          "〜くなります／〜になります"
        ]
      }
    ]
  },
  {
    "bab": 16,
    "design": "DAHIgQ0X55w",
    "parts": [
      {
        "slug": "tata-bahasa-bab-16-partikel-waktu-tanggal",
        "title": "Waktu & Tanggal (〜に・〜月〜日)",
        "slides": "2–3",
        "patterns": [
          "〜に[verb]",
          "〜月〜日"
        ],
        "task": "tugas-bunpou-bab-16-partikel-waktu-tanggal",
        "taskTitle": null,
        "taskPatterns": [
          "〜に[verb]",
          "〜月〜日"
        ]
      },
      {
        "slug": "tata-bahasa-bab-16-frekuensi-bertanya-waktu",
        "title": "Tanya Jadwal & Kegiatan Berkala (いつ／何曜日／何月何日・毎週／毎月／毎年)",
        "slides": "4–5",
        "patterns": [
          "何曜日／何月何日／いつ",
          "毎週／毎月／毎年"
        ],
        "task": "tugas-bunpou-bab-16-frekuensi-bertanya-waktu",
        "taskTitle": "Tugas Bunpou Bab 16: Tanya Jadwal & Kegiatan Berkala",
        "taskPatterns": [
          "何曜日／何月何日／いつ",
          "毎週／毎月／毎年"
        ]
      }
    ]
  },
  {
    "bab": 17,
    "design": "DAHIgYU9n14",
    "parts": [
      {
        "slug": "tata-bahasa-bab-17-suka-mahir",
        "title": "Kesukaan & Kemahiran (が好き／嫌い・が上手／下手)",
        "slides": "2–3",
        "patterns": [
          "〜が好きです／嫌いです",
          "〜が上手です／下手です"
        ]
      },
      {
        "slug": "tata-bahasa-bab-17-kemampuan-bertanya-jenis",
        "title": "Kemampuan & Tanya Jenis (〜ができます・どんな〜)",
        "slides": "4–5",
        "patterns": [
          "〜ができます",
          "どんな〜"
        ]
      }
    ]
  },
  {
    "bab": 18,
    "design": "DAHImOpwujY",
    "parts": [
      {
        "slug": "tata-bahasa-bab-18-membandingkan-dua-hal",
        "title": "Membandingkan Dua Hal (AはBより・AよりBのほうが)",
        "slides": "2–3",
        "patterns": [
          "AはBより〜です",
          "AよりBのほうが〜"
        ]
      },
      {
        "slug": "tata-bahasa-bab-18-superlatif",
        "title": "Tanya Perbandingan & Paling (どちらが・〜の中で〜が一番)",
        "slides": "4–5",
        "patterns": [
          "AとBとどちらが〜",
          "〜の中で〜が一番〜"
        ]
      }
    ]
  },
  {
    "bab": 19,
    "design": "DAHImAhiKkU",
    "parts": [
      {
        "slug": "tata-bahasa-bab-19-keinginan",
        "title": "Menyatakan Keinginan (〜たい・〜たくない・〜が欲しい)",
        "slides": "2–4",
        "patterns": [
          "〜たいです",
          "〜たくないです",
          "[noun]が欲しいです"
        ]
      },
      {
        "slug": "tata-bahasa-bab-19-rencana-ajakan",
        "title": "Niat, Rencana & Ajakan (つもり・予定・ましょう／ませんか)",
        "slides": "5–7",
        "patterns": [
          "〜つもりです",
          "〜予定です",
          "〜ましょう／ませんか"
        ]
      }
    ]
  },
  {
    "bab": 20,
    "design": "DAHImSg0qdQ",
    "parts": [
      {
        "slug": "tata-bahasa-bab-20-pengalaman",
        "title": "Pengalaman (〜たことがあります／ありません)",
        "slides": "2–3",
        "patterns": [
          "〜たことがあります",
          "〜たことがありません"
        ]
      },
      {
        "slug": "tata-bahasa-bab-20-penghubung-kalimat",
        "title": "Alasan & Penghubung Kalimat (から・が・そして／それから／でも)",
        "slides": "4–6",
        "patterns": [
          "〜から (sebab)",
          "〜が、〜",
          "そして／それから／でも"
        ]
      }
    ]
  }
]$plan$::jsonb;
  chapter JSONB; part JSONB; addition JSONB; ex JSONB;
  pat RECORD; grammar_row RECORD;
  module_id UUID; lesson_id UUID; task_id UUID; grammar_id UUID;
  lesson_ids UUID[]; task_ids UUID[];
  matches INT; idx INT;
BEGIN
  -- A manual replay must not overwrite later admin changes or its backup.
  IF EXISTS (SELECT 1 FROM n5_bunpou_canva_backup_169) THEN
    RAISE NOTICE '169: already aligned; retaining original backup';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM courses WHERE slug = 'n5') THEN
    RAISE NOTICE '169: no N5 course; nothing to align';
    RETURN;
  END IF;

  FOR chapter IN SELECT value FROM jsonb_array_elements(plan) LOOP
    -- Resolve by existing lesson slug and course, never by module OFFSET.
    SELECT count(*), (array_agg(l.module_id))[1] INTO matches, module_id
      FROM lessons l JOIN modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE c.slug = 'n5' AND l.slug = chapter->'parts'->0->>'slug';
    IF matches <> 1 THEN
      RAISE EXCEPTION '169: Bab % expected one source lesson; found %', chapter->>'bab', matches;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM modules m WHERE m.id = module_id
      AND m.title ~* ('^BAB\s*' || (chapter->>'bab') || '\s*[:：]')) THEN
      RAISE EXCEPTION '169: chapter title does not match Bab %', chapter->>'bab';
    END IF;

    lesson_ids := ARRAY[]::UUID[]; task_ids := ARRAY[]::UUID[];
    FOR part IN SELECT value FROM jsonb_array_elements(chapter->'parts') LOOP
      SELECT count(*), (array_agg(l.id))[1] INTO matches, lesson_id
        FROM lessons l WHERE l.module_id = module_id AND l.slug = part->>'slug'
        AND l.type IN ('video', 'text');
      IF matches <> 1 THEN RAISE EXCEPTION '169: missing/ambiguous teaching lesson %', part->>'slug'; END IF;
      lesson_ids := array_append(lesson_ids, lesson_id);
      IF part ? 'task' THEN
        SELECT count(*), (array_agg(l.id))[1] INTO matches, task_id
          FROM lessons l WHERE l.module_id = module_id AND l.slug = part->>'task' AND l.type = 'grammar_task';
        IF matches <> 1 THEN RAISE EXCEPTION '169: missing/ambiguous task %', part->>'task'; END IF;
        task_ids := array_append(task_ids, task_id);
      END IF;
    END LOOP;

    INSERT INTO n5_bunpou_canva_backup_169(entity, key, before_data)
      SELECT 'lesson', l.id::text, jsonb_build_object('title', l.title, 'content', l.content)
      FROM lessons l WHERE l.id = ANY(lesson_ids || task_ids);
    INSERT INTO n5_bunpou_canva_backup_169(entity, key, before_data)
      SELECT 'grammar', g.id::text, jsonb_build_object('lesson_id', g.lesson_id, 'sort_order', g.sort_order)
      FROM module_grammar g WHERE g.module_id = module_id;
    INSERT INTO n5_bunpou_canva_backup_169(entity, key, before_data)
      SELECT 'task_item', gi.lesson_id::text || '/' || gi.grammar_id::text, to_jsonb(gi)
      FROM lesson_grammar_task_items gi WHERE gi.lesson_id = ANY(task_ids);

    -- Restore only the missing Bab 10 frequency point; never replace existing
    -- grammar/examples, including manually authored alternatives and audio.
    FOR addition IN SELECT value FROM jsonb_array_elements(COALESCE(chapter->'add', '[]'::jsonb)) LOOP
      SELECT count(*), (array_agg(g.id))[1] INTO matches, grammar_id
        FROM module_grammar g WHERE g.module_id = module_id AND g.pattern = addition->>'pattern';
      IF matches > 1 THEN RAISE EXCEPTION '169: ambiguous added pattern %', addition->>'pattern'; END IF;
      IF matches = 0 THEN
        INSERT INTO module_grammar(module_id, pattern, meaning, notes, example)
          VALUES (module_id, addition->>'pattern', addition->>'meaning', addition->>'notes', addition->'examples'->0->>0)
          RETURNING id INTO grammar_id;
        INSERT INTO n5_bunpou_canva_backup_169(entity, key, before_data)
          VALUES ('new_grammar', grammar_id::text, NULL);
        idx := 0;
        FOR ex IN SELECT value FROM jsonb_array_elements(addition->'examples') LOOP
          INSERT INTO grammar_examples(grammar_id, japanese, highlight, indonesian, sort_order)
            VALUES (grammar_id, ex->>0, ex->>1, ex->>2, idx);
          idx := idx + 1;
        END LOOP;
      END IF;
    END LOOP;

    FOR part IN SELECT value FROM jsonb_array_elements(chapter->'parts') LOOP
      SELECT l.id INTO STRICT lesson_id FROM lessons l WHERE l.module_id = module_id AND l.slug = part->>'slug';
      IF part->>'title' IS NOT NULL THEN
        UPDATE lessons l SET title = part->>'title', updated_at = NOW() WHERE l.id = lesson_id;
      END IF;
      FOR pat IN SELECT value #>> '{}' AS pattern, ordinality::int - 1 AS position
        FROM jsonb_array_elements(part->'patterns') WITH ORDINALITY LOOP
        -- Several live chapters have a separate task-bank card with the
        -- same label. Prefer the already attached teaching card; restore
        -- an orphan only when no teaching card exists. Never pick randomly.
        SELECT count(*), (array_agg(mg.id))[1] INTO matches, grammar_id
          FROM module_grammar mg WHERE mg.module_id = module_id AND mg.pattern = pat.pattern
          AND mg.lesson_id = ANY(lesson_ids);
        IF matches = 0 THEN
          SELECT count(*), (array_agg(mg.id))[1] INTO matches, grammar_id
            FROM module_grammar mg WHERE mg.module_id = module_id AND mg.pattern = pat.pattern AND mg.lesson_id IS NULL;
        END IF;
        IF matches <> 1 THEN RAISE EXCEPTION '169: Bab % missing/ambiguous pattern %', chapter->>'bab', pat.pattern; END IF;
        SELECT * INTO STRICT grammar_row FROM module_grammar mg WHERE mg.id = grammar_id;
        IF grammar_row.lesson_id IS NOT NULL AND NOT grammar_row.lesson_id = ANY(lesson_ids) THEN
          RAISE EXCEPTION '169: pattern % belongs to another lesson; review before moving', pat.pattern;
        END IF;
        UPDATE module_grammar mg SET lesson_id = lesson_id, sort_order = pat.position WHERE mg.id = grammar_row.id;
      END LOOP;

      IF part ? 'task' THEN
        SELECT l.id INTO STRICT task_id FROM lessons l WHERE l.module_id = module_id AND l.slug = part->>'task';
        IF part->>'taskTitle' IS NOT NULL THEN
          UPDATE lessons l SET title = part->>'taskTitle',
            content = 'Latih pola yang telah dipelajari pada subbab ini: ' ||
              (SELECT string_agg(value, '、' ORDER BY ordinality) FROM jsonb_array_elements_text(part->'taskPatterns') WITH ORDINALITY) ||
              '. Ikuti instruksi pada setiap pola.', updated_at = NOW() WHERE l.id = task_id;
        END IF;
        FOR pat IN SELECT value #>> '{}' AS pattern, ordinality::int - 1 AS position
          FROM jsonb_array_elements(part->'taskPatterns') WITH ORDINALITY LOOP
          -- Resolve through the current task membership first. Teacher and
          -- task cards can intentionally be distinct rows with the same name.
          SELECT count(*), (array_agg(gi.grammar_id))[1] INTO matches, grammar_id
            FROM lesson_grammar_task_items gi JOIN module_grammar mg ON mg.id = gi.grammar_id
            WHERE gi.lesson_id = ANY(task_ids) AND mg.module_id = module_id AND mg.pattern = pat.pattern;
          IF matches = 1 THEN
            UPDATE lesson_grammar_task_items gi SET lesson_id = task_id, sort_order = pat.position
              WHERE gi.lesson_id = ANY(task_ids) AND gi.grammar_id = grammar_id;
          ELSIF matches = 0 AND EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(chapter->'add', '[]')) a
            WHERE a->>'pattern' = pat.pattern AND a ? 'instruction') THEN
            SELECT mg.id INTO STRICT grammar_id FROM module_grammar mg WHERE mg.module_id = module_id AND mg.pattern = pat.pattern;
            SELECT a INTO addition FROM jsonb_array_elements(chapter->'add') a WHERE a->>'pattern' = pat.pattern;
            INSERT INTO lesson_grammar_task_items(lesson_id, grammar_id, sort_order, instruction, required_count)
              VALUES (task_id, grammar_id, pat.position, addition->>'instruction', (addition->>'requiredCount')::int);
          ELSE
            RAISE EXCEPTION '169: Bab % missing/ambiguous task pattern %', chapter->>'bab', pat.pattern;
          END IF;
        END LOOP;
      END IF;
    END LOOP;

    -- Membership updates retain every old task card and its instructions.
    -- Reject unexpected cards rather than silently dropping admin additions.
    IF EXISTS (SELECT 1 FROM lesson_grammar_task_items gi JOIN module_grammar mg ON mg.id = gi.grammar_id
      JOIN lessons l ON l.id = gi.lesson_id WHERE gi.lesson_id = ANY(task_ids)
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(chapter->'parts') p
        WHERE p->>'task' = l.slug AND (p->'taskPatterns') ? mg.pattern)) THEN
      RAISE EXCEPTION '169: Bab % has additional task cards; reconcile explicitly', chapter->>'bab';
    END IF;
    RAISE NOTICE '169: aligned Bab % with Canva %', chapter->>'bab', chapter->>'design';
  END LOOP;

  UPDATE n5_bunpou_canva_backup_169 b SET after_data = jsonb_build_object('title', l.title, 'content', l.content)
    FROM lessons l WHERE b.entity = 'lesson' AND b.key = l.id::text;
  UPDATE n5_bunpou_canva_backup_169 b SET after_data = jsonb_build_object('lesson_id', g.lesson_id, 'sort_order', g.sort_order)
    FROM module_grammar g WHERE b.entity IN ('grammar', 'new_grammar') AND b.key = g.id::text;
  -- Record the result as separate rows because the task composite key moved.
  INSERT INTO n5_bunpou_canva_backup_169(entity, key, after_data)
    SELECT 'task_result', gi.lesson_id::text || '/' || gi.grammar_id::text, to_jsonb(gi)
    FROM lesson_grammar_task_items gi
    WHERE EXISTS (SELECT 1 FROM n5_bunpou_canva_backup_169 b
      JOIN lessons l ON l.id::text = b.key WHERE b.entity = 'lesson' AND l.type = 'grammar_task' AND l.id = gi.lesson_id);
END;
$alignment$;
