'use client';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import Navbar from '../../components/Navbar';
import Link from 'next/link';
import { 
  FileText, 
  BookOpen, 
  Download, 
  Search, 
  Layers, 
  Sparkles, 
  GraduationCap, 
  FileCheck2, 
  Clock, 
  ArrowRight, 
  Filter, 
  CheckCircle2, 
  FileCode, 
  FileSpreadsheet, 
  FileImage, 
  X 
} from 'lucide-react';
import { formatFileSize, timeAgo } from '../../lib/utils';
import { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import FeatureIntroModal from '../../components/FeatureIntroModal';

export default function StudentDashboard() {
  const { isAuthorized, isLoading } = useRoleGuard(['student']);
  const { user } = useAuth();
  const [selectedSem, setSelectedSem] = useState<number>(1);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    try {
      const isCompleted = localStorage.getItem('campusflow_tour_completed') === 'true';
      if (!isCompleted) {
        setTourOpen(true);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (user?.sem || user?.semester) {
      setSelectedSem(Number(user.sem || user.semester));
    }
  }, [user]);

  const { data: dashboardData, isLoading: dataLoading } = useQuery({
    queryKey: ['studentDashboard', selectedSem, search],
    queryFn: async () => {
      const endpoint = search 
        ? `/resource/api/student/search/?q=${encodeURIComponent(search)}` 
        : `/resource/api/student/dashboard/?semester=${selectedSem}`;
      const res = await api.get(endpoint);
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

  const subjects = dashboardData?.subjects || [];
  const rawResources = Array.isArray(dashboardData) 
    ? dashboardData 
    : (dashboardData?.resources || dashboardData?.recent_resources || []);

  const filteredResources = rawResources.filter((r: any) => {
    if (selectedSubjectId !== null && r.subject_id !== selectedSubjectId) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = (r.title || '').toLowerCase().includes(q);
      const matchSub = (r.subject_name || '').toLowerCase().includes(q);
      const matchFaculty = (r.faculty_name || '').toLowerCase().includes(q);
      return matchTitle || matchSub || matchFaculty;
    }
    return true;
  });

  const handleDownload = async (resItem: any) => {
    if (resItem.s3_url && resItem.s3_url.startsWith('http')) {
      window.open(resItem.s3_url, '_blank');
      return;
    }
    if (resItem.reference_url && resItem.reference_url.startsWith('http')) {
      window.open(resItem.reference_url, '_blank');
      return;
    }
    try {
      const toastId = toast.loading('Opening document...');
      const res = await api.post(`/resource/api/student/resources/${resItem.id}/download/`);
      toast.dismiss(toastId);
      if (res.data?.url) {
        window.open(res.data.url, '_blank');
      } else {
        toast.error('File link unavailable');
      }
    } catch (err) {
      toast.error('Failed to open document');
    }
  };

  const getFormatIcon = (fileType: string) => {
    const ft = (fileType || '').toUpperCase();
    if (ft.includes('PDF')) return <FileText size={18} className="text-red-500" />;
    if (ft.includes('PPT')) return <FileSpreadsheet size={18} className="text-amber-500" />;
    if (ft.includes('DOC')) return <FileCode size={18} className="text-blue-500" />;
    if (ft.includes('IMG')) return <FileImage size={18} className="text-[#059669]" />;
    return <FileText size={18} className="text-[#059669]" />;
  };

  const registeredSem = user?.sem || user?.semester || 1;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-24 font-sans relative">
      {/* ── Top Navigation Bar ──────────────────────────────────────── */}
      <Navbar />
      <Toaster position="top-right" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── Welcome Hero Banner ───────────────────────────────────── */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
          {/* Top Mint Accent Banner */}
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[#059669] via-emerald-500 to-teal-400" />

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-[#065f46] border border-emerald-200 shadow-xs">
                  <GraduationCap size={13} className="text-[#059669]" />
                  <span>Enrolled: Semester {registeredSem}</span>
                </span>
                {user?.usn && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 uppercase font-mono">
                    USN: {user.usn}
                  </span>
                )}
                {user?.is_verified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-xs">
                    <CheckCircle2 size={13} /> Gmail Verified
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setTourOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#047857] border border-emerald-300 shadow-xs transition cursor-pointer"
                  title="View Platform Feature Guide"
                >
                  <Sparkles size={13} className="text-[#059669]" />
                  <span>Platform Tour</span>
                </button>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Welcome back,{' '}
                <span className="text-[#059669]">
                  {user?.username}
                </span>{' '}
                👋
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 max-w-xl">
                Explore course notes, connect to your semester doubt room, or generate instant answers from verified study materials.
              </p>
            </div>

            {/* Search Input Bar */}
            <div className="w-full lg:w-96 relative">
              <Search className="absolute left-4 top-3.5 text-slate-400" size={17} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes, subjects, professors..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-10 py-3 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-slate-100">
            <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Current View</p>
              <p className="text-lg font-black text-slate-900 mt-0.5">Semester {selectedSem}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Subjects</p>
              <p className="text-lg font-black text-[#059669] mt-0.5">{subjects.length} Courses</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Study Notes</p>
              <p className="text-lg font-black text-teal-700 mt-0.5">{filteredResources.length} Files</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">NexusAI</p>
              <p className="text-lg font-black text-emerald-700 mt-0.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Online</span>
              </p>
            </div>
          </div>
        </div>

        {/* ── Semester Tabs Filter ──────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <Layers size={15} className="text-[#059669]" />
              <span>Select Semester</span>
            </h2>
            <span className="text-xs text-slate-500">
              Viewing Sem {selectedSem} {selectedSem === registeredSem ? '(Your Enrolled Class)' : ''}
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSelectedSem(s);
                  setSelectedSubjectId(null);
                }}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-150 shrink-0 flex items-center gap-2 ${
                  selectedSem === s
                    ? 'bg-[#059669] text-white shadow-sm shadow-emerald-600/30'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                }`}
              >
                <span>Semester {s}</span>
                {s === registeredSem && (
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedSem === s ? 'bg-white' : 'bg-emerald-500'}`} title="Enrolled" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Subjects Grid ─────────────────────────────────────────── */}
        {subjects.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BookOpen size={18} className="text-[#059669]" />
                <span>Semester {selectedSem} Subjects</span>
              </h2>
              {selectedSubjectId !== null && (
                <button
                  onClick={() => setSelectedSubjectId(null)}
                  className="text-xs font-bold text-[#059669] hover:text-[#047857] transition flex items-center gap-1"
                >
                  <X size={14} /> Clear Subject Filter
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {subjects.map((sub: any) => {
                const isSelected = selectedSubjectId === sub.id;
                const noteCount = sub.file_count || 0;

                return (
                  <button
                    key={sub.id}
                    onClick={() => setSelectedSubjectId(isSelected ? null : sub.id)}
                    className={`text-left p-5 rounded-3xl border transition-all duration-200 shadow-xs relative overflow-hidden bg-white ${
                      isSelected
                        ? 'border-[#059669] ring-2 ring-emerald-500/20 shadow-md bg-emerald-50/30'
                        : 'border-slate-200/90 hover:border-emerald-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 text-[11px] font-extrabold uppercase tracking-wider font-mono">
                        {sub.sub_code}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">
                        {noteCount} {noteCount === 1 ? 'note' : 'notes'}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-slate-900 text-base leading-snug line-clamp-2 mb-1">
                      {sub.sub_name}
                    </h3>

                    <p className="text-xs text-slate-500 font-medium truncate mb-4">
                      {sub.faculty_name || 'Department Faculty'}
                    </p>

                    <div className="flex items-center text-xs font-bold text-[#059669] transition">
                      <span>{isSelected ? 'Viewing notes' : 'Click to filter'}</span>
                      <ArrowRight size={13} className="ml-1" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Study Notes Grid ──────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 size={18} className="text-[#059669]" />
                <span>Study Notes & Lecture Slides</span>
              </h2>
              <p className="text-xs text-slate-500">
                {filteredResources.length} materials ready for download and RAG analysis
              </p>
            </div>

            {selectedSubjectId !== null && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-[#065f46] border border-emerald-200 self-start sm:self-auto">
                <Filter size={12} /> Filtered by Subject
              </span>
            )}
          </div>

          {dataLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="bg-white rounded-3xl p-5 border border-slate-200 animate-pulse h-40" />
              ))}
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <FileText size={26} />
              </div>
              <h3 className="text-base font-bold text-slate-800">No study notes found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No materials have been uploaded for Semester {selectedSem} matching your criteria yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredResources.map((res: any) => (
                <div
                  key={res.id}
                  className="bg-white rounded-3xl p-5 border border-slate-200/90 hover:border-emerald-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                        {getFormatIcon(res.file_type)}
                      </div>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                        <Clock size={12} /> {timeAgo(res.created_at)}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-base leading-snug line-clamp-2">
                        {res.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 truncate">
                        {res.subject?.sub_name || res.subject_name || `Subject #${res.subject_id}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1 font-mono">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold uppercase">
                        {res.file_type || 'PDF'}
                      </span>
                      <span>•</span>
                      <span>{formatFileSize(res.file_size)}</span>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500 truncate">
                      By {res.uploaded_by?.username || res.uploaded_by || 'Faculty'}
                    </span>
                    <button
                      onClick={() => handleDownload(res)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 hover:bg-[#059669] text-[#047857] hover:text-white border border-emerald-200 text-xs font-bold transition shadow-xs shrink-0"
                    >
                      <Download size={13} />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      {/* ── Floating Ask AI Assistant Button ────────────────────────── */}
      <Link
        href="/ai-assistant"
        title="Open NexusAI Study Assistant"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-5 py-3 rounded-full bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs shadow-xl shadow-emerald-600/30 hover:shadow-emerald-600/50 hover:scale-105 transition-all group"
      >
        <Sparkles size={16} className="text-emerald-100 animate-pulse group-hover:rotate-12 transition-transform" />
        <span>Ask NexusAI</span>
      </Link>

      {/* ── Feature Introduction Tour Modal ─────────────────────────── */}
      <FeatureIntroModal
        isOpen={tourOpen}
        onClose={() => setTourOpen(false)}
        userRole="student"
        userName={user?.username || 'Student'}
      />
    </div>
  );
}
