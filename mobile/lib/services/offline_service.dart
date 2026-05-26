import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class OfflineService {
  static const _cachePrefix = 'rhinopeak.offline.cache.';
  static const _queueKey = 'rhinopeak.offline.syncQueue';
  static const _settingsKey = 'rhinopeak.offline.settings';

  Future<void> cacheData({
    required String key,
    required Object? data,
    String? namespace,
    Duration? ttl,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final entry = {
      'data': data,
      'createdAt': DateTime.now().toIso8601String(),
      'ttlSeconds': ttl?.inSeconds,
    };
    await prefs.setString(_cacheKey(key, namespace), jsonEncode(entry));
  }

  Future<T?> getCachedData<T>({
    required String key,
    String? namespace,
    bool validateTtl = true,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_cacheKey(key, namespace));
    if (raw == null || raw.isEmpty) return null;

    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) return null;
      final ttlSeconds = decoded['ttlSeconds'];
      final createdAt = DateTime.tryParse('${decoded['createdAt']}');
      if (validateTtl && ttlSeconds is int && createdAt != null) {
        final age = DateTime.now().difference(createdAt);
        if (age.inSeconds > ttlSeconds) {
          await prefs.remove(_cacheKey(key, namespace));
          return null;
        }
      }
      return decoded['data'] as T?;
    } catch (_) {
      await prefs.remove(_cacheKey(key, namespace));
      return null;
    }
  }

  Future<void> invalidateCache(String key, {String? namespace}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_cacheKey(key, namespace));
  }

  Future<void> clearNamespace(String namespace) async {
    final prefs = await SharedPreferences.getInstance();
    final prefix = '$_cachePrefix$namespace:';
    for (final key in prefs.getKeys().where((key) => key.startsWith(prefix))) {
      await prefs.remove(key);
    }
  }

  Future<void> queueSyncOperation({
    required String entityType,
    required String entityId,
    required String operation,
    required Map<String, dynamic> data,
  }) async {
    final queue = await pendingSyncOperations();
    queue.add({
      'id': '${DateTime.now().millisecondsSinceEpoch}-$entityType-$entityId',
      'entityType': entityType,
      'entityId': entityId,
      'operation': operation,
      'data': data,
      'createdAt': DateTime.now().toIso8601String(),
      'attempts': 0,
    });
    await _saveQueue(queue);
  }

  Future<List<Map<String, dynamic>>> pendingSyncOperations() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_queueKey);
    if (raw == null || raw.isEmpty) return [];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return [];
    return decoded
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Future<void> completeSyncOperation(String id) async {
    final queue = await pendingSyncOperations();
    queue.removeWhere((item) => item['id'] == id);
    await _saveQueue(queue);
  }

  Future<void> markSyncFailed(String id, Object error) async {
    final queue = await pendingSyncOperations();
    for (final item in queue) {
      if (item['id'] == id) {
        item['attempts'] = (item['attempts'] as int? ?? 0) + 1;
        item['lastError'] = error.toString();
      }
    }
    await _saveQueue(queue);
  }

  Future<OfflineSettings> settings() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_settingsKey);
    if (raw == null || raw.isEmpty) return const OfflineSettings();
    final decoded = jsonDecode(raw);
    if (decoded is! Map<String, dynamic>) return const OfflineSettings();
    return OfflineSettings(
      autoSync: decoded['autoSync'] as bool? ?? true,
      wifiOnly: decoded['wifiOnly'] as bool? ?? false,
      maxCacheAgeHours: decoded['maxCacheAgeHours'] as int? ?? 24,
    );
  }

  Future<void> saveSettings(OfflineSettings settings) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_settingsKey, jsonEncode(settings.toJson()));
  }

  Future<OfflineStats> stats() async {
    final prefs = await SharedPreferences.getInstance();
    final queue = await pendingSyncOperations();
    final cacheEntries = prefs.getKeys().where((key) => key.startsWith(_cachePrefix)).length;
    return OfflineStats(cacheEntries: cacheEntries, queuedOperations: queue.length);
  }

  Future<void> clearAll() async {
    final prefs = await SharedPreferences.getInstance();
    for (final key in prefs.getKeys().where((key) => key.startsWith(_cachePrefix))) {
      await prefs.remove(key);
    }
    await prefs.remove(_queueKey);
  }

  Future<void> _saveQueue(List<Map<String, dynamic>> queue) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_queueKey, jsonEncode(queue));
  }

  String _cacheKey(String key, String? namespace) {
    return namespace == null ? '$_cachePrefix$key' : '$_cachePrefix$namespace:$key';
  }
}

class OfflineSettings {
  const OfflineSettings({
    this.autoSync = true,
    this.wifiOnly = false,
    this.maxCacheAgeHours = 24,
  });

  final bool autoSync;
  final bool wifiOnly;
  final int maxCacheAgeHours;

  Map<String, dynamic> toJson() => {
        'autoSync': autoSync,
        'wifiOnly': wifiOnly,
        'maxCacheAgeHours': maxCacheAgeHours,
      };
}

class OfflineStats {
  const OfflineStats({
    required this.cacheEntries,
    required this.queuedOperations,
  });

  final int cacheEntries;
  final int queuedOperations;
}

final offlineService = OfflineService();
