import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Vendors from './pages/Vendors';
import PurchaseOrders from './pages/PurchaseOrders';
import Delivery from './pages/Delivery';
import Scorecard from './pages/Scorecard';
import AiRisk from './pages/AiRisk';
import { seedData, type Page } from './lib/data';

function getInitialTheme(): boolean {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'light') return false;
    return true;
  } catch {
    return true;
  }
}

function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [isDark, setIsDark] = useState(getInitialTheme);

  useEffect(() => {
    seedData();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch {}
  }, [isDark]);

  const toggleTheme = () => setIsDark(d => !d);

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard />;
      case 'vendors': return <Vendors />;
      case 'purchase-orders': return <PurchaseOrders />;
      case 'delivery': return <Delivery />;
      case 'scorecard': return <Scorecard />;
      case 'ai-risk': return <AiRisk />;
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

export default App;
