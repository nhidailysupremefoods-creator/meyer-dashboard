'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { AuthData } from '@/types';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authData, setAuthData] = useState<AuthData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const data = api.getAuthData();
    if (!data || !data.token) {
      router.push('/');
      return;
    }
    setAuthData(data);
    setMounted(true);
  }, [router]);

  const handleLogout = () => {
    api.clearAuth();
    router.push('/');
  };

  if (!mounted || !authData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{borderBottomColor: 'var(--primary)'}} />
          <p className="mt-4" style={{color: 'var(--text-secondary)'}}>Wird geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{backgroundColor: 'var(--background)'}}>
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 shadow-lg" style={{backgroundColor: 'var(--primary)', color: 'white'}}>
        <div className="mx-auto px-4 sm:px-6 lg:px-8" style={{ maxWidth: 1400 }}>
          <div className="flex justify-between items-center h-16">
            {/* Logo and Title */}
            <div className="flex items-center gap-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Meyer Decision" style={{ height: 36, width: 'auto' }} />
              <span className="hidden sm:block" style={{
                fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.2em',
                textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.6)',
              }}>Steuerungs-Dashboard</span>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">
              {/* Admin Button */}
              {authData.role === 'admin' && (
                <a
                  href="/admin"
                  className="px-3 py-2 rounded-lg text-sm font-medium transition"
                  style={{backgroundColor: 'rgba(176, 138, 106, 0.25)', color: 'var(--copper-light)'}}
                >
                  Admin
                </a>
              )}

              {/* User Email */}
              <div className="hidden sm:block text-sm" style={{color: 'var(--accent-light)'}}>
                {authData.email}
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg text-sm font-medium transition"
                style={{backgroundColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)'}}
              >
                Abmelden
              </button>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setNavOpen(!navOpen)}
                className="md:hidden p-2 rounded transition"
                style={{backgroundColor: 'var(--primary-light)'}}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {navOpen && (
            <div className="md:hidden pb-4" style={{borderTop: '1px solid var(--border-color)'}}>
              <a href="/admin" className="block px-3 py-2 rounded text-sm transition" style={{backgroundColor: 'var(--primary-light)'}}>
                Admin
              </a>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full px-4 sm:px-6 lg:px-8 py-8" style={{ maxWidth: 1400 }}>
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-16" style={{backgroundColor: 'var(--background-card)', borderTop: '1px solid var(--border-color)'}}>
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm" style={{ maxWidth: 1400, color: 'var(--text-secondary)' }}>
          <p>Meyer Decision GbR — Steuerungs-Dashboard v6</p>
          <p className="mt-2 text-xs">© 2026 Meyer Decision GbR. Alle Rechte vorbehalten.</p>
        </div>
      </footer>
    </div>
  );
}
