import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Subject, StudyLog } from '../types';
import { getAICoachPlan, CoachPlan } from '../services/aiService';
import { BrainCircuit, Calendar, Target, Sparkles, Loader2, ChevronRight, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AICoach() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [plan, setPlan] = useState<CoachPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubSubs = onSnapshot(
      query(collection(db, 'users', auth.currentUser.uid, 'subjects')),
      (snap) => setSubjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Subject))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'subjects')
    );

    const unsubLogs = onSnapshot(
      query(collection(db, 'users', auth.currentUser.uid, 'logs')),
      (snap) => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as StudyLog))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'logs')
    );

    return () => { unsubSubs(); unsubLogs(); };
  }, []);

  const generatePlan = async () => {
    if (subjects.length === 0) {
      setError("Please add some subjects first to generate a coaching plan.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const newPlan = await getAICoachPlan(subjects, logs);
      setPlan(newPlan);
    } catch (err) {
      setError("Failed to generate coaching plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neon-cyan/10 rounded-lg border border-neon-cyan/20">
              <BrainCircuit className="text-neon-cyan" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tighter uppercase italic">Neural Coach</h2>
              <p className="text-[10px] text-dark-bg-subtle uppercase tracking-widest mt-1">AI-Driven Performance Optimization</p>
            </div>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={generatePlan}
            disabled={loading}
            className="px-6 py-3 bg-neon-cyan text-black font-black rounded-xl flex items-center gap-2 shadow-[0_0_20px_rgba(0,242,255,0.3)] disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            {plan ? 'Recalibrate Plan' : 'Generate Neural Plan'}
          </motion.button>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-sm font-bold mb-6"
            >
              <AlertCircle size={18} />
              {error}
            </motion.div>
          )}

          {!plan && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 border-2 border-dashed border-dark-border rounded-2xl"
            >
              <BrainCircuit className="mx-auto text-dark-bg-dim mb-4" size={48} />
              <p className="text-sm font-bold text-dark-bg-subtle uppercase tracking-widest">
                Initialize your neural coaching session to receive a personalized study architecture.
              </p>
            </motion.div>
          )}

          {plan && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {/* Mastery Analysis */}
              <div className="lg:col-span-2 p-6 bg-dark-bg/30 border border-dark-border rounded-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="text-neon-lime" size={18} />
                  <h3 className="text-xs font-black uppercase tracking-widest text-neon-lime">Mastery Audit</h3>
                </div>
                <p className="text-sm text-dark-bg-text leading-relaxed font-medium italic">
                  "{plan.masteryAnalysis}"
                </p>
              </div>

              {/* Daily Schedule */}
              <div className="p-6 bg-dark-bg/30 border border-dark-border rounded-2xl">
                <div className="flex items-center gap-2 mb-6">
                  <Calendar className="text-neon-cyan" size={18} />
                  <h3 className="text-xs font-black uppercase tracking-widest text-neon-cyan">Optimized Schedule</h3>
                </div>
                <div className="space-y-4">
                  {plan.dailySchedule.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-4 p-3 bg-dark-bg/50 rounded-xl border border-dark-border/50">
                      <div className="text-[10px] font-black text-neon-cyan bg-neon-cyan/10 px-2 py-1 rounded border border-neon-cyan/20 whitespace-nowrap">
                        {item.time}
                      </div>
                      <div>
                        <p className="text-xs font-black text-dark-bg-text uppercase tracking-tight">{item.activity}</p>
                        <p className="text-[10px] text-dark-bg-subtle font-bold uppercase tracking-widest mt-0.5">{item.subject}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Priority & Recommendations */}
              <div className="space-y-6">
                <div className="p-6 bg-dark-bg/30 border border-dark-border rounded-2xl">
                  <h3 className="text-xs font-black uppercase tracking-widest text-neon-pink mb-4">Priority Focus</h3>
                  <div className="space-y-2">
                    {plan.priorityFocus.map((focus, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs font-bold text-dark-bg-text">
                        <ChevronRight size={14} className="text-neon-pink" />
                        {focus}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 bg-dark-bg/30 border border-dark-border rounded-2xl">
                  <h3 className="text-xs font-black uppercase tracking-widest text-neon-purple mb-4">Strategic Recommendations</h3>
                  <div className="space-y-3">
                    {plan.recommendations.map((rec, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-dark-bg/50 rounded-xl border border-dark-border/50">
                        <Sparkles size={14} className="text-neon-purple shrink-0 mt-0.5" />
                        <p className="text-xs font-medium text-dark-bg-text leading-relaxed">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
