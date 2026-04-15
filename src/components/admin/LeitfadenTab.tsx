'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface LeitfadenTabProps {
  customers: Array<{ customer_id: string; name?: string; display_name?: string }>;
}

/**
 * Client-side Leitfaden generator — fallback when Apps Script _buildLeitfadenFallback fails.
 * Fetches page1 + page4 data directly and builds advisory content locally.
 */
async function generateLeitfadenClientSide(customer: string, period: string): Promise<any> {
  // Fetch page1 and page4 data in parallel
  const [p1, p4] = await Promise.all([
    api.fetchPageData(1, customer, period).catch(() => null),
    api.fetchPageData(4, customer, period).catch(() => null),
  ]);

  const d1 = p1?.data || p1 || {};
  const d4 = p4?.data || p4 || {};

  // Extract KPIs from page1
  const revenue = Number(d1.revenue || 0);
  const profit = Number(d1.profit || d1.ebit || 0);
  const marginPct = Number(d1.margin_pct || (revenue > 0 ? profit / revenue : 0));
  const costTotal = Number(d1.cost || d1.cost_total || 0);
  const costVariable = Number(d1.cost_variable || d1.payroll_cost || 0);
  const bankBalance = Number(d1.bank_balance_eur || 0);
  const liquidityMonths = Number(d1.liquidity_months || 0);
  const revMom = Number(d1.revenue_mom_pct || 0);
  const profitMom = Number(d1.profit_mom_pct || 0);
  const statusColor = String(d1.status_color || 'YELLOW');

  // Compute cost MoM safely (revenue_mom - profit_mom = implied cost pressure)
  const costMomReal = revMom - profitMom;
  const costAbs = Math.abs(costTotal);
  const payrollQuote = revenue > 0 ? costVariable / revenue : 0;

  // Actions from page4
  const actions: any[] = Array.isArray(d4.actions) ? d4.actions : [];
  const totalPotential = actions.reduce((s: number, a: any) =>
    s + Number(a.impact_eur || a.ebit_potential_eur || 0), 0);

  // Determine status
  const isKritisch = marginPct < 0.05 || statusColor === 'RED';
  const isWarnung = marginPct < 0.10 || statusColor === 'YELLOW';
  const statusLabel = isKritisch ? 'KRITISCH' : isWarnung ? 'WARNUNG' : 'STABIL';

  // Build scores
  const scoreLeistung = Math.min(25, Math.round(marginPct * 100));
  const scoreStruktur = Math.min(25, Math.round(Math.min(liquidityMonths / 3, 1) * 25));
  const scoreTrend = Math.min(25, profitMom > 0 ? Math.round(Math.min(profitMom * 100, 25)) : Math.max(0, Math.round(12 + profitMom * 100)));
  const scoreStabilitaet = statusColor === 'GREEN' ? 20 : statusColor === 'YELLOW' ? 12 : 5;
  const totalScore = scoreLeistung + scoreStruktur + scoreTrend + scoreStabilitaet;

  // Find weakest dimension
  const dims = [
    { name: 'Leistung (Marge & Ertrag)', score: scoreLeistung },
    { name: 'Struktur (Liquidität)', score: scoreStruktur },
    { name: 'Trend (Entwicklung)', score: scoreTrend },
    { name: 'Stabilität', score: scoreStabilitaet },
  ];
  const weakest = dims.reduce((a, b) => a.score < b.score ? a : b);

  // Format helpers
  const fmtE = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  const fmtP = (n: number) => `${(n * 100).toFixed(1)}%`;
  const sign = (n: number) => n >= 0 ? `+${fmtP(n)}` : fmtP(n);

  // Build situation text
  const situation = [
    `Status: ${statusLabel} — EBIT-Marge ${fmtP(marginPct)}, Gewinn ${fmtE(profit)}.`,
    revenue > 0 ? `Umsatz: ${fmtE(revenue)} (MoM: ${sign(revMom)}).` : '',
    costAbs > 0 ? `Gesamtkosten: ${fmtE(costAbs)}${costMomReal > 0.02 ? ' — Kostendruck erkennbar' : costMomReal < -0.02 ? ' — Kostenentlastung' : ''}.` : '',
    bankBalance > 0 ? `Bankbestand: ${fmtE(bankBalance)} (Reichweite: ${liquidityMonths.toFixed(1)} Monate).` : '',
    payrollQuote > 0 ? `Personalkostenquote: ${fmtP(payrollQuote)}.` : '',
  ].filter(Boolean).join('\n');

  // Cost analysis
  const analyse = costMomReal > 0.03
    ? `Die Kosten steigen stärker als der Umsatz (Kostendruck ${sign(costMomReal)}). Handlungsbedarf bei der Kostenstruktur.`
    : costMomReal < -0.03
    ? `Positive Entwicklung: Kosten sinken relativ zum Umsatz (Entlastung ${sign(costMomReal)}).`
    : `Kosten- und Umsatzentwicklung sind weitgehend ausgewogen.`;

  // Highlights
  const highlights: string[] = [];
  if (isKritisch) highlights.push(`EBIT-Marge mit ${fmtP(marginPct)} unter kritischer Schwelle`);
  if (liquidityMonths < 1.5) highlights.push(`Liquiditätsreichweite nur ${liquidityMonths.toFixed(1)} Monate — Engpass droht`);
  if (totalPotential > 0) highlights.push(`EBIT-Hebelpotenzial: ${fmtE(totalPotential)} identifiziert`);
  if (payrollQuote > 0.55) highlights.push(`Personalkostenquote ${fmtP(payrollQuote)} überschreitet Zielkorridor`);
  if (revMom < -0.05) highlights.push(`Umsatzrückgang ${sign(revMom)} — Vertragssituation prüfen`);
  if (profitMom > 0.05) highlights.push(`Gewinnentwicklung positiv (${sign(profitMom)})`);

  // Massnahmen from page4 actions
  const massnahmen = actions.slice(0, 5).map((a: any) => ({
    label: a.action_label || a.contract_name || a.label || 'Maßnahme',
    beschreibung: a.description || '',
    impact_eur: Number(a.impact_eur || a.ebit_potential_eur || 0),
  }));

  // Call agenda
  const callAgenda = isKritisch
    ? `KRITISCHER STATUS — Sofortige Maßnahmen besprechen:\n1. Liquiditätssicherung (${fmtE(bankBalance)} Bestand, ${liquidityMonths.toFixed(1)} Monate)\n2. Top-3 EBIT-Hebel priorisieren (Potenzial ${fmtE(totalPotential)})\n3. Kostenstruktur analysieren und Sofortmaßnahmen definieren`
    : isWarnung
    ? `WARNUNG — Fokus auf Verbesserung:\n1. EBIT-Marge von ${fmtP(marginPct)} Richtung Ziel 10% bringen\n2. Maßnahmenpool aktivieren (${actions.length} Hebel, ${fmtE(totalPotential)} Potenzial)\n3. Monatliche Fortschrittskontrolle vereinbaren`
    : `STABIL — Wachstum sichern:\n1. Benchmark-Performance beibehalten\n2. Weitere Optimierungshebel identifizieren\n3. Quartals-Review planen`;

  // Next steps
  const naechsteSchritte: any = {};
  if (isKritisch || liquidityMonths < 1.5) {
    naechsteSchritte.sofort = ['Liquiditätsplan erstellen', 'Zahlungsziele mit Lieferanten verlängern', 'Forderungsmanagement intensivieren'];
  }
  naechsteSchritte.kurzfristig = ['Top-3 Maßnahmen aus EBIT-Hebel-Pool starten', 'Kostenstruktur mit Verantwortlichen besprechen'];
  naechsteSchritte.mittelfristig = ['Monatliches KPI-Monitoring etablieren', 'Benchmark-Zielwerte je Quartal anpassen'];

  return {
    success: true,
    advisory: {
      situation,
      analyse,
      scores: {
        leistung: scoreLeistung,
        struktur: scoreStruktur,
        trend: scoreTrend,
        stabilitaet: scoreStabilitaet,
        total: totalScore,
      },
      massnahmen,
      highlights,
      gespraechshinweis: callAgenda,
      naechste_schritte: naechsteSchritte,
      schwaechste_dimension: `${weakest.name} (${weakest.score}/25) — hier liegt der größte Verbesserungshebel.`,
    },
    _generated: 'client-side-fallback',
  };
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

      // Try Apps Script first
      let data: any = null;
      try {
        const params = new URLSearchParams({
          token,
          customer: selectedCustomer,
          period: selectedPeriod,
        });
        const res = await fetch(`/api/admin/leitfaden?${params}`);
        data = await res.json();
      } catch {
        data = null;
      }

      // If Apps Script failed (e.g. "costMom is not defined"), use client-side fallback
      if (!data || (data.error && !data.success)) {
        console.warn('[Leitfaden] Apps Script failed, using client-side fallback:', data?.error);
        try {
          data = await generateLeitfadenClientSide(selectedCustomer, selectedPeriod);
        } catch (fallbackErr: any) {
          setError(`Leitfaden konnte nicht generiert werden: ${fallbackErr.message || 'Keine Daten verfügbar'}`);
          return;
        }
      }

      setResult(data);
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
