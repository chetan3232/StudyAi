import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Cpu, Activity } from 'lucide-react';
import { motion } from 'motion/react';

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
        <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
          {/* Deep Glow Background */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-500/5 rounded-full blur-[100px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-neon-purple/10 rounded-full blur-[80px]" />
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="relative z-10 glass-card p-10 max-w-lg w-full border border-red-500/20 bg-dark-surface/60 backdrop-blur-2xl shadow-[0_0_50px_rgba(239,68,68,0.1)]"
          >
            {/* Top decorative laser line */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50" />
            
            <div className="relative mb-8">
              <motion.div 
                animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 bg-red-500/20 rounded-full blur-xl w-24 h-24 mx-auto"
              />
              <div className="relative w-24 h-24 bg-dark-bg/90 border border-red-500/30 rounded-2xl rotate-3 flex items-center justify-center mx-auto shadow-inner shadow-red-500/10">
                <div className="absolute top-2 left-2 flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500/30" />
                </div>
                <AlertTriangle className="text-red-500 -rotate-3 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" size={40} strokeWidth={2} />
              </div>
            </div>

            <div className="space-y-3 mb-8">
              <div className="flex items-center justify-center gap-2 text-red-500/80">
                <Cpu size={12} />
                <span className="text-[9px] font-black uppercase tracking-[0.3em]">Critical Exception</span>
                <Activity size={12} />
              </div>
              <h1 className="text-3xl font-black tracking-tighter uppercase italic text-dark-bg-text">
                System Interruption
              </h1>
              <p className="text-xs text-dark-bg-subtle font-medium px-4 leading-relaxed max-w-sm mx-auto">
                {this.state.errorInfo || "Neural link destabilized. A critical anomaly forced the interface to halt operations."}
              </p>
            </div>

            <div className="bg-dark-bg/60 border border-dark-border rounded-xl p-4 mb-8 text-left relative group overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-500/30 group-hover:bg-red-500/60 transition-colors" />
              <p className="text-[9px] font-black text-dark-bg-dim uppercase tracking-widest mb-1.5 pl-2">Error Trace</p>
              <p className="text-[11px] text-red-400/80 font-mono truncate pl-2">
                {this.state.error?.message || "ERR_SYS_FATAL"}
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => window.location.reload()}
              className="w-full relative overflow-hidden group bg-dark-bg border border-red-500/30 text-white px-6 py-4 rounded-xl text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all hover:border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_25px_rgba(239,68,68,0.2)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-red-500/10 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <RefreshCw size={16} strokeWidth={2.5} className="group-hover:rotate-180 transition-transform duration-500 relative z-10 text-red-400 group-hover:text-red-300" />
              <span className="relative z-10">Reboot Interface</span>
            </motion.button>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
