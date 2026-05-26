'use client';
import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, Info, X, XCircle } from 'lucide-react';
import { Panel, PanelHeader } from '@/components/ui/Primitives';
import { uiFormat, uiText } from '@/lib/i18n';
import { planLimits } from '@/lib/domain';
import { useAppStore } from '@/lib/store';

const severityConfig = {
  critical: { icon: XCircle, color: 'var(--danger)', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
  warning: { icon: AlertTriangle, color: 'var(--warning)', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  info: { icon: Info, color: 'var(--info)', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
};

type AlertItem = {
  id: string;
  severity: keyof typeof severityConfig;
  message: string;
};

export function AlertsPanel() {
  const { inventory, sales, plan, settings } = useAppStore();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const tx = useCallback((value: string) => uiText(settings.language, value), [settings.language]);

  const alerts = useMemo<AlertItem[]>(() => {
    const stockAlerts = settings.lowStockAlerts
      ? inventory
          .filter((product) => product.status !== 'In Stock')
          .map((product) => ({
            id: `stock-${product.id}`,
            severity: product.status === 'Out of Stock' ? 'critical' as const : 'warning' as const,
            message:
              product.status === 'Out of Stock'
                ? uiFormat(settings.language, '{name}: out of stock. Record stock-in or reorder from {supplier}.', { name: tx(product.name), supplier: tx(product.supplier) })
                : uiFormat(settings.language, '{name}: {stock} units left, threshold {threshold}.', { name: tx(product.name), stock: product.stock, threshold: product.reorderLevel }),
          }))
      : [];

    const month = new Date().toISOString().slice(0, 7);
    const usage = sales.filter((sale) => !sale.deletedAt && sale.date.startsWith(month)).length;
    const planAlert = plan === 'free' && usage >= planLimits.salesEntries * 0.8
      ? [{
          id: 'plan-usage',
          severity: 'info' as const,
          message: uiFormat(settings.language, 'Free plan usage: {usage}/{limit} sales entries this month. Upgrade before data entry is blocked.', { usage, limit: planLimits.salesEntries }),
        }]
      : [];

    return [...stockAlerts, ...planAlert];
  }, [inventory, plan, sales, settings.language, settings.lowStockAlerts, tx]);

  const visible = alerts.filter((alert) => !dismissed.includes(alert.id));

  if (!visible.length) {
    return (
      <Panel style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        {tx('All clear. No stock, usage, or notification alerts need attention.')}
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader title={tx('Alerts & Notifications')} subtitle={uiFormat(settings.language, '{count} items need attention', { count: visible.length })} />
      <div style={{ padding: 12 }}>
        {visible.map((alert) => {
          const cfg = severityConfig[alert.severity];
          const Icon = cfg.icon;
          return (
            <div
              key={alert.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 8,
                marginBottom: 8,
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
              }}
            >
              <Icon size={15} color={cfg.color} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5, flex: 1 }}>
                {alert.message}
              </p>
              <button
                onClick={() => setDismissed((items) => [...items, alert.id])}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  flexShrink: 0,
                  padding: 2,
                  lineHeight: 1,
                }}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
