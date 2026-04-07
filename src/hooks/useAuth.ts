'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { AuthData, LoginRequest, APIError } from '@/types';

interface UseAuthReturn {
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
 * Custom hook for auth state management
 * Reads from sessionStorage on mount, provides login/logout methods
 */
export function useAuth(): UseAuthReturn {
  const [authData, setAuthData] = useState<AuthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Initialize auth from sessionStorage on mount (client-side only)
  useEffect(() => {
    const data = api.getAuthData();
    if (data) {
      setAuthData(data);
    }
    setMounted(true);
  }, []);

  const login = useCallback(
    async (payload: LoginRequest): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.login(payload);

        if (!response.success) {
          const errorMsg =
            response.error || 'Login fehlgeschlagen';
          setError(errorMsg);
          return false;
        }

        const newAuthData: AuthData = {
          token: response.token || '',
          role: response.role || 'customer',
          email: response.email || '',
          customers: response.customers || [],
        };

        setAuthData(newAuthData);
        return true;
      } catch (err: any) {
        const errorMsg =
          err instanceof APIError
            ? err.message
            : 'Login fehlgeschlagen. Bitte versuchen Sie es später erneut.';
        setError(errorMsg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    api.clearAuth();
    setAuthData(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isLoggedIn: mounted && authData !== null && authData.token !== null,
    role: authData?.role || 'none',
    email: authData?.email || '',
    customers: authData?.customers || [],
    token: authData?.token || null,
    loading,
    error,
    login,
    logout,
    clearError,
  };
}
