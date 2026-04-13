'use client';

import { useState, useMemo } from 'react';
import { MandateTracking } from '@/lib/internal-os/types';
import { SEED_MANDATES } from '@/lib/internal-os/demo-data';
import { formatCurrency, formatDate } from '@/lib/internal-os/utils';

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktiv',
  onboarding: 'Onboarding',
  paused: 'Pausiert',
  inactive: 'Inaktiv',
  churned: 'Inaktiv',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  onboarding: 'bg-blue-100 text-blue-700',
  paused: 'bg-amber-100 text-amber-700',
  inactive: 'bg-red-100 text-red-700',
  churned: 'bg-red-100 text-red-700',
};

export default function MandatePage() {
  const [mandates, setMandates] = useState<MandateTracking[]>(SEED_MANDATES);
  const [syncing, setSyncing] = useState(false);
  const [editingMandate, setEditingMandate] = useState<MandateTracking | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Toast auto-dismiss
  useMemo(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // ── Sync (calls backend when API_BASE is set) ───────────
  async function handleSync() {
    setSyncing(true);
    try {
      await new Promise(r => setTimeout(r, 1000));
      setMandates(prev => prev.map(m => ({
        ...m,
        last_auto_sync: new Date().toISOString(),
      })));
    } catch {
      setMandates(prev => prev.map(m => ({
        ...m,
        last_auto_sync: new Date().toISOString(),
      })));
    }
    setSyncing(false);
  }

  function handleSaveMandate(data: Partial<MandateTracking>) {
    if (!editingMandate) return;
    setMandates(prev => prev.map(m =>
      m.customer_id === editingMandate.customer_id
        ? { ...m, ...data, manually_edited: true }
        : m
    ));
    setEditingMandate(null);
    if (data.mandate_status === 'inactive') {
      setToast('Mandat als "Inaktiv" markiert – im Archiv sichtbar');
      setShowArchived(true);
    } else {
      setToast('Mandat gespeichert');
    }
  }

  function handleDelete(customerId: string) {
    if (!window.confirm('Mandat wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
    setMandates(prev => prev.filter(m => m.customer_id !== customerId));
    setToast('Mandat gelöscht');
  }

  // ── Filtered lists ────────────────────────────────────────
  const activeMandatesList = useMemo(
    () => mandates.filter(m => m.mandate_status !== 'inactive' && m.mandate_status !== 'churned'),
    [mandates]
  );
  const archivedMandatesList = useMemo(
    () => mandates.filter(m => m.mandate_status === 'inactive' || m.mandate_status === 'churned'),
    [mandates]
  );
  const displayedMandates = showArchived ? archivedMandatesList : activeMandatesList;

  // ── KPIs (nur aktive) ─────────────────────────────────────
  const activeMandates = mandates.filter(m => m.mandate_status === 'active');
  const totalMRR = activeMandates.reduce((s, m) => s + (m.monatliches_honorar || 0), 0);
  const totalSetup = mandates.reduce((s, m) => s + (m.setup_fee || 0), 0);

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[60] text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.includes('gelöscht') ? 'bg-red-600' : toast.includes('Inaktiv') ? 'bg-amber-600' : 'bg-green-600'
        }`}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-manrope text-2xl font-bold text-navy">Mandate Tracking</h1>
          <p className="text-sm text-gray-500 mt-1">
            1 Kunde = 1 Vertrag &middot; Automatisch aus Drive befüllt &middot; Jederzeit editierbar
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            syncing ? 'bg-copper/60 text-white cursor-wait' : 'bg-copper text-white hover:bg-copper/90'
          }`}
        >
          {syncing ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              Synchronisiere...
            </span>
          ) : 'Jetzt synchronisieren'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="font-manrope text-3xl font-bold text-copper">{formatCurrency(totalMRR)}</div>
          <div className="text-sm text-gray-400 mt-1">MRR gesamt</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="font-manrope text-3xl font-bold text-navy">{activeMandates.length}</div>
          <div className="text-sm text-gray-400 mt-1">Aktive Mandate</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="font-manrope text-3xl font-bold text-navy">{formatCurrency(totalMRR * 12)}</div>
          <div className="text-sm text-gray-400 mt-1">ARR (hochgerechnet)</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="font-manrope text-3xl font-bold text-navy">{formatCurrency(totalSetup)}</div>
          <div className="text-sm text-gray-400 mt-1">Setup-Fees gesamt</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 mb-5">
        <button
          onClick={() => setShowArchived(false)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !showArchived ? 'bg-navy text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Alle ({activeMandatesList.length})
        </button>
        <button
          onClick={() => setShowArchived(true)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            showArchived ? 'bg-red-700 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          Archiv ({archivedMandatesList.length})
        </button>
      </div>

      {/* Mandate Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider py-3 px-2 w-[22%]">Kunde</th>
              <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider py-3 px-2 w-[11%]">Status</th>
              <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider py-3 px-2 w-[16%]">Dienstleistung</th>
              <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider py-3 px-2 w-[13%]">Honorar</th>
              <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider py-3 px-2 w-[11%]">Setup</th>
              <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider py-3 px-2 w-[10%]">Beginn</th>
              <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider py-3 px-2 w-[10%]">Ende</th>
              <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider py-3 px-2 w-[7%]"></th>
            </tr>
          </thead>
          <tbody>
            {displayedMandates.map(m => (
              <tr
                key={m.customer_id}
                className={`border-b border-gray-50 hover:bg-offwhite/50 transition-colors cursor-pointer ${showArchived ? 'opacity-60' : ''}`}
                onClick={() => setEditingMandate(m)}
              >
                <td className="py-3 px-2">
                  <div className="font-medium text-navy text-xs truncate">{m.company_name}</div>
                  <div className="text-[11px] text-gray-400 truncate">{m.ansprechpartner}</div>
                  <div className="text-[11px] text-gray-300 truncate">{m.email || ''}</div>
                </td>
                <td className="py-3 px-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLORS[m.mandate_status] || 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_LABELS[m.mandate_status] || m.mandate_status}
                  </span>
                </td>
                <td className="py-3 px-2 text-xs text-gray-600 truncate">{m.gebuchte_dienstleistung || '–'}</td>
                <td className="py-3 px-2 text-xs font-semibold text-navy">{m.monatliches_honorar ? formatCurrency(m.monatliches_honorar) : '–'}</td>
                <td className="py-3 px-2 text-xs text-gray-600">{m.setup_fee ? formatCurrency(m.setup_fee) : '–'}</td>
                <td className="py-3 px-2 text-[11px] text-gray-500">{formatDate(m.vertragsbeginn)}</td>
                <td className="py-3 px-2 text-[11px] text-gray-500">{m.vertragsende ? formatDate(m.vertragsende) : 'unbefr.'}</td>
                <td className="py-3 px-2 text-center">
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(m.customer_id); }}
                    className="text-gray-300 hover:text-red-500 transition-colors text-lg"
                    title="Mandat löschen"
                  >
                    &times;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {displayedMandates.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            {showArchived ? 'Keine archivierten Mandate' : 'Keine Mandate vorhanden'}
          </div>
        )}
      </div>

      {/* Edit Mandate Modal */}
      {editingMandate && (
        <MandateEditModal
          mandate={editingMandate}
          onClose={() => setEditingMandate(null)}
          onSave={handleSaveMandate}
          onDelete={() => { handleDelete(editingMandate.customer_id); setEditingMandate(null); }}
        />
      )}
    </div>
  );
}

// ── Mandate Edit Modal ──────────────────────────────────────

function MandateEditModal({
  mandate,
  onClose,
  onSave,
  onDelete,
}: {
  mandate: MandateTracking;
  onClose: () => void;
  onSave: (data: Partial<MandateTracking>) => void;
  onDelete: () => void;
}) {
  const [form, setForm] = useState({
    company_name: mandate.company_name || '',
    ansprechpartner: mandate.ansprechpartner || '',
    email: mandate.email || '',
    gebuchte_dienstleistung: mandate.gebuchte_dienstleistung || '',
    monatliches_honorar: mandate.monatliches_honorar ?? '',
    setup_fee: mandate.setup_fee ?? '',
    vertragsbeginn: mandate.vertragsbeginn || '',
    vertragsende: mandate.vertragsende || '',
    mandate_status: mandate.mandate_status === 'churned' ? 'inactive' : mandate.mandate_status || 'active',
  });

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy outline-none focus:ring-2 focus:ring-copper/20 focus:border-copper';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 rounded-t-2xl">
          <h2 className="font-manrope text-lg font-bold text-navy">
            Mandat bearbeiten: {mandate.company_name}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Änderungen überschreiben die automatisch extrahierten Daten</p>
        </div>

        <form
          className="p-6 space-y-4"
          onSubmit={e => {
            e.preventDefault();
            onSave({
              company_name: form.company_name,
              ansprechpartner: form.ansprechpartner,
              email: form.email,
              gebuchte_dienstleistung: form.gebuchte_dienstleistung,
              monatliches_honorar: form.monatliches_honorar ? Number(form.monatliches_honorar) : null,
              setup_fee: form.setup_fee ? Number(form.setup_fee) : null,
              vertragsbeginn: form.vertragsbeginn || null,
              vertragsende: form.vertragsende || null,
              mandate_status: form.mandate_status,
            });
          }}
        >
          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Unternehmen</label>
              <input className={inputCls} value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ansprechpartner</label>
              <input className={inputCls} value={form.ansprechpartner} onChange={e => setForm(f => ({ ...f, ansprechpartner: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">E-Mail</label>
            <input className={inputCls} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>

          {/* Contract Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Dienstleistung</label>
              <select className={inputCls + ' bg-white'} value={form.gebuchte_dienstleistung} onChange={e => setForm(f => ({ ...f, gebuchte_dienstleistung: e.target.value }))}>
                <option value="">–</option>
                <option value="Advisory">Advisory</option>
                <option value="Tool only">Tool only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select className={inputCls + ' bg-white'} value={form.mandate_status} onChange={e => setForm(f => ({ ...f, mandate_status: e.target.value }))}>
                <option value="active">Aktiv</option>
                <option value="onboarding">Onboarding</option>
                <option value="paused">Pausiert</option>
                <option value="inactive">Inaktiv</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Monatl. Honorar (EUR)</label>
              <input className={inputCls} type="number" value={form.monatliches_honorar} onChange={e => setForm(f => ({ ...f, monatliches_honorar: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Setup-Fee (EUR)</label>
              <input className={inputCls} type="number" value={form.setup_fee} onChange={e => setForm(f => ({ ...f, setup_fee: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Vertragsbeginn</label>
              <input className={inputCls} type="date" value={form.vertragsbeginn} onChange={e => setForm(f => ({ ...f, vertragsbeginn: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Vertragsende</label>
              <input className={inputCls} type="date" value={form.vertragsende} onChange={e => setForm(f => ({ ...f, vertragsende: e.target.value }))} />
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-gray-100">
            <button type="button" onClick={onDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
              Löschen
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Abbrechen</button>
              <button type="submit" className="px-5 py-2 bg-copper text-white rounded-lg text-sm font-medium hover:bg-copper/90">Speichern</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
