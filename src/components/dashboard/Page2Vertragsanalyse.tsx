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
    return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: level || 'Kritisch' };
  if (
    u === 'WARNUNG' ||
    u === 'WARNING' ||
    u === 'MITTEL' ||
    u === 'MEDIUM' ||
    u === 'GELB'
  )
    return { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: level || 'Warnung' };
  if (u === 'GUT' || u === 'OK' || u === 'NIEDRIG' || u === 'LOW' || u === 'GREEN')
    return { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: level || 'Gut' };
  return { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', label: level || '–' };
};

function KPITile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card text-center">
      <div
        className="text-xs font-medium uppercase tracking-wide mb-2"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
        {value}
      </div>
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

  return (
    <div className="space-y-6">
      {/* ── Portfolio Summary ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPITile
          label="Portfolio-EBIT"
          value={fmtEur(summary.profit_total ?? summary.ebit_total)}
        />
        <KPITile
          label="Verträge gesamt"
          value={String(summary.contract_count ?? contracts.length)}
        />
        <KPITile
          label="Gesamtumsatz"
          value={fmtEur(summary.revenue_total)}
        />
        <KPITile
          label="Kritische Verträge"
          value={
            criticalCount > 0
              ? `${criticalCount} / ${contracts.length}`
              : `0 / ${contracts.length}`
          }
        />
      </div>

      {/* ── Risk Overview Banner ─────────────────────────────────────────── */}
      {criticalCount > 0 && (
        <div
          className="p-4 rounded-xl flex items-center gap-3"
          style={{
            backgroundColor: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
          }}
        >
          <span className="text-2xl">⚠️</span>
          <div>
            <div
              className="font-semibold"
              style={{ color: '#ef4444' }}
            >
              {criticalCount} kritische{' '}
              {criticalCount === 1 ? 'Vertrag' : 'Verträge'} erkannt
            </div>
            <div
              className="text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              Sofortige Maßnahmen empfohlen
            </div>
          </div>
        </div>
      )}

      {/* ── Contracts Table ───────────────────────────────────────────────── */}
      <div className="card">
        <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          Vertragsübersicht ({contracts.length} Verträge)
        </h3>

        {contracts.length === 0 ? (
          <p
            className="text-center py-8"
            style={{ color: 'var(--text-secondary)' }}
          >
            Keine Vertragsdaten verfügbar
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-xs uppercase tracking-wide"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <th className="text-left pb-3 font-medium">#</th>
                  <th className="text-left pb-3 font-medium">Vertrag</th>
                  <th className="text-right pb-3 font-medium">Umsatz</th>
                  <th className="text-right pb-3 font-medium">EBIT</th>
                  <th className="text-right pb-3 font-medium">Marge</th>
                  <th className="text-center pb-3 font-medium">Risiko</th>
                  <th className="text-right pb-3 font-medium">Prio</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c: any, i: number) => {
                  const ri = riskInfo(c.risk_level);
                  const ebit = Number(c.ebit_eur ?? c.ebit ?? 0);
                  const revenue = Number(c.revenue_eur ?? c.revenue ?? 0);
                  const margin = Number(c.margin_pct ?? 0);
                  return (
                    <tr
                      key={i}
                      style={{
                        borderTop: '1px solid var(--border-color)',
                      }}
                    >
                      <td
                        className="py-3 text-xs"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {c.rank_priority ?? i + 1}
                      </td>
                      <td className="py-3 font-medium">
                        {c.contract_name ?? c.name ?? `Vertrag ${i + 1}`}
                      </td>
                      <td className="py-3 text-right">
                        {fmtEur(revenue)}
                      </td>
                      <td
                        className="py-3 text-right font-medium"
                        style={{
                          color:
                            ebit < 0
                              ? 'var(--danger)'
                              : ebit > 0
                              ? '#10b981'
                              : 'inherit',
                        }}
                      >
                        {fmtEur(ebit)}
                      </td>
                      <td
                        className="py-3 text-right"
                        style={{
                          color:
                            margin < 0.05
                              ? 'var(--danger)'
                              : margin < 0.1
                              ? 'var(--warning)'
                              : 'inherit',
                        }}
                      >
                        {fmtPct(margin)}
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: ri.bg,
                            color: ri.color,
                          }}
                        >
                          {ri.label}
                        </span>
                      </td>
                      <td
                        className="py-3 text-right text-xs"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {c.rank_priority != null
                          ? `#${c.rank_priority}`
                          : '–'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Additional summary fields ─────────────────────────────────────── */}
      {(summary.avg_risk_score != null || summary.avg_margin_pct != null) && (
        <div className="grid grid-cols-2 gap-4">
          {summary.avg_risk_score != null && (
            <KPITile
              label="Ø Risiko-Score"
              value={Number(summary.avg_risk_score).toFixed(1)}
            />
          )}
          {summary.avg_margin_pct != null && (
            <KPITile
              label="Ø Portfolio-Marge"
              value={fmtPct(summary.avg_margin_pct)}
            />
          )}
        </div>
      )}
    </div>
  );
}
