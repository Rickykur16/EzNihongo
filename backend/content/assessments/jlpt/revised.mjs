// Keep the published v3 authoring source/migration immutable. This revision
// resolves the 24 findings in the September 2026 editorial audit.
import {banks as original,bankRows,validateBank} from './index.mjs';
import {q,star,spoken,listen} from './helpers.mjs';
import {REVISED_JLPT_ASSESSMENT_VERSION} from '../../../src/chapter-assessment.js';
export {bankRows,validateBank};
export const revisions=new Map();
const put=(chapter,number,raw,reasons)=>{
  if(reasons.length!==raw.options.length-1)throw Error('Missing distractor rationale');
  revisions.set(`${chapter}:${number}`,{...raw,reasons:[raw.explanation,...reasons]});
};
put(4,22,listen('N: かばんについて、ただしい ものを えらんでください。\nA: その かばんは ハディさんのですか。\nB: いいえ、アンナさんのです。\nN: ただしい ものは どれですか。',q('Informasi mana yang benar?',['アンナさんの かばんです。','ハディさんの かばんです。','せんせいの かばんです。','アンナさんの ほんです。'],'B mengoreksi pemilik tas menjadi Anna.',2)),['Hadi disebut dalam dugaan yang ditolak.','Guru tidak disebut sebagai pemilik.','Benda yang dibicarakan tas, bukan buku.']);
put(5,13,star('Jadwal kelas: 09.00–12.00. クラスは',['くじ','から','じゅうにじ','まで'],'です。',2),['くじ adalah waktu mulai pada slot pertama.','から mengikuti waktu mulai pada slot kedua.','まで mengikuti waktu selesai pada slot keempat.']);
put(7,14,star('ここは とても',['しずかで','きれいな','まち','です'],'。',2),['しずかで menghubungkan sifat dan berada di awal.','きれいな langsung menerangkan まち.','です mengakhiri kalimat setelah kata benda.']);
put(8,7,q('A「ねこは どこに いますか。」B「へやに（　）。」',['います','あります','いきます','かえります'],'Pertanyaan menanyakan tempat kucing berada; jawabannya います.'),['あります digunakan untuk benda pada pola keberadaan ini.','いきます menyatakan pergi, bukan lokasi keberadaan yang ditanyakan.','かえります menyatakan pulang, bukan lokasi keberadaan.']);
put(9,6,q('「えきから がっこうまで いきます。」と おなじ いみの ぶんは どれですか。',['えきから がっこうへ いきます。','がっこうから えきへ いきます。','えきから ぎんこうへ いきます。','うちから がっこうへ いきます。'],'Asal tetap stasiun dan tujuan tetap sekolah.',2),['Asal dan tujuan terbalik.','Tujuan berubah menjadi bank.','Asal berubah menjadi rumah.']);
put(10,6,q('「まいあさ、うちで コーヒーを のみます。」と おなじ いみの ぶんは どれですか。',['まいにち、あさ うちで コーヒーを のみます。','まいにち、よる うちで コーヒーを のみます。','ときどき、あさ うちで コーヒーを のみます。','まいあさ、みせで コーヒーを のみます。'],'まいあさ berarti setiap hari pada pagi hari; tempat dan minuman juga tetap.',3),['Waktu berubah menjadi malam.','Frekuensi berubah menjadi kadang-kadang.','Tempat berubah dari rumah menjadi kedai.']);
put(12,4,q('A「あさ、なんじに おきますか。」B「ろくじに（　）。」',['おきます','ねます','かえります','おわります'],'A menanyakan waktu bangun; B menjawab bahwa ia bangun pukul enam.',3),['ねます berarti tidur, bukan bangun.','かえります berarti pulang; A tidak menanyakan kepulangan.','おわります berarti selesai; tidak menjawab waktu bangun.']);
put(12,5,q('A「よる、なんじに ねますか。」B「じゅういちじに（　）。」',['ねます','おきます','きます','かいます'],'A menanyakan waktu tidur; B menjawab tidur pukul sebelas.',3),['おきます berarti bangun, bukan tidur.','きます berarti datang; bukan kegiatan yang ditanyakan.','かいます berarti membeli; bukan kegiatan yang ditanyakan.']);
put(13,6,q('A「ここで たべてもいいですか。」B「はい、だいじょうぶです。」\nBさんの ことばと おなじ いみの ぶんは どれですか。',['ここで たべてもいいです。','ここで たべてはいけません。','ここに たべものは ありません。','ここで たべています。'],'Respons B memberi izin untuk makan di sini.',3),['Ini larangan, kebalikan izin B.','Ini menyatakan tidak ada makanan, bukan memberi izin.','Ini menyatakan kegiatan berlangsung, bukan memberi izin.']);
put(14,4,q('びょうきです。きょうは がっこうを（　）。',['やすみます','はいります','あいます','たちます'],'がっこうを やすみます berarti tidak masuk sekolah.'),['Masuk sekolah memakai に; bukan がっこうを はいります.','あいます menyatakan bertemu orang dengan に／と.','たちます berarti berdiri dan tidak membentuk ungkapan absen sekolah.']);
put(14,6,q('「きのうは がっこうへ いかなかった。」と おなじ いみの ぶんは どれですか。',['きのうは がっこうへ いきませんでした。','きのうは がっこうへ いきました。','あしたは がっこうへ いきません。','きょうは がっこうへ いきます。'],'いかなかった dan いきませんでした sama-sama negatif lampau; waktunya tetap kemarin.',1),['Afirmatif lampau menyatakan pergi, bukan tidak pergi.','Waktu berubah menjadi besok.','Waktu berubah menjadi hari ini dan tindakan menjadi afirmatif.']);
put(14,21,listen('N: Aさんは あした なにを もって いきますか。\nA: あしたは じしょを もって いきますか。\nB: じしょは もって こなくてもいいです。ノートは もって きてください。\nA: はい。ノートを もって いきます。じしょは もって いきません。\nN: Aさんは あした なにを もって いきますか。',q('Aさんは あした なにを もって いきますか。',['ノート','じしょ','かさ','しゃしん'],'A secara eksplisit memutuskan membawa catatan dan tidak membawa kamus.',3)),['A menyatakan tidak membawa kamus; ini bukan sekadar kesimpulan dari tidak wajib.','Payung tidak disebut sebagai barang yang akan dibawa.','Foto tidak disebut sebagai barang yang akan dibawa.']);
put(16,5,q('クラスは １ねんに12かいです。１がつから12がつまで、どの つきも みっかに あります。クラスは（　）あります。',['まいつき','まいにち','まいしゅう','まいあさ'],'Ada satu pertemuan pada tanggal tiga setiap bulan, total dua belas setahun.',3),['Setiap hari tidak cocok dengan jumlah dua belas pertemuan setahun.','Setiap minggu tidak cocok dengan jadwal tanggal tiga setiap bulan dan total dua belas.','Setiap pagi tidak cocok dengan jumlah dua belas pertemuan setahun.']);
put(16,6,q('「クラスは どようびに あります。どの しゅうも おなじです。」と おなじ いみの ぶんは どれですか。',['クラスは まいしゅう どようびに あります。','クラスは こんしゅうだけ あります。','クラスは まいしゅう にちようびに あります。','クラスは まいにち あります。'],'どのしゅうもおなじ mempertahankan jadwal Sabtu pada setiap minggu.',3),['Hanya minggu ini bertentangan dengan setiap minggu.','Hari berubah menjadi Minggu.','Setiap hari bukan jadwal khusus Sabtu.']);
put(16,11,q('クラスは（　）どようびに あります。',['まいしゅう','なんようび','なんがつ','なんにち'],'まいしゅうどようび menyatakan setiap Sabtu.',3),['なんようび menanyakan hari, bukan menerangkan pengulangan sebelum どようび.','なんがつ menanyakan bulan, bukan frekuensi minggu.','なんにち menanyakan tanggal, bukan frekuensi minggu.']);
const reading16=original.find(b=>b.chapter===16).forms.A[17].passage.replace('わたしは','アンナさんは').replace('ごはんの あとで、うちへ かえります。','アンナさんは ごはんの あとで、うちへ かえります。');
put(16,18,{...q('アンナさんは こんしゅうの どようび、ごご いちじに どこへ いきますか。',['がっこうの となりの みせ','としょかん','せんせいの うち','がっこうの へや'],'Anna pergi makan di kedai sebelah sekolah pada pukul satu.',2),passage:reading16},['Minggu ini Anna tidak pergi ke perpustakaan.','Rumah guru tidak disebut sebagai tempat makan.','Kelas berakhir sebelum kegiatan makan di kedai.']);
put(20,6,q('「にほんへ いったことが ありません。らいねん いきます。」と おなじ いみの ぶんは どれですか。',['らいねん、はじめて にほんへ いきます。','きょねん、はじめて にほんへ いきました。','らいねん、また にほんへ いきます。','らいねんは、にほんへ いきません。'],'Belum pernah ke Jepang dan akan pergi tahun depan berarti kunjungan pertama tahun depan.',1),['Mengatakan sudah pergi tahun lalu, bertentangan dengan belum pernah.','また menyatakan pergi lagi, bertentangan dengan belum pernah.','Menyatakan tidak pergi tahun depan, bertentangan dengan rencana pada soal.']);
put(20,10,q('この かばんは たかいです（　）、とても べんりです。',['が','を','まで','に'],'が menghubungkan dua penilaian dengan kontras harga mahal dan kegunaan.',3),['を tidak menghubungkan dua klausa setelah です.','まで menandai batas, bukan penghubung setelah です pada kalimat ini.','に tidak menghubungkan dua klausa setelah です.']);
put(6,23,spoken('N: Aさんは レストランの おきゃくさんです。Aさんの りょうりは とても おいしいです。\nB: りょうりは どうですか。\nN: Aさんは なんと いいますか。',['とても おいしいです。','とても いそがしいです。','とても さむいです。'],'A adalah pelanggan yang menilai rasa hidangannya, bukan koki menilai masakannya sendiri.',3,true),['いそがしい menilai kesibukan, bukan rasa makanan.','さむい menilai dinginnya cuaca/keadaan, bukan rasa makanan.']);
put(11,6,q('「つくえの うえに りんごが ふたつ、かばんの なかに みっつ あります。」と おなじ いみの ぶんは どれですか。',['りんごは つくえの うえに ２つ、かばんの なかに ３つ あります。','りんごは つくえの うえに ３つ、かばんの なかに ２つ あります。','りんごは つくえの うえに ２つ、かばんの なかに ２つ あります。','りんごは つくえの うえに ３つ、かばんの なかに ３つ あります。'],'Bacaan ふたつ dan みっつ sesuai angka ２つ dan ３つ; kedua kelompok tetap sama.',3),['Jumlah pada kedua lokasi terbalik.','Jumlah di tas berubah menjadi dua.','Jumlah di meja berubah menjadi tiga.']);
put(15,6,q('（みせで、のみものを たのみます。）\n「コーヒーに します。」と おなじ いみの ことばは どれですか。',['コーヒーを おねがいします。','コーヒーは いかがですか。','コーヒーは ありません。','コーヒーは のみません。'],'Dalam konteks memesan minuman, memilih kopi menyampaikan pesanan kopi.',2),['Ini ucapan menawarkan kopi, bukan memesan.','Ini menyatakan kopi tidak tersedia.','Ini menyatakan tidak minum kopi.']);
put(17,14,star('A「',['どんな','スポーツ','が','すき'],'ですか。」B「テニスです。」',3),['どんな menerangkan jenis スポーツ pada slot pertama.','スポーツ mengikuti どんな pada slot kedua.','すき berada setelah が pada slot keempat.']);
put(18,23,spoken('N: あかい かばんは にキロ、くろい かばんは ごキロです。\nB: どちらが かるいですか。\nN: Aさんは なんと いいますか。',['あかい かばんの ほうが かるいです。','くろい かばんの ほうが かるいです。','おなじです。'],'Tas merah dua kilogram lebih ringan daripada tas hitam lima kilogram.',2,true),['Tas hitam lebih berat, bukan lebih ringan.','Berat kedua tas berbeda.']);
put(18,14,star('この みせでは',['どの','かばん','が いちばん','やすい'],'ですか。',3),['どの langsung menerangkan かばん.','かばん adalah benda yang dibandingkan.','やすい mengikuti frasa がいちばん.']);

