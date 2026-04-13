'use client';

import { useState, useMemo } from 'react';
import { api } from '@/lib/api';

interface Props {
  data: any;
  customer: string;
  period: string;
}

const fmtEur = (n: any) =>
  n != null ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n)) : '–';

const fmtPct = (n: any) =>
  n != null ? `${(Number(n) * 100).toFixed(1)} %` : '–';

function BenchmarkGauge({ label, current, targetMin, targetMid, targetMax }: { label: string; current: number; targetMin: number; targetMid: number; targetMax: number }) {
  const range = targetMax * 1.2;
  const pctCurrent = Math.min((current / range) * 100, 100);
  const pctMin = (targetMin / range) * 100;
  const pctMax = (targetMax / range) * 100;
  const pctMid = (targetMid / range) * 100;
  const inTarget = current >= targetMin && current <= targetMax;
  const barColor = current < targetMin ? '#C43830' : current > targetMax ? '#2E8B57' : '#D49564';
  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="text-sm font-bold" style={{ color: inTarget ? '#2E8B57' : barColor }}>
          {typeof current === 'number' && current < 1 ? fmtPct(current) : `${current}`}
        </span>
      </div>
      <div className="relative h-3 rounded-full" style={{ backgroundColor: 'var(--border-color)' }}>
        <div className="absolute h-3 rounded-full" style={{ left: `${pctMin}%`, width: `${pctMax - pctMin}%`, backgroundColor: 'rgba(46,139,87,0.12)' }} />
        <div className="absolute h-3 rounded-full transition-all" style={{ width: `${pctCurrent}%`, backgroundColor: barColor }} />
        <div className="absolute top-0 w-0.5 h-3" style={{ left: `${pctMid}%`, backgroundColor: 'var(--text-secondary)' }} />
      </div>
      <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
        <span>Min: {targetMin < 1 ? fmtPct(targetMin) : targetMin}</span>
        <span>Ziel: {targetMid < 1 ? fmtPct(targetMid) : targetMid}</span>
        <span>Max: {targetMax < 1 ? fmtPct(targetMax) : targetMax}</span>
      </div>
    </div>
  );
}

