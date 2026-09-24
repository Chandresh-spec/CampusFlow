'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { getAccessToken } from '../../lib/auth';
import Navbar from '../../components/Navbar';
import {
  Send,
  Wand2,
  Video,
  Search,
  Users,
  BookOpen,
  GraduationCap,
  ShieldCheck,
  ChevronLeft,
  MessageSquare
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
  
  // Mobile responsive view toggle (show chat stream or room list on small screens)
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── Fetch Chat Groups (Semester-Scoped on Backend) ────────────
  const { data: rooms, isLoading: roomsLoading } = useQuery<ChatRoom[]>({
    queryKey: ['chatGroups', isStudent ? studentSem : selectedSemFilter],
    queryFn: async () => {
      const semParam = isStudent ? studentSem : (selectedSemFilter !== null ? selectedSemFilter : '');
      const url = semParam ? `/api/chat/groups/?sem=${semParam}` : `/api/chat/groups/`;
      const res = await api.get(url);
      return res.data;
    },
    enabled: Boolean(isAuthorized),
  });

  // Auto-select first room on desktop when rooms load
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

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ content: trimmed }));
      setMessageText('');
    } else {
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

  if (isLoading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#f8fafc] text-slate-800 font-sans overflow-hidden">
      <Navbar />
      <Toaster position="top-right" />

      <main className="flex-1 flex overflow-hidden">
        {/* ── LEFT PANEL: SEMESTER CHAT GROUPS ─────────────────── */}
        <aside
          className={`${
            mobileShowChat ? 'hidden' : 'flex'
          } md:flex w-full md:w-80 lg:w-96 border-r border-slate-200/90 bg-white flex-col shrink-0`}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-[#059669] flex items-center justify-center border border-emerald-100">
                  <Users size={18} />
                </div>
                <div>
                  <h2 className="font-black text-base text-slate-900">Class Channels</h2>
                  <p className="text-[11px] text-slate-500">Live discussion groups</p>
                </div>
              </div>

              {isStudent && (
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-[#059669] text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                  <GraduationCap size={13} />
                  Sem {studentSem}
                </span>
              )}
            </div>

            {/* Scope Notice for Students */}
            {isStudent ? (
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-3 py-2 text-xs text-emerald-800 flex items-center gap-2">
                <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
                <span>Showing enrolled <strong>Semester {studentSem}</strong> discussion groups.</span>
              </div>
            ) : (
              /* Faculty Semester Filter Selector */
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Filter by Semester:</span>
                  {selectedSemFilter !== null && (
                    <button
                      onClick={() => setSelectedSemFilter(null)}
                      className="text-[#059669] hover:underline text-xs font-bold"
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
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition border ${
                        selectedSemFilter === s
                          ? 'bg-[#059669] border-[#059669] text-white shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
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
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search subject channels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white transition"
              />
            </div>
          </div>

          {/* Group Channels List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {roomsLoading ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Loading class channels...</p>
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <BookOpen size={24} className="mx-auto text-slate-400 mb-1" />
                <p className="font-bold text-slate-700">No channels found</p>
                <p className="text-slate-400">
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
                    onClick={() => {
                      setActiveRoomId(room.id);
                      setMobileShowChat(true);
                    }}
                    className={`w-full text-left p-3.5 sm:p-4 transition-colors flex items-start gap-3 relative ${
                      isActive
                        ? 'bg-emerald-50/80 border-l-4 border-l-[#059669]'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0 transition-colors ${
                        isActive
                          ? 'bg-[#059669] text-white shadow-xs'
                          : 'bg-emerald-50 text-[#059669] border border-emerald-100'
                      }`}
                    >
                      {room.subject_code.slice(0, 3)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4 className="font-bold text-sm text-slate-900 truncate">{room.subject_name}</h4>
                        <span className="text-[10px] text-emerald-800 font-bold shrink-0 bg-emerald-100/70 px-1.5 py-0.5 rounded border border-emerald-200">
                          Sem {room.semester}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {room.last_message || <span className="italic text-slate-400">No messages yet</span>}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ── RIGHT PANEL: CHAT STREAM & WEBSOCKET ────────────── */}
        <section
          className={`${
            mobileShowChat ? 'flex' : 'hidden'
          } md:flex flex-1 flex-col bg-[#f8fafc] relative overflow-hidden`}
        >
          {activeRoom ? (
            <>
              {/* Channel Header */}
              <div className="h-16 border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between bg-white backdrop-blur-md">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setMobileShowChat(false)}
                    className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
                    title="Back to Channels"
                  >
                    <ChevronLeft size={20} />
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 truncate">
                      <h3 className="font-black text-base text-slate-900 truncate">{activeRoom.subject_name}</h3>
                      <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 shrink-0">
                        {activeRoom.subject_code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs">
                      <span className="text-slate-500 hidden sm:inline">Semester {activeRoom.semester} Channel</span>
                      <span className="text-slate-300 hidden sm:inline">•</span>
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        {wsStatus === 'connected' ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-emerald-700 font-bold text-[11px]">Live WebSocket</span>
                          </>
                        ) : wsStatus === 'connecting' ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-amber-600 font-bold text-[11px]">Connecting...</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-rose-400" />
                            <span className="text-rose-500 font-bold text-[11px]">Offline</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Video Call Button */}
                <button
                  onClick={launchVideoCall}
                  className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-[#059669] border border-emerald-200 px-3.5 py-1.5 rounded-xl transition text-xs font-bold shrink-0 shadow-xs"
                >
                  <Video size={16} />
                  <span className="hidden sm:inline">Class Video Meet</span>
                </button>
              </div>

              {/* Messages Stream */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#059669] border border-emerald-100">
                      <MessageSquare size={24} />
                    </div>
                    <h4 className="text-base font-bold text-slate-700">Welcome to #{activeRoom.subject_name}!</h4>
                    <p className="text-xs max-w-sm text-slate-500">
                      This is the official real-time discussion channel for Semester {activeRoom.semester}. Ask doubts, share syllabus topics, and collaborate with your classmates and faculty.
                    </p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isMe = msg.is_me;
                    const isFaculty = msg.is_faculty || msg.sender_role?.toLowerCase() === 'faculty';

                    return (
                      <div
                        key={msg.id || index}
                        className={`flex gap-3 max-w-[85%] sm:max-w-[75%] ${
                          isMe ? 'ml-auto flex-row-reverse' : ''
                        }`}
                      >
                        {/* Avatar */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 shadow-xs ${
                            isMe
                              ? 'bg-[#059669] text-white'
                              : isFaculty
                              ? 'bg-amber-500 text-white ring-2 ring-amber-200'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {msg.sender_name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>

                        {/* Content bubble */}
                        <div className={`space-y-1 ${isMe ? 'text-right' : 'text-left'}`}>
                          {/* Sender Identity & Role Badge */}
                          <div className={`flex items-center gap-2 text-xs ${isMe ? 'justify-end' : ''}`}>
                            <span className="font-bold text-slate-700">
                              {isMe ? 'You' : msg.sender_name}
                            </span>
                            {isFaculty ? (
                              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-200">
                                Faculty
                              </span>
                            ) : (
                              <span className="bg-emerald-50 text-[#059669] text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                                Student
                              </span>
                            )}
                            {msg.created_at && (
                              <span className="text-[10px] text-slate-400">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>

                          {/* Message Text Bubble */}
                          <div
                            className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-xs ${
                              isMe
                                ? 'bg-[#059669] text-white rounded-tr-xs'
                                : isFaculty
                                ? 'bg-amber-50/90 text-slate-900 border border-amber-200/90 rounded-tl-xs'
                                : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs'
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
              <div className="p-3 sm:p-4 bg-white border-t border-slate-200/90">
                <form onSubmit={handleSendMessage} className="flex items-end gap-2 sm:gap-3 max-w-5xl mx-auto">
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl relative focus-within:border-[#059669] focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:bg-white transition">
                    <textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder={`Message #${activeRoom.subject_name}...`}
                      rows={1}
                      className="w-full bg-transparent resize-none py-3 pl-4 pr-11 text-sm text-slate-900 placeholder-slate-400 focus:outline-none max-h-32"
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
                      title="Polish message with Academic AI"
                      className="absolute right-2.5 top-2.5 text-[#059669] hover:text-[#047857] p-1.5 rounded-xl hover:bg-emerald-50 transition"
                    >
                      <Wand2 size={17} />
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={!messageText.trim()}
                    className="bg-[#059669] hover:bg-[#047857] text-white p-3 rounded-2xl transition shadow-md shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#059669] shadow-xs">
                <BookOpen size={30} />
              </div>
              <h3 className="text-lg font-black text-slate-800">Select a Class Channel</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Choose a subject channel from the panel to join your semester discussion room.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
