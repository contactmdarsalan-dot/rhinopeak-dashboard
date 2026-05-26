import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/storage/cache_store.dart';
import '../../core/storage/token_store.dart';
import '../../core/utils/background.dart';
import '../../features/auth/data/auth_repository.dart';
import '../../services/offline_service.dart';
import '../../services/push_notification_service.dart';
import '../../shared/models/rhino_models.dart';
import '../../shared/repositories/mobile_repository.dart';
import '../localization/app_strings.dart';

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());
final cacheStoreProvider = Provider<CacheStore>((ref) => CacheStore());
final apiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(ref.watch(tokenStoreProvider)),
);
final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(apiClientProvider)),
);
final mobileRepositoryProvider = Provider<MobileRepository>(
  (ref) => MobileRepository(ref.watch(apiClientProvider)),
);

final appControllerProvider = StateNotifierProvider<AppController, AppState>((
  ref,
) {
  return AppController(
    authRepository: ref.watch(authRepositoryProvider),
    mobileRepository: ref.watch(mobileRepositoryProvider),
    tokenStore: ref.watch(tokenStoreProvider),
    cacheStore: ref.watch(cacheStoreProvider),
  );
});

class AppState {
  const AppState({
    required this.initializing,
    required this.loading,
    required this.authenticated,
    required this.language,
    this.user,
    this.bootstrap,
    this.error,
    this.notice,
  });

  const AppState.initial()
      : initializing = true,
        loading = false,
        authenticated = false,
        language = AppLanguage.en,
        user = null,
        bootstrap = null,
        error = null,
        notice = null;

  final bool initializing;
  final bool loading;
  final bool authenticated;
  final AppLanguage language;
  final CurrentUser? user;
  final BootstrapData? bootstrap;
  final String? error;
  final String? notice;

  AppState copyWith({
    bool? initializing,
    bool? loading,
    bool? authenticated,
    AppLanguage? language,
    CurrentUser? user,
    BootstrapData? bootstrap,
    String? error,
    String? notice,
    bool clearError = false,
    bool clearNotice = false,
  }) {
    return AppState(
      initializing: initializing ?? this.initializing,
      loading: loading ?? this.loading,
      authenticated: authenticated ?? this.authenticated,
      language: language ?? this.language,
      user: user ?? this.user,
      bootstrap: bootstrap ?? this.bootstrap,
      error: clearError ? null : error ?? this.error,
      notice: clearNotice ? null : notice ?? this.notice,
    );
  }
}

class AppController extends StateNotifier<AppState> {
  AppController({
    required AuthRepository authRepository,
    required MobileRepository mobileRepository,
    required TokenStore tokenStore,
    required CacheStore cacheStore,
  })  : _authRepository = authRepository,
        _mobileRepository = mobileRepository,
        _tokenStore = tokenStore,
        _cacheStore = cacheStore,
        super(const AppState.initial());

  final AuthRepository _authRepository;
  final MobileRepository _mobileRepository;
  final TokenStore _tokenStore;
  final CacheStore _cacheStore;

  Future<void> initialize() async {
    final cached = await _cacheStore.readBootstrap();
    final tokens = await _tokenStore.read();
    if (cached != null) {
      final bootstrap = await compute(parseBootstrap, cached);
      state = state.copyWith(
        bootstrap: bootstrap,
        language: bootstrap.settings.language,
        authenticated: tokens != null,
      );
    }
    if (tokens == null) {
      state = state.copyWith(initializing: false);
      return;
    }
    await syncPendingOperations();
    await refreshBootstrap();
    state = state.copyWith(initializing: false);
  }

  Future<void> login(String email, String password) async {
    await _withLoading(() async {
      final result = await _authRepository.login(email, password);
      await _completeAuth(result);
    });
  }

  Future<void> register({
    required String name,
    required String email,
    required String password,
    required String businessName,
  }) async {
    await _withLoading(() async {
      final result = await _authRepository.register(
        name: name,
        email: email,
        password: password,
        businessName: businessName,
      );
      await _completeAuth(result);
    });
  }

  Future<void> requestPasswordReset(String email) async {
    await _withLoading(() async {
      await _authRepository.requestPasswordReset(email);
      state = state.copyWith(
        notice: AppStrings.tr(state.language, 'passwordResetSent'),
        clearError: true,
      );
    });
  }

