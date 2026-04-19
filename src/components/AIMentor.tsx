import { useState, useEffect, useRef } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, doc, getDoc, setDoc, updateDoc, arrayUnion, query, orderBy, limit } from 'firebase/firestore';
import { Subject, StudyLog, UserProfile } from '../types';
import { getMentorResponse } from '../services/aiService';
import { MessageSquare, Send, Bot, User, Sparkles, Calendar, TrendingUp, Target, Trash2 } from 'lucide-react';
import { useSubscription } from '../contexts/SubscriptionContext';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export default function AIMentor() {
  const { isPro } = useSubscription();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const fetchProfile = async () => {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser!.uid));
      if (userDoc.exists()) {
        setUserProfile(userDoc.data() as UserProfile);
      }
    };
    fetchProfile();

    // Sync Chat History
    const chatDoc = doc(db, 'users', auth.currentUser.uid, 'mentor_chat', 'history');
    const unsubChat = onSnapshot(chatDoc, (snap) => {
      if (snap.exists()) {
        setMessages(snap.data().messages || []);
      } else {
        const initialMsg: Message = { 
          role: 'assistant', 
          content: "Neural link established. I am your strategic AI Mentor. How can we optimize your long-term performance and strategy today?",
          timestamp: new Date().toISOString()
        };
        setMessages([initialMsg]);
        setDoc(chatDoc, { messages: [initialMsg] });
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'mentor_chat'));

    const unsubSubs = onSnapshot(collection(db, 'users', auth.currentUser.uid, 'subjects'), (snap) => {
      setSubjects(snap.docs.map(d => d.data() as Subject));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'subjects'));
    
    const unsubLogs = onSnapshot(collection(db, 'users', auth.currentUser.uid, 'logs'), (snap) => {
      setLogs(snap.docs.map(d => d.data() as StudyLog));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'logs'));
    
    return () => { unsubChat(); unsubSubs(); unsubLogs(); };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (overrideMessage?: string) => {
    const userMsg = overrideMessage || input.trim();
    if (!userMsg || loading || !auth.currentUser) return;

    if (!overrideMessage) setInput('');
    
    const newUserMsg: Message = { role: 'user', content: userMsg, timestamp: new Date().toISOString() };
    const chatDoc = doc(db, 'users', auth.currentUser.uid, 'mentor_chat', 'history');
    
    // Optimistic update
    setMessages(prev => [...prev, newUserMsg]);
    setLoading(true);

    try {
      // Pass last 20 logs for context
      const recentLogs = logs.slice(-20);
      
      const response = await getMentorResponse(userMsg, { 
        subjects, 
        logs: recentLogs,
        targetExam: userProfile?.targetExam 
      });
      
      const assistantMsg: Message = { role: 'assistant', content: response, timestamp: new Date().toISOString() };
      
      // Save to Firestore
      await updateDoc(chatDoc, {
        messages: arrayUnion(newUserMsg, assistantMsg)
      });

      // Proactive follow-up for Pro users (10% chance)
      if (isPro && Math.random() < 0.1 && !overrideMessage) {
        setTimeout(async () => {
          const followUp: Message = { 
            role: 'assistant', 
            content: "I've been analyzing your recent patterns. Would you like me to adjust your study plan to better address your identified weak areas?",
            timestamp: new Date().toISOString()
          };
          await updateDoc(chatDoc, {
            messages: arrayUnion(followUp)
          });
        }, 2000);
      }
    } catch (error) {
      console.error("Mentor response failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    if (!auth.currentUser) return;
    const chatDoc = doc(db, 'users', auth.currentUser.uid, 'mentor_chat', 'history');
    const initialMsg: Message = { 
      role: 'assistant', 
      content: "Neural link reset. How can we optimize your strategy today?",
      timestamp: new Date().toISOString()
    };
    await setDoc(chatDoc, { messages: [initialMsg] });
  };

  const handleQuickAction = (action: 'plan' | 'review' | 'strategy') => {
    let prompt = "";
    const exam = userProfile?.targetExam || 'my upcoming exams';
    
    if (action === 'plan') {
      prompt = `Based on my subjects and performance, please generate a detailed 1-Month Plan for ${exam}.`;
    } else if (action === 'review') {
      prompt = `Please conduct a Weekly Review of my study progress for ${exam} and suggest improvements.`;
    } else if (action === 'strategy') {
      prompt = `What is the best long-term Career Strategy for someone targeting ${exam}?`;
    }
    
    sendMessage(prompt);
  };

  return (
    <div className="flex flex-col h-[600px] glass-card overflow-hidden">
      <div className="p-5 border-b border-dark-border bg-dark-surface/30 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neon-cyan/10 rounded-lg border border-neon-cyan/20">
              <Bot className="text-neon-cyan" size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tighter uppercase italic">AI Mentor Mode</h2>
              {userProfile?.targetExam && (
                <p className="text-[10px] text-neon-cyan uppercase tracking-widest mt-1">Target: {userProfile.targetExam}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-neon-cyan rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-neon-cyan uppercase tracking-widest">Online</span>
            </div>
            <button 
              onClick={clearChat}
              className="p-1.5 text-dark-bg-dim hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
              title="Reset Neural Link"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button 
            onClick={() => handleQuickAction('plan')}
            className="flex items-center gap-2 px-3 py-1.5 bg-dark-bg/50 border border-dark-border rounded-lg text-[10px] font-bold uppercase tracking-widest text-dark-bg-text hover:border-neon-cyan/50 transition-colors whitespace-nowrap"
          >
            <Calendar size={12} className="text-neon-cyan" />
            1-Month Plan
          </button>
          <button 
            onClick={() => handleQuickAction('review')}
            className="flex items-center gap-2 px-3 py-1.5 bg-dark-bg/50 border border-dark-border rounded-lg text-[10px] font-bold uppercase tracking-widest text-dark-bg-text hover:border-neon-cyan/50 transition-colors whitespace-nowrap"
          >
            <TrendingUp size={12} className="text-neon-cyan" />
            Weekly Review
          </button>
          <button 
            onClick={() => handleQuickAction('strategy')}
            className="flex items-center gap-2 px-3 py-1.5 bg-dark-bg/50 border border-dark-border rounded-lg text-[10px] font-bold uppercase tracking-widest text-dark-bg-text hover:border-neon-cyan/50 transition-colors whitespace-nowrap"
          >
            <Target size={12} className="text-neon-cyan" />
            Career Strategy
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl flex gap-4 ${
              m.role === 'user' 
              ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 rounded-tr-none' 
              : 'bg-dark-bg/50 text-dark-bg-text rounded-tl-none border border-dark-border'
            }`}>
              <div className="shrink-0 mt-1">
                {m.role === 'user' ? <User size={14} /> : <Bot size={14} className="text-neon-cyan" />}
              </div>
              <div className="text-sm leading-relaxed font-medium prose prose-invert prose-p:leading-relaxed prose-pre:bg-dark-bg prose-pre:border prose-pre:border-dark-border max-w-none">
                {m.role === 'assistant' ? (
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                ) : (
                  <p>{m.content}</p>
                )}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-dark-bg/50 p-4 rounded-2xl rounded-tl-none border border-dark-border flex gap-2">
              <div className="w-1.5 h-1.5 bg-neon-cyan rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-neon-cyan rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 bg-neon-cyan rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      <div className="p-5 border-t border-dark-border bg-dark-surface/30">
        <div className="flex gap-3">
          <input 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask your mentor for guidance..."
            className="flex-1 bg-dark-bg/50 border border-dark-border rounded-xl px-5 py-3 text-sm focus:border-neon-cyan/50 outline-none transition-all font-medium"
          />
          <button 
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="p-3 bg-neon-cyan text-black rounded-xl disabled:opacity-50 transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(0,242,255,0.2)]"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
