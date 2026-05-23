import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/state/app_controller.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/rhino_models.dart';
import '../../../shared/widgets/rp_widgets.dart';
import '../../home/presentation/assistant_chat_sheet.dart';
import '../../quick_add/presentation/scan_bill_screen.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(appControllerProvider);
    final bootstrap = state.bootstrap;

    if (bootstrap == null) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    return RpPage(
      title: tr(ref, 'dashboard'),
      action: IconButton.filledTonal(
        onPressed: state.loading
            ? null
            : () => ref.read(appControllerProvider.notifier).refreshBootstrap(),
        icon: const Icon(Icons.sync),
        tooltip: tr(ref, 'sync'),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _WelcomeCard(bootstrap: bootstrap),
          const SizedBox(height: 20),
          const _DashboardActions(),
          const SizedBox(height: 20),
          _StatGrid(bootstrap: bootstrap),
          const SizedBox(height: 20),
          _RecentSales(bootstrap: bootstrap),
          const SizedBox(height: 20),
          _LowStock(bootstrap: bootstrap),
        ],
      ),
    );
  }
}

class _WelcomeCard extends ConsumerWidget {
  const _WelcomeCard({required this.bootstrap});

  final BootstrapData bootstrap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            scheme.primary,
            scheme.secondary,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: scheme.primary.withValues(alpha: isDark ? 0.4 : 0.2),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Stack(
          children: [
            // Abstract visual terrain element inside card background
            Positioned(
              right: -20,
              bottom: -20,
              child: Icon(
                Icons.terrain_outlined,
                size: 140,
                color: Colors.white.withValues(alpha: 0.12),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                bootstrap.settings.businessName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 22,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: -0.5,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Icon(
                              Icons.verified,
                              color: Colors.white,
                              size: 18,
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(30),
                          ),
                          child: Text(
                            '${bootstrap.plan.toUpperCase()} - ${tr(ref, 'offlineReady')}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.1,
                            ),
                          ),
                        ),
                      ],
                    ),
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

class _DashboardActions extends ConsumerWidget {
  const _DashboardActions();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return RpCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr(ref, 'dailyOperations'),
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0,
                ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _DashboardActionButton(
                  icon: Icons.document_scanner_outlined,
                  title: tr(ref, 'scanBill'),
                  subtitle: tr(ref, 'scanBillDashboardHelp'),
                  primary: true,
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ScanBillScreen()),
                    );
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _DashboardActionButton(
                  icon: Icons.auto_awesome_rounded,
                  title: tr(ref, 'aiAssistant'),
                  subtitle: tr(ref, 'aiAssistantHelp'),
                  primary: false,
                  onTap: () {
                    showModalBottomSheet<void>(
                      context: context,
                      isScrollControlled: true,
                      useSafeArea: true,
                      backgroundColor: Colors.transparent,
                      builder: (_) => const AssistantChatSheet(),
                    );
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: scheme.primary.withValues(alpha: isDark ? 0.12 : 0.07),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: scheme.primary.withValues(alpha: isDark ? 0.22 : 0.14),
              ),
            ),
            child: Row(
              children: [
                Icon(Icons.verified_user_outlined, size: 16, color: scheme.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    tr(ref, 'reviewAndSave'),
                    style: TextStyle(
                      color: scheme.onSurfaceVariant.withValues(alpha: 0.9),
                      fontWeight: FontWeight.w800,
                      fontSize: 12,
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

class _DashboardActionButton extends StatelessWidget {
  const _DashboardActionButton({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.primary,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool primary;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final foreground = primary ? scheme.onPrimary : scheme.primary;
    final background = primary ? scheme.primary : scheme.primary.withValues(alpha: 0.08);

    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: Container(
        minHeight: 122,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: primary ? scheme.primary : scheme.primary.withValues(alpha: 0.18),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: foreground, size: 22),
            const SizedBox(height: 12),
            Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: foreground,
                fontWeight: FontWeight.w900,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 5),
            Text(
              subtitle,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: foreground.withValues(alpha: primary ? 0.78 : 0.72),
                height: 1.25,
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatGrid extends ConsumerWidget {
  const _StatGrid({required this.bootstrap});

  final BootstrapData bootstrap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = [
      StatCard(
        label: tr(ref, 'todayRevenue'),
        value: money(bootstrap.todayRevenue),
        icon: Icons.payments_outlined,
        color: AppTheme.success,
      ),
      StatCard(
        label: tr(ref, 'monthlyRevenue'),
        value: money(bootstrap.monthlyRevenue),
        icon: Icons.trending_up,
        color: AppTheme.accent,
      ),
      StatCard(
        label: tr(ref, 'creditDue'),
        value: money(bootstrap.creditDue),
        icon: Icons.account_balance_wallet_outlined,
        color: AppTheme.warning,
      ),
      StatCard(
        label: tr(ref, 'lowStock'),
        value: bootstrap.lowStockCount.toString(),
        icon: Icons.warning_amber_outlined,
        color: AppTheme.danger,
      ),
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: stats.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 14,
        mainAxisSpacing: 14,
        childAspectRatio: 1.25,
      ),
      itemBuilder: (_, index) => stats[index],
    );
  }
}

class _RecentSales extends ConsumerWidget {
  const _RecentSales({required this.bootstrap});

  final BootstrapData bootstrap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sales = bootstrap.sales.take(5).toList();
    final scheme = Theme.of(context).colorScheme;

    return _SectionCard(
      title: tr(ref, 'sales'),
      empty: tr(ref, 'emptySales'),
      icon: Icons.receipt_long_outlined,
      children: [
        for (final sale in sales)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              children: [
                // Glowing mini indicator green shopping icon
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppTheme.success.withValues(alpha: 0.08),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.shopping_cart_outlined,
                    size: 16,
                    color: AppTheme.success,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        trValue(ref, sale.customer),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 14.5,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              trProductList(ref, sale.products),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: scheme.onSurfaceVariant.withValues(alpha: 0.8),
                                fontSize: 12,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          // Payment capsule badge
                          RpTag(
                            label: trValue(ref, sale.payment),
                            color: sale.payment == 'Cash'
                                ? AppTheme.success
                                : sale.payment == 'Credit'
                                    ? AppTheme.warning
                                    : AppTheme.primary,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  money(sale.amount),
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 15,
                    letterSpacing: -0.2,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _LowStock extends ConsumerWidget {
  const _LowStock({required this.bootstrap});

  final BootstrapData bootstrap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final products = bootstrap.products
        .where((item) => item.stock <= item.reorderLevel)
        .take(5)
        .toList();
    final scheme = Theme.of(context).colorScheme;

    return _SectionCard(
      title: tr(ref, 'lowStock'),
      empty: tr(ref, 'emptyStock'),
      icon: Icons.warning_amber_outlined,
      children: [
        for (final product in products)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              children: [
                // Glowing orange warning icon
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppTheme.danger.withValues(alpha: 0.08),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.trending_down,
                    size: 16,
                    color: AppTheme.danger,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        trValue(ref, product.name),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 14.5,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${trValue(ref, product.category)} - ${trValue(ref, product.supplier)}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: scheme.onSurfaceVariant.withValues(alpha: 0.8),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      trQuantity(ref, product.stock, product.unit),
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 15,
                        color: AppTheme.danger,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${tr(ref, 'limit')}: ${trQuantity(ref, product.reorderLevel, product.unit)}',
                      style: TextStyle(
                        fontSize: 10.5,
                        color: scheme.onSurfaceVariant.withValues(alpha: 0.6),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.empty,
    required this.children,
    required this.icon,
  });

  final String title;
  final String empty;
  final List<Widget> children;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return RpCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: scheme.primary),
              const SizedBox(width: 8),
              Text(
                title,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.2,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (children.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Column(
                children: [
                  Icon(
                    Icons.inbox_outlined,
                    size: 38,
                    color: scheme.onSurfaceVariant.withValues(alpha: 0.4),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    empty,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: scheme.onSurfaceVariant.withValues(alpha: 0.7),
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: children.length,
              separatorBuilder: (_, __) => Divider(
                color: scheme.outlineVariant.withValues(alpha: isDark ? 0.15 : 0.3),
                height: 1,
              ),
              itemBuilder: (_, index) => children[index],
            ),
        ],
      ),
    );
  }
}
