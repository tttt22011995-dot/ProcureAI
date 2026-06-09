import {
  getVendors,
  getPurchaseOrders,
  getVendorRatings,
  getDeliveryPerformance,
  type Vendor,
  type PurchaseOrder,
  type VendorRating,
  type DeliveryPerformance,
} from './data';

// ─── Types ───

export type RiskType =
  | 'overdue-po'
  | 'late-delivery-rate'
  | 'lead-time-above-category'
  | 'low-performance'
  | 'medium-performance'
  | 'low-quality'
  | 'contract-expiring'
  | 'expired-contract-open-po'
  | 'supplier-dependency'
  | 'high-open-po-count'
  | 'stuck-po'
  | 'high-value-po';

export type RiskSeverity = 'low' | 'medium' | 'high';

export interface RiskCategory {
  type: RiskType;
  severity: RiskSeverity;
  scoreImpact: number;
  message: string;
}

export interface SupplierRisk {
  vendorId: string;
  vendorName: string;
  category: string;
  overallRiskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  detectedRisks: RiskCategory[];
  spendExposure: number;
  openPOCount: number;
  lateDeliveryRate: number;
}

export interface RiskDashboardMetrics {
  totalSuppliers: number;
  highRiskSuppliers: number;
  mediumRiskSuppliers: number;
  lowRiskSuppliers: number;
  averageRiskScore: number;
  criticalAlerts: number;
  overduePOs: number;
}

// ─── Helper Functions ───

