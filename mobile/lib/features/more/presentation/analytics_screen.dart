import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../shared/widgets/rp_widgets.dart';

class AnalyticsScreen extends ConsumerStatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  ConsumerState<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends ConsumerState<AnalyticsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      backgroundColor: const Color(0xFFF7F7FA),
      appBar: AppBar(
        title: const Text('BI & Analytics'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: colorScheme.primary,
          labelColor: colorScheme.primary,
          unselectedLabelColor: const Color(0xFF757891),
          labelStyle: const TextStyle(fontWeight: FontWeight.bold),
          tabs: const [
            Tab(text: 'Revenue'),
            Tab(text: 'Inventory'),
            Tab(text: 'AI Forecast'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [
          _RevenueTab(),
          _InventoryTab(),
          _ForecastTab(),
        ],
      ),
    );
  }
}

// ─── REVENUE TAB ─────────────────────────────────────────────────────────────
class _RevenueTab extends StatelessWidget {
  const _RevenueTab();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Stat Summary
          Row(
            children: [
              const Expanded(
                child: _MetricCard(
                  label: 'Gross Profit',
                  value: 'Rs 184.2K',
                  trend: '+12.4%',
                  trendUp: true,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _MetricCard(
                  label: 'Expenses',
                  value: 'Rs 42.1K',
                  trend: '-3.2%',
                  trendUp: false,
                  color: Colors.red.shade600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Monthly Revenue Chart Card
          RpCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Monthly Revenue Trend',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Comparison of last 6 calendar months',
                  style: TextStyle(fontSize: 12, color: Color(0xFF757891)),
                ),
                const SizedBox(height: 24),
                // Custom Bar Chart
                SizedBox(
                  height: 160,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: const [
                      _Bar(label: 'Nov', value: 0.45),
                      _Bar(label: 'Dec', value: 0.65),
                      _Bar(label: 'Jan', value: 0.55),
                      _Bar(label: 'Feb', value: 0.78),
                      _Bar(label: 'Mar', value: 0.88),
                      _Bar(label: 'Apr', value: 0.95, highlight: true),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Category Share Card
          RpCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Top Revenue Categories',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                _CategoryRow(name: 'Fresh Produce', percentage: '45%', amount: 'Rs 82,890.00', color: const Color(0xFF0A6E46)),
                _CategoryRow(name: 'Beverages', percentage: '28%', amount: 'Rs 51,576.00', color: const Color(0xFF0FA871)),
                _CategoryRow(name: 'Bakery', percentage: '17%', amount: 'Rs 31,314.00', color: const Color(0xFFFFA733)),
                _CategoryRow(name: 'Other', percentage: '10%', amount: 'Rs 18,420.00', color: const Color(0xFF757891)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── INVENTORY TAB ────────────────────────────────────────────────────────────
class _InventoryTab extends StatelessWidget {
  const _InventoryTab();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Row(
            children: const [
              Expanded(
                child: _MetricCard(
                  label: 'Inventory Value',
                  value: 'Rs 624.5K',
                  trend: '+4.5%',
                  trendUp: true,
                ),
              ),
              SizedBox(width: 12),
              Expanded(
                child: _MetricCard(
                  label: 'Turnover Rate',
                  value: '8.4x / yr',
                  trend: 'Optimal',
                  trendUp: true,
                  color: Color(0xFFFFA733),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Stock Health
          RpCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Stock Movement Health',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 20),
                const _StockHealthBar(active: 0.72, warning: 0.18, dead: 0.10),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _IndicatorDot(color: const Color(0xFF0FA871), label: 'Fast-Moving (72%)'),
                    _IndicatorDot(color: const Color(0xFFFFA733), label: 'Slow-Moving (18%)'),
                    _IndicatorDot(color: const Color(0xFFD43C42), label: 'Dead Stock (10%)'),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Slow Moving Items
          RpCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Critical Stock Actions Needed',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 14),
                _AlertItem(title: 'Dead stock found: Dry Yeast', subtitle: 'No sales for 45 days. Recommendation: Liquidate or bundle.', icon: Icons.inventory_2_outlined, color: const Color(0xFFD43C42)),
                _AlertItem(title: 'Fast-moving: Papaya', subtitle: 'Selling 15% faster. Recommendation: Restock 3 days earlier than planned.', icon: Icons.trending_up, color: const Color(0xFF0FA871)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── FORECAST TAB ─────────────────────────────────────────────────────────────
class _ForecastTab extends StatelessWidget {
  const _ForecastTab();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // AI Summary
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0F101A), Color(0xFF0A6E46)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0A6E46).withOpacity(0.2),
                  blurRadius: 16,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Row(
              children: [
                const CircleAvatar(
                  backgroundColor: Color(0xFFFFA733),
                  child: Icon(Icons.auto_awesome, color: Colors.white, size: 20),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        'AI Demand Predictor',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Seasonal surge expected for Fresh Produce in mid-June. Demand forecast is up 22%.',
                        style: TextStyle(color: Colors.white70, fontSize: 12.5, height: 1.35),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Projected Demand Graph
          RpCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Projected Sales Demand Forecast',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 24),
                // Custom Forecast Graph (Line painting simulation)
                SizedBox(
                  height: 160,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: const [
                      _Bar(label: 'May 30', value: 0.50),
                      _Bar(label: 'Jun 05', value: 0.60),
                      _Bar(label: 'Jun 10', value: 0.75, highlight: true),
                      _Bar(label: 'Jun 15', value: 0.85, highlight: true),
                      _Bar(label: 'Jun 20', value: 0.90, highlight: true),
                      _Bar(label: 'Jun 25', value: 0.80, highlight: true),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Reorder Recommendations
          RpCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Smart Procurement Suggestions',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 14),
                _ProcureItem(name: 'Fresh Papaya', qty: '+250 kg', supplier: 'Organic Farms Ltd', date: 'Order by Jun 05'),
                _ProcureItem(name: 'Apple Cider 1L', qty: '+50 cases', supplier: 'Himalayan Breweries', date: 'Order by Jun 08'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── HELPER COMPONENT WIDGETS ────────────────────────────────────────────────
class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.trend,
    required this.trendUp,
    this.color,
  });

  final String label;
  final String value;
  final String trend;
  final bool trendUp;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final finalColor = color ?? const Color(0xFF0A6E46);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(color: Color(0xFF757891), fontSize: 12, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF0F101A)),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(
                trendUp ? Icons.trending_up : Icons.trending_down,
                color: trendUp ? const Color(0xFF0FA871) : Colors.red,
                size: 14,
              ),
              const SizedBox(width: 4),
              Text(
                trend,
                style: TextStyle(
                  color: trendUp ? const Color(0xFF0FA871) : Colors.red,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({required this.label, required this.value, this.highlight = false});

  final String label;
  final double value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Container(
          width: 28,
          height: 120 * value,
          decoration: BoxDecoration(
            color: highlight ? const Color(0xFFFFA733) : const Color(0xFF0A6E46),
            borderRadius: BorderRadius.circular(8),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          label,
          style: const TextStyle(fontSize: 10.5, color: Color(0xFF757891), fontWeight: FontWeight.bold),
        ),
      ],
    );
  }
}

class _CategoryRow extends StatelessWidget {
  const _CategoryRow({
    required this.name,
    required this.percentage,
    required this.amount,
    required this.color,
  });

  final String name;
  final String percentage;
  final String amount;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 12,
            height: 12,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              name,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
          ),
          Text(
            percentage,
            style: const TextStyle(color: Color(0xFF757891), fontWeight: FontWeight.bold),
          ),
          const SizedBox(width: 16),
          Text(
            amount,
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }
}

class _StockHealthBar extends StatelessWidget {
  const _StockHealthBar({required this.active, required this.warning, required this.dead});

  final double active;
  final double warning;
  final double dead;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: SizedBox(
        height: 12,
        child: Row(
          children: [
            Expanded(flex: (active * 100).round(), child: Container(color: const Color(0xFF0FA871))),
            Expanded(flex: (warning * 100).round(), child: Container(color: const Color(0xFFFFA733))),
            Expanded(flex: (dead * 100).round(), child: Container(color: const Color(0xFFD43C42))),
          ],
        ),
      ),
    );
  }
}

class _IndicatorDot extends StatelessWidget {
  const _IndicatorDot({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 10.5, color: Color(0xFF757891), fontWeight: FontWeight.bold)),
      ],
    );
  }
}

class _AlertItem extends StatelessWidget {
  const _AlertItem({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.06),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.15)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5)),
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(fontSize: 11.5, color: Color(0xFF757891))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProcureItem extends StatelessWidget {
  const _ProcureItem({
    required this.name,
    required this.qty,
    required this.supplier,
    required this.date,
  });

  final String name;
  final String qty;
  final String supplier;
  final String date;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F7FA),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              const SizedBox(height: 2),
              Text('$supplier  •  $qty', style: const TextStyle(fontSize: 12, color: Color(0xFF757891))),
            ],
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: const Color(0xFFFFA733).withOpacity(0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              date,
              style: const TextStyle(color: Color(0xFFFFA733), fontSize: 11, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }
}
