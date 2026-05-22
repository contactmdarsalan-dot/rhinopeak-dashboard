import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/state/app_controller.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/models/rhino_models.dart';
import '../../../shared/widgets/api_detail_screen.dart';
import '../../../shared/widgets/mobile_record_editor.dart';
import '../../../shared/widgets/rp_widgets.dart';

class InventoryScreen extends ConsumerStatefulWidget {
  const InventoryScreen({super.key});

  @override
  ConsumerState<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends ConsumerState<InventoryScreen> {
  String _search = '';

  @override
  Widget build(BuildContext context) {
    final bootstrap = ref.watch(appControllerProvider).bootstrap;
    final allProducts = bootstrap?.products ?? const <Product>[];
    final products = _search.isEmpty
        ? allProducts
        : allProducts
            .where((p) =>
                p.name.toLowerCase().contains(_search.toLowerCase()) ||
                p.category.toLowerCase().contains(_search.toLowerCase()))
            .toList();

    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return RpPage(
      title: tr(ref, 'inventory'),
      action: IconButton.filled(
        onPressed: () => _showProductSheet(context, ref),
        icon: const Icon(Icons.add_rounded),
        tooltip: tr(ref, 'addProduct'),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Action Buttons Row
          Row(
            children: [
              Expanded(
                child: _ActionButton(
                  icon: Icons.add_box_rounded,
                  label: tr(ref, 'addProduct'),
                  onTap: () => _showProductSheet(context, ref),
                  isPrimary: true,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _ActionButton(
                  icon: Icons.category_rounded,
                  label: tr(ref, 'categoryCrud'),
                  onTap: () => _showCategorySheet(context, ref),
                  isPrimary: false,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Search Bar
          Container(
            decoration: BoxDecoration(
              color: colorScheme.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: colorScheme.outlineVariant
                    .withValues(alpha: isDark ? 0.2 : 0.45),
                width: 1,
              ),
            ),
            child: TextField(
              onChanged: (v) => setState(() => _search = v),
              decoration: InputDecoration(
                hintText: '${tr(ref, 'inventory')}...',
                prefixIcon: Icon(Icons.search_rounded,
                    color: colorScheme.onSurfaceVariant.withValues(alpha: 0.6)),
                suffixIcon: _search.isNotEmpty
                    ? IconButton(
                        onPressed: () => setState(() => _search = ''),
                        icon: Icon(Icons.close_rounded,
                            size: 18,
                            color: colorScheme.onSurfaceVariant
                                .withValues(alpha: 0.6)),
                      )
                    : null,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Stats Row
          if (allProducts.isNotEmpty) ...[
            _StatsRow(products: allProducts),
            const SizedBox(height: 16),
          ],

          // Products List
          if (products.isEmpty)
            _EmptyState(
              icon: Icons.inventory_2_outlined,
              message: _search.isEmpty
                  ? tr(ref, 'emptyStock')
                  : 'No products match "$_search"',
            )
          else
            ...products.map(
              (product) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: RpCard(
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => ApiDetailScreen(
                          title: product.name,
                          entity: 'inventory',
                          id: product.id,
                        ),
                      ),
                    );
                  },
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Product Icon
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: colorScheme.primary
                                  .withValues(alpha: isDark ? 0.12 : 0.08),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: colorScheme.primary
                                    .withValues(alpha: isDark ? 0.22 : 0.15),
                                width: 1,
                              ),
                            ),
                            child: Icon(
                              Icons.inventory_2_outlined,
                              size: 18,
                              color: colorScheme.primary,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  product.name,
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  '${product.category}'
                                  '${product.supplier.isNotEmpty ? ' - ${product.supplier}' : ''}',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: colorScheme.onSurfaceVariant
                                        .withValues(alpha: 0.75),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          _StockBadge(product: product),
                        ],
                      ),
                      const SizedBox(height: 14),
                      // Metrics Row
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: colorScheme.surfaceContainerHighest
                              .withValues(alpha: isDark ? 0.25 : 0.4),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: _MiniMetric(
                                label: tr(ref, 'stock'),
                                value: quantity(product.stock, product.unit),
                                icon: Icons.layers_outlined,
                              ),
                            ),
                            _VerticalDivider(),
                            Expanded(
                              child: _MiniMetric(
                                label: tr(ref, 'price'),
                                value: money(product.price),
                                icon: Icons.sell_outlined,
                              ),
                            ),
                            _VerticalDivider(),
                            Expanded(
                              child: _MiniMetric(
                                label: tr(ref, 'reorder'),
                                value: quantity(
                                    product.reorderLevel, product.unit),
                                icon: Icons.warning_amber_rounded,
                                highlight:
                                    product.stock <= product.reorderLevel,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      Divider(
                        height: 1,
                        color: colorScheme.outlineVariant
                            .withValues(alpha: isDark ? 0.18 : 0.45),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => ApiDetailScreen(
                                      title: product.name,
                                      entity: 'inventory',
                                      id: product.id,
                                    ),
                                  ),
                                );
                              },
                              icon: const Icon(Icons.visibility_outlined,
                                  size: 18),
                              label: Text(tr(ref, 'view')),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => showMobileRecordEditor(
                                context,
                                ref,
                                entity: 'inventory',
                                title: product.name,
                                initial: _productRecord(product),
                              ),
                              icon: const Icon(Icons.edit_outlined, size: 18),
                              label: Text(tr(ref, 'edit')),
                            ),
                          ),
                          const SizedBox(width: 8),
                          SizedBox.square(
                            dimension: 48,
                            child: IconButton.outlined(
                              tooltip: tr(ref, 'delete'),
                              onPressed: () =>
                                  _confirmDeleteProduct(context, ref, product),
                              icon: const Icon(Icons.delete_outline_rounded),
                              style: IconButton.styleFrom(
                                foregroundColor: colorScheme.error,
                                side: BorderSide(
                                  color:
                                      colorScheme.error.withValues(alpha: 0.42),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _showProductSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _BottomSheetWrapper(child: _ProductSheet()),
    );
  }

  void _showCategorySheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _BottomSheetWrapper(child: _CategorySheet()),
    );
  }
}

class _BottomSheetWrapper extends StatelessWidget {
  const _BottomSheetWrapper({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF16161F) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border(
          top: BorderSide(
            color: colorScheme.outlineVariant
                .withValues(alpha: isDark ? 0.15 : 0.3),
            width: 1,
          ),
        ),
      ),
      child: child,
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
    required this.isPrimary,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool isPrimary;

  @override
  Widget build(BuildContext context) {
    if (isPrimary) {
      return FilledButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: 18),
        label: Text(label, overflow: TextOverflow.ellipsis),
        style: FilledButton.styleFrom(
          minimumSize: const Size(0, 50),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      );
    }
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 18),
      label: Text(label, overflow: TextOverflow.ellipsis),
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 50),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    );
  }
}

