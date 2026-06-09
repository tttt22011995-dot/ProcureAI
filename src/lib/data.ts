import { supabase } from './supabase';

// ─── Types ───

export type Page = 'dashboard' | 'vendors' | 'purchase-orders' | 'delivery' | 'scorecard' | 'ai-risk' | 'catalog';

export interface Vendor {
  id: string;
  name: string;
  category: string;
  location: string;
  status: 'active' | 'inactive' | 'suspended';
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  deliveryScore: number;
  qualityScore: number;
  costScore: number;
  sustainabilityScore: number;
  innovationScore: number;
  leadTime: number;
  minOrder: number;
  paymentTerms: string;
  certifications: string[];
}

export interface LineItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface DeliveryNote {
  timestamp: string;
  text: string;
}

export interface PurchaseOrder {
  id: string;
  vendorId: string;
  vendorName: string;
  items: LineItem[];
  total: number;
  subtotal?: number;
  tax?: number;
  status: 'ordered' | 'confirmed' | 'in-transit' | 'delivered' | 'invoiced';
  deliveryStatus?: string;
  createdAt: string;
  deliveryDate: string;
  actualDeliveryDate?: string | null;
  priority: 'low' | 'medium' | 'high';
  deliveryNotes?: DeliveryNote[];
}

export interface CatalogItem {
  id: string;
  name: string;
  unitPrice: number;
  category?: string | null;
  unit?: string | null;
}

export interface VendorRating {
  id: string;
  vendorId: string;
  vendorName: string;
  overall: number;
  delivery: number;
  quality: number;
  cost: number;
  sustainability: number;
  innovation: number;
  lastReviewed: string;
  strengths: string[];
  weaknesses: string[];
  review?: string;
}

export interface DeliveryPerformance {
  id: string;
  poId: string;
  vendorId: string;
  vendorName: string;
  promisedDate: string;
  actualDate?: string | null;
  status: 'on-time' | 'delayed';
  delayDays: number;
  onTime: boolean;
  daysDifference: number;
}

// ─── Status color helpers ───

export const statusColorMap: Record<string, string> = {
  active: 'green',
  inactive: 'gray',
  suspended: 'red',
  delivered: 'green',
  confirmed: 'purple',
  'in-transit': 'orange',
  invoiced: 'cyan',
  low: 'green',
  medium: 'orange',
  high: 'red',
};

export const poStatusColorMap: Record<string, string> = {
  ordered: 'blue',
  confirmed: 'purple',
  'in-transit': 'orange',
  delivered: 'green',
  invoiced: 'cyan',
};

export const priorityColorMap: Record<string, string> = {
  low: 'gray',
  medium: 'orange',
  high: 'red',
};

// ─── Business logic helpers ───

export function isOverdue(po: PurchaseOrder): boolean {
  const deliveryStatus = po.deliveryStatus ?? po.status;
  if (deliveryStatus === 'delivered' || deliveryStatus === 'invoiced') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expected = new Date(po.deliveryDate);
  expected.setHours(0, 0, 0, 0);
  return expected < today;
}

export function getEffectivePOStatus(po: PurchaseOrder): string {
  if (isOverdue(po)) return 'overdue';
  return po.status;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0,
  }).format(amount);
}

export interface AlertItem {
  id: string;
  type: 'overdue' | 'low-score' | 'stuck';
  message: string;
  page: Page;
}

