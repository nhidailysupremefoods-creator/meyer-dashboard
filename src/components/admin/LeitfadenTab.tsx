'use client';

import { useState, useMemo, useCallback } from 'react';
import { api } from '@/lib/api';
import { getMarginTargetsForCustomer } from '@/lib/config';

interface LeitfadenTabProps {
  customers: Array<{ customer_id: string; name?: string; display_name?: string; industry_segment?: string }>;
}

// ─── Formatters ──────────────────────────────────────────────────────────────
const fmtE = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const fmtP = (n: number) => `${(n * 100).toFixed(1)}%`;
const sign = (n: number) => n >= 0 ? `+${fmtP(n)}` : fmtP(n);

// ─── Types ───────────────────────────────────────────────────────────────────
interface KPIData {
  revenue: number;
  profit: number;
  marginPct: number;
  costTotal: number;
  costVariable: number;
  bankBalance: number;
  liquidityMonths: number;
  revMom: number;
  profitMom: number;
  statusColor: string;
  payrollQuote: number;
  ebitLuecke: number;
  ebitTarget: number;
  kostenquote: number;
  // Page 2
  contracts: any[];
  criticalContracts: any[];
  totalMRR: number;
  // Page 3
  scoreLeistung: number;
  scoreStruktur: number;
  scoreTrend: number;
  scoreStabilitaet: number;
  totalScore: number;
  weakestDim: { name: string; score: number };
  stressScenarios: any[];
  // Page 4
  actions: any[];
  totalPotential: number;
  benchmarks: any[];
}

type LeitfadenPage = 'overview' | 'seite1' | 'seite2' | 'seite3' | 'seite4' | 'abschluss';

// ─── Data Fetcher ────────────────────────────────────────────────────────────
async function fetchAllPageData(customer: string, period: string): Promise<KPIData> {
  const [p1, p2, p3, p4] = await Promise.all([
    api.fetchPageData(1, customer, period).catch(() => null),
    api.fetchPageData(2, customer, period).catch(() => null),
    api.fetchPageData(3, customer, period).catch(() => null),
    api.fetchPageData(4, customer, period).catch(() => null),
  ]);

  const d1: any = p1?.data || p1 || {};
  const d2: any = p2?.data || p2 || {};
  const d3: any = p3?.data || p3 || {};
  const d4: any = p4?.data || p4 || {};

  const revenue = Number(d1.revenue || 0);
  const profit = Number(d1.profit || d1.ebit || 0);
  const marginPct = Number(d1.margin_pct || (revenue > 0 ? profit / revenue : 0));
  const costTotal = Math.abs(Number(d1.cost || d1.cost_total || 0));
  const costVariable = Number(d1.cost_variable || d1.payroll_cost || 0);
  const bankBalance = Number(d3.bank_balance_eur || d1.bank_balance_eur || 0);
  const liquidityMonths = Number(d3.liquidity_months || d1.liquidity_months || 0);
  const revMom = Number(d1.revenue_mom_pct || 0);
  const profitMom = Number(d1.profit_mom_pct || 0);
  const statusColor = String(d1.status_color || 'YELLOW');
  const payrollQuote = revenue > 0 ? Math.abs(costVariable) / revenue : 0;

  const ebitTarget = Number(d1.ebit_target || 0);
  const ebitLuecke = Number(d1.ebit_gap || (ebitTarget > 0 ? ebitTarget - profit : 0));
  const kostenquote = revenue > 0 ? costTotal / revenue : 0;

  // Page 2 contracts
  const contracts: any[] = Array.isArray(d2.contracts) ? d2.contracts : Array.isArray(d2.full_risk) ? d2.full_risk : [];
  const criticalContracts = contracts.filter((c: any) => Number(c.margin_pct || 0) < 0.05);
  const totalMRR = contracts.reduce((s: number, c: any) => s + Number(c.revenue || c.mrr || 0), 0);

  // Page 3 scores
  const scoreLeistung = Math.min(25, Math.round(marginPct * 100));
  const scoreStruktur = Math.min(25, Math.round(Math.min(liquidityMonths / 3, 1) * 25));
  const scoreTrend = Math.min(25, profitMom > 0 ? Math.round(Math.min(profitMom * 100, 25)) : Math.max(0, Math.round(12 + profitMom * 100)));
  const scoreStabilitaet = statusColor === 'GREEN' ? 20 : statusColor === 'YELLOW' ? 12 : 5;
  const totalScore = scoreLeistung + scoreStruktur + scoreTrend + scoreStabilitaet;

  const dims = [
    { name: 'Leistung', score: scoreLeistung },
    { name: 'Struktur', score: scoreStruktur },
    { name: 'Trend', score: scoreTrend },
    { name: 'Stabilität', score: scoreStabilitaet },
  ];
  const weakestDim = dims.reduce((a, b) => a.score < b.score ? a : b);

  const stressScenarios = Array.isArray(d3.stress_scenarios) ? d3.stress_scenarios : [];

  // Page 4
  const actions: any[] = Array.isArray(d4.actions) ? d4.actions : [];
  const totalPotential = actions.reduce((s: number, a: any) => s + Number(a.impact_eur || a.ebit_potential_eur || 0), 0);
  const benchmarks: any[] = Array.isArray(d4.benchmarks) ? d4.benchmarks : [];

  return {
    revenue, profit, marginPct, costTotal, costVariable, bankBalance, liquidityMonths,
    revMom, profitMom, statusColor, payrollQuote, ebitLuecke, ebitTarget, kostenquote,
    contracts, criticalContracts, totalMRR,
    scoreLeistung, scoreStruktur, scoreTrend, scoreStabilitaet, totalScore, weakestDim, stressScenarios,
    actions, totalPotential, benchmarks,
  };
}

