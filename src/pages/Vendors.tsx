import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Search, Plus, Download, X, Pencil, Trash2, Check, Star, Mail, Phone, Clock, FileText,
} from 'lucide-react';
import {
  fetchVendors,
  fetchPurchaseOrders,
  fetchVendorRatings,
  getVendors,
  getPurchaseOrders,
  getVendorRatings,
  upsertVendor,
  deleteVendor,
  nextVendorCode,
  type Vendor,
  type VendorRating,
  type PurchaseOrder,
} from '../lib/data';
import { useRefresh } from '../lib/RefreshContext';

// ─── Constants ───

const CATEGORIES = ['Electronics', 'Logistics', 'Raw Materials', 'Office Supplies', 'IT Services', 'Packaging'] as const;
const CATEGORY_COLORS: Record<string, string> = {
  Electronics: 'blue',
  Logistics: 'green',
  'Raw Materials': 'orange',
  'Office Supplies': 'purple',
  'IT Services': 'orange',
  Packaging: 'cyan',
};
const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  'under-review': 'orange',
  inactive: 'red',
};
const PAYMENT_TERMS = ['Net 30', 'Net 60', 'Net 90'] as const;
const STATUSES = ['active', 'under-review', 'inactive'] as const;

const OPEN_PO_STATUSES = new Set(['draft', 'pending', 'approved', 'shipped']);

