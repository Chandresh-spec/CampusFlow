'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import {
  GraduationCap,
  Home,
  BookOpen,
  FileText,
  Folder,
  User,
  LogOut,
  MessageSquare,
  Bell,
  Sparkles,
  Sprout
} from 'lucide-react';
import AiSymbol from './AiSymbol';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const role = user?.role?.toLowerCase() || 'student';
  const dashboardHref = role === 'student' ? '/student' : '/teacher';

  const links = [
    { href: dashboardHref, label: 'Dashboard', icon: Home, isAnchor: false },
    { href: `${dashboardHref}#subjects-section`, label: 'My Subjects', icon: BookOpen, isAnchor: true },
    { href: `${dashboardHref}#notes-section`, label: 'Study Notes', icon: FileText, isAnchor: true },
    { href: role === 'student' ? `${dashboardHref}#notes-section` : '/my-uploads', label: 'Materials', icon: Folder, isAnchor: role === 'student' },
    { href: '/classroom', label: 'Class Chat', icon: MessageSquare, isAnchor: false },
    { href: '/ai-assistant', label: 'NexusAI', icon: Sparkles, isAi: true, isAnchor: false, badge: 'AI' },
    { href: '/notices', label: 'Notices', icon: Bell, isAnchor: false },
    { href: '/profile', label: 'Profile', icon: User, isAnchor: false },
  ];

  const handleLinkClick = (href: string, isAnchor: boolean) => {
    if (isAnchor && typeof window !== 'undefined') {
      const hash = href.split('#')[1];
      if (hash && (pathname === '/student' || pathname === '/teacher')) {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  };

  return (
    <aside className="w-64 lg:w-72 bg-white border-r border-slate-200/80 shrink-0 flex flex-col justify-between p-6 h-full z-20 shadow-sm min-h-screen">
      <div>
        {/* Brand Logo */}
        <Link href={dashboardHref} className="flex items-center gap-3 mb-8 group">
          <div className="text-slate-900 group-hover:scale-105 transition-transform">
            <GraduationCap size={32} className="text-slate-900" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-slate-900">
            Smart College
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {links.map((link) => {
            const isActive = !link.isAnchor && pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => handleLinkClick(link.href, link.isAnchor)}
                className={`flex items-center justify-between px-4 py-2.5 rounded-2xl font-semibold text-sm transition ${
                  isActive
                    ? 'bg-[#e8f5e9] text-[#047857]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  {link.isAi ? (
                    <AiSymbol size={20} className={isActive ? 'text-[#059669]' : 'text-blue-600'} />
                  ) : (
                    <Icon size={19} className={isActive ? 'text-[#059669]' : 'text-slate-400'} />
                  )}
                  <span>{link.label}</span>
                </div>
                {link.badge && (
                  <span className="bg-emerald-100 text-[#047857] text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-300/50 shadow-xs">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Motivational Quote Card & Logout */}
      <div className="space-y-3 pt-4">
        <div className="bg-[#ecfdf5] border border-emerald-100 rounded-2xl p-4 shadow-sm">
          <div className="text-emerald-600 mb-2">
            <Sprout size={20} className="text-[#10b981]" />
          </div>
          <p className="text-xs text-slate-600 font-medium italic leading-relaxed">
            Small steps every day lead to big results.
          </p>
          <div className="w-8 h-1 bg-[#10b981] rounded-full mt-2.5"></div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
