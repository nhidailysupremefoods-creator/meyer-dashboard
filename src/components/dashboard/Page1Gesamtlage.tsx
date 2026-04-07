'use client';

interface Props {
  data: any;
}

// ── Formatters ───────────────────────────────────────────────────────────────
const fmtEur = (n: any) =>
  n != null
    ? new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(Number(n))
    : '–';

const fmtPct = (n: any) =>
  n != null ? `${(Number(n) * 100).toFixed(1)} %` : '–';

const statusInfo = (s: string) => {
  const u = (s || '').toUpperCase();
  if (u === 'GRÜN' || u === 'GREEN')
    return { label: 'GUT', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
  if (u === 'GELB' || u === 'YELLOW' || u === 'WARNUNG')
    return { label: 'WARNUNG', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  if (u === 'ROT' || u === 'RED' || u === 'KRITISCH')
    return { label: 'KRITISCH', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
  return { label: s || '–', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' };
};

// ── Sub-components ───────────────────────────────────────────────────────────
function KPITile({
  label,
  value,
  sub,
  subColor,
}: {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="card text-center">
      <div
        className="text-xs font-medium uppercase tracking-wide mb-2"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </div>
      <div
        className="text-2xl font-bold"
        style={{ color: 'var(--primary)' }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="text-xs mt-1"
          style={{ color: subColor || 'var(--text-secondary)' }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function CostBar({
  label,
  value,
  total,
  color,
  indent,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  indent?: boolean;
}) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  return (
    <div className={indent ? 'ml-6' : ''}>
      <div className="flex justify-between text-sm mb-1">
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="font-medium">
          {fmtEur(value)}{' '}
          <span style={{ color: 'var(--text-secondary)' }}>
            ({pct.toFixed(0)} %)
          </span>
        </span>
      </div>
      <div
        className="h-2 rounded-full"
        style={{ backgroundColor: 'var(--border-color)' }}
      >
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Page1Gesamtlage({ data }: Props) {
  const d = (data as any)?.data || {};
  const trend: any[] = (data as any)?.trend || [];

  const st = statusInfo(d.status_color);
  const revenue = Number(d.revenue || 0);
  const ebit = Number(d.ebit ?? d.profit ?? 0);
  const marginPct = Number(d.margin_pct ?? 0);
  const costRatio = Number(d.cost_ratio ?? d.cost_pct ?? 0);
  const ebitda = Number(d.ebitda ?? 0);

  const payrollCost = Math.abs(Number(d.payroll_cost ?? 0));
  const costFixed = Math.abs(Number(d.cost_fixed ?? 0));
  const costVariable = Math.abs(Number(d.cost_variable ?? 0));
  const totalCost =
    costFixed + costVariable > 0
      ? costFixed + costVariable
      : Math.abs(revenue - ebit);

  const ebitPotential = Number(d.ebit_potential ?? 0);
  const ebitGap = Number(d.ebit_gap ?? 0);
  const productivity = Number(d.portfolio_productivity ?? d.productivity_rate ?? 0);
  const ebitTarget = Number(d.ebit_target ?? 0);

  return (
    <div className="space-y-6">
      {/* ── Status Bar ────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-xl"
        style={{ backgroundColor: st.bg, border: `1.5px solid ${st.color}22` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: st.color }}
          />
          <span
            className="text-xl font-bold"
            style={{ color: st.color }}
          >
            {st.label}
          </span>
          {(d.month_label || d.period_label) && (
            <span
              className="text-sm font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              {d.month_label || d.period_label}
            </span>
          )}
        </div>
        <div
          className="text-sm font-medium px-3 py-1 rounded-full"
          style={{
            backgroundColor: st.color + '20',
            color: st.color,
          }}
        >
          Status: {st.label}
        </div>
      </div>

      {/* ── KPI Grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPITile label="Umsatz (MRR)" value={fmtEur(revenue)} />
        <KPITile
          label="EBIT"
          value={fmtEur(ebit)}
          sub={ebit < 0 ? '⚠ Verlust' : ebitda > 0 ? `EBITDA: ${fmtEur(ebitda)}` : undefined}
          subColor={ebit < 0 ? 'var(--danger)' : undefined}
        />
        <KPITile label="Marge" value={fmtPct(marginPct)} />
        <KPITile
          label="Kostenquote"
          value={fmtPct(costRatio)}
          sub={costRatio > 0.95 ? '⚠ Hoch' : undefined}
          subColor={costRatio > 0.95 ? 'var(--danger)' : undefined}
        />
      </div>

      {/* ── Kostenstruktur ────────────────────────────────────────────────── */}
      {totalCost > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Kostenstruktur
          </h3>
          <div className="space-y-4">
            {costVariable > 0 && (
              <CostBar
                label="Variable Kosten"
                value={costVariable}
                total={totalCost}
                color="#3b82f6"
              />
            )}
            {costFixed > 0 && (
              <CostBar
                label="Fixkosten"
                value={costFixed}
                total={totalCost}
                color="#6366f1"
              />
            )}
            {payrollCost > 0 && (
              <CostBar
                label="davon Personalkosten"
                value={payrollCost}
                total={totalCost}
                color="#8b5cf6"
                indent
              />
            )}
          </div>
        </div>
      )}

      {/* ── Hebelpotenzial & Produktivität ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ebitPotential > 0 && (
          <div className="card">
            <div
              className="text-xs font-medium uppercase tracking-wide mb-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              Hebelpotenzial (EBIT)
            </div>
            <div
              className="text-3xl font-bold"
              style={{ color: '#10b981' }}
            >
              +{fmtEur(ebitPotential)}
            </div>
            {ebitGap !== 0 && (
              <div className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                EBIT-Lücke zum Ziel:{' '}
                <span style={{ color: ebitGap < 0 ? 'var(--danger)' : '#10b981' }}>
                  {fmtEur(ebitGap)}
                </span>
              </div>
            )}
            {ebitTarget > 0 && (
              <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Ziel-EBIT: {fmtEur(ebitTarget)}
              </div>
            )}
          </div>
        )}

        {productivity > 0 && (
          <div className="card">
            <div
              className="text-xs font-medium uppercase tracking-wide mb-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              Produktivitätsrate
            </div>
            <div
              className="text-3xl font-bold"
              style={{ color: 'var(--primary)' }}
            >
              {fmtPct(productivity)}
            </div>
            <div
              className="mt-3 h-2 rounded-full"
              style={{ backgroundColor: 'var(--border-color)' }}
            >
              <div
                className="h-2 rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(productivity * 100, 100)}%`,
                  backgroundColor:
                    productivity >= 0.75
                      ? '#10b981'
                      : productivity >= 0.55
                      ? '#f59e0b'
                      : '#ef4444',
                }}
              />
            </div>
            <div
              className="flex justify-between text-xs mt-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span>Ziel: 75 %</span>
              <span>Optimal: 90 %</span>
            </div>
          </div>
        )}
      </div>

      {/* ── 12-Monats-Trend ───────────────────────────────────────────────── */}
      {trend.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            12-Monats-Trend
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-xs uppercase tracking-wide"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <th className="text-left pb-3 font-medium">Monat</th>
                  <th className="text-right pb-3 font-medium">Umsatz</th>
                  <th className="text-right pb-3 font-medium">EBIT</th>
                  <th className="text-right pb-3 font-medium">Marge</th>
                </tr>
              </thead>
              <tbody>
                {trend.slice(-12).map((row: any, i: number) => {
                  const rowProfit = Number(row.profit ?? row.ebit ?? 0);
                  const rowRevenue = Number(row.revenue ?? 0);
                  const rowMargin = Number(row.margin_pct ?? 0);
                  return (
                    <tr
                      key={i}
                      style={{ borderTop: '1px solid var(--border-color)' }}
                    >
                      <td className="py-2 font-medium">
                        {row.month_label ||
                          row.month_label_short ||
                          row.period_label ||
                          ''}
                      </td>
                      <td className="py-2 text-right">{fmtEur(rowRevenue)}</td>
                      <td
                        className="py-2 text-right font-medium"
                        style={{
                          color:
                            rowProfit < 0
                              ? 'var(--danger)'
                              : rowProfit > 0
                              ? '#10b981'
                              : 'inherit',
                        }}
                      >
                        {fmtEur(rowProfit)}
                      </td>
                      <td
                        className="py-2 text-right"
                        style={{
                          color:
                            rowMargin < 0.05
                              ? 'var(--danger)'
                              : rowMargin < 0.1
                              ? 'var(--warning)'
                              : '#10b981',
                        }}
                      >
                        {fmtPct(rowMargin)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
