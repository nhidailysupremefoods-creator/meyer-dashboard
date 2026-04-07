'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { AuthData } from '@/types';

type PageNum = 1 | 2 | 3 | 4;

const PAGE_TITLES: Record<PageNum, string> = {
  1: 'Gesamtlage',
  2: 'Vertragsanalyse',
  3: 'Liquiditätsstabilität',
  4: 'Maßnahmen & Benchmarks',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(val: any, decimals = 0): string {
  const n = parseFloat(val);
  if (isNaN(n)) return '–';
  return n.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtEur(val: any, decimals = 0): string {
  const n = parseFloat(val);
  if (isNaN(n)) return '–';
  return n.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + ' €';
}
function fmtPct(val: any, decimals = 1): string {
  const n = parseFloat(val);
  if (isNaN(n)) return '–';
  return (n * 100).toFixed(decimals) + ' %';
}
function statusColor(s: string | undefined): string {
  if (s === 'GREEN' || s === 'green') return '#22c55e';
  if (s === 'YELLOW' || s === 'yellow') return '#eab308';
  if (s === 'RED' || s === 'red') return '#ef4444';
  return '#94a3b8';
}
function statusLabel(s: string | undefined): string {
  if (s === 'GREEN') return 'Gut';
  if (s === 'YELLOW') return 'Warnung';
  if (s === 'RED') return 'Kritisch';
  return '–';
}
function trendIcon(val: number | undefined): string {
  if (val === undefined || isNaN(val)) return '';
  if (val > 0.02) return '▲';
  if (val < -0.02) return '▼';
  return '→';
}
function trendColorStyle(val: number | undefined, invertPositive = false): React.CSSProperties {
  if (val === undefined || isNaN(val)) return {};
  const isGood = invertPositive ? val < 0 : val > 0;
  return { color: isGood ? '#22c55e' : val === 0 ? '#94a3b8' : '#ef4444' };
}

// ─── Mini Sparkline Chart (SVG) ──────────────────────────────────────────────

function SparkLine({ data, field, color = '#3b82f6', height = 48 }: {
  data: any[];
  field: string;
  color?: string;
  height?: number;
}) {
  if (!data || data.length < 2) return null;
  const values = data.map(d => parseFloat(d[field]) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 200;
  const h = height;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h * 0.85 - h * 0.05;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── Bar Chart (horizontal) ──────────────────────────────────────────────────

function HBar({ value, max, color = '#3b82f6', label, sublabel }: {
  value: number; max: number; color?: string; label?: string; sublabel?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      {(label || sublabel) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px', color: 'var(--text-secondary)' }}>
          <span>{label}</span>
          <span>{sublabel}</span>
        </div>
      )}
      <div style={{ background: 'var(--border-color)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ title, value, sub, color, icon }: {
  title: string; value: string; sub?: string; color?: string; icon?: string;
}) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 140 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
        {icon && <span style={{ fontSize: '1.1rem' }}>{icon}</span>}
      </div>
      <div style={{ marginTop: '0.5rem', fontSize: '1.5rem', fontWeight: 700, color: color || 'var(--text-primary)' }}>
        {value}
      </div>
      {sub && <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{sub}</div>}
    </div>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '1.5rem 0 0.75rem' }}>
      {title}
    </h3>
  );
}

// ─── Page 1: Gesamtlage ──────────────────────────────────────────────────────

function Page1({ data: rawData }: { data: any }) {
  // Apps Script getPage1 returns: overview, trend, prod data
  const d = rawData?.data || rawData?.overview || rawData || {};
  const trend: any[] = rawData?.trend || [];

  const revenue = parseFloat(d.revenue || d.umsatz || 0);
  const profit = parseFloat(d.profit || d.ebit || 0);
  const marginPct = parseFloat(d.margin_pct || d.marge_pct || (revenue > 0 ? profit / revenue : 0));
  const status = d.status_color || d.status || '';
  const payroll = parseFloat(d.payroll_cost || d.lohnkosten || d.cost_variable || 0);
  const ebitPotential = parseFloat(d.ebit_potential || rawData?.ebit_potential || 0);
  const costQuote = revenue > 0 ? (Math.abs(parseFloat(d.cost || 0)) / revenue) : 0;
  const productivity = parseFloat(d.productivity || d.produktivitaet || 0);

  const revMom = parseFloat(d.revenue_mom_pct || 0);
  const profitMom = parseFloat(d.profit_mom_pct || 0);

  return (
    <div>
      {/* Status Banner */}
      <div style={{
        padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1.5rem',
        background: status === 'RED' ? 'rgb(254,242,242)' : status === 'YELLOW' ? 'rgb(254,252,232)' : 'rgb(240,253,244)',
        borderLeft: `4px solid ${statusColor(status)}`,
        display: 'flex', alignItems: 'center', gap: '0.75rem'
      }}>
        <span style={{ fontSize: '1.25rem' }}>
          {status === 'GREEN' ? '🟢' : status === 'YELLOW' ? '🟡' : '🔴'}
        </span>
        <div>
          <strong style={{ color: statusColor(status) }}>Status: {statusLabel(status)}</strong>
          {ebitPotential > 0 && (
            <span style={{ marginLeft: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Hebelpotenzial: <strong style={{ color: 'var(--primary)' }}>{fmtEur(ebitPotential)}</strong>
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <KpiCard title="Umsatz" value={fmtEur(revenue)} sub={`${trendIcon(revMom)} ${fmtPct(revMom)} ggü. Vormonat`} icon="📈" />
        <KpiCard title="EBIT" value={fmtEur(profit)} sub={`${trendIcon(profitMom)} ${fmtPct(profitMom)} ggü. Vormonat`}
          color={profit < 0 ? '#ef4444' : profit === 0 ? 'var(--text-primary)' : '#22c55e'} icon="💰" />
        <KpiCard title="Marge" value={fmtPct(marginPct)} sub={marginPct < 0.05 ? 'Unter Ziel' : marginPct < 0.1 ? 'Im Bereich' : 'Gut'}
          color={marginPct < 0.05 ? '#ef4444' : marginPct < 0.1 ? '#eab308' : '#22c55e'} icon="📊" />
        {productivity > 0 && <KpiCard title="Produktivität" value={fmtPct(productivity)} sub="Auslastung" icon="ښ�️" />}
      </div>

      {/* Cost Breakdown */}
      {(payroll > 0 || costQuote > 0) && (
        <>
          <SectionHeader title="Kostenstruktur" />
          <div className="card">
            {payroll > 0 && revenue > 0 && (
              <HBar value={Math.abs(payroll)} max={revenue} color="#3b82f6"
                label="Personalkosten" sublabel={`${fmtEur(payroll)} (${fmtPct(Math.abs(payroll) / revenue)})`} />
            )}
            {costQuote > 0 && (
              <HBar value={costQuote} max={1} color={costQuote > 0.9 ? '#ef4444' : '#f59e0b'}
                label="Kostenquote" sublabel={fmtPct(costQuote)} />
            )}
          </div>
        </>
      )}

      {/* Trend Chart */}
      {trend.length > 1 && (
        <>
          <SectionHeader title="Umsatz- & EBIT-Verlauf (12 Monate)" />
          <div className="card">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Umsatz</div>
                <SparkLine data={trend} field="revenue" color="#3b82f6" />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>EBIT</div>
                <SparkLine data={trend} field="profit" color="#22c55e" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              {trend.slice(-6).map((t: any, i: number) => (
                <div key={i} style={{ flex: 1, minWidth: 80, textAlign: 'center', padding: '0.5rem', background: 'var(--background)', borderRadius: 6 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{t.month_label || t.month_label_short || t.month_id || ''}</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: 2 }}>{fmtEur(t.revenue || t.umsatz)}</div>
                  <div style={{ fontSize: '0.75rem', color: parseFloat(t.profit) < 0 ? '#ef4444' : '#22c55e' }}>{fmtEur(t.profit || t.ebit)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page 2: Vertragsanalyse ──────────────────────────────────────────────────

function Page2({ data: rawData }: { data: any }) {
  const summary = rawData?.summary || rawData?.data || rawData || {};
  const contracts: any[] = rawData?.contracts || rawData?.full_risk || [];

  const totalContracts = parseInt(summary.total_contracts || summary.contract_count || contracts.length || 0);
  const criticalContracts = parseInt(summary.critical_contracts || summary.high_risk_count || 0);
  const portfolioEbit = parseFloat(summary.portfolio_ebit || summary.ebit_sum || 0);
  const avgMargin = parseFloat(summary.avg_margin_pct || summary.avg_margin || 0);

  const riskColors: Record<string, string> = {
    HIGH: '#ef4444', HOCH: '#ef4444',
    MEDIUM: '#f59e0b', MITTEL: '#f59e0b',
    LOW: '#22c55e', NIEDRIG: '#22c55e',
  };

  return (
    <div>
      {/* Summary KPIs */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <KpiCard title="Verträge gesamt" value={String(totalContracts || '–')} icon="📋" />
        <KpiCard title="Kritische Verträge" value={String(criticalContracts || '–')}
          color={criticalContracts > 0 ? '#ef4444' : '#22c55e'} icon="⚠️" />
        <KpiCard title="Portfolio-EBIT" value={fmtEur(portfolioEbit)}
          color={portfolioEbit < 0 ? '#ef4444' : '#22c55e'} icon="💼" />
        {avgMargin !== 0 && <KpiCard title="Ø Marge" value={fmtPct(avgMargin)} icon="📊" />}
      </div>

      {/* Contract List */}
      {contracts.length > 0 && (
        <>
          <SectionHeader title={`Vertragsübersicht (${contracts.length} Verträge)`} />
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Vertrag</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Umsatz</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>EBIT</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Marge</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Risiko</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c: any, i: number) => {
                  const risk = c.risk_level || c.risikoklasse || c.risk || '';
                  const riskColor = riskColors[risk.toUpperCase()] || '#94a3b8';
                  const revenue = parseFloat(c.monthly_revenue || c.umsatz || c.revenue || 0);
                  const ebit = parseFloat(c.ebit || c.profit || c.ebit_monatlich || 0);
                  const margin = parseFloat(c.margin_pct || c.marge_pct || (revenue > 0 ? ebit / revenue : 0));
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 500 }}>{c.contract_name || c.name || c.vertrag || c.contract_id || `Vertrag ${i + 1}`}</div>
                        {c.customer_segment && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.customer_segment}</div>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{fmtEur(revenue)}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: ebit < 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                        {fmtEur(ebit)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{fmtPct(margin)}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        {risk && (
                          <span style={{
                            display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: 12,
                            fontSize: '0.7rem', fontWeight: 700, color: 'white', background: riskColor
                          }}>
                            {risk}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Fallback: show raw summary data */}
      {contracts.length === 0 && Object.keys(summary).length > 0 && (
        <>
          <SectionHeader title="Zusammenfassung" />
          <div className="card">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {Object.entries(summary)
                .filter(([k]) => !['page', 'customer', 'period', 'timestamp'].includes(k))
                .slice(0, 12)
                .map(([k, v]: [string, any]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'var(--background)', borderRadius: 6 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{typeof v === 'number' ? fmt(v) : String(v)}</span>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page 3: Liquiditätsstabilität ──────────────────────────────────────────

function Page3({ data: rawData }: { data: any }) {
  const d = rawData?.summary || rawData?.data || rawData || {};
  const trend: any[] = rawData?.trend || [];

  const bankBalance = parseFloat(d.bank_balance_eur || d.bankbestand || d.cash || 0);
  const liquidityMonths = parseFloat(d.liquidity_months || d.reichweite_monate || 0);
  const avgCost = parseFloat(d.avg_monthly_cost || d.avg_cost || 0);
  const status = d.status_color || d.status || '';

  // Score components
  const scoreTotal = parseFloat(d.stability_score || d.score_total || 0);
  const scorePerf = parseFloat(d.score_performance || d.performance_score || 0);
  const scoreStruct = parseFloat(d.score_structure || d.structure_score || 0);
  const scoreTrend = parseFloat(d.score_trend || d.trend_score || 0);
  const scoreStab = parseFloat(d.score_stability || d.stability_score || 0);

  const liquidityColor = liquidityMonths < 1 ? '#ef4444' : liquidityMonths < 3 ? '#f59e0b' : '#22c55e';

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <KpiCard title="Bankbestand" value={fmtEur(bankBalance)} icon="🏦"
          color={bankBalance < 0 ? '#ef4444' : undefined} />
        <KpiCard title="Liquiditätsreichweite" value={liquidityMonths > 0 ? `${fmt(liquidityMonths, 1)} Monate` : '–'}
          color={liquidityColor} icon="📅"
          sub={liquidityMonths < 1 ? 'Kritisch' : liquidityMonths < 3 ? 'Warnung' : 'Stabil'} />
        {avgCost > 0 && <KpiCard title="Ø Monatliche Kosten" value={fmtEur(avgCost)} icon="💸" />}
        {status && <KpiCard title="Status" value={statusLabel(status)} color={statusColor(status)} icon={status === 'GREEN' ? '🟢' : status === 'YELLOW' ? '🟡' : '🔴'} />}
      </div>

      {/* Liquiditäts-Gauge */}
      {liquidityMonths > 0 && (
        <>
          <SectionHeader title="Liquiditätsreichweite" />
          <div className="card">
            <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>0 Monate</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: liquidityColor }}>{fmt(liquidityMonths, 1)} Monate</span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>6+ Monate</span>
            </div>
            <div style={{ height: 12, background: 'var(--border-color)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, (liquidityMonths / 6) * 100)}%`,
                height: '100%', background: liquidityColor, borderRadius: 6, transition: 'width 0.5s'
              }} />
            </div>
            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {liquidityMonths < 1
                ? '⚠️ Kritisch: Liquidität reicht weniger als 1 Monat'
                : liquidityMonths < 3
                  ? '⚡ Warnung: Liquiditätsreserve unter 3 Monaten'
                  : '✅ Stabil: Ausreichende Liquiditätsreserve'}
            </div>
          </div>
        </>
      )}

      {/* Score Breakdown */}
      {scoreTotal > 0 && (
        <>
          <SectionHeader title={`Stabilitäts-Score: ${fmt(scoreTotal)}/100`} />
          <div className="card">
            {[
              { label: 'Leistung', value: scorePerf },
              { label: 'Struktur', value: scoreStruct },
              { label: 'Trend', value: scoreTrend },
              { label: 'Stabilität', value: scoreStab },
            ].filter(s => s.value > 0).map((s, i) => (
              <HBar key={i} value={s.value} max={25}
                color={s.value < 12 ? '#ef4444' : s.value < 18 ? '#f59e0b' : '#22c55e'}
                label={s.label} sublabel={`${fmt(s.value)}/25`} />
            ))}
          </div>
        </>
      )}

      {/* Trend Chart */}
      {trend.length > 1 && (
        <>
          <SectionHeader title="Bankbestand-Verlauf" />
          <div className="card">
            <SparkLine data={trend} field="bank_balance_eur" color="#3b82f6" height={60} />
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              {trend.slice(-6).map((t: any, i: number) => (
                <div key={i} style={{ flex: 1, minWidth: 80, textAlign: 'center', padding: '0.5rem', background: 'var(--background)', borderRadius: 6 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{t.month_label || t.month_label_short || t.month_id || ''}</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: 2, color: '#3b82f6' }}>{fmtEur(t.bank_balance_eur || t.bankbestand)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Break-even Info */}
      {rawData?.breakeven && (
        <>
          <SectionHeader title="Break-Even Analyse" />
          <div className="card">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {Object.entries(rawData.breakeven)
                .filter(([k]) => !['customer_id', 'period_date', 'month_label'].includes(k))
                .slice(0, 6)
                .map(([k, v]: [string, any]) => (
                  <div key={k}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{k.replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: 2 }}>{typeof v === 'number' ? fmtEur(v) : String(v)}</div>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page 4: Maßnahmen & Benchmarks ─────────────────────────────────────────

function Page4({ data: rawData }: { data: any }) {
  const actions: any[] = rawData?.actions || rawData?.data?.actions || [];
  const focus = rawData?.focus || rawData?.monatsfokus || {};
  const wirkung = rawData?.wirkung || {};
  const benchmarks: any[] = rawData?.benchmarks || rawData?.benchmark_scenarios || [];

  // Total potential
  const totalPotential = actions.reduce((sum: number, a: any) => {
    return sum + Math.abs(parseFloat(a.ebit_potential_eur || a.impact_eur || a.impact || 0));
  }, 0);

  // MONATSFOKUS
  const focusImpact = parseFloat(focus.ebit_impact || focus.impact_eur || focus.ebit_potential_eur || 0);

  // Wirkung / portfolio trend
  const profitLatest = parseFloat(wirkung.profit || 0);
  const revenueLatest = parseFloat(wirkung.revenue || 0);
  const highRiskCount = parseInt(wirkung.high_risk_count || 0);

  return (
    <div>
      {/* Summary KPIs */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <KpiCard title="Maßnahmen gesamt" value={String(actions.length || '–')} icon="📋" />
        <KpiCard title="Gesamtpotenzial" value={totalPotential > 0 ? fmtEur(totalPotential) : '–'}
          color="#3b82f6" icon="💡" />
        {focusImpact > 0 && <KpiCard title="Monatsfokus" value={fmtEur(focusImpact)} color="#22c55e" icon="🎯" />}
        {highRiskCount > 0 && <KpiCard title="Risiko-Verträge" value={String(highRiskCount)} color="#ef4444" icon="⚠️" />}
      </div>

      {/* MONATSFOKUS Banner */}
      {(focus.action_label || focus.contract_name || focusImpact > 0) && (
        <>
          <SectionHeader title="Monatsfokus" />
          <div className="card" style={{ background: 'rgb(239,246,255)', borderColor: 'rgb(191,219,254)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '2rem' }}>🎯</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'rgb(30,58,138)' }}>
                  {focus.action_label || focus.contract_name || focus.action_key || 'Aktuelle Maßnahme'}
                </div>
                {focusImpact > 0 && (
                  <div style={{ color: 'rgb(37,99,235)', marginTop: 4 }}>
                    Potenzial: <strong>{fmtEur(focusImpact)}</strong>
                  </div>
                )}
                {focus.prioritaet && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    Priorität: {focus.prioritaet} | {focus.kategorie || ''}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Actions Table */}
      {actions.length > 0 && (
        <>
          <SectionHeader title={`Maßnahmenpool (${actions.length} Maßnahmen)`} />
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Maßnahme</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>EBIT-Potenzial</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Score</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Kategorie</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((a: any, i: number) => {
                  const potential = parseFloat(a.ebit_potential_eur || a.impact_eur || a.impact || 0);
                  const score = parseFloat(a.priority_score || a.fokus_score || a.score || 0);
                  const isFocus = a.is_monatsfokus || a.is_in_focus;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', background: isFocus ? 'rgb(239,246,255)' : undefined }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: isFocus ? 700 : 500 }}>
                          {isFocus && <span style={{ marginRight: 6 }}>🎯</span>}
                          {a.action_label || a.contract_name || a.action_key || a.kategorie || `Maßnahme ${i + 1}`}
                        </div>
                        {a.prioritaet && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Prio: {a.prioritaet}</div>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: potential > 0 ? '#22c55e' : 'var(--text-primary)' }}>
                        {potential > 0 ? `+${fmtEur(potential)}` : '–'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        {score > 0 && (
                          <span style={{
                            display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: 12,
                            fontSize: '0.75rem', fontWeight: 700, background: 'var(--primary)', color: 'white'
                          }}>
                            {fmt(score, 1)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {a.kategorie || a.category || '–'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Benchmarks */}
      {benchmarks.length > 0 && (
        <>
          <SectionHeader title="Benchmark-Vergleich" />
          <div className="card">
            {benchmarks.slice(0, 5).map((b: any, i: number) => {
              const current = parseFloat(b.current_value || b.aktuell || 0);
              const target = parseFloat(b.target_value || b.ziel || b.target_mid || 1);
              const pct = target > 0 ? current / target : 0;
              return (
                <HBar key={i} value={Math.min(current, target * 1.5)} max={target * 1.5}
                  color={pct >= 1 ? '#22c55e' : pct >= 0.7 ? '#f59e0b' : '#ef4444'}
                  label={b.dimension || b.benchmark_type || `Benchmark ${i + 1}`}
                  sublabel={`${fmt(current, 1)} / Ziel: ${fmt(target, 1)}`} />
              );
            })}
          </div>
        </>
      )}

      {/* No data state */}
      {actions.length === 0 && benchmarks.length === 0 && Object.keys(focus).length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
          <p style={{ color: 'var(--text-secondary)' }}>Maßnahmen werden geladen...</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard Page ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const [authData, setAuthData] = useState<AuthData | null>(null);
  const [currentPage, setCurrentPage] = useState<PageNum>(1);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [availableCustomers, setAvailableCustomers] = useState<string[]>([]);
  const [periods, setPeriods] = useState<Array<{ period: string; label: string }>>([]);
  const [pageData, setPageData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth and load customers
  useEffect(() => {
    const data = api.getAuthData();
    if (!data) return;
    setAuthData(data);

    const initCustomers = async () => {
      let customers = data.customers && data.customers.length > 0 ? data.customers : null;

      // Admin with empty customers list → try API, fallback to known customers
      if (!customers) {
        try {
          const token = sessionStorage.getItem('md_session_token') || '';
          const res = await fetch(`/api/dashboard/customers`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const resp = await res.json();
          const list = resp.customers || resp.data;
          if (Array.isArray(list) && list.length > 0) {
            customers = list.map((c: any) => typeof c === 'string' ? c : c.customer_id || c.id);
          }
        } catch {
          // ignore
        }
        // Fallback: test known customers via periods endpoint
        if (!customers) {
          const known = ['INDUSTRIE_GAMMA', 'MUSTERMANN_TECHNIK', 'SCHMIDT_ANLAGENBAU', 'WEBER_HAUSTECHNIK'];
          const token = sessionStorage.getItem('md_session_token') || '';
          const valid: string[] = [];
          for (const c of known) {
            try {
              const r = await fetch(`/api/dashboard/periods?customer=${c}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              const d = await r.json();
              if (d.periods && d.periods.length > 0) valid.push(c);
            } catch { /* skip */ }
          }
          if (valid.length > 0) customers = valid;
        }
      }

      if (customers && customers.length > 0) {
        setAvailableCustomers(customers);
        setSelectedCustomer(customers[0]);
      }
    };

    initCustomers();
  }, []);

  // Load periods when customer changes
  useEffect(() => {
    if (!selectedCustomer) return;

    const loadPeriods = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.fetchPeriods(selectedCustomer);

        const rawPeriods = (response as any).periods || response.periods;
        if (rawPeriods && rawPeriods.length > 0) {
          const mapped = rawPeriods.map((p: any) => ({
            period: p.month_id || p.period,
            label: p.month_label_short || p.label || p.month_id || p.period,
          }));
          setPeriods(mapped);
          setSelectedPeriod(mapped[0].period);
        }
      } catch {
        setError('Perioden konnten nicht geladen werden');
      } finally {
        setLoading(false);
      }
    };

    loadPeriods();
  }, [selectedCustomer]);

  // Load page data when period/page changes
  useEffect(() => {
    if (!selectedCustomer || !selectedPeriod) return;

    const loadPageData = async () => {
      try {
        setLoading(true);
        setError(null);
        setPageData(null);
        const response = await api.fetchPageData(currentPage, selectedCustomer, selectedPeriod);

        if (response && !response.error) {
          setPageData(response);
        } else if (response?.error) {
          setError(response.error);
        }
      } catch {
        setError(`Seite ${currentPage} konnte nicht geladen werden`);
      } finally {
        setLoading(false);
      }
    };

    loadPageData();
  }, [selectedCustomer, selectedPeriod, currentPage]);

  if (!authData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderBottomColor: 'var(--primary)', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Wird geladen...</p>
        </div>
      </div>
    );
  }

  const renderPageContent = () => {
    if (!pageData) return null;
    switch (currentPage) {
      case 1: return <Page1 data={pageData} />;
      case 2: return <Page2 data={pageData} />;
      case 3: return <Page3 data={pageData} />;
      case 4: return <Page4 data={pageData} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="card flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full">
          {/* Customer Dropdown */}
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Kunde</label>
            <select
              value={selectedCustomer}
              onChange={(e) => { setSelectedCustomer(e.target.value); setPageData(null); }}
              className="w-full"
            >
              {availableCustomers.map((customer) => (
                <option key={customer} value={customer}>{customer.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {/* Period Dropdown */}
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Periode</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full"
              disabled={periods.length === 0}
            >
              {periods.map((p) => (
                <option key={p.period} value={p.period}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-lg border text-sm" style={{ background: 'rgb(254,242,242)', color: 'var(--danger)', borderColor: 'rgb(254,205,211)' }}>
          {error}
        </div>
      )}

      {/* Page Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {([1, 2, 3, 4] as PageNum[]).map((pageNum) => (
          <button
            key={pageNum}
            onClick={() => setCurrentPage(pageNum)}
            className="px-4 py-2 rounded-lg font-medium transition whitespace-nowrap"
            style={currentPage === pageNum
              ? { backgroundColor: 'var(--primary)', color: 'white' }
              : { backgroundColor: 'var(--background-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }
            }
          >
            {pageNum}: {PAGE_TITLES[pageNum]}
          </button>
        ))}
      </div>

      {/* Page Content */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderBottomColor: 'var(--primary)', margin: '0 auto 1rem' }} />
              <p style={{ color: 'var(--text-secondary)' }}>
                {PAGE_TITLES[currentPage]} wird geladen...
              </p>
            </div>
          </div>
        ) : pageData ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 className="text-2xl font-bold">{PAGE_TITLES[currentPage]}</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {selectedCustomer.replace(/_/g, ' ')} · {selectedPeriod.replace(/_/g, '/')}
              </span>
            </div>
            {renderPageContent()}
          </div>
        ) : (
          <div className="text-center py-12">
            <p style={{ color: 'var(--text-secondary)' }}>
              {selectedCustomer && selectedPeriod ? 'Keine Daten verfügbar' : 'Bitte Kunde und Periode auswählen'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
