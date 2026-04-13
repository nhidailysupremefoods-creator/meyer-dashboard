'use client';

interface Props {
  data: any;
}

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

const momArrow = (n: any) => {
  if (n == null) return '';
  const val = Number(n);
  return val > 0.001 ? '▲' : val < -0.001 ? '▼' : '→';
};

const riskInfo = (level: string) => {
  const u = (level || '').toUpperCase();
  if (u === 'KRITISCH' || u === 'CRITICAL' || u === 'ROT' || u === 'HIGH')
    return { color: '#E88080', bg: 'rgba(232,128,128,0.12)', label: 'Kritisch' };
  if (u === 'WARNUNG' || u === 'WARNING' || u === 'MITTEL' || u === 'MEDIUM' || u === 'GELB')
    return { color: '#F0C060', bg: 'rgba(240,192,96,0.12)', label: 'Warnung' };
  if (u === 'GUT' || u === 'OK' || u === 'NIEDRIG' || u === 'LOW' || u === 'GREEN')
    return { color: '#6ECF91', bg: 'rgba(110,207,145,0.12)', label: 'Gut' };
  return { color: '#8899AA', bg: 'rgba(136,153,170,0.12)', label: level || '–' };
};

// ── Sparkline for portfolio revenue trend ──────────────────────────────
function MiniBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.10)' }}>
      <div
        className="h-1 rounded-full"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function Page2Vertragsanalyse({ data }: Props) {
  const summary = (data as any)?.summary || {};
  const contracts: any[] = (data as any)?.contracts || [];

  const criticalCount = contracts.filter((c) => {
    const u = (c.risk_level || '').toUpperCase();
    return u === 'KRITISCH' || u === 'CRITICAL' || u === 'ROT' || u === 'HIGH';
  }).length;

  const portfolioEbit = Number(summary.profit_total ?? summary.ebit_total ?? 0);
  const revTotal = Number(summary.revenue_total ?? 0);
  const avgMargin = Number(summary.avg_margin_pct ?? 0);
  const contractCount = Number(summary.contract_count ?? contracts.length);

  // MoM from summary if available
  const revMom = summary.revenue_mom_pct != null ? Number(summary.revenue_mom_pct) : null;

  const ebitColor = portfolioEbit < 0 ? '#E88080' : '#D49564';

  const maxRevenue = contracts.length > 0
    ? Math.max(...contracts.map((c: any) => Math.abs(Number(c.revenue_eur ?? c.revenue ?? 0))))
    : 1;

  return (
    <div className="space-y-5">
      {/* ── Section Title ── */}
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          Vertragsanalyse
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Übersicht aller aktiven Verträge und Risikobewertung
        </p>
        <div className="copper-line" />
      </div>

      {/* ── Hero Card (dark navy, old-dashboard style) ── */}
      <div className="rounded-xl" style={{ backgroundColor: 'var(--navy)', color: '#FFFFFF', overflow: 'hidden' }}>
        <div className="flex flex-col sm:flex-row">
          {/* Left: Portfolio-EBIT */}
          <div className="flex-1 p-5 pb-4">
            <div
              className="text-xs font-bold uppercase tracking-widest mb-3"
              style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em' }}
            >
              PORTFOLIO-EBIT – MONATLICH
            </div>
            <div
              className="text-4xl font-extrabold mb-1 leading-none"
              style={{ color: ebitColor }}
            >
              {fmtEur(portfolioEbit)}
            </div>
            {revMom !== null && (
              <div
                className="text-sm font-semibold mb-3"
                style={{ color: revMom >= 0 ? '#6ECF91' : '#E88080' }}
              >
                {momArrow(revMom)} {fmtPctSigned(revMom)} ggü. Vormonat
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: avgMargin >= 0.1 ? 'rgba(110,207,145,0.15)' : avgMargin >= 0.05 ? 'rgba(240,192,96,0.15)' : 'rgba(232,128,128,0.15)',
                  color: avgMargin >= 0.1 ? '#6ECF91' : avgMargin >= 0.05 ? '#F0C060' : '#E88080',
                  border: `1px solid ${avgMargin >= 0.1 ? 'rgba(110,207,145,0.3)' : avgMargin >= 0.05 ? 'rgba(240,192,96,0.3)' : 'rgba(232,128,128,0.3)'}`,
                }}
              >
                Ø {fmtPct(avgMargin)} Marge
              </span>
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.07)',
                  color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                {fmtEur(revTotal)} Umsatz
              </span>
            </div>
          </div>

          {/* Vertical Divider */}
          <div
            className="hidden sm:block"
            style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.10)', margin: '20px 0' }}
          />

          {/* Right: Verträge & Kritisch */}
          <div
            className="p-5 flex flex-row sm:flex-col justify-around sm:justify-center gap-4"
            style={{ minWidth: 180 }}
          >
            <div>
              <div
                className="text-xs font-bold uppercase tracking-widest mb-1"
                style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em' }}
              >
                VERTRÄGE
              </div>
              <div className="text-3xl font-extrabold" style={{ color: '#D49564' }}>
                {contractCount}
              </div>
            </div>
            <div>
              <div
                className="text-xs font-bold uppercase tracking-widest mb-1"
                style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em' }}
              >
                KRITISCH
              </div>
              <div
                className="text-3xl font-extrabold"
                style={{ color: criticalCount > 0 ? '#E88080' : '#6ECF91' }}
              >
                {criticalCount}
                <span className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  /{contractCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Banner inside hero (if critical contracts) */}
        {criticalCount > 0 && (
          <div
            className="px-5 py-2.5 flex items-center gap-2"
            style={{ backgroundColor: 'rgba(232,128,128,0.12)', borderTop: '1px solid rgba(232,128,128,0.2)' }}
          >
            <span style={{ color: '#E88080', fontSize: 14 }}>⚠</span>
            <span className="text-xs font-semibold" style={{ color: '#E88080' }}>
              {criticalCount} kritische{criticalCount === 1 ? 'r Vertrag' : ' Verträge'} — Sofortmaßnahmen empfohlen
            </span>
          </div>
        )}
      </div>

      {/* ── Contracts Table ── */}
      <div className="card">
        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          Vertragsøbersicht ({contracts.length})
        </h3>

        {contracts.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Keine Vertragsdaten verføgbar
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-xs uppercase tracking-wider"
                  style={{ color: 'var(--text-secondary)', borderBottom: '2px solid var(--border-color)' }}
                >
                  <th className="text-left pb-2 font-semibold pr-2">#</th>
                  <th className="text-left pb-2 font-semibold">Vertrag</th>
                  <th className="text-right pb-2 font-semibold">Umsatz</th>
                  <th className="text-right pb-2 font-semibold">EBIT</th>
                  <th className="text-right pb-2 font-semibold">Marge</th>
                  <th className="text-center pb-2 font-semibold pl-3">Risiko</th>
                </tr>
              </thead>
              <tbody>
                {contracts
                  .slice()
                  .sort((a: any, b: any) => Number(a.rank_priority ?? 99) - Number(b.rank_priority ?? 99))
                  .map((c: any, i: number) => {
                    const ri = riskInfo(c.risk_level);
                    const ebit = Number(c.ebit_eur ?? c.ebit ?? 0);
                    const revenue = Number(c.revenue_eur ?? c.revenue ?? 0);
                    const margin = Number(c.margin_pct ?? 0);
                    return (
                      <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                        <td className="py-2.5 pr-2">
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
                            style={{ backgroundColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                          >
                            {c.rank_priority ?? i + 1}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            {c.contract_name ?? c.name ?? `Vertrag ${i + 1}`}
                          </div>
                          {/* mini revenue bar */}
                          <div className="mt-1 w-20">
                            <MiniBar
                              value={Math.abs(revenue)}
                              max={maxRevenue}
                              color={ebit < 0 ? '#E88080' : '#D49564'}
                            />
                          </div>
                        </td>
                        <td className="py-2.5 text-right font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {fmtEur(revenue)}
                        </td>
                        <td
                          className="py-2.5 text-right font-bold"
                          style={{ color: ebit < 0 ? '#C43830' : ebit > 0 ? '#2E8B57' : 'inherit' }}
                        >
                          {fmtEur(ebit)}
                        </td>
                        <td
                          className="py-2.5 text-right text-xs font-semibold"
                          style={{
                            color:
                              margin < 0.05 ? '#C43830' : margin < 0.1 ? '#E8A838' : '#2E8B57',
                          }}
                        >
                          {fmtPct(margin)}
                        </td>
                        <td className="py-2.5 text-center pl-3">
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ backgroundColor: ri.bg, color: ri.color }}
                          >
                            {ri.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Additional KPIs ── */}
      {(summary.avg_risk_score != null || summary.avg_margin_pct != null) && (
        <div className="grid grid-cols-2 gap-3">
          {summary.avg_risk_score != null && (
            <div className="card text-center">
              <div
                className="text-xs font-semibold uppercase tracking-wider mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                Ø Risiko-Score
              </div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {Number(summary.avg_risk_score).toFixed(1)}
              </div>
            </div>
          )}
          {summary.avg_margin_pct != null && (
            <div className="card text-center">
              <div
                className="text-xs font-semibold uppercase tracking-wider mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                Ø Portfolio-Marge
              </div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {fmtPct(summary.avg_margin_pct)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
