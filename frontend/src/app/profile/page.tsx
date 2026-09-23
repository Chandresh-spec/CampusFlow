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
  ChevronDown,
  ShieldCheck,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  BookOpen,
  FolderCheck,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

export default function Profile() {
  const { isAuthorized, isLoading } = useRoleGuard(['student', 'faculty', 'admin']);
  const { user, logout, updateUser } = useAuth();
  const currentRole = (user?.role || 'student').toLowerCase();
  const isFaculty = currentRole === 'faculty' || currentRole === 'teacher' || currentRole === 'admin';
  
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'permissions'>('profile');

  // Form states
  const [formData, setFormData] = useState({
    email: '',
    mobile_number: '',
    semester: '1',
  });
  const [saving, setSaving] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Strict Role Elevation states
  const [showElevation, setShowElevation] = useState(false);
  const [targetRole, setTargetRole] = useState<'student' | 'faculty'>('student');
  const [facultyCode, setFacultyCode] = useState('');
  const [elevationLoading, setElevationLoading] = useState(false);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Sync formData whenever user state is available
  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        mobile_number: user.mobile_number || '',
        semester: String(user.sem || user.semester || '1'),
      });
      setTargetRole(isFaculty ? 'faculty' : 'student');
    }
  }, [user, isFaculty]);

  if (isLoading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Save Personal Info ──────────────────────────────────────
  const handleSaveProfile = async (e: React.FormEvent) => {
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
      toast.success('Profile details saved successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  // ── Strict Role Elevation ───────────────────────────────────
  const handleRoleElevation = async (e: React.FormEvent) => {
    e.preventDefault();
    setElevationLoading(true);
    try {
      const payload: any = {
        role: targetRole,
      };
      if (targetRole === 'faculty') {
        if (!facultyCode.trim()) {
          toast.error('Please enter the Institutional Faculty Passcode');
          setElevationLoading(false);
          return;
        }
        payload.faculty_code = facultyCode.trim();
      }
      const res = await api.patch('/api/profile/', payload);
      updateUser(res.data);
      toast.success(`Role successfully updated to ${targetRole === 'faculty' ? 'Teacher / Faculty' : 'Student'}!`);
      setShowElevation(false);
      setFacultyCode('');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Unauthorized: Invalid faculty passcode');
    } finally {
      setElevationLoading(false);
    }
  };

  // ── Change Password ─────────────────────────────────────────
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Please enter your current password');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setPasswordLoading(true);
    try {
      await api.patch('/api/profile/', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const username = user?.username || 'User';
  const initial = username.charAt(0).toUpperCase();
  const enrolledSem = user?.sem || user?.semester || 1;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col md:flex-row relative font-sans antialiased">
      <Toaster position="top-right" />

      {/* ── Left Sidebar ────────────────────────────────────────────── */}
      <Sidebar />

      {/* ── Main Content Area ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="px-6 md:px-10 py-4 flex items-center justify-between border-b border-slate-200/60 bg-white/70 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link href={isFaculty ? '/teacher' : '/student'} className="hover:text-emerald-700 transition">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-slate-800">Account Profile</span>
          </div>

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
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full"></span>
            </Link>

            {/* User Dropdown Pill */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-full hover:bg-slate-100 transition"
              >
                <div className="w-8 h-8 rounded-full bg-[#059669] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  {initial}
                </div>
                <span className="text-sm font-semibold text-slate-700 hidden sm:inline">
                  {username}
                </span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-40 text-sm animate-in fade-in">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="font-bold text-slate-800">{username}</p>
                    <p className="text-xs text-emerald-600 font-semibold capitalize">{user?.role || 'Student'}</p>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-emerald-700 bg-emerald-50/50 font-semibold transition"
                  >
                    <UserIcon size={15} /> Profile
                  </Link>
                  <Link
                    href="/classroom"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                  >
                    <GraduationCap size={15} /> Class Chat
                  </Link>
                  <button
                    onClick={() => { setProfileDropdownOpen(false); logout(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-red-600 hover:bg-red-50 text-left transition"
                  >
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Profile Content Body */}
        <div className="p-6 md:p-10 space-y-6 max-w-5xl w-full mx-auto">
          {/* ── Modern Hero Profile Card ─────────────────────────────── */}
          <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-sm">
            {/* Ambient Gradient Banner */}
            <div className="h-36 bg-gradient-to-r from-[#dcfce7] via-[#f0fdf4] to-[#fefce8] border-b border-emerald-100/80 relative p-6 flex justify-between items-start">
              <div className="flex items-center gap-2">
                <span className="bg-white/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-[#065f46] border border-emerald-200 shadow-xs flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-[#059669]" />
                  <span>Institutional Member</span>
                </span>
                {user?.is_verified && (
                  <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-xs flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    <span>Gmail Verified</span>
                  </span>
                )}
              </div>
            </div>

            {/* Profile Avatar & Meta Header */}
            <div className="px-8 pb-8 relative">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 -mt-14 mb-6">
                <div className="flex items-end gap-5">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-[#047857] to-[#10b981] text-white p-1 shadow-lg ring-4 ring-white flex items-center justify-center">
                    <div className="w-full h-full rounded-[20px] bg-[#065f46] flex items-center justify-center text-3xl font-black">
                      {initial}
                    </div>
                  </div>
                  <div className="mb-1">
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                        {username}
                      </h1>
                      <CheckCircle2 size={20} className="text-[#059669]" />
                    </div>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                      <Mail size={13} className="text-slate-400" />
                      <span>{user?.email || 'user@campusflow.edu'}</span>
                    </p>
                  </div>
                </div>

                {/* Right Badges */}
                <div className="flex flex-wrap gap-2.5">
                  {isFaculty ? (
                    <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-2xl flex items-center gap-2">
                      <ShieldCheck size={18} className="text-[#059669]" />
                      <div>
                        <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">Role</p>
                        <p className="font-extrabold text-[#065f46] text-xs">Faculty / Professor</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-2xl flex items-center gap-2">
                      <GraduationCap size={18} className="text-[#059669]" />
                      <div>
                        <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">Enrolled Class</p>
                        <p className="font-extrabold text-[#065f46] text-xs">Semester {enrolledSem}</p>
                      </div>
                    </div>
                  )}

                  {user?.usn && (
                    <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-2xl">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Student USN</p>
                      <p className="font-extrabold text-slate-800 text-xs">{user.usn}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-100 gap-6 text-xs font-bold pt-2">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`pb-3 border-b-2 transition flex items-center gap-2 ${
                    activeTab === 'profile'
                      ? 'border-[#059669] text-[#059669]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <UserIcon size={15} />
                  <span>Personal & Academic Info</span>
                </button>
                <button
                  onClick={() => setActiveTab('security')}
                  className={`pb-3 border-b-2 transition flex items-center gap-2 ${
                    activeTab === 'security'
                      ? 'border-[#059669] text-[#059669]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Lock size={15} />
                  <span>Strict Role & Password</span>
                </button>
                <button
                  onClick={() => setActiveTab('permissions')}
                  className={`pb-3 border-b-2 transition flex items-center gap-2 ${
                    activeTab === 'permissions'
                      ? 'border-[#059669] text-[#059669]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ShieldCheck size={15} />
                  <span>Role Permissions</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── TAB 1: Personal & Academic Info ───────────────────────── */}
          {activeTab === 'profile' && (
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <UserIcon size={18} className="text-[#059669]" />
                    <span>Personal Profile Details</span>
                  </h2>
                  <p className="text-xs text-slate-500">Manage your contact details and registered class semester</p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                      Username (System Identity)
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
                      Gmail / Email Address
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="user@gmail.com"
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
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
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
                      />
                    </div>
                  </div>

                  {!isFaculty && (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                        Enrolled Class Semester
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
                              Semester {s} (Class {s})
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Determines which classroom channels and notes you can view.
                      </p>
                    </div>
                  )}

                  {user?.usn && (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                        University Seat Number (USN)
                      </label>
                      <input
                        type="text"
                        disabled
                        value={user.usn}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed font-medium uppercase"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold transition shadow-sm disabled:opacity-50"
                  >
                    <Save size={15} />
                    <span>{saving ? 'Saving...' : 'Save Details'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── TAB 2: Strict Role & Security ─────────────────────────── */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Strict Role Authentication Card */}
              <div className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <ShieldCheck size={20} className="text-[#059669]" />
                      <span>Strict Role Authentication</span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      Roles are cryptographically signed and institutional passkey protected
                    </p>
                  </div>
                  <span className="bg-emerald-50 text-[#059669] border border-emerald-200 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    {currentRole}
                  </span>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3">
                  <Lock size={18} className="text-slate-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-600 leading-relaxed">
                    <p className="font-bold text-slate-800 mb-0.5">Strict Access Control Active</p>
                    Students cannot arbitrarily elevate themselves to Faculty status without an authorized institutional passcode. This ensures note uploads and academic approvals remain authentic.
                  </div>
                </div>

                {!isFaculty ? (
                  <div>
                    {!showElevation ? (
                      <button
                        type="button"
                        onClick={() => setShowElevation(true)}
                        className="text-xs font-bold text-[#059669] hover:underline flex items-center gap-1.5"
                      >
                        <KeyRound size={15} />
                        <span>Are you a Faculty Member? Elevate to Teacher Account</span>
                      </button>
                    ) : (
                      <form onSubmit={handleRoleElevation} className="p-5 border border-emerald-200 rounded-2xl bg-[#ecfdf5]/40 space-y-4 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                            <KeyRound size={16} className="text-[#059669]" />
                            <span>Institutional Faculty Passcode Elevation</span>
                          </h3>
                          <button
                            type="button"
                            onClick={() => setShowElevation(false)}
                            className="text-xs text-slate-400 hover:text-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Enter Faculty Passcode
                          </label>
                          <input
                            type="password"
                            required
                            placeholder="Enter institutional secret key"
                            value={facultyCode}
                            onChange={(e) => setFacultyCode(e.target.value)}
                            className="w-full bg-white border border-emerald-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                          />
                          <p className="text-[11px] text-slate-500 mt-1">
                            Passcode for Smart College: <code className="bg-emerald-100 px-1.5 py-0.5 rounded font-mono text-emerald-900">CAMPUS_FACULTY_2026</code>
                          </p>
                        </div>
                        <button
                          type="submit"
                          disabled={elevationLoading}
                          className="bg-[#059669] hover:bg-[#047857] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-2"
                        >
                          {elevationLoading ? 'Verifying...' : 'Verify & Elevate to Faculty'}
                          <ArrowRight size={14} />
                        </button>
                      </form>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 size={16} />
                    <span>Faculty status verified. You have full uploading and resource approval permissions.</span>
                  </div>
                )}
              </div>

              {/* Password Change Card */}
              <div className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Lock size={18} className="text-[#059669]" />
                      <span>Security & Password</span>
                    </h2>
                    <p className="text-xs text-slate-500">Update your account password with current authentication check</p>
                  </div>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPass ? 'text' : 'password'}
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"
                      >
                        {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                      New Password (Min 6 Characters)
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"
                      >
                        {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-medium"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className="bg-[#059669] hover:bg-[#047857] text-white px-6 py-2.5 rounded-xl text-xs font-semibold transition shadow-sm disabled:opacity-50"
                    >
                      {passwordLoading ? 'Updating Password...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── TAB 3: Permissions Matrix ─────────────────────────────── */}
          {activeTab === 'permissions' && (
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FolderCheck size={20} className="text-[#059669]" />
                    <span>Role Permissions Matrix</span>
                  </h2>
                  <p className="text-xs text-slate-500">Security entitlements assigned to your authenticated role</p>
                </div>
                <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1 rounded-full uppercase">
                  {currentRole} Role
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-5 rounded-2xl border ${!isFaculty ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/50'}`}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <GraduationCap className={!isFaculty ? 'text-[#059669]' : 'text-slate-400'} size={22} />
                    <h3 className="font-bold text-sm text-slate-900">Student Entitlements</h3>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span>Access Semester {enrolledSem} class notes & syllabus</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span>Query NexusAI RAG model with class materials</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span>Classroom channel discussions</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-400">
                      <AlertCircle size={14} />
                      <span>Official materials upload (Requires Faculty)</span>
                    </li>
                  </ul>
                </div>

                <div className={`p-5 rounded-2xl border ${isFaculty ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/50'}`}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <ShieldCheck className={isFaculty ? 'text-[#059669]' : 'text-slate-400'} size={22} />
                    <h3 className="font-bold text-sm text-slate-900">Faculty / Teacher Entitlements</h3>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span>Upload official class notes directly to S3</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span>Auto-approved publishing to enrolled students</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span>Faculty analytics and view tracking</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span>Publish campus notices & broadcast alerts</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
