'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import {
  GraduationCap,
  BookOpen,
  MessageSquare,
  Bell,
  ArrowRight,
  Shield,
  Zap,
  Users,
  CheckCircle2,
} from 'lucide-react';
import AiSymbol from '../components/AiSymbol';

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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans antialiased flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#059669] shadow-xs">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-slate-900">
                Smart College
              </span>
              <span className="bg-[#e8f5e9] text-[#047857] text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200/50">
                Portal
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Academic & AI Learning Hub</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-xs font-bold text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-xl hover:bg-slate-100 transition"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="flex items-center gap-1.5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-xs"
          >
            <span>Get Started</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center max-w-5xl mx-auto relative overflow-hidden">
        {/* Soft background ambient blurs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-emerald-200/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-teal-200/15 rounded-full blur-3xl pointer-events-none" />

        {/* AI Pill Badge */}
        <div className="inline-flex items-center gap-2 bg-[#e8f5e9] text-[#047857] border border-emerald-200/70 px-4 py-1.5 rounded-full text-xs font-bold mb-6 shadow-xs animate-in fade-in duration-300">
          <AiSymbol size={16} className="text-[#059669]" />
          <span>NexusAI with Instant LPU Speed & RAG Study Assistant</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-[1.15] mb-6 max-w-4xl">
          The Intelligent Academic Hub for{' '}
          <span className="text-[#059669]">Students & Faculty</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          Seamlessly access semester-wise study notes, real-time live classroom channels, instant department notices, and interact with course materials using your custom AI companion.
        </p>

        {/* Primary CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 mb-16 w-full max-w-md justify-center">
          <Link
            href="/register"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#059669] hover:bg-[#047857] active:scale-[0.99] text-white px-7 py-3 rounded-2xl font-bold text-sm transition shadow-sm"
          >
            <span>Create Free Account</span>
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 px-7 py-3 rounded-2xl font-bold text-sm transition shadow-xs"
          >
            <span>Sign In to Portal</span>
          </Link>
        </div>

        {/* 4 Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full text-left">
          {/* Card 1: NexusAI */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-emerald-300 transition duration-200 group">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#059669] flex items-center justify-center mb-3.5 border border-emerald-100 group-hover:scale-105 transition">
              <AiSymbol size={22} className="text-[#059669]" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-sm mb-1.5 flex items-center gap-1.5">
              <span>NexusAI Assistant</span>
              <span className="bg-[#e8f5e9] text-[#047857] text-[9px] font-bold px-1.5 py-0.5 rounded">AI</span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Ask questions on course PDFs with high-speed LPU generation and RAG semantic search.
            </p>
          </div>

          {/* Card 2: Resource Repository */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-blue-300 transition duration-200 group">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3.5 border border-blue-100 group-hover:scale-105 transition">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-sm mb-1.5">Study Notes & S3</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Organized by semester and subject with direct downloads, previews, and faculty approvals.
            </p>
          </div>

          {/* Card 3: Class Chat */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-indigo-300 transition duration-200 group">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3.5 border border-indigo-100 group-hover:scale-105 transition">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-sm mb-1.5">Live Class Chat</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Semester-restricted WebSocket chatrooms with anonymous aliases and AI polish.
            </p>
          </div>

          {/* Card 4: Notices */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-amber-300 transition duration-200 group">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3.5 border border-amber-100 group-hover:scale-105 transition">
              <Bell className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-sm mb-1.5">Official Notices</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Instant department broadcasts, circulars, and semester notifications in real time.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-6 px-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-emerald-50 text-[#059669] flex items-center justify-center font-bold text-[10px]">
              SC
            </div>
            <span className="font-semibold text-slate-700">Smart College Portal</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
            <Link href="/login" className="hover:text-slate-800">
              Sign In
            </Link>
            <Link href="/register" className="hover:text-slate-800">
              Register
            </Link>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1 text-[#047857] font-semibold">
              <AiSymbol size={13} className="text-[#059669]" />
              NexusAI Enabled
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
