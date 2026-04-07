'use client';

import { useState } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { Registration } from '@/types';

const S = {
  card: { background: 'var(--navy-card)', border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' } as React.CSSProperties,
  sectionHeader: { padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--offwhite)', fontFamily: 'Manrope, sans-serif' } as React.CSSProperties,
  th: { padding: '0.75rem 1rem', textAlign: 'left' as const, fontSize: '0.7rem', fontWeight: 700, color: 'var(--copper)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)' },
  td: { padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--offwhite)', borderBottom: '1px solid rgba(176,138,106,0.1)' },
  tdSec: { padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(176,138,106,0.1)' },
};

interface RegistrationTabProps {
  registrations: Registration[];
  onUpdate: () => Promise<void>;
}

export default function RegistrationTab({ registrations, onUpdate }: RegistrationTabProps) {
  const { approveRegistration, rejectRegistration, loading, error } = useAdmin();
  const [processing, setProcessing] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<Record<string, string>>({});

  const handleApprove = async (email: string) => {
    setProcessing(email);
    try {
      const success = await approveRegistration(email);
      if (success) {
        setStatusMessage({ ...statusMessage, [email]: 'Genehmigt ✓' });
        setTimeout(() => {
          setStatusMessage((prev) => { const next = { ...prev }; delete next[email]; return next; });
        }, 2000);
        await onUpdate();
      }
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (email: string) => {
    if (!window.confirm(`Möchten Sie die Registrierung für ${email} ablehnen?`)) return;
    setProcessing(email);
    try {
      const success = await rejectRegistration(email);
      if (success) {
        setStatusMessage({ ...statusMessage, [email]: 'Abgelehnt ✓' });
        setTimeout(() => {
          setStatusMessage((prev) => { const next = { ...prev }; delete next[email]; return next; });
        }, 2000);
        await onUpdate();
      }
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; border: string; label: string }> = {
      pending:  { bg: 'rgba(245,158,11,0.15)',  color: '#F59E0B', border: 'rgba(245,158,11,0.3)',  label: 'Ausstehend' },
      approved: { bg: 'rgba(16,185,129,0.15)',   color: '#10b981', border: 'rgba(16,185,129,0.3)',  label: 'Genehmigt' },
      rejected: { bg: 'rgba(239,68,68,0.15)',    color: '#ef4444', border: 'rgba(239,68,68,0.3)',   label: 'Abgelehnt' },
    };
    const s = styles[status] || styles.pending;
    return (
      <span style={{ display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
        {s.label}
      </span>
    );
  };

  const pendingRegistrations = registrations.filter((r) => r.status === 'pending');
  const processedRegistrations = registrations.filter((r) => r.status !== 'pending');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '3px solid #ef4444', padding: '0.75rem 1rem', color: '#ef4444', fontSize: '0.875rem', borderRadius: 6 }}>
          {error}
        </div>
      )}

      {registrations.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Keine Registrierungen vorhanden
        </div>
      ) : (
        <>
          {pendingRegistrations.length > 0 && (
            <div style={S.card}>
              <div style={{ ...S.sectionHeader, borderLeft: '3px solid #F59E0B' }}>
                Ausstehende Registrierungen ({pendingRegistrations.length})
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={S.th}>E-Mail</th>
                      <th style={S.th}>Status</th>
                      <th style={S.th}>Angefordert</th>
                      <th style={S.th}>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRegistrations.map((reg) => (
                      <tr key={reg.email}>
                        <td style={S.td}><strong style={{ fontWeight: 500 }}>{reg.email}</strong></td>
                        <td style={S.td}>{getStatusBadge(reg.status)}</td>
                        <td style={S.tdSec}>
                          {reg.requested_at ? new Date(reg.requested_at).toLocaleDateString('de-DE') : '–'}
                        </td>
                        <td style={{ ...S.td, paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                          {statusMessage[reg.email] ? (
                            <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>{statusMessage[reg.email]}</span>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                onClick={() => handleApprove(reg.email)}
                                disabled={processing === reg.email || loading}
                                style={{ padding: '0.3rem 0.75rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, fontWeight: 600, fontSize: '0.8rem', opacity: processing === reg.email ? 0.6 : 1 }}
                              >
                                ✓ Genehmigen
                              </button>
                              <button
                                onClick={() => handleReject(reg.email)}
                                disabled={processing === reg.email || loading}
                                style={{ padding: '0.3rem 0.75rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, fontWeight: 600, fontSize: '0.8rem', opacity: processing === reg.email ? 0.6 : 1 }}
                              >
                                ✕ Ablehnen
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {processedRegistrations.length > 0 && (
            <div style={S.card}>
              <div style={S.sectionHeader}>Verarbeitete Registrierungen</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={S.th}>E-Mail</th>
                      <th style={S.th}>Status</th>
                      <th style={S.th}>Angefordert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedRegistrations.map((reg) => (
                      <tr key={reg.email}>
                        <td style={S.td}><strong style={{ fontWeight: 500 }}>{reg.email}</strong></td>
                        <td style={S.td}>{getStatusBadge(reg.status)}</td>
                        <td style={S.tdSec}>
                          {reg.requested_at ? new Date(reg.requested_at).toLocaleDateString('de-DE') : '–'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
