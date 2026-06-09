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

// ─── ID generators ───

export function nextVendorId(vendors: Vendor[]): string {
  const max = vendors.reduce((m, v) => {
    const num = parseInt(v.id.replace('V-', ''), 10);
    return num > m ? num : m;
  }, 0);
  return `V-${String(max + 1).padStart(3, '0')}`;
}

export function nextPONumber(orders?: PurchaseOrder[]): string {
  const all = orders ?? [];
  const max = all.reduce((m, o) => {
    const num = parseInt(o.id.replace('PO-2024-', ''), 10);
    return num > m ? num : m;
  }, 0);
  return `PO-2024-${String(max + 1).padStart(3, '0')}`;
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
  return (data ?? []).map(mapVendorRow);
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
  return (data ?? []).map(mapPORow);
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
  return (data ?? []).map(mapRatingRow);
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
    .select('*')
    .order('created_at', { ascending: false });
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
  const { data: existing } = await supabase.from('vendors').select('id').limit(1);
  if (existing && existing.length > 0) return;

  // Seed vendors
  const vendors: Vendor[] = [
    { id: 'V-001', name: 'Acme Manufacturing', category: 'Electronics', location: 'Shenzhen, China', status: 'active', riskScore: 45, riskLevel: 'medium', deliveryScore: 85, qualityScore: 90, costScore: 75, sustainabilityScore: 60, innovationScore: 80, leadTime: 14, minOrder: 5000, paymentTerms: 'Net 30', certifications: ['ISO 9001', 'ISO 14001'] },
    { id: 'V-002', name: 'Global Parts Ltd', category: 'Automotive', location: 'Stuttgart, Germany', status: 'active', riskScore: 25, riskLevel: 'low', deliveryScore: 92, qualityScore: 88, costScore: 70, sustainabilityScore: 75, innovationScore: 85, leadTime: 21, minOrder: 10000, paymentTerms: 'Net 45', certifications: ['IATF 16949', 'ISO 9001'] },
    { id: 'V-003', name: 'Pacific Logistics', category: 'Logistics', location: 'Singapore', status: 'active', riskScore: 60, riskLevel: 'medium', deliveryScore: 78, qualityScore: 82, costScore: 80, sustainabilityScore: 55, innovationScore: 65, leadTime: 7, minOrder: 2000, paymentTerms: 'Net 15', certifications: ['ISO 9001'] },
    { id: 'V-004', name: 'Nordic Components', category: 'Electronics', location: 'Helsinki, Finland', status: 'active', riskScore: 15, riskLevel: 'low', deliveryScore: 95, qualityScore: 94, costScore: 65, sustainabilityScore: 90, innovationScore: 88, leadTime: 28, minOrder: 3000, paymentTerms: 'Net 60', certifications: ['ISO 9001', 'ISO 14001', 'RoHS'] },
    { id: 'V-005', name: 'TexSource International', category: 'Textiles', location: 'Mumbai, India', status: 'active', riskScore: 70, riskLevel: 'high', deliveryScore: 72, qualityScore: 75, costScore: 85, sustainabilityScore: 50, innovationScore: 60, leadTime: 10, minOrder: 1000, paymentTerms: 'Net 30', certifications: ['OEKO-TEX', 'GOTS'] },
    { id: 'V-006', name: 'EuroChem Supplies', category: 'Chemicals', location: 'Rotterdam, Netherlands', status: 'active', riskScore: 55, riskLevel: 'medium', deliveryScore: 80, qualityScore: 85, costScore: 78, sustainabilityScore: 70, innovationScore: 75, leadTime: 14, minOrder: 5000, paymentTerms: 'Net 30', certifications: ['ISO 9001', 'REACH'] },
    { id: 'V-007', name: 'SteelWorks Corp', category: 'Metals', location: 'Pittsburgh, USA', status: 'active', riskScore: 30, riskLevel: 'low', deliveryScore: 88, qualityScore: 87, costScore: 72, sustainabilityScore: 65, innovationScore: 70, leadTime: 21, minOrder: 15000, paymentTerms: 'Net 45', certifications: ['ISO 9001', 'ASTM'] },
    { id: 'V-008', name: 'GreenPack Solutions', category: 'Packaging', location: 'Melbourne, Australia', status: 'active', riskScore: 20, riskLevel: 'low', deliveryScore: 90, qualityScore: 92, costScore: 68, sustainabilityScore: 95, innovationScore: 82, leadTime: 14, minOrder: 2000, paymentTerms: 'Net 30', certifications: ['FSC', 'ISO 14001'] },
    { id: 'V-009', name: 'TechComponents Inc', category: 'Electronics', location: 'Taipei, Taiwan', status: 'active', riskScore: 40, riskLevel: 'medium', deliveryScore: 86, qualityScore: 89, costScore: 77, sustainabilityScore: 60, innovationScore: 92, leadTime: 14, minOrder: 3000, paymentTerms: 'Net 30', certifications: ['ISO 9001', 'IPC-A-610'] },
    { id: 'V-010', name: 'AgriSource Global', category: 'Agriculture', location: 'São Paulo, Brazil', status: 'active', riskScore: 50, riskLevel: 'medium', deliveryScore: 75, qualityScore: 80, costScore: 82, sustainabilityScore: 70, innovationScore: 65, leadTime: 10, minOrder: 5000, paymentTerms: 'Net 30', certifications: ['Organic', 'Fair Trade'] },
    { id: 'V-011', name: 'MedSupply Pro', category: 'Medical', location: 'Boston, USA', status: 'active', riskScore: 10, riskLevel: 'low', deliveryScore: 96, qualityScore: 98, costScore: 60, sustainabilityScore: 85, innovationScore: 90, leadTime: 7, minOrder: 1000, paymentTerms: 'Net 15', certifications: ['FDA', 'ISO 13485'] },
    { id: 'V-012', name: 'BuildRight Materials', category: 'Construction', location: 'Dubai, UAE', status: 'active', riskScore: 65, riskLevel: 'high', deliveryScore: 70, qualityScore: 78, costScore: 88, sustainabilityScore: 55, innovationScore: 68, leadTime: 14, minOrder: 8000, paymentTerms: 'Net 45', certifications: ['ISO 9001', 'CE Mark'] },
  ];

  for (const v of vendors) {
    await upsertVendor(v);
  }

  // Seed purchase orders
  const orders: PurchaseOrder[] = [
    { id: 'PO-2024-001', vendorId: 'V-001', vendorName: 'Acme Manufacturing', items: [{ id: 'li_1', name: 'Electronic Components', quantity: 100, unitPrice: 150, total: 15000 }], total: 16500, subtotal: 15000, tax: 1500, status: 'delivered', deliveryStatus: 'invoiced', createdAt: '2024-01-15', deliveryDate: '2024-02-01', actualDeliveryDate: '2024-02-03', priority: 'high' },
    { id: 'PO-2024-002', vendorId: 'V-002', vendorName: 'Global Parts Ltd', items: [{ id: 'li_2', name: 'Automotive Parts', quantity: 50, unitPrice: 800, total: 40000 }], total: 44000, subtotal: 40000, tax: 4000, status: 'delivered', deliveryStatus: 'invoiced', createdAt: '2024-01-20', deliveryDate: '2024-02-15', actualDeliveryDate: '2024-02-14', priority: 'high' },
    { id: 'PO-2024-003', vendorId: 'V-003', vendorName: 'Pacific Logistics', items: [{ id: 'li_3', name: 'Logistics Services', quantity: 1, unitPrice: 5000, total: 5000 }], total: 5500, subtotal: 5000, tax: 500, status: 'delivered', deliveryStatus: 'invoiced', createdAt: '2024-02-01', deliveryDate: '2024-02-10', actualDeliveryDate: '2024-02-10', priority: 'medium' },
    { id: 'PO-2024-004', vendorId: 'V-004', vendorName: 'Nordic Components', items: [{ id: 'li_4', name: 'Semiconductor Chips', quantity: 200, unitPrice: 75, total: 15000 }], total: 16500, subtotal: 15000, tax: 1500, status: 'delivered', deliveryStatus: 'invoiced', createdAt: '2024-02-10', deliveryDate: '2024-03-01', actualDeliveryDate: '2024-03-05', priority: 'high' },
    { id: 'PO-2024-005', vendorId: 'V-005', vendorName: 'TexSource International', items: [{ id: 'li_5', name: 'Cotton Fabric', quantity: 500, unitPrice: 25, total: 12500 }], total: 13750, subtotal: 12500, tax: 1250, status: 'delivered', deliveryStatus: 'invoiced', createdAt: '2024-03-01', deliveryDate: '2024-03-20', actualDeliveryDate: '2024-03-25', priority: 'medium' },
    { id: 'PO-2024-006', vendorId: 'V-006', vendorName: 'EuroChem Supplies', items: [{ id: 'li_6', name: 'Industrial Chemicals', quantity: 100, unitPrice: 200, total: 20000 }], total: 22000, subtotal: 20000, tax: 2000, status: 'delivered', deliveryStatus: 'invoiced', createdAt: '2024-03-15', deliveryDate: '2024-04-01', actualDeliveryDate: '2024-04-02', priority: 'high' },
    { id: 'PO-2024-007', vendorId: 'V-007', vendorName: 'SteelWorks Corp', items: [{ id: 'li_7', name: 'Steel Beams', quantity: 30, unitPrice: 1200, total: 36000 }], total: 39600, subtotal: 36000, tax: 3600, status: 'delivered', deliveryStatus: 'invoiced', createdAt: '2024-04-01', deliveryDate: '2024-04-20', actualDeliveryDate: '2024-04-22', priority: 'medium' },
    { id: 'PO-2024-008', vendorId: 'V-008', vendorName: 'GreenPack Solutions', items: [{ id: 'li_8', name: 'Packaging Materials', quantity: 1000, unitPrice: 8, total: 8000 }], total: 8800, subtotal: 8000, tax: 800, status: 'delivered', deliveryStatus: 'invoiced', createdAt: '2024-04-10', deliveryDate: '2024-04-25', actualDeliveryDate: '2024-04-24', priority: 'low' },
    { id: 'PO-2024-009', vendorId: 'V-009', vendorName: 'TechComponents Inc', items: [{ id: 'li_9', name: 'PCB Boards', quantity: 150, unitPrice: 120, total: 18000 }], total: 19800, subtotal: 18000, tax: 1800, status: 'delivered', deliveryStatus: 'invoiced', createdAt: '2024-05-01', deliveryDate: '2024-05-15', actualDeliveryDate: '2024-05-16', priority: 'high' },
    { id: 'PO-2024-010', vendorId: 'V-010', vendorName: 'AgriSource Global', items: [{ id: 'li_10', name: 'Organic Fertilizer', quantity: 200, unitPrice: 45, total: 9000 }], total: 9900, subtotal: 9000, tax: 900, status: 'delivered', deliveryStatus: 'invoiced', createdAt: '2024-05-15', deliveryDate: '2024-06-01', actualDeliveryDate: '2024-06-02', priority: 'medium' },
    { id: 'PO-2024-011', vendorId: 'V-001', vendorName: 'Acme Manufacturing', items: [{ id: 'li_11', name: 'LED Displays', quantity: 75, unitPrice: 200, total: 15000 }], total: 16500, subtotal: 15000, tax: 1500, status: 'in-transit', deliveryStatus: 'in-transit', createdAt: '2024-06-01', deliveryDate: '2024-06-20', priority: 'high' },
    { id: 'PO-2024-012', vendorId: 'V-002', vendorName: 'Global Parts Ltd', items: [{ id: 'li_12', name: 'Engine Components', quantity: 40, unitPrice: 950, total: 38000 }], total: 41800, subtotal: 38000, tax: 3800, status: 'confirmed', deliveryStatus: 'confirmed', createdAt: '2024-06-10', deliveryDate: '2024-07-01', priority: 'high' },
    { id: 'PO-2024-013', vendorId: 'V-011', vendorName: 'MedSupply Pro', items: [{ id: 'li_13', name: 'Medical Supplies', quantity: 300, unitPrice: 60, total: 18000 }], total: 19800, subtotal: 18000, tax: 1800, status: 'ordered', deliveryStatus: 'ordered', createdAt: '2024-06-15', deliveryDate: '2024-07-10', priority: 'high' },
    { id: 'PO-2024-014', vendorId: 'V-012', vendorName: 'BuildRight Materials', items: [{ id: 'li_14', name: 'Construction Materials', quantity: 50, unitPrice: 600, total: 30000 }], total: 33000, subtotal: 30000, tax: 3000, status: 'ordered', deliveryStatus: 'ordered', createdAt: '2024-06-20', deliveryDate: '2024-07-15', priority: 'medium' },
    { id: 'PO-2024-015', vendorId: 'V-004', vendorName: 'Nordic Components', items: [{ id: 'li_15', name: 'Microcontrollers', quantity: 250, unitPrice: 85, total: 21250 }], total: 23375, subtotal: 21250, tax: 2125, status: 'in-transit', deliveryStatus: 'in-transit', createdAt: '2024-07-01', deliveryDate: '2024-07-20', priority: 'high' },
    { id: 'PO-2024-016', vendorId: 'V-003', vendorName: 'Pacific Logistics', items: [{ id: 'li_16', name: 'Shipping Services', quantity: 1, unitPrice: 8000, total: 8000 }], total: 8800, subtotal: 8000, tax: 800, status: 'confirmed', deliveryStatus: 'confirmed', createdAt: '2024-07-05', deliveryDate: '2024-07-25', priority: 'medium' },
    { id: 'PO-2024-017', vendorId: 'V-005', vendorName: 'TexSource International', items: [{ id: 'li_17', name: 'Synthetic Fabric', quantity: 400, unitPrice: 30, total: 12000 }], total: 13200, subtotal: 12000, tax: 1200, status: 'ordered', deliveryStatus: 'ordered', createdAt: '2024-07-10', deliveryDate: '2024-08-01', priority: 'low' },
    { id: 'PO-2024-018', vendorId: 'V-006', vendorName: 'EuroChem Supplies', items: [{ id: 'li_18', name: 'Lab Chemicals', quantity: 80, unitPrice: 250, total: 20000 }], total: 22000, subtotal: 20000, tax: 2000, status: 'in-transit', deliveryStatus: 'in-transit', createdAt: '2024-07-15', deliveryDate: '2024-08-05', priority: 'high' },
    { id: 'PO-2024-019', vendorId: 'V-007', vendorName: 'SteelWorks Corp', items: [{ id: 'li_19', name: 'Aluminum Sheets', quantity: 60, unitPrice: 500, total: 30000 }], total: 33000, subtotal: 30000, tax: 3000, status: 'ordered', deliveryStatus: 'ordered', createdAt: '2024-08-01', deliveryDate: '2024-08-20', priority: 'medium' },
    { id: 'PO-2024-020', vendorId: 'V-008', vendorName: 'GreenPack Solutions', items: [{ id: 'li_20', name: 'Eco Packaging', quantity: 1500, unitPrice: 6, total: 9000 }], total: 9900, subtotal: 9000, tax: 900, status: 'confirmed', deliveryStatus: 'confirmed', createdAt: '2024-08-05', deliveryDate: '2024-08-25', priority: 'low' },
    { id: 'PO-2024-021', vendorId: 'V-009', vendorName: 'TechComponents Inc', items: [{ id: 'li_21', name: 'Connectors', quantity: 500, unitPrice: 15, total: 7500 }], total: 8250, subtotal: 7500, tax: 750, status: 'ordered', deliveryStatus: 'ordered', createdAt: '2024-08-10', deliveryDate: '2024-09-01', priority: 'medium' },
    { id: 'PO-2024-022', vendorId: 'V-010', vendorName: 'AgriSource Global', items: [{ id: 'li_22', name: 'Seeds', quantity: 1000, unitPrice: 12, total: 12000 }], total: 13200, subtotal: 12000, tax: 1200, status: 'in-transit', deliveryStatus: 'in-transit', createdAt: '2024-08-15', deliveryDate: '2024-09-05', priority: 'medium' },
    { id: 'PO-2024-023', vendorId: 'V-011', vendorName: 'MedSupply Pro', items: [{ id: 'li_23', name: 'Surgical Instruments', quantity: 200, unitPrice: 120, total: 24000 }], total: 26400, subtotal: 24000, tax: 2400, status: 'confirmed', deliveryStatus: 'confirmed', createdAt: '2024-09-01', deliveryDate: '2024-09-20', priority: 'high' },
    { id: 'PO-2024-024', vendorId: 'V-012', vendorName: 'BuildRight Materials', items: [{ id: 'li_24', name: 'Concrete Mix', quantity: 100, unitPrice: 180, total: 18000 }], total: 19800, subtotal: 18000, tax: 1800, status: 'ordered', deliveryStatus: 'ordered', createdAt: '2024-09-05', deliveryDate: '2024-09-25', priority: 'medium' },
    { id: 'PO-2024-025', vendorId: 'V-001', vendorName: 'Acme Manufacturing', items: [{ id: 'li_25', name: 'Power Supplies', quantity: 120, unitPrice: 180, total: 21600 }], total: 23760, subtotal: 21600, tax: 2160, status: 'ordered', deliveryStatus: 'ordered', createdAt: '2024-09-10', deliveryDate: '2024-10-01', priority: 'high' },
  ];

  for (const o of orders) {
    await upsertPurchaseOrder(o);
  }

  // Seed vendor ratings
  const ratings: VendorRating[] = [
    { id: 'VR-001', vendorId: 'V-001', vendorName: 'Acme Manufacturing', overall: 78, delivery: 85, quality: 90, cost: 75, sustainability: 60, innovation: 80, lastReviewed: '2024-06-15', strengths: ['Quality control', 'Fast delivery'], weaknesses: ['Higher costs', 'Limited sustainability'] },
    { id: 'VR-002', vendorId: 'V-002', vendorName: 'Global Parts Ltd', overall: 82, delivery: 92, quality: 88, cost: 70, sustainability: 75, innovation: 85, lastReviewed: '2024-06-10', strengths: ['Reliable delivery', 'High quality'], weaknesses: ['Premium pricing', 'Long lead times'] },
    { id: 'VR-003', vendorId: 'V-003', vendorName: 'Pacific Logistics', overall: 72, delivery: 78, quality: 82, cost: 80, sustainability: 55, innovation: 65, lastReviewed: '2024-06-20', strengths: ['Competitive pricing', 'Good coverage'], weaknesses: ['Inconsistent delivery', 'Limited innovation'] },
    { id: 'VR-004', vendorId: 'V-004', vendorName: 'Nordic Components', overall: 86, delivery: 95, quality: 94, cost: 65, sustainability: 90, innovation: 88, lastReviewed: '2024-06-01', strengths: ['Excellent quality', 'Sustainable practices'], weaknesses: ['Higher costs', 'Long lead times'] },
    { id: 'VR-005', vendorId: 'V-005', vendorName: 'TexSource International', overall: 68, delivery: 72, quality: 75, cost: 85, sustainability: 50, innovation: 60, lastReviewed: '2024-06-25', strengths: ['Cost competitive', 'Good range'], weaknesses: ['Quality issues', 'Poor sustainability'] },
    { id: 'VR-006', vendorId: 'V-006', vendorName: 'EuroChem Supplies', overall: 78, delivery: 80, quality: 85, cost: 78, sustainability: 70, innovation: 75, lastReviewed: '2024-06-18', strengths: ['Good quality', 'Fair pricing'], weaknesses: ['Delivery delays', 'Limited innovation'] },
    { id: 'VR-007', vendorId: 'V-007', vendorName: 'SteelWorks Corp', overall: 76, delivery: 88, quality: 87, cost: 72, sustainability: 65, innovation: 70, lastReviewed: '2024-06-12', strengths: ['Strong quality', 'Reliable'], weaknesses: ['Higher costs', 'Limited sustainability'] },
    { id: 'VR-008', vendorId: 'V-008', vendorName: 'GreenPack Solutions', overall: 85, delivery: 90, quality: 92, cost: 68, sustainability: 95, innovation: 82, lastReviewed: '2024-06-08', strengths: ['Sustainable leader', 'Good quality'], weaknesses: ['Higher costs', 'Limited range'] },
    { id: 'VR-009', vendorId: 'V-009', vendorName: 'TechComponents Inc', overall: 81, delivery: 86, quality: 89, cost: 77, sustainability: 60, innovation: 92, lastReviewed: '2024-06-14', strengths: ['Innovative', 'Good quality'], weaknesses: ['Higher costs', 'Limited sustainability'] },
    { id: 'VR-010', vendorId: 'V-010', vendorName: 'AgriSource Global', overall: 74, delivery: 75, quality: 80, cost: 82, sustainability: 70, innovation: 65, lastReviewed: '2024-06-22', strengths: ['Fair pricing', 'Good quality'], weaknesses: ['Inconsistent delivery', 'Limited innovation'] },
    { id: 'VR-011', vendorId: 'V-011', vendorName: 'MedSupply Pro', overall: 92, delivery: 96, quality: 98, cost: 60, sustainability: 85, innovation: 90, lastReviewed: '2024-06-05', strengths: ['Excellent quality', 'Fast delivery'], weaknesses: ['Very expensive', 'Limited range'] },
    { id: 'VR-012', vendorId: 'V-012', vendorName: 'BuildRight Materials', overall: 68, delivery: 70, quality: 78, cost: 88, sustainability: 55, innovation: 68, lastReviewed: '2024-06-28', strengths: ['Cost competitive', 'Good range'], weaknesses: ['Quality issues', 'Poor sustainability'] },
  ];

  for (const r of ratings) {
    await upsertVendorRating(r);
  }

  // Seed delivery performance
  const perfs: DeliveryPerformance[] = [
    { id: 'dp-PO-2024-001', poId: 'PO-2024-001', vendorId: 'V-001', vendorName: 'Acme Manufacturing', promisedDate: '2024-02-01', actualDate: '2024-02-03', status: 'delayed', delayDays: 2, onTime: false, daysDifference: -2 },
    { id: 'dp-PO-2024-002', poId: 'PO-2024-002', vendorId: 'V-002', vendorName: 'Global Parts Ltd', promisedDate: '2024-02-15', actualDate: '2024-02-14', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    { id: 'dp-PO-2024-003', poId: 'PO-2024-003', vendorId: 'V-003', vendorName: 'Pacific Logistics', promisedDate: '2024-02-10', actualDate: '2024-02-10', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 0 },
    { id: 'dp-PO-2024-004', poId: 'PO-2024-004', vendorId: 'V-004', vendorName: 'Nordic Components', promisedDate: '2024-03-01', actualDate: '2024-03-05', status: 'delayed', delayDays: 4, onTime: false, daysDifference: -4 },
    { id: 'dp-PO-2024-005', poId: 'PO-2024-005', vendorId: 'V-005', vendorName: 'TexSource International', promisedDate: '2024-03-20', actualDate: '2024-03-25', status: 'delayed', delayDays: 5, onTime: false, daysDifference: -5 },
    { id: 'dp-PO-2024-006', poId: 'PO-2024-006', vendorId: 'V-006', vendorName: 'EuroChem Supplies', promisedDate: '2024-04-01', actualDate: '2024-04-02', status: 'delayed', delayDays: 1, onTime: false, daysDifference: -1 },
    { id: 'dp-PO-2024-007', poId: 'PO-2024-007', vendorId: 'V-007', vendorName: 'SteelWorks Corp', promisedDate: '2024-04-20', actualDate: '2024-04-22', status: 'delayed', delayDays: 2, onTime: false, daysDifference: -2 },
    { id: 'dp-PO-2024-008', poId: 'PO-2024-008', vendorId: 'V-008', vendorName: 'GreenPack Solutions', promisedDate: '2024-04-25', actualDate: '2024-04-24', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
    { id: 'dp-PO-2024-009', poId: 'PO-2024-009', vendorId: 'V-009', vendorName: 'TechComponents Inc', promisedDate: '2024-05-15', actualDate: '2024-05-16', status: 'delayed', delayDays: 1, onTime: false, daysDifference: -1 },
    { id: 'dp-PO-2024-010', poId: 'PO-2024-010', vendorId: 'V-010', vendorName: 'AgriSource Global', promisedDate: '2024-06-01', actualDate: '2024-06-02', status: 'delayed', delayDays: 1, onTime: false, daysDifference: -1 },
  ];

  for (const p of perfs) {
    await upsertDeliveryPerformance(p);
  }
}

// ─── Legacy localStorage helpers (no-op, kept for interface compatibility) ───

export function getVendors(): Vendor[] { return []; }
export function getPurchaseOrders(): PurchaseOrder[] { return []; }
export function getVendorRatings(): VendorRating[] { return []; }
export function getDeliveryPerformance(): DeliveryPerformance[] { return []; }
