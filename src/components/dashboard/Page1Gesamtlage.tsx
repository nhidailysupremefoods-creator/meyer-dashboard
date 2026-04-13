'use client';

interface Props {
  data: any;
}

// ── Formatters ─────────────────────────────────────────────────────────
const fmtEur = (n: any) =>
  n != null
    ? new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(Number(n))
    : '–';

const fmtEurK = (n: any) => {
  if (n == null) return '–';
  const v = Number(n);
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')} Mio €`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k €`;
  return fmtEur(v);
};

const fmtPct = (n: any) =>
  n != null ? `${(Number(n) * 100).toFixed(1)} %` : '–';

const fmtPctSigned = (n: any) => {
  if (n == null) return '–';
  const val = Number(n) * 100;
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(1)} %`;
};

const statusInfo = (s: string) => {
  const u = (s || '').toUpperCase();
  if (u === 'GRÜN' || u === 'GREEN' || u === 'GUT')
    return { label: 'GUT', color: '#2E8B57', bg: 'rgba(46,139,87,0.08)' };
  if (u === 'GELB' || u === 'YELLOW' || u === 'WARNUNG')
    return { label: 'WARNUNG', color: '#E8A838', bg: 'rgba(232,168,56,0.08)' };
  if (u === 'ROT' || u === 'RED' || u === 'KRITISCH')
    return { label: 'KRITISCH', color: '#C43830', bg: 'rgba(196,56,48,0.08)' };
  return { label: s || '–', color: '#6B7A90', bg: 'rgba(107,122,144,0.08)' };
};

const momColor = (n: any) => {
  if (n == null) return 'var(--text-secondary)';
  const val = Number(n);
  return val > 0 ? '#2E8B57' : val < 0 ? '#C43830' : 'var(--text-secondary)';
};

const momArrow = (n: any) => {
  if (n == null) return '';
  const val = Number(n);
  return val > 0.001 ? '▲' : val < -0.001 ? '▼' : '→';
};

// ── Main Component ─────────────────────────────────────────────────────
export default function Page1Gesamtlage({ data }: Props) {
  const d = (data as any)?.data || {};
  const trend: any[] = (data as any)?.trend || [];

  const st = statusInfo(d.status_color);
  const revenue = Number(d.revenue || 0);
  const ebit = Number(d.ebit ?? d.profit ?? 0);
  const marginPct = Number(d.margin_pct ?? 0);
  const costRatio = Number(d.cost_ratio ?? d.cost_pct ?? 0);
  const ebitda = Number(d.ebitda ?? 0);

  const payrollCost = Math.abs(Number(d.payroll_cost ?? 0));
  const costFixed = Math.abs(Number(d.cost_fixed ?? 0));
  const costVariable = Math.abs(Number(d.cost_variable ?? 0));
  const totalCost =
    costFixed + costVariable > 0
      ? costFixed + costVariable
      : Math.abs(revenue - ebit);

  const ebitPotential = Number(d.ebit_potential ?? 0);
  const productivity = Number(d.portfolio_productivity ?? d.productivity_rate ?? 0);
  const ebitTarget = Number(d.ebit_target ?? 0);
  const targetMargin = ebitTarget > 1 ? ebitTarget / 100 : ebitTarget || 0.12;
  const targetEbitAbs = revenue * targetMargin;
  const ebitGapRaw = Number(d.ebit_gap ?? 0);
  const ebitGap = ebitGapRaw !== 0 ? ebitGapRaw : ebit - targetEbitAbs;

  // MoM changes
  const revenueMom = Number(d.revenue_mom_pct ?? 0);
  const profitMom = Number(d.profit_mom_pct ?? 0);
  const costMom = Number(d.cost_mom_pct ?? 0);
  const payrollMom = Number(d.payroll_mom_pct ?? 0);

  // Payroll as % of revenue
  const payrollPct = revenue > 0 ? payrollCost / revenue : 0;
  // Cost ratio display
  const costRatioDisplay = costRatio || (revenue > 0 ? totalCost / revenue : 0);

  // Productivity display
  const prodDisplay = productivity > 0
    ? productivity <= 1
      ? fmtPct(productivity)
      : `${Math.round(productivity)} €/Std`
    : '–';
  const prodVsZiel = productivity > 0
    ? productivity <= 1
      ? productivity - 0.70
      : (productivity - 80) / 80
    : 0;

  // Advisory / Einschätzung text
  const advisory = d.advisory_text || d.monatliche_einschaetzung || '';

  // YTD — berechne aus Trend-Daten wenn Backend es nicht liefert
  const ytdFromTrend = trend.slice(-12).reduce(
    (acc: { rev: number; ebit: number }, r: any) => ({
      rev: acc.rev + Math.abs(Number(r.revenue ?? 0)),
      ebit: acc.ebit + Number(r.profit ?? r.ebit ?? 0),
    }),
    { rev: 0, ebit: 0 }
  );
  const ytdRevenue = Number(d.ytd_revenue ?? 0) || ytdFromTrend.rev;
  const ytdEbit = Number(d.ytd_ebit ?? d.ytd_profit ?? 0) || ytdFromTrend.ebit;
  const ytdMargin = Number(d.ytd_margin_pct ?? 0) || (ytdRevenue > 0 ? ytdEbit / ytdRevenue : 0);

  // Chart data
  const chartData = trend.slice(-12);
  const maxRev = chartData.reduce((m: number, r: any) => Math.max(m, Math.abs(Number(r.revenue ?? 0))), 1);
  const maxEbit = chartData.reduce((m: number, r: any) => Math.max(m, Math.abs(Number(r.profit ?? r.ebit ?? 0))), 1);

  return (
    <div className="space-y-5">
      {/* ── Section Title ── */}
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          Monatliche Gesamtlage
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Wie steht das Unternehmen diesen Monat?
        </p>
        <div className="copper-line" />
      </div>

      {/* ── Hero Row: EBIT Card (left) + 2×2 KPI Grid (right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* EBIT Hero Card — dark navy background */}
        <div
          className="lg:col-span-2 rounded-xl p-5"
          style={{
            backgroundColor: 'var(--navy)',
            color: '#FFFFFF',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Status badge top-right */}
          <div
            className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold"
            style={{
              backgroundColor: st.color + '30',
              color: st.color,
            }}
          >
            {st.label}
          </div>

          <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            EBIT (Monat)
          </div>
          <div className="text-3xl font-extrabold mb-1" style={{ color: ebit < 0 ? '#E88080' : '#FFFFFF' }}>
            {fmtEur(ebit)}
          </div>
          {ebit < 0 && (
            <div className="text-xs font-semibold mb-2" style={{ color: '#E88080' }}>
              Verlust
            </div>
          )}

          {/* Margin badge */}
          <div className="flex items-center gap-2 mb-3">
            <span
              className="px-2 py-0.5 rounded text-xs font-bold"
              style={{
                backgroundColor: marginPct < 0.05 ? 'rgba(196,56,48,0.25)' : marginPct < 0.10 ? 'rgba(232,168,56,0.25)' : 'rgba(46,139,87,0.25)',
                color: marginPct < 0.05 ? '#E88080' : marginPct < 0.10 ? '#E8A838' : '#6ECF91',
              }}
            >
              {fmtPct(marginPct)} Marge
            </span>
            {profitMom !== 0 && (
              <span className="text-xs" style={{ color: momColor(profitMom) }}>
                {momArrow(profitMom)} {fmtPctSigned(profitMom)} MoM
              </span>
            )}
          </div>

          {/* Hebelpotenzial */}
          {ebitPotential > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Hebelpotenzial
              </div>
              <div className="text-xl font-bold" style={{ color: '#6ECF91' }}>
                +{fmtEur(ebitPotential)}
              </div>
            </div>
          )}

          {/* EBITDA if available */}
          {ebitda > 0 && (
            <div className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
              EBITDA: {fmtEur(ebitda)}
            </div>
          )}
        </div>

        {/* 2×2 KPI Grid */}
        <div className="lg:col-span-3 grid grid-cols-2 gap-3">
          {/* Monatsumsatz */}
          <div className="card text-center">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
              Monatsumsatz (MRR)
            </div>
            <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {fmtEur(revenue)}
            </div>
            {revenueMom !== 0 && (
              <div className="text-xs mt-1" style={{ color: momColor(revenueMom) }}>
                {momArrow(revenueMom)} {fmtPctSigned(revenueMom)} Vormonat
              </div>
            )}
          </div>

          {/* Produktivität */}
          <div className="card text-center">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>Produktivität</div>
            <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{prodDisplay}</div>
            {prodVsZiel !== 0 && (
              <div className="text-xs mt-1" style={{ color: prodVsZiel > 0 ? '#2E8B57' : '#C43830' }}>
                {momArrow(prodVsZiel)} {fmtPctSigned(prodVsZiel)} vs. Ziel
              </div>
            )}
          </div>

          {/* Kostenquote */}
          <div className="card text-center">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>Kostenquote</div>
            <div className="text-xl font-bold" style={{
              color: costRatioDisplay > 0.95 ? 'var(--danger)' : costRatioDisplay > 0.88 ? 'var(--warning)' : 'var(--text-primary)'
            }}>
              {fmtPct(costRatioDisplay)}
            </div>
            {costMom !== 0 && (
              <div className="text-xs mt-1" style={{ color: momColor(-costMom) }}>
                {momArrow(-costMom)} {fmtPctSigned(-costMom)} Vormonat
              </div>
            )}
          </div>

          {/* Personalkosten */}
          <div className="card text-center">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>Personalkosten</div>
            <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{payrollPct > 0 ? fmtPct(payrollPct) : fmtEur(payrollCost)}</div>
            {payrollMom !== 0 && (
              <div className="text-xs mt-1" style={{ color: momColor(-payrollMom) }}>
                {momArrow(-payrollMom)} {fmtPctSigned(-payrollMom)} Vormonat
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── EBIT Target Bar ── */}
      {revenue > 0 && (
        <div className="card" style={{ padding: '0.75rem 1.25rem' }}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: ebitGap < 0 ? 'var(--danger)' : 'var(--success)' }}>
                {ebitGap < 0 ? '▼ EBIT UNTER ZIEL' : '▲ EBIT IM ZIEL'}
              </span>
              <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>
                · Ziel {fmtPct(targetMargin)} Marge
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Ziel-EBIT ({fmtPct(targetMargin)})</span>
              <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{fmtEur(targetEbitAbs)}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-lg font-bold" style={{ color: ebitGap < 0 ? 'var(--danger)' : 'var(--success)' }}>
              {ebitGap >= 0 ? '+' : ''}{fmtEur(ebitGap)}
            </div>
            <div className="flex-1 h-2.5 rounded-full" style={{ backgroundColor: 'var(--border-color)' }}>
              <div className="h-2.5 rounded-full transition-all" style={{
                width: `${Math.min(Math.max(marginPct / targetMargin * 100, 5), 100)}%`,
                backgroundColor: ebitGap < 0 ? 'var(--danger)' : 'var(--success)',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Monatliche Einschätzung ── */}
      {advisory && (
        <div className="rounded-lg p-4" style={{ backgroundColor: 'rgba(232,168,56,0.08)', border: '1px solid rgba(232,168,56,0.2)' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--warning)' }}>
            ● Monatliche Einschätzung
          </div>
          <div className="text-sm" style={{ color: 'var(--text-primary)', lineHeight: '1.7' }}>{advisory}</div>
        </div>
      )}

      {/* ── YTD Summary ── */}
      {(ytdRevenue > 0 || ytdEbit !== 0) && (
        <div className="card flex items-center gap-6" style={{ padding: '0.75rem 1.25rem' }}>
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            YTD (12 Monate)
          </div>
          <div className="flex items-center gap-6 flex-1">
            <div>
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Umsatz Kum.</span>
              <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{fmtEurK(ytdRevenue)}</div>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>EBIT Kum.</span>
              <div className="text-lg font-bold" style={{ color: ytdEbit < 0 ? 'var(--danger)' : '#2E8B57' }}>{fmtEur(ytdEbit)}</div>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Ø Marge</span>
              <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{ytdMargin > 0 ? fmtPct(ytdMargin) : '–'}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── 12-Monats-Trend Chart (SVG Bar + Line) ── */}
      {chartData.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold" style={{ color: 'var(--warning)' }}>●</span>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Umsatz & EBIT Trend (12M)</h3>
          </div>
          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span className="flex items-center gap-1"><span style={{ display: 'inline-block', width: 14, height: 10, backgroundColor: 'rgba(212,149,106,0.4)', borderRadius: 2 }} /> Umsatz</span>
            <span className="flex items-center gap-1"><span style={{ display: 'inline-block', width: 14, height: 2, backgroundColor: 'var(--navy)' }} /> EBIT</span>
          </div>
          <svg viewBox="0 0 700 220" style={{ width: '100%', height: 'auto' }}>
            {/* Y-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
              const y = 190 - f * 170;
              const val = maxRev * f;
              return (
                <g key={`yL${i}`}>
                  <line x1="50" y1={y} x2="690" y2={y} stroke="var(--border-color)" strokeWidth="0.5" />
                  <text x="46" y={y + 3} textAnchor="end" fontSize="9" fill="var(--text-secondary)">{fmtEurK(val)}</text>
                </g>
              );
            })}
            {/* EBIT Y-axis (right) */}
            {[0, 0.5, 1].map((f, i) => {
              const y = 190 - f * 170;
              const val = maxEbit * f;
              return <text key={`yR${i}`} x="694" y={y + 3} textAnchor="start" fontSize="9" fill="var(--text-secondary)">{fmtEurK(val)}</text>;
            })}
            {/* Bars + Line */}
            {chartData.map((row, i) => {
              const rev = Number(row.revenue ?? 0);
              const ebitVal = Number(row.profit ?? row.ebit ?? 0);
              const barH = maxRev > 0 ? (rev / maxRev) * 170 : 0;
              const colW = 635 / chartData.length;
              const x = 55 + i * colW + colW * 0.15;
              const barW = colW * 0.7;
              const lineY = 190 - (maxEbit > 0 ? (Math.abs(ebitVal) / maxEbit) * 170 : 0);
              const label = row.month_label_short || row.month_label || '';
              return (
                <g key={i}>
                  <rect x={x} y={190 - barH} width={barW} height={Math.max(barH, 0)} fill="rgba(212,149,106,0.35)" rx="2" />
                  {i > 0 && (() => {
                    const prevEbit = Math.abs(Number(chartData[i - 1].profit ?? chartData[i - 1].ebit ?? 0));
                    const prevY = 190 - (maxEbit > 0 ? (prevEbit / maxEbit) * 170 : 0);
                    const prevX = 55 + (i - 1) * colW + colW * 0.5;
                    const curX = x + barW / 2;
                    return <line x1={prevX} y1={prevY} x2={curX} y2={lineY} stroke="var(--navy)" strokeWidth="2" />;
                  })()}
                  <circle cx={x + barW / 2} cy={lineY} r="3" fill="var(--navy)" />
                  <text x={x + barW / 2} y="207" textAnchor="middle" fontSize="8" fill="var(--text-secondary)">{label}</text>
                </g>
              );
            })}
          </svg>
          {/* 3M average */}
          {chartData.length >= 3 && (() => {
            const last3 = chartData.slice(-3);
            const avg3 = last3.reduce((s: number, r: any) => s + Number(r.revenue ?? 0), 0) / 3;
            return (
              <div className="text-center text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Ø Umsatz 3M: {fmtEur(avg3)} | Gleitender Durchschnitt
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Kostenstruktur ── */}
      {totalCost > 0 && (
        <div className="card">
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Kostenstruktur</h3>
          <div className="space-y-3">
            {costVariable > 0 && <CostBar label="Variable Kosten" value={costVariable} total={totalCost} color="#3B82F6" />}
            {costFixed > 0 && <CostBar label="Fixkosten" value={costFixed} total={totalCost} color="#6366F1" />}
            {payrollCost > 0 && <CostBar label="davon Personalkosten" value={payrollCost} total={totalCost} color="#8B5CF6" indent />}
          </div>
        </div>
      )}
    </div>
  );
}

function CostBar({ label, value, total, color, indent }: { label: string; value: number; total: number; color: string; indent?: boolean }) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  return (
    <div className={indent ? 'ml-6' : ''}>
      <div className="flex justify-between text-sm mb-1">
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{fmtEur(value)} <span style={{ color: 'var(--text-secondary)' }}>({pct.toFixed(0)} %)</span></span>
      </div>
      <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--border-color)' }}>
        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
