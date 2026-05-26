import 'package:flutter_test/flutter_test.dart';
import 'package:rhinopeak_mobile/services/offline_service.dart';
import 'package:rhinopeak_mobile/services/push_notification_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('queues and completes offline sync operations', () async {
    final service = OfflineService();

    await service.queueSyncOperation(
      entityType: 'sales',
      entityId: 'sale-1',
      operation: 'create',
      data: {'id': 'sale-1', 'amount': 1250},
    );

    final pending = await service.pendingSyncOperations();
    expect(pending, hasLength(1));
    expect(pending.first['entityType'], 'sales');
    expect(pending.first['operation'], 'create');

    await service.completeSyncOperation(pending.first['id'].toString());
    expect(await service.pendingSyncOperations(), isEmpty);
  });

  test('stores push notification token and notifies listeners', () async {
    final service = PushNotificationService();
    final seenTokens = <String>[];
    service.addTokenHandler(seenTokens.add);

    await service.saveToken('push-token-123');

    expect(await service.token(), 'push-token-123');
    expect(seenTokens, ['push-token-123']);
  });
}
