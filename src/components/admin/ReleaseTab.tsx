'use client';

import { useState, useMemo, useEffect } from 'react';
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
  onToggleRelease: (customerId: string, month: string, isReleased: boolean) => Promise<boolean>;
  onUnreleaseAll: (customerId: string) => Promise<boolean>;
}

export default function ReleaseTab({ customers, releases, onUpdate, onToggleRelease, onUnreleaseAll }: ReleaseTabProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<string>(customers[0]?.customer_id || '');
  const [toggling, setToggling] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  // Optimistic state: tracks toggled months before server confirms
  const [optimisticToggles, setOptimisticToggles] = useState<Record<string, boolean>>({});

  const getMonthKey = (month: string) => month.replace(/_/g, '-');

  // Clean up optimistic toggles once server data confirms the change
  useEffect(() => {
    if (Object.keys(optimisticToggles).length === 0) return;

    const serverReleasedSet = new Set<string>();
    releases
      .filter((r) => r.customer_id === selectedCustomer)
      .forEach((r) => {
        if (r.is_released) serverReleasedSet.add(getMonthKey(r.report_month));
      });

    const toDelete: string[] = [];
    Object.entries(optimisticToggles).forEach(([key, isReleased]) => {
      // If server agrees with our optimistic state, we can clean it up
      if (isReleased === serverReleasedSet.has(key)) {
        toDelete.push(key);
      }
    });

    if (toDelete.length > 0) {
      setOptimisticToggles((prev) => {
        const n = { ...prev };
        toDelete.forEach((k) => delete n[k]);
        return n;
      });
    }
  }, [releases, selectedCustomer, optimisticToggles]);

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
    // Apply optimistic toggles
    Object.entries(optimisticToggles).forEach(([key, isReleased]) => {
      if (isReleased) set.add(key);
      else set.delete(key);
    });
    return set;
  }, [customerReleases, optimisticToggles]);

  const releasedCount = releasedSet.size;

  const handleToggle = async (month: string) => {
    const key = getMonthKey(month);
    const isCurrentlyReleased = releasedSet.has(key);
    const newReleaseState = !isCurrentlyReleased;

    // Optimistic update
    setOptimisticToggles((prev) => ({ ...prev, [key]: newReleaseState }));
    setToggling(month);
    setLocalError(null);
    try {
      const success = await onToggleRelease(selectedCustomer, month.replace(/-/g, '_'), newReleaseState);
      if (success) {
        setSuccessMsg(`${month} ${newReleaseState ? 'freigegeben' : 'gesperrt'}`);
        setTimeout(() => setSuccessMsg(null), 1500);
      } else {
        // Revert optimistic update
        setOptimisticToggles((prev) => { const n = { ...prev }; delete n[key]; return n; });
        setLocalError('Freigabe-Änderung fehlgeschlagen');
      }
    } catch (err: any) {
      // Revert optimistic update
      setOptimisticToggles((prev) => { const n = { ...prev }; delete n[key]; return n; });
      setLocalError(err.message || 'Fehler bei der Freigabe');
    } finally {
      setToggling(null);
    }
  };

  const handleUnreleaseAll = async () => {
    if (!window.confirm('Möchten Sie alle Monate für diesen Mandanten sperren?')) return;
    setLocalError(null);
    try {
      const success = await onUnreleaseAll(selectedCustomer);
      if (success) {
        // Clear optimistic toggles
        setOptimisticToggles({});
        setSuccessMsg('Alle Monate gesperrt');
        setTimeout(() => setSuccessMsg(null), 2000);
      }
    } catch (err: any) {
      setLocalError(err.message || 'Fehler beim Sperren');
    }
  };

  // Clear optimistic state when customer changes
  const handleCustomerChange = (newCustomer: string) => {
    setSelectedCustomer(newCustomer);
    setOptimisticToggles({});
    setLocalError(null);
    setSuccessMsg(null);
  };

  return (
    <div style={S.card}>
      {localError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '3px solid #ef4444', padding: '0.75rem 1rem', color: '#ef4444', fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{localError}</span>
          <button onClick={() => setLocalError(null)} style={{ color: '#ef4444', background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer' }}>&times;</button>
        </div>
      )}
      {successMsg && (
        <div style={{ background: 'rgba(16,185,129,0.1)', borderLeft: '3px solid #10b981', padding: '0.75rem 1rem', color: '#10b981', fontSize: '0.875rem', fontWeight: 600 }}>
          ✓ {successMsg}
        </div>
      )}

      {/* Customer Selector */}
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'flex-end', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <label style={S.label}>Mandant</label>
          <select value={selectedCustomer} onChange={(e) => handleCustomerChange(e.target.value)} style={S.sel}>
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
          disabled={releasedCount === 0}
          style={{ padding: '0.35rem 0.85rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', opacity: releasedCount === 0 ? 0.5 : 1 }}
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
            const isToggling = toggling === month;

            return (
              <button
                key={month}
                onClick={() => handleToggle(month)}
                disabled={isToggling}
                style={{
                  padding: '0.5rem 0.375rem',
                  borderRadius: 6,
                  border: isReleased ? '2px solid rgba(16,185,129,0.6)' : '2px solid var(--border-color)',
                  background: isReleased ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
                  color: isReleased ? '#10b981' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  opacity: isToggling ? 0.5 : 1,
                  cursor: isToggling ? 'not-allowed' : 'pointer',
                  fontFamily: 'Manrope, sans-serif',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                {isToggling ? '…' : monthName}
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
