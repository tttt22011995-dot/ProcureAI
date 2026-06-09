import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Star, TrendingUp, TrendingDown, Minus, Award, AlertTriangle, Clock,
  Truck, Package, DollarSign, Users, BarChart3, X, CheckCircle2,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import '../lib/chartSetup';
import {
  getVendors,
  getPurchaseOrders,
  getVendorRatings,
  getDeliveryPerformance,
  fetchVendors,
  fetchPurchaseOrders,
  fetchVendorRatings,
  fetchDeliveryPerformance,
  type Vendor,
  type PurchaseOrder,
  type VendorRating,
  type DeliveryPerformance,
} from '../lib/data';
import { useRefresh } from '../lib/RefreshContext';

// ─── Types ───

interface VendorMetrics {
  vendorId: string;
  vendorName: string;
  vendor: Vendor | undefined;
  rating: VendorRating | undefined;
  totalOrders: number;
  totalSpend: number;
  deliveredOrders: number;
  lateOrders: number;
  onTimeOrders: number;
  currentOverdueOrders: number;
  onTimeRate: number;
  avgLeadTime: number;
  declaredLeadTime: number;
  avgRating: number;
  trend: 'up' | 'down' | 'stable';
  classification: 'Preferred' | 'Reliable' | 'Standard' | 'Monitor';
}

interface PerformanceAlert {
  id: string;
  vendorId: string;
  vendorName: string;
  type: 'overdue' | 'lead-time' | 'on-time-rate';
  message: string;
  severity: 'high' | 'medium';
}

// ─── Helper Functions ───

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100) / 100;
}

