'use client';
import {
  LayoutDashboard, ShoppingCart, BarChart2, Users,
  Package, FileText, Settings, ChevronLeft, Zap, CreditCard, ShieldCheck,
} from 'lucide-react';
import { type ActivePage, useAppStore } from '@/lib/store';
import { translate } from '@/lib/i18n';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { id: 'dashboard', href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { id: 'sales', href: '/sales', labelKey: 'nav.sales', icon: ShoppingCart },
  { id: 'analytics', href: '/analytics', labelKey: 'nav.analytics', icon: BarChart2 },
  { id: 'customers', href: '/customers', labelKey: 'nav.customers', icon: Users },
  { id: 'inventory', href: '/inventory', labelKey: 'nav.inventory', icon: Package },
  { id: 'reports', href: '/reports', labelKey: 'nav.reports', icon: FileText },
  { id: 'team', href: '/team', labelKey: 'nav.team', icon: ShieldCheck },
  { id: 'billing', href: '/billing', labelKey: 'nav.billing', icon: CreditCard },
] as const;

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, plan, canAccessPage, settings } = useAppStore();
  const pathname = usePathname();
  const visibleNavItems = NAV_ITEMS.filter((item) => canAccessPage(item.id as ActivePage));
  const t = (key: Parameters<typeof translate>[1]) => translate(settings.language, key);

  return (
    <aside
      style={{
        width: sidebarCollapsed ? 64 : 220,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        transition: 'width 0.25s ease',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: sidebarCollapsed ? '20px 16px' : '20px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 64,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #22d3ee)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 12px rgba(99,102,241,0.4)',
          }}
        >
          <Zap size={16} color="#fff" fill="#fff" />
        </div>
        {!sidebarCollapsed && (
          <div style={{ overflow: 'hidden' }}>
            <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 14, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
              RhinoPeak
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 10, whiteSpace: 'nowrap' }}>{t('app.subtitle')}</p>
            <p style={{ color: plan === 'pro' ? 'var(--success)' : 'var(--warning)', fontSize: 10, whiteSpace: 'nowrap', fontWeight: 700 }}>
              {plan === 'pro' ? t('workspace.pro') : t('workspace.free')}
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {visibleNavItems.map(({ id, href, labelKey, icon: Icon }) => {
          const active = pathname === href;
          const label = t(labelKey);
          return (
            <Link
              key={id}
              href={href}
              title={sidebarCollapsed ? label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: sidebarCollapsed ? '10px 16px' : '10px 12px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                marginBottom: 2,
                background: active ? 'var(--accent-glow)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'var(--border-subtle)';
                  (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                  (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)';
                }
              }}
            >
              {active && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  width: 3,
                  height: 28,
                  background: 'var(--accent)',
                  borderRadius: '0 4px 4px 0',
                  marginLeft: 0,
                }} />
              )}
              <Icon size={18} strokeWidth={active ? 2 : 1.5} style={{ flexShrink: 0 }} />
              {!sidebarCollapsed && (
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }}>
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Settings + Collapse */}
      <div style={{ padding: '8px', borderTop: '1px solid var(--border)' }}>
        {canAccessPage('settings') && (
        <Link
          href="/settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: sidebarCollapsed ? '10px 16px' : '10px 12px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            marginBottom: 4,
            background: pathname === '/settings' ? 'var(--accent-glow)' : 'transparent',
            color: pathname === '/settings' ? 'var(--accent)' : 'var(--text-secondary)',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            transition: 'all 0.15s ease',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => {
            if (pathname !== '/settings') {
              (e.currentTarget as HTMLAnchorElement).style.background = 'var(--border-subtle)';
              (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (pathname !== '/settings') {
              (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
              (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)';
            }
          }}
        >
          <Settings size={18} strokeWidth={1.5} />
          {!sidebarCollapsed && <span style={{ fontSize: 13 }}>{t('nav.settings')}</span>}
        </Link>
        )}
        <button
          onClick={toggleSidebar}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: sidebarCollapsed ? '10px 16px' : '10px 12px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            color: 'var(--text-muted)',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            transition: 'all 0.15s ease',
          }}
        >
          <ChevronLeft
            size={18}
            style={{
              transform: sidebarCollapsed ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.25s ease',
            }}
          />
          {!sidebarCollapsed && <span style={{ fontSize: 13 }}>{t('nav.collapse')}</span>}
        </button>
      </div>
    </aside>
  );
}
