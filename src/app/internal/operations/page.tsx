'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { OperationsCustomer, MonthlyOperationsData, DocumentType, EmailPreview, UploadCheckResult, ValidationResult } from '@/lib/internal-os/types';
import { SEED_OPERATIONS } from '@/lib/internal-os/demo-data';
import { formatDate } from '@/lib/internal-os/utils';

// ── Kontoauszug-Import ──────────────────────────────────

interface BankTransaction {
  date: string;          // ISO date string
  amount: number;        // positive = incoming
  sender: string;        // Auftraggeber / Empfänger
  reference: string;     // Verwendungszweck
  rawLine: string;
}

interface ImportMatch {
  transaction: BankTransaction;
  customerId: string | null;
  customerName: string | null;
  confidence: 'high' | 'medium' | 'none';
  selected: boolean;
}

// Normalize German number: "1.234,56" → 1234.56
function parseGermanNumber(s: string): number {
  const cleaned = s.replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.');
  return parseFloat(cleaned);
}

// Parse a date in German format "dd.mm.yyyy" or ISO "yyyy-mm-dd"
function parseDate(s: string): string {
  const trimmed = s.trim();
  const german = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (german) return `${german[3]}-${german[2].padStart(2,'0')}-${german[1].padStart(2,'0')}`;
  const iso = trimmed.match(/^\d{4}-\d{2}-\d{2}/);
  if (iso) return trimmed.slice(0, 10);
  return trimmed;
}

// Split CSV line respecting quoted fields
function splitCSVLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (!inQuote && ch === sep) { result.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur.trim());
  return result;
}

// Auto-detect separator: semicolon wins if more ";" than ","
function detectSep(headerLine: string): string {
  return (headerLine.split(';').length > headerLine.split(',').length) ? ';' : ',';
}

// Find the best column index by trying multiple header name variants
function findCol(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.toLowerCase().includes(c.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

// Parse CSV text into BankTransactions (incoming only: amount > 0)
function parseCSV(text: string): BankTransaction[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Find the header line (first line with known column keywords)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const l = lines[i].toLowerCase();
    if (l.includes('betrag') || l.includes('buchung') || l.includes('auftraggeber')) {
      headerIdx = i;
      break;
    }
  }

  const sep = detectSep(lines[headerIdx]);
  const headers = splitCSVLine(lines[headerIdx], sep);

  const colDate    = findCol(headers, ['buchungstag', 'buchungsdatum', 'datum', 'date', 'valuta']);
  const colAmount  = findCol(headers, ['betrag', 'amount', 'umsatz']);
  const colSender  = findCol(headers, ['auftraggeber', 'beguenstigter', 'begünstigter', 'empfänger', 'empfaenger', 'name']);
  const colRef     = findCol(headers, ['verwendungszweck', 'buchungstext', 'reference', 'zweck', 'text']);

  const txns: BankTransaction[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i], sep);
    if (cols.length < 3) continue;

    const amountRaw = colAmount !== -1 ? cols[colAmount] : '';
    const amount = parseGermanNumber(amountRaw);
    if (isNaN(amount) || amount <= 0) continue; // only incoming

    txns.push({
      date:      colDate   !== -1 ? parseDate(cols[colDate])   : '',
      amount,
      sender:    colSender !== -1 ? cols[colSender]   : '',
      reference: colRef    !== -1 ? cols[colRef]      : '',
      rawLine:   lines[i],
    });
  }
  return txns;
}

// Match transactions against customers: amount + name
function matchTransactions(txns: BankTransaction[], customers: OperationsCustomer[]): ImportMatch[] {
  return txns.map(tx => {
    // Normalize sender + reference for fuzzy name search
    const haystack = `${tx.sender} ${tx.reference}`.toLowerCase();

    let bestId: string | null = null;
    let bestName: string | null = null;
    let bestConf: 'high' | 'medium' | 'none' = 'none';

    for (const c of customers) {
      if (c.monatliches_honorar <= 0) continue;

      const amountMatch = Math.abs(tx.amount - c.monatliches_honorar) < 1;

      // Try matching any significant word from company name (≥4 chars)
      const words = c.company_name
        .replace(/GmbH|KG|AG|GbR|e\.K\.|&|Co\./gi, '')
        .split(/\s+/)
        .filter(w => w.length >= 4);
      const nameMatch = words.some(w => haystack.includes(w.toLowerCase()));

      let conf: 'high' | 'medium' | 'none' = 'none';
      if (amountMatch && nameMatch) conf = 'high';
      else if (amountMatch) conf = 'medium';
      else if (nameMatch) conf = 'medium';

      if (conf === 'high' || (conf === 'medium' && bestConf === 'none')) {
        bestId = c.customer_id;
        bestName = c.company_name;
        bestConf = conf;
      }
    }

    return {
      transaction: tx,
      customerId:   bestId,
      customerName: bestName,
      confidence:   bestConf,
      selected:     bestConf === 'high',
    };
  });
}

// ── E-Rechnung: Seller Config (Meyer Decision GbR) ─────
// !! Steuernummer + IBAN bitte hier eintragen !!
const SELLER_CONFIG = {
  name:       'Meyer Decision GbR',
  street:     'Talburgstraße 71',
  postcode:   '42579',
  city:       'Heiligenhaus',
  country:    'DE',
  email:      'gregory@meyerdecision.com',
  taxId:      '[STEUERNUMMER EINTRAGEN]',   // z.B. "123/456/78901"
  iban:       '[IBAN EINTRAGEN]',            // z.B. "DE12 3456 7890 1234 5678 90"
  bic:        '[BIC EINTRAGEN]',             // z.B. "SSKMDEMMXXX"
  bank:       '[BANK EINTRAGEN]',            // z.B. "Sparkasse Heiligenhaus"
};

// VAT rate – 19% standard for GbR above Kleinunternehmer threshold
const DEFAULT_VAT_RATE = 19;

// Invoice number: MD-YYYY-NNN stored in localStorage
const INVOICE_COUNTER_KEY = 'meyer-invoice-counter';

function getNextInvoiceNumber(): string {
  if (typeof window === 'undefined') return 'MD-0000-001';
  const year = new Date().getFullYear();
  const stored = localStorage.getItem(INVOICE_COUNTER_KEY);
  let counter = 1;
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.year === year) counter = (parsed.counter || 0) + 1;
    } catch { /* noop */ }
  }
  return `MD-${year}-${String(counter).padStart(3, '0')}`;
}

function saveInvoiceNumber(invoiceNumber: string) {
  if (typeof window === 'undefined') return;
  const parts = invoiceNumber.split('-');
  const year = parseInt(parts[1]);
  const counter = parseInt(parts[2]);
  if (!isNaN(year) && !isNaN(counter)) {
    localStorage.setItem(INVOICE_COUNTER_KEY, JSON.stringify({ year, counter }));
  }
}

// German month name for invoice description
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

// Add 30 days to an ISO date
function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface InvoiceFormData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  serviceMonth: string;
  buyerName: string;
  buyerStreet: string;
  buyerPostcode: string;
  buyerCity: string;
  serviceDescription: string;
  netAmount: number;
  vatRate: number;
  customerId: string;
}

// ── Workflow Steps ──────────────────────────────────────

const WORKFLOW_STEPS: { type: DocumentType; label: string; icon: string; sentKey: keyof OperationsCustomer; monthly?: boolean }[] = [
  { type: 'angebot',    label: 'Angebot',      icon: '📄', sentKey: 'angebot_sent',    monthly: false },
  { type: 'vertrag',    label: 'DL-Vertrag',   icon: '📝', sentKey: 'vertrag_sent',    monthly: false },
  { type: 'unterlagen', label: 'Unterlagen',   icon: '📎', sentKey: 'unterlagen_sent', monthly: false },
  { type: 'termin',     label: 'Mgmt-Termin',  icon: '📅', sentKey: 'termin_sent',     monthly: false },
  { type: 'reminder',   label: 'Reminder',     icon: '🔔', sentKey: 'reminder_sent',   monthly: true  },
  { type: 'rechnung',   label: 'Rechnung',     icon: '💶', sentKey: 'rechnung_sent',   monthly: true  },
];

// ── Per-month helpers ───────────────────────────────────
const EMPTY_MONTH: MonthlyOperationsData = {
  reminder_sent: false,
  rechnung_sent: false,
  daten_erhalten: false,
  daten_valide: false,
  call_durchgefuehrt: false,
};

function getMonthData(customer: OperationsCustomer, month: string): MonthlyOperationsData {
  return customer.monthly_data?.[month] ?? EMPTY_MONTH;
}

function computeAmpel(md: MonthlyOperationsData): import('@/lib/internal-os/types').AmpelStatus {
  if (md.daten_erhalten && md.daten_valide && md.call_durchgefuehrt) return 'GRUEN';
  if (md.daten_erhalten) return 'GELB';
  return 'ROT';
}

// Sender options (the two admin users)
const SENDERS = [
  { email: 'gregory@meyerdecision.com', name: 'Gregory Meyer' },
  { email: 'nhi@meyerdecision.com', name: 'Nhi Meyer' },
];

const OPS_STORAGE_KEY = 'meyer-internal-os-operations';
const OPS_STORAGE_VERSION = '4'; // bump to reset stored data
const OPS_VERSION_KEY = 'meyer-internal-os-operations-version';
const CRM_SYNC_KEY = 'meyer-crm-sync';

