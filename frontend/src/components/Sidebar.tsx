'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, UploadCloud, MessageSquare, Bell, User, LogOut } from 'lucide-react';

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
    <aside className="w-64 glass border-r border-white/10 flex flex-col hidden md:flex h-full">
      <div className="p-6">
        <Link href="/" className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
          Smart College
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {links.map(link => {
          const active = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${active ? 'bg-gradient-to-r from-purple-600/20 to-blue-600/20 text-purple-400 font-medium' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
              <Icon size={20} className={active ? 'text-purple-400' : ''} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <Link href="/profile" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition mb-2 ${pathname === '/profile' ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
          <User size={20} />
          Profile
        </Link>
        <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition">
          <LogOut size={20} />
          Logout
        </button>
      </div>
    </aside>
  );
}
