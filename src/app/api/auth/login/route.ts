import { NextRequest, NextResponse } from 'next/server';
import { callAppsScriptPublic } from '@/lib/apps-script-client';

/**
 * POST /api/auth/login
 * Login with email and access code.
 *
 * Request body: { email: string, access_code: string }
 * Response: { success: boolean, token?, role?, email?, customers?: string[], error? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, access_code } = body;

    if (!email || !access_code) {
      return NextResponse.json(
        { success: false, error: 'Email und Zugriffscode erforderlich' },
        { status: 400 }
      );
    }

    if (typeof email !== 'string' || typeof access_code !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email und Zugriffscode müssen Strings sein' },
        { status: 400 }
      );
    }

    // Call Apps Script login handler
    const result = await callAppsScriptPublic('login', {
      email: email.trim(),
      code: access_code,
    });

    // Normalize Apps Script response to frontend format
    // Apps Script returns: {ok: true, role, token, email, customer_id}
    // Frontend expects:    {success: true, role, token, email, customers[]}
    if (result.ok || result.success) {
      return NextResponse.json({
        success: true,
        token: result.token,
        role: result.role || 'customer',
        email: result.email || email.trim(),
        customers: Array.isArray(result.customers)
          ? result.customers
          : result.customer_id && result.customer_id !== '__GLOBAL__'
          ? [result.customer_id]
          : [],
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || result.message || 'Login fehlgeschlagen',
      });
    }
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Login fehlgeschlagen' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
