import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/state/app_controller.dart';
import '../models/rhino_models.dart';

Future<void> showMobileRecordEditor(
  BuildContext context,
  WidgetRef ref, {
  required String entity,
  required String title,
  Map<String, dynamic>? initial,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) =>
        _RecordEditorSheet(entity: entity, title: title, initial: initial),
  );
}

bool canCreateMobileRecord(String entity) {
  return _recordFields(entity, null, editing: false).isNotEmpty;
}

bool canEditMobileRecord(String entity) {
  return _recordFields(entity, null, editing: true).isNotEmpty;
}

class _RecordEditorSheet extends ConsumerStatefulWidget {
  const _RecordEditorSheet({
    required this.entity,
    required this.title,
    this.initial,
  });

  final String entity;
  final String title;
  final Map<String, dynamic>? initial;

  bool get editing => initial != null;

  @override
  ConsumerState<_RecordEditorSheet> createState() => _RecordEditorSheetState();
}

class _RecordEditorSheetState extends ConsumerState<_RecordEditorSheet> {
  final _formKey = GlobalKey<FormState>();
  final _controllers = <String, TextEditingController>{};
  final _selectValues = <String, String>{};

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final fields = _fields();
    final payload = <String, dynamic>{};
    for (final field in fields) {
      if (field.kind == _FieldKind.select) {
        payload[field.key] =
            _selectValues[field.key] ??
            _selectedOption(field, _controllers[field.key]?.text);
      } else {
        final raw = _controllers[field.key]?.text.trim() ?? '';
        payload[field.key] = field.kind == _FieldKind.number ? _num(raw) : raw;
      }
    }
    payload.removeWhere(
      (key, value) =>
          key != 'amount' && value is String && value.trim().isEmpty,
    );
    final enriched = _enrichPayload(
      widget.entity,
      payload,
      ref.read(appControllerProvider).bootstrap,
    );

    final notifier = ref.read(appControllerProvider.notifier);
    if (widget.editing) {
      await notifier.updateRecord(
        widget.entity,
        widget.initial!['id'].toString(),
        enriched,
      );
    } else {
      await notifier.createRecord(widget.entity, {
        ..._defaultPayload(widget.entity),
        ...enriched,
      });
    }
    if (mounted) Navigator.of(context).pop();
  }

  List<_FieldSpec> _fields() {
    return _recordFields(
      widget.entity,
      ref.read(appControllerProvider).bootstrap,
      editing: widget.editing,
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appControllerProvider);
    final fields = _fields();
    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 18,
          bottom: MediaQuery.of(context).viewInsets.bottom + 22,
        ),
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 42,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 18),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.outlineVariant,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
                Text(
                  widget.editing
                      ? 'Edit ${widget.title}'
                      : 'Add ${widget.title}',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Use simple fields for daily shop work. You can add more detail later.',
                  style: TextStyle(color: theme.colorScheme.onSurfaceVariant),
                ),
                const SizedBox(height: 18),
                for (final field in fields) ...[
                  _FieldInput(
                    field: field,
                    controller: _controllerFor(field),
                    value: _selectValues[field.key],
                    onSelect: (value) => setState(
                      () => _selectValues[field.key] =
                          value ?? field.options.first,
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: state.loading ? null : _save,
                    icon: state.loading
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.check_rounded),
                    label: Text(widget.editing ? 'Save changes' : 'Create'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  TextEditingController _controllerFor(_FieldSpec field) {
    return _controllers.putIfAbsent(field.key, () {
      final raw = widget.initial?[field.key] ?? field.defaultValue ?? '';
      return TextEditingController(text: raw.toString());
    });
  }
}

class _FieldInput extends StatelessWidget {
  const _FieldInput({
    required this.field,
    required this.controller,
    required this.onSelect,
    this.value,
  });

  final _FieldSpec field;
  final TextEditingController controller;
  final String? value;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) {
    if (field.kind == _FieldKind.select) {
      final selected = value ?? _selectedOption(field, controller.text);
      return DropdownButtonFormField<String>(
        initialValue: selected,
        items: [
          for (final option in field.options)
            DropdownMenuItem(value: option, child: Text(option)),
        ],
        onChanged: onSelect,
        decoration: InputDecoration(
          labelText: field.label,
          prefixIcon: Icon(field.icon),
        ),
      );
    }

    return TextFormField(
      controller: controller,
      maxLines: field.kind == _FieldKind.longText ? 3 : 1,
      keyboardType: field.kind == _FieldKind.number
          ? const TextInputType.numberWithOptions(decimal: true)
          : TextInputType.text,
      inputFormatters: field.kind == _FieldKind.number
          ? [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))]
          : null,
      validator: field.required
          ? (value) => value == null || value.trim().isEmpty ? 'Required' : null
          : null,
      decoration: InputDecoration(
        labelText: field.label,
        prefixIcon: Icon(field.icon),
      ),
    );
  }
}

