-- 156_n4_lesson_flow.sql
-- N5-style lesson sequence for the 24 N4 chapters from migration 155.
-- Source: EzNihongo_Grammar_N4_24_Bab.pdf, 125 entries (including reinforcement).
-- Vocabulary, video assets, grammar examples and assessment questions remain editorial work.
-- Assignment is the chapter quiz, not an additional separate quiz lesson.
-- Re-running preserves IDs, authored content, media, questions and student progress.

DO $migration$
DECLARE
  v_course UUID;
  v_module UUID;
  v_lesson UUID;
  v_grammar_lesson UUID;
  v_task UUID;
  v_grammar UUID;
  v_chapter JSONB;
  v_group JSONB;
  v_entry JSONB;
  v_plan JSONB;
  v_item JSONB;
  v_ids UUID[];
  v_group_no INT;
  v_order INT;
  v_entry_no INT;
  v_item_no INT;
  v_count INT := 0;
  v_data JSONB := $data$[
  {
    "bab": 1,
    "title": "Menjelaskan Benda & Kegiatan",
    "objective": "Menjelaskan benda dengan kata kerja dan membicarakan kegiatan memakai の serta こと.",
    "prerequisite": "Materi N5 yang sudah dipelajari langsung digunakan dalam contoh.",
    "entries": [
      {
        "number": 1,
        "pattern": "V bentuk biasa＋N 母が作った料理・使わない物",
        "meaning": "Penjelasan diletakkan sebelum benda: 母が作った料理 = masakan yang ibu buat. が menunjukkan pelaku dalam penjelasan. Gabungkan contoh negatif dan sedang berlangsung di sini; jangan memakai です／ます sebelum N."
      },
      {
        "number": 2,
        "pattern": "V bentuk biasa＋の Vるのが好き／上手・Vるのは楽しい",
        "meaning": "Membicarakan kegiatan: 泳ぐのが好きです = saya suka berenang. の membuat kegiatan dapat menjadi hal yang dibicarakan."
      },
      {
        "number": 3,
        "pattern": "趣味は＋Vる＋ことです",
        "meaning": "Menyebutkan hobi: 趣味は泳ぐことです = hobi saya berenang. Gunakan kata kerja bentuk kamus sebelum こと."
      },
      {
        "number": 4,
        "pattern": "の／こと：cara memilih 泳ぐのが好き・趣味は泳ぐことです V bentuk biasa＋のを見た／聞いた",
        "meaning": "Bandingkan pemakaian dalam kalimat. Untuk melihat atau mendengar kejadian, gunakan の: 鳥が飛ぶのを見ました = saya melihat burung terbang. の dan こと tidak selalu bisa saling menggantikan."
      },
      {
        "number": 5,
        "pattern": "Aい＋の／Aな＋な＋の 赤いの・静かなの",
        "meaning": "Mengganti nama benda yang sudah jelas dari percakapan: 赤いの = yang merah; 静かなの = yang tenang."
      }
    ],
    "groups": [
      {
        "title": "Menjelaskan benda",
        "entries": [
          1,
          5
        ]
      },
      {
        "title": "Membicarakan kegiatan",
        "entries": [
          2,
          3,
          4
        ]
      }
    ],
    "intro": "<p>Menjelaskan benda dengan kata kerja dan membicarakan kegiatan memakai の serta こと.</p><p><strong>Dasar:</strong> Materi N5 yang sudah dipelajari langsung digunakan dalam contoh.</p>"
  },
  {
    "bab": 2,
    "title": "Penjelasan, Pendapat & Kutipan",
    "objective": "Menjelaskan keadaan, menyampaikan pikiran, dan melaporkan ucapan.",
    "prerequisite": "Bentuk biasa dari N5; Bab 1: menjelaskan benda dengan kata kerja.",
    "entries": [
      {
        "number": 1,
        "pattern": "普通形＋んです／のです N・Aな：だ→な＋んです",
        "meaning": "Menjelaskan konteks; termasuk なんです、たんです、ないんです、んですか. Kasual: V／Aい＋の？、N／Aな＋なの？."
      },
      {
        "number": 2,
        "pattern": "普通形＋んですが／んだけど N・Aな：なんですが／なんだけど",
        "meaning": "Mengantar pertanyaan, konsultasi, atau permintaan; bagian berikutnya dapat dilesapkan."
      },
      {
        "number": 3,
        "pattern": "普通形＋と思う／と思っています",
        "meaning": "Menyatakan pendapat atau pemikiran. N dan Aな mempertahankan だ: 学生だと思います."
      },
      {
        "number": 4,
        "pattern": "Kutipan＋と言う／と言っていた／と聞く Kutipan kasual：〜って",
        "meaning": "Mengutip atau melaporkan ucapan/informasi yang didengar; って dikenalkan sebagai variasi percakapan."
      },
      {
        "number": 5,
        "pattern": "Nama＋という＋N",
        "meaning": "N yang bernama/disebut …; contoh: さくらという店."
      },
      {
        "number": 6,
        "pattern": "普通形＋かな／のかな N・Aな：Nかな／Nなのかな",
        "meaning": "Bertanya-tanya atau menyatakan keraguan pada diri sendiri."
      }
    ],
    "groups": [
      {
        "title": "Menjelaskan keadaan",
        "entries": [
          1,
          2
        ]
      },
      {
        "title": "Pendapat dan kutipan",
        "entries": [
          3,
          4,
          5,
          6
        ]
      }
    ],
    "intro": "<p>Menjelaskan keadaan, menyampaikan pikiran, dan melaporkan ucapan.</p><p><strong>Dasar:</strong> Bentuk biasa dari N5; Bab 1: menjelaskan benda dengan kata kerja.</p>"
  },
  {
    "bab": 3,
    "title": "Waktu, Urutan & Kegiatan Beriringan",
    "objective": "Menyatakan kapan, sebelum/sesudah, dan hubungan antarkegiatan.",
    "prerequisite": "N5-B12/B13/B14: てから、ている、た、ない.",
    "entries": [
      {
        "number": 1,
        "pattern": "V普通形＋とき ／ Aい＋とき Aな＋なとき ／ N＋のとき",
        "meaning": "Ketika …; perbedaan Vるとき dan Vたとき mengikuti hubungan waktunya."
      },
      {
        "number": 2,
        "pattern": "Vる＋前に／Nの前に Vた＋後で／Nの後で",
        "meaning": "Sebelum dan sesudah; bandingkan dengan てから dari N5."
      },
      {
        "number": 3,
        "pattern": "Vている＋間／間に Nの間／間に",
        "meaning": "間: berlangsung sepanjang interval; 間に: terjadi di dalam interval, tidak harus sepanjang waktunya."
      },
      {
        "number": 4,
        "pattern": "Waktu／Vる＋まで ／ Waktu／Vる＋までに",
        "meaning": "まで: berlanjut sampai batas; までに: tindakan selesai paling lambat pada batas itu."
      },
      {
        "number": 5,
        "pattern": "Vたり、Vたりする",
        "meaning": "Menyebut beberapa contoh kegiatan. Bentuk berasal dari Vた＋り; urutan bukan fokus utama."
      },
      {
        "number": 6,
        "pattern": "Vます-stem＋ながら",
        "meaning": "Melakukan dua aktivitas bersamaan dengan pelaku yang sama; klausa akhir memuat aktivitas utama."
      },
      {
        "number": 7,
        "pattern": "Vない＋で、…",
        "meaning": "Melakukan B tanpa melakukan A; berbeda dari ないでください untuk larangan sopan."
      }
    ],
    "groups": [
      {
        "title": "Waktu, urutan, dan batas waktu",
        "entries": [
          1,
          2,
          3,
          4
        ]
      },
      {
        "title": "Hubungan antarkegiatan",
        "entries": [
          5,
          6,
          7
        ]
      }
    ],
    "intro": "<p>Menyatakan kapan, sebelum/sesudah, dan hubungan antarkegiatan.</p><p><strong>Dasar:</strong> N5-B12/B13/B14: てから、ている、た、ない.</p>"
  },
  {
    "bab": 4,
    "title": "Kemampuan & Persepsi",
    "objective": "Membedakan kemampuan atau kesempatan dengan pengalaman melihat dan mendengar.",
    "prerequisite": "N5-B17: Nができます; Bab 1: こと.",
    "entries": [
      {
        "number": 1,
        "pattern": "可能形：G1 u → e＋る；G2 る → られる する→できる；来る→来られる（こられる）",
        "meaning": "Bentuk potensial: 書ける、食べられる. Sertakan negatif, lampau, dan objek が／を menurut konstruksi."
      },
      {
        "number": 2,
        "pattern": "Vる＋ことができる",
        "meaning": "Dapat melakukan …; bandingkan dengan bentuk potensial tanpa menganggap keduanya selalu identik konteksnya."
      },
      {
        "number": 3,
        "pattern": "Nが見える／聞こえる Nが見られる／聞ける",
        "meaning": "Terlihat/terdengar secara perseptual vs dapat/kesempatan melihat atau mendengar."
      },
      {
        "number": 4,
        "pattern": "音・声・におい・味＋がする",
        "meaning": "Terdengar bunyi/suara, tercium bau, atau terasa suatu rasa."
      }
    ],
    "groups": [
      {
        "title": "Kemampuan",
        "entries": [
          1,
          2
        ]
      },
      {
        "title": "Persepsi",
        "entries": [
          3,
          4
        ]
      }
    ],
    "intro": "<p>Membedakan kemampuan atau kesempatan dengan pengalaman melihat dan mendengar.</p><p><strong>Dasar:</strong> N5-B17: Nができます; Bab 1: こと.</p>"
  },
  {
    "bab": 5,
    "title": "Niat, Keputusan & Kebiasaan",
    "objective": "Membedakan rencana, keputusan, perubahan, dan usaha membentuk kebiasaan.",
    "prerequisite": "N5-B19: つもり、予定、ましょう; Bab 2: と思う; Bab 4: potensial.",
    "entries": [
      {
        "number": 1,
        "pattern": "意向形＋（と思う／と思っている） G1 u→o＋う；G2 る→よう；しよう・来よう",
        "meaning": "Bentuk volisional untuk ajakan/tekad; ditambah と思う untuk niat. Konjugasi lengkap ada di lampiran."
      },
      {
        "number": 2,
        "pattern": "Vる／Vない＋ことにする／ことになる",
        "meaning": "Memutuskan sendiri vs menjadi keputusan/keadaan yang menentukan tindakan."
      },
      {
        "number": 3,
        "pattern": "Vる／Vない＋ことにしている",
        "meaning": "Menetapkan suatu kebiasaan/aturan untuk diri sendiri; bandingkan dengan keputusan satu kali ことにする."
      },
      {
        "number": 4,
        "pattern": "Vる／Vない／V可能形＋ようになる",
        "meaning": "Perubahan kemampuan/kebiasaan. Sertakan Vなくなる untuk “tidak lagi”; makna mengikuti konteks, bukan selalu “jadi bisa”."
      },
      {
        "number": 5,
        "pattern": "Vる／Vない＋ようにする／ようにしている",
        "meaning": "Berusaha atau membiasakan agar melakukan/tidak melakukan."
      }
    ],
    "groups": [
      {
        "title": "Niat dan keputusan",
        "entries": [
          1,
          2
        ]
      },
      {
        "title": "Kebiasaan dan perubahan",
        "entries": [
          3,
          4,
          5
        ]
      }
    ],
    "intro": "<p>Membedakan rencana, keputusan, perubahan, dan usaha membentuk kebiasaan.</p><p><strong>Dasar:</strong> N5-B19: つもり、予定、ましょう; Bab 2: と思う; Bab 4: potensial.</p>"
  },
  {
    "bab": 6,
    "title": "Mencoba, Menyelesaikan & Menanggapi Hasil",
    "objective": "Menyatakan percobaan, penyelesaian, penyesalan, dan respons terhadap hasil.",
    "prerequisite": "N5-B13/B19: bentuk て dan keinginan たい.",
    "entries": [
      {
        "number": 1,
        "pattern": "Vて＋みる",
        "meaning": "Mencoba melakukan; てみたい adalah penerapan pola ini dengan たい, bukan pola baru."
      },
      {
        "number": 2,
        "pattern": "Vて＋しまう てしまう→ちゃう；でしまう→じゃう",
        "meaning": "Selesai seluruhnya atau bernuansa terlanjur/tidak diharapkan; konteks menentukan penyesalan."
      },
      {
        "number": 3,
        "pattern": "Vて＋よかった ／ Vなくて＋よかった",
        "meaning": "Senang/lega karena melakukan atau tidak melakukan sesuatu."
      },
      {
        "number": 4,
        "pattern": "Vて＋すみません ／ Vなくて＋すみません",
        "meaning": "Meminta maaf atas tindakan atau tidak terlaksananya tindakan; negatif memakai なくて."
      }
    ],
    "groups": [
      {
        "title": "Mencoba dan menyelesaikan",
        "entries": [
          1,
          2
        ]
      },
      {
        "title": "Menanggapi hasil",
        "entries": [
          3,
          4
        ]
      }
    ],
    "intro": "<p>Menyatakan percobaan, penyelesaian, penyesalan, dan respons terhadap hasil.</p><p><strong>Dasar:</strong> N5-B13/B19: bentuk て dan keinginan たい.</p>"
  },
  {
    "bab": 7,
    "title": "Verba Berpasangan, Keadaan & Persiapan",
    "objective": "Membedakan perubahan yang terjadi, tindakan pelaku, hasil, dan persiapan.",
    "prerequisite": "N5-B10/B13: を dan ている; Bab 4: bentuk verba.",
    "entries": [
      {
        "number": 1,
        "pattern": "Nを＋他動詞 ／ Nが＋自動詞",
        "meaning": "Verba transitif-intransitif: ドアを開ける／ドアが開く. Pasangan dipelajari sebagai kosakata terkait."
      },
      {
        "number": 2,
        "pattern": "Nが＋自動詞ている",
        "meaning": "Keadaan hasil perubahan: ドアが開いている; perluasan terarah dari ている N5."
      },
      {
        "number": 3,
        "pattern": "Nが＋他動詞てある Nを＋Vてある juga dipakai pada konteks persiapan",
        "meaning": "Hasil tindakan yang sengaja dilakukan masih ada; misalnya persiapan atau penataan."
      },
      {
        "number": 4,
        "pattern": "Vて＋おく ておく→とく；でおく→どく",
        "meaning": "Melakukan sebagai persiapan atau membiarkan keadaan tetap begitu."
      }
    ],
    "groups": [
      {
        "title": "Pasangan verba dan keadaan",
        "entries": [
          1,
          2
        ]
      },
      {
        "title": "Hasil dan persiapan",
        "entries": [
          3,
          4
        ]
      }
    ],
    "intro": "<p>Membedakan perubahan yang terjadi, tindakan pelaku, hasil, dan persiapan.</p><p><strong>Dasar:</strong> N5-B10/B13: を dan ている; Bab 4: bentuk verba.</p>"
  },
  {
    "bab": 8,
    "title": "Arah, Perkembangan & Tahap Aktivitas",
    "objective": "Menjelaskan arah perubahan serta tahap mulai, berlangsung, dan selesai.",
    "prerequisite": "Bab 3/6/7; bentuk Vます-stem dari N5.",
    "entries": [
      {
        "number": 1,
        "pattern": "Vていく／Vてくる",
        "meaning": "Arah gerak atau perkembangan terhadap titik acuan; jelaskan kedua fungsi ruang dan waktu."
      },
      {
        "number": 2,
        "pattern": "Vます-stem＋始める／出す",
        "meaning": "Mulai melakukan/terjadi; 出す sering menonjolkan awal yang mendadak."
      },
      {
        "number": 3,
        "pattern": "Vます-stem＋続ける／終わる",
        "meaning": "Terus melakukan / selesai melakukan; bandingkan perkembangan tahap aktivitas."
      },
      {
        "number": 4,
        "pattern": "Vるところだ／Vているところだ／Vたところだ",
        "meaning": "Akan segera, sedang tepat pada saat itu, dan baru saja selesai. Tiga variasi dalam satu keluarga pola."
      },
      {
        "number": 5,
        "pattern": "Vた＋ばかりだ",
        "meaning": "Merasa baru saja melakukan sesuatu; jarak waktu dinilai pembicara. Bandingkan dengan Vたところだ."
      },
      {
        "number": 6,
        "pattern": "もうVた／Vました・まだVていない・まだVている",
        "meaning": "Sudah, belum, dan masih; bedakan keadaan selesai dengan berlangsungnya aktivitas."
      }
    ],
    "groups": [
      {
        "title": "Arah dan perkembangan aktivitas",
        "entries": [
          1,
          2,
          3
        ]
      },
      {
        "title": "Tahap dan status aktivitas",
        "entries": [
          4,
          5,
          6
        ]
      }
    ],
    "intro": "<p>Menjelaskan arah perubahan serta tahap mulai, berlangsung, dan selesai.</p><p><strong>Dasar:</strong> Bab 3/6/7; bentuk Vます-stem dari N5.</p>"
  },
  {
    "bab": 9,
    "title": "Cara, Kemudahan & Perubahan Sifat",
    "objective": "Menjelaskan cara melakukan, tingkat kesulitan, dan perubahan sifat.",
    "prerequisite": "N5-B6/B7/B15: sifat dan くなる／になる.",
    "entries": [
      {
        "number": 1,
        "pattern": "Vます-stem＋方 Nをする → Nの仕方",
        "meaning": "Cara melakukan: 読み方、使い方、勉強の仕方. Sesuaikan partikel ketika menjadi frasa nomina."
      },
      {
        "number": 2,
        "pattern": "Vます-stem＋やすい／にくい",
        "meaning": "Mudah atau sulit dilakukan; keduanya berkonjugasi seperti sifat い."
      },
      {
        "number": 3,
        "pattern": "Vます-stem＋すぎる Aい hapus い／Aな-stem＋すぎる",
        "meaning": "Terlalu/berlebihan; いい→よすぎる. Negatif dan bentuk lampau dari すぎる dipelajari sebagai variasi."
      },
      {
        "number": 4,
        "pattern": "Aい：い→く＋V／Aな-stem＋に＋V",
        "meaning": "Sifat menjadi keterangan cara: 早く歩く、静かに話す."
      },
      {
        "number": 5,
        "pattern": "Aい：い→くする ／ Aな・N＋にする",
        "meaning": "Membuat sesuatu menjadi …; bandingkan dengan くなる／になる dan pilihan にする dari N5."
      },
      {
        "number": 6,
        "pattern": "Aい hapus い／Aな-stem＋さ",
        "meaning": "Menominalkan derajat sifat: 高さ、便利さ; いい→よさ."
      }
    ],
    "groups": [
      {
        "title": "Cara dan kemudahan",
        "entries": [
          1,
          2,
          3
        ]
      },
      {
        "title": "Keterangan dan perubahan sifat",
        "entries": [
          4,
          5,
          6
        ]
      }
    ],
    "intro": "<p>Menjelaskan cara melakukan, tingkat kesulitan, dan perubahan sifat.</p><p><strong>Dasar:</strong> N5-B6/B7/B15: sifat dan くなる／になる.</p>"
  },
  {
    "bab": 10,
    "title": "Alasan, Kontras & Konsesi",
    "objective": "Menyatakan alasan, pertentangan, dan hasil yang tetap terjadi meskipun ada kondisi lain.",
    "prerequisite": "N5-B20: から、が、でも; Bab 3/6.",
    "entries": [
      {
        "number": 1,
        "pattern": "普通形＋ので N・Aな非過去肯定：な＋ので",
        "meaning": "Karena/sebab; menyajikan latar alasan. Bukan hanya versi sopan dari から."
      },
      {
        "number": 2,
        "pattern": "普通形＋し、普通形＋し、…",
        "meaning": "Menyebut alasan atau sifat secara bertambah; N・Aな memakai だし."
      },
      {
        "number": 3,
        "pattern": "普通形＋けど／けれど／けれども",
        "meaning": "Tetapi/meskipun; juga pengantar atau pelembut. N・Aな memakai だけど. Ragam tutur berbeda."
      },
      {
        "number": 4,
        "pattern": "普通形＋のに N・Aな非過去肯定：な＋のに",
        "meaning": "Padahal; hasil bertentangan dengan yang diharapkan pembicara."
      },
      {
        "number": 5,
        "pattern": "Vて／Vなくて、… Aいくて・Aな／Nで、…",
        "meaning": "Sebab/akibat atau keadaan terkait. Bedakan なくて karena tidak … dengan ないで tanpa melakukan …."
      },
      {
        "number": 6,
        "pattern": "Vて＋も／Aいくても Aな・N＋でも／negatif：なくても",
        "meaning": "Meskipun/walaupun …; dapat bermakna konsesi faktual atau hipotetis. Bedakan dari のに yang menonjolkan harapan yang meleset."
      }
    ],
    "groups": [
      {
        "title": "Alasan dan sebab",
        "entries": [
          1,
          2,
          5
        ]
      },
      {
        "title": "Kontras dan konsesi",
        "entries": [
          3,
          4,
          6
        ]
      }
    ],
    "intro": "<p>Menyatakan alasan, pertentangan, dan hasil yang tetap terjadi meskipun ada kondisi lain.</p><p><strong>Dasar:</strong> N5-B20: から、が、でも; Bab 3/6.</p>"
  },
  {
    "bab": 11,
    "title": "Dugaan & Informasi dari Orang Lain",
    "objective": "Membedakan penampakan, kabar, kemungkinan, dan ekspektasi berdasarkan alasan.",
    "prerequisite": "Bentuk biasa dari N5; Bab 2: laporan ucapan.",
    "entries": [
      {
        "number": 1,
        "pattern": "Vます-stem＋そうだ Aい hapus い／Aな-stem＋そうだ",
        "meaning": "Kelihatannya/akan segera; penampakan. Pengecualian: よさそう、なさそう. N tidak langsung memakai pola ini."
      },
      {
        "number": 2,
        "pattern": "普通形＋そうだ／そうです N・Aな非過去肯定：だそうだ",
        "meaning": "Katanya/saya dengar; kabar. Bedakan 降るそうだ dengan 降りそうだ."
      },
      {
        "number": 3,
        "pattern": "V・Aい普通形／N・Aな-stem＋らしい",
        "meaning": "Kabarnya/tampaknya berdasarkan informasi; khusus fungsi inferensi, bukan “khas …”."
      },
      {
        "number": 4,
        "pattern": "V・Aい普通形／N・Aな-stem＋かもしれない",
        "meaning": "Mungkin …; sertakan bentuk sopan かもしれません dan bentuk lampau/negatif pada klausa."
      },
      {
        "number": 5,
        "pattern": "V・Aい普通形／N・Aな-stem＋でしょう／だろう",
        "meaning": "Perkiraan atau meminta konfirmasi menurut konteks dan intonasi; bedakan ragam tutur."
      },
      {
        "number": 6,
        "pattern": "V・Aい普通形／Aな＋な／N＋の＋はずだ Pola sambungan yang sama＋はずがない",
        "meaning": "Diperkirakan demikian berdasarkan alasan / seharusnya tidak mungkin demikian. Bukan kewajiban moral."
      }
    ],
    "groups": [
      {
        "title": "Penampakan dan kabar",
        "entries": [
          1,
          2,
          3
        ]
      },
      {
        "title": "Kemungkinan dan ekspektasi",
        "entries": [
          4,
          5,
          6
        ]
      }
    ],
    "intro": "<p>Membedakan penampakan, kabar, kemungkinan, dan ekspektasi berdasarkan alasan.</p><p><strong>Dasar:</strong> Bentuk biasa dari N5; Bab 2: laporan ucapan.</p>"
  },
  {
    "bab": 12,
    "title": "Kemiripan, Perasaan & Keinginan",
    "objective": "Menyampaikan kemiripan, dugaan dari tanda, serta perasaan yang ditunjukkan orang lain.",
    "prerequisite": "Bab 9/11; N5-B19: たい dan 欲しい.",
    "entries": [
      {
        "number": 1,
        "pattern": "V・Aい普通形／Aな＋な／N＋の＋ようだ Nのような＋N／Nのように＋V・A",
        "meaning": "Sepertinya berdasarkan tanda atau mirip …; termasuk bentuk penjelas nomina/cara."
      },
      {
        "number": 2,
        "pattern": "V・Aい普通形／N・Aな-stem＋みたいだ Nみたいな＋N／Nみたいに＋V・A",
        "meaning": "Sepertinya/mirip; bentuk percakapan. みたい berbeda dari keinginan 見たい."
      },
      {
        "number": 3,
        "pattern": "そうな＋N ／ そうに＋V",
        "meaning": "Pengembangan そう penampakan untuk menerangkan nomina/cara. Contoh: おいしそうな料理、楽しそうに話す."
      },
      {
        "number": 4,
        "pattern": "Aい hapus い／Aな-stem＋がる",
        "meaning": "Menunjukkan tanda merasa …; terbatas pada sifat tertentu, misalnya 怖がる、嫌がる. Bukan semua sifat."
      },
      {
        "number": 5,
        "pattern": "Vます-stem＋たがる／たがっている Nを欲しがる／欲しがっている",
        "meaning": "Menunjukkan keinginan melakukan atau memiliki. Bentuk 〜がっている menjelaskan keadaan yang terlihat."
      }
    ],
    "groups": [
      {
        "title": "Kemiripan dan penampakan",
        "entries": [
          1,
          2,
          3
        ]
      },
      {
        "title": "Perasaan dan keinginan orang lain",
        "entries": [
          4,
          5
        ]
      }
    ],
    "intro": "<p>Menyampaikan kemiripan, dugaan dari tanda, serta perasaan yang ditunjukkan orang lain.</p><p><strong>Dasar:</strong> Bab 9/11; N5-B19: たい dan 欲しい.</p>"
  },
  {
    "bab": 13,
    "title": "Pengandaian と & たら",
    "objective": "Menyatakan syarat, kejadian otomatis, dan hal yang ditemukan setelah suatu peristiwa.",
    "prerequisite": "Bab 3; bentuk た dari N5.",
    "entries": [
      {
        "number": 1,
        "pattern": "V・Aい普通形＋と、… N・Aな非過去肯定：だと",
        "meaning": "Jika/ketika A, B terjadi secara lazim, otomatis, atau sebagai hasil pengamatan."
      },
      {
        "number": 2,
        "pattern": "Vた・Aかった・N／Aなだった＋ら Negatif：なかった＋ら",
        "meaning": "Jika/setelah …; termasuk もし〜たら dan hasil yang baru ditemukan. Semua variasi dalam satu keluarga."
      },
      {
        "number": 3,
        "pattern": "Vた＋らどうですか",
        "meaning": "Bagaimana kalau …; menyampaikan saran. Nada dan hubungan dengan lawan bicara perlu diperhatikan."
      },
      {
        "number": 4,
        "pattern": "普通形＋といい（ですね／な） N・Aな非過去肯定：だといい",
        "meaning": "Semoga … / akan baik kalau …; ungkapan harapan atau saran menurut konteks."
      }
    ],
    "groups": [
      {
        "title": "Syarat dan kejadian",
        "entries": [
          1,
          2
        ]
      },
      {
        "title": "Saran dan harapan",
        "entries": [
          3,
          4
        ]
      }
    ],
    "intro": "<p>Menyatakan syarat, kejadian otomatis, dan hal yang ditemukan setelah suatu peristiwa.</p><p><strong>Dasar:</strong> Bab 3; bentuk た dari N5.</p>"
  },
  {
    "bab": 14,
    "title": "Pengandaian ば & なら",
    "objective": "Memilih syarat berdasarkan hubungan antarklausa dan informasi percakapan.",
    "prerequisite": "Bab 13; perubahan bunyi verba pada Bab 4.",
    "entries": [
      {
        "number": 1,
        "pattern": "G1 u→e＋ば；G2 る→れば する→すれば；来る→来れば（くれば）",
        "meaning": "Syarat verba. Sertakan Aい→ければ, N／Aな→なら（ば）／であれば, dan negatif→なければ."
      },
      {
        "number": 2,
        "pattern": "V・Aい普通形／N・Aな-stem＋なら",
        "meaning": "Kalau memang … / kalau tentang …; menanggapi informasi atau asumsi dalam konteks."
      },
      {
        "number": 3,
        "pattern": "Vば＋よかった ／ Vなければ＋よかった",
        "meaning": "Seandainya tadi melakukan / tidak melakukan; penyesalan setelah fakta."
      }
    ],
    "groups": [
      {
        "title": "Syarat dan konteks",
        "entries": [
          1,
          2
        ]
      },
      {
        "title": "Penyesalan",
        "entries": [
          3
        ]
      }
    ],
    "intro": "<p>Memilih syarat berdasarkan hubungan antarklausa dan informasi percakapan.</p><p><strong>Dasar:</strong> Bab 13; perubahan bunyi verba pada Bab 4.</p>"
  },
  {
    "bab": 15,
    "title": "Tujuan, Kegunaan & Instruksi Tidak Langsung",
    "objective": "Menjelaskan tujuan, hasil yang ingin dicapai, dan kegunaan sesuatu.",
    "prerequisite": "Bab 1/2/4/5: nominalisasi, kutipan, potensial, dan ようになる.",
    "entries": [
      {
        "number": 1,
        "pattern": "Vます-stem＋に行く／来る／帰る",
        "meaning": "Pergi/datang/pulang untuk melakukan …; fondasi yang belum tercantum eksplisit dalam daftar N5."
      },
      {
        "number": 2,
        "pattern": "Vる＋ために ／ N＋のために",
        "meaning": "Untuk tujuan/manfaat …; fokus tujuan yang disengaja. Fungsi sebab dari ために tidak menjadi target bab ini."
      },
      {
        "number": 3,
        "pattern": "Vる／Vない／V可能形＋ように",
        "meaning": "Agar suatu keadaan atau kemampuan terwujud; sering memakai potensial atau negatif."
      },
      {
        "number": 4,
        "pattern": "Vる＋のに＋使う／便利だ／必要だ／時間がかかる",
        "meaning": "Untuk melakukan …, benda berguna/diperlukan atau membutuhkan waktu. Berbeda dari のに “padahal”."
      },
      {
        "number": 5,
        "pattern": "Vる／Vない＋ように言う",
        "meaning": "Menyampaikan instruksi/permintaan secara tidak langsung; misalnya 早く来るように言いました."
      }
    ],
    "groups": [
      {
        "title": "Tujuan tindakan",
        "entries": [
          1,
          2,
          3
        ]
      },
      {
        "title": "Kegunaan dan instruksi tidak langsung",
        "entries": [
          4,
          5
        ]
      }
    ],
    "intro": "<p>Menjelaskan tujuan, hasil yang ingin dicapai, dan kegunaan sesuatu.</p><p><strong>Dasar:</strong> Bab 1/2/4/5: nominalisasi, kutipan, potensial, dan ようになる.</p>"
  },
  {
    "bab": 16,
    "title": "Saran, Kewajiban & Instruksi Tegas",
    "objective": "Memilih saran, keharusan, dan instruksi sesuai hubungan pembicara.",
    "prerequisite": "N5-B13/B14: permintaan, izin, larangan, dan kewajiban.",
    "entries": [
      {
        "number": 1,
        "pattern": "Vた＋ほうがいい ／ Vない＋ほうがいい",
        "meaning": "Lebih baik melakukan / tidak melakukan. Untuk saran spesifik, ajarkan bentuk Vた."
      },
      {
        "number": 2,
        "pattern": "Vなくてはいけない／Vないといけない なくては→なくちゃ；なければ→なきゃ",
        "meaning": "Variasi kewajiban dari konsep yang sudah dikenal. いけない／ならない kadang dilesapkan dalam percakapan."
      },
      {
        "number": 3,
        "pattern": "Vる＋必要がある／必要はない",
        "meaning": "Perlu/tidak perlu melakukan; bandingkan dengan なくてもいい."
      },
      {
        "number": 4,
        "pattern": "Vます-stem＋なさい",
        "meaning": "Instruksi tegas; umum dalam relasi orang tua/guru kepada anak/siswa, bukan permintaan sopan universal."
      },
      {
        "number": 5,
        "pattern": "命令形：G1 u→e；G2 る→ろ する→しろ；来る→来い（こい）／Vる＋な",
        "meaning": "Perintah langsung dan larangan tegas “jangan …”. Prioritaskan pemahaman register dan konteks penggunaannya."
      }
    ],
    "groups": [
      {
        "title": "Saran dan keperluan",
        "entries": [
          1,
          2,
          3
        ]
      },
      {
        "title": "Instruksi dan larangan tegas",
        "entries": [
          4,
          5
        ]
      }
    ],
    "intro": "<p>Memilih saran, keharusan, dan instruksi sesuai hubungan pembicara.</p><p><strong>Dasar:</strong> N5-B13/B14: permintaan, izin, larangan, dan kewajiban.</p>"
  },
  {
    "bab": 17,
    "title": "Memberi & Menerima Benda",
    "objective": "Menentukan pemberi, penerima, dan sudut pandang pembicara dengan tepat.",
    "prerequisite": "N5: partikel dasar; Bab 1: peran frasa.",
    "entries": [
      {
        "number": 1,
        "pattern": "Pemberiは Penerimaに Bendaを あげる",
        "meaning": "Memberi kepada orang lain dari sudut pandang pemberi."
      },
      {
        "number": 2,
        "pattern": "Penerimaは Pemberiに／から Bendaを もらう",
        "meaning": "Menerima dari orang lain; pemilihan に／から bergantung pada pemberi/sumbernya."
      },
      {
        "number": 3,
        "pattern": "Pemberiは 私／kelompok sayaに Bendaを くれる",
        "meaning": "Memberi kepada saya atau pihak yang dipandang dekat dengan saya; konteks menentukan kelompok."
      }
    ],
    "groups": [
      {
        "title": "Pemberi, penerima, dan sudut pandang",
        "entries": [
          1,
          2,
          3
        ]
      }
    ],
    "intro": "<p>Menentukan pemberi, penerima, dan sudut pandang pembicara dengan tepat.</p><p><strong>Dasar:</strong> N5: partikel dasar; Bab 1: peran frasa.</p>"
  },
  {
    "bab": 18,
    "title": "Bantuan, Permintaan & Harapan",
    "objective": "Memahami manfaat tindakan, meminta bantuan, dan menyampaikan harapan kepada orang lain.",
    "prerequisite": "Bab 17; N5-B13: てくれませんか; N5-B19: たい.",
    "entries": [
      {
        "number": 1,
        "pattern": "Pelakuは Penerimaに Vてあげる",
        "meaning": "Melakukan sesuatu untuk orang lain; partikel peran dapat berubah menurut verba."
      },
      {
        "number": 2,
        "pattern": "Pelakuは 私／kelompok sayaに Vてくれる",
        "meaning": "Seseorang melakukan sesuatu yang bermanfaat bagi saya/pihak saya."
      },
      {
        "number": 3,
        "pattern": "Penerimaは Pelakuに Vてもらう",
        "meaning": "Menerima bantuan atau mengatur agar orang lain melakukan; tidak selalu berarti meminta secara lisan."
      },
      {
        "number": 4,
        "pattern": "Vてもらえませんか／Vてくれませんか Kasual：てもらえない？／てくれない？",
        "meaning": "Meminta bantuan; gunakan てくれませんか N5 sebagai pembanding, bukan konsep baru seluruhnya."
      },
      {
        "number": 5,
        "pattern": "Orangに Vてほしい／Vないでほしい",
        "meaning": "Ingin seseorang melakukan / tidak melakukan sesuatu; bedakan dari keinginan diri Vたい."
      },
      {
        "number": 6,
        "pattern": "Vてくれてありがとう",
        "meaning": "Berterima kasih atas tindakan orang lain; bentuk hormatnya dibahas setelah keigo."
      }
    ],
    "groups": [
      {
        "title": "Memberi dan menerima bantuan",
        "entries": [
          1,
          2,
          3
        ]
      },
      {
        "title": "Permintaan, harapan, dan terima kasih",
        "entries": [
          4,
          5,
          6
        ]
      }
    ],
    "intro": "<p>Memahami manfaat tindakan, meminta bantuan, dan menyampaikan harapan kepada orang lain.</p><p><strong>Dasar:</strong> Bab 17; N5-B13: てくれませんか; N5-B19: たい.</p>"
  },
  {
    "bab": 19,
    "title": "Pertanyaan Tertanam & Pembatasan Jumlah",
    "objective": "Menyampaikan hal yang belum diketahui serta membatasi benda atau jumlah.",
    "prerequisite": "Bab 1/2/10; N5-B11: penghitung.",
    "entries": [
      {
        "number": 1,
        "pattern": "Kata tanya＋普通形＋か、… 普通形＋かどうか、…",
        "meaning": "Pertanyaan tertanam: kapan/di mana … vs apakah … atau tidak. N・Aな nonlampau positif tanpa だ."
      },
      {
        "number": 2,
        "pattern": "N／jumlah＋だけ／しか＋negatif",
        "meaning": "Hanya …; だけ netral, しか menuntut predikat negatif dan sering menekankan keterbatasan."
      },
      {
        "number": 3,
        "pattern": "N＋ばかり／Vてばかりいる",
        "meaning": "Didominasi oleh … / terus melakukan itu saja. Berbeda dari Vたばかり pada Bab 8."
      },
      {
        "number": 4,
        "pattern": "N／Vる＋だけで",
        "meaning": "Cukup/hanya dengan …; menunjukkan syarat atau sarana yang minimal."
      },
      {
        "number": 5,
        "pattern": "N＋だけでなく、Nも…",
        "meaning": "Bukan hanya A, B juga; perluasan pada klausa diajarkan setelah bentuk sambungan dipahami."
      },
      {
        "number": 6,
        "pattern": "Jumlah＋も／は",
        "meaning": "Penekanan jumlah yang terasa banyak atau batas minimal, sesuai konteks."
      }
    ],
    "groups": [
      {
        "title": "Pertanyaan tertanam dan pembatasan",
        "entries": [
          1,
          2,
          3
        ]
      },
      {
        "title": "Perluasan dan penekanan jumlah",
        "entries": [
          4,
          5,
          6
        ]
      }
    ],
    "intro": "<p>Menyampaikan hal yang belum diketahui serta membatasi benda atau jumlah.</p><p><strong>Dasar:</strong> Bab 1/2/10; N5-B11: penghitung.</p>"
  },
  {
    "bab": 20,
    "title": "Perbandingan, Batas & Kondisi",
    "objective": "Membaca batas angka, kondisi, dan petunjuk, serta membandingkan derajat.",
    "prerequisite": "N5-B18: perbandingan; Bab 3/13/14/19.",
    "entries": [
      {
        "number": 1,
        "pattern": "AはBほど〜ない／N・V普通形＋ほど",
        "meaning": "Tidak se-… B / sampai tingkat …; jelaskan fungsi perbandingan dan derajat dengan konteks berbeda."
      },
      {
        "number": 2,
        "pattern": "Jumlah＋くらい／ぐらい／Waktu＋ごろ",
        "meaning": "Sekitar jumlah/durasi vs sekitar titik waktu. Perluasan くらい untuk derajat disertakan sebagai variasi."
      },
      {
        "number": 3,
        "pattern": "Periodeに＋jumlah回／N・jumlah＋ごとに",
        "meaning": "Frekuensi per periode dan pengulangan setiap unit; misalnya 一週間に三回、一時間ごとに."
      },
      {
        "number": 4,
        "pattern": "Jumlah＋以上／以下／未満；N＋以外",
        "meaning": "以上／以下 termasuk batas; 未満 di bawah batas tanpa menyertakannya; 以外 berarti selain."
      },
      {
        "number": 5,
        "pattern": "V・Aい普通形／Aな＋な／N＋の＋場合（は）",
        "meaning": "Dalam hal/jika terjadi …; sering untuk petunjuk atau prosedur."
      },
      {
        "number": 6,
        "pattern": "Vた／Vない＋まま Aい／Aな＋な／N＋の＋まま",
        "meaning": "Tetap dalam keadaan …; keadaan tidak berubah sementara hal lain terjadi."
      },
      {
        "number": 7,
        "pattern": "Vる／Vた＋とおりに N＋のとおりに／N＋どおりに",
        "meaning": "Sesuai/seperti petunjuk atau acuan: 説明したとおりに、予定どおりに."
      }
    ],
    "groups": [
      {
        "title": "Perbandingan, frekuensi, dan batas",
        "entries": [
          1,
          2,
          3,
          4
        ]
      },
      {
        "title": "Kondisi dan petunjuk",
        "entries": [
          5,
          6,
          7
        ]
      }
    ],
    "intro": "<p>Membaca batas angka, kondisi, dan petunjuk, serta membandingkan derajat.</p><p><strong>Dasar:</strong> N5-B18: perbandingan; Bab 3/13/14/19.</p>"
  },
  {
    "bab": 21,
    "title": "Kalimat Pasif",
    "objective": "Menyampaikan tindakan dari pihak yang dikenai atau terdampak.",
    "prerequisite": "Bab 4/7/17/18: bentuk verba, transitif-intransitif, dan peran orang.",
    "entries": [
      {
        "number": 1,
        "pattern": "受身形：G1 u→a＋れる（う→われる） G2 る→られる；する→される；来る→来られる",
        "meaning": "Konjugasi pasif: 書かれる、買われる、食べられる. Bedakan potensial melalui struktur dan konteks."
      },
      {
        "number": 2,
        "pattern": "Penerimaは Pelakuに V受身",
        "meaning": "Pasif langsung: 私は先生に褒められました."
      },
      {
        "number": 3,
        "pattern": "Pihak terdampakは Pelakuに Nを V受身",
        "meaning": "Pasif yang melibatkan milik/bagian tubuh: 私は弟にケーキを食べられました."
      },
      {
        "number": 4,
        "pattern": "Pihak terdampakは Pelaku／kejadianに V受身",
        "meaning": "Pasif tidak langsung, termasuk verba intransitif: 雨に降られました."
      },
      {
        "number": 5,
        "pattern": "Nは V受身 ／ Nは Pelakuによって V受身",
        "meaning": "Benda/peristiwa sebagai topik; によって untuk pelaku dalam konteks tertentu, misalnya penciptaan."
      }
    ],
    "groups": [
      {
        "title": "Bentuk dan pasif langsung",
        "entries": [
          1,
          2
        ]
      },
      {
        "title": "Dampak dan peristiwa",
        "entries": [
          3,
          4,
          5
        ]
      }
    ],
    "intro": "<p>Menyampaikan tindakan dari pihak yang dikenai atau terdampak.</p><p><strong>Dasar:</strong> Bab 4/7/17/18: bentuk verba, transitif-intransitif, dan peran orang.</p>"
  },
  {
    "bab": 22,
    "title": "Kausatif & Kausatif-Pasif",
    "objective": "Membedakan menyuruh, mengizinkan, dan terpaksa melakukan sesuatu.",
    "prerequisite": "Bab 7/18/21: jenis verba, bantuan, dan pasif.",
    "entries": [
      {
        "number": 1,
        "pattern": "使役形：G1 u→a＋せる（う→わせる） G2 る→させる；する→させる；来る→来させる",
        "meaning": "Konjugasi kausatif: 書かせる、買わせる、食べさせる、 来させる（こさせる）."
      },
      {
        "number": 2,
        "pattern": "Penyebabは Pelakuに Bendaを V使役 Intransitif：Penyebabは Pelakuを／に V使役",
        "meaning": "Kausatif transitif dan intransitif. Makna menyuruh atau mengizinkan ditentukan konteks, bukan dua rumus terpisah."
      },
      {
        "number": 3,
        "pattern": "V使役＋てください V使役＋てあげる／てくれる／てもらう",
        "meaning": "Meminta izin atau memberi/menerima kesempatan melakukan; bertumpu pada bab pemberian tindakan."
      },
      {
        "number": 4,
        "pattern": "V使役 → hapus る＋られる G1：書かせられる；G2：食べさせられる",
        "meaning": "Konjugasi kausatif-pasif. Tidak beraturan: する→させられる、来る→来させられる."
      },
      {
        "number": 5,
        "pattern": "Pelaku terpaksaは Penyuruhに V使役受身",
        "meaning": "Terpaksa/disuruh melakukan …; 私は先生に作文を書かせられました."
      },
      {
        "number": 6,
        "pattern": "G1 a＋せられる → a＋される 書かせられる→書かされる",
        "meaning": "Bentuk pendek yang umum; jangan terapkan pada verba berakhiran す: 話させられる tetap."
      }
    ],
    "groups": [
      {
        "title": "Kausatif, izin, dan kesempatan",
        "entries": [
          1,
          2,
          3
        ]
      },
      {
        "title": "Kausatif-pasif",
        "entries": [
          4,
          5,
          6
        ]
      }
    ],
    "intro": "<p>Membedakan menyuruh, mengizinkan, dan terpaksa melakukan sesuatu.</p><p><strong>Dasar:</strong> Bab 7/18/21: jenis verba, bantuan, dan pasif.</p>"
  },
  {
    "bab": 23,
    "title": "Bahasa Hormat: Sonkeigo",
    "objective": "Menghormati tindakan orang lain dengan pola dan verba yang sesuai.",
    "prerequisite": "Bab 21; N5-B15: お〜ください.",
    "entries": [
      {
        "number": 1,
        "pattern": "お＋Vます-stem＋になる ご＋nomina verbal＋になる（jika sesuai）",
        "meaning": "Pola hormat untuk verba yang menerima bentuk ini. Tidak semua verba dapat dibentuk secara mekanis."
      },
      {
        "number": 2,
        "pattern": "V受身形 untuk makna hormat",
        "meaning": "Bentuk 〜れる／られる yang menghormati pelaku, bukan berarti pelaku dikenai tindakan."
      },
      {
        "number": 3,
        "pattern": "行く・来る・いる→いらっしゃる 食べる・飲む→召し上がる；見る→ご覧になる",
        "meaning": "Kelompok verba hormat khusus; pelajari sebagai pasangan bentuk biasa dan hormat."
      },
      {
        "number": 4,
        "pattern": "する→なさる；言う→おっしゃる 知っている→ご存じだ",
        "meaning": "Verba/ungkapan hormat khusus lainnya; ご存じだ bukan konjugasi pasif."
      },
      {
        "number": 5,
        "pattern": "いらっしゃいます・なさいます・おっしゃいます お＋Vます-stem＋ください／ご＋N＋ください",
        "meaning": "Konjugasi sopan khusus dan instruksi hormat; hubungkan kembali お待ちください dari N5."
      }
    ],
    "groups": [
      {
        "title": "Pola hormat",
        "entries": [
          1,
          2
        ]
      },
      {
        "title": "Verba dan instruksi hormat",
        "entries": [
          3,
          4,
          5
        ]
      }
    ],
    "intro": "<p>Menghormati tindakan orang lain dengan pola dan verba yang sesuai.</p><p><strong>Dasar:</strong> Bab 21; N5-B15: お〜ください.</p>"
  },
  {
    "bab": 24,
    "title": "Bahasa Merendah & Permintaan Formal",
    "objective": "Menggabungkan kenjougo, bahasa sopan, dan permintaan dalam konteks kerja atau layanan.",
    "prerequisite": "Bab 17/18/23; pasif-kausatif tidak dijadikan prasyarat untuk semua ungkapan sopan.",
    "entries": [
      {
        "number": 1,
        "pattern": "お＋Vます-stem＋する／いたす ご＋nomina verbal＋する／いたす（jika sesuai）",
        "meaning": "Pola merendah, misalnya お持ちする、ご案内する. Pilih verba dan arah tindakan yang sesuai."
      },
      {
        "number": 2,
        "pattern": "参る・申す・いたす・おる 伺う・拝見する・お目にかかる・存じている",
        "meaning": "Verba merendah/sangat sopan; arti dan pasangan bentuk biasa tersedia di tabel khusus lampiran."
      },
      {
        "number": 3,
        "pattern": "ある→ございます ／ です→でございます",
        "meaning": "Bahasa sopan (丁寧語); tidak otomatis berarti kenjougo atau perubahan keadaan."
      },
      {
        "number": 4,
        "pattern": "あげる→差し上げる；もらう→いただく くれる→くださる（くださいます）",
        "meaning": "Bentuk memberi-menerima yang merendah atau menghormati; perhatikan siapa pemberi/penerima."
      },
      {
        "number": 5,
        "pattern": "Vて差し上げる／Vていただく／Vてくださる Vていただけませんか／Vていただけますか",
        "meaning": "Pemberian tindakan secara hormat/merendah dan permintaan bantuan; bandingkan dengan てもらえませんか."
      },
      {
        "number": 6,
        "pattern": "Vていただき、ありがとうございます Vてくださって、ありがとうございます",
        "meaning": "Terima kasih atas tindakan orang lain, dengan perbedaan sudut pandang menerima/menghormati."
      }
    ],
    "groups": [
      {
        "title": "Merendah dan bahasa sopan",
        "entries": [
          1,
          2,
          3
        ]
      },
      {
        "title": "Pemberian dan permintaan formal",
        "entries": [
          4,
          5,
          6
        ]
      }
    ],
    "intro": "<p>Menggabungkan kenjougo, bahasa sopan, dan permintaan dalam konteks kerja atau layanan.</p><p><strong>Dasar:</strong> Bab 17/18/23; pasif-kausatif tidak dijadikan prasyarat untuk semua ungkapan sopan.</p>"
  }
]$data$::jsonb;
BEGIN
  SELECT id INTO v_course FROM courses WHERE slug = 'n4';
  IF v_course IS NULL THEN
    RAISE EXCEPTION '156: course n4 is required; create it and apply migration 155 first';
  END IF;

  FOR v_chapter IN SELECT value FROM jsonb_array_elements(v_data) LOOP
    SELECT id INTO STRICT v_module FROM modules
     WHERE course_id = v_course
       AND slug LIKE 'n4-b' || lpad(v_chapter->>'bab', 2, '0') || '-%';
    v_ids := ARRAY[]::UUID[];
    v_plan := jsonb_build_array(
      jsonb_build_object('slug', 'pelajaran-1-pengantar', 'title', 'Pengantar', 'type', 'video', 'duration', 10, 'content', v_chapter->>'intro'),
      jsonb_build_object('slug', 'pelajaran-2-kosakata', 'title', 'Kosakata 語彙', 'type', 'deck', 'duration', 30),
      jsonb_build_object('slug', 'pelajaran-3-kanji', 'title', 'Kanji 漢字', 'type', 'kanji', 'duration', 20)
    );
    v_group_no := 0;
    FOR v_group IN SELECT value FROM jsonb_array_elements(v_chapter->'groups') LOOP
      v_group_no := v_group_no + 1;
      v_plan := v_plan || jsonb_build_array(
        jsonb_build_object('slug', 'tata-bahasa-' || v_group_no, 'title', 'Tata Bahasa: ' || (v_group->>'title'), 'type', 'video', 'duration', 20),
        jsonb_build_object('slug', 'tugas-bunpou-' || v_group_no, 'title', 'Tugas Bunpou: ' || (v_group->>'title'), 'type', 'grammar_task', 'duration', 15)
      );
    END LOOP;
    v_plan := v_plan || jsonb_build_array(jsonb_build_object(
      'slug', 'assignment-bab-' || (v_chapter->>'bab'), 'title', 'Assignment Bab ' || (v_chapter->>'bab') || ': ' || (v_chapter->>'title'), 'type', 'quiz', 'duration', 30
    ));

    v_order := 0;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_plan) LOOP
      v_order := v_order + 1;
      INSERT INTO lessons (module_id, slug, title, type, content, sort_order, duration_minutes)
      VALUES (v_module, v_item->>'slug', v_item->>'title', v_item->>'type', v_item->>'content', v_order, (v_item->>'duration')::int)
      ON CONFLICT (module_id, slug) DO UPDATE SET
        title = EXCLUDED.title, type = EXCLUDED.type, sort_order = EXCLUDED.sort_order,
        content = COALESCE(NULLIF(lessons.content, ''), EXCLUDED.content),
        duration_minutes = COALESCE(lessons.duration_minutes, EXCLUDED.duration_minutes), updated_at = NOW()
      RETURNING id INTO v_lesson;
      v_ids := array_append(v_ids, v_lesson);
    END LOOP;

    -- Keep additional editor-authored lessons, in their original relative order.
    WITH extras AS (
      SELECT id, row_number() OVER (ORDER BY sort_order, created_at, id) AS n
        FROM lessons WHERE module_id = v_module AND NOT (id = ANY(v_ids))
    )
    UPDATE lessons l SET sort_order = v_order + extras.n, updated_at = NOW()
      FROM extras WHERE l.id = extras.id;

    v_group_no := 0;
    FOR v_group IN SELECT value FROM jsonb_array_elements(v_chapter->'groups') LOOP
      v_group_no := v_group_no + 1;
      v_grammar_lesson := v_ids[2 + v_group_no * 2];
      v_task := v_ids[3 + v_group_no * 2];
      v_item_no := 0;
      FOR v_entry_no IN SELECT value::int FROM jsonb_array_elements_text(v_group->'entries') LOOP
        v_entry := v_chapter->'entries'->(v_entry_no - 1);
        v_item_no := v_item_no + 1;
        SELECT id INTO v_grammar FROM module_grammar
         WHERE module_id = v_module AND pattern = v_entry->>'pattern'
         ORDER BY created_at, id LIMIT 1;
        IF v_grammar IS NULL THEN
          INSERT INTO module_grammar (module_id, lesson_id, pattern, meaning, sort_order)
          VALUES (v_module, v_grammar_lesson, v_entry->>'pattern', v_entry->>'meaning', v_entry_no)
          RETURNING id INTO v_grammar;
        ELSE
          UPDATE module_grammar SET lesson_id = v_grammar_lesson,
            meaning = COALESCE(NULLIF(meaning, ''), v_entry->>'meaning'),
            sort_order = v_entry_no, updated_at = NOW() WHERE id = v_grammar;
        END IF;
        INSERT INTO lesson_grammar_task_items (lesson_id, grammar_id, sort_order, instruction, required_count)
        VALUES (v_task, v_grammar, v_item_no, 'Buat satu kalimat dengan pola ' || (v_entry->>'pattern') || '.', 1)
        ON CONFLICT (lesson_id, grammar_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;
        v_count := v_count + 1;
      END LOOP;
    END LOOP;

    IF EXISTS (SELECT sort_order FROM lessons WHERE module_id = v_module GROUP BY sort_order HAVING count(*) > 1) THEN
      RAISE EXCEPTION '156: duplicate lesson order in N4 chapter %', v_chapter->>'bab';
    END IF;
  END LOOP;
  IF v_count <> 125 THEN
    RAISE EXCEPTION '156: expected 125 grammar entries, got %', v_count;
  END IF;
  RAISE NOTICE '156: 24 chapters, 47 grammar groups, 125 grammar entries linked to tasks';
END $migration$;
