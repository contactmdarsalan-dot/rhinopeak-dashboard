import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/state/app_controller.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/rp_widgets.dart';

class PartiesScreen extends ConsumerStatefulWidget {
  const PartiesScreen({super.key});

  @override
  ConsumerState<PartiesScreen> createState() => _PartiesScreenState();
}

class _PartiesScreenState extends ConsumerState<PartiesScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';
  String _filterType = 'All'; // 'All', 'Customer', 'Supplier'

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text.trim().toLowerCase();
      });
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appControllerProvider);
    final bootstrap = state.bootstrap;
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;

    if (bootstrap == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final parties = bootstrap.parties;

    // Calculate totals
    double totalReceivable = 0;
    double totalPayable = 0;
    for (final p in parties) {
      final balance = double.tryParse(p['balance']?.toString() ?? '0') ?? 0;
      final type = p['type']?.toString().toLowerCase() ?? '';
      if (type == 'customer' || p['direction'] == 'Receivable') {
        if (balance > 0) totalReceivable += balance;
      } else if (type == 'supplier' || p['direction'] == 'Payable') {
        if (balance > 0) totalPayable += balance;
      }
    }

    // Filter parties list
    final filteredParties = parties.where((p) {
      final name = (p['name']?.toString() ?? '').toLowerCase();
      final phone = (p['phone']?.toString() ?? '').toLowerCase();
      final type = p['type']?.toString() ?? '';

      final matchesSearch =
          name.contains(_searchQuery) || phone.contains(_searchQuery);

      if (_filterType == 'All') {
        return matchesSearch;
      } else if (_filterType == 'Customer') {
        return matchesSearch && type.toLowerCase() == 'customer';
      } else {
        return matchesSearch && type.toLowerCase() == 'supplier';
      }
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: Text(tr(ref, 'parties')),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () =>
                ref.read(appControllerProvider.notifier).refreshBootstrap(),
          ),
        ],
      ),
      body: Column(
        children: [
          // Total Cards Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isDark
                    ? [const Color(0xFF1E1B4B), const Color(0xFF311042)]
                    : [
                        colorScheme.primary.withOpacity(0.06),
                        colorScheme.secondary.withOpacity(0.04),
                      ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: const BorderRadius.vertical(
                bottom: Radius.circular(24),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF1F1F2E) : Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.04),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                      border: Border.all(
                        color: Colors.green.withOpacity(isDark ? 0.3 : 0.15),
                        width: 1.5,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(
                              Icons.arrow_downward,
                              color: Colors.green,
                              size: 16,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              tr(ref, 'creditCustomers'),
                              style: TextStyle(
                                fontSize: 11,
                                color: theme.textTheme.bodySmall?.color
                                    ?.withOpacity(0.7),
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          money(totalReceivable),
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: Colors.green,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF1F1F2E) : Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.04),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                      border: Border.all(
                        color: Colors.red.withOpacity(isDark ? 0.3 : 0.15),
                        width: 1.5,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(
                              Icons.arrow_upward,
                              color: Colors.red,
                              size: 16,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              tr(ref, 'suppliers'),
                              style: TextStyle(
                                fontSize: 11,
                                color: theme.textTheme.bodySmall?.color
                                    ?.withOpacity(0.7),
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          money(totalPayable),
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: Colors.red,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Search & Filter Row
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Search by name or phone...',
                      prefixIcon: const Icon(Icons.search, size: 20),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      filled: true,
                      fillColor: isDark
                          ? const Color(0xFF161622)
                          : Colors.grey.withOpacity(0.05),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Segmented Filter Chips
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: ['All', 'Customer', 'Supplier'].map((type) {
                final isSelected = _filterType == type;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(type),
                    selected: isSelected,
                    onSelected: (selected) {
                      if (selected) {
                        setState(() => _filterType = type);
                      }
                    },
                    selectedColor: colorScheme.primary.withOpacity(0.15),
                    labelStyle: TextStyle(
                      color: isSelected
                          ? colorScheme.primary
                          : theme.textTheme.bodyMedium?.color,
                      fontWeight: isSelected
                          ? FontWeight.bold
                          : FontWeight.normal,
                    ),
                    backgroundColor: isDark
                        ? const Color(0xFF1F1F2E)
                        : Colors.grey.withOpacity(0.08),
                    side: BorderSide(
                      color: isSelected
                          ? colorScheme.primary
                          : Colors.transparent,
                    ),
                  ),
                );
              }).toList(),
            ),
          ),

          // Parties List
          Expanded(
            child: filteredParties.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.people_outline,
                          size: 48,
                          color: colorScheme.onSurfaceVariant.withOpacity(0.4),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'No parties found',
                          style: TextStyle(color: colorScheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: filteredParties.length,
                    itemBuilder: (context, index) {
                      final party = filteredParties[index];
                      final name = party['name']?.toString() ?? 'Unnamed';
                      final type = party['type']?.toString() ?? 'Customer';
                      final phone = party['phone']?.toString() ?? '';
                      final balance =
                          double.tryParse(
                            party['balance']?.toString() ?? '0',
                          ) ??
                          0;

                      final isCustomer = type.toLowerCase() == 'customer';
                      Color balanceColor = Colors.green;
                      String balanceLabel = 'To Receive';

                      if (balance < 0) {
                        balanceColor = Colors.red;
                        balanceLabel = 'To Pay';
                      } else if (balance == 0) {
                        balanceColor = colorScheme.onSurfaceVariant;
                        balanceLabel = 'Settled';
                      } else {
                        if (!isCustomer) {
                          balanceColor = Colors.red;
                          balanceLabel = 'To Pay';
                        }
                      }

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: isDark
                              ? const Color(0xFF161622)
                              : Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: colorScheme.outlineVariant.withOpacity(
                              isDark ? 0.1 : 0.4,
                            ),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.02),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 8,
                          ),
                          leading: CircleAvatar(
                            backgroundColor: colorScheme.primary.withOpacity(
                              0.1,
                            ),
                            child: Text(
                              name.isNotEmpty ? name[0].toUpperCase() : 'P',
                              style: TextStyle(
                                color: colorScheme.primary,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          title: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  name,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 15,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color:
                                      (isCustomer
                                              ? colorScheme.primary
                                              : colorScheme.secondary)
                                          .withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  type.toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w900,
                                    color: isCustomer
                                        ? colorScheme.primary
                                        : colorScheme.secondary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          subtitle: phone.isNotEmpty
                              ? Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Row(
                                    children: [
                                      Icon(
                                        Icons.phone_outlined,
                                        size: 13,
                                        color: colorScheme.onSurfaceVariant,
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        phone,
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: colorScheme.onSurfaceVariant,
                                        ),
                                      ),
                                    ],
                                  ),
                                )
                              : null,
                          trailing: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                balanceLabel,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: balanceColor.withOpacity(0.7),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                money(balance.abs()),
                                style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 14,
                                  color: balanceColor,
                                ),
                              ),
                            ],
                          ),
                          onTap: () => _openPartyLedger(context, party),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  void _openPartyLedger(BuildContext context, Map<String, dynamic> party) {
    final partyId = party['id']?.toString() ?? '';
    final name = party['name']?.toString() ?? 'Unnamed';
    final type = party['type']?.toString() ?? 'Customer';

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => _PartyLedgerDetailScreen(
          partyId: partyId,
          partyName: name,
          partyType: type,
        ),
      ),
    );
  }
}