export function computeAlerts(): AlertItem[] {
  const alerts: AlertItem[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Use cached data — populated after fetchVendors/fetchPurchaseOrders/fetchVendorRatings
  const pos: PurchaseOrder[] = (window as any).__procureai_pos_cache ?? [];
  const ratings: VendorRating[] = (window as any).__procureai_ratings_cache ?? [];
  const vendors: Vendor[] = (window as any).__procureai_vendors_cache ?? [];

  pos.forEach(po => {
    if (isOverdue(po)) {
      alerts.push({
        id: `overdue-${po.id}`,
        type: 'overdue',
        message: `${po.id} (${po.vendorName}) is overdue`,
        page: 'delivery',
      });
    }
    const created = new Date(po.createdAt);
    const days = Math.floor((today.getTime() - created.getTime()) / 86400000);
    if ((po.status === 'ordered' || po.status === 'confirmed') && days >= 7) {
      alerts.push({
        id: `stuck-${po.id}`,
        type: 'stuck',
        message: `${po.id} stuck in ${po.status} for ${days} days`,
        page: 'purchase-orders',
      });
    }
  });

  ratings.forEach(r => {
    if (r.overall < 60) {
      const v = vendors.find(v => v.id === r.vendorId);
      alerts.push({
        id: `low-score-${r.vendorId}`,
        type: 'low-score',
        message: `${v?.name ?? r.vendorName} has low score (${r.overall}/100)`,
        page: 'scorecard',
      });
    }
  });

  return alerts;
}

// ─── ID generators ───

export function nextVendorId(vendors: Vendor[]): string {
  const max = vendors.reduce((m, v) => {
    const num = parseInt(v.id.replace('V-', ''), 10);
    return num > m ? num : m;
  }, 0);
  return `V-${String(max + 1).padStart(3, '0')}`;
}

export function nextPONumber(orders?: PurchaseOrder[]): string {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;
  const all = orders ?? [];
  const max = all.reduce((m, o) => {
    if (!o.id.startsWith(prefix)) return m;
    const num = parseInt(o.id.replace(prefix, ''), 10);
    return num > m ? num : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export function nextRatingId(ratings: VendorRating[]): string {
  const max = ratings.reduce((m, r) => {
    const num = parseInt(r.id.replace('VR-', ''), 10);
    return num > m ? num : m;
  }, 0);
  return `VR-${String(max + 1).padStart(3, '0')}`;
}

export function nextCatalogId(items: CatalogItem[]): string {
  const max = items.reduce((m, i) => {
    const num = parseInt(i.id.replace('CAT-', ''), 10);
    return num > m ? num : m;
  }, 0);
  return `CAT-${String(max + 1).padStart(3, '0')}`;
}

// ─── DB Row <-> Type mappers ───

function mapVendorRow(row: any): Vendor {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    location: row.location,
    status: row.status,
    riskScore: row.risk_score,
    riskLevel: row.risk_level,
    deliveryScore: row.delivery_score,
    qualityScore: row.quality_score,
    costScore: row.cost_score,
    sustainabilityScore: row.sustainability_score,
    innovationScore: row.innovation_score,
    leadTime: row.lead_time,
    minOrder: row.min_order,
    paymentTerms: row.payment_terms,
    certifications: row.certifications ?? [],
  };
}

function vendorToDb(v: Vendor): any {
  return {
    id: v.id,
    name: v.name,
    category: v.category,
    location: v.location,
    status: v.status,
    risk_score: v.riskScore,
    risk_level: v.riskLevel,
    delivery_score: v.deliveryScore,
    quality_score: v.qualityScore,
    cost_score: v.costScore,
    sustainability_score: v.sustainabilityScore,
    innovation_score: v.innovationScore,
    lead_time: v.leadTime,
    min_order: v.minOrder,
    payment_terms: v.paymentTerms,
    certifications: v.certifications,
  };
}

function mapPORow(row: any): PurchaseOrder {
  return {
    id: row.id,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    items: (row.items ?? []) as LineItem[],
    total: row.total,
    subtotal: row.subtotal,
    tax: row.tax,
    status: row.status,
    deliveryStatus: row.delivery_status ?? undefined,
    createdAt: row.created_at,
    deliveryDate: row.delivery_date,
    actualDeliveryDate: row.actual_delivery_date,
    priority: row.priority,
    deliveryNotes: (row.delivery_notes ?? []) as DeliveryNote[],
  };
}

function poToDb(po: PurchaseOrder): any {
  return {
    id: po.id,
    vendor_id: po.vendorId,
    vendor_name: po.vendorName,
    items: po.items,
    total: po.total,
    subtotal: po.subtotal ?? po.total,
    tax: po.tax ?? 0,
    status: po.status,
    delivery_status: po.deliveryStatus ?? po.status,
    created_at: po.createdAt,
    delivery_date: po.deliveryDate,
    actual_delivery_date: po.actualDeliveryDate ?? null,
    priority: po.priority,
    delivery_notes: po.deliveryNotes ?? [],
  };
}

function mapRatingRow(row: any): VendorRating {
  return {
    id: row.id,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    overall: row.overall,
    delivery: row.delivery,
    quality: row.quality,
    cost: row.cost,
    sustainability: row.sustainability,
    innovation: row.innovation,
    lastReviewed: row.last_reviewed,
    strengths: row.strengths ?? [],
    weaknesses: row.weaknesses ?? [],
    review: row.review ?? undefined,
  };
}

function ratingToDb(r: VendorRating): any {
  return {
    id: r.id,
    vendor_id: r.vendorId,
    vendor_name: r.vendorName,
    overall: r.overall,
    delivery: r.delivery,
    quality: r.quality,
    cost: r.cost,
    sustainability: r.sustainability,
    innovation: r.innovation,
    last_reviewed: r.lastReviewed,
    strengths: r.strengths,
    weaknesses: r.weaknesses,
    review: r.review ?? null,
  };
}

function mapPerfRow(row: any): DeliveryPerformance {
  return {
    id: row.id,
    poId: row.po_id,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    promisedDate: row.promised_date,
    actualDate: row.actual_date,
    status: row.status,
    delayDays: row.delay_days,
    onTime: row.on_time,
    daysDifference: row.days_difference,
  };
}

function perfToDb(p: DeliveryPerformance): any {
  return {
    id: p.id,
    po_id: p.poId,
    vendor_id: p.vendorId,
    vendor_name: p.vendorName,
    promised_date: p.promisedDate,
    actual_date: p.actualDate ?? null,
    status: p.status,
    delay_days: p.delayDays,
    on_time: p.onTime,
    days_difference: p.daysDifference,
  };
}

function mapCatalogRow(row: any): CatalogItem {
  return {
    id: row.id,
    name: row.name,
    unitPrice: row.unit_price,
    category: row.category,
    unit: row.unit,
  };
}

function catalogToDb(c: CatalogItem): any {
  return {
    id: c.id,
    name: c.name,
    unit_price: c.unitPrice,
    category: c.category ?? null,
    unit: c.unit ?? null,
  };
}

// ─── Vendors ───

export async function fetchVendors(): Promise<Vendor[]> {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .order('name');
  if (error) {
    console.error('fetchVendors error:', error);
    return [];
  }
  const result = (data ?? []).map(mapVendorRow);
  (window as any).__procureai_vendors_cache = result;
  return result;
}

export async function upsertVendor(vendor: Vendor): Promise<boolean> {
  const { error } = await supabase
    .from('vendors')
    .upsert(vendorToDb(vendor), { onConflict: 'id' });
  if (error) {
    console.error('upsertVendor error:', error);
    return false;
  }
  return true;
}

export async function deleteVendorById(id: string): Promise<boolean> {
  const { error } = await supabase.from('vendors').delete().eq('id', id);
  if (error) {
    console.error('deleteVendorById error:', error);
    return false;
  }
  return true;
}

// ─── Purchase Orders ───

export async function fetchPurchaseOrders(): Promise<PurchaseOrder[]> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('fetchPurchaseOrders error:', error);
    return [];
  }
  const result = (data ?? []).map(mapPORow);
  (window as any).__procureai_pos_cache = result;
  return result;
}

export async function upsertPurchaseOrder(po: PurchaseOrder): Promise<boolean> {
  const { error } = await supabase
    .from('purchase_orders')
    .upsert(poToDb(po), { onConflict: 'id' });
  if (error) {
    console.error('upsertPurchaseOrder error:', error);
    return false;
  }
  return true;
}

export async function deletePurchaseOrderById(id: string): Promise<boolean> {
  const { error } = await supabase.from('purchase_orders').delete().eq('id', id);
  if (error) {
    console.error('deletePurchaseOrderById error:', error);
    return false;
  }
  return true;
}

// ─── Vendor Ratings ───

export async function fetchVendorRatings(): Promise<VendorRating[]> {
  const { data, error } = await supabase
    .from('vendor_ratings')
    .select('*')
    .order('overall', { ascending: false });
  if (error) {
    console.error('fetchVendorRatings error:', error);
    return [];
  }
  const result = (data ?? []).map(mapRatingRow);
  (window as any).__procureai_ratings_cache = result;
  return result;
}

export async function upsertVendorRating(rating: VendorRating): Promise<boolean> {
  const { error } = await supabase
    .from('vendor_ratings')
    .upsert(ratingToDb(rating), { onConflict: 'id' });
  if (error) {
    console.error('upsertVendorRating error:', error);
    return false;
  }
  return true;
}

// ─── Delivery Performance ───

export async function fetchDeliveryPerformance(): Promise<DeliveryPerformance[]> {
  const { data, error } = await supabase
    .from('delivery_performance')
    .select('*');
  if (error) {
    console.error('fetchDeliveryPerformance error:', error);
    return [];
  }
  return (data ?? []).map(mapPerfRow);
}

export async function upsertDeliveryPerformance(perf: DeliveryPerformance): Promise<boolean> {
  const { error } = await supabase
    .from('delivery_performance')
    .upsert(perfToDb(perf), { onConflict: 'id' });
  if (error) {
    console.error('upsertDeliveryPerformance error:', error);
    return false;
  }
  return true;
}

// ─── Catalog Items ───

export async function getCatalogItems(): Promise<CatalogItem[]> {
  const { data, error } = await supabase
    .from('catalog_items')
    .select('*')
    .order('name');
  if (error) {
    console.error('getCatalogItems error:', error);
    return [];
  }
  return (data ?? []).map(mapCatalogRow);
}

export async function upsertCatalogItem(item: CatalogItem): Promise<boolean> {
  const { error } = await supabase
    .from('catalog_items')
    .upsert(catalogToDb(item), { onConflict: 'id' });
  if (error) {
    console.error('upsertCatalogItem error:', error);
    return false;
  }
  return true;
}

export async function deleteCatalogItem(id: string): Promise<boolean> {
  const { error } = await supabase.from('catalog_items').delete().eq('id', id);
  if (error) {
    console.error('deleteCatalogItem error:', error);
    return false;
  }
  return true;
}

// ─── Seed data (called once on app mount if vendors table empty) ───

export async function seedData(): Promise<void> {
  try {
  const { data: existing, error: checkError } = await supabase.from('vendors').select('id').limit(1);
  if (checkError) {
    console.warn('seedData: cannot reach vendors table, skipping:', checkError.message);
    return;
  }
  if (existing && existing.length > 0) return;

  // ── 20 Vendors ───────────────────────────────────────────────
  const vendors: Vendor[] = [
    { id: 'V-001', name: 'Acme Manufacturing', category: 'Electronics', location: 'Shenzhen, China', status: 'active', riskScore: 42, riskLevel: 'medium', deliveryScore: 85, qualityScore: 90, costScore: 75, sustainabilityScore: 62, innovationScore: 80, leadTime: 14, minOrder: 5000, paymentTerms: 'Net 30', certifications: ['ISO 9001', 'ISO 14001'] },
    { id: 'V-002', name: 'Global Parts Ltd', category: 'Automotive', location: 'Stuttgart, Germany', status: 'active', riskScore: 22, riskLevel: 'low', deliveryScore: 93, qualityScore: 89, costScore: 71, sustainabilityScore: 76, innovationScore: 86, leadTime: 21, minOrder: 10000, paymentTerms: 'Net 45', certifications: ['IATF 16949', 'ISO 9001'] },
    { id: 'V-003', name: 'Pacific Logistics', category: 'Logistics', location: 'Singapore', status: 'active', riskScore: 58, riskLevel: 'medium', deliveryScore: 79, qualityScore: 83, costScore: 81, sustainabilityScore: 57, innovationScore: 66, leadTime: 7, minOrder: 2000, paymentTerms: 'Net 15', certifications: ['ISO 9001'] },
    { id: 'V-004', name: 'Nordic Components', category: 'Electronics', location: 'Helsinki, Finland', status: 'active', riskScore: 14, riskLevel: 'low', deliveryScore: 96, qualityScore: 95, costScore: 64, sustainabilityScore: 91, innovationScore: 89, leadTime: 28, minOrder: 3000, paymentTerms: 'Net 60', certifications: ['ISO 9001', 'ISO 14001', 'RoHS'] },
    { id: 'V-005', name: 'TexSource International', category: 'Textiles', location: 'Mumbai, India', status: 'active', riskScore: 68, riskLevel: 'high', deliveryScore: 71, qualityScore: 74, costScore: 86, sustainabilityScore: 49, innovationScore: 59, leadTime: 10, minOrder: 1000, paymentTerms: 'Net 30', certifications: ['OEKO-TEX', 'GOTS'] },
    { id: 'V-006', name: 'EuroChem Supplies', category: 'Chemicals', location: 'Rotterdam, Netherlands', status: 'active', riskScore: 53, riskLevel: 'medium', deliveryScore: 81, qualityScore: 86, costScore: 79, sustainabilityScore: 72, innovationScore: 76, leadTime: 14, minOrder: 5000, paymentTerms: 'Net 30', certifications: ['ISO 9001', 'REACH'] },
    { id: 'V-007', name: 'SteelWorks Corp', category: 'Metals', location: 'Pittsburgh, USA', status: 'active', riskScore: 28, riskLevel: 'low', deliveryScore: 89, qualityScore: 88, costScore: 73, sustainabilityScore: 66, innovationScore: 71, leadTime: 21, minOrder: 15000, paymentTerms: 'Net 45', certifications: ['ISO 9001', 'ASTM'] },
    { id: 'V-008', name: 'GreenPack Solutions', category: 'Packaging', location: 'Melbourne, Australia', status: 'active', riskScore: 18, riskLevel: 'low', deliveryScore: 91, qualityScore: 93, costScore: 69, sustainabilityScore: 96, innovationScore: 83, leadTime: 14, minOrder: 2000, paymentTerms: 'Net 30', certifications: ['FSC', 'ISO 14001'] },
    { id: 'V-009', name: 'TechComponents Inc', category: 'Electronics', location: 'Taipei, Taiwan', status: 'active', riskScore: 38, riskLevel: 'medium', deliveryScore: 87, qualityScore: 90, costScore: 78, sustainabilityScore: 61, innovationScore: 93, leadTime: 14, minOrder: 3000, paymentTerms: 'Net 30', certifications: ['ISO 9001', 'IPC-A-610'] },
    { id: 'V-010', name: 'AgriSource Global', category: 'Agriculture', location: 'São Paulo, Brazil', status: 'active', riskScore: 48, riskLevel: 'medium', deliveryScore: 76, qualityScore: 81, costScore: 83, sustainabilityScore: 71, innovationScore: 64, leadTime: 10, minOrder: 5000, paymentTerms: 'Net 30', certifications: ['Organic', 'Fair Trade'] },
    { id: 'V-011', name: 'MedSupply Pro', category: 'Medical', location: 'Boston, USA', status: 'active', riskScore: 9, riskLevel: 'low', deliveryScore: 97, qualityScore: 99, costScore: 58, sustainabilityScore: 86, innovationScore: 91, leadTime: 7, minOrder: 1000, paymentTerms: 'Net 15', certifications: ['FDA', 'ISO 13485'] },
    { id: 'V-012', name: 'BuildRight Materials', category: 'Construction', location: 'Dubai, UAE', status: 'active', riskScore: 63, riskLevel: 'high', deliveryScore: 69, qualityScore: 77, costScore: 89, sustainabilityScore: 54, innovationScore: 67, leadTime: 14, minOrder: 8000, paymentTerms: 'Net 45', certifications: ['ISO 9001', 'CE Mark'] },
    { id: 'V-013', name: 'FreshFarm Organics', category: 'Agriculture', location: 'Auckland, New Zealand', status: 'active', riskScore: 20, riskLevel: 'low', deliveryScore: 88, qualityScore: 94, costScore: 62, sustainabilityScore: 98, innovationScore: 72, leadTime: 12, minOrder: 500, paymentTerms: 'Net 30', certifications: ['Organic', 'ISO 22000'] },
    { id: 'V-014', name: 'SwiftShip Express', category: 'Logistics', location: 'Dubai, UAE', status: 'active', riskScore: 35, riskLevel: 'medium', deliveryScore: 84, qualityScore: 80, costScore: 77, sustainabilityScore: 52, innovationScore: 70, leadTime: 3, minOrder: 1000, paymentTerms: 'Net 15', certifications: ['ISO 9001'] },
    { id: 'V-015', name: 'PharmaLink Corp', category: 'Medical', location: 'Basel, Switzerland', status: 'active', riskScore: 12, riskLevel: 'low', deliveryScore: 95, qualityScore: 97, costScore: 55, sustainabilityScore: 80, innovationScore: 94, leadTime: 10, minOrder: 2000, paymentTerms: 'Net 60', certifications: ['FDA', 'EMA', 'ISO 13485'] },
    { id: 'V-016', name: 'PolyTex Fabrics', category: 'Textiles', location: 'Dhaka, Bangladesh', status: 'inactive', riskScore: 75, riskLevel: 'high', deliveryScore: 65, qualityScore: 70, costScore: 92, sustainabilityScore: 38, innovationScore: 52, leadTime: 18, minOrder: 3000, paymentTerms: 'Net 30', certifications: ['OEKO-TEX'] },
    { id: 'V-017', name: 'NanoChip Systems', category: 'Electronics', location: 'Seoul, South Korea', status: 'active', riskScore: 30, riskLevel: 'low', deliveryScore: 92, qualityScore: 96, costScore: 68, sustainabilityScore: 74, innovationScore: 97, leadTime: 21, minOrder: 5000, paymentTerms: 'Net 45', certifications: ['ISO 9001', 'RoHS', 'UL'] },
    { id: 'V-018', name: 'IronCast Foundry', category: 'Metals', location: 'Osaka, Japan', status: 'active', riskScore: 25, riskLevel: 'low', deliveryScore: 90, qualityScore: 92, costScore: 70, sustainabilityScore: 68, innovationScore: 78, leadTime: 25, minOrder: 10000, paymentTerms: 'Net 60', certifications: ['ISO 9001', 'JIS'] },
    { id: 'V-019', name: 'CleanChem Industries', category: 'Chemicals', location: 'Lyon, France', status: 'suspended', riskScore: 80, riskLevel: 'high', deliveryScore: 60, qualityScore: 72, costScore: 74, sustainabilityScore: 45, innovationScore: 58, leadTime: 20, minOrder: 3000, paymentTerms: 'Net 30', certifications: ['REACH'] },
    { id: 'V-020', name: 'SmartPack Solutions', category: 'Packaging', location: 'Toronto, Canada', status: 'active', riskScore: 22, riskLevel: 'low', deliveryScore: 88, qualityScore: 90, costScore: 72, sustainabilityScore: 88, innovationScore: 85, leadTime: 10, minOrder: 1500, paymentTerms: 'Net 30', certifications: ['FSC', 'ISO 14001', 'BRC'] },
  ];

  for (const v of vendors) { await upsertVendor(v); }

  // ── 50 Purchase Orders (2026) ────────────────────────────────
  // Jan–Mar: invoiced/delivered (historical)
  // Apr–May: mix of delivered + in-transit
  // Late May–Jun: active (confirmed/ordered) + some OVERDUE
  const orders: PurchaseOrder[] = [
    // ── Jan 2026 — all invoiced ──
    { id: 'PO-2026-001', vendorId: 'V-001', vendorName: 'Acme Manufacturing', items: [{ id: 'li-001-1', name: 'PCB Assemblies', quantity: 200, unitPrice: 145, total: 29000 },{ id: 'li-001-2', name: 'Power Modules', quantity: 50, unitPrice: 320, total: 16000 }], subtotal: 45000, tax: 4500, total: 49500, status: 'invoiced', deliveryStatus: 'invoiced', createdAt: '2026-01-05', deliveryDate: '2026-01-28', actualDeliveryDate: '2026-01-27', priority: 'high' },
    { id: 'PO-2026-002', vendorId: 'V-002', vendorName: 'Global Parts Ltd', items: [{ id: 'li-002-1', name: 'Brake Assemblies', quantity: 80, unitPrice: 420, total: 33600 }], subtotal: 33600, tax: 3360, total: 36960, status: 'invoiced', deliveryStatus: 'invoiced', createdAt: '2026-01-08', deliveryDate: '2026-02-05', actualDeliveryDate: '2026-02-07', priority: 'high' },
    { id: 'PO-2026-003', vendorId: 'V-007', vendorName: 'SteelWorks Corp', items: [{ id: 'li-003-1', name: 'Steel Rods Grade A', quantity: 500, unitPrice: 85, total: 42500 }], subtotal: 42500, tax: 4250, total: 46750, status: 'invoiced', deliveryStatus: 'invoiced', createdAt: '2026-01-10', deliveryDate: '2026-02-10', actualDeliveryDate: '2026-02-09', priority: 'medium' },
    { id: 'PO-2026-004', vendorId: 'V-011', vendorName: 'MedSupply Pro', items: [{ id: 'li-004-1', name: 'Surgical Gloves (box/100)', quantity: 500, unitPrice: 18, total: 9000 },{ id: 'li-004-2', name: 'Sterile Syringes', quantity: 2000, unitPrice: 4.5, total: 9000 }], subtotal: 18000, tax: 1800, total: 19800, status: 'invoiced', deliveryStatus: 'invoiced', createdAt: '2026-01-12', deliveryDate: '2026-01-25', actualDeliveryDate: '2026-01-24', priority: 'high' },
    { id: 'PO-2026-005', vendorId: 'V-008', vendorName: 'GreenPack Solutions', items: [{ id: 'li-005-1', name: 'Biodegradable Boxes', quantity: 5000, unitPrice: 1.8, total: 9000 }], subtotal: 9000, tax: 900, total: 9900, status: 'invoiced', deliveryStatus: 'invoiced', createdAt: '2026-01-15', deliveryDate: '2026-02-01', actualDeliveryDate: '2026-02-01', priority: 'low' },

    // ── Feb 2026 — mix invoiced/delivered ──
    { id: 'PO-2026-006', vendorId: 'V-004', vendorName: 'Nordic Components', items: [{ id: 'li-006-1', name: 'ARM Microcontrollers', quantity: 300, unitPrice: 95, total: 28500 },{ id: 'li-006-2', name: 'FPGA Chips', quantity: 100, unitPrice: 180, total: 18000 }], subtotal: 46500, tax: 4650, total: 51150, status: 'invoiced', deliveryStatus: 'invoiced', createdAt: '2026-02-02', deliveryDate: '2026-03-05', actualDeliveryDate: '2026-03-04', priority: 'high' },
    { id: 'PO-2026-007', vendorId: 'V-010', vendorName: 'AgriSource Global', items: [{ id: 'li-007-1', name: 'Soybean Seeds (50kg)', quantity: 200, unitPrice: 65, total: 13000 }], subtotal: 13000, tax: 1300, total: 14300, status: 'invoiced', deliveryStatus: 'invoiced', createdAt: '2026-02-05', deliveryDate: '2026-02-28', actualDeliveryDate: '2026-02-26', priority: 'medium' },
    { id: 'PO-2026-008', vendorId: 'V-006', vendorName: 'EuroChem Supplies', items: [{ id: 'li-008-1', name: 'Ethylene Glycol (drum)', quantity: 40, unitPrice: 280, total: 11200 },{ id: 'li-008-2', name: 'Sulfuric Acid (drum)', quantity: 20, unitPrice: 150, total: 3000 }], subtotal: 14200, tax: 1420, total: 15620, status: 'invoiced', deliveryStatus: 'invoiced', createdAt: '2026-02-08', deliveryDate: '2026-03-01', actualDeliveryDate: '2026-03-03', priority: 'medium' },
    { id: 'PO-2026-009', vendorId: 'V-017', vendorName: 'NanoChip Systems', items: [{ id: 'li-009-1', name: 'DDR5 Memory Chips', quantity: 500, unitPrice: 42, total: 21000 }], subtotal: 21000, tax: 2100, total: 23100, status: 'invoiced', deliveryStatus: 'invoiced', createdAt: '2026-02-10', deliveryDate: '2026-03-10', actualDeliveryDate: '2026-03-08', priority: 'high' },
    { id: 'PO-2026-010', vendorId: 'V-020', vendorName: 'SmartPack Solutions', items: [{ id: 'li-010-1', name: 'Foam Inserts (custom)', quantity: 2000, unitPrice: 3.5, total: 7000 },{ id: 'li-010-2', name: 'Shrink Wrap Rolls', quantity: 100, unitPrice: 45, total: 4500 }], subtotal: 11500, tax: 1150, total: 12650, status: 'invoiced', deliveryStatus: 'invoiced', createdAt: '2026-02-14', deliveryDate: '2026-03-07', actualDeliveryDate: '2026-03-06', priority: 'low' },

    // ── Mar 2026 ──
    { id: 'PO-2026-011', vendorId: 'V-003', vendorName: 'Pacific Logistics', items: [{ id: 'li-011-1', name: 'Air Freight Q1', quantity: 1, unitPrice: 12000, total: 12000 }], subtotal: 12000, tax: 1200, total: 13200, status: 'invoiced', deliveryStatus: 'invoiced', createdAt: '2026-03-01', deliveryDate: '2026-03-20', actualDeliveryDate: '2026-03-19', priority: 'high' },
    { id: 'PO-2026-012', vendorId: 'V-015', vendorName: 'PharmaLink Corp', items: [{ id: 'li-012-1', name: 'API Compounds (kg)', quantity: 50, unitPrice: 380, total: 19000 }], subtotal: 19000, tax: 1900, total: 20900, status: 'invoiced', deliveryStatus: 'invoiced', createdAt: '2026-03-03', deliveryDate: '2026-03-28', actualDeliveryDate: '2026-03-30', priority: 'high' },
    { id: 'PO-2026-013', vendorId: 'V-018', vendorName: 'IronCast Foundry', items: [{ id: 'li-013-1', name: 'Cast Iron Flanges', quantity: 150, unitPrice: 95, total: 14250 }], subtotal: 14250, tax: 1425, total: 15675, status: 'invoiced', deliveryStatus: 'invoiced', createdAt: '2026-03-05', deliveryDate: '2026-04-05', actualDeliveryDate: '2026-04-04', priority: 'medium' },
    { id: 'PO-2026-014', vendorId: 'V-013', vendorName: 'FreshFarm Organics', items: [{ id: 'li-014-1', name: 'Organic Wheat (ton)', quantity: 20, unitPrice: 420, total: 8400 }], subtotal: 8400, tax: 840, total: 9240, status: 'invoiced', deliveryStatus: 'invoiced', createdAt: '2026-03-08', deliveryDate: '2026-03-25', actualDeliveryDate: '2026-03-24', priority: 'low' },
    { id: 'PO-2026-015', vendorId: 'V-009', vendorName: 'TechComponents Inc', items: [{ id: 'li-015-1', name: 'USB-C Connectors', quantity: 5000, unitPrice: 2.8, total: 14000 },{ id: 'li-015-2', name: 'HDMI Ports', quantity: 1000, unitPrice: 6.5, total: 6500 }], subtotal: 20500, tax: 2050, total: 22550, status: 'delivered', deliveryStatus: 'delivered', createdAt: '2026-03-10', deliveryDate: '2026-04-10', actualDeliveryDate: '2026-04-12', priority: 'medium' },

    // ── Apr 2026 ──
    { id: 'PO-2026-016', vendorId: 'V-001', vendorName: 'Acme Manufacturing', items: [{ id: 'li-016-1', name: 'LED Driver ICs', quantity: 1000, unitPrice: 8.5, total: 8500 },{ id: 'li-016-2', name: 'Capacitors 100uF', quantity: 10000, unitPrice: 0.35, total: 3500 }], subtotal: 12000, tax: 1200, total: 13200, status: 'delivered', deliveryStatus: 'delivered', createdAt: '2026-04-01', deliveryDate: '2026-04-25', actualDeliveryDate: '2026-04-24', priority: 'medium' },
    { id: 'PO-2026-017', vendorId: 'V-005', vendorName: 'TexSource International', items: [{ id: 'li-017-1', name: 'Polyester Yarn (kg)', quantity: 2000, unitPrice: 4.2, total: 8400 }], subtotal: 8400, tax: 840, total: 9240, status: 'delivered', deliveryStatus: 'delivered', createdAt: '2026-04-03', deliveryDate: '2026-04-28', actualDeliveryDate: '2026-05-02', priority: 'low' },
    { id: 'PO-2026-018', vendorId: 'V-007', vendorName: 'SteelWorks Corp', items: [{ id: 'li-018-1', name: 'Stainless Steel Sheets', quantity: 100, unitPrice: 320, total: 32000 }], subtotal: 32000, tax: 3200, total: 35200, status: 'delivered', deliveryStatus: 'delivered', createdAt: '2026-04-05', deliveryDate: '2026-05-05', actualDeliveryDate: '2026-05-05', priority: 'high' },
    { id: 'PO-2026-019', vendorId: 'V-011', vendorName: 'MedSupply Pro', items: [{ id: 'li-019-1', name: 'Diagnostic Kits', quantity: 300, unitPrice: 55, total: 16500 }], subtotal: 16500, tax: 1650, total: 18150, status: 'delivered', deliveryStatus: 'delivered', createdAt: '2026-04-08', deliveryDate: '2026-04-30', actualDeliveryDate: '2026-04-29', priority: 'high' },
    { id: 'PO-2026-020', vendorId: 'V-014', vendorName: 'SwiftShip Express', items: [{ id: 'li-020-1', name: 'Express Courier Q2', quantity: 1, unitPrice: 8500, total: 8500 }], subtotal: 8500, tax: 850, total: 9350, status: 'delivered', deliveryStatus: 'delivered', createdAt: '2026-04-10', deliveryDate: '2026-04-22', actualDeliveryDate: '2026-04-21', priority: 'medium' },
    { id: 'PO-2026-021', vendorId: 'V-004', vendorName: 'Nordic Components', items: [{ id: 'li-021-1', name: 'RF Transceivers', quantity: 200, unitPrice: 125, total: 25000 }], subtotal: 25000, tax: 2500, total: 27500, status: 'delivered', deliveryStatus: 'delivered', createdAt: '2026-04-12', deliveryDate: '2026-05-15', actualDeliveryDate: '2026-05-18', priority: 'high' },
    { id: 'PO-2026-022', vendorId: 'V-020', vendorName: 'SmartPack Solutions', items: [{ id: 'li-022-1', name: 'Corrugated Cartons', quantity: 3000, unitPrice: 2.2, total: 6600 }], subtotal: 6600, tax: 660, total: 7260, status: 'delivered', deliveryStatus: 'delivered', createdAt: '2026-04-15', deliveryDate: '2026-05-01', actualDeliveryDate: '2026-05-01', priority: 'low' },
    { id: 'PO-2026-023', vendorId: 'V-017', vendorName: 'NanoChip Systems', items: [{ id: 'li-023-1', name: 'GPU Processor Units', quantity: 50, unitPrice: 850, total: 42500 }], subtotal: 42500, tax: 4250, total: 46750, status: 'delivered', deliveryStatus: 'delivered', createdAt: '2026-04-18', deliveryDate: '2026-05-20', actualDeliveryDate: '2026-05-22', priority: 'high' },
    { id: 'PO-2026-024', vendorId: 'V-006', vendorName: 'EuroChem Supplies', items: [{ id: 'li-024-1', name: 'Acetone (drum)', quantity: 30, unitPrice: 195, total: 5850 }], subtotal: 5850, tax: 585, total: 6435, status: 'delivered', deliveryStatus: 'delivered', createdAt: '2026-04-20', deliveryDate: '2026-05-10', actualDeliveryDate: '2026-05-09', priority: 'medium' },
    { id: 'PO-2026-025', vendorId: 'V-013', vendorName: 'FreshFarm Organics', items: [{ id: 'li-025-1', name: 'Organic Corn (ton)', quantity: 15, unitPrice: 390, total: 5850 }], subtotal: 5850, tax: 585, total: 6435, status: 'delivered', deliveryStatus: 'delivered', createdAt: '2026-04-22', deliveryDate: '2026-05-08', actualDeliveryDate: '2026-05-08', priority: 'low' },

    // ── May 2026 ──
    { id: 'PO-2026-026', vendorId: 'V-002', vendorName: 'Global Parts Ltd', items: [{ id: 'li-026-1', name: 'Transmission Gears', quantity: 60, unitPrice: 580, total: 34800 }], subtotal: 34800, tax: 3480, total: 38280, status: 'delivered', deliveryStatus: 'delivered', createdAt: '2026-05-02', deliveryDate: '2026-05-30', actualDeliveryDate: '2026-05-29', priority: 'high' },
    { id: 'PO-2026-027', vendorId: 'V-009', vendorName: 'TechComponents Inc', items: [{ id: 'li-027-1', name: 'Bluetooth Modules', quantity: 800, unitPrice: 12, total: 9600 }], subtotal: 9600, tax: 960, total: 10560, status: 'delivered', deliveryStatus: 'delivered', createdAt: '2026-05-04', deliveryDate: '2026-05-28', actualDeliveryDate: '2026-05-27', priority: 'medium' },
    { id: 'PO-2026-028', vendorId: 'V-018', vendorName: 'IronCast Foundry', items: [{ id: 'li-028-1', name: 'Ductile Iron Pipes', quantity: 80, unitPrice: 145, total: 11600 }], subtotal: 11600, tax: 1160, total: 12760, status: 'in-transit', deliveryStatus: 'in-transit', createdAt: '2026-05-06', deliveryDate: '2026-06-10', priority: 'medium' },
    { id: 'PO-2026-029', vendorId: 'V-015', vendorName: 'PharmaLink Corp', items: [{ id: 'li-029-1', name: 'Excipients (kg)', quantity: 100, unitPrice: 95, total: 9500 }], subtotal: 9500, tax: 950, total: 10450, status: 'in-transit', deliveryStatus: 'in-transit', createdAt: '2026-05-08', deliveryDate: '2026-06-05', priority: 'high' },
    { id: 'PO-2026-030', vendorId: 'V-008', vendorName: 'GreenPack Solutions', items: [{ id: 'li-030-1', name: 'Recycled Paper Pulp', quantity: 1000, unitPrice: 2.4, total: 2400 },{ id: 'li-030-2', name: 'Eco Tape Rolls', quantity: 500, unitPrice: 3.8, total: 1900 }], subtotal: 4300, tax: 430, total: 4730, status: 'in-transit', deliveryStatus: 'in-transit', createdAt: '2026-05-10', deliveryDate: '2026-06-08', priority: 'low' },
    { id: 'PO-2026-031', vendorId: 'V-001', vendorName: 'Acme Manufacturing', items: [{ id: 'li-031-1', name: 'Inverter Boards', quantity: 150, unitPrice: 220, total: 33000 }], subtotal: 33000, tax: 3300, total: 36300, status: 'confirmed', deliveryStatus: 'confirmed', createdAt: '2026-05-12', deliveryDate: '2026-06-15', priority: 'high' },
    { id: 'PO-2026-032', vendorId: 'V-003', vendorName: 'Pacific Logistics', items: [{ id: 'li-032-1', name: 'Sea Freight Q2', quantity: 1, unitPrice: 18000, total: 18000 }], subtotal: 18000, tax: 1800, total: 19800, status: 'confirmed', deliveryStatus: 'confirmed', createdAt: '2026-05-14', deliveryDate: '2026-06-20', priority: 'medium' },
    { id: 'PO-2026-033', vendorId: 'V-010', vendorName: 'AgriSource Global', items: [{ id: 'li-033-1', name: 'Fertilizer NPK (ton)', quantity: 30, unitPrice: 520, total: 15600 }], subtotal: 15600, tax: 1560, total: 17160, status: 'confirmed', deliveryStatus: 'confirmed', createdAt: '2026-05-16', deliveryDate: '2026-06-18', priority: 'medium' },
    { id: 'PO-2026-034', vendorId: 'V-012', vendorName: 'BuildRight Materials', items: [{ id: 'li-034-1', name: 'Portland Cement (bag)', quantity: 500, unitPrice: 12, total: 6000 },{ id: 'li-034-2', name: 'Rebar 16mm (ton)', quantity: 10, unitPrice: 780, total: 7800 }], subtotal: 13800, tax: 1380, total: 15180, status: 'ordered', deliveryStatus: 'ordered', createdAt: '2026-05-18', deliveryDate: '2026-06-25', priority: 'medium' },
    { id: 'PO-2026-035', vendorId: 'V-014', vendorName: 'SwiftShip Express', items: [{ id: 'li-035-1', name: 'Last-Mile Delivery Batch', quantity: 1, unitPrice: 5500, total: 5500 }], subtotal: 5500, tax: 550, total: 6050, status: 'ordered', deliveryStatus: 'ordered', createdAt: '2026-05-20', deliveryDate: '2026-06-12', priority: 'low' },

    // ── Jun 2026 — active + OVERDUE ──
    { id: 'PO-2026-036', vendorId: 'V-004', vendorName: 'Nordic Components', items: [{ id: 'li-036-1', name: 'Power Management ICs', quantity: 400, unitPrice: 72, total: 28800 }], subtotal: 28800, tax: 2880, total: 31680, status: 'in-transit', deliveryStatus: 'in-transit', createdAt: '2026-06-01', deliveryDate: '2026-06-22', priority: 'high' },
    { id: 'PO-2026-037', vendorId: 'V-017', vendorName: 'NanoChip Systems', items: [{ id: 'li-037-1', name: 'SoC Development Kits', quantity: 30, unitPrice: 650, total: 19500 }], subtotal: 19500, tax: 1950, total: 21450, status: 'confirmed', deliveryStatus: 'confirmed', createdAt: '2026-06-02', deliveryDate: '2026-06-28', priority: 'high' },
    { id: 'PO-2026-038', vendorId: 'V-007', vendorName: 'SteelWorks Corp', items: [{ id: 'li-038-1', name: 'Alloy Steel Bars', quantity: 200, unitPrice: 110, total: 22000 }], subtotal: 22000, tax: 2200, total: 24200, status: 'ordered', deliveryStatus: 'ordered', createdAt: '2026-06-03', deliveryDate: '2026-07-05', priority: 'medium' },
    { id: 'PO-2026-039', vendorId: 'V-011', vendorName: 'MedSupply Pro', items: [{ id: 'li-039-1', name: 'IV Sets (carton)', quantity: 200, unitPrice: 28, total: 5600 }], subtotal: 5600, tax: 560, total: 6160, status: 'ordered', deliveryStatus: 'ordered', createdAt: '2026-06-04', deliveryDate: '2026-06-30', priority: 'high' },
    { id: 'PO-2026-040', vendorId: 'V-020', vendorName: 'SmartPack Solutions', items: [{ id: 'li-040-1', name: 'Blister Packs (1000)', quantity: 100, unitPrice: 48, total: 4800 }], subtotal: 4800, tax: 480, total: 5280, status: 'ordered', deliveryStatus: 'ordered', createdAt: '2026-06-05', deliveryDate: '2026-06-28', priority: 'low' },
    // OVERDUE — deliveryDate already passed, not delivered/invoiced
    { id: 'PO-2026-041', vendorId: 'V-005', vendorName: 'TexSource International', items: [{ id: 'li-041-1', name: 'Denim Fabric (m)', quantity: 3000, unitPrice: 5.5, total: 16500 }], subtotal: 16500, tax: 1650, total: 18150, status: 'confirmed', deliveryStatus: 'confirmed', createdAt: '2026-05-01', deliveryDate: '2026-05-25', priority: 'high' },
    { id: 'PO-2026-042', vendorId: 'V-012', vendorName: 'BuildRight Materials', items: [{ id: 'li-042-1', name: 'Ceramic Tiles (sqm)', quantity: 800, unitPrice: 22, total: 17600 }], subtotal: 17600, tax: 1760, total: 19360, status: 'ordered', deliveryStatus: 'ordered', createdAt: '2026-04-28', deliveryDate: '2026-05-20', priority: 'medium' },
    { id: 'PO-2026-043', vendorId: 'V-019', vendorName: 'CleanChem Industries', items: [{ id: 'li-043-1', name: 'Solvent Mix (drum)', quantity: 25, unitPrice: 240, total: 6000 }], subtotal: 6000, tax: 600, total: 6600, status: 'ordered', deliveryStatus: 'ordered', createdAt: '2026-04-25', deliveryDate: '2026-05-15', priority: 'medium' },
    { id: 'PO-2026-044', vendorId: 'V-003', vendorName: 'Pacific Logistics', items: [{ id: 'li-044-1', name: 'Road Freight Batch', quantity: 1, unitPrice: 7200, total: 7200 }], subtotal: 7200, tax: 720, total: 7920, status: 'in-transit', deliveryStatus: 'in-transit', createdAt: '2026-05-05', deliveryDate: '2026-05-22', priority: 'high' },
    { id: 'PO-2026-045', vendorId: 'V-016', vendorName: 'PolyTex Fabrics', items: [{ id: 'li-045-1', name: 'Cotton Blend (m)', quantity: 2000, unitPrice: 3.8, total: 7600 }], subtotal: 7600, tax: 760, total: 8360, status: 'confirmed', deliveryStatus: 'confirmed', createdAt: '2026-04-30', deliveryDate: '2026-05-18', priority: 'low' },
    // Recent ordered
    { id: 'PO-2026-046', vendorId: 'V-009', vendorName: 'TechComponents Inc', items: [{ id: 'li-046-1', name: 'WiFi 6 Modules', quantity: 600, unitPrice: 18, total: 10800 }], subtotal: 10800, tax: 1080, total: 11880, status: 'ordered', deliveryStatus: 'ordered', createdAt: '2026-06-06', deliveryDate: '2026-07-10', priority: 'medium' },
    { id: 'PO-2026-047', vendorId: 'V-015', vendorName: 'PharmaLink Corp', items: [{ id: 'li-047-1', name: 'Vitamin C Bulk (kg)', quantity: 200, unitPrice: 85, total: 17000 }], subtotal: 17000, tax: 1700, total: 18700, status: 'ordered', deliveryStatus: 'ordered', createdAt: '2026-06-07', deliveryDate: '2026-07-15', priority: 'high' },
    { id: 'PO-2026-048', vendorId: 'V-013', vendorName: 'FreshFarm Organics', items: [{ id: 'li-048-1', name: 'Organic Rice (ton)', quantity: 25, unitPrice: 480, total: 12000 }], subtotal: 12000, tax: 1200, total: 13200, status: 'confirmed', deliveryStatus: 'confirmed', createdAt: '2026-06-08', deliveryDate: '2026-07-01', priority: 'medium' },
    { id: 'PO-2026-049', vendorId: 'V-018', vendorName: 'IronCast Foundry', items: [{ id: 'li-049-1', name: 'Valve Bodies (unit)', quantity: 60, unitPrice: 210, total: 12600 }], subtotal: 12600, tax: 1260, total: 13860, status: 'ordered', deliveryStatus: 'ordered', createdAt: '2026-06-09', deliveryDate: '2026-07-20', priority: 'medium' },
    { id: 'PO-2026-050', vendorId: 'V-001', vendorName: 'Acme Manufacturing', items: [{ id: 'li-050-1', name: 'Solar Charge Controllers', quantity: 100, unitPrice: 175, total: 17500 }], subtotal: 17500, tax: 1750, total: 19250, status: 'ordered', deliveryStatus: 'ordered', createdAt: '2026-06-10', deliveryDate: '2026-07-08', priority: 'high' },
  ];

  for (const o of orders) { await upsertPurchaseOrder(o); }

  // ── 20 Vendor Ratings ────────────────────────────────────────
  const ratings: VendorRating[] = [
    { id: 'VR-001', vendorId: 'V-001', vendorName: 'Acme Manufacturing', overall: 80, delivery: 85, quality: 90, cost: 75, sustainability: 62, innovation: 80, lastReviewed: '2026-03-10', strengths: ['Consistent PCB quality', 'Responsive support'], weaknesses: ['Occasional lead time slippage', 'High MOQ'] },
    { id: 'VR-002', vendorId: 'V-002', vendorName: 'Global Parts Ltd', overall: 84, delivery: 93, quality: 89, cost: 71, sustainability: 76, innovation: 86, lastReviewed: '2026-03-15', strengths: ['Excellent on-time rate', 'Strong QC process'], weaknesses: ['Premium pricing', 'Long negotiation cycles'] },
    { id: 'VR-003', vendorId: 'V-003', vendorName: 'Pacific Logistics', overall: 73, delivery: 79, quality: 83, cost: 81, sustainability: 57, innovation: 66, lastReviewed: '2026-02-20', strengths: ['Competitive freight rates', 'Wide Asia-Pacific coverage'], weaknesses: ['Tracking visibility poor', 'Customs delays'] },
    { id: 'VR-004', vendorId: 'V-004', vendorName: 'Nordic Components', overall: 88, delivery: 96, quality: 95, cost: 64, sustainability: 91, innovation: 89, lastReviewed: '2026-04-01', strengths: ['Best-in-class quality', 'Sustainability leader'], weaknesses: ['Expensive', 'Long lead times'] },
    { id: 'VR-005', vendorId: 'V-005', vendorName: 'TexSource International', overall: 62, delivery: 68, quality: 72, cost: 87, sustainability: 48, innovation: 57, lastReviewed: '2026-02-28', strengths: ['Very cost competitive', 'Large capacity'], weaknesses: ['Quality inconsistency', 'Delivery delays common'] },
    { id: 'VR-006', vendorId: 'V-006', vendorName: 'EuroChem Supplies', overall: 79, delivery: 81, quality: 86, cost: 79, sustainability: 72, innovation: 76, lastReviewed: '2026-03-22', strengths: ['Reliable chemical purity', 'Good documentation'], weaknesses: ['Occasional back-orders', 'Rigid contract terms'] },
    { id: 'VR-007', vendorId: 'V-007', vendorName: 'SteelWorks Corp', overall: 78, delivery: 89, quality: 88, cost: 73, sustainability: 66, innovation: 71, lastReviewed: '2026-04-05', strengths: ['Consistent steel grades', 'Strong after-sales'], weaknesses: ['High minimum orders', 'Limited product range'] },
    { id: 'VR-008', vendorId: 'V-008', vendorName: 'GreenPack Solutions', overall: 87, delivery: 91, quality: 93, cost: 69, sustainability: 96, innovation: 83, lastReviewed: '2026-03-28', strengths: ['Industry-leading sustainability', 'Premium packaging quality'], weaknesses: ['Higher cost vs alternatives', 'Narrow product catalog'] },
    { id: 'VR-009', vendorId: 'V-009', vendorName: 'TechComponents Inc', overall: 82, delivery: 87, quality: 90, cost: 78, sustainability: 61, innovation: 93, lastReviewed: '2026-04-08', strengths: ['Cutting-edge components', 'Fast prototyping'], weaknesses: ['Stock availability issues', 'Low sustainability focus'] },
    { id: 'VR-010', vendorId: 'V-010', vendorName: 'AgriSource Global', overall: 75, delivery: 76, quality: 82, cost: 83, sustainability: 71, innovation: 64, lastReviewed: '2026-03-18', strengths: ['Fair trade certified', 'Good crop diversity'], weaknesses: ['Seasonal availability', 'Delivery variability'] },
    { id: 'VR-011', vendorId: 'V-011', vendorName: 'MedSupply Pro', overall: 94, delivery: 97, quality: 99, cost: 58, sustainability: 86, innovation: 91, lastReviewed: '2026-04-12', strengths: ['Highest quality standards', 'FDA-compliant always'], weaknesses: ['Very expensive', 'Strict ordering process'] },
    { id: 'VR-012', vendorId: 'V-012', vendorName: 'BuildRight Materials', overall: 65, delivery: 67, quality: 76, cost: 90, sustainability: 53, innovation: 65, lastReviewed: '2026-02-15', strengths: ['Low cost per unit', 'Good local stock'], weaknesses: ['Delivery reliability poor', 'Quality QC gaps'] },
    { id: 'VR-013', vendorId: 'V-013', vendorName: 'FreshFarm Organics', overall: 86, delivery: 88, quality: 94, cost: 63, sustainability: 98, innovation: 72, lastReviewed: '2026-03-30', strengths: ['Certified organic produce', 'Sustainable farming'], weaknesses: ['Seasonal constraints', 'High cost premium'] },
    { id: 'VR-014', vendorId: 'V-014', vendorName: 'SwiftShip Express', overall: 77, delivery: 84, quality: 80, cost: 77, sustainability: 53, innovation: 70, lastReviewed: '2026-03-05', strengths: ['Fast last-mile delivery', 'Good tracking'], weaknesses: ['Limited heavy freight', 'Fuel surcharges frequent'] },
    { id: 'VR-015', vendorId: 'V-015', vendorName: 'PharmaLink Corp', overall: 92, delivery: 95, quality: 97, cost: 55, sustainability: 80, innovation: 94, lastReviewed: '2026-04-14', strengths: ['Regulatory excellence', 'Innovative formulations'], weaknesses: ['Very high pricing', 'Complex procurement process'] },
    { id: 'VR-016', vendorId: 'V-016', vendorName: 'PolyTex Fabrics', overall: 55, delivery: 62, quality: 68, cost: 93, sustainability: 36, innovation: 50, lastReviewed: '2026-01-20', strengths: ['Lowest cost fabric supplier', 'High volume capacity'], weaknesses: ['Quality issues', 'Poor sustainability', 'Delivery delays'] },
    { id: 'VR-017', vendorId: 'V-017', vendorName: 'NanoChip Systems', overall: 90, delivery: 92, quality: 96, cost: 68, sustainability: 74, innovation: 97, lastReviewed: '2026-04-10', strengths: ['Most innovative semiconductor supplier', 'Top-tier quality'], weaknesses: ['Long lead times', 'Expensive for small orders'] },
    { id: 'VR-018', vendorId: 'V-018', vendorName: 'IronCast Foundry', overall: 81, delivery: 90, quality: 92, cost: 70, sustainability: 68, innovation: 78, lastReviewed: '2026-03-25', strengths: ['Reliable cast quality', 'Good JIT delivery'], weaknesses: ['High MOQ', 'Long tooling lead time'] },
    { id: 'VR-019', vendorId: 'V-019', vendorName: 'CleanChem Industries', overall: 52, delivery: 58, quality: 70, cost: 76, sustainability: 44, innovation: 56, lastReviewed: '2026-01-10', strengths: ['Competitive pricing'], weaknesses: ['Compliance issues', 'Inconsistent quality', 'Suspended status'] },
    { id: 'VR-020', vendorId: 'V-020', vendorName: 'SmartPack Solutions', overall: 85, delivery: 88, quality: 90, cost: 72, sustainability: 88, innovation: 85, lastReviewed: '2026-04-02', strengths: ['Smart packaging innovation', 'Eco-friendly materials'], weaknesses: ['Higher cost vs standard', 'Limited heavy-duty range'] },
  ];

  for (const r of ratings) { await upsertVendorRating(r); }

  // ── 50 Delivery Performance records ─────────────────────────
  // Matches all invoiced/delivered POs above
  const perfs: DeliveryPerformance[] = [
    // Invoiced — Jan/Feb 2026
    { id: 'dp-001', poId: 'PO-2026-001', vendorId: 'V-001', vendorName: 'Acme Manufacturing', promisedDate: '2026-01-28', actualDate: '2026-01-27', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    { id: 'dp-002', poId: 'PO-2026-002', vendorId: 'V-002', vendorName: 'Global Parts Ltd', promisedDate: '2026-02-05', actualDate: '2026-02-07', status: 'delayed', delayDays: 2, onTime: false, daysDifference: -2 },
    { id: 'dp-003', poId: 'PO-2026-003', vendorId: 'V-007', vendorName: 'SteelWorks Corp', promisedDate: '2026-02-10', actualDate: '2026-02-09', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    { id: 'dp-004', poId: 'PO-2026-004', vendorId: 'V-011', vendorName: 'MedSupply Pro', promisedDate: '2026-01-25', actualDate: '2026-01-24', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    { id: 'dp-005', poId: 'PO-2026-005', vendorId: 'V-008', vendorName: 'GreenPack Solutions', promisedDate: '2026-02-01', actualDate: '2026-02-01', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 0 },
    // Feb invoiced
    { id: 'dp-006', poId: 'PO-2026-006', vendorId: 'V-004', vendorName: 'Nordic Components', promisedDate: '2026-03-05', actualDate: '2026-03-04', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    { id: 'dp-007', poId: 'PO-2026-007', vendorId: 'V-010', vendorName: 'AgriSource Global', promisedDate: '2026-02-28', actualDate: '2026-02-26', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 2 },
    { id: 'dp-008', poId: 'PO-2026-008', vendorId: 'V-006', vendorName: 'EuroChem Supplies', promisedDate: '2026-03-01', actualDate: '2026-03-03', status: 'delayed', delayDays: 2, onTime: false, daysDifference: -2 },
    { id: 'dp-009', poId: 'PO-2026-009', vendorId: 'V-017', vendorName: 'NanoChip Systems', promisedDate: '2026-03-10', actualDate: '2026-03-08', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 2 },
    { id: 'dp-010', poId: 'PO-2026-010', vendorId: 'V-020', vendorName: 'SmartPack Solutions', promisedDate: '2026-03-07', actualDate: '2026-03-06', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    // Mar invoiced
    { id: 'dp-011', poId: 'PO-2026-011', vendorId: 'V-003', vendorName: 'Pacific Logistics', promisedDate: '2026-03-20', actualDate: '2026-03-19', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    { id: 'dp-012', poId: 'PO-2026-012', vendorId: 'V-015', vendorName: 'PharmaLink Corp', promisedDate: '2026-03-28', actualDate: '2026-03-30', status: 'delayed', delayDays: 2, onTime: false, daysDifference: -2 },
    { id: 'dp-013', poId: 'PO-2026-013', vendorId: 'V-018', vendorName: 'IronCast Foundry', promisedDate: '2026-04-05', actualDate: '2026-04-04', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    { id: 'dp-014', poId: 'PO-2026-014', vendorId: 'V-013', vendorName: 'FreshFarm Organics', promisedDate: '2026-03-25', actualDate: '2026-03-24', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    { id: 'dp-015', poId: 'PO-2026-015', vendorId: 'V-009', vendorName: 'TechComponents Inc', promisedDate: '2026-04-10', actualDate: '2026-04-12', status: 'delayed', delayDays: 2, onTime: false, daysDifference: -2 },
    // Apr delivered
    { id: 'dp-016', poId: 'PO-2026-016', vendorId: 'V-001', vendorName: 'Acme Manufacturing', promisedDate: '2026-04-25', actualDate: '2026-04-24', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    { id: 'dp-017', poId: 'PO-2026-017', vendorId: 'V-005', vendorName: 'TexSource International', promisedDate: '2026-04-28', actualDate: '2026-05-02', status: 'delayed', delayDays: 4, onTime: false, daysDifference: -4 },
    { id: 'dp-018', poId: 'PO-2026-018', vendorId: 'V-007', vendorName: 'SteelWorks Corp', promisedDate: '2026-05-05', actualDate: '2026-05-05', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'dp-019', poId: 'PO-2026-019', vendorId: 'V-011', vendorName: 'MedSupply Pro', promisedDate: '2026-04-30', actualDate: '2026-04-29', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    { id: 'dp-020', poId: 'PO-2026-020', vendorId: 'V-014', vendorName: 'SwiftShip Express', promisedDate: '2026-04-22', actualDate: '2026-04-21', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    { id: 'dp-021', poId: 'PO-2026-021', vendorId: 'V-004', vendorName: 'Nordic Components', promisedDate: '2026-05-15', actualDate: '2026-05-18', status: 'delayed', delayDays: 3, onTime: false, daysDifference: -3 },
    { id: 'dp-022', poId: 'PO-2026-022', vendorId: 'V-020', vendorName: 'SmartPack Solutions', promisedDate: '2026-05-01', actualDate: '2026-05-01', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'dp-023', poId: 'PO-2026-023', vendorId: 'V-017', vendorName: 'NanoChip Systems', promisedDate: '2026-05-20', actualDate: '2026-05-22', status: 'delayed', delayDays: 2, onTime: false, daysDifference: -2 },
    { id: 'dp-024', poId: 'PO-2026-024', vendorId: 'V-006', vendorName: 'EuroChem Supplies', promisedDate: '2026-05-10', actualDate: '2026-05-09', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    { id: 'dp-025', poId: 'PO-2026-025', vendorId: 'V-013', vendorName: 'FreshFarm Organics', promisedDate: '2026-05-08', actualDate: '2026-05-08', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 0 },
    // May delivered
    { id: 'dp-026', poId: 'PO-2026-026', vendorId: 'V-002', vendorName: 'Global Parts Ltd', promisedDate: '2026-05-30', actualDate: '2026-05-29', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    { id: 'dp-027', poId: 'PO-2026-027', vendorId: 'V-009', vendorName: 'TechComponents Inc', promisedDate: '2026-05-28', actualDate: '2026-05-27', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    // In-transit (no actual date yet — partial records for tracking)
    { id: 'dp-028', poId: 'PO-2026-028', vendorId: 'V-018', vendorName: 'IronCast Foundry', promisedDate: '2026-06-10', actualDate: null, status: 'delayed', delayDays: 0, onTime: false, daysDifference: 0 },
    { id: 'dp-029', poId: 'PO-2026-029', vendorId: 'V-015', vendorName: 'PharmaLink Corp', promisedDate: '2026-06-05', actualDate: null, status: 'delayed', delayDays: 0, onTime: false, daysDifference: 0 },
    { id: 'dp-030', poId: 'PO-2026-030', vendorId: 'V-008', vendorName: 'GreenPack Solutions', promisedDate: '2026-06-08', actualDate: null, status: 'delayed', delayDays: 0, onTime: false, daysDifference: 0 },
    // Overdue POs — no delivery performance (they never arrived)
    { id: 'dp-041', poId: 'PO-2026-041', vendorId: 'V-005', vendorName: 'TexSource International', promisedDate: '2026-05-25', actualDate: null, status: 'delayed', delayDays: 16, onTime: false, daysDifference: -16 },
    { id: 'dp-042', poId: 'PO-2026-042', vendorId: 'V-012', vendorName: 'BuildRight Materials', promisedDate: '2026-05-20', actualDate: null, status: 'delayed', delayDays: 21, onTime: false, daysDifference: -21 },
    { id: 'dp-043', poId: 'PO-2026-043', vendorId: 'V-019', vendorName: 'CleanChem Industries', promisedDate: '2026-05-15', actualDate: null, status: 'delayed', delayDays: 26, onTime: false, daysDifference: -26 },
    { id: 'dp-044', poId: 'PO-2026-044', vendorId: 'V-003', vendorName: 'Pacific Logistics', promisedDate: '2026-05-22', actualDate: null, status: 'delayed', delayDays: 19, onTime: false, daysDifference: -19 },
    { id: 'dp-045', poId: 'PO-2026-045', vendorId: 'V-016', vendorName: 'PolyTex Fabrics', promisedDate: '2026-05-18', actualDate: null, status: 'delayed', delayDays: 23, onTime: false, daysDifference: -23 },
    // Active ordered/confirmed (future dates — no perf record needed, add placeholders)
    { id: 'dp-031', poId: 'PO-2026-031', vendorId: 'V-001', vendorName: 'Acme Manufacturing', promisedDate: '2026-06-15', actualDate: null, status: 'delayed', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'dp-032', poId: 'PO-2026-032', vendorId: 'V-003', vendorName: 'Pacific Logistics', promisedDate: '2026-06-20', actualDate: null, status: 'delayed', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'dp-033', poId: 'PO-2026-033', vendorId: 'V-010', vendorName: 'AgriSource Global', promisedDate: '2026-06-18', actualDate: null, status: 'delayed', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'dp-034', poId: 'PO-2026-034', vendorId: 'V-012', vendorName: 'BuildRight Materials', promisedDate: '2026-06-25', actualDate: null, status: 'delayed', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'dp-035', poId: 'PO-2026-035', vendorId: 'V-014', vendorName: 'SwiftShip Express', promisedDate: '2026-06-12', actualDate: null, status: 'delayed', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'dp-036', poId: 'PO-2026-036', vendorId: 'V-004', vendorName: 'Nordic Components', promisedDate: '2026-06-22', actualDate: null, status: 'delayed', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'dp-037', poId: 'PO-2026-037', vendorId: 'V-017', vendorName: 'NanoChip Systems', promisedDate: '2026-06-28', actualDate: null, status: 'delayed', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'dp-038', poId: 'PO-2026-038', vendorId: 'V-007', vendorName: 'SteelWorks Corp', promisedDate: '2026-07-05', actualDate: null, status: 'delayed', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'dp-039', poId: 'PO-2026-039', vendorId: 'V-011', vendorName: 'MedSupply Pro', promisedDate: '2026-06-30', actualDate: null, status: 'delayed', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'dp-040', poId: 'PO-2026-040', vendorId: 'V-020', vendorName: 'SmartPack Solutions', promisedDate: '2026-06-28', actualDate: null, status: 'delayed', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'dp-046', poId: 'PO-2026-046', vendorId: 'V-009', vendorName: 'TechComponents Inc', promisedDate: '2026-07-10', actualDate: null, status: 'delayed', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'dp-047', poId: 'PO-2026-047', vendorId: 'V-015', vendorName: 'PharmaLink Corp', promisedDate: '2026-07-15', actualDate: null, status: 'delayed', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'dp-048', poId: 'PO-2026-048', vendorId: 'V-013', vendorName: 'FreshFarm Organics', promisedDate: '2026-07-01', actualDate: null, status: 'delayed', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'dp-049', poId: 'PO-2026-049', vendorId: 'V-018', vendorName: 'IronCast Foundry', promisedDate: '2026-07-20', actualDate: null, status: 'delayed', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'dp-050', poId: 'PO-2026-050', vendorId: 'V-001', vendorName: 'Acme Manufacturing', promisedDate: '2026-07-08', actualDate: null, status: 'delayed', delayDays: 0, onTime: true, daysDifference: 0 },
  ];

  for (const p of perfs) { await upsertDeliveryPerformance(p); }
  } catch (err) {
    console.error('seedData failed, app loads with empty data:', err);
  }
}

// ─── Legacy localStorage helpers (no-op, kept for interface compatibility) ───

export function getVendors(): Vendor[] { return []; }
export function getPurchaseOrders(): PurchaseOrder[] { return []; }
export function getVendorRatings(): VendorRating[] { return []; }
export function getDeliveryPerformance(): DeliveryPerformance[] { return []; }