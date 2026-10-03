import {namedBanks,validateNamedBank} from './names.mjs';

// Keep historical imports immutable: migrations 194–198 and completed attempts
// must remain reproducible. This revision edits the current question bank only.
export const curriculumBanks=structuredClone(namedBanks);
export const scopeChanges=[];
function edit(level,match,reason,change) {
 const rows=curriculumBanks.find(b=>b.level===level).rows.filter(q=>typeof match==='string'?JSON.stringify(q).includes(match):match(q));
 if(!rows.length)throw Error('Scope edit has no target: '+match);
 for(const q of rows){change(q);q.assessment_meta.scopeRevision='curriculum-scope-v1';scopeChanges.push({key:q.assessment_meta.key,reason});}
}
function replace(q,from,to) {
 const walk=v=>typeof v==='string'?v.replaceAll(from,to):Array.isArray(v)?v.map(walk):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,walk(x)])):v;
 Object.assign(q,walk(q));
}
function swaps(q,entries){for(const [a,b]of entries)replace(q,a,b);}
function explain(q,text,chapters){q.explanation=text;q.assessment_meta.distractorReasons=q.options.map((o,i)=>o.is_correct?text:`Pilihan “${q.assessment_meta.spokenChoices?.[i]||o.option_text}” tidak sesuai konteks. ${text}`);if(chapters)q.assessment_meta.curriculumChapters=chapters;}
function choices(q,key,wrong,text,chapters){let i=0;q.options.forEach(o=>{o.option_text=o.is_correct?key:wrong[i++];});explain(q,text,chapters);}
function speech(q,script,key,wrong,text,chapters){let i=0;q.assessment_meta.spokenChoices=q.options.map(o=>o.is_correct?key:wrong[i++]);q.audio_script=script+'\n'+q.assessment_meta.spokenChoices.map((s,j)=>`N: ${['いちばん','にばん','さんばん'][j]}。\n男の人: ${s}`).join('\n');explain(q,text+' Jawaban audio: “'+key+'”.',chapters);}
const at=key=>q=>q.assessment_meta.key===key;

