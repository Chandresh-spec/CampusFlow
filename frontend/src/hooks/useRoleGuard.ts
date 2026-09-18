'use client';
import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';

export const useRoleGuard = (allowedRoles: string[]) => {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
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
  }, [user, isAuthenticated, allowedRoles, router]);

  return { 
    isAuthorized: isAuthenticated && user && allowedRoles.includes(user.role.toLowerCase()),
    isLoading: !user 
  };
};
