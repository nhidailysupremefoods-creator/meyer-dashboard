'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAdmin } from '@/hooks/useAdmin';
import { useRouter } from 'next/navigation';
import CustomerTab from '@/components/admin/CustomerTab';
import UserTab from '@/components/admin/UserTab';
import RegistrationTab from '@/components/admin/RegistrationTab';
import ReleaseTab from '@/components/admin/ReleaseTab';
import AuditTab from '@/components/admin/AuditTab';
import SystemTab from '@/components/admin/SystemTab';
import LeitfadenTab from '@/components/admin/LeitfadenTab';
import { api } from '@/lib/api';

type TabType = 'customers' | 'users' | 'registrations' | 'releases' | 'audit' | 'system' | 'leitfaden';

const TABS: { id: TabType; label: string; badge?: (data: any) => number | null }[] = [
  { id: 'customers',     label: 'Mandanten' },
  { id: 'users',         label: 'Benutzer' },
  { id: 'registrations', label: 'Registrierungen', badge: (d) => d.registrations?.filter((r: any) => r.status === 'pending').length || null },
  { id: 'releases',      label: 'Monatsfreigabe' },
  { id: 'audit',         label: 'Audit-Log' },
  { id: 'system',        label: 'System' },
  { id: 'leitfaden',     label: 'Leitfaden' },
];

export default function AdminPage() {
  const router = useRouter();
  const { role, email, loading: authLoading } = useAuthContext();
  const admin = useAdmin();
  const {
    customers, users, registrations, audit, releases,
    loading, error, init, clearError,
    updateCustomer, updateUser, approveRegistration, rejectRegistration,
    toggleRelease, unreleaseAll, clearCache, triggerRebuild, checkHealth,
  } = admin;

  const [activeTab, setActiveTab] = useState<TabType>('customers');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!authLoading && role !== 'admin') {
      router.push('/');
    }
  }, [authLoading, role, router]);

  // Only init once
  useEffect(() => {
    if (!initialized) {
      init().then(() => setInitialized(true));
    }
  }, [init, initialized]);

  const handleLogout = () => {
    api.clearAuth();
    router.push('/');
  };

  // Soft refresh: silently reload in background without blocking UI
  const softRefresh = useCallback(async () => {
    try { await init(); } catch { /* silent */ }
  }, [init]);

  if (authLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--background)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48,
            border: '3px solid var(--border-color)',
            borderTopColor: 'var(--copper)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto',
          }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Laden...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (role !== 'admin') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--background)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: '1rem' }}>Kein Admin-Zugriff</p>
          <button onClick={() => router.push('/')} style={{ color: 'var(--copper)', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
            Zurück zum Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Show loading spinner only on first load, not on background refresh
  if (loading && !initialized) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--background)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48,
            border: '3px solid var(--border-color)',
            borderTopColor: 'var(--copper)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto',
          }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Admin-Daten werden geladen...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const pendingCount = registrations.filter((r) => r.status === 'pending').length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--navy)',
        borderBottom: '1px solid rgba(176, 138, 106,0.2)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Meyer Decision" style={{ height: 36, width: 'auto' }} />
              <span style={{
                fontSize: '0.7rem', fontWeight: 500, letterSpacing: '0.12em',
                textTransform: 'uppercase' as const, color: 'var(--copper-light)',
              }}>
                Admin-Bereich
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <a href="/dashboard" style={{
                padding: '0.35rem 0.85rem', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600,
                background: 'rgba(176, 138, 106,0.15)', color: 'var(--copper-light)',
                border: '1px solid rgba(176, 138, 106,0.2)', textDecoration: 'none',
              }}>Dashboard</a>
              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{email}</span>
              <button onClick={handleLogout} style={{
                padding: '0.35rem 0.85rem', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600,
                background: 'rgba(196,56,48,0.15)', color: '#E88080',
                border: '1px solid rgba(196,56,48,0.2)', fontFamily: 'Manrope, sans-serif',
                cursor: 'pointer',
              }}>Abmelden</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Page Header */}
      <div style={{
        background: '#FFFFFF',
        borderBottom: '1px solid var(--border-color)',
        padding: '1.25rem 1.5rem',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Admin-Bereich
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Mandanten, Benutzer und Einstellungen verwalten
            {loading && <span style={{ color: 'var(--copper)', marginLeft: 8 }}>↻ Aktualisiere…</span>}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ maxWidth: 1200, margin: '1rem auto', padding: '0 1.5rem', width: '100%' }}>
          <div style={{
            background: 'rgba(196,56,48,0.06)', border: '1px solid rgba(196,56,48,0.2)',
            borderRadius: 8, padding: '0.75rem 1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{error}</p>
            <button onClick={clearError} style={{ color: 'var(--danger)', background: 'none', border: 'none', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid var(--border-color)' }}>
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
                    ? '2.5px solid var(--copper)'
                    : '2.5px solid transparent',
                  color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                }}
              >
                {tab.label}
                {tab.id === 'registrations' && pendingCount > 0 && (
                  <span style={{
                    background: '#F59E0B', color: '#fff', borderRadius: 10,
                    padding: '0 0.4rem', fontSize: '0.7rem', fontWeight: 700, lineHeight: '1.4',
                  }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content — actions passed as props, NOT via separate useAdmin() instances */}
      <div style={{ flex: 1, maxWidth: activeTab === 'leitfaden' ? 1600 : 1200, margin: '0 auto', width: '100%', padding: '1.5rem', transition: 'max-width 0.2s ease' }}>
        {activeTab === 'customers' && (
          <CustomerTab
            customers={customers}
            onUpdate={softRefresh}
            onUpdateCustomer={updateCustomer}
          />
        )}
        {activeTab === 'users' && (
          <UserTab
            users={users}
            customers={customers}
            onUpdate={softRefresh}
            onUpdateUser={updateUser}
          />
        )}
        {activeTab === 'registrations' && (
          <RegistrationTab
            registrations={registrations}
            onUpdate={softRefresh}
            onApprove={approveRegistration}
            onReject={rejectRegistration}
          />
        )}
        {activeTab === 'releases' && (
          <ReleaseTab
            customers={customers}
            releases={releases}
            onUpdate={softRefresh}
            onToggleRelease={toggleRelease}
            onUnreleaseAll={unreleaseAll}
          />
        )}
        {activeTab === 'audit' && <AuditTab audit={audit} />}
        {activeTab === 'system' && (
          <SystemTab
            onUpdate={softRefresh}
            onCheckHealth={checkHealth}
            onClearCache={clearCache}
            onTriggerRebuild={triggerRebuild}
          />
        )}
        {activeTab === 'leitfaden' && <LeitfadenTab customers={customers} />}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
