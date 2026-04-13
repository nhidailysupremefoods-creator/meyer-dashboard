'use client';

import { useState } from 'react';
import { MandateTracking } from '@/lib/internal-os/types';
import { SEED_MANDATES } from '@/lib/internal-os/demo-data';
import { formatCurrency, formatDate } from '@/lib/internal-os/utils';

export default function MandatePage() {
  const [mandates, setMandates] = useState<MandateTracking[]>(SEED_MANDATES);
  const [syncing, setSyncing] = useState(false);
  const [editingMandate, setEditingMandate] = useState<MandateTracking | null>(null);

  // ── Sync (calls backend when API_BASE is set) ───────────
  async function handleSync() {
    setSyncing(true);
    try {
      // TODO: Replace with real API call when backend is connected
      // const updated = await syncMandates();
      // setMandates(updated);
      await new Promise(r => setTimeout(r, 1000));
      setMandates(prev => prev.map(m => ({
        ...m,
        last_auto_sync: new Date().toISOString(),
      })));
    } catch {
      // Fallback: just update sync timestamp
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
  }

  // ── KPIs ────────────────────────────────────────────────
  const activeMandates = mandates.filter(m => m.mandate_status === 'active');
  const totalMRR = activeMandates.reduce((s, m) => s + (m.monatliches_honorar || 0), 0);
  const totalSetup = mandates.reduce((s, m) => s + (m.setup_fee || 0), 0);

  function capitalizeFirst(s: string | null | undefined): string {
    if (!s) return '–';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    onboarding: 'bg-blue-100 text-blue-700',
    paused: 'bg-amber-100 text-amber-700',
    churned: 'bg-red-100 text-red-700',
  };

  return (
    <div>
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

      {/* Mandate Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Kunde', 'E-Mail', 'Status', 'Vertragsart', 'Dienstleistung', 'Honorar/Mon.', 'Setup-Fee', 'Beginn', 'Ende', ''].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider py-3 px-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mandates.map(m => (
                <tr key={m.customer_id} className="border-b border-gray-50 hover:bg-offwhite/50 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-medium text-navy">{m.company_name}</div>
                    <div className="text-xs text-gray-400">{m.ansprechpartner}</div>
                  </td>
                  <td className="py-3 px-3 text-xs text-gray-500 max-w-[160px] truncate">
                    {m.email || '–'}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[m.mandate_status] || 'bg-gray-100 text-gray-700'}`}>
                      {m.mandate_status}
                      {m.manually_edited && <span title="Manuell bearbeitet" className="text-[10px]">✏</span>}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-xs text-gray-600">{capitalizeFirst(m.vertragsart)}</td>
                  <td className="py-3 px-3 text-xs text-gray-600 max-w-[180px] truncate">{m.gebuchte_dienstleistung || '–'}</td>
                  <td className="py-3 px-3 font-semibold text-navy">
                    {m.monatliches_honorar ? formatCurrency(m.monatliches_honorar) : '–'}
                  </td>
                  <td className="py-3 px-3 text-gray-600">{m.setup_fee ? formatCurrency(m.setup_fee) : '–'}</td>
                  <td className="py-3 px-3 text-xs">{formatDate(m.vertragsbeginn)}</td>
                  <td className="py-3 px-3 text-xs">{m.vertragsende ? formatDate(m.vertragsende) : 'unbefristet'}</td>
                  <td className="py-3 px-3">
                    <button
                      onClick={() => setEditingMandate(m)}
                      className="px-3 py-1 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 hover:border-copper/30 transition-colors"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {mandates.length === 0 && (
          <div className="text-center py-12 text-gray-400">Keine Mandate vorhanden</div>
        )}
      </div>

      {/* Edit Mandate Modal */}
      {editingMandate && (
        <MandateEditModal
          mandate={editingMandate}
          onClose={() => setEditingMandate(null)}
          onSave={handleSaveMandate}
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
}: {
  mandate: MandateTracking;
  onClose: () => void;
  onSave: (data: Partial<MandateTracking>) => void;
}) {
  const [form, setForm] = useState({
    company_name: mandate.company_name || '',
    ansprechpartner: mandate.ansprechpartner || '',
    email: mandate.email || '',
    vertragsart: mandate.vertragsart || '',
    gebuchte_dienstleistung: mandate.gebuchte_dienstleistung || '',
    monatliches_honorar: mandate.monatliches_honorar ?? '',
    setup_fee: mandate.setup_fee ?? '',
    vertragsbeginn: mandate.vertragsbeginn || '',
    vertragsende: mandate.vertragsende || '',
    mandate_status: mandate.mandate_status || 'active',
  });

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-copper/20 focus:border-copper';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 rounded-t-2xl">
          <h2 className="font-manrope text-lg font-bold text-navy">
            Mandate bearbeiten: {mandate.company_name}
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
              vertragsart: form.vertragsart,
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
              <label className="block text-xs font-medium text-gray-500 mb-1">Vertragsart</label>
              <select className={inputCls + ' bg-white'} value={form.vertragsart} onChange={e => setForm(f => ({ ...f, vertragsart: e.target.value }))}>
                <option value="">–</option>
                <option value="Dienstleistungsvertrag">Dienstleistungsvertrag</option>
                <option value="Rahmenvertrag">Rahmenvertrag</option>
                <option value="Projektvertrag">Projektvertrag</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select className={inputCls + ' bg-white'} value={form.mandate_status} onChange={e => setForm(f => ({ ...f, mandate_status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="onboarding">Onboarding</option>
                <option value="paused">Paused</option>
                <option value="churned">Churned</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Gebuchte Dienstleistung</label>
            <input className={inputCls} value={form.gebuchte_dienstleistung} onChange={e => setForm(f => ({ ...f, gebuchte_dienstleistung: e.target.value }))} />
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

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">Abbrechen</button>
            <button type="submit" className="px-5 py-2 bg-copper text-white rounded-lg text-sm font-medium hover:bg-copper/90">Speichern</button>
          </div>
        </form>
      </div>
    </div>
  );
}
