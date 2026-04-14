/**
 * Meyer Decision Dashboard Configuration
 * Central configuration for the Next.js proxy application
 */

// ============================================================================
// Environment & API Configuration
// ============================================================================

export const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';

if (!APPS_SCRIPT_URL && process.env.NODE_ENV === 'production') {
  throw new Error('APPS_SCRIPT_URL environment variable is not set');
}

// Dashboard version — should match Apps Script DASHBOARD_VERSION
export const DASHBOARD_VERSION = 'v6';

// API Configuration
export const API_CONFIG = {
  TIMEOUT_MS: 30000, // 30 second timeout for Apps Script calls
  RETRY_COUNT: 3,
  RETRY_DELAY_MS: 1000,
} as const;

// ============================================================================
// Storage Keys (localStorage, sessionStorage, cookies)
// ============================================================================

export const STORAGE_KEYS = {
  TOKEN: 'md_session_token',
  AUTH_DATA: 'md_auth_data',
  DASHBOARD_STATE: 'md_dashboard_state',
  PREFERENCES: 'md_preferences',
  CACHE_VERSION: 'md_cache_v',
} as const;

// ============================================================================
// Dashboard Pages
// ============================================================================

export const PAGES = {
  1: { id: 1, label: 'Gesamtlage', slug: 'overview' },
  2: { id: 2, label: 'Vertragsanalyse', slug: 'contracts' },
  3: { id: 3, label: 'Liquiditätsstabilität', slug: 'liquidity' },
  4: { id: 4, label: 'Maßnahmen', slug: 'measures' },
  5: { id: 5, label: 'Gesprächsleitfaden', slug: 'advisory' },
} as const;

export const PAGE_NAMES: Record<number, string> = {
  1: 'Gesamtlage',
  2: 'Vertragsanalyse',
  3: 'Liquiditätsstabilität',
  4: 'Maßnahmen',
  5: 'Gesprächsleitfaden',
};

export const PAGES_ARRAY = [1, 2, 3, 4, 5] as const;

// ============================================================================
// User Roles & Permissions
// ============================================================================

export const ROLES = {
  ADMIN: 'admin',
  CUSTOMER: 'customer',
  NONE: 'none',
} as const;

export const ROLE_PERMISSIONS = {
  admin: ['read_all', 'write_all', 'manage_users', 'view_audit'],
  customer: ['read_own', 'tracker_update'],
  none: [],
} as const;

// ============================================================================
// Industry Segments & Einsatzlogik
// ============================================================================

export const INDUSTRY_SEGMENTS = {
  B2B_CONTRACTING: { label: 'B2B-Serviceunternehmen', code: 'B2B_CONTRACTING' },
  INDUSTRIESERVICE: { label: 'Industrienahe Service- & Wartung', code: 'INDUSTRIESERVICE' },
  TECHN_WARTUNG: { label: 'Technische Wartungsbetriebe', code: 'TECHN_WARTUNG' },
  HANDWERK: { label: 'Handwerk', code: 'HANDWERK' },
  SONSTIGE: { label: 'Sonstige', code: 'SONSTIGE' },
} as const;

/**
 * Einsatzlogik (sub-segment) options per industry
 * Defines operational context (e.g., reactive vs. planned services)
 */
export const EINSATZLOGIK_OPTIONS = {
  INDUSTRIESERVICE: [
    { code: 'REAKTIVER_FIELD_SERVICE', label: 'Reaktiver Field Service' },
    { code: 'GEPLANTER_IH_SERVICE', label: 'Geplanter Anlagen- & IH-Service' },
    { code: 'HOCHQUALIFIZIERT_SPECIAL', label: 'Hochqualifizierter Spezialservice' },
  ],
  TECHN_WARTUNG: [
    { code: 'STANDARD_WARTUNG', label: 'Standard-Wartung (HLK, Aufzüge, BMA)' },
    { code: 'SLA_INTENSIVE_WARTUNG', label: 'SLA-intensive Wartung (KRITIS, 24/7)' },
    { code: 'WARTUNG_ZUSATZLEISTUNG', label: 'Wartung + Zusatzleistungen' },
  ],
  B2B_CONTRACTING: [
    { code: 'BETRIEBSFUEHRUNG_OUTSOURCING', label: 'Betriebsführungs-Outsourcing (ohne Invest)' },
    { code: 'ENERGIE_CONTRACTING', label: 'Energie-Contracting (mit CAPEX)' },
    { code: 'PRODUKTIONSNAHE_SERVICES', label: 'Produktionsnahe Services (Schichtbetrieb)' },
  ],
} as const;