function loadOperations(): OperationsCustomer[] {
  if (typeof window === 'undefined') return SEED_OPERATIONS;
  try {
    // Reset if version changed (e.g. seed data was updated)
    const storedVersion = localStorage.getItem(OPS_VERSION_KEY);
    if (storedVersion !== OPS_STORAGE_VERSION) {
      localStorage.removeItem(OPS_STORAGE_KEY);
      localStorage.setItem(OPS_VERSION_KEY, OPS_STORAGE_VERSION);
      return SEED_OPERATIONS;
    }
    const stored = localStorage.getItem(OPS_STORAGE_KEY);
    if (stored) {
      const parsed: OperationsCustomer[] = JSON.parse(stored);
      // Migration: ensure all customers have monthly_data
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const migrated = parsed.map(c => {
        if (c.monthly_data && Object.keys(c.monthly_data).length > 0) return c;
        // Migrate flat fields into current month's data
        return {
          ...c,
          monthly_data: {
            [currentMonth]: {
              daten_erhalten: c.daten_erhalten,
              daten_valide: c.daten_valide,
              call_durchgefuehrt: c.call_durchgefuehrt,
              reminder_sent: c.reminder_sent,
              rechnung_sent: c.rechnung_sent ?? false,
              upload_status: c.upload_status,
              file_count: c.file_count,
              last_upload_date: c.last_upload_date,
              override_daten_erhalten: c.override_daten_erhalten,
              override_daten_valide: c.override_daten_valide,
              auto_check_files: c.auto_check_files,
              auto_check_missing: c.auto_check_missing,
              auto_check_issues: c.auto_check_issues,
              auto_checked_at: c.auto_checked_at,
              is_overdue: c.is_overdue,
            },
          },
        };
      });
      try{const mr=localStorage.getItem('meyer-internal-os-mandates');if(mr){const mIds=new Set((JSON.parse(mr)).map((m)=>m.customer_id));return migrated.filter(op=>mIds.has(op.customer_id));}      }catch{}
      return migrated;
    }
  } catch {}
try {
    const mr=localStorage.getItem('meyer-internal-os-mandates');
    if(mr){const mIds=new Set((JSON.parse(mr)).map((m)=>m.customer_id));return SEED_OPERATIONS.filter(c=>mIds.has(c.customer_id));}
  }catch{}
  return SEED_OPERATIONS;
}

// Map email type → CRM pipeline stage
const TYPE_TO_PIPELINE: Partial<Record<DocumentType, string>> = {
  angebot: 'angebot',
  vertrag: 'verhandlung',
  unterlagen: 'gewonnen',
};

