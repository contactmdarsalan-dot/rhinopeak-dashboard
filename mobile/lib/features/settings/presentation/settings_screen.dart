import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/app_strings.dart';
import '../../../app/state/app_controller.dart';
import '../../../shared/widgets/rp_widgets.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(appControllerProvider);
    final settings = state.bootstrap?.settings;
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return RpPage(
      title: tr(ref, 'settings'),
      action: state.loading
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : IconButton.filledTonal(
              onPressed: () =>
                  ref.read(appControllerProvider.notifier).refreshBootstrap(),
              icon: const Icon(Icons.sync_rounded),
              tooltip: tr(ref, 'sync'),
            ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Language Section ─────────────────────────────────────────────
          _SectionLabel(label: tr(ref, 'language')),
          RpCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: colorScheme.primary
                            .withValues(alpha: isDark ? 0.12 : 0.08),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: colorScheme.primary
                              .withValues(alpha: isDark ? 0.25 : 0.15),
                          width: 1.5,
                        ),
                      ),
                      child: Icon(Icons.translate_rounded,
                          size: 18, color: colorScheme.primary),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            tr(ref, 'language'),
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          Text(
                            state.language == AppLanguage.en
                                ? tr(ref, 'english')
                                : tr(ref, 'nepali'),
                            style: TextStyle(
                              fontSize: 12,
                              color: colorScheme.onSurfaceVariant
                                  .withValues(alpha: 0.75),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                SegmentedButton<AppLanguage>(
                  selected: {state.language},
                  segments: [
                    ButtonSegment(
                      value: AppLanguage.en,
                      label: Text(tr(ref, 'english')),
                      icon: const Icon(Icons.language_rounded, size: 16),
                    ),
                    ButtonSegment(
                      value: AppLanguage.ne,
                      label: Text(tr(ref, 'nepali')),
                      icon: const Icon(Icons.translate_rounded, size: 16),
                    ),
                  ],
                  onSelectionChanged: state.loading
                      ? null
                      : (selection) {
                          ref
                              .read(appControllerProvider.notifier)
                              .setLanguage(selection.first);
                        },
                  style: ButtonStyle(
                    shape: WidgetStateProperty.all(
                      RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // ── Business Info Section ────────────────────────────────────────
          _SectionLabel(label: tr(ref, 'businessName')),
          RpCard(
            child: Column(
              children: [
                _InfoRow(
                  icon: Icons.storefront_rounded,
                  label: tr(ref, 'businessName'),
                  value: settings?.businessName ?? '—',
                  color: colorScheme.primary,
                ),
                _Divider(),
                _InfoRow(
                  icon: Icons.currency_rupee_rounded,
                  label: tr(ref, 'currency'),
                  value: settings?.currency ?? 'NPR',
                  color: const Color(0xFF10B981),
                ),
                _Divider(),
                _InfoRow(
                  icon: Icons.percent_rounded,
                  label: tr(ref, 'tax'),
                  value: '${settings?.taxRate ?? 13}%',
                  color: const Color(0xFFF59E0B),
                ),
                _Divider(),
                _InfoRow(
                  icon: Icons.receipt_long_rounded,
                  label: tr(ref, 'invoicePrefix'),
                  value: settings?.invoicePrefix ?? 'RP',
                  color: colorScheme.secondary,
                ),
                _Divider(),
                _InfoRow(
                  icon: Icons.workspace_premium_rounded,
                  label: tr(ref, 'plan'),
                  value: state.bootstrap?.plan.toUpperCase() ?? '—',
                  color: const Color(0xFF8B5CF6),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // ── Sync Status Section ──────────────────────────────────────────
          _SectionLabel(label: tr(ref, 'sync')),
          RpCard(
            child: Column(
              children: [
                _StatusRow(
                  icon: Icons.cloud_done_rounded,
                  label: tr(ref, 'dbOnline'),
                  isActive: state.bootstrap != null,
                ),
                _Divider(),
                _StatusRow(
                  icon: Icons.offline_bolt_rounded,
                  label: tr(ref, 'offlineReady'),
                  isActive: state.bootstrap != null,
                ),
              ],
            ),
          ),

          const SizedBox(height: 28),

          // ── Action Buttons ───────────────────────────────────────────────
          FilledButton.icon(
            onPressed: state.loading
                ? null
                : () =>
                    ref.read(appControllerProvider.notifier).refreshBootstrap(),
            icon: state.loading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.cloud_sync_rounded, size: 18),
            label: Text(tr(ref, 'sync')),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: state.loading
                ? null
                : () => ref.read(appControllerProvider.notifier).logout(),
            icon: const Icon(Icons.logout_rounded, size: 18),
            label: Text(tr(ref, 'logout')),
            style: OutlinedButton.styleFrom(
              foregroundColor: colorScheme.error,
              side: BorderSide(
                color: colorScheme.error.withValues(alpha: 0.6),
                width: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Internal Widgets ──────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 8, bottom: 8),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          color: Theme.of(context).colorScheme.primary,
          fontWeight: FontWeight.w900,
          fontSize: 11,
          letterSpacing: 1.2,
        ),
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 52),
      child: Divider(
        height: 1,
        thickness: 1,
        color: Theme.of(context).colorScheme.outlineVariant.withValues(
            alpha: Theme.of(context).brightness == Brightness.dark ? 0.1 : 0.3),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: isDark ? 0.12 : 0.08),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 16, color: color),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: colorScheme.onSurface,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w900,
              color: colorScheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusRow extends StatelessWidget {
  const _StatusRow({
    required this.icon,
    required this.label,
    required this.isActive,
  });

  final IconData icon;
  final String label;
  final bool isActive;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    const activeColor = Color(0xFF10B981);
    final inactiveColor = colorScheme.onSurfaceVariant;
    final color = isActive ? activeColor : inactiveColor;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: isDark ? 0.12 : 0.08),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 16, color: color),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: colorScheme.onSurface,
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: color.withValues(alpha: isDark ? 0.15 : 0.08),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: color.withValues(alpha: isDark ? 0.3 : 0.2),
                width: 1,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: color,
                  ),
                ),
                const SizedBox(width: 5),
                Text(
                  isActive ? 'Online' : 'Offline',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: color,
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