edit('n5','電気','Use taught transport/school words.',q=>replace(q,'電気','学校'));
edit('n5','くつした','Use footwear already introduced in Bab 4.',q=>replace(q,'くつした','くつ'));
edit('n5','ぞうきん','Use Bab 4 classroom objects with Bab 13 requests.',q=>{q.question='なまえを 書きます。（　）を とって ください。';choices(q,'えんぴつ',['かさ','ざっし','きっぷ'],'Untuk menulis nama, benda yang diperlukan ialah pensil, えんぴつ.',[4,13]);});
edit('n5','一日中','Express duration with taught から〜まで.',q=>replace(q,'一日中','あさから ばんまで'));
edit('n5','りんごを 二人に あげます。','Avoid N4 giving verbs in N5 distractors.',q=>swaps(q,[['りんごを 二人に あげます。','りんごを 二つ 買いました。'],['りんごは 二つ とも いりません。','りんごは いりません。']]));
edit('n5','たなかさんほど','N5 Bab 18 comparison uses より; ほど is N4 Bab 20.',q=>{replace(q,'やまださんは たなかさんほど せが 高くないです。','やまださんは たなかさんより せが ひくいです。');explain(q,'田中 lebih tinggi daripada 山田, jadi 山田 lebih pendek daripada 田中. Kedua kalimat memakai より.',[18]);});
edit('n5','小さすぎます','Avoid N4 すぎる and adjective nominalization.',q=>{q.question='この くつは 小さいです。もう すこし（　）くつは ありますか。';replace(q,'うすい','あたらしい');explain(q,'Sepatu ini kecil, sehingga pembeli meminta sepatu yang lebih besar: 大きい.',[6]);});
edit('n5','中だけに','Avoid N4 だけ.',q=>replace(q,'中だけに','中に'));
edit('n5','日本語を（　）ことが','Vことができる is N4 Bab 4; use N5 Bab 19 つもり.',q=>{q.question='アリさんは、日本語を（　）つもりです。';explain(q,'Rencana memakai bentuk kamus + つもりです: 話すつもりです.',[14,19]);});
edit('n5','ばんごはんを（　）あとで','Use N5 Bab 12 てから instead of N4 たあとで.',q=>{q.question='きのう、ばんごはんを（　）から、さんぽしました。';choices(q,'食べて',['食べる','食べた','食べます'],'Urutan kegiatan memakai Vてから: 食べてから、さんぽしました.',[12]);});
edit('n5',q=>q.assessment_meta.ordered?.includes('ことが'),'Replace N4 ability sentence with N5 desire.',q=>{const ordered=['日本語を','もっと','話し','たいです'];q.assessment_meta.ordered=ordered;choices(q,'話し',['日本語を','もっと','たいです'],'Urutan: 日本語をもっと話したいです。★ adalah 話し, pangkal ます sebelum たい.',[19]);});
edit('n5',q=>q.assessment_meta.form==='A'&&q.assessment_meta.itemType==='text_grammar','Keep all four linked blanks within N5 grammar.',q=>{q.passage='日よう日に 友だちと 海へ 行きました。いえから 海まで 電車で 一時間（①）。朝は 雨でした。（②）、海では いい 天気でした。海で 写真を（③）から、昼ごはんを 食べました。とても 楽しかったです。また 友だちと（④）たいです。';if(q.question.startsWith('②'))replace(q,'そしても','そして');if(q.question.startsWith('③'))choices(q,'とって',['とる','とった','とります'],'写真をとってから berarti sesudah mengambil foto; memakai bentuk て.',[12]);});
edit('n5',q=>q.assessment_meta.form==='B'&&q.assessment_meta.itemType==='text_grammar','Replace untaught purpose に行く and 足りる with taught shopping/time patterns.',q=>{q.passage='わたしの いえの 近くに 小さい パン屋が あります。朝 七時（①）開いて います。わたしは 毎朝 そこで パンを 二つ（②）。店の 人は いつも 親切です。きのうは 日よう日でしたから、店は（③）。パンを 買いませんでした。きょうは 店へ 行きます。パンと 牛乳を 買ってから、学校へ（④）。';if(q.question.startsWith('③'))choices(q,'休みでした',['休みでは ありませんでした','休みましょう','休みませんか'],'Kemarin hari libur, sehingga toko tutup: 休みでした. Bentuk lampau kata benda memakai でした.',[7,10]);if(q.question.startsWith('④'))choices(q,'行きます',['行きました','行って ください','行きませんでした'],'Rencana hari ini setelah berbelanja memakai 行きます; perjalanan belum dilakukan.',[10,12]);});
edit('n5','店を 出る とき','Avoid N4 とき and だけ in connected reading.',q=>{swaps(q,[['店を 出る とき あめでした。かさは 一つだけでしたから','店を 出ました。あめでした。かさは 一つでしたから'],['二人は 店を 出る とき、どうしましたか。','二人は 店を 出ました。それから、どうしましたか。'],['いもうとだけ かさを つかいました。','わたしは かさを つかいませんでした。']]);});
edit('n5','休みですから 入れません','Avoid N4 potential form in distractor.',q=>replace(q,'休みですから 入れません','休みです'));
edit('n5',at('n5-a-052'),'Use adjective sentences, not N4 こと nominalization.',q=>{replace(q,'新しい いえの いい ところは 何ですか。','新しい いえは どうですか。');choices(q,'えきに ちかくて べんりです。',['おおきくて べんりです。','しずかで べんりです。','安くて べんりです。'],'Rumah kecil dan agak berisik, tetapi dekat stasiun dan praktis.',[6,7]);});
edit('n5',at('n5-a-057'),'Use taught drinking verb as distractor.',q=>replace(q,'水を あげます。','水を 飲みます。'));
edit('n5',at('n5-a-058'),'Replace untaught visit greetings with Bab 13 permission.',q=>{q.image_url='/assets/final-exams/visit-names-v1.svg';speech(q,'N: あやさんは 教室に 入りたいです。先生に 何と 言いますか。','入っても いいですか。',['入っていますか。','入らないで ください。'],'Untuk meminta izin masuk, gunakan 入ってもいいですか.',[13]);});
edit('n5',at('n5-b-058'),'Replace untaught visit greetings with Bab 13 permission.',q=>{q.image_url='/assets/final-exams/visit-names-v1.svg';speech(q,'N: あやさんは 家へ 帰りたいです。先生に 何と 言いますか。','帰っても いいですか。',['帰っていますか。','帰らないで ください。'],'Untuk meminta izin pulang, gunakan 帰ってもいいですか.',[13]);});
edit('n5',at('n5-a-059'),'Use N5 desire and natural permission word order.',q=>swaps(q,[['手つだいたいです','はこを いっしょに もちたいです'],['もっても いいですか、わたしの はこを。','わたしの はこを もっても いいですか。']]));
edit('n5','ごちそうさまですか。','Use already taught school vocabulary.',q=>replace(q,'ごちそうさまですか。','あしたは 学校です。'));
edit('n5','いただきます。','Use taught thanks/request expression.',q=>replace(q,'いただきます。','おねがいします。'));
edit('n5','どういたしまして。','Use a taught but contextually wrong response.',q=>replace(q,'どういたしまして。','いくらですか。'));

