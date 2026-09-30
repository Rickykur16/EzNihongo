// Reviewed conversation support. Fixed grammar IDs are from the live visible
// conversation inventory; this file does not modify the curriculum itself.
const scenes=[];
export default scenes;
const pairs=[
  ['anna-wijaya','hadi-pratama'],['aoi-takahashi','ren-mori'],['claire-bennett','daniel-foster'],
  ['hadi-pratama','aoi-takahashi'],['ren-mori','claire-bennett'],['daniel-foster','anna-wijaya'],
  ['anna-wijaya','aoi-takahashi'],['hadi-pratama','claire-bennett'],['ren-mori','daniel-foster'],
];
function add(grammarId,chapter,pair,backgroundKey,goal,lines,comprehension,transfer){
  const turns=lines.trim().split('\n').map((line,index)=>{
    const [japanese,indonesian,expression]=line.split('|');
    return {speaker:index%2?'B':'A',japanese,indonesian:indonesian.replaceAll('。','.'),expression:expression||null};
  });
  const [prompt,correct,wrong1,wrong2,turnIndex,quote,explanation]=comprehension;
  const [transferPrompt,transferCorrect,transferWrong1,transferWrong2,transferExplanation]=transfer;
  const correctIndex=scenes.length%3;
  const options=(answer,first,second)=>{
    const values=[answer,first,second];
    for(let i=0;i<correctIndex;i++)values.unshift(values.pop());
    return values;
  };
  scenes.push({grammarId,chapter,cast:pairs[pair],backgroundKey,goal,turns,questions:[
    {kind:'comprehension',prompt,options:options(correct,wrong1,wrong2),correctIndex,explanation,evidence:[{turnIndex,quote}]},
    {kind:'transfer',prompt:transferPrompt,options:options(transferCorrect,transferWrong1,transferWrong2),correctIndex,explanation:transferExplanation,evidence:null},
  ]});
}

add('b7874295-4a7e-471d-a29e-d316af9f2af9',4,0,'classroom',
'Anna mengidentifikasi barang yang dipegang Hadi dan sebuah tas jauh dari mereka. Bedakan benda dekat lawan bicara dan benda jauh dari keduanya.',`
それは ほんですか。|Apakah itu buku?|
はい、これは ほんです。|Ya, ini buku.|
あれも ほんですか。|Apakah yang di sana itu juga buku?|berpikir
いいえ、あれは かばんです。|Bukan, yang di sana itu tas.|
ハディさんの かばんですか。|Apakah tas itu milik Hadi?|
はい、わたしのです。|Ya, milik saya.|senang`,
['Benda jauh dari kedua penutur ternyata apa?','Tas milik Hadi.','Buku milik Hadi.','Tas milik Anna.',3,'あれは かばんです','Hadi membetulkan bahwa benda jauh itu tas; pada akhir percakapan ia membenarkan bahwa tas itu miliknya.'],
['Teman memegang pena, jauh dari tangan Anda. Anda menanyakan benda di tangannya. Pilih pertanyaan yang sesuai.','それは ペンですか。','これは ペンですか。','あれは ペンですか。','それ menunjuk benda dekat lawan bicara. Situasinya bukan benda di tangan pembicara atau jauh dari keduanya.']);

add('bf86345f-7fb6-479f-8df3-cabe863df4ae',4,1,'classroom',
'Aoi memastikan buku Ren di antara beberapa buku. Buku yang dimaksud berada di dekat Aoi; ia memegangnya saat mengatakan このほん.',`
レンさんの ほんは どの ほんですか。|Buku yang mana milik Ren?|berpikir
その ほんです。|Buku itu, yang dekat Anda.|
この ほんですか。|Buku ini?|
はい、その ほんです。|Ya, buku itu.|
この ノートも レンさんのですか。|Apakah buku tulis ini juga milik Ren?|
いいえ、その ノートは わたしのじゃありません。|Bukan, buku tulis itu bukan milik saya.|`,
['Barang mana yang dikonfirmasi sebagai milik Ren?','Buku yang dekat Aoi.','Buku tulis yang dekat Aoi.','Semua buku dan buku tulis.',3,'その ほんです','Ren membenarkan buku yang ditunjuk Aoi; ia menyangkal kepemilikan buku tulis pada giliran terakhir.'],
['Anda memegang sebuah tas dan menanyakan pemiliknya. Pilih frasa penunjuk yang langsung dapat diikuti かばん.','この かばん','これ かばん','それ かばん','この langsung menerangkan kata benda. これ dan それ berdiri sendiri sebagai kata ganti benda.']);

add('a7be3c45-c5c7-4d03-b055-07907861fa54',4,2,'classroom',
'Claire melihat buku yang dipegang Daniel. Mereka memastikan bahasa buku itu dan siapa pemiliknya.',`
それは にほんごの ほんですか。|Apakah itu buku bahasa Jepang?|
いいえ、インドネシアごの ほんです。|Bukan, ini buku bahasa Indonesia.|
ダニエルさんの ほんですか。|Apakah itu buku milik Daniel?|
はい、わたしの ほんです。|Ya, buku saya.|
これも インドネシアごの ほんですか。|Apakah yang ini juga buku bahasa Indonesia?|berpikir
はい、それも インドネシアごの ほんです。|Ya, itu juga buku bahasa Indonesia.|`,
['Buku yang dipegang Daniel menggunakan bahasa apa?','Bahasa Indonesia.','Bahasa Jepang.','Bahasa Inggris.',1,'インドネシアごの ほんです','Daniel membetulkan dugaan Claire: bukunya berbahasa Indonesia.'],
['Kartu: sebuah buku berbahasa Jepang. Pilih frasa yang menyatakan jenis buku berdasarkan bahasanya.','にほんごの ほん','ほんの にほんご','にほんごも ほん','にほんごのほん berarti buku bahasa Jepang; bahasa menjadi penjelas sebelum の.']);

add('6d34c77a-cfd1-4975-9b11-740d2657a5b4',4,3,'classroom',
'Hadi menebak benda yang dipegang Aoi, lalu memastikan pemiliknya. Aoi membetulkan satu dugaan dan membenarkan dugaan berikutnya.',`
それは ペンですか。|Apakah itu pena?|
いいえ、ちがいます。えんぴつです。|Bukan. Ini pensil.|
あおいさんの えんぴつですか。|Apakah pensil itu milik Aoi?|
はい、そうです。|Ya, benar.|senang`,
['Dugaan mana yang dibenarkan penutur kedua?','Pensil itu miliknya.','Benda itu pena.','Benda itu milik Hadi.',3,'はい、そうです','そうです membenarkan pertanyaan sebelumnya tentang kepemilikan pensil.'],
['Teman mengira benda di tangan Anda buku tulis, padahal kamus (じしょ). Pilih koreksi yang sesuai.','いいえ、ちがいます。じしょです。','はい、そうです。','いいえ、ノートです。','Sangkal dugaan yang salah lalu sebutkan benda yang benar, yaitu じしょ.']);

