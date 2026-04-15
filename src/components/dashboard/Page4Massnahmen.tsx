'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { api } from '@/lib/api';
import { getTargetsForCustomer } from '@/lib/config';
import {
  runEngine, loadItems, saveItems, acceptRecommendation, addFromPool,
  updateItemStatus, removeItem as removeEngineItem, getAutoCompleteHints,
  computeKPIs, sortByPriority, applyCarryOver, deduplicateItems,
  type MassnahmeItem, type MassnahmeStatus, type Recommendation, type EngineState,
  type BenchmarkInput, type LiquidityLeverInput,
  estimateBenchmarkEurImpact,
} from '@/lib/massnahmen-engine';

interface Props {
  data: any;
  customer: string;
  period: string;
  industrySegment?: string;
}

const fmtEur = (n: any) =>
  n != null ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n)) : '–';

const fmtPct = (n: any) =>
  n != null ? `${(Number(n) * 100).toFixed(1)} %` : '–';

// ─── Fallback-Benchmarks ─────────────────────────────────────────────────────
const FALLBACK_BENCHMARKS = [
  { kpi_label: 'Produktivität', current: 0, target_min: 0.70, target_mid: 0.80, target_max: 0.90 },
  { kpi_label: 'Stundensatz (€)', current: 0, target_min: 95, target_mid: 105, target_max: 120 },
  { kpi_label: 'Personalkostenquote', current: 0, target_min: 0.40, target_mid: 0.45, target_max: 0.55 },
];

// ─── Benchmark Gauge Component (unchanged) ───────────────────────────────────
function BenchmarkGauge({ label, current, targetMin, targetMid, targetMax, isProxy, monthlyRevenue }: {
  label: string; current: number; targetMin: number; targetMid: number; targetMax: number; isProxy?: boolean; monthlyRevenue?: number;
}) {
  const hasValue = current > 0;
  const isAbsScale = targetMax > 10;
  const lbl = (label || '').toLowerCase();
  const lowerIsBetter = lbl.includes('personal') || lbl.includes('lohn') || lbl.includes('pkq');

  let score = 0;
  let scoreLabel = '–';
  if (hasValue) {
    if (isAbsScale) { score = current; scoreLabel = `${Math.round(current)} €`; }
    else { score = Math.round(current * 100); scoreLabel = `${score} / 100`; }
  }

  const scMin = isAbsScale ? targetMin : Math.round(targetMin * 100);
  const scMid = isAbsScale ? targetMid : Math.round(targetMid * 100);
  const scMax = isAbsScale ? targetMax : Math.round(targetMax * 100);
  const scCur = isAbsScale ? current : Math.round(current * 100);

  const scaleMax = isAbsScale ? Math.max(targetMax * 1.25, current * 1.1) : 100;
  const pctCurrent = hasValue ? Math.min((scCur / scaleMax) * 100, 100) : 0;
  const pctMin = (scMin / scaleMax) * 100;
  const pctMax = Math.min((scMax / scaleMax) * 100, 100);
  const pctMid = (scMid / scaleMax) * 100;

  let barColor = '#ccc', statusText = 'Keine Daten', statusBg = '#F5F5F5', statusColor = '#999';
  if (hasValue) {
    if (lowerIsBetter) {
      if (current <= targetMin) { barColor = '#1B5E20'; statusText = '★ Übertrifft'; statusBg = '#E8F5E9'; statusColor = '#1B5E20'; }
      else if (current <= targetMid) { barColor = '#2E8B57'; statusText = '✓ Im Ziel'; statusBg = '#E8F5E9'; statusColor = '#2E7D32'; }
      else if (current <= targetMax) { barColor = '#E8A76A'; statusText = 'Optimierbar'; statusBg = '#FFF8E1'; statusColor = '#E65100'; }
      else { barColor = '#C43830'; statusText = 'Kritisch'; statusBg = '#FFEBEE'; statusColor = '#C43830'; }
    } else {
      if (current >= targetMid) { barColor = '#1B5E20'; statusText = '★ Übertrifft'; statusBg = '#E8F5E9'; statusColor = '#1B5E20'; }
      else if (current >= targetMin) { barColor = '#2E8B57'; statusText = '✓ Im Ziel'; statusBg = '#E8F5E9'; statusColor = '#2E7D32'; }
      else {
        const gap = targetMin > 0 ? (targetMin - current) / targetMin : 0;
        if (gap > 0.2) { barColor = '#C43830'; statusText = 'Kritisch'; statusBg = '#FFEBEE'; statusColor = '#C43830'; }
        else { barColor = '#E8A76A'; statusText = 'Optimierbar'; statusBg = '#FFF8E1'; statusColor = '#E65100'; }
      }
    }
  }

  const belowTarget = hasValue && (lowerIsBetter ? scCur > scMax : scCur < scMin);
  const inTarget = hasValue && !belowTarget && (lowerIsBetter ? scCur <= scMax : scCur >= scMin);

  let explanation = '';
  if (lbl.includes('produktiv')) explanation = hasValue ? `${score}% der Kapazität werden produktiv genutzt` : 'Anteil produktiv genutzter Arbeitsstunden';
  else if (lbl.includes('stundensatz') || lbl.includes('preis')) explanation = hasValue ? 'Durchschnittlicher Verrechnungssatz' : 'Durchschnittlicher Verrechnungssatz je Stunde';
  else if (lbl.includes('personal') || lbl.includes('lohn')) explanation = hasValue ? `${score}% des Umsatzes gehen in Personalkosten` : 'Personalkostenanteil am Umsatz';

  return (
    <div className="card">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{label}</div>
          <div className="text-xl font-bold mt-0.5" style={{ color: hasValue ? barColor : 'var(--text-secondary)' }}>{scoreLabel}</div>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: statusBg, color: statusColor }}>{statusText}</span>
      </div>
      {explanation && <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{explanation}</div>}
      <div className="relative h-4 rounded-full" style={{ backgroundColor: '#F0EDE8' }}>
        <div className="absolute h-4 rounded" style={{ left: `${pctMin}%`, width: `${Math.max(0, pctMax - pctMin)}%`, backgroundColor: 'rgba(46,139,87,0.15)', borderLeft: '2px solid rgba(46,139,87,0.4)', borderRight: '2px solid rgba(46,139,87,0.4)' }} />
        {hasValue && <div className="absolute h-4 rounded-full transition-all" style={{ width: `${pctCurrent}%`, backgroundColor: barColor, opacity: 0.85 }} />}
        <div className="absolute top-0 h-4" style={{ left: `${pctMid}%`, width: 2, backgroundColor: '#333', borderRadius: 1 }} />
      </div>
      <div className="flex justify-between text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
        <span>{isAbsScale ? '0 €' : '0'}</span>
        <span style={{ color: '#2E8B57', fontWeight: 600 }}>Ziel: {isAbsScale ? `${Math.round(scMid)} €` : scMid}</span>
        <span>{isAbsScale ? `${Math.round(scaleMax)} €` : '100'}</span>
      </div>
      {!hasValue && <div className="text-xs mt-1 text-center" style={{ color: 'var(--text-secondary)' }}>Istwert wird nach Datenpflege angezeigt</div>}
      {hasValue && belowTarget && (
        <div className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(196,56,48,0.06)', borderLeft: '3px solid #C43830', color: 'var(--text-secondary)' }}>
          → {getBenchmarkMassnahme(label, scCur, scMin, scMid, isAbsScale, monthlyRevenue)}
        </div>
      )}
      {hasValue && inTarget && scCur < scMid && (
        <div className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(232,167,106,0.08)', borderLeft: '3px solid #E8A76A', color: 'var(--text-secondary)' }}>
          → {getBenchmarkMassnahme(label, scCur, scMin, scMid, isAbsScale, monthlyRevenue)}
        </div>
      )}
    </div>
  );
}

