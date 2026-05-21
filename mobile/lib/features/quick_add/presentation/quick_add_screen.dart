import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/state/app_controller.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/rhino_models.dart';
import '../../../shared/widgets/rp_widgets.dart';

class QuickAddScreen extends ConsumerStatefulWidget {
  const QuickAddScreen({super.key});

  @override
  ConsumerState<QuickAddScreen> createState() => _QuickAddScreenState();
}

class _QuickAddScreenState extends ConsumerState<QuickAddScreen> {
  int _mode = 0;

  @override
  Widget build(BuildContext context) {
    final labels = [
      tr(ref, 'addSale'),
      tr(ref, 'addExpense'),
      tr(ref, 'addStock')
    ];
    return RpPage(
      title: tr(ref, 'quickAdd'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SegmentedButton<int>(
            segments: [
              for (var i = 0; i < labels.length; i++)
                ButtonSegment<int>(
                  value: i,
                  label: Text(labels[i]),
                  icon: Icon([
                    Icons.point_of_sale_outlined,
                    Icons.wallet_outlined,
                    Icons.inventory_outlined
                  ][i]),
                ),
            ],
            selected: {_mode},
            onSelectionChanged: (selection) =>
                setState(() => _mode = selection.first),
            showSelectedIcon: false,
          ),
          const SizedBox(height: 16),
          if (_mode == 0) const _SaleForm(),
          if (_mode == 1) const _ExpenseForm(),
          if (_mode == 2) const _StockMovementForm(),
        ],
      ),
    );
  }
}

class _SaleForm extends ConsumerStatefulWidget {
  const _SaleForm();

  @override
  ConsumerState<_SaleForm> createState() => _SaleFormState();
}

class _SaleFormState extends ConsumerState<_SaleForm> {
  final _formKey = GlobalKey<FormState>();
  final _customer = TextEditingController(text: 'Walk-in customer');
  final _quantity = TextEditingController(text: '1');
  String? _productId;
  String _payment = 'Cash';

  @override
  void dispose() {
    _customer.dispose();
    _quantity.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final bootstrap = ref.read(appControllerProvider).bootstrap;
    final product =
        _selectedProduct(bootstrap?.products ?? const [], _productId);
    if (bootstrap == null || product == null) return;
    final qty = _num(_quantity.text);
    final tax = (qty * product.price) * (bootstrap.settings.taxRate / 100);
    final now = DateTime.now().toIso8601String();
    await ref.read(appControllerProvider.notifier).createSale({
      'id': 'sale-${DateTime.now().millisecondsSinceEpoch}',
      'invoiceNo':
          '${bootstrap.settings.invoicePrefix}-${DateTime.now().millisecondsSinceEpoch}',
      'customer': _customer.text.trim().isEmpty
          ? 'Walk-in customer'
          : _customer.text.trim(),
      'payment': _payment,
      'status': 'Completed',
      'date': now.substring(0, 10),
      'creditDueDate': _payment == 'Credit' ? now.substring(0, 10) : '',
      'notes': 'Mobile quick sale',
      'items': [
        {
          'productId': product.id,
          'productName': product.name,
          'quantity': qty,
          'unit': product.unit,
          'unitPrice': product.price,
          'costPrice': product.costPrice,
          'discount': 0,
          'tax': tax,
        }
      ],
    });
    _quantity.text = '1';
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appControllerProvider);
    final products = state.bootstrap?.products ?? const <Product>[];
    _productId ??= products.isNotEmpty ? products.first.id : null;
    final product = _selectedProduct(products, _productId);
    final qty = _num(_quantity.text);
    final total = product == null
        ? 0
        : qty *
            product.price *
            (1 + ((state.bootstrap?.settings.taxRate ?? 13) / 100));

