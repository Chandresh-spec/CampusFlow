'use client';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { Bell, User, Menu, X, LogOut, GraduationCap, MessageSquare, Bot, BookOpen, Layers } from 'lucide-react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import AiSymbol from './AiSymbol';

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const initial = user?.username ? user.username.charAt(0).toUpperCase() : 'M';
  const role = user?.role?.toLowerCase() || 'student';
  const isTeacher = role === 'faculty' || role === 'teacher' || role === 'admin';
  const dashboardHref = isTeacher ? '/teacher' : '/student';

  const navLinks = [
    { href: dashboardHref, label: 'Dashboard', icon: Layers, isAi: false },
    { href: '/classroom', label: 'Class Chat', icon: MessageSquare, isAi: false },
    { href: '/notices', label: 'Notices', icon: Bell, isAi: false },
    { href: '/ai-assistant', label: 'NexusAI', icon: Bot, isAi: true },
  ];

  return (
    <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 w-full border-b border-slate-200/80 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link href={dashboardHref} className="flex items-center gap-2.5 group">
              <div className="text-slate-900 group-hover:scale-105 transition-transform">
                <GraduationCap size={28} className="text-slate-900" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-slate-900">
                Smart College
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-1.5 ml-4">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                      isActive
                        ? 'bg-[#e8f5e9] text-[#047857]'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {link.isAi ? (
                      <AiSymbol size={16} className={isActive ? 'text-[#059669]' : 'text-blue-600'} />
                    ) : (
                      <Icon size={16} className={isActive ? 'text-[#059669]' : 'text-slate-400'} />
                    )}
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right Area: Notices & User Profile */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/notices"
              title="Notices"
              className="p-2 text-slate-500 hover:text-slate-800 transition relative rounded-full hover:bg-slate-100"
            >
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
            </Link>

            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-full hover:bg-slate-100 border border-slate-200/80 transition shadow-sm"
              >
                <div className="w-8 h-8 rounded-full bg-[#0f766e] text-white font-bold text-xs flex items-center justify-center shadow-sm">
                  {initial}
                </div>
                <span className="text-sm font-semibold text-slate-700">
                  {user?.username || 'User'}
                </span>
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-40 text-sm">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="font-bold text-slate-800">{user?.username}</p>
                    <p className="text-xs text-slate-400 capitalize">{role}</p>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                  >
                    <User size={16} /> Profile
                  </Link>
                  <Link
                    href="/classroom"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                  >
                    <MessageSquare size={16} /> Class Chat
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

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-slate-200 px-4 pt-2 pb-4 space-y-1 shadow-lg">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {link.isAi ? (
                <AiSymbol size={18} className="text-blue-600" />
              ) : (
                <link.icon size={18} className="text-slate-400" />
              )}
              <span>{link.label}</span>
            </Link>
          ))}
          <div className="border-t border-slate-100 pt-2 mt-2">
            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <User size={18} className="text-slate-400" />
              <span>Profile</span>
            </Link>
            <button
              onClick={() => { setMobileMenuOpen(false); logout(); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 text-left"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
