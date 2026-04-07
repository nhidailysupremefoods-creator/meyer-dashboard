'use client';

import React, { createContext, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { LoginRequest } from '@/types';

/**
 * Auth Context Type
 */
export interface AuthContextType {
  isLoggedIn: boolean;
  role: 'admin' | 'customer' | 'none';
  email: string;
  customers: string[];
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (payload: LoginRequest) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

/**
 * Create Auth Context
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Auth Context Provider Component
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to use Auth Context
 * Throws error if used outside AuthProvider
 */
export function useAuthContext(): AuthContextType {
  const context = React.useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuthContext must be used within an AuthProvider'
    );
  }

  return context;
}
