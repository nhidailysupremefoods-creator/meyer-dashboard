# Configuration Validation & Type Safety

## Type Definitions

The configuration uses TypeScript interfaces to ensure type safety:

### KPITargets Interface

```typescript
export interface KPITargets {
  target_margin_pct?: [number, number, number];         // [low, mid, high]
  target_hourly_rate?: [number, number, number];
  target_payroll_cost_pct?: [number, number, number];
  target_contribution_margin_pct?: [number, number, number];
  sla_cost_quota_pct?: [number, number, number];
  hour_variance_pct?: number;                            // Single value: ±X%
  cost_variance_pct?: number;                            // Single value: <X%
  productivity_hours_low?: number;
  productivity_hours_target?: number;
  productivity_hours_high?: number;
}
```

### Industry & Einsatzlogik Types

```typescript
export const INDUSTRY_SEGMENTS = {
  B2B_CONTRACTING: { label: string, code: string },
  INDUSTRIESERVICE: { label: string, code: string },
  TECHN_WARTUNG: { label: string, code: string },
  HANDWERK: { label: string, code: string },
  SONSTIGE: { label: string, code: string },
} as const;

type IndustrySegment = keyof typeof INDUSTRY_SEGMENTS;
// "B2B_CONTRACTING" | "INDUSTRIESERVICE" | "TECHN_WARTUNG" | "HANDWERK" | "SONSTIGE"

export const EINSATZLOGIK_OPTIONS = {
  INDUSTRIESERVICE: [
    { code: string, label: string },
    // ... 3 options
  ],
  TECHN_WARTUNG: [
    { code: string, label: string },
    // ... 3 options
  ],
  B2B_CONTRACTING: [
    { code: string, label: string },
    // ... 3 options
  ],
} as const;

type EinsatzlogikCode = keyof typeof EINSATZLOGIK_OPTIONS[keyof typeof EINSATZLOGIK_OPTIONS];
```

---

## Configuration Structure Validation

### BENCHMARK_CONFIG Requirements

Each industry must have a `DEFAULT` entry:

```
✓ INDUSTRIESERVICE.DEFAULT       — Fallback when no Einsatzlogik specified
✓ TECHN_WARTUNG.DEFAULT          — Fallback when no Einsatzlogik specified
✓ B2B_CONTRACTING.DEFAULT        — Fallback when no Einsatzlogik specified
✓ HANDWERK.DEFAULT               — Only sub-segment
✓ SONSTIGE.DEFAULT               — Only sub-segment
```

### Einsatzlogik Counts

```
INDUSTRIESERVICE:      3 options + 1 DEFAULT = 4 entries ✓
TECHN_WARTUNG:         3 options + 1 DEFAULT = 4 entries ✓
B2B_CONTRACTING:       3 options + 1 DEFAULT = 4 entries ✓
HANDWERK:              1 DEFAULT only = 1 entry ✓
SONSTIGE:              1 DEFAULT only = 1 entry ✓
```

---

## Data Value Ranges

All configurations must follow these constraints:

### Margin Targets (target_margin_pct)

| Industry | Einsatzlogik | Low | Mid | High | ✓ Valid |
|----------|---|------|-------|------|--------|
| INDUSTRIESERVICE | REAKTIVER | 0.10 | 0.11 | 0.12 | ✓ |
| INDUSTRIESERVICE | GEPLANTER | 0.12 | 0.135 | 0.15 | ✓ |
| INDUSTRIESERVICE | SPEZIAL | 0.15 | 0.165 | 0.18 | ✓ |
| TECHN_WARTUNG | STANDARD | 0.12 | 0.135 | 0.15 | ✓ |
| TECHN_WARTUNG | SLA | 0.15 | 0.165 | 0.18 | ✓ |
| TECHN_WARTUNG | ZUSATZ | 0.16 | 0.18 | 0.20 | ✓ |
| B2B_CONTRACTING | BETRIEB | 0.08 | 0.09 | 0.10 | ✓ |
| B2B_CONTRACTING | ENERGIE | 0.09 | 0.105 | 0.12 | ✓ |
| B2B_CONTRACTING | PRODUKTION | 0.10 | 0.11 | 0.12 | ✓ |

**Rule:** `low < mid < high` and all values in [0.0, 1.0]

### Hourly Rate Targets (target_hourly_rate)

All values in EUR, expected ranges:

| Range | Description |
|-------|-------------|
| 70–100€ | Handwerk, basic services |
| 85–120€ | Standard maintenance, field service |
| 120–180€ | Specialized, high-value services |

**Rule:** Hourly rates must be positive and reasonable (20–300€)

### Payroll Cost Targets (target_payroll_cost_pct)

All values as decimals [0.0, 1.0], typical range [0.35, 0.65]:

| Range | Description |
|-------|-------------|
| 35–45% | B2B outsourcing, low-labor models |
| 45–55% | Standard services, mixed labor |
| 50–60% | High-labor field services |

