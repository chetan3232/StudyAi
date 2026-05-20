import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, onSnapshot, query, where, getDoc } from 'firebase/firestore';
import { Subject, DailyPlan, PlanTask } from '../types';
import { Sparkles, CheckCircle2, Circle, CalendarDays, AlertCircle, Plus, LayoutGrid, CheckSquare, BookOpen, Hourglass, Zap } from 'lucide-react';
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

  // Spaced Repetition Memory Revision State
  const [spacedTopics, setSpacedTopics] = useState<any[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [selectedSubId, setSelectedSubId] = useState('');
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);

  // User Profile configuration
  const [profile, setProfile] = useState<any>(null);

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

  // Load user profile
  useEffect(() => {
    if (!auth.currentUser) return;
    const userDoc = doc(db, 'users', auth.currentUser.uid);
    const unsubscribe = onSnapshot(userDoc, (snapshot) => {
      if (snapshot.exists()) {
        setProfile(snapshot.data());
      }
    });
    return unsubscribe;
  }, []);

  // Load Spaced Repetition Topics
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = collection(db, 'users', auth.currentUser.uid, 'spacedRepetition');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSpacedTopics(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'spacedRepetition'));
    return unsubscribe;
  }, []);

  const isExamModeActive = () => {
    if (!profile) return false;
    if (profile.forceExamMode) return true;
    if (profile.examDate) {
      const examTime = new Date(profile.examDate).getTime();
      const nowTime = new Date().getTime();
      const diffDays = (examTime - nowTime) / (1000 * 3600 * 24);
      return diffDays > 0 && diffDays <= 30;
    }
    return false;
  };

  const generatePlan = async () => {
    if (!auth.currentUser || subjects.length === 0) return;
    setGenerating(true);
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const yesterdayPlanDoc = await getDoc(doc(db, 'users', auth.currentUser.uid, 'plans', yesterdayStr));
      let missedTasks: PlanTask[] = [];
      let recoveryAlert = "";
      
      if (yesterdayPlanDoc.exists()) {
        const data = yesterdayPlanDoc.data() as DailyPlan;
        const uncompleted = data.tasks.filter(t => !t.completed);
        if (uncompleted.length > 0) {
          // Take the highest priority uncompleted task to tackle today
          const primaryMissed = uncompleted[0];
          missedTasks.push({
            ...primaryMissed,
            durationMinutes: Math.min(60, primaryMissed.durationMinutes + 15), // Buff study time to catch up
            subjectName: `🔄 Recovered: ${primaryMissed.subjectName.replace("⚠️ Review: ", "").replace("🔄 Recovered: ", "")}`
          });
          
          if (uncompleted.length > 1) {
            recoveryAlert = `Overload Avoided: Rescheduled ${uncompleted.length - 1} missed task(s) to tomorrow.`;
          }
        }
      }

      const examMode = isExamModeActive();

      const adaptiveTasks: PlanTask[] = subjects.map(s => {
        let duration = 45;
        
        if (s.difficulty === 3) duration += 15;
        
        const mastery = s.masteryScore || 50;
        if (mastery < 45) {
          duration += 15;
        } else if (mastery > 80) {
          duration = Math.max(25, duration - 15);
        }

        if (examMode) {
          duration = Math.round(duration * 1.25);
        }

        return {
          subjectId: s.id,
          subjectName: examMode ? `📅 Exam Prep: ${s.name}` : s.name,
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

      // Max slots increases in Exam Mode to accommodate mock papers and deep revision
      const maxTasksAllowed = examMode ? 5 : 4;
      const maxSlots = maxTasksAllowed - missedTasks.length;
      let selected = sortedTasks.slice(0, Math.max(1, maxSlots));

      if (examMode && subjects.length > 0) {
        const sortedByMastery = [...subjects].sort((a, b) => (a.masteryScore || 50) - (b.masteryScore || 50));
        const weakest = sortedByMastery[0];
        if ((weakest.masteryScore || 50) < 65) {
          selected.push({
            subjectId: 'mock-test',
            subjectName: `📝 Mock Exam: ${weakest.name} Practice`,
            durationMinutes: 45,
            completed: false
          });
        }
      }

      const finalTasks = [...missedTasks, ...selected];

      const planDoc = doc(db, 'users', auth.currentUser.uid, 'plans', todayStr);
      await setDoc(planDoc, {
        id: todayStr,
        userId: auth.currentUser.uid,
        date: todayStr,
        tasks: finalTasks,
        recoveryMessage: recoveryAlert || null,
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

  // Add Spaced Repetition Topic
  const addSpacedRepetitionTopic = async () => {
    if (!auth.currentUser || !newTopic.trim() || !selectedSubId) return;
    
    try {
      const topicRef = doc(collection(db, 'users', auth.currentUser.uid, 'spacedRepetition'));
      await setDoc(topicRef, {
        topicName: newTopic.trim(),
        subjectId: selectedSubId,
        intervalDays: 1,
        repetitions: 1,
        easinessFactor: 2.5,
        lastReviewedAt: new Date().toISOString(),
        nextReviewAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), // due in 1 day
        createdAt: new Date().toISOString()
      });
      setNewTopic('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'spacedRepetition');
    }
  };

  // SM-2 Spaced Repetition Grading algorithm
  const gradeRevisionQuality = async (topicId: string, quality: number) => {
    if (!auth.currentUser) return;
    
    const currentTopic = spacedTopics.find(t => t.id === topicId);
    if (!currentTopic) return;

    let { intervalDays, repetitions, easinessFactor } = currentTopic;

    if (quality >= 3) {
      if (repetitions === 1) {
        intervalDays = 1;
      } else if (repetitions === 2) {
        intervalDays = 4;
      } else {
        intervalDays = Math.round(intervalDays * easinessFactor);
      }
      repetitions += 1;
    } else {
      repetitions = 1;
      intervalDays = 1;
    }

    easinessFactor = easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (easinessFactor < 1.3) easinessFactor = 1.3;

    const nextReviewDate = new Date(Date.now() + intervalDays * 24 * 3600 * 1000).toISOString();

    try {
      const docRef = doc(db, 'users', auth.currentUser.uid, 'spacedRepetition', topicId);
      await setDoc(docRef, {
        intervalDays,
        repetitions,
        easinessFactor,
        lastReviewedAt: new Date().toISOString(),
        nextReviewAt: nextReviewDate
      }, { merge: true });
      setActiveReviewId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'spacedRepetition');
    }
  };

  // Check if topic is due for review today
  const isTopicDue = (nextReviewAt: string) => {
    return new Date(nextReviewAt).getTime() <= new Date().getTime();
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
        {/* Left Column: Daily Adaptive Plan & Timetable */}
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

          {/* Smart Exam Mode Active Banner */}
          {isExamModeActive() && (
            <div className="mb-4 p-4 bg-neon-pink/5 border border-neon-pink/10 rounded-2xl flex items-center gap-4 text-neon-pink shadow-[0_0_15px_rgba(255,0,127,0.05)]">
              <div className="p-2 bg-neon-pink/10 rounded-lg">
                <Zap size={20} className="animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest">Smart Exam Mode Active</p>
                <p className="text-[10px] opacity-80 uppercase tracking-widest font-bold">
                  {profile?.examDate 
                    ? `Target Milestone is in ${Math.ceil((new Date(profile.examDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24))} days! Priorities scaled for peak rehearsal.`
                    : 'Manual booster active! High intensity review & mock test tasks auto-injected.'}
                </p>
              </div>
            </div>
          )}

          {/* Auto Recovery Active Alert */}
          {todayPlan && todayPlan.recoveryMessage && (
            <div className="mb-4 p-3 bg-neon-purple/10 border border-neon-purple/20 text-neon-purple rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
              <Sparkles size={12} className="animate-pulse" />
              <span>{todayPlan.recoveryMessage}</span>
            </div>
          )}

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

        {/* Right Column: Goal Breakdown & Memory Revision sidebars */}
        <div className="space-y-6">
          {/* Goal Breakdown AI */}
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

          {/* 🧠 Memory Revision System (Spaced Repetition) */}
          <div className="glass-card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-neon-purple/10 rounded-lg border border-neon-purple/20">
                  <BookOpen className="text-neon-purple" size={16} />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest">Memory Revision Curve</h3>
              </div>
              
              <p className="text-[10px] text-dark-bg-subtle uppercase tracking-widest mb-4">Scientific recall alerts based on forgetting schedules.</p>

              {/* Add Spaced Repetition Topic form */}
              <div className="space-y-3 mb-6 p-4 bg-dark-bg/40 border border-dark-border rounded-2xl">
                <input 
                  type="text" 
                  value={newTopic}
                  onChange={e => setNewTopic(e.target.value)}
                  placeholder="Topic to commit to memory..."
                  className="w-full p-2.5 bg-dark-bg/60 border border-dark-border rounded-xl text-dark-bg-text font-bold text-xs outline-none focus:border-neon-purple/50"
                />
                
                <select
                  value={selectedSubId}
                  onChange={e => setSelectedSubId(e.target.value)}
                  className="w-full p-2.5 bg-dark-bg/60 border border-dark-border rounded-xl text-dark-bg-text font-bold text-xs outline-none focus:border-neon-purple/50"
                >
                  <option value="">Select Target Subject</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>

                <button 
                  onClick={addSpacedRepetitionTopic}
                  disabled={!newTopic.trim() || !selectedSubId}
                  className="w-full bg-neon-purple text-white font-black py-2.5 rounded-xl text-[10px] uppercase tracking-widest disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(188,19,254,0.2)]"
                >
                  Track Memory Curve
                </button>
              </div>

              {/* Revision List */}
              <div className="space-y-3">
                <p className="text-[9px] font-black text-dark-bg-subtle uppercase tracking-widest">Memory Backlog</p>
                {spacedTopics.length === 0 ? (
                  <p className="text-[9px] text-dark-bg-dim uppercase text-center py-4 font-bold tracking-widest">No active memory curves tracked</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {spacedTopics.map((topic) => {
                      const due = isTopicDue(topic.nextReviewAt);
                      const sub = subjects.find(s => s.id === topic.subjectId);
                      
                      return (
                        <div key={topic.id} className="p-3 bg-dark-surface/50 border border-dark-border rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-black text-dark-bg-text">{topic.topicName}</h4>
                              <p className="text-[9px] text-dark-bg-subtle font-black uppercase tracking-wider">{sub?.name || 'Subject'}</p>
                            </div>
                            {due ? (
                              <span className="text-[8px] bg-neon-pink/10 border border-neon-pink/20 text-neon-pink px-1.5 py-0.5 rounded font-black uppercase tracking-widest animate-pulse">Revise Due</span>
                            ) : (
                              <span className="text-[8px] bg-dark-bg/80 border border-dark-border text-dark-bg-subtle px-1.5 py-0.5 rounded font-black uppercase tracking-widest">Stable</span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-dark-bg-dim">
                            <span className="flex items-center gap-1">
                              <Hourglass size={8} /> Interval: {topic.intervalDays}d
                            </span>
                            <span>EF: {topic.easinessFactor?.toFixed(1) || '2.5'}</span>
                          </div>

                          {/* Grade recall popup trigger */}
                          {activeReviewId === topic.id ? (
                            <div className="pt-2 border-t border-dark-border/40">
                              <p className="text-[8px] font-black uppercase text-dark-bg-subtle mb-1.5">How well did you recall?</p>
                              <div className="grid grid-cols-5 gap-1">
                                {[1, 2, 3, 4, 5].map((grade) => (
                                  <button
                                    key={grade}
                                    onClick={() => gradeRevisionQuality(topic.id, grade)}
                                    className="p-1 text-[8px] font-black rounded border border-dark-border bg-dark-bg text-dark-bg-text hover:bg-neon-purple hover:text-white transition-all"
                                  >
                                    {grade}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            due && (
                              <button
                                onClick={() => setActiveReviewId(topic.id)}
                                className="w-full mt-1.5 p-1 bg-neon-purple/10 hover:bg-neon-purple/20 border border-neon-purple/20 text-neon-purple rounded text-[8px] font-black uppercase tracking-widest transition-all"
                              >
                                Log Review Quality
                              </button>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
