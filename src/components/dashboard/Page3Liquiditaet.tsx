'use client';
import React from 'react';
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
}

interface TrendRow {
  month_label?: string;
  month_label_short?: string;
  month_id?: string;
  bank_balance_eur?: number;
}

interface StressRow {
  revenue_shock_pct?: number;
  net_cashflow_impact_eur?: number;
  net_impact_eur?: number;
  revenue_impact_eur?: number;
  variable_cost_relief_eur?: number;
}

interface Page3Data {
  summary?: CashflowSummary | CashflowSummary[];
  trend?: TrendRow[];
  stress?: StressRow | StressRow[];
}

interface Props {
  data: Page3Data | null | undefined;
}

function fmt(n?: number): string {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(n);
}

function fmtMonths(n?: number): string {
  if (n == null || isNaN(n)) return '—';
  return n.toFixed(1).replace('.', ',');
}

function fmtPct(n?: number): string {
  if (n == null || isNaN(n)) return '—';
  const val = Math.abs(n) > 1 ? n : n * 100;
  return val.toFixed(1).replace('.', ',') + '%';
}

function getStatus(s?: string, months?: number): 'rot' | 'gelb' | 'gruen' {
  const v = (s || '').toUpperCase();
  if (v === 'RED' || v === 'ROT' || v === 'CRITICAL' || v === 'KRITISCH') return 'rot';
  if (v === 'YELLOW' || v === 'GELB' || v === 'WARNING' || v === 'ANGESPANNT') return 'gelb';
  if (!s && months != null) return months < 1.5 ? 'rot' : months < 2.5 ? 'gelb' : 'gruen';
  return 'gruen';
}

function BankChart({ trend }: { trend: TrendRow[] }) {
  const rows = trend.filter(r => r.bank_balance_eur != null).slice(-12);
  if (rows.length < 2) return null;

  const W = 760; const H = 180;
  const pl = 64; const pr = 12; const pt = 14; const pb = 36;
  const iW = W - pl - pr; const iH = H - pt - pb;

  const vals = rows.map(r => r.bank_balance_eur as number);
  const maxV = Math.max(...vals, 1);
  const minV = Math.min(...vals, 0);
  const rng = maxV - minV || 1;

  const cx = (i: number) => pl + (i / (rows.length - 1)) * iW;
  const cy = (v: number) => pt + ((maxV - v) / rng) * iH;
  const zeroY = cy(0);

  const ptStr = rows.map((r, i) =>
    cx(i).toFixed(1) + ',' + cy(r.bank_balance_eur as number).toFixed(1)
  ).join(' L ');

  const first = rows[0]!;
  const fillD =
    'M ' + cx(0).toFixed(1) + ',' + zeroY.toFixed(1) +
    ' L ' + cx(0).toFixed(1) + ',' + cy(first.bank_balance_eur as number).toFixed(1) +
    ' L ' + ptStr +
    ' L ' + cx(rows.length - 1).toFixed(1) + ',' + zeroY.toFixed(1) + ' Z';
  const lineD = 'M ' + ptStr;

  const ticks = [minV, minV + rng * 0.5, maxV];

  return (
    <svg viewBox={'0 0 ' + W + ' ' + H} className={styles.bankChart}>
      <defs>
        <linearGradient id="bg3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#43A047" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#43A047" stopOpacity={0.03} />
        </linearGradient>
      </defs>
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={pl} y1={cy(v)} x2={W - pr} y2={cy(v)} stroke="#e0ddd9" strokeWidth={1} strokeDasharray="4 3" />
          <text x={pl - 6} y={cy(v) + 4} textAnchor="end" fontSize={10} fill="#999">
            {v >= 1000 || v <= -1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0)}
          </text>
        </g>
      ))}
      {minV < 0 && <line x1={pl} y1={zeroY} x2={W - pr} y2={zeroY} stroke="#E53935" strokeWidth={1.5} />}
      <path d={fillD} fill="url(#bg3)" />
      <path d={lineD} fill="none" stroke="#43A047" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {rows.map((r, i) => (
        <circle key={i} cx={cx(i)} cy={cy(r.bank_balance_eur as number)} r={3.5} fill="#fff" stroke="#43A047" strokeWidth={2} />
      ))}
      {rows.map((r, i) => {
        if (rows.length > 8 && i % 2 !== 0) return null;
        const lbl = (r.month_label_short || r.month_label || r.month_id || '').substring(0, 6);
        return <text key={i} x={cx(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="#888">{lbl}</text>;
      })}
    </svg>
  );
}

