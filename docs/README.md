# KPI Benchmark Configuration Documentation

Complete reference documentation for the Meyer Decision Dashboard KPI target configuration system.

## Quick Links

### Start Here
- **[BENCHMARK_CONFIG_IMPLEMENTATION_SUMMARY.md](../BENCHMARK_CONFIG_IMPLEMENTATION_SUMMARY.md)** — Executive overview, features, and next steps

### Guides & References
- **[BENCHMARK_CONFIG_GUIDE.md](./BENCHMARK_CONFIG_GUIDE.md)** — Complete setup guide with all Einsatzlogik options and KPI values
- **[BENCHMARK_CONFIG_EXAMPLES.md](./BENCHMARK_CONFIG_EXAMPLES.md)** — 10+ practical code examples for integration
- **[CONFIG_VALIDATION.md](./CONFIG_VALIDATION.md)** — Type definitions, validation tests, and compliance checklist
- **[ZIELWERTE_VERIFICATION.md](./ZIELWERTE_VERIFICATION.md)** — Source data verification against `Zielwerte_Verifikation.xlsx`

### Implementation Status
- **[IMPLEMENTATION_COMPLETE.txt](../IMPLEMENTATION_COMPLETE.txt)** — Detailed status report

---

## What Is This?

A **two-level hierarchical KPI target configuration** for the Meyer Decision Dashboard:

1. **Industry Segment** (top level) — 5 categories
2. **Einsatzlogik / Operational Context** (sub-level) — 3 options per industry

This provides precise, context-aware benchmarks for:
- Margin targets
- Hourly rates
- Payroll cost percentages
- Contribution margins (B2B)
- Productivity hours
- Hour/cost variance tolerance

---

## Industries & Einsatzlogik

### INDUSTRIESERVICE (3 sub-segments)
| Einsatzlogik | Margin | Hourly Rate | Payroll | Note |
|---|--------|-----------|---------|------|
| REAKTIVER_FIELD_SERVICE | 10–12% | 120–140€ | 50–60% | Reactive services |
| GEPLANTER_IH_SERVICE | 12–15% | 100–120€ | 45–55% | **DEFAULT** |
| HOCHQUALIFIZIERT_SPECIAL | 15–18% | 140–180€ | 40–50% | High-value |

### TECHN_WARTUNG (3 sub-segments)
| Einsatzlogik | Margin | Hourly Rate | Payroll | Note |
|---|--------|-----------|---------|------|
| STANDARD_WARTUNG | 12–15% | 85–95€ | 45–50% | Standard maintenance |
| SLA_INTENSIVE_WARTUNG | 15–18% | 95–110€ | 50–55% | 24/7 critical |
| WARTUNG_ZUSATZLEISTUNG | 16–20% | 100–120€ | 45–50% | With add-ons |

### B2B_CONTRACTING (3 sub-segments)
| Einsatzlogik | Margin | Contrib. Margin | Payroll | Note |
|---|--------|-----------|---------|------|
| BETRIEBSFUEHRUNG_OUTSOURCING | 8–10% | 30–35% | 35–45% | Operations outsourcing |
| ENERGIE_CONTRACTING | 9–12% | 35–40% | 35–45% | **DEFAULT** Energy contracts |
| PRODUKTIONSNAHE_SERVICES | 10–12% | — | 45–55% | Shift work |

### HANDWERK & SONSTIGE
- No sub-segments
- Use DEFAULT only
- Legacy values preserved for backward compatibility

---

## Key Features

✓ **Precise KPI Targets** — [low, mid, high] ranges per operational context
✓ **Type Safe** — TypeScript `KPITargets` interface
✓ **Helper Functions** — 7 exported functions for easy retrieval
✓ **Backward Compatible** — `BENCHMARK_CONFIG_LEGACY` maintains old structure
✓ **Well Documented** — 5 comprehensive guides + code examples
✓ **Source Verified** — All values match `Zielwerte_Verifikation.xlsx`
✓ **Real Examples** — Includes Gregory's 4 customer accounts

---

## Quick Usage

### Import
```typescript
import {
  getTargetsForCustomer,
  getEinsatzlogikOptionsForIndustry,
  getMarginTargetsForCustomer,
} from '@/lib/config';
```

### Get targets for a customer
```typescript
const targets = getTargetsForCustomer('INDUSTRIESERVICE', 'REAKTIVER_FIELD_SERVICE');
// Returns: {
//   target_margin_pct: [0.10, 0.11, 0.12],
//   target_hourly_rate: [120, 130, 140],
//   target_payroll_cost_pct: [0.50, 0.55, 0.60],
//   ...
// }
```

### Get Einsatzlogik options for dropdown
```typescript
const options = getEinsatzlogikOptionsForIndustry('INDUSTRIESERVICE');
// Returns: [
//   { code: 'REAKTIVER_FIELD_SERVICE', label: 'Reaktiver Field Service' },
//   { code: 'GEPLANTER_IH_SERVICE', label: 'Geplanter Anlagen- & IH-Service' },
//   { code: 'HOCHQUALIFIZIERT_SPECIAL', label: 'Hochqualifizierter Spezialservice' }
// ]
```