class _StatsRow extends StatelessWidget {
  const _StatsRow({required this.products});
  final List<Product> products;

  @override
  Widget build(BuildContext context) {
    final lowStock = products.where((p) => p.stock <= p.reorderLevel).length;
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Row(
      children: [
        Expanded(
          child: _StatPill(
            label: 'Total Items',
            value: '${products.length}',
            color: colorScheme.primary,
            isDark: isDark,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _StatPill(
            label: 'Low Stock',
            value: '$lowStock',
            color: lowStock > 0
                ? const Color(0xFFEF4444)
                : const Color(0xFF10B981),
            isDark: isDark,
          ),
        ),
      ],
    );
  }
}

class _StatPill extends StatelessWidget {
  const _StatPill({
    required this.label,
    required this.value,
    required this.color,
    required this.isDark,
  });

  final String label;
  final String value;
  final Color color;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.12 : 0.07),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: color.withValues(alpha: isDark ? 0.25 : 0.15),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: color,
              letterSpacing: 0,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: color.withValues(alpha: 0.8),
            ),
          ),
        ],
      ),
    );
  }
}

class _VerticalDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 32,
      margin: const EdgeInsets.symmetric(horizontal: 8),
      color:
          Theme.of(context).colorScheme.outlineVariant.withValues(alpha: 0.4),
    );
  }
}

