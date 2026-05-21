import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/state/app_controller.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/api_detail_screen.dart';
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
      createAction(Icons.people_alt_outlined, 'customers', 'customerModuleHelp', module: 'customers'),
      createAction(Icons.local_shipping_outlined, 'suppliers', 'supplierModuleHelp', module: 'suppliers'),
      createAction(Icons.groups_2_outlined, 'parties', 'partiesModuleHelp', module: 'parties'),
      createAction(Icons.shopping_bag_outlined, 'purchases', 'purchasesModuleHelp', module: 'purchases'),
      createAction(Icons.folder_copy_outlined, 'documents', 'documentsModuleHelp', module: 'documents'),
    ];

    final financials = [
      createAction(Icons.account_balance_wallet_outlined, 'creditCustomers', 'creditModuleHelp', module: 'credit'),
      createAction(Icons.wallet_outlined, 'expenses', 'expensesModuleHelp', module: 'expenses'),
      createAction(Icons.account_balance_outlined, 'cashBank', 'cashBankModuleHelp', module: 'cashBank'),
      createAction(Icons.book_outlined, 'accounting', 'accountingModuleHelp', module: 'accounting'),
      createAction(Icons.receipt_outlined, 'bills', 'billsModuleHelp', module: 'bills'),
    ];

    final analytics = [
      createAction(Icons.notifications_active_outlined, 'reminders', 'remindersModuleHelp', module: 'reminders'),
      createAction(Icons.bar_chart_outlined, 'reports', 'reportsModuleHelp', module: 'reports'),
      createAction(Icons.workspace_premium_outlined, 'billing', 'billingModuleHelp', module: 'billing'),
    ];

    final systemAdmin = [
      createAction(Icons.admin_panel_settings_outlined, 'teamRoles', 'teamModuleHelp', module: 'team'),
      createAction(Icons.fact_check_outlined, 'audit', 'auditModuleHelp', module: 'audit'),
      createAction(Icons.sync_outlined, 'syncLog', 'syncModuleHelp', module: 'sync'),
      createAction(Icons.support_agent_outlined, 'support', 'supportModuleHelp', module: 'support'),
      createAction(Icons.settings_outlined, 'settings', 'settingsModuleHelp', customOnTap: onOpenSettings),
    ];

    return RpPage(
      title: tr(ref, 'more'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeader(title: tr(ref, 'dailyOperations')),
          _SectionCard(
            children: [
              for (int i = 0; i < dailyOps.length; i++)
                _MoreActionRow(
                  action: dailyOps[i],
                  isLast: i == dailyOps.length - 1,
                ),
            ],
          ),
          const SizedBox(height: 20),
          _SectionHeader(title: tr(ref, 'financialsLedgers')),
          _SectionCard(
            children: [
              for (int i = 0; i < financials.length; i++)
                _MoreActionRow(
                  action: financials[i],
                  isLast: i == financials.length - 1,
                ),
            ],
          ),
          const SizedBox(height: 20),
          _SectionHeader(title: tr(ref, 'analyticsReminders')),
          _SectionCard(
            children: [
              for (int i = 0; i < analytics.length; i++)
                _MoreActionRow(
                  action: analytics[i],
                  isLast: i == analytics.length - 1,
                ),
            ],
          ),
          const SizedBox(height: 20),
          _SectionHeader(title: tr(ref, 'systemAdmin')),
          _SectionCard(
            children: [
              for (int i = 0; i < systemAdmin.length; i++)
                _MoreActionRow(
                  action: systemAdmin[i],
                  isLast: i == systemAdmin.length - 1,
                ),
            ],
          ),
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
  const _SectionHeader({required this.title, super.key});

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

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.children, super.key});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: theme.cardTheme.color ?? colorScheme.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: colorScheme.outlineVariant.withValues(alpha: isDark ? 0.15 : 0.4),
          width: 1,
        ),
        boxShadow: isDark
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.2),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                )
              ]
            : [
                BoxShadow(
                  color: colorScheme.primary.withValues(alpha: 0.04),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.02),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Column(
          children: children,
        ),
      ),
    );
  }
}

class _MoreActionRow extends StatefulWidget {
  const _MoreActionRow({
    required this.action,
    required this.isLast,
    super.key,
  });

  final _MoreAction action;
  final bool isLast;

  @override
  State<_MoreActionRow> createState() => _MoreActionRowState();
}

