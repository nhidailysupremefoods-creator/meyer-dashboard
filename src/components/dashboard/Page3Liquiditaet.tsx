'use client';

interface Props {
  data: any;
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

function ScoreBar({
  label,
  score,
  max,
}: {
  label: string;
  score: number;
  max: number;
}) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  const color =
    pct >= 60 ? '#10b981' : pct >= 35 ? '#f59e0b' : '#ef4444';
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-semibold" style={{ color }}>
          {score} / {max}
        </span>
      </div>
      <div
        className="h-3 rounded-full"
        style={{ backgroundColor: 'var(--border-color)' }}
      >
        <div
          className="h-3 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function KPITile({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="card text-center">
      <div
        className="text-xs font-medium uppercase tracking-wide mb-2"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </div>
      <div
        className="text-2xl font-bold"
        style={{ color: valueColor || 'var(--primary)' }}
      >
        {value}
      </div>
    </div>
  );
}

export default function Page3Liquiditaet({ data }: Props) {
  const summary = (data as any)?.summary || {};
  const breakeven = (data as any)?.breakeven || {};
  const stress: any[] = (data as any)?.stress || [];
  const trend: any[] = (data as any)?.trend || [];

  const bank = Number(summary.bank_balance_eur ?? 0);
  const months = Number(summary.liquidity_months ?? 0);
  const score = Number(summary.liquidity_stability_score ?? 0);

  const bankColor =
    bank < 20000 ? '#ef4444' : bank < 50000 ? '#f59e0b' : 'var(--primary)';
  const monthsColor =
    months < 1.5 ? '#ef4444' : months < 3 ? '#f59e0b' : '#10b981';
  const scoreColor =
    score < 40 ? '#ef4444' : score < 60 ? '#f59e0b' : '#10b981';

  const dimensions = [
    {
      label: 'Leistung',
      score: Number(summary.score_performance ?? 0),
      max: 25,
    },
    {
      label: 'Struktur',
      score: Number(summary.score_structure ?? 0),
      max: 25,
    },
    {
      label: 'Trend',
      score: Number(summary.score_trend ?? 0),
      max: 25,
    },
    {
      label: 'Stabilität',
      score: Number(summary.score_stability ?? 0),
      max: 25,
    },
  ];

  const hasBreakeven = Object.keys(breakeven).length > 0;

  return (
    <div className="space-y-6">
      {/* ── Main KPIs ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPITile
          label="Bankbestand"
          value={fmtEur(bank)}
          valueColor={bankColor}
        />
        <KPITile
          label="Liquiditätsreichweite"
          value={`${months.toFixed(1)} Monate`}
          valueColor={monthsColor}
        />
        <KPITile
          label="Stabilitätsscore"
          value={`${score} / 100`}
          valueColor={scoreColor}
        />
      </div>

      {/* ── Score Dimensions ─────────────────────────────────────────────── */}
      <div className="card">
        <h3
          className="font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          Finanzstabilitäts-Score — Dimensionen
        </h3>
        <div className="space-y-4">
          {dimensions.map((d) => (
            <ScoreBar
              key={d.label}
              label={d.label}
              score={d.score}
              max={d.max}
            />
          ))}
        </div>
        <div
          className="mt-4 pt-3 text-sm"
          style={{
            borderTop: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
          }}
        >
          Gesamtscore:{' '}
          <strong style={{ color: scoreColor }}>{score} / 100</strong> —{' '}
          {score < 40
            ? 'Kritisch: Sofortige Maßnahmen erforderlich'
            : score < 60
            ? 'Warnung: Verbesserungsbedarf erkannt'
            : 'Gut: Stabile Finanzlage'}
        </div>
      </div>

      {/* ── Break-Even-Analyse ───────────────────────────────────────────── */}
      {hasBreakeven && (
        <div className="card">
          <h3
            className="font-semibold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Break-Even-Analyse
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            {breakeven.breakeven_revenue_eur != null && (
              <div>
                <div
                  className="text-xs font-medium uppercase tracking-wide mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Break-Even-Umsatz
                </div>
                <div className="font-bold text-lg">
                  {fmtEur(breakeven.breakeven_revenue_eur)}
                </div>
              </div>
            )}
            {breakeven.breakeven_utilization_pct != null && (
              <div>
                <div
                  className="text-xs font-medium uppercase tracking-wide mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Nötige Auslastung
                </div>
                <div className="font-bold text-lg">
                  {fmtPct(breakeven.breakeven_utilization_pct)}
                </div>
              </div>
            )}
            {breakeven.current_utilization_pct != null && (
              <div>
                <div
                  className="text-xs font-medium uppercase tracking-wide mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Akt. Auslastung
                </div>
                <div className="font-bold text-lg">
                  {fmtPct(breakeven.current_utilization_pct)}
                </div>
              </div>
            )}
            {breakeven.safety_margin_pct != null && (
              <div>
                <div
                  className="text-xs font-medium uppercase tracking-wide mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Sicherheitsmarge
                </div>
                <div
                  className="font-bold text-lg"
                  style={{
                    color:
                      Number(breakeven.safety_margin_pct) < 0
                        ? 'var(--danger)'
                        : '#10b981',
                  }}
                >
                  {fmtPct(breakeven.safety_margin_pct)}
                </div>
              </div>
            )}
            {breakeven.fixed_cost_eur != null && (
              <div>
                <div
                  className="text-xs font-medium uppercase tracking-wide mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Fixkosten / Monat
                </div>
                <div className="font-bold text-lg">
                  {fmtEur(breakeven.fixed_cost_eur)}
                </div>
              </div>
            )}
            {breakeven.contribution_margin_pct != null && (
              <div>
                <div
                  className="text-xs font-medium uppercase tracking-wide mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Deckungsbeitrag
                </div>
                <div className="font-bold text-lg">
                  {fmtPct(breakeven.contribution_margin_pct)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Stress-Szenarien ─────────────────────────────────────────────── */}
      {stress.length > 0 && (
        <div className="card">
          <h3
            className="font-semibold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Stress-Szenarien
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-xs uppercase tracking-wide"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <th className="text-left pb-3 font-medium">Szenario</th>
                  <th className="text-right pb-3 font-medium">Bankbestand</th>
                  <th className="text-right pb-3 font-medium">Reichweite</th>
                  <th className="text-right pb-3 font-medium">Δ Bankbest.</th>
                </tr>
              </thead>
              <tbody>
                {stress.map((s: any, i: number) => {
                  const projBank = Number(
                    s.projected_balance_eur ?? s.bank_balance ?? 0
                  );
                  const projMonths = Number(
                    s.projected_months ?? s.liquidity_months ?? 0
                  );
                  const delta = projBank - bank;
                  return (
                    <tr
                      key={i}
                      style={{ borderTop: '1px solid var(--border-color)' }}
                    >
                      <td className="py-3 font-medium">
                        {s.scenario_name ?? s.name ?? `Szenario ${i + 1}`}
                      </td>
                      <td
                        className="py-3 text-right"
                        style={{
                          color:
                            projBank < 20000
                              ? 'var(--danger)'
                              : projBank < 50000
                              ? 'var(--warning)'
                              : 'inherit',
                        }}
                      >
                        {fmtEur(projBank)}
                      </td>
                      <td
                        className="py-3 text-right"
                        style={{
                          color:
                            projMonths < 1.5
                              ? 'var(--danger)'
                              : projMonths < 3
                              ? 'var(--warning)'
                              : '#10b981',
                        }}
                      >
                        {projMonths.toFixed(1)} M
                      </td>
                      <td
                        className="py-3 text-right text-xs font-medium"
                        style={{
                          color: delta < 0 ? 'var(--danger)' : '#10b981',
                        }}
                      >
                        {delta >= 0 ? '+' : ''}
                        {fmtEur(delta)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Cashflow-Trend ────────────────────────────────────────────────── */}
      {trend.length > 0 && (
        <div className="card">
          <h3
            className="font-semibold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Cashflow-Trend
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-xs uppercase tracking-wide"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <th className="text-left pb-3 font-medium">Monat</th>
                  <th className="text-right pb-3 font-medium">Bankbestand</th>
                  <th className="text-right pb-3 font-medium">Reichweite</th>
                </tr>
              </thead>
              <tbody>
                {trend.slice(-12).map((row: any, i: number) => {
                  const rowBank = Number(
                    row.bank_balance_eur ?? row.bank_balance ?? 0
                  );
                  const rowMonths = Number(
                    row.liquidity_months ?? row.months ?? 0
                  );
                  return (
                    <tr
                      key={i}
                      style={{ borderTop: '1px solid var(--border-color)' }}
                    >
                      <td className="py-2 font-medium">
                        {row.month_label ?? row.month_label_short ?? ''}
                      </td>
                      <td
                        className="py-2 text-right"
                        style={{
                          color:
                            rowBank < 20000
                              ? 'var(--danger)'
                              : rowBank < 50000
                              ? 'var(--warning)'
                              : 'inherit',
                        }}
                      >
                        {fmtEur(rowBank)}
                      </td>
                      <td
                        className="py-2 text-right"
                        style={{
                          color:
                            rowMonths < 1.5
                              ? 'var(--danger)'
                              : rowMonths < 3
                              ? 'var(--warning)'
                              : '#10b981',
                        }}
                      >
                        {rowMonths.toFixed(1)} M
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
