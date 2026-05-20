# 📘 StudyAI Project Map & Documentation

Welcome to **StudyAI**, a state-of-the-art AI-powered adaptive study platform built to optimize study scheduling, track performance, and provide cognitive assistance for students preparing for school, college, or competitive examinations (NEET, UPSC, JEE, etc.).

This document outlines the codebase, architecture, features, and database design. It acts as a guide so any AI model or developer can instantly understand the system and continue building on it.

---

## 🛠️ Technology Stack
1. **Frontend Core**: React 19 (TypeScript, Vite, HTML5, TailwindCSS v4 with `@tailwindcss/vite`).
2. **State Management**: React Context (`ThemeContext`, `SubscriptionContext`) + React State.
3. **Database & Auth**: Firebase Firestore (real-time listeners, multi-tab offline persistence enabled) + Firebase Auth (Google Sign-In).
4. **AI Processing**: Google Gemini API via `@google/genai` SDK using `gemini-3-flash-preview` and `gemini-3.1-pro-preview`.
5. **Aesthetics**: Premium dark-mode-first glassmorphism design with vivid neon accents (`#00f2ff` Cyan, `#bc13fe` Purple, `#39ff14` Lime, `#ff00ff` Pink). Uses custom micro-animations powered by `motion` (formerly `framer-motion`).

---

## 📂 Core Directory Structure

```
StudyAi/
├── .env                  # Local environment credentials (Gemini, Firebase Config)
├── .env.example          # Template for required environment variables
├── firestore.rules       # Security rules protecting user data, chat, logs, and leaderboard
├── package.json          # Dependency list (react 19, recharts, motion, @google/genai)
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite build tool setup with TailwindCSS v4
├── src/
│   ├── main.tsx          # Application entrypoint
│   ├── App.tsx           # Layout, navigation shell, tab router, sidebar, global state
│   ├── firebase.ts       # Firebase initialization, OAuth helpers, offline connection probe
│   ├── types.ts          # Strongly-typed Interfaces (Subject, StudyLog, Reward, etc.)
│   ├── contexts/
│   │   ├── ThemeContext.tsx         # Handles Light / Dark / Warm theme transitions
│   │   └── SubscriptionContext.tsx  # Gates Premium features (Free vs Pro tiers)
│   ├── services/
│   │   └── aiService.ts             # Direct SDK wrapper for Gemini (Recommendations, Chat, Quizzes)
│   └── components/
│       ├── SubjectManager.tsx       # Subject CRUD (priority, difficulty, notes, mastery)
│       ├── ProfileSetup.tsx         # Goal exam set, milestone date, pro subscription upgrade
│       ├── StudyTimer.tsx           # Active session counter, duration logger
│       ├── QuickStats.tsx           # Brief overview stats card
│       ├── StudyPlanner.tsx         # Draggable daily scheduler & reschedule engines
│       ├── StudyAnalytics.tsx       # Recharts visualization (velocity, mastery, burnout)
│       ├── AIRecommendations.tsx    # Weak subject warning, revision alert feeds
│       ├── AIMentor.tsx             # Strategic exam advice chat
│       ├── AICoach.tsx              # Dynamic day planner suggestions
│       ├── ContentIntelligence.tsx  # PDF / URL Summarizer & Quiz Generator
│       ├── TestGenerator.tsx        # Exam paper generation with auto-evaluated MCQs
│       ├── Community.tsx            # Real-time study groups, shared objectives, group chat
│       ├── RemindersManager.tsx     # Timed alarms with local/browser notification triggers
│       ├── AIChatTutor.tsx          # Conversational chatbot with memory and quick actions
│       ├── VoiceLogger.tsx          # Voice-activated logs (transcribes speech to log items)
│       └── Gamification.tsx         # Badges earned, XP levels, global live leaderboard
```

---

## 🗂️ Firestore Database Design

### `/users/{userId}`
*   **Fields**: `uid`, `name`, `email`, `examDate`, `targetExam`, `subscriptionTier` ('free' | 'pro')

