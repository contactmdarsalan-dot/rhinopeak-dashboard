import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/state/app_controller.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/rhino_models.dart';
import '../../../shared/widgets/api_detail_screen.dart';
import '../../../shared/widgets/rp_widgets.dart';

class SalesScreen extends ConsumerWidget {
  const SalesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bootstrap = ref.watch(appControllerProvider).bootstrap;
    final sales = bootstrap?.sales ?? const [];
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return RpPage(
      title: tr(ref, 'sales'),
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          sliver: SliverToBoxAdapter(
            child: _SalesSummaryBanner(
              helpText: tr(ref, 'easySaleHelp'),
              orderLabel: tr(ref, 'orders'),
              count: sales.length,
              colorScheme: colorScheme,
              isDark: isDark,
            ),
          ),
        ),
        if (sales.isEmpty)
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 120),
            sliver: SliverToBoxAdapter(
              child: _EmptyState(
                icon: Icons.point_of_sale_outlined,
                message: tr(ref, 'emptySales'),
              ),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 120),
            sliver: SliverList.builder(
              itemCount: sales.length * 2 - 1,
              itemBuilder: (context, index) {
                if (index.isOdd) return const SizedBox(height: 12);
                return _SaleCard(sale: sales[index ~/ 2]);
              },
            ),
          ),
      ],
    );
  }
}

class _SalesSummaryBanner extends StatelessWidget {
  const _SalesSummaryBanner({
    required this.helpText,
    required this.orderLabel,
    required this.count,
    required this.colorScheme,
    required this.isDark,
  });

  final String helpText;
  final String orderLabel;
  final int count;
  final ColorScheme colorScheme;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            colorScheme.primary.withValues(alpha: isDark ? 0.2 : 0.1),
            colorScheme.secondary.withValues(alpha: isDark ? 0.12 : 0.06),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: colorScheme.primary.withValues(alpha: isDark ? 0.3 : 0.15),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: colorScheme.primary.withValues(alpha: 0.15),
              shape: BoxShape.circle,
              border: Border.all(
                color: colorScheme.primary.withValues(alpha: 0.25),
                width: 1.5,
              ),
            ),
            child: Icon(Icons.receipt_long_rounded,
                color: colorScheme.primary, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              helpText,
              style: TextStyle(
                fontSize: 13,
                color: colorScheme.onSurfaceVariant.withValues(alpha: 0.85),
                height: 1.35,
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$count',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                  color: colorScheme.primary,
                  letterSpacing: 0,
                ),
              ),
              Text(
                orderLabel,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: colorScheme.onSurfaceVariant.withValues(alpha: 0.7),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SaleCard extends StatelessWidget {
  const _SaleCard({required this.sale});

  final Sale sale;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return RpCard(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => ApiDetailScreen(
              title: sale.customer,
              entity: 'sales',
              id: sale.id,
            ),
          ),
        );
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: colorScheme.primary
                      .withValues(alpha: isDark ? 0.12 : 0.08),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.person_outline_rounded,
                  size: 16,
                  color: colorScheme.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      sale.customer,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      sale.products,
                      style: TextStyle(
                        fontSize: 12.5,
                        color:
                            colorScheme.onSurfaceVariant.withValues(alpha: 0.8),
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                money(sale.amount),
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: colorScheme.primary,
                  letterSpacing: 0,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              _StatusTag(label: sale.payment, type: _TagType.payment),
              _StatusTag(
                label: sale.status,
                type: sale.status == 'Completed'
                    ? _TagType.success
                    : _TagType.danger,
              ),
              _StatusTag(label: shortDate(sale.date), type: _TagType.muted),
            ],
          ),
        ],
      ),
    );
  }
}

enum _TagType { payment, success, danger, muted }

class _StatusTag extends StatelessWidget {
  const _StatusTag({required this.label, required this.type});

  final String label;
  final _TagType type;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final Color baseColor;
    switch (type) {
      case _TagType.payment:
        baseColor = colorScheme.primary;
      case _TagType.success:
        baseColor = const Color(0xFF10B981);
      case _TagType.danger:
        baseColor = const Color(0xFFEF4444);
      case _TagType.muted:
        baseColor = colorScheme.onSurfaceVariant;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: baseColor.withValues(alpha: isDark ? 0.12 : 0.08),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(
          color: baseColor.withValues(alpha: isDark ? 0.3 : 0.2),
          width: 1,
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: baseColor,
          fontSize: 11,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: colorScheme.outlineVariant.withValues(alpha: isDark ? 0.15 : 0.35),
          width: 1,
        ),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: colorScheme.primary.withValues(alpha: isDark ? 0.12 : 0.07),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 32, color: colorScheme.primary.withValues(alpha: 0.6)),
          ),
          const SizedBox(height: 16),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: colorScheme.onSurfaceVariant.withValues(alpha: 0.7),
              fontSize: 14,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}
