import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/kanji.dart';
import '../services/fsrs.dart';
import '../services/kanji_repository.dart';
import '../services/storage.dart';

final storageProvider = FutureProvider<Storage>((ref) async {
  return Storage.create();
});

final kanjiRepositoryProvider = FutureProvider<KanjiRepository>((ref) async {
  final repo = KanjiRepository();
  await repo.load();
  return repo;
});

final fsrsProvider = FutureProvider<FsrsEngine>((ref) async {
  final storage = await ref.watch(storageProvider.future);
  final engine = FsrsEngine(storage);
  await engine.load();
  return engine;
});

final selectedLevelProvider = StateProvider<String>((ref) => 'N5');

class FsrsRevision {
  final int value;
  const FsrsRevision(this.value);
}

final fsrsRevisionProvider = StateProvider<FsrsRevision>(
  (ref) => const FsrsRevision(0),
);

final levelKanjiProvider = FutureProvider.family<List<Kanji>, String>(
  (ref, level) async {
    final repo = await ref.watch(kanjiRepositoryProvider.future);
    return repo.byLevel(level);
  },
);

final levelStatsProvider = FutureProvider.family<FsrsStats, String>(
  (ref, level) async {
    ref.watch(fsrsRevisionProvider);
    final repo = await ref.watch(kanjiRepositoryProvider.future);
    final fsrs = await ref.watch(fsrsProvider.future);
    return fsrs.getStats(repo.idsForLevel(level));
  },
);
