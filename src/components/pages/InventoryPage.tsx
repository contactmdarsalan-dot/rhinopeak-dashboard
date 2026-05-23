'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, Edit3, Eye, History, Plus, Search, Tags, Trash2, Truck } from 'lucide-react';
import { Badge, Button, Field, Modal, Panel, PanelHeader, StatTile, controlStyle } from '@/components/ui/Primitives';
import { getEntityDetail, type EntityDetail } from '@/lib/api';
import { type InventoryProduct, type MovementReason, type StockStatus } from '@/lib/domain';
import { translateStockStatus, uiFormat, uiText } from '@/lib/i18n';
import { getStockStatus, useAppStore } from '@/lib/store';
import { downloadCsv, formatCurrency } from '@/lib/utils';

const reasons: MovementReason[] = ['Stock In', 'Damage', 'Theft', 'Return', 'Correction'];
const unitOptions = [
  { value: 'pcs', label: 'Pieces', short: 'pcs', example: 'soap, cup, charger' },
  { value: 'ltr', label: 'Liters', short: 'L', example: 'milk, oil, petrol' },
  { value: 'kg', label: 'Kilograms', short: 'kg', example: 'rice, sugar, flour' },
  { value: 'gm', label: 'Grams', short: 'g', example: 'tea, spices' },
  { value: 'packet', label: 'Packets', short: 'pkt', example: 'noodles, biscuits' },
  { value: 'bottle', label: 'Bottles', short: 'btl', example: 'water, juice' },
  { value: 'box', label: 'Boxes', short: 'box', example: 'cartons, cases' },
  { value: 'dozen', label: 'Dozen', short: 'dz', example: 'eggs, bakery packs' },
];
const protectedCategories = ['General', 'Dairy', 'Grocery', 'Beverage', 'Household'];

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

function statusTone(status: StockStatus) {
  if (status === 'In Stock') return 'success';
  if (status === 'Low Stock') return 'warning';
  return 'danger';
}

function unitMeta(unit?: string) {
  return unitOptions.find((item) => item.value === unit) ?? unitOptions[0];
}

function formatQuantity(value: number, unit?: string, language?: Parameters<typeof uiText>[0]) {
  const rounded = Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/\.?0+$/, '');
  return `${rounded} ${uiText(language, unitMeta(unit).short)}`;
}