add('44b6089f-572a-4829-a53b-65173bdafca0',5,4,'cafe',
'Ren dan Claire membaca daftar harga di kafe. Ren belum mengetahui harga minuman dan kue; Claire membantu membaca harganya.',`
この コーヒーは いくらですか。|Berapa harga kopi ini?|
さんびゃくえんです。|Tiga ratus yen.|
ケーキも さんびゃくえんですか。|Apakah kue juga tiga ratus yen?|
いいえ、ケーキは ごひゃくえんです。|Bukan, kuenya lima ratus yen.|
ごひゃくえんですね。|Lima ratus yen, ya.|berpikir
はい、そうです。|Ya, benar.|`,
['Berapa harga kue menurut Claire?','500 yen.','300 yen.','800 yen.',3,'ケーキは ごひゃくえんです','Harga kopi 300 yen, sedangkan Claire menyebut kue 500 yen.'],
['Label buku menunjukkan 600 yen. Pilih jawaban untuk このほんはいくらですか.','ろっぴゃくえんです。','ろくじです。','ろっぴゃくさいです。','Harga dijawab dengan jumlah uang dan えん; 600 dibaca ろっぴゃく.']);

add('3e3a2fa3-002e-41c1-9fa1-ee6d08d7775b',5,5,'classroom',
'Daniel tidak membawa jam. Anna memberi waktu sekarang; Daniel kemudian membandingkannya dengan jam pelajaran.',`
いま、なんじですか。|Sekarang pukul berapa?|
くじはんです。|Pukul setengah sepuluh.|
じゅぎょうは じゅうじですね。|Pelajarannya pukul sepuluh, ya.|
はい、じゅうじです。|Ya, pukul sepuluh.|`,
['Jam berapa sekarang, menurut Anna?','09.30.','10.00.','10.30.',1,'くじはんです','くじはん berarti 09.30; 10.00 adalah waktu pelajaran.'],
['Jam menunjukkan 04.00. Pilih cara menyebut waktu sekarang.','いま、よじです。','いま、よんじです。','いま、しちじです。','Pukul empat dibaca よじ. しちじ menyatakan pukul tujuh.']);

add('78c220c4-3766-47c9-aa46-ff01e6056327',5,6,'classroom',
'Anna dan Aoi memeriksa jadwal kelas dan waktu istirahat pada papan jadwal yang sama.',`
じゅぎょうは なんじからですか。|Pelajaran mulai pukul berapa?|
くじからです。|Mulai pukul sembilan.|
なんじまでですか。|Sampai pukul berapa?|
じゅうじまでです。|Sampai pukul sepuluh.|
やすみは じゅうじからですか。|Apakah istirahat mulai pukul sepuluh?|
はい。じゅうじから じゅうじはんまでです。|Ya. Dari pukul sepuluh sampai setengah sebelas.|`,
['Kapan waktu istirahat pada jadwal ini?','10.00–10.30.','09.00–10.00.','09.30–10.30.',5,'じゅうじから じゅうじはんまでです','Jawaban terakhir menyebut awal dan akhir waktu istirahat.'],
['Jadwal belajar mulai 08.00 dan selesai 09.00. Pilih rentang yang tepat.','はちじから くじまでです。','くじから はちじまでです。','はちじまで くじからです。','から menandai waktu mulai dan まで waktu selesai.']);

add('72142a22-e986-4ac4-b9a8-e6df1540acb2',5,7,'classroom',
'Hadi dan Claire berlatih menyebut usia dengan kartu peran, bukan menyatakan profil asli. Kartu Hadi 20 tahun; kartu Claire 19 tahun.',`
おいくつですか。|Berapa usia Anda?|
じゅうきゅうさいです。おいくつですか。|Sembilan belas tahun. Berapa usia Anda?|
はたちです。|Dua puluh tahun.|
はたちですね。|Dua puluh tahun, ya.|berpikir`,
['Menurut kartu peran, berapa usia penutur pertama?','20 tahun.','19 tahun.','29 tahun.',2,'はたちです','Penutur pertama menjawab はたち, yaitu dua puluh tahun.'],
['Kartu peran Anda menyatakan usia 20 tahun. Pilih jawaban usia yang lazim.','はたちです。','はっさいです。','じゅっさいです。','はたち adalah bacaan usia dua puluh tahun; はっさい delapan dan じゅっさい sepuluh.']);

add('d099ec03-2dc0-49df-b437-1caec138f335',6,8,'cafe',
'Ren dan Daniel baru menerima teh dan kue. Mereka bertukar kesan tentang suhu teh dan rasa kue.',`
この おちゃは あついですね。|Teh ini panas, ya.|
はい、とても あついです。|Ya, sangat panas.|
ケーキは どうですか。|Bagaimana kuenya?|
おいしいです。あまいです。|Enak. Rasanya manis.|senang`,
['Bagaimana penilaian Daniel terhadap kue?','Enak dan manis.','Dingin dan pahit.','Tidak enak dan asin.',3,'おいしいです。あまいです','Daniel menyebut dua sifat kue: enak dan manis.'],
['Kartu rasa: kue ini enak, おいしい. Pilih kalimat sopan yang benar.','この ケーキは おいしいです。','この ケーキは おいしです。','この ケーキは おいしいだです。','Kata sifat い tetap mempertahankan い sebelum です.']);

add('636e2d7a-0c49-4522-ac49-16eb06f4b650',6,0,'cafe',
'Anna menanyakan rasa kopi Hadi sebelum membandingkannya dengan kopinya sendiri.',`
その コーヒーは あまいですか。|Apakah kopi itu manis?|
いいえ、あまくないです。|Tidak, tidak manis.|
にがいですか。|Apakah pahit?|
はい、すこし にがいです。|Ya, sedikit pahit.|
わたしの コーヒーは あまいです。|Kopi saya manis.|
そうですか。|Oh, begitu.|berpikir`,
['Bagaimana rasa kopi penutur kedua?','Tidak manis dan sedikit pahit.','Manis dan sedikit pahit.','Manis dan tidak pahit.',1,'あまくないです','Hadi menyangkal rasa manis, lalu menyebut kopinya sedikit pahit.'],
['Kartu rasa: kopi ini tidak manis. Pilih bentuk negatif あまい.','この コーヒーは あまくないです。','この コーヒーは あまいじゃありません。','この コーヒーは あまかったです。','Negatif kata sifat い dibentuk dengan mengganti い terakhir menjadi くないです.']);

add('86fc3efd-ba51-4c80-a1bc-d6a368c54e05',6,1,'park',
'Aoi dan Ren membicarakan cuaca kemarin dan hari ini ketika bertemu di taman.',`
きのうは あつかったですね。|Kemarin panas, ya.|
はい、とても あつかったです。|Ya, sangat panas.|
きょうも あついですか。|Apakah hari ini juga panas?|
いいえ、きょうは すずしいです。|Tidak, hari ini sejuk.|senang`,
['Apa perbedaan cuaca yang disampaikan Ren?','Kemarin panas, hari ini sejuk.','Kemarin sejuk, hari ini panas.','Kemarin dan hari ini sangat panas.',3,'きょうは すずしいです','Ren membenarkan bahwa kemarin panas, tetapi menyatakan hari ini sejuk.'],
['Kartu pengalaman: masakan kemarin enak. Pilih kalimat lampau yang tepat.','きのうの りょうりは おいしかったです。','きのうの りょうりは おいしいでした。','きのうの りょうりは おいしくないです。','Bentuk positif lampau おいしい adalah おいしかったです.']);