class _FieldSpec {
  const _FieldSpec(
    this.key,
    this.label,
    this.icon, {
    this.kind = _FieldKind.text,
    this.required = false,
    this.options = const [],
    this.defaultValue,
  });

  final String key;
  final String label;
  final IconData icon;
  final _FieldKind kind;
  final bool required;
  final List<String> options;
  final Object? defaultValue;
}

enum _FieldKind { text, longText, number, select }

String _selectedOption(_FieldSpec field, String? current) {
  final value = current?.trim();
  if (value != null && field.options.contains(value)) return value;
  return field.defaultValue?.toString() ?? field.options.first;
}

List<_FieldSpec> _recordFields(
  String entity,
  BootstrapData? bootstrap, {
  required bool editing,
}) {
  final today = DateTime.now().toIso8601String().substring(0, 10);
  final customerOptions = _names(bootstrap?.customers, 'name');
  final supplierOptions = _names(bootstrap?.suppliers, 'name');
  final partyOptions = _names(bootstrap?.parties, 'name');
  final accountOptions = _names(bootstrap?.cashBankAccounts, 'name');
  final productOptions =
      bootstrap?.products.map((item) => item.name).toList() ?? const <String>[];

  switch (entity) {
    case 'sales':
      return editing
          ? [
              const _FieldSpec(
                'customer',
                'Customer',
                Icons.person_outline,
                required: true,
              ),
              const _FieldSpec(
                'payment',
                'Payment',
                Icons.wallet_outlined,
                kind: _FieldKind.select,
                options: ['Cash', 'Credit', 'Online'],
                defaultValue: 'Cash',
              ),
              const _FieldSpec(
                'status',
                'Status',
                Icons.verified_outlined,
                kind: _FieldKind.select,
                options: ['Completed', 'Pending', 'Refunded'],
                defaultValue: 'Completed',
              ),
              _FieldSpec(
                'date',
                'Date',
                Icons.calendar_today_outlined,
                defaultValue: today,
              ),
              const _FieldSpec(
                'notes',
                'Notes',
                Icons.note_outlined,
                kind: _FieldKind.longText,
              ),
            ]
          : const [];
    case 'customers':
      return const [
        _FieldSpec(
          'name',
          'Customer name',
          Icons.person_outline,
          required: true,
        ),
        _FieldSpec('phone', 'Phone number', Icons.phone_outlined),
        _FieldSpec('email', 'Email', Icons.mail_outline),
        _FieldSpec('address', 'Address', Icons.location_on_outlined),
        _FieldSpec('company', 'Shop / company', Icons.store_outlined),
        _FieldSpec('taxId', 'PAN / VAT no.', Icons.badge_outlined),
        _FieldSpec(
          'creditLimit',
          'Credit limit',
          Icons.credit_score_outlined,
          kind: _FieldKind.number,
        ),
        _FieldSpec(
          'balance',
          'Opening balance',
          Icons.account_balance_wallet_outlined,
          kind: _FieldKind.number,
        ),
      ];
    case 'suppliers':
      return const [
        _FieldSpec(
          'name',
          'Supplier name',
          Icons.local_shipping_outlined,
          required: true,
        ),
        _FieldSpec('phone', 'Phone number', Icons.phone_outlined),
        _FieldSpec('email', 'Email', Icons.mail_outline),
        _FieldSpec('address', 'Address', Icons.location_on_outlined),
        _FieldSpec('pan', 'PAN / VAT no.', Icons.badge_outlined),
        _FieldSpec(
          'contactPerson',
          'Contact person',
          Icons.person_pin_outlined,
        ),
        _FieldSpec(
          'payableBalance',
          'Opening payable',
          Icons.payments_outlined,
          kind: _FieldKind.number,
        ),
        _FieldSpec(
          'notes',
          'Notes',
          Icons.note_outlined,
          kind: _FieldKind.longText,
        ),
      ];
    case 'parties':
      return const [
        _FieldSpec(
          'name',
          'Party name',
          Icons.groups_2_outlined,
          required: true,
        ),
        _FieldSpec(
          'type',
          'Party type',
          Icons.swap_horiz_outlined,
          kind: _FieldKind.select,
          options: ['Customer', 'Supplier'],
          defaultValue: 'Customer',
        ),
        _FieldSpec('phone', 'Phone number', Icons.phone_outlined),
        _FieldSpec('address', 'Address', Icons.location_on_outlined),
        _FieldSpec('pan', 'PAN / VAT no.', Icons.badge_outlined),
        _FieldSpec(
          'openingBalance',
          'Opening balance',
          Icons.account_balance_wallet_outlined,
          kind: _FieldKind.number,
        ),
        _FieldSpec(
          'creditLimit',
          'Credit limit',
          Icons.credit_score_outlined,
          kind: _FieldKind.number,
        ),
        _FieldSpec(
          'dueDays',
          'Due days',
          Icons.event_outlined,
          kind: _FieldKind.number,
        ),
        _FieldSpec(
          'notes',
          'Notes',
          Icons.note_outlined,
          kind: _FieldKind.longText,
        ),
      ];
    case 'credit-ledger':
      return [
        _FieldSpec(
          'customerName',
          'Customer',
          Icons.person_outline,
          kind: customerOptions.isEmpty ? _FieldKind.text : _FieldKind.select,
          options: customerOptions.isEmpty ? const [] : customerOptions,
          required: true,
        ),
        const _FieldSpec(
          'type',
          'Entry type',
          Icons.receipt_long_outlined,
          kind: _FieldKind.select,
          options: ['Credit Sale', 'Payment Received'],
          defaultValue: 'Credit Sale',
        ),
        const _FieldSpec(
          'amount',
          'Amount',
          Icons.payments_outlined,
          kind: _FieldKind.number,
          required: true,
        ),
        _FieldSpec(
          'date',
          'Date',
          Icons.calendar_today_outlined,
          defaultValue: today,
        ),
        _FieldSpec(
          'dueDate',
          'Due date',
          Icons.event_outlined,
          defaultValue: today,
        ),
        const _FieldSpec(
          'note',
          'Note',
          Icons.note_outlined,
          kind: _FieldKind.longText,
        ),
      ];
    case 'purchases':
      return [
        _FieldSpec(
          'supplierName',
          'Supplier',
          Icons.local_shipping_outlined,
          kind: supplierOptions.isEmpty ? _FieldKind.text : _FieldKind.select,
          options: supplierOptions.isEmpty ? const [] : supplierOptions,
          required: true,
        ),
        const _FieldSpec('billNo', 'Supplier bill no.', Icons.receipt_outlined),
        _FieldSpec(
          'date',
          'Date',
          Icons.calendar_today_outlined,
          defaultValue: today,
        ),
        const _FieldSpec(
          'amount',
          'Total amount',
          Icons.payments_outlined,
          kind: _FieldKind.number,
          required: true,
        ),
        const _FieldSpec(
          'payment',
          'Payment',
          Icons.wallet_outlined,
          kind: _FieldKind.select,
          options: ['Cash', 'Credit', 'Online'],
          defaultValue: 'Cash',
        ),
        const _FieldSpec(
          'status',
          'Status',
          Icons.verified_outlined,
          kind: _FieldKind.select,
          options: ['Draft', 'Ordered', 'Received'],
          defaultValue: 'Received',
        ),
        const _FieldSpec(
          'notes',
          'Notes',
          Icons.note_outlined,
          kind: _FieldKind.longText,
        ),
      ];
    case 'expenses':
      return [
        _FieldSpec(
          'category',
          'Category',
          Icons.category_outlined,
          kind: (bootstrap?.expenseCategories.isNotEmpty ?? false)
              ? _FieldKind.select
              : _FieldKind.text,
          options: bootstrap?.expenseCategories ?? const [],
          required: true,
        ),
        const _FieldSpec('vendor', 'Paid to', Icons.store_outlined),
        const _FieldSpec(
          'amount',
          'Amount',
          Icons.payments_outlined,
          kind: _FieldKind.number,
          required: true,
        ),
        const _FieldSpec(
          'taxAmount',
          'VAT amount',
          Icons.percent_outlined,
          kind: _FieldKind.number,
        ),
        const _FieldSpec(
          'paymentMethod',
          'Payment method',
          Icons.wallet_outlined,
          kind: _FieldKind.select,
          options: ['Cash', 'Bank', 'Wallet', 'Credit'],
          defaultValue: 'Cash',
        ),
        _FieldSpec(
          'date',
          'Date',
          Icons.calendar_today_outlined,
          defaultValue: today,
        ),
        const _FieldSpec(
          'note',
          'Note',
          Icons.note_outlined,
          kind: _FieldKind.longText,
        ),
      ];
    case 'cash-bank-accounts':
      return const [
        _FieldSpec(
          'name',
          'Account name',
          Icons.account_balance_outlined,
          required: true,
        ),
        _FieldSpec(
          'type',
          'Type',
          Icons.account_balance_wallet_outlined,
          kind: _FieldKind.select,
          options: ['Cash', 'Bank', 'Wallet'],
          defaultValue: 'Cash',
        ),
        _FieldSpec('institution', 'Bank / counter', Icons.store_outlined),
        _FieldSpec('accountNumber', 'Account number', Icons.numbers_outlined),
        _FieldSpec(
          'openingBalance',
          'Opening balance',
          Icons.payments_outlined,
          kind: _FieldKind.number,
        ),
        _FieldSpec(
          'balance',
          'Current balance',
          Icons.account_balance_wallet_outlined,
          kind: _FieldKind.number,
        ),
      ];
    case 'money-movements':
      return [
        _FieldSpec(
          'accountName',
          'Account',
          Icons.account_balance_wallet_outlined,
          kind: accountOptions.isEmpty ? _FieldKind.text : _FieldKind.select,
          options: accountOptions.isEmpty ? const [] : accountOptions,
          required: true,
        ),
        const _FieldSpec(
          'type',
          'Type',
          Icons.swap_vert_outlined,
          kind: _FieldKind.select,
          options: ['Receipt', 'Payment', 'Transfer'],
          defaultValue: 'Receipt',
        ),
        const _FieldSpec(
          'amount',
          'Amount',
          Icons.payments_outlined,
          kind: _FieldKind.number,
          required: true,
        ),
        _FieldSpec(
          'date',
          'Date',
          Icons.calendar_today_outlined,
          defaultValue: today,
        ),
        _FieldSpec(
          'partyName',
          'Party',
          Icons.groups_2_outlined,
          kind: partyOptions.isEmpty ? _FieldKind.text : _FieldKind.select,
          options: partyOptions.isEmpty ? const [] : partyOptions,
        ),
        const _FieldSpec(
          'note',
          'Note',
          Icons.note_outlined,
          kind: _FieldKind.longText,
        ),
      ];
    case 'documents':
      return const [
        _FieldSpec(
          'name',
          'Document name',
          Icons.description_outlined,
          required: true,
        ),
        _FieldSpec(
          'recordType',
          'Linked module',
          Icons.link_outlined,
          kind: _FieldKind.select,
          options: ['sales', 'purchases', 'expenses', 'customers', 'inventory'],
          defaultValue: 'sales',
        ),
        _FieldSpec('fileName', 'File name', Icons.attach_file_outlined),
        _FieldSpec(
          'mimeType',
          'File type',
          Icons.file_copy_outlined,
          defaultValue: 'text/html',
        ),
      ];
    case 'reminder-templates':
      return const [
        _FieldSpec(
          'name',
          'Template name',
          Icons.notifications_active_outlined,
          required: true,
        ),
        _FieldSpec(
          'channel',
          'Channel',
          Icons.sms_outlined,
          kind: _FieldKind.select,
          options: ['SMS', 'Email', 'WhatsApp'],
          defaultValue: 'SMS',
        ),
        _FieldSpec(
          'language',
          'Language',
          Icons.translate_outlined,
          kind: _FieldKind.select,
          options: ['en', 'ne'],
          defaultValue: 'ne',
        ),
        _FieldSpec(
          'message',
          'Message',
          Icons.message_outlined,
          kind: _FieldKind.longText,
          required: true,
        ),
        _FieldSpec(
          'daysOffset',
          'Days before/after due date',
          Icons.event_outlined,
          kind: _FieldKind.number,
        ),
      ];
    case 'reminders':
      return [
        _FieldSpec(
          'partyName',
          'Party',
          Icons.groups_2_outlined,
          kind: partyOptions.isEmpty ? _FieldKind.text : _FieldKind.select,
          options: partyOptions.isEmpty ? const [] : partyOptions,
          required: true,
        ),
        const _FieldSpec(
          'channel',
          'Channel',
          Icons.sms_outlined,
          kind: _FieldKind.select,
          options: ['SMS', 'Email', 'WhatsApp'],
          defaultValue: 'SMS',
        ),
        const _FieldSpec(
          'message',
          'Message',
          Icons.message_outlined,
          kind: _FieldKind.longText,
          required: true,
        ),
        const _FieldSpec(
          'amount',
          'Amount due',
          Icons.payments_outlined,
          kind: _FieldKind.number,
        ),
        _FieldSpec(
          'dueDate',
          'Due date',
          Icons.event_outlined,
          defaultValue: today,
        ),
        const _FieldSpec(
          'status',
          'Status',
          Icons.verified_outlined,
          kind: _FieldKind.select,
          options: ['Draft', 'Sent', 'Failed'],
          defaultValue: 'Draft',
        ),
      ];
    case 'reports':
      return const [
        _FieldSpec(
          'title',
          'Report title',
          Icons.bar_chart_outlined,
          required: true,
        ),
        _FieldSpec(
          'type',
          'Type',
          Icons.category_outlined,
          kind: _FieldKind.select,
          options: ['Sales', 'Stock', 'Tax', 'Profit', 'Credit'],
          defaultValue: 'Sales',
        ),
        _FieldSpec(
          'range',
          'Date range',
          Icons.date_range_outlined,
          kind: _FieldKind.select,
          options: ['Today', 'This week', 'This month', 'Custom'],
          defaultValue: 'This month',
        ),
        _FieldSpec(
          'format',
          'Format',
          Icons.file_download_outlined,
          kind: _FieldKind.select,
          options: ['PDF'],
          defaultValue: 'PDF',
        ),
        _FieldSpec(
          'status',
          'Status',
          Icons.verified_outlined,
          kind: _FieldKind.select,
          options: ['Ready', 'Scheduled'],
          defaultValue: 'Ready',
        ),
      ];
    case 'roles':
      return const [
        _FieldSpec(
          'name',
          'Role name',
          Icons.admin_panel_settings_outlined,
          required: true,
        ),
        _FieldSpec(
          'description',
          'Description',
          Icons.notes_outlined,
          kind: _FieldKind.longText,
        ),
      ];
    case 'inventory':
      return [
        const _FieldSpec(
          'name',
          'Product name',
          Icons.shopping_bag_outlined,
          required: true,
        ),
        _FieldSpec(
          'category',
          'Category',
          Icons.category_outlined,
          kind: (bootstrap?.inventoryCategories.isNotEmpty ?? false)
              ? _FieldKind.select
              : _FieldKind.text,
          options: bootstrap?.inventoryCategories ?? const [],
          required: true,
        ),
        const _FieldSpec(
          'unit',
          'Unit',
          Icons.straighten_outlined,
          kind: _FieldKind.select,
          options: ['pcs', 'kg', 'liter', 'meter', 'box', 'service'],
          defaultValue: 'pcs',
        ),
        const _FieldSpec(
          'stock',
          'Stock',
          Icons.layers_outlined,
          kind: _FieldKind.number,
        ),
        const _FieldSpec(
          'reorderLevel',
          'Reorder level',
          Icons.warning_amber_outlined,
          kind: _FieldKind.number,
        ),
        const _FieldSpec(
          'price',
          'Selling price',
          Icons.sell_outlined,
          kind: _FieldKind.number,
        ),
        const _FieldSpec(
          'costPrice',
          'Cost price',
          Icons.price_check_outlined,
          kind: _FieldKind.number,
        ),
        _FieldSpec(
          'supplier',
          'Supplier',
          Icons.local_shipping_outlined,
          kind: supplierOptions.isEmpty ? _FieldKind.text : _FieldKind.select,
          options: supplierOptions.isEmpty ? const [] : supplierOptions,
        ),
      ];
    case 'inventory-movements':
      return [
        _FieldSpec(
          'productName',
          'Product',
          Icons.inventory_2_outlined,
          kind: productOptions.isEmpty ? _FieldKind.text : _FieldKind.select,
          options: productOptions.isEmpty ? const [] : productOptions,
        ),
        const _FieldSpec(
          'delta',
          'Quantity change',
          Icons.add_chart_outlined,
          kind: _FieldKind.number,
          required: true,
        ),
        const _FieldSpec(
          'reason',
          'Reason',
          Icons.info_outline,
          kind: _FieldKind.select,
          options: ['Stock In', 'Stock Out', 'Correction', 'Purchase'],
          defaultValue: 'Stock In',
        ),
        const _FieldSpec(
          'note',
          'Note',
          Icons.note_outlined,
          kind: _FieldKind.longText,
        ),
      ];
    default:
      return const [];
  }
}

