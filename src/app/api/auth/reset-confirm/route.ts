import { NextRequest, NextResponse } from 'next/server';
import { callAppsScriptPublic } from '@/lib/apps-script-client';

/**
 * POST /api/auth/reset-confirm
 * Confirm password reset with code and set new password.
 *
 * Request body:
 * {
 *   email: string,
 *   code: string,
 *   password: string
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
    const { email, code, password } = body;

    // Validate input
    if (!email || !code || !password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email, Code und neues Passwort erforderlich',
        },
        { status: 400 }
      );
    }

    if (
      typeof email !== 'string' ||
      typeof code !== 'string' ||
      typeof password !== 'string'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email, Code und Passwort müssen Strings sein',
        },
        { status: 400 }
      );
    }

    // Call Apps Script password reset confirm handler
    // Apps Script expects: email, code, new_password
    const result = await callAppsScriptPublic('confirm_reset', {
      email: email.trim(),
      code: code.trim(),
      new_password: password,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Password reset confirm error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err.message || 'Passwort-Zurücksetzen fehlgeschlagen',
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; // Disable caching for auth