add('eb47ef6b-a664-4f04-9785-d13b79b48384',6,2,'classroom',
'Claire dan Daniel membandingkan tingkat kesulitan serta panjangnya ujian yang sudah selesai kemarin.',`
きのうの テストは むずかしかったですか。|Apakah ujian kemarin sulit?|
いいえ、むずかしくなかったです。|Tidak, tidak sulit.|
ながかったですか。|Apakah ujiannya panjang?|
いいえ、あまり ながくなかったです。|Tidak, tidak terlalu panjang.|
よかったですね。|Syukurlah, ya.|senang
はい。|Ya.|`,
['Apa yang Daniel katakan tentang ujian kemarin?','Tidak sulit dan tidak terlalu panjang.','Sulit dan sangat panjang.','Tidak sulit tetapi sangat panjang.',3,'あまり ながくなかったです','Daniel menyangkal ujian sulit, lalu mengatakan tidak terlalu panjang.'],
['Kartu pengalaman: kemarin Anda tidak sibuk. Pilih bentuk negatif lampau yang sesuai.','きのうは いそがしくなかったです。','きのうは いそがしくないです。','きのうは いそがしかったです。','Negatif lampau いそがしい menjadi いそがしくなかったです.']);

add('4ac8518d-0765-483e-bc18-12c0863a16d5',6,3,'classroom',
'Hadi memperhatikan dua buku yang dibawa Aoi. Mereka membedakan buku baru dan kamus lama.',`
その あたらしい ほんは あおいさんのですか。|Apakah buku baru itu milik Aoi?|
はい、わたしのです。|Ya, milik saya.|
その ふるい ほんも あおいさんのですか。|Apakah buku lama itu juga milik Aoi?|
はい。これは ふるい じしょです。|Ya. Ini kamus lama.|`,
['Benda lama yang dibawa Aoi adalah apa?','Kamus.','Buku tulis.','Tas.',3,'ふるい じしょです','Aoi menjelaskan bahwa buku lama yang ditanyakan Hadi adalah kamus.'],
['Anda memperkenalkan sebuah tas besar. Pilih susunan kata sifat い dan kata benda yang benar.','おおきい かばんです。','おおきいです かばんです。','おおきく かばんです。','おおきい langsung diletakkan sebelum かばん untuk menerangkan tas besar.']);

add('029d0b2c-d19d-4c84-ab1d-20e764141823',6,4,'cafe',
'Ren meminta pendapat Claire tentang kue. Claire menekankan rasa manis dan kelezatannya.',`
この ケーキは どうですか。|Bagaimana kue ini?|
とても おいしいです。|Sangat enak.|senang
あまいですか。|Apakah manis?|
はい、とても あまいです。|Ya, sangat manis.|
コーヒーは どうですか。|Bagaimana kopinya?|
すこし にがいです。|Sedikit pahit.|`,
['Kata とても digunakan Claire untuk sifat apa?','Enak dan manis pada kue.','Pahit pada kopi.','Murah pada harga kue.',3,'とても あまいです','Claire menyebut kue とてもおいしい dan とてもあまい; kopi hanya すこしにがい.'],
['Kartu cuaca: hari ini sangat panas. Pilih kalimat yang menyatakan tingkat tersebut.','きょうは とても あついです。','きょうは あまり あつくないです。','きょうは あつくないです。','とても menegaskan tingkat sifat: sangat panas. Dua pilihan lain menyatakan tingkat rendah atau penyangkalan.']);

add('1c2472f7-f031-4b70-b3ee-49ec6b3e1325',6,5,'cafe',
'Daniel tidak menyukai rasa yang terlalu pedas. Ia menanyakan rasa masakan yang sedang dimakan Anna.',`
その りょうりは からいですか。|Apakah masakan itu pedas?|
いいえ、あまり からくないです。|Tidak, tidak terlalu pedas.|
おいしいですか。|Apakah enak?|
はい、とても おいしいです。|Ya, sangat enak.|senang`,
['Bagaimana masakan itu menurut Anna?','Tidak terlalu pedas dan sangat enak.','Sangat pedas dan tidak enak.','Sama sekali tidak enak.',1,'あまり からくないです','Anna menyebut tidak terlalu pedas, kemudian memberi penilaian sangat enak.'],
['Kartu harga: buku ini tidak terlalu mahal. Pilih kalimat yang sesuai.','この ほんは あまり たかくないです。','この ほんは とても たかいです。','この ほんは あまり たかいです。','あまり pada tingkat sifat ini dipasangkan dengan bentuk negatif, たかくないです.']);

add('5b00cf06-968a-41e2-8c73-1ea414b7b51b',6,6,'classroom',
'Anna meminta kesan Aoi tentang buku yang sedang mereka bahas, kemudian menanyakan harganya.',`
この ほんは どうですか。|Bagaimana buku ini menurut Anda?|
おもしろいです。あまり むずかしくないです。|Menarik. Tidak terlalu sulit.|
たかいですか。|Apakah mahal?|
いいえ、やすいです。|Tidak, murah.|
いい ほんですね。|Buku yang bagus, ya.|senang
はい、とても いいです。|Ya, sangat bagus.|`,
['Apa jawaban Aoi saat diminta kesan tentang buku?','Menarik dan tidak terlalu sulit.','Mahal dan sulit.','Murah tetapi tidak menarik.',1,'おもしろいです。あまり むずかしくないです','Pertanyaan どうですか dijawab dengan penilaian isi buku; harga ditanyakan sesudahnya.'],
['Teman sudah mencoba masakan. Anda ingin meminta kesannya, bukan harganya. Pilih pertanyaan yang tepat.','この りょうりは どうですか。','この りょうりは いくらですか。','この りょうりは だれのですか。','どうですか meminta pendapat atau kesan; いくら harga dan だれの kepemilikan.']);

add('4424218a-2236-42da-a98e-a19fa86636f9',7,7,'cafe',
'Hadi dan Claire membicarakan suasana kafe yang sedang mereka kunjungi. Hadi membandingkannya dengan kafe dekat stasiun.',`
この カフェは しずかですね。|Kafe ini tenang, ya.|
はい。きれいですね。|Ya. Bersih, ya.|senang
えきの カフェも しずかですか。|Apakah kafe di stasiun juga tenang?|
いいえ、えきの カフェは にぎやかです。|Tidak, kafe di stasiun ramai.|`,
['Bagaimana suasana kafe di stasiun menurut Claire?','Ramai.','Tenang.','Sepi dan tidak bersih.',3,'えきの カフェは にぎやかです','Claire membedakan kafe yang sedang mereka kunjungi dari kafe di stasiun yang ramai.'],
['Kartu: kota ini tenang. Pilih bentuk predikat sopan しずか.','この まちは しずかです。','この まちは しずかなです。','この まちは しずかくです。','Kata sifat な sebagai predikat langsung diikuti です, tanpa な.']);

