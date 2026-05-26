import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import '../../../app/state/app_controller.dart';
import '../../../shared/widgets/rp_widgets.dart';

class SubscriptionScreen extends ConsumerStatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  ConsumerState<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends ConsumerState<SubscriptionScreen> {
  bool _isAnnual = false;
  int _selectedTierIndex = 1; // Pro is selected by default

  final List<Map<String, dynamic>> _tiers = [
    {
      'name': 'Starter',
      'monthlyPrice': 0,
      'annualPrice': 0,
      'description': 'Ideal for micro-retailers and new local businesses.',
      'features': [
        'Up to 100 products',
        'Basic accounting ledger',
        'Manual stock movements',
        'Single user log',
      ],
      'color': const Color(0xFF757891),
      'isPopular': false,
    },
    {
      'name': 'Pro Business',
      'monthlyPrice': 1499,
      'annualPrice': 1199,
      'description': 'Complete business OS with AI OCR scanner & IoT sensors.',
      'features': [
        'Unlimited products',
        'AI OCR Bill Scanner & Parsing',
        'Smartphone IoT Sensor Hub',
        'Real-time automated reminders',
        'AI Seasonal Demand Forecasts',
        'Up to 5 team roles',
      ],
      'color': const Color(0xFF0A6E46), // Deep Himalayan Green
      'isPopular': true,
    },
    {
      'name': 'Enterprise',
      'monthlyPrice': 4999,
      'annualPrice': 3999,
      'description': 'For multi-location stores requiring premium automation.',
      'features': [
        'Everything in Pro',
        'Multi-warehouse RFID syncing',
        'Dedicated account manager',
        'Custom web integrations & API',
        'Priority 24/7 Support SLA',
        'Unlimited team members',
      ],
      'color': const Color(0xFFFFA733), // Warm Orange
      'isPopular': false,
    },
  ];

  bool _checkingOut = false;

  Future<void> _startPayment(String gateway, String gatewayLabel) async {
    if (_checkingOut) return;
    final tier = _tiers[_selectedTierIndex];
    final price = _isAnnual ? tier['annualPrice'] : tier['monthlyPrice'];
    final amount = (price * (_isAnnual ? 12 : 1)).toDouble();
    final tierName = tier['name'].toString();
    setState(() => _checkingOut = true);
    try {
      final checkout = await ref.read(mobileRepositoryProvider).initiatePayment(
            gateway: gateway,
            amount: amount,
            plan: 'pro',
            billingCycle: _isAnnual ? 'annual' : 'monthly',
          );
      if (!mounted) return;
      _showCheckoutSheet(
        gatewayLabel: gatewayLabel,
        tierName: tierName,
        amount: amount,
        checkout: checkout,
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          backgroundColor: Colors.red.shade700,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _checkingOut = false);
    }
  }

