# KPI Benchmark Configuration — Practical Examples

## Quick Reference

### Import Statements

```typescript
import {
  INDUSTRY_SEGMENTS,
  EINSATZLOGIK_OPTIONS,
  BENCHMARK_CONFIG,
  BENCHMARK_CONFIG_LEGACY,
  getTargetsForCustomer,
  getEinsatzlogikOptionsForIndustry,
  getEinsatzlogikLabel,
  getMarginTargetsForCustomer,
  getHourlyRateTargets,
  getPayrollCostTargets,
  getContributionMarginTargets,
  KPITargets,
} from '@/lib/config';
```

---

## Example 1: Display Industry Dropdown (Admin UI)

Show all available industries when creating a new customer:

```typescript
import { INDUSTRY_SEGMENTS } from '@/lib/config';

function IndustrySelect() {
  return (
    <select>
      <option value="">-- Branche wählen --</option>
      {Object.entries(INDUSTRY_SEGMENTS).map(([code, industry]) => (
        <option key={code} value={code}>
          {industry.label}
        </option>
      ))}
    </select>
  );
}
```

**Output:**
```
-- Branche wählen --
B2B-Serviceunternehmen
Industrienahe Service- & Wartung
Technische Wartungsbetriebe
Handwerk
Sonstige
```

---

## Example 2: Conditional Einsatzlogik Dropdown

Show Einsatzlogik options only for industries that have them:

```typescript
import {
  getEinsatzlogikOptionsForIndustry,
  EINSATZLOGIK_OPTIONS
} from '@/lib/config';

function CustomerForm() {
  const [industry, setIndustry] = useState('');
  const einsatzlogikOptions = getEinsatzlogikOptionsForIndustry(industry);

  return (
    <>
      <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
        {/* industry dropdown */}
      </select>

      {einsatzlogikOptions.length > 0 && (
        <select>
          <option value="">-- Einsatzlogik wählen (optional) --</option>
          {einsatzlogikOptions.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </>
  );
}
```

**Behavior:**
- User selects `INDUSTRIESERVICE` → Dropdown shows 3 options
- User selects `HANDWERK` → No dropdown (uses DEFAULT)
- User selects `SONSTIGE` → No dropdown (uses DEFAULT)

---

## Example 3: Display KPI Targets on Seite 1

Show benchmark targets for the current customer:

```typescript
import { getTargetsForCustomer } from '@/lib/config';

function KPIBenchmarks({ customer }) {
  const targets = getTargetsForCustomer(
    customer.industry_segment,
    customer.einsatzlogik
  );

  const marginTargets = targets.target_margin_pct;    // [0.10, 0.11, 0.12]
  const hourlyTargets = targets.target_hourly_rate;   // [120, 130, 140]
  const payrollTargets = targets.target_payroll_cost_pct; // [0.50, 0.55, 0.60]

  return (
    <div className="benchmarks">
      <h3>KPI-Zielwerte (Einsatzlogik: {customer.einsatzlogik})</h3>

      <div className="kpi-row">
        <label>Marge:</label>
        <span>
          {(marginTargets[0] * 100).toFixed(0)}%–{(marginTargets[2] * 100).toFixed(0)}%
          <small>(Ziel: {(marginTargets[1] * 100).toFixed(0)}%)</small>
        </span>
      </div>

      <div className="kpi-row">
        <label>Stundensatz:</label>
        <span>
          {hourlyTargets[0]}–{hourlyTargets[2]}€
          <small>(Ziel: {hourlyTargets[1]}€)</small>
        </span>
      </div>

      <div className="kpi-row">
        <label>Personalkostenquote:</label>
        <span>
          {(payrollTargets[0] * 100).toFixed(0)}%–{(payrollTargets[2] * 100).toFixed(0)}%
          <small>(Ziel: {(payrollTargets[1] * 100).toFixed(0)}%)</small>
        </span>
      </div>
    </div>
  );
}
```

**Output for INDUSTRIESERVICE / REAKTIVER_FIELD_SERVICE:**
```
KPI-Zielwerte (Einsatzlogik: REAKTIVER_FIELD_SERVICE)

Marge:
10%–12%
(Ziel: 11%)

Stundensatz:
120–140€
(Ziel: 130€)

Personalkostenquote:
50%–60%
(Ziel: 55%)
```

---

## Example 4: Calculate KPI Status Colors

Determine if a KPI is Green/Yellow/Red based on targets:

