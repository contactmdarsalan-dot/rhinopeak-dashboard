class RedisCacheService {
  RedisCacheService({this.defaultTtl = const Duration(minutes: 5)});

  final Duration defaultTtl;
  final Map<String, _CacheEntry> _memory = {};

  Future<T?> get<T>(String key) async {
    final entry = _memory[key];
    if (entry == null) return null;
    if (entry.isExpired) {
      _memory.remove(key);
      return null;
    }
    return entry.value as T?;
  }

  Future<void> set(
    String key,
    Object? value, {
    Duration? ttl,
  }) async {
    _memory[key] = _CacheEntry(
      value: value,
      expiresAt: DateTime.now().add(ttl ?? defaultTtl),
    );
  }

  Future<T> getOrSet<T>(
    String key,
    Future<T> Function() fetch, {
    Duration? ttl,
  }) async {
    final cached = await get<T>(key);
    if (cached != null) return cached;
    final value = await fetch();
    await set(key, value as Object?, ttl: ttl);
    return value;
  }

  Future<void> delete(String key) async {
    _memory.remove(key);
  }

  Future<void> clear({String? prefix}) async {
    if (prefix == null) {
      _memory.clear();
      return;
    }
    _memory.removeWhere((key, _) => key.startsWith(prefix));
  }

  CacheStats stats() => CacheStats(entries: _memory.length);
}

class _CacheEntry {
  const _CacheEntry({
    required this.value,
    required this.expiresAt,
  });

  final Object? value;
  final DateTime expiresAt;

  bool get isExpired => DateTime.now().isAfter(expiresAt);
}

class CacheStats {
  const CacheStats({required this.entries});

  final int entries;
}

final redisCacheService = RedisCacheService();
