'use client';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import Navbar from '../../components/Navbar';
import Link from 'next/link';
import { FileText, MessageSquare, Bot } from 'lucide-react';
import { formatFileSize, timeAgo } from '../../lib/utils';
import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';

export default function StudentDashboard() {
  const { isAuthorized, isLoading } = useRoleGuard(['student']);
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const { data: dashboardData, isLoading: dataLoading } = useQuery({
    queryKey: ['studentDashboard', search],
    queryFn: async () => {
      const endpoint = search ? `/resource/api/student/search/?q=${search}` : '/resource/api/student/dashboard/';
      const res = await api.get(endpoint);
      return res.data;
    },
    enabled: Boolean(isAuthorized)
  });

  if (isLoading || !isAuthorized) return null;

  const handleDownload = async (id: string) => {
    try {
      const res = await api.post(`/resource/api/student/resources/${id}/download/`);
      if (res.data.url) {
        window.open(res.data.url, '_blank');
      }
    } catch (err) {
      toast.error('Download failed');
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <Toaster position="top-right" />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="glass p-8 rounded-3xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.username}</h1>
            <div className="inline-block bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-sm font-medium border border-purple-500/30">
              Semester {user?.semester || 'N/A'}
            </div>
          </div>
          <div className="w-full md:w-96 relative">
            <input 
              type="text" 
              placeholder="Search subjects, notes, professors..."
              className="w-full bg-slate-800/50 border border-slate-700 rounded-full pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-6">Recent Resources</h2>
        {dataLoading ? (
          <p>Loading...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboardData?.resources?.map((res: any) => (
              <div key={res.id} className="glass p-6 rounded-2xl flex flex-col hover:border-purple-500/50 transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-blue-500/20 p-3 rounded-xl text-blue-400">
                    <FileText size={24} />
                  </div>
                  <span className="text-xs text-slate-400">{timeAgo(res.created_at)}</span>
                </div>
                <h3 className="font-bold text-lg mb-1 line-clamp-1">{res.title}</h3>
                <p className="text-sm text-slate-400 mb-4">{res.subject_name} • Prof. {res.faculty_name}</p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-xs text-slate-500">{formatFileSize(res.size)} • {res.views} views</span>
                  <button onClick={() => handleDownload(res.id)} className="text-sm bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg font-medium transition">
                    View
                  </button>
                </div>
              </div>
            ))}
            {(!dashboardData?.resources || dashboardData.resources.length === 0) && (
              <p className="text-slate-400 col-span-full">No resources found.</p>
            )}
          </div>
        )}

        <div className="fixed bottom-8 right-8 flex flex-col gap-4">
          <Link href="/classroom" className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-600/30 hover:scale-110 transition group relative">
            <MessageSquare size={24} className="text-white" />
            <span className="absolute right-16 bg-slate-800 px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition">Anonymous Chat</span>
          </Link>
          <Link href="/ai-assistant" className="w-14 h-14 bg-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-600/30 hover:scale-110 transition group relative">
            <Bot size={24} className="text-white" />
            <span className="absolute right-16 bg-slate-800 px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition">NexusAI</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
