import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';

/**
 * PDF-Export Proxy
 *
 * Der PDF-Export läuft komplett auf Apps Script (HtmlService → PDF).
 * Diese Route leitet den Request weiter und gibt die PDF-Bytes zurück.
 *
 * GET /api/pdf?token=xxx&customer=CUSTOMER_ID&period=YYYY_MM
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const customer = searchParams.get('customer');
    const period = searchParams.get('period');

    if (!token || !customer || !period) {
      return NextResponse.json(
        { success: false, error: 'Token, Customer und Period erforderlich' },
        { status: 400 }
      );
    }

    // Forward to Apps Script — PDF export uses action=pdf_export
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.set('action', 'pdf_export');
    url.searchParams.set('token', token);
    url.searchParams.set('customer', customer);
    url.searchParams.set('period', period);

    const res = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `PDF-Export fehlgeschlagen: ${res.status}` },
        { status: res.status }
      );
    }

    const contentType = res.headers.get('content-type') || '';

    // If Apps Script returns PDF bytes
    if (contentType.includes('application/pdf')) {
      const pdfBuffer = await res.arrayBuffer();
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Meyer_Decision_Report_${customer}_${period}.pdf"`,
        },
      });
    }

    // If Apps Script returns JSON (e.g. error or base64-encoded PDF)
    const data = await res.json();

    if (data.pdf_base64) {
      const pdfBuffer = Buffer.from(data.pdf_base64, 'base64');
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Meyer_Decision_Report_${customer}_${period}.pdf"`,
        },
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
