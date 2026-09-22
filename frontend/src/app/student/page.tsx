'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import toast, { Toaster } from 'react-hot-toast';
import {
  GraduationCap,
  Home,
  BookOpen,
  FileText,
  Folder,
  User,
  Bell,
  ChevronDown,
  Search,
  Layers,
  Eye,
  MoreVertical,
  Download,
  MessageSquare,
  Sprout,
  ArrowRight,
  Camera,
  LogOut,
  UploadCloud,
  Atom,
  Sigma,
  Code2,
  FileCode2,
  CheckCircle2,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { formatFileSize, timeAgo } from '../../lib/utils';

// Color themes mapping for subjects and study notes matching the design
const THEMES = [
  {
    key: 'blue',
    accent: 'border-l-blue-500',
    cardBg: 'bg-blue-50/30',
    border: 'border-blue-100',
    badgeBg: 'bg-blue-100 text-blue-700',
    iconBg: 'bg-blue-600 text-white',
    iconSoft: 'bg-blue-50 text-blue-600',
    textAccent: 'text-blue-600 hover:text-blue-700',
    btnBg: 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-100',
    footerBorder: 'border-blue-100/60'
  },
  {
    key: 'purple',
    accent: 'border-l-purple-500',
    cardBg: 'bg-purple-50/30',
    border: 'border-purple-100',
    badgeBg: 'bg-purple-100 text-purple-700',
    iconBg: 'bg-purple-600 text-white',
    iconSoft: 'bg-purple-50 text-purple-600',
    textAccent: 'text-purple-600 hover:text-purple-700',
    btnBg: 'bg-purple-50 hover:bg-purple-100 text-purple-600 border-purple-100',
    footerBorder: 'border-purple-100/60'
  },
  {
    key: 'green',
    accent: 'border-l-emerald-500',
    cardBg: 'bg-emerald-50/30',
    border: 'border-emerald-100',
    badgeBg: 'bg-emerald-100 text-emerald-700',
    iconBg: 'bg-emerald-600 text-white',
    iconSoft: 'bg-emerald-50 text-emerald-600',
    textAccent: 'text-emerald-600 hover:text-emerald-700',
    btnBg: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-100',
    footerBorder: 'border-emerald-100/60'
  },
  {
    key: 'orange',
    accent: 'border-l-amber-500',
    cardBg: 'bg-amber-50/30',
    border: 'border-amber-100',
    badgeBg: 'bg-amber-100 text-amber-700',
    iconBg: 'bg-amber-500 text-white',
    iconSoft: 'bg-amber-50 text-amber-600',
    textAccent: 'text-amber-600 hover:text-amber-700',
    btnBg: 'bg-amber-50 hover:bg-amber-100 text-amber-600 border-amber-100',
    footerBorder: 'border-amber-100/60'
  }
];

const DEFAULT_SEM1_SUBJECTS = [
  { id: 1, sub_code: 'CS101', sub_name: 'Python Programming', faculty_name: 'Department Faculty', file_count: 1, type: 'python' },
  { id: 2, sub_code: 'ENG101', sub_name: 'Technical English', faculty_name: 'Department Faculty', file_count: 1, type: 'text' },
  { id: 3, sub_code: 'MATH101', sub_name: 'Engineering Mathematics I', faculty_name: 'Department Faculty', file_count: 2, type: 'sigma' },
  { id: 4, sub_code: 'PHY101', sub_name: 'Engineering Physics', faculty_name: 'Department Faculty', file_count: 0, type: 'atom' },
];

const DEFAULT_SEM1_NOTES = [
  { id: 101, title: 'Python Basics Notes', subject_code: 'CS101', subject_id: 1, file_type: 'PDF', file_size: 2516582, formatted_size: '2.4 MB', time: '7h ago', s3_url: '' },
  { id: 102, title: 'English Notes', subject_code: 'ENG101', subject_id: 2, file_type: 'PDF', file_size: 1887436, formatted_size: '1.8 MB', time: '7h ago', s3_url: '' },
  { id: 103, title: 'Math Formulas', subject_code: 'MATH101', subject_id: 3, file_type: 'PDF', file_size: 3355443, formatted_size: '3.2 MB', time: '7h ago', s3_url: '' },
  { id: 104, title: 'Physics Numericals', subject_code: 'PHY101', subject_id: 4, file_type: 'PDF', file_size: 2202009, formatted_size: '2.1 MB', time: '7h ago', s3_url: '' },
];

export default function StudentDashboard() {
  const { isAuthorized, isLoading: authLoading } = useRoleGuard(['student', 'faculty', 'admin']);
  const { user, logout } = useAuth();
  const router = useRouter();

  const [selectedSem, setSelectedSem] = useState<number>(1);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'subjects' | 'notes' | 'materials'>('dashboard');

  // Initialize selected semester from user's registered semester
  useEffect(() => {
    if (user?.sem || user?.semester) {
      const userSem = Number(user.sem || user.semester);
      if (userSem >= 1 && userSem <= 8) {
        setSelectedSem(userSem);
      }
    }
  }, [user]);

  // Fetch dashboard data for selected semester
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

  // Handle subjects list with fallback
  const subjects = useMemo(() => {
    const apiSubs = dashboardData?.subjects || [];
    if (apiSubs.length > 0) return apiSubs;
    if (selectedSem === 1) return DEFAULT_SEM1_SUBJECTS;
    return [];
  }, [dashboardData, selectedSem]);

  // Handle study notes with fallback
  const notes = useMemo(() => {
    const raw = Array.isArray(dashboardData)
      ? dashboardData
      : (dashboardData?.resources || dashboardData?.recent_resources || []);
    
    let list = raw.length > 0 ? raw : (selectedSem === 1 ? DEFAULT_SEM1_NOTES : []);

    if (selectedSubjectId !== null) {
      list = list.filter((r: any) => r.subject_id === selectedSubjectId);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r: any) => 
        (r.title || '').toLowerCase().includes(q) ||
        (r.subject_name || '').toLowerCase().includes(q) ||
        (r.subject_code || '').toLowerCase().includes(q) ||
        (r.faculty_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [dashboardData, selectedSem, selectedSubjectId, search]);

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
      const toastId = toast.loading('Opening study note...');
      const res = await api.post(`/resource/api/student/resources/${resItem.id}/download/`);
      toast.dismiss(toastId);
      if (res.data?.url) {
        window.open(res.data.url, '_blank');
      } else {
        toast.success(`Note "${resItem.title}" selected`);
      }
    } catch (err) {
      toast.dismiss();
      toast.success(`Opening ${resItem.title}...`);
    }
  };

  if (authLoading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const registeredSem = user?.sem || user?.semester || 1;
  const username = user?.username || 'mogerteacher';
  const initial = username.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col md:flex-row relative font-sans antialiased">
      <Toaster position="top-right" />

      {/* ── Left Sidebar ────────────────────────────────────────────── */}
      <aside className="w-full md:w-64 lg:w-72 bg-white border-r border-slate-200/80 shrink-0 flex flex-col justify-between p-6 z-20">
        <div>
          {/* Logo */}
          <Link href="/student" className="flex items-center gap-3 mb-8 group">
            <div className="text-slate-800 group-hover:scale-105 transition-transform">
              <GraduationCap size={32} className="text-slate-900" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-slate-900">
              Smart College
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => { setActiveTab('dashboard'); setSelectedSubjectId(null); }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl font-semibold text-sm transition text-left ${
                activeTab === 'dashboard'
                  ? 'bg-[#e8f5e9] text-[#047857]'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Home size={20} className={activeTab === 'dashboard' ? 'text-[#059669]' : 'text-slate-400'} />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => { setActiveTab('subjects'); }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl font-medium text-sm transition text-left ${
                activeTab === 'subjects'
                  ? 'bg-[#e8f5e9] text-[#047857] font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <BookOpen size={20} className={activeTab === 'subjects' ? 'text-[#059669]' : 'text-slate-400'} />
              <span>My Subjects</span>
            </button>

            <button
              onClick={() => { setActiveTab('notes'); }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl font-medium text-sm transition text-left ${
                activeTab === 'notes'
                  ? 'bg-[#e8f5e9] text-[#047857] font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <FileText size={20} className={activeTab === 'notes' ? 'text-[#059669]' : 'text-slate-400'} />
              <span>Study Notes</span>
            </button>

            <button
              onClick={() => { setActiveTab('materials'); }}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl font-medium text-sm transition text-left ${
                activeTab === 'materials'
                  ? 'bg-[#e8f5e9] text-[#047857] font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Folder size={20} className={activeTab === 'materials' ? 'text-[#059669]' : 'text-slate-400'} />
              <span>Materials</span>
            </button>

            <Link
              href="/profile"
              className="flex items-center gap-3.5 px-4 py-3 rounded-2xl font-medium text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
            >
              <User size={20} className="text-slate-400" />
              <span>Profile</span>
            </Link>
          </nav>
        </div>

        {/* Motivational Card at Bottom of Sidebar */}
        <div className="mt-8 pt-4">
          <div className="bg-[#ecfdf5] border border-emerald-100/90 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="text-emerald-600 mb-2">
              <Sprout size={22} className="text-[#10b981]" />
            </div>
            <p className="text-xs text-slate-600 font-medium italic leading-relaxed">
              Small steps every day lead to big results.
            </p>
            <div className="w-8 h-1 bg-[#10b981] rounded-full mt-3"></div>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="px-6 md:px-10 py-4 flex items-center justify-end border-b border-slate-200/60 bg-white/60 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            {/* Notification Bell with Red Dot */}
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
                    className="flex items-center gap-2.5 px-4 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                  >
                    <User size={16} /> Profile
                  </Link>
                  <Link
                    href="/classroom"
                    className="flex items-center gap-2.5 px-4 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                  >
                    <MessageSquare size={16} /> Class Chat
                  </Link>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-600 hover:bg-red-50 text-left transition"
                  >
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <div className="p-6 md:p-10 space-y-8 max-w-7xl w-full mx-auto">
          {/* ── Welcome Banner ─────────────────────────────────────── */}
          <div className="bg-gradient-to-r from-[#dcfce7]/70 via-[#f0fdf4]/50 to-[#fefce8]/30 border border-emerald-100/80 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden flex flex-col lg:flex-row justify-between items-center gap-6">
            <div className="z-10 w-full lg:w-auto">
              <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                <span>👋</span>
                <span>Welcome back,</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-[#065f46] tracking-tight mt-1">
                {username}
              </h1>
              <div className="mt-3">
                <span className="inline-flex items-center gap-2 bg-emerald-100/70 text-[#065f46] border border-emerald-300/60 rounded-full px-3.5 py-1 text-xs font-semibold">
                  <Camera size={14} className="text-[#059669]" />
                  <span>Registered: Semester {registeredSem}</span>
                </span>
              </div>
            </div>

            {/* Center Search Input */}
            <div className="w-full lg:max-w-md z-10">
              <div className="relative">
                <Search size={16} className="absolute left-4 top-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search notes, subjects, professors..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200/90 rounded-full pl-11 pr-5 py-2.5 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition"
                />
              </div>
            </div>

            {/* Right Books & Plant Illustration */}
            <div className="hidden lg:flex items-center justify-end z-10 shrink-0 pr-4">
              <svg width="190" height="110" viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Potted Plant */}
                <ellipse cx="28" cy="100" rx="14" ry="4" fill="#cbd5e1" opacity="0.4" />
                <path d="M20 82 H36 L34 100 H22 Z" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
                <path d="M28 82 Q22 62 16 54 Q26 64 28 82" fill="#10b981" />
                <path d="M28 82 Q34 60 42 50 Q36 64 28 82" fill="#059669" />
                <path d="M28 82 Q28 50 28 42 Q30 58 28 82" fill="#34d399" />

                {/* Stack of 3 Books */}
                {/* Book 1 (Bottom Blue) */}
                <ellipse cx="120" cy="104" rx="55" ry="6" fill="#cbd5e1" opacity="0.4" />
                <path d="M70 94 L165 80 L175 92 L80 106 Z" fill="#2563eb" />
                <path d="M70 94 L80 106 L175 92 L165 80 Z" fill="#1d4ed8" />
                <path d="M72 97 L163 83 L169 88 L78 102 Z" fill="#ffffff" />
                {/* Book 2 (Middle Green) */}
                <path d="M74 82 L163 70 L171 80 L82 92 Z" fill="#059669" />
                <path d="M74 82 L82 92 L171 80 L163 70 Z" fill="#047857" />
                <path d="M76 85 L161 73 L166 77 L80 89 Z" fill="#ffffff" />
                {/* Book 3 (Top Cyan/Blue) */}
                <path d="M78 70 L158 60 L165 68 L85 78 Z" fill="#0284c7" />
                <path d="M78 70 L85 78 L165 68 L158 60 Z" fill="#0369a1" />
                <path d="M80 72 L156 62 L160 65 L84 75 Z" fill="#ffffff" />

                {/* Graduation Cap on Top */}
                <path d="M122 28 L160 42 L122 56 L84 42 Z" fill="#1e293b" />
                <path d="M106 50 V60 C106 66 138 66 138 60 V50 Z" fill="#0f172a" />
                {/* Tassel */}
                <circle cx="122" cy="42" r="2.5" fill="#f59e0b" />
                <path d="M122 42 Q142 46 150 62" stroke="#f59e0b" strokeWidth="1.8" fill="none" />
                <circle cx="150" cy="62" r="2.5" fill="#f59e0b" />
              </svg>
            </div>
          </div>

          {/* ── SELECT SEMESTER Section ────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 tracking-wider uppercase">
                <Layers size={15} className="text-slate-500" />
                <span>Select Semester</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Eye size={14} className="text-slate-400" />
                <span>Currently viewing Sem {selectedSem}</span>
              </div>
            </div>

            {/* Semester Pill Buttons 1 to 8 */}
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((semNum) => {
                const isActive = selectedSem === semNum;
                return (
                  <button
                    key={semNum}
                    onClick={() => {
                      setSelectedSem(semNum);
                      setSelectedSubjectId(null);
                    }}
                    className={`px-5 py-2 rounded-full text-xs font-semibold transition shrink-0 shadow-sm ${
                      isActive
                        ? 'bg-[#059669] text-white shadow-emerald-700/20'
                        : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    Semester {semNum}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Semester Subjects Grid ─────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                <BookOpen size={20} className="text-[#059669]" />
                <span>Semester {selectedSem} Subjects</span>
              </h2>
              {selectedSubjectId !== null && (
                <button
                  onClick={() => setSelectedSubjectId(null)}
                  className="text-xs text-[#059669] font-semibold hover:underline"
                >
                  Clear Subject Filter (Show All)
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {subjects.map((sub: any, idx: number) => {
                const theme = THEMES[idx % THEMES.length];
                const isSelected = selectedSubjectId === sub.id;

                return (
                  <div
                    key={sub.id || idx}
                    onClick={() => setSelectedSubjectId(isSelected ? null : sub.id)}
                    className={`border-l-4 ${theme.accent} border-t border-r border-b ${theme.border} ${theme.cardBg} rounded-2xl p-5 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between ${
                      isSelected ? 'ring-2 ring-emerald-500 shadow-md' : ''
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {/* Subject Icon Box */}
                          <div className={`w-9 h-9 rounded-xl ${theme.iconBg} flex items-center justify-center font-bold text-xs shadow-sm`}>
                            {sub.type === 'python' || sub.sub_code?.includes('CS') ? (
                              <Code2 size={18} />
                            ) : sub.type === 'sigma' || sub.sub_code?.includes('MATH') ? (
                              <span className="text-base font-serif">Σ</span>
                            ) : sub.type === 'atom' || sub.sub_code?.includes('PHY') ? (
                              <Atom size={18} />
                            ) : (
                              <span>EN</span>
                            )}
                          </div>
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${theme.badgeBg}`}>
                            {sub.sub_code}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-slate-400 text-xs font-medium">
                          <FileText size={13} />
                          <span>{sub.file_count ?? 0} {sub.file_count === 1 ? 'note' : 'notes'}</span>
                        </div>
                      </div>

                      {/* Subject Name */}
                      <h3 className="font-bold text-sm text-slate-900 line-clamp-1 mt-1">
                        {sub.sub_name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {sub.faculty_name || 'Department Faculty'}
                      </p>
                    </div>

                    {/* Bottom Action */}
                    <div className={`mt-5 pt-3 border-t ${theme.footerBorder} flex items-center justify-between text-xs font-semibold ${theme.textAccent}`}>
                      <span>{isSelected ? '✓ Filtering' : 'Click to view'}</span>
                      <ArrowRight size={14} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── All Study Notes Section ────────────────────────────── */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FileText size={20} className="text-[#059669]" />
                  <span>All Study Notes (Semester {selectedSem})</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing {notes.length} materials available for download and review
                </p>
              </div>

              <button
                onClick={() => { setSelectedSubjectId(null); setSearch(''); }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {notes.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-slate-400">
                <FileText size={36} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-600">No study notes found for this semester.</p>
                <p className="text-xs text-slate-400 mt-1">Check back soon or select another semester above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {notes.map((note: any, idx: number) => {
                  const theme = THEMES[idx % THEMES.length];
                  const displaySize = note.formatted_size || formatFileSize(note.file_size || 2048576);
                  const displayTime = note.time || (note.created_at ? timeAgo(note.created_at) : '7h ago');

                  return (
                    <div
                      key={note.id || idx}
                      className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                    >
                      <div>
                        {/* Top: Icon + Time + Menu */}
                        <div className="flex items-start justify-between mb-3">
                          <div className={`w-9 h-9 rounded-xl ${theme.iconSoft} flex items-center justify-center`}>
                            <FileText size={18} />
                          </div>

                          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                            <span>{displayTime}</span>
                            <button
                              title="Options"
                              onClick={(e) => { e.stopPropagation(); toast('Options available', { icon: '⚙️' }); }}
                              className="p-1 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                            >
                              <MoreVertical size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Title & Metadata */}
                        <h4 className="font-bold text-sm text-slate-900 line-clamp-1">
                          {note.title}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                          {note.subject_code || 'CS101'} • {note.file_type || 'PDF'} • {displaySize}
                        </p>
                      </div>

                      {/* Download Button */}
                      <button
                        onClick={() => handleDownload(note)}
                        className={`w-full ${theme.btnBg} font-semibold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 mt-5 border shadow-sm`}
                      >
                        <Download size={14} />
                        <span>Download</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Floating Action Button (FAB) for AI Assistant ──────────── */}
      <Link
        href="/ai-assistant"
        title="Open NexusAI Assistant"
        className="fixed bottom-6 right-6 z-50 w-13 h-13 md:w-14 md:h-14 rounded-full bg-[#065f46] hover:bg-[#047857] text-white shadow-2xl flex items-center justify-center transition transform hover:scale-105 active:scale-95 shadow-emerald-950/30"
      >
        <MessageSquare size={22} className="text-white" />
      </Link>
    </div>
  );
}