edit('n5',at('n5-b-039'),'Avoid N4 benefactive and noun-modifying clauses.',q=>{q.passage='リンさんへ\nきょうは 先に 帰ります。あなたの 本は つくえの 上に 置きました。ノートは まだ 使って いますから、あした 返します。\nアリ';q.question='アリさんは きょう 何を 返しますか。';replace(q,'何も 返して もらいません','何も 返しません');});
edit('n5',at('n5-b-040'),'Avoid N4 ことができる in schedule reading.',q=>{q.passage='【パン屋から】\nあしたは 店の そうじを しますから、午前中は 休みます。午後 二時から 六時まで パンを 売ります。';q.question='あした、この 店で パンを 買います。何時に 行きますか。';});
edit('n5',q=>['n5-b-041','n5-b-042'].includes(q.assessment_meta.key),'Use taught travel vocabulary and avoid N4 てくれる.',q=>{q.passage='土よう日に 兄と 海へ 行きました。いえを 九時に 出ました。バスで 行きたかったですが、バスが 来ませんでしたから、電車で 行きました。海には 十時に つきました。二人で 海で 泳ぎました。昼は パンを 食べました。兄が 朝 作りました。午後は 少し 雨が ふりましたから、早く 帰りました。';swaps(q,[['バスが なかなか 来なかったから','バスが 来なかったから'],['おにぎり','パン'],['動物園の 人','店の 人']]);if(q.assessment_meta.key.endsWith('042'))explain(q,'「兄が朝作りました」とあるので、パンを作った人は兄です。 Kakak yang membuat rotinya.',[10,20]);});
edit('n5',at('n5-b-043'),'Avoid N4 potential and だけ.',q=>swaps(q,[['二週間 使えます','二週間 使います'],['一週間だけ 使えます','一週間 使います']]));
edit('n5',at('n5-b-044'),'Use Bab 11 plate instead of untaught cup.',q=>{swaps(q,[['コップ','おさら'],['中に 水が 入って いますから、気を つけて ください。','おねがいします。']]);explain(q,'Dialog menyetujui membawa piring dari meja ke dapur.',[8,11,13]);});
edit('n5',at('n5-b-045'),'Replace N4 てある and untaught postbox with Bab 12 渡す.',q=>{q.audio_script='N: ゆみさんは この あと 何を しますか。\nN: 女の人は ゆみさんです。男の人は たろうさんです。\n女の人: この 手紙、どうしますか。\n男の人: もう 書きましたから、先生に わたして ください。\nN: ゆみさんは この あと 何を しますか。';q.question='ゆみさんは この あと 何を しますか。';choices(q,'手紙を 先生に わたします。',['切手を 買います。','手紙を 書きます。','切手を はります。'],'Surat sudah ditulis. Tindakan berikutnya menyerahkannya kepada guru.',[12,13]);});
edit('n5','映画館','Use taught station vocabulary.',q=>replace(q,'映画館','駅'));
edit('n5',at('n5-b-049'),'Avoid N4 clause and 集める.',q=>{swaps(q,[['ノートを 集めます','ノートを 先生に わたします'],['先生が 言った ところを 読みます。','本を 読みます。'],['ここを 読んで','この 本を 読んで']]);});
edit('n5',at('n5-b-050'),'Use taught placement request instead of N4 並べる.',q=>{swaps(q,[['はしを 並べて','はしを テーブルに おいて'],['はしを 並べます','はしを テーブルに おきます']]);});
edit('n5',at('n5-b-054'),'Use N5 buying verb instead of N4 giving.',q=>{replace(q,'あげました','買いました');explain(q,'Tahun ini membeli bunga; tahun lalu membuat kue.',[10,16]);});
edit('n5',at('n5-b-055'),'Avoid N4 conditional なら.',q=>replace(q,'二つなら 二百円です','二つで 二百円です'));
edit('n5',at('n5-b-056'),'Replace untaught language distractor.',q=>replace(q,'英語だけで 話します。','話しません。'));
edit('n5',at('n5-b-057'),'Avoid N4 giving verb in situation.',q=>replace(q,'友だちに 水を あげます','友だちに 水を わたします'));
edit('n5',at('n5-b-059'),'Use Bab 13 request and taught 持つ.',q=>speech(q,'N: あやさんは 重い はこを 持って います。友だちに おねがいします。何と 言いますか。','この はこを 持って ください。',['この はこを 持ちましたか。','この はこを 持ちましょうか。'],'Meminta teman membawa kotak memakai 持ってください.',[13]));
edit('n5',at('n5-b-060'),'Avoid N4 adjective nominalization.',q=>{swaps(q,[['大きいの','大きい シャツ'],['小さいの','小さい シャツ']]);});
edit('n5',at('n5-b-061'),'Avoid N4 聞こえる; use taught わかる.',q=>{q.image_url='/assets/final-exams/repeat-names-v1.svg';speech(q,'N: あやさんは 先生の ことばが よく わかりませんでした。もう 一度 聞きたいです。何と 言いますか。','すみません、もう 一度 言って ください。',['すみません、よく わかりました。','すみません、本を 買って ください。'],'Permintaan mengulang ucapan memakai もう一度言ってください.',[13]);});
edit('n5',at('n5-b-067'),'Use taught classroom request and responses.',q=>speech(q,'女の人: あした、本を 持って 来て ください。','はい、わかりました。',['いいえ、本は いくらですか。','はい、きのうは 日よう日です。'],'Permintaan membawa buku besok dijawab persetujuan: はい、わかりました.',[13]));

