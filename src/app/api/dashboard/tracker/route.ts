import { NextRequest, NextResponse } from 'next/server';
import { callAppsScriptApi, extractToken } from '@/lib/apps-script-client';

/**
 * POST /api/dashboard/tracker
 * Save tracker data for measures/actions.
 *
 * Request body:
 * {
 *   token: string,
 *   customer: string,
 *   period: string,
 *   action_key: string,
 *   measure_id?: string,
 *   status: string,
 *   target_ebit_eur?: number,
 *   [other fields...]
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   message?: string,
 *   error?: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Extract token from body or headers
    let token = body.token;
    if (!token) {
      token = extractToken(
        Object.fromEntries(
          Array.from(req.headers.entries()).map(([k, v]) => [
            k.toLowerCase(),
            v,
          ])
        ),
        req.nextUrl.searchParams
      );
    }

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Auth token erforderlich',
        },
        { status: 401 }
      );
    }

    // Build params for Apps Script API
    const params: Record<string, string> = {
      action: 'save_tracker',
      token: token,
    };

    // Convert body fields to string params
    Object.entries(body).forEach(([key, value]) => {
      if (key !== 'token' && value !== null && value !== undefined) {
        params[key] = String(value);
      }
    });

    // Call Apps Script
    const result = await callAppsScriptApi(params);

    return NextResponse.json({ ...result, success: true });
  } catch (err: any) {
    console.error('Tracker save error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Tracker save failed',
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; // Disable caching for data endpoints