function daysBetween(date1: Date, date2: Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

function getToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isOverduePO(po: PurchaseOrder): boolean {
  // Not delivered AND expected < today
  if (po.deliveryStatus === 'delivered' || po.deliveryStatus === 'invoiced') return false;
  if (po.status === 'delivered' || po.status === 'cancelled') return false;
  const expected = new Date(po.deliveryDate);
  const today = getToday();
  return expected < today;
}

function isOpenPO(po: PurchaseOrder): boolean {
  const openStatuses = new Set(['ordered', 'confirmed', 'in-transit']);
  return openStatuses.has(po.status) ||
         (po.deliveryStatus !== 'delivered' && po.deliveryStatus !== 'invoiced');
}

function isStuckPO(po: PurchaseOrder): boolean {
  const deliveryStatus = po.deliveryStatus || 'ordered';
  const createdAt = new Date(po.createdAt);
  const daysSinceCreation = daysBetween(createdAt, getToday());

  // Ordered > 14 days
  if (deliveryStatus === 'ordered' && daysSinceCreation > 14) return true;
  // Confirmed > 21 days
  if (deliveryStatus === 'confirmed' && daysSinceCreation > 21) return true;
  return false;
}

function isDelivered(po: PurchaseOrder): boolean {
  return po.deliveryStatus === 'delivered' || po.deliveryStatus === 'invoiced';
}

function isLateDelivery(po: PurchaseOrder): boolean {
  if (!po.actualDeliveryDate) return false;
  const actual = new Date(po.actualDeliveryDate);
  const expected = new Date(po.deliveryDate);
  return actual > expected;
}

// ─── Category Average Lead Time ───

function getCategoryLeadTimeAverages(vendors: Vendor[]): Map<string, number> {
  const categoryLeadTimes = new Map<string, { total: number; count: number }>();

  vendors.forEach(v => {
    if (!categoryLeadTimes.has(v.category)) {
      categoryLeadTimes.set(v.category, { total: 0, count: 0 });
    }
    const entry = categoryLeadTimes.get(v.category)!;
    entry.total += v.leadTime;
    entry.count += 1;
  });

  const averages = new Map<string, number>();
  categoryLeadTimes.forEach((value, category) => {
    averages.set(category, value.count > 0 ? value.total / value.count : 0);
  });

  return averages;
}

// ─── PO Total Percentiles ───

function get95thPercentilePOTotal(pos: PurchaseOrder[]): number {
  if (pos.length === 0) return 0;
  const totals = pos.map(po => po.total).sort((a, b) => a - b);
  const p95Index = Math.ceil(totals.length * 0.95) - 1;
  return totals[p95Index] ?? 0;
}

// ─── Open PO Count for Vendor ───

export function getOpenPOCountForVendor(vendorId: string): number {
  return getPurchaseOrders().filter(po => po.vendorId === vendorId && isOpenPO(po)).length;
}

// ─── Late Delivery Rate Calculator ───

function calculateLateDeliveryRate(vendorId: string, pos: PurchaseOrder[]): number {
  const vendorPOs = pos.filter(po => po.vendorId === vendorId);
  const delivered = vendorPOs.filter(po => isDelivered(po));

  if (delivered.length === 0) return 0;

  const late = delivered.filter(po => isLateDelivery(po));
  return (late.length / delivered.length) * 100;
}

// ─── Risk Detection Logic ───

function detectDeliveryRisks(
  vendor: Vendor,
  vendorPOs: PurchaseOrder[]
): RiskCategory[] {
  const risks: RiskCategory[] = [];

  // 1. Overdue PO (+30, high)
  const overduePOs = vendorPOs.filter(po => isOverduePO(po));
  if (overduePOs.length > 0) {
    risks.push({
      type: 'overdue-po',
      severity: 'high',
      scoreImpact: 30,
      message: `${overduePOs.length} overdue purchase order${overduePOs.length > 1 ? 's' : ''}`,
    });
  }

  // 2. Late delivery rate > 40% (+20, medium)
  const lateDeliveryRate = calculateLateDeliveryRate(vendor.id, vendorPOs);
  if (lateDeliveryRate > 40) {
    risks.push({
      type: 'late-delivery-rate',
      severity: 'medium',
      scoreImpact: 20,
      message: `Late delivery rate is ${lateDeliveryRate.toFixed(0)}% (above 40%)`,
    });
  }

  return risks;
}

function detectLeadTimeRisk(
  vendor: Vendor,
  categoryLeadTimeAverages: Map<string, number>
): RiskCategory | null {
  const categoryAvg = categoryLeadTimeAverages.get(vendor.category) ?? 0;
  const threshold = categoryAvg * 1.2;

  if (vendor.leadTime > threshold && categoryAvg > 0) {
    return {
      type: 'lead-time-above-category',
      severity: 'low',
      scoreImpact: 10,
      message: `Lead time (${vendor.leadTime}d) exceeds category average (${categoryAvg.toFixed(0)}d) by >20%`,
    };
  }
  return null;
}

function detectPerformanceRisks(vendor: Vendor, ratings: VendorRating[]): RiskCategory[] {
  const risks: RiskCategory[] = [];
  const rating = ratings.find(r => r.vendorId === vendor.id);

  if (rating) {
    // Convert 5-point scale to 100-point scale
    const overallScore = rating.overall * 20;
    const qualityScore = rating.quality * 20;

    // Overall < 60 (+25, high)
    if (overallScore < 60) {
      risks.push({
        type: 'low-performance',
        severity: 'high',
        scoreImpact: 25,
        message: `Overall performance score is ${overallScore.toFixed(0)}/100 (below 60)`,
      });
    }
    // Overall 60-75 (+15, medium)
    else if (overallScore < 75) {
      risks.push({
        type: 'medium-performance',
        severity: 'medium',
        scoreImpact: 15,
        message: `Overall performance score is ${overallScore.toFixed(0)}/100 (60-75)`,
      });
    }

    // Quality < 70 (+10)
    if (qualityScore < 70) {
      risks.push({
        type: 'low-quality',
        severity: 'low',
        scoreImpact: 10,
        message: `Quality score is ${qualityScore.toFixed(0)}/100 (below 70)`,
      });
    }
  }

  return risks;
}

function detectContractRisks(vendor: Vendor, vendorPOs: PurchaseOrder[]): RiskCategory[] {
  const risks: RiskCategory[] = [];
  const today = getToday();

  if (vendor.contractEnd) {
    const contractEndDate = new Date(vendor.contractEnd);
    contractEndDate.setHours(0, 0, 0, 0);

    const daysUntilExpiry = daysBetween(today, contractEndDate);

    // Contract expired
    if (contractEndDate < today) {
      const hasOpenPOs = vendorPOs.some(po => isOpenPO(po));
      if (hasOpenPOs) {
        risks.push({
          type: 'expired-contract-open-po',
          severity: 'high',
          scoreImpact: 30,
          message: 'Contract expired with open purchase orders',
        });
      }
    }
    // Contract expiring within 90 days
    else if (daysUntilExpiry <= 90) {
      risks.push({
        type: 'contract-expiring',
        severity: 'medium',
        scoreImpact: 15,
        message: `Contract expires in ${daysUntilExpiry} days`,
      });
    }
  }

  return risks;
}

function detectExposureRisks(
  vendor: Vendor,
  allPos: PurchaseOrder[],
  openPOCount: number
): RiskCategory[] {
  const risks: RiskCategory[] = [];

  // Total spend calculation
  const totalSpend = allPos.reduce((sum, po) => sum + po.total, 0);
  const vendorSpend = allPos
    .filter(po => po.vendorId === vendor.id)
    .reduce((sum, po) => sum + po.total, 0);

  const spendShare = totalSpend > 0 ? (vendorSpend / totalSpend) * 100 : 0;

  // Spend share > 35% (+20, high)
  if (spendShare > 35) {
    risks.push({
      type: 'supplier-dependency',
      severity: 'high',
      scoreImpact: 20,
      message: `Spend share is ${spendShare.toFixed(0)}% (above 35%)`,
    });
  }

  // Open PO count > 5 (+15)
  if (openPOCount > 5) {
    risks.push({
      type: 'high-open-po-count',
      severity: 'medium',
      scoreImpact: 15,
      message: `${openPOCount} open purchase orders`,
    });
  }

  // Stuck POs (+10)
  const stuckPOs = allPos
    .filter(po => po.vendorId === vendor.id)
    .filter(po => isStuckPO(po));

  if (stuckPOs.length > 0) {
    risks.push({
      type: 'stuck-po',
      severity: 'low',
      scoreImpact: 10,
      message: `${stuckPOs.length} stuck purchase order${stuckPOs.length > 1 ? 's' : ''} (ordered >14d or confirmed >21d)`,
    });
  }

  return risks;
}

function detectHighValuePORisks(
  vendorId: string,
  allPos: PurchaseOrder[],
  p95Threshold: number
): RiskCategory[] {
  const risks: RiskCategory[] = [];

  // PO total above 95th percentile (+10, medium)
  const highValuePOs = allPos.filter(
    po => po.vendorId === vendorId && po.total > p95Threshold
  );

  if (highValuePOs.length > 0) {
    risks.push({
      type: 'high-value-po',
      severity: 'medium',
      scoreImpact: 10,
      message: `${highValuePOs.length} high-value PO${highValuePOs.length > 1 ? 's' : ''} (>95th percentile)`,
    });
  }

  return risks;
}

// ─── Main Computation Functions ───

export function getSupplierRisk(vendorId: string): SupplierRisk | null {
  const vendors = getVendors();
  const pos = getPurchaseOrders();
  const ratings = getVendorRatings();

  const vendor = vendors.find(v => v.id === vendorId);
  if (!vendor) return null;

  const vendorPOs = pos.filter(po => po.vendorId === vendorId);
  const openPOCount = getOpenPOCountForVendor(vendorId);
  const categoryLeadTimeAverages = getCategoryLeadTimeAverages(vendors);
  const p95Threshold = get95thPercentilePOTotal(pos);

  const detectedRisks: RiskCategory[] = [];

  // 1. Delivery risks
  detectedRisks.push(...detectDeliveryRisks(vendor, vendorPOs));

  // 2. Lead time risk
  const leadTimeRisk = detectLeadTimeRisk(vendor, categoryLeadTimeAverages);
  if (leadTimeRisk) detectedRisks.push(leadTimeRisk);

  // 3. Performance risks
  detectedRisks.push(...detectPerformanceRisks(vendor, ratings));

  // 4. Contract risks
  detectedRisks.push(...detectContractRisks(vendor, vendorPOs));

  // 5. Exposure risks
  detectedRisks.push(...detectExposureRisks(vendor, pos, openPOCount));

  // 6. High-value PO risks
  detectedRisks.push(...detectHighValuePORisks(vendorId, pos, p95Threshold));

  // Calculate overall risk score (sum of score impacts, clamped 0-100)
  const overallRiskScore = clamp(
    detectedRisks.reduce((sum, r) => sum + r.scoreImpact, 0),
    0,
    100
  );

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high';
  if (overallRiskScore <= 30) {
    riskLevel = 'low';
  } else if (overallRiskScore <= 60) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'high';
  }

  // Spend exposure
  const spendExposure = vendorPOs.reduce((sum, po) => sum + po.total, 0);

  // Late delivery rate
  const lateDeliveryRate = calculateLateDeliveryRate(vendorId, vendorPOs);

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    category: vendor.category,
    overallRiskScore,
    riskLevel,
    detectedRisks,
    spendExposure,
    openPOCount,
    lateDeliveryRate,
  };
}

