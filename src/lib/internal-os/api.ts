// ============================================================
// Internal OS – API Client
// ============================================================
import { Lead, MandateTracking, OperationsCustomer, PaginatedResponse, EmailPreview } from './types';

const API_BASE = process.env.NEXT_PUBLIC_INTERNAL_OS_API_URL || '';

async function apiFetch<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  if (!API_BASE) throw new Error('USE_LOCAL_STATE');
  const url = new URL(API_BASE);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.data as T;
}

async function apiPost<T>(action: string, body: Record<string, unknown>): Promise<T> {
  if (!API_BASE) throw new Error('USE_LOCAL_STATE');
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.data as T;
}

export async function fetchLeads(params: {
  page?: number; pageSize?: number; search?: string; status?: string; sortBy?: string; includeArchived?: boolean;
}): Promise<PaginatedResponse<Lead>> {
  return apiFetch('crm_list', {
    page: String(params.page || 1), pageSize: String(params.pageSize || 50),
    search: params.search || '', status: params.status || '',
    sortBy: params.sortBy || 'icp_score', includeArchived: String(params.includeArchived || false),
  });
}

export async function saveLead(lead: Partial<Lead>): Promise<Lead> {
  return apiPost('crm_save', { lead });
}

export async function archiveLead(leadId: string): Promise<void> {
  return apiPost('crm_archive', { lead_id: leadId });
}

export async function fetchMandates(): Promise<MandateTracking[]> {
  return apiFetch('mandate_list');
}

export async function saveMandate(mandate: Partial<MandateTracking>): Promise<MandateTracking> {
  return apiPost('mandate_save', { mandate });
}

export async function fetchOperations(): Promise<OperationsCustomer[]> {
  return apiFetch('ops_overview');
}

export async function sendEmail(
  type: string, customerId: string, senderEmail: string, preview: EmailPreview,
): Promise<{ success: boolean; message: string }> {
  return apiPost('ops_send', { type, customer_id: customerId, sender: senderEmail, preview });
}
