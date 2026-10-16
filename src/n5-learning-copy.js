// Student-facing N5 copy. Source IDs, grammar patterns and assessment data
// remain intact; display labels must never become grading selectors.
(function (root) {
  const summaries = [
    '',
    'Kenali huruf hiragana, perubahan bunyi, dan gabungan huruf kecil. Dengarkan bunyinya, lalu latih membaca kata sederhana.',
    'Kenali huruf katakana untuk menulis nama dan kata serapan. Latih bunyi dasar, gabungan huruf kecil, dan bunyi panjang.',
    'Belajar menyebut nama, asal negara, dan pekerjaan. Gunakan kalimat sopan untuk bertanya dan menjawab saat berkenalan.',
    'Belajar menunjuk benda, menyebut pemiliknya, dan mengonfirmasi informasi. Pilih kata tunjuk sesuai posisi benda.',
    'Belajar membaca angka, menanyakan harga, menyebut jam, dan membicarakan umur serta rentang waktu.',
    'Gunakan kata sifat い untuk menjelaskan benda dan keadaan. Bedakan bentuk positif, negatif, serta bentuk lampau.',
    'Gunakan kata sifat な untuk menjelaskan orang dan tempat. Latih kesukaan, kemahiran, penghubung sifat, dan bentuk lampau.',
    'Belajar menyebut keberadaan benda dan orang, menanyakan lokasi, serta menjelaskan posisi terhadap benda lain.',
    'Ceritakan tujuan perjalanan, kendaraan yang digunakan, dan rutenya. Tanyakan kapan, ke mana, dan dengan siapa seseorang pergi.',
    'Ceritakan kegiatan sehari-hari dengan kata kerja sopan. Bedakan kegiatan sekarang dan lampau, lalu sebutkan seberapa sering dilakukan.',
    'Sebutkan jumlah benda dan orang dengan kata bantu bilangan yang sesuai. Latih pertanyaan tentang jumlah.',
    'Ubah kata kerja ke bentuk て. Gunakan bentuk ini untuk menghubungkan dan mengurutkan kegiatan.',
    'Gunakan bentuk て untuk meminta bantuan, menyebut keadaan, meminta izin, dan menyampaikan larangan.',
    'Kenali bentuk biasa kata kerja. Latih permintaan untuk tidak melakukan sesuatu, kewajiban, dan hal yang tidak perlu dilakukan.',
    'Gunakan ungkapan sopan saat melayani pelanggan. Belajar menyatakan pilihan, total pembayaran, dan perubahan keadaan.',
    'Sebutkan waktu dan tanggal, tanyakan jadwal, serta ceritakan kegiatan yang dilakukan secara rutin.',
    'Ulangi cara menyebut kesukaan dan kemahiran. Lanjutkan dengan menyatakan kemampuan serta menanyakan jenis kegiatan.',
    'Bandingkan dua hal dan tanyakan mana yang lebih sesuai. Sebutkan hal yang paling menonjol di antara beberapa pilihan.',
    'Bedakan keinginan melakukan kegiatan dan keinginan memiliki benda. Latih niat, rencana, serta ajakan.',
    'Ceritakan pengalaman, sampaikan alasan, dan hubungkan kalimat sesuai hubungan maknanya.',
  ];
  const aliases = {
    'Topik ＋（（好き・嫌い・上手・下手） ・ ~で/くて ・ 過去形／Bentuk Lampau）': 'Kesukaan, Penghubung Sifat, dan Bentuk Lampau',
    'angka (すうじ）': 'Membaca Angka',
    'Tanya Harga & menyatakan Jam': 'Menanyakan Harga dan Menyebut Jam',
    'Rentang waktu & Umur': 'Menyebut Rentang Waktu dan Umur',
    'Kata Sifat な＋': 'Bentuk Dasar Kata Sifat な',
  };
  const patternLabels = {
    '〜を[verb]ます': 'Kata Benda を Kata Kerja Bentuk ます',
    '[verb]ません': 'Kata Kerja Bentuk ません',
    '[verb]ました': 'Kata Kerja Bentuk ました',
    '[verb]ませんでした': 'Kata Kerja Bentuk ませんでした',
    '〜を[counter]+[verb]': 'Kata Benda を Jumlah + Kata Kerja',
    '[counter]+ あります／います': 'Jumlah + あります／います',
    'Native counters': 'Hitungan Umum: ひとつ〜とお',
    'Te-form Golongan 1 (u-verbs)': 'Bentuk て: Kata Kerja Golongan 1',
    'Te-form Golongan 2 (ru-verbs)': 'Bentuk て: Kata Kerja Golongan 2',
    'Te-form Tidak Beraturan': 'Bentuk て: する dan 来る',
    '[V-jisho] (Bentuk Kamus)': 'Kata Kerja Bentuk Kamus',
    'Nai-form (konjugasi)': 'Kata Kerja Bentuk ない',
    '[V-ta] (Lampau Plain)': 'Kata Kerja Bentuk た',
    '[V-nakatta]': 'Kata Kerja Bentuk なかった',
    '〜を[counter]お願いします': 'Kata Benda を Jumlah + お願いします',
    '〜に[verb]': 'Waktu に Kata Kerja',
    '[noun]が欲しいです': 'Kata Benda が 欲しいです',
    '[noun]の[position]': 'Kata Benda の Posisi',
    '[い-adj]+ noun': 'Kata Sifat い + Kata Benda',
    '〜は[い-adj]です': 'Topik は Kata Sifat い です',
    '〜は[い-adj]くないです': 'Kata Sifat い → くないです',
    'Rumus belas': 'Membaca Angka Belasan',
  };
  // Slugs identify the original material, not its current position. Migration
  // 213 moves n5-b14 to Bab 13 and n5-b13 to Bab 14; their summaries travel
  // with their content. Visible numbers come from the CMS title/module order.
  function chapter(module) { return Number(String(module.slug || module.id || '').match(/^n5-b(\d+)$/)?.[1]) || 0; }
  function clean(text) {
    return String(text || '').replace(/\bKB\s*([12])?/g, (_, n) => `kata benda${n ? ' ' + n : ''}`)
      .replace(/\b(?:i-adjective|i-adj)\b/gi, 'kata sifat い')
      .replace(/\b(?:na-adjective|na-adj)\b/gi, 'kata sifat な')
      .replace(/\[noun\]|\bnoun\b/gi, 'kata benda').replace(/\[verb\]/gi, 'kata kerja')
      .replace(/\[counter\]/gi, 'kata bantu bilangan').replace(/\[position\]/gi, 'posisi')
      .replace(/\bTe-form\b/gi, 'bentuk て').replace(/\bgrammar\b/gi, 'tata bahasa')
      .replace(/\bmnemonic\b/gi, 'cara mengingat').replace(/\bstroke\b/gi, 'goresan')
      .replace(/\blayout\b/gi, 'susunan').replace(/menunjukann|menunnjukan/g, 'menunjukkan')
      .replace(/\bkemana\b/g, 'ke mana').replace(/\bAnda\b/g, 'kamu')
      .replace(/\bnempel\b/g, 'langsung diikuti').replace(/\s+\./g, '.').replace(/\.\.$/g, '.');
  }
  function title(text) {
    const original = String(text || '').trim();
    if (aliases[original]) return aliases[original];
    const short = original.replace(/\s*[（(].*$/, '').trim();
    return aliases[short] || short.replace(/\s*&\s*/g, ' dan ').replace(/Youon/g, 'Yōon').replace(/Chouon/g, 'Chōon');
  }
  function prepareCourse(course) {
    if (course.slug !== 'n5') return course;
    return { ...course, modules: (course.modules || []).map(module => {
      const number = chapter(module);
      const final = module.slug === 'n5-final-exam';
      const moduleTitle = final ? 'Ujian Akhir N5' : String(module.title || '').replace(/^BAB\s*(\d+)\s*:\s*/i, 'Bab $1: ').replace(/\s*&\s*/g, ' dan ');
      const oldDescription = String(module.description || '').trim();
      const generic = !oldDescription || oldDescription === module.title_en || /Script Mastery|^## Tentang/.test(oldDescription);
      const sourceTitles = new Map((module.lessons || []).map(l => [l.id, title(l.title)]));
      return { ...module, title: moduleTitle,
        description: generic && summaries[number] ? summaries[number] : clean(oldDescription),
        title_en: '',
        section_name: final ? 'Ujian Akhir' : String(module.section_name || '').replace(/^Section\s*(\d+)\s*:\s*/i, 'Bagian $1: ').replace(/\s*&\s*/g, ' dan '),
        cando_statements: (Array.isArray(module.cando_statements) ? module.cando_statements : []).map(clean), scenario: clean(module.scenario),
        lessons: (module.lessons || []).map(lesson => {
          let displayTitle = title(lesson.title);
          const sourceId = lesson.type === 'conversation' ? lesson.conversation_source_lesson_id : lesson.popup_after_lesson_id;
          // "Tata Bahasa Bab 13: X" → "X": judul turunan sudah berada di bawah
          // Bab-nya, jadi awalan itu hanya membuat judul sidebar dua baris.
          const rawSource = sourceTitles.get(sourceId);
          const sourceTitle = rawSource && (rawSource.replace(/^Tata\s+Bahasa(?:\s+Bab\s*\d+)?\s*[:：]\s*/i, '').trim() || rawSource);
          if (lesson.type === 'conversation') displayTitle = sourceTitle ? `Percakapan: ${sourceTitle}` : displayTitle;
          if (lesson.type === 'grammar_task') displayTitle = sourceTitle ? `Latihan: ${sourceTitle}` : displayTitle.replace(/^Tugas Bunpou/, 'Latihan Tata Bahasa');
          if (lesson.type === 'quiz') displayTitle = final ? 'Ujian Akhir N5' : displayTitle.replace(/^Assignment Bab/, 'Tes Bab').replace(/^Kuis\s*[—-]/, 'Kuis Latihan:');
          if (displayTitle === 'Pengantar' || /^Intro\b/.test(displayTitle)) displayTitle = `Pengantar: ${moduleTitle.replace(/^Bab \d+:\s*/, '')}`;
          return { ...lesson, sourceTitle: lesson.title, title: displayTitle };
        }),
      };
    }) };
  }
  // The Notion reference is a separately refreshed source snapshot. Project
  // the swapped chapters using the loaded CMS course; never mutate its cache
  // or mistake a fresh Notion sync for a request to undo the curriculum order.
  function prepareVocabularyReference(data, course) {
    if (course?.level !== 'N5') return data;
    const findModule = number => (course.modules || []).find(m => (m.slug || m.id) === `n5-b${number}`);
    const old13 = findModule(13), old14 = findModule(14);
    const visibleNumber = module => Number(String(module?.title || '').match(/^Bab\s*(\d+)\s*[:：]/i)?.[1]);
    if (visibleNumber(old13) !== 14 || visibleNumber(old14) !== 13) return data;
    const sections = Array.isArray(data.sections) && data.sections.length ? data.sections : null;
    const chapters = sections ? sections.flatMap(s => s.bab || []) : data.bab || [];
    const findChapter = number => chapters.find(b => new RegExp(`^N5-B0?${number}$`, 'i').test(b.kode || ''));
    const source13 = findChapter(13), source14 = findChapter(14);
    if (!source13 || !source14) return data;
    const project = (bab, module, number) => ({ ...bab, kode: `N5-B${number}`, nomor: number,
      name: module.title.replace(/^Bab\s*\d+\s*[:：]\s*/i, '') });
    const new13 = project(source14, old14, 13), new14 = project(source13, old13, 14);
    const replace = bab => bab === source13 ? new13 : bab === source14 ? new14 : bab;
    if (!sections) return { ...data, bab: chapters.map(replace) };
    return { ...data, sections: sections.map(section => {
      const bab = section.bab || [];
      const target = bab.includes(source13) && !bab.includes(source14) ? old14
        : bab.includes(source14) && !bab.includes(source13) ? old13 : null;
      return { ...section, name: target?.sectionName || target?.section_name || section.name, bab: bab.map(replace) };
    }) };
  }
  function intro(lesson, module, kind, count) {
    if (kind === 'deck') return `Pelajari ${count} kata pada bab ini. Klik kartu untuk melihat contoh kalimat. Tekan ikon audio untuk mendengar pengucapannya.`;
    if (kind === 'kanji') return `Pelajari ${count} kanji pada bab ini. Klik karakter untuk melihat urutan goresan, cara mengingat, dan contoh kata yang memakainya.`;
    if (kind === 'grammar_task') return `Latih ${count} pola pada pelajaran ini. Mulai dari memahami fungsi dan bentuknya, lalu buat kalimat sesuai kartu situasi. Ikuti jumlah jawaban dan cara pengiriman pada setiap pola.`;
    if (kind === 'kana') {
      const name = String(lesson.sourceTitle || lesson.title || '');
      const note = /Dakuon/.test(name) ? 'Perhatikan perubahan bunyi setelah huruf diberi tanda dakuten (゛) atau handakuten (゜).'
        : /Youon|Yōon/.test(name) ? 'Perhatikan gabungan huruf kecil dan jeda bunyi っ／ッ.' + (/Chouon|Chōon/.test(name) ? ' Tanda ー memanjangkan bunyi vokal.' : '')
        : /Bunyi Tambahan/.test(name) ? 'Gabungan huruf berikut dipakai untuk menulis bunyi kata serapan.'
        : 'Kenali huruf dasar dan bunyinya sebelum berlatih membaca kata.';
      return `${note} Klik karakter untuk mendengar bunyi, melihat urutan goresan, cara mengingat, dan contoh kata.`;
    }
    return '';
  }
  function lessonBody(lesson, module) {
    const body = String(lesson.body || '').trim();
    if (/^## Tentang L\d+/.test(body) || (!body && /^Pengantar|^Apa Itu/.test(lesson.sourceTitle || lesson.title))) return summaries[chapter(module)] || '';
    return body;
  }
  function notes(value, escape) {
    const text = clean(value).trim();
    if (!text) return '';
    return text.split(/(?<=\.)\s+/).map(part => `<p>${escape(part)}</p>`).join('');
  }
  function numbers(escape) {
    const rows = [
      ['Belasan', '10 + satuan', '13', 'じゅうさん'],
      ['Puluhan', '2 × 10', '20', 'にじゅう'],
      ['Puluhan', 'puluhan + satuan', '23', 'にじゅうさん'],
      ['Ratusan', '100', '100', 'ひゃく'],
      ['Ratusan', '300', '300', 'さんびゃく'],
      ['Ratusan', '300 + 20', '320', 'さんびゃくにじゅう'],
      ['Ratusan', 'ratusan + puluhan + satuan', '325', 'さんびゃくにじゅうご'],
      ['Ribuan', '1.000', '1.000', 'せん'],
      ['Ribuan', '6.000 + 500', '6.500', 'ろくせんごひゃく'],
      ['Ribuan', '6.000 + 500 + 20', '6.520', 'ろくせんごひゃくにじゅう'],
      ['Ribuan', 'ribuan + ratusan + puluhan + satuan', '6.525', 'ろくせんごひゃくにじゅうご'],
      ['Puluhan ribu', '1 × 10.000', '10.000', 'いちまん'],
      ['Puluhan ribu', '1 × 10.000 + 2.000', '12.000', 'いちまんにせん'],
      ['Puluhan ribu', 'jumlah 万 + sisanya', '12.500', 'いちまんにせんごひゃく'],
      ['Jutaan', '1.250 × 10.000', '12.500.000', 'せんにひゃくごじゅうまん'],
    ];
    return `<p>Susun angka dari nilai terbesar ke nilai terkecil. Perhatikan perubahan bunyi pada beberapa ratusan dan ribuan.</p><div class="n5-number-table"><table><thead><tr><th>Kelompok</th><th>Susunan</th><th>Angka</th><th>Bacaan</th></tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, i) => `<td${i === 3 ? ' lang="ja"' : ''}>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><h3>Perhatikan perubahan bunyi</h3><p>300: さんびゃく · 600: ろっぴゃく · 800: はっぴゃく<br>3.000: さんぜん · 8.000: はっせん</p><h3>Membaca 万</h3><p>万 berarti 10.000. Kelompokkan empat digit dari kanan: 12.500 = 1 × 10.000 + 2.500. Bacanya いちまんにせんごひゃく. Tanda titik pada angka di sini adalah pemisah ribuan dalam bahasa Indonesia.</p>`;
  }
  function renderBody(value, escape, sanitize) {
    const text = String(value || '').trim();
    if (!text) return '';
    // Preserve existing rich text through the same allowlist as other content.
    if (/<\/?[a-z][^>]*>/i.test(text)) return sanitize(text);
    const inline = s => escape(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/_([^_]+)_/g, '<em>$1</em>');
    const lines = text.replace(/\s+(?=\*\*(?:Arti|Contoh|Catatan sensei):)/g, '\n\n').replace(/\s+>\s*/g, '\n> ').split(/\r?\n/);
    let blocks = [], list = [], ordered = false, paragraph = [];
    const flushParagraph = () => { if (paragraph.length) { blocks.push(`<p>${inline(paragraph.join(' '))}</p>`); paragraph = []; } };
    const flushList = () => { if (list.length) { blocks.push(`<${ordered ? 'ol' : 'ul'}>${list.map(x => `<li>${inline(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`); list = []; } };
    for (const line of lines) {
      const heading = line.match(/^#{1,3}\s+(.+)$/), item = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
      if (!line.trim()) { flushParagraph(); flushList(); }
      else if (heading) { flushParagraph(); flushList(); blocks.push(`<h3>${inline(heading[1])}</h3>`); }
      else if (item) { flushParagraph(); const nextOrdered = /^\s*\d/.test(line); if (list.length && ordered !== nextOrdered) flushList(); ordered = nextOrdered; list.push(item[1]); }
      else if (/^> /.test(line)) { flushParagraph(); flushList(); blocks.push(`<blockquote>${inline(line.slice(2))}</blockquote>`); }
      else { flushList(); paragraph.push(line.trim()); }
    }
    flushParagraph(); flushList(); return blocks.join('');
  }
  function pattern(value) { return patternLabels[value] || clean(value); }
  function meaning(value) {
    const text = String(value || '');
    if (/KB 2 milik KB 1/.test(text)) return 'Menjelaskan kepunyaan atau hubungan antara dua kata benda, misalnya nama seseorang atau mahasiswa suatu universitas.';
    if (/gak perlu tanda/.test(text)) return 'Mengubah pernyataan menjadi pertanyaan sopan dengan か.';
    if (text === 'sedang / kondisi / kebiasaan / profesi') return 'Menyatakan kegiatan yang sedang berlangsung, keadaan, kebiasaan, atau pekerjaan. Maknanya mengikuti kata kerja dan situasi.';
    if (/negatif santai|lampau.*santai/.test(text)) return text.replace(/santai/g, 'dalam bentuk biasa');
    if (text === 'suka/benci ~') return 'Menyatakan suka atau tidak suka terhadap sesuatu.';
    return clean(text);
  }
  root.EzN5Copy = { prepareCourse, prepareVocabularyReference, intro, lessonBody, renderBody, pattern, meaning, clean, notes, numbers };
})(typeof window !== 'undefined' ? window : globalThis);
