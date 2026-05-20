import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, onSnapshot, query, where, getDoc } from 'firebase/firestore';
import { Subject, DailyPlan, PlanTask } from '../types';
import { Sparkles, CheckCircle2, Circle, CalendarDays, AlertCircle, Plus, LayoutGrid, CheckSquare } from 'lucide-react';
import { getGoalBreakdown, GoalTask } from '../services/aiService';
import { motion, AnimatePresence } from 'motion/react';

interface StudyPlannerProps {
  subjects: Subject[];
}

export default function StudyPlanner({ subjects }: StudyPlannerProps) {
  const [todayPlan, setTodayPlan] = useState<DailyPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  
  const [goalInput, setGoalInput] = useState('');
  const [breakingGoal, setBreakingGoal] = useState(false);
  const [brokenTasks, setBrokenTasks] = useState<GoalTask[]>([]);
  const [completedGoalTasks, setCompletedGoalTasks] = useState<Record<number, boolean>>({});

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
        missedTasks = data.tasks.filter(t => !t.completed).map(t => ({ 
          ...t, 
          durationMinutes: 60,
          subjectName: `⚠️ Review: ${t.subjectName}`
        }));
      }

      const adaptiveTasks: PlanTask[] = subjects.map(s => {
        let duration = 45;
        
        if (s.difficulty === 3) duration += 15;
        
        const mastery = s.masteryScore || 50;
        if (mastery < 45) {
          duration += 15;
        } else if (mastery > 80) {
          duration = Math.max(25, duration - 15);
        }

        return {
          subjectId: s.id,
          subjectName: s.name,
          durationMinutes: duration,
          completed: false
        };
      });

      const sortedTasks = [...adaptiveTasks].sort((a, b) => {
        const subA = subjects.find(s => s.id === a.subjectId);
        const subB = subjects.find(s => s.id === b.subjectId);
        const priorityA = subA ? subA.priority : 1;
        const priorityB = subB ? subB.priority : 1;
        const difficultyA = subA ? subA.difficulty : 1;
        const difficultyB = subB ? subB.difficulty : 1;

        if (priorityB !== priorityA) return priorityB - priorityA;
        return difficultyB - difficultyA;
      });

      const selected = sortedTasks.slice(0, 4);
      const finalTasks = [...missedTasks, ...selected].slice(0, 5);

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

  const handleBreakdownGoal = async () => {
    if (!goalInput.trim()) return;
    setBreakingGoal(true);
    try {
      const tasks = await getGoalBreakdown(goalInput, subjects);
      setBrokenTasks(tasks);
      setCompletedGoalTasks({});
    } catch (error) {
      console.error("Failed to break down goal:", error);
    } finally {
      setBreakingGoal(false);
    }
  };

  const pushTaskToDailyPlan = async (title: string, duration: number) => {
    if (!auth.currentUser || !todayPlan) return;
    const taskToAdd: PlanTask = {
      subjectId: 'ai-goal',
      subjectName: `🎯 ${title}`,
      durationMinutes: duration,
      completed: false
    };

    const newTasks = [...todayPlan.tasks, taskToAdd];
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
              <p className="text-[11px] text-orange-300/70">System idle. Break the loop: 5m of {todayPlan.tasks[0].subjectName.replace("⚠️ Review: ", "")} now.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-8 lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-neon-lime/10 rounded-lg border border-neon-lime/20">
                <CalendarDays className="text-neon-lime" size={20} />
              </div>
              <h2 className="text-xl font-black tracking-tighter uppercase italic">Daily Adaptive Plan</h2>
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
                {generating ? 'Optimizing...' : 'Generate Adaptive Plan'}
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
                  <span className="text-[10px] font-mono font-black opacity-60 uppercase tracking-widest">{task.durationMinutes}m</span>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-dark-border rounded-2xl">
              <p className="text-xs font-black text-dark-bg-dim uppercase tracking-widest mb-2">No active plan generated</p>
              {subjects.length === 0 ? (
                <p className="text-[10px] text-dark-bg-dim uppercase tracking-widest">Initialize subjects to generate your study structure.</p>
              ) : (
                <p className="text-[10px] text-dark-bg-dim uppercase tracking-widest">Press "Generate Adaptive Plan" to scale study times based on mastery and difficulty levels.</p>
              )}
            </div>
          )}
        </div>

        <div className="glass-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-neon-cyan/10 rounded-lg border border-neon-cyan/20">
                <LayoutGrid className="text-neon-cyan" size={16} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest">Goal Breakdown AI</h3>
            </div>
            
            <p className="text-[10px] text-dark-bg-subtle uppercase tracking-widest mb-4">Break major study checkpoints into actionable micro-tasks.</p>

            <div className="space-y-4">
              <input 
                type="text" 
                value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                placeholder="e.g. Finish Thermodynamics concept revision..."
                className="w-full p-3 bg-dark-bg/50 border border-dark-border rounded-xl text-dark-bg-text font-bold text-xs outline-none focus:border-neon-cyan/50 transition-all"
              />
              <button 
                onClick={handleBreakdownGoal}
                disabled={breakingGoal || !goalInput.trim()}
                className="w-full bg-neon-cyan text-black font-black py-3 rounded-xl text-[10px] uppercase tracking-widest disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(0,242,255,0.2)]"
              >
                {breakingGoal ? 'Splitting goal...' : 'Deconstruct Goal'}
              </button>
            </div>

            {brokenTasks.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-[9px] font-black text-dark-bg-subtle uppercase tracking-widest">Actionable Roadmap</p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {brokenTasks.map((t, idx) => (
                    <div key={idx} className="p-3 bg-dark-surface/50 border border-dark-border rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setCompletedGoalTasks(prev => ({ ...prev, [idx]: !prev[idx] }))}
                          className={`text-neon-cyan transition-transform ${completedGoalTasks[idx] ? 'scale-110' : ''}`}
                        >
                          {completedGoalTasks[idx] ? <CheckSquare size={14} /> : <Circle size={14} />}
                        </button>
                        <div>
                          <p className={`text-xs font-bold ${completedGoalTasks[idx] ? 'line-through opacity-50' : 'text-dark-bg-text'}`}>{t.title}</p>
                          <span className="text-[8px] font-black uppercase text-dark-bg-dim tracking-widest">{t.phase} • {t.durationMinutes}m</span>
                        </div>
                      </div>
                      
                      {todayPlan && (
                        <button 
                          onClick={() => pushTaskToDailyPlan(t.title, t.durationMinutes)}
                          title="Inject into Daily Timetable"
                          className="p-1 bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/20 text-neon-cyan rounded-md"
                        >
                          <Plus size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
