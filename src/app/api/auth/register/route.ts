import { NextRequest, NextResponse } from 'next/server';
import { callAppsScriptPublic } from '@/lib/apps-script-client';

/**
 * POST /api/auth/register
 * Register a new user account.
 *
 * Request body:
 * {
 *   email: string,
 *   name: string,
 *   firma: string,
 *   password: string
 * }
 *
 * Response:
 * {
 *   ok: boolean,
 *   pending?: boolean,
 *   error?: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, firma, password } = body;

    // Validate input
    if (!email || !name || !firma || !password) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Email, Name, Firma und Passwort erforderlich',
        },
        { status: 400 }
      );
    }

    if (
      typeof email !== 'string' ||
      typeof name !== 'string' ||
      typeof firma !== 'string' ||
      typeof password !== 'string'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Email, Name, Firma und Passwort müssen Strings sein',
        },
        { status: 400 }
      );
    }

    const payload: Record<string, string> = {
      email: email.trim(),
      name: name.trim(),
      firma: firma.trim(),
      password: password,
    };

    // Call Apps Script register handler
    const result = await callAppsScriptPublic('register', payload);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Register error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err.message || 'Registrierung fehlgeschlagen',
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; // Disable caching for auth
