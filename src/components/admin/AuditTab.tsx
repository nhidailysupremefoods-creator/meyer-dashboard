'use client';

import { useState, useMemo } from 'react';
import { AuditEntry } from '@/types';

const S = {
  card: { background: 'var(--navy-card)', border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' } as React.CSSProperties,
  th: { padding: '0.75rem 1rem', textAlign: 'left' as const, fontSize: '0.7rem', fontWeight: 700, color: 'var(--copper)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)' },
  td: { padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--offwhite)', borderBottom: '1px solid rgba(176,138,106,0.1)' },
  tdSec: { padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(176,138,106,0.1)' },
  input: { padding: '0.375rem 0.625rem', fontSize: '0.85rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--offwhite)', width: '100%' } as React.CSSProperties,
  label: { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '0.35rem', display: 'block' },
};

interface AuditTabProps {
  audit: AuditEntry[];
}

export default function AuditTab({ audit }: AuditTabProps) {
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterEventType, setFilterEventType] = useState<string>('');
  const [sortBy, setSortBy] = useState<'asc' | 'desc'>('desc');

  const eventTypes = useMemo(() => {
    const types = new Set<string>();
    audit.forEach((entry) => { if (entry.event_type) types.add(entry.event_type); });
    return Array.from(types).sort();
  }, [audit]);

  const filtered = useMemo(() => {
    let result = [...audit];
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      result = result.filter((e) => new Date(e.event_timestamp) >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((e) => new Date(e.event_timestamp) <= to);
    }
    if (filterEventType) {
      result = result.filter((e) => e.event_type === filterEventType);
    }
    result.sort((a, b) => {
      const aT = new Date(a.event_timestamp).getTime();
      const bT = new Date(b.event_timestamp).getTime();
      return sortBy === 'desc' ? bT - aT : aT - bT;
    });
    return result;
  }, [audit, filterDateFrom, filterDateTo, filterEventType, sortBy]);

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CUSTOMER_CREATED: 'Mandant erstellt',
      CUSTOMER_UPDATED: 'Mandant aktualisiert',
      CUSTOMER_INDUSTRY_CHANGED: 'Branche geändert',
      USER_CREATED: 'Benutzer erstellt',
      USER_UPDATED: 'Benutzer aktualisiert',
      USER_DELETED: 'Benutzer gelöscht',
      REGISTRATION_APPROVED: 'Registrierung genehmigt',
      REGISTRATION_REJECTED: 'Registrierung abgelehnt',
      MONTH_RELEASED: 'Monat freigegeben',
      MONTH_UNRELEASED: 'Monat gesperrt',
      CACHE_CLEARED: 'Cache geleert',
      ADVISORY_REBUILT: 'Advisory neu erstellt',
    };
    return labels[type] || type;
  };

  const getEventBadgeStyle = (type: string) => {
    if (type.includes('CUSTOMER')) return { bg: 'rgba(59,130,246,0.15)', color: '#60A5FA', border: 'rgba(59,130,246,0.3)' };
    if (type.includes('USER')) return { bg: 'rgba(139,92,246,0.15)', color: '#A78BFA', border: 'rgba(139,92,246,0.3)' };
    if (type.includes('REGISTRATION')) return { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: 'rgba(245,158,11,0.3)' };
    if (type.includes('MONTH')) return { bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.3)' };
    if (type.includes('CACHE') || type.includes('ADVISORY')) return { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'rgba(239,68,68,0.3)' };
    return { bg: 'rgba(156,163,175,0.15)', color: '#9CA3AF', border: 'rgba(156,163,175,0.3)' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Filters */}
      <div style={S.card}>
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--copper)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>
          Filter
        </div>
        <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={S.label}>Von</label>
            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} style={S.input} />
          </div>
          <div>
            <label style={S.label}>Bis</label>
            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} style={S.input} />
          </div>
          <div>
            <label style={S.label}>Ereignistyp</label>
            <select value={filterEventType} onChange={(e) => setFilterEventType(e.target.value)} style={S.input}>
              <option value="">-- Alle --</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>{getEventTypeLabel(type)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label}>Sortierung</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'asc' | 'desc')} style={S.input}>
              <option value="desc">Neueste zuerst</option>
              <option value="asc">Älteste zuerst</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div style={S.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={S.th}>Zeitstempel</th>
                <th style={S.th}>Ereignistyp</th>
                <th style={S.th}>Benutzer</th>
                <th style={S.th}>Mandant</th>
                <th style={S.th}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, idx) => {
                const badge = getEventBadgeStyle(entry.event_type);
                return (
                  <tr key={`${entry.event_timestamp}-${idx}`}>
                    <td style={S.tdSec}>
                      {new Date(entry.event_timestamp).toLocaleDateString('de-DE', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </td>
                    <td style={S.td}>
                      <span style={{ display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                        {getEventTypeLabel(entry.event_type)}
                      </span>
                    </td>
                    <td style={S.td}>{entry.user_email || '–'}</td>
                    <td style={S.tdSec}>{entry.customer_id || '–'}</td>
                    <td style={{ ...S.tdSec, maxWidth: 300 }}>
                      <span title={entry.description} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                        {entry.description || '–'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Keine Einträge mit den aktuellen Filtern
          </div>
        )}

        {filtered.length > 0 && (
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.1)', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {filtered.length} von {audit.length} Einträgen angezeigt
          </div>
        )}
      </div>
    </div>
  );
}
