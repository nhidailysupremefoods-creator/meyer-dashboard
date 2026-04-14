// ============================================================
// MEYER DECISION â INTERNAL OS â TypeScript Types
// ============================================================

export type Branche = 'industrienahe_service' | 'technische_wartung' | 'b2b_contracting';
export type PipelineStatus = 'neu' | 'kontaktiert' | 'qualifiziert' | 'angebot' | 'verhandlung' | 'gewonnen' | 'verloren';
export type AmpelStatus = 'GRUEN' | 'GELB' | 'ROT';
export type DocumentType = 'angebot' | 'vertrag' | 'unterlagen' | 'reminder' | 'rechnung';

export interface Lead {
  lead_id: string;
  company_name: string;
  branche: Branche | '';
  umsatz: number | null;
  ebit_marge: number | null;
  mitarbeiteranzahl: number | null;
  controller_anzahl: number | null;
  ansprechpartner: string;
  telefon: string;
  emails: string[];
  adresse: string;
  pipeline_status: PipelineStatus;
  next_action: string;
  next_action_date: string | null;
  icp_score: number;
  lead_source: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  // New fields
  is_archived: boolean;
  archived_at: string | null;
  duplicate_flag: boolean;
  duplicate_reference_id: string | null;
  last_modified_at: string;
}

// Simplified: 1 Kunde = 1 Vertrag (no multi-contract)
export interface MandateTracking {
  customer_id: string;
  company_name: string;
  ansprechpartner: string;
  emails: string[];
  vertragsbeginn: string | null;
  vertragsende: string | null;
  vertragsart: string;
  gebuchte_dienstleistung: string;
  monatliches_honorar: number | null;
  setup_fee: number | null;
  mandate_status: string;
  notes: string;
  last_auto_sync: string;
  manually_edited: boolean;
  laufzeit_monate?: number | string | null;
}

export interface OperationsCustomer {
  customer_id: string;
  company_name: string;
  ansprechpartner: string;
  emails: string[];
  daten_erhalten: boolean;
  daten_valide: boolean;
  call_durchgefuehrt: boolean;
  ampel_status: AmpelStatus;
  upload_status: string;
  file_count: number;
  last_upload_date: string | null;
  reminder_sent: boolean;
  monatliches_honorar: number;
  mandate_status: string;
  // Workflow-Status pro Step
  angebot_sent: boolean;
  vertrag_sent: boolean;
  unterlagen_sent: boolean;
  rechnung_sent: boolean;
  // Auto-Check: manual override flags (when true, auto-check won't overwrite user's value)
  override_daten_erhalten?: boolean;
  override_daten_valide?: boolean;
  // Auto-Check metadata
  auto_check_files?: { name: string; size: string; date: string }[];
  auto_check_missing?: string[];
  auto_check_issues?: string[];
  auto_checked_at?: string | null;
  is_overdue?: boolean;
}

export interface UploadCheckResult {
  daten_erhalten: boolean;
  file_count: number;
  last_upload_date: string | null;
  files: { name: string; size: string; date: string; mimeType?: string }[];
  folder_found: boolean;
  is_overdue: boolean;
  current_month: string;
  error?: string;
}

export interface ValidationResult {
  daten_valide: boolean;
  missing_files: string[];
  issues: string[];
  checked_files?: number;
}

export interface EmailPreview {
  to: string;
  from: string;
  subject: string;
  body: string;
  attachments: { name: string; size: string }[];
  type: DocumentType;
  customer_id: string;
}

// API response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DuplicateMatch {
  lead_id: string;
  company_name: string;
  similarity: number;
}
