class Vocab {
  final String word;
  final String reading;
  final String meaning;

  const Vocab({required this.word, required this.reading, required this.meaning});

  factory Vocab.fromJson(Map<String, dynamic> j) => Vocab(
        word: (j['w'] ?? '') as String,
        reading: (j['r'] ?? '') as String,
        meaning: (j['m'] ?? '') as String,
      );
}

class Sentence {
  final String japanese;
  final String reading;
  final String indonesian;

  const Sentence({required this.japanese, required this.reading, required this.indonesian});

  factory Sentence.fromJson(Map<String, dynamic> j) => Sentence(
        japanese: (j['j'] ?? '') as String,
        reading: (j['r'] ?? '') as String,
        indonesian: (j['i'] ?? '') as String,
      );
}

class Kanji {
  final String character;
  final String level;
  final String onReading;
  final String kunReading;
  final String meaning;
  final List<Vocab> vocab;
  final List<Sentence> sentences;

  const Kanji({
    required this.character,
    required this.level,
    required this.onReading,
    required this.kunReading,
    required this.meaning,
    required this.vocab,
    required this.sentences,
  });

  String get id => character;

  factory Kanji.fromJson(Map<String, dynamic> j) {
    final rawVocab = (j['v'] as List?) ?? const [];
    final vocab = rawVocab
        .whereType<Map>()
        .map((m) => Vocab.fromJson(m.cast<String, dynamic>()))
        .toList(growable: false);

    final rawS = j['s'];
    final List<Sentence> sentences;
    if (rawS is List) {
      sentences = rawS
          .whereType<Map>()
          .map((m) => Sentence.fromJson(m.cast<String, dynamic>()))
          .toList(growable: false);
    } else if (rawS is Map) {
      sentences = [Sentence.fromJson(rawS.cast<String, dynamic>())];
    } else {
      sentences = const [];
    }

    return Kanji(
      character: (j['k'] ?? '') as String,
      level: (j['lv'] ?? '') as String,
      onReading: (j['on'] ?? '') as String,
      kunReading: (j['kun'] ?? '') as String,
      meaning: (j['m'] ?? '') as String,
      vocab: vocab,
      sentences: sentences,
    );
  }
}

const List<String> kJlptLevels = ['N5', 'N4', 'N3', 'N2', 'N1'];
