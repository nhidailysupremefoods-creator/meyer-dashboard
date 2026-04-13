'use client';

import React, { useMemo } from 'react';
import styles from './Page3Liquiditaet.module.css';

interface CashflowSummary {
  bank_balance_eur?: number;
  liquidity_months?: number;
  target_months?: number;
  cashflow_eur?: number;
  cashflow_margin_pct?: number;
  margin_pct?: number;
  cost_coverage_pct?: number;
  stability_score?: number;
  status_color?: string;
  month_label?: string;
  month_id?: string;
  period_date?: string;
}

interface TrendRow {
  month_label?: string;
  month_label_short?: string;
  month_id?: string;
  bank_balance_eur?: number;
  cashflow_eur?: number;
  period_date?: string;
  month_sort_date?: string;
}

interface StressRow {
  scenario_name?: string;
  revenue_shock_pct?: number;
  net_cashflow_impact_eur?: number;
  revenue_impact_eur?: number;
  variable_cost_relief_eur?: number;
  net_impact_eur?: number;
  period_date?: string;
  month_id?: string;
}

interface Page3Data {
  summary?: CashflowSummary | CashflowSummary[];
  trend?: TrendRow[];
  stress?: StressRow | StressRow[];
  break_even?: unknown[];
}

interface Props {
  data: Page3Data | null | undefined;
}

