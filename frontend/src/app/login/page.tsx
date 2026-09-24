'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import Link from 'next/link';
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  User as UserIcon, 
  ArrowRight, 
  X, 
  Sparkles, 
  GraduationCap, 
  ShieldCheck, 
  KeyRound, 
  CheckCircle2, 
  Zap,
  BookOpen,
  Layers,
  Loader2
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

declare global {
  interface Window {
    google?: any;
  }
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'student' | 'faculty'>('student');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  // ── Forgot Password Modal State ─────────────────────────────
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'reset'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // ── Gmail OTP Login Modal State ─────────────────────────────
  const [showGmailModal, setShowGmailModal] = useState(false);
  const [gmailEmail, setGmailEmail] = useState('');
  const [gmailOtp, setGmailOtp] = useState('');
  const [gmailOtpSent, setGmailOtpSent] = useState(false);
  const [gmailRole, setGmailRole] = useState('student');
  const [gmailLoading, setGmailLoading] = useState(false);

  // ── Google Identity Services (GIS) Setup ────────────────────
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    if (!document.getElementById('google-gsi-client')) {
      const script = document.createElement('script');
      script.id = 'google-gsi-client';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initGoogleClient();
      };
      document.body.appendChild(script);
    } else {
      initGoogleClient();
    }
  }, []);

  const handleGoogleTokenResponse = async (credential: string) => {
    setLoading(true);
    try {
      const res = await api.post('/api/auth/google/', { credential, role: selectedRole });
      login(res.data.user, res.data.tokens.access, res.data.tokens.refresh);
      toast.success(`Welcome back, ${res.data.user.username}!`);
      if (res.data.user.role?.toLowerCase() === 'student') {
        router.push('/student');
      } else {
        router.push('/teacher');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const initGoogleClient = () => {
    if (googleClientId && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response: any) => {
            if (response.credential) {
              handleGoogleTokenResponse(response.credential);
            }
          },
        });
      } catch (err) {
        console.warn('Google GSI init failed:', err);
      }
    }
  };

  const handleGoogleButtonClick = () => {
    if (googleClientId && window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setShowGmailModal(true);
        }
      });
    } else {
      setShowGmailModal(true);
    }
  };

  // ── Standard Username/Password Login ────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/api/login/', { username, password });
      login(res.data.user, res.data.tokens.access, res.data.tokens.refresh);
      toast.success('Login successful!');
      if (res.data.user.role?.toLowerCase() === 'student') {
        router.push('/student');
      } else {
        router.push('/teacher');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Gmail OTP Login Handlers ────────────────────────────────
  const handleSendGmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gmailEmail || !gmailEmail.includes('@')) {
      toast.error('Please enter a valid Gmail address');
      return;
    }
    setGmailLoading(true);
    try {
      const res = await api.post('/api/auth/send-gmail-login-otp/', { email: gmailEmail });
      toast.success(res.data.message || 'OTP sent to your Gmail!');
      setGmailOtpSent(true);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to send OTP to Gmail');
    } finally {
      setGmailLoading(false);
    }
  };

  const handleVerifyGmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gmailOtp || gmailOtp.length < 6) {
      toast.error('Please enter the 6-digit OTP code');
      return;
    }
    setGmailLoading(true);
    try {
      const res = await api.post('/api/auth/verify-gmail-login/', {
        email: gmailEmail,
        otp: gmailOtp,
        role: gmailRole,
      });
      login(res.data.user, res.data.tokens.access, res.data.tokens.refresh);
      toast.success(`Welcome, ${res.data.user.username}!`);
      setShowGmailModal(false);
      if (res.data.user.role?.toLowerCase() === 'student') {
        router.push('/student');
      } else {
        router.push('/teacher');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invalid OTP code');
    } finally {
      setGmailLoading(false);
    }
  };

  // ── Forgot Password Handlers ────────────────────────────────
  const handleSendForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error('Please enter your email');
      return;
    }
    setForgotLoading(true);
    try {
      await api.post('/api/forgot-password/', { email: forgotEmail });
      toast.success('Password reset OTP sent to your email!');
      setForgotStep('otp');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to send reset OTP');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp) {
      toast.error('Please enter the 6-digit OTP');
      return;
    }
    setForgotLoading(true);
    try {
      await api.post('/api/verify-otp/', { email: forgotEmail, otp: forgotOtp });
      toast.success('OTP verified successfully!');
      setForgotStep('reset');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invalid OTP code');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setForgotLoading(true);
    try {
      await api.post('/api/reset-password/', {
        email: forgotEmail,
        otp: forgotOtp,
        new_password: newPassword,
      });
      toast.success('Password reset successfully! Please login.');
      setShowForgotModal(false);
      setForgotStep('email');
      setForgotEmail('');
      setForgotOtp('');
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to reset password');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden font-sans">
      <Toaster position="top-right" />

      {/* ── Ambient Background Glow Orbs ──────────────────────────── */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[30%] right-[20%] w-[350px] h-[350px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* ── Main Split Container ────────────────────────────────────── */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">

        {/* ── Left Side: Brand & Feature Highlights ──────────────────── */}
        <div className="lg:col-span-6 hidden lg:flex flex-col justify-center space-y-8 pr-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-400 p-[1.5px] shadow-xl shadow-violet-600/30">
              <div className="w-full h-full rounded-[14px] bg-[#0c1220] flex items-center justify-center">
                <GraduationCap size={26} className="text-violet-400" />
              </div>
            </div>
            <div>
              <span className="font-black text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
                Campus<span className="text-violet-400">Flow</span>
              </span>
              <p className="text-xs font-semibold text-violet-300/70 tracking-widest uppercase">
                Academic Operating System
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight">
              Elevate Your <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400">
                College Experience
              </span>
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed max-w-md">
              Secure institutional access with instant class notes distribution, Groq LPU powered academic AI, and semester-scoped doubt clearing channels.
            </p>
          </div>

          {/* Feature Badges */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-md">
              <div className="w-9 h-9 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0 border border-violet-500/30">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">Sub-Second NexusAI Assistant</p>
                <p className="text-[11px] text-slate-400">Deep RAG semantic search over verified subject syllabus</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-md">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
                <BookOpen size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">Semester-Isolated Study Notes</p>
                <p className="text-[11px] text-slate-400">High-speed AWS S3 storage with automatic faculty approval</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-md">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">Strict Role Verification</p>
                <p className="text-[11px] text-slate-400">Google OAuth 2.0 & Institutional Gmail OTP authentication</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400/90 pt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Campus Network Online • 2026 Academic Edition</span>
          </div>
        </div>

        {/* ── Right Side: Trending Glassmorphism Login Card ──────────── */}
        <div className="lg:col-span-6 w-full">
          <div className="glass-card rounded-3xl p-6 sm:p-9 border border-white/[0.1] shadow-2xl relative overflow-hidden backdrop-blur-2xl">
            {/* Subtle Top Card Border Highlight */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-400" />

            {/* Mobile Header */}
            <div className="lg:hidden flex items-center gap-2.5 mb-6">
              <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center text-white">
                <GraduationCap size={20} />
              </div>
              <div>
                <span className="font-extrabold text-lg text-white">CampusFlow</span>
                <span className="text-[10px] text-violet-400 block -mt-1 font-semibold">Smart College</span>
              </div>
            </div>

            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-[11px] font-bold text-violet-300 mb-2">
                <ShieldCheck size={13} className="text-violet-400" />
                <span>Institutional Portal</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Sign In to Account
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                Enter your credentials or authenticate via Google OAuth
              </p>
            </div>

            {/* Role Switcher Pill */}
            <div className="grid grid-cols-2 p-1 bg-white/[0.04] border border-white/[0.08] rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => setSelectedRole('student')}
                className={`py-2 text-xs font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
                  selectedRole === 'student'
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <GraduationCap size={15} />
                <span>Student</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('faculty')}
                className={`py-2 text-xs font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
                  selectedRole === 'faculty'
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck size={15} />
                <span>Faculty / Teacher</span>
              </button>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Username
                </label>
                <div className="relative">
                  <UserIcon size={16} className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full glass-input rounded-2xl pl-11 pr-4 py-3 text-sm font-medium outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep('email');
                      setShowForgotModal(true);
                    }}
                    className="text-xs text-violet-400 hover:text-violet-300 transition font-semibold"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full glass-input rounded-2xl pl-11 pr-11 py-3 text-sm font-medium outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white transition"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-bold text-sm shadow-lg shadow-violet-600/30 hover:shadow-violet-600/50 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In as {selectedRole === 'student' ? 'Student' : 'Faculty'}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/[0.08]" />
              </div>
              <span className="relative px-3 bg-[#0c1220] text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                Or authenticate with
              </span>
            </div>

            {/* Quick OAuth & Gmail OTP Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleGoogleButtonClick}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.15] text-xs font-semibold text-slate-200 transition"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Google</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setGmailRole(selectedRole);
                  setShowGmailModal(true);
                }}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.15] text-xs font-semibold text-slate-200 transition"
              >
                <Mail size={16} className="text-violet-400" />
                <span>Gmail OTP</span>
              </button>
            </div>

            {/* Bottom Register Prompt */}
            <p className="mt-6 text-center text-xs text-slate-400">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-bold text-violet-400 hover:text-violet-300 transition">
                Create an account →
              </Link>
            </p>
          </div>
        </div>

      </div>

      {/* ── Forgot Password Modal ───────────────────────────────────── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-md w-full border border-white/[0.1] shadow-2xl relative">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-xl hover:bg-white/[0.08] text-slate-400 hover:text-white transition"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-violet-600/20 text-violet-400 border border-violet-500/30 flex items-center justify-center">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Reset Password</h3>
                <p className="text-xs text-slate-400">Step {forgotStep === 'email' ? '1 of 3' : forgotStep === 'otp' ? '2 of 3' : '3 of 3'}</p>
              </div>
            </div>

            {forgotStep === 'email' && (
              <form onSubmit={handleSendForgotOtp} className="space-y-4">
                <p className="text-xs text-slate-300">
                  Enter your registered email address and we&apos;ll send you a 6-digit verification code.
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="user@gmail.com"
                    className="w-full glass-input rounded-2xl px-4 py-2.5 text-sm outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-violet-600/30 transition disabled:opacity-50"
                >
                  {forgotLoading ? 'Sending Code...' : 'Send Verification OTP'}
                </button>
              </form>
            )}

            {forgotStep === 'otp' && (
              <form onSubmit={handleVerifyForgotOtp} className="space-y-4">
                <p className="text-xs text-slate-300">
                  Enter the 6-digit OTP code sent to <span className="text-violet-400 font-bold">{forgotEmail}</span>:
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">6-Digit OTP</label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full glass-input rounded-2xl px-4 py-2.5 text-sm text-center font-mono tracking-widest outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-violet-600/30 transition disabled:opacity-50"
                >
                  {forgotLoading ? 'Verifying...' : 'Verify OTP Code'}
                </button>
              </form>
            )}

            {forgotStep === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-xs text-slate-300">
                  Enter your new password below (minimum 6 characters):
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full glass-input rounded-2xl px-4 py-2.5 text-sm outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition disabled:opacity-50"
                >
                  {forgotLoading ? 'Saving...' : 'Set New Password & Login'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Gmail OTP Login Modal ───────────────────────────────────── */}
      {showGmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-md w-full border border-white/[0.1] shadow-2xl relative">
            <button
              onClick={() => {
                setShowGmailModal(false);
                setGmailOtpSent(false);
              }}
              className="absolute top-5 right-5 p-1.5 rounded-xl hover:bg-white/[0.08] text-slate-400 hover:text-white transition"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-violet-600/20 text-violet-400 border border-violet-500/30 flex items-center justify-center">
                <Mail size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Gmail OTP Login</h3>
                <p className="text-xs text-slate-400">Passwordless verified sign-in</p>
              </div>
            </div>

            {!gmailOtpSent ? (
              <form onSubmit={handleSendGmailOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Account Role</label>
                  <div className="grid grid-cols-2 p-1 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setGmailRole('student')}
                      className={`py-1.5 rounded-lg transition ${gmailRole === 'student' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setGmailRole('faculty')}
                      className={`py-1.5 rounded-lg transition ${gmailRole === 'faculty' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      Faculty
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Gmail Address</label>
                  <input
                    type="email"
                    required
                    value={gmailEmail}
                    onChange={(e) => setGmailEmail(e.target.value)}
                    placeholder="username@gmail.com"
                    className="w-full glass-input rounded-2xl px-4 py-2.5 text-sm outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={gmailLoading}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-violet-600/30 transition disabled:opacity-50"
                >
                  {gmailLoading ? 'Sending OTP...' : 'Send Login OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyGmailLogin} className="space-y-4">
                <p className="text-xs text-slate-300">
                  Enter the 6-digit OTP code sent to <span className="text-violet-400 font-bold">{gmailEmail}</span>:
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">6-Digit OTP</label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={gmailOtp}
                    onChange={(e) => setGmailOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full glass-input rounded-2xl px-4 py-2.5 text-sm text-center font-mono tracking-widest outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGmailOtpSent(false)}
                    className="w-1/3 py-2.5 rounded-xl border border-white/[0.1] text-xs font-semibold text-slate-300 hover:bg-white/[0.06]"
                  >
                    Change Email
                  </button>
                  <button
                    type="submit"
                    disabled={gmailLoading}
                    className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-violet-600/30 transition disabled:opacity-50"
                  >
                    {gmailLoading ? 'Verifying...' : 'Verify & Login'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
