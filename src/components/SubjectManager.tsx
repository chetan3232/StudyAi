import { useState, useEffect, useMemo } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, deleteDoc, doc, query, where, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { Subject } from '../types';
import { Plus, Trash2, BookOpen, Star, Zap, Search, GripVertical, Filter } from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemProps {
  id: string;
  subject: Subject;
  onDelete: (id: string) => void;
}

function SortableSubjectItem({ id, subject, onDelete }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 p-5 bg-dark-bg/50 rounded-2xl border ${
        isDragging ? 'border-neon-purple shadow-[0_0_20px_rgba(188,19,254,0.3)]' : 'border-dark-border'
      } group hover:border-neon-purple/30 transition-all`}
    >
      <div 
        {...attributes} 
        {...listeners} 
        className="cursor-grab active:cursor-grabbing p-2 text-dark-bg-dim hover:text-dark-bg-muted transition-colors"
      >
        <GripVertical size={18} />
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-black text-dark-bg-text uppercase tracking-tight italic">{subject.name}</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-dark-bg-subtle">Mastery</span>
            <span className={`text-xs font-black ${subject.masteryScore && subject.masteryScore >= 80 ? 'text-neon-lime' : subject.masteryScore && subject.masteryScore >= 50 ? 'text-neon-cyan' : 'text-neon-pink'}`}>
              {subject.masteryScore || 0}%
            </span>
          </div>
        </div>
        
        {/* Mastery Progress Bar */}
        <div className="w-full h-1.5 bg-dark-border rounded-full mb-3 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${subject.masteryScore || 0}%` }}
            className={`h-full rounded-full ${subject.masteryScore && subject.masteryScore >= 80 ? 'bg-neon-lime' : subject.masteryScore && subject.masteryScore >= 50 ? 'bg-neon-cyan' : 'bg-neon-pink'}`}
          />
        </div>

        <div className="flex gap-4">
          <span className="text-[10px] font-black flex items-center gap-1.5 text-neon-lime uppercase tracking-widest">
            <Star size={10} fill="currentColor" />
            Priority {subject.priority}
          </span>
          <span className="text-[10px] font-black flex items-center gap-1.5 text-neon-pink uppercase tracking-widest">
            <Zap size={10} fill="currentColor" />
            Difficulty {subject.difficulty}
          </span>
        </div>
      </div>
      <button 
        onClick={() => onDelete(subject.id)} 
        className="p-3 text-dark-bg-dim hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}

