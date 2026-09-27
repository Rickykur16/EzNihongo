// Compact, reviewed authoring format. Each row is a complete item, not an
// AI-generation prompt. Correct options are rotated deterministically.
export function chapter(number, title, grammar, objectives, vocab, usage, reading, listening) {
  const items = [];
  const add = (category, row, extra = {}) => {
    const [prompt, options, explanation, objective = 0] = row;
    const offset = items.length % 4;
    const rotated = [...options.slice(offset), ...options.slice(0, offset)];
    items.push({ id: `b${String(number).padStart(2,'0')}-a-${category[0]}${String(items.length + 1).padStart(2,'0')}`,
      category, mode: 'choice', objective: `goal${objective+1}`, prompt,
      options: rotated, answer: (4-offset)%4, explanation,
      distractorReasons: rotated.map((option, index) => index === (4-offset)%4 ? explanation :
        `Pilihan “${option}” tidak memenuhi informasi atau bentuk yang diminta. ${explanation}`), ...extra });
  };
  vocab.forEach(row => add('vocabulary', row));
  usage.forEach(row => add('grammar', row));
  reading.forEach(([passage, rows]) => rows.forEach(row => add('reading', row, { passage })));
  listening.forEach(([audioScript, focus, row]) => add('listening', row, { audioScript, listeningFocus: focus }));
  return { version:'n5-assessment-v2', chapter:number, title:`Bab ${number} — ${title}`, selection:'all',
    objectives:objectives.map((canDo,i)=>({id:`goal${i+1}`,canDo})),
    boundary:{grammar,notes:'Mengikuti dua subbab Canva dan materi sampai bab ini. Kalimat Jepang memakai kana; kanji hanya menjadi target baca yang sudah diajarkan. Instruksi dan konteks singkat berbahasa Indonesia. Tidak meminta jawaban ketik.'},
    transferTask:{prompt:'Latihan lisan opsional di luar nilai: gunakan informasi dari salah satu bacaan untuk menjelaskan situasi dengan pola bab ini.',rubric:['Informasi sesuai stimulus.','Pola yang dipelajari digunakan sesuai makna.','Jawaban singkat yang setara dan benar dapat diterima.']},
    forms:{A:items} };
}
export const read = (word, options, meaning, objective=0) => [`Pilih bacaan <u>${word}</u> (${meaning}).`, options, `${word} dibaca ${options[0]}; artinya ${meaning}.`, objective];
export const meaning = (word, options, objective=0) => [`Apa arti “${word}”?`, options, `“${word}” berarti ${options[0]}.`, objective];