type EinsatzlogikCode = keyof typeof EINSATZLOGIK_OPTIONS[keyof typeof EINSATZLOGIK_OPTIONS];

/**
 * KPI Target Values by Industry + Einsatzlogik (Zielwerte_Verifikation.xlsx)
 * Structure: { industry: { einsatzlogik: { targets } } }
 * Values: [low, mid, high] for ranges, or single value for fixed targets
 */
export const BENCHMARK_CONFIG = {
  INDUSTRIESERVICE: {
    REAKTIVER_FIELD_SERVICE: {
      target_margin_pct: [0.10, 0.11, 0.12],
      target_hourly_rate: [120, 130, 140],
      target_payroll_cost_pct: [0.50, 0.55, 0.60],
      hour_variance_pct: 0.10, // ±10%
      productivity_hours_low: 1300,
      productivity_hours_target: 1500,
      productivity_hours_high: 1700,
    },
    GEPLANTER_IH_SERVICE: {
      target_margin_pct: [0.12, 0.135, 0.15],
      target_hourly_rate: [100, 110, 120],
      target_payroll_cost_pct: [0.45, 0.50, 0.55],
      hour_variance_pct: 0.05, // ±5%
      productivity_hours_low: 1350,
      productivity_hours_target: 1550,
      productivity_hours_high: 1750,
    },
    HOCHQUALIFIZIERT_SPECIAL: {
      target_margin_pct: [0.15, 0.165, 0.18],
      target_hourly_rate: [140, 160, 180],
      target_payroll_cost_pct: [0.40, 0.45, 0.50],
      hour_variance_pct: 0.05, // ±5%
      productivity_hours_low: 1200,
      productivity_hours_target: 1400,
      productivity_hours_high: 1600,
    },
    // Default (no Einsatzlogik specified) — use middle option
    DEFAULT: {
      target_margin_pct: [0.12, 0.135, 0.15],
      target_hourly_rate: [100, 110, 120],
      target_payroll_cost_pct: [0.45, 0.50, 0.55],
      hour_variance_pct: 0.05,
      productivity_hours_low: 1350,
      productivity_hours_target: 1550,
      productivity_hours_high: 1750,
    },
  },
  TECHN_WARTUNG: {
    STANDARD_WARTUNG: {
      target_margin_pct: [0.12, 0.135, 0.15],
      target_hourly_rate: [85, 90, 95],
      target_payroll_cost_pct: [0.45, 0.475, 0.50],
      hour_variance_pct: 0.05, // ±5%
      productivity_hours_low: 1400,
      productivity_hours_target: 1600,
      productivity_hours_high: 1800,
    },
    SLA_INTENSIVE_WARTUNG: {
      target_margin_pct: [0.15, 0.165, 0.18],
      target_hourly_rate: [95, 102.5, 110],
      target_payroll_cost_pct: [0.50, 0.525, 0.55],
      hour_variance_pct: 0.10, // ±10%
      productivity_hours_low: 1350,
      productivity_hours_target: 1550,
      productivity_hours_high: 1750,
    },
    WARTUNG_ZUSATZLEISTUNG: {
      target_margin_pct: [0.16, 0.18, 0.20],
      target_hourly_rate: [100, 110, 120],
      target_payroll_cost_pct: [0.45, 0.475, 0.50],
      hour_variance_pct: 0.05, // ±5%
      productivity_hours_low: 1400,
      productivity_hours_target: 1600,
      productivity_hours_high: 1800,
    },
    // Default (no Einsatzlogik specified) — use middle option
    DEFAULT: {
      target_margin_pct: [0.15, 0.165, 0.18],
      target_hourly_rate: [95, 102.5, 110],
      target_payroll_cost_pct: [0.50, 0.525, 0.55],
      hour_variance_pct: 0.05,
      productivity_hours_low: 1400,
      productivity_hours_target: 1600,
      productivity_hours_high: 1800,
    },
  },
  B2B_CONTRACTING: {
    BETRIEBSFUEHRUNG_OUTSOURCING: {
      target_margin_pct: [0.08, 0.09, 0.10],
      target_contribution_margin_pct: [0.30, 0.325, 0.35],
      target_payroll_cost_pct: [0.35, 0.40, 0.45],
      productivity_hours_low: 1200,
      productivity_hours_target: 1400,
      productivity_hours_high: 1600,
    },
    ENERGIE_CONTRACTING: {
      target_margin_pct: [0.09, 0.105, 0.12],
      target_contribution_margin_pct: [0.35, 0.375, 0.40],
      target_payroll_cost_pct: [0.35, 0.40, 0.45],
      cost_variance_pct: 0.05, // < 5%
      productivity_hours_low: 1200,
      productivity_hours_target: 1400,
      productivity_hours_high: 1600,
    },
    PRODUKTIONSNAHE_SERVICES: {
      target_margin_pct: [0.10, 0.11, 0.12],
      target_payroll_cost_pct: [0.45, 0.50, 0.55],
      sla_cost_quota_pct: [0.05, 0.075, 0.10], // Explicit SLA cost tracking
      productivity_hours_low: 1200,
      productivity_hours_target: 1400,
      productivity_hours_high: 1600,
    },
    // Default (no Einsatzlogik specified) — use middle option
    DEFAULT: {
      target_margin_pct: [0.09, 0.105, 0.12],
      target_contribution_margin_pct: [0.35, 0.375, 0.40],
      target_payroll_cost_pct: [0.35, 0.40, 0.45],
      productivity_hours_low: 1200,
      productivity_hours_target: 1400,
      productivity_hours_high: 1600,
    },
  },
  // Fallback industries without Einsatzlogik (original values, now per industry)
  HANDWERK: {
    DEFAULT: {
      target_margin_pct: [0.08, 0.13, 0.18],
      target_hourly_rate: [70, 85, 100],
      target_payroll_cost_pct: [0.45, 0.50, 0.60],
      productivity_hours_low: 1200,
      productivity_hours_target: 1400,
      productivity_hours_high: 1600,
    },
  },
  SONSTIGE: {
    DEFAULT: {
      target_margin_pct: [0.07, 0.12, 0.17],
      target_hourly_rate: [80, 95, 110],
      target_payroll_cost_pct: [0.45, 0.55, 0.65],
      productivity_hours_low: 1200,
      productivity_hours_target: 1400,
      productivity_hours_high: 1600,
    },
  },
} as const;

