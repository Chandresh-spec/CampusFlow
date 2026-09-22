'use client';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import Sidebar from '../../components/Sidebar';
import AiSymbol from '../../components/AiSymbol';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Bell, Plus, X, Trash2, CheckCircle2, ChevronDown, User, LogOut, Sparkles } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { timeAgo } from '../../lib/utils';
import Link from 'next/link';

export default function Notices() {
  const { isAuthorized, isLoading } = useRoleGuard(['student', 'faculty', 'admin']);
  const { user, logout } = useAuth();
  const isFaculty = Boolean(user?.role && user.role.toLowerCase() !== 'student');
  const queryClient = useQueryClient();
  
  const [filter, setFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [noticeData, setNoticeData] = useState({ title: '', content: '', target_semester: '' });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const { data: notices, isLoading: noticesLoading } = useQuery({
    queryKey: ['notices'],
    queryFn: async () => {
      const res = await api.get('/notice/api/notices/');
      return res.data;
    },
    enabled: Boolean(isAuthorized)
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/notice/api/notices/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      toast.success('Notice posted successfully');
      setIsModalOpen(false);
      setNoticeData({ title: '', content: '', target_semester: '' });
    },
    onError: () => {
      toast.error('Failed to post notice');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => api.delete(`/notice/api/notices/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      toast.success('Notice deleted');
    }
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string | number) => api.post(`/notice/api/notices/${id}/dismiss/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      toast.success('Notice marked as read');
    }
  });

  if (isLoading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filteredNotices = notices?.filter((n: any) => {
    if (filter === 'All') return true;
    if (filter === 'General') return !n.target_semester;
    if (filter === 'My Semester') return Number(n.target_semester) === Number(user?.sem || user?.semester);
    return true;
  });

  const username = user?.username || 'User';
  const initial = username.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col md:flex-row relative font-sans antialiased">
      <Toaster position="top-right" />

      {/* ── Left Sidebar ────────────────────────────────────────────── */}
      <Sidebar />

      {/* ── Main Content Area ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="px-6 md:px-10 py-4 flex items-center justify-end border-b border-slate-200/60 bg-white/60 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Ask AI quick pill */}
            <Link
              href="/ai-assistant"
              title="Open NexusAI Assistant"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ecfdf5] hover:bg-[#dcfce7] text-[#047857] border border-emerald-200 text-xs font-bold transition shadow-xs"
            >
              <AiSymbol size={15} className="text-blue-600 animate-pulse" />
              <span>Ask AI</span>
            </Link>

            {/* Notification Bell */}
            <Link
              href="/notices"
              title="Notices"
              className="p-2 text-slate-500 hover:text-slate-800 transition relative rounded-full hover:bg-slate-100"
            >
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
            </Link>

            {/* User Dropdown Pill */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-full hover:bg-slate-100 transition"
              >
                <div className="w-8 h-8 rounded-full bg-[#0f766e] text-white font-bold text-xs flex items-center justify-center shadow-sm">
                  {initial}
                </div>
                <span className="text-sm font-semibold text-slate-700 hidden sm:inline">
                  {username}
                </span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-40 text-sm">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="font-bold text-slate-800">{username}</p>
                    <p className="text-xs text-slate-400 capitalize">{user?.role || 'Student'}</p>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                  >
                    <User size={16} /> Profile
                  </Link>
                  <button
                    onClick={() => { setProfileDropdownOpen(false); logout(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-600 hover:bg-red-50 text-left transition"
                  >
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Notices Body */}
        <div className="p-6 md:p-10 space-y-6 max-w-5xl w-full mx-auto">
          {/* Header Action Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-3">
                <span>Department Notice Board</span>
                <span className="bg-emerald-100 text-[#047857] text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {filteredNotices?.length || 0} notices
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">Official announcements from professors and departments</p>
            </div>

            {isFaculty && (
              <button 
                onClick={() => setIsModalOpen(true)} 
                className="flex items-center gap-2 bg-[#059669] hover:bg-[#047857] text-white px-4 py-2 rounded-xl font-semibold text-xs transition shadow-sm"
              >
                <Plus size={16} /> Post New Notice
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex gap-2 pb-1 overflow-x-auto">
            {['All', 'General', 'My Semester'].map(f => (
              <button 
                key={f} 
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition shadow-xs ${
                  filter === f 
                    ? 'bg-[#059669] text-white shadow-emerald-700/20' 
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Notices List */}
          <div className="space-y-4">
            {noticesLoading ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs">Loading notices...</p>
              </div>
            ) : (!filteredNotices || filteredNotices.length === 0) ? (
              <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center text-slate-400">
                <Bell size={40} className="mx-auto text-slate-300 mb-3" />
                <h3 className="font-bold text-sm text-slate-700">No notices right now</h3>
                <p className="text-xs text-slate-400 mt-1">All caught up! Check back later for new announcements.</p>
              </div>
            ) : (
              filteredNotices.map((notice: any) => {
                const isLong = notice.content?.length > 200;
                const isExpanded = expanded[notice.id];
                
                return (
                  <div key={notice.id} className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm relative group hover:shadow-md transition">
                    <div className="absolute top-5 right-5 flex gap-2">
                      {isFaculty ? (
                        <button 
                          onClick={() => { if (confirm('Are you sure you want to delete this notice?')) deleteMutation.mutate(notice.id); }} 
                          className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition"
                          title="Delete notice"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => dismissMutation.mutate(notice.id)} 
                          title="Mark as read" 
                          className="text-slate-400 hover:text-[#059669] p-1.5 rounded-lg hover:bg-emerald-50 transition"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      )}
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="bg-emerald-50 p-3 rounded-2xl text-[#059669] shrink-0 mt-0.5 border border-emerald-100">
                        <Bell size={20} />
                      </div>
                      <div className="flex-1 pr-12">
                        <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                          <h3 className="font-bold text-base text-slate-900">{notice.title}</h3>
                          {notice.target_semester && (
                            <span className="bg-emerald-50 text-[#047857] text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                              Semester {notice.target_semester}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mb-3">
                          {notice.author_name || 'Faculty'} • {timeAgo(notice.created_at)}
                        </p>
                        
                        <div className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                          {isExpanded || !isLong ? notice.content : `${notice.content.substring(0, 200)}...`}
                        </div>
                        
                        {isLong && (
                          <button 
                            onClick={() => setExpanded(prev => ({ ...prev, [notice.id]: !isExpanded }))} 
                            className="text-[#059669] hover:underline text-xs font-semibold mt-2"
                          >
                            {isExpanded ? 'Show less' : 'Read full notice'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* ── Post Notice Modal (Faculty Only) ───────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-lg p-6 md:p-8 rounded-3xl relative shadow-2xl">
            <button 
              onClick={() => setIsModalOpen(false)} 
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-extrabold text-slate-900 mb-5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#059669] flex items-center justify-center">
                <Bell size={18} />
              </div>
              <span>Post New Notice</span>
            </h2>

            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(noticeData); }} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Notice Title *</label>
                <input 
                  required 
                  type="text" 
                  value={noticeData.title}
                  onChange={e => setNoticeData({ ...noticeData, title: e.target.value })}
                  placeholder="e.g. Midterm Examination Schedule Released" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Target Semester (Optional)</label>
                <select 
                  value={noticeData.target_semester}
                  onChange={e => setNoticeData({ ...noticeData, target_semester: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
                >
                  <option value="">All Semesters (General Notice)</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                    <option key={s} value={String(s)}>Semester {s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Notice Content *</label>
                <textarea 
                  required 
                  rows={5} 
                  value={noticeData.content}
                  onChange={e => setNoticeData({ ...noticeData, content: e.target.value })}
                  placeholder="Enter detailed notice information here..." 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={createMutation.isPending}
                  className="px-6 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold transition shadow-sm disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Posting...' : 'Publish Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
