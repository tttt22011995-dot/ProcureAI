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
} from 'lucide-react';

export type Page = 'dashboard' | 'vendors' | 'purchase-orders' | 'delivery' | 'scorecard' | 'ai-risk';

interface SidebarProps {
  active: Page;
  onNavigate: (page: Page) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  notificationCount?: number;
}

const navItems: { page: Page; label: string; icon: React.ElementType }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'vendors', label: 'Vendors', icon: Users },
  { page: 'purchase-orders', label: 'Purchase Orders', icon: FileText },
  { page: 'delivery', label: 'Delivery', icon: Truck },
  { page: 'scorecard', label: 'Scorecard', icon: BarChart3 },
  { page: 'ai-risk', label: 'AI Risk', icon: ShieldAlert },
];

export default function Sidebar({ active, onNavigate, isDark, onToggleTheme, notificationCount = 3 }: SidebarProps) {
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
        <button
          className="relative p-2 rounded-xl transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onClick={() => {}}
        >
          <Bell size={18} />
          {notificationCount > 0 && (
            <span
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
              style={{ background: 'var(--red)' }}
            >
              {notificationCount}
            </span>
          )}
        </button>
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
