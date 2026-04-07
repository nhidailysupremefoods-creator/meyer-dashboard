'use client';

import { useEffect, useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAdmin } from '@/hooks/useAdmin';
import { useRouter } from 'next/navigation';
import CustomerTab from '@/components/admin/CustomerTab';
import UserTab from '@/components/admin/UserTab';
import RegistrationTab from '@/components/admin/RegistrationTab';
import ReleaseTab from '@/components/admin/ReleaseTab';
import AuditTab from '@/components/admin/AuditTab';
import SystemTab from '@/components/admin/SystemTab';
import { api } from '@/lib/api';

type TabType = 'customers' | 'users' | 'registrations' | 'releases' | 'audit' | 'system';

const TABS: { id: TabType; label: string }[] = [
  { id: 'customers',     label: 'Mandanten' },
  { id: 'users',         label: 'Benutzer' },
  { id: 'registrations', label: 'Registrierungen' },
  { id: 'releases',      label: 'Monatsfreigabe' },
  { id: 'audit',         label: 'Audit-Log' },
  { id: 'system',        label: 'System' },
];

export default function AdminPage() {
  const router = useRouter();
  const { role, email, loading: authLoading } = useAuthContext();
  const {
    customers, users, registrations, audit, releases,
    loading, error, init, clearError,
  } = useAdmin();

  const [activeTab, setActiveTab] = useState<TabType>('customers');

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && role !== 'admin') {
      router.push('/');
    }
  }, [authLoading, role, router]);

  useEffect(() => {
    init();
  }, [init]);

  const handleLogout = () => {
    api.clearAuth();
    router.push('/');
  };

  if (authLoading || loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--navy)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48,
            border: '3px solid rgba(176,138,106,0.2)',
            borderTopColor: 'var(--copper)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto',
          }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Laden…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (role !== 'admin') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--navy)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: '1rem' }}>Kein Admin-Zugriff</p>
          <button onClick={() => router.push('/')} style={{ color: 'var(--copper)', background: 'none', border: 'none', fontWeight: 600 }}>
            Zurück zum Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Nav Bar (same as dashboard) ────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--navy)',
        borderBottom: '1px solid rgba(176,138,106,0.25)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 6,
                background: 'var(--copper)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '0.8rem', color: 'var(--navy)',
                fontFamily: 'Manrope, sans-serif',
              }}>MD</div>
              <div>
                <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--offwhite)', lineHeight: 1.2 }}>
                  Meyer Decision
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--copper)', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1 }}>
                  Admin-Bereich
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <a href="/dashboard" style={{
                padding: '0.35rem 0.85rem', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600,
                background: 'rgba(176,138,106,0.1)', color: 'var(--copper)',
                border: '1px solid rgba(176,138,106,0.25)',
              }}>← Dashboard</a>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{email}</span>
              <button onClick={handleLogout} style={{
                padding: '0.35rem 0.85rem', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600,
                background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.25)', fontFamily: 'Manrope, sans-serif',
              }}>Abmelden</button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Page Header ────────────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(0,0,0,0.15)',
        borderBottom: '1px solid var(--border-color)',
        padding: '1.25rem 1.5rem',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'var(--offwhite)', marginBottom: '0.25rem' }}>
            Admin-Bereich
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Mandanten, Benutzer und Einstellungen verwalten
          </p>
        </div>
      </div>

      {/* ── Error Alert ────────────────────────────────────────────────── */}
      {error && (
        <div style={{ maxWidth: 1200, margin: '1rem auto', padding: '0 1.5rem', width: '100%' }}>
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 8, padding: '0.75rem 1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</p>
            <button onClick={clearError} style={{ color: '#ef4444', background: 'none', border: 'none', fontWeight: 600, fontSize: '0.875rem' }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Tab Navigation ─────────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(0,0,0,0.1)',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem' }}>
          <nav style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '0.875rem 1.25rem',
                  fontWeight: 600, fontSize: '0.875rem',
                  whiteSpace: 'nowrap',
                  fontFamily: 'Manrope, sans-serif',
                  background: 'none', border: 'none',
                  borderBottom: activeTab === tab.id
                    ? '2px solid var(--copper)'
                    : '2px solid transparent',
                  color: activeTab === tab.id ? 'var(--copper)' : 'var(--text-secondary)',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, maxWidth: 1200, margin: '0 auto', width: '100%', padding: '1.5rem' }}>
        {activeTab === 'customers'     && <CustomerTab     customers={customers}   onUpdate={init} />}
        {activeTab === 'users'         && <UserTab         users={users} customers={customers} onUpdate={init} />}
        {activeTab === 'registrations' && <RegistrationTab registrations={registrations} onUpdate={init} />}
        {activeTab === 'releases'      && <ReleaseTab      customers={customers} releases={releases} onUpdate={init} />}
        {activeTab === 'audit'         && <AuditTab        audit={audit} />}
        {activeTab === 'system'        && <SystemTab       onUpdate={init} />}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
