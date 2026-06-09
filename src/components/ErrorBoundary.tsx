import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            background: 'var(--surface-solid)',
            border: '1px solid var(--glass-border)',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div style={{ color: 'var(--red)', fontSize: '32px', marginBottom: '12px' }}>
            &#9888;
          </div>
          <div style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '8px' }}>
            Something went wrong on this page
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
            {this.state.error?.message}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'linear-gradient(135deg, var(--blue), var(--cyan))',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 20px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