// N4 may draw on completed N5 lessons as well as N4 lessons.
edit('n4','休まず','Use taught ないで instead of ず.',q=>replace(q,'休まず','休まないで'));
edit('n4','作らず','Use taught ないで instead of ず.',q=>replace(q,'作らず','作らないで'));
edit('n4','分からず','Use taught negative connective instead of ず.',q=>replace(q,'分からず','分からなくて'));
edit('n4','それなのにので','Replace invented connective with taught それから.',q=>replace(q,'それなのにので','それから'));
edit('n4','準番','Use actual taught words for orthography distractors.',q=>swaps(q,[['準番','運動'],['用備','勉強'],['順美','旅行']]));
edit('n4','【きかい】','Use taught 教室 as the spelling target.',q=>{q.question='ここは 日本語の【きょうしつ】です。';choices(q,'教室',['学校','会社','図書館'],'きょうしつ ditulis 教室, ruang kelas.',[15]);});
edit('n4','特列','Replace pseudo-compounds with taught adjectives.',q=>swaps(q,[['特列','親切'],['持別','大切'],['特利','便利']]));
edit('n4','予走','Replace pseudo-compounds with taught nouns.',q=>swaps(q,[['予走','旅行'],['用定','約束']]));
edit('n4','実行','Use taught school spelling as distractor.',q=>replace(q,'実行','学校'));
edit('n4','めったに','Use frequency vocabulary introduced in N5.',q=>{q.question='あの 人は 毎日 早く 来ます。一度も 遅れた ことが ありません。（　）遅れません。';choices(q,'ぜんぜん',['いつも','ときどき','よく'],'一度も遅れたことがない berarti tidak pernah terlambat; ぜんぜん dipasangkan dengan negatif.',[3]);});
edit('n4','絶対に','Use N4 Bab 5 必ず and familiar adverbs.',q=>{choices(q,'必ず',['ときどき','ゆっくり','だんだん'],'Janji penting harus selalu diingat. 必ず忘れないでください menekankan agar tidak lupa.',[5,16]);});
for(const [a,b,why]of [
 ['書類','紙','Use taught paper vocabulary.'],['印刷する','書く','Use taught writing verb.'],['実際に ','','Remove unnecessary untaught adverb.'],['一度に ','','Remove unnecessary untaught adverb.'],
 ['グループで','人で','Use taught person counter.'],['配る','わたす','Use N5 渡す.'],['配りましょう','わたしましょう','Use N5 渡す.'],['書き直す','もう 一度 書く','Use taught repetition expression.'],['見せる','みせる','Use reading provided in grammar examples.'],['見せて','みせて','Use reading provided in grammar examples.'],['送り返す','店に 返す','Use taught return verb.'],['早口で','早く','Use taught adverb.'],['職員室','教室','Use taught classroom vocabulary.'],['エプロン','タオル','Use N5 Bab 4 towel.'],['背景の 色','紙の 色','Use taught paper/color vocabulary.'],['修理して','直して','Use N4 Bab 18 直す.'],['せっかく ','','Remove untaught adverb.'],['申し訳ありません','すみません','Use taught apology.'],['申し訳なくて、遅れて ください。','あしたも 遅れて ください。','Use familiar words for wrong response.'],['お米を 炊く','ごはんを 作る','Use taught cooking verb.'],['お米は どうしますか','ごはんは どうしますか'],['もう 炊いて あります','もう 作って あります'],
 ])edit('n4',a,why||'Use taught vocabulary.',q=>replace(q,a,b));
