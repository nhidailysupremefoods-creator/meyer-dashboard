'use client';

import React, { useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface FokusAction {
  action_key: string;
  action_label: string;
  impact_eur: number;
  ebit_potential_eur?: number;
  priority_score?: number;
  fokus_score?: number;
  description?: string;
  deadline?: string;
  owner?: string;
  period_date?: string;
}

interface BenchmarkMetric {
  metric: string;
  current: number;
  target_min: number;
  target_mid: number;
  target_max: number;
  gap: number;
  unit: string;
}

interface WirkungData {
  profit: number;
  margin_pct: number;
  high_risk_count: number;
  portfolio_ebit: number;
}

interface Action {
  action_key: string;
  action_label: string;
  contract_name?: string;
  impact_eur?: number;
  ebit_potential_eur?: number;
  priority_score?: number;
  fokus_score?: number;
  action_rank?: number;
  focus_rank?: number;
  is_monatsfokus?: boolean;
  is_in_focus?: boolean;
  month_label?: string;
}

interface TrackerEntry {
  action_key: string;
  action_label: string;
  target_ebit_eur: number;
  actual_ebit_eur: number;
  month_label: string;
  status: string;
  is_realization: boolean;
}

interface Page4Props {
  data: {
    fokus?: FokusAction;
    benchmark?: BenchmarkMetric[];
    wirkung?: WirkungData;
    actions?: Action[];
    tracker?: TrackerEntry[];
    riskContracts?: any[];
    liquidityActions?: any[];
  };
  customer: string;
  period: string;
}

const Page4Massnahmen: React.FC<Page4Props> = ({ data, customer, period }) => {
  const [activePool, setActivePool] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const numberFormatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const percentFormatter = new Intl.NumberFormat('de-DE', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });


  const handleToggleAction = useCallback(
    async (actionKey: string, isActive: boolean) => {
      setLoading(true);
      try {
        const newPool = new Set(activePool);
        if (isActive) {
          newPool.delete(actionKey);
        } else {
          newPool.add(actionKey);
        }
        setActivePool(newPool);

        // Save to API
        await api.saveTracker({
          customer_id: customer,
          period,
          action_key: actionKey,
          is_realization: !isActive,
          target_ebit_eur: 0,
        });
      } catch (error) {
        console.error('Error toggling action:', error);
      } finally {
        setLoading(false);
      }
    },
    [activePool, customer, period]
  );


  const getStatusBadge = (status?: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      'Umgesetzt': { color: '#2ecc71', label: '✓ Umgesetzt' },
      'In Arbeit': { color: '#f39c12', label: '⊕ In Arbeit' },
      'Offen': { color: '#e74c3c', label: '○ Offen' },
      'umgesetzt': { color: '#2ecc71', label: '✓ Umgesetzt' },
      'in_progress': { color: '#f39c12', label: '⊕ In Arbeit' },
      'open': { color: '#e74c3c', label: '○ Offen' },
    };
    const mapped = statusMap[status || 'open'] || { color: '#ccc', label: status || '–' };
    return mapped;
  };

  const fokusImpact = data?.fokus?.impact_eur || data?.fokus?.ebit_potential_eur || 0;

  // ── Benchmark computation ────────────────────────────────────────────────
  // Use BQ data if available; otherwise derive proxy values from margin_pct
  const margin = Number(data?.wirkung?.margin_pct || 0);
  const curProd   = Math.min(0.95, Math.max(0.50, 0.65 + margin * 1.5));
  const curHourly = 97 * (0.7 + Math.min(margin, 0.25) * 3);
  const curPayroll = Math.max(0.30, Math.min(0.70, 0.55 - margin * 0.5));

  const FALLBACK_BENCHMARKS: BenchmarkMetric[] = [
    { metric: 'Produktivität',       current: curProd,    target_min: 0.65, target_mid: 0.70, target_max: 0.80, gap: curProd - 0.70,    unit: 'pct' },
    { metric: 'Ø Stundensatz',       current: curHourly,  target_min: 85,   target_mid: 97,   target_max: 110,  gap: curHourly - 97,    unit: 'eur' },
    { metric: 'Personalkostenquote', current: curPayroll,  target_min: 0.38, target_mid: 0.47, target_max: 0.55, gap: 0.47 - curPayroll, unit: 'pct' },
  ];

  const rawBenchmarks: BenchmarkMetric[] = (data as any)?.benchmark || [];
  const displayBenchmarks = rawBenchmarks.length > 0 ? rawBenchmarks : FALLBACK_BENCHMARKS;

  const fmtBench = (val: number, unit: string) => {
    if (unit === 'pct' || unit === '%') return `${(val * 100).toFixed(1)} %`;
    if (unit === 'eur' || unit === '€') return `${val.toFixed(0)} €`;
    // Heuristic: if value < 2, treat as fraction
    if (Math.abs(val) < 2) return `${(val * 100).toFixed(1)} %`;
    return `${val.toFixed(0)}`;
  };

  // For payroll, lower is better — invert gap colour
  const isLowerBetter = (metric: BenchmarkMetric) =>
    metric.metric.toLowerCase().includes('kosten') || metric.metric.toLowerCase().includes('payroll');

  return (
    <div className="page4-container" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* MONATSFOKUS */}
      <div className="monatsfokus-section" style={{ marginBottom: '3rem' }}>
        <div
          style={{
            backgroundColor: 'var(--accent, #B08A6A)',
            borderRadius: '8px',
            padding: '2rem',
            color: 'var(--background, #F7F5F2)',
          }}
        >
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem', fontWeight: 'bold' }}>🎯 MONATSFOKUS</h2>
          {data?.fokus && fokusImpact > 0 ? (
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: '600' }}>{data.fokus.action_label}</h3>
              <p style={{ margin: '0.5rem 0', fontSize: '1rem', opacity: 0.9 }}>{data.fokus.description || '–'}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div>
                  <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase' }}>EBIT-Potenzial</p>
                  <p style={{ margin: '0', fontSize: '1.5rem', fontWeight: 'bold' }}>{numberFormatter.format(fokusImpact)}</p>
                </div>
                {data.fokus.priority_score && (
                  <div>
                    <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase' }}>Priorität</p>
                    <p style={{ margin: '0', fontSize: '1.5rem', fontWeight: 'bold' }}>{Math.round(data.fokus.priority_score)}</p>
                  </div>
                )}
                {data.fokus.deadline && (
                  <div>
                    <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase' }}>Deadline</p>
                    <p style={{ margin: '0', fontSize: '1rem', fontWeight: '600' }}>{data.fokus.deadline}</p>
                  </div>
                )}
                {data.fokus.owner && (
                  <div>
                    <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase' }}>Verantwortlich</p>
                    <p style={{ margin: '0', fontSize: '1rem', fontWeight: '600' }}>{data.fokus.owner}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p style={{ margin: '0', fontSize: '1rem', opacity: 0.9 }}>Kein Monatsfokus definiert</p>
          )}
        </div>
      </div>

      {/* Kupferlinie */}
      <div style={{ height: '4px', backgroundColor: 'var(--accent, #B08A6A)', marginBottom: '2rem', borderRadius: '2px' }} />

      {/* BENCHMARK-GAUGES — always visible, uses fallback when BQ returns no data */}
      <div className="benchmark-section" style={{ marginBottom: '3rem' }}>
        <h3 style={{ color: 'var(--primary, #192231)', fontSize: '1.25rem', marginBottom: '0.5rem' }}>Benchmark-Vergleich</h3>
        {rawBenchmarks.length === 0 && (
          <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.75rem', color: '#999', fontStyle: 'italic' }}>
            Branchenwerte werden aus Margendaten abgeleitet (Richtwerte)
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
          {displayBenchmarks.map((metric, idx) => {
            // Scale: use 0 → target_max * 1.4 as the full bar range
            const scaleMax = metric.target_max * 1.4;
            const targetMinPct  = (metric.target_min  / scaleMax) * 100;
            const targetWidthPct = ((metric.target_max - metric.target_min) / scaleMax) * 100;
            const currentPct = Math.min(100, Math.max(0, (metric.current / scaleMax) * 100));
            const inTarget = metric.current >= metric.target_min && metric.current <= metric.target_max;
            const lowerBetter = isLowerBetter(metric);
            const gapOk = lowerBetter
              ? metric.current <= metric.target_max
              : metric.current >= metric.target_min;
            const markerColor = inTarget ? '#2ecc71' : (gapOk ? '#f39c12' : '#e74c3c');
            const gapColor = lowerBetter
              ? (metric.current <= metric.target_mid ? '#2ecc71' : '#e74c3c')
              : (metric.gap >= 0 ? '#2ecc71' : '#e74c3c');

            return (
              <div key={idx}>
                {/* Label row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--primary, #192231)', fontWeight: '600', fontSize: '0.9rem' }}>
                    {metric.metric}
                  </span>
                  <span style={{ color: markerColor, fontWeight: 'bold', fontSize: '0.9rem' }}>
                    {fmtBench(metric.current, metric.unit)}
                  </span>
                </div>
                {/* Target range hint */}
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.7rem', color: '#888' }}>
                  Zielband: {fmtBench(metric.target_min, metric.unit)} – {fmtBench(metric.target_max, metric.unit)}
                  {' '}(Mitte {fmtBench(metric.target_mid, metric.unit)})
                </p>

                {/* Gauge track */}
                <div style={{ position: 'relative', height: '28px', marginBottom: '0.5rem' }}>
                  {/* Background track */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0, top: '6px',
                      width: '100%', height: '16px',
                      backgroundColor: '#e8e8e8',
                      borderRadius: '8px',
                      overflow: 'visible',
                    }}
                  >
                    {/* Target zone highlight */}
                    <div
                      style={{
                        position: 'absolute',
                        left:  `${targetMinPct}%`,
                        width: `${targetWidthPct}%`,
                        height: '100%',
                        backgroundColor: 'rgba(46,204,113,0.25)',
                        borderLeft:  '2px solid rgba(46,204,113,0.6)',
                        borderRight: '2px solid rgba(46,204,113,0.6)',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                  {/* Current value marker (circle) */}
                  <div
                    style={{
                      position: 'absolute',
                      left: `${currentPct}%`,
                      top: '0',
                      width: '28px', height: '28px',
                      marginLeft: '-14px',
                      backgroundColor: markerColor,
                      borderRadius: '50%',
                      border: '3px solid #fff',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                      zIndex: 10,
                    }}
                  />
                </div>

                {/* Scale labels */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#aaa', marginBottom: '0.25rem' }}>
                  <span>0</span>
                  <span>{fmtBench(metric.target_min, metric.unit)}</span>
                  <span>{fmtBench(metric.target_max, metric.unit)}</span>
                </div>

                {/* Gap badge */}
                <div style={{ fontSize: '0.72rem', color: gapColor, fontWeight: '600' }}>
                  {gapOk ? '✓' : '✗'} Abstand zum Ziel: {fmtBench(Math.abs(metric.gap), metric.unit)}
                  {inTarget ? ' — Im Zielband' : (gapOk ? ' — Nahe Ziel' : ' — Unter Ziel')}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Kupferlinie */}
      <div style={{ height: '4px', backgroundColor: 'var(--accent, #B08A6A)', marginBottom: '2rem', borderRadius: '2px' }} />

      {/* WIRKUNGSANALYSE */}
      {data?.wirkung && (
        <div className="wirkung-section" style={{ marginBottom: '3rem' }}>
          <h3 style={{ color: 'var(--primary, #192231)', fontSize: '1.25rem', marginBottom: '1.5rem' }}>Wirkungsanalyse – Gesamtportfolio</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            <div
              style={{
                backgroundColor: 'var(--background, #F7F5F2)',
                border: `2px solid var(--primary, #192231)`,
                borderRadius: '8px',
                padding: '1.5rem',
              }}
            >
              <p style={{ margin: '0 0 0.5rem 0', color: 'var(--primary, #192231)', fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase' }}>
                Portfolio-EBIT
              </p>
              <p style={{ margin: '0', color: 'var(--primary, #192231)', fontSize: '2rem', fontWeight: 'bold' }}>
                {numberFormatter.format(data.wirkung.portfolio_ebit)}
              </p>
            </div>

            <div
              style={{
                backgroundColor: 'var(--background, #F7F5F2)',
                border: `2px solid var(--primary, #192231)`,
                borderRadius: '8px',
                padding: '1.5rem',
              }}
            >
              <p style={{ margin: '0 0 0.5rem 0', color: 'var(--primary, #192231)', fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase' }}>
                Gewinn
              </p>
              <p style={{ margin: '0', color: data.wirkung.profit >= 0 ? '#2ecc71' : '#e74c3c', fontSize: '2rem', fontWeight: 'bold' }}>
                {numberFormatter.format(data.wirkung.profit)}
              </p>
            </div>

            <div
              style={{
                backgroundColor: 'var(--background, #F7F5F2)',
                border: `2px solid var(--primary, #192231)`,
                borderRadius: '8px',
                padding: '1.5rem',
              }}
            >
              <p style={{ margin: '0 0 0.5rem 0', color: 'var(--primary, #192231)', fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase' }}>
                Marge
              </p>
              <p style={{ margin: '0', color: data.wirkung.margin_pct >= 0.07 ? '#2ecc71' : '#e74c3c', fontSize: '2rem', fontWeight: 'bold' }}>
                {percentFormatter.format(data.wirkung.margin_pct)}
              </p>
            </div>

            {data.wirkung.high_risk_count !== undefined && (
              <div
                style={{
                  backgroundColor: 'var(--background, #F7F5F2)',
                  border: `2px solid var(--primary, #192231)`,
                  borderRadius: '8px',
                  padding: '1.5rem',
                }}
              >
                <p style={{ margin: '0 0 0.5rem 0', color: 'var(--primary, #192231)', fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase' }}>
                  Kritische Verträge
                </p>
                <p style={{ margin: '0', color: data.wirkung.high_risk_count > 0 ? '#e74c3c' : '#2ecc71', fontSize: '2rem', fontWeight: 'bold' }}>
                  {data.wirkung.high_risk_count}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Kupferlinie */}
      <div style={{ height: '4px', backgroundColor: 'var(--accent, #B08A6A)', marginBottom: '2rem', borderRadius: '2px' }} />

      {/* MASSNAHMENPOOL */}
      {data?.actions && data.actions.length > 0 && (
        <div className="actions-pool" style={{ marginBottom: '3rem' }}>
          <h3 style={{ color: 'var(--primary, #192231)', fontSize: '1.25rem', marginBottom: '1rem' }}>Maßnahmenpool</h3>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                borderRadius: '6px',
                overflow: 'hidden',
                border: `1px solid var(--primary, #192231)`,
              }}
            >
              <thead>
                <tr style={{ backgroundColor: 'var(--primary, #192231)', color: 'var(--background, #F7F5F2)' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Maßnahme</th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>EBIT-Potenzial</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>Score</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>Rang</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {data.actions.map((action, idx) => {
                  const isInFocus = action.is_monatsfokus || action.is_in_focus || false;
                  const impact = action.impact_eur || action.ebit_potential_eur || 0;
                  const score = action.priority_score || action.fokus_score || 0;
                  const rank = action.action_rank || action.focus_rank || idx + 1;

                  return (
                    <tr
                      key={idx}
                      style={{
                        backgroundColor: isInFocus ? 'rgba(176, 138, 106, 0.1)' : idx % 2 === 0 ? 'var(--background, #F7F5F2)' : '#fff',
                        borderBottom: `1px solid var(--primary, #192231)`,
                        borderLeft: isInFocus ? `4px solid var(--accent, #B08A6A)` : 'none',
                      }}
                    >
                      <td style={{ padding: '1rem', color: 'var(--primary, #192231)', fontWeight: isInFocus ? '600' : '400' }}>
                        {action.action_label || action.contract_name || '–'}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--primary, #192231)', fontWeight: '600' }}>
                        {impact > 0 ? numberFormatter.format(impact) : '–'}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--primary, #192231)' }}>{score > 0 ? Math.round(score) : '–'}</td>
                      <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--primary, #192231)' }}>{rank}</td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleAction(action.action_key, isInFocus)}
                          disabled={loading}
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: isInFocus ? 'var(--accent, #B08A6A)' : 'var(--primary, #192231)',
                            color: 'var(--background, #F7F5F2)',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontWeight: '600',
                            fontSize: '0.875rem',
                            opacity: loading ? 0.6 : 1,
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {isInFocus ? 'Entfernen' : 'Hinzufügen'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Kupferlinie */}
      <div style={{ height: '4px', backgroundColor: 'var(--accent, #B08A6A)', marginBottom: '2rem', borderRadius: '2px' }} />

      {/* REALISIERUNGSTRACKER */}
      {data?.tracker && data.tracker.length > 0 && (
        <div className="realization-tracker" style={{ marginBottom: '3rem' }}>
          <h3 style={{ color: 'var(--primary, #192231)', fontSize: '1.25rem', marginBottom: '1rem' }}>Realisierungstracker</h3>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                borderRadius: '6px',
                overflow: 'hidden',
                border: `1px solid var(--primary, #192231)`,
              }}
            >
              <thead>
                <tr style={{ backgroundColor: 'var(--primary, #192231)', color: 'var(--background, #F7F5F2)' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Maßnahme</th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>Ziel-EBIT</th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>IST-EBIT</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>Monat</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.tracker.map((entry, idx) => {
                  const status = getStatusBadge(entry.status);
                  const difference = entry.actual_ebit_eur - entry.target_ebit_eur;

                  return (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'var(--background, #F7F5F2)' : '#fff', borderBottom: `1px solid var(--primary, #192231)` }}>
                      <td style={{ padding: '1rem', color: 'var(--primary, #192231)', fontWeight: '500' }}>{entry.action_label}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--primary, #192231)' }}>{numberFormatter.format(entry.target_ebit_eur)}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: difference >= 0 ? '#2ecc71' : '#e74c3c', fontWeight: '600' }}>
                        {numberFormatter.format(entry.actual_ebit_eur)}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--primary, #192231)' }}>{entry.month_label}</td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            backgroundColor: status.color,
                            color: '#fff',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '16px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                          }}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Platzhalter für nächste Schritte (wird von Page5 gefüllt) */}
      <div id="p5-next-steps" style={{ marginTop: '2rem' }} />
    </div>
  );
};

export default Page4Massnahmen;
