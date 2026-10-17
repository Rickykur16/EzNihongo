// Bounded editorial proposals keyed by the published v5 source key.
// Field-only patches keep existing options/keys; the last item supplies a new
// correct-first spoken option list and its aligned, explicit rationales.
// The v5 source and published bank are intentionally unchanged.
const foundation=(form,keys)=>keys.map(key=>`b03-${form}-${key}-expanded`);
const published=(chapter,numbers)=>numbers.map(number=>`b${String(chapter).padStart(2,'0')}-a-jlpt-r2-${number}-expanded`);
const added=(chapter,category,numbers,form='a')=>numbers.map(number=>`b${String(chapter).padStart(2,'0')}-${form}-expanded-${category}-${number}`);
const nine=[1,2,3,4,5,6,7,8,9];

// These keys support their assigned can-do in context. This is deliberately
// narrower than category membership or the original objective grouping.
// In particular, isolated kanji readings and unrelated location/companion
// facts do not establish a grammar or a different semantic objective.
// Bab 9 goal1 has two strict viewpoint/verb evidence items only after applying
// the grammar-7 and expanded-listening-7 revisions below. Isolated kanji are
// not relabeled as proof of choosing a motion verb from a speaker's viewpoint.
export const objectiveEvidenceKeys=[
  ...foundation('a',['v04','v05','v06','g01','g02','g03','g04','g06','g07','g08','g09','g10','r01','r02','l01','l02','l03','l04']),
  ...foundation('b',['v04','v05','g01','g02','g03','g04','g06','g07','g08','g09','g10','r01','r02','r03','l01','l02','l03','l04']),
  ...added(3,'vocabulary',[1,2,3,4,5],'a'),...added(3,'listening',nine,'a'),
  ...added(3,'vocabulary',[1,2,3,4,5],'b'),...added(3,'listening',nine,'b'),
  ...published(4,[7,8,9,10,11,13,16,17,18,19,21,22,23]),
  ...added(4,'listening',[1,2,3,4,6,7,8]),
  ...published(5,[4,5,6,7,8,9,10,11,13,15,16,17,18,19,21,22,23,24]),
  ...added(5,'vocabulary',[3]),...added(5,'listening',nine),
  ...published(6,[4,5,6,7,8,9,10,11,13,14,15,16,17,18,19,21,22,23,24]),
  ...added(6,'vocabulary',[3]),...added(6,'listening',nine),
  ...published(7,[4,5,6,7,8,9,10,11,14,16,17,18,19,21,22,23,24]),
  ...added(7,'vocabulary',[3]),...added(7,'listening',nine),
  ...published(8,[4,5,6,7,8,11,13,14,15,16,17,18,21,23,24]),
  ...added(8,'vocabulary',[3]),...added(8,'listening',[1,2,3,5,7,8,9]),
  ...published(9,[4,6,7,8,10,15,17,19,21,22,23]),
  ...added(9,'vocabulary',[3]),...added(9,'listening',nine),
];

export default {
  'b07-a-jlpt-r2-4-expanded': {
    prompt:'Jawaban B harus menanggapi suasana kota. A「この まちは しずかですか。」B「いいえ、とても（　）です。」',
    reviewNote:'Not quiet alone does not exclude an independently white or cheap town. A response explicitly about the quiet/noisy atmosphere makes にぎやか the single best choice without introducing new Japanese grammar.',
  },
  'b07-a-expanded-listening-3': {
    audioScript:'N: Dengarkan sifat dua ruangan.\nA: この へやは しずかですね。\nB: はい。きれいじゃありません。あの へやは きれいです。にぎやかです。',
    reviewNote:'Replace となり (introduced in Bab 8) with the already-taught demonstrative あの. The quiet room and the existing correct answer do not change.',
  },
  'b08-a-jlpt-r2-5-expanded': {
    prompt:'いぬは はこの なかです。はこの（　）じゃありません。',
    reviewNote:'Use the taught nominal negative instead of いません, which is absent from Bab 8 supporting examples and belongs to the polite verb-negative sequence in Bab 10. The keyed location remains そと.',
  },
  'b09-a-jlpt-r2-18-expanded': {
    passage:'きょうは にほんごの せんせいと みせへ いきます。バスで いきます。あしたは ハディさんと がっこうへ いきます。でんしゃで いきます。ごぜん はちじに いきます。',
    reviewNote:'Replace あるいていきます (an incidental te-form construction before Bab 12) with the taught vehicle + で. The question asks tomorrow\'s companion, so the Hadi key and explanation are unchanged.',
  },
  'b09-a-jlpt-r2-7-expanded': {
    prompt:'A berada di sekolah ini dan sedang menunggu B. B sedang bergerak dari luar menuju sekolah tersebut untuk kunjungan pertamanya. Dari sudut pandang A, pilih kata kerja untuk menyatakan gerak B menuju tempat A: Bさんは この がっこうへ（　）。',
    options:['きます','いきます','かえります','います'],
    explanation:'A berada di sekolah tujuan dan menunggu B datang ke tempatnya. Dari sudut pandang A, gerak mendekati lokasi pembicara dinyatakan きます.',
    reasons:[
      'きます menyatakan datang mendekati sekolah tempat A berada dan menunggu B.',
      'いきます tidak menyatakan gerak mendekati tempat A pada sudut pandang dan situasi yang diberikan.',
      'かえります berarti kembali; B baru pertama kali mengunjungi sekolah ini, bukan kembali ke tempat asalnya.',
      'います menyatakan keberadaan, bukan gerak; lokasi keberadaan juga memakai に, bukan へ.',
    ],
    reviewNote:'Replace a destination-particle item that did not measure its assigned viewpoint/verb can-do. Together with expanded-listening-7, this provides two clear pieces of evidence for Bab 9 goal1 while preserving the 9-grammar/13-listening blueprint.',
  },
  'b09-a-expanded-listening-7': {
    audioScript:'N: A berada di sekolah ini dan besok tetap berada di sini untuk menunggu kedatangan B. B sekarang di rumahnya. Besok adalah kunjungan pertama B ke sekolah ini. Dari sudut pandang A, pilih ucapan yang menyatakan gerak B menuju tempat A berada.',
    audioOptions:true,
    imageUrl:'/assets/assessments/speakers-ab.svg',
    options:[
      'Bさんは あした この がっこうへ きます。',
      'Bさんは あした この がっこうへ いきます。',
      'Bさんは あした この がっこうへ かえります。',
    ],
    explanation:'A berada di sekolah tujuan dan akan menunggu B di sana. Gerak B menuju tempat A dinyatakan きます. Semua pilihan mempertahankan pelaku, waktu, dan tujuan yang sama; yang dibedakan adalah verba arah.',
    reasons:[
      'きます menyatakan gerak mendekati tempat A berada, sesuai sudut pandang yang diberikan.',
      'いきます tidak menyatakan gerak mendekati tempat A yang menunggu di sekolah tujuan pada situasi ini.',
      'かえります menyatakan kembali; ini kunjungan pertama B ke sekolah tersebut, sehingga bukan kembali ke tempat asalnya.',
    ],
    reviewNote:'The original alternatives changed destinations, so students could eliminate them without distinguishing 来ます from 行きます. The revised alternatives differ only in the motion verb; the situation makes the viewpoint and absence of a return explicit.',
  },
};