  Future<bool> resetPassword({
    required String email,
    required String token,
    required String password,
  }) async {
    state = state.copyWith(loading: true, clearError: true, clearNotice: true);
    try {
      await _authRepository.resetPassword(
        email: email,
        token: token,
        password: password,
      );
      state = state.copyWith(
        notice: AppStrings.tr(state.language, 'passwordResetSent'),
        clearError: true,
      );
      return true;
    } catch (error, stackTrace) {
      debugPrint('RESET PASSWORD ERROR: $error');
      debugPrint('STACK TRACE: $stackTrace');
      state = state.copyWith(error: error.toString());
      return false;
    } finally {
      state = state.copyWith(loading: false);
    }
  }

  Future<void> logout() async {
    final tokens = await _tokenStore.read();
    if (tokens != null) {
      try {
        await _authRepository.logout(tokens.refreshToken);
      } catch (_) {
        // Local logout must still work when the backend is unreachable.
      }
    }
    await _tokenStore.clear();
    await _cacheStore.clear();
    state = const AppState.initial().copyWith(initializing: false);
  }

  Future<void> refreshBootstrap() async {
    try {
      await syncPendingOperations();
      final raw = await _mobileRepository.mobileBootstrapJson();
      final bootstrap = await compute(parseBootstrap, raw);
      await _saveBootstrap(bootstrap);
      state = state.copyWith(
        initializing: false,
        authenticated: true,
        bootstrap: bootstrap,
        language: bootstrap.settings.language,
        clearError: true,
      );
      await registerCurrentPushToken();
    } catch (error, stackTrace) {
      debugPrint('REFRESH BOOTSTRAP ERROR: $error');
      debugPrint('STACK TRACE: $stackTrace');
      state = state.copyWith(initializing: false, error: error.toString());
    }
  }

  Future<void> setLanguage(AppLanguage language) async {
    final bootstrap = state.bootstrap;
    if (bootstrap == null) {
      state = state.copyWith(language: language);
      return;
    }
    await _withLoading(() async {
      final next = await _mobileRepository.patchSettings(
        bootstrap.settings.toPatch(nextLanguage: language),
      );
      await _saveBootstrap(next);
      state = state.copyWith(
        bootstrap: next,
        language: language,
        notice: AppStrings.tr(language, 'saved'),
        clearError: true,
      );
    });
  }

  Future<void> createSale(Map<String, dynamic> sale) {
    return _withLoading(() async {
      final next = await _onlineOrQueue(
        entity: 'sales',
        action: 'create',
        record: sale,
        online: () => _mobileRepository.createSale(sale),
      );
      await _saveBootstrap(next);
      state = state.copyWith(
        bootstrap: next,
        notice: AppStrings.tr(state.language, 'saved'),
        clearError: true,
      );
    });
  }

  Future<void> createExpense(Map<String, dynamic> expense) {
    return _withLoading(() async {
      final next = await _onlineOrQueue(
        entity: 'expenses',
        action: 'create',
        record: expense,
        online: () => _mobileRepository.createExpense(expense),
      );
      await _saveBootstrap(next);
      state = state.copyWith(
        bootstrap: next,
        notice: AppStrings.tr(state.language, 'saved'),
        clearError: true,
      );
    });
  }

  Future<void> createRecord(String entity, Map<String, dynamic> record) {
    return _withLoading(() async {
      final next = await _onlineOrQueue(
        entity: entity,
        action: 'create',
        record: record,
        online: () => _mobileRepository.createRecord(entity, record),
      );
      await _saveBootstrap(next);
      state = state.copyWith(
        bootstrap: next,
        notice: AppStrings.tr(state.language, 'saved'),
        clearError: true,
      );
    });
  }

  Future<void> updateRecord(
    String entity,
    String id,
    Map<String, dynamic> patch,
  ) {
    return _withLoading(() async {
      final next = await _onlineOrQueue(
        entity: entity,
        entityId: id,
        action: 'update',
        record: patch,
        online: () => _mobileRepository.updateRecord(entity, id, patch),
      );
      await _saveBootstrap(next);
      state = state.copyWith(
        bootstrap: next,
        notice: AppStrings.tr(state.language, 'saved'),
        clearError: true,
      );
    });
  }

  Future<void> deleteRecord(String entity, String id) {
    return _withLoading(() async {
      final next = await _onlineOrQueue(
        entity: entity,
        entityId: id,
        action: 'delete',
        record: {'id': id},
        online: () => _mobileRepository.deleteRecord(entity, id),
      );
      await _saveBootstrap(next);
      state = state.copyWith(
        bootstrap: next,
        notice: AppStrings.tr(state.language, 'saved'),
        clearError: true,
      );
    });
  }

