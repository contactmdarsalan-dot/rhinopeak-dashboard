'use client';
import { FormEvent, useMemo, useState } from 'react';
import { Download, History, Plus, Search } from 'lucide-react';
import { Badge, Button, Field, Modal, Panel, PanelHeader, StatTile, controlStyle } from '@/components/ui/Primitives';
import { type InventoryProduct, type MovementReason, type StockStatus } from '@/lib/domain';
import { getStockStatus, useAppStore } from '@/lib/store';
import { downloadCsv, formatCurrency } from '@/lib/utils';

const reasons: MovementReason[] = ['Stock In', 'Damage', 'Theft', 'Return', 'Correction'];

function statusTone(status: StockStatus) {
  if (status === 'In Stock') return 'success';
  if (status === 'Low Stock') return 'warning';
  return 'danger';
}

export function InventoryPage() {
  const { inventory, inventoryMovements, plan, addInventoryProduct, recordStockMovement, hasPermission, setActivePage } = useAppStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<InventoryProduct | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [productName, setProductName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState(0);
  const [reorderLevel, setReorderLevel] = useState(10);
  const [price, setPrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [supplier, setSupplier] = useState('');
  const [movementProductId, setMovementProductId] = useState(inventory[0]?.id ?? '');
  const [movementDelta, setMovementDelta] = useState(1);
  const [movementReason, setMovementReason] = useState<MovementReason>('Stock In');
  const [movementNote, setMovementNote] = useState('');

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return inventory.filter((product) => (
      product.name.toLowerCase().includes(query) ||
      product.sku.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query) ||
      product.supplier.toLowerCase().includes(query)
    ));
  }, [inventory, search]);

  const valuation = inventory.reduce((sum, product) => sum + product.stock * product.costPrice, 0);
  const retailValue = inventory.reduce((sum, product) => sum + product.stock * product.price, 0);
  const canManageInventory = hasPermission('inventory.manage');

  const productMovements = useMemo(() => (
    selected ? inventoryMovements.filter((movement) => movement.productId === selected.id).slice(0, 8) : []
  ), [inventoryMovements, selected]);

  const exportRows = filtered.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    stock: product.stock,
    reorderLevel: product.reorderLevel,
    price: product.price,
    costPrice: product.costPrice,
    supplier: product.supplier,
    status: product.status,
  }));

  const submitProduct = (event: FormEvent) => {
    event.preventDefault();
    const ok = addInventoryProduct({
      name: productName,
      sku,
      category,
      stock,
      reorderLevel,
      price,
      costPrice,
      supplier,
    });
    if (ok) {
      setShowProductModal(false);
      setProductName('');
      setSku('');
      setCategory('');
      setStock(0);
      setReorderLevel(10);
      setPrice(0);
      setCostPrice(0);
      setSupplier('');
    }
  };

  const submitMovement = (event: FormEvent) => {
    event.preventDefault();
    const signedDelta = ['Damage', 'Theft'].includes(movementReason)
      ? -Math.abs(movementDelta)
      : movementDelta;
    const ok = recordStockMovement({
      productId: movementProductId,
      delta: signedDelta,
      reason: movementReason,
      note: movementNote,
    });
    if (ok) {
      setShowMovementModal(false);
      setMovementDelta(1);
      setMovementNote('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ flex: '1 1 260px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
          <Search size={14} color="var(--text-muted)" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, SKU, category, supplier..." style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%' }} />
        </label>
        <Button variant="secondary" onClick={() => downloadCsv('rhinopeak-inventory.csv', exportRows)}>
          <Download size={14} /> Export
        </Button>
        <Button variant="secondary" disabled={!canManageInventory} onClick={() => setShowMovementModal(true)} title={canManageInventory ? 'Record stock movement' : 'Manage inventory permission required'}>
          <History size={14} /> Stock Movement
        </Button>
        <Button disabled={!canManageInventory} onClick={() => setShowProductModal(true)} title={canManageInventory ? 'Add product' : 'Manage inventory permission required'}>
          <Plus size={14} /> Add Product
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatTile label="In stock" value={inventory.filter((product) => product.status === 'In Stock').length} tone="success" />
        <StatTile label="Low stock" value={inventory.filter((product) => product.status === 'Low Stock').length} tone="warning" />
        <StatTile label="Out of stock" value={inventory.filter((product) => product.status === 'Out of Stock').length} tone="danger" />
        <StatTile label="FIFO valuation" value={formatCurrency(valuation)} detail={`Retail value ${formatCurrency(retailValue)}`} tone="accent" />
      </div>

      {plan === 'free' && (
        <Panel style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Free plan includes 20 products. Pro adds supplier management, movement history, valuation reports, and unlimited product catalog.
          </p>
          <Button onClick={() => setActivePage('billing')}>Upgrade</Button>
        </Panel>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? 'minmax(0,1fr) 340px' : '1fr', gap: 14 }}>
        <Panel>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Product', 'SKU', 'Category', 'Stock', 'Reorder', 'Price', 'Margin', 'Supplier', 'Status'].map((header) => (
                    <th key={header} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 650, textAlign: 'left', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((product, index) => {
                  const margin = product.price ? ((product.price - product.costPrice) / product.price) * 100 : 0;
                  const status = getStockStatus(product.stock, product.reorderLevel);
                  return (
                    <tr
                      key={product.id}
                      onClick={() => setSelected(selected?.id === product.id ? null : product)}
                      style={{
                        borderBottom: index < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        cursor: 'pointer',
                        background: selected?.id === product.id ? 'var(--accent-glow)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 14px', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}>{product.name}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'monospace' }}>{product.sku}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{product.category}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, minWidth: 26 }}>{product.stock}</span>
                          <div style={{ width: 70, height: 5, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, (product.stock / Math.max(product.reorderLevel * 3, 1)) * 100)}%`, height: '100%', background: status === 'In Stock' ? 'var(--success)' : status === 'Low Stock' ? 'var(--warning)' : 'var(--danger)' }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: 13 }}>{product.reorderLevel}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>{formatCurrency(product.price)}</td>
                      <td style={{ padding: '12px 14px', color: margin > 35 ? 'var(--success)' : 'var(--warning)', fontWeight: 700, fontSize: 13 }}>{margin.toFixed(1)}%</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{product.supplier}</td>
                      <td style={{ padding: '12px 14px' }}><Badge tone={statusTone(status)}>{status}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {selected && (
          <Panel>
            <PanelHeader title={selected.name} subtitle="Stock movement history" />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <StatTile label="On hand" value={selected.stock} tone={selected.status === 'In Stock' ? 'success' : 'warning'} />
                <StatTile label="Cost value" value={formatCurrency(selected.stock * selected.costPrice)} tone="accent" />
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Movements</p>
                {productMovements.length ? productMovements.map((movement) => (
                  <div key={movement.id} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10, marginBottom: 10 }}>
                    <p style={{ color: movement.delta >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: 13, fontWeight: 700 }}>
                      {movement.delta >= 0 ? '+' : ''}{movement.delta} - {movement.reason}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>{movement.createdAt} by {movement.user}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{movement.note}</p>
                  </div>
                )) : <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>No movements recorded yet.</p>}
              </div>
            </div>
          </Panel>
        )}
      </div>

      {showProductModal && (
        <Modal title="Add Product" subtitle="Catalog, SKU, price, cost, and supplier details" onClose={() => setShowProductModal(false)}>
          <form onSubmit={submitProduct} style={{ display: 'grid', gap: 13 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Product name"><input value={productName} onChange={(event) => setProductName(event.target.value)} style={controlStyle} required /></Field>
              <Field label="SKU"><input value={sku} onChange={(event) => setSku(event.target.value)} style={controlStyle} required /></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Category"><input value={category} onChange={(event) => setCategory(event.target.value)} style={controlStyle} required /></Field>
              <Field label="Supplier"><input value={supplier} onChange={(event) => setSupplier(event.target.value)} style={controlStyle} /></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <Field label="Stock"><input type="number" value={stock} onChange={(event) => setStock(Number(event.target.value))} style={controlStyle} /></Field>
              <Field label="Reorder"><input type="number" value={reorderLevel} onChange={(event) => setReorderLevel(Number(event.target.value))} style={controlStyle} /></Field>
              <Field label="Price"><input type="number" value={price} onChange={(event) => setPrice(Number(event.target.value))} style={controlStyle} /></Field>
              <Field label="Cost"><input type="number" value={costPrice} onChange={(event) => setCostPrice(Number(event.target.value))} style={controlStyle} /></Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowProductModal(false)}>Cancel</Button>
              <Button type="submit">Save Product</Button>
            </div>
          </form>
        </Modal>
      )}

      {showMovementModal && (
        <Modal title="Record Stock Movement" subtitle="Stock-in, adjustment, damage, theft, or return" onClose={() => setShowMovementModal(false)}>
          <form onSubmit={submitMovement} style={{ display: 'grid', gap: 13 }}>
            <Field label="Product">
              <select value={movementProductId} onChange={(event) => setMovementProductId(event.target.value)} style={controlStyle}>
                {inventory.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Reason">
                <select value={movementReason} onChange={(event) => setMovementReason(event.target.value as MovementReason)} style={controlStyle}>
                  {reasons.map((reason) => <option key={reason}>{reason}</option>)}
                </select>
              </Field>
              <Field label="Quantity delta">
                <input type="number" value={movementDelta} onChange={(event) => setMovementDelta(Number(event.target.value))} style={controlStyle} />
              </Field>
            </div>
            <Field label="Reason note">
              <textarea value={movementNote} onChange={(event) => setMovementNote(event.target.value)} style={{ ...controlStyle, minHeight: 90, resize: 'vertical' }} />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowMovementModal(false)}>Cancel</Button>
              <Button type="submit">Save Movement</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
