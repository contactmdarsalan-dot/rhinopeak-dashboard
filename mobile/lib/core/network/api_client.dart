import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../storage/token_store.dart';

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient(this._tokenStore)
    : _dio = Dio(
        BaseOptions(
          baseUrl: AppConfig.apiBaseUrl,
          connectTimeout: const Duration(seconds: 12),
          receiveTimeout: const Duration(seconds: 20),
          headers: const {'Accept': 'application/json'},
        ),
      );

  final TokenStore _tokenStore;
  final Dio _dio;

  Future<Map<String, dynamic>> get(String path, {bool auth = true}) {
    return request('GET', path, auth: auth);
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? data,
    bool auth = true,
  }) {
    return request('POST', path, data: data, auth: auth);
  }

  Future<Map<String, dynamic>> patch(
    String path, {
    Map<String, dynamic>? data,
    bool auth = true,
  }) {
    return request('PATCH', path, data: data, auth: auth);
  }

  Future<Map<String, dynamic>> delete(
    String path, {
    Map<String, dynamic>? data,
    bool auth = true,
  }) {
    return request('DELETE', path, data: data, auth: auth);
  }

  Future<Map<String, dynamic>> request(
    String method,
    String path, {
    Map<String, dynamic>? data,
    bool auth = true,
    bool retryOnUnauthorized = true,
  }) async {
    try {
      final response = await _dio.request<Map<String, dynamic>>(
        path,
        data: data,
        options: Options(method: method, headers: await _headers(auth)),
      );
      return response.data ?? <String, dynamic>{};
    } on DioException catch (error) {
      if (auth && retryOnUnauthorized && error.response?.statusCode == 401) {
        final refreshed = await _refreshSession();
        if (refreshed) {
          return request(
            method,
            path,
            data: data,
            auth: auth,
            retryOnUnauthorized: false,
          );
        }
      }
      final responseData = error.response?.data;
      String message = 'Request failed.';
      if (responseData is Map) {
        if (responseData.containsKey('error')) {
          message = responseData['error']?.toString() ?? 'Request failed.';
        } else if (responseData.containsKey('detail')) {
          message = responseData['detail']?.toString() ?? 'Request failed.';
        } else if (responseData.containsKey('message')) {
          message = responseData['message']?.toString() ?? 'Request failed.';
        } else {
          final parts = <String>[];
          responseData.forEach((key, val) {
            if (val is List) {
              parts.add('$key: ${val.join(", ")}');
            } else if (val != null) {
              parts.add('$key: $val');
            }
          });
          if (parts.isNotEmpty) {
            message = parts.join('\n');
          } else {
            message = 'Request failed.';
          }
        }
      } else if (responseData is String) {
        final trimmed = responseData.trim();
        if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
          message =
              error.response?.statusMessage ??
              error.message ??
              'Request failed.';
        } else if (trimmed.isNotEmpty) {
          message = trimmed;
        } else {
          message = error.message ?? 'Request failed.';
        }
      } else {
        message = error.message ?? 'Request failed.';
      }
      throw ApiException(message, statusCode: error.response?.statusCode);
    }
  }

  Future<Map<String, String>> _headers(bool auth) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (!auth) return headers;
    final tokens = await _tokenStore.read();
    if (tokens != null && tokens.accessToken.isNotEmpty) {
      headers['Authorization'] = 'Bearer ${tokens.accessToken}';
    }
    return headers;
  }

  Future<bool> _refreshSession() async {
    final tokens = await _tokenStore.read();
    if (tokens == null || tokens.refreshToken.isEmpty) return false;
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': tokens.refreshToken},
        options: Options(headers: {'Content-Type': 'application/json'}),
      );
      final session = response.data?['session'];
      if (session is! Map<String, dynamic>) return false;
      final next = SessionTokens.fromJson(session);
      if (!next.isValid) return false;
      await _tokenStore.save(next);
      return true;
    } catch (_) {
      await _tokenStore.clear();
      return false;
    }
  }
}