edit('n4',at('n4-a-058'),'Replace untaught machine/projector words with familiar computer.',q=>{swaps(q,[['プロジェクター','パソコン'],['機械','パソコン']]);explain(q,'先に meminta memeriksa apakah komputer dapat digunakan sebelum membagikan kertas.',[7,19]);});
edit('n4',at('n4-a-062'),'Replace untaught web process with a clear phone-first process.',q=>{q.audio_script='N: ゆみさんは まず 何を しますか。\nN: 女の人は ゆみさんです。男の人は たろうさんです。\n女の人: シャツが 小さかったんですが、大きい シャツに 変えてもらえますか。\n男の人: はい。まず 店に 電話して ください。その 後で シャツを 店に 返して ください。\nN: ゆみさんは まず 何を しますか。';q.question='ゆみさんは まず 何を しますか。';choices(q,'店に 電話する。',['シャツを 店に 返す。','新しい シャツを 買う。','店へ 行く。'],'Instruksi pertama menelepon toko; mengembalikan baju dilakukan setelahnya.',[3,18]);});
edit('n4',at('n4-a-066'),'Replace untaught hourly-pay vocabulary without changing listening inference.',q=>{swaps(q,[['時給は 前より 低いんですが','仕事の 時間は 前より 長いんですが'],['時給が 高いから。','仕事の 時間が 短いから。']]);});
edit('n4','見た目','Use taught color adjective as appearance detail.',q=>{replace(q,'見た目','色');explain(q,'Warna tas disukai, tetapi tas terasa berat ketika diisi, sehingga tas lama digunakan lagi.',[1,9]);});
edit('n4',at('n4-b-059'),'Replace file/address/printing jargon with familiar writing task.',q=>{q.audio_script='N: はなさんは 作文を 出す 前に 何を しますか。\nN: 女の人は はなさんです。男の人は ひろしさんです。\n女の人: 先生、作文は ここに 置けば いいですか。\n男の人: ええ。でも 出す 前に、紙に 自分の 名前を 書いて ください。名前が ないと、だれの 作文か 分かりませんから。\nN: はなさんは 作文を 出す 前に 何を しますか。';q.question='はなさんは 作文を 出す 前に 何を しますか。';choices(q,'紙に 自分の 名前を 書く。',['作文を もう 一度 書く。','紙を 買う。','先生の 名前を 聞く。'],'Sebelum menyerahkan karangan, tulis nama sendiri pada kertas.',[3,19]);});
edit('n4',q=>['n4-b-056','n4-b-057'].includes(q.assessment_meta.key),'Replace web-only registration and untaught equipment with familiar instructions.',q=>{q.passage='【週末の 教室】\n料理：土曜 10:00〜12:00／1回 1,500円／タオルを 持って 来て ください。\n写真：土曜 14:00〜16:00／1回 1,000円／カメラを 持って 来て ください。\n絵：日曜 10:00〜12:00／1回 800円／道具は 200円です。\n教室の 二日前までに 電話で 申し込んで ください。';if(q.assessment_meta.key.endsWith('057'))choices(q,'木曜日までに 電話で 申し込み、タオルを 持って 行く。',['金曜日に 電話で 申し込み、カメラを 持って 行く。','土曜日に 行って、申し込む。','木曜日までに 電話で 申し込み、カメラを 持って 行く。'],'Dua hari sebelum Sabtu ialah Kamis. Daftar lewat telepon dan bawa handuk untuk kelas memasak.',[3,16,19]);});
edit('n4','ウェブサイト','Use familiar reception/phone registration.',q=>replace(q,'受付 または ウェブサイト（電話では できません）','受付 または 電話'));