    return RpCard(
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(tr(ref, 'easySaleHelp'),
                style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant)),
            const SizedBox(height: 14),
            _TextField(
                controller: _customer,
                label: tr(ref, 'customerName'),
                icon: Icons.person_outline,
                requiredField: false),
            const SizedBox(height: 12),
            if (products.isEmpty)
              Text(tr(ref, 'emptyStock'))
            else
              DropdownButtonFormField<String>(
                initialValue: _productId,
                items: [
                  for (final item in products)
                    DropdownMenuItem(
                      value: item.id,
                      child: Text(
                          '${item.name} - ${quantity(item.stock, item.unit)}'),
                    ),
                ],
                onChanged: (value) => setState(() => _productId = value),
                decoration: InputDecoration(
                    labelText: tr(ref, 'product'),
                    prefixIcon: const Icon(Icons.shopping_bag_outlined)),
              ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                    child: _NumberField(
                        controller: _quantity,
                        label: tr(ref, 'quantity'),
                        onChanged: (_) => setState(() {}))),
                const SizedBox(width: 10),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _payment,
                    items: [
                      DropdownMenuItem(
                          value: 'Cash', child: Text(tr(ref, 'cash'))),
                      DropdownMenuItem(
                          value: 'Credit', child: Text(tr(ref, 'credit'))),
                      DropdownMenuItem(
                          value: 'Online', child: Text(tr(ref, 'online'))),
                    ],
                    onChanged: (value) =>
                        setState(() => _payment = value ?? 'Cash'),
                    decoration: InputDecoration(labelText: tr(ref, 'payment')),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            _TotalRow(label: tr(ref, 'total'), value: money(total)),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: state.loading || products.isEmpty ? null : _save,
              child: Text(tr(ref, 'save')),
            ),
          ],
        ),
      ),
    );
  }
}

class _ExpenseForm extends ConsumerStatefulWidget {
  const _ExpenseForm();

  @override
  ConsumerState<_ExpenseForm> createState() => _ExpenseFormState();
}

class _ExpenseFormState extends ConsumerState<_ExpenseForm> {
  final _formKey = GlobalKey<FormState>();
  final _vendor = TextEditingController();
  final _amount = TextEditingController(text: '0');
  final _tax = TextEditingController(text: '0');
  String _category = 'Marketing';

  @override
  void dispose() {
    _vendor.dispose();
    _amount.dispose();
    _tax.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    await ref.read(appControllerProvider.notifier).createExpense({
      'id': 'exp-${DateTime.now().millisecondsSinceEpoch}',
      'category': _category,
      'vendor': _vendor.text.trim(),
      'amount': _num(_amount.text),
      'taxAmount': _num(_tax.text),
      'paymentMethod': 'Cash',
      'date': DateTime.now().toIso8601String().substring(0, 10),
      'recurring': false,
      'note': 'Mobile quick expense',
      'attachmentIds': [],
    });
    _vendor.clear();
    _amount.text = '0';
    _tax.text = '0';
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appControllerProvider);
    return RpCard(
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DropdownButtonFormField<String>(
              initialValue: _category,
              items: [
                DropdownMenuItem(
                    value: 'Marketing', child: Text(tr(ref, 'marketing'))),
                DropdownMenuItem(value: 'Rent', child: Text(tr(ref, 'rent'))),
                DropdownMenuItem(
                    value: 'Salary', child: Text(tr(ref, 'salary'))),
                DropdownMenuItem(
                    value: 'Transport', child: Text(tr(ref, 'transport'))),
                DropdownMenuItem(
                    value: 'Repair', child: Text(tr(ref, 'repair'))),
                DropdownMenuItem(
                    value: 'Utilities', child: Text(tr(ref, 'utilities'))),
              ],
              onChanged: (value) =>
                  setState(() => _category = value ?? 'Marketing'),
              decoration: InputDecoration(
                  labelText: tr(ref, 'expenseCategory'),
                  prefixIcon: const Icon(Icons.category_outlined)),
            ),
            const SizedBox(height: 12),
            _TextField(
                controller: _vendor,
                label: tr(ref, 'vendor'),
                icon: Icons.store_outlined),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                    child: _NumberField(
                        controller: _amount, label: tr(ref, 'amount'))),
                const SizedBox(width: 10),
                Expanded(
                    child:
                        _NumberField(controller: _tax, label: tr(ref, 'tax'))),
              ],
            ),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: state.loading ? null : _save,
              child: Text(tr(ref, 'save')),
            ),
          ],
        ),
      ),
    );
  }
}

