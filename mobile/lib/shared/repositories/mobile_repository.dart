import 'package:flutter/foundation.dart';

import '../../core/network/api_client.dart';
import '../../core/utils/background.dart';
import '../models/rhino_models.dart';

class MobileRepository {
  const MobileRepository(this._api);

  final ApiClient _api;

  Future<BootstrapData> mobileBootstrap() async {
    final raw = await mobileBootstrapJson();
    return compute(parseBootstrap, raw);
  }

  Future<Map<String, dynamic>> mobileBootstrapJson() async {
    final data = await _api.get('/mobile/bootstrap');
    return Map<String, dynamic>.from(data['bootstrap'] as Map);
  }

  Future<Map<String, dynamic>> getDetail(String entity, String id) async {
    final safeEntity = Uri.encodeComponent(entity);
    final safeId = Uri.encodeComponent(id);
    final data = await _api.get('/details/$safeEntity/$safeId');
    return Map<String, dynamic>.from(data['detail'] as Map);
  }

  Future<BootstrapData> patchSettings(Map<String, dynamic> patch) async {
    final data = await _api.patch('/settings', data: patch);
    if (data['bootstrap'] is Map) return _bootstrapFromResponse(data);
    return mobileBootstrap();
  }

  Future<BootstrapData> createSale(Map<String, dynamic> sale) async {
    final data = await _api.post('/sales', data: sale);
    return _bootstrapFromResponse(data);
  }

  Future<BootstrapData> createExpense(Map<String, dynamic> expense) async {
    final data = await _api.post('/expenses', data: expense);
    return _bootstrapFromResponse(data);
  }

  Future<BootstrapData> createProduct(Map<String, dynamic> product) async {
    await _api.post('/inventory', data: product);
    return mobileBootstrap();
  }

  Future<BootstrapData> createInventoryCategory(String name) async {
    await _api.post('/inventory/categories', data: {'name': name});
    return mobileBootstrap();
  }

  Future<BootstrapData> recordStockMovement(
      Map<String, dynamic> movement) async {
    final data = await _api.post('/inventory/movements', data: movement);
    return _bootstrapFromResponse(data);
  }

  Future<BootstrapData> _bootstrapFromResponse(Map<String, dynamic> data) {
    final raw = Map<String, dynamic>.from(data['bootstrap'] as Map);
    return compute(parseBootstrap, raw);
  }
}