function daysBetween(date1: Date, date2: Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

function isDelivered(po: PurchaseOrder): boolean {
  return po.deliveryStatus === 'delivered' || po.deliveryStatus === 'invoiced';
}

function isLate(po: PurchaseOrder): boolean {
  if (!po.actualDeliveryDate) return false;
  const actual = new Date(po.actualDeliveryDate);
  const expected = new Date(po.deliveryDate);
  return actual > expected;
}

function isCurrentlyOverdue(po: PurchaseOrder): boolean {
  if (isDelivered(po)) return false;
  const expected = new Date(po.deliveryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expected.setHours(0, 0, 0, 0);
  return expected < today;
}

function getClassification(onTimeRate: number, avgRating: number): 'Preferred' | 'Reliable' | 'Standard' | 'Monitor' {
  const score = (onTimeRate + avgRating) / 2;
  if (score >= 95) return 'Preferred';
  if (score >= 85) return 'Reliable';
  if (score >= 70) return 'Standard';
  return 'Monitor';
}

function getClassificationColor(classification: string): string {
  switch (classification) {
    case 'Preferred': return 'green';
    case 'Reliable': return 'blue';
    case 'Standard': return 'orange';
    case 'Monitor': return 'red';
    default: return 'grey';
  }
}

function getStatusFromRate(onTimeRate: number): 'Excellent' | 'Good' | 'Acceptable' | 'Needs Attention' {
  if (onTimeRate >= 95) return 'Excellent';
  if (onTimeRate >= 85) return 'Good';
  if (onTimeRate >= 70) return 'Acceptable';
  return 'Needs Attention';
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'Excellent': return 'green';
    case 'Good': return 'blue';
    case 'Acceptable': return 'orange';
    case 'Needs Attention': return 'red';
    default: return 'grey';
  }
}

// ─── Main Component ───

export default function Scorecard() {
  const { refreshKey } = useRefresh();
  const [isLoading, setIsLoading] = useState(false);

  const [vendors, setVendors] = useState([] as ReturnType<typeof getVendors>);
  const [pos, setPos] = useState([] as ReturnType<typeof getPurchaseOrders>);
  const [ratings, setRatings] = useState([] as ReturnType<typeof getVendorRatings>);
  const [deliveryPerf, setDeliveryPerf] = useState([] as ReturnType<typeof getDeliveryPerformance>);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([
      fetchVendors(),
      fetchPurchaseOrders(),
      fetchVendorRatings(),
      fetchDeliveryPerformance(),
    ]).then(([v, p, r, d]) => {
      if (cancelled) return;
      setVendors(v);
      setPos(p);
      setRatings(r);
      setDeliveryPerf(d);
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  // ─── Compute Vendor Metrics ───

  const vendorMetrics = useMemo<VendorMetrics[]>(() => {
    return vendors.map(vendor => {
      const vendorPOs = pos.filter(po => po.vendorId === vendor.id);
      const vendorRatings = ratings.find(r => r.vendorId === vendor.id);
      const vendorDelPerf = deliveryPerf.filter(dp => dp.vendorId === vendor.id);

      const totalOrders = vendorPOs.length;
      const totalSpend = vendorPOs.reduce((sum, po) => sum + po.total, 0);

      const deliveredOrders = vendorPOs.filter(po => isDelivered(po)).length;
      const lateOrders = vendorPOs.filter(po => isDelivered(po) && isLate(po)).length;
      const onTimeOrders = vendorPOs.filter(po => isDelivered(po) && !isLate(po)).length;
      const currentOverdueOrders = vendorPOs.filter(po => isCurrentlyOverdue(po)).length;

      // On-Time Rate = onTimeOrders / (deliveredOrders + currentOverdueOrders) × 100
      const denominator = deliveredOrders + currentOverdueOrders;
      const onTimeRate = denominator > 0 ? safeDivide(onTimeOrders, denominator) * 100 : 0;

      // Average lead time from actual deliveries
      const deliveredPOs = vendorPOs.filter(po => isDelivered(po) && po.actualDeliveryDate);
      let avgLeadTime = vendor.leadTime; // Default to declared
      if (deliveredPOs.length > 0) {
        const totalLeadDays = deliveredPOs.reduce((sum, po) => {
          const created = new Date(po.createdAt);
          const delivered = new Date(po.actualDeliveryDate!);
          return sum + daysBetween(created, delivered);
        }, 0);
        avgLeadTime = Math.round(totalLeadDays / deliveredPOs.length);
      }

      const avgRating = vendorRatings ? vendorRatings.overall : 0; // already 0-100
      // Derive trend from onTimeRate and rating
      const trend: 'up' | 'down' | 'stable' = (() => {
        const score = (onTimeRate + (vendorRatings?.overall ?? 0)) / 2;
        if (score >= 80) return 'up';
        if (score < 60) return 'down';
        return 'stable';
      })();
      const classification = getClassification(onTimeRate, avgRating);

      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        vendor,
        rating: vendorRatings,
        totalOrders,
        totalSpend,
        deliveredOrders,
        lateOrders,
        onTimeOrders,
        currentOverdueOrders,
        onTimeRate,
        avgLeadTime,
        declaredLeadTime: vendor.leadTime,
        avgRating,
        trend,
        classification,
      };
    });
  }, [vendors, pos, ratings, deliveryPerf]);

  // ─── KPI Values ───

  const kpis = useMemo(() => {
    const totalVendors = vendors.length;
    const totalSpend = pos.reduce((sum, po) => sum + po.total, 0);
    const totalPOs = pos.length;
    const totalOverdue = pos.filter(po => isCurrentlyOverdue(po)).length;

    // Average on-time delivery rate
    const vendorsWithData = vendorMetrics.filter(vm => vm.deliveredOrders > 0);
    const avgOnTimeRate = vendorsWithData.length > 0
      ? vendorsWithData.reduce((sum, vm) => sum + vm.onTimeRate, 0) / vendorsWithData.length
      : 0;

    // Average vendor rating (0-100 scale)
    const avgVendorRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.overall, 0) / ratings.length
      : 0;

    return {
      totalVendors,
      totalSpend,
      avgOnTimeRate,
      totalOverdue,
      avgVendorRating,
      totalPOs,
    };
  }, [vendors, pos, ratings, vendorMetrics]);

  // ─── Performance Alerts ───

  const alerts = useMemo<PerformanceAlert[]>(() => {
    const result: PerformanceAlert[] = [];

    vendorMetrics.forEach(vm => {
      // Current overdue orders
      if (vm.currentOverdueOrders > 0) {
        result.push({
          id: `overdue-${vm.vendorId}`,
          vendorId: vm.vendorId,
          vendorName: vm.vendorName,
          type: 'overdue',
          message: `${vm.vendorName} has ${vm.currentOverdueOrders} overdue order${vm.currentOverdueOrders > 1 ? 's' : ''}`,
          severity: 'high',
        });
      }

      // Lead time exceeds declared by >25%
      if (vm.deliveredOrders > 0 && vm.avgLeadTime > vm.declaredLeadTime * 1.25) {
        result.push({
          id: `leadtime-${vm.vendorId}`,
          vendorId: vm.vendorId,
          vendorName: vm.vendorName,
          type: 'lead-time',
          message: `${vm.vendorName} avg lead time (${vm.avgLeadTime}d) exceeds declared (${vm.declaredLeadTime}d) by >25%`,
          severity: 'medium',
        });
      }

      // On-time rate < 80%
      if (vm.deliveredOrders > 0 && vm.onTimeRate < 80) {
        result.push({
          id: `onTimeRate-${vm.vendorId}`,
          vendorId: vm.vendorId,
          vendorName: vm.vendorName,
          type: 'on-time-rate',
          message: `${vm.vendorName} on-time rate is ${vm.onTimeRate.toFixed(0)}% (below 80%)`,
          severity: 'high',
        });
      }
    });

    return result;
  }, [vendorMetrics]);

  // ─── Sorted Leaderboard ───

  const sortedLeaderboard = useMemo(() => {
    return [...vendorMetrics]
      .sort((a, b) => {
        // Sort by on-time rate, then by avg rating
        if (b.onTimeRate !== a.onTimeRate) return b.onTimeRate - a.onTimeRate;
        return b.avgRating - a.avgRating;
      });
  }, [vendorMetrics]);

  // ─── Selected Vendor for Drawer ───

  const selectedVendorMetrics = useMemo(() => {
    if (!selectedVendorId) return null;
    return vendorMetrics.find(vm => vm.vendorId === selectedVendorId);
  }, [selectedVendorId, vendorMetrics]);

  // ─── Overall Averages for Benchmark ───

  const overallAverages = useMemo(() => {
    const vendorsWithData = vendorMetrics.filter(vm => vm.deliveredOrders > 0);
    return {
      onTimeRate: vendorsWithData.length > 0
        ? vendorsWithData.reduce((sum, vm) => sum + vm.onTimeRate, 0) / vendorsWithData.length
        : 0,
      avgRating: ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.overall, 0) / ratings.length
        : 0,
      avgLeadTime: vendorsWithData.length > 0
        ? vendorsWithData.reduce((sum, vm) => sum + vm.avgLeadTime, 0) / vendorsWithData.length
        : 0,
    };
  }, [vendorMetrics, ratings]);

  // ─── Chart: Top Vendor Performance ───

  const topVendorChartData = useMemo(() => {
    const top10 = [...vendorMetrics]
      .filter(vm => vm.deliveredOrders > 0)
      .sort((a, b) => b.onTimeRate - a.onTimeRate)
      .slice(0, 10);

    return {
      labels: top10.map(vm => vm.vendorName.split(' ')[0]),
      datasets: [{
        label: 'On-Time Rate %',
        data: top10.map(vm => vm.onTimeRate),
        backgroundColor: top10.map(vm => {
          const color = getClassificationColor(vm.classification);
          return color === 'green' ? 'rgba(52,211,153,0.6)' :
                 color === 'blue' ? 'rgba(96,165,250,0.6)' :
                 color === 'orange' ? 'rgba(251,146,60,0.6)' :
                 'rgba(251,113,133,0.6)';
        }),
        borderRadius: 8,
        borderWidth: 0,
      }],
    };
  }, [vendorMetrics]);

  // ─── Chart: Delivery Reliability ───

  const deliveryReliabilityData = useMemo(() => {
    const totalOnTime = vendorMetrics.reduce((sum, vm) => sum + vm.onTimeOrders, 0);
    const totalLate = vendorMetrics.reduce((sum, vm) => sum + vm.lateOrders, 0);
    const totalOverdue = vendorMetrics.reduce((sum, vm) => sum + vm.currentOverdueOrders, 0);

    return {
      labels: ['On-Time', 'Late', 'Currently Overdue'],
      datasets: [{
        data: [totalOnTime, totalLate, totalOverdue],
        backgroundColor: ['rgba(52,211,153,0.7)', 'rgba(251,146,60,0.7)', 'rgba(251,113,133,0.7)'],
        borderWidth: 0,
        hoverOffset: 8,
      }],
    };
  }, [vendorMetrics]);

  // ─── Performance History Chart (for drawer) ───

  const performanceHistoryData = useMemo(() => {
    if (!selectedVendorMetrics?.rating) return null;

    // Simulate historical data based on current rating
    const rating = selectedVendorMetrics.rating;
    const base = [rating.quality, rating.delivery, rating.responsiveness];

    return {
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      datasets: [
        {
          label: 'Quality',
          data: [base[0] - 3, base[0] - 1, base[0], base[0] + 1].map(v => Math.min(100, Math.max(0, v))),
          borderColor: '#60A5FA',
          backgroundColor: 'rgba(96,165,250,0.1)',
          tension: 0.4,
          fill: false,
        },
        {
          label: 'Delivery',
          data: [base[1] - 2, base[1] + 1, base[1] - 1, base[1]].map(v => Math.min(100, Math.max(0, v))),
          borderColor: '#34D399',
          backgroundColor: 'rgba(52,211,153,0.1)',
          tension: 0.4,
          fill: false,
        },
        {
          label: 'Responsiveness',
          data: [base[2], base[2] - 2, base[2] + 2, base[2] + 1].map(v => Math.min(100, Math.max(0, v))),
          borderColor: '#FB923C',
          backgroundColor: 'rgba(251,146,60,0.1)',
          tension: 0.4,
          fill: false,
        },
      ],
    };
  }, [selectedVendorMetrics]);

  // ─── Handlers ───

  const handleVendorClick = useCallback((vendorId: string) => {
    setSelectedVendorId(vendorId);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setTimeout(() => setSelectedVendorId(null), 300);
  }, []);

  // ─── Render ───

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-2 border-transparent border-t-[var(--blue)] rounded-full mx-auto" />
          <p style={{ color: 'var(--text-muted)' }}>Loading performance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Vendor Performance Scorecard</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Comprehensive supplier performance analysis and benchmarking</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          icon={Users}
          label="Total Vendors"
          value={kpis.totalVendors}
          color="blue"
        />
        <KpiCard
          icon={DollarSign}
          label="Total Spend"
          value={`$${(kpis.totalSpend / 1000000).toFixed(1)}M`}
          color="green"
        />
        <KpiCard
          icon={Truck}
          label="Avg On-Time"
          value={`${kpis.avgOnTimeRate.toFixed(0)}%`}
          color="cyan"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Overdue Orders"
          value={kpis.totalOverdue}
          color="red"
        />
        <KpiCard
          icon={Star}
          label="Avg Rating"
          value={`${kpis.avgVendorRating.toFixed(0)}/100`}
          color="orange"
        />
        <KpiCard
          icon={BarChart3}
          label="Total POs"
          value={kpis.totalPOs}
          color="purple"
        />
      </div>

      {/* Performance Alerts */}
      {alerts.length > 0 && (
        <div className="glass-card-solid p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--orange)' }}>
            <AlertTriangle size={16} /> Performance Alerts ({alerts.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(showAllAlerts ? alerts : alerts.slice(0, 4)).map(alert => (
              <div
                key={alert.id}
                className={`glass-card p-3 flex items-start gap-3 cursor-pointer hover:border-[var(--${alert.severity === 'high' ? 'red' : 'orange'})]`}
                onClick={() => handleVendorClick(alert.vendorId)}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: alert.type === 'overdue' ? 'rgba(251,113,133,0.15)' :
                               alert.type === 'lead-time' ? 'rgba(251,146,60,0.15)' :
                               'rgba(167,139,250,0.15)',
                    color: alert.type === 'overdue' ? 'var(--red)' :
                           alert.type === 'lead-time' ? 'var(--orange)' :
                           'var(--purple)',
                  }}
                >
                  {alert.type === 'overdue' ? <Clock size={14} /> :
                   alert.type === 'lead-time' ? <Truck size={14} /> :
                   <AlertTriangle size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{alert.vendorName}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{alert.message}</div>
                </div>
              </div>
            ))}
          </div>
          {alerts.length > 4 && (
            <button
              className="mt-3 w-full text-xs font-medium py-2 rounded-xl transition-colors"
              style={{
                color: 'var(--primary)',
                background: 'rgba(96,165,250,0.08)',
                border: '1px solid rgba(96,165,250,0.2)',
              }}
              onClick={() => setShowAllAlerts(v => !v)}
            >
              {showAllAlerts ? `Show less ↑` : `See ${alerts.length - 4} more alerts ↓`}
            </button>
          )}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Vendor Performance */}
        <div className="glass-card-solid p-5" style={{ height: 320 }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Top Vendor Performance (On-Time %)</h3>
          <div style={{ height: 240 }}>
            <Bar
              data={topVendorChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { backgroundColor: 'rgba(6,17,32,0.9)', cornerRadius: 12 },
                },
                scales: {
                  x: { ticks: { color: '#94A3B8' }, grid: { display: false } },
                  y: {
                    ticks: { color: '#94A3B8', callback: v => `${v}%` },
                    grid: { color: 'rgba(148,197,255,0.08)' },
                    max: 100,
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Delivery Reliability */}
        <div className="glass-card-solid p-5" style={{ height: 320 }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Delivery Reliability</h3>
          <div style={{ height: 240 }}>
            <Doughnut
              data={deliveryReliabilityData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: { color: '#CBD5E1', padding: 16, usePointStyle: true, pointStyleWidth: 8 },
                  },
                  tooltip: { backgroundColor: 'rgba(6,17,32,0.9)', cornerRadius: 12 },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="glass-card-solid p-5 overflow-hidden">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <Award size={16} style={{ color: 'var(--blue)' }} /> Vendor Performance Leaderboard
        </h3>
        <div className="overflow-x-auto">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Vendor</th>
                <th>Total Orders</th>
                <th>Total Spend</th>
                <th>On-Time %</th>
                <th>Avg Lead Time</th>
                <th>Avg Rating</th>
                <th>Status</th>
                <th>Trend</th>
                <th>Classification</th>
              </tr>
            </thead>
            <tbody>
              {sortedLeaderboard.map((vm, idx) => (
                <tr
                  key={vm.vendorId}
                  className="cursor-pointer"
                  onClick={() => handleVendorClick(vm.vendorId)}
                >
                  <td className="font-bold" style={{ color: idx < 3 ? 'var(--blue)' : 'var(--text)' }}>
                    #{idx + 1}
                  </td>
                  <td className="font-medium" style={{ color: 'var(--text)' }}>
                    {vm.vendorName}
                    {vm.vendor?.status === 'inactive' && (
                      <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>(inactive)</span>
                    )}
                  </td>
                  <td>{vm.totalOrders}</td>
                  <td>${vm.totalSpend.toLocaleString()}</td>
                  <td>
                    <span style={{ color: vm.onTimeRate >= 80 ? 'var(--green)' : 'var(--red)' }}>
                      {vm.deliveredOrders > 0 ? `${vm.onTimeRate.toFixed(0)}%` : 'N/A'}
                    </span>
                  </td>
                  <td>{vm.totalOrders > 0 ? `${vm.avgLeadTime}d` : 'N/A'}</td>
                  <td>
                    <span className="flex items-center gap-1">
                      <Star size={10} style={{ color: 'var(--orange)' }} fill="var(--orange)" />
                      {vm.avgRating.toFixed(0)}/100
                    </span>
                  </td>
                  <td>
                    <span className={`glass-badge glass-badge-${getStatusColor(getStatusFromRate(vm.onTimeRate))}`}>
                      {getStatusFromRate(vm.onTimeRate)}
                    </span>
                  </td>
                  <td>{renderTrendIcon(vm.trend)}</td>
                  <td>
                    <span className={`glass-badge glass-badge-${getClassificationColor(vm.classification)}`}>
                      {vm.classification}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedVendorMetrics && (
        <>
          {/* Backdrop */}
          {drawerOpen && (
            <div
              className="fixed inset-0 z-20"
              style={{ background: 'rgba(0,0,0,0.3)' }}
              onClick={closeDrawer}
            />
          )}

          {/* Drawer */}
          <div
            className="fixed top-0 right-0 bottom-0 w-[420px] glass-panel z-30 overflow-y-auto transition-transform"
            style={{
              borderRadius: '28px 0 0 28px',
              transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
              transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)',
              transitionDuration: '300ms',
            }}
          >
            <DrawerContent
              metrics={selectedVendorMetrics}
              overallAverages={overallAverages}
              performanceHistory={performanceHistoryData}
              onClose={closeDrawer}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-Components ───

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className={`glass-card kpi-accent-${color} p-4 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `var(--${color})`, opacity: 0.15, color: `var(--${color})` }}
        >
          <Icon size={14} />
        </div>
      </div>
      <div className="text-lg font-bold" style={{ color: 'var(--text)' }}>
        {value}
      </div>
    </div>
  );
}

function renderTrendIcon(trend: string) {
  if (trend === 'up') return <ArrowUpRight size={14} style={{ color: 'var(--green)' }} />;
  if (trend === 'down') return <ArrowDownRight size={14} style={{ color: 'var(--red)' }} />;
  return <Minus size={14} style={{ color: 'var(--text-muted)' }} />;
}

function DrawerContent({
  metrics,
  overallAverages,
  performanceHistory,
  onClose,
}: {
  metrics: VendorMetrics;
  overallAverages: { onTimeRate: number; avgRating: number; avgLeadTime: number };
  performanceHistory: any;
  onClose: () => void;
}) {
  const vendor = metrics.vendor;
  const rating = metrics.rating;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{metrics.vendorName}</h2>
          {vendor && (
            <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {vendor.category} • {vendor.location}
            </div>
          )}
        </div>
        <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
          <X size={18} />
        </button>
      </div>

      {/* Classification & Trend */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`glass-badge glass-badge-${getClassificationColor(metrics.classification)}`}>
          {metrics.classification}
        </span>
        {renderTrendIcon(metrics.trend)}
        <span className="text-xs" style={{ color: metrics.trend === 'up' ? 'var(--green)' : metrics.trend === 'down' ? 'var(--red)' : 'var(--text-muted)' }}>
          {metrics.trend === 'up' ? 'Improving' : metrics.trend === 'down' ? 'Declining' : 'Stable'}
        </span>
      </div>

      {/* Vendor Overview */}
      {vendor && (
        <div className="glass-card p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Contact</span>
            <span style={{ color: 'var(--text)' }}>{vendor.contact}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Email</span>
            <span style={{ color: 'var(--text)' }}>{vendor.email}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Declared Lead Time</span>
            <span style={{ color: 'var(--text)' }}>{vendor.leadTime} days</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Status</span>
            <span className={`glass-badge glass-badge-${vendor.status === 'active' ? 'green' : vendor.status === 'under-review' ? 'orange' : 'red'}`}>
              {vendor.status.replace('-', ' ')}
            </span>
          </div>
        </div>
      )}

      {/* Operational Metrics */}
      <div>
        <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Operational Metrics</h4>
        <div className="glass-card p-4">
          <div className="grid grid-cols-2 gap-3">
            <MetricTile label="Total Orders" value={metrics.totalOrders} />
            <MetricTile label="Delivered" value={metrics.deliveredOrders} />
            <MetricTile label="Late Deliveries" value={metrics.lateOrders} color={metrics.lateOrders > 0 ? 'red' : undefined} />
            <MetricTile label="Currently Overdue" value={metrics.currentOverdueOrders} color={metrics.currentOverdueOrders > 0 ? 'red' : undefined} />
            <MetricTile label="Avg Lead Time" value={`${metrics.avgLeadTime}d`} />
            <MetricTile
              label="On-Time Rate"
              value={metrics.deliveredOrders > 0 ? `${metrics.onTimeRate.toFixed(0)}%` : 'N/A'}
              color={metrics.onTimeRate >= 80 ? 'green' : 'red'}
            />
            <MetricTile label="Total Spend" value={`$${metrics.totalSpend.toLocaleString()}`} color="blue" />
          </div>
        </div>
      </div>

      {/* Ratings Summary */}
      {rating && (
        <div>
          <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Ratings Summary</h4>
          <div className="glass-card p-4 grid grid-cols-2 gap-3">
            <RatingBar label="Quality" value={rating.quality} max={100} />
            <RatingBar label="Delivery" value={rating.delivery} max={100} />
            <RatingBar label="Cost" value={rating.cost} max={100} />
            <RatingBar label="Responsiveness" value={rating.responsiveness ?? rating.overall} max={100} />
          </div>
        </div>
      )}

      {/* Performance History Chart */}
      {performanceHistory && (
        <div className="glass-card-solid p-4">
          <h4 className="text-xs font-semibold uppercase mb-3" style={{ color: 'var(--text-muted)' }}>Performance History</h4>
          <div style={{ height: 180 }}>
            <Line
              data={performanceHistory}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: { color: '#94A3B8', padding: 10, usePointStyle: true, pointStyleWidth: 6 },
                  },
                  tooltip: { backgroundColor: 'rgba(6,17,32,0.9)', cornerRadius: 12 },
                },
                scales: {
                  x: { ticks: { color: '#94A3B8' }, grid: { display: false } },
                  y: {
                    ticks: { color: '#94A3B8', stepSize: 20 },
                    grid: { color: 'rgba(148,197,255,0.08)' },
                    min: 0,
                    max: 100,
                  },
                },
              }}
            />
          </div>
        </div>
      )}

      {/* Benchmark Comparison */}
      <div className="glass-card p-4">
        <h4 className="text-xs font-semibold uppercase mb-3" style={{ color: 'var(--text-muted)' }}>Benchmark vs Supplier Average</h4>
        <div className="space-y-3">
          <BenchmarkBar
            label="On-Time Rate"
            vendorValue={metrics.onTimeRate}
            avgValue={overallAverages.onTimeRate}
            max={100}
            suffix="%"
          />
          <BenchmarkBar
            label="Avg Rating"
            vendorValue={metrics.avgRating}
            avgValue={overallAverages.avgRating}
            max={100}
            suffix=""
          />
          <BenchmarkBar
            label="Lead Time"
            vendorValue={metrics.avgLeadTime}
            avgValue={overallAverages.avgLeadTime}
            max={Math.max(metrics.avgLeadTime, overallAverages.avgLeadTime) * 1.2}
            suffix="d"
            inverse
          />
        </div>
      </div>
    </div>
  );
}

function MetricTile({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm font-bold" style={{ color: color ? `var(--${color})` : 'var(--text)' }}>{value}</span>
    </div>
  );
}

function RatingBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className="text-xs font-semibold" style={{ color: 'var(--blue)' }}>{value.toFixed(1)}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-strong)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${(value / max) * 100}%`, background: 'var(--blue)', transition: 'width 0.3s' }}
        />
      </div>
    </div>
  );
}

function BenchmarkBar({
  label,
  vendorValue,
  avgValue,
  max,
  suffix,
  inverse = false,
}: {
  label: string;
  vendorValue: number;
  avgValue: number;
  max: number;
  suffix: string;
  inverse?: boolean;
}) {
  const vendorPercent = safeDivide(vendorValue, max) * 100;
  const avgPercent = safeDivide(avgValue, max) * 100;
  const isBetter = inverse ? vendorValue < avgValue : vendorValue > avgValue;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className="text-xs" style={{ color: isBetter ? 'var(--green)' : 'var(--red)' }}>
          {vendorValue.toFixed(suffix === '%' ? 0 : 0)}{suffix} vs {avgValue.toFixed(suffix === '%' ? 0 : 0)}{suffix} avg
        </span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-strong)' }}>
        <div
          className="absolute left-0 top-0 bottom-0 rounded-full"
          style={{ width: `${vendorPercent}%`, background: isBetter ? 'var(--green)' : 'var(--blue)', opacity: 0.5 }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5"
          style={{ left: `${avgPercent}%`, background: 'var(--text-muted)' }}
        />
      </div>
      <div className="flex justify-between text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
        <span>Vendor</span>
        <span>Average</span>
      </div>
    </div>
  );
}