```typescript
import { getTargetsForCustomer, getMarginTargetsForCustomer } from '@/lib/config';

function getKPIStatus(actual: number, targets: [number, number, number]) {
  const [low, mid, high] = targets;

  if (actual >= mid) {
    return actual >= high ? 'excellent' : 'green';  // 🟢
  } else if (actual >= low) {
    return 'yellow';  // 🟡
  } else {
    return 'red';     // 🔴
  }
}

function KPIDisplay({ customer, actualMargin }) {
  const marginTargets = getMarginTargetsForCustomer(
    customer.industry_segment,
    customer.einsatzlogik
  );

  if (!marginTargets) return null;

  const status = getKPIStatus(actualMargin, marginTargets);

  return (
    <div className={`kpi-status ${status}`}>
      Marge: {(actualMargin * 100).toFixed(1)}%
      <span className="badge">{status.toUpperCase()}</span>
    </div>
  );
}
```

**Scenarios:**

| Customer | Einsatzlogik | Target | Actual | Status |
|----------|---|---------|--------|--------|
| INDUSTRIE_GAMMA | REAKTIVER_FIELD_SERVICE | [0.10, 0.11, 0.12] | 0.048 | 🔴 Red |
| WEBER_HAUSTECHNIK | STANDARD_WARTUNG | [0.12, 0.135, 0.15] | 0.028 | 🔴 Red |
| SCHMIDT_ANLAGENBAU | HOCHQUALIFIZIERT_SPECIAL | [0.15, 0.165, 0.18] | 0.169 | 🟢 Green |

---

## Example 5: API Response with Targets

Return KPI targets when fetching customer data:

```typescript
// Backend (Dashboard.gs or API)
function getCustomerWithTargets(customerId: string) {
  const customer = getCustomerFromDB(customerId);
  const targets = getTargetsForCustomer(
    customer.industry_segment,
    customer.einsatzlogik
  );

  return {
    ...customer,
    kpi_targets: targets,
    einsatzlogik_label: getEinsatzlogikLabel(
      customer.industry_segment,
      customer.einsatzlogik
    ),
  };
}

// Frontend usage
async function loadDashboard(customerId: string) {
  const response = await fetch(`/api/customers/${customerId}`);
  const customer = await response.json();

  // customer.kpi_targets is now available:
  // {
  //   target_margin_pct: [0.10, 0.11, 0.12],
  //   target_hourly_rate: [120, 130, 140],
  //   ...
  // }
}
```

---

## Example 6: Render Benchmark Comparison (Seite 4)

Compare actual KPIs against industry benchmarks:

```typescript
import { getHourlyRateTargets, getPayrollCostTargets } from '@/lib/config';

function BenchmarkComparison({ customer, actualData }) {
  const hourlyRateTargets = getHourlyRateTargets(
    customer.industry_segment,
    customer.einsatzlogik
  );
  const payrollTargets = getPayrollCostTargets(
    customer.industry_segment,
    customer.einsatzlogik
  );

  const [hourlyLow, hourlyMid, hourlyHigh] = hourlyRateTargets || [0, 0, 0];
  const [payrollLow, payrollMid, payrollHigh] = payrollTargets || [0, 0, 0];

  return (
    <div className="benchmark-gauges">
      <Gauge
        label="Stundensatz"
        actual={actualData.hourly_rate}
        low={hourlyLow}
        target={hourlyMid}
        high={hourlyHigh}
        unit="€"
      />

      <Gauge
        label="Personalkostenquote"
        actual={actualData.payroll_pct * 100}
        low={payrollLow * 100}
        target={payrollMid * 100}
        high={payrollHigh * 100}
        unit="%"
      />
    </div>
  );
}

function Gauge({ label, actual, low, target, high, unit }) {
  const gap = actual - target;
  const gapPct = ((gap / target) * 100).toFixed(1);

  return (
    <div className="gauge">
      <h4>{label}</h4>
      <div className="progress-bar">
        <div className="bar-section good" style={{ width: `${(low/high)*100}%` }}>Low</div>
        <div className="bar-section target" style={{ width: `${(target/high)*100}%` }}>Target</div>
        <div className="bar-section high" style={{ width: `${(high/high)*100}%` }}>High</div>
      </div>
      <p>
        Aktuell: <strong>{actual.toFixed(1)}{unit}</strong>
        Ziel: {target.toFixed(1)}{unit}
        Gap: <span className={gap < 0 ? 'red' : 'green'}>{gap > 0 ? '+' : ''}{gapPct}%</span>
      </p>
    </div>
  );
}
```

**Output:**
```
Stundensatz
[████████░░░░░░░░░░░░░]
Aktuell: 95€  Ziel: 130€  Gap: -26.9%

Personalkostenquote
[████░░░░░░░░░░░░░░░░░░]
Aktuell: 58%  Ziel: 55%  Gap: +5.5%
```

---

