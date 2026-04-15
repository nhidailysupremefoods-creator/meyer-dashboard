import { NextRequest, NextResponse } from 'next/server';
import { callAppsScriptPublic } from '@/lib/apps-script-client';

/**
 * POST /api/auth/reset-request
 * Request a password reset code (sent via email).
 *
 * Request body:
 * {
 *   email: string
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
    const { email } = body;

    // Validate input
    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: 'E-Mail-Adresse erforderlich',
        },
        { status: 400 }
      );
    }

    if (typeof email !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'E-Mail muss ein String sein',
        },
        { status: 400 }
      );
    }

    // Call Apps Script password reset request handler
    const result = await callAppsScriptPublic('request_reset', {
      email: email.trim(),
    });

    // Normalize response: Apps Script may return {ok:true} but frontend expects {success:true}
    if (result.ok !== undefined && result.success === undefined) {
      result.success = result.ok;
    }
    // If neither ok nor success is set, treat as success if no error
    if (result.success === undefined && !result.error) {
      result.success = true;
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Password reset request error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Passwort-Zur\u00fccksetzung fehlgeschlagen. Bitte versuchen Sie es sp\u00e4ter erneut.',
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; // Disable caching for auth
