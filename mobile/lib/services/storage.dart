import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class Storage {
  static const String fsrsKey = 'eznihongo_fsrs_v1';
  static const String settingsKey = 'eznihongo_settings_v1';

  final SharedPreferences _prefs;

  Storage._(this._prefs);

  static Future<Storage> create() async {
    final prefs = await SharedPreferences.getInstance();
    return Storage._(prefs);
  }

  Map<String, dynamic> readJsonMap(String key) {
    final raw = _prefs.getString(key);
    if (raw == null || raw.isEmpty) return <String, dynamic>{};
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) return decoded;
      if (decoded is Map) return decoded.cast<String, dynamic>();
      return <String, dynamic>{};
    } catch (_) {
      return <String, dynamic>{};
    }
  }

  Future<bool> writeJsonMap(String key, Map<String, dynamic> data) {
    return _prefs.setString(key, jsonEncode(data));
  }

  Future<bool> remove(String key) => _prefs.remove(key);
}
