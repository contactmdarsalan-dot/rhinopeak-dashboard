'use client';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, Eye, FileDown, Plus, Printer, Search, Trash2, Upload } from 'lucide-react';
import { Badge, Button, Field, Modal, Panel, PanelHeader, StatTile, controlStyle } from '@/components/ui/Primitives';
import { getEntityDetail, type EntityDetail } from '@/lib/api';
import { type Business, type Customer, type Sale, type SaleStatus } from '@/lib/domain';
import { translatePaymentMethod, translateSaleStatus, uiFormat, uiProductList, uiText } from '@/lib/i18n';
import { paymentMethods, saleStatuses, useAppStore } from '@/lib/store';
import { downloadCsv, formatCurrency } from '@/lib/utils';

function statusTone(status: SaleStatus) {
  if (status === 'Completed') return 'success';
  if (status === 'Pending') return 'warning';
  return 'danger';
}

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

function tableAlign(header: string): 'left' | 'center' | 'right' {
  const clean = header.toLowerCase();
  if (['amount', 'total'].some((term) => clean.includes(term))) return 'right';
  if (['payment', 'status'].some((term) => clean.includes(term))) return 'center';
  if (clean.includes('actions')) return 'right';
  return 'left';
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
}

function billHtml(sale: Sale, customer: Customer | undefined, business: Business | undefined, settings: ReturnType<typeof useAppStore.getState>['settings']) {
  const subtotal = sale.subtotal ?? sale.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountTotal = sale.discountTotal ?? sale.items.reduce((sum, item) => sum + item.discount, 0);
  const vatAmount = sale.vatAmount ?? sale.taxTotal ?? sale.items.reduce((sum, item) => sum + item.tax, 0);
  const taxableAmount = sale.taxableAmount ?? Math.max(0, subtotal - discountTotal);
  const sellerName = business?.name || settings.businessName || 'RhinoPeak Business';
  const sellerAddress = business?.address || '';
  const sellerPan = settings.panVatNumber || business?.taxId || '';
  const rows = sale.items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(item.productName)}</td>
      <td>${item.quantity} ${escapeHtml(item.unit ?? '')}</td>
      <td>${formatCurrency(item.unitPrice)}</td>
      <td>${formatCurrency(item.quantity * item.unitPrice)}</td>
    </tr>
  `).join('');

  return `<!doctype html>
  <html>
    <head>
      <title>${escapeHtml(sale.invoiceNo ?? sale.id)}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #111827; padding: 28px; }
        h1 { font-size: 22px; margin: 0; }
        .muted { color: #6b7280; font-size: 12px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin: 18px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 14px; }
        th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; text-align: left; }
        th { background: #f3f4f6; }
        .totals { margin-left: auto; width: 300px; margin-top: 14px; }
        .totals div { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e5e7eb; }
        .footer { margin-top: 38px; display: flex; justify-content: space-between; gap: 28px; }
        @media print { body { padding: 0; } button { display: none; } }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(sale.invoiceType ?? 'Tax Invoice')}</h1>
      <p class="muted">Invoice No: ${escapeHtml(sale.invoiceNo ?? sale.id)} | Transaction Date: ${escapeHtml(sale.date)} | Payment: ${escapeHtml(sale.payment)}</p>
      <div class="grid">
        <section>
          <strong>Seller</strong>
          <p>${escapeHtml(sellerName)}</p>
          <p class="muted">${escapeHtml(sellerAddress)}</p>
          <p class="muted">PAN/VAT: ${escapeHtml(sellerPan || 'Not added')}</p>
        </section>
        <section>
          <strong>Buyer</strong>
          <p>${escapeHtml(sale.customer)}</p>
          <p class="muted">${escapeHtml(customer?.address ?? '')}</p>
          <p class="muted">PAN: ${escapeHtml(sale.buyerPan || customer?.taxId || 'Not added')}</p>
        </section>
      </div>
      <table>
        <thead><tr><th>S.N.</th><th>Details</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <div><span>Subtotal</span><strong>${formatCurrency(subtotal)}</strong></div>
        <div><span>Discount</span><strong>${formatCurrency(discountTotal)}</strong></div>
        <div><span>Taxable amount</span><strong>${formatCurrency(taxableAmount)}</strong></div>
        <div><span>VAT (${settings.taxRate}%)</span><strong>${formatCurrency(vatAmount)}</strong></div>
        <div><span>Total</span><strong>${formatCurrency(sale.amount)}</strong></div>
      </div>
      <p class="muted">${escapeHtml(settings.receiptFooter)}</p>
      <div class="footer"><span>Buyer signature</span><span>Seller signature</span></div>
    </body>
  </html>`;
}

function downloadBlob(filename: string, type: string, content: BlobPart) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadSimplePdf(filename: string, lines: string[]) {
  const cleanLines = lines.map((line) => line.replace(/[^\x20-\x7E]/g, '').slice(0, 92));
  const content = `BT /F1 11 Tf 40 790 Td ${cleanLines.map((line, index) => `${index ? '0 -18 Td ' : ''}(${line.replace(/[\\()]/g, '\\$&')}) Tj`).join(' ')} ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => offset.toString().padStart(10, '0') + ' 00000 n ').join('\n')}\n`;
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  downloadBlob(filename, 'application/pdf', pdf);
}

export function SalesPage() {
  const {
    sales,
    customers,
    inventory,
    businesses,
    activeBusinessId,
    plan,
    addSale,
    updateSaleStatus,
    softDeleteSale,
    importSales,
    hasPermission,
    settings,
    setActivePage,
  } = useAppStore();
  const tx = (value: string) => uiText(settings.language, value);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'All' | SaleStatus>('All');
  const [payment, setPayment] = useState('All');
  const [selected, setSelected] = useState<Sale | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<EntityDetail | null>(null);
  const [detailFailedId, setDetailFailedId] = useState<string | null>(null);
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
  const [invoiceType, setInvoiceType] = useState<Sale['invoiceType']>('Tax Invoice');
  const [buyerPan, setBuyerPan] = useState('');
  const [creditDueDate, setCreditDueDate] = useState('');
  const [saleNotes, setSaleNotes] = useState('');

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
  const selectedProductUnit = selectedProduct?.unit ?? 'pcs';
  const activeBusiness = businesses.find((business) => business.id === activeBusinessId) ?? businesses[0];
  const selectedCustomer = customers.find((customer) => customer.id === selected?.customerId);
  const quantityStep = ['pcs', 'packet', 'bottle', 'box', 'dozen'].includes(selectedProductUnit) ? 1 : 0.01;
  const taxableLineAmount = selectedProduct ? Math.max(0, selectedProduct.price * quantity - discount) : 0;
  const lineSubtotal = taxableLineAmount + tax;
  const duplicate = useMemo(() => {
    if (plan !== 'pro' || !customerName || !lineSubtotal) return null;
    return activeSales.find((sale) => (
      sale.customer.toLowerCase() === customerName.toLowerCase() &&
      sale.date === saleDate &&
      Math.abs(sale.amount - lineSubtotal) <= 1
    ));
  }, [activeSales, customerName, lineSubtotal, plan, saleDate]);
  const detailLoading = Boolean(selected && selectedDetail?.record?.id !== selected.id && detailFailedId !== selected.id);

  useEffect(() => {
    let cancelled = false;
    if (!selected) return;
    getEntityDetail('sales', selected.id)
      .then((detail) => {
        if (!cancelled) setSelectedDetail(detail);
      })
      .catch(() => {
        if (!cancelled) setDetailFailedId(selected.id);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const selectSale = (sale: Sale) => {
    const next = selected?.id === sale.id ? null : sale;
    setSelectedDetail(null);
    setDetailFailedId(null);
    setSelected(next);
  };

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
      invoiceType,
      buyerPan,
      creditDueDate,
      notes: saleNotes,
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
      setInvoiceType('Tax Invoice');
      setBuyerPan('');
      setCreditDueDate('');
      setSaleNotes('');
    }
  };

  const applyVat = () => {
    setTax(Number((taxableLineAmount * (settings.taxRate / 100)).toFixed(2)));
  };

  const printSelectedBill = (sale: Sale) => {
    const popup = window.open('', '_blank', 'width=900,height=720');
    if (!popup) return;
    popup.document.write(billHtml(sale, customers.find((customer) => customer.id === sale.customerId), activeBusiness, settings));
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const downloadSelectedBillHtml = (sale: Sale) => {
    downloadBlob(`${sale.invoiceNo ?? sale.id}.html`, 'text/html', billHtml(sale, customers.find((customer) => customer.id === sale.customerId), activeBusiness, settings));
  };

  const downloadSelectedBillPdf = (sale: Sale) => {
    downloadSimplePdf(`${sale.invoiceNo ?? sale.id}.pdf`, [
      `${sale.invoiceType ?? 'Tax Invoice'} ${sale.invoiceNo ?? sale.id}`,
      `Seller: ${activeBusiness?.name || settings.businessName || 'RhinoPeak Business'} PAN/VAT: ${settings.panVatNumber || activeBusiness?.taxId || 'Not added'}`,
      `Buyer: ${sale.customer} PAN: ${sale.buyerPan || customers.find((customer) => customer.id === sale.customerId)?.taxId || 'Not added'}`,
      `Date: ${sale.date} Payment: ${sale.payment}`,
      ...sale.items.map((item, index) => `${index + 1}. ${item.productName} ${item.quantity} ${item.unit ?? ''} x ${formatCurrency(item.unitPrice)}`),
      `Taxable amount: ${formatCurrency(sale.taxableAmount ?? Math.max(0, (sale.subtotal ?? 0) - (sale.discountTotal ?? 0)))}`,
      `VAT: ${formatCurrency(sale.vatAmount ?? sale.taxTotal ?? 0)}`,
      `Total: ${formatCurrency(sale.amount)}`,
    ]);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: '1 1 auto' }}>
          <label style={{ flex: '1 1 240px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px' }}>
            <Search size={14} color="var(--text-muted)" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tx('Search orders, customers, products...')} style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%' }} />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value as 'All' | SaleStatus)} style={{ ...controlStyle, width: 150 }}>
            <option value="All">{tx('All')}</option>
            {saleStatuses.map((item) => <option key={item} value={item}>{translateSaleStatus(settings.language, item)}</option>)}
          </select>
          <select value={payment} onChange={(event) => setPayment(event.target.value)} style={{ ...controlStyle, width: 150 }}>
            <option value="All">{tx('All')}</option>
            {paymentMethods.map((item) => <option key={item} value={item}>{translatePaymentMethod(settings.language, item)}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => downloadCsv('rhinopeak-sales.csv', exportRows)}>
            <Download size={14} /> {tx('Export')}
          </Button>
          <label style={{ cursor: canCreateSales ? 'pointer' : 'not-allowed', opacity: canCreateSales ? 1 : 0.55 }} title={canCreateSales ? tx('Import sales') : tx('Create sales permission required')}>
            <input type="file" accept=".csv" onChange={handleImport} disabled={!canCreateSales} style={{ display: 'none' }} />
            <span style={{ minHeight: 36, padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 650, transition: 'all 0.2s ease' }}>
              <Upload size={14} /> {tx('Import')}
            </span>
          </label>
          <Button disabled={!canCreateSales} onClick={() => setShowModal(true)} title={canCreateSales ? tx('Add sale') : tx('Create sales permission required')}>
            <Plus size={14} /> {tx('New Sale')}
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatTile label={tx('Period total')} value={formatCurrency(summary.total)} tone="accent" />
        <StatTile label={tx('Average order value')} value={formatCurrency(summary.avg)} tone="success" />
        <StatTile label={tx('Refund rate')} value={`${summary.refundRate.toFixed(1)}%`} tone={summary.refundRate > 5 ? 'warning' : 'neutral'} />
        <StatTile label={tx('Search results')} value={filtered.length} detail={tx('Active rows')} />
      </div>

      {plan === 'free' && (
        <Panel style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {tx('Free plan supports 100 sales entries per month. Bulk import, duplicate checks, discounts, tax tracking, and exports are shown here for the MVP workflow.')}
          </p>
          <Button onClick={() => setActivePage('billing')}>{tx('Upgrade')}</Button>
        </Panel>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? 'minmax(0,1fr) 300px' : '1fr', gap: 14 }}>
        <Panel>
          <div style={{ overflowX: 'auto' }}>
            <table className="responsive-card-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Order', 'Customer', 'Products', 'Amount', 'Payment', 'Status', 'Date', 'Actions'].map((header) => (
                    <th key={header} data-align={tableAlign(header)} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 650, textAlign: tableAlign(header), textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{tx(header)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((sale, index) => (
                  <tr
                    key={sale.id}
                    onClick={() => selectSale(sale)}
                    style={{
                      borderBottom: index < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      cursor: 'pointer',
                      background: selected?.id === sale.id ? 'var(--accent-glow)' : 'transparent',
                    }}
                  >
                    <td data-label={tx('Order')} data-card-primary="true" style={{ padding: '10px 14px', color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}>{sale.id}</td>
                    <td data-label={tx('Customer')} style={{ padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13 }}>{tx(sale.customer)}</td>
                    <td data-label={tx('Products')} style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{uiProductList(settings.language, sale.products)}</td>
                    <td data-label={tx('Amount')} data-align="right" style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>{formatCurrency(sale.amount)}</td>
                    <td data-label={tx('Payment')} data-align="center" style={{ padding: '10px 14px' }}><Badge>{translatePaymentMethod(settings.language, sale.payment)}</Badge></td>
                    <td data-label={tx('Status')} data-align="center" style={{ padding: '10px 14px' }}><Badge tone={statusTone(sale.status)}>{translateSaleStatus(settings.language, sale.status)}</Badge></td>
                    <td data-label={tx('Date')} style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 12 }}>{sale.date}</td>
                    <td data-label={tx('Actions')} data-card-actions="true" data-align="right" style={{ padding: '10px 14px' }}>
                      <span onClick={(event) => event.stopPropagation()} style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
                        <Link href={`/details/sales/${sale.id}`} style={detailLinkStyle}>
                          <Eye size={14} /> {tx('View')}
                        </Link>
                        <Button variant="danger" disabled={!canDeleteSales} onClick={() => softDeleteSale(sale.id)} title={canDeleteSales ? tx('Soft delete sale') : tx('Delete sales permission required')}>
                          <Trash2 size={14} /> {tx('Delete')}
                        </Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {selected && (
          <Panel>
            <PanelHeader title={tx('Sale Detail')} subtitle={selected.id} />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label={tx('Status')}>
                <select value={selected.status} disabled={!canUpdateSales} onChange={(event) => updateSaleStatus(selected.id, event.target.value as SaleStatus)} style={controlStyle}>
                  {saleStatuses.map((item) => <option key={item} value={item}>{translateSaleStatus(settings.language, item)}</option>)}
                </select>
              </Field>
              {[
                ['Invoice', selected.invoiceNo ?? selected.id],
                ['Customer', tx(selected.customer)],
                ['Products', uiProductList(settings.language, selected.products)],
                ['Amount', formatCurrency(selected.amount)],
                ['Payment', translatePaymentMethod(settings.language, selected.payment)],
                ['VAT', formatCurrency(selected.vatAmount ?? selected.taxTotal ?? 0)],
                ['Buyer PAN', selected.buyerPan || selectedCustomer?.taxId || tx('Not added')],
                ['Credit due', selected.payment === 'Credit' ? selected.creditDueDate || tx('No due date') : tx('Not credit')],
                ['Created by', selected.createdBy],
                ['Date', selected.date],
              ].map(([label, value]) => (
                <div key={label}>
                  <p style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>{tx(label)}</p>
                  <p style={{ color: 'var(--text-primary)', fontSize: 13 }}>{value}</p>
                </div>
              ))}
              <div style={{ display: 'grid', gap: 8 }}>
                <Link href={`/details/sales/${selected.id}`} style={detailLinkStyle}>
                  <Eye size={14} /> {tx('Open details')}
                </Link>
                <Button variant="secondary" onClick={() => printSelectedBill(selected)}>
                  <Printer size={14} /> {tx('Print bill')}
                </Button>
                <Button variant="secondary" onClick={() => downloadSelectedBillPdf(selected)}>
                  <FileDown size={14} /> {tx('Download PDF')}
                </Button>
                <Button variant="secondary" onClick={() => downloadSelectedBillHtml(selected)}>
                  <Download size={14} /> {tx('Download HTML bill')}
                </Button>
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>{tx('Audit trail')}</p>
                {selected.auditTrail.map((entry) => (
                  <p key={entry} style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 4 }}>{entry}</p>
                ))}
              </div>
              <DetailRelatedSections detail={selectedDetail} loading={detailLoading} tx={tx} />
            </div>
          </Panel>
        )}
      </div>

      {showModal && (
        <Modal title={tx('Add Sale')} subtitle={tx('Customer, product, payment, tax, and discount entry')} onClose={() => setShowModal(false)}>
          <form
            onSubmit={submitSale}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') submitSale(event);
            }}
            style={{ display: 'grid', gap: 14 }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label={tx('Customer')}>
                <select
                  value={customerId}
                  onChange={(event) => {
                    const customer = customers.find((item) => item.id === event.target.value);
                    setCustomerId(event.target.value);
                    setCustomerName(customer?.name ?? '');
                    setCustomerContact(customer?.phone || customer?.email || '');
                    setBuyerPan(customer?.taxId ?? '');
                  }}
                  style={controlStyle}
                >
                  <option value="">{tx('Create new customer')}</option>
                  {customers.map((customer) => <option key={customer.id} value={customer.id}>{tx(customer.name)}</option>)}
                </select>
              </Field>
              <Field label={tx('Date')}>
                <input type="date" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} style={controlStyle} />
              </Field>
            </div>

            {!customerId && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label={tx('Customer name')}>
                  <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} style={controlStyle} />
                </Field>
                <Field label={tx('Phone or email')}>
                  <input value={customerContact} onChange={(event) => setCustomerContact(event.target.value)} style={controlStyle} />
                </Field>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              <Field label={tx('Bill type')} hint={tx('Nepal VAT bill format')}>
                <select value={invoiceType} onChange={(event) => setInvoiceType(event.target.value as Sale['invoiceType'])} style={controlStyle}>
                  {['Tax Invoice', 'Abbreviated Tax Invoice', 'Normal Bill'].map((item) => <option key={item} value={item}>{tx(item)}</option>)}
                </select>
              </Field>
              <Field label={tx('Buyer PAN')} hint={tx('Required when buyer asks for tax invoice')}>
                <input value={buyerPan} onChange={(event) => setBuyerPan(event.target.value)} style={controlStyle} />
              </Field>
              {salePayment === 'Credit' && (
                <Field label={tx('Credit due date')} hint={tx('When customer promises to pay')}>
                  <input type="date" value={creditDueDate} onChange={(event) => setCreditDueDate(event.target.value)} style={controlStyle} />
                </Field>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: 12 }}>
              <Field label={tx('Product')}>
                <select value={productId} onChange={(event) => setProductId(event.target.value)} style={controlStyle}>
                  {inventory.map((product) => <option key={product.id} value={product.id}>{tx(product.name)} - {formatCurrency(product.price)} / {tx(product.unit ?? 'pcs')}</option>)}
                </select>
              </Field>
              <Field label={tx('Quantity')} hint={`${tx('Available')}: ${selectedProduct?.stock ?? 0} ${tx(selectedProductUnit)}`}>
                <input type="number" min={quantityStep} step={quantityStep} inputMode="decimal" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} style={controlStyle} />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <Field label={tx('Discount')}>
                <input type="number" min={0} value={discount} onChange={(event) => setDiscount(Number(event.target.value))} style={controlStyle} />
              </Field>
              <Field label={tx('Tax')}>
                <input type="number" min={0} value={tax} onChange={(event) => setTax(Number(event.target.value))} style={controlStyle} />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Button variant="secondary" onClick={applyVat} style={{ minHeight: 30, padding: '5px 8px', fontSize: 11 }}>{uiFormat(settings.language, 'Apply {rate}% VAT', { rate: settings.taxRate })}</Button>
                  <Button variant="ghost" onClick={() => setTax(0)} style={{ minHeight: 30, padding: '5px 8px', fontSize: 11 }}>{tx('No VAT')}</Button>
                </div>
              </Field>
              <Field label={tx('Payment')}>
                <select value={salePayment} onChange={(event) => setSalePayment(event.target.value as typeof salePayment)} style={controlStyle}>
                  {paymentMethods.map((item) => <option key={item} value={item}>{translatePaymentMethod(settings.language, item)}</option>)}
                </select>
              </Field>
              <Field label={tx('Status')}>
                <select value={saleStatus} onChange={(event) => setSaleStatus(event.target.value as SaleStatus)} style={controlStyle}>
                  {saleStatuses.map((item) => <option key={item} value={item}>{translateSaleStatus(settings.language, item)}</option>)}
                </select>
              </Field>
            </div>

            {duplicate && (
              <div style={{ padding: 12, borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.24)', color: 'var(--warning)', fontSize: 12 }}>
                {uiFormat(settings.language, 'Possible duplicate detected: {id} for {customer} on {date}.', { id: duplicate.id, customer: duplicate.customer, date: duplicate.date })}
              </div>
            )}

            <Field label={tx('Bill note')}>
              <textarea value={saleNotes} onChange={(event) => setSaleNotes(event.target.value)} style={{ ...controlStyle, minHeight: 70, resize: 'vertical' }} />
            </Field>

            <Panel style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{tx('Line total')}</span>
                <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(lineSubtotal)}</strong>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 8 }}>{tx('Shortcut: Ctrl/Command + Enter confirms this sale.')}</p>
            </Panel>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowModal(false)}>{tx('Cancel')}</Button>
              <Button type="submit">{tx('Confirm Sale')}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function DetailRelatedSections({ detail, loading, tx }: { detail: EntityDetail | null; loading: boolean; tx: (value: string) => string }) {
  if (loading) return <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{tx('Loading details...')}</p>;
  const related = detail?.related ?? {};
  const sections = Object.entries(related).filter(([, rows]) => rows.length);
  if (!sections.length) return null;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <p style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>{tx('Related details')}</p>
      {sections.map(([name, rows]) => (
        <div key={name} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 10 }}>
          <p style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 800, marginBottom: 8 }}>{tx(labelize(name))}</p>
          {rows.slice(0, 4).map((row, index) => (
            <div key={`${name}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderTop: index ? '1px solid var(--border-subtle)' : 'none' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{String(row.name ?? row.customer ?? row.title ?? row.action ?? row.id ?? tx('Record'))}</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: 12 }}>{String(row.amount ?? row.delta ?? row.status ?? row.date ?? '')}</strong>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function labelize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').replace(/^./, (char) => char.toUpperCase());
}
