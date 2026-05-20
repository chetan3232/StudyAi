export interface Subject {
  id: string;
  userId: string;
  name: string;
  priority: 1 | 2 | 3;
  difficulty: 1 | 2 | 3;
  notes?: string;
  masteryScore?: number; // 0 to 100
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  examDate?: string;
  targetExam?: string;
  subscriptionTier: 'free' | 'pro';
}

export interface StudyLog {
  id: string;
  userId: string;
  subjectId: string;
  subjectName: string;
  duration: number; // in seconds
  date: string; // ISO string
}

export interface PlanTask {
  subjectId: string;
  subjectName: string;
  durationMinutes: number;
  completed: boolean;
}

export interface DailyPlan {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  tasks: PlanTask[];
  updatedAt?: string;
}

export interface Analytics {
  performanceScore: number;
  weakAreas: string[];
  predictiveReadiness?: number;
}

export interface SystemMetrics {
  dau: number;
  totalStudyTime: number;
  retentionRate?: number;
  taskCompletionRate?: number;
  date: string;
}

export interface UserStats {
  xp: number;
  level: number;
  badges: string[];
  streak: number;
  lastStudyDate: string | null;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  members: string[];
  adminIds: string[];
  createdBy: string;
  createdAt: string;
}

export interface GroupMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
}

export interface GroupObjective {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  completedBy?: string;
}

export interface MemberStats {
  userId: string;
  name: string;
  xp: number;
  streak: number;
  studyTime: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  xpRequired: number;
}

export interface Reminder {
  id: string;
  userId: string;
  title: string;
  time: string; // HH:mm format
  days: number[]; // 0-6 (Sun-Sat)
  isActive: boolean;
  subjectId?: string;
}

// ─── Voice Logger ────────────────────────────────────────────────────────────
export interface VoiceLog {
  id: string;
  userId: string;
  subjectId: string;
  subjectName: string;
  transcript: string;       // speech-to-text result
  duration: number;         // session duration in seconds (parsed from speech)
  date: string;             // ISO string
  source: 'voice';
}

// ─── AI Chat Tutor ────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  messages: ChatMessage[];
  subject?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Gamification / Rewards ───────────────────────────────────────────────────
export interface Reward {
  id: string;
  userId: string;
  type: 'badge' | 'streak' | 'xp_milestone' | 'subject_mastery';
  title: string;
  description: string;
  icon: string;             // emoji or icon name
  xpValue: number;
  earnedAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  photoURL?: string;
  xp: number;
  level: number;
  streak: number;
  totalStudyMinutes: number;
  rank?: number;
}
