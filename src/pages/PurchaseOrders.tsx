import { useState, useMemo } from 'react';
import { Search, Plus, Clock, CheckCircle2, Truck, XCircle, FileEdit, ChevronDown, ChevronUp } from 'lucide-react';
import { getPurchaseOrders, type PurchaseOrder } from '../lib/data';

const statusIcon: Record<string, React.ElementType> = {
  draft: FileEdit,
  pending: Clock,
  approved: CheckCircle2,
  shipped: Truck,
  delivered: CheckCircle2,
  cancelled: XCircle,
};

const statusColor: Record<string, string> = {
  draft: 'purple',
  pending: 'orange',
  approved: 'cyan',
  shipped: 'blue',
  delivered: 'green',
  cancelled: 'red',
};

const priorityColor: Record<string, string> = {
  low: 'blue',
  medium: 'orange',
  high: 'red',
  critical: 'red',
};

export default function PurchaseOrders() {
  const [pos] = useState<PurchaseOrder[]>(() => getPurchaseOrders());
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return pos.filter(p => {
      const matchSearch = p.id.toLowerCase().includes(search.toLowerCase()) || p.vendorName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || p.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [pos, search, filterStatus]);

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    pos.forEach(p => { map[p.status] = (map[p.status] || 0) + 1; });
    return map;
  }, [pos]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Purchase Orders</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Track and manage procurement orders</p>
        </div>
        <button className="glass-button glass-button-primary flex items-center gap-2">
          <Plus size={16} /> New PO
        </button>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            className="glass-input w-full pl-9"
            placeholder="Search POs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          className={`glass-button text-xs ${filterStatus === 'all' ? 'glass-button-primary' : ''}`}
          onClick={() => setFilterStatus('all')}
        >
          All ({pos.length})
        </button>
        {Object.entries(statusCounts).map(([s, c]) => (
          <button
            key={s}
            className={`glass-button text-xs ${filterStatus === s ? 'glass-button-primary' : ''}`}
            onClick={() => setFilterStatus(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)} ({c})
          </button>
        ))}
      </div>

      {/* PO Cards */}
      <div className="space-y-3">
        {filtered.map(po => {
          const Icon = statusIcon[po.status] || Clock;
          const isExpanded = expanded === po.id;
          return (
            <div key={po.id} className="glass-card-solid overflow-hidden">
              <div
                className="flex items-center gap-4 p-5 cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : po.id)}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `var(--${statusColor[po.status]})`, opacity: 0.15, color: `var(--${statusColor[po.status]})` }}
                >
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" style={{ color: 'var(--text)' }}>{po.id}</span>
                    <span className={`glass-badge glass-badge-${priorityColor[po.priority]}`}>
                      {po.priority}
                    </span>
                  </div>
                  <div className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {po.vendorName} &middot; {po.items.length} item{po.items.length > 1 ? 's' : ''}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold" style={{ color: 'var(--text)' }}>
                    ${po.total.toLocaleString()}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Due {po.deliveryDate}
                  </div>
                </div>
                <span className={`glass-badge glass-badge-${statusColor[po.status]}`}>
                  {po.status}
                </span>
                {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
              </div>
              {isExpanded && (
                <div className="px-5 pb-5 pt-0">
                  <div
                    className="overflow-x-auto"
                    style={{ borderTop: '1px solid var(--glass-border)' }}
                  >
                    <table className="glass-table mt-3">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Qty</th>
                          <th>Unit Price</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {po.items.map(item => (
                          <tr key={item.id}>
                            <td style={{ color: 'var(--text)' }}>{item.name}</td>
                            <td>{item.quantity}</td>
                            <td>${item.unitPrice.toLocaleString()}</td>
                            <td style={{ color: 'var(--text)' }}>${item.total.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex items-center justify-between mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                      <span>Created: {po.createdAt}</span>
                      <span className="font-semibold" style={{ color: 'var(--text)' }}>
                        Total: ${po.total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
