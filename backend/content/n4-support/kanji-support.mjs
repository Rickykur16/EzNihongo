// Reviewed word practice for the fixed N4 kanji sequence. Core character rows,
// meanings and on/kun inventories remain editable in their original locations.
// Each sentence uses a target word in context; full kana support is explicit.
const rows = `
1|物|物|もの|benda; barang|これは わたしの {物~もの}です。|Ini barang milik saya.
1|事|食事|しょくじ|makan; waktu makan|いっしょに {食事~しょくじ}を しませんか。|Maukah makan bersama?
1|者|医者|いしゃ|dokter|あの 人は {医者~いしゃ}です。|Orang itu dokter.
1|作|作る|つくる|membuat|これは ははが {作った~つくった} ケーキです。|Ini kue yang dibuat ibu saya.
1|用|用事|ようじ|urusan; keperluan|きょうは {用事~ようじ}が あります。|Hari ini saya ada keperluan.
1|品|品物|しなもの|barang; produk|この {品物~しなもの}は いくらですか。|Berapa harga barang ini?
1|題|題名|だいめい|judul karya|この 本の {題名~だいめい}は なんですか。|Apa judul buku ini?
1|字|字|じ|huruf; tulisan|大きい {字~じ}で かいて ください。|Tulislah dengan huruf besar.
2|知|知る|しる|mengetahui|あの 人を {知って~しって} いますか。|Apakah kamu mengenal orang itu?
2|思|思う|おもう|berpikir; berpendapat|この 本は おもしろいと {思います~おもいます}。|Menurut saya buku ini menarik.
2|考|考える|かんがえる|memikirkan; mempertimbangkan|少し {考えて~かんがえて}も いいですか。|Bolehkah saya berpikir sebentar?
2|意|意見|いけん|pendapat|あなたの {意見~いけん}を 聞きたいです。|Saya ingin mendengar pendapatmu.
2|説|説明|せつめい|penjelasan|先生の {説明~せつめい}を 聞いて います。|Saya sedang mendengarkan penjelasan guru.
2|問|問題|もんだい|soal; masalah|この {問題~もんだい}は むずかしいと 思います。|Menurut saya soal ini sulit.
2|答|答える|こたえる|menjawab|先生の しつもんに {答えて~こたえて} ください。|Jawablah pertanyaan guru.
2|文|文|ぶん|kalimat|日本語で {文~ぶん}を 三つ かいて ください。|Tulislah tiga kalimat dalam bahasa Jepang.
3|朝|朝|あさ|pagi|{朝~あさ}、ごはんを 食べてから 学校へ 行きます。|Pagi hari, saya berangkat ke sekolah setelah makan.
3|昼|昼|ひる|siang|{昼~ひる}に パンを 食べました。|Saya makan roti pada siang hari.
3|夜|夜|よる|malam|{夜~よる}、ねる 前に 本を 読みます。|Malam hari, saya membaca buku sebelum tidur.
3|今|今|いま|sekarang|{今~いま}、何時ですか。|Sekarang pukul berapa?
3|夕|夕方|ゆうがた|sore|{夕方~ゆうがた}までに かえります。|Saya akan pulang paling lambat sore hari.
3|曜|月曜日|げつようび|Senin|{月曜日~げつようび}に テストが あります。|Ada tes pada hari Senin.
3|早|早い|はやい|awal; cepat|あしたは {早い~はやい} 時間に 出ます。|Besok saya berangkat pada waktu yang lebih awal.
3|帰|帰る|かえる|pulang|うちへ {帰る~かえる} 前に、パンを かいます。|Sebelum pulang, saya membeli roti.
4|力|力|ちから|tenaga; kekuatan|この しごとは {力~ちから}が いります。|Pekerjaan ini memerlukan tenaga.
4|強|強い|つよい|kuat|きょうは かぜが {強い~つよい}です。|Hari ini anginnya kencang.
4|弱|弱い|よわい|lemah|この へやは でんぱが {弱い~よわい}です。|Sinyal di kamar ini lemah.
4|体|体|からだ|tubuh|毎日、{体~からだ}を うごかして います。|Setiap hari saya menggerakkan tubuh.
4|頭|頭|あたま|kepala|{頭~あたま}が いたいんです。|Kepala saya sedang sakit.
4|声|声|こえ|suara manusia/hewan|となりの へやから 人の {声~こえ}が 聞こえます。|Terdengar suara orang dari kamar sebelah.
4|音|音|おと|bunyi; suara|外で 大きい {音~おと}が しました。|Tadi terdengar bunyi keras di luar.
4|味|味|あじ|rasa|この スープは いい {味~あじ}が します。|Sup ini rasanya enak.
5|自|自分|じぶん|diri sendiri|これからは {自分~じぶん}で おべんとうを 作ります。|Mulai sekarang saya akan membuat bekal sendiri.
5|主|主人|しゅじん|suami sendiri|{主人~しゅじん}は 会社で はたらいて います。|Suami saya bekerja di perusahaan.
5|心|心|こころ|hati; perasaan|友だちの ことばが {心~こころ}に のこって います。|Kata-kata teman masih membekas di hati saya.
5|正|正しい|ただしい|benar; tepat|{正しい~ただしい} こたえを えらんで ください。|Pilihlah jawaban yang benar.
5|習|習う|ならう|belajar dari seseorang|来月から 日本語を {習う~ならう} ことに しました。|Saya memutuskan untuk mulai belajar bahasa Jepang bulan depan.
5|仕|仕事|しごと|pekerjaan|毎日、六時に {仕事~しごと}が おわります。|Setiap hari pekerjaan saya selesai pukul enam.
5|働|働く|はたらく|bekerja|来年、日本で {働こう~はたらこう}と 思って います。|Saya berniat bekerja di Jepang tahun depan.
5|勉強|勉強|べんきょう|belajar|毎朝、日本語を {勉強~べんきょう}する ことに して います。|Saya membiasakan diri belajar bahasa Jepang setiap pagi.
6|試|試す|ためす|mencoba; menguji|新しい ペンを {試して~ためして} みました。|Saya mencoba pena baru.
6|験試|試験|しけん|ujian|{試験~しけん}に ごうかくして、よかったです。|Syukurlah saya lulus ujian.
6|研究|研究|けんきゅう|penelitian|大学で 日本語の {研究~けんきゅう}を して います。|Saya melakukan penelitian bahasa Jepang di universitas.
6|集|集める|あつめる|mengumpulkan|日本の きってを {集めて~あつめて} います。|Saya mengumpulkan perangko Jepang.
6|計|時計|とけい|jam|{時計~とけい}を なくして しまいました。|Saya kehilangan jam saya.
6|真|写真|しゃしん|foto|この {写真~しゃしん}を とって みました。|Saya mencoba mengambil foto ini.
6|悪|悪い|わるい|buruk; tidak baik|きのうは てんきが {悪かった~わるかった}です。|Kemarin cuacanya buruk.
7|開|開く|あく|terbuka|まどが {開いて~あいて} います。|Jendelanya terbuka.
7|開|開ける|あける|membuka|あついですから、まどを {開けました~あけました}。|Karena panas, saya membuka jendela.
7|止|止まる|とまる|berhenti|バスが えきの 前で {止まりました~とまりました}。|Bus berhenti di depan stasiun.
7|止|止める|とめる|menghentikan; memarkir|車を ここに {止めて~とめて} ください。|Parkirkan mobil di sini.
7|動|動く|うごく|bergerak; berfungsi|この 時計は {動いて~うごいて} いません。|Jam ini tidak berjalan.
7|転|自転車|じてんしゃ|sepeda|{自転車~じてんしゃ}を へやの 外に おいて あります。|Sepeda sudah diletakkan di luar kamar.
7|起|起きる|おきる|bangun|毎朝、六時に {起きて~おきて} います。|Saya bangun pukul enam setiap pagi.
7|着|着る|きる|memakai pakaian|今日は 白い シャツを {着て~きて} います。|Hari ini saya memakai kemeja putih.
7|着|着く|つく|tiba|電車は 九時に えきに {着きます~つきます}。|Kereta tiba di stasiun pukul sembilan.
7|持|持つ|もつ|memegang; membawa|かさを {持って~もって} 行って ください。|Bawalah payung.
8|歩|歩く|あるく|berjalan kaki|えきまで {歩いて~あるいて} 行きます。|Saya pergi ke stasiun dengan berjalan kaki.
8|走|走る|はしる|berlari|子どもが きゅうに {走り~はしり}出しました。|Anak itu tiba-tiba mulai berlari.
8|通|通う|かよう|pergi secara rutin|去年から 日本語の 学校に {通って~かよって} います。|Saya bersekolah di sekolah bahasa Jepang sejak tahun lalu.
8|通|通る|とおる|melewati|毎朝、この 道を {通ります~とおります}。|Setiap pagi saya melewati jalan ini.
8|発|出発|しゅっぱつ|keberangkatan; berangkat|バスは 今、{出発~しゅっぱつ}する ところです。|Bus baru akan berangkat sekarang.
8|去|去年|きょねん|tahun lalu|{去年~きょねん}、日本へ 来ました。|Saya datang ke Jepang tahun lalu.
8|送|送る|おくる|mengirim; mengantar|今、メールを {送った~おくった} ところです。|Saya baru saja mengirim surel.
8|運|運ぶ|はこぶ|membawa; memindahkan barang|にもつを へやへ {運んで~はこんで} います。|Saya sedang membawa barang ke kamar.
8|急|急ぐ|いそぐ|bergegas|電車が 来ます。{急いで~いそいで} ください。|Keretanya datang. Tolong bergegas.
9|方|読み方|よみかた|cara membaca|この 字の {読み方~よみかた}を 教えて ください。|Tolong ajari cara membaca huruf ini.
9|軽|軽い|かるい|ringan|この かばんは {軽くて~かるくて}、もちやすいです。|Tas ini ringan dan mudah dibawa.
9|重|重い|おもい|berat|この かばんは {重すぎます~おもすぎます}。|Tas ini terlalu berat.
9|短|短い|みじかい|pendek|かみを {短く~みじかく} しました。|Saya memendekkan rambut.
9|低|低い|ひくい|rendah|この テーブルは {低すぎます~ひくすぎます}。|Meja ini terlalu rendah.
9|太|太い|ふとい|tebal; besar diameter|{太い~ふとい} ペンで 字を かきました。|Saya menulis dengan pena yang tebal.
9|広|広い|ひろい|luas|この へやは {広くて~ひろくて}、つかいやすいです。|Kamar ini luas dan mudah digunakan.
9|暗|暗い|くらい|gelap|{暗い~くらい} へやでは 本が 読みにくいです。|Di kamar gelap, buku sulit dibaca.
10|不|不便|ふべん|tidak praktis; tidak nyaman|この 町は バスが 少なくて、{不便~ふべん}です。|Bus di kota ini sedikit sehingga kurang praktis.
10|別|別|べつ|lain; berbeda|この 本は むずかしいので、{別~べつ}の 本を 読みます。|Karena buku ini sulit, saya akan membaca buku lain.
10|合|合う|あう|cocok; pas|この くつは 足に {合って~あって} います。|Sepatu ini pas di kaki saya.
10|同|同じ|おなじ|sama|友だちと {同じ~おなじ} 本を 読んで います。|Saya sedang membaca buku yang sama dengan teman.
10|有|有名|ゆうめい|terkenal|この 店は {有名~ゆうめい}なのに、人が 少ないです。|Walaupun toko ini terkenal, pengunjungnya sedikit.
10|特|特に|とくに|terutama; khususnya|日本の りょうりでは、すしが {特に~とくに} 好きです。|Di antara masakan Jepang, saya terutama menyukai sushi.
10|明|明るい|あかるい|terang|この へやは {明るい~あかるい}し、広いし、べんりです。|Kamar ini terang, luas, dan praktis.
11|図|地図|ちず|peta|この {地図~ちず}は べんりそうです。|Peta ini tampaknya praktis.
11|写|写真|しゃしん|foto|この {写真~しゃしん}は 日本で とった そうです。|Katanya foto ini diambil di Jepang.
11|映画|映画|えいが|film|この {映画~えいが}は おもしろいらしいです。|Kabarnya film ini menarik.
11|色|色|いろ|warna|この {色~いろ}は あの 人に にあうと 思います。|Menurut saya warna ini cocok untuk orang itu.
11|赤|赤い|あかい|merah|あの {赤い~あかい} かばんは 先生の はずです。|Tas merah itu seharusnya milik guru.
11|青|青い|あおい|biru|今日は 空が {青い~あおい}です。|Hari ini langitnya biru.
11|黒|黒い|くろい|hitam|{黒い~くろい} 車が 店の 前に とまって います。|Mobil hitam terparkir di depan toko.
12|好|好き|すき|suka|弟は この おかしが {好き~すき}みたいです。|Adik laki-laki saya tampaknya suka kudapan ini.
12|近|近い|ちかい|dekat|家は 学校に {近い~ちかい}です。|Rumah saya dekat sekolah.
12|遠|遠い|とおい|jauh|えきは ここから {遠い~とおい}ですか。|Apakah stasiunnya jauh dari sini?
12|便|便利|べんり|praktis; mudah digunakan|この かばんは {便利~べんり}そうです。|Tas ini tampaknya praktis.
12|寒|寒い|さむい|dingin (cuaca)|子どもは {寒がって~さむがって} います。|Anak itu menunjukkan bahwa ia kedinginan.
12|暑|暑い|あつい|panas (cuaca)|今日は 夏の ように {暑い~あつい}です。|Hari ini panas seperti musim panas.
12|風|風|かぜ|angin|{風~かぜ}が 強く なって きました。|Angin mulai bertambah kencang.
12|顔|顔|かお|wajah|あの 子は うれしそうな {顔~かお}を して います。|Anak itu tampak memasang wajah gembira.
13|場|場所|ばしょ|tempat|{場所~ばしょ}が わからなかったら、電話して ください。|Jika tidak tahu tempatnya, tolong telepon.
13|所|近所|きんじょ|lingkungan sekitar; tetangga|{近所~きんじょ}に 新しい 店が できました。|Ada toko baru di lingkungan sekitar.
13|地|地図|ちず|peta|{地図~ちず}を 見ると、えきの 場所が わかります。|Dengan melihat peta, kita tahu letak stasiunnya.
13|市|市|し|kota (wilayah administrasi)|この {市~し}には 大きい こうえんが あります。|Di kota ini ada taman besar.
13|町|町|まち|kota; kawasan kota|この {町~まち}に 来たら、あの 店へ 行って みて ください。|Jika datang ke kota ini, cobalah pergi ke toko itu.
13|村|村|むら|desa|この {村~むら}は しずかで、きれいです。|Desa ini tenang dan indah.
13|区|区|く|distrik kota|この {区~く}には 図書館が 二つ あります。|Di distrik ini ada dua perpustakaan.
13|都|都合|つごう|keadaan yang memengaruhi ketersediaan waktu|あしたは {都合~つごう}が いいですか。|Apakah besok waktunya cocok untukmu?
14|世界|世界|せかい|dunia|{世界~せかい}の いろいろな 国へ 行きたいです。|Saya ingin mengunjungi berbagai negara di dunia.
14|元|元気|げんき|sehat; bersemangat|{元気~げんき}なら、いっしょに さんぽしませんか。|Kalau sedang sehat, mau berjalan-jalan bersama?
14|代|時代|じだい|zaman; era|これは 古い {時代~じだい}の しゃしんです。|Ini foto dari zaman dahulu.
14|京|東京|とうきょう|Tokyo|{東京~とうきょう}へ 行くなら、電車が べんりです。|Kalau pergi ke Tokyo, kereta praktis.
14|県|県|けん|prefektur|この {県~けん}には 山が たくさん あります。|Di prefektur ini ada banyak gunung.
14|銀|銀行|ぎんこう|bank|{銀行~ぎんこう}へ 行くなら、あの バスに のって ください。|Kalau hendak ke bank, naiklah bus itu.
15|教|教える|おしえる|mengajar; memberi tahu|道を {教える~おしえる} ために、地図を かきました。|Saya menggambar peta untuk menunjukkan jalan.
15|注|注意|ちゅうい|perhatian; kehati-hatian|車に {注意~ちゅうい}して ください。|Berhati-hatilah terhadap mobil.
15|料|料理|りょうり|masakan; memasak|{料理~りょうり}を 作る ために、やさいを かいました。|Saya membeli sayuran untuk memasak.
15|室|教室|きょうしつ|ruang kelas|{教室~きょうしつ}で 日本語を 勉強して います。|Saya belajar bahasa Jepang di ruang kelas.
15|屋|本屋|ほんや|toko buku|日本語の 本を かいに、{本屋~ほんや}へ 行きました。|Saya pergi ke toko buku untuk membeli buku bahasa Jepang.
15|館|図書館|としょかん|perpustakaan|{図書館~としょかん}は 本を 読むのに いい 場所です。|Perpustakaan adalah tempat yang bagus untuk membaca buku.
15|院|病院|びょういん|rumah sakit|友だちに 会いに、{病院~びょういん}へ 行きます。|Saya pergi ke rumah sakit untuk menemui teman.
15|堂|食堂|しょくどう|kantin; ruang makan|昼ごはんを 食べに、{食堂~しょくどう}へ 行きます。|Saya pergi ke kantin untuk makan siang.
16|切|切る|きる|memotong|この かみを 半分に {切って~きって} ください。|Potonglah kertas ini menjadi dua bagian.
16|売|売る|うる|menjual|あの 店では パンを {売って~うって} います。|Toko itu menjual roti.
16|使|使う|つかう|menggunakan|この はさみを {使った~つかった} ほうが いいです。|Sebaiknya gunakan gunting ini.
16|引|引く|ひく|menarik|この ドアは {引いて~ひいて} ください。|Tariklah pintu ini.
16|建|建てる|たてる|membangun|父は 去年、家を {建てました~たてました}。|Ayah saya membangun rumah tahun lalu.
16|台|台|だい|penghitung kendaraan/mesin|車が 三{台~だい} あります。|Ada tiga mobil.
16|工|工場|こうじょう|pabrik|兄は {工場~こうじょう}で はたらいて います。|Kakak laki-laki saya bekerja di pabrik.
16|洗|洗う|あらう|mencuci|ごはんの 前に、手を {洗わない~あらわない}と いけません。|Sebelum makan, kita harus mencuci tangan.
17|私|私|わたし|saya|これは 友だちが {私~わたし}に くれた 本です。|Ini buku yang diberikan teman kepada saya.
17|兄|兄|あに|kakak laki-laki sendiri|{兄~あに}に 本を あげました。|Saya memberikan buku kepada kakak laki-laki saya.
17|弟|弟|おとうと|adik laki-laki sendiri|{弟~おとうと}は 母に 時計を もらいました。|Adik laki-laki saya menerima jam dari ibu.
17|姉|姉|あね|kakak perempuan sendiri|{姉~あね}が 私に かばんを くれました。|Kakak perempuan saya memberikan tas kepada saya.
17|妹|妹|いもうと|adik perempuan sendiri|私は {妹~いもうと}に ペンを あげました。|Saya memberikan pena kepada adik perempuan saya.
17|親|親|おや|orang tua|{親~おや}に プレゼントを あげました。|Saya memberikan hadiah kepada orang tua.
17|族|家族|かぞく|keluarga|{家族~かぞく}から プレゼントを もらいました。|Saya menerima hadiah dari keluarga.
18|貸|貸す|かす|meminjamkan|友だちに 本を {貸して~かして} あげました。|Saya meminjamkan buku kepada teman.
18|借|借りる|かりる|meminjam|図書館で 本を {借りました~かりました}。|Saya meminjam buku di perpustakaan.
18|茶|お茶|おちゃ|teh|母が {お茶~おちゃ}を 入れて くれました。|Ibu membuatkan teh untuk saya.
18|飯|ご飯|ごはん|nasi; makanan|友だちが {ご飯~ごはん}を 作って くれました。|Teman memasakkan makanan untuk saya.
18|肉|肉|にく|daging|{肉~にく}を 小さく 切って もらえませんか。|Bisakah tolong potong dagingnya kecil-kecil?
18|牛|牛肉|ぎゅうにく|daging sapi|今日は {牛肉~ぎゅうにく}を かいました。|Hari ini saya membeli daging sapi.
18|菜|野菜|やさい|sayuran|{野菜~やさい}を 洗って くれて、ありがとう。|Terima kasih sudah mencucikan sayuran.
18|服|服|ふく|pakaian|姉が {服~ふく}を えらんで くれました。|Kakak perempuan saya membantu memilihkan pakaian.
19|員|店員|てんいん|pegawai toko|{店員~てんいん}に、何時に 店が しまるか 聞きました。|Saya bertanya kepada pegawai toko jam berapa tokonya tutup.
19|住|住む|すむ|tinggal|田中さんが どこに {住んで~すんで} いるか 知って いますか。|Apakah kamu tahu di mana Tanaka tinggal?
19|田|田んぼ|たんぼ|sawah|家の 近くに {田んぼ~たんぼ}が あります。|Ada sawah di dekat rumah saya.
19|海|海|うみ|laut|この 町には 山だけでなく、{海~うみ}も あります。|Kota ini memiliki laut selain gunung.
19|池|池|いけ|kolam|こうえんに {池~いけ}が 一つ あります。|Ada sebuah kolam di taman.
19|鳥|鳥|とり|burung|{鳥~とり}が 何わ いるか わかりません。|Saya tidak tahu ada berapa ekor burung.
19|犬|犬|いぬ|anjing|うちには {犬~いぬ}が 一ぴきだけ います。|Di rumah saya hanya ada seekor anjing.
19|門|門|もん|gerbang|学校の {門~もん}が 何時に あくか、先生に 聞きます。|Saya akan bertanya kepada guru jam berapa gerbang sekolah dibuka.
20|以|以上|いじょう|atau lebih; minimal|この へやには 十人{以上~いじょう} 入れます。|Kamar ini dapat menampung sepuluh orang atau lebih.
20|以|以下|いか|atau kurang; maksimal|この かばんは 五キロ{以下~いか}です。|Berat tas ini lima kilogram atau kurang.
20|回|回|かい|kali|一週間に 三{回~かい} さんぽします。|Saya berjalan-jalan tiga kali seminggu.
20|度|度|ど|derajat; kali|へやの おんどは 二十{度~ど}です。|Suhu kamar dua puluh derajat.
20|野|野菜|やさい|sayuran|{野菜~やさい}を 毎日 食べる ように して います。|Saya berusaha makan sayuran setiap hari.
20|産|お土産|おみやげ|oleh-oleh|これは 京都の {お土産~おみやげ}です。|Ini oleh-oleh dari Kyoto.
20|首|首|くび|leher|{首~くび}が いたいので、少し 休みます。|Karena leher saya sakit, saya beristirahat sebentar.
20|業|授業|じゅぎょう|pelajaran; kelas|{授業~じゅぎょう}は 九時から 十時までです。|Pelajarannya berlangsung dari pukul sembilan sampai sepuluh.
21|病|病気|びょうき|sakit; penyakit|弟は {病気~びょうき}で 学校を 休んで います。|Adik laki-laki saya tidak masuk sekolah karena sakit.
21|薬|薬|くすり|obat|この {薬~くすり}は 日本で 作られて います。|Obat ini dibuat di Jepang.
21|医|医者|いしゃ|dokter|{医者~いしゃ}に 名前を 聞かれました。|Dokter menanyakan nama saya.
21|死|死ぬ|しぬ|mati; meninggal|大切な 犬が {死んで~しんで} しまいました。|Anjing kesayangan saya mati.
21|家|家|いえ|rumah|この {家~いえ}は 十年前に 建てられました。|Rumah ini dibangun sepuluh tahun lalu.
21|光|光|ひかり|cahaya|まどから {光~ひかり}が 入って います。|Cahaya masuk melalui jendela.
22|進|進む|すすむ|maju; berlanjut|車は ゆっくり {進んで~すすんで} います。|Mobil bergerak maju perlahan.
22|始|始める|はじめる|memulai|先生は 学生に 勉強を {始めさせました~はじめさせました}。|Guru menyuruh siswa mulai belajar.
22|終|終わる|おわる|selesai|しごとが {終わって~おわって}から、家へ かえります。|Saya pulang setelah pekerjaan selesai.
22|待|待つ|まつ|menunggu|えきで 一時間 {待たされました~またされました}。|Saya dibuat menunggu satu jam di stasiun.
22|旅|旅行|りょこう|perjalanan wisata|母は 私を 一人で {旅行~りょこう}に 行かせて くれました。|Ibu mengizinkan saya pergi berwisata sendiri.
22|歌|歌う|うたう|bernyanyi|学生は 先生に {歌わされました~うたわされました}。|Siswa disuruh bernyanyi oleh guru.
22|森|森|もり|hutan|この {森~もり}には 鳥が たくさん います。|Di hutan ini ada banyak burung.
23|英|英語|えいご|bahasa Inggris|先生は {英語~えいご}を お話しに なります。|Guru berbicara bahasa Inggris. (Hormat.)
23|洋|洋服|ようふく|pakaian gaya Barat|先生は すてきな {洋服~ようふく}を 着て いらっしゃいます。|Guru mengenakan pakaian yang bagus. (Hormat.)
23|秋|秋|あき|musim gugur|先生は {秋~あき}に 日本へ いらっしゃいます。|Guru akan pergi ke Jepang pada musim gugur. (Hormat.)
23|林|林|はやし|hutan kecil; rumpun pepohonan|あの {林~はやし}を ごらんに なりましたか。|Apakah Anda sudah melihat hutan kecil itu? (Hormat.)
23|夏|夏|なつ|musim panas|{夏~なつ}は どちらへ いらっしゃいますか。|Pada musim panas, Anda akan pergi ke mana? (Hormat.)
23|冬|冬|ふゆ|musim dingin|先生は {冬~ふゆ}に スキーを なさいます。|Guru bermain ski pada musim dingin. (Hormat.)
23|春|春|はる|musim semi|先生は {春~はる}に 日本から お帰りに なります。|Guru akan pulang dari Jepang pada musim semi. (Hormat.)
23|乗|乗る|のる|naik kendaraan|先生は バスに お{乗り~のり}に なります。|Guru akan naik bus. (Hormat.)
24|漢|漢字|かんじ|kanji|先生に {漢字~かんじ}を 教えて いただきました。|Saya mendapat pengajaran kanji dari guru. (Merendah.)
24|紙|紙|かみ|kertas|こちらの {紙~かみ}に お名前を お書き ください。|Silakan tuliskan nama Anda di kertas ini. (Hormat.)
24|質|質問|しつもん|pertanyaan|{質問~しつもん}に 答えて いただき、ありがとうございます。|Terima kasih telah menjawab pertanyaan saya. (Sopan.)
24|理|理由|りゆう|alasan|{理由~りゆう}を ごせつめい いたします。|Saya akan menjelaskan alasannya. (Merendah.)
`.trim().split('\n').map(line => {
  const [bab, characters, japanese, reading, indonesian, sentence, exampleIndonesian] = line.split('|');
  const commonReadings = {人:'ひと',本:'ほん',大:'おお',日本語:'にほんご',日本:'にほん',先生:'せんせい',聞:'き',思:'おも',三:'みっ',学校:'がっこう',行:'い',食:'た',何時:'なんじ',来年:'らいねん',来月:'らいげつ',毎朝:'まいあさ',毎日:'まいにち',会社:'かいしゃ',六時:'ろくじ',大学:'だいがく',新:'あたら',子:'こ',車:'くるま',電車:'でんしゃ',九時:'くじ',去年:'きょねん',今:'いま',来:'き',少:'すこ',足:'あし',友:'とも',店:'みせ',読:'よ',白:'しろ',今日:'きょう',外:'そと',道:'みち',出:'だ',何:'なん',手:'て',二:'ふた',字:'じ',母:'はは',弟:'おとうと',家:'いえ',強:'つよ',夏:'なつ',場:'ば',電話:'でんわ',図書館:'としょかん',山:'やま',京都:'きょうと',東京:'とうきょう',入:'はい',五:'ご',十人:'じゅうにん',一週間:'いっしゅうかん',三回:'さんかい',二十:'にじゅう',十年前:'じゅうねんまえ',一時間:'いちじかん',一人:'ひとり',一:'いっ',時:'じ',間:'あいだ',前:'まえ',兄:'あに',姉:'あね',私:'わたし',町:'まち',名:'な',分:'ぶん',国:'くに',足:'あし',答:'こた',教:'おし',会:'あ',父:'ちち',切:'き',牛:'うし',田中:'たなか',知:'し',海:'うみ',門:'もん',休:'やす',建:'た',待:'ま',鳥:'とり',勉強:'べんきょう',始:'はじ',帰:'かえ',終:'お',歌:'うた',話:'はな',乗:'の',着:'き',秋:'あき',春:'はる',冬:'ふゆ',英語:'えいご',漢字:'かんじ',書:'か',聞:'き',近:'ちか',広:'ひろ',中:'なか',正:'ただ',色:'いろ',使:'つか',不便:'ふべん',別:'べつ',黒:'くろ',赤:'あか',青:'あお',有名:'ゆうめい',元気:'げんき',世:'よ',池:'いけ',首:'くび',力:'ちから',大切:'たいせつ',半分:'はんぶん',日:'にち',学:'がく',生:'せい',十時:'じゅうじ',昼:'ひる',気:'き'};
  // Target annotations take precedence; common readings are longest-first.
  const tokens=[];
  let exampleReading=sentence.replace(/\{([^{}~]+)~([^{}]+)\}/gu,(_,word,kana)=>{tokens.push(kana);return `\u0001${tokens.length-1}\u0001`;});
  Object.assign(commonReadings, {時間:'じかん',時計:'とけい',場所:'ばしょ',地図:'ちず',少ない:'すくない',少なく:'すくなく',少し:'すこし',三つ:'みっつ',三:'さん',一つ:'ひとつ',一ぴき:'いっぴき',一:'いち',入れ:'いれ',出ます:'でます',作:'つく',好き:'すき',空:'そら',見:'み',古:'ふる',小:'ちい',洗:'あら',犬:'いぬ'});
  for (const [word,kana] of Object.entries(commonReadings).sort((a,b)=>b[0].length-a[0].length)) exampleReading=exampleReading.replaceAll(word,kana);
  exampleReading=exampleReading.replace(/\u0001(\d+)\u0001/g,(_,index)=>tokens[Number(index)]);
  return {chapter:Number(bab),characters,japanese,reading,indonesian,exampleJapanese:sentence.replace(/\{([^{}~]+)~[^{}]+\}/gu,'$1'),exampleReading,exampleIndonesian};
});

