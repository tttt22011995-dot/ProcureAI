import { useState, useMemo, useEffect } from 'react';
import {
  Chart as ChartJS,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import {
  Users,
  FileText,
  AlertTriangle,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Inbox,
} from 'lucide-react';
import '../lib/chartSetup';
import { useAnimatedCounter } from '../lib/useAnimatedCounter';
import {
  fetchVendors,
  fetchPurchaseOrders,
  fetchVendorRatings,
  getVendors,
  getPurchaseOrders,
  getVendorRatings,
  isOverdue,
  getEffectivePOStatus,
  poStatusColorMap,
} from '../lib/data';
import type { PurchaseOrder } from '../lib/data';
import { PageErrorBoundary } from '../components/ErrorBoundary';
import { useRefresh } from '../lib/RefreshContext';

const chartFont = { family: 'Inter, system-ui, sans-serif' };

// ─── KPI Card ───

function KpiCard({
  icon: Icon,
  label,
  value,
  prefix = '',
  suffix = '',
  accent,
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  accent: string;
  trend: 'up' | 'down' | 'stable';
}) {
  const animated = useAnimatedCounter(value);

  return (
    <div className={`glass-card kpi-accent-${accent} p-5 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: `var(--${accent})`, opacity: 0.15, color: `var(--${accent})` }}
        >
          <Icon size={16} />
        </div>
      </div>
      <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
        {prefix}{animated.toLocaleString()}{suffix}
      </div>
      <div className="flex items-center gap-1 text-xs font-medium" style={{ color: trend === 'up' ? 'var(--green)' : trend === 'down' ? 'var(--red)' : 'var(--text-muted)' }}>
        {trend === 'up' && <ArrowUpRight size={12} />}
        {trend === 'down' && <ArrowDownRight size={12} />}
        {trend === 'stable' && <Minus size={12} />}
        {trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Stable'}
      </div>
    </div>
  );
}

// ─── Monthly PO Activity Chart ───

type Range = '3M' | '6M' | '12M';

const RANGE_MONTHS: Record<Range, number> = { '3M': 3, '6M': 6, '12M': 12 };

function buildMonthlyData(pos: PurchaseOrder[], range: Range) {
  const now = new Date();
  const months = RANGE_MONTHS[range];

  const buckets: { key: string; label: string; count: number; spend: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    buckets.push({ key, label, count: 0, spend: 0 });
  }

  const availableMonths = buckets.length;
  pos.forEach(po => {
    const poMonth = po.createdAt.slice(0, 7);
    const bucket = buckets.find(b => b.key === poMonth);
    if (bucket) {
      bucket.count += 1;
      bucket.spend += po.total;
    }
  });

  return { buckets, availableMonths, requestedMonths: months };
}

// ─── Fallback Table ───

function FallbackTable({ buckets }: { buckets: { label: string; count: number; spend: number }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="glass-table">
        <thead>
          <tr><th>Month</th><th>PO Count</th><th>Total Spend</th></tr>
        </thead>
        <tbody>
          {buckets.map(b => (
            <tr key={b.label}>
              <td style={{ color: 'var(--text)' }}>{b.label}</td>
              <td>{b.count}</td>
              <td>${b.spend.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Status Badge ───

function StatusBadge({ status }: { status: string }) {
  const color = poStatusColorMap[status] ?? 'blue';
  return <span className={`glass-badge glass-badge-${color}`}>{status}</span>;
}

// ─── Recent PO Row (desktop) ───

function PORow({ po }: { po: PurchaseOrder }) {
  const effectiveStatus = getEffectivePOStatus(po);
  return (
    <tr>
      <td className="font-mono font-medium" style={{ color: 'var(--text)' }}>{po.id}</td>
      <td>{po.vendorName}</td>
      <td>{po.createdAt}</td>
      <td style={{ color: 'var(--text)' }}>${po.total.toLocaleString()}</td>
      <td><StatusBadge status={effectiveStatus} /></td>
    </tr>
  );
}

// ─── Recent PO Card (mobile) ───

function POCard({ po }: { po: PurchaseOrder }) {
  const effectiveStatus = getEffectivePOStatus(po);
  return (
    <div className="glass-card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-mono font-semibold" style={{ color: 'var(--text)' }}>{po.id}</span>
        <StatusBadge status={effectiveStatus} />
      </div>
      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{po.vendorName}</div>
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>{po.createdAt}</span>
        <span className="font-semibold" style={{ color: 'var(--text)' }}>${po.total.toLocaleString()}</span>
      </div>
    </div>
  );
}

// ─── Dashboard ───

export default function Dashboard() {
  const [range, setRange] = useState<Range>('6M');
  const [chartError, setChartError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { refreshKey } = useRefresh();

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      fetchVendors(),
      fetchPurchaseOrders(),
      fetchVendorRatings(),
    ]).finally(() => setIsLoading(false));
  }, [refreshKey]);

  const [vendors, setVendors] = useState([] as ReturnType<typeof getVendors>);
  const [pos, setPos] = useState([] as ReturnType<typeof getPurchaseOrders>);
  const [ratings, setRatings] = useState([] as ReturnType<typeof getVendorRatings>);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([
      fetchVendors(),
      fetchPurchaseOrders(),
      fetchVendorRatings(),
    ]).then(([v, p, r]) => {
      if (cancelled) return;
      setVendors(v);
      setPos(p);
      setRatings(r);
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const totalVendors = vendors.length;
  const openPOs = pos.filter(p => ['draft', 'pending', 'approved'].includes(p.status)).length;
  const overdueCount = pos.filter(p => isOverdue(p)).length;
  const avgScore = useMemo(() => {
    if (!ratings.length) return 0;
    return Math.round((ratings.reduce((s, r) => s + r.overall, 0) / ratings.length) * 20);
  }, [ratings]);

  const vendorTrend: 'up' | 'down' | 'stable' = useMemo(() => {
    const trends = ratings.map(r => r.trend);
    const ups = trends.filter(t => t === 'up').length;
    const downs = trends.filter(t => t === 'down').length;
    if (ups > downs) return 'up';
    if (downs > ups) return 'down';
    return 'stable';
  }, [ratings]);

  const { buckets, availableMonths, requestedMonths } = useMemo(
    () => buildMonthlyData(pos, range),
    [pos, range]
  );

  const showPartialNotice = availableMonths < requestedMonths;

  const chartData: ChartData<'bar' | 'line', number[], string> = useMemo(() => ({
    labels: buckets.map(b => b.label),
    datasets: [
      {
        type: 'bar' as const,
        label: 'PO Count',
        data: buckets.map(b => b.count),
        backgroundColor: 'rgba(96,165,250,0.5)',
        borderColor: '#60A5FA',
        borderWidth: 1,
        borderRadius: 8,
        yAxisID: 'y',
        order: 2,
      },
      {
        type: 'line' as const,
        label: 'Total Spend ($)',
        data: buckets.map(b => b.spend),
        borderColor: '#FB923C',
        backgroundColor: 'rgba(251,146,60,0.08)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#FB923C',
        pointRadius: 4,
        pointHoverRadius: 6,
        yAxisID: 'y1',
        order: 1,
      },
    ],
  }), [buckets]);

  const chartOptions: ChartOptions<'bar' | 'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#94A3B8',
          font: chartFont,
          usePointStyle: true,
          pointStyleWidth: 8,
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(6,17,32,0.92)',
        titleFont: chartFont,
        bodyFont: chartFont,
        cornerRadius: 12,
        padding: 12,
      },
    },
    scales: {
      x: {
        ticks: { color: '#94A3B8', font: chartFont },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        position: 'left',
        ticks: { color: '#94A3B8', font: chartFont, stepSize: 1 },
        grid: { color: 'rgba(148,197,255,0.08)' },
        border: { display: false },
        title: { display: true, text: 'PO Count', color: '#94A3B8', font: chartFont },
      },
      y1: {
        position: 'right',
        ticks: {
          color: '#FB923C',
          font: chartFont,
          callback: (v) => `$${Number(v).toLocaleString()}`,
        },
        grid: { drawOnChartArea: false },
        border: { display: false },
        title: { display: true, text: 'Spend (USD)', color: '#FB923C', font: chartFont },
      },
    },
  }), []);

  const recentPOs = useMemo(
    () => [...pos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10),
    [pos]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Supply chain overview and key metrics</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard icon={Users} label="Total Vendors" value={totalVendors} accent="blue" trend={vendorTrend} />
        <KpiCard icon={FileText} label="Open POs" value={openPOs} accent="green" trend={openPOs > 0 ? 'up' : 'stable'} />
        <KpiCard icon={AlertTriangle} label="Overdue Deliveries" value={overdueCount} accent="red" trend={overdueCount > 0 ? 'down' : 'stable'} />
        <KpiCard icon={BarChart3} label="Avg Vendor Score" value={avgScore} suffix="/100" accent="orange" trend={vendorTrend} />
      </div>

      {/* Monthly PO Activity */}
      <div className="glass-card-solid p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Monthly PO Activity</h3>
          <div className="flex items-center gap-2">
            {(['3M', '6M', '12M'] as Range[]).map(r => (
              <button
                key={r}
                className={`glass-button text-xs ${range === r ? 'glass-button-primary' : ''}`}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        {showPartialNotice && (
          <div className="text-xs mb-3 px-1" style={{ color: 'var(--orange)' }}>
            Showing available data only ({availableMonths} of {requestedMonths} months)
          </div>
        )}
        <div style={{ height: 300 }}>
          {chartError ? (
            <FallbackTable buckets={buckets} />
          ) : (
            <PageErrorBoundary>
              <Chart
                type="bar"
                data={chartData}
                options={chartOptions}
              />
            </PageErrorBoundary>
          )}
        </div>
      </div>

      {/* Recent Purchase Orders */}
      <div className="glass-card-solid p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>Recent Purchase Orders</h3>
        {recentPOs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3" style={{ color: 'var(--text-muted)' }}>
            <Inbox size={32} />
            <span className="text-sm">No purchase orders found</span>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Vendor</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPOs.map(po => <PORow key={po.id} po={po} />)}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-3">
              {recentPOs.map(po => <POCard key={po.id} po={po} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
