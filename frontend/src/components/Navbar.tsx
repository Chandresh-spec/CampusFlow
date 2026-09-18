'use client';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { Bell, Search, User, Menu, X, LogOut } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  return (
    <nav className="glass sticky top-0 z-50 w-full border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
              Smart College
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-6">
            <Link href="/notices" className="text-slate-300 hover:text-white transition relative">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </Link>
            
            <div className="relative">
              <button 
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 transition"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium pr-1">{user?.username}</span>
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 glass rounded-xl shadow-xl overflow-hidden py-1">
                  <div className="px-4 py-2 border-b border-slate-700/50 mb-1">
                    <p className="text-sm font-bold">{user?.username}</p>
                    <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
                  </div>
                  <Link href="/profile" className="block px-4 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white">Profile</Link>
                  <button onClick={logout} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/10 flex items-center gap-2">
                    <LogOut size={14} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="md:hidden flex items-center">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-slate-300">
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden glass border-t border-white/10">
          <div className="px-4 pt-2 pb-4 space-y-1">
            <Link href="/profile" className="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:bg-white/10">Profile</Link>
            <Link href="/notices" className="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:bg-white/10">Notices</Link>
            <button onClick={logout} className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-400 hover:bg-white/10">Logout</button>
          </div>
        </div>
      )}
    </nav>
  );
}
