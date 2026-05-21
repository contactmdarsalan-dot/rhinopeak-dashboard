'use client';
import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Building2, Plus, ReceiptText, Send, Trash2, Upload, WalletCards } from 'lucide-react';
import { Badge, Button, Field, Panel, PanelHeader, StatTile, controlStyle } from '@/components/ui/Primitives';
import { formatCurrency } from '@/lib/utils';
import { defaultExpenseCategories, paymentMethods, useAppStore } from '@/lib/store';
import { translatePaymentMethod, uiText } from '@/lib/i18n';
import type { CashBankAccountType, DocumentAttachment, MoneyMovementType, PartyType, PurchaseStatus, ReminderLog } from '@/lib/domain';

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 14,
} as const;

const splitStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 16,
} as const;

function PageFrame({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {action && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, flexWrap: 'wrap' }}>{action}</div>}
      {children}
    </div>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  const language = useAppStore((state) => state.settings.language);
  return (
    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      <p style={{ color: 'var(--text-primary)', fontWeight: 750, marginBottom: 4 }}>{uiText(language, title)}</p>
      <p>{uiText(language, copy)}</p>
    </div>
  );
}

export function QuickAddPage() {
  const { sales, purchases, expenses, customers, suppliers, settings } = useAppStore();
  const tx = (value: string) => uiText(settings.language, value);
  const todaySales = sales.filter((sale) => sale.date === new Date().toISOString().slice(0, 10) && !sale.deletedAt);
  const actionCards = [
    { href: '/sales', title: 'Customer took items', copy: 'Record sale, cash, online payment, or credit.', icon: Plus },
    { href: '/purchases', title: 'Stock came in', copy: 'Record supplier bill and update stock.', icon: ReceiptText },
    { href: '/expenses', title: 'Money went out', copy: 'Save rent, salary, transport, or repair cost.', icon: WalletCards },
    { href: '/parties', title: 'Customer or supplier paid', copy: 'Clear credit and see balances.', icon: Building2 },
    { href: '/documents', title: 'Upload bill photo', copy: 'Attach receipts and paper bills.', icon: Upload },
    { href: '/reminders', title: 'Send payment reminder', copy: 'Create WhatsApp or SMS reminder text.', icon: Send },
  ];

  return (
    <PageFrame>
      <div style={gridStyle}>
        <StatTile label="Today sales" value={formatCurrency(todaySales.reduce((sum, sale) => sum + sale.amount, 0))} detail={`${todaySales.length} bills`} tone="success" />
        <StatTile label="Purchases" value={purchases.length} detail="Supplier bills saved" tone="accent" />
        <StatTile label="Expenses" value={formatCurrency(expenses.reduce((sum, expense) => sum + expense.amount, 0))} detail="Total recorded costs" tone="warning" />
        <StatTile label="Parties" value={customers.length + suppliers.length} detail="Customers and suppliers" />
      </div>
      <div style={gridStyle}>
        {actionCards.map(({ href, title, copy, icon: Icon }) => (
          <Link key={href} href={href} style={{ textDecoration: 'none' }}>
            <Panel style={{ padding: 18, minHeight: 132 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 800 }}>{tx(title)}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{tx(copy)}</p>
                </div>
                <span style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', color: 'var(--accent)', background: 'var(--accent-glow)' }}>
                  <Icon size={19} />
                </span>
              </div>
            </Panel>
          </Link>
        ))}
      </div>
    </PageFrame>
  );
}

