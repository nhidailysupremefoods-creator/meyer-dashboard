'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  data: any;
  customer: string;
  period: string;
}

const fmtEur = (n: any) =>
  n != null
    ? new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(Number(n))
    : '–';

const fmtPct = (n: any) =>
  n != null ? `${(Number(n) * 100).toFixed(1)} %` : '–';

function BenchmarkGauge({
  label,
  current,
  targetMin,
  targetMid,
  targetMax,
}: {
  label: string;
  current: number;
  targetMin: number;
  targetMid: number;
  targetMax: number;
}) {
  const range = targetMax * 1.2;
  const pctCurrent = Math.min((current / range) * 100, 100);
  const pctMin = (targetMin / range) * 100;
  const pctMid = (targetMid / range) * 100;
  const pctMax = (targetMax / range) * 100;
  const inTarget = current >= targetMin && current <= targetMax;
  const barColor =
    current < targetMin ? '#C43830' : current > targetMax ? '#2E8B57' : '#D49564';

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-secondary)' }}
        >
          {label}
        </span>
        <span
          className="text-sm font-bold"
          style={{ color: inTarget ? '#2E8B57' : barColor }}
        >
          {typeof current === 'number' && current < 1
            ? fmtPct(current)
            : `${current}`}
        </span>
      </div>
      <div
        className="relative h-3 rounded-full"
        style={{ backgroundColor: 'var(--border-color)' }}
      >
        {/* Target zone */}
        <div
          className="absolute h-3 rounded-full"
          style={{
            left: `${pctMin}%`,
            width: `${pctMax - pctMin}%`,
            backgroundColor: 'rgba(46,139,87,0.12)',
          }}
        />
        {/* Current value */}
        <div
          className="absolute h-3 rounded-full transition-all"
          style={{ width: `${pctCurrent}%`, backgroundColor: barColor }}
        />
        {/* Target mid marker */}
        <div
          className="absolute top-0 w-0.5 h-3"
          style={{ left: `${pctMid}%`, backgroundColor: 'var(--text-secondary)' }}
        />
      </div>
      <div
        className="flex justify-between text-xs mt-1"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span>Min: {targetMin < 1 ? fmtPct(targetMin) : targetMin}</span>
        <span>Ziel: {targetMid < 1 ? fmtPct(targetMid) : targetMid}</span>
        <span>Max: {targetMax < 1 ? fmtPct(targetMax) : targetMax}</span>
      </div>
    </div>
  );
}

