'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import Link from 'next/link';
import { Eye, EyeOff, Mail, KeyRound, Lock, CheckCircle, ArrowRight, X, Sparkles, GraduationCap } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);
  const [loginRole, setLoginRole] = useState<'student' | 'faculty'>('student');
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
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '571536711772-lvumlfrpk4ql0v9l7e1hnja1lm0hgmpo.apps.googleusercontent.com';

  useEffect(() => {
    // Dynamically inject Google Identity Services script if not already present
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
      const res = await api.post('/api/auth/google/', { credential, role: loginRole });
      login(res.data.user, res.data.tokens.access, res.data.tokens.refresh);
      toast.success(`Welcome back, ${res.data.user.username}!`);
      const userRole = (res.data.user.role || loginRole).toLowerCase();
      const isTeacher = userRole === 'faculty' || userRole === 'teacher' || userRole === 'admin';
      if (isTeacher) {
        router.push('/teacher');
      } else {
        router.push('/student');
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
        const container = document.getElementById('google-btn-container');
        if (container) {
          window.google.accounts.id.renderButton(container, {
            theme: 'outline',
            size: 'large',
            width: '100%',
            text: 'continue_with',
            shape: 'rectangular',
          });
        }
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
      // If Google Client ID is not yet configured, open Gmail OTP login
      setShowGmailModal(true);
    }
  };

  // ── Standard Username/Password Login ────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/api/login/', { 
        username, 
        password,
        role: loginRole 
      });
      login(res.data.user, res.data.tokens.access, res.data.tokens.refresh);
      toast.success('Login successful!');
      const userRole = (res.data.user.role || loginRole).toLowerCase();
      const isTeacher = userRole === 'faculty' || userRole === 'teacher' || userRole === 'admin';
      if (isTeacher) {
        router.push('/teacher');
      } else {
        router.push('/student');
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
        role: gmailRole || loginRole,
      });
      login(res.data.user, res.data.tokens.access, res.data.tokens.refresh);
      toast.success(`Welcome, ${res.data.user.username}!`);
      setShowGmailModal(false);
      const userRole = (res.data.user.role || gmailRole || loginRole).toLowerCase();
      const isTeacher = userRole === 'faculty' || userRole === 'teacher' || userRole === 'admin';
      if (isTeacher) {
        router.push('/teacher');
      } else {
        router.push('/student');
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
    <div className="flex items-center justify-center min-h-screen p-4 py-12 relative overflow-hidden bg-[#f8fafc] font-sans antialiased">
      <Toaster position="top-right" />

      {/* Decorative soft pastel mint ambient spots */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-300/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-300/15 rounded-full blur-3xl pointer-events-none" />

      <div className="bg-white w-full max-w-md p-8 rounded-3xl relative z-10 border border-slate-200/90 shadow-xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 text-[#059669] border border-emerald-100 shadow-xs mb-3">
            <GraduationCap className="w-6 h-6 text-[#059669]" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Welcome Back
          </h2>
          <p className="text-slate-500 text-xs mt-1">Sign in to your Smart College Portal</p>
        </div>

        {/* Role Switcher */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-5 border border-slate-200/70">
          <button
            type="button"
            onClick={() => { setLoginRole('student'); setGmailRole('student'); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition duration-150 ${
              loginRole === 'student'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => { setLoginRole('faculty'); setGmailRole('faculty'); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition duration-150 ${
              loginRole === 'faculty'
                ? 'bg-[#059669] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Teacher / Faculty
          </button>
        </div>

        {/* Official Google Identity Services Rendered Button */}
        <div id="google-btn-container" className="w-full flex justify-center mb-3 min-h-[44px]"></div>

        {/* Fallback Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleButtonClick}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-800 font-semibold py-2.5 px-4 rounded-xl transition border border-slate-200 shadow-xs hover:border-slate-300 disabled:opacity-50 mb-5 text-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
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
          <span>Continue with Google / Gmail</span>
        </button>

        <div className="relative flex items-center justify-center mb-5">
          <div className="border-t border-slate-200 w-full" />
          <span className="bg-white px-3 text-[11px] uppercase tracking-wider text-slate-400 font-bold absolute">
            or password login
          </span>
        </div>

        {/* Username / Password Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600">Username</label>
            <input
              type="text"
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
              placeholder="e.g. john_doe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 pr-11 transition font-medium"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-700 transition"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="flex justify-between items-center mt-2 text-xs">
              <button
                type="button"
                onClick={() => setShowGmailModal(true)}
                className="text-[#059669] hover:underline font-semibold"
              >
                Sign in with Gmail code?
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(true);
                  setForgotStep('email');
                }}
                className="text-slate-500 hover:text-slate-800 hover:underline"
              >
                Forgot Password?
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#059669] hover:bg-[#047857] active:scale-[0.99] text-white rounded-xl py-3 font-semibold text-sm transition shadow-sm disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center mt-6 text-xs text-slate-500">
          Don't have an account?{' '}
          <Link href="/register" className="text-[#059669] hover:underline font-bold transition">
            Register now
          </Link>
        </p>
      </div>

      {/* ── GMAIL AUTH / OTP LOGIN MODAL ───────────────────────── */}
      {showGmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md p-6 md:p-8 rounded-3xl border border-slate-200 shadow-2xl relative">
            <button
              onClick={() => setShowGmailModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-2xl bg-emerald-50 text-[#059669] border border-emerald-100">
                <Mail size={22} />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Gmail Sign-In</h3>
                <p className="text-xs text-slate-500">Instant passwordless access via Gmail OTP</p>
              </div>
            </div>

            {!gmailOtpSent ? (
              <form onSubmit={handleSendGmailOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Your Gmail Address</label>
                  <input
                    type="email"
                    required
                    placeholder="student@gmail.com"
                    value={gmailEmail}
                    onChange={(e) => setGmailEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Role (if creating new account)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['student', 'faculty'].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setGmailRole(r)}
                        className={`py-2 text-xs font-bold rounded-xl capitalize transition border ${
                          gmailRole === r
                            ? 'bg-[#e8f5e9] border-emerald-300 text-[#047857]'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={gmailLoading}
                  className="w-full bg-[#059669] hover:bg-[#047857] text-white rounded-xl py-3 font-semibold text-xs transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                >
                  {gmailLoading ? 'Sending Code...' : 'Send Login Code'}
                  <ArrowRight size={15} />
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyGmailLogin} className="space-y-4">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-medium">
                  We sent a 6-digit one-time login code to <span className="font-bold text-emerald-950">{gmailEmail}</span>.
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">6-Digit Verification Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={gmailOtp}
                    onChange={(e) => setGmailOtp(e.target.value.trim())}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center tracking-widest text-2xl font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={gmailLoading}
                  className="w-full bg-[#059669] hover:bg-[#047857] text-white rounded-xl py-3 font-semibold text-xs transition disabled:opacity-50 shadow-sm"
                >
                  {gmailLoading ? 'Verifying...' : 'Verify & Sign In'}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setGmailOtpSent(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 underline"
                  >
                    Change Email or Resend Code
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── FORGOT PASSWORD MODAL ──────────────────────────────── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md p-6 md:p-8 rounded-3xl border border-slate-200 shadow-2xl relative">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-2xl bg-emerald-50 text-[#059669] border border-emerald-100">
                <KeyRound size={22} />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Reset Password</h3>
                <p className="text-xs text-slate-500">
                  {forgotStep === 'email' && 'Step 1: Enter your registered email'}
                  {forgotStep === 'otp' && 'Step 2: Enter the 6-digit OTP code'}
                  {forgotStep === 'reset' && 'Step 3: Choose your new password'}
                </p>
              </div>
            </div>

            {forgotStep === 'email' && (
              <form onSubmit={handleSendForgotOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Registered Email</label>
                  <input
                    type="email"
                    required
                    placeholder="your.email@gmail.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-medium"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full bg-[#059669] hover:bg-[#047857] text-white rounded-xl py-3 font-semibold text-xs transition disabled:opacity-50 shadow-sm"
                >
                  {forgotLoading ? 'Sending OTP...' : 'Send Reset Code'}
                </button>
              </form>
            )}

            {forgotStep === 'otp' && (
              <form onSubmit={handleVerifyForgotOtp} className="space-y-4">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-medium">
                  Verification code sent to <span className="font-bold text-emerald-950">{forgotEmail}</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Enter 6-Digit OTP</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.trim())}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center tracking-widest text-2xl font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full bg-[#059669] hover:bg-[#047857] text-white rounded-xl py-3 font-semibold text-xs transition disabled:opacity-50 shadow-sm"
                >
                  {forgotLoading ? 'Verifying...' : 'Verify OTP'}
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setForgotStep('email')}
                    className="text-xs text-slate-500 hover:text-slate-800 underline"
                  >
                    Back to Email
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-medium"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full bg-[#059669] hover:bg-[#047857] text-white rounded-xl py-3 font-semibold text-xs transition disabled:opacity-50 shadow-sm"
                >
                  {forgotLoading ? 'Updating Password...' : 'Save New Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