add('f59be5f1-13b6-4fa4-a331-54dc73d68cc9',7,8,'classroom',
'Ren melihat kamus baru Daniel. Daniel menjelaskan bahwa kamus itu praktis dan terkenal; Ren menyimpulkan bahwa kamus itu bagus.',`
それは あたらしい じしょですか。|Apakah itu kamus baru?|
はい。べんりな じしょです。|Ya. Kamus yang praktis.|
ゆうめいな じしょですか。|Apakah itu kamus yang terkenal?|
はい、とても ゆうめいです。|Ya, sangat terkenal.|
いい じしょですね。|Kamus yang bagus, ya.|senang
はい。|Ya.|`,
['Apa yang dikatakan Daniel tentang kamusnya?','Praktis dan terkenal.','Lama dan tidak praktis.','Tidak terkenal dan sulit.',1,'べんりな じしょです','Daniel menyebut kamusnya praktis dan kemudian membenarkan bahwa kamus itu terkenal.'],
['Gabungkan しんせつ (baik hati) dan ひと (orang). Pilih frasa yang benar.','しんせつな ひと','しんせつ ひと','しんせつく ひと','Kata sifat な memerlukan な ketika langsung menerangkan kata benda.']);

add('20b05f6a-6672-4084-82aa-abc5c81221a7',7,0,'cafe',
'Anna dan Hadi membahas waktu luang mereka hari ini dan besok. Tujuannya mengetahui kapan Hadi senggang tanpa membuat janji baru.',`
きょうは ひまですか。|Apakah hari ini Anda senggang?|
いいえ、ひまじゃありません。|Tidak, saya tidak senggang.|
あしたも ひまじゃありませんか。|Apakah besok juga tidak senggang?|
あしたは ひまです。|Besok saya senggang.|
あしたは ひまですね。|Jadi besok Anda senggang, ya.|
はい。|Ya.|senang`,
['Kapan Hadi senggang?','Besok.','Hari ini.','Hari ini dan besok.',3,'あしたは ひまです','Hadi menyangkal senggang hari ini, tetapi menyatakan besok senggang.'],
['Kartu: kamar ini tidak bersih. Pilih bentuk negatif sopan dari きれい.','この へやは きれいじゃありません。','この へやは きれくないです。','この へやは きれいです。','きれい adalah kata sifat な; bentuk negatif sopannya きれいじゃありません.']);

add('6eabf61d-6690-46a6-a6f0-fede7682653e',7,1,'cafe',
'Aoi dan Ren saling bertanya tentang memasak. Mereka membedakan kesukaan dari kemampuan.',`
りょうりが すきですか。|Apakah Anda suka memasak?|
はい、とても すきです。|Ya, sangat suka.|senang
りょうりが じょうずですか。|Apakah Anda pandai memasak?|
いいえ、あまり じょうずじゃありません。|Tidak, saya tidak begitu pandai.|
わたしも りょうりが すきです。|Saya juga suka memasak.|
そうですか。|Oh, begitu.|senang`,
['Apa yang Ren katakan tentang memasak?','Ia sangat suka, tetapi tidak begitu pandai.','Ia tidak suka karena tidak pandai.','Ia sangat pandai dan tidak suka.',3,'あまり じょうずじゃありません','Ren sangat suka memasak, tetapi kesukaan itu tidak berarti ia mahir.'],
['Kartu: Anda suka bahasa Jepang; kemampuan belum dibicarakan. Pilih kalimat yang hanya menyatakan kesukaan.','わたしは にほんごが すきです。','わたしは にほんごが じょうずです。','わたしは にほんごが へたです。','すき menyatakan kesukaan, sedangkan じょうず dan へた menyatakan tingkat kemampuan.']);

add('862a5c6a-11eb-4c5c-b81c-537b8a474fd3',7,2,'cafe',
'Claire meminta penilaian Daniel terhadap kafe dan makanannya. Daniel menggabungkan dua sifat untuk setiap hal.',`
この カフェは どうですか。|Bagaimana kafe ini?|
しずかで、きれいです。|Tenang dan bersih.|
りょうりは どうですか。|Bagaimana makanannya?|
やすくて、おいしいです。|Murah dan enak.|senang`,
['Dua sifat apa yang Daniel gunakan untuk makanan?','Murah dan enak.','Tenang dan bersih.','Mahal dan pedas.',3,'やすくて、おいしいです','しずかで、きれいです menerangkan kafe; やすくて、おいしいです menerangkan makanan.'],
['Kartu tas: murah (やすい) dan praktis (べんり). Pilih satu kalimat yang menggabungkan sifatnya.','この かばんは やすくて、べんりです。','この かばんは やすいで、べんりです。','この かばんは やすなで、べんりです。','Untuk menghubungkan sifat い, やすい berubah menjadi やすくて.']);

add('149e0564-0969-42fe-8f23-2bd73221e018',7,3,'park',
'Hadi bertemu Aoi di taman yang sepi hari ini. Mereka membandingkannya dengan suasana kemarin.',`
きょうは しずかですね。|Hari ini tenang, ya.|
はい。きのうは にぎやかでした。|Ya. Kemarin ramai.|
きのうは しずかじゃありませんでしたか。|Jadi kemarin tidak tenang?|
はい、しずかじゃありませんでした。|Ya, kemarin tidak tenang.|`,
['Bagaimana suasana taman kemarin menurut Aoi?','Ramai; tidak tenang.','Tenang seperti hari ini.','Tidak diketahui.',1,'きのうは にぎやかでした','Aoi menyatakan kemarin ramai, lalu menegaskan kemarin tidak tenang.'],
['Kartu kemarin: Anda tidak senggang. Pilih bentuk negatif lampau dari ひま.','きのうは ひまじゃありませんでした。','きのうは ひまじゃありません。','きのうは ひまでした。','じゃありませんでした menyatakan penyangkalan pada waktu lampau.']);

add('a5ec89d1-9fd2-4b76-a225-b8edf9beeef8',8,4,'park',
'Ren dan Claire memperhatikan apa yang ada di taman. Mereka menemukan bangku dan seekor kucing di bawahnya.',`
あそこに ベンチが ありますね。|Di sana ada bangku, ya.|
はい。ベンチの したに ねこも いますよ。|Ya. Di bawah bangku itu juga ada kucing, lho.|
ねこですか。|Kucing?|kaget
はい、しろい ねこが います。|Ya, ada kucing putih.|senang`,
['Apa yang ada di bawah bangku?','Kucing putih.','Tas putih.','Bangku lain.',3,'しろい ねこが います','Claire menyebut kucing di bawah bangku, lalu menjelaskan bahwa kucingnya putih.'],
['Kartu: di kelas ada guru. Pilih kalimat keberadaan yang benar.','きょうしつに せんせいが います。','きょうしつに せんせいが あります。','きょうしつに せんせいを います。','Orang dinyatakan dengan います; keberadaannya diperkenalkan dengan が.']);

add('612b845a-ca0e-4ca4-b64f-e7fe7e6d11a0',8,5,'classroom',
'Daniel mencari tasnya. Anna menunjukkan tas di bawah meja dan membantu memastikan meja yang dimaksud.',`
わたしの かばんは どこですか。|Tas saya di mana?|bingung
つくえの したに あります。|Ada di bawah meja.|
どの つくえですか。|Meja yang mana?|
あの つくえです。|Meja yang di sana.|
ああ、その かばんですね。ありがとうございます。|Oh, tas itu, ya. Terima kasih.|senang
はい、その かばんです。|Ya, tas itu.|`,
['Di mana tas Daniel?','Di bawah meja yang ditunjuk Anna.','Di atas meja yang ditunjuk Anna.','Di belakang Anna.',1,'つくえの したに あります','Anna memberi lokasi tas di bawah meja, kemudian menunjuk meja yang dimaksud.'],
['Guru yang sudah dibicarakan berada di kelas. Pilih kalimat yang memberi lokasinya.','せんせいは きょうしつに います。','きょうしつは せんせいに います。','せんせいは きょうしつに あります。','Guru menjadi topik dengan は dan lokasi ditandai に; orang menggunakan います.']);