### Subcollections under `/users/{userId}`
1.  **`/subjects/{subjectId}`**
    *   `id`, `userId`, `name`, `priority` (1-3), `difficulty` (1-3), `notes`, `masteryScore` (0-100), `order` (number)
2.  **`/logs/{logId}`**
    *   `id`, `userId`, `subjectId`, `subjectName`, `duration` (seconds), `date` (ISO string)
3.  **`/voiceLogs/{voiceLogId}`**
    *   `id`, `userId`, `subjectId`, `subjectName`, `transcript`, `duration` (seconds), `date` (ISO string), `source` ('voice')
4.  **`/plans/{date}`** (YYYY-MM-DD)
    *   `id`, `userId`, `date`, `tasks` (array of `{subjectId, subjectName, durationMinutes, completed}`), `updatedAt`
5.  **`/reminders/{reminderId}`**
    *   `id`, `userId`, `title`, `time` (HH:mm), `days` (array: 0-6), `isActive`, `subjectId` (optional)
6.  **`/chatSessions/main`**
    *   `userId`, `messages` (array of `{id, role, content, timestamp}`), `updatedAt`
7.  **`/stats/main`**
    *   `xp`, `level`, `streak`, `badges` (array of IDs), `lastStudyDate`

### Global Collections
1.  **`/groups/{groupId}`**
    *   `id`, `name`, `description`, `createdBy`, `createdAt`, `members` (array of userIds), `adminIds` (array of userIds)
    *   *Subcollections*: `messages` (group chat history), `objectives` (shared study checklist tasks)
2.  **`/leaderboard/{userId}`**
    *   `userId`, `name`, `photoURL`, `xp`, `level`, `streak`, `totalStudyMinutes`

---

## 🧠 Advanced Core Features Map
These features are designed to extend StudyAI into an automated study optimizer:

### 1. Predictive Study Engine
*   **Description**: Calculates preparation health, forecasting final scores based on historical consistency and subject difficulty.
*   **Logic**:
    1.  Calculates countdown days to `examDate`.
    2.  Computes study velocity (hours/week) from `logs`.
    3.  Evaluates mastery and priority of subjects.
    4.  Outputs a "Readiness Score" (0-100) and warning flags if subject completion trajectories are falling short.
    5.  Gemini generates a tailored corrective action plan.

### 2. Focus Mode + Distraction Blocker
*   **Description**: A full productivity module including Pomodoro cycles and distraction management.
*   **Logic**:
    1.  A standalone widget supporting configurable Pomodoro intervals (25 min study / 5 min break or custom configurations).
    2.  Uses browser-based full-screen API during active study sessions.
    3.  Features an overlay to block navigation within the application during active study intervals.
    4.  Mutes non-essential application notification dispatches.

### 3. Smart Habit Engine
*   **Description**: Gamification layer measuring user consistency.
*   **Logic**:
    1.  Calculates a "Habit Score" (0-100) combining logs frequency, streak consistency, and task completion percentage.
    2.  Tracks study streaks. If a student misses an allocated study plan session, a streak penalty is assessed.
    3.  Automates reward badge distribution when XP milestones are reached.

### 4. Goal Breakdown AI
*   **Description**: Converts high-level user statements (e.g., "Complete Chemistry Organic reactions") into modular, sub-divided checklist study tasks.
*   **Logic**:
    1.  User enters a broad study objective.
    2.  The goal is sent to Gemini, which returns a structured sequential roadmap.
    3.  Roadmap tasks are rendered as checkbox cards that can be logged and checked off directly.

### 5. Adaptive Difficulty System
*   **Description**: An automated scheduler optimization system.
*   **Logic**:
    1.  Monitors logged session durations, skipped planner slots, and current subject mastery scores.
    2.  Dynamically rescales time allocation: boosts schedule priority and duration for low-mastery, high-priority, or skipped subjects.
    3.  Reduces time requirements for subjects displaying high mastery levels.
