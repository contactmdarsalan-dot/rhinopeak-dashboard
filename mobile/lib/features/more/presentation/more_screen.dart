import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/state/app_controller.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/api_detail_screen.dart';
import '../../../shared/widgets/mobile_record_editor.dart';
import '../../../shared/widgets/rp_widgets.dart';

class MoreScreen extends ConsumerWidget {
  const MoreScreen({required this.onOpenSettings, super.key});

  final VoidCallback onOpenSettings;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    _MoreAction createAction(
      IconData icon,
      String titleKey,
      String helpKey, {
      String? module,
      VoidCallback? customOnTap,
    }) {
      final title = tr(ref, titleKey);
      final subtitle = tr(ref, helpKey);
      final action = _MoreAction(icon, title, subtitle, module: module);
      return _MoreAction(
        icon,
        title,
        subtitle,
        module: module,
        onTap: customOnTap ?? () => _openModule(context, action),
      );
    }

    final dailyOps = [
      createAction(Icons.people_alt_outlined, 'customers', 'customerModuleHelp',
          module: 'customers'),
      createAction(
          Icons.local_shipping_outlined, 'suppliers', 'supplierModuleHelp',
          module: 'suppliers'),
      createAction(Icons.groups_2_outlined, 'parties', 'partiesModuleHelp',
          module: 'parties'),
      createAction(
          Icons.shopping_bag_outlined, 'purchases', 'purchasesModuleHelp',
          module: 'purchases'),
      createAction(
          Icons.folder_copy_outlined, 'documents', 'documentsModuleHelp',
          module: 'documents'),
    ];

    final financials = [
      createAction(Icons.account_balance_wallet_outlined, 'creditCustomers',
          'creditModuleHelp',
          module: 'credit'),
      createAction(Icons.wallet_outlined, 'expenses', 'expensesModuleHelp',
          module: 'expenses'),
      createAction(
          Icons.account_balance_outlined, 'cashBank', 'cashBankModuleHelp',
          module: 'cashBank'),
      createAction(Icons.book_outlined, 'accounting', 'accountingModuleHelp',
          module: 'accounting'),
      createAction(Icons.receipt_outlined, 'bills', 'billsModuleHelp',
          module: 'bills'),
    ];

    final analytics = [
      createAction(Icons.notifications_active_outlined, 'reminders',
          'remindersModuleHelp',
          module: 'reminders'),
      createAction(Icons.bar_chart_outlined, 'reports', 'reportsModuleHelp',
          module: 'reports'),
      createAction(
          Icons.workspace_premium_outlined, 'billing', 'billingModuleHelp',
          module: 'billing'),
    ];

    final systemAdmin = [
      createAction(
          Icons.admin_panel_settings_outlined, 'teamRoles', 'teamModuleHelp',
          module: 'team'),
      createAction(Icons.fact_check_outlined, 'audit', 'auditModuleHelp',
          module: 'audit'),
      createAction(Icons.sync_outlined, 'syncLog', 'syncModuleHelp',
          module: 'sync'),
      createAction(Icons.support_agent_outlined, 'support', 'supportModuleHelp',
          module: 'support'),
      createAction(Icons.settings_outlined, 'settings', 'settingsModuleHelp',
          customOnTap: onOpenSettings),
    ];
    Widget buildGrid(List<_MoreAction> actions) {
      return GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: actions.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          childAspectRatio: 1.6,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
        ),
        itemBuilder: (context, index) {
          return _MoreActionGridTile(action: actions[index]);
        },
      );
    }

    return RpPage(
      title: tr(ref, 'more'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeader(title: tr(ref, 'dailyOperations')),
          buildGrid(dailyOps),
          const SizedBox(height: 24),
          _SectionHeader(title: tr(ref, 'financialsLedgers')),
          buildGrid(financials),
          const SizedBox(height: 24),
          _SectionHeader(title: tr(ref, 'analyticsReminders')),
          buildGrid(analytics),
          const SizedBox(height: 24),
          _SectionHeader(title: tr(ref, 'systemAdmin')),
          buildGrid(systemAdmin),
          const SizedBox(height: 32),
          OutlinedButton.icon(
            onPressed: () => ref.read(appControllerProvider.notifier).logout(),
            icon: const Icon(Icons.logout),
            label: Text(tr(ref, 'logout')),
          ),
        ],
      ),
    );
  }
  void _openModule(BuildContext context, _MoreAction action) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => _ModuleDetailScreen(
          title: action.title,
          subtitle: action.subtitle,
          module: action.module ?? '',
        ),
      ),
    );
  }
}

