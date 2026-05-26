import 'dart:async';

import 'package:flutter/services.dart';

typedef DeepLinkHandler = void Function(Uri uri);

class DeepLinkService {
  static const _channel = MethodChannel('com.rhinopeak.mobile/deep_links');

  final List<DeepLinkHandler> _handlers = [];
  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'linkOpened' && call.arguments is String) {
        _emit(call.arguments as String);
      }
    });
    try {
      final initial = await _channel.invokeMethod<String>('initialLink');
      if (initial != null && initial.isNotEmpty) {
        scheduleMicrotask(() => _emit(initial));
      }
    } on MissingPluginException {
      return;
    } on PlatformException {
      return;
    }
  }

  void addHandler(DeepLinkHandler handler) {
    _handlers.add(handler);
  }

  void removeHandler(DeepLinkHandler handler) {
    _handlers.remove(handler);
  }

  void _emit(String value) {
    final uri = Uri.tryParse(value);
    if (uri == null) return;
    for (final handler in List<DeepLinkHandler>.from(_handlers)) {
      handler(uri);
    }
  }
}

final deepLinkService = DeepLinkService();
