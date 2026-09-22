'use client';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import { 
  Send, Bot, FileText, ToggleLeft, ToggleRight, Sparkles, 
  Plus, Trash2, CheckCircle2, MessageSquare, BookOpen, Clock, AlertCircle
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
  const isFaculty = Boolean(user?.role && user.role.toLowerCase() !== 'student');
  
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

  if (isLoading || !isAuthorized) return null;

  return (
    <div className="flex h-screen bg-slate-900 relative text-slate-100">
      {isFaculty ? <Sidebar /> : <div className="absolute top-0 w-full z-10"><Navbar /></div>}
      <Toaster position="top-right" />
      
      <main className={`flex-1 flex overflow-hidden ${!isFaculty ? 'pt-16' : ''}`}>
        {/* Left Sidebar: Controls & Persistent Chat History */}
        <div className="w-72 md:w-80 border-r border-slate-800 bg-slate-950/70 flex flex-col p-4 shrink-0">
          <button 
            onClick={handleNewChat} 
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 font-semibold text-white shadow-lg shadow-purple-900/30 transition mb-5 text-sm"
          >
            <Plus size={18} /> New Chat
          </button>
          
          {/* Mode Switcher */}
          <div className="mb-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Mode</p>
            <button 
              onClick={() => {
                const nextMode = mode === 'genai' ? 'rag' : 'genai';
                setMode(nextMode);
                if (nextMode === 'rag') {
                  toast('Switched to RAG Mode: Answers from Subject Notes', { icon: '📚' });
                } else {
                  toast('Switched to General AI Mode: Online Knowledge', { icon: '✨' });
                }
              }} 
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
            >
              <span className="flex items-center gap-2.5 text-sm font-medium">
                {mode === 'genai' ? (
                  <Sparkles size={18} className="text-purple-400" />
                ) : (
                  <FileText size={18} className="text-blue-400" />
                )}
                {mode === 'genai' ? 'General AI' : 'Subject Notes RAG'}
              </span>
              {mode === 'genai' ? (
                <ToggleLeft size={24} className="text-slate-500" />
              ) : (
                <ToggleRight size={24} className="text-blue-400" />
              )}
            </button>
          </div>

          {/* Knowledge Context (Subject Selector for RAG) */}
          <div className="mb-4">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
              Knowledge Context
            </label>
            <select 
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
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

            {/* In RAG mode: display auto-chunking status of notes without asking student for PDF */}
            {mode === 'rag' && (
              <div className="mt-2.5">
                {statusLoading ? (
                  <div className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    <span>Checking subject notes...</span>
                  </div>
                ) : subjectStatus?.has_documents ? (
                  <div className="text-xs text-emerald-300 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                      <span>{subjectStatus.chunk_count} Note Chunks Ready</span>
                    </div>
                    {subjectStatus.doc_names?.length > 0 && (
                      <p className="text-[11px] text-emerald-400/80 mt-1 truncate">
                        📄 {subjectStatus.doc_names.join(', ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-amber-300 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 flex items-start gap-2">
                    <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                    <span>No faculty notes uploaded for this subject yet. You can still ask questions via General AI.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Persistent Chat History List */}
          <div className="flex-1 flex flex-col min-h-0 border-t border-slate-800/80 pt-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={13} /> Chat History
              </span>
              <span className="text-[10px] text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded-full">
                {sessions?.length || 0}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {sessionsLoading ? (
                <div className="text-xs text-slate-500 p-3 text-center">Loading chats...</div>
              ) : !sessions || sessions.length === 0 ? (
                <div className="text-xs text-slate-500 p-4 text-center border border-dashed border-slate-800 rounded-xl mt-2">
                  No saved conversations yet. Ask a question to start!
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
                          ? 'bg-purple-600/15 border-purple-500/40 text-purple-200' 
                          : 'bg-slate-900/40 border-slate-800/60 hover:bg-slate-800/60 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            isRag ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          }`}>
                            {isRag ? 'RAG' : 'GenAI'}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate">
                            {s.updated_at ? timeAgo(s.updated_at) : 'recently'}
                          </span>
                        </div>
                        <p className="text-xs font-medium truncate">{s.title || 'Conversation'}</p>
                      </div>

                      <button
                        onClick={(e) => handleDeleteSession(s.id, e)}
                        title="Delete chat"
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col relative bg-slate-900">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto py-10">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-2xl ${mode === 'genai' ? 'bg-purple-600 shadow-purple-900/50' : 'bg-blue-600 shadow-blue-900/50'}`}>
                  <Bot size={40} className="text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-2">NexusAI Assistant</h2>
                <p className="text-slate-400 mb-8 max-w-md">
                  {mode === 'genai' 
                    ? 'General AI with vast online knowledge for conceptual questions, quizzes, and code.' 
                    : 'Subject Notes RAG mode: Answers strictly from faculty-uploaded course materials.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                  {[
                    'Explain quantum computing',
                    'Summarize core concepts',
                    'Generate practice quiz',
                    'Important exam questions'
                  ].map(s => (
                    <button 
                      key={s} 
                      onClick={() => setInput(s)} 
                      className="p-3.5 rounded-xl border border-slate-800 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-700 transition text-xs text-left text-slate-300 flex items-center justify-between"
                    >
                      <span>"{s}"</span>
                      <Sparkles size={14} className="text-slate-500" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex gap-4 max-w-3xl mx-auto ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'ai' && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${mode === 'genai' ? 'bg-purple-600' : 'bg-blue-600'}`}>
                      <Bot size={16} className="text-white" />
                    </div>
                  )}
                  <div className={`px-5 py-3.5 rounded-2xl shadow-md ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-tr-sm' 
                      : 'bg-slate-800/70 border border-slate-800 text-slate-200 prose prose-invert prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 max-w-[85%]'
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
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-purple-900/30 transition transform active:scale-95"
                            >
                              <Sparkles size={15} /> Search Online with General AI
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
              <div className="flex gap-4 max-w-3xl mx-auto">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${mode === 'genai' ? 'bg-purple-600' : 'bg-blue-600'}`}>
                  <Bot size={16} className="text-white" />
                </div>
                <div className="flex gap-1.5 items-center px-4 py-3 bg-slate-800/40 rounded-2xl border border-slate-800">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

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
                className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-2xl text-sm"
              />
              <button 
                type="submit" 
                disabled={!input.trim() || loading}
                className={`absolute right-3 top-3 p-2 rounded-xl transition ${
                  input.trim() 
                    ? (mode === 'genai' ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-blue-600 text-white hover:bg-blue-500') 
                    : 'text-slate-500 cursor-not-allowed'
                }`}
              >
                <Send size={18} />
              </button>
            </form>
            <p className="text-center text-[11px] text-slate-500 mt-2.5">
              NexusAI can make mistakes. Verify important course information.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
