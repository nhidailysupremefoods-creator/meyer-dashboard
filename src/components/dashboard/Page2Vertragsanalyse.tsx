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

const riskInfo = (level: string) => {
  const u = (level || '').toUpperCase();
  if (u === 'KRITISCH' || u === 'CRITICAL' || u === 'ROT' || u === 'HIGH')
    return { color: '#C43830', bg: 'rgba(196,56,48,0.08)', label: level || 'Kritisch' };
  if (u === 'WARNUNG' || u === 'WARNING' || u === 'MITTEL' || u === 'MEDIUM' || u === 'GELB')
    return { color: '#E8A838', bg: 'rgba(232,168,56,0.08)', label: level || 'Warnung' };
  if (u === 'GUT' || u === 'OK' || u === 'NIEDRIG' || u === 'LOW' || u === 'GREEN')
    return { color: '#2E8B57', bg: 'rgba(46,139,87,0.08)', label: level || 'Gut' };
  return { color: '#6B7A90', bg: 'rgba(107,122,144,0.08)', label: level || '–' };
};

export default function Page2Vertragsanalyse({ data }: Props) {
  const summary = (data as any)?.summary || {};
  const contracts: any[] = (data as any)?.contracts || [];

  const criticalCount = contracts.filter((c) => {
    const u = (c.risk_level || '').toUpperCase();
    return u === 'KRITISCH' || u === 'CRITICAL' || u === 'ROT' || u === 'HIGH';
  }).length;

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

      {/* ── Portfolio Summary ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card text-center">
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
            Portfolio-EBIT
          </div>
          <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {fmtEur(summary.profit_total ?? summary.ebit_total)}
          </div>
        </div>
        <div className="card text-center">
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
            Verträge gesamt
          </div>
          <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {summary.contract_count ?? contracts.length}
          </div>
        </div>
        <div className="card text-center">
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
            Gesamtumsatz
          </div>
          <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {fmtEur(summary.revenue_total)}
          </div>
        </div>
        <div className="card text-center">
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
            Kritische Verträge
          </div>
          <div
            className="text-xl font-bold"
            style={{ color: criticalCount > 0 ? 'var(--danger)' : 'var(--success)' }}
          >
            {criticalCount} / {contracts.length}
          </div>
        </div>
      </div>

      {/* ── Risk Warning ── */}
      {criticalCount > 0 && (
        <div
          className="p-3 rounded-lg flex items-center gap-3"
          style={{
            backgroundColor: 'rgba(196,56,48,0.06)',
            border: '1px solid rgba(196,56,48,0.2)',
          }}
        >
          <span className="text-lg">&#9888;&#6503;</span>
          <div>
            <span className="font-semibold text-sm" style={{ color: 'var(--danger)' }}>
              {criticalCount} kritische{' '}
              {criticalCount === 1 ? 'Vertrag' : 'Verträge'} erkannt
            </span>
            <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>
              — Sofortige Maßnahmen empfohlen
            </span>
          </div>
        </div>
      )}

      {/* ── Contracts Table ── */}
      <div className="card">
        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          Vertragsübersicht ({contracts.length} Verträge)
        </h3>

        {contracts.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Keine Vertragsdaten verfügbar
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  <th className="text-left pb-2 font-semibold">#</th>
                  <th className="text-left pb-2 font-semibold">Vertrag</th>
                  <th className="text-right pb-2 font-semibold">Umsatz</th>
                  <th className="text-right pb-2 font-semibold">EBIT</th>
                  <th className="text-right pb-2 font-semibold">Marge</th>
                  <th className="text-center pb-2 font-semibold">Risiko</th>
                  <th className="text-right pb-2 font-semibold">Prio</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c: any, i: number) => {
                  const ri = riskInfo(c.risk_level);
                  const ebit = Number(c.ebit_eur ?? c.ebit ?? 0);
                  const revenue = Number(c.revenue_eur ?? c.revenue ?? 0);
                  const margin = Number(c.margin_pct ?? 0);
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td className="py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {c.rank_priority ?? i + 1}
                      </td>
                      <td className="py-2.5 font-medium">
                        {c.contract_name ?? c.name ?? `Vertrag ${i + 1}`}
                      </td>
                      <td className="py-2.5 text-right">{fmtEur(revenue)}</td>
                      <td
                        className="py-2.5 text-right font-medium"
                        style={{ color: ebit < 0 ? 'var(--danger)' : ebit > 0 ? 'var(--success)' : 'inherit' }}
                      >
                        {fmtEur(ebit)}
                      </td>
                      <td
                        className="py-2.5 text-right"
                        style={{ color: margin < 0.05 ? 'var(--danger)' : margin < 0.1 ? 'var(--warning)' : 'inherit' }}
                      >
                        {fmtPct(margin)}
                      </td>
                      <td className="py-2.5 text-center">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: ri.bg, color: ri.color }}
                        >
                          {ri.label}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {c.rank_priority != null ? `#${c.rank_priority}` : '–'}
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
              <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
                Ø Risiko-Score
              </div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {Number(summary.avg_risk_score).toFixed(1)}
              </div>
            </div>
          )}
          {summary.avg_margin_pct != null && (
            <div className="card text-center">
              <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
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