function getBenchmarkMassnahme(label: string, current: number, min: number, mid: number, isAbsScale: boolean, monthlyRevenue?: number): string {
  const lbl = (label || '').toLowerCase();
  const gap = mid - current;
  // EUR-Impact berechnen: Werte zurück in Originalskala konvertieren (Gauge zeigt 0-100, Engine erwartet 0-1)
  const rawCur = isAbsScale ? current : current / 100;
  const rawMid = isAbsScale ? mid : mid / 100;
  const eurImpact = (monthlyRevenue && monthlyRevenue > 0) ? estimateBenchmarkEurImpact(label, rawCur, rawMid, monthlyRevenue) : 0;
  const eurStr = eurImpact > 0 ? ` — Potenzial ≈ ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(eurImpact)}/Monat` : '';
  if (lbl.includes('produktiv')) {
    if (current < min) return `Produktivität ${gap} Punkte unter Ziel: Leerlaufzeiten reduzieren, Einsatzplanung straffen${eurStr}`;
    return `Noch ${gap} Punkte bis Zielwert: Schichtübergaben optimieren, Auslastung verbessern${eurStr}`;
  }
  if (lbl.includes('stundensatz') || lbl.includes('preis')) {
    const gapEur = Math.round(mid - current);
    if (current < min) return `Stundensatz ${gapEur} € unter Ziel: Preiserhöhung bei Vertragsverlängerung${eurStr}`;
    return `Noch ${gapEur} € bis Zielwert: Staffelpreise für Zusatzleistungen einführen${eurStr}`;
  }
  if (lbl.includes('personal') || lbl.includes('lohn')) {
    if (current > mid) return `PKQ ${current - mid} Punkte über Ziel: Überstunden abbauen, Automatisierung prüfen${eurStr}`;
    return `PKQ im Zielbereich, aber optimierbar: Einsatzeffizienz steigern${eurStr}`;
  }
  return `Wert ${gap > 0 ? gap + ' Punkte unter' : 'im'} Zielbereich — Optimierungspotenzial vorhanden${eurStr}`;
}

function getMassnahmeText(action: any, rank: number): string {
  const margin = Number(action.margin_pct ?? 0);
  if (margin < 0) return 'Vertrag kündigen oder Nachverhandlung mit Preisanpassung +15–20%';
  if (margin < 0.05) return 'Stundensatz um 10–15% erhöhen, Materialzuschlag prüfen, Einsatzplanung optimieren';
  if (margin < 0.08) return 'Einsatzzeiten verdichten, Fahrtkosten reduzieren, Leistungsumfang anpassen';
  if (margin < 0.12) return 'Zusatzleistungen anbieten, Vertragslaufzeit verlängern, Preisindex-Klausel einbauen';
  return 'Vertrag als Referenz nutzen, Konditionen bei Verlängerung halten';
}

// ─── Style Constants ─────────────────────────────────────────────────────────
type EbitTab = 'top' | 'sonstige';
type PoolTab = 'alle' | 'vertraege' | 'benchmarks' | 'liquiditaet';
type TrackerTab = 'aktiv' | 'umgesetzt';

const DOT = { width: 8, height: 8, borderRadius: '50%', background: '#8B6A40', flexShrink: 0 as const, display: 'inline-block' as const };
const COPPER_LINE = { width: 32, height: 2, background: '#C8A96E', borderRadius: 1, marginBottom: '1rem' };

// ─── Status Badge Component ──────────────────────────────────────────────────
function StatusBadge({ status, carryOver }: { status: MassnahmeStatus; carryOver: number }) {
  const config: Record<MassnahmeStatus, { bg: string; color: string; dot: string; label: string }> = {
    OPEN: { bg: '#FFF8E1', color: '#E65100', dot: '#F59E0B', label: 'Offen' },
    IN_PROGRESS: { bg: '#E3F2FD', color: '#1565C0', dot: '#2196F3', label: 'In Arbeit' },
    DONE: { bg: '#E8F5E9', color: '#2E7D32', dot: '#4CAF50', label: 'Umgesetzt' },
  };
  const c = config[status] || config.OPEN;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: c.bg, color: c.color }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, display: 'inline-block' }} />
      {c.label}
      {carryOver > 0 && (
        <span className="ml-1 text-xs opacity-70" title={`Seit ${carryOver} Monat${carryOver > 1 ? 'en' : ''} offen`}>
          +{carryOver}M
        </span>
      )}
    </span>
  );
}