class _StockBadge extends StatelessWidget {
  const _StockBadge({required this.product});
  final Product product;

  @override
  Widget build(BuildContext context) {
    final isLow = product.stock <= product.reorderLevel;
    final color =
        isLow ? const Color(0xFFEF4444) : Theme.of(context).colorScheme.primary;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.15 : 0.08),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(
          color: color.withValues(alpha: isDark ? 0.3 : 0.2),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (isLow) ...[
            Icon(Icons.warning_amber_rounded, size: 11, color: color),
            const SizedBox(width: 4),
          ],
          Text(
            quantity(product.stock, product.unit),
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniMetric extends StatelessWidget {
  const _MiniMetric({
    required this.label,
    required this.value,
    required this.icon,
    this.highlight = false,
  });

  final String label;
  final String value;
  final IconData icon;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final valueColor =
        highlight ? const Color(0xFFEF4444) : colorScheme.onSurface;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: colorScheme.onSurfaceVariant.withValues(alpha: 0.65),
            letterSpacing: 0.2,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w900,
            color: valueColor,
          ),
        ),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: colorScheme.outlineVariant
              .withValues(alpha: isDark ? 0.15 : 0.35),
          width: 1,
        ),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color:
                  colorScheme.primary.withValues(alpha: isDark ? 0.12 : 0.07),
              shape: BoxShape.circle,
            ),
            child: Icon(icon,
                size: 32, color: colorScheme.primary.withValues(alpha: 0.6)),
          ),
          const SizedBox(height: 16),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: colorScheme.onSurfaceVariant.withValues(alpha: 0.7),
              fontSize: 14,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Bottom Sheet Forms ────────────────────────────────────────────────────────

class _ProductSheet extends ConsumerStatefulWidget {
  const _ProductSheet();

  @override
  ConsumerState<_ProductSheet> createState() => _ProductSheetState();
}

class _ProductSheetState extends ConsumerState<_ProductSheet> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _supplier = TextEditingController();
  final _stock = TextEditingController(text: '0');
  final _reorder = TextEditingController(text: '5');
  final _price = TextEditingController(text: '0');
  final _cost = TextEditingController(text: '0');

  String _unit = 'pcs';
  String? _category;

  @override
  void dispose() {
    _name.dispose();
    _supplier.dispose();
    _stock.dispose();
    _reorder.dispose();
    _price.dispose();
    _cost.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final bootstrap = ref.read(appControllerProvider).bootstrap;
    await ref.read(appControllerProvider.notifier).createProduct({
      'name': _name.text.trim(),
      'category': _category ?? 'General',
      'unit': _unit,
      'stock': _num(_stock.text),
      'reorderLevel': _num(_reorder.text),
      'price': _num(_price.text),
      'costPrice': _num(_cost.text),
      'supplier': _supplier.text.trim(),
      'taxRate': bootstrap?.settings.taxRate ?? 13,
      'active': true,
    });
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appControllerProvider);
    final categories = _categoryOptions(state.bootstrap);
    _category ??= categories.first;
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Sheet Handle
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
              _SheetHeader(
                title: tr(ref, 'addProduct'),
                subtitle: tr(ref, 'addProductHelp'),
              ),
              _Field(
                  controller: _name,
                  label: tr(ref, 'product'),
                  icon: Icons.shopping_bag_outlined),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _category,
                items: categories
                    .map((item) =>
                        DropdownMenuItem(value: item, child: Text(item)))
                    .toList(),
                onChanged: (value) => setState(() => _category = value),
                decoration: InputDecoration(
                    labelText: tr(ref, 'category'),
                    prefixIcon: const Icon(Icons.category_outlined)),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _unit,
                items: const ['pcs', 'kg', 'liter', 'meter', 'box', 'service']
                    .map((item) =>
                        DropdownMenuItem(value: item, child: Text(item)))
                    .toList(),
                onChanged: (value) => setState(() => _unit = value ?? 'pcs'),
                decoration: InputDecoration(
                    labelText: tr(ref, 'unit'),
                    prefixIcon: const Icon(Icons.straighten_outlined)),
              ),
              const SizedBox(height: 12),
              _Field(
                  controller: _supplier,
                  label: tr(ref, 'supplier'),
                  icon: Icons.local_shipping_outlined,
                  requiredField: false),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                      child: _NumberField(
                          controller: _stock, label: tr(ref, 'stock'))),
                  const SizedBox(width: 10),
                  Expanded(
                      child: _NumberField(
                          controller: _reorder, label: tr(ref, 'reorder'))),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                      child: _NumberField(
                          controller: _price, label: tr(ref, 'price'))),
                  const SizedBox(width: 10),
                  Expanded(
                      child: _NumberField(
                          controller: _cost, label: tr(ref, 'cost'))),
                ],
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: state.loading ? null : _save,
                child: state.loading
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : Text(tr(ref, 'save')),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CategorySheet extends ConsumerStatefulWidget {
  const _CategorySheet();

  @override
  ConsumerState<_CategorySheet> createState() => _CategorySheetState();
}

