import { createContext, useContext, useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';
interface Toast { id: string; message: string; type: ToastType; }
interface ToastContextValue { showToast: (message: string, type?: ToastType) => void; }

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });
export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const borderColor: Record<ToastType, string> = {
    success: 'var(--green)', error: 'var(--red)', info: 'var(--blue)',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} className="glass-panel" style={{
            minWidth: 240, maxWidth: 360, padding: '12px 16px',
            borderLeft: `3px solid ${borderColor[t.type]}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            animation: 'toast-in 180ms cubic-bezier(.22,1,.36,1)',
          }}>
            <span className="text-sm" style={{ color: 'var(--text)' }}>{t.message}</span>
            <button onClick={() => dismiss(t.id)}
              style={{ color: 'var(--text-muted)', background: 'none', border: 'none',
                cursor: 'pointer', flexShrink: 0 }}>✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