class _PartyLedgerDetailScreen extends ConsumerStatefulWidget {
  const _PartyLedgerDetailScreen({
    required this.partyId,
    required this.partyName,
    required this.partyType,
  });

  final String partyId;
  final String partyName;
  final String partyType;

  @override
  ConsumerState<_PartyLedgerDetailScreen> createState() =>
      _PartyLedgerDetailScreenState();
}

class _PartyLedgerDetailScreenState
    extends ConsumerState<_PartyLedgerDetailScreen> {
  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appControllerProvider);
    final bootstrap = state.bootstrap;
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;

    if (bootstrap == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    // Filter party ledger entries
    final ledgerEntries = bootstrap.partyLedger.where((entry) {
      return entry['partyId']?.toString() == widget.partyId;
    }).toList();

    // Sort by date desc
    ledgerEntries.sort((a, b) {
      final dateA = a['date']?.toString() ?? '';
      final dateB = b['date']?.toString() ?? '';
      return dateB.compareTo(dateA);
    });

    // Find party balance
    final party = bootstrap.parties.firstWhere(
      (p) => p['id']?.toString() == widget.partyId,
      orElse: () => <String, dynamic>{},
    );
    final balance = double.tryParse(party['balance']?.toString() ?? '0') ?? 0;
    final isCustomer = widget.partyType.toLowerCase() == 'customer';

    String balanceLabel = 'To Receive';

    if (balance < 0) {
      balanceLabel = 'To Pay';
    } else if (balance == 0) {
      balanceLabel = 'Settled';
    } else {
      if (!isCustomer) {
        balanceLabel = 'To Pay';
      }
    }

    return Scaffold(
      appBar: AppBar(title: Text(widget.partyName)),
      body: Column(
        children: [
          // Header Card
          Container(
            width: double.infinity,
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isDark
                    ? [const Color(0xFF2E1065), const Color(0xFF1E1B4B)]
                    : [colorScheme.primary, colorScheme.primary.withBlue(220)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: colorScheme.primary.withOpacity(0.3),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.partyType.toUpperCase(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: Colors.white.withOpacity(0.7),
                    letterSpacing: 1.0,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  widget.partyName,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                ),
                if (party['phone'] != null &&
                    party['phone'].toString().isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.phone, size: 14, color: Colors.white70),
                      const SizedBox(width: 6),
                      Text(
                        party['phone'].toString(),
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ],
                const Divider(height: 24, color: Colors.white24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Outstanding Balance',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.white.withOpacity(0.8),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          balanceLabel,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: balance == 0
                                ? Colors.white70
                                : (balance > 0
                                      ? Colors.greenAccent
                                      : Colors.redAccent),
                          ),
                        ),
                      ],
                    ),
                    Text(
                      money(balance.abs()),
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Ledger Title
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Text(
                  'TRANSACTION HISTORY',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: colorScheme.onSurfaceVariant,
                    letterSpacing: 0.8,
                  ),
                ),
              ],
            ),
          ),

          // Ledger List
          Expanded(
            child: ledgerEntries.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.history,
                          size: 40,
                          color: colorScheme.onSurfaceVariant.withOpacity(0.4),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'No transactions recorded',
                          style: TextStyle(color: colorScheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: ledgerEntries.length,
                    itemBuilder: (context, index) {
                      final entry = ledgerEntries[index];
                      final type = entry['type']?.toString() ?? 'Transaction';
                      final amount =
                          double.tryParse(entry['amount']?.toString() ?? '0') ??
                          0;
                      final date = entry['date']?.toString() ?? '';
                      final note = entry['note']?.toString() ?? '';
                      final direction = entry['direction']?.toString() ?? '';

                      Color entryColor = Colors.green;
                      IconData entryIcon = Icons.arrow_downward;

                      if (type.contains('Sale') ||
                          type.contains('Debit') ||
                          direction == 'Receivable') {
                        entryColor = Colors.green;
                        entryIcon = Icons.arrow_downward;
                      } else {
                        entryColor = Colors.red;
                        entryIcon = Icons.arrow_upward;
                      }

                      // Adjust colors/icons based on Nepali payment style
                      if (type == 'Payment Received') {
                        entryColor = Colors.green;
                        entryIcon = Icons.check_circle_outline;
                      } else if (type == 'Payment Paid') {
                        entryColor = Colors.red;
                        entryIcon = Icons.payment_outlined;
                      }

                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: isDark
                              ? const Color(0xFF161622)
                              : Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: colorScheme.outlineVariant.withOpacity(
                              isDark ? 0.08 : 0.35,
                            ),
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: entryColor.withOpacity(0.1),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                entryIcon,
                                color: entryColor,
                                size: 16,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    type,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    note.isNotEmpty
                                        ? note
                                        : 'No notes provided',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: colorScheme.onSurfaceVariant
                                          .withOpacity(0.8),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    shortDate(date),
                                    style: TextStyle(
                                      fontSize: 10,
                                      color: colorScheme.onSurfaceVariant
                                          .withOpacity(0.5),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              money(amount),
                              style: TextStyle(
                                fontWeight: FontWeight.w900,
                                color: entryColor,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),

          // Settle Payment Bottom Bar
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF101018) : Colors.white,
              border: Border(
                top: BorderSide(
                  color: colorScheme.outlineVariant.withOpacity(0.5),
                ),
              ),
            ),
            child: SafeArea(
              child: FilledButton.icon(
                onPressed: () => _showSettlementSheet(context),
                icon: const Icon(Icons.handshake_outlined),
                label: const Text('Record Settlement / Settle Payment'),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showSettlementSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _SettlePaymentSheet(
        partyId: widget.partyId,
        partyType: widget.partyType,
        partyName: widget.partyName,
      ),
    );
  }
}

class _SettlePaymentSheet extends ConsumerStatefulWidget {
  const _SettlePaymentSheet({
    required this.partyId,
    required this.partyType,
    required this.partyName,
  });

  final String partyId;
  final String partyType;
  final String partyName;

  @override
  ConsumerState<_SettlePaymentSheet> createState() =>
      _SettlePaymentSheetState();
}

class _SettlePaymentSheetState extends ConsumerState<_SettlePaymentSheet> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _noteController = TextEditingController();

  DateTime _selectedDate = DateTime.now();
  late String _settlementType;

  @override
  void initState() {
    super.initState();
    // Default settlement type
    _settlementType = widget.partyType.toLowerCase() == 'customer'
        ? 'Payment Received'
        : 'Payment Paid';
  }

  @override
  void dispose() {
    _amountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _selectDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    if (picked != null && picked != _selectedDate) {
      setState(() {
        _selectedDate = picked;
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final amount = double.tryParse(_amountController.text.trim()) ?? 0;
    if (amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter an amount greater than 0')),
      );
      return;
    }

    final isCustomer = widget.partyType.toLowerCase() == 'customer';
    final direction = isCustomer ? 'Receivable' : 'Payable';

    final body = {
      'partyId': widget.partyId,
      'direction': direction,
      'type': _settlementType,
      'amount': amount,
      'date': _selectedDate.toIso8601String().substring(0, 10),
      'note': _noteController.text.trim(),
    };

    try {
      await ref
          .read(appControllerProvider.notifier)
          .createRecord('party-ledger', body);
      if (mounted) {
        Navigator.of(context).pop(); // Close sheet
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Payment settlement recorded successfully'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error saving payment: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A26) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.fromLTRB(
        20,
        20,
        20,
        MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Record Payment',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: colorScheme.primary,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Settlement for ${widget.partyName}',
                style: TextStyle(
                  color: colorScheme.onSurfaceVariant,
                  fontSize: 13,
                ),
              ),
              const Divider(height: 24),

              // Settlement Type Selector
              Text(
                'Payment Type',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: SegmentedButton<String>(
                      segments: [
                        ButtonSegment<String>(
                          value: 'Payment Received',
                          label: const Text('Received'),
                          icon: widget.partyType.toLowerCase() == 'customer'
                              ? const Icon(Icons.call_received_rounded)
                              : null,
                        ),
                        ButtonSegment<String>(
                          value: 'Payment Paid',
                          label: const Text('Paid'),
                          icon: widget.partyType.toLowerCase() == 'supplier'
                              ? const Icon(Icons.call_made_rounded)
                              : null,
                        ),
                      ],
                      selected: {_settlementType},
                      onSelectionChanged: (val) {
                        setState(() {
                          _settlementType = val.first;
                        });
                      },
                      showSelectedIcon: false,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Amount Field
              TextFormField(
                controller: _amountController,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: const InputDecoration(
                  labelText: 'Amount (NPR)',
                  prefixIcon: Icon(Icons.money),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty)
                    return 'Amount is required';
                  if (double.tryParse(val) == null)
                    return 'Enter a valid number';
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Date Picker Field
              GestureDetector(
                onTap: () => _selectDate(context),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 16,
                  ),
                  decoration: BoxDecoration(
                    color: isDark
                        ? const Color(0xFF111118)
                        : Colors.grey.withOpacity(0.05),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: colorScheme.outlineVariant.withOpacity(0.5),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.calendar_today_outlined,
                        size: 20,
                        color: colorScheme.primary,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Payment Date',
                              style: TextStyle(
                                fontSize: 10,
                                color: colorScheme.onSurfaceVariant.withOpacity(
                                  0.7,
                                ),
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _selectedDate.toIso8601String().substring(0, 10),
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Icon(
                        Icons.chevron_right_rounded,
                        color: colorScheme.onSurfaceVariant.withOpacity(0.6),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Note Field
              TextFormField(
                controller: _noteController,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Note / Remarks',
                  prefixIcon: Icon(Icons.notes),
                ),
              ),
              const SizedBox(height: 24),

              // Action Buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: _submit,
                      child: const Text('Save Settlement'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