### Get specific KPI targets
```typescript
const margins = getMarginTargetsForCustomer('INDUSTRIESERVICE', 'REAKTIVER_FIELD_SERVICE');
// [0.10, 0.11, 0.12]

const hourly = getHourlyRateTargets('TECHN_WARTUNG', 'SLA_INTENSIVE_WARTUNG');
// [95, 102.5, 110]
```

---

## Integration Checklist

### Before Using in Production

- [ ] Read `BENCHMARK_CONFIG_GUIDE.md` (15 min)
- [ ] Review `BENCHMARK_CONFIG_EXAMPLES.md` (20 min)
- [ ] Run `CONFIG_VALIDATION.md` tests (5 min)
- [ ] Database: Add `einsatzlogik` column to `config_eu.customers`
- [ ] Assign Einsatzlogik to existing customers
- [ ] Add dropdown to Admin UI customer form
- [ ] Update Dashboard Seite 1 KPI calculations
- [ ] Update Dashboard Seite 4 benchmark gauges
- [ ] Test with all 4 customer accounts

---

## Gregory's Customers

### INDUSTRIE_GAMMA
- Industry: **INDUSTRIESERVICE**
- Einsatzlogik: **REAKTIVER_FIELD_SERVICE**
- Target Margin: 10–12% | Actual: 4.8% ❌ CRITICAL
- Action: Field services need margin improvement

### WEBER_HAUSTECHNIK
- Industry: **TECHN_WARTUNG**
- Einsatzlogik: **STANDARD_WARTUNG**
- Target Margin: 12–15% | Actual: 2.8% ❌ CRITICAL
- Action: Maintenance pricing too low

### SCHMIDT_ANLAGENBAU
- Industry: **INDUSTRIESERVICE**
- Einsatzlogik: **HOCHQUALIFIZIERT_SPECIAL**
- Target Margin: 15–18% | Actual: 16.9% ✓ EXCELLENT
- Action: Maintain current strategy

### MUSTERMANN_TECHNIK
- Industry: **INDUSTRIESERVICE**
- Einsatzlogik: **GEPLANTER_IH_SERVICE** (DEFAULT)
- Target Margin: 12–15% | Actual: 5.6% ⚠ WARNING
- Action: Improve pricing for planned services

---

## Helper Functions Reference

### Core Function
**`getTargetsForCustomer(industry: string, einsatzlogik?: string): KPITargets`**

Get complete KPI targets. Falls back to DEFAULT if Einsatzlogik not provided.

```typescript
// With Einsatzlogik
getTargetsForCustomer('INDUSTRIESERVICE', 'REAKTIVER_FIELD_SERVICE')
// → Specific targets

// Without Einsatzlogik
getTargetsForCustomer('INDUSTRIESERVICE')
// → DEFAULT targets (GEPLANTER_IH_SERVICE)
```

### Dropdown & Labels
**`getEinsatzlogikOptionsForIndustry(industry: string): Array<{code, label}>`**

Get dropdown options for an industry.

**`getEinsatzlogikLabel(industry: string, code: string): string`**

Get human-readable label for an Einsatzlogik code.

**`getIndustryLabel(code: string): string`**

Get human-readable label for an industry code.

### Specific KPI Getters
**`getMarginTargetsForCustomer(industry: string, einsatzlogik?: string): [n,n,n] | null`**

Get margin targets [low, mid, high].

**`getHourlyRateTargets(industry: string, einsatzlogik?: string): [n,n,n] | null`**

Get hourly rate targets in EUR.

**`getPayrollCostTargets(industry: string, einsatzlogik?: string): [n,n,n] | null`**

Get payroll cost percentage targets.

**`getContributionMarginTargets(industry: string, einsatzlogik?: string): [n,n,n] | null`**

Get contribution margin targets (B2B only).

---

## Type Definitions

### KPITargets Interface
```typescript
interface KPITargets {
  target_margin_pct?: [number, number, number];
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
```

---

## Files Modified

- **`src/lib/config.ts`** — Main configuration file (400+ lines added)
  - New EINSATZLOGIK_OPTIONS constant
  - New two-level BENCHMARK_CONFIG structure
  - 7 new helper functions
  - KPITargets TypeScript interface
  - BENCHMARK_CONFIG_LEGACY for backward compatibility

---

## Documentation Files

| File | Purpose | Read Time |
|------|---------|-----------|
| BENCHMARK_CONFIG_GUIDE.md | Complete setup guide | 15 min |
| BENCHMARK_CONFIG_EXAMPLES.md | Code examples | 20 min |
| CONFIG_VALIDATION.md | Validation & testing | 10 min |
| ZIELWERTE_VERIFICATION.md | Source data verification | 10 min |
| README.md (this file) | Navigation guide | 5 min |

---

## Support

For questions or issues:

1. Check the relevant guide above
2. Search `BENCHMARK_CONFIG_EXAMPLES.md` for similar use cases
3. Review `CONFIG_VALIDATION.md` for troubleshooting
4. Verify data against `ZIELWERTE_VERIFICATION.md`

---

## Version & Status

- **Version:** 1.0
- **Date:** 14.04.2026
- **Source:** `Zielwerte_Verifikation.xlsx` (Einsatz-KPIs Detail tab)
- **Status:** ✓ COMPLETE — Ready for production integration

---

Last updated: 14.04.2026
