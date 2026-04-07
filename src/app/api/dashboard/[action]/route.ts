import { NextRequest, NextResponse } from 'next/server';
import { callAppsScriptApi, extractToken } from '@/lib/apps-script-client';

/**
 * GET /api/dashboard/[action]
 * Dynamic route for dashboard data API calls.
 *
 * Supported actions: periods, page1, page2, page3, page4, advisory, customers
 *
 * Query parameters:
 * - customer: Customer ID
 * - period: Period in format YYYY_MM (e.g., 2026_01)
 *
 * Auth: Bearer token required in Authorization header.
 * Token is NOT forwarded to Apps Script (ANYONE_ANONYMOUS deployment).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  try {
    const { action } = params;

    const validActions = [
      'periods',
      'page1',
      'page2',
      'page3',
      'page4',
      'advisory',
      'customers',
    ];

    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action: ${action}` },
        { status: 400 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const token = extractToken(
      Object.fromEntries(
        Array.from(req.headers.entries()).map(([k, v]) => [k.toLowerCase(), v])
      ),
      searchParams
    );
    const customer = searchParams.get('customer') || '';
    const period = searchParams.get('period') || '';

    // Require auth token
    if (!token) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    // Build params for Apps Script API
    // Note: token is NOT forwarded — Apps Script is ANYONE_ANONYMOUS, auth enforced here.
    const params_obj: Record<string, string> = { action };

    if (customer) params_obj.customer = customer;
    if (period) params_obj.period = period;

    const result = await callAppsScriptApi(params_obj);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error(`Dashboard API error for action ${params.action}:`, err);
    return NextResponse.json(
      { error: err.message || 'Dashboard API request failed' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
