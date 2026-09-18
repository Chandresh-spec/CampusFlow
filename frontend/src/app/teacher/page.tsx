'use client';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import Sidebar from '../../components/Sidebar';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { FileUp, Users, FileText, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function TeacherDashboard() {
  const { isAuthorized, isLoading } = useRoleGuard(['faculty', 'admin']);

  const { data, isLoading: dataLoading } = useQuery({
    queryKey: ['facultyDashboard'],
    queryFn: async () => {
      const res = await api.get('/resource/api/faculty/dashboard/');
      return res.data;
    },
    enabled: Boolean(isAuthorized)
  });

  if (isLoading || !isAuthorized) return null;

  return (
    <div className="flex h-screen bg-slate-900">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <h1 className="text-3xl font-bold mb-8">Faculty Dashboard</h1>

        {dataLoading ? <p>Loading stats...</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <div className="glass p-6 rounded-2xl border-t-4 border-t-purple-500">
              <div className="flex items-center gap-4">
                <div className="bg-purple-500/20 p-3 rounded-lg text-purple-400"><FileText size={24} /></div>
                <div>
                  <p className="text-sm text-slate-400">Total Resources</p>
                  <p className="text-2xl font-bold">{data?.total_resources || 0}</p>
                </div>
              </div>
            </div>
            <div className="glass p-6 rounded-2xl border-t-4 border-t-blue-500">
              <div className="flex items-center gap-4">
                <div className="bg-blue-500/20 p-3 rounded-lg text-blue-400"><Users size={24} /></div>
                <div>
                  <p className="text-sm text-slate-400">Views Today</p>
                  <p className="text-2xl font-bold">{data?.views_today || 0}</p>
                </div>
              </div>
            </div>
            <div className="glass p-6 rounded-2xl border-t-4 border-t-pink-500">
              <div className="flex items-center gap-4">
                <div className="bg-pink-500/20 p-3 rounded-lg text-pink-400"><CheckCircle size={24} /></div>
                <div>
                  <p className="text-sm text-slate-400">Pending Approvals</p>
                  <p className="text-2xl font-bold">{data?.pending_approvals || 0}</p>
                </div>
              </div>
            </div>
            <div className="glass p-6 rounded-2xl border-t-4 border-t-emerald-500">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-500/20 p-3 rounded-lg text-emerald-400"><Users size={24} /></div>
                <div>
                  <p className="text-sm text-slate-400">Active Students</p>
                  <p className="text-2xl font-bold">{data?.active_students || 0}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 glass rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4">Recent Uploads</h2>
            <div className="space-y-4">
              {data?.recent_uploads?.map((up: any) => (
                <div key={up.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-700 p-2 rounded text-slate-300"><FileText size={20} /></div>
                    <div>
                      <p className="font-medium">{up.title}</p>
                      <p className="text-xs text-slate-400">{up.subject_name}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${up.status?.toUpperCase() === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                    {up.status?.toUpperCase() === 'APPROVED' ? 'Approved' : 'Pending'}
                  </span>
                </div>
              ))}
              {(!data?.recent_uploads || data.recent_uploads.length === 0) && <p className="text-sm text-slate-400">No recent uploads.</p>}
            </div>
          </div>
          
          <div className="flex flex-col gap-4">
            <Link href="/my-uploads" className="glass p-6 rounded-2xl hover:bg-white/5 transition flex items-center justify-between group">
              <div>
                <h3 className="font-bold text-lg">Upload Notes</h3>
                <p className="text-sm text-slate-400">Share resources with students</p>
              </div>
              <div className="bg-purple-600 w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-110 transition"><FileUp size={20} /></div>
            </Link>
            
            <Link href="/notices" className="glass p-6 rounded-2xl hover:bg-white/5 transition flex items-center justify-between group">
              <div>
                <h3 className="font-bold text-lg">Post Notice</h3>
                <p className="text-sm text-slate-400">Announce to students</p>
              </div>
              <div className="bg-blue-600 w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-110 transition"><FileText size={20} /></div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
