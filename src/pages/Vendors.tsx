import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Search, MapPin, Package, Star, TrendingUp, TrendingDown, Minus,
  Shield, AlertTriangle, ChevronDown, ChevronUp, Plus, Pencil,
  Trash2, X, Check, Copy, Phone, User, FileText,
} from 'lucide-react';
import {
  fetchVendors,
  fetchPurchaseOrders,
  upsertVendor,
  deleteVendorById,
  nextVendorId,
  statusColorMap,
  type Vendor,
  type PurchaseOrder,
} from '../lib/data';
import { useRefresh } from '../lib/RefreshContext';

// ─── Constants ───

const CATEGORIES = ['Electronics', 'Automotive', 'Logistics', 'Textiles', 'Chemicals', 'Metals', 'Packaging', 'Agriculture', 'Medical', 'Construction'];

const PAYMENT_TERMS = ['Net 15', 'Net 30', 'Net 45', 'Net 60'];

const OPEN_PO_STATUSES = new Set(['ordered', 'confirmed', 'in-transit']);

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'risk', label: 'Risk Score' },
  { value: 'delivery', label: 'Delivery Score' },
  { value: 'quality', label: 'Quality Score' },
];

// ─── Helpers ───

function getScoreColor(score: number): string {
  if (score >= 90) return 'var(--green)';
  if (score >= 70) return 'var(--blue)';
  if (score >= 50) return 'var(--orange)';
  return 'var(--red)';
}

function getScoreIcon(score: number) {
  if (score >= 90) return TrendingUp;
  if (score >= 70) return Minus;
  return TrendingDown;
}

function getRiskColor(level: string): string {
  if (level === 'low') return 'green';
  if (level === 'medium') return 'orange';
  if (level === 'high') return 'red';
  return 'blue';
}

// ─── Main Component ───

