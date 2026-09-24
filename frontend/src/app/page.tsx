'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { 
  GraduationCap, 
  Sparkles, 
  BookOpen, 
  ShieldCheck, 
  ArrowRight, 
  Users, 
  Layers, 
  CheckCircle2,
  FileText
} from 'lucide-react';

export default function Home() {
  const { isAuthenticated, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      if (user.role?.toLowerCase() === 'student') {
        router.push('/student');
      } else {
        router.push('/teacher');
      }
    }
  }, [isAuthenticated, user, loading, router]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans relative overflow-hidden">
      {/* ── Ambient Background Lighting ─────────────────────────────── */}
      <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] bg-emerald-100/60 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] bg-teal-100/60 rounded-full blur-[140px] pointer-events-none" />

      {/* ── Top Header Bar ──────────────────────────────────────────── */}
      <header className="w-full border-b border-emerald-100/80 backdrop-blur-md bg-white/80 sticky top-0 z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-[1.5px] shadow-sm shadow-emerald-500/20">
              <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center">
                <GraduationCap size={20} className="text-[#059669]" />
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
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/60 transition"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold shadow-sm shadow-emerald-600/30 transition flex items-center gap-1"
            >
              <span>Get Started</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Content ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center relative z-10 flex flex-col items-center justify-center">
        
        {/* Release Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ecfdf5] border border-emerald-200 text-xs font-bold text-[#065f46] mb-6 shadow-xs">
          <Sparkles size={14} className="text-[#059669] animate-pulse" />
          <span>Next-Gen Academic Platform • 2026 Edition</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-[1.15] mb-5">
          The Smart Operating System For{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#059669] via-emerald-600 to-teal-600">
            Higher Education
          </span>
        </h1>

        <p className="text-sm sm:text-base md:text-lg text-slate-600 max-w-2xl mb-8 leading-relaxed">
          Centralized note distribution with high-speed AWS S3 storage, real-time semester doubt rooms, and Groq LPU powered academic AI.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 mb-14 w-full sm:w-auto">
          <Link
            href="/register"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-sm shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 hover:scale-105 transition-all"
          >
            <span>Join Your Campus</span>
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-sm shadow-xs hover:border-slate-300 transition-all"
          >
            Sign In to Portal
          </Link>
        </div>

        {/* 4 Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full text-left">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all duration-200">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#059669] flex items-center justify-center mb-3 border border-emerald-100">
              <BookOpen size={20} />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Study Materials</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Curated notes and exam papers organized by semester and subject.
            </p>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all duration-200">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3 border border-teal-100">
              <Sparkles size={20} />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">NexusAI Assistant</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Sub-second syllabus Q&A grounded on official lecture notes.
            </p>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all duration-200">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#059669] flex items-center justify-center mb-3 border border-emerald-100">
              <Users size={20} />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Class Doubt Rooms</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Live semester chat with faculty and classmates in real-time.
            </p>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all duration-200">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3 border border-teal-100">
              <ShieldCheck size={20} />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Verified Accounts</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Role isolation with Gmail OTP and Google OAuth verification.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200/70 py-6 text-center text-xs text-slate-500 bg-white/50">
        <p>© 2026 CampusFlow. Smart College Academic Operating System.</p>
      </footer>
    </div>
  );
}