add('eae83f3f-99d8-49f7-8ff4-bad7556c09dc',8,6,'station',
'Anna dan Aoi berdiri di depan loket stasiun. Anna bertanya tentang gedung perpustakaan yang jauh dari keduanya.',`
ここは きっぷうりばですね。|Di sini loket tiket, ya.|
はい、そうです。|Ya, benar.|
あそこは としょかんですか。|Apakah di sana perpustakaan?|
はい、あそこは としょかんです。|Ya, di sana perpustakaan.|
えきの ちかくですね。|Dekat stasiun, ya.|
はい、とても ちかいです。|Ya, sangat dekat.|`,
['Kedua penutur sedang berdiri di mana?','Di depan loket tiket.','Di perpustakaan.','Di dalam kelas.',0,'ここは きっぷうりばですね','Anna menyebut tempat mereka berada dengan ここ; perpustakaan yang jauh ditunjuk dengan あそこ.'],
['Anda berdiri di kelas dan memperkenalkan tempat Anda sekarang. Pilih kata penunjuk tempat yang sesuai.','ここは きょうしつです。','あそこは きょうしつです。','これは きょうしつです。','ここ menunjuk tempat pembicara berada. これ menunjuk benda dan あそこ tempat yang jauh.']);

add('b32d4dda-a95a-4a6b-b849-711c1a7adb2d',8,7,'station',
'Hadi meminta petunjuk sopan kepada Claire. Loket berada jauh dari mereka, sedangkan toilet berada di dekat Claire.',`
きっぷうりばは どちらですか。|Loket tiket di sebelah mana?|
あちらです。|Di sebelah sana.|
トイレも あちらですか。|Apakah toilet juga di sebelah sana?|
いいえ、トイレは こちらです。|Tidak, toilet di sebelah sini.|
ありがとうございます。|Terima kasih.|senang
どういたしまして。|Sama-sama.|`,
['Menurut Claire, toilet berada di mana?','Di sebelah sini, dekat Claire.','Di sebelah sana bersama loket.','Di luar stasiun.',3,'トイレは こちらです','Claire membedakan toilet di dekat dirinya dari loket yang ditunjuk dengan あちら.'],
['Sebagai petugas, Anda menunjukkan perpustakaan yang jauh dari Anda dan pengunjung. Pilih jawaban lokasi yang sopan.','としょかんは あちらです。','としょかんは こちらです。','としょかんは そちらです。','あちら menunjuk arah atau tempat yang jauh dari kedua penutur dalam situasi ini.']);

add('7fc97164-76bc-4fda-8f25-684dba4852d9',8,8,'station',
'Ren mencari toilet. Daniel memberi lokasi singkat dengan kata benda sebagai topik, kemudian memastikan lokasi loket tiket.',`
トイレは どこですか。|Toilet di mana?|
トイレは あそこです。|Toilet di sana.|
きっぷうりばも あそこですか。|Apakah loket tiket juga di sana?|
いいえ、きっぷうりばは ここです。|Tidak, loket tiket di sini.|`,
['Tempat apa yang berada di dekat kedua penutur?','Loket tiket.','Toilet.','Perpustakaan.',3,'きっぷうりばは ここです','Daniel menggunakan ここ untuk loket tiket; toilet ditunjuk dengan あそこ.'],
['Kartu: toilet jauh dari kedua penutur. Pilih jawaban lokasi singkat yang sesuai.','トイレは あそこです。','トイレは あれです。','トイレは あのです。','Pola kata benda は tempat です memakai kata penunjuk tempat, di sini あそこ.']);

add('eccb0635-72cb-43c2-a4c1-ac4c82450e3e',8,0,'station',
'Anna mencari bank di sekitar stasiun. Hadi membantu menjelaskan lokasinya agar Anna tidak tertukar dengan kantor pos.',`
どこに ぎんこうが ありますか。|Di mana ada bank?|
えきの まえに あります。|Ada di depan stasiun.|
あの たてものですか。|Apakah gedung yang di sana?|
いいえ、あれは ゆうびんきょくです。ぎんこうは その となりです。|Bukan, itu kantor pos. Bank berada di sebelahnya.|
ありがとうございます。|Terima kasih.|senang
どういたしまして。|Sama-sama.|`,
['Di mana bank yang dijelaskan Hadi?','Di depan stasiun, di sebelah kantor pos.','Di dalam stasiun.','Di belakang kelas.',3,'ぎんこうは その となりです','Hadi mula-mula menyebut depan stasiun, lalu memperjelas bahwa bank berada di sebelah kantor pos.'],
['Anda mencari toilet. Pilih pertanyaan yang menanyakan tempat keberadaannya.','どこに トイレが ありますか。','だれに トイレが ありますか。','いくらに トイレが ありますか。','どこ menanyakan tempat; に menandai lokasi keberadaan.']);

add('cafebd49-f6ce-4905-9b6d-b1dccf0b2579',8,1,'classroom',
'Aoi bertanya dengan sopan tentang perpustakaan. Ren memberi arah dan menambahkan lokasi ruang kelas di sebelahnya.',`
としょかんは どちらですか。|Perpustakaan di sebelah mana?|
あちらです。|Di sebelah sana.|
きょうしつは どこですか。|Ruang kelas di mana?|
としょかんの となりです。|Di sebelah perpustakaan.|
ありがとうございます。|Terima kasih.|senang
どういたしまして。|Sama-sama.|`,
['Di mana ruang kelas menurut Ren?','Di sebelah perpustakaan.','Di belakang stasiun.','Di dalam kafe.',3,'としょかんの となりです','Ren memberi lokasi kelas dengan perpustakaan sebagai patokan.'],
['Anda bertanya kepada petugas tentang lokasi bank dengan pilihan kata yang lebih sopan. Pilih pertanyaannya.','ぎんこうは どちらですか。','ぎんこうは どれですか。','ぎんこうは だれですか。','どちら dapat menanyakan arah atau lokasi dengan sopan; どれ memilih benda dan だれ menanyakan orang.']);

add('a3cde031-f1b3-4982-8eea-b73d76a1fe1d',8,2,'classroom',
'Claire mencari kamus. Daniel menggunakan meja sebagai patokan, lalu membetulkan dugaan bahwa kamus berada di atas meja.',`
じしょは どこに ありますか。|Kamus ada di mana?|bingung
つくえの したに あります。|Ada di bawah meja.|
つくえの うえですか。|Di atas meja?|
いいえ、したです。かばんの となりに あります。|Bukan, di bawah. Ada di sebelah tas.|
ああ、ありがとうございます。|Oh, terima kasih.|senang
どういたしまして。|Sama-sama.|`,
['Di mana kamus itu berada?','Di bawah meja, di sebelah tas.','Di atas meja, di sebelah tas.','Di dalam tas.',3,'かばんの となりに あります','Daniel membetulkan うえ menjadi した dan memberi patokan tambahan di sebelah tas.'],
['Kartu lokasi: kucing berada di bawah kursi. Pilih frasa posisi yang benar.','いすの した','したの いす','いすが した','Benda patokan lebih dahulu, diikuti の lalu posisi: いすのした.']);

