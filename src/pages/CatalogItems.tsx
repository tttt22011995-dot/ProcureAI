import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Search, Plus, Pencil, Trash2, X, Download, AlertTriangle,
} from 'lucide-react';
import {
  getCatalogItems,
  upsertCatalogItem,
  deleteCatalogItem,
  fetchPurchaseOrders,
  nextCatalogId,
  type CatalogItem,
} from '../lib/data';
import { useRefresh } from '../lib/RefreshContext';

// ─── Constants ───

const SORT_OPTIONS = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
  { value: 'price-asc', label: 'Price (low to high)' },
  { value: 'price-desc', label: 'Price (high to low)' },
];

// ─── Main Component ───

export default function CatalogItems() {
  const { refreshKey, triggerRefresh } = useRefresh();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formUnitPrice, setFormUnitPrice] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);

  // Fetch catalog items
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getCatalogItems().then(data => {
      if (cancelled) return;
      setItems(data);
      setIsLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [refreshKey]);

  // ─── Filtering & Sorting ───

  const filteredAndSorted = useMemo(() => {
    let result = [...items];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.category && i.category.toLowerCase().includes(q))
      );
    }
    switch (sortBy) {
      case 'name': result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc': result.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'price-asc': result.sort((a, b) => a.unitPrice - b.unitPrice); break;
      case 'price-desc': result.sort((a, b) => b.unitPrice - a.unitPrice); break;
    }
    return result;
  }, [items, search, sortBy]);

  // ─── Modal Handlers ───

  const openCreateModal = useCallback(() => {
    setEditingItem(null);
    setFormName('');
    setFormCategory('');
    setFormUnit('');
    setFormUnitPrice('');
    setErrors({});
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((item: CatalogItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category || '');
    setFormUnit(item.unit || '');
    setFormUnitPrice(String(item.unitPrice));
    setErrors({});
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingItem(null);
    setErrors({});
  }, []);

  // ─── Form Validation ───

  const validateForm = useCallback((): boolean => {
    const e: Record<string, string> = {};
    if (!formName.trim()) e.name = 'Item name is required';
    const price = parseFloat(formUnitPrice);
    if (isNaN(price) || price < 0) e.unitPrice = 'Unit price must be a non-negative number';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [formName, formUnitPrice]);

  // ─── Save Item ───

  const handleSave = useCallback(async () => {
    if (!validateForm()) return;
    const item: CatalogItem = {
      id: editingItem?.id ?? nextCatalogId(items),
      name: formName.trim(),
      unitPrice: parseFloat(formUnitPrice),
      category: formCategory.trim() || null,
      unit: formUnit.trim() || null,
    };
    const success = await upsertCatalogItem(item);
    if (!success) return;
    if (editingItem) {
      const next = items.map(i => i.id === editingItem.id ? item : i);
      setItems(next);
    } else {
      setItems(prev => [...prev, item]);
    }
    triggerRefresh();
    closeModal();
  }, [validateForm, editingItem, items, formName, formUnitPrice, formCategory, formUnit, triggerRefresh, closeModal]);

  // ─── Delete Item ───

  const handleDelete = useCallback(async (id: string) => {
    // Check if item is used in any PO
    const pos = await fetchPurchaseOrders();
    const usedIn = pos.filter(po => po.items.some(li => li.name === items.find(i => i.id === id)?.name));
    if (usedIn.length > 0) {
      setDeleteWarning(`This item is used in ${usedIn.length} purchase order(s). Delete anyway?`);
    } else {
      setDeleteWarning(null);
    }
    setDeleteConfirmId(id);
  }, [items]);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    const success = await deleteCatalogItem(deleteConfirmId);
    if (success) {
      const next = items.filter(i => i.id !== deleteConfirmId);
      setItems(next);
      triggerRefresh();
    }
    setDeleteConfirmId(null);
    setDeleteWarning(null);
  }, [deleteConfirmId, items, triggerRefresh]);

  // ─── Export CSV ───

  const handleExportCSV = useCallback(() => {
    const headers = ['ID', 'Name', 'Category', 'Unit', 'Unit Price'];
    const rows = filteredAndSorted.map(i => [i.id, i.name, i.category || '', i.unit || '', String(i.unitPrice)]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'catalog-items.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredAndSorted]);

  // ─── Render ───

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading catalog items...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Catalog Items</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Manage product catalog and unit prices</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="glass-button flex items-center gap-2" onClick={handleExportCSV}>
            <Download size={16} /> Export CSV
          </button>
          <button className="glass-button glass-button-primary flex items-center gap-2" onClick={openCreateModal}>
            <Plus size={16} /> Add Item
          </button>
        </div>
      </div>

      {/* Search and Sort */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input className="glass-input w-full pl-9" placeholder="Search catalog..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="glass-input text-xs py-1.5 px-2" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          {SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      {/* Count */}
      <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        {filteredAndSorted.length !== items.length
          ? `${filteredAndSorted.length} of ${items.length} items`
          : `${items.length} items`}
      </div>

      {/* Table */}
      <div className="glass-card-solid overflow-hidden">
        <div className="overflow-x-auto">
          <table className="glass-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Unit Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No catalog items found</td></tr>
              ) : (
                filteredAndSorted.map(item => (
                  <tr key={item.id}>
                    <td className="font-mono" style={{ color: 'var(--text-muted)' }}>{item.id}</td>
                    <td className="font-medium" style={{ color: 'var(--text)' }}>{item.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{item.category || '-'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{item.unit || '-'}</td>
                    <td style={{ color: 'var(--text)' }}>${item.unitPrice.toLocaleString()}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 rounded-lg transition-colors hover:bg-[rgba(96,165,250,0.1)]" style={{ color: 'var(--blue)' }} onClick={() => openEditModal(item)} title="Edit"><Pencil size={16} /></button>
                        <button className="p-1.5 rounded-lg transition-colors hover:bg-[rgba(251,113,133,0.1)]" style={{ color: 'var(--red)' }} onClick={() => handleDelete(item.id)} title="Delete"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Create/Edit Modal ─── */}
      {modalOpen && (
        <Modal onClose={closeModal} title={editingItem ? `Edit ${editingItem.name}` : 'Add Catalog Item'}>
          <div className="space-y-4">
            <FormField label="Item Name *" error={errors.name}>
              <input className="glass-input w-full" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Enter item name" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Category">
                <input className="glass-input w-full" value={formCategory} onChange={e => setFormCategory(e.target.value)} placeholder="e.g. Electronics" />
              </FormField>
              <FormField label="Unit">
                <input className="glass-input w-full" value={formUnit} onChange={e => setFormUnit(e.target.value)} placeholder="e.g. pcs, kg, m" />
              </FormField>
            </div>
            <FormField label="Unit Price *" error={errors.unitPrice}>
              <input type="number" min={0} step="0.01" className="glass-input w-full" value={formUnitPrice} onChange={e => setFormUnitPrice(e.target.value)} placeholder="0.00" />
            </FormField>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button className="glass-button" onClick={closeModal}>Cancel</button>
              <button className="glass-button glass-button-primary" onClick={handleSave}>{editingItem ? 'Save Changes' : 'Add Item'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteConfirmId && (
        <Modal title="Delete Catalog Item" onClose={() => { setDeleteConfirmId(null); setDeleteWarning(null); }}>
          <div className="space-y-4">
            {deleteWarning && (
              <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'rgba(251,146,60,0.1)', color: 'var(--orange)' }}>
                <AlertTriangle size={16} />
                <span className="text-sm">{deleteWarning}</span>
              </div>
            )}
            <p style={{ color: 'var(--text-secondary)' }}>Are you sure you want to delete <strong style={{ color: 'var(--text)' }}>{items.find(i => i.id === deleteConfirmId)?.name}</strong>? This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="glass-button" onClick={() => { setDeleteConfirmId(null); setDeleteWarning(null); }}>Cancel</button>
              <button className="glass-button" style={{ background: 'var(--red)', color: '#fff', borderColor: 'var(--red)' }} onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Sub-components ───

function FormField({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {children}
      {error && <div className="text-xs mt-1" style={{ color: 'var(--red)' }}>{error}</div>}
    </div>
  );
}

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
