(function (root) {
  const types = [
    ['verb','Kata kerja','動詞'],
    ['i-adjective','Kata sifat い','い形容詞'],
    ['na-adjective','Kata sifat な','な形容詞'],
    ['noun','Kata benda','名詞'],
    ['pronoun','Kata ganti dan kata tunjuk','代名詞・指示詞'],
    ['question','Kata tanya','疑問詞'],
    ['adverb','Kata keterangan','副詞'],
    ['number','Bilangan dan kata bantu bilangan','数詞・助数詞'],
    ['particle','Partikel','助詞'],
    ['conjunction','Kata sambung','接続詞'],
    ['affix','Imbuhan','接辞'],
    ['expression','Ungkapan dan sapaan','表現・挨拶'],
    ['other','Lainnya',''],
  ].map(([key,label,japanese]) => Object.freeze({key,label,japanese}));
  const byKey = new Map(types.map(type => [type.key,type]));
  function label(key) { return byKey.get(key)?.label || ''; }
  function group(items) {
    const buckets = new Map(types.map(type => [type.key,[]]));
    items.forEach((item,index) => {
      const key = byKey.has(item.wordType) ? item.wordType : item.verbForms ? 'verb' : 'other';
      buckets.get(key).push({item,index});
    });
    return types.filter(type => buckets.get(type.key).length).map(type => ({...type,entries:buckets.get(type.key)}));
  }
  root.EzVocabularyGroups = Object.freeze({group,label});
})(globalThis);
