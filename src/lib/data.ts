// ─── TypeScript Models ───

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
  // Delivery tracking fields
  deliveryStatus?: 'ordered' | 'confirmed' | 'in-transit' | 'delivered' | 'invoiced';
  actualDeliveryDate?: string | null;
  deliveryNotes?: DeliveryNote[];
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

// ─── In-Memory Store (with localStorage fallback) ───

const store = {
  vendors: [] as Vendor[],
  purchaseOrders: [] as PurchaseOrder[],
  vendorRatings: [] as VendorRating[],
  deliveryPerformance: [] as DeliveryPerformance[],
};

function persistToStorage(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

export const getVendors = () => store.vendors;
export const setVendors = (v: Vendor[]) => {
  store.vendors = v;
  persistToStorage('vendors', v);
};

export const getPurchaseOrders = () => store.purchaseOrders;
export const setPurchaseOrders = (po: PurchaseOrder[]) => {
  store.purchaseOrders = po;
  persistToStorage('purchaseOrders', po);
};

export const getVendorRatings = () => store.vendorRatings;
export const setVendorRatings = (vr: VendorRating[]) => {
  store.vendorRatings = vr;
  persistToStorage('vendorRatings', vr);
};

export const getDeliveryPerformance = () => store.deliveryPerformance;
export const setDeliveryPerformance = (dp: DeliveryPerformance[]) => {
  store.deliveryPerformance = dp;
  persistToStorage('deliveryPerformance', dp);
};

export function getVendorById(id: string): Vendor | undefined {
  return getVendors().find(v => v.id === id);
}

export function nextVendorCode(): string {
  const vendors = getVendors();
  const maxNum = vendors.reduce((max, v) => {
    const m = v.vendorCode.match(/VND-(\d+)/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  return `VND-${String(maxNum + 1).padStart(3, '0')}`;
}

export function nextPONumber(): string {
  const pos = getPurchaseOrders();
  const year = new Date().getFullYear();
  const yearPOs = pos.filter(p => p.id.startsWith(`PO-${year}-`));
  const maxNum = yearPOs.reduce((max, po) => {
    const m = po.id.match(/PO-\d{4}-(\d+)/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  return `PO-${year}-${String(maxNum + 1).padStart(3, '0')}`;
}

export function setPurchaseOrderStatus(poId: string, status: PurchaseOrder['status']): void {
  const pos = getPurchaseOrders();
  const idx = pos.findIndex(p => p.id === poId);
  if (idx !== -1) {
    pos[idx] = { ...pos[idx], status };
    setPurchaseOrders(pos);
  }
}

export function getPOsByVendor(vendorId: string): PurchaseOrder[] {
  return getPurchaseOrders().filter(po => po.vendorId === vendorId);
}

export function getVendorRating(vendorId: string): VendorRating | undefined {
  return getVendorRatings().find(vr => vr.vendorId === vendorId);
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

// ─── Seed Data ───

const sampleVendors: Vendor[] = [
  {
    id: 'v1',
    vendorCode: 'VND-001',
    name: 'Apex Materials Inc.',
    category: 'Raw Materials',
    location: 'Houston, TX',
    rating: 4.5,
    status: 'active',
    contractEnd: '2026-12-31',
    email: 'contact@apexmaterials.com',
    spend: 2450000,
    contact: 'James Morgan',
    phone: '+1-713-555-0101',
    paymentTerms: 'Net 30',
    leadTime: 14,
    notes: 'Preferred supplier for steel and aluminum. Consistent quality ratings above 4.5.',
  },
  {
    id: 'v2',
    vendorCode: 'VND-002',
    name: 'NovaTech Components',
    category: 'Electronics',
    location: 'San Jose, CA',
    rating: 4.2,
    status: 'active',
    contractEnd: '2026-09-30',
    email: 'orders@novatech.io',
    spend: 1870000,
    contact: 'Lisa Chen',
    phone: '+1-408-555-0202',
    paymentTerms: 'Net 60',
    leadTime: 21,
    notes: 'Key PCB and semiconductor supplier. Lead times can vary seasonally.',
  },
  {
    id: 'v3',
    vendorCode: 'VND-003',
    name: 'GreenLine Logistics',
    category: 'Logistics',
    location: 'Chicago, IL',
    rating: 3.8,
    status: 'under-review',
    contractEnd: '2026-06-30',
    email: 'ops@greenlinelog.com',
    spend: 960000,
    contact: 'Mark Thompson',
    phone: '+1-312-555-0303',
    paymentTerms: 'Net 30',
    leadTime: 3,
    notes: 'Under review due to recent delivery delays. On-time rate dropped below 70%.',
  },
  {
    id: 'v4',
    vendorCode: 'VND-004',
    name: 'Pinnacle Packaging',
    category: 'Packaging',
    location: 'Atlanta, GA',
    rating: 4.7,
    status: 'active',
    contractEnd: '2027-03-31',
    email: 'sales@pinnaclepkg.com',
    spend: 720000,
    contact: 'Sarah Williams',
    phone: '+1-404-555-0404',
    paymentTerms: 'Net 30',
    leadTime: 7,
    notes: 'Top-rated vendor. Consistently exceeds quality and delivery expectations.',
  },
  {
    id: 'v5',
    vendorCode: 'VND-005',
    name: 'Sterling Fasteners',
    category: 'Raw Materials',
    location: 'Detroit, MI',
    rating: 3.4,
    status: 'inactive',
    contractEnd: '2025-12-31',
    email: 'info@sterlingfast.com',
    spend: 410000,
    contact: 'Robert Kim',
    phone: '+1-313-555-0505',
    paymentTerms: 'Net 90',
    leadTime: 28,
    notes: 'Contract expired. Inactive status. Consider re-evaluation if hardware needs arise.',
  },
];

const samplePOs: PurchaseOrder[] = [
  {
    id: 'PO-1001',
    vendorId: 'v1',
    vendorName: 'Apex Materials Inc.',
    items: [
      { id: 'li1', name: 'Steel Billets Grade A', quantity: 500, unitPrice: 120, total: 60000 },
      { id: 'li2', name: 'Aluminum Sheets 2mm', quantity: 300, unitPrice: 85, total: 25500 },
    ],
    total: 85500,
    status: 'approved',
    createdAt: '2026-05-15',
    deliveryDate: '2026-06-20',
    priority: 'high',
    deliveryStatus: 'confirmed',
    actualDeliveryDate: null,
    deliveryNotes: [],
  },
  {
    id: 'PO-1002',
    vendorId: 'v2',
    vendorName: 'NovaTech Components',
    items: [
      { id: 'li3', name: 'PCB Assembly Board X7', quantity: 200, unitPrice: 340, total: 68000 },
    ],
    total: 68000,
    status: 'shipped',
    createdAt: '2026-05-10',
    deliveryDate: '2026-06-12',
    priority: 'medium',
    deliveryStatus: 'in-transit',
    actualDeliveryDate: null,
    deliveryNotes: [],
  },
  {
    id: 'PO-1003',
    vendorId: 'v3',
    vendorName: 'GreenLine Logistics',
    items: [
      { id: 'li4', name: 'Freight Service - East Coast', quantity: 1, unitPrice: 15000, total: 15000 },
    ],
    total: 15000,
    status: 'pending',
    createdAt: '2026-06-01',
    deliveryDate: '2026-07-01',
    priority: 'low',
    deliveryStatus: 'ordered',
    actualDeliveryDate: null,
    deliveryNotes: [],
  },
  {
    id: 'PO-1004',
    vendorId: 'v4',
    vendorName: 'Pinnacle Packaging',
    items: [
      { id: 'li5', name: 'Corrugated Box L-12', quantity: 5000, unitPrice: 2.4, total: 12000 },
      { id: 'li6', name: 'Shrink Wrap Roll 500m', quantity: 100, unitPrice: 45, total: 4500 },
    ],
    total: 16500,
    status: 'delivered',
    createdAt: '2026-04-20',
    deliveryDate: '2026-05-15',
    priority: 'medium',
    deliveryStatus: 'invoiced',
    actualDeliveryDate: '2026-05-14',
    deliveryNotes: [],
  },
  {
    id: 'PO-1005',
    vendorId: 'v1',
    vendorName: 'Apex Materials Inc.',
    items: [
      { id: 'li7', name: 'Copper Wire 8AWG', quantity: 1000, unitPrice: 12, total: 12000 },
      { id: 'li8', name: 'Titanium Rods 10mm', quantity: 50, unitPrice: 280, total: 14000 },
    ],
    total: 26000,
    status: 'draft',
    createdAt: '2026-06-08',
    deliveryDate: '2026-07-15',
    priority: 'critical',
    deliveryStatus: 'ordered',
    actualDeliveryDate: null,
    deliveryNotes: [],
  },
];

const sampleRatings: VendorRating[] = [
  { vendorId: 'v1', quality: 4.6, delivery: 4.4, cost: 4.3, responsiveness: 4.7, overall: 4.5, trend: 'up' },
  { vendorId: 'v2', quality: 4.3, delivery: 4.0, cost: 4.1, responsiveness: 4.4, overall: 4.2, trend: 'stable' },
  { vendorId: 'v3', quality: 3.6, delivery: 3.5, cost: 4.0, responsiveness: 3.9, overall: 3.8, trend: 'down' },
  { vendorId: 'v4', quality: 4.8, delivery: 4.6, cost: 4.5, responsiveness: 4.8, overall: 4.7, trend: 'up' },
  { vendorId: 'v5', quality: 3.2, delivery: 3.0, cost: 3.8, responsiveness: 3.5, overall: 3.4, trend: 'down' },
];

const sampleDeliveries: DeliveryPerformance[] = [
  { id: 'd1', poId: 'PO-1001', vendorId: 'v1', vendorName: 'Apex Materials Inc.', promisedDate: '2026-06-20', actualDate: null, status: 'in-transit', delayDays: 0, onTime: true, daysDifference: 0 },
  { id: 'd2', poId: 'PO-1002', vendorId: 'v2', vendorName: 'NovaTech Components', promisedDate: '2026-06-12', actualDate: null, status: 'in-transit', delayDays: 0, onTime: true, daysDifference: 0 },
  { id: 'd3', poId: 'PO-1003', vendorId: 'v3', vendorName: 'GreenLine Logistics', promisedDate: '2026-07-01', actualDate: null, status: 'pending', delayDays: 0, onTime: true, daysDifference: 0 },
  { id: 'd4', poId: 'PO-1004', vendorId: 'v4', vendorName: 'Pinnacle Packaging', promisedDate: '2026-05-15', actualDate: '2026-05-14', status: 'on-time', delayDays: 0, onTime: true, daysDifference: 1 },
  { id: 'd5', poId: 'PO-1005', vendorId: 'v1', vendorName: 'Apex Materials Inc.', promisedDate: '2026-07-15', actualDate: null, status: 'pending', delayDays: 0, onTime: true, daysDifference: 0 },
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
  const pos = getPurchaseOrders();
  const ratings = getVendorRatings();
  const vendors = getVendors();
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

// ─── Seed Data ───

export function seedData(): void {
  if (getVendors().length > 0) return;
  setVendors(sampleVendors);
  setPurchaseOrders(samplePOs);
  setVendorRatings(sampleRatings);
  setDeliveryPerformance(sampleDeliveries);
}

// Auto-seed on module load so data is available immediately
seedData();
