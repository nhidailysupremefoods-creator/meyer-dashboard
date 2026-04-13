'use client';

import { useState } from 'react';
import { OperationsCustomer, DocumentType, EmailPreview } from '@/lib/internal-os/types';
import { SEED_OPERATIONS } from '@/lib/internal-os/demo-data';
import { formatCurrency, formatDate } from '@/lib/internal-os/utils';

// ── Workflow Steps ──────────────────────────────────────

const WORKFLOW_STEPS: { type: DocumentType; label: string; icon: string; sentKey: keyof OperationsCustomer }[] = [
  { type: 'angebot',    label: 'Angebot',      icon: '📄', sentKey: 'angebot_sent' },
  { type: 'vertrag',    label: 'DL-Vertrag',   icon: '📝', sentKey: 'vertrag_sent' },
  { type: 'unterlagen', label: 'Unterlagen',    icon: '📎', sentKey: 'unterlagen_sent' },
  { type: 'reminder',   label: 'Reminder',      icon: '🔔', sentKey: 'reminder_sent' },
  { type: 'rechnung',   label: 'Rechnung',      icon: '💶', sentKey: 'rechnung_sent' },
];

// Sender options (the two admin users)
const SENDERS = [
  { email: 'gregory@meyerdecision.com', name: 'Gregory Meyer' },
  { email: 'nhi@meyerdecision.com', name: 'Nhi Meyer' },
];

