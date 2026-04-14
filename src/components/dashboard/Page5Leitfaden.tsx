'use client';

interface Props {
  data: any;
  customer: string;
  period: string;
}

const fmtEur = (n: any) =>
  n != null
    ? new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(Number(n))
    : '—';

function ScoreBar({ label, value, max = 25 }: { label: string; value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 60 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="font-bold" style={{ color }}>{value}/{max}</span>
      </div>
      <div className="h-3 rounded-full" style={{ backgroundColor: 'var(--border-color)' }}>
        <div
          className="h-3 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function Page5Leitfaden({ data, customer, period }: Props) {
  const advisory = data?.advisory || data?.data || data || {};
  const situation = advisory.situation || advisory.gesamtsituation || '';
  const analyse = advisory.analyse || advisory.analyseergebnisse || '';
  const scores = advisory.scores || advisory.score_dimensionen || {};
  const massnahmen = advisory.massnahmen || advisory.ausgewaehlte_massnahmen || [];
  const handlungsfelder = advisory.handlungsfelder || [];
  const naechsteSchritte = advisory.naechste_schritte || advisory.next_steps || {};
  const callAgenda = advisory.call_agenda || advisory.management_call || '';
  const totalScore = Number(scores.total || scores.gesamt || 0);
  const highlights = advisory.highlights || [];

  const hasContent = situation || analyse || totalScore > 0 || massnahmen.length > 0;

  if (!hasContent) {
    return (
      <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
        <div className="text-5xl mb-4">ð</div>
        <p className="font-medium text-lg">Kein Leitfaden verfügbar</p>
        <p className="text-sm mt-2">
          Für {customer} / {period?.replace(/_/g, '/')} wurde noch kein Gesprächsleitfaden erstellt.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* —— Gesamtsituation ———————————————————————————————————————————— */}
      {situation && (
        <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <h3 className="font-semibold mb-3" style={{ color: 'var(--primary)' }}>
            Gesamtsituation
          </h3>
          <div className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-primary)' }}>
            {situation}
          </div>
        </div>
      )}

      {/* —— Highlights ————————————————————————————————————————————————— */}
      {highlights.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Wichtige Erkenntnisse
          </h3>
          <ul className="space-y-2">
            {highlights.map((h: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 flex-shrink-0">—¢</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* —— Score-Dimensionen —————————————————————————————————————————— */}
      {totalScore > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              Finanzstabilitäts-Score
            </h3>
            <div
              className="text-2xl font-bold px-4 py-1 rounded-xl"
              style={{
                color: totalScore >= 60 ? '#10b981' : totalScore >= 40 ? '#f59e0b' : '#ef4444',
                backgroundColor: totalScore >= 60 ? 'rgba(16,185,129,0.12)' : totalScore >= 40 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
              }}
            >
              {totalScore}/100
            </div>
          </div>
          <div className="space-y-3">
            <ScoreBar label="Leistung (Marge & Ertrag)" value={Number(scores.performance || scores.leistung || 0)} />
            <ScoreBar label="Struktur (Liquidität)" value={Number(scores.structure || scores.struktur || 0)} />
            <ScoreBar label="Trend (Entwicklung)" value={Number(scores.trend || 0)} />
            <ScoreBar label="Stabilität" value={Number(scores.stability || scores.stabilitaet || 0)} />
          </div>
          {advisory.schwaechste_dimension && (
            <div
              className="mt-4 p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <strong>Größter Hebel:</strong> {advisory.schwaechste_dimension}
            </div>
          )}
        </div>
      )}

      {/* —— Analyseergebnisse —————————————————————————————————————————— */}
      {analyse && (
        <div className="card">
          <h3 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Analyseergebnisse
          </h3>
          <div className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-primary)' }}>
            {analyse}
          </div>
        </div>
      )}

      {/* —— Ausgewählte Maßnahmen —————————————————————————————————————— */}
      {massnahmen.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Prioritäre Maßnahmen
          </h3>
          <div className="space-y-3">
            {massnahmen.map((m: any, i: number) => (
              <div
                key={i}
                className="p-4 rounded-xl"
                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border-color)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: 'var(--primary)', color: 'white' }}
                      >
                        {i + 1}
                      </span>
                      <span className="font-semibold text-sm">{m.label || m.action_label || m.titel || `Maßnahme ${i + 1}`}</span>
                    </div>
                    {(m.beschreibung || m.description) && (
                      <p className="text-sm mt-2 ml-8" style={{ color: 'var(--text-secondary)' }}>
                        {m.beschreibung || m.description}
                      </p>
                    )}
                  </div>
                  {(m.impact_eur || m.ebit_potential_eur) != null && (
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold" style={{ color: '#10b981' }}>
                        +{fmtEur(m.impact_eur || m.ebit_potential_eur)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* —— Handlungsfelder ———————————————————————————————————————————— */}
      {handlungsfelder.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Handlungsfelder
          </h3>
          <div className="space-y-2">
            {handlungsfelder.map((h: any, i: number) => (
              <div key={i} className="flex items-start gap-3 text-sm p-2">
                <span className="text-lg">{h.icon || '—¸'}</span>
                <div>
                  <span className="font-medium">{typeof h === 'string' ? h : h.label || h.titel}</span>
                  {h.beschreibung && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{h.beschreibung}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* —— Nächste Schritte ——————————————————————————————————————————— */}
      {(naechsteSchritte.sofort || naechsteSchritte.kurzfristig || naechsteSchritte.mittelfristig) && (
        <div className="card">
          <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Nächste Schritte
          </h3>
          <div className="space-y-4">
            {naechsteSchritte.sofort && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10b981' }} />
                  <span className="text-sm font-semibold">Sofort (0—7 Tage)</span>
                </div>
                <div className="ml-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {Array.isArray(naechsteSchritte.sofort)
                    ? naechsteSchritte.sofort.map((s: string, i: number) => <p key={i} className="mb-1">—¢ {s}</p>)
                    : naechsteSchritte.sofort}
                </div>
              </div>
            )}
            {naechsteSchritte.kurzfristig && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                  <span className="text-sm font-semibold">Kurzfristig (1—4 Wochen)</span>
                </div>
                <div className="ml-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {Array.isArray(naechsteSchritte.kurzfristig)
                    ? naechsteSchritte.kurzfristig.map((s: string, i: number) => <p key={i} className="mb-1">—¢ {s}</p>)
                    : naechsteSchritte.kurzfristig}
                </div>
              </div>
            )}
            {naechsteSchritte.mittelfristig && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f97316' }} />
                  <span className="text-sm font-semibold">Mittelfristig (1—3 Monate)</span>
                </div>
                <div className="ml-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {Array.isArray(naechsteSchritte.mittelfristig)
                    ? naechsteSchritte.mittelfristig.map((s: string, i: number) => <p key={i} className="mb-1">—¢ {s}</p>)
                    : naechsteSchritte.mittelfristig}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* —— Management-Call-Agenda —————————————————————————————————————— */}
      {callAgenda && (
        <div
          className="card"
          style={{ borderLeft: '4px solid var(--accent)', backgroundColor: 'rgba(43,108,176,0.04)' }}
        >
          <h3 className="font-semibold mb-3" style={{ color: 'var(--accent)' }}>
            Management-Call Agenda
          </h3>
          <div className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-primary)' }}>
            {callAgenda}
          </div>
        </div>
      )}
    </div>
  );
}
