'use client';

import { useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { getTargetsForCustomer } from '@/lib/config';

interface Props {
  data: any;
  customer: string;
  period: string;
}

const fmtEur = (n: any) =>
  n != null ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n)) : '–';

const fmtPct = (n: any) =>
  n != null ? `${(Number(n) * 100).toFixed(1)} %` : '–';

// Fallback-Benchmarks falls API keine Daten liefert
const FALLBACK_BENCHMARKS = [
  { kpi_label: 'Produktivität', current: 0, target_min: 0.70, target_mid: 0.80, target_max: 0.90 },
  { kpi_label: 'Stundensatz (€)', current: 0, target_min: 95, target_mid: 105, target_max: 120 },
  { kpi_label: 'Personalkostenquote', current: 0, target_min: 0.40, target_mid: 0.45, target_max: 0.55 },
];

function BenchmarkGauge({ label, current, targetMin, targetMid, targetMax, isProxy }: {
  label: string; current: number; targetMin: number; targetMid: number; targetMax: number; isProxy?: boolean;
}) {
  const hasValue = current > 0;
  const isAbsScale = targetMax > 10; // Stundensatz/Preis = absolute Werte, keine 0-100 Skala
  const inTarget = hasValue && current >= targetMin && current <= targetMax;
  const belowTarget = hasValue && current < targetMin;

  // Für %-KPIs: Skala 0-100 (zeige % als Score). Für €-KPIs: absolute Skala
  let score = 0;
  let scoreLabel = '–';
  if (hasValue) {
    if (isAbsScale) {
      // Absolute Werte (z.B. Stundensatz): direkt anzeigen
      score = current;
      scoreLabel = `${Math.round(current)} €`;
    } else {
      // Prozent-KPIs (Marge, Produktivität, PKQ): als 0-100 Score
      score = Math.round(current * 100);
      scoreLabel = `${score} / 100`;
    }
  }

  // Zielbereich auf gleicher Skala
  const scMin = isAbsScale ? targetMin : Math.round(targetMin * 100);
  const scMid = isAbsScale ? targetMid : Math.round(targetMid * 100);
  const scMax = isAbsScale ? targetMax : Math.round(targetMax * 100);
  const scCur = isAbsScale ? current : Math.round(current * 100);

  // Gauge-Balken: Position relativ zur Skala
  const scaleMax = isAbsScale ? Math.max(targetMax * 1.25, current * 1.1) : 100;
  const pctCurrent = hasValue ? Math.min((scCur / scaleMax) * 100, 100) : 0;
  const pctMin = (scMin / scaleMax) * 100;
  const pctMax = Math.min((scMax / scaleMax) * 100, 100);
  const pctMid = (scMid / scaleMax) * 100;

  // Farblogik
  let barColor = '#ccc';
  let statusText = 'Keine Daten';
  let statusBg = '#F5F5F5';
  let statusColor = '#999';
  if (hasValue) {
    if (inTarget) {
      barColor = '#2E8B57'; statusText = '✓ Im Ziel'; statusBg = '#E8F5E9'; statusColor = '#2E7D32';
    } else if (belowTarget) {
      const gap = (targetMin - current) / targetMin;
      if (gap > 0.2) { barColor = '#C43830'; statusText = 'Kritisch'; statusBg = '#FFEBEE'; statusColor = '#C43830'; }
      else { barColor = '#E8A76A'; statusText = 'Optimierbar'; statusBg = '#FFF8E1'; statusColor = '#E65100'; }
    } else {
      barColor = '#1B5E20'; statusText = '★ Übertrifft'; statusBg = '#E8F5E9'; statusColor = '#1B5E20';
    }
  }

  // Erklärtext für den Kontext
  const lbl = (label || '').toLowerCase();
  let explanation = '';
  if (lbl.includes('produktiv')) explanation = hasValue ? `${score}% der Kapazität werden produktiv genutzt` : 'Anteil produktiv genutzter Arbeitsstunden';
  else if (lbl.includes('stundensatz') || lbl.includes('preis')) explanation = hasValue ? `Durchschnittlicher Verrechnungssatz` : 'Durchschnittlicher Verrechnungssatz je Stunde';
  else if (lbl.includes('personal') || lbl.includes('lohn')) explanation = hasValue ? `${score}% des Umsatzes gehen in Personalkosten` : 'Personalkostenanteil am Umsatz';

  return (
    <div className="card">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{label}</div>
          <div className="text-xl font-bold mt-0.5" style={{ color: hasValue ? barColor : 'var(--text-secondary)' }}>
            {scoreLabel}
          </div>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: statusBg, color: statusColor }}>
          {statusText}
        </span>
      </div>

      {explanation && (
        <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{explanation}</div>
      )}

      {/* Gauge-Balken */}
      <div className="relative h-4 rounded-full" style={{ backgroundColor: '#F0EDE8' }}>
        {/* Zielkorridor (grüner Hintergrund) */}
        <div className="absolute h-4 rounded" style={{
          left: `${pctMin}%`,
          width: `${Math.max(0, pctMax - pctMin)}%`,
          backgroundColor: 'rgba(46,139,87,0.15)',
          borderLeft: '2px solid rgba(46,139,87,0.4)',
          borderRight: '2px solid rgba(46,139,87,0.4)',
        }} />
        {/* Ist-Wert Balken */}
        {hasValue && (
          <div className="absolute h-4 rounded-full transition-all" style={{
            width: `${pctCurrent}%`,
            backgroundColor: barColor,
            opacity: 0.85,
          }} />
        )}
        {/* Zielwert-Nadel */}
        <div className="absolute top-0 h-4" style={{
          left: `${pctMid}%`,
          width: 2,
          backgroundColor: '#333',
          borderRadius: 1,
        }} />
      </div>

      {/* Legende unter dem Balken */}
      <div className="flex justify-between text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
        <span>{isAbsScale ? '0 €' : '0'}</span>
        <span style={{ color: '#2E8B57', fontWeight: 600 }}>Ziel: {isAbsScale ? `${Math.round(scMid)} €` : scMid}</span>
        <span>{isAbsScale ? `${Math.round(scaleMax)} €` : '100'}</span>
      </div>

      {/* Keine Daten */}
      {!hasValue && (
        <div className="text-xs mt-1 text-center" style={{ color: 'var(--text-secondary)' }}>
          Istwert wird nach Datenpflege angezeigt
        </div>
      )}

      {/* Konkrete Maßnahme wenn unter Ziel oder knapp im Ziel */}
      {hasValue && belowTarget && (
        <div className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(196,56,48,0.06)', borderLeft: '3px solid #C43830', color: 'var(--text-secondary)' }}>
          → {getBenchmarkMassnahme(label, scCur, scMin, scMid, isAbsScale)}
        </div>
      )}
      {hasValue && inTarget && scCur < scMid && (
        <div className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(232,167,106,0.08)', borderLeft: '3px solid #E8A76A', color: 'var(--text-secondary)' }}>
          → {getBenchmarkMassnahme(label, scCur, scMin, scMid, isAbsScale)}
        </div>
      )}
    </div>
  );
}