## Example 7: Form Pre-fill Based on Industry Selection

Auto-populate Einsatzlogik and show relevant targets when industry is selected:

```typescript
import {
  getEinsatzlogikOptionsForIndustry,
  getTargetsForCustomer,
  getEinsatzlogikLabel
} from '@/lib/config';

function CustomerFormWithDefaults() {
  const [industry, setIndustry] = useState('');
  const [einsatzlogik, setEinsatzlogik] = useState('');
  const einsatzOptions = getEinsatzlogikOptionsForIndustry(industry);

  // Auto-select first option if only one available
  useEffect(() => {
    if (einsatzOptions.length === 1) {
      setEinsatzlogik(einsatzOptions[0].code);
    }
  }, [einsatzOptions]);

  // Show targets preview
  const targets = getTargetsForCustomer(industry, einsatzlogik);
  const marginLabel = einsatzlogik
    ? getEinsatzlogikLabel(industry, einsatzlogik)
    : 'Default';

  return (
    <>
      <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
        {/* options */}
      </select>

      {einsatzOptions.length > 0 && (
        <select value={einsatzlogik} onChange={(e) => setEinsatzlogik(e.target.value)}>
          <option value="">-- Wählen --</option>
          {einsatzOptions.map((opt) => (
            <option key={opt.code} value={opt.code}>{opt.label}</option>
          ))}
        </select>
      )}

      {targets && (
        <div className="preview-box">
          <h4>Zielwerte für {marginLabel}</h4>
          <p>Marge: {(targets.target_margin_pct[0] * 100).toFixed(0)}–{(targets.target_margin_pct[2] * 100).toFixed(0)}%</p>
          <p>Stundensatz: {targets.target_hourly_rate?.[0]?.toFixed(0)}–{targets.target_hourly_rate?.[2]?.toFixed(0)}€</p>
        </div>
      )}
    </>
  );
}
```

---

## Example 8: Dashboard Configuration Export

Export current targets as JSON for API clients:

```typescript
import { getTargetsForCustomer, getEinsatzlogikLabel, INDUSTRY_SEGMENTS } from '@/lib/config';

function exportCustomerConfig(customer) {
  const targets = getTargetsForCustomer(
    customer.industry_segment,
    customer.einsatzlogik
  );

  return {
    customer_id: customer.id,
    customer_name: customer.name,
    industry: {
      code: customer.industry_segment,
      label: INDUSTRY_SEGMENTS[customer.industry_segment]?.label || 'Unknown',
    },
    einsatzlogik: customer.einsatzlogik ? {
      code: customer.einsatzlogik,
      label: getEinsatzlogikLabel(customer.industry_segment, customer.einsatzlogik),
    } : null,
    kpi_targets: {
      margin_pct: {
        low: targets.target_margin_pct?.[0] || null,
        target: targets.target_margin_pct?.[1] || null,
        high: targets.target_margin_pct?.[2] || null,
      },
      hourly_rate: {
        low: targets.target_hourly_rate?.[0] || null,
        target: targets.target_hourly_rate?.[1] || null,
        high: targets.target_hourly_rate?.[2] || null,
      },
      payroll_cost_pct: {
        low: targets.target_payroll_cost_pct?.[0] || null,
        target: targets.target_payroll_cost_pct?.[1] || null,
        high: targets.target_payroll_cost_pct?.[2] || null,
      },
      variance: {
        hour_variance: targets.hour_variance_pct || null,
        cost_variance: targets.cost_variance_pct || null,
      },
    },
    productivity: {
      low: targets.productivity_hours_low,
      target: targets.productivity_hours_target,
      high: targets.productivity_hours_high,
    },
  };
}

// Usage
const config = exportCustomerConfig(customer);
console.log(JSON.stringify(config, null, 2));
```

**Output:**
```json
{
  "customer_id": "INDUSTRIE_GAMMA",
  "customer_name": "Industrie Gamma GmbH",
  "industry": {
    "code": "INDUSTRIESERVICE",
    "label": "Industrienahe Service- & Wartung"
  },
  "einsatzlogik": {
    "code": "REAKTIVER_FIELD_SERVICE",
    "label": "Reaktiver Field Service"
  },
  "kpi_targets": {
    "margin_pct": {
      "low": 0.10,
      "target": 0.11,
      "high": 0.12
    },
    "hourly_rate": {
      "low": 120,
      "target": 130,
      "high": 140
    },
    "payroll_cost_pct": {
      "low": 0.50,
      "target": 0.55,
      "high": 0.60
    },
    "variance": {
      "hour_variance": 0.10,
      "cost_variance": null
    }
  },
  "productivity": {
    "low": 1300,
    "target": 1500,
    "high": 1700
  }
}
```

