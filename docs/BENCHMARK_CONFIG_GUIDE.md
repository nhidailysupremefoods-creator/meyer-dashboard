# KPI Benchmark Configuration Guide

## Overview

The Meyer Decision Dashboard now uses a **two-level benchmark configuration** that combines **Industry Segments** with **Einsatzlogik** (operational context) to provide precise KPI targets for each customer profile.

**Source Data**: `Zielwerte_Verifikation.xlsx` — "Einsatz-KPIs Detail" tab
**Configuration File**: `/src/lib/config.ts`

---

## Structure

### 1. Industry Segments (Top Level)

Five main industry classifications:

| Code | Label | Einsatzlogik Options |
|------|-------|----------------------|
| `B2B_CONTRACTING` | B2B-Serviceunternehmen | 3 sub-segments |
| `INDUSTRIESERVICE` | Industrienahe Service- & Wartung | 3 sub-segments |
| `TECHN_WARTUNG` | Technische Wartungsbetriebe | 3 sub-segments |
| `HANDWERK` | Handwerk | None (uses DEFAULT) |
| `SONSTIGE` | Sonstige | None (uses DEFAULT) |

### 2. Einsatzlogik (Operational Context)

Sub-segments that refine KPI targets within each industry. Only available for the three primary industries.

#### INDUSTRIESERVICE (Industrienahe Service- & Wartung)
1. **REAKTIVER_FIELD_SERVICE** — Reaktiver Field Service (responsive on-demand services)
   - Margin: 10–12%
   - Hourly Rate: 120–140€
   - Payroll Cost: 50–60%
   - Hour Variance: ±10%

2. **GEPLANTER_IH_SERVICE** — Geplanter Anlagen- & IH-Service (planned maintenance)
   - Margin: 12–15%
   - Hourly Rate: 100–120€
   - Payroll Cost: 45–55%
   - Hour Variance: ±5%

3. **HOCHQUALIFIZIERT_SPECIAL** — Hochqualifizierter Spezialservice (specialized services)
   - Margin: 15–18%
   - Hourly Rate: 140–180€
   - Payroll Cost: 40–50%
   - Hour Variance: ±5%

#### TECHN_WARTUNG (Technische Wartungsbetriebe)
1. **STANDARD_WARTUNG** — Standard-Wartung (HLK, Aufzüge, BMA)
   - Margin: 12–15%
   - Hourly Rate: 85–95€
   - Payroll Cost: 45–50%
   - Hour Variance: ±5%

2. **SLA_INTENSIVE_WARTUNG** — SLA-intensive Wartung (KRITIS, 24/7)
   - Margin: 15–18%
   - Hourly Rate: 95–110€
   - Payroll Cost: 50–55%
   - Hour Variance: ±10%

3. **WARTUNG_ZUSATZLEISTUNG** — Wartung + Zusatzleistungen (maintenance + services)
   - Margin: 16–20%
   - Hourly Rate: 100–120€
   - Payroll Cost: 45–50%
   - Hour Variance: ±5%

#### B2B_CONTRACTING (B2B-Serviceunternehmen)
1. **BETRIEBSFUEHRUNG_OUTSOURCING** — Betriebsführungs-Outsourcing (ohne Invest)
   - Margin: 8–10%
   - Contribution Margin: 30–35%
   - Payroll Cost: 35–45%

2. **ENERGIE_CONTRACTING** — Energie-Contracting (mit CAPEX)
   - Margin: 9–12%
   - Contribution Margin: 35–40%
   - Payroll Cost: 35–45%
   - Cost Variance: < 5%

3. **PRODUKTIONSNAHE_SERVICES** — Produktionsnahe Services (Schichtbetrieb)
   - Margin: 10–12%
   - Payroll Cost: 45–55%
   - SLA Cost Quota: 5–10%

---

## KPI Target Values Format

Each Einsatzlogik combination has targets in the format `[low, mid, high]`:

