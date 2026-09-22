'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { getAccessToken } from '../../lib/auth';
import Sidebar from '../../components/Sidebar';
import AiSymbol from '../../components/AiSymbol';
import {
  Send,
  Wand2,
  Video,
  Search,
  Users,
  BookOpen,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Layers,
  Bell
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

  const [selectedSemFilter, setSelectedSemFilter] = useState<number | null>(isStudent ? studentSem : null);
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch Chat Groups
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

  // Auto-select first room
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

  // Fetch Initial Messages via REST
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

  // WebSocket Real-Time Connection
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
          const u = new URL(process.env.NEXT_PUBLIC_API_URL);
          wsHost = u.host;
          wsProtocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
        } catch (e) {
          wsHost = window.location.host;
        }
      } else {
        wsHost = window.location.host;
      }
    }

    const wsUrl = `${wsProtocol}//${wsHost}/ws/chat/${roomId}/?token=${encodeURIComponent(token)}`;
    setWsStatus('connecting');

    try {
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setWsStatus('connected');
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'message' && payload.data) {
            const incomingMsg: ChatMessage = payload.data;
            setMessages((prev) => {
              if (prev.some((m) => m.id === incomingMsg.id)) return prev;
              return [...prev, incomingMsg];
            });
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
          }
        } catch (e) {
          console.error('Failed to parse websocket message:', e);
        }
      };

      socket.onerror = () => {
        setWsStatus('disconnected');
      };

      socket.onclose = (event) => {
        setWsStatus('disconnected');
        if (event.code === 4003) {
          toast.error('Access denied: You can only chat in your own semester groups.');
        } else if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (activeRoomId === roomId) {
              connectWebSocket(roomId);
            }
          }, 3000);
        }
      };

      wsRef.current = socket;
    } catch (err) {
      setWsStatus('disconnected');
    }
  }, [activeRoomId]);

  useEffect(() => {
    if (activeRoomId) {
      fetchMessages(activeRoomId);
      connectWebSocket(activeRoomId);
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [activeRoomId, fetchMessages, connectWebSocket]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeRoomId) return;

    const content = messageText.trim();
    setMessageText('');

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message', content }));
    } else {
      api.post(`/api/chat/groups/${activeRoomId}/messages/`, { content })
        .then((res) => {
          setMessages((prev) => [...prev, res.data]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        })
        .catch((err) => {
          toast.error(err.response?.data?.detail || 'Failed to send message');
        });
    }
  };

  const handlePolishMessage = async () => {
    if (!messageText.trim()) {
      toast.error('Type a message first to polish with AI');
      return;
    }
    const toastId = toast.loading('Polishing with NexusAI...');
    try {
      const res = await api.post('/Genai/api/ask/', {
        question: `Rewrite the following college student question/message to make it clear, polite, and academically professional: "${messageText}". Reply with ONLY the rewritten message text, nothing else.`,
        subject_id: activeRoom?.subject_id ? String(activeRoom.subject_id) : '1',
      });
      const polished = res.data.answer.replace(/^["']|["']$/g, '').trim();
      setMessageText(polished);
      toast.success('Polished!', { id: toastId });
    } catch (err) {
      toast.error('Failed to polish message', { id: toastId });
    }
  };

  const activeRoom = rooms?.find((r) => r.id === activeRoomId);

  const filteredRooms = (rooms || []).filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.subject_name.toLowerCase().includes(q) ||
      r.subject_code.toLowerCase().includes(q)
    );
  });

  const launchVideoCall = () => {
    if (!activeRoom) return;
    const roomSlug = `SmartCollege-Sem${activeRoom.semester}-${activeRoom.subject_code.replace(/[^a-zA-Z0-9]/g, '')}`;
    const meetUrl = `https://meet.jit.si/${roomSlug}`;
    window.open(meetUrl, '_blank');
  };

  if (isLoading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-800 overflow-hidden relative font-sans antialiased">
      <Toaster position="top-right" />

      {/* ── Left Sidebar Navigation ───────────────────────────── */}
      <Sidebar />

      {/* ── Main Chat Layout Area ─────────────────────────────── */}
      <main className="flex-1 flex overflow-hidden min-w-0">
        {/* ── SECOND PANEL: SEMESTER CHAT GROUPS ───────────────── */}
        <aside className="w-80 md:w-88 border-r border-slate-200/80 bg-white flex flex-col shrink-0">
          {/* Header */}
          <div className="p-4 border-b border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#059669] flex items-center justify-center font-bold">
                  <Users size={18} />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-slate-900">Class Groups</h2>
                  <p className="text-[11px] text-slate-500">Real-time semester channels</p>
                </div>
              </div>

              {/* Semester Badge for Students */}
              {isStudent && (
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-[#047857] text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-200/80">
                  <GraduationCap size={13} />
                  Sem {studentSem}
                </span>
              )}
            </div>

            {/* Scope Notice for Students */}
            {isStudent ? (
              <div className="bg-[#ecfdf5] border border-emerald-100 rounded-xl px-3 py-2 text-xs text-[#065f46] flex items-center gap-2">
                <ShieldCheck size={15} className="text-[#059669] shrink-0" />
                <span>Showing your <strong>Semester {studentSem}</strong> discussion groups.</span>
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
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition border ${
                        selectedSemFilter === s
                          ? 'bg-[#059669] border-[#059669] text-white shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
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
                placeholder="Search subject groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Group Channels List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {roomsLoading ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Loading semester chat groups...</p>
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                <BookOpen size={24} className="mx-auto text-slate-300 mb-1" />
                <p className="font-semibold text-slate-600">No chat groups found</p>
                <p>
                  {isStudent
                    ? `No subjects assigned to Semester ${studentSem} yet.`
                    : 'Select a different semester above.'}
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
                        ? 'bg-[#e8f5e9] border-l-4 border-l-[#059669]'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition ${
                        isActive
                          ? 'bg-[#059669] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {room.subject_code.slice(0, 3)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4 className={`font-bold text-xs truncate ${isActive ? 'text-[#047857]' : 'text-slate-900'}`}>
                          {room.subject_name}
                        </h4>
                        <span className="text-[10px] text-emerald-800 font-semibold shrink-0 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          Sem {room.semester}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
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
        <section className="flex-1 flex flex-col bg-[#f8fafc] relative min-w-0">
          {activeRoom ? (
            <>
              {/* Channel Header */}
              <div className="h-16 border-b border-slate-200/80 px-6 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-base text-slate-900">{activeRoom.subject_name}</h3>
                      <span className="text-xs font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-bold">
                        {activeRoom.subject_code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs">
                      <span className="text-slate-500">Semester {activeRoom.semester} Class Channel</span>
                      <span className="text-slate-300">•</span>
                      {/* Live WebSocket Status Indicator */}
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        {wsStatus === 'connected' ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-emerald-700 text-[11px] font-semibold">Live WebSocket</span>
                          </>
                        ) : wsStatus === 'connecting' ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-amber-600 text-[11px]">Connecting...</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-rose-400" />
                            <span className="text-rose-500 text-[11px]">Offline</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Video Call Button */}
                <button
                  onClick={launchVideoCall}
                  className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3.5 py-1.5 rounded-xl transition text-xs font-semibold shadow-xs"
                >
                  <Video size={15} />
                  <span>Class Video Meet</span>
                </button>
              </div>

              {/* Messages Stream */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 mb-2">
                      <Users size={24} />
                    </div>
                    <h4 className="text-base font-bold text-slate-800">Welcome to {activeRoom.subject_name}!</h4>
                    <p className="text-xs text-slate-500 max-w-sm">
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
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-xs ${
                            isMe
                              ? 'bg-[#059669] text-white'
                              : isFaculty
                              ? 'bg-[#0f766e] text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {msg.sender_name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>

                        {/* Content bubble */}
                        <div className={`space-y-1 ${isMe ? 'text-right' : 'text-left'}`}>
                          {/* Sender Identity & Role Badge */}
                          <div className={`flex items-center gap-2 text-xs ${isMe ? 'justify-end' : ''}`}>
                            <span className="font-semibold text-slate-700">
                              {isMe ? 'You' : msg.sender_name}
                            </span>
                            {isFaculty ? (
                              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-200">
                                Faculty
                              </span>
                            ) : (
                              <span className="bg-blue-50 text-blue-700 text-[10px] font-medium px-1.5 py-0.5 rounded border border-blue-200">
                                Student
                              </span>
                            )}
                            {msg.created_at && (
                              <span className="text-[10px] text-slate-400">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>

                          {/* Message Text */}
                          <div
                            className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-xs ${
                              isMe
                                ? 'bg-[#059669] text-white rounded-tr-sm'
                                : isFaculty
                                ? 'bg-white text-slate-900 border border-amber-200 rounded-tl-sm'
                                : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-sm'
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
              <div className="p-4 bg-white border-t border-slate-200/80">
                <form onSubmit={handleSendMessage} className="flex items-end gap-3 max-w-5xl mx-auto">
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl relative focus-within:bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition shadow-xs">
                    <textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder={`Message #${activeRoom.subject_name}...`}
                      rows={1}
                      className="w-full bg-transparent resize-none py-3 pl-4 pr-12 text-sm text-slate-800 placeholder-slate-400 focus:outline-none max-h-32"
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
                      title="Polish with NexusAI"
                      className="absolute right-3 top-3 text-blue-600 hover:text-blue-700 p-1 rounded-lg hover:bg-blue-50 transition"
                    >
                      <AiSymbol size={18} className="text-blue-600" />
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={!messageText.trim()}
                    className="bg-[#059669] hover:bg-[#047857] text-white p-3 rounded-2xl transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shrink-0"
                  >
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shadow-sm">
                <BookOpen size={30} />
              </div>
              <h3 className="text-base font-bold text-slate-800">Select a Class Group</h3>
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
