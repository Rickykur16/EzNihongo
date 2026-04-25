import 'dart:math' as math;
import 'storage.dart';

enum CardState { newCard, learning, review, relearning }

CardState _stateFromString(String? s) {
  switch (s) {
    case 'learning':
      return CardState.learning;
    case 'review':
      return CardState.review;
    case 'relearning':
      return CardState.relearning;
    case 'new':
    default:
      return CardState.newCard;
  }
}

String _stateToString(CardState s) {
  switch (s) {
    case CardState.learning:
      return 'learning';
    case CardState.review:
      return 'review';
    case CardState.relearning:
      return 'relearning';
    case CardState.newCard:
      return 'new';
  }
}

class CardRecord {
  double stability;
  double difficulty;
  int due;
  int? lastReview;
  int reps;
  int lapses;
  CardState state;
  int? lastRating;

  CardRecord({
    required this.stability,
    required this.difficulty,
    required this.due,
    required this.lastReview,
    required this.reps,
    required this.lapses,
    required this.state,
    required this.lastRating,
  });

  factory CardRecord.fresh() => CardRecord(
        stability: 0,
        difficulty: 5,
        due: DateTime.now().millisecondsSinceEpoch,
        lastReview: null,
        reps: 0,
        lapses: 0,
        state: CardState.newCard,
        lastRating: null,
      );

  factory CardRecord.fromJson(Map<String, dynamic> j) => CardRecord(
        stability: (j['stability'] as num?)?.toDouble() ?? 0,
        difficulty: (j['difficulty'] as num?)?.toDouble() ?? 5,
        due: (j['due'] as num?)?.toInt() ?? DateTime.now().millisecondsSinceEpoch,
        lastReview: (j['lastReview'] as num?)?.toInt(),
        reps: (j['reps'] as num?)?.toInt() ?? 0,
        lapses: (j['lapses'] as num?)?.toInt() ?? 0,
        state: _stateFromString(j['state'] as String?),
        lastRating: (j['lastRating'] as num?)?.toInt(),
      );

  Map<String, dynamic> toJson() => {
        'stability': stability,
        'difficulty': difficulty,
        'due': due,
        'lastReview': lastReview,
        'reps': reps,
        'lapses': lapses,
        'state': _stateToString(state),
        'lastRating': lastRating,
      };
}

class ReviewResult {
  final double stability;
  final double difficulty;
  final int due;
  final int interval;
  final double retrievability;
  final CardState state;

  const ReviewResult({
    required this.stability,
    required this.difficulty,
    required this.due,
    required this.interval,
    required this.retrievability,
    required this.state,
  });
}

class FsrsStats {
  final int total;
  final int newCount;
  final int dueCount;
  final int learnedCount;
  final int matureCount;
  final double averageRetention;

  const FsrsStats({
    required this.total,
    required this.newCount,
    required this.dueCount,
    required this.learnedCount,
    required this.matureCount,
    required this.averageRetention,
  });
}

class FsrsEngine {
  static const int dayMs = 86400000;
  static const int minMs = 60000;
  static const double decay = -0.5;
  static final double factor = math.pow(0.9, 1 / decay).toDouble() - 1;

  static const List<double> defaultWeights = [
    0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651,
    0.0589, 1.5330, 0.1544, 1.0071, 1.9395, 0.1100, 0.2900,
    2.2700, 0.2500, 2.9898, 0.5100, 0.3900,
  ];

  final Storage _storage;
  List<double> weights;
  Map<String, CardRecord> _cards = {};
  bool _loaded = false;

  FsrsEngine(this._storage, {List<double>? weights})
      : weights = weights ?? List<double>.from(defaultWeights);

  Future<void> load() async {
    if (_loaded) return;
    final raw = _storage.readJsonMap(Storage.fsrsKey);
    _cards = raw.map((id, value) {
      if (value is Map) {
        return MapEntry(id, CardRecord.fromJson(value.cast<String, dynamic>()));
      }
      return MapEntry(id, CardRecord.fresh());
    });
    _loaded = true;
  }

