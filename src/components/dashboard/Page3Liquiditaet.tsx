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

const fmtVal = (n: any, d = 1) =>
  n != null ? Number(n).toFixed(d) : '–';

function ScoreBar({ label, value, max = 25 }: { label: string; value: number; max?: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = pct >= 70 ? '#2E8B57' : pct >= 40 ? '#E8A838' : '#C43830';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="font-semibold" style={{ color }}>{value}/{max}</span>
      </div>
      <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--border-color)' }}>
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function Page3Liquiditaet({ data }: Props) {
  const summary = (data as any)?.summary || {};
  const breakeven = (data as any)?.breakeven || {};
  const stress: any[] = (data as any)?.stress || [];
  const trend: any[] = (data as any)?.trend || [];

  const bankBalance = Number(summary.bank_balance_eur ?? 0);
  const liqMonths = Number(summary.liquidity_months ?? 0);
  const stabScore = Number(summary.liquidity_stability_score ?? 0);

  const scorePerfm = Number(summary.score_performance ?? 0);
  const scoreStruct = Number(summary.score_structure ?? 0);
  const scoreTrend = Number(summary.score_trend ?? 0);
  const scoreStab = Number(summary.score_stability ?? 0);

  const bankColor = bankBalance < 20000 ? '#C43830' : bankBalance < 50000 ? '#E8A838' : '#2E8B57';
  const liqColor = liqMonths < 1.5 ? '#C43830' : liqMonths < 3 ? '#E8A838' : '#2E8B57';
  const scoreColor = stabScore < 40 ? '#C43830' : stabScore < 60 ? '#E8A838' : '#2E8B57';

  return (
    <div className="space-y-5">
      {/* ── Section Title ── */}
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          Liquiditätsstabilität
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Finanzielle Stabilität und Cashflow-Analyse
        </p>
        <div className="copper-line" />
      </div>

      {/* ── Main KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card text-center">
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
            Bankbestand
          </div>
          <div className="text-2xl font-bold" style={{ color: bankColor }}>
            {fmtEur(bankBalance)}
          </div>
        </div>
        <div className="card text-center">
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
            Liquiditätsreichweite
          </div>
          <div className="text-2xl font-bold" style={{ color: liqColor }}>
            {fmtVal(liqMonths)} Monate
          </div>
        </div>
        <div className="card text-center">
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
            Stabilitätsscore
          </div>
          <div className="text-2xl font-bold" style={{ color: scoreColor }}>
            {Math.round(stabScore)} / 100
          </div>
        </div>
      </div>

      {/* ── Score Dimensions ── */}
      {(scorePerfm > 0 || scoreStruct > 0 || scoreTrend > 0 || scoreStab > 0) && (
        <div className="card">
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Score-Dimensionen
          </h3>
          <div className="space-y-3">
            <ScoreBar label="Leistung" value={scorePerfm} />
            <ScoreBar label="Struktur" value={scoreStruct} />
            <ScoreBar label="Trend" value={scoreTrend} />
            <ScoreBar label="Stabilität" value={scoreStab} />
          </div>
        </div>
      )}

      {/* ── Break-Even-Analyse ── */}
      {(breakeven.breakeven_revenue_eur || breakeven.fixed_cost_eur) && (
        <div className="card">
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Break-Even-Analyse
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {breakeven.breakeven_revenue_eur != null && (
              <div>
                <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-secondary)' }}>Break-Even Umsatz</div>
                <div className="text-sm font-bold">{fmtEur(breakeven.breakeven_revenue_eur)}</div>
              </div>
            )}
            {breakeven.breakeven_utilization_pct != null && (
              <div>
                <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-secondary)' }}>Break-Even Auslastung</div>
                <div className="text-sm font-bold">{fmtPct(breakeven.breakeven_utilization_pct)}</div>
              </div>
            )}
            {breakeven.current_utilization_pct != null && (
              <div>
                <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-secondary)' }}>Aktuelle Auslastung</div>
                <div className="text-sm font-bold">{fmtPct(breakeven.current_utilization_pct)}</div>
              </div>
            )}
            {breakeven.safety_margin_pct != null && (
              <div>
                <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-secondary)' }}>Sicherheitsmarge</div>
                <div className="text-sm font-bold">{fmtPct(breakeven.safety_margin_pct)}</div>
              </div>
            )}
            {breakeven.fixed_cost_eur != null && (
              <div>
                <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-secondary)' }}>Fixkosten</div>
                <div className="text-sm font-bold">{fmtEur(breakeven.fixed_cost_eur)}</div>
              </div>
            )}
            {breakeven.contribution_margin_pct != null && (
              <div>
                <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-secondary)' }}>Deckungsbeitrag</div>
                <div className="text-sm font-bold">{fmtPct(breakeven.contribution_margin_pct)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Stress-Szenarien ── */}
      {stress.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Stress-Szenarien
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  <th className="text-left pb-2 font-semibold">Szenario</th>
                  <th className="text-right pb-2 font-semibold">Projizierter Bestand</th>
                  <th className="text-right pb-2 font-semibold">Reichweite</th>
                  <th className="text-right pb-2 font-semibold">Delta</th>
                </tr>
              </thead>
              <tbody>
                {stress.map((s: any, i: number) => {
                  const bal = Number(s.projected_balance_eur ?? 0);
                  const months = Number(s.projected_months ?? 0);
                  const delta = bal - bankBalance;
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td className="py-2.5 font-medium">{s.scenario_name || `Szenario ${i + 1}`}</td>
                      <td className="py-2.5 text-right">{fmtEur(bal)}</td>
                      <td className="py-2.5 text-right">{fmtVal(months)} Mon.</td>
                      <td
                        className="py-2.5 text-right font-medium"
                        style={{ color: delta < 0 ? 'var(--danger)' : 'var(--success)' }}
                      >
                        {delta >= 0 ? '+' : ''}{fmtEur(delta)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Cashflow-Trend ── */}
      {trend.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Cashflow-Trend (letzte 12 Monate)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  <th className="text-left pb-2 font-semibold">Monat</th>
                  <th className="text-right pb-2 font-semibold">Bankbestand</th>
                  <th className="text-right pb-2 font-semibold">Reichweite</th>
                </tr>
              </thead>
              <tbody>
                {trend.slice(-12).map((row: any, i: number) => {
                  const bal = Number(row.bank_balance_eur ?? 0);
                  const months = Number(row.liquidity_months ?? 0);
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td className="py-2 font-medium">
                        {row.month_label || row.month_label_short || ''}
                      </td>
                      <td className="py-2 text-right">{fmtEur(bal)}</td>
                      <td
                        className="py-2 text-right"
                        style={{
                          color: months < 1.5 ? 'var(--danger)' : months < 3 ? 'var(--warning)' : 'var(--success)',
                        }}
                      >
                        {fmtVal(months)} Mon.
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