class _MoreAction {
  const _MoreAction(this.icon, this.title, this.subtitle,
      {this.module, this.onTap});

  final IconData icon;
  final String title;
  final String subtitle;
  final String? module;
  final VoidCallback? onTap;
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(left: 8, bottom: 8),
      child: Text(
        title.toUpperCase(),
        style: TextStyle(
          color: theme.colorScheme.primary,
          fontWeight: FontWeight.w900,
          fontSize: 12,
          letterSpacing: 1.2,
        ),
      ),
    );
  }
}

class _MoreActionGridTile extends StatefulWidget {
  const _MoreActionGridTile({required this.action});

  final _MoreAction action;

  @override
  State<_MoreActionGridTile> createState() => _MoreActionGridTileState();
}

class _MoreActionGridTileState extends State<_MoreActionGridTile>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
      lowerBound: 0.95,
      upperBound: 1.0,
      value: 1.0,
    );
    _scaleAnimation = _controller;
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;

    return ScaleTransition(
      scale: _scaleAnimation,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: widget.action.onTap,
          onTapDown: (_) => widget.action.onTap != null ? _controller.reverse() : null,
          onTapUp: (_) => widget.action.onTap != null ? _controller.forward() : null,
          onTapCancel: () => widget.action.onTap != null ? _controller.forward() : null,
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: theme.cardTheme.color ?? colorScheme.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: colorScheme.outlineVariant.withOpacity(isDark ? 0.1 : 0.4),
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.01),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: colorScheme.primary.withOpacity(isDark ? 0.12 : 0.08),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: colorScheme.primary.withOpacity(isDark ? 0.25 : 0.18),
                      width: 1,
                    ),
                  ),
                  child: Icon(
                    widget.action.icon,
                    size: 18,
                    color: colorScheme.primary,
                  ),
                ),
                const SizedBox(height: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.action.title,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      widget.action.subtitle,
                      style: TextStyle(
                        fontSize: 10,
                        color: colorScheme.onSurfaceVariant.withOpacity(0.7),
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ModuleDetailScreen extends ConsumerWidget {
  const _ModuleDetailScreen({
    required this.title,
    required this.subtitle,
    required this.module,
  });

  final String title;
  final String subtitle;
  final String module;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bootstrap = ref.watch(appControllerProvider).bootstrap;
    final createEntity = _createEntityForModule(module);
    final canCreate =
        createEntity != null && canCreateMobileRecord(createEntity);
    void openCreate() {
      if (!canCreate) return;
      showMobileRecordEditor(
        context,
        ref,
        entity: createEntity,
        title: title,
      );
    }

    return RpPage(
      title: title,
      action: !canCreate
          ? null
          : IconButton.filled(
              onPressed: openCreate,
              icon: const Icon(Icons.add_rounded),
              tooltip: '${tr(ref, 'add')} $title',
            ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(subtitle,
              style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant)),
          if (canCreate) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: openCreate,
                icon: const Icon(Icons.add_circle_outline_rounded),
                label: Text('${tr(ref, 'addNew')} $title'),
              ),
            ),
          ],
          const SizedBox(height: 14),
          if (bootstrap == null)
            const Center(child: CircularProgressIndicator())
          else
            ..._moduleCards(context, ref, module),
        ],
      ),
    );
  }

  List<Widget> _moduleCards(
      BuildContext context, WidgetRef ref, String module) {
    final bootstrap = ref.watch(appControllerProvider).bootstrap!;
    switch (module) {
      case 'customers':
        if (bootstrap.customers.isEmpty) {
          return [_EmptyCard(message: tr(ref, 'customers'))];
        }
        return [
          for (final customer in bootstrap.customers)
            _DataCard(
              title: _text(customer, 'name', fallback: tr(ref, 'customers')),
              subtitle:
                  _text(customer, 'phone', fallback: _text(customer, 'email')),
              trailing: money(_number(customer, 'balance')),
              entity: 'customers',
              id: _text(customer, 'id'),
              record: customer,
            ),
        ];
      case 'suppliers':
        final suppliers = bootstrap.suppliers.isNotEmpty
            ? bootstrap.suppliers
            : _suppliersFromProducts(bootstrap);
        if (suppliers.isEmpty) {
          return [_EmptyCard(message: tr(ref, 'suppliers'))];
        }
        return [
          for (final supplier in suppliers)
            _DataCard(
              title: _text(supplier, 'name', fallback: tr(ref, 'supplier')),
              subtitle: _text(supplier, 'phone',
                  fallback: _text(supplier, 'email',
                      fallback: _text(supplier, 'address'))),
              trailing: money(_number(supplier, 'balance')),
              entity: 'suppliers',
              id: _text(supplier, 'id'),
              record: supplier,
            ),
        ];
      case 'parties':
        if (bootstrap.parties.isEmpty) {
          return [_EmptyCard(message: tr(ref, 'parties'))];
        }
        return [
          for (final party in bootstrap.parties)
            _DataCard(
              title: _text(party, 'name', fallback: tr(ref, 'parties')),
              subtitle:
                  '${_text(party, 'type')} - ${_text(party, 'phone', fallback: _text(party, 'address'))}',
              trailing: money(_number(party, 'balance')),
              entity: 'parties',
              id: _text(party, 'id'),
              record: party,
            ),
        ];
      case 'credit':
        if (bootstrap.creditLedger.isEmpty) {
          return [_EmptyCard(message: tr(ref, 'creditCustomers'))];
        }
        return [
          for (final row in bootstrap.creditLedger)
            _DataCard(
              title:
                  _text(row, 'customerName', fallback: _text(row, 'customer')),
              subtitle:
                  '${_text(row, 'type')} - ${shortDate(_text(row, 'date'))}',
              trailing: money(_number(row, 'amount')),
              entity: 'credit-ledger',
              id: _text(row, 'id'),
              record: row,
            ),
        ];
      case 'purchases':
        if (bootstrap.purchases.isEmpty) {
          return [_EmptyCard(message: tr(ref, 'purchases'))];
        }
        return [
          _SummaryCard(
              title: tr(ref, 'purchases'),
              value: money(bootstrap.purchaseTotal),
              subtitle: '${bootstrap.purchases.length} entries'),
          for (final row in bootstrap.purchases)
            _DataCard(
              title: _text(row, 'supplier',
                  fallback:
                      _text(row, 'partyName', fallback: tr(ref, 'supplier'))),
              subtitle:
                  '${_text(row, 'status')} - ${shortDate(_text(row, 'date'))}',
              trailing: money(_number(row, 'amount')),
              entity: 'purchases',
              id: _text(row, 'id'),
              record: row,
            ),
        ];
      case 'expenses':
        if (bootstrap.expenses.isEmpty) {
          return [_EmptyCard(message: tr(ref, 'expenses'))];
        }
        return [
          _SummaryCard(
              title: tr(ref, 'expenses'),
              value: money(bootstrap.expenseTotal),
              subtitle: '${bootstrap.expenseCategories.length} categories'),
          for (final row in bootstrap.expenses)
            _DataCard(
              title: _text(row, 'category', fallback: tr(ref, 'expenses')),
              subtitle:
                  '${_text(row, 'vendor')} - ${shortDate(_text(row, 'date'))}',
              trailing: money(_number(row, 'amount')),
              entity: 'expenses',
              id: _text(row, 'id'),
              record: row,
            ),
        ];
      case 'cashBank':
        if (bootstrap.cashBankAccounts.isEmpty &&
            bootstrap.moneyMovements.isEmpty) {
          return [_EmptyCard(message: tr(ref, 'cashBank'))];
        }
        return [
          _SummaryCard(
              title: tr(ref, 'cashBank'),
              value: money(bootstrap.cashBankBalance),
              subtitle: '${bootstrap.cashBankAccounts.length} accounts'),
          for (final account in bootstrap.cashBankAccounts)
            _DataCard(
              title: _text(account, 'name', fallback: tr(ref, 'cashBank')),
              subtitle:
                  '${_text(account, 'type')} - ${_text(account, 'institution')}',
              trailing: money(_number(account, 'balance')),
              entity: 'cash-bank-accounts',
              id: _text(account, 'id'),
              record: account,
            ),
          for (final movement in bootstrap.moneyMovements.take(8))
            _DataCard(
              title: _text(movement, 'type', fallback: tr(ref, 'cashBank')),
              subtitle:
                  '${_text(movement, 'note')} - ${shortDate(_text(movement, 'date'))}',
              trailing: money(_number(movement, 'amount')),
              entity: 'money-movements',
              id: _text(movement, 'id'),
              record: movement,
            ),
        ];
      case 'accounting':
        if (bootstrap.journalEntries.isEmpty) {
          return [_EmptyCard(message: tr(ref, 'accounting'))];
        }
        return [
          for (final entry in bootstrap.journalEntries)
            _DataCard(
              title: _text(entry, 'description',
                  fallback: _text(entry, 'sourceType',
                      fallback: tr(ref, 'accounting'))),
              subtitle:
                  '${_text(entry, 'sourceType')} - ${shortDate(_text(entry, 'date'))}',
              trailing: money(_number(entry, 'totalDebit')),
              entity: 'journal-entries',
              id: _text(entry, 'id'),
              record: entry,
            ),
        ];
      case 'bills':
        if (bootstrap.sales.isEmpty) {
          return [_EmptyCard(message: tr(ref, 'bills'))];
        }
        return [
          for (final sale in bootstrap.sales)
            _DataCard(
              title: trValue(ref, sale.customer),
              subtitle: '${trProductList(ref, sale.products)} - ${shortDate(sale.date)}',
              trailing: money(sale.amount),
              entity: 'sales',
              id: sale.id,
              record: {
                'id': sale.id,
                'customer': sale.customer,
                'products': sale.products,
                'amount': sale.amount,
                'payment': sale.payment,
                'status': sale.status,
                'date': sale.date,
              },
            ),
        ];
      case 'documents':
        if (bootstrap.documents.isEmpty) {
          return [_EmptyCard(message: tr(ref, 'documents'))];
        }
        return [
          for (final doc in bootstrap.documents)
            _DataCard(
              title: _text(doc, 'title',
                  fallback: _text(doc, 'name', fallback: tr(ref, 'documents'))),
              subtitle:
                  '${_text(doc, 'type')} - ${shortDate(_text(doc, 'createdAt'))}',
              trailing: _text(doc, 'status', fallback: 'Ready'),
              entity: 'documents',
              id: _text(doc, 'id'),
              record: doc,
            ),
        ];
      case 'reminders':
        if (bootstrap.reminderLogs.isEmpty &&
            bootstrap.reminderTemplates.isEmpty) {
          return [_EmptyCard(message: tr(ref, 'reminders'))];
        }
        return [
          for (final template in bootstrap.reminderTemplates)
            _DataCard(
              title: _text(template, 'name', fallback: tr(ref, 'reminders')),
              subtitle: _text(template, 'channel',
                  fallback: _text(template, 'message')),
              trailing: _text(template, 'active', fallback: 'Active'),
              entity: 'reminder-templates',
              id: _text(template, 'id'),
              record: template,
            ),
          for (final log in bootstrap.reminderLogs.take(8))
            _DataCard(
              title: _text(log, 'customerName', fallback: tr(ref, 'reminders')),
              subtitle:
                  '${_text(log, 'channel')} - ${shortDate(_text(log, 'sentAt'))}',
              trailing: _text(log, 'status', fallback: 'Sent'),
              entity: 'reminders',
              id: _text(log, 'id'),
              record: log,
            ),
        ];
      case 'reports':
        return [
          _DataCard(
              title: tr(ref, 'monthlyRevenue'),
              subtitle: tr(ref, 'reportsModuleHelp'),
              trailing: money(bootstrap.monthlyRevenue)),
          _DataCard(
              title: tr(ref, 'creditDue'),
              subtitle: tr(ref, 'creditModuleHelp'),
              trailing: money(bootstrap.creditDue)),
          _DataCard(
              title: tr(ref, 'lowStock'),
              subtitle: tr(ref, 'inventory'),
              trailing: bootstrap.lowStockCount.toString()),
          for (final report in bootstrap.reports)
            _DataCard(
              title: _text(report, 'title', fallback: tr(ref, 'reports')),
              subtitle:
                  '${_text(report, 'type')} - ${shortDate(_text(report, 'createdAt'))}',
              trailing: _text(report, 'status', fallback: 'Ready'),
              entity: 'reports',
              id: _text(report, 'id'),
              record: report,
            ),
        ];
      case 'billing':
        return [
          _DataCard(
              title: tr(ref, 'plan'),
              subtitle: bootstrap.billingCycle,
              trailing: bootstrap.plan.toUpperCase()),
          _DataCard(
              title: tr(ref, 'currency'),
              subtitle: tr(ref, 'settings'),
              trailing: bootstrap.settings.currency),
          for (final bill in bootstrap.billingHistory)
            _DataCard(
              title: _text(bill, 'plan', fallback: tr(ref, 'billing')),
              subtitle:
                  '${_text(bill, 'method')} - ${shortDate(_text(bill, 'date'))}',
              trailing: money(_number(bill, 'amount')),
              entity: 'billing-history',
              id: _text(bill, 'id'),
              record: bill,
            ),
        ];
      case 'team':
        if (bootstrap.teamMembers.isEmpty) {
          return [_EmptyCard(message: tr(ref, 'teamRoles'))];
        }
        return [
          for (final member in bootstrap.teamMembers)
            _DataCard(
              title: _text(member, 'name', fallback: _text(member, 'email')),
              subtitle: _text(member, 'email'),
              trailing: _text(member, 'role', fallback: 'User'),
            ),
          for (final role in bootstrap.roleDefinitions)
            _DataCard(
              title: _text(role, 'name', fallback: tr(ref, 'teamRoles')),
              subtitle: '${_listLength(role, 'permissions')} permissions',
              trailing: _text(role, 'systemRole', fallback: ''),
              entity: 'roles',
              id: _text(role, 'id'),
              record: role,
            ),
        ];
      case 'audit':
        if (bootstrap.auditLogs.isEmpty) {
          return [_EmptyCard(message: tr(ref, 'audit'))];
        }
        return [
          for (final log in bootstrap.auditLogs.take(20))
            _DataCard(
              title: _text(log, 'action', fallback: tr(ref, 'audit')),
              subtitle: '${_text(log, 'module')} - ${_text(log, 'user')}',
              trailing: shortDate(_text(log, 'createdAt')),
              entity: 'audit-logs',
              id: _text(log, 'id'),
              record: log,
            ),
        ];
      case 'sync':
        if (bootstrap.syncOperations.isEmpty &&
            bootstrap.inventoryMovements.isEmpty) {
          return [_EmptyCard(message: tr(ref, 'syncLog'))];
        }
        return [
          for (final operation in bootstrap.syncOperations)
            _DataCard(
              title: _text(operation, 'type', fallback: tr(ref, 'syncLog')),
              subtitle: _text(operation, 'status'),
              trailing: shortDate(_text(operation, 'syncedAt')),
              entity: 'sync-operations',
              id: _text(operation, 'id'),
              record: operation,
            ),
          for (final movement in bootstrap.inventoryMovements.take(10))
            _DataCard(
              title: _text(movement, 'reason', fallback: tr(ref, 'stock')),
              subtitle: _text(movement, 'productName'),
              trailing: _number(movement, 'delta').toString(),
              entity: 'inventory-movements',
              id: _text(movement, 'id'),
              record: movement,
            ),
        ];
      case 'support':
        if (bootstrap.supportTickets.isEmpty &&
            bootstrap.featureFlags.isEmpty) {
          return [_EmptyCard(message: tr(ref, 'support'))];
        }
        return [
          for (final ticket in bootstrap.supportTickets)
            _DataCard(
              title: _text(ticket, 'subject', fallback: tr(ref, 'support')),
              subtitle: _text(ticket, 'priority'),
              trailing: _text(ticket, 'status', fallback: 'Open'),
              entity: 'support-tickets',
              id: _text(ticket, 'id'),
              record: ticket,
            ),
          for (final flag in bootstrap.featureFlags)
            _DataCard(
              title: _text(flag, 'name', fallback: 'Feature'),
              subtitle: _text(flag, 'description'),
              trailing: _text(flag, 'enabled', fallback: ''),
              entity: 'feature-flags',
              id: _text(flag, 'id'),
              record: flag,
            ),
        ];
      default:
        return [_EmptyCard(message: tr(ref, 'mobileExpansion'))];
    }
  }
}

