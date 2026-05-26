import 'package:flutter/services.dart';

class BiometricService {
  static const _channel = MethodChannel('com.rhinopeak.mobile/biometric');

  Future<BiometricCapability> checkCapability() async {
    try {
      final result = await _channel.invokeMapMethod<String, Object?>('capability');
      return BiometricCapability(
        available: result?['available'] as bool? ?? false,
        enrolled: result?['enrolled'] as bool? ?? false,
        type: result?['type'] as String?,
      );
    } on MissingPluginException {
      return const BiometricCapability(available: false, enrolled: false);
    } on PlatformException {
      return const BiometricCapability(available: false, enrolled: false);
    }
  }

  Future<bool> authenticate({
    required String reason,
    bool allowDeviceCredential = true,
  }) async {
    try {
      final result = await _channel.invokeMethod<bool>('authenticate', {
        'reason': reason,
        'allowDeviceCredential': allowDeviceCredential,
      });
      return result ?? false;
    } on MissingPluginException {
      return false;
    } on PlatformException {
      return false;
    }
  }
}

class BiometricCapability {
  const BiometricCapability({
    required this.available,
    required this.enrolled,
    this.type,
  });

  final bool available;
  final bool enrolled;
  final String? type;

  bool get canAuthenticate => available && enrolled;
}

final biometricService = BiometricService();
