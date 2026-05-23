'use client';
import { useEffect, useMemo, useState } from 'react';
import { DollarSign, ShoppingBag, TrendingUp, UserPlus, BrainCircuit } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { KpiCard } from '@/components/ui/KpiCard';
import { RevenueChart, TopProductsChart, type RevenuePoint, type TopProductPoint } from '@/components/ui/Charts';
import { RecentSalesTable } from '@/components/ui/RecentSalesTable';
import { AlertsPanel } from '@/components/ui/AlertsPanel';
import { OnboardingWizard } from '@/components/ui/OnboardingWizard';
import { Badge, Panel, PanelHeader, ProgressBar, StatTile } from '@/components/ui/Primitives';
import { uiFormat, uiText } from '@/lib/i18n';
import { planLimits } from '@/lib/domain';
import { useAppStore } from '@/lib/store';
import { formatCurrency, formatPercent } from '@/lib/utils';

function monthKey(value: Date) {
  return value.toISOString().slice(0, 7);
}

export function DashboardPage() {
  const {
    sales,
    customers,
    inventory,
    plan,
    settings,
    setActivePage,
  } = useAppStore();
  const tx = (value: string) => uiText(settings.language, value);

  // Show onboarding wizard once for brand-new workspaces (no data yet)
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    const done = typeof window !== 'undefined' && localStorage.getItem('rhinopeak_onboarding_done');
    if (!done && sales.length === 0 && inventory.length === 0) {
      setShowOnboarding(true);
    }
  }, []); // intentionally run only once on mount


  const activeSales = useMemo(() => sales.filter((sale) => !sale.deletedAt), [sales]);
  const completedSales = useMemo(() => activeSales.filter((sale) => sale.status === 'Completed'), [activeSales]);

  const metrics = useMemo(() => {
    const current = new Date();
    const today = current.toISOString().slice(0, 10);
    const thisMonth = monthKey(current);
    const previousMonth = monthKey(new Date(current.getFullYear(), current.getMonth() - 1, 1));
    const currentMonthSales = completedSales.filter((sale) => sale.date.startsWith(thisMonth));
    const previousMonthSales = completedSales.filter((sale) => sale.date.startsWith(previousMonth));
    const monthlyRevenue = currentMonthSales.reduce((sum, sale) => sum + sale.amount, 0);
    const previousRevenue = previousMonthSales.reduce((sum, sale) => sum + sale.amount, 0);
    const growth = previousRevenue ? ((monthlyRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const todayRevenue = completedSales.filter((sale) => sale.date === today).reduce((sum, sale) => sum + sale.amount, 0);
    const ytdRevenue = completedSales
      .filter((sale) => sale.date.startsWith(String(current.getFullYear())))
      .reduce((sum, sale) => sum + sale.amount, 0);

    return {
      todayRevenue,
      monthlyRevenue,
      newCustomers: customers.filter((customer) => customer.lastOrder.startsWith(thisMonth)).length,
      totalOrders: activeSales.length,
      growth,
      ytdRevenue,
      averageOrderValue: currentMonthSales.length ? monthlyRevenue / currentMonthSales.length : 0,
    };
  }, [activeSales, completedSales, customers]);

  const revenueData = useMemo<RevenuePoint[]>(() => {
    return Array.from({ length: 30 }, (_, index) => {
      const date = subDays(new Date(), 29 - index);
      const key = date.toISOString().slice(0, 10);
      const previousKey = subDays(date, 30).toISOString().slice(0, 10);
      return {
        date: format(date, 'MMM dd'),
        current: completedSales.filter((sale) => sale.date === key).reduce((sum, sale) => sum + sale.amount, 0),
        previous: completedSales.filter((sale) => sale.date === previousKey).reduce((sum, sale) => sum + sale.amount, 0),
      };
    });
  }, [completedSales]);

  const topProducts = useMemo<TopProductPoint[]>(() => {
    const totals = new Map<string, TopProductPoint>();
    completedSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const existing = totals.get(item.productId) ?? { name: item.productName, revenue: 0, units: 0 };
        existing.revenue += item.quantity * item.unitPrice - item.discount + item.tax;
        existing.units += item.quantity;
        totals.set(item.productId, existing);
      });
    });

    return Array.from(totals.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, plan === 'free' ? 3 : 10);
  }, [completedSales, plan]);

  const activeMonthSales = activeSales.filter((sale) => sale.date.startsWith(new Date().toISOString().slice(0, 7))).length;
  const usage = Math.round((activeMonthSales / planLimits.salesEntries) * 100);
  const lowStock = inventory.filter((product) => product.status !== 'In Stock');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {showOnboarding && (
        <OnboardingWizard
          onClose={() => {
            setShowOnboarding(false);
            localStorage.setItem('rhinopeak_onboarding_done', '1');
          }}
        />
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        <KpiCard label={tx("Today's Revenue")} value={metrics.todayRevenue} change={0} format="currency" icon={<DollarSign size={15} />} delay={0} />
        <KpiCard label={tx('Monthly Revenue')} value={metrics.monthlyRevenue} change={metrics.growth} format="currency" icon={<TrendingUp size={15} />} delay={80} />
        <KpiCard label={tx('New Customers')} value={metrics.newCustomers} change={0} format="number" icon={<UserPlus size={15} />} delay={160} />
        <KpiCard label={tx('Total Orders')} value={metrics.totalOrders} change={0} format="number" icon={<ShoppingBag size={15} />} delay={240} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 0.65fr)',
          gap: 16,
        }}
      >
        <RevenueChart data={revenueData} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <StatTile label={tx('Year-to-date revenue')} value={formatCurrency(metrics.ytdRevenue)} detail={plan === 'pro' ? tx('Included in Pro KPI set') : tx('Preview from current data')} tone="accent" />
          <StatTile label={tx('Average order value')} value={formatCurrency(metrics.averageOrderValue)} detail={tx('Completed sales only')} tone="success" />
          <StatTile label={tx('Stock alerts')} value={lowStock.length} detail={tx('Products below threshold')} tone={lowStock.length ? 'danger' : 'success'} />
        </div>
      </div>

      {/* Quick Action: AI Bill Scanner Shortcut */}
      <Panel style={{
        padding: 16,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'var(--accent-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <BrainCircuit size={20} color="var(--accent)" />
            </div>
            <div>
              <p style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 15, margin: 0 }}>
                {tx('AI Smart Bill Scanner')}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '2px 0 0 0' }}>
                {tx('Instantly extract and post expense receipts, supplier bills, or sales invoices with custom character-level GPT.')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActivePage('scan-bill')}
            style={{
              border: 'none',
              borderRadius: 8,
              background: 'var(--accent)',
              color: 'var(--accent-contrast)',
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s ease',
            }}
          >
            <BrainCircuit size={15} /> {tx('Scan Bill')}
          </button>
        </div>
      </Panel>

      {plan === 'free' && (
        <Panel style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, marginBottom: 10, flexWrap: 'wrap' }}>
            <div>
              <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 14 }}>{tx('Free plan usage')}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {uiFormat(settings.language, '{count} of {limit} monthly sales entries used. Pro removes usage limits and unlocks reports, team roles, and comparison tools.', { count: activeMonthSales, limit: planLimits.salesEntries })}
              </p>
            </div>
            <button
              onClick={() => setActivePage('billing')}
              style={{ border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              {tx('Upgrade to Pro')}
            </button>
          </div>
          <ProgressBar value={usage} tone={usage >= 85 ? 'warning' : 'accent'} />
        </Panel>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 0.65fr)',
          gap: 16,
        }}
      >
        <RecentSalesTable />
        <TopProductsChart
          data={topProducts}
          subtitle={plan === 'free' ? 'Top 3 on Free plan' : 'Top products by revenue'}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16 }}>
        <AlertsPanel />
        <Panel>
          <PanelHeader title={tx('Executive Snapshot')} subtitle={tx('Current operating status')} />
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{tx('Week-over-week growth')}</span>
              <Badge tone={metrics.growth >= 0 ? 'success' : 'danger'}>{formatPercent(metrics.growth)}</Badge>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{tx('Plan')}</span>
              <Badge tone={plan === 'pro' ? 'success' : 'warning'}>{plan === 'pro' ? tx('Pro') : tx('Free')}</Badge>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{tx('Low stock items')}</span>
              <Badge tone={lowStock.length ? 'danger' : 'success'}>{lowStock.length}</Badge>
            </div>
            <button
              onClick={() => setActivePage('analytics')}
              style={{ marginTop: 6, border: '1px solid var(--border)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', padding: '8px 12px', cursor: 'pointer', fontWeight: 650 }}
            >
              {tx('Open Analytics')}
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
