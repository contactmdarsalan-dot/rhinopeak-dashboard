'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Archive,
  BarChart2,
  BellRing,
  Building2,
  Calculator,
  CreditCard,
  FileText,
  LayoutDashboard,
  MoreHorizontal,
  Package,
  PlusCircle,
  ReceiptText,
  ScanLine,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { translate, uiText } from '@/lib/i18n';
import { type ActivePage, useAppStore } from '@/lib/store';

const primaryItems = [
  { id: 'dashboard', href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { id: 'parties', href: '/parties', labelKey: 'nav.parties', icon: Building2 },
  { id: 'scan-bill', href: '/scan-bill', labelKey: 'nav.scanBill', icon: ScanLine },
  { id: 'inventory', href: '/inventory', labelKey: 'nav.inventory', icon: Package },
] as const;

const secondaryItems = [
  { id: 'quick-add', href: '/quick-add', labelKey: 'nav.quickAdd', icon: PlusCircle },
  { id: 'sales', href: '/sales', labelKey: 'nav.sales', icon: ShoppingCart },
  { id: 'purchases', href: '/purchases', labelKey: 'nav.purchases', icon: ReceiptText },
  { id: 'expenses', href: '/expenses', labelKey: 'nav.expenses', icon: WalletCards },
  { id: 'analytics', href: '/analytics', labelKey: 'nav.analytics', icon: BarChart2 },
  { id: 'customers', href: '/customers', labelKey: 'nav.customers', icon: Users },
  { id: 'cash-bank', href: '/cash-bank', labelKey: 'nav.cashBank', icon: CreditCard },
  { id: 'accounting', href: '/accounting', labelKey: 'nav.accounting', icon: Calculator },
  { id: 'documents', href: '/documents', labelKey: 'nav.documents', icon: Archive },
  { id: 'reminders', href: '/reminders', labelKey: 'nav.reminders', icon: BellRing },
  { id: 'reports', href: '/reports', labelKey: 'nav.reports', icon: FileText },
  { id: 'team', href: '/team', labelKey: 'nav.team', icon: ShieldCheck },
  { id: 'billing', href: '/billing', labelKey: 'nav.billing', icon: CreditCard },
  { id: 'settings', href: '/settings', labelKey: 'nav.settings', icon: Settings },
] as const;

export function MobileBottomNav() {
  const { canAccessPage, settings } = useAppStore();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const t = (key: Parameters<typeof translate>[1]) => translate(settings.language, key);

  const visiblePrimary = useMemo(
    () => primaryItems.filter((item) => canAccessPage(item.id as ActivePage)),
    [canAccessPage]
  );
  const visibleSecondary = useMemo(
    () => secondaryItems.filter((item) => canAccessPage(item.id as ActivePage)),
    [canAccessPage]
  );
  const secondaryActive = visibleSecondary.some((item) => pathname === item.href);

  return (
    <>
      {open && (
        <button
          type="button"
          className="mobile-nav-backdrop"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}
      <div className={`mobile-more-sheet ${open ? 'open' : ''}`}>
        <div className="mobile-more-header">
          <div>
            <p>{uiText(settings.language, 'More')}</p>
            <span>{uiText(settings.language, 'Reports, roles, billing, and settings')}</span>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <div className="mobile-more-grid">
          {visibleSecondary.map(({ id, href, labelKey, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={id}
                href={href}
                className={`mobile-more-item ${active ? 'active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <Icon size={18} />
                <span>{t(labelKey)}</span>
              </Link>
            );
          })}
        </div>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Mobile workspace navigation">
        {visiblePrimary.map(({ id, href, labelKey, icon: Icon }) => {
          const active = pathname === href;
          const centerAction = id === 'scan-bill';
          return (
            <Link key={id} href={href} className={`mobile-bottom-item ${centerAction ? 'mobile-scan-action' : ''} ${active ? 'active' : ''}`}>
              <span className="mobile-bottom-icon">
                <Icon size={centerAction ? 28 : 20} />
              </span>
              <span>{t(labelKey)}</span>
            </Link>
          );
        })}
        {!!visibleSecondary.length && (
          <button
            type="button"
            className={`mobile-bottom-item ${open || secondaryActive ? 'active' : ''}`}
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            <span className="mobile-bottom-icon">
              <MoreHorizontal size={20} />
            </span>
            <span>{uiText(settings.language, 'More')}</span>
          </button>
        )}
      </nav>
    </>
  );
}
