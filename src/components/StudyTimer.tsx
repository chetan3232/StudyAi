import { useState, useEffect } from 'react';
import { Subject } from '../types';
import { Play, Square, Timer as TimerIcon, ShieldAlert, Sparkles, RefreshCw, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StudyTimerProps {
  subjects: Subject[];
  timerSeconds: number;
  setTimerSeconds: (s: number) => void;
  isTimerRunning: boolean;
  setIsTimerRunning: (r: boolean) => void;
  activeSubjectId: string;
  setActiveSubjectId: (id: string) => void;
  onSave: (mood: string) => Promise<void>;
  timerMode: 'classic' | 'pomodoro' | 'manual';
  setTimerMode: (m: 'classic' | 'pomodoro' | 'manual') => void;
  pomoSession: 'study' | 'break';
  setPomoSession: (s: 'study' | 'break') => void;
}

export default function StudyTimer({ 
  subjects, 
  timerSeconds, 
  setTimerSeconds, 
  isTimerRunning, 
  setIsTimerRunning, 
  activeSubjectId, 
  setActiveSubjectId,
  onSave,
  timerMode,
  setTimerMode,
  pomoSession,
  setPomoSession
}: StudyTimerProps) {

  // Focus Modes
  const [manualMinutes, setManualMinutes] = useState(30);
  const [deepFocus, setDeepFocus] = useState(false);
  const [selectedMood, setSelectedMood] = useState<'focused' | 'tired' | 'distracted' | 'motivated'>('focused');
  const [loadWarningDismissed, setLoadWarningDismissed] = useState(false);

  // Cognitive Load Balancer Logic
  const getCognitiveLoadStatus = () => {
    if (timerMode === 'pomodoro') return 'optimal'; // Pomodoro has built-in breaks
    
    // In classic mode, over 45 minutes (2700s) = high load
    if (timerSeconds > 2700) return 'critical';
    if (timerSeconds > 1800) return 'high'; // 30 mins
    return 'optimal';
  };

  // Interval logic moved to App.tsx to ensure persistence across tabs

  const handleModeChange = (mode: 'classic' | 'pomodoro' | 'manual') => {
    if (isTimerRunning) return;
    setTimerMode(mode);
    if (mode === 'pomodoro') {
      setTimerSeconds(25 * 60);
      setPomoSession('study');
    } else {
      setTimerSeconds(0);
    }
  };

  const startTimer = () => {
    if (!activeSubjectId) return;
    setIsTimerRunning(true);
  };

  const stopTimer = async () => {
    setIsTimerRunning(false);
    setDeepFocus(false);
    await onSave(selectedMood);
  };

  const logManualSession = async () => {
    if (!activeSubjectId || manualMinutes <= 0) return;
    setTimerSeconds(manualMinutes * 60);
    // Need to trigger save with updated state
    setTimeout(() => {
      onSave(selectedMood);
    }, 100);
  };

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (timerMode === 'pomodoro') {
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getPomoProgress = () => {
    const total = pomoSession === 'study' ? 25 * 60 : 5 * 60;
    return ((total - timerSeconds) / total) * 100;
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

      {/* Cognitive Load Balancer Warning */}
      <AnimatePresence>
        {isTimerRunning && getCognitiveLoadStatus() === 'critical' && !loadWarningDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-4 left-4 right-4 z-50 p-4 bg-neon-purple/20 backdrop-blur-xl border border-neon-purple/40 rounded-xl shadow-[0_0_20px_rgba(188,19,254,0.3)] flex flex-col md:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-neon-purple/20 rounded-full animate-pulse">
                <ShieldAlert className="text-neon-purple" size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-widest">Cognitive Overload Detected</h4>
                <p className="text-[10px] font-bold text-neon-purple mt-0.5">Continuous focus &gt; 45m reduces retention by 30%. Scientifically suggested break: 10 mins.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setLoadWarningDismissed(true)}
                className="px-3 py-1.5 rounded-lg border border-dark-border text-[9px] font-black uppercase text-dark-bg-subtle hover:text-white transition-colors"
              >
                Dismiss
              </button>
              <button
                onClick={stopTimer}
                className="px-4 py-1.5 rounded-lg bg-neon-purple text-white text-[9px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(188,19,254,0.4)] hover:bg-white hover:text-neon-purple transition-all"
              >
                Take Break
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deep Focus Lock Screen Blocker Overlay */}
      <AnimatePresence>
        {isTimerRunning && deepFocus && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[9999] flex flex-col items-center justify-center p-8 backdrop-blur-md"
          >
            <motion.div 
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="text-center space-y-6 max-w-md"
            >
              <div className="w-20 h-20 bg-neon-pink/10 border border-neon-pink/20 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(255,0,255,0.2)]">
                <EyeOff className="text-neon-pink" size={36} />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-black tracking-tighter uppercase italic text-neon-pink">DEEP FOCUS ZONE</h1>
                <p className="text-[10px] text-dark-bg-subtle uppercase tracking-widest font-bold">App Lock Protocol Active. Restrict Distractions.</p>
              </div>

              <div className="text-7xl font-mono font-black text-neon-cyan tabular-nums tracking-tighter">
                {formatTime(timerSeconds)}
              </div>

              {timerMode === 'pomodoro' && (
                <div className="w-full bg-dark-surface border border-dark-border h-2 rounded-full overflow-hidden">
                  <div className="bg-neon-cyan h-full transition-all duration-1000" style={{ width: `${getPomoProgress()}%` }} />
                </div>
              )}

              <p className="text-xs text-dark-bg-muted italic">"Focus on the task at hand. Continuous attention shapes ultimate outcomes."</p>

              <button 
                onClick={() => setDeepFocus(false)}
                className="px-6 py-3 bg-dark-surface hover:bg-dark-border border border-dark-border rounded-xl text-[9px] font-black uppercase tracking-widest text-dark-bg-subtle transition-all"
              >
                Deactivate Lock Screen
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neon-cyan/10 rounded-lg border border-neon-cyan/20">
            <TimerIcon className="text-neon-cyan" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tighter uppercase italic">Study Focus Engine</h2>
            <p className="text-[9px] font-black text-dark-bg-subtle uppercase tracking-widest">Boost cognitive flow</p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex bg-dark-bg/60 p-1 border border-dark-border rounded-xl">
          <button
            onClick={() => handleModeChange('classic')}
            disabled={isTimerRunning}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
              timerMode === 'classic' ? 'bg-neon-cyan text-black' : 'text-dark-bg-subtle hover:text-dark-bg-text'
            }`}
          >
            Stopwatch
          </button>
          <button
            onClick={() => handleModeChange('pomodoro')}
            disabled={isTimerRunning}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
              timerMode === 'pomodoro' ? 'bg-neon-cyan text-black' : 'text-dark-bg-subtle hover:text-dark-bg-text'
            }`}
          >
            Pomodoro
          </button>
          <button
            onClick={() => handleModeChange('manual')}
            disabled={isTimerRunning}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
              timerMode === 'manual' ? 'bg-neon-cyan text-black' : 'text-dark-bg-subtle hover:text-dark-bg-text'
            }`}
          >
            Manual
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-dark-bg-subtle uppercase tracking-widest ml-1">Study Target</label>
            <select 
              value={activeSubjectId} 
              onChange={e => setActiveSubjectId(e.target.value)}
              disabled={isTimerRunning}
              className="w-full p-4 bg-dark-bg/50 rounded-xl text-dark-bg-text border border-dark-border focus:border-neon-cyan/50 outline-none disabled:opacity-50 font-bold text-sm transition-all"
            >
              <option value="">Select Target Subject...</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <button
              onClick={() => setDeepFocus(!deepFocus)}
              className={`w-full p-4 border rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${
                deepFocus 
                ? 'bg-neon-pink/10 border-neon-pink/30 text-neon-pink shadow-[0_0_15px_rgba(255,0,255,0.1)]' 
                : 'bg-dark-bg/50 border-dark-border text-dark-bg-subtle hover:border-dark-bg-dim'
              }`}
            >
              <ShieldAlert size={16} />
              {deepFocus ? 'Deep Focus Active' : 'Enable Deep Focus'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-dark-bg-subtle uppercase tracking-widest ml-1">Current Mood / Focus State</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { mood: 'focused', label: 'Focused', emoji: '🎯' },
              { mood: 'tired', label: 'Tired', emoji: '🥱' },
              { mood: 'distracted', label: 'Distracted', emoji: '🌀' },
              { mood: 'motivated', label: 'Motivated', emoji: '🔥' }
            ].map(m => (
              <button
                key={m.mood}
                type="button"
                onClick={() => setSelectedMood(m.mood as any)}
                className={`py-2 px-1 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 ${
                  selectedMood === m.mood
                    ? 'bg-neon-purple/10 border-neon-purple/50 text-neon-purple shadow-[0_0_10px_rgba(188,19,254,0.15)]'
                    : 'bg-dark-bg/50 border-dark-border text-dark-bg-muted hover:border-dark-bg-dim hover:text-dark-bg-text'
                }`}
              >
                <span className="text-sm">{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="text-center py-4 relative">
          {timerMode === 'manual' ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <label className="text-[10px] font-black text-dark-bg-subtle uppercase tracking-widest">Duration (Minutes)</label>
              <input 
                type="number" 
                min="1"
                value={manualMinutes}
                onChange={e => setManualMinutes(Number(e.target.value))}
                className="w-32 p-4 text-center text-3xl font-mono font-black text-neon-cyan bg-dark-bg/50 border border-dark-border rounded-xl focus:border-neon-cyan/50 outline-none transition-all"
              />
              <p className="text-[10px] font-black text-dark-bg-subtle uppercase tracking-[0.2em]">
                Past Session Entry
              </p>
            </div>
          ) : (
            <>
              {timerMode === 'pomodoro' && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-neon-purple/10 border border-neon-purple/20 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest text-neon-purple">
                  <Sparkles size={8} />
                  {pomoSession === 'study' ? 'Study Cycle (25m)' : 'Break Cycle (5m)'}
                </div>
              )}

              <motion.div 
                animate={isTimerRunning ? { scale: [1, 1.02, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-7xl font-mono font-black text-neon-cyan mb-2 tabular-nums tracking-tighter"
              >
                {formatTime(timerSeconds)}
              </motion.div>
              
              <p className="text-[10px] font-black text-dark-bg-subtle uppercase tracking-[0.2em]">
                {isTimerRunning ? 'Flow Session Active' : 'Engine Ready'}
              </p>
            </>
          )}
        </div>

        <div className="flex gap-4">
          {timerMode === 'manual' ? (
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={logManualSession}
              disabled={!activeSubjectId || manualMinutes <= 0}
              className="flex-1 bg-neon-cyan text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(0,242,255,0.2)] disabled:opacity-50 disabled:shadow-none"
            >
              <TimerIcon size={20} fill="currentColor" />
              Log Past Session
            </motion.button>
          ) : !isTimerRunning ? (
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