export const banks=original.map(old=>{
 const bank=structuredClone(old);bank.version=REVISED_JLPT_ASSESSMENT_VERSION;
 bank.forms.A=bank.forms.A.map((item,i)=>{
   const raw=revisions.get(`${bank.chapter}:${i+1}`);
   item.id=item.id.replace('-a-jlpt-','-a-jlpt-r2-');
   if(!raw)return item;
   const offset=(i+bank.chapter)%raw.options.length;
   const rotate=a=>[...a.slice(offset),...a.slice(0,offset)];
   const options=rotate(raw.options),answer=(raw.options.length-offset)%raw.options.length;
   for(const key of ['passage','audioScript','ordered','starPosition','spokenChoices','imageUrl'])delete item[key];
   Object.assign(item,{prompt:raw.prompt,options:raw.audioOptions?['1ばん','2ばん','3ばん']:options,answer,explanation:raw.explanation,
     objective:`goal${raw.goal}`,distractorReasons:rotate(raw.reasons)});
   if(raw.passage)item.passage=raw.passage;
   if(raw.ordered)Object.assign(item,{ordered:raw.ordered,starPosition:raw.position});
   if(raw.audioScript)item.audioScript=raw.audioScript;
   if(raw.audioOptions){item.spokenChoices=options;item.audioScript+='\n'+options.map((o,j)=>`N: ${['いちばん','にばん','さんばん'][j]}。\n${raw.imageUrl?'A':'B'}: ${o}`).join('\n');}
   if(raw.imageUrl)item.imageUrl=`/assets/assessments/b${bank.chapter}-r2.svg`;
   return item;
 });
 validateBank(bank);return bank;
});
