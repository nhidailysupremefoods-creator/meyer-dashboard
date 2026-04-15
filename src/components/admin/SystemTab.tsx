'use client';

import { useState, useEffect } from 'react';
import { HealthCheckResponse } from '@/types';

const S = {
  card: { background: 'var(--navy-card)', border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' } as React.CSSProperties,
  sectionTitle: { padding: '0.875rem 1rem', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--copper)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  row: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', borderBottom: '1px solid rgba(176,138,106,0.1)' },
};

interface SystemTabProps {
  onUpdate: () => Promise<void>;
  onCheckHealth: () => Promise<HealthCheckResponse | null>;
  onClearCache: () => Promise<boolean>;
  onTriggerRebuild: () => Promise<boolean>;
}

export default function SystemTab({ onUpdate, onCheckHealth, onClearCache, onTriggerRebuild }: SystemTabProps) {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  const loadHealth = async () => {
    setHealthLoading(true);
    setLocalError(null);
    try {
      const result = await onCheckHealth();
      setHealth(result);
      if (!result) setLocalError('Health-Check konnte nicht geladen werden');
    } catch (err: any) {
      setLocalError(err.message || 'Health-Check fehlgeschlagen');
    } finally {
      setHealthLoading(false);
    }
  };

  const handleClearCache = async () => {
    if (!window.confirm('Möchten Sie den Cache wirklich löschen?')) return;
    setClearing(true);
    setLocalError(null);
    try {
      const success = await onClearCache();
      if (success) {
        setMessages((m) => ({ ...m, cache: 'Cache geleert ✓' }));
        setTimeout(() => setMessages((m) => { const n = { ...m }; delete n.cache; return n; }), 3000);
        await loadHealth();
      } else {
        setLocalError('Cache-Löschung fehlgeschlagen');
      }
    } catch (err: any) {
      setLocalError(err.message || 'Fehler beim Löschen');
    } finally {
      setClearing(false);
    }
  };

  const handleRebuild = async () => {
    if (!window.confirm('Möchten Sie die Advisory-Tabelle wirklich neu aufbauen? Dies kann bis zu 60 Sekunden dauern.')) return;
    setRebuilding(true);
    setLocalError(null);
    try {
      const success = await onTriggerRebuild();
      if (success) {
        setMessages((m) => ({ ...m, rebuild: 'Advisory-Tabelle neu aufgebaut ✓' }));
        setTimeout(() => setMessages((m) => { const n = { ...m }; delete n.rebuild; return n; }), 5000);
        await loadHealth();
        await onUpdate();
      } else {
        setLocalError('Rebuild fehlgeschlagen');
      }
    } catch (err: any) {
      setLocalError(err.message || 'Fehler beim Rebuild');
    } finally {
      setRebuilding(false);
    }
  };

  useEffect(() => { loadHealth(); }, []);

  const getStatusDot = (status: string | number | undefined) => {
    const s = String(status || '').toLowerCase();
    if (s === 'ok' || s === 'healthy' || s.includes('ok')) return '#10b981';
    if (s === 'warn' || s === 'warning') return '#F59E0B';
    if (typeof status === 'number') return '#60A5FA'; // numeric values are informational
    return '#ef4444';
  };

  const healthChecks = health?.status ? [
    { key: 'bigquery',        label: 'BigQuery-Verbindung',  value: health.status.bigquery || '–',         dot: getStatusDot(health.status.bigquery) },
    { key: 'finance_table',   label: 'Finance-Tabelle',      value: health.status.finance_table || '–',    dot: getStatusDot(health.status.finance_table) },
    { key: 'reporting_views', label: 'Reporting-Views',      value: health.status.reporting_views || '–',  dot: getStatusDot(health.status.reporting_views) },
    { key: 'cache',           label: 'Cache',                value: health.status.cache || '–',            dot: getStatusDot(health.status.cache) },
    { key: 'customers',       label: 'Aktive Mandanten',     value: String(health.status.customers ?? '–'), dot: '#60A5FA' },
    { key: 'version',         label: 'Dashboard-Version',   value: health.status.dashboard_version || '–', dot: '#A78BFA' },
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {localError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '3px solid #ef4444', padding: '0.75rem 1rem', color: '#ef4444', fontSize: '0.875rem', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{localError}</span>
          <button onClick={() => setLocalError(null)} style={{ color: '#ef4444', background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer' }}>&times;</button>
        </div>
      )}

      {/* Health Check */}
      <div style={S.card}>
        <div style={S.sectionTitle}>
          <span>System-Health</span>
          <button
            onClick={loadHealth}
            disabled={healthLoading}
            style={{ padding: '0.25rem 0.65rem', background: 'rgba(176,138,106,0.1)', border: '1px solid rgba(176,138,106,0.25)', borderRadius: 6, color: 'var(--copper)', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Manrope, sans-serif', opacity: healthLoading ? 0.6 : 1, cursor: 'pointer' }}
          >
            {healthLoading ? '↻ Laden…' : '↻ Aktualisieren'}
          </button>
        </div>

        {healthLoading && !health ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Health Check lädt…
          </div>
        ) : healthChecks.length > 0 ? (
          <div>
            {healthChecks.map((check, i) => (
              <div key={check.key} style={{ ...S.row, borderBottom: i < healthChecks.length - 1 ? '1px solid rgba(176,138,106,0.1)' : 'none' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: check.dot, flexShrink: 0, display: 'inline-block' }} />
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--offwhite)' }}>{check.label}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 1 }}>{check.value}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {localError ? 'Health-Check fehlgeschlagen' : 'Klicken Sie auf "Aktualisieren" um den Systemstatus zu laden'}
          </div>
        )}
      </div>

      {/* Action Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
        {/* Clear Cache */}
        <div style={S.card}>
          <div style={{ ...S.sectionTitle, display: 'block' }}>Cache leeren</div>
          <div style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.875rem' }}>
              Löscht alle gecachten Daten und zwingt ein erneutes Laden aus der Datenbank.
            </p>
            {messages.cache ? (
              <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 6, color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>
                {messages.cache}
              </div>
            ) : (
              <button
                onClick={handleClearCache}
                disabled={clearing}
                style={{ width: '100%', padding: '0.5rem', background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 6, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', opacity: clearing ? 0.6 : 1, fontFamily: 'Manrope, sans-serif' }}
              >
                {clearing ? 'Wird geleert…' : 'Cache leeren'}
              </button>
            )}
          </div>
        </div>

        {/* Advisory Rebuild */}
        <div style={S.card}>
          <div style={{ ...S.sectionTitle, display: 'block' }}>Advisory neu aufbauen</div>
          <div style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.875rem' }}>
              Erstellt die finance_monthly_base Tabelle aus den rohen Daten neu.
            </p>
            {messages.rebuild ? (
              <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 6, color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>
                {messages.rebuild}
              </div>
            ) : (
              <button
                onClick={handleRebuild}
                disabled={rebuilding}
                style={{ width: '100%', padding: '0.5rem', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', opacity: rebuilding ? 0.6 : 1, fontFamily: 'Manrope, sans-serif' }}
              >
                {rebuilding ? 'Wird aufgebaut… (bis zu 60s)' : 'Advisory Rebuild'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div style={{ background: 'rgba(176,138,106,0.06)', border: '1px solid rgba(176,138,106,0.2)', borderRadius: 10, padding: '1rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--copper)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Hinweise</div>
        <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '1rem', margin: 0 }}>
          <li>Cache-Leerung kann einige Sekunden dauern</li>
          <li style={{ marginTop: '0.25rem' }}>Advisory-Rebuild sollte nur bei fehlenden Daten durchgeführt werden</li>
          <li style={{ marginTop: '0.25rem' }}>Alle Statuswerte werden live aus BigQuery abgefragt</li>
        </ul>
      </div>
    </div>
  );
}
