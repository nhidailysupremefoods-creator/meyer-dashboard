'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface LeitfadenTabProps {
  customers: Array<{ customer_id: string; name?: string; display_name?: string }>;
}

const fmtEur = (n: any) =>
  n != null
    ? new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(Number(n))
    : '–';

function ScoreBar({ label, value, max = 25 }: { label: string; value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 60 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value}/{max}</span>
      </div>
      <div style={{ height: 10, borderRadius: 6, backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 6, transition: 'width 0.7s' }} />
      </div>
    </div>
  );
}

/**
 * Normalize the advisory/leitfaden response from Apps Script.
 * Handles all known field name variants from _buildLeitfadenFallback / _buildAdvisoryFallback.
 */
function normalizeAdvisory(raw: any) {
  // The data might be nested under various keys
  const d = raw?.advisory || raw?.leitfaden || raw?.data || raw || {};

  const situation = d.situation || d.gesamtsituation || '';
  const analyse = d.analyse || d.analyseergebnisse || d.kostenAnalyse || '';
  const scores = d.scores || d.score_dimensionen || {};
  const totalScore = Number(scores.total || scores.gesamt || 0);
  const massnahmen = d.massnahmen || d.ausgewaehlte_massnahmen || [];
  const handlungsfelder = d.handlungsfelder || [];
  const highlights = d.highlights || [];
  const callAgenda = d.call_agenda || d.management_call || d.gespraechshinweis || '';
  const naechsteSchritte = d.naechste_schritte || d.next_steps || {};
  const schwaechsteDimension = d.schwaechste_dimension || '';
  const leitfadenHtml = d.leitfaden_html || d.html || '';

  return {
    situation,
    analyse,
    scores,
    totalScore,
    massnahmen,
    handlungsfelder,
    highlights,
    callAgenda,
    naechsteSchritte,
    schwaechsteDimension,
    leitfadenHtml,
    hasContent: !!(situation || analyse || totalScore > 0 || massnahmen.length > 0 || highlights.length > 0 || leitfadenHtml),
  };
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

      if (data.error && !data.success) {
        setError(data.error || 'Leitfaden konnte nicht generiert werden');
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(err.message || 'Fehler beim Generieren des Leitfadens');
    } finally {
      setLoading(false);
    }
  };

  // Generate period options (last 14 months)
  const periodOptions: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const shortMonths = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    periodOptions.push({
      value: `${y}_${m}`,
      label: `${shortMonths[d.getMonth()]} ${String(y).slice(-2)}`,
    });
  }

  const advisory = result ? normalizeAdvisory(result) : null;

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
              <option value="">– Mandant auswählen –</option>
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
              <option value="">– Periode auswählen –</option>
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
            {loading ? 'Generiere…' : 'Leitfaden generieren'}
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
          <p style={{ color: 'var(--text-secondary)' }}>Leitfaden wird generiert…</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', opacity: 0.7 }}>
            Dies kann bis zu 30 Sekunden dauern
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Result */}
      {advisory && advisory.hasContent && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Header */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '1.1rem', color: 'var(--offwhite)' }}>
                  Gesprächsleitfaden
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  {selectedCustomer.replace(/_/g, ' ')} — {selectedPeriod.replace(/_/g, '/')}
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

          {/* If raw HTML was returned, render it */}
          {advisory.leitfadenHtml && (
            <div className="card">
              <div
                style={{ fontSize: '0.875rem', color: 'var(--offwhite)', lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: advisory.leitfadenHtml }}
              />
            </div>
          )}

          {/* Gesamtsituation */}
          {advisory.situation && (
            <div className="card" style={{ borderLeft: '4px solid var(--copper)' }}>
              <h4 style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--copper)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                Gesamtsituation
              </h4>
              <div style={{ fontSize: '0.875rem', color: 'var(--offwhite)', whiteSpace: 'pre-line', lineHeight: 1.7 }}>
                {advisory.situation}
              </div>
            </div>
          )}

          {/* Highlights / Wichtige Erkenntnisse */}
          {advisory.highlights.length > 0 && (
            <div className="card">
              <h4 style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--copper)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                Wichtige Erkenntnisse
              </h4>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {advisory.highlights.map((h: string, i: number) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--offwhite)' }}>
                    <span style={{ color: 'var(--copper)', marginTop: 2 }}>•</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Score-Dimensionen */}
          {advisory.totalScore > 0 && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--copper)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Finanzstabilitäts-Score
                </h4>
                <div style={{
                  fontSize: '1.5rem', fontWeight: 800, padding: '0.25rem 0.75rem', borderRadius: 10,
                  color: advisory.totalScore >= 60 ? '#10b981' : advisory.totalScore >= 40 ? '#f59e0b' : '#ef4444',
                  backgroundColor: advisory.totalScore >= 60 ? 'rgba(16,185,129,0.12)' : advisory.totalScore >= 40 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                }}>
                  {advisory.totalScore}/100
                </div>
              </div>
              <ScoreBar label="Leistung (Marge & Ertrag)" value={Number(advisory.scores.performance || advisory.scores.leistung || 0)} />
              <ScoreBar label="Struktur (Liquidität)" value={Number(advisory.scores.structure || advisory.scores.struktur || 0)} />
              <ScoreBar label="Trend (Entwicklung)" value={Number(advisory.scores.trend || 0)} />
              <ScoreBar label="Stabilität" value={Number(advisory.scores.stability || advisory.scores.stabilitaet || 0)} />
              {advisory.schwaechsteDimension && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: 8, backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: '0.85rem' }}>
                  <strong>Größter Hebel:</strong> {advisory.schwaechsteDimension}
                </div>
              )}
            </div>
          )}

          {/* Analyseergebnisse */}
          {advisory.analyse && (
            <div className="card">
              <h4 style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--copper)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                Analyseergebnisse
              </h4>
              <div style={{ fontSize: '0.875rem', color: 'var(--offwhite)', whiteSpace: 'pre-line', lineHeight: 1.7 }}>
                {advisory.analyse}
              </div>
            </div>
          )}

          {/* Prioritäre Maßnahmen */}
          {advisory.massnahmen.length > 0 && (
            <div className="card">
              <h4 style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--copper)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
                Prioritäre Maßnahmen
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {advisory.massnahmen.map((m: any, i: number) => (
                  <div
                    key={i}
                    style={{ padding: '1rem', borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flex: 1 }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'var(--copper)', color: 'var(--navy)', flexShrink: 0,
                        }}>
                          {i + 1}
                        </span>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--offwhite)' }}>
                            {m.label || m.action_label || m.titel || m.contract_name || `Maßnahme ${i + 1}`}
                          </span>
                          {(m.beschreibung || m.description) && (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                              {m.beschreibung || m.description}
                            </p>
                          )}
                        </div>
                      </div>
                      {(m.impact_eur || m.ebit_potential_eur) != null && (
                        <div style={{ fontWeight: 700, color: '#10b981', flexShrink: 0 }}>
                          +{fmtEur(m.impact_eur || m.ebit_potential_eur)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Handlungsfelder */}
          {advisory.handlungsfelder.length > 0 && (
            <div className="card">
              <h4 style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--copper)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                Handlungsfelder
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {advisory.handlungsfelder.map((h: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.875rem', padding: '0.5rem 0' }}>
                    <span style={{ fontSize: '1rem' }}>{h.icon || '▸'}</span>
                    <div>
                      <span style={{ fontWeight: 500, color: 'var(--offwhite)' }}>{typeof h === 'string' ? h : h.label || h.titel}</span>
                      {h.beschreibung && (
                        <p style={{ fontSize: '0.75rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>{h.beschreibung}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nächste Schritte */}
          {(advisory.naechsteSchritte.sofort || advisory.naechsteSchritte.kurzfristig || advisory.naechsteSchritte.mittelfristig) && (
            <div className="card">
              <h4 style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--copper)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
                Nächste Schritte
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {advisory.naechsteSchritte.sofort && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#10b981' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--offwhite)' }}>Sofort (0–7 Tage)</span>
                    </div>
                    <div style={{ marginLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {renderSteps(advisory.naechsteSchritte.sofort)}
                    </div>
                  </div>
                )}
                {advisory.naechsteSchritte.kurzfristig && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--offwhite)' }}>Kurzfristig (1–4 Wochen)</span>
                    </div>
                    <div style={{ marginLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {renderSteps(advisory.naechsteSchritte.kurzfristig)}
                    </div>
                  </div>
                )}
                {advisory.naechsteSchritte.mittelfristig && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#f97316' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--offwhite)' }}>Mittelfristig (1–3 Monate)</span>
                    </div>
                    <div style={{ marginLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {renderSteps(advisory.naechsteSchritte.mittelfristig)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Management-Call-Agenda */}
          {advisory.callAgenda && (
            <div className="card" style={{ borderLeft: '4px solid var(--copper)' }}>
              <h4 style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--copper)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                Management-Call Agenda
              </h4>
              <div style={{ fontSize: '0.875rem', color: 'var(--offwhite)', whiteSpace: 'pre-line', lineHeight: 1.7 }}>
                {advisory.callAgenda}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Result came back but no content recognized */}
      {advisory && !advisory.hasContent && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠️</div>
          <p style={{ fontSize: '0.875rem', color: 'var(--offwhite)', fontWeight: 500 }}>
            Leitfaden wurde generiert, aber keine Daten erkannt.
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Möglicherweise sind für diese Periode keine Finanzdaten vorhanden.
          </p>
          {/* Debug: show raw response */}
          <details style={{ marginTop: '1rem', textAlign: 'left' }}>
            <summary style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              API-Antwort anzeigen
            </summary>
            <pre style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: 6, maxHeight: 300, overflow: 'auto' }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* Info Box (initial state) */}
      {!result && !loading && !error && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📋</div>
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

/** Render step items — handles arrays of strings, single strings, or objects */
function renderSteps(steps: any) {
  if (Array.isArray(steps)) {
    return steps.map((s: any, i: number) => (
      <p key={i} style={{ marginBottom: '0.35rem' }}>
        • {typeof s === 'string' ? s : s.label || s.text || s.action || JSON.stringify(s)}
      </p>
    ));
  }
  if (typeof steps === 'string') {
    return <div style={{ whiteSpace: 'pre-line' }}>{steps}</div>;
  }
  return <div>{JSON.stringify(steps)}</div>;
}
