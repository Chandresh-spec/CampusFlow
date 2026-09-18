'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getUser, setUser, clearUser, setTokens, clearTokens } from '../lib/auth';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  username: string;
  role: string;
  email?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User, access: string, refresh: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const storedUser = getUser();
    if (storedUser) {
      setUserState(storedUser);
      setIsAuthenticated(true);
    }
  }, []);

  const login = (newUser: User, access: string, refresh: string) => {
    setUser(newUser);
    setTokens(access, refresh);
    setUserState(newUser);
    setIsAuthenticated(true);
  };

  const logout = () => {
    clearUser();
    clearTokens();
    setUserState(null);
    setIsAuthenticated(false);
    router.push('/login');
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      setUserState(updatedUser);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
