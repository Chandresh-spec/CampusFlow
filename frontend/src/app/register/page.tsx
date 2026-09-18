'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';

export default function Register() {
  const [role, setRole] = useState('Student');
  const [formData, setFormData] = useState({
    username: '', email: '', password: '', mobile_number: '', usn: '', semester: '1'
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: any = { ...formData, role: role.toLowerCase() };
      if (role.toLowerCase() !== 'student') {
        delete payload.usn;
        delete payload.semester;
        delete payload.sem;
      } else {
        payload.sem = parseInt(formData.semester) || 1;
      }
      
      await api.post('/api/register/', payload);
      toast.success('Registration successful! Please login.');
      setTimeout(() => router.push('/login'), 1500);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 py-12">
      <Toaster position="top-right" />
      <div className="glass w-full max-w-lg p-8 rounded-3xl">
        <h2 className="text-3xl font-bold text-center mb-8 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-pink-400">Create Account</h2>
        
        <div className="flex bg-slate-800/50 p-1 rounded-xl mb-6">
          {['Student', 'Faculty'].map((r) => (
            <button
              key={r}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${role === r ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              onClick={() => setRole(r)}
            >
              {r}
            </button>
          ))}
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Username</label>
            <input required type="text" className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Email</label>
            <input required type="email" className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Password</label>
            <input required type="password" className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Mobile Number</label>
            <input required type="tel" className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={formData.mobile_number} onChange={e => setFormData({...formData, mobile_number: e.target.value})} />
          </div>

          {role === 'Student' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-300">USN</label>
                <input required type="text" className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase"
                  value={formData.usn} onChange={e => setFormData({...formData, usn: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-300">Semester</label>
                <select className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
                  value={formData.semester} onChange={e => setFormData({...formData, semester: e.target.value})}>
                  {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                </select>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-pink-600 rounded-xl py-3 font-bold hover:opacity-90 transition mt-6 disabled:opacity-50">
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <p className="text-center mt-6 text-slate-400">
          Already have an account? <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">Log In</Link>
        </p>
      </div>
    </div>
  );
}
