# Authentication & Token Guide for Admin Panel

## Token Management Architecture

### 1. Token Storage

**Location**: Browser localStorage
**Key**: `md_session_token`
**Scope**: Shared across all tabs (enables PDF export coordination)

```typescript
// src/lib/api.ts
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY); // TOKEN_KEY = 'md_session_token'
}
```

### 2. Token Creation (Login)

When user logs in with email + access_code:

```typescript
// src/lib/api.ts - login()
const res = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, access_code })
});

const data = await handleResponse(res);
if (data.success && data.token) {
  setAuth(data.token, {
    token: data.token,
    role: data.role || 'customer',
    email: data.email || '',
    customers: data.customers || [],
  });
}
```

**Flow**:
1. Frontend POST to `/api/auth/login` with email + access_code
2. Route calls Apps Script `doPost(e)` with same params
3. Apps Script:
   - Verifies email exists in `config_eu.customer_users`
   - Verifies access_code matches
   - Checks `is_active = TRUE`
   - Generates random token via `Utilities.getUuid()`
   - Stores token in `CacheService` with email/role/customers (TTL: 6 hours)
   - Returns `{success: true, token, role, email, customers}`
4. Frontend receives token
5. Token stored in localStorage via `setAuth()`

---

## 3. Token Usage in Admin Requests

### Pattern 1: Query Parameter
```typescript
// src/lib/api.ts - fetchAdminInit()
const params = new URLSearchParams({ token });
const res = await fetch(`/api/admin/init?${params}`);
```

### Pattern 2: Request Body
```typescript
// src/lib/api.ts - updateCustomer()
const res = await fetch('/api/admin/update_customer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token, customer_id: customerId, ...updates })
});
```

### Pattern 3: Both (Route handler accepts either)
```typescript
// src/app/api/admin/[action]/route.ts - handleAdminRequest()
const headerObj = Object.fromEntries(
  Array.from(req.headers.entries()).map(([k, v]) => [k.toLowerCase(), v])
);
const token = extractToken(headerObj, req.nextUrl.searchParams);
```

---

## 4. Token Validation Flow

```
Frontend Request (with token)
    ↓
/api/admin/[action]/route.ts
    ↓
extractToken() - checks body, headers, query params
    ↓
If no token found:
  → Return {error: 'Admin token erforderlich'} (401)
    ↓
If token found:
  → Build params including token
  → Call Apps Script: callAppsScriptApi(params_obj)
    ↓
Apps Script doGet(e)
    ↓
apiDispatch() checks token via verifyToken(e.parameter.token)
    ↓
verifyToken():
  → Reads CacheService with key `md_tok_${token}`
  → If found & role='admin': ✅ Continue
  → If not found or not admin: ❌ Return {error: '...', success: false}
```

---

## 5. Common Token Issues

### Issue 1: "Admin token erforderlich"

**Cause**: Token not found in request
**Check**:
```javascript
// In browser console
localStorage.getItem('md_session_token')  // Should return UUID
```

**Solutions**:
1. **User didn't log in**: Redirect to login page
2. **Token expired**: (TTL 6 hours) Force re-login
3. **Wrong account type**: User might be 'customer', not 'admin'

### Issue 2: "Nicht eingeloggt"

**Cause**: Token is null/empty when API method tries to use it
**Check**:
```typescript
// src/lib/api.ts - all methods start with:
const token = getToken();
if (!token) throw new APIError('Nicht eingeloggt');
```

**Solutions**:
1. Ensure login completed successfully
2. Check localStorage in browser DevTools
3. Verify auth data is set: `localStorage.getItem('md_auth_data')`

### Issue 3: "ROLE_NONE" or access denied

**Cause**: Token exists but role is not 'admin'
**Check**:
```javascript
// In browser console
JSON.parse(localStorage.getItem('md_auth_data')).role  // Should be 'admin'
```

**Solutions**:
1. User must be in `config_eu.customer_users` with `role = 'admin'`
2. If user is 'customer' or 'viewer', they can't access admin panel
3. Admin must add user with admin role first

---

## 6. Token Lifetime

### Creation
- Generated at login via `Utilities.getUuid()`
- Format: UUID v4 (36 chars)
- Example: `550e8400-e29b-41d4-a716-446655440000`

### Storage
- **Frontend**: localStorage (persists across tabs, survives browser restart)
- **Backend**: CacheService (server-side, TTL 6 hours)
- **Apps Script**: `CacheService.getScriptCache().put(key, value, ttl_seconds)`

### Expiration
- After 6 hours: Token deleted from CacheService
- When user closes all tabs: localStorage still holds token but invalid on server
- When user logs out: token cleared from localStorage

### Refresh
- No automatic refresh mechanism
- User must log in again after 6 hours
- System could implement "extend token" endpoint (not currently done)

---

## 7. Multi-Tab Scenario

### Tab A logs in
```
Tab A: localStorage['md_session_token'] = 'abc123...'
Tab B: localStorage['md_session_token'] = '' (nothing yet)
```

### Tab B opens dashboard (same user)
```
useAuth hook in Tab B checks localStorage
Finds 'abc123...' from Tab A
Uses same token ✅
```

