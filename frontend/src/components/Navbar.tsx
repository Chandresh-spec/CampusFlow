'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { 
  Bell, 
  User, 
  Menu, 
  X, 
  LogOut, 
  GraduationCap, 
  Sparkles, 
  BookOpen, 
  UploadCloud, 
  Layers, 
  ChevronDown, 
  ShieldCheck
} from 'lucide-react';
import { useState, useEffect } from 'react';
import FeatureIntroModal from './FeatureIntroModal';

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    try {
      const shouldShow = localStorage.getItem('campusflow_show_welcome_tour') === 'true';
      if (shouldShow) {
        setTourOpen(true);
        localStorage.removeItem('campusflow_show_welcome_tour');
      }
    } catch (e) {}

    const handleOpenTour = () => setTourOpen(true);
    window.addEventListener('campusflow_open_tour', handleOpenTour);
    return () => window.removeEventListener('campusflow_open_tour', handleOpenTour);
  }, []);

  const role = (user?.role || 'student').toLowerCase();
  const isFaculty = role === 'faculty' || role === 'teacher' || role === 'admin';
  const dashboardLink = isFaculty ? '/teacher' : '/student';

  const navLinks = [
    { name: 'Dashboard', href: dashboardLink, icon: Layers },
    { name: 'Classrooms', href: '/classroom', icon: GraduationCap },
    { name: isFaculty ? 'My Uploads' : 'Study Notes', href: isFaculty ? '/my-uploads' : '/student', icon: BookOpen },
    { name: 'Notices', href: '/notices', icon: Bell },
  ];

  const username = user?.username || 'User';
  const initial = username.charAt(0).toUpperCase();

  return (
    <nav className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/85 border-b border-emerald-100 shadow-xs transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* ── Brand Logo ────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <Link href={dashboardLink} className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-[1.5px] shadow-sm shadow-emerald-500/20 group-hover:shadow-emerald-500/30 transition-all duration-300">
                <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center">
                  <GraduationCap size={20} className="text-[#059669] group-hover:scale-110 transition-transform" />
                </div>
              </div>
              <div>
                <span className="font-black text-lg tracking-tight text-slate-900">
                  Campus<span className="text-[#059669]">Flow</span>
                </span>
                <span className="block text-[9px] font-bold text-emerald-700 tracking-wider uppercase -mt-1">
                  Smart College
                </span>
              </div>
            </Link>
          </div>

          {/* ── Desktop Center Navigation Links ───────────────────────── */}
          <div className="hidden md:flex items-center gap-1.5 bg-slate-50/80 p-1.5 rounded-2xl border border-slate-200/70">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 ${
                    isActive
                      ? 'bg-white text-[#065f46] shadow-xs border border-emerald-200/80'
                      : 'text-slate-600 hover:text-emerald-700 hover:bg-white/60'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-[#059669]' : 'text-slate-400'} />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </div>

          {/* ── Right Actions & Profile ───────────────────────────────── */}
          <div className="hidden md:flex items-center gap-3">
            {/* Ask AI Pill Button */}
            <Link
              href="/ai-assistant"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#ecfdf5] hover:bg-[#dcfce7] border border-emerald-200 text-[#047857] text-xs font-bold transition-all shadow-xs group"
            >
              <Sparkles size={14} className="text-emerald-600 animate-pulse group-hover:rotate-12 transition-transform" />
              <span>Ask AI</span>
            </Link>

            {/* Notification Bell */}
            <Link
              href="/notices"
              title="Campus Notices"
              className="p-2 text-slate-500 hover:text-slate-800 transition rounded-xl hover:bg-slate-100 relative"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white" />
            </Link>

            {/* User Profile Dropdown Pill */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-[#059669] text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                  {initial}
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-xs font-bold text-slate-800 leading-tight">{username}</p>
                  <p className="text-[10px] text-emerald-700 font-bold capitalize leading-none">
                    {isFaculty ? 'Faculty' : `Sem ${user?.sem || user?.semester || 1}`}
                  </p>
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2.5 w-56 bg-white rounded-2xl shadow-xl py-2 z-50 border border-slate-200/90 text-xs animate-in fade-in">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="font-bold text-slate-900 text-sm">{username}</p>
                    <p className="text-slate-500 text-[11px] truncate">{user?.email || 'user@campusflow.edu'}</p>
                    <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#065f46] border border-emerald-200 capitalize">
                      <ShieldCheck size={11} /> {role}
                    </span>
                  </div>

                  <div className="p-1 space-y-0.5">
                    <Link
                      href="/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:text-emerald-800 hover:bg-emerald-50/70 rounded-xl transition font-medium"
                    >
                      <User size={15} className="text-[#059669]" /> Account Profile
                    </Link>
                    <Link
                      href="/classroom"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:text-emerald-800 hover:bg-emerald-50/70 rounded-xl transition font-medium"
                    >
                      <GraduationCap size={15} className="text-[#059669]" /> Class Doubts Room
                    </Link>
                    {isFaculty && (
                      <Link
                        href="/my-uploads"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:text-emerald-800 hover:bg-emerald-50/70 rounded-xl transition font-medium"
                      >
                        <UploadCloud size={15} className="text-[#059669]" /> Manage Uploads
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setTourOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:text-emerald-800 hover:bg-emerald-50/70 rounded-xl transition font-medium text-left"
                    >
                      <Sparkles size={15} className="text-[#059669]" /> Platform Feature Guide
                    </button>
                  </div>

                  <div className="pt-1 mt-1 border-t border-slate-100 px-1">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl text-left transition font-semibold"
                    >
                      <LogOut size={15} /> Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Mobile Hamburger Menu Button ──────────────────────────── */}
          <div className="md:hidden flex items-center gap-2">
            <Link
              href="/ai-assistant"
              className="p-2 text-emerald-700 rounded-xl bg-emerald-50 border border-emerald-200"
              title="Ask AI"
            >
              <Sparkles size={16} />
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-700 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

        </div>
      </div>

      {/* ── Mobile Drawer ───────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-emerald-100 bg-white px-4 py-4 space-y-3 animate-in slide-in-from-top shadow-lg">
          <div className="flex items-center gap-3 px-2 py-2 mb-2 border-b border-slate-100">
            <div className="w-10 h-10 rounded-full bg-[#059669] flex items-center justify-center text-white font-bold text-sm">
              {initial}
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">{username}</p>
              <p className="text-xs text-emerald-700 capitalize font-medium">{role}</p>
            </div>
          </div>

          <div className="space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                    isActive
                      ? 'bg-emerald-50 text-[#065f46] font-bold border border-emerald-200'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-[#059669]' : 'text-slate-400'} />
                  <span>{link.name}</span>
                </Link>
              );
            })}
            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <User size={16} className="text-slate-400" />
              <span>Profile Settings</span>
            </Link>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setTourOpen(true);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-emerald-800 hover:bg-emerald-50 text-left transition"
            >
              <Sparkles size={16} className="text-[#059669]" />
              <span>Platform Feature Guide</span>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Feature Introduction Tour Modal ─────────────────────────── */}
      <FeatureIntroModal
        isOpen={tourOpen}
        onClose={() => setTourOpen(false)}
        userRole={role}
        userName={username}
      />
    </nav>
  );
}
