/**
 * Maßnahmen-Steuerungs-Engine
 *
 * Intelligente Logik für:
 * 1. Automatische Maßnahmenvorschläge (Top 3-5 pro Monat)
 * 2. Carry-Over (offene Maßnahmen → nächster Monat)
 * 3. Deduplizierung (stabile action_id)
 * 4. Priorisierung (EBIT Impact → Status → Fortschritt)
 * 5. Management-Logik (60-80% Carry-Over, 20-40% neu)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type MassnahmeStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE';

export interface MassnahmeItem {
  /** Stabile ID: `${customer_id}__${action_key}` */
  id: string;
  action_key: string;
  label: string;
  description: string;
  category: 'VERTRAG' | 'BENCHMARK' | 'LIQUIDITAET';
  /** EBIT-Potenzial in EUR pro Monat */
  potenzial: number;
  /** Monat der Erstellung (YYYY_MM) */
  created_period: string;
  /** Aktueller Monat im Tracker */
  current_period: string;
  status: MassnahmeStatus;
  /** 0-100 Prozent */
  realization: number;
  note: string;
  /** Marge des Vertrags (wenn verfügbar) */
  margin_pct?: number;
  /** Prioritätsscore (berechnet) */
  priority_score: number;
  /** Ob das System diese Maßnahme empfohlen hat */
  is_recommendation: boolean;
  /** Ob der Nutzer diese Maßnahme aktiv übernommen hat */
  is_accepted: boolean;
  /** Carry-Over: aus welchem Monat stammt die Maßnahme ursprünglich? */
  origin_period?: string;
  /** Wie viele Monate wurde diese Maßnahme bereits carry-overed? */
  carry_over_count: number;
}

export interface Recommendation {
  action_key: string;
  label: string;
  description: string;
  category: 'VERTRAG' | 'BENCHMARK' | 'LIQUIDITAET';
  potenzial: number;
  margin_pct?: number;
  priority_score: number;
  reason: string;
  urgency: 'KRITISCH' | 'HOCH' | 'MITTEL';
}

export interface EngineState {
  items: MassnahmeItem[];
  recommendations: Recommendation[];
  kpis: {
    active_count: number;
    done_count: number;
    open_pipeline: number;
    realized_ebit: number;
    total_potenzial: number;
    capture_rate: number;
    carry_over_count: number;
    new_this_month: number;
  };
}

// ─── Storage Key ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'md_massnahmen_v2';

function getStorageKey(customer: string): string {
  return `${STORAGE_KEY}_${customer}`;
}

// ─── Persistence (localStorage) ──────────────────────────────────────────────

export function loadItems(customer: string): MassnahmeItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(customer));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveItems(customer: string, items: MassnahmeItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(customer), JSON.stringify(items));
  } catch { /* quota exceeded */ }
}

// ─── Stabile Action ID ───────────────────────────────────────────────────────

export function makeActionId(customer: string, actionKey: string): string {
  return `${customer}__${actionKey}`;
}

// ─── Priority Score Berechnung ───────────────────────────────────────────────

function computePriorityScore(opts: {
  potenzial: number;
  margin_pct?: number;
  status: MassnahmeStatus;
  realization: number;
  carry_over_count: number;
}): number {
  let score = 0;

  // 1. EBIT Impact (0-40 Punkte) — logarithmisch für große Unterschiede
  const impact = Math.abs(opts.potenzial);
  if (impact > 0) {
    score += Math.min(40, Math.log10(impact + 1) * 10);
  }

  // 2. Marge-Abweichung (0-25 Punkte) — negative Marge = sehr dringend
  if (opts.margin_pct != null) {
    if (opts.margin_pct < 0) score += 25;
    else if (opts.margin_pct < 0.05) score += 20;
    else if (opts.margin_pct < 0.08) score += 15;
    else if (opts.margin_pct < 0.12) score += 10;
    else score += 5;
  }

  // 3. Status-Boost (0-15 Punkte) — laufende Maßnahmen bevorzugen
  if (opts.status === 'IN_PROGRESS') score += 15;
  else if (opts.status === 'OPEN') score += 10;

  // 4. Fortschritts-Bonus (0-10 Punkte) — fast fertige Maßnahmen priorisieren
  if (opts.realization >= 80) score += 10;
  else if (opts.realization >= 50) score += 5;

  // 5. Carry-Over-Dringlichkeit (0-10 Punkte) — lang offene Maßnahmen eskalieren
  score += Math.min(10, opts.carry_over_count * 3);

  return Math.round(score);
}

// ─── Automatische Empfehlungen generieren ────────────────────────────────────