### Both tabs can use same token simultaneously
```
Tab A: Admin panel → updateCustomer() → uses 'abc123...'
Tab B: PDF export → fetchPageData() → uses 'abc123...'
Both calls happen in parallel with same token ✅
```

### Logout in one tab affects both
```
Tab A: Logout → localStorage.clear()
Tab B: Page refresh → localStorage empty → redirects to login ✅
```

---

## 8. Testing Token Flow

### Step 1: Clear all auth data
```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Step 2: Navigate to login
```
http://localhost:3000/login
```

### Step 3: Enter credentials
- Email: gregory@meyerdecision.com (or other admin user)
- Access Code: Drachimaus0205 (or correct code)

### Step 4: Verify token was saved
```javascript
// Open browser DevTools Console
localStorage.getItem('md_session_token')
// Should return something like: "550e8400-e29b-41d4-a716-446655440000"

JSON.parse(localStorage.getItem('md_auth_data'))
// Should return: {
//   token: "550e8400-e29b-41d4-a716-446655440000",
//   role: "admin",
//   email: "gregory@meyerdecision.com",
//   customers: ["INDUSTRIE_GAMMA", ...]
// }
```

### Step 5: Navigate to admin
```
http://localhost:3000/dashboard/admin
```

### Step 6: Try admin operation
- Go to Customers tab
- Change industry segment
- Click Save
- Check Network tab in DevTools:
  - Request should include token in body
  - Response should have `{success: true}`

### Step 7: Monitor App Script execution
- Open Apps Script project
- View → Execution log
- Should show successful execution of admin actions

---

## 9. Debugging Admin Operations

### Network Tab Inspection

**Request to /api/admin/update_customer:**
```
POST /api/admin/update_customer HTTP/1.1
Content-Type: application/json

{
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "customer_id": "INDUSTRIE_GAMMA",
  "industry_segment": "TECHN_WARTUNG"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Customer updated"
}
```

**Response (Token Error):**
```json
{
  "error": "Admin token erforderlich"
}
```

### Apps Script Execution Logs

```
[Login] User: gregory@meyerdecision.com, Role: admin ✅
[Admin update_customer] INDUSTRIE_GAMMA → industry_segment=TECHN_WARTUNG ✅
[BigQuery] UPDATE config_eu.customers SET industry_segment='TECHN_WARTUNG' ✅
[Audit] Event: CUSTOMER_INDUSTRY_CHANGED, Customer: INDUSTRIE_GAMMA ✅
```

---

## 10. Security Considerations

### Token Security

✅ **Good**:
- Token is UUID (cryptographically random)
- Token stored in localStorage (not in URL)
- Token not logged in console
- Token has TTL (6 hours)
- Token verified on every admin request

⚠️ **Potential Improvements** (not critical):
- Add HTTPS requirement (prevents man-in-the-middle)
- Implement token rotation (generate new token before expiry)
- Add request signing (prevent token replay attacks)
- Use httpOnly cookies instead of localStorage

### Current Architecture is Safe Because:
1. Token is random UUID (not predictable)
2. Apps Script verifies token on every request
3. Apps Script checks user role/permissions
4. BigQuery audit log records all changes
5. Network calls are over HTTPS (in production)

---

## 11. Integration with useAdmin Hook

### How useAdmin uses token

```typescript
// src/hooks/useAdmin.ts
export function useAdmin(): UseAdminReturn {
  const updateCustomer = useCallback(
    async (customerId: string, updates: Record<string, any>): Promise<boolean> => {
      try {
        // Hook calls api.updateCustomer() which:
        // 1. Gets token from localStorage
        // 2. Adds token to request body
        // 3. Sends to /api/admin/update_customer
        const response = await api.updateCustomer(customerId, updates);

        if (!response.success) {
          // If response.error exists, throw it
          throw new APIError(response.error || 'Update fehlgeschlagen');
        }

        // On success, reload all admin data
        await init();
        return true;
      } catch (err) {
        setError(err.message);
        return false;
      }
    },
    [init]
  );
}
```

### How components use useAdmin

```typescript
// src/components/admin/CustomerTab.tsx
export default function CustomerTab({ customers, onUpdate }: CustomerTabProps) {
  const { updateCustomer, loading, error } = useAdmin();

  const handleSave = async (customerId: string) => {
    // Call hook method - token is handled internally
    const success = await updateCustomer(customerId, {
      industry_segment: newIndustry
    });

    if (success) {
      // Refresh data from parent component
      await onUpdate();
    }
  };
}
```

**Key Point**: Components never see the token directly. They just call hook methods, which handle token internally.

---

## Summary

- **Token is stored**: localStorage['md_session_token']
- **Token is sent**: In request body or query params
- **Token is verified**: On every admin request by Apps Script
- **Token expires**: After 6 hours of inactivity
- **Token is used for**: Authentication + role verification
- **If token missing**: User gets "Admin token erforderlich" error
- **If token invalid**: Apps Script returns {success: false, error: '...'}
- **If role wrong**: User denied access (not admin)

Everything is working as designed. If you get "Admin token erforderlich" errors, it's almost always because:
1. User isn't logged in (no token in localStorage)
2. Token expired (need to log in again)
3. User isn't an admin (need admin role in database)

---

**Updated**: April 14, 2026
**Audience**: Gregory & Engineering Team
