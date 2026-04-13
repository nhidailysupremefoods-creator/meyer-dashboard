// ============================================================
// Utility Functions
// ============================================================

import { Branche, Lead, DuplicateMatch } from './types';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '–';
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function computeICPScore(data: {
  branche?: Branche | '';
  umsatz?: number | null;
  mitarbeiteranzahl?: number | null;
  controller_anzahl?: number | null;
  ebit_marge?: number | null;
}): number {
  let score = 0;

  // Branche (max 25)
  const targetBranchen = ['industrienahe_service', 'technische_wartung', 'b2b_contracting'];
  if (data.branche && targetBranchen.includes(data.branche)) score += 25;

  // Umsatz (max 25) – Sweet Spot: EUR 4M–20M
  const umsatz = data.umsatz || 0;
  if (umsatz >= 4_000_000 && umsatz <= 20_000_000) score += 25;
  else if (umsatz >= 2_000_000 && umsatz < 4_000_000) score += 15;
  else if (umsatz > 20_000_000 && umsatz <= 30_000_000) score += 10;

  // Mitarbeiter (max 20) – Sweet Spot: 25–80
  const ma = data.mitarbeiteranzahl || 0;
  if (ma >= 25 && ma <= 80) score += 20;
  else if (ma >= 15 && ma < 25) score += 12;
  else if (ma > 80 && ma <= 120) score += 8;

  // Controller (max 15) – Ideal: 0–2
  const ctrl = data.controller_anzahl ?? 99;
  if (ctrl <= 2) score += 15;
  else if (ctrl <= 4) score += 5;

  // EBIT-Marge (max 15) – Sweet Spot: 8–20%
  const ebit = data.ebit_marge || 0;
  if (ebit >= 0.08 && ebit <= 0.20) score += 15;
  else if (ebit >= 0.05 && ebit < 0.08) score += 10;
  else if (ebit > 0.20) score += 8;

  return Math.min(100, Math.max(0, score));
}

export const BRANCHEN_LABELS: Record<string, string> = {
  industrienahe_service: 'Industrienahe Service- & Wartungsunternehmen',
  technische_wartung: 'Technische Wartungsbetriebe mit Rahmenverträgen',
  b2b_contracting: 'B2B-Contracting & Outsourcing-Services',
};

export const PIPELINE_STAGES = [
  { value: 'neu',          label: 'Neu',          color: 'bg-gray-100 text-gray-700' },
  { value: 'kontaktiert',  label: 'Kontaktiert',  color: 'bg-blue-100 text-blue-700' },
  { value: 'qualifiziert', label: 'Qualifiziert', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'angebot',      label: 'Angebot',      color: 'bg-amber-100 text-amber-700' },
  { value: 'verhandlung',  label: 'Verhandlung',  color: 'bg-orange-100 text-orange-700' },
  { value: 'gewonnen',     label: 'Gewonnen',     color: 'bg-green-100 text-green-700' },
  { value: 'verloren',     label: 'Verloren',     color: 'bg-red-100 text-red-700' },
] as const;

// ============================================================
// Fuzzy Duplicate Detection
// ============================================================

const COMPANY_SUFFIXES = [
  'gmbh', 'ag', 'kg', 'ohg', 'gbr', 'e.k.', 'ek', 'e.v.', 'ev',
  'mbh', 'co.', 'co', '& co', '& co.', 'ug', 'se', 'kgaa',
  'inc', 'ltd', 'llc', 'corp',
];

/** Normalize company name: lowercase, strip legal suffixes, trim whitespace/punctuation */
export function normalizeCompanyName(name: string): string {
  let normalized = name.toLowerCase().trim();
  // Remove common punctuation
  normalized = normalized.replace(/[.,\-_&+]/g, ' ');
  // Remove legal suffixes
  for (const suffix of COMPANY_SUFFIXES) {
    const regex = new RegExp(`\\b${suffix.replace('.', '\\.')}\\b`, 'gi');
    normalized = normalized.replace(regex, '');
  }
  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized;
}

/** Levenshtein distance for fuzzy matching */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Similarity score 0–1 based on normalized Levenshtein distance */
export function companySimilarity(nameA: string, nameB: string): number {
  const a = normalizeCompanyName(nameA);
  const b = normalizeCompanyName(nameB);
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return 1 - levenshtein(a, b) / maxLen;
}

/** Find potential duplicates for a given company name among existing leads */
export function findDuplicates(
  companyName: string,
  leads: Lead[],
  excludeLeadId?: string,
  threshold: number = 0.75,
): DuplicateMatch[] {
  if (!companyName.trim()) return [];
  return leads
    .filter(l => l.lead_id !== excludeLeadId && !l.is_archived)
    .map(l => ({
      lead_id: l.lead_id,
      company_name: l.company_name,
      similarity: companySimilarity(companyName, l.company_name),
    }))
    .filter(m => m.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}
