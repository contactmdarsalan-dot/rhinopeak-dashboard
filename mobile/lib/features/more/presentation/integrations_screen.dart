import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../shared/widgets/rp_widgets.dart';

class IntegrationsScreen extends ConsumerStatefulWidget {
  const IntegrationsScreen({super.key});

  @override
  ConsumerState<IntegrationsScreen> createState() => _IntegrationsScreenState();
}

class _IntegrationsScreenState extends ConsumerState<IntegrationsScreen> {
  final List<Map<String, dynamic>> _integrations = [
    {
      'name': 'eSewa Pay',
      'category': 'Payments',
      'description': 'Enable instant billing payments for customers in Nepal via eSewa merchant gateway.',
      'icon': Icons.account_balance_wallet_rounded,
      'color': const Color(0xFF0FA871),
      'connected': true,
    },
    {
      'name': 'Stripe',
      'category': 'Payments',
      'description': 'Process international credit card payments and automated monthly billing invoices.',
      'icon': Icons.credit_card_rounded,
      'color': const Color(0xFF0A6E46),
      'connected': false,
    },
    {
      'name': 'WhatsApp Business',
      'category': 'Messaging',
      'description': 'Send automated PDF invoice links and reorder reminders directly to customers.',
      'icon': Icons.chat_bubble_outline_rounded,
      'color': const Color(0xFF0FA871),
      'connected': true,
    },
    {
      'name': 'Warehouse RFID Scanner',
      'category': 'IoT Devices',
      'description': 'Sync barcode and RFID hardware scans with your real-time stocks and inventory movement.',
      'icon': Icons.document_scanner_outlined,
      'color': const Color(0xFFFFA733),
      'connected': false,
    },
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      backgroundColor: const Color(0xFFF7F7FA),
      appBar: AppBar(
        title: const Text('Integrations'),
      ),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _integrations.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final item = _integrations[index];
          return RpCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: item['color'].withOpacity(0.08),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(item['icon'], color: item['color'], size: 24),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                item['name'],
                                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: Colors.grey.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  item['category'].toUpperCase(),
                                  style: const TextStyle(fontSize: 8.5, fontWeight: FontWeight.bold, color: Color(0xFF757891)),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            item['description'],
                            style: const TextStyle(fontSize: 12.5, color: Color(0xFF757891), height: 1.35),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const Divider(height: 1),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      item['connected'] ? 'Status: Active' : 'Status: Disconnected',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: item['connected'] ? const Color(0xFF0FA871) : const Color(0xFF757891),
                      ),
                    ),
                    Switch(
                      value: item['connected'],
                      activeColor: const Color(0xFF0FA871),
                      onChanged: (val) {
                        setState(() {
                          item['connected'] = val;
                        });
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(val ? '${item['name']} Connected' : '${item['name']} Disconnected'),
                            behavior: SnackBarBehavior.floating,
                            duration: const Duration(seconds: 1),
                          ),
                        );
                      },
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
