import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/internal/create-gmail-draft
 *
 * Creates an HTML Gmail draft using the Gmail REST API.
 * Requires three Vercel env vars:
 *   GMAIL_CLIENT_ID      – Google OAuth2 client ID
 *   GMAIL_CLIENT_SECRET  – Google OAuth2 client secret
 *   GMAIL_REFRESH_TOKEN  – Refresh token for gregory@meyerdecision.com
 *
 * Returns: { success: true, draftId, draftUrl }
 */

function base64url(str: string): string 
  // Encode a string to base64url (URL-safe base64 without padding)
  const b64 = Buffer.from(str, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildRawMessage(to: string, from: string, subject: string, htmlBody: string): string {
  // Encode subject as UTF-8 base64 to handle special characters (umlauts etc.)
  const subjectEncoded = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;

  const message = [
    'MIME-Version: 1.0',
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subjectEncoded}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    htmlBody,
  ].join('\r\n');

  return base64url(Buffer.from(message).toString('binary'));
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Gmail OAuth credentials missing (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN)');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`Token refresh failed: ${json.error_description || json.error || res.status}`);
  }
  return json.access_token as string;
}

export async function POST(request: NextRequest) {
  try {
    const { to, from, subject, body: htmlBody } = await request.json();

    if (!to || !subject || !htmlBody) {
      return NextResponse.json(
        { success: false, error: 'Fehlende Felder: to, subject, body' },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();

    // Build MIME message and base64url-encode it
    const senderLabel = from?.includes('nhi') ? 'Nhi Meyer <nhi@meyerdecision.com>' : 'Gregory Meyer <gregory@meyerdecision.com>';
    const raw = buildRawMessage(to, senderLabel, subject, htmlBody);

    // Create draft via Gmail API
    const gmailRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/drafts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: { raw } }),
    });

    const gmailJson = await gmailRes.json();

    if (!gmailRes.ok) {
      throw new Error(`Gmail API error: ${gmailJson.error?.message || gmailRes.status}`);
    }

    const draftId: string = gmailJson.id;
    const threadId: string = gmailJson.message?.threadId || draftId;
        const draftUrl = `https://mail.google.com/mail/u/0/#drafts/${threadId}`;

    return NextResponse.json({ success: true, draftId, draftUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