export default function Vendors() {
  const { refreshKey, triggerRefresh } = useRefresh();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive' | 'suspended'>('active');
  const [formRiskScore, setFormRiskScore] = useState(50);
  const [formDelivery, setFormDelivery] = useState(80);
  const [formQuality, setFormQuality] = useState(80);
  const [formCost, setFormCost] = useState(80);
  const [formSustainability, setFormSustainability] = useState(80);
  const [formInnovation, setFormInnovation] = useState(80);
  const [formLeadTime, setFormLeadTime] = useState(14);
  const [formMinOrder, setFormMinOrder] = useState(1000);
  const [formPaymentTerms, setFormPaymentTerms] = useState('Net 30');
  const [formCertifications, setFormCertifications] = useState<string[]>([]);
  const [certInput, setCertInput] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Compare
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([fetchVendors(), fetchPurchaseOrders()]).then(([v, p]) => {
      if (cancelled) return;
      setVendors(v);
      setPurchaseOrders(p);
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [refreshKey]);

  // ─── Filtering & Sorting ───

  const filtered = useMemo(() => {
    let result = [...vendors];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(v =>
        v.name.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        v.location.toLowerCase().includes(q)
      );
    }
    if (filterCategory !== 'all') {
      result = result.filter(v => v.category === filterCategory);
    }
    if (filterStatus !== 'all') {
      result = result.filter(v => v.status === filterStatus);
    }
    switch (sortBy) {
      case 'name': result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'risk': result.sort((a, b) => b.riskScore - a.riskScore); break;
      case 'delivery': result.sort((a, b) => b.deliveryScore - a.deliveryScore); break;
      case 'quality': result.sort((a, b) => b.qualityScore - a.qualityScore); break;
    }
    return result;
  }, [vendors, search, filterCategory, filterStatus, sortBy]);

  // ─── Stats ───

  const stats = useMemo(() => {
    const total = vendors.length;
    const active = vendors.filter(v => v.status === 'active').length;
    const avgRisk = total > 0 ? Math.round(vendors.reduce((s, v) => s + v.riskScore, 0) / total) : 0;
    const avgDelivery = total > 0 ? Math.round(vendors.reduce((s, v) => s + v.deliveryScore, 0) / total) : 0;
    return { total, active, avgRisk, avgDelivery, showing: filtered.length };
  }, [vendors, filtered.length]);

  // ─── Modal Handlers ───

  const openCreateModal = useCallback(() => {
    setEditingVendor(null);
    setFormName('');
    setFormCategory(CATEGORIES[0]);
    setFormLocation('');
    setFormStatus('active');
    setFormRiskScore(50);
    setFormDelivery(80);
    setFormQuality(80);
    setFormCost(80);
    setFormSustainability(80);
    setFormInnovation(80);
    setFormLeadTime(14);
    setFormMinOrder(1000);
    setFormPaymentTerms('Net 30');
    setFormCertifications([]);
    setCertInput('');
    setFormContact('');
    setFormPhone('');
    setFormNotes('');
    setErrors({});
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormName(vendor.name);
    setFormCategory(vendor.category);
    setFormLocation(vendor.location);
    setFormStatus(vendor.status);
    setFormRiskScore(vendor.riskScore);
    setFormDelivery(vendor.deliveryScore);
    setFormQuality(vendor.qualityScore);
    setFormCost(vendor.costScore);
    setFormSustainability(vendor.sustainabilityScore);
    setFormInnovation(vendor.innovationScore);
    setFormLeadTime(vendor.leadTime);
    setFormMinOrder(vendor.minOrder);
    setFormPaymentTerms(vendor.paymentTerms);
    setFormCertifications([...vendor.certifications]);
    setCertInput('');
    setFormContact(vendor.contact ?? '');
    setFormPhone(vendor.phone ?? '');
    setFormNotes(vendor.notes ?? '');
    setErrors({});
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingVendor(null);
    setErrors({});
  }, []);

  // ─── Form Validation ───

  const validateForm = useCallback((): boolean => {
    const e: Record<string, string> = {};
    if (!formName.trim()) e.name = 'Vendor name is required';
    if (!formCategory) e.category = 'Category is required';
    if (!formLocation.trim()) e.location = 'Location is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [formName, formCategory, formLocation]);

  // ─── Save Vendor ───

  const handleSave = useCallback(async () => {
    if (!validateForm()) return;
    const vendor: Vendor = {
      id: editingVendor?.id ?? nextVendorId(vendors),
      name: formName.trim(),
      category: formCategory,
      location: formLocation.trim(),
      status: formStatus,
      riskScore: formRiskScore,
      riskLevel: formRiskScore >= 60 ? 'high' : formRiskScore >= 30 ? 'medium' : 'low',
      deliveryScore: formDelivery,
      qualityScore: formQuality,
      costScore: formCost,
      sustainabilityScore: formSustainability,
      innovationScore: formInnovation,
      leadTime: formLeadTime,
      minOrder: formMinOrder,
      paymentTerms: formPaymentTerms,
      certifications: formCertifications,
      contact: formContact.trim() || null,
      phone: formPhone.trim() || null,
      notes: formNotes.trim() || null,
    };
    const success = await upsertVendor(vendor);
    if (!success) return;
    if (editingVendor) {
      const next = vendors.map(v => v.id === editingVendor.id ? vendor : v);
      setVendors(next);
    } else {
      setVendors(prev => [...prev, vendor]);
    }
    triggerRefresh();
    closeModal();
  }, [validateForm, editingVendor, vendors, formName, formCategory, formLocation, formStatus, formRiskScore, formDelivery, formQuality, formCost, formSustainability, formInnovation, formLeadTime, formMinOrder, formPaymentTerms, formCertifications, formContact, formPhone, formNotes, triggerRefresh, closeModal]);

  // ─── Delete Vendor ───

  const handleDelete = useCallback((id: string) => {
    setDeleteConfirmId(id);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    const success = await deleteVendorById(deleteConfirmId);
    if (success) {
      const next = vendors.filter(v => v.id !== deleteConfirmId);
      setVendors(next);
      setCompareIds(prev => { const n = new Set(prev); n.delete(deleteConfirmId); return n; });
      triggerRefresh();
    }
    setDeleteConfirmId(null);
  }, [deleteConfirmId, vendors, triggerRefresh]);

  // ─── Compare ───

  const toggleCompare = useCallback((id: string) => {
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  }, []);

  const compareVendors = useMemo(() => {
    return vendors.filter(v => compareIds.has(v.id));
  }, [vendors, compareIds]);

  // ─── Certifications ───

  const addCertification = useCallback(() => {
    const val = certInput.trim();
    if (!val || formCertifications.includes(val)) return;
    setFormCertifications(prev => [...prev, val]);
    setCertInput('');
  }, [certInput, formCertifications]);

  const removeCertification = useCallback((cert: string) => {
    setFormCertifications(prev => prev.filter(c => c !== cert));
  }, []);

  // ─── Render ───

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading vendors...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div data-tour="vendors-header" className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Vendors</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Manage supplier relationships and performance</p>
        </div>
        <button data-tour="add-vendor-btn" className="glass-button glass-button-primary flex items-center gap-2" onClick={openCreateModal}>
          <Plus size={16} /> Add Vendor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Vendors" value={stats.total} color="blue" />
        <StatCard label="Active" value={stats.active} color="green" />
        <StatCard label="Avg Risk" value={stats.avgRisk} color={stats.avgRisk >= 60 ? 'red' : stats.avgRisk >= 30 ? 'orange' : 'green'} suffix="/100" />
        <StatCard label="Avg Delivery" value={stats.avgDelivery} color="blue" suffix="/100" />
      </div>

      {/* Compare Bar */}
      {compareIds.size > 0 && (
        <div className="glass-card-solid p-3 flex items-center gap-3 flex-wrap">
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{compareIds.size} selected for comparison</span>
          <button className="glass-button glass-button-primary text-xs py-1 px-3" onClick={() => setCompareOpen(true)}>Compare</button>
          <button className="glass-button text-xs py-1 px-3" onClick={() => setCompareIds(new Set())}>Clear</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input className="glass-input w-full pl-9" placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="glass-input text-xs py-1.5 px-2" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="glass-input text-xs py-1.5 px-2" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
        <select className="glass-input text-xs py-1.5 px-2" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          {SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      {/* Count */}
      {(() => {
        const isFiltered = filtered.length !== vendors.length;
        return (
          <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {isFiltered ? `${filtered.length} of ${vendors.length} vendors` : `${vendors.length} vendors`}
          </div>
        );
      })()}

      {/* Vendor Cards */}
      <div data-tour="vendor-list" className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {filtered.map(vendor => {
          const isExpanded = expandedId === vendor.id;
          const isCompareSelected = compareIds.has(vendor.id);
          const openPOs = purchaseOrders.filter(po => po.vendorId === vendor.id && OPEN_PO_STATUSES.has(po.status)).length;
          const ScoreIcon = getScoreIcon(vendor.deliveryScore);

          return (
            <div key={vendor.id} className="glass-card p-5 relative group" style={{ cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : vendor.id)}>
              {/* Compare checkbox */}
              <div className={`absolute top-3 right-3 z-10 transition-opacity ${isCompareSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} onClick={e => { e.stopPropagation(); toggleCompare(vendor.id); }}>
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-colors ${isCompareSelected ? 'border-[var(--blue)] bg-[var(--blue)]' : 'border-[var(--glass-border)] hover:border-[var(--blue)]'}`}>
                  {isCompareSelected && <Check size={14} style={{ color: '#fff' }} />}
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `var(--${getRiskColor(vendor.riskLevel)})`, opacity: 0.15 }}>
                  <Shield size={24} style={{ color: `var(--${getRiskColor(vendor.riskLevel)})` }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-lg" style={{ color: 'var(--text)' }}>{vendor.name}</h3>
                    <span className={`glass-badge glass-badge-${getRiskColor(vendor.riskLevel)}`}>{vendor.riskLevel}</span>
                    <span className={`glass-badge glass-badge-${statusColorMap[vendor.status] ?? 'gray'}`}>{vendor.status}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm flex-wrap" style={{ color: 'var(--text-muted)' }}>
                    <span className="flex items-center gap-1"><MapPin size={12} /> {vendor.location}</span>
                    <span>{vendor.category}</span>
                    {openPOs > 0 && <span className="flex items-center gap-1" style={{ color: 'var(--blue)' }}><Package size={12} /> {openPOs} open PO{openPOs > 1 ? 's' : ''}</span>}
                  </div>
                </div>
              </div>

              {/* Score Bars */}
              <div className="grid grid-cols-5 gap-2 mt-4">
                <ScoreBar label="Delivery" value={vendor.deliveryScore} />
                <ScoreBar label="Quality" value={vendor.qualityScore} />
                <ScoreBar label="Cost" value={vendor.costScore} />
                <ScoreBar label="Sustain" value={vendor.sustainabilityScore} />
                <ScoreBar label="Innovate" value={vendor.innovationScore} />
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid var(--glass-border)' }}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <DetailItem label="Lead Time" value={`${vendor.leadTime} days`} />
                    <DetailItem label="Min Order" value={`$${vendor.minOrder.toLocaleString()}`} />
                    <DetailItem label="Payment" value={vendor.paymentTerms} />
                    <DetailItem label="Risk Score" value={`${vendor.riskScore}/100`} color={getScoreColor(vendor.riskScore)} />
                  </div>
                  {vendor.certifications.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {vendor.certifications.map(cert => (
                        <span key={cert} className="glass-badge glass-badge-blue text-[10px]">{cert}</span>
                      ))}
                    </div>
                  )}
                  {(vendor.contact || vendor.phone || vendor.notes) && (
                    <div className="grid grid-cols-1 gap-2 pt-1">
                      {vendor.contact && (
                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <User size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <span>{vendor.contact}</span>
                        </div>
                      )}
                      {vendor.phone && (
                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <Phone size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <span>{vendor.phone}</span>
                        </div>
                      )}
                      {vendor.notes && (
                        <div className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <FileText size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
                          <span style={{ whiteSpace: 'pre-wrap' }}>{vendor.notes}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-2">
                    <button className="glass-button text-xs py-1.5 px-3 flex items-center gap-1" onClick={e => { e.stopPropagation(); openEditModal(vendor); }}><Pencil size={12} /> Edit</button>
                    <button className="glass-button text-xs py-1.5 px-3 flex items-center gap-1" style={{ color: 'var(--red)' }} onClick={e => { e.stopPropagation(); handleDelete(vendor.id); }}><Trash2 size={12} /> Delete</button>
                  </div>
                </div>
              )}

              {/* Expand indicator */}
              <div className="flex justify-center mt-2">
                {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="glass-card p-8 text-center" style={{ color: 'var(--text-muted)' }}>
          No vendors found matching your filters
        </div>
      )}

      {/* ─── Create/Edit Modal ─── */}
      {modalOpen && (
        <Modal onClose={closeModal} title={editingVendor ? `Edit ${editingVendor.name}` : 'Add New Vendor'}>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <FormField label="Vendor Name *" error={errors.name}>
              <input className="glass-input w-full" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Enter vendor name" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Category *" error={errors.category}>
                <select className="glass-input w-full" value={formCategory} onChange={e => setFormCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </FormField>
              <FormField label="Status">
                <select className="glass-input w-full" value={formStatus} onChange={e => setFormStatus(e.target.value as any)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </FormField>
            </div>
            <FormField label="Location *" error={errors.location}>
              <input className="glass-input w-full" value={formLocation} onChange={e => setFormLocation(e.target.value)} placeholder="City, Country" />
            </FormField>

            {/* Score Sliders */}
            <div className="glass-card-solid p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Performance Scores</h4>
              <ScoreSlider label="Risk Score" value={formRiskScore} onChange={setFormRiskScore} color="red" />
              <ScoreSlider label="Delivery" value={formDelivery} onChange={setFormDelivery} color="blue" />
              <ScoreSlider label="Quality" value={formQuality} onChange={setFormQuality} color="green" />
              <ScoreSlider label="Cost" value={formCost} onChange={setFormCost} color="cyan" />
              <ScoreSlider label="Sustainability" value={formSustainability} onChange={setFormSustainability} color="green" />
              <ScoreSlider label="Innovation" value={formInnovation} onChange={setFormInnovation} color="purple" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Lead Time (days)">
                <input type="number" className="glass-input w-full" value={formLeadTime} onChange={e => setFormLeadTime(parseInt(e.target.value) || 0)} />
              </FormField>
              <FormField label="Min Order ($)">
                <input type="number" className="glass-input w-full" value={formMinOrder} onChange={e => setFormMinOrder(parseInt(e.target.value) || 0)} />
              </FormField>
            </div>
            <FormField label="Payment Terms">
              <select className="glass-input w-full" value={formPaymentTerms} onChange={e => setFormPaymentTerms(e.target.value)}>
                {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>

            {/* Certifications */}
            <div>
              <label className="text-xs font-semibold uppercase block mb-2" style={{ color: 'var(--text-muted)' }}>Certifications</label>
              <div className="flex gap-2 mb-2">
                <input className="glass-input flex-1" value={certInput} onChange={e => setCertInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCertification(); } }} placeholder="Add certification..." />
                <button className="glass-button px-3" onClick={addCertification}><Plus size={14} /></button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {formCertifications.map(cert => (
                  <span key={cert} className="glass-badge glass-badge-blue text-[10px] flex items-center gap-1">
                    {cert}
                    <button onClick={() => removeCertification(cert)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}><X size={10} /></button>
                  </span>
                ))}
              </div>
            </div>

            {/* Contact Info */}
            <div className="glass-card-solid p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Contact Information</h4>
              <FormField label="Contact Person">
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input className="glass-input w-full pl-9" value={formContact} onChange={e => setFormContact(e.target.value)} placeholder="Full name" />
                </div>
              </FormField>
              <FormField label="Phone">
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input className="glass-input w-full pl-9" value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
                </div>
              </FormField>
              <FormField label="Notes">
                <div className="relative">
                  <FileText size={14} className="absolute left-3 top-3" style={{ color: 'var(--text-muted)' }} />
                  <textarea className="glass-input w-full pl-9 resize-none" rows={3} value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Internal notes about this vendor..." />
                </div>
              </FormField>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button className="glass-button" onClick={closeModal}>Cancel</button>
              <button className="glass-button glass-button-primary" onClick={handleSave}>{editingVendor ? 'Save Changes' : 'Add Vendor'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Compare Modal ─── */}
      {compareOpen && (
        <Modal onClose={() => setCompareOpen(false)} title="Vendor Comparison">
          {compareVendors.length < 2 ? (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Select at least 2 vendors to compare</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    {compareVendors.map(v => <th key={v.id}>{v.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {['deliveryScore', 'qualityScore', 'costScore', 'sustainabilityScore', 'innovationScore', 'riskScore'].map(metric => (
                    <tr key={metric}>
                      <td className="font-medium" style={{ color: 'var(--text-muted)' }}>{metric.replace('Score', '')}</td>
                      {compareVendors.map(v => {
                        const val = (v as any)[metric];
                        return <td key={v.id} style={{ color: getScoreColor(val), fontWeight: 600 }}>{val}</td>;
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td className="font-medium" style={{ color: 'var(--text-muted)' }}>Lead Time</td>
                    {compareVendors.map(v => <td key={v.id} style={{ color: 'var(--text)' }}>{v.leadTime} days</td>)}
                  </tr>
                  <tr>
                    <td className="font-medium" style={{ color: 'var(--text-muted)' }}>Min Order</td>
                    {compareVendors.map(v => <td key={v.id} style={{ color: 'var(--text)' }}>${v.minOrder.toLocaleString()}</td>)}
                  </tr>
                  <tr>
                    <td className="font-medium" style={{ color: 'var(--text-muted)' }}>Status</td>
                    {compareVendors.map(v => <td key={v.id}><span className={`glass-badge glass-badge-${statusColorMap[v.status] ?? 'gray'}`}>{v.status}</span></td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteConfirmId && (
        <Modal title="Delete Vendor" onClose={() => setDeleteConfirmId(null)}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Are you sure you want to delete <strong style={{ color: 'var(--text)' }}>{vendors.find(v => v.id === deleteConfirmId)?.name}</strong>? This action cannot be undone.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="glass-button" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
            <button className="glass-button" style={{ background: 'var(--red)', color: '#fff', borderColor: 'var(--red)' }} onClick={confirmDelete}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Sub-components ───

function StatCard({ label, value, color, suffix = '' }: { label: string; value: number; color: string; suffix?: string }) {
  return (
    <div className="glass-card p-4">
      <div className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: `var(--${color})` }}>{value}{suffix}</div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium uppercase" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className="text-[10px] font-bold" style={{ color: getScoreColor(value) }}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-strong)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: getScoreColor(value) }} />
      </div>
    </div>
  );
}

function DetailItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-sm font-semibold" style={{ color: color ?? 'var(--text)' }}>{value}</div>
    </div>
  );
}

function ScoreSlider({ label, value, onChange, color }: { label: string; value: number; onChange: (v: number) => void; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className="text-xs font-bold" style={{ color: `var(--${color})` }}>{value}</span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={e => onChange(parseInt(e.target.value))}
        className="w-full" style={{ accentColor: `var(--${color})` }} />
    </div>
  );
}

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
      <div className="glass-panel p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ borderRadius: 24 }}>
        {title && <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{title}</h2><button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={18} /></button></div>}
        {children}
      </div>
    </div>
  );
}
