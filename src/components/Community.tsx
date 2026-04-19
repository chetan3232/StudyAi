import { useState, useEffect, useRef } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  orderBy, 
  limit,
  Timestamp,
  arrayRemove,
  deleteDoc
} from 'firebase/firestore';
import { 
  Trophy, 
  Star, 
  Zap, 
  Award, 
  Flame, 
  Users, 
  Plus, 
  Target, 
  MessageSquare, 
  Send, 
  UserPlus, 
  Settings, 
  Trash2, 
  CheckCircle2, 
  Circle,
  Loader2,
  ChevronRight,
  Search,
  User as UserIcon,
  Crown,
  AlertTriangle,
  RefreshCcw,
  ShieldCheck,
  LogOut
} from 'lucide-react';
import { UserStats, Group, GroupMessage, GroupObjective, MemberStats, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export default function Community() {
  const [userStats, setUserStats] = useState<UserStats>({ xp: 0, level: 1, badges: [], streak: 0, lastStudyDate: null });
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'leaderboard' | 'objectives' | 'members'>('chat');
  
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [objectives, setObjectives] = useState<GroupObjective[]>([]);
  const [memberStats, setMemberStats] = useState<MemberStats[]>([]);
  const [groupMembers, setGroupMembers] = useState<UserProfile[]>([]);
  
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newObjective, setNewObjective] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [systemError, setSystemError] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const activeGroup = groups.find(g => g.id === activeGroupId);
  const isAdmin = activeGroup?.adminIds.includes(auth.currentUser?.uid || '');

  useEffect(() => {
    if (!auth.currentUser) return;
    
    try {
      // User Stats Listener
      const statsDoc = doc(db, 'users', auth.currentUser.uid, 'stats', 'main');
      const unsubStats = onSnapshot(statsDoc, (snap) => {
        if (snap.exists()) {
          setUserStats(snap.data() as UserStats);
        }
      }, (err) => {
        setSystemError("An unexpected error occurred in the neural link. Please try reloading the interface.");
      });

      // Groups Listener
      const q = query(collection(db, 'groups'), where('members', 'array-contains', auth.currentUser.uid));
      const unsubGroups = onSnapshot(q, (snap) => {
        const fetchedGroups = snap.docs.map(d => ({ id: d.id, ...d.data() } as Group));
        setGroups(fetchedGroups);
        if (fetchedGroups.length > 0 && !activeGroupId) {
          setActiveGroupId(fetchedGroups[0].id);
        }
      }, (err) => {
        setSystemError("An unexpected error occurred in the neural link. Please try reloading the interface.");
      });

      return () => { unsubStats(); unsubGroups(); };
    } catch (e) {
      setSystemError("An unexpected error occurred in the neural link. Please try reloading the interface.");
    }
  }, []);

  if (systemError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-8 glass-card border-red-500/30 bg-red-500/5 max-w-md"
        >
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <AlertTriangle className="text-red-500" size={32} />
          </div>
          <h2 className="text-2xl font-black tracking-tighter uppercase italic text-red-500 mb-4">System Interruption</h2>
          <p className="text-dark-bg-subtle font-medium leading-relaxed mb-8">
            {systemError}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 mx-auto px-8 py-3 bg-red-500 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all"
          >
            <RefreshCcw size={16} />
            Reload Interface
          </button>
        </motion.div>
      </div>
    );
  }

  useEffect(() => {
    if (!activeGroupId) return;

    // Messages Listener
    const messagesQuery = query(
      collection(db, 'groups', activeGroupId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(100)
    );
    const unsubMessages = onSnapshot(messagesQuery, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as GroupMessage)));
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    // Objectives Listener
    const objectivesQuery = query(
      collection(db, 'groups', activeGroupId, 'objectives'),
      orderBy('createdAt', 'desc')
    );
    const unsubObjectives = onSnapshot(objectivesQuery, (snap) => {
      setObjectives(snap.docs.map(d => ({ id: d.id, ...d.data() } as GroupObjective)));
    });

    // Fetch Member Profiles & Stats
    const fetchMembers = async () => {
      if (!activeGroup) return;
      
      const memberProfiles: UserProfile[] = [];
      const statsList: MemberStats[] = [];
      
      for (const memberId of activeGroup.members) {
        const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', memberId)));
        if (!userDoc.empty) {
          const profile = userDoc.docs[0].data() as UserProfile;
          memberProfiles.push(profile);
          
          const sDoc = await getDocs(collection(db, 'users', memberId, 'stats'));
          if (!sDoc.empty) {
            const sData = sDoc.docs[0].data() as UserStats;
            statsList.push({
              userId: memberId,
              name: profile.name,
              xp: sData.xp,
              streak: sData.streak,
              studyTime: 0 // Would need to aggregate logs for real study time
            });
          }
        }
      }
      setGroupMembers(memberProfiles);
      setMemberStats(statsList.sort((a, b) => b.xp - a.xp));
    };

    fetchMembers();

    return () => { unsubMessages(); unsubObjectives(); };
  }, [activeGroupId]);

  const createGroup = async () => {
    if (!newGroupName.trim() || !auth.currentUser) return;
    setLoading(true);
    try {
      const groupId = doc(collection(db, 'groups')).id;
      const groupData: Group = {
        id: groupId,
        name: newGroupName,
        members: [auth.currentUser.uid],
        adminIds: [auth.currentUser.uid],
        createdBy: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'groups', groupId), groupData);
      setNewGroupName('');
      setShowCreateGroup(false);
      setActiveGroupId(groupId);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'groups');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeGroupId || !auth.currentUser) return;
    const msg: Omit<GroupMessage, 'id'> = {
      senderId: auth.currentUser.uid,
      senderName: auth.currentUser.displayName || 'Anonymous',
      content: newMessage,
      timestamp: new Date().toISOString()
    };
    setNewMessage('');
    try {
      await addDoc(collection(db, 'groups', activeGroupId, 'messages'), msg);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'messages');
    }
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim() || !activeGroupId) return;
    setInviteLoading(true);
    setInviteError(null);
    try {
      const q = query(collection(db, 'users'), where('email', '==', inviteEmail.trim()));
      const snap = await getDocs(q);
      if (snap.empty) {
        setInviteError("User not found. Ensure they have an account.");
        return;
      }
      const targetUser = snap.docs[0].data() as UserProfile;
      if (activeGroup?.members.includes(targetUser.uid)) {
        setInviteError("User is already a member.");
        return;
      }
      await updateDoc(doc(db, 'groups', activeGroupId), {
        members: arrayUnion(targetUser.uid)
      });
      setInviteEmail('');
    } catch (e) {
      setInviteError("Failed to add member.");
    } finally {
      setInviteLoading(false);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!activeGroupId || !isAdmin || memberId === auth.currentUser?.uid) return;
    try {
      await updateDoc(doc(db, 'groups', activeGroupId), {
        members: arrayRemove(memberId),
        adminIds: arrayRemove(memberId)
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'groups');
    }
  };

  const promoteToAdmin = async (memberId: string) => {
    if (!activeGroupId || !isAdmin) return;
    try {
      await updateDoc(doc(db, 'groups', activeGroupId), {
        adminIds: arrayUnion(memberId)
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'groups');
    }
  };

  const leaveGroup = async () => {
    if (!activeGroupId || !auth.currentUser) return;
    
    // If last admin, maybe prevent leaving or delete group?
    // For now, just leave.
    const isLastAdmin = activeGroup?.adminIds.length === 1 && activeGroup.adminIds.includes(auth.currentUser.uid);
    if (isLastAdmin && activeGroup.members.length > 1) {
      alert("Please promote another member to Admin before leaving.");
      return;
    }

    try {
      await updateDoc(doc(db, 'groups', activeGroupId), {
        members: arrayRemove(auth.currentUser.uid),
        adminIds: arrayRemove(auth.currentUser.uid)
      });
      setActiveGroupId(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'groups');
    }
  };

  const deleteGroup = async () => {
    if (!activeGroupId || !isAdmin) return;
    if (!window.confirm("Are you sure you want to permanently delete this collective? This action cannot be undone.")) return;

    try {
      await deleteDoc(doc(db, 'groups', activeGroupId));
      setActiveGroupId(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'groups');
    }
  };

  const addObjective = async () => {
    if (!newObjective.trim() || !activeGroupId) return;
    const obj: Omit<GroupObjective, 'id'> = {
      title: newObjective,
      completed: false,
      createdAt: new Date().toISOString()
    };
    setNewObjective('');
    try {
      await addDoc(collection(db, 'groups', activeGroupId, 'objectives'), obj);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'objectives');
    }
  };

  const toggleObjective = async (objId: string, currentStatus: boolean) => {
    if (!activeGroupId) return;
    try {
      await updateDoc(doc(db, 'groups', activeGroupId, 'objectives', objId), {
        completed: !currentStatus,
        completedBy: !currentStatus ? auth.currentUser?.uid : null
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'objectives');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col gap-1 relative group">
        <h1 className="text-4xl font-black tracking-tighter text-dark-bg-text">Community</h1>
        <p className="text-dark-bg-subtle font-medium">Collaborative growth & gamification.</p>
        
        {/* Hidden trigger for testing System Interruption */}
        <button 
          onClick={() => setSystemError("An unexpected error occurred in the neural link. Please try reloading the interface.")}
          className="absolute -top-2 -right-2 w-4 h-4 opacity-0 group-hover:opacity-10 cursor-help"
          title="Simulate Interruption"
        />
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Level & XP Card */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="glass-card p-6 border-neon-purple/20 bg-neon-purple/5 relative overflow-hidden"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-neon-purple/10 rounded-lg border border-neon-purple/20">
              <Trophy className="text-neon-purple" size={18} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-neon-purple">Level {userStats.level}</span>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-black tracking-tighter text-dark-bg-text">{userStats.xp} <span className="text-xs text-dark-bg-subtle uppercase tracking-widest ml-1">XP</span></p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-dark-bg/50">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(userStats.xp % 1000) / 10}%` }}
              className="h-full bg-neon-purple shadow-[0_0_10px_rgba(168,85,247,0.5)]"
            />
          </div>
        </motion.div>

        {/* Streak Card */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="glass-card p-6 border-neon-pink/20 bg-neon-pink/5"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-neon-pink/10 rounded-lg border border-neon-pink/20">
              <Flame className="text-neon-pink" size={18} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-neon-pink">Streak</span>
          </div>
          <p className="text-3xl font-black tracking-tighter text-dark-bg-text">{userStats.streak} <span className="text-xs text-dark-bg-subtle uppercase tracking-widest ml-1">Days</span></p>
        </motion.div>

        {/* Badges Card */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="glass-card p-6 border-neon-lime/20 bg-neon-lime/5"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-neon-lime/10 rounded-lg border border-neon-lime/20">
              <Award className="text-neon-lime" size={18} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-neon-lime">Badges</span>
          </div>
          <p className="text-3xl font-black tracking-tighter text-dark-bg-text">{userStats.badges.length} <span className="text-xs text-dark-bg-subtle uppercase tracking-widest ml-1">Unlocked</span></p>
        </motion.div>

        {/* Global Rank Card */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="glass-card p-6 border-neon-cyan/20 bg-neon-cyan/5"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-neon-cyan/10 rounded-lg border border-neon-cyan/20">
              <Zap className="text-neon-cyan" size={18} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-neon-cyan">Global Rank</span>
          </div>
          <p className="text-3xl font-black tracking-tighter text-dark-bg-text">#12</p>
        </motion.div>
      </div>

      {/* Collectives Section Header */}
      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-dark-bg/50 rounded-lg border border-dark-border">
            <Users className="text-dark-bg-text" size={20} />
          </div>
          <h2 className="text-xl font-black tracking-tighter uppercase italic text-dark-bg-text">Study Collectives</h2>
        </div>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCreateGroup(true)}
          className="px-6 py-2.5 bg-neon-cyan text-black rounded-xl font-black uppercase text-[10px] tracking-widest shadow-[0_0_20px_rgba(0,242,255,0.3)] flex items-center gap-2"
        >
          <Plus size={14} />
          Initialize Group
        </motion.button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-24rem)]">
        {/* Sidebar: Group List */}
        <div className="w-full lg:w-72 flex flex-col gap-4">
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {groups.map(group => (
            <button
              key={group.id}
              onClick={() => setActiveGroupId(group.id)}
              className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-3 text-left ${
                activeGroupId === group.id 
                ? 'bg-neon-cyan/10 border-neon-cyan/30 shadow-[0_0_15px_rgba(0,242,255,0.1)]' 
                : 'bg-dark-bg/30 border-dark-border hover:border-dark-bg-dim'
              }`}
            >
              <div className={`p-2 rounded-lg ${activeGroupId === group.id ? 'bg-neon-cyan/20' : 'bg-dark-bg/50'}`}>
                <Users size={18} className={activeGroupId === group.id ? 'text-neon-cyan' : 'text-dark-bg-subtle'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-black truncate ${activeGroupId === group.id ? 'text-dark-bg-text' : 'text-dark-bg-muted'}`}>
                  {group.name}
                </p>
                <p className="text-[9px] font-bold text-dark-bg-subtle uppercase tracking-widest">
                  {group.members.length} Nodes
                </p>
              </div>
              {activeGroupId === group.id && <ChevronRight size={14} className="text-neon-cyan" />}
            </button>
          ))}

          {groups.length === 0 && (
            <div className="text-center py-8 px-4 border-2 border-dashed border-dark-border rounded-2xl">
              <p className="text-[10px] font-bold text-dark-bg-dim uppercase tracking-widest">No collectives found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 glass-card flex flex-col overflow-hidden">
        {activeGroup ? (
          <>
            {/* Group Header */}
            <div className="p-6 border-b border-dark-border flex items-center justify-between bg-dark-bg/20">
              <div>
                <h2 className="text-xl font-black tracking-tighter uppercase italic text-dark-bg-text">{activeGroup.name}</h2>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-[10px] font-bold text-dark-bg-subtle uppercase tracking-widest flex items-center gap-1">
                    <Users size={10} /> {activeGroup.members.length} Members
                  </span>
                  <span className="text-[10px] font-bold text-dark-bg-subtle uppercase tracking-widest flex items-center gap-1">
                    <Target size={10} /> {objectives.filter(o => o.completed).length}/{objectives.length} Objectives
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {['chat', 'leaderboard', 'objectives', 'members'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      activeTab === tab 
                      ? 'bg-neon-cyan text-black shadow-[0_0_15px_rgba(0,242,255,0.3)]' 
                      : 'text-dark-bg-subtle hover:text-dark-bg-text'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
                <button 
                  onClick={leaveGroup}
                  className="p-2 text-dark-bg-subtle hover:text-red-500 transition-colors"
                  title="Leave Collective"
                >
                  <LogOut size={16} />
                </button>
                {isAdmin && (
                  <button 
                    onClick={deleteGroup}
                    className="p-2 text-dark-bg-subtle hover:text-red-500 transition-colors"
                    title="Delete Collective"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <AnimatePresence mode="wait">
                {activeTab === 'chat' && (
                  <motion.div 
                    key="chat"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col h-full"
                  >
                    <div className="flex-1 space-y-4 mb-4">
                      {messages.map((msg, idx) => {
                        const isMe = msg.senderId === auth.currentUser?.uid;
                        return (
                          <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              {!isMe && <span className="text-[9px] font-black text-neon-cyan uppercase tracking-widest">{msg.senderName}</span>}
                              <span className="text-[8px] font-bold text-dark-bg-dim uppercase">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm font-medium leading-relaxed ${
                              isMe 
                              ? 'bg-neon-cyan/10 border border-neon-cyan/20 text-dark-bg-text rounded-tr-none' 
                              : 'bg-dark-bg/50 border border-dark-border text-dark-bg-muted rounded-tl-none'
                            }`}>
                              {msg.content}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={chatEndRef} />
                    </div>
                    
                    <div className="flex gap-3 pt-4 border-t border-dark-border">
                      <input 
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && sendMessage()}
                        placeholder="Transmit message..."
                        className="flex-1 bg-dark-bg/50 border border-dark-border rounded-xl px-4 py-3 text-sm outline-none focus:border-neon-cyan/50 font-medium"
                      />
                      <button 
                        onClick={sendMessage}
                        className="p-3 bg-neon-cyan text-black rounded-xl hover:shadow-[0_0_15px_rgba(0,242,255,0.4)] transition-all"
                      >
                        <Send size={20} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'leaderboard' && (
                  <motion.div 
                    key="leaderboard"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xs font-black uppercase tracking-widest text-neon-lime">Performance Matrix</h3>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-dark-bg-subtle uppercase">
                        <Flame size={12} className="text-neon-pink" /> Group Streak: 12 Days
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {memberStats.map((stat, idx) => (
                        <div key={stat.userId} className="flex items-center gap-4 p-4 bg-dark-bg/30 border border-dark-border rounded-2xl hover:border-neon-lime/30 transition-all group">
                          <div className="w-8 text-center font-black text-dark-bg-dim group-hover:text-neon-lime transition-colors">
                            {idx + 1}
                          </div>
                          <div className="w-10 h-10 rounded-xl bg-dark-bg/50 border border-dark-border flex items-center justify-center">
                            <UserIcon size={20} className="text-dark-bg-subtle" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-black text-dark-bg-text uppercase tracking-tight">{stat.name}</p>
                              {activeGroup.adminIds.includes(stat.userId) && <Crown size={12} className="text-neon-yellow" />}
                            </div>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-[9px] font-bold text-dark-bg-subtle uppercase tracking-widest flex items-center gap-1">
                                <Zap size={10} className="text-neon-purple" /> {stat.xp} XP
                              </span>
                              <span className="text-[9px] font-bold text-dark-bg-subtle uppercase tracking-widest flex items-center gap-1">
                                <Flame size={10} className="text-neon-pink" /> {stat.streak} Day Streak
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-neon-lime uppercase tracking-widest">Top Tier</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'objectives' && (
                  <motion.div 
                    key="objectives"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    <div className="flex gap-3">
                      <input 
                        value={newObjective}
                        onChange={e => setNewObjective(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && addObjective()}
                        placeholder="Define new shared objective..."
                        className="flex-1 bg-dark-bg/50 border border-dark-border rounded-xl px-4 py-3 text-sm outline-none focus:border-neon-pink/50 font-medium"
                      />
                      <button 
                        onClick={addObjective}
                        className="px-6 bg-neon-pink text-black rounded-xl font-black uppercase text-[10px] tracking-widest hover:shadow-[0_0_15px_rgba(255,0,127,0.3)] transition-all"
                      >
                        Initialize
                      </button>
                    </div>

                    <div className="space-y-3">
                      {objectives.map(obj => (
                        <div 
                          key={obj.id} 
                          onClick={() => toggleObjective(obj.id, obj.completed)}
                          className={`flex items-center justify-between p-5 rounded-2xl border cursor-pointer transition-all ${
                            obj.completed 
                            ? 'bg-neon-lime/5 border-neon-lime/20 opacity-60' 
                            : 'bg-dark-bg/30 border-dark-border hover:border-neon-pink/30'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            {obj.completed ? (
                              <CheckCircle2 className="text-neon-lime" size={20} />
                            ) : (
                              <Circle className="text-dark-bg-dim" size={20} />
                            )}
                            <div>
                              <p className={`text-sm font-bold ${obj.completed ? 'line-through text-dark-bg-dim' : 'text-dark-bg-text'}`}>
                                {obj.title}
                              </p>
                              {obj.completed && (
                                <p className="text-[9px] font-bold text-neon-lime uppercase tracking-widest mt-1">
                                  Completed by Node {obj.completedBy?.slice(0, 5)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'members' && (
                  <motion.div 
                    key="members"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-8"
                  >
                    {/* Invite Section */}
                    <div className="p-6 bg-dark-bg/30 border border-dark-border rounded-2xl">
                      <h3 className="text-xs font-black uppercase tracking-widest text-neon-cyan mb-4">Recruit New Nodes</h3>
                      <div className="flex gap-3">
                        <div className="flex-1 relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-bg-dim" size={16} />
                          <input 
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            placeholder="Search by email..."
                            className="w-full bg-dark-bg/50 border border-dark-border rounded-xl pl-12 pr-4 py-3 text-sm outline-none focus:border-neon-cyan/50 font-medium"
                          />
                        </div>
                        <button 
                          onClick={inviteMember}
                          disabled={inviteLoading}
                          className="px-6 bg-neon-cyan text-black rounded-xl font-black uppercase text-[10px] tracking-widest disabled:opacity-50"
                        >
                          {inviteLoading ? <Loader2 className="animate-spin" size={16} /> : 'Invite'}
                        </button>
                      </div>
                      {inviteError && <p className="text-[10px] text-red-500 font-bold mt-2 uppercase tracking-widest">{inviteError}</p>}
                    </div>

                    {/* Member List */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-widest text-dark-bg-subtle">Active Nodes</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {groupMembers.map(member => (
                          <div key={member.uid} className="p-4 bg-dark-bg/30 border border-dark-border rounded-2xl flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-dark-bg/50 border border-dark-border flex items-center justify-center">
                                <UserIcon size={20} className="text-dark-bg-subtle" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-black text-dark-bg-text uppercase tracking-tight">{member.name}</p>
                                  {activeGroup.adminIds.includes(member.uid) && <Crown size={12} className="text-neon-yellow" />}
                                </div>
                                <p className="text-[9px] font-bold text-dark-bg-subtle uppercase tracking-widest">{member.email}</p>
                              </div>
                            </div>
                            
                            {isAdmin && member.uid !== auth.currentUser?.uid && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!activeGroup.adminIds.includes(member.uid) && (
                                  <button 
                                    onClick={() => promoteToAdmin(member.uid)}
                                    className="p-2 text-dark-bg-dim hover:text-neon-yellow transition-colors"
                                    title="Promote to Admin"
                                  >
                                    <ShieldCheck size={16} />
                                  </button>
                                )}
                                <button 
                                  onClick={() => removeMember(member.uid)}
                                  className="p-2 text-dark-bg-dim hover:text-red-500 transition-colors"
                                  title="Remove Member"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="p-6 bg-dark-bg/30 rounded-full border border-dark-border mb-6">
              <Users size={48} className="text-dark-bg-dim" />
            </div>
            <h2 className="text-2xl font-black tracking-tighter uppercase italic text-dark-bg-text mb-2">No Active Collective</h2>
            <p className="text-sm text-dark-bg-subtle font-medium max-w-md">
              Select a collective from the sidebar or initialize a new one to start collaborating with other nodes.
            </p>
            <button 
              onClick={() => setShowCreateGroup(true)}
              className="mt-8 px-8 py-3 bg-neon-cyan text-black rounded-xl font-black uppercase text-xs tracking-widest shadow-[0_0_20px_rgba(0,242,255,0.2)]"
            >
              Initialize Collective
            </button>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreateGroup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateGroup(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass-card p-8 border-neon-cyan/30"
            >
              <h2 className="text-2xl font-black tracking-tighter uppercase italic text-dark-bg-text mb-6">Initialize Collective</h2>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-dark-bg-subtle mb-2 block">Collective Identity</label>
                  <input 
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    placeholder="Enter group name..."
                    className="w-full bg-dark-bg/50 border border-dark-border rounded-xl px-4 py-3 text-sm outline-none focus:border-neon-cyan/50 font-medium"
                  />
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={createGroup}
                    disabled={loading || !newGroupName.trim()}
                    className="flex-1 py-3 bg-neon-cyan text-black rounded-xl font-black uppercase text-xs tracking-widest disabled:opacity-50 shadow-[0_0_20px_rgba(0,242,255,0.2)]"
                  >
                    {loading ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Initialize'}
                  </button>
                  <button 
                    onClick={() => setShowCreateGroup(false)}
                    className="flex-1 py-3 bg-dark-bg/50 border border-dark-border text-dark-bg-subtle rounded-xl font-black uppercase text-xs tracking-widest"
                  >
                    Abort
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </div>
  );
}
