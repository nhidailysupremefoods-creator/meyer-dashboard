import { NextResponse } from 'next/server';
import { callAppsScriptApi } from '@/lib/apps-script-client';

/**
 * GET /api/health
 * Health check endpoint to verify API proxy and backend connectivity.
 */
export async function GET() {
  try {
    // Try a simple API call to verify backend is reachable
    const result = await callAppsScriptApi({
      action: 'admin_health_check',
      token: 'health_check',
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      backend: result,
    });
  } catch (err: any) {
    console.error('Health check error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Backend health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

export const dynamic = 'force-dynamic';
