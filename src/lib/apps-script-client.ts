/**
 * Server-side utility for calling Google Apps Script backend from Vercel API Routes.
 * All requests go through doGet with URL parameters since we can't use google.script.run from Vercel.
 */

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';

if (!APPS_SCRIPT_URL) {
  console.warn('APPS_SCRIPT_URL environment variable is not set');
}

export interface AppsScriptResponse {
  [key: string]: any;
  success?: boolean;
  error?: string;
}

/**
 * Internal: single fetch attempt to Apps Script.
 * Returns parsed JSON or throws with a descriptive error.
 */
async function fetchAppsScript(url: string, timeoutMs: number): Promise<AppsScriptResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Apps Script API error: HTTP ${res.status}`);
    }

    // Read body as text first to detect HTML error pages from Google
    const text = await res.text();
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html') || text.startsWith('<HTML')) {
      throw new Error('Apps Script returned HTML instead of JSON (Google error page)');
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Apps Script returned invalid JSON: ${text.slice(0, 100)}`);
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Apps Script API request timeout');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Call Apps Script API via GET with action parameter.
 * Used for apiDispatch actions (dashboard data, admin operations).
 * Apps Script doGet routes this to the appropriate handler.
 * Includes retry logic: if first attempt returns HTML error page, retries once.
 */
export async function callAppsScriptApi(params: Record<string, string>): Promise<AppsScriptResponse> {
  const url = new URL(APPS_SCRIPT_URL);

  // Add all parameters as URL query params
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  const urlStr = url.toString();
  const MAX_RETRIES = 2;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchAppsScript(urlStr, 30000);
    } catch (err: any) {
      const isRetryable = err.message?.includes('HTML instead of JSON') ||
                          err.message?.includes('timeout') ||
                          err.message?.includes('invalid JSON');
      if (attempt < MAX_RETRIES && isRetryable) {
        console.warn(`[Apps Script] Attempt ${attempt} failed (${err.message}), retrying...`);
        await new Promise(r => setTimeout(r, 1000)); // wait 1s before retry
        continue;
      }
      throw new Error(`Apps Script API error: ${err.message}`);
    }
  }

  throw new Error('Apps Script API error: max retries exceeded');
}

/**
 * Call Apps Script public functions via GET with action parameter.
 * Routes through doGet which handles:
 * - action=login with email, pw params
 * - action=register with email, name, pw params
 * - action=request_reset with email param
 * - action=confirm_reset with email, code, pw params
 */
export async function callAppsScriptPublic(
  action: string,
  payload: Record<string, string>
): Promise<AppsScriptResponse> {
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', action);

  // Add payload as URL params
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  const urlStr = url.toString();
  const MAX_RETRIES = 2;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchAppsScript(urlStr, 30000);
    } catch (err: any) {
      const isRetryable = err.message?.includes('HTML instead of JSON') ||
                          err.message?.includes('timeout') ||
                          err.message?.includes('invalid JSON');
      if (attempt < MAX_RETRIES && isRetryable) {
        console.warn(`[Apps Script Public] Attempt ${attempt} failed (${err.message}), retrying...`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw new Error(`Apps Script public API error: ${err.message}`);
    }
  }

  throw new Error('Apps Script public API error: max retries exceeded');
}

/**
 * Helper to extract token from request (header or query param).
 * Checks: Authorization header (Bearer), x-auth-token header, or token query param.
 */
export function extractToken(
  headers: Record<string, string | string[] | undefined>,
  searchParams?: URLSearchParams
): string | null {
  // Check Authorization header (Bearer token)
  const auth = headers.authorization || headers.Authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }

  // Check x-auth-token header
  const tokenHeader = headers['x-auth-token'] || headers['X-Auth-Token'];
  if (typeof tokenHeader === 'string') {
    return tokenHeader;
  }

  // Check query param
  if (searchParams?.has('token')) {
    return searchParams.get('token');
  }

  return null;
}
