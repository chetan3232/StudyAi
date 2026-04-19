import { useState } from 'react';
import { generateExam } from '../services/aiService';
import { Subject } from '../types';
import { ClipboardCheck, Loader2, PlayCircle, Award } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

import { motion, AnimatePresence } from 'motion/react';

interface TestGeneratorProps {
  subjects: Subject[];
}

export default function TestGenerator({ subjects }: TestGeneratorProps) {
  const [selectedSubject, setSelectedSubject] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [loading, setLoading] = useState(false);
  const [exam, setExam] = useState<any[] | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleGenerate = async () => {
    if (!selectedSubject) return;
    setLoading(true);
    setExam(null);
    setScore(null);
    setAnswers({});
    try {
      const data = await generateExam(selectedSubject, difficulty);
      setExam(data.questions);
    } catch (error) {
      console.error("Failed to generate exam:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!exam || !auth.currentUser) return;
    let correctCount = 0;
    exam.forEach(q => {
      if (answers[q.id] === q.correct) correctCount++;
    });
    setScore(correctCount);

    // Update Mastery Score
    const subject = subjects.find(s => s.name === selectedSubject);
    if (subject) {
      const percentage = Math.round((correctCount / exam.length) * 100);
      const currentMastery = subject.masteryScore || 0;
      // Moving average approach: new mastery is 70% old + 30% new test score
      const newMastery = Math.round((currentMastery * 0.7) + (percentage * 0.3));
      
      try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid, 'subjects', subject.id), {
          masteryScore: newMastery
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'subjects');
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="glass-card p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-neon-purple/10 rounded-lg border border-neon-purple/20">
            <ClipboardCheck className="text-neon-purple" size={20} />
          </div>
          <h2 className="text-xl font-black tracking-tighter uppercase italic text-dark-bg-text">Neural Validation Protocol</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full p-4 bg-dark-bg/50 border border-dark-border rounded-xl text-sm outline-none focus:border-neon-purple/50 font-bold text-dark-bg-text transition-all"
          >
            <option value="">Select Subject Identity</option>
            {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>

          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full p-4 bg-dark-bg/50 border border-dark-border rounded-xl text-sm outline-none focus:border-neon-purple/50 font-bold text-dark-bg-text transition-all"
          >
            <option value="Easy">Complexity: Low</option>
            <option value="Medium">Complexity: Balanced</option>
            <option value="Hard">Complexity: High</option>
          </select>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleGenerate}
          disabled={loading || !selectedSubject}
          className="w-full bg-neon-purple text-dark-bg-text py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(188,19,254,0.2)]"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <PlayCircle size={20} />}
          {loading ? 'Generating Neural Test...' : 'Initialize Protocol'}
        </motion.button>
      </div>

      <AnimatePresence>
        {exam && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8 space-y-10"
          >
            {exam.map((q, i) => (
              <div key={q.id} className="space-y-6">
                <p className="text-sm font-black text-dark-bg-text uppercase tracking-tight italic">{i + 1}. {q.text}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {q.options.map((opt: string) => (
                    <button
                      key={opt}
                      onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                      className={`text-left p-5 rounded-2xl border transition-all text-xs font-bold ${
                        answers[q.id] === opt 
                        ? 'bg-neon-purple/20 border-neon-purple text-dark-bg-text shadow-[0_0_15px_rgba(188,19,254,0.1)]' 
                        : 'bg-dark-bg/50 border-dark-border text-dark-bg-subtle hover:border-neon-purple/30'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="pt-8 border-t border-dark-border">
              {score === null ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  className="w-full bg-neon-pink text-dark-bg-text py-5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(255,0,119,0.2)]"
                >
                  Terminate & Validate
                </motion.button>
              ) : (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center p-10 bg-neon-lime/5 border border-neon-lime/20 rounded-3xl"
                >
                  <Award className="mx-auto text-neon-lime mb-6 shadow-[0_0_20px_rgba(57,255,20,0.3)]" size={64} />
                  <h3 className="text-3xl font-black text-dark-bg-text mb-3 tracking-tighter uppercase italic">Protocol Complete</h3>
                  <p className="text-dark-bg-subtle font-black uppercase tracking-widest text-xs mb-6">Neural Accuracy: <span className="text-neon-lime text-xl ml-2">{score} / {exam.length}</span></p>
                  <button 
                    onClick={() => setExam(null)}
                    className="text-[10px] font-black uppercase tracking-[0.2em] text-neon-cyan hover:text-dark-bg-text transition-colors"
                  >
                    Initialize New Protocol
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
