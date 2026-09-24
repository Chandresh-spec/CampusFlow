'use client';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import Navbar from '../../components/Navbar';
import { 
  Send, 
  Bot, 
  FileText, 
  ToggleLeft, 
  ToggleRight, 
  Sparkles, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Menu,
  X,
  ChevronRight,
  BookOpen
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
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
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

  // 2. Fetch user's persistent chat sessions (both GenAI and RAG)
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

  // Restore client-side backup if no active session
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

  // Keep client backup synced
  useEffect(() => {
    if (messages && messages.length > 0) {
      try {
        localStorage.setItem('nexusai_chat_history', JSON.stringify(messages));
      } catch (e) {}
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setMobileDrawerOpen(false);
    try {
      localStorage.removeItem('nexusai_chat_history');
    } catch (e) {}
    toast.success('Started a new conversation');
  };

  const loadSession = async (sessionId: number) => {
    if (activeSessionId === sessionId) {
      setMobileDrawerOpen(false);
      return;
    }
    setActiveSessionId(sessionId);
    setMobileDrawerOpen(false);
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
      let response = '';
      let returnedSessionId = activeSessionId;

      if (mode === 'genai') {
        const res = await api.post('/Genai/api/genai/', { 
          question: userMsg,
          prompt: userMsg,
          session_id: activeSessionId
        });
        response = res.data.response || res.data.answer || 'No response received.';
        if (res.data.session_id) returnedSessionId = res.data.session_id;
      } else {
        const res = await api.post('/Genai/api/chat/', { 
          question: userMsg, 
          prompt: userMsg,
          subject_id: String(subjectId || '1'),
          session_id: activeSessionId
        });
        response = res.data.answer || res.data.response || 'No response received.';
        if (res.data.session_id) returnedSessionId = res.data.session_id;
      }

      if (returnedSessionId && returnedSessionId !== activeSessionId) {
        setActiveSessionId(returnedSessionId);
      }
      queryClient.invalidateQueries({ queryKey: ['aiSessions'] });
      setMessages(prev => [...prev, { role: 'ai', content: response }]);
    } catch (err: any) {
      console.error('AI assistant error:', err);
      const errMsg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Failed to get AI response';
      toast.error(errMsg);
      setMessages(prev => [
        ...prev, 
        { role: 'ai', content: `⚠️ **Error**: ${errMsg}. Please ensure the backend is running.` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToOnline = async (userQuery: string) => {
    setMode('genai');
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: `[Online Search] ${userQuery}` }]);
    try {
      const res = await api.post('/Genai/api/genai/', { 
        question: userQuery,
        prompt: userQuery,
        session_id: activeSessionId
      });
      const response = res.data.response || res.data.answer || 'No response received.';
      if (res.data.session_id && res.data.session_id !== activeSessionId) {
        setActiveSessionId(res.data.session_id);
      }
      queryClient.invalidateQueries({ queryKey: ['aiSessions'] });
      setMessages(prev => [...prev, { role: 'ai', content: response }]);
    } catch (err: any) {
      toast.error('Failed to get online AI response');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Sidebar Controls content shared between desktop sidebar and mobile drawer
  const sidebarControls = (
    <div className="flex flex-col h-full">
      <button 
        onClick={handleNewChat} 
        className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-2xl bg-[#059669] hover:bg-[#047857] font-bold text-white shadow-md shadow-emerald-600/20 transition-all mb-5 text-sm"
      >
        <Plus size={18} /> New Conversation
      </button>
      
      {/* Mode Switcher */}
      <div className="mb-4">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
          Intelligence Mode
        </p>
        <button 
          onClick={() => {
            const nextMode = mode === 'genai' ? 'rag' : 'genai';
            setMode(nextMode);
            if (nextMode === 'rag') {
              toast('RAG Mode: Querying syllabus notes & documents', { icon: '📚' });
            } else {
              toast('General AI: Fast online inference', { icon: '✨' });
            }
          }} 
          className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:border-emerald-300 transition text-left"
        >
          <span className="flex items-center gap-2.5 text-xs font-bold text-slate-800">
            {mode === 'genai' ? (
              <Sparkles size={17} className="text-[#059669]" />
            ) : (
              <BookOpen size={17} className="text-teal-600" />
            )}
            <span>{mode === 'genai' ? 'General Academic AI' : 'Subject Notes RAG'}</span>
          </span>
          {mode === 'genai' ? (
            <ToggleLeft size={24} className="text-slate-400" />
          ) : (
            <ToggleRight size={24} className="text-[#059669]" />
          )}
        </button>
      </div>

      {/* Knowledge Context Selector */}
      <div className="mb-4">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
          Course Context
        </label>
        <select 
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white transition"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        >
          <option value="1">General College Curriculum</option>
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
              <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <span>Checking indexed course notes...</span>
              </div>
            ) : subjectStatus?.has_documents ? (
              <div className="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>{subjectStatus.chunk_count} Note Chunks Indexed</span>
                </div>
                {subjectStatus.doc_names?.length > 0 && (
                  <p className="text-[11px] text-emerald-700 mt-1 truncate">
                    📄 {subjectStatus.doc_names.join(', ')}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-start gap-2">
                <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <span>No notes uploaded for this subject yet. General AI answers remain active.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Saved Conversations List */}
      <div className="flex-1 flex flex-col min-h-0 border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Clock size={13} /> Chat History
          </span>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            {sessions?.length || 0}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {sessionsLoading ? (
            <div className="text-xs text-slate-400 p-3 text-center">Loading history...</div>
          ) : !sessions || sessions.length === 0 ? (
            <div className="text-xs text-slate-400 p-4 text-center border border-dashed border-slate-200 rounded-2xl mt-2">
              No saved conversations yet. Ask a question to begin!
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
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950 font-bold' 
                      : 'bg-slate-50/80 border-slate-200/80 hover:bg-white text-slate-700'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        isRag ? 'bg-teal-100 text-teal-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {isRag ? 'RAG' : 'GenAI'}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate font-normal">
                        {s.updated_at ? timeAgo(s.updated_at) : 'recently'}
                      </span>
                    </div>
                    <p className="text-xs truncate">{s.title || 'Conversation'}</p>
                  </div>

                  <button
                    onClick={(e) => handleDeleteSession(s.id, e)}
                    title="Delete chat"
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Engine Status */}
      <div className="pt-3 mt-auto border-t border-slate-100 flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 text-[#059669] font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          AI Model Active
        </span>
        <span className="text-slate-400 font-mono text-[10px]">CampusFlow Engine</span>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-[#f8fafc] text-slate-800 font-sans overflow-hidden">
      <Navbar />
      <Toaster position="top-right" />

      <main className="flex-1 flex overflow-hidden relative">
        {/* Desktop Left Sidebar: Controls & History */}
        <aside className="hidden lg:flex w-80 border-r border-slate-200/90 bg-white flex-col p-4 shrink-0">
          {sidebarControls}
        </aside>

        {/* Mobile Drawer (Collapsible) */}
        {mobileDrawerOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div 
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <div className="relative w-4/5 max-w-sm bg-white p-5 shadow-2xl flex flex-col h-full z-50">
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold text-slate-900 text-sm">Assistant Options & History</span>
                <button 
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>
              {sidebarControls}
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <section className="flex-1 flex flex-col relative bg-[#f8fafc] overflow-hidden">
          {/* Mobile Top Sub-bar */}
          <div className="lg:hidden h-14 bg-white border-b border-slate-200/90 px-4 flex items-center justify-between shrink-0">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-100"
            >
              <Menu size={16} />
              <span>Options & History</span>
            </button>

            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <Sparkles size={13} className="text-[#059669]" />
              {mode === 'genai' ? 'General AI' : 'Notes RAG'}
            </span>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto py-10">
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-5 text-[#059669] shadow-sm">
                  <Bot size={34} />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2 tracking-tight">
                  CampusFlow AI Assistant
                </h2>
                <p className="text-slate-500 mb-8 max-w-md text-xs sm:text-sm">
                  {mode === 'genai' 
                    ? 'General Academic AI with vast knowledge for concepts, problem-solving, and code.' 
                    : 'Notes RAG mode: Answers strictly from faculty-uploaded course materials and syllabus.'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
                  {[
                    'Explain asymptotic time complexity',
                    'Summarize core chapter concepts',
                    'Generate practice quiz questions',
                    'Important exam review tips'
                  ].map(s => (
                    <button 
                      key={s} 
                      onClick={() => setInput(s)} 
                      className="p-3.5 rounded-2xl border border-slate-200/90 bg-white hover:border-emerald-300 hover:bg-emerald-50/50 transition-all text-xs font-medium text-left text-slate-700 flex items-center justify-between shadow-xs group"
                    >
                      <span className="truncate">&quot;{s}&quot;</span>
                      <Sparkles size={14} className="text-emerald-500 group-hover:scale-110 transition-transform shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 max-w-3xl mx-auto ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'ai' && (
                    <div className="w-8 h-8 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 text-[#059669] shadow-xs">
                      <Bot size={16} />
                    </div>
                  )}
                  <div className={`px-4 sm:px-5 py-3 rounded-2xl shadow-xs text-sm ${
                    msg.role === 'user' 
                      ? 'bg-[#059669] text-white rounded-tr-xs' 
                      : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs prose prose-slate max-w-[85%] sm:max-w-[80%]'
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
                              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold shadow-xs transition"
                            >
                              <Sparkles size={14} /> Search Online with General AI
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
                <div className="w-8 h-8 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 text-[#059669]">
                  <Bot size={16} />
                </div>
                <div className="flex flex-col gap-2 px-4 py-3 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center gap-2 text-xs text-emerald-700 font-bold">
                    <Sparkles size={13} className="text-[#059669] animate-pulse" />
                    <span>AI is formulating an answer...</span>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Input Bar */}
          <div className="p-3 sm:p-4 bg-white border-t border-slate-200/90 shrink-0">
            <div className="max-w-4xl mx-auto w-full">
              <form onSubmit={handleSend} className="relative">
                <input 
                  type="text" 
                  value={input} 
                  onChange={e => setInput(e.target.value)} 
                  disabled={loading}
                  placeholder={
                    mode === 'genai' 
                      ? "Ask CampusFlow AI anything about your coursework..." 
                      : "Ask questions strictly from this subject's syllabus notes..."
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-4 pr-12 py-3.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white shadow-xs transition"
                />
                <button 
                  type="submit" 
                  disabled={!input.trim() || loading}
                  className="absolute right-2.5 top-2.5 p-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                >
                  <Send size={16} />
                </button>
              </form>
              <p className="text-center text-[10px] text-slate-400 mt-2">
                CampusFlow AI generates educational guidance. Verify critical course details with faculty.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