/** Konkrete Maßnahmen pro Benchmark-KPI */
function getBenchmarkMassnahme(label: string, current: number, min: number, mid: number, isAbsScale: boolean): string {
  const lbl = (label || '').toLowerCase();
  const gap = mid - current;

  if (lbl.includes('produktiv')) {
    if (current < min) return `Produktivität ${gap} Punkte unter Ziel: Leerlaufzeiten reduzieren, Einsatzplanung straffen, unproduktive Tätigkeiten (Fahrt, Admin) minimieren`;
    return `Noch ${gap} Punkte bis Zielwert: Schichtübergaben optimieren, Auslastung bei Randzeiten verbessern`;
  }
  if (lbl.includes('stundensatz') || lbl.includes('preis')) {
    const gapEur = Math.round(mid - current);
    if (current < min) return `Stundensatz ${gapEur} € unter Ziel: Preiserhöhung bei nächster Vertragsverlängerung, Zuschläge für Sonderleistungen einführen`;
    return `Noch ${gapEur} € bis Zielwert: Staffelpreise für Zusatzleistungen, Indexklauseln in Neuverträge`;
  }
  if (lbl.includes('personal') || lbl.includes('lohn')) {
    // Bei PKQ ist NIEDRIGER besser — unter Ziel heißt hier: Quote zu HOCH
    if (current > mid) return `PKQ ${current - mid} Punkte über Ziel: Überstunden abbauen, Leiharbeit prüfen, Automatisierung von Routineaufgaben`;
    return `PKQ im Zielbereich, aber optimierbar: Schulungskosten prüfen, Krankenquote senken, Einsatzeffizienz steigern`;
  }
  return `Wert ${gap > 0 ? gap + ' Punkte unter' : 'im'} Zielbereich — Optimierungspotenzial vorhanden`;
}

