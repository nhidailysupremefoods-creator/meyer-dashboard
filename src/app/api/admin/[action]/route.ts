import { NextRequest, NextResponse } from 'next/server';
import { callAppsScriptApi, extractToken } from '@/lib/apps-script-client';

/**
 * GET/POST /api/admin/[action]
 * Dynamic route for admin API calls.
 *
 * All admin actions require authentication via token.
 * Routes to apiDispatch in Dashboard.gs with 'admin_' prefixed action names.
 *
 * Supported actions (from Dashboard.gs apiDispatch switch):
 *
 * Dashboard data (no 'admin_' prefix):
 * - page1, page2, page3, page4: Requires token, customer, period
 * - advisory: Requires token, customer, period
 * - customers: Requires token
 * - periods: Requires token, customer
 *
 * Admin read operations:
 * - admin_init: Get all admin data (customers, users, registrations, audit, releases)
 * - admin_customers: Get list of customers
 * - admin_get_users: Get users list (filters by role, customer_id)
 * - admin_registrations: Get pending registrations
 * - admin_audit_log: Get audit log (can filter by date_from, date_to, event_type)
 * - admin_get_mapping: Get account mapping configuration
 * - admin_get_translation: Get account translation (company_id, source_account_code)
 * - admin_get_unmapped: Get unmapped source accounts
 * - admin_health_check: Check system health
 * - admin_rebuild_status: Get rebuild status/logs
 *
 * Admin write operations:
 * - admin_update_customer: Update customer (customer_id, name, subscription_type, status, industry_segment)
 * - admin_add_user: Add new user (email, role, customer_id, display_name, access_code)
 * - admin_update_user: Update user (email, role, customer_id, is_active)
 * - admin_remove_user: Remove user (email) - keep record, mark inactive
 * - admin_delete_user: Delete user (email) - full deletion from BQ
 * - admin_release_month: Release/unreleased a month (customer_id, report_month, release=true/false)
 * - admin_release_all: Release all months for customer (customer_id, release=true/false)
 * - admin_unrelease_month: Unreleased a month (customer_id, report_month)
 * - admin_unrelease_all: Unreleased all months (customer_id)
 * - admin_clear_audit_log: Clear audit log
 * - admin_clear_cache: Clear application cache
 * - admin_trigger_rebuild: Trigger advisory layer rebuild (optional: force_rebuild=true)
 * - admin_leitfaden: Generate Gesprächsleitfaden (customer, period)
 * - admin_approve_registration: Approve pending registration (email, access_code)
 * - admin_reject_registration: Reject pending registration (email)
 * - admin_save_mapping: Save account mapping (source_account_code, target_account_code, category, subcategory)
 * - admin_delete_mapping: Delete account mapping (source_account_code)
 * - admin_save_translation: Save account translation (company_id, source_account_code, target_account_code)
 * - admin_delete_translation: Delete account translation (company_id, source_account_code)
 *
 * Query/body parameters:
 * - token: Auth token (required for all)
 * - [action-specific params based on above]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  return handleAdminRequest(req, params.action, 'GET');
}

export async function POST(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  return handleAdminRequest(req, params.action, 'POST');
}

async function handleAdminRequest(
  req: NextRequest,
  action: string,
  method: 'GET' | 'POST'
) {
  try {
    // Normalize action - add 'admin_' prefix if not present
    let appScriptAction = action;
    if (!action.startsWith('admin_')) {
      appScriptAction = `admin_${action}`;
    }

    // Extract token from headers or query params
    const headerObj = Object.fromEntries(
      Array.from(req.headers.entries()).map(([k, v]) => [k.toLowerCase(), v])
    );
    const token = extractToken(headerObj, req.nextUrl.searchParams);

    if (!token) {
      return NextResponse.json(
        {
          error: 'Admin token erforderlich',
        },
        { status: 401 }
      );
    }

    // Build params for Apps Script API
    // Apps Script uses URL parameters for everything (doGet uses e.parameter)
    const params_obj: Record<string, string> = {
      action: appScriptAction,
      token: token,
    };

    // Add query parameters
    req.nextUrl.searchParams.forEach((value, key) => {
      if (key !== 'token' && key !== 'action') {
        params_obj[key] = value;
      }
    });

    // For POST requests, also merge body fields
    if (method === 'POST') {
      try {
        const body = await req.json();
        Object.entries(body).forEach(([key, value]) => {
          if (value !== null && value !== undefined && key !== 'token') {
            params_obj[key] = String(value);
          }
        });
      } catch {
        // Body might be empty or not JSON, that's okay
      }
    }

    // Call Apps Script via GET with all params as URL parameters
    // (Apps Script doGet/apiDispatch only uses URL parameters)
    const result = await callAppsScriptApi(params_obj);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error(`Admin API error for action ${action}:`, err);
    return NextResponse.json(
      {
        error: err.message || 'Admin API request failed',
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; // Disable caching for admin endpoints
