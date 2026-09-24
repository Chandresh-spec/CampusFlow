'use client';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/Navbar';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { 
  FileUp, 
  Users, 
  FileText, 
  CheckCircle, 
  ShieldCheck, 
  UploadCloud, 
  ArrowRight, 
  GraduationCap, 
  Sparkles, 
  Clock 
} from 'lucide-react';
import Link from 'next/link';
import { timeAgo } from '../../lib/utils';
import { Toaster } from 'react-hot-toast';

export default function TeacherDashboard() {
  const { isAuthorized, isLoading } = useRoleGuard(['faculty', 'teacher', 'admin']);
  const { user } = useAuth();

  const { data, isLoading: dataLoading } = useQuery({
    queryKey: ['facultyDashboard'],
    queryFn: async () => {
      const res = await api.get('/resource/api/faculty/dashboard/');
      return res.data;
    },
    enabled: Boolean(isAuthorized)
  });

  if (isLoading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const username = user?.username || 'Professor';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-24 font-sans relative">
      {/* ── Top Navigation Bar ──────────────────────────────────────── */}
      <Navbar />
      <Toaster position="top-right" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── Welcome Hero Banner ───────────────────────────────────── */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
          {/* Top Emerald Accent Strip */}
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[#059669] via-emerald-500 to-teal-400" />

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-[#065f46] border border-emerald-200 shadow-xs">
                  <ShieldCheck size={13} className="text-[#059669]" />
                  <span>Institutional Faculty</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-xs">
                  <CheckCircle size={13} /> Verified Professor
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Welcome back,{' '}
                <span className="text-[#059669]">
                  {username}
                </span>{' '}
                🎓
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 max-w-xl">
                Upload and distribute official course notes, monitor student downloads, and manage real-time doubt discussions.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <Link
                href="/my-uploads"
                className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs shadow-md shadow-emerald-600/25 transition-all"
              >
                <UploadCloud size={16} />
                <span>Upload Study Note</span>
              </Link>
              <Link
                href="/classroom"
                className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs shadow-xs transition-all"
              >
                <GraduationCap size={16} className="text-[#059669]" />
                <span>Class Doubts</span>
              </Link>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-slate-100">
            <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Uploads</p>
              <p className="text-xl font-black text-slate-900 mt-0.5">{data?.total_resources || 0} Materials</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Views Today</p>
              <p className="text-xl font-black text-teal-700 mt-0.5">{data?.views_today || 0} Views</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Students</p>
              <p className="text-xl font-black text-[#059669] mt-0.5">{data?.active_students || 0} Students</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Auto-Approval</p>
              <p className="text-xl font-black text-[#059669] mt-0.5 flex items-center gap-1.5">
                <CheckCircle size={16} className="text-[#059669]" />
                <span>Enabled</span>
              </p>
            </div>
          </div>
        </div>

        {/* ── Content Grid ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Recent Uploads Table Card ───────────────────────────── */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText size={18} className="text-[#059669]" />
                <span>Recently Published Notes</span>
              </h2>
              <Link href="/my-uploads" className="text-xs font-bold text-[#059669] hover:text-[#047857] flex items-center gap-1">
                <span>Manage all</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            {dataLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : (!data?.recent_uploads || data.recent_uploads.length === 0) ? (
              <div className="py-10 text-center">
                <UploadCloud size={30} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No notes published yet</p>
                <p className="text-xs text-slate-500 mt-1">Upload study materials to help your students learn</p>
                <Link
                  href="/my-uploads"
                  className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-[#059669] text-white text-xs font-bold shadow-xs hover:bg-[#047857]"
                >
                  <UploadCloud size={14} /> Upload First Note
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {data.recent_uploads.map((up: any) => (
                  <div
                    key={up.id}
                    className="p-4 rounded-2xl bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-[#059669] flex items-center justify-center shrink-0">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm truncate group-hover:text-[#059669] transition">
                          {up.title}
                        </h4>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {up.subject_name || 'General Subject'} • {timeAgo(up.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-[#065f46] border border-emerald-200">
                        Published
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Right Quick Navigation Column ───────────────────────── */}
          <div className="space-y-4">
            <Link
              href="/my-uploads"
              className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all duration-200 flex items-center justify-between group block"
            >
              <div>
                <span className="text-[10px] font-bold text-[#059669] uppercase tracking-wider">Fast Action</span>
                <h3 className="text-base font-bold text-slate-900 mt-1">Study Material Manager</h3>
                <p className="text-xs text-slate-500 mt-1">Upload, edit, and organize semester notes</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#059669] border border-emerald-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileUp size={20} />
              </div>
            </Link>

            <Link
              href="/classroom"
              className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all duration-200 flex items-center justify-between group block"
            >
              <div>
                <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Real-Time</span>
                <h3 className="text-base font-bold text-slate-900 mt-1">Class Doubt Channels</h3>
                <p className="text-xs text-slate-500 mt-1">Interact with students per semester</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                <GraduationCap size={20} />
              </div>
            </Link>

            <Link
              href="/ai-assistant"
              className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all duration-200 flex items-center justify-between group block"
            >
              <div>
                <span className="text-[10px] font-bold text-[#059669] uppercase tracking-wider">AI Integration</span>
                <h3 className="text-base font-bold text-slate-900 mt-1">NexusAI Assistant</h3>
                <p className="text-xs text-slate-500 mt-1">Syllabus-grounded question answering</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#059669] border border-emerald-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Sparkles size={20} />
              </div>
            </Link>
          </div>

        </div>

      </main>
    </div>
  );
}