class _DataCard extends ConsumerWidget {
  const _DataCard({
    required this.title,
    required this.subtitle,
    required this.trailing,
    this.entity,
    this.id,
    this.record,
  });

  final String title;
  final String subtitle;
  final String trailing;
  final String? entity;
  final String? id;
  final Map<String, dynamic>? record;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canOpen = entity != null && id != null && id!.isNotEmpty;
    final canEdit = canOpen && canEditMobileRecord(entity!);
    final colorScheme = Theme.of(context).colorScheme;
    final displayTitle = trRecordText(ref, title);
    final displaySubtitle = trRecordText(ref, subtitle);
    final displayTrailing = trRecordText(ref, trailing);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: RpCard(
        onTap: canOpen
            ? () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ApiDetailScreen(
                      title: displayTitle,
                      entity: entity!,
                      id: id!,
                    ),
                  ),
                );
              }
            : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(displayTitle,
                          style: const TextStyle(fontWeight: FontWeight.w900)),
                      const SizedBox(height: 3),
                      Text(displaySubtitle,
                          style:
                              TextStyle(color: colorScheme.onSurfaceVariant)),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Flexible(
                  child: Text(
                    displayTrailing,
                    textAlign: TextAlign.right,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
                if (canOpen && !canEdit) ...[
                  const SizedBox(width: 6),
                  Icon(Icons.chevron_right_rounded,
                      color: colorScheme.onSurfaceVariant),
                ],
              ],
            ),
            if (canOpen || canEdit) ...[
              const SizedBox(height: 14),
              Divider(
                height: 1,
                color: colorScheme.outlineVariant.withValues(alpha: 0.55),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  if (canOpen)
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _openDetail(context, displayTitle),
                        icon: const Icon(Icons.visibility_outlined, size: 18),
                        label: Text(tr(ref, 'view')),
                      ),
                    ),
                  if (canOpen && canEdit) const SizedBox(width: 8),
                  if (canEdit)
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => showMobileRecordEditor(
                          context,
                          ref,
                          entity: entity!,
                          title: displayTitle,
                          initial: record,
                        ),
                        icon: const Icon(Icons.edit_outlined, size: 18),
                        label: Text(tr(ref, 'edit')),
                      ),
                    ),
                  if (canEdit) ...[
                    const SizedBox(width: 8),
                    SizedBox.square(
                      dimension: 48,
                      child: IconButton.outlined(
                        tooltip: tr(ref, 'delete'),
                        onPressed: () =>
                            _confirmDelete(
                                context, ref, entity!, id!, displayTitle),
                        icon: const Icon(Icons.delete_outline_rounded),
                        style: IconButton.styleFrom(
                          foregroundColor: colorScheme.error,
                          side: BorderSide(
                            color: colorScheme.error.withValues(alpha: 0.42),
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _openDetail(BuildContext context, String displayTitle) {
    if (entity == null || id == null || id!.isEmpty) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ApiDetailScreen(
          title: displayTitle,
          entity: entity!,
          id: id!,
        ),
      ),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return RpCard(
      child: Text(message,
          style:
              TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
    );
  }
}

class _SummaryCard extends ConsumerWidget {
  const _SummaryCard({
    required this.title,
    required this.value,
    required this.subtitle,
  });

  final String title;
  final String value;
  final String subtitle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final displayTitle = trRecordText(ref, title);
    final displaySubtitle = trRecordText(ref, subtitle);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: RpCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(displayTitle,
                style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant)),
            const SizedBox(height: 6),
            Text(value,
                style: Theme.of(context)
                    .textTheme
                    .headlineSmall
                    ?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            Text(displaySubtitle),
          ],
        ),
      ),
    );
  }
}

