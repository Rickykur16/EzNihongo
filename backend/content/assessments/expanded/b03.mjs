// Bab 3 keeps its A/B foundation packets and its six original objectives.
// No demonstratives, adjectives or free verbs from later chapters.
const item=(prompt,options,explanation,objective,wrong,itemType='grammar_form',extra={})=>({
  prompt,options,explanation,objective,itemType,reasons:[explanation,...wrong],...extra,
});
export default {
 A:{
  vocabulary:[
   item('Di kartu keluarga: ayah = dokter; ibu = guru. Lengkapi profesi ibu: ははは（　）です。',['せんせい','いしゃ','がくせい','かいしゃいん'],'せんせい berarti guru, sesuai profesi ibu.','relation',['いしゃ adalah profesi ayah pada kartu.','がくせい berarti pelajar.','かいしゃいん berarti karyawan perusahaan.'],'context_vocabulary'),
   item('Rio memperkenalkan adik perempuan sendiri kepada teman. Lengkapi: わたしの（　）は ミラです。',['いもうと','おとうと','あに','ちち'],'いもうと menyebut adik perempuan sendiri.','relation',['おとうと adalah adik laki-laki.','あに adalah kakak laki-laki.','ちち adalah ayah.'],'context_vocabulary'),
   item('Setelah Anda menutup perkenalan dengan どうぞよろしくおねがいします, teman membalas dengan ungkapan timbal balik. Pilih balasannya.',['こちらこそ、よろしくおねがいします。','はじめまして。','おなまえは。','すみません。'],'こちらこそ membalas harapan baik yang baru disampaikan.','identity',['はじめまして membuka perkenalan, bukan balasan timbal balik yang diminta.','おなまえは menanyakan nama.','すみません menyampaikan permintaan maaf atau menarik perhatian.'],'context_vocabulary'),
  ],
listening:[
   item('Apa pekerjaan kakak laki-laki pembicara?',['エンジニア','がくせい','せんせい','いしゃ'],'Pembicara mengoreksi dugaan guru menjadi insinyur.','negation',['Pelajar adalah pembicara, bukan kakaknya.','Dugaan guru ditolak.','Dokter tidak disebut.'],'key_points',{audioScript:'A: わたしは がくせいです。\nB: おにいさんは せんせいですか。\nA: いいえ、せんせいじゃありません。エンジニアです。'}),
   item('こえを きいて、こたえて ください。',['はい、かいしゃいんです。','タイじんです。','はじめまして。'],'Pertanyaan meminta konfirmasi apakah lawan bicara karyawan perusahaan.','question',['Kewarganegaraan tidak menjawab pertanyaan pekerjaan.','Salam pembuka tidak mengonfirmasi pekerjaan.'],'quick_response',{audioOptions:true,audioScript:'A: かいしゃいんですか。'}),
  ],
 },
 B:{
  vocabulary:[
   item('Daftar anggota keluarga: ibu = Mina; kakak perempuan = Eri; adik laki-laki = Tono. Lengkapi: わたしの あねは（　）です。',['エリ','ミナ','トノ','せんせい'],'あね adalah kakak perempuan, yaitu Eri pada daftar.','relation',['Mina adalah ibu.','Tono adalah adik laki-laki.','せんせい adalah pekerjaan dan bukan nama pada daftar.'],'context_vocabulary'),
   item('Kartu Rudi menuliskan pekerjaan “karyawan perusahaan”. Pilih kata untuk melengkapi: ルディさんは（　）です。',['かいしゃいん','エンジニア','かんごし','がくせい'],'かいしゃいん menyatakan karyawan perusahaan.','identity',['エンジニア menyatakan insinyur, yang tidak dinyatakan kartu.','かんごし berarti perawat.','がくせい berarti pelajar.'],'context_vocabulary'),
   item('A「おしごとは。」B ingin menjawab profesinya, yaitu dokter. Pilih respons B.',['いしゃです。','にほんじんです。','ユキです。','こちらこそ。'],'いしゃ menjawab profesi yang diminta おしごとは.','question',['Ini kewarganegaraan.','Ini nama.','Ini respons timbal balik, bukan profesi.'],'context_vocabulary'),
  ],
listening:[
   item('Apa kesamaan kedua pembicara?',['がくせいです。','にほんじんです。','せんせいです。','かいしゃいんです。'],'Keduanya pelajar; negara asal berbeda.','addition',['Hanya B orang Jepang.','Guru tidak dinyatakan sebagai profesi keduanya.','Karyawan perusahaan tidak dinyatakan.'],'key_points',{audioScript:'A: アリです。インドネシアじんです。がくせいです。\nB: ユキです。にほんじんです。わたしも がくせいです。'}),
   item('こえを きいて、こたえて ください。',['ミキです。','いしゃです。','タイじんです。'],'おなまえは meminta nama; Miki adalah nama.','question',['いしゃ menyatakan pekerjaan.','タイじん menyatakan kewarganegaraan.'],'quick_response',{audioOptions:true,audioScript:'A: おなまえは。'}),
  ],
 },
};
