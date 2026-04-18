import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/internal/verify-gmail-sent?email=...
 * Prüft in Gmail (in:sent) ob E-Mails für jeden Workflow-Typ wirklich abgesendet wurden.
 * Nutzt dieselbe OAuth-Methode wie create-gmail-draft.
 */

const SUBJECT_KEYWORDS: Record<string, string> = {
  angebot:   'Angebot für die Zusammenarbeit',
  vertrag:   'Vertragsunterlagen',
  unterlagen: 'Willkommen bei Meyer Decision',
  reminder:  'Kurze Erinnerung',
  rechnung:  'Rechnung Meyer',
}

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type:    'refresh_token',
    }),
  })
  const json = await res.json()
  if (!res.ok || !json.access_token) throw new Error('Token refresh failed: ' + json.error_description)
  return json.access_token
}

async function checkSent(accessToken: string, email: string, keyword: string): Promise<boolean> {
  const q = `in:sent to:${email} subject:"${keyword}"`
  const url = `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=1`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const json = await res.json()
  return Array.isArray(json.messages) && json.messages.length > 0
}

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email')
    if (!email) return NextResponse.json({ error: 'email parameter required' }, { status: 400 })

    const accessToken = await getAccessToken()

    const entries = await Promise.all(
      Object.entries(SUBJECT_KEYWORDS).map(async ([type, keyword]) => {
        const sent = await checkSent(accessToken, email, keyword)
        return [type, sent] as [string, boolean]
      })
    )

    return NextResponse.json(Object.fromEntries(entries))
  } catch (err) {
    console.error('[verify-gmail-sent]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
