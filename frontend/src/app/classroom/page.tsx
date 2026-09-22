'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { getAccessToken } from '../../lib/auth';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import {
  Send,
  Wand2,
  Video,
  Search,
  Users,
  Radio,
  BookOpen,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface ChatRoom {
  id: number;
  subject_id: number;
  subject_name: string;
  subject_code: string;
  semester: number;
  last_message?: string;
  last_time?: string;
  message_count: number;
}

interface ChatMessage {
  id: number;
  room_id: number;
  sender_id: number;
  sender_name: string;
  sender_role: string;
  content: string;
  is_faculty: boolean;
  is_me: boolean;
  created_at: string;
}

export default function Classroom() {
  const { isAuthorized, isLoading } = useRoleGuard(['student', 'faculty', 'admin']);
  const { user } = useAuth();

  const isStudent = user?.role?.toLowerCase() === 'student';
  const studentSem = Number(user?.sem || user?.semester || 1);

  // For faculty: selected semester filter (null = all)
  const [selectedSemFilter, setSelectedSemFilter] = useState<number | null>(isStudent ? studentSem : null);
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── Fetch Chat Groups (Semester-Scoped on Backend) ────────────
  const { data: rooms, isLoading: roomsLoading, refetch: refetchRooms } = useQuery<ChatRoom[]>({
    queryKey: ['chatGroups', isStudent ? studentSem : selectedSemFilter],
    queryFn: async () => {
      const semParam = isStudent ? studentSem : (selectedSemFilter !== null ? selectedSemFilter : '');
      const url = semParam ? `/api/chat/groups/?sem=${semParam}` : `/api/chat/groups/`;
      const res = await api.get(url);
      return res.data;
    },
    enabled: Boolean(isAuthorized),
  });

  // Auto-select first room when rooms load
  useEffect(() => {
    if (rooms && rooms.length > 0) {
      const roomStillExists = rooms.some((r) => r.id === activeRoomId);
      if (!activeRoomId || !roomStillExists) {
        setActiveRoomId(rooms[0].id);
      }
    } else if (rooms && rooms.length === 0) {
      setActiveRoomId(null);
      setMessages([]);
    }
  }, [rooms, activeRoomId]);

  // ── Fetch Initial Messages via REST ──────────────────────────
  const fetchMessages = useCallback(async (roomId: number) => {
    try {
      const res = await api.get(`/api/chat/groups/${roomId}/messages/`);
      setMessages(res.data);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err: any) {
      if (err.response?.status === 403) {
        toast.error('You can only view chat groups belonging to your semester.');
      } else {
        console.error('Failed to fetch messages:', err);
      }
    }
  }, []);

  // ── WebSocket Real-Time Connection ───────────────────────────
  const connectWebSocket = useCallback((roomId: number) => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const token = getAccessToken() || '';
    if (!token) return;

    let wsProtocol = 'ws:';
    let wsHost = 'localhost:8000';

    if (typeof window !== 'undefined') {
      wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      if (window.location.hostname === 'localhost' && window.location.port === '3000') {
        wsHost = 'localhost:8000';
      } else if (process.env.NEXT_PUBLIC_API_URL) {
        try {
          wsHost = new URL(process.env.NEXT_PUBLIC_API_URL).host;
        } catch (e) {
          wsHost = window.location.host;
        }
      } else {
        wsHost = window.location.host;
      }
    }

    const wsUrl = `${wsProtocol}//${wsHost}/api/chat/ws/${roomId}/?token=${encodeURIComponent(token)}`;
    setWsStatus('connecting');

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_message' && data.message) {
            const incoming: ChatMessage = {
              ...data.message,
              is_me: data.message.sender_id === user?.id,
            };
            setMessages((prev) => {
              // Avoid duplicate messages
              if (prev.some((m) => m.id === incoming.id)) return prev;
              return [...prev, incoming];
            });
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
          }
        } catch (err) {
          console.error('WebSocket message parsing error:', err);
        }
      };

      ws.onclose = (event) => {
        setWsStatus('disconnected');
        if (event.code === 4003) {
          toast.error('Semester access restricted: You cannot join this chat room.');
        }
      };

      ws.onerror = () => {
        setWsStatus('disconnected');
      };
    } catch (err) {
      setWsStatus('disconnected');
    }
  }, [user]);

  // Connect WebSocket & fetch initial history whenever active room changes
  useEffect(() => {
    if (activeRoomId) {
      fetchMessages(activeRoomId);
      connectWebSocket(activeRoomId);
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [activeRoomId, fetchMessages, connectWebSocket]);

  // ── Send Message ─────────────────────────────────────────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = messageText.trim();
    if (!trimmed || !activeRoomId) return;

    // Send via WebSocket if connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ content: trimmed }));
      setMessageText('');
    } else {
      // Fallback to HTTP POST
      try {
        const res = await api.post(`/api/chat/groups/${activeRoomId}/messages/`, { content: trimmed });
        setMessages((prev) => [...prev, res.data]);
        setMessageText('');
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      } catch (err: any) {
        toast.error(err.response?.data?.detail || 'Failed to send message');
      }
    }
  };

  // ── AI Message Polishing ─────────────────────────────────────
  const handlePolishMessage = async () => {
    if (!messageText.trim()) return;
    const toastId = toast.loading('Polishing message with AI...');
    try {
      const res = await api.post('/Genai/api/genai/', {
        prompt: `Rewrite this message for an academic class group clearly and professionally: "${messageText}"`,
        question: `Rewrite this message for an academic class group clearly and professionally: "${messageText}"`,
      });
      toast.dismiss(toastId);
      const polished = res.data.response || res.data.answer;
      if (polished) {
        setMessageText(polished.replace(/^["']|["']$/g, '').trim());
        toast.success('Message enhanced!');
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error('AI assistant unavailable');
    }
  };

  const activeRoom = rooms?.find((r) => r.id === activeRoomId);

  // Filter rooms by search
  const filteredRooms = (rooms || []).filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return r.subject_name.toLowerCase().includes(q) || r.subject_code.toLowerCase().includes(q);
  });

  const launchVideoCall = () => {
    if (!activeRoom) return;
    const meetUrl = `https://meet.jit.si/SmartCollege-Sem${activeRoom.semester}-${activeRoom.subject_code}`;
    window.open(meetUrl, '_blank');
  };

  if (isLoading || !isAuthorized) return null;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden relative">
      <Toaster position="top-right" />

      {/* Navigation: Sidebar for faculty, Navbar for students */}
      {!isStudent ? (
        <Sidebar />
      ) : (
        <div className="absolute top-0 w-full z-20">
          <Navbar />
        </div>
      )}

      <main className={`flex-1 flex overflow-hidden ${isStudent ? 'pt-16' : ''}`}>
        {/* ── LEFT PANEL: SEMESTER CHAT GROUPS ─────────────────── */}
        <aside className="w-80 md:w-96 border-r border-slate-800/80 bg-slate-900/60 flex flex-col backdrop-blur-xl">
          {/* Header */}
          <div className="p-4 border-b border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30">
                  <Users size={16} />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Class Groups</h2>
                  <p className="text-xs text-slate-400">Real-time semester channels</p>
                </div>
              </div>

              {/* Semester Badge for Students */}
              {isStudent && (
                <span className="inline-flex items-center gap-1 bg-purple-600/20 text-purple-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-purple-500/30">
                  <GraduationCap size={13} />
                  Sem {studentSem}
                </span>
              )}
            </div>

            {/* Scope Notice for Students */}
            {isStudent ? (
              <div className="bg-purple-950/30 border border-purple-800/40 rounded-xl px-3 py-2 text-xs text-purple-200 flex items-center gap-2">
                <ShieldCheck size={15} className="text-purple-400 shrink-0" />
                <span>Only showing your enrolled <strong>Semester {studentSem}</strong> chat groups.</span>
              </div>
            ) : (
              /* Faculty Semester Filter Selector */
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Filter by Semester:</span>
                  {selectedSemFilter !== null && (
                    <button
                      onClick={() => setSelectedSemFilter(null)}
                      className="text-purple-400 hover:text-purple-300 underline text-xs"
                    >
                      Show All
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSemFilter(s)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition border ${
                        selectedSemFilter === s
                          ? 'bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-600/30'
                          : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      Sem {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Search subject groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
              />
            </div>
          </div>

          {/* Group Channels List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {roomsLoading ? (
              <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Loading semester chat groups...</p>
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                <BookOpen size={24} className="mx-auto text-slate-600 mb-1" />
                <p className="font-semibold text-slate-400">No chat groups found</p>
                <p>
                  {isStudent
                    ? `No subjects assigned to Semester ${studentSem} yet.`
                    : 'Select a different semester or create subjects.'}
                </p>
              </div>
            ) : (
              filteredRooms.map((room) => {
                const isActive = activeRoomId === room.id;
                return (
                  <button
                    key={room.id}
                    onClick={() => setActiveRoomId(room.id)}
                    className={`w-full text-left p-3.5 transition flex items-start gap-3 relative ${
                      isActive
                        ? 'bg-purple-600/15 border-l-4 border-l-purple-500'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition ${
                        isActive
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {room.subject_code.slice(0, 3)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4 className="font-bold text-sm text-white truncate">{room.subject_name}</h4>
                        <span className="text-[10px] text-purple-400 font-semibold shrink-0 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/40">
                          Sem {room.semester}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        {room.last_message || <span className="italic text-slate-500">No messages yet</span>}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ── RIGHT PANEL: CHAT STREAM & WEBSOCKET ────────────── */}
        <section className="flex-1 flex flex-col bg-slate-950 relative">
          {activeRoom ? (
            <>
              {/* Channel Header */}
              <div className="h-16 border-b border-slate-800/80 px-6 flex items-center justify-between bg-slate-900/70 backdrop-blur-lg">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-white">{activeRoom.subject_name}</h3>
                      <span className="text-xs font-mono text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/50">
                        {activeRoom.subject_code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs">
                      <span className="text-slate-400">Semester {activeRoom.semester} Class Channel</span>
                      <span className="text-slate-600">•</span>
                      {/* Live WebSocket Status Indicator */}
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        {wsStatus === 'connected' ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-emerald-400 text-[11px]">Live WebSocket</span>
                          </>
                        ) : wsStatus === 'connecting' ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-amber-400 text-[11px]">Connecting...</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-rose-400" />
                            <span className="text-rose-400 text-[11px]">Offline</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Video Call Button */}
                <button
                  onClick={launchVideoCall}
                  className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 px-3.5 py-1.5 rounded-xl transition text-xs font-semibold shadow-sm"
                >
                  <Video size={16} />
                  <span>Class Video Meet</span>
                </button>
              </div>

              {/* Messages Stream */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-purple-600/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                      <Users size={24} />
                    </div>
                    <h4 className="text-base font-bold text-slate-300">Welcome to {activeRoom.subject_name}!</h4>
                    <p className="text-xs max-w-sm">
                      This is the official real-time discussion channel for Semester {activeRoom.semester}. Ask questions, share notes, and collaborate with your classmates and faculty.
                    </p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isMe = msg.is_me;
                    const isFaculty = msg.is_faculty || msg.sender_role?.toLowerCase() === 'faculty';

                    return (
                      <div
                        key={msg.id || index}
                        className={`flex gap-3 max-w-[80%] md:max-w-[70%] ${
                          isMe ? 'ml-auto flex-row-reverse' : ''
                        }`}
                      >
                        {/* Avatar */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-md ${
                            isMe
                              ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white'
                              : isFaculty
                              ? 'bg-gradient-to-tr from-amber-500 to-orange-600 text-white ring-2 ring-amber-400/40'
                              : 'bg-slate-800 text-slate-200 border border-slate-700'
                          }`}
                        >
                          {msg.sender_name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>

                        {/* Content bubble */}
                        <div className={`space-y-1 ${isMe ? 'text-right' : 'text-left'}`}>
                          {/* Sender Identity & Role Badge */}
                          <div className={`flex items-center gap-2 text-xs ${isMe ? 'justify-end' : ''}`}>
                            <span className="font-semibold text-slate-300">
                              {isMe ? 'You' : msg.sender_name}
                            </span>
                            {isFaculty ? (
                              <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-500/40">
                                Faculty
                              </span>
                            ) : (
                              <span className="bg-blue-500/15 text-blue-300 text-[10px] font-medium px-1.5 py-0.5 rounded border border-blue-500/30">
                                Student
                              </span>
                            )}
                            {msg.created_at && (
                              <span className="text-[10px] text-slate-500">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>

                          {/* Message Text */}
                          <div
                            className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-md ${
                              isMe
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tr-sm'
                                : isFaculty
                                ? 'bg-slate-800/90 text-slate-100 border border-amber-500/30 rounded-tl-sm'
                                : 'bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-tl-sm'
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box */}
              <div className="p-4 bg-slate-900/80 border-t border-slate-800/80 backdrop-blur-lg">
                <form onSubmit={handleSendMessage} className="flex items-end gap-3 max-w-5xl mx-auto">
                  <div className="flex-1 bg-slate-800/80 border border-slate-700/80 rounded-2xl relative focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition shadow-inner">
                    <textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder={`Message #${activeRoom.subject_name}...`}
                      rows={1}
                      className="w-full bg-transparent resize-none py-3 pl-4 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none max-h-32"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handlePolishMessage}
                      title="Polish with AI"
                      className="absolute right-3 top-3 text-purple-400 hover:text-purple-300 p-1 rounded-lg hover:bg-slate-700/50 transition"
                    >
                      <Wand2 size={18} />
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={!messageText.trim()}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white p-3 rounded-2xl transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-600/30 shrink-0"
                  >
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-purple-400 shadow-xl">
                <BookOpen size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-300">Select a Class Group</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Choose a subject from the left panel to join your semester's real-time discussion channel.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
