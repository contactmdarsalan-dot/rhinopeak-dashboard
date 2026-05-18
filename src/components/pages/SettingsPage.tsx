'use client';
import { FormEvent, useMemo, useState } from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Field, Modal, Panel, PanelHeader, ProGate, controlStyle } from '@/components/ui/Primitives';
import { languageName, translate } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { downloadTextFile } from '@/lib/utils';

function Toggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        cursor: 'pointer',
        background: active ? 'var(--accent)' : 'var(--border)',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 3,
          left: active ? 23 : 3,
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  );
}

function SettingRow({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 220 }}>
        <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}>{label}</p>
        {desc && <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>{desc}</p>}
      </div>
      <div style={{ minWidth: 180 }}>{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const {
    theme,
    toggleTheme,
    settings,
    updateSettings,
    plan,
    setActivePage,
    businesses,
    addBusiness,
    sales,
    customers,
    inventory,
    reports,
    auditLogs,
    deleteAccount,
  } = useAppStore();
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const t = (key: Parameters<typeof translate>[1]) => translate(settings.language, key);

  const accountExport = useMemo(() => JSON.stringify({
    settings,
    businesses,
    sales,
    customers,
    inventory,
    reports,
    auditLogs,
    exportedAt: new Date().toISOString(),
  }, null, 2), [auditLogs, businesses, customers, inventory, reports, sales, settings]);

  const submitBusiness = (event: FormEvent) => {
    event.preventDefault();
    const ok = addBusiness(businessName, category, address);
    if (ok) {
      setShowBusinessModal(false);
      setBusinessName('');
      setCategory('');
      setAddress('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 880 }}>
      <Panel>
        <PanelHeader title={t('settings.businessProfile')} subtitle={t('settings.businessProfileCopy')} />
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <SettingRow label={t('settings.businessName')} desc="Primary organization display name">
            <input value={settings.businessName} onChange={(event) => updateSettings({ businessName: event.target.value })} style={controlStyle} />
          </SettingRow>
          <SettingRow label={t('settings.currency')} desc="Primary display currency">
            <select value={settings.currency} onChange={(event) => updateSettings({ currency: event.target.value as typeof settings.currency })} style={controlStyle}>
              <option>NPR</option>
              <option>USD</option>
              <option>EUR</option>
            </select>
          </SettingRow>
          <SettingRow label={t('settings.language')} desc={t('settings.languageCopy')}>
            <select value={settings.language} onChange={(event) => updateSettings({ language: event.target.value as typeof settings.language })} style={controlStyle}>
              {(['en', 'ne'] as const).map((language) => <option key={language} value={language}>{languageName(language)}</option>)}
            </select>
          </SettingRow>
          <SettingRow label={t('settings.timezone')} desc="Used for reports, audit logs, and daily close">
            <input value={settings.timezone} onChange={(event) => updateSettings({ timezone: event.target.value })} style={controlStyle} />
          </SettingRow>
          <SettingRow label={t('settings.fiscalYear')} desc="Used for yearly summaries">
            <select value={settings.fiscalYearStart} onChange={(event) => updateSettings({ fiscalYearStart: event.target.value as typeof settings.fiscalYearStart })} style={controlStyle}>
              {['January', 'April', 'July', 'October'].map((month) => <option key={month}>{month}</option>)}
            </select>
          </SettingRow>
          <SettingRow label={t('settings.taxRate')} desc="Default percentage applied to new invoice workflows">
            <input type="number" min={0} max={100} value={settings.taxRate} onChange={(event) => updateSettings({ taxRate: Number(event.target.value) })} style={controlStyle} />
          </SettingRow>
          <SettingRow label={t('settings.invoicePrefix')} desc="Used for future invoice numbering">
            <input value={settings.invoicePrefix} onChange={(event) => updateSettings({ invoicePrefix: event.target.value })} style={controlStyle} />
          </SettingRow>
          <SettingRow label={t('settings.defaultPayment')} desc="Default method for new sales">
            <select value={settings.defaultPaymentMethod} onChange={(event) => updateSettings({ defaultPaymentMethod: event.target.value as typeof settings.defaultPaymentMethod })} style={controlStyle}>
              {['Cash', 'Card', 'eSewa', 'FonePay', 'Khalti', 'Bank'].map((method) => <option key={method}>{method}</option>)}
            </select>
          </SettingRow>
          <SettingRow label={t('settings.receiptFooter')} desc="Shown on exported receipts and invoices">
            <input value={settings.receiptFooter} onChange={(event) => updateSettings({ receiptFooter: event.target.value })} style={controlStyle} />
          </SettingRow>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div>
              <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>Multi-business accounts</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>{businesses.length} businesses connected</p>
            </div>
            <Button variant="secondary" onClick={() => plan === 'pro' ? setShowBusinessModal(true) : setActivePage('billing')}>
              <Plus size={14} /> Add Business
            </Button>
          </div>
          {plan !== 'pro' && <ProGate message="Multiple businesses are a Pro feature." onUpgrade={() => setActivePage('billing')} />}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title={t('settings.appearance')} subtitle={t('settings.appearanceCopy')} />
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <SettingRow label={t('settings.darkMode')} desc="Theme preference persists in local storage">
            <Toggle active={theme === 'dark'} onToggle={toggleTheme} />
          </SettingRow>
          <SettingRow label={t('settings.compactTables')} desc="Reduce table row padding for data-heavy views">
            <Toggle active={settings.compactTables} onToggle={() => updateSettings({ compactTables: !settings.compactTables })} />
          </SettingRow>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title={t('settings.security')} subtitle={t('settings.securityCopy')} />
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <SettingRow label={t('settings.twoFactor')} desc="Simulated Pro 2FA enforcement toggle">
            <Toggle active={settings.twoFactorEnabled} onToggle={() => plan === 'pro' ? updateSettings({ twoFactorEnabled: !settings.twoFactorEnabled }) : setActivePage('billing')} />
          </SettingRow>
          <SettingRow label={t('settings.lowStock')} desc="Show in-app notifications below threshold">
            <Toggle active={settings.lowStockAlerts} onToggle={() => updateSettings({ lowStockAlerts: !settings.lowStockAlerts })} />
          </SettingRow>
          <SettingRow label={t('settings.dailySales')} desc="Daily digest at 6pm">
            <Toggle active={settings.dailySalesSummary} onToggle={() => updateSettings({ dailySalesSummary: !settings.dailySalesSummary })} />
          </SettingRow>
          <SettingRow label={t('settings.newCustomer')} desc="Notify when new CRM profiles are created">
            <Toggle active={settings.newCustomerSignup} onToggle={() => updateSettings({ newCustomerSignup: !settings.newCustomerSignup })} />
          </SettingRow>
          <SettingRow label={t('settings.scheduledReports')} desc="Automatic monthly email report delivery">
            <Toggle active={settings.scheduledReports} onToggle={() => plan === 'pro' ? updateSettings({ scheduledReports: !settings.scheduledReports }) : setActivePage('billing')} />
          </SettingRow>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title={t('settings.accountData')} subtitle={t('settings.accountDataCopy')} action={<Badge tone="info">Workspace</Badge>} />
        <div style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>Export or delete workspace data</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Includes sales, customers, inventory, reports, settings, and audit history.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => downloadTextFile('rhinopeak-account-export.json', accountExport, 'application/json;charset=utf-8')}>
              <Download size={14} /> {t('settings.exportData')}
            </Button>
            <Button variant="danger" onClick={deleteAccount}>
              <Trash2 size={14} /> {t('settings.deleteAccount')}
            </Button>
          </div>
        </div>
      </Panel>

      {showBusinessModal && (
        <Modal title="Add Business" subtitle="Pro multi-business workspace" onClose={() => setShowBusinessModal(false)}>
          <form onSubmit={submitBusiness} style={{ display: 'grid', gap: 13 }}>
            <Field label="Business name"><input value={businessName} onChange={(event) => setBusinessName(event.target.value)} style={controlStyle} required /></Field>
            <Field label="Category"><input value={category} onChange={(event) => setCategory(event.target.value)} style={controlStyle} placeholder="Hotel, restaurant, retail, travel..." /></Field>
            <Field label="Address"><input value={address} onChange={(event) => setAddress(event.target.value)} style={controlStyle} /></Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowBusinessModal(false)}>Cancel</Button>
              <Button type="submit">Add Business</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