**Rule:** All values in [0.0, 1.0], mid-point ≤ high-point

### Variance Tolerance (hour_variance_pct, cost_variance_pct)

Single decimal values, typical [0.01, 0.20]:

| Value | Meaning |
|-------|---------|
| 0.05 | ±5% tolerance |
| 0.10 | ±10% tolerance |

**Rule:** All values should be positive and ≤ 0.25 (>25% is unrealistic)

---

## Validation Tests

Run these checks to verify configuration integrity:

### 1. TypeScript Compilation

```bash
npx tsc --noEmit
# Should complete without errors
```

### 2. Import Verification

```typescript
import {
  BENCHMARK_CONFIG,
  EINSATZLOGIK_OPTIONS,
  getTargetsForCustomer,
  getEinsatzlogikOptionsForIndustry,
} from '@/lib/config';

// Should compile without errors
const targets = getTargetsForCustomer('INDUSTRIESERVICE', 'REAKTIVER_FIELD_SERVICE');
console.log(targets.target_margin_pct?.[1]); // 0.11
```

### 3. Data Integrity Check

```typescript
function validateBenchmarkConfig() {
  const errors = [];

  // Check each industry
  for (const [industry, einsatzData] of Object.entries(BENCHMARK_CONFIG)) {
    // Must have DEFAULT
    if (!('DEFAULT' in einsatzData)) {
      errors.push(`${industry} missing DEFAULT entry`);
    }

    // Check each einsatzlogik
    for (const [einsatz, targets] of Object.entries(einsatzData)) {
      const margin = targets.target_margin_pct;
      if (margin && !(margin[0] < margin[1] && margin[1] < margin[2])) {
        errors.push(
          `${industry}.${einsatz} margin not strictly increasing: ` +
          `${margin[0]} < ${margin[1]} < ${margin[2]}`
        );
      }

      const hourly = targets.target_hourly_rate;
      if (hourly && (hourly[0] < 20 || hourly[2] > 500)) {
        errors.push(
          `${industry}.${einsatz} hourly rate out of range: ` +
          `${hourly[0]}–${hourly[2]}`
        );
      }

      const payroll = targets.target_payroll_cost_pct;
      if (payroll && (payroll[0] < 0 || payroll[2] > 1)) {
        errors.push(
          `${industry}.${einsatz} payroll out of range: ` +
          `${(payroll[0]*100).toFixed(0)}%–${(payroll[2]*100).toFixed(0)}%`
        );
      }
    }
  }

  return errors.length === 0
    ? { valid: true, message: 'All checks passed ✓' }
    : { valid: false, errors };
}
```

### 4. Function Behavior Tests

```typescript
describe('getTargetsForCustomer', () => {
  it('returns specific targets when einsatzlogik provided', () => {
    const targets = getTargetsForCustomer('INDUSTRIESERVICE', 'REAKTIVER_FIELD_SERVICE');
    expect(targets.target_margin_pct).toEqual([0.10, 0.11, 0.12]);
  });

  it('falls back to DEFAULT when einsatzlogik not provided', () => {
    const targets = getTargetsForCustomer('INDUSTRIESERVICE');
    expect(targets.target_margin_pct).toEqual([0.12, 0.135, 0.15]);
    // Should equal GEPLANTER_IH_SERVICE (default)
  });

  it('falls back to legacy config for unknown industry', () => {
    const targets = getTargetsForCustomer('UNKNOWN_INDUSTRY');
    expect(targets).toBeDefined();
    expect(targets.target_margin_pct).toBeDefined();
  });

  it('returns empty array for industries without einsatzlogik options', () => {
    const options = getEinsatzlogikOptionsForIndustry('HANDWERK');
    expect(options).toEqual([]);
  });

  it('returns 3 options for INDUSTRIESERVICE', () => {
    const options = getEinsatzlogikOptionsForIndustry('INDUSTRIESERVICE');
    expect(options).toHaveLength(3);
    expect(options[0].code).toBe('REAKTIVER_FIELD_SERVICE');
    expect(options[1].code).toBe('GEPLANTER_IH_SERVICE');
    expect(options[2].code).toBe('HOCHQUALIFIZIERT_SPECIAL');
  });
});
```

---

## Backward Compatibility Checks

### Legacy Config Still Works

```typescript
import { BENCHMARK_CONFIG_LEGACY } from '@/lib/config';

// Old code should still work (deprecated path)
const oldConfig = BENCHMARK_CONFIG_LEGACY.INDUSTRIESERVICE;
expect(oldConfig.target_margin_pct).toBeDefined();
expect(oldConfig.target_hourly_rate).toBeDefined();

// Values should match old defaults
expect(oldConfig.target_margin_pct).toEqual([0.07, 0.11, 0.16]);
```

### Migration Path Works

