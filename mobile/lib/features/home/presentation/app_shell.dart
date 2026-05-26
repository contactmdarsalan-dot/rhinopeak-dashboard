import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/state/app_controller.dart';
import '../../../services/deep_link_service.dart';
import '../../../services/push_notification_service.dart';
import '../../../shared/widgets/rp_widgets.dart';
import '../../dashboard/presentation/dashboard_screen.dart';
import '../../inventory/presentation/inventory_screen.dart';
import '../../more/presentation/more_screen.dart';
import '../../more/presentation/parties_screen.dart';
import '../../quick_add/presentation/quick_add_screen.dart';
import '../../settings/presentation/settings_screen.dart';

class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key});

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  int _index = 0;

  @override
  void initState() {
    super.initState();
    deepLinkService.addHandler(_handleDeepLink);
    pushNotificationService.addHandler(_handleNotification);
    pushNotificationService.addTokenHandler(_handlePushToken);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_initializeNotifications());
    });
  }

  @override
  void dispose() {
    deepLinkService.removeHandler(_handleDeepLink);
    pushNotificationService.removeHandler(_handleNotification);
    pushNotificationService.removeTokenHandler(_handlePushToken);
    super.dispose();
  }

  Future<void> _initializeNotifications() async {
    await pushNotificationService.requestPermission();
    if (!mounted) return;
    await ref.read(appControllerProvider.notifier).registerCurrentPushToken();
  }

  void _handlePushToken(String _) {
    ref.read(appControllerProvider.notifier).registerCurrentPushToken();
  }

  void _handleNotification(Map<String, dynamic> payload) {
    final link = payload['link']?.toString() ?? payload['deepLink']?.toString();
    if (link == null || link.isEmpty) return;
    final uri = Uri.tryParse(link);
    if (uri != null) _handleDeepLink(uri);
  }

  void _handleDeepLink(Uri uri) {
    final target = _tabFromUri(uri);
    if (target == null || !mounted) return;
    setState(() => _index = target);
  }

  int? _tabFromUri(Uri uri) {
    final segments =
        uri.pathSegments.map((part) => part.toLowerCase()).toList();
    final target = segments.isEmpty ? uri.host.toLowerCase() : segments.first;
    switch (target) {
      case 'dashboard':
      case 'home':
        return 0;
      case 'parties':
      case 'customers':
      case 'suppliers':
        return 1;
      case 'inventory':
      case 'stock':
        return 2;
      case 'more':
      case 'settings':
      case 'billing':
      case 'reports':
        return 3;
      default:
        return null;
    }
  }

  void _showQuickAddSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (_, scrollController) => Container(
          decoration: BoxDecoration(
            color: Theme.of(context).scaffoldBackgroundColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.outlineVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const Expanded(child: QuickAddScreen()),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(appControllerProvider.select((state) => state.error), (_, next) {
      if (next == null) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(next)));
    });

    final pages = [
      const DashboardScreen(),
      const PartiesScreen(),
      const InventoryScreen(),
      MoreScreen(
        onOpenSettings: () {
          Navigator.of(
            context,
          ).push(MaterialPageRoute(builder: (_) => const SettingsScreen()));
        },
      ),
    ];

    return Scaffold(
      extendBody: true,
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: _MobileBottomNav(
        currentIndex: _index,
        onTap: (buttonIndex) {
          if (buttonIndex == 2) {
            _showQuickAddSheet();
          } else {
            int targetScreenIndex = buttonIndex;
            if (buttonIndex > 2) {
              targetScreenIndex = buttonIndex - 1;
            }
            setState(() => _index = targetScreenIndex);
          }
        },
      ),
    );
  }
}

class _MobileBottomNav extends ConsumerWidget {
  const _MobileBottomNav({required this.currentIndex, required this.onTap});

  final int currentIndex;
  final ValueChanged<int> onTap;

  bool _isButtonSelected(int currentTab, int buttonIndex) {
    if (buttonIndex == 0) return currentTab == 0;
    if (buttonIndex == 1) return currentTab == 1;
    if (buttonIndex == 2) return false;
    if (buttonIndex == 3) return currentTab == 2;
    if (buttonIndex == 4) return currentTab == 3;
    return false;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final items = [
      _NavItem(icon: Icons.grid_view_rounded, label: tr(ref, 'home')),
      _NavItem(icon: Icons.people_outline_rounded, label: tr(ref, 'parties')),
      _NavItem(
        icon: Icons.add_rounded,
        label: tr(ref, 'add'),
        primary: true,
      ),
      _NavItem(icon: Icons.inventory_2_outlined, label: tr(ref, 'stock')),
      _NavItem(icon: Icons.more_horiz, label: tr(ref, 'more')),
    ];

    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Container(
        height: 84,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: scheme.surface.withValues(alpha: isDark ? 0.88 : 0.94),
          borderRadius: BorderRadius.circular(32),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.35 : 0.12),
              blurRadius: 28,
              offset: const Offset(0, 10),
            ),
            BoxShadow(
              color: scheme.primary.withValues(alpha: isDark ? 0.04 : 0.02),
              blurRadius: 8,
              offset: const Offset(0, -2),
            ),
          ],
          border: Border.all(
            color: scheme.outlineVariant.withValues(alpha: isDark ? 0.15 : 0.4),
            width: 1,
          ),
        ),
        child: Row(
          children: [
            for (var i = 0; i < items.length; i++)
              Expanded(
                child: _NavButton(
                  item: items[i],
                  selected: _isButtonSelected(currentIndex, i),
                  onTap: () => onTap(i),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _NavButton extends StatefulWidget {
  const _NavButton({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final _NavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  State<_NavButton> createState() => _NavButtonState();
}

class _NavButtonState extends State<_NavButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
      lowerBound: 0.88,
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
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final activeColor = scheme.primary;
    final inactiveColor = scheme.onSurfaceVariant.withValues(alpha: 0.7);

    final color = widget.item.primary
        ? Colors.white
        : widget.selected
            ? activeColor
            : inactiveColor;

    Widget navItemContent;

    if (widget.item.primary) {
      // Glow capsule for the Quick Add FAB
      navItemContent = Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [scheme.primary, scheme.secondary],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: scheme.primary.withValues(alpha: isDark ? 0.5 : 0.35),
              blurRadius: 18,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Icon(widget.item.icon, color: Colors.white, size: 28),
      );
    } else {
      navItemContent = Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: 44,
            height: 38,
            decoration: BoxDecoration(
              color: widget.selected
                  ? scheme.primary.withValues(alpha: isDark ? 0.15 : 0.08)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Icon(
              widget.item.icon,
              color: color,
              size: widget.selected ? 24 : 22,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            widget.item.label,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: color,
                  fontWeight:
                      widget.selected ? FontWeight.w900 : FontWeight.w700,
                  fontSize: 10.5,
                  letterSpacing: 0.1,
                ),
          ),
        ],
      );
    }

    return Semantics(
      button: true,
      selected: widget.selected,
      label: widget.item.label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => _controller.reverse(),
        onTapUp: (_) {
          _controller.forward();
          widget.onTap();
        },
        onTapCancel: () => _controller.forward(),
        child: ScaleTransition(
          scale: _scaleAnimation,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Center(child: navItemContent),
          ),
        ),
      ),
    );
  }
}

class _NavItem {
  const _NavItem({
    required this.icon,
    required this.label,
    this.primary = false,
  });

  final IconData icon;
  final String label;
  final bool primary;
}
