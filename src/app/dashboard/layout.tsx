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
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto"
            style={{ borderBottomColor: 'var(--copper)' }}
          />
          <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
            Wird geladen...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
      {/* ── Original-Style Dark Navy Header ── */}
      <header
        className="print:hidden"
        style={{
          backgroundColor: 'var(--navy)',
          color: '#FFFFFF',
          padding: '0.75rem 0',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Logo + Title */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <span
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: 800,
                  fontSize: '1.1rem',
                  letterSpacing: '0.04em',
                  color: '#FFFFFF',
                }}
              >
                MEYER<span style={{ color: 'var(--copper)', margin: '0 2px' }}>|</span>DECISION
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--copper-light)',
                }}
              >
                Steuerungs-Dashboard
              </span>
            </div>

            {/* Right side: User + Logout */}
            <div className="flex items-center gap-3">
              {authData.role === 'admin' && (
                <a
                  href="/admin"
                  className="px-3 py-1.5 rounded text-xs font-semibold"
                  style={{
                    backgroundColor: 'rgba(232, 168, 56, 0.2)',
                    color: 'var(--warning)',
                  }}
                >
                  Admin
                </a>
              )}
              <span
                className="hidden sm:inline text-xs"
                style={{ color: 'rgba(255,255,255,0.6)' }}
              >
                {authData.email}
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: 'rgba(196, 56, 48, 0.2)',
                  color: '#E88080',
                }}
              >
                Abmelden
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* ── Footer ── */}
      <footer
        className="mt-8 print:hidden"
        style={{
          borderTop: '1px solid var(--border-color)',
          backgroundColor: '#FFFFFF',
        }}
      >
        <div
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          <p>Meyer Decision GmbH — Steuerungs-Dashboard</p>
          <p className="mt-1">&copy; 2026 Meyer Decision GmbH. Alle Rechte vorbehalten.</p>
        </div>
      </footer>
    </div>
  );
}
