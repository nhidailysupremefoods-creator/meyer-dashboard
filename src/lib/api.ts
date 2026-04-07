/**
 * Client-side API service for Meyer Decision Dashboard
 * All requests go through Vercel API routes (no CORS issues)
 */

import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ResetRequest,
  ResetResponse,
  ConfirmResetRequest,
  ConfirmResetResponse,
  AuthData,
  PeriodsResponse,
  PageDataResponse,
  SaveTrackerResponse,
  AdminInitResponse,
  AdminActionResponse,
  HealthCheckResponse,
  APIError,
} from '@/types';

const TOKEN_KEY = 'md_session_token';
const AUTH_KEY = 'md_auth_data';

/**
 * Get session token from sessionStorage
 */
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

/**
 * Get auth data from sessionStorage
 */
function getAuthData(): AuthData | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Store auth token and data in sessionStorage
 */
function setAuth(token: string, data: Partial<AuthData>) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(data));
}

/**
 * Clear auth from sessionStorage
 */
function clearAuth() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(AUTH_KEY);
}

/**
 * Helper to handle API response and throw APIError on failure
 */
async function handleResponse(res: Response): Promise<any> {
  if (!res.ok) {
    throw new APIError(
      `HTTP ${res.status}: ${res.statusText}`,
      res.status
    );
  }

  try {
    const data = await res.json();
    if (!data.success && data.error) {
      throw new APIError(data.error, res.status, data);
    }
    return data;
  } catch (err: any) {
    if (err instanceof APIError) throw err;
    throw new APIError('Ungültige API-Antwort', res.status);
  }
}

/**
 * Login with email and access code
 */
async function login(payload: LoginRequest): Promise<LoginResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await handleResponse(res);

  if (data.success && data.token) {
    setAuth(data.token, {
      token: data.token,
      role: data.role || 'customer',
      email: data.email || '',
      customers: data.customers || [],
    });
  }

  return data;
}

/**
 * Register new user
 */
async function register(payload: RegisterRequest): Promise<RegisterResponse> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return handleResponse(res);
}

/**
 * Request password reset code
 */
async function requestReset(payload: ResetRequest): Promise<ResetResponse> {
  const res = await fetch('/api/auth/reset-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return handleResponse(res);
}

/**
 * Confirm password reset with code
 */
async function confirmReset(
  payload: ConfirmResetRequest
): Promise<ConfirmResetResponse> {
  const res = await fetch('/api/auth/reset-confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return handleResponse(res);
}

/**
 * Fetch periods for a customer
 */
async function fetchPeriods(customer: string): Promise<PeriodsResponse> {
  const token = getToken();
  if (!token) throw new APIError('Nicht eingeloggt');

  const params = new URLSearchParams({ customer });
  const res = await fetch(`/api/dashboard/periods?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return handleResponse(res);
}

/**
 * Fetch a specific page data (page 1-4)
 */
async function fetchPageData(
  pageNum: number,
  customer: string,
  period: string
): Promise<PageDataResponse> {
  const token = getToken();
  if (!token) throw new APIError('Nicht eingeloggt');

  const action = `page${pageNum}`;
  const params = new URLSearchParams({ customer, period, action });
  const res = await fetch(`/api/dashboard/${action}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return handleResponse(res);
}

/**
 * Save tracker entry (measure realization)
 */
async function saveTracker(data: {
  customer_id: string;
  period: string;
  action_key: string;
  is_realization: boolean;
  target_ebit_eur: number;
  comment?: string;
}): Promise<SaveTrackerResponse> {
  const token = getToken();
  if (!token) throw new APIError('Nicht eingeloggt');

  const res = await fetch('/api/dashboard/tracker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, token }),
  });

  return handleResponse(res);
}

/**
 * Fetch all admin data (customers, users, registrations, audit, releases)
 */
async function fetchAdminInit(): Promise<AdminInitResponse> {
  const token = getToken();
  if (!token) throw new APIError('Nicht eingeloggt');

  const params = new URLSearchParams({ token });
  const res = await fetch(`/api/admin/init?${params}`);

  return handleResponse(res);
}

/**
 * Get health check status
 */
async function fetchHealthCheck(): Promise<HealthCheckResponse> {
  const token = getToken();
  if (!token) throw new APIError('Nicht eingeloggt');

  const params = new URLSearchParams({ token });
  const res = await fetch(`/api/admin/health?${params}`);

  return handleResponse(res);
}

/**
 * Approve a registration
 */
async function approveRegistration(
  email: string
): Promise<AdminActionResponse> {
  const token = getToken();
  if (!token) throw new APIError('Nicht eingeloggt');

  const res = await fetch('/api/admin/registrations/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, email }),
  });

  return handleResponse(res);
}

/**
 * Reject a registration
 */
async function rejectRegistration(
  email: string
): Promise<AdminActionResponse> {
  const token = getToken();
  if (!token) throw new APIError('Nicht eingeloggt');

  const res = await fetch('/api/admin/registrations/reject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, email }),
  });

  return handleResponse(res);
}

/**
 * Update customer
 */
async function updateCustomer(
  customerId: string,
  updates: Record<string, any>
): Promise<AdminActionResponse> {
  const token = getToken();
  if (!token) throw new APIError('Nicht eingeloggt');

  const res = await fetch('/api/admin/customers/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, customer_id: customerId, ...updates }),
  });

  return handleResponse(res);
}

/**
 * Update user
 */
async function updateUser(
  email: string,
  updates: Record<string, any>
): Promise<AdminActionResponse> {
  const token = getToken();
  if (!token) throw new APIError('Nicht eingeloggt');

  const res = await fetch('/api/admin/users/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, email, ...updates }),
  });

  return handleResponse(res);
}

/**
 * Toggle month release
 */
async function toggleRelease(
  customerId: string,
  month: string,
  isReleased: boolean
): Promise<AdminActionResponse> {
  const token = getToken();
  if (!token) throw new APIError('Nicht eingeloggt');

  const res = await fetch('/api/admin/releases/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, customer_id: customerId, month, is_released: isReleased }),
  });

  return handleResponse(res);
}

/**
 * Unrelease all months for a customer
 */
async function unreleaseAll(customerId: string): Promise<AdminActionResponse> {
  const token = getToken();
  if (!token) throw new APIError('Nicht eingeloggt');

  const res = await fetch('/api/admin/releases/unrelease-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, customer_id: customerId }),
  });

  return handleResponse(res);
}

/**
 * Clear cache (admin only)
 */
async function clearCache(): Promise<AdminActionResponse> {
  const token = getToken();
  if (!token) throw new APIError('Nicht eingeloggt');

  const res = await fetch('/api/admin/cache/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  return handleResponse(res);
}

/**
 * Trigger advisory table rebuild (admin only)
 */
async function triggerRebuild(): Promise<AdminActionResponse> {
  const token = getToken();
  if (!token) throw new APIError('Nicht eingeloggt');

  const res = await fetch('/api/admin/rebuild', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  return handleResponse(res);
}

// Export API object
export const api = {
  getToken,
  getAuthData,
  setAuth,
  clearAuth,
  login,
  register,
  requestReset,
  confirmReset,
  fetchPeriods,
  fetchPageData,
  saveTracker,
  fetchAdminInit,
  fetchHealthCheck,
  approveRegistration,
  rejectRegistration,
  updateCustomer,
  updateUser,
  toggleRelease,
  unreleaseAll,
  clearCache,
  triggerRebuild,
};
