-- Give every authored N4 conversation one server-graded comprehension question.
-- The second existing reading check remains available as optional practice.
-- Abort if any dialogue or question was edited after the reviewed N4 snapshot.
DO $migration$
DECLARE p jsonb := $content${
  "courseId": "e22d819f-8526-4af6-a8c5-02258c12e6f0",
  "items": [
    {
      "grammarId": "3b41a238-b4f1-4327-a8e9-de69cdfbc804",
      "moduleId": "61d8ce65-5b6c-4dad-b75d-a3be800cb6c8",
      "sourceLessonId": "82faee90-5585-42cd-89cc-b5a3f8efb990",
      "sourceKey": "n4-comprehension-193:3b41a238-b4f1-4327-a8e9-de69cdfbc804",
      "expected": {
        "example_dialog": "A: その かばんは、きのう 買った かばんですか。\nB: はい。あねが 買った かばんです。\nA: あおいのも、あねのですか。\nB: いいえ、あおいのは わたしのです。毎日 つかう かばんです。",
        "example_dialog_id": "A: Apakah tas itu tas yang dibeli kemarin?\nB: Ya. Ini tas yang dibeli kakak perempuan saya.\nA: Apakah yang biru juga milik kakak Anda?\nB: Bukan, yang biru milik saya. Ini tas yang saya pakai setiap hari.",
        "communication_goal": "Anna dan Hadi melihat dua tas di atas meja. Hadi membedakan tas yang dibeli kakaknya dan tas yang dipakai sehari-hari.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "アンナ"
          },
          {
            "speaker": "B",
            "displayName": "ハディ"
          }
        ]
      },
      "dialogueFingerprint": "sha256:b79263117f652807c858149c143ed2a5184f573d2e7277e1db61028495b51d42",
      "questionFingerprint": "sha256:b330a661f03e4c99bb778dfac75bc2c02955d3fd70186ca9e83ab2bba4c604a2",
      "question": {
        "kind": "comprehension",
        "prompt": "Siapa yang membeli tas pertama?",
        "options": [
          "Kakak perempuan Hadi.",
          "Hadi sendiri.",
          "Anna."
        ],
        "correctIndex": 0,
        "explanation": "Hadi menyebut あねがかったかばん.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "はい。あねが 買った かばんです。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "eded72e5-8a76-4a04-8264-436f976f1a2d",
      "moduleId": "61d8ce65-5b6c-4dad-b75d-a3be800cb6c8",
      "sourceLessonId": "21bb0803-1dde-4d65-a32d-ea13c3140ebd",
      "sourceKey": "n4-comprehension-193:eded72e5-8a76-4a04-8264-436f976f1a2d",
      "expected": {
        "example_dialog": "A: しゅみは 何ですか。\nB: しゃしんを とることです。花の しゃしんを とるのが すきです。\nA: いいですね。わたしは しょうせつを 読むのが すきです。\nB: どんな しょうせつを 読みますか。\nA: 日本の しょうせつです。こうえんで 読むのは たのしいです。\nB: ここは しずかですから、いいですね。",
        "example_dialog_id": "A: Apa hobi Anda?\nB: Memotret. Saya suka memotret bunga.\nA: Bagus, ya. Saya suka membaca novel.\nB: Novel seperti apa yang Anda baca?\nA: Novel Jepang. Membaca di taman itu menyenangkan.\nB: Tempat ini tenang, jadi cocok, ya.",
        "communication_goal": "Hadi dan Aoi membicarakan hobi di taman. Kesukaan pada fotografi dibandingkan dengan hobi membaca novel.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "ハディ"
          },
          {
            "speaker": "B",
            "displayName": "葵"
          }
        ]
      },
      "dialogueFingerprint": "sha256:2a48816ee4f81aa438920198f028a33e577cd6e7d4a458f95f6cd8f827ccb64c",
      "questionFingerprint": "sha256:018a3cf0e2fcdd522861485b82e761713ae53bb0cd9c4ab673dd93a95e8cda10",
      "question": {
        "kind": "comprehension",
        "prompt": "Apa yang suka dipotret Aoi?",
        "options": [
          "Novel.",
          "Bunga.",
          "Pemandangan gunung."
        ],
        "correctIndex": 1,
        "explanation": "Aoi mengatakan 花のしゃしんをとるのがすきです.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "しゃしんを とることです。花の しゃしんを とるのが すきです。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "fedee2bc-5852-4576-a9e5-a764b6a38859",
      "moduleId": "d29f8cdb-e5e7-47f1-8f84-e0b840a17b70",
      "sourceLessonId": "bd69d351-2763-4c05-aee0-a01f50aaa086",
      "sourceKey": "n4-comprehension-193:fedee2bc-5852-4576-a9e5-a764b6a38859",
      "expected": {
        "example_dialog": "A: もう かえりますか。\nB: はい。あした しけんが あるんです。\nA: そうですか。いえで べんきょうしますか。\nB: はい。でも、この ことばが わからないんですが、せつめいしてください。\nA: はい。この ことばの いみは「休み」です。\nB: わかりました。ありがとうございます。",
        "example_dialog_id": "A: Sudah mau pulang?\nB: Ya. Soalnya besok ada ujian.\nA: Oh, begitu. Akan belajar di rumah?\nB: Ya. Tapi saya tidak mengerti kata ini; tolong jelaskan.\nA: Bisa. Arti kata ini adalah “libur”.\nB: Saya mengerti sekarang. Terima kasih.",
        "communication_goal": "Aoi melihat Ren hendak pulang lebih awal. Ren menjelaskan ujian besok lalu meminta bantuan memahami satu kata.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "葵"
          },
          {
            "speaker": "B",
            "displayName": "蓮"
          }
        ]
      },
      "dialogueFingerprint": "sha256:5ae7936efcba19d19ce0d53485b1510be9c9600decfaaba36b2daa948380e8ea",
      "questionFingerprint": "sha256:2e5f315dea65f0ba173f5d659c5c899053e5256883e274abe417557f1b1b957c",
      "question": {
        "kind": "comprehension",
        "prompt": "Mengapa Ren pulang lebih awal?",
        "options": [
          "Karena kelasnya dibatalkan.",
          "Karena ia merasa sakit.",
          "Karena besok ada ujian dan ia akan belajar di rumah."
        ],
        "correctIndex": 2,
        "explanation": "Ren menjelaskan しけんがあるんです dan membenarkan rencana belajar di rumah.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "はい。あした しけんが あるんです。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "a60c9112-86e9-4e45-bbc1-bcbe9ebf7873",
      "moduleId": "d29f8cdb-e5e7-47f1-8f84-e0b840a17b70",
      "sourceLessonId": "4ac87534-1de1-4a7d-b189-b7cbdb595192",
      "sourceKey": "n4-comprehension-193:a60c9112-86e9-4e45-bbc1-bcbe9ebf7873",
      "expected": {
        "example_dialog": "A: 『はる』という 本を 読みましたか。\nB: はい。とても おもしろいと 思います。\nA: わたしも そう 思います。友だちも「おもしろかった」と 言っていました。\nB: その 友だちも 日本の 本が すきですか。\nA: はい。毎週 本を 買うと 言っていました。\nB: たくさん 読んでいますね。",
        "example_dialog_id": "A: Sudah membaca buku berjudul Haru?\nB: Sudah. Menurut saya sangat menarik.\nA: Saya juga berpikir begitu. Teman saya juga bilang, “Menarik.”\nB: Apakah teman itu juga suka buku Jepang?\nA: Ya. Ia bilang membeli buku setiap minggu.\nB: Banyak membaca, ya.",
        "communication_goal": "Ren dan Claire membandingkan pendapat mereka tentang sebuah buku dan menyampaikan komentar seorang teman.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "蓮"
          },
          {
            "speaker": "B",
            "displayName": "クレア"
          }
        ]
      },
      "dialogueFingerprint": "sha256:bf7f8a0bf934cbfe7f376bb96096ebda4fe1acccd7dc8171ad321db45555e709",
      "questionFingerprint": "sha256:fa0b02d4a63c715d5f34c653add58e4c4d7c87f7ae849c2855f6361cc554fe7a",
      "question": {
        "kind": "comprehension",
        "prompt": "Bagaimana pendapat Ren dan Claire tentang Haru?",
        "options": [
          "Keduanya menilai buku itu menarik.",
          "Keduanya menganggap buku itu membosankan.",
          "Ren menyukainya, tetapi Claire tidak."
        ],
        "correctIndex": 0,
        "explanation": "Claire menyampaikan おもしろいとおもいます dan Ren menyetujuinya.",
        "evidence": [
          {
            "turnIndex": 2,
            "quote": "わたしも そう 思います。友だちも「おもしろかった」と 言っていました。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "95cd10ea-b201-4c44-83de-1b7aeff42c07",
      "moduleId": "377eb9d6-2986-4893-980b-1fe92a871b9e",
      "sourceLessonId": "5e2824e2-5d88-48cb-94cf-07bff41f7205",
      "sourceKey": "n4-comprehension-193:95cd10ea-b201-4c44-83de-1b7aeff42c07",
      "expected": {
        "example_dialog": "A: 電車は 何時ですか。\nB: 十時です。九時半までに ここへ 来てください。\nA: その前に、朝ごはんを 食べても いいですか。\nB: はい。食べた後で、ここで まちましょう。\nA: 九時半までに ここへ 来ます。\nB: はい。わたしも ここで まちます。",
        "example_dialog_id": "A: Keretanya pukul berapa?\nB: Pukul sepuluh. Silakan kembali ke sini paling lambat setengah sepuluh.\nA: Bolehkah sarapan sebelumnya?\nB: Boleh. Setelah makan, mari menunggu di sini.\nA: Saya akan datang ke sini paling lambat setengah sepuluh.\nB: Baik. Saya juga akan menunggu di sini.",
        "communication_goal": "Claire dan Daniel menyusun waktu makan sebelum kereta berangkat, dengan batas kembali ke stasiun yang jelas.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "クレア"
          },
          {
            "speaker": "B",
            "displayName": "ダニエル"
          }
        ]
      },
      "dialogueFingerprint": "sha256:12c102e89099e7a28176e4b19308cf2a7d0d13e3b3adcabc6384c3de9b4575ca",
      "questionFingerprint": "sha256:9671598032467b62edf48b5db29a321819da75d75382b1e232786eee89e8a76f",
      "question": {
        "kind": "comprehension",
        "prompt": "Paling lambat pukul berapa Claire harus kembali?",
        "options": [
          "Pukul 09.00.",
          "Pukul 09.30.",
          "Pukul 10.00."
        ],
        "correctIndex": 1,
        "explanation": "Daniel memakai 九時半までに untuk menetapkan tenggat kembali.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "十時です。九時半までに ここへ 来てください。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "773ded4a-7972-4a97-a07c-0b940908c219",
      "moduleId": "377eb9d6-2986-4893-980b-1fe92a871b9e",
      "sourceLessonId": "a97483b5-98b5-49ed-8e5b-4e2e9d6bfa0a",
      "sourceKey": "n4-comprehension-193:773ded4a-7972-4a97-a07c-0b940908c219",
      "expected": {
        "example_dialog": "A: 日曜日は 何を しましたか。\nB: 本を 読んだり、りょうりを 作ったりしました。\nA: おんがくも 聞きましたか。\nB: はい。おんがくを 聞きながら、りょうりを 作りました。\nA: わたしは テレビを 見ないで、早く ねました。\nB: ゆっくり 休みましたね。",
        "example_dialog_id": "A: Apa yang Anda lakukan hari Minggu?\nB: Saya antara lain membaca buku dan memasak.\nA: Apakah juga mendengarkan musik?\nB: Ya. Saya memasak sambil mendengarkan musik.\nA: Saya tidur lebih awal tanpa menonton televisi.\nB: Anda beristirahat dengan santai, ya.",
        "communication_goal": "Daniel dan Anna menceritakan kegiatan hari Minggu. Anna menjelaskan kegiatan memasak sambil mendengarkan musik.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "ダニエル"
          },
          {
            "speaker": "B",
            "displayName": "アンナ"
          }
        ]
      },
      "dialogueFingerprint": "sha256:2cc74f057892d01249b01964e2f6e616d7b96fd958d26fdb07e944f92ffeb683",
      "questionFingerprint": "sha256:26da1bcdbc048eb11759856e8439d82aff2690663751a98b2556d66b7d6cf3e3",
      "question": {
        "kind": "comprehension",
        "prompt": "Dua kegiatan apa yang dilakukan Anna bersamaan?",
        "options": [
          "Membaca buku dan menonton televisi.",
          "Memasak dan tidur.",
          "Memasak dan mendengarkan musik."
        ],
        "correctIndex": 2,
        "explanation": "ききながら、りょうりをつくりました menunjukkan kegiatan bersamaan dengan pelaku yang sama.",
        "evidence": [
          {
            "turnIndex": 3,
            "quote": "はい。おんがくを 聞きながら、りょうりを 作りました。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "820d48d1-48a8-47c9-b259-800de763b9c7",
      "moduleId": "c8c66af8-2437-4b15-bfeb-0879118ef48d",
      "sourceLessonId": "c124d3ee-2fa9-41d4-aa36-28a2f83f8c17",
      "sourceKey": "n4-comprehension-193:820d48d1-48a8-47c9-b259-800de763b9c7",
      "expected": {
        "example_dialog": "A: ここで パソコンを つかうことができますか。\nB: はい、つかえます。あの パソコンは 今 つかっていません。\nA: 日本語も 書けますか。\nB: はい、日本語で レポートを 書くことができます。\nA: じゃあ、つかいます。ありがとうございます。\nB: どうぞ。",
        "example_dialog_id": "A: Bisa memakai komputer di sini?\nB: Ya, bisa. Komputer yang di sana sekarang tidak sedang dipakai.\nA: Bisa menulis bahasa Jepang juga?\nB: Ya, bisa menulis laporan dalam bahasa Jepang.\nA: Kalau begitu saya akan memakainya. Terima kasih.\nB: Silakan.",
        "communication_goal": "Anna menanyakan penggunaan komputer kepada Aoi. Mereka memastikan fasilitas yang tersedia dan kemampuan mengetik bahasa Jepang.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "アンナ"
          },
          {
            "speaker": "B",
            "displayName": "葵"
          }
        ]
      },
      "dialogueFingerprint": "sha256:01d4763adb471a43e33d8abd51615908cc4195753f96fa83f5329b6c6ed8b57e",
      "questionFingerprint": "sha256:d9b751188a66bdb58d985935307c19994aa578670641c5fafee435a1d570f9d9",
      "question": {
        "kind": "comprehension",
        "prompt": "Apakah komputer yang ditunjuk sedang digunakan?",
        "options": [
          "Tidak.",
          "Ya, sedang digunakan Anna.",
          "Ya, sedang diperbaiki."
        ],
        "correctIndex": 0,
        "explanation": "Aoi mengatakan いまつかっていません.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "はい、つかえます。あの パソコンは 今 つかっていません。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "a71867c0-a1f5-45ec-bd43-9594fa317e20",
      "moduleId": "c8c66af8-2437-4b15-bfeb-0879118ef48d",
      "sourceLessonId": "593ce3af-d379-446f-b81e-8fc7866576d9",
      "sourceKey": "n4-comprehension-193:a71867c0-a1f5-45ec-bd43-9594fa317e20",
      "expected": {
        "example_dialog": "A: この まどから 山が 見えますね。\nB: はい。今日は 天気が いいです。\nA: コーヒーの いい においも します。\nB: そうですね。コーヒーを 飲みませんか。\nA: いいですね。わたしは あたたかい コーヒーに します。\nB: わたしも そうします。",
        "example_dialog_id": "A: Gunung terlihat dari jendela ini, ya.\nB: Ya. Cuaca hari ini bagus.\nA: Aroma kopi yang harum juga tercium.\nB: Benar. Mau minum kopi?\nA: Boleh. Saya pilih kopi hangat.\nB: Saya juga pilih itu.",
        "communication_goal": "Hadi dan Ren duduk dekat jendela kafe, mengamati gunung dan mengenali aroma kopi.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "ハディ"
          },
          {
            "speaker": "B",
            "displayName": "蓮"
          }
        ]
      },
      "dialogueFingerprint": "sha256:ad3469bff4488896f85b816852e4a5ae9a6be8f260a71e6f5bd72fb117db9944",
      "questionFingerprint": "sha256:7464cc11be9da7db055f4b90ec538e70cb8982796e72059f6257955d996fedf3",
      "question": {
        "kind": "comprehension",
        "prompt": "Apa yang terlihat dari jendela kafe?",
        "options": [
          "Laut.",
          "Gunung.",
          "Stasiun."
        ],
        "correctIndex": 1,
        "explanation": "Hadi menyatakan 山がみえます.",
        "evidence": [
          {
            "turnIndex": 0,
            "quote": "この まどから 山が 見えますね。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "6a20afd1-7455-47fe-9518-ed99e6b659cd",
      "moduleId": "bc1ef866-bb68-4404-8f08-f8cc3e621255",
      "sourceLessonId": "d8061cf1-edeb-4a18-a854-f96003cbee4c",
      "sourceKey": "n4-comprehension-193:6a20afd1-7455-47fe-9518-ed99e6b659cd",
      "expected": {
        "example_dialog": "A: 来月も この クラスに 来ますか。\nB: はい。もっと 勉強しようと 思っています。\nA: 毎日 来ますか。\nB: 月曜日と 水曜日と 金曜日に 来ることにしました。\nA: じゅぎょうは 何時からですか。\nB: 来月から 九時に はじまることになりました。",
        "example_dialog_id": "A: Bulan depan juga akan datang ke kelas ini?\nB: Ya. Saya berniat belajar lebih banyak.\nA: Akan datang setiap hari?\nB: Saya memutuskan datang pada hari Senin, Rabu, dan Jumat.\nA: Pelajarannya mulai pukul berapa?\nB: Mulai bulan depan, sudah ditetapkan pelajaran mulai pukul sembilan.",
        "communication_goal": "Aoi menanyakan rencana Claire mengikuti kelas. Claire membedakan keputusan pribadinya dengan jadwal yang ditetapkan sekolah.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "葵"
          },
          {
            "speaker": "B",
            "displayName": "クレア"
          }
        ]
      },
      "dialogueFingerprint": "sha256:32f162dd8123f8cfa860c2bf898c267ea14a9c502e3a6418615bfc0819437091",
      "questionFingerprint": "sha256:d73d803725a123a517191c9787222a1189cc35cec43e6ac10fbf4a6891ff13ae",
      "question": {
        "kind": "comprehension",
        "prompt": "Pada hari apa saja Claire memutuskan datang?",
        "options": [
          "Senin sampai Jumat.",
          "Selasa, Kamis, dan Sabtu.",
          "Senin, Rabu, dan Jumat."
        ],
        "correctIndex": 2,
        "explanation": "Claire menyebut tiga hari tersebut dengan 来ることにしました.",
        "evidence": [
          {
            "turnIndex": 3,
            "quote": "月曜日と 水曜日と 金曜日に 来ることにしました。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "0fe354f8-3553-4fdc-963d-48697dacd11e",
      "moduleId": "bc1ef866-bb68-4404-8f08-f8cc3e621255",
      "sourceLessonId": "4b87734e-e4fa-4bd7-93ee-ec2021aa6d7a",
      "sourceKey": "n4-comprehension-193:0fe354f8-3553-4fdc-963d-48697dacd11e",
      "expected": {
        "example_dialog": "A: さいきん、日本語の 本を 読んでいますね。\nB: はい。毎朝 十分 読むことにしています。\nA: 前より 読めるようになりましたか。\nB: はい。かんたんな 本が 読めるようになりました。\nA: わたしも 毎日 読むようにします。\nB: いいですね。いっしょに がんばりましょう。",
        "example_dialog_id": "A: Akhir-akhir ini Anda membaca buku bahasa Jepang, ya.\nB: Ya. Saya menetapkan kebiasaan membaca sepuluh menit setiap pagi.\nA: Apakah sekarang menjadi lebih bisa membaca daripada sebelumnya?\nB: Ya. Sekarang saya bisa membaca buku sederhana.\nA: Saya juga akan berusaha membaca setiap hari.\nB: Bagus. Mari berusaha bersama.",
        "communication_goal": "Ren dan Daniel membicarakan kebiasaan membaca. Daniel menjelaskan kemajuan yang dihasilkan kebiasaan kecil setiap pagi.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "蓮"
          },
          {
            "speaker": "B",
            "displayName": "ダニエル"
          }
        ]
      },
      "dialogueFingerprint": "sha256:618f0cb17cc8928b9ebfd0d896347566dba057ca4ab6f0a98336376c62503c65",
      "questionFingerprint": "sha256:ab1a8059372335fc19f9fdf224a6a17193274a252de639e73ae13a6f76395ef7",
      "question": {
        "kind": "comprehension",
        "prompt": "Apa kebiasaan membaca Daniel?",
        "options": [
          "Membaca sepuluh menit setiap pagi.",
          "Membaca satu jam setiap malam.",
          "Membaca hanya pada akhir pekan."
        ],
        "correctIndex": 0,
        "explanation": "毎朝十分よむことにしています menjelaskan kebiasaan yang sengaja ditetapkan.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "はい。毎朝 十分 読むことにしています。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "6060cab0-e192-40cb-9e7f-71ca0973f18d",
      "moduleId": "d9db5f79-38e6-4dcf-ba46-9f29be362877",
      "sourceLessonId": "81a1fb2a-2e2e-4cbf-9500-36d49b43cd2f",
      "sourceKey": "n4-comprehension-193:6060cab0-e192-40cb-9e7f-71ca0973f18d",
      "expected": {
        "example_dialog": "A: きのう、ケーキを 作ってみました。\nB: どうでしたか。\nA: おいしかったです。かぞくと ぜんぶ 食べてしまいました。\nB: えっ、ぜんぶですか。\nA: はい。また 作ろうと 思っています。\nB: いいですね。わたしも 作ってみたいです。",
        "example_dialog_id": "A: Kemarin saya mencoba membuat kue.\nB: Bagaimana hasilnya?\nA: Enak. Sudah saya habiskan bersama keluarga.\nB: Wah, semuanya?\nA: Ya. Saya berniat membuatnya lagi.\nB: Bagus. Saya juga ingin mencoba membuatnya.",
        "communication_goal": "Claire dan Anna membicarakan kue buatan Claire. Percobaan berhasil dan kuenya sudah habis dimakan.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "クレア"
          },
          {
            "speaker": "B",
            "displayName": "アンナ"
          }
        ]
      },
      "dialogueFingerprint": "sha256:3cd9e38f00819939c57d817b0e993dfe1530e78a59c15081c236580237b4a417",
      "questionFingerprint": "sha256:ae8c88ac3447875eaadf0753db4b75b3e2d631dcf16f8b8da0305c65135906b4",
      "question": {
        "kind": "comprehension",
        "prompt": "Siapa yang menghabiskan kue?",
        "options": [
          "Anna bersama Daniel.",
          "Claire bersama keluarganya.",
          "Claire sendirian."
        ],
        "correctIndex": 1,
        "explanation": "Claire menyebut かぞくとぜんぶたべてしまいました.",
        "evidence": [
          {
            "turnIndex": 2,
            "quote": "おいしかったです。かぞくと ぜんぶ 食べてしまいました。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "64e59ad7-df3a-436e-b766-ddf5b8d8492e",
      "moduleId": "d9db5f79-38e6-4dcf-ba46-9f29be362877",
      "sourceLessonId": "f520201f-e281-4f38-80d9-324705a0af78",
      "sourceKey": "n4-comprehension-193:64e59ad7-df3a-436e-b766-ddf5b8d8492e",
      "expected": {
        "example_dialog": "A: おくれて すみません。\nB: だいじょうぶです。電車は あと 五分です。\nA: よかった。電車に まにあって よかったです。\nB: はい。きっぷは ありますか。\nA: はい、あります。きのう 買いました。\nB: じゃあ、行きましょう。",
        "example_dialog_id": "A: Maaf saya terlambat.\nB: Tidak apa-apa. Keretanya masih lima menit lagi.\nA: Syukurlah. Lega bisa sempat naik kereta.\nB: Ya. Apakah tiketnya ada?\nA: Ya, ada. Saya membelinya kemarin.\nB: Kalau begitu, mari berangkat.",
        "communication_goal": "Daniel terlambat menemui Hadi di stasiun dan meminta maaf. Mereka lega keretanya belum berangkat.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "ダニエル"
          },
          {
            "speaker": "B",
            "displayName": "ハディ"
          }
        ]
      },
      "dialogueFingerprint": "sha256:c87edd1d005415a10308826904d3074058e7e3be43f713b3d85dde0754daf73b",
      "questionFingerprint": "sha256:28a0145c00a2fc799c716d59fcde826bf39e38ec904c26af710127a36a87ab82",
      "question": {
        "kind": "comprehension",
        "prompt": "Mengapa Daniel meminta maaf?",
        "options": [
          "Karena kehilangan tiket.",
          "Karena salah naik kereta.",
          "Karena terlambat datang."
        ],
        "correctIndex": 2,
        "explanation": "Dialog dibuka dengan おくれてすみません.",
        "evidence": [
          {
            "turnIndex": 0,
            "quote": "おくれて すみません。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "e57880e8-761f-449c-8ea6-da9f802ace6e",
      "moduleId": "dd5c6d36-8dfb-4c1f-bf61-62a574229b1f",
      "sourceLessonId": "22172988-3428-4d68-ade0-52b1c3814496",
      "sourceKey": "n4-comprehension-193:e57880e8-761f-449c-8ea6-da9f802ace6e",
      "expected": {
        "example_dialog": "A: 電気が ついていますね。\nB: はい。わたしが けします。\nA: まども 開いています。\nB: じゃあ、まども しめます。\nA: ありがとうございます。わたしは ドアを しめます。\nB: はい。いっしょに 帰りましょう。",
        "example_dialog_id": "A: Lampunya menyala, ya.\nB: Ya. Saya akan mematikannya.\nA: Jendelanya juga terbuka.\nB: Kalau begitu saya tutup jendelanya juga.\nA: Terima kasih. Saya akan menutup pintu.\nB: Baik. Mari pulang bersama.",
        "communication_goal": "Anna dan Hadi memeriksa keadaan kelas sebelum pulang. Mereka membedakan keadaan lampu dengan tindakan mematikannya.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "アンナ"
          },
          {
            "speaker": "B",
            "displayName": "ハディ"
          }
        ]
      },
      "dialogueFingerprint": "sha256:6478c3d222bd600f10294489b98fd32d48998a985769ecd48d90dbedf3bf6e93",
      "questionFingerprint": "sha256:dbc5bc9dcb376683138d5bc8e0cc0f52813e719b26731a0829d919860891b4b0",
      "question": {
        "kind": "comprehension",
        "prompt": "Bagaimana keadaan lampu pada awal percakapan?",
        "options": [
          "Menyala.",
          "Mati.",
          "Rusak."
        ],
        "correctIndex": 0,
        "explanation": "電気がついています melaporkan keadaan awal lampu.",
        "evidence": [
          {
            "turnIndex": 0,
            "quote": "電気が ついていますね。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "927f5138-3988-45d7-ab3a-d4eebfd9ae13",
      "moduleId": "dd5c6d36-8dfb-4c1f-bf61-62a574229b1f",
      "sourceLessonId": "85aa72cb-5b3e-4740-86d8-21d31bb00932",
      "sourceKey": "n4-comprehension-193:927f5138-3988-45d7-ab3a-d4eebfd9ae13",
      "expected": {
        "example_dialog": "A: いすが ならべてありますね。\nB: はい。あしたの じゅぎょうで つかいます。\nA: 本も じゅんびしてありますか。\nB: いいえ。今から じゅんびしておきます。\nA: では、わたしが 本を おきます。ここで いいですか。\nB: はい。その テーブルに おいてください。",
        "example_dialog_id": "A: Kursinya sudah disusun, ya.\nB: Ya. Akan dipakai dalam pelajaran besok.\nA: Apakah bukunya juga sudah disiapkan?\nB: Belum. Saya akan menyiapkannya sekarang untuk besok.\nA: Kalau begitu, saya yang meletakkan buku-bukunya. Boleh di sini?\nB: Ya. Letakkan di meja itu.",
        "communication_goal": "Hadi dan Aoi memeriksa persiapan kelas besok: kursi sudah tersusun, buku masih perlu disiapkan.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "ハディ"
          },
          {
            "speaker": "B",
            "displayName": "葵"
          }
        ]
      },
      "dialogueFingerprint": "sha256:aeabf124259f00c9530b6792a119915e669ad69b16ec2815694c12fa6e2d21fc",
      "questionFingerprint": "sha256:76135e64ecc61fc98c7a33d3e25f348f4ad99441f4fb99741235ba507de21d84",
      "question": {
        "kind": "comprehension",
        "prompt": "Apa yang sudah siap pada awal percakapan?",
        "options": [
          "Buku pelajaran.",
          "Susunan kursi.",
          "Jendela kelas."
        ],
        "correctIndex": 1,
        "explanation": "いすがならべてあります menyatakan hasil persiapan kursi yang sudah ada.",
        "evidence": [
          {
            "turnIndex": 0,
            "quote": "いすが ならべてありますね。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "cdc54833-4399-44a8-a1c4-4802c5fda033",
      "moduleId": "52fa650c-2d46-4c5b-ad90-59f521b6d5e8",
      "sourceLessonId": "73fe00f5-21e2-4105-8fd7-8467367fca74",
      "sourceKey": "n4-comprehension-193:cdc54833-4399-44a8-a1c4-4802c5fda033",
      "expected": {
        "example_dialog": "A: 空が くらくなってきましたね。\nB: そうですね。あ、雨が ふりだしました。\nA: かさは ありますか。\nB: はい。でも、雨が 強くなってきました。\nA: じゃあ、早く 帰りましょう。\nB: はい。あの 道を 行きましょう。",
        "example_dialog_id": "A: Langit mulai menjadi gelap, ya.\nB: Benar. Ah, hujan mulai turun.\nA: Apakah membawa payung?\nB: Ya. Tapi hujannya mulai bertambah deras.\nA: Kalau begitu mari cepat pulang.\nB: Ya. Mari lewat jalan itu.",
        "communication_goal": "Aoi dan Ren melihat cuaca berubah saat berjalan di taman. Hujan mulai turun dan mereka memutuskan segera pulang.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "葵"
          },
          {
            "speaker": "B",
            "displayName": "蓮"
          }
        ]
      },
      "dialogueFingerprint": "sha256:525b31d78e4176bc06bbf58d62722b0e01482c145db5e28f8e965044f5f0e982",
      "questionFingerprint": "sha256:e690f3f4ccbd3760a88a6ee138be4a3273353433b49229a2bf4ab7c3bf5630fb",
      "question": {
        "kind": "comprehension",
        "prompt": "Perubahan apa yang terlihat sebelum hujan mulai turun?",
        "options": [
          "Angin berhenti bertiup.",
          "Matahari menjadi lebih terang.",
          "Langit menjadi gelap."
        ],
        "correctIndex": 2,
        "explanation": "Aoi lebih dulu menyebut くらくなってきました.",
        "evidence": [
          {
            "turnIndex": 0,
            "quote": "空が くらくなってきましたね。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "daa05f6e-93ab-4f75-8c00-8ff7830e8e93",
      "moduleId": "52fa650c-2d46-4c5b-ad90-59f521b6d5e8",
      "sourceLessonId": "9ab60515-2279-4982-b36e-2b59ea50d3ee",
      "sourceKey": "n4-comprehension-193:daa05f6e-93ab-4f75-8c00-8ff7830e8e93",
      "expected": {
        "example_dialog": "A: ごはんを 食べませんか。\nB: 今、レポートを 書いているところです。まだ おわっていません。\nA: わたしは 今 書きおわったところです。\nB: あと 十分 まってください。\nA: はい。ここで まっています。\nB: ありがとうございます。もう少しです。",
        "example_dialog_id": "A: Mau makan?\nB: Saya sedang menulis laporan. Belum selesai.\nA: Saya baru saja selesai menulisnya.\nB: Tolong tunggu sepuluh menit lagi.\nA: Bisa. Saya menunggu di sini.\nB: Terima kasih. Tinggal sedikit lagi.",
        "communication_goal": "Ren mengajak Claire makan. Claire sedang menyelesaikan laporan, sedangkan Ren baru saja selesai.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "蓮"
          },
          {
            "speaker": "B",
            "displayName": "クレア"
          }
        ]
      },
      "dialogueFingerprint": "sha256:6b635b0dcf3b4cf624444f6592bc24770d8c6bfd4549e06353ff277ab942493c",
      "questionFingerprint": "sha256:8956c3a0876ba4b289ae7256e0f7de896f2071460527b5c263426c8f8f029210",
      "question": {
        "kind": "comprehension",
        "prompt": "Siapa yang masih menulis laporan?",
        "options": [
          "Claire.",
          "Ren.",
          "Keduanya sudah selesai."
        ],
        "correctIndex": 0,
        "explanation": "Claire mengatakan かいているところ dan まだおわっていません.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "今、レポートを 書いているところです。まだ おわっていません。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "9310a766-a8a7-4520-904d-e9adfa304a44",
      "moduleId": "034b3cc0-7f52-4cbe-83f3-3554b21092b4",
      "sourceLessonId": "7a4658c8-eb44-47de-ae41-9e464d5818d1",
      "sourceKey": "n4-comprehension-193:9310a766-a8a7-4520-904d-e9adfa304a44",
      "expected": {
        "example_dialog": "A: この カメラの つかい方が わかりません。\nB: この ボタンを おしてください。\nA: あ、しゃしんが とれました。でも、少し 重すぎますね。\nB: そうですね。こちらの 小さいのは つかいやすいです。\nA: じゃあ、小さいのを つかってみます。\nB: どうぞ。",
        "example_dialog_id": "A: Saya tidak mengerti cara memakai kamera ini.\nB: Tekan tombol ini.\nA: Ah, berhasil mengambil foto. Tapi kameranya agak terlalu berat, ya.\nB: Benar. Yang kecil di sini mudah dipakai.\nA: Kalau begitu saya coba yang kecil.\nB: Silakan.",
        "communication_goal": "Claire kesulitan memakai kamera yang dibawa Daniel. Ia meminta penjelasan cara penggunaan dan mempertimbangkan berat kamera.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "クレア"
          },
          {
            "speaker": "B",
            "displayName": "ダニエル"
          }
        ]
      },
      "dialogueFingerprint": "sha256:ed7dff6587cb3b33ac7d00184c8c1106d6dfb992ad80231a215cf2b01ac46457",
      "questionFingerprint": "sha256:1b5c4d426afd84a1c69502827b2f547d8c7ed74c9ba8f2f54c0760e7dede8dc7",
      "question": {
        "kind": "comprehension",
        "prompt": "Penjelasan apa yang diminta Claire?",
        "options": [
          "Cara membeli kamera.",
          "Cara menggunakan kamera.",
          "Cara mencetak foto."
        ],
        "correctIndex": 1,
        "explanation": "つかいかたがわかりません menyatakan kesulitan memahami cara pemakaian.",
        "evidence": [
          {
            "turnIndex": 0,
            "quote": "この カメラの つかい方が わかりません。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "e5bad6e3-2a14-4549-a837-db3a4f3ff8c9",
      "moduleId": "034b3cc0-7f52-4cbe-83f3-3554b21092b4",
      "sourceLessonId": "1d3d803c-06da-4633-a070-14476482ead8",
      "sourceKey": "n4-comprehension-193:e5bad6e3-2a14-4549-a837-db3a4f3ff8c9",
      "expected": {
        "example_dialog": "A: この 字の 大きさは どうですか。\nB: 少し 小さいですね。もっと 大きく 書いてください。\nA: はい。ていねいに 書きます。\nB: ありがとうございます。こちらの 名前も 大きくしてください。\nA: はい。これで いいですか。\nB: はい、よく なりました。",
        "example_dialog_id": "A: Bagaimana ukuran huruf ini?\nB: Agak kecil. Tolong tulis lebih besar.\nA: Baik. Saya tulis dengan teliti.\nB: Terima kasih. Nama di sebelah sini juga dibuat lebih besar.\nA: Baik. Begini sudah sesuai?\nB: Ya, sudah lebih baik.",
        "communication_goal": "Daniel dan Anna menyiapkan tulisan untuk kelas. Mereka memperbaiki ukuran dan kerapian huruf agar jelas bagi pembaca.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "ダニエル"
          },
          {
            "speaker": "B",
            "displayName": "アンナ"
          }
        ]
      },
      "dialogueFingerprint": "sha256:1090c65a6e4d760b13abcdaa443a2e306622eee353766e9486619350e076287a",
      "questionFingerprint": "sha256:3636a09448cb6aec922d19c0905d9e6fc77f4a3f12dfd19e9c7e54a42eda0357",
      "question": {
        "kind": "comprehension",
        "prompt": "Apa yang diperbaiki pada tulisan?",
        "options": [
          "Warna huruf diganti.",
          "Tulisan dihapus seluruhnya.",
          "Ukuran huruf dibuat lebih besar."
        ],
        "correctIndex": 2,
        "explanation": "Anna meminta 大きくかいてください dan 大きくしてください.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "少し 小さいですね。もっと 大きく 書いてください。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "c61fa4fc-7998-4ad0-af86-1ce0da781ac9",
      "moduleId": "a43ebaa8-5865-4a51-953d-640167e2ad13",
      "sourceLessonId": "ef235a5f-c681-4488-851e-0e63ea9069a5",
      "sourceKey": "n4-comprehension-193:c61fa4fc-7998-4ad0-af86-1ce0da781ac9",
      "expected": {
        "example_dialog": "A: ここで 勉強しますか。\nB: 今日は 人が 多いので、としょかんへ 行きたいです。\nA: としょかんは ここから ちかいですか。\nB: はい。ちかいし、しずかだし、勉強しやすいです。\nA: じゃあ、ごはんを 食べた後で 行きましょう。\nB: はい。そうしましょう。",
        "example_dialog_id": "A: Apakah kita belajar di sini?\nB: Hari ini banyak orang, jadi saya ingin pergi ke perpustakaan.\nA: Apakah perpustakaan dekat dari sini?\nB: Ya. Dekat dan tenang, jadi mudah belajar di sana.\nA: Kalau begitu, mari pergi setelah makan.\nB: Ya, mari begitu.",
        "communication_goal": "Anna dan Aoi memilih tempat belajar setelah makan. Aoi menjelaskan mengapa perpustakaan lebih sesuai.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "アンナ"
          },
          {
            "speaker": "B",
            "displayName": "葵"
          }
        ]
      },
      "dialogueFingerprint": "sha256:a83e79d00580f122aa110d6b013b13e421e90b9210702c38cd4d4d57957bdeb7",
      "questionFingerprint": "sha256:773b7eb6fc1ffea2e40b626e7a32f666e23b860eba95dae82b1ee409c0002c58",
      "question": {
        "kind": "comprehension",
        "prompt": "Mengapa Aoi ingin pindah dari kafe?",
        "options": [
          "Kafe ramai oleh banyak orang hari ini.",
          "Kafe sudah tutup.",
          "Perpustakaan terlalu jauh."
        ],
        "correctIndex": 0,
        "explanation": "人が多いので memberi alasan keinginannya pergi ke perpustakaan.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "今日は 人が 多いので、としょかんへ 行きたいです。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "8aea44c1-727a-4bd6-83dc-4b5fca2371f3",
      "moduleId": "a43ebaa8-5865-4a51-953d-640167e2ad13",
      "sourceLessonId": "b55f3a04-6a23-4eed-a1a7-2f391abfe20e",
      "sourceKey": "n4-comprehension-193:8aea44c1-727a-4bd6-83dc-4b5fca2371f3",
      "expected": {
        "example_dialog": "A: 今日は いい 天気だと 思ったのに、雨ですね。\nB: そうですね。でも、雨が ふっても、びじゅつかんへ 行きます。\nA: 駅から とおいですか。\nB: 少し とおいけど、バスで 行けます。\nA: じゃあ、いっしょに バスで 行きましょう。\nB: はい。あちらで まちましょう。",
        "example_dialog_id": "A: Padahal saya kira hari ini cuacanya akan bagus, ternyata hujan, ya.\nB: Benar. Tetapi meskipun hujan, saya tetap pergi ke museum seni.\nA: Apakah jauh dari stasiun?\nB: Agak jauh, tetapi bisa naik bus.\nA: Kalau begitu mari naik bus bersama.\nB: Ya. Mari menunggu di sana.",
        "communication_goal": "Hadi dan Ren membicarakan rencana ke museum seni saat cuaca tidak sesuai harapan. Museum tetap menjadi tujuan meskipun hujan.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "ハディ"
          },
          {
            "speaker": "B",
            "displayName": "蓮"
          }
        ]
      },
      "dialogueFingerprint": "sha256:dda48c5f423059774329fb9a418901a55273db2e8f9b91d886a751c3eb62d050",
      "questionFingerprint": "sha256:f27fd93cd452db34a847f2e64af987b59e841b34cb37f39b3b14061c3803ca44",
      "question": {
        "kind": "comprehension",
        "prompt": "Apa yang tidak sesuai harapan Hadi?",
        "options": [
          "Ia berharap naik kereta, tetapi harus naik bus.",
          "Ia memperkirakan cuaca bagus, tetapi ternyata hujan.",
          "Ia berharap museum buka, tetapi museum tutup."
        ],
        "correctIndex": 1,
        "explanation": "いいてんきだとおもったのに menyatakan harapan yang meleset.",
        "evidence": [
          {
            "turnIndex": 0,
            "quote": "今日は いい 天気だと 思ったのに、雨ですね。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "4d3efc88-0326-40da-9745-e84d5e385949",
      "moduleId": "87c74265-8edd-4c2f-abe8-033204f66bbc",
      "sourceLessonId": "c1cb8777-bcb2-46da-ab03-cd5147b728b8",
      "sourceKey": "n4-comprehension-193:4d3efc88-0326-40da-9745-e84d5e385949",
      "expected": {
        "example_dialog": "A: 空に 黒い くもが ありますね。\nB: はい。雨が ふりそうです。\nA: 明日も 雨ですか。\nB: 天気よほうでは、明日は はれるそうです。\nA: じゃあ、明日 また 来ましょう。\nB: いいですね。今日は 早く 帰りましょう。",
        "example_dialog_id": "A: Ada awan hitam di langit, ya.\nB: Ya. Kelihatannya akan hujan.\nA: Apakah besok juga hujan?\nB: Menurut prakiraan cuaca, katanya besok cerah.\nA: Kalau begitu, mari datang lagi besok.\nB: Boleh. Hari ini mari cepat pulang.",
        "communication_goal": "Aoi dan Claire membedakan tanda hujan yang terlihat sekarang dengan kabar cuaca besok dari prakiraan.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "葵"
          },
          {
            "speaker": "B",
            "displayName": "クレア"
          }
        ]
      },
      "dialogueFingerprint": "sha256:f193b087c6fc4c24bdffc2a6a62f5f8427d3f45802639e340359accaa6a87b0c",
      "questionFingerprint": "sha256:206a143a1c6f4cbe6e5304b2f31bb0c27627413653bbd5b17890aea38a95e5e1",
      "question": {
        "kind": "comprehension",
        "prompt": "Apa dasar perkiraan hujan sekarang?",
        "options": [
          "Berita di televisi.",
          "Prakiraan cuaca besok.",
          "Awan hitam yang tampak di langit."
        ],
        "correctIndex": 2,
        "explanation": "ふりそうです mengikuti pengamatan くろいくもがあります.",
        "evidence": [
          {
            "turnIndex": 0,
            "quote": "空に 黒い くもが ありますね。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "481653aa-ad49-4988-92d0-3dc088229c7f",
      "moduleId": "87c74265-8edd-4c2f-abe8-033204f66bbc",
      "sourceLessonId": "0b297a0e-60a4-4ba3-8919-8ec90ab97f79",
      "sourceKey": "n4-comprehension-193:481653aa-ad49-4988-92d0-3dc088229c7f",
      "expected": {
        "example_dialog": "A: わたしの 本が ありません。いえに わすれたかもしれません。\nB: きのう、この テーブルで 読んでいましたよ。\nA: そうでしたね。まだ ここに あるでしょうか。\nB: テーブルの 下に あるはずです。きのう、わたしが そこに おきました。\nA: あ、ありました。ありがとうございます。\nB: よかったですね。",
        "example_dialog_id": "A: Buku saya tidak ada. Mungkin tertinggal di rumah.\nB: Kemarin Anda membacanya di meja ini, lho.\nA: Benar juga. Kira-kira masih ada di sini?\nB: Seharusnya ada di bawah meja. Kemarin saya meletakkannya di sana.\nA: Ah, ada. Terima kasih.\nB: Syukurlah ketemu.",
        "communication_goal": "Ren dan Daniel mencari sebuah buku. Mereka membedakan kemungkinan buku dibawa pulang dengan dugaan beralasan tentang letak buku.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "蓮"
          },
          {
            "speaker": "B",
            "displayName": "ダニエル"
          }
        ]
      },
      "dialogueFingerprint": "sha256:cded92b6f1d122bf20d4239f17aa3943e53e7ca2579258316e0b89c650558a42",
      "questionFingerprint": "sha256:e7ee384b5723757b43e9915753967bfb4ad6ce7dbb50c14c9eb584a5fa2648e4",
      "question": {
        "kind": "comprehension",
        "prompt": "Kemungkinan awal Ren tentang tempat bukunya apa?",
        "options": [
          "Mungkin tertinggal di rumah.",
          "Mungkin tertinggal di perpustakaan.",
          "Mungkin dipinjam Daniel."
        ],
        "correctIndex": 0,
        "explanation": "Ren membuka dengan いえにわすれたかもしれません.",
        "evidence": [
          {
            "turnIndex": 0,
            "quote": "わたしの 本が ありません。いえに わすれたかもしれません。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "b3b6d347-3555-432f-86a1-3979148bc6a3",
      "moduleId": "64a54a15-677d-4384-95c4-c2b22d8e717f",
      "sourceLessonId": "a9d4331c-63a2-41c1-b04f-1a4be36e3a2b",
      "sourceKey": "n4-comprehension-193:b3b6d347-3555-432f-86a1-3979148bc6a3",
      "expected": {
        "example_dialog": "A: あの 花は ゆきのように 白いですね。\nB: はい。ゆきみたいです。でも、花なんですね。\nA: あちらの 子どもたちも 花を 見ています。\nB: たのしそうに 話していますね。\nA: わたしたちも 写真を とりませんか。\nB: いいですね。白い 花を とりましょう。",
        "example_dialog_id": "A: Bunga itu putih seperti salju, ya.\nB: Ya, seperti salju. Tapi ternyata bunga, ya.\nA: Anak-anak di sana juga sedang melihat bunga.\nB: Mereka tampak senang saat berbincang, ya.\nA: Bagaimana kalau kita juga mengambil foto?\nB: Boleh. Mari memotret bunga putih itu.",
        "communication_goal": "Claire dan Anna melihat bunga putih serta anak-anak di taman. Mereka membandingkan penampilan bunga dan mengamati perasaan anak.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "クレア"
          },
          {
            "speaker": "B",
            "displayName": "アンナ"
          }
        ]
      },
      "dialogueFingerprint": "sha256:76abd1e382a0c2e41544fc573d34b4b9c3c50fd1e7fb28f3257260d8c70d6927",
      "questionFingerprint": "sha256:075e3743fca529e178fe80dbdd54590868f78fce568eb18be6cded695a5d0f36",
      "question": {
        "kind": "comprehension",
        "prompt": "Bunga dibandingkan dengan apa?",
        "options": [
          "Awan karena bentuknya.",
          "Salju karena warnanya putih.",
          "Kapas karena kelembutannya."
        ],
        "correctIndex": 1,
        "explanation": "ゆきのように白い dan ゆきみたいです menyatakan kemiripan penampilan.",
        "evidence": [
          {
            "turnIndex": 0,
            "quote": "あの 花は ゆきのように 白いですね。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "06e1aa0a-6abf-4e7c-8b8d-e4bdb6cb9dbb",
      "moduleId": "64a54a15-677d-4384-95c4-c2b22d8e717f",
      "sourceLessonId": "5208e79c-3d92-4c63-a2c8-3c9bec39dcb3",
      "sourceKey": "n4-comprehension-193:06e1aa0a-6abf-4e7c-8b8d-e4bdb6cb9dbb",
      "expected": {
        "example_dialog": "A: おとうとさんは どうしていますか。\nB: げんきです。「うみへ 行きたい」と 何ども 言っています。\nA: うみへ 行きたがっているんですね。\nB: はい。でも、大きい いぬを こわがっています。うみの 近くに いぬが いるんです。\nA: そうですか。おとうとさんと いっしょに 行きますか。\nB: はい。来週、いっしょに 行こうと 思っています。",
        "example_dialog_id": "A: Bagaimana kabar adik laki-laki Anda?\nB: Sehat. Ia berkali-kali berkata ingin pergi ke laut.\nA: Jadi ia sedang ingin pergi ke laut, ya.\nB: Ya. Tetapi ia takut kepada anjing besar. Ada anjing di dekat laut.\nA: Oh, begitu. Apakah Anda akan pergi bersama adik?\nB: Ya. Saya berniat pergi bersamanya minggu depan.",
        "communication_goal": "Daniel dan Hadi membicarakan keinginan serta perasaan adik Hadi berdasarkan ucapan dan reaksi yang terlihat.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "ダニエル"
          },
          {
            "speaker": "B",
            "displayName": "ハディ"
          }
        ]
      },
      "dialogueFingerprint": "sha256:703ee217946959dce64649ce23661410a9a538ec5fbb03136deed7a05e71de80",
      "questionFingerprint": "sha256:e7b62593809b0c9f117bfa7652fefb63856d8386f0abbec417611507d13a08ee",
      "question": {
        "kind": "comprehension",
        "prompt": "Apa dasar pernyataan bahwa adik Hadi ingin ke laut?",
        "options": [
          "Ia sudah membeli tiket ke laut.",
          "Ia melihat foto laut di kelas.",
          "Ia berkali-kali mengatakan ingin pergi ke laut."
        ],
        "correctIndex": 2,
        "explanation": "Ucapan berulang うみへいきたい menjadi bukti untuk いきたがっている.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "げんきです。「うみへ 行きたい」と 何ども 言っています。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "84c2f6be-45ed-48e4-8f27-b84bcbaa2da9",
      "moduleId": "d0d67a65-b304-4b3d-b6e6-3e1239473a67",
      "sourceLessonId": "827bdfa1-d7d2-4980-a65a-213714e9c0fb",
      "sourceKey": "n4-comprehension-193:84c2f6be-45ed-48e4-8f27-b84bcbaa2da9",
      "expected": {
        "example_dialog": "A: としょかんへ 行きたいんですが、道が わかりません。\nB: この道を まっすぐ 行くと、はしが あります。\nA: はしを わたるんですか。\nB: はい。わたって、右に まがると、としょかんが あります。\nA: わかりました。ありがとうございます。\nB: 着いたら、電話して ください。",
        "example_dialog_id": "A: Saya ingin ke perpustakaan, tetapi tidak tahu jalannya.\nB: Jika berjalan lurus di jalan ini, ada jembatan.\nA: Apakah saya menyeberangi jembatan itu?\nB: Ya. Setelah menyeberang lalu berbelok ke kanan, ada perpustakaan.\nA: Saya mengerti. Terima kasih.\nB: Setelah tiba, tolong telepon saya.",
        "communication_goal": "Anna bertanya kepada Hadi tentang jalan menuju perpustakaan. Mereka membedakan petunjuk rute dengan と dan tindakan setelah tiba dengan たら.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "アンナ"
          },
          {
            "speaker": "B",
            "displayName": "ハディ"
          }
        ]
      },
      "dialogueFingerprint": "sha256:baafc907686844b8856b950236991c6f674565897074fb73289bc85405c5438c",
      "questionFingerprint": "sha256:50d84b1d02d6f6d7e2508053016297d2a7b90b3295b8313a0b0da31f90b843ca",
      "question": {
        "kind": "comprehension",
        "prompt": "Setelah menyeberangi jembatan, Anna harus berbelok ke mana?",
        "options": [
          "Ke kanan.",
          "Ke kiri.",
          "Berjalan lurus tanpa berbelok."
        ],
        "correctIndex": 0,
        "explanation": "Hadi mengatakan みぎにまがると setelah menyeberangi jembatan.",
        "evidence": [
          {
            "turnIndex": 3,
            "quote": "はい。わたって、右に まがると、としょかんが あります。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "165c4efd-8898-48aa-992b-81bc882dc771",
      "moduleId": "d0d67a65-b304-4b3d-b6e6-3e1239473a67",
      "sourceLessonId": "5aa6180f-330d-4b62-93ad-2c719399a4fc",
      "sourceKey": "n4-comprehension-193:165c4efd-8898-48aa-992b-81bc882dc771",
      "expected": {
        "example_dialog": "A: 明日 試験なんですが、きのう あまり ねませんでした。\nB: じゃ、今日は 早く ねたら どうですか。\nA: そうですね。でも、まだ 読んでいない ページが あります。\nB: まず、このページを 読んだら どうですか。\nA: はい。そうします。\nB: 明日、上手に 答えられると いいですね。",
        "example_dialog_id": "A: Besok saya ujian, tetapi kemarin saya kurang tidur.\nB: Kalau begitu, bagaimana kalau tidur lebih awal hari ini?\nA: Benar juga. Tetapi masih ada halaman yang belum saya baca.\nB: Bagaimana kalau membaca halaman ini terlebih dahulu?\nA: Ya. Saya akan begitu.\nB: Semoga besok Anda bisa menjawab dengan baik.",
        "communication_goal": "Claire merasa lelah menjelang ujian. Ren memberi saran dengan たらどうですか dan menyampaikan harapan dengan といいですね.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "クレア"
          },
          {
            "speaker": "B",
            "displayName": "蓮"
          }
        ]
      },
      "dialogueFingerprint": "sha256:00c1bbb4eaf2218182e388e37dda9f5cd11e7518ca0eb0cde8d1888f786487a7",
      "questionFingerprint": "sha256:3436a9aa0dcb90133fe37d3aac7ebbe06502d4410c704d010846c7cdb5f2567e",
      "question": {
        "kind": "comprehension",
        "prompt": "Apa saran Ren tentang waktu tidur Claire?",
        "options": [
          "Belajar semalaman.",
          "Tidur lebih awal hari ini.",
          "Tidur lebih siang besok."
        ],
        "correctIndex": 1,
        "explanation": "Ren menyarankan きょうははやくねたらどうですか.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "じゃ、今日は 早く ねたら どうですか。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "fb8eb9ab-caaf-4d5c-b8f1-8fa10cac8c6d",
      "moduleId": "e6820110-bef2-47f0-b0c4-4a808d3bf51b",
      "sourceLessonId": "e5dd9d4d-e2a5-4806-bc6d-7e4d99123bd9",
      "sourceKey": "n4-comprehension-193:fb8eb9ab-caaf-4d5c-b8f1-8fa10cac8c6d",
      "expected": {
        "example_dialog": "A: 日曜日、時間が あれば、うみへ 行きませんか。\nB: いいですね。うみへ 行くなら、朝 早く 出ましょう。\nA: バスと 電車では、どちらが いいですか。\nB: 電車なら、一時間で 着きます。バスは 二時間 かかります。\nA: じゃ、電車で 行きましょう。\nB: はい。八時の 電車は どうですか。",
        "example_dialog_id": "A: Jika ada waktu hari Minggu, mau pergi ke laut?\nB: Boleh. Kalau pergi ke laut, mari berangkat pagi-pagi.\nA: Mana yang lebih baik, bus atau kereta?\nB: Kalau kereta, kita sampai dalam satu jam. Bus memerlukan dua jam.\nA: Kalau begitu, mari naik kereta.\nB: Ya. Bagaimana kalau kereta pukul delapan?",
        "communication_goal": "Aoi mengajak Daniel pergi ke laut jika ada waktu. Daniel menanggapi rencana itu dengan なら dan membandingkan transportasi.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "葵"
          },
          {
            "speaker": "B",
            "displayName": "ダニエル"
          }
        ]
      },
      "dialogueFingerprint": "sha256:d6cc96a3513ee833cb879fea47018a3f6eb8e2d4593f4c7cb92b1286b5bd7252",
      "questionFingerprint": "sha256:7fc093718a0b39e584592e7e4dc8bc5bf8e52f82953ac7699272bbdd18e56963",
      "question": {
        "kind": "comprehension",
        "prompt": "Apa syarat ajakan Aoi?",
        "options": [
          "Daniel sudah membeli tiket.",
          "Cuaca hari Minggu cerah.",
          "Daniel memiliki waktu pada hari Minggu."
        ],
        "correctIndex": 2,
        "explanation": "じかんがあれば adalah syarat keadaan untuk ajakan pergi.",
        "evidence": [
          {
            "turnIndex": 0,
            "quote": "日曜日、時間が あれば、うみへ 行きませんか。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "c9eb422c-64ee-469a-a942-156365943c33",
      "moduleId": "e6820110-bef2-47f0-b0c4-4a808d3bf51b",
      "sourceLessonId": "8ca72b48-7e11-4495-a097-8b334e1c1fbc",
      "sourceKey": "n4-comprehension-193:c9eb422c-64ee-469a-a942-156365943c33",
      "expected": {
        "example_dialog": "A: 電車は もう 行って しまったんですか。\nB: はい。五分前に 出ました。\nA: もっと 早く うちを 出れば よかったです。\nB: とちゅうで どこかに よったんですか。\nA: はい。店に よらなければ よかったです。\nB: つぎの 電車は 十分後です。ここで まちましょう。",
        "example_dialog_id": "A: Apakah keretanya sudah berangkat?\nB: Ya. Berangkat lima menit lalu.\nA: Seandainya saya berangkat dari rumah lebih awal.\nB: Apakah Anda mampir ke suatu tempat di perjalanan?\nA: Ya. Seandainya saya tidak mampir ke toko.\nB: Kereta berikutnya sepuluh menit lagi. Mari menunggu di sini.",
        "communication_goal": "Hadi terlambat untuk kereta karena mampir ke toko. Ia menyesali pilihan yang sudah dilakukan memakai ばよかった dan なければよかった.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "ハディ"
          },
          {
            "speaker": "B",
            "displayName": "クレア"
          }
        ]
      },
      "dialogueFingerprint": "sha256:bff721579773a7790a55044613db3c42d955f851a32e7ce6fea856a95c440405",
      "questionFingerprint": "sha256:17304a495996b67c5058e32874f98d17c31f0c5573c054e6b3285f13c61f7842",
      "question": {
        "kind": "comprehension",
        "prompt": "Apakah Hadi benar-benar mampir ke toko?",
        "options": [
          "Ya, ia mampir lalu menyesal.",
          "Tidak, ia langsung pergi ke stasiun.",
          "Tidak, ia kembali ke rumah."
        ],
        "correctIndex": 0,
        "explanation": "Hadi menjawab はい sebelum よらなければよかった, yang menunjukkan penyesalan atas tindakan yang sudah terjadi.",
        "evidence": [
          {
            "turnIndex": 4,
            "quote": "はい。店に よらなければ よかったです。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "bcefdff6-4e96-47e3-9de8-06fcb5214a16",
      "moduleId": "15931cf4-a16b-471c-8b49-8230fddb4b43",
      "sourceLessonId": "100f1b0c-2dd6-47cf-8a7a-1fcc90d7c680",
      "sourceKey": "n4-comprehension-193:bcefdff6-4e96-47e3-9de8-06fcb5214a16",
      "expected": {
        "example_dialog": "A: これから、本を かりに 図書館へ 行きます。\nB: どんな 本を かりるんですか。\nA: えいごの 本です。りょこうのために、えいごを 勉強しています。\nB: 本は 読めますか。\nA: まだ むずかしいです。読めるように、毎日 れんしゅうしています。\nB: いいですね。がんばって ください。",
        "example_dialog_id": "A: Setelah ini saya akan pergi ke perpustakaan untuk meminjam buku.\nB: Buku seperti apa yang akan Anda pinjam?\nA: Buku bahasa Inggris. Saya belajar bahasa Inggris untuk bepergian.\nB: Apakah Anda bisa membaca bukunya?\nA: Masih sulit. Saya berlatih setiap hari agar bisa membacanya.\nB: Bagus. Semangat, ya.",
        "communication_goal": "Ren menjelaskan tujuan pergi ke perpustakaan dan belajar bahasa Inggris. Anna menanyakan tujuan tindakan serta kemampuan yang sedang diusahakan.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "蓮"
          },
          {
            "speaker": "B",
            "displayName": "アンナ"
          }
        ]
      },
      "dialogueFingerprint": "sha256:6b6eef4f98572a666834e2a8c9e5af74ac041520500dce94c359c2437a41f6c0",
      "questionFingerprint": "sha256:cd374b8b9a259ba82b075c3e0c6fd4c24a810aac4914de34d86d16b822671b5c",
      "question": {
        "kind": "comprehension",
        "prompt": "Untuk apa Ren pergi ke perpustakaan?",
        "options": [
          "Untuk mengembalikan kamus.",
          "Untuk meminjam buku bahasa Inggris.",
          "Untuk bertemu guru bahasa Inggris."
        ],
        "correctIndex": 1,
        "explanation": "ほんをかりに menyatakan tujuan perjalanan dan Ren kemudian menjelaskan jenis bukunya.",
        "evidence": [
          {
            "turnIndex": 2,
            "quote": "えいごの 本です。りょこうのために、えいごを 勉強しています。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "384aada6-16f6-49c9-914d-0861febfb53e",
      "moduleId": "15931cf4-a16b-471c-8b49-8230fddb4b43",
      "sourceLessonId": "015a498e-71e4-4e61-bfa2-60c4cf1dca45",
      "sourceKey": "n4-comprehension-193:384aada6-16f6-49c9-914d-0861febfb53e",
      "expected": {
        "example_dialog": "A: 明日の クラスでは、何を 作りますか。\nB: かみで 花を 作ります。先生は、はさみを 持って 来るように 言いました。\nA: はさみは、かみを きるのに つかうんですね。\nB: はい。のりも ひつようです。\nA: 花を 作るのに、どのくらい かかりますか。\nB: 三十分ぐらいです。",
        "example_dialog_id": "A: Apa yang akan dibuat dalam kelas besok?\nB: Kita membuat bunga dari kertas. Guru meminta kita membawa gunting.\nA: Gunting digunakan untuk memotong kertas, ya.\nB: Ya. Lem juga diperlukan.\nA: Berapa lama diperlukan untuk membuat bunganya?\nB: Sekitar tiga puluh menit.",
        "communication_goal": "Daniel dan Anna menyiapkan kegiatan membuat bunga kertas. Mereka membahas kegunaan gunting dan instruksi guru. はさみ berarti gunting.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "ダニエル"
          },
          {
            "speaker": "B",
            "displayName": "アンナ"
          }
        ]
      },
      "dialogueFingerprint": "sha256:fa8821eb5b2f66504e91a7a68b8281ca8cf1648492511d2ad9ee9d1a9a98fe44",
      "questionFingerprint": "sha256:a16ff1b36ebb10229aeacb1d43a96b853ec1455d22a0de1c5c2a5b19e56a712a",
      "question": {
        "kind": "comprehension",
        "prompt": "Apa yang guru minta dibawa?",
        "options": [
          "Kertas berwarna.",
          "Buku bahasa Jepang.",
          "Gunting."
        ],
        "correctIndex": 2,
        "explanation": "Anna melaporkan はさみをもってくるようにいいました.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "かみで 花を 作ります。先生は、はさみを 持って 来るように 言いました。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "7e65dba0-89b1-43a4-99ef-17b99c2eb1f0",
      "moduleId": "2f6d7bc0-0668-4c19-b52c-0ce627aee300",
      "sourceLessonId": "40003450-995c-478d-8478-242827900ce3",
      "sourceKey": "n4-comprehension-193:7e65dba0-89b1-43a4-99ef-17b99c2eb1f0",
      "expected": {
        "example_dialog": "A: 明日の 試験には、何が ひつようですか。\nB: えんぴつを 持って 来ないと いけません。二本 あった方が いいですよ。\nA: じしょも 持って 行きますか。\nB: いいえ。じしょを 持って 行く ひつようは ありません。\nA: わかりました。今日は 早く ねた方が いいですね。\nB: そうですね。明日、がんばりましょう。",
        "example_dialog_id": "A: Apa yang diperlukan untuk ujian besok?\nB: Kita harus membawa pensil. Sebaiknya ada dua batang.\nA: Apakah kita membawa kamus juga?\nB: Tidak. Tidak perlu membawa kamus.\nA: Saya mengerti. Sebaiknya tidur lebih awal hari ini, ya.\nB: Benar. Mari berusaha sebaik mungkin besok.",
        "communication_goal": "Anna dan Claire memeriksa persiapan ujian. Mereka membedakan saran, kewajiban membawa alat, dan sesuatu yang tidak perlu dibawa.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "アンナ"
          },
          {
            "speaker": "B",
            "displayName": "クレア"
          }
        ]
      },
      "dialogueFingerprint": "sha256:192453bd8129dd16fcb02dba943bc98b7b282d07b97111e03ca38e19c6de6799",
      "questionFingerprint": "sha256:26cc3682de77078da0186e48cea62b4eea12cf6d03d78b29e0dccae6c8f83057",
      "question": {
        "kind": "comprehension",
        "prompt": "Apa yang wajib dibawa Anna untuk ujian?",
        "options": [
          "Pensil.",
          "Kamus.",
          "Gunting."
        ],
        "correctIndex": 0,
        "explanation": "Claire menyatakan えんぴつをもってこないといけません sebagai kewajiban.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "えんぴつを 持って 来ないと いけません。二本 あった方が いいですよ。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "441eb770-2e1e-4752-b7db-74c7764cdf8c",
      "moduleId": "2f6d7bc0-0668-4c19-b52c-0ce627aee300",
      "sourceLessonId": "d33a978d-d1ba-431a-92e8-4624ee449fca",
      "sourceKey": "n4-comprehension-193:441eb770-2e1e-4752-b7db-74c7764cdf8c",
      "expected": {
        "example_dialog": "A: ハディさん、止まれ！ 車が 来ます！\nB: あっ、あぶなかったです。ありがとうございます。\nA: ここには「わたるな」と 書いて あります。あのはしを わたりましょう。\nB: はい。これからは、よく 見ます。",
        "example_dialog_id": "A: Hadi, berhenti! Ada mobil datang!\nB: Ah, tadi berbahaya. Terima kasih.\nA: Di sini tertulis “Jangan menyeberang”. Mari menyeberangi jembatan itu.\nB: Baik. Mulai sekarang saya akan lebih memperhatikan.",
        "communication_goal": "Di dekat stasiun, Ren memperingatkan Hadi saat kendaraan mendekat. Bentuk perintah dipakai karena bahaya segera; larangan pada tanda dibaca sebagai kutipan.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "蓮"
          },
          {
            "speaker": "B",
            "displayName": "ハディ"
          }
        ]
      },
      "dialogueFingerprint": "sha256:2999cd0d03a9c6855dec7b8f16d7af3c782779e20cfe79e243cce5394e5e5ad0",
      "questionFingerprint": "sha256:585976742ba8a39aca866ef3058ad2809819acb0ff2875524670a77f286bde81",
      "question": {
        "kind": "comprehension",
        "prompt": "Mengapa Ren memakai perintah langsung とまれ?",
        "options": [
          "Karena kelas akan segera dimulai.",
          "Karena mobil sedang mendekat dan ada bahaya.",
          "Karena Hadi tidak mendengar petunjuk."
        ],
        "correctIndex": 1,
        "explanation": "くるまがきます memberi konteks darurat; ini bukan contoh permintaan biasa antarteman.",
        "evidence": [
          {
            "turnIndex": 0,
            "quote": "ハディさん、止まれ！ 車が 来ます！"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "fdeb6c11-f394-4655-909e-6e3f814c1b21",
      "moduleId": "4a76eb18-bf1f-4d2b-86bd-fd3a98d3c4a2",
      "sourceLessonId": "a3e9a81d-f5aa-4af1-84ba-f7e60283ef82",
      "sourceKey": "n4-comprehension-193:fdeb6c11-f394-4655-909e-6e3f814c1b21",
      "expected": {
        "example_dialog": "A: そのかばん、新しいですね。\nB: はい。たんじょうびに、姉から もらいました。\nA: すてきですね。そのペンも、お姉さんからですか。\nB: いいえ。ペンは 友だちが くれました。\nA: こんどは、お姉さんに 何か あげますか。\nB: はい。姉の たんじょうびに、花を あげる つもりです。",
        "example_dialog_id": "A: Tas itu baru, ya.\nB: Ya. Saya menerimanya dari kakak perempuan pada ulang tahun saya.\nA: Bagus, ya. Apakah pena itu juga dari kakak perempuan Anda?\nB: Bukan. Pena ini diberikan teman kepada saya.\nA: Lain kali, apakah Anda akan memberikan sesuatu kepada kakak perempuan Anda?\nB: Ya. Saya berniat memberikan bunga pada ulang tahunnya.",
        "communication_goal": "Aoi menanyakan hadiah yang Claire terima pada hari ulang tahunnya. Mereka menyebut pemberi dan penerima dengan jelas, kemudian membahas rencana hadiah balasan.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "葵"
          },
          {
            "speaker": "B",
            "displayName": "クレア"
          }
        ]
      },
      "dialogueFingerprint": "sha256:6f4111b03d4421386d171b909aa9851dadbd5a22f03aca1ff461db7e598fd960",
      "questionFingerprint": "sha256:fb241d58f4c207ffe6feed0358ed6b1f9d92bc662b02f1cd7ff6de7d61f5f1d3",
      "question": {
        "kind": "comprehension",
        "prompt": "Siapa yang memberikan tas kepada Claire?",
        "options": [
          "Teman Claire.",
          "Anna.",
          "Kakak perempuan Claire."
        ],
        "correctIndex": 2,
        "explanation": "Claire mengatakan あねからもらいました.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "はい。たんじょうびに、姉から もらいました。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "cb1e0ca9-29d0-4f54-8432-a8cc0e34e9bd",
      "moduleId": "778fbd4d-82b0-41b8-bd36-e9f995df9fc3",
      "sourceLessonId": "f5d34089-ff55-4a51-acda-8d04e6cddc2d",
      "sourceKey": "n4-comprehension-193:cb1e0ca9-29d0-4f54-8432-a8cc0e34e9bd",
      "expected": {
        "example_dialog": "A: 引っこしは、もう おわりましたか。\nB: はい。友だちが にもつを 持って くれました。\nA: 駅から 新しい うちまでは、どうやって 行きましたか。\nB: 兄に 車で 送って もらいました。\nA: たすかりましたね。\nB: はい。こんどは、私が 友だちの 引っこしを 手つだって あげたいです。",
        "example_dialog_id": "A: Apakah pindah rumahnya sudah selesai?\nB: Ya. Teman membantu saya membawakan barang.\nA: Dari stasiun ke rumah baru, bagaimana Anda pergi?\nB: Saya mendapat bantuan kakak laki-laki mengantar dengan mobil.\nA: Bantuan itu sangat menolong, ya.\nB: Ya. Lain kali saya ingin membantu teman saya pindah rumah.",
        "communication_goal": "Daniel bertanya tentang bantuan saat Hadi pindah rumah. Percakapan menjaga sudut pandang てくれる、てもらう、てあげる dan partikel yang mengikuti verba.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "ダニエル"
          },
          {
            "speaker": "B",
            "displayName": "ハディ"
          }
        ]
      },
      "dialogueFingerprint": "sha256:ba0f80082036da2d37e1a5e9031dedd16296e3f1ba8a30470eaccd6972301920",
      "questionFingerprint": "sha256:e2ea6ca40b98f19487f0e63d22df9fd901837ce4727b3dfc5a57c41c74c11872",
      "question": {
        "kind": "comprehension",
        "prompt": "Siapa yang mengantar Hadi dengan mobil?",
        "options": [
          "Kakak laki-lakinya.",
          "Teman Hadi.",
          "Ren."
        ],
        "correctIndex": 0,
        "explanation": "あにに…おくってもらいました menunjukkan kakak sebagai pelaku bantuan mengantar.",
        "evidence": [
          {
            "turnIndex": 3,
            "quote": "兄に 車で 送って もらいました。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "a45f36e6-96a1-49ba-8c0e-3e96352e7e7a",
      "moduleId": "778fbd4d-82b0-41b8-bd36-e9f995df9fc3",
      "sourceLessonId": "88f32646-5bbe-4791-b8be-af18d2bff13b",
      "sourceKey": "n4-comprehension-193:a45f36e6-96a1-49ba-8c0e-3e96352e7e7a",
      "expected": {
        "example_dialog": "A: すみません。このことばを 読んで もらえませんか。\nB: はい。「図書館」です。\nA: もういちど、ゆっくり 読んで ほしいです。\nB: はい。「と・しょ・か・ん」です。\nA: わかりました。教えて くれて、ありがとう。\nB: どういたしまして。",
        "example_dialog_id": "A: Permisi, bisakah Anda membantu membacakan kata ini?\nB: Ya. Bacaannya “toshokan”.\nA: Saya ingin Anda membacanya perlahan sekali lagi.\nB: Baik. “To-sho-ka-n.”\nA: Saya mengerti. Terima kasih sudah menjelaskannya.\nB: Sama-sama.",
        "communication_goal": "Anna meminta Aoi menjelaskan bacaan suatu kata, menyampaikan keinginan agar dibaca perlahan, lalu berterima kasih atas bantuan yang selesai.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "アンナ"
          },
          {
            "speaker": "B",
            "displayName": "葵"
          }
        ]
      },
      "dialogueFingerprint": "sha256:f8a7b8ce7e636f45ca5212663d0435196f2021d9e9402f7e232cf5bc5fb72c7a",
      "questionFingerprint": "sha256:4e44ceb6eaccdb9112d8e248e4f920fb5b049706709ae45237ef9fe8a70e11e5",
      "question": {
        "kind": "comprehension",
        "prompt": "Bantuan apa yang Anna minta pada awal percakapan?",
        "options": [
          "Menuliskan sebuah kata.",
          "Membacakan sebuah kata.",
          "Membelikan buku."
        ],
        "correctIndex": 1,
        "explanation": "よんでもらえませんか meminta bantuan membaca kata yang ditunjuk.",
        "evidence": [
          {
            "turnIndex": 0,
            "quote": "すみません。このことばを 読んで もらえませんか。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "f0c421b9-ac27-4129-997e-d424784032a6",
      "moduleId": "df881aee-7127-4ccf-b8b8-14a14bb2f798",
      "sourceLessonId": "2959cd36-7a07-4928-b4fb-72b62ab28d6c",
      "sourceKey": "n4-comprehension-193:f0c421b9-ac27-4129-997e-d424784032a6",
      "expected": {
        "example_dialog": "A: 明日、何人 来るか、わかりますか。\nB: 今、来ると 言った 人は 三人だけです。\nA: レンさんも 来ますか。\nB: レンさんが 来られるかどうかは、まだ わかりません。\nA: 三人しか いないんですね。\nB: はい。レンさんに、もういちど 聞いて みます。",
        "example_dialog_id": "A: Apakah Anda tahu berapa orang yang akan datang besok?\nB: Saat ini baru tiga orang yang mengatakan akan datang.\nA: Apakah Ren juga datang?\nB: Saya belum tahu apakah Ren bisa datang atau tidak.\nA: Jadi yang sudah pasti hanya tiga orang, ya.\nB: Ya. Saya akan mencoba menanyakan sekali lagi kepada Ren.",
        "communication_goal": "Claire dan Daniel memeriksa jumlah peserta acara. Mereka membedakan peserta yang sudah pasti dari seseorang yang belum memastikan kehadirannya.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "クレア"
          },
          {
            "speaker": "B",
            "displayName": "ダニエル"
          }
        ]
      },
      "dialogueFingerprint": "sha256:63a7bec3bab07222064bc1d959ae3fecd63f802d358eeedc2a956e89216d51f4",
      "questionFingerprint": "sha256:f0464ca4e73839207cfc2f5907bf08e361617dbf1689399bf9bb91e70e89ab36",
      "question": {
        "kind": "comprehension",
        "prompt": "Berapa peserta yang sudah menyatakan akan datang?",
        "options": [
          "Dua orang.",
          "Lima orang.",
          "Tiga orang."
        ],
        "correctIndex": 2,
        "explanation": "Daniel mengatakan さんにんだけ; Ren belum masuk jumlah yang sudah pasti.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "今、来ると 言った 人は 三人だけです。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "525f3286-15cd-49fa-898e-1b35a7240b62",
      "moduleId": "df881aee-7127-4ccf-b8b8-14a14bb2f798",
      "sourceLessonId": "ea68db2b-380e-415f-a706-76180d7b0ca8",
      "sourceKey": "n4-comprehension-193:525f3286-15cd-49fa-898e-1b35a7240b62",
      "expected": {
        "example_dialog": "A: この図書館は、学生だけが つかえるんですか。\nB: いいえ。学生だけでなく、町の 人も つかえます。\nA: どうすれば、本が 借りられますか。\nB: このカードに 名前を 書くだけで、借りられます。\nA: べんりですね。たくさんの 人が 来ますか。\nB: はい。きのうは 五百人も 来ました。",
        "example_dialog_id": "A: Apakah perpustakaan ini hanya boleh digunakan siswa?\nB: Tidak. Bukan hanya siswa, warga kota juga boleh memakainya.\nA: Apa yang harus saya lakukan agar bisa meminjam buku?\nB: Cukup menulis nama pada kartu ini, Anda dapat meminjam.\nA: Praktis, ya. Apakah banyak orang datang?\nB: Ya. Kemarin sampai lima ratus orang datang.",
        "communication_goal": "Hadi dan Ren membahas layanan perpustakaan untuk siswa dan warga. Mereka memakai だけで、だけでなく、dan も sebagai penekanan jumlah.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "ハディ"
          },
          {
            "speaker": "B",
            "displayName": "蓮"
          }
        ]
      },
      "dialogueFingerprint": "sha256:33499e15f4e441ebf6886b86622d37e164a161e5cee5042f8c1c03c447c4fc05",
      "questionFingerprint": "sha256:f8e430f8e792d8a8548665db62865405d48f41275c588492375c6e432a4b12e5",
      "question": {
        "kind": "comprehension",
        "prompt": "Selain siswa, siapa yang boleh memakai perpustakaan?",
        "options": [
          "Warga kota.",
          "Hanya para guru.",
          "Hanya keluarga siswa."
        ],
        "correctIndex": 0,
        "explanation": "まちのひとも menambahkan warga kota sebagai pengguna.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "いいえ。学生だけでなく、町の 人も つかえます。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "b391824a-4944-467a-ada3-935d375e7ab5",
      "moduleId": "3dd4992b-a41c-4588-92ac-b6373b73d03b",
      "sourceLessonId": "12710081-1e60-410d-baf5-ecc973daa3cb",
      "sourceKey": "n4-comprehension-193:b391824a-4944-467a-ada3-935d375e7ab5",
      "expected": {
        "example_dialog": "A: こうえんまで、歩くと どのくらい かかりますか。\nB: 二十分ぐらいです。バスほど はやく ありません。\nA: バスは 何分ごとに 来ますか。\nB: 十分ごとです。バスなら、五分で 着きます。\nA: じゃ、今日は バスで 行きます。\nB: はい。つぎの バスは、三時ごろ 来ますよ。",
        "example_dialog_id": "A: Berapa lama jika berjalan ke taman?\nB: Sekitar dua puluh menit. Tidak secepat bus.\nA: Bus datang setiap berapa menit?\nB: Setiap sepuluh menit. Kalau naik bus, sampai dalam lima menit.\nA: Kalau begitu, hari ini saya naik bus.\nB: Baik. Bus berikutnya datang sekitar pukul tiga.",
        "communication_goal": "Aoi menanyakan rute ke taman dan Anna menjelaskan pilihan transportasinya. Mereka membandingkan waktu berjalan dan naik bus serta interval bus.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "葵"
          },
          {
            "speaker": "B",
            "displayName": "アンナ"
          }
        ]
      },
      "dialogueFingerprint": "sha256:44ca556a4f0541dbda3da612a12af690ca456d93021e394878aa79646edbf727",
      "questionFingerprint": "sha256:ef56d9ac790105cac9c8fcb5a84d24b6837f0027157fc30c1d4cce662621af23",
      "question": {
        "kind": "comprehension",
        "prompt": "Berapa lama perjalanan berjalan kaki ke taman?",
        "options": [
          "Sekitar lima menit.",
          "Sekitar dua puluh menit.",
          "Sekitar satu jam."
        ],
        "correctIndex": 1,
        "explanation": "Anna menjawab にじゅっぷんぐらい untuk durasi berjalan.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "二十分ぐらいです。バスほど はやく ありません。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "b9365e25-6149-4998-9481-8bcaf30c3809",
      "moduleId": "3dd4992b-a41c-4588-92ac-b6373b73d03b",
      "sourceLessonId": "e2881a0d-ee3f-4700-86b1-ccef2951ec44",
      "sourceKey": "n4-comprehension-193:b9365e25-6149-4998-9481-8bcaf30c3809",
      "expected": {
        "example_dialog": "A: 明日、雨の 場合は、どこで れんしゅうしますか。\nB: この教室です。先生が 言った通りに、つくえを 動かしましょう。\nA: はい。あっ、となりの へやは 電気が ついたままですね。\nB: だれも いませんね。けして 来ます。\nA: ありがとうございます。私たちも、帰る 時に かくにんしましょう。\nB: はい。わすれないように しましょう。",
        "example_dialog_id": "A: Jika besok hujan, di mana kita berlatih?\nB: Di kelas ini. Mari memindahkan meja sesuai yang dikatakan guru.\nA: Baik. Oh, lampu ruangan sebelah masih menyala, ya.\nB: Tidak ada orang, ya. Saya akan mematikannya lalu kembali.\nA: Terima kasih. Kita juga perlu memeriksanya ketika pulang.\nB: Ya. Mari berusaha agar tidak lupa.",
        "communication_goal": "Daniel dan Claire menyiapkan kegiatan kelas sesuai petunjuk guru. Mereka memeriksa lokasi jika hujan dan memastikan lampu dimatikan saat meninggalkan ruangan.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "ダニエル"
          },
          {
            "speaker": "B",
            "displayName": "クレア"
          }
        ]
      },
      "dialogueFingerprint": "sha256:91e2ac86f73f97ca9eaa8b43a694350cb0e99b490142481382a610169a9c447a",
      "questionFingerprint": "sha256:5fbd7ce87a03382e47d2e8949bed377bc4c49a232d0b95b210f66fb1edd510fc",
      "question": {
        "kind": "comprehension",
        "prompt": "Jika hujan, di mana mereka akan berlatih?",
        "options": [
          "Di taman.",
          "Di ruangan sebelah.",
          "Di kelas tempat mereka berada sekarang."
        ],
        "correctIndex": 2,
        "explanation": "Claire menjawab このきょうしつです untuk kondisi hujan.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "この教室です。先生が 言った通りに、つくえを 動かしましょう。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "6fc52ebb-2d7c-4da6-8263-3cc27d7c2b6d",
      "moduleId": "bc0d9617-17b7-4293-8250-542ac9dfdf45",
      "sourceLessonId": "4048438e-6d2e-4322-90fd-b2859e70dada",
      "sourceKey": "n4-comprehension-193:6fc52ebb-2d7c-4da6-8263-3cc27d7c2b6d",
      "expected": {
        "example_dialog": "A: ダニエルさん、うれしそうですね。\nB: はい。先生に 作文を ほめられました。\nA: どんな 作文を 書いたんですか。\nB: 家族の ことを 書きました。「わかりやすい」と 言われました。\nA: よかったですね。私も 読んでも いいですか。\nB: はい。どうぞ。",
        "example_dialog_id": "A: Daniel, Anda terlihat senang.\nB: Ya. Karangan saya dipuji oleh guru.\nA: Karangan tentang apa yang Anda tulis?\nB: Saya menulis tentang keluarga. Saya diberi komentar, “Mudah dipahami.”\nA: Bagus. Bolehkah saya membacanya juga?\nB: Ya. Silakan.",
        "communication_goal": "Ren dan Daniel membicarakan hasil karangan. Kalimat pasif langsung dipakai untuk menunjukkan siapa yang menerima pujian dan siapa pelakunya.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "蓮"
          },
          {
            "speaker": "B",
            "displayName": "ダニエル"
          }
        ]
      },
      "dialogueFingerprint": "sha256:e3357a08b6e14c9244c088e7477c6880b54412d5be6f5eae4e378d78b67e5809",
      "questionFingerprint": "sha256:8ea2fcb97d0a7b075eb9147b11d31d74ac6c51a9ff44487401a4cc3539982567",
      "question": {
        "kind": "comprehension",
        "prompt": "Siapa yang memuji karangan Daniel?",
        "options": [
          "Guru.",
          "Anna.",
          "Keluarganya."
        ],
        "correctIndex": 0,
        "explanation": "せんせいに…ほめられました menandai guru sebagai pelaku pujian.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "はい。先生に 作文を ほめられました。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "b0f52855-f571-478f-a932-33b52781c2ab",
      "moduleId": "bc0d9617-17b7-4293-8250-542ac9dfdf45",
      "sourceLessonId": "755f4715-42e0-4087-b796-b00da9540fb6",
      "sourceKey": "n4-comprehension-193:b0f52855-f571-478f-a932-33b52781c2ab",
      "expected": {
        "example_dialog": "A: きのうは たいへんな 一日でした。\nB: どうしたんですか。\nA: 電車で となりの 人に 足を ふまれました。\nB: えっ、いたかったでしょう。今は だいじょうぶですか。\nA: はい。もう だいじょうぶです。それから、帰りに 雨に ふられて、服も ぬれました。\nB: それは たいへんでしたね。",
        "example_dialog_id": "A: Kemarin hari yang berat.\nB: Ada apa?\nA: Di kereta, kaki saya diinjak orang di sebelah.\nB: Wah, pasti sakit. Sekarang sudah tidak apa-apa?\nA: Ya, sekarang sudah tidak apa-apa. Lalu saat pulang saya kehujanan, dan pakaian saya juga basah.\nB: Wah, itu pasti menyusahkan.",
        "communication_goal": "Hadi menceritakan dua kejadian tidak menyenangkan kemarin kepada Aoi: kakinya diinjak dan ia kehujanan. ぬれる berarti menjadi basah.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "ハディ"
          },
          {
            "speaker": "B",
            "displayName": "葵"
          }
        ]
      },
      "dialogueFingerprint": "sha256:0bcf44660498b00ff76cc9762625c56b2dc01c7e9050d20c4fef7c8650ee3278",
      "questionFingerprint": "sha256:0db6364bb40a4d6ee8ab2192fd4af7df86d581663653098c4712416219954b87",
      "question": {
        "kind": "comprehension",
        "prompt": "Bagian tubuh Hadi yang diinjak adalah apa?",
        "options": [
          "Tangan.",
          "Kaki.",
          "Bahu."
        ],
        "correctIndex": 1,
        "explanation": "あしをふまれました menyatakan dampak pada bagian tubuh Hadi.",
        "evidence": [
          {
            "turnIndex": 2,
            "quote": "電車で となりの 人に 足を ふまれました。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "048f2898-cc0e-4cf4-be16-d18a94db71c7",
      "moduleId": "dec559f0-9e4f-44e2-b89d-e66df1a5525d",
      "sourceLessonId": "481962f1-b0ec-4fd8-8881-cfad7df3bde0",
      "sourceKey": "n4-comprehension-193:048f2898-cc0e-4cf4-be16-d18a94db71c7",
      "expected": {
        "example_dialog": "A: 今日の クラスでは、何を しましたか。\nB: 先生が、学生に 日本語で 話させました。\nA: アンナさんも 話したんですね。どうでしたか。\nB: 少し むずかしかったので、「もう一度 話させて ください」と おねがいしました。\nA: もう一度 できましたか。\nB: はい。先生が もう一度 話させて くれました。",
        "example_dialog_id": "A: Apa yang dilakukan dalam kelas hari ini?\nB: Guru menyuruh siswa berbicara bahasa Jepang.\nA: Anna juga berbicara, ya. Bagaimana hasilnya?\nB: Karena agak sulit, saya meminta, “Izinkan saya berbicara sekali lagi.”\nA: Apakah Anda bisa mencobanya lagi?\nB: Ya. Guru memberi saya kesempatan berbicara sekali lagi.",
        "communication_goal": "Claire dan Anna membahas latihan berbicara. Guru menyuruh siswa berbicara, lalu Anna mendapatkan izin untuk mencoba lagi.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "クレア"
          },
          {
            "speaker": "B",
            "displayName": "アンナ"
          }
        ]
      },
      "dialogueFingerprint": "sha256:c410abb12c7fbe0830c4b162c935899e760a88fc9b82748652ddda8a7e57e8d9",
      "questionFingerprint": "sha256:4837efe3a9021910b9746a65be590becde7333780635fa8f3e2833142f64f2aa",
      "question": {
        "kind": "comprehension",
        "prompt": "Siapa yang menyuruh siswa berbicara bahasa Jepang?",
        "options": [
          "Anna.",
          "Seorang teman.",
          "Guru."
        ],
        "correctIndex": 2,
        "explanation": "せんせいが…はなさせました menunjukkan guru sebagai penyuruh dan siswa sebagai pelaku berbicara.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "先生が、学生に 日本語で 話させました。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "1bd12c89-d0c9-48c8-8f9b-50c0499f68af",
      "moduleId": "dec559f0-9e4f-44e2-b89d-e66df1a5525d",
      "sourceLessonId": "7160069b-1114-4338-b594-60464920e7d6",
      "sourceKey": "n4-comprehension-193:1bd12c89-d0c9-48c8-8f9b-50c0499f68af",
      "expected": {
        "example_dialog": "A: きのう、先生に 作文を 何度も 書かせられました。\nB: 何回 書いたんですか。\nA: 三回も 書かされました。つかれました。\nB: 三回もですか。どこが むずかしかったんですか。\nA: 長い文が うまく 書けませんでした。でも、さいごは よく なりました。\nB: そうですか。がんばりましたね。",
        "example_dialog_id": "A: Kemarin saya disuruh guru menulis karangan berkali-kali meskipun enggan.\nB: Berapa kali Anda menulisnya?\nA: Saya disuruh menulis sampai tiga kali. Saya lelah.\nB: Sampai tiga kali? Bagian mana yang sulit?\nA: Saya tidak bisa menulis kalimat panjang dengan baik. Tetapi akhirnya menjadi lebih baik.\nB: Begitu, ya. Anda sudah berusaha keras.",
        "communication_goal": "Aoi menjelaskan tugas yang harus ditulis berulang kali meskipun ia enggan. Ren mengenali bentuk penuh dan pendek kausatif-pasif tanpa mengubah pelakunya.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "葵"
          },
          {
            "speaker": "B",
            "displayName": "蓮"
          }
        ]
      },
      "dialogueFingerprint": "sha256:9c5feaa9d716c3c0060d3a9da9539ad4738fa397a40db30df2010c9418954562",
      "questionFingerprint": "sha256:db00a3e54ec3075a13670cc430f632b0b770d19d7cba86dbf5330199f616d564",
      "question": {
        "kind": "comprehension",
        "prompt": "Siapa yang menyuruh Aoi menulis karangan berulang kali?",
        "options": [
          "Guru.",
          "Ren.",
          "Daniel."
        ],
        "correctIndex": 0,
        "explanation": "せんせいに…かかせられました menandai guru sebagai penyuruh.",
        "evidence": [
          {
            "turnIndex": 0,
            "quote": "きのう、先生に 作文を 何度も 書かせられました。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "4d327a80-19df-4383-9ecf-c2819ee2b9a1",
      "moduleId": "75f7e5ca-c982-4011-9803-7910b6b91002",
      "sourceLessonId": "cd4149b3-0b27-41d5-adbf-bdd0a69b6f8e",
      "sourceKey": "n4-comprehension-193:4d327a80-19df-4383-9ecf-c2819ee2b9a1",
      "expected": {
        "example_dialog": "A: 先生は、もう お帰りに なりましたか。\nB: いいえ。今、となりの へやで 話されています。\nA: 何時に お帰りに なりますか。\nB: 六時の よていです。ここで お待ちに なりますか。\nA: はい。少し 待ちます。\nB: わかりました。こちらに どうぞ。",
        "example_dialog_id": "A: Apakah Guru sudah pulang?\nB: Belum. Sekarang beliau sedang berbicara di ruangan sebelah.\nA: Pukul berapa beliau akan pulang?\nB: Rencananya pukul enam. Apakah Anda ingin menunggu di sini?\nA: Ya. Saya akan menunggu sebentar.\nB: Baik. Silakan di sini.",
        "communication_goal": "Simulasi penerimaan tamu sekolah: Daniel berperan sebagai tamu yang ingin menemui guru, Hadi sebagai petugas. Mereka memakai sonkeigo untuk tindakan guru, bukan untuk diri sendiri.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "ダニエル"
          },
          {
            "speaker": "B",
            "displayName": "ハディ"
          }
        ]
      },
      "dialogueFingerprint": "sha256:9e98d3a70c12039969ab80182857495a2dcb24a73f11d78b0550b5472fd2a0f1",
      "questionFingerprint": "sha256:ac0cbcb1a1134f7bb9e758397436ce5012c5006fb97582b0c5363786d2d40083",
      "question": {
        "kind": "comprehension",
        "prompt": "Apakah guru sudah pulang ketika Daniel datang?",
        "options": [
          "Ya, guru sudah pulang.",
          "Belum; guru sedang berbicara di ruangan sebelah.",
          "Ya, guru sedang dalam perjalanan pulang."
        ],
        "correctIndex": 1,
        "explanation": "Hadi menjawab いいえ dan menjelaskan となりのへやではなされています.",
        "evidence": [
          {
            "turnIndex": 1,
            "quote": "いいえ。今、となりの へやで 話されています。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "4ff7d528-056e-456a-b117-02174d3000ce",
      "moduleId": "75f7e5ca-c982-4011-9803-7910b6b91002",
      "sourceLessonId": "be48a5d3-e8fe-479c-badf-f31e30a769f0",
      "sourceKey": "n4-comprehension-193:4ff7d528-056e-456a-b117-02174d3000ce",
      "expected": {
        "example_dialog": "A: こちらの メニューを ごらんください。\nB: ありがとうございます。おすすめは 何ですか。\nA: このケーキです。何を めしあがりますか。\nB: では、ケーキと お茶を おねがいします。\nA: はい。少し お待ちください。",
        "example_dialog_id": "A: Silakan melihat menu ini.\nB: Terima kasih. Apa yang direkomendasikan?\nA: Kue ini. Anda ingin menyantap apa?\nB: Kalau begitu, saya pesan kue dan teh.\nA: Baik. Mohon menunggu sebentar.",
        "communication_goal": "Simulasi layanan kafe: Aoi berperan sebagai petugas dan Claire sebagai pelanggan. Petugas menawarkan menu, menanyakan pesanan dengan sonkeigo, lalu meminta pelanggan menunggu.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "葵"
          },
          {
            "speaker": "B",
            "displayName": "クレア"
          }
        ]
      },
      "dialogueFingerprint": "sha256:b623b498d80a41b559cba69438ad4c869ff725e48be6897c296d8eaf46cb4ee4",
      "questionFingerprint": "sha256:99c64224b2bda4c48f4fd41e627a27e7f2b2f3649f25987c4cd4141cdd6e43c8",
      "question": {
        "kind": "comprehension",
        "prompt": "Apa yang dipesan Claire?",
        "options": [
          "Kopi dan roti.",
          "Kue saja.",
          "Kue dan teh."
        ],
        "correctIndex": 2,
        "explanation": "Claire menyebut ケーキとおちゃをおねがいします.",
        "evidence": [
          {
            "turnIndex": 3,
            "quote": "では、ケーキと お茶を おねがいします。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "f0bb035c-2a94-4e0b-b943-e97fb4057610",
      "moduleId": "6bce9509-443d-4932-85c4-b500d6ab2d5a",
      "sourceLessonId": "5368a7ce-fb1a-48cd-a138-c6d99938411e",
      "sourceKey": "n4-comprehension-193:f0bb035c-2a94-4e0b-b943-e97fb4057610",
      "expected": {
        "example_dialog": "A: こちらが うけつけで ございます。\nB: ありがとうございます。かいぎしつは どこですか。\nA: にかいに ございます。私が ごあんないいたします。\nB: おねがいします。このにもつは、ここに おいても いいですか。\nA: はい。にもつは、私が お持ちします。\nB: では、おねがいします。",
        "example_dialog_id": "A: Di sinilah bagian penerimaan.\nB: Terima kasih. Di mana ruang rapatnya?\nA: Di lantai dua. Saya akan mengantar Anda.\nB: Mohon bantuannya. Bolehkah barang bawaan ini saya taruh di sini?\nA: Boleh. Saya yang akan membawakan barangnya.\nB: Kalau begitu, mohon bantuannya.",
        "communication_goal": "Simulasi penerimaan peserta seminar: Ren berperan sebagai petugas dan Anna sebagai tamu. Petugas menyebut lokasi secara formal dan merendahkan tindakan mengantar serta membawakan barang. うけつけ berarti bagian penerimaan.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "蓮"
          },
          {
            "speaker": "B",
            "displayName": "アンナ"
          }
        ]
      },
      "dialogueFingerprint": "sha256:2a631b96e6e52c95a45c0aa4657a12a930156969030f83694f186be23347eeb4",
      "questionFingerprint": "sha256:90b2578bf2aa101bd85918d856953ce26f1119996835fb507ee64006804a87d2",
      "question": {
        "kind": "comprehension",
        "prompt": "Di lantai berapa ruang rapat berada?",
        "options": [
          "Lantai dua.",
          "Lantai satu.",
          "Lantai tiga."
        ],
        "correctIndex": 0,
        "explanation": "Ren mengatakan にかいにございます.",
        "evidence": [
          {
            "turnIndex": 2,
            "quote": "にかいに ございます。私が ごあんないいたします。"
          }
        ],
        "sortOrder": 0
      }
    },
    {
      "grammarId": "7464741d-e555-41d3-9740-20a42e367d4f",
      "moduleId": "6bce9509-443d-4932-85c4-b500d6ab2d5a",
      "sourceLessonId": "13c9f205-cab0-460f-b237-74284b18416a",
      "sourceKey": "n4-comprehension-193:7464741d-e555-41d3-9740-20a42e367d4f",
      "expected": {
        "example_dialog": "A: 先生、いただいた 本を 読みました。ありがとうございました。\nB: どうでしたか。\nA: おもしろかったです。でも、この文が わかりません。読んで いただけませんか。\nB: ええ。ここは「名前を 書いて ください」です。\nA: わかりました。教えて くださって、ありがとうございます。\nB: どういたしまして。",
        "example_dialog_id": "A: Pak Guru, saya sudah membaca buku yang saya terima dari Anda. Terima kasih.\nB: Bagaimana bukunya?\nA: Menarik. Tetapi saya tidak memahami kalimat ini. Dapatkah Anda membacakannya?\nB: Tentu. Bagian ini berbunyi, “Tolong tulis nama.”\nA: Saya mengerti. Terima kasih sudah menjelaskannya.\nB: Sama-sama.",
        "communication_goal": "Simulasi bimbingan membaca: Hadi berperan sebagai peserta dan Daniel sebagai pengajar. Peserta menyebut buku yang diterima, meminta bantuan formal, dan berterima kasih dengan menghormati pemberi bantuan.",
        "participants": [
          {
            "speaker": "A",
            "displayName": "ハディ"
          },
          {
            "speaker": "B",
            "displayName": "ダニエル"
          }
        ]
      },
      "dialogueFingerprint": "sha256:37725d412a5317bd410b1477c26a50db6871f720d13e1a029174b932aa78de1a",
      "questionFingerprint": "sha256:1c3f89b625f714194d3975643671ee2ae8987c7f63f2e2d8c13f01ac5361671b",
      "question": {
        "kind": "comprehension",
        "prompt": "Siapa yang menerima buku dalam simulasi ini?",
        "options": [
          "Guru yang membacakan buku.",
          "Hadi sebagai peserta.",
          "Anna sebagai petugas."
        ],
        "correctIndex": 1,
        "explanation": "Hadi mengatakan いただいたほん, memakai sudut pandang menerima dari pengajar.",
        "evidence": [
          {
            "turnIndex": 0,
            "quote": "先生、いただいた 本を 読みました。ありがとうございました。"
          }
        ],
        "sortOrder": 0
      }
    }
  ]
}$content$::jsonb;
  item jsonb; existing_count integer; actual_participants jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:graph'));
  PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:' || (p->>'courseId')));
  IF NOT EXISTS (SELECT 1 FROM courses WHERE id=(p->>'courseId')::uuid AND slug='n4')
    THEN RAISE EXCEPTION '193: N4 course changed'; END IF;
  IF jsonb_array_length(p->'items') <> 47 OR
     (SELECT count(*) FROM n4_dialogue_backup_190) <> 47
    THEN RAISE EXCEPTION '193: N4 dialogues incomplete'; END IF;
  LOCK TABLE module_grammar,grammar_dialog_questions IN SHARE ROW EXCLUSIVE MODE;
  SELECT count(*) INTO existing_count FROM grammar_dialog_questions
    WHERE source_kind='manual' AND source_key LIKE 'n4-comprehension-193:%';
  IF existing_count NOT IN (0,47) THEN RAISE EXCEPTION '193: partial question set'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p->'items') LOOP
    IF NOT EXISTS (
      SELECT 1 FROM module_grammar g
      JOIN modules m ON m.id=g.module_id
      JOIN lessons l ON l.id=g.lesson_id
      JOIN lessons c ON c.conversation_source_lesson_id=l.id AND c.type='conversation'
      WHERE g.id=(item->>'grammarId')::uuid
        AND g.module_id=(item->>'moduleId')::uuid
        AND g.lesson_id=(item->>'sourceLessonId')::uuid
        AND m.course_id=(p->>'courseId')::uuid AND l.module_id=m.id
        AND g.example_dialog=item->'expected'->>'example_dialog'
        AND g.example_dialog_id=item->'expected'->>'example_dialog_id'
        AND g.communication_goal=item->'expected'->>'communication_goal'
    ) THEN RAISE EXCEPTION '193: dialogue changed: %',item->>'grammarId'; END IF;
    SELECT jsonb_agg(jsonb_build_object('speaker',v.participant->>'speaker',
      'displayName',v.participant->>'displayName') ORDER BY v.position)
      INTO actual_participants
      FROM module_grammar g,
        jsonb_array_elements(g.dialog_scene->'participants') WITH ORDINALITY
          AS v(participant,position)
      WHERE g.id=(item->>'grammarId')::uuid;
    IF actual_participants IS DISTINCT FROM item->'expected'->'participants'
      THEN RAISE EXCEPTION '193: dialogue speakers changed: %',item->>'grammarId'; END IF;
    IF existing_count=47 THEN
      IF NOT EXISTS (SELECT 1 FROM grammar_dialog_questions q
          WHERE q.grammar_id=(item->>'grammarId')::uuid
            AND q.source_lesson_id=(item->>'sourceLessonId')::uuid
            AND q.source_kind='manual' AND q.source_key=item->>'sourceKey'
            AND q.state='active' AND q.kind='comprehension'
            AND q.question_fingerprint=item->>'questionFingerprint'
            AND q.dialogue_fingerprint=item->>'dialogueFingerprint')
        THEN RAISE EXCEPTION '193: applied question changed: %',item->>'grammarId'; END IF;
    ELSIF EXISTS (SELECT 1 FROM grammar_dialog_questions q
        WHERE q.grammar_id=(item->>'grammarId')::uuid)
      THEN RAISE EXCEPTION '193: question already authored: %',item->>'grammarId'; END IF;
  END LOOP;
  IF existing_count=47 THEN RETURN; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p->'items') LOOP
    INSERT INTO grammar_dialog_questions
      (grammar_id,source_lesson_id,kind,prompt,options,correct_index,
       explanation,sort_order,question_fingerprint,dialogue_fingerprint,
       evidence,source_kind,source_key,state)
    VALUES ((item->>'grammarId')::uuid,(item->>'sourceLessonId')::uuid,
      'comprehension',item->'question'->>'prompt',item->'question'->'options',
      (item->'question'->>'correctIndex')::integer,
      item->'question'->>'explanation',0,item->>'questionFingerprint',
      item->>'dialogueFingerprint',item->'question'->'evidence',
      'manual',item->>'sourceKey','active');
  END LOOP;
END
$migration$;
