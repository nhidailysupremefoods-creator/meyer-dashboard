'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Lead, Branche, PipelineStatus } from '@/lib/internal-os/types';
import { SEED_LEADS } from '@/lib/internal-os/demo-data';
import {
  computeICPScore,
  BRANCHEN_LABELS,
  PIPELINE_STAGES,
  findDuplicates,
} from '@/lib/internal-os/utils';

const PAGE_SIZE = 50;
const STORAGE_KEY = 'meyer-internal-os-leads';

function loadLeads(): Lead[] {
  if (typeof window === 'undefined') return SEED_LEADS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return SEED_LEADS;
}

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>(loadLeads);
  const [toast, setToast] = useState<string | null>(null);

  // Persist leads to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
    } catch {}
  }, [leads]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [sortBy, setSortBy] = useState<'icp_score' | 'company_name' | 'umsatz'>('icp_score');
  const [page, setPage] = useState(1);
  const [showArchived, setShowArchived] = useState(false);

  // ── Auto-Archive: Leads mit Status "verloren" werden archiviert ──
  const autoArchive = useCallback(() => {
    setLeads(prev =>
      prev.map(l => {
        if (l.pipeline_status === 'verloren' && !l.is_archived) {
          return { ...l, is_archived: true, archived_at: new Date().toISOString() };
        }
        return l;
      })
    );
  }, []);

  // Run auto-archive on initial render concept (via useMemo side effect)
  useMemo(() => { autoArchive(); }, [autoArchive]);

  // ── Filter, Search & Sort ───────────────────────────────
  const activeLeads = useMemo(() => leads.filter(l => showArchived || !l.is_archived), [leads, showArchived]);

  const filtered = useMemo(() => {
    let result = [...activeLeads];

    // Status filter
    if (filterStatus) result = result.filter(l => l.pipeline_status === filterStatus);

    // Search (fuzzy across company_name, ansprechpartner, email, telefon)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.company_name.toLowerCase().includes(q) ||
        l.ansprechpartner.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.telefon.includes(q) ||
        l.adresse.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'icp_score') return (b.icp_score || 0) - (a.icp_score || 0);
      if (sortBy === 'umsatz') return (b.umsatz || 0) - (a.umsatz || 0);
      return a.company_name.localeCompare(b.company_name);
    });
    return result;
  }, [activeLeads, filterStatus, searchQuery, sortBy]);

  // ── Pagination ──────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // Reset page when filters change
  useMemo(() => { setPage(1); }, [filterStatus, searchQuery, sortBy, showArchived]);

  // ── KPIs (only non-archived) ────────────────────────────
  const nonArchived = leads.filter(l => !l.is_archived);
  const totalLeads = nonArchived.length;
  const avgICP = nonArchived.length > 0
    ? Math.round(nonArchived.reduce((s, l) => s + l.icp_score, 0) / nonArchived.length)
    : 0;
  const hotLeads = nonArchived.filter(l => l.icp_score >= 70).length;
  const inPipeline = nonArchived.filter(l =>
    ['kontaktiert', 'qualifiziert', 'angebot', 'verhandlung'].includes(l.pipeline_status)
  ).length;

  // ── Handlers ────────────────────────────────────────────
  function handleSave(data: Partial<Lead>) {
    const now = new Date().toISOString();
    if (editingLead) {
      setLeads(prev => prev.map(l =>
        l.lead_id === editingLead.lead_id
          ? {
              ...l,
              ...data,
              icp_score: computeICPScore(data as Lead),
              updated_at: now,
              last_modified_at: now,
              // Auto-archive if set to verloren
              is_archived: (data.pipeline_status === 'verloren') ? true : l.is_archived,
              archived_at: (data.pipeline_status === 'verloren' && !l.is_archived) ? now : l.archived_at,
            }
          : l
      ));
    } else {
      const newLead: Lead = {
        lead_id: 'LEAD-' + String(leads.length + 1).padStart(3, '0'),
        company_name: '',
        branche: '',
        umsatz: null,
        ebit_marge: null,
        mitarbeiteranzahl: null,
        controller_anzahl: null,
        ansprechpartner: '',
        telefon: '',
        email: '',
        adresse: '',
        pipeline_status: 'neu',
        next_action: '',
        next_action_date: null,
        icp_score: 0,
        lead_source: '',
        created_at: now,
        updated_at: now,
        created_by: 'gregory@meyerdecision.com',
        is_archived: false,
        archived_at: null,
        duplicate_flag: false,
        duplicate_reference_id: null,
        last_modified_at: now,
        ...data,
      };
      newLead.icp_score = computeICPScore(newLead);
      // Check for auto-archive
      if (newLead.pipeline_status === 'verloren') {
        newLead.is_archived = true;
        newLead.archived_at = now;
      }
      setLeads(prev => [...prev, newLead]);
    }
    setShowForm(false);
    setEditingLead(null);
    setToast(editingLead ? 'Lead gespeichert' : 'Neuer Lead erstellt');
  }

  function handleDelete(leadId: string) {
    setLeads(prev => prev.filter(l => l.lead_id !== leadId));
    setShowForm(false);
    setEditingLead(null);
    setToast('Lead gelöscht');
  }

  function handleRestore(leadId: string) {
    setLeads(prev => prev.map(l =>
      l.lead_id === leadId ? { ...l, is_archived: false, archived_at: null, pipeline_status: 'neu' as PipelineStatus } : l
    ));
  }

  function icpColor(score: number) {
    if (score >= 70) return 'bg-green-500';
    if (score >= 40) return 'bg-amber-400';
    return 'bg-red-400';
  }

  function icpBadgeColor(score: number) {
    if (score >= 70) return 'bg-green-100 text-green-800';
    if (score >= 40) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  }

  const archivedCount = leads.filter(l => l.is_archived).length;

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-[60] bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-pulse">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-manrope text-2xl font-bold text-navy">CRM & ICP Scoring</h1>
          <p className="text-sm text-gray-500 mt-1">
            Alle Leads und Interessenten &middot; Single Source of Truth
          </p>
        </div>
        <button
          onClick={() => { setEditingLead(null); setShowForm(true); }}
          className="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-medium hover:bg-navy/90 transition-colors"
        >
          + Neuer Lead
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { value: totalLeads, label: 'Leads gesamt', accent: false },
          { value: avgICP, label: '\u2300 ICP Score', accent: false },
          { value: hotLeads, label: 'Hot Leads (\u226570)', accent: true },
          { value: inPipeline, label: 'In Pipeline', accent: false },
        ].map((kpi, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className={`font-manrope text-3xl font-bold ${kpi.accent ? 'text-copper' : 'text-navy'}`}>
              {kpi.value}
            </div>
            <div className="text-sm text-gray-400 mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Search + Filter + Sort */}
      <div className="space-y-3 mb-5">
        {/* Search Bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Suche nach Firma, Ansprechpartner, E-Mail, Telefon..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-copper/20 focus:border-copper"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-600 outline-none"
          >
            <option value="icp_score">Sort: ICP Score</option>
            <option value="umsatz">Sort: Umsatz</option>
            <option value="company_name">Sort: Name</option>
          </select>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
              showArchived ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            Archiv ({archivedCount})
          </button>
        </div>

        {/* Pipeline Filter Tabs */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterStatus('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !filterStatus ? 'bg-navy text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Alle ({activeLeads.length})
          </button>
          {PIPELINE_STAGES.map(stage => {
            const count = activeLeads.filter(l => l.pipeline_status === stage.value).length;
            return (
              <button
                key={stage.value}
                onClick={() => setFilterStatus(stage.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterStatus === stage.value ? 'bg-navy text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {stage.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Unternehmen', 'Branche', 'Umsatz', 'MA', 'Ctrl', 'EBIT%', 'ICP', 'Pipeline', 'E-Mail', 'Telefon', 'Nächste Aktion', ''].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider py-3 px-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(lead => (
                <tr
                  key={lead.lead_id}
                  className={`border-b border-gray-50 hover:bg-offwhite/50 cursor-pointer transition-colors ${
                    lead.is_archived ? 'opacity-50' : ''
                  } ${lead.duplicate_flag ? 'bg-amber-50/30' : ''}`}
                  onClick={() => { setEditingLead(lead); setShowForm(true); }}
                >
                  <td className="py-3 px-3">
                    <div className="font-medium text-navy">{lead.company_name}</div>
                    <div className="text-xs text-gray-400">{lead.ansprechpartner}</div>
                    {lead.duplicate_flag && (
                      <div className="text-[10px] text-amber-600 font-medium mt-0.5">Mögliches Duplikat</div>
                    )}
                    {lead.is_archived && (
                      <div className="text-[10px] text-red-500 font-medium mt-0.5">Archiviert</div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-xs text-gray-500 max-w-[120px] truncate">
                    {BRANCHEN_LABELS[lead.branche] || '–'}
                  </td>
                  <td className="py-3 px-3 font-medium whitespace-nowrap">
                    {lead.umsatz ? `${(lead.umsatz / 1_000_000).toFixed(1)}M` : '–'}
                  </td>
                  <td className="py-3 px-3">{lead.mitarbeiteranzahl ?? '–'}</td>
                  <td className="py-3 px-3">{lead.controller_anzahl ?? '–'}</td>
                  <td className="py-3 px-3">{lead.ebit_marge ? `${(lead.ebit_marge * 100).toFixed(0)}%` : '–'}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className={`h-full rounded-full ${icpColor(lead.icp_score)} transition-all`} style={{ width: `${lead.icp_score}%` }} />
                      </div>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-bold ${icpBadgeColor(lead.icp_score)}`}>
                        {lead.icp_score}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${PIPELINE_STAGES.find(s => s.value === lead.pipeline_status)?.color}`}>
                      {PIPELINE_STAGES.find(s => s.value === lead.pipeline_status)?.label}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-xs text-gray-500 max-w-[160px] truncate">
                    {lead.email || '–'}
                  </td>
                  <td className="py-3 px-3 text-xs text-gray-500 whitespace-nowrap">
                    {lead.telefon || '–'}
                  </td>
                  <td className="py-3 px-3 text-xs text-gray-500 max-w-[140px] truncate">
                    {lead.next_action || '–'}
                    {lead.next_action_date && (
                      <div className="text-[10px] text-gray-300 mt-0.5">{lead.next_action_date}</div>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    {lead.is_archived ? (
                      <button
                        onClick={e => { e.stopPropagation(); handleRestore(lead.lead_id); }}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        Restore
                      </button>
                    ) : (
                      <span className="text-gray-300 text-lg">&rsaquo;</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">Keine Leads gefunden</div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="text-xs text-gray-400">
              {filtered.length} Ergebnisse &middot; Seite {page} von {totalPages}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                &laquo; Zurück
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = page <= 3 ? i + 1 : page + i - 2;
                if (pageNum < 1 || pageNum > totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      pageNum === page ? 'bg-navy text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Weiter &raquo;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lead Form Modal */}
      {showForm && (
        <LeadFormModal
          lead={editingLead}
          allLeads={leads}
          onClose={() => { setShowForm(false); setEditingLead(null); }}
          onSave={handleSave}
          onDelete={editingLead ? () => handleDelete(editingLead.lead_id) : undefined}
        />
      )}
    </div>
  );
}

// ── Lead Form Modal Component ─────────────────────────────

function LeadFormModal({
  lead,
  allLeads,
  onClose,
  onSave,
  onDelete,
}: {
  lead: Lead | null;
  allLeads: Lead[];
  onClose: () => void;
  onSave: (data: Partial<Lead>) => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState({
    company_name: lead?.company_name || '',
    branche: lead?.branche || '' as Branche | '',
    umsatz: lead?.umsatz ?? '',
    ebit_marge: lead?.ebit_marge ?? '',
    mitarbeiteranzahl: lead?.mitarbeiteranzahl ?? '',
    controller_anzahl: lead?.controller_anzahl ?? '',
    ansprechpartner: lead?.ansprechpartner || '',
    telefon: lead?.telefon || '',
    email: lead?.email || '',
    adresse: lead?.adresse || '',
    pipeline_status: lead?.pipeline_status || 'neu' as PipelineStatus,
    next_action: lead?.next_action || '',
    next_action_date: lead?.next_action_date || '',
    lead_source: lead?.lead_source || '',
  });

  const previewScore = computeICPScore({
    branche: form.branche as Branche,
    umsatz: form.umsatz ? Number(form.umsatz) : null,
    mitarbeiteranzahl: form.mitarbeiteranzahl ? Number(form.mitarbeiteranzahl) : null,
    controller_anzahl: form.controller_anzahl !== '' ? Number(form.controller_anzahl) : null,
    ebit_marge: form.ebit_marge ? Number(form.ebit_marge) : null,
  });

  // Fuzzy duplicate detection
  const duplicates = useMemo(
    () => findDuplicates(form.company_name, allLeads, lead?.lead_id),
    [form.company_name, allLeads, lead?.lead_id]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      company_name: form.company_name,
      branche: form.branche as Branche,
      umsatz: form.umsatz ? Number(form.umsatz) : null,
      ebit_marge: form.ebit_marge ? Number(form.ebit_marge) : null,
      mitarbeiteranzahl: form.mitarbeiteranzahl ? Number(form.mitarbeiteranzahl) : null,
      controller_anzahl: form.controller_anzahl !== '' ? Number(form.controller_anzahl) : null,
      ansprechpartner: form.ansprechpartner,
      telefon: form.telefon,
      email: form.email,
      adresse: form.adresse,
      pipeline_status: form.pipeline_status as PipelineStatus,
      next_action: form.next_action,
      next_action_date: form.next_action_date || null,
      lead_source: form.lead_source,
      duplicate_flag: duplicates.length > 0,
      duplicate_reference_id: duplicates.length > 0 ? duplicates[0].lead_id : null,
    });
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-copper/20 focus:border-copper';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center rounded-t-2xl z-10">
          <div>
            <h2 className="font-manrope text-lg font-bold text-navy">
              {lead ? 'Lead bearbeiten' : 'Neuer Lead'}
            </h2>
            {lead && <p className="text-xs text-gray-400">{lead.lead_id}</p>}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">ICP Score</div>
              <div className={`text-2xl font-manrope font-bold ${previewScore >= 70 ? 'text-green-600' : previewScore >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                {previewScore}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-600 text-2xl ml-4">&times;</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* ICP Score Bar */}
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${previewScore >= 70 ? 'bg-green-500' : previewScore >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ width: `${previewScore}%` }}
            />
          </div>

          {/* Duplicate Warning */}
          {duplicates.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div className="text-sm font-semibold text-amber-800 mb-1">Mögliche Duplikate gefunden</div>
              <div className="space-y-1">
                {duplicates.map(d => (
                  <div key={d.lead_id} className="text-xs text-amber-700">
                    {d.company_name} ({d.lead_id}) – {Math.round(d.similarity * 100)}% Übereinstimmung
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Row 1: Company + Branche */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Unternehmen *</label>
              <input className={inputCls} value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Branche</label>
              <select className={inputCls + ' bg-white'} value={form.branche} onChange={e => setForm(f => ({ ...f, branche: e.target.value as Branche }))}>
                <option value="">– Auswählen –</option>
                {Object.entries(BRANCHEN_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Numbers */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Umsatz (EUR)</label>
              <input className={inputCls} type="number" value={form.umsatz} onChange={e => setForm(f => ({ ...f, umsatz: e.target.value }))} placeholder="z.B. 8500000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">EBIT-Marge</label>
              <input className={inputCls} type="number" step="0.01" value={form.ebit_marge} onChange={e => setForm(f => ({ ...f, ebit_marge: e.target.value }))} placeholder="z.B. 0.12" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Mitarbeiter</label>
              <input className={inputCls} type="number" value={form.mitarbeiteranzahl} onChange={e => setForm(f => ({ ...f, mitarbeiteranzahl: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Controller</label>
              <input className={inputCls} type="number" value={form.controller_anzahl} onChange={e => setForm(f => ({ ...f, controller_anzahl: e.target.value }))} />
            </div>
          </div>

          {/* Row 3: Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ansprechpartner</label>
              <input className={inputCls} value={form.ansprechpartner} onChange={e => setForm(f => ({ ...f, ansprechpartner: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Telefon</label>
              <input className={inputCls} value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">E-Mail</label>
              <input className={inputCls} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Adresse</label>
              <input className={inputCls} value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} />
            </div>
          </div>

          {/* Row 4: Pipeline */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Pipeline Status</label>
              <select className={inputCls + ' bg-white'} value={form.pipeline_status} onChange={e => setForm(f => ({ ...f, pipeline_status: e.target.value as PipelineStatus }))}>
                {PIPELINE_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nächste Aktion</label>
              <input className={inputCls} value={form.next_action} onChange={e => setForm(f => ({ ...f, next_action: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Datum</label>
              <input className={inputCls} type="date" value={form.next_action_date} onChange={e => setForm(f => ({ ...f, next_action_date: e.target.value }))} />
            </div>
          </div>

          {/* Row 5: Source */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Lead-Quelle</label>
            <select className={inputCls + ' bg-white'} value={form.lead_source} onChange={e => setForm(f => ({ ...f, lead_source: e.target.value }))}>
              <option value="">–</option>
              <option value="cold_call">Cold Call</option>
              <option value="email">E-Mail</option>
              <option value="empfehlung">Empfehlung</option>
              <option value="website">Website</option>
              <option value="linkedin">LinkedIn</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t border-gray-100">
            <div>
              {onDelete && (
                <button type="button" onClick={onDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                  Löschen
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                Abbrechen
              </button>
              <button type="submit" className="px-5 py-2 bg-copper text-white rounded-lg text-sm font-medium hover:bg-copper/90">
                Speichern
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