```typescript
// Old way
const oldMargin = BENCHMARK_CONFIG_LEGACY.INDUSTRIESERVICE.target_margin_pct[1];
// 0.11

// New way (more precise)
const newMargin = getMarginTargetsForCustomer('INDUSTRIESERVICE', 'REAKTIVER_FIELD_SERVICE')?.[1];
// 0.11 (same for REAKTIVER)

const newMarginPlanned = getMarginTargetsForCustomer('INDUSTRIESERVICE', 'GEPLANTER_IH_SERVICE')?.[1];
// 0.135 (more accurate for planned services)

// Fallback to legacy
const newMarginDefault = getMarginTargetsForCustomer('INDUSTRIESERVICE')?.[1];
// 0.135 (uses DEFAULT which is GEPLANTER_IH_SERVICE)
```

---

## Performance Validation

### Time Complexity

All functions O(1) to O(n) where n ≤ 3:

```typescript
// O(1) — constant time
getTargetsForCustomer('INDUSTRIESERVICE', 'REAKTIVER_FIELD_SERVICE')

// O(1) — array of max 3 items
getEinsatzlogikOptionsForIndustry('INDUSTRIESERVICE')

// O(1) — single label lookup
getEinsatzlogikLabel('INDUSTRIESERVICE', 'REAKTIVER_FIELD_SERVICE')
```

### Memory Usage

```
INDUSTRY_SEGMENTS:        5 entries × ~50 bytes = 250 bytes
EINSATZLOGIK_OPTIONS:    9 entries × ~100 bytes = 900 bytes
BENCHMARK_CONFIG:        13 entries × ~500 bytes = 6.5 KB
BENCHMARK_CONFIG_LEGACY: 5 entries × ~300 bytes = 1.5 KB

Total: ~9 KB (negligible)
```

---

## CSV Export Format (For Spreadsheet Verification)

To verify against the source `Zielwerte_Verifikation.xlsx`:

```
industry,einsatzlogik,margin_low,margin_mid,margin_high,hourly_low,hourly_mid,hourly_high,payroll_low,payroll_mid,payroll_high
INDUSTRIESERVICE,REAKTIVER_FIELD_SERVICE,0.10,0.11,0.12,120,130,140,0.50,0.55,0.60
INDUSTRIESERVICE,GEPLANTER_IH_SERVICE,0.12,0.135,0.15,100,110,120,0.45,0.50,0.55
INDUSTRIESERVICE,HOCHQUALIFIZIERT_SPECIAL,0.15,0.165,0.18,140,160,180,0.40,0.45,0.50
TECHN_WARTUNG,STANDARD_WARTUNG,0.12,0.135,0.15,85,90,95,0.45,0.475,0.50
TECHN_WARTUNG,SLA_INTENSIVE_WARTUNG,0.15,0.165,0.18,95,102.5,110,0.50,0.525,0.55
TECHN_WARTUNG,WARTUNG_ZUSATZLEISTUNG,0.16,0.18,0.20,100,110,120,0.45,0.475,0.50
B2B_CONTRACTING,BETRIEBSFUEHRUNG_OUTSOURCING,0.08,0.09,0.10,,,0.35,0.40,0.45
B2B_CONTRACTING,ENERGIE_CONTRACTING,0.09,0.105,0.12,,,0.35,0.40,0.45
B2B_CONTRACTING,PRODUKTIONSNAHE_SERVICES,0.10,0.11,0.12,,,0.45,0.50,0.55
HANDWERK,DEFAULT,0.08,0.13,0.18,70,85,100,0.45,0.50,0.60
SONSTIGE,DEFAULT,0.07,0.12,0.17,80,95,110,0.45,0.55,0.65
```

---

## Compliance Checklist

- [ ] All 5 industries have entries
- [ ] INDUSTRIESERVICE, TECHN_WARTUNG, B2B_CONTRACTING each have 4 entries (3 + DEFAULT)
- [ ] HANDWERK, SONSTIGE each have 1 entry (DEFAULT only)
- [ ] All margin ranges strictly increasing [low < mid < high]
- [ ] All hourly rates within 70–180€ range (except B2B which may omit)
- [ ] All payroll percentages in [0.30, 0.65]
- [ ] All variance values in [0.0, 0.25]
- [ ] TypeScript compilation succeeds without errors
- [ ] All utility functions are exported
- [ ] Backward compatibility maintained via BENCHMARK_CONFIG_LEGACY
- [ ] Documentation matches implementation
- [ ] Examples in BENCHMARK_CONFIG_EXAMPLES.md compile and run

---

## Changelog

### Version 1.0 (14.04.2026)
- Initial two-level configuration with Einsatzlogik
- 13 configuration entries (9 with sub-segments + 4 legacy)
- 5 helper functions for KPI target retrieval
- Backward compatibility with legacy flat structure
- Full documentation and examples
