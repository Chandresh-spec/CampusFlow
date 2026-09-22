'use client';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import Sidebar from '../../components/Sidebar';
import AiSymbol from '../../components/AiSymbol';
import { 
  Send, FileText, ToggleLeft, ToggleRight, Sparkles, 
  Plus, Trash2, CheckCircle2, MessageSquare, BookOpen, Clock, AlertCircle, ArrowRight
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../../lib/api';
import toast, { Toaster } from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { timeAgo } from '../../lib/utils';

export default function AIAssistant() {
  const { isAuthorized, isLoading } = useRoleGuard(['student', 'faculty', 'admin']);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [mode, setMode] = useState<'genai'|'rag'>('genai');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user'|'ai', content: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [subjectId, setSubjectId] = useState('1');
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch available subjects
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await api.get('/academic/api/subjects/');
      return res.data;
    },
    enabled: Boolean(isAuthorized)
  });

  // 2. Fetch user's persistent chat sessions
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['aiSessions'],
    queryFn: async () => {
      const res = await api.get('/Genai/api/sessions/');
      return res.data;
    },
    enabled: Boolean(isAuthorized)
  });

  // 3. Status of selected subject notes in RAG mode
  const { data: subjectStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['subjectStatus', subjectId],
    queryFn: async () => {
      if (!subjectId || subjectId === 'all') return null;
      const res = await api.get(`/Genai/api/subject-status/${subjectId}/`);
      return res.data;
    },
    enabled: Boolean(isAuthorized && mode === 'rag' && Boolean(subjectId))
  });

  useEffect(() => {
    if (!activeSessionId) {
      try {
        const saved = localStorage.getItem('nexusai_chat_history');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        }
      } catch (e) {}
    }
  }, [activeSessionId]);

  useEffect(() => {
    if (messages && messages.length > 0) {
      try {
        localStorage.setItem('nexusai_chat_history', JSON.stringify(messages));
      } catch (e) {}
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    try {
      localStorage.removeItem('nexusai_chat_history');
    } catch (e) {}
    toast.success('Started a new chat');
  };

  const loadSession = async (sessionId: number) => {
    if (activeSessionId === sessionId) return;
    setActiveSessionId(sessionId);
    setLoading(true);
    try {
      const res = await api.get(`/Genai/api/sessions/${sessionId}/`);
      if (res.data) {
        setMessages(res.data.messages || []);
        if (res.data.mode) setMode(res.data.mode);
        if (res.data.subject_id) setSubjectId(String(res.data.subject_id));
      }
    } catch (err) {
      toast.error('Failed to load chat history');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/Genai/api/sessions/${sessionId}/`);
      toast.success('Chat deleted');
      queryClient.invalidateQueries({ queryKey: ['aiSessions'] });
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
        try {
          localStorage.removeItem('nexusai_chat_history');
        } catch (e) {}
      }
    } catch (err) {
      toast.error('Failed to delete chat');
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const primaryEndpoint = mode === 'genai' ? '/Genai/api/genai/' : '/Genai/api/chat/';
      const fallbackEndpoint = mode === 'genai' ? '/Genai/api/ask/' : '/Genai/api/rag/ask/';
      const payload: any = {
        question: userMsg,
        prompt: userMsg,
        subject_id: subjectId || '1',
      };
      if (activeSessionId) {
        payload.session_id = activeSessionId;
      }
      
      let res: any;
      try {
        res = await api.post(primaryEndpoint, payload);
      } catch (postErr: any) {
        if (postErr.response?.status === 404) {
          res = await api.post(fallbackEndpoint, payload);
        } else {
          throw postErr;
        }
      }
      const answer = res.data.answer || res.data.response || "I couldn't process that request.";
      
      if (res.data.session_id && !activeSessionId) {
        setActiveSessionId(res.data.session_id);
        queryClient.invalidateQueries({ queryKey: ['aiSessions'] });
      }

      setMessages(prev => [...prev, { role: 'ai', content: answer }]);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const errorMsg = typeof detail === 'string' ? detail : 'Failed to get AI response. Please try again.';
      setMessages(prev => [...prev, { role: 'ai', content: `⚠️ ${errorMsg}` }]);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToOnline = (query: string) => {
    setMode('genai');
    setInput(query);
    toast.success('Switched to General AI mode for online search!');
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

      {/* ── Main Layout ───────────────────────────────────────── */}
      <main className="flex-1 flex overflow-hidden min-w-0">
        {/* ── SECOND PANEL: AI SESSIONS & SETTINGS ──────────────── */}
        <aside className="w-80 md:w-88 border-r border-slate-200/80 bg-white flex flex-col p-4 z-10 shrink-0">
          {/* New Chat Button */}
          <button 
            onClick={handleNewChat} 
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[#059669] hover:bg-[#047857] font-semibold text-white shadow-sm transition mb-4 text-xs"
          >
            <Plus size={16} /> New Conversation
          </button>
          
          {/* Mode Switcher */}
          <div className="mb-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Intelligence Mode</p>
            <button 
              onClick={() => {
                const nextMode = mode === 'genai' ? 'rag' : 'genai';
                setMode(nextMode);
                if (nextMode === 'rag') {
                  toast('Switched to RAG: Answers from Subject Notes', { icon: '📚' });
                } else {
                  toast('Switched to General AI: Fast Online Knowledge', { icon: '✨' });
                }
              }} 
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition text-left"
            >
              <span className="flex items-center gap-2.5 text-xs font-semibold text-slate-800">
                {mode === 'genai' ? (
                  <AiSymbol size={18} className="text-blue-600" />
                ) : (
                  <FileText size={18} className="text-emerald-600" />
                )}
                {mode === 'genai' ? 'General AI Engine' : 'Subject Notes RAG'}
              </span>
              {mode === 'genai' ? (
                <ToggleLeft size={24} className="text-slate-400" />
              ) : (
                <ToggleRight size={24} className="text-[#059669]" />
              )}
            </button>
          </div>

          {/* Knowledge Context (Subject Selector for RAG) */}
          <div className="mb-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">
              Knowledge Context
            </label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="1">General Knowledge Base</option>
              {subjects?.map((s: any) => (
                <option key={s.id} value={String(s.id)}>
                  [Sem {s.sem?.sem_nmbr || s.sem_id}] {s.sub_name}
                </option>
              ))}
            </select>

            {/* In RAG mode: display auto-chunking status */}
            {mode === 'rag' && (
              <div className="mt-2.5">
                {statusLoading ? (
                  <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>Checking subject notes...</span>
                  </div>
                ) : subjectStatus?.has_documents ? (
                  <div className="text-xs text-emerald-800 bg-[#ecfdf5] p-2.5 rounded-xl border border-emerald-200">
                    <div className="flex items-center gap-1.5 font-semibold text-xs">
                      <CheckCircle2 size={14} className="text-[#059669] shrink-0" />
                      <span>{subjectStatus.chunk_count} Chunks Indexed</span>
                    </div>
                    {subjectStatus.doc_names?.length > 0 && (
                      <p className="text-[10px] text-emerald-700/80 mt-1 truncate">
                        📄 {subjectStatus.doc_names.join(', ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-start gap-1.5">
                    <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <span>No faculty notes uploaded yet for this subject.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Persistent Chat History List */}
          <div className="flex-1 flex flex-col min-h-0 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={12} /> Chat History
              </span>
              <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">
                {sessions?.length || 0}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {sessionsLoading ? (
                <div className="text-xs text-slate-400 p-3 text-center">Loading chats...</div>
              ) : !sessions || sessions.length === 0 ? (
                <div className="text-xs text-slate-400 p-4 text-center border border-dashed border-slate-200 rounded-xl mt-2">
                  No saved conversations yet. Ask a question!
                </div>
              ) : (
                sessions.map((s: any) => {
                  const isActive = activeSessionId === s.id;
                  const isRag = s.mode === 'rag';
                  return (
                    <div
                      key={s.id}
                      onClick={() => loadSession(s.id)}
                      className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition text-left border ${
                        isActive 
                          ? 'bg-[#e8f5e9] border-emerald-300 text-[#047857] font-semibold' 
                          : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold ${
                            isRag ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-[#047857]'
                          }`}>
                            {isRag ? 'RAG' : 'AI'}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate">
                            {s.updated_at ? timeAgo(s.updated_at) : 'recently'}
                          </span>
                        </div>
                        <p className="text-xs truncate">{s.title || 'Conversation'}</p>
                      </div>

                      <button
                        onClick={(e) => handleDeleteSession(s.id, e)}
                        title="Delete chat"
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Engine Speed Indicator */}
          <div className="pt-3 mt-auto border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Fast Groq Engine
            </span>
            <span className="text-slate-400 font-mono text-[10px]">~2s Latency</span>
          </div>
        </aside>

        {/* ── RIGHT PANEL: MAIN CHAT CANVAS ───────────────────── */}
        <section className="flex-1 flex flex-col relative bg-[#f8fafc] min-w-0">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto py-10">
                <div className="w-20 h-20 rounded-3xl bg-white border border-slate-200/80 shadow-md flex items-center justify-center mb-5">
                  <AiSymbol size={44} className="text-blue-600" />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 mb-2">NexusAI Assistant</h2>
                <p className="text-slate-500 text-sm mb-8 max-w-md">
                  {mode === 'genai' 
                    ? 'Accelerated with Groq LPU: Instant answers for conceptual questions, quizzes, and code.' 
                    : 'Subject Notes RAG: Answers strictly verified against uploaded course materials.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                  {[
                    'Explain core concepts of this subject',
                    'Generate 5 practice exam questions',
                    'Summarize the important formulas',
                    'Give an overview of Unit 1'
                  ].map(s => (
                    <button 
                      key={s} 
                      onClick={() => setInput(s)} 
                      className="p-3.5 rounded-2xl border border-slate-200/80 bg-white hover:bg-emerald-50/50 hover:border-emerald-300 transition text-xs text-left text-slate-700 flex items-center justify-between shadow-xs group"
                    >
                      <span>"{s}"</span>
                      <ArrowRight size={14} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 max-w-3xl mx-auto ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-xs">
                      <AiSymbol size={18} className="text-blue-600" />
                    </div>
                  )}
                  <div className={`px-5 py-3.5 rounded-2xl shadow-xs leading-relaxed text-sm ${
                    msg.role === 'user' 
                      ? 'bg-[#059669] text-white rounded-tr-sm max-w-[80%]' 
                      : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-sm max-w-[85%] prose prose-slate prose-sm'
                  }`}>
                    {msg.role === 'user' ? (
                      msg.content
                    ) : (
                      <>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        {msg.content.toLowerCase().includes('search online') && (
                          <div className="mt-3.5 not-prose">
                            <button
                              onClick={() => {
                                let lastQuery = '';
                                for (let j = i - 1; j >= 0; j--) {
                                  if (messages[j].role === 'user') {
                                    lastQuery = messages[j].content.replace(/^\[Online Search\]\s*/, '');
                                    break;
                                  }
                                }
                                if (lastQuery) {
                                  handleSwitchToOnline(lastQuery);
                                } else {
                                  setMode('genai');
                                  toast.success('Switched to General AI mode');
                                }
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold shadow-xs transition transform active:scale-95"
                            >
                              <AiSymbol size={14} className="text-white" /> Search Online with General AI
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex gap-3 max-w-3xl mx-auto items-start">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-xs">
                  <AiSymbol size={18} className="text-blue-600 animate-spin" />
                </div>
                <div className="flex flex-col gap-1.5 px-5 py-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
                  <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <Sparkles size={13} className="text-[#059669] animate-pulse" />
                    <span>NexusAI is generating a response...</span>
                  </div>
                  <div className="flex gap-1.5 items-center mt-1">
                    <div className="w-2 h-2 bg-[#059669] rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-[#059669] rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-2 h-2 bg-[#059669] rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Input Form */}
          <div className="p-4 max-w-4xl mx-auto w-full">
            <form onSubmit={handleSend} className="relative">
              <input 
                type="text" 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                disabled={loading}
                placeholder={
                  mode === 'genai' 
                    ? "Ask NexusAI anything..." 
                    : "Ask questions from this subject's notes..."
                }
                className="w-full bg-white border border-slate-200 rounded-2xl pl-5 pr-14 py-3.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-md font-medium"
              />
              <button 
                type="submit" 
                disabled={!input.trim() || loading}
                className={`absolute right-2.5 top-2.5 p-2 rounded-xl transition ${
                  input.trim() 
                    ? 'bg-[#059669] hover:bg-[#047857] text-white shadow-xs' 
                    : 'text-slate-400 cursor-not-allowed'
                }`}
              >
                <Send size={16} />
              </button>
            </form>
            <p className="text-center text-[10px] text-slate-400 mt-2">
              NexusAI powered by Groq LPU. Always verify academic resources for exams.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