  void _showCheckoutSheet({
    required String gatewayLabel,
    required String tierName,
    required double amount,
    required Map<String, dynamic> checkout,
  }) {
    final payment =
        Map<String, dynamic>.from((checkout['payment'] as Map?) ?? const {});
    final session =
        Map<String, dynamic>.from((checkout['session'] as Map?) ?? const {});
    final paymentUrl =
        (payment['payment_url'] ?? payment['form_url'] ?? '').toString();
    final transactionUuid =
        (checkout['transactionUuid'] ?? session['transactionUuid'] ?? '')
            .toString();
    final fields =
        Map<String, dynamic>.from((payment['fields'] as Map?) ?? const {});
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(28),
              topRight: Radius.circular(28),
            ),
          ),
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 5,
                  decoration: BoxDecoration(
                    color: Colors.grey.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Checkout via $gatewayLabel',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF0F101A),
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0A6E46).withOpacity(0.08),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      tierName,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0A6E46),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Divider(),
              const SizedBox(height: 16),
              if (transactionUuid.isNotEmpty) ...[
                const Text(
                  'Transaction',
                  style: TextStyle(
                      color: Color(0xFF757891), fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 6),
                SelectableText(
                  transactionUuid,
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, color: Color(0xFF0F101A)),
                ),
                const SizedBox(height: 16),
              ],
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Billing Term',
                    style: TextStyle(
                        color: Color(0xFF757891), fontWeight: FontWeight.w600),
                  ),
                  Text(
                    _isAnnual ? 'Annual (20% Off)' : 'Monthly',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, color: Color(0xFF0F101A)),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Amount Due',
                    style: TextStyle(
                        color: Color(0xFF757891), fontWeight: FontWeight.w600),
                  ),
                  Text(
                    'Rs ${amount.toStringAsFixed(2)}',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF0F101A),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 28),
              if (paymentUrl.isNotEmpty) ...[
                SelectableText(
                  paymentUrl,
                  style: const TextStyle(
                    color: Color(0xFF0A6E46),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: paymentUrl));
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Checkout link copied.')),
                    );
                  },
                  icon: const Icon(Icons.copy_rounded),
                  label: const Text('Copy Checkout Link'),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                    backgroundColor: const Color(0xFF0A6E46),
                  ),
                ),
              ],
              if (fields.isNotEmpty) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF7F7FA),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: SelectableText(
                    fields.entries
                        .map((entry) => '${entry.key}: ${entry.value}')
                        .join('\n'),
                    style:
                        const TextStyle(fontSize: 12, color: Color(0xFF0F101A)),
                  ),
                ),
              ],
              const SizedBox(height: 12),
              TextButton(
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: transactionUuid));
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content: Text('Transaction reference copied.')),
                  );
                },
                child: const Text('Copy Transaction Ref',
                    style: TextStyle(color: Color(0xFF0A6E46))),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Close',
                    style: TextStyle(color: Color(0xFF757891))),
              ),
              const SizedBox(height: 12),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F7FA),
      appBar: AppBar(
        title: const Text('Subscription & Billing'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Current Plan Header Card
            RpCard(
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0A6E46).withOpacity(0.08),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.workspace_premium_rounded,
                      color: Color(0xFF0A6E46),
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Current Subscription Plan',
                          style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF757891),
                              fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'Free Trial Standard',
                          style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF0F101A)),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Expires in 8 days. Upgrade to unlock all limits.',
                          style: TextStyle(
                              fontSize: 11.5,
                              color: Colors.red.shade600,
                              fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Term Selector Toggle
            Center(
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: Colors.grey.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _TermTab(
                      label: 'Monthly',
                      isActive: !_isAnnual,
                      onTap: () => setState(() => _isAnnual = false),
                    ),
                    _TermTab(
                      label: 'Annual (20% Off)',
                      isActive: _isAnnual,
                      onTap: () => setState(() => _isAnnual = true),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Carousel / List of plans
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _tiers.length,
              itemBuilder: (context, index) {
                final tier = _tiers[index];
                final isSelected = _selectedTierIndex == index;
                final price =
                    _isAnnual ? tier['annualPrice'] : tier['monthlyPrice'];

                return GestureDetector(
                  onTap: () => setState(() => _selectedTierIndex = index),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: isSelected ? tier['color'] : Colors.transparent,
                        width: 2.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: isSelected
                              ? tier['color'].withOpacity(0.08)
                              : Colors.black.withOpacity(0.02),
                          blurRadius: 12,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              tier['name'],
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w900,
                                color: tier['color'],
                              ),
                            ),
                            if (tier['isPopular'])
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 4),
                                decoration: const BoxDecoration(
                                  color: Color(0xFFFFA733),
                                  borderRadius:
                                      BorderRadius.all(Radius.circular(12)),
                                ),
                                child: const Text(
                                  'POPULAR',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 9,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          tier['description'],
                          style: const TextStyle(
                              fontSize: 12.5,
                              color: Color(0xFF757891),
                              height: 1.35),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            const Text(
                              'Rs ',
                              style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF0F101A)),
                            ),
                            Text(
                              '$price',
                              style: const TextStyle(
                                  fontSize: 32,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFF0F101A)),
                            ),
                            const Text(
                              ' / month',
                              style: TextStyle(
                                  fontSize: 13, color: Color(0xFF757891)),
                            ),
                          ],
                        ),
                        if (_isAnnual && price > 0)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              'Billed annually (Rs ${price * 12}/yr)',
                              style: const TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF0FA871),
                                  fontWeight: FontWeight.bold),
                            ),
                          ),
                        const SizedBox(height: 16),
                        const Divider(),
                        const SizedBox(height: 14),
                        ...tier['features'].map<Widget>((feature) {
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Row(
                              children: [
                                Icon(Icons.check_circle_outline_rounded,
                                    color: tier['color'], size: 16),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    feature,
                                    style: const TextStyle(
                                        fontSize: 12.5,
                                        color: Color(0xFF0F101A)),
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ],
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 8),

            // Checkout Card for online Pro upgrades
            if (_selectedTierIndex == 1) ...[
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  'Select Payment Gateway to Upgrade',
                  style: TextStyle(
                      fontWeight: FontWeight.bold, color: Color(0xFF757891)),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: _GatewayButton(
                      logoText: 'eSewa',
                      color: const Color(0xFF60BB46),
                      onTap: () {
                        unawaited(_startPayment('esewa', 'eSewa'));
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _GatewayButton(
                      logoText: 'Khalti',
                      color: const Color(0xFF5C2D91),
                      onTap: () {
                        unawaited(_startPayment('khalti', 'Khalti'));
                      },
                    ),
                  ),
                ],
              ),
              if (_checkingOut) ...[
                const SizedBox(height: 12),
                const LinearProgressIndicator(minHeight: 3),
              ],
            ] else if (_selectedTierIndex == 2) ...[
              FilledButton.icon(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                          'Enterprise requests are routed through support.'),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                },
                icon: const Icon(Icons.support_agent_rounded),
                label: const Text('Contact Sales'),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  backgroundColor: const Color(0xFF0A6E46),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16)),
                ),
              ),
            ],
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}

class _TermTab extends StatelessWidget {
  const _TermTab({
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  final String label;
  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          boxShadow: isActive
              ? [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: isActive ? const Color(0xFF0F101A) : const Color(0xFF757891),
          ),
        ),
      ),
    );
  }
}

class _GatewayButton extends StatelessWidget {
  const _GatewayButton({
    required this.logoText,
    required this.color,
    required this.onTap,
  });

  final String logoText;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: color.withOpacity(0.07),
          border: Border.all(color: color.withOpacity(0.25), width: 1.5),
          borderRadius: BorderRadius.circular(16),
        ),
        alignment: Alignment.center,
        child: Text(
          logoText,
          style: TextStyle(
            color: color,
            fontWeight: FontWeight.w900,
            fontSize: 15,
          ),
        ),
      ),
    );
  }
}
