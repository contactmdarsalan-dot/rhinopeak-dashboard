'use client';
import { Children, isValidElement, cloneElement, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { Lock, X } from 'lucide-react';
import { uiText } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';

function translateNode(language: Parameters<typeof uiText>[0], node: ReactNode): ReactNode {
  return Children.map(node, (child) => {
    if (typeof child === 'string') {
      const trimmed = child.trim();
      return trimmed ? child.replace(trimmed, uiText(language, trimmed)) : child;
    }
    if (Array.isArray(child)) return translateNode(language, child);
    if (isValidElement<{ children?: ReactNode }>(child) && child.props.children) {
      return cloneElement(child as ReactElement<{ children?: ReactNode }>, {
        children: translateNode(language, child.props.children),
      });
    }
    return child;
  });
}

export function Panel({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <section
      className={className}
      style={{
        background: 'var(--bg-card)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--border)',
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
  const language = useAppStore((state) => state.settings.language);
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
        <p style={{ color: 'var(--text-primary)', fontWeight: 650, fontSize: 14 }}>{uiText(language, title)}</p>
        {subtitle && <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{uiText(language, subtitle)}</p>}
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
  const language = useAppStore((state) => state.settings.language);
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
        padding: '8px 16px',
        borderRadius: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontSize: 13,
        fontWeight: 650,
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
        boxShadow: variant === 'primary' ? '0 2px 8px var(--accent-glow)' : 'none',
        ...style,
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(0.96)';
      }}
      onMouseUp={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(1)';
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {translateNode(language, children)}
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
  const language = useAppStore((state) => state.settings.language);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 650, textTransform: 'uppercase' }}>
        {uiText(language, label)}
      </span>
      {children}
      {hint && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{uiText(language, hint)}</span>}
    </label>
  );
}

export const controlStyle: CSSProperties = {
  width: '100%',
  background: 'var(--bg-card)',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'var(--border-subtle)',
  borderRadius: 10,
  color: 'var(--text-primary)',
  minHeight: 40,
  padding: '8px 12px',
  outline: 'none',
  fontSize: 13,
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
};

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
}) {
  const language = useAppStore((state) => state.settings.language);
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
      {translateNode(language, children)}
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
  const language = useAppStore((state) => state.settings.language);
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
        {uiText(language, label)}
      </p>
      <p style={{ color, fontWeight: 750, fontSize: 22, marginTop: 4, lineHeight: 1.2 }}>{value}</p>
      {detail && <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>{uiText(language, detail)}</p>}
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
  const language = useAppStore((state) => state.settings.language);
  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        zIndex: 200,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div
        className="modal-card"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: width,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-popover)',
        }}
      >
        <div
          className="modal-header"
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
            <p style={{ color: 'var(--text-primary)', fontWeight: 750, fontSize: 16 }}>{uiText(language, title)}</p>
            {subtitle && <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{uiText(language, subtitle)}</p>}
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
        <div className="modal-body" style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

export function ProGate({ message, onUpgrade }: { message: string; onUpgrade: () => void }) {
  const language = useAppStore((state) => state.settings.language);
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
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{uiText(language, message)}</p>
      </div>
      <Button onClick={onUpgrade}>{uiText(language, 'Upgrade')}</Button>
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
