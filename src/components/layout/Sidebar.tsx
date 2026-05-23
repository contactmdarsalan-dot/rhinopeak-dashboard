'use client';
import {
  LayoutDashboard, ShoppingCart, BarChart2, Users, Calculator,
  Package, FileText, Settings, ChevronLeft, Zap, CreditCard, ShieldCheck,
  PlusCircle, ReceiptText, WalletCards, Archive, BellRing, Building2,
  BrainCircuit,
} from 'lucide-react';
import { type ActivePage, useAppStore } from '@/lib/store';
import { translate } from '@/lib/i18n';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavCategory = { category: string; items: { id: string; href: string; labelKey: string; icon: React.ElementType }[] };

const NAV_GROUPS: NavCategory[] = [
  {
    category: 'Workspace',
    items: [
      { id: 'dashboard', href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
      { id: 'quick-add', href: '/quick-add', labelKey: 'nav.quickAdd', icon: PlusCircle },
      { id: 'scan-bill', href: '/scan-bill', labelKey: 'nav.scanBill', icon: BrainCircuit },
      { id: 'analytics', href: '/analytics', labelKey: 'nav.analytics', icon: BarChart2 },
    ],
  },
  {
    category: 'Sales & Inventory',
    items: [
      { id: 'sales', href: '/sales', labelKey: 'nav.sales', icon: ShoppingCart },
      { id: 'purchases', href: '/purchases', labelKey: 'nav.purchases', icon: ReceiptText },
      { id: 'inventory', href: '/inventory', labelKey: 'nav.inventory', icon: Package },
    ],
  },
  {
    category: 'Finance & Accounts',
    items: [
      { id: 'expenses', href: '/expenses', labelKey: 'nav.expenses', icon: WalletCards },
      { id: 'cash-bank', href: '/cash-bank', labelKey: 'nav.cashBank', icon: CreditCard },
      { id: 'accounting', href: '/accounting', labelKey: 'nav.accounting', icon: Calculator },
    ],
  },
  {
    category: 'Relations',
    items: [
      { id: 'parties', href: '/parties', labelKey: 'nav.parties', icon: Building2 },
      { id: 'customers', href: '/customers', labelKey: 'nav.customers', icon: Users },
      { id: 'team', href: '/team', labelKey: 'nav.team', icon: ShieldCheck },
    ],
  },
  {
    category: 'Tools',
    items: [
      { id: 'documents', href: '/documents', labelKey: 'nav.documents', icon: Archive },
      { id: 'reminders', href: '/reminders', labelKey: 'nav.reminders', icon: BellRing },
      { id: 'reports', href: '/reports', labelKey: 'nav.reports', icon: FileText },
      { id: 'billing', href: '/billing', labelKey: 'nav.billing', icon: CreditCard },
    ]
  }
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, plan, canAccessPage, settings } = useAppStore();
  const pathname = usePathname();
  const t = (key: Parameters<typeof translate>[1]) => translate(settings.language, key);

  return (
    <aside
      style={{
        width: sidebarCollapsed ? 64 : 220,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        boxShadow: '1px 0 12px rgba(0,0,0,0.02)',
        transition: 'width 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
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
            background: 'linear-gradient(135deg, #7c3aed, #d946ef)',
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
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(item => canAccessPage(item.id as ActivePage));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.category} style={{ marginBottom: sidebarCollapsed ? 8 : 16 }}>
              {!sidebarCollapsed && (
                <p style={{
                  padding: '0 12px',
                  marginBottom: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: 'var(--text-muted)'
                }}>
                  {group.category}
                </p>
              )}
              {visibleItems.map(({ id, href, labelKey, icon: Icon }) => {
                const active = pathname === href;
                const label = t(labelKey as Parameters<typeof translate>[1]);
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
                      padding: sidebarCollapsed ? '10px 16px' : '9px 12px',
                      borderRadius: 10,
                      border: 'none',
                      cursor: 'pointer',
                      marginBottom: 2,
                      background: active ? 'var(--accent-glow)' : 'transparent',
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      transition: 'background 0.2s ease, color 0.2s ease, transform 0.1s ease',
                      justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                      textDecoration: 'none',
                      position: 'relative',
                      boxShadow: active ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-card-hover)';
                        (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                        (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)';
                      }
                    }}
                    onMouseDown={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(0.98)';
                    }}
                    onMouseUp={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)';
                    }}
                  >
                    {active && (
                      <div style={{
                        position: 'absolute',
                        left: -8,
                        width: 4,
                        height: 20,
                        background: 'var(--accent)',
                        borderRadius: '0 4px 4px 0',
                      }} />
                    )}
                    <Icon size={18} strokeWidth={active ? 2.5 : 1.5} style={{ flexShrink: 0, color: active ? 'var(--accent)' : 'inherit' }} />
                    {!sidebarCollapsed && (
                      <span style={{ fontSize: 13, fontWeight: active ? 650 : 500, whiteSpace: 'nowrap' }}>
                        {label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
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
