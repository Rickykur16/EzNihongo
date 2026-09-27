import {q,star,passage} from './helpers.mjs';
export default {
4:[
q('Anda memegang buku. Lawan bicara jauh dari buku.（　）は ほんです。',['これ','それ','あれ','どの'],'これ menunjuk benda dekat pembicara.'),
q('Lawan bicara memegang payung, jauh dari Anda.（　）は かさです。',['それ','これ','あれ','この'],'それ menunjuk benda dekat lawan bicara.'),
q('Tas jauh dari Anda dan lawan bicara.（　）かばんです。',['あの','この','その','あれ'],'あの harus diikuti kata benda.'),
q('A「にほんご（　）ほんですか。」B「はい、そうです。」',['の','は','も','か'],'の menghubungkan bahasa dengan jenis buku.',2),
q('A「これは ペンですか。」B「はい、（　）。」',['そうです','ちがいます','ほんです','はじめまして'],'Konfirmasi afirmatif memakai そうです.',3),
q('A「これは じしょですか。」B「いいえ、（　）。ノートです。」',['ちがいます','そうです','じしょです','こんにちは'],'B mengoreksi dugaan kamus menjadi buku catatan.',3),
star('これは',['アンナさん','の','にほんごの','ほん'],'です。',2,3),
star('',['この','かばん','は','わたしの'],'です。',1),
...passage('アンナです。これは わたしの かばんです。これは ハディさんの ほんです。あれ（①）ハディさんの かさです。これは にほんご（②）ほんです。',[
q('① に なにを いれますか。',['も','か','の','じゃ'],'Payung juga milik Hadi, sehingga memakai も.',2),
q('② に なにを いれますか。',['の','も','か','は'],'の menyatakan jenis buku.',2)])],
5:[
q('A「この かばんは（　）ですか。」B「せんえんです。」',['いくら','なんじ','なんさい','どの'],'えん menunjukkan bahwa pertanyaan meminta harga.'),
q('A「いま（　）ですか。」B「くじです。」',['なんじ','いくら','なんさい','どの'],'くじ menjawab pertanyaan jam.',2),
q('A「おいくつですか。」B「じゅうはち（　）です。」',['さい','じ','えん','ふん'],'Umur menggunakan さい.',3),
q('Kelas pukul 09.00–12.00. クラスは くじ（　）じゅうにじまでです。',['から','まで','の','も'],'から menandai awal rentang.',2),
q('Toko buka pukul 10.00–18.00. じゅうじから ごご ろくじ（　）です。',['まで','から','の','か'],'まで menandai akhir rentang.',2),
q('Usia B sebenarnya 18 tahun. A「じゅうきゅうさいですか。」B「いいえ、じゅうはっさい（　）。」',['です','ですか','じゃありません','じゃないです'],'B menyatakan umur sebenarnya dengan です.',3),
star('クラスは',['くじ','から','じゅうにじ','まで'],'です。',2),
star('A「',['この','ほん','は','いくら'],'ですか。」B「ごひゃくえんです。」',1),
...passage('アンナは じゅうはっさいです。ハディも じゅうはっさいです。アンナと ハディは おなじ（①）です。クラスは ごぜん くじから ごご いちじ（②）です。',[
q('① に なにを いれますか。',['とし','ねだん','じかん','ほん'],'Keduanya sama-sama 18 tahun; yang sama adalah umur.',3),
q('② に なにを いれますか。',['まで','から','の','も'],'Jam satu adalah akhir rentang.',2)])],
6:[
q('A「この かばんは たかいですか。」B「いいえ、あまり（　）。」',['たかくないです','たかいです','たかいなです','たかいでした'],'あまり dipasangkan dengan bentuk negatif.'),
q('A「きのうは あつかったですか。」B「はい、（　）。」',['あつかったです','あついです','あつくないです','あつくなかったです'],'Jawaban mengafirmasi keadaan kemarin.'),
q('A「きのうの りょうりは おいしかったですか。」B「いいえ、（　）。」',['おいしくなかったです','おいしいです','おいしかったです','おいしいでした'],'Kemarin dan いいえ memerlukan negatif lampau.'),
q('これは（　）ほんです。',['あたらしい','あたらしく','あたらしいな','あたらしいです'],'Kata sifat い langsung menerangkan kata benda.',2),
q('この りょうりは（　）おいしいです。',['とても','あまり','なんさい','どの'],'とても cocok dengan afirmasi おいしい.',2),
q('A「この ほんは（　）ですか。」B「おもしろいです。」',['どう','なんさい','いくら','なんじ'],'Jawaban penilaian sesuai dengan どうですか.',3),
star('これは',['とても','おいしい','にほんの','りょうり'],'です。',2,3),
star('A「この かばんは',['あまり','たかく','ない','です'],'か。」B「はい、やすいです。」',1),
...passage('きのうは あつかったです。いまは あつく（①）です。きのうの りょうりは おいしかったです。きょうの りょうり（②）おいしいです。',[
q('① に なにを いれますか。',['ない','なかった','かった','い'],'いま membatasi keadaan saat ini, sehingga memakai あつくないです.'),
q('② に なにを いれますか。',['も','か','の','で'],'Kedua makanan sama-sama enak; も menyatakan juga.',3)])],
7:[
q('この まちは（　）です。',['しずか','しずかな','しずかい','しずかく'],'Predikat kata sifat な diikuti です tanpa な.'),
q('ここは（　）まちです。',['しずかな','しずか','しずかい','しずかです'],'Sebelum kata benda diperlukan な.',2),
q('A「きのうは ひまでしたか。」B「いいえ、ひま（　）。」',['じゃありませんでした','です','でした','くなかったです'],'ひま adalah kata sifat な; negatif lampau memakai じゃありませんでした.'),
q('この まちは きれい（　）、しずかです。',['で','くて','いで','に'],'Penghubung kata sifat な adalah で.',2),
q('この かばんは やす（　）、べんりです。',['くて','で','いで','な'],'Kata sifat い dihubungkan dengan くて.',2),
q('わたしは にほんご（　）すきです。',['が','を','で','に'],'が menandai hal yang disukai.',3),
star('アンナさんは',['にほんご','が','とても','じょうず'],'です。',3,3),
star('ここは',['しずか','で','きれいな','まち'],'です。',2),
...passage('ハディさんは にほんごが すきです。にほんご（①）じょうずです。ハディさんは とても しんせつな（②）です。',[
q('① に なにを いれますか。',['が','を','に','で'],'が menandai bahasa yang dikuasai dalam にほんごがじょうずです.',3),
q('② に なにを いれますか。',['ひと','ひとの','ひとで','ひとに'],'しんせつな menerangkan kata benda ひと.',2)])],
8:[
q('へやに ねこが（　）。',['います','あります','いきます','かえります'],'Kucing sebagai makhluk hidup menggunakan います.'),
q('つくえの うえに ほんが（　）。',['あります','います','きます','かえります'],'Buku sebagai benda menggunakan あります.'),
q('へや（　）いすが あります。',['に','を','へ','と'],'に menandai lokasi keberadaan.'),
q('へやに いす（　）あります。',['が','を','へ','と'],'が menandai benda yang ada.'),
q('A「トイレは（　）ですか。」B「あちらです。」',['どちら','いくら','なんさい','なんじ'],'どちら meminta arah/lokasi dengan sopan.',3),
q('いぬは はこの（　）に います。はこの そとには いません。',['なか','うえ','した','まえ'],'Kontras dengan luar mengarah ke dalam.',2),
star('ほんは',['つくえ','の','うえ','に'],'あります。',2),
star('A「ねこは',['どこ','に','います','か'],'。」B「へやです。」',3),
...passage('ぎんこうの となりに がっこうが あります。がっこうの まえ（①）みせが あります。みせの なかに ねこが（②）。',[
q('① に なにを いれますか。',['に','を','へ','と'],'Lokasi keberadaan memakai に.',2),
q('② に なにを いれますか。',['います','あります','ですか','じゃありません'],'Kucing memakai います.',1)])],
9:[
q('あした にほん（　）いきます。',['へ','で','を','と'],'へ menandai tujuan.'),
q('バス（　）がっこうへ いきます。',['で','に','を','と'],'で menandai sarana transportasi.',2),
q('ともだち（　）にほんへ いきます。',['と','で','を','の'],'と menandai teman perjalanan.',2),
q('くじ（　）いきます。',['に','で','を','と'],'に menandai waktu tertentu.',3),
q('A「どこへ いきますか。」B「（　）。」',['にほんへ いきます','にほんから きます','にほんから かえります','でんしゃで いきます'],'どこへ meminta tujuan perjalanan.'),
q('A「いつ いきますか。」B「（　）。」',['あした いきます','バスで いきます','ともだちと いきます','にほんへ いきます'],'いつ meminta waktu, bukan kendaraan atau teman.',3),
star('わたしは えきから がっこう',['まで','ともだち','と','いっしょに'],'いきます。',2),
star('アンナさんは',['あした','くじ','に','きます'],'。',3,3),
...passage('あしたは ともだちと でんしゃ（①）まちへ いきます。きょうは がっこうへ いきます。がっこうへは ひとり（②）いきます。',[
q('① に なにを いれますか。',['で','に','を','と'],'でんしゃで menyatakan sarana.',2),
q('② に なにを いれますか。',['で','と','を','の'],'ひとりで berarti sendiri.',2)])]
};
