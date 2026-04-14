'use client';
import { useState } from 'react';

interface Props {
  data: any;
}

// ââ Formatters âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const fmtEur = (n: any) =>
  n != null
    ? new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(Number(n))
    : 'â';

const fmtEurK = (n: any) => {
  if (n == null) return 'â';
  const v = Number(n);
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')} Mio â¬`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k â¬`;
  return fmtEur(v);
};

const fmtPct = (n: any) =>
  n != null ? `${(Number(n) * 100).toFixed(1)} %` : 'â';

const fmtPctSigned = (n: any) => {
  if (n == null) return 'â';
  const val = Number(n) * 100;
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(1)} %`;
};

const statusInfo = (s: string) => {
  const u = (s || '').toUpperCase();
  if (u === 'GRÃN' || u === 'GREEN' || u === 'GUT')
    return { label: 'GUT', color: '#2E8B57', bg: 'rgba(46,139,87,0.08)' };
  if (u === 'GELB' || u === 'YELLOW' || u === 'WARNUNG')
    return { label: 'WARNUNG', color: '#E8A838', bg: 'rgba(232,168,56,0.08)' };
  if (u === 'ROT' || u === 'RED' || u === 'KRITISCH')
    return { label: 'KRITISCH', color: '#C43830', bg: 'rgba(196,56,48,0.08)' };
  return { label: s || 'â', color: '#6B7A90', bg: 'rgba(107,122,144,0.08)' };
};

const momColor = (n: any) => {
  if (n == null) return 'var(--text-secondary)';
  const val = Number(n);
  return val > 0 ? '#2E8B57' : val < 0 ? '#C43830' : 'var(--text-secondary)';
};

const momArrow = (n: any) => {
  if (n == null) return '';
  const val = Number(n);
  return val > 0.001 ? 'â²' : val < -0.001 ? 'â¼' : 'â';
};

// ââ Sparkline helper ââââââââââââââââââââââââââââââââââââââââââââââââââââ
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

// ââ Main Component âââââââââââââââââââââââââââââââââââââââââââââââââââââ
export default function Page1Gesamtlage({ data }: Props) {
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
  const targetMargin = ebitTarget > 1 ? ebitTarget / 100 : ebitTarget || 0.12;
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
      : `${Math.round(productivity)} â¬/Std`
    : 'â';
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

  const [clickIdx, setClickIdx] = useState<number | null>(null);

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
    <div className="space-y-5">
      {/* ââ Section Title ââ */}
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          Monatliche Gesamtlage
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Wie steht das Unternehmen diesen Monat?
        </p>
        <div className="copper-line" />
      </div>

      {/* ââ Hero + 4 KPI Tiles ââ */}
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
                EBIT â MONATSERGEBNIS
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
                  {momArrow(profitMom)} {fmtPctSigned(profitMom)} ggÃ¼. Vormonat
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
                  <span style={{ color: 'rgba(255,255,255,0.5)', margin: '0 6px' }}>Â·</span>
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

        {/* ââ 4 KPI Tiles 2Ã2 ââ */}
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
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>ProduktivitÃ¤t</div>
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
              <div className="text-sm font-semibold" style={{ color: momColor(-costMom) }}>
                {momArrow(-costMom)} {fmtPctSigned(-costMom)} Vormonat
              </div>
            )}
          </div>
          <div className="card">
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>Personalkosten</div>
            <div className="text-3xl font-bold leading-none mb-2" style={{ color: 'var(--text-primary)' }}>{payrollPct > 0 ? fmtPct(payrollPct) : fmtEur(payrollCost)}</div>
            {payrollMom !== 0 ? (
              <div className="text-sm font-semibold" style={{ color: momColor(-payrollMom) }}>
                {momArrow(-payrollMom)} {fmtPctSigned(-payrollMom)} Vormonat
              </div>
            ) : payrollPctDelta !== 0 ? (
              <div className="text-sm font-semibold" style={{ color: momColor(-payrollPctDelta) }}>
                {momArrow(-payrollPctDelta)} {payrollPctDelta > 0 ? '+' : ''}{(payrollPctDelta * 100).toFixed(1)} %p Vormonat
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ââ EBIT Target Bar ââ */}
      {revenue > 0 && (
        <div className="card" style={{ padding: '0.75rem 1.25rem' }}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: ebitGap < 0 ? 'var(--danger)' : 'var(--success)' }}>
                {ebitGap < 0 ? 'â¼ EBIT UNTER ZIEL' : 'â² EBIT IM ZIEL'}
              </span>
              <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>
                Â· Ziel {fmtPct(targetMargin)} Marge
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

      {/* ââ Monatliche EinschÃ¤tzung ââ */}
      {advisory && (
        <div className="rounded-lg p-4" style={{ backgroundColor: 'rgba(232,168,56,0.08)', border: '1px solid rgba(232,168,56,0.2)' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--warning)' }}>
            â Monatliche EinschÃ¤tzung
          </div>
          <div className="text-sm" style={{ color: 'var(--text-primary)', lineHeight: '1.7' }}>{advisory}</div>
        </div>
      )}

      {/* ââ YTD Summary ââ */}
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
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Ã Marge</span>
              <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{ytdMargin > 0 ? fmtPct(ytdMargin) : 'â'}</div>
            </div>
          </div>
        </div>
      )}

      {/* ââ 12-Monats-Trend Chart (Gradient Bars + Smooth Bezier EBIT + Datenbeschriftungen) ââ */}
      {chartData.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold" style={{ color: 'var(--warning)' }}>â</span>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Umsatz & EBIT Trend (12M)</h3>
          </div>
          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span className="flex items-center gap-1">
              <span style={{ display: 'inline-block', width: 14, height: 10, background: 'linear-gradient(180deg,rgba(29,53,87,0.65) 0%,rgba(29,53,87,0.08) 100%)', borderRadius: 2 }} />
              Umsatz
            </span>
            <span className="flex items-center gap-1">
              <span style={{ display: 'inline-block', width: 20, height: 2, backgroundColor: '#D49564', borderRadius: 1 }} />
              EBIT
            </span>
          </div>
          {/* viewBox expanded to 240 height; BASELINE=200, CHART_H=165 */}
          <svg viewBox="0 0 700 240" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
            <defs>
              <linearGradient id="p1barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(29,53,87,1)" stopOpacity="0.65" />
                <stop offset="100%" stopColor="rgba(29,53,87,0)" stopOpacity="0.06" />
              </linearGradient>
              <linearGradient id="p1ebitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D49564" stopOpacity="0.20" />
                <stop offset="100%" stopColor="#D49564" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Dashed grid lines (baseline=200, chart_h=165) */}
            {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
              const y = BASELINE - f * CHART_H;
              const val = maxRev * f;
              return (
                <g key={`yL${i}`}>
                  <line x1="50" y1={y} x2="690" y2={y} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="4 3" />
                  <text x="46" y={y + 3} textAnchor="end" fontSize="9" fill="var(--text-secondary)">{fmtEurK(val)}</text>
                </g>
              );
            })}

            {/* Right Y-axis (EBIT scale) */}
            {[0, 0.5, 1].map((f, i) => {
              const y = BASELINE - f * CHART_H;
              const val = maxEbit * f;
              return <text key={`yR${i}`} x="694" y={y + 3} textAnchor="start" fontSize="9" fill="var(--text-secondary)">{fmtEurK(val)}</text>;
            })}

            {/* Revenue bars with gradient fill + Umsatz-Datenbeschriftung */}
            {chartData.map((row: any, i: number) => {
              const rev = Math.abs(Number(row.revenue ?? 0));
              const barH = maxRev > 0 ? (rev / maxRev) * CHART_H : 0;
              const colW = 635 / chartData.length;
              const x = 55 + i * colW + colW * 0.28;
              const barW = colW * 0.44;
              const barTop = BASELINE - Math.max(barH, 0);
              const label = row.month_label_short || row.month_label || '';
              const cx = x + barW / 2;
              const isSelected = clickIdx === i;
              return (
                <g key={`bar${i}`}
                  onClick={() => setClickIdx(prev => prev === i ? null : i)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect x={x - colW * 0.28} y={20} width={colW} height={BASELINE - 20} fill="transparent" />
                  <rect x={x} y={barTop} width={barW} height={Math.max(barH, 0)} fill="url(#p1barGrad)" rx="3"
                    opacity={clickIdx !== null && !isSelected ? 0.45 : 1}
                  />
                  <text x={cx} y={BASELINE + 17} textAnchor="middle" fontSize="8" fill={isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'}>{label}</text>
                </g>
              );
            })}

            {/* EBIT smooth Catmull-Rom bezier curve + area fill + Datenbeschriftungen */}
            {chartData.length >= 2 && (() => {
              const colW = 635 / chartData.length;
              const pts = chartData.map((row: any, i: number) => ({
                x: 55 + i * colW + colW * 0.5,
                y: BASELINE - (maxEbit > 0 ? (Math.abs(Number(row.profit ?? row.ebit ?? 0)) / maxEbit) * CHART_H : 0),
                val: Number(row.profit ?? row.ebit ?? 0),
                rev: Number(row.revenue ?? 0),
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
                  <path d={areaPath} fill="url(#p1ebitGrad)" />
                  <path d={linePath} fill="none" stroke="#D49564" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  {pts.map((pt, idx) => {
                    const isHov = clickIdx === idx;
                    const rev = Math.abs(Number(chartData[idx]?.revenue ?? 0));
                    const tooltipW = 90;
                    const tx = Math.min(Math.max(pt.x - tooltipW / 2, 52), 640);
                    const ty = Math.max(pt.y - 52, 8);
                    return (
                      <g key={idx}>
                        <circle cx={pt.x} cy={pt.y} r={isHov ? 5 : 3.5} fill="#D49564" stroke="#fff" strokeWidth="1.5" />
                        {isHov && (
                          <g>
                            <rect x={tx} y={ty} width={tooltipW} height={36} rx="5" fill="var(--navy)" opacity="0.92" />
                            <text x={tx + tooltipW/2} y={ty + 13} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#D49564">EBIT {fmtEurK(pt.val)}</text>
                            <text x={tx + tooltipW/2} y={ty + 25} textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.7)">Umsatz {fmtEurK(rev)}</text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })()}
          </svg>
          {chartData.length >= 3 && (() => {
            const last3 = chartData.slice(-3);
            const avg3 = last3.reduce((s: number, r: any) => s + Number(r.revenue ?? 0), 0) / 3;
            return (
              <div className="text-center text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Ã Umsatz 3M: {fmtEur(avg3)} | Gleitender Durchschnitt
              </div>
            );
          })()}
        </div>
      )}

      {/* ââ Kostenstruktur ââ */}
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
