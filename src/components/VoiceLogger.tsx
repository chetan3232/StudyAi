import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Save, Trash2, AudioWaveform, CheckCircle, Loader } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { parseVoiceTranscript } from '../services/aiService';
import { Subject, VoiceLog } from '../types';

interface VoiceLoggerProps {
  subjects: Subject[];
}

// Extend window type for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function VoiceLogger({ subjects }: VoiceLoggerProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedLog, setSavedLog] = useState<VoiceLog | null>(null);
  const [recentLogs, setRecentLogs] = useState<VoiceLog[]>([]);
  const [isSupported, setIsSupported] = useState(true);
  const [parsedPreview, setParsedPreview] = useState<{ subject: string; duration: number; notes: string } | null>(null);
  const [waveAmplitudes, setWaveAmplitudes] = useState<number[]>(Array(12).fill(4));

  const recognitionRef = useRef<any>(null);
  const waveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const user = auth.currentUser;

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  // Animate waveform when listening
  useEffect(() => {
    if (isListening) {
      waveIntervalRef.current = setInterval(() => {
        setWaveAmplitudes(Array(12).fill(0).map(() => Math.floor(Math.random() * 28) + 4));
      }, 100);
    } else {
      if (waveIntervalRef.current) clearInterval(waveIntervalRef.current);
      setWaveAmplitudes(Array(12).fill(4));
    }
    return () => { if (waveIntervalRef.current) clearInterval(waveIntervalRef.current); };
  }, [isListening]);

  // Load recent voice logs
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'voiceLogs'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc'),
      limit(5)
    );
    const unsub = onSnapshot(q, (snap) => {
      setRecentLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as VoiceLog)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'voiceLogs'));
    return unsub;
  }, [user]);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) final += res[0].transcript;
        else interim += res[0].transcript;
      }
      if (final) setTranscript(prev => prev + ' ' + final);
      setInterimTranscript(interim);
    };

    recognition.onerror = (e: any) => {
      console.error('Speech error:', e.error);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
    setIsListening(true);
    setTranscript('');
    setInterimTranscript('');
    setParsedPreview(null);
    setSavedLog(null);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimTranscript('');
  };

  const parseAndPreview = async () => {
    const fullText = (transcript + ' ' + interimTranscript).trim();
    if (!fullText || subjects.length === 0) return;

    setIsParsing(true);
    try {
      const parsed = await parseVoiceTranscript(fullText, subjects);
      setParsedPreview({
        subject: parsed.subjectHint,
        duration: parsed.durationMinutes,
        notes: parsed.notes,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsParsing(false);
    }
  };

  const saveVoiceLog = async () => {
    if (!parsedPreview || !user) return;

    const matchedSubject = subjects.find(s =>
      s.name.toLowerCase().includes(parsedPreview.subject.toLowerCase()) ||
      parsedPreview.subject.toLowerCase().includes(s.name.toLowerCase())
    ) || subjects[0];

    if (!matchedSubject) return;

    setIsSaving(true);
    try {
      const logRef = doc(collection(db, 'users', user.uid, 'voiceLogs'));
      const newLog: VoiceLog = {
        id: logRef.id,
        userId: user.uid,
        subjectId: matchedSubject.id,
        subjectName: matchedSubject.name,
        transcript: transcript.trim(),
        duration: parsedPreview.duration * 60,
        date: new Date().toISOString(),
        source: 'voice',
      };
      await setDoc(logRef, newLog);

      // Also save as a regular study log for analytics
      const studyLogRef = doc(collection(db, 'users', user.uid, 'logs'));
      await setDoc(studyLogRef, {
        id: studyLogRef.id,
        userId: user.uid,
        subjectId: matchedSubject.id,
        subjectName: matchedSubject.name,
        duration: parsedPreview.duration * 60,
        date: new Date().toISOString(),
      });

      setSavedLog(newLog);
      setTranscript('');
      setParsedPreview(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'voiceLogs');
    } finally {
      setIsSaving(false);
    }
  };

  const clearAll = () => {
    stopListening();
    setTranscript('');
    setInterimTranscript('');
    setParsedPreview(null);
    setSavedLog(null);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
  };

  if (!isSupported) {
    return (
      <div className="glass-card p-8 text-center space-y-3">
        <MicOff size={40} className="mx-auto text-dark-bg-subtle" />
        <h3 className="font-black text-lg uppercase tracking-widest">Voice Not Supported</h3>
        <p className="text-sm text-dark-bg-muted">Your browser doesn't support the Web Speech API. Try Chrome or Edge.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="glass-card p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-neon-purple/10 border border-neon-purple/20 rounded-xl">
            <AudioWaveform size={22} className="text-neon-purple" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-widest text-dark-bg-text">Voice Study Logger</h3>
            <p className="text-xs text-dark-bg-subtle mt-0.5">Speak your study session — AI will parse and log it automatically</p>
          </div>
        </div>

        {/* Waveform Visualizer */}
        <div className="flex items-center justify-center gap-1.5 h-12 mb-6">
          {waveAmplitudes.map((h, i) => (
            <motion.div
              key={i}
              animate={{ height: isListening ? h : 4 }}
              transition={{ duration: 0.1, ease: 'easeOut' }}
              className={`w-2 rounded-full ${isListening ? 'bg-neon-purple' : 'bg-dark-border'}`}
              style={{ height: 4 }}
            />
          ))}
        </div>

        {/* Mic Button */}
        <div className="flex justify-center mb-6">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={isListening ? stopListening : startListening}
            className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
              isListening
                ? 'bg-red-500/20 border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]'
                : 'bg-neon-purple/10 border-2 border-neon-purple/40 hover:border-neon-purple hover:shadow-[0_0_20px_rgba(139,92,246,0.3)]'
            }`}
            id="voice-mic-button"
          >
            {isListening && (
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-red-500/10"
              />
            )}
            {isListening
              ? <MicOff size={30} className="text-red-400 relative z-10" />
              : <Mic size={30} className="text-neon-purple relative z-10" />
            }
          </motion.button>
        </div>

        <p className="text-center text-xs font-bold uppercase tracking-widest text-dark-bg-subtle mb-4">
          {isListening ? '🔴 Recording... Tap to Stop' : 'Tap to Start Recording'}
        </p>

        {/* Transcript Preview */}
        <AnimatePresence>
          {(transcript || interimTranscript) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-dark-bg/60 border border-dark-border rounded-xl p-4 mb-4"
            >
              <p className="text-xs font-black uppercase tracking-widest text-dark-bg-subtle mb-2">Transcript</p>
              <p className="text-sm text-dark-bg-text leading-relaxed">
                {transcript}
                {interimTranscript && (
                  <span className="text-dark-bg-muted italic"> {interimTranscript}</span>
                )}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Parsed Preview */}
        <AnimatePresence>
          {parsedPreview && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-neon-purple/5 border border-neon-purple/20 rounded-xl p-4 mb-4 space-y-3"
            >
              <p className="text-xs font-black uppercase tracking-widest text-neon-purple mb-2">AI Parsed Result</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-dark-bg/50 rounded-lg p-3">
                  <p className="text-[10px] font-black uppercase text-dark-bg-subtle mb-1">Subject</p>
                  <p className="text-sm font-bold text-dark-bg-text">{parsedPreview.subject}</p>
                </div>
                <div className="bg-dark-bg/50 rounded-lg p-3">
                  <p className="text-[10px] font-black uppercase text-dark-bg-subtle mb-1">Duration</p>
                  <p className="text-sm font-bold text-dark-bg-text">{parsedPreview.duration} min</p>
                </div>
              </div>
              <div className="bg-dark-bg/50 rounded-lg p-3">
                <p className="text-[10px] font-black uppercase text-dark-bg-subtle mb-1">Notes</p>
                <p className="text-xs text-dark-bg-muted leading-relaxed">{parsedPreview.notes}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Banner */}
        <AnimatePresence>
          {savedLog && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-neon-lime/10 border border-neon-lime/30 rounded-xl p-4 mb-4 flex items-center gap-3"
            >
              <CheckCircle size={18} className="text-neon-lime shrink-0" />
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-neon-lime">Session Logged!</p>
                <p className="text-xs text-dark-bg-muted mt-0.5">{savedLog.subjectName} · {formatDuration(savedLog.duration)}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        {transcript && !isListening && (
          <div className="flex gap-3">
            {!parsedPreview ? (
              <button
                onClick={parseAndPreview}
                disabled={isParsing}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-neon-purple/10 hover:bg-neon-purple/20 border border-neon-purple/30 text-neon-purple rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                id="voice-parse-button"
              >
                {isParsing ? <Loader size={14} className="animate-spin" /> : <AudioWaveform size={14} />}
                {isParsing ? 'Parsing...' : 'Parse with AI'}
              </button>
            ) : (
              <button
                onClick={saveVoiceLog}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-neon-lime/10 hover:bg-neon-lime/20 border border-neon-lime/30 text-neon-lime rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                id="voice-save-button"
              >
                {isSaving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                {isSaving ? 'Saving...' : 'Save Log'}
              </button>
            )}
            <button
              onClick={clearAll}
              className="p-3 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl transition-all"
              id="voice-clear-button"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}

        {/* Tips */}
        {!transcript && !isListening && (
          <div className="bg-dark-bg/40 border border-dark-border rounded-xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-dark-bg-subtle mb-2">💡 Example commands</p>
            <ul className="space-y-1">
              {[
                '"I studied Math for 45 minutes, covered quadratic equations"',
                '"30 minutes of Physics, practiced Newton\'s laws problems"',
                '"Studied Chemistry for one hour, focused on organic reactions"',
              ].map((ex, i) => (
                <li key={i} className="text-xs text-dark-bg-muted italic">• {ex}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recent Voice Logs */}
      {recentLogs.length > 0 && (
        <div className="glass-card p-6">
          <h4 className="text-xs font-black uppercase tracking-widest text-dark-bg-subtle mb-4">Recent Voice Logs</h4>
          <div className="space-y-2">
            {recentLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between p-3 bg-dark-bg/40 border border-dark-border rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-neon-purple/10 rounded-lg">
                    <Mic size={12} className="text-neon-purple" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-dark-bg-text">{log.subjectName}</p>
                    <p className="text-[10px] text-dark-bg-subtle">{new Date(log.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className="text-xs font-black text-neon-purple">{formatDuration(log.duration)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
