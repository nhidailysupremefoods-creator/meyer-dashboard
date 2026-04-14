'use client';

import { useState } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { Customer } from '@/types';
import { getEinsatzlogikOptionsForIndustry, INDUSTRY_SEGMENTS } from '@/lib/config';

const S = {
  card: { background: 'var(--navy-card)', border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' } as React.CSSProperties,
  th: { padding: '0.75rem 1rem', textAlign: 'left' as const, fontSize: '0.7rem', fontWeight: 700, color: 'var(--copper)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)' },
  td: { padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--offwhite)', borderBottom: '1px solid rgba(176,138,106,0.1)' },
  tdSec: { padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(176,138,106,0.1)' },
};

const INDUSTRY_OPTIONS = Object.entries(INDUSTRY_SEGMENTS).map(([code, { label }]) => ({ value: code, label }));

interface CustomerTabProps {
  customers: Customer[];
  onUpdate: () => Promise<void>;
}

export default function CustomerTab({ customers, onUpdate }: CustomerTabProps) {
  const { updateCustomer, loading, error } = useAdmin();
  const [saving, setSaving] = useState<string | null>(null);
  const [editingIndustry, setEditingIndustry] = useState<Record<string, string>>({});
  const [editingEinsatzlogik, setEditingEinsatzlogik] = useState<Record<string, string>>({});
  const [editingStatus, setEditingStatus] = useState<Record<string, boolean>>({});

  const handleSave = async (customerId: string) => {
    const newIndustry = editingIndustry[customerId];
    const newEinsatzlogik = editingEinsatzlogik[customerId];
    const newStatus = editingStatus[customerId];

    if (!newIndustry && newEinsatzlogik === undefined && newStatus === undefined) return;

    setSaving(customerId);
    try {
      const updates: Record<string, any> = {};
      if (newIndustry) updates.industry_segment = newIndustry;
      if (newEinsatzlogik !== undefined) updates.einsatzlogik_segment = newEinsatzlogik || null;
      if (newStatus !== undefined) updates.is_active = newStatus;

      const success = await updateCustomer(customerId, updates);
      if (success) {
        setEditingIndustry({ ...editingIndustry, [customerId]: '' });
        setEditingEinsatzlogik({ ...editingEinsatzlogik, [customerId]: '' });
        setEditingStatus({ ...editingStatus, [customerId]: undefined });
        await onUpdate();
      }
    } finally { setSaving(null); }
  };

  const hasChanges = (customerId: string, customer: Customer) => {
    return (editingIndustry[customerId] && editingIndustry[customerId] !== customer.industry_segment) ||
           (editingEinsatzlogik[customerId] !== undefined && editingEinsatzlogik[customerId] !== (customer.einsatzlogik_segment || '')) ||
           (editingStatus[customerId] !== undefined && editingStatus[customerId] !== customer.is_active);
  };

  return (
    <div style={S.card}>
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '3px solid #ef4444', padding: '0.75rem 1rem', color: '#ef4444', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={S.th}>Mandanten-ID</th>
              <th style={S.th}>Abo-Typ</th>
              <th style={S.th}>Branche</th>
              <th style={S.th}>Einsatzlogik</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const einsatzlogikOptions = getEinsatzlogikOptionsForIndustry(editingIndustry[c.customer_id] || c.industry_segment || '');
              return (
                <tr key={c.customer_id}>
                  <td style={S.td}><strong>{c.customer_id}</strong></td>
                  <td style={S.tdSec}>{c.subscription_type || '–'}</td>
                  <td style={{ ...S.td, paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                    <select
                      value={editingIndustry[c.customer_id] || c.industry_segment || ''}
                      onChange={(e) => {
                        setEditingIndustry({ ...editingIndustry, [c.customer_id]: e.target.value });
                        setEditingEinsatzlogik({ ...editingEinsatzlogik, [c.customer_id]: '' });
                      }}
                      style={{ width: '100%', padding: '0.375rem 0.625rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--offwhite)' }}
                    >
                      <option value="">-- Auswählen --</option>
                      {INDUSTRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td style={{ ...S.td, paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                    <select
                      value={editingEinsatzlogik[c.customer_id] !== undefined ? editingEinsatzlogik[c.customer_id] : (c.einsatzlogik_segment || '')}
                      onChange={(e) => setEditingEinsatzlogik({ ...editingEinsatzlogik, [c.customer_id]: e.target.value })}
                      disabled={!einsatzlogikOptions.length}
                      style={{ width: '100%', padding: '0.375rem 0.625rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: 6, color: einsatzlogikOptions.length ? 'var(--offwhite)' : 'var(--text-secondary)', opacity: einsatzlogikOptions.length ? 1 : 0.5 }}
                    >
                      <option value="">-- Auswählen --</option>
                      {einsatzlogikOptions.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                    </select>
                  </td>
                  <td style={S.td}>
                    <button
                      onClick={() => setEditingStatus({ ...editingStatus, [c.customer_id]: !(editingStatus[c.customer_id] !== undefined ? editingStatus[c.customer_id] : c.is_active) })}
                      style={{
                        display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, border: 'none',
                        background: (editingStatus[c.customer_id] !== undefined ? editingStatus[c.customer_id] : c.is_active) ? 'rgba(16,185,129,0.15)' : 'rgba(156,163,175,0.15)',
                        color: (editingStatus[c.customer_id] !== undefined ? editingStatus[c.customer_id] : c.is_active) ? '#10b981' : '#9CA3AF',
                        border: `1px solid ${(editingStatus[c.customer_id] !== undefined ? editingStatus[c.customer_id] : c.is_active) ? 'rgba(16,185,129,0.3)' : 'rgba(156,163,175,0.3)'}`,
                        cursor: 'pointer'
                      }}>
                        {(editingStatus[c.customer_id] !== undefined ? editingStatus[c.customer_id] : c.is_active) ? 'Aktiv' : 'Inaktiv'}
                      </button>
                  </td>
                  <td style={S.td}>
                    {hasChanges(c.customer_id, c) ? (
                      <button
                        onClick={() => handleSave(c.customer_id)}
                        disabled={saving === c.customer_id || loading}
                        style={{ padding: '0.35rem 0.85rem', background: 'var(--copper)', color: 'var(--navy)', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: '0.8rem', opacity: saving === c.customer_id ? 0.6 : 1 }}
                      >
                        {saving === c.customer_id ? 'Speichern…' : 'Speichern'}
                      </button>
                    ) : <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>–</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {customers.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Keine Mandanten vorhanden
        </div>
      )}
    </div>
  );
}
