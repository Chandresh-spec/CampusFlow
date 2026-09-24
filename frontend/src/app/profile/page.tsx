'use client';
import { useState } from 'react';
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
  Loader2 
} from 'lucide-react';

export default function Profile() {
  const { isAuthorized, isLoading } = useRoleGuard(['student', 'faculty', 'admin']);
  const { user, logout, updateUser } = useAuth();
  const isFaculty = Boolean(user?.role && user.role.toLowerCase() !== 'student');
  
  const [formData, setFormData] = useState({
    email: user?.email || '',
    mobile_number: user?.mobile_number || '',
    semester: user?.sem || user?.semester || ''
  });
  const [saving, setSaving] = useState(false);

  if (isLoading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.patch('/api/profile/', formData);
      updateUser(res.data);
      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const username = user?.username || 'User';
  const roleName = user?.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : 'Student';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans pb-24 relative">
      <Navbar />
      <Toaster position="top-right" />
      
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Profile Header Card ─────────────────────────────────── */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden relative">
          {/* Emerald Gradient Banner */}
          <div className="h-32 sm:h-40 bg-gradient-to-r from-[#059669] via-emerald-500 to-teal-400 relative">
            <div className="absolute inset-0 bg-white/5 opacity-50 [background-image:radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))]" />
          </div>

          <div className="px-6 sm:px-8 pb-8 relative">
            {/* Avatar Circle */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-full border-4 border-white shadow-md absolute -top-10 sm:-top-12 flex items-center justify-center text-3xl sm:text-4xl font-black text-[#059669] ring-2 ring-emerald-100">
              {username.charAt(0).toUpperCase()}
            </div>

            <div className="pt-14 sm:pt-16 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {username}
                  </h1>
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-[#059669] text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                    <ShieldCheck size={13} />
                    {roleName}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  {user?.email || 'No email attached'}
                </p>
              </div>

              {/* Badges for Semester and USN */}
              <div className="flex flex-wrap gap-2.5">
                {!isFaculty && (
                  <div className="bg-emerald-50/70 border border-emerald-200/80 px-4 py-2 rounded-2xl text-center">
                    <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Semester</p>
                    <p className="font-black text-slate-900 text-sm">Sem {user?.semester || user?.sem || '1'}</p>
                  </div>
                )}
                {user?.usn && (
                  <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-2xl text-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">USN ID</p>
                    <p className="font-black text-slate-900 text-sm">{user.usn}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Personal Information Form ────────────────────────────── */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#059669] flex items-center justify-center border border-emerald-100">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                Personal Information
              </h2>
              <p className="text-xs text-slate-500">
                Update your contact details and academic semester info
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Username (Fixed)
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 text-slate-400" size={17} />
                  <input 
                    type="text" 
                    disabled 
                    value={user?.username || ''} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-500 cursor-not-allowed font-medium" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 text-slate-400" size={17} />
                  <input 
                    type="email" 
                    value={formData.email} 
                    onChange={e => setFormData({ ...formData, email: e.target.value })} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white transition" 
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
                    placeholder="e.g. 9876543210"
                    value={formData.mobile_number} 
                    onChange={e => setFormData({ ...formData, mobile_number: e.target.value })} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white transition" 
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
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:bg-white transition"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                        <option key={s} value={s}>Semester {s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3 pt-6 border-t border-slate-100">
              <button 
                type="button" 
                onClick={logout} 
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition text-sm font-bold"
              >
                <LogOut size={16} /> 
                <span>Logout Session</span>
              </button>

              <button 
                type="submit" 
                disabled={saving} 
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-sm shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Saving...</span>
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
      </main>
    </div>
  );
}
