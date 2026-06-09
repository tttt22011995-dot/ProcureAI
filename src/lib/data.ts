import { supabase } from './supabase';

// ─── TypeScript Models (unchanged) ───

export interface Vendor {
  id: string;
  vendorCode: string;
  name: string;
  category: string;
  location: string;
  rating: number;
  status: 'active' | 'under-review' | 'inactive';
  contractEnd: string;
  email: string;
  spend: number;
  contact: string;
  phone: string;
  paymentTerms: string;
  leadTime: number;
  notes: string;
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
  status: 'draft' | 'pending' | 'approved' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  deliveryDate: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  deliveryStatus?: 'ordered' | 'confirmed' | 'in-transit' | 'delivered' | 'invoiced';
  actualDeliveryDate?: string | null;
  deliveryNotes?: DeliveryNote[];
  subtotal?: number;
  tax?: number;
}

export interface VendorRating {
  vendorId: string;
  quality: number;
  delivery: number;
  cost: number;
  responsiveness: number;
  overall: number;
  trend: 'up' | 'down' | 'stable';
}

export interface DeliveryPerformance {
  id: string;
  poId: string;
  vendorId: string;
  vendorName: string;
  promisedDate: string;
  actualDate: string | null;
  status: 'on-time' | 'delayed' | 'in-transit' | 'pending';
  delayDays: number;
  onTime?: boolean;
  daysDifference?: number;
}

// ─── Cache for local data (populated from Supabase) ───

let vendorsCache: Vendor[] = [];
let purchaseOrdersCache: PurchaseOrder[] = [];
let vendorRatingsCache: VendorRating[] = [];
let deliveryPerformanceCache: DeliveryPerformance[] = [];

// ─── Helper: Row to Vendor ───

function rowToVendor(row: Record<string, unknown>): Vendor {
  return {
    id: row.id as string,
    vendorCode: row.vendor_code as string,
    name: row.name as string,
    category: row.category as string,
    location: row.location as string,
    rating: Number(row.rating) || 0,
    status: (row.status as Vendor['status']) || 'active',
    contractEnd: (row.contract_end as string) || '',
    email: row.email as string,
    spend: Number(row.spend) || 0,
    contact: row.contact as string,
    phone: (row.phone as string) || '',
    paymentTerms: (row.payment_terms as string) || 'Net 30',
    leadTime: Number(row.lead_time) || 0,
    notes: (row.notes as string) || '',
  };
}

// ─── Helper: Vendor to Row ───

function vendorToRow(v: Vendor): Record<string, unknown> {
  return {
    id: v.id,
    vendor_code: v.vendorCode,
    name: v.name,
    category: v.category,
    location: v.location,
    rating: v.rating,
    status: v.status,
    contract_end: v.contractEnd || null,
    email: v.email,
    spend: v.spend,
    contact: v.contact,
    phone: v.phone || null,
    payment_terms: v.paymentTerms,
    lead_time: v.leadTime,
    notes: v.notes || null,
  };
}

// ─── Helper: Row to PurchaseOrder ───

function rowToPurchaseOrder(row: Record<string, unknown>): PurchaseOrder {
  return {
    id: row.id as string,
    vendorId: row.vendor_id as string,
    vendorName: row.vendor_name as string,
    items: (row.items as LineItem[]) || [],
    subtotal: Number(row.subtotal) || 0,
    tax: Number(row.tax) || 0,
    total: Number(row.total) || 0,
    status: (row.status as PurchaseOrder['status']) || 'draft',
    createdAt: row.created_at as string,
    deliveryDate: row.delivery_date as string,
    priority: (row.priority as PurchaseOrder['priority']) || 'medium',
    deliveryStatus: (row.delivery_status as PurchaseOrder['deliveryStatus']) || 'ordered',
    actualDeliveryDate: (row.actual_delivery_date as string) || null,
    deliveryNotes: (row.delivery_notes as DeliveryNote[]) || [],
  };
}

// ─── Helper: PurchaseOrder to Row ───

function purchaseOrderToRow(po: PurchaseOrder): Record<string, unknown> {
  return {
    id: po.id,
    vendor_id: po.vendorId,
    vendor_name: po.vendorName,
    items: po.items,
    subtotal: po.subtotal || po.total,
    tax: po.tax || 0,
    total: po.total,
    status: po.status,
    created_at: po.createdAt,
    delivery_date: po.deliveryDate,
    priority: po.priority,
    delivery_status: po.deliveryStatus || 'ordered',
    actual_delivery_date: po.actualDeliveryDate || null,
    delivery_notes: po.deliveryNotes || [],
  };
}

// ─── Helper: Row to VendorRating ───

function rowToVendorRating(row: Record<string, unknown>): VendorRating {
  return {
    vendorId: row.vendor_id as string,
    quality: Number(row.quality) || 0,
    delivery: Number(row.delivery) || 0,
    cost: Number(row.cost) || 0,
    responsiveness: Number(row.responsiveness) || 0,
    overall: Number(row.overall) || 0,
    trend: (row.trend as VendorRating['trend']) || 'stable',
  };
}

// ─── Helper: VendorRating to Row ───

function vendorRatingToRow(vr: VendorRating): Record<string, unknown> {
  return {
    vendor_id: vr.vendorId,
    quality: vr.quality,
    delivery: vr.delivery,
    cost: vr.cost,
    responsiveness: vr.responsiveness,
    overall: vr.overall,
    trend: vr.trend,
  };
}

// ─── Helper: Row to DeliveryPerformance ───

