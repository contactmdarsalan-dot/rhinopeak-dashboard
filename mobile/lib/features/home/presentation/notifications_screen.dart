import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../shared/widgets/rp_widgets.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  String _selectedTab = 'All';

  final List<Map<String, dynamic>> _notifications = [
    {
      'title': 'Low Stock Warning',
      'body': 'Mexican Papaya has fallen below reorder level (5). Current stock: 2 kg.',
      'type': 'Alert',
      'time': '10 mins ago',
      'icon': Icons.warning_amber_rounded,
      'color': const Color(0xFFD43C42),
      'read': false,
    },
    {
      'title': 'AI Invoice Extracted',
      'body': 'Successfully parsed bill "Himalaya Hotel receipt". Total: Rs 460.00 extracted.',
      'type': 'Update',
      'time': '1 hour ago',
      'icon': Icons.document_scanner_rounded,
      'color': const Color(0xFF0FA871),
      'read': false,
    },
    {
      'title': 'AI Insight: Sales Peak',
      'body': 'Sales increased 18% this week compared to last week. Consider restocking fast-moving items.',
      'type': 'AI Insight',
      'time': '5 hours ago',
      'icon': Icons.auto_awesome_rounded,
      'color': const Color(0xFFFFA733),
      'read': true,
    },
    {
      'title': 'Payment Settled',
      'body': 'Customer "Annie Holland" has settled invoice RP-2026-904 (Rs 12,450.00) via eSewa.',
      'type': 'Update',
      'time': '1 day ago',
      'icon': Icons.check_circle_outline_rounded,
      'color': const Color(0xFF0A6E46),
      'read': true,
    },
    {
      'title': 'Device Edge Connected',
      'body': 'Pixel 9 Pro XL is active as IoT node. Live GPS location tracking is operational.',
      'type': 'Alert',
      'time': '2 days ago',
      'icon': Icons.sensors_rounded,
      'color': const Color(0xFF0FA871),
      'read': true,
    },
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final filteredList = _notifications.where((n) {
      if (_selectedTab == 'All') return true;
      return n['type'] == _selectedTab;
    }).toList();

    return Scaffold(
      backgroundColor: colorScheme.surface,
      appBar: AppBar(
        title: const Text('Notifications'),
        centerTitle: false,
        actions: [
          TextButton(
            onPressed: () {
              setState(() {
                for (var n in _notifications) {
                  n['read'] = true;
                }
              });
            },
            child: const Text('Mark all as read'),
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Tabs
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: ['All', 'Alert', 'Update', 'AI Insight'].map((tab) {
                  final isSelected = _selectedTab == tab;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(tab),
                      selected: isSelected,
                      onSelected: (val) {
                        if (val) setState(() => _selectedTab = tab);
                      },
                      selectedColor: colorScheme.primary.withOpacity(0.12),
                      labelStyle: TextStyle(
                        color: isSelected ? colorScheme.primary : const Color(0xFF757891),
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                      ),
                      side: BorderSide(
                        color: isSelected ? colorScheme.primary : Colors.transparent,
                      ),
                      backgroundColor: const Color(0xFFF7F7FA),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: filteredList.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.notifications_none_rounded,
                          size: 64,
                          color: colorScheme.outlineVariant,
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'All caught up!',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF757891),
                          ),
                        ),
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: filteredList.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final item = filteredList[index];
                      return Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: item['read'] ? const Color(0xFFF7F7FA) : Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: item['read']
                                ? Colors.transparent
                                : colorScheme.primary.withOpacity(0.15),
                            width: 1,
                          ),
                          boxShadow: item['read']
                              ? []
                              : [
                                  BoxShadow(
                                    color: colorScheme.primary.withOpacity(0.04),
                                    blurRadius: 12,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Icon container
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: item['color'].withOpacity(0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Icon(
                                item['icon'],
                                color: item['color'],
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 14),
                            // Text contents
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        item['title'],
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 15,
                                          color: item['read']
                                              ? const Color(0xFF757891)
                                              : const Color(0xFF0F101A),
                                        ),
                                      ),
                                      if (!item['read'])
                                        Container(
                                          width: 6,
                                          height: 6,
                                          decoration: BoxDecoration(
                                            color: colorScheme.primary,
                                            shape: BoxShape.circle,
                                          ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    item['body'],
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: item['read']
                                          ? const Color(0xFF757891).withOpacity(0.8)
                                          : const Color(0xFF757891),
                                      height: 1.35,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    item['time'],
                                    style: const TextStyle(
                                      fontSize: 10.5,
                                      color: Color(0xFF757891),
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