class _StockMovementForm extends ConsumerStatefulWidget {
  const _StockMovementForm();

  @override
  ConsumerState<_StockMovementForm> createState() => _StockMovementFormState();
}

class _StockMovementFormState extends ConsumerState<_StockMovementForm> {
  final _delta = TextEditingController(text: '1');
  final _note = TextEditingController();
  String? _productId;
  String _reason = 'Stock In';

  @override
  void dispose() {
    _delta.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final productId = _productId;
    if (productId == null) return;
    final sign = _reason == 'Stock Out' ? -1 : 1;
    await ref.read(appControllerProvider.notifier).recordStockMovement({
      'id': 'mov-${DateTime.now().millisecondsSinceEpoch}',
      'productId': productId,
      'delta': _num(_delta.text) * sign,
      'reason': _reason,
      'note': _note.text.trim(),
    });
    _delta.text = '1';
    _note.clear();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appControllerProvider);
    final products = state.bootstrap?.products ?? const <Product>[];
    _productId ??= products.isNotEmpty ? products.first.id : null;

    return RpCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (products.isEmpty)
            Text(tr(ref, 'emptyStock'))
          else
            DropdownButtonFormField<String>(
              initialValue: _productId,
              items: [
                for (final item in products)
                  DropdownMenuItem(
                      value: item.id,
                      child: Text(
                          '${item.name} - ${quantity(item.stock, item.unit)}')),
              ],
              onChanged: (value) => setState(() => _productId = value),
              decoration: InputDecoration(
                  labelText: tr(ref, 'product'),
                  prefixIcon: const Icon(Icons.inventory_2_outlined)),
            ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                  child: _NumberField(
                      controller: _delta, label: tr(ref, 'quantity'))),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _reason,
                  items: [
                    DropdownMenuItem(
                        value: 'Stock In', child: Text(tr(ref, 'stockIn'))),
                    DropdownMenuItem(
                        value: 'Stock Out', child: Text(tr(ref, 'stockOut'))),
                    DropdownMenuItem(
                        value: 'Correction',
                        child: Text(tr(ref, 'correction'))),
                  ],
                  onChanged: (value) =>
                      setState(() => _reason = value ?? 'Stock In'),
                  decoration: InputDecoration(labelText: tr(ref, 'reason')),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _TextField(
              controller: _note,
              label: tr(ref, 'note'),
              icon: Icons.note_alt_outlined,
              requiredField: false),
          const SizedBox(height: 14),
          FilledButton(
            onPressed: state.loading || products.isEmpty ? null : _save,
            child: Text(tr(ref, 'save')),
          ),
        ],
      ),
    );
  }
}

class _TextField extends ConsumerWidget {
  const _TextField({
    required this.controller,
    required this.label,
    required this.icon,
    this.requiredField = true,
  });

  final TextEditingController controller;
  final String label;
  final IconData icon;
  final bool requiredField;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return TextFormField(
      controller: controller,
      validator: requiredField
          ? (value) =>
              value == null || value.trim().isEmpty ? tr(ref, 'required') : null
          : null,
      decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon)),
    );
  }
}

class _NumberField extends ConsumerWidget {
  const _NumberField(
      {required this.controller, required this.label, this.onChanged});

  final TextEditingController controller;
  final String label;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return TextFormField(
      controller: controller,
      onChanged: onChanged,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
      validator: (value) =>
          value == null || value.trim().isEmpty ? tr(ref, 'required') : null,
      decoration: InputDecoration(labelText: label),
    );
  }
}

class _TotalRow extends StatelessWidget {
  const _TotalRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        color: colorScheme.primary.withValues(alpha: isDark ? 0.12 : 0.06),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: colorScheme.primary.withValues(alpha: isDark ? 0.25 : 0.15),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15),
          ),
          const Spacer(),
          Text(
            value,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: colorScheme.primary,
                  letterSpacing: -0.5,
                ),
          ),
        ],
      ),
    );
  }
}

Product? _selectedProduct(List<Product> products, String? id) {
  for (final product in products) {
    if (product.id == id) return product;
  }
  return products.isEmpty ? null : products.first;
}

num _num(String value) => num.tryParse(value.trim()) ?? 0;
