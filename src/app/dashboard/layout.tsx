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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--navy)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, border: '3px solid rgba(176,138,106,0.2)',
            borderTopColor: 'var(--copper)', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto',
          }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Wird geladen…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--navy)' }}>

      {/* ── Navigation Bar ─────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--navy)',
        borderBottom: '1px solid rgba(176,138,106,0.25)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>

            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 6,
                background: 'var(--copper)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '0.8rem', color: 'var(--navy)',
                fontFamily: 'Manrope, sans-serif', letterSpacing: '0.05em',
              }}>
                MD
              </div>
              <div>
                <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--offwhite)', lineHeight: 1.2 }}>
                  Meyer Decision
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--copper)', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1 }}>
                  Steuerungs-Dashboard
                </div>
              </div>
            </div>

            {/* Right: Admin + Email + Logout */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {authData.role === 'admin' && (
                <a
                  href="/admin"
                  style={{
                    padding: '0.35rem 0.85rem',
                    borderRadius: 6,
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    background: 'rgba(176,138,106,0.15)',
                    color: 'var(--copper)',
                    border: '1px solid rgba(176,138,106,0.3)',
                    fontFamily: 'Manrope, sans-serif',
                    letterSpacing: '0.03em',
                    transition: 'background 0.2s',
                  }}
                >
                  Admin
                </a>
              )}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'none' }} className="sm-block">
                {authData.email}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {authData.email}
              </span>
              <button
                onClick={handleLogout}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: 6,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  background: 'rgba(239,68,68,0.12)',
                  color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.25)',
                  fontFamily: 'Manrope, sans-serif',
                }}
              >
                Abmelden
              </button>
            </div>

          </div>
        </div>
      </nav>

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <main style={{ flex: 1, maxWidth: 1200, margin: '0 auto', width: '100%', padding: '1.5rem' }}>
        {children}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer style={{
        background: 'rgba(0,0,0,0.2)',
        borderTop: '1px solid var(--border-color)',
        padding: '1.25rem 1.5rem',
        textAlign: 'center',
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
      }}>
        <p>Meyer Decision GmbH — Steuerungs-Dashboard v6</p>
        <p style={{ marginTop: '0.25rem', opacity: 0.6 }}>© 2026 Meyer Decision GmbH. Alle Rechte vorbehalten.</p>
      </footer>
    </div>
  );
}
