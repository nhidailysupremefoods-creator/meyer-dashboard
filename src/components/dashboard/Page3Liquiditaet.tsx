'use client';
import React, { useState } from 'react';
import styles from './Page3Liquiditaet.module.css';

interface CashflowSummary {
  operating_cashflow?: number;
  cashflow_eur?: number;
  ocf_margin?: number;
  cashflow_margin_pct?: number;
  margin_pct?: number;
  ocf_volatility_rel?: number;
  bank_balance_eur?: number;
  liquidity_months?: number;
  target_months?: number;
  monthly_avg_cost?: number;
  revenue?: number;
  page3_status_color?: string;
  status_color?: string;
  liquidity_rating?: string;
  liquidity_stability_score?: number;
  stability_score?: number;
  score_performance?: number;
  score_structure?: number;
  score_trend?: number;
  score_stability?: number;
  cost_coverage_pct?: number;
}

interface TrendRow {
  month_label?: string;
  month_label_short?: string;
  month_id?: string;
  bank_balance_eur?: number;
  page3_status_color?: string;
}

interface StressRow {
  revenue_shock_pct?: number;
  stress_impact_eur_realistic?: number;
  net_cashflow_impact_eur?: number;
  net_impact_eur?: number;
  revenue_stress_realistic?: number;
  revenue?: number;
  revenue_impact_eur?: number;
  variable_cost_relief_eur?: number;
}

