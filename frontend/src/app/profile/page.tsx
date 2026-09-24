'use client';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import toast, { Toaster } from 'react-hot-toast';
import { 
  LogOut, 
  Save, 
  User, 
  Mail, 
  Phone, 
  GraduationCap, 
  ShieldCheck, 
  Hash, 
  Calendar,
  CheckCircle2,
  Loader2,
  Sparkles,
  Camera,
  Trash2,
  Upload,
  CreditCard,
  Lock,
  Layers,
  FileText,
  BadgeCheck,
  Clock,
  ChevronRight
} from 'lucide-react';

export default function Profile() {
  const { isAuthorized, isLoading } = useRoleGuard(['student', 'faculty', 'admin']);
  const { user, logout, updateUser } = useAuth();
  const isFaculty = Boolean(user?.role && user.role.toLowerCase() !== 'student');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'edit' | 'security'>('overview');
  
  const [formData, setFormData] = useState({
    email: user?.email || '',
    mobile_number: user?.mobile_number || '',
    semester: user?.sem || user?.semester || '1',
    bio: user?.bio || '',
  });

  const [avatarUrl, setAvatarUrl] = useState<string>(user?.avatar_url || '');
  const [imgError, setImgError] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        mobile_number: user.mobile_number || '',
        semester: user.sem || user.semester || '1',
        bio: user.bio || '',
      });
      setAvatarUrl(user.avatar_url || '');
      setImgError(false);
    }
  }, [user]);

  if (isLoading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── S3 Avatar Upload Handler ─────────────────────────────────
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setAvatarUploading(true);
    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
      const res = await api.post('/api/profile/avatar/', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newUrl = res.data.avatar_url;
      setAvatarUrl(newUrl);
      setImgError(false);
      updateUser({ avatar_url: newUrl });
      toast.success('Profile photo uploaded to S3 successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to upload photo to S3');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── S3 Avatar Delete Handler ─────────────────────────────────
  const handleAvatarDelete = async () => {
    if (!confirm('Are you sure you want to remove your profile photo?')) return;
    setAvatarUploading(true);
    try {
      await api.delete('/api/profile/avatar/');
      setAvatarUrl('');
      updateUser({ avatar_url: undefined });
      toast.success('Profile photo removed');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to remove photo');
    } finally {
      setAvatarUploading(false);
    }
  };

  // ── Update Profile Details Handler ───────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        email: formData.email,
        mobile_number: formData.mobile_number,
        bio: formData.bio,
      };
      if (!isFaculty) {
        payload.sem = parseInt(String(formData.semester)) || 1;
      }

      const res = await api.patch('/api/profile/', payload);
      updateUser(res.data);
      toast.success('Profile information saved successfully!');
      setActiveTab('overview');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const username = user?.username || 'User';
  const roleName = user?.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : 'Student';
  const initial = username.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans pb-24 relative">
      <Navbar />
      <Toaster position="top-right" />

      {/* Hidden File Input for Avatar Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleAvatarUpload}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* ── 1. Hero Profile Banner & Avatar Card ──────────────────── */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden relative">
          {/* Emerald Gradient Banner with Decorative Pattern */}
          <div className="h-36 sm:h-48 bg-gradient-to-r from-[#065f46] via-[#059669] to-teal-500 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="absolute -bottom-8 -right-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          </div>

          <div className="px-6 sm:px-10 pb-8 relative">
            {/* Interactive S3 Avatar */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-20 mb-4">
              <div className="relative group self-start">
                <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-white p-1.5 shadow-xl ring-4 ring-white relative overflow-hidden">
                  <div className="w-full h-full rounded-2xl bg-gradient-to-tr from-emerald-100 to-teal-50 flex items-center justify-center overflow-hidden border border-slate-200">
                    {avatarUrl && !imgError ? (
                      <img
                        src={avatarUrl}
                        alt={username}
                        onError={() => setImgError(true)}
                        className="w-full h-full object-cover rounded-2xl"
                      />
                    ) : (
                      <span className="text-4xl sm:text-5xl font-black text-[#059669]">
                        {initial}
                      </span>
                    )}

                    {/* Upload Spinner Overlay */}
                    {avatarUploading && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-1 rounded-2xl z-20">
                        <Loader2 size={24} className="animate-spin text-emerald-400" />
                        <span className="text-[10px] font-bold">Uploading to S3...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Floating Camera Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute bottom-1 right-1 p-2.5 rounded-2xl bg-[#059669] hover:bg-[#047857] text-white shadow-lg border-2 border-white transition transform hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="Upload profile photo to S3"
                >
                  <Camera size={17} />
                </button>

                {/* Delete Button (only if custom photo exists) */}
                {avatarUrl && !avatarUploading && (
                  <button
                    type="button"
                    onClick={handleAvatarDelete}
                    className="absolute top-1 right-1 p-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white shadow-md border-2 border-white transition transform hover:scale-105"
                    title="Remove custom photo"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {/* Action Buttons Top Right */}
              <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="px-4 py-2 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-[#065f46] text-xs font-bold border border-emerald-200 transition flex items-center gap-1.5 shadow-xs"
                >
                  <Upload size={14} className="text-[#059669]" />
                  <span>{avatarUrl ? 'Change S3 Photo' : 'Upload S3 Photo'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'edit' ? 'overview' : 'edit')}
                  className="px-4 py-2 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 transition flex items-center gap-1.5 shadow-xs"
                >
                  <User size={14} className="text-slate-500" />
                  <span>{activeTab === 'edit' ? 'View Profile' : 'Edit Profile'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('campusflow_open_tour'))}
                  className="px-3.5 py-2 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200 transition flex items-center gap-1.5 shadow-xs"
                  title="View Platform Feature Guide"
                >
                  <Sparkles size={14} className="text-amber-600" />
                  <span className="hidden sm:inline">Tour</span>
                </button>
              </div>
            </div>

            {/* User Title & Badges */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {username}
                </h1>
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-[#059669] text-xs font-bold px-3 py-1 rounded-full border border-emerald-200">
                  <ShieldCheck size={14} />
                  <span>{roleName}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-full border border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Verified Account</span>
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                {user?.email || 'No email associated with this account'}
              </p>

              {user?.bio && (
                <p className="text-xs sm:text-sm text-slate-700 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 leading-relaxed mt-3 max-w-2xl">
                  {user.bio}
                </p>
              )}
            </div>

            {/* Quick Stat Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
              <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Role</p>
                <p className="text-sm font-bold text-slate-900 capitalize">{user?.role || 'Student'}</p>
              </div>

              {!isFaculty && (
                <div className="bg-emerald-50/70 border border-emerald-200/80 p-3 rounded-2xl">
                  <p className="text-[10px] font-bold text-[#065f46] uppercase tracking-wider">Semester</p>
                  <p className="text-sm font-black text-slate-900">Semester {user?.sem || user?.semester || '1'}</p>
                </div>
              )}

              {user?.usn ? (
                <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">USN / Roll No</p>
                  <p className="text-sm font-mono font-bold text-slate-900">{user.usn}</p>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Department</p>
                  <p className="text-sm font-bold text-slate-900">Computer Science</p>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cloud Storage</p>
                <p className="text-sm font-bold text-[#059669] flex items-center gap-1">
                  <CheckCircle2 size={13} /> S3 Synced
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. Segmented Pill Tab Bar ─────────────────────────────── */}
        <div className="flex p-1.5 bg-white border border-slate-200 rounded-2xl shadow-xs gap-1.5 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'overview'
                ? 'bg-[#059669] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <CreditCard size={15} />
            <span>Campus ID</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'edit'
                ? 'bg-[#059669] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <User size={15} />
            <span>Edit Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'security'
                ? 'bg-[#059669] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Lock size={15} />
            <span>Security</span>
          </button>
        </div>

        {/* ── Tab 1: Campus Digital ID Card ─────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* The Digital ID Card */}
            <div className="max-w-md mx-auto bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#0f766e] text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-emerald-400/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-400/20 rounded-full blur-xl pointer-events-none" />

              {/* ID Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/20 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-white text-xs">
                    CF
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest">CampusFlow</p>
                    <p className="text-xs font-black tracking-wide">Academic Identity</p>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/30">
                  {roleName}
                </span>
              </div>

              {/* ID Middle Body */}
              <div className="py-5 flex items-center gap-5 relative z-10">
                <div className="w-20 h-20 rounded-2xl bg-white/20 p-1 shrink-0 shadow-inner">
                  {avatarUrl && !imgError ? (
                    <img 
                      src={avatarUrl} 
                      alt={username} 
                      onError={() => setImgError(true)} 
                      className="w-full h-full object-cover rounded-xl" 
                    />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-white/30 flex items-center justify-center text-2xl font-black text-white">
                      {initial}
                    </div>
                  )}
                </div>

                <div className="space-y-1 truncate">
                  <p className="text-lg font-black tracking-tight text-white truncate">{username}</p>
                  <p className="text-xs text-emerald-200 truncate">{user?.email || 'Student Email'}</p>
                  <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-emerald-100">
                    <Hash size={12} />
                    <span>{user?.usn || `ID-${user?.id || '2026'}`}</span>
                  </div>
                </div>
              </div>

              {/* ID Footer Barcode Visual */}
              <div className="pt-4 border-t border-white/20 flex items-center justify-between relative z-10">
                <div>
                  <p className="text-[9px] font-bold text-emerald-200 uppercase tracking-wider">Status</p>
                  <p className="text-xs font-black text-white flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-300" /> Active Student
                  </p>
                </div>
                
                {/* Visual Barcode */}
                <div className="flex gap-0.5 items-center opacity-70">
                  {[2, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 4, 1].map((h, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-full"
                      style={{ width: `${(i % 3) + 1.5}px`, height: `${h * 6 + 10}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions Under ID */}
            <div className="max-w-md mx-auto grid grid-cols-2 gap-3 text-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-xs font-bold text-slate-700 transition shadow-xs flex flex-col items-center gap-1.5"
              >
                <Camera size={18} className="text-[#059669]" />
                <span>Update S3 Photo</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-xs font-bold text-slate-700 transition shadow-xs flex flex-col items-center gap-1.5"
              >
                <FileText size={18} className="text-[#059669]" />
                <span>Edit Bio & Info</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Tab 2: Edit Profile Information Form ──────────────────── */}
        {activeTab === 'edit' && (
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 animate-in fade-in duration-200">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#059669] flex items-center justify-center border border-emerald-100">
                <User size={20} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900">
                  Edit Profile Details
                </h2>
                <p className="text-xs text-slate-500">
                  Update your contact details, bio, and academic info
                </p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Username (System Fixed)
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 text-slate-400" size={17} />
                    <input 
                      type="text" 
                      disabled 
                      value={username} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm text-slate-500 cursor-not-allowed font-medium" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 text-slate-400" size={17} />
                    <input 
                      type="email" 
                      required
                      value={formData.email} 
                      onChange={e => setFormData({ ...formData, email: e.target.value })} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white transition" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3.5 text-slate-400" size={17} />
                    <input 
                      type="tel" 
                      placeholder="e.g. +91 9876543210"
                      value={formData.mobile_number} 
                      onChange={e => setFormData({ ...formData, mobile_number: e.target.value })} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white transition" 
                    />
                  </div>
                </div>

                {!isFaculty && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Enrolled Semester
                    </label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3.5 top-3.5 text-slate-400" size={17} />
                      <select 
                        value={formData.semester} 
                        onChange={e => setFormData({ ...formData, semester: e.target.value })} 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white transition"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                          <option key={s} value={String(s)}>Semester {s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Bio / About You
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Brief description of your research interests, coursework, or academic background..."
                    value={formData.bio}
                    onChange={e => setFormData({ ...formData, bio: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end items-center gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition text-sm font-bold"
                >
                  Cancel
                </button>

                <button 
                  type="submit" 
                  disabled={saving} 
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3 rounded-2xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-sm shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} /> 
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Tab 3: Security & Session ─────────────────────────────── */}
        {activeTab === 'security' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* 2FA Protection Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#059669] flex items-center justify-center border border-emerald-100">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Redis Two-Factor Email Verification</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Your account requires an instant 6-digit OTP code sent to your email on every login
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-[#065f46] border border-emerald-200 shrink-0">
                  Active & Protected
                </span>
              </div>
            </div>

            {/* Account Danger / Logout Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-900">Session Management</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sign out of this device or end your active session
                </p>
              </div>

              <button 
                type="button" 
                onClick={logout} 
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition text-sm font-bold shadow-xs cursor-pointer"
              >
                <LogOut size={16} /> 
                <span>Logout Session</span>
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
