'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const { isAuthenticated, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      if (user.role.toLowerCase() === 'student') {
        router.push('/student');
      } else {
        router.push('/teacher');
      }
    }
  }, [isAuthenticated, user, loading, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
      <h1 className="text-5xl md:text-7xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
        Smart College System
      </h1>
      <p className="text-xl md:text-2xl mb-12 text-slate-300 max-w-3xl">
        The ultimate platform for resource sharing, anonymous collaboration, and AI-powered learning.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl mb-12">
        <div className="glass p-6 rounded-2xl">
          <h3 className="text-xl font-bold mb-2">Resource Repository</h3>
          <p className="text-slate-400">Access and share study materials seamlessly.</p>
        </div>
        <div className="glass p-6 rounded-2xl">
          <h3 className="text-xl font-bold mb-2">Instant Notices</h3>
          <p className="text-slate-400">Stay updated with department announcements.</p>
        </div>
        <div className="glass p-6 rounded-2xl">
          <h3 className="text-xl font-bold mb-2">AI-Powered Learning</h3>
          <p className="text-slate-400">Interact with course materials using NexusAI.</p>
        </div>
        <div className="glass p-6 rounded-2xl">
          <h3 className="text-xl font-bold mb-2">Role-Based Access</h3>
          <p className="text-slate-400">Tailored experiences for students and faculty.</p>
        </div>
      </div>

      <div className="flex gap-4">
        <Link href="/register" className="px-8 py-3 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 font-bold hover:opacity-90 transition">
          Get Started
        </Link>
        <Link href="/login" className="px-8 py-3 rounded-full glass font-bold hover:bg-white/20 transition">
          Login
        </Link>
      </div>
    </div>
  );
}
