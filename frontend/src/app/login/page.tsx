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
  BookOpen, 
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden font-sans">
      <Toaster position="top-right" />

      {/* ── Ambient Background Glow Orbs ──────────────────────────── */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-100/70 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-teal-100/70 rounded-full blur-[140px] pointer-events-none" />

      {/* ── Main Split Container ────────────────────────────────────── */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">

        {/* ── Left Side: Brand & Feature Highlights ──────────────────── */}
        <div className="lg:col-span-6 hidden lg:flex flex-col justify-center space-y-8 pr-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-[1.5px] shadow-sm shadow-emerald-500/20">
              <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center">
                <GraduationCap size={26} className="text-[#059669]" />
              </div>
            </div>
            <div>
              <span className="font-black text-2xl tracking-tight text-slate-900">
                Campus<span className="text-[#059669]">Flow</span>
              </span>
              <p className="text-xs font-bold text-emerald-700 tracking-wider uppercase">
                Academic Operating System
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl lg:text-5xl font-black text-slate-900 leading-tight tracking-tight">
              Elevate Your <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#059669] via-emerald-600 to-teal-600">
                College Experience
              </span>
            </h1>
            <p className="text-slate-600 text-sm leading-relaxed max-w-md">
              Secure institutional access with instant class notes distribution, Groq LPU powered academic AI, and semester-scoped doubt clearing channels.
            </p>
          </div>

          {/* Feature Badges */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#059669] flex items-center justify-center shrink-0 border border-emerald-100">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Sub-Second NexusAI Assistant</p>
                <p className="text-[11px] text-slate-500">Deep semantic search over verified subject syllabus</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-100">
                <BookOpen size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Semester-Isolated Study Notes</p>
                <p className="text-[11px] text-slate-500">High-speed AWS S3 storage with automatic faculty approval</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#059669] flex items-center justify-center shrink-0 border border-emerald-100">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Strict Role Verification</p>
                <p className="text-[11px] text-slate-500">Google OAuth 2.0 & Institutional Gmail OTP authentication</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-[#059669] pt-1">
            <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse" />
            <span>Campus Network Online • 2026 Academic Edition</span>
          </div>
        </div>

        {/* ── Right Side: Modern White + Green Login Card ────────────── */}
        <div className="lg:col-span-6 w-full">
          <div className="bg-white rounded-3xl p-6 sm:p-9 border border-slate-200/90 shadow-xl relative overflow-hidden">
            {/* Top Emerald Accent Strip */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-[#059669]" />

            {/* Mobile Header */}
            <div className="lg:hidden flex items-center gap-2.5 mb-6">
              <div className="w-9 h-9 rounded-xl bg-[#059669] flex items-center justify-center text-white">
                <GraduationCap size={20} />
              </div>
              <div>
                <span className="font-extrabold text-lg text-slate-900">CampusFlow</span>
                <span className="text-[10px] text-emerald-700 block -mt-1 font-bold">Smart College</span>
              </div>
            </div>

            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-[#065f46] mb-2 shadow-xs">
                <ShieldCheck size={13} className="text-[#059669]" />
                <span>Institutional Portal</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Sign In to Account
              </h2>
              <p className="text-slate-500 text-xs mt-1">
                Enter your credentials or authenticate via Google OAuth
              </p>
            </div>

            {/* Role Switcher Pill */}
            <div className="grid grid-cols-2 p-1 bg-slate-100/80 border border-slate-200 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => setSelectedRole('student')}
                className={`py-2 text-xs font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
                  selectedRole === 'student'
                    ? 'bg-[#059669] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
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
                    ? 'bg-[#059669] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck size={15} />
                <span>Faculty / Teacher</span>
              </button>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
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
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 rounded-2xl pl-11 pr-4 py-3 text-sm font-medium focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep('email');
                      setShowForgotModal(true);
                    }}
                    className="text-xs text-[#059669] hover:text-[#047857] transition font-bold"
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
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 rounded-2xl pl-11 pr-11 py-3 text-sm font-medium focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700 transition"
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
                className="w-full py-3.5 px-4 rounded-2xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-sm shadow-md shadow-emerald-600/25 hover:shadow-emerald-600/40 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
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
                <div className="w-full border-t border-slate-200" />
              </div>
              <span className="relative px-3 bg-white text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                Or authenticate with
              </span>
            </div>

            {/* Quick OAuth & Gmail OTP Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleGoogleButtonClick}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs transition"
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
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs transition"
              >
                <Mail size={16} className="text-[#059669]" />
                <span>Gmail OTP</span>
              </button>
            </div>

            {/* Bottom Register Prompt */}
            <p className="mt-6 text-center text-xs text-slate-500">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-bold text-[#059669] hover:text-[#047857] transition">
                Create an account →
              </Link>
            </p>
          </div>
        </div>

      </div>

      {/* ── Forgot Password Modal ───────────────────────────────────── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl relative">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#059669] border border-emerald-200 flex items-center justify-center">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Reset Password</h3>
                <p className="text-xs text-slate-500">Step {forgotStep === 'email' ? '1 of 3' : forgotStep === 'otp' ? '2 of 3' : '3 of 3'}</p>
              </div>
            </div>

            {forgotStep === 'email' && (
              <form onSubmit={handleSendForgotOtp} className="space-y-4">
                <p className="text-xs text-slate-600">
                  Enter your registered email address and we&apos;ll send you a 6-digit verification code.
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="user@gmail.com"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3 rounded-2xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs shadow-md transition disabled:opacity-50"
                >
                  {forgotLoading ? 'Sending Code...' : 'Send Verification OTP'}
                </button>
              </form>
            )}

            {forgotStep === 'otp' && (
              <form onSubmit={handleVerifyForgotOtp} className="space-y-4">
                <p className="text-xs text-slate-600">
                  Enter the 6-digit OTP code sent to <span className="text-[#059669] font-bold">{forgotEmail}</span>:
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">6-Digit OTP</label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl px-4 py-2.5 text-sm text-center font-mono tracking-widest outline-none focus:bg-white focus:border-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3 rounded-2xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs shadow-md transition disabled:opacity-50"
                >
                  {forgotLoading ? 'Verifying...' : 'Verify OTP Code'}
                </button>
              </form>
            )}

            {forgotStep === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-xs text-slate-600">
                  Enter your new password below (minimum 6 characters):
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3 rounded-2xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs shadow-md transition disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl relative">
            <button
              onClick={() => {
                setShowGmailModal(false);
                setGmailOtpSent(false);
              }}
              className="absolute top-5 right-5 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#059669] border border-emerald-200 flex items-center justify-center">
                <Mail size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Gmail OTP Login</h3>
                <p className="text-xs text-slate-500">Passwordless verified sign-in</p>
              </div>
            </div>

            {!gmailOtpSent ? (
              <form onSubmit={handleSendGmailOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Account Role</label>
                  <div className="grid grid-cols-2 p-1 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setGmailRole('student')}
                      className={`py-1.5 rounded-lg transition ${gmailRole === 'student' ? 'bg-[#059669] text-white' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setGmailRole('faculty')}
                      className={`py-1.5 rounded-lg transition ${gmailRole === 'faculty' ? 'bg-[#059669] text-white' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Faculty
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Gmail Address</label>
                  <input
                    type="email"
                    required
                    value={gmailEmail}
                    onChange={(e) => setGmailEmail(e.target.value)}
                    placeholder="username@gmail.com"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={gmailLoading}
                  className="w-full py-3 rounded-2xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs shadow-md transition disabled:opacity-50"
                >
                  {gmailLoading ? 'Sending OTP...' : 'Send Login OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyGmailLogin} className="space-y-4">
                <p className="text-xs text-slate-600">
                  Enter the 6-digit OTP code sent to <span className="text-[#059669] font-bold">{gmailEmail}</span>:
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">6-Digit OTP</label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={gmailOtp}
                    onChange={(e) => setGmailOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl px-4 py-2.5 text-sm text-center font-mono tracking-widest outline-none focus:bg-white focus:border-emerald-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGmailOtpSent(false)}
                    className="w-1/3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Change Email
                  </button>
                  <button
                    type="submit"
                    disabled={gmailLoading}
                    className="w-2/3 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs shadow-md transition disabled:opacity-50"
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
