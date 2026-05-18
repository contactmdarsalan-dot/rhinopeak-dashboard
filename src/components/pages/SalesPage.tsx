'use client';
import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { Download, Plus, Search, Trash2, Upload } from 'lucide-react';
import { Badge, Button, Field, Modal, Panel, PanelHeader, StatTile, controlStyle } from '@/components/ui/Primitives';
import { type Sale, type SaleStatus } from '@/lib/domain';
import { paymentMethods, saleStatuses, useAppStore } from '@/lib/store';
import { downloadCsv, formatCurrency } from '@/lib/utils';

function statusTone(status: SaleStatus) {
  if (status === 'Completed') return 'success';
  if (status === 'Pending') return 'warning';
  return 'danger';
}

export function SalesPage() {
  const {
    sales,
    customers,
    inventory,
    plan,
    addSale,
    updateSaleStatus,
    softDeleteSale,
    importSales,
    hasPermission,
    setActivePage,
  } = useAppStore();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'All' | SaleStatus>('All');
  const [payment, setPayment] = useState('All');
  const [selected, setSelected] = useState<Sale | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const [customerName, setCustomerName] = useState(customers[0]?.name ?? '');
  const [customerContact, setCustomerContact] = useState(customers[0]?.phone ?? '');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [salePayment, setSalePayment] = useState(paymentMethods[0]);
  const [saleStatus, setSaleStatus] = useState<SaleStatus>('Completed');
  const [productId, setProductId] = useState(inventory[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);

  const activeSales = useMemo(() => sales.filter((sale) => !sale.deletedAt), [sales]);
  const canCreateSales = hasPermission('sales.create');
  const canUpdateSales = hasPermission('sales.update');
  const canDeleteSales = hasPermission('sales.delete');

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return activeSales
      .filter((sale) => (
        sale.customer.toLowerCase().includes(query) ||
        sale.id.toLowerCase().includes(query) ||
        sale.products.toLowerCase().includes(query)
      ))
      .filter((sale) => status === 'All' || sale.status === status)
      .filter((sale) => payment === 'All' || sale.payment === payment)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [activeSales, payment, search, status]);

  const summary = useMemo(() => {
    const total = filtered.filter((sale) => sale.status === 'Completed').reduce((sum, sale) => sum + sale.amount, 0);
    const avg = filtered.length ? total / filtered.length : 0;
    const refunds = filtered.filter((sale) => sale.status === 'Refunded').length;
    return {
      total,
      avg,
      refundRate: filtered.length ? (refunds / filtered.length) * 100 : 0,
    };
  }, [filtered]);

  const selectedProduct = inventory.find((product) => product.id === productId);
  const lineSubtotal = selectedProduct ? selectedProduct.price * quantity - discount + tax : 0;
  const duplicate = useMemo(() => {
    if (plan !== 'pro' || !customerName || !lineSubtotal) return null;
    return activeSales.find((sale) => (
      sale.customer.toLowerCase() === customerName.toLowerCase() &&
      sale.date === saleDate &&
      Math.abs(sale.amount - lineSubtotal) <= 1
    ));
  }, [activeSales, customerName, lineSubtotal, plan, saleDate]);

  const submitSale = (event?: FormEvent) => {
    event?.preventDefault();
    const customer = customers.find((item) => item.id === customerId);
    const ok = addSale({
      customerId: customerId || undefined,
      customerName: customer?.name ?? customerName,
      customerContact: customer?.phone || customer?.email || customerContact,
      date: saleDate,
      payment: salePayment,
      status: saleStatus,
      items: [{
        productId,
        quantity,
        discount,
        tax,
      }],
    });

    if (ok) {
      setShowModal(false);
      setQuantity(1);
      setDiscount(0);
      setTax(0);
    }
  };

  const exportRows = filtered.map((sale) => ({
    id: sale.id,
    customer: sale.customer,
    products: sale.products,
    amount: sale.amount,
    payment: sale.payment,
    status: sale.status,
    date: sale.date,
    createdBy: sale.createdBy,
  }));

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const [, ...rows] = text.split(/\r?\n/).filter(Boolean);
    const imported = rows.slice(0, 25).map((row, index): Sale => {
      const [customer = 'Imported Customer', product = 'Imported Product', amount = '0', date = new Date().toISOString().slice(0, 10)] = row.split(',');
      return {
        id: `CSV-${Date.now().toString().slice(-4)}-${index + 1}`,
        customerId: '',
        customer,
        products: product,
        items: [],
        amount: Number(amount) || 0,
        payment: 'Cash',
        status: 'Completed',
        date,
        createdBy: 'CSV Import',
        auditTrail: ['Imported from CSV'],
      };
    });
    importSales(imported);
    event.target.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ flex: '1 1 240px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
          <Search size={14} color="var(--text-muted)" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search orders, customers, products..." style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%' }} />
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value as 'All' | SaleStatus)} style={{ ...controlStyle, width: 150 }}>
          <option>All</option>
          {saleStatuses.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={payment} onChange={(event) => setPayment(event.target.value)} style={{ ...controlStyle, width: 150 }}>
          <option>All</option>
          {paymentMethods.map((item) => <option key={item}>{item}</option>)}
        </select>
        <Button variant="secondary" onClick={() => downloadCsv('rhinopeak-sales.csv', exportRows)}>
          <Download size={14} /> Export
        </Button>
        <label style={{ cursor: canCreateSales ? 'pointer' : 'not-allowed', opacity: canCreateSales ? 1 : 0.55 }} title={canCreateSales ? 'Import sales' : 'Create sales permission required'}>
          <input type="file" accept=".csv" onChange={handleImport} disabled={!canCreateSales} style={{ display: 'none' }} />
          <span style={{ minHeight: 36, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 650 }}>
            <Upload size={14} /> Import CSV
          </span>
        </label>
        <Button disabled={!canCreateSales} onClick={() => setShowModal(true)} title={canCreateSales ? 'Add sale' : 'Create sales permission required'}>
          <Plus size={14} /> Add Sale
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatTile label="Period total" value={formatCurrency(summary.total)} tone="accent" />
        <StatTile label="Average order value" value={formatCurrency(summary.avg)} tone="success" />
        <StatTile label="Refund rate" value={`${summary.refundRate.toFixed(1)}%`} tone={summary.refundRate > 5 ? 'warning' : 'neutral'} />
        <StatTile label="Search results" value={filtered.length} detail="Active rows" />
      </div>

      {plan === 'free' && (
        <Panel style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Free plan supports 100 sales entries per month. Bulk import, duplicate checks, discounts, tax tracking, and exports are shown here for the MVP workflow.
          </p>
          <Button onClick={() => setActivePage('billing')}>Upgrade</Button>
        </Panel>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? 'minmax(0,1fr) 300px' : '1fr', gap: 14 }}>
        <Panel>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Order', 'Customer', 'Products', 'Amount', 'Payment', 'Status', 'Date', 'Actions'].map((header) => (
                    <th key={header} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 650, textAlign: 'left', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((sale, index) => (
                  <tr
                    key={sale.id}
                    onClick={() => setSelected(selected?.id === sale.id ? null : sale)}
                    style={{
                      borderBottom: index < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      cursor: 'pointer',
                      background: selected?.id === sale.id ? 'var(--accent-glow)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '10px 14px', color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}>{sale.id}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13 }}>{sale.customer}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{sale.products}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>{formatCurrency(sale.amount)}</td>
                    <td style={{ padding: '10px 14px' }}><Badge>{sale.payment}</Badge></td>
                    <td style={{ padding: '10px 14px' }}><Badge tone={statusTone(sale.status)}>{sale.status}</Badge></td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 12 }}>{sale.date}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <Button variant="ghost" disabled={!canDeleteSales} onClick={() => softDeleteSale(sale.id)} title={canDeleteSales ? 'Soft delete sale' : 'Delete sales permission required'}>
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {selected && (
          <Panel>
            <PanelHeader title="Sale Detail" subtitle={selected.id} />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Status">
                <select value={selected.status} disabled={!canUpdateSales} onChange={(event) => updateSaleStatus(selected.id, event.target.value as SaleStatus)} style={controlStyle}>
                  {saleStatuses.map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              {[
                ['Customer', selected.customer],
                ['Products', selected.products],
                ['Amount', formatCurrency(selected.amount)],
                ['Payment', selected.payment],
                ['Created by', selected.createdBy],
                ['Date', selected.date],
              ].map(([label, value]) => (
                <div key={label}>
                  <p style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>{label}</p>
                  <p style={{ color: 'var(--text-primary)', fontSize: 13 }}>{value}</p>
                </div>
              ))}
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Audit trail</p>
                {selected.auditTrail.map((entry) => (
                  <p key={entry} style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 4 }}>{entry}</p>
                ))}
              </div>
            </div>
          </Panel>
        )}
      </div>

      {showModal && (
        <Modal title="Add Sale" subtitle="Customer, product, payment, tax, and discount entry" onClose={() => setShowModal(false)}>
          <form
            onSubmit={submitSale}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') submitSale(event);
            }}
            style={{ display: 'grid', gap: 14 }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Customer">
                <select
                  value={customerId}
                  onChange={(event) => {
                    const customer = customers.find((item) => item.id === event.target.value);
                    setCustomerId(event.target.value);
                    setCustomerName(customer?.name ?? '');
                    setCustomerContact(customer?.phone || customer?.email || '');
                  }}
                  style={controlStyle}
                >
                  <option value="">Create new customer</option>
                  {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                </select>
              </Field>
              <Field label="Date">
                <input type="date" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} style={controlStyle} />
              </Field>
            </div>

            {!customerId && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Customer name">
                  <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} style={controlStyle} />
                </Field>
                <Field label="Phone or email">
                  <input value={customerContact} onChange={(event) => setCustomerContact(event.target.value)} style={controlStyle} />
                </Field>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: 12 }}>
              <Field label="Product">
                <select value={productId} onChange={(event) => setProductId(event.target.value)} style={controlStyle}>
                  {inventory.map((product) => <option key={product.id} value={product.id}>{product.name} - {formatCurrency(product.price)}</option>)}
                </select>
              </Field>
              <Field label="Quantity" hint={`Available: ${selectedProduct?.stock ?? 0}`}>
                <input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} style={controlStyle} />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <Field label="Discount">
                <input type="number" min={0} value={discount} onChange={(event) => setDiscount(Number(event.target.value))} style={controlStyle} />
              </Field>
              <Field label="Tax">
                <input type="number" min={0} value={tax} onChange={(event) => setTax(Number(event.target.value))} style={controlStyle} />
              </Field>
              <Field label="Payment">
                <select value={salePayment} onChange={(event) => setSalePayment(event.target.value as typeof salePayment)} style={controlStyle}>
                  {paymentMethods.map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={saleStatus} onChange={(event) => setSaleStatus(event.target.value as SaleStatus)} style={controlStyle}>
                  {saleStatuses.map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
            </div>

            {duplicate && (
              <div style={{ padding: 12, borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.24)', color: 'var(--warning)', fontSize: 12 }}>
                Possible duplicate detected: {duplicate.id} for {duplicate.customer} on {duplicate.date}.
              </div>
            )}

            <Panel style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Line total</span>
                <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(lineSubtotal)}</strong>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 8 }}>Shortcut: Ctrl/Command + Enter confirms this sale.</p>
            </Panel>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit">Confirm Sale</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