export function PartiesPage() {
  const { settings, parties, partyLedger, addParty, deleteParty, recordPartyLedgerEntry } = useAppStore();
  const [type, setType] = useState<PartyType>('Customer');
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', pan: '', openingBalance: '0', creditLimit: '0', dueDays: '7', notes: '' });
  const [selected, setSelected] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const tx = (value: string) => uiText(settings.language, value);
  const totals = useMemo(() => ({
    receivable: parties.filter((party) => party.type !== 'Supplier').reduce((sum, party) => sum + party.balance, 0),
    payable: parties.filter((party) => party.type !== 'Customer').reduce((sum, party) => sum + party.balance, 0),
  }), [parties]);
  const selectedParty = parties.find((party) => party.id === selected) ?? parties[0];
  const selectedLedger = selectedParty ? partyLedger.filter((entry) => entry.partyId === selectedParty.id) : [];

  const submit = () => {
    const ok = addParty({
      ...form,
      type,
      openingBalance: Number(form.openingBalance) || 0,
      creditLimit: Number(form.creditLimit) || 0,
      dueDays: Number(form.dueDays) || 0,
    });
    if (ok) setForm({ name: '', phone: '', email: '', address: '', pan: '', openingBalance: '0', creditLimit: '0', dueDays: '7', notes: '' });
  };

  return (
    <PageFrame>
      <div style={gridStyle}>
        <StatTile label="Customer credit" value={formatCurrency(totals.receivable)} detail="They owe us" tone={totals.receivable ? 'warning' : 'success'} />
        <StatTile label="Supplier payable" value={formatCurrency(totals.payable)} detail="We owe suppliers" tone={totals.payable ? 'warning' : 'success'} />
        <StatTile label="Total parties" value={parties.length} detail="Customers, suppliers, or both" />
      </div>
      <div style={splitStyle}>
        <Panel>
          <PanelHeader title="Add party" subtitle="Use simple names and phone numbers first." />
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <Field label="Party type">
              <select style={controlStyle} value={type} onChange={(event) => setType(event.target.value as PartyType)}>
                {(['Customer', 'Supplier', 'Both'] as PartyType[]).map((item) => <option key={item} value={item}>{tx(item)}</option>)}
              </select>
            </Field>
            <Field label="Name"><input style={controlStyle} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={tx('Example: Sita Store')} /></Field>
            <Field label="Phone"><input style={controlStyle} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="98XXXXXXXX" /></Field>
            <Field label="PAN / VAT No."><input style={controlStyle} value={form.pan} onChange={(event) => setForm({ ...form, pan: event.target.value })} /></Field>
            <Field label="Opening balance" hint="Money already pending before using this app."><input style={controlStyle} type="number" value={form.openingBalance} onChange={(event) => setForm({ ...form, openingBalance: event.target.value })} /></Field>
            <Field label="Credit limit"><input style={controlStyle} type="number" value={form.creditLimit} onChange={(event) => setForm({ ...form, creditLimit: event.target.value })} /></Field>
            <Field label="Due days"><input style={controlStyle} type="number" value={form.dueDays} onChange={(event) => setForm({ ...form, dueDays: event.target.value })} /></Field>
            <Button onClick={submit}><Plus size={15} /> Save party</Button>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Party list" subtitle="Tap a party to see ledger and clear balance." />
          <div className="responsive-table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'left' }}><th style={{ padding: 12 }}>Party</th><th>Type</th><th>Balance</th><th>Action</th></tr></thead>
              <tbody>
                {parties.map((party) => (
                  <tr key={party.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: 12 }}><button onClick={() => setSelected(party.id)} style={{ background: 'transparent', border: 0, color: 'var(--text-primary)', fontWeight: 750, cursor: 'pointer' }}>{party.name}</button><p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{party.phone || tx('No phone')}</p></td>
                    <td><Badge tone="info">{party.type}</Badge></td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{formatCurrency(party.balance)}</td>
                    <td><Button variant="danger" onClick={() => deleteParty(party.id)}><Trash2 size={14} /> Delete</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!parties.length && <EmptyState title="No parties yet." copy="Add customers and suppliers here to track credit and payable." />}
          </div>
        </Panel>
      </div>
      {selectedParty && (
        <Panel>
          <PanelHeader title={`${selectedParty.name} ledger`} subtitle={`${tx('Current balance')}: ${formatCurrency(selectedParty.balance)}`} />
          <div style={splitStyle}>
            <div style={{ display: 'grid', gap: 10 }}>
              <Field label="Payment amount"><input style={controlStyle} type="number" value={settleAmount} onChange={(event) => setSettleAmount(event.target.value)} /></Field>
              <Button onClick={() => {
                const direction = selectedParty.type === 'Supplier' ? 'Payable' : 'Receivable';
                const typeValue = selectedParty.type === 'Supplier' ? 'Payment Paid' : 'Payment Received';
                if (recordPartyLedgerEntry(selectedParty.id, typeValue, direction, Number(settleAmount) || 0, 'Manual settlement')) setSettleAmount('');
              }}>Save payment</Button>
            </div>
            <div>
              {selectedLedger.map((entry) => (
                <div key={entry.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div><p style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{tx(entry.type)}</p><p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{entry.date} - {entry.note}</p></div>
                  <p style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{formatCurrency(entry.amount)}</p>
                </div>
              ))}
              {!selectedLedger.length && <EmptyState title="No ledger history." copy="Sales, purchases, payments, and adjustments will appear here." />}
            </div>
          </div>
        </Panel>
      )}
    </PageFrame>
  );
}

export function PurchasesPage() {
  const { settings, suppliers, inventory, purchases, addPurchase, deletePurchase, recordSupplierPayment } = useAppStore();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [productId, setProductId] = useState(inventory[0]?.id ?? '');
  const [form, setForm] = useState({ supplierName: '', billNo: '', quantity: '1', unitCost: '0', discount: '0', tax: '0', payment: 'Cash', status: 'Received', dueDate: '', notes: '' });
  const [payingSupplier, setPayingSupplier] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const tx = (value: string) => uiText(settings.language, value);
  const payable = suppliers.reduce((sum, supplier) => sum + supplier.payableBalance, 0);

  const submit = () => {
    const product = inventory.find((item) => item.id === productId);
    const supplier = suppliers.find((item) => item.id === supplierId);
    const ok = addPurchase({
      supplierId,
      supplierName: supplier?.name || form.supplierName,
      billNo: form.billNo,
      date: new Date().toISOString().slice(0, 10),
      dueDate: form.dueDate,
      payment: form.payment as typeof paymentMethods[number],
      status: form.status as PurchaseStatus,
      notes: form.notes,
      items: [{
        productId,
        productName: product?.name,
        quantity: Number(form.quantity) || 0,
        unitCost: Number(form.unitCost) || 0,
        discount: Number(form.discount) || 0,
        tax: Number(form.tax) || 0,
      }],
    });
    if (ok) setForm({ supplierName: '', billNo: '', quantity: '1', unitCost: '0', discount: '0', tax: '0', payment: 'Cash', status: 'Received', dueDate: '', notes: '' });
  };

  return (
    <PageFrame>
      <div style={gridStyle}>
        <StatTile label="Purchase bills" value={purchases.length} detail="Saved supplier bills" />
        <StatTile label="Supplier payable" value={formatCurrency(payable)} detail="Amount still to pay" tone={payable ? 'warning' : 'success'} />
        <StatTile label="Stock items" value={inventory.length} detail="Products available for purchase entry" />
      </div>
      <div style={splitStyle}>
        <Panel>
          <PanelHeader title="Add purchase bill" subtitle="Choose supplier, item, quantity, and payment type." />
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <Field label="Supplier"><select style={controlStyle} value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">{tx('Type supplier name below')}</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
            {!supplierId && <Field label="Supplier name"><input style={controlStyle} value={form.supplierName} onChange={(event) => setForm({ ...form, supplierName: event.target.value })} /></Field>}
            <Field label="Bill no."><input style={controlStyle} value={form.billNo} onChange={(event) => setForm({ ...form, billNo: event.target.value })} /></Field>
            <Field label="Item"><select style={controlStyle} value={productId} onChange={(event) => setProductId(event.target.value)}>{inventory.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit ?? 'pcs'})</option>)}</select></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Quantity"><input style={controlStyle} type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field>
              <Field label="Buying cost"><input style={controlStyle} type="number" value={form.unitCost} onChange={(event) => setForm({ ...form, unitCost: event.target.value })} /></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Discount"><input style={controlStyle} type="number" value={form.discount} onChange={(event) => setForm({ ...form, discount: event.target.value })} /></Field>
              <Field label="VAT"><input style={controlStyle} type="number" value={form.tax} onChange={(event) => setForm({ ...form, tax: event.target.value })} /></Field>
            </div>
            <Field label="Payment"><select style={controlStyle} value={form.payment} onChange={(event) => setForm({ ...form, payment: event.target.value })}>{paymentMethods.map((item) => <option key={item} value={item}>{translatePaymentMethod(settings.language, item)}</option>)}</select></Field>
            {form.payment === 'Credit' && <Field label="Due date"><input style={controlStyle} type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field>}
            <Button onClick={submit}>Save purchase</Button>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Purchase list" subtitle="Recent supplier bills and payment status." />
          {purchases.map((purchase) => (
            <div key={purchase.id} style={{ padding: 14, borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div><p style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{purchase.billNo}</p><p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{purchase.supplierName} - {purchase.date}</p><Badge tone={purchase.payment === 'Credit' ? 'warning' : 'success'}>{purchase.payment}</Badge></div>
              <div style={{ textAlign: 'right' }}><p style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{formatCurrency(purchase.amount)}</p><Button variant="danger" onClick={() => deletePurchase(purchase.id)}><Trash2 size={14} /> Delete</Button></div>
            </div>
          ))}
          {!purchases.length && <EmptyState title="No purchase bills yet." copy="Add a supplier bill to update stock and payable." />}
        </Panel>
      </div>
      <Panel>
        <PanelHeader title="Pay supplier" subtitle="Clear supplier payable after cash, bank, or wallet payment." />
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <Field label="Supplier"><select style={controlStyle} value={payingSupplier} onChange={(event) => setPayingSupplier(event.target.value)}><option value="">{tx('Choose supplier')}</option>{suppliers.filter((item) => item.payableBalance > 0).map((item) => <option key={item.id} value={item.id}>{item.name} ({formatCurrency(item.payableBalance)})</option>)}</select></Field>
          <Field label="Amount"><input style={controlStyle} type="number" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></Field>
          <div style={{ alignSelf: 'end' }}><Button onClick={() => { if (recordSupplierPayment(payingSupplier, Number(paymentAmount) || 0, 'Cash', 'Supplier payment')) setPaymentAmount(''); }}>Save payment</Button></div>
        </div>
      </Panel>
    </PageFrame>
  );
}

export function ExpensesPage() {
  const { settings, expenses, expenseCategories, cashBankAccounts, addExpense, deleteExpense, addExpenseCategory, renameExpenseCategory, deleteExpenseCategory } = useAppStore();
  const tx = (value: string) => uiText(settings.language, value);
  const categories = expenseCategories.length ? expenseCategories : defaultExpenseCategories;
  const [form, setForm] = useState({ category: categories[0], vendor: '', amount: '0', taxAmount: '0', paymentAccountId: cashBankAccounts[0]?.id ?? '', paymentMethod: 'Cash', recurring: false, note: '' });
  const [categoryForm, setCategoryForm] = useState({ name: '', editFrom: '', editTo: '' });
  const byCategory = useMemo(() => categories.map((category) => ({ category, amount: expenses.filter((item) => item.category === category).reduce((sum, item) => sum + item.amount, 0) })).filter((item) => item.amount > 0), [categories, expenses]);

  const submit = () => {
    const ok = addExpense({
      category: form.category,
      vendor: form.vendor,
      amount: Number(form.amount) || 0,
      taxAmount: Number(form.taxAmount) || 0,
      paymentAccountId: form.paymentAccountId,
      paymentMethod: form.paymentMethod as typeof paymentMethods[number],
      date: new Date().toISOString().slice(0, 10),
      recurring: form.recurring,
      note: form.note,
    });
    if (ok) setForm({ ...form, vendor: '', amount: '0', taxAmount: '0', note: '' });
  };

  return (
    <PageFrame>
      <div style={gridStyle}>
        <StatTile label="Total expenses" value={formatCurrency(expenses.reduce((sum, item) => sum + item.amount, 0))} detail={`${expenses.length} entries`} tone="warning" />
        <StatTile label="VAT on expenses" value={formatCurrency(expenses.reduce((sum, item) => sum + item.taxAmount, 0))} detail="Input VAT view" />
        <StatTile label="Top category" value={tx(byCategory[0]?.category ?? 'None')} detail={byCategory[0] ? formatCurrency(byCategory[0].amount) : 'No expenses'} />
      </div>
      <div style={splitStyle}>
        <Panel>
          <PanelHeader title="Add expense" subtitle="Use plain categories staff understand." />
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <Field label="Category"><select style={controlStyle} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((item) => <option key={item} value={item}>{tx(item)}</option>)}</select></Field>
            <Field label="Vendor"><input style={controlStyle} value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })} placeholder={tx('Landlord, transport, repair shop')} /></Field>
            <Field label="Amount"><input style={controlStyle} type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></Field>
            <Field label="VAT"><input style={controlStyle} type="number" value={form.taxAmount} onChange={(event) => setForm({ ...form, taxAmount: event.target.value })} /></Field>
            <Field label="Paid from"><select style={controlStyle} value={form.paymentAccountId} onChange={(event) => setForm({ ...form, paymentAccountId: event.target.value })}>{cashBankAccounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
            <Button onClick={submit}>Save expense</Button>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Expense list" subtitle="Recent money out with category and tax." />
          {expenses.map((expense) => (
            <div key={expense.id} style={{ padding: 14, borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div><p style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{uiText(settings.language, expense.category)}</p><p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{expense.vendor || 'No vendor'} - {expense.date}</p></div>
              <div style={{ textAlign: 'right' }}><p style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{formatCurrency(expense.amount)}</p><Button variant="danger" onClick={() => deleteExpense(expense.id)}><Trash2 size={14} /> Delete</Button></div>
            </div>
          ))}
          {!expenses.length && <EmptyState title="No expenses yet." copy="Record rent, transport, salary, repair, or other costs here." />}
        </Panel>
      </div>
      <Panel>
        <PanelHeader title="Expense categories" subtitle="Create the words your staff already use, like fuel, rent, salary, or tea." />
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <Field label="New category"><input style={controlStyle} value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} placeholder={tx('Fuel, salary, repair')} /></Field>
          <div style={{ alignSelf: 'end' }}><Button onClick={() => { if (addExpenseCategory(categoryForm.name)) setCategoryForm({ ...categoryForm, name: '' }); }}><Plus size={14} /> Add category</Button></div>
          <Field label="Rename from"><select style={controlStyle} value={categoryForm.editFrom} onChange={(event) => setCategoryForm({ ...categoryForm, editFrom: event.target.value, editTo: event.target.value })}><option value="">{tx('Choose category')}</option>{categories.map((item) => <option key={item} value={item}>{tx(item)}</option>)}</select></Field>
          <Field label="Rename to"><input style={controlStyle} value={categoryForm.editTo} onChange={(event) => setCategoryForm({ ...categoryForm, editTo: event.target.value })} /></Field>
          <div style={{ alignSelf: 'end', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => categoryForm.editFrom && renameExpenseCategory(categoryForm.editFrom, categoryForm.editTo)}>Rename</Button>
            <Button variant="danger" onClick={() => categoryForm.editFrom && deleteExpenseCategory(categoryForm.editFrom)}><Trash2 size={14} /> Delete</Button>
          </div>
        </div>
      </Panel>
    </PageFrame>
  );
}

export function CashBankPage() {
  const { settings, cashBankAccounts, moneyMovements, addCashBankAccount, updateCashBankAccount, deleteCashBankAccount, recordMoneyMovement } = useAppStore();
  const [accountForm, setAccountForm] = useState({ name: '', type: 'Cash', institution: '', accountNumber: '', openingBalance: '0' });
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [renameAccount, setRenameAccount] = useState('');
  const [movementForm, setMovementForm] = useState({ accountId: cashBankAccounts[0]?.id ?? '', type: 'Receipt', amount: '0', note: '' });
  const tx = (value: string) => uiText(settings.language, value);
  const selectedAccount = cashBankAccounts.find((account) => account.id === selectedAccountId);
  const submitAccount = () => {
    if (addCashBankAccount({ ...accountForm, type: accountForm.type as CashBankAccountType, openingBalance: Number(accountForm.openingBalance) || 0 })) {
      setAccountForm({ name: '', type: 'Cash', institution: '', accountNumber: '', openingBalance: '0' });
    }
  };

  return (
    <PageFrame>
      <div style={gridStyle}>
        {cashBankAccounts.map((account) => <StatTile key={account.id} label={account.name} value={formatCurrency(account.balance)} detail={account.type} tone={account.balance ? 'success' : 'neutral'} />)}
      </div>
      <div style={splitStyle}>
        <Panel>
          <PanelHeader title="Add account" subtitle="Cash drawer, bank, or wallet." />
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <Field label="Name"><input style={controlStyle} value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} /></Field>
            <Field label="Type"><select style={controlStyle} value={accountForm.type} onChange={(event) => setAccountForm({ ...accountForm, type: event.target.value })}>{(['Cash', 'Bank', 'Wallet'] as CashBankAccountType[]).map((item) => <option key={item}>{tx(item)}</option>)}</select></Field>
            <Field label="Opening balance"><input style={controlStyle} type="number" value={accountForm.openingBalance} onChange={(event) => setAccountForm({ ...accountForm, openingBalance: event.target.value })} /></Field>
            <Button onClick={submitAccount}>Save account</Button>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Manage accounts" subtitle="Rename, pause, or remove unused cash and bank accounts." />
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <Field label="Account"><select style={controlStyle} value={selectedAccountId} onChange={(event) => { const account = cashBankAccounts.find((item) => item.id === event.target.value); setSelectedAccountId(event.target.value); setRenameAccount(account?.name ?? ''); }}><option value="">Choose account</option>{cashBankAccounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
            <Field label="Account name"><input style={controlStyle} value={renameAccount} onChange={(event) => setRenameAccount(event.target.value)} /></Field>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="secondary" disabled={!selectedAccount} onClick={() => selectedAccount && updateCashBankAccount(selectedAccount.id, { name: renameAccount || selectedAccount.name })}>Rename</Button>
              <Button variant="secondary" disabled={!selectedAccount} onClick={() => selectedAccount && updateCashBankAccount(selectedAccount.id, { active: !selectedAccount.active })}>{selectedAccount?.active === false ? 'Activate' : 'Pause'}</Button>
              <Button variant="danger" disabled={!selectedAccount} onClick={() => selectedAccount && deleteCashBankAccount(selectedAccount.id)}><Trash2 size={14} /> Delete</Button>
            </div>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Record movement" subtitle="Money in or money out." />
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <Field label="Account"><select style={controlStyle} value={movementForm.accountId} onChange={(event) => setMovementForm({ ...movementForm, accountId: event.target.value })}>{cashBankAccounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
            <Field label="Movement"><select style={controlStyle} value={movementForm.type} onChange={(event) => setMovementForm({ ...movementForm, type: event.target.value })}>{(['Receipt', 'Payment', 'Deposit', 'Withdrawal', 'Adjustment'] as MoneyMovementType[]).map((item) => <option key={item}>{tx(item)}</option>)}</select></Field>
            <Field label="Amount"><input style={controlStyle} type="number" value={movementForm.amount} onChange={(event) => setMovementForm({ ...movementForm, amount: event.target.value })} /></Field>
            <Field label="Note"><input style={controlStyle} value={movementForm.note} onChange={(event) => setMovementForm({ ...movementForm, note: event.target.value })} /></Field>
            <Button onClick={() => recordMoneyMovement({ accountId: movementForm.accountId, type: movementForm.type as MoneyMovementType, amount: Number(movementForm.amount) || 0, date: new Date().toISOString().slice(0, 10), note: movementForm.note })}>Save movement</Button>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Account ledger" subtitle="Recent money movement." />
          {moneyMovements.slice(0, 12).map((movement) => (
            <div key={movement.id} style={{ padding: 14, borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div><p style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{tx(movement.type)}</p><p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{movement.accountName} - {movement.date}</p></div>
              <p style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{formatCurrency(movement.amount)}</p>
            </div>
          ))}
          {!moneyMovements.length && <EmptyState title="No money movement." copy="Receipts, payments, and transfers will appear here." />}
        </Panel>
      </div>
    </PageFrame>
  );
}

export function DocumentsPage() {
  const { settings, documents, sales, purchases, expenses, addDocument, deleteDocument } = useAppStore();
  const [recordType, setRecordType] = useState<DocumentAttachment['recordType']>('Other');
  const [recordId, setRecordId] = useState('');
  const [name, setName] = useState('');
  const tx = (value: string) => uiText(settings.language, value);
  const linkedRecords = [
    ...sales.map((item) => ({ id: item.id, label: `${item.invoiceNo ?? item.id} - ${item.customer}`, type: 'Sale' })),
    ...purchases.map((item) => ({ id: item.id, label: `${item.billNo} - ${item.supplierName}`, type: 'Purchase' })),
    ...expenses.map((item) => ({ id: item.id, label: `${item.category} - ${formatCurrency(item.amount)}`, type: 'Expense' })),
  ].filter((item) => recordType === 'Other' || item.type === recordType);

  const handleFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      addDocument({
        name: name || file.name,
        recordType,
        recordId,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: String(reader.result || ''),
      });
      setName('');
    };
    reader.readAsDataURL(file);
  };

  return (
    <PageFrame>
      <div style={splitStyle}>
        <Panel>
          <PanelHeader title="Upload bill image" subtitle="Use camera on mobile or choose file." />
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <Field label="Document name"><input style={controlStyle} value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label="Link to"><select style={controlStyle} value={recordType} onChange={(event) => setRecordType(event.target.value as DocumentAttachment['recordType'])}>{(['Sale', 'Purchase', 'Expense', 'Party', 'Other'] as DocumentAttachment['recordType'][]).map((item) => <option key={item}>{tx(item)}</option>)}</select></Field>
            <Field label="Record"><select style={controlStyle} value={recordId} onChange={(event) => setRecordId(event.target.value)}><option value="">{tx('No link')}</option>{linkedRecords.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            <input style={controlStyle} type="file" accept="image/*,.pdf" capture="environment" onChange={(event) => handleFile(event.target.files?.[0])} />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Document list" subtitle={`${documents.length} files`} />
          {documents.map((document) => (
            <div key={document.id} style={{ padding: 14, borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div><p style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{document.name}</p><p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{document.recordType} - {Math.round(document.size / 1024)} KB</p>{document.dataUrl && <a href={document.dataUrl} download={document.fileName} style={{ color: 'var(--accent)', fontSize: 12 }}>{tx('Download')}</a>}</div>
              <Button variant="danger" onClick={() => deleteDocument(document.id)}><Trash2 size={14} /> Delete</Button>
            </div>
          ))}
          {!documents.length && <EmptyState title="No documents uploaded." copy="Upload bill images or receipts from mobile camera." />}
        </Panel>
      </div>
    </PageFrame>
  );
}

export function RemindersPage() {
  const { settings, parties, reminderTemplates, reminderLogs, createReminderTemplate, sendReminder } = useAppStore();
  const [templateForm, setTemplateForm] = useState({ name: 'Credit reminder', channel: 'WhatsApp', message: 'Namaste {name}, your due amount is NPR {amount}. Please pay by {date}.', daysOffset: '0' });
  const [partyId, setPartyId] = useState(parties[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const tx = (value: string) => uiText(settings.language, value);
  const selectedParty = parties.find((party) => party.id === partyId);
  const defaultTemplate = reminderTemplates[0] ?? {
    message: templateForm.message,
    channel: templateForm.channel as ReminderLog['channel'],
  };
  const message = selectedParty
    ? defaultTemplate.message.replaceAll('{name}', selectedParty.name).replaceAll('{amount}', amount || String(selectedParty.balance)).replaceAll('{date}', dueDate || 'soon')
    : defaultTemplate.message;

  return (
    <PageFrame>
      <div style={splitStyle}>
        <Panel>
          <PanelHeader title="Reminder template" subtitle="Use placeholders: {name}, {amount}, {date}." />
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <Field label="Name"><input style={controlStyle} value={templateForm.name} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} /></Field>
            <Field label="Channel"><select style={controlStyle} value={templateForm.channel} onChange={(event) => setTemplateForm({ ...templateForm, channel: event.target.value })}><option>WhatsApp</option><option>SMS</option><option>Manual</option></select></Field>
            <Field label="Message"><textarea style={{ ...controlStyle, minHeight: 100 }} value={templateForm.message} onChange={(event) => setTemplateForm({ ...templateForm, message: event.target.value })} /></Field>
            <Button onClick={() => createReminderTemplate({ name: templateForm.name, channel: templateForm.channel as ReminderLog['channel'], language: settings.language, message: templateForm.message, daysOffset: Number(templateForm.daysOffset) || 0, active: true })}>Save template</Button>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Send reminder" subtitle="Choose party and amount." />
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <Field label="Party"><select style={controlStyle} value={partyId} onChange={(event) => setPartyId(event.target.value)}>{parties.map((party) => <option key={party.id} value={party.id}>{party.name} ({formatCurrency(party.balance)})</option>)}</select></Field>
            <Field label="Amount"><input style={controlStyle} type="number" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
            <Field label="Due date"><input style={controlStyle} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></Field>
            <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>{message}</div>
            <Button onClick={() => selectedParty && sendReminder(selectedParty.id, defaultTemplate.channel, message, Number(amount || selectedParty.balance) || 0, dueDate)}>Save reminder</Button>
            {selectedParty && defaultTemplate.channel === 'WhatsApp' && (
              <a href={`https://wa.me/${selectedParty.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 700 }}>{tx('Open WhatsApp')}</a>
            )}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Reminder log" subtitle="Manual, WhatsApp, and SMS records." />
          {reminderLogs.map((log) => (
            <div key={log.id} style={{ padding: 14, borderBottom: '1px solid var(--border-subtle)' }}>
              <p style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{log.partyName}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{log.channel} - {formatCurrency(log.amount)} - {log.createdAt}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 6, lineHeight: 1.45 }}>{log.message}</p>
            </div>
          ))}
          {!reminderLogs.length && <EmptyState title="No reminders yet." copy="Create reminders for credit customers or suppliers." />}
        </Panel>
      </div>
    </PageFrame>
  );
}
