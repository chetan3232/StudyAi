import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, setDoc, doc } from 'firebase/firestore';
import { StudyLog, Subject } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line } from 'recharts';
import { useSubscription } from '../contexts/SubscriptionContext';
import { TrendingUp, PieChart as PieIcon, Download, BrainCircuit, Sparkles, BookOpen, Target, ChevronRight } from 'lucide-react';
import { getDeepWeakAreaAnalysis, WeakAreaAnalysis } from '../services/aiService';
import { motion, AnimatePresence } from 'motion/react';

export default function StudyAnalytics() {
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [analysis, setAnalysis] = useState<WeakAreaAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'users', auth.currentUser.uid, 'subjects'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Subject);
      setSubjects(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'subjects'));
    return unsubscribe;
  }, []);

  const runDeepAnalysis = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    try {
      const result = await getDeepWeakAreaAnalysis(subjects, logs);
      setAnalysis(result);
    } catch (error) {
      console.error("Deep analysis failed:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  const exportReport = () => {
    const reportData = {
      totalStudyTimeMinutes: Math.round(logs.reduce((acc, l) => acc + (l.duration / 60), 0)),
      subjectBreakdown: getSubjectData(),
      dailyTrends: getDailyData(),
      generatedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `StudyAI_Report_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'users', auth.currentUser.uid, 'logs'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as StudyLog);
      setLogs(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'logs'));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!auth.currentUser || logs.length === 0) return;
    
    const saveAnalytics = async () => {
      const subjectData = getSubjectData();
      const weakAreas = subjectData
        .sort((a, b) => a.value - b.value)
        .slice(0, 2)
        .map(s => s.name);
      
      const totalMinutes = logs.reduce((acc, l) => acc + (l.duration / 60), 0);
      const performanceScore = Math.min(100, Math.round((totalMinutes / 60) * 10)); // Simple score logic

      try {
        const analyticsDoc = doc(db, 'users', auth.currentUser.uid, 'analytics', 'main');
        await setDoc(analyticsDoc, {
          performanceScore,
          weakAreas,
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error("Failed to save analytics:", error);
      }
    };

    saveAnalytics();
  }, [logs]);

  const getDailyData = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      const dayLogs = logs.filter(l => l.date.startsWith(date));
      const totalMinutes = dayLogs.reduce((acc, l) => acc + (l.duration / 60), 0);
      return {
        date: date.split('-').slice(1).join('/'),
        minutes: Math.round(totalMinutes)
      };
    });
  };

  const calculateBurnoutRisk = () => {
    const dailyData = getDailyData();
    const totalMinutes7Days = dailyData.reduce((acc, day) => acc + day.minutes, 0);
    const totalHours = totalMinutes7Days / 60;
    
    if (totalHours > 40) return { level: 'High', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', message: 'Critical overload detected. Rest immediately.' };
    if (totalHours > 25) return { level: 'Medium', color: 'text-neon-pink', bg: 'bg-neon-pink/10', border: 'border-neon-pink/20', message: 'Approaching cognitive fatigue. Schedule breaks.' };
    if (totalHours < 5) return { level: 'Low', color: 'text-dark-bg-subtle', bg: 'bg-dark-surface', border: 'border-dark-border', message: 'Low study volume. Increase intensity.' };
    return { level: 'Optimal', color: 'text-neon-lime', bg: 'bg-neon-lime/10', border: 'border-neon-lime/20', message: 'Sustainable study velocity.' };
  };

  const getSubjectData = () => {
    const subjectsMap: Record<string, number> = {};
    logs.forEach(l => {
      subjectsMap[l.subjectName] = (subjectsMap[l.subjectName] || 0) + (l.duration / 60);
    });
    return Object.entries(subjectsMap).map(([name, value]) => ({ name, value: Math.round(value) }));
  };

  const getConceptMasteryData = () => {
    return subjects.map(s => ({
      name: s.name,
      mastery: s.masteryScore || 0
    }));
  };

  const burnoutRisk = calculateBurnoutRisk();
  const COLORS = ['#00f2ff', '#bc13fe', '#39ff14', '#ff00ff', '#f59e0b'];

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button 
          onClick={exportReport}
          className="flex items-center gap-2 bg-dark-surface hover:bg-dark-border text-dark-bg-muted hover:text-dark-bg-text px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-dark-border"
        >
          <Download size={14} />
          Export Intelligence Report
        </button>
      </div>

      {/* Burnout Predictor Widget */}
      <div className={`glass-card p-6 border ${burnoutRisk.border} ${burnoutRisk.bg} flex flex-col md:flex-row items-center justify-between gap-6`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl bg-dark-bg/50 border ${burnoutRisk.border}`}>
            <BrainCircuit className={burnoutRisk.color} size={24} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-dark-bg-subtle mb-1">Burnout Predictor</h3>
            <div className="flex items-center gap-2">
              <span className={`text-xl font-black uppercase tracking-tighter ${burnoutRisk.color}`}>
                {burnoutRisk.level} Risk
              </span>
              <span className="text-xs font-medium text-dark-bg-muted hidden md:inline-block">
                — {burnoutRisk.message}
              </span>
            </div>
          </div>
        </div>
        
        <div className="h-16 w-full md:w-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={getDailyData()}>
              <Line 
                type="monotone" 
                dataKey="minutes" 
                stroke={burnoutRisk.level === 'High' ? '#ef4444' : burnoutRisk.level === 'Medium' ? '#bc13fe' : '#39ff14'} 
                strokeWidth={2} 
                dot={false} 
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-dark-bg border border-dark-border p-2 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                        {payload[0].value} mins
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-neon-cyan/10 rounded-lg border border-neon-cyan/20">
              <TrendingUp className="text-neon-cyan" size={20} />
            </div>
            <h2 className="text-xl font-black tracking-tighter uppercase italic">Study Velocity</h2>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getDailyData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: 'var(--neon-cyan)' }}
                  cursor={{ fill: 'rgba(0,242,255,0.05)' }}
                />
                <Bar dataKey="minutes" fill="#00f2ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-neon-lime/10 rounded-lg border border-neon-lime/20">
              <Target className="text-neon-lime" size={20} />
            </div>
            <h2 className="text-xl font-black tracking-tighter uppercase italic">Concept Mastery</h2>
          </div>
          <div className="h-64 w-full">
            {subjects.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs font-black text-dark-bg-dim uppercase tracking-widest">
                No subjects registered
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getConceptMasteryData()} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: 'var(--neon-lime)' }}
                    cursor={{ fill: 'rgba(57,255,20,0.05)' }}
                  />
                  <Bar dataKey="mastery" fill="#39ff14" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass-card p-8 relative overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-neon-purple/10 rounded-lg border border-neon-purple/20">
              <PieIcon className="text-neon-purple" size={20} />
            </div>
            <h2 className="text-xl font-black tracking-tighter uppercase italic">Subject Allocation</h2>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={getSubjectData()}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                  animationBegin={0}
                  animationDuration={1500}
                >
                  {getSubjectData().map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                      className="hover:opacity-80 transition-opacity cursor-pointer outline-none"
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle"
                  formatter={(value) => <span className="text-[10px] font-black uppercase tracking-widest text-dark-bg-subtle">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Deep AI Analysis Section */}
      <div className="glass-card p-8 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neon-cyan/10 rounded-lg border border-neon-cyan/20">
              <BrainCircuit className="text-neon-cyan" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tighter uppercase italic">Deep Neural Audit</h2>
              <p className="text-[10px] text-dark-bg-subtle font-bold uppercase tracking-widest">AI-Powered Cognitive Gap Analysis</p>
            </div>
          </div>
          
          <button 
            onClick={runDeepAnalysis}
            disabled={analyzing}
            className="flex items-center gap-2 bg-neon-cyan text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-[0_0_20px_rgba(0,242,255,0.2)]"
          >
            {analyzing ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                <Sparkles size={14} />
              </motion.div>
            ) : <Sparkles size={14} />}
            {analyzing ? 'Analyzing Neural Patterns...' : 'Run Deep Audit'}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {analysis ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 xl:grid-cols-3 gap-8"
            >
              <div className="xl:col-span-2 space-y-8">
                <div>
                  <h3 className="text-xs font-black text-dark-bg-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Target size={14} className="text-neon-cyan" />
                    Identified Cognitive Gaps
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysis.concepts.map((concept, i) => (
                      <div key={i} className="p-5 bg-dark-surface/50 border border-dark-border rounded-2xl hover:border-neon-cyan/30 transition-all group">
                        <h4 className="text-sm font-black text-neon-cyan mb-2 uppercase italic">{concept.name}</h4>
                        <p className="text-xs text-dark-bg-muted leading-relaxed mb-4">{concept.description}</p>
                        <div className="space-y-2">
                          <p className="text-[9px] font-black text-dark-bg-subtle uppercase tracking-widest">Recommended Resources</p>
                          {concept.resources.map((res, j) => (
                            <div key={j} className="flex items-center gap-2 text-[10px] text-dark-bg-muted group-hover:text-dark-bg-text transition-colors">
                              <ChevronRight size={10} className="text-neon-cyan" />
                              {res}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 bg-neon-purple/5 border border-neon-purple/10 rounded-2xl">
                  <h3 className="text-xs font-black text-neon-purple uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Sparkles size={14} />
                    Neural Optimization Strategy
                  </h3>
                  <p className="text-sm text-dark-bg-muted leading-relaxed italic">"{analysis.overallStrategy}"</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-dark-bg/50 border border-dark-border rounded-2xl h-full">
                  <h3 className="text-xs font-black text-dark-bg-muted uppercase tracking-widest mb-6 flex items-center gap-2">
                    <BookOpen size={14} className="text-neon-lime" />
                    Targeted Exercises
                  </h3>
                  <div className="space-y-4">
                    {analysis.targetedExercises.map((ex, i) => (
                      <div key={i} className="flex gap-3 p-3 bg-dark-surface/50 rounded-xl border border-transparent hover:border-neon-lime/20 transition-all">
                        <div className="mt-1 w-1.5 h-1.5 bg-neon-lime rounded-full shrink-0 shadow-[0_0_8px_rgba(57,255,20,0.5)]" />
                        <p className="text-xs text-dark-bg-muted leading-snug">{ex}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-dark-surface rounded-full flex items-center justify-center mb-6 border border-dark-border">
                <BrainCircuit className="text-dark-bg-dim" size={32} />
              </div>
              <p className="text-sm font-bold text-dark-bg-subtle uppercase tracking-widest">No Active Audit Found</p>
              <p className="text-[10px] text-dark-bg-dim uppercase tracking-tighter mt-2">Trigger a deep audit to map your learning trajectory.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
