'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface LeitfadenTabProps {
  customers: Array<{ customer_id: string; name?: string; display_name?: string }>;
}

export default function LeitfadenTab({ customers }: LeitfadenTabProps) {
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!selectedCustomer || !selectedPeriod) {
      setError('Bitte Mandant und Periode auswählen');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = api.getToken();
      if (!token) throw new Error('Nicht eingeloggt');

      const params = new URLSearchParams({
        token,
        customer: selectedCustomer,
        period: selectedPeriod,
      });
      const res = await fetch(`/api/admin/leitfaden?${params}`);
      const data = await res.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Leitfaden konnte nicht generiert werden');
      }
    } catch (err: any) {
      setError(err.message || 'Fehler beim Generieren des Leitfadens');
    } finally {
      setLoading(false);
    }
  };

  // Generate period options (last 12 months)
  const periodOptions: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const shortMonths = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    periodOptions.push({
      value: `${y}_${m}`,
      label: `${shortMonths[d.getMonth()]} ${String(y).slice(-2)}`,
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Generator Controls */}
      <div className="card">
        <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '1.1rem', color: 'var(--offwhite)', marginBottom: '0.75rem' }}>
          Gesprächsleitfaden generieren
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Der Gesprächsleitfaden wird automatisch aus den aktuellen KPI-Daten generiert
          und enthält eine Situationsanalyse, Score-Bewertung und konkrete Handlungsempfehlungen.
        </p>
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '3px solid #ef4444', padding: '0.75rem 1rem', color: '#ef4444', fontSize: '0.875rem', borderRadius: 6, marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{
              display: 'block', fontSize: '0.7rem', fontWeight: 600,
              color: 'var(--text-secondary)', textTransform: 'uppercase',
              letterSpacing: '0.06em', marginBottom: '0.5rem',
            }}>
              Mandant
            </label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
            >
              <option value="">-- Mandant auswählen --</option>
              {customers.map((c) => (
                <option key={c.customer_id} value={c.customer_id}>
                  {(c.name || c.display_name || c.customer_id).replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{
              display: 'block', fontSize: '0.7rem', fontWeight: 600,
              color: 'var(--text-secondary)', textTransform: 'uppercase',
              letterSpacing: '0.06em', marginBottom: '0.5rem',
            }}>
              Berichtsperiode
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              <option value="">-- Periode auswählen --</option>
              {periodOptions.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !selectedCustomer || !selectedPeriod}
            className="btn-primary"
            style={{ whiteSpace: 'nowrap' }}
          >
            {loading ? 'Generiere...' : 'Leitfaden generieren'}
          </button>
        </div>
      </div>


      {/* Loading */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{
            width: 40, height: 40,
            border: '3px solid rgba(176,138,106,0.2)',
            borderTopColor: 'var(--copper)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1rem',
          }} />
          <p style={{ color: 'var(--text-secondary)' }}>Leitfaden wird generiert...</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', opacity: 0.7 }}>
            Dies kann bis zu 30 Sekunden dauern
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="card" style={{ padding: 0 }}>
          {/* Header */}
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '1.1rem', color: 'var(--offwhite)' }}>
                  Gesprächsleitfaden
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  {selectedCustomer.replace(/_/g, ' ')} — {selectedPeriod.replace(/_/g, '/')}
                </p>
              </div>
              <button
                onClick={() => window.print()}
                className="btn-secondary"
                style={{ fontSize: '0.8rem' }}
              >
                Drucken / PDF
              </button>
            </div>
          </div>

          {/* Content Sections */}
          {result.situation && (
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--copper)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                Gesamtsituation
              </h4>
              <div style={{ fontSize: '0.875rem', color: 'var(--offwhite)', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                {result.situation}
              </div>
            </div>
          )}

          {result.analyse && (
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--copper)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                Analyse
              </h4>
              <div style={{ fontSize: '0.875rem', color: 'var(--offwhite)', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                {result.analyse}
              </div>
            </div>
          )}

          {result.highlights && result.highlights.length > 0 && (
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--copper)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                Kernpunkte
              </h4>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {result.highlights.map((h: string, i: number) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--offwhite)' }}>
                    <span style={{ color: 'var(--copper)', marginTop: 2 }}>—¢</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.call_agenda && (
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--copper)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                Call-Agenda
              </h4>
              <div style={{ fontSize: '0.875rem', color: 'var(--offwhite)', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                {result.call_agenda}
              </div>
            </div>
          )}

          {result.naechste_schritte && (
            <div style={{ padding: '1.25rem' }}>
              <h4 style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--copper)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                Nächste Schritte
              </h4>
              <div style={{ fontSize: '0.875rem', color: 'var(--offwhite)', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                {typeof result.naechste_schritte === 'string'
                  ? result.naechste_schritte
                  : JSON.stringify(result.naechste_schritte, null, 2)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      {!result && !loading && !error && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>ð</div>
          <p style={{ fontSize: '0.875rem', color: 'var(--offwhite)', fontWeight: 500 }}>
            Wählen Sie einen Mandanten und eine Periode aus, um den Gesprächsleitfaden zu generieren.
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Der Leitfaden enthält Situationsanalyse, Score-Dimensionen, Maßnahmen und Gesprächshinweise.
          </p>
        </div>
      )}
    </div>
  );
}
