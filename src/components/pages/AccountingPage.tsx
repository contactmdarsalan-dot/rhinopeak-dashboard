'use client';
import { useMemo } from 'react';
import { Badge, Panel, PanelHeader, StatTile } from '@/components/ui/Primitives';
import { translatePaymentMethod, uiText } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';

export function AccountingPage() {
  const { sales, customers, suppliers, creditLedger, purchases, expenses, cashBankAccounts, journalEntries, settings } = useAppStore();
  const tx = (value: string) => uiText(settings.language, value);

  const accounting = useMemo(() => {
    const activeSales = sales.filter((sale) => !sale.deletedAt && sale.status !== 'Refunded');
    const taxableSales = activeSales.reduce((sum, sale) => sum + (sale.taxableAmount ?? Math.max(0, (sale.subtotal ?? sale.amount) - (sale.discountTotal ?? 0) - (sale.vatAmount ?? sale.taxTotal ?? 0))), 0);
    const outputVat = activeSales.reduce((sum, sale) => sum + (sale.vatAmount ?? sale.taxTotal ?? 0), 0);
    const cashSales = activeSales.filter((sale) => sale.payment !== 'Credit').reduce((sum, sale) => sum + sale.amount, 0);
    const creditSales = activeSales.filter((sale) => sale.payment === 'Credit').reduce((sum, sale) => sum + sale.amount, 0);
    const creditDue = customers.reduce((sum, customer) => sum + (customer.balance ?? 0), 0);
    const creditCleared = creditLedger.filter((entry) => entry.type === 'Payment Received').reduce((sum, entry) => sum + entry.amount, 0);
    const supplierPayable = suppliers.reduce((sum, supplier) => sum + supplier.payableBalance, 0);
    const purchaseTotal = purchases.reduce((sum, purchase) => sum + purchase.amount, 0);
    const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const cashBalance = cashBankAccounts.reduce((sum, account) => sum + account.balance, 0);

    const fallbackJournals = [
      ...activeSales.slice(0, 20).map((sale) => ({
        id: sale.id,
        date: sale.date,
        debit: sale.payment === 'Credit' ? 'Accounts Receivable' : translatePaymentMethod(settings.language, sale.payment),
        credit: 'Sales Revenue / VAT Payable',
        amount: sale.amount,
        memo: sale.invoiceNo ?? sale.id,
      })),
      ...creditLedger.filter((entry) => entry.type === 'Payment Received').slice(0, 20).map((entry) => ({
        id: entry.id,
        date: entry.date,
        debit: translatePaymentMethod(settings.language, entry.paymentMethod ?? 'Cash'),
        credit: 'Accounts Receivable',
        amount: entry.amount,
        memo: entry.customerName,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 24);
    const journals = journalEntries.length
      ? journalEntries.slice(0, 24).flatMap((entry) => entry.lines.map((line, index) => ({
          id: `${entry.id}-${index}`,
          date: entry.date,
          debit: line.debit ? line.accountName : '',
          credit: line.credit ? line.accountName : '',
          amount: line.debit || line.credit,
          memo: entry.memo,
        })))
      : fallbackJournals;

    return { taxableSales, outputVat, cashSales, creditSales, creditDue, creditCleared, supplierPayable, purchaseTotal, expenseTotal, cashBalance, journals };
  }, [cashBankAccounts, creditLedger, customers, expenses, journalEntries, purchases, sales, settings.language, suppliers]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatTile label={tx('Taxable sales')} value={formatCurrency(accounting.taxableSales)} detail={tx('Before VAT')} tone="accent" />
        <StatTile label={tx('VAT collected')} value={formatCurrency(accounting.outputVat)} detail={tx('Output VAT at sale')} tone="warning" />
        <StatTile label={tx('Customer credit due')} value={formatCurrency(accounting.creditDue)} detail={tx('Accounts receivable')} tone={accounting.creditDue ? 'warning' : 'success'} />
        <StatTile label={tx('Supplier payable')} value={formatCurrency(accounting.supplierPayable)} detail={tx('Accounts payable')} tone={accounting.supplierPayable ? 'warning' : 'success'} />
        <StatTile label={tx('Purchases')} value={formatCurrency(accounting.purchaseTotal)} detail={tx('Supplier bills')} />
        <StatTile label={tx('Expenses')} value={formatCurrency(accounting.expenseTotal)} detail={tx('Money out')} tone="warning" />
        <StatTile label={tx('Cash & Bank')} value={formatCurrency(accounting.cashBalance)} detail={tx('Account balances')} tone="success" />
      </div>

      <Panel style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 750, textTransform: 'uppercase' }}>{tx('Cash collections')}</p>
            <p style={{ color: 'var(--text-primary)', fontSize: 22, fontWeight: 800 }}>{formatCurrency(accounting.cashSales + accounting.creditCleared)}</p>
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 750, textTransform: 'uppercase' }}>{tx('Credit sales')}</p>
            <p style={{ color: 'var(--text-primary)', fontSize: 22, fontWeight: 800 }}>{formatCurrency(accounting.creditSales)}</p>
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 750, textTransform: 'uppercase' }}>{tx('Nepal VAT setup')}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
              {tx('Uses 13% VAT by default, keeps invoice number, seller PAN/VAT, buyer PAN, taxable amount, VAT amount, and total on printable bills.')}
            </p>
          </div>
        </div>
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <Panel>
          <PanelHeader title={tx('Journal preview')} subtitle={tx('Simple double-entry view from sales and credit payments')} />
          <div style={{ overflowX: 'auto' }}>
            <table className="responsive-card-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Date', 'Debit', 'Credit account', 'Amount', 'Memo'].map((header) => (
                    <th key={header} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 650, textAlign: 'left', textTransform: 'uppercase' }}>{tx(header)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accounting.journals.map((entry) => (
                  <tr key={`${entry.id}-${entry.debit}`} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td data-label={tx('Date')} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 12 }}>{entry.date}</td>
                    <td data-label={tx('Debit')} data-card-primary="true" style={{ padding: '11px 14px', color: 'var(--text-primary)', fontSize: 13, fontWeight: 750 }}>{tx(entry.debit)}</td>
                    <td data-label={tx('Credit account')} style={{ padding: '11px 14px', color: 'var(--text-secondary)', fontSize: 13 }}>{tx(entry.credit)}</td>
                    <td data-label={tx('Amount')} style={{ padding: '11px 14px', color: 'var(--text-primary)', fontSize: 13, fontWeight: 750 }}>{formatCurrency(entry.amount)}</td>
                    <td data-label={tx('Memo')} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 12 }}>{entry.memo}</td>
                  </tr>
                ))}
                {!accounting.journals.length && (
                  <tr>
                    <td colSpan={5} style={{ padding: 18, color: 'var(--text-muted)', fontSize: 13 }}>{tx('No accounting entries yet.')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title={tx('Compliance checklist')} subtitle={tx('For Nepal-style bills and VAT records')} />
          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            {[
              'Business PAN/VAT number added in settings',
              'Sequential invoice number on every bill',
              'Buyer PAN captured when needed',
              'Taxable amount and VAT amount shown separately',
              'Credit sales tracked under accounts receivable',
              'Supplier payable balance tracked separately',
            ].map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{tx(item)}</span>
                <Badge tone="info">{tx('Ready')}</Badge>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