export function InventoryPage() {
  const {
    inventory,
    suppliers,
    inventoryCategories,
    inventoryMovements,
    plan,
    addInventoryProduct,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    addInventoryCategory,
    renameInventoryCategory,
    deleteInventoryCategory,
    recordStockMovement,
    hasPermission,
    settings,
    setActivePage,
    updateInventoryProduct,
    deleteInventoryProduct,
  } = useAppStore();
  const tx = (value: string) => uiText(settings.language, value);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<InventoryProduct | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<EntityDetail | null>(null);
  const [detailFailedId, setDetailFailedId] = useState<string | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [productName, setProductName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('General');
  const [unit, setUnit] = useState('pcs');
  const [stock, setStock] = useState(0);
  const [reorderLevel, setReorderLevel] = useState(10);
  const [price, setPrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [supplier, setSupplier] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [supplierPan, setSupplierPan] = useState('');
  const [supplierContactPerson, setSupplierContactPerson] = useState('');
  const [supplierPayableBalance, setSupplierPayableBalance] = useState(0);
  const [supplierNotes, setSupplierNotes] = useState('');
  const [movementProductId, setMovementProductId] = useState(inventory[0]?.id ?? '');
  const [movementDelta, setMovementDelta] = useState(1);
  const [movementReason, setMovementReason] = useState<MovementReason>('Stock In');
  const [movementNote, setMovementNote] = useState('');

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return inventory.filter((product) => (
      product.name.toLowerCase().includes(query) ||
      (product.sku ?? '').toLowerCase().includes(query) ||
      (product.category ?? '').toLowerCase().includes(query) ||
      (product.unit ?? '').toLowerCase().includes(query) ||
      (product.supplier ?? '').toLowerCase().includes(query)
    ));
  }, [inventory, search]);

  const categories = useMemo(() => {
    const names = [...inventoryCategories, ...inventory.map((product) => product.category)]
      .map((name) => name.trim())
      .filter(Boolean);
    return Array.from(new Map(names.map((name) => [name.toLowerCase(), name])).values())
      .sort((a, b) => a.localeCompare(b));
  }, [inventory, inventoryCategories]);

  const valuation = inventory.reduce((sum, product) => sum + product.stock * product.costPrice, 0);
  const retailValue = inventory.reduce((sum, product) => sum + product.stock * product.price, 0);
  const canManageInventory = hasPermission('inventory.manage');
  const selectedUnit = unitMeta(unit);
  const quantityStep = ['pcs', 'packet', 'bottle', 'box', 'dozen'].includes(unit) ? 1 : 0.01;
  const movementProduct = inventory.find((product) => product.id === movementProductId);
  const movementUnit = unitMeta(movementProduct?.unit);
  const movementStep = ['pcs', 'packet', 'bottle', 'box', 'dozen'].includes(movementProduct?.unit ?? 'pcs') ? 1 : 0.01;

  const productMovements = useMemo(() => (
    selected ? inventoryMovements.filter((movement) => movement.productId === selected.id).slice(0, 8) : []
  ), [inventoryMovements, selected]);
  const detailLoading = Boolean(selected && selectedDetail?.record?.id !== selected.id && detailFailedId !== selected.id);

  useEffect(() => {
    let cancelled = false;
    if (!selected) return;
    getEntityDetail('inventory', selected.id)
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

  const selectProduct = (product: InventoryProduct) => {
    const next = selected?.id === product.id ? null : product;
    setSelectedDetail(null);
    setDetailFailedId(null);
    setSelected(next);
  };

  const exportRows = filtered.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    unit: product.unit ?? 'pcs',
    stock: product.stock,
    reorderLevel: product.reorderLevel,
    price: product.price,
    costPrice: product.costPrice,
    supplier: product.supplier,
    status: product.status,
  }));

  const resetProductForm = () => {
    setEditingProductId(null);
    setProductName('');
    setSku('');
    setCategory('General');
    setUnit('pcs');
    setStock(0);
    setReorderLevel(10);
    setPrice(0);
    setCostPrice(0);
    setSupplier('');
  };

  const openProductModal = (product?: InventoryProduct) => {
    if (product) {
      setEditingProductId(product.id);
      setProductName(product.name);
      setSku(product.sku);
      setCategory(product.category || 'General');
      setUnit(product.unit || 'pcs');
      setStock(product.stock);
      setReorderLevel(product.reorderLevel);
      setPrice(product.price);
      setCostPrice(product.costPrice);
      setSupplier(product.supplier);
    } else {
      resetProductForm();
    }
    setShowProductModal(true);
  };

  const submitProduct = (event: FormEvent) => {
    event.preventDefault();
    if (editingProductId) {
      updateInventoryProduct(editingProductId, {
        name: productName,
        sku,
        category: category || 'General',
        unit,
        stock,
        reorderLevel,
        price,
        costPrice,
        supplier,
      });
      setShowProductModal(false);
      resetProductForm();
      return;
    }
    const ok = addInventoryProduct({
      name: productName,
      sku,
      category: category || 'General',
      unit,
      stock,
      reorderLevel,
      price,
      costPrice,
      supplier,
    });
    if (ok) {
      setShowProductModal(false);
      resetProductForm();
    }
  };

  const applyMilkExample = () => {
    setProductName('Milk');
    setSku('MILK-1L');
    setCategory('Dairy');
    setUnit('ltr');
    setStock(25);
    setReorderLevel(5);
    setPrice(120);
    setCostPrice(95);
    setSupplier('Local dairy');
  };

  const submitCategory = (event: FormEvent) => {
    event.preventDefault();
    const ok = addInventoryCategory(newCategory);
    if (ok) setNewCategory('');
  };

  const saveCategoryName = (oldName: string) => {
    const ok = renameInventoryCategory(oldName, editingCategoryName);
    if (ok) {
      setEditingCategory(null);
      setEditingCategoryName('');
      if (category.toLowerCase() === oldName.toLowerCase()) setCategory(editingCategoryName.trim());
    }
  };

  const resetSupplierForm = () => {
    setEditingSupplierId(null);
    setSupplierName('');
    setSupplierPhone('');
    setSupplierEmail('');
    setSupplierAddress('');
    setSupplierPan('');
    setSupplierContactPerson('');
    setSupplierPayableBalance(0);
    setSupplierNotes('');
  };

  const editSupplier = (supplierId: string) => {
    const item = suppliers.find((supplierItem) => supplierItem.id === supplierId);
    if (!item) return;
    setEditingSupplierId(item.id);
    setSupplierName(item.name);
    setSupplierPhone(item.phone);
    setSupplierEmail(item.email);
    setSupplierAddress(item.address);
    setSupplierPan(item.pan);
    setSupplierContactPerson(item.contactPerson);
    setSupplierPayableBalance(item.payableBalance);
    setSupplierNotes(item.notes);
  };

  const submitSupplier = (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      name: supplierName,
      phone: supplierPhone,
      email: supplierEmail,
      address: supplierAddress,
      pan: supplierPan,
      contactPerson: supplierContactPerson,
      payableBalance: supplierPayableBalance,
      notes: supplierNotes,
    };
    if (editingSupplierId) {
      updateSupplier(editingSupplierId, payload);
      resetSupplierForm();
      return;
    }
    const ok = addSupplier(payload);
    if (ok) resetSupplierForm();
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: '1 1 auto' }}>
          <label style={{ flex: '1 1 260px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px' }}>
            <Search size={14} color="var(--text-muted)" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tx('Search products, SKU, category, supplier...')} style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%' }} />
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => downloadCsv('rhinopeak-inventory.csv', exportRows)}>
            <Download size={14} /> {tx('Export')}
          </Button>
          <Button variant="secondary" disabled={!canManageInventory} onClick={() => setShowMovementModal(true)} title={canManageInventory ? tx('Record stock movement') : tx('Manage inventory permission required')}>
            <History size={14} /> {tx('Stock Movement')}
          </Button>
          <Button variant="secondary" disabled={!canManageInventory} onClick={() => setShowCategoryModal(true)} title={canManageInventory ? tx('Manage categories') : tx('Manage inventory permission required')}>
            <Tags size={14} /> {tx('Categories')}
          </Button>
          <Button variant="secondary" disabled={!canManageInventory} onClick={() => setShowSupplierModal(true)} title={canManageInventory ? tx('Manage suppliers') : tx('Manage inventory permission required')}>
            <Truck size={14} /> {tx('Suppliers')}
          </Button>
          <Button disabled={!canManageInventory} onClick={() => openProductModal()} title={canManageInventory ? tx('Add product') : tx('Manage inventory permission required')}>
            <Plus size={14} /> {tx('New Product')}
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatTile label={tx('In stock')} value={inventory.filter((product) => product.status === 'In Stock').length} tone="success" />
        <StatTile label={tx('Low stock')} value={inventory.filter((product) => product.status === 'Low Stock').length} tone="warning" />
        <StatTile label={tx('Out of stock')} value={inventory.filter((product) => product.status === 'Out of Stock').length} tone="danger" />
        <StatTile label={tx('FIFO valuation')} value={formatCurrency(valuation)} detail={uiFormat(settings.language, 'Retail value {value}', { value: formatCurrency(retailValue) })} tone="accent" />
      </div>

      {plan === 'free' && (
        <Panel style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {tx('Free plan includes 20 products. Pro adds supplier management, movement history, valuation reports, and unlimited product catalog.')}
          </p>
          <Button onClick={() => setActivePage('billing')}>{tx('Upgrade')}</Button>
        </Panel>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? 'minmax(0,1fr) 340px' : '1fr', gap: 14 }}>
        <Panel>
          <div style={{ overflowX: 'auto' }}>
            <table className="responsive-card-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Product', 'SKU', 'Category', 'Unit', 'Stock', 'Reorder', 'Price', 'Margin', 'Supplier', 'Status', 'Actions'].map((header) => (
                    <th key={header} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 650, textAlign: 'left', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{tx(header)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((product, index) => {
                  const margin = product.price ? ((product.price - product.costPrice) / product.price) * 100 : 0;
                  const status = getStockStatus(product.stock, product.reorderLevel);
                  const meta = unitMeta(product.unit);
                  return (
                    <tr
                      key={product.id}
                      onClick={() => selectProduct(product)}
                      style={{
                        borderBottom: index < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        cursor: 'pointer',
                        background: selected?.id === product.id ? 'var(--accent-glow)' : 'transparent',
                      }}
                    >
                      <td data-label={tx('Product')} data-card-primary="true" style={{ padding: '12px 14px', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}>{tx(product.name)}</td>
                      <td data-label={tx('SKU')} style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'monospace' }}>{product.sku}</td>
                      <td data-label={tx('Category')} style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{tx(product.category)}</td>
                      <td data-label={tx('Unit')} style={{ padding: '12px 14px' }}>
                        <Badge tone="info">{tx(meta.label)}</Badge>
                      </td>
                      <td data-label={tx('Stock')} style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, minWidth: 44 }}>{formatQuantity(product.stock, product.unit, settings.language)}</span>
                          <div style={{ width: 70, height: 5, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, (product.stock / Math.max(product.reorderLevel * 3, 1)) * 100)}%`, height: '100%', background: status === 'In Stock' ? 'var(--success)' : status === 'Low Stock' ? 'var(--warning)' : 'var(--danger)' }} />
                          </div>
                        </div>
                      </td>
                      <td data-label={tx('Reorder')} style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: 13 }}>{formatQuantity(product.reorderLevel, product.unit, settings.language)}</td>
                      <td data-label={tx('Price')} style={{ padding: '12px 14px', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>{formatCurrency(product.price)}</td>
                      <td data-label={tx('Margin')} style={{ padding: '12px 14px', color: margin > 35 ? 'var(--success)' : 'var(--warning)', fontWeight: 700, fontSize: 13 }}>{margin.toFixed(1)}%</td>
                      <td data-label={tx('Supplier')} style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{tx(product.supplier)}</td>
                      <td data-label={tx('Status')} style={{ padding: '12px 14px' }}><Badge tone={statusTone(status)}>{translateStockStatus(settings.language, status)}</Badge></td>
                      <td data-label={tx('Actions')} data-card-actions="true" style={{ padding: '12px 14px' }}>
                        <Link href={`/details/inventory/${product.id}`} onClick={(event) => event.stopPropagation()} style={detailLinkStyle}>
                          <Eye size={14} /> {tx('View')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {selected && (
          <Panel>
            <PanelHeader title={tx(selected.name)} subtitle={tx('Stock movement history')} />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Link href={`/details/inventory/${selected.id}`} style={detailLinkStyle}>
                  <Eye size={14} /> {tx('Open details')}
                </Link>
                <Button variant="secondary" disabled={!canManageInventory} onClick={() => openProductModal(selected)}>
                  <Edit3 size={14} /> {tx('Edit')}
                </Button>
                <Button variant="danger" disabled={!canManageInventory} onClick={() => {
                  const ok = deleteInventoryProduct(selected.id);
                  if (ok) setSelected(null);
                }}>
                  <Trash2 size={14} /> {tx('Delete')}
                </Button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <StatTile label={tx('On hand')} value={formatQuantity(selected.stock, selected.unit, settings.language)} tone={selected.status === 'In Stock' ? 'success' : 'warning'} />
                <StatTile label={tx('Cost value')} value={formatCurrency(selected.stock * selected.costPrice)} tone="accent" />
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>{tx('Movements')}</p>
                {productMovements.length ? productMovements.map((movement) => {
                  const movementUnit = inventory.find((product) => product.id === movement.productId)?.unit ?? selected.unit;
                  return (
                    <div key={movement.id} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10, marginBottom: 10 }}>
                      <p style={{ color: movement.delta >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: 13, fontWeight: 700 }}>
                        {movement.delta >= 0 ? '+' : '-'}{formatQuantity(Math.abs(movement.delta), movementUnit, settings.language)} - {tx(movement.reason)}
                      </p>
                      <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>{uiFormat(settings.language, '{createdAt} by {user}', { createdAt: movement.createdAt, user: movement.user })}</p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{tx(movement.note)}</p>
                    </div>
                  );
                }) : <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{tx('No movements recorded yet.')}</p>}
              </div>
              <DetailRelatedSections detail={selectedDetail} loading={detailLoading} tx={tx} />
            </div>
          </Panel>
        )}
      </div>

      {showProductModal && (
        <Modal title={editingProductId ? tx('Edit stock item') : tx('Add item to stock')} subtitle={tx('Fill only what you know now. You can improve details later.')} onClose={() => {
          setShowProductModal(false);
          resetProductForm();
        }} width={720}>
          <form onSubmit={submitProduct} style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 10, background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 750 }}>{tx('Simple example')}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.55 }}>
                {tx('For milk, write Milk as the item name, choose Dairy, choose Liters, then enter how many liters are available.')}
              </p>
              <Button variant="secondary" onClick={applyMilkExample} style={{ justifySelf: 'start' }}>
                {tx('Use milk example')}
              </Button>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <p style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{tx('1. What is the item?')}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(160px, 0.6fr)', gap: 12 }}>
                <Field label={tx('Item name')} hint={tx('Example: Milk, Rice, Soap')}>
                  <input value={productName} onChange={(event) => setProductName(event.target.value)} placeholder={tx('Milk')} style={{ ...controlStyle, minHeight: 44 }} required />
                </Field>
                <Field label={tx('Item code (optional)')} hint={tx('Optional. Example: MILK-1L')}>
                  <input value={sku} onChange={(event) => setSku(event.target.value)} placeholder={tx('Auto if empty')} style={{ ...controlStyle, minHeight: 44 }} />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'end' }}>
                <Field label={tx('Category')} hint={tx('Group similar items together')}>
                  <select value={category} onChange={(event) => setCategory(event.target.value)} style={{ ...controlStyle, minHeight: 44 }} required>
                    {categories.map((item) => <option key={item} value={item}>{tx(item)}</option>)}
                  </select>
                </Field>
                <Button variant="secondary" onClick={() => setShowCategoryModal(true)} style={{ minHeight: 44 }}>
                  <Tags size={14} /> {tx('Manage')}
                </Button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <p style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{tx('2. How do you count it?')}</p>
              <Field label={tx('Unit')} hint={uiFormat(settings.language, 'Use {unit} for {example}.', { unit: tx(selectedUnit.label), example: tx(selectedUnit.example) })}>
                <select value={unit} onChange={(event) => setUnit(event.target.value)} style={{ ...controlStyle, minHeight: 44 }}>
                  {unitOptions.map((item) => <option key={item.value} value={item.value}>{tx(item.label)} ({item.short})</option>)}
                </select>
              </Field>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <p style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{tx('3. How much is available?')}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <Field label={uiFormat(settings.language, 'Current stock in {unit}', { unit: tx(selectedUnit.label) })} hint={tx('What you have in the shop now')}>
                  <input type="number" min={0} step={quantityStep} inputMode="decimal" value={stock} onChange={(event) => setStock(Math.max(0, Number(event.target.value)))} style={{ ...controlStyle, minHeight: 44 }} />
                </Field>
                <Field label={uiFormat(settings.language, 'Low stock warning in {unit}', { unit: tx(selectedUnit.label) })} hint={tx('Alert when stock reaches this amount')}>
                  <input type="number" min={0} step={quantityStep} inputMode="decimal" value={reorderLevel} onChange={(event) => setReorderLevel(Math.max(0, Number(event.target.value)))} style={{ ...controlStyle, minHeight: 44 }} />
                </Field>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <p style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{tx('4. Price details')}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <Field label={uiFormat(settings.language, 'Selling price per {unit}', { unit: tx(selectedUnit.label) })} hint={tx('Customer pays this amount')}>
                  <input type="number" min={0} step={0.01} inputMode="decimal" value={price} onChange={(event) => setPrice(Math.max(0, Number(event.target.value)))} style={{ ...controlStyle, minHeight: 44 }} />
                </Field>
                <Field label={uiFormat(settings.language, 'Buying cost per {unit}', { unit: tx(selectedUnit.label) })} hint={tx('You paid this amount')}>
                  <input type="number" min={0} step={0.01} inputMode="decimal" value={costPrice} onChange={(event) => setCostPrice(Math.max(0, Number(event.target.value)))} style={{ ...controlStyle, minHeight: 44 }} />
                </Field>
                <Field label={tx('Supplier')} hint={tx('Optional. Who provides this item?')}>
                  <input list="supplier-options" value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder={tx('Local dairy')} style={{ ...controlStyle, minHeight: 44 }} />
                  <datalist id="supplier-options">
                    {suppliers.map((item) => <option key={item.id} value={item.name} />)}
                  </datalist>
                </Field>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={() => {
                setShowProductModal(false);
                resetProductForm();
              }}>{tx('Cancel')}</Button>
              <Button type="submit">{editingProductId ? tx('Update item') : tx('Save item')}</Button>
            </div>
          </form>
        </Modal>
      )}

      {showCategoryModal && (
        <Modal title={tx('Manage categories')} subtitle={tx('Create your own groups like Dairy, Snacks, Hardware, or Services.')} onClose={() => setShowCategoryModal(false)} width={620}>
          <div style={{ display: 'grid', gap: 14 }}>
            <form onSubmit={submitCategory} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'end' }}>
              <Field label={tx('New category')} hint={tx('Use simple names that staff understand')}>
                <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder={tx('Example: Dairy')} style={{ ...controlStyle, minHeight: 44 }} />
              </Field>
              <Button type="submit" style={{ minHeight: 44 }}>
                <Plus size={14} /> {tx('Add')}
              </Button>
            </form>

            <div style={{ display: 'grid', gap: 8 }}>
              {categories.map((item) => {
                const usedCount = inventory.filter((product) => product.category.toLowerCase() === item.toLowerCase()).length;
                const isEditing = editingCategory === item;
                const isProtected = protectedCategories.some((categoryName) => categoryName.toLowerCase() === item.toLowerCase());
                return (
                  <div
                    key={item}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto',
                      gap: 10,
                      alignItems: 'center',
                      padding: 10,
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 10,
                      background: 'var(--bg-primary)',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      {isEditing ? (
                        <input
                          value={editingCategoryName}
                          onChange={(event) => setEditingCategoryName(event.target.value)}
                          style={{ ...controlStyle, minHeight: 40 }}
                          autoFocus
                        />
                      ) : (
                        <>
                          <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 750 }}>{tx(item)}</p>
                          <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                            {uiFormat(settings.language, '{count} items using this category', { count: usedCount })}
                          </p>
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {isEditing ? (
                        <>
                          <Button variant="secondary" onClick={() => {
                            setEditingCategory(null);
                            setEditingCategoryName('');
                          }}>
                            {tx('Cancel')}
                          </Button>
                          <Button onClick={() => saveCategoryName(item)}>{tx('Save name')}</Button>
                        </>
                      ) : (
                        <>
                          <Button variant="secondary" disabled={isProtected} title={isProtected ? tx('Starter categories stay available.') : tx('Rename')} onClick={() => {
                            setEditingCategory(item);
                            setEditingCategoryName(item);
                          }}>
                            <Edit3 size={14} /> {tx('Rename')}
                          </Button>
                          <Button
                            variant="danger"
                            disabled={isProtected || usedCount > 0}
                            title={isProtected ? tx('Starter categories stay available.') : usedCount ? tx('Move products first, then delete.') : tx('Delete category')}
                            onClick={() => {
                              const ok = deleteInventoryCategory(item);
                              if (ok && category.toLowerCase() === item.toLowerCase()) setCategory('General');
                            }}
                          >
                            <Trash2 size={14} /> {tx('Delete')}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}

      {showSupplierModal && (
        <Modal title={tx('Manage suppliers')} subtitle={tx('Keep supplier phone, PAN, address, and payable balance in one place.')} onClose={() => {
          setShowSupplierModal(false);
          resetSupplierForm();
        }} width={760}>
          <div style={{ display: 'grid', gap: 16 }}>
            <form onSubmit={submitSupplier} style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <Field label={tx('Supplier name')}>
                  <input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} style={{ ...controlStyle, minHeight: 44 }} required />
                </Field>
                <Field label={tx('Contact person')}>
                  <input value={supplierContactPerson} onChange={(event) => setSupplierContactPerson(event.target.value)} style={{ ...controlStyle, minHeight: 44 }} />
                </Field>
                <Field label={tx('Phone')}>
                  <input value={supplierPhone} onChange={(event) => setSupplierPhone(event.target.value)} style={{ ...controlStyle, minHeight: 44 }} />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <Field label={tx('Email')}>
                  <input type="email" value={supplierEmail} onChange={(event) => setSupplierEmail(event.target.value)} style={{ ...controlStyle, minHeight: 44 }} />
                </Field>
                <Field label={tx('PAN / VAT No.')}>
                  <input value={supplierPan} onChange={(event) => setSupplierPan(event.target.value)} style={{ ...controlStyle, minHeight: 44 }} />
                </Field>
                <Field label={tx('Payable balance')} hint={tx('Amount you still need to pay this supplier')}>
                  <input type="number" min={0} inputMode="decimal" value={supplierPayableBalance} onChange={(event) => setSupplierPayableBalance(Number(event.target.value))} style={{ ...controlStyle, minHeight: 44 }} />
                </Field>
              </div>
              <Field label={tx('Address')}>
                <input value={supplierAddress} onChange={(event) => setSupplierAddress(event.target.value)} style={{ ...controlStyle, minHeight: 44 }} />
              </Field>
              <Field label={tx('Notes')}>
                <textarea value={supplierNotes} onChange={(event) => setSupplierNotes(event.target.value)} style={{ ...controlStyle, minHeight: 76, resize: 'vertical' }} />
              </Field>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                {editingSupplierId && <Button variant="secondary" onClick={resetSupplierForm}>{tx('Cancel edit')}</Button>}
                <Button type="submit">{editingSupplierId ? tx('Save supplier') : tx('Add supplier')}</Button>
              </div>
            </form>

            <Panel>
              <PanelHeader title={tx('Supplier list')} subtitle={uiFormat(settings.language, '{count} suppliers', { count: suppliers.length })} />
              <div style={{ overflowX: 'auto' }}>
                <table className="responsive-card-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Supplier', 'Contact', 'PAN / VAT No.', 'Payable', 'Actions'].map((header) => (
                        <th key={header} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 650, textAlign: 'left', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{tx(header)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((item, index) => (
                      <tr key={item.id} style={{ borderBottom: index < suppliers.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                        <td data-label={tx('Supplier')} data-card-primary="true" style={{ padding: '11px 14px' }}>
                          <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 750 }}>{item.name}</p>
                          <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>{item.address || tx('No address')}</p>
                        </td>
                        <td data-label={tx('Contact')} style={{ padding: '11px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>
                          <div>{item.contactPerson || tx('No contact person')}</div>
                          <div style={{ color: 'var(--text-muted)' }}>{item.phone || tx('No phone')}</div>
                        </td>
                        <td data-label={tx('PAN / VAT No.')} style={{ padding: '11px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{item.pan || tx('Not added')}</td>
                        <td data-label={tx('Payable')} style={{ padding: '11px 14px', color: item.payableBalance ? 'var(--warning)' : 'var(--success)', fontSize: 13, fontWeight: 750 }}>{formatCurrency(item.payableBalance)}</td>
                        <td data-label={tx('Actions')} data-card-actions="true" style={{ padding: '11px 14px' }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <Button variant="secondary" onClick={() => editSupplier(item.id)}><Edit3 size={14} /> {tx('Edit')}</Button>
                            <Button variant="danger" onClick={() => deleteSupplier(item.id)}><Trash2 size={14} /> {tx('Delete')}</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!suppliers.length && (
                      <tr>
                        <td colSpan={5} style={{ padding: 18, color: 'var(--text-muted)', fontSize: 13 }}>{tx('No suppliers added yet.')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </Modal>
      )}

      {showMovementModal && (
        <Modal title={tx('Record Stock Movement')} subtitle={tx('Stock-in, adjustment, damage, theft, or return')} onClose={() => setShowMovementModal(false)}>
          <form onSubmit={submitMovement} style={{ display: 'grid', gap: 13 }}>
            <Field label={tx('Product')}>
              <select value={movementProductId} onChange={(event) => setMovementProductId(event.target.value)} style={controlStyle}>
                {inventory.map((product) => <option key={product.id} value={product.id}>{tx(product.name)} ({formatQuantity(product.stock, product.unit, settings.language)})</option>)}
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label={tx('Reason')}>
                <select value={movementReason} onChange={(event) => setMovementReason(event.target.value as MovementReason)} style={controlStyle}>
                  {reasons.map((reason) => <option key={reason} value={reason}>{tx(reason)}</option>)}
                </select>
              </Field>
              <Field label={tx('Quantity change')} hint={uiFormat(settings.language, 'Count this in {unit}.', { unit: tx(movementUnit.label) })}>
                <input type="number" min={0} step={movementStep} inputMode="decimal" value={movementDelta} onChange={(event) => setMovementDelta(Number(event.target.value))} style={controlStyle} />
              </Field>
            </div>
            <Field label={tx('Reason note')}>
              <textarea value={movementNote} onChange={(event) => setMovementNote(event.target.value)} style={{ ...controlStyle, minHeight: 90, resize: 'vertical' }} />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowMovementModal(false)}>{tx('Cancel')}</Button>
              <Button type="submit">{tx('Save Movement')}</Button>
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
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{String(row.name ?? row.customer ?? row.productName ?? row.title ?? row.id ?? tx('Record'))}</span>
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
