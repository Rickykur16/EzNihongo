// Original scene assets remove answer sentences from the illustration/audio.
export default {
 'b04-a-jlpt-r2-23-expanded':{
  image_url:'/assets/assessments/reviewed-book.svg',
  audio_script:'N: Perhatikan buku pada gambar. A memegang buku itu. Dengarkan pertanyaan B, lalu pilih ucapan A.\nB: えいごの ほんですか。',
  options:['いいえ、にほんごの ほんです。','いいえ、かばんです。','はい、えいごの ほんです。'],
  explanation:'Sampul buku bertuliskan にほんご. A mengoreksi dugaan B bahwa itu buku bahasa Inggris: いいえ、にほんごのほんです。 Gambar menunjukkan benda dan bahasanya tanpa mencetak kalimat jawaban.',
  reasons:['Sampul menunjukkan bahasa Jepang, sehingga A menyangkal dugaan bahasa Inggris dan menyebut bahasa yang benar.','Benda pada gambar adalah buku, bukan tas.','Sampul menunjukkan bahasa Jepang, bukan bahasa Inggris.'],
 },
 'b08-a-jlpt-r2-23-expanded':{
  image_url:'/assets/assessments/reviewed-map.svg',
  audio_script:'N: えを みてください。Aさんと Bさんが はなします。\nB: ぎんこうは どこですか。\nN: Aさんは なんと いいますか。',
  options:['がっこうの となりです。','がっこうの なかです。','がっこうの うしろです。'],
  explanation:'Bank dan sekolah berada berdampingan pada gambar. Karena bank di sebelah sekolah, A memakai がっこうのとなりです. Tidak ada kalimat jawaban pada gambar maupun stimulus audio.',
  reasons:['Dua bangunan berdampingan, sehingga となり menyatakan hubungan lokasi yang tepat.','Bank merupakan bangunan terpisah, bukan berada di dalam sekolah.','Bank digambar di samping sekolah pada baris yang sama, bukan di belakangnya.'],
 },
};
