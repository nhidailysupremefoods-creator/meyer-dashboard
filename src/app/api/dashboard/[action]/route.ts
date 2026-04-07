import { NextRequest, NextResponse } from 'next/server';
import { callAppsScriptApi, extractToken } from '@/lib/apps-script-client';

const CUSTOMER_FALLBACK = [
  { customer_id: 'INDUSTRIE_GAMMA', customer_name: 'Industrie Gamma', is_active: true },
  { customer_id: 'MUSTERMANN_TECHNIK', customer_name: 'Mustermann Technik', is_active: true },
  { customer_id: 'SCHMIDT_ANLAGENBAU', customer_name: 'Schmidt Anlagenbau', is_active: true },
  { customer_id: 'WEBER_HAUSTECHNIK', customer_name: 'Weber Haustechnik', is_active: true },
];

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
