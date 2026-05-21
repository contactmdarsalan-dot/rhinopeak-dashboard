'use client';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useState } from 'react';
import { uiText } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { formatCompactCurrency, formatCurrency } from '@/lib/utils';
import { Panel } from '@/components/ui/Primitives';

const ACCENT = '#6366f1';
const CYAN = '#22d3ee';
const BORDER = '#232333';

export interface RevenuePoint {
  date: string;
  current: number;
  previous: number;
}

export interface TopProductPoint {
  name: string;
  revenue: number;
  units: number;
}

interface TooltipPayload {
  name: string;
  color: string;
  value: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  const language = useAppStore((state) => state.settings.language);
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 14px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
      }}
    >
      <p style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 6 }}>{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color, fontSize: 13, fontWeight: 650 }}>
          {entry.name === 'current' ? `${uiText(language, 'This period')}: ` : `${uiText(language, 'Last period')}: `}
          {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function RevenueChart({
  data,
  title = 'Revenue Trend',
  subtitle = 'Last 30 days',
  comparisonLabel = 'vs Previous',
  defaultComparison = false,
}: {
  data: RevenuePoint[];
  title?: string;
  subtitle?: string;
  comparisonLabel?: string;
  defaultComparison?: boolean;
}) {
  const [showPrev, setShowPrev] = useState(defaultComparison);
  const language = useAppStore((state) => state.settings.language);
  const tx = (value: string) => uiText(language, value);

  return (
    <Panel style={{ padding: '20px 24px', minHeight: 300 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <div>
          <p style={{ color: 'var(--text-primary)', fontWeight: 650, fontSize: 14 }}>{tx(title)}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{tx(subtitle)}</p>
        </div>
        <button
          onClick={() => setShowPrev(!showPrev)}
          style={{
            padding: '5px 12px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: showPrev ? 'var(--accent-glow)' : 'transparent',
            color: showPrev ? 'var(--accent)' : 'var(--text-secondary)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {tx(comparisonLabel)}
        </button>
      </div>
      <ResponsiveContainer width="100%" height={218}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="gradCurrent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={ACCENT} stopOpacity={0.3} />
              <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradPrev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CYAN} stopOpacity={0.2} />
              <stop offset="95%" stopColor={CYAN} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#777794', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: '#777794', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => formatCompactCurrency(Number(value)).replace('NPR ', '')} />
          <Tooltip content={<CustomTooltip />} />
          {showPrev && (
            <Area type="monotone" dataKey="previous" stroke={CYAN} strokeWidth={1.5} fill="url(#gradPrev)" strokeDasharray="4 4" dot={false} />
          )}
          <Area type="monotone" dataKey="current" stroke={ACCENT} strokeWidth={2} fill="url(#gradCurrent)" dot={false} activeDot={{ r: 4, fill: ACCENT }} />
        </AreaChart>
      </ResponsiveContainer>
    </Panel>
  );
}

export function TopProductsChart({
  data,
  title = 'Top Products',
  subtitle = 'By revenue this month',
}: {
  data: TopProductPoint[];
  title?: string;
  subtitle?: string;
}) {
  const language = useAppStore((state) => state.settings.language);
  const tx = (value: string) => uiText(language, value);

  return (
    <Panel style={{ padding: '20px 24px', minHeight: 300 }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ color: 'var(--text-primary)', fontWeight: 650, fontSize: 14 }}>{tx(title)}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{tx(subtitle)}</p>
      </div>
      <ResponsiveContainer width="100%" height={218}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
          <XAxis type="number" tick={{ fill: '#777794', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => formatCompactCurrency(Number(value)).replace('NPR ', '')} />
          <YAxis dataKey="name" type="category" tick={{ fill: '#aaaac0', fontSize: 11 }} tickLine={false} axisLine={false} width={122} />
          <Tooltip
            formatter={(value) => [formatCurrency(Number(value ?? 0)), tx('Revenue')]}
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--text-muted)' }}
            itemStyle={{ color: ACCENT }}
          />
          <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.map((_, index) => (
              <Cell key={index} fill={`rgba(99,102,241,${Math.max(0.25, 1 - index * 0.13)})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  );
}
