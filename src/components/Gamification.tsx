import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Zap, Flame, Star, Award, TrendingUp, Crown, Medal } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { UserStats, LeaderboardEntry } from '../types';

const BADGE_DEFINITIONS = [
  { id: 'first_session', icon: '🚀', name: 'First Launch', description: 'Complete your first study session', xpRequired: 1 },
  { id: 'streak_3', icon: '🔥', name: 'On Fire', description: '3-day study streak', xpRequired: 100 },
  { id: 'streak_7', icon: '💎', name: 'Diamond Focus', description: '7-day study streak', xpRequired: 300 },
  { id: 'streak_30', icon: '👑', name: 'Neural Champion', description: '30-day study streak', xpRequired: 1000 },
  { id: 'xp_500', icon: '⚡', name: 'Power Surge', description: 'Earn 500 XP', xpRequired: 500 },
  { id: 'xp_1000', icon: '🌟', name: 'Neural Elite', description: 'Earn 1,000 XP', xpRequired: 1000 },
  { id: 'xp_5000', icon: '🏆', name: 'Legendary', description: 'Earn 5,000 XP', xpRequired: 5000 },
  { id: 'level_5', icon: '🎓', name: 'Scholar', description: 'Reach Level 5', xpRequired: 4000 },
  { id: 'level_10', icon: '🧠', name: 'Neural Sage', description: 'Reach Level 10', xpRequired: 9000 },
];

function XPProgressBar({ xp, level }: { xp: number; level: number }) {
  const xpForCurrentLevel = (level - 1) * 1000;
  const xpForNextLevel = level * 1000;
  const progressXP = xp - xpForCurrentLevel;
  const rangeXP = xpForNextLevel - xpForCurrentLevel;
  const percent = Math.min(100, Math.round((progressXP / rangeXP) * 100));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-neon-cyan/10 border border-neon-cyan/20 rounded-lg">
            <Zap size={14} className="text-neon-cyan" />
          </div>
          <span className="text-xs font-black uppercase tracking-widest text-neon-cyan">Level {level}</span>
        </div>
        <span className="text-xs font-black text-dark-bg-subtle">{progressXP} / {rangeXP} XP</span>
      </div>
      <div className="h-2 bg-dark-bg/60 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple rounded-full relative"
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_8px_rgba(0,242,255,0.8)]" />
        </motion.div>
      </div>
      <p className="text-[10px] text-dark-bg-subtle text-right">{percent}% to Level {level + 1}</p>
    </div>
  );
}

function BadgeCard({ badge, unlocked }: { badge: typeof BADGE_DEFINITIONS[0]; unlocked: boolean }) {
  return (
    <motion.div
      whileHover={{ scale: unlocked ? 1.05 : 1 }}
      className={`flex flex-col items-center p-4 rounded-xl border transition-all ${
        unlocked
          ? 'bg-gradient-to-br from-neon-purple/10 to-neon-cyan/10 border-neon-purple/30 shadow-[0_0_15px_rgba(139,92,246,0.1)]'
          : 'bg-dark-bg/30 border-dark-border opacity-40 grayscale'
      }`}
    >
      <span className="text-2xl mb-2">{badge.icon}</span>
      <p className="text-[10px] font-black uppercase tracking-widest text-center text-dark-bg-text leading-tight mb-1">{badge.name}</p>
      <p className="text-[9px] text-dark-bg-subtle text-center">{badge.description}</p>
      {unlocked && (
        <div className="mt-2 px-2 py-0.5 bg-neon-lime/10 border border-neon-lime/20 rounded-full">
          <span className="text-[9px] font-black text-neon-lime uppercase">Unlocked</span>
        </div>
      )}
    </motion.div>
  );
}

function LeaderboardRow({ entry, currentUserId }: { entry: LeaderboardEntry; currentUserId: string }) {
  const isCurrentUser = entry.userId === currentUserId;
  const rankIcon = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${
        isCurrentUser
          ? 'bg-neon-cyan/10 border-neon-cyan/30 shadow-[0_0_15px_rgba(0,242,255,0.1)]'
          : 'bg-dark-bg/30 border-dark-border hover:border-dark-border/60'
      }`}
    >
      <span className="text-lg w-8 text-center shrink-0">{rankIcon}</span>
      <img
        src={entry.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.name)}&background=1a1a2e&color=00f2ff&bold=true&size=32`}
        alt={entry.name}
        className="w-8 h-8 rounded-full border border-dark-border shrink-0"
        referrerPolicy="no-referrer"
      />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-black truncate ${isCurrentUser ? 'text-neon-cyan' : 'text-dark-bg-text'}`}>
          {entry.name} {isCurrentUser && '(You)'}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px] text-dark-bg-subtle">Lv.{entry.level}</span>
          <span className="text-[9px] text-neon-purple">🔥 {entry.streak}d</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-xs font-black ${isCurrentUser ? 'text-neon-cyan' : 'text-dark-bg-text'}`}>{entry.xp.toLocaleString()} XP</p>
        <p className="text-[9px] text-dark-bg-subtle">{Math.round(entry.totalStudyMinutes / 60)}h studied</p>
      </div>
    </motion.div>
  );
}