/**
 * Legacy BENCHMARK_CONFIG for backward compatibility
 * Maps industry codes to flat benchmark profiles
 */
export const BENCHMARK_CONFIG_LEGACY = {
  B2B_CONTRACTING: {
    target_margin_pct: [0.08, 0.12, 0.18],
    target_hourly_rate: [65, 85, 105],
    target_payroll_cost_pct: [0.45, 0.50, 0.60],
    productivity_hours_low: 1200,
    productivity_hours_target: 1400,
    productivity_hours_high: 1600,
  },
  INDUSTRIESERVICE: {
    target_margin_pct: [0.07, 0.11, 0.16],
    target_hourly_rate: [95, 110, 130],
    target_payroll_cost_pct: [0.50, 0.55, 0.65],
    productivity_hours_low: 1300,
    productivity_hours_target: 1500,
    productivity_hours_high: 1700,
  },
  TECHN_WARTUNG: {
    target_margin_pct: [0.10, 0.14, 0.20],
    target_hourly_rate: [95, 100, 105],
    target_payroll_cost_pct: [0.45, 0.50, 0.60],
    productivity_hours_low: 1400,
    productivity_hours_target: 1600,
    productivity_hours_high: 1800,
  },
  HANDWERK: {
    target_margin_pct: [0.08, 0.13, 0.18],
    target_hourly_rate: [70, 85, 100],
    target_payroll_cost_pct: [0.45, 0.50, 0.60],
    productivity_hours_low: 1200,
    productivity_hours_target: 1400,
    productivity_hours_high: 1600,
  },
  SONSTIGE: {
    target_margin_pct: [0.07, 0.12, 0.17],
    target_hourly_rate: [80, 95, 110],
    target_payroll_cost_pct: [0.45, 0.55, 0.65],
    productivity_hours_low: 1200,
    productivity_hours_target: 1400,
    productivity_hours_high: 1600,
  },
} as const;

