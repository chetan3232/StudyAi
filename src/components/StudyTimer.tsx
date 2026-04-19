import { Subject } from '../types';
import { Play, Square, Timer as TimerIcon } from 'lucide-react';
import { motion } from 'motion/react';

interface StudyTimerProps {
  subjects: Subject[];
  timerSeconds: number;
  setTimerSeconds: (s: number) => void;
  isTimerRunning: boolean;
  setIsTimerRunning: (r: boolean) => void;
  activeSubjectId: string;
  setActiveSubjectId: (id: string) => void;
  onSave: () => Promise<void>;
}

export default function StudyTimer({ 
  subjects, 
  timerSeconds, 
  setTimerSeconds, 
  isTimerRunning, 
  setIsTimerRunning, 
  activeSubjectId, 
  setActiveSubjectId,
  onSave 
}: StudyTimerProps) {

  const startTimer = () => {
    if (!activeSubjectId) return;
    setIsTimerRunning(true);
  };

  const stopTimer = async () => {
    await onSave();
  };

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="glass-card p-8 relative overflow-hidden">
      {isTimerRunning && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-neon-cyan/5 animate-pulse pointer-events-none"
        />
      )}

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neon-cyan/10 rounded-lg border border-neon-cyan/20">
            <TimerIcon className="text-neon-cyan" size={20} />
          </div>
          <h2 className="text-xl font-black tracking-tighter uppercase italic">Study Tracker</h2>
        </div>
        {isTimerRunning && (
          <div className="flex items-center gap-2 px-3 py-1 bg-neon-purple/10 border border-neon-purple/20 rounded-full">
            <div className="w-1.5 h-1.5 bg-neon-purple rounded-full animate-pulse" />
            <span className="text-[9px] font-black text-neon-purple uppercase tracking-widest">AI Partner Active</span>
          </div>
        )}
      </div>

      <div className="space-y-8">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-dark-bg-subtle uppercase tracking-widest ml-1">Architecture / Subject</label>
          <select 
            value={activeSubjectId} 
            onChange={e => setActiveSubjectId(e.target.value)}
            disabled={isTimerRunning}
            className="w-full p-4 bg-dark-bg/50 rounded-xl text-dark-bg-text border border-dark-border focus:border-neon-cyan/50 outline-none disabled:opacity-50 font-bold text-sm transition-all"
          >
            <option value="">Select Target...</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="text-center py-4">
          <motion.div 
            animate={isTimerRunning ? { scale: [1, 1.02, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-7xl font-mono font-black text-neon-cyan mb-2 tabular-nums tracking-tighter"
          >
            {formatTime(timerSeconds)}
          </motion.div>
          <p className="text-[10px] font-black text-dark-bg-subtle uppercase tracking-[0.2em]">
            {isTimerRunning ? 'System Active' : 'System Standby'}
          </p>
        </div>

        <div className="flex gap-4">
          {!isTimerRunning ? (
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={startTimer}
              disabled={!activeSubjectId}
              className="flex-1 bg-neon-cyan text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(0,242,255,0.2)] disabled:opacity-50 disabled:shadow-none"
            >
              <Play size={20} fill="currentColor" />
              Initialize Session
            </motion.button>
          ) : (
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={stopTimer}
              className="flex-1 bg-red-500 text-dark-bg-text font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)]"
            >
              <Square size={20} fill="currentColor" />
              Terminate & Log
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