```typescript
INDUSTRIESERVICE: {
  REAKTIVER_FIELD_SERVICE: {
    target_margin_pct: [0.10, 0.11, 0.12],    // 10–12%
    target_hourly_rate: [120, 130, 140],       // 120–140€
    target_payroll_cost_pct: [0.50, 0.55, 0.60], // 50–60%
    hour_variance_pct: 0.10,                   // ±10%
    productivity_hours_low: 1300,
    productivity_hours_target: 1500,
    productivity_hours_high: 1700,
  },
  // ... other Einsatzlogik options ...
  DEFAULT: { /* falls back to GEPLANTER_IH_SERVICE values */ }
}
```

### Value Meanings

- **`target_margin_pct`**: Contract margin range (revenue – direct costs) / revenue
- **`target_hourly_rate`**: Billable rate per productive hour in EUR
- **`target_payroll_cost_pct`**: Personnel costs / revenue
- **`target_contribution_margin_pct`**: (Revenue – variable costs) / revenue (B2B only)
- **`sla_cost_quota_pct`**: Cost quota for SLA commitments (B2B only)
- **`hour_variance_pct`**: Allowed tolerance for hour estimation errors (±)
- **`cost_variance_pct`**: Allowed tolerance for cost estimates (< X%)
- **`productivity_hours_*`**: Annual productive hours [low, target, high]

---

## Usage

### Get Targets for a Customer

```typescript
import {
  getTargetsForCustomer,
  getEinsatzlogikOptionsForIndustry,
  getMarginTargetsForCustomer,
  getHourlyRateTargets,
  getPayrollCostTargets,
} from '@/lib/config';

// Get targets with Einsatzlogik
const targets = getTargetsForCustomer('INDUSTRIESERVICE', 'REAKTIVER_FIELD_SERVICE');
// Returns: { target_margin_pct: [0.10, 0.11, 0.12], ... }

// Get targets without Einsatzlogik (uses DEFAULT)
const defaultTargets = getTargetsForCustomer('INDUSTRIESERVICE');
// Returns: middle option targets (GEPLANTER_IH_SERVICE)

// Get specific KPI targets
const margins = getMarginTargetsForCustomer('INDUSTRIESERVICE', 'REAKTIVER_FIELD_SERVICE');
// Returns: [0.10, 0.11, 0.12]

const hourlyRates = getHourlyRateTargets('TECHN_WARTUNG', 'SLA_INTENSIVE_WARTUNG');
// Returns: [95, 102.5, 110]
```

### Display Einsatzlogik Options in Admin UI

```typescript
import { getEinsatzlogikOptionsForIndustry } from '@/lib/config';

// Render dropdown options
const options = getEinsatzlogikOptionsForIndustry('INDUSTRIESERVICE');
// Returns:
// [
//   { code: 'REAKTIVER_FIELD_SERVICE', label: 'Reaktiver Field Service' },
//   { code: 'GEPLANTER_IH_SERVICE', label: 'Geplanter Anlagen- & IH-Service' },
//   { code: 'HOCHQUALIFIZIERT_SPECIAL', label: 'Hochqualifizierter Spezialservice' }
// ]
```

### Format Einsatzlogik Label

```typescript
import { getEinsatzlogikLabel } from '@/lib/config';

const label = getEinsatzlogikLabel('INDUSTRIESERVICE', 'REAKTIVER_FIELD_SERVICE');
// Returns: "Reaktiver Field Service"
```

---

## Dashboard Integration

### Seite 1 (Gesamtlage)

KPI calculations now use Einsatzlogik-specific targets:

- **Margin**: `actual_margin_pct` vs. `target_margin_pct[1]` (mid-point)
- **Stundensatz**: `actual_hourly_rate` vs. `target_hourly_rate[1]`
- **Personalkostenquote**: `actual_payroll_pct` vs. `target_payroll_cost_pct[1]`

Status color logic:
- 🟢 Green: Within [low, high] range or above high
- 🟡 Yellow: Below low but above critical threshold
- 🔴 Red: Below critical (< low – tolerance)

### Seite 4 (Maßnahmen / Action Focus)

KPI benchmarks use Einsatzlogik targets for:
- Productivity hours comparison
- Cost efficiency metrics
- Hour estimation variance tracking

### Admin UI (Customers Tab)