function fmt(n?: number, decimals = 0): string {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function fmtPct(n?: number, decimals = 1): string {
  if (n == null || isNaN(n)) return '—';
  const val = Math.abs(n) > 1 ? n : n * 100;
  return val.toFixed(decimals).replace('.', ',') + '%';
}

function fmtMonths(n?: number): string {
  if (n == null || isNaN(n)) return '—';
  return n.toFixed(1).replace('.', ',');
}

function getStatusColor(s?: string): 'rot' | 'gelb' | 'gruen' {
  const v = (s || '').toUpperCase();
  if (v === 'RED' || v === 'ROT' || v === 'CRITICAL' || v === 'KRITISCH') return 'rot';
  if (v === 'YELLOW' || v === 'GELB' || v === 'WARNING' || v === 'ANGESPANNT') return 'gelb';
  return 'gruen';
}

// ── Bankbestand SVG Chart ─────────────────────────────────
function BankbestandChart({ trend }: { trend: TrendRow[] }) {
  const rows = useMemo(() => {
    return trend
      .filter(r => r.bank_balance_eur != null)
      .slice(-12);
  }, [trend]);

  if (rows.length < 2) return null;

  const W = 800, H = 200, PAD = { top: 16, right: 16, bottom: 40, left: 72 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const values = rows.map(r => r.bank_balance_eur!);
  const maxV = Math.max(...values, 0);
  const minV = Math.min(...values, 0);
  const range = maxV - minV || 1;

  const x = (i: number) => PAD.left + (i / (rows.length - 1)) * innerW;
  const y = (v: number) => PAD.top + ((maxV - v) / range) * innerH;
  const zero = y(0);

  // Build path
  const pts = rows.map((r, i) => `${x(i)},${y(r.bank_balance_eur!)}`).join(' L ');
  const fillPath = `M ${x(0)},${zero} L ${x(0)},${y(rows[0].bank_balance_eur!)} L ${pts} L ${x(rows.length - 1)},${zero} Z`;
  const linePath = `M ${pts.replace(/ L /g, ' L ')}`;

  // Y axis ticks
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => minV + (i / ticks) * range);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.bankChart}>
      <defs>
        <linearGradient id="bankGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4CAF50" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#4CAF50" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line
            x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)}
            stroke="#e0ddd9" strokeWidth="1" strokeDasharray="4 4"
          />
          <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#999">
            {v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0)}
          </text>
        </g>
      ))}
      {/* Zero line */}
      {minV < 0 && (
        <line x1={PAD.left} y1={zero} x2={W - PAD.right} y2={zero}
          stroke="#E53935" strokeWidth="1.5" />
      )}
      {/* Area fill */}
      <path d={fillPath} fill="url(#bankGrad)" />
      {/* Line */}
      <path d={`M ${rows.map((r, i) => `${x(i)},${y(r.bank_balance_eur!)}`).join(' L ')}`}
        fill="none" stroke="#43A047" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
      />
      {/* Data points */}
      {rows.map((r, i) => (
        <circle key={i} cx={x(i)} cy={y(r.bank_balance_eur!)} r="4"
          fill="#fff" stroke="#43A047" strokeWidth="2" />
      ))}
      {/* X axis labels */}
      {rows.map((r, i) => {
        if (rows.length > 8 && i % 2 !== 0) return null;
        const label = r.month_label_short || r.month_label || r.month_id || '';
        return (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#888">
            {label.length > 6 ? label.substring(0, 6) : label}
          </text>
        );
      })}
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────
export default function Page3Liquiditaet({ data }: Props) {
  const raw = data as Page3Data | null;
  const summaryRaw = raw?.summary;
  const summary: CashflowSummary = Array.isArray(summaryRaw)
    ? (summaryRaw[0] ?? {})
    : (summaryRaw ?? {});

  const trend: TrendRow[] = Array.isArray(raw?.trend) ? raw!.trend! : [];
  const stressRaw = raw?.stress;
  const stress: StressRow = Array.isArray(stressRaw)
    ? (stressRaw[0] ?? {})
    : (stressRaw ?? {});

  const liquidity = Number(summary.liquidity_months ?? 0);
  const target = Number(summary.target_months ?? 2.5);
  const bankBalance = Number(summary.bank_balance_eur ?? 0);
  const cashflow = Number(summary.cashflow_eur ?? 0);
  const marginPct = summary.cashflow_margin_pct ?? summary.margin_pct;
  const costCoverage = Number(summary.cost_coverage_pct ?? 0);
  const score = Number(summary.stability_score ?? 0);
  const statusRaw = summary.status_color ?? (liquidity < 1 ? 'KRITISCH' : liquidity < 2 ? 'ANGESPANNT' : 'STABIL');
  const status = getStatusColor(statusRaw);
  const statusLabel = status === 'rot' ? 'KRITISCH' : status === 'gelb' ? 'ANGESPANNT' : 'STABIL';

  const luecke = Math.max(0, target - liquidity);
  const progressPct = Math.min(100, (liquidity / target) * 100);

  // Score label
  const scoreLabel = score >= 70 ? 'STABIL' : score >= 45 ? 'ANGESPANNT' : 'KRITISCH';
  const scoreColor = score >= 70 ? '#43A047' : score >= 45 ? '#F9A825' : '#E53935';

  // Cost coverage
  const coverageOk = costCoverage >= 120;
  const coverageBadge = coverageOk ? 'gedeckt' : 'unterdeckt';
  const costCoverageDisplay = Math.abs(costCoverage) > 1 ? costCoverage : costCoverage * 100;

  // Stress scenario
  const stressImpact = Number(stress.net_cashflow_impact_eur ?? stress.net_impact_eur ?? 0);
  const stressRevenue = Number(stress.revenue_impact_eur ?? 0);
  const stressRelief = Number(stress.variable_cost_relief_eur ?? 0);
  const stressShock = Number(stress.revenue_shock_pct ?? -15);
  const shockLabel = (Math.abs(stressShock) > 1 ? stressShock : stressShock * 100).toFixed(0);

  const hasTrend = trend.length >= 2;

  return (
    <div className={styles.page3Container}>
      {/* ── Page Header ── */}
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Liquiditätsstabilität</h2>
        <p className={styles.pageSubtitle}>
          Frühwarnsystem mit Bankbestand, Stabilitätsscore und Stress-Szenario
        </p>
      </div>

      {/* ── Hero: Liquiditätsreichweite ── */}
      <section className={styles.heroSection}>
        <div className={styles.heroTop}>
          <span className={styles.heroLabel}>LIQUIDITÄTSREICHWEITE</span>
          {status !== 'gruen' && (
            <span className={status === 'rot' ? styles.heroBadgeRot : styles.heroBadgeGelb}>
              {statusLabel}
            </span>
          )}
        </div>
        <div className={styles.heroMain}>
          <span className={status === 'rot' ? styles.heroCountRot : status === 'gelb' ? styles.heroCountGelb : styles.heroCountGruen}>
            {fmtMonths(liquidity)}
          </span>
          <span className={styles.heroUnit}>&nbsp;Monate</span>
        </div>
        <div className={styles.heroMeta}>
          Ziel: {fmtMonths(target)} Monate
          {luecke > 0 && (
            <>&nbsp;&middot;&nbsp;<span className={styles.heroLuecke}>Lücke: {fmtMonths(luecke)} Monate</span></>
          )}
          &nbsp;&middot;&nbsp;Bankbestand: {fmt(bankBalance)} €
        </div>
        <div className={styles.heroProgressBar}>
          <div
            className={status === 'rot' ? styles.heroProgressFillRot : status === 'gelb' ? styles.heroProgressFillGelb : styles.heroProgressFillGruen}
            style={{ width: progressPct + '%' }}
          />
        </div>
      </section>

      {/* ── KPI Cards ── */}
      <div className={styles.kpiSection}>
        <div className={styles.kpiGrid}>
          {/* Cashflow */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>OPERATIVER CASHFLOW</div>
            <div className={cashflow >= 0 ? styles.kpiValueGreen : styles.kpiValueRed}>
              {fmt(cashflow)} €
            </div>
            <div className={styles.kpiSub}>
              OCF-Marge: <strong>{fmtPct(marginPct)}</strong>
            </div>
          </div>

          {/* Stability Score */}
          <div className={styles.kpiCardHighlight}>
            <div className={styles.kpiLabel}>FINANZSTABILITÄT</div>
            <div className={styles.scoreRow}>
              <span className={styles.scoreValue} style={{ color: scoreColor }}>
                {score.toFixed(0)}/100
              </span>
            </div>
            <div className={styles.scoreBarTrack}>
              <div className={styles.scoreBarFill} style={{ width: score + '%', background: scoreColor }} />
            </div>
            <div className={styles.scoreLabelText} style={{ color: scoreColor }}>
              {scoreLabel}
            </div>
          </div>

          {/* Cost coverage */}
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>KOSTENDECKUNGSQUOTE</div>
            <div className={coverageOk ? styles.kpiValueGreen : styles.kpiValueRed}>
              {costCoverageDisplay.toFixed(1).replace('.', ',')}%
            </div>
            <div className={styles.coverageBadgeRow}>
              <span className={coverageOk ? styles.badgeGreen : styles.badgeRed}>
                {coverageBadge}
              </span>
            </div>
            <div className={styles.kpiSub}>Umsatz &divide; Gesamtkosten &middot; Ziel &ge;120%</div>
          </div>
        </div>
      </div>

      {/* ── Bankbestand Grafik ── */}
      {hasTrend && (
        <div className={styles.chartSection}>
          <div className={styles.chartHeader}>
            <span className={styles.chartTitle}>Bankbestand Verlauf</span>
            <span className={styles.chartSubtitle}>in EUR, letzte {trend.length} Monate</span>
          </div>
          <div className={styles.chartBox}>
            <BankbestandChart trend={trend} />
          </div>
        </div>
      )}

      {/* ── Stress-Szenario ── */}
      <section className={styles.stressSection}>
        <div className={styles.stressLabel}>
          STRESS-SZENARIO &middot; {shockLabel}% UMSATZ
        </div>
        <div className={stressImpact < 0 ? styles.stressValueRed : styles.stressValueGreen}>
          {stressImpact >= 0 ? '+' : ''}{fmt(stressImpact)} €
        </div>
        <div className={styles.stressSub}>Netto-OCF-Belastung nach Kostenflex</div>
        {(stressRevenue !== 0 || stressRelief !== 0) && (
          <div className={styles.stressFormula}>
            <span className={styles.stressFormulaRed}>Umsatz {fmt(stressRevenue)} €</span>
            <span className={styles.stressFormulaSep}> — </span>
            <span className={styles.stressFormulaGreen}>var. Kosten +{fmt(Math.abs(stressRelief))} €</span>
            <span className={styles.stressFormulaSep}> = </span>
            <span className={stressImpact < 0 ? styles.stressFormulaRed : styles.stressFormulaGreen}>
              {fmt(stressImpact)} €
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
