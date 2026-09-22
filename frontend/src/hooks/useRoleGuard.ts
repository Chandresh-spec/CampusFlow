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

    const currentRole = user?.role?.toLowerCase() || 'student';
    const isTeacher = currentRole === 'faculty' || currentRole === 'teacher' || currentRole === 'admin';
    const isAllowed = normalizedRoles.some(r => {
      if (r === 'faculty' || r === 'teacher') return isTeacher;
      return r === currentRole;
    });

    if (!isAllowed) {
      if (isTeacher) {
        router.push('/teacher');
      } else {
        router.push('/student');
      }
    }
  }, [user, isAuthenticated, loading, normalizedRoles, router]);

  const currentRole = user?.role?.toLowerCase() || 'student';
  const isTeacher = currentRole === 'faculty' || currentRole === 'teacher' || currentRole === 'admin';
  const isAuthorized = Boolean(
    !loading && 
    isAuthenticated && 
    user && 
    normalizedRoles.some(r => {
      if (r === 'faculty' || r === 'teacher') return isTeacher;
      return r === currentRole;
    })
  );

  return { 
    isAuthorized,
    isLoading: loading 
  };
};
