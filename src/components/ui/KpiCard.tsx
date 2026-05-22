'use client';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { uiText } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: number;
  change: number;
  format?: 'currency' | 'number';
  icon?: React.ReactNode;
  delay?: number;
}

export function KpiCard({ label, value, change, format = 'currency', icon, delay = 0 }: KpiCardProps) {
  const language = useAppStore((state) => state.settings.language);
  const positive = change >= 0;
  const displayValue = format === 'currency' ? formatCurrency(value) : formatNumber(value);

  return (
    <div
      className="animate-fade-in"
      style={{
        animationDelay: `${delay}ms`,
        background: 'rgba(17, 24, 39, 0.45)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = 'var(--accent)';
        el.style.boxShadow = '0 4px 24px var(--accent-glow)';
        el.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = 'var(--border)';
        el.style.boxShadow = 'none';
        el.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </p>
        {icon && (
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--accent-glow)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
          }}>
            {icon}
          </div>
        )}
      </div>

      <div>
        <p style={{ color: 'var(--text-primary)', fontSize: 26, fontWeight: 700, lineHeight: 1, marginBottom: 8 }}>
          {displayValue}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {positive ? (
            <TrendingUp size={13} color="var(--success)" />
          ) : (
            <TrendingDown size={13} color="var(--danger)" />
          )}
          <span style={{ color: positive ? 'var(--success)' : 'var(--danger)', fontSize: 12, fontWeight: 600 }}>
            {formatPercent(change)}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{uiText(language, 'vs last period')}</span>
        </div>
      </div>
    </div>
  );
}
