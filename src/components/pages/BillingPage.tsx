'use client';
import { Check, CreditCard, Download, Sparkles } from 'lucide-react';
import { Badge, Button, Panel, PanelHeader, ProgressBar, StatTile } from '@/components/ui/Primitives';
import { uiFormat, uiText } from '@/lib/i18n';
import { planLimits } from '@/lib/domain';
import { useAppStore } from '@/lib/store';
import { downloadCsv, formatCurrency } from '@/lib/utils';

const proFeatures = [
  'Unlimited sales, customers, and inventory products',
  'PDF-style reports, share links, and scheduled delivery',
  'RBAC team seats with dynamic roles and feature permissions',
  'Advanced analytics: comparison, heatmap, category breakdown',
  'Stripe, eSewa, and Khalti checkout options',
];

export function BillingPage() {
  const {
    plan,
    billingCycle,
    trialEndsAt,
    billingHistory,
    sales,
    customers,
    inventory,
    settings,
    upgradePlan,
    downgradePlan,
  } = useAppStore();
  const tx = (value: string) => uiText(settings.language, value);

  const month = new Date().toISOString().slice(0, 7);
  const salesUsage = sales.filter((sale) => !sale.deletedAt && sale.date.startsWith(month)).length;
  const customerUsage = customers.length;
  const productUsage = inventory.length;

  const invoiceRows = billingHistory.map((record) => ({
    id: record.id,
    description: record.description,
    gateway: record.gateway,
    amount: record.amount,
    date: record.date,
    status: record.status,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatTile label="Current plan" value={plan === 'pro' ? tx('Pro') : tx('Free')} tone={plan === 'pro' ? 'success' : 'warning'} detail={plan === 'pro' ? uiFormat(settings.language, '{cycle} billing', { cycle: tx(billingCycle) }) : uiFormat(settings.language, 'Trial preview ends {date}', { date: trialEndsAt })} />
        <StatTile label="Sales usage" value={`${salesUsage}/${plan === 'pro' ? tx('unlimited') : planLimits.salesEntries}`} tone={salesUsage > 80 && plan === 'free' ? 'warning' : 'accent'} />
        <StatTile label="Customer profiles" value={`${customerUsage}/${plan === 'pro' ? tx('unlimited') : planLimits.customerProfiles}`} />
        <StatTile label="Products" value={`${productUsage}/${plan === 'pro' ? tx('unlimited') : planLimits.products}`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.8fr) minmax(320px, 1fr)', gap: 16 }}>
        <Panel>
          <PanelHeader title="Free Plan" subtitle="For small teams starting with basic tracking" />
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ color: 'var(--text-primary)', fontSize: 28, fontWeight: 800 }}>NPR 0</p>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6 }}>{tx('Monthly sales entries')}</p>
              <ProgressBar value={(salesUsage / planLimits.salesEntries) * 100} tone={salesUsage > 80 ? 'warning' : 'accent'} />
            </div>
            {['4 KPI dashboard', '30-day revenue chart', 'Top 3 products', 'Low-stock alerts', 'Single owner seat'].map((feature) => (
              <p key={feature} style={{ color: 'var(--text-secondary)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                <Check size={14} color="var(--success)" /> {tx(feature)}
              </p>
            ))}
            {plan === 'pro' ? (
              <Button variant="secondary" onClick={downgradePlan}>Downgrade to Free</Button>
            ) : (
              <Badge tone="warning">Active plan</Badge>
            )}
          </div>
        </Panel>

        <Panel style={{ borderColor: plan === 'pro' ? 'var(--success)' : 'var(--accent)' }}>
          <PanelHeader title="Pro Plan" subtitle="NPR 1,499/month or NPR 14,990/year" action={<Badge tone={plan === 'pro' ? 'success' : 'accent'}>{plan === 'pro' ? 'Active' : 'Recommended'}</Badge>} />
          <div style={{ padding: 18, display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <p style={{ color: 'var(--text-primary)', fontSize: 30, fontWeight: 850 }}>NPR 1,499</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{tx('per month, annual discount available')}</p>
              </div>
              <Sparkles size={28} color="var(--accent)" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
              {proFeatures.map((feature) => (
                <p key={feature} style={{ color: 'var(--text-secondary)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Check size={14} color="var(--success)" style={{ marginTop: 2, flexShrink: 0 }} /> {tx(feature)}
                </p>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button onClick={() => upgradePlan('Stripe', 'monthly')}>
                <CreditCard size={14} /> Stripe Monthly
              </Button>
              <Button variant="secondary" onClick={() => upgradePlan('eSewa', 'monthly')}>eSewa</Button>
              <Button variant="secondary" onClick={() => upgradePlan('Khalti', 'annual')}>Khalti Annual</Button>
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Billing History"
          subtitle="Invoices and payment gateway audit trail"
          action={
            <Button variant="secondary" onClick={() => downloadCsv('rhinopeak-invoices.csv', invoiceRows)}>
              <Download size={14} /> Export
            </Button>
          }
        />
        <div style={{ overflowX: 'auto' }}>
          <table className="responsive-card-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Invoice', 'Description', 'Gateway', 'Amount', 'Date', 'Status'].map((header) => (
                  <th key={header} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 650, textAlign: 'left', textTransform: 'uppercase' }}>{tx(header)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {billingHistory.map((record, index) => (
                <tr key={record.id} style={{ borderBottom: index < billingHistory.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <td data-label={tx('Invoice')} data-card-primary="true" style={{ padding: '12px 14px', color: 'var(--accent)', fontWeight: 700, fontSize: 12 }}>{record.id}</td>
                  <td data-label={tx('Description')} style={{ padding: '12px 14px', color: 'var(--text-primary)', fontSize: 13 }}>{tx(record.description)}</td>
                  <td data-label={tx('Gateway')} style={{ padding: '12px 14px' }}><Badge>{record.gateway}</Badge></td>
                  <td data-label={tx('Amount')} style={{ padding: '12px 14px', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>{formatCurrency(record.amount)}</td>
                  <td data-label={tx('Date')} style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 12 }}>{record.date}</td>
                  <td data-label={tx('Status')} style={{ padding: '12px 14px' }}><Badge tone={record.status === 'Paid' ? 'success' : 'warning'}>{tx(record.status)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
