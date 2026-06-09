import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Search, Plus, Eye, Pencil, Copy, Trash2, X, Printer,
  ChevronDown,
} from 'lucide-react';
import {
  fetchVendors,
  fetchPurchaseOrders,
  getCatalogItems,
  nextPONumber,
  upsertPurchaseOrder,
  deletePurchaseOrderById,
  type PurchaseOrder,
  type LineItem,
  type Vendor,
  type CatalogItem,
} from '../lib/data';
import { poStatusColorMap } from '../lib/data';
import { useRefresh } from '../lib/RefreshContext';

// ─── Constants ───

const TAX_RATE = 0.1;

const STATUSES: PurchaseOrder['status'][] = ['ordered', 'confirmed', 'in-transit', 'delivered', 'invoiced'];

const STATUS_COLORS: Record<string, string> = {
  ...poStatusColorMap,
  ordered: 'blue',
};

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Date (newest)' },
  { value: 'date-asc', label: 'Date (oldest)' },
  { value: 'total-desc', label: 'Total (high to low)' },
  { value: 'total-asc', label: 'Total (low to high)' },
  { value: 'status', label: 'Status' },
];

// ─── Helpers ───

function generateLineItemId(): string {
  return `li_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function emptyLineItem(): LineItem {
  return { id: generateLineItemId(), name: '', quantity: 1, unitPrice: 0, total: 0 };
}

function calculateLineTotal(qty: number, price: number): number {
  return Math.round(qty * price * 100) / 100;
}

function calculateSubtotal(items: LineItem[]): number {
  return Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
}

function calculateTax(subtotal: number): number {
  return Math.round(subtotal * TAX_RATE * 100) / 100;
}

function calculateGrandTotal(subtotal: number, tax: number): number {
  return Math.round((subtotal + tax) * 100) / 100;
}

// ─── Main Component ───

export default function PurchaseOrders() {
  const [pos, setPosState] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { refreshKey, triggerRefresh } = useRefresh();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterVendor, setFilterVendor] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [flashId, setFlashId] = useState<string | null>(null);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);

  // Form states
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [items, setItems] = useState<LineItem[]>([emptyLineItem()]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const flashRef = useRef<HTMLTableRowElement | null>(null);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Bulk select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch data on mount and when refreshKey changes
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([
      fetchVendors(),
      fetchPurchaseOrders(),
    ]).then(([v, p]) => {
      if (cancelled) return;
      setVendors(v);
      setPosState(p);
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [refreshKey]);

  // Fetch catalog items separately
  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(false);
    getCatalogItems().then(items => {
      if (cancelled) return;
      setCatalogItems(items);
      setCatalogLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setCatalogError(true);
      setCatalogLoading(false);
    });
    return () => { cancelled = true; };
  }, [refreshKey]);

  // ─── Filtering & Sorting ───

  const filteredAndSorted = useMemo(() => {
    let result = [...pos];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.id.toLowerCase().includes(q) ||
        p.vendorName.toLowerCase().includes(q) ||
        p.items.some(i => i.name.toLowerCase().includes(q))
      );
    }

    if (filterStatus !== 'all') {
      result = result.filter(p => p.status === filterStatus);
    }

    if (filterVendor !== 'all') {
      result = result.filter(p => p.vendorId === filterVendor);
    }

    switch (sortBy) {
      case 'date-desc':
        result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case 'date-asc':
        result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        break;
      case 'total-desc':
        result.sort((a, b) => b.total - a.total);
        break;
      case 'total-asc':
        result.sort((a, b) => a.total - b.total);
        break;
      case 'status':
        result.sort((a, b) => a.status.localeCompare(b.status));
        break;
    }

    return result;
  }, [pos, search, filterStatus, filterVendor, sortBy]);

  // ─── Stats ───

  const stats = useMemo(() => {
    const totalValue = pos.reduce((sum, p) => sum + p.total, 0);
    const vendorCounts: Record<string, number> = {};
    pos.forEach(p => { vendorCounts[p.vendorId] = (vendorCounts[p.vendorId] || 0) + 1; });
    const mostOrderedVendorId = Object.entries(vendorCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const mostOrderedVendor = vendors.find(v => v.id === mostOrderedVendorId)?.name || 'N/A';
    const avgValue = pos.length > 0 ? Math.round(totalValue / pos.length) : 0;
    const thisMonth = new Date();
    const thisMonthStr = `${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthTotal = pos
      .filter(p => p.createdAt.startsWith(thisMonthStr))
      .reduce((sum, p) => sum + p.total, 0);
    return {
      totalValue,
      mostOrderedVendor,
      avgValue,
      thisMonthTotal,
      showing: filteredAndSorted.length,
      total: pos.length,
    };
  }, [pos, filteredAndSorted.length, vendors]);

  // ─── Status counts ───

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    pos.forEach(p => { map[p.status] = (map[p.status] || 0) + 1; });
    return map;
  }, [pos]);

  // ─── Modal Handlers ───

  const openCreateModal = useCallback(() => {
    if (vendors.length === 0) return;
    setEditingPO(null);
    setSelectedVendorId('');
    setDeliveryDate('');
    setItems([emptyLineItem()]);
    setErrors({});
    setModalOpen(true);
  }, [vendors.length]);

  const openEditModal = useCallback((po: PurchaseOrder) => {
    setEditingPO(po);
    setSelectedVendorId(po.vendorId);
    setDeliveryDate(po.deliveryDate);
    setItems(po.items.map(i => ({ ...i })));
    setErrors({});
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingPO(null);
    setSelectedVendorId('');
    setDeliveryDate('');
    setItems([emptyLineItem()]);
    setErrors({});
  }, []);

  // ─── Form Validation ───

  const validateForm = useCallback((): boolean => {
    const e: Record<string, string> = {};
    if (!selectedVendorId) e.vendor = 'Please select a vendor';
    if (!deliveryDate) e.deliveryDate = 'Delivery date is required';
    const validItems = items.filter(i => i.name.trim() && i.quantity > 0);
    if (validItems.length === 0) e.items = 'At least one line item is required';
    items.forEach((item, idx) => {
      if (item.name.trim() && item.quantity <= 0) {
        e[`qty-${idx}`] = 'Qty must be > 0';
      }
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [selectedVendorId, deliveryDate, items]);

  // ─── Save PO ───

  const handleSave = useCallback(async () => {
    if (!validateForm()) return;
    const vendor = vendors.find(v => v.id === selectedVendorId);
    if (!vendor) return;

    const subtotal = calculateSubtotal(items);
    const tax = calculateTax(subtotal);
    const grandTotal = calculateGrandTotal(subtotal, tax);

    if (editingPO) {
      const po: PurchaseOrder = {
        ...editingPO,
        vendorId: selectedVendorId,
        vendorName: vendor.name,
        items: items.filter(i => i.name.trim()),
        total: grandTotal,
        deliveryDate,
      };
      const success = await upsertPurchaseOrder(po);
      if (success) {
        const next = pos.map(p => p.id === editingPO.id ? po : p);
        setPosState(next);
        triggerRefresh();
      }
    } else {
      const newPO: PurchaseOrder = {
        id: nextPONumber(pos),
        vendorId: selectedVendorId,
        vendorName: vendor.name,
        items: items.filter(i => i.name.trim()),
        total: grandTotal,
        status: 'ordered',
        createdAt: new Date().toISOString().split('T')[0],
        deliveryDate,
        priority: 'medium',
      };
      const success = await upsertPurchaseOrder(newPO);
      if (success) {
        setPosState(prev => [newPO, ...prev]);
        triggerRefresh();
      }
    }
    closeModal();
  }, [validateForm, vendors, items, editingPO, selectedVendorId, deliveryDate, pos, triggerRefresh, closeModal]);

  // ─── Duplicate PO ───

  const handleDuplicate = useCallback(async (po: PurchaseOrder) => {
    const newPO: PurchaseOrder = {
      ...po,
      id: nextPONumber(pos),
      status: 'ordered',
      createdAt: new Date().toISOString().split('T')[0],
      items: po.items.map(i => ({ ...i, id: generateLineItemId() })),
    };
    const success = await upsertPurchaseOrder(newPO);
    if (success) {
      setPosState(prev => [newPO, ...prev]);
      triggerRefresh();
      setFlashId(newPO.id);
      setTimeout(() => {
        flashRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      setTimeout(() => setFlashId(null), 2000);
    }
  }, [pos, triggerRefresh]);

  // ─── Delete PO ───

  const handleDelete = useCallback((poId: string) => {
    setDeleteConfirmId(poId);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    const success = await deletePurchaseOrderById(deleteConfirmId);
    if (success) {
      const next = pos.filter(p => p.id !== deleteConfirmId);
      setPosState(next);
      triggerRefresh();
    }
    setDeleteConfirmId(null);
  }, [deleteConfirmId, pos, triggerRefresh]);

  // ─── Line Items ───

  const updateItem = useCallback((idx: number, field: keyof LineItem, value: string | number) => {
    setItems(prev => {
      const next = [...prev];
      const item = { ...next[idx] };
      if (field === 'name') item.name = value as string;
      else if (field === 'quantity') item.quantity = Math.max(0, parseInt(String(value), 10) || 0);
      else if (field === 'unitPrice') item.unitPrice = Math.max(0, parseFloat(String(value)) || 0);
      item.total = calculateLineTotal(item.quantity, item.unitPrice);
      next[idx] = item;
      return next;
    });
  }, []);

  const addItem = useCallback(() => {
    setItems(prev => [...prev, emptyLineItem()]);
  }, []);

  const removeItem = useCallback((idx: number) => {
    setItems(prev => {
      if (prev.length === 1) return [emptyLineItem()];
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  // ─── Subtotals ───

  const subtotal = useMemo(() => calculateSubtotal(items), [items]);
  const tax = useMemo(() => calculateTax(subtotal), [subtotal]);
  const grandTotal = useMemo(() => calculateGrandTotal(subtotal, tax), [subtotal, tax]);

  // ─── Flash effect cleanup ───

  useEffect(() => {
    if (flashId) {
      const timer = setTimeout(() => setFlashId(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [flashId]);

  // ─── Render ───

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading purchase orders...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Purchase Orders</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Track and manage procurement orders</p>
        </div>
        <button
          className="glass-button glass-button-primary flex items-center gap-2"
          onClick={openCreateModal}
          disabled={vendors.length === 0}
        >
          <Plus size={16} /> New PO
        </button>
        {vendors.length === 0 && (
          <div className="text-xs" style={{ color: 'var(--orange)' }}>Please add vendors first</div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="glass-card-solid p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Showing <span style={{ color: 'var(--text)' }}>{stats.showing}</span> of{' '}
          <span style={{ color: 'var(--text)' }}>{stats.total}</span> POs
        </div>
        <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Total Value: <span style={{ color: 'var(--blue)' }}>${stats.totalValue.toLocaleString()}</span>
        </div>
      </div>

      {/* Stats Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <div className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Most Ordered Vendor</div>
          <div className="text-lg font-bold mt-1" style={{ color: 'var(--text)' }}>{stats.mostOrderedVendor}</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Average PO Value</div>
          <div className="text-lg font-bold mt-1" style={{ color: 'var(--blue)' }}>${stats.avgValue.toLocaleString()}</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>This Month's Total Spend</div>
          <div className="text-lg font-bold mt-1" style={{ color: 'var(--text)' }}>${stats.thisMonthTotal.toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            className="glass-input w-full pl-9"
            placeholder="Search POs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="glass-input text-xs py-1.5 px-2" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          {STATUSES.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}</option>
          ))}
        </select>
        <select className="glass-input text-xs py-1.5 px-2" value={filterVendor} onChange={e => setFilterVendor(e.target.value)}>
          <option value="all">All Vendors</option>
          {vendors.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
        <select className="glass-input text-xs py-1.5 px-2" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2 items-center">
        <button className={`glass-button text-xs ${filterStatus === 'all' ? 'glass-button-primary' : ''}`} onClick={() => setFilterStatus('all')}>
          All ({pos.length})
        </button>
        {Object.entries(statusCounts).map(([s, c]) => (
          <button key={s} className={`glass-button text-xs ${filterStatus === s ? 'glass-button-primary' : ''}`} onClick={() => setFilterStatus(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)} ({c})
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="glass-card-solid p-3 flex items-center gap-3">
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{selectedIds.size} selected</span>
          <button
            className="glass-button"
            style={{ padding: '6px 14px', fontSize: 13, background: 'var(--red)', color: '#fff', borderColor: 'var(--red)' }}
            onClick={() => {
              if (selectedIds.size === 1) {
                setDeleteConfirmId([...selectedIds][0]);
              } else {
                setBulkDeleteOpen(true);
              }
            }}
          >Delete Selected</button>
          <button className="glass-button" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setSelectedIds(new Set())}>Clear</button>
        </div>
      )}

      {/* PO Table */}
      <div className="glass-card-solid overflow-hidden">
        <div className="overflow-x-auto">
          <table className="glass-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}><input type="checkbox" checked={filteredAndSorted.length > 0 && filteredAndSorted.every(p => selectedIds.has(p.id))} onChange={e => setSelectedIds(e.target.checked ? new Set(filteredAndSorted.map(p => p.id)) : new Set())} /></th>
                <th>PO Number</th>
                <th>Vendor</th>
                <th>Date</th>
                <th>Items</th>
                <th>Grand Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No purchase orders found</td></tr>
              ) : (
                filteredAndSorted.map(po => {
                  const isFlashing = flashId === po.id;
                  return (
                    <tr key={po.id} ref={isFlashing ? flashRef : undefined} style={{ background: isFlashing ? 'rgba(96,165,250,0.15)' : undefined, transition: 'background 0.3s' }}>
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(po.id)} onChange={e => setSelectedIds(prev => { const next = new Set(prev); e.target.checked ? next.add(po.id) : next.delete(po.id); return next; })} />
                      </td>
                      <td className="font-mono font-medium" style={{ color: 'var(--text)' }}>{po.id}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{po.vendorName}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{po.createdAt}</td>
                      <td style={{ color: 'var(--text-secondary)', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: '240px' }}>{po.items.map(i => i.name).join(', ')}</td>
                      <td className="font-semibold" style={{ color: 'var(--text)' }}>${po.total.toLocaleString()}</td>
                      <td><span className={`glass-badge glass-badge-${STATUS_COLORS[po.status] ?? 'blue'}`}>{po.status}</span></td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button className="p-1.5 rounded-lg transition-colors hover:bg-[rgba(96,165,250,0.1)]" style={{ color: 'var(--text-muted)' }} onClick={() => setViewingPO(po)} title="View"><Eye size={16} /></button>
                          <button className="p-1.5 rounded-lg transition-colors hover:bg-[rgba(96,165,250,0.1)]" style={{ color: 'var(--blue)' }} onClick={() => openEditModal(po)} title="Edit"><Pencil size={16} /></button>
                          <button className="p-1.5 rounded-lg transition-colors hover:bg-[rgba(96,165,250,0.1)]" style={{ color: 'var(--cyan)' }} onClick={() => handleDuplicate(po)} title="Duplicate"><Copy size={16} /></button>
                          <button className="p-1.5 rounded-lg transition-colors hover:bg-[rgba(251,113,133,0.1)]" style={{ color: 'var(--red)' }} onClick={() => handleDelete(po.id)} title="Delete"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Create/Edit Modal ─── */}
      {modalOpen && (
        <Modal onClose={closeModal}>
          <div className="glass-panel p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto" style={{ borderRadius: 24 }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{editingPO ? `Editing ${editingPO.id}` : 'Create New Purchase Order'}</h2>
              <button onClick={closeModal} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            {vendors.length === 0 ? (
              <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Please add vendors first</div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-semibold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>PO Number</label>
                  <input className="glass-input w-full bg-[rgba(0,0,0,0.05)]" value={editingPO?.id || nextPONumber(pos)} disabled />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>Vendor *</label>
                  <VendorCombobox vendors={vendors} value={selectedVendorId} onChange={setSelectedVendorId} error={errors.vendor} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>Expected Delivery Date *</label>
                  <input type="date" className={`glass-input w-full ${errors.deliveryDate ? 'border-[var(--red)]' : ''}`} style={errors.deliveryDate ? { borderColor: 'var(--red)' } : undefined} value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
                  {errors.deliveryDate && <div className="text-xs mt-1" style={{ color: 'var(--red)' }}>{errors.deliveryDate}</div>}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Line Items</label>
                    <button className="glass-button text-xs py-1 px-3 flex items-center gap-1" onClick={addItem}><Plus size={12} /> Add Item</button>
                  </div>
                  {errors.items && <div className="text-xs mb-2" style={{ color: 'var(--red)' }}>{errors.items}</div>}
                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <LineItemRow
                        key={item.id}
                        item={item}
                        idx={idx}
                        isLast={idx === items.length - 1}
                        updateItem={updateItem}
                        removeItem={removeItem}
                        addItem={addItem}
                        error={errors[`qty-${idx}`]}
                        catalogItems={catalogItems}
                        catalogLoading={catalogLoading}
                        catalogError={catalogError}
                      />
                    ))}
                  </div>
                </div>
                <div className="glass-card-solid p-4">
                  <div className="flex items-center justify-between text-sm mb-2"><span style={{ color: 'var(--text-muted)' }}>Subtotal</span><span style={{ color: 'var(--text)' }}>${subtotal.toLocaleString()}</span></div>
                  <div className="flex items-center justify-between text-sm mb-2"><span style={{ color: 'var(--text-muted)' }}>Tax (10%)</span><span style={{ color: 'var(--text)' }}>${tax.toLocaleString()}</span></div>
                  <div className="flex items-center justify-between text-lg font-bold pt-2" style={{ borderTop: '1px solid var(--glass-border)' }}><span style={{ color: 'var(--text)' }}>Grand Total</span><span style={{ color: 'var(--blue)' }}>${grandTotal.toLocaleString()}</span></div>
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button className="glass-button" onClick={closeModal}>Cancel</button>
                  <button className="glass-button glass-button-primary" onClick={handleSave}>{editingPO ? 'Save Changes' : 'Create PO'}</button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ─── View/Print Modal ─── */}
      {viewingPO && (
        <Modal onClose={() => setViewingPO(null)}>
          <div className="glass-panel p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto print-area" style={{ borderRadius: 24 }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Purchase Order: {viewingPO.id}</h2>
              <div className="flex items-center gap-2">
                <button className="glass-button glass-button-primary flex items-center gap-2" onClick={() => printPO(viewingPO)}><Printer size={14} /> Print</button>
                <button onClick={() => setViewingPO(null)} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
              </div>
            </div>
            <div className="space-y-6">
              <div className="text-center pb-4" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>ProcureAI</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Supply Chain Management</div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div><div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Vendor</div><div className="font-semibold" style={{ color: 'var(--text)' }}>{viewingPO.vendorName}</div></div>
                <div className="text-right"><div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>PO Number</div><div className="font-mono font-bold" style={{ color: 'var(--text)' }}>{viewingPO.id}</div></div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div><div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Order Date</div><div style={{ color: 'var(--text-secondary)' }}>{viewingPO.createdAt}</div></div>
                <div className="text-right"><div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Expected Delivery</div><div style={{ color: 'var(--text-secondary)' }}>{viewingPO.deliveryDate}</div></div>
              </div>
              <div>
                <table className="glass-table">
                  <thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
                  <tbody>
                    {viewingPO.items.map(item => (
                      <tr key={item.id}><td style={{ color: 'var(--text)' }}>{item.name}</td><td>{item.quantity}</td><td>${item.unitPrice.toLocaleString()}</td><td style={{ color: 'var(--text)' }}>${item.total.toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="glass-card-solid p-4">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span style={{ color: 'var(--text-muted)' }}>Subtotal</span><span style={{ color: 'var(--text)' }}>${(viewingPO.subtotal ?? viewingPO.total).toLocaleString()}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span style={{ color: 'var(--text-muted)' }}>Tax (10%)</span><span style={{ color: 'var(--text)' }}>${(viewingPO.tax ?? 0).toLocaleString()}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, borderTop: '1px solid var(--glass-border)', paddingTop: 8 }}><span style={{ color: 'var(--text)' }}>Grand Total</span><span style={{ color: 'var(--blue)' }}>${viewingPO.total.toLocaleString()}</span></div>
                </div>
              </div>
              <div className="text-center text-xs pt-4" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--glass-border)' }}>This is a computer-generated document. For questions, contact procurement@procureai.com</div>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteConfirmId && (
        <Modal title="Delete Purchase Order" onClose={() => setDeleteConfirmId(null)}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Are you sure you want to delete <strong style={{ color: 'var(--text)' }}>{pos.find(p => p.id === deleteConfirmId)?.id}</strong>? This action cannot be undone.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="glass-button" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
            <button className="glass-button" style={{ background: 'var(--red)', color: '#fff', borderColor: 'var(--red)' }} onClick={confirmDelete}>Delete</button>
          </div>
        </Modal>
      )}

      {/* ─── Bulk Delete Confirmation Modal ─── */}
      {bulkDeleteOpen && (
        <Modal title="Delete Purchase Orders" onClose={() => setBulkDeleteOpen(false)}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Delete <strong style={{ color: 'var(--text)' }}>{selectedIds.size}</strong> purchase orders? This cannot be undone.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="glass-button" onClick={() => setBulkDeleteOpen(false)}>Cancel</button>
            <button className="glass-button" style={{ background: 'var(--red)', color: '#fff', borderColor: 'var(--red)' }} onClick={async () => {
              for (const id of selectedIds) {
                await deletePurchaseOrderById(id);
              }
              const next = pos.filter(p => !selectedIds.has(p.id));
              setPosState(next);
              setSelectedIds(new Set());
              setBulkDeleteOpen(false);
              triggerRefresh();
            }}>Delete All</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Vendor Combobox ───

function VendorCombobox({ vendors, value, onChange, error }: { vendors: Vendor[]; value: string; onChange: (id: string) => void; error?: string }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = vendors.find(v => v.id === value);
  const filtered = vendors.filter(v => v.name.toLowerCase().includes(search.toLowerCase()));

  const handleSelect = (vendor: Vendor) => {
    onChange(vendor.id);
    setSearch('');
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <input ref={inputRef} className={`glass-input w-full pr-10 ${error ? 'border-[var(--red)]' : ''}`} style={error ? { borderColor: 'var(--red)' } : undefined} placeholder="Select vendor..." value={search || selected?.name || ''} onChange={e => { setSearch(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: 'var(--text-muted)' }} onMouseDown={e => { e.preventDefault(); setOpen(o => !o); inputRef.current?.focus(); }} />
      </div>
      {error && <div className="text-xs mt-1" style={{ color: 'var(--red)' }}>{error}</div>}
      {open && (
        <div ref={listRef} className="absolute left-0 right-0 top-full mt-1 glass-panel z-20 max-h-[200px] overflow-y-auto" style={{ borderRadius: 12 }}>
          {filtered.length === 0 ? <div className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>No vendors found</div> : filtered.map(v => (
            <div key={v.id} className="px-4 py-2.5 text-sm cursor-pointer transition-colors hover:bg-[rgba(96,165,250,0.08)]" style={{ color: v.id === value ? 'var(--blue)' : 'var(--text-secondary)' }} onMouseDown={() => handleSelect(v)}>{v.name}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Line Item Row ───

function LineItemRow({
  item, idx, isLast, updateItem, removeItem, addItem, error, catalogItems, catalogLoading, catalogError,
}: {
  item: LineItem;
  idx: number;
  isLast: boolean;
  updateItem: (idx: number, field: keyof LineItem, value: string | number) => void;
  removeItem: (idx: number) => void;
  addItem: () => void;
  error?: string;
  catalogItems: CatalogItem[];
  catalogLoading: boolean;
  catalogError: boolean;
}) {
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  const matchingItems = catalogItems.filter(c =>
    c.name.toLowerCase().includes(item.name.toLowerCase()) && item.name.length > 0
  ).slice(0, 6);

  const handleNameSelect = (catalogItem: CatalogItem) => {
    updateItem(idx, 'name', catalogItem.name);
    updateItem(idx, 'unitPrice', catalogItem.unitPrice);
    setAutocompleteOpen(false);
    setTimeout(() => qtyInputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent, field: string) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      if (field === 'price' && isLast) {
        e.preventDefault();
        addItem();
        setTimeout(() => {
          const nameInputs = document.querySelectorAll('input[data-field="name"]');
          (nameInputs[nameInputs.length - 1] as HTMLInputElement)?.focus();
        }, 0);
      } else if (field === 'name') {
        e.preventDefault();
        qtyInputRef.current?.focus();
      } else if (field === 'qty') {
        e.preventDefault();
        priceInputRef.current?.focus();
      }
    }
  };

  return (
    <div className="glass-card-solid p-3">
      <div className="grid grid-cols-12 gap-3 items-center">
        <div className="col-span-5 relative">
          <input ref={nameInputRef} data-field="name" className="glass-input w-full" placeholder="Item name..." value={item.name} onChange={e => { updateItem(idx, 'name', e.target.value); setAutocompleteOpen(true); }} onFocus={() => setAutocompleteOpen(true)} onBlur={() => setTimeout(() => setAutocompleteOpen(false), 150)} onKeyDown={e => handleKeyDown(e, 'name')} />
          {catalogLoading && <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: 'var(--text-muted)' }}>Loading...</div>}
          {!catalogLoading && catalogError && <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: 'var(--orange)' }}>Offline</div>}
          {!catalogLoading && !catalogError && catalogItems.length === 0 && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: 'var(--text-muted)' }}>No items</div>
          )}
          {autocompleteOpen && matchingItems.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 glass-panel z-10 max-h-[160px] overflow-y-auto" style={{ borderRadius: 10 }}>
              {matchingItems.map((c, i) => (
                <div key={i} className="px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-[rgba(96,165,250,0.08)]" style={{ color: 'var(--text-secondary)' }} onMouseDown={() => handleNameSelect(c)}>
                  {c.name} <span style={{ color: 'var(--text-muted)' }}>${c.unitPrice}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="col-span-2">
          <input ref={qtyInputRef} type="number" min={0} className="glass-input w-full" style={error ? { borderColor: 'var(--red)' } : undefined} placeholder="Qty" value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', e.target.value)} onKeyDown={e => handleKeyDown(e, 'qty')} />
          {error && <div className="text-xs mt-0.5" style={{ color: 'var(--red)' }}>{error}</div>}
        </div>
        <div className="col-span-2">
          <input ref={priceInputRef} type="number" min={0} step="0.01" className="glass-input w-full" placeholder="Price" value={item.unitPrice || ''} onChange={e => updateItem(idx, 'unitPrice', e.target.value)} onKeyDown={e => handleKeyDown(e, 'price')} />
        </div>
        <div className="col-span-2 text-right"><span className="font-semibold" style={{ color: 'var(--text)' }}>${item.total.toLocaleString()}</span></div>
        <div className="col-span-1 flex justify-center">
          <button className="p-1.5 rounded-lg transition-colors hover:bg-[rgba(251,113,133,0.1)]" style={{ color: 'var(--red)' }} onClick={() => removeItem(idx)}><X size={14} /></button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Wrapper ───

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title?: string }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass-panel p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ borderRadius: 24 }}>
        {title && <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{title}</h2><button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={18} /></button></div>}
        {children}
      </div>
    </div>
  );
}

// ─── Print Helper ───

function printPO(po: PurchaseOrder) {
  const printArea = document.querySelector('.print-area');
  if (!printArea) return;
  const printRoot = document.createElement('div');
  printRoot.id = 'po-print-root';
  printRoot.style.cssText = 'position:fixed;left:0;top:0;width:100%;background:#fff;z-index:9999;padding:40px;';
  printRoot.innerHTML = `<div style="font-family:Inter,system-ui,sans-serif;max-width:800px;margin:0 auto;"><div style="text-align:center;margin-bottom:32px;"><div style="font-size:32px;font-weight:700;color:#0F172A;">ProcureAI</div><div style="font-size:14px;color:#64748B;">Supply Chain Management</div></div><div style="border-top:2px solid #E2E8F0;padding-top:24px;"><div style="display:flex;justify-content:space-between;margin-bottom:24px;"><div><div style="font-size:12px;font-weight:600;text-transform:uppercase;color:#64748B;margin-bottom:4px;">Vendor</div><div style="font-size:18px;font-weight:600;color:#0F172A;">${po.vendorName}</div></div><div style="text-align:right;"><div style="font-size:12px;font-weight:600;text-transform:uppercase;color:#64748B;margin-bottom:4px;">PO Number</div><div style="font-size:18px;font-weight:700;color:#2563EB;">${po.id}</div></div></div><div style="display:flex;justify-content:space-between;margin-bottom:24px;"><div><div style="font-size:12px;font-weight:600;text-transform:uppercase;color:#64748B;margin-bottom:4px;">Order Date</div><div style="color:#334155;">${po.createdAt}</div></div><div style="text-align:right;"><div style="font-size:12px;font-weight:600;text-transform:uppercase;color:#64748B;margin-bottom:4px;">Expected Delivery</div><div style="color:#334155;">${po.deliveryDate}</div></div></div><table style="width:100%;border-collapse:collapse;margin-bottom:24px;"><thead><tr style="background:#F1F5F9;"><th style="padding:12px;text-align:left;font-size:12px;font-weight:600;text-transform:uppercase;color:#64748B;border-bottom:2px solid #E2E8F0;">Item</th><th style="padding:12px;text-align:right;font-size:12px;font-weight:600;text-transform:uppercase;color:#64748B;border-bottom:2px solid #E2E8F0;">Qty</th><th style="padding:12px;text-align:right;font-size:12px;font-weight:600;text-transform:uppercase;color:#64748B;border-bottom:2px solid #E2E8F0;">Unit Price</th><th style="padding:12px;text-align:right;font-size:12px;font-weight:600;text-transform:uppercase;color:#64748B;border-bottom:2px solid #E2E8F0;">Total</th></tr></thead><tbody>${po.items.map(item => `<tr><td style="padding:12px;border-bottom:1px solid #E2E8F0;color:#0F172A;">${item.name}</td><td style="padding:12px;text-align:right;border-bottom:1px solid #E2E8F0;color:#334155;">${item.quantity}</td><td style="padding:12px;text-align:right;border-bottom:1px solid #E2E8F0;color:#334155;">$${item.unitPrice.toLocaleString()}</td><td style="padding:12px;text-align:right;border-bottom:1px solid #E2E8F0;color:#0F172A;font-weight:600;">$${item.total.toLocaleString()}</td></tr>`).join('')}</tbody></table><div style="border-top:2px solid #E2E8F0;padding-top:16px;margin-top:16px;"><div style="display:flex;justify-content:space-between;font-size:14px;color:#64748B;margin-bottom:8px;"><span>Subtotal</span><span>$${(po.subtotal ?? po.total).toLocaleString()}</span></div><div style="display:flex;justify-content:space-between;font-size:14px;color:#64748B;margin-bottom:8px;"><span>Tax (10%)</span><span>$${(po.tax ?? 0).toLocaleString()}</span></div><div style="display:flex;justify-content:space-between;font-size:20px;font-weight:700;color:#2563EB;"><span>Grand Total</span><span>$${po.total.toLocaleString()}</span></div></div><div style="text-align:center;font-size:12px;color:#94A3B8;padding-top:24px;border-top:2px solid #E2E8F0;">This is a computer-generated document. For questions, contact procurement@procureai.com</div></div></div>`;
  document.body.appendChild(printRoot);
  const rootEl = document.getElementById('root');
  if (rootEl) rootEl.style.display = 'none';
  setTimeout(() => {
    window.print();
    setTimeout(() => { printRoot.remove(); if (rootEl) rootEl.style.display = ''; }, 100);
  }, 100);
}
