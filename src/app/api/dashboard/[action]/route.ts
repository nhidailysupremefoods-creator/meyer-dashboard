import { NextRequest, NextResponse } from 'next/server';
import { callAppsScriptApi, extractToken } from '@/lib/apps-script-client';

const CUSTOMER_FALLBACK = [
  { customer_id: 'INDUSTRIE_GAMMA', customer_name: 'Industrie Gamma', is_active: true },
  { customer_id: 'MUSTERMANN_TECHNIK', customer_name: 'Mustermann Technik', is_active: true },
  { customer_id: 'SCHMIDT_ANLAGENBAU', customer_name: 'Schmidt Anlagenbau', is_active: true },
  { customer_id: 'WEBER_HAUSTECHNIK', customer_name: 'Weber Haustechnik', is_active: true },
];

/** German short month names */
const DE_MONTHS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

// -- In-memory cache for Vercel serverless (survives warm invocations) --
interface CacheEntry { data: any; ts: number; }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL: Record<string, number> = {
  customers: 5 * 60 * 1000,   // 5 min
  periods: 3 * 60 * 1000,     // 3 min
  page: 2 * 60 * 1000,        // 2 min for page data
};

function getCached(key: string, ttl: number): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) { cache.delete(key); return null; }
  return entry.data;
}
function setCache(key: string, data: any) {
  cache.set(key, { data, ts: Date.now() });
  // Evict old entries if cache grows too large
  if (cache.size > 100) {
    const now = Date.now();
    cache.forEach((v, k) => { if (now - v.ts > 5 * 60 * 1000) cache.delete(k); });
  }
}

/**
 * Generate fallback periods: last N months ending at today.
 */
function generateFallbackPeriods(count = 14): Array<{period: string; label: string}> {
  const now = new Date();
  const results: Array<{period: string; label: string}> = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const mm = String(m + 1).padStart(2, '0');
    results.push({
      period: `${y}_${mm}`,
      label: `${DE_MONTHS[m]} ${String(y).slice(2)}`,
    });
  }
  return results;
}

/**
 * Transform Apps Script periods response to PeriodsResponse format.
 */
function transformPeriodsResponse(raw: any): { success: true; periods: Array<{period: string; label: string}>; industry_segment?: string } {
  const rawPeriods: any[] = raw.periods || raw.rows || [];
  const mapped = rawPeriods.map((p: any) => ({
    period: p.period || p.month_id || p.period_id || '',
    label: p.label || p.month_label || p.month_label_short || p.period_label || p.period || p.month_id || '',
  })).filter((p: any) => p.period !== '');
  return {
    success: true,
    periods: mapped,
    ...(raw.industry_segment ? { industry_segment: raw.industry_segment } : {}),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  try {
    const { action } = params;
    const validActions = ['periods','page1','page2','page3','page4','advisory','customers','save_tracker'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }
    const searchParams = req.nextUrl.searchParams;
    const token = extractToken(
      Object.fromEntries(Array.from(req.headers.entries()).map(([k, v]) => [k.toLowerCase(), v])),
      searchParams
    );
    const customer = searchParams.get('customer') || '';
    const period = searchParams.get('period') || '';
    const params_obj: Record<string, string> = { action: action };
    if (token) { params_obj.token = token; }
    if (customer) { params_obj.customer = customer; }
    if (period) { params_obj.period = period; }

    // -- customers: cached + fallback --
    if (action === 'customers') {
      const cacheKey = 'customers';
      const cached = getCached(cacheKey, CACHE_TTL.customers);
      if (cached) return NextResponse.json(cached);
      try {
        const result = await callAppsScriptApi(params_obj);
        if (
          result.drive_error ||
          !result.customers ||
          (Array.isArray(result.customers) && result.customers.length === 0)
        ) {
          console.warn('[customers] Using fallback:', result.drive_error);
          const fb = { customers: CUSTOMER_FALLBACK };
          setCache(cacheKey, fb);
          return NextResponse.json(fb);
        }
        setCache(cacheKey, result);
        return NextResponse.json(result);
      } catch (err: any) {
        console.warn('[customers] Fallback due to error:', err.message);
        const fb = { customers: CUSTOMER_FALLBACK };
        setCache(cacheKey, fb);
        return NextResponse.json(fb);
      }
    }

    // -- periods: cached + transform + fallback --
    if (action === 'periods') {
      const cacheKey = `periods_${customer}`;
      const cached = getCached(cacheKey, CACHE_TTL.periods);
      if (cached) return NextResponse.json(cached);
      try {
        const result = await callAppsScriptApi(params_obj);
        if (result.error && !result.periods) {
          console.warn('[periods] Apps Script returned error:', result.error);
          const fb = { success: true, periods: generateFallbackPeriods() };
          return NextResponse.json(fb);
        }
        const transformed = transformPeriodsResponse(result);
        if (transformed.periods.length === 0) {
          console.warn('[periods] No periods from Apps Script, using fallback');
          return NextResponse.json({ success: true, periods: generateFallbackPeriods() });
        }
        setCache(cacheKey, transformed);
        return NextResponse.json(transformed);
      } catch (err: any) {
        console.warn('[periods] Fallback due to error:', err.message);
        return NextResponse.json({ success: true, periods: generateFallbackPeriods() });
      }
    }

    // -- page data: cached for 2 min (same customer+period+page) --
    const isPageAction = /^page[1-4]$/.test(action);
    if (isPageAction) {
      const cacheKey = `${action}_${customer}_${period}`;
      const cached = getCached(cacheKey, CACHE_TTL.page);
      if (cached) return NextResponse.json(cached);
    }

    const result = await callAppsScriptApi(params_obj);

    // If Apps Script returned an error, propagate it clearly
    if (result.error && !result.data && !result.page) {
      console.warn(`[${action}] Apps Script error:`, result.error);
      return NextResponse.json({
        success: false,
        error: result.error,
        action,
      });
    }

    const response = { ...result, success: true };

    // Cache page data
    if (isPageAction) {
      const cacheKey = `${action}_${customer}_${period}`;
      setCache(cacheKey, response);
    }

    return NextResponse.json(response);
  } catch (err: any) {
    const msg = err.message || 'Dashboard API request failed';
    const isTransient = msg.includes('HTML instead of JSON') || msg.includes('timeout');
    console.error(`Dashboard API error for action ${params.action}:`, msg);
    return NextResponse.json(
      {
        success: false,
        error: isTransient
          ? 'Der Server ist vorübergehend nicht erreichbar. Bitte versuche es in wenigen Sekunden erneut.'
          : msg,
        action: params.action,
        retryable: isTransient,
      },
      { status: isTransient ? 503 : 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