/** Konkrete Maßnahmen je nach Vertragstyp und Marge */
function getMassnahmeText(action: any, rank: number): string {
  const margin = Number(action.margin_pct ?? 0);
  const name = (action.action_label || action.contract_name || '').toLowerCase();

  if (margin < 0) return 'Vertrag kündigen oder Nachverhandlung mit Preisanpassung +15–20%';
  if (margin < 0.05) return 'Stundensatz um 10–15% erhöhen, Materialzuschlag prüfen, Einsatzplanung optimieren';
  if (margin < 0.08) return 'Einsatzzeiten verdichten, Fahrtkosten reduzieren, Leistungsumfang anpassen';
  if (margin < 0.12) return 'Zusatzleistungen anbieten, Vertragslaufzeit verlängern, Preisindex-Klausel einbauen';
  return 'Vertrag als Referenz nutzen, Konditionen bei Verlängerung halten';
}

type TrackerStatus = 'Offen' | 'In Bearbeitung' | 'Umgesetzt';
type EbitTab = 'top' | 'sonstige';
type PoolTab = 'alle' | 'vertraege' | 'benchmarks';
type TrackerTab = 'aktiv' | 'umgesetzt';

interface TrackerItem {
  key: string;
  label: string;
  description: string;
  potenzial: number;
  month: string;
  status: TrackerStatus;
  realization: number;
  note: string;
  archived: boolean;
}

const DOT = { width: 8, height: 8, borderRadius: '50%', background: '#8B6A40', flexShrink: 0 as const, display: 'inline-block' as const };
const COPPER_LINE = { width: 32, height: 2, background: '#C8A96E', borderRadius: 1, marginBottom: '1rem' };