export default function OperationsPage() {
  const [customers, setCustomers] = useState<OperationsCustomer[]>(SEED_OPERATIONS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [senderEmail, setSenderEmail] = useState(SENDERS[0].email);
  const [preparing, setPreparing] = useState<string | null>(null);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ── PREPARE: Generate Preview via Backend ───────────────
  async function handlePrepare(type: DocumentType, customer: OperationsCustomer) {
    const key = `${type}-${customer.customer_id}`;
    setPreparing(key);

    try {
      // Try backend API first
      const API_BASE = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
      if (API_BASE) {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ops_prepare',
            type,
            customer_id: customer.customer_id,
            sender: senderEmail,
          }),
        });
        const json = await res.json();
        if (json.data) {
          setPreview(json.data as EmailPreview);
          setPreparing(null);
          return;
        }
      }
    } catch {
      // Backend not available, use local template generation
    }

    // Local template generation (Fallback) – real Begleitmail templates from Google Drive
    const typeSubjects: Record<DocumentType, string> = {
      angebot: `Angebot f\u00fcr die Zusammenarbeit \u2013 ${customer.company_name}`,
      vertrag: `Vertragsunterlagen \u2013 ${customer.company_name}`,
      unterlagen: `Willkommen bei Meyer Decision \u2013 Ihr Dashboard-Zugang`,
      reminder: `Kurze Erinnerung \u2013 Daten f\u00fcr den aktuellen Steuerungsmonat`,
      rechnung: `Rechnung Meyer Decision \u2013 ${customer.company_name}`,
    };

    const senderName = SENDERS.find(s => s.email === senderEmail)?.name || 'Meyer Decision';
    const recipientEmail = customer.email || `${customer.ansprechpartner.toLowerCase().replace(/\s+/g, '.')}@example.de`;

    setPreview({
      to: recipientEmail,
      from: senderEmail,
      subject: typeSubjects[type],
      body: generateEmailBody(type, customer, senderName),
      attachments: generateAttachments(type, customer),
      type,
      customer_id: customer.customer_id,
    });
    setPreparing(null);
  }

  // ── Email Body Templates (from Google Drive Begleitmail .docx files) ──
  function generateEmailBody(type: DocumentType, customer: OperationsCustomer, senderName: string): string {
    const greeting = `Hallo ${customer.ansprechpartner}`;
    const senderBlock = senderName === 'Gregory Meyer'
      ? `<strong>Gregory Meyer</strong><br>gregory@meyerdecision.com`
      : `<strong>Nhi Meyer</strong><br>nhi@meyerdecision.com`;
    const signaturePersonal = `<p>Viele Gr\u00fc\u00dfe</p>
      <p>${senderBlock}</p>
      <p style="color:#888;font-size:12px;">Meyer Decision GbR \u00b7 Talburgstra\u00dfe 71 \u00b7 42579 Heiligenhaus</p>`;
    const signatureFormal = `<p>Mit freundlichen Gr\u00fc\u00dfen</p>
      <p style="color:#888;font-size:12px;">Meyer Decision GbR \u00b7 Talburgstra\u00dfe 71, 42579 Heiligenhaus</p>
      <table style="font-size:13px;margin-top:8px;"><tr>
        <td style="padding-right:24px;"><strong>Gregory Meyer</strong><br>gregory@meyerdecision.com</td>
        <td><strong>Nhi Meyer</strong><br>nhi@meyerdecision.com</td>
      </tr></table>`;

    switch (type) {
      case 'angebot':
        return `<div style="font-family:Arial,sans-serif;color:#192231;line-height:1.6;">
          <p>${greeting},</p>
          <p>vielen Dank f\u00fcr das angenehme Gespr\u00e4ch. Anbei erhalten Sie Ihr individuelles Angebot f\u00fcr die Zusammenarbeit mit Meyer Decision.</p>
          <p><strong>Worum es konkret geht</strong></p>
          <p>Mit unserem System schaffen wir eine klare, monatliche wirtschaftliche Steuerungsstruktur f\u00fcr Ihre Gesch\u00e4ftsf\u00fchrung. Im Mittelpunkt steht ein webbasiertes Dashboard, das Ihre wirtschaftliche Situation transparent macht und konkrete Handlungsschwerpunkte ableitet.</p>
          <p><strong>Was Sie erwarten k\u00f6nnen</strong></p>
          <ul style="margin:8px 0;padding-left:20px;">
            <li>Klare Einordnung Ihrer wirtschaftlichen Gesamtlage</li>
            <li>Transparenz \u00fcber Ertrags- und Vertragsstrukturen</li>
            <li>Fr\u00fchzeitige Identifikation von Liquidit\u00e4tsrisiken</li>
            <li>Konkrete, priorisierte Ma\u00dfnahmen zur Ergebnisverbesserung</li>
          </ul>
          <p>Bitte schauen Sie sich das Angebot in Ruhe an. Wenn Sie Fragen haben oder einzelne Punkte gemeinsam durchgehen m\u00f6chten, melden Sie sich jederzeit gerne.</p>
          <p>Wenn alles f\u00fcr Sie passt, k\u00f6nnen wir direkt im Anschluss mit der Einrichtung starten.</p>
          <p>Ich freue mich auf Ihr Feedback.</p>
          ${signaturePersonal}
        </div>`;

      case 'vertrag':
        return `<div style="font-family:Arial,sans-serif;color:#192231;line-height:1.6;">
          <p>${greeting},</p>
          <p>vielen Dank f\u00fcr das angenehme Gespr\u00e4ch und Ihr Interesse an Meyer Decision. Anbei erhalten Sie die Vertragsunterlagen f\u00fcr die Zusammenarbeit.</p>
          <p>Diese enthalten neben dem Dienstleistungsvertrag auch alle relevanten Anlagen (Leistungsbeschreibung, Datenschutzvereinbarung etc.), sodass Sie einen vollst\u00e4ndigen \u00dcberblick \u00fcber den Aufbau und die Struktur unseres Systems erhalten.</p>
          <p><strong>N\u00e4chster Schritt</strong></p>
          <p>Bitte pr\u00fcfen Sie die Unterlagen in Ruhe. Bei R\u00fcckfragen oder Anmerkungen gehen wir diese gerne gemeinsam durch.</p>
          <p>Wenn alles f\u00fcr Sie passt, senden Sie uns den Vertrag bitte unterschrieben zur\u00fcck. Nach Eingang starten wir direkt mit der Einrichtung Ihres Systems und melden uns im Anschluss mit den n\u00e4chsten Schritten (Dashboard-Zugang, Datenanleitung etc.).</p>
          <p>Bei Fragen melden Sie sich jederzeit gerne.</p>
          <p>Wir freuen uns auf die Zusammenarbeit.</p>
          ${signaturePersonal}
        </div>`;

      case 'unterlagen':
        return `<div style="font-family:Arial,sans-serif;color:#192231;line-height:1.6;">
          <p>${greeting},</p>
          <p>vielen Dank f\u00fcr Ihr Vertrauen und den Start unserer Zusammenarbeit. Ihr Meyer Decision Steuerungssystem ist nun eingerichtet und einsatzbereit.</p>
          <p><strong>Ihr Dashboard-Zugang</strong></p>
          <p>\u00dcber das Dashboard erhalten Sie Zugriff auf die wirtschaftlichen Kennzahlen Ihres Unternehmens sowie auf alle monatlichen Auswertungen:</p>
          <p><a href="https://meyer-dashboard.vercel.app" style="color:#B08A6A;">https://meyer-dashboard.vercel.app</a></p>
          <p>Bitte melden Sie sich mit der E-Mail-Adresse an, die bei uns f\u00fcr Ihr Unternehmen hinterlegt ist.</p>
          <p><strong>Hinweis zum ersten Zugriff</strong></p>
          <p>Beim ersten Aufruf kann eine Google-Sicherheitsmeldung erscheinen. Das ist technisch bedingt und unkritisch. Bitte gehen Sie wie folgt vor:</p>
          <ul style="margin:8px 0;padding-left:20px;">
            <li>\u201eErweitert\u201c ausw\u00e4hlen</li>
            <li>\u201eWeiter zu Meyer Decision (unsicher)\u201c klicken</li>
            <li>Zugriff best\u00e4tigen</li>
          </ul>
          <p><strong>So l\u00e4uft unsere Zusammenarbeit</strong></p>
          <p>Wir arbeiten in einem klaren monatlichen Steuerungsrhythmus:</p>
          <ul style="margin:8px 0;padding-left:20px;">
            <li>Bereitstellung Ihrer Unternehmensdaten</li>
            <li>Analyse und Aufbereitung durch Meyer Decision</li>
            <li>Aktualisierung Ihres Dashboards</li>
            <li>Erstellung Ihres Management-Reports</li>
            <li>Gemeinsamer Management-Call zur Einordnung und Priorisierung</li>
          </ul>
          <p><strong>Datenbereitstellung \u2013 Anleitung</strong></p>
          <p>Damit Ihr Team wei\u00df, welche Daten ben\u00f6tigt werden, finden Sie die Anleitung im Anhang.</p>
          <p>Bitte stellen Sie die Daten k\u00fcnftig monatlich zum vereinbarten Zeitpunkt bereit \u2013 das ist die Grundlage f\u00fcr eine saubere und belastbare Analyse.</p>
          <p>Bei Fragen oder wenn etwas nicht funktioniert, melden Sie sich jederzeit gerne direkt bei uns.</p>
          <p>Wir freuen uns auf die Zusammenarbeit.</p>
          ${signaturePersonal}
        </div>`;

      case 'reminder':
        return `<div style="font-family:Arial,sans-serif;color:#192231;line-height:1.6;">
          <p>Sehr geehrter ${customer.ansprechpartner},</p>
          <p>f\u00fcr die Aktualisierung Ihres Dashboards und die Erstellung des monatlichen Management-Reports ben\u00f6tigen wir die aktuellen Unternehmensdaten f\u00fcr den laufenden Monat.</p>
          <p>Falls noch nicht erfolgt, w\u00fcrden wir Sie bitten, die entsprechenden Dateien im vorgesehenen Upload-Ordner bereitzustellen.</p>
          <p><strong>Nach Dateneingang aktualisieren wir:</strong></p>
          <ul style="margin:8px 0;padding-left:20px;">
            <li>Ihr Dashboard mit den aktuellen Kennzahlen</li>
            <li>Den monatlichen Management-Report</li>
            <li>Die Ma\u00dfnahmen\u00fcbersicht im Advisory-System</li>
          </ul>
          <p>Vielen Dank f\u00fcr Ihre Mitwirkung \u2013 gemeinsam behalten wir Ihre Kennzahlen stets im Blick.</p>
          <p>Sollte es Fragen zur Datenstruktur oder zum Upload geben, unterst\u00fctzen wir selbstverst\u00e4ndlich gerne.</p>
          ${signatureFormal}
        </div>`;

      case 'rechnung':
        return `<div style="font-family:Arial,sans-serif;color:#192231;line-height:1.6;">
          <p>Sehr geehrter ${customer.ansprechpartner},</p>
          <p>anbei \u00fcbersenden wir Ihnen die Rechnung f\u00fcr den aktuellen Leistungsmonat unserer Zusammenarbeit.</p>
          <p>Die Rechnung bezieht sich auf die vereinbarte Advisory-Leistung inklusive Zugang zum webbasierten Steuerungsdashboard sowie die laufende wirtschaftliche Analyse und Einordnung der Kennzahlen.</p>
          <p>Bei R\u00fcckfragen stehen wir selbstverst\u00e4ndlich jederzeit gerne zur Verf\u00fcgung.</p>
          ${signatureFormal}
        </div>`;
    }
  }

  // ── Attachments per workflow step (matching real documents from 03_VERTRAEGE) ──
  function generateAttachments(type: DocumentType, customer: OperationsCustomer): { name: string; size: string }[] {
    const safeName = customer.company_name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\u00e4\u00f6\u00fc\u00c4\u00d6\u00dc\u00df\-]/g, '');
    switch (type) {
      case 'angebot':
        return [
          { name: `Angebot_MeyerDecision_${safeName}.pdf`, size: '85 KB' },
        ];
      case 'vertrag':
        return [
          { name: `Dienstleistungsvertrag_MeyerDecision_${safeName}.pdf`, size: '95 KB' },
          { name: 'Anlage_1_Leistungsbeschreibung.pdf', size: '94 KB' },
          { name: 'Anlage_2_AVV.pdf', size: '93 KB' },
          { name: 'Anlage_2a_TOM.pdf', size: '94 KB' },
          { name: 'Anlage_3_Systemarchitektur_Datenverarbeitung.pdf', size: '84 KB' },
        ];
      case 'unterlagen':
        return [
          { name: 'Daten_Anleitung.pdf', size: '76 KB' },
        ];
      case 'reminder':
        return [];
      case 'rechnung':
        return [
          { name: `Rechnung_Meyer_Decision_${safeName}.pdf`, size: '83 KB' },
          { name: 'E-Rechnung.xml', size: '12 KB' },
        ];
    }
  }

  // ── SEND: Real Email Dispatch ───────────────────────────
  async function handleSend(emailPreview: EmailPreview) {
    const key = `${emailPreview.type}-${emailPreview.customer_id}`;
    setSendingKey(key);

    try {
      // Try backend API first (Apps Script → GmailApp.sendEmail)
      const API_BASE = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
      if (API_BASE) {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ops_send',
            type: emailPreview.type,
            customer_id: emailPreview.customer_id,
            sender: emailPreview.from,
            to: emailPreview.to,
            subject: emailPreview.subject,
            body: emailPreview.body,
          }),
        });
        const json = await res.json();
        if (json.success) {
          updateSentStatus(emailPreview.type, emailPreview.customer_id);
          showToast(`E-Mail "${emailPreview.subject}" erfolgreich gesendet an ${emailPreview.to}`, 'success');
          setSendingKey(null);
          setPreview(null);
          return;
        }
        if (json.error) {
          showToast(`Fehler: ${json.error}`, 'error');
          setSendingKey(null);
          return;
        }
      }

      // Fallback: Try Next.js API route (which could use Gmail MCP)
      try {
        const res = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailPreview),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            updateSentStatus(emailPreview.type, emailPreview.customer_id);
            showToast(`E-Mail erfolgreich gesendet an ${emailPreview.to}`, 'success');
            setSendingKey(null);
            setPreview(null);
            return;
          }
        }
      } catch {
        // API route not available
      }

      // Final fallback: Create Gmail draft via Gmail MCP (handled by parent)
      // Mark as "prepared but not sent" – user gets notified
      showToast(
        `Backend nicht verbunden. Bitte Apps Script deployen oder E-Mail manuell senden an: ${emailPreview.to}`,
        'error'
      );
    } catch (err) {
      showToast(`Fehler beim Senden: ${err instanceof Error ? err.message : 'Unbekannt'}`, 'error');
    }

    setSendingKey(null);
  }

  function updateSentStatus(type: DocumentType, customerId: string) {
    const sentKey = WORKFLOW_STEPS.find(s => s.type === type)?.sentKey;
    if (sentKey) {
      setCustomers(prev => prev.map(c =>
        c.customer_id === customerId ? { ...c, [sentKey]: true } : c
      ));
    }
  }

  // ── Mark Monthly Status ─────────────────────────────────
  function toggleStatus(customerId: string, field: 'daten_erhalten' | 'daten_valide' | 'call_durchgefuehrt') {
    setCustomers(prev => prev.map(c => {
      if (c.customer_id !== customerId) return c;
      const updated = { ...c, [field]: !c[field] };
      if (updated.daten_erhalten && updated.daten_valide && updated.call_durchgefuehrt) {
        updated.ampel_status = 'GRUEN';
      } else if (updated.daten_erhalten) {
        updated.ampel_status = 'GELB';
      } else {
        updated.ampel_status = 'ROT';
      }
      return updated;
    }));
  }

  // ── KPIs ────────────────────────────────────────────────
  const gruen = customers.filter(c => c.ampel_status === 'GRUEN').length;
  const gelb = customers.filter(c => c.ampel_status === 'GELB').length;
  const rot = customers.filter(c => c.ampel_status === 'ROT').length;
  const totalMRR = customers.reduce((s, c) => s + (c.monatliches_honorar || 0), 0);

  const ampelStyles = {
    GRUEN: 'bg-green-500',
    GELB: 'bg-amber-400',
    ROT: 'bg-red-500',
  };

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium max-w-md ${
          toast.type === 'success' ? 'bg-navy text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-manrope text-2xl font-bold text-navy">Operativer Status</h1>
          <p className="text-sm text-gray-500 mt-1">
            Workflow: Angebot &rarr; Vertrag &rarr; Unterlagen &rarr; Datenupload &rarr; Rechnung
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500">Absender:</label>
          <select
            value={senderEmail}
            onChange={e => setSenderEmail(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 outline-none focus:ring-2 focus:ring-copper/20"
          >
            {SENDERS.map(s => (
              <option key={s.email} value={s.email}>{s.name} ({s.email})</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-lg">{gruen}</div>
          <div>
            <div className="font-manrope text-xl font-bold text-navy">Alles OK</div>
            <div className="text-xs text-gray-400">Daten + Call ✓</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center text-white font-bold text-lg">{gelb}</div>
          <div>
            <div className="font-manrope text-xl font-bold text-navy">In Bearbeitung</div>
            <div className="text-xs text-gray-400">Daten da, Call offen</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-lg">{rot}</div>
          <div>
            <div className="font-manrope text-xl font-bold text-navy">Aktion nötig</div>
            <div className="text-xs text-gray-400">Keine Daten</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="font-manrope text-2xl font-bold text-copper">{formatCurrency(totalMRR)}</div>
          <div className="text-xs text-gray-400 mt-1">MRR aktive Kunden</div>
        </div>
      </div>

      {/* Customer Cards */}
      <div className="space-y-3">
        {customers.map(customer => {
          const expanded = expandedId === customer.customer_id;
          return (
            <div key={customer.customer_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Customer Header Row */}
              <div
                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-offwhite/30 transition-colors"
                onClick={() => setExpandedId(expanded ? null : customer.customer_id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-4 h-4 rounded-full ${ampelStyles[customer.ampel_status]} shadow-sm`} />
                  <div>
                    <div className="font-manrope font-bold text-navy">{customer.company_name}</div>
                    <div className="text-xs text-gray-400">{customer.ansprechpartner} &middot; {customer.email || '–'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Monthly Status Checkboxes */}
                  <div className="flex gap-2">
                    {[
                      { field: 'daten_erhalten' as const, label: 'Daten', value: customer.daten_erhalten },
                      { field: 'daten_valide' as const, label: 'Validiert', value: customer.daten_valide },
                      { field: 'call_durchgefuehrt' as const, label: 'Call', value: customer.call_durchgefuehrt },
                    ].map(item => (
                      <button
                        key={item.field}
                        onClick={e => { e.stopPropagation(); toggleStatus(customer.customer_id, item.field); }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                          item.value
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-gray-50 border-gray-200 text-gray-400'
                        }`}
                      >
                        {item.value ? '✓' : '○'} {item.label}
                      </button>
                    ))}
                  </div>

                  {/* Upload Info */}
                  <div className="text-right min-w-[80px]">
                    <div className={`text-xs font-medium ${customer.upload_status === 'uploaded' ? 'text-green-600' : 'text-red-500'}`}>
                      {customer.file_count} Dateien
                    </div>
                    {customer.last_upload_date && (
                      <div className="text-[10px] text-gray-300">{formatDate(customer.last_upload_date)}</div>
                    )}
                  </div>

                  {/* Honorar */}
                  <div className="text-sm font-semibold text-navy min-w-[80px] text-right">
                    {customer.monatliches_honorar ? formatCurrency(customer.monatliches_honorar) : '–'}
                  </div>

                  {/* Expand Arrow */}
                  <div className={`text-gray-300 transition-transform text-lg ${expanded ? 'rotate-90' : ''}`}>
                    &rsaquo;
                  </div>
                </div>
              </div>

              {/* Expanded: Workflow Buttons */}
              {expanded && (
                <div className="px-6 pb-6 pt-2 border-t border-gray-100">
                  <div className="grid grid-cols-5 gap-4">
                    {WORKFLOW_STEPS.map(step => {
                      const isSent = customer[step.sentKey] as boolean;
                      const isSending = sendingKey === `${step.type}-${customer.customer_id}`;
                      const isPreparing = preparing === `${step.type}-${customer.customer_id}`;

                      return (
                        <div key={step.type} className="text-center">
                          <div className="text-2xl mb-1">{step.icon}</div>
                          <div className="text-[11px] font-semibold text-gray-500 mb-3">{step.label}</div>

                          <div className={`text-[10px] font-medium mb-2 ${isSent ? 'text-green-600' : 'text-transparent'}`}>
                            {isSent ? '✓ Gesendet' : '–'}
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <button
                              onClick={() => handlePrepare(step.type, customer)}
                              disabled={isPreparing}
                              className={`w-full px-3 py-2 border rounded-lg text-xs font-medium transition-all ${
                                isPreparing
                                  ? 'border-copper/30 bg-copper/5 text-copper cursor-wait'
                                  : 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-copper/30'
                              }`}
                            >
                              {isPreparing ? (
                                <span className="flex items-center justify-center gap-1">
                                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                  Bereite vor...
                                </span>
                              ) : 'Vorbereiten'}
                            </button>
                            <button
                              onClick={() => {
                                // Require preparation first
                                if (!preview || preview.type !== step.type || preview.customer_id !== customer.customer_id) {
                                  handlePrepare(step.type, customer);
                                  return;
                                }
                                if (window.confirm(`"${step.label}" jetzt an ${customer.company_name} senden?\n\nVon: ${senderEmail}\nAn: ${preview.to}\n\nDies versendet die E-Mail SOFORT über das Backend.`)) {
                                  handleSend(preview);
                                }
                              }}
                              disabled={isSending}
                              className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                isSending
                                  ? 'bg-copper/50 text-white cursor-wait'
                                  : 'bg-copper text-white hover:bg-copper/90 shadow-sm hover:shadow'
                              }`}
                            >
                              {isSending ? (
                                <span className="flex items-center justify-center gap-1">
                                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                  Sende...
                                </span>
                              ) : 'Senden'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {customer.reminder_sent && (
                    <div className="mt-4 bg-amber-50 border border-amber-100 rounded-lg px-4 py-2 text-xs text-amber-700">
                      Reminder wurde bereits gesendet für diesen Monat.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Email Preview Modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center rounded-t-2xl z-10">
              <div>
                <h2 className="font-manrope text-lg font-bold text-navy">E-Mail Vorschau</h2>
                <p className="text-xs text-gray-400">Prüfe die E-Mail vor dem Versand</p>
              </div>
              <button onClick={() => setPreview(null)} className="text-gray-300 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Email Meta */}
              <div className="bg-offwhite rounded-xl p-4 space-y-2 text-sm">
                <div className="flex gap-2"><span className="font-medium text-gray-400 w-16">Von:</span><span className="text-navy font-medium">{preview.from}</span></div>
                <div className="flex gap-2"><span className="font-medium text-gray-400 w-16">An:</span><span>{preview.to}</span></div>
                <div className="flex gap-2"><span className="font-medium text-gray-400 w-16">Betreff:</span><span className="font-semibold">{preview.subject}</span></div>
                {preview.attachments.length > 0 && (
                  <div className="flex gap-2">
                    <span className="font-medium text-gray-400 w-16">Anhänge:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {preview.attachments.map((a, i) => (
                        <span key={i} className="bg-white border border-gray-200 px-2 py-0.5 rounded text-xs text-gray-600">
                          📎 {a.name} ({a.size})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Email Body */}
              <div className="border border-gray-200 rounded-xl p-5 min-h-[200px]" dangerouslySetInnerHTML={{ __html: preview.body }} />

              {/* Backend Status Hint */}
              <div className={`rounded-lg px-4 py-2 text-xs ${
                process.env.NEXT_PUBLIC_APPS_SCRIPT_URL
                  ? 'bg-green-50 border border-green-100 text-green-700'
                  : 'bg-amber-50 border border-amber-100 text-amber-700'
              }`}>
                {process.env.NEXT_PUBLIC_APPS_SCRIPT_URL
                  ? 'Backend verbunden – E-Mail wird über Apps Script / GmailApp versendet.'
                  : 'Backend nicht verbunden – Bitte NEXT_PUBLIC_APPS_SCRIPT_URL setzen für echten E-Mail-Versand.'}
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4 border-t border-gray-100">
                <button onClick={() => setPreview(null)} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                  Schließen
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`E-Mail jetzt senden?\n\nVon: ${preview.from}\nAn: ${preview.to}\nBetreff: ${preview.subject}`)) {
                      handleSend(preview);
                    }
                  }}
                  disabled={sendingKey !== null}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                    sendingKey
                      ? 'bg-copper/50 text-white cursor-wait'
                      : 'bg-copper text-white hover:bg-copper/90 shadow-sm'
                  }`}
                >
                  {sendingKey ? 'Wird gesendet...' : 'Jetzt senden'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