// ============================================================================
// Helper Functions for KPI Targets
// ============================================================================

/**
 * Type definition for KPI targets
 */
export interface KPITargets {
  target_margin_pct?: [number, number, number]; // [low, mid, high]
  target_hourly_rate?: [number, number, number];
  target_payroll_cost_pct?: [number, number, number];
  target_contribution_margin_pct?: [number, number, number];
  sla_cost_quota_pct?: [number, number, number];
  hour_variance_pct?: number;
  cost_variance_pct?: number;
  productivity_hours_low?: number;
  productivity_hours_target?: number;
  productivity_hours_high?: number;
}

/**
 * Get KPI targets for a customer by industry segment and optional einsatzlogik
 * @param industrySegment Industry code (B2B_CONTRACTING, INDUSTRIESERVICE, etc.)
 * @param einsatzlogik Optional operational context (Einsatzlogik code)
 * @returns KPI targets with [low, mid, high] ranges
 *
 * @example
 * // Specific Einsatzlogik
 * getTargetsForCustomer('INDUSTRIESERVICE', 'REAKTIVER_FIELD_SERVICE')
 *
 * // Falls back to DEFAULT for Einsatzlogik if not provided
 * getTargetsForCustomer('INDUSTRIESERVICE')
 *
 * // Falls back to LEGACY config if industry not found in new structure
 * getTargetsForCustomer('UNKNOWN_INDUSTRY')
 */
export function getTargetsForCustomer(
  industrySegment: string,
  einsatzlogik?: string
): KPITargets {
  // Ensure industry segment is valid
  const industry = industrySegment as keyof typeof BENCHMARK_CONFIG;

  // Check if industry exists in new structure
  if (!(industry in BENCHMARK_CONFIG)) {
    // Fallback to legacy config
    const legacyIndustry = industry as keyof typeof BENCHMARK_CONFIG_LEGACY;
    return BENCHMARK_CONFIG_LEGACY[legacyIndustry] || BENCHMARK_CONFIG_LEGACY.SONSTIGE;
  }

  // Get industry targets
  const industryTargets = BENCHMARK_CONFIG[industry] as Record<string, KPITargets>;

  // If einsatzlogik provided, try to get specific targets
  if (einsatzlogik && einsatzlogik in industryTargets) {
    return industryTargets[einsatzlogik];
  }

  // Fall back to DEFAULT
  if ('DEFAULT' in industryTargets) {
    return industryTargets.DEFAULT;
  }

  // Final fallback to legacy config
  const legacyIndustry = industry as keyof typeof BENCHMARK_CONFIG_LEGACY;
  return BENCHMARK_CONFIG_LEGACY[legacyIndustry] || BENCHMARK_CONFIG_LEGACY.SONSTIGE;
}

/**
 * Get all available Einsatzlogik options for an industry
 * @param industrySegment Industry code
 * @returns Array of {code, label} objects for dropdown UI
 *
 * @example
 * const options = getEinsatzlogikOptionsForIndustry('INDUSTRIESERVICE');
 * // Returns: [{code: 'REAKTIVER_FIELD_SERVICE', label: 'Reaktiver Field Service'}, ...]
 */