function rowToDeliveryPerformance(row: Record<string, unknown>): DeliveryPerformance {
  return {
    id: row.id as string,
    poId: row.po_id as string,
    vendorId: row.vendor_id as string,
    vendorName: row.vendor_name as string,
    promisedDate: row.promised_date as string,
    actualDate: (row.actual_date as string) || null,
    status: (row.status as DeliveryPerformance['status']) || 'pending',
    delayDays: Number(row.delay_days) || 0,
    onTime: row.on_time as boolean,
    daysDifference: Number(row.days_difference) || 0,
  };
}

// ─── Helper: DeliveryPerformance to Row ───

function deliveryPerformanceToRow(dp: DeliveryPerformance): Record<string, unknown> {
  return {
    id: dp.id,
    po_id: dp.poId,
    vendor_id: dp.vendorId,
    vendor_name: dp.vendorName,
    promised_date: dp.promisedDate,
    actual_date: dp.actualDate || null,
    status: dp.status,
    delay_days: dp.delayDays,
    on_time: dp.onTime ?? true,
    days_difference: dp.daysDifference || 0,
  };
}

// ─── Async Data Fetchers ───

export async function fetchVendors(): Promise<Vendor[]> {
  try {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .order('name');
    if (error) {
      console.error('Error fetching vendors:', error);
      return [];
    }
    vendorsCache = (data || []).map(rowToVendor);
    return vendorsCache;
  } catch (err) {
    console.error('Exception fetching vendors:', err);
    return [];
  }
}

export async function fetchPurchaseOrders(): Promise<PurchaseOrder[]> {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching purchase orders:', error);
      return [];
    }
    purchaseOrdersCache = (data || []).map(rowToPurchaseOrder);
    return purchaseOrdersCache;
  } catch (err) {
    console.error('Exception fetching purchase orders:', err);
    return [];
  }
}

export async function fetchVendorRatings(): Promise<VendorRating[]> {
  try {
    const { data, error } = await supabase
      .from('vendor_ratings')
      .select('*');
    if (error) {
      console.error('Error fetching vendor ratings:', error);
      return [];
    }
    vendorRatingsCache = (data || []).map(rowToVendorRating);
    return vendorRatingsCache;
  } catch (err) {
    console.error('Exception fetching vendor ratings:', err);
    return [];
  }
}

export async function fetchDeliveryPerformance(): Promise<DeliveryPerformance[]> {
  try {
    const { data, error } = await supabase
      .from('delivery_performance')
      .select('*');
    if (error) {
      console.error('Error fetching delivery performance:', error);
      return [];
    }
    deliveryPerformanceCache = (data || []).map(rowToDeliveryPerformance);
    return deliveryPerformanceCache;
  } catch (err) {
    console.error('Exception fetching delivery performance:', err);
    return [];
  }
}

// ─── Synchronous getters (from cache) ───

export const getVendors = () => vendorsCache;
export const getPurchaseOrders = () => purchaseOrdersCache;
export const getVendorRatings = () => vendorRatingsCache;
export const getDeliveryPerformance = () => deliveryPerformanceCache;

// ─── Async CRUD Operations ───

export async function upsertVendor(v: Vendor): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('vendors')
      .upsert(vendorToRow(v), { onConflict: 'id' });
    if (error) {
      console.error('Error upserting vendor:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception upserting vendor:', err);
    return false;
  }
}

export async function deleteVendor(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting vendor:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception deleting vendor:', err);
    return false;
  }
}

export async function upsertPurchaseOrder(po: PurchaseOrder): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('purchase_orders')
      .upsert(purchaseOrderToRow(po), { onConflict: 'id' });
    if (error) {
      console.error('Error upserting purchase order:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception upserting purchase order:', err);
    return false;
  }
}

export async function deletePurchaseOrderById(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting purchase order:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception deleting purchase order:', err);
    return false;
  }
}

export async function upsertVendorRating(vr: VendorRating): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('vendor_ratings')
      .upsert(vendorRatingToRow(vr), { onConflict: 'vendor_id' });
    if (error) {
      console.error('Error upserting vendor rating:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception upserting vendor rating:', err);
    return false;
  }
}

export async function upsertDeliveryPerformance(dp: DeliveryPerformance): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('delivery_performance')
      .upsert(deliveryPerformanceToRow(dp), { onConflict: 'po_id' });
    if (error) {
      console.error('Error upserting delivery performance:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception upserting delivery performance:', err);
    return false;
  }
}

export async function deleteDeliveryPerformanceByPOId(poId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('delivery_performance')
      .delete()
      .eq('po_id', poId);
    if (error) {
      console.error('Error deleting delivery performance:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception deleting delivery performance:', err);
    return false;
  }
}

// ─── Lookup Functions ───

export function getVendorById(id: string): Vendor | undefined {
  return vendorsCache.find(v => v.id === id);
}