String? _createEntityForModule(String module) {
  switch (module) {
    case 'customers':
      return 'customers';
    case 'suppliers':
      return 'suppliers';
    case 'parties':
      return 'parties';
    case 'credit':
      return 'credit-ledger';
    case 'purchases':
      return 'purchases';
    case 'expenses':
      return 'expenses';
    case 'cashBank':
      return 'cash-bank-accounts';
    case 'documents':
      return 'documents';
    case 'reminders':
      return 'reminder-templates';
    case 'reports':
      return 'reports';
    case 'team':
      return 'roles';
    case 'sync':
      return 'inventory-movements';
    default:
      return null;
  }
}

Future<void> _confirmDelete(
  BuildContext context,
  WidgetRef ref,
  String entity,
  String id,
  String title,
) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(tr(ref, 'deleteRecordTitle')),
      content: Text('${tr(ref, 'deleteRecordBody')}\n\n$title'),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(tr(ref, 'cancel')),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          style: FilledButton.styleFrom(
            backgroundColor: Theme.of(context).colorScheme.error,
            foregroundColor: Theme.of(context).colorScheme.onError,
          ),
          child: Text(tr(ref, 'delete')),
        ),
      ],
    ),
  );
  if (confirmed != true) return;
  await ref.read(appControllerProvider.notifier).deleteRecord(entity, id);
}

String _text(Map<String, dynamic> data, String key, {String fallback = ''}) {
  final value = data[key]?.toString().trim();
  return value == null || value.isEmpty ? fallback : value;
}

num _number(Map<String, dynamic> data, String key) {
  return num.tryParse(data[key]?.toString() ?? '') ?? 0;
}

int _listLength(Map<String, dynamic> data, String key) {
  final value = data[key];
  return value is List ? value.length : 0;
}

List<Map<String, dynamic>> _suppliersFromProducts(dynamic bootstrap) {
  final supplierNames = <String, int>{};
  for (final product in bootstrap.products) {
    final supplier = product.supplier.trim();
    if (supplier.isNotEmpty) {
      supplierNames[supplier] = (supplierNames[supplier] ?? 0) + 1;
    }
  }
  return supplierNames.entries
      .map((entry) => {
            'name': entry.key,
            'balance': 0,
            'phone': '${entry.value} products',
          })
      .toList();
}
