'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Lead } from '@/lib/internal-os/types';
import { SEED_LEADS } from '@/lib/internal-os/demo-data';
import { SEED_MANDATES } from '@/lib/internal-os/demo-data';
import { SEED_OPERATIONS } from '@/lib/internal-os/demo-data';
import { formatCurrency } from '@/lib/internal-os/utils';

const LEADS_STORAGE_KEY = 'meyer-internal-os-leads';

function loadLeads(): Lead[] {
  if (typeof window === 'undefined') return SEED_LEADS;
  try {
    const stored = localStorage.getItem(LEADS_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return SEED_LEADS;
}

export default function DashboardHome() {
  const [leads, setLeads] = useState<Lead[]>(SEED_LEADS);

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    setLeads(loadLeads());
  }, []);

  // ── CRM KPIs ────────────────────────────────────────────
  const activeLeads = leads.filter(l => !l.is_archived && l.pipeline_status !== 'verloren');
  const hotLeads = activeLeads.filter(l => l.icp_score >= 70);
  const inPipeline = activeLeads.filter(l =>
    ['kontaktiert', 'qualifiziert', 'angebot', 'verhandlung'].includes(l.pipeline_status)
  );
  const wonLeads = activeLeads.filter(l => l.pipeline_status === 'gewonnen');

  // ── Mandate KPIs ────────────────────────────────────────
  const activeMandates = SEED_MANDATES.filter(m => m.mandate_status === 'active');
  const totalMRR = activeMandates.reduce((s, m) => s + (m.monatliches_honorar || 0), 0);

  // ARR = Honorar × Monate innerhalb des laufenden Kalenderjahres (max. 12)
  const currentYear = new Date().getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd   = new Date(currentYear, 11, 31);
  function calcARRMonths(m: typeof SEED_MANDATES[0]) {
    const start = m.vertragsbeginn ? new Date(m.vertragsbeginn) : yearStart;
    const end   = m.vertragsende  ? new Date(m.vertragsende)   : yearEnd;
    const effStart = start < yearStart ? yearStart : start;
    const effEnd   = end   > yearEnd   ? yearEnd   : end;
    if (effEnd <= effStart) return 0;
    const months = (effEnd.getFullYear() - effStart.getFullYear()) * 12 +
      (effEnd.getMonth() - effStart.getMonth());
    return Math.max(months, 1);
  }
  const totalARR = activeMandates.reduce((s, m) =>
    s + (m.monatliches_honorar || 0) * calcARRMonths(m), 0);

  // ── Operations KPIs ─────────────────────────────────────
  const opsGruen = SEED_OPERATIONS.filter(c => c.ampel_status === 'GRUEN').length;
  const opsGelb = SEED_OPERATIONS.filter(c => c.ampel_status === 'GELB').length;
  const opsRot = SEED_OPERATIONS.filter(c => c.ampel_status === 'ROT').length;

  // ── Nächste Aktionen ────────────────────────────────────
  const upcoming = activeLeads
    .filter(l => l.next_action && l.next_action_date)
    .sort((a, b) => (a.next_action_date || '').localeCompare(b.next_action_date || ''))
    .slice(0, 5);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-manrope text-2xl font-bold text-navy">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Überblick über CRM, Mandate und Operations &middot; Stand: {new Date().toLocaleDateString('de-DE')}
        </p>
      </div>

      {/* Top KPI Row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="text-sm text-gray-400 mb-1">MRR</div>
          <div className="font-manrope text-3xl font-bold text-copper">{formatCurrency(totalMRR)}</div>
          <div className="text-xs text-gray-300 mt-1">aus {activeMandates.length} aktiven Mandaten</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="text-sm text-gray-400 mb-1">ARR {currentYear}</div>
          <div className="font-manrope text-3xl font-bold text-navy">{formatCurrency(totalARR)}</div>
          <div className="text-xs text-gray-300 mt-1">Kalender-Jahr {currentYear}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="text-sm text-gray-400 mb-1">Hot Leads (ICP &ge; 70)</div>
          <div className="font-manrope text-3xl font-bold text-navy">{hotLeads.length}</div>
          <div className="text-xs text-gray-300 mt-1">von {activeLeads.length} gesamt</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="text-sm text-gray-400 mb-1">In Pipeline</div>
          <div className="font-manrope text-3xl font-bold text-navy">{inPipeline.length}</div>
          <div className="text-xs text-gray-300 mt-1">{wonLeads.length} gewonnen</div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Ampel Status */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-manrope font-bold text-navy">Operativer Status</h2>
            <Link href="/operations" className="text-xs text-copper hover:text-copper/80 font-medium">Alle anzeigen &rarr;</Link>
          </div>
          <div className="flex gap-4">
            <div className="flex-1 bg-green-50 rounded-xl p-4 text-center">
              <div className="w-8 h-8 rounded-full bg-green-500 mx-auto mb-2 flex items-center justify-center text-white font-bold">{opsGruen}</div>
              <div className="text-xs font-medium text-green-700">Alles OK</div>
            </div>
            <div className="flex-1 bg-amber-50 rounded-xl p-4 text-center">
              <div className="w-8 h-8 rounded-full bg-amber-400 mx-auto mb-2 flex items-center justify-center text-white font-bold">{opsGelb}</div>
              <div className="text-xs font-medium text-amber-700">In Bearbeitung</div>
            </div>
            <div className="flex-1 bg-red-50 rounded-xl p-4 text-center">
              <div className="w-8 h-8 rounded-full bg-red-500 mx-auto mb-2 flex items-center justify-center text-white font-bold">{opsRot}</div>
              <div className="text-xs font-medium text-red-700">Aktion nötig</div>
            </div>
          </div>

          {/* Kunden mit Aktion nötig */}
          {opsRot > 0 && (
            <div className="mt-4 space-y-2">
              {SEED_OPERATIONS.filter(c => c.ampel_status === 'ROT').map(c => (
                <div key={c.customer_id} className="flex items-center justify-between bg-red-50/50 rounded-lg px-3 py-2">
                  <div>
                    <div className="text-sm font-medium text-navy">{c.company_name}</div>
                    <div className="text-[11px] text-gray-400">{c.ansprechpartner}</div>
                  </div>
                  <div className="text-[11px] text-red-600 font-medium">
                    {!c.daten_erhalten ? 'Keine Daten' : !c.daten_valide ? 'Nicht validiert' : 'Call offen'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nächste Aktionen */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-manrope font-bold text-navy">Nächste Aktionen</h2>
            <Link href="/crm" className="text-xs text-copper hover:text-copper/80 font-medium">CRM öffnen &rarr;</Link>
          </div>
          <div className="space-y-3">
            {upcoming.map(lead => {
              const isOverdue = lead.next_action_date && lead.next_action_date < today;
              const isToday = lead.next_action_date === today;
              return (
                <div key={lead.lead_id} className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ${
                  isOverdue ? 'bg-red-50/50' : isToday ? 'bg-amber-50/50' : 'bg-offwhite/50'
                }`}>
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    isOverdue ? 'bg-red-500' : isToday ? 'bg-amber-400' : 'bg-gray-300'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-navy">{lead.company_name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
                        ICP {lead.icp_score}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{lead.next_action}</div>
                  </div>
                  <div className={`text-[11px] font-medium shrink-0 ${
                    isOverdue ? 'text-red-600' : isToday ? 'text-amber-600' : 'text-gray-400'
                  }`}>
                    {isOverdue ? 'Überfällig' : isToday ? 'Heute' : lead.next_action_date}
                  </div>
                </div>
              );
            })}
            {upcoming.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-sm">Keine offenen Aktionen</div>
            )}
          </div>
        </div>
      </div>

      {/* Mandate Overview Row */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-manrope font-bold text-navy">Aktive Mandate</h2>
          <Link href="/mandate" className="text-xs text-copper hover:text-copper/80 font-medium">Alle anzeigen &rarr;</Link>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {activeMandates.map(m => (
            <div key={m.customer_id} className="bg-offwhite/50 rounded-xl p-4">
              <div className="text-sm font-semibold text-navy leading-tight">{m.company_name}</div>
              <div className="text-xs text-gray-400 mt-0.5">{m.gebuchte_dienstleistung || '–'}</div>
              <div className="font-manrope text-lg font-bold text-copper mt-2">
                {m.monatliches_honorar ? formatCurrency(m.monatliches_honorar) : '–'}
              </div>
              <div className="text-[10px] text-gray-300">pro Monat</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <Link href="/crm" className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-copper/30 hover:shadow-md transition-all">
          <div className="text-2xl mb-2">👥</div>
          <div className="font-manrope font-bold text-navy group-hover:text-copper transition-colors">CRM & ICP Scoring</div>
          <div className="text-xs text-gray-400 mt-1">{activeLeads.length} Leads &middot; {hotLeads.length} Hot</div>
        </Link>
        <Link href="/mandate" className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-copper/30 hover:shadow-md transition-all">
          <div className="text-2xl mb-2">📋</div>
          <div className="font-manrope font-bold text-navy group-hover:text-copper transition-colors">Mandate Tracking</div>
          <div className="text-xs text-gray-400 mt-1">{activeMandates.length} aktiv &middot; {formatCurrency(totalMRR)} MRR</div>
        </Link>
        <Link href="/operations" className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-copper/30 hover:shadow-md transition-all">
          <div className="text-2xl mb-2">⚡</div>
          <div className="font-manrope font-bold text-navy group-hover:text-copper transition-colors">Operations</div>
          <div className="text-xs text-gray-400 mt-1">{opsGruen} grün &middot; {opsRot} rot</div>
        </Link>
      </div>
    </div>
  );
}
