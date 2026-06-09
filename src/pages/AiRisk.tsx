import { useState, useMemo } from 'react';
import {
  ShieldAlert, AlertTriangle, AlertCircle, Info,
  TrendingDown, Clock, DollarSign, Users,
} from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { getVendors, getPurchaseOrders, getVendorRatings, getDeliveryPerformance } from '../lib/data';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

interface RiskAlert {
  id: string;
  vendorId: string;
  vendorName: string;
  type: 'delivery' | 'financial' | 'quality' | 'compliance';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  confidence: number;
}

const severityColor: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'purple',
  low: 'cyan',
};

const typeIcon: Record<string, React.ElementType> = {
  delivery: Clock,
  financial: DollarSign,
  quality: AlertTriangle,
  compliance: ShieldAlert,
};

export default function AiRisk() {
  const vendors = getVendors();
  const pos = getPurchaseOrders();
  const ratings = getVendorRatings();
  const deliveries = getDeliveryPerformance();

  const alerts = useMemo<RiskAlert[]>(() => {
    const result: RiskAlert[] = [];
    const v3 = vendors.find(v => v.id === 'v3');
    if (v3) {
      result.push({
        id: 'r1', vendorId: 'v3', vendorName: v3.name, type: 'delivery', severity: 'critical',
        title: 'Critical Delivery Delays Detected',
        description: `${v3.name} has shown consistent delivery degradation over the past 3 months. On-time rate dropped from 92% to 68%.`,
        impact: 'Potential production line stoppage affecting $1.2M in downstream orders.',
        confidence: 94,
      });
      result.push({
        id: 'r2', vendorId: 'v3', vendorName: v3.name, type: 'financial', severity: 'high',
        title: 'Financial Stability Concerns',
        description: `Credit monitoring indicates deteriorating financial health. Days payable outstanding increased by 45%.`,
        impact: 'Risk of supply disruption if vendor faces insolvency.',
        confidence: 78,
      });
    }
    const v5 = vendors.find(v => v.id === 'v5');
    if (v5) {
      result.push({
        id: 'r3', vendorId: 'v5', vendorName: v5.name, type: 'compliance', severity: 'medium',
        title: 'Expired Contract Detected',
        description: `${v5.name} contract expired on ${v5.contractEnd}. No renewal initiated. Vendor is currently marked inactive.`,
        impact: 'Non-compliance with procurement policy. No legal coverage for ongoing obligations.',
        confidence: 99,
      });
    }
    const v1 = vendors.find(v => v.id === 'v1');
    if (v1) {
      result.push({
        id: 'r4', vendorId: 'v1', vendorName: v1.name, type: 'quality', severity: 'low',
        title: 'Quality Score Slight Decline',
        description: `Quality rating decreased from 4.8 to 4.6 in the last quarter. Still within acceptable range.`,
        impact: 'Monitor for continued decline. Consider quality audit if trend continues.',
        confidence: 62,
      });
    }
    return result;
  }, [vendors]);

  const severityCounts = useMemo(() => {
    const map: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    alerts.forEach(a => { map[a.severity] = (map[a.severity] || 0) + 1; });
    return map;
  }, [alerts]);

  const riskScore = useMemo(() => {
    const weights = { critical: 40, high: 25, medium: 15, low: 5 };
    const maxPossible = alerts.length * 40;
    if (!maxPossible) return 0;
    const actual = alerts.reduce((s, a) => s + weights[a.severity], 0);
    return Math.min(100, Math.round((actual / maxPossible) * 100));
  }, [alerts]);

  const [filterSeverity, setFilterSeverity] = useState('all');

  const filtered = useMemo(() => {
    if (filterSeverity === 'all') return alerts;
    return alerts.filter(a => a.severity === filterSeverity);
  }, [alerts, filterSeverity]);

  const doughnutData = {
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [{
      data: [severityCounts.critical, severityCounts.high, severityCounts.medium, severityCounts.low],
      backgroundColor: ['#FB7185', '#FB923C', '#A78BFA', '#22D3EE'],
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  const barData = {
    labels: vendors.map(v => v.name.split(' ')[0]),
    datasets: [{
      label: 'Risk Score',
      data: vendors.map(v => {
        const r = ratings.find(r2 => r2.vendorId === v.id);
        if (!r) return 50;
        if (r.trend === 'down') return 70 + Math.round((5 - r.overall) * 5);
        if (r.trend === 'up') return 15 + Math.round((5 - r.overall) * 3);
        return 30 + Math.round((5 - r.overall) * 4);
      }),
      backgroundColor: vendors.map(v => {
        const r = ratings.find(r2 => r2.vendorId === v.id);
        if (r?.trend === 'down') return 'rgba(251,113,133,0.6)';
        if (r?.trend === 'up') return 'rgba(52,211,153,0.6)';
        return 'rgba(96,165,250,0.6)';
      }),
      borderRadius: 8,
      borderWidth: 0,
    }],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
          <ShieldAlert size={24} style={{ color: 'var(--red)' }} /> AI Risk Intelligence
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>AI-powered risk detection and supplier intelligence</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="glass-card kpi-accent-red p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--red)', opacity: 0.15, color: 'var(--red)' }}>
            <AlertTriangle size={18} />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Risk Score</div>
            <div className="text-xl font-bold" style={{ color: 'var(--red)' }}>{riskScore}/100</div>
          </div>
        </div>
        <div className="glass-card kpi-accent-orange p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--orange)', opacity: 0.15, color: 'var(--orange)' }}>
            <AlertCircle size={18} />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Active Alerts</div>
            <div className="text-xl font-bold" style={{ color: 'var(--text)' }}>{alerts.length}</div>
          </div>
        </div>
        <div className="glass-card kpi-accent-purple p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--purple)', opacity: 0.15, color: 'var(--purple)' }}>
            <TrendingDown size={18} />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>At-Risk Vendors</div>
            <div className="text-xl font-bold" style={{ color: 'var(--text)' }}>{ratings.filter(r => r.trend === 'down').length}</div>
          </div>
        </div>
        <div className="glass-card kpi-accent-cyan p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--cyan)', opacity: 0.15, color: 'var(--cyan)' }}>
            <Info size={18} />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Avg Confidence</div>
            <div className="text-xl font-bold" style={{ color: 'var(--text)' }}>
              {alerts.length ? Math.round(alerts.reduce((s, a) => s + a.confidence, 0) / alerts.length) : 0}%
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="glass-card-solid p-5" style={{ height: 280 }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Risk by Severity</h3>
          <div style={{ height: 210 }}>
            <Doughnut
              data={doughnutData}
              options={{
                responsive: true, maintainAspectRatio: false, cutout: '65%',
                plugins: {
                  legend: { position: 'bottom' as const, labels: { color: '#CBD5E1', padding: 12, usePointStyle: true, pointStyleWidth: 8 } },
                  tooltip: { backgroundColor: 'rgba(6,17,32,0.9)', cornerRadius: 12 },
                },
              }}
            />
          </div>
        </div>
        <div className="glass-card-solid p-5 lg:col-span-2" style={{ height: 280 }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Vendor Risk Scores</h3>
          <div style={{ height: 210 }}>
            <Bar
              data={barData}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(6,17,32,0.9)', cornerRadius: 12 } },
                scales: {
                  x: { ticks: { color: '#94A3B8' }, grid: { display: false }, border: { display: false } },
                  y: { ticks: { color: '#94A3B8' }, grid: { color: 'rgba(148,197,255,0.08)' }, border: { display: false }, max: 100 },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Alert Filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Filter:</span>
        {['all', 'critical', 'high', 'medium', 'low'].map(s => (
          <button
            key={s}
            className={`glass-button text-xs ${filterSeverity === s ? 'glass-button-primary' : ''}`}
            onClick={() => setFilterSeverity(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Alerts */}
      <div className="space-y-3">
        {filtered.map(a => {
          const Icon = typeIcon[a.type] || AlertTriangle;
          return (
            <div key={a.id} className={`glass-card kpi-accent-${severityColor[a.severity]} p-5`}>
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `var(--${severityColor[a.severity]})`, opacity: 0.15, color: `var(--${severityColor[a.severity]})` }}
                >
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold" style={{ color: 'var(--text)' }}>{a.title}</span>
                    <span className={`glass-badge glass-badge-${severityColor[a.severity]}`}>{a.severity}</span>
                    <span className="glass-badge glass-badge-blue">{a.confidence}% confidence</span>
                  </div>
                  <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    {a.vendorName} &middot; {a.type}
                  </div>
                  <div className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{a.description}</div>
                  <div className="text-sm mt-1.5" style={{ color: 'var(--orange)' }}>
                    <strong>Impact:</strong> {a.impact}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
