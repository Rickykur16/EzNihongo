-- Conversations remain inline in the existing 47 Canva-aligned grammar lessons.
CREATE TABLE IF NOT EXISTS n4_dialogue_backup_190(grammar_id uuid PRIMARY KEY,before_data jsonb NOT NULL,created_at timestamptz DEFAULT now());
DO $support$
DECLARE p jsonb := $content${
  "schemaVersion": 1,
  "courseId": "e22d819f-8526-4af6-a8c5-02258c12e6f0",
  "capturedAt": "2026-09-30T21:08:46.506Z",
  "items": [
    {
      "grammarId": "3b41a238-b4f1-4327-a8e9-de69cdfbc804",
      "chapter": 1,
      "moduleId": "61d8ce65-5b6c-4dad-b75d-a3be800cb6c8",
      "lessonId": "82faee90-5585-42cd-89cc-b5a3f8efb990",
      "expectedCore": {
        "id": "3b41a238-b4f1-4327-a8e9-de69cdfbc804",
        "module_id": "61d8ce65-5b6c-4dad-b75d-a3be800cb6c8",
        "lesson_id": "82faee90-5585-42cd-89cc-b5a3f8efb990",
        "pattern": "V bentuk biasa＋N 母が作った料理・使わない物",
        "meaning": "Penjelasan diletakkan sebelum benda: 母が作った料理 = masakan yang ibu buat. が menunjukkan pelaku dalam penjelasan. Gabungkan contoh negatif dan sedang berlangsung di sini; jangan memakai です／ます sebelum N.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: その かばんは、きのう かった かばんですか。\nB: はい。あねが かった かばんです。\nA: あおいのも、あねのですか。\nB: いいえ、あおいのは わたしのです。毎日 つかう かばんです。",
        "example_dialog_id": "A: Apakah tas itu tas yang dibeli kemarin?\nB: Ya. Ini tas yang dibeli kakak perempuan saya.\nA: Apakah yang biru juga milik kakak Anda?\nB: Bukan, yang biru milik saya. Ini tas yang saya pakai setiap hari.",
        "communication_goal": "Anna dan Hadi melihat dua tas di atas meja. Hadi membedakan tas yang dibeli kakaknya dan tas yang dipakai sehari-hari.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "classroom",
          "participants": [
            {
              "characterKey": "anna-wijaya",
              "position": "left",
              "speaker": "A",
              "displayName": "アンナ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "hadi-pratama",
              "position": "right",
              "speaker": "B",
              "displayName": "ハディ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            {
              "speaker": "A",
              "text": "あおいのも、あねのですか。",
              "expression": "berpikir"
            },
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Siapa yang membeli tas pertama?",
          "answer": "Kakak perempuan Hadi.",
          "explanation": "Hadi menyebut あねがかったかばん."
        },
        {
          "prompt": "Tas biru dipakai oleh siapa dan seberapa sering?",
          "answer": "Hadi, setiap hari.",
          "explanation": "あおいのはわたしのです dan 毎日つかう menunjukkan pemilik serta kebiasaannya."
        }
      ]
    },
    {
      "grammarId": "eded72e5-8a76-4a04-8264-436f976f1a2d",
      "chapter": 1,
      "moduleId": "61d8ce65-5b6c-4dad-b75d-a3be800cb6c8",
      "lessonId": "21bb0803-1dde-4d65-a32d-ea13c3140ebd",
      "expectedCore": {
        "id": "eded72e5-8a76-4a04-8264-436f976f1a2d",
        "module_id": "61d8ce65-5b6c-4dad-b75d-a3be800cb6c8",
        "lesson_id": "21bb0803-1dde-4d65-a32d-ea13c3140ebd",
        "pattern": "V bentuk biasa＋の Vるのが好き／上手・Vるのは楽しい",
        "meaning": "Membicarakan kegiatan: 泳ぐのが好きです = saya suka berenang. の membuat kegiatan dapat menjadi hal yang dibicarakan.",
        "sort_order": 2
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: しゅみは 何ですか。\nB: しゃしんを とることです。花の しゃしんを とるのが すきです。\nA: いいですね。わたしは しょうせつを よむのが すきです。\nB: どんな しょうせつを よみますか。\nA: 日本の しょうせつです。こうえんで よむのは たのしいです。\nB: ここは しずかですから、いいですね。",
        "example_dialog_id": "A: Apa hobi Anda?\nB: Memotret. Saya suka memotret bunga.\nA: Bagus, ya. Saya suka membaca novel.\nB: Novel seperti apa yang Anda baca?\nA: Novel Jepang. Membaca di taman itu menyenangkan.\nB: Tempat ini tenang, jadi cocok, ya.",
        "communication_goal": "Hadi dan Aoi membicarakan hobi di taman. Kesukaan pada fotografi dibandingkan dengan hobi membaca novel.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "park",
          "participants": [
            {
              "characterKey": "hadi-pratama",
              "position": "left",
              "speaker": "A",
              "displayName": "ハディ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "aoi-takahashi",
              "position": "right",
              "speaker": "B",
              "displayName": "葵",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            {
              "speaker": "B",
              "text": "しゃしんを とることです。花の しゃしんを とるのが すきです。",
              "expression": "senang"
            },
            null,
            null,
            null,
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Apa yang suka dipotret Aoi?",
          "answer": "Bunga.",
          "explanation": "Aoi mengatakan 花のしゃしんをとるのがすきです."
        },
        {
          "prompt": "Kegiatan apa yang dinilai Hadi menyenangkan di taman?",
          "answer": "Membaca novel.",
          "explanation": "Hadi menyebut novel Jepang, lalu こうえんでよむのはたのしいです."
        }
      ]
    },
    {
      "grammarId": "fedee2bc-5852-4576-a9e5-a764b6a38859",
      "chapter": 2,
      "moduleId": "d29f8cdb-e5e7-47f1-8f84-e0b840a17b70",
      "lessonId": "bd69d351-2763-4c05-aee0-a01f50aaa086",
      "expectedCore": {
        "id": "fedee2bc-5852-4576-a9e5-a764b6a38859",
        "module_id": "d29f8cdb-e5e7-47f1-8f84-e0b840a17b70",
        "lesson_id": "bd69d351-2763-4c05-aee0-a01f50aaa086",
        "pattern": "普通形＋んです／のです N・Aな：だ→な＋んです",
        "meaning": "Menjelaskan konteks; termasuk なんです、たんです、ないんです、んですか. Kasual: V／Aい＋の？、N／Aな＋なの？.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: もう かえりますか。\nB: はい。あした しけんが あるんです。\nA: そうですか。いえで べんきょうしますか。\nB: はい。でも、この ことばが わからないんですが、せつめいしてください。\nA: はい。この ことばの いみは「休み」です。\nB: わかりました。ありがとうございます。",
        "example_dialog_id": "A: Sudah mau pulang?\nB: Ya. Soalnya besok ada ujian.\nA: Oh, begitu. Akan belajar di rumah?\nB: Ya. Tapi saya tidak mengerti kata ini; tolong jelaskan.\nA: Bisa. Arti kata ini adalah “libur”.\nB: Saya mengerti sekarang. Terima kasih.",
        "communication_goal": "Aoi melihat Ren hendak pulang lebih awal. Ren menjelaskan ujian besok lalu meminta bantuan memahami satu kata.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "classroom",
          "participants": [
            {
              "characterKey": "aoi-takahashi",
              "position": "left",
              "speaker": "A",
              "displayName": "葵",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "ren-mori",
              "position": "right",
              "speaker": "B",
              "displayName": "蓮",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            {
              "speaker": "B",
              "text": "はい。でも、この ことばが わからないんですが、せつめいしてください。",
              "expression": "bingung"
            },
            null,
            {
              "speaker": "B",
              "text": "わかりました。ありがとうございます。",
              "expression": "senang"
            }
          ]
        }
      },
      "checks": [
        {
          "prompt": "Mengapa Ren pulang lebih awal?",
          "answer": "Karena besok ada ujian dan ia akan belajar di rumah.",
          "explanation": "Ren menjelaskan しけんがあるんです dan membenarkan rencana belajar di rumah."
        },
        {
          "prompt": "Bantuan apa yang diminta Ren sebelum pulang?",
          "answer": "Penjelasan arti sebuah kata.",
          "explanation": "わからないんですが membuka permintaan せつめいしてください."
        }
      ]
    },
    {
      "grammarId": "a60c9112-86e9-4e45-bbc1-bcbe9ebf7873",
      "chapter": 2,
      "moduleId": "d29f8cdb-e5e7-47f1-8f84-e0b840a17b70",
      "lessonId": "4ac87534-1de1-4a7d-b189-b7cbdb595192",
      "expectedCore": {
        "id": "a60c9112-86e9-4e45-bbc1-bcbe9ebf7873",
        "module_id": "d29f8cdb-e5e7-47f1-8f84-e0b840a17b70",
        "lesson_id": "4ac87534-1de1-4a7d-b189-b7cbdb595192",
        "pattern": "普通形＋と思う／と思っています",
        "meaning": "Menyatakan pendapat atau pemikiran. N dan Aな mempertahankan だ: 学生だと思います.",
        "sort_order": 3
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: 『はる』という 本を よみましたか。\nB: はい。とても おもしろいと おもいます。\nA: わたしも そう おもいます。友だちも「おもしろかった」と いっていました。\nB: その 友だちも 日本の 本が すきですか。\nA: はい。毎週 本を かうと いっていました。\nB: たくさん よんでいますね。",
        "example_dialog_id": "A: Sudah membaca buku berjudul Haru?\nB: Sudah. Menurut saya sangat menarik.\nA: Saya juga berpikir begitu. Teman saya juga bilang, “Menarik.”\nB: Apakah teman itu juga suka buku Jepang?\nA: Ya. Ia bilang membeli buku setiap minggu.\nB: Banyak membaca, ya.",
        "communication_goal": "Ren dan Claire membandingkan pendapat mereka tentang sebuah buku dan menyampaikan komentar seorang teman.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "cafe",
          "participants": [
            {
              "characterKey": "ren-mori",
              "position": "left",
              "speaker": "A",
              "displayName": "蓮",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "claire-bennett",
              "position": "right",
              "speaker": "B",
              "displayName": "クレア",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            {
              "speaker": "B",
              "text": "はい。とても おもしろいと おもいます。",
              "expression": "senang"
            },
            null,
            null,
            null,
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Bagaimana pendapat Ren dan Claire tentang Haru?",
          "answer": "Keduanya menilai buku itu menarik.",
          "explanation": "Claire menyampaikan おもしろいとおもいます dan Ren menyetujuinya."
        },
        {
          "prompt": "Seberapa sering teman Ren mengatakan ia membeli buku?",
          "answer": "Setiap minggu.",
          "explanation": "Ren melaporkan 毎週本をかうといっていました."
        }
      ]
    },
    {
      "grammarId": "95cd10ea-b201-4c44-83de-1b7aeff42c07",
      "chapter": 3,
      "moduleId": "377eb9d6-2986-4893-980b-1fe92a871b9e",
      "lessonId": "5e2824e2-5d88-48cb-94cf-07bff41f7205",
      "expectedCore": {
        "id": "95cd10ea-b201-4c44-83de-1b7aeff42c07",
        "module_id": "377eb9d6-2986-4893-980b-1fe92a871b9e",
        "lesson_id": "5e2824e2-5d88-48cb-94cf-07bff41f7205",
        "pattern": "V普通形＋とき ／ Aい＋とき Aな＋なとき ／ N＋のとき",
        "meaning": "Ketika …; perbedaan Vるとき dan Vたとき mengikuti hubungan waktunya.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: 電車は 何時ですか。\nB: 十時です。九時半までに ここへ 来てください。\nA: そのまえに、あさごはんを たべても いいですか。\nB: はい。たべたあとで、ここで まちましょう。\nA: 九時半までに ここへ 来ます。\nB: はい。わたしも ここで まちます。",
        "example_dialog_id": "A: Keretanya pukul berapa?\nB: Pukul sepuluh. Silakan kembali ke sini paling lambat setengah sepuluh.\nA: Bolehkah sarapan sebelumnya?\nB: Boleh. Setelah makan, mari menunggu di sini.\nA: Saya akan datang ke sini paling lambat setengah sepuluh.\nB: Baik. Saya juga akan menunggu di sini.",
        "communication_goal": "Claire dan Daniel menyusun waktu makan sebelum kereta berangkat, dengan batas kembali ke stasiun yang jelas.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "station",
          "participants": [
            {
              "characterKey": "claire-bennett",
              "position": "left",
              "speaker": "A",
              "displayName": "クレア",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "daniel-foster",
              "position": "right",
              "speaker": "B",
              "displayName": "ダニエル",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            null,
            null,
            {
              "speaker": "B",
              "text": "はい。わたしも ここで まちます。",
              "expression": "senang"
            }
          ]
        }
      },
      "checks": [
        {
          "prompt": "Paling lambat pukul berapa Claire harus kembali?",
          "answer": "Pukul 09.30.",
          "explanation": "Daniel memakai 九時半までに untuk menetapkan tenggat kembali."
        },
        {
          "prompt": "Apa yang akan dilakukan setelah sarapan?",
          "answer": "Menunggu di stasiun ini.",
          "explanation": "たべたあとで、ここでまちましょう menempatkan menunggu setelah makan."
        }
      ]
    },
    {
      "grammarId": "773ded4a-7972-4a97-a07c-0b940908c219",
      "chapter": 3,
      "moduleId": "377eb9d6-2986-4893-980b-1fe92a871b9e",
      "lessonId": "a97483b5-98b5-49ed-8e5b-4e2e9d6bfa0a",
      "expectedCore": {
        "id": "773ded4a-7972-4a97-a07c-0b940908c219",
        "module_id": "377eb9d6-2986-4893-980b-1fe92a871b9e",
        "lesson_id": "a97483b5-98b5-49ed-8e5b-4e2e9d6bfa0a",
        "pattern": "Vたり、Vたりする",
        "meaning": "Menyebut beberapa contoh kegiatan. Bentuk berasal dari Vた＋り; urutan bukan fokus utama.",
        "sort_order": 5
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: 日よう日は 何を しましたか。\nB: 本を よんだり、りょうりを つくったりしました。\nA: おんがくも ききましたか。\nB: はい。おんがくを ききながら、りょうりを つくりました。\nA: わたしは テレビを みないで、早く ねました。\nB: ゆっくり 休みましたね。",
        "example_dialog_id": "A: Apa yang Anda lakukan hari Minggu?\nB: Saya antara lain membaca buku dan memasak.\nA: Apakah juga mendengarkan musik?\nB: Ya. Saya memasak sambil mendengarkan musik.\nA: Saya tidur lebih awal tanpa menonton televisi.\nB: Anda beristirahat dengan santai, ya.",
        "communication_goal": "Daniel dan Anna menceritakan kegiatan hari Minggu. Anna menjelaskan kegiatan memasak sambil mendengarkan musik.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "park",
          "participants": [
            {
              "characterKey": "daniel-foster",
              "position": "left",
              "speaker": "A",
              "displayName": "ダニエル",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "anna-wijaya",
              "position": "right",
              "speaker": "B",
              "displayName": "アンナ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            {
              "speaker": "B",
              "text": "はい。おんがくを ききながら、りょうりを つくりました。",
              "expression": "senang"
            },
            null,
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Dua kegiatan apa yang dilakukan Anna bersamaan?",
          "answer": "Memasak dan mendengarkan musik.",
          "explanation": "ききながら、りょうりをつくりました menunjukkan kegiatan bersamaan dengan pelaku yang sama."
        },
        {
          "prompt": "Kegiatan apa yang dilewatkan Daniel sebelum tidur?",
          "answer": "Menonton televisi.",
          "explanation": "テレビをみないで berarti tidur tanpa menonton televisi."
        }
      ]
    },
    {
      "grammarId": "820d48d1-48a8-47c9-b259-800de763b9c7",
      "chapter": 4,
      "moduleId": "c8c66af8-2437-4b15-bfeb-0879118ef48d",
      "lessonId": "c124d3ee-2fa9-41d4-aa36-28a2f83f8c17",
      "expectedCore": {
        "id": "820d48d1-48a8-47c9-b259-800de763b9c7",
        "module_id": "c8c66af8-2437-4b15-bfeb-0879118ef48d",
        "lesson_id": "c124d3ee-2fa9-41d4-aa36-28a2f83f8c17",
        "pattern": "可能形：G1 u → e＋る；G2 る → られる する→できる；来る→来られる（こられる）",
        "meaning": "Bentuk potensial: 書ける、食べられる. Sertakan negatif, lampau, dan objek が／を menurut konstruksi.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: ここで パソコンを つかうことができますか。\nB: はい、つかえます。あの パソコンは いま つかっていません。\nA: 日本語も かけますか。\nB: はい、日本語で レポートを かくことができます。\nA: じゃあ、つかいます。ありがとうございます。\nB: どうぞ。",
        "example_dialog_id": "A: Bisa memakai komputer di sini?\nB: Ya, bisa. Komputer yang di sana sekarang tidak sedang dipakai.\nA: Bisa menulis bahasa Jepang juga?\nB: Ya, bisa menulis laporan dalam bahasa Jepang.\nA: Kalau begitu saya akan memakainya. Terima kasih.\nB: Silakan.",
        "communication_goal": "Anna menanyakan penggunaan komputer kepada Aoi. Mereka memastikan fasilitas yang tersedia dan kemampuan mengetik bahasa Jepang.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "classroom",
          "participants": [
            {
              "characterKey": "anna-wijaya",
              "position": "left",
              "speaker": "A",
              "displayName": "アンナ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "aoi-takahashi",
              "position": "right",
              "speaker": "B",
              "displayName": "葵",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            null,
            {
              "speaker": "A",
              "text": "じゃあ、つかいます。ありがとうございます。",
              "expression": "senang"
            },
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Apakah komputer yang ditunjuk sedang digunakan?",
          "answer": "Tidak.",
          "explanation": "Aoi mengatakan いまつかっていません."
        },
        {
          "prompt": "Apa yang dapat ditulis memakai komputer itu?",
          "answer": "Laporan dalam bahasa Jepang.",
          "explanation": "日本語でレポートをかくことができます menjelaskan kemampuan yang tersedia."
        }
      ]
    },
    {
      "grammarId": "a71867c0-a1f5-45ec-bd43-9594fa317e20",
      "chapter": 4,
      "moduleId": "c8c66af8-2437-4b15-bfeb-0879118ef48d",
      "lessonId": "593ce3af-d379-446f-b81e-8fc7866576d9",
      "expectedCore": {
        "id": "a71867c0-a1f5-45ec-bd43-9594fa317e20",
        "module_id": "c8c66af8-2437-4b15-bfeb-0879118ef48d",
        "lesson_id": "593ce3af-d379-446f-b81e-8fc7866576d9",
        "pattern": "Nが見える／聞こえる Nが見られる／聞ける",
        "meaning": "Terlihat/terdengar secara perseptual vs dapat/kesempatan melihat atau mendengar.",
        "sort_order": 3
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: この まどから 山が みえますね。\nB: はい。きょうは てんきが いいです。\nA: コーヒーの いい においも します。\nB: そうですね。コーヒーを のみませんか。\nA: いいですね。わたしは あたたかい コーヒーに します。\nB: わたしも そうします。",
        "example_dialog_id": "A: Gunung terlihat dari jendela ini, ya.\nB: Ya. Cuaca hari ini bagus.\nA: Aroma kopi yang harum juga tercium.\nB: Benar. Mau minum kopi?\nA: Boleh. Saya pilih kopi hangat.\nB: Saya juga pilih itu.",
        "communication_goal": "Hadi dan Ren duduk dekat jendela kafe, mengamati gunung dan mengenali aroma kopi.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "cafe",
          "participants": [
            {
              "characterKey": "hadi-pratama",
              "position": "left",
              "speaker": "A",
              "displayName": "ハディ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "ren-mori",
              "position": "right",
              "speaker": "B",
              "displayName": "蓮",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            {
              "speaker": "A",
              "text": "コーヒーの いい においも します。",
              "expression": "senang"
            },
            null,
            null,
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Apa yang terlihat dari jendela kafe?",
          "answer": "Gunung.",
          "explanation": "Hadi menyatakan 山がみえます."
        },
        {
          "prompt": "Minuman apa yang akhirnya dipilih kedua orang?",
          "answer": "Kopi hangat.",
          "explanation": "Hadi memilih あたたかいコーヒー; Ren mengatakan わたしもそうします."
        }
      ]
    },
    {
      "grammarId": "6a20afd1-7455-47fe-9518-ed99e6b659cd",
      "chapter": 5,
      "moduleId": "bc1ef866-bb68-4404-8f08-f8cc3e621255",
      "lessonId": "d8061cf1-edeb-4a18-a854-f96003cbee4c",
      "expectedCore": {
        "id": "6a20afd1-7455-47fe-9518-ed99e6b659cd",
        "module_id": "bc1ef866-bb68-4404-8f08-f8cc3e621255",
        "lesson_id": "d8061cf1-edeb-4a18-a854-f96003cbee4c",
        "pattern": "意向形＋（と思う／と思っている） G1 u→o＋う；G2 る→よう；しよう・来よう",
        "meaning": "Bentuk volisional untuk ajakan/tekad; ditambah と思う untuk niat. Konjugasi lengkap ada di lampiran.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: 来月も この クラスに 来ますか。\nB: はい。もっと べんきょうしようと おもっています。\nA: 毎日 来ますか。\nB: 月よう日と 水よう日と 金よう日に 来ることにしました。\nA: じゅぎょうは 何時からですか。\nB: 来月から 九時に はじまることになりました。",
        "example_dialog_id": "A: Bulan depan juga akan datang ke kelas ini?\nB: Ya. Saya berniat belajar lebih banyak.\nA: Akan datang setiap hari?\nB: Saya memutuskan datang pada hari Senin, Rabu, dan Jumat.\nA: Pelajarannya mulai pukul berapa?\nB: Mulai bulan depan, sudah ditetapkan pelajaran mulai pukul sembilan.",
        "communication_goal": "Aoi menanyakan rencana Claire mengikuti kelas. Claire membedakan keputusan pribadinya dengan jadwal yang ditetapkan sekolah.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "classroom",
          "participants": [
            {
              "characterKey": "aoi-takahashi",
              "position": "left",
              "speaker": "A",
              "displayName": "葵",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "claire-bennett",
              "position": "right",
              "speaker": "B",
              "displayName": "クレア",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            {
              "speaker": "B",
              "text": "月よう日と 水よう日と 金よう日に 来ることにしました。",
              "expression": "berpikir"
            },
            null,
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Pada hari apa saja Claire memutuskan datang?",
          "answer": "Senin, Rabu, dan Jumat.",
          "explanation": "Claire menyebut tiga hari tersebut dengan 来ることにしました."
        },
        {
          "prompt": "Jadwal mulai pelajaran yang sudah ditetapkan adalah pukul berapa?",
          "answer": "Pukul 9, mulai bulan depan.",
          "explanation": "九時にはじまることになりました melaporkan jadwal yang ditetapkan."
        }
      ]
    },
    {
      "grammarId": "0fe354f8-3553-4fdc-963d-48697dacd11e",
      "chapter": 5,
      "moduleId": "bc1ef866-bb68-4404-8f08-f8cc3e621255",
      "lessonId": "4b87734e-e4fa-4bd7-93ee-ec2021aa6d7a",
      "expectedCore": {
        "id": "0fe354f8-3553-4fdc-963d-48697dacd11e",
        "module_id": "bc1ef866-bb68-4404-8f08-f8cc3e621255",
        "lesson_id": "4b87734e-e4fa-4bd7-93ee-ec2021aa6d7a",
        "pattern": "Vる／Vない＋ことにしている",
        "meaning": "Menetapkan suatu kebiasaan/aturan untuk diri sendiri; bandingkan dengan keputusan satu kali ことにする.",
        "sort_order": 3
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: さいきん、日本語の 本を よんでいますね。\nB: はい。毎朝 十分 よむことにしています。\nA: 前より よめるようになりましたか。\nB: はい。かんたんな 本が よめるようになりました。\nA: わたしも 毎日 よむようにします。\nB: いいですね。いっしょに がんばりましょう。",
        "example_dialog_id": "A: Akhir-akhir ini Anda membaca buku bahasa Jepang, ya.\nB: Ya. Saya menetapkan kebiasaan membaca sepuluh menit setiap pagi.\nA: Apakah sekarang menjadi lebih bisa membaca daripada sebelumnya?\nB: Ya. Sekarang saya bisa membaca buku sederhana.\nA: Saya juga akan berusaha membaca setiap hari.\nB: Bagus. Mari berusaha bersama.",
        "communication_goal": "Ren dan Daniel membicarakan kebiasaan membaca. Daniel menjelaskan kemajuan yang dihasilkan kebiasaan kecil setiap pagi.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "park",
          "participants": [
            {
              "characterKey": "ren-mori",
              "position": "left",
              "speaker": "A",
              "displayName": "蓮",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "daniel-foster",
              "position": "right",
              "speaker": "B",
              "displayName": "ダニエル",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            {
              "speaker": "B",
              "text": "はい。かんたんな 本が よめるようになりました。",
              "expression": "senang"
            },
            null,
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Apa kebiasaan membaca Daniel?",
          "answer": "Membaca sepuluh menit setiap pagi.",
          "explanation": "毎朝十分よむことにしています menjelaskan kebiasaan yang sengaja ditetapkan."
        },
        {
          "prompt": "Kemampuan apa yang berkembang?",
          "answer": "Membaca buku sederhana dalam bahasa Jepang.",
          "explanation": "かんたんな本がよめるようになりました menyatakan perubahan kemampuan."
        }
      ]
    },
    {
      "grammarId": "6060cab0-e192-40cb-9e7f-71ca0973f18d",
      "chapter": 6,
      "moduleId": "d9db5f79-38e6-4dcf-ba46-9f29be362877",
      "lessonId": "81a1fb2a-2e2e-4cbf-9500-36d49b43cd2f",
      "expectedCore": {
        "id": "6060cab0-e192-40cb-9e7f-71ca0973f18d",
        "module_id": "d9db5f79-38e6-4dcf-ba46-9f29be362877",
        "lesson_id": "81a1fb2a-2e2e-4cbf-9500-36d49b43cd2f",
        "pattern": "Vて＋みる",
        "meaning": "Mencoba melakukan; てみたい adalah penerapan pola ini dengan たい, bukan pola baru.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: きのう、ケーキを つくってみました。\nB: どうでしたか。\nA: おいしかったです。かぞくと ぜんぶ たべてしまいました。\nB: えっ、ぜんぶですか。\nA: はい。また つくろうと おもっています。\nB: いいですね。わたしも つくってみたいです。",
        "example_dialog_id": "A: Kemarin saya mencoba membuat kue.\nB: Bagaimana hasilnya?\nA: Enak. Sudah saya habiskan bersama keluarga.\nB: Wah, semuanya?\nA: Ya. Saya berniat membuatnya lagi.\nB: Bagus. Saya juga ingin mencoba membuatnya.",
        "communication_goal": "Claire dan Anna membicarakan kue buatan Claire. Percobaan berhasil dan kuenya sudah habis dimakan.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "cafe",
          "participants": [
            {
              "characterKey": "claire-bennett",
              "position": "left",
              "speaker": "A",
              "displayName": "クレア",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "anna-wijaya",
              "position": "right",
              "speaker": "B",
              "displayName": "アンナ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            {
              "speaker": "A",
              "text": "おいしかったです。かぞくと ぜんぶ たべてしまいました。",
              "expression": "senang"
            },
            {
              "speaker": "B",
              "text": "えっ、ぜんぶですか。",
              "expression": "kaget"
            },
            null,
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Siapa yang menghabiskan kue?",
          "answer": "Claire bersama keluarganya.",
          "explanation": "Claire menyebut かぞくとぜんぶたべてしまいました."
        },
        {
          "prompt": "Apakah てしまいました di sini menegaskan penyesalan?",
          "answer": "Tidak; menegaskan kue sudah habis, dan hasilnya disukai.",
          "explanation": "Kuenya disebut enak dan Claire ingin membuat lagi, sehingga konteksnya penyelesaian."
        }
      ]
    },
    {
      "grammarId": "64e59ad7-df3a-436e-b766-ddf5b8d8492e",
      "chapter": 6,
      "moduleId": "d9db5f79-38e6-4dcf-ba46-9f29be362877",
      "lessonId": "f520201f-e281-4f38-80d9-324705a0af78",
      "expectedCore": {
        "id": "64e59ad7-df3a-436e-b766-ddf5b8d8492e",
        "module_id": "d9db5f79-38e6-4dcf-ba46-9f29be362877",
        "lesson_id": "f520201f-e281-4f38-80d9-324705a0af78",
        "pattern": "Vて＋よかった ／ Vなくて＋よかった",
        "meaning": "Senang/lega karena melakukan atau tidak melakukan sesuatu.",
        "sort_order": 3
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: おくれて すみません。\nB: だいじょうぶです。電車は あと 五分です。\nA: よかった。電車に まにあって よかったです。\nB: はい。きっぷは ありますか。\nA: はい、あります。きのう かいました。\nB: じゃあ、いきましょう。",
        "example_dialog_id": "A: Maaf saya terlambat.\nB: Tidak apa-apa. Keretanya masih lima menit lagi.\nA: Syukurlah. Lega bisa sempat naik kereta.\nB: Ya. Apakah tiketnya ada?\nA: Ya, ada. Saya membelinya kemarin.\nB: Kalau begitu, mari berangkat.",
        "communication_goal": "Daniel terlambat menemui Hadi di stasiun dan meminta maaf. Mereka lega keretanya belum berangkat.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "station",
          "participants": [
            {
              "characterKey": "daniel-foster",
              "position": "left",
              "speaker": "A",
              "displayName": "ダニエル",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "hadi-pratama",
              "position": "right",
              "speaker": "B",
              "displayName": "ハディ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            {
              "speaker": "A",
              "text": "よかった。電車に まにあって よかったです。",
              "expression": "senang"
            },
            null,
            null,
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Mengapa Daniel meminta maaf?",
          "answer": "Karena terlambat datang.",
          "explanation": "Dialog dibuka dengan おくれてすみません."
        },
        {
          "prompt": "Mengapa mereka masih bisa naik kereta?",
          "answer": "Kereta masih lima menit lagi dan Daniel sudah memiliki tiket.",
          "explanation": "Hadi menyebut あと五分, lalu Daniel membenarkan tiket sudah dibeli kemarin."
        }
      ]
    },
    {
      "grammarId": "e57880e8-761f-449c-8ea6-da9f802ace6e",
      "chapter": 7,
      "moduleId": "dd5c6d36-8dfb-4c1f-bf61-62a574229b1f",
      "lessonId": "22172988-3428-4d68-ade0-52b1c3814496",
      "expectedCore": {
        "id": "e57880e8-761f-449c-8ea6-da9f802ace6e",
        "module_id": "dd5c6d36-8dfb-4c1f-bf61-62a574229b1f",
        "lesson_id": "22172988-3428-4d68-ade0-52b1c3814496",
        "pattern": "Nを＋他動詞 ／ Nが＋自動詞",
        "meaning": "Verba transitif-intransitif: ドアを開ける／ドアが開く. Pasangan dipelajari sebagai kosakata terkait.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: 電気が ついていますね。\nB: はい。わたしが けします。\nA: まども あいています。\nB: じゃあ、まども しめます。\nA: ありがとうございます。わたしは ドアを しめます。\nB: はい。いっしょに かえりましょう。",
        "example_dialog_id": "A: Lampunya menyala, ya.\nB: Ya. Saya akan mematikannya.\nA: Jendelanya juga terbuka.\nB: Kalau begitu saya tutup jendelanya juga.\nA: Terima kasih. Saya akan menutup pintu.\nB: Baik. Mari pulang bersama.",
        "communication_goal": "Anna dan Hadi memeriksa keadaan kelas sebelum pulang. Mereka membedakan keadaan lampu dengan tindakan mematikannya.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "classroom",
          "participants": [
            {
              "characterKey": "anna-wijaya",
              "position": "left",
              "speaker": "A",
              "displayName": "アンナ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "hadi-pratama",
              "position": "right",
              "speaker": "B",
              "displayName": "ハディ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            null,
            {
              "speaker": "A",
              "text": "ありがとうございます。わたしは ドアを しめます。",
              "expression": "senang"
            },
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Bagaimana keadaan lampu pada awal percakapan?",
          "answer": "Menyala.",
          "explanation": "電気がついています melaporkan keadaan awal lampu."
        },
        {
          "prompt": "Siapa yang akan menutup pintu?",
          "answer": "Anna.",
          "explanation": "Anna, penutur pertama, mengatakan わたしはドアをしめます."
        }
      ]
    },
    {
      "grammarId": "927f5138-3988-45d7-ab3a-d4eebfd9ae13",
      "chapter": 7,
      "moduleId": "dd5c6d36-8dfb-4c1f-bf61-62a574229b1f",
      "lessonId": "85aa72cb-5b3e-4740-86d8-21d31bb00932",
      "expectedCore": {
        "id": "927f5138-3988-45d7-ab3a-d4eebfd9ae13",
        "module_id": "dd5c6d36-8dfb-4c1f-bf61-62a574229b1f",
        "lesson_id": "85aa72cb-5b3e-4740-86d8-21d31bb00932",
        "pattern": "Nが＋他動詞てある Nを＋Vてある juga dipakai pada konteks persiapan",
        "meaning": "Hasil tindakan yang sengaja dilakukan masih ada; misalnya persiapan atau penataan.",
        "sort_order": 3
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: いすが ならべてありますね。\nB: はい。あしたの じゅぎょうで つかいます。\nA: 本も じゅんびしてありますか。\nB: いいえ。いまから じゅんびしておきます。\nA: では、わたしが 本を おきます。ここで いいですか。\nB: はい。その テーブルに おいてください。",
        "example_dialog_id": "A: Kursinya sudah disusun, ya.\nB: Ya. Akan dipakai dalam pelajaran besok.\nA: Apakah bukunya juga sudah disiapkan?\nB: Belum. Saya akan menyiapkannya sekarang untuk besok.\nA: Kalau begitu, saya yang meletakkan buku-bukunya. Boleh di sini?\nB: Ya. Letakkan di meja itu.",
        "communication_goal": "Hadi dan Aoi memeriksa persiapan kelas besok: kursi sudah tersusun, buku masih perlu disiapkan.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "classroom",
          "participants": [
            {
              "characterKey": "hadi-pratama",
              "position": "left",
              "speaker": "A",
              "displayName": "ハディ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "aoi-takahashi",
              "position": "right",
              "speaker": "B",
              "displayName": "葵",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            {
              "speaker": "B",
              "text": "いいえ。いまから じゅんびしておきます。",
              "expression": "berpikir"
            },
            null,
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Apa yang sudah siap pada awal percakapan?",
          "answer": "Susunan kursi.",
          "explanation": "いすがならべてあります menyatakan hasil persiapan kursi yang sudah ada."
        },
        {
          "prompt": "Di mana buku akan diletakkan?",
          "answer": "Di meja yang ditunjuk Aoi.",
          "explanation": "Aoi meminta そのテーブルにおいてください setelah Hadi menawarkan bantuan."
        }
      ]
    },
    {
      "grammarId": "cdc54833-4399-44a8-a1c4-4802c5fda033",
      "chapter": 8,
      "moduleId": "52fa650c-2d46-4c5b-ad90-59f521b6d5e8",
      "lessonId": "73fe00f5-21e2-4105-8fd7-8467367fca74",
      "expectedCore": {
        "id": "cdc54833-4399-44a8-a1c4-4802c5fda033",
        "module_id": "52fa650c-2d46-4c5b-ad90-59f521b6d5e8",
        "lesson_id": "73fe00f5-21e2-4105-8fd7-8467367fca74",
        "pattern": "Vていく／Vてくる",
        "meaning": "Arah gerak atau perkembangan terhadap titik acuan; jelaskan kedua fungsi ruang dan waktu.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: 空が くらくなってきましたね。\nB: そうですね。あ、雨が ふりだしました。\nA: かさは ありますか。\nB: はい。でも、雨が つよくなってきました。\nA: じゃあ、早く かえりましょう。\nB: はい。あの みちを いきましょう。",
        "example_dialog_id": "A: Langit mulai menjadi gelap, ya.\nB: Benar. Ah, hujan mulai turun.\nA: Apakah membawa payung?\nB: Ya. Tapi hujannya mulai bertambah deras.\nA: Kalau begitu mari cepat pulang.\nB: Ya. Mari lewat jalan itu.",
        "communication_goal": "Aoi dan Ren melihat cuaca berubah saat berjalan di taman. Hujan mulai turun dan mereka memutuskan segera pulang.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "park",
          "participants": [
            {
              "characterKey": "aoi-takahashi",
              "position": "left",
              "speaker": "A",
              "displayName": "葵",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "ren-mori",
              "position": "right",
              "speaker": "B",
              "displayName": "蓮",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            {
              "speaker": "B",
              "text": "そうですね。あ、雨が ふりだしました。",
              "expression": "kaget"
            },
            null,
            null,
            null,
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Perubahan apa yang terlihat sebelum hujan mulai turun?",
          "answer": "Langit menjadi gelap.",
          "explanation": "Aoi lebih dulu menyebut くらくなってきました."
        },
        {
          "prompt": "Mengapa mereka memutuskan cepat pulang?",
          "answer": "Hujan mulai turun lalu semakin deras.",
          "explanation": "ふりだしました dan つよくなってきました menjadi konteks keputusan pulang."
        }
      ]
    },
    {
      "grammarId": "daa05f6e-93ab-4f75-8c00-8ff7830e8e93",
      "chapter": 8,
      "moduleId": "52fa650c-2d46-4c5b-ad90-59f521b6d5e8",
      "lessonId": "9ab60515-2279-4982-b36e-2b59ea50d3ee",
      "expectedCore": {
        "id": "daa05f6e-93ab-4f75-8c00-8ff7830e8e93",
        "module_id": "52fa650c-2d46-4c5b-ad90-59f521b6d5e8",
        "lesson_id": "9ab60515-2279-4982-b36e-2b59ea50d3ee",
        "pattern": "Vるところだ／Vているところだ／Vたところだ",
        "meaning": "Akan segera, sedang tepat pada saat itu, dan baru saja selesai. Tiga variasi dalam satu keluarga pola.",
        "sort_order": 4
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: ごはんを たべませんか。\nB: いま、レポートを かいているところです。まだ おわっていません。\nA: わたしは いま かきおわったところです。\nB: あと 十分 まってください。\nA: はい。ここで まっています。\nB: ありがとうございます。もうすこしです。",
        "example_dialog_id": "A: Mau makan?\nB: Saya sedang menulis laporan. Belum selesai.\nA: Saya baru saja selesai menulisnya.\nB: Tolong tunggu sepuluh menit lagi.\nA: Bisa. Saya menunggu di sini.\nB: Terima kasih. Tinggal sedikit lagi.",
        "communication_goal": "Ren mengajak Claire makan. Claire sedang menyelesaikan laporan, sedangkan Ren baru saja selesai.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "classroom",
          "participants": [
            {
              "characterKey": "ren-mori",
              "position": "left",
              "speaker": "A",
              "displayName": "蓮",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "claire-bennett",
              "position": "right",
              "speaker": "B",
              "displayName": "クレア",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            null,
            null,
            {
              "speaker": "B",
              "text": "ありがとうございます。もうすこしです。",
              "expression": "senang"
            }
          ]
        }
      },
      "checks": [
        {
          "prompt": "Siapa yang masih menulis laporan?",
          "answer": "Claire.",
          "explanation": "Claire mengatakan かいているところ dan まだおわっていません."
        },
        {
          "prompt": "Berapa lama Claire meminta Ren menunggu?",
          "answer": "Sepuluh menit lagi.",
          "explanation": "あと十分まってください menetapkan durasi menunggu yang diminta."
        }
      ]
    },
    {
      "grammarId": "9310a766-a8a7-4520-904d-e9adfa304a44",
      "chapter": 9,
      "moduleId": "034b3cc0-7f52-4cbe-83f3-3554b21092b4",
      "lessonId": "7a4658c8-eb44-47de-ae41-9e464d5818d1",
      "expectedCore": {
        "id": "9310a766-a8a7-4520-904d-e9adfa304a44",
        "module_id": "034b3cc0-7f52-4cbe-83f3-3554b21092b4",
        "lesson_id": "7a4658c8-eb44-47de-ae41-9e464d5818d1",
        "pattern": "Vます-stem＋方 Nをする → Nの仕方",
        "meaning": "Cara melakukan: 読み方、使い方、勉強の仕方. Sesuaikan partikel ketika menjadi frasa nomina.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: この カメラの つかいかたが わかりません。\nB: この ボタンを おしてください。\nA: あ、しゃしんが とれました。でも、すこし おもすぎますね。\nB: そうですね。こちらの 小さいのは つかいやすいです。\nA: じゃあ、小さいのを つかってみます。\nB: どうぞ。",
        "example_dialog_id": "A: Saya tidak mengerti cara memakai kamera ini.\nB: Tekan tombol ini.\nA: Ah, berhasil mengambil foto. Tapi kameranya agak terlalu berat, ya.\nB: Benar. Yang kecil di sini mudah dipakai.\nA: Kalau begitu saya coba yang kecil.\nB: Silakan.",
        "communication_goal": "Claire kesulitan memakai kamera yang dibawa Daniel. Ia meminta penjelasan cara penggunaan dan mempertimbangkan berat kamera.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "classroom",
          "participants": [
            {
              "characterKey": "claire-bennett",
              "position": "left",
              "speaker": "A",
              "displayName": "クレア",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "daniel-foster",
              "position": "right",
              "speaker": "B",
              "displayName": "ダニエル",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            {
              "speaker": "A",
              "text": "この カメラの つかいかたが わかりません。",
              "expression": "bingung"
            },
            null,
            null,
            null,
            null,
            {
              "speaker": "B",
              "text": "どうぞ。",
              "expression": "senang"
            }
          ]
        }
      },
      "checks": [
        {
          "prompt": "Penjelasan apa yang diminta Claire?",
          "answer": "Cara menggunakan kamera.",
          "explanation": "つかいかたがわかりません menyatakan kesulitan memahami cara pemakaian."
        },
        {
          "prompt": "Mengapa Claire ingin mencoba kamera kecil?",
          "answer": "Kamera pertama terlalu berat, sedangkan yang kecil disebut mudah dipakai.",
          "explanation": "おもすぎます dan 小さいのはつかいやすい menjadi dasar pilihannya."
        }
      ]
    },
    {
      "grammarId": "e5bad6e3-2a14-4549-a837-db3a4f3ff8c9",
      "chapter": 9,
      "moduleId": "034b3cc0-7f52-4cbe-83f3-3554b21092b4",
      "lessonId": "1d3d803c-06da-4633-a070-14476482ead8",
      "expectedCore": {
        "id": "e5bad6e3-2a14-4549-a837-db3a4f3ff8c9",
        "module_id": "034b3cc0-7f52-4cbe-83f3-3554b21092b4",
        "lesson_id": "1d3d803c-06da-4633-a070-14476482ead8",
        "pattern": "Aい：い→く＋V／Aな-stem＋に＋V",
        "meaning": "Sifat menjadi keterangan cara: 早く歩く、静かに話す.",
        "sort_order": 4
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: この 字の 大きさは どうですか。\nB: すこし 小さいですね。もっと 大きく かいてください。\nA: はい。ていねいに かきます。\nB: ありがとうございます。こちらの 名前も 大きくしてください。\nA: はい。これで いいですか。\nB: はい、よく なりました。",
        "example_dialog_id": "A: Bagaimana ukuran huruf ini?\nB: Agak kecil. Tolong tulis lebih besar.\nA: Baik. Saya tulis dengan teliti.\nB: Terima kasih. Nama di sebelah sini juga dibuat lebih besar.\nA: Baik. Begini sudah sesuai?\nB: Ya, sudah lebih baik.",
        "communication_goal": "Daniel dan Anna menyiapkan tulisan untuk kelas. Mereka memperbaiki ukuran dan kerapian huruf agar jelas bagi pembaca.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "classroom",
          "participants": [
            {
              "characterKey": "daniel-foster",
              "position": "left",
              "speaker": "A",
              "displayName": "ダニエル",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "anna-wijaya",
              "position": "right",
              "speaker": "B",
              "displayName": "アンナ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            null,
            null,
            {
              "speaker": "B",
              "text": "はい、よく なりました。",
              "expression": "senang"
            }
          ]
        }
      },
      "checks": [
        {
          "prompt": "Apa yang diperbaiki pada tulisan?",
          "answer": "Ukuran huruf dibuat lebih besar.",
          "explanation": "Anna meminta 大きくかいてください dan 大きくしてください."
        },
        {
          "prompt": "Bagaimana Daniel mengatakan ia akan menulis?",
          "answer": "Dengan teliti.",
          "explanation": "ていねいにかきます menjelaskan cara menulis."
        }
      ]
    },
    {
      "grammarId": "c61fa4fc-7998-4ad0-af86-1ce0da781ac9",
      "chapter": 10,
      "moduleId": "a43ebaa8-5865-4a51-953d-640167e2ad13",
      "lessonId": "ef235a5f-c681-4488-851e-0e63ea9069a5",
      "expectedCore": {
        "id": "c61fa4fc-7998-4ad0-af86-1ce0da781ac9",
        "module_id": "a43ebaa8-5865-4a51-953d-640167e2ad13",
        "lesson_id": "ef235a5f-c681-4488-851e-0e63ea9069a5",
        "pattern": "普通形＋ので N・Aな非過去肯定：な＋ので",
        "meaning": "Karena/sebab; menyajikan latar alasan. Bukan hanya versi sopan dari から.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: ここで べんきょうしますか。\nB: きょうは 人が 多いので、としょかんへ いきたいです。\nA: としょかんは ここから ちかいですか。\nB: はい。ちかいし、しずかだし、べんきょうしやすいです。\nA: じゃあ、ごはんを たべたあとで いきましょう。\nB: はい。そうしましょう。",
        "example_dialog_id": "A: Apakah kita belajar di sini?\nB: Hari ini banyak orang, jadi saya ingin pergi ke perpustakaan.\nA: Apakah perpustakaan dekat dari sini?\nB: Ya. Dekat dan tenang, jadi mudah belajar di sana.\nA: Kalau begitu, mari pergi setelah makan.\nB: Ya, mari begitu.",
        "communication_goal": "Anna dan Aoi memilih tempat belajar setelah makan. Aoi menjelaskan mengapa perpustakaan lebih sesuai.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "cafe",
          "participants": [
            {
              "characterKey": "anna-wijaya",
              "position": "left",
              "speaker": "A",
              "displayName": "アンナ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "aoi-takahashi",
              "position": "right",
              "speaker": "B",
              "displayName": "葵",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            null,
            null,
            {
              "speaker": "B",
              "text": "はい。そうしましょう。",
              "expression": "senang"
            }
          ]
        }
      },
      "checks": [
        {
          "prompt": "Mengapa Aoi ingin pindah dari kafe?",
          "answer": "Kafe ramai oleh banyak orang hari ini.",
          "explanation": "人が多いので memberi alasan keinginannya pergi ke perpustakaan."
        },
        {
          "prompt": "Apa dua kelebihan perpustakaan yang disebutkan?",
          "answer": "Dekat dan tenang.",
          "explanation": "ちかいし、しずかだし menambahkan dua alasan yang mendukung pilihan."
        }
      ]
    },
    {
      "grammarId": "8aea44c1-727a-4bd6-83dc-4b5fca2371f3",
      "chapter": 10,
      "moduleId": "a43ebaa8-5865-4a51-953d-640167e2ad13",
      "lessonId": "b55f3a04-6a23-4eed-a1a7-2f391abfe20e",
      "expectedCore": {
        "id": "8aea44c1-727a-4bd6-83dc-4b5fca2371f3",
        "module_id": "a43ebaa8-5865-4a51-953d-640167e2ad13",
        "lesson_id": "b55f3a04-6a23-4eed-a1a7-2f391abfe20e",
        "pattern": "普通形＋けど／けれど／けれども",
        "meaning": "Tetapi/meskipun; juga pengantar atau pelembut. N・Aな memakai だけど. Ragam tutur berbeda.",
        "sort_order": 3
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: きょうは いい てんきだと おもったのに、雨ですね。\nB: そうですね。でも、雨が ふっても、びじゅつかんへ いきます。\nA: 駅から とおいですか。\nB: すこし とおいけど、バスで いけます。\nA: じゃあ、いっしょに バスで いきましょう。\nB: はい。あちらで まちましょう。",
        "example_dialog_id": "A: Padahal saya kira hari ini cuacanya akan bagus, ternyata hujan, ya.\nB: Benar. Tetapi meskipun hujan, saya tetap pergi ke museum seni.\nA: Apakah jauh dari stasiun?\nB: Agak jauh, tetapi bisa naik bus.\nA: Kalau begitu mari naik bus bersama.\nB: Ya. Mari menunggu di sana.",
        "communication_goal": "Hadi dan Ren membicarakan rencana ke museum seni saat cuaca tidak sesuai harapan. Museum tetap menjadi tujuan meskipun hujan.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "station",
          "participants": [
            {
              "characterKey": "hadi-pratama",
              "position": "left",
              "speaker": "A",
              "displayName": "ハディ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "ren-mori",
              "position": "right",
              "speaker": "B",
              "displayName": "蓮",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            null,
            null,
            {
              "speaker": "B",
              "text": "はい。あちらで まちましょう。",
              "expression": "senang"
            }
          ]
        }
      },
      "checks": [
        {
          "prompt": "Apa yang tidak sesuai harapan Hadi?",
          "answer": "Ia memperkirakan cuaca bagus, tetapi ternyata hujan.",
          "explanation": "いいてんきだとおもったのに menyatakan harapan yang meleset."
        },
        {
          "prompt": "Bagaimana mereka akan pergi ke museum?",
          "answer": "Naik bus bersama.",
          "explanation": "Ren menjelaskan バスでいけます dan Hadi mengusulkan バスでいきましょう."
        }
      ]
    },
    {
      "grammarId": "4d3efc88-0326-40da-9745-e84d5e385949",
      "chapter": 11,
      "moduleId": "87c74265-8edd-4c2f-abe8-033204f66bbc",
      "lessonId": "c1cb8777-bcb2-46da-ab03-cd5147b728b8",
      "expectedCore": {
        "id": "4d3efc88-0326-40da-9745-e84d5e385949",
        "module_id": "87c74265-8edd-4c2f-abe8-033204f66bbc",
        "lesson_id": "c1cb8777-bcb2-46da-ab03-cd5147b728b8",
        "pattern": "Vます-stem＋そうだ Aい hapus い／Aな-stem＋そうだ",
        "meaning": "Kelihatannya/akan segera; penampakan. Pengecualian: よさそう、なさそう. N tidak langsung memakai pola ini.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: 空に くろい くもが ありますね。\nB: はい。雨が ふりそうです。\nA: あしたも 雨ですか。\nB: てんきよほうでは、あしたは はれるそうです。\nA: じゃあ、あした また 来ましょう。\nB: いいですね。きょうは 早く かえりましょう。",
        "example_dialog_id": "A: Ada awan hitam di langit, ya.\nB: Ya. Kelihatannya akan hujan.\nA: Apakah besok juga hujan?\nB: Menurut prakiraan cuaca, katanya besok cerah.\nA: Kalau begitu, mari datang lagi besok.\nB: Boleh. Hari ini mari cepat pulang.",
        "communication_goal": "Aoi dan Claire membedakan tanda hujan yang terlihat sekarang dengan kabar cuaca besok dari prakiraan.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "park",
          "participants": [
            {
              "characterKey": "aoi-takahashi",
              "position": "left",
              "speaker": "A",
              "displayName": "葵",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "claire-bennett",
              "position": "right",
              "speaker": "B",
              "displayName": "クレア",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            {
              "speaker": "B",
              "text": "はい。雨が ふりそうです。",
              "expression": "berpikir"
            },
            null,
            null,
            null,
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Apa dasar perkiraan hujan sekarang?",
          "answer": "Awan hitam yang tampak di langit.",
          "explanation": "ふりそうです mengikuti pengamatan くろいくもがあります."
        },
        {
          "prompt": "Dari mana Claire mendapat informasi bahwa besok cerah?",
          "answer": "Dari prakiraan cuaca.",
          "explanation": "てんきよほうでは dan はれるそうです menyatakan sumber informasi."
        }
      ]
    },
    {
      "grammarId": "481653aa-ad49-4988-92d0-3dc088229c7f",
      "chapter": 11,
      "moduleId": "87c74265-8edd-4c2f-abe8-033204f66bbc",
      "lessonId": "0b297a0e-60a4-4ba3-8919-8ec90ab97f79",
      "expectedCore": {
        "id": "481653aa-ad49-4988-92d0-3dc088229c7f",
        "module_id": "87c74265-8edd-4c2f-abe8-033204f66bbc",
        "lesson_id": "0b297a0e-60a4-4ba3-8919-8ec90ab97f79",
        "pattern": "V・Aい普通形／N・Aな-stem＋かもしれない",
        "meaning": "Mungkin …; sertakan bentuk sopan かもしれません dan bentuk lampau/negatif pada klausa.",
        "sort_order": 4
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: わたしの 本が ありません。いえに わすれたかもしれません。\nB: きのう、この テーブルで よんでいましたよ。\nA: そうでしたね。まだ ここに あるでしょうか。\nB: テーブルの 下に あるはずです。きのう、わたしが そこに おきました。\nA: あ、ありました。ありがとうございます。\nB: よかったですね。",
        "example_dialog_id": "A: Buku saya tidak ada. Mungkin tertinggal di rumah.\nB: Kemarin Anda membacanya di meja ini, lho.\nA: Benar juga. Kira-kira masih ada di sini?\nB: Seharusnya ada di bawah meja. Kemarin saya meletakkannya di sana.\nA: Ah, ada. Terima kasih.\nB: Syukurlah ketemu.",
        "communication_goal": "Ren dan Daniel mencari sebuah buku. Mereka membedakan kemungkinan buku dibawa pulang dengan dugaan beralasan tentang letak buku.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "classroom",
          "participants": [
            {
              "characterKey": "ren-mori",
              "position": "left",
              "speaker": "A",
              "displayName": "蓮",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "daniel-foster",
              "position": "right",
              "speaker": "B",
              "displayName": "ダニエル",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            {
              "speaker": "A",
              "text": "わたしの 本が ありません。いえに わすれたかもしれません。",
              "expression": "bingung"
            },
            null,
            null,
            null,
            {
              "speaker": "A",
              "text": "あ、ありました。ありがとうございます。",
              "expression": "senang"
            },
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Kemungkinan awal Ren tentang tempat bukunya apa?",
          "answer": "Mungkin tertinggal di rumah.",
          "explanation": "Ren membuka dengan いえにわすれたかもしれません."
        },
        {
          "prompt": "Di mana buku akhirnya ditemukan, dan apa dasar dugaan Daniel?",
          "answer": "Di bawah meja; Daniel sendiri meletakkannya di sana kemarin.",
          "explanation": "Daniel menyebut テーブルの下 dan tindakannya わたしがそこにおきました; Ren kemudian menemukan buku."
        }
      ]
    },
    {
      "grammarId": "b3b6d347-3555-432f-86a1-3979148bc6a3",
      "chapter": 12,
      "moduleId": "64a54a15-677d-4384-95c4-c2b22d8e717f",
      "lessonId": "a9d4331c-63a2-41c1-b04f-1a4be36e3a2b",
      "expectedCore": {
        "id": "b3b6d347-3555-432f-86a1-3979148bc6a3",
        "module_id": "64a54a15-677d-4384-95c4-c2b22d8e717f",
        "lesson_id": "a9d4331c-63a2-41c1-b04f-1a4be36e3a2b",
        "pattern": "V・Aい普通形／Aな＋な／N＋の＋ようだ Nのような＋N／Nのように＋V・A",
        "meaning": "Sepertinya berdasarkan tanda atau mirip …; termasuk bentuk penjelas nomina/cara.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: あの 花は ゆきのように 白いですね。\nB: はい。ゆきみたいです。でも、花なんですね。\nA: あちらの 子どもたちも 花を みています。\nB: たのしそうに はなしていますね。\nA: わたしたちも しゃしんを とりませんか。\nB: いいですね。白い 花を とりましょう。",
        "example_dialog_id": "A: Bunga itu putih seperti salju, ya.\nB: Ya, seperti salju. Tapi ternyata bunga, ya.\nA: Anak-anak di sana juga sedang melihat bunga.\nB: Mereka tampak senang saat berbincang, ya.\nA: Bagaimana kalau kita juga mengambil foto?\nB: Boleh. Mari memotret bunga putih itu.",
        "communication_goal": "Claire dan Anna melihat bunga putih serta anak-anak di taman. Mereka membandingkan penampilan bunga dan mengamati perasaan anak.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "park",
          "participants": [
            {
              "characterKey": "claire-bennett",
              "position": "left",
              "speaker": "A",
              "displayName": "クレア",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "anna-wijaya",
              "position": "right",
              "speaker": "B",
              "displayName": "アンナ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            {
              "speaker": "B",
              "text": "はい。ゆきみたいです。でも、花なんですね。",
              "expression": "kaget"
            },
            null,
            null,
            null,
            {
              "speaker": "B",
              "text": "いいですね。白い 花を とりましょう。",
              "expression": "senang"
            }
          ]
        }
      },
      "checks": [
        {
          "prompt": "Bunga dibandingkan dengan apa?",
          "answer": "Salju karena warnanya putih.",
          "explanation": "ゆきのように白い dan ゆきみたいです menyatakan kemiripan penampilan."
        },
        {
          "prompt": "Apa yang akhirnya akan dilakukan Claire dan Anna?",
          "answer": "Memotret bunga putih.",
          "explanation": "Ajakan しゃしんをとりませんか diterima dengan 白い花をとりましょう."
        }
      ]
    },
    {
      "grammarId": "06e1aa0a-6abf-4e7c-8b8d-e4bdb6cb9dbb",
      "chapter": 12,
      "moduleId": "64a54a15-677d-4384-95c4-c2b22d8e717f",
      "lessonId": "5208e79c-3d92-4c63-a2c8-3c9bec39dcb3",
      "expectedCore": {
        "id": "06e1aa0a-6abf-4e7c-8b8d-e4bdb6cb9dbb",
        "module_id": "64a54a15-677d-4384-95c4-c2b22d8e717f",
        "lesson_id": "5208e79c-3d92-4c63-a2c8-3c9bec39dcb3",
        "pattern": "Aい hapus い／Aな-stem＋がる",
        "meaning": "Menunjukkan tanda merasa …; terbatas pada sifat tertentu, misalnya 怖がる、嫌がる. Bukan semua sifat.",
        "sort_order": 4
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: おとうとさんは どうしていますか。\nB: げんきです。「うみへ いきたい」と なんども いっています。\nA: うみへ いきたがっているんですね。\nB: はい。でも、大きい いぬを こわがっています。うみの ちかくに いぬが いるんです。\nA: そうですか。おとうとさんと いっしょに いきますか。\nB: はい。来週、いっしょに いこうと おもっています。",
        "example_dialog_id": "A: Bagaimana kabar adik laki-laki Anda?\nB: Sehat. Ia berkali-kali berkata ingin pergi ke laut.\nA: Jadi ia sedang ingin pergi ke laut, ya.\nB: Ya. Tetapi ia takut kepada anjing besar. Ada anjing di dekat laut.\nA: Oh, begitu. Apakah Anda akan pergi bersama adik?\nB: Ya. Saya berniat pergi bersamanya minggu depan.",
        "communication_goal": "Daniel dan Hadi membicarakan keinginan serta perasaan adik Hadi berdasarkan ucapan dan reaksi yang terlihat.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "cafe",
          "participants": [
            {
              "characterKey": "daniel-foster",
              "position": "left",
              "speaker": "A",
              "displayName": "ダニエル",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "hadi-pratama",
              "position": "right",
              "speaker": "B",
              "displayName": "ハディ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            null,
            null,
            {
              "speaker": "B",
              "text": "はい。来週、いっしょに いこうと おもっています。",
              "expression": "senang"
            }
          ]
        }
      },
      "checks": [
        {
          "prompt": "Apa dasar pernyataan bahwa adik Hadi ingin ke laut?",
          "answer": "Ia berkali-kali mengatakan ingin pergi ke laut.",
          "explanation": "Ucapan berulang うみへいきたい menjadi bukti untuk いきたがっている."
        },
        {
          "prompt": "Apa yang ditakuti adik Hadi?",
          "answer": "Anjing besar di dekat laut.",
          "explanation": "Hadi menyebut 大きいいぬをこわがっています dan lokasi anjing itu."
        }
      ]
    },
    {
      "grammarId": "84c2f6be-45ed-48e4-8f27-b84bcbaa2da9",
      "chapter": 13,
      "moduleId": "d0d67a65-b304-4b3d-b6e6-3e1239473a67",
      "lessonId": "827bdfa1-d7d2-4980-a65a-213714e9c0fb",
      "expectedCore": {
        "id": "84c2f6be-45ed-48e4-8f27-b84bcbaa2da9",
        "module_id": "d0d67a65-b304-4b3d-b6e6-3e1239473a67",
        "lesson_id": "827bdfa1-d7d2-4980-a65a-213714e9c0fb",
        "pattern": "V・Aい普通形＋と、… N・Aな非過去肯定：だと",
        "meaning": "Jika/ketika A, B terjadi secara lazim, otomatis, atau sebagai hasil pengamatan.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: としょかんへ いきたいんですが、みちが わかりません。\nB: このみちを まっすぐ いくと、はしが あります。\nA: はしを わたるんですか。\nB: はい。わたって、みぎに まがると、としょかんが あります。\nA: わかりました。ありがとうございます。\nB: ついたら、でんわして ください。",
        "example_dialog_id": "A: Saya ingin ke perpustakaan, tetapi tidak tahu jalannya.\nB: Jika berjalan lurus di jalan ini, ada jembatan.\nA: Apakah saya menyeberangi jembatan itu?\nB: Ya. Setelah menyeberang lalu berbelok ke kanan, ada perpustakaan.\nA: Saya mengerti. Terima kasih.\nB: Setelah tiba, tolong telepon saya.",
        "communication_goal": "Anna bertanya kepada Hadi tentang jalan menuju perpustakaan. Mereka membedakan petunjuk rute dengan と dan tindakan setelah tiba dengan たら.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "station",
          "participants": [
            {
              "characterKey": "anna-wijaya",
              "position": "left",
              "speaker": "A",
              "displayName": "アンナ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "hadi-pratama",
              "position": "right",
              "speaker": "B",
              "displayName": "ハディ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            {
              "speaker": "A",
              "text": "としょかんへ いきたいんですが、みちが わかりません。",
              "expression": "bingung"
            },
            null,
            null,
            null,
            {
              "speaker": "A",
              "text": "わかりました。ありがとうございます。",
              "expression": "senang"
            },
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Setelah menyeberangi jembatan, Anna harus berbelok ke mana?",
          "answer": "Ke kanan.",
          "explanation": "Hadi mengatakan みぎにまがると setelah menyeberangi jembatan."
        },
        {
          "prompt": "Kapan Hadi meminta Anna menelepon?",
          "answer": "Setelah tiba di perpustakaan.",
          "explanation": "ついたら、でんわしてください menempatkan telepon sesudah kedatangan."
        }
      ]
    },
    {
      "grammarId": "165c4efd-8898-48aa-992b-81bc882dc771",
      "chapter": 13,
      "moduleId": "d0d67a65-b304-4b3d-b6e6-3e1239473a67",
      "lessonId": "5aa6180f-330d-4b62-93ad-2c719399a4fc",
      "expectedCore": {
        "id": "165c4efd-8898-48aa-992b-81bc882dc771",
        "module_id": "d0d67a65-b304-4b3d-b6e6-3e1239473a67",
        "lesson_id": "5aa6180f-330d-4b62-93ad-2c719399a4fc",
        "pattern": "Vた＋らどうですか",
        "meaning": "Bagaimana kalau …; menyampaikan saran. Nada dan hubungan dengan lawan bicara perlu diperhatikan.",
        "sort_order": 3
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: あした しけんなんですが、きのう あまり ねませんでした。\nB: じゃ、きょうは はやく ねたら どうですか。\nA: そうですね。でも、まだ よんでいない ページが あります。\nB: まず、このページを よんだら どうですか。\nA: はい。そうします。\nB: あした、じょうずに こたえられると いいですね。",
        "example_dialog_id": "A: Besok saya ujian, tetapi kemarin saya kurang tidur.\nB: Kalau begitu, bagaimana kalau tidur lebih awal hari ini?\nA: Benar juga. Tetapi masih ada halaman yang belum saya baca.\nB: Bagaimana kalau membaca halaman ini terlebih dahulu?\nA: Ya. Saya akan begitu.\nB: Semoga besok Anda bisa menjawab dengan baik.",
        "communication_goal": "Claire merasa lelah menjelang ujian. Ren memberi saran dengan たらどうですか dan menyampaikan harapan dengan といいですね.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "cafe",
          "participants": [
            {
              "characterKey": "claire-bennett",
              "position": "left",
              "speaker": "A",
              "displayName": "クレア",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "ren-mori",
              "position": "right",
              "speaker": "B",
              "displayName": "蓮",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            {
              "speaker": "B",
              "text": "じゃ、きょうは はやく ねたら どうですか。",
              "expression": "berpikir"
            },
            null,
            null,
            null,
            {
              "speaker": "B",
              "text": "あした、じょうずに こたえられると いいですね。",
              "expression": "senang"
            }
          ]
        }
      },
      "checks": [
        {
          "prompt": "Apa saran Ren tentang waktu tidur Claire?",
          "answer": "Tidur lebih awal hari ini.",
          "explanation": "Ren menyarankan きょうははやくねたらどうですか."
        },
        {
          "prompt": "Apa yang Ren harapkan untuk ujian Claire?",
          "answer": "Claire dapat menjawab dengan baik.",
          "explanation": "じょうずにこたえられるといいですね menyatakan harapan, bukan hasil ujian yang sudah pasti."
        }
      ]
    },
    {
      "grammarId": "fb8eb9ab-caaf-4d5c-b8f1-8fa10cac8c6d",
      "chapter": 14,
      "moduleId": "e6820110-bef2-47f0-b0c4-4a808d3bf51b",
      "lessonId": "e5dd9d4d-e2a5-4806-bc6d-7e4d99123bd9",
      "expectedCore": {
        "id": "fb8eb9ab-caaf-4d5c-b8f1-8fa10cac8c6d",
        "module_id": "e6820110-bef2-47f0-b0c4-4a808d3bf51b",
        "lesson_id": "e5dd9d4d-e2a5-4806-bc6d-7e4d99123bd9",
        "pattern": "G1 u→e＋ば；G2 る→れば する→すれば；来る→来れば（くれば）",
        "meaning": "Syarat verba. Sertakan Aい→ければ, N／Aな→なら（ば）／であれば, dan negatif→なければ.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: にちようび、じかんが あれば、うみへ いきませんか。\nB: いいですね。うみへ いくなら、あさ はやく でましょう。\nA: バスと でんしゃでは、どちらが いいですか。\nB: でんしゃなら、いちじかんで つきます。バスは にじかん かかります。\nA: じゃ、でんしゃで いきましょう。\nB: はい。はちじの でんしゃは どうですか。",
        "example_dialog_id": "A: Jika ada waktu hari Minggu, mau pergi ke laut?\nB: Boleh. Kalau pergi ke laut, mari berangkat pagi-pagi.\nA: Mana yang lebih baik, bus atau kereta?\nB: Kalau kereta, kita sampai dalam satu jam. Bus memerlukan dua jam.\nA: Kalau begitu, mari naik kereta.\nB: Ya. Bagaimana kalau kereta pukul delapan?",
        "communication_goal": "Aoi mengajak Daniel pergi ke laut jika ada waktu. Daniel menanggapi rencana itu dengan なら dan membandingkan transportasi.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "park",
          "participants": [
            {
              "characterKey": "aoi-takahashi",
              "position": "left",
              "speaker": "A",
              "displayName": "葵",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "daniel-foster",
              "position": "right",
              "speaker": "B",
              "displayName": "ダニエル",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            {
              "speaker": "B",
              "text": "いいですね。うみへ いくなら、あさ はやく でましょう。",
              "expression": "senang"
            },
            null,
            null,
            null,
            {
              "speaker": "B",
              "text": "はい。はちじの でんしゃは どうですか。",
              "expression": "berpikir"
            }
          ]
        }
      },
      "checks": [
        {
          "prompt": "Apa syarat ajakan Aoi?",
          "answer": "Daniel memiliki waktu pada hari Minggu.",
          "explanation": "じかんがあれば adalah syarat keadaan untuk ajakan pergi."
        },
        {
          "prompt": "Mengapa mereka memilih kereta?",
          "answer": "Kereta memerlukan satu jam, sedangkan bus dua jam.",
          "explanation": "Daniel menyebut waktu kedua transportasi, lalu Aoi memilih kereta."
        }
      ]
    },
    {
      "grammarId": "c9eb422c-64ee-469a-a942-156365943c33",
      "chapter": 14,
      "moduleId": "e6820110-bef2-47f0-b0c4-4a808d3bf51b",
      "lessonId": "8ca72b48-7e11-4495-a097-8b334e1c1fbc",
      "expectedCore": {
        "id": "c9eb422c-64ee-469a-a942-156365943c33",
        "module_id": "e6820110-bef2-47f0-b0c4-4a808d3bf51b",
        "lesson_id": "8ca72b48-7e11-4495-a097-8b334e1c1fbc",
        "pattern": "Vば＋よかった ／ Vなければ＋よかった",
        "meaning": "Seandainya tadi melakukan / tidak melakukan; penyesalan setelah fakta.",
        "sort_order": 3
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: でんしゃは もう いって しまったんですか。\nB: はい。ごふんまえに でました。\nA: もっと はやく うちを でれば よかったです。\nB: とちゅうで どこかに よったんですか。\nA: はい。みせに よらなければ よかったです。\nB: つぎの でんしゃは じゅっぷんごです。ここで まちましょう。",
        "example_dialog_id": "A: Apakah keretanya sudah berangkat?\nB: Ya. Berangkat lima menit lalu.\nA: Seandainya saya berangkat dari rumah lebih awal.\nB: Apakah Anda mampir ke suatu tempat di perjalanan?\nA: Ya. Seandainya saya tidak mampir ke toko.\nB: Kereta berikutnya sepuluh menit lagi. Mari menunggu di sini.",
        "communication_goal": "Hadi terlambat untuk kereta karena mampir ke toko. Ia menyesali pilihan yang sudah dilakukan memakai ばよかった dan なければよかった.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "station",
          "participants": [
            {
              "characterKey": "hadi-pratama",
              "position": "left",
              "speaker": "A",
              "displayName": "ハディ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "claire-bennett",
              "position": "right",
              "speaker": "B",
              "displayName": "クレア",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            {
              "speaker": "A",
              "text": "でんしゃは もう いって しまったんですか。",
              "expression": "kaget"
            },
            null,
            null,
            null,
            null,
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Apakah Hadi benar-benar mampir ke toko?",
          "answer": "Ya, ia mampir lalu menyesal.",
          "explanation": "Hadi menjawab はい sebelum よらなければよかった, yang menunjukkan penyesalan atas tindakan yang sudah terjadi."
        },
        {
          "prompt": "Kapan kereta berikutnya datang menurut Claire?",
          "answer": "Sepuluh menit lagi.",
          "explanation": "Claire mengatakan つぎのでんしゃはじゅっぷんごです."
        }
      ]
    },
    {
      "grammarId": "bcefdff6-4e96-47e3-9de8-06fcb5214a16",
      "chapter": 15,
      "moduleId": "15931cf4-a16b-471c-8b49-8230fddb4b43",
      "lessonId": "100f1b0c-2dd6-47cf-8a7a-1fcc90d7c680",
      "expectedCore": {
        "id": "bcefdff6-4e96-47e3-9de8-06fcb5214a16",
        "module_id": "15931cf4-a16b-471c-8b49-8230fddb4b43",
        "lesson_id": "100f1b0c-2dd6-47cf-8a7a-1fcc90d7c680",
        "pattern": "Vます-stem＋に行く／来る／帰る",
        "meaning": "Pergi/datang/pulang untuk melakukan …; fondasi yang belum tercantum eksplisit dalam daftar N5.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: これから、ほんを かりに としょかんへ いきます。\nB: どんな ほんを かりるんですか。\nA: えいごの ほんです。りょこうのために、えいごを べんきょうしています。\nB: ほんは よめますか。\nA: まだ むずかしいです。よめるように、まいにち れんしゅうしています。\nB: いいですね。がんばって ください。",
        "example_dialog_id": "A: Setelah ini saya akan pergi ke perpustakaan untuk meminjam buku.\nB: Buku seperti apa yang akan Anda pinjam?\nA: Buku bahasa Inggris. Saya belajar bahasa Inggris untuk bepergian.\nB: Apakah Anda bisa membaca bukunya?\nA: Masih sulit. Saya berlatih setiap hari agar bisa membacanya.\nB: Bagus. Semangat, ya.",
        "communication_goal": "Ren menjelaskan tujuan pergi ke perpustakaan dan belajar bahasa Inggris. Anna menanyakan tujuan tindakan serta kemampuan yang sedang diusahakan.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "classroom",
          "participants": [
            {
              "characterKey": "ren-mori",
              "position": "left",
              "speaker": "A",
              "displayName": "蓮",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "anna-wijaya",
              "position": "right",
              "speaker": "B",
              "displayName": "アンナ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            null,
            {
              "speaker": "A",
              "text": "まだ むずかしいです。よめるように、まいにち れんしゅうしています。",
              "expression": "berpikir"
            },
            {
              "speaker": "B",
              "text": "いいですね。がんばって ください。",
              "expression": "senang"
            }
          ]
        }
      },
      "checks": [
        {
          "prompt": "Untuk apa Ren pergi ke perpustakaan?",
          "answer": "Untuk meminjam buku bahasa Inggris.",
          "explanation": "ほんをかりに menyatakan tujuan perjalanan dan Ren kemudian menjelaskan jenis bukunya."
        },
        {
          "prompt": "Kemampuan apa yang Ren latih setiap hari?",
          "answer": "Membaca buku bahasa Inggris.",
          "explanation": "よめるように、まいにちれんしゅうしています menyatakan kemampuan membaca sebagai hasil yang diupayakan."
        }
      ]
    },
    {
      "grammarId": "384aada6-16f6-49c9-914d-0861febfb53e",
      "chapter": 15,
      "moduleId": "15931cf4-a16b-471c-8b49-8230fddb4b43",
      "lessonId": "015a498e-71e4-4e61-bfa2-60c4cf1dca45",
      "expectedCore": {
        "id": "384aada6-16f6-49c9-914d-0861febfb53e",
        "module_id": "15931cf4-a16b-471c-8b49-8230fddb4b43",
        "lesson_id": "015a498e-71e4-4e61-bfa2-60c4cf1dca45",
        "pattern": "Vる＋のに＋使う／便利だ／必要だ／時間がかかる",
        "meaning": "Untuk melakukan …, benda berguna/diperlukan atau membutuhkan waktu. Berbeda dari のに “padahal”.",
        "sort_order": 4
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: あしたの クラスでは、なにを つくりますか。\nB: かみで はなを つくります。せんせいは、はさみを もって くるように いいました。\nA: はさみは、かみを きるのに つかうんですね。\nB: はい。のりも ひつようです。\nA: はなを つくるのに、どのくらい かかりますか。\nB: さんじゅっぷんぐらいです。",
        "example_dialog_id": "A: Apa yang akan dibuat dalam kelas besok?\nB: Kita membuat bunga dari kertas. Guru meminta kita membawa gunting.\nA: Gunting digunakan untuk memotong kertas, ya.\nB: Ya. Lem juga diperlukan.\nA: Berapa lama diperlukan untuk membuat bunganya?\nB: Sekitar tiga puluh menit.",
        "communication_goal": "Daniel dan Anna menyiapkan kegiatan membuat bunga kertas. Mereka membahas kegunaan gunting dan instruksi guru. はさみ berarti gunting.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "classroom",
          "participants": [
            {
              "characterKey": "daniel-foster",
              "position": "left",
              "speaker": "A",
              "displayName": "ダニエル",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "anna-wijaya",
              "position": "right",
              "speaker": "B",
              "displayName": "アンナ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            null,
            {
              "speaker": "A",
              "text": "はなを つくるのに、どのくらい かかりますか。",
              "expression": "berpikir"
            },
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Apa yang guru minta dibawa?",
          "answer": "Gunting.",
          "explanation": "Anna melaporkan はさみをもってくるようにいいました."
        },
        {
          "prompt": "Berapa lama membuat bunga kertas itu?",
          "answer": "Sekitar tiga puluh menit.",
          "explanation": "Anna menjawab さんじゅっぷんぐらい untuk waktu membuat bunga."
        }
      ]
    },
    {
      "grammarId": "7e65dba0-89b1-43a4-99ef-17b99c2eb1f0",
      "chapter": 16,
      "moduleId": "2f6d7bc0-0668-4c19-b52c-0ce627aee300",
      "lessonId": "40003450-995c-478d-8478-242827900ce3",
      "expectedCore": {
        "id": "7e65dba0-89b1-43a4-99ef-17b99c2eb1f0",
        "module_id": "2f6d7bc0-0668-4c19-b52c-0ce627aee300",
        "lesson_id": "40003450-995c-478d-8478-242827900ce3",
        "pattern": "Vた＋ほうがいい ／ Vない＋ほうがいい",
        "meaning": "Lebih baik melakukan / tidak melakukan. Untuk saran spesifik, ajarkan bentuk Vた.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: あしたの しけんには、なにが ひつようですか。\nB: えんぴつを もって こないと いけません。にほん あったほうが いいですよ。\nA: じしょも もって いきますか。\nB: いいえ。じしょを もって いく ひつようは ありません。\nA: わかりました。きょうは はやく ねたほうが いいですね。\nB: そうですね。あした、がんばりましょう。",
        "example_dialog_id": "A: Apa yang diperlukan untuk ujian besok?\nB: Kita harus membawa pensil. Sebaiknya ada dua batang.\nA: Apakah kita membawa kamus juga?\nB: Tidak. Tidak perlu membawa kamus.\nA: Saya mengerti. Sebaiknya tidur lebih awal hari ini, ya.\nB: Benar. Mari berusaha sebaik mungkin besok.",
        "communication_goal": "Anna dan Claire memeriksa persiapan ujian. Mereka membedakan saran, kewajiban membawa alat, dan sesuatu yang tidak perlu dibawa.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "cafe",
          "participants": [
            {
              "characterKey": "anna-wijaya",
              "position": "left",
              "speaker": "A",
              "displayName": "アンナ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "claire-bennett",
              "position": "right",
              "speaker": "B",
              "displayName": "クレア",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            {
              "speaker": "A",
              "text": "じしょも もって いきますか。",
              "expression": "berpikir"
            },
            null,
            null,
            {
              "speaker": "B",
              "text": "そうですね。あした、がんばりましょう。",
              "expression": "senang"
            }
          ]
        }
      },
      "checks": [
        {
          "prompt": "Apa yang wajib dibawa Anna untuk ujian?",
          "answer": "Pensil.",
          "explanation": "Claire menyatakan えんぴつをもってこないといけません sebagai kewajiban."
        },
        {
          "prompt": "Apakah kamus perlu dibawa?",
          "answer": "Tidak perlu.",
          "explanation": "ひつようはありません menyatakan tidak perlu; kalimat itu tidak mengatakan kamus dilarang."
        }
      ]
    },
    {
      "grammarId": "441eb770-2e1e-4752-b7db-74c7764cdf8c",
      "chapter": 16,
      "moduleId": "2f6d7bc0-0668-4c19-b52c-0ce627aee300",
      "lessonId": "d33a978d-d1ba-431a-92e8-4624ee449fca",
      "expectedCore": {
        "id": "441eb770-2e1e-4752-b7db-74c7764cdf8c",
        "module_id": "2f6d7bc0-0668-4c19-b52c-0ce627aee300",
        "lesson_id": "d33a978d-d1ba-431a-92e8-4624ee449fca",
        "pattern": "Vます-stem＋なさい",
        "meaning": "Instruksi tegas; umum dalam relasi orang tua/guru kepada anak/siswa, bukan permintaan sopan universal.",
        "sort_order": 4
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: ハディさん、とまれ！ くるまが きます！\nB: あっ、あぶなかったです。ありがとうございます。\nA: ここには「わたるな」と かいて あります。あのはしを わたりましょう。\nB: はい。これからは、よく みます。",
        "example_dialog_id": "A: Hadi, berhenti! Ada mobil datang!\nB: Ah, tadi berbahaya. Terima kasih.\nA: Di sini tertulis “Jangan menyeberang”. Mari menyeberangi jembatan itu.\nB: Baik. Mulai sekarang saya akan lebih memperhatikan.",
        "communication_goal": "Di dekat stasiun, Ren memperingatkan Hadi saat kendaraan mendekat. Bentuk perintah dipakai karena bahaya segera; larangan pada tanda dibaca sebagai kutipan.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "station",
          "participants": [
            {
              "characterKey": "ren-mori",
              "position": "left",
              "speaker": "A",
              "displayName": "蓮",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "hadi-pratama",
              "position": "right",
              "speaker": "B",
              "displayName": "ハディ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            {
              "speaker": "A",
              "text": "ハディさん、とまれ！ くるまが きます！",
              "expression": "kaget"
            },
            null,
            null,
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Mengapa Ren memakai perintah langsung とまれ?",
          "answer": "Karena mobil sedang mendekat dan ada bahaya.",
          "explanation": "くるまがきます memberi konteks darurat; ini bukan contoh permintaan biasa antarteman."
        },
        {
          "prompt": "Setelah melihat tanda larangan, mereka akan menyeberang di mana?",
          "answer": "Di jembatan yang ditunjuk Ren.",
          "explanation": "Ren menyarankan あのはしをわたりましょう setelah membaca larangan menyeberang di tempat itu."
        }
      ]
    },
    {
      "grammarId": "fdeb6c11-f394-4655-909e-6e3f814c1b21",
      "chapter": 17,
      "moduleId": "4a76eb18-bf1f-4d2b-86bd-fd3a98d3c4a2",
      "lessonId": "a3e9a81d-f5aa-4af1-84ba-f7e60283ef82",
      "expectedCore": {
        "id": "fdeb6c11-f394-4655-909e-6e3f814c1b21",
        "module_id": "4a76eb18-bf1f-4d2b-86bd-fd3a98d3c4a2",
        "lesson_id": "a3e9a81d-f5aa-4af1-84ba-f7e60283ef82",
        "pattern": "Pemberiは Penerimaに Bendaを あげる",
        "meaning": "Memberi kepada orang lain dari sudut pandang pemberi.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: そのかばん、あたらしいですね。\nB: はい。たんじょうびに、あねから もらいました。\nA: すてきですね。そのペンも、おねえさんからですか。\nB: いいえ。ペンは ともだちが くれました。\nA: こんどは、おねえさんに なにか あげますか。\nB: はい。あねの たんじょうびに、はなを あげる つもりです。",
        "example_dialog_id": "A: Tas itu baru, ya.\nB: Ya. Saya menerimanya dari kakak perempuan pada ulang tahun saya.\nA: Bagus, ya. Apakah pena itu juga dari kakak perempuan Anda?\nB: Bukan. Pena ini diberikan teman kepada saya.\nA: Lain kali, apakah Anda akan memberikan sesuatu kepada kakak perempuan Anda?\nB: Ya. Saya berniat memberikan bunga pada ulang tahunnya.",
        "communication_goal": "Aoi menanyakan hadiah yang Claire terima pada hari ulang tahunnya. Mereka menyebut pemberi dan penerima dengan jelas, kemudian membahas rencana hadiah balasan.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "cafe",
          "participants": [
            {
              "characterKey": "aoi-takahashi",
              "position": "left",
              "speaker": "A",
              "displayName": "葵",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "claire-bennett",
              "position": "right",
              "speaker": "B",
              "displayName": "クレア",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            {
              "speaker": "B",
              "text": "はい。たんじょうびに、あねから もらいました。",
              "expression": "senang"
            },
            null,
            null,
            null,
            {
              "speaker": "B",
              "text": "はい。あねの たんじょうびに、はなを あげる つもりです。",
              "expression": "berpikir"
            }
          ]
        }
      },
      "checks": [
        {
          "prompt": "Siapa yang memberikan tas kepada Claire?",
          "answer": "Kakak perempuan Claire.",
          "explanation": "Claire mengatakan あねからもらいました."
        },
        {
          "prompt": "Apa rencana hadiah Claire untuk kakak perempuannya?",
          "answer": "Bunga pada hari ulang tahunnya.",
          "explanation": "Claire menyebut はなをあげるつもりです dengan kakaknya sebagai penerima."
        }
      ]
    },
    {
      "grammarId": "cb1e0ca9-29d0-4f54-8432-a8cc0e34e9bd",
      "chapter": 18,
      "moduleId": "778fbd4d-82b0-41b8-bd36-e9f995df9fc3",
      "lessonId": "f5d34089-ff55-4a51-acda-8d04e6cddc2d",
      "expectedCore": {
        "id": "cb1e0ca9-29d0-4f54-8432-a8cc0e34e9bd",
        "module_id": "778fbd4d-82b0-41b8-bd36-e9f995df9fc3",
        "lesson_id": "f5d34089-ff55-4a51-acda-8d04e6cddc2d",
        "pattern": "Pelakuは Penerimaに Vてあげる",
        "meaning": "Melakukan sesuatu untuk orang lain; partikel peran dapat berubah menurut verba.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: ひっこしは、もう おわりましたか。\nB: はい。ともだちが にもつを もって くれました。\nA: えきから あたらしい うちまでは、どうやって いきましたか。\nB: あにに くるまで おくって もらいました。\nA: たすかりましたね。\nB: はい。こんどは、わたしが ともだちの ひっこしを てつだって あげたいです。",
        "example_dialog_id": "A: Apakah pindah rumahnya sudah selesai?\nB: Ya. Teman membantu saya membawakan barang.\nA: Dari stasiun ke rumah baru, bagaimana Anda pergi?\nB: Saya mendapat bantuan kakak laki-laki mengantar dengan mobil.\nA: Bantuan itu sangat menolong, ya.\nB: Ya. Lain kali saya ingin membantu teman saya pindah rumah.",
        "communication_goal": "Daniel bertanya tentang bantuan saat Hadi pindah rumah. Percakapan menjaga sudut pandang てくれる、てもらう、てあげる dan partikel yang mengikuti verba.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "park",
          "participants": [
            {
              "characterKey": "daniel-foster",
              "position": "left",
              "speaker": "A",
              "displayName": "ダニエル",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "hadi-pratama",
              "position": "right",
              "speaker": "B",
              "displayName": "ハディ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            null,
            {
              "speaker": "A",
              "text": "たすかりましたね。",
              "expression": "senang"
            },
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Siapa yang mengantar Hadi dengan mobil?",
          "answer": "Kakak laki-lakinya.",
          "explanation": "あにに…おくってもらいました menunjukkan kakak sebagai pelaku bantuan mengantar."
        },
        {
          "prompt": "Bantuan apa yang Hadi ingin berikan lain kali?",
          "answer": "Membantu temannya pindah rumah.",
          "explanation": "Hadi mengatakan ともだちのひっこしをてつだってあげたいです."
        }
      ]
    },
    {
      "grammarId": "a45f36e6-96a1-49ba-8c0e-3e96352e7e7a",
      "chapter": 18,
      "moduleId": "778fbd4d-82b0-41b8-bd36-e9f995df9fc3",
      "lessonId": "88f32646-5bbe-4791-b8be-af18d2bff13b",
      "expectedCore": {
        "id": "a45f36e6-96a1-49ba-8c0e-3e96352e7e7a",
        "module_id": "778fbd4d-82b0-41b8-bd36-e9f995df9fc3",
        "lesson_id": "88f32646-5bbe-4791-b8be-af18d2bff13b",
        "pattern": "Vてもらえませんか／Vてくれませんか Kasual：てもらえない？／てくれない？",
        "meaning": "Meminta bantuan; gunakan てくれませんか N5 sebagai pembanding, bukan konsep baru seluruhnya.",
        "sort_order": 4
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: すみません。このことばを よんで もらえませんか。\nB: はい。「としょかん」です。\nA: もういちど、ゆっくり よんで ほしいです。\nB: はい。「と・しょ・か・ん」です。\nA: わかりました。おしえて くれて、ありがとう。\nB: どういたしまして。",
        "example_dialog_id": "A: Permisi, bisakah Anda membantu membacakan kata ini?\nB: Ya. Bacaannya “toshokan”.\nA: Saya ingin Anda membacanya perlahan sekali lagi.\nB: Baik. “To-sho-ka-n.”\nA: Saya mengerti. Terima kasih sudah menjelaskannya.\nB: Sama-sama.",
        "communication_goal": "Anna meminta Aoi menjelaskan bacaan suatu kata, menyampaikan keinginan agar dibaca perlahan, lalu berterima kasih atas bantuan yang selesai.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "classroom",
          "participants": [
            {
              "characterKey": "anna-wijaya",
              "position": "left",
              "speaker": "A",
              "displayName": "アンナ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "aoi-takahashi",
              "position": "right",
              "speaker": "B",
              "displayName": "葵",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            {
              "speaker": "A",
              "text": "もういちど、ゆっくり よんで ほしいです。",
              "expression": "bingung"
            },
            null,
            {
              "speaker": "A",
              "text": "わかりました。おしえて くれて、ありがとう。",
              "expression": "senang"
            },
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Bantuan apa yang Anna minta pada awal percakapan?",
          "answer": "Membacakan sebuah kata.",
          "explanation": "よんでもらえませんか meminta bantuan membaca kata yang ditunjuk."
        },
        {
          "prompt": "Bagaimana Anna ingin kata itu dibaca untuk kedua kalinya?",
          "answer": "Perlahan.",
          "explanation": "ゆっくりよんでほしいです menyatakan cara membaca yang Anna harapkan."
        }
      ]
    },
    {
      "grammarId": "f0c421b9-ac27-4129-997e-d424784032a6",
      "chapter": 19,
      "moduleId": "df881aee-7127-4ccf-b8b8-14a14bb2f798",
      "lessonId": "2959cd36-7a07-4928-b4fb-72b62ab28d6c",
      "expectedCore": {
        "id": "f0c421b9-ac27-4129-997e-d424784032a6",
        "module_id": "df881aee-7127-4ccf-b8b8-14a14bb2f798",
        "lesson_id": "2959cd36-7a07-4928-b4fb-72b62ab28d6c",
        "pattern": "Kata tanya＋普通形＋か、… 普通形＋かどうか、…",
        "meaning": "Pertanyaan tertanam: kapan/di mana … vs apakah … atau tidak. N・Aな nonlampau positif tanpa だ.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: あした、なんにん くるか、わかりますか。\nB: いま、くると いった ひとは さんにんだけです。\nA: レンさんも きますか。\nB: レンさんが こられるかどうかは、まだ わかりません。\nA: さんにんしか いないんですね。\nB: はい。レンさんに、もういちど きいて みます。",
        "example_dialog_id": "A: Apakah Anda tahu berapa orang yang akan datang besok?\nB: Saat ini baru tiga orang yang mengatakan akan datang.\nA: Apakah Ren juga datang?\nB: Saya belum tahu apakah Ren bisa datang atau tidak.\nA: Jadi yang sudah pasti hanya tiga orang, ya.\nB: Ya. Saya akan mencoba menanyakan sekali lagi kepada Ren.",
        "communication_goal": "Claire dan Daniel memeriksa jumlah peserta acara. Mereka membedakan peserta yang sudah pasti dari seseorang yang belum memastikan kehadirannya.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "cafe",
          "participants": [
            {
              "characterKey": "claire-bennett",
              "position": "left",
              "speaker": "A",
              "displayName": "クレア",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "daniel-foster",
              "position": "right",
              "speaker": "B",
              "displayName": "ダニエル",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            {
              "speaker": "A",
              "text": "あした、なんにん くるか、わかりますか。",
              "expression": "berpikir"
            },
            null,
            null,
            null,
            null,
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Berapa peserta yang sudah menyatakan akan datang?",
          "answer": "Tiga orang.",
          "explanation": "Daniel mengatakan さんにんだけ; Ren belum masuk jumlah yang sudah pasti."
        },
        {
          "prompt": "Apa yang belum diketahui tentang Ren?",
          "answer": "Apakah Ren bisa datang atau tidak.",
          "explanation": "こられるかどうか adalah pertanyaan tertanam tentang kemungkinan hadir."
        }
      ]
    },
    {
      "grammarId": "525f3286-15cd-49fa-898e-1b35a7240b62",
      "chapter": 19,
      "moduleId": "df881aee-7127-4ccf-b8b8-14a14bb2f798",
      "lessonId": "ea68db2b-380e-415f-a706-76180d7b0ca8",
      "expectedCore": {
        "id": "525f3286-15cd-49fa-898e-1b35a7240b62",
        "module_id": "df881aee-7127-4ccf-b8b8-14a14bb2f798",
        "lesson_id": "ea68db2b-380e-415f-a706-76180d7b0ca8",
        "pattern": "N／Vる＋だけで",
        "meaning": "Cukup/hanya dengan …; menunjukkan syarat atau sarana yang minimal.",
        "sort_order": 4
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: このとしょかんは、がくせいだけが つかえるんですか。\nB: いいえ。がくせいだけでなく、まちの ひとも つかえます。\nA: どうすれば、ほんが かりられますか。\nB: このカードに なまえを かくだけで、かりられます。\nA: べんりですね。たくさんの ひとが きますか。\nB: はい。きのうは ごひゃくにんも きました。",
        "example_dialog_id": "A: Apakah perpustakaan ini hanya boleh digunakan siswa?\nB: Tidak. Bukan hanya siswa, warga kota juga boleh memakainya.\nA: Apa yang harus saya lakukan agar bisa meminjam buku?\nB: Cukup menulis nama pada kartu ini, Anda dapat meminjam.\nA: Praktis, ya. Apakah banyak orang datang?\nB: Ya. Kemarin sampai lima ratus orang datang.",
        "communication_goal": "Hadi dan Ren membahas layanan perpustakaan untuk siswa dan warga. Mereka memakai だけで、だけでなく、dan も sebagai penekanan jumlah.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "classroom",
          "participants": [
            {
              "characterKey": "hadi-pratama",
              "position": "left",
              "speaker": "A",
              "displayName": "ハディ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "ren-mori",
              "position": "right",
              "speaker": "B",
              "displayName": "蓮",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            null,
            {
              "speaker": "A",
              "text": "べんりですね。たくさんの ひとが きますか。",
              "expression": "senang"
            },
            {
              "speaker": "B",
              "text": "はい。きのうは ごひゃくにんも きました。",
              "expression": "kaget"
            }
          ]
        }
      },
      "checks": [
        {
          "prompt": "Selain siswa, siapa yang boleh memakai perpustakaan?",
          "answer": "Warga kota.",
          "explanation": "まちのひとも menambahkan warga kota sebagai pengguna."
        },
        {
          "prompt": "Apa yang cukup dilakukan untuk meminjam buku?",
          "answer": "Menulis nama pada kartu.",
          "explanation": "なまえをかくだけで menyatakan syarat minimal pada layanan ini."
        }
      ]
    },
    {
      "grammarId": "b391824a-4944-467a-ada3-935d375e7ab5",
      "chapter": 20,
      "moduleId": "3dd4992b-a41c-4588-92ac-b6373b73d03b",
      "lessonId": "12710081-1e60-410d-baf5-ecc973daa3cb",
      "expectedCore": {
        "id": "b391824a-4944-467a-ada3-935d375e7ab5",
        "module_id": "3dd4992b-a41c-4588-92ac-b6373b73d03b",
        "lesson_id": "12710081-1e60-410d-baf5-ecc973daa3cb",
        "pattern": "AはBほど〜ない／N・V普通形＋ほど",
        "meaning": "Tidak se-… B / sampai tingkat …; jelaskan fungsi perbandingan dan derajat dengan konteks berbeda.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: こうえんまで、あるくと どのくらい かかりますか。\nB: にじゅっぷんぐらいです。バスほど はやく ありません。\nA: バスは なんぷんごとに きますか。\nB: じゅっぷんごとです。バスなら、ごふんで つきます。\nA: じゃ、きょうは バスで いきます。\nB: はい。つぎの バスは、さんじごろ きますよ。",
        "example_dialog_id": "A: Berapa lama jika berjalan ke taman?\nB: Sekitar dua puluh menit. Tidak secepat bus.\nA: Bus datang setiap berapa menit?\nB: Setiap sepuluh menit. Kalau naik bus, sampai dalam lima menit.\nA: Kalau begitu, hari ini saya naik bus.\nB: Baik. Bus berikutnya datang sekitar pukul tiga.",
        "communication_goal": "Aoi menanyakan rute ke taman dan Anna menjelaskan pilihan transportasinya. Mereka membandingkan waktu berjalan dan naik bus serta interval bus.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "station",
          "participants": [
            {
              "characterKey": "aoi-takahashi",
              "position": "left",
              "speaker": "A",
              "displayName": "葵",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "anna-wijaya",
              "position": "right",
              "speaker": "B",
              "displayName": "アンナ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            {
              "speaker": "A",
              "text": "バスは なんぷんごとに きますか。",
              "expression": "berpikir"
            },
            null,
            null,
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Berapa lama perjalanan berjalan kaki ke taman?",
          "answer": "Sekitar dua puluh menit.",
          "explanation": "Anna menjawab にじゅっぷんぐらい untuk durasi berjalan."
        },
        {
          "prompt": "Seberapa sering bus datang?",
          "answer": "Setiap sepuluh menit.",
          "explanation": "じゅっぷんごと menunjukkan interval kedatangan, berbeda dari durasi perjalanan bus lima menit."
        }
      ]
    },
    {
      "grammarId": "b9365e25-6149-4998-9481-8bcaf30c3809",
      "chapter": 20,
      "moduleId": "3dd4992b-a41c-4588-92ac-b6373b73d03b",
      "lessonId": "e2881a0d-ee3f-4700-86b1-ccef2951ec44",
      "expectedCore": {
        "id": "b9365e25-6149-4998-9481-8bcaf30c3809",
        "module_id": "3dd4992b-a41c-4588-92ac-b6373b73d03b",
        "lesson_id": "e2881a0d-ee3f-4700-86b1-ccef2951ec44",
        "pattern": "V・Aい普通形／Aな＋な／N＋の＋場合（は）",
        "meaning": "Dalam hal/jika terjadi …; sering untuk petunjuk atau prosedur.",
        "sort_order": 5
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: あした、あめの ばあいは、どこで れんしゅうしますか。\nB: このきょうしつです。せんせいが いったとおりに、つくえを うごかしましょう。\nA: はい。あっ、となりの へやは でんきが ついたままですね。\nB: だれも いませんね。けして きます。\nA: ありがとうございます。わたしたちも、かえる ときに かくにんしましょう。\nB: はい。わすれないように しましょう。",
        "example_dialog_id": "A: Jika besok hujan, di mana kita berlatih?\nB: Di kelas ini. Mari memindahkan meja sesuai yang dikatakan guru.\nA: Baik. Oh, lampu ruangan sebelah masih menyala, ya.\nB: Tidak ada orang, ya. Saya akan mematikannya lalu kembali.\nA: Terima kasih. Kita juga perlu memeriksanya ketika pulang.\nB: Ya. Mari berusaha agar tidak lupa.",
        "communication_goal": "Daniel dan Claire menyiapkan kegiatan kelas sesuai petunjuk guru. Mereka memeriksa lokasi jika hujan dan memastikan lampu dimatikan saat meninggalkan ruangan.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "classroom",
          "participants": [
            {
              "characterKey": "daniel-foster",
              "position": "left",
              "speaker": "A",
              "displayName": "ダニエル",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "claire-bennett",
              "position": "right",
              "speaker": "B",
              "displayName": "クレア",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            {
              "speaker": "A",
              "text": "はい。あっ、となりの へやは でんきが ついたままですね。",
              "expression": "kaget"
            },
            null,
            null,
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Jika hujan, di mana mereka akan berlatih?",
          "answer": "Di kelas tempat mereka berada sekarang.",
          "explanation": "Claire menjawab このきょうしつです untuk kondisi hujan."
        },
        {
          "prompt": "Apa yang akan Claire lakukan di ruangan sebelah?",
          "answer": "Mematikan lampunya lalu kembali.",
          "explanation": "Tidak ada orang tetapi lampu menyala; けしてきます menyatakan pergi mematikan lalu kembali."
        }
      ]
    },
    {
      "grammarId": "6fc52ebb-2d7c-4da6-8263-3cc27d7c2b6d",
      "chapter": 21,
      "moduleId": "bc0d9617-17b7-4293-8250-542ac9dfdf45",
      "lessonId": "4048438e-6d2e-4322-90fd-b2859e70dada",
      "expectedCore": {
        "id": "6fc52ebb-2d7c-4da6-8263-3cc27d7c2b6d",
        "module_id": "bc0d9617-17b7-4293-8250-542ac9dfdf45",
        "lesson_id": "4048438e-6d2e-4322-90fd-b2859e70dada",
        "pattern": "受身形：G1 u→a＋れる（う→われる） G2 る→られる；する→される；来る→来られる",
        "meaning": "Konjugasi pasif: 書かれる、買われる、食べられる. Bedakan potensial melalui struktur dan konteks.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: ダニエルさん、うれしそうですね。\nB: はい。せんせいに さくぶんを ほめられました。\nA: どんな さくぶんを かいたんですか。\nB: かぞくの ことを かきました。「わかりやすい」と いわれました。\nA: よかったですね。わたしも よんでも いいですか。\nB: はい。どうぞ。",
        "example_dialog_id": "A: Daniel, Anda terlihat senang.\nB: Ya. Karangan saya dipuji oleh guru.\nA: Karangan tentang apa yang Anda tulis?\nB: Saya menulis tentang keluarga. Saya diberi komentar, “Mudah dipahami.”\nA: Bagus. Bolehkah saya membacanya juga?\nB: Ya. Silakan.",
        "communication_goal": "Ren dan Daniel membicarakan hasil karangan. Kalimat pasif langsung dipakai untuk menunjukkan siapa yang menerima pujian dan siapa pelakunya.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "classroom",
          "participants": [
            {
              "characterKey": "ren-mori",
              "position": "left",
              "speaker": "A",
              "displayName": "蓮",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "daniel-foster",
              "position": "right",
              "speaker": "B",
              "displayName": "ダニエル",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            {
              "speaker": "B",
              "text": "はい。せんせいに さくぶんを ほめられました。",
              "expression": "senang"
            },
            null,
            null,
            null,
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Siapa yang memuji karangan Daniel?",
          "answer": "Guru.",
          "explanation": "せんせいに…ほめられました menandai guru sebagai pelaku pujian."
        },
        {
          "prompt": "Karangan Daniel membahas apa?",
          "answer": "Keluarga.",
          "explanation": "Daniel mengatakan かぞくのことをかきました."
        }
      ]
    },
    {
      "grammarId": "b0f52855-f571-478f-a932-33b52781c2ab",
      "chapter": 21,
      "moduleId": "bc0d9617-17b7-4293-8250-542ac9dfdf45",
      "lessonId": "755f4715-42e0-4087-b796-b00da9540fb6",
      "expectedCore": {
        "id": "b0f52855-f571-478f-a932-33b52781c2ab",
        "module_id": "bc0d9617-17b7-4293-8250-542ac9dfdf45",
        "lesson_id": "755f4715-42e0-4087-b796-b00da9540fb6",
        "pattern": "Pihak terdampakは Pelakuに Nを V受身",
        "meaning": "Pasif yang melibatkan milik/bagian tubuh: 私は弟にケーキを食べられました.",
        "sort_order": 3
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: きのうは たいへんな いちにちでした。\nB: どうしたんですか。\nA: でんしゃで となりの ひとに あしを ふまれました。\nB: えっ、いたかったでしょう。いまは だいじょうぶですか。\nA: はい。もう だいじょうぶです。それから、かえりに あめに ふられて、ふくも ぬれました。\nB: それは たいへんでしたね。",
        "example_dialog_id": "A: Kemarin hari yang berat.\nB: Ada apa?\nA: Di kereta, kaki saya diinjak orang di sebelah.\nB: Wah, pasti sakit. Sekarang sudah tidak apa-apa?\nA: Ya, sekarang sudah tidak apa-apa. Lalu saat pulang saya kehujanan, dan pakaian saya juga basah.\nB: Wah, itu pasti menyusahkan.",
        "communication_goal": "Hadi menceritakan dua kejadian tidak menyenangkan kemarin kepada Aoi: kakinya diinjak dan ia kehujanan. ぬれる berarti menjadi basah.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "park",
          "participants": [
            {
              "characterKey": "hadi-pratama",
              "position": "left",
              "speaker": "A",
              "displayName": "ハディ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "aoi-takahashi",
              "position": "right",
              "speaker": "B",
              "displayName": "葵",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            {
              "speaker": "B",
              "text": "えっ、いたかったでしょう。いまは だいじょうぶですか。",
              "expression": "kaget"
            },
            null,
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Bagian tubuh Hadi yang diinjak adalah apa?",
          "answer": "Kaki.",
          "explanation": "あしをふまれました menyatakan dampak pada bagian tubuh Hadi."
        },
        {
          "prompt": "Mengapa pakaian Hadi menjadi basah?",
          "answer": "Ia kehujanan saat pulang.",
          "explanation": "あめにふられて、ふくもぬれました menyebut hujan sebagai kejadian yang berdampak pada Hadi."
        }
      ]
    },
    {
      "grammarId": "048f2898-cc0e-4cf4-be16-d18a94db71c7",
      "chapter": 22,
      "moduleId": "dec559f0-9e4f-44e2-b89d-e66df1a5525d",
      "lessonId": "481962f1-b0ec-4fd8-8881-cfad7df3bde0",
      "expectedCore": {
        "id": "048f2898-cc0e-4cf4-be16-d18a94db71c7",
        "module_id": "dec559f0-9e4f-44e2-b89d-e66df1a5525d",
        "lesson_id": "481962f1-b0ec-4fd8-8881-cfad7df3bde0",
        "pattern": "使役形：G1 u→a＋せる（う→わせる） G2 る→させる；する→させる；来る→来させる",
        "meaning": "Konjugasi kausatif: 書かせる、買わせる、食べさせる、 来させる（こさせる）.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: きょうの クラスでは、なにを しましたか。\nB: せんせいが、がくせいに にほんごで はなさせました。\nA: アンナさんも はなしたんですね。どうでしたか。\nB: すこし むずかしかったので、「もういちど はなさせて ください」と おねがいしました。\nA: もういちど できましたか。\nB: はい。せんせいが もういちど はなさせて くれました。",
        "example_dialog_id": "A: Apa yang dilakukan dalam kelas hari ini?\nB: Guru menyuruh siswa berbicara bahasa Jepang.\nA: Anna juga berbicara, ya. Bagaimana hasilnya?\nB: Karena agak sulit, saya meminta, “Izinkan saya berbicara sekali lagi.”\nA: Apakah Anda bisa mencobanya lagi?\nB: Ya. Guru memberi saya kesempatan berbicara sekali lagi.",
        "communication_goal": "Claire dan Anna membahas latihan berbicara. Guru menyuruh siswa berbicara, lalu Anna mendapatkan izin untuk mencoba lagi.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "classroom",
          "participants": [
            {
              "characterKey": "claire-bennett",
              "position": "left",
              "speaker": "A",
              "displayName": "クレア",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "anna-wijaya",
              "position": "right",
              "speaker": "B",
              "displayName": "アンナ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            {
              "speaker": "B",
              "text": "すこし むずかしかったので、「もういちど はなさせて ください」と おねがいしました。",
              "expression": "berpikir"
            },
            null,
            {
              "speaker": "B",
              "text": "はい。せんせいが もういちど はなさせて くれました。",
              "expression": "senang"
            }
          ]
        }
      },
      "checks": [
        {
          "prompt": "Siapa yang menyuruh siswa berbicara bahasa Jepang?",
          "answer": "Guru.",
          "explanation": "せんせいが…はなさせました menunjukkan guru sebagai penyuruh dan siswa sebagai pelaku berbicara."
        },
        {
          "prompt": "Apakah Anna mendapat kesempatan kedua?",
          "answer": "Ya, guru mengizinkannya berbicara sekali lagi.",
          "explanation": "はなさせてくれました menunjukkan pemberian kesempatan yang Anna minta."
        }
      ]
    },
    {
      "grammarId": "1bd12c89-d0c9-48c8-8f9b-50c0499f68af",
      "chapter": 22,
      "moduleId": "dec559f0-9e4f-44e2-b89d-e66df1a5525d",
      "lessonId": "7160069b-1114-4338-b594-60464920e7d6",
      "expectedCore": {
        "id": "1bd12c89-d0c9-48c8-8f9b-50c0499f68af",
        "module_id": "dec559f0-9e4f-44e2-b89d-e66df1a5525d",
        "lesson_id": "7160069b-1114-4338-b594-60464920e7d6",
        "pattern": "V使役 → hapus る＋られる G1：書かせられる；G2：食べさせられる",
        "meaning": "Konjugasi kausatif-pasif. Tidak beraturan: する→させられる、来る→来させられる.",
        "sort_order": 4
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: きのう、せんせいに さくぶんを なんども かかせられました。\nB: なんかい かいたんですか。\nA: さんかいも かかされました。つかれました。\nB: さんかいもですか。どこが むずかしかったんですか。\nA: ながいぶんが うまく かけませんでした。でも、さいごは よく なりました。\nB: そうですか。がんばりましたね。",
        "example_dialog_id": "A: Kemarin saya disuruh guru menulis karangan berkali-kali meskipun enggan.\nB: Berapa kali Anda menulisnya?\nA: Saya disuruh menulis sampai tiga kali. Saya lelah.\nB: Sampai tiga kali? Bagian mana yang sulit?\nA: Saya tidak bisa menulis kalimat panjang dengan baik. Tetapi akhirnya menjadi lebih baik.\nB: Begitu, ya. Anda sudah berusaha keras.",
        "communication_goal": "Aoi menjelaskan tugas yang harus ditulis berulang kali meskipun ia enggan. Ren mengenali bentuk penuh dan pendek kausatif-pasif tanpa mengubah pelakunya.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "cafe",
          "participants": [
            {
              "characterKey": "aoi-takahashi",
              "position": "left",
              "speaker": "A",
              "displayName": "葵",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "ren-mori",
              "position": "right",
              "speaker": "B",
              "displayName": "蓮",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            {
              "speaker": "B",
              "text": "さんかいもですか。どこが むずかしかったんですか。",
              "expression": "kaget"
            },
            null,
            {
              "speaker": "B",
              "text": "そうですか。がんばりましたね。",
              "expression": "senang"
            }
          ]
        }
      },
      "checks": [
        {
          "prompt": "Siapa yang menyuruh Aoi menulis karangan berulang kali?",
          "answer": "Guru.",
          "explanation": "せんせいに…かかせられました menandai guru sebagai penyuruh."
        },
        {
          "prompt": "Berapa kali Aoi menulis karangannya?",
          "answer": "Tiga kali.",
          "explanation": "さんかいもかかされました menyatakan jumlah tiga kali; かかされる adalah bentuk pendek kausatif-pasif."
        }
      ]
    },
    {
      "grammarId": "4d327a80-19df-4383-9ecf-c2819ee2b9a1",
      "chapter": 23,
      "moduleId": "75f7e5ca-c982-4011-9803-7910b6b91002",
      "lessonId": "cd4149b3-0b27-41d5-adbf-bdd0a69b6f8e",
      "expectedCore": {
        "id": "4d327a80-19df-4383-9ecf-c2819ee2b9a1",
        "module_id": "75f7e5ca-c982-4011-9803-7910b6b91002",
        "lesson_id": "cd4149b3-0b27-41d5-adbf-bdd0a69b6f8e",
        "pattern": "お＋Vます-stem＋になる ご＋nomina verbal＋になる（jika sesuai）",
        "meaning": "Pola hormat untuk verba yang menerima bentuk ini. Tidak semua verba dapat dibentuk secara mekanis.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: せんせいは、もう おかえりに なりましたか。\nB: いいえ。いま、となりの へやで はなされています。\nA: なんじに おかえりに なりますか。\nB: ろくじの よていです。ここで おまちに なりますか。\nA: はい。すこし まちます。\nB: わかりました。こちらに どうぞ。",
        "example_dialog_id": "A: Apakah Guru sudah pulang?\nB: Belum. Sekarang beliau sedang berbicara di ruangan sebelah.\nA: Pukul berapa beliau akan pulang?\nB: Rencananya pukul enam. Apakah Anda ingin menunggu di sini?\nA: Ya. Saya akan menunggu sebentar.\nB: Baik. Silakan di sini.",
        "communication_goal": "Simulasi penerimaan tamu sekolah: Daniel berperan sebagai tamu yang ingin menemui guru, Hadi sebagai petugas. Mereka memakai sonkeigo untuk tindakan guru, bukan untuk diri sendiri.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "classroom",
          "participants": [
            {
              "characterKey": "daniel-foster",
              "position": "left",
              "speaker": "A",
              "displayName": "ダニエル",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "hadi-pratama",
              "position": "right",
              "speaker": "B",
              "displayName": "ハディ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            {
              "speaker": "A",
              "text": "なんじに おかえりに なりますか。",
              "expression": "berpikir"
            },
            null,
            null,
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Apakah guru sudah pulang ketika Daniel datang?",
          "answer": "Belum; guru sedang berbicara di ruangan sebelah.",
          "explanation": "Hadi menjawab いいえ dan menjelaskan となりのへやではなされています."
        },
        {
          "prompt": "Siapa yang dihormati oleh おかえりになる dan はなされる dalam adegan ini?",
          "answer": "Guru yang dibicarakan.",
          "explanation": "Kedua ungkapan menyampaikan tindakan guru secara hormat; Daniel dan Hadi tidak meninggikan tindakan diri sendiri."
        }
      ]
    },
    {
      "grammarId": "4ff7d528-056e-456a-b117-02174d3000ce",
      "chapter": 23,
      "moduleId": "75f7e5ca-c982-4011-9803-7910b6b91002",
      "lessonId": "be48a5d3-e8fe-479c-badf-f31e30a769f0",
      "expectedCore": {
        "id": "4ff7d528-056e-456a-b117-02174d3000ce",
        "module_id": "75f7e5ca-c982-4011-9803-7910b6b91002",
        "lesson_id": "be48a5d3-e8fe-479c-badf-f31e30a769f0",
        "pattern": "行く・来る・いる→いらっしゃる 食べる・飲む→召し上がる；見る→ご覧になる",
        "meaning": "Kelompok verba hormat khusus; pelajari sebagai pasangan bentuk biasa dan hormat.",
        "sort_order": 3
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: こちらの メニューを ごらんください。\nB: ありがとうございます。おすすめは なんですか。\nA: このケーキです。なにを めしあがりますか。\nB: では、ケーキと おちゃを おねがいします。\nA: はい。すこし おまちください。",
        "example_dialog_id": "A: Silakan melihat menu ini.\nB: Terima kasih. Apa yang direkomendasikan?\nA: Kue ini. Anda ingin menyantap apa?\nB: Kalau begitu, saya pesan kue dan teh.\nA: Baik. Mohon menunggu sebentar.",
        "communication_goal": "Simulasi layanan kafe: Aoi berperan sebagai petugas dan Claire sebagai pelanggan. Petugas menawarkan menu, menanyakan pesanan dengan sonkeigo, lalu meminta pelanggan menunggu.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "cafe",
          "participants": [
            {
              "characterKey": "aoi-takahashi",
              "position": "left",
              "speaker": "A",
              "displayName": "葵",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "claire-bennett",
              "position": "right",
              "speaker": "B",
              "displayName": "クレア",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            {
              "speaker": "B",
              "text": "ありがとうございます。おすすめは なんですか。",
              "expression": "berpikir"
            },
            null,
            {
              "speaker": "B",
              "text": "では、ケーキと おちゃを おねがいします。",
              "expression": "senang"
            },
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Apa yang dipesan Claire?",
          "answer": "Kue dan teh.",
          "explanation": "Claire menyebut ケーキとおちゃをおねがいします."
        },
        {
          "prompt": "Dalam adegan ini, mengapa Aoi memakai めしあがる?",
          "answer": "Untuk menghormati tindakan makan/minum pelanggan.",
          "explanation": "Aoi bertindak sebagai petugas dan menanyakan pesanan Claire dengan verba hormat khusus."
        }
      ]
    },
    {
      "grammarId": "f0bb035c-2a94-4e0b-b943-e97fb4057610",
      "chapter": 24,
      "moduleId": "6bce9509-443d-4932-85c4-b500d6ab2d5a",
      "lessonId": "5368a7ce-fb1a-48cd-a138-c6d99938411e",
      "expectedCore": {
        "id": "f0bb035c-2a94-4e0b-b943-e97fb4057610",
        "module_id": "6bce9509-443d-4932-85c4-b500d6ab2d5a",
        "lesson_id": "5368a7ce-fb1a-48cd-a138-c6d99938411e",
        "pattern": "お＋Vます-stem＋する／いたす ご＋nomina verbal＋する／いたす（jika sesuai）",
        "meaning": "Pola merendah, misalnya お持ちする、ご案内する. Pilih verba dan arah tindakan yang sesuai.",
        "sort_order": 1
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: こちらが うけつけで ございます。\nB: ありがとうございます。かいぎしつは どこですか。\nA: にかいに ございます。わたしが ごあんないいたします。\nB: おねがいします。このにもつは、ここに おいても いいですか。\nA: はい。にもつは、わたしが おもちします。\nB: では、おねがいします。",
        "example_dialog_id": "A: Di sinilah bagian penerimaan.\nB: Terima kasih. Di mana ruang rapatnya?\nA: Di lantai dua. Saya akan mengantar Anda.\nB: Mohon bantuannya. Bolehkah barang bawaan ini saya taruh di sini?\nA: Boleh. Saya yang akan membawakan barangnya.\nB: Kalau begitu, mohon bantuannya.",
        "communication_goal": "Simulasi penerimaan peserta seminar: Ren berperan sebagai petugas dan Anna sebagai tamu. Petugas menyebut lokasi secara formal dan merendahkan tindakan mengantar serta membawakan barang. うけつけ berarti bagian penerimaan.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "classroom",
          "participants": [
            {
              "characterKey": "ren-mori",
              "position": "left",
              "speaker": "A",
              "displayName": "蓮",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "anna-wijaya",
              "position": "right",
              "speaker": "B",
              "displayName": "アンナ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            null,
            null,
            null,
            {
              "speaker": "B",
              "text": "では、おねがいします。",
              "expression": "senang"
            }
          ]
        }
      },
      "checks": [
        {
          "prompt": "Di lantai berapa ruang rapat berada?",
          "answer": "Lantai dua.",
          "explanation": "Ren mengatakan にかいにございます."
        },
        {
          "prompt": "Siapa yang akan mengantar Anna dan membawakan barang?",
          "answer": "Ren sebagai petugas.",
          "explanation": "わたしがごあんないいたします dan わたしがおもちします adalah tindakan petugas sendiri yang disampaikan secara merendah."
        }
      ]
    },
    {
      "grammarId": "7464741d-e555-41d3-9740-20a42e367d4f",
      "chapter": 24,
      "moduleId": "6bce9509-443d-4932-85c4-b500d6ab2d5a",
      "lessonId": "13c9f205-cab0-460f-b237-74284b18416a",
      "expectedCore": {
        "id": "7464741d-e555-41d3-9740-20a42e367d4f",
        "module_id": "6bce9509-443d-4932-85c4-b500d6ab2d5a",
        "lesson_id": "13c9f205-cab0-460f-b237-74284b18416a",
        "pattern": "あげる→差し上げる；もらう→いただく くれる→くださる（くださいます）",
        "meaning": "Bentuk memberi-menerima yang merendah atau menghormati; perhatikan siapa pemberi/penerima.",
        "sort_order": 4
      },
      "expectedDialogue": {
        "example_dialog": null,
        "example_dialog_id": null,
        "communication_goal": null,
        "dialog_scene": null,
        "dialog_furigana": null
      },
      "replacement": {
        "example_dialog": "A: せんせい、いただいた ほんを よみました。ありがとうございました。\nB: どうでしたか。\nA: おもしろかったです。でも、このぶんが わかりません。よんで いただけませんか。\nB: ええ。ここは「なまえを かいて ください」です。\nA: わかりました。おしえて くださって、ありがとうございます。\nB: どういたしまして。",
        "example_dialog_id": "A: Pak Guru, saya sudah membaca buku yang saya terima dari Anda. Terima kasih.\nB: Bagaimana bukunya?\nA: Menarik. Tetapi saya tidak memahami kalimat ini. Dapatkah Anda membacakannya?\nB: Tentu. Bagian ini berbunyi, “Tolong tulis nama.”\nA: Saya mengerti. Terima kasih sudah menjelaskannya.\nB: Sama-sama.",
        "communication_goal": "Simulasi bimbingan membaca: Hadi berperan sebagai peserta dan Daniel sebagai pengajar. Peserta menyebut buku yang diterima, meminta bantuan formal, dan berterima kasih dengan menghormati pemberi bantuan.",
        "dialog_scene": {
          "schemaVersion": 1,
          "enabled": true,
          "backgroundKey": "classroom",
          "participants": [
            {
              "characterKey": "hadi-pratama",
              "position": "left",
              "speaker": "A",
              "displayName": "ハディ",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            },
            {
              "characterKey": "daniel-foster",
              "position": "right",
              "speaker": "B",
              "displayName": "ダニエル",
              "voiceId": null,
              "voiceName": "",
              "profileVersion": 1,
              "custom": false
            }
          ],
          "expressions": [
            null,
            null,
            {
              "speaker": "A",
              "text": "おもしろかったです。でも、このぶんが わかりません。よんで いただけませんか。",
              "expression": "bingung"
            },
            null,
            {
              "speaker": "A",
              "text": "わかりました。おしえて くださって、ありがとうございます。",
              "expression": "senang"
            },
            null
          ]
        }
      },
      "checks": [
        {
          "prompt": "Siapa yang menerima buku dalam simulasi ini?",
          "answer": "Hadi sebagai peserta.",
          "explanation": "Hadi mengatakan いただいたほん, memakai sudut pandang menerima dari pengajar."
        },
        {
          "prompt": "Bantuan apa yang Hadi minta secara formal?",
          "answer": "Membacakan kalimat yang belum ia pahami.",
          "explanation": "よんでいただけませんか meminta bantuan membaca; setelah dibacakan ia mengucapkan terima kasih."
        }
      ]
    }
  ]
}$content$::jsonb; x jsonb; s jsonb; participant jsonb; line jsonb; character text; n int;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:graph'));
 PERFORM pg_advisory_xact_lock(hashtext('curriculum-boundary:'||(p->>'courseId')));
 SELECT count(*) INTO n FROM n4_dialogue_backup_190;
 IF n=47 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'items') i WHERE NOT EXISTS(SELECT 1 FROM n4_dialogue_backup_190 WHERE grammar_id=(i->>'grammarId')::uuid)) THEN RETURN; END IF;
 IF n<>0 THEN RAISE EXCEPTION '190 incomplete backup'; END IF;
 IF NOT EXISTS(SELECT 1 FROM courses WHERE id=(p->>'courseId')::uuid AND slug='n4') THEN RAISE EXCEPTION '190 course changed'; END IF;
 LOCK TABLE module_grammar,lessons,dialogue_speakers,dialogue_character_art IN SHARE ROW EXCLUSIVE MODE;
 FOR x IN SELECT value FROM jsonb_array_elements(p->'items') LOOP
  IF NOT EXISTS(SELECT 1 FROM module_grammar g JOIN modules m ON m.id=g.module_id JOIN lessons l ON l.id=g.lesson_id WHERE g.id=(x->>'grammarId')::uuid AND m.course_id=(p->>'courseId')::uuid AND l.module_id=m.id AND to_jsonb(g) @> (x->'expectedCore') AND to_jsonb(g) @> (x->'expectedDialogue')) THEN RAISE EXCEPTION '190 dialogue/core changed: %',x->>'grammarId'; END IF;
  IF EXISTS(SELECT 1 FROM grammar_dialog_questions WHERE grammar_id=(x->>'grammarId')::uuid) THEN RAISE EXCEPTION '190 dialogue questions added since audit'; END IF;
  FOR participant IN SELECT value FROM jsonb_array_elements(x->'replacement'->'dialog_scene'->'participants') LOOP
   IF NOT EXISTS(SELECT 1 FROM dialogue_speakers WHERE character_key=participant->>'characterKey' AND voice_id ~ '^[-_a-zA-Z0-9]{1,100}$' AND profile_version>=1) THEN RAISE EXCEPTION '190 character voice unconfigured: %',participant->>'characterKey'; END IF;
  END LOOP;
  FOR line IN SELECT value FROM jsonb_array_elements(x->'replacement'->'dialog_scene'->'expressions') WHERE value<>'null'::jsonb LOOP
   SELECT value->>'characterKey' INTO character FROM jsonb_array_elements(x->'replacement'->'dialog_scene'->'participants') WHERE value->>'speaker'=line->>'speaker';
   IF NOT EXISTS(SELECT 1 FROM dialogue_character_art WHERE character_key=character AND expression_key=line->>'expression') THEN RAISE EXCEPTION '190 expression missing: %/%',character,line->>'expression'; END IF;
  END LOOP;
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(p->'items') LOOP
  INSERT INTO n4_dialogue_backup_190 SELECT id,to_jsonb(module_grammar),now() FROM module_grammar WHERE id=(x->>'grammarId')::uuid;
  SELECT jsonb_set(x->'replacement'->'dialog_scene','{participants}',jsonb_agg(a.value || jsonb_build_object('voiceId',d.voice_id,'voiceName',coalesce(d.voice_name,''),'profileVersion',d.profile_version) ORDER BY a.ordinality)) INTO s
   FROM jsonb_array_elements(x->'replacement'->'dialog_scene'->'participants') WITH ORDINALITY a JOIN dialogue_speakers d ON d.character_key=a.value->>'characterKey';
  UPDATE module_grammar SET example_dialog=x->'replacement'->>'example_dialog',example_dialog_id=x->'replacement'->>'example_dialog_id',communication_goal=x->'replacement'->>'communication_goal',dialog_scene=s,dialog_furigana=null,updated_at=now() WHERE id=(x->>'grammarId')::uuid;
 END LOOP;
END $support$;
