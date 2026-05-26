import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

typedef PushNotificationHandler = void Function(Map<String, dynamic> payload);
typedef PushTokenHandler = void Function(String token);

class PushNotificationService {
  static const _channel = MethodChannel('com.rhinopeak.mobile/push');
  static const _tokenKey = 'rhinopeak.push.token';

  final List<PushNotificationHandler> _handlers = [];
  final List<PushTokenHandler> _tokenHandlers = [];

  Future<void> initialize() async {
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'notificationOpened') {
        final payload = _payloadFromArguments(call.arguments);
        for (final handler in List<PushNotificationHandler>.from(_handlers)) {
          handler(payload);
        }
      }
      if (call.method == 'tokenUpdated' && call.arguments is String) {
        await saveToken(call.arguments as String);
      }
    });
    try {
      final token = await _channel.invokeMethod<String>('initialize');
      if (token != null && token.isNotEmpty) {
        await saveToken(token);
      }
    } on MissingPluginException {
      return;
    } on PlatformException {
      return;
    }
  }

  Future<bool> requestPermission() async {
    try {
      return await _channel.invokeMethod<bool>('requestPermission') ?? false;
    } on MissingPluginException {
      return false;
    } on PlatformException {
      return false;
    }
  }

  Future<String?> token() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    for (final handler in List<PushTokenHandler>.from(_tokenHandlers)) {
      handler(token);
    }
  }

  Future<void> showLocalBusinessNotification({
    required String title,
    required String body,
    Map<String, dynamic>? data,
  }) async {
    try {
      await _channel.invokeMethod<void>('showLocalNotification', {
        'title': title,
        'body': body,
        'payload': jsonEncode(data ?? const <String, dynamic>{}),
      });
    } on MissingPluginException {
      return;
    } on PlatformException {
      return;
    }
  }

  void addHandler(PushNotificationHandler handler) {
    _handlers.add(handler);
  }

  void removeHandler(PushNotificationHandler handler) {
    _handlers.remove(handler);
  }

  void addTokenHandler(PushTokenHandler handler) {
    _tokenHandlers.add(handler);
  }

  void removeTokenHandler(PushTokenHandler handler) {
    _tokenHandlers.remove(handler);
  }

  Map<String, dynamic> _payloadFromArguments(Object? arguments) {
    if (arguments is String) {
      try {
        final decoded = jsonDecode(arguments);
        if (decoded is Map) return Map<String, dynamic>.from(decoded);
      } on FormatException {
        return {'payload': arguments};
      }
      return {'payload': arguments};
    }
    if (arguments is Map) {
      final payload = Map<String, dynamic>.from(arguments);
      final nested = payload['payload'];
      if (nested is String && nested.isNotEmpty) {
        try {
          final decoded = jsonDecode(nested);
          if (decoded is Map) {
            payload.addAll(Map<String, dynamic>.from(decoded));
          }
        } on FormatException {
          payload['payload'] = nested;
        }
      }
      return payload;
    }
    return const <String, dynamic>{};
  }
}

final pushNotificationService = PushNotificationService();
