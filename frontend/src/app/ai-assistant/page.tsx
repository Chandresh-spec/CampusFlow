'use client';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import { Send, Bot, FileText, ToggleLeft, ToggleRight, Sparkles, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../../lib/api';
import toast, { Toaster } from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';

export default function AIAssistant() {
  const { user } = useAuth();
  const isFaculty = user?.role?.toLowerCase() !== 'student';
  const [mode, setMode] = useState<'genai'|'rag'>('genai');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user'|'ai', content: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [subjectId, setSubjectId] = useState('1');
  const [uploadedDocName, setUploadedDocName] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await api.get('/academic/api/subjects/');
      return res.data;
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      let response = '';
      if (mode === 'genai') {
        const res = await api.post('/Genai/api/genai/', { 
          question: userMsg,
          prompt: userMsg 
        });
        response = res.data.response || res.data.answer || 'No response received.';
      } else {
        const res = await api.post('/Genai/api/chat/', { 
          question: userMsg, 
          prompt: userMsg,
          subject_id: String(subjectId || '1') 
        });
        response = res.data.answer || res.data.response || 'No response received.';
      }
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subject_id', String(subjectId || '1'));
    
    const toastId = toast.loading(`Indexing ${file.name}...`);
    try {
      await api.post('/Genai/api/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadedDocName(file.name);
      toast.success('Document indexed successfully!', { id: toastId });
      setMode('rag');
      setMessages(prev => [
        ...prev,
        { role: 'ai', content: `📄 Successfully indexed **${file.name}**! You can now ask questions based on this document.` }
      ]);
    } catch (err: any) {
      console.error('Upload error:', err);
      const errMsg = err?.response?.data?.detail || 'Upload and indexing failed';
      toast.error(errMsg, { id: toastId });
    }
  };

  return (
    <div className="flex h-screen bg-slate-900 relative">
      {isFaculty ? <Sidebar /> : <div className="absolute top-0 w-full z-10"><Navbar /></div>}
      <Toaster position="top-right" />
      
      <main className={`flex-1 flex overflow-hidden ${!isFaculty ? 'pt-16' : ''}`}>
        <div className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col p-4">
          <button onClick={() => setMessages([])} className="flex items-center gap-2 w-full py-2 px-4 rounded-lg border border-slate-700 hover:bg-slate-800 transition mb-6">
            <Plus size={16} /> New Chat
          </button>
          
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mode</p>
            <button onClick={() => setMode(mode === 'genai' ? 'rag' : 'genai')} className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800 border border-slate-700">
              <span className="flex items-center gap-2 text-sm">
                {mode === 'genai' ? <Sparkles size={16} className="text-purple-400" /> : <FileText size={16} className="text-blue-400" />}
                {mode === 'genai' ? 'General AI' : 'Doc RAG'}
              </span>
              {mode === 'genai' ? <ToggleLeft size={20} className="text-slate-400" /> : <ToggleRight size={20} className="text-blue-400" />}
            </button>
          </div>

          <div className="mb-4">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Knowledge Context</label>
            <select 
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
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
          </div>

          {mode === 'rag' && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Knowledge Base</p>
              <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
              <button onClick={() => fileInputRef.current?.click()} className="w-full text-sm text-left py-2.5 px-3 rounded bg-slate-800/50 hover:bg-slate-800 text-blue-400 border border-blue-900/30 border-dashed flex items-center gap-2">
                <Plus size={16} /> Upload PDF Notes
              </button>
              {uploadedDocName && (
                <div className="mt-2 text-xs text-blue-300 bg-blue-500/10 p-2 rounded border border-blue-500/20 truncate flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-blue-400 shrink-0" />
                  <span className="truncate">{uploadedDocName}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col relative bg-slate-900">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-2xl ${mode === 'genai' ? 'bg-purple-600 shadow-purple-900/50' : 'bg-blue-600 shadow-blue-900/50'}`}>
                  <Bot size={40} className="text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-2">NexusAI</h2>
                <p className="text-slate-400 mb-8">
                  {mode === 'genai' ? 'Your AI teaching and learning assistant.' : 'Ask questions based on your uploaded documents.'}
                </p>
                <div className="grid grid-cols-2 gap-4 w-full">
                  {['Explain quantum computing', 'Summarize notes', 'Generate quiz', 'Debug code'].map(s => (
                    <button key={s} onClick={() => setInput(s)} className="p-4 rounded-xl border border-slate-800 bg-slate-800/30 hover:bg-slate-800 transition text-sm text-left text-slate-300">
                      "{s}"
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
                  <div className={`px-5 py-3 rounded-2xl ${msg.role === 'user' ? 'bg-slate-800 text-white rounded-tr-sm' : 'bg-transparent text-slate-200 prose prose-invert prose-p:leading-relaxed prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-700 max-w-[85%]'}`}>
                    {msg.role === 'user' ? msg.content : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
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
                <div className="flex gap-1 items-center px-4">
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 max-w-4xl mx-auto w-full">
            <form onSubmit={handleSend} className="relative">
              <input type="text" value={input} onChange={e => setInput(e.target.value)} disabled={loading}
                placeholder={mode === 'genai' ? "Ask NexusAI anything..." : "Ask a question about your document..."}
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-xl"
              />
              <button type="submit" disabled={!input.trim() || loading}
                className={`absolute right-3 top-3 p-2 rounded-xl transition ${input.trim() ? (mode === 'genai' ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-blue-600 text-white hover:bg-blue-500') : 'text-slate-500'}`}>
                <Send size={18} />
              </button>
            </form>
            <p className="text-center text-xs text-slate-500 mt-3">NexusAI can make mistakes. Verify important information.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