export default function Page3Liquiditaet({ data }: Props) {
  const raw = data as Page3Data | null;
  const sr = raw?.summary;
  const s: CashflowSummary = Array.isArray(sr) ? (sr[0] ?? {}) : (sr ?? {});
  const trend: TrendRow[] = Array.isArray(raw?.trend) ? raw!.trend! : [];
  const xr = raw?.stress;
  const x: StressRow = Array.isArray(xr) ? (xr[0] ?? {}) : (xr ?? {});

  const liq = Number(s.liquidity_months ?? 0);
  const tgt = Number(s.target_months ?? 2.5);
  const bank = Number(s.bank_balance_eur ?? 0);
  const cf = Number(s.cashflow_eur ?? 0);
  const score = Number(s.stability_score ?? 0);
  const cov = Number(s.cost_coverage_pct ?? 0);
  const covDisplay = Math.abs(cov) > 1 ? cov : cov * 100;

  const st = getStatus(s.status_color, liq);
  const stLabel = st === 'rot' ? 'KRITISCH' : st === 'gelb' ? 'ANGESPANNT' : 'STABIL';
  const luecke = Math.max(0, tgt - liq);
  const pct = Math.min(100, (liq / tgt) * 100);

  const scoreColor = score >= 70 ? '#43A047' : score >= 45 ? '#F9A825' : '#E53935';
  const scoreLabel = score >= 70 ? 'STABIL' : score >= 45 ? 'ANGESPANNT' : 'KRITISCH';
  const covOk = covDisplay >= 120;

  const impact = Number(x.net_cashflow_impact_eur ?? x.net_impact_eur ?? 0);
  const revImp = Number(x.revenue_impact_eur ?? 0);
  const varRel = Number(x.variable_cost_relief_eur ?? 0);
  const shock = Number(x.revenue_shock_pct ?? -15);
  const shockN = (Math.abs(shock) > 1 ? shock : shock * 100).toFixed(0);

  return (
    <div className={styles.page3Container}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Liquiditätsstabilität</h2>
        <p className={styles.pageSubtitle}>Frühwarnsystem mit Bankbestand, Stabilitätsscore und Stress-Szenario</p>
      </div>

      <section className={styles.heroSection}>
        <div className={styles.heroTop}>
          <span className={styles.heroLabel}>LIQUIDITÄTSREICHWEITE</span>
          {st !== 'gruen' && (
            <span className={st === 'rot' ? styles.heroBadgeRot : styles.heroBadgeGelb}>{stLabel}</span>
          )}
        </div>
        <div className={styles.heroMain}>
          <span className={st === 'rot' ? styles.heroCountRot : st === 'gelb' ? styles.heroCountGelb : styles.heroCountGruen}>
            {fmtMonths(liq)}
          </span>
          <span className={styles.heroUnit}>&nbsp;Monate</span>
        </div>
        <div className={styles.heroMeta}>
          Ziel: {fmtMonths(tgt)} Monate
          {luecke > 0 && <span className={styles.heroLueckeWrap}>&nbsp;&middot;&nbsp;<span className={styles.heroLuecke}>Lücke: {fmtMonths(luecke)} Monate</span></span>}
          &nbsp;&middot;&nbsp;Bankbestand: {fmt(bank)}&nbsp;€
        </div>
        <div className={styles.heroProgressBar}>
          <div
            style={{ width: pct + '%' }}
            className={st === 'rot' ? styles.heroFillRot : st === 'gelb' ? styles.heroFillGelb : styles.heroFillGruen}
          />
        </div>
      </section>

      <div className={styles.kpiSection}>
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>OPERATIVER CASHFLOW</div>
            <div className={cf >= 0 ? styles.kpiGreen : styles.kpiRed}>{fmt(cf)}&nbsp;€</div>
            <div className={styles.kpiSub}>OCF-Marge: <strong>{fmtPct(s.cashflow_margin_pct ?? s.margin_pct)}</strong></div>
          </div>
          <div className={styles.kpiCardHL}>
            <div className={styles.kpiLabel}>FINANZSTABILITÄT</div>
            <div className={styles.scoreVal} style={{ color: scoreColor }}>{score.toFixed(0)}/100</div>
            <div className={styles.scoreTrack}>
              <div className={styles.scoreFill} style={{ width: score + '%', background: scoreColor }} />
            </div>
            <div className={styles.scoreLabel} style={{ color: scoreColor }}>{scoreLabel}</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>KOSTENDECKUNGSQUOTE</div>
            <div className={covOk ? styles.kpiGreen : styles.kpiRed}>{covDisplay.toFixed(1).replace('.', ',')}%</div>
            <div className={styles.covRow}>
              <span className={covOk ? styles.badgeGreen : styles.badgeRed}>{covOk ? 'gedeckt' : 'unterdeckt'}</span>
            </div>
            <div className={styles.kpiSub}>Umsatz ÷ Gesamtkosten &middot; Ziel ≥20%</div>
          </div>
        </div>
      </div>

      {trend.length >= 2 && (
        <div className={styles.chartSection}>
          <div className={styles.chartHeader}>
            <span className={styles.chartTitle}>Bankbestand Verlauf</span>
            <span className={styles.chartSub}>in EUR, letzte {trend.length} Monate</span>
          </div>
          <div className={styles.chartBox}>
            <BankChart trend={trend} />
          </div>
        </div>
      )}

      <section className={styles.stressSection}>
        <div className={styles.stressLabel}>STRESS-SZENARIO &middot; {shockN}% UMSATZ</div>
        <div className={impact < 0 ? styles.stressRed : styles.stressGreen}>{impact >= 0 ? '+' : ''}{fmt(impact)}&nbsp;€</div>
        <div className={styles.stressSub}>Netto-OCF-Belastung nach Kostenflex</div>
        {(revImp !== 0 || varRel !== 0) && (
          <div className={styles.stressFormula}>
            <span className={styles.fRed}>Umsatz {fmt(revImp)}&nbsp;€</span>
            <span className={styles.fSep}> — </span>
            <span className={styles.fGreen}>var. Kosten +{fmt(Math.abs(varRel))}&nbsp;€</span>
            <span className={styles.fSep}> = </span>
            <span className={impact < 0 ? styles.fRed : styles.fGreen}>{fmt(impact)}&nbsp;€</span>
          </div>
        )}
      </section>
    </div>
  );
}
