'use client';

import { useState, useMemo } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { Customer, Release } from '@/types';

const S = {
  card: { background: 'var(--navy-card)', border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' } as React.CSSProperties,
  sel: { padding: '0.375rem 0.625rem', fontSize: '0.85rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--offwhite)', minWidth: 200 } as React.CSSProperties,
  label: { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '0.35rem', display: 'block' },
};

interface ReleaseTabProps {
  customers: Customer[];
  releases: Release[];
  onUpdate: () => Promise<void>;
}

export default function ReleaseTab({ customers, releases, onUpdate }: ReleaseTabProps) {
  const { toggleRelease, unreleaseAll, loading, error } = useAdmin();
  const [selectedCustomer, setSelectedCustomer] = useState<string>(customers[0]?.customer_id || '');
  const [toggling, setToggling] = useState<string | null>(null);

  const getMonthKey = (month: string) => month.replace(/_/g, '-');

  const customerReleases = useMemo(() => {
    return releases.filter((r) => r.customer_id === selectedCustomer);
  }, [releases, selectedCustomer]);

  const months = useMemo(() => {
    const today = new Date();
    const result = [];
    for (let i = -12; i <= 3; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      result.push(`${year}-${month}`);
    }
    return result;
  }, []);

  const releasedSet = useMemo(() => {
    const set = new Set<string>();
    customerReleases.forEach((r) => {
      const key = getMonthKey(r.report_month);
      if (r.is_released) set.add(key);
    });
    return set;
  }, [customerReleases]);

  const releasedCount = releasedSet.size;

  const handleToggle = async (month: string) => {
    const key = getMonthKey(month);
    const isCurrentlyReleased = releasedSet.has(key);
    setToggling(month);
    try {
      await toggleRelease(selectedCustomer, month.replace(/-/g, '_'), !isCurrentlyReleased);
      await onUpdate();
    } finally {
      setToggling(null);
    }
  };

  const handleUnreleaseAll = async () => {
    if (!window.confirm('Möchten Sie alle Monate für diesen Mandanten sperren?')) return;
    try {
      await unreleaseAll(selectedCustomer);
      await onUpdate();
    } catch (err) {
      console.error('Error unrelease all:', err);
    }
  };

  return (
    <div style={S.card}>
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '3px solid #ef4444', padding: '0.75rem 1rem', color: '#ef4444', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Customer Selector */}
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'flex-end', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <label style={S.label}>Mandant</label>
          <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)} style={S.sel}>
            {customers.map((c) => (
              <option key={c.customer_id} value={c.customer_id}>
                {c.name || c.display_name || c.customer_id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Counter + Actions */}
      <div style={{ padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.1)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--offwhite)', fontWeight: 600 }}>{releasedCount}</span>
          {' '}von{' '}
          <span style={{ color: 'var(--offwhite)', fontWeight: 600 }}>{months.length}</span>
          {' '}Monate freigegeben
        </span>
        <button
          onClick={handleUnreleaseAll}
          disabled={loading || releasedCount === 0}
          style={{ padding: '0.35rem 0.85rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, fontWeight: 600, fontSize: '0.8rem', opacity: (loading || releasedCount === 0) ? 0.5 : 1 }}
        >
          Alle sperren
        </button>
      </div>

      {/* Calendar Grid */}
      <div style={{ padding: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.5rem' }}>
          {months.map((month) => {
            const key = getMonthKey(month);
            const isReleased = releasedSet.has(key);
            const [year, monthNum] = month.split('-');
            const monthName = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
              .toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });

            return (
              <button
                key={month}
                onClick={() => handleToggle(month)}
                disabled={toggling === month || loading}
                style={{
                  padding: '0.5rem 0.375rem',
                  borderRadius: 6,
                  border: isReleased ? '2px solid rgba(16,185,129,0.6)' : '2px solid var(--border-color)',
                  background: isReleased ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
                  color: isReleased ? '#10b981' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  opacity: (toggling === month || loading) ? 0.5 : 1,
                  cursor: (toggling === month || loading) ? 'not-allowed' : 'pointer',
                  fontFamily: 'Manrope, sans-serif',
                  textAlign: 'center',
                }}
              >
                {toggling === month ? '…' : monthName}
              </button>
            );
          })}
        </div>
      </div>

      {customers.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Keine Mandanten vorhanden
        </div>
      )}
    </div>
  );
}
