import React, { useState, useRef } from 'react';
import { analyzeContent, getMentorResponse } from '../services/aiService';
import { FileText, Video, Loader2, CheckCircle, HelpCircle, Upload, MessageSquare, Send, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Subject } from '../types';

interface ContentIntelligenceProps {
  subjects: Subject[];
}

function QuizQuestion({ q, index }: { q: any, index: number }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="space-y-4 p-5 bg-dark-bg/50 rounded-2xl border border-dark-border">
      <p className="text-xs font-black text-dark-bg-text uppercase tracking-tight">{index + 1}. {q.question}</p>
      <div className="grid grid-cols-1 gap-2">
        {q.options.map((opt: string, j: number) => (
          <button
            key={j}
            disabled={selected !== null}
            className={`text-left p-4 rounded-xl text-[11px] font-bold transition-all border ${
              selected === opt 
                ? (opt === q.answer ? 'bg-neon-lime/20 border-neon-lime text-neon-lime' : 'bg-red-500/20 border-red-500 text-red-500')
                : (selected !== null && opt === q.answer ? 'bg-neon-lime/10 border-neon-lime/50 text-neon-lime' : 'bg-dark-surface/50 border-dark-border text-dark-bg-muted hover:text-dark-bg-text hover:border-neon-purple/50')
            }`}
            onClick={() => setSelected(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
      {selected && (
        <p className={`text-[10px] font-black uppercase tracking-widest ${selected === q.answer ? 'text-neon-lime' : 'text-red-500'}`}>
          {selected === q.answer ? '✓ Correct Sequence' : `✗ Incorrect. Target: ${q.answer}`}
        </p>
      )}
    </div>
  );
}

export default function ContentIntelligence({ subjects }: ContentIntelligenceProps) {
  const [input, setInput] = useState('');
  const [type, setType] = useState<'pdf' | 'video' | 'text'>('text');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ summary: string, keyPoints: string[], quiz: any[] } | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = (event.target?.result as string).split(',')[1];
      setPdfBase64(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (type === 'text' && !input.trim()) return;
    if (type === 'video' && !input.trim()) return;
    if (type === 'pdf' && !pdfBase64) return;

    setLoading(true);
    try {
      let contentToAnalyze = input;
      if (type === 'pdf' && pdfBase64) {
        contentToAnalyze = `[PDF_BASE64]${pdfBase64}`;
      }
      
      const data = await analyzeContent(contentToAnalyze, type);
      setResult(data);
      setChatHistory([{ role: 'ai', text: "I've analyzed the content. What would you like to know about it?" }]);
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!chatInput.trim() || !result) return;
    
    const userMsg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatLoading(true);
    
    try {
      // We reuse getMentorResponse but pass the summary as context
      const context = {
        subjects: [{ id: '1', name: 'Analyzed Content', priority: 1, difficulty: 1, userId: '1' } as any],
        logs: [],
        notes: `Context Summary: ${result.summary}\nKey Points: ${result.keyPoints.join(', ')}`
      };
      const response = await getMentorResponse(userMsg, context as any);
      setChatHistory(prev => [...prev, { role: 'ai', text: response }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'ai', text: "Sorry, I couldn't process that question." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSaveToSubject = async () => {
    if (!selectedSubjectId || !result || !auth.currentUser) return;
    setSavingNotes(true);
    setSaveSuccess(false);
    try {
      const subDoc = doc(db, 'users', auth.currentUser.uid, 'subjects', selectedSubjectId);
      const subSnap = await getDoc(subDoc);
      if (subSnap.exists()) {
        const currentNotes = subSnap.data().notes || '';
        const formattedAddition = `\n\n--- [AI Summary: ${fileName || type.toUpperCase()}] ---\n${result.summary}\nKey Points:\n- ${result.keyPoints.join('\n- ')}`;
        await setDoc(subDoc, { notes: currentNotes + formattedAddition }, { merge: true });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error("Save to subject notes failed:", e);
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="glass-card p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-neon-cyan/10 rounded-lg border border-neon-cyan/20">
            <FileText className="text-neon-cyan" size={20} />
          </div>
          <h2 className="text-xl font-black tracking-tighter uppercase italic">Neural Content Processor</h2>
        </div>
        
        <div className="flex gap-3 mb-6">
          {(['text', 'pdf', 'video'] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setType(t);
                setInput('');
                setFileName(null);
                setPdfBase64(null);
              }}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                type === t ? 'bg-neon-cyan text-black' : 'bg-dark-bg/50 text-dark-bg-subtle hover:text-dark-bg-muted border border-dark-border'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {type === 'text' && (
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your text content here for analysis..."
            className="w-full h-40 bg-dark-bg/50 border border-dark-border rounded-2xl p-5 text-sm focus:border-neon-cyan/50 outline-none transition-all mb-6 font-medium"
          />
        )}

        {type === 'video' && (
          <input
            type="url"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste YouTube Video Link here..."
            className="w-full bg-dark-bg/50 border border-dark-border rounded-2xl p-5 text-sm focus:border-neon-cyan/50 outline-none transition-all mb-6 font-medium"
          />
        )}

        {type === 'pdf' && (
          <div 
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
            className="w-full h-40 bg-dark-bg/50 border-2 border-dashed border-dark-border hover:border-neon-cyan/50 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all mb-6 focus:outline-none focus:border-neon-cyan/80"
          >
            <input 
              type="file" 
              accept=".pdf" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <Upload className="text-neon-cyan mb-3" size={24} />
            <p className="text-sm font-bold text-dark-bg-text">
              {fileName ? fileName : "Click to upload PDF document"}
            </p>
            <p className="text-[10px] text-dark-bg-subtle uppercase tracking-widest mt-2">Max size: 5MB</p>
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleAnalyze}
          disabled={loading || (type === 'text' && !input.trim()) || (type === 'video' && !input.trim()) || (type === 'pdf' && !pdfBase64)}
          className="w-full bg-neon-cyan text-black py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(0,242,255,0.2)]"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
          {loading ? 'Processing Neural Data...' : 'Initialize Analysis'}
        </motion.button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 gap-8"
          >
            <div className="glass-card p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-neon-cyan/10 rounded-lg border border-neon-cyan/20">
                  <FileText className="text-neon-cyan" size={18} />
                </div>
                <h3 className="text-sm font-black tracking-tighter uppercase italic text-neon-cyan">Intelligence Summary</h3>
              </div>
              <p className="text-sm text-dark-bg-muted leading-relaxed font-medium">{result.summary}</p>
              <div className="space-y-3">
                {result.keyPoints.map((point, i) => (
                  <div key={i} className="flex gap-4 text-xs text-dark-bg-muted font-medium leading-relaxed">
                    <div className="mt-1.5 w-1 h-1 rounded-full bg-neon-cyan shrink-0 shadow-[0_0_8px_rgba(0,242,255,0.5)]" />
                    <p>{point}</p>
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-dark-border/40 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 w-full">
                  <label className="block text-[9px] font-black uppercase tracking-widest text-dark-bg-subtle mb-2">Sync to Curriculum Notes</label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full p-3 bg-dark-bg/50 border border-dark-border rounded-xl text-dark-bg-text font-bold text-xs outline-none focus:border-neon-cyan/50 transition-all"
                  >
                    <option value="">Select Subject Target...</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleSaveToSubject}
                  disabled={savingNotes || !selectedSubjectId}
                  className="w-full sm:w-auto px-5 py-3 bg-neon-cyan text-black font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(0,242,255,0.15)] flex items-center justify-center gap-2 self-end disabled:opacity-50"
                >
                  {savingNotes ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />}
                  {saveSuccess ? 'Notes Synced!' : 'Sync to Notes'}
                </button>
              </div>
            </div>

            {/* Q&A Chat Interface */}
            <div className="glass-card p-8 flex flex-col h-[400px]">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-neon-lime/10 rounded-lg border border-neon-lime/20">
                  <MessageSquare className="text-neon-lime" size={18} />
                </div>
                <h3 className="text-sm font-black tracking-tighter uppercase italic text-neon-lime">Ask Questions</h3>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-2xl text-sm font-medium leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-neon-lime text-black rounded-tr-sm' 
                        : 'bg-dark-surface border border-dark-border text-dark-bg-text rounded-tl-sm'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-dark-surface border border-dark-border p-4 rounded-2xl rounded-tl-sm">
                      <Loader2 className="animate-spin text-neon-lime" size={16} />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                  placeholder="Ask anything about this content..."
                  className="flex-1 bg-dark-bg/50 border border-dark-border rounded-xl px-4 py-3 text-sm focus:border-neon-lime/50 outline-none transition-all"
                />
                <button
                  onClick={handleAskQuestion}
                  disabled={chatLoading || !chatInput.trim()}
                  className="bg-neon-lime text-black p-3 rounded-xl hover:scale-105 transition-transform disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>

            <div className="glass-card p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-neon-purple/10 rounded-lg border border-neon-purple/20">
                  <HelpCircle className="text-neon-purple" size={18} />
                </div>
                <h3 className="text-sm font-black tracking-tighter uppercase italic text-neon-purple">Neural Validation (Quiz)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {result.quiz.map((q, i) => (
                  <QuizQuestion key={i} q={q} index={i} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
