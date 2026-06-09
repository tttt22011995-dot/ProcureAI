import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Vendors from './pages/Vendors';
import PurchaseOrders from './pages/PurchaseOrders';
import Delivery from './pages/Delivery';
import Scorecard from './pages/Scorecard';
import AIRisk from './pages/AIRisk';
import { loadInitialData, type Page } from './lib/data';
import { PageErrorBoundary } from './components/ErrorBoundary';
import { RefreshProvider } from './lib/RefreshContext';

function AppContent() {
  const [page, setPage] = useState<Page>('dashboard');
  const [isDark, setIsDark] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadInitialData().finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch {}
  }, [isDark]);

  const toggleTheme = () => setIsDark(d => !d);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading data...</div>
      </div>
    );
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <PageErrorBoundary><Dashboard /></PageErrorBoundary>;
      case 'vendors': return <PageErrorBoundary><Vendors /></PageErrorBoundary>;
      case 'purchase-orders': return <PageErrorBoundary><PurchaseOrders /></PageErrorBoundary>;
      case 'delivery': return <PageErrorBoundary><Delivery /></PageErrorBoundary>;
      case 'scorecard': return <PageErrorBoundary><Scorecard /></PageErrorBoundary>;
      case 'ai-risk': return <PageErrorBoundary><AIRisk /></PageErrorBoundary>;
    }
  };

  return (
    <div
      className="min-h-screen transition-colors"
      style={{
        background: isDark
          ? 'radial-gradient(ellipse at 20% 0%, #0B1E35 0%, #061120 50%, #040C18 100%)'
          : 'radial-gradient(ellipse at 20% 0%, #EAF4FF 0%, #F6FAFF 50%, #FFFFFF 100%)',
        transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)',
        transitionDuration: '220ms',
      }}
    >
      <Sidebar active={page} onNavigate={setPage} isDark={isDark} onToggleTheme={toggleTheme} />
      <main className="ml-[220px] p-6 lg:p-8 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <RefreshProvider>
      <AppContent />
    </RefreshProvider>
  );
}

export default App;