type TrackerStatus = 'Offen' | 'In Bearbeitung' | 'Umgesetzt';
type EbitTab = 'top' | 'sonstige';
type PoolTab = 'alle' | 'vertraege' | 'liquiditaet';
type TrackerTab = 'aktiv' | 'archiv';

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
  const benchmarks: any[] = (data as any)?.benchmarks || [];
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

  const getImpact = (a: any) => Number(a.impact_eur ?? a.ebit_potential_eur ?? a.ebit_potential ?? 0);

  const sortedActions = useMemo(() =>
    [...actions].sort((a, b) => getImpact(b) - getImpact(a)),
    [actions]
  );

  const TOP_N = Math.min(5, sortedActions.length);
  const topActions = sortedActions.slice(0, TOP_N);
  const sonstigeActions = sortedActions.slice(TOP_N);
  const totalEbitPotential = sortedActions.reduce((s, a) => s + getImpact(a), 0);
  const ebitActions = ebitTab === 'top' ? topActions : sonstigeActions;

  const poolActions = useMemo(() => {
    if (poolTab === 'vertraege') return sortedActions.slice(0, TOP_N);
    return sortedActions;
  }, [sortedActions, poolTab, TOP_N]);

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
      description: action.category || '', potenzial: getImpact(action),
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

  const updateItem = (key: string, updates: Partial<TrackerItem>) =>
    setTrackerItems(prev => prev.map(t => t.key === key ? { ...t, ...updates } : t));

  const archiveItem = (key: string) =>
    setTrackerItems(prev => prev.map(t => t.key === key ? { ...t, archived: true } : t));

  const removeItem = (key: string) => {
    setPoolSelected(prev => ({ ...prev, [key]: false }));
    setTrackerItems(prev => prev.filter(t => t.key !== key));
  };

  const activeItems = trackerItems.filter(t => !t.archived);
  const archivedItems = trackerItems.filter(t => t.archived);
  const umgesetztCount = activeItems.filter(t => t.status === 'Umgesetzt').length;
  const totalPotenzial = activeItems.reduce((s, t) => s + t.potenzial, 0);
  const totalRealized = activeItems.reduce((s, t) => s + (t.potenzial * t.realization / 100), 0);
  const captureRate = totalPotenzial > 0 ? (totalRealized / totalPotenzial) * 100 : 0;
  const displayItems = trackerTab === 'aktiv' ? activeItems : archivedItems;

  const tabBtn = (active: boolean) => active
    ? { background: '#C8A96E', color: '#fff' }
    : { background: 'transparent', color: 'var(--text-secondary)', border: '1.5px solid var(--border-color)' };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Maßnahmen & Benchmarks</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Optimierungspotenziale und Umsetzungstracking</p>
        <div className="copper-line" />
      </div>

      {/* 1. BENCHMARKVERGLEICH */}
      {benchmarks.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <span style={DOT} />
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)', letterSpacing: '1.2px' }}>BENCHMARKVERGLEICH</h3>
          </div>
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>Branchenvergleich der wichtigsten Kennzahlen</p>
          <div style={COPPER_LINE} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {benchmarks.map((b: any, i: number) => (
              <BenchmarkGauge key={i} label={b.kpi_label || `KPI ${i + 1}`} current={Number(b.current ?? 0)} targetMin={Number(b.target_min ?? 0)} targetMid={Number(b.target_mid ?? 0)} targetMax={Number(b.target_max ?? 0)} />
            ))}
          </div>
        </div>
      )}

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
                <div key={action.action_key || idx} className="flex items-center gap-3 p-3.5 rounded-xl" style={{ border: '1px solid var(--border-color)', background: '#fff' }}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: '#C8A96E', color: '#fff' }}>{rank}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{action.action_label || action.contract_name || `Maßnahme ${rank}`}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Aufwand: mittel · Wirkung: 1–3 Monate</div>
                  </div>
                  <div className="flex-shrink-0 text-right flex flex-col items-end gap-1">
                    <div className="font-bold text-sm" style={{ color: '#2E8B57' }}>+{fmtEur(impact)}</div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: badge.bg, color: badge.color }}>{badge.text}</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {liqLevers.map((lever, i) => (
            <div key={i} className="p-4 rounded-xl" style={{ border: lever.biggest ? '2px solid #C8A96E' : '1px solid var(--border-color)', background: '#fff', position: 'relative', paddingTop: lever.biggest ? '1.5rem' : '1rem' }}>
              {lever.biggest && <span className="absolute text-xs font-bold rounded px-2 py-0.5" style={{ top: -11, left: 16, background: '#C8A96E', color: '#fff' }}>GRÖSSTER HEBEL</span>}
              <div className="flex justify-between items-start mb-2">
                <div className="font-bold text-sm pr-3" style={{ color: 'var(--text-primary)' }}>{lever.title}</div>
                <div className="font-bold text-sm flex-shrink-0" style={{ color: '#2E8B57' }}>+{fmtEur(lever.impact)}</div>
              </div>
              <ul className="space-y-1">
                {lever.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span style={{ color: '#C8A96E', flexShrink: 0 }}>✓</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* 4. MAẞNAHMENPOOL */}
      {sortedActions.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span style={DOT} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)', letterSpacing: '1.2px' }}>MAẞNAHMENPOOL</span>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--border-color)', color: 'var(--text-secondary)' }}>{sortedActions.length} verfügbar</span>
          </div>
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>Maßnahmen auswählen und in den Tracker übernehmen</p>
          <div className="flex gap-2 mb-4">
            {([['alle', `Alle ${sortedActions.length}`], ['vertraege', `Top Verträge ${topActions.length}`], ['liquiditaet', `Liquidität ${liqLevers.length}`]] as [PoolTab, string][]).map(([key, lbl]) => (
              <button key={key} onClick={() => setPoolTab(key)} className="px-3 py-1.5 rounded-full text-xs font-bold transition-all" style={tabBtn(poolTab === key)}>{lbl}</button>
            ))}
          </div>
          <div className="space-y-2">
            {poolActions.map((action: any, idx: number) => {
              const key = action.action_key || action.contract_id || `a${idx}`;
              const selected = !!poolSelected[key];
              const impact = getImpact(action);
              const isTop = sortedActions.indexOf(action) < TOP_N;
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
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>EBIT</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. REALISIERUNGSTRACKER */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <span style={DOT} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)', letterSpacing: '1.2px' }}>REALISIERUNGSTRACKER</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          {[
            { label: 'AKTIV', value: String(activeItems.length), color: 'var(--text-primary)' },
            { label: 'UMGESETZT', value: String(umgesetztCount), color: '#2E8B57' },
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
          {([['aktiv', `Aktiv ${activeItems.length}`], ['archiv', `Archiv ${archivedItems.length}`]] as [TrackerTab, string][]).map(([key, lbl]) => (
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
                        <select value={item.status} onChange={e => updateItem(item.key, { status: e.target.value as TrackerStatus })} className="text-xs rounded-lg px-2 py-1.5 border" style={{ background: '#fff', color: 'var(--text-primary)', borderColor: 'var(--border-color)', cursor: 'pointer' }}>
                          <option>Offen</option>
                          <option>In Bearbeitung</option>
                          <option>Umgesetzt</option>
                        </select>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{fmtEur(item.potenzial)}</td>
                      <td className="py-3 px-3" style={{ minWidth: 140 }}>
                        <div className="flex items-center gap-2">
                          <input type="range" min={0} max={100} step={5} value={item.realization} onChange={e => updateItem(item.key, { realization: Number(e.target.value) })} className="flex-1" style={{ accentColor: '#C8A96E' }} />
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
                        {trackerTab === 'aktiv' ? (
                          <button onClick={() => archiveItem(item.key)} title="Archivieren" className="w-6 h-6 flex items-center justify-center rounded-full transition-all hover:bg-red-50" style={{ color: '#E53935', fontSize: 16, fontWeight: 700 }}>×</button>
                        ) : (
                          <button onClick={() => removeItem(item.key)} title="Löschen" className="w-6 h-6 flex items-center justify-center rounded-full transition-all hover:bg-red-50" style={{ color: '#999', fontSize: 14, fontWeight: 700 }}>×</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {trackerTab === 'aktiv' && activeItems.length > 0 && (
                  <tr style={{ borderTop: '2px solid var(--border-color)', background: 'rgba(200,169,110,0.04)' }}>
                    <td className="py-3 pr-3" />
                    <td className="py-3 font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Gesamt EBIT-Wirkung</td>
                    <td className="py-3 px-3" />
                    <td className="py-3 px-3 text-right font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{fmtEur(totalPotenzial)}</td>
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
              {trackerTab === 'aktiv' ? 'Noch keine Maßnahmen im Tracker. Maßnahmen aus dem Pool auswählen.' : 'Keine archivierten Maßnahmen.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
