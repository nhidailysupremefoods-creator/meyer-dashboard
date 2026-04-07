/**
 * Shared type definitions for Meyer Decision Dashboard
 */

// Auth types
export interface AuthData {
  token: string;
  role: 'admin' | 'customer' | 'none';
  email: string;
  customers: string[];
}

export interface LoginRequest {
  email: string;
  access_code: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  role?: 'admin' | 'customer' | 'none';
  email?: string;
  customers?: string[];
  error?: string;
}

export interface RegisterRequest {
  email: string;
  name: string;
  firma: string;
  password: string;
}

export interface RegisterResponse {
  ok?: boolean;
  success?: boolean;
  pending?: boolean;
  message?: string;
  error?: string;
}

export interface ResetRequest {
  email: string;
}

export interface ResetResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ConfirmResetRequest {
  email: string;
  code: string;
  new_password: string;
}

export interface ConfirmResetResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Dashboard types
export interface Period {
  month_id: string; // YYYY_MM or YYYY-MM
  month_label: string; // e.g., "Jan 26"
  month_sort_date: string; // ISO date
  period_label?: string; // e.g., "2026-01"
}

export interface PageDataResponse {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
}

export interface PeriodsResponse {
  success: boolean;
  periods?: Array<{period: string; label: string}>;
  industry_segment?: string;
  error?: string;
}

export interface TrackerData {
  customer_id: string;
  period: string;
  action_key: string;
  is_realization: boolean;
  target_ebit_eur: number;
  comment?: string;
  [key: string]: any;
}

export interface SaveTrackerResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Admin types
export interface Customer {
  customer_id: string;
  name: string;
  is_active: boolean;
  industry_segment?: string;
  [key: string]: any;
}

export interface User {
  email: string;
  display_name: string;
  role: 'admin' | 'customer' | 'viewer';
  customer_id: string;
  is_active: boolean;
  [key: string]: any;
}

export interface Registration {
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at?: string;
  [key: string]: any;
}

export interface AuditEntry {
  event_type: string;
  event_timestamp: string;
  user_email: string;
  customer_id?: string;
  description: string;
  [key: string]: any;
}

export interface Release {
  customer_id: string;
  report_month: string; // YYYY_MM or YYYY-MM
  is_released: boolean;
}

export interface AdminInitResponse {
  success: boolean;
  customers?: Customer[];
  users?: User[];
  registrations?: Registration[];
  audit?: AuditEntry[];
  releases?: Release[];
  error?: string;
}

export interface AdminActionResponse {
  success: boolean;
  message?: string;
  email_status?: string;
  error?: string;
}

export interface HealthCheckResponse {
  success: boolean;
  status?: {
    bigquery: string;
    finance_table: string;
    reporting_views: string;
    cache: string;
    customers: number;
    dashboard_version: string;
  };
  error?: string;
}

// API error
export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}