export function getEinsatzlogikOptionsForIndustry(
  industrySegment: string
): Array<{ code: string; label: string }> {
  const industry = industrySegment as keyof typeof EINSATZLOGIK_OPTIONS;

  if (!(industry in EINSATZLOGIK_OPTIONS)) {
    return []; // No sub-segments for this industry
  }

  // Return the options for this industry
  return EINSATZLOGIK_OPTIONS[industry] as Array<{ code: string; label: string }>;
}

/**
 * Get the margin thresholds for a specific industry+einsatzlogik combo
 * Uses the mid-point of target_margin_pct as the benchmark
 * @param industrySegment Industry code
 * @param einsatzlogik Optional operational context
 * @returns Margin target [low, mid, high] as [0.08, 0.09, 0.10]
 */
export function getMarginTargetsForCustomer(
  industrySegment: string,
  einsatzlogik?: string
): [number, number, number] | null {
  const targets = getTargetsForCustomer(industrySegment, einsatzlogik);
  return targets.target_margin_pct || null;
}

/**
 * Get the hourly rate targets for an industry
 * Used for Seite 1 Stundensatz KPI calculation
 * @param industrySegment Industry code
 * @param einsatzlogik Optional operational context
 * @returns Hourly rate target [low, mid, high] in EUR
 */
export function getHourlyRateTargets(
  industrySegment: string,
  einsatzlogik?: string
): [number, number, number] | null {
  const targets = getTargetsForCustomer(industrySegment, einsatzlogik);
  return targets.target_hourly_rate || null;
}

/**
 * Get payroll cost percentage targets for an industry
 * Used for Seite 1 Personalkostenquote KPI
 * @param industrySegment Industry code
 * @param einsatzlogik Optional operational context
 * @returns Payroll cost quota [low, mid, high] as [0.45, 0.50, 0.55]
 */
export function getPayrollCostTargets(
  industrySegment: string,
  einsatzlogik?: string
): [number, number, number] | null {
  const targets = getTargetsForCustomer(industrySegment, einsatzlogik);
  return targets.target_payroll_cost_pct || null;
}

/**
 * Get contribution margin targets (for B2B_CONTRACTING)
 * @param industrySegment Industry code
 * @param einsatzlogik Optional operational context
 * @returns Contribution margin [low, mid, high] as [0.30, 0.325, 0.35]
 */
export function getContributionMarginTargets(
  industrySegment: string,
  einsatzlogik?: string
): [number, number, number] | null {
  const targets = getTargetsForCustomer(industrySegment, einsatzlogik);
  return targets.target_contribution_margin_pct || null;
}

// ============================================================================
// Status Colors & Thresholds
// ============================================================================

export const STATUS_COLORS = {
  GREEN: 'GREEN',
  YELLOW: 'YELLOW',
  RED: 'RED',
  CRITICAL: 'CRITICAL',
} as const;

export const MARGIN_THRESHOLDS = {
  CRITICAL: 0.02, // < 2% = Kritisch (rot)
  WARNING: 0.07, // 2% - 7% = Warnung (gelb)
  OK: 0.12, // 7% - 12% = Okay (grün)
  // > 12% = Sehr gut (dunkelgrün)
} as const;

export const LIQUIDITY_THRESHOLDS = {
  CRITICAL: 0.5, // < 0.5 months = Liquiditätskrise
  WARNING: 1.5, // 0.5 - 1.5 months = Warnung
  OK: 3, // 1.5 - 3 months = Okay
  // > 3 months = Komfortabel
} as const;

// ============================================================================
// Navigation & Routes
// ============================================================================

export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  RESET_PASSWORD: '/reset-password',
  DASHBOARD: '/dashboard',
  ADMIN: '/dashboard/admin',
  NOT_FOUND: '/404',
} as const;

// ============================================================================
// Feature Flags
// ============================================================================

export const FEATURES = {
  ENABLE_TRACKER: true,
  ENABLE_PDF_EXPORT: true,
  ENABLE_ADMIN_PANEL: true,
  ENABLE_AUDIT_LOG: true,
  ENABLE_BENCHMARKS: true,
} as const;

// ============================================================================
// Date & Time Configuration
// ============================================================================