// ─── Helpers ───

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function highlightMatch(text: string, term: string): React.ReactNode {
  if (!term) return text;
  const idx = normalize(text).indexOf(normalize(term));
  if (idx === -1) return text;
  const start = idx;
  const end = idx + term.length;
  return (
    <>
      {text.slice(0, start)}
      <mark style={{ background: '#FACC15', color: 'var(--text)', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}

function countOpenPOs(vendor: Vendor, pos: PurchaseOrder[]): number {
  return pos.filter(po => {
    const matchId = po.vendorId === vendor.id;
    const matchName = !matchId && normalize(po.vendorName) === normalize(vendor.name);
    return (matchId || matchName) && OPEN_PO_STATUSES.has(po.status);
  }).length;
}

function lastOrderDate(vendorId: string, pos: PurchaseOrder[]): string {
  const vendorPOs = pos.filter(po => po.vendorId === vendorId);
  if (!vendorPOs.length) return '';
  return vendorPOs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].createdAt;
}

// ─── Empty vendor template ───

function emptyVendor(code: string): Vendor {
  return {
    id: `v_${Date.now()}`,
    vendorCode: code,
    name: '',
    category: CATEGORIES[0],
    location: '',
    rating: 0,
    status: 'active',
    contractEnd: '',
    email: '',
    spend: 0,
    contact: '',
    phone: '',
    paymentTerms: 'Net 30',
    leadTime: 0,
    notes: '',
  };
}

// ─── Component ───

export default function Vendors() {
  const [vendors, setVendorsState] = useState<Vendor[]>([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState<Vendor | null>(null);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [form, setForm] = useState<Vendor>(emptyVendor('VND-000'));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);

  const { refreshKey, triggerRefresh } = useRefresh();

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      fetchVendors(),
      fetchPurchaseOrders(),
      fetchVendorRatings(),
    ]).finally(() => setIsLoading(false));
  }, [refreshKey]);

  const pos = getPurchaseOrders();
  const ratings = getVendorRatings();

  // ─── Filtered vendors ───

  const filtered = useMemo(() => {
    const q = normalize(search);
    return vendors.filter(v => {
      const matchCategory = filterCategory === 'all' || v.category === filterCategory;
      const matchStatus = filterStatus === 'all' || v.status === filterStatus;
      const matchSearch = !q || [
        v.name, v.contact, v.email, v.category,
      ].some(f => normalize(f).includes(q));
      return matchCategory && matchStatus && matchSearch;
    });
  }, [vendors, search, filterCategory, filterStatus]);

  // ─── Modal open/close ───

  const openAddModal = useCallback(() => {
    const code = nextVendorCode();
    setEditingVendor(null);
    setForm(emptyVendor(code));
    setErrors({});
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((v: Vendor) => {
    setEditingVendor(v);
    setForm({ ...v });
    setErrors({});
    setModalOpen(true);
    setSelected(null);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingVendor(null);
    setErrors({});
  }, []);

  // ─── Form validation ───

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Company name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Invalid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ─── Save ───

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      const success = await upsertVendor(form);
      if (success) {
        if (editingVendor) {
          setVendorsState(prev => prev.map(v => v.id === editingVendor.id ? { ...form } : v));
        } else {
          setVendorsState(prev => [...prev, { ...form }]);
        }
        triggerRefresh();
      }
      closeModal();
    } finally {
      setIsSaving(false);
    }
  }, [form, editingVendor, closeModal, triggerRefresh]);

  // ─── Delete ───

  const handleDelete = useCallback(async (v: Vendor) => {
    setIsSaving(true);
    try {
      const success = await deleteVendor(v.id);
      if (success) {
        setVendorsState(prev => prev.filter(x => x.id !== v.id));
        setDeleteTarget(null);
        if (selected?.id === v.id) setSelected(null);
        setCompareIds(prev => { const n = new Set(prev); n.delete(v.id); return n; });
        triggerRefresh();
      }
    } finally {
      setIsSaving(false);
    }
  }, [selected, triggerRefresh]);

  // ─── Compare toggle ───

  const toggleCompare = useCallback((id: string) => {
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 2) return prev; // block 3rd
        next.add(id);
      }
      return next;
    });
  }, []);

  // ─── Export CSV ───

  const exportCSV = useCallback(() => {
    if (!filtered.length) {
      alert('No vendors to export');
      return;
    }
    const headers = ['Vendor Code', 'Company Name', 'Contact', 'Email', 'Phone', 'Category', 'Status', 'Payment Terms', 'Lead Time (days)', 'Location', 'Rating'];
    const rows = filtered.map(v => [
      v.vendorCode, v.name, v.contact, v.email, v.phone, v.category, v.status, v.paymentTerms, String(v.leadTime), v.location, String(v.rating),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vendors.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  // ─── Rating lookup ───

  const ratingFor = (id: string): VendorRating | undefined => ratings.find(r => r.vendorId === id);
  const openPOCount = (v: Vendor) => countOpenPOs(v, pos);

  // ─── Compare data ───

  const compareVendors = useMemo(() => {
    return vendors.filter(v => compareIds.has(v.id));
  }, [vendors, compareIds]);

  // ─── Initial data ───

  useEffect(() => {
    setVendorsState(getVendors());
  }, [isLoading]);

  // ─── Render ───

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading vendors...</div>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Left filter panel */}
      <div className="hidden lg:flex flex-col gap-4 w-[200px] flex-shrink-0">
        <div className="glass-card-solid p-4">
          <h4 className="text-xs font-semibold uppercase mb-3" style={{ color: 'var(--text-muted)' }}>Category</h4>
          <div className="flex flex-col gap-1.5">
            <button
              className={`glass-button text-xs text-left ${filterCategory === 'all' ? 'glass-button-primary' : ''}`}
              onClick={() => setFilterCategory('all')}
            >All</button>
            {CATEGORIES.map(c => (
              <button
                key={c}
                className={`glass-button text-xs text-left ${filterCategory === c ? 'glass-button-primary' : ''}`}
                onClick={() => setFilterCategory(c)}
              >{c}</button>
            ))}
          </div>
        </div>
        <div className="glass-card-solid p-4">
          <h4 className="text-xs font-semibold uppercase mb-3" style={{ color: 'var(--text-muted)' }}>Status</h4>
          <div className="flex flex-col gap-1.5">
            <button
              className={`glass-button text-xs text-left ${filterStatus === 'all' ? 'glass-button-primary' : ''}`}
              onClick={() => setFilterStatus('all')}
            >All</button>
            {STATUSES.map(s => (
              <button
                key={s}
                className={`glass-button text-xs text-left ${filterStatus === s ? 'glass-button-primary' : ''}`}
                onClick={() => setFilterStatus(s)}
              >{s.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Vendor Directory
          </h1>
          <div className="flex items-center gap-2">
            <button className="glass-button flex items-center gap-2 text-xs" onClick={exportCSV}>
              <Download size={14} /> Export CSV
            </button>
            <button className="glass-button glass-button-primary flex items-center gap-2 text-xs" onClick={openAddModal} disabled={isSaving}>
              <Plus size={14} /> Add Vendor
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            className="glass-input w-full pl-9 pr-10"
            placeholder="Search vendors by company, contact, email, category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => setSearch('')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Mobile filters */}
        <div className="flex lg:hidden flex-wrap gap-2">
          <select className="glass-input text-xs py-1.5 px-2" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="glass-input text-xs py-1.5 px-2" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('-', ' ')}</option>)}
          </select>
        </div>

        {/* Count */}
        <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {search
            ? `${filtered.length} of ${vendors.length} vendors`
            : `${vendors.length} vendors`}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && search && (
          <div className="glass-card p-8 text-center" style={{ color: 'var(--text-muted)' }}>
            No vendors match &lsquo;{search}&rsquo;
          </div>
        )}

        {/* Card grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(v => {
            const catColor = CATEGORY_COLORS[v.category] ?? 'blue';
            const openCount = openPOCount(v);
            const isCompareSelected = compareIds.has(v.id);
            return (
              <div
                key={v.id}
                className="glass-card p-5 cursor-pointer relative group"
                onClick={() => setSelected(s => s?.id === v.id ? null : v)}
              >
                {/* Compare checkbox */}
                <div
                  className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => { e.stopPropagation(); toggleCompare(v.id); }}
                >
                  <button
                    className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors ${isCompareSelected ? 'glass-button-primary' : ''}`}
                    style={{
                      borderColor: isCompareSelected ? 'transparent' : 'var(--glass-border)',
                      background: isCompareSelected ? undefined : 'var(--surface)',
                      color: isCompareSelected ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    {isCompareSelected ? <Check size={12} /> : null}
                  </button>
                </div>

                {/* Avatar + Name */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{
                      background: `var(--${catColor})`,
                      opacity: 0.18,
                      color: `var(--${catColor})`,
                    }}
                  >
                    {initials(v.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate" style={{ color: 'var(--text)' }}>
                      {highlightMatch(v.name, search)}
                    </div>
                    <span className={`glass-badge glass-badge-${catColor} text-[10px] mt-0.5`}>
                      {highlightMatch(v.category, search)}
                    </span>
                  </div>
                </div>

                {/* Contact info */}
                <div className="space-y-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <div className="flex items-center gap-2 truncate">
                    <Mail size={12} style={{ color: 'var(--text-muted)' }} />
                    {highlightMatch(v.contact, search)}
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <Phone size={12} style={{ color: 'var(--text-muted)' }} />
                    {v.phone || '—'}
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                    {v.leadTime} day{v.leadTime !== 1 ? 's' : ''} lead time
                  </div>
                </div>

                {/* Status + Open PO badge */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className={`glass-badge glass-badge-${STATUS_COLORS[v.status] ?? 'blue'}`}>
                    {v.status.replace('-', ' ')}
                  </span>
                  {openCount > 0 && (
                    <span className="glass-badge glass-badge-blue">
                      <FileText size={10} /> {openCount} open PO{openCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--glass-border)' }}>
                  <button
                    className="glass-button text-xs py-1 px-3 flex items-center gap-1"
                    onClick={e => { e.stopPropagation(); openEditModal(v); }}
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    className="glass-button text-xs py-1 px-3 flex items-center gap-1"
                    style={{ color: 'var(--red)' }}
                    onClick={e => { e.stopPropagation(); setSelected(null); setDeleteTarget(v); }}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Compare button */}
        {compareIds.size === 2 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
            <button
              className="glass-button glass-button-primary flex items-center gap-2"
              onClick={() => setShowCompare(true)}
            >
              Compare Vendors
            </button>
            <button
              className="glass-button text-xs"
              onClick={() => setCompareIds(new Set())}
            >
              Clear Selection
            </button>
          </div>
        )}

        {/* Compare blocked message */}
        {compareIds.size >= 2 && (
          <div className="text-xs text-center" style={{ color: 'var(--orange)' }}>
            Maximum 2 vendors can be compared at once.
          </div>
        )}
      </div>

      {/* Detail Slide-in Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 w-[360px] glass-panel z-30 overflow-y-auto transition-transform"
        style={{
          borderRadius: '28px 0 0 28px',
          transform: selected ? 'translateX(0)' : 'translateX(100%)',
          transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)',
          transitionDuration: '280ms',
        }}
      >
        {selected && (
          <DetailPanel
            vendor={selected}
            rating={ratingFor(selected.id)}
            openPOs={openPOCount(selected)}
            totalPOs={pos.filter(po => po.vendorId === selected.id).length}
            lastOrder={lastOrderDate(selected.id, pos)}
            onClose={() => setSelected(null)}
            onEdit={() => openEditModal(selected)}
            onDelete={() => { setSelected(null); setDeleteTarget(selected); }}
          />
        )}
      </div>

      {/* Backdrop for detail panel */}
      {selected && (
        <div
          className="fixed inset-0 z-20"
          style={{ background: 'rgba(0,0,0,0.15)' }}
          onClick={() => setSelected(null)}
        />
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="glass-panel p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ borderRadius: 24 }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                {editingVendor ? 'Edit Vendor' : 'Add Vendor'}
              </h2>
              <button onClick={closeModal} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div className="space-y-4">
              {/* Company Name */}
              <div>
                <label className="text-xs font-semibold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>
                  Company Name *
                </label>
                <input
                  className={`glass-input w-full ${errors.name ? 'border-red-500' : ''}`}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Acme Corp"
                />
                {errors.name && <div className="text-xs mt-1" style={{ color: 'var(--red)' }}>{errors.name}</div>}
              </div>

              {/* Contact */}
              <div>
                <label className="text-xs font-semibold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>
                  Contact *
                </label>
                <input
                  className={`glass-input w-full ${errors.contact ? 'border-red-500' : ''}`}
                  value={form.contact}
                  onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                  placeholder="Jane Doe"
                />
                {errors.contact && <div className="text-xs mt-1" style={{ color: 'var(--red)' }}>{errors.contact}</div>}
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-semibold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>
                  Email *
                </label>
                <input
                  className={`glass-input w-full ${errors.email ? 'border-red-500' : ''}`}
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jane@acme.com"
                />
                {errors.email && <div className="text-xs mt-1" style={{ color: 'var(--red)' }}>{errors.email}</div>}
              </div>

              {/* Phone */}
              <div>
                <label className="text-xs font-semibold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>Phone</label>
                <input
                  className="glass-input w-full"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+1-555-0100"
                />
              </div>

              {/* Category + Status row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>Category</label>
                  <select
                    className="glass-input w-full"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>Status</label>
                  <select
                    className="glass-input w-full"
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as Vendor['status'] }))}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace('-', ' ')}</option>)}
                  </select>
                </div>
              </div>

              {/* Payment Terms + Lead Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>Payment Terms</label>
                  <select
                    className="glass-input w-full"
                    value={form.paymentTerms}
                    onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))}
                  >
                    {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>Lead Time (days)</label>
                  <input
                    type="number"
                    min={0}
                    className="glass-input w-full"
                    value={form.leadTime}
                    onChange={e => setForm(f => ({ ...f, leadTime: parseInt(e.target.value, 10) || 0 }))}
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="text-xs font-semibold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>Location</label>
                <input
                  className="glass-input w-full"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="City, State"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>Notes</label>
                <textarea
                  className="glass-input w-full resize-none"
                  rows={3}
                  maxLength={300}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Additional notes..."
                />
                <div className="text-xs mt-1 text-right" style={{ color: form.notes.length >= 280 ? 'var(--orange)' : 'var(--text-muted)' }}>
                  {form.notes.length} / 300
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button className="glass-button" onClick={closeModal}>Cancel</button>
              <button className="glass-button glass-button-primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : editingVendor ? 'Save Changes' : 'Add Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="glass-panel p-6 w-full max-w-sm" style={{ borderRadius: 24 }}>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>Delete Vendor</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
            </p>
            {(() => {
              const oc = openPOCount(deleteTarget);
              if (oc > 0) {
                return (
                  <p className="text-sm mb-4" style={{ color: 'var(--orange)' }}>
                    This vendor has {oc} open order{oc > 1 ? 's' : ''}.
                  </p>
                );
              }
              return null;
            })()}
            <div className="flex items-center justify-end gap-3">
              <button className="glass-button" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                className="glass-button"
                style={{ background: 'var(--red)', color: '#fff', borderColor: 'transparent' }}
                onClick={() => handleDelete(deleteTarget)}
                disabled={isSaving}
              >
                {isSaving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {showCompare && compareVendors.length === 2 && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="glass-panel p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto" style={{ borderRadius: 24 }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Compare Vendors</h2>
              <button onClick={() => setShowCompare(false)} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <CompareTable vendors={compareVendors} ratings={ratings} pos={pos} />
            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                className="glass-button text-xs"
                onClick={() => { setCompareIds(new Set()); setShowCompare(false); }}
              >
                Clear Selection
              </button>
              <button className="glass-button" onClick={() => setShowCompare(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Detail Panel

function DetailPanel({ vendor, rating, openPOs, totalPOs, lastOrder, onClose, onEdit, onDelete }: {
  vendor: Vendor;
  rating?: VendorRating;
  openPOs: number;
  totalPOs: number;
  lastOrder: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const catColor = CATEGORY_COLORS[vendor.category] ?? 'blue';
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{vendor.name}</h2>
        <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
      </div>

      <div className="flex items-center gap-2">
        <span className={`glass-badge glass-badge-${catColor}`}>{vendor.category}</span>
        <span className={`glass-badge glass-badge-${STATUS_COLORS[vendor.status] ?? 'blue'}`}>
          {vendor.status.replace('-', ' ')}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{vendor.vendorCode}</span>
      </div>

      <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <div className="flex items-center gap-2"><Mail size={14} style={{ color: 'var(--text-muted)' }} /> {vendor.contact}</div>
        <div className="flex items-center gap-2"><Mail size={14} style={{ color: 'var(--text-muted)' }} /> {vendor.email}</div>
        <div className="flex items-center gap-2"><Phone size={14} style={{ color: 'var(--text-muted)' }} /> {vendor.phone || '—'}</div>
        <div className="flex items-center gap-2"><Clock size={14} style={{ color: 'var(--text-muted)' }} /> {vendor.leadTime} day{vendor.leadTime !== 1 ? 's' : ''} lead time</div>
      </div>

      <div className="glass-card p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-muted)' }}>Payment Terms</span>
          <span style={{ color: 'var(--text)' }}>{vendor.paymentTerms}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-muted)' }}>Location</span>
          <span style={{ color: 'var(--text)' }}>{vendor.location || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-muted)' }}>Contract End</span>
          <span style={{ color: 'var(--text)' }}>{vendor.contractEnd || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-muted)' }}>Total POs</span>
          <span style={{ color: 'var(--text)' }}>{totalPOs || 'No orders yet'}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-muted)' }}>Open POs</span>
          <span style={{ color: openPOs > 0 ? 'var(--blue)' : 'var(--text)' }}>{openPOs}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-muted)' }}>Avg Rating</span>
          <span style={{ color: 'var(--text)' }}>
            {rating ? (
              <span className="flex items-center gap-1">
                <Star size={12} style={{ color: 'var(--orange)' }} fill="var(--orange)" /> {rating.overall.toFixed(1)} / 5.0
              </span>
            ) : 'Not rated yet'}
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-muted)' }}>Last Order</span>
          <span style={{ color: 'var(--text)' }}>{lastOrder || 'No orders yet'}</span>
        </div>
      </div>

      {vendor.notes && (
        <div className="glass-card p-4">
          <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Notes</h4>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{vendor.notes}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button className="glass-button flex items-center gap-2 text-xs" onClick={onEdit}>
          <Pencil size={12} /> Edit
        </button>
        <button
          className="glass-button flex items-center gap-2 text-xs"
          style={{ color: 'var(--red)' }}
          onClick={onDelete}
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  );
}

// Compare Table

function CompareTable({ vendors, ratings, pos }: { vendors: Vendor[]; ratings: VendorRating[]; pos: PurchaseOrder[] }) {
  const [v1, v2] = vendors;
  const r1 = ratings.find(r => r.vendorId === v1.id);
  const r2 = ratings.find(r => r.vendorId === v2.id);

  const rows: { label: string; a: string | number; b: string | number; lower?: boolean }[] = [
    { label: 'Lead Time', a: `${v1.leadTime}d`, b: `${v2.leadTime}d`, lower: true },
    { label: 'Payment Terms', a: v1.paymentTerms, b: v2.paymentTerms },
    { label: 'Avg Score', a: r1 ? r1.overall.toFixed(1) : 'N/A', b: r2 ? r2.overall.toFixed(1) : 'N/A' },
    { label: 'Open POs', a: countOpenPOs(v1, pos), b: countOpenPOs(v2, pos), lower: true },
  ];

  function cellColor(a: string | number, b: string | number, lower?: boolean): string {
    const na = typeof a === 'number' ? a : parseFloat(String(a));
    const nb = typeof b === 'number' ? b : parseFloat(String(b));
    if (isNaN(na) || isNaN(nb)) return 'var(--text)';
    if (na === nb) return 'var(--text)';
    const aBetter = lower ? na < nb : na > nb;
    return aBetter ? 'var(--green)' : 'var(--red)';
  }

  return (
    <div className="overflow-x-auto">
      <table className="glass-table">
        <thead>
          <tr>
            <th />
            <th style={{ color: 'var(--text)' }}>{v1.name}</th>
            <th style={{ color: 'var(--text)' }}>{v2.name}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label}>
              <td className="font-semibold" style={{ color: 'var(--text-muted)' }}>{r.label}</td>
              <td style={{ color: cellColor(r.a, r.b, r.lower) }}>{r.a}</td>
              <td style={{ color: cellColor(r.b, r.a, r.lower) }}>{r.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
