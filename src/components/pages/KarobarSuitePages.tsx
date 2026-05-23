'use client';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrainCircuit, Building2, CheckCircle2, Eye, Mic, Plus, ReceiptText, Send, Sparkles, Square, Trash2, Upload, WalletCards } from 'lucide-react';
import { Badge, Button, Field, Panel, PanelHeader, StatTile, controlStyle, Modal } from '@/components/ui/Primitives';
import { formatCurrency } from '@/lib/utils';
import { defaultExpenseCategories, paymentMethods, useAppStore } from '@/lib/store';
import { translatePaymentMethod, uiText } from '@/lib/i18n';
import type { CashBankAccountType, DocumentAttachment, MoneyMovementType, PartyType, PurchaseStatus, ReminderLog } from '@/lib/domain';
import { runAssistantCommandInBackend, type AssistantCommandResult } from '@/lib/api';

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

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

const detailLinkStyle = {
  minHeight: 34,
  padding: '7px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-secondary)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  fontSize: 12,
  fontWeight: 750,
  textDecoration: 'none',
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
    { href: '/scan-bill', title: 'Scan bill with AI', copy: 'Turn paper bills into expense, purchase, or sale records.', icon: BrainCircuit },
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
      <AssistantCommandPanel />
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

function AssistantCommandPanel() {
  const { settings, hydrateFromBackend } = useAppStore();
  const tx = (value: string) => uiText(settings.language, value);
  const router = useRouter();
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [transcript, setTranscript] = useState('');
  const [assistantCommand, setAssistantCommand] = useState<AssistantCommandResult | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [notice, setNotice] = useState('');

  const submitCommand = async (nextTranscript = transcript, confirm = false) => {
    const cleanTranscript = nextTranscript.trim();
    if (!cleanTranscript) {
      setNotice(tx('Say or type a business task first.'));
      return;
    }
    setIsWorking(true);
    setNotice('');
    try {
      const response = await runAssistantCommandInBackend({
        transcript: cleanTranscript,
        language: settings.language,
        confirm,
        overrides: assistantCommand?.slots,
      });
      const command = response.assistantCommand;
      setAssistantCommand(command);
      setTranscript(command.transcript);
      if (response.bootstrap) hydrateFromBackend(response.bootstrap);
      setNotice(tx(command.reply));
      if (['scan_bill', 'open_dashboard', 'open_analytics'].includes(command.intent) && command.route) {
        router.push(command.route);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : tx('Assistant could not complete this command.'));
    } finally {
      setIsWorking(false);
    }
  };

  const startListening = () => {
    if (typeof window === 'undefined') return;
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setNotice(tx('Speech is not supported in this browser. Type the command instead.'));
      return;
    }
    const recognition = new Recognition();
    recognition.lang = settings.language === 'ne' ? 'ne-NP' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const spoken = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();
      setTranscript(spoken);
      if (spoken) void submitCommand(spoken, false);
    };
    recognition.onerror = () => {
      setIsListening(false);
      setNotice(tx('Could not hear clearly. Please try again or type the command.'));
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  return (
    <Panel style={{ padding: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 16, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ width: 36, height: 36, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--accent-glow)', color: 'var(--accent)' }}>
              <Sparkles size={18} />
            </span>
            <div>
              <p style={{ color: 'var(--text-primary)', fontSize: 17, fontWeight: 850 }}>{tx('AI business assistant')}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{tx('Speak or type simple tasks like add expense, add customer, scan bill, or add product milk liter.')}</p>
            </div>
          </div>
          <textarea
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            placeholder={tx('Example: add expense NPR 500 rent paid cash')}
            rows={3}
            style={{ ...controlStyle, minHeight: 82, resize: 'vertical', lineHeight: 1.5 }}
          />
          {notice && <p style={{ color: notice.includes('could not') || notice.includes('Could not') ? 'var(--danger)' : 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>{notice}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button variant={isListening ? 'danger' : 'secondary'} onClick={isListening ? stopListening : startListening} disabled={isWorking}>
            {isListening ? <Square size={15} /> : <Mic size={15} />}
            {isListening ? tx('Stop') : tx('Speak')}
          </Button>
          <Button onClick={() => submitCommand()} disabled={isWorking}>
            <BrainCircuit size={15} />
            {isWorking ? tx('Working...') : tx('Understand')}
          </Button>
        </div>
      </div>
      {assistantCommand && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{tx(assistantCommand.intent.replace(/_/g, ' '))}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{tx('Confidence')}: {Math.round(assistantCommand.confidence * 100)}%</p>
            </div>
            <Badge tone={assistantCommand.warnings.length ? 'warning' : assistantCommand.executionStatus === 'Executed' ? 'success' : 'info'}>
              {tx(assistantCommand.executionStatus)}
            </Badge>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            {Object.entries(assistantCommand.slots).map(([key, value]) => (
              value !== undefined && value !== null && String(value) !== ''
                ? <div key={key} style={{ padding: 10, border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 800 }}>{key}</p>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 750, marginTop: 3 }}>{String(value)}</p>
                  </div>
                : null
            ))}
          </div>
          {assistantCommand.warnings.length > 0 && (
            <div style={{ color: 'var(--warning)', fontSize: 13, display: 'grid', gap: 4 }}>
              {assistantCommand.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            <Link href={assistantCommand.route} style={{ textDecoration: 'none' }}>
              <Button variant="secondary">{tx('Open page')}</Button>
            </Link>
            {assistantCommand.canExecute && assistantCommand.executionStatus !== 'Executed' && (
              <Button onClick={() => submitCommand(assistantCommand.transcript, true)} disabled={isWorking}>
                <CheckCircle2 size={15} />
                {tx('Confirm and save')}
              </Button>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

export function PartiesPage() {
  const { settings, parties, partyLedger, addParty, deleteParty, recordPartyLedgerEntry } = useAppStore();
  const [type, setType] = useState<PartyType>('Customer');
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', pan: '', openingBalance: '0', creditLimit: '0', dueDays: '7', notes: '' });
  const [selected, setSelected] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [isAddPartyOpen, setIsAddPartyOpen] = useState(false);
  const [isSettlePaymentOpen, setIsSettlePaymentOpen] = useState(false);
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
    if (ok) {
      setForm({ name: '', phone: '', email: '', address: '', pan: '', openingBalance: '0', creditLimit: '0', dueDays: '7', notes: '' });
      setIsAddPartyOpen(false);
    }
  };

  return (
    <PageFrame
      action={
        <Button onClick={() => setIsAddPartyOpen(true)}>
          <Plus size={15} /> {tx('Add New Party')}
        </Button>
      }
    >
      <div style={gridStyle}>
        <StatTile label="Customer credit" value={formatCurrency(totals.receivable)} detail="They owe us" tone={totals.receivable ? 'warning' : 'success'} />
        <StatTile label="Supplier payable" value={formatCurrency(totals.payable)} detail="We owe suppliers" tone={totals.payable ? 'warning' : 'success'} />
        <StatTile label="Total parties" value={parties.length} detail="Customers, suppliers, or both" />
      </div>

      <Panel>
        <PanelHeader title="Party list" subtitle="Tap a party to see ledger and clear balance." />
        <div className="responsive-table-scroll">
          <table className="responsive-card-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Party', 'Type', 'Contact', 'Balance', 'Actions'].map((header) => (
                  <th key={header} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 750, textAlign: 'left', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{tx(header)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parties.map((party) => (
                <tr key={party.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td data-label={tx('Party')} data-card-primary="true" style={{ padding: '12px 14px' }}>
                    <button onClick={() => setSelected(party.id)} style={{ background: 'transparent', border: 0, color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer', padding: 0 }}>{tx(party.name)}</button>
                    <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{party.id}</p>
                  </td>
                  <td data-label={tx('Type')} style={{ padding: '12px 14px' }}><Badge tone="info">{tx(party.type)}</Badge></td>
                  <td data-label={tx('Contact')} style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{party.phone || party.email || tx('No contact')}</td>
                  <td data-label={tx('Balance')} style={{ padding: '12px 14px', color: party.balance ? 'var(--warning)' : 'var(--success)', fontWeight: 850 }}>{formatCurrency(party.balance)}</td>
                  <td data-label={tx('Actions')} data-card-actions="true" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Link href={`/details/parties/${party.id}`} style={detailLinkStyle}>
                        <Eye size={14} /> {tx('View')}
                      </Link>
                      <Button variant="danger" onClick={() => deleteParty(party.id)}><Trash2 size={14} /> Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!parties.length && <EmptyState title="No parties yet." copy="Add customers and suppliers here to track credit and payable." />}
        </div>
      </Panel>

      {selectedParty && (
        <Panel>
          <PanelHeader
            title={`${tx(selectedParty.name)} ${tx('ledger')}`}
            subtitle={`${tx('Current balance')}: ${formatCurrency(selectedParty.balance)}`}
            action={
              <Button onClick={() => setIsSettlePaymentOpen(true)}>
                {tx('Settle Payment')}
              </Button>
            }
          />
          <div>
            {selectedLedger.map((entry) => (
              <div key={entry.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div><p style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{tx(entry.type)}</p><p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{entry.date} - {tx(entry.note)}</p></div>
                <p style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{formatCurrency(entry.amount)}</p>
              </div>
            ))}
            {!selectedLedger.length && <EmptyState title="No ledger history." copy="Sales, purchases, payments, and adjustments will appear here." />}
          </div>
        </Panel>
      )}

      {/* Add Party Modal Overlay */}
      {isAddPartyOpen && (
        <Modal
          title="Add party"
          subtitle="Use simple names and phone numbers first."
          onClose={() => setIsAddPartyOpen(false)}
          width={500}
        >
          <div style={{ display: 'grid', gap: 12 }}>
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
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="secondary" onClick={() => setIsAddPartyOpen(false)}>{tx('Cancel')}</Button>
              <Button onClick={submit}>{tx('Save party')}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Settle Payment Modal Overlay */}
      {isSettlePaymentOpen && (
        <Modal
          title="Record Payment"
          subtitle={`Settle balance for ${selectedParty.name} (${tx('Current balance')}: ${formatCurrency(selectedParty.balance)})`}
          onClose={() => setIsSettlePaymentOpen(false)}
          width={480}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Payment amount">
              <input
                style={controlStyle}
                type="number"
                value={settleAmount}
                onChange={(event) => setSettleAmount(event.target.value)}
                placeholder="0.00"
              />
            </Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="secondary" onClick={() => setIsSettlePaymentOpen(false)}>{tx('Cancel')}</Button>
              <Button onClick={() => {
                const direction = selectedParty.type === 'Supplier' ? 'Payable' : 'Receivable';
                const typeValue = selectedParty.type === 'Supplier' ? 'Payment Paid' : 'Payment Received';
                if (recordPartyLedgerEntry(selectedParty.id, typeValue, direction, Number(settleAmount) || 0, 'Manual settlement')) {
                  setSettleAmount('');
                  setIsSettlePaymentOpen(false);
                }
              }}>
                {tx('Save payment')}
              </Button>
            </div>
          </div>
        </Modal>
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
  const [isAddPurchaseOpen, setIsAddPurchaseOpen] = useState(false);
  const [isPaySupplierOpen, setIsPaySupplierOpen] = useState(false);
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
    if (ok) {
      setForm({ supplierName: '', billNo: '', quantity: '1', unitCost: '0', discount: '0', tax: '0', payment: 'Cash', status: 'Received', dueDate: '', notes: '' });
      setIsAddPurchaseOpen(false);
    }
  };

  return (
    <PageFrame
      action={
        <div style={{ display: 'flex', gap: 10 }}>
          <Button onClick={() => setIsAddPurchaseOpen(true)}>
            <Plus size={15} /> {tx('Add Purchase Bill')}
          </Button>
          <Button variant="secondary" onClick={() => setIsPaySupplierOpen(true)}>
            {tx('Pay Supplier')}
          </Button>
        </div>
      }
    >
      <div style={gridStyle}>
        <StatTile label="Purchase bills" value={purchases.length} detail="Saved supplier bills" />
        <StatTile label="Supplier payable" value={formatCurrency(payable)} detail="Amount still to pay" tone={payable ? 'warning' : 'success'} />
        <StatTile label="Stock items" value={inventory.length} detail="Products available for purchase entry" />
      </div>

      <Panel>
        <PanelHeader title="Purchase list" subtitle="Recent supplier bills and payment status." />
        <div className="responsive-table-scroll">
          <table className="responsive-card-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Bill', 'Supplier', 'Items', 'Payment', 'Status', 'Date', 'Amount', 'Actions'].map((header) => (
                  <th key={header} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 750, textAlign: 'left', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{tx(header)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => (
                <tr key={purchase.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td data-label={tx('Bill')} data-card-primary="true" style={{ padding: '12px 14px', color: 'var(--text-primary)', fontWeight: 850 }}>{purchase.billNo}</td>
                  <td data-label={tx('Supplier')} style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{tx(purchase.supplierName)}</td>
                  <td data-label={tx('Items')} style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{purchase.items.map((item) => tx(item.productName)).join(', ') || tx('No items')}</td>
                  <td data-label={tx('Payment')} style={{ padding: '12px 14px' }}><Badge tone={purchase.payment === 'Credit' ? 'warning' : 'success'}>{translatePaymentMethod(settings.language, purchase.payment)}</Badge></td>
                  <td data-label={tx('Status')} style={{ padding: '12px 14px' }}><Badge tone={purchase.status === 'Received' ? 'success' : purchase.status === 'Pending' ? 'warning' : 'danger'}>{tx(purchase.status)}</Badge></td>
                  <td data-label={tx('Date')} style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 12 }}>{purchase.date}</td>
                  <td data-label={tx('Amount')} style={{ padding: '12px 14px', color: 'var(--text-primary)', fontWeight: 850 }}>{formatCurrency(purchase.amount)}</td>
                  <td data-label={tx('Actions')} data-card-actions="true" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <Link href={`/details/purchases/${purchase.id}`} style={detailLinkStyle}>
                        <Eye size={14} /> {tx('View')}
                      </Link>
                      <Button variant="danger" onClick={() => deletePurchase(purchase.id)}><Trash2 size={14} /> Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!purchases.length && <EmptyState title="No purchase bills yet." copy="Add a supplier bill to update stock and payable." />}
        </div>
      </Panel>

      {/* Add Purchase Bill Modal Overlay */}
      {isAddPurchaseOpen && (
        <Modal
          title="Add purchase bill"
          subtitle="Choose supplier, item, quantity, and payment type."
          onClose={() => setIsAddPurchaseOpen(false)}
          width={540}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Supplier"><select style={controlStyle} value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">{tx('Type supplier name below')}</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{tx(item.name)}</option>)}</select></Field>
            {!supplierId && <Field label="Supplier name"><input style={controlStyle} value={form.supplierName} onChange={(event) => setForm({ ...form, supplierName: event.target.value })} /></Field>}
            <Field label="Bill no."><input style={controlStyle} value={form.billNo} onChange={(event) => setForm({ ...form, billNo: event.target.value })} /></Field>
            <Field label="Item"><select style={controlStyle} value={productId} onChange={(event) => setProductId(event.target.value)}>{inventory.map((item) => <option key={item.id} value={item.id}>{tx(item.name)} ({tx(item.unit ?? 'pcs')})</option>)}</select></Field>
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
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="secondary" onClick={() => setIsAddPurchaseOpen(false)}>{tx('Cancel')}</Button>
              <Button onClick={submit}>{tx('Save purchase')}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Pay Supplier Modal Overlay */}
      {isPaySupplierOpen && (
        <Modal
          title="Pay supplier"
          subtitle="Clear supplier payable after cash, bank, or wallet payment."
          onClose={() => setIsPaySupplierOpen(false)}
          width={500}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Supplier"><select style={controlStyle} value={payingSupplier} onChange={(event) => setPayingSupplier(event.target.value)}><option value="">{tx('Choose supplier')}</option>{suppliers.filter((item) => item.payableBalance > 0).map((item) => <option key={item.id} value={item.id}>{tx(item.name)} ({formatCurrency(item.payableBalance)})</option>)}</select></Field>
            <Field label="Amount"><input style={controlStyle} type="number" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="secondary" onClick={() => setIsPaySupplierOpen(false)}>{tx('Cancel')}</Button>
              <Button onClick={() => { if (recordSupplierPayment(payingSupplier, Number(paymentAmount) || 0, 'Cash', 'Supplier payment')) { setPaymentAmount(''); setIsPaySupplierOpen(false); } }}>{tx('Save payment')}</Button>
            </div>
          </div>
        </Modal>
      )}
    </PageFrame>
  );
}

export function ExpensesPage() {
  const { settings, expenses, expenseCategories, cashBankAccounts, addExpense, deleteExpense, addExpenseCategory, renameExpenseCategory, deleteExpenseCategory } = useAppStore();
  const tx = (value: string) => uiText(settings.language, value);
  const categories = expenseCategories.length ? expenseCategories : defaultExpenseCategories;
  const [form, setForm] = useState({ category: categories[0], vendor: '', amount: '0', taxAmount: '0', paymentAccountId: cashBankAccounts[0]?.id ?? '', paymentMethod: 'Cash', recurring: false, note: '' });
  const [categoryForm, setCategoryForm] = useState({ name: '', editFrom: '', editTo: '' });
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
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
    if (ok) {
      setForm({ ...form, vendor: '', amount: '0', taxAmount: '0', note: '' });
      setIsAddExpenseOpen(false);
    }
  };

  return (
    <PageFrame
      action={
        <div style={{ display: 'flex', gap: 10 }}>
          <Button onClick={() => setIsAddExpenseOpen(true)}>
            <Plus size={15} /> {tx('Record Expense')}
          </Button>
          <Button variant="secondary" onClick={() => setIsManageCategoriesOpen(true)}>
            {tx('Manage Categories')}
          </Button>
        </div>
      }
    >
      <div style={gridStyle}>
        <StatTile label="Total expenses" value={formatCurrency(expenses.reduce((sum, item) => sum + item.amount, 0))} detail={`${expenses.length} entries`} tone="warning" />
        <StatTile label="VAT on expenses" value={formatCurrency(expenses.reduce((sum, item) => sum + item.taxAmount, 0))} detail="Input VAT view" />
        <StatTile label="Top category" value={tx(byCategory[0]?.category ?? 'None')} detail={byCategory[0] ? formatCurrency(byCategory[0].amount) : 'No expenses'} />
      </div>

      <Panel>
        <PanelHeader title="Expense list" subtitle="Recent money out with category and tax." />
        <div className="responsive-table-scroll">
          <table className="responsive-card-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Category', 'Vendor', 'Payment', 'Date', 'VAT', 'Amount', 'Actions'].map((header) => (
                  <th key={header} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 750, textAlign: 'left', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{tx(header)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td data-label={tx('Category')} data-card-primary="true" style={{ padding: '12px 14px', color: 'var(--text-primary)', fontWeight: 850 }}>{uiText(settings.language, expense.category)}</td>
                  <td data-label={tx('Vendor')} style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{expense.vendor || tx('No vendor')}</td>
                  <td data-label={tx('Payment')} style={{ padding: '12px 14px' }}><Badge>{translatePaymentMethod(settings.language, expense.paymentMethod)}</Badge></td>
                  <td data-label={tx('Date')} style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 12 }}>{expense.date}</td>
                  <td data-label={tx('VAT')} style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontWeight: 750 }}>{formatCurrency(expense.taxAmount)}</td>
                  <td data-label={tx('Amount')} style={{ padding: '12px 14px', color: 'var(--text-primary)', fontWeight: 850 }}>{formatCurrency(expense.amount)}</td>
                  <td data-label={tx('Actions')} data-card-actions="true" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <Link href={`/details/expenses/${expense.id}`} style={detailLinkStyle}>
                        <Eye size={14} /> {tx('View')}
                      </Link>
                      <Button variant="danger" onClick={() => deleteExpense(expense.id)}><Trash2 size={14} /> Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!expenses.length && <EmptyState title="No expenses yet." copy="Record rent, transport, salary, repair, or other costs here." />}
        </div>
      </Panel>

      {/* Record Expense Modal Overlay */}
      {isAddExpenseOpen && (
        <Modal
          title="Add expense"
          subtitle="Use plain categories staff understand."
          onClose={() => setIsAddExpenseOpen(false)}
          width={500}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Category"><select style={controlStyle} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((item) => <option key={item} value={item}>{tx(item)}</option>)}</select></Field>
            <Field label="Vendor"><input style={controlStyle} value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })} placeholder={tx('Landlord, transport, repair shop')} /></Field>
            <Field label="Amount"><input style={controlStyle} type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></Field>
            <Field label="VAT"><input style={controlStyle} type="number" value={form.taxAmount} onChange={(event) => setForm({ ...form, taxAmount: event.target.value })} /></Field>
            <Field label="Paid from"><select style={controlStyle} value={form.paymentAccountId} onChange={(event) => setForm({ ...form, paymentAccountId: event.target.value })}>{cashBankAccounts.map((item) => <option key={item.id} value={item.id}>{tx(item.name)}</option>)}</select></Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="secondary" onClick={() => setIsAddExpenseOpen(false)}>{tx('Cancel')}</Button>
              <Button onClick={submit}>{tx('Save expense')}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Manage Categories Modal Overlay */}
      {isManageCategoriesOpen && (
        <Modal
          title="Expense categories"
          subtitle="Create the words your staff already use, like fuel, rent, salary, or tea."
          onClose={() => setIsManageCategoriesOpen(false)}
          width={540}
        >
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 14, display: 'grid', gap: 12 }}>
              <p style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 13, margin: 0 }}>{tx('Add New Category')}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
                <Field label="New category"><input style={controlStyle} value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} placeholder={tx('Fuel, salary, repair')} /></Field>
                <Button onClick={() => { if (addExpenseCategory(categoryForm.name)) setCategoryForm({ ...categoryForm, name: '' }); }}><Plus size={14} /> Add</Button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <p style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 13, margin: 0 }}>{tx('Rename or Delete Category')}</p>
              <Field label="Rename from"><select style={controlStyle} value={categoryForm.editFrom} onChange={(event) => setCategoryForm({ ...categoryForm, editFrom: event.target.value, editTo: event.target.value })}><option value="">{tx('Choose category')}</option>{categories.map((item) => <option key={item} value={item}>{tx(item)}</option>)}</select></Field>
              <Field label="Rename to"><input style={controlStyle} value={categoryForm.editTo} onChange={(event) => setCategoryForm({ ...categoryForm, editTo: event.target.value })} /></Field>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <Button variant="secondary" onClick={() => { if (categoryForm.editFrom) renameExpenseCategory(categoryForm.editFrom, categoryForm.editTo); }}>Rename</Button>
                <Button variant="danger" onClick={() => { if (categoryForm.editFrom) deleteExpenseCategory(categoryForm.editFrom); }}><Trash2 size={14} /> Delete</Button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: 14, marginTop: 4 }}>
              <Button variant="secondary" onClick={() => setIsManageCategoriesOpen(false)}>{tx('Close')}</Button>
            </div>
          </div>
        </Modal>
      )}
    </PageFrame>
  );
}

export function CashBankPage() {
  const { settings, cashBankAccounts, moneyMovements, addCashBankAccount, updateCashBankAccount, deleteCashBankAccount, recordMoneyMovement } = useAppStore();
  const [accountForm, setAccountForm] = useState({ name: '', type: 'Cash', institution: '', accountNumber: '', openingBalance: '0' });
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [renameAccount, setRenameAccount] = useState('');
  const [movementForm, setMovementForm] = useState({ accountId: cashBankAccounts[0]?.id ?? '', type: 'Receipt', amount: '0', note: '' });
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isManageAccountsOpen, setIsManageAccountsOpen] = useState(false);
  const [isRecordMovementOpen, setIsRecordMovementOpen] = useState(false);
  const tx = (value: string) => uiText(settings.language, value);
  const selectedAccount = cashBankAccounts.find((account) => account.id === selectedAccountId);
  const activeAccounts = cashBankAccounts.filter((account) => account.active !== false);
  const totalBalance = cashBankAccounts.reduce((sum, account) => sum + account.balance, 0);
  const cashTotal = cashBankAccounts.filter((account) => account.type === 'Cash').reduce((sum, account) => sum + account.balance, 0);
  const bankWalletTotal = cashBankAccounts.filter((account) => account.type !== 'Cash').reduce((sum, account) => sum + account.balance, 0);
  const recentMovementValue = moneyMovements.slice(0, 12).reduce((sum, movement) => {
    const positive = movement.type === 'Receipt' || movement.type === 'Deposit';
    const negative = movement.type === 'Payment' || movement.type === 'Withdrawal';
    return sum + (positive ? movement.amount : negative ? -movement.amount : 0);
  }, 0);

  const openManageAccounts = (accountId = selectedAccountId || cashBankAccounts[0]?.id || '') => {
    const account = cashBankAccounts.find((item) => item.id === accountId);
    setSelectedAccountId(accountId);
    setRenameAccount(account?.name ?? '');
    setIsManageAccountsOpen(true);
  };

  const openRecordMovement = (accountId = movementForm.accountId || cashBankAccounts[0]?.id || '') => {
    setMovementForm((current) => ({ ...current, accountId }));
    setIsRecordMovementOpen(true);
  };

  const submitAccount = () => {
    if (addCashBankAccount({ ...accountForm, type: accountForm.type as CashBankAccountType, openingBalance: Number(accountForm.openingBalance) || 0 })) {
      setAccountForm({ name: '', type: 'Cash', institution: '', accountNumber: '', openingBalance: '0' });
      setIsAddAccountOpen(false);
    }
  };

  const submitMovement = () => {
    const ok = recordMoneyMovement({
      accountId: movementForm.accountId,
      type: movementForm.type as MoneyMovementType,
      amount: Number(movementForm.amount) || 0,
      date: new Date().toISOString().slice(0, 10),
      note: movementForm.note,
    });
    if (ok) {
      setMovementForm((current) => ({ ...current, amount: '0', note: '' }));
      setIsRecordMovementOpen(false);
    }
  };

  return (
    <PageFrame
      action={
        <>
          <Button variant="secondary" onClick={() => openManageAccounts()}>
            <Building2 size={15} /> {tx('Manage Accounts')}
          </Button>
          <Button variant="secondary" onClick={() => openRecordMovement()}>
            <ReceiptText size={15} /> {tx('Record Movement')}
          </Button>
          <Button onClick={() => setIsAddAccountOpen(true)}>
            <Plus size={15} /> {tx('Add account')}
          </Button>
        </>
      }
    >
      <div style={gridStyle}>
        <StatTile label="Total balance" value={formatCurrency(totalBalance)} detail={`${cashBankAccounts.length} accounts`} tone={totalBalance ? 'success' : 'neutral'} />
        <StatTile label="Cash on hand" value={formatCurrency(cashTotal)} detail="Drawer and petty cash" tone={cashTotal ? 'success' : 'neutral'} />
        <StatTile label="Bank and wallet" value={formatCurrency(bankWalletTotal)} detail="Current accounts and digital wallets" tone={bankWalletTotal ? 'accent' : 'neutral'} />
        <StatTile label="Recent net movement" value={formatCurrency(recentMovementValue)} detail="Latest 12 ledger rows" tone={recentMovementValue >= 0 ? 'success' : 'warning'} />
      </div>

      <Panel>
        <PanelHeader title="Account register" subtitle="Cash drawers, bank accounts, wallets, and current balances." />
        <div className="responsive-table-scroll">
          <table className="responsive-card-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Account', 'Type', 'Institution', 'Status', 'Balance', 'Actions'].map((header) => (
                  <th key={header} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 750, textAlign: 'left', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{tx(header)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cashBankAccounts.map((account) => (
                <tr key={account.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td data-label={tx('Account')} data-card-primary="true" style={{ padding: '12px 14px' }}>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 850 }}>{tx(account.name)}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{account.id}</p>
                  </td>
                  <td data-label={tx('Type')} style={{ padding: '12px 14px' }}><Badge tone={account.type === 'Cash' ? 'success' : account.type === 'Bank' ? 'info' : 'accent'}>{tx(account.type)}</Badge></td>
                  <td data-label={tx('Institution')} style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>
                    <p>{account.institution ? tx(account.institution) : tx('Not added')}</p>
                    {account.accountNumber && <p style={{ color: 'var(--text-muted)', marginTop: 2 }}>{account.accountNumber}</p>}
                  </td>
                  <td data-label={tx('Status')} style={{ padding: '12px 14px' }}><Badge tone={account.active === false ? 'warning' : 'success'}>{account.active === false ? tx('Paused') : tx('Active')}</Badge></td>
                  <td data-label={tx('Balance')} style={{ padding: '12px 14px', color: account.balance ? 'var(--success)' : 'var(--text-primary)', fontWeight: 900 }}>{formatCurrency(account.balance)}</td>
                  <td data-label={tx('Actions')} data-card-actions="true" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <Link href={`/details/cash-bank/${account.id}`} style={detailLinkStyle}>
                        <Eye size={14} /> {tx('View')}
                      </Link>
                      <Button variant="secondary" onClick={() => openManageAccounts(account.id)}>{tx('Manage')}</Button>
                      <Button variant="secondary" onClick={() => openRecordMovement(account.id)}>{tx('Move')}</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!cashBankAccounts.length && <EmptyState title="No accounts yet." copy="Add a cash drawer, bank account, or wallet to start tracking money." />}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Account ledger" subtitle="Recent receipts, payments, deposits, and withdrawals." />
        <div className="responsive-table-scroll">
          <table className="responsive-card-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Movement', 'Account', 'Date', 'Note', 'Amount', 'Actions'].map((header) => (
                  <th key={header} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 750, textAlign: 'left', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{tx(header)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {moneyMovements.slice(0, 12).map((movement) => {
                const inbound = movement.type === 'Receipt' || movement.type === 'Deposit';
                const outbound = movement.type === 'Payment' || movement.type === 'Withdrawal';
                return (
                  <tr key={movement.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td data-label={tx('Movement')} data-card-primary="true" style={{ padding: '12px 14px' }}>
                      <p style={{ color: 'var(--text-primary)', fontWeight: 850 }}>{tx(movement.type)}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{movement.id}</p>
                    </td>
                    <td data-label={tx('Account')} style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontWeight: 700 }}>{tx(movement.accountName)}</td>
                    <td data-label={tx('Date')} style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 12 }}>{movement.date}</td>
                    <td data-label={tx('Note')} style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{movement.note ? tx(movement.note) : tx('No note')}</td>
                    <td data-label={tx('Amount')} style={{ padding: '12px 14px', color: inbound ? 'var(--success)' : outbound ? 'var(--warning)' : 'var(--text-primary)', fontWeight: 900 }}>{formatCurrency(movement.amount)}</td>
                    <td data-label={tx('Actions')} data-card-actions="true" style={{ padding: '12px 14px' }}>
                      <Link href={`/details/money-movements/${movement.id}`} style={detailLinkStyle}>
                        <Eye size={14} /> {tx('View voucher')}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!moneyMovements.length && <EmptyState title="No money movement." copy="Receipts, payments, and transfers will appear here." />}
        </div>
      </Panel>

      {isAddAccountOpen && (
        <Modal title="Add account" subtitle="Create a cash drawer, bank account, or wallet." onClose={() => setIsAddAccountOpen(false)} width={520}>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Name"><input style={controlStyle} value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} placeholder={tx('Example: Shop cash drawer')} /></Field>
            <Field label="Type"><select style={controlStyle} value={accountForm.type} onChange={(event) => setAccountForm({ ...accountForm, type: event.target.value })}>{(['Cash', 'Bank', 'Wallet'] as CashBankAccountType[]).map((item) => <option key={item}>{tx(item)}</option>)}</select></Field>
            <Field label="Institution"><input style={controlStyle} value={accountForm.institution} onChange={(event) => setAccountForm({ ...accountForm, institution: event.target.value })} placeholder={tx('Bank, wallet provider, or branch')} /></Field>
            <Field label="Account number"><input style={controlStyle} value={accountForm.accountNumber} onChange={(event) => setAccountForm({ ...accountForm, accountNumber: event.target.value })} placeholder={tx('Optional')} /></Field>
            <Field label="Opening balance"><input style={controlStyle} type="number" value={accountForm.openingBalance} onChange={(event) => setAccountForm({ ...accountForm, openingBalance: event.target.value })} /></Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="secondary" onClick={() => setIsAddAccountOpen(false)}>{tx('Cancel')}</Button>
              <Button onClick={submitAccount}>{tx('Save account')}</Button>
            </div>
          </div>
        </Modal>
      )}

      {isManageAccountsOpen && (
        <Modal title="Manage accounts" subtitle="Rename accounts, pause old accounts, or remove empty accounts." onClose={() => setIsManageAccountsOpen(false)} width={560}>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Account">
              <select style={controlStyle} value={selectedAccountId} onChange={(event) => { const account = cashBankAccounts.find((item) => item.id === event.target.value); setSelectedAccountId(event.target.value); setRenameAccount(account?.name ?? ''); }}>
                <option value="">{tx('Choose account')}</option>
                {cashBankAccounts.map((item) => <option key={item.id} value={item.id}>{tx(item.name)}</option>)}
              </select>
            </Field>
            <Field label="Account name"><input style={controlStyle} value={renameAccount} onChange={(event) => setRenameAccount(event.target.value)} /></Field>
            {selectedAccount && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                <div style={{ padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>{tx('Balance')}</p>
                  <p style={{ color: 'var(--text-primary)', fontWeight: 900, marginTop: 4 }}>{formatCurrency(selectedAccount.balance)}</p>
                </div>
                <div style={{ padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>{tx('Ledger rows')}</p>
                  <p style={{ color: 'var(--text-primary)', fontWeight: 900, marginTop: 4 }}>{moneyMovements.filter((movement) => movement.accountId === selectedAccount.id).length}</p>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="secondary" disabled={!selectedAccount} onClick={() => selectedAccount && updateCashBankAccount(selectedAccount.id, { name: renameAccount || selectedAccount.name })}>{tx('Rename')}</Button>
              <Button variant="secondary" disabled={!selectedAccount} onClick={() => selectedAccount && updateCashBankAccount(selectedAccount.id, { active: selectedAccount.active === false })}>{selectedAccount?.active === false ? tx('Activate') : tx('Pause')}</Button>
              <Button variant="danger" disabled={!selectedAccount} onClick={() => { if (selectedAccount && deleteCashBankAccount(selectedAccount.id)) setIsManageAccountsOpen(false); }}><Trash2 size={14} /> {tx('Delete')}</Button>
            </div>
          </div>
        </Modal>
      )}

      {isRecordMovementOpen && (
        <Modal title="Record movement" subtitle="Save money in, money out, deposit, withdrawal, or adjustment." onClose={() => setIsRecordMovementOpen(false)} width={540}>
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Account">
              <select style={controlStyle} value={movementForm.accountId} onChange={(event) => setMovementForm({ ...movementForm, accountId: event.target.value })}>
                {activeAccounts.map((item) => <option key={item.id} value={item.id}>{tx(item.name)}</option>)}
                {!activeAccounts.length && cashBankAccounts.map((item) => <option key={item.id} value={item.id}>{tx(item.name)}</option>)}
              </select>
            </Field>
            <Field label="Movement"><select style={controlStyle} value={movementForm.type} onChange={(event) => setMovementForm({ ...movementForm, type: event.target.value })}>{(['Receipt', 'Payment', 'Deposit', 'Withdrawal', 'Adjustment'] as MoneyMovementType[]).map((item) => <option key={item}>{tx(item)}</option>)}</select></Field>
            <Field label="Amount"><input style={controlStyle} type="number" value={movementForm.amount} onChange={(event) => setMovementForm({ ...movementForm, amount: event.target.value })} /></Field>
            <Field label="Note"><input style={controlStyle} value={movementForm.note} onChange={(event) => setMovementForm({ ...movementForm, note: event.target.value })} placeholder={tx('Example: customer paid old credit')} /></Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="secondary" onClick={() => setIsRecordMovementOpen(false)}>{tx('Cancel')}</Button>
              <Button onClick={submitMovement}>{tx('Save movement')}</Button>
            </div>
          </div>
        </Modal>
      )}
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
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Link href={`/details/documents/${document.id}`} style={detailLinkStyle}>
                  <Eye size={14} /> {tx('View')}
                </Link>
                <Button variant="danger" onClick={() => deleteDocument(document.id)}><Trash2 size={14} /> Delete</Button>
              </div>
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
            <Field label="Party"><select style={controlStyle} value={partyId} onChange={(event) => setPartyId(event.target.value)}>{parties.map((party) => <option key={party.id} value={party.id}>{tx(party.name)} ({formatCurrency(party.balance)})</option>)}</select></Field>
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
