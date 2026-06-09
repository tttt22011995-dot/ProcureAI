import { useState, useMemo } from 'react';
import { Search, Plus, Star, MapPin, Mail, ExternalLink } from 'lucide-react';
import { getVendors, getVendorRatings, type Vendor, type VendorRating } from '../lib/data';

export default function Vendors() {
  const [vendors] = useState<Vendor[]>(() => getVendors());
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selected, setSelected] = useState<Vendor | null>(null);
  const ratings = useMemo(() => getVendorRatings(), []);

  const filtered = useMemo(() => {
    return vendors.filter(v => {
      const matchSearch = v.name.toLowerCase().includes(search.toLowerCase()) || v.category.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || v.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [vendors, search, filterStatus]);

  const ratingFor = (id: string): VendorRating | undefined => ratings.find(r => r.vendorId === id);

  const statusColor = (s: string) => {
    switch (s) {
      case 'active': return 'green';
      case 'under-review': return 'orange';
      case 'inactive': return 'red';
      default: return 'blue';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Vendors</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Manage and monitor your vendor network</p>
        </div>
        <button className="glass-button glass-button-primary flex items-center gap-2">
          <Plus size={16} /> Add Vendor
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            className="glass-input w-full pl-9"
            placeholder="Search vendors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {['all', 'active', 'under-review', 'inactive'].map(s => (
          <button
            key={s}
            className={`glass-button text-xs ${filterStatus === s ? 'glass-button-primary' : ''}`}
            onClick={() => setFilterStatus(s)}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.replace('-', ' ').slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card-solid overflow-hidden">
        <div className="overflow-x-auto">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Category</th>
                <th>Location</th>
                <th>Rating</th>
                <th>Status</th>
                <th>Spend</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => {
                return (
                  <tr key={v.id} className="cursor-pointer" onClick={() => setSelected(v)}>
                    <td className="font-medium" style={{ color: 'var(--text)' }}>{v.name}</td>
                    <td>{v.category}</td>
                    <td className="flex items-center gap-1"><MapPin size={12} /> {v.location}</td>
                    <td className="flex items-center gap-1">
                      <Star size={12} style={{ color: 'var(--orange)' }} fill="var(--orange)" />
                      {v.rating}
                    </td>
                    <td>
                      <span className={`glass-badge glass-badge-${statusColor(v.status)}`}>
                        {v.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text)' }}>${(v.spend / 1000).toLocaleString()}K</td>
                    <td>
                      <ExternalLink size={14} style={{ color: 'var(--text-muted)' }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="glass-card p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{selected.name}</h2>
              <div className="flex items-center gap-3 mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1"><MapPin size={12} /> {selected.location}</span>
                <span className="flex items-center gap-1"><Mail size={12} /> {selected.email}</span>
              </div>
            </div>
            <span className={`glass-badge glass-badge-${statusColor(selected.status)}`}>
              {selected.status.replace('-', ' ')}
            </span>
          </div>
          {(() => {
            const r = ratingFor(selected.id);
            if (!r) return null;
            return (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
                {[
                  { label: 'Quality', val: r.quality },
                  { label: 'Delivery', val: r.delivery },
                  { label: 'Cost', val: r.cost },
                  { label: 'Responsiveness', val: r.responsiveness },
                  { label: 'Overall', val: r.overall },
                ].map(m => (
                  <div key={m.label} className="glass-card p-3 text-center">
                    <div className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
                    <div className="text-xl font-bold mt-1" style={{ color: 'var(--blue)' }}>{m.val.toFixed(1)}</div>
                  </div>
                ))}
              </div>
            );
          })()}
          <div className="flex items-center gap-2 mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            <span>Contract ends: {selected.contractEnd}</span>
            <span>|</span>
            <span>Annual spend: ${(selected.spend / 1000).toLocaleString()}K</span>
          </div>
        </div>
      )}
    </div>
  );
}