  Future<void> createProduct(Map<String, dynamic> product) {
    return _withLoading(() async {
      final next = await _onlineOrQueue(
        entity: 'inventory',
        action: 'create',
        record: product,
        online: () => _mobileRepository.createProduct(product),
      );
      await _saveBootstrap(next);
      state = state.copyWith(
        bootstrap: next,
        notice: AppStrings.tr(state.language, 'saved'),
        clearError: true,
      );
    });
  }

  Future<void> createInventoryCategory(String name) {
    return _withLoading(() async {
      final next = await _mobileRepository.createInventoryCategory(name);
      await _saveBootstrap(next);
      state = state.copyWith(
        bootstrap: next,
        notice: AppStrings.tr(state.language, 'saved'),
        clearError: true,
      );
    });
  }

  Future<void> updateInventoryCategory(String oldName, String newName) {
    return _withLoading(() async {
      final next = await _mobileRepository.updateInventoryCategory(
        oldName,
        newName,
      );
      await _saveBootstrap(next);
      state = state.copyWith(
        bootstrap: next,
        notice: AppStrings.tr(state.language, 'saved'),
        clearError: true,
      );
    });
  }

  Future<void> deleteInventoryCategory(String name) {
    return _withLoading(() async {
      final next = await _mobileRepository.deleteInventoryCategory(name);
      await _saveBootstrap(next);
      state = state.copyWith(
        bootstrap: next,
        notice: AppStrings.tr(state.language, 'saved'),
        clearError: true,
      );
    });
  }

  Future<void> recordStockMovement(Map<String, dynamic> movement) {
    return _withLoading(() async {
      final next = await _onlineOrQueue(
        entity: 'inventory-movements',
        action: 'create',
        record: movement,
        online: () => _mobileRepository.recordStockMovement(movement),
      );
      await _saveBootstrap(next);
      state = state.copyWith(
        bootstrap: next,
        notice: AppStrings.tr(state.language, 'saved'),
        clearError: true,
      );
    });
  }

  Future<Map<String, dynamic>?> uploadBillScan(
    Map<String, dynamic> input,
  ) async {
    state = state.copyWith(loading: true, clearError: true, clearNotice: true);
    try {
      final scan = await _mobileRepository.uploadBillScan(input);
      await refreshBootstrap();
      return scan;
    } catch (error) {
      state = state.copyWith(error: error.toString());
      return null;
    } finally {
      state = state.copyWith(loading: false);
    }
  }

  Future<Map<String, dynamic>?> parseBillScan(
    String scanId,
    String rawText,
  ) async {
    state = state.copyWith(loading: true, clearError: true, clearNotice: true);
    try {
      final result = await _mobileRepository.parseBillScan(scanId, rawText);
      await refreshBootstrap();
      return result;
    } catch (error) {
      state = state.copyWith(error: error.toString());
      return null;
    } finally {
      state = state.copyWith(loading: false);
    }
  }

  Future<void> approveBillScan({
    required String scanId,
    required String targetRecordType,
    required Map<String, dynamic> approved,
  }) {
    return _withLoading(() async {
      final next = await _mobileRepository.approveBillScan(
        scanId: scanId,
        targetRecordType: targetRecordType,
        approved: approved,
      );
      await _saveBootstrap(next);
      state = state.copyWith(
        bootstrap: next,
        notice: AppStrings.tr(state.language, 'saved'),
        clearError: true,
      );
    });
  }

  Future<void> _completeAuth(AuthResult result) async {
    await _tokenStore.save(result.tokens);
    state = state.copyWith(user: result.user, authenticated: true);
    await _saveBootstrap(result.bootstrap);
    state = state.copyWith(
      bootstrap: result.bootstrap,
      language: result.bootstrap.settings.language,
      authenticated: true,
      clearError: true,
    );
    await registerCurrentPushToken();
  }

  Future<void> registerCurrentPushToken() async {
    if (!state.authenticated) return;
    final token = await pushNotificationService.token();
    if (token == null || token.trim().isEmpty) return;
    try {
      await _mobileRepository.registerPushToken(
        token.trim(),
        platform: defaultTargetPlatform.name.toLowerCase(),
      );
    } catch (error) {
      debugPrint('PUSH TOKEN REGISTRATION ERROR: $error');
    }
  }

