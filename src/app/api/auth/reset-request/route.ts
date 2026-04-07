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
 *   ok: boolean,
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
          ok: false,
          error: 'Email erforderlich',
        },
        { status: 400 }
      );
    }

    if (typeof email !== 'string') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Email muss ein String sein',
        },
        { status: 400 }
      );
    }

    // Call Apps Script password reset request handler
    const result = await callAppsScriptPublic('request_reset', {
      email: email.trim(),
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Password reset request error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err.message || 'Anfrage zum Zurücksetzen des Passworts fehlgeschlagen',
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; // Disable caching for auth
