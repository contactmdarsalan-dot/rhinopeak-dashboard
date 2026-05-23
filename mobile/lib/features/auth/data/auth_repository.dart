import 'package:flutter/foundation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/storage/token_store.dart';
import '../../../core/utils/background.dart';
import '../../../shared/models/rhino_models.dart';

class AuthResult {
  const AuthResult({
    required this.user,
    required this.tokens,
    required this.bootstrap,
  });

  final CurrentUser user;
  final SessionTokens tokens;
  final BootstrapData bootstrap;
}

class AuthRepository {
  const AuthRepository(this._api);

  final ApiClient _api;

  Future<AuthResult> login(String email, String password) async {
    final data = await _api.post(
      '/auth/login',
      auth: false,
      data: {'email': email, 'password': password},
    );
    return _authResult(data);
  }

  Future<AuthResult> register({
    required String name,
    required String email,
    required String password,
    required String businessName,
  }) async {
    final data = await _api.post(
      '/auth/register',
      auth: false,
      data: {
        'name': name,
        'email': email,
        'password': password,
        'businessName': businessName,
      },
    );
    return _authResult(data);
  }

  Future<void> requestPasswordReset(String email) async {
    await _api.post(
      '/auth/password/request',
      auth: false,
      data: {'email': email},
    );
  }

  Future<void> logout(String refreshToken) async {
    await _api.post('/auth/logout', data: {'refreshToken': refreshToken});
  }

  Future<AuthResult> _authResult(Map<String, dynamic> data) async {
    final bootstrap = await compute(
      parseBootstrap,
      Map<String, dynamic>.from(data['bootstrap'] as Map),
    );
    return AuthResult(
      user: CurrentUser.fromJson(
        Map<String, dynamic>.from(data['user'] as Map),
      ),
      tokens: SessionTokens.fromJson(
        Map<String, dynamic>.from(data['session'] as Map),
      ),
      bootstrap: bootstrap,
    );
  }
}