// ─── ScoreBar ────────────────────────────────────────────────────────────────
function ScoreBar({ label, value, max = 25 }: { label: string; value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 60 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value}/{max}</span>
      </div>
      <div style={{ height: 8, borderRadius: 6, backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 6, transition: 'width 0.7s' }} />
      </div>
    </div>
  );
}

// ─── Speech Bubble (Gesprächsformulierung) ───────────────────────────────────
function Speech({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      margin: '0.5rem 0 0.75rem', padding: '0.75rem 1rem', borderLeft: '4px solid var(--copper)',
      backgroundColor: 'rgba(176,138,106,0.06)', borderRadius: '0 8px 8px 0', fontStyle: 'italic',
      fontSize: '0.85rem', color: 'var(--offwhite)', lineHeight: 1.65,
    }}>
      «{children}»
    </div>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <h4 style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--copper)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</h4>
      {subtitle && <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{subtitle}</p>}
    </div>
  );
}

// ─── Q&A Block ───────────────────────────────────────────────────────────────
function QA({ q, a }: { q: string; a: string }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f59e0b', marginBottom: '0.2rem' }}>
        Kunde: <span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--offwhite)' }}>«{q}»</span>
      </div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', paddingLeft: '0.75rem', borderLeft: '2px solid rgba(16,185,129,0.3)' }}>
        <span style={{ fontWeight: 600, color: '#10b981' }}>→ </span>{a}
      </div>
    </div>
  );
}

