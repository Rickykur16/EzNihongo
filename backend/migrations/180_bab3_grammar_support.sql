-- Curated support for the six EXISTING Bab 3 grammar points.
-- Core pattern/meaning, IDs, lesson membership, vocabulary and kanji are retained.
-- Source: backend/content/bab3/grammar-support.json (embedded verbatim below).
-- The runner wraps this migration in one transaction. Backups also make a manual
-- re-run preserve subsequent teacher edits rather than replaying this content.
ALTER TABLE module_grammar ADD COLUMN IF NOT EXISTS practice_config JSONB;

CREATE TABLE IF NOT EXISTS n5_b3_grammar_support_backup_180 (
  grammar_id UUID PRIMARY KEY,
  before_grammar JSONB NOT NULL,
  before_examples JSONB NOT NULL,
  before_task_items JSONB NOT NULL,
  before_dialog_questions JSONB NOT NULL,
  after_grammar JSONB,
  after_examples JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS n5_b3_grammar_lessons_backup_180 (
  lesson_id UUID PRIMARY KEY,
  before_lesson JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $support$
DECLARE
  plan JSONB := $content${
  "version": "n5-b3-support-v1",
  "course": "n5",
  "module": "n5-b3",
  "objective": "Perkenalkan diri, tanyakan identitas, dan luruskan dugaan sederhana dengan pola Bab 3.",
  "items": [
    {
      "key": "identity",
      "lesson": "bunpou-n5-b3",
      "task": "tesbunpou1-n5-b3",
      "pattern": "〜は〜です",
      "notes": "Pola: A は B です. A adalah orang yang dibicarakan; B menyebut nama, kewarganegaraan, atau pekerjaan. は ditulis ha tetapi dibaca wa. です membuat pernyataan ini sopan. Pada nama sendiri, jangan tambahkan さん. Jika orang yang dibicarakan sudah jelas, nama atau わたしは dapat dihilangkan, seperti ハディです dalam dialog.",
      "examples": [
        { "japanese": "わたしは アンナです。", "highlight": "です", "indonesian": "Saya Anna." },
        { "japanese": "ハディさんは エンジニアです。", "highlight": "です", "indonesian": "Hadi seorang insinyur." },
        { "japanese": "わたしは インドネシアじんです。", "highlight": "です", "indonesian": "Saya orang Indonesia." },
        { "japanese": "ちちは いしゃです。", "highlight": "です", "indonesian": "Ayah saya dokter." }
      ],
      "dialogue": {
        "situation": "Anna dan Hadi baru berkenalan. Mereka menyebut nama, kewarganegaraan, dan profesi.",
        "japanese": "A: はじめまして。わたしはアンナです。\nB: はじめまして。ハディです。\nA: わたしはインドネシアじんです。がくせいです。\nB: わたしはインドネシアじんです。エンジニアです。\nA: どうぞよろしくおねがいします。\nB: こちらこそ、どうぞよろしくおねがいします。",
        "indonesian": "A: Salam kenal. Saya Anna.\nB: Salam kenal. Saya Hadi.\nA: Saya orang Indonesia. Saya pelajar.\nB: Saya orang Indonesia. Saya insinyur.\nA: Senang berkenalan dengan Anda.\nB: Saya juga senang berkenalan dengan Anda."
      },
      "direction": "Anna dan Hadi baru berkenalan. Dengarkan nama dan profesi masing-masing. Pada がくせいです dan ハディです, siapa yang dibicarakan sudah jelas sehingga わたしは tidak diulang.",
      "taskInstruction": "Kartu peran: Anda bernama リナ (Rina) dan berprofesi いしゃ (dokter). Buat satu kalimat sopan yang menyatakan profesi Anda dengan は…です.",
      "recognitionDistractors": ["Menyangkal identitas seseorang.", "Menanyakan identitas seseorang.", "Menyatakan kesamaan identitas."],
      "controlledDistractors": ["じゃありません", "ですか", "の"],
      "drills": {
        "recognition": {
          "prompt": "Apa yang disampaikan Anna melalui kalimat ini?",
          "example": { "japanese": "わたしは アンナです。", "indonesian": "Saya Anna." },
          "options": ["Menyebutkan namanya.", "Menanyakan nama lawan bicara.", "Menyangkal nama yang disebutkan."],
          "answer": "Menyebutkan namanya."
        },
        "controlled": {
          "prompt": "Kartu peran: Anda pelajar. Lengkapi pernyataan sesuai kartu.",
          "sentence": "わたしは がくせい＿＿＿。",
          "indonesian": "Saya pelajar.",
          "options": ["です", "じゃありません", "ですか"],
          "answer": "です"
        }
      },
      "dialogChecks": {
        "comprehension": { "prompt": "Apa profesi Hadi dalam perkenalan ini?", "options": ["Insinyur", "Pelajar", "Dokter"], "correctIndex": 0, "explanation": "Hadi menyatakan エンジニアです. Anna yang menyebut dirinya pelajar.", "evidence": [{ "turnIndex": 3, "quote": "エンジニアです" }] },
        "comparison": { "prompt": "Anda bernama Rina. Pilih kalimat untuk memperkenalkan nama sendiri.", "options": ["わたしは リナです。", "わたしは リナさんです。", "リナさんは がくせいです。"], "correctIndex": 0, "explanation": "Untuk menyebut nama sendiri, gunakan わたしは リナです. さん dipakai untuk menyebut orang lain dalam konteks perkenalan ini." }
      }
    },
    {
      "key": "negation",
      "lesson": "bunpou-n5-b3",
      "task": "tesbunpou1-n5-b3",
      "pattern": "〜は〜じゃ／ではありません",
      "notes": "Pola: A は B じゃありません／ではありません. Artinya A bukan B. Keduanya sopan; ではありません lebih formal. Gunakan setelah kata benda, seperti がくせい. Untuk meluruskan dugaan, awali dengan いいえ, sangkal informasi yang keliru, lalu sebutkan informasi yang benar dengan です.",
      "examples": [
        { "japanese": "わたしは がくせいじゃありません。", "highlight": "じゃありません", "indonesian": "Saya bukan pelajar." },
        { "japanese": "ハディさんは にほんじんじゃありません。", "highlight": "じゃありません", "indonesian": "Hadi bukan orang Jepang." },
        { "japanese": "ははは かんごしではありません。", "highlight": "ではありません", "indonesian": "Ibu saya bukan perawat." },
        { "japanese": "いいえ、 せんせいじゃありません。いしゃです。", "highlight": "じゃありません", "indonesian": "Bukan, saya bukan guru. Saya dokter." }
      ],
      "dialogue": {
        "situation": "Anna ingin mengetahui identitas Hadi. Hadi meluruskan dua dugaan yang keliru.",
        "japanese": "A: ハディさんはがくせいですか。\nB: いいえ、がくせいじゃありません。エンジニアです。\nA: にほんじんですか。\nB: いいえ、にほんじんじゃありません。インドネシアじんです。",
        "indonesian": "A: Apakah Hadi pelajar?\nB: Bukan, saya bukan pelajar. Saya insinyur.\nA: Apakah Anda orang Jepang?\nB: Bukan, saya bukan orang Jepang. Saya orang Indonesia."
      },
      "direction": "Anna bertanya tentang profesi dan kewarganegaraan Hadi. Dengarkan informasi yang disangkal setelah いいえ, lalu informasi yang benar pada kalimat sesudahnya.",
      "taskInstruction": "Kartu peran: Anda いしゃ (dokter). Teman mengira Anda かんごし (perawat). Buat satu respons singkat: sangkal dugaan itu dengan じゃありません atau ではありません, lalu sebutkan profesi Anda yang benar dengan です.",
      "recognitionDistractors": ["Menyatakan identitas seseorang.", "Menanyakan identitas seseorang.", "Menyatakan kesamaan identitas."],
      "controlledDistractors": ["です", "ですか", "ですよ"],
      "drills": {
        "recognition": {
          "prompt": "Informasi mana yang sesuai dengan jawaban ini?",
          "example": { "japanese": "いいえ、がくせいじゃありません。エンジニアです。", "indonesian": "Bukan, saya bukan pelajar. Saya insinyur." },
          "options": ["Penutur insinyur dan menyangkal sebagai pelajar.", "Penutur pelajar dan menyangkal sebagai insinyur.", "Penutur menanyakan profesi lawan bicara."],
          "answer": "Penutur insinyur dan menyangkal sebagai pelajar."
        },
        "controlled": {
          "prompt": "Anda dokter. Lengkapi jawaban untuk meluruskan dugaan bahwa Anda perawat.",
          "sentence": "いいえ、かんごし＿＿＿。いしゃです。",
          "indonesian": "Bukan, saya bukan perawat. Saya dokter.",
          "options": ["じゃありません", "です", "ですか"],
          "answer": "じゃありません"
        }
      },
      "dialogChecks": {
        "comprehension": { "prompt": "Setelah menyangkal sebagai orang Jepang, Hadi menyatakan bahwa ia orang mana?", "options": ["Indonesia", "Jepang", "Australia"], "correctIndex": 0, "explanation": "Hadi berkata にほんじんじゃありません lalu インドネシアじんです.", "evidence": [{ "turnIndex": 3, "quote": "にほんじんじゃありません。インドネシアじんです" }] },
        "comparison": { "prompt": "Anda pelajar. Teman mengira Anda guru. Pilih respons yang meluruskan dugaan itu.", "options": ["いいえ、せんせいじゃありません。がくせいです。", "はい、せんせいです。", "いいえ、がくせいじゃありません。せんせいです。"], "correctIndex": 0, "explanation": "Sangkal profesi guru yang keliru, kemudian nyatakan profesi pelajar yang sesuai kartu." }
      }
    },
    {
      "key": "question",
      "lesson": "bunpou-n5-b3",
      "task": "tesbunpou1-n5-b3",
      "pattern": "〜ですか",
      "notes": "Pola: A は B ですか. Tambahkan か setelah です untuk menanyakan identitas yang belum diketahui. Jawab はい jika benar atau いいえ jika tidak, lalu sebutkan informasi yang sesuai. Jika orang yang dibicarakan sudah jelas, pertanyaan cukup berbentuk がくせいですか. Dalam tulisan Jepang, 。 dapat dipakai di akhir pertanyaan ini.",
      "examples": [
        { "japanese": "アンナさんは がくせいですか。", "highlight": "ですか", "indonesian": "Apakah Anna pelajar?" },
        { "japanese": "ハディさんは インドネシアじんですか。", "highlight": "ですか", "indonesian": "Apakah Hadi orang Indonesia?" },
        { "japanese": "おしごとは なんですか。", "highlight": "ですか", "indonesian": "Apa pekerjaan Anda?" },
        { "japanese": "おなまえは なんですか。", "highlight": "ですか", "indonesian": "Siapa nama Anda?" }
      ],
      "dialogue": {
        "situation": "Anna dan Hadi saling menanyakan profesi dan kewarganegaraan.",
        "japanese": "A: ハディさんはエンジニアですか。\nB: はい、エンジニアです。アンナさんはインドネシアじんですか。\nA: はい、インドネシアじんです。\nB: がくせいですか。\nA: はい、がくせいです。",
        "indonesian": "A: Apakah Hadi insinyur?\nB: Ya, saya insinyur. Apakah Anna orang Indonesia?\nA: Ya, saya orang Indonesia.\nB: Apakah Anda pelajar?\nA: Ya, saya pelajar."
      },
      "direction": "Anna dan Hadi bergantian bertanya. Dengarkan siapa yang ditanya dan apa yang ingin diketahui. Pertanyaan terakhir tetap tentang Anna walaupun namanya tidak diulang.",
      "taskInstruction": "Kartu situasi: nama teman Anda サリ (Sari), tetapi profesinya belum diketahui. Buat satu pertanyaan sopan dengan ですか untuk mengetahui apakah Sari seorang がくせい (pelajar).",
      "recognitionDistractors": ["Menyatakan identitas seseorang.", "Menyangkal identitas seseorang.", "Menyatakan kesamaan identitas."],
      "controlledDistractors": ["です", "じゃありません", "ですよ"],
      "drills": {
        "recognition": {
          "prompt": "Apa yang ingin diketahui penutur?",
          "example": { "japanese": "アンナさんは がくせいですか。", "indonesian": "Apakah Anna pelajar?" },
          "options": ["Apakah Anna seorang pelajar.", "Siapa nama Anna.", "Apakah penutur sendiri pelajar."],
          "answer": "Apakah Anna seorang pelajar."
        },
        "controlled": {
          "prompt": "Profesi Sari belum diketahui. Lengkapi pertanyaan apakah ia pelajar.",
          "sentence": "サリさんは がくせい＿＿＿。",
          "indonesian": "Apakah Sari pelajar?",
          "options": ["ですか", "です", "じゃありません"],
          "answer": "ですか"
        }
      },
      "dialogChecks": {
        "comprehension": { "prompt": "Pertanyaan terakhir Hadi menanyakan apa tentang Anna?", "options": ["Apakah Anna pelajar", "Apakah Anna insinyur", "Apakah Anna orang Jepang"], "correctIndex": 0, "explanation": "Hadi bertanya がくせいですか, dan Anna menjawab はい、がくせいです.", "evidence": [{ "turnIndex": 3, "quote": "がくせいですか" }, { "turnIndex": 4, "quote": "はい、がくせいです" }] },
        "comparison": { "prompt": "Teman menanyakan pekerjaan Anda: おしごとはなんですか。 Anda dokter. Pilih respons yang menjawab pertanyaannya.", "options": ["いしゃです。", "リナです。", "はい。"], "correctIndex": 0, "explanation": "Pertanyaan dengan なん meminta informasi pekerjaan. Jawab dengan profesinya; はい saja belum menyebut pekerjaan." }
      }
    },
    {
      "key": "relation",
      "lesson": "bunpou2-n5-b3",
      "task": "tesbunpou2-n5-b3",
      "pattern": "〜の〜",
      "notes": "Pola: A の B. Kata utama adalah B; A menerangkan pemilik atau hubungan yang dimaksud. わたしのなまえ berarti nama saya; さくらだいがくのがくせい berarti mahasiswa Universitas Sakura. にほんごのせんせい berarti guru bahasa Jepang. Bedakan bahasa にほんご dengan kewarganegaraan にほんじん.",
      "examples": [
        { "japanese": "わたしの なまえは アンナです。", "highlight": "の", "indonesian": "Nama saya Anna." },
        { "japanese": "アンナさんは さくらだいがくの がくせいです。", "highlight": "の", "indonesian": "Anna mahasiswa Universitas Sakura." },
        { "japanese": "たなかさんは にほんごの せんせいです。", "highlight": "の", "indonesian": "Tanaka guru bahasa Jepang." },
        { "japanese": "ちちの しごとは いしゃです。", "highlight": "の", "indonesian": "Pekerjaan ayah saya adalah dokter." }
      ],
      "dialogue": {
        "situation": "Hadi menanyakan kampus dan guru bahasa Jepang Anna.",
        "japanese": "B: アンナさんはがくせいですか。\nA: はい、さくらだいがくのがくせいです。\nB: にほんごのせんせいはたなかさんですか。\nA: はい、たなかさんです。",
        "indonesian": "B: Apakah Anna mahasiswa?\nA: Ya, saya mahasiswa Universitas Sakura.\nB: Apakah guru bahasa Jepang Anda Tanaka?\nA: Ya, Tanaka."
      },
      "direction": "Hadi menanyakan kampus dan guru Anna. Perhatikan kata sesudah の: がくせい dan せんせい. Kata sebelumnya menerangkan afiliasi mahasiswa atau bidang yang diajarkan guru.",
      "taskInstruction": "Kartu: リナ (Rina) adalah mahasiswa さくらだいがく (Universitas Sakura). Buat satu kalimat yang menyebutkan hubungan Rina dengan kampusnya memakai の.",
      "recognitionDistractors": ["Menyatakan dua orang memiliki identitas sama.", "Menanyakan kebenaran identitas seseorang.", "Menyangkal informasi tentang seseorang."],
      "controlledDistractors": ["は", "も", "か"],
      "drills": {
        "recognition": {
          "prompt": "Apa hubungan yang dinyatakan oleh の pada kalimat ini?",
          "example": { "japanese": "アンナさんは さくらだいがくの がくせいです。", "indonesian": "Anna mahasiswa Universitas Sakura." },
          "options": ["Anna berstatus mahasiswa Universitas Sakura.", "Anna mengajar di Universitas Sakura.", "Anna bukan mahasiswa Universitas Sakura."],
          "answer": "Anna berstatus mahasiswa Universitas Sakura."
        },
        "controlled": {
          "prompt": "Guru itu mengajarkan bahasa Jepang. Lengkapi frasa yang berarti guru bahasa Jepang.",
          "sentence": "にほんご＿＿＿ せんせい",
          "indonesian": "Guru bahasa Jepang.",
          "options": ["の", "も", "は"],
          "answer": "の"
        }
      },
      "dialogChecks": {
        "comprehension": { "prompt": "Apa hubungan Anna dengan Universitas Sakura?", "options": ["Anna mahasiswa di sana", "Anna guru di sana", "Anna insinyur di sana"], "correctIndex": 0, "explanation": "Anna berkata さくらだいがくのがくせいです, sehingga nama universitas menerangkan afiliasi mahasiswanya.", "evidence": [{ "turnIndex": 1, "quote": "さくらだいがくのがくせいです" }] },
        "comparison": { "prompt": "Anda ingin menyebut nama ayah sendiri. Pilih frasa yang berarti nama ayah saya.", "options": ["ちちの なまえ", "なまえの ちち", "ちちも なまえ"], "correctIndex": 0, "explanation": "Kata utama なまえ berada setelah の. ちち menerangkan nama siapa yang dibicarakan." }
      }
    },
    {
      "key": "addition",
      "lesson": "bunpou2-n5-b3",
      "task": "tesbunpou2-n5-b3",
      "pattern": "〜も〜です",
      "notes": "Pola: A も B です. Gunakan も ketika informasi yang sama berlaku bagi orang lain. Pada pola ini, も menggantikan は. Setelah Anna berkata bahwa ia pelajar, わたしもがくせいです berarti saya juga pelajar. Pastikan informasi yang dibandingkan benar-benar sama: kesamaan negara tidak berarti profesinya juga sama.",
      "examples": [
        { "japanese": "わたしも がくせいです。", "highlight": "も", "indonesian": "Saya juga pelajar. (Konteks: Anna sudah mengatakan bahwa ia pelajar.)" },
        { "japanese": "ハディさんも インドネシアじんです。", "highlight": "も", "indonesian": "Hadi juga orang Indonesia. (Konteks: Saya baru menyebutkan bahwa saya orang Indonesia.)" },
        { "japanese": "ははも いしゃです。", "highlight": "も", "indonesian": "Ibu saya juga dokter. (Konteks: Ayah saya sudah disebutkan sebagai dokter.)" },
        { "japanese": "サリさんも さくらだいがくの がくせいです。", "highlight": "も", "indonesian": "Sari juga mahasiswa Universitas Sakura. (Konteks: Anna sudah disebutkan sebagai mahasiswa Universitas Sakura.)" }
      ],
      "dialogue": {
        "situation": "Anna dan Hadi membandingkan kewarganegaraan serta profesi mereka.",
        "japanese": "A: わたしはインドネシアじんです。\nB: わたしもインドネシアじんです。\nA: わたしはがくせいです。ハディさんもがくせいですか。\nB: いいえ、わたしはがくせいじゃありません。エンジニアです。",
        "indonesian": "A: Saya orang Indonesia.\nB: Saya juga orang Indonesia.\nA: Saya pelajar. Apakah Hadi juga pelajar?\nB: Bukan, saya bukan pelajar. Saya insinyur."
      },
      "direction": "Anna dan Hadi sama-sama orang Indonesia, tetapi profesinya berbeda. Dengarkan informasi yang sama pada jawaban dengan も, lalu alasan Hadi menyangkal pertanyaan tentang profesinya.",
      "taskInstruction": "Kartu: リナ (Rina) seorang いしゃ (dokter), dan Anda juga dokter. Rina baru berkata わたしはいしゃです. Balas dengan satu kalimat yang menyatakan kesamaan profesi Anda memakai も.",
      "recognitionDistractors": ["Menanyakan identitas yang belum diketahui.", "Menyangkal identitas yang disebutkan.", "Menyatakan hubungan pemilik dengan nama."],
      "controlledDistractors": ["は", "の", "か"],
      "drills": {
        "recognition": {
          "prompt": "Anna telah berkata bahwa ia orang Indonesia. Apa yang ditambahkan Hadi melalui も?",
          "example": { "japanese": "わたしも インドネシアじんです。", "indonesian": "Saya juga orang Indonesia." },
          "options": ["Kewarganegaraan Hadi sama dengan Anna.", "Hadi belum mengetahui kewarganegaraan Anna.", "Hadi menyangkal sebagai orang Indonesia."],
          "answer": "Kewarganegaraan Hadi sama dengan Anna."
        },
        "controlled": {
          "prompt": "Rina dokter. Anda juga dokter. Lengkapi respons yang secara jelas menyatakan juga.",
          "sentence": "わたし＿＿＿ いしゃです。",
          "indonesian": "Saya juga dokter.",
          "options": ["も", "は", "の"],
          "answer": "も"
        }
      },
      "dialogChecks": {
        "comprehension": { "prompt": "Persamaan apa yang dinyatakan Anna dan Hadi?", "options": ["Keduanya orang Indonesia", "Keduanya pelajar", "Keduanya insinyur"], "correctIndex": 0, "explanation": "Anna menyatakan インドネシアじんです, lalu Hadi menambahkan わたしもインドネシアじんです. Profesi mereka berbeda.", "evidence": [{ "turnIndex": 0, "quote": "わたしはインドネシアじんです" }, { "turnIndex": 1, "quote": "わたしもインドネシアじんです" }] },
        "comparison": { "prompt": "Ayah Anda dokter. Ibu Anda juga dokter. Pilih kalimat yang secara jelas menyatakan kesamaan profesi ibu.", "options": ["ははも いしゃです。", "ははは いしゃじゃありません。", "ははは いしゃですか。"], "correctIndex": 0, "explanation": "も menyatakan bahwa profesi dokter yang sudah disebutkan juga berlaku bagi ibu." }
      }
    },
    {
      "key": "stance",
      "lesson": "bunpou2-n5-b3",
      "task": "tesbunpou2-n5-b3",
      "pattern": "〜文 + ね／よ",
      "notes": "Tambahkan ね atau よ setelah kalimat lengkap. Pada contoh bab ini, ね memastikan informasi yang sudah didengar, sedangkan よ menandai informasi yang disampaikan kepada lawan bicara, termasuk koreksi. Pilih berdasarkan situasi: ね bukan sekadar hiasan kalimat, dan よ tidak harus selalu diterjemahkan lho. Untuk informasi yang benar-benar belum diketahui, gunakan pertanyaan dengan か.",
      "examples": [
        { "japanese": "ハディさんは エンジニアですね。", "highlight": "ね", "indonesian": "Hadi insinyur, ya. (Memastikan informasi yang sudah didengar.)" },
        { "japanese": "たなかさんも せんせいですね。", "highlight": "ね", "indonesian": "Tanaka juga guru, ya. (Konteks: Yamada guru. Anda sudah mendengar bahwa Tanaka juga guru dan ingin memastikannya.)" },
        { "japanese": "いいえ、 わたしは いしゃですよ。", "highlight": "よ", "indonesian": "Bukan, saya dokter, lho. (Meluruskan dugaan bahwa saya perawat.)" },
        { "japanese": "ちちは にほんごの せんせいですよ。", "highlight": "よ", "indonesian": "Ayah saya guru bahasa Jepang, lho. (Memberi informasi kepada teman.)" }
      ],
      "dialogue": {
        "situation": "Anna sudah mendengar bahwa Hadi orang Indonesia. Hadi juga sudah mendengar bahwa Anna pelajar. Mereka memastikan informasi itu, lalu Hadi meluruskan dugaan Anna tentang profesinya.",
        "japanese": "A: ハディさんはインドネシアじんですね。\nB: はい、インドネシアじんです。アンナさんはがくせいですね。\nA: はい、がくせいです。ハディさんもがくせいですか。\nB: いいえ、エンジニアですよ。",
        "indonesian": "A: Hadi orang Indonesia, ya.\nB: Ya, saya orang Indonesia. Anna pelajar, ya.\nA: Ya, saya pelajar. Apakah Hadi juga pelajar?\nB: Bukan, saya insinyur, lho."
      },
      "direction": "Anna dan Hadi memastikan informasi yang sudah didengar dengan ね. Saat Anna belum tahu profesi Hadi, ia bertanya dengan か. Hadi lalu memakai よ untuk memberi koreksi: ia insinyur.",
      "taskInstruction": "Situasi: Anda sudah mendengar bahwa リナ (Rina) adalah にほんじん (orang Jepang). Buat satu kalimat dengan ね untuk meminta Rina memastikan informasi itu, dengan maksud Rina orang Jepang, ya.",
      "recognitionDistractors": ["Menunjukkan hubungan pemilik dengan nama.", "Mengubah kata benda menjadi bentuk negatif.", "Menambahkan orang dengan identitas sama."],
      "controlledDistractors": ["よ", "か", "の"],
      "drills": {
        "recognition": {
          "prompt": "Anda sudah mendengar bahwa Rina pelajar dan ingin memastikan kabar itu. Apa fungsi ね?",
          "example": { "japanese": "リナさんは がくせいですね。", "indonesian": "Rina pelajar, ya." },
          "options": ["Meminta konfirmasi atas informasi yang sudah didengar.", "Memberi koreksi bahwa Rina bukan pelajar.", "Menyatakan profesi penutur sama dengan Rina."],
          "answer": "Meminta konfirmasi atas informasi yang sudah didengar."
        },
        "controlled": {
          "prompt": "Teman mengira Anda perawat. Anda dokter dan ingin memberinya informasi koreksi. Pilih penanda pemberian informasi itu.",
          "sentence": "いいえ、いしゃです＿＿＿。",
          "indonesian": "Bukan, saya dokter, lho.",
          "options": ["よ", "ね", "か"],
          "answer": "よ"
        }
      },
      "dialogChecks": {
        "comprehension": { "prompt": "Apa yang dilakukan Hadi ketika berkata エンジニアですよ?", "options": ["Memberi koreksi tentang profesinya", "Meminta Anna memastikan profesinya", "Menanyakan profesi Anna"], "correctIndex": 0, "explanation": "Anna bertanya apakah Hadi juga pelajar. Hadi memberi informasi koreksi dengan よ: ia insinyur.", "evidence": [{ "turnIndex": 2, "quote": "ハディさんもがくせいですか" }, { "turnIndex": 3, "quote": "いいえ、エンジニアですよ" }] },
        "comparison": { "prompt": "Anda sudah mendengar bahwa Sari guru. Pilih kalimat untuk meminta konfirmasi dengan maksud Sari guru, ya.", "options": ["サリさんは せんせいですね。", "サリさんは せんせいですよ。", "サリさんは せんせいじゃありません。"], "correctIndex": 0, "explanation": "ね sesuai untuk memastikan informasi yang sudah didengar. よ memberi informasi kepada lawan bicara, sedangkan じゃありません menyangkal." }
      }
    }
  ]
}$content$::jsonb;
  course_id_180 UUID;
  module_id_180 UUID;
  lock_id_180 UUID;
  source_id_180 UUID;
  task_id_180 UUID;
  grammar_id_180 UUID;
  changed_sources UUID[] := ARRAY[]::UUID[];
  changed_grammar UUID[] := ARRAY[]::UUID[];
  item JSONB;
  example_item JSONB;
  grammar_before RECORD;
  source_row RECORD;
  matches INT;
  example_order INT;
  scene JSONB;
  participants JSONB;
  checks JSONB;
  directions JSONB;
  envelope JSONB;
  stamp JSONB := jsonb_build_object('email', 'migration/180_bab3_grammar_support.sql', 'at', '2026-09-30T00:00:00.000Z');
BEGIN
  SELECT count(*), (array_agg(c.id))[1] INTO matches, course_id_180
    FROM courses c WHERE c.slug = plan->>'course';
  IF matches = 0 THEN
    RAISE NOTICE '180: N5 course absent; no content changed';
    RETURN;
  END IF;
  IF matches <> 1 THEN RAISE EXCEPTION '180: N5 course is ambiguous'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:graph'));
  FOR lock_id_180 IN WITH RECURSIVE required(id) AS (
    SELECT course_id_180
    UNION
    SELECT p.prerequisite_course_id FROM course_prerequisites p JOIN required r ON r.id = p.course_id
  ) SELECT id FROM required ORDER BY id::text LOOP
    PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:' || lock_id_180::text));
  END LOOP;

  SELECT count(*), (array_agg(m.id))[1] INTO matches, module_id_180
    FROM modules m WHERE m.course_id = course_id_180 AND m.slug = plan->>'module';
  IF matches <> 1 THEN RAISE EXCEPTION '180: expected exactly one N5 Bab 3'; END IF;
  IF jsonb_array_length(plan->'items') <> 6 THEN RAISE EXCEPTION '180: expected six reviewed grammar points'; END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(plan->'items') LOOP
    SELECT count(*), (array_agg(l.id))[1] INTO matches, source_id_180
      FROM lessons l WHERE l.module_id = module_id_180
        AND l.slug = item->>'lesson' AND l.type IN ('text','video');
    IF matches <> 1 THEN RAISE EXCEPTION '180: missing/ambiguous teaching lesson %', item->>'lesson'; END IF;

    SELECT count(*), (array_agg(g.id))[1] INTO matches, grammar_id_180
      FROM module_grammar g WHERE g.module_id = module_id_180
        AND g.lesson_id = source_id_180 AND g.pattern = item->>'pattern';
    IF matches <> 1 THEN RAISE EXCEPTION '180: missing/ambiguous teaching point %', item->>'pattern'; END IF;
    SELECT * INTO STRICT grammar_before FROM module_grammar WHERE id = grammar_id_180 FOR UPDATE;

    -- An already-snapshotted row is complete. Never replay over later admin edits.
    IF EXISTS (SELECT 1 FROM n5_b3_grammar_support_backup_180 WHERE grammar_id = grammar_id_180) THEN CONTINUE; END IF;

    SELECT count(*), (array_agg(l.id))[1] INTO matches, task_id_180
      FROM lessons l JOIN lesson_grammar_task_items i ON i.lesson_id = l.id
      WHERE l.module_id = module_id_180 AND l.slug = item->>'task'
        AND l.type = 'grammar_task' AND l.popup_after_lesson_id = source_id_180
        AND i.grammar_id = grammar_id_180 AND i.required_count = 1;
    IF matches <> 1 THEN RAISE EXCEPTION '180: task membership/count differs for %', item->>'key'; END IF;

    INSERT INTO n5_b3_grammar_lessons_backup_180(lesson_id,before_lesson)
      SELECT l.id,to_jsonb(l) FROM lessons l WHERE l.id IN (source_id_180,task_id_180)
      ON CONFLICT (lesson_id) DO NOTHING;
    INSERT INTO n5_b3_grammar_support_backup_180(grammar_id,before_grammar,before_examples,before_task_items,before_dialog_questions)
      SELECT grammar_id_180,to_jsonb(grammar_before),
        coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.sort_order,e.id) FROM grammar_examples e WHERE e.grammar_id = grammar_id_180),'[]'::jsonb),
        coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.lesson_id,i.sort_order) FROM lesson_grammar_task_items i WHERE i.grammar_id = grammar_id_180),'[]'::jsonb),
        coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM grammar_dialog_questions q WHERE q.grammar_id = grammar_id_180),'[]'::jsonb);

    -- Retain configured voices for the same character. Canonical profiles supply
    -- a voice only when that character was not already cast in this scene.
    SELECT jsonb_agg(jsonb_build_object(
      'characterKey', cast_member.character_key,
      'position', cast_member.position,
      'speaker', cast_member.speaker,
      'displayName', cast_member.display_name,
      'voiceId', coalesce(nullif(old_cast.person->>'voiceId',''),nullif(profile.voice_id,'')),
      'voiceName', coalesce(nullif(old_cast.person->>'voiceName',''),profile.voice_name,''),
      'profileVersion', coalesce((old_cast.person->>'profileVersion')::int,profile.profile_version,1),
      'custom', coalesce((old_cast.person->>'custom')::boolean,false)
    ) ORDER BY cast_member.speaker) INTO participants
    FROM (VALUES ('anna-wijaya','left','A','アンナ'),('hadi-pratama','right','B','ハディ'))
      AS cast_member(character_key,position,speaker,display_name)
    LEFT JOIN dialogue_speakers profile ON profile.character_key = cast_member.character_key
    LEFT JOIN LATERAL (
      SELECT person FROM jsonb_array_elements(grammar_before.dialog_scene->'participants') person
      WHERE person->>'characterKey' = cast_member.character_key LIMIT 1
    ) old_cast ON TRUE;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(participants) p WHERE nullif(p->>'voiceId','') IS NULL) THEN
      -- Leave existing legacy audio routing usable where no character voices
      -- have been configured. A configured scene must not silently lose audio.
      IF grammar_before.dialog_scene IS NOT NULL THEN
        RAISE EXCEPTION '180: Anna/Hadi voice missing for configured scene %', item->>'key';
      END IF;
      scene := NULL;
    ELSE
      scene := jsonb_build_object('schemaVersion',1,
        'enabled',coalesce((grammar_before.dialog_scene->>'enabled')::boolean,true),
        'backgroundKey',coalesce(grammar_before.dialog_scene->>'backgroundKey','classroom'),
        'participants',participants);
    END IF;

    UPDATE module_grammar SET
      notes = item->>'notes',
      example = item->'examples'->0->>'japanese',
      example_dialog = item->'dialogue'->>'japanese',
      example_dialog_id = item->'dialogue'->>'indonesian',
      communication_goal = item->'dialogue'->>'situation',
      dialog_scene = scene,
      dialog_furigana = NULL,
      recognition_distractors = (SELECT string_agg(value,E'\n') FROM jsonb_array_elements_text(item->'recognitionDistractors')),
      controlled_distractors = (SELECT string_agg(value,E'\n') FROM jsonb_array_elements_text(item->'controlledDistractors')),
      practice_config = item->'drills',
      updated_at = NOW()
    WHERE id = grammar_id_180;

    DELETE FROM grammar_examples WHERE grammar_id = grammar_id_180;
    example_order := 0;
    FOR example_item IN SELECT value FROM jsonb_array_elements(item->'examples') LOOP
      INSERT INTO grammar_examples(grammar_id,japanese,highlight,indonesian,sort_order)
        VALUES (grammar_id_180,example_item->>'japanese',example_item->>'highlight',example_item->>'indonesian',example_order);
      example_order := example_order + 1;
    END LOOP;
    UPDATE lesson_grammar_task_items SET instruction = item->>'taskInstruction'
      WHERE lesson_id = task_id_180 AND grammar_id = grammar_id_180;

    -- Previous questions refer to different utterances. Keep their versions and
    -- student attempts, but do not serve them against the new conversations.
    UPDATE grammar_dialog_questions SET state = 'archived',updated_at = NOW()
      WHERE grammar_id = grammar_id_180 AND state = 'active';

    UPDATE n5_b3_grammar_support_backup_180 SET
      after_grammar = (SELECT to_jsonb(g) FROM module_grammar g WHERE g.id = grammar_id_180),
      after_examples = (SELECT jsonb_agg(to_jsonb(e) ORDER BY e.sort_order,e.id) FROM grammar_examples e WHERE e.grammar_id = grammar_id_180)
    WHERE grammar_id = grammar_id_180;
    changed_grammar := array_append(changed_grammar,grammar_id_180);
    IF NOT source_id_180 = ANY(changed_sources) THEN changed_sources := array_append(changed_sources,source_id_180); END IF;
  END LOOP;

  FOR source_row IN SELECT l.* FROM lessons l WHERE l.id = ANY(changed_sources) FOR UPDATE LOOP
    SELECT jsonb_object_agg(g.id::text,content.value->'dialogChecks'),
           jsonb_object_agg(g.id::text,content.value->>'direction') INTO checks,directions
      FROM module_grammar g JOIN jsonb_array_elements(plan->'items') content
        ON g.pattern = content.value->>'pattern' AND source_row.slug = content.value->>'lesson'
      WHERE g.lesson_id = source_row.id AND g.module_id = module_id_180;
    IF (SELECT count(*) FROM jsonb_object_keys(checks)) <> 3 THEN
      RAISE EXCEPTION '180: expected three reviewed dialogue checks for %',source_row.slug;
    END IF;
    envelope := jsonb_build_object('schemaVersion',1,'objective',plan->>'objective',
      'directions',directions,'dialogChecks',checks);
    UPDATE lessons SET
      bunpou_flow_draft = (coalesce(bunpou_flow_draft,'{}'::jsonb)
        - 'sourceFingerprint' - 'preparationReview' - 'overlays')
        || envelope || jsonb_build_object('editor',stamp),
      bunpou_flow_published = (coalesce(bunpou_flow_published,'{}'::jsonb)
        - 'sourceFingerprint' - 'preparationReview' - 'overlays')
        || envelope || jsonb_build_object('publishedBy',stamp),
      updated_at = NOW()
      WHERE id = source_row.id;
  END LOOP;
  -- The source revision includes practice_config. The normal reviewed publish /
  -- backfill path must refresh it; an old fingerprint must never claim readiness.
  RAISE NOTICE '180: refreshed % existing Bab 3 points; companion review/publish required for % lessons',
    coalesce(array_length(changed_grammar,1),0),coalesce(array_length(changed_sources,1),0);
END;
$support$;
