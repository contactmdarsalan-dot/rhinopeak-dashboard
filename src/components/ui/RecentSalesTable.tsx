'use client';
import { Badge, Panel, PanelHeader } from '@/components/ui/Primitives';
import { useAppStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';

function statusTone(status: string) {
  if (status === 'Completed') return 'success';
  if (status === 'Pending') return 'warning';
  return 'danger';
}

export function RecentSalesTable() {
  const sales = useAppStore((state) => state.sales);
  const setActivePage = useAppStore((state) => state.setActivePage);
  const recent = sales.filter((sale) => !sale.deletedAt).slice(0, 10);

  return (
    <Panel>
      <PanelHeader
        title="Recent Sales"
        subtitle="Last 10 active transactions"
        action={
          <button
            onClick={() => setActivePage('sales')}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--accent)',
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: 650,
            }}
          >
            View All
          </button>
        }
      />

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Order', 'Customer', 'Products', 'Amount', 'Payment', 'Status', 'Date'].map((header) => (
                <th
                  key={header}
                  style={{
                    padding: '11px 16px',
                    color: 'var(--text-muted)',
                    fontSize: 11,
                    fontWeight: 650,
                    textAlign: 'left',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent.map((sale, index) => (
              <tr
                key={sale.id}
                style={{
                  borderBottom: index < recent.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(event) => (event.currentTarget.style.background = 'var(--bg-card-hover)')}
                onMouseLeave={(event) => (event.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}>{sale.id}</span>
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontSize: 13 }}>{sale.customer}</td>
                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 12 }}>{sale.products}</td>
                <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>
                  {formatCurrency(sale.amount)}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Badge>{sale.payment}</Badge>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Badge tone={statusTone(sale.status)}>{sale.status}</Badge>
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12 }}>{sale.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
