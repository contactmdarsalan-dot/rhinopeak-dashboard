import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/state/app_controller.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/rp_widgets.dart';

class ScanBillScreen extends ConsumerStatefulWidget {
  const ScanBillScreen({super.key});

  @override
  ConsumerState<ScanBillScreen> createState() => _ScanBillScreenState();
}

class _ScanBillScreenState extends ConsumerState<ScanBillScreen>
    with SingleTickerProviderStateMixin {
  static const List<Map<String, String>> _templates = [
    {
      'name': 'Himalaya Hotel',
      'fileName': 'himalaya_hotel_receipt.txt',
      'text': '''HIMALAYA HOTEL
Vat No: 987654321
Date: 2026-05-22
-----------------------------
Momo           1 x 300.00    300.00
Coke           2 x 80.00     160.00
-----------------------------
Subtotal:                    460.00
VAT 13%:                     0.00
Total Amount:                460.00
Payment Mode:                Cash''',
    },
    {
      'name': 'City Mart NPR',
      'fileName': 'city_mart_npr.txt',
      'text': '''CITY MART NPR
Vat No: 123456789
Date: 2026-05-22
-----------------------------
Rice 5kg       1 x 800.00    800.00
Oil 1L         2 x 250.00    500.00
-----------------------------
Subtotal:                    1300.00
Discount:                    100.00
VAT 13%:                     156.00
Grand Total:                 1356.00
Payment Mode:                eSewa''',
    },
    {
      'name': 'Office Rent',
      'fileName': 'office_rent_receipt.txt',
      'text': '''OFFICE RENT RECEIPT
Date: 2026-05-22
-----------------------------
Rent Payment   1 x 15000.00  15000.00
-----------------------------
Subtotal:                    15000.00
Total Amount:                15000.00
Payment Mode:                Bank''',
    },
  ];

  final _rawText = TextEditingController();
  final _vendor = TextEditingController();
  final _billNumber = TextEditingController();
  final _billDate = TextEditingController();
  final _vat = TextEditingController(text: '0');
  final _total = TextEditingController(text: '0');

  String? _scanId;
  String _payment = 'Cash';
  String _target = 'Expense';
  List<Map<String, dynamic>> _items = const [];
  double? _confidence;

  late AnimationController _scanController;
  int _scanStep =
      0; // 0: Idle, 1: Uploading, 2: Extracting OCR, 3: Structuring AI, 4: Validating, 5: Done
  String? _selectedTemplateName;
  String? _selectedTemplateText;
  bool _isManualTextExpanded = false;

  @override
  void initState() {
    super.initState();
    _scanController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    );
  }

  @override
  void dispose() {
    _rawText.dispose();
    _vendor.dispose();
    _billNumber.dispose();
    _billDate.dispose();
    _vat.dispose();
    _total.dispose();
    _scanController.dispose();
    super.dispose();
  }

  Future<void> _runScanPipeline(
    String text,
    String fileName,
    String sourceType,
  ) async {
    setState(() {
      _scanStep = 1; // Uploading
      _scanId = null;
      _items = [];
      _confidence = null;
    });
    _scanController.repeat(reverse: true);

    try {
      final controller = ref.read(appControllerProvider.notifier);

      // Step 1: Upload
      final scan = await controller.uploadBillScan({
        'sourceType': sourceType,
        'fileName': fileName,
        'mimeType': 'text/plain',
        'rawText': text,
        'size': text.length,
      });
      final scanId = scan?['id']?.toString();
      if (scanId == null || scanId.isEmpty) {
        throw Exception("Upload failed");
      }

      // Step 2: OCR Extraction delay
      setState(() => _scanStep = 2);
      await Future.delayed(const Duration(milliseconds: 800));

      // Step 3: LLM Structuring (Custom PyTorch GPT / Gemini)
      setState(() => _scanStep = 3);
      final parsedResult = await controller.parseBillScan(scanId, text);
      final parsed = Map<String, dynamic>.from(
        parsedResult?['parsed'] as Map? ?? {},
      );

      // Step 4: Mathematical Validation delay
      setState(() => _scanStep = 4);
      await Future.delayed(const Duration(milliseconds: 600));

      // Step 5: Done
      setState(() {
        _scanStep = 5;
        _scanId = scanId;
        _confidence = parsed['confidence'] is num
            ? (parsed['confidence'] as num).toDouble()
            : double.tryParse(parsed['confidence']?.toString() ?? '');
        _vendor.text = _mapText(parsed, 'vendorName');
        _billNumber.text = _mapText(parsed, 'billNumber');
        _billDate.text = _mapText(parsed, 'billDate');
        _payment = _mapText(parsed, 'paymentMethod', fallback: 'Cash');
        _vat.text = _mapNum(parsed, 'vatAmount').toString();
        _total.text = _mapNum(parsed, 'totalAmount').toString();

        final rawItems = _rawList(parsed['items']);
        final timestamp = DateTime.now().millisecondsSinceEpoch;
        _items = rawItems.asMap().entries.map((entry) {
          final idx = entry.key;
          final item = Map<String, dynamic>.from(entry.value);
          item['tempId'] = 'item_${timestamp}_$idx';
          return item;
        }).toList();
      });
    } catch (e) {
      setState(() {
        _scanStep = 0;
      });
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Scan failed: $e')));
      }
    } finally {
      _scanController.stop();
      _scanController.reset();
    }
  }

  void _recalculateTotals(List<Map<String, dynamic>> nextItems) {
    double subtotal = 0.0;
    for (final item in nextItems) {
      subtotal += _mapNum(item, 'lineTotal').toDouble();
    }
    final vat = double.tryParse(_vat.text.trim()) ?? 0.0;
    final total = subtotal + vat;
    setState(() {
      _items = nextItems;
      _total.text = total.toStringAsFixed(2);
    });
  }

  void _addItem() {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final newItem = {
      'tempId': 'item_${timestamp}_${_items.length}',
      'name': '',
      'quantity': 1.0,
      'unit': 'pcs',
      'unitPrice': 0.0,
      'lineTotal': 0.0,
      'discount': 0.0,
      'tax': 0.0,
    };
    _recalculateTotals([..._items, newItem]);
  }

  void _updateItem(String tempId, String key, dynamic value) {
    final nextItems = _items.map((item) {
      if (item['tempId'] != tempId) return item;
      final updated = Map<String, dynamic>.from(item);
      updated[key] = value;

      final qty = _mapNum(updated, 'quantity').toDouble();
      final price = _mapNum(updated, 'unitPrice').toDouble();
      final lineTotal = qty * price;
      updated['lineTotal'] = lineTotal;
      return updated;
    }).toList();
    _recalculateTotals(nextItems);
  }

  void _removeItem(String tempId) {
    final nextItems = _items.where((item) => item['tempId'] != tempId).toList();
    _recalculateTotals(nextItems);
  }

  Future<void> _parseManual() async {
    final text = _rawText.text.trim();
    if (text.isEmpty) return;
    setState(() {
      _selectedTemplateName = "MANUAL INPUT";
      _selectedTemplateText = text;
    });
    await _runScanPipeline(text, 'mobile-bill-text.txt', 'manual');
  }

  void _showGallerySheet(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF16161F) : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
            border: Border(
              top: BorderSide(
                color: colorScheme.outlineVariant.withValues(
                  alpha: isDark ? 0.15 : 0.3,
                ),
                width: 1,
              ),
            ),
          ),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: colorScheme.outlineVariant.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Row(
                children: [
                  Icon(Icons.photo_library_rounded, color: colorScheme.primary),
                  const SizedBox(width: 10),
                  const Text(
                    'Photo Gallery',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Select a receipt image from your gallery to scan',
                style: TextStyle(
                  fontSize: 12,
                  color: colorScheme.onSurfaceVariant.withValues(alpha: 0.8),
                ),
              ),
              const SizedBox(height: 20),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  childAspectRatio: 0.85,
                ),
                itemCount: _templates.length,
                itemBuilder: (context, index) {
                  final tmpl = _templates[index];
                  return GestureDetector(
                    onTap: () {
                      Navigator.of(context).pop();
                      setState(() {
                        _selectedTemplateName = tmpl['name'];
                        _selectedTemplateText = tmpl['text'];
                        _rawText.text = tmpl['text']!;
                      });
                      _runScanPipeline(
                        tmpl['text']!,
                        tmpl['fileName']!,
                        'gallery',
                      );
                    },
                    child: Container(
                      decoration: BoxDecoration(
                        color: colorScheme.surfaceContainerHigh,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: colorScheme.outlineVariant.withValues(
                            alpha: 0.4,
                          ),
                          width: 1,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.04),
                            blurRadius: 6,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          Expanded(
                            child: Container(
                              margin: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: colorScheme.primary.withValues(
                                  alpha: 0.06,
                                ),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Center(
                                child: Icon(
                                  Icons.receipt_long_rounded,
                                  color: colorScheme.primary.withValues(
                                    alpha: 0.65,
                                  ),
                                  size: 28,
                                ),
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
                            child: Text(
                              tmpl['name']!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _save() async {
    final scanId = _scanId;
    if (scanId == null) return;
    await ref
        .read(appControllerProvider.notifier)
        .approveBillScan(
          scanId: scanId,
          targetRecordType: _target,
          approved: {
            'vendorName': _vendor.text.trim(),
            'billNumber': _billNumber.text.trim(),
            'billDate': _billDate.text.trim(),
            'paymentMethod': _payment,
            'vatAmount': _num(_vat.text),
            'totalAmount': _num(_total.text),
            'subtotal': _items.fold<num>(
              0,
              (sum, item) => sum + _mapNum(item, 'lineTotal'),
            ),
            'discountAmount': 0,
            'items': _items,
            'rawText': _rawText.text.trim(),
          },
        );
    setState(() {
      _scanStep = 0;
      _scanId = null;
      _confidence = null;
      _selectedTemplateName = null;
      _selectedTemplateText = null;
      _rawText.clear();
      _vendor.clear();
      _billNumber.clear();
      _billDate.clear();
      _vat.text = '0';
      _total.text = '0';
      _items = const [];
    });
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Bill registered in workspace successfully'),
        ),
      );
    }
  }

  Widget _buildTimelineStep(int stepNum, String label) {
    final isActive = _scanStep == stepNum;
    final isDone = _scanStep > stepNum;
    final theme = Theme.of(context);

    Color color;
    Widget icon;
    if (isDone) {
      color = Colors.green;
      icon = const Icon(Icons.check, size: 12, color: Colors.white);
    } else if (isActive) {
      color = theme.colorScheme.primary;
      icon = SizedBox(
        width: 10,
        height: 10,
        child: CircularProgressIndicator(
          strokeWidth: 2.0,
          valueColor: AlwaysStoppedAnimation<Color>(theme.colorScheme.primary),
        ),
      );
    } else {
      color = theme.colorScheme.onSurfaceVariant.withOpacity(0.3);
      icon = Text(
        stepNum.toString(),
        style: TextStyle(
          fontSize: 10,
          color: theme.colorScheme.onSurfaceVariant.withOpacity(0.6),
          fontWeight: FontWeight.bold,
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              color: isDone
                  ? Colors.green.withOpacity(0.15)
                  : (isActive
                        ? theme.colorScheme.primary.withOpacity(0.1)
                        : Colors.transparent),
              shape: BoxShape.circle,
              border: Border.all(color: color, width: 1.5),
            ),
            child: Center(child: icon),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                color: isActive
                    ? theme.colorScheme.primary
                    : (isDone
                          ? theme.colorScheme.onSurface
                          : theme.colorScheme.onSurfaceVariant),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appControllerProvider);
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;

    final isLowConfidence =
        _scanId != null && _confidence != null && _confidence! < 0.80;
    double subtotal = 0.0;
    for (final item in _items) {
      subtotal += _mapNum(item, 'lineTotal').toDouble();
    }
    final vat = double.tryParse(_vat.text.trim()) ?? 0.0;
    final total = double.tryParse(_total.text.trim()) ?? 0.0;
    final isMathMismatch =
        _scanId != null && (subtotal + vat - total).abs() > 0.02;

    return Scaffold(
      appBar: AppBar(title: Text(tr(ref, 'scanBill'))),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Viewfinder and template selection
            RpCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.camera_alt_outlined,
                        color: colorScheme.primary,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          tr(ref, 'simulatedView'),
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 16,
                          ),
                        ),
                      ),
                      TextButton.icon(
                        onPressed: state.loading
                            ? null
                            : () => _showGallerySheet(context),
                        icon: const Icon(
                          Icons.photo_library_outlined,
                          size: 16,
                        ),
                        label: const Text(
                          'Gallery',
                          style: TextStyle(fontSize: 12),
                        ),
                        style: TextButton.styleFrom(
                          visualDensity: VisualDensity.compact,
                          foregroundColor: colorScheme.primary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Container(
                    height: 200,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: isDark
                          ? Colors.black.withOpacity(0.4)
                          : Colors.grey.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: _scanStep > 0 && _scanStep < 5
                            ? colorScheme.primary.withOpacity(0.5)
                            : colorScheme.outlineVariant,
                        width: 1.5,
                      ),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(15),
                      child: Stack(
                        children: [
                          Positioned(
                            top: 10,
                            left: 10,
                            child: Container(
                              width: 15,
                              height: 15,
                              decoration: BoxDecoration(
                                border: Border(
                                  top: BorderSide(
                                    color: colorScheme.primary,
                                    width: 2,
                                  ),
                                  left: BorderSide(
                                    color: colorScheme.primary,
                                    width: 2,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          Positioned(
                            top: 10,
                            right: 10,
                            child: Container(
                              width: 15,
                              height: 15,
                              decoration: BoxDecoration(
                                border: Border(
                                  top: BorderSide(
                                    color: colorScheme.primary,
                                    width: 2,
                                  ),
                                  right: BorderSide(
                                    color: colorScheme.primary,
                                    width: 2,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          Positioned(
                            bottom: 10,
                            left: 10,
                            child: Container(
                              width: 15,
                              height: 15,
                              decoration: BoxDecoration(
                                border: Border(
                                  bottom: BorderSide(
                                    color: colorScheme.primary,
                                    width: 2,
                                  ),
                                  left: BorderSide(
                                    color: colorScheme.primary,
                                    width: 2,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          Positioned(
                            bottom: 10,
                            right: 10,
                            child: Container(
                              width: 15,
                              height: 15,
                              decoration: BoxDecoration(
                                border: Border(
                                  bottom: BorderSide(
                                    color: colorScheme.primary,
                                    width: 2,
                                  ),
                                  right: BorderSide(
                                    color: colorScheme.primary,
                                    width: 2,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          Center(
                            child: _selectedTemplateName == null
                                ? Padding(
                                    padding: const EdgeInsets.all(20.0),
                                    child: Column(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      children: [
                                        Icon(
                                          Icons.center_focus_weak,
                                          size: 40,
                                          color: colorScheme.onSurfaceVariant
                                              .withOpacity(0.6),
                                        ),
                                        const SizedBox(height: 10),
                                        Text(
                                          tr(ref, 'selectTemplateToSimulate'),
                                          textAlign: TextAlign.center,
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: colorScheme.onSurfaceVariant,
                                          ),
                                        ),
                                      ],
                                    ),
                                  )
                                : Container(
                                    padding: const EdgeInsets.all(16),
                                    width: double.infinity,
                                    height: double.infinity,
                                    child: SingleChildScrollView(
                                      physics:
                                          const NeverScrollableScrollPhysics(),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.spaceBetween,
                                            children: [
                                              Text(
                                                _selectedTemplateName!
                                                    .toUpperCase(),
                                                style: TextStyle(
                                                  fontFamily: 'monospace',
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 13,
                                                  color: colorScheme.primary,
                                                ),
                                              ),
                                              Icon(
                                                Icons.check_circle_outline,
                                                color: _scanStep == 5
                                                    ? Colors.green
                                                    : Colors.grey,
                                                size: 14,
                                              ),
                                            ],
                                          ),
                                          const Divider(
                                            height: 12,
                                            thickness: 1,
                                            color: Colors.white10,
                                          ),
                                          Text(
                                            _selectedTemplateText ?? '',
                                            style: TextStyle(
                                              fontFamily: 'monospace',
                                              fontSize: 9,
                                              color: isDark
                                                  ? Colors.white70
                                                  : Colors.black87,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                          ),
                          if (_scanStep > 0 && _scanStep < 5)
                            AnimatedBuilder(
                              animation: _scanController,
                              builder: (context, child) {
                                return Positioned(
                                  top: _scanController.value * 196,
                                  left: 0,
                                  right: 0,
                                  child: Container(
                                    height: 3,
                                    decoration: BoxDecoration(
                                      color: colorScheme.primary,
                                      boxShadow: [
                                        BoxShadow(
                                          color: colorScheme.primary
                                              .withOpacity(0.8),
                                          blurRadius: 8,
                                          spreadRadius: 2,
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    tr(ref, 'sampleBill'),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: colorScheme.onSurfaceVariant,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: _templates.map((tmpl) {
                        final isSelected =
                            _selectedTemplateName == tmpl['name'];
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ActionChip(
                            label: Text(tmpl['name']!),
                            onPressed: state.loading
                                ? null
                                : () {
                                    setState(() {
                                      _selectedTemplateName = tmpl['name'];
                                      _selectedTemplateText = tmpl['text'];
                                      _rawText.text = tmpl['text']!;
                                    });
                                    _runScanPipeline(
                                      tmpl['text']!,
                                      tmpl['fileName']!,
                                      'camera',
                                    );
                                  },
                            backgroundColor: isSelected
                                ? colorScheme.primaryContainer
                                : theme.cardTheme.color,
                            side: BorderSide(
                              color: isSelected
                                  ? colorScheme.primary
                                  : colorScheme.outlineVariant,
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Step Progress Timeline
            if (state.loading || _scanStep > 0) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: colorScheme.surfaceContainerHighest.withOpacity(
                    isDark ? 0.3 : 0.6,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: colorScheme.outlineVariant.withOpacity(0.5),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.psychology_outlined,
                          color: colorScheme.primary,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          tr(ref, 'customGptPipeline'),
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 16),
                    _buildTimelineStep(1, tr(ref, 'uploadingImage')),
                    _buildTimelineStep(2, tr(ref, 'runningOcr')),
                    _buildTimelineStep(3, tr(ref, 'llmStructuring')),
                    _buildTimelineStep(4, tr(ref, 'validatingRules')),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Raw Text Input option
            ExpansionTile(
              title: Text(
                tr(ref, 'ocrText'),
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
              ),
              leading: const Icon(Icons.description_outlined),
              trailing: Icon(
                _isManualTextExpanded ? Icons.expand_less : Icons.expand_more,
              ),
              onExpansionChanged: (expanded) =>
                  setState(() => _isManualTextExpanded = expanded),
              children: [
                Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: Column(
                    children: [
                      TextFormField(
                        controller: _rawText,
                        minLines: 5,
                        maxLines: 8,
                        decoration: InputDecoration(
                          labelText: tr(ref, 'ocrText'),
                          alignLabelWithHint: true,
                        ),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed:
                              state.loading || _rawText.text.trim().isEmpty
                              ? null
                              : _parseManual,
                          icon: const Icon(Icons.auto_awesome_outlined),
                          label: Text(tr(ref, 'parseBill')),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            // Review Parsed Bill Form
            if (_scanId != null && _scanStep == 5) ...[
              const SizedBox(height: 20),
              Text(
                tr(ref, 'reviewBill'),
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 18,
                ),
              ),
              const SizedBox(height: 12),
              if (isLowConfidence) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.amber.withOpacity(0.1),
                    border: Border.all(color: Colors.amber.withOpacity(0.3)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.warning_amber_rounded,
                        color: Colors.amber,
                        size: 20,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Low confidence extraction (${(_confidence! * 100).toStringAsFixed(0)}%). Please double check the highlighted fields below.',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: Colors.amber,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],
              _TextField(
                controller: _vendor,
                label: tr(ref, 'shopVendor'),
                icon: Icons.store_outlined,
                isHighlighted: isLowConfidence,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _TextField(
                      controller: _billNumber,
                      label: tr(ref, 'billNumber'),
                      icon: Icons.receipt_long_outlined,
                      isHighlighted: isLowConfidence,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _TextField(
                      controller: _billDate,
                      label: tr(ref, 'billDate'),
                      icon: Icons.calendar_today_outlined,
                      isHighlighted: isLowConfidence,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _NumberField(
                      controller: _vat,
                      label: tr(ref, 'tax'),
                      onChanged: (_) => _recalculateTotals(_items),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _NumberField(
                      controller: _total,
                      label: tr(ref, 'total'),
                      isHighlighted: isLowConfidence,
                    ),
                  ),
                ],
              ),
              if (isMathMismatch) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.withOpacity(0.1),
                    border: Border.all(color: Colors.red.withOpacity(0.3)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.error_outline_rounded,
                        color: Colors.red,
                        size: 20,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Mathematical Mismatch: Subtotal (${subtotal.toStringAsFixed(2)}) + VAT (${vat.toStringAsFixed(2)}) does not equal Total (${total.toStringAsFixed(2)}).',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: Colors.red,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: _target,
                      items: [
                        DropdownMenuItem(
                          value: 'Expense',
                          child: Text(tr(ref, 'expenses')),
                        ),
                        DropdownMenuItem(
                          value: 'Purchase',
                          child: Text(tr(ref, 'purchases')),
                        ),
                        DropdownMenuItem(
                          value: 'Sale',
                          child: Text(tr(ref, 'sales')),
                        ),
                      ],
                      onChanged: (value) =>
                          setState(() => _target = value ?? 'Expense'),
                      decoration: InputDecoration(labelText: tr(ref, 'saveAs')),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: _payment,
                      items: [
                        DropdownMenuItem(
                          value: 'Cash',
                          child: Text(tr(ref, 'cash')),
                        ),
                        DropdownMenuItem(
                          value: 'Credit',
                          child: Text(tr(ref, 'credit')),
                        ),
                        const DropdownMenuItem(
                          value: 'eSewa',
                          child: Text('eSewa'),
                        ),
                        const DropdownMenuItem(
                          value: 'Khalti',
                          child: Text('Khalti'),
                        ),
                        const DropdownMenuItem(
                          value: 'Bank',
                          child: Text('Bank'),
                        ),
                      ],
                      onChanged: (value) =>
                          setState(() => _payment = value ?? 'Cash'),
                      decoration: InputDecoration(
                        labelText: tr(ref, 'payment'),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    tr(ref, 'items'),
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 15,
                    ),
                  ),
                  TextButton.icon(
                    onPressed: _addItem,
                    icon: const Icon(Icons.add, size: 16),
                    label: Text(tr(ref, 'addItem')),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (_items.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(
                    'No items. Add items or save bill as a single amount.',
                    style: TextStyle(
                      color: colorScheme.onSurfaceVariant,
                      fontSize: 13,
                    ),
                  ),
                )
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _items.length,
                  itemBuilder: (context, index) {
                    final item = _items[index];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: _EditableBillItemTile(
                        key: ValueKey(item['tempId']),
                        item: item,
                        onUpdate: (key, val) =>
                            _updateItem(item['tempId'] as String, key, val),
                        onRemove: () => _removeItem(item['tempId'] as String),
                      ),
                    );
                  },
                ),
              const SizedBox(height: 12),
              Card(
                color: colorScheme.primaryContainer.withOpacity(0.1),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(
                    color: colorScheme.primary.withOpacity(0.15),
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Row(
                    children: [
                      Icon(
                        Icons.info_outline,
                        color: colorScheme.primary,
                        size: 18,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          tr(ref, 'customGptNotes'),
                          style: TextStyle(
                            fontSize: 11,
                            color: colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton.icon(
                  onPressed: state.loading ? null : _save,
                  icon: const Icon(Icons.check_circle_outline),
                  label: Text(tr(ref, 'saveToRecords')),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _EditableBillItemTile extends ConsumerStatefulWidget {
  const _EditableBillItemTile({
    required super.key,
    required this.item,
    required this.onUpdate,
    required this.onRemove,
  });

  final Map<String, dynamic> item;
  final void Function(String key, dynamic value) onUpdate;
  final VoidCallback onRemove;

  @override
  ConsumerState<_EditableBillItemTile> createState() =>
      _EditableBillItemTileState();
}

class _EditableBillItemTileState extends ConsumerState<_EditableBillItemTile> {
  late TextEditingController _nameController;
  late TextEditingController _qtyController;
  late TextEditingController _rateController;
  late FocusNode _nameFocusNode;
  late FocusNode _qtyFocusNode;
  late FocusNode _rateFocusNode;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(
      text: _mapText(widget.item, 'name'),
    );
    _qtyController = TextEditingController(
      text: _mapNum(widget.item, 'quantity').toString(),
    );
    _rateController = TextEditingController(
      text: _mapNum(widget.item, 'unitPrice').toString(),
    );
    _nameFocusNode = FocusNode();
    _qtyFocusNode = FocusNode();
    _rateFocusNode = FocusNode();
  }

  @override
  void didUpdateWidget(covariant _EditableBillItemTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    final newName = _mapText(widget.item, 'name');
    final newQtyStr = _mapNum(widget.item, 'quantity').toString();
    final newRateStr = _mapNum(widget.item, 'unitPrice').toString();

    if (_nameController.text != newName && !_nameFocusNode.hasFocus) {
      _nameController.text = newName;
    }
    if (double.tryParse(_qtyController.text) != double.tryParse(newQtyStr) &&
        !_qtyFocusNode.hasFocus) {
      _qtyController.text = newQtyStr;
    }
    if (double.tryParse(_rateController.text) != double.tryParse(newRateStr) &&
        !_rateFocusNode.hasFocus) {
      _rateController.text = newRateStr;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _qtyController.dispose();
    _rateController.dispose();
    _nameFocusNode.dispose();
    _qtyFocusNode.dispose();
    _rateFocusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final lineTotal = _mapNum(widget.item, 'lineTotal');
    final selectedUnit = _mapText(widget.item, 'unit', fallback: 'pcs');

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(16),
        color: theme.cardTheme.color ?? colorScheme.surface,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _nameController,
                  focusNode: _nameFocusNode,
                  decoration: InputDecoration(
                    labelText: tr(ref, 'item'),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                  ),
                  onChanged: (val) => widget.onUpdate('name', val.trim()),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.delete_outline, color: Colors.red),
                onPressed: widget.onRemove,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                flex: 2,
                child: TextFormField(
                  controller: _qtyController,
                  focusNode: _qtyFocusNode,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                  ],
                  decoration: InputDecoration(
                    labelText: tr(ref, 'quantity'),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                  ),
                  onChanged: (val) {
                    final d = double.tryParse(val) ?? 0.0;
                    widget.onUpdate('quantity', d);
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: DropdownButtonFormField<String>(
                  value: ['pcs', 'liter', 'kg', 'unit'].contains(selectedUnit)
                      ? selectedUnit
                      : 'pcs',
                  items: const [
                    DropdownMenuItem(value: 'pcs', child: Text('pcs')),
                    DropdownMenuItem(value: 'liter', child: Text('liter')),
                    DropdownMenuItem(value: 'kg', child: Text('kg')),
                    DropdownMenuItem(value: 'unit', child: Text('unit')),
                  ],
                  onChanged: (val) {
                    if (val != null) {
                      widget.onUpdate('unit', val);
                    }
                  },
                  decoration: const InputDecoration(
                    labelText: 'Unit',
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 6,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 3,
                child: TextFormField(
                  controller: _rateController,
                  focusNode: _rateFocusNode,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                  ],
                  decoration: InputDecoration(
                    labelText: tr(ref, 'price'),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                  ),
                  onChanged: (val) {
                    final d = double.tryParse(val) ?? 0.0;
                    widget.onUpdate('unitPrice', d);
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 3,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      tr(ref, 'lineTotal'),
                      style: TextStyle(
                        fontSize: 10,
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      money(lineTotal),
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ],
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
    this.isHighlighted = false,
  });

  final TextEditingController controller;
  final String label;
  final IconData icon;
  final bool requiredField;
  final bool isHighlighted;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return TextFormField(
      controller: controller,
      validator: requiredField
          ? (value) => value == null || value.trim().isEmpty
                ? tr(ref, 'required')
                : null
          : null,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon),
        enabledBorder: isHighlighted
            ? OutlineInputBorder(
                borderSide: const BorderSide(color: Colors.amber, width: 1.5),
                borderRadius: BorderRadius.circular(12),
              )
            : null,
        focusedBorder: isHighlighted
            ? OutlineInputBorder(
                borderSide: const BorderSide(color: Colors.amber, width: 2.0),
                borderRadius: BorderRadius.circular(12),
              )
            : null,
      ),
    );
  }
}

class _NumberField extends ConsumerWidget {
  const _NumberField({
    required this.controller,
    required this.label,
    this.onChanged,
    this.isHighlighted = false,
  });

  final TextEditingController controller;
  final String label;
  final ValueChanged<String>? onChanged;
  final bool isHighlighted;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return TextFormField(
      controller: controller,
      onChanged: onChanged,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
      validator: (value) =>
          value == null || value.trim().isEmpty ? tr(ref, 'required') : null,
      decoration: InputDecoration(
        labelText: label,
        enabledBorder: isHighlighted
            ? OutlineInputBorder(
                borderSide: const BorderSide(color: Colors.amber, width: 1.5),
                borderRadius: BorderRadius.circular(12),
              )
            : null,
        focusedBorder: isHighlighted
            ? OutlineInputBorder(
                borderSide: const BorderSide(color: Colors.amber, width: 2.0),
                borderRadius: BorderRadius.circular(12),
              )
            : null,
      ),
    );
  }
}

num _num(String value) => num.tryParse(value.trim()) ?? 0;

String _mapText(Map<String, dynamic> map, String key, {String fallback = ''}) {
  final value = map[key];
  return value == null ? fallback : value.toString();
}

num _mapNum(Map<String, dynamic> map, String key, {num fallback = 0}) {
  return num.tryParse(map[key]?.toString() ?? '') ?? fallback;
}

List<Map<String, dynamic>> _rawList(Object? value) {
  if (value is! List) return const [];
  return value
      .whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item))
      .toList();
}
