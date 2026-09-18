'use client';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import toast, { Toaster } from 'react-hot-toast';
import { LogOut, Save, Key } from 'lucide-react';

export default function Profile() {
  const { user, logout, updateUser } = useAuth();
  const isFaculty = user?.role.toLowerCase() !== 'student';
  const { isAuthorized, isLoading } = useRoleGuard(['student', 'faculty', 'admin']);
  
  const [formData, setFormData] = useState({
    email: user?.email || '',
    mobile_number: user?.mobile_number || '',
    semester: user?.semester || ''
  });
  const [saving, setSaving] = useState(false);

  if (isLoading || !isAuthorized) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.patch('/api/profile/', formData);
      updateUser(res.data);
      toast.success('Profile updated');
    } catch (err) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`flex h-screen ${isFaculty ? 'bg-slate-900' : 'bg-slate-900'} relative`}>
      {isFaculty ? <Sidebar /> : <div className="absolute top-0 w-full z-10"><Navbar /></div>}
      <Toaster position="top-right" />
      
      <main className={`flex-1 overflow-y-auto p-8 ${!isFaculty ? 'pt-24' : ''}`}>
        <div className="max-w-3xl mx-auto space-y-6">
          
          <div className="glass rounded-3xl overflow-hidden relative">
            <div className="h-32 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600"></div>
            <div className="px-8 pb-8 relative">
              <div className="w-24 h-24 bg-slate-800 rounded-full border-4 border-slate-900 absolute -top-12 flex items-center justify-center text-4xl font-bold">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div className="mt-16 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold">{user?.username}</h1>
                  <p className="text-slate-400 capitalize">{user?.role}</p>
                </div>
                <div className="flex gap-4">
                  {!isFaculty && (
                    <div className="bg-slate-800 px-4 py-2 rounded-xl text-center">
                      <p className="text-xs text-slate-400 uppercase">Semester</p>
                      <p className="font-bold">{user?.semester || 'N/A'}</p>
                    </div>
                  )}
                  {user?.usn && (
                    <div className="bg-slate-800 px-4 py-2 rounded-xl text-center">
                      <p className="text-xs text-slate-400 uppercase">USN</p>
                      <p className="font-bold">{user.usn}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="glass rounded-3xl p-8">
            <h2 className="text-xl font-bold mb-6">Personal Information</h2>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-400">Username (Read-only)</label>
                  <input type="text" disabled value={user?.username || ''} className="w-full bg-slate-800/50 border border-slate-800 rounded-xl px-4 py-3 text-slate-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-400">Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-400">Mobile Number</label>
                  <input type="tel" value={formData.mobile_number} onChange={e => setFormData({...formData, mobile_number: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500" />
                </div>
                {!isFaculty && (
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-400">Semester</label>
                    <select value={formData.semester} onChange={e => setFormData({...formData, semester: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 appearance-none">
                      {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-4 border-t border-slate-800 pt-6 mt-6">
                <button type="button" onClick={logout} className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition">
                  <LogOut size={18} /> Logout
                </button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition disabled:opacity-50">
                  <Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

        </div>
      </main>
    </div>
  );
}