export function getSupplierRisks(): SupplierRisk[] {
  const vendors = getVendors();

  const risks = vendors
    .map(v => getSupplierRisk(v.id))
    .filter((r): r is SupplierRisk => r !== null);

  // Sort by highest risk first
  return risks.sort((a, b) => b.overallRiskScore - a.overallRiskScore);
}

export function getRiskDashboardMetrics(): RiskDashboardMetrics {
  const vendors = getVendors();
  const pos = getPurchaseOrders();
  const risks = getSupplierRisks();

  const totalSuppliers = risks.length;
  const highRiskSuppliers = risks.filter(r => r.riskLevel === 'high').length;
  const mediumRiskSuppliers = risks.filter(r => r.riskLevel === 'medium').length;
  const lowRiskSuppliers = risks.filter(r => r.riskLevel === 'low').length;

  const averageRiskScore = totalSuppliers > 0
    ? risks.reduce((sum, r) => sum + r.overallRiskScore, 0) / totalSuppliers
    : 0;

  // Critical alerts = high severity risks
  const criticalAlerts = risks.reduce(
    (sum, r) => sum + r.detectedRisks.filter(risk => risk.severity === 'high').length,
    0
  );

  // Overdue POs across all vendors
  const overduePOs = pos.filter(po => isOverduePO(po)).length;

  return {
    totalSuppliers,
    highRiskSuppliers,
    mediumRiskSuppliers,
    lowRiskSuppliers,
    averageRiskScore: Math.round(averageRiskScore * 100) / 100,
    criticalAlerts,
    overduePOs,
  };
}
