import type { CSSProperties, ReactNode } from 'react';
import { Lock, X } from 'lucide-react';

export function Panel({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div>
        <p style={{ color: 'var(--text-primary)', fontWeight: 650, fontSize: 14 }}>{title}</p>
        {subtitle && <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled,
  title,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  type?: 'button' | 'submit';
  disabled?: boolean;
  title?: string;
  style?: CSSProperties;
}) {
  const styles = {
    primary: {
      background: 'var(--accent)',
      color: '#fff',
      border: '1px solid var(--accent)',
    },
    secondary: {
      background: 'var(--bg-card)',
      color: 'var(--text-secondary)',
      border: '1px solid var(--border)',
    },
    danger: {
      background: 'rgba(239,68,68,0.12)',
      color: 'var(--danger)',
      border: '1px solid rgba(239,68,68,0.24)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      border: '1px solid transparent',
    },
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        ...styles,
        minHeight: 36,
        padding: '8px 12px',
        borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        fontSize: 13,
        fontWeight: 650,
        opacity: disabled ? 0.55 : 1,
        transition: 'opacity 0.15s ease, transform 0.15s ease, border-color 0.15s ease',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 650, textTransform: 'uppercase' }}>
        {label}
      </span>
      {children}
      {hint && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{hint}</span>}
    </label>
  );
}

export const controlStyle: CSSProperties = {
  width: '100%',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text-primary)',
  minHeight: 38,
  padding: '8px 11px',
  outline: 'none',
  fontSize: 13,
};

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
}) {
  const colorMap = {
    neutral: ['var(--text-secondary)', 'var(--border)'],
    success: ['var(--success)', 'rgba(16,185,129,0.12)'],
    warning: ['var(--warning)', 'rgba(245,158,11,0.12)'],
    danger: ['var(--danger)', 'rgba(239,68,68,0.12)'],
    info: ['var(--info)', 'rgba(59,130,246,0.12)'],
    accent: ['var(--accent)', 'var(--accent-glow)'],
  }[tone];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 999,
        color: colorMap[0],
        background: colorMap[1],
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export function StatTile({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
}) {
  const color = {
    neutral: 'var(--text-primary)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
    accent: 'var(--accent)',
  }[tone];

  return (
    <Panel style={{ padding: '14px 16px' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 650 }}>
        {label}
      </p>
      <p style={{ color, fontWeight: 750, fontSize: 22, marginTop: 4, lineHeight: 1.2 }}>{value}</p>
      {detail && <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>{detail}</p>}
    </Panel>
  );
}

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  width = 520,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  width?: number;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.68)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        zIndex: 200,
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: width,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 24px 72px rgba(0,0,0,0.45)',
        }}
      >
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 14,
          }}
        >
          <div>
            <p style={{ color: 'var(--text-primary)', fontWeight: 750, fontSize: 16 }}>{title}</p>
            {subtitle && <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

export function ProGate({ message, onUpgrade }: { message: string; onUpgrade: () => void }) {
  return (
    <div
      style={{
        border: '1px solid rgba(245,158,11,0.25)',
        background: 'rgba(245,158,11,0.08)',
        borderRadius: 10,
        padding: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Lock size={16} color="var(--warning)" />
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{message}</p>
      </div>
      <Button onClick={onUpgrade}>Upgrade</Button>
    </div>
  );
}

export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'warning' | 'danger' | 'success' }) {
  const color = {
    accent: 'var(--accent)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
    success: 'var(--success)',
  }[tone];

  return (
    <div style={{ width: '100%', height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
      <div
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height: '100%',
          background: color,
          transition: 'width 0.2s ease',
        }}
      />
    </div>
  );
}