// ─── KPI Highlight Box ───────────────────────────────────────────────────────
function KPIBox({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ padding: '0.75rem', borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', textAlign: 'center', minWidth: 100 }}>
      <div style={{ fontSize: '1.15rem', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.15rem' }}>{label}</div>
      {sub && <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', opacity: 0.7, marginTop: '0.1rem' }}>{sub}</div>}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function LeitfadenTab({ customers }: LeitfadenTabProps) {
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [loading, setLoading] = useState(false);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<LeitfadenPage>('overview');

  const customerObj = customers.find(c => c.customer_id === selectedCustomer);
  const customerName = (customerObj?.name || customerObj?.display_name || selectedCustomer).replace(/_/g, ' ');
  const industrySegment = customerObj?.industry_segment;

  // Margin targets from config
  const marginTargets = useMemo(() => {
    if (!industrySegment) return { warn: 0.07, good: 0.12 };
    const t = getMarginTargetsForCustomer(industrySegment);
    return t ? { warn: t[0], good: t[1] } : { warn: 0.07, good: 0.12 };
  }, [industrySegment]);

  const handleGenerate = useCallback(async () => {
    if (!selectedCustomer || !selectedPeriod) { setError('Bitte Mandant und Periode auswählen'); return; }
    setLoading(true); setError(null); setKpiData(null);
    try {
      const data = await fetchAllPageData(selectedCustomer, selectedPeriod);
      setKpiData(data);
      setActivePage('overview');
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Daten');
    } finally { setLoading(false); }
  }, [selectedCustomer, selectedPeriod]);

  // Period options
  const periodOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [];
    const now = new Date();
    const mNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push({ value: `${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${mNames[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}` });
    }
    return opts;
  }, []);

  const d = kpiData;
  const isKritisch = d ? (d.marginPct < 0.05 || d.statusColor === 'RED') : false;
  const isWarnung = d ? (d.marginPct < marginTargets.good || d.statusColor === 'YELLOW') : false;
  const statusLabel = isKritisch ? 'KRITISCH' : isWarnung ? 'WARNUNG' : 'STABIL';
  const statusClr = isKritisch ? '#ef4444' : isWarnung ? '#f59e0b' : '#10b981';

  const pages: { key: LeitfadenPage; label: string; icon: string }[] = [
    { key: 'overview', label: 'Überblick', icon: '📋' },
    { key: 'seite1', label: 'S1: Gesamtlage', icon: '📊' },
    { key: 'seite2', label: 'S2: Verträge', icon: '📑' },
    { key: 'seite3', label: 'S3: Liquidität', icon: '💧' },
    { key: 'seite4', label: 'S4: Maßnahmen', icon: '🎯' },
    { key: 'abschluss', label: 'Abschluss', icon: '✅' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Generator Controls */}
      <div className="card">
        <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '1.1rem', color: 'var(--offwhite)', marginBottom: '0.5rem' }}>
          Gesprächsleitfaden generieren
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Dynamischer Leitfaden für den 60-Minuten Management-Call — basierend auf den aktuellen KPI-Daten des Mandanten.
        </p>
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '3px solid #ef4444', padding: '0.75rem 1rem', color: '#ef4444', fontSize: '0.85rem', borderRadius: 6, marginBottom: '1rem' }}>{error}</div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Mandant</label>
            <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
              <option value="">– Mandant auswählen –</option>
              {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{(c.name || c.display_name || c.customer_id).replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Berichtsperiode</label>
            <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
              <option value="">– Periode auswählen –</option>
              {periodOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <button onClick={handleGenerate} disabled={loading || !selectedCustomer || !selectedPeriod} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
            {loading ? 'Lade Daten…' : 'Leitfaden generieren'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ width: 40, height: 40, border: '3px solid rgba(176,138,106,0.2)', borderTopColor: 'var(--copper)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Kundendaten werden geladen…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ═══ RESULT ═══ */}
      {d && !loading && (
        <>
          {/* TAB NAVIGATION */}
          <div className="card" style={{ padding: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto' }}>
              {pages.map(p => (
                <button key={p.key} onClick={() => setActivePage(p.key)} style={{
                  padding: '0.5rem 0.85rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                  background: activePage === p.key ? 'var(--copper)' : 'transparent',
                  color: activePage === p.key ? '#fff' : 'var(--text-secondary)',
                }}>
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* HEADER BAR */}
          <div className="card" style={{ padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 700, color: 'var(--offwhite)', fontSize: '0.95rem' }}>{customerName}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginLeft: '0.5rem' }}>{selectedPeriod.replace(/_/g, '/')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.75rem', borderRadius: 20, color: statusClr, background: `${statusClr}18` }}>{statusLabel}</span>
              <button onClick={() => window.print()} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}>Drucken</button>
            </div>
          </div>

          {/* ═══ OVERVIEW TAB ═══ */}
          {activePage === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card" style={{ borderLeft: `4px solid ${statusClr}` }}>
                <SectionHeader title="Call-Vorbereitung auf einen Blick" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
                  <KPIBox label="EBIT" value={fmtE(d.profit)} color={d.profit >= 0 ? '#10b981' : '#ef4444'} />
                  <KPIBox label="Marge" value={fmtP(d.marginPct)} color={d.marginPct >= marginTargets.good ? '#10b981' : d.marginPct >= marginTargets.warn ? '#f59e0b' : '#ef4444'} sub={`Ziel: ${fmtP(marginTargets.good)}`} />
                  <KPIBox label="Umsatz" value={fmtE(d.revenue)} color="var(--offwhite)" sub={sign(d.revMom)} />
                  <KPIBox label="Bankbestand" value={fmtE(d.bankBalance)} color="var(--offwhite)" sub={`${d.liquidityMonths.toFixed(1)} Mon.`} />
                  <KPIBox label="Score" value={`${d.totalScore}/100`} color={d.totalScore >= 60 ? '#10b981' : d.totalScore >= 40 ? '#f59e0b' : '#ef4444'} />
                  <KPIBox label="Hebelpotenzial" value={fmtE(d.totalPotential)} color="#10b981" sub={`${d.actions.length} Maßnahmen`} />
                </div>
              </div>

              <div className="card">
                <SectionHeader title="60-Minuten Zeitplan" subtitle="Empfohlene Zeiteinteilung für den Management-Call" />
                {[
                  { time: '0–5 Min', phase: 'Eröffnung', desc: 'Begrüßung, Agenda, Rückblick letzte Maßnahmen' },
                  { time: '5–15 Min', phase: 'Gesamtlage', desc: `Status ${statusLabel}, Marge ${fmtP(d.marginPct)}, Trend besprechen` },
                  { time: '15–25 Min', phase: 'Verträge', desc: `${d.criticalContracts.length} kritische von ${d.contracts.length} Verträgen analysieren` },
                  { time: '25–35 Min', phase: 'Liquidität', desc: `Bankbestand ${fmtE(d.bankBalance)}, Reichweite ${d.liquidityMonths.toFixed(1)} Monate, Score ${d.totalScore}/100` },
                  { time: '35–50 Min', phase: 'Maßnahmen', desc: `${d.actions.length} EBIT-Hebel (${fmtE(d.totalPotential)}), gemeinsam 3–5 auswählen` },
                  { time: '50–60 Min', phase: 'Abschluss', desc: 'Zusammenfassung, Verantwortlichkeiten, nächster Termin' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.5rem 0', borderBottom: i < 5 ? '1px solid var(--border-color)' : 'none', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--copper)', minWidth: 65 }}>{row.time}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--offwhite)', minWidth: 100 }}>{row.phase}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{row.desc}</span>
                  </div>
                ))}
              </div>

              {isKritisch && (
                <div className="card" style={{ borderLeft: '4px solid #ef4444', background: 'rgba(239,68,68,0.04)' }}>
                  <SectionHeader title="⚠️ Achtung vor dem Call" />
                  <p style={{ fontSize: '0.85rem', color: 'var(--offwhite)', lineHeight: 1.6 }}>
                    Dieser Kunde ist im Status <strong style={{ color: '#ef4444' }}>KRITISCH</strong>. Bereiten Sie sich darauf vor, unbequeme Wahrheiten anzusprechen.
                    Die Liquiditätsreichweite liegt bei {d.liquidityMonths.toFixed(1)} Monaten. Fokus auf Sofortmaßnahmen.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ═══ SEITE 1: GESAMTLAGE ═══ */}
          {activePage === 'seite1' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card" style={{ borderLeft: '4px solid var(--copper)' }}>
                <SectionHeader title="Ziel dieser Seite" subtitle="Beantwortet: «Wie steht mein Unternehmen diesen Monat da?»" />
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Der Geschäftsführer erkennt auf einen Blick, ob Handlungsbedarf besteht — ohne sich durch Details zu arbeiten.
                </p>
              </div>

              <div className="card">
                <SectionHeader title="Einstieg im Call" />
                {isKritisch ? (
                  <Speech>Lassen Sie uns zuerst auf die Gesamtlage schauen. Ich sage Ihnen gleich vorab: Wir haben diesen Monat bei {customerName} ein Warnsignal — die Marge liegt bei {fmtP(d.marginPct)}. Aber lassen Sie uns gemeinsam hinschauen, dann sehen Sie sofort, woher das kommt.</Speech>
                ) : (
                  <Speech>Lassen Sie uns zuerst auf die Gesamtlage schauen. {customerName} steht diesen Monat bei einer Marge von {fmtP(d.marginPct)} — {d.marginPct >= marginTargets.good ? 'das liegt im Zielbereich' : `unser Ziel liegt bei ${fmtP(marginTargets.good)}`}. Ich zeige Ihnen, was sich gegenüber dem Vormonat verändert hat.</Speech>
                )}
              </div>

              <div className="card">
                <SectionHeader title="KPIs erklären" subtitle="Jeden Wert mit dem konkreten Kundenwert verknüpfen" />
                {[
                  { label: 'EBIT', value: fmtE(d.profit), explain: d.profit < 0 ? `${customerName} macht diesen Monat ${fmtE(Math.abs(d.profit))} Verlust. Das heißt: Nach allen Kosten bleibt nichts übrig — es geht Geld verloren.` : `${customerName} verdient diesen Monat ${fmtE(d.profit)} aus dem operativen Geschäft. Das ist der Gewinn vor Steuern und Zinsen.` },
                  { label: 'Marge', value: fmtP(d.marginPct), explain: d.marginPct < marginTargets.warn ? `Die Marge von ${fmtP(d.marginPct)} ist kritisch niedrig. Von jedem Euro Umsatz bleiben nur ${(d.marginPct * 100).toFixed(0)} Cent Gewinn. Das Branchenziel liegt bei ${fmtP(marginTargets.good)}.` : d.marginPct < marginTargets.good ? `Die Marge von ${fmtP(d.marginPct)} liegt im Korridor, aber noch unter dem Ziel von ${fmtP(marginTargets.good)}. Hier ist Luft nach oben.` : `Die Marge von ${fmtP(d.marginPct)} liegt über dem Branchenziel von ${fmtP(marginTargets.good)} — gute Arbeit.` },
                  { label: 'MoM-Trend', value: sign(d.profitMom), explain: d.profitMom > 0.03 ? `Der Gewinn ist gegenüber dem Vormonat um ${fmtP(Math.abs(d.profitMom))} gestiegen — positive Richtung.` : d.profitMom < -0.03 ? `Der Gewinn ist gegenüber dem Vormonat um ${fmtP(Math.abs(d.profitMom))} gefallen. ${d.profitMom < -0.05 ? 'Das ist kein Ausreißer mehr — hier müssen wir genauer hinschauen.' : 'Noch kein Drama, aber wir beobachten das.'}` : 'Der Gewinn ist stabil gegenüber dem Vormonat — keine signifikante Änderung.' },
                  { label: 'EBIT-Lücke', value: d.ebitLuecke > 0 ? `-${fmtE(d.ebitLuecke)}` : '✓ Im Ziel', explain: d.ebitLuecke > 0 ? `Zum Branchenziel fehlen ${fmtE(d.ebitLuecke)} pro Monat — das sind ${fmtE(d.ebitLuecke * 12)} im Jahr. Vergleichbare Unternehmen erreichen das. Auf Seite 4 zeige ich, woher wir das holen können.` : 'Sie liegen im oder über dem Branchenziel — weiter so.' },
                ].map((item, i) => (
                  <div key={i} style={{ padding: '0.75rem', borderRadius: 8, marginBottom: '0.5rem', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--offwhite)' }}>{item.label}</span>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--copper)' }}>{item.value}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{item.explain}</p>
                  </div>
                ))}
              </div>

              <div className="card">
                <SectionHeader title="Typische Rückfragen" />
                <QA q="Warum ist die Marge schlechter als letzten Monat?"
                  a={`Es gibt zwei häufige Gründe: Entweder sind die Kosten gestiegen, oder der Umsatzmix hat sich verschoben. ${d.revMom - d.profitMom > 0.02 ? `Bei Ihnen sehen wir Kostendruck — die Kosten wachsen schneller als der Umsatz (${sign(d.revMom - d.profitMom)}).` : 'Bei Ihnen sehen wir keine dramatische Kostenverschiebung.'} Auf Seite 2 sehen wir genau, welche Verträge das verursacht haben.`} />
                <QA q="Ist das einmalig oder strukturell?"
                  a={d.profitMom < -0.03 ? 'Wenn der Trend zwei oder drei Monate in Folge fällt, ist es strukturell. Hier sehen wir einen fallenden Trend — das sollten wir ernst nehmen.' : 'Ein Monat allein sagt wenig. Was zählt ist die Richtung über 2–3 Monate. Aktuell sehe ich hier noch keinen strukturellen Abwärtstrend.'} />
                <QA q="Was bedeutet die EBIT-Lücke konkret?"
                  a={d.ebitLuecke > 0 ? `Ihre Lücke beträgt ${fmtE(d.ebitLuecke)} pro Monat — das sind ${fmtE(d.ebitLuecke * 12)} im Jahr. Das ist kein Luxus-Ziel — vergleichbare Unternehmen erreichen das. Auf Seite 4 zeige ich Ihnen, woher wir das holen können.` : 'Sie liegen aktuell im Zielbereich — das ist eine gute Ausgangslage. Jetzt geht es darum, diese Position zu halten und weiter auszubauen.'} />
              </div>

              <div className="card" style={{ borderLeft: '4px solid var(--copper)' }}>
                <SectionHeader title="Überleitung zu Seite 2" />
                <Speech>Das ist die Gesamtlage — {isKritisch ? 'wir haben klaren Handlungsbedarf' : isWarnung ? 'es gibt Optimierungspotenzial' : 'wir sind auf einem guten Weg'}. Jetzt schauen wir uns an, welche Verträge das Ergebnis treiben und wo die konkreten Ursachen liegen.</Speech>
              </div>
            </div>
          )}

          {/* ═══ SEITE 2: VERTRAGSANALYSE ═══ */}
          {activePage === 'seite2' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card" style={{ borderLeft: '4px solid var(--copper)' }}>
                <SectionHeader title="Ziel dieser Seite" subtitle="Beantwortet: «Welche Verträge verdienen Geld und welche kosten mich Geld?»" />
              </div>

              <div className="card">
                <SectionHeader title="Einstieg im Call" />
                <Speech>Jetzt schauen wir uns an, woher Ihr Ergebnis kommt. {d.contracts.length > 0 ? `Sie haben ${d.contracts.length} aktive Verträge. Davon sind ${d.criticalContracts.length} unter 5% Marge — ${d.criticalContracts.length > 0 ? 'das sind die, die wir uns jetzt genauer anschauen' : 'eine gute Verteilung'}.` : 'Wir schauen uns die einzelnen Verträge an, um zu sehen, wo der Schuh drückt.'}</Speech>
              </div>

              {d.criticalContracts.length > 0 && (
                <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
                  <SectionHeader title={`${d.criticalContracts.length} kritische Verträge`} subtitle="Fokus auf diese 2–3 Verträge im Call" />
                  {d.criticalContracts.slice(0, 5).map((c: any, i: number) => {
                    const cMargin = Number(c.margin_pct || 0);
                    const cRevenue = Number(c.revenue || c.mrr || 0);
                    const cProfit = Number(c.profit || c.ebit || 0);
                    const cName = c.contract_name || c.action_label || c.customer_contract || `Vertrag ${i + 1}`;
                    return (
                      <div key={i} style={{ padding: '0.75rem', borderRadius: 8, marginBottom: '0.5rem', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--offwhite)' }}>{cName}</span>
                          <span style={{ fontWeight: 700, color: cMargin < 0 ? '#ef4444' : '#f59e0b', fontSize: '0.85rem' }}>{fmtP(cMargin)}</span>
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          Umsatz {fmtE(cRevenue)} · EBIT {fmtE(cProfit)}
                          {cMargin < 0 ? ' — Sie zahlen bei diesem Vertrag drauf!' : ' — unter dem Branchenziel'}
                        </p>
                        <Speech>{cMargin < 0
                          ? `Dieser Vertrag kostet Sie ${fmtE(Math.abs(cProfit))} pro Monat. Die Frage ist: Preisanpassung, Leistungsreduzierung oder Kündigung?`
                          : `Dieser Vertrag hat ${fmtP(cMargin)} Marge. Wenn wir den auf ${fmtP(marginTargets.good)} bringen, sind das ${fmtE(Math.max(0, cRevenue * (marginTargets.good - cMargin)))} mehr pro Monat.`
                        }</Speech>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="card">
                <SectionHeader title="Typische Rückfragen" />
                <QA q="Den Vertrag kann ich nicht kündigen — der Kunde ist wichtig."
                  a="Das verstehe ich. Kündigung ist auch nicht immer die Lösung. Aber einen Vertrag mit Verlust weiterzuführen ist auch keine Lösung. Die Frage ist: Wie bringen wir den Vertrag mindestens auf Null? Preiserhöhung, Leistungsreduzierung oder Effizienzsteigerung." />
                <QA q="Warum haben wir so viele Verträge unter 5%?"
                  a={`Das sehe ich häufig, wenn Preise längere Zeit nicht angepasst wurden. Personalkosten steigen typisch 2–3% pro Jahr — wenn der Vertragspreis gleich bleibt, schrumpft die Marge automatisch. ${d.criticalContracts.length > 2 ? 'Bei Ihnen sind es gleich ' + d.criticalContracts.length + ' Verträge — das deutet auf ein systematisches Preisproblem hin.' : ''}`} />
              </div>

              <div className="card" style={{ borderLeft: '4px solid var(--copper)' }}>
                <SectionHeader title="Überleitung zu Seite 3" />
                <Speech>Wir wissen jetzt, welche Verträge das Ergebnis drücken. Die entscheidende Frage ist: Haben Sie genug finanziellen Spielraum, um gegenzusteuern? Das schauen wir uns jetzt an.</Speech>
              </div>
            </div>
          )}

          {/* ═══ SEITE 3: LIQUIDITÄT ═══ */}
          {activePage === 'seite3' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card" style={{ borderLeft: '4px solid var(--copper)' }}>
                <SectionHeader title="Ziel dieser Seite" subtitle="Beantwortet: «Habe ich genug Geld, um die nächsten Monate zu überstehen?»" />
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Die Marge zeigt ob Sie Geld verdienen. Die Liquidität zeigt ob Sie zahlungsfähig bleiben.
                </p>
              </div>

              <div className="card">
                <SectionHeader title="Einstieg im Call" />
                <Speech>Jetzt schauen wir auf die Liquidität. {d.bankBalance > 0 ? `${customerName} hat aktuell ${fmtE(d.bankBalance)} auf dem Konto.` : ''} {d.liquidityMonths < 1.5 ? `Das klingt erstmal okay, aber bei Ihren monatlichen Kosten reicht das nur für ${d.liquidityMonths.toFixed(1)} Monate — da müssen wir aufpassen.` : d.liquidityMonths < 3 ? `Das reicht für ${d.liquidityMonths.toFixed(1)} Monate — ein solider, aber nicht üppiger Puffer.` : `Das reicht für ${d.liquidityMonths.toFixed(1)} Monate — ein komfortabler Puffer.`}</Speech>
              </div>

              <div className="card">
                <SectionHeader title="Finanzstabilitäts-Score erklären" />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Gesamtbewertung der finanziellen Gesundheit</span>
                  <span style={{
                    fontSize: '1.5rem', fontWeight: 800, padding: '0.25rem 0.75rem', borderRadius: 10,
                    color: d.totalScore >= 60 ? '#10b981' : d.totalScore >= 40 ? '#f59e0b' : '#ef4444',
                    backgroundColor: d.totalScore >= 60 ? 'rgba(16,185,129,0.12)' : d.totalScore >= 40 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                  }}>{d.totalScore}/100</span>
                </div>
                <ScoreBar label="Leistung (Marge & Ertrag)" value={d.scoreLeistung} />
                <ScoreBar label="Struktur (Liquidität)" value={d.scoreStruktur} />
                <ScoreBar label="Trend (Entwicklung)" value={d.scoreTrend} />
                <ScoreBar label="Stabilität" value={d.scoreStabilitaet} />
                <Speech>Ihr Score ist {d.totalScore} von 100. Am schwächsten ist die Dimension «{d.weakestDim.name}» mit {d.weakestDim.score}/25 — {d.weakestDim.name === 'Leistung' ? 'das heißt, die Marge muss rauf' : d.weakestDim.name === 'Struktur' ? 'das heißt, die Liquiditätsreserve muss wachsen' : d.weakestDim.name === 'Trend' ? 'das heißt, die Richtung muss sich drehen' : 'das heißt, wir brauchen mehr Stabilität'}. Wenn wir das verbessern, steigt der Gesamtscore am stärksten.</Speech>
              </div>

              <div className="card">
                <SectionHeader title="Typische Rückfragen" />
                <QA q={`Unter ${d.liquidityMonths.toFixed(1)} Monate — muss ich mir Sorgen machen?`}
                  a={d.liquidityMonths < 1.5 ? 'Sorgen nicht, aber aufpassen. Wenn morgen kein neuer Umsatz kommt, sind die Reserven in wenigen Wochen aufgebraucht. Wir schauen gleich auf Seite 4, welche Liquiditätshebel wir kurzfristig ziehen können.' : 'Nein, die Reichweite ist solide. Aber wir wollen sie nicht unterschätzen — ein unerwarteter Auftragsausfall kann das schnell ändern.'} />
                <QA q="Was bringt mir der Score konkret?"
                  a="Der Score ist Ihr Gesundheits-Check in einer Zahl. Er zeigt auf einen Blick, ob Sie sich verschlechtern — auch wenn einzelne KPIs noch okay aussehen. Und er zeigt, wo Sie den Hebel ansetzen müssen." />
              </div>

              <div className="card" style={{ borderLeft: '4px solid var(--copper)' }}>
                <SectionHeader title="Überleitung zu Seite 4" />
                <Speech>Wir wissen jetzt: Wo stehen wir, was drückt das Ergebnis, und wie stabil sind wir finanziell. Jetzt kommt der wichtigste Teil: Was machen wir konkret? Welche Maßnahmen bringen den größten Effekt?</Speech>
              </div>
            </div>
          )}

          {/* ═══ SEITE 4: MAßNAHMEN ═══ */}
          {activePage === 'seite4' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card" style={{ borderLeft: '4px solid var(--copper)' }}>
                <SectionHeader title="Ziel dieser Seite" subtitle="Beantwortet: «Was mache ich jetzt konkret?»" />
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Hier fallen die Entscheidungen. Der Geschäftsführer geht nicht mit Zahlen aus dem Call, sondern mit einem Aktionsplan.
                </p>
              </div>

              <div className="card">
                <SectionHeader title="Einstieg im Call" />
                <Speech>Jetzt wird es konkret. Wir haben {d.actions.length} EBIT-Hebel identifiziert mit einem Gesamtpotenzial von {fmtE(d.totalPotential)} pro Monat. Das sind {fmtE(d.totalPotential * 12)} im Jahr. Lassen Sie uns gemeinsam die 3 bis 5 Maßnahmen auswählen, die den größten Effekt haben.</Speech>
              </div>

              <div className="card">
                <SectionHeader title="Maßnahmen-Herkunft erklären" />
                <Speech>Die Maßnahmen kommen aus drei Quellen: Erstens aus Ihren Vertragsdaten — welche Verträge haben das größte Verbesserungspotenzial. Zweitens aus dem Branchenvergleich — wo liegen Sie unter dem Zielwert. Und drittens aus der Liquiditätsanalyse — wo können Sie kurzfristig Geld freisetzen.</Speech>
              </div>

              {d.actions.length > 0 && (
                <div className="card">
                  <SectionHeader title={`Top ${Math.min(5, d.actions.length)} EBIT-Hebel`} subtitle="Diese im Call besprechen" />
                  {d.actions.slice(0, 5).map((a: any, i: number) => {
                    const impact = Number(a.impact_eur || a.ebit_potential_eur || 0);
                    const margin = Number(a.margin_pct || 0);
                    const name = a.action_label || a.contract_name || `Maßnahme ${i + 1}`;
                    return (
                      <div key={i} style={{ padding: '0.75rem', borderRadius: 8, marginBottom: '0.5rem', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--offwhite)' }}>
                            <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: '50%', background: 'var(--copper)', color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, marginRight: '0.5rem' }}>{i + 1}</span>
                            {name}
                          </span>
                          <span style={{ fontWeight: 700, color: '#10b981' }}>+{fmtE(impact)}</span>
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: '1.75rem' }}>
                          Marge: {fmtP(margin)} · {margin < 0 ? 'Verlustvertrag — Kündigung oder Preisanpassung +15–20%' : margin < 0.05 ? 'Stundensatz um 10–15% erhöhen, Einsatzplanung optimieren' : margin < marginTargets.good ? `Noch ${fmtP(marginTargets.good - margin)} bis Branchenziel — Preisindex-Klausel, Zusatzleistungen` : 'Im Zielbereich — Konditionen halten'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
                <SectionHeader title="Gemeinsame Auswahl: So führen Sie den Kunden" />
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--offwhite)' }}>Schritt 1:</strong> Überblick geben
                </p>
                <Speech>Wir haben insgesamt {d.actions.length} Maßnahmen identifiziert. Das System empfiehlt die Top 5. Lassen Sie uns gemeinsam entscheiden, welche 3 bis 5 wir diesen Monat angehen.</Speech>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', marginTop: '0.75rem', lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--offwhite)' }}>Schritt 2:</strong> Die magische Frage
                </p>
                <Speech>Wenn Sie sich für nur EINE Maßnahme entscheiden müssten — welche wäre das?</Speech>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Der Kunde nennt fast immer die richtige. Von dort: «Gut, das ist Nummer 1. Was kommt als Nächstes?»
                </p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', marginTop: '0.75rem', lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--offwhite)' }}>Wenn «wir machen alles»:</strong>
                </p>
                <Speech>Ich verstehe den Impuls. Aber die Erfahrung zeigt: Wer 3 Maßnahmen richtig umsetzt, holt mehr raus als wer 8 anfängt und keine abschließt. Starten wir mit den Top 3 — wenn die laufen, nehmen wir nächsten Monat weitere dazu.</Speech>
              </div>

              <div className="card">
                <SectionHeader title="Typische Rückfragen" />
                <QA q="Woher kommen die Euro-Beträge?"
                  a="Bei Verträgen rechnen wir: Was würde dieser Vertrag einbringen, wenn er auf Branchenmarge läge? Die Differenz ist Ihr Potenzial. Bei Benchmarks schätzen wir den Effekt — z.B. 5 Prozentpunkte mehr Produktivität mal Teamgröße mal Stundensatz. Das ist keine exakte Zahl, aber eine fundierte Orientierung." />
                <QA q="Das klingt hoch — ist das realistisch?"
                  a={`Das ist der theoretische Maximalwert. In der Praxis erreichen die meisten 60–80%. Aber selbst 60% von ${fmtE(d.totalPotential)} sind ${fmtE(d.totalPotential * 0.6)} mehr pro Monat — das sind ${fmtE(d.totalPotential * 0.6 * 12)} im Jahr.`} />
              </div>
            </div>
          )}

          {/* ═══ ABSCHLUSS ═══ */}
          {activePage === 'abschluss' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card" style={{ borderLeft: '4px solid var(--copper)' }}>
                <SectionHeader title="Call-Abschluss (10 Minuten)" subtitle="Zusammenfassung, Verantwortlichkeiten, nächster Termin" />
              </div>

              <div className="card">
                <SectionHeader title="Zusammenfassung formulieren" />
                <Speech>Lassen Sie mich kurz zusammenfassen, was wir heute besprochen und beschlossen haben.</Speech>
                <div style={{ padding: '0.75rem', borderRadius: 8, background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    <strong style={{ color: 'var(--offwhite)' }}>Gesamtlage:</strong> {statusLabel}, Marge {fmtP(d.marginPct)} {d.ebitLuecke > 0 ? `(${fmtE(d.ebitLuecke)} unter Branchenziel)` : '(im Ziel)'}.
                    <br /><strong style={{ color: 'var(--offwhite)' }}>Verträge:</strong> {d.criticalContracts.length} von {d.contracts.length} kritisch.
                    <br /><strong style={{ color: 'var(--offwhite)' }}>Liquidität:</strong> {fmtE(d.bankBalance)} Bankbestand, {d.liquidityMonths.toFixed(1)} Monate Reichweite, Score {d.totalScore}/100.
                    <br /><strong style={{ color: 'var(--offwhite)' }}>Potenzial:</strong> {fmtE(d.totalPotential)} EBIT p.M. aus {d.actions.length} identifizierten Hebeln.
                  </p>
                </div>
              </div>

              <div className="card">
                <SectionHeader title="Pro Maßnahme klären" subtitle="Für jede ausgewählte Maßnahme diese 4 Punkte festhalten:" />
                {['Was genau wird gemacht? (eine konkrete Handlung, kein Ziel)', 'Wer macht es? (Name, nicht «wir»)', 'Bis wann? (Datum, nicht «bald»)', 'Wie messen wir den Erfolg? (Zielwert)'].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--copper)', minWidth: 18 }}>{i + 1}.</span>
                    {item}
                  </div>
                ))}
              </div>

              <div className="card">
                <SectionHeader title="Schluss-Formulierung" />
                <Speech>Sie bekommen in den nächsten Tagen den Monatsreport. Da steht alles drin, was wir heute besprochen haben — inklusive der konkreten Maßnahmen mit Euro-Effekt und Verantwortlichkeiten. Beim nächsten Call schauen wir als Erstes, wie sich die Maßnahmen entwickelt haben. Haben Sie noch Fragen?</Speech>
              </div>

              <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
                <SectionHeader title="Nächste Schritte" />
                {[
                  { phase: 'Sofort', color: '#10b981', items: isKritisch ? ['Liquiditätsplan erstellen', 'Top-3 Maßnahmen starten', 'Kritische Verträge nachverhandeln'] : ['Ausgewählte Maßnahmen starten', 'Verantwortlichkeiten kommunizieren'] },
                  { phase: '1–2 Wochen', color: '#f59e0b', items: ['Zwischenstand bei Maßnahmen-Verantwortlichen einholen', 'Monatsreport versenden'] },
                  { phase: 'Nächster Call', color: '#f97316', items: ['Maßnahmen-Review als Einstieg', 'Neue Monatsdaten besprechen', 'Pipeline anpassen'] },
                ].map((block, i) => (
                  <div key={i} style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: block.color }} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--offwhite)' }}>{block.phase}</span>
                    </div>
                    {block.items.map((item, j) => (
                      <p key={j} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '1.25rem', marginBottom: '0.15rem' }}>• {item}</p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Initial state */}
      {!kpiData && !loading && !error && (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📋</div>
          <p style={{ fontSize: '0.9rem', color: 'var(--offwhite)', fontWeight: 500 }}>
            Wählen Sie einen Mandanten und eine Periode aus
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Der Leitfaden wird dynamisch aus den aktuellen Kundendaten generiert — mit konkreten Gesprächsformulierungen, KPI-Erklärungen und Rückfragen.
          </p>
        </div>
      )}
    </div>
  );
}
