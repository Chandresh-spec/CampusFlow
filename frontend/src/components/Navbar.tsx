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
  ShieldCheck,
  Compass
} from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

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
    <nav className="sticky top-0 z-50 w-full backdrop-blur-2xl bg-[#080c14]/85 border-b border-white/[0.08] transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-18">
          
          {/* ── Brand Logo ────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <Link href={dashboardLink} className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-400 p-[1.5px] shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-all duration-300">
                <div className="w-full h-full rounded-[14px] bg-[#0c1220] flex items-center justify-center">
                  <GraduationCap size={20} className="text-violet-400 group-hover:scale-110 transition-transform" />
                </div>
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
                  Campus<span className="text-violet-400">Flow</span>
                </span>
                <span className="block text-[9px] font-bold text-violet-400/80 tracking-widest uppercase -mt-0.5">
                  Smart College
                </span>
              </div>
            </Link>
          </div>

          {/* ── Desktop Center Navigation Links ───────────────────────── */}
          <div className="hidden md:flex items-center gap-1.5 bg-white/[0.03] p-1.5 rounded-2xl border border-white/[0.06]">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/30'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
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
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-violet-600/20 to-cyan-500/20 hover:from-violet-600/30 hover:to-cyan-500/30 border border-violet-500/30 text-violet-200 text-xs font-bold transition-all shadow-sm hover:shadow-violet-500/20 group"
            >
              <Sparkles size={14} className="text-violet-400 animate-pulse group-hover:rotate-12 transition-transform" />
              <span>Ask AI</span>
            </Link>

            {/* Notification Bell */}
            <Link
              href="/notices"
              title="Campus Notices"
              className="p-2 text-slate-400 hover:text-white transition rounded-xl hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] relative"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-[#080c14] animate-ping" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-[#080c14]" />
            </Link>

            {/* User Profile Dropdown Pill */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.15] transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 text-white font-black text-xs flex items-center justify-center shadow-md">
                  {initial}
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-xs font-bold text-slate-200 leading-tight">{username}</p>
                  <p className="text-[10px] text-violet-400 font-semibold capitalize leading-none">
                    {isFaculty ? 'Faculty' : `Sem ${user?.sem || user?.semester || 1}`}
                  </p>
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2.5 w-56 glass-card rounded-2xl shadow-2xl py-2 z-50 border border-white/[0.1] text-xs animate-in fade-in zoom-in-95">
                  <div className="px-4 py-2.5 border-b border-white/[0.08]">
                    <p className="font-bold text-slate-100 text-sm">{username}</p>
                    <p className="text-slate-400 text-[11px] truncate">{user?.email || 'student@campusflow.edu'}</p>
                    <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 capitalize">
                      <ShieldCheck size={11} /> {role}
                    </span>
                  </div>

                  <div className="p-1 space-y-0.5">
                    <Link
                      href="/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-white/[0.06] rounded-xl transition font-medium"
                    >
                      <User size={15} className="text-violet-400" /> Account Profile
                    </Link>
                    <Link
                      href="/classroom"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-white/[0.06] rounded-xl transition font-medium"
                    >
                      <GraduationCap size={15} className="text-indigo-400" /> Class Doubts Room
                    </Link>
                    {isFaculty && (
                      <Link
                        href="/my-uploads"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-white/[0.06] rounded-xl transition font-medium"
                      >
                        <UploadCloud size={15} className="text-emerald-400" /> Manage Uploads
                      </Link>
                    )}
                  </div>

                  <div className="pt-1 mt-1 border-t border-white/[0.08] px-1">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl text-left transition font-semibold"
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
              className="p-2 text-violet-400 rounded-xl bg-violet-500/10 border border-violet-500/20"
              title="Ask AI"
            >
              <Sparkles size={16} />
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-white/[0.06] transition"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

        </div>
      </div>

      {/* ── Mobile Drawer ───────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/[0.08] bg-[#0c1220]/95 backdrop-blur-2xl px-4 py-4 space-y-3 animate-in slide-in-from-top">
          <div className="flex items-center gap-3 px-2 py-2 mb-2 border-b border-white/[0.08]">
            <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm">
              {initial}
            </div>
            <div>
              <p className="font-bold text-white text-sm">{username}</p>
              <p className="text-xs text-violet-400 capitalize">{role}</p>
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
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <Icon size={16} />
                  <span>{link.name}</span>
                </Link>
              );
            })}
            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-white"
            >
              <User size={16} />
              <span>Profile Settings</span>
            </Link>
          </div>

          <div className="pt-2 border-t border-white/[0.08]">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-rose-400 hover:bg-rose-500/10 transition"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
