'use client';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Bell, Plus, X, Trash2, CheckCircle2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { timeAgo } from '../../lib/utils';

export default function Notices() {
  const { user } = useAuth();
  const isFaculty = user?.role.toLowerCase() !== 'student';
  const { isAuthorized, isLoading } = useRoleGuard(['student', 'faculty', 'admin']);
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
      toast.success('Notice posted');
      setIsModalOpen(false);
      setNoticeData({ title: '', content: '', target_semester: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notice/api/notices/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      toast.success('Notice deleted');
    }
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => api.post(`/notice/api/notices/${id}/dismiss/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      toast.success('Notice dismissed');
    }
  });

  if (isLoading || !isAuthorized) return null;

  const filteredNotices = notices?.filter((n: any) => {
    if (filter === 'All') return true;
    if (filter === 'General') return !n.target_semester;
    if (filter === 'My Semester') return n.target_semester === user?.semester;
    return true;
  });

  return (
    <div className={`flex h-screen ${isFaculty ? 'bg-slate-900' : 'bg-slate-900'} relative`}>
      {isFaculty ? <Sidebar /> : <div className="absolute top-0 w-full z-10"><Navbar /></div>}
      <Toaster position="top-right" />
      
      <main className={`flex-1 overflow-y-auto p-8 ${!isFaculty ? 'pt-24' : ''}`}>
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                Notice Board <span className="bg-purple-600 text-xs px-2 py-1 rounded-full">{filteredNotices?.length || 0}</span>
              </h1>
            </div>
            {isFaculty && (
              <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 rounded-xl font-medium hover:opacity-90 transition">
                <Plus size={20} /> Post Notice
              </button>
            )}
          </div>

          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {['All', 'General', 'My Semester'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition ${filter === f ? 'bg-slate-200 text-slate-900 font-medium' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 border border-slate-700'}`}>
                {f}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {noticesLoading ? <p className="text-center text-slate-400">Loading notices...</p> : 
              filteredNotices?.map((notice: any) => {
                const isLong = notice.content.length > 200;
                const isExpanded = expanded[notice.id];
                
                return (
                  <div key={notice.id} className="glass p-6 rounded-2xl relative group">
                    <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                      {isFaculty ? (
                        <button onClick={() => {if(confirm('Delete notice?')) deleteMutation.mutate(notice.id)}} className="text-slate-400 hover:text-red-400 bg-slate-800 p-2 rounded-lg"><Trash2 size={16} /></button>
                      ) : (
                        <button onClick={() => dismissMutation.mutate(notice.id)} title="Mark as read" className="text-slate-400 hover:text-emerald-400 bg-slate-800 p-2 rounded-lg"><CheckCircle2 size={16} /></button>
                      )}
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="bg-blue-500/20 p-3 rounded-xl text-blue-400 shrink-0 mt-1">
                        <Bell size={24} />
                      </div>
                      <div className="flex-1 pr-12">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-bold text-lg">{notice.title}</h3>
                          {notice.target_semester && <span className="bg-slate-700 text-xs px-2 py-1 rounded text-slate-300">Sem {notice.target_semester}</span>}
                        </div>
                        <p className="text-xs text-slate-400 mb-4">{notice.author_name} • {timeAgo(notice.created_at)}</p>
                        
                        <div className="text-slate-300 text-sm whitespace-pre-wrap">
                          {isExpanded || !isLong ? notice.content : `${notice.content.substring(0, 200)}...`}
                        </div>
                        
                        {isLong && (
                          <button onClick={() => setExpanded(prev => ({...prev, [notice.id]: !isExpanded}))} className="text-blue-400 hover:text-blue-300 text-sm font-medium mt-2">
                            {isExpanded ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            }
            {filteredNotices?.length === 0 && (
              <div className="text-center py-12 text-slate-500 glass rounded-2xl">
                <Bell size={48} className="mx-auto mb-4 opacity-20" />
                <p>No notices found</p>
              </div>
            )}
          </div>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass w-full max-w-lg p-6 rounded-2xl relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
              <h2 className="text-2xl font-bold mb-6">Post Notice</h2>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(noticeData); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input required type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                    value={noticeData.title} onChange={e => setNoticeData({...noticeData, title: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Target Semester (Optional)</label>
                  <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 appearance-none"
                    value={noticeData.target_semester} onChange={e => setNoticeData({...noticeData, target_semester: e.target.value})}>
                    <option value="">All Semesters (General)</option>
                    {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Content</label>
                  <textarea required rows={5} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                    value={noticeData.content} onChange={e => setNoticeData({...noticeData, content: e.target.value})} />
                </div>
                <button type="submit" disabled={createMutation.isPending} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg py-3 font-bold hover:opacity-90 mt-4 disabled:opacity-50">
                  {createMutation.isPending ? 'Posting...' : 'Post Notice'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
