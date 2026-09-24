'use client';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import Navbar from '../../components/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { 
  Bell, 
  Plus, 
  X, 
  Trash2, 
  CheckCircle2, 
  Calendar, 
  GraduationCap, 
  Megaphone,
  Loader2 
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { timeAgo } from '../../lib/utils';

export default function Notices() {
  const { isAuthorized, isLoading } = useRoleGuard(['student', 'faculty', 'admin']);
  const { user } = useAuth();
  const isFaculty = Boolean(user?.role && user.role.toLowerCase() !== 'student');
  const queryClient = useQueryClient();
  
  const [filter, setFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [noticeData, setNoticeData] = useState({ title: '', content: '', target_semester: '' });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
    },
    onError: () => {
      toast.error('Failed to delete notice');
    }
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string | number) => api.post(`/notice/api/notices/${id}/dismiss/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      toast.success('Notice marked as read');
    },
    onError: () => {
      toast.error('Failed to dismiss notice');
    }
  });

  if (isLoading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filteredNotices = notices?.filter((n: any) => {
    if (filter === 'All') return true;
    if (filter === 'General') return !n.target_semester;
    if (filter === 'My Semester') return Number(n.target_semester) === Number(user?.sem || user?.semester);
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans pb-24 relative">
      <Navbar />
      <Toaster position="top-right" />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* ── Page Header Banner ─────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#059669] via-emerald-500 to-teal-400" />
          
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-[#059669] text-xs font-bold uppercase tracking-wider mb-2">
              <Megaphone size={13} />
              College Broadcasts
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              Official Notice Board
              <span className="bg-emerald-50 text-[#059669] border border-emerald-200 text-xs px-2.5 py-1 rounded-full font-bold">
                {filteredNotices?.length || 0}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Important circulars, exam dates, semester announcements, and administrative updates.
            </p>
          </div>

          {isFaculty && (
            <button 
              onClick={() => setIsModalOpen(true)} 
              className="flex items-center justify-center gap-2 bg-[#059669] hover:bg-[#047857] text-white px-5 py-3 rounded-2xl font-bold shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 transition-all duration-200 w-full sm:w-auto text-sm shrink-0"
            >
              <Plus size={18} />
              <span>Post New Notice</span>
            </button>
          )}
        </div>

        {/* ── Filter Tabs ────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {['All', 'General', 'My Semester'].map(f => {
            const active = filter === f;
            return (
              <button 
                key={f} 
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border ${
                  active 
                    ? 'bg-[#059669] text-white border-[#059669] shadow-xs' 
                    : 'bg-white border-slate-200/90 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/30'
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>

        {/* ── Notices Stream ─────────────────────────────────────── */}
        <div className="space-y-4">
          {noticesLoading ? (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center text-slate-400">
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium">Loading circulars and notices...</p>
            </div>
          ) : (!filteredNotices || filteredNotices.length === 0) ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/90 shadow-xs p-8 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#059669] flex items-center justify-center mx-auto border border-emerald-100">
                <Bell size={26} />
              </div>
              <h3 className="text-base font-bold text-slate-800">No notices currently posted</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Check back later for announcements regarding syllabus, exams, and college events.
              </p>
            </div>
          ) : (
            filteredNotices.map((notice: any) => {
              const isLong = (notice.content || '').length > 220;
              const isExpanded = expanded[notice.id];
              
              return (
                <div 
                  key={notice.id} 
                  className="bg-white border border-slate-200/90 hover:border-emerald-200 rounded-3xl p-6 sm:p-7 shadow-xs transition-all relative group"
                >
                  {/* Action Buttons (Delete or Mark as Read) */}
                  <div className="absolute top-6 right-6 flex items-center gap-1.5">
                    {isFaculty ? (
                      <button 
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this notice?')) {
                            deleteMutation.mutate(notice.id);
                          }
                        }} 
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 p-2 rounded-xl transition"
                        title="Delete Notice"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <button 
                        onClick={() => dismissMutation.mutate(notice.id)} 
                        title="Mark as read" 
                        className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-slate-200 p-2 rounded-xl transition"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#059669] flex items-center justify-center shrink-0 border border-emerald-100">
                      <Bell size={22} />
                    </div>

                    <div className="flex-1 pr-12">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <h3 className="font-bold text-base sm:text-lg text-slate-900 leading-snug">
                          {notice.title}
                        </h3>
                        {notice.target_semester && (
                          <span className="bg-emerald-50 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-lg border border-emerald-200">
                            Sem {notice.target_semester}
                          </span>
                        )}
                        {!notice.target_semester && (
                          <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-slate-200">
                            General
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 mb-3 flex items-center gap-1.5 font-medium">
                        <span>{notice.author_name || notice.posted_by || 'Administration'}</span>
                        <span>•</span>
                        <span>{timeAgo(notice.created_at)}</span>
                      </p>
                      
                      <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {isExpanded || !isLong ? notice.content : `${notice.content.substring(0, 220)}...`}
                      </div>
                      
                      {isLong && (
                        <button 
                          onClick={() => setExpanded(prev => ({ ...prev, [notice.id]: !isExpanded }))} 
                          className="text-[#059669] hover:text-[#047857] text-xs font-bold mt-2.5 hover:underline inline-block"
                        >
                          {isExpanded ? 'Show less' : 'Read full notice →'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Post Notice Modal ──────────────────────────────────── */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-lg p-6 sm:p-8 rounded-3xl relative border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-xl transition"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#059669] flex items-center justify-center border border-emerald-100">
                  <Megaphone size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Post Announcement</h2>
                  <p className="text-xs text-slate-500">Publish a campus-wide or semester-targeted circular</p>
                </div>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(noticeData); }} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Notice Title *
                  </label>
                  <input 
                    required 
                    type="text" 
                    placeholder="e.g. Midterm Examination Schedule Announcement"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white transition"
                    value={noticeData.title} 
                    onChange={e => setNoticeData({ ...noticeData, title: e.target.value })} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Target Semester (Optional)
                  </label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white transition"
                    value={noticeData.target_semester} 
                    onChange={e => setNoticeData({ ...noticeData, target_semester: e.target.value })}
                  >
                    <option value="">All Semesters (General Broadcast)</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Notice Content *
                  </label>
                  <textarea 
                    required 
                    rows={5} 
                    placeholder="Enter full announcement details, deadlines, and instructions..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white transition"
                    value={noticeData.content} 
                    onChange={e => setNoticeData({ ...noticeData, content: e.target.value })} 
                  />
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={createMutation.isPending} 
                    className="w-full bg-[#059669] hover:bg-[#047857] text-white rounded-2xl py-3.5 font-bold transition-all shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 size={18} className="animate-spin" /> Publishing...
                      </>
                    ) : (
                      'Publish Notice'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
