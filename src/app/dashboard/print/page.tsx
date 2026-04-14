'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

/**
 * Printable PDF export page
 * Loads all 4 pages of dashboard data and renders them in print-friendly HTML.
 * Opens via: /dashboard/print?customer=...&period=...
 * Triggers window.print() automatically when all data is loaded.
 */

const fmt = (n: number, decimals = 0) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);

const fmtEur = (n: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number) =>
  new Intl.NumberFormat('de-DE', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

export default function PrintPage() {
  const searchParams = useSearchParams();
  const customer = searchParams.get('customer') || '';
  const period = searchParams.get('period') || '';

  const [p1, setP1] = useState<any>(null);
  const [p2, setP2] = useState<any>(null);
  const [p3, setP3] = useState<any>(null);
  const [p4, setP4] = useState<any>(null);
  const [leitfaden, setLeitfaden] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const printed = useRef(false);

  useEffect(() => {
    if (!customer || !period) {
      setError('Kein Mandant oder keine Periode angegeben.');
      setLoading(false);
      return;
    }

    const loadAll = async () => {
      try {
        const [r1, r2, r3, r4] = await Promise.all([
          api.fetchPageData(1, customer, period),
          api.fetchPageData(2, customer, period),
          api.fetchPageData(3, customer, period),
          api.fetchPageData(4, customer, period),
        ]);
        setP1(r1);
        setP2(r2);
        setP3(r3);
        setP4(r4);

        // Try loading Leitfaden (optional — skip on error)
        try {
          const token = api.getToken() || '';
          const lr = await fetch(
            `/api/admin/leitfaden?customer=${encodeURIComponent(customer)}&period=${encodeURIComponent(period)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const ld = await lr.json();
          if (ld.leitfaden_html) setLeitfaden(ld.leitfaden_html);
          else if (ld.leitfaden) setLeitfaden(`<p>${String(ld.leitfaden).replace(/\n/g,'<br>')}</p>`);
        } catch {
          // Leitfaden is optional
        }
      } catch (err: any) {
        setError(`Fehler beim Laden: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [customer, period]);

  // Auto-print once all data is loaded
  useEffect(() => {
    if (!loading && !error && p1 && p2 && p3 && p4 && !printed.current) {
      printed.current = true;
      setTimeout(() => window.print(), 500);
    }
  }, [loading, error, p1, p2, p3, p4]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Dashboard-Daten werden geladen...</p>
          <p className="text-sm text-gray-400 mt-1">{customer} · {period.replace(/_/g, '/')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-700">
          <p className="text-xl font-bold mb-2">Fehler</p>
          <p>{error}</p>
          <button onClick={() => window.close()} className="mt-4 text-sm underline">Schließen</button>
        </div>
      </div>
    );
  }

  const d1 = p1?.data || {};
  const d3 = p3?.data || p3 || {};
  const d4 = p4 || {};

  const contracts: any[] = p2?.contracts || p2?.data?.contracts || [];
  const actions: any[] = d4.actions || [];
  const tracker: any[] = d4.tracker || [];
  const fokus: any = d4.fokus;

  const periodLabel = period.replace(/_/g, '/');
  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="print-report" style={{ fontFamily: "'Georgia', serif", color: '#192231', maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>

      {/* ── Print-only button bar (hidden in print) ── */}
      <div className="no-print" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
        <button
          onClick={() => window.print()}
          style={{ padding: '0.75rem 2rem', backgroundColor: '#B08A6A', color: 'white', border: 'none', borderRadius: '6px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}
        >
          🖨️ Als PDF speichern
        </button>
        <button
          onClick={() => window.close()}
          style={{ padding: '0.75rem 1.5rem', backgroundColor: '#192231', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.9rem', cursor: 'pointer' }}
        >
          Schließen
        </button>
      </div>

      {/* ══════════════════════════════════════════════
          PAGE 1: Cover + Gesamtlage
      ══════════════════════════════════════════════ */}
      <div className="page-break-after">
        {/* Cover */}
        <div style={{ textAlign: 'center', marginBottom: '3rem', paddingTop: '2rem' }}>
          <div style={{ width: '60px', height: '4px', backgroundColor: '#B08A6A', margin: '0 auto 1.5rem' }} />
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0 0 0.5rem', color: '#192231' }}>
            Steuerungs-Dashboard
          </h1>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'normal', color: '#B08A6A', margin: '0 0 1rem' }}>
            {customer.replace(/_/g, ' ')}
          </h2>
          <p style={{ color: '#666', fontSize: '0.9rem', margin: '0' }}>
            Berichtsperiode: <strong>{periodLabel}</strong> &nbsp;·&nbsp; Erstellt: {today}
          </p>
          <div style={{ width: '60px', height: '4px', backgroundColor: '#B08A6A', margin: '2rem auto 0' }} />
        </div>

        {/* Gesamtlage KPIs */}
        <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', borderBottom: '3px solid #B08A6A', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
          Seite 1 – Gesamtlage
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Umsatz', value: fmtEur(d1.revenue || 0) },
            { label: 'EBIT', value: fmtEur(d1.profit || 0), highlight: true },
            { label: 'Marge', value: fmtPct(d1.margin_pct || 0) },
            { label: 'Kostenquote', value: fmtPct(Math.abs(d1.cost || 0) / Math.max(d1.revenue || 1, 1)) },
            { label: 'Personalkosten', value: fmtEur(Math.abs(d1.payroll_cost || d1.cost_variable || 0)) },
            { label: 'Status', value: d1.status_color === 'GREEN' ? '🟢 Gut' : d1.status_color === 'YELLOW' ? '🟡 Warnung' : '🔴 Kritisch' },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                border: item.highlight ? '2px solid #B08A6A' : '1px solid #ddd',
                borderRadius: '6px',
                padding: '1rem',
                backgroundColor: item.highlight ? 'rgba(176,138,106,0.05)' : '#fff',
              }}
            >
              <p style={{ margin: '0 0 0.25rem', fontSize: '0.7rem', textTransform: 'uppercase', color: '#888', letterSpacing: '0.05em' }}>{item.label}</p>
              <p style={{ margin: '0', fontSize: '1.3rem', fontWeight: 'bold', color: item.highlight ? '#B08A6A' : '#192231' }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          PAGE 2: Vertragsanalyse
      ══════════════════════════════════════════════ */}
      <div className="page-break-after">
        <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', borderBottom: '3px solid #B08A6A', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
          Seite 2 – Vertragsanalyse
        </h2>

        {contracts.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#192231', color: 'white' }}>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Vertrag</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>MRR</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Marge</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>Risiko</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Nächstes Datum</th>
              </tr>
            </thead>
            <tbody>
              {contracts.slice(0, 20).map((c: any, idx: number) => {
                const mrr = c.mrr_eur || c.contract_value || c.monthly_revenue || 0;
                const margin = c.margin_pct || c.ebit_margin || 0;
                const risk = c.risk_level || c.contract_risk || '';
                const riskColor = risk === 'HIGH' || risk === 'HOCH' ? '#e74c3c' : risk === 'MEDIUM' || risk === 'MITTEL' ? '#f39c12' : '#2ecc71';
                return (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white', borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{c.contract_name || c.name || `Vertrag ${idx + 1}`}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{fmtEur(mrr)}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: margin >= 0.07 ? '#2ecc71' : '#e74c3c', fontWeight: '600' }}>
                      {fmtPct(margin)}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: riskColor, fontWeight: '600' }}>{risk || '–'}</td>
                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#666' }}>
                      {c.next_renewal_date || c.end_date || '–'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p style={{ color: '#888' }}>Keine Vertragsdaten verfügbar.</p>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          PAGE 3: Liquiditätsstabilität
      ══════════════════════════════════════════════ */}
      <div className="page-break-after">
        <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', borderBottom: '3px solid #B08A6A', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
          Seite 3 – Liquiditätsstabilität
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Bankbestand', value: fmtEur(d3.bank_balance_eur || d3.bank_balance || 0) },
            { label: 'Reichweite', value: `${fmt(d3.liquidity_months || 0, 1)} Monate` },
            { label: 'Break-Even MRR', value: fmtEur(d3.break_even_revenue || d3.breakeven_revenue || 0) },
            { label: 'Ø Monatliche Kosten', value: fmtEur(Math.abs(d3.avg_monthly_cost || d3.avg_cost || 0)) },
            { label: 'Liquiditäts-Score', value: `${Math.round(d3.liquidity_score || d3.score || 0)}/100` },
            { label: 'Status', value: (d3.liquidity_months || 0) >= 3 ? '🟢 Sicher' : (d3.liquidity_months || 0) >= 1.5 ? '🟡 Anspannung' : '🔴 Kritisch' },
          ].map((item, idx) => (
            <div key={idx} style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '1rem' }}>
              <p style={{ margin: '0 0 0.25rem', fontSize: '0.7rem', textTransform: 'uppercase', color: '#888' }}>{item.label}</p>
              <p style={{ margin: '0', fontSize: '1.2rem', fontWeight: 'bold', color: '#192231' }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          PAGE 4: Maßnahmen & Aktionsplan
      ══════════════════════════════════════════════ */}
      <div className="page-break-after">
        <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', borderBottom: '3px solid #B08A6A', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
          Seite 4 – Maßnahmen & Aktionsplan
        </h2>

        {/* Monatsfokus */}
        {fokus && (fokus.impact_eur || fokus.ebit_potential_eur) ? (
          <div style={{ backgroundColor: '#B08A6A', borderRadius: '8px', padding: '1.25rem', color: 'white', marginBottom: '1.5rem' }}>
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.85 }}>🎯 MONATSFOKUS</p>
            <p style={{ margin: '0', fontSize: '1.1rem', fontWeight: 'bold' }}>{fokus.action_label || '–'}</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', opacity: 0.9 }}>
              EBIT-Potenzial: {fmtEur(fokus.impact_eur || fokus.ebit_potential_eur || 0)}
            </p>
          </div>
        ) : null}

        {/* Actions */}
        {actions.length > 0 && (
          <>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: '#192231' }}>Maßnahmenpool</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#192231', color: 'white' }}>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Maßnahme</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>EBIT-Potenzial</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Priorität</th>
                </tr>
              </thead>
              <tbody>
                {actions.slice(0, 15).map((a: any, idx: number) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white', borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{a.action_label || a.contract_name || '–'}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '600', color: '#B08A6A' }}>
                      {(a.impact_eur || a.ebit_potential_eur) ? fmtEur(a.impact_eur || a.ebit_potential_eur) : '–'}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                      {a.priority_score || a.fokus_score ? Math.round(a.priority_score || a.fokus_score) : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Realization Tracker */}
        {tracker.length > 0 && (
          <>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.75rem', color: '#192231' }}>Realisierungstracker</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#192231', color: 'white' }}>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Maßnahme</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Ziel-EBIT</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Periode</th>
                </tr>
              </thead>
              <tbody>
                {tracker.map((t: any, idx: number) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white', borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{t.action_label || '–'}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{fmtEur(t.target_ebit_eur || 0)}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: '600', color: t.status === 'Umgesetzt' ? '#2ecc71' : t.status === 'In Arbeit' ? '#f39c12' : '#e74c3c' }}>
                      {t.status || '–'}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#666' }}>{t.month_label || t.period_date || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          PAGE 5: Gesprächsleitfaden (if available)
      ══════════════════════════════════════════════ */}
      {leitfaden && (
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', borderBottom: '3px solid #B08A6A', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
            Seite 5 – Gesprächsleitfaden
          </h2>
          <div
            style={{ lineHeight: 1.7, fontSize: '0.9rem' }}
            dangerouslySetInnerHTML={{ __html: leitfaden }}
          />
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '3rem', paddingTop: '1rem', borderTop: '1px solid #ddd', textAlign: 'center', fontSize: '0.75rem', color: '#aaa' }}>
        Meyer Decision GmbH · Steuerungs-Dashboard · {customer.replace(/_/g, ' ')} · {periodLabel} · {today}
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .page-break-after { page-break-after: always; break-after: page; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
