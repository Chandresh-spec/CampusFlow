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
  CheckCircle2 
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
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans relative overflow-hidden">
      {/* ── Ambient Background Lighting ─────────────────────────────── */}
      <div className="absolute top-[-15%] left-[20%] w-[600px] h-[600px] bg-violet-600/20 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[10%] w-[600px] h-[600px] bg-cyan-500/15 rounded-full blur-[160px] pointer-events-none" />

      {/* ── Top Header Bar ──────────────────────────────────────────── */}
      <header className="w-full border-b border-white/[0.08] backdrop-blur-2xl bg-[#080c14]/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-violet-600 to-cyan-400 p-[1.5px] shadow-lg shadow-violet-600/20">
              <div className="w-full h-full rounded-[14px] bg-[#0c1220] flex items-center justify-center">
                <GraduationCap size={20} className="text-violet-400" />
              </div>
            </div>
            <span className="font-extrabold text-lg text-white">
              Campus<span className="text-violet-400">Flow</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/[0.06] transition"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-violet-600/30 transition"
            >
              Get Started →
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Content ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-16 md:py-24 text-center relative z-10 flex flex-col items-center justify-center">
        
        {/* Release Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-bold text-violet-300 mb-8 backdrop-blur-md">
          <Sparkles size={14} className="text-violet-400 animate-pulse" />
          <span>Next-Gen Academic Platform • 2026 Edition</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight leading-[1.1] mb-6">
          The Smart Operating System For{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400">
            Higher Education
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mb-10 leading-relaxed">
          Centralized note distribution with AWS S3 storage, real-time semester doubt rooms, and Groq LPU powered academic AI.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <Link
            href="/register"
            className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-bold text-sm shadow-xl shadow-violet-600/30 hover:shadow-violet-600/50 hover:scale-105 transition-all"
          >
            <span>Join Your Campus</span>
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/login"
            className="px-8 py-3.5 rounded-2xl glass-card text-slate-200 hover:text-white font-bold text-sm hover:border-white/[0.2] transition-all"
          >
            Sign In to Portal
          </Link>
        </div>

        {/* 4 Feature Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full text-left">
          <div className="glass-card rounded-3xl p-6 border border-white/[0.08] hover:border-violet-500/40 transition-all duration-300">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/20 text-violet-400 flex items-center justify-center mb-3">
              <BookOpen size={20} />
            </div>
            <h3 className="font-bold text-white text-base mb-1">Study Materials</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Curated notes and exam papers organized by semester and subject.
            </p>
          </div>

          <div className="glass-card rounded-3xl p-6 border border-white/[0.08] hover:border-cyan-500/40 transition-all duration-300">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3">
              <Sparkles size={20} />
            </div>
            <h3 className="font-bold text-white text-base mb-1">NexusAI Assistant</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sub-second syllabus Q&A grounded on official lecture notes.
            </p>
          </div>

          <div className="glass-card rounded-3xl p-6 border border-white/[0.08] hover:border-emerald-500/40 transition-all duration-300">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
              <Users size={20} />
            </div>
            <h3 className="font-bold text-white text-base mb-1">Class Doubt Rooms</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Live semester chat with faculty and classmates in real-time.
            </p>
          </div>

          <div className="glass-card rounded-3xl p-6 border border-white/[0.08] hover:border-indigo-500/40 transition-all duration-300">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
              <ShieldCheck size={20} />
            </div>
            <h3 className="font-bold text-white text-base mb-1">Verified Accounts</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Role isolation with Gmail OTP and Google OAuth verification.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/[0.06] py-6 text-center text-xs text-slate-400">
        <p>© 2026 CampusFlow. Smart College Academic Operating System.</p>
      </footer>
    </div>
  );
}