export default function SubjectManager() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<1 | 2 | 3>(1);
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<number | 'all'>('all');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'users', auth.currentUser.uid, 'subjects'), where('userId', '==', auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
      // Sort by order field if it exists, otherwise use original order
      const sortedSubs = subs.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
      setSubjects(sortedSubs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'subjects'));
    return unsubscribe;
  }, []);

  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPriority = filterPriority === 'all' || s.priority === filterPriority;
      return matchesSearch && matchesPriority;
    });
  }, [subjects, searchQuery, filterPriority]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = subjects.findIndex((s) => s.id === active.id);
      const newIndex = subjects.findIndex((s) => s.id === over.id);

      const newOrder = arrayMove(subjects, oldIndex, newIndex);
      setSubjects(newOrder);

      // Update order in Firestore
      if (!auth.currentUser) return;
      const batch = writeBatch(db);
      newOrder.forEach((subject, index) => {
        const ref = doc(db, 'users', auth.currentUser!.uid, 'subjects', subject.id);
        batch.update(ref, { order: index });
      });
      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'subjects');
      }
    }
  };

  const addSubject = async () => {
    if (!auth.currentUser || !name) return;
    try {
      const newDocRef = doc(collection(db, 'users', auth.currentUser.uid, 'subjects'));
      await setDoc(newDocRef, {
        id: newDocRef.id,
        userId: auth.currentUser.uid,
        name,
        priority,
        difficulty,
        notes,
        masteryScore: 0,
        order: subjects.length
      });
      setName('');
      setNotes('');
    } catch (error) { handleFirestoreError(error, OperationType.CREATE, 'subjects'); }
  };

  const deleteSubject = async (id: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'subjects', id));
    } catch (error) { handleFirestoreError(error, OperationType.DELETE, 'subjects'); }
  };

  return (
    <div className="glass-card p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neon-purple/10 rounded-lg border border-neon-purple/20">
            <BookOpen className="text-neon-purple" size={20} />
          </div>
          <h2 className="text-xl font-black tracking-tighter uppercase italic">Curriculum Architecture</h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-bg-dim" size={14} />
            <input 
              type="text"
              placeholder="Search subjects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-dark-bg/50 border border-dark-border rounded-xl text-xs font-bold outline-none focus:border-neon-purple/50 transition-all"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-bg-dim" size={14} />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="pl-9 pr-4 py-2 bg-dark-bg/50 border border-dark-border rounded-xl text-xs font-bold outline-none focus:border-neon-purple/50 transition-all appearance-none cursor-pointer"
            >
              <option value="all">All Priority</option>
              <option value="1">Priority 1</option>
              <option value="2">Priority 2</option>
              <option value="3">Priority 3</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-10">
        <div className="md:col-span-5">
          <input 
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder="Subject Identity..." 
            className="w-full p-4 bg-dark-bg/50 rounded-xl text-dark-bg-text border border-dark-border focus:border-neon-purple/50 outline-none font-bold text-sm transition-all"
          />
        </div>
        <div className="md:col-span-2">
          <select 
            value={priority} 
            onChange={e => setPriority(Number(e.target.value) as any)} 
            className="w-full p-4 bg-dark-bg/50 rounded-xl text-dark-bg-text border border-dark-border focus:border-neon-purple/50 outline-none font-bold text-sm transition-all"
          >
            {[1, 2, 3].map(n => <option key={n} value={n}>Priority {n}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <select 
            value={difficulty} 
            onChange={e => setDifficulty(Number(e.target.value) as any)} 
            className="w-full p-4 bg-dark-bg/50 rounded-xl text-dark-bg-text border border-dark-border focus:border-neon-purple/50 outline-none font-bold text-sm transition-all"
          >
            {[1, 2, 3].map(n => <option key={n} value={n}>Difficulty {n}</option>)}
          </select>
        </div>
        <div className="md:col-span-3">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={addSubject} 
            className="w-full bg-neon-purple text-dark-bg-text font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(188,19,254,0.2)]"
          >
            <Plus size={20} />
            Initialize
          </motion.button>
        </div>
        <div className="md:col-span-12">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-black uppercase tracking-widest text-dark-bg-subtle">Context Materials & Notes</label>
            <label className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-neon-cyan hover:underline flex items-center gap-1">
              <Plus size={12} />
              Upload TXT/PDF
              <input 
                type="file" 
                accept=".txt,.pdf" 
                className="hidden" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.type === 'text/plain') {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      setNotes(prev => prev + '\n\n--- ' + file.name + ' ---\n' + (event.target?.result as string));
                    };
                    reader.readAsText(file);
                  } else if (file.type === 'application/pdf') {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const base64 = (event.target?.result as string).split(',')[1];
                      setNotes(prev => prev + '\n\n--- ' + file.name + ' ---\n[PDF_BASE64]' + base64);
                    };
                    reader.readAsDataURL(file);
                  } else {
                    alert("Please upload TXT or PDF files. For Word/PPT, please convert to PDF first.");
                  }
                }}
              />
            </label>
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Paste syllabus, key concepts, or notes here for AI context..."
            className="w-full p-4 bg-dark-bg/50 rounded-xl text-dark-bg-text border border-dark-border focus:border-neon-purple/50 outline-none font-medium text-sm transition-all h-24 resize-none"
          />
        </div>
      </div>

      <div className="space-y-4">
        {filteredSubjects.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-dark-border rounded-2xl">
            <p className="text-xs font-black text-dark-bg-dim uppercase tracking-widest">
              {searchQuery || filterPriority !== 'all' ? 'No subjects match your filters.' : 'No subjects registered.'}
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredSubjects.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                <AnimatePresence>
                  {filteredSubjects.map((s) => (
                    <SortableSubjectItem 
                      key={s.id} 
                      id={s.id} 
                      subject={s} 
                      onDelete={deleteSubject} 
                    />
                  ))}
                </AnimatePresence>
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

