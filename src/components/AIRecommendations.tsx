import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { Subject, StudyLog } from '../types';
import { getStudyRecommendations, AIRecommendation } from '../services/aiService';
import { Lightbulb, AlertCircle, Quote, RefreshCw, Lock, BellPlus } from 'lucide-react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { doc, setDoc } from 'firebase/firestore';

import { motion, AnimatePresence } from 'motion/react';

export default function AIRecommendations() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const { isPro } = useSubscription();

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const unsubSubs = onSnapshot(collection(db, 'users', auth.currentUser.uid, 'subjects'), (snap) => {
      setSubjects(snap.docs.map(d => d.data() as Subject));
    }, (error) => console.error("AIRecommendations subjects sync error:", error));

    const unsubLogs = onSnapshot(collection(db, 'users', auth.currentUser.uid, 'logs'), (snap) => {
      setLogs(snap.docs.map(d => d.data() as StudyLog));
    }, (error) => console.error("AIRecommendations logs sync error:", error));

    return () => {
      unsubSubs();
      unsubLogs();
    };
  }, []);

  const fetchRecommendations = async (force = false) => {
    if (subjects.length === 0) return;
    
    // Check cache
    const cacheKey = `ai_rec_${auth.currentUser?.uid}`;
    if (!force) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 30 * 60 * 1000) {
          setRecommendation(data);
          return;
        }
      }
    }

    setLoading(true);
    const rec = await getStudyRecommendations(subjects, logs);
    setRecommendation(rec);
    
    localStorage.setItem(cacheKey, JSON.stringify({
      data: rec,
      timestamp: Date.now()
    }));
    
    setLoading(false);
  };

  useEffect(() => {
    if (subjects.length > 0) {
      const timer = setTimeout(() => {
        fetchRecommendations();
      }, 10000); // 10 second debounce to save quota
      return () => clearTimeout(timer);
    }
  }, [subjects, logs.length]); // Only trigger when subject count or log count changes

  const handleSetReminder = async (subjectName: string) => {
    if (!auth.currentUser) return;
    try {
      const newDocRef = doc(collection(db, 'users', auth.currentUser.uid, 'reminders'));
      
      // Calculate a time 1 hour from now for the quick reminder
      const now = new Date();
      now.setHours(now.getHours() + 1);
      const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      await setDoc(newDocRef, {
        id: newDocRef.id,
        userId: auth.currentUser.uid,
        title: `Revise: ${subjectName}`,
        time: timeString,
        days: [new Date().getDay()],
        isActive: true,
        subjectId: subjects.find(s => s.name === subjectName)?.id || null
      });
      alert(`Reminder set for ${subjectName} at ${timeString}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reminders');
    }
  };

  return (
    <div className="glass-card p-8 space-y-8 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neon-cyan/10 rounded-lg border border-neon-cyan/20">
            <Lightbulb className="text-neon-cyan" size={20} />
          </div>
          <h2 className="text-xl font-black tracking-tighter uppercase italic">AI Insights</h2>
        </div>
        <motion.button 
          whileHover={{ rotate: 180 }}
          transition={{ duration: 0.5 }}
          onClick={() => fetchRecommendations(true)}
          disabled={loading}
          className="p-2 text-dark-bg-subtle hover:text-neon-cyan transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin text-neon-cyan' : ''} />
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        {loading && !recommendation ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-12"
          >
            <div className="inline-block h-8 w-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-[10px] font-black text-dark-bg-subtle uppercase tracking-[0.2em]">Analyzing Neural Patterns...</p>
          </motion.div>
        ) : recommendation ? (
          <motion.div 
            key="content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {recommendation.isFallback && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3">
                <AlertCircle className="text-amber-500" size={16} />
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">System Overload: Using Cached Intelligence</p>
              </div>
            )}

            {recommendation.weakSubjects.length > 0 && (
              <div className="p-5 bg-red-500/5 border border-red-500/10 rounded-2xl">
                <div className="flex items-center gap-2 text-red-500 mb-3">
                  <AlertCircle size={16} />
                  <span className="font-black text-[10px] uppercase tracking-widest">Critical Gaps Detected</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recommendation.weakSubjects.map(s => (
                    <span key={s} className="px-3 py-1 bg-red-500/10 rounded-full text-[10px] font-black text-red-400 uppercase tracking-tighter">{s}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 bg-dark-bg/50 border border-dark-border rounded-2xl">
                <p className="text-[9px] font-black text-dark-bg-subtle uppercase tracking-widest mb-2">Burnout Risk</p>
                <p className={`text-xl font-black tracking-tighter ${
                  recommendation.burnoutRisk === 'High' ? 'text-red-500' : 
                  recommendation.burnoutRisk === 'Medium' ? 'text-neon-pink' : 'text-neon-lime'
                }`}>
                  {recommendation.burnoutRisk}
                </p>
              </div>
              <div className="p-5 bg-dark-bg/50 border border-dark-border rounded-2xl">
                <p className="text-[9px] font-black text-dark-bg-subtle uppercase tracking-widest mb-2">Peak Performance</p>
                <p className="text-xl font-black tracking-tighter text-neon-purple">{recommendation.bestStudyTime}</p>
              </div>
            </div>

            <div className="p-5 bg-dark-bg/50 border border-dark-border rounded-2xl relative overflow-hidden">
              {!isPro && (
                <div className="absolute inset-0 bg-dark-bg/60 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center text-center">
                  <Lock className="text-neon-purple mb-1" size={12} />
                  <p className="text-[8px] font-black uppercase tracking-widest text-dark-bg-text">Pro Feature</p>
                </div>
              )}
              <p className="text-[9px] font-black text-dark-bg-subtle uppercase tracking-widest mb-3">Performance Forecast</p>
              <p className="text-xs text-dark-bg-muted leading-relaxed font-medium">{recommendation.performanceForecast}</p>
            </div>

            <div className="p-5 bg-neon-purple/5 border border-neon-purple/10 rounded-2xl relative overflow-hidden">
              {!isPro && (
                <div className="absolute inset-0 bg-dark-bg/60 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center text-center">
                  <Lock className="text-neon-purple mb-1" size={12} />
                  <p className="text-[8px] font-black uppercase tracking-widest text-dark-bg-text">Pro Feature</p>
                </div>
              )}
              <p className="text-[9px] font-black text-dark-bg-subtle uppercase tracking-widest mb-3">Mistake Pattern Analysis</p>
              <p className="text-xs text-neon-purple/80 leading-relaxed font-medium">{recommendation.mistakePattern}</p>
            </div>

            {recommendation.revisionNeeded.length > 0 && (
              <div className="p-5 bg-neon-cyan/5 border border-neon-cyan/10 rounded-2xl">
                <p className="text-[9px] font-black text-dark-bg-subtle uppercase tracking-widest mb-3">Spaced Repetition Alert</p>
                <div className="flex flex-wrap gap-2">
                  {recommendation.revisionNeeded.map(s => (
                    <div key={s} className="flex items-center bg-neon-cyan/10 rounded-full overflow-hidden border border-neon-cyan/20">
                      <span className="px-3 py-1 text-[10px] font-black text-neon-cyan uppercase tracking-tighter">{s}</span>
                      <button 
                        onClick={() => handleSetReminder(s)}
                        className="px-2 py-1 bg-neon-cyan/20 hover:bg-neon-cyan/40 text-neon-cyan transition-colors"
                        title="Set Reminder"
                      >
                        <BellPlus size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <p className="text-[9px] font-black text-dark-bg-subtle uppercase tracking-widest">Actionable Suggestions</p>
              {recommendation.suggestions.map((s, i) => (
                <div key={i} className="flex gap-4 text-xs text-dark-bg-muted font-medium leading-relaxed">
                  <div className="mt-1.5 w-1 h-1 rounded-full bg-neon-cyan shrink-0 shadow-[0_0_8px_rgba(0,242,255,0.5)]" />
                  <p>{s}</p>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-dark-border">
              <div className="flex gap-4 italic text-dark-bg-subtle text-xs font-medium">
                <Quote size={14} className="shrink-0 text-neon-cyan" />
                <p>"{recommendation.motivationQuote}"</p>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-dark-border rounded-2xl">
            <p className="text-[10px] font-black text-dark-bg-dim uppercase tracking-widest">Initialize subjects to unlock insights.</p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