add('d5d836ae-9bf3-4891-9de1-a67671155fc5',9,3,'station',
'Hadi dan Aoi bertemu di stasiun. Mereka saling menyebut tujuan; kedatangan Anna dibicarakan dari sudut pandang mereka yang sedang berada di stasiun.',`
これから どこへ いきますか。|Setelah ini Anda pergi ke mana?|
がっこうへ いきます。ハディさんは。|Saya pergi ke sekolah. Kalau Hadi?|
うちへ かえります。|Saya pulang ke rumah.|
アンナさんも かえりますか。|Apakah Anna juga pulang?|
いいえ、アンナさんは ここへ きます。|Tidak, Anna datang ke sini.|
そうですか。|Oh, begitu.|`,
['Apa yang akan dilakukan Anna menurut Hadi?','Datang ke stasiun tempat mereka berada.','Pulang bersama Hadi.','Sudah berada di sekolah.',4,'アンナさんは ここへ きます','ここへきます menyatakan Anna bergerak menuju tempat pembicara, yaitu stasiun.'],
['Anda sedang di sekolah dan akan kembali ke rumah sendiri. Pilih kalimat yang menyatakan pulang.','うちへ かえります。','うちへ きます。','うちに います。','かえります berarti kembali atau pulang; きます datang dan います menyatakan keberadaan.']);

add('ea15dec5-3e3f-4596-8f64-a6cd901978e4',9,4,'station',
'Ren dan Claire membandingkan kendaraan menuju sekolah. Mereka memastikan perbedaan rute masing-masing.',`
がっこうへ なにで いきますか。|Anda pergi ke sekolah dengan apa?|
バスで いきます。レンさんは。|Dengan bus. Kalau Ren?|
わたしは じてんしゃで いきます。|Saya pergi dengan sepeda.|
がっこうは ちかいですか。|Apakah sekolahnya dekat?|
はい、とても ちかいです。|Ya, sangat dekat.|
そうですか。|Oh, begitu.|`,
['Claire menggunakan kendaraan apa untuk pergi ke sekolah?','Bus.','Sepeda.','Kereta.',1,'バスで いきます','Claire, penutur kedua, menjawab バスでいきます. Ren yang menggunakan sepeda.'],
['Kartu perjalanan: Anda pergi ke bank naik kereta. Pilih kalimat yang sesuai.','でんしゃで ぎんこうへ いきます。','でんしゃへ ぎんこうで いきます。','ぎんこうから でんしゃまで いきます。','で mengikuti kendaraan dan へ mengikuti tujuan.']);

add('08e35ed5-1ee5-46e9-b461-4e5d65329600',9,5,'station',
'Daniel bertanya bagaimana Anna pergi ke bandara. Anna menjelaskan bahwa ia memakai kereta untuk ke bandara dan taksi untuk pulang.',`
くうこうへ バスで いきますか。|Apakah Anda pergi ke bandara dengan bus?|
いいえ、でんしゃで いきます。|Tidak, dengan kereta.|
うちへも でんしゃで かえりますか。|Apakah pulang ke rumah juga dengan kereta?|
いいえ、タクシーで かえります。|Tidak, saya pulang dengan taksi.|`,
['Bagaimana Anna pulang ke rumah?','Dengan taksi.','Dengan kereta.','Dengan bus.',3,'タクシーで かえります','Kereta dipakai menuju bandara; untuk pulang Anna menyebut taksi.'],
['Kartu: tujuan stasiun, kendaraan bus. Lengkapi informasi perjalanan dengan kalimat yang tepat.','えきへ バスで いきます。','えきへ タクシーで いきます。','がっこうへ バスで いきます。','Pilihan pertama menyebut tujuan dan kendaraan sesuai kartu.']);

add('8ccd8f29-3ad1-4c89-bde4-a77fec18d7ce',9,6,'station',
'Anna meminta penjelasan rute dari stasiun sampai kampus. Aoi menyebut kedua ujung perjalanan dan kendaraan yang digunakan.',`
えきから だいがくまで なにで いきますか。|Dari stasiun sampai universitas, naik apa?|
バスで いきます。|Naik bus.|
バスていは どこですか。|Halte busnya di mana?|
えきの まえです。|Di depan stasiun.|
えきから だいがくまで、バスですね。|Jadi dari stasiun sampai universitas naik bus, ya.|
はい、そうです。|Ya, benar.|`,
['Rute yang sedang dijelaskan dimulai dan berakhir di mana?','Dari stasiun sampai universitas.','Dari universitas sampai rumah.','Dari bank sampai stasiun.',0,'えきから だいがくまで','から menunjukkan titik awal stasiun, sedangkan まで menunjukkan titik akhir universitas.'],
['Kartu rute: berangkat dari rumah, tujuan sekolah. Pilih urutan penanda yang benar.','うちから がっこうまで いきます。','がっこうから うちまで いきます。','うちまで がっこうから いきます。','うちからがっこうまで mempertahankan titik awal dan akhir sesuai kartu.']);

add('f6eca90c-a108-454c-a197-7f50e8d99bdd',9,7,'cafe',
'Hadi ingin mengetahui rencana perjalanan Claire. Tiga pertanyaan mengisi informasi tujuan, waktu, dan teman perjalanan.',`
どこへ いきますか。|Anda akan pergi ke mana?|
きょうとへ いきます。|Saya pergi ke Kyoto.|
いつ いきますか。|Kapan Anda pergi?|
あした いきます。|Saya pergi besok.|
だれと いきますか。|Anda pergi bersama siapa?|
ともだちと いきます。|Saya pergi bersama teman.|senang`,
['Claire akan pergi ke Kyoto bersama siapa?','Teman.','Sendirian.','Guru.',5,'ともだちと いきます','Jawaban terakhir menyebut ともだちと, bersama teman.'],
['Anda sudah tahu tujuan teman adalah Kyoto. Yang belum diketahui adalah waktu keberangkatannya. Pilih pertanyaan yang diperlukan.','いつ いきますか。','だれと いきますか。','どこへ いきますか。','いつ menanyakan waktu; dua pilihan lain menanyakan teman perjalanan dan tujuan yang sudah diketahui.']);

add('73227354-5a76-40b6-b063-2cfb6dc6bf7d',10,8,'classroom',
'Ren dan Daniel membicarakan kegiatan setelah kelas hari ini. Mereka menyebut apa yang dibaca dan apa yang ditulis.',`
きょうは なにを しますか。|Hari ini Anda akan melakukan apa?|
としょかんで ほんを よみます。|Saya membaca buku di perpustakaan.|
にほんごの ほんですか。|Buku bahasa Jepang?|
はい。レンさんは なにを しますか。|Ya. Kalau Ren, melakukan apa?|
わたしは てがみを かきます。|Saya menulis surat.|
いいですね。|Bagus, ya.|senang`,
['Apa kegiatan Daniel di perpustakaan?','Membaca buku bahasa Jepang.','Menulis surat.','Minum kopi.',1,'としょかんで ほんを よみます','Daniel menyebut membaca di perpustakaan, lalu membenarkan bahwa bukunya berbahasa Jepang.'],
['Kartu kegiatan: Anda minum air. Pilih penanda objek yang tepat.','みずを のみます。','みずへ のみます。','みずから のみます。','を menandai objek yang diminum.']);

