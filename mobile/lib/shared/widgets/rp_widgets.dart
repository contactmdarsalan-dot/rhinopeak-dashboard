import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/localization/app_strings.dart';
import '../../app/state/app_controller.dart';

String tr(WidgetRef ref, String key) {
  return AppStrings.tr(ref.watch(appControllerProvider).language, key);
}

String trValue(WidgetRef ref, String value) {
  return AppStrings.trValue(ref.watch(appControllerProvider).language, value);
}

String trProductList(WidgetRef ref, String value) {
  final parts = value.split(',');
  return parts.map((part) {
    final trimmed = part.trim();
    final match = RegExp(r'^(.+?)\s+x\s+([0-9.,]+)\s*([A-Za-z]+)?$')
        .firstMatch(trimmed);
    if (match == null) return trValue(ref, trimmed);

    final name = trValue(ref, match.group(1)!.trim());
    final quantity = match.group(2)!;
    final unit = (match.group(3) ?? '').trim();
    return unit.isEmpty ? '$name x $quantity' : '$name x $quantity ${trValue(ref, unit)}';
  }).join(', ');
}

String trRecordText(WidgetRef ref, String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return value;
  if (trimmed.contains(' x ')) return trProductList(ref, trimmed);

  final labelValueMatch = RegExp(r'^([A-Za-z ]+):\s*(.+)$').firstMatch(trimmed);
  if (labelValueMatch != null) {
    return '${trValue(ref, labelValueMatch.group(1)!.trim())}: '
        '${trRecordText(ref, labelValueMatch.group(2)!.trim())}';
  }

  final suffixMatch =
      RegExp(r'^(.+?)\s+(voucher|account)$', caseSensitive: false)
          .firstMatch(trimmed);
  if (suffixMatch != null) {
    return '${trRecordText(ref, suffixMatch.group(1)!.trim())} '
        '${trValue(ref, suffixMatch.group(2)!.toLowerCase())}';
  }

  final countMatch = RegExp(r'^([0-9]+)\s+([A-Za-z ]+)$').firstMatch(trimmed);
  if (countMatch != null) {
    return '${countMatch.group(1)} ${trValue(ref, countMatch.group(2)!.trim())}';
  }

  if (trimmed.contains(' - ')) {
    return trimmed
        .split(' - ')
        .map((part) => trRecordText(ref, part))
        .join(' - ');
  }

  return trValue(ref, trimmed);
}

String trQuantity(WidgetRef ref, num value, String unit) {
  final rounded = value == value.roundToDouble()
      ? value.toInt().toString()
      : value.toStringAsFixed(2).replaceFirst(RegExp(r'\.?0+$'), '');
  return '$rounded ${trValue(ref, unit)}';
}

class RpPage extends StatelessWidget {
  const RpPage({
    required this.title,
    this.child,
    this.slivers,
    this.action,
    super.key,
  }) : assert(child != null || slivers != null);

  final String title;
  final Widget? child;
  final List<Widget>? slivers;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: CustomScrollView(
          physics: const ClampingScrollPhysics(),
          slivers: [
            SliverAppBar(
              pinned: false,
              floating: true,
              snap: true,
              backgroundColor: theme.scaffoldBackgroundColor,
              surfaceTintColor: Colors.transparent,
              title: Text(
                title,
                style: theme.appBarTheme.titleTextStyle?.copyWith(
                  letterSpacing: 0,
                  fontWeight: FontWeight.w900,
                ),
              ),
              actions: action == null
                  ? null
                  : [
                      Padding(
                        padding: const EdgeInsets.only(right: 16),
                        child: action,
                      )
                    ],
            ),
            if (slivers != null)
              ...slivers!
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
                sliver: SliverToBoxAdapter(child: child!),
              ),
          ],
        ),
      ),
    );
  }
}

class RpCard extends StatelessWidget {
  const RpCard({required this.child, this.onTap, super.key});

  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color ?? colorScheme.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color:
              colorScheme.outlineVariant.withValues(alpha: isDark ? 0.15 : 0.4),
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
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            splashColor: colorScheme.primary.withValues(alpha: 0.05),
            highlightColor: colorScheme.primary.withValues(alpha: 0.02),
            borderRadius: BorderRadius.circular(24),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

class RpTag extends StatelessWidget {
  const RpTag({required this.label, this.color, super.key});

  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final baseColor = color ?? scheme.primary;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: baseColor.withValues(alpha: isDark ? 0.12 : 0.08),
        borderRadius: BorderRadius.circular(30), // Pill/Capsule shape
        border: Border.all(
          color: baseColor.withValues(alpha: isDark ? 0.25 : 0.15),
          width: 1,
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: baseColor,
          fontSize: 11,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}

class StatCard extends StatelessWidget {
  const StatCard({
    required this.label,
    required this.value,
    required this.icon,
    this.color,
    super.key,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final primaryColor = color ?? scheme.primary;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return RpCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Beautiful Double Border Glass Icon Container
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: primaryColor.withValues(alpha: isDark ? 0.12 : 0.08),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: primaryColor.withValues(alpha: isDark ? 0.25 : 0.18),
                    width: 1.5,
                  ),
                ),
                child: Icon(icon, size: 20, color: primaryColor),
              ),
              // Subtle dynamic status dot
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: primaryColor.withValues(alpha: 0.6),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: scheme.onSurfaceVariant.withValues(alpha: 0.8),
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.2,
                    ),
              ),
              const SizedBox(height: 4),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  value,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0,
                        color: scheme.onSurface,
                      ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class ErrorBanner extends ConsumerWidget {
  const ErrorBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final error = ref.watch(appControllerProvider).error;
    if (error == null) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: scheme.errorContainer.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: scheme.error.withValues(alpha: 0.3),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline, color: scheme.error),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              error,
              style: TextStyle(
                color: scheme.onErrorContainer,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
