import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '../types';

import { Zap, ShieldCheck } from 'lucide-react';
import { useSubscription } from '../contexts/SubscriptionContext';

export default function ProfileSetup() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [examDate, setExamDate] = useState('');
  const [targetExam, setTargetExam] = useState('');
  const [forceExamMode, setForceExamMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const { tier, isPro } = useSubscription();

  useEffect(() => {
    if (!auth.currentUser) return;
    const userDoc = doc(db, 'users', auth.currentUser.uid);
    const unsubscribe = onSnapshot(userDoc, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserProfile;
        setProfile(data);
        setExamDate(data.examDate || '');
        setTargetExam(data.targetExam || '');
        setForceExamMode(data.forceExamMode || false);
      } else {
        // Initialize profile if it doesn't exist
        const initialProfile: UserProfile = {
          uid: auth.currentUser.uid,
          name: auth.currentUser.displayName || 'User',
          email: auth.currentUser.email || 'no-email@example.com',
          subscriptionTier: 'free'
        };
        setDoc(userDoc, initialProfile).catch(e => handleFirestoreError(e, OperationType.CREATE, 'users'));
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));
    return unsubscribe;
  }, []);

  const saveProfile = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        examDate,
        targetExam,
        forceExamMode
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setSaving(false);
    }
  };

  const upgradeToPro = async () => {
    if (!auth.currentUser) return;
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        subscriptionTier: 'pro'
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  return (
    <div className="glass-card p-6">
      <h2 className="text-xs font-black uppercase tracking-widest mb-6 text-dark-bg-subtle italic">Profile Configuration</h2>
      <div className="flex flex-col gap-6">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-dark-bg-dim mb-2">Target Goal / Exam (e.g., NEET, UPSC, SAT)</label>
          <input 
            type="text" 
            value={targetExam} 
            onChange={e => setTargetExam(e.target.value)} 
            placeholder="Enter your main goal..."
            className="w-full p-4 bg-dark-bg/50 border border-dark-border rounded-xl text-dark-bg-text font-bold text-sm outline-none focus:border-neon-cyan/50 transition-all mb-4"
          />
          <label className="block text-[10px] font-black uppercase tracking-widest text-dark-bg-dim mb-2">Target Milestone Date</label>
          <input 
            type="date" 
            value={examDate} 
            onChange={e => setExamDate(e.target.value)} 
            className="w-full p-4 bg-dark-bg/50 border border-dark-border rounded-xl text-dark-bg-text font-bold text-sm outline-none focus:border-neon-cyan/50 transition-all mb-4"
          />

          <div className="flex items-center justify-between p-4 bg-neon-pink/5 border border-neon-pink/10 rounded-xl">
            <div>
              <p className="text-xs font-black text-neon-pink uppercase tracking-widest">Smart Exam Mode Boost</p>
              <p className="text-[10px] text-dark-bg-muted font-bold">Forces high-intensity preparation & exam priority.</p>
            </div>
            <button
              type="button"
              onClick={() => setForceExamMode(!forceExamMode)}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${forceExamMode ? 'bg-neon-pink' : 'bg-dark-bg border border-dark-border'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${forceExamMode ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
        <button 
          onClick={saveProfile} 
          disabled={saving}
          className="w-full bg-neon-cyan text-black font-black py-3 rounded-xl text-[10px] uppercase tracking-widest disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(0,242,255,0.2)]"
        >
          {saving ? 'Syncing...' : 'Update Protocol'}
        </button>

        <div className="pt-6 border-t border-dark-border">
          <h3 className="text-[10px] font-black uppercase tracking-widest mb-4 text-dark-bg-subtle">Neural Subscription</h3>
          <div className={`p-4 rounded-xl border ${isPro ? 'bg-neon-lime/5 border-neon-lime/20' : 'bg-dark-surface/50 border-dark-border'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isPro ? 'bg-neon-lime/10' : 'bg-dark-bg-subtle/10'}`}>
                  {isPro ? <ShieldCheck className="text-neon-lime" size={16} /> : <Zap className="text-dark-bg-subtle" size={16} />}
                </div>
                <div>
                  <p className={`text-xs font-black uppercase tracking-tighter ${isPro ? 'text-neon-lime' : 'text-dark-bg-muted'}`}>
                    {isPro ? 'Neural Pro' : 'Neural Free'}
                  </p>
                  <p className="text-[9px] text-dark-bg-subtle uppercase tracking-widest">
                    {isPro ? 'Full AI Access' : 'Basic Intelligence'}
                  </p>
                </div>
              </div>
              {!isPro && (
                <button 
                  onClick={upgradeToPro}
                  className="px-4 py-2 bg-neon-purple text-dark-bg-text text-[9px] font-black uppercase tracking-widest rounded-lg shadow-[0_0_15px_rgba(191,64,255,0.2)] hover:scale-105 transition-all"
                >
                  Upgrade
                </button>
              )}
            </div>
            {!isPro && (
              <div className="space-y-2">
                <div className="text-[9px] text-dark-bg-subtle flex items-center gap-2">
                  <div className="w-1 h-1 bg-neon-purple rounded-full" />
                  Predictive Performance Engine
                </div>
                <div className="text-[9px] text-dark-bg-subtle flex items-center gap-2">
                  <div className="w-1 h-1 bg-neon-purple rounded-full" />
                  Advanced Neural Analytics
                </div>
                <div className="text-[9px] text-dark-bg-subtle flex items-center gap-2">
                  <div className="w-1 h-1 bg-neon-purple rounded-full" />
                  Proactive AI Study Partner
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
