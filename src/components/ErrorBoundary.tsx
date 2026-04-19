import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    try {
      if (error.message.startsWith('{')) {
        const parsed = JSON.parse(error.message);
        this.setState({ errorInfo: parsed.friendlyMessage || parsed.error });
      }
    } catch (e) {
      // Not a JSON error, ignore
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-6 text-center">
          <div className="glass-card p-8 max-w-md w-full border-red-500/30 bg-red-500/5">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-500" size={32} />
            </div>
            <h1 className="text-2xl font-black tracking-tighter uppercase mb-4 text-dark-bg-text">
              System Interruption
            </h1>
            <p className="text-sm text-dark-bg-muted mb-8 font-medium">
              {this.state.errorInfo || "An unexpected error occurred in the neural link. Please try reloading the interface."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-dark-surface text-dark-bg-text px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-dark-border transition-colors border border-dark-border"
            >
              <RefreshCw size={16} />
              Reboot System
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
