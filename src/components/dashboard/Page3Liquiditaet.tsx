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

// ── Sparkline for bank balance trend ──────────────────────────────────
function Sparkline({
  data,
  width = 180,
  height = 30,
  color,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = data[data.length - 1];
  const lineColor = color ?? (last >= 0 ? '#D49564' : '#E88080');
  const lastPt = pts[pts.length - 1].split(',');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="2.5" fill={lineColor} />
    </svg>
  );
}

function ScoreBar({ label, value, max = 25 }: { label: string; value: number; max?: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = pct >= 70 ? '#6ECF91' : pct >= 40 ? '#F0C060' : '#E88080';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="font-semibold" style={{ color }}>
          {value}/{max}
        </span>
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
  const stabScore = Math.round(Number(summary.liquidity_stability_score ?? 0));

  const scorePerfm = Number(summary.score_performance ?? 0);
  const scoreStruct = Number(summary.score_structure ?? 0);
  const scoreTrend = Number(summary.score_trend ?? 0);
  const scoreStab = Number(summary.score_stability ?? 0);

  const bankColor =
    bankBalance < 20000 ? '#E88080' : bankBalance < 50000 ? '#F0C060' : '#D49564';
  const liqColor =
    liqMonths < 1.5 ? '#E88080' : liqMonths < 3 ? '#F0C060' : '#6ECF91';
  const scoreColor =
    stabScore < 40 ? '#E88080' : stabScore < 60 ? '#F0C060' : '#6ECF91';

  // sparkline from trend: bank balance over last months
  const sparklineData = trend
    .slice(-12)
    .map((r: any) => Number(r.bank_balance_eur ?? 0));

  // liquidity months trend
  const liqTrendData = trend
    .slice(-12)
    .map((r: any) => Number(r.liquidity_months ?? 0));

  // score description
  const dimensions = [
    { label: 'Leistung', value: scorePerfm },
    { label: 'Struktur', value: scoreStruct },
    { label: 'Trend', value: scoreTrend },
    { label: 'Stabilität', value: scoreStab },
  ].filter((d) => d.value > 0);

  const weakest =
    dimensions.length > 0
      ? dimensions.reduce((a, b) => (a.value < b.value ? a : b))
      : null;

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

      {/* ── Hero Card ── */}
      <div
        className="rounded-xl"
        style={{ backgroundColor: 'var(--navy)', color: '#FFFFFF', overflow: 'hidden' }}
      >
        <div className="flex flex-col sm:flex-row">
          {/* Left: Bankbestand */}
          <div className="flex-1 p-5 pb-4">
            <div
              className="text-xs font-bold uppercase tracking-widest mb-3"
              style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em' }}
            >
              BANKBESTAND – AKTUELL
            </div>
            <div
              className="text-4xl font-extrabold mb-1 leading-none"
              style={{ color: bankColor }}
            >
              {fmtEur(bankBalance)}
            </div>

            {sparklineData.length >= 2 && (
              <div className="my-2">
                <Sparkline
                  data={sparklineData}
                  width={180}
                  height={30}
                  color={bankColor}
                />
              </div>
            )}

            {/* Status pill */}
            <div
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold mt-1"
              style={{
                backgroundColor:
                  bankBalance < 20000
                    ? 'rgba(232,128,128,0.15)'
                    : bankBalance < 50000
                    ? 'rgba(240,192,96,0.15)'
                    : 'rgba(110,207,145,0.15)',
                color: bankColor,
                border: `1px solid ${
                  bankBalance < 20000
                    ? 'rgba(232,128,128,0.3)'
                    : bankBalance < 50000
                    ? 'rgba(240,192,96,0.3)'
                    : 'rgba(110,207,145,0.3)'
                }`,
              }}
            >
              {bankBalance < 20000
                ? '⚠ Liquiditätsengpass'
                : bankBalance < 50000
                ? '→ Bestand gering'
                : '✓ Bestand stabil'}
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

          {/* Right: Reichweite + Score */}
          <div
            className="p-5 flex flex-row sm:flex-col justify-around sm:justify-center gap-4"
            style={{ minWidth: 180 }}
          >
            <div>
              <div
                className="text-xs font-bold uppercase tracking-widest mb-1"
                style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em' }}
              >
                REICHWEITE
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold" style={{ color: liqColor }}>
                  {fmtVal(liqMonths)}
                </span>
                <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Mon.
                </span>
              </div>
            </div>
            <div>
              <div
                className="text-xs font-bold uppercase tracking-widest mb-1"
                style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em' }}
              >
                STABILITÄTS-SCORE
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold" style={{ color: scoreColor }}>
                  {stabScore}
                </span>
                <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  /100
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Alert strip if critical */}
        {liqMonths < 1.5 && (
          <div
            className="px-5 py-2.5 flex items-center gap-2"
            style={{
              backgroundColor: 'rgba(232,128,128,0.12)',
              borderTop: '1px solid rgba(232,128,128,0.2)',
            }}
          >
            <span style={{ color: '#E88080', fontSize: 14 }}>⚠</span>
            <span className="text-xs font-semibold" style={{ color: '#E88080' }}>
              Liquiditätsreichweite kritisch — weniger als 1,5 Monate Puffer
            </span>
          </div>
        )}
      </div>

      {/* ── Score Dimensionen ── */}
      {dimensions.length > 0 && (
        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Score-Dimensionen
            </h3>
            {weakest && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ backgroundColor: 'rgba(212,149,100,0.12)', color: 'var(--copper)' }}
              >
                Hebel: {weakest.label}
              </span>
            )}
          </div>
          <div className="space-y-3">
            <ScoreBar label="Leistung" value={scorePerfm} />
            <ScoreBar label="Struktur" value={scoreStruct} />
            <ScoreBar label="Trend" value={scoreTrend} />
            <ScoreBar label="Stabilität" value={scoreStab} />
          </div>
          {weakest && (
            <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>
              Der Finanz-Score ({stabScore}/100) setzt sich aus vier gleichgewichteten Dimensionen
              zusammen. Größter Hebel: <strong>{weakest.label}</strong> ({weakest.value}/25 Punkte).
            </p>
          )}
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
                <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                  Break-Even Umsatz
                </div>
                <div className="text-sm font-bold">{fmtEur(breakeven.breakeven_revenue_eur)}</div>
              </div>
            )}
            {breakeven.breakeven_utilization_pct != null && (
              <div>
                <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                  Break-Even Auslastung
                </div>
                <div className="text-sm font-bold">{fmtPct(breakeven.breakeven_utilization_pct)}</div>
              </div>
            )}
            {breakeven.current_utilization_pct != null && (
              <div>
                <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                  Aktuelle Auslastung
                </div>
                <div className="text-sm font-bold">{fmtPct(breakeven.current_utilization_pct)}</div>
              </div>
            )}
            {breakeven.safety_margin_pct != null && (
              <div>
                <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                  Sicherheitsmarge
                </div>
                <div className="text-sm font-bold">{fmtPct(breakeven.safety_margin_pct)}</div>
              </div>
            )}
            {breakeven.fixed_cost_eur != null && (
              <div>
                <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                  Fixkosten
                </div>
                <div className="text-sm font-bold">{fmtEur(breakeven.fixed_cost_eur)}</div>
              </div>
            )}
            {breakeven.contribution_margin_pct != null && (
              <div>
                <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                  Deckungsbeitrag
                </div>
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
          <div className="space-y-3">
            {stress.map((s: any, i: number) => {
              const bal = Number(s.projected_balance_eur ?? 0);
              const months = Number(s.projected_months ?? 0);
              const delta = bal - bankBalance;
              const pct = bankBalance !== 0 ? ((delta / Math.abs(bankBalance)) * 100).toFixed(0) : '0';
              const color = bal < 0 ? '#E88080' : bal < 20000 ? '#F0C060' : '#6ECF91';
              return (
                <div
                  key={i}
                  className="rounded-lg p-3 flex items-center justify-between"
                  style={{ backgroundColor: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}
                >
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {s.scenario_name || `Szenario ${i + 1}`}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      Reichweite: {fmtVal(months)} Mon.
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color }}>
                      {fmtEur(bal)}
                    </div>
                    <div
                      className="text-xs font-semibold"
                      style={{ color: delta < 0 ? '#E88080' : '#6ECF91' }}
                    >
                      {delta >= 0 ? '+' : ''}{pct} %
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Cashflow-Trend ── */}
      {trend.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Cashflow-Trend (letzte {Math.min(trend.length, 12)} Monate)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-xs uppercase tracking-wider"
                  style={{ color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)' }}
                >
                  <th className="text-left pb-2 font-semibold">Monat</th>
                  <th className="text-right pb-2 font-semibold">Bankbestand</th>
                  <th className="text-right pb-2 font-semibold">Reichweite</th>
                </tr>
              </thead>
              <tbody>
                {trend.slice(-12).map((row: any, i: number) => {
                  const bal = Number(row.bank_balance_eur ?? 0);
                  const months = Number(row.liquidity_months ?? 0);
                  const rowColor =
                    months < 1.5 ? '#C43830' : months < 3 ? '#E8A838' : '#2E8B57';
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td className="py-2 font-medium">
                        {row.month_label || row.month_label_short || ''}
                      </td>
                      <td className="py-2 text-right font-mono text-xs">{fmtEur(bal)}</td>
                      <td className="py-2 text-right" style={{ color: rowColor }}>
                        <span className="font-semibold">{fmtVal(months)}</span>
                        <span className="text-xs ml-1" style={{ color: 'var(--text-secondary)' }}>
                          Mon.
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
    </div>
  );
}
