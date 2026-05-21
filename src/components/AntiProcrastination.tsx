import { useState, useEffect, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Play, X } from 'lucide-react';
import { Subject } from '../types';

interface AntiProcrastinationProps {
  isTimerRunning: boolean;
  setTimerSeconds: (s: number) => void;
  setIsTimerRunning: (r: boolean) => void;
  subjects: Subject[];
  setActiveSubjectId: (id: string) => void;
}

const idleStore = (() => {
  let listeners = new Set<() => void>();
  let lastActive = Date.now();
  let idleTime = 0;

  const emit = () => {
    const current = Math.floor((Date.now() - lastActive) / 1000);
    if (current !== idleTime) {
      idleTime = current;
      listeners.forEach(l => l());
    }
  };

  const reset = () => {
    lastActive = Date.now();
    emit();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', reset);
    window.addEventListener('keydown', reset);
    window.addEventListener('click', reset);
    window.addEventListener('scroll', reset);
    setInterval(emit, 1000);
  }

  return {
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSnapshot: () => idleTime,
    reset
  };
})();

export default function AntiProcrastination({
  isTimerRunning,
  setTimerSeconds,
  setIsTimerRunning,
  subjects,
  setActiveSubjectId
}: AntiProcrastinationProps) {
  const [showTrigger, setShowTrigger] = useState(false);
  const idleTime = useSyncExternalStore(idleStore.subscribe, idleStore.getSnapshot);

  useEffect(() => {
    if (!isTimerRunning && idleTime > 120 && subjects.length > 0 && !showTrigger) {
      setShowTrigger(true);
    }
    
    if (isTimerRunning && showTrigger) {
      setShowTrigger(false);
      idleStore.reset();
    }
  }, [idleTime, isTimerRunning, subjects, showTrigger]);

  const startMicroCommitment = () => {
    // Auto-pick the first subject if none active
    setActiveSubjectId(subjects[0].id);
    // Start a 5-minute timer
    setTimerSeconds(5 * 60);
    setIsTimerRunning(true);
    setShowTrigger(false);
    idleStore.reset();
  };

  return (
    <AnimatePresence>
      {showTrigger && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="fixed bottom-24 right-8 z-[100] w-80 bg-dark-surface/90 backdrop-blur-2xl border border-neon-cyan/50 rounded-2xl p-5 shadow-[0_0_40px_rgba(0,242,255,0.2)]"
        >
          <button 
            onClick={() => {
              setShowTrigger(false);
              idleStore.reset();
            }}
            className="absolute top-3 right-3 text-dark-bg-subtle hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
          
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-neon-cyan/20 rounded-full animate-pulse">
              <Zap className="text-neon-cyan" size={20} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white">Procrastination Detected</h3>
          </div>
          
          <p className="text-[10px] font-bold text-dark-bg-muted uppercase tracking-widest leading-relaxed mb-4">
            You've been inactive. The hardest part is starting. Commit to just 5 minutes right now.
          </p>

          <button
            onClick={startMicroCommitment}
            className="w-full bg-neon-cyan text-black font-black uppercase tracking-widest text-[10px] py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white transition-all shadow-[0_0_15px_rgba(0,242,255,0.4)]"
          >
            <Play size={14} fill="currentColor" />
            Start 5-Min Micro-Session
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
