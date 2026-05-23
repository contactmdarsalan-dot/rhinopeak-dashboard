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

  Future<BootstrapData> createRecord(
    String entity,
    Map<String, dynamic> record,
  ) async {
    final data = await _api.post(
      '/mobile/${_createPath(entity)}',
      data: record,
    );
    return _bootstrapOrRefresh(data);
  }

  Future<BootstrapData> updateRecord(
    String entity,
    String id,
    Map<String, dynamic> patch,
  ) async {
    final safeId = Uri.encodeComponent(id);
    final data = await _api.patch(
      '/mobile/${_entityPath(entity)}/$safeId',
      data: patch,
    );
    return _bootstrapOrRefresh(data);
  }

  Future<BootstrapData> deleteRecord(String entity, String id) async {
    final safeId = Uri.encodeComponent(id);
    final data = await _api.delete('/mobile/${_entityPath(entity)}/$safeId');
    return _bootstrapOrRefresh(data);
  }

  Future<BootstrapData> createSale(Map<String, dynamic> sale) async {
    final data = await _api.post('/mobile/sales', data: sale);
    return _bootstrapFromResponse(data);
  }

  Future<BootstrapData> createExpense(Map<String, dynamic> expense) async {
    final data = await _api.post('/mobile/expenses', data: expense);
    return _bootstrapFromResponse(data);
  }

  Future<BootstrapData> createProduct(Map<String, dynamic> product) async {
    await _api.post('/mobile/inventory', data: product);
    return mobileBootstrap();
  }

  Future<BootstrapData> createInventoryCategory(String name) async {
    await _api.post('/mobile/inventory/categories', data: {'name': name});
    return mobileBootstrap();
  }

  Future<BootstrapData> updateInventoryCategory(
    String oldName,
    String newName,
  ) async {
    final safeName = Uri.encodeComponent(oldName);
    await _api.patch(
      '/mobile/inventory/categories/$safeName',
      data: {'name': newName},
    );
    return mobileBootstrap();
  }

  Future<BootstrapData> deleteInventoryCategory(String name) async {
    final safeName = Uri.encodeComponent(name);
    await _api.delete('/mobile/inventory/categories/$safeName');
    return mobileBootstrap();
  }

  Future<BootstrapData> recordStockMovement(
    Map<String, dynamic> movement,
  ) async {
    final data = await _api.post('/mobile/inventory/movements', data: movement);
    return _bootstrapFromResponse(data);
  }

  Future<Map<String, dynamic>> uploadBillScan(
    Map<String, dynamic> input,
  ) async {
    final data = await _api.post('/mobile/bill-scans/upload', data: input);
    return Map<String, dynamic>.from(data['billScan'] as Map);
  }

  Future<Map<String, dynamic>> parseBillScan(
    String scanId,
    String rawText,
  ) async {
    final safeId = Uri.encodeComponent(scanId);
    final data = await _api.post(
      '/mobile/bill-scans/$safeId/parse',
      data: {'rawText': rawText},
    );
    return {
      'billScan': Map<String, dynamic>.from(data['billScan'] as Map),
      'parsed': Map<String, dynamic>.from(data['parsed'] as Map),
    };
  }

  Future<BootstrapData> approveBillScan({
    required String scanId,
    required String targetRecordType,
    required Map<String, dynamic> approved,
  }) async {
    final safeId = Uri.encodeComponent(scanId);
    final data = await _api.post(
      '/mobile/bill-scans/$safeId/approve',
      data: {'targetRecordType': targetRecordType, 'approved': approved},
    );
    return _bootstrapFromResponse(data);
  }

  Future<BootstrapData> pushOfflineOperation(Map<String, dynamic> operation) {
    return createRecord('sync-operations', operation);
  }

  Future<BootstrapData> _bootstrapOrRefresh(Map<String, dynamic> data) {
    if (data['bootstrap'] is Map) return _bootstrapFromResponse(data);
    return mobileBootstrap();
  }

  Future<BootstrapData> _bootstrapFromResponse(Map<String, dynamic> data) {
    final raw = Map<String, dynamic>.from(data['bootstrap'] as Map);
    return compute(parseBootstrap, raw);
  }

  String _createPath(String entity) {
    switch (entity) {
      case 'inventory-movements':
        return 'inventory/movements';
      case 'sync-operations':
        return 'sync/push';
      default:
        return _entityPath(entity);
    }
  }

  String _entityPath(String entity) {
    return Uri.encodeComponent(entity);
  }
}
