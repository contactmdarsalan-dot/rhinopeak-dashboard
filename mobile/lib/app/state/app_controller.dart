import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/storage/cache_store.dart';
import '../../core/storage/token_store.dart';
import '../../core/utils/background.dart';
import '../../features/auth/data/auth_repository.dart';
import '../../shared/models/rhino_models.dart';
import '../../shared/repositories/mobile_repository.dart';
import '../localization/app_strings.dart';

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());
final cacheStoreProvider = Provider<CacheStore>((ref) => CacheStore());
final apiClientProvider =
    Provider<ApiClient>((ref) => ApiClient(ref.watch(tokenStoreProvider)));
final authRepositoryProvider = Provider<AuthRepository>(
    (ref) => AuthRepository(ref.watch(apiClientProvider)));
final mobileRepositoryProvider = Provider<MobileRepository>(
    (ref) => MobileRepository(ref.watch(apiClientProvider)));

final appControllerProvider =
    StateNotifierProvider<AppController, AppState>((ref) {
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
          clearError: true);
    });
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
    } catch (error) {
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
      final next = await _mobileRepository
          .patchSettings(bootstrap.settings.toPatch(nextLanguage: language));
      await _saveBootstrap(next);
      state = state.copyWith(
          bootstrap: next,
          language: language,
          notice: AppStrings.tr(language, 'saved'),
          clearError: true);
    });
  }

  Future<void> createSale(Map<String, dynamic> sale) {
    return _withLoading(() async {
      final next = await _mobileRepository.createSale(sale);
      await _saveBootstrap(next);
      state = state.copyWith(
          bootstrap: next,
          notice: AppStrings.tr(state.language, 'saved'),
          clearError: true);
    });
  }

  Future<void> createExpense(Map<String, dynamic> expense) {
    return _withLoading(() async {
      final next = await _mobileRepository.createExpense(expense);
      await _saveBootstrap(next);
      state = state.copyWith(
          bootstrap: next,
          notice: AppStrings.tr(state.language, 'saved'),
          clearError: true);
    });
  }

  Future<void> createProduct(Map<String, dynamic> product) {
    return _withLoading(() async {
      final next = await _mobileRepository.createProduct(product);
      await _saveBootstrap(next);
      state = state.copyWith(
          bootstrap: next,
          notice: AppStrings.tr(state.language, 'saved'),
          clearError: true);
    });
  }

  Future<void> createInventoryCategory(String name) {
    return _withLoading(() async {
      final next = await _mobileRepository.createInventoryCategory(name);
      await _saveBootstrap(next);
      state = state.copyWith(
          bootstrap: next,
          notice: AppStrings.tr(state.language, 'saved'),
          clearError: true);
    });
  }

  Future<void> recordStockMovement(Map<String, dynamic> movement) {
    return _withLoading(() async {
      final next = await _mobileRepository.recordStockMovement(movement);
      await _saveBootstrap(next);
      state = state.copyWith(
          bootstrap: next,
          notice: AppStrings.tr(state.language, 'saved'),
          clearError: true);
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
          .map((sale) => {
                'id': sale.id,
                'customer': sale.customer,
                'products': sale.products,
                'amount': sale.amount,
                'payment': sale.payment,
                'status': sale.status,
                'date': sale.date,
              })
          .toList(),
      'parties': bootstrap.parties,
      'partyLedger': bootstrap.partyLedger,
      'purchases': bootstrap.purchases,
      'inventory': bootstrap.products
          .map((product) => {
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
              })
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

  Future<void> _withLoading(Future<void> Function() action) async {
    state = state.copyWith(loading: true, clearError: true, clearNotice: true);
    try {
      await action();
    } catch (error) {
      state = state.copyWith(error: error.toString());
    } finally {
      state = state.copyWith(loading: false);
    }
  }
}
