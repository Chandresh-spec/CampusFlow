'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  UploadCloud, 
  MessageSquare, 
  Bell, 
  User, 
  LogOut,
  GraduationCap
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const links = [
    { href: '/teacher', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/my-uploads', label: 'My Uploads', icon: UploadCloud },
    { href: '/classroom', label: 'Classroom', icon: MessageSquare },
    { href: '/notices', label: 'Notices', icon: Bell },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/90 flex flex-col hidden md:flex h-full font-sans">
      <div className="p-6 border-b border-slate-100">
        <Link href="/teacher" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-[1.5px] shadow-xs">
            <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center">
              <GraduationCap size={18} className="text-[#059669]" />
            </div>
          </div>
          <div>
            <span className="font-black text-lg tracking-tight text-slate-900">
              Campus<span className="text-[#059669]">Flow</span>
            </span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1.5 mt-5">
        {links.map(link => {
          const active = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link 
              key={link.href} 
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-sm ${
                active 
                  ? 'bg-emerald-50 text-[#059669] font-bold border border-emerald-200/80 shadow-xs' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
              }`}
            >
              <Icon size={18} className={active ? 'text-[#059669]' : 'text-slate-400'} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100 space-y-1">
        <Link 
          href="/profile" 
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-sm font-medium ${
            pathname === '/profile' 
              ? 'bg-emerald-50 text-[#059669] font-bold' 
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <User size={18} className="text-slate-400" />
          <span>Profile</span>
        </Link>
        <button 
          onClick={logout} 
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-rose-600 hover:bg-rose-50 transition text-sm font-semibold"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