class _CategorySheetState extends ConsumerState<_CategorySheet> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _controller.text.trim();
    if (name.isEmpty) return;
    await ref
        .read(appControllerProvider.notifier)
        .createInventoryCategory(name);
    _controller.clear();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appControllerProvider);
    final categories = _categoryOptions(state.bootstrap);
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Sheet Handle
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
          _SheetHeader(
              title: tr(ref, 'category'), subtitle: tr(ref, 'categoryHelp')),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  decoration: InputDecoration(
                    labelText: tr(ref, 'category'),
                    prefixIcon: const Icon(Icons.label_outline_rounded),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              IconButton.filled(
                onPressed: state.loading ? null : _save,
                icon: const Icon(Icons.add_rounded),
                style: IconButton.styleFrom(
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                  minimumSize: const Size(52, 52),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final category in categories) RpTag(label: category)
            ],
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

class _SheetHeader extends StatelessWidget {
  const _SheetHeader({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.w900, letterSpacing: 0),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: TextStyle(
              color: Theme.of(context)
                  .colorScheme
                  .onSurfaceVariant
                  .withValues(alpha: 0.8),
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

class _Field extends ConsumerWidget {
  const _Field({
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
  const _NumberField({required this.controller, required this.label});

  final TextEditingController controller;
  final String label;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return TextFormField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
      validator: (value) => _num(value ?? '') < 0 ? tr(ref, 'required') : null,
      decoration: InputDecoration(labelText: label),
    );
  }
}

List<String> _categoryOptions(BootstrapData? bootstrap) {
  final categories = <String>{'General', ...?bootstrap?.inventoryCategories};
  for (final product in bootstrap?.products ?? const <Product>[]) {
    if (product.category.trim().isNotEmpty) {
      categories.add(product.category.trim());
    }
  }
  return categories.toList()..sort();
}

num _num(String value) => num.tryParse(value.trim()) ?? 0;

Map<String, dynamic> _productRecord(Product product) {
  return {
    'id': product.id,
    'name': product.name,
    'category': product.category,
    'unit': product.unit,
    'stock': product.stock,
    'reorderLevel': product.reorderLevel,
    'price': product.price,
    'costPrice': product.costPrice,
    'supplier': product.supplier,
    'status': product.status,
  };
}

Future<void> _confirmDeleteProduct(
  BuildContext context,
  WidgetRef ref,
  Product product,
) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(tr(ref, 'deleteRecordTitle')),
      content: Text('${tr(ref, 'deleteRecordBody')}\n\n${product.name}'),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(tr(ref, 'cancel')),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          style: FilledButton.styleFrom(
            backgroundColor: Theme.of(context).colorScheme.error,
            foregroundColor: Theme.of(context).colorScheme.onError,
          ),
          child: Text(tr(ref, 'delete')),
        ),
      ],
    ),
  );
  if (confirmed != true) return;
  await ref
      .read(appControllerProvider.notifier)
      .deleteRecord('inventory', product.id);
}
