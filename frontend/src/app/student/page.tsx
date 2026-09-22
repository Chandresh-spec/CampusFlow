'use client';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import Navbar from '../../components/Navbar';
import Link from 'next/link';
import { FileText, MessageSquare, Bot, BookOpen, Download, ExternalLink, Search, CheckCircle, Layers } from 'lucide-react';
import { formatFileSize, timeAgo } from '../../lib/utils';
import { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';

export default function StudentDashboard() {
  const { isAuthorized, isLoading } = useRoleGuard(['student']);
  const { user } = useAuth();
  const [selectedSem, setSelectedSem] = useState<number>(1);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

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

  if (isLoading || !isAuthorized) return null;

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      <Navbar />
      <Toaster position="top-right" />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Header */}
        <div className="glass p-6 md:p-8 rounded-3xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6 border border-slate-800 shadow-2xl">
          <div>
            <h1 className="text-3xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400">
              Welcome back, {user?.username}
            </h1>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 bg-purple-500/20 text-purple-300 px-3.5 py-1 rounded-full text-xs font-semibold border border-purple-500/30">
                <BookOpen size={13} /> Registered: Semester {user?.sem || user?.semester || 1}
              </span>
              {selectedSubjectId !== null && (
                <span className="inline-flex items-center gap-1.5 bg-blue-500/20 text-blue-300 px-3.5 py-1 rounded-full text-xs font-semibold border border-blue-500/30">
                  Filtering by Subject
                </span>
              )}
            </div>
          </div>

          <div className="w-full md:w-96 relative">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search notes, subjects, professors..."
              className="w-full bg-slate-900/80 border border-slate-700 rounded-full pl-11 pr-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-inner"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Semester Tabs */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Layers size={16} className="text-purple-400" /> Select Semester
            </h2>
            <span className="text-xs text-slate-500">Currently viewing Sem {selectedSem}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((semNum) => (
              <button
                key={semNum}
                onClick={() => {
                  setSelectedSem(semNum);
                  setSelectedSubjectId(null);
                }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 ${
                  selectedSem === semNum
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400/40'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                }`}
              >
                Semester {semNum}
              </button>
            ))}
          </div>
        </div>

        {/* Semester Subjects Grid */}
        {subjects.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <BookOpen size={20} className="text-blue-400" />
                Semester {selectedSem} Subjects
              </h2>
              {selectedSubjectId !== null && (
                <button
                  onClick={() => setSelectedSubjectId(null)}
                  className="text-xs text-purple-400 hover:text-purple-300 font-semibold underline"
                >
                  Show All Subjects
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {subjects.map((sub: any) => {
                const isSelected = selectedSubjectId === sub.id;
                return (
                  <div
                    key={sub.id}
                    onClick={() => setSelectedSubjectId(isSelected ? null : sub.id)}
                    className={`p-4 rounded-2xl cursor-pointer transition border flex flex-col justify-between ${
                      isSelected
                        ? 'bg-purple-900/30 border-purple-500 shadow-lg shadow-purple-900/30'
                        : 'glass border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {sub.sub_code}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {sub.file_count || 0} {sub.file_count === 1 ? 'note' : 'notes'}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-slate-200 line-clamp-2 mb-1">
                        {sub.sub_name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {sub.faculty_name || 'Faculty'}
                      </p>
                    </div>

                    <div className="mt-4 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                      <span className={isSelected ? 'text-purple-300 font-bold' : 'text-slate-500'}>
                        {isSelected ? '✓ Filtering' : 'Click to view'}
                      </span>
                      <span className="text-slate-400">→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes & Resources Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileText size={20} className="text-emerald-400" />
                {selectedSubjectId !== null 
                  ? `Notes for ${subjects.find((s: any) => s.id === selectedSubjectId)?.sub_name || 'Selected Subject'}` 
                  : `All Study Notes (Semester ${selectedSem})`}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Showing {filteredResources.length} {filteredResources.length === 1 ? 'material' : 'materials'} available for download and review
              </p>
            </div>
          </div>

          {dataLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-500">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mr-3"></div>
              Loading subject notes...
            </div>
          ) : filteredResources.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredResources.map((res: any) => (
                <div key={res.id} className="glass p-6 rounded-2xl flex flex-col hover:border-purple-500/40 transition shadow-xl border border-slate-800 bg-slate-900/40">
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-emerald-500/20 p-3 rounded-xl text-emerald-400 border border-emerald-500/30">
                      <FileText size={22} />
                    </div>
                    <span className="text-xs text-slate-400">{timeAgo(res.created_at)}</span>
                  </div>

                  <h3 className="font-bold text-base mb-1 line-clamp-2 text-slate-100">{res.title}</h3>
                  {res.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 mb-3">{res.description}</p>
                  )}

                  <p className="text-xs text-purple-300 font-medium mb-4">
                    {res.subject_code ? `[${res.subject_code}] ` : ''}{res.subject_name || 'General'}
                    {res.faculty_name && ` • Prof. ${res.faculty_name}`}
                  </p>

                  <div className="mt-auto pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {formatFileSize(res.file_size || res.size)} • {res.views || res.view_count || 0} views
                    </span>
                    <button 
                      onClick={() => handleDownload(res)} 
                      className="inline-flex items-center gap-1.5 text-xs bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-4 py-2 rounded-xl font-semibold transition shadow-md"
                    >
                      <Download size={14} /> View Note
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 glass rounded-2xl border border-slate-800">
              <FileText size={36} className="mx-auto text-slate-600 mb-3" />
              <p className="text-slate-300 font-bold mb-1">No notes found for this selection</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {selectedSubjectId !== null
                  ? 'No notes have been uploaded for this specific subject yet. Click "Show All Subjects" to see other notes.'
                  : `No notes uploaded for Semester ${selectedSem} yet. You can upload notes using faculty portal or check back soon.`}
              </p>
              {selectedSubjectId !== null && (
                <button
                  onClick={() => setSelectedSubjectId(null)}
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 text-white hover:bg-purple-500 transition"
                >
                  Clear Subject Filter
                </button>
              )}
            </div>
          )}
        </div>

        {/* Floating Quick Action Buttons */}
        <div className="fixed bottom-8 right-8 flex flex-col gap-4 z-40">
          <Link href="/classroom" className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center shadow-xl shadow-emerald-600/30 hover:scale-110 transition group relative">
            <MessageSquare size={24} className="text-white" />
            <span className="absolute right-16 bg-slate-800 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition shadow-lg border border-slate-700">
              Anonymous Chat
            </span>
          </Link>
          <Link href="/ai-assistant" className="w-14 h-14 bg-purple-600 rounded-full flex items-center justify-center shadow-xl shadow-purple-600/30 hover:scale-110 transition group relative">
            <Bot size={24} className="text-white" />
            <span className="absolute right-16 bg-slate-800 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition shadow-lg border border-slate-700">
              NexusAI Assistant
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