New fields when creating/editing customers:
1. **Industry Segment** dropdown (required)
2. **Einsatzlogik** dropdown (optional, populated based on selected industry)

---

## Backward Compatibility

### Legacy Config (`BENCHMARK_CONFIG_LEGACY`)

For code that still references the flat industry structure:

```typescript
// Old code (still works via fallback):
const targets = getTargetsForCustomer('INDUSTRIESERVICE');
// Automatically uses DEFAULT (which is GEPLANTER_IH_SERVICE)

// Flat access pattern (deprecated but supported):
const margin = BENCHMARK_CONFIG_LEGACY.INDUSTRIESERVICE.target_margin_pct;
// Returns: [0.07, 0.11, 0.16] (old values for backward compatibility)
```

### Migration Path

If existing code directly references `BENCHMARK_CONFIG`:

**Before:**
```typescript
const config = BENCHMARK_CONFIG['INDUSTRIESERVICE'];
```

**After (new):**
```typescript
const config = getTargetsForCustomer('INDUSTRIESERVICE', customerEinsatzlogik);
```

**Or (legacy fallback):**
```typescript
const config = BENCHMARK_CONFIG_LEGACY['INDUSTRIESERVICE'];
```

---

## Database Schema Expectations

### `config_eu.customers` Table

Should include:

```
customer_id: string
industry_segment: string (e.g., 'INDUSTRIESERVICE')
einsatzlogik: string? (optional, e.g., 'REAKTIVER_FIELD_SERVICE')
...
```

### Apps Script Integration

In Dashboard.gs, when building customer KPI data:

```javascript
// Get targets from config
const targets = getTargetsForCustomer(customer.industry_segment, customer.einsatzlogik);

// Use mid-point values for benchmarking
const target_margin = targets.target_margin_pct[1]; // 0.11 for REAKTIVER_FIELD_SERVICE
const target_hourly_rate = targets.target_hourly_rate[1]; // 130€
```

---

## Examples from Gregory's Customers

### INDUSTRIE_GAMMA
- **Industry**: INDUSTRIESERVICE
- **Einsatzlogik**: REAKTIVER_FIELD_SERVICE (field service, reactive)
- **Target Margin**: 10–12% (actual: 4.8% ❌ critical)
- **Target Hourly Rate**: 120–140€
- **Target Payroll Cost**: 50–60%

### WEBER_HAUSTECHNIK
- **Industry**: TECHN_WARTUNG
- **Einsatzlogik**: STANDARD_WARTUNG (planned maintenance)
- **Target Margin**: 12–15% (actual: 2.8% ❌ critical)
- **Target Hourly Rate**: 85–95€
- **Target Payroll Cost**: 45–50%

### SCHMIDT_ANLAGENBAU
- **Industry**: INDUSTRIESERVICE
- **Einsatzlogik**: HOCHQUALIFIZIERT_SPECIAL (specialized, high-value)
- **Target Margin**: 15–18% (actual: 16.9% ✅ excellent)
- **Target Hourly Rate**: 140–180€
- **Target Payroll Cost**: 40–50%

---

## Testing Checklist

- [ ] All Einsatzlogik codes load without errors
- [ ] `getTargetsForCustomer()` returns correct values
- [ ] DEFAULT fallback works when Einsatzlogik not provided
- [ ] Legacy `BENCHMARK_CONFIG_LEGACY` values unchanged
- [ ] Admin UI Einsatzlogik dropdown populates correctly
- [ ] KPI benchmarks in Seite 1 use mid-point values
- [ ] Margin color logic still works (🟢🟡🔴)
- [ ] PDF export includes Einsatzlogik in advisory section
- [ ] TypeScript types compile without errors

---

## Files Modified

- `/src/lib/config.ts` — Main configuration file with new structure
- `/src/components/admin/CustomersTab.tsx` — Add Einsatzlogik dropdown
- `/src/pages/dashboard/seite-1.tsx` — Use Einsatzlogik-specific targets
- `/src/pages/dashboard/seite-4.tsx` — Update benchmark comparison

---

## Questions?

Refer to the `Zielwerte_Verifikation.xlsx` spreadsheet for source data verification.
