import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { StudyLog, UserProfile, UserStats } from '../types';
import { Clock, Calendar, Trophy } from 'lucide-react';

export default function QuickStats() {
  const [todayTime, setTodayTime] = useState(0);
  const [examDate, setExamDate] = useState<string | null>(null);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [stats, setStats] = useState<UserStats>({ xp: 0, level: 1, badges: [], streak: 0, lastStudyDate: null });

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch Profile for Exam Date
    const profileDoc = doc(db, 'users', auth.currentUser.uid);
    const unsubProfile = onSnapshot(profileDoc, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserProfile;
        if (data.examDate) {
          setExamDate(data.examDate);
          const diff = new Date(data.examDate).getTime() - new Date().getTime();
          setDaysLeft(Math.ceil(diff / (1000 * 60 * 60 * 24)));
        }
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    // Fetch User Stats for Streak
    const statsDoc = doc(db, 'users', auth.currentUser.uid, 'stats', 'main');
    const unsubStats = onSnapshot(statsDoc, (snapshot) => {
      if (snapshot.exists()) {
        setStats(snapshot.data() as UserStats);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'stats'));

    // Fetch Today's Logs
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const q = query(
      collection(db, 'users', auth.currentUser.uid, 'logs'),
      where('date', '>=', today.toISOString())
    );

    const unsubLogs = onSnapshot(q, (snapshot) => {
      const totalSeconds = snapshot.docs.reduce((acc, doc) => acc + (doc.data().duration || 0), 0);
      setTodayTime(totalSeconds);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'logs'));

    return () => {
      unsubProfile();
      unsubStats();
      unsubLogs();
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="space-y-4">
      <div className="glass-card p-5 flex items-center gap-5 border-neon-cyan/10">
        <div className="p-3 bg-neon-cyan/10 rounded-2xl text-neon-cyan border border-neon-cyan/20">
          <Clock size={20} />
        </div>
        <div>
          <p className="text-[10px] text-dark-bg-subtle uppercase font-black tracking-widest mb-1">Daily Runtime</p>
          <p className="text-xl font-black tracking-tighter text-dark-bg-text uppercase italic">{formatDuration(todayTime)}</p>
        </div>
      </div>

      <div className="glass-card p-5 flex items-center gap-5 border-neon-purple/10">
        <div className="p-3 bg-neon-purple/10 rounded-2xl text-neon-purple border border-neon-purple/20">
          <Calendar size={20} />
        </div>
        <div>
          <p className="text-[10px] text-dark-bg-subtle uppercase font-black tracking-widest mb-1">Target Countdown</p>
          <p className="text-xl font-black tracking-tighter text-dark-bg-text uppercase italic">
            {daysLeft !== null ? (daysLeft > 0 ? `${daysLeft} Cycles` : 'Target Reached') : 'Set Target'}
          </p>
        </div>
      </div>

      <div className="glass-card p-5 flex items-center gap-5 border-neon-lime/10">
        <div className="p-3 bg-neon-lime/10 rounded-2xl text-neon-lime border border-neon-lime/20">
          <Trophy size={20} />
        </div>
        <div>
          <p className="text-[10px] text-dark-bg-subtle uppercase font-black tracking-widest mb-1">Consistency Streak</p>
          <p className="text-xl font-black tracking-tighter text-dark-bg-text uppercase italic">{stats.streak} {stats.streak === 1 ? 'Cycle' : 'Cycles'}</p>
        </div>
      </div>
    </div>
  );
}
