// ─── TypeScript Models ───

export interface Vendor {
  id: string;
  name: string;
  category: string;
  location: string;
  rating: number;
  status: 'active' | 'under-review' | 'inactive';
  contractEnd: string;
  email: string;
  spend: number;
}

export interface LineItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
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
}

// ─── localStorage helpers ───

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export const getVendors = () => read<Vendor>('vendors');
export const setVendors = (v: Vendor[]) => write('vendors', v);

export const getPurchaseOrders = () => read<PurchaseOrder>('purchaseOrders');
export const setPurchaseOrders = (po: PurchaseOrder[]) => write('purchaseOrders', po);

export const getVendorRatings = () => read<VendorRating>('vendorRatings');
export const setVendorRatings = (vr: VendorRating[]) => write('vendorRatings', vr);

export const getDeliveryPerformance = () => read<DeliveryPerformance>('deliveryPerformance');
export const setDeliveryPerformance = (dp: DeliveryPerformance[]) => write('deliveryPerformance', dp);

export function getVendorById(id: string): Vendor | undefined {
  return getVendors().find(v => v.id === id);
}

export function getPOsByVendor(vendorId: string): PurchaseOrder[] {
  return getPurchaseOrders().filter(po => po.vendorId === vendorId);
}

export function getVendorRating(vendorId: string): VendorRating | undefined {
  return getVendorRatings().find(vr => vr.vendorId === vendorId);
}

// ─── Seed Data ───

const sampleVendors: Vendor[] = [
  {
    id: 'v1',
    name: 'Apex Materials Inc.',
    category: 'Raw Materials',
    location: 'Houston, TX',
    rating: 4.5,
    status: 'active',
    contractEnd: '2026-12-31',
    email: 'contact@apexmaterials.com',
    spend: 2450000,
  },
  {
    id: 'v2',
    name: 'NovaTech Components',
    category: 'Electronics',
    location: 'San Jose, CA',
    rating: 4.2,
    status: 'active',
    contractEnd: '2026-09-30',
    email: 'orders@novatech.io',
    spend: 1870000,
  },
  {
    id: 'v3',
    name: 'GreenLine Logistics',
    category: 'Logistics',
    location: 'Chicago, IL',
    rating: 3.8,
    status: 'under-review',
    contractEnd: '2026-06-30',
    email: 'ops@greenlinelog.com',
    spend: 960000,
  },
  {
    id: 'v4',
    name: 'Pinnacle Packaging',
    category: 'Packaging',
    location: 'Atlanta, GA',
    rating: 4.7,
    status: 'active',
    contractEnd: '2027-03-31',
    email: 'sales@pinnaclepkg.com',
    spend: 720000,
  },
  {
    id: 'v5',
    name: 'Sterling Fasteners',
    category: 'Hardware',
    location: 'Detroit, MI',
    rating: 3.4,
    status: 'inactive',
    contractEnd: '2025-12-31',
    email: 'info@sterlingfast.com',
    spend: 410000,
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
  { id: 'd1', poId: 'PO-1001', vendorId: 'v1', vendorName: 'Apex Materials Inc.', promisedDate: '2026-06-20', actualDate: null, status: 'in-transit', delayDays: 0 },
  { id: 'd2', poId: 'PO-1002', vendorId: 'v2', vendorName: 'NovaTech Components', promisedDate: '2026-06-12', actualDate: null, status: 'in-transit', delayDays: 0 },
  { id: 'd3', poId: 'PO-1003', vendorId: 'v3', vendorName: 'GreenLine Logistics', promisedDate: '2026-07-01', actualDate: null, status: 'pending', delayDays: 0 },
  { id: 'd4', poId: 'PO-1004', vendorId: 'v4', vendorName: 'Pinnacle Packaging', promisedDate: '2026-05-15', actualDate: '2026-05-14', status: 'on-time', delayDays: 0 },
  { id: 'd5', poId: 'PO-1005', vendorId: 'v1', vendorName: 'Apex Materials Inc.', promisedDate: '2026-07-15', actualDate: null, status: 'pending', delayDays: 0 },
];

export function seedData(): void {
  if (getVendors().length > 0) return;
  setVendors(sampleVendors);
  setPurchaseOrders(samplePOs);
  setVendorRatings(sampleRatings);
  setDeliveryPerformance(sampleDeliveries);
}