export default function Gamification() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'badges' | 'leaderboard'>('overview');
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [hasStudiedToday, setHasStudiedToday] = useState(true);
  const [habitScore, setHabitScore] = useState(50);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      doc(db, 'users', user.uid, 'stats', 'main'),
      (snap) => {
        if (snap.exists()) setStats(snap.data() as UserStats);
        else setStats({ xp: 0, level: 1, badges: [], streak: 0, lastStudyDate: null });
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'stats')
    );
    return unsub;
  }, [user]);

  // Query logs to calculate Habit Score + Streak Miss Penalty
  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'users', user.uid, 'logs');
    const unsub = onSnapshot(q, (snap) => {
      const logsData = snap.docs.map(doc => doc.data());
      const todayStr = new Date().toISOString().split('T')[0];
      const studiedToday = logsData.some((l: any) => l.date && l.date.startsWith(todayStr));
      setHasStudiedToday(studiedToday);

      // Dynamic consistency mapping
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      });
      const activeDays = last7Days.filter(date => logsData.some((l: any) => l.date && l.date.startsWith(date))).length;
      const consistency = (activeDays / 7) * 100;
      
      const computedScore = Math.min(100, Math.round((consistency * 0.6) + (logsData.length * 2)));
      setHabitScore(computedScore);
    });
    return unsub;
  }, [user]);

  // Load leaderboard (all users' public stats)
  useEffect(() => {
    if (activeTab !== 'leaderboard') return;
    setIsLoadingLeaderboard(true);

    // Query top users by XP from a public leaderboard collection
    const q = query(
      collection(db, 'leaderboard'),
      orderBy('xp', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      const entries: LeaderboardEntry[] = snap.docs.map((d, i) => ({
        ...d.data() as LeaderboardEntry,
        userId: d.id,
        rank: i + 1,
      }));

      // If current user not in list, add them at bottom
      if (user && stats && !entries.find(e => e.userId === user.uid)) {
        entries.push({
          userId: user.uid,
          name: user.displayName || 'You',
          photoURL: user.photoURL || undefined,
          xp: stats.xp,
          level: stats.level,
          streak: stats.streak,
          totalStudyMinutes: 0,
          rank: entries.length + 1,
        });
      }

      setLeaderboard(entries);
      setIsLoadingLeaderboard(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'leaderboard');
      setIsLoadingLeaderboard(false);
    });
    return unsub;
  }, [activeTab, user, stats]);

  const unlockedBadgeIds = stats?.badges || [];
  const unlockedBadges = BADGE_DEFINITIONS.filter(b => unlockedBadgeIds.includes(b.id));
  const totalBadges = BADGE_DEFINITIONS.length;

  // Compute which badges should be unlocked based on stats
  const computedUnlocked = BADGE_DEFINITIONS.map(b => {
    if (!stats) return false;
    if (b.id === 'first_session') return stats.xp >= 1;
    if (b.id === 'streak_3') return stats.streak >= 3;
    if (b.id === 'streak_7') return stats.streak >= 7;
    if (b.id === 'streak_30') return stats.streak >= 30;
    if (b.id === 'xp_500') return stats.xp >= 500;
    if (b.id === 'xp_1000') return stats.xp >= 1000;
    if (b.id === 'xp_5000') return stats.xp >= 5000;
    if (b.id === 'level_5') return stats.level >= 5;
    if (b.id === 'level_10') return stats.level >= 10;
    return false;
  });

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'badges', label: 'Badges', icon: Award },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 p-1 bg-dark-bg/50 border border-dark-border rounded-2xl">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id
                ? 'bg-neon-purple/15 text-neon-purple border border-neon-purple/30'
                : 'text-dark-bg-subtle hover:text-dark-bg-muted'
            }`}
            id={`gamification-tab-${tab.id}`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {/* XP + Level Card */}
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-dark-bg-subtle">Neural XP</h3>
                <div className="flex items-center gap-1.5">
                  <Star size={12} className="text-neon-purple" />
                  <span className="text-xs font-black text-neon-purple">{stats?.xp?.toLocaleString() || 0} Total XP</span>
                </div>
              </div>
              <XPProgressBar xp={stats?.xp || 0} level={stats?.level || 1} />
            </div>

            {/* Smart Habit Engine Status Card */}
            <div className="glass-card p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-dark-bg-subtle mb-3">Habit Consistency</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-neon-purple italic">{habitScore}/100</span>
                  <span className="text-[10px] uppercase font-black tracking-widest text-dark-bg-subtle">Habit Score</span>
                </div>
                <div className="w-full bg-dark-bg/60 h-1.5 rounded-full overflow-hidden mt-3">
                  <div className="bg-neon-purple h-full" style={{ width: `${habitScore}%` }} />
                </div>
              </div>

              {/* Streak Protection Warning Alert */}
              <div className={`p-4 rounded-xl border flex items-center gap-3 transition-colors ${
                hasStudiedToday 
                ? 'bg-neon-lime/5 border-neon-lime/20 text-neon-lime' 
                : 'bg-neon-pink/5 border-neon-pink/20 text-neon-pink shadow-[0_0_15px_rgba(255,0,255,0.05)]'
              }`}>
                <Medal size={20} className={hasStudiedToday ? 'text-neon-lime' : 'text-neon-pink'} />
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest">
                    {hasStudiedToday ? 'Streak Protected' : 'Streak Miss Warning'}
                  </h4>
                  <p className="text-[9px] opacity-70">
                    {hasStudiedToday 
                      ? 'Study session completed today. Multiplier active.' 
                      : 'Complete a study session today to shield your daily streak score.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card p-5 flex flex-col items-center text-center">
                <Flame size={24} className="text-orange-400 mb-2" />
                <p className="text-3xl font-black text-dark-bg-text">{stats?.streak || 0}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-dark-bg-subtle mt-1">Day Streak</p>
              </div>
              <div className="glass-card p-5 flex flex-col items-center text-center">
                <Award size={24} className="text-neon-purple mb-2" />
                <p className="text-3xl font-black text-dark-bg-text">{computedUnlocked.filter(Boolean).length}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-dark-bg-subtle mt-1">
                  Badges / {totalBadges}
                </p>
              </div>
              <div className="glass-card p-5 flex flex-col items-center text-center">
                <Crown size={24} className="text-neon-cyan mb-2" />
                <p className="text-3xl font-black text-dark-bg-text">{stats?.level || 1}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-dark-bg-subtle mt-1">Level</p>
              </div>
              <div className="glass-card p-5 flex flex-col items-center text-center">
                <Medal size={24} className="text-neon-lime mb-2" />
                <p className="text-3xl font-black text-dark-bg-text">
                  #{leaderboard.findIndex(e => e.userId === user?.uid) + 1 || '—'}
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest text-dark-bg-subtle mt-1">Global Rank</p>
              </div>
            </div>

            {/* Next Milestone */}
            {stats && (
              <div className="glass-card p-5">
                <h4 className="text-xs font-black uppercase tracking-widest text-dark-bg-subtle mb-3">Next Milestones</h4>
                <div className="space-y-2">
                  {BADGE_DEFINITIONS.filter((_, i) => !computedUnlocked[i]).slice(0, 3).map(badge => (
                    <div key={badge.id} className="flex items-center gap-3 p-2 bg-dark-bg/40 rounded-lg">
                      <span className="text-lg opacity-50">{badge.icon}</span>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-dark-bg-muted">{badge.name}</p>
                        <p className="text-[10px] text-dark-bg-subtle">{badge.description}</p>
                      </div>
                      <span className="text-[10px] font-black text-neon-purple">{badge.xpRequired} XP</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Badges Tab */}
        {activeTab === 'badges' && (
          <motion.div
            key="badges"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-dark-bg-subtle">Achievement Collection</h3>
                <span className="text-xs font-black text-neon-purple">
                  {computedUnlocked.filter(Boolean).length} / {totalBadges} Unlocked
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {BADGE_DEFINITIONS.map((badge, i) => (
                  <BadgeCard key={badge.id} badge={badge} unlocked={computedUnlocked[i]} />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <Trophy size={18} className="text-neon-cyan" />
                <h3 className="text-xs font-black uppercase tracking-widest text-dark-bg-subtle">Global Leaderboard</h3>
              </div>

              {isLoadingLeaderboard ? (
                <div className="flex justify-center py-12">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="h-8 w-8 border-t-2 border-neon-purple rounded-full"
                  />
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy size={40} className="mx-auto text-dark-bg-subtle mb-3" />
                  <p className="text-sm font-bold text-dark-bg-muted">No rankings yet.</p>
                  <p className="text-xs text-dark-bg-subtle mt-1">Study to earn XP and appear here!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map(entry => (
                    <LeaderboardRow key={entry.userId} entry={entry} currentUserId={user?.uid || ''} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
