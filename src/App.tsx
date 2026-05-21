import { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { db, auth, login, logout, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDocFromServer, setDoc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Subject } from './types';
import { SubscriptionProvider, useSubscription } from './contexts/SubscriptionContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import MetricsTracker from './components/MetricsTracker';
import ErrorBoundary from './components/ErrorBoundary';
import { LayoutDashboard, Settings, LogOut, GraduationCap, BarChart3, MessageCircle, BookOpen, Users, Wifi, WifiOff, Zap, Sun, Moon, Coffee, ArrowRight, Shield, Cpu, BrainCircuit, Bell, Menu, Square, RefreshCw, Cloud, Mic, Trophy, Bot } from 'lucide-react';
import AntiProcrastination from './components/AntiProcrastination';

// Lazy load components
const SubjectManager = lazy(() => import('./components/SubjectManager'));
const ProfileSetup = lazy(() => import('./components/ProfileSetup'));
const StudyTimer = lazy(() => import('./components/StudyTimer'));
const QuickStats = lazy(() => import('./components/QuickStats'));
const StudyPlanner = lazy(() => import('./components/StudyPlanner'));
const StudyAnalytics = lazy(() => import('./components/StudyAnalytics'));
const AIRecommendations = lazy(() => import('./components/AIRecommendations'));
const AIMentor = lazy(() => import('./components/AIMentor'));
const AICoach = lazy(() => import('./components/AICoach'));
const ContentIntelligence = lazy(() => import('./components/ContentIntelligence'));
const TestGenerator = lazy(() => import('./components/TestGenerator'));
const Community = lazy(() => import('./components/Community'));
const RemindersManager = lazy(() => import('./components/RemindersManager'));
const VoiceLogger = lazy(() => import('./components/VoiceLogger'));
const Gamification = lazy(() => import('./components/Gamification'));
const AIChatTutor = lazy(() => import('./components/AIChatTutor'));

const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-12">
    <motion.div 
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className="h-8 w-8 border-t-2 border-b-2 border-neon-cyan rounded-full"
    />
  </div>
);