add('ac263689-3cf5-4882-a691-4b0bdb468ccf',10,0,'cafe',
'Anna dan Hadi membicarakan minuman yang mereka konsumsi. Hadi meluruskan dugaan bahwa ia minum kopi.',`
コーヒーを のみますか。|Apakah Anda minum kopi?|
いいえ、コーヒーは のみません。|Tidak, saya tidak minum kopi.|
おちゃは のみますか。|Kalau teh, apakah Anda minum?|
はい、おちゃは のみます。|Ya, saya minum teh.|
わたしも おちゃを のみます。|Saya juga minum teh.|
そうですか。|Oh, begitu.|senang`,
['Minuman apa yang tidak diminum Hadi?','Kopi.','Teh.','Air.',1,'コーヒーは のみません','Hadi menolak kopi dengan のみません, lalu mengatakan ia minum teh.'],
['Kartu rencana: hari ini Anda tidak menonton televisi. Pilih kalimat negatif sopan.','きょうは テレビを みません。','きょうは テレビを みます。','きょうは テレビを みました。','みません menyatakan tidak menonton; みました menyatakan sudah menonton.']);

add('c3d86282-37a9-4d25-8471-acd84ffe1fec',10,1,'classroom',
'Aoi dan Ren membicarakan kegiatan kemarin di perpustakaan, lalu bertukar kesan tentang buku yang dibaca Ren.',`
きのうは なにを しましたか。|Apa yang Anda lakukan kemarin?|
としょかんで ほんを よみました。|Saya membaca buku di perpustakaan.|
にほんごの ほんを よみましたか。|Apakah Anda membaca buku bahasa Jepang?|
はい、よみました。|Ya, saya membacanya.|
どうでしたか。|Bagaimana bukunya?|
おもしろかったです。|Menarik.|senang`,
['Di mana Ren membaca kemarin?','Di perpustakaan.','Di stasiun.','Di kafe.',1,'としょかんで ほんを よみました','Ren menyebut lokasi kegiatan lampau dengan としょかんで.'],
['Catatan tadi pagi: Anda makan roti. Pilih laporan kegiatan yang sudah dilakukan.','けさ、パンを たべました。','けさ、パンを たべませんでした。','あした、パンを たべます。','たべました adalah bentuk positif lampau, sesuai kegiatan tadi pagi.']);

add('963abb05-086a-4523-8e92-dabac46602d7',10,2,'cafe',
'Claire menanyakan kegiatan Daniel tadi malam. Daniel tidak menonton televisi, tetapi membaca buku.',`
きのうの よる、テレビを みましたか。|Tadi malam, apakah Anda menonton televisi?|
いいえ、みませんでした。|Tidak, saya tidak menonton.|
なにを しましたか。|Apa yang Anda lakukan?|
ほんを よみました。|Saya membaca buku.|
にほんごの ほんですか。|Buku bahasa Jepang?|
はい、そうです。|Ya, benar.|`,
['Kegiatan apa yang tidak dilakukan Daniel tadi malam?','Menonton televisi.','Membaca buku.','Membaca buku bahasa Jepang.',1,'みませんでした','Jawaban negatif lampau itu merujuk pada pertanyaan tentang menonton televisi. Daniel justru membaca buku.'],
['Catatan kemarin: Anda tidak pergi ke sekolah. Pilih bentuk negatif lampau.','きのう、がっこうへ いきませんでした。','きのう、がっこうへ いきました。','あした、がっこうへ いきません。','いきませんでした menyangkal kegiatan pergi pada waktu lampau.']);

add('19252097-8ff5-49f1-89ed-c6daf0854aba',10,3,'classroom',
'Hadi dan Aoi membicarakan rutinitas belajar bahasa Jepang. Frekuensi belajar dibedakan dari frekuensi pergi ke perpustakaan.',`
まいにち にほんごを べんきょうしますか。|Apakah Anda belajar bahasa Jepang setiap hari?|
はい、まいにち べんきょうします。|Ya, saya belajar setiap hari.|
いつも としょかんで べんきょうしますか。|Apakah selalu belajar di perpustakaan?|
いいえ、いつも うちで べんきょうします。|Tidak, saya selalu belajar di rumah.|
としょかんへは いきますか。|Apakah Anda pergi ke perpustakaan?|
はい、ときどき いきます。|Ya, kadang-kadang saya pergi.|`,
['Seberapa sering Aoi pergi ke perpustakaan?','Kadang-kadang.','Setiap hari.','Tidak pernah.',5,'ときどき いきます','まいにち menerangkan kegiatan belajar, sedangkan ときどき menerangkan pergi ke perpustakaan.'],
['Kartu kebiasaan: Anda belajar setiap hari. Pilih kalimat dengan frekuensi yang tepat.','まいにち べんきょうします。','ときどき べんきょうします。','きのう べんきょうしました。','まいにち berarti setiap hari; ときどき hanya kadang-kadang.']);

add('8889bccf-484a-4fc2-84e0-46d4ebe93196',10,4,'cafe',
'Ren dan Claire membicarakan kebiasaan membaca dan menonton televisi. Claire sering membaca, tetapi sama sekali tidak menonton televisi.',`
よく ほんを よみますか。|Apakah Anda sering membaca buku?|
はい、よく よみます。|Ya, saya sering membaca.|senang
テレビも よく みますか。|Apakah Anda juga sering menonton televisi?|
いいえ、テレビは ぜんぜん みません。|Tidak, saya sama sekali tidak menonton televisi.|`,
['Bagaimana kebiasaan menonton televisi Claire?','Sama sekali tidak menonton.','Sering menonton.','Kadang-kadang menonton.',3,'ぜんぜん みません','ぜんぜん dengan bentuk negatif menyatakan sama sekali tidak.'],
['Kartu kebiasaan: Anda sama sekali tidak minum kopi. Pilih kalimat yang sesuai.','コーヒーは ぜんぜん のみません。','コーヒーは よく のみます。','コーヒーは ぜんぜん のみます。','ぜんぜん dipasangkan dengan のみません untuk menyatakan sama sekali tidak minum.']);

add('aaf4f358-d901-43c7-844b-904026e48aef',11,5,'cafe',
'Daniel dan Anna menentukan jumlah makanan untuk camilan bersama. Mereka memastikan jumlah roti dan kue sebelum membeli.',`
パンを いくつ かいますか。|Anda membeli berapa buah roti?|
みっつ かいます。|Saya membeli tiga.|
ケーキも みっつ かいますか。|Apakah kuenya juga membeli tiga?|
いいえ、ケーキは ふたつ かいます。|Tidak, kuenya membeli dua.|
パンは みっつ、ケーキは ふたつですね。|Roti tiga dan kue dua, ya.|
はい、そうです。|Ya, benar.|`,
['Berapa banyak kue yang akan dibeli Anna?','Dua.','Tiga.','Lima.',3,'ケーキは ふたつ かいます','Anna membetulkan jumlah kue menjadi dua; tiga adalah jumlah roti.'],
['Pesanan: lima lembar perangko. Pilih kalimat yang memakai jumlah dan satuan yang tepat.','きってを ごまい かいます。','きってを さんまい かいます。','きってを ごにん かいます。','ごまい menyatakan lima lembar; ごにん menghitung orang.']);