// ─── Urgency Badge ───────────────────────────────────────────────────────────
function UrgencyBadge({ urgency }: { urgency: 'KRITISCH' | 'HOCH' | 'MITTEL' }) {
  const conf = {
    KRITISCH: { bg: '#FFEBEE', color: '#C62828', icon: '🔴' },
    HOCH: { bg: '#FFF3E0', color: '#E65100', icon: '🟠' },
    MITTEL: { bg: '#FFF8E1', color: '#F57F17', icon: '🟡' },
  };
  const c = conf[urgency];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: c.bg, color: c.color }}>
      <span style={{ fontSize: 8 }}>{c.icon}</span>
      {urgency}
    </span>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function Page4Massnahmen({ data, customer, period, industrySegment }: Props) {
  const actions: any[] = useMemo(() => (data as any)?.actions || [], [data]);
  const rawBenchmarks: any[] = (data as any)?.benchmarks || [];

  // ─── Industry Targets ──────────────────────────────────────────────────────
  const industryTargets = useMemo(() => {
    if (!industrySegment) return null;
    const einsatzlogik = (data as any)?.einsatzlogik_segment || undefined;
    return getTargetsForCustomer(industrySegment, einsatzlogik);
  }, [industrySegment, data]);

  const benchmarks = useMemo(() => {
    if (rawBenchmarks.length > 0 && rawBenchmarks.some((b: any) => Number(b.current ?? 0) > 0)) {
      if (industryTargets) {
        return rawBenchmarks.map((b: any) => {
          const lbl = (b.kpi_label || '').toLowerCase();
          if (lbl.includes('produktiv') && industryTargets.productivity_hours_target) {
            return { ...b, target_min: (industryTargets.productivity_hours_low || 1400) / 2000, target_mid: industryTargets.productivity_hours_target / 2000, target_max: (industryTargets.productivity_hours_high || 1800) / 2000 };
          }
          if ((lbl.includes('stundensatz') || lbl.includes('preis')) && industryTargets.target_hourly_rate) {
            const [lo, mid, hi] = industryTargets.target_hourly_rate;
            return { ...b, target_min: lo, target_mid: mid, target_max: hi };
          }
          if ((lbl.includes('personal') || lbl.includes('lohn')) && industryTargets.target_payroll_cost_pct) {
            const [lo, mid, hi] = industryTargets.target_payroll_cost_pct;
            return { ...b, target_min: lo, target_mid: mid, target_max: hi };
          }
          return b;
        });
      }
      return rawBenchmarks;
    }
    const targets = industryTargets;
    const prodLow = targets?.productivity_hours_low ? targets.productivity_hours_low / 2000 : 0.70;
    const prodMid = targets?.productivity_hours_target ? targets.productivity_hours_target / 2000 : 0.80;
    const prodHigh = targets?.productivity_hours_high ? targets.productivity_hours_high / 2000 : 0.90;
    const base: any[] = targets ? [
      { kpi_label: 'Produktivität', current: 0, target_min: prodLow, target_mid: prodMid, target_max: prodHigh },
      { kpi_label: 'Stundensatz (€)', current: 0, target_min: targets.target_hourly_rate?.[0] || 95, target_mid: targets.target_hourly_rate?.[1] || 105, target_max: targets.target_hourly_rate?.[2] || 120 },
      { kpi_label: 'Personalkostenquote', current: 0, target_min: targets.target_payroll_cost_pct?.[0] || 0.40, target_mid: targets.target_payroll_cost_pct?.[1] || 0.45, target_max: targets.target_payroll_cost_pct?.[2] || 0.55 },
    ] : (rawBenchmarks.length > 0 ? rawBenchmarks : FALLBACK_BENCHMARKS);

    const wirkungMargin = Number((data as any)?.wirkung?.margin_pct ?? 0);
    const actionsArr: any[] = (data as any)?.actions || [];
    let avgMargin = wirkungMargin;
    if (!avgMargin && actionsArr.length > 0) {
      const vals = actionsArr.map((a: any) => Number(a.margin_pct ?? 0)).filter((v: number) => v > 0);
      if (vals.length > 0) avgMargin = vals.reduce((s: number, v: number) => s + v, 0) / vals.length;
    }
    if (!avgMargin) avgMargin = 0.05;
    return base.map((b: any) => {
      const tMid = Number(b.target_mid ?? 0);
      const label = (b.kpi_label || '').toLowerCase();
      let proxyValue = 0;
      if (label.includes('produktiv')) proxyValue = Math.min(0.95, Math.max(0.5, 0.65 + avgMargin * 1.5));
      else if (label.includes('stundensatz') || label.includes('preis')) proxyValue = Math.round(tMid * (0.7 + Math.min(avgMargin, 0.25) * 3));
      else if (label.includes('personal') || label.includes('lohn')) proxyValue = Math.max(0.32, Math.min(0.70, 0.55 - avgMargin * 0.6));
      return proxyValue > 0 ? { ...b, current: proxyValue, isProxy: true } : b;
    });
  }, [rawBenchmarks, data, industryTargets]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ENGINE STATE (wird nach benchmarks + liqLevers initialisiert, s.u.)
  // ═══════════════════════════════════════════════════════════════════════════

  const [engineState, setEngineState] = useState<EngineState>({ items: [], recommendations: [], kpis: { active_count: 0, done_count: 0, open_pipeline: 0, realized_ebit: 0, total_potenzial: 0, capture_rate: 0, carry_over_count: 0, new_this_month: 0 } });

  const { items, recommendations, kpis } = engineState;

  // Aktive & Umgesetzte Items
  const activeItems = useMemo(() =>
    sortByPriority(items.filter(i => i.status !== 'DONE' && i.current_period === period)),
    [items, period]);
  const doneItems = useMemo(() => items.filter(i => i.status === 'DONE'), [items]);
  const allCurrentItems = useMemo(() =>
    sortByPriority(items.filter(i => i.current_period === period)),
    [items, period]);

  // Auto-Complete Hints
  const autoCompleteKeys = useMemo(() => getAutoCompleteHints(items), [items]);

  // ─── Persistenz-Wrapper ────────────────────────────────────────────────────
  const updateEngine = useCallback((updater: (items: MassnahmeItem[]) => MassnahmeItem[]) => {
    setEngineState(prev => {
      const newItems = updater(prev.items);
      saveItems(customer, newItems);
      const newKPIs = computeKPIs(newItems, period);
      return { ...prev, items: newItems, kpis: newKPIs };
    });
  }, [customer, period]);

  // ─── Actions ───────────────────────────────────────────────────────────────
  const handleAcceptRecommendation = useCallback(async (rec: Recommendation) => {
    updateEngine(items => acceptRecommendation(items, rec, customer, period));
    // Auch an API melden
    try {
      await api.saveTracker({ customer_id: customer, period, action_key: rec.action_key, is_realization: true, target_ebit_eur: rec.potenzial });
    } catch (e) { console.error(e); }
  }, [customer, period, updateEngine]);

  const handleTogglePool = useCallback(async (action: any) => {
    const key = action.action_key || action.contract_id || '';
    const exists = items.some(i => i.action_key === key);
    if (exists) {
      updateEngine(items => removeEngineItem(items, key));
    } else {
      updateEngine(items => addFromPool(items, action, customer, period));
      try {
        await api.saveTracker({ customer_id: customer, period, action_key: key, is_realization: true, target_ebit_eur: Number(action.impact_eur ?? action.ebit_potential_eur ?? 0) });
      } catch (e) { console.error(e); }
    }
  }, [items, customer, period, updateEngine]);

  const handleUpdateStatus = useCallback((key: string, updates: Partial<Pick<MassnahmeItem, 'status' | 'realization' | 'note'>>) => {
    updateEngine(items => updateItemStatus(items, key, updates));
  }, [updateEngine]);

  const handleRemove = useCallback((key: string) => {
    updateEngine(items => removeEngineItem(items, key));
  }, [updateEngine]);

  // ─── UI State ──────────────────────────────────────────────────────────────
  const [ebitTab, setEbitTab] = useState<EbitTab>('top');
  const [poolTab, setPoolTab] = useState<PoolTab>('alle');
  const [trackerTab, setTrackerTab] = useState<TrackerTab>('aktiv');
  const [dismissedRecs, setDismissedRecs] = useState<Set<string>>(new Set());

  const getImpact = (a: any) => Number(a.impact_eur ?? a.ebit_potential_eur ?? a.ebit_potential ?? 0);
  const sortedActions = useMemo(() => [...actions].sort((a, b) => getImpact(b) - getImpact(a)), [actions]);
  const TOP_N = Math.min(5, sortedActions.length);
  const topActions = sortedActions.slice(0, TOP_N);
  const sonstigeActions = sortedActions.slice(TOP_N);
  const totalEbitPotential = sortedActions.reduce((s, a) => s + getImpact(a), 0);
  const ebitActions = ebitTab === 'top' ? topActions : sonstigeActions;

  // Pool-Logik (bestehend)
  const selectedKeys = useMemo(() => new Set(items.map(i => i.action_key)), [items]);

  // Liquiditätshebel — MUSS vor liqPoolActions deklariert werden
  const [liqLeversArchived, setLiqLeversArchived] = useState<Record<string, boolean>>({});
  const liqLevers = useMemo(() => {
    const base = totalEbitPotential > 0 ? totalEbitPotential : 10000;
    return [
      { title: 'Cashflow planbar machen', impact: Math.round(base * 0.008), biggest: false, items: ['Top-10 Kunden Rhythmus geben', 'Wartungsverträge voraus abrechnen', '13-Wochen-Cashflow-Forecast führen'] },
      { title: 'Working Capital freisetzen', impact: Math.round(base * 0.455), biggest: false, items: ['Forderungen sofort einziehen', '50% Anzahlung bei Neuaufträgen', 'Zahlungsziel auf 14 Tage'] },
      { title: 'Margenschwache Verträge korrigieren', impact: Math.round(base * 0.46), biggest: true, items: ['Verlustverträge kündigen / nachverhandeln', 'Stundensätze +8–12% erhöhen', 'Materialquote <35% durchsetzen'] },
      { title: 'Zahlungsströme synchronisieren', impact: Math.round(base * 0.077), biggest: false, items: ['Zahltermine 1./15. durchsetzen', 'Lieferantenzahlungen bündeln', 'Reserve 3 Monate aufbauen'] },
    ];
  }, [totalEbitPotential]);
  const totalLiqImpact = liqLevers.reduce((s, l) => s + l.impact, 0);

  // ─── Engine initialisieren (nach benchmarks + liqLevers verfügbar) ────────
  const monthlyRevenue = Number((data as any)?.wirkung?.revenue ?? (data as any)?.overview?.revenue ?? 0);

  const benchmarkPoolActions = useMemo(() =>
    benchmarks.map((b: any, i: number) => {
      const cur = Number(b.current ?? 0);
      const tMin = Number(b.target_min ?? 0);
      const tMid = Number(b.target_mid ?? 0);
      const lbl = (b.kpi_label || '').toLowerCase();
      const lowerIsBetter = lbl.includes('personal') || lbl.includes('lohn') || lbl.includes('pkq');
      const gapToMid = lowerIsBetter ? cur - tMid : tMid - cur;
      const hasGap = cur > 0 && gapToMid > 0;
      const eurImpact = hasGap ? estimateBenchmarkEurImpact(b.kpi_label, cur, tMid, monthlyRevenue) : 0;
      return {
        action_key: `bench_${i}`, action_label: b.kpi_label || `Benchmark ${i + 1}`,
        contract_name: b.kpi_label, category: 'Benchmark-Maßnahme',
        impact_eur: eurImpact, ebit_potential_eur: eurImpact,
        isBenchmark: true, belowTarget: hasGap,
      };
    }), [benchmarks, monthlyRevenue]);

  const benchmarkInputs: BenchmarkInput[] = useMemo(() =>
    benchmarks.map((b: any) => ({
      kpi_label: b.kpi_label || '',
      current: Number(b.current ?? 0),
      target_min: Number(b.target_min ?? 0),
      target_mid: Number(b.target_mid ?? 0),
      target_max: Number(b.target_max ?? 0),
      isProxy: !!b.isProxy,
    })), [benchmarks]);

  const liqLeverInputs: LiquidityLeverInput[] = useMemo(() =>
    liqLevers.map(l => ({ title: l.title, impact: l.impact, biggest: l.biggest, items: l.items })),
    [liqLevers]);

  // Re-run engine wenn sich Daten ändern
  useEffect(() => {
    setEngineState(runEngine(customer, period, actions, benchmarkInputs, liqLeverInputs, monthlyRevenue));
  }, [customer, period, actions, benchmarkInputs, liqLeverInputs, monthlyRevenue]);

  // Liquiditätshebel als Pool-Items
  const liqPoolActions = useMemo(() =>
    liqLevers.map((lever, i) => ({
      action_key: `liq_${i}`,
      action_label: lever.title,
      contract_name: lever.title,
      category: lever.items.join(' · '),
      impact_eur: lever.impact,
      ebit_potential_eur: lever.impact,
      isLiquidity: true,
      isBiggest: lever.biggest,
    })), [liqLevers]);

  const archivedLiqCount = Object.values(liqLeversArchived).filter(v => v).length;

  const poolActions = useMemo(() => {
    let acts: any[] = [];
    if (poolTab === 'benchmarks') acts = benchmarkPoolActions;
    else if (poolTab === 'vertraege') acts = sortedActions.slice(0, TOP_N);
    else if (poolTab === 'liquiditaet') acts = liqPoolActions;
    else acts = [...sortedActions, ...benchmarkPoolActions, ...liqPoolActions].sort((a, b) => getImpact(b) - getImpact(a));
    return acts;
  }, [sortedActions, benchmarkPoolActions, liqPoolActions, poolTab, TOP_N]);

  // Visible recommendations (excluding dismissed ones)
  const visibleRecs = useMemo(() =>
    recommendations.filter(r => !dismissedRecs.has(r.action_key) && !selectedKeys.has(r.action_key)),
    [recommendations, dismissedRecs, selectedKeys]);

  const displayItems = trackerTab === 'aktiv' ? activeItems : doneItems;

  const getEbitBadge = (action: any, rank: number) => {
    const m = Number(action.margin_pct ?? 0);
    if (m < 0 || Number(action.profit ?? 0) < 0) return { text: 'Kritisch', color: '#E53935', bg: '#FFEBEE' };
    if (rank <= 2) return { text: 'Handlungsbedarf', color: '#E53935', bg: '#FFEBEE' };
    return { text: 'Optimieren', color: '#E65100', bg: '#FFF8E1' };
  };

  const tabBtn = (active: boolean) => active
    ? { background: '#C8A96E', color: '#fff' }
    : { background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border-color)' };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Maßnahmen</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Steuerungs-Cockpit — Optimierungspotenziale erkennen, priorisieren und umsetzen</p>
        <div className="copper-line" />
      </div>

      {/* ─── 1. STEUERUNGS-KPIs (ERWEITERT) ──────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <span style={DOT} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)', letterSpacing: '1.2px' }}>STEUERUNGS-COCKPIT</span>
        </div>
        <div style={COPPER_LINE} />
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {[
            { label: 'AKTIV', value: String(kpis.active_count), color: 'var(--text-primary)', sub: `${kpis.carry_over_count} Carry-Over` },
            { label: 'UMGESETZT', value: String(kpis.done_count), color: '#2E8B57', sub: '' },
            { label: 'PIPELINE OFFEN', value: fmtEur(kpis.open_pipeline), color: '#E65100', sub: 'Offenes Potenzial' },
            { label: 'REALISIERT', value: fmtEur(kpis.realized_ebit), color: kpis.realized_ebit > 0 ? '#2E8B57' : '#E65100', sub: 'Realisierter EBIT' },
            { label: 'POTENZIAL TOTAL', value: fmtEur(kpis.total_potenzial), color: 'var(--text-primary)', sub: 'Alle Maßnahmen' },
            { label: 'CAPTURE RATE', value: `${kpis.capture_rate.toFixed(0)}%`, color: kpis.capture_rate >= 50 ? '#2E8B57' : '#E65100', sub: 'Realisierung %' },
            { label: 'NEU DIESEN MONAT', value: String(kpis.new_this_month), color: '#1565C0', sub: `von ${allCurrentItems.length} gesamt` },
          ].map((kpi, i) => (
            <div key={i} className="rounded-xl p-3 text-center" style={{ background: 'var(--background, #F7F5F2)', border: '1px solid var(--border-color)' }}>
              <div className="text-xl font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
              <div className="text-xs mt-0.5 uppercase tracking-wide font-semibold" style={{ color: 'var(--text-secondary)' }}>{kpi.label}</div>
              {kpi.sub && <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>{kpi.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ─── 2. BENCHMARKVERGLEICH ────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-1">
          <span style={DOT} />
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)', letterSpacing: '1.2px' }}>BENCHMARKVERGLEICH</h3>
          {rawBenchmarks.length === 0 && (
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: '#FFF8E1', color: '#E65100' }}>Branchenzielwerte</span>
          )}
        </div>
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
          {rawBenchmarks.length > 0 ? 'Branchenvergleich der wichtigsten Kennzahlen' : 'Zielwerte — Istwerte werden nach Datenpflege angezeigt'}
        </p>
        <div style={COPPER_LINE} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {benchmarks.map((b: any, i: number) => (
            <BenchmarkGauge key={i} isProxy={!!b.isProxy} label={b.kpi_label || `KPI ${i + 1}`}
              current={Number(b.current ?? 0)} targetMin={Number(b.target_min ?? 0)} targetMid={Number(b.target_mid ?? 0)} targetMax={Number(b.target_max ?? 0)} monthlyRevenue={monthlyRevenue} />
          ))}
        </div>
      </div>

      {/* ─── 3. LIQUIDITÄTSHEBEL ──────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span style={DOT} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)', letterSpacing: '1.2px' }}>LIQUIDITÄTSHEBEL</span>
          </div>
          {totalLiqImpact > 0 && (
            <div className="text-right">
              <div className="text-lg font-bold" style={{ color: '#2E8B57' }}>+{fmtEur(totalLiqImpact)}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>LIQUIDITÄTSEFFEKT P.M.</div>
            </div>
          )}
        </div>
        <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Operative Hebel zur kurzfristigen Liquiditätsverbesserung</p>
        <div style={COPPER_LINE} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {liqLevers.map((lever, i) => {
            const leverKey = `liq_${i}`;
            if (!!liqLeversArchived[leverKey]) return null;
            return (
              <div key={i} className="p-4 rounded-xl relative" style={{ border: lever.biggest ? '2px solid #C8A96E' : '1px solid var(--border-color)', background: '#fff', paddingTop: lever.biggest ? '1.5rem' : '1rem' }}>
                {lever.biggest && <span className="absolute text-xs font-bold rounded px-2 py-0.5" style={{ top: -11, left: 16, background: '#C8A96E', color: '#fff' }}>GRÖSSTER HEBEL</span>}
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold text-sm pr-3 flex-1" style={{ color: 'var(--text-primary)' }}>{lever.title}</div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="font-bold text-sm" style={{ color: '#2E8B57' }}>+{fmtEur(lever.impact)}</div>
                    <button onClick={() => setLiqLeversArchived(prev => ({ ...prev, [leverKey]: true }))} className="text-xs px-2 py-1 rounded text-gray-500 hover:text-gray-700 transition-colors">✓</button>
                  </div>
                </div>
                <ul className="space-y-1">
                  {lever.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: '#C8A96E', flexShrink: 0 }}>✓</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 4. EBIT-HEBEL ────────────────────────────────────────────────── */}
      {sortedActions.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span style={DOT} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)', letterSpacing: '1.2px' }}>EBIT-HEBEL</span>
            </div>
            {totalEbitPotential > 0 && (
              <div className="text-right">
                <div className="text-lg font-bold" style={{ color: '#2E8B57' }}>+{fmtEur(totalEbitPotential)}</div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>EBIT p.M.</div>
              </div>
            )}
          </div>
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Top-Maßnahmen nach EBIT-Potenzial</p>
          <div style={COPPER_LINE} />
          <div className="flex gap-2 mb-4">
            {([['top', 'Top Hebel', topActions.length], ['sonstige', 'Sonstige', sonstigeActions.length]] as [EbitTab, string, number][]).filter(([,, n]) => n > 0).map(([key, lbl, cnt]) => (
              <button key={key} onClick={() => setEbitTab(key)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all" style={tabBtn(ebitTab === key)}>
                {lbl} <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-xs" style={{ background: ebitTab === key ? 'rgba(255,255,255,0.3)' : 'var(--border-color)' }}>{cnt}</span>
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {ebitActions.map((action: any, idx: number) => {
              const rank = ebitTab === 'top' ? idx + 1 : TOP_N + idx + 1;
              const impact = getImpact(action);
              const badge = getEbitBadge(action, rank);
              return (
                <div key={action.action_key || idx} className="p-3.5 rounded-xl" style={{ border: '1px solid var(--border-color)', background: '#fff' }}>
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: '#C8A96E', color: '#fff' }}>{rank}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{action.action_label || action.contract_name || `Maßnahme ${rank}`}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Marge: {fmtPct(action.margin_pct)} · Wirkung: 1–3 Monate</div>
                    </div>
                    <div className="flex-shrink-0 text-right flex flex-col items-end gap-1">
                      <div className="font-bold text-sm" style={{ color: '#2E8B57' }}>+{fmtEur(impact)}</div>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: badge.bg, color: badge.color }}>{badge.text}</span>
                    </div>
                  </div>
                  <div className="mt-2 ml-11 text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(200,169,110,0.08)', color: 'var(--text-secondary)', borderLeft: '3px solid #C8A96E' }}>
                    → {getMassnahmeText(action, rank)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 5. EMPFOHLENE MAẞNAHMEN (nach EBIT-Hebel) ────────────────── */}
      {visibleRecs.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid #C8A96E' }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span style={{ ...DOT, background: '#C8A96E', width: 10, height: 10 }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)', letterSpacing: '1.2px' }}>EMPFOHLENE MAẞNAHMEN</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#FFF3E0', color: '#E65100' }}>
                {visibleRecs.length} Vorschläge
              </span>
            </div>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Verträge · Benchmarks · Liquidität
            </span>
          </div>
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
            Das System hat die folgenden Maßnahmen als besonders wirkungsvoll identifiziert
          </p>
          <div style={COPPER_LINE} />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleRecs.map((rec) => {
              const catBadge = rec.category === 'BENCHMARK'
                ? { bg: '#E8F5E9', color: '#2E7D32', text: 'BM' }
                : rec.category === 'LIQUIDITAET'
                ? { bg: '#E3F2FD', color: '#1565C0', text: 'LIQ' }
                : { bg: '#FFF3E0', color: '#E65100', text: 'VTR' };
              return (
                <div key={rec.action_key} className="p-4 rounded-xl" style={{ border: '1.5px solid rgba(200,169,110,0.4)', background: 'linear-gradient(135deg, rgba(200,169,110,0.04) 0%, rgba(255,255,255,1) 100%)' }}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <UrgencyBadge urgency={rec.urgency} />
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: catBadge.bg, color: catBadge.color }}>{catBadge.text}</span>
                    </div>
                    {rec.potenzial > 0 && (
                      <span className="font-bold text-sm" style={{ color: '#2E8B57' }}>+{fmtEur(rec.potenzial)}</span>
                    )}
                  </div>
                  <div className="font-bold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{rec.label}</div>
                  <div className="text-xs mb-3" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{rec.reason}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptRecommendation(rec)}
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all"
                      style={{ background: '#C8A96E', color: '#fff', border: 'none', cursor: 'pointer' }}
                    >
                      Übernehmen
                    </button>
                    <button
                      onClick={() => setDismissedRecs(prev => { const n = new Set(Array.from(prev)); n.add(rec.action_key); return n; })}
                      className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                      style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                    >
                      Später
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 6. MAẞNAHMENPOOL (bestehend, mit Engine-Integration) ─────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span style={DOT} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)', letterSpacing: '1.2px' }}>MAẞNAHMENPOOL</span>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--border-color)', color: 'var(--text-secondary)' }}>{sortedActions.length + benchmarkPoolActions.length + liqPoolActions.length} verfügbar</span>
        </div>
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>Maßnahmen auswählen und in den Tracker übernehmen</p>
        <div className="flex gap-2 mb-4 flex-wrap">
          {([
            ['alle', `Alle ${sortedActions.length + benchmarkPoolActions.length + liqPoolActions.length}`],
            ['vertraege', `Verträge ${Math.min(TOP_N, sortedActions.length)}`],
            ['benchmarks', `Benchmarks ${benchmarkPoolActions.length}`],
            ['liquiditaet', `Liquidität ${liqPoolActions.length}`],
          ] as [PoolTab, string][]).map(([key, lbl]) => (
            <button key={key} onClick={() => setPoolTab(key)} className="px-3 py-1.5 rounded-full text-xs font-bold transition-all" style={tabBtn(poolTab === key)}>{lbl}</button>
          ))}
        </div>
        <div className="space-y-2">
          {poolActions.map((action: any, idx: number) => {
            const key = action.action_key || action.contract_id || `a${idx}`;
            const selected = selectedKeys.has(key);
            const impact = getImpact(action);
            const isTop = !action.isBenchmark && !action.isLiquidity && sortedActions.indexOf(action) < TOP_N;
            const isBench = !!action.isBenchmark;
            const isLiq = !!action.isLiquidity;
            // Badge styling per type
            const badgeStyle = isLiq
              ? { background: '#E3F2FD', color: '#1565C0' }
              : isBench
              ? { background: '#E8F5E9', color: '#2E7D32' }
              : { background: '#FFF3E0', color: '#E65100' };
            const badgeText = isLiq ? 'LIQ' : isBench ? 'BM' : 'VTR';

            return (
              <div key={key} onClick={() => handleTogglePool(action)} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all" style={{ border: `1px solid ${selected ? '#C8A96E' : action.isBiggest ? '#C8A96E' : 'var(--border-color)'}`, background: selected ? 'rgba(200,169,110,0.05)' : '#fff' }}>
                <div className="flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all" style={{ borderColor: selected ? '#C8A96E' : '#ccc', background: selected ? '#C8A96E' : '#fff' }}>
                  {selected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>✓</span>}
                </div>
                <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-bold" style={badgeStyle}>
                  {badgeText}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    {action.action_label || action.contract_name || `Maßnahme ${idx + 1}`}
                    {action.isBiggest && <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: '#C8A96E', color: '#fff', fontSize: '0.6rem' }}>GRÖSSTER HEBEL</span>}
                  </div>
                  {action.category && <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{action.category}</div>}
                </div>
                <div className="flex-shrink-0 text-right flex flex-col items-end gap-1">
                  {isBench ? (
                    <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: '#E8F5E9', color: '#2E7D32' }}>BENCHMARK</span>
                  ) : isLiq ? (
                    <>
                      <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: '#E3F2FD', color: '#1565C0' }}>LIQUIDITÄT</span>
                      {impact > 0 && <div className="text-xs font-bold" style={{ color: '#1565C0' }}>+{fmtEur(impact)}/M</div>}
                    </>
                  ) : (
                    <>
                      <span className="px-2 py-0.5 rounded text-xs font-bold" style={isTop ? { background: '#FFF8E1', color: '#E65100' } : { background: '#E8F5E9', color: '#2E7D32' }}>{isTop ? 'TOP HEBEL' : 'ZUSATZ'}</span>
                      <div className="text-xs font-bold" style={{ color: '#2E8B57' }}>+{fmtEur(impact)}</div>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Archiv für erledigte Liquiditätshebel (nur im Liquiditäts-Tab sichtbar) */}
          {poolTab === 'liquiditaet' && archivedLiqCount > 0 && (
            <details className="mt-4">
              <summary className="text-xs font-semibold cursor-pointer px-3 py-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.03)', color: 'var(--text-secondary)' }}>
                Archiv — {archivedLiqCount} erledigte Liquiditätshebel
              </summary>
              <div className="mt-2 space-y-2">
                {liqLevers.map((lever, i) => {
                  const leverKey = `liq_${i}`;
                  if (!liqLeversArchived[leverKey]) return null;
                  return (
                    <div key={leverKey} className="flex items-center gap-3 p-3 rounded-xl" style={{ border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.02)', opacity: 0.7 }}>
                      <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: '#E3F2FD', color: '#1565C0' }}>LIQ</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm line-through" style={{ color: 'var(--text-secondary)' }}>{lever.title}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{lever.items.join(' · ')}</div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setLiqLeversArchived(prev => ({ ...prev, [leverKey]: false })); }}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                        style={{ background: 'rgba(21,101,192,0.1)', color: '#1565C0', border: '1px solid rgba(21,101,192,0.2)' }}
                      >
                        Wiederherstellen
                      </button>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* ─── 6. REALISIERUNGSTRACKER (erweitert mit Engine) ───────────── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <span style={DOT} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)', letterSpacing: '1.2px' }}>REALISIERUNGSTRACKER</span>
          {kpis.carry_over_count > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#E3F2FD', color: '#1565C0' }}>
              {kpis.carry_over_count} Carry-Over
            </span>
          )}
        </div>

        <div className="flex gap-2 mb-4">
          {([
            ['aktiv', `Aktiv ${activeItems.length}`],
            ['umgesetzt', `Umgesetzt ${doneItems.length}`],
          ] as [TrackerTab, string][]).map(([key, lbl]) => (
            <button key={key} onClick={() => setTrackerTab(key)} className="px-3 py-1.5 rounded-full text-xs font-bold transition-all" style={tabBtn(trackerTab === key)}>{lbl}</button>
          ))}
        </div>

        {displayItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                  <th className="text-left pb-2 font-semibold pr-3 whitespace-nowrap">PRIO</th>
                  <th className="text-left pb-2 font-semibold">MAẞNAHME</th>
                  <th className="text-left pb-2 font-semibold px-3 whitespace-nowrap">STATUS</th>
                  <th className="text-right pb-2 font-semibold px-3 whitespace-nowrap">POTENZIAL</th>
                  <th className="text-left pb-2 font-semibold px-3 whitespace-nowrap">FORTSCHRITT</th>
                  <th className="text-right pb-2 font-semibold px-3 whitespace-nowrap">EBIT REALISIERT</th>
                  <th className="text-left pb-2 font-semibold px-3">NOTIZ</th>
                  <th className="pb-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item, idx) => {
                  const realized = item.potenzial * item.realization / 100;
                  const isAutoCompleteCandidate = autoCompleteKeys.includes(item.action_key);
                  return (
                    <tr key={item.action_key} style={{ borderTop: '1px solid var(--border-color)', background: isAutoCompleteCandidate ? 'rgba(16,185,129,0.04)' : undefined }}>
                      <td className="py-3 pr-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: idx < 3 ? '#C8A96E' : 'var(--border-color)', color: idx < 3 ? '#fff' : 'var(--text-secondary)' }}>
                            {idx + 1}
                          </div>
                          {item.carry_over_count > 0 && (
                            <span className="text-xs font-bold" style={{ color: '#1565C0' }} title={`Carry-Over seit ${item.carry_over_count} Monat(en)`}>
                              +{item.carry_over_count}M
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                          {item.label}
                          {item.is_recommendation && (
                            <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded" style={{ background: '#FFF3E0', color: '#E65100', verticalAlign: 'middle' }}>AI</span>
                          )}
                        </div>
                        {item.description && <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item.description}</div>}
                        {item.margin_pct != null && (
                          <div className="text-xs mt-0.5" style={{ color: item.margin_pct < 0.05 ? '#E53935' : 'var(--text-secondary)' }}>
                            Marge: {fmtPct(item.margin_pct)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {trackerTab === 'aktiv' ? (
                          <select
                            value={item.status}
                            onChange={e => handleUpdateStatus(item.action_key, { status: e.target.value as MassnahmeStatus })}
                            className="text-xs rounded-lg px-2 py-1.5 border"
                            style={{ background: '#fff', color: 'var(--text-primary)', borderColor: 'var(--border-color)', cursor: 'pointer' }}
                          >
                            <option value="OPEN">Offen</option>
                            <option value="IN_PROGRESS">In Arbeit</option>
                            <option value="DONE">Umgesetzt</option>
                          </select>
                        ) : (
                          <StatusBadge status={item.status} carryOver={item.carry_over_count} />
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="font-bold text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{fmtEur(item.potenzial)}</div>
                      </td>
                      <td className="py-3 px-3" style={{ minWidth: 160 }}>
                        <div className="flex items-center gap-2">
                          {trackerTab === 'aktiv' ? (
                            <input type="range" min={0} max={100} step={5} value={item.realization}
                              onChange={e => handleUpdateStatus(item.action_key, { realization: Number(e.target.value) })}
                              className="flex-1" style={{ accentColor: item.realization >= 80 ? '#2E8B57' : item.realization >= 40 ? '#C8A96E' : '#999', height: 6 }} />
                          ) : (
                            <div className="flex-1 relative h-2.5 rounded-full" style={{ backgroundColor: '#F0EDE8' }}>
                              <div className="absolute h-2.5 rounded-full transition-all" style={{ width: `${item.realization}%`, background: item.realization >= 80 ? '#2E8B57' : item.realization >= 40 ? '#E8A76A' : '#E0E0E0' }} />
                            </div>
                          )}
                          <span className="text-sm font-bold w-10 text-right" style={{ color: item.realization >= 80 ? '#2E8B57' : item.realization >= 40 ? '#E65100' : 'var(--text-secondary)' }}>
                            {item.realization}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-sm whitespace-nowrap" style={{ color: realized > 0 ? '#2E8B57' : 'var(--text-secondary)' }}>
                        {realized > 0 ? fmtEur(realized) : '–'}
                      </td>
                      <td className="py-3 px-3">
                        <input type="text" value={item.note} onChange={e => handleUpdateStatus(item.action_key, { note: e.target.value })} placeholder="–"
                          className="text-xs border rounded px-2 py-1" style={{ width: 80, borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: '#fff' }} />
                      </td>
                      <td className="py-3 pl-1">
                        <button onClick={() => handleRemove(item.action_key)} title="Entfernen" className="w-6 h-6 flex items-center justify-center rounded-full transition-all hover:bg-red-50" style={{ color: '#E53935', fontSize: 16, fontWeight: 700 }}>×</button>
                      </td>
                    </tr>
                  );
                })}
                {trackerTab === 'aktiv' && activeItems.length > 0 && (
                  <tr style={{ borderTop: '2px solid var(--border-color)', background: 'rgba(200,169,110,0.04)' }}>
                    <td className="py-3" />
                    <td className="py-3 font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Gesamt EBIT-Wirkung</td>
                    <td className="py-3 px-3" />
                    <td className="py-3 px-3 text-right font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{fmtEur(activeItems.reduce((s, t) => s + t.potenzial, 0))}</td>
                    <td className="py-3 px-3 text-center text-sm font-semibold" style={{ color: '#C8A96E' }}>Ø {kpis.capture_rate.toFixed(0)}%</td>
                    <td className="py-3 px-3 text-right font-bold text-sm" style={{ color: kpis.realized_ebit > 0 ? '#2E8B57' : '#E65100' }}>{fmtEur(kpis.realized_ebit)}</td>
                    <td className="py-3 px-3" /><td className="py-3" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 rounded-xl" style={{ background: 'var(--background, #F7F5F2)', border: '1px dashed var(--border-color)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {trackerTab === 'aktiv'
                ? 'Noch keine aktiven Maßnahmen — Empfehlungen übernehmen oder aus dem Pool auswählen.'
                : 'Noch keine umgesetzten Maßnahmen. Status auf "Umgesetzt" setzen.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
