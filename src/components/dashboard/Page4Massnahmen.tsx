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

const fmtVal = (n: any) => {
  const num = Number(n ?? 0);
  if (Math.abs(num) < 2 && num !== 0)
    return `${(num * 100).toFixed(1)} %`;
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(num);
};

function KPITile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card text-center">
      <div
        className="text-xs font-medium uppercase tracking-wide mb-2"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
        {value}
      </div>
    </div>
  );
}

function BenchmarkGauge({
  kpiLabel,
  current,
  targetMin,
  targetMid,
  targetMax,
}: {
  kpiLabel: string;
  current: number;
  targetMin: number;
  targetMid: number;
  targetMax: number;
}) {
  const max = Math.max(targetMax, current) * 1.1 || 1;
  const currentPct = Math.min((current / max) * 100, 100);
  const minMarker = Math.min((targetMin / max) * 100, 100);
  const midMarker = Math.min((targetMid / max) * 100, 100);
  const isGood = current >= targetMin;
  const barColor = isGood ? '#10b981' : '#ef4444';

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium">{kpiLabel}</span>
        <span
          className="text-sm font-bold"
          style={{ color: isGood ? '#10b981' : 'var(--danger)' }}
        >
          {fmtVal(current)}
        </span>
      </div>
      <div
        className="relative h-4 rounded-full"
        style={{ backgroundColor: 'var(--border-color)' }}
      >
        <div
          className="absolute left-0 top-0 h-4 rounded-full transition-all duration-700"
          style={{ width: `${currentPct}%`, backgroundColor: barColor }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5"
          style={{ left: `${minMarker}%`, backgroundColor: '#f59e0b', zIndex: 1 }}
          title={`Ziel min: ${fmtVal(targetMin)}`}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5"
          style={{ left: `${midMarker}%`, backgroundColor: '#22c55e', zIndex: 1 }}
          title={`Optimal: ${fmtVal(targetMid)}`}
        />
      </div>
      <div
        className="flex justify-between text-xs mt-1"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span>Ziel: {fmtVal(targetMin)}</span>
        <span>Optimal: {fmtVal(targetMid)}</span>
      </div>
    </div>
  );
}

