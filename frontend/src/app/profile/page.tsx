'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';
import AiSymbol from '../../components/AiSymbol';
import {
  LogOut,
  Save,
  User as UserIcon,
  Mail,
  Phone,
  GraduationCap,
  Sparkles,
  Bell,
  Camera,
  Layers,
  ChevronDown
} from 'lucide-react';

export default function Profile() {
  const { isAuthorized, isLoading } = useRoleGuard(['student', 'faculty', 'admin']);
  const { user, logout, updateUser } = useAuth();
  const isFaculty = Boolean(user?.role && user.role.toLowerCase() !== 'student');
  
  const [formData, setFormData] = useState({
    email: '',
    mobile_number: '',
    semester: '1'
  });
  const [saving, setSaving] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Sync formData whenever user state is available
  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        mobile_number: user.mobile_number || '',
        semester: String(user.sem || user.semester || '1')
      });
    }
  }, [user]);

  if (isLoading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        email: formData.email,
        mobile_number: formData.mobile_number,
      };
      if (!isFaculty && formData.semester) {
        payload.sem = Number(formData.semester);
        payload.semester = Number(formData.semester);
      }
      const res = await api.patch('/api/profile/', payload);
      updateUser(res.data);
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const username = user?.username || 'User';
  const initial = username.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col md:flex-row relative font-sans antialiased">
      <Toaster position="top-right" />

      {/* ── Left Sidebar ────────────────────────────────────────────── */}
      <Sidebar />

      {/* ── Main Content Area ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="px-6 md:px-10 py-4 flex items-center justify-end border-b border-slate-200/60 bg-white/60 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Ask AI button */}
            <Link
              href="/ai-assistant"
              title="Open NexusAI Assistant"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ecfdf5] hover:bg-[#dcfce7] text-[#047857] border border-emerald-200 text-xs font-bold transition shadow-xs"
            >
              <AiSymbol size={16} className="text-blue-600 animate-pulse" />
              <span>Ask AI</span>
            </Link>

            {/* Notification Bell */}
            <Link
              href="/notices"
              title="Notices"
              className="p-2 text-slate-500 hover:text-slate-800 transition relative rounded-full hover:bg-slate-100"
            >
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
            </Link>

            {/* User Dropdown Pill */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-full hover:bg-slate-100 transition"
              >
                <div className="w-8 h-8 rounded-full bg-[#0f766e] text-white font-bold text-xs flex items-center justify-center shadow-sm">
                  {initial}
                </div>
                <span className="text-sm font-semibold text-slate-700 hidden sm:inline">
                  {username}
                </span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-40 text-sm">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="font-bold text-slate-800">{username}</p>
                    <p className="text-xs text-slate-400 capitalize">{user?.role || 'Student'}</p>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-emerald-700 bg-emerald-50/50 font-semibold transition"
                  >
                    <UserIcon size={16} /> Profile
                  </Link>
                  <Link
                    href="/classroom"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                  >
                    <GraduationCap size={16} /> Class Chat
                  </Link>
                  <button
                    onClick={() => { setProfileDropdownOpen(false); logout(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-600 hover:bg-red-50 text-left transition"
                  >
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Profile Content Body */}
        <div className="p-6 md:p-10 space-y-6 max-w-4xl w-full mx-auto">
          {/* ── Profile Header Card ─────────────────────────────────── */}
          <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
            {/* Pastel Mint Banner */}
            <div className="h-32 bg-gradient-to-r from-[#dcfce7] via-[#f0fdf4] to-[#fefce8] border-b border-emerald-100/60 relative">
              <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-[#065f46] border border-emerald-200/80 shadow-xs">
                <Camera size={13} className="text-[#059669]" />
                <span className="capitalize">{user?.role || 'Student'} Account</span>
              </div>
            </div>

            {/* Profile Avatar & Meta Info */}
            <div className="px-8 pb-8 relative">
              <div className="w-24 h-24 bg-[#0f766e] text-white rounded-full border-4 border-white shadow-md absolute -top-12 flex items-center justify-center text-3xl font-extrabold">
                {initial}
              </div>

              <div className="mt-15 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-900">{username}</h1>
                  <p className="text-xs text-slate-500 font-medium capitalize mt-0.5">
                    {user?.role || 'Student'} • Smart College Portal
                  </p>
                </div>

                <div className="flex gap-2.5">
                  {!isFaculty && (
                    <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-2xl text-center">
                      <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Semester</p>
                      <p className="font-extrabold text-emerald-900 text-sm">Sem {formData.semester || user?.sem || user?.semester || '1'}</p>
                    </div>
                  )}
                  {user?.usn && (
                    <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-2xl text-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">USN</p>
                      <p className="font-extrabold text-slate-800 text-sm">{user.usn}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Edit Personal Information Card ─────────────────────── */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-2.5 pb-4 mb-6 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#059669] flex items-center justify-center">
                <UserIcon size={18} />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Personal Information</h2>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Username (Read-Only)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={username}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. user@gmail.com"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="tel"
                      value={formData.mobile_number}
                      onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                      placeholder="e.g. +91 9876543210"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
                    />
                  </div>
                </div>

                {!isFaculty && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                      Current Semester
                    </label>
                    <div className="relative">
                      <Layers size={16} className="absolute left-3.5 top-3 text-slate-400" />
                      <select
                        value={formData.semester}
                        onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                          <option key={s} value={s}>
                            Semester {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition"
                >
                  <LogOut size={15} />
                  <span>Logout</span>
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold transition shadow-sm disabled:opacity-50"
                >
                  <Save size={15} />
                  <span>{saving ? 'Saving Changes...' : 'Save Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
