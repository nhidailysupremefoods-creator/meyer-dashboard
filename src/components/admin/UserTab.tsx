'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Customer } from '@/types';

const S = {
  card: { background: 'var(--navy-card)', border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' } as React.CSSProperties,
  th: { padding: '0.75rem 1rem', textAlign: 'left' as const, fontSize: '0.7rem', fontWeight: 700, color: 'var(--copper)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)' },
  td: { padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--offwhite)', borderBottom: '1px solid rgba(176,138,106,0.1)' },
  sel: { width: '100%', padding: '0.375rem 0.625rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--offwhite)' } as React.CSSProperties,
};

const ROLE_INFO: Record<string, { label: string; desc: string }> = {
  admin:    { label: 'Admin',      desc: 'Vollzugriff auf Dashboard und Admin-Bereich' },
  customer: { label: 'Kunde',      desc: 'Kann eigene Mandanten-Daten sehen und bearbeiten' },
  viewer:   { label: 'Betrachter', desc: 'Schreibgeschützter Lesezugriff' },
};

interface UserTabProps {
  users: User[];
  customers: Customer[];
  onUpdate: () => Promise<void>;
  onUpdateUser: (email: string, updates: Record<string, any>) => Promise<boolean>;
}

export default function UserTab({ users, customers, onUpdate, onUpdateUser }: UserTabProps) {
  const [saving, setSaving] = useState<string | null>(null);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<Record<string, string>>({});
  const [editingCustomer, setEditingCustomer] = useState<Record<string, string>>({});
  const [editingStatus, setEditingStatus] = useState<Record<string, boolean | undefined>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Track which users have been saved — their editing state is kept until
  // the server data (users prop) catches up with the saved values.
  const savedValues = useRef<Record<string, { role?: string; customer_id?: string; is_active?: boolean }>>({});

  // When users prop updates (background refresh), clear editing state for
  // users whose server data now matches the saved values.
  useEffect(() => {
    const saved = savedValues.current;
    if (Object.keys(saved).length === 0) return;

    const toDelete: string[] = [];
    for (const [email, vals] of Object.entries(saved)) {
      const serverUser = users.find((u) => u.email === email);
      if (!serverUser) continue;

      const roleMatch = !vals.role || serverUser.role === vals.role;
      const custMatch = !vals.customer_id || serverUser.customer_id === vals.customer_id;
      const statusMatch = vals.is_active === undefined || serverUser.is_active === vals.is_active;

      if (roleMatch && custMatch && statusMatch) {
        toDelete.push(email);
      }
    }

    if (toDelete.length > 0) {
      toDelete.forEach((email) => delete saved[email]);
      setEditingRole((prev) => {
        const n = { ...prev };
        toDelete.forEach((e) => delete n[e]);
        return n;
      });
      setEditingCustomer((prev) => {
        const n = { ...prev };
        toDelete.forEach((e) => delete n[e]);
        return n;
      });
      setEditingStatus((prev) => {
        const n = { ...prev };
        toDelete.forEach((e) => delete n[e]);
        return n;
      });
    }
  }, [users]);

  const handleSave = async (email: string) => {
    const newRole = editingRole[email];
    const newCustomer = editingCustomer[email];
    const newStatus = editingStatus[email];
    const user = users.find((u) => u.email === email);

    const updates: Record<string, any> = {};
    if (newRole && newRole !== user?.role) updates.role = newRole;
    if (newCustomer && newCustomer !== user?.customer_id) updates.customer_id = newCustomer;
    if (newStatus !== undefined && newStatus !== user?.is_active) updates.is_active = newStatus;

    if (Object.keys(updates).length === 0) return;

    // Apps Script requires customer_id to always be present
    if (!updates.customer_id) {
      updates.customer_id = user?.customer_id || '__GLOBAL__';
    }

    setSaving(email);
    setLocalError(null);
    try {
      const ok = await onUpdateUser(email, updates);
      if (ok) {
        // Keep editing state — don't clear it yet!
        // Instead, track what we saved so the useEffect above can clear
        // once the server data catches up (background refresh).
        savedValues.current[email] = {
          role: newRole || user?.role,
          customer_id: newCustomer || user?.customer_id,
          is_active: newStatus !== undefined ? newStatus : user?.is_active,
        };
        setSuccessMsg(`${email} gespeichert`);
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

  const handleDelete = async (email: string) => {
    if (!window.confirm(`Möchten Sie den Benutzer ${email} wirklich deaktivieren?`)) return;
    const user = users.find((u) => u.email === email);
    setDeletingEmail(email);
    setLocalError(null);
    try {
      const success = await onUpdateUser(email, { is_active: false, customer_id: user?.customer_id || '__GLOBAL__' });
      if (success) {
        setSuccessMsg(`${email} deaktiviert`);
        setTimeout(() => setSuccessMsg(null), 2000);
      }
    } catch (err: any) {
      setLocalError(err.message || 'Fehler beim Deaktivieren');
    } finally {
      setDeletingEmail(null);
    }
  };

  const hasChanges = (email: string) => {
    // If this user was just saved, don't show "Speichern" button
    // (editing state is kept only to prevent dropdown from snapping back)
    if (savedValues.current[email]) return false;

    const user = users.find((u) => u.email === email);
    return (editingRole[email] && editingRole[email] !== user?.role) ||
           (editingCustomer[email] && editingCustomer[email] !== user?.customer_id) ||
           (editingStatus[email] !== undefined && editingStatus[email] !== user?.is_active);
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

      {/* Role explanation */}
      <div style={{ padding: '0.75rem 1rem', background: 'rgba(176,138,106,0.06)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        {Object.entries(ROLE_INFO).map(([key, { label, desc }]) => (
          <div key={key} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--copper)' }}>{label}:</strong> {desc}
          </div>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={S.th}>E-Mail</th>
              <th style={S.th}>Rolle</th>
              <th style={S.th}>Mandant</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isActive = editingStatus[user.email] !== undefined ? editingStatus[user.email]! : user.is_active;
              return (
                <tr key={user.email}>
                  <td style={S.td}><strong style={{ fontWeight: 500 }}>{user.email}</strong></td>
                  <td style={{ ...S.td, paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                    <select
                      style={S.sel}
                      value={editingRole[user.email] || user.role || 'customer'}
                      onChange={(e) => setEditingRole({ ...editingRole, [user.email]: e.target.value })}
                    >
                      {Object.entries(ROLE_INFO).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ ...S.td, paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                    <select style={S.sel} value={editingCustomer[user.email] || user.customer_id || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, [user.email]: e.target.value })}>
                      <option value="__GLOBAL__">-- Global (alle) --</option>
                      {customers.map((c) => <option key={c.customer_id} value={c.customer_id}>{c.name || c.customer_id}</option>)}
                    </select>
                  </td>
                  <td style={S.td}>
                    <button
                      onClick={() => setEditingStatus({ ...editingStatus, [user.email]: !isActive })}
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
                      {hasChanges(user.email) ? (
                        <button
                          onClick={() => handleSave(user.email)}
                          disabled={saving === user.email}
                          style={{ padding: '0.35rem 0.85rem', background: 'var(--copper)', color: 'var(--navy)', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', opacity: saving === user.email ? 0.6 : 1 }}
                        >
                          {saving === user.email ? 'Speichern…' : 'Speichern'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDelete(user.email)}
                          disabled={deletingEmail === user.email}
                          style={{ padding: '0.35rem 0.65rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', opacity: deletingEmail === user.email ? 0.6 : 1 }}
                        >
                          {deletingEmail === user.email ? 'Deaktivieren…' : 'Deaktivieren'}
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
      {users.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Keine Benutzer vorhanden</div>}
    </div>
  );
}
