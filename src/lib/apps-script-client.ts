/**
 * Server-side utility for calling Google Apps Script backend from Vercel API Routes.
 * All requests go through doGet with URL parameters since we can't use google.script.run from Vercel.
 */

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';

export interface AppsScriptResponse {
  [key: string]: any;
  success?: boolean;
  error?: string;
}

/**
 * Call Apps Script API via GET with action parameter.
 * Used for apiDispatch actions (dashboard data, admin operations).
 * Apps Script doGet routes this to the appropriate handler.
 */
export async function callAppsScriptApi(params: Record<string, string>): Promise<AppsScriptResponse> {
  if (!APPS_SCRIPT_URL) {
    throw new Error('APPS_SCRIPT_URL environment variable is not set');
  }
  const url = new URL(APPS_SCRIPT_URL);

  // Add all parameters as URL query params
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow', // Apps Script redirects on GET
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Apps Script API error: HTTP ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Apps Script API request timeout (30s)');
    }
    throw new Error(`Apps Script API error: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Call Apps Script public functions via GET with action parameter.
 */
export async function callAppsScriptPublic(
  action,
  payload
) {
  if (!APPS_SCRIPT_URL) {
    throw new Error('APPS_SCRIPT_URL environment variable is not set');
  }
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', action);

  Object.entries(payload).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Apps Script public API error: HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Apps Script public API request timeout (30s)');
    }
    throw new Error(`Apps Script public API error: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Helper to extract token from request (header or query param).
 */
export function extractToken(headers, searchParams) {
  const auth = headers.authorization || headers.Authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  const tokenHeader = headers['x-auth-token'] || headers['X-Auth-Token'];
  if (typeof tokenHeader === 'string') {
    return tokenHeader;
  }
  if (searchParams && searchParams.has('token')) {
    return searchParams.get('token');
  }
  return null;
}