const notes={
  弱:'でんぱ berarti sinyal atau gelombang radio; でんぱが弱い berarti sinyalnya lemah.',
  験:'ごうかくする berarti lulus ujian. Contoh memakai 試験にごうかくする.',
  強:'強い（つよい） berarti kuat. Arti belajar muncul pada kata utuh 勉強（べんきょう）, yang dipelajari sebagai gabungan.',
  試:'Dua bacaan kata yang berbeda: 試す（ためす） = mencoba/menguji; 試みる（こころみる） = mencoba suatu tindakan. Latihan bab ini memakai 試す. ごうかくする pada contoh 試験 berarti lulus ujian.',
  着:'着る（きる） = memakai pakaian; 着く（つく） = tiba. Hafalkan bacaan bersama kata dan konteksnya.',
  通:'通る（とおる） = melewati; 通う（かよう） = pergi secara rutin, misalnya ke sekolah.',
  止:'Latihan inti memakai 止まる（とまる） dan 止める（とめる）. Bacaan やむ terdapat pada kata 止む, misalnya hujan berhenti, dan tidak menjadi target kartu ini.',
  世:'世界 dibaca せかい. 世 juga dibaca よ, misalnya 世の中（よのなか） = dunia/masyarakat.',
  銀:'Arti dasar 銀 adalah perak. Bank adalah arti kata utuh 銀行（ぎんこう）.',
  野:'Arti dasar 野 berkaitan dengan lapangan atau alam liar. Sayuran adalah arti kata utuh 野菜（やさい）.',
  風:'Pada kartu ini, 風（かぜ） berarti angin. 風邪（かぜ） berarti pilek/common cold; influenza disebut インフルエンザ. Makna penyakit juga muncul dalam gabungan tertentu.',
  以:'Pada batas angka, 以上 mencakup batas bawah dan 以下 mencakup batas atas. 十以上 berarti 10 atau lebih; 十以下 berarti 10 atau kurang.',
  映:'Makna gambar/proyeksi tampak pada 映画（えいが） = film. Fokus latihan bacaan adalah kata utuh 映画.',
  主:'主人（しゅじん） pada contoh berarti suami sendiri. 夫（おっと） juga lazim dipakai untuk suami sendiri; pilihan kata mengikuti konteks.',
};

export function n4ChapterKanjiSupport(character,chapter) {
  return rows.filter(row=>row.chapter===chapter&&row.characters.includes(character)).map(({chapter:_,characters:__,...row})=>({...row,
    studyNote:notes[character]||'', practiceEligible:true,
  }));
}
export const n4KanjiSupportInventory=rows;
