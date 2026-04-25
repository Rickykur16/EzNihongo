import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;
import '../models/kanji.dart';

class KanjiRepository {
  List<Kanji> _all = const [];
  Map<String, Kanji> _byId = const {};
  Map<String, List<Kanji>> _byLevel = const {};
  bool _loaded = false;

  Future<void> load() async {
    if (_loaded) return;
    final jsonStr = await rootBundle.loadString('assets/kanji-data.json');
    final raw = jsonDecode(jsonStr) as List;
    final list = raw
        .whereType<Map>()
        .map((m) => Kanji.fromJson(m.cast<String, dynamic>()))
        .toList(growable: false);
    _all = list;
    _byId = {for (final k in list) k.id: k};
    final byLevel = <String, List<Kanji>>{for (final lv in kJlptLevels) lv: <Kanji>[]};
    for (final k in list) {
      (byLevel[k.level] ??= <Kanji>[]).add(k);
    }
    _byLevel = byLevel.map((k, v) => MapEntry(k, List.unmodifiable(v)));
    _loaded = true;
  }

  List<Kanji> get all => _all;
  Kanji? byId(String id) => _byId[id];
  List<Kanji> byLevel(String level) => _byLevel[level] ?? const [];
  List<String> idsForLevel(String level) =>
      _byLevel[level]?.map((k) => k.id).toList(growable: false) ?? const [];
}
