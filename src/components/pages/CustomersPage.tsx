'use client';
import { FormEvent, useMemo, useState } from 'react';
import { Download, Plus, Search } from 'lucide-react';
import { Badge, Button, Field, Modal, Panel, PanelHeader, StatTile, controlStyle } from '@/components/ui/Primitives';
import { type Customer, type CustomerSegment } from '@/lib/domain';
import { useAppStore } from '@/lib/store';
import { downloadCsv, formatCurrency } from '@/lib/utils';

const segments: Array<'All' | CustomerSegment> = ['All', 'VIP', 'Regular', 'Occasional', 'At-Risk'];

function segmentTone(segment: CustomerSegment) {
  if (segment === 'VIP') return 'warning';
  if (segment === 'Regular') return 'accent';
  if (segment === 'At-Risk') return 'danger';
  return 'info';
}

export function CustomersPage() {
  const { customers, sales, plan, addCustomer, hasPermission, setActivePage } = useAppStore();
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<'All' | CustomerSegment>('All');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');

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

  const retentionRate = customers.length
    ? Math.round((customers.filter((customer) => customer.orders > 1).length / customers.length) * 100)
    : 0;
  const canManageCustomers = hasPermission('customers.manage');

  const submitCustomer = (event: FormEvent) => {
    event.preventDefault();
    const ok = addCustomer({
      name,
      email,
      phone,
      address,
      notes,
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    });
    if (ok) {
      setShowModal(false);
      setName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setNotes('');
      setTags('');
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
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers, tags, email, phone..." style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%' }} />
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
            {item}
          </button>
        ))}
        <Button variant="secondary" onClick={() => plan === 'pro' ? downloadCsv('rhinopeak-customers.csv', exportRows) : setActivePage('billing')}>
          <Download size={14} /> Export
        </Button>
        <Button disabled={!canManageCustomers} onClick={() => setShowModal(true)} title={canManageCustomers ? 'Add customer' : 'Manage customers permission required'}>
          <Plus size={14} /> Add Customer
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatTile label="Total customers" value={customers.length} />
        <StatTile label="VIP customers" value={customers.filter((customer) => customer.segment === 'VIP').length} tone="warning" />
        <StatTile label="Retention rate" value={`${retentionRate}%`} tone="success" />
        <StatTile label="Average LTV" value={formatCurrency(customers.reduce((sum, customer) => sum + customer.totalSpent, 0) / Math.max(1, customers.length))} tone="accent" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? 'minmax(0,1fr) 340px' : '1fr', gap: 14 }}>
        <Panel>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Customer', 'Contact', 'LTV', 'Orders', 'Last Order', 'Tags', 'Segment'].map((header) => (
                    <th key={header} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 650, textAlign: 'left', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{header}</th>
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
                    <td style={{ padding: '11px 14px' }}>
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
                    <td style={{ padding: '11px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>
                      <div>{customer.email || 'No email'}</div>
                      <div style={{ color: 'var(--text-muted)' }}>{customer.phone || 'No phone'}</div>
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>{formatCurrency(customer.totalSpent)}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--text-secondary)', fontSize: 13 }}>
                      {customer.orders}
                      {plan === 'pro' && customer.orders > 1 && <span style={{ color: 'var(--success)', marginLeft: 6, fontSize: 11 }}>repeat</span>}
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 12 }}>{customer.lastOrder}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {customer.tags.slice(0, 2).map((tag) => <Badge key={tag}>{tag}</Badge>)}
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <Badge tone={segmentTone(customer.segment)}>{customer.segment}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {selected && (
          <Panel>
            <PanelHeader title={selected.name} subtitle="Purchase history and CRM detail" />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <StatTile label="LTV" value={formatCurrency(selected.totalSpent)} tone="accent" />
                <StatTile label="Frequency" value={`${selected.orders} orders`} tone={selected.orders > 1 ? 'success' : 'neutral'} />
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>Notes</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{selected.notes || 'No notes yet.'}</p>
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Purchase Timeline</p>
                {customerSales.length ? customerSales.map((sale) => (
                  <div key={sale.id} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10, marginBottom: 10 }}>
                    <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}>{sale.id} - {formatCurrency(sale.amount)}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>{sale.products} on {sale.date}</p>
                  </div>
                )) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>No purchases recorded.</p>
                )}
              </div>
            </div>
          </Panel>
        )}
      </div>

      {showModal && (
        <Modal title="Create Customer" subtitle="Profile data, tags, and notes" onClose={() => setShowModal(false)}>
          <form onSubmit={submitCustomer} style={{ display: 'grid', gap: 13 }}>
            <Field label="Name">
              <input value={name} onChange={(event) => setName(event.target.value)} style={controlStyle} required />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Email">
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} style={controlStyle} />
              </Field>
              <Field label="Phone">
                <input value={phone} onChange={(event) => setPhone(event.target.value)} style={controlStyle} />
              </Field>
            </div>
            <Field label="Address">
              <input value={address} onChange={(event) => setAddress(event.target.value)} style={controlStyle} />
            </Field>
            <Field label="Tags" hint="Comma separated tags">
              <input value={tags} onChange={(event) => setTags(event.target.value)} style={controlStyle} />
            </Field>
            <Field label="Notes">
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} style={{ ...controlStyle, minHeight: 90, resize: 'vertical' }} />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit">Save Customer</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
