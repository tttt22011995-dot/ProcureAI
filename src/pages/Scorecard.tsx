import { useState, useMemo } from 'react';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { Radar } from 'react-chartjs-2';
import { Star, TrendingUp, TrendingDown, Minus, Award } from 'lucide-react';
import { getVendors, getVendorRatings } from '../lib/data';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export default function Scorecard() {
  const vendors = getVendors();
  const ratings = getVendorRatings();
  const [selectedVendor, setSelectedVendor] = useState<string>(vendors[0]?.id ?? '');

  const activeVendors = useMemo(() => vendors.filter(v => v.status !== 'inactive'), [vendors]);

  const currentRating = useMemo(() => ratings.find(r => r.vendorId === selectedVendor), [ratings, selectedVendor]);
  const currentVendor = useMemo(() => vendors.find(v => v.id === selectedVendor), [vendors, selectedVendor]);

  const radarData = useMemo(() => {
    if (!currentRating) return null;
    return {
      labels: ['Quality', 'Delivery', 'Cost', 'Responsiveness', 'Overall'],
      datasets: [{
        label: currentVendor?.name ?? 'Vendor',
        data: [currentRating.quality, currentRating.delivery, currentRating.cost, currentRating.responsiveness, currentRating.overall],
        borderColor: '#60A5FA',
        backgroundColor: 'rgba(96,165,250,0.15)',
        pointBackgroundColor: '#60A5FA',
        pointRadius: 5,
        pointHoverRadius: 7,
        borderWidth: 2,
      }],
    };
  }, [currentRating, currentVendor]);

  const trendIcon = (t: string) => {
    if (t === 'up') return <TrendingUp size={14} style={{ color: 'var(--green)' }} />;
    if (t === 'down') return <TrendingDown size={14} style={{ color: 'var(--red)' }} />;
    return <Minus size={14} style={{ color: 'var(--text-muted)' }} />;
  };

  const sorted = useMemo(() => {
    return [...ratings]
      .map(r => ({ ...r, vendor: vendors.find(v => v.id === r.vendorId) }))
      .filter(r => r.vendor)
      .sort((a, b) => b.overall - a.overall);
  }, [ratings, vendors]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Vendor Scorecard</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Performance ratings and benchmarking</p>
      </div>

      {/* Vendor Selector */}
      <div className="flex flex-wrap gap-2 items-center">
        {activeVendors.map(v => (
          <button
            key={v.id}
            className={`glass-button text-xs ${selectedVendor === v.id ? 'glass-button-primary' : ''}`}
            onClick={() => setSelectedVendor(v.id)}
          >
            {v.name}
          </button>
        ))}
      </div>

      {/* Radar + Detail */}
      {radarData && currentRating && currentVendor && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="glass-card-solid p-5 flex items-center justify-center" style={{ minHeight: 360 }}>
            <div style={{ width: '100%', maxWidth: 400, height: 320 }}>
              <Radar
                data={radarData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    r: {
                      min: 0,
                      max: 5,
                      ticks: { stepSize: 1, color: '#94A3B8', backdropColor: 'transparent', font: { size: 11 } },
                      grid: { color: 'rgba(148,197,255,0.12)' },
                      angleLines: { color: 'rgba(148,197,255,0.12)' },
                      pointLabels: { color: '#CBD5E1', font: { size: 13, family: 'Inter' } },
                    },
                  },
                  plugins: {
                    legend: { display: false },
                    tooltip: { backgroundColor: 'rgba(6,17,32,0.9)', cornerRadius: 12 },
                  },
                }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{currentVendor.name}</h2>
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{currentVendor.category} &middot; {currentVendor.location}</div>
                </div>
                <div className="flex items-center gap-2">
                  {trendIcon(currentRating.trend)}
                  <span className="glass-badge glass-badge-blue">
                    <Star size={10} fill="var(--blue)" /> {currentRating.overall.toFixed(1)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Quality', val: currentRating.quality, max: 5 },
                  { label: 'Delivery', val: currentRating.delivery, max: 5 },
                  { label: 'Cost', val: currentRating.cost, max: 5 },
                  { label: 'Responsiveness', val: currentRating.responsiveness, max: 5 },
                ].map(m => (
                  <div key={m.label} className="glass-card p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>{m.label}</span>
                      <span className="text-sm font-bold" style={{ color: 'var(--blue)' }}>{m.val.toFixed(1)}/{m.max}</span>
                    </div>
                    <div
                      className="mt-2 h-1.5 rounded-full overflow-hidden"
                      style={{ background: 'var(--surface-strong)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(m.val / m.max) * 100}%`, background: 'var(--blue)', transition: 'width 0.5s cubic-bezier(.22,1,.36,1)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="glass-card-solid p-5">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <Award size={16} style={{ color: 'var(--blue)' }} /> Vendor Leaderboard
        </h3>
        <table className="glass-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Vendor</th>
              <th>Quality</th>
              <th>Delivery</th>
              <th>Cost</th>
              <th>Responsiveness</th>
              <th>Overall</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.vendorId} className="cursor-pointer" onClick={() => setSelectedVendor(r.vendorId)}>
                <td className="font-bold" style={{ color: i < 3 ? 'var(--blue)' : 'var(--text)' }}>#{i + 1}</td>
                <td className="font-medium" style={{ color: 'var(--text)' }}>{r.vendor?.name}</td>
                <td>{r.quality.toFixed(1)}</td>
                <td>{r.delivery.toFixed(1)}</td>
                <td>{r.cost.toFixed(1)}</td>
                <td>{r.responsiveness.toFixed(1)}</td>
                <td className="font-bold" style={{ color: 'var(--blue)' }}>{r.overall.toFixed(1)}</td>
                <td>{trendIcon(r.trend)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
