'use client';

import { useState } from 'react';
import { Customer } from '@/types';
import { getEinsatzlogikOptionsForIndustry, INDUSTRY_SEGMENTS } from '@/lib/config';

const S = {
  card: { background: 'var(--navy-card)', border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' } as React.CSSProperties,
  th: { padding: '0.75rem 1rem', textAlign: 'left' as const, fontSize: '0.7rem', fontWeight: 700, color: 'var(--copper)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)' },
  td: { padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--offwhite)', borderBottom: '1px solid rgba(176,138,106,0.1)' },
  sel: { width: '100%', padding: '0.375rem 0.625rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--offwhite)' } as React.CSSProperties,
};

const INDUSTRY_OPTIONS = Object.entries(INDUSTRY_SEGMENTS).map(([code, { label }]) => ({ value: code, label }));

const SUBSCRIPTION_OPTIONS = [
  { value: 'advisory', label: 'Advisory' },
  { value: 'tool_only', label: 'Tool Only' },
];

interface CustomerTabProps {
  customers: Customer[];
  onUpdate: () => Promise<void>;
  onUpdateCustomer: (customerId: string, updates: Record<string, any>) => Promise<boolean>;
}

export default function CustomerTab({ customers, onUpdate, onUpdateCustomer }: CustomerTabProps) {
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [editingIndustry, setEditingIndustry] = useState<Record<string, string>>({});
  const [editingEinsatzlogik, setEditingEinsatzlogik] = useState<Record<string, string>>({});
  const [editingSubscription, setEditingSubscription] = useState<Record<string, string>>({});
  const [editingStatus, setEditingStatus] = useState<Record<string, boolean | undefined>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSave = async (customerId: string) => {
    const newIndustry = editingIndustry[customerId];
    const newEinsatzlogik = editingEinsatzlogik[customerId];
    const newSubscription = editingSubscription[customerId];
    const newStatus = editingStatus[customerId];

    if (!newIndustry && newEinsatzlogik === undefined && newSubscription === undefined && newStatus === undefined) return;

    setSaving(customerId);
    setLocalError(null);
    try {
      const updates: Record<string, any> = {};
      if (newIndustry) updates.industry_segment = newIndustry;
      // Send empty string instead of null to avoid "null" string in Apps Script
      if (newEinsatzlogik !== undefined) updates.einsatzlogik_segment = newEinsatzlogik || '';
      if (newSubscription) updates.subscription_type = newSubscription;
      if (newStatus !== undefined) updates.is_active = newStatus;

      const success = await onUpdateCustomer(customerId, updates);
      if (success) {
        // Clear editing state
        setEditingIndustry((prev) => { const n = { ...prev }; delete n[customerId]; return n; });
        setEditingEinsatzlogik((prev) => { const n = { ...prev }; delete n[customerId]; return n; });
        setEditingSubscription((prev) => { const n = { ...prev }; delete n[customerId]; return n; });
        setEditingStatus((prev) => { const n = { ...prev }; delete n[customerId]; return n; });
        setSuccessMsg(`${customerId} gespeichert`);
        setTimeout(() => setSuccessMsg(null), 2000);
      } else {
        setLocalError('Speichern fehlgeschlagen — bitte erneut versuchen');
      }
    } catch (err: any) {
      setLocalError(err.message || 'Fehler beim Speichern');
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (customerId: string) => {
    if (!window.confirm(`Möchten Sie den Mandanten "${customerId}" wirklich deaktivieren?`)) return;
    setDeleting(customerId);
    setLocalError(null);
    try {
      const success = await onUpdateCustomer(customerId, { is_active: false });
      if (success) {
        setSuccessMsg(`${customerId} deaktiviert`);
        setTimeout(() => setSuccessMsg(null), 2000);
      }
    } catch (err: any) {
      setLocalError(err.message || 'Fehler beim Deaktivieren');
    } finally {
      setDeleting(null);
    }
  };

  const hasChanges = (customerId: string, customer: Customer) => {
    return (editingIndustry[customerId] && editingIndustry[customerId] !== customer.industry_segment) ||
           (editingEinsatzlogik[customerId] !== undefined && editingEinsatzlogik[customerId] !== (customer.einsatzlogik_segment || '')) ||
           (editingSubscription[customerId] && editingSubscription[customerId] !== (customer.subscription_type || '')) ||
           (editingStatus[customerId] !== undefined && editingStatus[customerId] !== customer.is_active);
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
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={S.th}>Mandanten-ID</th>
              <th style={S.th}>Branche</th>
              <th style={S.th}>Einsatzlogik</th>
              <th style={S.th}>Dienstleistung</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const currentIndustry = editingIndustry[c.customer_id] || c.industry_segment || '';
              const einsatzlogikOptions = getEinsatzlogikOptionsForIndustry(currentIndustry);
              const isActive = editingStatus[c.customer_id] !== undefined ? editingStatus[c.customer_id]! : c.is_active;
              const isSaving = saving === c.customer_id;

              return (
                <tr key={c.customer_id}>
                  <td style={S.td}>
                    <strong>{c.customer_id}</strong>
                  </td>
                  <td style={{ ...S.td, paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                    <select
                      value={currentIndustry}
                      onChange={(e) => {
                        setEditingIndustry({ ...editingIndustry, [c.customer_id]: e.target.value });
                        // Reset einsatzlogik when industry changes
                        setEditingEinsatzlogik({ ...editingEinsatzlogik, [c.customer_id]: '' });
                      }}
                      style={S.sel}
                    >
                      <option value="">– Auswählen –</option>
                      {INDUSTRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td style={{ ...S.td, paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                    <select
                      value={editingEinsatzlogik[c.customer_id] !== undefined ? editingEinsatzlogik[c.customer_id] : (c.einsatzlogik_segment || '')}
                      onChange={(e) => setEditingEinsatzlogik({ ...editingEinsatzlogik, [c.customer_id]: e.target.value })}
                      disabled={!einsatzlogikOptions.length}
                      style={{ ...S.sel, opacity: einsatzlogikOptions.length ? 1 : 0.5 }}
                    >
                      <option value="">– Auswählen –</option>
                      {einsatzlogikOptions.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                    </select>
                  </td>
                  <td style={{ ...S.td, paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                    <select
                      value={editingSubscription[c.customer_id] || c.subscription_type || ''}
                      onChange={(e) => setEditingSubscription({ ...editingSubscription, [c.customer_id]: e.target.value })}
                      style={S.sel}
                    >
                      <option value="">– Auswählen –</option>
                      {SUBSCRIPTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td style={S.td}>
                    <button
                      onClick={() => setEditingStatus({ ...editingStatus, [c.customer_id]: !isActive })}
                      style={{
                        display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                        background: isActive ? 'rgba(16,185,129,0.15)' : 'rgba(156,163,175,0.15)',
                        color: isActive ? '#10b981' : '#9CA3AF',
                        border: `1px solid ${isActive ? 'rgba(16,185,129,0.3)' : 'rgba(156,163,175,0.3)'}`,
                        cursor: 'pointer',
                      }}
                    >
                      {isActive ? 'Aktiv' : 'Inaktiv'}
                    </button>
                  </td>
                  <td style={{ ...S.td, paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {hasChanges(c.customer_id, c) ? (
                        <button
                          onClick={() => handleSave(c.customer_id)}
                          disabled={isSaving}
                          style={{ padding: '0.35rem 0.85rem', background: 'var(--copper)', color: 'var(--navy)', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', opacity: isSaving ? 0.6 : 1 }}
                        >
                          {isSaving ? 'Speichern…' : 'Speichern'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDelete(c.customer_id)}
                          disabled={deleting === c.customer_id}
                          style={{ padding: '0.35rem 0.65rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', opacity: deleting === c.customer_id ? 0.6 : 1 }}
                        >
                          {deleting === c.customer_id ? 'Deaktivieren…' : 'Deaktivieren'}
                        </button>
                      )}
                    </div>
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