Map<String, dynamic> _defaultPayload(String entity) {
  final now = DateTime.now().toIso8601String();
  final today = now.substring(0, 10);
  switch (entity) {
    case 'purchases':
      return {
        'date': today,
        'payment': 'Cash',
        'status': 'Received',
        'items': [],
      };
    case 'expenses':
      return {'date': today, 'paymentMethod': 'Cash', 'attachmentIds': []};
    case 'documents':
      return {'createdAt': now, 'size': 0, 'dataUrl': ''};
    case 'reports':
      return {
        'createdAt': now,
        'template': 'Executive',
        'downloadUrl': '',
        'scheduledAt': '',
      };
    case 'reminder-templates':
      return {'active': true};
    case 'reminders':
      return {'createdAt': now};
    case 'credit-ledger':
      return {'date': today, 'paymentMethod': 'Credit'};
    case 'inventory-movements':
      return {'createdAt': now, 'reason': 'Stock In'};
    case 'roles':
      return {
        'permissions': ['dashboard.view'],
      };
    default:
      return {'createdAt': now};
  }
}

List<String> _names(List<Map<String, dynamic>>? rows, String key) {
  final values = <String>{
    for (final row in rows ?? const <Map<String, dynamic>>[])
      if ((row[key]?.toString().trim() ?? '').isNotEmpty)
        row[key].toString().trim(),
  }.toList()..sort();
  return values;
}