export function nextVendorCode(): string {
  const maxNum = vendorsCache.reduce((max, v) => {
    const m = v.vendorCode.match(/VND-(\d+)/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  return `VND-${String(maxNum + 1).padStart(3, '0')}`;
}

export function nextPONumber(): string {
  const year = new Date().getFullYear();
  const yearPOs = purchaseOrdersCache.filter(p => p.id.startsWith(`PO-${year}-`));
  const maxNum = yearPOs.reduce((max, po) => {
    const m = po.id.match(/PO-\d{4}-(\d+)/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  return `PO-${year}-${String(maxNum + 1).padStart(3, '0')}`;
}

export function getPOsByVendor(vendorId: string): PurchaseOrder[] {
  return purchaseOrdersCache.filter(po => po.vendorId === vendorId);
}

export function getVendorRating(vendorId: string): VendorRating | undefined {
  return vendorRatingsCache.find(vr => vr.vendorId === vendorId);
}

// ─── Catalog Items ───

export interface CatalogItem {
  name: string;
  unitPrice: number;
}

export const CATALOG_ITEMS: CatalogItem[] = [
  { name: 'Steel Billets Grade A', unitPrice: 120 },
  { name: 'Steel Billets Grade B', unitPrice: 95 },
  { name: 'Aluminum Sheets 1mm', unitPrice: 65 },
  { name: 'Aluminum Sheets 2mm', unitPrice: 85 },
  { name: 'Aluminum Sheets 3mm', unitPrice: 105 },
  { name: 'Copper Wire 8AWG', unitPrice: 12 },
  { name: 'Copper Wire 12AWG', unitPrice: 8 },
  { name: 'Titanium Rods 10mm', unitPrice: 280 },
  { name: 'Titanium Rods 15mm', unitPrice: 340 },
  { name: 'PCB Assembly Board X7', unitPrice: 340 },
  { name: 'PCB Assembly Board X9', unitPrice: 420 },
  { name: 'Corrugated Box L-12', unitPrice: 2.4 },
  { name: 'Corrugated Box L-24', unitPrice: 3.8 },
  { name: 'Shrink Wrap Roll 500m', unitPrice: 45 },
  { name: 'Shrink Wrap Roll 1000m', unitPrice: 78 },
  { name: 'Freight Service - East Coast', unitPrice: 15000 },
  { name: 'Freight Service - West Coast', unitPrice: 18000 },
  { name: 'Industrial Adhesive 5L', unitPrice: 125 },
  { name: 'Safety Gloves Box/100', unitPrice: 45 },
  { name: 'Nitrile Gloves Box/200', unitPrice: 38 },
  { name: 'Steel Pipes 2-inch', unitPrice: 85 },
  { name: 'PVC Pipes 4-inch', unitPrice: 22 },
  { name: 'Electrical Cable 100m', unitPrice: 180 },
  { name: 'LED Panel Light 60x60', unitPrice: 95 },
  { name: 'Hydraulic Pump HP-200', unitPrice: 2400 },
  { name: 'Bearing Set BS-100', unitPrice: 320 },
  { name: 'Rubber Gasket Kit', unitPrice: 45 },
  { name: 'Stainless Steel Bolts M8', unitPrice: 0.85 },
  { name: 'Carbon Fiber Sheet 1m x 1m', unitPrice: 450 },
  { name: 'Injection Molded Parts Kit', unitPrice: 180 },
];

// ─── Business Logic ───

export function isOverdue(po: PurchaseOrder): boolean {
  if (po.status === 'delivered' || po.status === 'cancelled') return false;
  const expected = new Date(po.deliveryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expected < today;
}

export type POStatusColor = 'blue' | 'purple' | 'orange' | 'cyan' | 'green' | 'red' | 'grey';

export const poStatusColorMap: Record<string, POStatusColor> = {
  draft: 'purple',
  pending: 'blue',
  approved: 'purple',
  shipped: 'cyan',
  delivered: 'green',
  cancelled: 'red',
  ordered: 'blue',
  confirmed: 'purple',
  'in-transit': 'orange',
  invoiced: 'grey',
  overdue: 'red',
};

export function getEffectivePOStatus(po: PurchaseOrder): string {
  if (isOverdue(po)) return 'overdue';
  return po.status;
}

export function computeAlerts(): Array<{ id: string; type: string; message: string; page: Page; entityId: string }> {
  const alerts: Array<{ id: string; type: string; message: string; page: Page; entityId: string }> = [];
  const pos = purchaseOrdersCache;
  const ratings = vendorRatingsCache;
  const vendors = vendorsCache;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // (a) Overdue POs
  pos.forEach(po => {
    if (isOverdue(po)) {
      alerts.push({
        id: `overdue-${po.id}`,
        type: 'overdue',
        message: `${po.id} (${po.vendorName}) is overdue — expected ${po.deliveryDate}`,
        page: 'purchase-orders',
        entityId: po.id,
      });
    }
  });

  // (b) Vendor with score < 60 (overall rating < 3.0 on 5-point scale = 60%)
  ratings.forEach(vr => {
    if (vr.overall < 3.0) {
      const vendor = vendors.find(v => v.id === vr.vendorId);
      alerts.push({
        id: `low-score-${vr.vendorId}`,
        type: 'low-score',
        message: `${vendor?.name ?? vr.vendorId} score is ${(vr.overall * 20).toFixed(0)}/100`,
        page: 'scorecard',
        entityId: vr.vendorId,
      });
    }
  });

  // (c) PO stuck in pending/approved for >= 7 days
  pos.forEach(po => {
    if (po.status === 'pending' || po.status === 'approved') {
      const created = new Date(po.createdAt);
      created.setHours(0, 0, 0, 0);
      const daysSince = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= 7) {
        alerts.push({
          id: `stuck-${po.id}`,
          type: 'stuck',
          message: `${po.id} stuck in ${po.status} for ${daysSince} days`,
          page: 'purchase-orders',
          entityId: po.id,
        });
      }
    }
  });

  return alerts;
}

export type Page = 'dashboard' | 'vendors' | 'purchase-orders' | 'delivery' | 'scorecard' | 'ai-risk';

// ─── Seed Data (Full Dataset) ───

async function seedVendors(): Promise<void> {
  const sampleVendors: Vendor[] = [
    { id: 'v1', vendorCode: 'VND-001', name: 'Apex Materials Inc.', category: 'Raw Materials', location: 'Houston, TX', rating: 4.5, status: 'active', contractEnd: '2026-12-31', email: 'contact@apexmaterials.com', spend: 2450000, contact: 'James Morgan', phone: '+1-713-555-0101', paymentTerms: 'Net 30', leadTime: 14, notes: 'Preferred supplier for steel and aluminum. Consistent quality ratings above 4.5.' },
    { id: 'v2', vendorCode: 'VND-002', name: 'NovaTech Components', category: 'Electronics', location: 'San Jose, CA', rating: 4.2, status: 'active', contractEnd: '2026-09-30', email: 'orders@novatech.io', spend: 1870000, contact: 'Lisa Chen', phone: '+1-408-555-0202', paymentTerms: 'Net 60', leadTime: 21, notes: 'Key PCB and semiconductor supplier. Lead times can vary seasonally.' },
    { id: 'v3', vendorCode: 'VND-003', name: 'GreenLine Logistics', category: 'Logistics', location: 'Chicago, IL', rating: 3.8, status: 'under-review', contractEnd: '2026-06-30', email: 'ops@greenlinelog.com', spend: 960000, contact: 'Mark Thompson', phone: '+1-312-555-0303', paymentTerms: 'Net 30', leadTime: 3, notes: 'Under review due to recent delivery delays. On-time rate dropped below 70%.' },
    { id: 'v4', vendorCode: 'VND-004', name: 'Pinnacle Packaging', category: 'Packaging', location: 'Atlanta, GA', rating: 4.7, status: 'active', contractEnd: '2027-03-31', email: 'sales@pinnaclepkg.com', spend: 720000, contact: 'Sarah Williams', phone: '+1-404-555-0404', paymentTerms: 'Net 30', leadTime: 7, notes: 'Top-rated vendor. Consistently exceeds quality and delivery expectations.' },
    { id: 'v5', vendorCode: 'VND-005', name: 'Sterling Fasteners', category: 'Raw Materials', location: 'Detroit, MI', rating: 3.4, status: 'inactive', contractEnd: '2025-12-31', email: 'info@sterlingfast.com', spend: 410000, contact: 'Robert Kim', phone: '+1-313-555-0505', paymentTerms: 'Net 90', leadTime: 28, notes: 'Contract expired. Inactive status. Consider re-evaluation if hardware needs arise.' },
    { id: 'v6', vendorCode: 'VND-006', name: 'TechForge Components', category: 'Electronics', location: 'Austin, TX', rating: 4.4, status: 'active', contractEnd: '2027-06-30', email: 'supply@techforge.io', spend: 1580000, contact: 'Emily Rodriguez', phone: '+1-512-555-0606', paymentTerms: 'Net 45', leadTime: 18, notes: 'Fast-growing electronics supplier. Excellent quality scores.' },
    { id: 'v7', vendorCode: 'VND-007', name: 'PetroChem Industries', category: 'Raw Materials', location: 'Baton Rouge, LA', rating: 4.0, status: 'active', contractEnd: '2026-08-31', email: 'orders@petrochem.com', spend: 3200000, contact: 'Michael Davis', phone: '+1-225-555-0707', paymentTerms: 'Net 30', leadTime: 10, notes: 'Primary petrochemical supplier. Large volume contracts.' },
    { id: 'v8', vendorCode: 'VND-008', name: 'SteelPeak Logistics', category: 'Logistics', location: 'Memphis, TN', rating: 3.2, status: 'under-review', contractEnd: '2026-03-31', email: 'dispatch@steelpeak.com', spend: 840000, contact: 'Rachel Green', phone: '+1-901-555-0808', paymentTerms: 'Net 30', leadTime: 5, notes: 'Performance issues flagged. Multiple delayed shipments in Q4.' },
    { id: 'v9', vendorCode: 'VND-009', name: 'NanoChem Labs', category: 'Raw Materials', location: 'San Diego, CA', rating: 4.6, status: 'active', contractEnd: '2027-12-31', email: 'sales@nanochem.com', spend: 1120000, contact: 'David Park', phone: '+1-619-555-0909', paymentTerms: 'Net 60', leadTime: 12, notes: 'Specialty chemicals. High-quality niche supplier.' },
    { id: 'v10', vendorCode: 'VND-010', name: 'GlobalTech Systems', category: 'Electronics', location: 'Boston, MA', rating: 4.1, status: 'active', contractEnd: '2026-11-30', email: 'procurement@globaltech.com', spend: 2150000, contact: 'Amanda Foster', phone: '+1-617-555-1010', paymentTerms: 'Net 45', leadTime: 25, notes: 'IT hardware and networking equipment.' },
    { id: 'v11', vendorCode: 'VND-011', name: 'EcoPack Solutions', category: 'Packaging', location: 'Portland, OR', rating: 4.3, status: 'active', contractEnd: '2027-09-30', email: 'orders@ecopack.com', spend: 680000, contact: 'Brian Thompson', phone: '+1-503-555-1111', paymentTerms: 'Net 30', leadTime: 9, notes: 'Sustainable packaging. Strong environmental credentials.' },
    { id: 'v12', vendorCode: 'VND-012', name: 'PrecisionTools Inc.', category: 'Raw Materials', location: 'Cleveland, OH', rating: 3.9, status: 'active', contractEnd: '2026-07-31', email: 'supply@precisiontools.com', spend: 920000, contact: 'Jennifer White', phone: '+1-216-555-1212', paymentTerms: 'Net 30', leadTime: 16, notes: 'Industrial tools and hardware. Reliable mid-tier supplier.' },
  ];

  for (const v of sampleVendors) {
    await upsertVendor(v);
  }
}

async function seedPurchaseOrders(): Promise<void> {
  const samplePOs: PurchaseOrder[] = [
    { id: 'PO-1001', vendorId: 'v1', vendorName: 'Apex Materials Inc.', items: [{ id: 'li1', name: 'Steel Billets Grade A', quantity: 500, unitPrice: 120, total: 60000 }, { id: 'li2', name: 'Aluminum Sheets 2mm', quantity: 300, unitPrice: 85, total: 25500 }], subtotal: 85500, tax: 8550, total: 94050, status: 'approved', createdAt: '2026-05-15', deliveryDate: '2026-06-20', priority: 'high', deliveryStatus: 'confirmed', actualDeliveryDate: null, deliveryNotes: [] },
    { id: 'PO-1002', vendorId: 'v2', vendorName: 'NovaTech Components', items: [{ id: 'li3', name: 'PCB Assembly Board X7', quantity: 200, unitPrice: 340, total: 68000 }], subtotal: 68000, tax: 6800, total: 74800, status: 'shipped', createdAt: '2026-05-10', deliveryDate: '2026-06-12', priority: 'medium', deliveryStatus: 'in-transit', actualDeliveryDate: null, deliveryNotes: [] },
    { id: 'PO-1003', vendorId: 'v3', vendorName: 'GreenLine Logistics', items: [{ id: 'li4', name: 'Freight Service - East Coast', quantity: 1, unitPrice: 15000, total: 15000 }], subtotal: 15000, tax: 1500, total: 16500, status: 'pending', createdAt: '2026-06-01', deliveryDate: '2026-07-01', priority: 'low', deliveryStatus: 'ordered', actualDeliveryDate: null, deliveryNotes: [] },
    { id: 'PO-1004', vendorId: 'v4', vendorName: 'Pinnacle Packaging', items: [{ id: 'li5', name: 'Corrugated Box L-12', quantity: 5000, unitPrice: 2.4, total: 12000 }, { id: 'li6', name: 'Shrink Wrap Roll 500m', quantity: 100, unitPrice: 45, total: 4500 }], subtotal: 16500, tax: 1650, total: 18150, status: 'delivered', createdAt: '2026-04-20', deliveryDate: '2026-05-15', priority: 'medium', deliveryStatus: 'invoiced', actualDeliveryDate: '2026-05-14', deliveryNotes: [] },
    { id: 'PO-1005', vendorId: 'v1', vendorName: 'Apex Materials Inc.', items: [{ id: 'li7', name: 'Copper Wire 8AWG', quantity: 1000, unitPrice: 12, total: 12000 }, { id: 'li8', name: 'Titanium Rods 10mm', quantity: 50, unitPrice: 280, total: 14000 }], subtotal: 26000, tax: 2600, total: 28600, status: 'draft', createdAt: '2026-06-08', deliveryDate: '2026-07-15', priority: 'critical', deliveryStatus: 'ordered', actualDeliveryDate: null, deliveryNotes: [] },
    { id: 'PO-1006', vendorId: 'v6', vendorName: 'TechForge Components', items: [{ id: 'li9', name: 'PCB Assembly Board X9', quantity: 150, unitPrice: 420, total: 63000 }], subtotal: 63000, tax: 6300, total: 69300, status: 'approved', createdAt: '2026-05-18', deliveryDate: '2026-06-25', priority: 'high', deliveryStatus: 'confirmed', actualDeliveryDate: null, deliveryNotes: [] },
    { id: 'PO-1007', vendorId: 'v7', vendorName: 'PetroChem Industries', items: [{ id: 'li10', name: 'Industrial Adhesive 5L', quantity: 200, unitPrice: 125, total: 25000 }], subtotal: 25000, tax: 2500, total: 27500, status: 'delivered', createdAt: '2026-04-15', deliveryDate: '2026-05-20', priority: 'medium', deliveryStatus: 'invoiced', actualDeliveryDate: '2026-05-18', deliveryNotes: [] },
    { id: 'PO-1008', vendorId: 'v8', vendorName: 'SteelPeak Logistics', items: [{ id: 'li11', name: 'Freight Service - West Coast', quantity: 1, unitPrice: 18000, total: 18000 }], subtotal: 18000, tax: 1800, total: 19800, status: 'pending', createdAt: '2026-06-02', deliveryDate: '2026-06-20', priority: 'high', deliveryStatus: 'ordered', actualDeliveryDate: null, deliveryNotes: [] },
    { id: 'PO-1009', vendorId: 'v9', vendorName: 'NanoChem Labs', items: [{ id: 'li12', name: 'Carbon Fiber Sheet 1m x 1m', quantity: 50, unitPrice: 450, total: 22500 }], subtotal: 22500, tax: 2250, total: 24750, status: 'shipped', createdAt: '2026-05-22', deliveryDate: '2026-06-18', priority: 'medium', deliveryStatus: 'in-transit', actualDeliveryDate: null, deliveryNotes: [] },
    { id: 'PO-1010', vendorId: 'v10', vendorName: 'GlobalTech Systems', items: [{ id: 'li13', name: 'Hydraulic Pump HP-200', quantity: 10, unitPrice: 2400, total: 24000 }, { id: 'li14', name: 'LED Panel Light 60x60', quantity: 100, unitPrice: 95, total: 9500 }], subtotal: 33500, tax: 3350, total: 36850, status: 'approved', createdAt: '2026-05-20', deliveryDate: '2026-06-30', priority: 'medium', deliveryStatus: 'confirmed', actualDeliveryDate: null, deliveryNotes: [] },
    { id: 'PO-1011', vendorId: 'v11', vendorName: 'EcoPack Solutions', items: [{ id: 'li15', name: 'Corrugated Box L-24', quantity: 3000, unitPrice: 3.8, total: 11400 }, { id: 'li16', name: 'Shrink Wrap Roll 1000m', quantity: 50, unitPrice: 78, total: 3900 }], subtotal: 15300, tax: 1530, total: 16830, status: 'delivered', createdAt: '2026-04-10', deliveryDate: '2026-05-10', priority: 'low', deliveryStatus: 'invoiced', actualDeliveryDate: '2026-05-09', deliveryNotes: [] },
    { id: 'PO-1012', vendorId: 'v12', vendorName: 'PrecisionTools Inc.', items: [{ id: 'li17', name: 'Bearing Set BS-100', quantity: 20, unitPrice: 320, total: 6400 }, { id: 'li18', name: 'Rubber Gasket Kit', quantity: 100, unitPrice: 45, total: 4500 }], subtotal: 10900, tax: 1090, total: 11990, status: 'draft', createdAt: '2026-06-07', deliveryDate: '2026-07-10', priority: 'medium', deliveryStatus: 'ordered', actualDeliveryDate: null, deliveryNotes: [] },
    { id: 'PO-1013', vendorId: 'v2', vendorName: 'NovaTech Components', items: [{ id: 'li19', name: 'Electrical Cable 100m', quantity: 50, unitPrice: 180, total: 9000 }], subtotal: 9000, tax: 900, total: 9900, status: 'delivered', createdAt: '2026-04-05', deliveryDate: '2026-05-08', priority: 'low', deliveryStatus: 'invoiced', actualDeliveryDate: '2026-05-07', deliveryNotes: [] },
    { id: 'PO-1014', vendorId: 'v1', vendorName: 'Apex Materials Inc.', items: [{ id: 'li20', name: 'Steel Pipes 2-inch', quantity: 200, unitPrice: 85, total: 17000 }, { id: 'li21', name: 'Stainless Steel Bolts M8', quantity: 10000, unitPrice: 0.85, total: 8500 }], subtotal: 25500, tax: 2550, total: 28050, status: 'shipped', createdAt: '2026-05-25', deliveryDate: '2026-06-22', priority: 'high', deliveryStatus: 'in-transit', actualDeliveryDate: null, deliveryNotes: [] },
    { id: 'PO-1015', vendorId: 'v4', vendorName: 'Pinnacle Packaging', items: [{ id: 'li22', name: 'Corrugated Box L-12', quantity: 8000, unitPrice: 2.4, total: 19200 }], subtotal: 19200, tax: 1920, total: 21120, status: 'pending', createdAt: '2026-06-05', deliveryDate: '2026-06-28', priority: 'medium', deliveryStatus: 'ordered', actualDeliveryDate: null, deliveryNotes: [] },
    { id: 'PO-1016', vendorId: 'v6', vendorName: 'TechForge Components', items: [{ id: 'li23', name: 'Injection Molded Parts Kit', quantity: 75, unitPrice: 180, total: 13500 }], subtotal: 13500, tax: 1350, total: 14850, status: 'delivered', createdAt: '2026-04-12', deliveryDate: '2026-05-05', priority: 'high', deliveryStatus: 'invoiced', actualDeliveryDate: '2026-05-04', deliveryNotes: [] },
    { id: 'PO-1017', vendorId: 'v7', vendorName: 'PetroChem Industries', items: [{ id: 'li24', name: 'Safety Gloves Box/100', quantity: 200, unitPrice: 45, total: 9000 }, { id: 'li25', name: 'Nitrile Gloves Box/200', quantity: 150, unitPrice: 38, total: 5700 }], subtotal: 14700, tax: 1470, total: 16170, status: 'approved', createdAt: '2026-05-28', deliveryDate: '2026-06-15', priority: 'low', deliveryStatus: 'confirmed', actualDeliveryDate: null, deliveryNotes: [] },
    { id: 'PO-1018', vendorId: 'v9', vendorName: 'NanoChem Labs', items: [{ id: 'li26', name: 'Industrial Adhesive 5L', quantity: 100, unitPrice: 125, total: 12500 }], subtotal: 12500, tax: 1250, total: 13750, status: 'delivered', createdAt: '2026-04-18', deliveryDate: '2026-05-25', priority: 'medium', deliveryStatus: 'invoiced', actualDeliveryDate: '2026-05-24', deliveryNotes: [] },
    { id: 'PO-1019', vendorId: 'v10', vendorName: 'GlobalTech Systems', items: [{ id: 'li27', name: 'PCB Assembly Board X7', quantity: 100, unitPrice: 340, total: 34000 }], subtotal: 34000, tax: 3400, total: 37400, status: 'draft', createdAt: '2026-06-09', deliveryDate: '2026-07-20', priority: 'high', deliveryStatus: 'ordered', actualDeliveryDate: null, deliveryNotes: [] },
    { id: 'PO-1020', vendorId: 'v11', vendorName: 'EcoPack Solutions', items: [{ id: 'li28', name: 'Shrink Wrap Roll 500m', quantity: 200, unitPrice: 45, total: 9000 }], subtotal: 9000, tax: 900, total: 9900, status: 'shipped', createdAt: '2026-05-30', deliveryDate: '2026-06-25', priority: 'low', deliveryStatus: 'in-transit', actualDeliveryDate: null, deliveryNotes: [] },
    { id: 'PO-1021', vendorId: 'v3', vendorName: 'GreenLine Logistics', items: [{ id: 'li29', name: 'Freight Service - East Coast', quantity: 2, unitPrice: 15000, total: 30000 }], subtotal: 30000, tax: 3000, total: 33000, status: 'approved', createdAt: '2026-05-12', deliveryDate: '2026-06-10', priority: 'critical', deliveryStatus: 'confirmed', actualDeliveryDate: null, deliveryNotes: [] },
    { id: 'PO-1022', vendorId: 'v12', vendorName: 'PrecisionTools Inc.', items: [{ id: 'li30', name: 'Titanium Rods 15mm', quantity: 30, unitPrice: 340, total: 10200 }], subtotal: 10200, tax: 1020, total: 11220, status: 'delivered', createdAt: '2026-04-25', deliveryDate: '2026-05-28', priority: 'medium', deliveryStatus: 'invoiced', actualDeliveryDate: '2026-05-27', deliveryNotes: [] },
    { id: 'PO-1023', vendorId: 'v2', vendorName: 'NovaTech Components', items: [{ id: 'li31', name: 'Copper Wire 12AWG', quantity: 500, unitPrice: 8, total: 4000 }], subtotal: 4000, tax: 400, total: 4400, status: 'cancelled', createdAt: '2026-04-08', deliveryDate: '2026-05-01', priority: 'low', deliveryStatus: 'ordered', actualDeliveryDate: null, deliveryNotes: [] },
    { id: 'PO-1024', vendorId: 'v5', vendorName: 'Sterling Fasteners', items: [{ id: 'li32', name: 'Stainless Steel Bolts M8', quantity: 5000, unitPrice: 0.85, total: 4250 }], subtotal: 4250, tax: 425, total: 4675, status: 'delivered', createdAt: '2026-03-15', deliveryDate: '2026-04-10', priority: 'medium', deliveryStatus: 'invoiced', actualDeliveryDate: '2026-04-12', deliveryNotes: [] },
    { id: 'PO-1025', vendorId: 'v6', vendorName: 'TechForge Components', items: [{ id: 'li33', name: 'Aluminum Sheets 3mm', quantity: 100, unitPrice: 105, total: 10500 }], subtotal: 10500, tax: 1050, total: 11550, status: 'pending', createdAt: '2026-06-06', deliveryDate: '2026-07-05', priority: 'high', deliveryStatus: 'ordered', actualDeliveryDate: null, deliveryNotes: [] },
  ];

  for (const po of samplePOs) {
    await upsertPurchaseOrder(po);
  }
}

async function seedVendorRatings(): Promise<void> {
  const sampleRatings: VendorRating[] = [
    { vendorId: 'v1', quality: 4.6, delivery: 4.4, cost: 4.3, responsiveness: 4.7, overall: 4.5, trend: 'up' },
    { vendorId: 'v2', quality: 4.3, delivery: 4.0, cost: 4.1, responsiveness: 4.4, overall: 4.2, trend: 'stable' },
    { vendorId: 'v3', quality: 3.6, delivery: 3.5, cost: 4.0, responsiveness: 3.9, overall: 3.8, trend: 'down' },
    { vendorId: 'v4', quality: 4.8, delivery: 4.6, cost: 4.5, responsiveness: 4.8, overall: 4.7, trend: 'up' },
    { vendorId: 'v5', quality: 3.2, delivery: 3.0, cost: 3.8, responsiveness: 3.5, overall: 3.4, trend: 'down' },
    { vendorId: 'v6', quality: 4.5, delivery: 4.3, cost: 4.2, responsiveness: 4.6, overall: 4.4, trend: 'up' },
    { vendorId: 'v7', quality: 4.1, delivery: 4.0, cost: 3.9, responsiveness: 4.0, overall: 4.0, trend: 'stable' },
    { vendorId: 'v8', quality: 3.3, delivery: 3.1, cost: 3.5, responsiveness: 3.2, overall: 3.2, trend: 'down' },
    { vendorId: 'v9', quality: 4.7, delivery: 4.5, cost: 4.4, responsiveness: 4.7, overall: 4.6, trend: 'up' },
    { vendorId: 'v10', quality: 4.2, delivery: 4.1, cost: 4.0, responsiveness: 4.1, overall: 4.1, trend: 'stable' },
    { vendorId: 'v11', quality: 4.4, delivery: 4.3, cost: 4.2, responsiveness: 4.4, overall: 4.3, trend: 'up' },
    { vendorId: 'v12', quality: 4.0, delivery: 3.8, cost: 3.9, responsiveness: 4.0, overall: 3.9, trend: 'stable' },
  ];

  for (const vr of sampleRatings) {
    await upsertVendorRating(vr);
  }
}

async function seedDeliveryPerformance(): Promise<void> {
  const sampleDeliveries: DeliveryPerformance[] = [
    { id: 'd1', poId: 'PO-1001', vendorId: 'v1', vendorName: 'Apex Materials Inc.', promisedDate: '2026-06-20', actualDate: null, status: 'in-transit', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'd2', poId: 'PO-1002', vendorId: 'v2', vendorName: 'NovaTech Components', promisedDate: '2026-06-12', actualDate: null, status: 'in-transit', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'd3', poId: 'PO-1003', vendorId: 'v3', vendorName: 'GreenLine Logistics', promisedDate: '2026-07-01', actualDate: null, status: 'pending', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'd4', poId: 'PO-1004', vendorId: 'v4', vendorName: 'Pinnacle Packaging', promisedDate: '2026-05-15', actualDate: '2026-05-14', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    { id: 'd5', poId: 'PO-1005', vendorId: 'v1', vendorName: 'Apex Materials Inc.', promisedDate: '2026-07-15', actualDate: null, status: 'pending', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'd6', poId: 'PO-1006', vendorId: 'v6', vendorName: 'TechForge Components', promisedDate: '2026-06-25', actualDate: null, status: 'in-transit', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'd7', poId: 'PO-1007', vendorId: 'v7', vendorName: 'PetroChem Industries', promisedDate: '2026-05-20', actualDate: '2026-05-18', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 2 },
    { id: 'd8', poId: 'PO-1008', vendorId: 'v8', vendorName: 'SteelPeak Logistics', promisedDate: '2026-06-20', actualDate: null, status: 'pending', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'd9', poId: 'PO-1009', vendorId: 'v9', vendorName: 'NanoChem Labs', promisedDate: '2026-06-18', actualDate: null, status: 'in-transit', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'd10', poId: 'PO-1010', vendorId: 'v10', vendorName: 'GlobalTech Systems', promisedDate: '2026-06-30', actualDate: null, status: 'pending', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'd11', poId: 'PO-1011', vendorId: 'v11', vendorName: 'EcoPack Solutions', promisedDate: '2026-05-10', actualDate: '2026-05-09', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    { id: 'd12', poId: 'PO-1012', vendorId: 'v12', vendorName: 'PrecisionTools Inc.', promisedDate: '2026-07-10', actualDate: null, status: 'pending', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'd13', poId: 'PO-1013', vendorId: 'v2', vendorName: 'NovaTech Components', promisedDate: '2026-05-08', actualDate: '2026-05-07', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    { id: 'd14', poId: 'PO-1014', vendorId: 'v1', vendorName: 'Apex Materials Inc.', promisedDate: '2026-06-22', actualDate: null, status: 'in-transit', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'd15', poId: 'PO-1015', vendorId: 'v4', vendorName: 'Pinnacle Packaging', promisedDate: '2026-06-28', actualDate: null, status: 'pending', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'd16', poId: 'PO-1016', vendorId: 'v6', vendorName: 'TechForge Components', promisedDate: '2026-05-05', actualDate: '2026-05-04', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    { id: 'd17', poId: 'PO-1017', vendorId: 'v7', vendorName: 'PetroChem Industries', promisedDate: '2026-06-15', actualDate: null, status: 'pending', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'd18', poId: 'PO-1018', vendorId: 'v9', vendorName: 'NanoChem Labs', promisedDate: '2026-05-25', actualDate: '2026-05-24', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    { id: 'd19', poId: 'PO-1019', vendorId: 'v10', vendorName: 'GlobalTech Systems', promisedDate: '2026-07-20', actualDate: null, status: 'pending', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'd20', poId: 'PO-1020', vendorId: 'v11', vendorName: 'EcoPack Solutions', promisedDate: '2026-06-25', actualDate: null, status: 'in-transit', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'd21', poId: 'PO-1021', vendorId: 'v3', vendorName: 'GreenLine Logistics', promisedDate: '2026-06-10', actualDate: null, status: 'pending', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'd22', poId: 'PO-1022', vendorId: 'v12', vendorName: 'PrecisionTools Inc.', promisedDate: '2026-05-28', actualDate: '2026-05-27', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    { id: 'd23', poId: 'PO-1023', vendorId: 'v2', vendorName: 'NovaTech Components', promisedDate: '2026-05-01', actualDate: null, status: 'pending', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'd24', poId: 'PO-1024', vendorId: 'v5', vendorName: 'Sterling Fasteners', promisedDate: '2026-04-10', actualDate: '2026-04-12', status: 'delayed', delayDays: 2, onTime: false, daysDifference: -2 },
    { id: 'd25', poId: 'PO-1025', vendorId: 'v6', vendorName: 'TechForge Components', promisedDate: '2026-07-05', actualDate: null, status: 'pending', delayDays: 0, onTime: true, daysDifference: 0 },
  ];

  for (const dp of sampleDeliveries) {
    await upsertDeliveryPerformance(dp);
  }
}

// ─── Main Seed Function ───

export async function seedData(): Promise<void> {
  // Check if vendors table is empty
  const { count, error } = await supabase
    .from('vendors')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error checking vendors table:', error);
    return;
  }

  if (count && count > 0) {
    // Data already exists, just refresh caches
    await Promise.all([
      fetchVendors(),
      fetchPurchaseOrders(),
      fetchVendorRatings(),
      fetchDeliveryPerformance(),
    ]);
    return;
  }

  // Seed all data
  await seedVendors();
  await seedPurchaseOrders();
  await seedVendorRatings();
  await seedDeliveryPerformance();

  // Refresh caches
  await Promise.all([
    fetchVendors(),
    fetchPurchaseOrders(),
    fetchVendorRatings(),
    fetchDeliveryPerformance(),
  ]);
}

// ─── Initial Data Load (called from App.tsx) ───

export async function loadInitialData(): Promise<void> {
  await seedData();
}
