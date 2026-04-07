import { NextRequest, NextResponse } from 'next/server';
import { callAppsScriptApi, extractToken } from '@/lib/apps-script-client';

/**
 * GET /api/dashboard/[action]
 * Dynamic route for dashboard data API calls.
 *
 * Supported actions:
 * - periods: Get available reporting periods
 * - page1: Get page 1 (Gesamtlage) data
 * - page2: Get page 2 (Vertragsanalyse) data
 * - page3: Get page 3 (Liquidität) data
 * - page4: Get page 4 (Maßnahmen) data
 * - advisory: Get advisory report data
 * - customers: Get list of accessible customers
 * - save_tracker: Save measure tracker entry
 *
 * Query parameters:
 * - token: Auth token (required for most actions)
 * - customer: Customer ID (required for page1-4, advisory)
 * - period: Period in format YYYY_MM (e.g., 2026_01)
 *
 * Response: Dashboard data as JSON
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  try {
    const { action } = params;

    // Valid dashboard actions from apiDispatch
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
        {
          error: `Invalid action: ${action}`,
        },
        { status: 400 }
      );
    }

    // Extract parameters
    const searchParams = req.nextUrl.searchParams;
    const token = extractToken(
      Object.fromEntries(
        Array.from(req.headers.entries()).map(([k, v]) => [k.toLowerCase(), v])
      ),
      searchParams
    );
    const customer = searchParams.get('customer') || '';
    const period = searchParams.get('period') || '';

    // Build params for Apps Script API
    const params_obj: Record<string, string> = {
      action: action,
    };

    if (token) {
      params_obj.token = token;
    }
    if (customer) {
      params_obj.customer = customer;
    }
    if (period) {
      params_obj.period = period;
    }

    // Call Apps Script
    const result = await callAppsScriptApi(params_obj);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error(`Dashboard API error for action ${params.action}:`, err);
    return NextResponse.json(
      {
        error: err.message || 'Dashboard API request failed',
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; // Disable caching for data endpoints
