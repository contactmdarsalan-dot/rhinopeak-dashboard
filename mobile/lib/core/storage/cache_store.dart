import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class CacheStore {
  static const _bootstrapKey = 'rhinopeak.bootstrap';

  Future<Map<String, dynamic>?> readBootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    final text = prefs.getString(_bootstrapKey);
    if (text == null || text.isEmpty) return null;
    final decoded = jsonDecode(text);
    return decoded is Map<String, dynamic> ? decoded : null;
  }

  Future<void> saveBootstrap(Map<String, dynamic> bootstrap) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_bootstrapKey, jsonEncode(bootstrap));
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_bootstrapKey);
  }
}
