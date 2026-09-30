// Additional transfer questions for chapters with fewer than five core cards.
const q=(prompt,options,explanation,goal)=>({prompt,options,answer:options[0],explanation,goal});
export const grammarExtra={
4:[
 q('Apa maksud 「ここから 山が 見えます。」?',['Gunung terlihat dari tempat ini.','Saya diizinkan melihat gunung.','Saya sedang berlatih melihat gunung.'],'見える menyatakan gunung tertangkap oleh penglihatan dari tempat itu, bukan izin atau latihan.',2),
 q('Piano belum bisa dimainkan oleh Mika. Pilih kalimat yang sesuai.',['ミカさんは まだ ピアノを ひく ことが できません。','ミカさんは もう ピアノを ひく ことが できました。','ミカさんは ピアノの 音が 聞こえません。'],'ことができません menyatakan belum mampu melakukan kegiatan; 聞こえません hanya membahas pendengaran.',1),
],
6:[
 q('カメラを 家に わすれて しまいました。Pembicara sedang menyatakan apa?',['Penyesalan karena kameranya tertinggal.','Rencana meninggalkan kamera nanti.','Percobaan menggunakan kamera.'],'てしまいました dapat menyampaikan penyesalan atas hasil yang sudah terjadi.',2),
 q('Teman membantu mencari tas yang hilang dan akhirnya tas ditemukan. Pilih reaksi lega.',['かばんが 見つかって、よかったです。','かばんが 見つからなくて、よかったです。','かばんを さがして みたいです。'],'Tas ditemukan adalah hasil yang diharapkan, sehingga klausa positif + てよかった sesuai konteks.',3),
],
7:[
 q('Pintu tadinya tertutup. Seseorang membukanya. Pilih laporan keadaan pintu sekarang.',['ドアが 開いて います。','ドアが 閉まって います。','ドアが 開けます。'],'開く intransitif dan が menandai pintu; 開いています menyatakan keadaan hasil.',2),
 q('Besok ada tamu. Hari ini Anda membersihkan kamar sebagai persiapan. Pilih kalimat yang paling sesuai.',['きょう、へやを そうじして おきます。','きょう、へやが そうじして あります。','きょう、へやを そうじて おきます。'],'ておきます menyatakan persiapan; objek tindakan そうじする memakai を, dan bentuk て-nya そうじして.',3),
],
13:[
 q('この 道を まっすぐ 行く（　）、駅が あります。Pilih bentuk untuk hasil yang ditemukan di ujung jalan.',['と','ながら','ために'],'と dapat menyatakan hasil yang ditemukan setelah mengikuti arah; dua pilihan lain mengubah hubungan klausa.',1),
 q('Apa yang disampaikan oleh 「あした、雨が ふらないと いいですね。」?',['Besok semoga tidak hujan.','Besok pasti tidak hujan.','Kemarin tidak hujan.'],'といいですね menyatakan harapan, bukan kepastian atau laporan lampau.',3),
],
14:[
 q('時間が あれ（　）、図書館へ 行きます。',['ば','ならばと','たり'],'ある menjadi あれば pada bentuk syarat ば.',1),
 q('A「京都へ 行きたいです。」B「京都へ 行く（　）、春が いいですよ。」',['なら','ながら','までに'],'なら menanggapi topik/rencana yang baru disebut A, lalu memberi saran.',2),
 q('Kemarin tidak membawa payung, lalu kehujanan. Pilih penyesalan yang sesuai.',['かさを 持って 行けば よかったです。','かさを 持って 行かなければ よかったです。','かさを 持って 行くなら いいです。'],'Penyesalannya adalah tidak membawa, sehingga tindakan yang diharapkan dinyatakan positif + ばよかった.',3),
 q('Kemarin membeli tas mahal dan kini menyesal telah membelinya. Pilih kalimatnya.',['あの かばんを 買わなければ よかったです。','あの かばんを 買えば よかったです。','あの かばんを 買ったら どうですか。'],'なければよかった menyatakan seandainya tidak melakukan tindakan yang sudah terjadi.',3),
],
17:[
 q('私は 姉に 花を あげました。Siapa menerima bunga?',['姉','私','先生'],'Pada 私は姉にあげました, 私 adalah pemberi dan 姉に adalah penerima.',1),
 q('私は 兄から 本を もらいました。Kalimat mana menyatakan kejadian yang sama?',['兄が 私に 本を くれました。','私が 兄に 本を あげました。','兄は 私から 本を もらいました。'],'もらう memandang kejadian dari penerima; くれる memandangnya dari pemberi kepada pembicara.',2),
 q('Teman memberikan pulpen kepada Anda. Lengkapi: 友だちが 私に ペンを（　）。',['くれました','あげました','もらいました'],'Pemberian dari teman kepada pembicara memakai くれる.',3),
 q('私は 妹に 本を あげました。Kalimat mana menyatakan kejadian yang sama dari sudut pandang adik?',['妹は 私から 本を もらいました。','妹は 私に 本を あげました。','私は 妹から 本を もらいました。'],'妹 menjadi penerima/topik dan 私から menjadi sumber saat menggunakan もらう.',2),
],
};
