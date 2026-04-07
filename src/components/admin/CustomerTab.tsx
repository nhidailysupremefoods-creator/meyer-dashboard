'use client';

import { useState } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { Customer } from '@/types';

const S = {
  card: { background: 'var(--navy-card)', border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' } as React.CSSProperties,
  th: { padding: '0.75rem 1rem', textAlign: 'left' as const, fontSize: '0.7rem', fontWeight: 700, color: 'var(--copper)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)' },
  td: { padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--offwhite)', borderBottom: '1px solid rgba(176,138,106,0.1)' },
  tdSec: { padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(176,138,106,0.1)' },
};

const INDUSTRY_OPTIONS = [
  { value: 'B2B_CONTRACTING', label: 'B2B Contracting' },
  { value: 'INDUSTRIESERVICE', label: 'Industrieservice' },
  { value: 'TECHN_WARTUNG',    label: 'Technische Wartung' },
  { value: 'HANDWERK',         label: 'Handwerk' },
  { value: 'SONSTIGE',         label: 'Sonstige' },
];

interface CustomerTabProps {
  customers: Customer[];
  onUpdate: () => Promise<void>;
}

export default function CustomerTab({ customers, onUpdate }: CustomerTabProps) {
  const { updateCustomer, loading, error } = useAdmin();
  const [saving, setSaving] = useState<string | null>(null);
  const [editingIndustry, setEditingIndustry] = useState<Record<string, string>>({});

  const handleSave = async (customerId: string) => {
    const newIndustry = editingIndustry[customerId];
    if (!newIndustry) return;
    setSaving(customerId);
    try {
      const success = await updateCustomer(customerId, { industry_segment: newIndustry });
      if (success) {
        setEditingIndustry({ ...editingIndustry, [customerId]: '' });
        await onUpdate();
      }
    } finally { setSaving(null); }
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
              <th style={S.th}>Name</th>
              <th style={S.th}>Abo-Typ</th>
              <th style={S.th}>Branche</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.customer_id}>
                <td style={S.td}><strong>{c.customer_id}</strong></td>
                <td style={S.tdSec}>{c.name || c.display_name || '–'}</td>
                <td style={S.tdSec}>{c.subscription_type || '–'}</td>
                <td style={{ ...S.td, paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                  <select
                    value={editingIndustry[c.customer_id] || c.industry_segment || ''}
                    onChange={(e) => setEditingIndustry({ ...editingIndustry, [c.customer_id]: e.target.value })}
                    style={{ width: '100%', padding: '0.375rem 0.625rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--offwhite)' }}
                  >
                    <option value="">-- Auswählen --</option>
                    {INDUSTRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td style={S.td}>
                  <span style={{
                    display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                    background: c.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(156,163,175,0.15)',
                    color: c.is_active ? '#10b981' : '#9CA3AF',
                    border: `1px solid ${c.is_active ? 'rgba(16,185,129,0.3)' : 'rgba(156,163,175,0.3)'}`,
                  }}>
                    {c.is_active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </td>
                <td style={S.td}>
                  {editingIndustry[c.customer_id] && editingIndustry[c.customer_id] !== c.industry_segment ? (
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
            ))}
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
