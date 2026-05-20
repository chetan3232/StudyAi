import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, BrainCircuit, Trash2, ChevronDown, Sparkles, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { chatTutorResponse, ChatTutorMessage } from '../services/aiService';
import { Subject, StudyLog } from '../types';

interface AIChatTutorProps {
  subjects: Subject[];
}

const QUICK_PROMPTS = [
  'Give me a study plan for today',
  'What should I revise first?',
  'Explain Newton\'s Laws simply',
  'How do I improve my focus?',
  'What are my weak areas?',
  'Create a quiz for me',
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 p-3 bg-dark-surface/50 border border-dark-border rounded-2xl rounded-tl-sm w-fit">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          className="w-1.5 h-1.5 bg-neon-cyan rounded-full"
        />
      ))}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatTutorMessage & { id: string } }) {
  const isUser = msg.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center border ${
        isUser
          ? 'bg-neon-purple/10 border-neon-purple/30'
          : 'bg-neon-cyan/10 border-neon-cyan/30'
      }`}>
        {isUser
          ? <User size={12} className="text-neon-purple" />
          : <BrainCircuit size={12} className="text-neon-cyan" />
        }
      </div>

      {/* Bubble */}
      <div className={`max-w-[82%] px-4 py-3 rounded-2xl text-xs leading-relaxed font-medium ${
        isUser
          ? 'bg-neon-purple/15 border border-neon-purple/30 text-dark-bg-text rounded-tr-sm'
          : 'bg-dark-surface/80 border border-dark-border text-dark-bg-text rounded-tl-sm'
      }`}>
        {isUser ? (
          <p>{msg.content}</p>
        ) : (
          <div className="prose prose-invert prose-xs max-w-none [&_p]:mb-2 [&_ul]:mb-2 [&_li]:mb-0.5 [&_strong]:text-neon-cyan [&_code]:bg-dark-bg [&_code]:px-1 [&_code]:rounded [&_code]:text-neon-lime [&_code]:text-[10px]">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}
        <p className={`text-[9px] mt-1.5 ${isUser ? 'text-neon-purple/50 text-right' : 'text-dark-bg-dim'}`}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </motion.div>
  );
}

export default function AIChatTutor({ subjects }: AIChatTutorProps) {
  const [messages, setMessages] = useState<(ChatTutorMessage & { id: string })[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const user = auth.currentUser;

  // Load user logs for context
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, 'users', user.uid, 'logs'),
      (snap) => setLogs(snap.docs.map(d => d.data() as StudyLog).slice(-30)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'logs')
    );
    return unsub;
  }, [user]);

  // Load user profile for context
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) setUserProfile(snap.data());
    });
  }, [user]);

  // Load persisted chat from Firestore
  useEffect(() => {
    if (!user) return;
    const chatDocRef = doc(db, 'users', user.uid, 'chatSessions', 'main');
    const unsub = onSnapshot(chatDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.messages?.length > 0) {
          setMessages(data.messages);
        } else {
          initWelcomeMessage();
        }
      } else {
        initWelcomeMessage();
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'chatSessions');
      initWelcomeMessage();
    });
    return unsub;
  }, [user]);

  const initWelcomeMessage = () => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `👋 Hello! I'm **NeuralTutor**, your AI study companion.\n\nI can help you:\n- 📚 **Understand concepts** in any subject\n- 📅 **Plan your study sessions** strategically\n- 🧪 **Create quizzes** to test your knowledge\n- 💡 **Get personalized advice** based on your progress\n\nWhat would you like to work on today?`,
      timestamp: new Date().toISOString(),
    }]);
  };

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
  };

  const persistMessages = async (msgs: (ChatTutorMessage & { id: string })[]) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'chatSessions', 'main'), {
        userId: user.uid,
        messages: msgs.slice(-50), // Keep last 50 messages
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'chatSessions');
    }
  };

  const sendMessage = async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || isThinking) return;

    const userMsg: ChatTutorMessage & { id: string } = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsThinking(true);
    inputRef.current?.focus();

    try {
      // Build conversation history for AI (last 10 messages)
      const history: ChatTutorMessage[] = updatedMessages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await chatTutorResponse(history, {
        subjects,
        logs,
        targetExam: userProfile?.targetExam,
      });

      const assistantMsg: ChatTutorMessage & { id: string } = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);
      await persistMessages(finalMessages);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Oops! I had trouble connecting. Please try again in a moment. 🔄',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  const clearChat = async () => {
    if (!user) return;
    const clearedMessages: (ChatTutorMessage & { id: string })[] = [];
    setMessages(clearedMessages);
    initWelcomeMessage();
    try {
      await setDoc(doc(db, 'users', user.uid, 'chatSessions', 'main'), {
        messages: [],
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'chatSessions');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="glass-card flex flex-col h-[700px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-dark-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neon-cyan/10 border border-neon-cyan/20 rounded-xl relative">
            <BrainCircuit size={18} className="text-neon-cyan" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-neon-lime rounded-full animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-dark-bg-text">NeuralTutor</h3>
            <p className="text-[10px] text-neon-lime font-black uppercase tracking-wider">● Online · Ready to help</p>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="p-2 text-dark-bg-subtle hover:text-red-400 transition-colors"
          title="Clear conversation"
          id="chat-clear-button"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-5 space-y-4 scroll-smooth"
      >
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          {isThinking && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-end gap-2"
            >
              <div className="w-7 h-7 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center shrink-0">
                <BrainCircuit size={12} className="text-neon-cyan" />
              </div>
              <TypingIndicator />
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => scrollToBottom()}
            className="absolute bottom-28 right-8 p-2 bg-dark-surface border border-dark-border rounded-full shadow-lg hover:border-neon-cyan/30 transition-all z-10"
          >
            <ChevronDown size={16} className="text-dark-bg-muted" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Quick Prompts */}
      <div className="px-4 pb-2 shrink-0 border-t border-dark-border/50">
        <div className="flex gap-2 py-2 overflow-x-auto scrollbar-none">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              disabled={isThinking}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-dark-bg/60 border border-dark-border hover:border-neon-cyan/30 hover:text-neon-cyan text-dark-bg-subtle rounded-full text-[10px] font-bold transition-all disabled:opacity-40 whitespace-nowrap"
            >
              <Sparkles size={10} />
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 pt-2 shrink-0">
        <div className="flex items-end gap-2 bg-dark-bg/60 border border-dark-border hover:border-neon-cyan/30 focus-within:border-neon-cyan/50 rounded-2xl p-2 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask NeuralTutor anything... (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="flex-1 bg-transparent text-xs text-dark-bg-text placeholder:text-dark-bg-dim resize-none outline-none py-1.5 px-2 max-h-24 font-medium"
            style={{ minHeight: '36px' }}
            id="chat-input"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => sendMessage()}
            disabled={!input.trim() || isThinking}
            className="shrink-0 p-2.5 bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/30 text-neon-cyan rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            id="chat-send-button"
          >
            <Send size={15} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