export const LOCALE = 'de-DE';

export const DATE_FORMAT = {
  SHORT: 'dd.MM.yyyy', // 01.04.2026
  LONG: 'EEEE, dd. MMMM yyyy', // Montag, 01. April 2026
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx", // ISO 8601
} as const;

export const MONTH_NAMES_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
] as const;

export const MONTH_NAMES_SHORT_DE = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
] as const;

// ============================================================================
// Numeric Formatting
// ============================================================================

export const CURRENCY_FORMATTER = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const PERCENTAGE_FORMATTER = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const NUMBER_FORMATTER = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// ============================================================================
// Utility Functions
// ============================================================================

export function getIndustryLabel(code: keyof typeof INDUSTRY_SEGMENTS): string {
  return INDUSTRY_SEGMENTS[code]?.label || 'Unbekannt';
}

export function getEinsatzlogikLabel(
  industrySegment: string,
  einsatzlogikCode: string
): string {
  const industry = industrySegment as keyof typeof EINSATZLOGIK_OPTIONS;
  if (!(industry in EINSATZLOGIK_OPTIONS)) {
    return einsatzlogikCode; // Fallback to code if not found
  }

  const options = EINSATZLOGIK_OPTIONS[industry] as Array<{ code: string; label: string }>;
  const found = options.find((opt) => opt.code === einsatzlogikCode);
  return found?.label || einsatzlogikCode;
}

export function getPageLabel(pageId: number): string {
  return PAGE_NAMES[pageId] || 'Unbekannt';
}

export function getBenchmarkProfile(industryCode: string): string {
  // Industry code → Apps Script benchmark profile key
  const mapping: Record<string, string> = {
    B2B_CONTRACTING: 'b2b_contracting',
    INDUSTRIESERVICE: 'industrienahe_services',
    TECHN_WARTUNG: 'technische_wartung',
    HANDWERK: 'handwerk',
    SONSTIGE: 'sonstige',
  };
  return mapping[industryCode] || 'default';
}

export function isValidPage(pageId: unknown): pageId is 1 | 2 | 3 | 4 | 5 {
  return PAGES_ARRAY.includes(pageId as never);
}

export function formatCurrency(value: number): string {
  return CURRENCY_FORMATTER.format(value);
}

export function formatPercentage(value: number): string {
  return PERCENTAGE_FORMATTER.format(value);
}

export function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

export function getMonthNameDe(monthIndex: number): string {
  return MONTH_NAMES_DE[monthIndex % 12] || 'Jan';
}

export function getMonthNameShortDe(monthIndex: number): string {
  return MONTH_NAMES_SHORT_DE[monthIndex % 12] || 'Jan';
}

// Parse period string YYYY_MM or YYYY-MM to Date
export function parsePeriod(period: string): Date | null {
  const normalized = period.replace(/_/g, '-');
  const match = normalized.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const [, year, month] = match;
  return new Date(Number(year), Number(month) - 1, 1);
}

// Format Date to period string YYYY_MM
export function formatPeriod(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}_${month}`;
}

// ============================================================================
// Error Messages (Localized)
// ============================================================================

export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Authentifizierung erforderlich',
  FORBIDDEN: 'Zugriff verweigert',
  NOT_FOUND: 'Nicht gefunden',
  VALIDATION_ERROR: 'Validierungsfehler',
  NETWORK_ERROR: 'Netzwerkfehler',
  TIMEOUT: 'Anfrage hat das Zeitlimit überschritten',
  INTERNAL_ERROR: 'Interner Fehler',
  APPS_SCRIPT_ERROR: 'Apps Script Fehler',
} as const;

// ============================================================================
// Success Messages (Localized)
// ============================================================================

export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Erfolgreich angemeldet',
  LOGOUT_SUCCESS: 'Erfolgreich abgemeldet',
  SAVE_SUCCESS: 'Änderungen gespeichert',
  DELETE_SUCCESS: 'Gelöscht',
  CREATE_SUCCESS: 'Erstellt',
  UPDATE_SUCCESS: 'Aktualisiert',
} as const;
