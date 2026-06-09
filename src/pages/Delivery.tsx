import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  Truck, Package, CheckCircle2, AlertTriangle, Search, ChevronUp, ChevronDown,
  FileText, MessageSquare, Calendar, Plus,
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import '../lib/chartSetup';
import {
  fetchPurchaseOrders,
  fetchDeliveryPerformance,
  upsertPurchaseOrder,
  upsertDeliveryPerformance,
  type PurchaseOrder,
  type DeliveryNote,
  type DeliveryPerformance,
} from '../lib/data';
import { useRefresh } from '../lib/RefreshContext';
import { useToast } from '../lib/ToastContext';

// ─── Constants ───

const DELIVERY_STEPS: ('ordered' | 'confirmed' | 'in-transit' | 'delivered' | 'invoiced')[] = [
  'ordered', 'confirmed', 'in-transit', 'delivered', 'invoiced'
];

const STEP_LABELS: Record<string, string> = {
  ordered: 'Ordered',
  confirmed: 'Confirmed',
  'in-transit': 'In Transit',
  delivered: 'Delivered',
  invoiced: 'Invoiced',
};

const STATUS_COLORS: Record<string, string> = {
  ordered: 'blue',
  confirmed: 'purple',
  'in-transit': 'orange',
  delivered: 'green',
  invoiced: 'cyan',
};

const STATUS_ORDER: Record<string, number> = {
  ordered: 0,
  confirmed: 1,
  'in-transit': 2,
  delivered: 3,
  invoiced: 4,
};

const SORT_OPTIONS = [
  { value: 'earliest', label: 'Earliest Expected' },
  { value: 'overdue', label: 'Most Overdue' },
  { value: 'vendor', label: 'Vendor A-Z' },
  { value: 'status', label: 'Status' },
];