num _num(String value) => num.tryParse(value.trim()) ?? 0;

Map<String, dynamic> _enrichPayload(
  String entity,
  Map<String, dynamic> payload,
  BootstrapData? bootstrap,
) {
  final next = Map<String, dynamic>.from(payload);
  if (bootstrap == null) return next;

  final customerName = next['customerName']?.toString();
  if (customerName != null && customerName.isNotEmpty) {
    final customer = _findByName(bootstrap.customers, customerName);
    if (customer != null) next['customerId'] = customer['id'];
  }

  final supplierName = next['supplierName']?.toString();
  if (supplierName != null && supplierName.isNotEmpty) {
    final supplier = _findByName(bootstrap.suppliers, supplierName);
    if (supplier != null) next['supplierId'] = supplier['id'];
  }

  final partyName = next['partyName']?.toString();
  if (partyName != null && partyName.isNotEmpty) {
    final party = _findByName(bootstrap.parties, partyName);
    if (party != null) next['partyId'] = party['id'];
  }

  final accountName = next['accountName']?.toString();
  if (accountName != null && accountName.isNotEmpty) {
    final account = _findByName(bootstrap.cashBankAccounts, accountName);
    if (account != null) next['accountId'] = account['id'];
  }

  final productName = next['productName']?.toString();
  if (productName != null && productName.isNotEmpty) {
    for (final product in bootstrap.products) {
      if (product.name == productName) {
        next['productId'] = product.id;
        next['unit'] = product.unit;
        break;
      }
    }
  }

  if (entity == 'inventory-movements' && next['reason'] == 'Stock Out') {
    next['delta'] = -_num(next['delta'].toString()).abs();
  }

  return next;
}

Map<String, dynamic>? _findByName(
  List<Map<String, dynamic>> rows,
  String name,
) {
  for (final row in rows) {
    if (row['name']?.toString() == name) return row;
  }
  return null;
}