class _MoreActionRowState extends State<_MoreActionRow> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
      lowerBound: 0.96,
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
          splashColor: colorScheme.primary.withValues(alpha: 0.06),
          highlightColor: colorScheme.primary.withValues(alpha: 0.03),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: colorScheme.primary.withValues(alpha: isDark ? 0.12 : 0.08),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: colorScheme.primary.withValues(alpha: isDark ? 0.25 : 0.18),
                          width: 1.5,
                        ),
                      ),
                      child: Icon(
                        widget.action.icon,
                        size: 20,
                        color: colorScheme.primary,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.action.title,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            widget.action.subtitle,
                            style: TextStyle(
                              fontSize: 12,
                              color: colorScheme.onSurfaceVariant.withValues(alpha: 0.8),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      Icons.chevron_right_rounded,
                      color: colorScheme.onSurfaceVariant.withValues(alpha: 0.6),
                      size: 20,
                    ),
                  ],
                ),
              ),
              if (!widget.isLast)
                Padding(
                  padding: const EdgeInsets.only(left: 64),
                  child: Divider(
                    height: 1,
                    thickness: 1,
                    color: colorScheme.outlineVariant.withValues(alpha: isDark ? 0.1 : 0.3),
                  ),
                ),
            ],
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
    return RpPage(
      title: title,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(subtitle,
              style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant)),
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
            ),
          for (final movement in bootstrap.moneyMovements.take(8))
            _DataCard(
              title: _text(movement, 'type', fallback: tr(ref, 'cashBank')),
              subtitle:
                  '${_text(movement, 'note')} - ${shortDate(_text(movement, 'date'))}',
              trailing: money(_number(movement, 'amount')),
              entity: 'money-movements',
              id: _text(movement, 'id'),
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
            ),
        ];
      case 'bills':
        if (bootstrap.sales.isEmpty) {
          return [_EmptyCard(message: tr(ref, 'bills'))];
        }
        return [
          for (final sale in bootstrap.sales)
            _DataCard(
              title: sale.customer,
              subtitle: '${sale.products} - ${shortDate(sale.date)}',
              trailing: money(sale.amount),
              entity: 'sales',
              id: sale.id,
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
            ),
          for (final log in bootstrap.reminderLogs.take(8))
            _DataCard(
              title: _text(log, 'customerName', fallback: tr(ref, 'reminders')),
              subtitle:
                  '${_text(log, 'channel')} - ${shortDate(_text(log, 'sentAt'))}',
              trailing: _text(log, 'status', fallback: 'Sent'),
              entity: 'reminders',
              id: _text(log, 'id'),
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
            ),
          for (final movement in bootstrap.inventoryMovements.take(10))
            _DataCard(
              title: _text(movement, 'reason', fallback: tr(ref, 'stock')),
              subtitle: _text(movement, 'productName'),
              trailing: _number(movement, 'delta').toString(),
              entity: 'inventory-movements',
              id: _text(movement, 'id'),
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
            ),
          for (final flag in bootstrap.featureFlags)
            _DataCard(
              title: _text(flag, 'name', fallback: 'Feature'),
              subtitle: _text(flag, 'description'),
              trailing: _text(flag, 'enabled', fallback: ''),
              entity: 'feature-flags',
              id: _text(flag, 'id'),
            ),
        ];
      default:
        return [_EmptyCard(message: tr(ref, 'mobileExpansion'))];
    }
  }
}

class _DataCard extends StatelessWidget {
  const _DataCard({
    required this.title,
    required this.subtitle,
    required this.trailing,
    this.entity,
    this.id,
  });

  final String title;
  final String subtitle;
  final String trailing;
  final String? entity;
  final String? id;

  @override
  Widget build(BuildContext context) {
    final canOpen = entity != null && id != null && id!.isNotEmpty;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: RpCard(
        onTap: canOpen
            ? () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => ApiDetailScreen(
                      title: title,
                      entity: entity!,
                      id: id!,
                    ),
                  ),
                );
              }
            : null,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(fontWeight: FontWeight.w900)),
                  const SizedBox(height: 3),
                  Text(subtitle,
                      style: TextStyle(
                          color:
                              Theme.of(context).colorScheme.onSurfaceVariant)),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Text(trailing, style: const TextStyle(fontWeight: FontWeight.w900)),
            if (canOpen) ...[
              const SizedBox(width: 6),
              const Icon(Icons.chevron_right),
            ],
          ],
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

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.title,
    required this.value,
    required this.subtitle,
  });

  final String title;
  final String value;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: RpCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant)),
            const SizedBox(height: 6),
            Text(value,
                style: Theme.of(context)
                    .textTheme
                    .headlineSmall
                    ?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            Text(subtitle),
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
