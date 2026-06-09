import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  DollarSign,
  Users,
  FileText,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useAnimatedCounter } from '../lib/useAnimatedCounter';
import { getVendors, getPurchaseOrders, getDeliveryPerformance } from '../lib/data';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement,
  PointElement, LineElement, Title, Tooltip, Legend, Filler
);

const chartFont = { family: 'Inter, system-ui, sans-serif' };

function KpiCard({
  icon: Icon,
  label,
  value,
  prefix = '',
  suffix = '',
  accent,
  change,
  changeLabel,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  accent: string;
  change?: number;
  changeLabel?: string;
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
      {change !== undefined && (
        <div className="flex items-center gap-1 text-xs font-medium" style={{ color: change >= 0 ? 'var(--green)' : 'var(--red)' }}>
          {change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(change)}% {changeLabel}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const vendors = getVendors();
  const pos = getPurchaseOrders();
  const deliveries = getDeliveryPerformance();

  const totalSpend = useMemo(() => vendors.reduce((s, v) => s + v.spend, 0), [vendors]);
  const activeVendors = useMemo(() => vendors.filter(v => v.status === 'active').length, [vendors]);
  const openPOs = useMemo(() => pos.filter(p => ['draft', 'pending', 'approved'].includes(p.status)).length, [pos]);
  const onTimeRate = useMemo(() => {
    const completed = deliveries.filter(d => d.actualDate);
    if (completed.length === 0) return 94;
    const onTime = completed.filter(d => d.status === 'on-time').length;
    return Math.round((onTime / completed.length) * 100);
  }, [deliveries]);

  const spendByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    vendors.forEach(v => { map[v.category] = (map[v.category] || 0) + v.spend; });
    return map;
  }, [vendors]);

  const poByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    pos.forEach(p => { map[p.status] = (map[p.status] || 0) + 1; });
    return map;
  }, [pos]);

  const monthlySpend = useMemo(() => ({
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    data: [320000, 410000, 380000, 520000, 470000, 540000],
  }), []);

  const doughnutData = {
    labels: Object.keys(spendByCategory),
    datasets: [{
      data: Object.values(spendByCategory),
      backgroundColor: ['#60A5FA', '#22D3EE', '#34D399', '#FB923C', '#A78BFA'],
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  const barData = {
    labels: Object.keys(poByStatus).map(s => s.charAt(0).toUpperCase() + s.slice(1)),
    datasets: [{
      label: 'Purchase Orders',
      data: Object.values(poByStatus),
      backgroundColor: 'rgba(96,165,250,0.5)',
      borderColor: '#60A5FA',
      borderWidth: 1,
      borderRadius: 8,
    }],
  };

  const lineData = {
    labels: monthlySpend.labels,
    datasets: [{
      label: 'Monthly Spend',
      data: monthlySpend.data,
      borderColor: '#22D3EE',
      backgroundColor: 'rgba(34,211,238,0.08)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#22D3EE',
      pointRadius: 4,
      pointHoverRadius: 6,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false, labels: { font: chartFont } },
      tooltip: { backgroundColor: 'rgba(6,17,32,0.9)', titleFont: chartFont, bodyFont: chartFont, cornerRadius: 12 },
    },
    scales: {
      x: { ticks: { color: '#94A3B8', font: chartFont }, grid: { display: false }, border: { display: false } },
      y: { ticks: { color: '#94A3B8', font: chartFont }, grid: { color: 'rgba(148,197,255,0.08)' }, border: { display: false } },
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Supply chain overview and key metrics</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard icon={DollarSign} label="Total Spend" value={Math.round(totalSpend / 1000)} prefix="$" suffix="K" accent="blue" change={12} changeLabel="vs last quarter" />
        <KpiCard icon={Users} label="Active Vendors" value={activeVendors} suffix={` of ${vendors.length}`} accent="cyan" change={5} changeLabel="vs last month" />
        <KpiCard icon={FileText} label="Open POs" value={openPOs} accent="orange" change={-8} changeLabel="vs last week" />
        <KpiCard icon={TrendingUp} label="On-Time Rate" value={onTimeRate} suffix="%" accent="green" change={3} changeLabel="vs last quarter" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="glass-card-solid p-5 lg:col-span-2" style={{ height: 320 }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>Monthly Spend Trend</h3>
          <div style={{ height: 250 }}>
            <Line data={lineData} options={chartOptions} />
          </div>
        </div>
        <div className="glass-card-solid p-5" style={{ height: 320 }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>Spend by Category</h3>
          <div style={{ height: 250 }}>
            <Doughnut
              data={doughnutData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                  legend: { position: 'bottom' as const, labels: { color: '#CBD5E1', font: chartFont, padding: 12, usePointStyle: true, pointStyleWidth: 8 } },
                  tooltip: { backgroundColor: 'rgba(6,17,32,0.9)', cornerRadius: 12 },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* PO Status Bar */}
      <div className="glass-card-solid p-5" style={{ height: 280 }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>Purchase Orders by Status</h3>
        <div style={{ height: 210 }}>
          <Bar data={barData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
}