// ─── Helper Functions ───

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysBetween(date1: Date, date2: Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

function isOverdueStatus(status: string, deliveryDate: string): boolean {
  if (status === 'delivered' || status === 'invoiced') return false;
  const expected = new Date(deliveryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expected.setHours(0, 0, 0, 0);
  return expected < today;
}

function getOverdueDays(deliveryDate: string): number {
  const expected = new Date(deliveryDate);
  const today = new Date();
  return Math.max(0, daysBetween(expected, today));
}

function getStepIndex(status: string): number {
  return STATUS_ORDER[status] ?? 0;
}

function canAdvance(status: string): boolean {
  return status !== 'invoiced';
}

function canRevert(status: string): boolean {
  return status !== 'ordered';
}

function getNextStatus(status: string): string {
  const idx = getStepIndex(status);
  return DELIVERY_STEPS[Math.min(idx + 1, DELIVERY_STEPS.length - 1)];
}

function getPrevStatus(status: string): string {
  const idx = getStepIndex(status);
  return DELIVERY_STEPS[Math.max(idx - 1, 0)];
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Main Component ───

export default function Delivery() {
  const { refreshKey, triggerRefresh } = useRefresh();
  const { showToast } = useToast();
  const [pos, setPosState] = useState<PurchaseOrder[]>([]);
  const [deliveryPerf, setDeliveryPerfState] = useState<DeliveryPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchPO, setSearchPO] = useState('');
  const [searchVendorId, setSearchVendorId] = useState('');
  const [vendorQuery, setVendorQuery] = useState('');
  const [vendorDropOpen, setVendorDropOpen] = useState(false);
  const vendorInputRef = useRef<HTMLInputElement>(null);
  const vendorPortalRef = useRef<HTMLDivElement>(null);
  const [vendorDropPos, setVendorDropPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const [sortBy, setSortBy] = useState('earliest');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [newNoteText, setNewNoteText] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([fetchPurchaseOrders(), fetchDeliveryPerformance()])
      .then(([orders, perf]) => {
        if (cancelled) return;
        setPosState(orders);
        setDeliveryPerfState(perf);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  // ─── Vendor options from POs ───

  const vendorOptions = useMemo(() =>
    Array.from(new Map(pos.map(p => [p.vendorId ?? p.vendorName, p.vendorName])).entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [pos]);

  // ─── Computed values ───

  const poCount = useMemo(() => pos.length, [pos]);

  const statusCounts = useMemo(() => {
    const counts = { ordered: 0, confirmed: 0, 'in-transit': 0, delivered: 0, invoiced: 0, overdue: 0 };
    pos.forEach(po => {
      const status = po.deliveryStatus || 'ordered';
      if (isOverdueStatus(status, po.deliveryDate)) {
        counts.overdue++;
      }
      if (counts.hasOwnProperty(status)) {
        counts[status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [pos]);

  // ─── Filtering and Sorting ───

  const filteredAndSorted = useMemo(() => {
    let result = pos.filter(po => {
      const matchPO = !searchPO || po.id.toLowerCase().includes(searchPO.toLowerCase());
      const matchVendor = !searchVendorId ||
        po.vendorId === searchVendorId || po.vendorName === searchVendorId;

      const status = po.deliveryStatus || 'ordered';
      const isOverduePO = isOverdueStatus(status, po.deliveryDate);

      let matchFilter = true;
      if (filterStatus === 'overdue') {
        matchFilter = isOverduePO;
      } else if (filterStatus) {
        matchFilter = status === filterStatus && !isOverduePO;
      }

      return matchPO && matchVendor && matchFilter;
    });

    switch (sortBy) {
      case 'earliest':
        result.sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime());
        break;
      case 'overdue':
        result.sort((a, b) => {
          const aOverdue = isOverdueStatus(a.deliveryStatus || 'ordered', a.deliveryDate);
          const bOverdue = isOverdueStatus(b.deliveryStatus || 'ordered', b.deliveryDate);
          if (aOverdue && !bOverdue) return -1;
          if (!aOverdue && bOverdue) return 1;
          const aDays = getOverdueDays(a.deliveryDate);
          const bDays = getOverdueDays(b.deliveryDate);
          return bDays - aDays;
        });
        break;
      case 'vendor':
        result.sort((a, b) => a.vendorName.localeCompare(b.vendorName));
        break;
      case 'status':
        result.sort((a, b) => getStepIndex(a.deliveryStatus || 'ordered') - getStepIndex(b.deliveryStatus || 'ordered'));
        break;
    }

    return result;
  }, [pos, searchPO, searchVendorId, sortBy, filterStatus]);

  // ─── Chart Data ───

  const chartData = useMemo(() => {
    const source = searchVendorId ? filteredAndSorted : pos;
    if (source.length < 2) return null;

    const last10 = [...source]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return { last10, today };
  }, [pos, filteredAndSorted, searchVendorId]);

  // ─── Vendor dropdown outside-click ───

  useEffect(() => {
    if (!vendorDropOpen) return;
    const close = (e: MouseEvent) => {
      if (!vendorInputRef.current?.contains(e.target as Node) &&
          !vendorPortalRef.current?.contains(e.target as Node))
        setVendorDropOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [vendorDropOpen]);

  // ─── Status Badge Click Handler ───

  const handleStatusFilter = useCallback((status: string) => {
    if (filterStatus === status) {
      setFilterStatus(null);
    } else {
      setFilterStatus(status);
    }
  }, [filterStatus]);

  // ─── Status Transition Handlers ───

  const handleAdvanceStatus = useCallback(async (po: PurchaseOrder) => {
    const currentStatus = po.deliveryStatus || 'ordered';
    if (!canAdvance(currentStatus)) return;

    const nextStatus = getNextStatus(currentStatus) as PurchaseOrder['deliveryStatus'];
    const today = getTodayStr();

    let actualDeliveryDate = po.actualDeliveryDate;

    if (nextStatus === 'delivered' && !actualDeliveryDate) {
      actualDeliveryDate = today;
    }

    const updated = { ...po, deliveryStatus: nextStatus, actualDeliveryDate };
    const success = await upsertPurchaseOrder(updated);
    if (!success) return;

    const nextPos = pos.map(p => p.id === po.id ? updated : p);
    setPosState(nextPos);

    if ((nextStatus === 'delivered' || nextStatus === 'invoiced') && actualDeliveryDate) {
      const expected = new Date(po.deliveryDate);
      const actual = new Date(actualDeliveryDate);
      const daysDiff = daysBetween(actual, expected);
      const isOnTime = daysDiff >= 0;

      const newPerf: DeliveryPerformance = {
        id: `dp-${po.id}`,
        poId: po.id,
        vendorId: po.vendorId,
        vendorName: po.vendorName,
        promisedDate: po.deliveryDate,
        actualDate: actualDeliveryDate,
        status: isOnTime ? 'on-time' : 'delayed',
        delayDays: Math.abs(daysDiff),
        onTime: isOnTime,
        daysDifference: daysDiff,
      };
      await upsertDeliveryPerformance(newPerf);
      const nextPerf = deliveryPerf.filter(dp => dp.poId !== po.id).concat(newPerf);
      setDeliveryPerfState(nextPerf);
    }
  }, [pos, deliveryPerf]);

  const handleRevertStatus = useCallback(async (po: PurchaseOrder) => {
    const currentStatus = po.deliveryStatus || 'ordered';
    if (!canRevert(currentStatus)) return;

    const prevStatus = getPrevStatus(currentStatus) as PurchaseOrder['deliveryStatus'];

    let actualDeliveryDate = po.actualDeliveryDate;

    if (currentStatus === 'delivered') {
      actualDeliveryDate = null;
    }

    const updated = { ...po, deliveryStatus: prevStatus, actualDeliveryDate };
    const success = await upsertPurchaseOrder(updated);
    if (!success) return;

    const next = pos.map(p => p.id === po.id ? updated : p);
    setPosState(next);
  }, [pos]);

  // ─── Notes Handlers ───

  const toggleNotes = useCallback((poId: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(poId)) {
        next.delete(poId);
      } else {
        next.add(poId);
      }
      return next;
    });
  }, []);

  const handleAddNote = useCallback(async (po: PurchaseOrder) => {
    const text = newNoteText[po.id]?.trim();
    if (!text) return;

    const note: DeliveryNote = {
      timestamp: new Date().toISOString(),
      text,
    };

    const updated = {
      ...po,
      deliveryNotes: [...(po.deliveryNotes || []), note]
    };

    const success = await upsertPurchaseOrder(updated);
    if (!success) {
      showToast('Failed to save', 'error');
      return;
    }

    const next = pos.map(p => p.id === po.id ? updated : p);
    setPosState(next);
    setNewNoteText(prev => ({ ...prev, [po.id]: '' }));
    showToast('Note saved', 'success');
  }, [newNoteText, pos, showToast]);

  const handleDeleteNote = useCallback(async (po: PurchaseOrder, idx: number) => {
    const updated = {
      ...po,
      deliveryNotes: (po.deliveryNotes || []).filter((_, i) => i !== idx),
    };
    const success = await upsertPurchaseOrder(updated);
    if (success) {
      const next = pos.map(p => p.id === po.id ? updated : p);
      setPosState(next);
      showToast('Note deleted', 'info');
    } else {
      showToast('Failed to save', 'error');
    }
  }, [pos, showToast]);

  // ─── On-time Badge ───

  const getOnTimeBadge = useCallback((po: PurchaseOrder): { text: string; color: string; icon: React.ElementType } | null => {
    const status = po.deliveryStatus || 'ordered';
    if (status !== 'delivered' && status !== 'invoiced') return null;

    const actualDate = po.actualDeliveryDate;
    if (!actualDate) return null;

    const perf = deliveryPerf.find(dp => dp.poId === po.id);
    if (perf && perf.onTime !== undefined && perf.daysDifference !== undefined) {
      const days = Math.abs(perf.daysDifference);
      if (perf.onTime) {
        if (days === 0) {
          return { text: 'On Time', color: 'green', icon: CheckCircle2 };
        } else {
          return { text: `${days} day${days > 1 ? 's' : ''} early`, color: 'green', icon: CheckCircle2 };
        }
      } else {
        return { text: `${days} day${days > 1 ? 's' : ''} late`, color: 'red', icon: AlertTriangle };
      }
    }

    const expected = new Date(po.deliveryDate);
    const actual = new Date(actualDate);
    const daysDiff = daysBetween(actual, expected);

    if (daysDiff >= 0) {
      if (daysDiff === 0) {
        return { text: 'On Time', color: 'green', icon: CheckCircle2 };
      } else {
        return { text: `${daysDiff} day${daysDiff > 1 ? 's' : ''} early`, color: 'green', icon: CheckCircle2 };
      }
    } else {
      const lateDays = Math.abs(daysDiff);
      return { text: `${lateDays} day${lateDays > 1 ? 's' : ''} late`, color: 'red', icon: AlertTriangle };
    }
  }, [deliveryPerf]);

  // ─── Empty State ───

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Delivery Tracking</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Monitor shipment progress and delivery performance</p>
        </div>
        <div className="glass-card p-12 flex flex-col items-center justify-center gap-4 text-center">
          <Package size={48} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
          <div>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Loading...</h3>
          </div>
        </div>
      </div>
    );
  }

  if (poCount === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Delivery Tracking</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Monitor shipment progress and delivery performance</p>
        </div>
        <div className="glass-card p-12 flex flex-col items-center justify-center gap-4 text-center">
          <Package size={48} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
          <div>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>No purchase orders yet</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Create one in the Orders page to start tracking deliveries</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ───

  return (
    <div className="space-y-6">
      {/* Header */}
      <div data-tour="delivery-header">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Delivery Tracking</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Monitor shipment progress and delivery performance</p>
      </div>

      {/* Status Summary Badges */}
      <div className="flex flex-wrap gap-3">
        <StatusBadge
          label="Ordered"
          count={statusCounts.ordered}
          color="blue"
          icon={FileText}
          active={filterStatus === 'ordered'}
          onClick={() => handleStatusFilter('ordered')}
        />
        <StatusBadge
          label="In Transit"
          count={statusCounts['in-transit']}
          color="orange"
          icon={Truck}
          active={filterStatus === 'in-transit'}
          onClick={() => handleStatusFilter('in-transit')}
        />
        <StatusBadge
          label="Delivered"
          count={statusCounts.delivered}
          color="green"
          icon={Package}
          active={filterStatus === 'delivered'}
          onClick={() => handleStatusFilter('delivered')}
        />
        <StatusBadge
          label="Overdue"
          count={statusCounts.overdue}
          color="red"
          icon={AlertTriangle}
          active={filterStatus === 'overdue'}
          onClick={() => handleStatusFilter('overdue')}
        />
      </div>

      {/* Search and Sort */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* PO Number search */}
        <input
          className="glass-input"
          placeholder="Search PO number…"
          value={searchPO}
          onChange={e => setSearchPO(e.target.value)}
          style={{ flex: 1 }}
        />

        {/* Vendor combobox */}
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            ref={vendorInputRef}
            className="glass-input"
            placeholder="Filter by vendor…"
            value={vendorQuery}
            onChange={e => {
              setVendorQuery(e.target.value);
              if (!e.target.value) setSearchVendorId('');
              const r = vendorInputRef.current!.getBoundingClientRect();
              setVendorDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
              setVendorDropOpen(true);
            }}
            onFocus={() => {
              const r = vendorInputRef.current!.getBoundingClientRect();
              setVendorDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
              setVendorDropOpen(true);
            }}
          />
          {searchVendorId && (
            <button
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              onClick={() => { setSearchVendorId(''); setVendorQuery(''); }}
            >✕</button>
          )}
        </div>

        <select
          className="glass-input text-xs py-1.5 px-3"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Vendor dropdown portal */}
      {vendorDropOpen && vendorDropPos && ReactDOM.createPortal(
        <div ref={vendorPortalRef} style={{
          position: 'fixed', top: vendorDropPos.top, left: vendorDropPos.left,
          width: vendorDropPos.width, zIndex: 9999, maxHeight: 200, overflowY: 'auto',
          borderRadius: 12,
        }} className="glass-panel p-1">
          {vendorOptions
            .filter(v => !vendorQuery || v.name.toLowerCase().includes(vendorQuery.toLowerCase()))
            .map(v => (
              <button key={v.id}
                className="w-full text-left px-3 py-2 text-sm rounded-lg"
                style={{ color: 'var(--text)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onMouseDown={() => {
                  setSearchVendorId(v.id);
                  setVendorQuery(v.name);
                  setVendorDropOpen(false);
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(96,165,250,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {v.name}
              </button>
            ))}
        </div>,
        document.body
      )}

      {/* Timeline Chart */}
      {poCount >= 2 && chartData && (
        <div className="glass-card-solid p-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Delivery Timeline — Last 10 Orders</h3>
          <div style={{ height: 220 }}>
            <Bar
              data={{
                labels: chartData.last10.map(po => po.id),
                datasets: [{
                  label: 'Days until Delivery',
                  data: chartData.last10.map(po => {
                    const created = new Date(po.createdAt);
                    const expected = new Date(po.deliveryDate);
                    return Math.max(1, Math.ceil((expected.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
                  }),
                  backgroundColor: chartData.last10.map(po => {
                    const status = po.deliveryStatus || 'ordered';
                    const isOverduePO = isOverdueStatus(status, po.deliveryDate);
                    if (isOverduePO) return 'rgba(251,113,133,0.7)';
                    if (status === 'delivered' || status === 'invoiced') return 'rgba(52,211,153,0.6)';
                    if (status === 'in-transit') return 'rgba(251,146,60,0.6)';
                    return 'rgba(96,165,250,0.6)';
                  }),
                  borderRadius: 6,
                }],
              }}
              options={{
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: 'rgba(6,17,32,0.9)',
                    cornerRadius: 12,
                    callbacks: {
                      label: (ctx) => {
                        const po = chartData.last10[ctx.dataIndex];
                        const status = po.deliveryStatus || 'ordered';
                        const overdue = isOverdueStatus(status, po.deliveryDate);
                        return [
                          `Expected: ${formatDate(po.deliveryDate)}`,
                          `Status: ${overdue ? 'Overdue' : STEP_LABELS[status]}`,
                        ];
                      },
                    },
                  },
                },
                scales: {
                  x: {
                    ticks: { color: '#94A3B8' },
                    grid: { color: 'rgba(148,197,255,0.08)' },
                    title: { display: true, text: 'Days', color: '#94A3B8' },
                  },
                  y: {
                    ticks: { color: '#94A3B8', font: { size: 11 } },
                    grid: { display: false },
                  },
                },
              }}
            />
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ background: 'rgba(96,165,250,0.6)' }} />
              <span>Ordered/Confirmed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ background: 'rgba(251,146,60,0.6)' }} />
              <span>In Transit</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ background: 'rgba(52,211,153,0.6)' }} />
              <span>Delivered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ background: 'rgba(251,113,133,0.7)' }} />
              <span>Overdue</span>
            </div>
          </div>
        </div>
      )}

      {poCount < 2 && (
        <div className="glass-card p-6 text-center" style={{ color: 'var(--text-muted)' }}>
          Not enough data for timeline chart
        </div>
      )}

      {/* PO Cards Grid */}
      <div data-tour="delivery-list" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          const status = po.deliveryStatus || 'ordered';
          const isOverduePO = isOverdueStatus(status, po.deliveryDate);
          const overdueDays = isOverduePO ? getOverdueDays(po.deliveryDate) : 0;
          const stepIndex = getStepIndex(status);
          const onTimeBadge = getOnTimeBadge(po);
          const notesCount = po.deliveryNotes?.length || 0;
          const notesExpanded = expandedNotes.has(po.id);

          return (
            <div
              key={po.id}
              className={`glass-card p-5 relative ${isOverduePO ? 'kpi-accent-red' : ''}`}
              style={isOverduePO ? { boxShadow: '0 8px 28px rgba(251,113,133,0.18)' } : undefined}
            >
              {/* Header Row */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold" style={{ color: 'var(--text)' }}>{po.id}</span>
                    <span className={`glass-badge glass-badge-${STATUS_COLORS[status]}`}>
                      {STEP_LABELS[status]}
                    </span>
                    {isOverduePO && (
                      <span className="glass-badge glass-badge-red flex items-center gap-1">
                        <AlertTriangle size={10} /> {overdueDays}d overdue
                      </span>
                    )}
                    {onTimeBadge && (
                      <span className={`glass-badge glass-badge-${onTimeBadge.color} flex items-center gap-1`}>
                        <onTimeBadge.icon size={10} /> {onTimeBadge.text}
                      </span>
                    )}
                  </div>
                  <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{po.vendorName}</div>
                </div>
                <button
                  className="glass-button text-xs py-1 px-2 flex items-center gap-1 flex-shrink-0"
                  onClick={() => toggleNotes(po.id)}
                >
                  <MessageSquare size={12} /> Notes ({notesCount})
                </button>
              </div>

              {/* Timing Info */}
              <div className="flex items-center gap-4 text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
                <span className="flex items-center gap-1">
                  <Calendar size={12} /> Expected: {formatDate(po.deliveryDate)}
                </span>
                {po.actualDeliveryDate && (
                  <span className="flex items-center gap-1" style={{ color: 'var(--green)' }}>
                    <CheckCircle2 size={12} /> Delivered: {formatDate(po.actualDeliveryDate)}
                  </span>
                )}
              </div>

              {/* Progress Tracker */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  {DELIVERY_STEPS.map((step, idx) => {
                    const isCompleted = idx < stepIndex;
                    const isCurrent = idx === stepIndex;
                    const stepColor = STATUS_COLORS[step];
                    return (
                      <div key={step} className="flex flex-col items-center gap-1" style={{ width: '20%' }}>
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all ${isCurrent ? 'animate-pulse' : ''}`}
                          style={{
                            background: isCompleted || isCurrent ? `var(--${stepColor})` : 'var(--surface-strong)',
                            color: isCompleted || isCurrent ? '#fff' : 'var(--text-muted)',
                            border: `1px solid ${isCompleted || isCurrent ? `var(--${stepColor})` : 'var(--glass-border)'}`,
                          }}
                        >
                          {isCompleted ? <CheckCircle2 size={12} /> : idx + 1}
                        </div>
                        <span
                          className="text-[10px] text-center"
                          style={{ color: isCurrent ? 'var(--text)' : 'var(--text-muted)' }}
                        >
                          {STEP_LABELS[step]}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  Step {stepIndex + 1} of 5: {STEP_LABELS[status]}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  className="glass-button text-xs py-1.5 px-3 flex items-center gap-1"
                  disabled={!canRevert(status)}
                  style={{ opacity: canRevert(status) ? 1 : 0.4, cursor: canRevert(status) ? 'pointer' : 'not-allowed' }}
                  onClick={() => handleRevertStatus(po)}
                >
                  <ChevronUp size={12} /> Revert Status
                </button>
                <button
                  className="glass-button glass-button-primary text-xs py-1.5 px-3 flex items-center gap-1"
                  disabled={!canAdvance(status)}
                  style={{ opacity: canAdvance(status) ? 1 : 0.4, cursor: canAdvance(status) ? 'pointer' : 'not-allowed' }}
                  onClick={() => handleAdvanceStatus(po)}
                >
                  Advance Status <ChevronDown size={12} />
                </button>
              </div>

              {/* Notes Panel */}
              {notesExpanded && (
                <div className="glass-card-solid p-3 mt-3">
                  <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
                    Delivery Notes
                  </h4>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto mb-3">
                    {notesCount === 0 ? (
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>No notes yet</div>
                    ) : (
                      po.deliveryNotes!.map((note, idx) => (
                        <div key={idx} className="text-xs p-2 rounded-lg flex items-start justify-between gap-2" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                          <div>
                            <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
                              {new Date(note.timestamp).toLocaleString()}
                            </div>
                            {note.text}
                          </div>
                          <button
                            onClick={() => handleDeleteNote(po, idx)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--text-muted)', padding: '2px 4px', borderRadius: 4,
                              flexShrink: 0 }}
                            title="Delete note"
                          >✕</button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="glass-input flex-1 text-xs"
                      placeholder="Add a note..."
                      value={newNoteText[po.id] || ''}
                      onChange={e => setNewNoteText(prev => ({ ...prev, [po.id]: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddNote(po);
                      }}
                    />
                    <button
                      className="glass-button text-xs py-1 px-2 flex items-center gap-1"
                      onClick={() => handleAddNote(po)}
                      disabled={!newNoteText[po.id]?.trim()}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Filtered Empty State */}
      {filteredAndSorted.length === 0 && poCount > 0 && (
        <div className="glass-card p-8 text-center" style={{ color: 'var(--text-muted)' }}>
          No purchase orders match the current filters
        </div>
      )}
    </div>
  );
}

// ─── Status Badge Component ───

function StatusBadge({
  label,
  count,
  color,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`glass-card p-3 flex items-center gap-3 transition-all cursor-pointer ${active ? 'ring-2' : ''}`}
      style={{
        borderColor: active ? `var(--${color})` : undefined,
        boxShadow: active ? `0 0 0 2px var(--${color})` : undefined,
      }}
      onClick={onClick}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `var(--${color})`, opacity: 0.18, color: `var(--${color})` }}
      >
        <Icon size={16} />
      </div>
      <div>
        <div className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>{label}</div>
        <div className="text-lg font-bold" style={{ color: `var(--${color})` }}>{count}</div>
      </div>
    </button>
  );
}

