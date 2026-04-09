'use client';

interface Props {
  data: any;
}

// ── Formatters ─────────────────────────────────────────────────────────
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

const fmtPctSigned = (n: any) => {
  if (n == null) return '–';
  const val = Number(n) * 100;
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(1)} %`;
};

const statusInfo = (s: string) => {
  const u = (s || '').toUpperCase();
  if (u === 'GRÜN' || u === 'GREEN' || u === 'GUT')
    return { label: 'GUT', color: '#2E8B57', bg: 'rgba(46,139,87,0.08)' };
  if (u === 'GELB' || u === 'YELLOW' || u === 'WARNUNG')
    return { label: 'WARNUNG', color: '#E8A838', bg: 'rgba(232,168,56,0.08)' };
  if (u === 'ROT' || u === 'RED' || u === 'KRITISCH')
    return { label: 'KRITISCH', color: '#C43830', bg: 'rgba(196,56,48,0.08)' };
  return { label: s || '–', color: '#6B7A90', bg: 'rgba(107,122,144,0.08)' };
};

const momColor = (n: any) => {
  if (n == null) return 'var(--text-secondary)';
  const val = Number(n);
  return val > 0 ? '#2E8B57' : val < 0 ? '#C43830' : 'var(--text-secondary)';
};

// ── Main Component ─────────────────────────────────────────────────────
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

  // MoM changes
  const revenueMom = Number(d.revenue_mom_pct ?? 0);
  const profitMom = Number(d.profit_mom_pct ?? 0);

  // Payroll as % of revenue
  const payrollPct = revenue > 0 ? payrollCost / revenue : 0;
  // Cost ratio display
  const costRatioDisplay = costRatio || (revenue > 0 ? totalCost / revenue : 0);

  // Advisory / Einschätzung text
  const advisory = d.advisory_text || d.monatliche_einschaetzung || '';

  // YTD
  const ytdRevenue = Number(d.ytd_revenue ?? 0);
  const ytdEbit = Number(d.ytd_ebit ?? d.ytd_profit ?? 0);
  const ytdMargin = Number(d.ytd_margin_pct ?? 0);

  return (
    <div className="space-y-5">
      {/* ── Section Title ── */}
      <div>
        <h2
          className="text-lg font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          Monatliche Gesamtlage
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Wie steht das Unternehmen diesen Monat?
        </p>
        <div className="copper-line" />
      </div>

      {/* ── Hero Row: EBIT Card (left) + 2×2 KPI Grid (right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* EBIT Hero Card — dark navy background */}
        <div
          className="lg:col-span-2 rounded-xl p-5"
          style={{
            backgroundColor: 'var(--navy)',
            color: '#FFFFFF',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Status badge top-right */}
          <div
            className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold"
            style={{
              backgroundColor: st.color + '30',
              color: st.color,
            }}
          >
            {st.label}
          </div>

          <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            EBIT (Monat)
          </div>
          <div className="text-3xl font-extrabold mb-1" style={{ color: ebit < 0 ? '#E88080' : '#FFFFFF' }}>
            {fmtEur(ebit)}
          </div>
          {ebit < 0 && (
            <div className="text-xs font-semibold mb-2" style={{ color: '#E88080' }}>
              Verlust
            </div>
          )}

          {/* Margin badge */}
          <div className="flex items-center gap-2 mb-3">
            <span
              className="px-2 py-0.5 rounded text-xs font-bold"
              style={{
                backgroundColor: marginPct < 0.05 ? 'rgba(196,56,48,0.25)' : marginPct < 0.10 ? 'rgba(232,168,56,0.25)' : 'rgba(46,139,87,0.25)',
                color: marginPct < 0.05 ? '#E88080' : marginPct < 0.10 ? '#E8A838' : '#6ECF91',
              }}
            >
              {fmtPct(marginPct)} Marge
            </span>
            {profitMom !== 0 && (
              <span className="text-xs" style={{ color: momColor(profitMom) }}>
                {fmtPctSigned(profitMom)} MoM
              </span>
            )}
          </div>

          {/* Hebelpotenzial */}
          {ebitPotential > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Hebelpotenzial
              </div>
              <div className="text-xl font-bold" style={{ color: '#6ECF91' }}>
                +{fmtEur(ebitPotential)}
              </div>
            </div>
          )}

          {/* EBITDA if available */}
          {ebitda > 0 && (
            <div className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
              EBITDA: {fmtEur(ebitda)}
            </div>
          )}
        </div>

        {/* 2×2 KPI Grid */}
        <div className="lg:col-span-3 grid grid-cols-2 gap-3">
          {/* Monatsumsatz */}
          <div className="card">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
              Monatsumsatz (MRR)
            </div>
            <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {fmtEur(revenue)}
            </div>
            {revenueMom !== 0 && (
              <div className="text-xs mt-1" style={{ color: momColor(revenueMom) }}>
                {fmtPctSigned(revenueMom)} gg. Vormonat
              </div>
            )}
          </div>

          {/* Produktivität */}
          <div className="card">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
              Produktivität
            </div>
            <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {productivity > 0 ? `${Math.round(productivity)} €/Std` : fmtPct(productivity)}
            </div>
            {productivity > 0 && (
              <div className="w-full h-1.5 rounded-full mt-2" style={{ backgroundColor: 'var(--border-color)' }}>
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min((productivity > 1 ? productivity / 150 : productivity) * 100, 100)}%`,
                    backgroundColor: productivity >= 0.75 || productivity >= 80 ? '#2E8B57' : productivity >= 0.55 || productivity >= 60 ? '#E8A838' : '#C43830',
                  }}
                />
              </div>
            )}
          </div>

          {/* Kostenquote */}
          <div className="card">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
              Kostenquote
            </div>
            <div
              className="text-xl font-bold"
              style={{
                color: costRatioDisplay > 0.95 ? 'var(--danger)' : costRatioDisplay > 0.88 ? 'var(--warning)' : 'var(--text-primary)',
              }}
            >
              {fmtPct(costRatioDisplay)}
            </div>
            {costRatioDisplay > 0.95 && (
              <div className="text-xs mt-1" style={{ color: 'var(--danger)' }}>
                Hoch
              </div>
            )}
          </div>

          {/* Personalkosten */}
          <div className="card">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
              Personalkosten
            </div>
            <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {payrollPct > 0 ? fmtPct(payrollPct) : fmtEur(payrollCost)}
            </div>
            {payrollCost > 0 && payrollPct > 0 && (
              <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {fmtEur(payrollCost)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── EBIT Target Bar ── */}
      {(ebitGap !== 0 || ebitTarget > 0) && (
        <div
          className="card flex items-center gap-4"
          style={{ padding: '0.75rem 1.25rem' }}
        >
          <div className="flex-shrink-0">
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: ebitGap < 0 ? 'var(--danger)' : 'var(--success)' }}
            >
              {ebitGap < 0 ? 'EBIT UNTER ZIEL' : 'EBIT IM ZIEL'}
            </span>
            {ebitTarget > 0 && (
              <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>
                Ziel: {fmtPct(ebitTarget > 1 ? ebitTarget / 100 : ebitTarget)} Marge
              </span>
            )}
          </div>
          <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: 'var(--border-color)' }}>
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${Math.min(Math.max(marginPct / (ebitTarget > 1 ? ebitTarget / 100 : ebitTarget || 0.12) * 100, 5), 100)}%`,
                backgroundColor: ebitGap < 0 ? 'var(--danger)' : 'var(--success)',
              }}
            />
          </div>
          <div className="flex-shrink-0 text-sm font-bold" style={{ color: ebitGap < 0 ? 'var(--danger)' : 'var(--success)' }}>
            {fmtEur(ebitGap)}
          </div>
        </div>
      )}

      {/* ── Monatliche Einschätzung (Advisory Banner) ── */}
      {advisory && (
        <div
          className="rounded-lg p-4"
          style={{
            backgroundColor: 'rgba(232, 168, 56, 0.08)',
            border: '1px solid rgba(232, 168, 56, 0.2)',
          }}
        >
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--warning)' }}>
            Monatliche Einschätzung
          </div>
          <div className="text-sm" style={{ color: 'var(--text-primary)', lineHeight: '1.7' }}>
            {advisory}
          </div>
        </div>
      )}

      {/* ── Kostenstruktur ── */}
      {totalCost > 0 && (
        <div className="card">
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Kostenstruktur
          </h3>
          <div className="space-y-3">
            {costVariable > 0 && (
              <CostBar label="Variable Kosten" value={costVariable} total={totalCost} color="#3B82F6" />
            )}
            {costFixed > 0 && (
              <CostBar label="Fixkosten" value={costFixed} total={totalCost} color="#6366F1" />
            )}
            {payrollCost > 0 && (
              <CostBar label="davon Personalkosten" value={payrollCost} total={totalCost} color="#8B5CF6" indent />
            )}
          </div>
        </div>
      )}

      {/* ── YTD Summary ── */}
      {(ytdRevenue > 0 || ytdEbit !== 0) && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
              Umsatz Kum.
            </div>
            <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {fmtEur(ytdRevenue)}
            </div>
          </div>
          <div className="card text-center">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
              EBIT Kum.
            </div>
            <div className="text-lg font-bold" style={{ color: ytdEbit < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
              {fmtEur(ytdEbit)}
            </div>
          </div>
          <div className="card text-center">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
              Ø Marge
            </div>
            <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {ytdMargin > 0 ? fmtPct(ytdMargin) : '–'}
            </div>
          </div>
        </div>
      )}

      {/* ── 12-Monats-Trend ── */}
      {trend.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            12-Monats-Trend
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-xs uppercase tracking-wider"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <th className="text-left pb-2 font-semibold">Monat</th>
                  <th className="text-right pb-2 font-semibold">Umsatz</th>
                  <th className="text-right pb-2 font-semibold">EBIT</th>
                  <th className="text-right pb-2 font-semibold">Marge</th>
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
                        {row.month_label || row.month_label_short || row.period_label || ''}
                      </td>
                      <td className="py-2 text-right">{fmtEur(rowRevenue)}</td>
                      <td
                        className="py-2 text-right font-medium"
                        style={{
                          color:
                            rowProfit < 0 ? 'var(--danger)' : rowProfit > 0 ? 'var(--success)' : 'inherit',
                        }}
                      >
                        {fmtEur(rowProfit)}
                      </td>
                      <td
                        className="py-2 text-right"
                        style={{
                          color:
                            rowMargin < 0.05 ? 'var(--danger)' : rowMargin < 0.10 ? 'var(--warning)' : 'var(--success)',
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

// ── Sub-components ─────────────────────────────────────────────────────
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
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
          {fmtEur(value)}{' '}
          <span style={{ color: 'var(--text-secondary)' }}>({pct.toFixed(0)} %)</span>
        </span>
      </div>
      <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--border-color)' }}>
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
