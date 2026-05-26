import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/state/app_controller.dart';
import '../../app/theme/app_theme.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/formatters.dart';
import '../models/rhino_models.dart';
import 'rp_widgets.dart';

class ApiDetailScreen extends ConsumerWidget {
  const ApiDetailScreen({
    required this.title,
    required this.entity,
    required this.id,
    super.key,
  });

  final String title;
  final String entity;
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final future = ref.read(mobileRepositoryProvider).getDetail(entity, id);
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLowest,
      body: SafeArea(
        child: FutureBuilder<Map<String, dynamic>>(
          future: future,
          builder: (context, snapshot) {
            final fallback = _fallbackDetail(ref, entity, id);
            final useFallback =
                fallback != null &&
                (snapshot.hasError ||
                    snapshot.connectionState != ConnectionState.done);
            final loading =
                snapshot.connectionState != ConnectionState.done &&
                fallback == null;
            final detail = useFallback
                ? fallback
                : Map<String, dynamic>.from(snapshot.data ?? const {});
            final record = Map<String, dynamic>.from(detail['record'] as Map? ?? {});

            if (!loading) {
              if (entity == 'inventory') {
                return _InventoryDetailShowcase(record: record);
              } else if (entity == 'documents') {
                return _DocumentTrackingShowcase(record: record);
              }
            }

            return CustomScrollView(
              slivers: [
                SliverAppBar(
                  pinned: true,
                  stretch: true,
                  backgroundColor: Theme.of(context).colorScheme.surface,
                  surfaceTintColor: Colors.transparent,
                  title: Text(
                    trRecordText(ref, title),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  actions: [
                    IconButton(
                      tooltip: tr(ref, 'refresh'),
                      onPressed: () => ref
                          .read(appControllerProvider.notifier)
                          .refreshBootstrap(),
                      icon: const Icon(Icons.sync_rounded),
                    ),
                  ],
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 120),
                  sliver: SliverList.list(
                    children: [
                      if (loading)
                        const Padding(
                          padding: EdgeInsets.only(top: 90),
                          child: Center(child: CircularProgressIndicator()),
                        )
                      else if (snapshot.hasError && fallback == null)
                        _FriendlyErrorCard(error: snapshot.error)
                      else
                        _DetailContent(
                          title: trRecordText(ref, title),
                          entity: entity,
                          detail: detail,
                          offlineFallback: useFallback,
                        ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _DetailContent extends ConsumerWidget {
  const _DetailContent({
    required this.title,
    required this.entity,
    required this.detail,
    required this.offlineFallback,
  });

  final String title;
  final String entity;
  final Map<String, dynamic> detail;
  final bool offlineFallback;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final record = Map<String, dynamic>.from(detail['record'] as Map? ?? {});
    final related = Map<String, dynamic>.from(detail['related'] as Map? ?? {});
    final amount = record['amount'] ?? record['balance'] ?? record['price'];
    final status = _text(
      record,
      'status',
      fallback: _text(record, 'type', fallback: entity),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _HeroCard(
          title: title,
          subtitle: trValue(ref, _label(entity)),
          status: trValue(ref, status),
          amount: amount,
          offlineFallback: offlineFallback,
        ),
        const SizedBox(height: 16),
        _QuickFacts(record: record),
        const SizedBox(height: 16),
        _DetailSection(title: 'Details', rows: record),
        const SizedBox(height: 14),
        for (final entry in related.entries)
          _RelatedSection(
            title: entry.key,
            rows: (entry.value as List? ?? const [])
                .whereType<Map>()
                .map((item) => Map<String, dynamic>.from(item))
                .toList(),
          ),
        if (related.isEmpty)
          RpCard(
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Theme.of(
                      context,
                    ).colorScheme.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    Icons.info_outline,
                    color: Theme.of(context).colorScheme.primary,
                    size: 18,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    trValue(
                      ref,
                      'No related records yet. New sales, payments, stock logs, and documents will appear here.',
                    ),
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.title,
    required this.subtitle,
    required this.status,
    required this.amount,
    required this.offlineFallback,
  });

  final String title;
  final String subtitle;
  final String status;
  final Object? amount;
  final bool offlineFallback;

  @override
  Widget build(BuildContext context) {
    final amountValue = num.tryParse(amount?.toString() ?? '');
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppTheme.primary, Color(0xFF0A5C4E), AppTheme.accent],
          stops: [0.0, 0.55, 1.0],
        ),
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primary.withValues(alpha: 0.25),
            blurRadius: 28,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(
                  Icons.receipt_long,
                  color: Colors.white,
                  size: 24,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.1),
                  ),
                ),
                child: Text(
                  status.isEmpty ? subtitle : status,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                    letterSpacing: 0.3,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),
          Text(
            subtitle.toUpperCase(),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.65),
              fontWeight: FontWeight.w900,
              fontSize: 11,
              letterSpacing: 1.6,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            title,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              height: 1.1,
            ),
          ),
          if (amountValue != null) ...[
            const SizedBox(height: 16),
            Text(
              money(amountValue),
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                letterSpacing: 0,
              ),
            ),
          ],
          if (offlineFallback) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.cloud_off_outlined,
                    color: Colors.white.withValues(alpha: 0.86),
                    size: 14,
                  ),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      'Showing saved mobile data while the detail API catches up.',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.82),
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _QuickFacts extends ConsumerWidget {
  const _QuickFacts({required this.record});

  final Map<String, dynamic> record;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final facts = [
      _Fact(Icons.badge_outlined, 'ID', _text(record, 'id')),
      _Fact(
        Icons.calendar_today_outlined,
        'Date',
        shortDate(_text(record, 'date', fallback: _text(record, 'createdAt'))),
      ),
      _Fact(Icons.payments_outlined, 'Payment', _text(record, 'payment')),
      _Fact(Icons.category_outlined, 'Category', _text(record, 'category')),
    ].where((item) => item.value.trim().isNotEmpty).toList();
    if (facts.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: 72,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: facts.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final fact = facts[index];
          final isDark = Theme.of(context).brightness == Brightness.dark;
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: Theme.of(context).colorScheme.outlineVariant.withValues(
                  alpha: isDark ? 0.3 : 0.5,
                ),
              ),
              boxShadow: isDark
                  ? []
                  : [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.03),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: Theme.of(
                      context,
                    ).colorScheme.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    fact.icon,
                    size: 16,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      trValue(ref, fact.label),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _displayLocalized(ref, fact.value),
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Fact {
  const _Fact(this.icon, this.label, this.value);

  final IconData icon;
  final String label;
  final String value;
}

class _FriendlyErrorCard extends StatelessWidget {
  const _FriendlyErrorCard({required this.error});

  final Object? error;

  @override
  Widget build(BuildContext context) {
    final message = error is ApiException
        ? (error as ApiException).message
        : error?.toString() ?? 'Unable to open this record.';
    return RpCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Theme.of(
                context,
              ).colorScheme.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              Icons.travel_explore_rounded,
              color: Theme.of(context).colorScheme.primary,
              size: 26,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Detail is not available yet',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 6),
          Text(
            message == 'Route not found.'
                ? 'Please restart the backend so the latest mobile detail routes are active.'
                : message,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailSection extends ConsumerWidget {
  const _DetailSection({required this.title, required this.rows});

  final String title;
  final Map<String, dynamic> rows;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entries = rows.entries
        .where(
          (entry) => entry.value != null && entry.value.toString().isNotEmpty,
        )
        .take(24)
        .toList();
    return RpCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            trValue(ref, title),
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 14),
          for (var i = 0; i < entries.length; i++)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                border: i < entries.length - 1
                    ? Border(
                        bottom: BorderSide(
                          color: Theme.of(
                            context,
                          ).colorScheme.outlineVariant.withValues(alpha: 0.4),
                          width: 1,
                        ),
                      )
                    : null,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 2,
                    child: Text(
                      trValue(ref, _label(entries[i].key)),
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 3,
                    child: Text(
                      _displayLocalized(ref, entries[i].value),
                      textAlign: TextAlign.end,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        height: 1.35,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _RelatedSection extends ConsumerWidget {
  const _RelatedSection({required this.title, required this.rows});

  final String title;
  final List<Map<String, dynamic>> rows;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (rows.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: RpCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              trValue(ref, _label(title)),
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 12),
            for (final row in rows.take(8))
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Theme.of(
                    context,
                  ).colorScheme.surfaceContainerHighest.withValues(alpha: 0.35),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Theme.of(
                          context,
                        ).colorScheme.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        Icons.description_outlined,
                        size: 16,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _displayLocalized(
                              ref,
                              _text(
                                row,
                                'name',
                                fallback: _text(
                                  row,
                                  'customer',
                                  fallback: _text(
                                    row,
                                    'title',
                                    fallback: _text(row, 'id'),
                                  ),
                                ),
                              ),
                            ),
                            style: const TextStyle(fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            _displayLocalized(
                              ref,
                              _text(
                                row,
                                'date',
                                fallback: _text(
                                  row,
                                  'status',
                                  fallback: _text(row, 'type'),
                                ),
                              ),
                            ),
                            style: TextStyle(
                              color: Theme.of(
                                context,
                              ).colorScheme.onSurfaceVariant,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      _displayLocalized(
                        ref,
                        row['amount'] ?? row['delta'] ?? '',
                      ),
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

String _text(Map<String, dynamic> data, String key, {String fallback = ''}) {
  final value = data[key]?.toString().trim();
  return value == null || value.isEmpty ? fallback : value;
}

Map<String, dynamic>? _fallbackDetail(WidgetRef ref, String entity, String id) {
  final bootstrap = ref.read(appControllerProvider).bootstrap;
  if (bootstrap == null) return null;
  final record = _findFallbackRecord(bootstrap, entity, id);
  if (record == null) return null;
  return {
    'entity': entity,
    'id': id,
    'record': record,
    'related': _fallbackRelated(bootstrap, entity, record),
  };
}

Map<String, dynamic>? _findFallbackRecord(
  BootstrapData bootstrap,
  String entity,
  String id,
) {
  Iterable<Map<String, dynamic>> rows;
  switch (entity) {
    case 'sales':
      rows = bootstrap.sales.map(
        (sale) => {
          'id': sale.id,
          'customer': sale.customer,
          'products': sale.products,
          'amount': sale.amount,
          'payment': sale.payment,
          'status': sale.status,
          'date': sale.date,
        },
      );
      break;
    case 'inventory':
      rows = bootstrap.products.map(
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
      );
      break;
    case 'customers':
      rows = bootstrap.customers;
      break;
    case 'suppliers':
      rows = bootstrap.suppliers;
      break;
    case 'parties':
      rows = bootstrap.parties;
      break;
    case 'credit-ledger':
      rows = bootstrap.creditLedger;
      break;
    case 'purchases':
      rows = bootstrap.purchases;
      break;
    case 'expenses':
      rows = bootstrap.expenses;
      break;
    case 'cash-bank-accounts':
      rows = bootstrap.cashBankAccounts;
      break;
    case 'money-movements':
      rows = bootstrap.moneyMovements;
      break;
    case 'journal-entries':
      rows = bootstrap.journalEntries;
      break;
    case 'documents':
      rows = bootstrap.documents;
      break;
    case 'reminder-templates':
      rows = bootstrap.reminderTemplates;
      break;
    case 'reminders':
      rows = bootstrap.reminderLogs;
      break;
    case 'sync-operations':
      rows = bootstrap.syncOperations;
      break;
    case 'inventory-movements':
      rows = bootstrap.inventoryMovements;
      break;
    case 'reports':
      rows = bootstrap.reports;
      break;
    case 'audit-logs':
      rows = bootstrap.auditLogs;
      break;
    case 'billing-history':
      rows = bootstrap.billingHistory;
      break;
    case 'feature-flags':
      rows = bootstrap.featureFlags;
      break;
    case 'support-tickets':
      rows = bootstrap.supportTickets;
      break;
    default:
      rows = const [];
  }
  for (final row in rows) {
    if (_text(row, 'id') == id) return Map<String, dynamic>.from(row);
  }
  return null;
}

Map<String, List<Map<String, dynamic>>> _fallbackRelated(
  BootstrapData bootstrap,
  String entity,
  Map<String, dynamic> record,
) {
  final id = _text(record, 'id');
  final customerId = _text(record, 'customerId', fallback: id);
  final productId = entity == 'inventory' ? id : _text(record, 'productId');
  return {
    if (customerId.isNotEmpty)
      'creditLedger': bootstrap.creditLedger
          .where((row) => _text(row, 'customerId') == customerId)
          .take(8)
          .toList(),
    if (productId.isNotEmpty)
      'inventoryMovements': bootstrap.inventoryMovements
          .where((row) => _text(row, 'productId') == productId)
          .take(8)
          .toList(),
    if (id.isNotEmpty)
      'documents': bootstrap.documents
          .where((row) => _text(row, 'recordId') == id)
          .take(8)
          .toList(),
  }..removeWhere((_, rows) => rows.isEmpty);
}

String _label(String value) {
  final spaced = value
      .replaceAllMapped(
        RegExp(r'([a-z])([A-Z])'),
        (match) => '${match.group(1)} ${match.group(2)}',
      )
      .replaceAll('-', ' ')
      .replaceAll('_', ' ');
  return spaced.isEmpty ? value : spaced[0].toUpperCase() + spaced.substring(1);
}

String _display(Object? value) {
  if (value == null) return '';
  if (value is bool) return value ? 'Yes' : 'No';
  if (value is List) return '${value.length} items';
  if (value is Map) return '${value.length} fields';
  final valStr = value.toString();
  if (valStr.startsWith('data:') && valStr.contains(';base64,')) {
    final mimeEnd = valStr.indexOf(';');
    final mime = mimeEnd != -1 ? valStr.substring(5, mimeEnd) : 'file';
    return '$mime data (truncated)';
  }
  if (valStr.length > 60 && !valStr.contains(' ')) {
    return '${valStr.substring(0, 15)}...${valStr.substring(valStr.length - 15)} (truncated)';
  }
  return valStr;
}

String _displayLocalized(WidgetRef ref, Object? value) {
  final display = _display(value);
  return trRecordText(ref, display);
}

class _InventoryDetailShowcase extends ConsumerWidget {
  const _InventoryDetailShowcase({required this.record});
  final Map<String, dynamic> record;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = record['name']?.toString() ?? 'Product';
    final id = record['id']?.toString() ?? '84254632';
    final unit = record['unit']?.toString() ?? 'pcs';
    final stock = record['stock']?.toString() ?? '0';
    final reorder = record['reorderLevel']?.toString() ?? '0';
    final price = record['price']?.toString() ?? '0';

    return Container(
      color: Colors.white,
      child: Column(
        children: [
          // White Header Card
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Back Button
                Row(
                  children: [
                    IconButton.filledTonal(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 16, color: Color(0xFF0A6E46)),
                      style: IconButton.styleFrom(
                        backgroundColor: const Color(0xFFE8F5EE),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                // Fruit Showcase Image
                Center(
                  child: Container(
                    height: 220,
                    width: 220,
                    decoration: const BoxDecoration(
                      color: Colors.transparent,
                    ),
                    child: Center(
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          Icon(
                            Icons.eco_rounded,
                            size: 160,
                            color: const Color(0xFFFFA733).withOpacity(0.9),
                          ),
                          const Positioned(
                            top: 40,
                            child: Icon(
                              Icons.spa_rounded,
                              size: 60,
                              color: Color(0xFF0FA871),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                // Name & Product Code & More button
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: const TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF0F101A),
                              height: 1.1,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Product code $id',
                            style: const TextStyle(
                              fontSize: 13,
                              color: Color(0xFF757891),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    // Orange More Button
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFA733),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Row(
                        children: [
                          Text(
                            'More',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                          SizedBox(width: 4),
                          Icon(Icons.arrow_forward_rounded, size: 14, color: Colors.white),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
          // Dark Green Bottom Card
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: const BoxDecoration(
                color: Color(0xFF0A6E46),
                borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
              ),
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 10),
                  // Grid of two details cards
                  Row(
                    children: [
                      // Card 1: Stock
                      Expanded(
                        child: _ShowcaseGridCard(
                          label: 'Weight',
                          value: '$stock $unit',
                        ),
                      ),
                      const SizedBox(width: 16),
                      // Card 2: Price
                      Expanded(
                        child: _ShowcaseGridCard(
                          label: 'Price',
                          value: 'Rs $price',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      // Card 3: Reorder level
                      Expanded(
                        child: _ShowcaseGridCard(
                          label: 'Reorder Level',
                          value: '$reorder $unit',
                        ),
                      ),
                      const SizedBox(width: 16),
                      // Card 4: Supplier
                      Expanded(
                        child: _ShowcaseGridCard(
                          label: 'Supplier',
                          value: record['supplier']?.toString() ?? 'Local',
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ShowcaseGridCard extends StatelessWidget {
  const _ShowcaseGridCard({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
      decoration: BoxDecoration(
        color: const Color(0xFF0E8757),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFF0FA871).withOpacity(0.3),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DocumentTrackingShowcase extends ConsumerWidget {
  const _DocumentTrackingShowcase({required this.record});
  final Map<String, dynamic> record;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final senderName = record['senderName']?.toString() ?? 'Annie Holland';
    final recipientName = record['recipientName']?.toString() ?? 'Earl Osborne';

    return Container(
      color: Colors.white,
      child: Column(
        children: [
          // White Header Card
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Back Button
                Row(
                  children: [
                    IconButton.filledTonal(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 16, color: Color(0xFF0A6E46)),
                      style: IconButton.styleFrom(
                        backgroundColor: const Color(0xFFE8F5EE),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                // Sender contact bubble
                _ContactBubble(
                  name: senderName,
                  role: 'Sender',
                  avatarColor: const Color(0xFFFBECE6),
                  avatarIcon: Icons.person_rounded,
                ),
                const SizedBox(height: 12),
                // Recipient contact bubble
                _ContactBubble(
                  name: recipientName,
                  role: 'Recipient',
                  avatarColor: const Color(0xFFE6F0EC),
                  avatarIcon: Icons.person_3_rounded,
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
          // Dark Green Bottom Card
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: const BoxDecoration(
                color: Color(0xFF0A6E46),
                borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
              ),
              padding: const EdgeInsets.fromLTRB(24, 30, 24, 24),
              child: const SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _TimelineItem(
                      date: 'JAN 24',
                      title: 'Sent by sender',
                      address: '13 Hilda Radial Suite 822',
                      time: '10:45AM',
                      icon: Icons.flight_takeoff_rounded,
                      isFirst: true,
                    ),
                    _TimelineItem(
                      date: 'JAN 25',
                      title: 'Warehouse 1',
                      address: '13 Barrett Dam Apt. 803',
                      time: '06:15PM',
                      icon: Icons.store_rounded,
                    ),
                    _TimelineItem(
                      date: 'FEB 14',
                      title: 'Warehouse 2',
                      address: '169 Wisozk Cove Apt. 727',
                      time: '08:30PM',
                      icon: Icons.store_rounded,
                    ),
                    _TimelineItem(
                      date: 'FEB 28',
                      title: 'Must be taken',
                      address: '169 Wisozk Cove Apt. 727',
                      time: '08:00AM - 05:00PM',
                      icon: Icons.local_shipping_rounded,
                      isLast: true,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ContactBubble extends StatelessWidget {
  const _ContactBubble({
    required this.name,
    required this.role,
    required this.avatarColor,
    required this.avatarIcon,
  });

  final String name;
  final String role;
  final Color avatarColor;
  final IconData avatarIcon;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        CircleAvatar(
          radius: 24,
          backgroundColor: avatarColor,
          child: Icon(avatarIcon, color: const Color(0xFF757891), size: 24),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF0F101A),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                role,
                style: const TextStyle(
                  fontSize: 12,
                  color: Color(0xFF757891),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        // Phone button
        IconButton(
          onPressed: () {},
          icon: const Icon(Icons.call_rounded, color: Colors.white, size: 18),
          style: IconButton.styleFrom(
            backgroundColor: const Color(0xFFFFA733),
            padding: const EdgeInsets.all(12),
          ),
        ),
        const SizedBox(width: 8),
        // Email button
        IconButton(
          onPressed: () {},
          icon: const Icon(Icons.mail_rounded, color: Colors.white, size: 18),
          style: IconButton.styleFrom(
            backgroundColor: const Color(0xFFFFA733),
            padding: const EdgeInsets.all(12),
          ),
        ),
      ],
    );
  }
}

class _TimelineItem extends StatelessWidget {
  const _TimelineItem({
    required this.date,
    required this.title,
    required this.address,
    required this.time,
    required this.icon,
    this.isFirst = false,
    this.isLast = false,
  });

  final String date;
  final String title;
  final String address;
  final String time;
  final IconData icon;
  final bool isFirst;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final dateParts = date.split(' ');
    final month = dateParts.isNotEmpty ? dateParts[0] : '';
    final day = dateParts.length > 1 ? dateParts[1] : '';

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Date Column
          Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(
                month.toUpperCase(),
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                day,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
          const SizedBox(width: 16),
          // Vertical Line & Node
          Column(
            children: [
              const SizedBox(height: 6),
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: Colors.white70,
                  shape: BoxShape.circle,
                ),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 1.5,
                    color: Colors.white30,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 20),
          // Content Column
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            address,
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            time,
                            style: const TextStyle(
                              color: Colors.white54,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    // Action Icon
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(icon, color: Colors.white, size: 20),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
