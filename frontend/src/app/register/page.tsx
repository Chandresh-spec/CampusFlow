'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import Link from 'next/link';
import { Mail, CheckCircle2, ShieldCheck, ArrowRight, GraduationCap } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

declare global {
  interface Window {
    google?: any;
  }
}

export default function Register() {
  const [role, setRole] = useState('Student');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    mobile_number: '',
    usn: '',
    semester: '1',
  });
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  // ── Cooldown timer for resending OTP ─────────────────────────
  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // ── Google Identity Services (GIS) Setup ────────────────────
  const googleClientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    '571536711772-lvumlfrpk4ql0v9l7e1hnja1lm0hgmpo.apps.googleusercontent.com';

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
  }, [role]);

  const initGoogleClient = () => {
    if (googleClientId && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: any) => {
            if (response.credential) {
              setLoading(true);
              try {
                const res = await api.post('/api/auth/google/', {
                  credential: response.credential,
                  role: role.toLowerCase(),
                });
                login(res.data.user, res.data.tokens.access, res.data.tokens.refresh);
                toast.success(`Welcome to Smart College, ${res.data.user.username}!`);
                const userRole = (res.data.user.role || role).toLowerCase();
                const isTeacher = userRole === 'faculty' || userRole === 'teacher' || userRole === 'admin';
                if (isTeacher) {
                  router.push('/teacher');
                } else {
                  router.push('/student');
                }
              } catch (err: any) {
                toast.error(err.response?.data?.detail || 'Google sign-up failed');
              } finally {
                setLoading(false);
              }
            }
          },
        });
      } catch (err) {
        console.warn('Google GSI init failed:', err);
      }
    }
  };

  const handleGoogleSignUp = () => {
    if (googleClientId && window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          toast('Please register below or use passwordless Gmail sign-in on the login page.', {
            icon: 'ℹ️',
          });
        }
      });
    } else {
      toast('Google Cloud OAuth not configured. Please use Gmail OTP verification below!', {
        icon: '💡',
      });
    }
  };

  // ── Send Registration OTP via Gmail ─────────────────────────
  const handleSendRegisterOtp = async () => {
    if (!formData.email || !formData.email.includes('@')) {
      toast.error('Please enter a valid email address first');
      return;
    }
    if (!formData.username) {
      toast.error('Please enter a username first');
      return;
    }

    setOtpSending(true);
    try {
      const res = await api.post('/api/send-register-otp/', {
        email: formData.email,
        username: formData.username,
      });
      toast.success(res.data.message || 'Verification code sent to your Gmail!');
      setOtpSent(true);
      setCountdown(60);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to send verification code');
    } finally {
      setOtpSending(false);
    }
  };

  // ── Submit Registration ─────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload: any = {
        ...formData,
        role: role.toLowerCase(),
      };

      if (role.toLowerCase() !== 'student') {
        delete payload.usn;
        delete payload.semester;
        delete payload.sem;
      } else {
        payload.sem = parseInt(formData.semester) || 1;
      }

      // If OTP flow was initiated or OTP entered, verify through /api/verify-register/
      if (otpSent || otp.trim().length > 0) {
        if (!otp.trim()) {
          toast.error('Please enter the 6-digit verification code sent to your Gmail');
          setLoading(false);
          return;
        }
        payload.otp = otp.trim();
        const res = await api.post('/api/verify-register/', payload);
        toast.success('Gmail verified & registration successful!');
        if (res.data?.tokens?.access) {
          login(res.data.user, res.data.tokens.access, res.data.tokens.refresh);
          setTimeout(() => {
            const userRole = (res.data.user.role || role).toLowerCase();
            const isTeacher = userRole === 'faculty' || userRole === 'teacher' || userRole === 'admin';
            if (isTeacher) {
              router.push('/teacher');
            } else {
              router.push('/student');
            }
          }, 1000);
        } else {
          setTimeout(() => router.push('/login'), 1500);
        }
      } else {
        // Direct registration fallback
        await api.post('/api/register/', payload);
        toast.success('Registration successful! Please log in.');
        setTimeout(() => router.push('/login'), 1500);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 py-12 relative overflow-hidden bg-[#f8fafc] font-sans antialiased">
      <Toaster position="top-right" />

      {/* Decorative soft pastel ambient spots */}
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-300/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-300/15 rounded-full blur-3xl pointer-events-none" />

      <div className="bg-white w-full max-w-lg p-8 rounded-3xl relative z-10 border border-slate-200/90 shadow-xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 text-[#059669] border border-emerald-100 shadow-xs mb-3">
            <GraduationCap className="w-6 h-6 text-[#059669]" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Create Account
          </h2>
          <p className="text-slate-500 text-xs mt-1">Join the Smart College Portal</p>
        </div>

        {/* Role Selection */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6 border border-slate-200/70">
          {['Student', 'Teacher'].map((r) => (
            <button
              key={r}
              type="button"
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition duration-150 ${
                role === r
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setRole(r)}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Continue with Google */}
        <button
          type="button"
          onClick={handleGoogleSignUp}
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
          <span>Sign up with Google as {role}</span>
        </button>

        <div className="relative flex items-center justify-center mb-5">
          <div className="border-t border-slate-200 w-full" />
          <span className="bg-white px-3 text-[11px] uppercase tracking-wider text-slate-400 font-bold absolute">
            or with email & OTP verify
          </span>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600">Username</label>
            <input
              required
              type="text"
              placeholder="e.g. alex_student"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Gmail / Email</label>
              <button
                type="button"
                onClick={handleSendRegisterOtp}
                disabled={otpSending || countdown > 0}
                className="text-xs font-bold text-[#059669] hover:underline disabled:opacity-50 transition flex items-center gap-1"
              >
                <ShieldCheck size={14} />
                {otpSending
                  ? 'Sending...'
                  : countdown > 0
                  ? `Resend in ${countdown}s`
                  : otpSent
                  ? 'Resend OTP'
                  : 'Verify Gmail OTP'}
              </button>
            </div>
            <input
              required
              type="email"
              placeholder="student@gmail.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          {/* OTP Input Field */}
          {otpSent && (
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-xs text-[#047857] mb-2 font-semibold">
                <CheckCircle2 size={15} className="text-[#059669]" />
                6-digit code sent to your Gmail inbox!
              </div>
              <input
                type="text"
                maxLength={6}
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.trim())}
                className="w-full bg-white border border-emerald-300 rounded-xl px-4 py-2.5 text-center text-xl tracking-widest font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-bold"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600">Password</label>
            <input
              required
              type="password"
              placeholder="Create a strong password"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600">Mobile Number</label>
            <input
              required
              type="tel"
              placeholder="e.g. +91 9876543210"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
              value={formData.mobile_number}
              onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
            />
          </div>

          {role === 'Student' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600">USN</label>
                <input
                  required
                  type="text"
                  placeholder="1DS21CS001"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 uppercase placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
                  value={formData.usn}
                  onChange={(e) => setFormData({ ...formData, usn: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-600">Semester</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
                  value={formData.semester}
                  onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s} className="bg-white text-slate-800">
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#059669] hover:bg-[#047857] active:scale-[0.99] text-white rounded-xl py-3 font-semibold text-sm transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 mt-6"
          >
            {loading ? (
              'Creating Account...'
            ) : otpSent ? (
              <>
                <ShieldCheck size={18} />
                <span>Verify OTP & Create Account</span>
              </>
            ) : (
              <>
                <span>Register as {role}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <p className="text-center mt-6 text-xs text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="text-[#059669] hover:underline font-bold transition">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