export function generateRecommendations(
  actions: any[],
  existingItems: MassnahmeItem[],
  period: string,
  maxRecommendations: number = 5,
): Recommendation[] {
  const existingKeys = new Set(existingItems.map(i => i.action_key));
  const candidates: Recommendation[] = [];

  for (const action of actions) {
    const key = action.action_key || action.contract_id || '';
    if (!key) continue;

    // Bereits im Tracker? → Nicht empfehlen
    if (existingKeys.has(key)) continue;

    const potenzial = Number(action.impact_eur ?? action.ebit_potential_eur ?? action.ebit_potential ?? 0);
    const margin = Number(action.margin_pct ?? 0);
    const label = action.action_label || action.contract_name || '';

    // Grund für die Empfehlung bestimmen
    let reason = '';
    let urgency: 'KRITISCH' | 'HOCH' | 'MITTEL' = 'MITTEL';

    if (margin < 0 || Number(action.profit ?? 0) < 0) {
      reason = `Negativmarge (${(margin * 100).toFixed(1)}%) — sofortige Nachverhandlung empfohlen`;
      urgency = 'KRITISCH';
    } else if (margin < 0.05) {
      reason = `Sehr niedrige Marge (${(margin * 100).toFixed(1)}%) — Preisanpassung notwendig`;
      urgency = 'HOCH';
    } else if (potenzial > 5000) {
      reason = `Hohes EBIT-Potenzial von ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(potenzial)} p.M.`;
      urgency = 'HOCH';
    } else if (potenzial > 2000) {
      reason = `EBIT-Potenzial von ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(potenzial)} p.M. identifiziert`;
      urgency = 'MITTEL';
    } else {
      reason = `Optimierungspotenzial: Marge ${(margin * 100).toFixed(1)}% — Branchenziel ≥ 10%`;
      urgency = 'MITTEL';
    }

    candidates.push({
      action_key: key,
      label,
      description: action.category || action.diagnose || '',
      category: 'VERTRAG',
      potenzial,
      margin_pct: margin,
      priority_score: computePriorityScore({
        potenzial,
        margin_pct: margin,
        status: 'OPEN',
        realization: 0,
        carry_over_count: 0,
      }),
      reason,
      urgency,
    });
  }

  // Sortierung: Kritische zuerst, dann EBIT-Impact
  candidates.sort((a, b) => {
    const urgencyOrder = { KRITISCH: 0, HOCH: 1, MITTEL: 2 };
    const urgDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (urgDiff !== 0) return urgDiff;
    return b.priority_score - a.priority_score;
  });

  return candidates.slice(0, maxRecommendations);
}

// ─── Carry-Over Logik ────────────────────────────────────────────────────────

export function applyCarryOver(
  items: MassnahmeItem[],
  currentPeriod: string,
): MassnahmeItem[] {
  return items.map(item => {
    // Bereits im aktuellen Monat? → Keine Änderung
    if (item.current_period === currentPeriod) return item;

    // DONE? → Nicht carry-overen, nur im Abschlussmonat anzeigen
    if (item.status === 'DONE') return item;

    // OPEN oder IN_PROGRESS → Carry-Over in aktuellen Monat
    const isOlderPeriod = item.current_period < currentPeriod;
    if (isOlderPeriod) {
      return {
        ...item,
        current_period: currentPeriod,
        origin_period: item.origin_period || item.created_period,
        carry_over_count: item.carry_over_count + 1,
        // Priorität neu berechnen mit Carry-Over-Boost
        priority_score: computePriorityScore({
          potenzial: item.potenzial,
          margin_pct: item.margin_pct,
          status: item.status,
          realization: item.realization,
          carry_over_count: item.carry_over_count + 1,
        }),
      };
    }

    return item;
  });
}

// ─── Deduplizierung ──────────────────────────────────────────────────────────

export function deduplicateItems(items: MassnahmeItem[]): MassnahmeItem[] {
  const seen = new Map<string, MassnahmeItem>();

  for (const item of items) {
    const existing = seen.get(item.action_key);
    if (!existing) {
      seen.set(item.action_key, item);
    } else {
      // Behalte die Version mit mehr Fortschritt
      if (item.realization > existing.realization) {
        seen.set(item.action_key, { ...item, origin_period: existing.origin_period || existing.created_period });
      }
    }
  }

  return Array.from(seen.values());
}

// ─── Sortierung / Priorisierung ──────────────────────────────────────────────

export function sortByPriority(items: MassnahmeItem[]): MassnahmeItem[] {
  return [...items].sort((a, b) => {
    // 1. DONE-Maßnahmen am Ende
    if (a.status === 'DONE' && b.status !== 'DONE') return 1;
    if (b.status === 'DONE' && a.status !== 'DONE') return -1;

    // 2. Höchster Priority Score zuerst
    if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;

    // 3. Bei Gleichstand: höheres EBIT zuerst
    return b.potenzial - a.potenzial;
  });
}

// ─── Empfehlung übernehmen ───────────────────────────────────────────────────

export function acceptRecommendation(
  items: MassnahmeItem[],
  rec: Recommendation,
  customer: string,
  period: string,
): MassnahmeItem[] {
  // Deduplizierung: Existiert bereits?
  if (items.some(i => i.action_key === rec.action_key)) {
    return items; // Keine Duplikate
  }

  const newItem: MassnahmeItem = {
    id: makeActionId(customer, rec.action_key),
    action_key: rec.action_key,
    label: rec.label,
    description: rec.description,
    category: rec.category,
    potenzial: rec.potenzial,
    created_period: period,
    current_period: period,
    status: 'OPEN',
    realization: 0,
    note: '',
    margin_pct: rec.margin_pct,
    priority_score: rec.priority_score,
    is_recommendation: true,
    is_accepted: true,
    carry_over_count: 0,
  };

  return sortByPriority(deduplicateItems([...items, newItem]));
}