export default function Page4Massnahmen({ data, customer, period }: Props) {
  const portfolio = (data as any)?.portfolio || {};
  const actions: any[] = (data as any)?.actions || [];
  const monatsfokus = (data as any)?.monatsfokus || (data as any)?.fokus || {};
  const wirkung = (data as any)?.wirkung || {};
  const benchmarks: any[] = (data as any)?.benchmarks || [];
  const tracker: any[] = (data as any)?.tracker || [];

  const [trackerState, setTrackerState] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const isRealized = (key: string) => {
    if (trackerState[key] !== undefined) return trackerState[key];
    const t = tracker.find((t: any) => (t.action_key || t.contract_id) === key);
    return t ? !!t.is_realization : false;
  };

  const handleTrackerToggle = async (actionKey: string, targetEbit: number) => {
    const newVal = !isRealized(actionKey);
    setSavingKey(actionKey);
    try {
      await api.saveTracker({
        customer_id: customer,
        period,
        action_key: actionKey,
        is_realization: newVal,
        target_ebit_eur: targetEbit,
      });
      setTrackerState((prev) => ({ ...prev, [actionKey]: newVal }));
    } catch (err) {
      console.error('Tracker save failed:', err);
    } finally {
      setSavingKey(null);
    }
  };

  const totalPotential = Number(portfolio.total_ebit_potential ?? portfolio.total_impact ?? 0);
  const focusCount = Number(portfolio.focus_count ?? 0);
  const avgImpact = Number(portfolio.avg_impact ?? portfolio.avg_ebit_potential ?? 0);

  const fokusLabel = monatsfokus.action_label || monatsfokus.contract_name || '';
  const fokusImpact = Number(monatsfokus.impact_eur || monatsfokus.ebit_potential_eur || 0);

  // Realization stats from wirkung or computed from trackerState + tracker
  const realizedEbit = Number(wirkung.realized_ebit ?? 0);
  const realizationRate = Number(wirkung.realization_rate ?? 0);

  return (
    <div className="space-y-5">
      {/* ── Section Title ── */}
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          Maßnahmen & Benchmarks
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Optimierungspotenziale und Umsetzungstracking
        </p>
        <div className="copper-line" />
      </div>

      {/* ── Hero Card – Monatsfokus + Potenzial ── */}
      <div
        className="rounded-xl"
        style={{ backgroundColor: 'var(--navy)', color: '#FFFFFF', overflow: 'hidden' }}
      >
        <div className="flex flex-col sm:flex-row">
          {/* Left: Monatsfokus / Gesamtpotenzial */}
          <div className="flex-1 p-5 pb-4">
            {fokusLabel ? (
              <>
                <div
                  className="text-xs font-bold uppercase tracking-widest mb-2"
                  style={{ color: '#D49564', letterSpacing: '0.12em' }}
                >
                  ▶ MONATSFOKUS
                </div>
                <div
                  className="text-xl font-extrabold mb-1 leading-snug"
                  style={{ color: '#FFFFFF' }}
                >
                  {fokusLabel}
                </div>
                {fokusImpact > 0 && (
                  <div className="text-3xl font-extrabold" style={{ color: '#6ECF91' }}>
                    +{fmtEur(fokusImpact)}
                    <span className="text-sm font-semibold ml-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      / Monat
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div
                  className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em' }}
                >
                  GESAMTPOTENZIAL
                </div>
                <div className="text-4xl font-extrabold mb-1 leading-none" style={{ color: '#6ECF91' }}>
                  {totalPotential > 0 ? `+${fmtEur(totalPotential)}` : fmtEur(totalPotential)}
                </div>
              </>
            )}

            {/* Tags row */}
            <div className="flex flex-wrap gap-2 mt-3">
              {focusCount > 0 && (
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: 'rgba(212,149,100,0.15)',
                    color: '#D49564',
                    border: '1px solid rgba(212,149,100,0.3)',
                  }}
                >
                  {focusCount} Fokus-Maßnahmen
                </span>
              )}
              {actions.length > 0 && (
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    color: 'rgba(255,255,255,0.7)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  {actions.length} Maßnahmen gesamt
                </span>
              )}
            </div>
          </div>

          {/* Vertical Divider */}
          <div
            className="hidden sm:block"
            style={{
              width: 1,
              backgroundColor: 'rgba(255,255,255,0.10)',
              margin: '20px 0',
            }}
          />

          {/* Right: Gesamtpotenzial + Realisierung */}
          <div
            className="p-5 flex flex-row sm:flex-col justify-around sm:justify-center gap-4"
            style={{ minWidth: 180 }}
          >
            <div>
              <div
                className="text-xs font-bold uppercase tracking-widest mb-1"
                style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em' }}
              >
                POTENZIAL
              </div>
              <div className="text-2xl font-extrabold" style={{ color: '#6ECF91' }}>
                {totalPotential > 0 ? '+' : ''}{fmtEur(totalPotential)}
              </div>
            </div>
            {avgImpact > 0 && (
              <div>
                <div
                  className="text-xs font-bold uppercase tracking-widest mb-1"
                  style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em' }}
                >
                  Ø WIRKUNG
                </div>
                <div className="text-2xl font-extrabold" style={{ color: '#D49564' }}>
                  {fmtEur(avgImpact)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Realization progress strip */}
        {realizationRate > 0 && (
          <div
            className="px-5 py-2.5 flex items-center gap-3"
            style={{
              backgroundColor: 'rgba(110,207,145,0.08)',
              borderTop: '1px solid rgba(110,207,145,0.15)',
            }}
          >
            <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: `${Math.min(realizationRate * 100, 100).toFixed(0)}%`,
                  backgroundColor: '#6ECF91',
                }}
              />
            </div>
            <span className="text-xs font-bold flex-shrink-0" style={{ color: '#6ECF91' }}>
              {(realizationRate * 100).toFixed(0)} % realisiert
              {realizedEbit > 0 && (
                <span className="ml-2 font-normal" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  (+{fmtEur(realizedEbit)})
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* ── Actions List ── */}
      {actions.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Maßnahmenpool ({actions.length})
          </h3>
          <div className="space-y-2">
            {actions.map((a: any, i: number) => {
              const key = a.action_key || a.contract_id || `action-${i}`;
              const impact = Number(
                a.impact_eur ?? a.ebit_potential_eur ?? a.ebit_potential ?? 0
              );
              const prio = Number(a.priority_score ?? a.fokus_score ?? 0);
              const isFokus = !!(a.is_monatsfokus || a.is_in_focus);
              const realized = isRealized(key);
              const isSaving = savingKey === key;

              return (
                <div
                  key={key}
                  className="flex items-center gap-3 p-3 rounded-lg"
                  style={{
                    backgroundColor: isFokus
                      ? 'rgba(212,149,100,0.05)'
                      : 'rgba(0,0,0,0.02)',
                    border: `1px solid ${
                      isFokus ? 'rgba(212,149,100,0.2)' : 'var(--border-color)'
                    }`,
                    opacity: isSaving ? 0.6 : 1,
                  }}
                >
                  {/* Toggle */}
                  <button
                    onClick={() => handleTrackerToggle(key, impact)}
                    disabled={isSaving}
                    className="flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all"
                    style={{
                      borderColor: realized ? '#2E8B57' : 'var(--border-color)',
                    backgroundColor: realized ? '#2E8B57' : 'transparent',
                    color: realized ? '#FFFFFF' : 'var(--text-secondary)',
                    }}
                  >
                    {isSaving ? '…' : realized ? '✓' : ''}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-medium truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {a.action_label || a.contract_name || `Maßnahme ${i + 1}`}
                      </span>
                      {isFokus && (
                        <span
                          className="px-1.5 py-0.5 rounded text-xs font-bold flex-shrink-0"
                          style={{
                            backgroundColor: 'rgba(212,149,100,0.12)',
                            color: 'var(--copper)',
                          }}
                        >
                          FOKUS
                        </span>
                      )}
                    </div>
                    {a.category && (
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {a.category}
                      </div>
                    )}
                  </div>

                  {/* Impact + Score */}
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm font-bold" style={{ color: '#2E8B57' }}>
                      +{fmtEur(impact)}
                    </div>
                    {prio > 0 && (
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Score: {prio.toFixed(1)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Benchmarks ── */}
      {benchmarks.length > 0 && (
        <div>
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Benchmark-Vergleich
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {benchmarks.map((b: any, i: number) => (
              <BenchmarkGauge
                key={i}
                label={b.kpi_label || `KPI ${i + 1}`}
                current={Number(b.current ?? 0)}
                targetMin={Number(b.target_min ?? 0)}
                targetMid={Number(b.target_mid ?? 0)}
                targetMax={Number(b.target_max ?? 0)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Realisierungstracker ── */}
      {tracker.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Realisierungstracker
            </h3>
            {realizedEbit > 0 && (
              <span className="text-xs font-bold" style={{ color: '#2E8B57' }}>
                +{fmtEur(realizedEbit)} realisiert
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-xs uppercase tracking-wider"
                  style={{ color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)' }}
                >
                  <th className="text-left pb-2 font-semibold">Maßnahme</th>
                  <th className="text-right pb-2 font-semibold">Ziel-EBIT</th>
                  <th className="text-center pb-2 font-semibold">Status</th>
                  <th className="text-right pb-2 font-semibold">Monat</th>
                </tr>
              </thead>
              <tbody>
                {tracker.map((t: any, i: number) => {
                  const tKey = t.action_key || t.contract_id || '';
                  const realized = isRealized(tKey);
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td className="py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                        {t.action_label || t.contract_name || tKey}
                      </td>
                      <td className="py-2.5 text-right font-semibold" style={{ color: '#2E8B57' }}>
                        {fmtEur(t.target_ebit_eur)}
                      </td>
                      <td className="py-2.5 text-center">
                        <span
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                          style={{
                            backgroundColor: realized ? '#2E8B57' : 'var(--border-color)',
                            color: realized ? '#FFFFFF' : 'var(--text-secondary)',
                          }}
                        >
                          {realized ? '✛' : '➗'}
                        </span>
                      </td>
                      <td
                        className="py-2.5 text-right text-xs"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {t.month_label || t.month_id || '‛'}
                      </td>
                    </tr>
                  )
;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Wirkung KPIs (if no tracker but wirkung available) ── */}
      {tracker.length === 0 && (wirkung.realized_ebit || wirkung.potential_remaining || wirkung.realization_rate) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card text-center">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
              Realisierter EBIT
            </div>
            <div className="text-lg font-bold" style={{ color: 'var(--success)' }}>
              {fmtEur(wirkung.realized_ebit)}
            </div>
          </div>
          <div className="card text-center">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
              Verbleibendes Pot.
            </div>
            <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {fmtEur(wirkung.potential_remaining)}
            </div>
          </div>
          <div className="card text-center">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
              Realisierungsquote
            </div>
            <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {fmtPct(wirkung.realization_rate)}
            </div>
          </div>
          <div className="card text-center">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
              Maßnahmen gesamt
            </div>
            <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {wirkung.action_count ?? actions.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