  Future<void> _persist() async {
    final m = _cards.map((k, v) => MapEntry(k, v.toJson()));
    await _storage.writeJsonMap(Storage.fsrsKey, m);
  }

  CardRecord? getCardState(String id) => _cards[id];

  static double _clamp(double v, double mn, double mx) =>
      v < mn ? mn : (v > mx ? mx : v);

  static double calcRetrievability(double t, double s) {
    if (s <= 0) return 0;
    final tt = t < 0 ? 0.0 : t;
    return math.pow(1 + factor * tt / s, decay).toDouble();
  }

  static int calcNextInterval(double s, [double r = 0.9]) {
    if (s <= 0) return 1;
    final interval = s * (math.pow(r, 1 / decay).toDouble() - 1) / factor;
    final rounded = interval.round();
    return rounded < 1 ? 1 : rounded;
  }

  double _initialStability(int rating) =>
      math.max(weights[rating - 1], 0.1).toDouble();

  double _initialDifficulty(int rating) {
    final d = weights[4] - math.exp(weights[5] * (rating - 1)) + 1;
    return _clamp(d, 1, 10);
  }

  double _stabilityRecall(double s, double d, double r, int rating) {
    final hardPenalty = rating == 2 ? weights[15] : 1.0;
    final easyBonus = rating == 4 ? weights[16] : 1.0;
    final newS = s *
        (math.exp(weights[8]) *
                (11 - d) *
                math.pow(s, -weights[9]).toDouble() *
                (math.exp(weights[10] * (1 - r)) - 1) *
                hardPenalty *
                easyBonus +
            1);
    return math.max(newS, 0.1).toDouble();
  }

  double _stabilityForgetting(double s, double d, double r) {
    final newS = weights[11] *
        math.pow(d, -weights[12]).toDouble() *
        (math.pow(s + 1, weights[13]).toDouble() - 1) *
        math.exp(weights[14] * (1 - r));
    return math.max(newS, 0.1).toDouble();
  }

  double _updateDifficulty(double d, int rating) {
    final d03 = _initialDifficulty(3);
    final newD = weights[6] * d03 + (1 - weights[6]) * (d - weights[7] * (rating - 3));
    return _clamp(newD, 1, 10);
  }

  CardRecord _calculateNextState(CardRecord card, int rating, double r) {
    final now = DateTime.now().millisecondsSinceEpoch;

    final result = CardRecord(
      stability: card.stability,
      difficulty: card.difficulty,
      due: card.due,
      lastReview: now,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state,
      lastRating: rating,
    );

    final elapsedDays =
        card.lastReview != null ? (now - card.lastReview!) / dayMs : 0.0;
    final cardR = (card.stability > 0 && card.state != CardState.newCard)
        ? calcRetrievability(elapsedDays, card.stability)
        : 0.0;

    if (card.state == CardState.newCard) {
      result.stability = _initialStability(rating);
      result.difficulty = _initialDifficulty(rating);

      if (rating == 1 || rating == 2) {
        result.state = CardState.learning;
        result.due = now + (rating == 1 ? minMs : 5 * minMs);
      } else {
        result.state = CardState.review;
        result.reps += 1;
        final interval = calcNextInterval(result.stability, r);
        result.due = now + interval * dayMs;
      }
    } else if (card.state == CardState.learning ||
        card.state == CardState.relearning) {
      result.difficulty = _updateDifficulty(card.difficulty, rating);

      if (rating == 1) {
        result.due = now + minMs;
      } else if (rating == 2) {
        result.due = now + 5 * minMs;
      } else {
        result.stability = _initialStability(rating);
        result.state = CardState.review;
        result.reps += 1;
        final interval = calcNextInterval(result.stability, r);
        result.due = now + interval * dayMs;
      }
    } else {
      result.difficulty = _updateDifficulty(card.difficulty, rating);

      if (rating == 1) {
        result.lapses += 1;
        result.stability =
            _stabilityForgetting(card.stability, card.difficulty, cardR);
        result.state = CardState.relearning;
        result.due = now + minMs;
      } else {
        result.stability =
            _stabilityRecall(card.stability, card.difficulty, cardR, rating);
        result.state = CardState.review;
        result.reps += 1;
        result.due = now + calcNextInterval(result.stability, r) * dayMs;
      }
    }

    return result;
  }