// ─── Pool-Maßnahme übernehmen ────────────────────────────────────────────────

export function addFromPool(
  items: MassnahmeItem[],
  action: any,
  customer: string,
  period: string,
): MassnahmeItem[] {
  const key = action.action_key || action.contract_id || '';
  if (!key) return items;

  // Deduplizierung
  if (items.some(i => i.action_key === key)) return items;

  const potenzial = Number(action.impact_eur ?? action.ebit_potential_eur ?? action.ebit_potential ?? 0);
  const margin = Number(action.margin_pct ?? 0);

  const newItem: MassnahmeItem = {
    id: makeActionId(customer, key),
    action_key: key,
    label: action.action_label || action.contract_name || '',
    description: action.category || '',
    category: action.isBenchmark ? 'BENCHMARK' : 'VERTRAG',
    potenzial,
    created_period: period,
    current_period: period,
    status: 'OPEN',
    realization: 0,
    note: '',
    margin_pct: margin || undefined,
    priority_score: computePriorityScore({
      potenzial,
      margin_pct: margin || undefined,
      status: 'OPEN',
      realization: 0,
      carry_over_count: 0,
    }),
    is_recommendation: false,
    is_accepted: true,
    carry_over_count: 0,
  };

  return sortByPriority(deduplicateItems([...items, newItem]));
}

// ─── Status-Update ───────────────────────────────────────────────────────────

export function updateItemStatus(
  items: MassnahmeItem[],
  actionKey: string,
  updates: Partial<Pick<MassnahmeItem, 'status' | 'realization' | 'note'>>,
): MassnahmeItem[] {
  return items.map(item => {
    if (item.action_key !== actionKey) return item;

    const updated = { ...item, ...updates };

    // Auto-Logik bei DONE
    if (updates.status === 'DONE') {
      if (updated.realization < 100) updated.realization = 100;
    }

    // Prioritätsscore aktualisieren
    updated.priority_score = computePriorityScore({
      potenzial: updated.potenzial,
      margin_pct: updated.margin_pct,
      status: updated.status,
      realization: updated.realization,
      carry_over_count: updated.carry_over_count,
    });

    return updated;
  });
}

// ─── Item entfernen ──────────────────────────────────────────────────────────

export function removeItem(items: MassnahmeItem[], actionKey: string): MassnahmeItem[] {
  return items.filter(i => i.action_key !== actionKey);
}

// ─── Auto-Abschluss-Empfehlung ──────────────────────────────────────────────

export function getAutoCompleteHints(items: MassnahmeItem[]): string[] {
  return items
    .filter(i => i.status !== 'DONE' && i.realization >= 80)
    .map(i => i.action_key);
}

// ─── KPI-Berechnung ─────────────────────────────────────────────────────────

export function computeKPIs(items: MassnahmeItem[], currentPeriod: string) {
  const active = items.filter(i => i.status !== 'DONE');
  const done = items.filter(i => i.status === 'DONE');
  const currentItems = items.filter(i => i.current_period === currentPeriod);
  const carryOvers = currentItems.filter(i => i.carry_over_count > 0);
  const newOnes = currentItems.filter(i => i.carry_over_count === 0 && i.created_period === currentPeriod);

  const totalPotenzial = items.reduce((s, i) => s + i.potenzial, 0);
  const realizedEbit = items.reduce((s, i) => s + (i.potenzial * i.realization / 100), 0);
  const openPipeline = active.reduce((s, i) => s + i.potenzial, 0);

  return {
    active_count: active.length,
    done_count: done.length,
    open_pipeline: openPipeline,
    realized_ebit: realizedEbit,
    total_potenzial: totalPotenzial,
    capture_rate: totalPotenzial > 0 ? (realizedEbit / totalPotenzial) * 100 : 0,
    carry_over_count: carryOvers.length,
    new_this_month: newOnes.length,
  };
}

// ─── Haupt-Engine: Alle Logiken zusammenführen ───────────────────────────────

export function runEngine(
  customer: string,
  period: string,
  actions: any[],
): EngineState {
  // 1. Bestehende Maßnahmen laden
  let items = loadItems(customer);

  // 2. Carry-Over anwenden (offene → aktueller Monat)
  items = applyCarryOver(items, period);

  // 3. Deduplizierung
  items = deduplicateItems(items);

  // 4. Priorisierung
  items = sortByPriority(items);

  // 5. Empfehlungen generieren (nur neue, noch nicht im Tracker)
  const recommendations = generateRecommendations(actions, items, period);

  // 6. KPIs berechnen
  const kpis = computeKPIs(items, period);

  // 7. Persistieren
  saveItems(customer, items);

  return { items, recommendations, kpis };
}