export default function Page4Massnahmen({ data, customer, period }: Props) {
  const portfolio = (data as any)?.portfolio || {};
  const actions: any[] = (data as any)?.actions || [];
  const monatsfokus = (data as any)?.monatsfokus || {};
  const benchmarks: any[] = (data as any)?.benchmarks || [];
  const tracker: any[] = (data as any)?.tracker || [];
  const wirkung = (data as any)?.wirkung || {};

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [trackerState, setTrackerState] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    tracker.forEach((t: any) => {
      if (t.action_key) initial[t.action_key] = Boolean(t.is_realization);
    });
    return initial;
  });

  const handleTrackerToggle = async (
    actionKey: string,
    ebitPotential: number,
    isRealization: boolean
  ) => {
    setSavingKey(actionKey);
    try {
      await api.saveTracker({
        customer_id: customer,
        period,
        action_key: actionKey,
        is_realization: isRealization,
        target_ebit_eur: ebitPotential,
      });
      setTrackerState((prev) => ({ ...prev, [actionKey]: isRealization }));
    } catch {
      // ignore
    } finally {
      setSavingKey(null);
    }
  };

  const hasFokus =
    monatsfokus &&
    (monatsfokus.action_label ||
      monatsfokus.label ||
      monatsfokus.contract_name);

  return (
    <div className="space-y-6">
      {/* ── Monatsfokus ───────────────────────────────────────────────────── */}
      {hasFokus && (
        <div
          className="card"
          style={{
            borderLeft: '4px solid var(--accent)',
            backgroundColor: 'rgba(43,108,176,0.06)',
          }}
        >
          <div
            className="text-xs font-bold uppercase tracking-widest mb-2"
            style={{ color: 'var(--accent)' }}
          >
            Monatsfokus
          </div>
          <div className="text-lg font-bold">
            {monatsfokus.action_label ??
              monatsfokus.label ??
              monatsfokus.contract_name}
          </div>
          {(monatsfokus.impact_eur ??
            monatsfokus.ebit_potential_eur ??
            monatsfokus.priority_score) != null && (
            <div
              className="mt-3 text-3xl font-bold"
              style={{ color: '#10b981' }}
            >
              +
              {fmtEur(
                monatsfokus.impact_eur ??
                  monatsfokus.ebit_potential_eur ??
                  monatsfokus.priority_score
              )}
            </div>
          )}
          {monatsfokus.category && (
            <div
              className="text-sm mt-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              {monatsfokus.category}
            </div>
          )}
        </div>
      )}

      {/* ── Portfolio Summary ─────────────────────────────────────────────── */}
      {Object.keys(portfolio).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {portfolio.total_ebit_potential != null && (
            <KPITile
              label="Gesamtpotenzial"
              value={fmtEur(portfolio.total_ebit_potential)}
            />
          )}
          {portfolio.focus_count != null && (
            <KPITile
              label="Fokus-Maßnahmen"
              value={String(portfolio.focus_count)}
            />
          )}
          {(portfolio.avg_impact ?? portfolio.avg_ebit_potential) != null && (
            <KPITile
              label="Ø Wirkung"
              value={fmtEur(portfolio.avg_impact ?? portfolio.avg_ebit_potential)}
            />
          )}
        </div>
      )}

      {/* ── Wirkung (Realisierungsübersicht) ─────────────────────────────── */}
      {wirkung && Object.keys(wirkung).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {wirkung.realized_ebit != null && (
            <KPITile
              label="Realisierter EBIT"
              value={fmtEur(wirkung.realized_ebit)}
            />
          )}
          {wirkung.potential_remaining != null && (
            <KPITile
              label="Verbleibendes Potenzial"
              value={fmtEur(wirkung.potential_remaining)}
            />
          )}
          {wirkung.realization_rate != null && (
            <KPITile
              label="Realisierungsquote"
              value={fmtPct(wirkung.realization_rate)}
            />
          )}
          {wirkung.action_count != null && (
            <KPITile
              label="Maßnahmen gesamt"
              value={String(wirkung.action_count)}
            />
          )}
        </div>
      )}

      {/* ── Actions List ──────────────────────────────────────────────────── */}
      {actions.length > 0 && (
        <div className="card">
          <h3
            className="font-semibold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Maßnahmen-Übersicht ({actions.length})
          </h3>
          <div className="space-y-3">
            {actions.map((a: any, i: number) => {
              const key =
                a.action_key ??
                a.contract_id ??
                a.id ??
                String(i);
              const label =
                a.action_label ??
                a.contract_name ??
                a.label ??
                `Maßnahme ${i + 1}`;
              const impact = Number(
                a.impact_eur ??
                  a.ebit_potential_eur ??
                  a.ebit_potential ??
                  0
              );
              const score = Number(
                a.priority_score ?? a.fokus_score ?? 0
              );
              const isInFocus =
                a.is_monatsfokus ||
                a.is_in_focus ||
                a.monatsfokus;
              const isRealized = trackerState[key] ?? false;

              return (
                <div
                  key={key}
                  className="p-4 rounded-xl"
                  style={{
                    backgroundColor: isInFocus
                      ? 'rgba(43,108,176,0.06)'
                      : 'var(--background)',
                    border: isInFocus
                      ? '1px solid rgba(43,108,176,0.25)'
                      : '1px solid var(--border-color)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{label}</span>
                        {isInFocus && (
                          <span
                            className="px-1.5 py-0.5 rounded text-xs font-bold"
                            style={{
                              backgroundColor: 'var(--accent)',
                              color: 'white',
                            }}
                          >
                            FOKUS
                          </span>
                        )}
                      </div>
                      {a.category && (
                        <div
                          className="text-xs mt-1"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {a.category}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div
                        className="font-bold"
                        style={{ color: '#10b981' }}
                      >
                        +{fmtEur(impact)}
                      </div>
                      {score > 0 && (
                        <div
                          className="text-xs mt-0.5"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          Score: {score.toFixed(1)}
                        </div>
                      )}
                    </div>
                    {/* Tracker toggle */}
                    <button
                      onClick={() =>
                        handleTrackerToggle(key, impact, !isRealized)
                      }
                      disabled={savingKey === key}
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all"
                      style={{
                        backgroundColor: isRealized
                          ? '#10b981'
                          : 'var(--border-color)',
                        color: isRealized ? 'white' : 'var(--text-secondary)',
                        opacity: savingKey === key ? 0.5 : 1,
                      }}
                      title={isRealized ? 'Als nicht realisiert markieren' : 'Als realisiert markieren'}
                    >
                      {savingKey === key ? '…' : isRealized ? '✓' : '○'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div
            className="mt-3 text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            ○ = offen · ✓ = realisiert — Klicken zum Umschalten
          </div>
        </div>
      )}

      {/* ── Benchmarks ───────────────────────────────────────────────────── */}
      {benchmarks.length > 0 && (
        <div className="card">
          <h3
            className="font-semibold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Branchen-Benchmarks
          </h3>
          <div className="space-y-5">
            {benchmarks.map((b: any, i: number) => {
              const kpiLabel =
                b.kpi_label ??
                b.label ??
                b.kpi ??
                `Benchmark ${i + 1}`;
              const current = Number(b.current ?? b.current_value ?? 0);
              const targetMin = Number(b.target_min ?? 0);
              const targetMid = Number(
                b.target_mid ?? ((targetMin + Number(b.target_max ?? 1)) / 2)
              );
              const targetMax = Number(b.target_max ?? 1);
              return (
                <BenchmarkGauge
                  key={i}
                  kpiLabel={kpiLabel}
                  current={current}
                  targetMin={targetMin}
                  targetMid={targetMid}
                  targetMax={targetMax}
                />
              );
            })}
          </div>
          <div
            className="mt-3 text-xs flex gap-4"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span>
              <span
                className="inline-block w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: '#f59e0b' }}
              />
              Zielwert (Minimum)
            </span>
            <span>
              <span
                className="inline-block w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: '#22c55e' }}
              />
              Optimum
            </span>
          </div>
        </div>
      )}

      {/* ── Realisierungstracker ─────────────────────────────────────────── */}
      {tracker.length > 0 && (
        <div className="card">
          <h3
            className="font-semibold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Realisierungstracker ({tracker.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-xs uppercase tracking-wide"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <th className="text-left pb-3 font-medium">Maßnahme</th>
                  <th className="text-right pb-3 font-medium">Ziel-EBIT</th>
                  <th className="text-center pb-3 font-medium">Realisiert</th>
                  <th className="text-right pb-3 font-medium">Monat</th>
                </tr>
              </thead>
              <tbody>
                {tracker.map((t: any, i: number) => (
                  <tr
                    key={i}
                    style={{ borderTop: '1px solid var(--border-color)' }}
                  >
                    <td className="py-2">
                      {t.action_key ??
                        t.contract_id ??
                        t.label ??
                        '–'}
                    </td>
                    <td className="py-2 text-right">
                      {fmtEur(t.target_ebit_eur)}
                    </td>
                    <td className="py-2 text-center">
                      <span
                        className="inline-block w-5 h-5 rounded-full"
                        style={{
                          backgroundColor: t.is_realization
                            ? '#10b981'
                            : 'var(--border-color)',
                        }}
                      />
                    </td>
                    <td
                      className="py-2 text-right text-xs"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t.month_label ?? t.period ?? '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
