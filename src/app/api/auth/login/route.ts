import { NextRequest, NextResponse } from 'next/server';
import { callAppsScriptPublic } from '@/lib/apps-script-client';

/**
 * POST /api/auth/login
 * Login with email and access code.
 *
 * Request body:
 * {
 *   email: string,
 *   access_code: string
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   token?: string,
 *   role?: string,
 *   email?: string,
 *   customers?: string[],
 *   error?: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, access_code } = body;

    // Validate input
    if (!email || !access_code) {
      return NextResponse.json(
        {
          success: false,
          error: 'E-Mail und Passwort erforderlich',
        },
        { status: 400 }
      );
    }

    if (typeof email !== 'string' || typeof access_code !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'E-Mail und Passwort m\u00fcssen Strings sein',
        },
        { status: 400 }
      );
    }

    // Call Apps Script login handler with correct parameter name 'code'
    const result = await callAppsScriptPublic('login', {
      email: email.trim(),
      code: access_code,
    });

    // Normalize response: Apps Script returns {ok: true} but frontend expects {success: true}
    if (result.ok !== undefined && result.success === undefined) {
      result.success = result.ok;
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Login fehlgeschlagen',
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; // Disable caching for auth
