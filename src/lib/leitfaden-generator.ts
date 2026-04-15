/**
 * Leitfaden Generator — shared logic for dynamic Gesprächsleitfaden
 * Used by:
 *   - PDF Print page (Seite 5)
 *   - Admin LeitfadenTab (interactive version)
 *
 * Takes raw page data (P1-P4) and generates structured KPI data + HTML content.
 */

// ─── Formatters ────────────────────────────────────────────────────────────────
const fmtE = (n: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const fmtP = (n: number) => `${(n * 100).toFixed(1)}%`;
const signP = (n: number) => (n >= 0 ? `+${fmtP(n)}` : fmtP(n));

// ─── Types ──────────────────────────────────────────────────────────────────────
export interface LeitfadenKPIs {
  revenue: number;
  profit: number;
  marginPct: number;
  costTotal: number;
  costVariable: number;
  bankBalance: number;
  liquidityMonths: number;
  revMom: number;
  profitMom: number;
  statusColor: string;
  payrollQuote: number;
  ebitLuecke: number;
  ebitTarget: number;
  kostenquote: number;
  contracts: any[];
  criticalContracts: any[];
  totalMRR: number;
  scoreLeistung: number;
  scoreStruktur: number;
  scoreTrend: number;
  scoreStabilitaet: number;
  totalScore: number;
  weakestDim: { name: string; score: number };
  stressScenarios: any[];
  actions: any[];
  totalPotential: number;
  benchmarks: any[];
}

// ─── KPI Extraction from raw page data ──────────────────────────────────────────
export function extractKPIs(p1: any, p2: any, p3: any, p4: any): LeitfadenKPIs {
  const d1: any = p1?.data || p1 || {};
  const d2: any = p2?.data || p2 || {};
  const d3: any = p3?.data || p3 || {};
  const d4: any = p4?.data || p4 || {};

  const revenue = Number(d1.revenue || 0);
  const profit = Number(d1.profit || d1.ebit || 0);
  const marginPct = Number(d1.margin_pct || (revenue > 0 ? profit / revenue : 0));
  const costTotal = Math.abs(Number(d1.cost || d1.cost_total || 0));
  const costVariable = Number(d1.cost_variable || d1.payroll_cost || 0);
  const bankBalance = Number(d3.bank_balance_eur || d1.bank_balance_eur || 0);
  const liquidityMonths = Number(d3.liquidity_months || d1.liquidity_months || 0);
  const revMom = Number(d1.revenue_mom_pct || 0);
  const profitMom = Number(d1.profit_mom_pct || 0);
  const statusColor = String(d1.status_color || 'YELLOW');
  const payrollQuote = revenue > 0 ? Math.abs(costVariable) / revenue : 0;

  const ebitTarget = Number(d1.ebit_target || 0);
  const ebitLuecke = Number(d1.ebit_gap || (ebitTarget > 0 ? ebitTarget - profit : 0));
  const kostenquote = revenue > 0 ? costTotal / revenue : 0;

  const contracts: any[] = Array.isArray(d2.contracts) ? d2.contracts : Array.isArray(d2.full_risk) ? d2.full_risk : [];
  const criticalContracts = contracts.filter((c: any) => Number(c.margin_pct || 0) < 0.05);
  const totalMRR = contracts.reduce((s: number, c: any) => s + Number(c.revenue || c.mrr || 0), 0);

  const scoreLeistung = Math.min(25, Math.round(marginPct * 100));
  const scoreStruktur = Math.min(25, Math.round(Math.min(liquidityMonths / 3, 1) * 25));
  const scoreTrend = Math.min(25, profitMom > 0 ? Math.round(Math.min(profitMom * 100, 25)) : Math.max(0, Math.round(12 + profitMom * 100)));
  const scoreStabilitaet = statusColor === 'GREEN' ? 20 : statusColor === 'YELLOW' ? 12 : 5;
  const totalScore = scoreLeistung + scoreStruktur + scoreTrend + scoreStabilitaet;

  const dims = [
    { name: 'Leistung', score: scoreLeistung },
    { name: 'Struktur', score: scoreStruktur },
    { name: 'Trend', score: scoreTrend },
    { name: 'Stabilität', score: scoreStabilitaet },
  ];
  const weakestDim = dims.reduce((a, b) => (a.score < b.score ? a : b));
  const stressScenarios = Array.isArray(d3.stress_scenarios) ? d3.stress_scenarios : [];
  const actions: any[] = Array.isArray(d4.actions) ? d4.actions : [];
  const totalPotential = actions.reduce((s: number, a: any) => s + Number(a.impact_eur || a.ebit_potential_eur || 0), 0);
  const benchmarks: any[] = Array.isArray(d4.benchmarks) ? d4.benchmarks : [];

  return {
    revenue, profit, marginPct, costTotal, costVariable, bankBalance, liquidityMonths,
    revMom, profitMom, statusColor, payrollQuote, ebitLuecke, ebitTarget, kostenquote,
    contracts, criticalContracts, totalMRR,
    scoreLeistung, scoreStruktur, scoreTrend, scoreStabilitaet, totalScore, weakestDim, stressScenarios,
    actions, totalPotential, benchmarks,
  };
}

// ─── Status helpers ──────────────────────────────────────────────────────────────
function getStatus(d: LeitfadenKPIs, marginTargets: { warn: number; good: number }) {
  const isKritisch = d.marginPct < 0.05 || d.statusColor === 'RED';
  const isWarnung = d.marginPct < marginTargets.good || d.statusColor === 'YELLOW';
  const label = isKritisch ? 'KRITISCH' : isWarnung ? 'WARNUNG' : 'STABIL';
  const color = isKritisch ? '#ef4444' : isWarnung ? '#f59e0b' : '#10b981';
  return { isKritisch, isWarnung, label, color };
}

// ─── Score bar as inline HTML ────────────────────────────────────────────────────
function scoreBarHtml(label: string, value: number, max = 25): string {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 60 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  return `
    <div style="margin-bottom:0.6rem">
      <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:0.2rem">
        <span style="color:#888">${label}</span>
        <span style="font-weight:700;color:${color}">${value}/${max}</span>
      </div>
      <div style="height:8px;border-radius:6px;background:#e5e7eb;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:6px"></div>
      </div>
    </div>`;
}

// ─── Generate print-friendly Leitfaden HTML ─────────────────────────────────────
export function generateLeitfadenHtml(
  d: LeitfadenKPIs,
  customerName: string,
  marginTargets: { warn: number; good: number } = { warn: 0.07, good: 0.12 },
): string {
  const s = getStatus(d, marginTargets);

  // ── Build sections ──
  const sections: string[] = [];

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 1: Überblick & Call-Vorbereitung
  // ════════════════════════════════════════════════════════════════════════════
  const kpiGrid = [
    { label: 'EBIT', value: fmtE(d.profit), clr: d.profit >= 0 ? '#10b981' : '#ef4444' },
    { label: 'Marge', value: fmtP(d.marginPct), clr: d.marginPct >= marginTargets.good ? '#10b981' : d.marginPct >= marginTargets.warn ? '#f59e0b' : '#ef4444' },
    { label: 'Umsatz', value: fmtE(d.revenue), clr: '#192231' },
    { label: 'Bankbestand', value: fmtE(d.bankBalance), clr: '#192231' },
    { label: 'Score', value: `${d.totalScore}/100`, clr: d.totalScore >= 60 ? '#10b981' : d.totalScore >= 40 ? '#f59e0b' : '#ef4444' },
    { label: 'Hebelpotenzial', value: fmtE(d.totalPotential), clr: '#10b981' },
  ].map(k => `
    <div style="padding:0.6rem;border-radius:8px;border:1px solid #ddd;text-align:center;min-width:110px">
      <div style="font-size:1.1rem;font-weight:800;color:${k.clr}">${k.value}</div>
      <div style="font-size:0.6rem;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.04em;margin-top:0.1rem">${k.label}</div>
    </div>
  `).join('');

  sections.push(`
    <div style="border-left:4px solid ${s.color};padding-left:1rem;margin-bottom:1.5rem">
      <h3 style="font-size:0.95rem;font-weight:700;color:#192231;margin:0 0 0.3rem">Call-Vorbereitung auf einen Blick</h3>
      <span style="font-size:0.75rem;font-weight:700;padding:0.2rem 0.6rem;border-radius:12px;color:${s.color};background:${s.color}18">${s.label}</span>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;margin-top:0.75rem">${kpiGrid}</div>
    </div>
  `);

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 2: 60-Minuten Zeitplan
  // ════════════════════════════════════════════════════════════════════════════
  const timeline = [
    { t: '0–5 Min', ph: 'Eröffnung', desc: 'Begrüßung, Agenda, Rückblick letzte Maßnahmen' },
    { t: '5–15 Min', ph: 'Gesamtlage', desc: `Status ${s.label}, Marge ${fmtP(d.marginPct)}, Trend besprechen` },
    { t: '15–25 Min', ph: 'Verträge', desc: `${d.criticalContracts.length} kritische von ${d.contracts.length} Verträgen analysieren` },
    { t: '25–35 Min', ph: 'Liquidität', desc: `Bankbestand ${fmtE(d.bankBalance)}, Reichweite ${d.liquidityMonths.toFixed(1)} Monate, Score ${d.totalScore}/100` },
    { t: '35–50 Min', ph: 'Maßnahmen', desc: `${d.actions.length} EBIT-Hebel (${fmtE(d.totalPotential)}), gemeinsam 3–5 auswählen` },
    { t: '50–60 Min', ph: 'Abschluss', desc: 'Zusammenfassung, Verantwortlichkeiten, nächster Termin' },
  ].map(r => `
    <div style="display:flex;gap:0.6rem;padding:0.35rem 0;border-bottom:1px solid #eee;align-items:center">
      <span style="font-size:0.72rem;font-weight:700;color:#B08A6A;min-width:60px">${r.t}</span>
      <span style="font-size:0.78rem;font-weight:600;color:#192231;min-width:90px">${r.ph}</span>
      <span style="font-size:0.75rem;color:#666">${r.desc}</span>
    </div>
  `).join('');

  sections.push(`
    <div style="margin-bottom:1.5rem">
      <h3 style="font-size:0.95rem;font-weight:700;color:#192231;margin:0 0 0.5rem">60-Minuten Zeitplan</h3>
      ${timeline}
    </div>
  `);

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 3: Gesamtlage (Seite 1)
  // ════════════════════════════════════════════════════════════════════════════
  const s1Speech = s.isKritisch
    ? `Lassen Sie uns zuerst auf die Gesamtlage schauen. Ich sage Ihnen gleich vorab: Wir haben diesen Monat bei ${customerName} ein Warnsignal — die Marge liegt bei ${fmtP(d.marginPct)}. Aber lassen Sie uns gemeinsam hinschauen, dann sehen Sie sofort, woher das kommt.`
    : `Lassen Sie uns zuerst auf die Gesamtlage schauen. ${customerName} steht diesen Monat bei einer Marge von ${fmtP(d.marginPct)} — ${d.marginPct >= marginTargets.good ? 'das liegt im Zielbereich' : `unser Ziel liegt bei ${fmtP(marginTargets.good)}`}. Ich zeige Ihnen, was sich gegenüber dem Vormonat verändert hat.`;

  const kpiExplain = [
    { label: 'EBIT', value: fmtE(d.profit), text: d.profit < 0 ? `${customerName} macht diesen Monat ${fmtE(Math.abs(d.profit))} Verlust. Nach allen Kosten bleibt nichts übrig.` : `${customerName} verdient diesen Monat ${fmtE(d.profit)} aus dem operativen Geschäft (Gewinn vor Steuern und Zinsen).` },
    { label: 'Marge', value: fmtP(d.marginPct), text: d.marginPct < marginTargets.warn ? `Kritisch niedrig. Von jedem Euro Umsatz bleiben nur ${(d.marginPct * 100).toFixed(0)} Cent. Branchenziel: ${fmtP(marginTargets.good)}.` : d.marginPct < marginTargets.good ? `Im Korridor, aber unter dem Ziel von ${fmtP(marginTargets.good)}. Hier ist Luft nach oben.` : `Über dem Branchenziel von ${fmtP(marginTargets.good)} — gute Arbeit.` },
    { label: 'MoM-Trend', value: signP(d.profitMom), text: d.profitMom > 0.03 ? `Gewinn ${fmtP(Math.abs(d.profitMom))} gestiegen — positive Richtung.` : d.profitMom < -0.03 ? `Gewinn ${fmtP(Math.abs(d.profitMom))} gefallen.${d.profitMom < -0.05 ? ' Kein Ausreißer — genauer hinschauen.' : ' Beobachten.'}` : 'Stabil gegenüber Vormonat.' },
    { label: 'EBIT-Lücke', value: d.ebitLuecke > 0 ? `-${fmtE(d.ebitLuecke)}` : '✓ Im Ziel', text: d.ebitLuecke > 0 ? `Zum Branchenziel fehlen ${fmtE(d.ebitLuecke)}/Monat (${fmtE(d.ebitLuecke * 12)}/Jahr). Seite 4 zeigt woher wir das holen können.` : 'Im oder über dem Branchenziel.' },
  ].map(k => `
    <div style="padding:0.5rem 0.6rem;border-radius:6px;margin-bottom:0.4rem;background:#f9f9f9;border:1px solid #eee">
      <div style="display:flex;justify-content:space-between;margin-bottom:0.2rem">
        <span style="font-weight:700;font-size:0.78rem;color:#192231">${k.label}</span>
        <span style="font-weight:700;font-size:0.8rem;color:#B08A6A">${k.value}</span>
      </div>
      <p style="font-size:0.75rem;color:#666;margin:0;line-height:1.5">${k.text}</p>
    </div>
  `).join('');

  sections.push(`
    <div style="margin-bottom:1.5rem">
      <h3 style="font-size:0.95rem;font-weight:700;color:#192231;border-bottom:2px solid #B08A6A;padding-bottom:0.3rem;margin:0 0 0.75rem">Seite 1 – Gesamtlage</h3>
      <div style="margin:0.5rem 0 0.75rem;padding:0.6rem 0.8rem;border-left:3px solid #B08A6A;background:rgba(176,138,106,0.04);border-radius:0 6px 6px 0;font-style:italic;font-size:0.8rem;color:#444;line-height:1.6">«${s1Speech}»</div>
      ${kpiExplain}
    </div>
  `);

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 4: Vertragsanalyse (Seite 2)
  // ════════════════════════════════════════════════════════════════════════════
  const s2Speech = d.contracts.length > 0
    ? `Jetzt schauen wir uns an, woher Ihr Ergebnis kommt. Sie haben ${d.contracts.length} aktive Verträge. Davon sind ${d.criticalContracts.length} unter 5% Marge${d.criticalContracts.length > 0 ? ' — das sind die, die wir jetzt genauer anschauen.' : ' — eine gute Verteilung.'}`
    : 'Wir schauen uns die einzelnen Verträge an, um zu sehen, wo der Schuh drückt.';

  let criticalHtml = '';
  if (d.criticalContracts.length > 0) {
    criticalHtml = d.criticalContracts.slice(0, 5).map((c: any, i: number) => {
      const cM = Number(c.margin_pct || 0);
      const cR = Number(c.revenue || c.mrr || 0);
      const cP = Number(c.profit || c.ebit || 0);
      const cN = c.contract_name || c.action_label || `Vertrag ${i + 1}`;
      return `
        <div style="padding:0.5rem 0.6rem;border-radius:6px;margin-bottom:0.4rem;background:rgba(239,68,68,0.03);border:1px solid rgba(239,68,68,0.15)">
          <div style="display:flex;justify-content:space-between;margin-bottom:0.15rem">
            <span style="font-weight:700;font-size:0.8rem;color:#192231">${cN}</span>
            <span style="font-weight:700;color:${cM < 0 ? '#ef4444' : '#f59e0b'};font-size:0.8rem">${fmtP(cM)}</span>
          </div>
          <p style="font-size:0.72rem;color:#666;margin:0">Umsatz ${fmtE(cR)} · EBIT ${fmtE(cP)}${cM < 0 ? ' — Verlustvertrag!' : ' — unter Branchenziel'}</p>
        </div>`;
    }).join('');
    criticalHtml = `<div style="margin-top:0.5rem"><strong style="font-size:0.8rem;color:#ef4444">${d.criticalContracts.length} kritische Verträge:</strong>${criticalHtml}</div>`;
  }

  sections.push(`
    <div style="margin-bottom:1.5rem">
      <h3 style="font-size:0.95rem;font-weight:700;color:#192231;border-bottom:2px solid #B08A6A;padding-bottom:0.3rem;margin:0 0 0.75rem">Seite 2 – Vertragsanalyse</h3>
      <div style="margin:0.5rem 0 0.75rem;padding:0.6rem 0.8rem;border-left:3px solid #B08A6A;background:rgba(176,138,106,0.04);border-radius:0 6px 6px 0;font-style:italic;font-size:0.8rem;color:#444;line-height:1.6">«${s2Speech}»</div>
      ${criticalHtml}
    </div>
  `);

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 5: Liquidität (Seite 3) mit Score
  // ════════════════════════════════════════════════════════════════════════════
  const liqSpeech = `Jetzt schauen wir auf die Liquidität. ${d.bankBalance > 0 ? `${customerName} hat aktuell ${fmtE(d.bankBalance)} auf dem Konto.` : ''} ${d.liquidityMonths < 1.5 ? `Das reicht nur für ${d.liquidityMonths.toFixed(1)} Monate — da müssen wir aufpassen.` : d.liquidityMonths < 3 ? `Das reicht für ${d.liquidityMonths.toFixed(1)} Monate — ein solider, aber nicht üppiger Puffer.` : `Das reicht für ${d.liquidityMonths.toFixed(1)} Monate — ein komfortabler Puffer.`}`;

  const scoreBars = [
    scoreBarHtml('Leistung (Marge & Ertrag)', d.scoreLeistung),
    scoreBarHtml('Struktur (Liquidität)', d.scoreStruktur),
    scoreBarHtml('Trend (Entwicklung)', d.scoreTrend),
    scoreBarHtml('Stabilität', d.scoreStabilitaet),
  ].join('');

  const scoreColor = d.totalScore >= 60 ? '#10b981' : d.totalScore >= 40 ? '#f59e0b' : '#ef4444';
  const weakestExplain = d.weakestDim.name === 'Leistung' ? 'die Marge muss rauf' : d.weakestDim.name === 'Struktur' ? 'die Liquiditätsreserve muss wachsen' : d.weakestDim.name === 'Trend' ? 'die Richtung muss sich drehen' : 'wir brauchen mehr Stabilität';

  sections.push(`
    <div style="margin-bottom:1.5rem">
      <h3 style="font-size:0.95rem;font-weight:700;color:#192231;border-bottom:2px solid #B08A6A;padding-bottom:0.3rem;margin:0 0 0.75rem">Seite 3 – Liquidität & Finanzstabilität</h3>
      <div style="margin:0.5rem 0 0.75rem;padding:0.6rem 0.8rem;border-left:3px solid #B08A6A;background:rgba(176,138,106,0.04);border-radius:0 6px 6px 0;font-style:italic;font-size:0.8rem;color:#444;line-height:1.6">«${liqSpeech}»</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem">
        <span style="font-size:0.8rem;color:#666">Finanzstabilitäts-Score</span>
        <span style="font-size:1.3rem;font-weight:800;padding:0.15rem 0.5rem;border-radius:8px;color:${scoreColor};background:${scoreColor}18">${d.totalScore}/100</span>
      </div>
      ${scoreBars}
      <p style="font-size:0.78rem;color:#666;margin-top:0.5rem;line-height:1.5">Schwächste Dimension: <strong style="color:#192231">${d.weakestDim.name}</strong> (${d.weakestDim.score}/25) — ${weakestExplain}. Wenn wir das verbessern, steigt der Gesamtscore am stärksten.</p>
    </div>
  `);

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 6: Maßnahmen (Seite 4)
  // ════════════════════════════════════════════════════════════════════════════
  const s4Speech = `Jetzt wird es konkret. Wir haben ${d.actions.length} EBIT-Hebel identifiziert mit einem Gesamtpotenzial von ${fmtE(d.totalPotential)} pro Monat. Das sind ${fmtE(d.totalPotential * 12)} im Jahr. Lassen Sie uns gemeinsam die 3 bis 5 Maßnahmen auswählen, die den größten Effekt haben.`;

  let actionsHtml = '';
  if (d.actions.length > 0) {
    actionsHtml = d.actions.slice(0, 7).map((a: any, i: number) => {
      const impact = Number(a.impact_eur || a.ebit_potential_eur || 0);
      const margin = Number(a.margin_pct || 0);
      const name = a.action_label || a.contract_name || `Maßnahme ${i + 1}`;
      const hint = margin < 0 ? 'Verlustvertrag — Kündigung oder Preisanpassung' : margin < 0.05 ? 'Stundensatz erhöhen, Einsatzplanung optimieren' : margin < marginTargets.good ? 'Preisindex-Klausel, Zusatzleistungen' : 'Im Zielbereich — Konditionen halten';
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.4rem 0.6rem;border-radius:6px;margin-bottom:0.3rem;background:${i % 2 === 0 ? '#f9f9f9' : '#fff'};border:1px solid #eee">
          <div>
            <span style="display:inline-flex;width:18px;height:18px;border-radius:50%;background:#B08A6A;color:#fff;align-items:center;justify-content:center;font-size:0.6rem;font-weight:700;margin-right:0.4rem">${i + 1}</span>
            <span style="font-weight:600;font-size:0.78rem;color:#192231">${name}</span>
            <span style="font-size:0.65rem;color:#888;margin-left:0.4rem">${hint}</span>
          </div>
          <span style="font-weight:700;color:#10b981;font-size:0.82rem;white-space:nowrap">+${fmtE(impact)}</span>
        </div>`;
    }).join('');
    actionsHtml = `<div style="margin-top:0.5rem">${actionsHtml}</div>`;
  }

  sections.push(`
    <div style="margin-bottom:1.5rem">
      <h3 style="font-size:0.95rem;font-weight:700;color:#192231;border-bottom:2px solid #B08A6A;padding-bottom:0.3rem;margin:0 0 0.75rem">Seite 4 – Maßnahmen & EBIT-Hebel</h3>
      <div style="margin:0.5rem 0 0.75rem;padding:0.6rem 0.8rem;border-left:3px solid #B08A6A;background:rgba(176,138,106,0.04);border-radius:0 6px 6px 0;font-style:italic;font-size:0.8rem;color:#444;line-height:1.6">«${s4Speech}»</div>
      ${actionsHtml}
    </div>
  `);

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 7: Zusammenfassung & Nächste Schritte
  // ════════════════════════════════════════════════════════════════════════════
  const summary = `
    <div style="padding:0.6rem 0.8rem;border-radius:6px;background:#f9f9f9;border:1px solid #eee;font-size:0.78rem;color:#444;line-height:1.7;margin-bottom:0.75rem">
      <strong style="color:#192231">Gesamtlage:</strong> ${s.label}, Marge ${fmtP(d.marginPct)} ${d.ebitLuecke > 0 ? `(${fmtE(d.ebitLuecke)} unter Branchenziel)` : '(im Ziel)'}<br>
      <strong style="color:#192231">Verträge:</strong> ${d.criticalContracts.length} von ${d.contracts.length} kritisch<br>
      <strong style="color:#192231">Liquidität:</strong> ${fmtE(d.bankBalance)} Bankbestand, ${d.liquidityMonths.toFixed(1)} Monate Reichweite, Score ${d.totalScore}/100<br>
      <strong style="color:#192231">Potenzial:</strong> ${fmtE(d.totalPotential)} EBIT p.M. aus ${d.actions.length} identifizierten Hebeln
    </div>
  `;

  const sofortItems = s.isKritisch
    ? ['Liquiditätsplan erstellen', 'Top-3 Maßnahmen starten', 'Kritische Verträge nachverhandeln']
    : ['Ausgewählte Maßnahmen starten', 'Verantwortlichkeiten kommunizieren'];

  const steps = [
    { phase: 'Sofort (0–7 Tage)', color: '#10b981', items: sofortItems },
    { phase: 'Kurzfristig (1–4 Wochen)', color: '#f59e0b', items: ['Zwischenstand bei Maßnahmen-Verantwortlichen einholen', 'Monatsreport versenden'] },
    { phase: 'Nächster Call', color: '#f97316', items: ['Maßnahmen-Review als Einstieg', 'Neue Monatsdaten besprechen', 'Pipeline anpassen'] },
  ].map(b => `
    <div style="margin-bottom:0.6rem">
      <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.2rem">
        <span style="width:8px;height:8px;border-radius:50%;background:${b.color};display:inline-block"></span>
        <span style="font-size:0.78rem;font-weight:700;color:#192231">${b.phase}</span>
      </div>
      ${b.items.map(it => `<p style="font-size:0.72rem;color:#666;margin:0 0 0.1rem 1.1rem">• ${it}</p>`).join('')}
    </div>
  `).join('');

  sections.push(`
    <div>
      <h3 style="font-size:0.95rem;font-weight:700;color:#192231;border-bottom:2px solid #B08A6A;padding-bottom:0.3rem;margin:0 0 0.75rem">Zusammenfassung & Nächste Schritte</h3>
      ${summary}
      <div style="border-left:4px solid #10b981;padding-left:0.75rem">${steps}</div>
      <div style="margin-top:0.75rem;padding:0.6rem 0.8rem;border-left:3px solid #B08A6A;background:rgba(176,138,106,0.04);border-radius:0 6px 6px 0;font-style:italic;font-size:0.8rem;color:#444;line-height:1.6">
        «Sie bekommen in den nächsten Tagen den Monatsreport. Da steht alles drin — inklusive der konkreten Maßnahmen mit Euro-Effekt und Verantwortlichkeiten. Beim nächsten Call schauen wir als Erstes, wie sich die Maßnahmen entwickelt haben.»
      </div>
    </div>
  `);

  return sections.join('\n');
}
