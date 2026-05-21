'use client';
import { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { RevenueChart, type RevenuePoint } from '@/components/ui/Charts';
import { Badge, Panel, PanelHeader, ProGate, StatTile, controlStyle } from '@/components/ui/Primitives';
import type { CustomerSegment } from '@/lib/domain';
import { translateCustomerSegment, uiText } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';

const pieColors = ['#6366f1', '#22d3ee', '#10b981', '#f59e0b', '#ef4444'];

export function AnalyticsPage() {
  const { sales, customers, inventory, plan, settings, setActivePage } = useAppStore();
  const tx = (value: string) => uiText(settings.language, value);
  const [range, setRange] = useState('30');
  const [category, setCategory] = useState('All');
  const [segment, setSegment] = useState('All');

  const completedSales = useMemo(() => sales.filter((sale) => !sale.deletedAt && sale.status === 'Completed'), [sales]);
  const cutoff = subDays(new Date(), Number(range));
  const scopedSales = completedSales.filter((sale) => new Date(sale.date) >= cutoff);
  const categories = ['All', ...Array.from(new Set(inventory.map((product) => product.category)))];
  const segments: Array<'All' | CustomerSegment> = ['All', ...Array.from(new Set(customers.map((customer) => customer.segment)))];

  const filteredSales = useMemo(() => {
    return scopedSales.filter((sale) => {
      const customer = customers.find((item) => item.id === sale.customerId);
      const matchesSegment = segment === 'All' || customer?.segment === segment;
      const matchesCategory = category === 'All' || sale.items.some((item) => inventory.find((product) => product.id === item.productId)?.category === category);
      return matchesSegment && matchesCategory;
    });
  }, [category, customers, inventory, scopedSales, segment]);

  const revenueData = useMemo<RevenuePoint[]>(() => {
    const days = Math.min(Number(range), 90);
    return Array.from({ length: days }, (_, index) => {
      const date = subDays(new Date(), days - 1 - index);
      const key = date.toISOString().slice(0, 10);
      const previousKey = subDays(date, days).toISOString().slice(0, 10);
      return {
        date: format(date, 'MMM dd'),
        current: filteredSales.filter((sale) => sale.date === key).reduce((sum, sale) => sum + sale.amount, 0),
        previous: completedSales.filter((sale) => sale.date === previousKey).reduce((sum, sale) => sum + sale.amount, 0),
      };
    });
  }, [completedSales, filteredSales, range]);

  const productRows = useMemo(() => {
    const totals = new Map<string, { name: string; revenue: number; units: number; cost: number }>();
    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const product = inventory.find((entry) => entry.id === item.productId);
        const existing = totals.get(item.productId) ?? { name: item.productName, revenue: 0, units: 0, cost: 0 };
        existing.revenue += item.quantity * item.unitPrice - item.discount + item.tax;
        existing.units += item.quantity;
        existing.cost += item.quantity * (product?.costPrice ?? 0);
        totals.set(item.productId, existing);
      });
    });
    return Array.from(totals.values())
      .map((row) => ({
        ...row,
        margin: row.revenue ? ((row.revenue - row.cost) / row.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, inventory]);

  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    productRows.forEach((row) => {
      const product = inventory.find((entry) => entry.name === row.name);
      const itemCategory = product?.category ?? 'Other';
      totals.set(itemCategory, (totals.get(itemCategory) ?? 0) + row.revenue);
    });
    return Array.from(totals.entries()).map(([name, value]) => ({ name, value }));
  }, [inventory, productRows]);

  const customerSplit = useMemo(() => {
    const repeat = customers.filter((customer) => customer.orders > 1).length;
    const fresh = Math.max(0, customers.length - repeat);
    return [
      { name: 'Repeat Customers', value: repeat },
      { name: 'New Customers', value: fresh },
    ];
  }, [customers]);

  const ltvBuckets = useMemo(() => {
    const buckets = [
      { label: '< NPR 25K', min: 0, max: 25000 },
      { label: '25K-100K', min: 25000, max: 100000 },
      { label: '100K-250K', min: 100000, max: 250000 },
      { label: '250K+', min: 250000, max: Infinity },
    ];
    return buckets.map((bucket) => ({
      ...bucket,
      count: customers.filter((customer) => customer.totalSpent >= bucket.min && customer.totalSpent < bucket.max).length,
    }));
  }, [customers]);

  const heatmap = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const hours = Array.from({ length: 12 }, (_, index) => `${index + 8}:00`);
    const totals = new Map<string, number>();

    filteredSales.forEach((sale) => {
      const createdLine = sale.auditTrail.find((line) => line.toLowerCase().includes('created'));
      const createdMatch = createdLine?.match(/(\d{4}-\d{2}-\d{2}),?\s+(\d{1,2}):/);
      const createdAt = createdMatch
        ? new Date(`${createdMatch[1]}T${createdMatch[2].padStart(2, '0')}:00:00`)
        : new Date(`${sale.date}T12:00:00`);
      const day = days[(createdAt.getDay() + 6) % 7];
      const hour = `${Math.min(19, Math.max(8, createdAt.getHours()))}:00`;
      const key = `${day}-${hour}`;
      totals.set(key, (totals.get(key) ?? 0) + sale.amount);
    });

    return days.flatMap((day) => (
      hours.map((hour) => ({
        day,
        hour,
        value: totals.get(`${day}-${hour}`) ?? 0,
      }))
    ));
  }, [filteredSales]);

  const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalCost = productRows.reduce((sum, row) => sum + row.cost, 0);
  const margin = totalRevenue ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Panel style={{ padding: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={range} onChange={(event) => setRange(event.target.value)} style={{ ...controlStyle, width: 150 }}>
          <option value="7">{tx('Last 7 days')}</option>
          <option value="30">{tx('Last 30 days')}</option>
          <option value="90">{tx('Last 90 days')}</option>
        </select>
        <select value={category} onChange={(event) => setCategory(event.target.value)} style={{ ...controlStyle, width: 170 }}>
          {categories.map((item) => <option key={item} value={item}>{item === 'All' ? tx('All') : item}</option>)}
        </select>
        <select value={segment} onChange={(event) => setSegment(event.target.value)} style={{ ...controlStyle, width: 170 }}>
          {segments.map((item) => <option key={item} value={item}>{translateCustomerSegment(settings.language, item)}</option>)}
        </select>
        {plan === 'free' && <Badge tone="warning">Free: 30-day analytics only</Badge>}
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatTile label="Revenue" value={formatCurrency(totalRevenue)} tone="accent" />
        <StatTile label="Units sold" value={productRows.reduce((sum, row) => sum + row.units, 0)} tone="success" />
        <StatTile label="Profit margin" value={`${margin.toFixed(1)}%`} tone={margin > 30 ? 'success' : 'warning'} />
        <StatTile label="Products ranked" value={productRows.length} />
      </div>

      <RevenueChart data={revenueData} title="Revenue Trend" subtitle="Current period with comparison toggle" defaultComparison={plan === 'pro'} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(280px, 0.55fr)', gap: 16 }}>
        <Panel>
          <PanelHeader title="Product Performance" subtitle="Revenue, units sold, and profit margin" />
          <div style={{ overflowX: 'auto' }}>
            <table className="responsive-card-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Rank', 'Product', 'Revenue', 'Units', 'Margin'].map((header) => (
                    <th key={header} style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 650, textAlign: 'left', textTransform: 'uppercase' }}>{tx(header)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productRows.map((product, index) => (
                  <tr key={product.name} style={{ borderBottom: index < productRows.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <td data-label={tx('Rank')} data-card-primary="true" style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 12 }}>#{index + 1}</td>
                    <td data-label={tx('Product')} style={{ padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}>{product.name}</td>
                    <td data-label={tx('Revenue')} style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>{formatCurrency(product.revenue)}</td>
                    <td data-label={tx('Units')} style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 13 }}>{product.units}</td>
                    <td data-label={tx('Margin')} style={{ padding: '10px 14px' }}><Badge tone={product.margin > 35 ? 'success' : 'warning'}>{product.margin.toFixed(1)}%</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel style={{ padding: '18px 20px' }}>
          <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 14 }}>{tx('Revenue by Category')}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 14 }}>{tx('Pro breakdown from current filters')}</p>
          {plan !== 'pro' ? (
            <ProGate message="Category analytics are available on Pro." onUpgrade={() => setActivePage('billing')} />
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={categoryBreakdown} cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3} dataKey="value">
                  {categoryBreakdown.map((_, index) => <Cell key={index} fill={pieColors[index % pieColors.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => [formatCurrency(Number(value ?? 0)), tx('Revenue')]} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 0.55fr) minmax(0,1fr)', gap: 16 }}>
        <Panel style={{ padding: '18px 20px' }}>
          <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 14 }}>{tx('Customer Split')}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 14 }}>{tx('Repeat vs new customers')}</p>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={customerSplit} cx="50%" cy="50%" innerRadius={48} outerRadius={76} paddingAngle={3} dataKey="value">
                {customerSplit.map((_, index) => <Cell key={index} fill={pieColors[index]} />)}
              </Pie>
              <Tooltip formatter={(value) => [`${Number(value ?? 0)} ${tx('customers')}`]} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel>
          <PanelHeader title="Customer Lifetime Value" subtitle="Histogram-style distribution" />
          <div style={{ padding: 18, display: 'grid', gap: 12 }}>
            {ltvBuckets.map((bucket) => (
              <div key={bucket.label} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 28px', gap: 10, alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{bucket.label}</span>
                <div style={{ height: 10, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ width: `${(bucket.count / Math.max(1, customers.length)) * 100}%`, height: '100%', background: 'var(--accent)' }} />
                </div>
                <strong style={{ color: 'var(--text-primary)', fontSize: 12 }}>{bucket.count}</strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel style={{ position: 'relative', padding: '18px 20px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
          <div>
            <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 14 }}>{tx('Sales Heatmap')}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{tx('Revenue by weekday and sale creation hour')}</p>
          </div>
          <Badge tone="warning">PRO</Badge>
        </div>
        {plan !== 'pro' && (
          <div style={{ position: 'absolute', inset: 0, top: 64, zIndex: 2, backdropFilter: 'blur(6px)', background: 'rgba(10,10,15,0.58)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <ProGate message="Unlock hourly heatmaps and comparison analytics with Pro." onUpgrade={() => setActivePage('billing')} />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(28px, 1fr))', gap: 4 }}>
          {heatmap.map((cell) => {
            const opacity = cell.value ? Math.min(0.95, Math.max(0.2, cell.value / 6500)) : 0.06;
            return (
              <div key={`${cell.day}-${cell.hour}`} title={`${cell.day} ${cell.hour}: ${formatCurrency(cell.value)}`} style={{ height: 26, borderRadius: 4, background: `rgba(99,102,241,${opacity})` }} />
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
