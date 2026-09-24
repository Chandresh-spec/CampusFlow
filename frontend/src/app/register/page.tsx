'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import Link from 'next/link';
import { 
  Mail, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  GraduationCap, 
  Lock, 
  User as UserIcon, 
  Phone, 
  Layers, 
  Hash, 
  Loader2,
  Check
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

declare global {
  interface Window {
    google?: any;
  }
}

export default function Register() {
  const [role, setRole] = useState<'Student' | 'Faculty'>('Student');
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
                toast.success(`Welcome to CampusFlow, ${res.data.user.username}!`);
                if (res.data.user.role?.toLowerCase() === 'student') {
                  router.push('/student');
                } else {
                  router.push('/teacher');
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
            if (res.data.user.role?.toLowerCase() === 'student') {
              router.push('/student');
            } else {
              router.push('/teacher');
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden font-sans">
      <Toaster position="top-right" />

      {/* ── Ambient Background Glow Orbs ──────────────────────────── */}
      <div className="absolute top-[-10%] right-[-10%] w-[550px] h-[550px] bg-emerald-100/70 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[550px] h-[550px] bg-teal-100/70 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-3xl relative z-10">
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-xl relative">
          {/* Top Emerald Accent Strip */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-[#059669]" />

          {/* Header */}
          <div className="text-center max-w-lg mx-auto mb-8">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-3 group">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-[1.5px] shadow-sm">
                <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center">
                  <GraduationCap size={22} className="text-[#059669] group-hover:scale-110 transition-transform" />
                </div>
              </div>
              <span className="font-black text-2xl tracking-tight text-slate-900">
                Campus<span className="text-[#059669]">Flow</span>
              </span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Create Your Academic Account
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">
              Join your campus network for notes, doubt rooms, and academic AI
            </p>
          </div>

          {/* Role Selection Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => setRole('Student')}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 relative ${
                role === 'Student'
                  ? 'bg-emerald-50/70 border-emerald-400 shadow-sm ring-1 ring-emerald-400/40'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              {role === 'Student' && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#059669] flex items-center justify-center text-white">
                  <Check size={12} />
                </div>
              )}
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#059669] flex items-center justify-center mb-2">
                <GraduationCap size={18} />
              </div>
              <p className="text-sm font-bold text-slate-900">Student Account</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Semester notes, classroom doubts, and AI study assistant
              </p>
            </button>

            <button
              type="button"
              onClick={() => setRole('Faculty')}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 relative ${
                role === 'Faculty'
                  ? 'bg-emerald-50/70 border-emerald-400 shadow-sm ring-1 ring-emerald-400/40'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              {role === 'Faculty' && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#059669] flex items-center justify-center text-white">
                  <Check size={12} />
                </div>
              )}
              <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center mb-2">
                <ShieldCheck size={18} />
              </div>
              <p className="text-sm font-bold text-slate-900">Faculty / Professor</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Upload course resources, answer doubts, and manage subjects
              </p>
            </button>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Username *
                </label>
                <div className="relative">
                  <UserIcon size={16} className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g. rahul_kumar"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm font-medium outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Password *
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm font-medium outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Gmail Address *
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@gmail.com"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm font-medium outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone size={16} className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    type="tel"
                    value={formData.mobile_number}
                    onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm font-medium outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Student Specific Fields */}
              {role === 'Student' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Enrolled Semester *
                    </label>
                    <div className="relative">
                      <Layers size={16} className="absolute left-4 top-3.5 text-slate-400 pointer-events-none" />
                      <select
                        value={formData.semester}
                        onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm font-medium outline-none focus:bg-white focus:border-emerald-500 appearance-none"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                          <option key={s} value={String(s)}>
                            Semester {s} (Class {s})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Student USN (Roll Number)
                    </label>
                    <div className="relative">
                      <Hash size={16} className="absolute left-4 top-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={formData.usn}
                        onChange={(e) => setFormData({ ...formData, usn: e.target.value })}
                        placeholder="e.g. 1CR21CS045"
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm font-medium uppercase outline-none focus:bg-white focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ── Optional Gmail OTP Verification Box ──────────────────── */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/90 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-[#065f46] flex items-center gap-1.5">
                    <ShieldCheck size={15} className="text-[#059669]" />
                    <span>Gmail OTP Verification</span>
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Verify ownership of your email address for instant verified status
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSendRegisterOtp}
                  disabled={otpSending || countdown > 0}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-emerald-300 text-[#065f46] text-xs font-bold transition shadow-xs disabled:opacity-50 shrink-0"
                >
                  {otpSending ? 'Sending...' : countdown > 0 ? `Resend (${countdown}s)` : otpSent ? 'Resend OTP' : 'Send Code to Gmail'}
                </button>
              </div>

              {otpSent && (
                <div className="pt-2 border-t border-emerald-200">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Enter 6-Digit OTP Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 text-sm text-center font-mono tracking-widest outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-sm shadow-md shadow-emerald-600/25 hover:shadow-emerald-600/40 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
            >
              {loading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create {role} Account</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Quick Google Sign-Up */}
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={handleGoogleSignUp}
              className="inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 shadow-xs transition"
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
              <span>Instant Google Sign-Up</span>
            </button>
          </div>

          {/* Bottom Login Link */}
          <p className="mt-5 text-center text-xs text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="font-bold text-[#059669] hover:text-[#047857] transition">
              Sign in here →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
