'use client';
import { useState, useMemo } from 'react';
import { getMarginTargetsForCustomer } from '@/lib/config';

interface Props {
  data: any;
  industrySegment?: string;
}

// —— Formatters —————————————————————————————————————————————————————————
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

// Für Kosten-Metriken: Anstieg = schlecht (rot), Senkung = gut (grün)
const costColor = (n: any) => {
  if (n == null) return 'var(--text-secondary)';
  const val = Number(n);
  return val > 0 ? '#C43830' : val < 0 ? '#2E8B57' : 'var(--text-secondary)';
};

const momArrow = (n: any) => {
  if (n == null) return '';
  const val = Number(n);
  return val > 0.001 ? '↑' : val < -0.001 ? '↓' : '→';
};

// —— Sparkline helper ————————————————————————————————————————————————————
function Sparkline({ data, width = 160, height = 32 }: { data: number[]; width?: number; height?: number }) {
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
  const isPositive = last >= 0;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={isPositive ? '#D49564' : '#E88080'}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {(() => {
        const lastPt = pts[pts.length - 1].split(',');
        return <circle cx={lastPt[0]} cy={lastPt[1]} r="2.5" fill={isPositive ? '#D49564' : '#E88080'} />;
      })()}
    </svg>
  );
}

// —— Main Component —————————————————————————————————————————————————————
export default function Page1Gesamtlage({ data, industrySegment }: Props) {
  const d = (data as any)?.data || {};
  const trend: any[] = (data as any)?.trend || [];

  const st = statusInfo(d.status_color);
  const revenue = Number(d.revenue || 0);
  const ebit = Number(d.ebit ?? d.profit ?? 0);
  const marginPct = Number(d.margin_pct ?? 0);
  const costRatio = Number(d.cost_ratio ?? d.cost_pct ?? 0);
  const ebitda = Number(d.ebitda ?? 0);
  void ebitda;

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

  // Industry-based target margin from config (mid-point) — fallback to server value or 0.10
  const einsatzlogik = d.einsatzlogik_segment || '';
  const configMarginTargets = useMemo(() =>
    industrySegment ? getMarginTargetsForCustomer(industrySegment, einsatzlogik) : null,
    [industrySegment, einsatzlogik]);
  const configTargetMargin = configMarginTargets ? configMarginTargets[1] : null; // mid-point
  const targetMargin = configTargetMargin || (ebitTarget > 1 ? ebitTarget / 100 : ebitTarget) || 0.10;
  const targetEbitAbs = revenue * targetMargin;
  const ebitGapRaw = Number(d.ebit_gap ?? 0);
  const ebitGap = ebitGapRaw !== 0 ? ebitGapRaw : ebit - targetEbitAbs;

  const revenueMom = Number(d.revenue_mom_pct ?? 0);
  const profitMom = Number(d.profit_mom_pct ?? 0);
  const costMom = Number(d.cost_mom_pct ?? 0);
  const payrollMom = Number(d.payroll_mom_pct ?? 0);

  const payrollPct = revenue > 0 ? payrollCost / revenue : 0;
  const costRatioDisplay = costRatio || (revenue > 0 ? totalCost / revenue : 0);

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

  const prevM = trend.length >= 2 ? trend[trend.length - 2] : null;
  const prevPayrollCost = prevM ? Math.abs(Number(prevM.payroll_cost ?? 0)) : 0;
  const prevRevForPayroll = prevM ? Math.abs(Number(prevM.revenue ?? 0)) : 0;
  const prevPayrollPct = prevRevForPayroll > 0 && prevPayrollCost > 0 ? prevPayrollCost / prevRevForPayroll : 0;
  const payrollPctDelta = payrollPct > 0 && prevPayrollPct > 0 ? payrollPct - prevPayrollPct : 0;

  const advisory = d.advisory_text || d.monatliche_einschaetzung || '';

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

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const chartData = trend.slice(-12);
  const maxRev = chartData.reduce((m: number, r: any) => Math.max(m, Math.abs(Number(r.revenue ?? 0))), 1);
  const maxEbit = chartData.reduce((m: number, r: any) => Math.max(m, Math.abs(Number(r.profit ?? r.ebit ?? 0))), 1);

  const sparklineData = chartData.map((r: any) => Number(r.profit ?? r.ebit ?? 0));

  const pillColor = marginPct < 0.05
    ? { bg: 'rgba(196,56,48,0.30)', text: '#E88080', border: 'rgba(196,56,48,0.45)' }
    : marginPct < 0.10
    ? { bg: 'rgba(232,168,56,0.25)', text: '#E8C050', border: 'rgba(232,168,56,0.40)' }
    : { bg: 'rgba(46,139,87,0.25)', text: '#6ECF91', border: 'rgba(46,139,87,0.40)' };

  // Chart layout constants
  const BASELINE = 200;   // y-coordinate of the x-axis baseline (shifted down for label room)
  const CHART_H = 165;    // height of chart area in SVG units

  return (
    <div>
      {/* —— Section Title —— */}
      <div style={{ padding: '1.75rem 2rem 1.25rem', maxWidth: 1400, margin: 0 }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.35rem', letterSpacing: '0.3px' }}>
          Monatliche Gesamtlage
        </h2>
        <p style={{ fontSize: '0.95rem', color: '#888', margin: 0, fontWeight: 400 }}>
          Wie steht das Unternehmen diesen Monat?
        </p>
      </div>

      <div className="space-y-5" style={{ maxWidth: 1400, margin: '0 auto', padding: '0 2rem' }}>
      {/* —— Hero + 4 KPI Tiles —— */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch">
        <div
          className="rounded-xl"
          style={{ backgroundColor: 'var(--navy)', color: '#FFFFFF', overflow: 'hidden', flexShrink: 0 }}
        >
          <div className="flex flex-col sm:flex-row">
            <div className="flex-1 p-5 pb-4">
              <div
                className="text-xs font-bold uppercase tracking-widest mb-3"
                style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em' }}
              >
                EBIT – MONATSERGEBNIS
              </div>
              <div
                className="text-4xl font-extrabold mb-1 leading-none"
                style={{ color: ebit < 0 ? '#E88080' : '#D49564' }}
              >
                {fmtEur(ebit)}
              </div>
              {sparklineData.length >= 2 && (
                <div className="my-2">
                  <Sparkline data={sparklineData} width={180} height={30} />
                </div>
              )}
              {profitMom !== 0 && (
                <div
                  className="text-sm font-semibold mb-3"
                  style={{ color: profitMom >= 0 ? '#6ECF91' : '#E88080' }}
                >
                  {momArrow(profitMom)} {fmtPctSigned(profitMom)} ggü. Vormonat
                </div>
              )}
              <div
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: pillColor.bg,
                  color: pillColor.text,
                  border: `1px solid ${pillColor.border}`,
                }}
              >
                {fmtPct(marginPct)} EBIT-Marge
                {ebitGap !== 0 && (
                  <span style={{ color: 'rgba(255,255,255,0.5)', margin: '0 6px' }}>·</span>
                )}
                {ebitGap !== 0 && (
                  <span>Abstand: {fmtEur(Math.abs(ebitGap))}</span>
                )}
              </div>
            </div>
            <div
              className="hidden sm:block"
              style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.10)', margin: '20px 0' }}
            />
            <div className="block sm:hidden mx-5" style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.10)' }} />
            <div
              className="p-5 flex flex-row sm:flex-col justify-around sm:justify-center gap-4"
              style={{ minWidth: 180 }}
            >
              <div>
                <div
                  className="text-xs font-bold uppercase tracking-widest mb-1"
                  style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em' }}
                >
                  STATUS
                </div>
                <div
                  className="text-lg font-extrabold uppercase"
                  style={{ color: st.color }}
                >
                  {st.label}
                </div>
              </div>
              {ebitPotential > 0 && (
                <div>
                  <div
                    className="text-xs font-bold uppercase tracking-widest mb-1"
                    style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em' }}
                  >
                    HEBELPOTENZIAL
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span
                      className="text-xl font-extrabold"
                      style={{ color: '#6ECF91' }}
                    >
                      +{fmtEur(ebitPotential)}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: 'rgba(255,255,255,0.45)' }}
                    >
                      / Monat
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* —— 4 KPI Tiles 2×2 —— */}
        <div className="grid grid-cols-2 gap-3 flex-1">
          <div className="card">
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
              Monatsumsatz
            </div>
            <div className="text-3xl font-bold leading-none mb-2" style={{ color: 'var(--text-primary)' }}>
              {fmtEur(revenue)}
            </div>
            {revenueMom !== 0 && (
              <div className="text-sm font-semibold" style={{ color: momColor(revenueMom) }}>
                {momArrow(revenueMom)} {fmtPctSigned(revenueMom)} Vormonat
              </div>
            )}
          </div>
          <div className="card">
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>Produktivität</div>
            <div className="text-3xl font-bold leading-none mb-2" style={{ color: prodVsZiel >= 0 ? '#2E8B57' : 'var(--text-primary)' }}>{prodDisplay}</div>
            {prodVsZiel !== 0 && (
              <div className="text-sm font-semibold" style={{ color: prodVsZiel > 0 ? '#2E8B57' : '#C43830' }}>
                {momArrow(prodVsZiel)} {fmtPctSigned(prodVsZiel)} vs. Ziel
              </div>
            )}
          </div>
          <div className="card">
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>Kostenquote</div>
            <div className="text-3xl font-bold leading-none mb-2" style={{
              color: costRatioDisplay > 0.95 ? 'var(--danger)' : costRatioDisplay > 0.88 ? 'var(--warning)' : 'var(--text-primary)'
            }}>
              {fmtPct(costRatioDisplay)}
            </div>
            {costMom !== 0 && (
              <div className="text-sm font-semibold" style={{ color: costColor(-costMom) }}>
                {momArrow(-costMom)} {fmtPctSigned(-costMom)} Vormonat
              </div>
            )}
          </div>
          <div className="card">
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>Personalkosten</div>
            <div className="text-3xl font-bold leading-none mb-2" style={{ color: 'var(--text-primary)' }}>{payrollPct > 0 ? fmtPct(payrollPct) : fmtEur(payrollCost)}</div>
            {payrollMom !== 0 ? (
              <div className="text-sm font-semibold" style={{ color: costColor(-payrollMom) }}>
                {momArrow(-payrollMom)} {fmtPctSigned(-payrollMom)} Vormonat
              </div>
            ) : payrollPctDelta !== 0 ? (
              <div className="text-sm font-semibold" style={{ color: costColor(payrollPctDelta) }}>
                {momArrow(payrollPctDelta)} {payrollPctDelta > 0 ? '+' : ''}{(payrollPctDelta * 100).toFixed(1)} %p Vormonat
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* —— EBIT Target Bar —— */}
      {revenue > 0 && (
        <div className="card" style={{ padding: '0.75rem 1.25rem' }}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: ebitGap < 0 ? 'var(--danger)' : 'var(--success)' }}>
                {ebitGap < 0 ? '↓ EBIT UNTER ZIEL' : '↑ EBIT IM ZIEL'}
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

      {/* —— Monatliche Einschätzung —— */}
      {advisory && (
        <div className="rounded-lg p-4" style={{ backgroundColor: 'rgba(232,168,56,0.08)', border: '1px solid rgba(232,168,56,0.2)' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--warning)' }}>
            ● Monatliche Einschätzung
          </div>
          <div className="text-sm" style={{ color: 'var(--text-primary)', lineHeight: '1.7' }}>{advisory}</div>
        </div>
      )}

      {/* —— YTD Summary —— */}
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

      {/* —— 12-Monats-Trend Chart (Gradient Bars + Smooth Bezier EBIT + Datenbeschriftungen) —— */}
      {chartData.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold" style={{ color: 'var(--warning)' }}>●</span>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Umsatz & EBIT Trend (12M)</h3>
          </div>
          {/* Enhanced Legend with visual indicators */}
          <div className="flex items-center justify-center gap-6 mb-4 text-xs flex-wrap" style={{ color: 'var(--text-secondary)' }}>
            <span className="flex items-center gap-2">
              <span style={{ display: 'inline-block', width: 16, height: 12, background: 'linear-gradient(180deg,rgba(29,53,87,0.7) 0%,rgba(29,53,87,0.1) 100%)', borderRadius: '3px', border: '1px solid rgba(29,53,87,0.3)' }} />
              Umsatz (links)
            </span>
            <span className="flex items-center gap-2">
              <span style={{ display: 'inline-block', width: 22, height: 2.5, backgroundColor: '#B08A6A', borderRadius: '2px' }} />
              EBIT (rechts)
            </span>
            <span className="flex items-center gap-2">
              <span style={{ display: 'inline-block', width: 22, height: 1.5, backgroundColor: '#E8A838', borderRadius: '2px', borderTop: '2px dashed #E8A838' }} />
              Marge %
            </span>
          </div>
          {/* viewBox expanded for better spacing */}
          <svg viewBox="0 0 750 280" style={{ width: '100%', maxWidth: 900, height: 'auto', overflow: 'visible', display: 'block', margin: '0 auto' }}>
            <defs>
              {/* Revenue bar gradient - subtle dark blue */}
              <linearGradient id="p1barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1D3557" stopOpacity="0.7" />
                <stop offset="40%" stopColor="#1D3557" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#1D3557" stopOpacity="0.08" />
              </linearGradient>

              {/* EBIT area gradient - copper accent */}
              <linearGradient id="p1ebitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#B08A6A" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#B08A6A" stopOpacity="0.01" />
              </linearGradient>

              {/* Margin gradient - warning color */}
              <linearGradient id="p1marginGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E8A838" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#E8A838" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Background grid - subtle (no border, just area) */}

            {/* Horizontal grid lines with labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
              const y = BASELINE - f * CHART_H;
              const val = maxRev * f;
              return (
                <g key={`yL${i}`}>
                  <line x1="60" y1={y} x2="740" y2={y} stroke="var(--border-color)" strokeWidth="0.4" strokeDasharray="3 2" opacity="0.4" />
                  <text x="55" y={y + 4} textAnchor="end" fontSize="10" fontWeight="500" fill="var(--text-secondary)" opacity="0.8">
                    {fmtEurK(val)}
                  </text>
                </g>
              );
            })}

            {/* Right Y-axis (EBIT scale) labels */}
            {[0, 0.5, 1].map((f, i) => {
              const y = BASELINE - f * CHART_H;
              const val = maxEbit * f;
              return (
                <text key={`yR${i}`} x="745" y={y + 4} textAnchor="start" fontSize="10" fontWeight="500" fill="#B08A6A" opacity="0.8">
                  {fmtEurK(val)}
                </text>
              );
            })}

            {/* Axis labels */}
            <text x="28" y={BASELINE + 80} fontSize="10" fontWeight="600" fill="var(--text-secondary)" opacity="0.8">Umsatz</text>
            <text x="720" y="18" fontSize="10" fontWeight="600" fill="#B08A6A">EBIT</text>

            {/* Revenue bars with gradient fill */}
            {chartData.map((row: any, i: number) => {
              const rev = Math.abs(Number(row.revenue ?? 0));
              const barH = maxRev > 0 ? (rev / maxRev) * CHART_H : 0;
              const colW = 680 / chartData.length;
              const x = 60 + i * colW + colW * 0.25;
              const barW = colW * 0.5;
              const barTop = BASELINE - Math.max(barH, 0);
              const label = row.month_label_short || row.month_label || '';
              const cx = x + barW / 2;
              const isSelected = hoverIdx === i;
              const margin = row.margin_pct ? Number(row.margin_pct) : (rev > 0 ? Number(row.profit ?? row.ebit ?? 0) / rev : 0);

              return (
                <g key={`bar${i}`}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Invisible hit area for better hover detection */}
                  <rect x={x - colW * 0.28} y="20" width={colW} height={BASELINE - 20} fill="transparent" />

                  {/* Revenue bar with rounded corners */}
                  <rect
                    x={x}
                    y={barTop}
                    width={barW}
                    height={Math.max(barH, 0)}
                    fill="url(#p1barGrad)"
                    rx="4"
                    ry="4"
                    opacity={hoverIdx !== null && !isSelected ? 0.5 : 1}
                    style={{
                      filter: isSelected ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))' : 'none',
                      transition: 'opacity 0.2s, filter 0.2s'
                    }}
                  />

                  {/* Month label with better positioning */}
                  <text
                    x={cx}
                    y={BASELINE + 18}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight={isSelected ? '600' : '500'}
                    fill={isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'}
                    opacity={isSelected ? 1 : 0.75}
                    style={{ transition: 'all 0.2s' }}
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* Margin percentage line (dashed) — pointerEvents: none damit Bars hover bekommen */}
            {chartData.length >= 2 && (() => {
              const colW = 680 / chartData.length;
              const marginPts = chartData.map((row: any, i: number) => {
                const margin = row.margin_pct ? Number(row.margin_pct) : 0;
                const marginCapped = Math.min(margin, 0.3); // Cap at 30% for scaling
                const y = BASELINE - (marginCapped / 0.3) * CHART_H;
                return {
                  x: 60 + i * colW + colW * 0.5,
                  y: y,
                  val: margin,
                };
              });

              const marginPathParts: string[] = [`M ${marginPts[0].x} ${marginPts[0].y}`];
              for (let i = 0; i < marginPts.length - 1; i++) {
                const p0 = marginPts[Math.max(0, i - 1)];
                const p1 = marginPts[i];
                const p2 = marginPts[i + 1];
                const p3 = marginPts[Math.min(marginPts.length - 1, i + 2)];
                const cp1x = p1.x + (p2.x - p0.x) / 6;
                const cp1y = p1.y + (p2.y - p0.y) / 6;
                const cp2x = p2.x - (p3.x - p1.x) / 6;
                const cp2y = p2.y - (p3.y - p1.y) / 6;
                marginPathParts.push(`C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x} ${p2.y}`);
              }
              const marginPath = marginPathParts.join(' ');

              return (
                <g opacity={hoverIdx === null ? 0.6 : 0.3} style={{ transition: 'opacity 0.2s', pointerEvents: 'none' }}>
                  <path
                    d={marginPath}
                    fill="none"
                    stroke="#E8A838"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </g>
              );
            })()}

            {/* EBIT smooth Catmull-Rom bezier curve */}
            {chartData.length >= 2 && (() => {
              const colW = 680 / chartData.length;
              const pts = chartData.map((row: any, i: number) => ({
                x: 60 + i * colW + colW * 0.5,
                y: BASELINE - (maxEbit > 0 ? (Math.abs(Number(row.profit ?? row.ebit ?? 0)) / maxEbit) * CHART_H : 0),
                val: Number(row.profit ?? row.ebit ?? 0),
                rev: Math.abs(Number(row.revenue ?? 0)),
                cost: Math.abs(Number(row.cost ?? row.cost_total ?? 0)) || (Math.abs(Number(row.revenue ?? 0)) - Number(row.profit ?? row.ebit ?? 0)),
                margin: row.margin_pct ? Number(row.margin_pct) : 0,
                label: row.month_label_short || row.month_label || '',
              }));

              const pathParts: string[] = [`M ${pts[0].x} ${pts[0].y}`];
              for (let i = 0; i < pts.length - 1; i++) {
                const p0 = pts[Math.max(0, i - 1)];
                const p1 = pts[i];
                const p2 = pts[i + 1];
                const p3 = pts[Math.min(pts.length - 1, i + 2)];
                const cp1x = p1.x + (p2.x - p0.x) / 6;
                const cp1y = p1.y + (p2.y - p0.y) / 6;
                const cp2x = p2.x - (p3.x - p1.x) / 6;
                const cp2y = p2.y - (p3.y - p1.y) / 6;
                pathParts.push(`C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x} ${p2.y}`);
              }

              const linePath = pathParts.join(' ');
              const last = pts[pts.length - 1];
              const first = pts[0];
              const areaPath = `${linePath} L ${last.x} ${BASELINE} L ${first.x} ${BASELINE} Z`;

              return (
                <g>
                  {/* EBIT area + line — pointerEvents: none damit Bars hover bekommen */}
                  <g style={{ pointerEvents: 'none' }}>
                    <path
                      d={areaPath}
                      fill="url(#p1ebitGrad)"
                      opacity={hoverIdx === null ? 1 : 0.7}
                      style={{ transition: 'opacity 0.2s' }}
                    />
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#B08A6A"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      opacity={hoverIdx === null ? 1 : 0.8}
                      style={{ transition: 'opacity 0.2s' }}
                    />
                  </g>

                  {/* Vertical crosshair + Data points + tooltips */}
                  {pts.map((pt, idx) => {
                    const isHov = hoverIdx === idx;
                    const tooltipW = 150;
                    const tooltipH = isHov ? 88 : 0;
                    const tx = Math.min(Math.max(pt.x - tooltipW / 2, 62), 600);
                    const ty = Math.max(pt.y - tooltipH - 12, 10);

                    return (
                      <g key={idx} style={{ pointerEvents: 'none' }}>
                        {/* Vertical crosshair line on hover */}
                        {isHov && (
                          <line
                            x1={pt.x} y1={25} x2={pt.x} y2={BASELINE}
                            stroke="#B08A6A" strokeWidth="1" strokeDasharray="3 3" opacity="0.35"
                          />
                        )}

                        {/* Data point circle */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHov ? 6 : 3.5}
                          fill="#B08A6A"
                          stroke="#fff"
                          strokeWidth={isHov ? 2 : 1.5}
                          opacity={isHov ? 1 : 0.85}
                          style={{
                            filter: isHov ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.2))' : 'none',
                            transition: 'r 0.2s, opacity 0.2s'
                          }}
                        />

                        {/* Tooltip with 4 key metrics */}
                        {isHov && (
                          <g>
                            <rect
                              x={tx} y={ty} width={tooltipW} height={tooltipH}
                              rx="6" ry="6" fill="var(--navy)" opacity="0.96"
                              stroke="#B08A6A" strokeWidth="1"
                              style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}
                            />

                            {/* Month label */}
                            <text x={tx + tooltipW / 2} y={ty + 14} textAnchor="middle" fontSize="10" fontWeight="700" fill="#B08A6A">
                              {pt.label}
                            </text>

                            {/* Separator */}
                            <line x1={tx + 8} y1={ty + 20} x2={tx + tooltipW - 8} y2={ty + 20} stroke="rgba(176,138,106,0.25)" strokeWidth="0.5" />

                            {/* Revenue */}
                            <text x={tx + 8} y={ty + 34} fontSize="9" fontWeight="500" fill="rgba(255,255,255,0.7)">Umsatz:</text>
                            <text x={tx + tooltipW - 8} y={ty + 34} textAnchor="end" fontSize="9" fontWeight="600" fill="rgba(255,255,255,0.95)">{fmtEur(pt.rev)}</text>

                            {/* Kosten */}
                            <text x={tx + 8} y={ty + 49} fontSize="9" fontWeight="500" fill="rgba(255,255,255,0.7)">Kosten:</text>
                            <text x={tx + tooltipW - 8} y={ty + 49} textAnchor="end" fontSize="9" fontWeight="600" fill="rgba(255,255,255,0.85)">{fmtEur(pt.cost)}</text>

                            {/* EBIT */}
                            <text x={tx + 8} y={ty + 64} fontSize="9" fontWeight="500" fill="rgba(255,255,255,0.7)">EBIT:</text>
                            <text x={tx + tooltipW - 8} y={ty + 64} textAnchor="end" fontSize="9" fontWeight="600" fill={pt.val >= 0 ? '#6ECF91' : '#E88080'}>{fmtEur(pt.val)}</text>

                            {/* Margin */}
                            <text x={tx + 8} y={ty + 79} fontSize="9" fontWeight="500" fill="rgba(255,255,255,0.7)">Marge:</text>
                            <text x={tx + tooltipW - 8} y={ty + 79} textAnchor="end" fontSize="9" fontWeight="600" fill="#E8A838">{fmtPct(pt.margin)}</text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })()}
          </svg>
          {/* Summary statistics */}
          {chartData.length >= 3 && (() => {
            const last3 = chartData.slice(-3);
            const avg3Rev = last3.reduce((s: number, r: any) => s + Math.abs(Number(r.revenue ?? 0)), 0) / 3;
            const avg3Ebit = last3.reduce((s: number, r: any) => s + Number(r.profit ?? r.ebit ?? 0), 0) / 3;
            const avg3Margin = avg3Rev > 0 ? avg3Ebit / avg3Rev : 0;
            const minEbit = Math.min(...chartData.map((r: any) => Number(r.profit ?? r.ebit ?? 0)));
            const maxEbitVal = Math.max(...chartData.map((r: any) => Number(r.profit ?? r.ebit ?? 0)));

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <div className="text-center">
                  <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Ø Umsatz 3M</div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{fmtEur(avg3Rev)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Ø EBIT 3M</div>
                  <div className="text-sm font-bold" style={{ color: avg3Ebit >= 0 ? '#2E8B57' : '#C43830' }}>{fmtEur(avg3Ebit)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Ø Marge 3M</div>
                  <div className="text-sm font-bold" style={{ color: '#E8A838' }}>{fmtPct(avg3Margin)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>EBIT Range</div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{fmtEur(minEbit)} bis {fmtEur(maxEbitVal)}</div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* —— Kostenstruktur —— */}
      {totalCost > 0 && (
        <div className="card">
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Kostenstruktur</h3>
          <div className="space-y-3">
            {costVariable > 0 && <CostBar label="Variable Kosten" value={costVariable} total={totalCost} color="#1D3557" />}
            {costFixed > 0 && <CostBar label="Fixkosten" value={costFixed} total={totalCost} color="#D49564" />}
            {payrollCost > 0 && <CostBar label="davon Personalkosten" value={payrollCost} total={totalCost} color="#8D99AE" indent />}
          </div>
        </div>
      )}
      </div>
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
