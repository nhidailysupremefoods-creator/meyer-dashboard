import { NextRequest, NextResponse } from 'next/server';
import { callAppsScriptApi, extractToken } from '@/lib/apps-script-client';

const CUSTOMER_FALLBACK = [
  { customer_id: 'INDUSTRIE_GAMMA', customer_name: 'Industrie Gamma', is_active: true },
  { customer_id: 'MUSTERMANN_TECHNIK', customer_name: 'Mustermann Technik', is_active: true },
  { customer_id: 'SCHMIDT_ANLAGENBAU', customer_name: 'Schmidt Anlagenbau', is_active: true },
  { customer_id: 'WEBER_HAUSTECHNIK', customer_name: 'Weber Haustechnik', is_active: true },
];

/** German short month names */
const DE_MONTHS = ['Jan','Feb','MÃ¤r','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

/**
 * Generate fallback periods: last N months ending at today.
 * Returns array of {period: "YYYY_MM", label: "Mmm YY"} sorted newest first.
 */
function generateFallbackPeriods(count = 14): Array<{period: string; label: string}> {
  const now = new Date();
  const results: Array<{period: string; label: string}> = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth(); // 0-indexed
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
 * Apps Script returns: {customer, periods: [{month_id, month_label_short, period_date}]}
 * Dashboard expects:   {success: true, periods: [{period, label}]}
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

    // ââ customers: fallback to hardcoded list if Apps Script unavailable ââ
    if (action === 'customers') {
      try {
        const result = await callAppsScriptApi(params_obj);
        if (
          result.drive_error ||
          !result.customers ||
          (Array.isArray(result.customers) && result.customers.length === 0)
        ) {
          console.warn('[customers] Using fallback:', result.drive_error);
          return NextResponse.json({ customers: CUSTOMER_FALLBACK });
        }
        return NextResponse.json(result);
      } catch (err: any) {
        console.warn('[customers] Fallback due to error:', err.message);
        return NextResponse.json({ customers: CUSTOMER_FALLBACK });
      }
    }

    // ââ periods: transform response format + fallback if Apps Script fails ââ
    if (action === 'periods') {
      try {
        const result = await callAppsScriptApi(params_obj);
        // Apps Script may return {error: "..."} without success
        if (result.error && !result.periods) {
          console.warn('[periods] Apps Script returned error:', result.error);
          return NextResponse.json({ success: true, periods: generateFallbackPeriods() });
        }
        const transformed = transformPeriodsResponse(result);
        // If no periods returned, use fallback
        if (transformed.periods.length === 0) {
          console.warn('[periods] No periods from Apps Script, using fallback');
          return NextResponse.json({ success: true, periods: generateFallbackPeriods() });
        }
        return NextResponse.json(transformed);
      } catch (err: any) {
        console.warn('[periods] Fallback due to error:', err.message);
        return NextResponse.json({ success: true, periods: generateFallbackPeriods() });
      }
    }

    const result = await callAppsScriptApi(params_obj);

    // If Apps Script returned an error (e.g. expired token), propagate it clearly
    if (result.error && !result.data && !result.page) {
      console.warn(`[${action}] Apps Script error:`, result.error);
      return NextResponse.json({
        success: false,
        error: result.error,
        action,
      });
    }

    // Add success:true â frontend checks response.success before using data
    return NextResponse.json({ ...result, success: true });
  } catch (err: any) {
    const msg = err.message || 'Dashboard API request failed';
    const isTransient = msg.includes('HTML instead of JSON') || msg.includes('timeout');
    console.error(`Dashboard API error for action ${params.action}:`, msg);
    return NextResponse.json(
      {
        success: false,
        error: isTransient
          ? 'Der Server ist voruebergehend nicht erreichbar. Bitte versuche es in wenigen Sekunden erneut.'
          : msg,
        action: params.action,
        retryable: isTransient,
      },
      { status: isTransient ? 503 : 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
