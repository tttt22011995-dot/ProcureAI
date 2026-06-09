import { useState, useMemo } from 'react';
import { Truck, Clock, CheckCircle2, AlertTriangle, Search, Calendar } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import '../lib/chartSetup';
import { getDeliveryPerformance, type DeliveryPerformance } from '../lib/data';

const statusIcon: Record<string, React.ElementType> = {
  'on-time': CheckCircle2,
  'delayed': AlertTriangle,
  'in-transit': Truck,
  'pending': Clock,
};

const statusColor: Record<string, string> = {
  'on-time': 'green',
  'delayed': 'red',
  'in-transit': 'cyan',
  'pending': 'orange',
};

export default function Delivery() {
  const [deliveries] = useState<DeliveryPerformance[]>(() => getDeliveryPerformance());
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return deliveries.filter(d =>
      d.vendorName.toLowerCase().includes(search.toLowerCase()) ||
      d.poId.toLowerCase().includes(search.toLowerCase())
    );
  }, [deliveries, search]);

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = { 'on-time': 0, 'delayed': 0, 'in-transit': 0, 'pending': 0 };
    deliveries.forEach(d => { map[d.status] = (map[d.status] || 0) + 1; });
    return map;
  }, [deliveries]);

  const barData = useMemo(() => ({
    labels: ['On-Time', 'Delayed', 'In-Transit', 'Pending'],
    datasets: [{
      label: 'Deliveries',
      data: [statusCounts['on-time'], statusCounts['delayed'], statusCounts['in-transit'], statusCounts['pending']],
      backgroundColor: ['#34D399', '#FB7185', '#22D3EE', '#FB923C'],
      borderRadius: 8,
      borderWidth: 0,
    }],
  }), [statusCounts]);

  const onTimeRate = useMemo(() => {
    const completed = deliveries.filter(d => d.actualDate);
    if (!completed.length) return 94;
    return Math.round((completed.filter(d => d.status === 'on-time').length / completed.length) * 100);
  }, [deliveries]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Delivery Tracking</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Monitor shipment and delivery performance</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: 'On-Time Rate', value: `${onTimeRate}%`, icon: CheckCircle2, color: 'green' },
          { label: 'In Transit', value: statusCounts['in-transit'], icon: Truck, color: 'cyan' },
          { label: 'Delayed', value: statusCounts['delayed'], icon: AlertTriangle, color: 'red' },
          { label: 'Pending', value: statusCounts['pending'], icon: Clock, color: 'orange' },
        ].map(k => (
          <div key={k.label} className={`glass-card kpi-accent-${k.color} p-4 flex items-center gap-4`}>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `var(--${k.color})`, opacity: 0.15, color: `var(--${k.color})` }}
            >
              <k.icon size={18} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>{k.label}</div>
              <div className="text-xl font-bold" style={{ color: 'var(--text)' }}>{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="glass-card-solid p-5" style={{ height: 240 }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Delivery Status Breakdown</h3>
        <div style={{ height: 170 }}>
          <Bar
            data={barData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(6,17,32,0.9)', cornerRadius: 12 } },
              scales: {
                x: { ticks: { color: '#94A3B8' }, grid: { display: false }, border: { display: false } },
                y: { ticks: { color: '#94A3B8', stepSize: 1 }, grid: { color: 'rgba(148,197,255,0.08)' }, border: { display: false } },
              },
            }}
          />
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          className="glass-input w-full pl-9"
          placeholder="Search deliveries..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Delivery Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(d => {
          const Icon = statusIcon[d.status] || Clock;
          return (
            <div key={d.id} className="glass-card p-5 flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `var(--${statusColor[d.status]})`, opacity: 0.15, color: `var(--${statusColor[d.status]})` }}
              >
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold" style={{ color: 'var(--text)' }}>{d.poId}</span>
                  <span className={`glass-badge glass-badge-${statusColor[d.status]}`}>{d.status}</span>
                </div>
                <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{d.vendorName}</div>
                <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1"><Calendar size={12} /> Promised: {d.promisedDate}</span>
                  {d.actualDate && <span>Actual: {d.actualDate}</span>}
                  {d.delayDays > 0 && <span style={{ color: 'var(--red)' }}>{d.delayDays}d delay</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
