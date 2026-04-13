import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/internal/send-email
 * Proxy zu Google Apps Script → GmailApp.sendEmail
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, from, subject, body: emailBody, type, customer_id } = body;

    if (!to || !from || !subject || !emailBody) {
      return NextResponse.json(
        { success: false, error: 'Fehlende Pflichtfelder: to, from, subject, body' },
        { status: 400 }
      );
    }

    const API_BASE = process.env.INTERNAL_OS_API_URL || process.env.NEXT_PUBLIC_INTERNAL_OS_API_URL;
    if (!API_BASE) {
      return NextResponse.json(
        { success: false, error: 'Backend nicht konfiguriert. Bitte INTERNAL_OS_API_URL setzen.' },
        { status: 503 }
      );
    }

    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ops_send', type, customer_id, sender: from, to, subject, body: emailBody }),
    });

    const result = await response.json();
    if (result.error) return NextResponse.json({ success: false, error: result.error }, { status: 500 });

    return NextResponse.json({ success: true, message: `E-Mail gesendet an ${to}` });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Serverfehler: ${error instanceof Error ? error.message : 'Unbekannt'}` },
      { status: 500 }
    );
  }
}