  Future<ReviewResult> reviewCard(String id, int rating,
      {double desiredRetention = 0.9}) async {
    if (id.isEmpty) {
      throw ArgumentError('id wajib diisi');
    }
    if (rating < 1 || rating > 4) {
      throw ArgumentError('rating harus 1-4');
    }
    await load();
    final card = _cards[id] ?? CardRecord.fresh();
    final next = _calculateNextState(card, rating, desiredRetention);
    _cards[id] = next;
    await _persist();

    final intervalDays = math.max<int>(
        0, ((next.due - DateTime.now().millisecondsSinceEpoch) / dayMs).round());
    final ret = calcRetrievability(0, next.stability);
    return ReviewResult(
      stability: (next.stability * 100).round() / 100,
      difficulty: (next.difficulty * 100).round() / 100,
      due: next.due,
      interval: intervalDays,
      retrievability: (ret * 1000).round() / 1000,
      state: next.state,
    );
  }

  List<String> buildSession(List<String> ids, {int newLimit = 10}) {
    final now = DateTime.now().millisecondsSinceEpoch;
    final learning = <MapEntry<String, int>>[];
    final dueReview = <MapEntry<String, int>>[];
    final newCards = <String>[];

    for (final id in ids) {
      final card = _cards[id];
      if (card == null || card.state == CardState.newCard) {
        newCards.add(id);
        continue;
      }
      if (card.state == CardState.learning ||
          card.state == CardState.relearning) {
        if (card.due <= now + dayMs) {
          learning.add(MapEntry(id, card.due));
        }
      } else if (card.state == CardState.review && card.due <= now) {
        dueReview.add(MapEntry(id, card.due));
      }
    }

    dueReview.sort((a, b) => a.value.compareTo(b.value));
    newCards.shuffle();

    final result = <String>[];
    result.addAll(learning.map((e) => e.key));
    result.addAll(dueReview.map((e) => e.key));
    result.addAll(newCards.take(newLimit));
    return result;
  }

  FsrsStats getStats(List<String> ids) {
    final now = DateTime.now().millisecondsSinceEpoch;
    var newCount = 0;
    var dueCount = 0;
    var learnedCount = 0;
    var matureCount = 0;
    var sumRet = 0.0;
    var retCount = 0;

    for (final id in ids) {
      final card = _cards[id];
      if (card == null || card.state == CardState.newCard) {
        newCount++;
        continue;
      }
      learnedCount++;
      if (card.stability >= 21) matureCount++;
      if (card.state == CardState.review && card.due <= now) dueCount++;
      if ((card.state == CardState.learning ||
              card.state == CardState.relearning) &&
          card.due <= now + dayMs) {
        dueCount++;
      }
      if (card.stability > 0 && card.lastReview != null) {
        final elapsed = (now - card.lastReview!) / dayMs;
        sumRet += calcRetrievability(elapsed, card.stability);
        retCount++;
      }
    }

    return FsrsStats(
      total: ids.length,
      newCount: newCount,
      dueCount: dueCount,
      learnedCount: learnedCount,
      matureCount: matureCount,
      averageRetention: retCount > 0
          ? (sumRet / retCount * 1000).round() / 1000
          : 0,
    );
  }

  double getRetrievability(String id) {
    final card = _cards[id];
    if (card == null ||
        card.state == CardState.newCard ||
        card.stability <= 0) {
      return 0;
    }
    final elapsed = card.lastReview != null
        ? (DateTime.now().millisecondsSinceEpoch - card.lastReview!) / dayMs
        : 0.0;
    return (calcRetrievability(elapsed, card.stability) * 1000).round() / 1000;
  }

  Future<void> resetCard(String id) async {
    await load();
    _cards.remove(id);
    await _persist();
  }

  Future<void> resetAll() async {
    _cards = {};
    await _persist();
  }
}