export default function Page4Massnahmen({ data, customer, period }: Props) {
  const actions: any[] = useMemo(() => (data as any)?.actions || [], [data]);
  const rawBenchmarks: any[] = (data as any)?.benchmarks || [];
  const benchmarks = useMemo(() => {
    const base = rawBenchmarks.length > 0 ? rawBenchmarks : FALLBACK_BENCHMARKS;
    if (base.some((b: any) => Number(b.current ?? 0) > 0)) return base;
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
  }, [rawBenchmarks, data]);
  const trackerData: any[] = (data as any)?.tracker || [];

  const [ebitTab, setEbitTab] = useState<EbitTab>('top');
  const [poolTab, setPoolTab] = useState<PoolTab>('alle');
  const [trackerTab, setTrackerTab] = useState<TrackerTab>('aktiv');
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [poolSelected, setPoolSelected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    trackerData.forEach((t: any) => { init[t.action_key || t.contract_id || ''] = true; });
    return init;
  });

  const [trackerItems, setTrackerItems] = useState<TrackerItem[]>(() =>
    trackerData.map((t: any) => ({
      key: t.action_key || t.contract_id || '',
      label: t.action_label || t.contract_name || '',
      description: t.description || t.diagnose || t.category || '',
      potenzial: Number(t.target_ebit_eur || t.ebit_potential_eur || 0),
      month: t.month_label || t.month_id || period,
      status: 'Offen' as TrackerStatus,
      realization: 0,
      note: '',
      archived: false,
    }))
  );

  // Liquiditätshebel-Status (archived items = completed)
  const [liqLeversArchived, setLiqLeversArchived] = useState<Record<string, boolean>>({});

  const getImpact = (a: any) => Number(a.impact_eur ?? a.ebit_potential_eur ?? a.ebit_potential ?? 0);

  const sortedActions = useMemo(() =>
    [...actions].sort((a, b) => getImpact(b) - getImpact(a)), [actions]);

  const TOP_N = Math.min(5, sortedActions.length);
  const topActions = sortedActions.slice(0, TOP_N);
  const sonstigeActions = sortedActions.slice(TOP_N);
  const totalEbitPotential = sortedActions.reduce((s, a) => s + getImpact(a), 0);
  const ebitActions = ebitTab === 'top' ? topActions : sonstigeActions;

  // Benchmark-Maßnahmen (unter Zielwert → im Pool verfügbar)
  const benchmarkPoolActions = useMemo(() =>
    benchmarks.map((b: any, i: number) => ({
      action_key: `bench_${i}`,
      action_label: b.kpi_label || `Benchmark ${i + 1}`,
      contract_name: b.kpi_label,
      category: 'Benchmark-Maßnahme',
      impact_eur: 0,
      ebit_potential_eur: 0,
      isBenchmark: true,
      belowTarget: Number(b.current ?? 0) > 0 && Number(b.current) < Number(b.target_min ?? b.target_mid ?? 0),
    })), [benchmarks]);

  const poolContractBase = useMemo(() =>
    poolTab === 'vertraege' ? sortedActions.slice(0, TOP_N) : sortedActions,
    [sortedActions, poolTab, TOP_N]);

  const poolActions = useMemo(() => {
    let actions: any[] = [];
    if (poolTab === 'benchmarks') {
      actions = benchmarkPoolActions;
    } else if (poolTab === 'vertraege') {
      actions = poolContractBase;
    } else {
      // 'alle' — combine and sort by EBIT impact descending
      actions = [...poolContractBase, ...benchmarkPoolActions].sort((a, b) => {
        const aImpact = getImpact(a) || 0;
        const bImpact = getImpact(b) || 0;
        return bImpact - aImpact; // Descending
      });
    }
    return actions;
  }, [poolContractBase, benchmarkPoolActions, poolTab]);

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

  const getEbitBadge = (action: any, rank: number) => {
    const m = Number(action.margin_pct ?? 0);
    if (m < 0 || Number(action.profit ?? 0) < 0) return { text: 'Kritisch', color: '#E53935', bg: '#FFEBEE' };
    if (rank <= 2) return { text: 'Handlungsbedarf', color: '#E53935', bg: '#FFEBEE' };
    return { text: 'Optimieren', color: '#E65100', bg: '#FFF8E1' };
  };

  const addToTracker = (action: any) => {
    const key = action.action_key || action.contract_id || '';
    if (trackerItems.some(t => t.key === key)) return;
    setTrackerItems(prev => [...prev, {
      key, label: action.action_label || action.contract_name || '',
      description: action.category || '',
      potenzial: getImpact(action),
      month: period, status: 'Offen', realization: 0, note: '', archived: false,
    }]);
  };

  const togglePool = async (action: any) => {
    const key = action.action_key || action.contract_id || '';
    const wasSelected = !!poolSelected[key];
    setPoolSelected(prev => ({ ...prev, [key]: !wasSelected }));
    if (!wasSelected) {
      addToTracker(action);
      setSavingKey(key);
      try {
        await api.saveTracker({ customer_id: customer, period, action_key: key, is_realization: true, target_ebit_eur: getImpact(action) });
      } catch (e) { console.error(e); }
      finally { setSavingKey(null); }
    } else {
      setTrackerItems(prev => prev.filter(t => t.key !== key));
    }
  };

  // Auto-Archivierung wenn Status auf "Umgesetzt" gesetzt wird
  const updateItem = (key: string, updates: Partial<TrackerItem>) =>
    setTrackerItems(prev => prev.map(t => {
      if (t.key !== key) return t;
      const updated = { ...t, ...updates };
      if (updates.status === 'Umgesetzt') {
        updated.archived = true;
        if (updated.realization < 100) updated.realization = 100;
      }
      return updated;
    }));

  const removeItem = (key: string) => {
    setPoolSelected(prev => ({ ...prev, [key]: false }));
    setTrackerItems(prev => prev.filter(t => t.key !== key));
  };

  const activeItems = trackerItems.filter(t => !t.archived);
  const umgesetztItems = trackerItems.filter(t => t.archived);
  const totalPotenzial = trackerItems.reduce((s, t) => s + t.potenzial, 0);
  const totalRealized = trackerItems.reduce((s, t) => s + (t.potenzial * t.realization / 100), 0);
  const captureRate = totalPotenzial > 0 ? (totalRealized / totalPotenzial) * 100 : 0;
  const displayItems = trackerTab === 'aktiv' ? activeItems : umgesetztItems;

  const tabBtn = (active: boolean) => active
    ? { background: '#C8A96E', color: '#fff' }
    : { background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border-color)' };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Maßnahmen</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Optimierungspotenziale und Umsetzungstracking</p>
        <div className="copper-line" />
      </div>

      {/* 1. BENCHMARKVERGLEICH — immer sichtbar */}
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
            <BenchmarkGauge key={i}
              isProxy={!!b.isProxy}
              label={b.kpi_label || `KPI ${i + 1}`}
              current={Number(b.current ?? 0)}
              targetMin={Number(b.target_min ?? 0)}
              targetMid={Number(b.target_mid ?? 0)}
              targetMax={Number(b.target_max ?? 0)}
            />
          ))}
        </div>
      </div>

      {/* 2. EBIT-HEBEL */}
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
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        Marge: {fmtPct(action.margin_pct)} · Wirkung: 1–3 Monate
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right flex flex-col items-end gap-1">
                      <div className="font-bold text-sm" style={{ color: '#2E8B57' }}>+{fmtEur(impact)}</div>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: badge.bg, color: badge.color }}>{badge.text}</span>
                    </div>
                  </div>
                  {/* Konkrete Maßnahme */}
                  <div className="mt-2 ml-11 text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(200,169,110,0.08)', color: 'var(--text-secondary)', borderLeft: '3px solid #C8A96E' }}>
                    → {getMassnahmeText(action, rank)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. LIQUIDITÄTSHEBEL */}
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

        {/* Active Levers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {liqLevers.map((lever, i) => {
            const leverKey = `liq_${i}`;
            const isArchived = !!liqLeversArchived[leverKey];
            if (isArchived) return null;
            return (
              <div key={i} className="p-4 rounded-xl relative" style={{ border: lever.biggest ? '2px solid #C8A96E' : '1px solid var(--border-color)', background: '#fff', paddingTop: lever.biggest ? '1.5rem' : '1rem' }}>
                {lever.biggest && <span className="absolute text-xs font-bold rounded px-2 py-0.5" style={{ top: -11, left: 16, background: '#C8A96E', color: '#fff' }}>GRÖSSTER HEBEL</span>}
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold text-sm pr-3 flex-1" style={{ color: 'var(--text-primary)' }}>{lever.title}</div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="font-bold text-sm" style={{ color: '#2E8B57' }}>+{fmtEur(lever.impact)}</div>
                    <button onClick={() => setLiqLeversArchived(prev => ({ ...prev, [leverKey]: true }))} className="text-xs px-2 py-1 rounded text-gray-500 hover:text-gray-700 transition-colors">
                      ✓
                    </button>
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

        {/* Archive Section */}
        {Object.values(liqLeversArchived).some(v => v) && (
          <details className="rounded-xl border border-gray-300 bg-gray-50 p-3" style={{ marginTop: '1rem' }}>
            <summary className="text-xs font-bold cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
              📦 Archiv ({Object.values(liqLeversArchived).filter(v => v).length} abgeschlossen)
            </summary>
            <div className="mt-3 space-y-2">
              {liqLevers.map((lever, i) => {
                const leverKey = `liq_${i}`;
                const isArchived = !!liqLeversArchived[leverKey];
                if (!isArchived) return null;
                return (
                  <div key={i} className="p-3 rounded-lg bg-white border border-gray-200 opacity-60">
                    <div className="flex justify-between items-start">
                      <div className="font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>{lever.title}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: '#2E7D32' }}>✓</span>
                        <button onClick={() => setLiqLeversArchived(prev => {
                          const newState = { ...prev };
                          delete newState[leverKey];
                          return newState;
                        })} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                          ↩️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </div>

      {/* 4. MAẞNAHMENPOOL — Verträge + Benchmarks */}
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span style={DOT} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)', letterSpacing: '1.2px' }}>MAẞNAHMENPOOL</span>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--border-color)', color: 'var(--text-secondary)' }}>{sortedActions.length + benchmarkPoolActions.length} verfügbar</span>
        </div>
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>Maßnahmen auswählen und in den Tracker übernehmen</p>
        <div className="flex gap-2 mb-4">
          {([
            ['alle', `Alle ${sortedActions.length + benchmarkPoolActions.length}`],
            ['vertraege', `Verträge ${Math.min(TOP_N, sortedActions.length)}`],
            ['benchmarks', `Benchmarks ${benchmarkPoolActions.length}`],
          ] as [PoolTab, string][]).map(([key, lbl]) => (
            <button key={key} onClick={() => setPoolTab(key)} className="px-3 py-1.5 rounded-full text-xs font-bold transition-all" style={tabBtn(poolTab === key)}>{lbl}</button>
          ))}
        </div>
        <div className="space-y-2">
          {poolActions.length === 0 ? (
            // Fallback: Show all actions if pool is empty (never show empty state)
            sortedActions.map((action: any, idx: number) => {
              const key = action.action_key || action.contract_id || `a${idx}`;
              const selected = !!poolSelected[key];
              const impact = getImpact(action);
              const isTop = idx < TOP_N;
              return (
                <div key={key} onClick={() => !savingKey && togglePool(action)} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all" style={{ border: `1px solid ${selected ? '#C8A96E' : 'var(--border-color)'}`, background: selected ? 'rgba(200,169,110,0.05)' : '#fff' }}>
                  <div className="flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all" style={{ borderColor: selected ? '#C8A96E' : '#ccc', background: selected ? '#C8A96E' : '#fff' }}>
                    {selected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>✓</span>}
                  </div>
                  <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: '#FFF3E0', color: '#E65100' }}>VTR</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{action.action_label || action.contract_name || `Maßnahme ${idx + 1}`}</div>
                    {action.category && <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{action.category}</div>}
                  </div>
                  <div className="flex-shrink-0 text-right flex flex-col items-end gap-1">
                    <span className="px-2 py-0.5 rounded text-xs font-bold" style={isTop ? { background: '#FFF8E1', color: '#E65100' } : { background: '#E8F5E9', color: '#2E7D32' }}>{isTop ? 'TOP HEBEL' : 'ZUSATZ'}</span>
                    <div className="text-xs font-bold" style={{ color: '#2E8B57' }}>+{fmtEur(impact)}</div>
                  </div>
                </div>
              );
            })
          ) : poolActions.map((action: any, idx: number) => {
            const key = action.action_key || action.contract_id || `a${idx}`;
            const selected = !!poolSelected[key];
            const impact = getImpact(action);
            const isTop = !action.isBenchmark && sortedActions.indexOf(action) < TOP_N;
            const isBench = !!action.isBenchmark;
            return (
              <div key={key} onClick={() => !savingKey && togglePool(action)} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all" style={{ border: `1px solid ${selected ? '#C8A96E' : 'var(--border-color)'}`, background: selected ? 'rgba(200,169,110,0.05)' : '#fff' }}>
                <div className="flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all" style={{ borderColor: selected ? '#C8A96E' : '#ccc', background: selected ? '#C8A96E' : '#fff' }}>
                  {selected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>✓</span>}
                </div>
                <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-bold" style={isBench ? { background: '#E8F5E9', color: '#2E7D32' } : { background: '#FFF3E0', color: '#E65100' }}>
                  {isBench ? 'BM' : 'VTR'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{action.action_label || action.contract_name || `Maßnahme ${idx + 1}`}</div>
                  {action.category && <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{action.category}</div>}
                </div>
                <div className="flex-shrink-0 text-right flex flex-col items-end gap-1">
                  {isBench ? (
                    <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: '#E8F5E9', color: '#2E7D32' }}>BENCHMARK</span>
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
        </div>
      </div>

      {/* 5. REALISIERUNGSTRACKER */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <span style={DOT} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)', letterSpacing: '1.2px' }}>REALISIERUNGSTRACKER</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          {[
            { label: 'AKTIV', value: String(activeItems.length), color: 'var(--text-primary)' },
            { label: 'UMGESETZT', value: String(umgesetztItems.length), color: '#2E8B57' },
            { label: 'POTENZIAL P.M.', value: fmtEur(totalPotenzial), color: 'var(--text-primary)' },
            { label: 'REALISIERT', value: fmtEur(totalRealized), color: totalRealized > 0 ? '#2E8B57' : '#E65100' },
            { label: 'CAPTURE RATE', value: `${captureRate.toFixed(0)}%`, color: captureRate >= 50 ? '#2E8B57' : '#E65100' },
          ].map((kpi, i) => (
            <div key={i} className="rounded-xl p-3 text-center" style={{ background: 'var(--background, #F7F5F2)', border: '1px solid var(--border-color)' }}>
              <div className="text-xl font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
              <div className="text-xs mt-0.5 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{kpi.label}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mb-4">
          {([
            ['aktiv', `Aktiv ${activeItems.length}`],
            ['umgesetzt', `Umgesetzt ${umgesetztItems.length}`],
          ] as [TrackerTab, string][]).map(([key, lbl]) => (
            <button key={key} onClick={() => setTrackerTab(key)} className="px-3 py-1.5 rounded-full text-xs font-bold transition-all" style={tabBtn(trackerTab === key)}>{lbl}</button>
          ))}
        </div>
        {displayItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                  <th className="text-left pb-2 font-semibold pr-3 whitespace-nowrap">MONAT</th>
                  <th className="text-left pb-2 font-semibold">VERTRAG / MAẞNAHME</th>
                  <th className="text-left pb-2 font-semibold px-3 whitespace-nowrap">STATUS</th>
                  <th className="text-right pb-2 font-semibold px-3 whitespace-nowrap">POTENZIAL</th>
                  <th className="text-left pb-2 font-semibold px-3 whitespace-nowrap">REALISIERUNG</th>
                  <th className="text-right pb-2 font-semibold px-3 whitespace-nowrap">EBIT REALISIERT</th>
                  <th className="text-left pb-2 font-semibold px-3">NOTIZ</th>
                  <th className="pb-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item) => {
                  const realized = item.potenzial * item.realization / 100;
                  return (
                    <tr key={item.key} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td className="py-3 pr-3 font-bold text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{item.month}</td>
                      <td className="py-3">
                        <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{item.label}</div>
                        {item.description && <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item.description}</div>}
                      </td>
                      <td className="py-3 px-3">
                        {trackerTab === 'aktiv' ? (
                          <select value={item.status} onChange={e => updateItem(item.key, { status: e.target.value as TrackerStatus })} className="text-xs rounded-lg px-2 py-1.5 border" style={{ background: '#fff', color: 'var(--text-primary)', borderColor: 'var(--border-color)', cursor: 'pointer' }}>
                            <option>Offen</option>
                            <option>In Bearbeitung</option>
                            <option>Umgesetzt</option>
                          </select>
                        ) : (
                          <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: '#E8F5E9', color: '#2E7D32' }}>✓ Umgesetzt</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{fmtEur(item.potenzial)}</td>
                      <td className="py-3 px-3" style={{ minWidth: 140 }}>
                        <div className="flex items-center gap-2">
                          <input type="range" min={0} max={100} step={5} value={item.realization}
                            onChange={e => trackerTab === 'aktiv' && updateItem(item.key, { realization: Number(e.target.value) })}
                            disabled={trackerTab === 'umgesetzt'}
                            className="flex-1" style={{ accentColor: '#C8A96E' }} />
                          <span className="text-xs font-semibold w-8 text-right" style={{ color: 'var(--text-secondary)' }}>{item.realization}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-sm whitespace-nowrap" style={{ color: realized > 0 ? '#2E8B57' : 'var(--text-secondary)' }}>
                        {realized > 0 ? fmtEur(realized) : '–'}
                      </td>
                      <td className="py-3 px-3">
                        <input type="text" value={item.note} onChange={e => updateItem(item.key, { note: e.target.value })} placeholder="–" className="text-xs border rounded px-2 py-1" style={{ width: 80, borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: '#fff' }} />
                      </td>
                      <td className="py-3 pl-1">
                        <button onClick={() => removeItem(item.key)} title="Entfernen" className="w-6 h-6 flex items-center justify-center rounded-full transition-all hover:bg-red-50" style={{ color: trackerTab === 'aktiv' ? '#E53935' : '#bbb', fontSize: 16, fontWeight: 700 }}>×</button>
                      </td>
                    </tr>
                  );
                })}
                {trackerTab === 'aktiv' && activeItems.length > 0 && (
                  <tr style={{ borderTop: '2px solid var(--border-color)', background: 'rgba(200,169,110,0.04)' }}>
                    <td className="py-3 pr-3" />
                    <td className="py-3 font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Gesamt EBIT-Wirkung</td>
                    <td className="py-3 px-3" />
                    <td className="py-3 px-3 text-right font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{fmtEur(activeItems.reduce((s, t) => s + t.potenzial, 0))}</td>
                    <td className="py-3 px-3 text-center text-sm font-semibold" style={{ color: '#C8A96E' }}>Ø {captureRate.toFixed(0)}%</td>
                    <td className="py-3 px-3 text-right font-bold text-sm" style={{ color: totalRealized > 0 ? '#2E8B57' : '#E65100' }}>{fmtEur(totalRealized)}</td>
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
                ? 'Noch keine aktiven Maßnahmen. Maßnahmen aus dem Pool auswählen.'
                : 'Noch keine umgesetzten Maßnahmen. Status auf "Umgesetzt" setzen um sie hier zu sehen.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