---

## Example 9: Migration from Legacy Config

For code that still uses the old flat structure:

**Old Code (Deprecated):**
```typescript
// Before
const config = BENCHMARK_CONFIG['INDUSTRIESERVICE'];
const margin = config.target_margin_pct; // [0.07, 0.11, 0.16] (old values)
```

**New Code (Recommended):**
```typescript
// After
const targets = getTargetsForCustomer('INDUSTRIESERVICE', 'GEPLANTER_IH_SERVICE');
const margin = targets.target_margin_pct; // [0.12, 0.135, 0.15] (new, precise values)
```

**Fallback (If Legacy Still Needed):**
```typescript
// Using legacy config for backward compatibility
const legacyConfig = BENCHMARK_CONFIG_LEGACY['INDUSTRIESERVICE'];
const margin = legacyConfig.target_margin_pct; // [0.07, 0.11, 0.16]
```

---

## Example 10: Bulk Customer Update

Update all customers with Einsatzlogik based on their operational profile:

```typescript
const customers = [
  { id: 'INDUSTRIE_GAMMA', industry: 'INDUSTRIESERVICE', profile: 'reactive' },
  { id: 'WEBER_HAUSTECHNIK', industry: 'TECHN_WARTUNG', profile: 'standard' },
  { id: 'SCHMIDT_ANLAGENBAU', industry: 'INDUSTRIESERVICE', profile: 'specialized' },
];

const einsatzlogikMap = {
  reactive: 'REAKTIVER_FIELD_SERVICE',
  standard: 'STANDARD_WARTUNG',
  specialized: 'HOCHQUALIFIZIERT_SPECIAL',
  planned: 'GEPLANTER_IH_SERVICE',
  sla: 'SLA_INTENSIVE_WARTUNG',
};

function bulkUpdateEinsatzlogik(customers) {
  return customers.map((customer) => {
    const einsatzlogik = einsatzlogikMap[customer.profile];
    const targets = getTargetsForCustomer(customer.industry, einsatzlogik);

    return {
      ...customer,
      einsatzlogik,
      imported_targets: targets,
    };
  });
}

const updated = bulkUpdateEinsatzlogik(customers);
// Now ready to INSERT into BigQuery config_eu.customers with einsatzlogik field
```

---

## Troubleshooting

### Issue: Einsatzlogik dropdown empty

**Cause:** Industry selected doesn't have Einsatzlogik options
```typescript
const options = getEinsatzlogikOptionsForIndustry('HANDWERK');
console.log(options); // []
```

**Solution:** Check if industry has options in `EINSATZLOGIK_OPTIONS`
```typescript
if (EINSATZLOGIK_OPTIONS.hasOwnProperty(industry)) {
  // Show dropdown
} else {
  // Industry uses DEFAULT only
}
```

### Issue: Null targets returned

**Cause:** Industry doesn't exist in new or legacy configs
```typescript
const targets = getTargetsForCustomer('UNKNOWN_INDUSTRY');
console.log(targets); // {}
```

**Solution:** Always provide a fallback
```typescript
const targets = getTargetsForCustomer(industry, einsatzlogik) || BENCHMARK_CONFIG_LEGACY.SONSTIGE;
```

### Issue: Type errors with optional target fields

**Cause:** Not all KPI types are present in all Einsatzlogik configs
```typescript
const targets = getTargetsForCustomer('B2B_CONTRACTING', 'BETRIEBSFUEHRUNG_OUTSOURCING');
console.log(targets.target_hourly_rate); // undefined!
```

**Solution:** Use optional chaining
```typescript
const hourlyRate = targets.target_hourly_rate?.[1] || null;
```

---

## Performance Tips

1. **Cache targets** at the page/component level
   ```typescript
   const cached = useMemo(() =>
     getTargetsForCustomer(industry, einsatzlogik),
     [industry, einsatzlogik]
   );
   ```

2. **Pre-fetch options** for all industries
   ```typescript
   const allOptions = Object.keys(EINSATZLOGIK_OPTIONS).reduce((acc, ind) => {
     acc[ind] = getEinsatzlogikOptionsForIndustry(ind);
     return acc;
   }, {});
   ```

3. **Avoid redundant lookups** in loops
   ```typescript
   // Good: lookup once
   const targets = getTargetsForCustomer(industry, einsatzlogik);
   for (const kpi of kpis) {
     const status = getKPIStatus(kpi.actual, targets.target_margin_pct);
   }

   // Bad: lookup for each KPI
   for (const kpi of kpis) {
     const targets = getTargetsForCustomer(industry, einsatzlogik);
     // ...
   }
   ```
