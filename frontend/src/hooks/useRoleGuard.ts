'use client';
import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';

export const useRoleGuard = (allowedRoles: string[]) => {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait until auth state is loaded from localStorage before redirecting
    if (loading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (user && !allowedRoles.includes(user.role.toLowerCase())) {
      if (user.role.toLowerCase() === 'student') {
        router.push('/student');
      } else {
        router.push('/teacher');
      }
    }
  }, [user, isAuthenticated, loading, allowedRoles, router]);

  return { 
    isAuthorized: Boolean(!loading && isAuthenticated && user && allowedRoles.includes(user.role.toLowerCase())),
    isLoading: loading 
  };
};
