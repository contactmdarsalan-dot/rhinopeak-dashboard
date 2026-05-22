'use client';
import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { CreditCard, Download, Edit3, Eye, Plus, Search, Trash2 } from 'lucide-react';
import { Badge, Button, Field, Modal, Panel, PanelHeader, StatTile, controlStyle } from '@/components/ui/Primitives';
import { type Customer, type CustomerSegment } from '@/lib/domain';
import { translateCustomerSegment, translatePaymentMethod, uiFormat, uiText } from '@/lib/i18n';
import { paymentMethods, useAppStore } from '@/lib/store';
import { downloadCsv, formatCurrency } from '@/lib/utils';

const segments: Array<'All' | CustomerSegment> = ['All', 'VIP', 'Regular', 'Occasional', 'At-Risk'];

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

function segmentTone(segment: CustomerSegment) {
  if (segment === 'VIP') return 'warning';
  if (segment === 'Regular') return 'accent';
  if (segment === 'At-Risk') return 'danger';
  return 'info';
}

export function CustomersPage() {
  const { customers, sales, creditLedger, plan, addCustomer, updateCustomer, deleteCustomer, recordCreditPayment, hasPermission, settings, setActivePage } = useAppStore();
  const tx = (value: string) => uiText(settings.language, value);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<'All' | CustomerSegment>('All');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditCustomerId, setCreditCustomerId] = useState('');
  const [creditAmount, setCreditAmount] = useState(0);
  const [creditPaymentMethod, setCreditPaymentMethod] = useState(paymentMethods[0]);
  const [creditNote, setCreditNote] = useState('');

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return customers
      .filter((customer) => segment === 'All' || customer.segment === segment)
      .filter((customer) => (
        customer.name.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query) ||
        customer.phone.includes(query) ||
        customer.tags.join(' ').toLowerCase().includes(query)
      ))
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }, [customers, search, segment]);

  const customerSales = useMemo(() => (
    selected ? sales.filter((sale) => !sale.deletedAt && sale.customerId === selected.id).slice(0, 10) : []
  ), [sales, selected]);
  const selectedCreditLedger = useMemo(() => (
    selected ? creditLedger.filter((entry) => entry.customerId === selected.id).slice(0, 12) : []
  ), [creditLedger, selected]);
  const creditCustomers = useMemo(() => customers.filter((customer) => (customer.balance ?? 0) > 0), [customers]);
  const totalCredit = creditCustomers.reduce((sum, customer) => sum + (customer.balance ?? 0), 0);
  const creditTaken = creditLedger.filter((entry) => entry.type === 'Credit Sale').reduce((sum, entry) => sum + entry.amount, 0);
  const creditCleared = creditLedger.filter((entry) => entry.type === 'Payment Received').reduce((sum, entry) => sum + entry.amount, 0);

  const canManageCustomers = hasPermission('customers.manage');

  const resetCustomerForm = () => {
    setEditingCustomerId(null);
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setNotes('');
    setTags('');
  };

  const openCustomerModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomerId(customer.id);
      setName(customer.name);
      setEmail(customer.email);
      setPhone(customer.phone);
      setAddress(customer.address);
      setNotes(customer.notes);
      setTags(customer.tags.join(', '));
    } else {
      resetCustomerForm();
    }
    setShowModal(true);
  };

  const openCreditPayment = (customer: Customer) => {
    setCreditCustomerId(customer.id);
    setCreditAmount(customer.balance ?? 0);
    setCreditNote('');
    setShowCreditModal(true);
  };

  const submitCreditPayment = (event: FormEvent) => {
    event.preventDefault();
    const ok = recordCreditPayment(creditCustomerId, creditAmount, creditPaymentMethod, creditNote);
    if (ok) {
      setShowCreditModal(false);
      setCreditCustomerId('');
      setCreditAmount(0);
      setCreditNote('');
    }
  };

  const submitCustomer = (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      name,
      email,
      phone,
      address,
      notes,
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    };
    if (editingCustomerId) {
      updateCustomer(editingCustomerId, payload);
      setShowModal(false);
      resetCustomerForm();
      return;
    }
    const ok = addCustomer({
      ...payload,
    });
    if (ok) {
      setShowModal(false);
      resetCustomerForm();
    }
  };

  const exportRows = filtered.map((customer) => ({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    segment: customer.segment,
    orders: customer.orders,
    lifetimeValue: customer.totalSpent,
    tags: customer.tags.join('|'),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ flex: '1 1 240px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
          <Search size={14} color="var(--text-muted)" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tx('Search customers, tags, email, phone...')} style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%' }} />
        </label>
        {segments.map((item) => (
          <button
            key={item}
            onClick={() => setSegment(item)}
            style={{
              padding: '8px 11px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: segment === item ? 'var(--accent-glow)' : 'transparent',
              color: segment === item ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {translateCustomerSegment(settings.language, item)}
          </button>
        ))}
        <Button variant="secondary" onClick={() => plan === 'pro' ? downloadCsv('rhinopeak-customers.csv', exportRows) : setActivePage('billing')}>
          <Download size={14} /> {tx('Export')}
        </Button>
        <Button disabled={!canManageCustomers} onClick={() => openCustomerModal()} title={canManageCustomers ? tx('Add customer') : tx('Manage customers permission required')}>
          <Plus size={14} /> {tx('Add Customer')}
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatTile label={tx('Total customers')} value={customers.length} />
        <StatTile label={tx('VIP customers')} value={customers.filter((customer) => customer.segment === 'VIP').length} tone="warning" />
        <StatTile label={tx('Credit customers')} value={creditCustomers.length} detail={uiFormat(settings.language, '{amount} total due', { amount: formatCurrency(totalCredit) })} tone={totalCredit ? 'warning' : 'success'} />
        <StatTile label={tx('Credit cleared')} value={formatCurrency(creditCleared)} detail={uiFormat(settings.language, '{amount} credit taken', { amount: formatCurrency(creditTaken) })} tone="accent" />
      </div>

      <Panel>
        <PanelHeader title={tx('Credit customer list')} subtitle={tx('Track who took credit, how much is due, and when it is cleared.')} />
        <div style={{ overflowX: 'auto' }}>
          <table className="responsive-card-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Customer', 'Contact', 'Credit due', 'Last credit', 'Actions'].map((header) => (
                  <th key={header} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 650, textAlign: 'left', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{tx(header)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {creditCustomers.map((customer) => {
                const lastCredit = creditLedger.find((entry) => entry.customerId === customer.id);
                return (
                  <tr key={customer.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td data-label={tx('Customer')} data-card-primary="true" style={{ padding: '11px 14px', color: 'var(--text-primary)', fontWeight: 750 }}>{customer.name}</td>
                    <td data-label={tx('Contact')} style={{ padding: '11px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{customer.phone || customer.email || tx('No contact')}</td>
                    <td data-label={tx('Credit due')} style={{ padding: '11px 14px', color: 'var(--warning)', fontSize: 13, fontWeight: 750 }}>{formatCurrency(customer.balance ?? 0)}</td>
                    <td data-label={tx('Last credit')} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 12 }}>{lastCredit?.date ?? tx('No date')}</td>
                    <td data-label={tx('Actions')} data-card-actions="true" style={{ padding: '11px 14px' }}>
                      <Button disabled={!canManageCustomers} onClick={() => openCreditPayment(customer)}><CreditCard size={14} /> {tx('Clear credit')}</Button>
                    </td>
                  </tr>
                );
              })}
              {!creditCustomers.length && (
                <tr>
                  <td colSpan={5} style={{ padding: 18, color: 'var(--text-muted)', fontSize: 13 }}>{tx('No credit customers right now.')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? 'minmax(0,1fr) 340px' : '1fr', gap: 14 }}>
        <Panel>
          <div style={{ overflowX: 'auto' }}>
            <table className="responsive-card-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Customer', 'Contact', 'LTV', 'Orders', 'Last Order', 'Tags', 'Segment', 'Actions'].map((header) => (
                    <th key={header} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 650, textAlign: 'left', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{tx(header)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((customer, index) => (
                  <tr
                    key={customer.id}
                    onClick={() => setSelected(selected?.id === customer.id ? null : customer)}
                    style={{
                      borderBottom: index < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      cursor: 'pointer',
                      background: selected?.id === customer.id ? 'var(--accent-glow)' : 'transparent',
                    }}
                  >
                    <td data-label={tx('Customer')} data-card-primary="true" style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: `hsl(${customer.name.charCodeAt(0) * 9}, 58%, 42%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                          {customer.name.charAt(0)}
                        </div>
                        <div>
                          <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}>{customer.name}</p>
                          <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>{customer.id}</p>
                        </div>
                      </div>
                    </td>
                    <td data-label={tx('Contact')} style={{ padding: '11px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>
                      <div>{customer.email || tx('No email')}</div>
                      <div style={{ color: 'var(--text-muted)' }}>{customer.phone || tx('No phone')}</div>
                    </td>
                    <td data-label={tx('LTV')} style={{ padding: '11px 14px', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>{formatCurrency(customer.totalSpent)}</td>
                    <td data-label={tx('Orders')} style={{ padding: '11px 14px', color: 'var(--text-secondary)', fontSize: 13 }}>
                      {customer.orders}
                      {plan === 'pro' && customer.orders > 1 && <span style={{ color: 'var(--success)', marginLeft: 6, fontSize: 11 }}>{tx('repeat')}</span>}
                    </td>
                    <td data-label={tx('Last Order')} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 12 }}>{customer.lastOrder}</td>
                    <td data-label={tx('Tags')} style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {customer.tags.slice(0, 2).map((tag) => <Badge key={tag}>{tag}</Badge>)}
                      </div>
                    </td>
                    <td data-label={tx('Segment')} style={{ padding: '11px 14px' }}>
                      <Badge tone={segmentTone(customer.segment)}>{translateCustomerSegment(settings.language, customer.segment)}</Badge>
                    </td>
                    <td data-label={tx('Actions')} data-card-actions="true" style={{ padding: '11px 14px' }}>
                      <Link href={`/details/customers/${customer.id}`} onClick={(event) => event.stopPropagation()} style={detailLinkStyle}>
                        <Eye size={14} /> {tx('View')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {selected && (
          <Panel>
            <PanelHeader title={selected.name} subtitle={tx('Purchase history and CRM detail')} />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                <Link href={`/details/customers/${selected.id}`} style={detailLinkStyle}>
                  <Eye size={14} /> {tx('Open details')}
                </Link>
                <Button variant="secondary" disabled={!canManageCustomers} onClick={() => openCustomerModal(selected)}>
                  <Edit3 size={14} /> {tx('Edit')}
                </Button>
                <Button variant="danger" disabled={!canManageCustomers} onClick={() => {
                  const ok = deleteCustomer(selected.id);
                  if (ok) setSelected(null);
                }}>
                  <Trash2 size={14} /> {tx('Delete')}
                </Button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <StatTile label={tx('LTV')} value={formatCurrency(selected.totalSpent)} tone="accent" />
                <StatTile label={tx('Credit due')} value={formatCurrency(selected.balance ?? 0)} tone={(selected.balance ?? 0) > 0 ? 'warning' : 'success'} />
              </div>
              {(selected.balance ?? 0) > 0 && (
                <Button disabled={!canManageCustomers} onClick={() => openCreditPayment(selected)}>
                  <CreditCard size={14} /> {tx('Clear credit')}
                </Button>
              )}
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>{tx('Notes')}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{selected.notes || tx('No notes yet.')}</p>
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>{tx('Credit Timeline')}</p>
                {selectedCreditLedger.length ? selectedCreditLedger.map((entry) => (
                  <div key={entry.id} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10, marginBottom: 10 }}>
                    <p style={{ color: entry.type === 'Payment Received' ? 'var(--success)' : 'var(--warning)', fontSize: 13, fontWeight: 700 }}>
                      {entry.type === 'Payment Received' ? '-' : '+'}{formatCurrency(entry.amount)} - {tx(entry.type)}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>{entry.date}{entry.dueDate ? ` · ${tx('Due')} ${entry.dueDate}` : ''}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{entry.note}</p>
                  </div>
                )) : <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{tx('No credit history.')}</p>}
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>{tx('Purchase Timeline')}</p>
                {customerSales.length ? customerSales.map((sale) => (
                  <div key={sale.id} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10, marginBottom: 10 }}>
                    <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}>{sale.id} - {formatCurrency(sale.amount)}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>{uiFormat(settings.language, '{products} on {date}', { products: sale.products, date: sale.date })}</p>
                  </div>
                )) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{tx('No purchases recorded.')}</p>
                )}
              </div>
            </div>
          </Panel>
        )}
      </div>

      {showModal && (
        <Modal title={editingCustomerId ? tx('Edit Customer') : tx('Create Customer')} subtitle={tx('Profile data, tags, and notes')} onClose={() => {
          setShowModal(false);
          resetCustomerForm();
        }}>
          <form onSubmit={submitCustomer} style={{ display: 'grid', gap: 13 }}>
            <Field label={tx('Name')}>
              <input value={name} onChange={(event) => setName(event.target.value)} style={controlStyle} required />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label={tx('Email')}>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} style={controlStyle} />
              </Field>
              <Field label={tx('Phone')}>
                <input value={phone} onChange={(event) => setPhone(event.target.value)} style={controlStyle} />
              </Field>
            </div>
            <Field label={tx('Address')}>
              <input value={address} onChange={(event) => setAddress(event.target.value)} style={controlStyle} />
            </Field>
            <Field label={tx('Tags')} hint={tx('Comma separated tags')}>
              <input value={tags} onChange={(event) => setTags(event.target.value)} style={controlStyle} />
            </Field>
            <Field label={tx('Notes')}>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} style={{ ...controlStyle, minHeight: 90, resize: 'vertical' }} />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => {
                setShowModal(false);
                resetCustomerForm();
              }}>{tx('Cancel')}</Button>
              <Button type="submit">{editingCustomerId ? tx('Update Customer') : tx('Save Customer')}</Button>
            </div>
          </form>
        </Modal>
      )}

      {showCreditModal && (
        <Modal title={tx('Clear customer credit')} subtitle={tx('Record payment received from a credit customer.')} onClose={() => setShowCreditModal(false)}>
          <form onSubmit={submitCreditPayment} style={{ display: 'grid', gap: 13 }}>
            <Field label={tx('Customer')}>
              <select value={creditCustomerId} onChange={(event) => {
                const customer = customers.find((item) => item.id === event.target.value);
                setCreditCustomerId(event.target.value);
                setCreditAmount(customer?.balance ?? 0);
              }} style={controlStyle}>
                {creditCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} - {formatCurrency(customer.balance ?? 0)}</option>)}
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label={tx('Amount received')}>
                <input type="number" min={0} inputMode="decimal" value={creditAmount} onChange={(event) => setCreditAmount(Number(event.target.value))} style={controlStyle} />
              </Field>
              <Field label={tx('Payment')}>
                <select value={creditPaymentMethod} onChange={(event) => setCreditPaymentMethod(event.target.value as typeof creditPaymentMethod)} style={controlStyle}>
                  {paymentMethods.filter((method) => method !== 'Credit').map((method) => <option key={method} value={method}>{translatePaymentMethod(settings.language, method)}</option>)}
                </select>
              </Field>
            </div>
            <Field label={tx('Payment note')}>
              <textarea value={creditNote} onChange={(event) => setCreditNote(event.target.value)} style={{ ...controlStyle, minHeight: 86, resize: 'vertical' }} />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowCreditModal(false)}>{tx('Cancel')}</Button>
              <Button type="submit">{tx('Save payment')}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