export default function App() {
  return (
    <ThemeProvider>
      <SubscriptionProvider>
        <AppContent />
      </SubscriptionProvider>
    </ThemeProvider>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  return (
    <div className="flex items-center gap-1 p-1 bg-dark-bg/50 border border-dark-border rounded-xl">
      {[
        { id: 'dark', icon: Moon, color: 'text-neon-purple' },
        { id: 'light', icon: Sun, color: 'text-neon-cyan' },
        { id: 'warm', icon: Coffee, color: 'text-neon-pink' },
      ].map((t) => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id as any)}
          className={`p-2 rounded-lg transition-all ${
            theme === t.id 
            ? `bg-white/10 ${t.color} shadow-lg` 
            : 'text-dark-bg-subtle hover:text-dark-bg-muted'
          }`}
        >
          <t.icon size={14} />
        </button>
      ))}
    </div>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'subjects' | 'analytics' | 'coach' | 'learning' | 'community' | 'reminders' | 'settings' | 'voice' | 'gamification' | 'tutor'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [forceOffline, setForceOffline] = useState(false);
  const [hasPendingWrites, setHasPendingWrites] = useState(false);
  const { tier, isPro } = useSubscription();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Persistent Timer State
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [activeSubjectId, setActiveSubjectId] = useState<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  const updateUserStats = async (durationSeconds: number) => {
    if (!user) return;
    const statsDoc = doc(db, 'users', user.uid, 'stats', 'main');
    const statsSnap = await getDoc(statsDoc);
    
    const xpGained = Math.floor(durationSeconds / 60); // 1 XP per minute
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (statsSnap.exists()) {
      const currentStats = statsSnap.data();
      let newStreak = currentStats.streak || 0;
      const lastStudyDate = currentStats.lastStudyDate;

      if (lastStudyDate === yesterdayStr) {
        newStreak += 1;
      } else if (lastStudyDate !== today) {
        newStreak = 1;
      }

      const newXP = (currentStats.xp || 0) + xpGained;
      const newLevel = Math.floor(newXP / 1000) + 1;

      await setDoc(statsDoc, {
        xp: newXP,
        level: newLevel,
        streak: newStreak,
        lastStudyDate: today,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } else {
      await setDoc(statsDoc, {
        xp: xpGained,
        level: 1,
        streak: 1,
        lastStudyDate: today,
        badges: [],
        updatedAt: new Date().toISOString()
      });
    }
  };

  const saveStudyLog = async (mood?: string) => {
    if (timerSeconds < 1 || !activeSubjectId || !user) {
      setIsTimerRunning(false);
      setTimerSeconds(0);
      setActiveSubjectId('');
      return;
    }
    
    const subject = subjects.find(s => s.id === activeSubjectId);
    if (!subject) return;

    try {
      const logRef = doc(collection(db, 'users', user.uid, 'logs'));
      await setDoc(logRef, {
        id: logRef.id,
        userId: user.uid,
        subjectId: subject.id,
        subjectName: subject.name,
        duration: timerSeconds,
        date: new Date().toISOString(),
        ...(mood ? { mood } : {})
      });
      
      await updateUserStats(timerSeconds);
      
      setTimerSeconds(0);
      setIsTimerRunning(false);
      setActiveSubjectId('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'logs');
    }
  };

  const effectiveOnline = isOnline && !forceOffline;

  useEffect(() => {
    // Robust Real-time Connectivity Check
    const unsub = onSnapshot(doc(db, 'system_status', 'probe'), { includeMetadataChanges: true }, (snap) => {
      const online = !snap.metadata.fromCache;
      console.log("Neural Link Status Update:", online ? "ONLINE" : "OFFLINE");
      setIsOnline(online);
      setHasPendingWrites(snap.metadata.hasPendingWrites);
    }, (error) => {
      console.warn("Neural Link Probe Error:", error);
      // If we get a permission error, it still means we reached the server
      if (error.code !== 'permission-denied') {
        setIsOnline(false);
      } else {
        setIsOnline(true);
      }
    });
    
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
    
    return () => {
      unsub();
      window.removeEventListener('online', () => setIsOnline(true));
      window.removeEventListener('offline', () => setIsOnline(false));
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const [toasts, setToasts] = useState<{id: string, title: string, message: string, type: 'info' | 'success' | 'warning'}[]>([]);

  const addToast = (title: string, message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 10000);
  };

  // Background Reminder Checker
  useEffect(() => {
    if (!user) return;
    
    // We need to fetch reminders to check them
    let activeReminders: any[] = [];
    const q = query(collection(db, 'users', user.uid, 'reminders'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      activeReminders = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((r: any) => r.isActive);
    }, (error) => {
      console.error("Reminders sync error:", error);
    });

    const checkReminders = () => {
      const now = new Date();
      const currentDay = now.getDay();
      const currentHours = now.getHours().toString().padStart(2, '0');
      const currentMinutes = now.getMinutes().toString().padStart(2, '0');
      const currentTimeString = `${currentHours}:${currentMinutes}`;

      activeReminders.forEach(reminder => {
        if (reminder.days.includes(currentDay) && reminder.time === currentTimeString) {
          // Check if we already notified this minute to prevent spam
          const lastNotified = localStorage.getItem(`notified_${reminder.id}`);
          if (lastNotified !== currentTimeString) {
            // Always show in-app toast
            addToast('Study Reminder', `Time for: ${reminder.title}`, 'info');

            if ('Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification('StudyAI Reminder', {
                  body: `Time for: ${reminder.title}`,
                  icon: '/favicon.ico'
                });
              } catch (e) {
                console.warn("Notification failed:", e);
              }
            }
            localStorage.setItem(`notified_${reminder.id}`, currentTimeString);
          }
        }
      });
    };

    const interval = setInterval(checkReminders, 15000); // Check every 15 seconds for better accuracy
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSubjects([]);
      return;
    }
    const q = query(collection(db, 'users', user.uid, 'subjects'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
      setSubjects(subs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'subjects'));
    return unsubscribe;
  }, [user]);

  if (loading) return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="h-12 w-12 border-t-2 border-b-2 border-neon-cyan rounded-full"
      />
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-dark-bg text-dark-bg-text selection:bg-neon-cyan/30 overflow-x-hidden">
        <MetricsTracker />
        
        {/* Navbar */}
        <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between backdrop-blur-md border-b border-dark-border/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-neon-cyan/10 rounded-lg border border-neon-cyan/20">
              <GraduationCap size={20} className="text-neon-cyan" />
            </div>
            <span className="text-lg font-black tracking-tighter uppercase italic text-dark-bg-text">StudyAI</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {/* Navigation links removed as requested */}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:block">
              <ThemeToggle />
            </div>
            <div className="hidden sm:block premium-badge">Neural Premium</div>
            <button 
              onClick={login}
              className="text-[10px] font-black uppercase tracking-widest text-dark-bg-muted hover:text-neon-cyan transition-colors"
            >
              Sign In
            </button>
            <button 
              onClick={login}
              className="bg-dark-surface text-dark-bg-text px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg border border-dark-border"
            >
              Launch App
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <main className="pt-32 pb-20 px-6 flex flex-col items-center text-center relative">
          {/* Background Glows */}
          <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[60%] h-[40%] bg-neon-cyan/5 blur-[120px] rounded-full -z-10" />
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-4xl"
          >
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.9] mb-8">
              <span className="block text-dark-bg-text">Build your friend.</span>
              <span className="block text-neon-cyan italic">Design your world.</span>
            </h1>
            
            <p className="text-sm md:text-base text-dark-bg-muted font-medium max-w-xl mx-auto mb-12 leading-relaxed">
              Experience the next evolution of cognitive partnership. <br className="hidden md:block" />
              A neural study architect that grows, adapts, and evolves with your ambition.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={login}
                className="group w-full sm:w-auto bg-dark-surface text-dark-bg-text px-8 py-4 rounded-full text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-2xl border border-dark-border"
              >
                Try the Demo
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>

          {/* Floating Feature Cards */}
          <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full">
            {[
              { icon: BrainCircuit, title: 'Neural Core', desc: 'Predictive analytics that map your learning trajectory.' },
              { icon: Shield, title: 'Secure Link', desc: 'End-to-end encrypted cognitive data storage.' },
              { icon: Cpu, title: 'Edge Logic', desc: 'Real-time processing for instant study insights.' }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="glass-card p-8 text-left group hover:border-neon-cyan/30 transition-all"
              >
                <div className="p-3 bg-neon-cyan/10 rounded-xl border border-neon-cyan/20 w-fit mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon size={20} className="text-neon-cyan" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest mb-2 text-dark-bg-text">{feature.title}</h3>
                <p className="text-xs text-dark-bg-muted leading-relaxed font-medium">{feature.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Stats Section */}
          <div className="mt-32 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl w-full border-y border-dark-border/30 py-16">
            {[
              { label: 'Neural Nodes', value: '1.2M+' },
              { label: 'Cognitive Syncs', value: '450K' },
              { label: 'Success Rate', value: '98.2%' },
              { label: 'Edge Latency', value: '12ms' }
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl md:text-4xl font-black text-dark-bg-text tracking-tighter mb-1">{stat.value}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-dark-bg-subtle">{stat.label}</p>
              </div>
            ))}
          </div>
        </main>

        {/* Footer */}
        <footer className="py-12 border-t border-dark-border/50 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-dark-bg-muted">
            © 2026 Neural Systems Corporation. All rights reserved.
          </p>
        </footer>
        {/* Toast Notifications */}
        <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
          <AnimatePresence>
            {toasts.map(toast => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.9 }}
                className="pointer-events-auto w-80 glass-card p-4 border-neon-cyan/30 shadow-2xl flex items-start gap-3"
              >
                <div className={`p-2 rounded-lg ${
                  toast.type === 'success' ? 'bg-neon-lime/10 text-neon-lime' :
                  toast.type === 'warning' ? 'bg-neon-pink/10 text-neon-pink' :
                  'bg-neon-cyan/10 text-neon-cyan'
                }`}>
                  <Bell size={16} />
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-black uppercase tracking-widest text-dark-bg-text">{toast.title}</h4>
                  <p className="text-[11px] font-medium text-dark-bg-subtle mt-1">{toast.message}</p>
                </div>
                <button 
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                  className="text-dark-bg-dim hover:text-dark-bg-text transition-colors"
                >
                  <Square size={12} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg text-dark-bg-text flex font-sans">
      {/* Mobile Sidebar Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.aside 
            initial={{ width: 0, opacity: 0, x: -50 }}
            animate={{ width: 256, opacity: 1, x: 0 }}
            exit={{ width: 0, opacity: 0, x: -50 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="w-64 bg-dark-surface/95 md:bg-dark-surface/80 backdrop-blur-xl border-r border-dark-border flex flex-col fixed md:sticky top-0 left-0 h-screen z-50 shrink-0 overflow-hidden shadow-2xl md:shadow-none"
          >
            <div className="p-6 w-64 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-neon-cyan/10 rounded-lg border border-neon-cyan/20">
                    <GraduationCap size={24} className="text-neon-cyan" />
                  </div>
                  <span className="text-xl font-black tracking-tighter uppercase italic text-dark-bg-text">StudyAI</span>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 text-dark-bg-subtle hover:text-neon-cyan transition-colors"
                >
                  <Menu size={20} />
                </button>
              </div>

              <div className="mb-6">
                <ThemeToggle />
              </div>

          <div className="mb-4 px-4 py-3 rounded-xl bg-gradient-to-br from-neon-purple/20 to-neon-cyan/20 border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={14} className={isPro ? "text-neon-lime" : "text-dark-bg-subtle"} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${isPro ? "text-neon-lime" : "text-dark-bg-subtle"}`}>
                {isPro ? "Neural Pro Active" : "Neural Free"}
              </span>
            </div>
            {!isPro && (
              <button 
                onClick={() => setActiveTab('settings')}
                className="text-[9px] font-black text-neon-cyan uppercase hover:underline"
              >
                Upgrade
              </button>
            )}
          </div>

          <div 
            onClick={() => setForceOffline(!forceOffline)}
            className="mb-6 px-4 py-2 rounded-lg bg-dark-bg/50 border border-dark-border flex items-center justify-between cursor-pointer hover:bg-dark-surface/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {effectiveOnline ? (
                <Wifi size={12} className="text-neon-lime" />
              ) : (
                <WifiOff size={12} className="text-red-500" />
              )}
              <span className={`text-[10px] font-black uppercase tracking-widest ${effectiveOnline ? 'text-neon-lime' : 'text-red-500'}`}>
                {effectiveOnline ? 'Neural Link Active' : 'Offline Mode'}
              </span>
            </div>
            {!effectiveOnline && (
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            )}
          </div>
          
          <nav className="space-y-1">
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
              { id: 'subjects', icon: GraduationCap, label: 'Subjects' },
              { id: 'analytics', icon: BarChart3, label: 'Analytics' },
              { id: 'coach', icon: MessageCircle, label: 'AI Mentor' },
              { id: 'tutor', icon: Bot, label: 'AI Tutor' },
              { id: 'learning', icon: BookOpen, label: 'AI Learning' },
              { id: 'voice', icon: Mic, label: 'Voice Logger' },
              { id: 'gamification', icon: Trophy, label: 'Rewards' },
              { id: 'community', icon: Users, label: 'Community' },
              { id: 'reminders', icon: Bell, label: 'Reminders' },
              { id: 'settings', icon: Settings, label: 'Settings' },
            ].map((item) => (
              <button 
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  activeTab === item.id 
                  ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 shadow-[0_0_15px_rgba(0,242,255,0.1)]' 
                  : 'text-dark-bg-subtle hover:text-dark-bg-muted hover:bg-dark-surface/50'
                }`}
              >
                <item.icon size={20} className={activeTab === item.id ? 'text-neon-cyan' : 'group-hover:text-neon-cyan transition-colors'} />
                <span className="font-bold text-sm">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-dark-border w-64">
          <div className="flex items-center gap-3 mb-4 p-2 rounded-xl bg-dark-surface/50 border border-dark-border">
            <img src={user.photoURL || ''} alt="" className="w-9 h-9 rounded-full border border-dark-border" referrerPolicy="no-referrer" />
            <div className="overflow-hidden">
              <p className="font-bold text-xs truncate">{user.displayName}</p>
              <div className="flex items-center gap-1">
                <div className={`w-1 h-1 rounded-full animate-pulse ${isOnline ? 'bg-neon-lime' : 'bg-red-500'}`} />
                <p className={`text-[9px] font-black uppercase tracking-widest ${isOnline ? 'text-neon-lime' : 'text-red-500'}`}>
                  {isOnline ? 'Neural Link Active' : 'Neural Link Offline'}
                </p>
              </div>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/5 hover:bg-red-500/10 text-red-500/50 hover:text-red-500 rounded-xl transition-all text-xs font-bold border border-red-500/10"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative h-screen">
        {/* Header with Toggle */}
        <div className="flex items-center gap-4 mb-4 md:mb-8">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className={`p-3 bg-dark-surface/80 backdrop-blur-xl border border-dark-border rounded-xl text-dark-bg-text hover:text-neon-cyan transition-colors z-30 ${isSidebarOpen ? 'hidden' : 'block'}`}
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Ambient Glow */}
        <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-neon-cyan/5 blur-[150px] pointer-events-none" />
        
        <div className="max-w-6xl mx-auto relative z-10">
          <AnimatePresence>
            {isTimerRunning && activeTab !== 'dashboard' && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="fixed bottom-8 right-8 z-50 glass-card p-4 border-neon-cyan/30 shadow-[0_0_30px_rgba(0,242,255,0.15)] flex items-center gap-4"
              >
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-neon-cyan uppercase tracking-widest">Active Session</span>
                  <span className="text-xl font-mono font-black text-dark-bg-text tabular-nums">
                    {Math.floor(timerSeconds / 3600).toString().padStart(2, '0')}:
                    {Math.floor((timerSeconds % 3600) / 60).toString().padStart(2, '0')}:
                    {(timerSeconds % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                <button 
                  onClick={saveStudyLog}
                  className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all border border-red-500/20"
                  title="Terminate & Log"
                >
                  <Square size={16} fill="currentColor" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Anti-Procrastination Engine */}
          <AntiProcrastination 
            isTimerRunning={isTimerRunning}
            setTimerSeconds={setTimerSeconds}
            setIsTimerRunning={setIsTimerRunning}
            subjects={subjects}
            setActiveSubjectId={setActiveSubjectId}
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={<LoadingSpinner />}>
                {activeTab === 'dashboard' && (
                  <ErrorBoundary>
                    <div className="space-y-10">
                      <header className="flex flex-col gap-1">
                        <h2 className="text-4xl font-black tracking-tighter">Welcome, {user.displayName?.split(' ')[0]}</h2>
                        <p className="text-dark-bg-subtle font-medium">Your study OS is optimized and ready.</p>
                      </header>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-8 space-y-8">
                          <StudyTimer 
                            subjects={subjects} 
                            timerSeconds={timerSeconds}
                            setTimerSeconds={setTimerSeconds}
                            isTimerRunning={isTimerRunning}
                            setIsTimerRunning={setIsTimerRunning}
                            activeSubjectId={activeSubjectId}
                            setActiveSubjectId={setActiveSubjectId}
                            onSave={saveStudyLog}
                          />
                          <StudyPlanner 
                            subjects={subjects} 
                            setActiveSubjectId={setActiveSubjectId}
                            setTimerSeconds={setTimerSeconds}
                            setIsTimerRunning={setIsTimerRunning}
                          />
                        </div>
                        <div className="lg:col-span-4 space-y-8">
                          <ProfileSetup />
                          <QuickStats />
                          <AIRecommendations />
                        </div>
                      </div>
                    </div>
                  </ErrorBoundary>
                )}

                {activeTab === 'subjects' && (
                  <ErrorBoundary>
                    <div className="space-y-8">
                      <header>
                        <h2 className="text-4xl font-black tracking-tighter">Subjects</h2>
                        <p className="text-dark-bg-subtle font-medium">Curriculum architecture.</p>
                      </header>
                      <SubjectManager />
                    </div>
                  </ErrorBoundary>
                )}

                {activeTab === 'analytics' && (
                  <ErrorBoundary>
                    <div className="space-y-8">
                      <header>
                        <h2 className="text-4xl font-black tracking-tighter">Analytics</h2>
                        <p className="text-dark-bg-subtle font-medium">Performance metrics & trends.</p>
                      </header>
                      <StudyAnalytics />
                    </div>
                  </ErrorBoundary>
                )}

                {activeTab === 'coach' && (
                  <ErrorBoundary>
                    <div className="space-y-8">
                      <header>
                        <h2 className="text-4xl font-black tracking-tighter italic uppercase">Neural Coaching</h2>
                        <p className="text-dark-bg-subtle font-medium">Personalized study architecture & strategic mentorship.</p>
                      </header>
                      <AICoach />
                      <div className="pt-10 border-t border-dark-border">
                        <h3 className="text-xl font-black tracking-tighter uppercase italic mb-6">Strategic Mentor</h3>
                        <AIMentor />
                      </div>
                    </div>
                  </ErrorBoundary>
                )}

                {activeTab === 'learning' && (
                  <ErrorBoundary>
                    <div className="space-y-8">
                      <header>
                        <h2 className="text-4xl font-black tracking-tighter">AI Learning</h2>
                        <p className="text-dark-bg-subtle font-medium">Deep learning acceleration tools.</p>
                      </header>
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        <ContentIntelligence subjects={subjects} />
                        <TestGenerator subjects={subjects} />
                      </div>
                    </div>
                  </ErrorBoundary>
                )}

                {activeTab === 'community' && (
                  <ErrorBoundary>
                    <div className="space-y-8">
                      <header>
                        <h2 className="text-4xl font-black tracking-tighter italic uppercase">Neural Collectives</h2>
                        <p className="text-dark-bg-subtle font-medium">Collaborative growth, shared objectives & real-time communication.</p>
                      </header>
                      <Community />
                    </div>
                  </ErrorBoundary>
                )}

                {activeTab === 'reminders' && (
                  <ErrorBoundary>
                    <div className="space-y-8">
                      <header>
                        <h2 className="text-4xl font-black tracking-tighter">Reminders</h2>
                        <p className="text-dark-bg-subtle font-medium">Schedule and manage your study sessions.</p>
                      </header>
                      <RemindersManager />
                    </div>
                  </ErrorBoundary>
                )}

                {activeTab === 'tutor' && (
                  <ErrorBoundary>
                    <div className="space-y-8">
                      <header>
                        <h2 className="text-4xl font-black tracking-tighter italic uppercase">AI Tutor</h2>
                        <p className="text-dark-bg-subtle font-medium">Your personal NeuralTutor — ask anything, anytime.</p>
                      </header>
                      <AIChatTutor subjects={subjects} />
                    </div>
                  </ErrorBoundary>
                )}

                {activeTab === 'voice' && (
                  <ErrorBoundary>
                    <div className="space-y-8">
                      <header>
                        <h2 className="text-4xl font-black tracking-tighter">Voice Logger</h2>
                        <p className="text-dark-bg-subtle font-medium">Log your study sessions hands-free with AI.</p>
                      </header>
                      <VoiceLogger subjects={subjects} />
                    </div>
                  </ErrorBoundary>
                )}

                {activeTab === 'gamification' && (
                  <ErrorBoundary>
                    <div className="space-y-8">
                      <header>
                        <h2 className="text-4xl font-black tracking-tighter">Rewards & Ranks</h2>
                        <p className="text-dark-bg-subtle font-medium">Streaks, badges, XP — your study game.</p>
                      </header>
                      <Gamification />
                    </div>
                  </ErrorBoundary>
                )}

                {activeTab === 'settings' && (
                  <ErrorBoundary>
                    <div className="space-y-8">
                      <header>
                        <h2 className="text-4xl font-black tracking-tighter">Settings</h2>
                        <p className="text-dark-bg-subtle font-medium">System preferences.</p>
                      </header>
                      <div className="glass-card p-8 space-y-8">
                        <div>
                          <h3 className="text-lg font-black uppercase tracking-widest mb-4">Network Settings</h3>
                          <div className="flex items-center justify-between p-4 bg-dark-bg/50 border border-dark-border rounded-xl">
                            <div>
                              <p className="font-bold text-sm">Force Offline Mode</p>
                              <p className="text-xs text-dark-bg-subtle mt-1">Simulate network disconnection to test local caching and persistence.</p>
                            </div>
                            <button 
                              onClick={() => setForceOffline(!forceOffline)}
                              className={`w-12 h-6 rounded-full transition-colors relative ${forceOffline ? 'bg-red-500' : 'bg-dark-surface border border-dark-border'}`}
                            >
                              <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${forceOffline ? 'left-7' : 'left-1'}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </ErrorBoundary>
                )}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
