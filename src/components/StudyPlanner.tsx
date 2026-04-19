import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, onSnapshot, query, where, getDoc } from 'firebase/firestore';
import { Subject, DailyPlan, PlanTask } from '../types';
import { Sparkles, CheckCircle2, Circle, CalendarDays, AlertCircle } from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';

interface StudyPlannerProps {
  subjects: Subject[];
}

export default function StudyPlanner({ subjects }: StudyPlannerProps) {
  const [todayPlan, setTodayPlan] = useState<DailyPlan | null>(null);
  const [generating, setGenerating] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!auth.currentUser) return;
    const planDoc = doc(db, 'users', auth.currentUser.uid, 'plans', todayStr);
    const unsubscribe = onSnapshot(planDoc, (snapshot) => {
      if (snapshot.exists()) {
        setTodayPlan(snapshot.data() as DailyPlan);
      } else {
        setTodayPlan(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'plans'));
    return unsubscribe;
  }, [todayStr]);

  const generatePlan = async () => {
    if (!auth.currentUser || subjects.length === 0) return;
    setGenerating(true);
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const yesterdayPlanDoc = await getDoc(doc(db, 'users', auth.currentUser.uid, 'plans', yesterdayStr));
      let missedTasks: PlanTask[] = [];
      
      if (yesterdayPlanDoc.exists()) {
        const data = yesterdayPlanDoc.data() as DailyPlan;
        missedTasks = data.tasks.filter(t => !t.completed).map(t => ({ ...t, durationMinutes: 30 }));
      }

      const sorted = [...subjects].sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.difficulty - a.difficulty;
      });

      const selected = sorted.slice(0, 4);
      const newTasks: PlanTask[] = selected.map(s => ({
        subjectId: s.id,
        subjectName: s.name,
        durationMinutes: 45,
        completed: false
      }));

      const finalTasks = [...missedTasks, ...newTasks].slice(0, 5);

      const planDoc = doc(db, 'users', auth.currentUser.uid, 'plans', todayStr);
      await setDoc(planDoc, {
        id: todayStr,
        userId: auth.currentUser.uid,
        date: todayStr,
        tasks: finalTasks,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'plans');
    } finally {
      setGenerating(false);
    }
  };

  const toggleTask = async (index: number) => {
    if (!auth.currentUser || !todayPlan) return;
    const newTasks = [...todayPlan.tasks];
    newTasks[index].completed = !newTasks[index].completed;
    
    try {
      const planDoc = doc(db, 'users', auth.currentUser.uid, 'plans', todayStr);
      await setDoc(planDoc, { 
        tasks: newTasks,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'plans');
    }
  };

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {todayPlan && todayPlan.tasks.every(t => !t.completed) && subjects.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl flex items-center gap-4"
          >
            <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400">
              <AlertCircle size={20} />
            </div>
            <div>
              <p className="text-xs font-black text-orange-400 uppercase tracking-widest">Anti-Procrastination Protocol</p>
              <p className="text-[11px] text-orange-300/70">System idle. Break the loop: 5m of {todayPlan.tasks[0].subjectName} now.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass-card p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neon-lime/10 rounded-lg border border-neon-lime/20">
              <CalendarDays className="text-neon-lime" size={20} />
            </div>
            <h2 className="text-xl font-black tracking-tighter uppercase italic">Daily Timetable</h2>
          </div>
          {!todayPlan && subjects.length > 0 && (
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={generatePlan}
              disabled={generating}
              className="flex items-center gap-2 bg-neon-lime text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(57,255,20,0.2)]"
            >
              <Sparkles size={14} />
              {generating ? 'Optimizing...' : 'Generate Architecture'}
            </motion.button>
          )}
        </div>

        {todayPlan ? (
          <div className="space-y-3">
            {todayPlan.tasks.map((task, idx) => (
              <motion.button 
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => toggleTask(idx)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all group ${
                  task.completed 
                  ? 'bg-neon-lime/5 border-neon-lime/20 text-neon-lime' 
                  : 'bg-dark-bg/50 border-dark-border text-dark-bg-muted hover:border-dark-bg-dim'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-1 rounded-md transition-colors ${task.completed ? 'bg-neon-lime/20' : 'bg-dark-surface'}`}>
                    {task.completed ? <CheckCircle2 size={16} /> : <Circle size={16} className="text-dark-bg-dim group-hover:text-neon-lime transition-colors" />}
                  </div>
                  <span className={`text-sm font-bold ${task.completed ? 'line-through opacity-50' : ''}`}>
                    {task.subjectName}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-black opacity-40 uppercase tracking-widest">{task.durationMinutes}m</span>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-dark-border rounded-2xl">
            <p className="text-xs font-black text-dark-bg-dim uppercase tracking-widest mb-2">No active plan</p>
            {subjects.length === 0 && (
              <p className="text-[10px] text-dark-bg-dim uppercase tracking-widest">Initialize subjects to begin architecture.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