export default function OperationsPage() {
  const [customers, setCustomers] = useState<OperationsCustomer[]>(loadOperations);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [editDraft, setEditDraft] = useState<EmailPreview | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [senderEmail, setSenderEmail] = useState(SENDERS[0].email);
  const [preparing, setPreparing] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [gmailStatus, setGmailStatus] = useState<Record<string, Record<string, boolean>>>({});
  // Empfänger-E-Mail pro Kunde (Standard: erste E-Mail aus der Liste)
  const [selectedRecipients, setSelectedRecipients] = useState<Record<string, string>>({});
  const [autoCheckRunning, setAutoCheckRunning] = useState(false);
  const [lastAutoCheck, setLastAutoCheck] = useState<string | null>(null);
  const [bodyResetKey, setBodyResetKey] = useState(0);
  // Pending sent confirmation: Gmail was opened, waiting for user to confirm email was actually sent
  const [pendingConfirm, setPendingConfirm] = useState<{ type: DocumentType; customerId: string; toEmail: string; label: string } | null>(null);
  // E-Rechnung Generator
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormData | null>(null);
  const [invoiceDownloading, setInvoiceDownloading] = useState(false);

  // Kontoauszug-Import
  const [showImport, setShowImport] = useState(false);
  const [importMatches, setImportMatches] = useState<ImportMatch[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Monat-Selektor ───────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Generate last 12 months as options
  const monthOptions = (() => {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      opts.push({ value, label });
    }
    return opts;
  })();

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Gmail-Verifikation beim Aufklappen ──
  async function verifyGmailStatus(customer: OperationsCustomer) {
    const email = customer.email;
    if (!email) return;
    setVerifyingId(customer.customer_id);
    try {
      const res = await fetch(`/api/internal/verify-gmail-sent?email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error('API Fehler');
      const data = await res.json() as Record<string, boolean>;
      setGmailStatus(prev => ({ ...prev, [customer.customer_id]: data }));
      setCustomers(prev => prev.map(c => {
        if (c.customer_id !== customer.customer_id) return c;
        return {
          ...c,
          angebot_sent:    data.angebot    ?? c.angebot_sent,
          vertrag_sent:    data.vertrag    ?? c.vertrag_sent,
          unterlagen_sent: data.unterlagen ?? c.unterlagen_sent,
          reminder_sent:   data.reminder   ?? c.reminder_sent,
          rechnung_sent:   data.rechnung   ?? c.rechnung_sent,
        };
      }));
    } catch { /* Stille Fehler – zeige lokalen Status */ } finally {
      setVerifyingId(null);
    }
  }

  // ── AUTO-CHECK: Scan Drive for uploads & validate ──────
  const runAutoCheck = useCallback(async () => {
    const API_BASE = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
    if (!API_BASE) return;

    setAutoCheckRunning(true);
    try {
      // Step 1: Check uploads
      const customerList = customers.map(c => ({ customer_id: c.customer_id, company_name: c.company_name }));

      const uploadRes = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_uploads', customers: customerList }),
      });
      const uploadJson = await uploadRes.json();
      const uploadData: Record<string, UploadCheckResult> = uploadJson.data || {};

      // Step 2: Validate data
      const validateRes = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate_data', customers: customerList }),
      });
      const validateJson = await validateRes.json();
      const validateData: Record<string, ValidationResult> = validateJson.data || {};

      // Step 3: Update customers (respect manual overrides, write to selected month)
      const checkedAt = new Date().toISOString();
      setCustomers(prev => prev.map(c => {
        const upload = uploadData[c.customer_id];
        const validation = validateData[c.customer_id];
        if (!upload && !validation) return c;

        const monthData = getMonthData(c, selectedMonth);
        const updatedMonth: MonthlyOperationsData = { ...monthData };

        // Auto-set daten_erhalten (only if not manually overridden)
        if (upload && !monthData.override_daten_erhalten) {
          updatedMonth.daten_erhalten  = upload.daten_erhalten;
          updatedMonth.file_count      = upload.file_count;
          updatedMonth.last_upload_date = upload.last_upload_date;
          updatedMonth.upload_status   = upload.file_count > 0 ? 'uploaded' : 'pending';
          updatedMonth.auto_check_files = upload.files;
          updatedMonth.is_overdue      = upload.is_overdue;
        }

        // Auto-set daten_valide (only if not manually overridden)
        if (validation && !monthData.override_daten_valide) {
          updatedMonth.daten_valide       = validation.daten_valide;
          updatedMonth.auto_check_missing = validation.missing_files;
          updatedMonth.auto_check_issues  = validation.issues;
        }

        updatedMonth.auto_checked_at = checkedAt;

        return {
          ...c,
          monthly_data: { ...c.monthly_data, [selectedMonth]: updatedMonth },
          // Sync flat fields for backward compat
          daten_erhalten:  updatedMonth.daten_erhalten,
          daten_valide:    updatedMonth.daten_valide,
          ampel_status:    computeAmpel(updatedMonth),
          file_count:      updatedMonth.file_count ?? c.file_count,
          last_upload_date: updatedMonth.last_upload_date ?? c.last_upload_date,
          upload_status:   updatedMonth.upload_status ?? c.upload_status,
          is_overdue:      updatedMonth.is_overdue,
          auto_checked_at: checkedAt,
        };
      }));

      setLastAutoCheck(new Date().toISOString());
      // Don't toast on success (too noisy on page load)
    } catch (err) {
      console.warn('Auto-Check error:', err);
      // Backend not reachable (CORS) – fail silently, manual data still works
    } finally {
      setAutoCheckRunning(false);
    }
  }, [customers]);

  // Run auto-check on page load
  useEffect(() => {
    const timer = setTimeout(() => { runAutoCheck(); }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist Operations customers to localStorage ────────
  useEffect(() => {
    try { localStorage.setItem(OPS_STORAGE_KEY, JSON.stringify(customers)); } catch {}
  }, [customers]);

  // ── Sync editDraft when preview opens ───────────────────
  useEffect(() => {
    if (preview) {
      setEditDraft({ ...preview });
    } else {
      setEditDraft(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview?.customer_id, preview?.type]);

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
        // Only use backend response if it actually has a non-empty body
        if (json.data && json.data.body && json.data.body.trim().length > 0) {
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
      termin: `Ihr erstes Managementgespr\u00e4ch mit Meyer Decision \u2013 Termin ausw\u00e4hlen`,
      reminder: `Kurze Erinnerung \u2013 Daten f\u00fcr den aktuellen Steuerungsmonat`,
      rechnung: `Rechnung Meyer Decision \u2013 ${customer.company_name}`,
    };

    const senderName = SENDERS.find(s => s.email === senderEmail)?.name || 'Meyer Decision';
    const firstEmail = customer.emails?.[0] || `${customer.ansprechpartner.toLowerCase().replace(/\s+/g, '.')}@example.de`;
    const recipientEmail = selectedRecipients[customer.customer_id] || firstEmail;

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
    const greeting = `Sehr geehrte/r ${customer.ansprechpartner}`;

    const signaturePersonal = `<p>Viele Gr\u00fc\u00dfe</p>
      <table style="font-size:13px;margin-top:8px;border:0;"><tr>
        <td style="padding-right:32px;border:0;"><strong>Gregory Meyer</strong><br>gregory@meyerdecision.com</td>
        <td style="border:0;"><strong>Nhi Meyer</strong><br>nhi@meyerdecision.com</td>
      </tr></table>
      <p style="color:#888;font-size:12px;margin-top:8px;">Meyer Decision GbR &middot; Talburgstra\u00dfe 71 &middot; 42579 Heiligenhaus</p>`;

    const signatureFormal = `<p>Mit freundlichen Gr\u00fc\u00dfen</p>
      <table style="font-size:13px;margin-top:8px;border:0;"><tr>
        <td style="padding-right:32px;border:0;"><strong>Gregory Meyer</strong><br>gregory@meyerdecision.com</td>
        <td style="border:0;"><strong>Nhi Meyer</strong><br>nhi@meyerdecision.com</td>
      </tr></table>
      <p style="color:#888;font-size:12px;margin-top:8px;">Meyer Decision GbR &middot; Talburgstra\u00dfe 71, 42579 Heiligenhaus</p>`;

    switch (type) {
      case 'angebot':
        return `<div style="font-family:Arial,sans-serif;color:#192231;line-height:1.6;">
          <p>${greeting},</p>
          <p>vielen Dank f\u00fcr das angenehme Gespr\u00e4ch. Anbei erhalten Sie unser individuelles Angebot f\u00fcr eine Zusammenarbeit mit Meyer Decision.</p>
          <p><strong>Worum es konkret geht</strong></p>
          <p>Mit unserem System etablieren wir eine strukturierte, monatliche Steuerungsgrundlage f\u00fcr Ihre Gesch\u00e4ftsf\u00fchrung. Im Mittelpunkt steht ein webbasiertes Dashboard, das Ihre wirtschaftliche Lage transparent darstellt und konkrete Handlungspriori\u00e4ten aufzeigt.</p>
          <p><strong>Was Sie erwarten k\u00f6nnen</strong></p>
          <ul style="margin:8px 0;padding-left:20px;">
            <li>Klare Einordnung Ihrer wirtschaftlichen Gesamtlage</li>
            <li>Transparenz \u00fcber Ertrags- und Vertragsstrukturen</li>
            <li>Fr\u00fchzeitige Identifikation von Liquidit\u00e4tsrisiken</li>
            <li>Konkrete, priorisierte Ma\u00dfnahmen zur Ergebnisverbesserung</li>
          </ul>
          <p>Wir laden Sie ein, das Angebot in Ruhe zu pr\u00fcfen. F\u00fcr R\u00fcckfragen oder eine gemeinsame Durchsicht einzelner Punkte stehen wir Ihnen jederzeit gerne zur Verf\u00fcgung.</p>
          <p>Sobald Sie gr\u00fcnes Licht geben, starten wir umgehend mit der Einrichtung Ihres Systems.</p>
          <p>Wir freuen uns auf Ihre R\u00fcckmeldung.</p>
          ${signaturePersonal}
        </div>`;

      case 'vertrag':
        return `<div style="font-family:Arial,sans-serif;color:#192231;line-height:1.6;">
          <p>${greeting},</p>
          <p>vielen Dank f\u00fcr das konstruktive Gespr\u00e4ch und Ihr Vertrauen in Meyer Decision. Anbei erhalten Sie die vollst\u00e4ndigen Vertragsunterlagen f\u00fcr unsere Zusammenarbeit.</p>
          <p>Neben dem Dienstleistungsvertrag sind alle relevanten Anlagen beigef\u00fcgt \u2013 Leistungsbeschreibung, Datenschutzvereinbarung u.\u00a0a. \u2013 und bieten Ihnen einen umfassenden \u00dcberblick \u00fcber Leistungsumfang und Vertragsstruktur.</p>
          <p><strong>N\u00e4chster Schritt</strong></p>
          <p>Wir bitten Sie, die Unterlagen sorgf\u00e4ltig zu pr\u00fcfen. F\u00fcr R\u00fcckfragen oder Anmerkungen stehen wir Ihnen jederzeit gerne zur Verf\u00fcgung.</p>
          <p>Sobald alles zu Ihrer Zufriedenheit ist, bitten wir Sie, den Vertrag unterschrieben an uns zur\u00fcckzusenden. Nach Vertragseingang beginnen wir umgehend mit der Einrichtung Ihres Systems und informieren Sie \u00fcber die n\u00e4chsten Schritte (Dashboard-Zugang, Datenanleitung u.\u00a0a.).</p>
          <p>Wir freuen uns auf die Zusammenarbeit.</p>
          ${signaturePersonal}
        </div>`;

      case 'unterlagen':
        return `<div style="font-family:Arial,sans-serif;color:#192231;line-height:1.6;">
          <p>${greeting},</p>
          <p>herzlichen Gl\u00fcckwunsch \u2013 Ihr Meyer Decision Steuerungssystem ist eingerichtet und steht Ihnen ab sofort vollumf\u00e4nglich zur Verf\u00fcgung.</p>
          <p><strong>Ihr Dashboard-Zugang</strong></p>
          <p>\u00dcber das Dashboard haben Sie jederzeit Zugriff auf die wirtschaftlichen Kennzahlen Ihres Unternehmens sowie auf s\u00e4mtliche monatlichen Auswertungen:</p>
          <p><a href="https://meyer-dashboard.vercel.app" style="color:#B08A6A;">https://meyer-dashboard.vercel.app</a></p>
          <p>Bitte melden Sie sich mit der E-Mail-Adresse an, die f\u00fcr Ihr Unternehmen bei uns registriert ist.</p>
          <p><strong>Hinweis zum ersten Zugriff</strong></p>
          <p>Beim ersten Aufruf kann eine Google-Sicherheitsmeldung erscheinen. Dies ist technisch bedingt und vollkommen unbedenklich. Bitte gehen Sie wie folgt vor:</p>
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
          <p>Damit Ihr Team wei\u00df, welche Daten ben\u00f6tigt werden, finden Sie hier die Anleitung zur Datenbereitstellung als Anhang.</p>
          <p>Bitte stellen Sie die Daten k\u00fcnftig monatlich zum vereinbarten Zeitpunkt bereit \u2013 dies ist die Grundlage f\u00fcr eine pr\u00e4zise und aussagekr\u00e4ftige Analyse.</p>
          <p>Bei Fragen oder technischen R\u00fcckfragen stehen wir Ihnen jederzeit gerne zur Verf\u00fcgung.</p>
          <p>Wir freuen uns auf die Zusammenarbeit.</p>
          ${signaturePersonal}
        </div>`;

      case 'termin':
        return `<div style="font-family:Arial,sans-serif;color:#192231;line-height:1.6;">
          <p>${greeting},</p>
          <p>wir freuen uns, Ihnen mitteilen zu k\u00f6nnen, dass Ihre Daten erfolgreich angebunden wurden und Ihr Steuerungssystem eingerichtet ist.</p>
          <p>Als n\u00e4chsten Schritt m\u00f6chten wir gemeinsam mit Ihnen das erste Managementgespr\u00e4ch durchf\u00fchren \u2013 um das Dashboard vorzustellen, die Ergebnisse einzuordnen und konkrete Ma\u00dfnahmen zu besprechen.</p>
          <p><strong>Termin vereinbaren</strong></p>
          <p>Bitte w\u00e4hlen Sie \u00fcber den folgenden Link einen Termin aus, der f\u00fcr Sie passt:</p>
          <p style="margin:12px 0;">
            <a href="https://calendly.com/nhi-meyerdecision/30min" style="display:inline-block;background:#192231;color:#f7f5f2;text-decoration:none;padding:10px 20px;border-radius:4px;font-size:13px;font-weight:600;">
              \u2192 Termin vereinbaren \u2013 Meyer Decision
            </a>
          </p>
          <p style="font-size:12px;color:#888;"><a href="https://calendly.com/nhi-meyerdecision/30min" style="color:#B08A6A;">https://calendly.com/nhi-meyerdecision/30min</a></p>
          <p>Das Gespr\u00e4ch dauert ca. 60 Minuten und findet per Videokonferenz statt. Den Einladungslink erhalten Sie automatisch nach der Buchung.</p>
          <p>Wir freuen uns auf das Gespr\u00e4ch.</p>
          ${signatureFormal}
        </div>`;

      case 'reminder':
        return `<div style="font-family:Arial,sans-serif;color:#192231;line-height:1.6;">
          <p>${greeting},</p>
          <p>f\u00fcr die termingerechte Aktualisierung Ihres Dashboards und die Erstellung des monatlichen Management-Reports ben\u00f6tigen wir Ihre aktuellen Unternehmensdaten.</p>
          <p>Wir bitten Sie, die entsprechenden Dateien im vorgesehenen Upload-Ordner bereitzustellen, sofern dies noch nicht geschehen ist.</p>
          <p><strong>Nach Dateneingang aktualisieren wir</strong></p>
          <ul style="margin:8px 0;padding-left:20px;">
            <li>Ihr Dashboard mit den aktuellen Kennzahlen</li>
            <li>Den monatlichen Management-Report</li>
            <li>Die Ma\u00dfnahmen\u00fcbersicht im Advisory-System</li>
          </ul>
          <p>F\u00fcr Fragen zur Datenstruktur oder zum Upload-Prozess stehen wir Ihnen selbstverst\u00e4ndlich gerne zur Verf\u00fcgung.</p>
          <p>Vielen Dank f\u00fcr Ihre Mitwirkung \u2013 gemeinsam schaffen wir die Grundlage f\u00fcr fundierte Entscheidungen.</p>
          ${signatureFormal}
        </div>`;

      case 'rechnung':
        return `<div style="font-family:Arial,sans-serif;color:#192231;line-height:1.6;">
          <p>${greeting},</p>
          <p>anbei erhalten Sie die Rechnung f\u00fcr den aktuellen Leistungsmonat.</p>
          <p>Die Rechnung umfasst die vereinbarte Advisory-Leistung einschlie\u00dflich des Zugangs zum webbasierten Steuerungsdashboard sowie der laufenden wirtschaftlichen Analyse und Auswertung Ihrer Kennzahlen.</p>
          <p>Bei R\u00fcckfragen zur Rechnung stehen wir Ihnen selbstverst\u00e4ndlich jederzeit gerne zur Verf\u00fcgung.</p>
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
      case 'termin':
        return [];
      case 'reminder':
        return [];
      case 'rechnung':
        return [
          { name: `Rechnung_Meyer_Decision_${safeName}.pdf`, size: '83 KB' },
          { name: 'E-Rechnung.xml', size: '12 KB' },
        ];
    }
  }

  // ── Plain-text body for URL fallback ────────────────────
  function toPlainText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n').replace(/<\/tr>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&ndash;/g, '–')
      .replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü')
      .replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö').replace(/&Uuml;/g, 'Ü')
      .replace(/&szlig;/g, 'ß').replace(/&szlig;/g, 'ß').replace(/&rarr;/g, '→')
      .replace(/&#9656;/g, '▸').replace(/\n{3,}/g, '\n\n').trim();
  }

  // ── SEND ─────────────────────────────────────────────────
  // Priority order:
  //   1. Gmail API (Next.js route) → creates proper HTML draft, opens it
  //   2. Apps Script (CORS fallback – likely fails)
  //   3. Gmail compose URL with plain text
  async function handleSend(emailPreview: EmailPreview) {
    const key = `${emailPreview.type}-${emailPreview.customer_id}`;
    setSendingKey(key);

    // ── 1. Gmail API via Next.js route ──────────────────────
    try {
      const res = await fetch('/api/internal/create-gmail-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailPreview.to,
          from: emailPreview.from,
          subject: emailPreview.subject,
          body: emailPreview.body,
        }),
      });
      const json = await res.json();
      if (json.success && json.draftUrl) {
        window.open(json.draftUrl, '_blank');
        const stepLabel = WORKFLOW_STEPS.find(s => s.type === emailPreview.type)?.label ?? emailPreview.type;
        setPendingConfirm({ type: emailPreview.type, customerId: emailPreview.customer_id, toEmail: emailPreview.to, label: stepLabel });
        showToast(`Gmail-Entwurf geöffnet – bitte E-Mail senden und unten bestätigen`, 'success');
        setSendingKey(null);
        setPreview(null);
        return;
      }
      // json.error means OAuth not configured – fall through silently
    } catch {
      // Network error – fall through
    }

    // ── 2. Apps Script (GmailApp.sendEmail) ────────────────
    const API_BASE = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
    if (API_BASE) {
      try {
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
          showToast(`E-Mail erfolgreich gesendet an ${emailPreview.to}`, 'success');
          setSendingKey(null);
          setPreview(null);
          return;
        }
      } catch {
        // CORS / network error – fall through
      }
    }

    // ── 3. Gmail compose URL (plain text fallback) ──────────
    const attachmentNote = emailPreview.attachments.length > 0
      ? `📎 BITTE ANHÄNGEN:\n${emailPreview.attachments.map(a => `  • ${a.name} (${a.size})`).join('\n')}\n\n${'─'.repeat(40)}\n\n`
      : '';
    const params = new URLSearchParams({
      view: 'cm', fs: '1',
      to: emailPreview.to,
      su: emailPreview.subject,
      body: attachmentNote + toPlainText(emailPreview.body),
    });
    window.open(`https://mail.google.com/mail/?${params.toString()}`, '_blank');
    const stepLabel = WORKFLOW_STEPS.find(s => s.type === emailPreview.type)?.label ?? emailPreview.type;
    setPendingConfirm({ type: emailPreview.type, customerId: emailPreview.customer_id, toEmail: emailPreview.to, label: stepLabel });
    showToast(`Gmail geöffnet – bitte E-Mail senden und unten bestätigen`, 'success');
    setSendingKey(null);
    setPreview(null);
  }

  function updateSentStatus(type: DocumentType, customerId: string) {
    const step = WORKFLOW_STEPS.find(s => s.type === type);
    if (step) {
      setCustomers(prev => prev.map(c => {
        if (c.customer_id !== customerId) return c;
        if (step.monthly) {
          // Monthly step → write to monthly_data[selectedMonth]
          const monthData = getMonthData(c, selectedMonth);
          const field = step.type === 'reminder' ? 'reminder_sent' : 'rechnung_sent';
          const updatedMonth = { ...monthData, [field]: true };
          return {
            ...c,
            monthly_data: { ...c.monthly_data, [selectedMonth]: updatedMonth },
            [step.sentKey]: true, // also sync flat field
          };
        }
        // One-time step → just update flat field
        return { ...c, [step.sentKey]: true };
      }));
    }

    // ── CRM Pipeline auto-sync ──────────────────────────────
    // When an email type that progresses the sales stage is sent,
    // write a sync event so the CRM page can advance the pipeline.
    const targetStage = TYPE_TO_PIPELINE[type];
    if (targetStage) {
      try {
        const customer = customers.find(c => c.customer_id === customerId);
        if (customer) {
          const existing: Array<{ company_name: string; pipeline_stage: string; sent_at: string }> =
            JSON.parse(localStorage.getItem(CRM_SYNC_KEY) || '[]');
          // Remove stale entry for same company, add fresh one
          const updated = existing.filter(e => e.company_name !== customer.company_name);
          updated.push({ company_name: customer.company_name, pipeline_stage: targetStage, sent_at: new Date().toISOString() });
          localStorage.setItem(CRM_SYNC_KEY, JSON.stringify(updated));
        }
      } catch {}
    }
  }

  // ── E-Rechnung Generator ───────────────────────────────
  function openInvoiceGenerator(customer: OperationsCustomer) {
    const today = new Date().toISOString().slice(0, 10);
    const invoiceNumber = getNextInvoiceNumber();
    const dienstleistung = (customer as OperationsCustomer & { gebuchte_dienstleistung?: string }).gebuchte_dienstleistung || 'Advisory Controlling';
    setInvoiceForm({
      invoiceNumber,
      issueDate: today,
      dueDate: addDays(today, 30),
      serviceMonth: selectedMonth,
      buyerName: customer.company_name,
      buyerStreet: '',
      buyerPostcode: '',
      buyerCity: '',
      serviceDescription: `${dienstleistung} – ${monthLabel(selectedMonth)}`,
      netAmount: customer.monatliches_honorar,
      vatRate: DEFAULT_VAT_RATE,
      customerId: customer.customer_id,
    });
  }

  async function downloadXml(form: InvoiceFormData) {
    setInvoiceDownloading(true);
    try {
      const vatTotal = Math.round(form.netAmount * (form.vatRate / 100) * 100) / 100;
      const grossTotal = Math.round((form.netAmount + vatTotal) * 100) / 100;
      const payload = {
        invoiceNumber: form.invoiceNumber,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        serviceMonth: form.serviceMonth,
        sellerName: SELLER_CONFIG.name,
        sellerStreet: SELLER_CONFIG.street,
        sellerPostcode: SELLER_CONFIG.postcode,
        sellerCity: SELLER_CONFIG.city,
        sellerCountry: SELLER_CONFIG.country,
        sellerEmail: SELLER_CONFIG.email,
        sellerTaxId: SELLER_CONFIG.taxId,
        sellerIban: SELLER_CONFIG.iban,
        sellerBic: SELLER_CONFIG.bic,
        sellerBank: SELLER_CONFIG.bank,
        buyerName: form.buyerName,
        buyerStreet: form.buyerStreet,
        buyerPostcode: form.buyerPostcode,
        buyerCity: form.buyerCity,
        buyerCountry: 'DE',
        items: [{
          id: '1',
          description: form.serviceDescription,
          quantity: 1,
          unitCode: 'MON',
          unitPrice: form.netAmount,
          vatRate: form.vatRate,
        }],
        netTotal: form.netAmount,
        vatTotal,
        grossTotal,
      };
      const res = await fetch('/api/internal/invoice-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('XML-Generierung fehlgeschlagen');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${form.invoiceNumber}_ZUGFeRD.xml`;
      a.click();
      URL.revokeObjectURL(url);
      saveInvoiceNumber(form.invoiceNumber);
      showToast('ZUGFeRD-XML heruntergeladen ✓', 'success');
    } catch (e) {
      showToast(`XML-Fehler: ${String(e)}`, 'error');
    } finally {
      setInvoiceDownloading(false);
    }
  }

  function printInvoice(form: InvoiceFormData) {
    const vatTotal = Math.round(form.netAmount * (form.vatRate / 100) * 100) / 100;
    const grossTotal = Math.round((form.netAmount + vatTotal) * 100) / 100;
    const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const [sy, sm] = form.serviceMonth.split('-').map(Number);
    const lastDay = new Date(sy, sm, 0).getDate();

    const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Rechnung ${form.invoiceNumber}</title>
  <style>
    @page { size: A4; margin: 20mm 20mm 25mm 20mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #192231; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10mm; border-bottom: 2px solid #B08A6A; padding-bottom: 6mm; }
    .logo { font-size: 18pt; font-weight: 800; letter-spacing: 1px; color: #192231; }
    .logo span { color: #B08A6A; }
    .seller-info { font-size: 8pt; color: #666; text-align: right; line-height: 1.6; }
    .sender-line { font-size: 7pt; color: #999; margin-bottom: 4mm; }
    .buyer-block { margin-bottom: 8mm; }
    .invoice-meta { display: flex; justify-content: flex-end; margin-bottom: 8mm; }
    .meta-table { border-collapse: collapse; }
    .meta-table td { padding: 2px 8px; font-size: 9pt; }
    .meta-table td:first-child { color: #888; }
    .meta-table td:last-child { font-weight: 600; text-align: right; }
    h1 { font-size: 14pt; font-weight: 700; margin-bottom: 6mm; }
    table.items { width: 100%; border-collapse: collapse; margin-bottom: 6mm; }
    table.items th { background: #192231; color: #F7F5F2; padding: 4px 8px; font-size: 9pt; text-align: left; }
    table.items th.r { text-align: right; }
    table.items td { padding: 5px 8px; font-size: 9pt; border-bottom: 1px solid #eee; }
    table.items td.r { text-align: right; }
    .totals { margin-left: auto; width: 200px; margin-bottom: 8mm; }
    .totals table { width: 100%; border-collapse: collapse; }
    .totals td { padding: 3px 0; font-size: 9pt; }
    .totals td:last-child { text-align: right; font-weight: 600; }
    .totals .grand { font-size: 11pt; font-weight: 800; border-top: 2px solid #192231; padding-top: 4px; margin-top: 2px; }
    .payment { background: #F7F5F2; border-left: 3px solid #B08A6A; padding: 4mm; margin-bottom: 6mm; font-size: 9pt; }
    .payment strong { display: block; margin-bottom: 2mm; font-size: 10pt; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; border-top: 1px solid #eee; padding: 3mm 20mm; font-size: 7.5pt; color: #999; display: flex; justify-content: space-between; }
    .legal { font-size: 7.5pt; color: #aaa; text-align: center; margin-top: 4mm; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">MEYER <span>|</span> DECISION</div>
      <div style="font-size:8pt;color:#B08A6A;margin-top:2px;">Unternehmensberatung</div>
    </div>
    <div class="seller-info">
      ${SELLER_CONFIG.name}<br>
      ${SELLER_CONFIG.street}<br>
      ${SELLER_CONFIG.postcode} ${SELLER_CONFIG.city}<br>
      ${SELLER_CONFIG.email}
    </div>
  </div>

  <div class="sender-line">${SELLER_CONFIG.name} · ${SELLER_CONFIG.street} · ${SELLER_CONFIG.postcode} ${SELLER_CONFIG.city}</div>

  <div class="buyer-block">
    <strong>${form.buyerName}</strong><br>
    ${form.buyerStreet ? form.buyerStreet + '<br>' : ''}
    ${(form.buyerPostcode || form.buyerCity) ? form.buyerPostcode + ' ' + form.buyerCity : ''}
  </div>

  <div class="invoice-meta">
    <table class="meta-table">
      <tr><td>Rechnungsnummer</td><td>${form.invoiceNumber}</td></tr>
      <tr><td>Rechnungsdatum</td><td>${new Date(form.issueDate).toLocaleDateString('de-DE')}</td></tr>
      <tr><td>Leistungszeitraum</td><td>01.${String(sm).padStart(2,'0')}.${sy} – ${lastDay}.${String(sm).padStart(2,'0')}.${sy}</td></tr>
      <tr><td>Fälligkeitsdatum</td><td>${new Date(form.dueDate).toLocaleDateString('de-DE')}</td></tr>
      <tr><td>Steuernummer</td><td>${SELLER_CONFIG.taxId}</td></tr>
    </table>
  </div>

  <h1>Rechnung</h1>

  <table class="items">
    <thead>
      <tr>
        <th>Pos.</th>
        <th>Beschreibung</th>
        <th class="r">Menge</th>
        <th class="r">Einzelpreis (netto)</th>
        <th class="r">MwSt.</th>
        <th class="r">Betrag (netto)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>${form.serviceDescription}</td>
        <td class="r">1</td>
        <td class="r">${fmt(form.netAmount)} €</td>
        <td class="r">${form.vatRate} %</td>
        <td class="r">${fmt(form.netAmount)} €</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Nettobetrag</td><td>${fmt(form.netAmount)} €</td></tr>
      <tr><td>MwSt. ${form.vatRate} %</td><td>${fmt(vatTotal)} €</td></tr>
      <tr class="grand"><td><strong>Gesamtbetrag</strong></td><td><strong>${fmt(grossTotal)} €</strong></td></tr>
    </table>
  </div>

  <div class="payment">
    <strong>Zahlungsinformationen</strong>
    Bitte überweisen Sie den Betrag von <strong>${fmt(grossTotal)} €</strong> bis zum <strong>${new Date(form.dueDate).toLocaleDateString('de-DE')}</strong> auf folgendes Konto:<br><br>
    Kontoinhaber: ${SELLER_CONFIG.name}<br>
    IBAN: ${SELLER_CONFIG.iban}<br>
    BIC: ${SELLER_CONFIG.bic}<br>
    Bank: ${SELLER_CONFIG.bank}<br>
    Verwendungszweck: <strong>${form.invoiceNumber}</strong>
  </div>

  <p class="legal">Diese Rechnung wurde elektronisch erstellt und ist ohne Unterschrift gültig.</p>

  <div class="footer">
    <span>${SELLER_CONFIG.name} · ${SELLER_CONFIG.street} · ${SELLER_CONFIG.postcode} ${SELLER_CONFIG.city}</span>
    <span>gregory@meyerdecision.com · nhi@meyerdecision.com</span>
    <span>Steuernummer: ${SELLER_CONFIG.taxId}</span>
  </div>

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      saveInvoiceNumber(form.invoiceNumber);
    }
  }

  // ── Mark Monthly Status ─────────────────────────────────
  function toggleStatus(customerId: string, field: 'daten_erhalten' | 'daten_valide' | 'call_durchgefuehrt') {
    setCustomers(prev => prev.map(c => {
      if (c.customer_id !== customerId) return c;
      const monthData = getMonthData(c, selectedMonth);
      const updatedMonth: MonthlyOperationsData = {
        ...monthData,
        [field]: !monthData[field],
        // Set manual override flag
        override_daten_erhalten: field === 'daten_erhalten' ? true : monthData.override_daten_erhalten,
        override_daten_valide:   field === 'daten_valide'   ? true : monthData.override_daten_valide,
      };
      const ampel = computeAmpel(updatedMonth);
      return {
        ...c,
        monthly_data: { ...c.monthly_data, [selectedMonth]: updatedMonth },
        // Also sync flat fields for backward compat (used elsewhere)
        daten_erhalten:       updatedMonth.daten_erhalten,
        daten_valide:         updatedMonth.daten_valide,
        call_durchgefuehrt:   updatedMonth.call_durchgefuehrt,
        ampel_status:         ampel,
        override_daten_erhalten: updatedMonth.override_daten_erhalten,
        override_daten_valide:   updatedMonth.override_daten_valide,
      };
    }));
  }

  // ── Mark invoice as paid ────────────────────────────────
  function markRechnungBezahlt(customerId: string, bezahlt: boolean) {
    setCustomers(prev => prev.map(c => {
      if (c.customer_id !== customerId) return c;
      const monthData = getMonthData(c, selectedMonth);
      const updatedMonth: MonthlyOperationsData = {
        ...monthData,
        rechnung_bezahlt: bezahlt,
        rechnung_bezahlt_am: bezahlt ? new Date().toISOString() : null,
      };
      return {
        ...c,
        monthly_data: { ...c.monthly_data, [selectedMonth]: updatedMonth },
      };
    }));
  }

  // ── Kontoauszug-Import ──────────────────────────────────
  function handleImportFile(file: File) {
    setImportError('');
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text || text.trim().length === 0) {
          setImportError('Datei ist leer oder konnte nicht gelesen werden.');
          return;
        }
        const txns = parseCSV(text);
        if (txns.length === 0) {
          setImportError('Keine eingehenden Zahlungen gefunden. Bitte prüfe das Dateiformat.');
          return;
        }
        const matches = matchTransactions(txns, customers);
        setImportMatches(matches);
        setShowImport(true);
      } catch {
        setImportError('Fehler beim Lesen der Datei. Bitte als CSV exportieren.');
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  function applyImport() {
    const toMark = importMatches.filter(m => m.selected && m.customerId);
    setCustomers(prev => prev.map(c => {
      const match = toMark.find(m => m.customerId === c.customer_id);
      if (!match) return c;
      const monthData = getMonthData(c, selectedMonth);
      const updatedMonth: MonthlyOperationsData = {
        ...monthData,
        rechnung_bezahlt: true,
        rechnung_bezahlt_am: match.transaction.date
          ? `${match.transaction.date}T00:00:00.000Z`
          : new Date().toISOString(),
      };
      return { ...c, monthly_data: { ...c.monthly_data, [selectedMonth]: updatedMonth } };
    }));
    showToast(`${toMark.length} Rechnung${toMark.length !== 1 ? 'en' : ''} als bezahlt markiert ✓`, 'success');
    setShowImport(false);
    setImportMatches([]);
  }

  // Reset manual override (let auto-check take over again)
  function resetOverride(customerId: string, field: 'override_daten_erhalten' | 'override_daten_valide') {
    setCustomers(prev => prev.map(c => {
      if (c.customer_id !== customerId) return c;
      const monthData = getMonthData(c, selectedMonth);
      const updatedMonth = { ...monthData, [field]: false };
      return {
        ...c,
        monthly_data: { ...c.monthly_data, [selectedMonth]: updatedMonth },
        [field]: false,
      };
    }));
    // Re-run auto-check after resetting
    setTimeout(() => runAutoCheck(), 100);
  }

  // ── KPIs (computed from selected month's data) ──────────
  const gruen = customers.filter(c => computeAmpel(getMonthData(c, selectedMonth)) === 'GRUEN').length;
  const gelb  = customers.filter(c => computeAmpel(getMonthData(c, selectedMonth)) === 'GELB').length;
  const rot   = customers.filter(c => computeAmpel(getMonthData(c, selectedMonth)) === 'ROT').length;
  // Invoice KPIs
  const offeneRechnungen = customers.filter(c => {
    const md = getMonthData(c, selectedMonth);
    return md.rechnung_sent && !md.rechnung_bezahlt;
  });
  const offenerBetrag = offeneRechnungen.reduce((sum, c) => sum + (c.monatliches_honorar || 0), 0);
  const bezahlteRechnungen = customers.filter(c => getMonthData(c, selectedMonth).rechnung_bezahlt).length;
  // Check upload deadline relative to selected month
  const today = new Date();
  const [selYear, selMonthNum] = selectedMonth.split('-').map(Number);
  const isCurrentMonth = selYear === today.getFullYear() && selMonthNum === today.getMonth() + 1;
  const isPastDeadline = isCurrentMonth
    ? today.getDate() > 10
    : today > new Date(selYear, selMonthNum - 1, 10); // past month → always past deadline
  const customersNeedingData = isPastDeadline
    ? customers.filter(c => !getMonthData(c, selectedMonth).daten_erhalten)
    : [];

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
          toast.type === 'success' ? 'bg-navy text-white' : 'bg-amber-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Pending Send Confirmation Banner */}
      {pendingConfirm && (
        <div className="mb-6 bg-amber-50 border border-amber-300 rounded-2xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-amber-500 text-xl">📬</span>
            <div>
              <div className="font-manrope font-bold text-amber-800 text-sm">
                {pendingConfirm.label} – wurde die E-Mail an {pendingConfirm.toEmail} abgeschickt?
              </div>
              <div className="text-xs text-amber-600 mt-0.5">
                Bitte bestätigen, sobald die E-Mail tatsächlich gesendet wurde – erst dann wird der Status aktualisiert.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                updateSentStatus(pendingConfirm.type, pendingConfirm.customerId);
                setPendingConfirm(null);
                showToast(`${pendingConfirm.label} als gesendet markiert ✓`, 'success');
              }}
              className="px-4 py-2 bg-green-600 text-white text-xs font-semibold rounded-xl hover:bg-green-700 transition-colors"
            >
              ✓ Ja, gesendet
            </button>
            <button
              onClick={() => setPendingConfirm(null)}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-500 text-xs font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Kontoauszug-Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <div className="font-manrope font-bold text-navy text-lg">Kontoauszug importieren</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {importFileName} · {importMatches.length} eingehende Zahlung{importMatches.length !== 1 ? 'en' : ''} erkannt
                  · Monat: {importMatches.length > 0 ? (new Date(selectedMonth + '-01').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })) : '–'}
                </div>
              </div>
              <button onClick={() => { setShowImport(false); setImportMatches([]); }} className="text-gray-300 hover:text-gray-500 text-2xl leading-none">×</button>
            </div>

            {/* Match List */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
              {importMatches.length === 0 && (
                <div className="text-center text-sm text-gray-400 py-8">Keine Zahlungen gefunden.</div>
              )}
              {importMatches.map((m, i) => (
                <div
                  key={i}
                  onClick={() => setImportMatches(prev => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))}
                  className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all select-none ${
                    m.selected
                      ? 'bg-green-50 border-green-200'
                      : 'bg-white border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  {/* Checkbox */}
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    m.selected ? 'bg-green-600 border-green-600' : 'border-gray-300'
                  }`}>
                    {m.selected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                  </div>

                  {/* Transaction info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-navy truncate">{m.transaction.sender || '–'}</span>
                      {m.transaction.date && <span className="text-xs text-gray-400 shrink-0">{new Date(m.transaction.date).toLocaleDateString('de-DE')}</span>}
                    </div>
                    {m.transaction.reference && (
                      <div className="text-xs text-gray-400 truncate mt-0.5">{m.transaction.reference}</div>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="text-right shrink-0">
                    <div className="font-bold text-green-700">+€ {m.transaction.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</div>
                  </div>

                  {/* Match badge */}
                  <div className="shrink-0 text-right min-w-[120px]">
                    {m.confidence === 'high' && (
                      <div>
                        <div className="text-[10px] font-bold text-green-600 bg-green-100 rounded-md px-2 py-0.5 inline-block">✓ Sicher</div>
                        <div className="text-[10px] text-gray-500 mt-0.5 truncate">{m.customerName}</div>
                      </div>
                    )}
                    {m.confidence === 'medium' && (
                      <div>
                        <div className="text-[10px] font-bold text-amber-600 bg-amber-100 rounded-md px-2 py-0.5 inline-block">⚠ Mögl. Match</div>
                        <div className="text-[10px] text-gray-500 mt-0.5 truncate">{m.customerName}</div>
                      </div>
                    )}
                    {m.confidence === 'none' && (
                      <div className="text-[10px] text-gray-400 bg-gray-100 rounded-md px-2 py-0.5 inline-block">Kein Treffer</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <div className="text-xs text-gray-400">
                {importMatches.filter(m => m.selected).length} ausgewählt ·{' '}
                <button className="underline underline-offset-2 hover:text-gray-600" onClick={() => setImportMatches(p => p.map(m => ({ ...m, selected: m.confidence !== 'none' })))}>Alle Treffer wählen</button>
                {' · '}
                <button className="underline underline-offset-2 hover:text-gray-600" onClick={() => setImportMatches(p => p.map(m => ({ ...m, selected: false })))}>Keine</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowImport(false); setImportMatches([]); }} className="px-4 py-2 text-xs text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Abbrechen</button>
                <button
                  onClick={applyImport}
                  disabled={importMatches.filter(m => m.selected && m.customerId).length === 0}
                  className="px-4 py-2 text-xs font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {importMatches.filter(m => m.selected && m.customerId).length} Rechnung{importMatches.filter(m => m.selected && m.customerId).length !== 1 ? 'en' : ''} als bezahlt markieren
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import-Fehler Toast (außerhalb Modal) */}
      {importError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>⚠ {importError}</span>
          <button onClick={() => setImportError('')} className="text-red-400 hover:text-red-600 ml-4">×</button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-manrope text-2xl font-bold text-navy">Operativer Status</h1>
          <p className="text-sm text-gray-500 mt-1">
            Workflow: Angebot &rarr; Vertrag &rarr; Unterlagen &rarr; Mgmt-Termin &rarr; Reminder &rarr; Rechnung
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Monat-Selektor */}
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 outline-none focus:ring-2 focus:ring-copper/20"
          >
            {monthOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={() => runAutoCheck()}
            disabled={autoCheckRunning}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
              autoCheckRunning
                ? 'border-copper/30 bg-copper/5 text-copper cursor-wait'
                : 'border-gray-200 text-gray-600 hover:bg-green-50 hover:border-green-200 hover:text-green-700'
            }`}
            title={lastAutoCheck ? `Letzter Check: ${formatDate(lastAutoCheck)}` : 'Noch nicht geprüft'}
          >
            {autoCheckRunning ? (
              <>
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                Prüfe Drive...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Auto-Check
              </>
            )}
          </button>
          {/* Kontoauszug importieren */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.xls,.xlsx"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ''; }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all"
            title="Kontoauszug als CSV importieren und Zahlungsstatus automatisch aktualisieren"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Kontoauszug
          </button>
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
        {/* Invoice KPI */}
        <div className={`rounded-2xl border shadow-sm p-5 flex items-center gap-4 ${
          offeneRechnungen.length > 0
            ? 'bg-amber-50 border-amber-200'
            : 'bg-white border-gray-100'
        }`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg ${
            offeneRechnungen.length > 0 ? 'bg-amber-400' : 'bg-green-500'
          }`}>
            {offeneRechnungen.length > 0 ? offeneRechnungen.length : '✓'}
          </div>
          <div>
            <div className="font-manrope text-xl font-bold text-navy">
              {offeneRechnungen.length > 0 ? 'Offen' : 'Alles bezahlt'}
            </div>
            <div className="text-xs text-gray-400">
              {offeneRechnungen.length > 0
                ? `€\u00a0${offenerBetrag.toLocaleString('de-DE')} ausstehend`
                : `${bezahlteRechnungen} Rechnung${bezahlteRechnungen !== 1 ? 'en' : ''} bezahlt`}
            </div>
          </div>
        </div>
      </div>

      {/* Upload-Deadline Warnung */}
      {customersNeedingData.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl px-6 py-4 flex items-start gap-3">
          <span className="text-red-500 text-xl mt-0.5">⚠️</span>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="font-manrope font-bold text-red-700 text-sm">Daten-Upload überfällig</div>
              <button
                onClick={() => customersNeedingData.forEach(c => handlePrepare('reminder', c))}
                className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                </svg>
                Alle erinnern
              </button>
            </div>
            <p className="text-xs text-red-600 mt-1">
              Folgende Kunden haben ihre Daten für {monthOptions.find(o => o.value === selectedMonth)?.label ?? selectedMonth} noch nicht bis zum 10. hochgeladen:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {customersNeedingData.map(c => (
                <button
                  key={c.customer_id}
                  onClick={() => handlePrepare('reminder', c)}
                  className="bg-red-100 text-red-700 px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors flex items-center gap-1"
                >
                  {c.company_name}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 opacity-60" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Customer Cards */}
      <div className="space-y-3">
        {customers.map(customer => {
          const expanded = expandedId === customer.customer_id;
          return (
            <div key={customer.customer_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Customer Header Row */}
              <div
                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-offwhite/30 transition-colors"
                onClick={() => { if (expanded) { setExpandedId(null); } else { setExpandedId(customer.customer_id); verifyGmailStatus(customer); } }}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-4 h-4 rounded-full ${ampelStyles[computeAmpel(getMonthData(customer, selectedMonth))]} shadow-sm`} />
                  <div>
                    <div className="font-manrope font-bold text-navy">{customer.company_name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{customer.ansprechpartner}</span>
                      {(customer.emails?.length ?? 0) > 1 ? (
                        <select
                          value={selectedRecipients[customer.customer_id] || customer.emails[0]}
                          onClick={e => e.stopPropagation()}
                          onChange={e => {
                            e.stopPropagation();
                            setSelectedRecipients(prev => ({ ...prev, [customer.customer_id]: e.target.value }));
                          }}
                          className="text-xs text-copper border border-copper/20 rounded-lg px-2 py-0.5 bg-white outline-none"
                        >
                          {customer.emails.map(em => (
                            <option key={em} value={em}>{em}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-400">{customer.emails?.[0] || '–'}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Monthly Status Checkboxes */}
                  <div className="flex gap-2">
                    {(() => {
                      const md = getMonthData(customer, selectedMonth);
                      return [
                      { field: 'daten_erhalten' as const, label: 'Daten', value: md.daten_erhalten, overrideField: 'override_daten_erhalten' as const, isOverridden: md.override_daten_erhalten },
                      { field: 'daten_valide' as const, label: 'Validiert', value: md.daten_valide, overrideField: 'override_daten_valide' as const, isOverridden: md.override_daten_valide },
                      { field: 'call_durchgefuehrt' as const, label: 'Call', value: md.call_durchgefuehrt, overrideField: null, isOverridden: false },
                    ]})().map(item => {
                      const md = getMonthData(customer, selectedMonth);
                      const isAuto = !item.isOverridden && item.field !== 'call_durchgefuehrt' && md.auto_checked_at;
                      const tooltip = item.isOverridden
                        ? 'Manuell gesetzt – Klicke erneut zum Umschalten'
                        : isAuto
                          ? `Automatisch geprüft (${md.auto_checked_at ? formatDate(md.auto_checked_at) : ''})`
                          : 'Klicke zum Umschalten';
                      return (
                        <div key={item.field} className="relative group">
                          <button
                            onClick={e => { e.stopPropagation(); toggleStatus(customer.customer_id, item.field); }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                              item.value
                                ? item.isOverridden
                                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                                  : 'bg-green-50 border-green-200 text-green-700'
                                : md.is_overdue && item.field === 'daten_erhalten'
                                  ? 'bg-red-50 border-red-200 text-red-500 animate-pulse'
                                  : 'bg-gray-50 border-gray-200 text-gray-400'
                            }`}
                            title={tooltip}
                          >
                            {item.value ? '✓' : '○'} {item.label}
                            {Boolean(isAuto) && item.value && <span className="ml-0.5 text-[8px] opacity-60">⚡</span>}
                            {item.isOverridden && <span className="ml-0.5 text-[8px] opacity-60">✏️</span>}
                          </button>
                          {/* Reset override button (appears on hover) */}
                          {item.isOverridden && item.overrideField && (
                            <button
                              onClick={e => { e.stopPropagation(); resetOverride(customer.customer_id, item.overrideField!); }}
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-400 text-white rounded-full text-[8px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-400"
                              title="Manuelle Überschreibung zurücksetzen"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Upload Info */}
                  {(() => {
                    const md = getMonthData(customer, selectedMonth);
                    const fc = md.file_count ?? 0;
                    const us = md.upload_status ?? 'pending';
                    const lu = md.last_upload_date ?? null;
                    return (
                      <div className="text-right min-w-[80px]">
                        <div className={`text-xs font-medium ${us === 'uploaded' ? 'text-green-600' : 'text-red-500'}`}>
                          {fc} Dateien
                        </div>
                        {lu && <div className="text-[10px] text-gray-300">{formatDate(lu)}</div>}
                      </div>
                    );
                  })()}

                  {/* Expand Arrow */}
                  <div className={`text-gray-300 transition-transform text-lg ${expanded ? 'rotate-90' : ''}`}>
                    &rsaquo;
                  </div>
                </div>
              </div>

              {/* Expanded: Auto-Check Details + Workflow Buttons */}
              {expanded && (
                <div className="px-6 pb-6 pt-2 border-t border-gray-100">
                  {/* Auto-Check Info Bar */}
                  {(() => {
                    const md = getMonthData(customer, selectedMonth);
                    if (!md.auto_checked_at) return null;
                    return (
                      <div className="mb-4 flex flex-wrap gap-2">
                        {/* Upload status */}
                        <div className={`text-[11px] px-3 py-1.5 rounded-lg border ${
                          md.daten_erhalten
                            ? 'bg-green-50 border-green-100 text-green-700'
                            : md.is_overdue
                              ? 'bg-red-50 border-red-200 text-red-600'
                              : 'bg-amber-50 border-amber-100 text-amber-700'
                        }`}>
                          {md.daten_erhalten
                            ? `⚡ ${md.file_count ?? 0} Dateien erkannt (Drive)`
                            : md.is_overdue
                              ? '⚠ Überfällig – Keine Daten bis zum 10. hochgeladen'
                              : '○ Noch keine Daten für diesen Monat'}
                          {md.override_daten_erhalten && <span className="ml-1 opacity-60">(manuell überschrieben)</span>}
                        </div>

                        {/* Validation status */}
                        {md.daten_erhalten && (
                          <div className={`text-[11px] px-3 py-1.5 rounded-lg border ${
                            md.daten_valide
                              ? 'bg-green-50 border-green-100 text-green-700'
                              : 'bg-amber-50 border-amber-100 text-amber-700'
                          }`}>
                            {md.daten_valide
                              ? '⚡ Daten validiert (BWA + SuSa vorhanden)'
                              : `⚠ Validierung: ${md.auto_check_issues?.join(', ') || 'Fehlende Dateien'}`}
                            {md.override_daten_valide && <span className="ml-1 opacity-60">(manuell überschrieben)</span>}
                          </div>
                        )}

                        {/* File list (collapsible) */}
                        {md.auto_check_files && md.auto_check_files.length > 0 && (
                          <details className="w-full mt-1">
                            <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600">
                              Dateien anzeigen ({md.auto_check_files.length})
                            </summary>
                            <div className="mt-1 grid grid-cols-2 gap-1">
                              {md.auto_check_files.map((f, i) => (
                                <div key={i} className="text-[10px] text-gray-500 bg-gray-50 rounded px-2 py-1">
                                  📄 {f.name} <span className="text-gray-300">({f.size})</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })()}

                  {verifyingId === customer.customer_id && (
                    <div className="mb-3 flex items-center gap-2 text-xs text-gray-400">
                      <svg className="animate-spin h-3 w-3 text-copper" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Gmail-Status wird geprüft…
                    </div>
                  )}
                  {gmailStatus[customer.customer_id] && verifyingId !== customer.customer_id && (
                    <div className="mb-3 flex items-center gap-1.5 text-[10px] text-gray-400">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400"></span>
                      Gmail-Status verifiziert
                    </div>
                  )}
                  <div className="grid grid-cols-6 gap-3">
                    {WORKFLOW_STEPS.map(step => {
                      const md = getMonthData(customer, selectedMonth);
                      const isSent = step.monthly
                        ? (md[step.type === 'reminder' ? 'reminder_sent' : 'rechnung_sent'] as boolean)
                        : customer[step.sentKey] as boolean;
                      const isPreparing = preparing === `${step.type}-${customer.customer_id}`;
                      const isRechnung = step.type === 'rechnung';
                      const isBezahlt = isRechnung && md.rechnung_bezahlt === true;

                      return (
                        <div key={step.type} className={`rounded-xl border text-center transition-all ${
                          isRechnung && isSent
                            ? isBezahlt
                              ? 'border-green-200 bg-green-50 py-3 px-2'
                              : 'border-amber-200 bg-amber-50/60 py-3 px-2'
                            : isSent
                              ? 'border-green-100 bg-green-50/60 py-3 px-2'
                              : 'border-gray-100 bg-white py-4 px-2'
                        }`}>
                          <div className="text-xl mb-1">{step.icon}</div>
                          <div className="text-[11px] font-semibold text-gray-500 mb-2">{step.label}</div>

                          {isSent ? (
                            <div>
                              {/* Sent status line */}
                              {gmailStatus[customer.customer_id]?.[step.type] === false ? (
                                <div className="text-[11px] text-amber-600 font-medium mb-1.5" title="Entwurf – noch nicht abgesendet">⚠ Entwurf</div>
                              ) : (
                                <div className="text-[11px] font-semibold text-green-600 mb-1.5">✓ Gesendet</div>
                              )}

                              {/* Rechnung: Bezahlt-Status */}
                              {isRechnung && (
                                isBezahlt ? (
                                  <div className="mb-1.5">
                                    <div className="text-[11px] font-bold text-green-700">💚 Bezahlt</div>
                                    {md.rechnung_bezahlt_am && (
                                      <div className="text-[9px] text-gray-400 mt-0.5">{formatDate(md.rechnung_bezahlt_am)}</div>
                                    )}
                                    <button
                                      onClick={() => markRechnungBezahlt(customer.customer_id, false)}
                                      className="mt-1 text-[9px] text-gray-300 hover:text-red-400 underline underline-offset-1 transition-colors"
                                    >
                                      Rückgängig
                                    </button>
                                  </div>
                                ) : (
                                  <div className="mb-1.5">
                                    <div className="text-[11px] font-semibold text-amber-600 mb-1">💶 Offen</div>
                                    <button
                                      onClick={() => markRechnungBezahlt(customer.customer_id, true)}
                                      className="w-full px-1.5 py-1.5 rounded-lg text-[10px] font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm"
                                    >
                                      Bezahlt ✓
                                    </button>
                                  </div>
                                )
                              )}

                              <button
                                onClick={() => handlePrepare(step.type, customer)}
                                className="text-[10px] text-gray-400 hover:text-copper underline underline-offset-2"
                              >
                                Erneut
                              </button>
                              {isRechnung && (
                                <button
                                  onClick={e => { e.stopPropagation(); openInvoiceGenerator(customer); }}
                                  className="mt-1.5 w-full px-1.5 py-1.5 rounded-lg text-[10px] font-semibold bg-navy/90 text-white hover:bg-navy transition-colors"
                                  title="E-Rechnung (ZUGFeRD) erstellen und herunterladen"
                                >
                                  📄 E-Rechnung
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <button
                                onClick={() => handlePrepare(step.type, customer)}
                                disabled={isPreparing}
                                className={`w-full px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                                  isPreparing
                                    ? 'bg-copper/10 text-copper cursor-wait'
                                    : 'bg-copper text-white hover:bg-copper/90 shadow-sm'
                                }`}
                              >
                                {isPreparing ? (
                                  <span className="flex items-center justify-center gap-1">
                                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                  </span>
                                ) : 'Vorbereiten'}
                              </button>
                              {isRechnung && (
                                <button
                                  onClick={e => { e.stopPropagation(); openInvoiceGenerator(customer); }}
                                  className="w-full px-1.5 py-1.5 rounded-lg text-[10px] font-semibold bg-navy/80 text-white hover:bg-navy transition-colors"
                                  title="E-Rechnung (ZUGFeRD) erstellen"
                                >
                                  📄 E-Rechnung
                                </button>
                              )}
                            </div>
                          )}
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

      {/* E-Rechnung Generator Modal */}
      {invoiceForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setInvoiceForm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <div className="font-manrope font-bold text-navy text-lg">E-Rechnung erstellen</div>
                <div className="text-xs text-gray-400 mt-0.5">ZUGFeRD 2.1 · EN 16931 · {invoiceForm.buyerName}</div>
              </div>
              <button onClick={() => setInvoiceForm(null)} className="text-gray-300 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Invoice Meta */}
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Rechnungsdetails</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Rechnungsnummer</label>
                    <input
                      type="text"
                      value={invoiceForm.invoiceNumber}
                      onChange={e => setInvoiceForm(f => f ? { ...f, invoiceNumber: e.target.value } : f)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Leistungsmonat</label>
                    <input
                      type="text"
                      value={monthLabel(invoiceForm.serviceMonth)}
                      readOnly
                      className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Rechnungsdatum</label>
                    <input
                      type="date"
                      value={invoiceForm.issueDate}
                      onChange={e => setInvoiceForm(f => f ? { ...f, issueDate: e.target.value, dueDate: addDays(e.target.value, 30) } : f)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Fälligkeitsdatum</label>
                    <input
                      type="date"
                      value={invoiceForm.dueDate}
                      onChange={e => setInvoiceForm(f => f ? { ...f, dueDate: e.target.value } : f)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/30"
                    />
                  </div>
                </div>
              </div>

              {/* Buyer Address */}
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Rechnungsempfänger</div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Firma</label>
                    <input
                      type="text"
                      value={invoiceForm.buyerName}
                      readOnly
                      className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Straße &amp; Hausnummer</label>
                    <input
                      type="text"
                      value={invoiceForm.buyerStreet}
                      onChange={e => setInvoiceForm(f => f ? { ...f, buyerStreet: e.target.value } : f)}
                      placeholder="z.B. Musterstraße 42"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/30"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">PLZ</label>
                      <input
                        type="text"
                        value={invoiceForm.buyerPostcode}
                        onChange={e => setInvoiceForm(f => f ? { ...f, buyerPostcode: e.target.value } : f)}
                        placeholder="42000"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/30"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 block mb-1">Ort</label>
                      <input
                        type="text"
                        value={invoiceForm.buyerCity}
                        onChange={e => setInvoiceForm(f => f ? { ...f, buyerCity: e.target.value } : f)}
                        placeholder="Stadt"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/30"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Service + Amount */}
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Leistung &amp; Betrag</div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Leistungsbeschreibung</label>
                    <input
                      type="text"
                      value={invoiceForm.serviceDescription}
                      onChange={e => setInvoiceForm(f => f ? { ...f, serviceDescription: e.target.value } : f)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/30"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Nettobetrag (€)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={invoiceForm.netAmount}
                        onChange={e => setInvoiceForm(f => f ? { ...f, netAmount: parseFloat(e.target.value) || 0 } : f)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">MwSt. (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={invoiceForm.vatRate}
                        onChange={e => setInvoiceForm(f => f ? { ...f, vatRate: parseInt(e.target.value) || 0 } : f)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/30"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Totals Preview */}
              {(() => {
                const vat = Math.round(invoiceForm.netAmount * (invoiceForm.vatRate / 100) * 100) / 100;
                const gross = Math.round((invoiceForm.netAmount + vat) * 100) / 100;
                const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return (
                  <div className="bg-offwhite rounded-xl p-4 border border-gray-100">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Netto</span>
                      <span>{fmt(invoiceForm.netAmount)} €</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>MwSt. {invoiceForm.vatRate} %</span>
                      <span>{fmt(vat)} €</span>
                    </div>
                    <div className="flex justify-between font-bold text-navy border-t border-gray-200 pt-2">
                      <span>Gesamtbetrag (brutto)</span>
                      <span>{fmt(gross)} €</span>
                    </div>
                  </div>
                );
              })()}

              {/* SELLER_CONFIG warning if placeholders */}
              {(SELLER_CONFIG.taxId === 'XXX/XXX/XXXXX' || SELLER_CONFIG.iban === 'DE00 0000 0000 0000 0000 00') && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                  ⚠ Steuernummer und/oder IBAN sind noch Platzhalter. Bitte in <code className="bg-amber-100 px-1 rounded">SELLER_CONFIG</code> eintragen bevor echte Rechnungen erstellt werden.
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between items-center pt-2 border-t border-gray-100 gap-3">
                <button
                  onClick={() => setInvoiceForm(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => downloadXml(invoiceForm)}
                    disabled={invoiceDownloading}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                      invoiceDownloading
                        ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-wait'
                        : 'border-navy/20 bg-navy/5 text-navy hover:bg-navy/10'
                    }`}
                    title="ZUGFeRD 2.1 XML herunterladen (für DATEV / E-Rechnung)"
                  >
                    {invoiceDownloading ? (
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    )}
                    XML (ZUGFeRD)
                  </button>
                  <button
                    onClick={() => { printInvoice(invoiceForm); setInvoiceForm(null); }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-copper text-white hover:bg-copper/90 shadow-sm transition-all"
                    title="Rechnung als A4-PDF drucken / speichern"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Als PDF drucken
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Preview Modal */}
      {preview && editDraft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center rounded-t-2xl z-10">
              <div>
                <h2 className="font-manrope text-lg font-bold text-navy">E-Mail bearbeiten &amp; senden</h2>
                <p className="text-xs text-gray-400">Alle Felder können vor dem Versand angepasst werden</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setEditDraft({ ...preview });
                    setBodyResetKey(k => k + 1);
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
                >
                  Zurücksetzen
                </button>
                <button onClick={() => setPreview(null)} className="text-gray-300 hover:text-gray-600 text-2xl">&times;</button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Editable Email Meta */}
              <div className="bg-offwhite rounded-xl p-4 space-y-3 text-sm">
                {/* Von (read-only) */}
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-400 w-16 shrink-0">Von:</span>
                  <span className="text-navy font-medium">{editDraft.from}</span>
                </div>
                {/* An (editable) */}
                <div className="flex items-center gap-2">
                  <label className="font-medium text-gray-400 w-16 shrink-0">An:</label>
                  <input
                    type="email"
                    value={editDraft.to}
                    onChange={e => setEditDraft(d => d ? { ...d, to: e.target.value } : d)}
                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/30"
                  />
                </div>
                {/* Betreff (editable) */}
                <div className="flex items-center gap-2">
                  <label className="font-medium text-gray-400 w-16 shrink-0">Betreff:</label>
                  <input
                    type="text"
                    value={editDraft.subject}
                    onChange={e => setEditDraft(d => d ? { ...d, subject: e.target.value } : d)}
                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-800 focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/30"
                  />
                </div>
                {/* Anhänge */}
                {editDraft.attachments.length > 0 && (
                  <div className="flex gap-2">
                    <span className="font-medium text-gray-400 w-16 shrink-0">Anhänge:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {editDraft.attachments.map((a, i) => (
                        <span key={i} className="bg-white border border-gray-200 px-2 py-0.5 rounded text-xs text-gray-600">
                          📎 {a.name} ({a.size})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Editable Email Body */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-100 px-5 py-2 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-300 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-amber-300 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-green-300 inline-block" />
                  <span className="ml-3 text-[11px] text-gray-400 font-medium tracking-wide uppercase">E-Mail Text</span>
                  <span className="ml-auto text-[10px] text-gray-400 italic">direkt bearbeitbar</span>
                </div>
                <div
                  key={`${editDraft.customer_id}-${editDraft.type}-${bodyResetKey}`}
                  ref={bodyRef}
                  contentEditable
                  suppressContentEditableWarning
                  dangerouslySetInnerHTML={{ __html: editDraft.body }}
                  className="p-6 text-sm leading-relaxed text-gray-800 outline-none focus:bg-amber-50/30
                    [&_p]:mb-4 [&_p:last-child]:mb-0
                    [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:space-y-1
                    [&_li]:text-gray-700
                    [&_strong]:font-semibold [&_strong]:text-gray-900
                    [&_a]:text-copper [&_a]:underline [&_a]:underline-offset-2
                    [&_table]:text-sm [&_table]:mt-3 [&_td]:pr-8 [&_td]:align-top [&_td]:pb-1"
                />
              </div>

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
                    const finalDraft = {
                      ...editDraft,
                      body: bodyRef.current?.innerHTML || editDraft.body,
                    };
                    handleSend(finalDraft);
                  }}
                  disabled={sendingKey !== null}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    sendingKey
                      ? 'bg-copper/50 text-white cursor-wait'
                      : 'bg-copper text-white hover:bg-copper/90 shadow-sm'
                  }`}
                >
                  {sendingKey ? 'Öffnet Gmail...' : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/></svg>
                      In Gmail senden
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
