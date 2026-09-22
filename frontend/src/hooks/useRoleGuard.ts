'use client';
import { useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';

export const useRoleGuard = (allowedRoles: string[]) => {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  const normalizedRoles = useMemo(() => allowedRoles.map(r => r.toLowerCase()), [allowedRoles.join(',')]);

  useEffect(() => {
    // Wait until auth state is loaded from localStorage before redirecting
    if (loading) return;

    if (!isAuthenticated || !user) {
      router.push('/login');
      return;
    }

    const currentRole = user?.role?.toLowerCase() || '';
    if (!normalizedRoles.includes(currentRole)) {
      if (currentRole === 'student') {
        router.push('/student');
      } else {
        router.push('/teacher');
      }
    }
  }, [user, isAuthenticated, loading, normalizedRoles, router]);

  const isAuthorized = Boolean(
    !loading && 
    isAuthenticated && 
    user && 
    normalizedRoles.includes(user?.role?.toLowerCase() || '')
  );

  return { 
    isAuthorized,
    isLoading: loading 
  };
};