interface Page3Data {
  summary?: CashflowSummary | CashflowSummary[];
  trend?: TrendRow[];
  stress?: StressRow | StressRow[];
  breakeven?: Record<string, unknown>;
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
function fmtPctVal(n?: number): string {
  if (n == null || isNaN(n)) return '—';
  const v = Math.abs(n) > 1 ? n : n * 100;
  return v.toFixed(1).replace('.', ',') + '%';
}
function getStatus(s?: string, months?: number): 'rot' | 'gelb' | 'gruen' {
  const v = (s || '').toUpperCase();
  if (v === 'RED' || v === 'ROT' || v === 'CRITICAL' || v === 'KRITISCH') return 'rot';
  if (v === 'YELLOW' || v === 'GELB' || v === 'WARNING' || v === 'ANGESPANNT') return 'gelb';
  if (!s && months != null) return months < 1.5 ? 'rot' : months < 2.5 ? 'gelb' : 'gruen';
  return 'gruen';
}
function scoreBand(pts: number, max: number): { label: string; color: string } {
  const p = pts / max;
  if (p >= 0.8) return { label: 'SEHR GUT', color: '#43A047' };
  if (p >= 0.6) return { label: 'GUT', color: '#6DB33F' };
  if (p >= 0.4) return { label: 'AUSREICHEND', color: '#8B6A40' };
  if (p >= 0.2) return { label: 'SCHWACH', color: '#E08020' };
  return { label: 'KRITISCH', color: '#E53935' };
}

function BankChart({ trend }: { trend: TrendRow[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const rows = trend.filter(r => r.bank_balance_eur != null).slice(-12);
  if (rows.length < 2) return null;

  const W = 760; const H = 190;
  const pl = 68; const pr = 16; const pt = 16; const pb = 38;
  const iW = W - pl - pr;
  const iH = H - pt - pb;
  const vals = rows.map(r => r.bank_balance_eur as number);
  const maxV = Math.max(...vals) * 1.08;
  const minV = Math.min(Math.min(...vals) * 0.92, 0);
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
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount }, (_, i) => minV + (rng / (tickCount - 1)) * i);
  const TT_W = 110; const TT_H = 38;

  return (
    <svg viewBox={'0 0 ' + W + ' ' + H} className={styles.bankChart} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="bankGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8B6A40" stopOpacity={0.18} />
          <stop offset="100%" stopColor="#8B6A40" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={pl} y1={cy(v)} x2={W - pr} y2={cy(v)} stroke="#ede9e4" strokeWidth={1} strokeDasharray="4 3" />
          <text x={pl - 6} y={cy(v) + 4} textAnchor="end" fontSize={10} fill="#aaa">
            {Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + ' T€' : v.toFixed(0)}
          </text>
        </g>
      ))}
      {minV < 0 && <line x1={pl} y1={zeroY} x2={W - pr} y2={zeroY} stroke="#E53935" strokeWidth={1.5} />}
      <path d={fillD} fill="url(#bankGrad)" />
      <path d={lineD} fill="none" stroke="#8B6A40" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {rows.map((r, i) => {
        if (rows.length > 8 && i % 2 !== 0) return null;
        const lbl = (r.month_label_short || r.month_id || '').substring(0, 6);
        return <text key={i} x={cx(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#999">{lbl}</text>;
      })}
      {rows.map((r, i) => {
        const st = getStatus(r.page3_status_color);
        const dotColor = st === 'rot' ? '#E53935' : st === 'gelb' ? '#F9A825' : '#43A047';
        const isHov = hoverIdx === i;
        return (
          <circle
            key={i}
            cx={cx(i)}
            cy={cy(r.bank_balance_eur as number)}
            r={isHov ? 7 : 5}
            fill={dotColor}
            stroke="#fff"
            strokeWidth={2}
            style={{ cursor: 'pointer', transition: 'r 0.1s' }}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          />
        );
      })}
      {hoverIdx != null && rows[hoverIdx] != null && (() => {
        const r = rows[hoverIdx]!;
        const bv = r.bank_balance_eur as number;
        const dotX = cx(hoverIdx);
        const dotY = cy(bv);
        const ttX = Math.min(Math.max(dotX - TT_W / 2, pl), W - pr - TT_W);
        const ttY = dotY - TT_H - 10;
        const lbl = r.month_label_short || r.month_id || '';
        const valStr = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(bv) + ' €';
        return (
          <g style={{ pointerEvents: 'none' }}>
            <line x1={dotX} y1={dotY - 7} x2={dotX} y2={ttY + TT_H} stroke="#192231" strokeWidth={1} strokeDasharray="3 2" opacity={0.4} />
            <rect x={ttX} y={ttY} width={TT_W} height={TT_H} rx={5} fill="#192231" opacity={0.93} />
            <text x={ttX + TT_W / 2} y={ttY + 13} textAnchor="middle" fontSize={9.5} fill="#C8A96E" fontWeight="600" letterSpacing="0.5">{lbl}</text>
            <text x={ttX + TT_W / 2} y={ttY + 28} textAnchor="middle" fontSize={12} fill="#ffffff" fontWeight="700">{valStr}</text>
          </g>
        );
      })()}
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
  const be = (raw?.breakeven ?? {}) as Record<string, number>;

  const liq = Number(s.liquidity_months ?? 0);
  const tgt = Number(s.target_months ?? be.target_liquidity_months ?? 2.5);
  const bank = Number(s.bank_balance_eur ?? 0);
  const cf = Number(s.operating_cashflow ?? s.cashflow_eur ?? 0);
  const cfMarginRaw = s.ocf_margin ?? s.cashflow_margin_pct ?? s.margin_pct;
  const cfMarginDisp = fmtPctVal(cfMarginRaw);
  const score = Number(s.liquidity_stability_score ?? s.stability_score ?? 0);
  const revenue = Number(s.revenue ?? 0);
  const avgCost = Number(s.monthly_avg_cost ?? 0);
  const covRaw = s.cost_coverage_pct != null
    ? (Math.abs(s.cost_coverage_pct) > 1 ? s.cost_coverage_pct : s.cost_coverage_pct * 100)
    : (avgCost > 0 ? (revenue / avgCost) * 100 : 0);
  const covOk = covRaw >= 100;

  const statusRaw = s.page3_status_color ?? s.status_color ?? s.liquidity_rating;
  const st = getStatus(statusRaw, liq);
  const stLabel = st === 'rot' ? 'KRITISCH' : st === 'gelb' ? 'ANGESPANNT' : 'STABIL';
  const luecke = Math.max(0, tgt - liq);
  const pct = Math.min(100, (liq / tgt) * 100);
  const scoreColor = score >= 70 ? '#43A047' : score >= 45 ? '#F9A825' : '#E53935';
  const scoreLabel = score >= 70 ? 'STABIL' : score >= 45 ? 'ANGESPANNT' : 'KRITISCH';

  const impact = Number(x.stress_impact_eur_realistic ?? x.net_cashflow_impact_eur ?? x.net_impact_eur ?? 0);
  const revImpCalc = x.revenue_stress_realistic != null && x.revenue != null
    ? Number(x.revenue_stress_realistic) - Number(x.revenue)
    : Number(x.revenue_impact_eur ?? 0);
  const varRelCalc = revImpCalc !== 0 ? impact - revImpCalc : Number(x.variable_cost_relief_eur ?? 0);
  const shock = Number(x.revenue_shock_pct ?? -15);
  const shockN = (Math.abs(shock) > 1 ? shock : shock * 100).toFixed(0);

  const scorePerf = Number(s.score_performance ?? 0);
  const scoreStr = Number(s.score_structure ?? 0);
  const scoreTrd = Number(s.score_trend ?? 0);
  const scoreSta = Number(s.score_stability ?? 0);
  const hasScores = scorePerf + scoreStr + scoreTrd + scoreSta > 0;
  const perfBand = scoreBand(scorePerf, 25);
  const strBand = scoreBand(scoreStr, 25);
  const trdBand = scoreBand(scoreTrd, 25);
  const staBand = scoreBand(scoreSta, 25);
  const volatDisp = fmtPctVal(s.ocf_volatility_rel);

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
          {luecke > 0 && (
            <span className={styles.heroLueckeWrap}>
              &nbsp;&middot;&nbsp;<span className={styles.heroLuecke}>Lücke: {fmtMonths(luecke)} Monate</span>
            </span>
          )}
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
            <div className={styles.kpiSub}>OCF-Marge: <strong>{cfMarginDisp}</strong></div>
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
            <div className={covOk ? styles.kpiGreen : styles.kpiRed}>{covRaw.toFixed(1).replace('.', ',')}%</div>
            <div className={styles.covRow}>
              <span className={covOk ? styles.badgeGreen : styles.badgeRed}>{covOk ? 'gedeckt' : 'unterdeckt'}</span>
            </div>
            <div className={styles.kpiSub}>Umsatz ÷ Gesamtkosten &middot; Ziel ≥100%</div>
          </div>
        </div>
      </div>

      <section className={styles.stressSection}>
        <div className={styles.stressLabel}>STRESS-SZENARIO &middot; {shockN}% UMSATZ</div>
        <div className={impact < 0 ? styles.stressRed : styles.stressGreen}>
          {impact >= 0 ? '+' : ''}{fmt(impact)}&nbsp;€
        </div>
        <div className={styles.stressSub}>Netto-OCF-Belastung nach Kostenflex</div>
        {revImpCalc !== 0 && (
          <div className={styles.stressFormula}>
            <span className={styles.fRed}>Umsatz {fmt(revImpCalc)}&nbsp;€</span>
            <span className={styles.fSep}> — </span>
            <span className={styles.fGreen}>var. Kosten +{fmt(Math.abs(varRelCalc))}&nbsp;€</span>
            <span className={styles.fSep}> = </span>
            <span className={impact < 0 ? styles.fRed : styles.fGreen}>{fmt(impact)}&nbsp;€</span>
          </div>
        )}
      </section>

      {hasScores && (
        <div className={styles.scoreDimSection}>
          <div className={styles.scoreDimHeader}>
            <span className={styles.scoreDimDot} />
            <span className={styles.scoreDimTitle}>FINANZSTABILITÄT – SCORE-DIMENSIONEN</span>
          </div>
          <div className={styles.scoreDimGrid}>
            <div className={styles.scoreDimRow}>
              <div className={styles.scoreDimLabelRow}>
                <span className={styles.scoreDimName}>LEISTUNG</span>
                <div className={styles.scoreDimRight}>
                  <span className={styles.scoreDimVal} style={{ background: perfBand.color + '18', color: perfBand.color }}>{cfMarginDisp}</span>
                  <span className={styles.scoreDimBand} style={{ color: perfBand.color }}>{perfBand.label}</span>
                  <span className={styles.scoreDimPts}>{scorePerf}/25</span>
                </div>
              </div>
              <div className={styles.scoreDimTrack}>
                <div className={styles.scoreDimFill} style={{ width: (scorePerf / 25 * 100) + '%', background: perfBand.color }} />
              </div>
              <div className={styles.scoreDimHint}>Optimal ≥15% &middot; Gut ≥10% &middot; Ausreichend ≥5%</div>
            </div>
            <div className={styles.scoreDimRow}>
              <div className={styles.scoreDimLabelRow}>
                <span className={styles.scoreDimName}>STRUKTUR</span>
                <div className={styles.scoreDimRight}>
                  <span className={styles.scoreDimVal} style={{ background: strBand.color + '18', color: strBand.color }}>{fmtMonths(liq)} Monate</span>
                  <span className={styles.scoreDimBand} style={{ color: strBand.color }}>{strBand.label}</span>
                  <span className={styles.scoreDimPts}>{scoreStr}/25</span>
                </div>
              </div>
              <div className={styles.scoreDimTrack}>
                <div className={styles.scoreDimFill} style={{ width: (scoreStr / 25 * 100) + '%', background: strBand.color }} />
              </div>
              <div className={styles.scoreDimHint}>Optimal ≥3 Monate &middot; Gut ≥1,5 Monate &middot; Ausreichend ≥1 Monat</div>
            </div>
            <div className={styles.scoreDimRow}>
              <div className={styles.scoreDimLabelRow}>
                <span className={styles.scoreDimName}>TREND</span>
                <div className={styles.scoreDimRight}>
                  <span className={styles.scoreDimBand} style={{ color: trdBand.color }}>{trdBand.label}</span>
                  <span className={styles.scoreDimPts}>{scoreTrd}/25</span>
                </div>
              </div>
              <div className={styles.scoreDimTrack}>
                <div className={styles.scoreDimFill} style={{ width: (scoreTrd / 25 * 100) + '%', background: trdBand.color }} />
              </div>
              <div className={styles.scoreDimHint}>Optimal ≥+5% &middot; Gut ±5% &middot; Ausreichend ≥−5%</div>
            </div>
            <div className={styles.scoreDimRow}>
              <div className={styles.scoreDimLabelRow}>
                <span className={styles.scoreDimName}>STABILITÄT</span>
                <div className={styles.scoreDimRight}>
                  <span className={styles.scoreDimVal} style={{ background: staBand.color + '18', color: staBand.color }}>{volatDisp}</span>
                  <span className={styles.scoreDimBand} style={{ color: staBand.color }}>{staBand.label}</span>
                  <span className={styles.scoreDimPts}>{scoreSta}/25</span>
                </div>
              </div>
              <div className={styles.scoreDimTrack}>
                <div className={styles.scoreDimFill} style={{ width: (scoreSta / 25 * 100) + '%', background: staBand.color }} />
              </div>
              <div className={styles.scoreDimHint}>Optimal ≤10% &middot; Gut ≤20% &middot; Ausreichend ≤35%</div>
            </div>
          </div>
        </div>
      )}

      {trend.length >= 2 && (
        <div className={styles.chartSection}>
          <div className={styles.chartHeader}>
            <span className={styles.scoreDimDot} />
            <span className={styles.chartTitle}>BANKBESTAND-VERLAUF ({trend.length}M)</span>
          </div>
          <div className={styles.chartBox}>
            <BankChart trend={trend} />
          </div>
        </div>
      )}
    </div>
  );
}
