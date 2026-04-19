import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, deleteDoc, doc, query, where, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { Reminder, Subject } from '../types';
import { Bell, Plus, Trash2, Clock, Calendar, CheckCircle, BellOff, BellRing } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RemindersManager() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([new Date().getDay()]);
  const [subjectId, setSubjectId] = useState<string>('');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
    }
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const qReminders = query(collection(db, 'users', auth.currentUser.uid, 'reminders'), where('userId', '==', auth.currentUser.uid));
    const unsubReminders = onSnapshot(qReminders, (snapshot) => {
      setReminders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reminder)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'reminders'));

    const qSubjects = query(collection(db, 'users', auth.currentUser.uid, 'subjects'), where('userId', '==', auth.currentUser.uid));
    const unsubSubjects = onSnapshot(qSubjects, (snapshot) => {
      setSubjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'subjects'));

    return () => {
      unsubReminders();
      unsubSubjects();
    };
  }, []);

  const toggleDay = (dayIndex: number) => {
    setSelectedDays(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex].sort()
    );
  };

  const addReminder = async () => {
    if (!auth.currentUser || !title || selectedDays.length === 0) return;
    try {
      const newDocRef = doc(collection(db, 'users', auth.currentUser.uid, 'reminders'));
      await setDoc(newDocRef, {
        id: newDocRef.id,
        userId: auth.currentUser.uid,
        title,
        time,
        days: selectedDays,
        isActive: true,
        subjectId: subjectId || null
      });
      setTitle('');
      setSubjectId('');
    } catch (error) { handleFirestoreError(error, OperationType.CREATE, 'reminders'); }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid, 'reminders', id), {
        isActive: !currentStatus
      });
    } catch (error) { handleFirestoreError(error, OperationType.UPDATE, 'reminders'); }
  };

  const deleteReminder = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'reminders', id));
    } catch (error) { handleFirestoreError(error, OperationType.DELETE, 'reminders'); }
  };

  return (
    <div className="glass-card p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neon-pink/10 rounded-lg border border-neon-pink/20">
            <Bell className="text-neon-pink" size={20} />
          </div>
          <h2 className="text-xl font-black tracking-tighter uppercase italic">Study Reminders</h2>
        </div>
        
        {notificationPermission !== 'granted' && (
          <button 
            onClick={requestPermission}
            className="flex items-center gap-2 px-4 py-2 bg-neon-pink/10 text-neon-pink rounded-xl text-xs font-black uppercase tracking-widest hover:bg-neon-pink/20 transition-colors border border-neon-pink/20"
          >
            <BellRing size={14} />
            Enable Notifications
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-10 bg-dark-bg/30 p-6 rounded-2xl border border-dark-border">
        <div className="md:col-span-12 mb-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-dark-bg-subtle">Create New Reminder</h3>
        </div>
        <div className="md:col-span-4">
          <input 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            placeholder="Reminder Title (e.g., Math Revision)" 
            className="w-full p-4 bg-dark-bg/50 rounded-xl text-dark-bg-text border border-dark-border focus:border-neon-pink/50 outline-none font-bold text-sm transition-all"
          />
        </div>
        <div className="md:col-span-3">
          <select 
            value={subjectId} 
            onChange={e => setSubjectId(e.target.value)} 
            className="w-full p-4 bg-dark-bg/50 rounded-xl text-dark-bg-text border border-dark-border focus:border-neon-pink/50 outline-none font-bold text-sm transition-all"
          >
            <option value="">No Subject Link</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <input 
            type="time"
            value={time} 
            onChange={e => setTime(e.target.value)} 
            className="w-full p-4 bg-dark-bg/50 rounded-xl text-dark-bg-text border border-dark-border focus:border-neon-pink/50 outline-none font-bold text-sm transition-all"
          />
        </div>
        <div className="md:col-span-3">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={addReminder} 
            disabled={!title || selectedDays.length === 0}
            className="w-full bg-neon-pink text-dark-bg-text font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(255,10,108,0.2)] disabled:opacity-50"
          >
            <Plus size={20} />
            Set Reminder
          </motion.button>
        </div>
        <div className="md:col-span-12 mt-2">
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((day, idx) => (
              <button
                key={day}
                onClick={() => toggleDay(idx)}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                  selectedDays.includes(idx) 
                    ? 'bg-neon-pink text-white shadow-lg' 
                    : 'bg-dark-surface border border-dark-border text-dark-bg-subtle hover:text-dark-bg-text'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {reminders.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-dark-border rounded-2xl">
            <p className="text-xs font-black text-dark-bg-dim uppercase tracking-widest">No active reminders.</p>
          </div>
        ) : (
          <AnimatePresence>
            {reminders.map((r, idx) => (
              <motion.div 
                key={r.id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05 }}
                className={`flex items-center justify-between p-5 bg-dark-bg/50 rounded-2xl border transition-all group ${
                  r.isActive ? 'border-dark-border hover:border-neon-pink/30' : 'border-dark-border/50 opacity-60'
                }`}
              >
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => toggleActive(r.id, r.isActive)}
                    className={`p-2 rounded-full transition-colors ${r.isActive ? 'text-neon-pink bg-neon-pink/10' : 'text-dark-bg-subtle bg-dark-surface'}`}
                  >
                    {r.isActive ? <Bell size={18} /> : <BellOff size={18} />}
                  </button>
                  <div>
                    <h3 className={`font-black uppercase tracking-tight italic ${r.isActive ? 'text-dark-bg-text' : 'text-dark-bg-subtle'}`}>
                      {r.title}
                    </h3>
                    <div className="flex gap-4 mt-2">
                      <span className="text-[10px] font-black flex items-center gap-1.5 text-neon-cyan uppercase tracking-widest">
                        <Clock size={10} />
                        {r.time}
                      </span>
                      <span className="text-[10px] font-black flex items-center gap-1.5 text-neon-purple uppercase tracking-widest">
                        <Calendar size={10} />
                        {r.days.map(d => DAYS[d]).join(', ')}
                      </span>
                      {r.subjectId && (
                        <span className="text-[10px] font-black flex items-center gap-1.5 text-dark-bg-muted uppercase tracking-widest">
                          Linked: {subjects.find(s => s.id === r.subjectId)?.name || 'Unknown'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => deleteReminder(r.id)} 
                  className="p-3 text-dark-bg-dim hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={18} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