  Future<void> _saveBootstrap(BootstrapData bootstrap) async {
    await _cacheStore.saveBootstrap({
      'plan': bootstrap.plan,
      'billingCycle': bootstrap.billingCycle,
      'trialEndsAt': bootstrap.trialEndsAt,
      'activeBusinessId': bootstrap.activeBusinessId,
      'settings': bootstrap.settings.toPatch(),
      'businesses': bootstrap.businesses,
      'teamMembers': bootstrap.teamMembers,
      'roleDefinitions': bootstrap.roleDefinitions,
      'sales': bootstrap.sales
          .map(
            (sale) => {
              'id': sale.id,
              'customer': sale.customer,
              'products': sale.products,
              'amount': sale.amount,
              'payment': sale.payment,
              'status': sale.status,
              'date': sale.date,
            },
          )
          .toList(),
      'parties': bootstrap.parties,
      'partyLedger': bootstrap.partyLedger,
      'purchases': bootstrap.purchases,
      'inventory': bootstrap.products
          .map(
            (product) => {
              'id': product.id,
              'name': product.name,
              'category': product.category,
              'unit': product.unit,
              'stock': product.stock,
              'reorderLevel': product.reorderLevel,
              'price': product.price,
              'costPrice': product.costPrice,
              'supplier': product.supplier,
              'status': product.status,
            },
          )
          .toList(),
      'customers': bootstrap.customers,
      'suppliers': bootstrap.suppliers,
      'expenses': bootstrap.expenses,
      'expenseCategories': bootstrap.expenseCategories,
      'creditLedger': bootstrap.creditLedger,
      'cashBankAccounts': bootstrap.cashBankAccounts,
      'moneyMovements': bootstrap.moneyMovements,
      'journalEntries': bootstrap.journalEntries,
      'documents': bootstrap.documents,
      'billScans': bootstrap.billScans,
      'reminderTemplates': bootstrap.reminderTemplates,
      'reminderLogs': bootstrap.reminderLogs,
      'syncOperations': bootstrap.syncOperations,
      'inventoryCategories': bootstrap.inventoryCategories,
      'inventoryMovements': bootstrap.inventoryMovements,
      'reports': bootstrap.reports,
      'auditLogs': bootstrap.auditLogs,
      'billingHistory': bootstrap.billingHistory,
      'featureFlags': bootstrap.featureFlags,
      'supportTickets': bootstrap.supportTickets,
    });
  }

  Future<void> syncPendingOperations() async {
    final queue = await offlineService.pendingSyncOperations();
    if (queue.isEmpty) return;
    for (final operation in queue) {
      final operationId = operation['id']?.toString() ?? '';
      if (operationId.isEmpty) continue;
      try {
        await _mobileRepository.pushOfflineOperation({
          'operationKey': operationId,
          'entity': operation['entityType'],
          'entityId': operation['entityId'],
          'action': operation['operation'],
          'payload': operation['data'],
        });
        await offlineService.completeSyncOperation(operationId);
      } catch (error) {
        await offlineService.markSyncFailed(operationId, error);
      }
    }
  }

  Future<BootstrapData> _onlineOrQueue({
    required String entity,
    required String action,
    required Map<String, dynamic> record,
    required Future<BootstrapData> Function() online,
    String? entityId,
  }) async {
    try {
      final next = await online();
      await syncPendingOperations();
      return next;
    } catch (error) {
      final bootstrap = state.bootstrap;
      if (bootstrap == null) rethrow;
      final id = entityId ??
          record['id']?.toString() ??
          DateTime.now().millisecondsSinceEpoch.toString();
      await offlineService.queueSyncOperation(
        entityType: entity,
        entityId: id,
        operation: action,
        data: record,
      );
      state = state.copyWith(
        notice: 'Saved offline. It will sync when the connection returns.',
        clearError: true,
      );
      return bootstrap;
    }
  }

  Future<void> _withLoading(Future<void> Function() action) async {
    state = state.copyWith(loading: true, clearError: true, clearNotice: true);
    try {
      await action();
    } catch (error, stackTrace) {
      debugPrint('WITH LOADING ERROR: $error');
      debugPrint('STACK TRACE: $stackTrace');
      state = state.copyWith(error: error.toString());
    } finally {
      state = state.copyWith(loading: false);
    }
  }
}
