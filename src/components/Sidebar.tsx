import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  Truck,
  BarChart3,
  ShieldAlert,
  Bell,
  Sun,
  Moon,
  AlertTriangle,
  TrendingDown,
  Clock,
} from 'lucide-react';
import { computeAlerts, type Page } from '../lib/data';

interface SidebarProps {
  active: Page;
  onNavigate: (page: Page) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

const navItems: { page: Page; label: string; icon: React.ElementType }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'vendors', label: 'Vendors', icon: Users },
  { page: 'purchase-orders', label: 'Purchase Orders', icon: FileText },
  { page: 'delivery', label: 'Delivery', icon: Truck },
  { page: 'scorecard', label: 'Scorecard', icon: BarChart3 },
  { page: 'ai-risk', label: 'AI Risk', icon: ShieldAlert },
];

const alertIcon: Record<string, React.ElementType> = {
  overdue: Clock,
  'low-score': TrendingDown,
  stuck: AlertTriangle,
};

const alertColor: Record<string, string> = {
  overdue: 'red',
  'low-score': 'orange',
  stuck: 'purple',
};

export default function Sidebar({ active, onNavigate, isDark, onToggleTheme }: SidebarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const alerts = computeAlerts();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const handleAlertClick = (page: Page) => {
    setDropdownOpen(false);
    onNavigate(page);
  };

  return (
    <aside
      className="glass-panel fixed left-0 top-0 bottom-0 w-[220px] flex flex-col p-5 z-30 overflow-y-auto"
      style={{ borderRadius: '0 28px 28px 0' }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 mb-8 px-1">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
          style={{ background: 'linear-gradient(135deg, var(--blue), var(--cyan))' }}
        >
          🚚
        </div>
        <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--text)' }}>
          ProcureAI
        </span>
      </div>

      {/* Notifications + Theme */}
      <div className="flex items-center justify-between mb-6 px-1">
        <div className="relative" ref={dropdownRef}>
          <button
            className="relative p-2 rounded-xl transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onClick={() => setDropdownOpen(o => !o)}
          >
            <Bell size={18} />
            {alerts.length > 0 && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                style={{ background: 'var(--red)' }}
              >
                {alerts.length}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div
              className="absolute left-0 top-full mt-2 w-[260px] glass-panel p-0 overflow-hidden z-40"
              style={{ borderRadius: 16 }}
            >
              <div
                className="px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--glass-border)' }}
              >
                Notifications ({alerts.length})
              </div>
              <div className="max-h-[240px] overflow-y-auto">
                {alerts.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No alerts
                  </div>
                ) : (
                  alerts.map(alert => {
                    const Icon = alertIcon[alert.type] ?? AlertTriangle;
                    const color = alertColor[alert.type] ?? 'blue';
                    return (
                      <button
                        key={alert.id}
                        className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[rgba(96,165,250,0.06)]"
                        style={{ borderBottom: '1px solid rgba(148,197,255,0.06)' }}
                        onClick={() => handleAlertClick(alert.page)}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: `var(--${color})`, opacity: 0.15, color: `var(--${color})` }}
                        >
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                            {alert.message}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <button
          className="p-2 rounded-xl transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onClick={onToggleTheme}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1.5 flex-1">
        {navItems.map(({ page, label, icon: Icon }) => {
          const isActive = active === page;
          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all ${
                isActive ? 'nav-active' : ''
              }`}
              style={{
                color: isActive ? 'var(--blue)' : 'var(--text-secondary)',
                transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)',
                transitionDuration: '180ms',
                border: isActive ? undefined : '1px solid transparent',
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="text-xs font-medium pt-4 mt-4 px-1"
        style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--glass-border)' }}
      >
        ProcureAI v1.0
      </div>
    </aside>
  );
}