edit('n5','だけ','Remove N4-only limiting particle from options.',q=>replace(q,'だけ',''));
edit('n5','歩くと 四十分です','Use taught means-of-transport で.',q=>replace(q,'歩くと 四十分です','歩いて 四十分です'));
edit('n5','黒いのは','Avoid adjective nominalization in audio.',q=>replace(q,'黒いのは','黒い かばんは'));
edit('n5',at('n5-a-066'),'Use taught responses and align explanation with revised audio.',q=>speech(q,'女の人: コーヒーは いかがですか。','ありがとうございます。おねがいします。',['何時ですか。','きのうは 学校へ 行きました。'],'Tawaran kopi diterima dengan ucapan terima kasih dan おねがいします.',[3,15]));
edit('n4','四人の 人で','Keep natural counter expression after removing group loanword.',q=>{swaps(q,[['四人の 人で','四人で'],['人で 料理を 作りました','四人で 料理を 作りました'],['一人ずつ 違う 国へ','一人で 違う 国へ']]);});
edit('n4',at('n4-a-051'),'Keep paper preparation distractor grammatical.',q=>{swaps(q,[['書く 必要は ありません','買う 必要は ありません'],['紙を 書く','紙を 買う']]);});
edit('n4',at('n4-b-064'),'Avoid untaught printing verb.',q=>replace(q,'これで 印刷しても','このまま 使っても'));
edit('n4','まとめ','Use taught sentence noun in presentation task.',q=>replace(q,'まとめ','文'));
edit('n5','ひろい','Use the taught size adjective.',q=>replace(q,'ひろい','おおきい'));
edit('n5','日にち','Use the taught time noun as distractor.',q=>replace(q,'日にち','時間'));
edit('n5','買いもの','Use the spelling shown in lesson vocabulary.',q=>replace(q,'買いもの','買い物'));
edit('n5','ええ、','Use the taught affirmative response.',q=>replace(q,'ええ、','はい、'));
edit('n4','ポスト','Use familiar bag noun in incorrect usage example.',q=>replace(q,'ポスト','かばん'));
edit('n4','言葉','Use kana for vocabulary taught as ことば.',q=>replace(q,'言葉','ことば'));
edit('n4','ごめんなさい','Use the taught apology.',q=>replace(q,'ごめんなさい','すみません'));
edit('n4','大きな','Use the taught adjective form.',q=>replace(q,'大きな','大きい'));

export function validateCurriculumBank(bank){
 validateNamedBank(bank);
 for(const q of bank.rows){
  const opts=q.assessment_meta.spokenChoices||q.options.map(o=>o.option_text);
  if(new Set(opts).size!==opts.length||q.options.filter(o=>o.is_correct).length!==1)throw Error('Scope choices '+q.assessment_meta.key);
 }
 return bank;
}
curriculumBanks.forEach(validateCurriculumBank);