add('d672525e-13ed-415f-b957-cdcc119be178',11,6,'classroom',
'Anna dan Aoi memeriksa isi kelas sebelum kegiatan. Mereka membedakan jumlah orang dari jumlah buku yang tersedia.',`
きょうしつに がくせいが なんにん いますか。|Ada berapa pelajar di kelas?|
ふたり います。|Ada dua orang.|
ほんは なんさつ ありますか。|Ada berapa buku?|
さんさつ あります。|Ada tiga buku.|
ほんは さんさつですね。|Bukunya tiga, ya.|
はい、そうです。|Ya, benar.|`,
['Ada berapa pelajar di kelas?','Dua orang.','Tiga orang.','Satu orang.',1,'ふたり います','ふたり menghitung dua orang; さんさつ adalah jumlah buku.'],
['Kartu: di kelas ada tiga pelajar. Pilih kalimat keberadaan yang benar.','がくせいが さんにん います。','がくせいが さんさつ います。','がくせいが さんにん あります。','Pelajar dihitung dengan にん dan keberadaannya dinyatakan dengan います.']);

add('30947a2c-7434-48b3-9657-70d530790abd',11,7,'classroom',
'Hadi dan Claire menyiapkan kertas untuk pelajar di kelas. Mereka memastikan jumlah orang dan lembar kertas secara terpisah.',`
がくせいは なんにん いますか。|Ada berapa pelajar?|
さんにん います。|Ada tiga orang.|
かみは なんまい ありますか。|Ada berapa lembar kertas?|
ごまい あります。|Ada lima lembar.|
ごまいですね。ありがとうございます。|Lima lembar, ya. Terima kasih.|
はい。|Ya.|`,
['Berapa lembar kertas yang tersedia?','Lima lembar.','Tiga lembar.','Delapan lembar.',3,'ごまい あります','Pertanyaan なんまい dijawab dengan ごまい, lima lembar.'],
['Anda ingin menanyakan jumlah pelajar, bukan jumlah kertas. Pilih pertanyaan yang tepat.','がくせいは なんにん いますか。','がくせいは なんまい いますか。','がくせいは なんさつ いますか。','なんにん menanyakan jumlah orang; なんまい lembar dan なんさつ buku.']);

add('729d8d02-f77c-4816-8a50-6173775158e1',11,8,'cafe',
'Ren dan Daniel menghitung roti untuk camilan. Daniel mula-mula menyebut dua, lalu menyadari ada satu lagi dan membetulkan totalnya menjadi tiga.',`
パンは いくつ ありますか。|Ada berapa buah roti?|
ふたつ あります。|Ada dua buah.|
あそこにも ひとつ ありますよ。|Di sana juga ada satu, lho.|
ああ、みっつですね。|Oh, berarti tiga, ya.|kaget
はい、みっつです。|Ya, tiga.|
ありがとうございます。|Terima kasih.|senang`,
['Setelah dikoreksi, berapa jumlah seluruh roti?','Tiga buah.','Dua buah.','Satu buah.',3,'みっつですね','Dua roti yang mula-mula dihitung ditambah satu lagi menjadi みっつ, tiga.'],
['Gunakan hitungan umum つ untuk empat buah apel. Pilih kalimat yang sesuai.','りんごが よっつ あります。','りんごが みっつ あります。','りんごが ふたつ あります。','よっつ adalah empat dalam hitungan umum; みっつ tiga dan ふたつ dua.']);

// Some comprehension answers combine two facts; cite both turns explicitly.
for(const [grammarId,turnIndex,quote]of [
  ['b7874295-4a7e-471d-a29e-d316af9f2af9',5,'わたしのです'],
  ['636e2d7a-0c49-4522-ac49-16eb06f4b650',3,'すこし にがいです'],
  ['86fc3efd-ba51-4c80-a1bc-d6a368c54e05',1,'とても あつかったです'],
  ['eb47ef6b-a664-4f04-9785-d13b79b48384',1,'むずかしくなかったです'],
  ['029d0b2c-d19d-4c84-ab1d-20e764141823',1,'とても おいしいです'],
  ['1c2472f7-f031-4b70-b3ee-49ec6b3e1325',3,'とても おいしいです'],
  ['f59be5f1-13b6-4fa4-a331-54dc73d68cc9',3,'とても ゆうめいです'],
  ['6eabf61d-6690-46a6-a6f0-fede7682653e',1,'とても すきです'],
  ['a5ec89d1-9fd2-4b76-a225-b8edf9beeef8',1,'ベンチの したに ねこも いますよ'],
  ['eccb0635-72cb-43c2-a4c1-ac4c82450e3e',1,'えきの まえに あります'],
  ['a3cde031-f1b3-4982-8eea-b73d76a1fe1d',1,'つくえの したに あります'],
  ['73227354-5a76-40b6-b063-2cfb6dc6bf7d',2,'にほんごの ほんですか'],
  ['73227354-5a76-40b6-b063-2cfb6dc6bf7d',3,'はい'],
]) scenes.find(scene=>scene.grammarId===grammarId).questions[0].evidence.push({turnIndex,quote});

// Quiet scenes still get one meaningful visual reaction: recalling a detail,
// confirming a count, or smiling at useful information. Other turns stay calm.
for(const [grammarId,turnIndex,expression]of [
  ['3e3a2fa3-002e-41c1-9fa1-ee6d08d7775b',2,'berpikir'],
  ['78c220c4-3766-47c9-aa46-ff01e6056327',4,'berpikir'],
  ['4ac8518d-0765-483e-bc18-12c0863a16d5',2,'berpikir'],
  ['149e0564-0969-42fe-8f23-2bd73221e018',0,'senang'],
  ['eae83f3f-99d8-49f7-8ff4-bad7556c09dc',4,'senang'],
  ['7fc97164-76bc-4fda-8f25-684dba4852d9',2,'berpikir'],
  ['d5d836ae-9bf3-4891-9de1-a67671155fc5',3,'berpikir'],
  ['ea15dec5-3e3f-4596-8f64-a6cd901978e4',4,'senang'],
  ['08e35ed5-1ee5-46e9-b461-4e5d65329600',2,'berpikir'],
  ['8ccd8f29-3ad1-4c89-bde4-a77fec18d7ce',4,'berpikir'],
  ['963abb05-086a-4523-8e92-dabac46602d7',2,'berpikir'],
  ['19252097-8ff5-49f1-89ed-c6daf0854aba',4,'berpikir'],
  ['aaf4f358-d901-43c7-844b-904026e48aef',4,'berpikir'],
  ['d672525e-13ed-415f-b957-cdcc119be178',3,'berpikir'],
  ['30947a2c-7434-48b3-9657-70d530790abd',4,'senang'],
]) scenes.find(scene=>scene.grammarId===grammarId).turns[turnIndex].expression=expression;
