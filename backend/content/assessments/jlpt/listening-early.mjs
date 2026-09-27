import {q,listen,spoken} from './helpers.mjs';
export default {
4:[
listen('N: ほんは なにごの ほんですか。\nA: これは えいごの ほんですか。\nB: いいえ、にほんごの ほんです。\nN: ほんは なにごの ほんですか。',q('Buku dalam percakapan berbahasa apa?',['にほんご','えいご','インドネシアご','ちゅうごくご'],'B mengoreksi dugaan bahasa Inggris menjadi Jepang.',2)),
listen('N: かばんは ハディさんのですか。\nA: その かばんは ハディさんのですか。\nB: いいえ、アンナさんのです。\nN: かばんは ハディさんのですか。',q('Informasi mana yang benar?',['アンナさんの かばんです。','ハディさんの かばんです。','せんせいの かばんです。','アンナさんの ほんです。'],'Tas milik Anna, bukan Hadi.',2)),
spoken('N: これは にほんごの ほんです。\nB: えいごの ほんですか。\nN: Aさんは なんと いいますか。',['いいえ、にほんごの ほんです。','はい、えいごの ほんです。','いいえ、かばんです。'],'Tokoh A perlu mengoreksi dugaan bahasa Inggris.',3,true),
spoken('A: はじめまして。ハディです。',['はじめまして。アンナです。','いいえ、ちがいます。','にほんごの ほんです。'],'Respons perkenalan yang sesuai adalah membalas perkenalan.',3)],
5:[
listen('N: クラスは なんじからですか。\nA: クラスは くじからですか。\nB: いいえ、じゅうじからです。じゅうにじまでです。\nN: クラスは なんじからですか。',q('Kelas mulai pukul berapa?',['10:00','9:00','12:00','11:00'],'Mulai pukul sepuluh; dua belas adalah selesai.',2)),
listen('N: ほんは いくらですか。\nA: この ほんは ごひゃくえんですか。\nB: いいえ、ろっぴゃくえんです。ノートは にひゃくえんです。\nN: ほんは いくらですか。',q('Berapa harga buku?',['600えん','500えん','200えん','800えん'],'Buku 600 yen; catatan 200 yen.',1)),
spoken('N: Aさんは じゅうはっさいです。\nB: おいくつですか。\nN: Aさんは なんと いいますか。',['じゅうはっさいです。','じゅうはちじです。','じゅうはちえんです。'],'Pertanyaan umur dijawab dengan さい.',3,true),
spoken('A: この ペンは いくらですか。',['ひゃくえんです。','くじです。','じゅうはっさいです。'],'いくら meminta harga.',1)],
6:[
listen('N: きょうは どうですか。\nA: きのうは あつかったですね。\nB: はい。きょうは あつくないです。\nN: きょうは どうですか。',q('きょうは どうですか。',['あつくないです。','あつかったです。','とても あついです。','さむかったです。'],'Hari ini tidak panas; jangan tertukar dengan kemarin.',1)),
listen('N: あの かばんは どうですか。\nA: この かばんは やすいですね。\nB: はい。あの かばんは とても たかいです。\nN: あの かばんは どうですか。',q('あの かばんは どうですか。',['とても たかいです。','とても やすいです。','ふるいです。','ちいさいです。'],'Tas yang ditunjuk あの mahal.',3)),
spoken('N: Aさんの りょうりは とても おいしいです。\nB: りょうりは どうですか。\nN: Aさんは なんと いいますか。',['とても おいしいです。','とても いそがしいです。','とても さむいです。'],'Penilaian harus sesuai makanan dan informasi audio.',3,true),
spoken('A: この ほんは どうですか。',['おもしろいです。','じゅうはっさいです。','ごぜん くじです。'],'どうですか meminta kesan buku.',3)],
7:[
listen('N: ハディさんは なにが じょうずですか。\nA: ハディさんは えいごが じょうずですか。\nB: えいごは あまり じょうずじゃありません。にほんごが じょうずです。\nN: ハディさんは なにが じょうずですか。',q('ハディさんは なにが じょうずですか。',['にほんご','えいご','りょうり','テニス'],'Kemahiran yang dinyatakan adalah bahasa Jepang.',3)),
listen('N: まちは どうですか。\nA: この まちは しずかですか。\nB: はい。しずかで、きれいです。\nN: まちは どうですか。',q('まちは どうですか。',['しずかで、きれいです。','にぎやかで、きれいです。','しずかで、ふべんです。','にぎやかで、ふべんです。'],'Dua sifat yang terdengar ialah tenang dan bersih.',2)),
spoken('N: Aさんは きのう ひまでした。\nB: きのうは ひまでしたか。\nN: Aさんは なんと いいますか。',['はい、ひまでした。','いいえ、ひまじゃありませんでした。','はい、ひまな まちです。'],'Jawaban afirmatif lampau sesuai keadaan kemarin.',1,true),
spoken('A: にほんごが すきですか。',['はい、すきです。','はい、にぎやかです。','はい、しずかです。'],'Pertanyaan kesukaan dijawab dengan 好き.',3)],
8:[
listen('N: ほんは どこですか。\nA: ほんは つくえの うえですか。\nB: いいえ、かばんの なかです。かばんは つくえの したです。\nN: ほんは どこですか。',q('ほんは どこですか。',['かばんの なか','つくえの うえ','かばんの うえ','つくえの そと'],'Buku berada di dalam tas; tasnya di bawah meja.',2)),
listen('N: ねこは どこに いますか。\nA: ねこは へやの なかですか。\nB: いいえ、へやの そとに います。いぬは へやの なかです。\nN: ねこは どこに いますか。',q('ねこは どこに いますか。',['へやの そと','へやの なか','つくえの うえ','はこの なか'],'Kucing di luar; anjing di dalam.',1)),
spoken('N: ぎんこうは がっこうの となりです。\nB: ぎんこうは どこですか。\nN: Aさんは なんと いいますか。',['がっこうの となりです。','がっこうの なかです。','がっこうの うしろです。'],'Lokasi bank di sebelah sekolah.',3,true),
spoken('A: トイレは どちらですか。',['あちらです。','ごひゃくえんです。','ごぜん くじです。'],'どちら meminta arah/lokasi.',3)],
9:[
listen('N: Aさんは なにで がっこうへ いきますか。\nA: がっこうへ バスで いきますか。\nB: いいえ、でんしゃで いきます。\nA: わたしも いっしょに いきます。\nN: Aさんは なにで がっこうへ いきますか。',q('Aさんは なにで いきますか。',['でんしゃ','バス','くるま','じてんしゃ'],'A mengikuti B yang menggunakan kereta.',2)),
listen('N: Bさんは いつ いきますか。\nA: きょう にほんへ いきますか。\nB: いいえ、あしたの ごぜん くじに いきます。\nN: Bさんは いつ いきますか。',q('Bさんは いつ いきますか。',['あした ごぜん９じ','きょう ごぜん９じ','あした ごご９じ','きょう ごご９じ'],'Audio menyebut besok pukul sembilan pagi.',3)),
spoken('N: Aさんは あした にほんへ いきます。\nB: いつ にほんへ いきますか。\nN: Aさんは なんと いいますか。',['あした いきます。','ともだちと いきます。','ひこうきで いきます。'],'いつ meminta waktu; dua pilihan lain sarana dan teman.',3,true),
spoken('A: だれと いきますか。',['ともだちと いきます。','バスで いきます。','くじに いきます。'],'だれと meminta teman perjalanan.',2)],
10:[
listen('N: Aさんは どこで べんきょうしますか。\nA: きょうは としょかんで べんきょうしますか。\nB: としょかんは やすみです。わたしの うちで べんきょうします。\nA: はい、いっしょに べんきょうします。\nN: Aさんは どこで べんきょうしますか。',q('Aさんは どこで べんきょうしますか。',['Bさんの うち','としょかん','がっこう','みせ'],'Perpustakaan libur; A setuju belajar di rumah B.',2)),
listen('N: Bさんは まいあさ なにを のみますか。\nA: まいあさ コーヒーを のみますか。\nB: いいえ、おちゃを のみます。コーヒーは ぜんぜん のみません。\nN: Bさんは まいあさ なにを のみますか。',q('Bさんは まいあさ なにを のみますか。',['おちゃ','コーヒー','みず','ジュース'],'B setiap pagi minum teh, tidak minum kopi.',3)),
spoken('N: Aさんは きのう としょかんで ほんを よみました。\nB: きのう なにを しましたか。\nN: Aさんは なんと いいますか。',['ほんを よみました。','ほんを よみませんでした。','あした ほんを よみます。'],'Kegiatan kemarin adalah membaca buku.',1,true),
spoken('A: どこで ひるごはんを たべますか。',['がっこうで たべます。','パンを たべます。','じゅうにじに たべます。'],'どこで meminta tempat, bukan makanan atau jam.',2)],
11:[
listen('N: Aさんは えんぴつを なんぼん かいますか。\nA: えんぴつは さんぼんですか。\nB: いいえ、にほんです。ノートは さんさつです。\nA: はい。えんぴつ にほんと ノート さんさつですね。\nN: Aさんは えんぴつを なんぼん かいますか。',q('えんぴつを なんぼん かいますか。',['２ほん','３ぼん','１ぽん','４ほん'],'Yang tiga adalah buku catatan; pensil dua.',1)),
listen('N: へやに ひとは なんにん いますか。\nA: へやに がくせいが さんにん います。せんせいも ひとり います。\nN: へやに ひとは なんにん いますか。',q('へやに ひとは ぜんぶで なんにん いますか。',['よにん','さんにん','ふたり','ごにん'],'Tiga siswa ditambah satu guru adalah empat orang.',2)),
spoken('N: Aさんの かばんに ほんが さんさつ あります。\nB: ほんは なんさつ ありますか。\nN: Aさんは なんと いいますか。',['さんさつ あります。','さんにん います。','さんだい あります。'],'Buku memakai さつ, bukan orang atau kendaraan.',3,true),
spoken('A: りんごは いくつ ありますか。',['いつつ あります。','ごにん います。','ごじです。'],'いくつ meminta jumlah benda, cocok dengan いつつ.',3)]
};
